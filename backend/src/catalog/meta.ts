// meta.ts — the live catalog backend: Meta's Graph API for catalogs, products and WhatsApp commerce settings.
//   catalogs   GET  /{business}/owned_product_catalogs · POST same (name, vertical) · shared ones from debug_token (catalog_management)
//   products   GET  /{catalog}/products · POST /{catalog}/items_batch (item_type=PRODUCT_ITEM, requests=[{method,data}])
//   WhatsApp   GET/POST /{waba}/product_catalogs · GET/POST /{phone}/whatsapp_commerce_settings · POST /{phone}/messages
// The token is the customer's (from the Facebook popup) or the server's; it goes in the Authorization header only.
import { fromGraph, toCloudMessage, toFeed } from './common.js'
import { CatalogError, type BatchResult, type CatalogBackend, type CatalogInfo, type Commerce, type OutMessage, type Product, type ProductSet, type WriteOp } from './types.js'

export interface MetaCatalogConfig {
  token: string
  version: string
  businessId?: string | null
  wabaId?: string | null
  /** a catalog fixed by the server settings: the only one offered */
  fixedCatalogId?: string | null
  /** the app, to ask Meta which catalogs the customer shared in the popup */
  app?: { appId: string; appSecret: string } | null
  fetchImpl?: typeof fetch
}

const PRODUCT_FIELDS = 'retailer_id,name,description,price,sale_price,currency,availability,condition,image_url,url,brand,inventory,review_status,review_rejection_reasons,item_group_id,size,color'
const MAX_PRODUCTS = 3000         // shortcut: the screen loads the first 3,000 products (15 calls); upgrade to server-side paging and search beyond that
const PAGE = 200
const BATCH = 500                 // items per items_batch call (Meta allows 5000, recommends under 3000)
const ID = /^\d{3,25}$/

