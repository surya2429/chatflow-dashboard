// Run: node scripts/catalogCsv.check.mjs  (from backend/) — the catalog file format: parsing, and export → import round trip.
import assert from 'node:assert/strict'
import { parseCsv, rowsToProducts, splitPrice, TEMPLATE_CSV } from '../../src/components/catalog/csv.js'
import { productsExportTable } from '../../src/components/catalog/exports.js'
import { toCsv } from '../../src/components/ai/aiTable.js'
import { groupProducts } from '../../src/components/catalog/groups.js'

// quotes, commas, doubled quotes and newlines inside a field; BOM; CRLF
const rows = parseCsv('﻿id,title,price\r\nA1,"Lamp, desk ""Pro""",1299.50 INR\r\nA2,"Two\nlines",5 USD\r\n')
assert.deepEqual(rows[1], ['A1', 'Lamp, desk "Pro"', '1299.50 INR']); assert.equal(rows[2][1], 'Two\nlines'); assert.equal(rows.length, 3)

assert.deepEqual(splitPrice('4,999.00 INR'), { amount: 4999, currency: 'INR' })
assert.deepEqual(splitPrice('₹1,299.50'), { amount: 1299.5, currency: '' })

// the template imports cleanly
const t = rowsToProducts(parseCsv(TEMPLATE_CSV))
assert.equal(t.missing.length, 0); assert.equal(t.products.length, 3)
assert.equal(t.products[0].retailerId, 'SKU-001-M'); assert.equal(t.products[0].price, 799); assert.equal(t.products[0].currency, 'INR'); assert.equal(t.products[0].salePrice, 599); assert.equal(t.products[0].inventory, 120)
assert.equal(t.products[2].salePrice, null); assert.equal(t.products[1].groupId, 'TSHIRT'); assert.equal(t.products[1].size, 'L')

// missing columns are reported; unknown ones are ignored, not fatal
const m = rowsToProducts(parseCsv('sku,fabric\nX,red'))
assert.deepEqual(m.missing.sort(), ['price', 'title']); assert.deepEqual(m.unknown, ['fabric'])

// stock words and defaults
const s = rowsToProducts(parseCsv('id,title,price,availability,condition\nA,a,1,out of stock,\nB,b,2,,Used\nC,c,3,in_stock,new'), 'USD')
assert.deepEqual(s.products.map((p) => [p.availability, p.condition, p.currency]), [['out of stock', 'new', 'USD'], ['in stock', 'used', 'USD'], ['in stock', 'new', 'USD']])

// export → import round trip keeps what matters
const original = [{ retailerId: 'R1', name: 'Mug, large', description: 'A "big" mug', price: 499.5, currency: 'INR', salePrice: 399, availability: 'in stock', condition: 'new', imageUrl: 'https://x.test/i.jpg', url: 'https://x.test/p', brand: 'Terra', inventory: 7, reviewStatus: 'approved', reviewNote: '' }]
const table = productsExportTable(original)
const csv = toCsv(table)       // the app's own export
const back = rowsToProducts(parseCsv(csv)).products[0]
assert.deepEqual([back.retailerId, back.name, back.description, back.price, back.currency, back.salePrice, back.inventory, back.url, back.imageUrl, back.brand], ['R1', 'Mug, large', 'A "big" mug', 499.5, 'INR', 399, 7, 'https://x.test/p', 'https://x.test/i.jpg', 'Terra'])
// supplementary data: only id is required, only the columns given are sent, nothing is defaulted
const sup = rowsToProducts(parseCsv('id,brand,size,price\nA,Zed,XL,\nB,,,"12.50 USD"'), 'INR', true)
assert.equal(sup.missing.length, 0)
assert.deepEqual(sup.products[0], { retailerId: 'A', brand: 'Zed', size: 'XL' })
assert.deepEqual(sup.products[1], { retailerId: 'B', price: 12.5, currency: 'USD' })
assert.deepEqual(rowsToProducts(parseCsv('brand\nZed'), 'INR', true).missing, ['id'])

// variants: products sharing item_group_id become one row with a price range and worst review status
const mk = (id, g, price, sale, avail, review) => ({ retailerId: id, groupId: g, name: `Shirt ${id}`, price, salePrice: sale, currency: 'INR', availability: avail, reviewStatus: review, imageUrl: '', brand: 'T' })
const gs = groupProducts([mk('a', 'G', 100, null, 'in stock', 'approved'), mk('b', 'G', 150, 120, 'out of stock', 'rejected'), mk('c', '', 50, null, 'in stock', 'approved')])
assert.equal(gs.length, 2); assert.equal(gs[0].items.length, 2); assert.equal(gs[0].min, 100); assert.equal(gs[0].max, 120); assert.equal(gs[0].inStock, 1); assert.equal(gs[0].status, 'rejected'); assert.equal(gs[1].isGroup, false)
console.log('catalog csv: ok')
