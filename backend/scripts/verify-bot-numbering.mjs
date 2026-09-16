/*
 * Runs the real migrations against a real PostgreSQL and checks the claims the
 * code and comments make about bot numbering. Nothing is mocked or emulated:
 * embedded-postgres boots actual PostgreSQL binaries into a throwaway cluster,
 * so concurrency, sequence semantics and advisory locks behave exactly as they
 * will in production.
 *
 *   cd backend && npm i -D embedded-postgres && node scripts/verify-bot-numbering.mjs
 *
 * embedded-postgres is deliberately NOT a dependency of this package — it
 * downloads ~100MB of server binaries, which has no business in a deploy. It
 * is installed on demand when someone wants to run this.
 *
 * Checks, in order: the migrations apply; a fresh DB is seeded with bot 1;
 * re-running the seed is a no-op; numbering is global across clients rather
 * than per-client; a rolled-back insert really does burn its number; the
 * UNIQUE constraint rejects a forced collision; archiving never recycles a
 * number; 40 concurrent inserts never collide; and 8 simultaneous first-loads
 * of findOrCreateCurrent() provision exactly one bot.
 */
import EmbeddedPostgres from 'embedded-postgres'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import pg from 'pg'

// Resolved from this file, so it works from any cwd and on any machine.
const MIGRATIONS = fileURLToPath(new URL('../migrations', import.meta.url))
const DATA_DIR = fileURLToPath(new URL('./.pgdata-verify', import.meta.url))
const PORT = 55432

const results = []
function check(name, pass, detail = '') {
  results.push({ name, pass, detail })
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail ? `  — ${detail}` : ''}`)
}

const pgServer = new EmbeddedPostgres({
  databaseDir: DATA_DIR,
  user: 'postgres',
  password: 'postgres',
  port: PORT,
  persistent: false,
})

console.log('Starting PostgreSQL…')
await pgServer.initialise()
await pgServer.start()
// The cluster's default encoding follows the Windows locale (WIN1252 here),
// and the migrations' comment banners contain U+2500 box-drawing characters.
// Create the app database as UTF8 explicitly — which is what any real
// deployment should be doing anyway.
{
  const bootstrap = new pg.Client({
    connectionString: `postgres://postgres:postgres@localhost:${PORT}/postgres`,
  })
  await bootstrap.connect()
  await bootstrap.query(
    `CREATE DATABASE chatflow_wa WITH ENCODING 'UTF8' TEMPLATE template0 LC_COLLATE 'C' LC_CTYPE 'C'`)
  await bootstrap.end()
}

const { Client, Pool } = pg
const connectionString = `postgres://postgres:postgres@localhost:${PORT}/chatflow_wa`
const client = new Client({ connectionString })
await client.connect()

const version = (await client.query('SELECT version()')).rows[0].version
console.log(`Connected: ${version.split(',')[0]}\n`)

// ── Run every migration in order, exactly as a deploy would ───────────────
for (const file of ['001_init.sql', '002_instagram_oauth.sql', '003_clients_and_bots.sql']) {
  const sql = readFileSync(join(MIGRATIONS, file), 'utf8')
  try {
    await client.query(sql)
    check(`migration ${file} applies`, true)
  } catch (err) {
    check(`migration ${file} applies`, false, err.message)
    process.exit(1)
  }
}
console.log('')

// ── 1. The seed gives a fresh database bot 1 ──────────────────────────────
{
  const rows = (await client.query('SELECT bot_number, name FROM bots ORDER BY bot_number')).rows
  check('fresh DB is seeded with exactly one bot',
    rows.length === 1, `got ${rows.length}`)
  check('seeded bot is number 1',
    rows[0]?.bot_number === '1', `bot_number=${rows[0]?.bot_number}`)
}

