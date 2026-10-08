// razorpay.ts — a small, dependency-free Razorpay REST client.
//
// Only what billing needs: Orders (one-time), Plans + Subscriptions (autopay),
// Payments (fetch / capture), Invoices. Uses fetch + HTTP Basic auth with the
// key id and SECRET, so this file must only ever run on a server.
import { createHmac, timingSafeEqual } from 'node:crypto'

export class RazorpayError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
  ) {
    super(message)
    this.name = 'RazorpayError'
  }
}

export interface RazorpayConfig {
  keyId: string
  keySecret: string
  baseUrl?: string
  fetchImpl?: typeof fetch
}

/* Loosely typed on purpose: Razorpay returns far more fields than we use, and
   typing them all would just be a second place to be wrong. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type RzEntity = Record<string, any>

export interface Razorpay {
  request<T = RzEntity>(method: 'GET' | 'POST' | 'PATCH' | 'DELETE', path: string, body?: unknown): Promise<T>
  /** True when `signature` is HMAC-SHA256(key secret, signedPayload). */
  verifySignature(signedPayload: string, signature: string): boolean
}

export function createRazorpay(cfg: RazorpayConfig): Razorpay {
  const base = cfg.baseUrl ?? 'https://api.razorpay.com/v1'
  const doFetch = cfg.fetchImpl ?? fetch
  const auth = 'Basic ' + Buffer.from(`${cfg.keyId}:${cfg.keySecret}`).toString('base64')

  async function request<T>(method: string, path: string, body?: unknown, attempt = 0): Promise<T> {
    const res = await doFetch(base + path, {
      method,
      headers: { Authorization: auth, 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    })

    // Test-mode accounts rate-limit aggressively; one polite retry is enough.
    if (res.status === 429 && attempt < 2) {
      const wait = Number(res.headers.get('retry-after')) || 2
      await new Promise((r) => setTimeout(r, wait * 1000))
      return request<T>(method, path, body, attempt + 1)
    }

    const text = await res.text()
    let json: RzEntity = {}
    try { json = text ? JSON.parse(text) : {} } catch { /* non-JSON error page */ }

    if (!res.ok) {
      const err = json.error
      // Razorpay normally sends { error: { code, description } }. A bare
      // { error: "Unauthorized" } on a Plans / Subscriptions call means the
      // Subscriptions product isn't switched on for this account yet.
      if (res.status === 401 && typeof err === 'string') {
        throw new RazorpayError(401, 'UNAUTHORIZED', 'Razorpay rejected this request (401). If other APIs work, Subscriptions is probably not activated on this Razorpay account.')
      }
      throw new RazorpayError(res.status, err?.code ?? 'RAZORPAY_ERROR', err?.description ?? `Razorpay returned ${res.status}`)
    }
    return json as T
  }

  /* Checkout signs a pre-joined string with the key secret:
       orders:         "<order_id>|<payment_id>"
       subscriptions:  "<payment_id>|<subscription_id>"   (use the id stored server-side) */
  function verifySignature(signedPayload: string, signature: string): boolean {
    return safeEqualHex(hmacHex(cfg.keySecret, signedPayload), signature)
  }

  return { request: request as Razorpay['request'], verifySignature }
}

export const hmacHex = (secret: string, payload: string | Buffer) => createHmac('sha256', secret).update(payload).digest('hex')

export function safeEqualHex(a: string, b: string): boolean {
  const x = Buffer.from(a, 'utf8')
  const y = Buffer.from(b ?? '', 'utf8')
  return x.length === y.length && timingSafeEqual(x, y)
}

/** Webhooks: X-Razorpay-Signature is HMAC_SHA256(webhook secret, raw request body). */
export function verifyWebhookSignature(rawBody: Buffer | string, signature: string | undefined, webhookSecret: string): boolean {
  if (!signature) return false
  return safeEqualHex(hmacHex(webhookSecret, rawBody), signature)
}
