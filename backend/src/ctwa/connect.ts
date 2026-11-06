// connect.ts — connecting a customer's Meta account through Facebook's own popup (Facebook Login for Business /
// Embedded Signup), so nobody has to copy ids and tokens by hand.
//
//   browser   FB.login({ config_id, response_type: 'code', override_default_response_type: true, extras: { setup: {} } })
//             → authResponse.code (valid ~30 s)  (+ asset ids posted by the popup: ad accounts, pages, WABA, dataset)
//   server    GET /oauth/access_token?client_id&client_secret&code   → the customer's business token
//             GET /debug_token  → granular_scopes[].target_ids       → which assets the customer shared
//             GET /{id}?fields=name,currency                         → verify each one with the new token and name it
//
// The platform's own app id / secret / configuration id are set once by the operator (env); customers only click.
// Pure: no env, no DB. The token is stored encrypted by the caller and never sent to the browser.
import { CtwaError } from './types.js'

export interface MetaApp { appId: string; appSecret: string; configId: string; version: string }

export interface Asset { id: string; name: string }
export interface AdAccount extends Asset { currency: string }

export interface StoredConnection {
  tokenEnc: string
  userName: string | null
  businessId: string | null
  adAccounts: AdAccount[]
  pages: Asset[]
  wabas: Asset[]
  datasetId: string | null
  selected: { adAccountId: string | null; pageId: string | null; wabaId: string | null }
  connectedAt: string
}

export interface ConnectionStore {
  load(workspace: string): Promise<StoredConnection | null>
  save(workspace: string, c: StoredConnection): Promise<void>
  remove(workspace: string): Promise<void>
}

/** What the browser may know: everything except the token. */
export function publicView(c: StoredConnection | null, app: MetaApp | null, source: 'facebook' | 'env' | null) {
  return {
    config: { enabled: !!app, appId: app?.appId ?? null, configId: app?.configId ?? null, version: app?.version ?? null },
    connected: !!c || source === 'env',
    source,
    userName: c?.userName ?? null,
    adAccounts: c?.adAccounts ?? [],
    pages: c?.pages ?? [],
    wabas: c?.wabas ?? [],
    selected: c?.selected ?? { adAccountId: null, pageId: null, wabaId: null },
    needsSelection: !!c && !(c.selected.adAccountId && c.selected.pageId),
    connectedAt: c?.connectedAt ?? null,
  }
}

const DIGITS = /^\d{3,25}$/
const ids = (v: unknown): string[] => [...new Set((Array.isArray(v) ? v : []).map((x) => String(x).replace(/^act_/, '')).filter((x) => DIGITS.test(x)))].slice(0, 50)

/** What the popup told the page (all optional; only used as hints — every id is re-checked with the token). */
export interface Hints { adAccountIds: string[]; pageIds: string[]; wabaIds: string[]; datasetId: string | null; businessId: string | null }
export function cleanHints(raw: unknown): Hints {
  const h = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>
  const one = (v: unknown) => (typeof v === 'string' || typeof v === 'number') && DIGITS.test(String(v)) ? String(v) : null
  return { adAccountIds: ids(h.ad_account_ids ?? h.adAccountIds), pageIds: ids(h.page_ids ?? h.pageIds), wabaIds: ids([...(Array.isArray(h.waba_ids) ? h.waba_ids : []), h.waba_id ?? h.wabaId].filter(Boolean)), datasetId: one((Array.isArray(h.dataset_ids) ? h.dataset_ids[0] : undefined) ?? h.datasetId), businessId: one(h.business_id ?? h.businessId) }
}

