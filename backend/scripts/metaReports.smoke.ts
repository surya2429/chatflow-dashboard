// Run: npx tsx scripts/metaReports.smoke.ts
// Feeds metaReports.ts the shape Meta documents and checks the sums (no network, no credentials).
import assert from 'node:assert/strict'
import { fetchMetaReport, metaReportResponse } from '../src/whatsapp/metaReports.js'

const urls: string[] = []
const fake = (async (url: string) => {
  urls.push(url)
  const json = (b: unknown) => ({ ok: true, status: 200, json: async () => b })
  if (url.includes('/pricing_analytics')) {
    return json({ data: [{ data_points: [
      { pricing_category: 'MARKETING', pricing_type: 'REGULAR', volume: 1182, cost: 1023.53 },
      { pricing_category: 'UTILITY', pricing_type: 'REGULAR', volume: 280, cost: 32.2 },
      { pricing_category: 'SERVICE', pricing_type: 'FREE_CUSTOMER_SERVICE', volume: 144, cost: 0 },
    ] }] })
  }
  return json({ currency: 'INR', analytics: { data_points: [{ sent: 1000, delivered: 900 }, { sent: 626, delivered: 706 }] } })
}) as unknown as typeof fetch

const r = await fetchMetaReport({ wabaId: '123', accessToken: 't', version: 'v20.0', start: 1, end: 2, fetchImpl: fake })
assert.equal(r.messages.sent, 1626)
assert.equal(r.messages.delivered, 1606)
assert.equal(r.messages.received, null)
assert.deepEqual(r.free, { total: 144, customerService: 144, entryPoint: 0, other: 0 })
assert.equal(r.paid.total, 1462)                       // delivered − free
assert.equal(r.deliveredByCategory.marketing, 1182)
assert.equal(Math.round(r.charges.total * 100) / 100, 1055.73)
assert.ok(urls.every((u) => u.includes('access_token=t')))

// guards
assert.deepEqual((await metaReportResponse({}, { version: 'v20.0' })).body, { configured: false })
assert.equal((await metaReportResponse({ start: '5', end: '1' }, { wabaId: 'w', accessToken: 't', version: 'v20.0' })).status, 400)
assert.equal((await metaReportResponse({ start: '1', end: String(1 + 91 * 86400) }, { wabaId: 'w', accessToken: 't', version: 'v20.0' })).status, 400)
console.log('metaReports ok')
