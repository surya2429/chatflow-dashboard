// Run: npx tsx scripts/ctwaConnect.smoke.ts  (from backend/)
import assert from 'node:assert/strict'
import { decryptKey } from '../src/ai/aiAssistant.js'
import { autoSelect, cleanHints, type ConnectionStore, type StoredConnection } from '../src/ctwa/connect.js'
import { createRuntime } from '../src/ctwa/runtime.js'
import { createRateLimiter } from '../src/leads/poweredByLead.js'

const APP = { appId: '111', appSecret: 'app-secret-123456789', configId: '222', version: 'v20.0' }
const SECRET = 'connections-secret-123'
const TOKEN = 'EAAB_customer_token_000111222333'

const mem = new Map<string, StoredConnection>()
const connections: ConnectionStore = { load: async (w) => mem.get(w) ?? null, save: async (w, c) => void mem.set(w, c), remove: async (w) => void mem.delete(w) }

interface Call { method: string; path: string; query: URLSearchParams; auth?: string }
const calls: Call[] = []
let shared: { ads: string[]; pages: string[]; wabas: string[] } = { ads: ['555'], pages: ['777'], wabas: ['999'] }
let codeOk = true
const reply = (o: unknown, status = 200) => ({ ok: status < 300, status, json: async () => o }) as Response
const fetchImpl = (async (url: string, init: any = {}) => {
  const u = new URL(url)
  const path = u.pathname.replace('/v20.0/', '')
  calls.push({ method: init.method ?? 'GET', path, query: u.searchParams, auth: init.headers?.Authorization })
  if (path === 'oauth/access_token') return codeOk ? reply({ access_token: TOKEN, client_business_id: '4242' }) : reply({ error: { message: 'Code was already used' } }, 400)
  if (path === 'debug_token') return reply({ data: { granular_scopes: [
    { scope: 'ads_management', target_ids: shared.ads }, { scope: 'pages_show_list', target_ids: shared.pages }, { scope: 'whatsapp_business_management', target_ids: shared.wabas }, { scope: 'business_management' },
  ] } })
  if (path === 'me') return init.method === 'DELETE' ? reply({ success: true }) : reply({ name: 'Priya Owner' })
  if (path === 'me/permissions') return reply({ success: true })
  if (path.startsWith('act_')) return u.searchParams.get('fields') === 'name,currency' ? reply({ name: `Ads ${path}`, currency: 'INR' }) : reply({ currency: 'INR' })
  if (/^\d+$/.test(path)) return reply({ name: `Asset ${path}` })
  if (path.endsWith('/ads')) return reply({ data: [] })
  if (path.endsWith('/insights')) return reply({ data: [] })
  return reply({})
}) as any

const rt = (over: any = {}) => createRuntime({ env: { version: 'v20.0' }, app: APP, secret: SECRET, connections, liveStore: null, allow: () => true, fetchImpl, ...over })
const base = { workspace: 'w1', ip: '1.1.1.1', query: {} }
const call = (r: ReturnType<typeof rt>, method: string, path: string, body: any = {}) => r.handle({ ...base, method, path, body }) as Promise<{ status: number; body: any }>

/* ── hints from the popup are cleaned ───────────────────────────────────────────────────────────────────── */
assert.deepEqual(cleanHints({ ad_account_ids: ['act_555', '555', 'x; DROP', 12], page_ids: ['777'], waba_id: '999', dataset_ids: ['321'], business_id: '4242' }), { adAccountIds: ['555'], pageIds: ['777'], wabaIds: ['999'], datasetId: '321', businessId: '4242' })
assert.deepEqual(cleanHints(null), { adAccountIds: [], pageIds: [], wabaIds: [], datasetId: null, businessId: null })
assert.deepEqual(autoSelect({ adAccounts: [{ id: '1', name: 'a', currency: 'INR' }, { id: '2', name: 'b', currency: 'INR' }], pages: [{ id: '7', name: 'p' }], wabas: [] }), { adAccountId: null, pageId: '7', wabaId: null })

/* ── before connecting: sample data, and the popup's configuration is offered ───────────────────────────── */
const r = rt()
let v = await call(r, 'GET', '/connect')
assert.equal(v.status, 200); assert.equal(v.body.connected, false); assert.equal(v.body.config.enabled, true); assert.equal(v.body.config.configId, '222')
assert.equal(JSON.stringify(v.body).includes('appSecret') || JSON.stringify(v.body).includes(APP.appSecret), false)       // the app secret never reaches the browser
assert.equal((await call(r, 'GET', '/dashboard')).body.mode, 'sample')

/* ── connecting ─────────────────────────────────────────────────────────────────────────────────────────── */
assert.equal((await call(r, 'POST', '/connect', { code: 'short' })).status, 400)
assert.equal((await call(rt({ app: null }), 'POST', '/connect', { code: 'a'.repeat(40) })).status, 503)                  // operator has not set up Facebook login
assert.equal((await call(rt({ secret: undefined }), 'POST', '/connect', { code: 'a'.repeat(40) })).status, 500)
assert.equal((await call(rt({ allow: () => false }), 'POST', '/connect', { code: 'a'.repeat(40) })).status, 429)
codeOk = false
const expired = await call(r, 'POST', '/connect', { code: 'a'.repeat(40) })
assert.equal(expired.status, 400); assert.equal(expired.body.error, 'meta_code'); assert.equal(mem.size, 0)
codeOk = true

