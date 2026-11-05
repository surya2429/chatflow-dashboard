// poweredByLead.ts — the "Powered by SmatBot" form in the WhatsApp website widget: someone who notices the branding may
// want the product themselves, so clicking it asks for their details and then sends them to smatbot.com.
//
// Required: name, email, phone. Optional: company, website. This endpoint is public (the widget runs on other
// people's websites), so everything is validated here and the number of submissions per address is limited.
//
// Pure: storage is passed in, so the API route (Postgres) and the Vite dev server (a JSON file) share it.

export interface PoweredByLead {
  name: string
  email: string
  phone: string
  company: string | null
  website: string | null
  /** the page the widget was on, when the browser says so */
  sourceUrl: string | null
}

export type LeadFields = Partial<Record<'name' | 'email' | 'phone' | 'company' | 'website', string>>

const EMAIL = /^[^\s@]{1,64}@[^\s@]+\.[^\s@]{2,}$/
const DOMAIN = /^(https?:\/\/)?([a-z0-9-]+\.)+[a-z]{2,}(:\d+)?(\/[^\s]*)?$/i

const text = (v: unknown, max: number): string => (typeof v === 'string' ? v.trim().slice(0, max) : '')

export function validateLead(body: unknown): { ok: true; lead: PoweredByLead } | { ok: false; fields: LeadFields } {
  const b = (body && typeof body === 'object' ? body : {}) as Record<string, unknown>
  const fields: LeadFields = {}

  const name = text(b.name, 100)
  if (name.length < 2) fields.name = 'Enter your name.'

  const email = text(b.email, 254)
  if (!EMAIL.test(email)) fields.email = 'Enter a valid email address.'

  const phone = text(b.phone, 30)
  const digits = phone.replace(/\D/g, '')
  if (!/^[\d\s()+.\-]+$/.test(phone) || digits.length < 7 || digits.length > 15) fields.phone = 'Enter a valid phone number.'

  const company = text(b.company, 120)

  let website = text(b.website, 200)
  if (website) {
    if (DOMAIN.test(website)) website = /^https?:\/\//i.test(website) ? website : `https://${website}`
    else fields.website = 'Enter a valid website, like example.com.'
  }

  if (Object.keys(fields).length) return { ok: false, fields }
  return { ok: true, lead: { name, email, phone, company: company || null, website: website || null, sourceUrl: text(b.sourceUrl, 500) || null } }
}

/** At most `max` submissions per key (an IP address) in any `windowMs`. In memory: fine for one API process. */
export function createRateLimiter(max: number, windowMs: number, now: () => number = Date.now) {
  const seen = new Map<string, number[]>()
  return (key: string): boolean => {
    const t = now()
    const recent = (seen.get(key) ?? []).filter((x) => t - x < windowMs)
    if (recent.length >= max) { seen.set(key, recent); return false }
    recent.push(t)
    seen.set(key, recent)
    if (seen.size > 5000) for (const [k, v] of seen) if (!v.some((x) => t - x < windowMs)) seen.delete(k)   // keep memory bounded
    return true
  }
}

export async function handleLeadRequest(
  body: unknown,
  ip: string,
  save: (lead: PoweredByLead) => Promise<void>,
  allow: (ip: string) => boolean,
): Promise<{ status: number; body: unknown }> {
  if (!allow(ip)) return { status: 429, body: { error: 'too_many_requests', message: 'Too many requests. Please try again later.' } }
  const v = validateLead(body)
  if (!v.ok) return { status: 400, body: { error: 'invalid_request', fields: v.fields } }
  await save(v.lead)
  return { status: 201, body: { ok: true } }
}
