import type { IncomingMessage, Server } from 'node:http'
import type { Duplex } from 'node:stream'
import { WebSocketServer, type WebSocket, type RawData } from 'ws'
import { env } from '../config/env.js'
import { logger } from '../config/logger.js'
import { query } from '../db/pool.js'
import { verifyToken } from '../auth/tokens.js'
import { can, type Actor } from '../auth/policy.js'
import { conversationRepository } from '../db/repositories/conversationRepository.js'
import { visibleBotIds } from '../db/repositories/botRepository.js'
import { notifyUsersLater } from '../push/notificationService.js'
import {
  createSession, endSession, markAccepted, markConnected, type CallSession, type EndReason,
} from './callSessions.js'

/**
 * WebRTC signaling for Website Chat calls — the dev relay from
 * signaling-server/index.js, made fit for production and for a phone.
 *
 * The wire protocol is unchanged so existing clients keep working:
 *
 *   connect  wss://<host>/signal?room=<conversationId>&role=agent|visitor&token=<jwt>
 *   relayed  call-request {video} · call-accept · call-decline · offer {sdp}
 *            answer {sdp} · ice-candidate {candidate} · hangup
 *   server   peer-joined {present} · peer-left
 *
 * What it adds:
 *   * Authentication. Agents present their staff access token and must be
 *     allowed to act on that conversation; visitors present a visitor token
 *     scoped to exactly that room. The old relay let anyone join any room.
 *   * TLS. Served on the API's HTTPS server (or behind the TLS proxy), and
 *     plain ws:// upgrades are refused in production.
 *   * Ringing a phone that isn't connected. A visitor's call-request with no
 *     agent in the room is held, pushed to agents (VoIP/FCM), and replayed to
 *     whichever agent joins to answer. The dashboard never needed this — it
 *     only caught calls for the chat it had open.
 *   * Lifecycle. One tracked call per room, a server ring timeout, cleanup
 *     when a peer drops mid-call, and the outcome logged into the thread.
 *   * Limits. Payload size and message-rate caps, dead-socket detection.
 *
 * Rooms live in this process's memory. With more than one API instance, the
 * load balancer must route /signal by the `room` query parameter (consistent
 * hashing) so both peers of a call land on the same instance.
 */

type Role = 'agent' | 'visitor'

interface Peer {
  ws: WebSocket
  role: Role
  actor: Actor | null       // agents only
  alive: boolean
  window: { start: number; count: number }
}

interface Room {
  id: string
  agent: Peer | null
  visitor: Peer | null
  call: CallSession | null
  /** A visitor's call-request waiting for an agent to connect and answer. */
  pendingRequest: { video: boolean } | null
  ringTimer: NodeJS.Timeout | null
  /**
   * Messages are observed (which may hit the database) and relayed strictly
   * in arrival order. Without this an ICE candidate could overtake the SDP
   * answer that preceded it, and the far side would reject it.
   */
  queue: Promise<void>
}

const MAX_PAYLOAD = 64 * 1024            // SDP is a few KB; this is generous
const RATE_WINDOW_MS = 10_000
const RATE_MAX = 300                     // ICE trickle is bursty but bounded
const rooms = new Map<string, Room>()

function getRoom(id: string): Room {
  let room = rooms.get(id)
  if (!room) {
    room = { id, agent: null, visitor: null, call: null, pendingRequest: null, ringTimer: null, queue: Promise.resolve() }
    rooms.set(id, room)
  }
  return room
}

function other(role: Role): Role { return role === 'agent' ? 'visitor' : 'agent' }

function send(peer: Peer | null, payload: unknown) {
  if (peer && peer.ws.readyState === peer.ws.OPEN) peer.ws.send(JSON.stringify(payload))
}

function cleanupIfIdle(room: Room) {
  if (!room.agent && !room.visitor && !room.call) {
    if (room.ringTimer) clearTimeout(room.ringTimer)
    rooms.delete(room.id)
  }
}

// ── Call lifecycle ──────────────────────────────────────────────────────────

async function whoToRing(conversationId: string): Promise<string[]> {
  const conv = await conversationRepository.findById(conversationId)
  if (!conv) return []
  // The assigned agent first — it's their customer — unless they're off shift.
  if (conv.status === 'agent' && conv.agent_id) {
    const owner = await query<{ presence: string }>(`SELECT presence FROM users WHERE id = $1 AND is_active`, [conv.agent_id])
    if (owner[0] && owner[0].presence !== 'offline') return [conv.agent_id]
  }
  // Otherwise the bot's own agents (and supervisors/admins), online first.
  const onBot = `is_active AND (role <> 'agent' OR $1::uuid IS NULL OR id IN (SELECT user_id FROM bot_agents WHERE bot_id = $1))`
  const online = await query<{ id: string }>(`SELECT id FROM users WHERE ${onBot} AND presence = 'online'`, [conv.bot_id])
  if (online.length) return online.map(r => r.id)
  const away = await query<{ id: string }>(`SELECT id FROM users WHERE ${onBot} AND presence = 'away'`, [conv.bot_id])
  return away.map(r => r.id)
}