calls.length = 0
v = await call(r, 'POST', '/connect', { code: 'AQB-the-one-time-code-from-facebook', session: { ad_account_ids: ['555'], waba_id: '999' } })
assert.equal(v.status, 200)
assert.equal(v.body.connected, true); assert.equal(v.body.source, 'facebook'); assert.equal(v.body.userName, 'Priya Owner')
assert.deepEqual(v.body.selected, { adAccountId: '555', pageId: '777', wabaId: '999' })                                    // one of each: chosen for them
assert.equal(v.body.needsSelection, false)
assert.deepEqual(v.body.adAccounts, [{ id: '555', name: 'Ads act_555', currency: 'INR' }])
const exch = calls.find((c) => c.path === 'oauth/access_token')!
assert.equal(exch.query.get('code'), 'AQB-the-one-time-code-from-facebook'); assert.equal(exch.query.get('client_id'), '111')
assert.equal(calls.find((c) => c.path === 'debug_token')!.auth, 'Bearer 111|app-secret-123456789')                       // app token in a header
assert.ok(calls.filter((c) => c.path.startsWith('act_') || /^\d+$/.test(c.path)).every((c) => c.auth === `Bearer ${TOKEN}`))   // each asset re-read with the customer's token
// the token is stored encrypted, and nothing the browser can see contains it
const stored = mem.get('w1')!
assert.notEqual(stored.tokenEnc, TOKEN); assert.ok(!stored.tokenEnc.includes('EAAB'))
assert.equal(decryptKey(stored.tokenEnc, SECRET), TOKEN)
assert.equal(JSON.stringify(v.body).includes(TOKEN), false)

// now the section runs live, with the customer's token and ad account
calls.length = 0
const dash = await call(r, 'GET', '/dashboard')
assert.equal(dash.body.mode, 'live'); assert.equal(dash.body.currency, 'INR')
assert.ok(calls.length > 0 && calls.every((c) => c.auth === `Bearer ${TOKEN}`) && calls.some((c) => c.path === 'act_555/ads'))

// the section keeps working across requests without asking Facebook again for the connection
assert.equal((await call(r, 'GET', '/connect')).body.connected, true)

/* ── several accounts: the customer chooses ─────────────────────────────────────────────────────────────── */
mem.clear(); shared = { ads: ['555', '556'], pages: ['777'], wabas: [] }
v = await call(rt(), 'POST', '/connect', { code: 'b'.repeat(40) })
assert.equal(v.body.needsSelection, true); assert.deepEqual(v.body.selected, { adAccountId: null, pageId: '777', wabaId: null })
assert.equal((await call(rt(), 'GET', '/dashboard')).body.mode, 'sample')                                                  // nothing live until they choose
assert.equal((await call(rt(), 'POST', '/connect/select', { adAccountId: '999999' })).status, 400)                          // only what they shared
v = await call(rt(), 'POST', '/connect/select', { adAccountId: '556' })
assert.equal(v.status, 200); assert.equal(v.body.needsSelection, false)
assert.equal((await call(rt(), 'GET', '/dashboard')).body.mode, 'live')

/* ── nothing shared: refused, token taken back, nothing stored ──────────────────────────────────────────── */
mem.clear(); shared = { ads: [], pages: [], wabas: [] }; calls.length = 0
const none = await call(rt(), 'POST', '/connect', { code: 'c'.repeat(40) })
assert.equal(none.status, 422); assert.equal(none.body.error, 'nothing_shared'); assert.equal(mem.size, 0)
assert.ok(calls.some((c) => c.path === 'me/permissions' && c.method === 'DELETE'))

/* ── disconnecting ──────────────────────────────────────────────────────────────────────────────────────── */
shared = { ads: ['555'], pages: ['777'], wabas: [] }
await call(rt(), 'POST', '/connect', { code: 'd'.repeat(40) })
assert.equal(mem.size, 1); calls.length = 0
v = await call(rt(), 'DELETE', '/connect')
assert.equal(v.status, 200); assert.equal(v.body.connected, false); assert.equal(mem.size, 0)
assert.ok(calls.some((c) => c.path === 'me/permissions' && c.method === 'DELETE' && c.auth === `Bearer ${TOKEN}`))      // permissions revoked at Facebook too
assert.equal((await call(rt(), 'GET', '/dashboard')).body.mode, 'sample')
// credentials set in the server settings can't be "disconnected" from the dashboard
const envRt = rt({ env: { version: 'v20.0', adAccountId: '5', pageId: '7', adsToken: 'x'.repeat(30) } })
assert.equal((await call(envRt, 'GET', '/connect')).body.source, 'env')
assert.equal((await call(envRt, 'DELETE', '/connect')).status, 409)

// workspaces are separate
await call(rt(), 'POST', '/connect', { code: 'e'.repeat(40) })
assert.equal((await rt().handle({ ...base, workspace: 'someone-else', method: 'GET', path: '/connect', body: {} }) as any).body.connected, false)

// attempts are rate limited
const limited = createRateLimiter(2, 60_000)
const rl = rt({ allow: limited })
mem.clear()
await call(rl, 'POST', '/connect', { code: 'f'.repeat(40) }); await call(rl, 'POST', '/connect', { code: 'f'.repeat(40) })
assert.equal((await call(rl, 'POST', '/connect', { code: 'f'.repeat(40) })).status, 429)

console.log('ctwaConnect ok')
