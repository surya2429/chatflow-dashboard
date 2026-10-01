import { API_URL } from './config'
import { secureStorage } from './secureStorage'
import type { Session, User } from './types'

/**
 * Token lifecycle, outside React so the API client, live stream, signaling
 * and background push handlers all share one source of truth.
 *
 *   access token  — memory only, short-lived; refreshed on demand.
 *   refresh token — Keychain/Keystore; rotated on every refresh (the server
 *                   treats a reused one as theft and revokes the session).
 *
 * Refresh is single-flight: however many requests hit a 401 at once, exactly
 * one refresh call goes out and they all wait on it. Two parallel refreshes
 * with the same token would otherwise race the rotation.
 */
const REFRESH_KEY = 'chatflow.refreshToken'
const USER_KEY = 'chatflow.user'

let accessToken: string | null = null
let accessExpiresAt = 0
let user: User | null = null
let capabilities: string[] = []
let inflight: Promise<string | null> | null = null
const listeners = new Set<(user: User | null) => void>()

function emit() { for (const l of listeners) l(user) }

export function onSessionChange(fn: (user: User | null) => void): () => void {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

export function currentUser() { return user }
export function currentCapabilities() { return capabilities }
export function can(capability: string) { return capabilities.includes(capability) }

export async function adopt(s: Session): Promise<void> {
  accessToken = s.accessToken
  accessExpiresAt = new Date(s.accessTokenExpiresAt).getTime()
  user = s.user
  capabilities = s.capabilities
  await secureStorage.set(REFRESH_KEY, s.refreshToken)
  await secureStorage.set(USER_KEY, JSON.stringify({ user: s.user, capabilities: s.capabilities }))
  emit()
}

export function updateUser(patch: Partial<User>) {
  if (!user) return
  user = { ...user, ...patch }
  void secureStorage.set(USER_KEY, JSON.stringify({ user, capabilities }))
  emit()
}

async function clearLocal() {
  accessToken = null
  accessExpiresAt = 0
  user = null
  capabilities = []
  await secureStorage.remove(REFRESH_KEY)
  await secureStorage.remove(USER_KEY)
  emit()
}

/**
 * Restores a session on app start. The cached user lets the inbox render
 * immediately (offline too); the refresh then confirms the session is still
 * valid and gets a fresh access token.
 */
export async function restore(): Promise<User | null> {
  const cached = await secureStorage.get(USER_KEY)
  const refresh = await secureStorage.get(REFRESH_KEY)
  if (!refresh) return null
  if (cached) {
    try {
      const parsed = JSON.parse(cached) as { user: User; capabilities: string[] }
      user = parsed.user
      capabilities = parsed.capabilities
    } catch { /* ignore a corrupt cache */ }
  }
  const token = await refreshAccessToken()
  return token ? user : null
}

/** Returns null (and signs out) only when the server rejects the refresh token. */
export function refreshAccessToken(): Promise<string | null> {
  inflight ??= (async () => {
    try {
      const refreshToken = await secureStorage.get(REFRESH_KEY)
      if (!refreshToken) return null
      let res: Response
      try {
        res = await fetch(`${API_URL}/api/auth/refresh`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ refreshToken }),
        })
      } catch {
        // Offline: keep the session; the next request retries.
        throw new NetworkError()
      }
      if (res.status === 401) {
        await clearLocal()
        return null
      }
      if (!res.ok) throw new NetworkError()
      const s = (await res.json()) as Session
      await adopt(s)
      return s.accessToken
    } finally {
      inflight = null
    }
  })()
  return inflight
}

/** A usable access token, refreshing first if it's about to expire. */
export async function getAccessToken(): Promise<string | null> {
  if (accessToken && accessExpiresAt - Date.now() > 30_000) return accessToken
  if (!(await secureStorage.get(REFRESH_KEY))) return null
  try {
    return await refreshAccessToken()
  } catch {
    return accessToken // offline — let the request try and fail on its own
  }
}

export async function signOut(): Promise<void> {
  const refreshToken = await secureStorage.get(REFRESH_KEY)
  // Server-side logout also unregisters this device's push token and, if it
  // was the last device, marks the agent offline. Best effort: signing out
  // locally must work with no network.
  if (refreshToken) {
    await fetch(`${API_URL}/api/auth/logout`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    }).catch(() => {})
  }
  await clearLocal()
}

export class NetworkError extends Error {
  constructor() { super('network_error') }
}
