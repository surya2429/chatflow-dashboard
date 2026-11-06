/* Reading and writing catalog files. The columns are Meta's own catalog feed names, so a file exported here can be
   edited in a spreadsheet and imported again, and a feed file from elsewhere imports too. Pure. */

/** RFC 4180: quoted fields, doubled quotes, commas and newlines inside quotes. Returns rows of strings. */
export function parseCsv(text) {
  const rows = []
  let row = [], cell = '', quoted = false
  const s = String(text).replace(/^﻿/, '')
  for (let i = 0; i < s.length; i++) {
    const c = s[i]
    if (quoted) {
      if (c === '"') { if (s[i + 1] === '"') { cell += '"'; i++ } else quoted = false } else cell += c
    } else if (c === '"') quoted = true
    else if (c === ',') { row.push(cell); cell = '' }
    else if (c === '\n' || c === '\r') { if (c === '\r' && s[i + 1] === '\n') i++; row.push(cell); cell = ''; if (row.some((x) => x.trim() !== '')) rows.push(row); row = [] }
    else cell += c
  }
  row.push(cell)
  if (row.some((x) => x.trim() !== '')) rows.push(row)
  return rows
}

const HEADERS = {
  retailerId: ['id', 'sku', 'retailerid', 'contentid'], name: ['title', 'name', 'productname'], description: ['description'],
  availability: ['availability', 'stock status'], condition: ['condition'], price: ['price'], currency: ['currency'],
  groupId: ['itemgroupid', 'groupid'], size: ['size'], color: ['color', 'colour'],
  url: ['link', 'url', 'producturl'], imageUrl: ['imagelink', 'imageurl', 'image'], brand: ['brand'], salePrice: ['saleprice'],
  inventory: ['quantitytosellonfacebook', 'inventory', 'stock', 'quantity'],
}
const norm = (h) => String(h).toLowerCase().replace(/[^a-z0-9]/g, '')
const FIELD_OF = Object.fromEntries(Object.entries(HEADERS).flatMap(([field, names]) => names.map((n) => [norm(n), field])))

/** "4,999.00 INR" → { amount: 4999, currency: 'INR' } */
export function splitPrice(v) {
  const t = String(v ?? '').trim()
  const amount = parseFloat(t.replace(/,/g, '').replace(/[^\d.]/g, ''))
  return { amount: Number.isFinite(amount) ? amount : NaN, currency: (t.match(/[A-Za-z]{3}/)?.[0] || '').toUpperCase() }
}

const stock = (v) => { const t = norm(v); return !t ? 'in stock' : t.startsWith('out') || t === 'soldout' || t === '0' ? 'out of stock' : t.startsWith('in') ? 'in stock' : t }
const cond = (v) => norm(v) || 'new'

/** rows (first row = headers) → products for the import call, plus a note about columns that were not recognised. */
/** partial: a file of extra details (supplementary data): only the columns present are sent, nothing is defaulted, only `id` is required. */
export function rowsToProducts(rows, defaultCurrency = 'INR', partial = false) {
  if (rows.length < 2) return { products: [], unknown: [], missing: ['id', 'title'] }
  const map = rows[0].map((h) => FIELD_OF[norm(h)] ?? null)
  const unknown = rows[0].filter((_, i) => !map[i] && rows[0][i].trim()).map((h) => h.trim())
  const missing = (partial ? ['retailerId'] : ['retailerId', 'name', 'price']).filter((f) => !map.includes(f)).map((f) => ({ retailerId: 'id', name: 'title', price: 'price' })[f])
  const products = rows.slice(1).map((r) => {
    const p = {}
    map.forEach((f, i) => { if (f) p[f] = (r[i] ?? '').trim() })
    const main = splitPrice(p.price), sale = splitPrice(p.salePrice)
    if (partial) {
      const o = { retailerId: p.retailerId }
      for (const k of ['name', 'description', 'url', 'imageUrl', 'brand', 'groupId', 'size', 'color']) if (p[k]) o[k] = p[k]
      if (p.availability) o.availability = stock(p.availability)
      if (p.condition) o.condition = cond(p.condition)
      if (p.price) { o.price = main.amount; o.currency = (p.currency || main.currency || defaultCurrency).toUpperCase() }
      if (p.salePrice) { o.salePrice = sale.amount; o.currency ||= (p.currency || sale.currency || defaultCurrency).toUpperCase() }
      if (p.inventory) o.inventory = Number(p.inventory)
      return o
    }
    return {
      ...p, price: main.amount, currency: (p.currency || main.currency || sale.currency || defaultCurrency).toUpperCase(),
      salePrice: p.salePrice ? sale.amount : null, availability: stock(p.availability), condition: cond(p.condition),
      inventory: p.inventory === undefined || p.inventory === '' ? null : Number(p.inventory),
    }
  })
  return { products, unknown, missing }
}

export const TEMPLATE_CSV = [
  'id,title,description,availability,condition,price,sale_price,link,image_link,brand,item_group_id,size,color,quantity_to_sell_on_facebook',
  'SKU-001-M,Cotton T-Shirt (M),Soft organic cotton tee,in stock,new,799.00 INR,599.00 INR,https://yourstore.com/tshirt,https://yourstore.com/img/tshirt.jpg,Terra,TSHIRT,M,White,120',
  'SKU-001-L,Cotton T-Shirt (L),Soft organic cotton tee,in stock,new,799.00 INR,599.00 INR,https://yourstore.com/tshirt,https://yourstore.com/img/tshirt.jpg,Terra,TSHIRT,L,White,80',
  'SKU-002,Steel Water Bottle,1 litre insulated bottle,in stock,new,1299.00 INR,,https://yourstore.com/bottle,https://yourstore.com/img/bottle.jpg,Hydra,,,,45',
].join('\r\n')
export const SUPPLEMENTARY_CSV = [
  'id,brand,size,color',
  'SKU-002,Hydra,1 L,Steel',
].join('\r\n')
