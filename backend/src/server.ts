import { createApp } from './app.js'
import { env } from './config/env.js'
import { logger } from './config/logger.js'
import { pool } from './db/pool.js'
import { redis } from './redis/client.js'
import { closeAllQueues } from './queues/queues.js'

/**
 * HTTP process — handles webhook ingestion and health checks only. Deployed
 * and scaled independently from `worker.ts`: webhook traffic is bursty and
 * latency-sensitive (must ack sub-second), while queue processing is
 * throughput-sensitive and benefits from its own concurrency tuning.
 * Running both in one process works locally but couples their scaling
 * characteristics in production — keep them separate from the start.
 */
const app = createApp()

const server = app.listen(env.PORT, () => {
  logger.info({ port: env.PORT, env: env.NODE_ENV }, 'HTTP server listening')
})

async function shutdown(signal: string): Promise<void> {
  logger.info({ signal }, 'Shutting down HTTP server')
  server.close()
  await Promise.allSettled([closeAllQueues(), pool.end(), redis.quit()])
  process.exit(0)
}

process.on('SIGTERM', () => void shutdown('SIGTERM'))
process.on('SIGINT', () => void shutdown('SIGINT'))
