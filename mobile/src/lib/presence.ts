import { AppState } from 'react-native'
import { api } from './api'
import { currentUser, updateUser } from './session'
import type { Presence } from './types'

/**
 * Presence is the server's, not the app's: it decides who gets auto-assigned
 * chats and who gets woken by pushes. The app sets it and keeps it honest:
 *
 *   - A heartbeat every minute while in the foreground. If it stops (phone
 *     died, app killed), the server demotes an "online" agent to "away" after
 *     a while, so new chats stop being routed to a phone nobody is holding.
 *   - Coming back to the foreground sends a heartbeat immediately.
 *
 * Backgrounding the app does NOT change presence: an online agent with the
 * app in their pocket should still get chats — that's what push is for.
 */
const HEARTBEAT_MS = 60_000
let timer: ReturnType<typeof setInterval> | null = null
let sub: { remove(): void } | null = null

function beat() {
  if (currentUser()?.presence === 'online') void api.heartbeat().catch(() => {})
}

export function startPresence() {
  stopPresence()
  beat()
  timer = setInterval(beat, HEARTBEAT_MS)
  sub = AppState.addEventListener('change', (s) => { if (s === 'active') beat() })
}

export function stopPresence() {
  if (timer) clearInterval(timer)
  timer = null
  sub?.remove()
  sub = null
}

export async function setPresence(presence: Presence): Promise<number> {
  const previous = currentUser()?.presence
  updateUser({ presence }) // optimistic
  try {
    const res = await api.setPresence(presence)
    if (res.user) updateUser({ presence: res.user.presence })
    return res.routed
  } catch (err) {
    if (previous) updateUser({ presence: previous })
    throw err
  }
}
