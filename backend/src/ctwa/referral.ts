// referral.ts — when someone taps a Click-to-WhatsApp ad, the first message they send carries a `referral` object
// (docs: WhatsApp Cloud API → webhooks → messages): which ad it was, its headline, and the click id Meta wants back
// with conversion events. This turns that into a record. Pure.
import type { Referral } from './types.js'

const s = (v: unknown, n: number): string | null => (typeof v === 'string' && v.trim() ? v.trim().slice(0, n) : null)

export function extractReferral(
  message: { id: string; from: string; timestamp: string; referral?: Record<string, unknown> | undefined },
  contactName?: string,
  phoneNumberId?: string,
): Referral | null {
  const r = message.referral
  if (!r || typeof r !== 'object') return null
  const ctwaClid = s(r.ctwa_clid, 500)
  const sourceId = s(r.source_id, 100)
  if (!ctwaClid && !sourceId) return null                       // a referral with neither tells us nothing about the ad
  const secs = Number(message.timestamp)
  const welcome = r.welcome_message as { text?: unknown } | undefined
  return {
    waId: message.from,
    contactName: contactName?.trim().slice(0, 200) || null,
    ctwaClid,
    sourceId,
    sourceType: s(r.source_type, 20),
    sourceUrl: s(r.source_url, 1000),
    headline: s(r.headline, 500),
    body: s(r.body, 2000),
    mediaType: s(r.media_type, 20),
    mediaUrl: s(r.image_url, 2000) ?? s(r.video_url, 2000) ?? s(r.thumbnail_url, 2000),
    welcomeText: s(welcome?.text, 2000),
    waMessageId: message.id,
    phoneNumberId: phoneNumberId ?? null,
    createdAt: new Date((Number.isFinite(secs) && secs > 0 ? secs : Date.now() / 1000) * 1000).toISOString(),
  }
}
