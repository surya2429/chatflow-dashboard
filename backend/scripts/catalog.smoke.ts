// Run: npx tsx scripts/catalog.smoke.ts  (from backend/)
import assert from 'node:assert/strict'
import { encryptKey } from '../src/ai/aiAssistant.js'
import type { ConnectionStore, StoredConnection } from '../src/ctwa/connect.js'
import { buildFilter, cleanMessage, cleanProduct, fromGraph, matchFilter, toCloudMessage, toFeed } from '../src/catalog/common.js'
import { createCatalogRuntime } from '../src/catalog/runtime.js'

const SECRET = 'connections-secret-123'
const TOKEN = 'EAAB_customer_token_000111222333'
const mem = new Map<string, StoredConnection>()
const connections: ConnectionStore = { load: async (w) => mem.get(w) ?? null, save: async (w, c) => void mem.set(w, c), remove: async (w) => void mem.delete(w) }

const NEW = { retailerId: 'NEW1', name: 'Test lamp', description: 'A lamp', price: 1299.5, currency: 'INR', availability: 'in stock', condition: 'new', imageUrl: 'https://x.test/a.jpg', url: 'https://x.test/p', brand: 'Lumen' }

// ── pure helpers ──
assert.throws(() => cleanProduct({ ...NEW, retailerId: 'bad sku!' }), /fixing/)
assert.throws(() => cleanProduct({ ...NEW, price: 0 }), /fixing/)
assert.throws(() => cleanProduct({ ...NEW, salePrice: 2000 }), /fixing/)
assert.throws(() => cleanProduct({ ...NEW, imageUrl: 'javascript:alert(1)' }), /fixing/)
assert.deepEqual(cleanProduct({ retailerId: 'A1', availability: 'out of stock' }, true), { retailerId: 'A1', availability: 'out of stock' })
const feed = toFeed(cleanProduct({ ...NEW, salePrice: 999, inventory: 4 }))
assert.equal(feed.price, '1299.50 INR'); assert.equal(feed.sale_price, '999.00 INR'); assert.equal(feed.id, 'NEW1'); assert.equal(feed.link, 'https://x.test/p'); assert.equal(feed.quantity_to_sell_on_facebook, 4)
assert.equal(toFeed({ retailerId: 'J', price: 500, currency: 'JPY' }).price, '500 JPY')
const g = fromGraph({ id: '1', retailer_id: 'SKU1', name: 'N', price: '₹4,999.00', sale_price: '₹3,999.00', currency: 'INR', availability: 'out of stock', review_status: 'rejected', review_rejection_reasons: ['text on image'] })
assert.equal(g.price, 4999); assert.equal(g.salePrice, 3999); assert.equal(g.availability, 'out of stock'); assert.equal(g.reviewNote, 'text on image')
assert.throws(() => cleanMessage({ kind: 'products', to: '12', retailerIds: [], body: '' }, 'c1'), /fixing/)
assert.throws(() => cleanMessage({ kind: 'products', to: '919876543210', retailerIds: Array.from({ length: 31 }, (_, i) => `S${i}`), body: 'hi' }, 'c1'), /fixing/)
const multi = toCloudMessage(cleanMessage({ kind: 'products', to: '+91 98765 43210', retailerIds: ['A', 'B', 'A'], body: 'Take a look', header: 'Offers' }, 'c1')) as any
assert.equal(multi.to, '919876543210'); assert.equal(multi.interactive.type, 'product_list'); assert.deepEqual(multi.interactive.action.sections[0].product_items, [{ product_retailer_id: 'A' }, { product_retailer_id: 'B' }])
const one = toCloudMessage(cleanMessage({ kind: 'product', to: '919876543210', retailerIds: ['A'], body: '' }, 'c1')) as any
assert.equal(one.interactive.type, 'product'); assert.equal(one.interactive.action.product_retailer_id, 'A'); assert.equal(one.interactive.body, undefined)
const cat = toCloudMessage(cleanMessage({ kind: 'catalog', to: '919876543210', body: 'Browse', retailerIds: ['A'] }, 'c1')) as any
assert.equal(cat.interactive.action.name, 'catalog_message'); assert.equal(cat.interactive.action.parameters.thumbnail_product_retailer_id, 'A')

// ── sample mode: everything works, nothing leaves the server ──
const sampleRt = createCatalogRuntime({ env: { version: 'v20.0' }, app: null, secret: SECRET, connections })
const base = { workspace: 'w1', query: {} as Record<string, string> }
const call = (rt: ReturnType<typeof createCatalogRuntime>, method: string, path: string, body: any = {}, query: Record<string, string> = {}) => rt.handle({ ...base, method, path, body, query }) as Promise<{ status: number; body: any }>

