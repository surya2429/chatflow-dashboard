import { useCallback, useEffect, useRef, useState } from 'react'

const SIGNALING_URL = 'ws://localhost:8788'

/**
 * useCallSignaling — owns the WebSocket connection to the local signaling
 * relay (signaling-server/index.js) for one "room" (a webchat visitorId).
 *
 * Connects as ws://localhost:8788?room=<room>&role=<agent|visitor>.
 * The relay is a dumb pass-through: any JSON message sent from one peer in
 * a room is delivered verbatim to the other peer via onMessage, plus
 * synthetic { type:'peer-joined'|'peer-left' } presence notifications.
 *
 * Pass `room` as null/undefined to stay disconnected (e.g. no active
 * conversation selected yet).
 */
export function useCallSignaling(room, role) {
  const wsRef = useRef(null)
  const listenersRef = useRef(new Set())
  const [connected, setConnected] = useState(false)
  const [peerPresent, setPeerPresent] = useState(false)

  useEffect(() => {
    if (!room || !role) {
      setConnected(false)
      setPeerPresent(false)
      return
    }

    const ws = new WebSocket(`${SIGNALING_URL}?room=${encodeURIComponent(room)}&role=${role}`)
    wsRef.current = ws

    ws.onopen = () => setConnected(true)
    ws.onclose = () => { setConnected(false); setPeerPresent(false) }
    ws.onerror = () => { /* onclose still follows; nothing extra to do */ }
    ws.onmessage = evt => {
      let msg
      try { msg = JSON.parse(evt.data) } catch { return }
      if (msg.type === 'peer-joined') setPeerPresent(!!msg.present)
      if (msg.type === 'peer-left')   setPeerPresent(false)
      listenersRef.current.forEach(fn => fn(msg))
    }

    return () => {
      ws.close()
      wsRef.current = null
    }
  }, [room, role])

  const send = useCallback(message => {
    const ws = wsRef.current
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(message))
    } else {
      console.warn('[signaling] tried to send while disconnected:', message)
    }
  }, [])

  // Subscribe to incoming messages; returns an unsubscribe function.
  const onMessage = useCallback(fn => {
    listenersRef.current.add(fn)
    return () => listenersRef.current.delete(fn)
  }, [])

  return { connected, peerPresent, send, onMessage }
}
