import pg from 'pg'
import type { Request, Response } from 'express'
import { env } from '../config/env.js'
import { logger } from '../config/logger.js'
import { query } from '../db/pool.js'
import type { InboxEvent } from './events.js'

/**
 * Foreground live updates for the app (and, later, the dashboard).
 *
 * Same shape as the bot-config stream (backend/src/services/botConfigStream.ts
 * and the dashboard's src/lib/liveConfig.js): Server-Sent Events, an event id
 * the client echoes back as Last-Event-ID, and payloads the client can apply
 * idempotently. Two things differ:
 *
 *   * Fan-out is Postgres LISTEN/NOTIFY instead of Redis — every event is
 *     already a row in inbox_events (so it can be replayed), and the row's
 *     trigger notifies on commit. One fewer moving part to run.
 *   * Resume is exact rather than "send current state": events are deltas
 *     (a new message), so a reconnecting client needs what it missed, not
 *     just the latest snapshot. If it has been gone longer than the event
 *     retention, it is told to `resync` (refetch lists) instead.
 *
 * This is the foreground channel only. A backgrounded phone loses this
 * connection within seconds; push notifications cover that case.
 */

interface StaffSubscriber {
  kind: 'staff'
  userId: string
  /** Bots this person may see; null = all. Events for other bots are never sent. */
  scope: string[] | null
}
interface VisitorSubscriber { kind: 'visitor'; conversationId: string }

interface Connection {
  res: Response
  who: StaffSubscriber | VisitorSubscriber
  /** Events that arrived live while the resume replay was still being sent. */
  backlog: StoredEvent[] | null
  lastSentId: number
}

interface StoredEvent {
  id: number
  kind: InboxEvent['kind']
  payload: InboxEvent
}

const REPLAY_LIMIT = 500
const connections = new Set<Connection>()
let lastDispatchedId = 0
let listener: pg.Client | null = null
let dispatching: Promise<void> = Promise.resolve()

/** What a Website Chat visitor may see: the public side of their own thread. */
function visibleToVisitor(ev: InboxEvent, conversationId: string): InboxEvent | null {
  if (ev.kind === 'message.created' && ev.conversation.id === conversationId) {
    if (!['incoming', 'outgoing', 'template', 'answer'].includes(ev.message.type)) return null
    // Strip staff-only details before it leaves the building.
    return { kind: 'message.created', conversation: { ...ev.conversation, labels: [], agentId: null }, message: ev.message }
  }
  if ((ev.kind === 'call.ringing' || ev.kind === 'call.answered' || ev.kind === 'call.ended') && ev.call.conversationId === conversationId) return ev
  return null
}

function botOf(ev: InboxEvent): string | null | undefined {
  switch (ev.kind) {
    case 'conversation.updated':
    case 'message.created': return ev.conversation.botId
    case 'message.updated': return ev.botId
    case 'call.ringing':
    case 'call.answered':
    case 'call.ended': return ev.call.botId
    default: return undefined // presence: workspace-wide
  }
}

function visibleToStaff(ev: InboxEvent, scope: string[] | null): boolean {
  if (!scope) return true
  const bot = botOf(ev)
  return bot === undefined || bot === null || scope.includes(bot)
}

function write(conn: Connection, ev: StoredEvent) {
  if (ev.id <= conn.lastSentId) return
  let payload: InboxEvent | null = ev.payload
  if (conn.who.kind === 'visitor') payload = visibleToVisitor(ev.payload, conn.who.conversationId)
  else if (!visibleToStaff(ev.payload, conn.who.scope)) payload = null
  conn.lastSentId = ev.id
  // A filtered-out event still advances the id (sent as a comment-free no-op
  // would be noise); the visitor simply never sees it.
  if (!payload) return
  conn.res.write(`id: ${ev.id}\nevent: ${payload.kind}\ndata: ${JSON.stringify(payload)}\n\n`)
}

function deliver(ev: StoredEvent) {
  for (const conn of connections) {
    try {
      if (conn.backlog) conn.backlog.push(ev)
      else write(conn, ev)
    } catch {
      connections.delete(conn)
    }
  }
}