let r = await call(sampleRt, 'GET', '/status')
assert.equal(r.body.mode, 'sample'); assert.equal(r.body.catalogs.length, 1); assert.equal(r.body.connectedId, null); assert.equal(r.body.commerce['sample-phone'].isCatalogVisible, false)
const CAT = 'sample-catalog'
r = await call(sampleRt, 'GET', '/products', {}, { catalog: CAT })
assert.equal(r.body.products.length, 16)
assert.equal(r.body.products.filter((p: any) => p.groupId === 'TSHIRT').length, 3)
r = await call(sampleRt, 'POST', '/products', { catalog: CAT, product: NEW }); assert.equal(r.status, 201)
r = await call(sampleRt, 'POST', '/products', { catalog: CAT, product: { ...NEW, price: -1 } }); assert.equal(r.status, 400); assert.ok(r.body.fields.price)
r = await call(sampleRt, 'PATCH', '/products', { catalog: CAT, product: { retailerId: 'NEW1', availability: 'out of stock' } }); assert.equal(r.status, 200)
r = await call(sampleRt, 'GET', '/products', {}, { catalog: CAT })
assert.equal(r.body.products.length, 17); assert.equal(r.body.products.find((p: any) => p.retailerId === 'NEW1').availability, 'out of stock')
r = await call(sampleRt, 'POST', '/products/import', { catalog: CAT, products: [{ ...NEW, retailerId: 'IMP1' }, { ...NEW, retailerId: 'IMP1' }, { ...NEW, retailerId: 'IMP2', price: 'abc' }, { ...NEW, retailerId: 'SP001', price: 7000 }] })
assert.equal(r.body.sent, 2); assert.equal(r.body.invalid.length, 2); assert.equal(r.body.invalid[0].row, 2)
r = await call(sampleRt, 'DELETE', '/products', {}, { catalog: CAT, id: 'NEW1' }); assert.equal(r.status, 200)
r = await call(sampleRt, 'DELETE', '/products', {}, { catalog: CAT, id: '../etc' }); assert.equal(r.status, 400)
r = await call(sampleRt, 'POST', '/send', { catalog: CAT, phoneNumberId: 'sample-phone', kind: 'catalog', to: '919876543210', body: 'Browse' }); assert.equal(r.status, 409)
r = await call(sampleRt, 'POST', '/whatsapp', { catalog: CAT }); assert.equal(r.status, 200)
r = await call(sampleRt, 'POST', '/commerce', { phoneNumberId: 'sample-phone', isCatalogVisible: true }); assert.equal(r.body.commerce.isCatalogVisible, true)
r = await call(sampleRt, 'POST', '/send', { catalog: CAT, phoneNumberId: 'sample-phone', kind: 'products', to: '919876543210', retailerIds: ['SP001', 'SP002'], body: 'Offers' }); assert.equal(r.body.simulated, true)
r = await call(sampleRt, 'POST', '/send', { catalog: CAT, phoneNumberId: 'sample-phone', kind: 'product', to: '919876543210', retailerIds: ['NOPE'] }); assert.equal(r.status, 400)
r = await call(sampleRt, 'POST', '/catalogs', { name: 'Summer' }); assert.equal(r.status, 201)

// bulk actions
r = await call(sampleRt, 'POST', '/products/bulk', { catalog: CAT, retailerIds: ['SP002', 'SP002-S'], action: 'out of stock' }); assert.equal(r.body.sent, 2)
r = await call(sampleRt, 'GET', '/products', {}, { catalog: CAT }); assert.equal(r.body.products.filter((p: any) => p.groupId === 'TSHIRT' && p.availability === 'out of stock').length, 3)
r = await call(sampleRt, 'POST', '/products/bulk', { catalog: CAT, retailerIds: ['SP005'], action: 'explode' }); assert.equal(r.status, 400)
// supplementary data: only existing products change, with only the columns given
r = await call(sampleRt, 'POST', '/products/import', { catalog: CAT, mode: 'update', products: [{ retailerId: 'SP005', brand: 'Bean Co', size: '250g' }, { retailerId: 'GHOST', brand: 'X' }, { retailerId: 'SP006' }] })
assert.equal(r.body.sent, 1); assert.equal(r.body.errors.length, 1); assert.equal(r.body.invalid.length, 1)
r = await call(sampleRt, 'GET', '/products', {}, { catalog: CAT }); const sp5 = r.body.products.find((p: any) => p.retailerId === 'SP005'); assert.equal(sp5.brand, 'Bean Co'); assert.equal(sp5.price, 649); assert.equal(sp5.size, '250g')
assert.equal(r.body.products.some((p: any) => p.retailerId === 'GHOST'), false)
// product sets
r = await call(sampleRt, 'GET', '/sets', {}, { catalog: CAT }); assert.equal(r.body.sets[0].name, 'All Products'); assert.equal(r.body.sets[0].productCount, r.body.products?.length ?? r.body.sets[0].productCount)
r = await call(sampleRt, 'POST', '/sets', { catalog: CAT, name: 'Shoes', rules: { name: 'running' } }); assert.equal(r.status, 201); assert.equal(r.body.set.productCount, 3)
const shoesId = r.body.set.id
r = await call(sampleRt, 'GET', '/sets/products', {}, { set: shoesId }); assert.equal(r.body.products.length, 3)
r = await call(sampleRt, 'POST', '/sets', { catalog: CAT, name: 'Picks', retailerIds: ['SP001', 'SP003'] }); assert.equal(r.body.set.productCount, 2)
r = await call(sampleRt, 'POST', '/sets', { catalog: CAT, name: 'Empty' }); assert.equal(r.status, 400)
r = await call(sampleRt, 'DELETE', '/sets', {}, { catalog: CAT, id: shoesId }); assert.equal(r.status, 200)
r = await call(sampleRt, 'DELETE', '/sets', {}, { catalog: CAT, id: 'set-all' }); assert.equal(r.status, 400)
assert.deepEqual(buildFilter({ retailerIds: ['A', 'B', 'A', 'bad id'] }), { retailer_id: { is_any: ['A', 'B'] } })
assert.deepEqual(buildFilter({ rules: { name: 'shirt', brand: 'Terra' } }), { and: [{ name: { i_contains: 'shirt' } }, { brand: { eq: 'Terra' } }] })
assert.equal(matchFilter({ name: 'Red Shirt', brand: 'Terra' } as any, { and: [{ name: { i_contains: 'shirt' } }, { brand: { eq: 'Terra' } }] }), true)

