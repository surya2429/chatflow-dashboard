/**
 * Live widget config — the reason a merchant never re-pastes the install
 * snippet to pick up a change.
 *
 * The snippet only ever carried the bot id. Everything else — colours, flow,
 * behaviour, which tabs exist — is fetched at runtime against that id and then
 * kept current over a live stream, so an edit in the dashboard reaches widgets
 * already running on visitors' screens without a reload, a redeploy, or a
 * cache to wait out.
 *
 * This replaces reading config from localStorage, which could never have
 * worked for a real install: an embedded widget runs in the VISITOR's browser,
 * where the merchant's localStorage does not exist. It was only ever working
 * in this repo because the dashboard and the embed happened to share an origin
 * during local development.
 *
 * Transport is EventSource (SSE). It reconnects on its own with backoff, which
 * matters more than it sounds: widgets sit on laptops that sleep, phones that
 * change network, and offices behind proxies that cut idle connections.
 */
import { useEffect, useState } from 'react'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api'

export async function fetchConfig(botId) {
  const res = await fetch(`${API_BASE_URL}/bots/${encodeURIComponent(botId)}/config`)
  if (!res.ok) throw new Error(`config fetch failed (${res.status})`)
  return res.json() // { botNumber, version, config }
}

/**
 * Saves the keys that changed. A merge, so two people editing different
 * sections of the builder don't overwrite each other's work wholesale.
 */
export async function saveConfig(botId, patch) {
  const res = await fetch(`${API_BASE_URL}/bots/${encodeURIComponent(botId)}/config`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(patch),
  })
  if (!res.ok) throw new Error(`config save failed (${res.status})`)
  return res.json()
}

/**
 * Holds a stream open and calls `onConfig(config, version)` on every change.
 * Returns an unsubscribe function.
 *
 * Versions are checked here rather than trusted: a reconnect replays from
 * Last-Event-ID and can redeliver something already applied, and nothing
 * guarantees two events arrive in the order they were published. Ignoring
 * anything not strictly newer makes the stream idempotent, so a widget can
 * never be rolled backwards onto older config.
 */
export function subscribeConfig(botId, onConfig) {
  let source = null
  let lastVersion = -1
  let closed = false

  function open() {
    if (closed) return
    source = new EventSource(`${API_BASE_URL}/bots/${encodeURIComponent(botId)}/events`)
    source.addEventListener('config', (e) => {
      let payload
      try { payload = JSON.parse(e.data) } catch { return }
      if (typeof payload?.version !== 'number' || payload.version <= lastVersion) return
      lastVersion = payload.version
      onConfig(payload.config || {}, payload.version)
    })
    // EventSource retries by itself; this only logs so a silently dead stream
    // is diagnosable rather than invisible.
    source.onerror = () => {
      if (closed) return
      // readyState CLOSED means it gave up (e.g. 404) — don't spin on it.
      if (source?.readyState === EventSource.CLOSED) {
        source.close()
        source = null
      }
    }
  }

  open()

  return () => {
    closed = true
    source?.close()
    source = null
  }
}

/**
 * The widget's view of its own config: initial load, then live updates.
 *
 * `defaults` are merged under whatever the server sends, so a config saved
 * before a new setting existed doesn't render that setting as undefined —
 * the same forward-compatibility problem that made the branding strip vanish
 * once before.
 */
export function useLiveConfig(botId, defaults) {
  const [cfg, setCfg] = useState(defaults)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    if (!botId) return undefined
    let cancelled = false

    fetchConfig(botId)
      .then(({ config }) => {
        if (cancelled) return
        setCfg({ ...defaults, ...(config || {}) })
        setLoaded(true)
      })
      .catch(() => { if (!cancelled) setLoaded(true) })

    const unsubscribe = subscribeConfig(botId, (config) => {
      if (cancelled) return
      setCfg({ ...defaults, ...(config || {}) })
      setLoaded(true)
    })

    return () => { cancelled = true; unsubscribe() }
    // `defaults` is a module-level constant at every call site; including it
    // would re-open the stream on each render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [botId])

  return { cfg, loaded }
}
