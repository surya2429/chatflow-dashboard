// common.ts — validation of a new ad, money and date helpers, metric maths. Pure.
import { CtwaError, OBJECTIVES, type AdMetrics, type CreateAdInput, type Objective } from './types.js'

const str = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().slice(0, max) : '')
const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : typeof v === 'string' && v.trim() !== '' && Number.isFinite(Number(v)) ? Number(v) : NaN)

/** Currencies Meta counts in whole units; everything else is in hundredths (paise, cents). */
const ZERO_DECIMAL = new Set(['JPY', 'KRW', 'VND', 'CLP', 'PYG', 'UGX', 'XAF', 'XOF', 'XPF', 'RWF', 'KMF', 'GNF', 'DJF', 'BIF', 'VUV'])
export const toMinor = (amount: number, currency: string) => Math.round(amount * (ZERO_DECIMAL.has(currency) ? 1 : 100))
export const fromMinor = (minor: number | string | undefined | null, currency: string) => {
  const n = Number(minor)
  return Number.isFinite(n) ? n / (ZERO_DECIMAL.has(currency) ? 1 : 100) : null
}

export const MAX_IMAGE_BYTES = 4 * 1024 * 1024

/** Everything the "create ad" form can send, checked. Throws CtwaError(400) with one message per bad field. */
export function validateCreateAd(raw: unknown): CreateAdInput {
  const b = (raw && typeof raw === 'object' ? raw : {}) as Record<string, any>
  const t = (b.targeting ?? {}) as Record<string, any>
  const c = (b.creative ?? {}) as Record<string, any>
  const w = (c.welcome ?? {}) as Record<string, any>
  const f: Record<string, string> = {}

  const name = str(b.name, 100)
  if (name.length < 2) f.name = 'Give the ad a name (at least 2 characters).'

  const objective: Objective = (OBJECTIVES as readonly string[]).includes(b.objective) ? b.objective : 'OUTCOME_ENGAGEMENT'

  const dailyBudget = num(b.dailyBudget)
  if (!(dailyBudget > 0) || dailyBudget > 10_000_000) f.dailyBudget = 'Enter a daily budget above 0.'

  const when = (v: unknown) => { const s = str(v, 40); const d = s ? new Date(s) : null; return d && !isNaN(d.getTime()) ? d : s ? undefined : null }
  const start = when(b.startTime), end = when(b.endTime)
  if (start === undefined) f.startTime = 'Start time is not a valid date.'
  if (end === undefined) f.endTime = 'End time is not a valid date.'
  if (start && end && end.getTime() - start.getTime() < 24 * 3600_000) f.endTime = 'A daily budget needs the ad to run for more than 24 hours.'
  if (end && !start && end.getTime() - Date.now() < 24 * 3600_000) f.endTime = 'A daily budget needs the ad to run for more than 24 hours.'

  const countries = [...new Set((Array.isArray(t.countries) ? t.countries : []).map((x: unknown) => str(x, 2).toUpperCase()).filter((x: string) => /^[A-Z]{2}$/.test(x)))].slice(0, 25)
  if (!countries.length) f.countries = 'Pick at least one country.'
  const ageMin = Math.round(num(t.ageMin ?? 18)), ageMax = Math.round(num(t.ageMax ?? 65))
  if (!(ageMin >= 13 && ageMin <= 65) || !(ageMax >= 13 && ageMax <= 65) || ageMin > ageMax) f.age = 'Choose an age range between 13 and 65.'
  const genders = ['all', 'male', 'female'].includes(t.genders) ? t.genders : 'all'

  const primaryText = str(c.primaryText, 500)
  if (!primaryText) f.primaryText = 'Write the main text people see above the image.'
  const headline = str(c.headline, 60)
  if (!headline) f.headline = 'Write a headline.'
  const description = str(c.description, 90)

  const imageUrl = str(c.imageUrl, 1000) || null
  const imageBase64 = typeof c.imageBase64 === 'string' && c.imageBase64 ? c.imageBase64.replace(/^data:[^,]*,/, '') : null
  if (imageUrl && !/^https:\/\/[^\s]+$/i.test(imageUrl)) f.image = 'The image link must start with https://'
  else if (imageBase64 && (!/^[A-Za-z0-9+/=\s]+$/.test(imageBase64) || Math.floor(imageBase64.length * 0.75) > MAX_IMAGE_BYTES)) f.image = 'The image must be a picture under 4 MB.'
  else if (!imageUrl && !imageBase64) f.image = 'Add an image (a link or an upload).'

  const type = w.type === 'ice_breakers' ? 'ice_breakers' : 'autofill'
  const greeting = str(w.greeting, 80)
  if (!greeting) f.greeting = 'Write the greeting people see when the chat opens.'
  const autofillMessage = str(w.autofillMessage, 1000)
  const iceBreakers = (Array.isArray(w.iceBreakers) ? w.iceBreakers : []).map((x: unknown) => str(x, 80)).filter(Boolean).slice(0, 3)
  if (type === 'autofill' && !autofillMessage) f.autofillMessage = 'Write the message that appears pre-filled for the customer.'
  if (type === 'ice_breakers' && !iceBreakers.length) f.iceBreakers = 'Add at least one ice breaker question.'

  if (Object.keys(f).length) throw new CtwaError('Some details need fixing.', 400, 'invalid_request', f)

  return {
    name, objective, dailyBudget,
    startTime: start ? start.toISOString() : null, endTime: end ? end.toISOString() : null,
    targeting: { countries, ageMin, ageMax, genders },
    creative: { primaryText, headline, description, imageUrl, imageBase64, welcome: type === 'autofill' ? { type, greeting, autofillMessage } : { type, greeting, iceBreakers } },
    status: b.status === 'ACTIVE' ? 'ACTIVE' : 'PAUSED',
  }
}

