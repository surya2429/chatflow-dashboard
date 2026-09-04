import { logger } from './config/logger.js'
import { pool } from './db/pool.js'
import { redis } from './redis/client.js'
import { startMarketingWorker } from './queues/workers/marketingWorker.js'
import { startPriorityWorker } from './queues/workers/priorityWorker.js'
import { startStatusUpdateWorker } from './queues/workers/statusUpdateWorker.js'
import { startInboundMessageWorker } from './queues/workers/inboundMessageWorker.js'
import { sessionService } from './services/sessionService.js'

/**
 * Worker process — consumes all four queues. Scale this independently from
 * `server.ts` (e.g. more replicas during a large marketing campaign send,
 * fewer at rest). Run multiple instances of this process for horizontal
 * scaling; BullMQ's Redis-backed queue handles job distribution safely
 * across instances.
 */
const workers = [
  startMarketingWorker(),
  startPriorityWorker(),
  startStatusUpdateWorker(),
  startInboundMessageWorker(),
]

logger.info({ workerCount: workers.length }, 'Queue workers started')

// Sweep expired 24h windows every 5 minutes — the read path already filters
// on `window_expires_at > now()`, so this is cleanup/reporting hygiene, not
// a correctness requirement.
const sweepInterval = setInterval(() => {
  sessionService
    .sweepExpiredWindows()
    .then((count) => {
      if (count > 0) logger.info({ count }, 'Closed expired service windows')
    })
    .catch((err: unknown) => logger.error({ err }, 'Failed to sweep expired windows'))
}, 5 * 60 * 1000)

async function shutdown(signal: string): Promise<void> {
  logger.info({ signal }, 'Shutting down queue workers')
  clearInterval(sweepInterval)
  await Promise.allSettled(workers.map((w) => w.close()))
  await Promise.allSettled([pool.end(), redis.quit()])
  process.exit(0)
}

process.on('SIGTERM', () => void shutdown('SIGTERM'))
process.on('SIGINT', () => void shutdown('SIGINT'))
