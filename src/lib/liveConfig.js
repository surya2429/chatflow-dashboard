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
import { useEffect, useRef, useState } from 'react'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api'

/**
 * A bot's config has exactly two halves, and they belong to the same bot:
 *
 *   appearance — how it looks   (Widget Builder / Appearance)
 *   flows      — what it does   (Automation / Flow Builder)
 *
 * They are separate TOP-LEVEL keys so each section can save without touching
 * the other: the server merges with jsonb `||`, which is shallow, so a write
 * of { appearance } replaces appearance wholesale and leaves flows untouched.
 * Nesting them any deeper would make one section's save clobber the other's.
 */
export const SECTION_APPEARANCE = 'appearance'
export const SECTION_FLOWS = 'flows'

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

/** A bot id that hasn't resolved yet — nothing should be saved against it. */
function usable(botId) {
  return Boolean(botId) && botId !== 'YOUR_BOT_ID'
}

/**
 * What the server is believed to hold, per bot+section, as a serialized string.
 *
 * This is the guard against echo-writes, and it has to be module-level rather
 * than a ref inside the publish hook: the value is written by the LOAD hook and
 * read by the PUBLISH hook, which are separate hooks in separate components.
 *
 * Without it, every mount produced a redundant write — load resolves, state
 * updates, the publish effect sees a changed value and saves back exactly what
 * it just read. That bumps config_version and pushes a no-op change to every
 * connected widget, which is precisely what the versioning exists to avoid.
 * Observed as four writes per page load before this existed.
 */
const serverState = new Map()
const stateKey = (botId, sectionKey) => `${botId}:${sectionKey}`

/**
 * Publishes one top-level section whenever it actually changes, debounced.
 *
 * Shared by both builder sections because the subtleties are identical and
 * easy to get wrong separately:
 *
 *   - Debounced, because both builders fire on every keystroke and every
 *     colour-slider drag. Undebounced, dragging a hue would be hundreds of
 *     writes and hundreds of pushes to every live widget.
 *   - Compared against what the server already holds, so re-saving an unchanged
 *     value is skipped entirely. This subsumes the "skip the first run" trick,
 *     which only ever covered the mount case and missed the echo that follows
 *     an async load.
 *   - Failures are swallowed. The local draft is intact and the next edit
 *     retries; losing one colour tweak does not justify a modal.
 */
export function usePublishSection(botId, sectionKey, value) {
  const latest = useRef(value)
  latest.current = value

  useEffect(() => {
    if (!usable(botId)) return undefined
    const key = stateKey(botId, sectionKey)
    const t = setTimeout(() => {
      let serialized
      try { serialized = JSON.stringify(latest.current) } catch { return }
      if (serverState.get(key) === serialized) return
      serverState.set(key, serialized)
      saveConfig(botId, { [sectionKey]: latest.current }).catch(() => {
        // Let the next edit retry by forgetting what we thought we sent.
        serverState.delete(key)
      })
    }, 400)
    return () => clearTimeout(t)
  }, [value, botId, sectionKey])
}

/**
 * Loads one section once the bot id is known. `onLoad` is called only when the
 * server actually holds something, so a bot with nothing saved keeps whatever
 * defaults the caller started with rather than being blanked.
 */
export function useLoadSection(botId, sectionKey, onLoad) {
  const cb = useRef(onLoad)
  cb.current = onLoad

  useEffect(() => {
    if (!usable(botId)) return undefined
    let cancelled = false
    fetchConfig(botId)
      .then(({ config }) => {
        const section = config?.[sectionKey]
        if (cancelled || section == null) return
        if (Array.isArray(section) ? section.length : Object.keys(section).length) {
          // Record it BEFORE handing it over, so the state update this causes
          // doesn't read as a local edit and get written straight back.
          try { serverState.set(stateKey(botId, sectionKey), JSON.stringify(section)) } catch {}
          cb.current(section)
        }
      })
      .catch(() => { /* nothing saved yet, or API down — defaults stand */ })
    return () => { cancelled = true }
  }, [botId, sectionKey])
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
