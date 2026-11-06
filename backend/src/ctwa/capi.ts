// capi.ts — telling Meta what happened to a lead that came from a Click-to-WhatsApp ad ("Conversions API for
// Business Messaging"): Lead, Qualified lead, Purchase … Meta uses it to find more people like your buyers.
//
//   POST /{dataset_id}/events   { data: [{ event_name, event_time, action_source: "business_messaging",
//                                          messaging_channel: "whatsapp",
//                                          user_data: { whatsapp_business_account_id, ctwa_clid }, custom_data }] }
//   GET|POST /{waba_id}/dataset  → the dataset id (created on first use)
//
// Pure: no env, no DB.
import { CAPI_EVENTS, CtwaError, type CapiEvent } from './types.js'

export interface CapiConfig {
  wabaId: string
  accessToken: string
  version: string
  datasetId?: string | undefined
  /** the partner name Meta assigned you, if any */
  partnerAgent?: string | undefined
  fetchImpl?: typeof fetch
}

export interface EventInput { eventName: CapiEvent; value: number | null; currency: string | null }

/** Events that can legitimately happen more than once for the same person; everything else is sent once per lead. */
export const REPEATABLE: ReadonlySet<string> = new Set(['Purchase', 'OrderCreated', 'OrderShipped', 'OrderDelivered', 'OrderCanceled', 'OrderReturned', 'RatingProvided', 'ReviewProvided'])

export function validateEvent(raw: unknown): EventInput {
  const b = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>
  const eventName = b.eventName as CapiEvent
  if (!CAPI_EVENTS.includes(eventName)) throw new CtwaError('Choose an event Meta supports.', 400, 'invalid_request', { eventName: 'Unknown event.' })
  const hasValue = b.value !== undefined && b.value !== null && b.value !== ''
  const value = hasValue ? Number(b.value) : null
  const currency = typeof b.currency === 'string' && b.currency.trim() ? b.currency.trim().toUpperCase() : null
  if (value !== null && !(value >= 0 && value < 1e9)) throw new CtwaError('Enter a valid amount.', 400, 'invalid_request', { value: 'Enter a valid amount.' })
  if (value !== null && !(currency && /^[A-Z]{3}$/.test(currency))) throw new CtwaError('Enter a 3-letter currency such as INR.', 400, 'invalid_request', { currency: 'Use a 3-letter code such as INR.' })
  if (eventName === 'Purchase' && !(value !== null && value > 0)) throw new CtwaError('A purchase needs an amount above 0.', 400, 'invalid_request', { value: 'Enter the order value.' })
  return { eventName, value, currency: value !== null ? currency : null }
}

export function buildCapiBody(cfg: Pick<CapiConfig, 'wabaId' | 'partnerAgent'>, ctwaClid: string, e: EventInput, nowSec = Math.floor(Date.now() / 1000)) {
  return {
    data: [{
      event_name: e.eventName,
      event_time: nowSec,
      action_source: 'business_messaging',
      messaging_channel: 'whatsapp',
      user_data: { whatsapp_business_account_id: cfg.wabaId, ctwa_clid: ctwaClid },
      ...(e.value !== null ? { custom_data: { currency: e.currency, value: e.value } } : {}),
    }],
    ...(cfg.partnerAgent ? { partner_agent: cfg.partnerAgent } : {}),
  }
}

export function createCapi(cfg: CapiConfig) {
  const f = cfg.fetchImpl ?? fetch
  let dataset = cfg.datasetId

  async function graph(method: 'GET' | 'POST', path: string, body?: unknown): Promise<any> {
    let res: Response
    try {
      res = await f(`https://graph.facebook.com/${cfg.version}/${path}`, {
        method,
        headers: { Authorization: `Bearer ${cfg.accessToken}`, ...(body ? { 'Content-Type': 'application/json' } : {}) },
        ...(body ? { body: JSON.stringify(body) } : {}),
        signal: AbortSignal.timeout(20_000),
      })
    } catch { throw new CtwaError('Could not reach Meta. Try again.', 502, 'meta_unreachable') }
    const json = (await res.json().catch(() => ({}))) as any
    if (!res.ok || json.error) {
      const e = json.error ?? {}
      if (e.code === 190) throw new CtwaError('Meta rejected the access token.', 401, 'meta_token')
      if (e.code === 200 || e.code === 10) throw new CtwaError('The token needs the whatsapp_business_manage_events permission.', 403, 'meta_permission')
      throw new CtwaError(String(e.error_user_msg || e.message || `Meta returned ${res.status}`), 502, 'meta_error')
    }
    return json
  }

  /** the WABA's dataset: use the one it has, create it when it has none */
  async function datasetId(): Promise<string> {
    if (dataset) return dataset
    const got = await graph('GET', `${cfg.wabaId}/dataset`)
    dataset = got.data?.[0]?.id ?? got.id
    if (!dataset) { const made = await graph('POST', `${cfg.wabaId}/dataset`, {}); dataset = made.id }
    if (!dataset) throw new CtwaError('Meta did not return a dataset for this WhatsApp Business Account.', 502, 'meta_error')
    return dataset
  }

  return {
    async send(ctwaClid: string, e: EventInput): Promise<void> {
      const res = await graph('POST', `${await datasetId()}/events`, buildCapiBody(cfg, ctwaClid, e))
      if (res.events_received !== undefined && Number(res.events_received) < 1) throw new CtwaError('Meta did not accept the event.', 502, 'meta_error')
    },
  }
}
export type Capi = ReturnType<typeof createCapi>
