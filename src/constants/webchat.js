// Misc Web Chat constants shared across pages (Installation, Analytics,
// Appearance, the embed) that would otherwise need a page-to-page import.
import { useSyncExternalStore } from 'react'
import { apiGet } from '../utils/api'

/**
 * The bot id is ASSIGNED BY THE DATABASE, never generated here.
 *
 * It comes from one platform-wide sequence (see
 * backend/migrations/003_clients_and_bots.sql), so numbering runs across every
 * client rather than restarting per account:
 *
 *   client 1 → bot 1 · client 2 → bot 2 · client 1 → bot 3 · client 3 → bot 4
 *
 * which is why the frontend cannot invent one. A browser tab has no idea what
 * the last issued number was, and two tabs guessing concurrently would both
 * guess the same thing. Whatever the API returns is the id; this module only
 * caches and distributes it.
 */

/* Shown until the API answers. Deliberately the universal fill-this-in token
   rather than a dash or a plausible number: if a merchant copies the snippet
   before the id resolves, `?id=YOUR_BOT_ID` fails loudly and obviously,
   whereas `?id=48217` would look installed and silently resolve to nothing —
   or, worse, to somebody else's bot. */
const PLACEHOLDER = 'YOUR_BOT_ID'

let botId = PLACEHOLDER
let loaded = false
let inFlight = null
const listeners = new Set()

function setBotId(next) {
  if (next === botId) return
  botId = String(next)
  loaded = true
  listeners.forEach((fn) => fn())
}

/** Current value — the placeholder until the API has answered. */
export function getBotId() {
  return botId
}

export function isBotIdLoaded() {
  return loaded
}

/**
 * Fetches this workspace's bot once per page load. Safe to call from several
 * places: concurrent callers share the one in-flight request.
 *
 * On failure the id stays the placeholder rather than falling back to a made-up
 * number. An install snippet carrying a plausible-looking but wrong id is the
 * worst outcome available here — the merchant pastes it into their site, the
 * widget resolves to nothing or to someone else's bot, and nothing about it
 * looks broken until a customer complains.
 */
export function loadBotId() {
  if (loaded) return Promise.resolve(botId)
  if (inFlight) return inFlight
  inFlight = apiGet('/bots/current')
    .then((data) => {
      if (data?.botNumber != null) setBotId(data.botNumber)
      return botId
    })
    .catch(() => botId)
    .finally(() => { inFlight = null })
  return inFlight
}

function subscribe(fn) {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

/**
 * Re-renders the caller when the id arrives. Components read the id through
 * this rather than importing a constant, because at first paint there is
 * genuinely no id yet.
 */
export function useBotId() {
  return useSyncExternalStore(subscribe, getBotId, getBotId)
}