function stopRinging(room: Room, reason: 'answered' | 'ended') {
  if (room.ringTimer) { clearTimeout(room.ringTimer); room.ringTimer = null }
  const call = room.call
  if (!call?.rang.length) return
  const others = reason === 'answered' ? call.rang.filter(id => id !== call.agentId) : call.rang
  if (others.length) {
    notifyUsersLater(others, {
      kind: 'call_cancelled', conversationId: call.conversationId, callId: call.id,
      title: reason === 'answered' ? 'Answered by a colleague' : 'Call ended', body: call.contactName,
    })
  }
  call.rang = reason === 'answered' ? [] : call.rang
}

async function finish(room: Room, reason: EndReason) {
  const call = room.call
  room.pendingRequest = null
  if (!call) return
  stopRinging(room, 'ended') // reads room.call — must run before it's cleared
  room.call = null
  await endSession(call, reason)
  cleanupIfIdle(room)
}

function startRingTimer(room: Room) {
  if (room.ringTimer) clearTimeout(room.ringTimer)
  room.ringTimer = setTimeout(() => {
    room.ringTimer = null
    if (room.call && room.call.state === 'ringing') {
      // Tell whoever is still there, in the protocol they already understand.
      send(room.agent, { type: 'hangup' })
      send(room.visitor, { type: 'hangup' })
      void finish(room, 'no-answer')
    }
  }, env.CALL_RING_TIMEOUT_SECONDS * 1000)
}

/**
 * Watches a message on its way through. Returns false to drop it instead of
 * relaying (e.g. a request with nobody to receive it).
 */
async function observe(room: Room, from: Peer, msg: { type?: unknown; video?: unknown }): Promise<boolean> {
  switch (msg.type) {
    case 'call-request': {
      if (room.call) {
        // Already a call in this room — the relay pairs one agent with one visitor.
        send(from, { type: 'call-decline' })
        return false
      }
      const video = !!msg.video
      if (from.role === 'visitor') {
        room.call = await createSession(room.id, 'inbound', video, null)
        if (!room.call) return false
        startRingTimer(room)
        if (!room.agent) {
          // No agent socket: hold the request and wake phones. It's replayed
          // to the first agent who connects (see onConnection).
          room.pendingRequest = { video }
          const targets = await whoToRing(room.id)
          room.call.rang = targets
          notifyUsersLater(targets, {
            kind: 'call', conversationId: room.id, callId: room.call.id, video,
            callerName: room.call.contactName, title: `Incoming ${video ? 'video' : 'voice'} call`, body: room.call.contactName,
          })
          return false
        }
        return true
      }
      // Agent calling the visitor.
      if (!room.visitor) {
        const session = await createSession(room.id, 'outbound', video, from.actor)
        if (session) await endSession(session, 'no-peer')
        return false
      }
      room.call = await createSession(room.id, 'outbound', video, from.actor)
      if (room.call) startRingTimer(room)
      return true
    }
    case 'call-accept': {
      if (!room.call) return true
      room.pendingRequest = null
      await markAccepted(room.call, from.role === 'agent' ? from.actor : null)
      stopRinging(room, 'answered')
      return true
    }
    case 'call-decline':
      await finish(room, 'declined')
      return true
    case 'answer':
      if (room.call) await markConnected(room.call)
      return true
    case 'hangup':
      if (room.call) {
        const reason: EndReason = room.call.state === 'ringing' && from.role === (room.call.direction === 'inbound' ? 'visitor' : 'agent')
          ? 'caller-cancelled' : 'hangup'
        await finish(room, reason)
      }
      return true
    default:
      return true
  }
}

// ── Connection handling ─────────────────────────────────────────────────────

async function authenticate(url: URL): Promise<{ role: Role; room: string; actor: Actor | null } | { error: string; code: number }> {
  const room = url.searchParams.get('room')
  const role = url.searchParams.get('role')
  const token = url.searchParams.get('token')
  if (!room || (role !== 'agent' && role !== 'visitor')) return { error: 'room and role=agent|visitor are required', code: 4400 }
  if (!token) return { error: 'token required', code: 4401 }
  if (!/^[0-9a-f-]{36}$/i.test(room)) return { error: 'unknown room', code: 4404 }

  if (role === 'visitor') {
    const v = await verifyToken(token, 'visitor')
    if (!v.ok || v.claims.typ !== 'visitor' || v.claims.room !== room) return { error: 'invalid visitor token', code: 4401 }
    return { role, room, actor: null }
  }

  const v = await verifyToken(token, 'staff')
  if (!v.ok) return { error: v.reason === 'expired' ? 'token expired' : 'invalid token', code: 4401 }
  const actor: Actor = { id: v.claims.sub, role: v.claims.role, name: v.claims.name }
  if (!can(actor, 'call.place')) return { error: 'forbidden', code: 4403 }
  const conv = await conversationRepository.findById(room)
  if (!conv) return { error: 'unknown room', code: 4404 }
  if (conv.channel !== 'webchat') return { error: 'calling is only available on Website Chat', code: 4403 }
  const scope = await visibleBotIds(actor)
  if (scope && conv.bot_id && !scope.includes(conv.bot_id)) return { error: 'not your bot', code: 4403 }
  const ownedByOther = conv.status === 'agent' && conv.agent_id && conv.agent_id !== actor.id
  if (ownedByOther && !can(actor, 'conversation.override_owner')) return { error: 'assigned to another agent', code: 4403 }
  return { role, room, actor }
}

