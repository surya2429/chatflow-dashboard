/**
 * What the app needs from a push to route the tap: a kind and the
 * conversation to deep-link into. Everything is a string because FCM data
 * payloads only carry strings.
 */
export type PushKind = 'message' | 'assignment' | 'waiting' | 'call' | 'call_cancelled'

export interface PushPayload {
  kind: PushKind
  title: string
  body: string
  conversationId: string
  channel?: string
  callId?: string
  video?: boolean
  callerName?: string
}

export interface PushResult {
  /** The provider rejected the token as permanently invalid — stop using it. */
  deadToken?: boolean
  ok: boolean
  error?: string
}

export interface PushProvider {
  readonly name: string
  readonly configured: boolean
  send(token: string, payload: PushPayload, opts: { voip?: boolean }): Promise<PushResult>
}

export function toDataStrings(p: PushPayload): Record<string, string> {
  const out: Record<string, string> = { kind: p.kind, conversationId: p.conversationId, title: p.title, body: p.body }
  if (p.channel) out.channel = p.channel
  if (p.callId) out.callId = p.callId
  if (p.video !== undefined) out.video = String(p.video)
  if (p.callerName) out.callerName = p.callerName
  return out
}
