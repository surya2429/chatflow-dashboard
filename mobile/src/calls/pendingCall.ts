import { secureStorage } from '@/lib/secureStorage'

/**
 * The call a push just rang for. Written by the push handlers (possibly in a
 * headless JS context on Android, or before the UI mounts on iOS) and read by
 * CallManager when the agent answers — so an answer from the lock screen
 * knows which conversation's room to join. Persisted because on Android the
 * headless task and the app UI are not guaranteed to share memory.
 */
export interface IncomingCallInfo {
  callId: string
  conversationId: string
  callerName: string
  video: boolean
  receivedAt?: number
}

const KEY = 'chatflow.pendingCall'
const MAX_AGE_MS = 60_000
let memory: IncomingCallInfo | null = null

export async function rememberIncoming(info: IncomingCallInfo) {
  memory = { ...info, receivedAt: Date.now() }
  await secureStorage.set(KEY, JSON.stringify(memory))
}

export async function takePending(callId?: string): Promise<IncomingCallInfo | null> {
  let info = memory
  if (!info) {
    const raw = await secureStorage.get(KEY)
    try { info = raw ? (JSON.parse(raw) as IncomingCallInfo) : null } catch { info = null }
  }
  if (!info || (callId && info.callId !== callId) || Date.now() - (info.receivedAt ?? 0) > MAX_AGE_MS) return null
  return info
}

export async function clearPending(callId?: string) {
  if (callId && memory && memory.callId !== callId) return
  memory = null
  await secureStorage.remove(KEY)
}
