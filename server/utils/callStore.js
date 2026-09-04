/**
 * In-memory call state store.
 *
 * Responsibilities:
 *  - Track active calls (id → state object)
 *  - Deduplicate webhook events by (callId + eventType + timestamp)
 *  - Record processed message IDs to prevent double-handling
 *
 * In production, swap the Maps for Redis with appropriate TTLs.
 */

// ── Active call registry ──────────────────────────────────────────────────────
// callId → { id, direction, status, from, to, startedAt, sdp, biz_opaque_callback_data }
const activeCalls = new Map()

// ── Dedup store ───────────────────────────────────────────────────────────────
// key = `${callId}:${event}:${timestamp}` → true
// TTL: auto-evict entries older than 5 minutes
const dedupSet  = new Map()
const DEDUP_TTL = 5 * 60 * 1000 // 5 min

// ── Processed message IDs (permission replies, etc.) ─────────────────────────
const processedMessages = new Set()

// Clean up expired dedup entries every minute
setInterval(() => {
  const now = Date.now()
  for (const [key, ts] of dedupSet) {
    if (now - ts > DEDUP_TTL) dedupSet.delete(key)
  }
}, 60_000)

// ── API ───────────────────────────────────────────────────────────────────────
export const callStore = {
  // Deduplication
  isDuplicate(callId, event, timestamp) {
    const key = `${callId}:${event}:${timestamp}`
    if (dedupSet.has(key)) return true
    dedupSet.set(key, Date.now())
    return false
  },

  isMessageProcessed(msgId) {
    if (processedMessages.has(msgId)) return true
    processedMessages.add(msgId)
    return false
  },

  // Active call management
  upsert(callId, patch) {
    const existing = activeCalls.get(callId) || { id: callId }
    activeCalls.set(callId, { ...existing, ...patch })
    return activeCalls.get(callId)
  },

  get(callId) {
    return activeCalls.get(callId) || null
  },

  remove(callId) {
    return activeCalls.delete(callId)
  },

  getAll() {
    return [...activeCalls.values()]
  },

  count() {
    return activeCalls.size
  },
}
