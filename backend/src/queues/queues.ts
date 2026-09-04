import { Queue } from 'bullmq'
import { redis } from '../redis/client.js'
import type { InboundMessageJob, MarketingSendJob, PrioritySendJob, StatusUpdateJob } from './jobTypes.js'

/**
 * Four queues, two purposes:
 *  - `marketingQueue` / `priorityQueue`  → outbound dispatch (send-side)
 *  - `statusUpdateQueue` / `inboundMessageQueue` → webhook ingestion (receive-side)
 *
 * Splitting webhook processing into its own queues (rather than handling
 * inline in the HTTP handler) is what lets the webhook route ack in
 * milliseconds regardless of how much DB/queue work a given event implies.
 */

const connection = { connection: redis }

export const marketingQueue = new Queue<MarketingSendJob>('marketing-send', {
  ...connection,
  defaultJobOptions: {
    attempts: 5,
    backoff: { type: 'exponential', delay: 2_000 },
    removeOnComplete: { age: 3600, count: 10_000 },
    removeOnFail: { age: 24 * 3600 },
  },
})

export const priorityQueue = new Queue<PrioritySendJob>('priority-send', {
  ...connection,
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: 'exponential', delay: 1_000 },
    removeOnComplete: { age: 3600, count: 10_000 },
    removeOnFail: { age: 24 * 3600 },
  },
})

export const statusUpdateQueue = new Queue<StatusUpdateJob>('status-update', {
  ...connection,
  defaultJobOptions: {
    attempts: 5,
    backoff: { type: 'exponential', delay: 1_000 },
    removeOnComplete: { age: 3600, count: 50_000 },
    removeOnFail: { age: 7 * 24 * 3600 },
  },
})

export const inboundMessageQueue = new Queue<InboundMessageJob>('inbound-message', {
  ...connection,
  defaultJobOptions: {
    attempts: 5,
    backoff: { type: 'exponential', delay: 1_000 },
    removeOnComplete: { age: 3600, count: 50_000 },
    removeOnFail: { age: 7 * 24 * 3600 },
  },
})

export async function closeAllQueues(): Promise<void> {
  await Promise.all([
    marketingQueue.close(),
    priorityQueue.close(),
    statusUpdateQueue.close(),
    inboundMessageQueue.close(),
  ])
}
