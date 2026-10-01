/*
 * Local development database: real PostgreSQL binaries via embedded-postgres,
 * in a cluster under scripts/.pgdata-dev that survives restarts.
 *
 *   npm i --no-save embedded-postgres    # once — ~100MB of server binaries
 *   npm run db:dev                       # keep running in its own terminal
 *
 * Same convention as backend/scripts/verify-bot-numbering.mjs: embedded-postgres
 * is deliberately not a dependency, so it never ends up in a deploy. If you
 * already run Postgres (Docker, Homebrew, a managed instance), skip this and
 * point DATABASE_URL at it.
 */
import EmbeddedPostgres from 'embedded-postgres'
import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import pg from 'pg'

const DATA_DIR = fileURLToPath(new URL('./.pgdata-dev', import.meta.url))
const PORT = Number(process.env.DEV_PG_PORT ?? 55433)
const DB = 'chatflow_agent'

const fresh = !existsSync(DATA_DIR)
const server = new EmbeddedPostgres({ databaseDir: DATA_DIR, user: 'postgres', password: 'postgres', port: PORT, persistent: true })

if (fresh) await server.initialise()
await server.start()

// The cluster's default encoding follows the OS locale (WIN1252 on Windows);
// the app database must be UTF8 — message text is full of emoji.
const admin = new pg.Client({ connectionString: `postgres://postgres:postgres@localhost:${PORT}/postgres` })
await admin.connect()
const exists = await admin.query('SELECT 1 FROM pg_database WHERE datname = $1', [DB])
if (!exists.rowCount) {
  await admin.query(`CREATE DATABASE ${DB} WITH ENCODING 'UTF8' TEMPLATE template0 LC_COLLATE 'C' LC_CTYPE 'C'`)
  console.log(`Created database ${DB}`)
}
await admin.end()

console.log(`PostgreSQL ready — DATABASE_URL=postgres://postgres:postgres@localhost:${PORT}/${DB}`)
console.log('Ctrl+C to stop.')

const stop = async () => { await server.stop(); process.exit(0) }
process.on('SIGINT', stop)
process.on('SIGTERM', stop)
setInterval(() => {}, 1 << 30)