export function createConnector(app: MetaApp, fetchImpl: typeof fetch = fetch) {
  const base = `https://graph.facebook.com/${app.version}`

  async function get(path: string, query: Record<string, string>, bearer?: string): Promise<any> {
    const url = new URL(`${base}/${path}`)
    for (const [k, v] of Object.entries(query)) url.searchParams.set(k, v)
    let res: Response
    try { res = await fetchImpl(url.toString(), { headers: bearer ? { Authorization: `Bearer ${bearer}` } : {}, signal: AbortSignal.timeout(20_000) }) }
    catch { throw new CtwaError('Could not reach Facebook. Try again.', 502, 'meta_unreachable') }
    const json = (await res.json().catch(() => ({}))) as any
    if (!res.ok || json.error) throw new CtwaError(String(json.error?.error_user_msg || json.error?.message || `Facebook returned ${res.status}`), res.status === 400 ? 400 : 502, 'meta_error')
    return json
  }

  return {
    /** the one-time code from the popup → the customer's token */
    async exchange(code: string): Promise<{ token: string; businessId: string | null }> {
      // the secret travels in the query because this endpoint takes no other form of it; it stays on this server-to-Meta hop
      try {
        const r = await get('oauth/access_token', { client_id: app.appId, client_secret: app.appSecret, code })
        if (!r.access_token) throw new CtwaError('Facebook did not return an access token.', 502, 'meta_error')
        return { token: String(r.access_token), businessId: r.client_business_id ? String(r.client_business_id) : null }
      } catch (e) {
        if (e instanceof CtwaError && e.code === 'meta_error') throw new CtwaError('Facebook did not accept the login. The code may have expired — please try connecting again.', 400, 'meta_code')
        throw e
      }
    },

    /** which ad accounts, Pages and WhatsApp accounts the customer shared, each re-read with their token */
    async discover(token: string, hints: Hints): Promise<Pick<StoredConnection, 'userName' | 'adAccounts' | 'pages' | 'wabas' | 'datasetId'>> {
      const ad = new Set(hints.adAccountIds), pg = new Set(hints.pageIds), wb = new Set(hints.wabaIds)
      try {
        const dbg = await get('debug_token', { input_token: token }, `${app.appId}|${app.appSecret}`)
        for (const g of dbg.data?.granular_scopes ?? []) {
          const targets = ids(g.target_ids)
          if (['ads_management', 'ads_read'].includes(g.scope)) targets.forEach((t) => ad.add(t))
          else if (['pages_show_list', 'pages_read_engagement', 'pages_manage_ads', 'pages_messaging'].includes(g.scope)) targets.forEach((t) => pg.add(t))
          else if (['whatsapp_business_management', 'whatsapp_business_messaging', 'whatsapp_business_manage_events'].includes(g.scope)) targets.forEach((t) => wb.add(t))
        }
      } catch { /* the hints from the popup may be enough; the checks below decide */ }

      // a customer-shared id that this token cannot read is dropped, never trusted
      const named = async (list: Set<string>, path: (id: string) => string, fields: string): Promise<{ id: string; r: any }[]> =>
        (await Promise.all([...list].slice(0, 25).map(async (id) => { try { return { id, r: await get(path(id), { fields }, token) } } catch { return null } }))).filter((x): x is { id: string; r: any } => x !== null)

      const [a, p, w, me] = await Promise.all([
        named(ad, (id) => `act_${id}`, 'name,currency'),
        named(pg, (id) => id, 'name'),
        named(wb, (id) => id, 'name'),
        get('me', { fields: 'name' }, token).catch(() => ({})),
      ])
      const adAccounts = a.map(({ id, r }) => ({ id, name: String(r.name ?? `Ad account ${id}`), currency: String(r.currency ?? 'USD') }))
      const pages = p.map(({ id, r }) => ({ id, name: String(r.name ?? `Page ${id}`) }))
      const wabas = w.map(({ id, r }) => ({ id, name: String(r.name ?? `WhatsApp account ${id}`) }))
      return { userName: me.name ? String(me.name) : null, adAccounts, pages, wabas, datasetId: hints.datasetId }
    },

    /** best effort: take the permissions back when the customer disconnects */
    async revoke(token: string): Promise<void> {
      try { await fetchImpl(`${base}/me/permissions`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(10_000) }) } catch { /* nothing to do */ }
    },
  }
}

/** Pick automatically when there is exactly one choice; leave it open when the customer has to choose. */
export function autoSelect(c: Pick<StoredConnection, 'adAccounts' | 'pages' | 'wabas'>, prev?: StoredConnection['selected']): StoredConnection['selected'] {
  const keep = (list: Asset[], id: string | null | undefined) => (id && list.some((a) => a.id === id) ? id : list.length === 1 ? list[0]!.id : null)
  return { adAccountId: keep(c.adAccounts, prev?.adAccountId), pageId: keep(c.pages, prev?.pageId), wabaId: keep(c.wabas, prev?.wabaId) }
}
