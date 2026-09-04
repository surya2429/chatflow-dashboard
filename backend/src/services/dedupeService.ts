import { redis } from '../redis/client.js'

const DEDUPE_TTL_SECONDS = 60 * 60 * 24 * 2 // 48h — comfortably longer than Meta's own webhook retry window

/**
 * Meta retries webhook deliveries on anything short of a fast 200, and can
 * also legitimately redeliver the same event. `SET key val NX EX ttl`
 * atomically claims the id — the first worker to see it wins, everyone
 * else gets `null` back and skips processing. No separate read-then-write
 * race window.
 */
export async function claimEventOnce(eventKey: string): Promise<boolean> {
  const result = await redis.set(`wa:dedupe:${eventKey}`, '1', 'EX', DEDUPE_TTL_SECONDS, 'NX')
  return result === 'OK'
}