export function createMetaCatalog(c: MetaCatalogConfig): CatalogBackend {
  const base = `https://graph.facebook.com/${c.version}`
  const f = c.fetchImpl ?? fetch

  async function graph(method: 'GET' | 'POST' | 'DELETE', path: string, o: { query?: Record<string, string>; form?: Record<string, string>; json?: unknown; bearer?: string } = {}): Promise<any> {
    const url = new URL(`${base}/${path}`)
    for (const [k, v] of Object.entries(o.query ?? {})) url.searchParams.set(k, v)
    const headers: Record<string, string> = { Authorization: `Bearer ${o.bearer ?? c.token}` }
    let body: string | undefined
    if (o.form) { headers['Content-Type'] = 'application/x-www-form-urlencoded'; body = new URLSearchParams(o.form).toString() }
    else if (o.json) { headers['Content-Type'] = 'application/json'; body = JSON.stringify(o.json) }
    let res: Response
    try { res = await f(url.toString(), { method, headers, body, signal: AbortSignal.timeout(30_000) }) }
    catch { throw new CatalogError('Could not reach Meta. Try again in a moment.', 502, 'meta_unreachable') }
    const json = (await res.json().catch(() => ({}))) as any
    if (res.ok && !json.error) return json
    const e = json.error ?? {}
    const text = String(e.error_user_msg || e.message || `Meta returned ${res.status}`)
    if (e.code === 190) throw new CatalogError('Your Facebook login has expired. Connect Facebook again.', 401, 'login_expired')
    if (e.code === 200 || e.code === 10 || e.code === 299 || /permission/i.test(text)) throw new CatalogError(`Meta did not allow this. The Facebook connection needs the catalog_management and business_management permissions (and access to the catalog). Reconnect Facebook and share the catalog. Meta said: ${text}`, 403, 'permission')
    if ([4, 17, 32, 613, 80014].includes(e.code)) throw new CatalogError('Meta is limiting requests right now. Wait a minute and try again.', 429, 'rate_limited')
    throw new CatalogError(text, res.status === 400 ? 400 : 502, 'meta_error')
  }

  const catalogOf = async (id: string): Promise<CatalogInfo | null> => {
    try { const r = await graph('GET', id, { query: { fields: 'id,name,product_count,vertical' } }); return { id: String(r.id), name: String(r.name ?? `Catalog ${id}`), productCount: Number.isFinite(Number(r.product_count)) ? Number(r.product_count) : null, vertical: r.vertical ? String(r.vertical) : null } }
    catch (e) { if (e instanceof CatalogError && e.code === 'login_expired') throw e; return null }       // a shared catalog this token cannot read is left out, never trusted
  }

  async function businessId(): Promise<string | null> {
    if (c.businessId) return c.businessId
    try { const r = await graph('GET', 'me/businesses', { query: { fields: 'id', limit: '5' } }); return r.data?.length === 1 ? String(r.data[0].id) : null } catch { return null }
  }

  async function wabaCatalogId(): Promise<string | null> {
    if (!c.wabaId) return null
    try { const r = await graph('GET', `${c.wabaId}/product_catalogs`, { query: { fields: 'id', limit: '1' } }); return r.data?.[0]?.id ? String(r.data[0].id) : null } catch { return null }
  }

  return {
    mode: 'live',

    async catalogs() {
      const ids = new Set<string>()
      let denied: CatalogError | null = null
      if (c.fixedCatalogId) ids.add(c.fixedCatalogId)
      else {
        const biz = await businessId()
        if (biz) { try { const r = await graph('GET', `${biz}/owned_product_catalogs`, { query: { fields: 'id', limit: '50' } }); for (const x of r.data ?? []) ids.add(String(x.id)) } catch (e) { if (!(e instanceof CatalogError && e.code === 'permission')) throw e; denied = e } }
        if (c.app) {
          try {
            const dbg = await graph('GET', 'debug_token', { query: { input_token: c.token }, bearer: `${c.app.appId}|${c.app.appSecret}` })
            for (const g of dbg.data?.granular_scopes ?? []) if (g.scope === 'catalog_management') for (const t of g.target_ids ?? []) if (ID.test(String(t))) ids.add(String(t))
          } catch { /* the business's own catalogs may be all there is */ }
        }
      }
      const [list, connectedId] = await Promise.all([Promise.all([...ids].slice(0, 25).map(catalogOf)), wabaCatalogId()])
      const catalogs = list.filter((x): x is CatalogInfo => x !== null)
      if (!catalogs.length && !ids.size) {
        if (denied) throw denied
        // nothing came back at all: say why instead of showing an empty page
        throw new CatalogError('No catalog was shared with this connection. Reconnect Facebook, make sure catalog_management is requested, and choose your catalog (or create one here).', 404, 'no_catalogs')
      }
      return { catalogs, connectedId, canCreate: !c.fixedCatalogId && !!(await businessId()) }
    },

    async createCatalog(name) {
      const biz = await businessId()
      if (!biz) throw new CatalogError('Could not tell which Meta business to create the catalog in. Reconnect Facebook and select your business.', 409, 'no_business')
      const r = await graph('POST', `${biz}/owned_product_catalogs`, { form: { name, vertical: 'commerce' } })
      return { id: String(r.id), name, productCount: 0, vertical: 'commerce' }
    },

    async connectToWhatsApp(catalogId) {
      if (!c.wabaId) throw new CatalogError('No WhatsApp Business account is connected. Reconnect Facebook and share it.', 409, 'no_waba')
      await graph('POST', `${c.wabaId}/product_catalogs`, { form: { catalog_id: catalogId } })
    },

    async products(catalogId) {
      const out: Product[] = []
      let after = ''
      while (out.length < MAX_PRODUCTS) {
        const r = await graph('GET', `${catalogId}/products`, { query: { fields: PRODUCT_FIELDS, limit: String(PAGE), ...(after ? { after } : {}) } })
        for (const row of r.data ?? []) out.push(fromGraph(row))
        after = r.paging?.next ? String(r.paging.cursors?.after ?? '') : ''
        if (!after) return { products: out, truncated: false }
      }
      return { products: out.slice(0, MAX_PRODUCTS), truncated: true }
    },

    async write(catalogId, ops, opts = {}) {
      const res: BatchResult = { sent: 0, errors: [], warnings: [] }
      for (let i = 0; i < ops.length; i += BATCH) {
        const chunk = ops.slice(i, i + BATCH)
        const requests = chunk.map((o: WriteOp) => ({ method: o.method, data: o.method === 'DELETE' ? { id: o.product.retailerId } : toFeed(o.product) }))
        const r = await graph('POST', `${catalogId}/items_batch`, { form: { item_type: 'PRODUCT_ITEM', requests: JSON.stringify(requests), ...(opts.allowUpsert === false ? { allow_upsert: 'false' } : {}) } })
        // the batch is processed on Meta's side; per-row problems it finds up front come back as validation_status
        const bad = new Set<string>()
        for (const v of r.validation_status ?? []) {
          for (const e of v.errors ?? []) { res.errors.push({ retailerId: String(v.retailer_id ?? ''), message: String(e.message ?? 'Meta rejected this product.') }); bad.add(String(v.retailer_id ?? '')) }
          for (const w of v.warnings ?? []) res.warnings.push({ retailerId: String(v.retailer_id ?? ''), message: String(w.message ?? '') })
        }
        res.sent += chunk.filter((o) => !bad.has(o.product.retailerId)).length
      }
      return res
    },

    async sets(catalogId) {
      const r = await graph('GET', `${catalogId}/product_sets`, { query: { fields: 'id,name,product_count', limit: '100' } })
      return (r.data ?? []).map((s: any): ProductSet => ({ id: String(s.id), name: String(s.name ?? ''), productCount: Number.isFinite(Number(s.product_count)) ? Number(s.product_count) : null }))
    },

    async createSet(catalogId, name, filter) {
      const r = await graph('POST', `${catalogId}/product_sets`, { form: { name, filter: JSON.stringify(filter) } })
      return { id: String(r.id), name, productCount: null }
    },

    async deleteSet(setId) { await graph('DELETE', setId) },

    async phoneNumbers() {
      if (!c.wabaId) return []
      const r = await graph('GET', `${c.wabaId}/phone_numbers`, { query: { fields: 'id,display_phone_number,verified_name', limit: '10' } })
      return (r.data ?? []).map((p: any) => ({ id: String(p.id), display: String(p.display_phone_number ?? p.id), name: String(p.verified_name ?? '') }))
    },

    async commerce(phoneNumberId) {
      const r = await graph('GET', `${phoneNumberId}/whatsapp_commerce_settings`)
      const s = r.data?.[0] ?? {}
      return { isCatalogVisible: !!s.is_catalog_visible, isCartEnabled: s.is_cart_enabled !== false }
    },

    async setCommerce(phoneNumberId, patch) {
      const query: Record<string, string> = {}
      if (patch.isCatalogVisible !== undefined) query.is_catalog_visible = String(patch.isCatalogVisible)
      if (patch.isCartEnabled !== undefined) query.is_cart_enabled = String(patch.isCartEnabled)
      await graph('POST', `${phoneNumberId}/whatsapp_commerce_settings`, { query })
      return this.commerce(phoneNumberId)
    },

    async send(phoneNumberId, m: OutMessage) {
      const r = await graph('POST', `${phoneNumberId}/messages`, { json: toCloudMessage(m) })
      return { id: r.messages?.[0]?.id ? String(r.messages[0].id) : null, simulated: false }
    },
  }
}

export type { Commerce }
