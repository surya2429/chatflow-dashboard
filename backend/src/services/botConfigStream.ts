import { Redis } from 'ioredis'
import type { Response } from 'express'
import { env } from '../config/env.js'
import { logger } from '../config/logger.js'

/**
 * Live config fan-out to installed widgets.
 *
 * Transport is Server-Sent Events, not WebSocket, because this traffic is
 * strictly one-way (server tells widgets about config changes; widgets never
 * reply on this channel). SSE gets three things for free that would otherwise
 * be hand-written: automatic reconnection with backoff, Last-Event-ID replay
 * on reconnect, and passage through proxies and corporate firewalls that
 * often break WebSocket upgrades on third-party sites. A widget embedded on a
 * stranger's network is exactly where that matters.
 *
 * Redis pub/sub is what makes it correct with more than one API process. A
 * PATCH lands on whichever instance the load balancer picked, while the
 * widgets listening for it are spread across all of them — so the change is
 * published to a channel every instance subscribes to, rather than delivered
 * from the process's own memory. Without this, a config change would reach
 * only the widgets that happened to be connected to the same box.
 *
 * ioredis connections in subscriber mode cannot run normal commands, so this
 * opens its own connection instead of sharing the app's.
 */

const CHANNEL = 'bot:config'

interface ConfigEvent {
  botNumber: string
  version: number
  config: Record<string, unknown>
}

// botNumber -> the open SSE responses waiting on it.
const subscribers = new Map<string, Set<Response>>()

let subscriber: Redis | null = null
let publisher: Redis | null = null

function ensureRedis(): { publisher: Redis } {
  if (!publisher) {
    publisher = new Redis(env.REDIS_URL, { maxRetriesPerRequest: null })
    publisher.on('error', (err) => logger.error({ err }, '[config-stream] publisher error'))
  }
  if (!subscriber) {
    subscriber = new Redis(env.REDIS_URL, { maxRetriesPerRequest: null })
    subscriber.on('error', (err) => logger.error({ err }, '[config-stream] subscriber error'))
    subscriber.subscribe(CHANNEL).catch((err) =>
      logger.error({ err }, '[config-stream] failed to subscribe'))
    subscriber.on('message', (_channel, raw) => {
      let event: ConfigEvent
      try { event = JSON.parse(raw) } catch { return }
      deliver(event)
    })
  }
  return { publisher }
}

/** Writes one SSE frame. `id:` is what the browser echoes back as Last-Event-ID. */
function write(res: Response, event: ConfigEvent) {
  res.write(`id: ${event.version}\n`)
  res.write('event: config\n')
  res.write(`data: ${JSON.stringify({ version: event.version, config: event.config })}\n\n`)
}

function deliver(event: ConfigEvent) {
  const listeners = subscribers.get(event.botNumber)
  if (!listeners?.size) return
  for (const res of listeners) {
    try { write(res, event) } catch { listeners.delete(res) }
  }
}

/** Called after a successful config write. Reaches every instance, not just this one. */
export async function publishConfigChange(event: ConfigEvent): Promise<void> {
  const { publisher } = ensureRedis()
  try {
    await publisher.publish(CHANNEL, JSON.stringify(event))
  } catch (err) {
    // Redis being down must not fail the merchant's save — the change IS
    // persisted, it just propagates on the widget's next poll/reconnect
    // instead of instantly.
    logger.error({ err, botNumber: event.botNumber }, '[config-stream] publish failed')
    deliver(event) // at least reach widgets attached to this instance
  }
}

/**
 * Attaches an SSE response to a bot's change stream.
 *
 * The caller passes `current` so a widget that has just connected is
 * immediately consistent rather than showing stale config until the merchant's
 * next edit — the stream is a push channel, not a substitute for initial load.
 */
export function addSubscriber(botNumber: string, res: Response, current: ConfigEvent | null): void {
  ensureRedis()

  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    // Nginx buffers proxied responses by default, which holds SSE frames until
    // the buffer fills and makes "real time" arrive in batches minutes later.
    'X-Accel-Buffering': 'no',
    // The widget is on the merchant's domain, so this is cross-origin by
    // definition. Read-only public config; no credentials are accepted.
    'Access-Control-Allow-Origin': '*',
  })

  let listeners = subscribers.get(botNumber)
  if (!listeners) {
    listeners = new Set()
    subscribers.set(botNumber, listeners)
  }
  listeners.add(res)

  if (current) write(res, current)

  // Idle proxies and load balancers close connections with no traffic, usually
  // after 30-60s. A comment frame is ignored by EventSource and keeps the
  // connection from being reaped.
  const heartbeat = setInterval(() => {
    try { res.write(': ping\n\n') } catch { /* closed; cleaned up below */ }
  }, 25_000)

  const cleanup = () => {
    clearInterval(heartbeat)
    listeners?.delete(res)
    if (listeners && listeners.size === 0) subscribers.delete(botNumber)
  }
  res.on('close', cleanup)
  res.on('error', cleanup)
}

/** Open stream count, for health checks and tests. */
export function subscriberCount(botNumber?: string): number {
  if (botNumber) return subscribers.get(botNumber)?.size ?? 0
  let total = 0
  for (const set of subscribers.values()) total += set.size
  return total
}
