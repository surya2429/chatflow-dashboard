// trackedLink.ts — a per-message link that tells us exactly who clicked, without relying on Meta's click webhook
// (which has no recipient or message id, and is in limited availability).
//
//   template CTA button   https://api.yourdomain.com/r/{{1}}          (dynamic URL button)
//   at send time          {{1}} = sign(message uuid)                  (marketingWorker fills it in)
//   when the customer taps GET /r/<token> → we know the message, campaign and contact → 302 to the campaign's destination
//
// The token is the message's UUID plus a short HMAC, so a link cannot be guessed or forged for someone else's message.
import { createHmac, timingSafeEqual } from 'node:crypto'
import type { TemplateComponent } from '../whatsapp/types.js'

const SIG_BYTES = 10
const mac = (secret: string, id: string) => createHmac('sha256', secret).update(`link:${id}`).digest().subarray(0, SIG_BYTES)
const compact = (uuid: string) => Buffer.from(uuid.replace(/-/g, ''), 'hex').toString('base64url') // 22 chars
const expand = (c: string) => {
  const h = Buffer.from(c, 'base64url').toString('hex')
  return h.length === 32 ? `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}` : null
}

export const signLinkToken = (messageId: string, secret: string): string => `${compact(messageId)}.${mac(secret, messageId).toString('base64url')}`

/** The message id inside a valid token, or null for anything forged, truncated or malformed. */
export function verifyLinkToken(token: string, secret: string): string | null {
  const [idPart, sigPart, ...rest] = String(token).split('.')
  if (!idPart || !sigPart || rest.length || idPart.length > 40 || sigPart.length > 40) return null
  const id = expand(idPart)
  if (!id) return null
  const given = Buffer.from(sigPart, 'base64url')
  const want = mac(secret, id)
  return given.length === want.length && timingSafeEqual(given, want) ? id : null
}

export interface TrackedLinkConfig { buttonIndex: number; destination: string }

/** `campaigns.metadata.trackedLink` → a checked config, or null when the campaign does not track links. */
export function readTrackedLink(metadata: unknown): TrackedLinkConfig | null {
  const t = (metadata as { trackedLink?: Record<string, unknown> } | null)?.trackedLink
  if (!t || typeof t.destination !== 'string' || !/^https:\/\/[^\s]+$/i.test(t.destination)) return null
  const i = Number(t.buttonIndex ?? 0)
  return Number.isInteger(i) && i >= 0 && i <= 9 ? { buttonIndex: i, destination: t.destination } : null
}

/** Adds the dynamic-URL-button parameter that carries the token (unless the caller already supplied that button). */
export function withTrackedLink(components: TemplateComponent[] | undefined, cfg: TrackedLinkConfig, token: string): TemplateComponent[] {
  const list = components ?? []
  if (list.some((c) => c.type === 'button' && c.sub_type === 'url' && c.index === String(cfg.buttonIndex))) return list
  return [...list, { type: 'button', sub_type: 'url', index: String(cfg.buttonIndex), parameters: [{ type: 'text', text: token }] }]
}

/** Where to send the person: the destination, keeping every query parameter Meta added (click_id / fbclid must survive the redirect). */
export function destinationWithQuery(destination: string, query: Record<string, unknown>): string {
  const url = new URL(destination)
  for (const [k, v] of Object.entries(query)) if (typeof v === 'string' && !url.searchParams.has(k)) url.searchParams.set(k, v)
  return url.toString()
}

/** Meta's click id arrives as `click_id` (and `fbclid` on some surfaces). */
export const clickIdOf = (query: Record<string, unknown>): string | null => {
  const v = typeof query.click_id === 'string' ? query.click_id : typeof query.fbclid === 'string' ? query.fbclid : ''
  return v && v.length <= 256 ? v : null
}