// ── live mode: the exact requests Meta receives ──
mem.set('w1', { tokenEnc: encryptKey(TOKEN, SECRET), userName: 'Owner', businessId: '4242', adAccounts: [], pages: [], wabas: [{ id: '999', name: 'WABA' }], datasetId: null, selected: { adAccountId: null, pageId: null, wabaId: '999' }, connectedAt: new Date().toISOString() })
interface Call { method: string; path: string; query: URLSearchParams; body: string; auth?: string; ctype?: string }
const calls: Call[] = []
let batchErrors: any[] = []
const reply = (o: unknown, status = 200) => ({ ok: status < 300, status, json: async () => o }) as Response
const fetchImpl = (async (url: string, init: any = {}) => {
  const u = new URL(url); const path = u.pathname.replace('/v20.0/', '')
  calls.push({ method: init.method ?? 'GET', path, query: u.searchParams, body: init.body ?? '', auth: init.headers?.Authorization, ctype: init.headers?.['Content-Type'] })
  if (path === '4242/owned_product_catalogs') return init.method === 'POST' ? reply({ id: '777' }) : reply({ data: [{ id: '555' }] })
  if (path === '555') return reply({ id: '555', name: 'Main', product_count: '2', vertical: 'commerce' })
  if (path === '999/product_catalogs') return init.method === 'POST' ? reply({ success: true }) : reply({ data: [{ id: '555' }] })
  if (path === '555/products') return reply({ data: [{ id: 'm1', retailer_id: 'SKU1', name: 'One', price: '₹100.00', currency: 'INR', availability: 'in stock', condition: 'new', review_status: 'approved' }], paging: { cursors: { after: 'abc' }, next: 'https://graph.facebook.com/next' } })
  if (path === '555/items_batch') return reply({ handles: ['h1'], validation_status: batchErrors })
  if (path === '555/product_sets') return init.method === 'POST' ? reply({ id: 'set9' }) : reply({ data: [{ id: 'set1', name: 'All Products', product_count: '2' }] })
  if (path === 'set9') return reply({ success: true })
  if (path === '999/phone_numbers') return reply({ data: [{ id: '888', display_phone_number: '+91 98765 43210', verified_name: 'Shop' }] })
  if (path === '888/whatsapp_commerce_settings') return init.method === 'POST' ? reply({ success: true }) : reply({ data: [{ is_cart_enabled: true, is_catalog_visible: true, id: '1' }] })
  if (path === '888/messages') return reply({ messages: [{ id: 'wamid.1' }] })
  if (path === 'me/permissions') return reply({ success: true })
  return reply({ error: { message: 'unexpected ' + path } }, 400)
}) as any
const liveRt = createCatalogRuntime({ env: { version: 'v20.0' }, app: null, secret: SECRET, connections, fetchImpl })

r = await call(liveRt, 'GET', '/status')
assert.equal(r.body.mode, 'live'); assert.equal(r.body.catalogs[0].id, '555'); assert.equal(r.body.catalogs[0].productCount, 2); assert.equal(r.body.connectedId, '555'); assert.equal(r.body.commerce['888'].isCatalogVisible, true)
assert.ok(calls.every((c) => c.auth === `Bearer ${TOKEN}`), 'the token travels in the Authorization header')
assert.ok(calls.every((c) => !c.query.has('access_token') && !c.body.includes(TOKEN)), 'never in the URL or body')

