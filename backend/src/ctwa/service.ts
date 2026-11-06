// service.ts — the HTTP-shaped entry point of the Click-to-WhatsApp section, shared by the Express route and the
// Vite dev server. It only knows the AdsBackend (live Meta or sample), the lead store and the Conversions API.
import { CtwaError, type AdPatch, type AdsBackend, type CtwaStore, type LeadEvent } from './types.js'
import { parseRange, validateCreateAd } from './common.js'
import { REPEATABLE, validateEvent, type Capi } from './capi.js'

export interface CtwaRequest { method: string; path: string; query: Record<string, string>; body: Record<string, unknown> }
export interface CtwaDeps { ads: AdsBackend; store: CtwaStore; capi: Capi | null; now?: () => number }

// ids go into Graph API URLs, so they are restricted to what ids look like
const ID = /^[A-Za-z0-9_]{1,60}$/
const WA_ID = /^\d{6,20}$/

export const maxImageBodyBytes = 8 * 1024 * 1024

export async function handleCtwaRequest(req: CtwaRequest, d: CtwaDeps): Promise<{ status: number; body: unknown }> {
  try {
    const { method, path } = req
    const seg = path.replace(/^\/+|\/+$/g, '').split('/')

    if (method === 'GET' && seg[0] === 'dashboard') {
      const range = parseRange(req.query, d.now?.())
      const [currency, data, leadStats] = await Promise.all([d.ads.currency(), d.ads.dashboard(range), d.store.statsBySource(range)])
      return { status: 200, body: { mode: d.ads.mode, currency, range, ...data, leadStats } }
    }

    if (method === 'GET' && seg[0] === 'status') {
      return { status: 200, body: { ...(await d.ads.setup()), capiLive: d.capi !== null } }
    }

    if (seg[0] === 'ads') {
      if (method === 'POST' && seg.length === 1) {
        const created = await d.ads.createAd(validateCreateAd(req.body))
        return { status: 201, body: { ok: true, ...created } }
      }
      const id = seg[1] ?? ''
      if (seg.length === 2 && ID.test(id) && (method === 'PATCH' || method === 'DELETE')) {
        const patch: AdPatch = method === 'DELETE' ? { status: 'ARCHIVED' } : validatePatch(req.body)
        await d.ads.updateAd(id, patch)
        return { status: 200, body: { ok: true } }
      }
    }

    if (method === 'GET' && seg[0] === 'leads') {
      const limit = Math.min(Math.max(Math.floor(Number(req.query.limit)) || 200, 1), 500)
      const adId = req.query.adId === undefined ? undefined : String(req.query.adId)
      if (adId !== undefined && !ID.test(adId)) throw new CtwaError('That ad id is not valid.', 400, 'invalid_request')
      return { status: 200, body: { mode: d.ads.mode, capiLive: d.capi !== null, leads: await d.store.listLeads(limit, adId) } }
    }

    if (method === 'GET' && seg[0] === 'lead') {
      const waId = String(req.query.waId ?? '').replace(/\D/g, '')
      if (!WA_ID.test(waId)) throw new CtwaError('Enter a WhatsApp number.', 400, 'invalid_request')
      return { status: 200, body: { mode: d.ads.mode, capiLive: d.capi !== null, lead: await d.store.latestForWaId(waId) } }
    }

    if (method === 'POST' && seg[0] === 'events') {
      const waId = String(req.body.waId ?? '').replace(/\D/g, '')
      if (!WA_ID.test(waId)) throw new CtwaError('Enter a WhatsApp number.', 400, 'invalid_request')
      const e = validateEvent(req.body)
      const lead = await d.store.latestForWaId(waId)
      if (!lead) throw new CtwaError('This chat did not come from a Click-to-WhatsApp ad, so Meta has nothing to match it to.', 404, 'not_ad_lead')
      if (!REPEATABLE.has(e.eventName) && lead.events.some((x) => x.eventName === e.eventName && x.status !== 'failed'))
        throw new CtwaError(`“${e.eventName}” was already sent for this lead.`, 409, 'already_sent')
      if (d.ads.mode === 'live' && !d.capi) throw new CtwaError('Set WA_BUSINESS_ACCOUNT_ID on the server to send conversion events to Meta.', 503, 'capi_not_configured')
      if (!lead.ctwaClid) throw new CtwaError('Meta did not give a click id for this chat, so the event cannot be matched to the ad.', 422, 'no_click_id')

      const at = new Date((d.now?.() ?? Date.now())).toISOString()
      const log: LeadEvent = { eventName: e.eventName, value: e.value, currency: e.currency, status: d.capi ? 'sent' : 'simulated', error: null, at }
      if (d.capi) {
        try { await d.capi.send(lead.ctwaClid, e) }
        catch (err) {
          await d.store.logEvent(waId, lead.ctwaClid, { ...log, status: 'failed', error: err instanceof Error ? err.message : 'failed' })
          throw err
        }
      }
      await d.store.logEvent(waId, lead.ctwaClid, log)
      return { status: 200, body: { ok: true, status: log.status } }
    }

    return { status: 404, body: { error: 'not_found', message: 'Unknown CTWA endpoint.' } }
  } catch (err) {
    if (err instanceof CtwaError) return { status: err.status, body: { error: err.code, message: err.message, ...(err.fields ? { fields: err.fields } : {}) } }
    throw err
  }
}

function validatePatch(raw: Record<string, unknown>): AdPatch {
  const p: AdPatch = {}
  const f: Record<string, string> = {}
  if (raw.status !== undefined) { if (raw.status === 'ACTIVE' || raw.status === 'PAUSED') p.status = raw.status; else f.status = 'Status must be ACTIVE or PAUSED.' }
  if (raw.name !== undefined) { const n = typeof raw.name === 'string' ? raw.name.trim().slice(0, 100) : ''; if (n.length >= 2) p.name = n; else f.name = 'Give the ad a name (at least 2 characters).' }
  if (raw.dailyBudget !== undefined) { const b = Number(raw.dailyBudget); if (b > 0 && b <= 10_000_000) p.dailyBudget = b; else f.dailyBudget = 'Enter a daily budget above 0.' }
  if (Object.keys(f).length) throw new CtwaError('Some details need fixing.', 400, 'invalid_request', f)
  if (!Object.keys(p).length) throw new CtwaError('Nothing to change.', 400, 'invalid_request')
  return p
}