/** Pulls every committed event after the last one dispatched, in id order. */
function catchUp(): Promise<void> {
  // Serialized: two notifications arriving together must not both read
  // "id > 41" and dispatch 42 twice.
  dispatching = dispatching.then(async () => {
    const rows = await query<StoredEvent>(
      `SELECT id, kind, payload FROM inbox_events WHERE id > $1 ORDER BY id LIMIT 1000`,
      [lastDispatchedId],
    )
    for (const row of rows) {
      lastDispatchedId = row.id
      deliver(row)
    }
  }).catch((err) => logger.error({ err }, '[sse] catch-up failed'))
  return dispatching
}

async function connectListener(): Promise<void> {
  const client = new pg.Client({ connectionString: env.DATABASE_URL })
  client.on('error', (err) => {
    logger.error({ err }, '[sse] LISTEN connection error — reconnecting')
    listener = null
    client.end().catch(() => {})
    setTimeout(() => { connectListener().catch(() => {}) }, 2000)
  })
  client.on('notification', () => { void catchUp() })
  await client.connect()
  await client.query('LISTEN inbox_events')
  listener = client
  // Anything committed while we weren't listening (boot, or a reconnect gap).
  await catchUp()
}

export async function startEventHub(): Promise<void> {
  const rows = await query<{ max: number | null }>(`SELECT max(id) AS max FROM inbox_events`)
  lastDispatchedId = rows[0]?.max ?? 0
  await connectListener()
}

export async function stopEventHub(): Promise<void> {
  for (const conn of connections) conn.res.end()
  connections.clear()
  await listener?.end().catch(() => {})
  listener = null
}

function lastEventIdOf(req: Request): number | null {
  const raw = req.header('last-event-id') ?? (typeof req.query.lastEventId === 'string' ? req.query.lastEventId : undefined)
  const n = raw ? Number(raw) : NaN
  return Number.isFinite(n) && n >= 0 ? n : null
}

/**
 * Opens a stream. With Last-Event-ID, replays what was missed first; live
 * events arriving during the replay are held and flushed after it, skipping
 * any the replay already covered, so nothing is lost or doubled at the seam.
 */
export async function openStream(req: Request, res: Response, who: StaffSubscriber | VisitorSubscriber): Promise<void> {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    // Nginx buffers proxied responses by default, which would batch "live"
    // events minutes late.
    'X-Accel-Buffering': 'no',
  })
  // Reconnect quickly: on mobile the stream is torn down on every network
  // handover, and 3s is noticeable in a chat.
  res.write('retry: 2000\n\n')

  const resumeFrom = lastEventIdOf(req)
  const conn: Connection = { res, who, backlog: resumeFrom !== null ? [] : null, lastSentId: resumeFrom ?? lastDispatchedId }
  connections.add(conn)

  const heartbeat = setInterval(() => {
    try { res.write(': ping\n\n') } catch { /* closed; cleaned up below */ }
  }, 25_000)
  const cleanup = () => {
    clearInterval(heartbeat)
    connections.delete(conn)
  }
  res.on('close', cleanup)
  res.on('error', cleanup)

  // Tells the client where "now" is, so its next reconnect can resume.
  res.write(`event: ready\ndata: ${JSON.stringify({ lastEventId: conn.lastSentId })}\n\n`)

  if (resumeFrom === null) return

  try {
    const oldest = await query<{ min: number | null }>(`SELECT min(id) AS min FROM inbox_events`)
    const min = oldest[0]?.min ?? null
    const missed = await query<StoredEvent>(
      `SELECT id, kind, payload FROM inbox_events WHERE id > $1 AND id <= $2 ORDER BY id LIMIT $3`,
      [resumeFrom, lastDispatchedId, REPLAY_LIMIT + 1],
    )
    const tooOld = min !== null && resumeFrom < min - 1
    if (tooOld || missed.length > REPLAY_LIMIT) {
      // Cheaper and safer to refetch than to stream thousands of deltas.
      conn.lastSentId = lastDispatchedId
      res.write(`id: ${lastDispatchedId}\nevent: resync\ndata: {}\n\n`)
    } else {
      for (const ev of missed) write(conn, ev)
    }
  } finally {
    const held = conn.backlog ?? []
    conn.backlog = null
    for (const ev of held) write(conn, ev)
  }
}

export function connectionCount(): number {
  return connections.size
}