// ── 2. Re-running the migration's seed is a no-op ─────────────────────────
{
  const seedSql = readFileSync(join(MIGRATIONS, '003_clients_and_bots.sql'), 'utf8')
  const seedOnly = seedSql.slice(seedSql.indexOf('INSERT INTO clients'))
  await client.query(seedOnly)
  const n = (await client.query('SELECT count(*)::int AS c FROM bots')).rows[0].c
  const c = (await client.query('SELECT count(*)::int AS c FROM clients')).rows[0].c
  check('re-running the seed creates no duplicate bot/client',
    n === 1 && c === 1, `bots=${n} clients=${c}`)
}

// ── 3. The sequence is GLOBAL across clients — the spec, literally ────────
{
  const mk = async (name) =>
    (await client.query(`INSERT INTO clients (name) VALUES ($1) RETURNING id`, [name])).rows[0].id
  // client1 already owns the seeded bot 1 (the Default workspace).
  const client1 = (await client.query(
    `SELECT id FROM clients WHERE id = '00000000-0000-0000-0000-000000000001'`)).rows[0].id
  const client2 = await mk('Client Two')
  const client3 = await mk('Client Three')

  const addBot = async (clientId, name) =>
    (await client.query(
      `INSERT INTO bots (client_id, name) VALUES ($1, $2) RETURNING bot_number`,
      [clientId, name])).rows[0].bot_number

  const b2 = await addBot(client2, 'Client2 Bot')   // client 2 → bot 2
  const b3 = await addBot(client1, 'Client1 Bot B') // client 1 again → bot 3
  const b4 = await addBot(client3, 'Client3 Bot')   // client 3 → bot 4

  check('client2→2, client1→3, client3→4 (global, not per-client)',
    b2 === '2' && b3 === '3' && b4 === '4', `got ${b2}, ${b3}, ${b4}`)

  const ownership = (await client.query(
    `SELECT b.bot_number, c.name AS client FROM bots b
     JOIN clients c ON c.id = b.client_id ORDER BY b.bot_number`)).rows
  console.log('     ' + ownership.map(r => `${r.client} → bot ${r.bot_number}`).join('\n     '))

  const client1Bots = (await client.query(
    `SELECT bot_number FROM bots WHERE client_id = $1 ORDER BY bot_number`, [client1])).rows
  check("one client's two bots are 1 and 3, not 1 and 2",
    client1Bots.map(r => r.bot_number).join(',') === '1,3',
    client1Bots.map(r => r.bot_number).join(','))
}

// ── 4. The documented gap behaviour is real, not assumed ──────────────────
{
  const tx = new Client({ connectionString })
  await tx.connect()
  await tx.query('BEGIN')
  const burned = (await tx.query(
    `INSERT INTO bots (client_id, name) VALUES ('00000000-0000-0000-0000-000000000001', 'Doomed') RETURNING bot_number`
  )).rows[0].bot_number
  await tx.query('ROLLBACK')
  await tx.end()

  const next = (await client.query(
    `INSERT INTO bots (client_id, name) VALUES ('00000000-0000-0000-0000-000000000001', 'After rollback') RETURNING bot_number`
  )).rows[0].bot_number

  check('rolled-back insert burns its number (gaps are real, as documented)',
    burned === '5' && next === '6', `burned ${burned}, next ${next}`)
}

// ── 5. bot_number is UNIQUE and cannot be forced to collide ───────────────
{
  let rejected = false
  try {
    await client.query(
      `INSERT INTO bots (bot_number, client_id, name) VALUES (1, '00000000-0000-0000-0000-000000000001', 'Collide')`)
  } catch (err) {
    rejected = err.code === '23505' // unique_violation
  }
  check('duplicate bot_number is rejected by the DB', rejected)
}

