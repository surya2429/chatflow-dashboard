import { createHash, randomBytes } from 'node:crypto'
import { SignJWT, jwtVerify, errors as joseErrors } from 'jose'
import { env } from '../config/env.js'
import type { Role } from './policy.js'

/**
 * Access tokens: short-lived HS256 JWTs, verified statelessly on every
 * request. They carry the role so authorization needs no DB hit — which is
 * also why they're short: a demoted or deactivated user keeps their old role
 * for at most ACCESS_TOKEN_TTL_SECONDS, and deactivation additionally revokes
 * every refresh token so they can't mint a new one.
 *
 * Refresh tokens: opaque random strings, stored hashed, rotated on use (see
 * refreshTokenRepository). Not JWTs — they must be revocable, so they are
 * looked up anyway and a signature would add nothing.
 */
const secret = new TextEncoder().encode(env.JWT_ACCESS_SECRET)

export interface AccessClaims {
  sub: string        // user id
  role: Role
  name: string
  /** 'staff' for agents/supervisors/admins; 'visitor' for Website Chat call tokens. */
  typ: 'staff' | 'visitor'
  /** Visitor tokens only: the conversation they may signal into. */
  room?: string
}

export async function signAccessToken(claims: Omit<AccessClaims, 'typ'>): Promise<{ token: string; expiresAt: Date }> {
  const expiresAt = new Date(Date.now() + env.ACCESS_TOKEN_TTL_SECONDS * 1000)
  const token = await new SignJWT({ role: claims.role, name: claims.name, typ: 'staff' })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(claims.sub)
    .setIssuer(env.JWT_ISSUER)
    .setAudience('staff')
    .setIssuedAt()
    .setExpirationTime(Math.floor(expiresAt.getTime() / 1000))
    .sign(secret)
  return { token, expiresAt }
}

/**
 * A Website Chat visitor has no account, so there is nothing to log in with.
 * The widget backend (or the dev call tester) is issued this narrow token for
 * one conversation: it can open that conversation's signaling room as the
 * visitor, and nothing else.
 */
export async function signVisitorToken(visitorId: string, conversationId: string, ttlSeconds = 3600): Promise<string> {
  return new SignJWT({ typ: 'visitor', room: conversationId, name: 'Visitor' })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(visitorId)
    .setIssuer(env.JWT_ISSUER)
    .setAudience('visitor')
    .setIssuedAt()
    .setExpirationTime(`${ttlSeconds}s`)
    .sign(secret)
}

export type VerifyResult =
  | { ok: true; claims: AccessClaims }
  | { ok: false; reason: 'expired' | 'invalid' }

export async function verifyToken(token: string, audience: 'staff' | 'visitor' | ('staff' | 'visitor')[]): Promise<VerifyResult> {
  try {
    const { payload } = await jwtVerify(token, secret, { issuer: env.JWT_ISSUER, audience, algorithms: ['HS256'] })
    if (typeof payload.sub !== 'string') return { ok: false, reason: 'invalid' }
    return {
      ok: true,
      claims: {
        sub: payload.sub,
        role: payload.role as Role,
        name: String(payload.name ?? ''),
        typ: payload.typ === 'visitor' ? 'visitor' : 'staff',
        room: typeof payload.room === 'string' ? payload.room : undefined,
      },
    }
  } catch (err) {
    // The app treats 'expired' as "refresh and retry" and 'invalid' as
    // "log out" — conflating them would either loop or strand the user.
    return { ok: false, reason: err instanceof joseErrors.JWTExpired ? 'expired' : 'invalid' }
  }
}

export function newRefreshToken(): string {
  return randomBytes(32).toString('base64url')
}

export function hashRefreshToken(token: string): string {
  return createHash('sha256').update(token).digest('hex')
}
