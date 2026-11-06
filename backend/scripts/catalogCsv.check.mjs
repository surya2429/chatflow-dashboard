// Run: node scripts/catalogCsv.check.mjs  (from backend/) — the catalog file format: parsing, and export → import round trip.
import assert from 'node:assert/strict'
import { parseCsv, rowsToProducts, splitPrice, TEMPLATE_CSV } from '../../src/components/catalog/csv.js'
import { productsExportTable } from '../../src/components/catalog/exports.js'
import { toCsv } from '../../src/components/ai/aiTable.js'

// quotes, commas, doubled quotes and newlines inside a field; BOM; CRLF
const rows = parseCsv('﻿id,title,price\r\nA1,"Lamp, desk ""Pro""",1299.50 INR\r\nA2,"Two\nlines",5 USD\r\n')
assert.deepEqual(rows[1], ['A1', 'Lamp, desk "Pro"', '1299.50 INR']); assert.equal(rows[2][1], 'Two\nlines'); assert.equal(rows.length, 3)

assert.deepEqual(splitPrice('4,999.00 INR'), { amount: 4999, currency: 'INR' })
assert.deepEqual(splitPrice('₹1,299.50'), { amount: 1299.5, currency: '' })

// the template imports cleanly
const t = rowsToProducts(parseCsv(TEMPLATE_CSV))
assert.equal(t.missing.length, 0); assert.equal(t.products.length, 2)
assert.equal(t.products[0].retailerId, 'SKU-001'); assert.equal(t.products[0].price, 799); assert.equal(t.products[0].currency, 'INR'); assert.equal(t.products[0].salePrice, 599); assert.equal(t.products[0].inventory, 120)
assert.equal(t.products[1].salePrice, null)

// missing columns are reported; unknown ones are ignored, not fatal
const m = rowsToProducts(parseCsv('sku,colour\nX,red'))
assert.deepEqual(m.missing.sort(), ['price', 'title']); assert.deepEqual(m.unknown, ['colour'])

// stock words and defaults
const s = rowsToProducts(parseCsv('id,title,price,availability,condition\nA,a,1,out of stock,\nB,b,2,,Used\nC,c,3,in_stock,new'), 'USD')
assert.deepEqual(s.products.map((p) => [p.availability, p.condition, p.currency]), [['out of stock', 'new', 'USD'], ['in stock', 'used', 'USD'], ['in stock', 'new', 'USD']])

// export → import round trip keeps what matters
const original = [{ retailerId: 'R1', name: 'Mug, large', description: 'A "big" mug', price: 499.5, currency: 'INR', salePrice: 399, availability: 'in stock', condition: 'new', imageUrl: 'https://x.test/i.jpg', url: 'https://x.test/p', brand: 'Terra', inventory: 7, reviewStatus: 'approved', reviewNote: '' }]
const table = productsExportTable(original)
const csv = toCsv(table)       // the app's own export
const back = rowsToProducts(parseCsv(csv)).products[0]
assert.deepEqual([back.retailerId, back.name, back.description, back.price, back.currency, back.salePrice, back.inventory, back.url, back.imageUrl, back.brand], ['R1', 'Mug, large', 'A "big" mug', 499.5, 'INR', 399, 7, 'https://x.test/p', 'https://x.test/i.jpg', 'Terra'])
console.log('catalog csv: ok')
