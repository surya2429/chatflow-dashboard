import { Pool, type PoolClient, type QueryResultRow } from 'pg'
import { env } from '../config/env.js'
import { logger } from '../config/logger.js'

export const pool = new Pool({
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

export async function query<T extends QueryResultRow = QueryResultRow>(
  text: string,
  params?: unknown[],
): Promise<T[]> {
  const start = Date.now()
  const result = await pool.query<T>(text, params)
  const durationMs = Date.now() - start
  if (durationMs > 200) {
    logger.warn({ durationMs, query: text.slice(0, 120) }, 'Slow query')
  }
  return result.rows
}

/**
 * Runs `fn` inside a single transaction. Any thrown error rolls back;
 * successful resolution commits. Use for any multi-statement write where
 * partial application would corrupt state (e.g. campaign counters +
 * message insert).
 */
export async function withTransaction<T>(
  fn: (client: PoolClient) => Promise<T>,
): Promise<T> {
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