r = await call(liveRt, 'GET', '/products', {}, { catalog: '555' })
assert.equal(r.body.products[0].price, 100); assert.equal(r.body.products.length >= 1, true)
assert.ok(calls.some((c) => c.path === '555/products' && c.query.get('fields')?.includes('retailer_id')))

calls.length = 0
r = await call(liveRt, 'POST', '/products', { catalog: '555', product: NEW }); assert.equal(r.status, 201)
let b = calls.find((c) => c.path === '555/items_batch')!
assert.equal(b.ctype, 'application/x-www-form-urlencoded')
const form = new URLSearchParams(b.body)
assert.equal(form.get('item_type'), 'PRODUCT_ITEM')
const reqs = JSON.parse(form.get('requests')!)
assert.equal(reqs[0].method, 'CREATE'); assert.equal(reqs[0].data.id, 'NEW1'); assert.equal(reqs[0].data.price, '1299.50 INR'); assert.equal(reqs[0].data.title, 'Test lamp')

calls.length = 0
await call(liveRt, 'DELETE', '/products', {}, { catalog: '555', id: 'NEW1' })
assert.deepEqual(JSON.parse(new URLSearchParams(calls.find((c) => c.path === '555/items_batch')!.body).get('requests')!), [{ method: 'DELETE', data: { id: 'NEW1' } }])

batchErrors = [{ retailer_id: 'NEW1', errors: [{ message: 'Image is too small' }], warnings: [] }]
r = await call(liveRt, 'POST', '/products', { catalog: '555', product: NEW }); assert.equal(r.status, 422); assert.match(r.body.message, /Image is too small/)
batchErrors = []

calls.length = 0
r = await call(liveRt, 'GET', '/sets', {}, { catalog: '555' }); assert.deepEqual(r.body.sets, [{ id: 'set1', name: 'All Products', productCount: 2 }])
await call(liveRt, 'POST', '/sets', { catalog: '555', name: 'Picks', retailerIds: ['A', 'B'] })
assert.deepEqual(Object.fromEntries(new URLSearchParams(calls.find((c) => c.path === '555/product_sets' && c.method === 'POST')!.body)), { name: 'Picks', filter: '{"retailer_id":{"is_any":["A","B"]}}' })
await call(liveRt, 'DELETE', '/sets', {}, { catalog: '555', id: 'set9' }); assert.ok(calls.some((c) => c.method === 'DELETE' && c.path === 'set9'))
calls.length = 0
await call(liveRt, 'POST', '/products/import', { catalog: '555', mode: 'update', products: [{ retailerId: 'SKU1', brand: 'New brand' }] })
assert.equal(new URLSearchParams(calls.find((c) => c.path === '555/items_batch')!.body).get('allow_upsert'), 'false')
calls.length = 0
await call(liveRt, 'POST', '/commerce', { phoneNumberId: '888', isCatalogVisible: true })
assert.equal(calls.find((c) => c.method === 'POST')!.query.get('is_catalog_visible'), 'true')
await call(liveRt, 'POST', '/whatsapp', { catalog: '555' })
assert.equal(new URLSearchParams(calls.find((c) => c.path === '999/product_catalogs' && c.method === 'POST')!.body).get('catalog_id'), '555')
await call(liveRt, 'POST', '/catalogs', { name: 'Summer' })
assert.deepEqual(Object.fromEntries(new URLSearchParams(calls.find((c) => c.path === '4242/owned_product_catalogs' && c.method === 'POST')!.body)), { name: 'Summer', vertical: 'commerce' })

calls.length = 0
r = await call(liveRt, 'POST', '/send', { catalog: '555', phoneNumberId: '888', kind: 'product', to: '919876543210', retailerIds: ['SKU1'], body: 'This one?' })
assert.equal(r.body.id, 'wamid.1')
const sent = JSON.parse(calls.find((c) => c.path === '888/messages')!.body)
assert.equal(sent.interactive.action.catalog_id, '555'); assert.equal(sent.interactive.action.product_retailer_id, 'SKU1'); assert.equal(sent.messaging_product, 'whatsapp')

// a permission problem is explained, not a bare 500
const denied = createCatalogRuntime({ env: { version: 'v20.0' }, app: null, secret: SECRET, connections, fetchImpl: (async () => reply({ error: { code: 200, message: '(#200) requires catalog_management permission' } }, 403)) as any })
r = await call(denied, 'GET', '/products', {}, { catalog: '555' }); assert.equal(r.status, 403); assert.equal(r.body.error, 'permission')
r = await call(denied, 'GET', '/status'); assert.equal(r.status, 200); assert.equal(r.body.problem.code, 'permission')

console.log('catalog smoke: ok')
