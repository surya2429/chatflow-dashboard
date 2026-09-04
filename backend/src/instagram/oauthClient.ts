import { env } from '../config/env.js'
import { logger } from '../config/logger.js'
import type { ShortLivedTokenResponse, LongLivedTokenResponse, InstagramProfile } from './types.js'

/**
 * Instagram API with Instagram Login ("Business Login") OAuth flow.
 * https://developers.facebook.com/docs/instagram-platform/instagram-api-with-instagram-login/business-login
 *
 * The authorize URL itself needs no secret (built client-side, see
 * src/utils/instagramOAuth.js in the frontend) — everything here is the
 * secret-holding half: redeeming the one-time `code` for tokens.
 */

class InstagramOAuthError extends Error {
  constructor(message: string, public readonly cause?: unknown) {
    super(message)
    this.name = 'InstagramOAuthError'
  }
}

async function parseOrThrow<T>(res: Response, step: string): Promise<T> {
  const body = await res.text()
  let json: unknown
  try {
    json = JSON.parse(body)
  } catch {
    throw new InstagramOAuthError(`${step}: non-JSON response (${res.status})`, body.slice(0, 500))
  }
  if (!res.ok) {
    throw new InstagramOAuthError(`${step} failed (${res.status})`, json)
  }
  return json as T
}

/**
 * Step 1 — redeem the authorization `code` for a short-lived (~1h) access
 * token. Single-use; must be called within ~1h of the redirect.
 */
export async function exchangeCodeForToken(code: string): Promise<ShortLivedTokenResponse> {
  const body = new URLSearchParams({
    client_id: env.IG_APP_ID,
    client_secret: env.IG_APP_SECRET,
    grant_type: 'authorization_code',
    redirect_uri: env.IG_REDIRECT_URI,
    code,
  })

  const res = await fetch('https://api.instagram.com/oauth/access_token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  })
  return parseOrThrow<ShortLivedTokenResponse>(res, 'exchangeCodeForToken')
}

/**
 * Step 2 — trade the short-lived token for a long-lived one (60-day
 * validity, refreshable). Do this immediately after step 1.
 */
export async function exchangeForLongLivedToken(shortLivedToken: string): Promise<LongLivedTokenResponse> {
  const params = new URLSearchParams({
    grant_type: 'ig_exchange_token',
    client_secret: env.IG_APP_SECRET,
    access_token: shortLivedToken,
  })

  const res = await fetch(`https://graph.instagram.com/access_token?${params.toString()}`)
  return parseOrThrow<LongLivedTokenResponse>(res, 'exchangeForLongLivedToken')
}

/**
 * Refreshes a long-lived token before it expires. Meta requires the token to
 * already be at least 24h old; call this on a schedule well before the
 * 60-day expiry (e.g. daily, skipping tokens under ~50 days old).
 */
export async function refreshLongLivedToken(longLivedToken: string): Promise<LongLivedTokenResponse> {
  const params = new URLSearchParams({
    grant_type: 'ig_refresh_token',
    access_token: longLivedToken,
  })

  const res = await fetch(`https://graph.instagram.com/refresh_access_token?${params.toString()}`)
  return parseOrThrow<LongLivedTokenResponse>(res, 'refreshLongLivedToken')
}

/** Fetches the connected account's Instagram-scoped user id + username. */
export async function fetchInstagramProfile(accessToken: string): Promise<InstagramProfile> {
  const params = new URLSearchParams({ fields: 'user_id,username', access_token: accessToken })
  const res = await fetch(`https://graph.instagram.com/me?${params.toString()}`)
  return parseOrThrow<InstagramProfile>(res, 'fetchInstagramProfile')
}

/**
 * Full authorize-code → stored-account pipeline. Called from the
 * /instagram/oauth/callback route with the `code` the frontend forwards.
 */
export async function completeInstagramOAuth(code: string) {
  const shortLived = await exchangeCodeForToken(code)
  const longLived = await exchangeForLongLivedToken(shortLived.access_token)
  const profile = await fetchInstagramProfile(longLived.access_token)

  logger.info({ igUserId: profile.user_id, username: profile.username }, 'Instagram account authorized')

  return {
    igUserId: profile.user_id,
    username: profile.username,
    accessToken: longLived.access_token,
    expiresInSeconds: longLived.expires_in,
    scopes: shortLived.permissions ? shortLived.permissions.split(',') : [],
  }
}
