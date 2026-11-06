// common.ts — validating products and messages, and translating to / from Meta's field names. Pure.
import { AVAILABILITY, CONDITIONS, CatalogError, type OutMessage, type Product } from './types.js'

const str = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().slice(0, max) : '')
const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : typeof v === 'string' && v.trim() !== '' && Number.isFinite(Number(v)) ? Number(v) : NaN)

export const SKU = /^[A-Za-z0-9_.\-]{1,100}$/
export const WA_TO = /^\d{8,15}$/
const CURRENCY = /^[A-Z]{3}$/
/** Currencies written without decimals in a catalog price. */
const ZERO_DECIMAL = new Set(['JPY', 'KRW', 'VND', 'CLP', 'PYG', 'UGX', 'XAF', 'XOF', 'XPF', 'RWF', 'KMF', 'GNF', 'DJF', 'BIF', 'VUV'])
const priceText = (n: number, cur: string) => `${ZERO_DECIMAL.has(cur) ? Math.round(n) : n.toFixed(2)} ${cur}`

/** A product from the form (partial: only the fields present are checked, for edits and stock toggles). Throws 400 with a message per bad field. */
export function cleanProduct(raw: unknown, partial = false): Partial<Product> & { retailerId: string } {
  const b = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>
  const f: Record<string, string> = {}
  const has = (k: string) => !partial || b[k] !== undefined
  const out: Partial<Product> & { retailerId: string } = { retailerId: str(b.retailerId, 100) }
  if (!SKU.test(out.retailerId)) f.retailerId = 'Enter a SKU of up to 100 letters, numbers, dashes, dots or underscores.'

  if (has('name')) { out.name = str(b.name, 200); if (!out.name) f.name = 'Enter the product name.' }
  if (has('description')) { out.description = str(b.description, 9999); if (!out.description) f.description = 'Add a short description.' }
  if (has('price') || has('currency')) {
    const price = num(b.price), cur = str(b.currency, 3).toUpperCase()
    if (!(price > 0) || price > 100_000_000) f.price = 'Enter a price above 0.'
    if (!CURRENCY.test(cur)) f.currency = 'Use a 3-letter currency code such as INR or USD.'
    out.price = price; out.currency = cur
  }
  if (b.salePrice !== undefined && b.salePrice !== null && b.salePrice !== '') {
    const s = num(b.salePrice)
    if (!(s > 0) || (out.price !== undefined && s >= out.price)) f.salePrice = 'The sale price must be above 0 and lower than the price.'
    out.salePrice = s
  } else if (b.salePrice !== undefined) out.salePrice = null
  if (has('availability')) { if ((AVAILABILITY as readonly unknown[]).includes(b.availability)) out.availability = b.availability as Product['availability']; else f.availability = 'Choose in stock or out of stock.' }
  if (has('condition')) { if ((CONDITIONS as readonly unknown[]).includes(b.condition)) out.condition = b.condition as Product['condition']; else f.condition = 'Choose new, refurbished or used.' }
  if (has('imageUrl')) { out.imageUrl = str(b.imageUrl, 2000); if (!/^https?:\/\/[^\s]+$/i.test(out.imageUrl)) f.imageUrl = 'Add a link to the product image (https://…, JPEG or PNG, at least 500 × 500 px).' }
  if (has('url')) { out.url = str(b.url, 2000); if (!/^https?:\/\/[^\s]+$/i.test(out.url)) f.url = 'Add the link to the product page (https://…).' }
  if (has('brand')) { out.brand = str(b.brand, 100); if (!out.brand) f.brand = 'Enter the brand.' }
  if (b.inventory !== undefined && b.inventory !== null && b.inventory !== '') {
    const n = num(b.inventory)
    if (!Number.isInteger(n) || n < 0 || n > 10_000_000) f.inventory = 'Stock must be a whole number, 0 or more.'
    out.inventory = n
  } else if (b.inventory !== undefined) out.inventory = null

  if (Object.keys(f).length) throw new CatalogError('Some details need fixing.', 400, 'invalid_request', f)
  return out
}

/** Our product → the field names the Catalog Batch API takes in `data` (the catalog feed names). */
export function toFeed(p: Partial<Product> & { retailerId: string }): Record<string, string | number> {
  const d: Record<string, string | number> = { id: p.retailerId }
  if (p.name !== undefined) d.title = p.name
  if (p.description !== undefined) d.description = p.description
  if (p.availability !== undefined) d.availability = p.availability
  if (p.condition !== undefined) d.condition = p.condition
  if (p.price !== undefined && p.currency) d.price = priceText(p.price, p.currency)
  if (p.salePrice != null && p.currency) d.sale_price = priceText(p.salePrice, p.currency)
  if (p.url !== undefined) d.link = p.url
  if (p.imageUrl !== undefined) d.image_link = p.imageUrl
  if (p.brand !== undefined) d.brand = p.brand
  if (p.inventory != null) d.quantity_to_sell_on_facebook = p.inventory
  return d
}

