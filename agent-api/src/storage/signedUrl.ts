import { createHmac, timingSafeEqual } from 'node:crypto'
import { env } from '../config/env.js'

/**
 * Signed, expiring links to attachments.
 *
 * An <Image> tag (in the app, the web widget, or Meta fetching media we send)
 * can't attach a bearer token, so the link itself is the credential: an HMAC
 * over the file id and an expiry. Expiries are rounded up to the hour, so the
 * same file keeps the same URL for an hour and image caches stay warm.
 */
const key = env.FILE_URL_SECRET ?? createHmac('sha256', env.JWT_ACCESS_SECRET).update('attachment-links').digest('hex')
const VALID_FOR_SECONDS = 24 * 3600

function signature(id: string, exp: number) {
  return createHmac('sha256', key).update(`${id}.${exp}`).digest('base64url')
}

/** Path (relative to the API origin) that serves the file until it expires. */
export function signedFilePath(id: string, fileName: string, now = Date.now()): string {
  const exp = Math.ceil(now / 3_600_000) * 3600 + VALID_FOR_SECONDS
  return `/api/files/${id}/${encodeURIComponent(fileName)}?exp=${exp}&sig=${signature(id, exp)}`
}

/** Absolute URL for third parties (Meta) — only when a public origin is configured. */
export function publicFileUrl(id: string, fileName: string): string | null {
  return env.PUBLIC_BASE_URL ? env.PUBLIC_BASE_URL.replace(/\/$/, '') + signedFilePath(id, fileName) : null
}

export function verifyFileSignature(id: string, exp: string | undefined, sig: string | undefined, now = Date.now()): boolean {
  if (!exp || !sig || !/^\d{1,12}$/.test(exp)) return false
  if (Number(exp) * 1000 < now) return false
  const expected = Buffer.from(signature(id, Number(exp)))
  const given = Buffer.from(sig)
  return expected.length === given.length && timingSafeEqual(expected, given)
}
