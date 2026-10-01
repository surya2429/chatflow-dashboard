import http from 'node:http'
import https from 'node:https'
import { readFileSync } from 'node:fs'
import { env } from './config/env.js'
import { logger } from './config/logger.js'
import { createApp } from './app.js'
import { pool, waitForDatabase } from './db/pool.js'
import { startEventHub, stopEventHub } from './realtime/sseHub.js'
import { attachSignaling } from './signaling/signalingServer.js'
import { startSweeper } from './services/sweeper.js'

const app = createApp()

// TLS in-process when a certificate is configured; otherwise plain HTTP,
// which env.ts only permits in production behind a TLS-terminating proxy.
const server = env.TLS_CERT_PATH && env.TLS_KEY_PATH
  ? https.createServer({ cert: readFileSync(env.TLS_CERT_PATH), key: readFileSync(env.TLS_KEY_PATH) }, app)
  : http.createServer(app)

// SSE responses are long-lived by design; Node's defaults would cut them.
server.requestTimeout = 0
server.headersTimeout = 65_000
server.keepAliveTimeout = 61_000

const signaling = attachSignaling(server)

try {
  await waitForDatabase()
} catch (err) {
  logger.fatal((err as Error).message)
  process.exit(1)
}
await startEventHub()
const stopSweeper = startSweeper()

server.listen(env.PORT, () => {
  const scheme = server instanceof https.Server ? 'https' : 'http'
  logger.info({ port: env.PORT }, `agent-api listening on ${scheme}://localhost:${env.PORT} (signaling at ${scheme === 'https' ? 'wss' : 'ws'}://…/signal)`)
})

let shuttingDown = false
async function shutdown(signal: string) {
  if (shuttingDown) return
  shuttingDown = true
  logger.info({ signal }, 'Shutting down')
  stopSweeper()
  server.close()
  await signaling.close()
  await stopEventHub()
  await pool.end()
  process.exit(0)
}
process.on('SIGINT', () => { void shutdown('SIGINT') })
process.on('SIGTERM', () => { void shutdown('SIGTERM') })
