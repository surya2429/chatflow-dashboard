import { AppState, type AppStateStatus } from 'react-native'
import EventSource from 'react-native-sse'
import { API_URL } from './config'
import { getAccessToken, refreshAccessToken } from './session'
import { store } from './store'
import type { LiveEvent } from './types'

/**
 * Foreground live updates over SSE (GET /api/events).
 *
 * Only while the app is in the foreground: a backgrounded iOS app has its
 * sockets torn down within seconds anyway, and push notifications are the
 * background channel. On return to the foreground the stream reopens with
 * Last-Event-ID, and the server replays exactly what was missed — or sends
 * `resync` if we've been away longer than its retention, and lists refetch.
 *
 * The token goes in the Authorization header (react-native-sse supports
 * headers), never the URL.
 */
const EVENT_TYPES: LiveEvent['kind'][] = [
  'conversation.updated', 'message.created', 'message.updated', 'presence.updated',
  'call.ringing', 'call.answered', 'call.ended',
]

type Listener = (ev: LiveEvent) => void
const extraListeners = new Set<Listener>()

/** For modules outside the store that react to events (calls, notifications). */
export function onLiveEvent(fn: Listener): () => void {
  extraListeners.add(fn)
  return () => extraListeners.delete(fn)
}

function apply(ev: LiveEvent) {
  switch (ev.kind) {
    case 'conversation.updated':
      store.upsertConversations([ev.conversation])
      break
    case 'message.created':
      store.upsertConversations([ev.conversation])
      store.upsertMessage(ev.message)
      break
    case 'message.updated':
      store.upsertMessage(ev.message)
      break
    case 'presence.updated':
      store.patchTeamMember(ev.user.id, { presence: ev.user.presence })
      break
    default:
      break
  }
  for (const l of extraListeners) l(ev)
}

let source: EventSource<string> | null = null
let lastEventId: string | null = null
let running = false
let attempt = 0
let retryTimer: ReturnType<typeof setTimeout> | null = null
let appStateSub: { remove(): void } | null = null

async function connect() {
  if (!running) return
  const token = await getAccessToken().catch(() => null)
  if (!running) return
  if (!token) { store.setConnection('offline'); return }
  store.setConnection('connecting')

  const es = new EventSource<string>(`${API_URL}/api/events`, {
    headers: { Authorization: `Bearer ${token}`, ...(lastEventId && { 'Last-Event-ID': lastEventId }) },
    // Failures reconnect through scheduleReconnect (fresh token, backoff).
    // A clean end-of-stream (server restart) is re-polled by the library
    // itself after the server's `retry:` interval, resuming from its own
    // tracked Last-Event-ID; if the token has expired by then, that attempt
    // 401s into the error path below.
    pollingInterval: 0,
  })
  source = es

  es.addEventListener('open', () => { attempt = 0; store.setConnection('live') })
  es.addEventListener('ready' as never, () => store.setConnection('live'))
  es.addEventListener('resync' as never, (e: { lastEventId: string | null }) => {
    if (e.lastEventId) lastEventId = e.lastEventId
    store.requestResync()
  })
  for (const type of EVENT_TYPES) {
    es.addEventListener(type as never, (e: { data: string | null; lastEventId: string | null }) => {
      if (e.lastEventId) lastEventId = e.lastEventId
      if (!e.data) return
      try { apply(JSON.parse(e.data) as LiveEvent) } catch { /* malformed frame — skip */ }
    })
  }
  es.addEventListener('error', (e) => {
    if (source !== es) return
    es.removeAllEventListeners()
    // react-native-sse schedules its own reconnect right AFTER dispatching
    // this event; closing on the next tick cancels that timer, so only our
    // reconnect (fresh token, backoff) happens.
    setTimeout(() => es.close(), 0)
    source = null
    store.setConnection('offline')
    if ('xhrStatus' in e && e.xhrStatus === 401) {
      // Expired token: refresh now rather than waiting out the backoff.
      void refreshAccessToken().catch(() => null).then((t) => { if (t) scheduleReconnect(0) })
      return
    }
    scheduleReconnect()
  })
}

function scheduleReconnect(delay?: number) {
  if (!running) return
  if (retryTimer) clearTimeout(retryTimer)
  // 1s, 2s, 4s … capped at 30s, with jitter so a fleet of phones coming back
  // after a server restart doesn't reconnect in lockstep.
  const ms = delay ?? Math.min(30_000, 1000 * 2 ** attempt++) * (0.75 + Math.random() * 0.5)
  retryTimer = setTimeout(() => { retryTimer = null; void connect() }, ms)
}

function disconnect() {
  if (retryTimer) { clearTimeout(retryTimer); retryTimer = null }
  if (source) { source.removeAllEventListeners(); source.close(); source = null }
}

export function startLive() {
  if (running) return
  running = true
  attempt = 0
  void connect()
  appStateSub = AppState.addEventListener('change', (s: AppStateStatus) => {
    if (s === 'active') { if (!source) { attempt = 0; void connect() } } else if (s === 'background') { disconnect(); store.setConnection('offline') }
  })
}

export function stopLive() {
  running = false
  disconnect()
  appStateSub?.remove()
  appStateSub = null
  lastEventId = null
}
