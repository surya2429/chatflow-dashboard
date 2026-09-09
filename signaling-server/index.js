// Minimal WebSocket signaling relay for Website Chat voice/video calls.
//
// This is a local-dev-only demo relay: no auth, no persistence, no TURN.
// It exists purely so two browser tabs (the agent dashboard and the
// standalone visitor call-tester page) can exchange WebRTC offers/answers/
// ICE candidates and simple call-control messages in real time.
//
// Connect: ws://localhost:8788?room=<visitorId>&role=agent|visitor
//
// Each room holds at most one "agent" socket and one "visitor" socket.
// Any JSON message received from one peer is relayed verbatim to the other
// peer in the same room. The server does not inspect message contents beyond
// what's needed to relay + announce presence.

import { WebSocketServer } from 'ws'

const PORT = 8788

// rooms: Map<roomId, { agent: WebSocket|null, visitor: WebSocket|null }>
const rooms = new Map()

function getRoom(roomId) {
  let room = rooms.get(roomId)
  if (!room) {
    room = { agent: null, visitor: null }
    rooms.set(roomId, room)
  }
  return room
}

function otherRole(role) {
  return role === 'agent' ? 'visitor' : 'agent'
}

function send(ws, payload) {
  if (ws && ws.readyState === ws.OPEN) {
    ws.send(JSON.stringify(payload))
  }
}

function cleanupRoomIfEmpty(roomId, room) {
  if (!room.agent && !room.visitor) rooms.delete(roomId)
}

const wss = new WebSocketServer({ port: PORT })

wss.on('connection', (ws, req) => {
  const url = new URL(req.url, `http://localhost:${PORT}`)
  const roomId = url.searchParams.get('room')
  const role = url.searchParams.get('role')

  if (!roomId || (role !== 'agent' && role !== 'visitor')) {
    ws.close(1008, 'room and role=agent|visitor query params are required')
    return
  }

  const room = getRoom(roomId)

  // Only one socket per role per room — a fresh connection replaces the old one.
  if (room[role]) {
    try { room[role].close(1000, 'replaced by a new connection') } catch {}
  }
  room[role] = ws

  console.log(`[signaling] ${role} joined room "${roomId}"`)

  // Tell the newly-connected peer whether the other side is already present,
  // and tell the other side (if present) that this peer just joined.
  const other = room[otherRole(role)]
  send(ws, { type: 'peer-joined', present: !!other })
  send(other, { type: 'peer-joined', present: true })

  ws.on('message', raw => {
    let msg
    try {
      msg = JSON.parse(raw.toString())
    } catch {
      return // ignore malformed messages — dumb relay, not a validator
    }
    // Relay verbatim to whichever peer occupies the other role in this room.
    send(room[otherRole(role)], msg)
  })

  ws.on('close', () => {
    console.log(`[signaling] ${role} left room "${roomId}"`)
    if (room[role] === ws) room[role] = null
    send(room[otherRole(role)], { type: 'peer-left' })
    cleanupRoomIfEmpty(roomId, room)
  })

  ws.on('error', () => {
    // 'close' still fires after 'error' — nothing extra to do here.
  })
})

console.log(`[signaling] Website Chat signaling relay listening on ws://localhost:${PORT}`)
