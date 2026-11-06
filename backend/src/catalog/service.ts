// service.ts — the HTTP-shaped entry point of the catalog section, shared by the Express route and the Vite dev server.
//   GET  /status                       catalogs, which one WhatsApp uses, phone numbers and their commerce settings
//   POST /catalogs {name}              create a catalog
//   GET  /products?catalog=            the catalog's products
//   POST /products {catalog, product}  add · PATCH same: change (partial) · DELETE /products?catalog=&id=
//   POST /products/import {catalog, products[]}   add or update many (CSV)
//   POST /whatsapp {catalog}           connect the catalog to the WhatsApp Business account
//   POST /commerce {phoneNumberId, isCatalogVisible?, isCartEnabled?}
//   POST /send {catalog, kind, to, ...} share products or the catalog in a WhatsApp chat
import { cleanMessage, cleanProduct, SKU } from './common.js'
import { CatalogError, type CatalogBackend } from './types.js'

export interface CatalogRequest { method: string; path: string; query: Record<string, string>; body: Record<string, unknown> }

const ID = /^[A-Za-z0-9_\-]{1,60}$/
const MAX_IMPORT = 1000

const catalogId = (v: unknown) => { const s = String(v ?? ''); if (!ID.test(s)) throw new CatalogError('Choose a catalog first.', 400, 'invalid_request'); return s }
const object = (v: unknown) => (v && typeof v === 'object' ? (v as Record<string, unknown>) : {})

export async function handleCatalogRequest(req: CatalogRequest, b: CatalogBackend): Promise<{ status: number; body: unknown }> {
  try {
    const { method, body } = req
    const seg = req.path.replace(/^\/+|\/+$/g, '').split('/')

    if (method === 'GET' && seg[0] === 'status') {
      // each part can fail on its own (no permission, no WhatsApp account yet): the page still opens and says which
      const settle = async <T>(p: Promise<T>, fallback: T): Promise<[T, { code: string; message: string } | null]> => p.then((v): [T, null] => [v, null]).catch((e) => [fallback, e instanceof CatalogError ? { code: e.code, message: e.message } : { code: 'error', message: 'Something went wrong.' }])
      const [cat, problem] = await settle(b.catalogs(), { catalogs: [], connectedId: null, canCreate: false })
      const [phones, waProblem] = await settle(b.phoneNumbers(), [])
      const commerce: Record<string, unknown> = {}
      await Promise.all(phones.slice(0, 5).map(async (p) => { try { commerce[p.id] = await b.commerce(p.id) } catch { /* shown as unknown */ } }))
      return { status: 200, body: { mode: b.mode, ...cat, phoneNumbers: phones, commerce, problem, waProblem } }
    }

    if (method === 'POST' && seg[0] === 'catalogs') {
      const name = typeof body.name === 'string' ? body.name.trim().slice(0, 100) : ''
      if (name.length < 2) throw new CatalogError('Give the catalog a name.', 400, 'invalid_request', { name: 'Give the catalog a name (at least 2 characters).' })
      return { status: 201, body: { ok: true, catalog: await b.createCatalog(name) } }
    }

    if (seg[0] === 'products') {
      if (method === 'GET' && seg.length === 1) {
        const id = catalogId(req.query.catalog)
        return { status: 200, body: { mode: b.mode, catalogId: id, ...(await b.products(id)) } }
      }
      if (method === 'POST' && seg[1] === 'import') {
        const id = catalogId(body.catalog)
        const rows = Array.isArray(body.products) ? body.products : []
        if (!rows.length) throw new CatalogError('The file has no products.', 400, 'invalid_request')
        if (rows.length > MAX_IMPORT) throw new CatalogError(`Import up to ${MAX_IMPORT} products at a time.`, 400, 'invalid_request')
        const good: ReturnType<typeof cleanProduct>[] = [], invalid: { row: number; retailerId: string; message: string }[] = []
        const seen = new Set<string>()
        rows.forEach((r, i) => {
          try {
            const p = cleanProduct(r)
            if (seen.has(p.retailerId)) throw new CatalogError('This SKU appears twice in the file.')
            seen.add(p.retailerId); good.push(p)
          } catch (e) { invalid.push({ row: i + 1, retailerId: String(object(r).retailerId ?? ''), message: e instanceof CatalogError ? (e.fields ? Object.values(e.fields).join(' ') : e.message) : 'Invalid row.' }) }
        })
        // UPDATE with upsert: products that exist are changed, new ones are added, so the same file can be imported again
        const r = good.length ? await b.write(id, good.map((product) => ({ method: 'UPDATE' as const, product }))) : { sent: 0, errors: [], warnings: [] }
        return { status: 200, body: { ok: true, ...r, invalid } }
      }
      if (method === 'POST' && seg.length === 1) {
        const r = await b.write(catalogId(body.catalog), [{ method: 'CREATE', product: cleanProduct(body.product) }])
        if (r.errors.length) throw new CatalogError(r.errors[0]!.message, 422, 'meta_rejected')
        return { status: 201, body: { ok: true, ...r } }
      }
      if (method === 'PATCH' && seg.length === 1) {
        const r = await b.write(catalogId(body.catalog), [{ method: 'UPDATE', product: cleanProduct(body.product, true) }])
        if (r.errors.length) throw new CatalogError(r.errors[0]!.message, 422, 'meta_rejected')
        return { status: 200, body: { ok: true, ...r } }
      }
      if (method === 'DELETE' && seg.length === 1) {
        const retailerId = String(req.query.id ?? '')
        if (!SKU.test(retailerId)) throw new CatalogError('That product id is not valid.', 400, 'invalid_request')
        await b.write(catalogId(req.query.catalog), [{ method: 'DELETE', product: { retailerId } }])
        return { status: 200, body: { ok: true } }
      }
    }

    if (method === 'POST' && seg[0] === 'whatsapp') {
      await b.connectToWhatsApp(catalogId(body.catalog))
      return { status: 200, body: { ok: true } }
    }

    if (method === 'POST' && seg[0] === 'commerce') {
      const phone = String(body.phoneNumberId ?? '')
      if (!ID.test(phone)) throw new CatalogError('Choose a WhatsApp number.', 400, 'invalid_request')
      const patch: { isCatalogVisible?: boolean; isCartEnabled?: boolean } = {}
      if (typeof body.isCatalogVisible === 'boolean') patch.isCatalogVisible = body.isCatalogVisible
      if (typeof body.isCartEnabled === 'boolean') patch.isCartEnabled = body.isCartEnabled
      if (!Object.keys(patch).length) throw new CatalogError('Nothing to change.', 400, 'invalid_request')
      return { status: 200, body: { ok: true, commerce: await b.setCommerce(phone, patch) } }
    }

    if (method === 'POST' && seg[0] === 'send') {
      const phone = String(body.phoneNumberId ?? '')
      if (!ID.test(phone)) throw new CatalogError('Choose the WhatsApp number to send from.', 400, 'invalid_request')
      const sent = await b.send(phone, cleanMessage(body, catalogId(body.catalog)))
      return { status: 200, body: { ok: true, ...sent } }
    }

    return { status: 404, body: { error: 'not_found', message: 'Unknown catalog endpoint.' } }
  } catch (err) {
    if (err instanceof CatalogError) return { status: err.status, body: { error: err.code, message: err.message, ...(err.fields ? { fields: err.fields } : {}) } }
    throw err
  }
}