/** Meta's price text ("₹4,999.00", "4999.00 INR") → a number. shortcut: assumes a "." decimal point, which is what the Graph API sends; upgrade if a currency ever comes back with a comma decimal. */
export const parsePrice = (v: unknown): number | null => { const n = parseFloat(String(v ?? '').replace(/[^\d.]/g, '')); return Number.isFinite(n) ? n : null }

/** A row of GET /{catalog}/products → Product. */
export function fromGraph(r: Record<string, any>): Product {
  const price = parsePrice(r.price)
  const sale = parsePrice(r.sale_price)
  const cur = String(r.currency || String(r.price ?? '').match(/[A-Z]{3}/)?.[0] || 'INR')
  const rejected = Array.isArray(r.review_rejection_reasons) ? r.review_rejection_reasons.join(', ') : ''
  return {
    retailerId: String(r.retailer_id ?? r.id), name: String(r.name ?? ''), description: String(r.description ?? ''),
    price: price ?? 0, currency: cur, salePrice: sale && price && sale < price ? sale : null,
    availability: String(r.availability).includes('out') ? 'out of stock' : 'in stock',
    condition: (CONDITIONS as readonly string[]).includes(r.condition) ? r.condition : 'new',
    imageUrl: String(r.image_url ?? ''), url: String(r.url ?? ''), brand: String(r.brand ?? ''),
    inventory: Number.isFinite(Number(r.inventory)) && r.inventory !== null && r.inventory !== undefined ? Number(r.inventory) : null,
    reviewStatus: String(r.review_status ?? ''), reviewNote: rejected,
  }
}

/** The message a person types in the share form, checked against WhatsApp's limits. */
export function cleanMessage(raw: unknown, catalogId: string): OutMessage {
  const b = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>
  const f: Record<string, string> = {}
  const to = String(b.to ?? '').replace(/\D/g, '')
  if (!WA_TO.test(to)) f.to = 'Enter the customer’s WhatsApp number with country code.'
  const body = str(b.body, 1024), footer = str(b.footer, 60)
  const ids = [...new Set((Array.isArray(b.retailerIds) ? b.retailerIds : []).map((x) => str(x, 100)).filter((x) => SKU.test(x)))]
  const kind = b.kind
  if (kind !== 'product' && kind !== 'products' && kind !== 'catalog') throw new CatalogError('Choose what to send.', 400, 'invalid_request')

  if (kind === 'catalog') {
    if (!body) f.body = 'Write the message that goes with the catalog button.'
    const thumb = ids[0] ?? ''
    if (Object.keys(f).length) throw new CatalogError('Some details need fixing.', 400, 'invalid_request', f)
    return { kind, to, body, footer, thumbnailRetailerId: thumb }
  }
  if (kind === 'product') {
    if (ids.length !== 1) f.retailerIds = 'Pick one product.'
    if (Object.keys(f).length) throw new CatalogError('Some details need fixing.', 400, 'invalid_request', f)
    return { kind, to, catalogId, retailerId: ids[0]!, body, footer }
  }
  if (!ids.length || ids.length > 30) f.retailerIds = 'Pick between 1 and 30 products.'
  const header = str(b.header, 60) || 'Our products'
  if (!body) f.body = 'Write a short message to go with the products.'
  if (Object.keys(f).length) throw new CatalogError('Some details need fixing.', 400, 'invalid_request', f)
  return { kind, to, catalogId, retailerIds: ids, header, body, footer, sectionTitle: str(b.sectionTitle, 24) || 'Products' }
}

/** The Cloud API request body for a message (POST /{phone-number-id}/messages). */
export function toCloudMessage(m: OutMessage): Record<string, unknown> {
  const base = { messaging_product: 'whatsapp', recipient_type: 'individual', to: m.to, type: 'interactive' }
  const footer = m.footer ? { footer: { text: m.footer } } : {}
  if (m.kind === 'product') return { ...base, interactive: { type: 'product', ...(m.body ? { body: { text: m.body } } : {}), ...footer, action: { catalog_id: m.catalogId, product_retailer_id: m.retailerId } } }
  if (m.kind === 'products') return { ...base, interactive: { type: 'product_list', header: { type: 'text', text: m.header }, body: { text: m.body }, ...footer, action: { catalog_id: m.catalogId, sections: [{ title: m.sectionTitle, product_items: m.retailerIds.map((id) => ({ product_retailer_id: id })) }] } } }
  return { ...base, interactive: { type: 'catalog_message', body: { text: m.body }, ...footer, action: { name: 'catalog_message', ...(m.thumbnailRetailerId ? { parameters: { thumbnail_product_retailer_id: m.thumbnailRetailerId } } : {}) } } }
}
