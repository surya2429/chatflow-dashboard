import { Redis } from 'ioredis'
import { env } from '../config/env.js'

/**
 * BullMQ requires `maxRetriesPerRequest: null` on the connection it's given
 * — otherwise ioredis's default retry/backoff races with BullMQ's own
 * blocking-command retry logic and connections silently stop consuming.
 * This single connection is shared by all queues/workers in-process;
 * BullMQ internally opens additional blocking connections as needed.
 */
export const redis = new Redis(env.REDIS_URL, {
  maxRetriesPerRequest: null,
  enableReadyCheck: true,
})

redis.on('error', (err: Error) => {
  // eslint-disable-next-line no-console
  console.error('[redis] connection error', err)
})
