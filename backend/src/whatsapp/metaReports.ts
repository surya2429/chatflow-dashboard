// metaReports.ts — the numbers on Meta's own "Insights" page, fetched from the WhatsApp Business
// Management API so the dashboard can show them without opening Meta Business Manager.
//
//   • messaging analytics  GET /{waba}?fields=analytics.start().end().granularity(DAY)
//       → messages sent / delivered
//   • pricing analytics    GET /{waba}/pricing_analytics?metric_types=["COST","VOLUME"]
//                              &dimensions=["PRICING_CATEGORY","PRICING_TYPE"]
//       → delivered volume and cost per category (marketing, utility, service …),
//         split into free (customer service window, entry points) and paid
//
// Pure: no env, no DB. Callers pass the account id, token and API version.
// Meta says its figures are approximate and may differ slightly from invoices.

export interface MetaReportParams {
  wabaId: string
  accessToken: string
  /** e.g. "v20.0" */
  version: string
  /** unix seconds, inclusive start */
  start: number
  /** unix seconds, exclusive end */
  end: number
  fetchImpl?: typeof fetch
}

export interface CategoryFigure { volume: number; cost: number }

export interface MetaReport {
  configured: true
  range: { start: number; end: number }
  currency: string
  messages: {
    sent: number
    delivered: number
    /** Meta's API does not expose inbound counts, so this stays null. */
    received: number | null
  }
  /** Delivered messages per category (paid + free). Keys are lower-case Meta category names. */
  deliveredByCategory: Record<string, number>
  free: { total: number; customerService: number; entryPoint: number; other: number }
  paid: { total: number; byCategory: Record<string, number> }
  charges: { total: number; byCategory: Record<string, number> }
}

export class MetaApiError extends Error {
  constructor(message: string, readonly status: number, readonly code?: number) {
    super(message)
  }
}

interface GraphError { error?: { message?: string; code?: number } }

async function graph<T>(f: typeof fetch, url: string): Promise<T> {
  const res = await f(url)
  const body = (await res.json().catch(() => ({}))) as T & GraphError
  if (!res.ok || body.error) {
    throw new MetaApiError(body.error?.message ?? `Meta API returned ${res.status}`, res.status, body.error?.code)
  }
  return body
}

interface AnalyticsResponse {
  currency?: string
  analytics?: { data_points?: Array<{ sent?: number; delivered?: number }> }
}
interface PricingPoint { pricing_category?: string; pricing_type?: string; volume?: number; cost?: number }
interface PricingResponse {
  // Meta nests the points under data[].data_points, under a pricing_analytics key when asked via fields.
  pricing_analytics?: { data?: Array<{ data_points?: PricingPoint[] }> }
  data?: Array<{ data_points?: PricingPoint[] }>
}

const add = (m: Record<string, number>, k: string, v: number) => { m[k] = (m[k] ?? 0) + v }

export async function fetchMetaReport(p: MetaReportParams): Promise<MetaReport> {
  const f = p.fetchImpl ?? fetch
  const base = `https://graph.facebook.com/${p.version}/${encodeURIComponent(p.wabaId)}`
  const token = `access_token=${encodeURIComponent(p.accessToken)}`

  const analyticsUrl = `${base}?fields=${encodeURIComponent(`currency,analytics.start(${p.start}).end(${p.end}).granularity(DAY)`)}&${token}`
  const pricingUrl = `${base}/pricing_analytics?start=${p.start}&end=${p.end}&granularity=DAILY`
    + `&metric_types=${encodeURIComponent('["COST","VOLUME"]')}`
    + `&dimensions=${encodeURIComponent('["PRICING_CATEGORY","PRICING_TYPE"]')}&${token}`

  const [analytics, pricing] = await Promise.all([graph<AnalyticsResponse>(f, analyticsUrl), graph<PricingResponse>(f, pricingUrl)])

  const points = analytics.analytics?.data_points ?? []
  const sent = points.reduce((n, d) => n + (d.sent ?? 0), 0)
  const delivered = points.reduce((n, d) => n + (d.delivered ?? 0), 0)

  const priced = (pricing.pricing_analytics?.data ?? pricing.data ?? []).flatMap((d) => d.data_points ?? [])
  const deliveredByCategory: Record<string, number> = {}
  const paidByCategory: Record<string, number> = {}
  const chargesByCategory: Record<string, number> = {}
  const free = { total: 0, customerService: 0, entryPoint: 0, other: 0 }
  let paidTotal = 0
  let chargesTotal = 0

  for (const d of priced) {
    const cat = (d.pricing_category ?? 'unknown').toLowerCase()
    const type = (d.pricing_type ?? '').toUpperCase()
    const volume = d.volume ?? 0
    const cost = d.cost ?? 0
    add(deliveredByCategory, cat, volume)
    if (type.startsWith('FREE')) {
      free.total += volume
      if (type === 'FREE_CUSTOMER_SERVICE') free.customerService += volume
      else if (type === 'FREE_ENTRY_POINT') free.entryPoint += volume
      else free.other += volume
    } else {
      paidTotal += volume
      add(paidByCategory, cat, volume)
      chargesTotal += cost
      add(chargesByCategory, cat, cost)
    }
  }

  return {
    configured: true,
    range: { start: p.start, end: p.end },
    currency: analytics.currency ?? 'INR',
    messages: { sent, delivered, received: null },
    deliveredByCategory,
    free,
    paid: { total: paidTotal, byCategory: paidByCategory },
    charges: { total: chargesTotal, byCategory: chargesByCategory },
  }
}

/* The most Meta's pricing_analytics lets you ask for in one call. */
export const MAX_RANGE_DAYS = 90

export interface MetaReportCreds { wabaId?: string; accessToken?: string; version: string }

/** GET /api/whatsapp/meta-reports?start=<unix>&end=<unix> — shared by the API route and the Vite dev server. */
export async function metaReportResponse(
  query: Record<string, unknown>,
  creds: MetaReportCreds,
  fetchImpl?: typeof fetch,
): Promise<{ status: number; body: unknown }> {
  if (!creds.wabaId || !creds.accessToken) return { status: 200, body: { configured: false } }
  const start = Number(query.start)
  const end = Number(query.end)
  if (!Number.isInteger(start) || !Number.isInteger(end) || start <= 0 || end <= start) {
    return { status: 400, body: { error: 'invalid_request', message: 'start and end must be unix seconds, end after start.' } }
  }
  if (end - start > MAX_RANGE_DAYS * 86400) {
    return { status: 400, body: { error: 'range_too_long', message: `Meta reports cover at most ${MAX_RANGE_DAYS} days at a time.` } }
  }
  try {
    const report = await fetchMetaReport({ wabaId: creds.wabaId, accessToken: creds.accessToken, version: creds.version, start, end, fetchImpl })
    return { status: 200, body: report }
  } catch (err) {
    if (err instanceof MetaApiError) {
      // 190 = expired/invalid token, 100/200 = permission or parameter problems: all the merchant's to fix, none a server fault.
      return { status: 502, body: { error: 'meta_error', message: err.message, code: err.code ?? null } }
    }
    throw err
  }
}
