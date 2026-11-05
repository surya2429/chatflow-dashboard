// Run: npx tsx scripts/poweredByLead.smoke.ts  (from backend/)
import assert from 'node:assert/strict'
import { createRateLimiter, handleLeadRequest, validateLead } from '../src/leads/poweredByLead.js'

const good = { name: ' Priya Sharma ', email: 'priya@acme.io', phone: '+91 98765 43210', company: ' Acme ', website: 'acme.io', sourceUrl: 'https://shop.example/pricing' }
const ok = validateLead(good)
assert.ok(ok.ok)
if (ok.ok) assert.deepEqual(ok.lead, { name: 'Priya Sharma', email: 'priya@acme.io', phone: '+91 98765 43210', company: 'Acme', website: 'https://acme.io', sourceUrl: 'https://shop.example/pricing' })

// company and website are optional; name, email, phone are not
const min = validateLead({ name: 'Al', email: 'a@b.co', phone: '9876543210' })
assert.ok(min.ok && min.lead.company === null && min.lead.website === null)
const bad = validateLead({ name: 'A', email: 'nope', phone: '12', website: 'not a site' })
assert.ok(!bad.ok)
if (!bad.ok) assert.deepEqual(Object.keys(bad.fields).sort(), ['email', 'name', 'phone', 'website'])
assert.ok(!validateLead({ ...good, phone: 'call me' }).ok)
assert.ok(!validateLead(null).ok && !validateLead('x').ok)

// the handler saves only valid leads, and rate-limits per address
let t = 0
const saved: unknown[] = []
const allow = createRateLimiter(2, 1000, () => t)
const save = async (l: unknown) => { saved.push(l) }
assert.equal((await handleLeadRequest(good, '1.1.1.1', save, allow)).status, 201)
assert.equal((await handleLeadRequest({}, '1.1.1.1', save, allow)).status, 400)
assert.equal((await handleLeadRequest(good, '1.1.1.1', save, allow)).status, 429)   // third in the window
assert.equal((await handleLeadRequest(good, '2.2.2.2', save, allow)).status, 201)   // another address is unaffected
t = 2000
assert.equal((await handleLeadRequest(good, '1.1.1.1', save, allow)).status, 201)   // window passed
assert.equal(saved.length, 3)
console.log('poweredByLead ok')