/** unix seconds → YYYY-MM-DD (UTC), the form Meta's insights time_range wants */
export const day = (unix: number) => new Date(unix * 1000).toISOString().slice(0, 10)

const DATE = /^\d{4}-\d{2}-\d{2}$/
const dayNumber = (d: string) => Date.parse(`${d}T00:00:00Z`) / 86400_000

/**
 * Default last 30 days; at most 90 days; start before end.
 * `since` / `until` (YYYY-MM-DD) are the calendar days the person picked in their own time zone ("today", "yesterday",
 * a custom range). They decide which days Meta's report and the sample data cover; start / end (unix seconds) still
 * decide which leads fall inside, so both stay correct whatever the time zone.
 */
export function parseRange(q: Record<string, unknown>, now = Date.now()): { start: number; end: number; since?: string; until?: string } {
  const end = Math.floor(Number(q.end) || now / 1000)
  const start = Math.floor(Number(q.start) || end - 30 * 86400)
  const since = typeof q.since === 'string' && DATE.test(q.since) && !isNaN(dayNumber(q.since)) ? q.since : undefined
  const until = typeof q.until === 'string' && DATE.test(q.until) && !isNaN(dayNumber(q.until)) ? q.until : undefined
  if (since && until && (dayNumber(until) < dayNumber(since) || dayNumber(until) - dayNumber(since) >= 90)) throw new CtwaError('Choose a date range of up to 90 days.', 400, 'invalid_range')
  if (!(start < end) || end - start > 90 * 86400 + 7200) throw new CtwaError('Choose a date range of up to 90 days.', 400, 'invalid_range')
  return { start, end, ...(since && until ? { since, until } : {}) }
}

/** Every calendar day (YYYY-MM-DD) a range covers; at most 91. */
export function daysOf(range: { start: number; end: number; since?: string | undefined; until?: string | undefined }): string[] {
  const out: string[] = []
  if (range.since && range.until) {
    for (let n = dayNumber(range.since); n <= dayNumber(range.until) && out.length < 91; n++) out.push(new Date(n * 86400_000).toISOString().slice(0, 10))
    return out
  }
  for (let t = range.start; t <= range.end && out.length < 91; t += 86400) out.push(day(t))
  return out
}

export const emptyMetrics = (): AdMetrics => ({ spend: 0, impressions: 0, reach: 0, clicks: 0, conversations: 0, ctr: null, cpc: null, costPerConversation: null })

/** Fill the ratios from the raw counts. */
export function finishMetrics(m: Pick<AdMetrics, 'spend' | 'impressions' | 'reach' | 'clicks' | 'conversations'>): AdMetrics {
  const r2 = (n: number) => Math.round(n * 100) / 100
  return {
    ...m, spend: r2(m.spend),
    ctr: m.impressions > 0 ? r2((m.clicks / m.impressions) * 100) : null,
    cpc: m.clicks > 0 ? r2(m.spend / m.clicks) : null,
    costPerConversation: m.conversations > 0 ? r2(m.spend / m.conversations) : null,
  }
}

export function sumMetrics(list: AdMetrics[]): AdMetrics {
  // reach cannot be added across ads without double counting people; the sum is an upper bound, labelled as such in the UI
  return finishMetrics(list.reduce((a, m) => ({ spend: a.spend + m.spend, impressions: a.impressions + m.impressions, reach: a.reach + m.reach, clicks: a.clicks + m.clicks, conversations: a.conversations + m.conversations }), { spend: 0, impressions: 0, reach: 0, clicks: 0, conversations: 0 }))
}
