import { createHmac, timingSafeEqual } from 'node:crypto'
import { env } from '../config/env.js'

/**
 * Verifies Meta's `X-Hub-Signature-256` header: `sha256=<hex hmac>` of the
 * raw request body, keyed with the app secret. Must run against the exact
 * raw bytes Meta sent — NOT a re-serialized JSON.parse(body) — since any
 * whitespace/key-order difference would produce a different HMAC. See
 * `app.ts` for how the raw body is captured before JSON parsing.
 */
export function verifyWebhookSignature(rawBody: Buffer, signatureHeader: string | undefined): boolean {
  if (!signatureHeader?.startsWith('sha256=')) return false

  const expectedHex = signatureHeader.slice('sha256='.length)
  const computedHex = createHmac('sha256', env.WA_APP_SECRET).update(rawBody).digest('hex')

  const expected = Buffer.from(expectedHex, 'hex')
  const computed = Buffer.from(computedHex, 'hex')

  // Constant-time comparison — a naive `===` leaks timing information an
  // attacker could use to forge a valid signature byte-by-byte.
  if (expected.length !== computed.length) return false
  return timingSafeEqual(expected, computed)
}