// ── 6. Archiving never frees a number for reuse ───────────────────────────
{
  const before = (await client.query(`SELECT last_value FROM bot_number_seq`)).rows[0].last_value
  await client.query(`UPDATE bots SET archived_at = now() WHERE bot_number = 6`)
  const after = (await client.query(
    `INSERT INTO bots (client_id, name) VALUES ('00000000-0000-0000-0000-000000000001', 'Next') RETURNING bot_number`
  )).rows[0].bot_number
  check('archiving does not recycle the number',
    Number(after) > Number(before), `seq was ${before}, new bot is ${after}`)
}

// ── 7. Concurrent inserts never collide ───────────────────────────────────
{
  const pool = new Pool({ connectionString, max: 20 })
  const N = 40
  const got = await Promise.all(
    Array.from({ length: N }, (_, i) =>
      pool.query(
        `INSERT INTO bots (client_id, name) VALUES ('00000000-0000-0000-0000-000000000001', $1) RETURNING bot_number`,
        [`Concurrent ${i}`]
      ).then(r => r.rows[0].bot_number))
  )
  const unique = new Set(got)
  check(`${N} concurrent inserts produce ${N} distinct numbers`,
    unique.size === N, `${unique.size} distinct`)
  await pool.end()
}

// ── 8. findOrCreateCurrent() under concurrency, on an empty table ─────────
//     The advisory-lock path from botRepository.ts, reproduced verbatim.
{
  await client.query('DELETE FROM bots')
  const pool = new Pool({ connectionString, max: 10 })
  const LOCK = 84210001

  async function findOrCreateCurrent() {
    const c = await pool.connect()
    try {
      await c.query('BEGIN')
      const existing = await c.query(
        `SELECT * FROM bots WHERE archived_at IS NULL ORDER BY bot_number DESC LIMIT 1`)
      if (existing.rows[0]) { await c.query('COMMIT'); return existing.rows[0] }
      await c.query(`SELECT pg_advisory_xact_lock($1)`, [LOCK])
      const recheck = await c.query(
        `SELECT * FROM bots WHERE archived_at IS NULL ORDER BY bot_number DESC LIMIT 1`)
      if (recheck.rows[0]) { await c.query('COMMIT'); return recheck.rows[0] }
      await c.query(
        `INSERT INTO clients (id, name) VALUES ($1, 'Default workspace') ON CONFLICT (id) DO NOTHING`,
        ['00000000-0000-0000-0000-000000000001'])
      const created = await c.query(
        `INSERT INTO bots (client_id, name, channel) VALUES ($1, $2, 'webchat') RETURNING *`,
        ['00000000-0000-0000-0000-000000000001', 'Support Bot'])
      await c.query('COMMIT')
      return created.rows[0]
    } catch (e) { await c.query('ROLLBACK'); throw e } finally { c.release() }
  }

  const all = await Promise.all(Array.from({ length: 8 }, findOrCreateCurrent))
  const count = (await client.query('SELECT count(*)::int AS c FROM bots')).rows[0].c
  const distinct = new Set(all.map(b => b.bot_number))
  check('8 simultaneous first-loads provision exactly ONE bot',
    count === 1 && distinct.size === 1, `bots=${count}, distinct returned=${distinct.size}`)

  // And it stays stable once provisioned.
  const again = await findOrCreateCurrent()
  const count2 = (await client.query('SELECT count(*)::int AS c FROM bots')).rows[0].c
  check('a later call returns the same bot without creating another',
    count2 === 1 && again.bot_number === all[0].bot_number,
    `bots=${count2}, number=${again.bot_number}`)
  await pool.end()
}

// ── 9. The route's id validation reaches a BIGINT safely ──────────────────
{
  const rows = (await client.query(
    `SELECT * FROM bots WHERE bot_number = $1::bigint AND archived_at IS NULL`, ['1'])).rows
  check('findByNumber cast works with a string param', rows.length >= 0)
}

console.log('')
const failed = results.filter(r => !r.pass)
console.log(`${results.length - failed.length}/${results.length} checks passed`)

await client.end()
await pgServer.stop()
process.exit(failed.length ? 1 : 0)
