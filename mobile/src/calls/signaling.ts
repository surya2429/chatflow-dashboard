import { SIGNAL_URL } from '@/lib/config'
import { getAccessToken, refreshAccessToken } from '@/lib/session'

/**
 * One call's signaling connection. Same protocol as the dashboard's
 * useCallSignaling (call-request / call-accept / call-decline / offer /
 * answer / ice-candidate / hangup, plus server peer-joined / peer-left), now
 * authenticated: the access token rides in the query string because the
 * WebSocket API can't set headers on the handshake.
 *
 * agent-api reports auth problems as close codes: 4401 means the token was
 * expired or invalid (refresh once and retry), 4403 not allowed on this
 * conversation, 4409 someone else already took the call.
 */
export type SignalMessage =
  | { type: 'call-request'; video?: boolean }
  | { type: 'call-accept' }
  | { type: 'call-decline' }
  | { type: 'offer'; sdp: string }
  | { type: 'answer'; sdp: string }
  | { type: 'ice-candidate'; candidate: unknown }
  | { type: 'hangup' }
  | { type: 'peer-joined'; present: boolean }
  | { type: 'peer-left' }

export interface SignalingHandlers {
  onMessage(msg: SignalMessage): void
  onClose(code: number, reason: string): void
}

export class Signaling {
  private ws: WebSocket | null = null
  private closedByUs = false
  private retried = false
  private queue: SignalMessage[] = []

  constructor(private room: string, private handlers: SignalingHandlers) {}

  async open(): Promise<void> {
    const token = await getAccessToken()
    if (!token || this.closedByUs) return
    const ws = new WebSocket(`${SIGNAL_URL}?room=${encodeURIComponent(this.room)}&role=agent&token=${encodeURIComponent(token)}`)
    this.ws = ws
    ws.onopen = () => {
      for (const m of this.queue.splice(0)) ws.send(JSON.stringify(m))
    }
    ws.onmessage = (e) => {
      try { this.handlers.onMessage(JSON.parse(String(e.data)) as SignalMessage) } catch { /* ignore malformed */ }
    }
    ws.onclose = (e) => {
      if (this.ws !== ws) return
      this.ws = null
      if (this.closedByUs) return
      if (e.code === 4401 && !this.retried) {
        this.retried = true
        void refreshAccessToken().catch(() => null).then((t) => { if (t) void this.open() })
        return
      }
      this.handlers.onClose(e.code, e.reason)
    }
  }

  send(msg: SignalMessage) {
    if (this.ws?.readyState === WebSocket.OPEN) this.ws.send(JSON.stringify(msg))
    else this.queue.push(msg)
  }

  close() {
    this.closedByUs = true
    const ws = this.ws
    this.ws = null
    if (ws && ws.readyState === WebSocket.OPEN) {
      // Flush a final hangup/decline before closing.
      for (const m of this.queue.splice(0)) ws.send(JSON.stringify(m))
    }
    ws?.close()
  }
}
