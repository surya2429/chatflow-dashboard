import { DUMMY_HASH_PROMISE, hashPassword, needsRehash, verifyPassword } from '../auth/password.js'
import { signAccessToken } from '../auth/tokens.js'
import { capabilitiesOf, type Role } from '../auth/policy.js'
import { refreshTokenRepository } from '../db/repositories/refreshTokenRepository.js'
import { userRepository, toUserDto, type UserRow } from '../db/repositories/userRepository.js'
import { deviceRepository } from '../db/repositories/deviceRepository.js'
import { HttpError, conflict, notFound, unauthorized } from '../http/errors.js'
import { setPresence } from './routingService.js'

export interface Session {
  user: ReturnType<typeof toUserDto>
  capabilities: string[]
  accessToken: string
  accessTokenExpiresAt: string
  refreshToken: string
}

async function sessionFor(user: UserRow, refreshToken: string): Promise<Session> {
  const { token, expiresAt } = await signAccessToken({ sub: user.id, role: user.role, name: user.name })
  return {
    user: toUserDto(user),
    capabilities: capabilitiesOf(user.role),
    accessToken: token,
    accessTokenExpiresAt: expiresAt.toISOString(),
    refreshToken,
  }
}

// ── Login throttling ────────────────────────────────────────────────────────
// Per email+IP, in memory. Enough to stop a script guessing one account's
// password from one address; a multi-instance deployment should put a shared
// limiter (or the load balancer's) in front as well.
const FAIL_LIMIT = 8
const FAIL_WINDOW_MS = 15 * 60_000
const failures = new Map<string, { count: number; first: number }>()

function throttleKey(email: string, ip: string) { return `${email.toLowerCase()}|${ip}` }
function checkThrottle(key: string) {
  const f = failures.get(key)
  if (f && Date.now() - f.first < FAIL_WINDOW_MS && f.count >= FAIL_LIMIT) {
    throw new HttpError(429, 'too_many_attempts', 'Too many failed sign-in attempts. Try again in a few minutes.')
  }
}
function recordFailure(key: string) {
  const f = failures.get(key)
  if (!f || Date.now() - f.first >= FAIL_WINDOW_MS) failures.set(key, { count: 1, first: Date.now() })
  else f.count++
}

export async function login(input: { email: string; password: string; deviceId?: string; userAgent?: string; ip: string }): Promise<Session> {
  const key = throttleKey(input.email, input.ip)
  checkThrottle(key)
  const user = await userRepository.findByEmail(input.email)
  // Verify against a dummy hash when there's no such user, so response time
  // doesn't reveal which emails have accounts.
  const ok = await verifyPassword(input.password, user?.password_hash ?? (await DUMMY_HASH_PROMISE))
  if (!user || !ok || !user.is_active) {
    recordFailure(key)
    throw unauthorized('invalid_credentials', 'Invalid email or password.')
  }
  failures.delete(key)
  if (needsRehash(user.password_hash)) await userRepository.setPasswordHash(user.id, await hashPassword(input.password))
  const refresh = await refreshTokenRepository.issue(user.id, input.deviceId ?? null, input.userAgent ?? null)
  return sessionFor(user, refresh)
}

export async function refresh(refreshToken: string): Promise<Session> {
  const result = await refreshTokenRepository.rotate(refreshToken)
  if (!result.ok) {
    // One code for every failure; the app's response is the same (sign out),
    // and the distinction is only useful to someone probing tokens.
    throw unauthorized('invalid_refresh_token')
  }
  const user = await userRepository.findById(result.userId)
  if (!user || !user.is_active) throw unauthorized('invalid_refresh_token')
  return sessionFor(user, result.refreshToken)
}

/**
 * Ends this device's session: revokes its refresh-token family and removes
 * its push registration, so the phone stops getting this user's chats the
 * moment they sign out. If that was their last signed-in device they go
 * offline — a logged-out agent must not be picked for routing.
 */
export async function logout(refreshToken: string): Promise<void> {
  const owner = await refreshTokenRepository.revokeFamilyOf(refreshToken)
  if (!owner) return
  if (owner.deviceId) await deviceRepository.removeForUserDevice(owner.userId, owner.deviceId)
  if ((await refreshTokenRepository.countActiveSessions(owner.userId)) === 0) {
    const user = await userRepository.findById(owner.userId)
    if (user) await setPresence({ id: user.id, role: user.role, name: user.name }, 'offline')
  }
}

export async function me(userId: string) {
  const user = await userRepository.findById(userId)
  if (!user || !user.is_active) throw unauthorized('invalid_token')
  return { user: toUserDto(user), capabilities: capabilitiesOf(user.role) }
}

// ── Admin user management ───────────────────────────────────────────────────

function initialsOf(name: string) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map(p => p[0]!.toUpperCase()).join('')
}

export async function createUser(input: { email: string; password: string; name: string; role: Role; color?: string }) {
  if (await userRepository.findByEmail(input.email)) throw conflict('email_taken')
  const user = await userRepository.create({
    email: input.email, passwordHash: await hashPassword(input.password), name: input.name,
    initials: initialsOf(input.name), color: input.color ?? '#0066ff', role: input.role,
  })
  return toUserDto(user)
}

/**
 * Deactivating someone must take effect now, not when their access token
 * happens to expire: all sessions and push registrations go, and they drop
 * offline so nothing more is routed to them. A role change revokes sessions
 * too, so the new role is in force from their next token.
 */
export async function updateUser(id: string, patch: { name?: string; role?: Role; isActive?: boolean; maxConcurrent?: number }) {
  const before = await userRepository.findById(id)
  if (!before) throw notFound('user_not_found')
  const user = await userRepository.update(id, {
    ...(patch.name !== undefined && { name: patch.name }),
    ...(patch.role !== undefined && { role: patch.role }),
    ...(patch.isActive !== undefined && { is_active: patch.isActive }),
    ...(patch.maxConcurrent !== undefined && { max_concurrent: patch.maxConcurrent }),
  })
  if (!user) throw notFound('user_not_found')
  if (patch.isActive === false || (patch.role && patch.role !== before.role)) {
    await refreshTokenRepository.revokeAllForUser(id, 'admin')
  }
  if (patch.isActive === false) {
    await deviceRepository.removeAllForUser(id)
    await setPresence({ id, role: user.role, name: user.name }, 'offline')
  }
  return toUserDto(user)
}