function onConnection(ws: WebSocket, roomId: string, role: Role, actor: Actor | null) {
  const room = getRoom(roomId)
  const peer: Peer = { ws, role, actor, alive: true, window: { start: Date.now(), count: 0 } }

  const existing = room[role]
  if (existing) {
    // During a live call a second agent must not hijack the room (two phones
    // rang; one already answered). Otherwise a fresh connection replaces the
    // old one — the same phone reconnecting after a network change.
    const sameUser = role === 'agent' && existing.actor?.id === actor?.id
    if (role === 'agent' && room.call && room.call.state !== 'ringing' && !sameUser) {
      ws.close(4409, 'call already taken')
      return
    }
    try { existing.ws.close(1000, 'replaced by a new connection') } catch { /* already gone */ }
  }
  room[role] = peer
  logger.info({ room: roomId, role, user: actor?.id }, '[signaling] joined')

  const counterpart = room[other(role)]
  send(peer, { type: 'peer-joined', present: !!counterpart })
  send(counterpart, { type: 'peer-joined', present: true })

  // An agent arriving to answer a held call gets the request it missed.
  if (role === 'agent' && room.pendingRequest && room.call?.state === 'ringing') {
    send(peer, { type: 'call-request', video: room.pendingRequest.video })
  }

  ws.on('pong', () => { peer.alive = true })

  ws.on('message', (raw: RawData) => {
    const now = Date.now()
    if (now - peer.window.start > RATE_WINDOW_MS) peer.window = { start: now, count: 0 }
    if (++peer.window.count > RATE_MAX) {
      ws.close(4429, 'rate limit')
      return
    }
    let msg: { type?: unknown }
    try { msg = JSON.parse(raw.toString()) } catch { return }
    if (!msg || typeof msg.type !== 'string') return
    room.queue = room.queue
      .then(() => observe(room, peer, msg))
      .then((relay) => { if (relay) send(room[other(role)], msg) })
      .catch((err) => logger.error({ err }, '[signaling] observe failed'))
  })

  ws.on('close', () => {
    if (room[role] !== peer) return // replaced — the new socket owns the slot
    room[role] = null
    logger.info({ room: roomId, role }, '[signaling] left')
    send(room[other(role)], { type: 'peer-left' })
    const call = room.call
    if (call) {
      const callerRole: Role = call.direction === 'inbound' ? 'visitor' : 'agent'
      if (call.state === 'ringing' && role === callerRole) void finish(room, 'caller-cancelled')
      else if (call.state === 'connected' || call.state === 'accepted') void finish(room, 'connection-lost')
      // An agent leaving while a held call is still ringing doesn't end it:
      // another agent's phone may still pick it up.
    }
    cleanupIfIdle(room)
  })

  ws.on('error', () => { /* 'close' follows */ })
}

export function attachSignaling(server: Server) {
  const wss = new WebSocketServer({ noServer: true, maxPayload: MAX_PAYLOAD })

  server.on('upgrade', (req: IncomingMessage, socket: Duplex, head: Buffer) => {
    const url = new URL(req.url ?? '/', 'http://localhost')
    if (url.pathname !== '/signal') { socket.destroy(); return }

    if (env.NODE_ENV === 'production') {
      const secure = (req.socket as { encrypted?: boolean }).encrypted ||
        (env.TRUST_PROXY && req.headers['x-forwarded-proto'] === 'https')
      if (!secure) { socket.write('HTTP/1.1 426 Upgrade Required\r\n\r\n'); socket.destroy(); return }
    }

    authenticate(url).then((auth) => {
      wss.handleUpgrade(req, socket, head, (ws) => {
        // Auth failures are reported as close codes after the upgrade so the
        // client can tell "expired token — refresh and retry" from a network
        // failure, which a bare 401 on the handshake doesn't let a browser see.
        if ('error' in auth) { ws.close(auth.code, auth.error); return }
        onConnection(ws, auth.room, auth.role, auth.actor)
      })
    }).catch((err) => {
      logger.error({ err }, '[signaling] auth failed')
      socket.destroy()
    })
  })

  // Dead-peer detection: a phone that lost signal never sends a close frame.
  const interval = setInterval(() => {
    for (const room of rooms.values()) {
      for (const peer of [room.agent, room.visitor]) {
        if (!peer) continue
        if (!peer.alive) { peer.ws.terminate(); continue }
        peer.alive = false
        try { peer.ws.ping() } catch { /* terminated on next tick */ }
      }
    }
  }, 30_000)

  return {
    close: async () => {
      clearInterval(interval)
      for (const room of rooms.values()) if (room.call) await finish(room, 'connection-lost')
      wss.close()
    },
    stats: () => ({ rooms: rooms.size, liveCalls: [...rooms.values()].filter(r => r.call).length }),
  }
}
