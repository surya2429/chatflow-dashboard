import pg, { type PoolClient, type QueryResultRow } from 'pg'
import { env } from '../config/env.js'
import { logger } from '../config/logger.js'

// BIGINT (int8) as a JS number. Conversation versions and event ids stay far
// below 2^53, and a string version would make every client-side comparison
// lexicographic ("10" < "9").
pg.types.setTypeParser(20, (v) => Number(v))

export const pool = new pg.Pool({
  connectionString: env.DATABASE_URL,
  max: env.PG_POOL_MAX,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 5_000,
})

pool.on('error', (err) => {
  // Errors on idle clients — must be handled or the process crashes on a
  // dropped connection that isn't currently checked out.
  logger.error({ err }, 'Unexpected error on idle PG client')
})

/** Anything that can run a query: the pool, or a client inside a transaction. */
export type Db = Pick<PoolClient, 'query'>

export async function query<T extends QueryResultRow = QueryResultRow>(
  text: string,
  params?: unknown[],
  db: Db = pool,
): Promise<T[]> {
  const start = Date.now()
  const result = await db.query<T>(text, params)
  const durationMs = Date.now() - start
  if (durationMs > 200) {
    logger.warn({ durationMs, query: text.slice(0, 120) }, 'Slow query')
  }
  return result.rows
}

// Errors that mean "not up yet", as opposed to bad credentials or a missing database.
const NOT_READY = new Set(['ECONNREFUSED', 'ECONNRESET', 'ETIMEDOUT', 'EAI_AGAIN', '57P03' /* cannot_connect_now: starting up */])

function notReady(err: unknown): boolean {
  const e = err as { code?: string; errors?: { code?: string }[] }
  return NOT_READY.has(e.code ?? '') || (e.errors ?? []).some(x => NOT_READY.has(x.code ?? ''))
}

/**
 * Waits for PostgreSQL to accept queries, so starting the API alongside (or
 * just before) the database doesn't crash it. Other errors fail immediately.
 */
export async function waitForDatabase(timeoutSeconds = env.DB_STARTUP_WAIT_SECONDS): Promise<void> {
  const deadline = Date.now() + timeoutSeconds * 1000
  const where = (() => {
    try { const u = new URL(env.DATABASE_URL); return `${u.hostname}:${u.port || 5432}` } catch { return 'the configured database' }
  })()
  let attempt = 0
  for (;;) {
    try {
      await pool.query('SELECT 1')
      if (attempt > 0) logger.info({ where }, 'PostgreSQL is up')
      return
    } catch (err) {
      if (!notReady(err)) throw err
      if (Date.now() >= deadline) {
        throw new Error(`PostgreSQL isn't accepting connections at ${where} after ${timeoutSeconds}s. ` +
          'Start it (npm run db:dev for the local cluster) or check DATABASE_URL.')
      }
      if (attempt % 10 === 0) logger.warn({ where }, 'Waiting for PostgreSQL to accept connections…')
      attempt++
      await new Promise(r => setTimeout(r, 1000))
    }
  }
}

/** Runs `fn` inside one transaction: a throw rolls back, resolution commits. */
export async function withTransaction<T>(fn: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    const result = await fn(client)
    await client.query('COMMIT')
    return result
  } catch (err) {
    await client.query('ROLLBACK')
    throw err
  } finally {
    client.release()
  }
}
