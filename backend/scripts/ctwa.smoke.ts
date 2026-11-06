// Run: npx tsx scripts/ctwa.smoke.ts  (from backend/)
import assert from 'node:assert/strict'
import { buildCapiBody, createCapi, validateEvent } from '../src/ctwa/capi.js'
import { parseRange, toMinor, validateCreateAd } from '../src/ctwa/common.js'
import { createCtwa } from '../src/ctwa/factory.js'
import { buildAdsetBody, buildCreativeBody, createMetaAds, welcomePayload } from '../src/ctwa/metaAds.js'
import { extractReferral } from '../src/ctwa/referral.js'
import { createSampleAds, createSampleStore } from '../src/ctwa/sample.js'
import { handleCtwaRequest } from '../src/ctwa/service.js'
import { CtwaError } from '../src/ctwa/types.js'

const good = {
  name: 'Diwali Offer', objective: 'OUTCOME_ENGAGEMENT', dailyBudget: 1500, startTime: null, endTime: null,
  targeting: { countries: ['in', 'IN', 'ae'], ageMin: 21, ageMax: 45, genders: 'female' },
  creative: { primaryText: 'Chat with us', headline: 'Flat 30% off', description: '', imageUrl: 'https://cdn.example.com/a.jpg', welcome: { type: 'ice_breakers', greeting: 'Hi 👋', iceBreakers: ['Prices?', ' ', 'Delivery?', 'Returns?', 'Extra'] } },
}

/* ── validation ───────────────────────────────────────────────────────────────────────────────────────────── */
const v = validateCreateAd(good)
assert.deepEqual(v.targeting.countries, ['IN', 'AE'])                                    // upper-cased, de-duplicated
assert.deepEqual(v.creative.welcome.iceBreakers, ['Prices?', 'Delivery?', 'Returns?'])    // blanks dropped, max three
assert.equal(v.status, 'PAUSED')                                                          // nothing spends until the owner says so
const bad = (patch: any) => { try { validateCreateAd({ ...good, ...patch }); return null } catch (e) { return e as CtwaError } }
assert.ok(bad({ name: '' })?.fields?.name && bad({ dailyBudget: 0 })?.fields?.dailyBudget && bad({ targeting: { countries: [] } })?.fields?.countries)
assert.ok(bad({ creative: { ...good.creative, imageUrl: 'http://x.com/a.jpg' } })?.fields?.image)               // https only
assert.ok(bad({ creative: { ...good.creative, imageUrl: null } })?.fields?.image)                                // an image is required
assert.ok(bad({ creative: { ...good.creative, welcome: { type: 'autofill', greeting: 'Hi', autofillMessage: '' } } })?.fields?.autofillMessage)
assert.ok(bad({ startTime: '2026-12-01T00:00:00Z', endTime: '2026-12-01T10:00:00Z' })?.fields?.endTime)         // daily budget needs > 24h
assert.ok(bad({ targeting: { countries: ['IN'], ageMin: 50, ageMax: 20 } })?.fields?.age)
assert.equal(toMinor(1500.5, 'INR'), 150050)
assert.equal(toMinor(1500, 'JPY'), 1500)
assert.throws(() => parseRange({ start: '1', end: String(1 + 91 * 86400) }), CtwaError)

/* ── sample mode: numbers agree with each other, and every action works ────────────────────────────────────── */
const T0 = Date.parse('2026-11-05T12:00:00Z')
const sample = createSampleAds(() => T0)
const range30 = { start: Math.floor(T0 / 1000) - 30 * 86400, end: Math.floor(T0 / 1000) }
const d30 = await sample.dashboard(range30)
assert.equal(d30.ads.length, 7)
assert.equal(d30.daily.length, 31)
const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0)
assert.equal(d30.totals.conversations, sum(d30.ads.map((a) => a.metrics.conversations)))
assert.equal(sum(d30.daily.map((p) => p.conversations)), d30.totals.conversations)                  // chart and table agree
assert.equal(sum(d30.daily.map((p) => p.clicks)), d30.totals.clicks)
assert.ok(d30.totals.conversations > 100 && d30.totals.costPerConversation! > 0)
assert.deepEqual(await sample.dashboard(range30), d30)                                              // deterministic
const d7 = await sample.dashboard({ start: range30.end - 7 * 86400, end: range30.end })
assert.ok(d7.totals.spend < d30.totals.spend)
assert.equal(d30.ads.find((a) => a.name.startsWith('Brand Awareness'))!.status, 'PAUSED')

const made = await sample.createAd(validateCreateAd(good))
let after = await sample.dashboard(range30)
const mine = after.ads.find((a) => a.id === made.adId)!
assert.equal(mine.status, 'PAUSED')
assert.equal(mine.metrics.spend, 0)                                                                 // a paused new ad spends nothing
await sample.updateAd(made.adId, { status: 'ACTIVE' })
assert.equal((await sample.dashboard(range30)).ads.find((a) => a.id === made.adId)!.status, 'ACTIVE')
await sample.updateAd(made.adId, { dailyBudget: 900, name: 'Renamed' })
const renamed = (await sample.dashboard(range30)).ads.find((a) => a.id === made.adId)!
assert.ok(renamed.dailyBudget === 900 && renamed.name === 'Renamed')
await sample.updateAd(made.adId, { status: 'ARCHIVED' })
assert.ok(!(await sample.dashboard(range30)).ads.some((a) => a.id === made.adId))
await assert.rejects(() => sample.updateAd('nope', { status: 'PAUSED' }), CtwaError)

/* ── live mode: the exact Marketing API calls ───────────────────────────────────────────────────────────── */
interface Call { method: string; url: URL; headers: Record<string, string>; body: any }
const calls: Call[] = []
let failAt = ''
const reply = (o: unknown, status = 200) => ({ ok: status < 300, status, json: async () => o }) as Response
const live = (extra: any = {}) => createMetaAds({
  adAccountId: '555', pageId: '777', accessToken: 'TOKEN123', version: 'v20.0', ...extra,
  fetchImpl: (async (url: string, init: any) => {
    const u = new URL(url)
    calls.push({ method: init.method, url: u, headers: init.headers, body: init.body ? JSON.parse(init.body) : undefined })
    const p = u.pathname.replace('/v20.0/', '')
    if (failAt && p.endsWith(failAt)) return reply({ error: { message: 'Invalid parameter', error_user_msg: 'The image is too small.', code: 100 } }, 400)
    if (init.method === 'DELETE') return reply({ success: true })
    if (p === 'act_555' && u.searchParams.get('fields') === 'currency') return reply({ currency: 'INR' })
    if (p.endsWith('/campaigns')) return reply({ id: 'C1' })
    if (p.endsWith('/adsets')) return reply({ id: 'S1' })
    if (p.endsWith('/adimages')) return reply({ images: { bytes: { hash: 'HASH9' } } })
    if (p.endsWith('/adcreatives')) return reply({ id: 'CR1' })
    if (p.endsWith('/ads')) {
      if (init.method === 'POST') return reply({ id: 'A1' })
      return reply({ data: [
        { id: 'A1', name: 'Ad one', status: 'ACTIVE', effective_status: 'ACTIVE', created_time: 't', adset: { id: 'S1', daily_budget: '150000', destination_type: 'WHATSAPP' }, campaign: { id: 'C1', name: 'Camp', objective: 'OUTCOME_ENGAGEMENT' }, creative: { thumbnail_url: 'https://t/1.jpg', object_story_spec: { link_data: { name: 'Head', message: 'Body' } } } },
        { id: 'A2', name: 'A website ad', status: 'ACTIVE', adset: { id: 'S2', destination_type: 'WEBSITE' }, campaign: {}, creative: {} },
      ] })
    }
    if (p.endsWith('/insights')) {
      return u.searchParams.get('level') === 'ad'
        ? reply({ data: [{ ad_id: 'A1', spend: '250.50', impressions: '10000', reach: '7000', clicks: '200', actions: [{ action_type: 'link_click', value: '190' }, { action_type: 'onsite_conversion.messaging_conversation_started_7d', value: '40' }] }] })
        : reply({ data: [{ date_start: '2026-11-01', spend: '100', impressions: '4000', clicks: '80', actions: [{ action_type: 'onsite_conversion.messaging_conversation_started_7d', value: '16' }] }] })
    }
    if (p === 'A1') return reply({ adset_id: 'S1', campaign_id: 'C1' })
    return reply({ id: 'x' })
  }) as any,
})

const m = live()
const created = await m.createAd(validateCreateAd({ ...good, status: 'PAUSED' }))
assert.deepEqual(created, { campaignId: 'C1', adsetId: 'S1', creativeId: 'CR1', adId: 'A1' })
const posts = calls.filter((c) => c.method === 'POST')
assert.deepEqual(posts.map((c) => c.url.pathname.split('/').pop()), ['campaigns', 'adsets', 'adcreatives', 'ads'])
assert.ok(calls.every((c) => c.headers.Authorization === 'Bearer TOKEN123' && !c.url.search.includes('TOKEN123')))        // token in a header, never a URL
assert.deepEqual(posts[0]!.body, { name: 'Diwali Offer', objective: 'OUTCOME_ENGAGEMENT', status: 'PAUSED', special_ad_categories: [] })
const adset = posts[1]!.body
assert.equal(adset.destination_type, 'WHATSAPP'); assert.equal(adset.optimization_goal, 'CONVERSATIONS'); assert.equal(adset.billing_event, 'IMPRESSIONS')
assert.equal(adset.daily_budget, '150000')                                                                             // ₹1500 → paise
assert.deepEqual(adset.promoted_object, { page_id: '777' })                                                              // no number pinned unless configured
assert.deepEqual(adset.targeting, { geo_locations: { countries: ['IN', 'AE'] }, age_min: 21, age_max: 45, genders: [2] })
const link = posts[2]!.body.object_story_spec.link_data
assert.equal(link.link, 'https://api.whatsapp.com/send')
assert.deepEqual(link.call_to_action, { type: 'WHATSAPP_MESSAGE', value: { app_destination: 'WHATSAPP' } })
assert.equal(link.picture, 'https://cdn.example.com/a.jpg')
assert.deepEqual(link.page_welcome_message.text_format.message.ice_breakers, [{ title: 'Prices?' }, { title: 'Delivery?' }, { title: 'Returns?' }])
assert.equal(link.page_welcome_message.text_format.customer_action_type, 'ice_breakers')
assert.equal(welcomePayload({ type: 'autofill', greeting: 'Hello', autofillMessage: 'I want the offer' }).text_format.message.autofill_message.content, 'I want the offer')
assert.equal(buildAdsetBody(validateCreateAd(good), { adAccountId: '1', pageId: '2', accessToken: 'x', version: 'v1', whatsappNumber: '+919876543210' }, 'C', 'INR').promoted_object.whatsapp_phone_number, '+919876543210')
assert.equal(buildCreativeBody(validateCreateAd(good), { adAccountId: '1', pageId: '2', accessToken: 'x', version: 'v1' }, 'H').object_story_spec.link_data.image_hash, 'H')

// an uploaded image goes through /adimages and the creative uses its hash
calls.length = 0
await live().createAd(validateCreateAd({ ...good, creative: { ...good.creative, imageUrl: null, imageBase64: 'data:image/png;base64,iVBORw0KGgo=' } }))
assert.ok(calls.some((c) => c.url.pathname.endsWith('/adimages') && c.body.bytes === 'iVBORw0KGgo='))
assert.equal(calls.find((c) => c.url.pathname.endsWith('/adcreatives'))!.body.object_story_spec.link_data.image_hash, 'HASH9')

// publishing turns campaign, ad set and ad on
calls.length = 0
await live().createAd(validateCreateAd({ ...good, status: 'ACTIVE' }))
assert.deepEqual(calls.filter((c) => c.body?.status === 'ACTIVE').map((c) => c.url.pathname.split('/').pop()), ['C1', 'S1', 'A1'])

// a failure part-way removes what was already made, newest first, and says which step failed
calls.length = 0; failAt = '/adcreatives'
await assert.rejects(() => live().createAd(validateCreateAd(good)), (e: any) => e instanceof CtwaError && e.message.includes('creative') && e.message.includes('image is too small'))
assert.deepEqual(calls.filter((c) => c.method === 'DELETE').map((c) => c.url.pathname.split('/').pop()), ['S1', 'C1'])
failAt = ''

// pausing touches the ad; resuming a never-started ad turns the whole chain on; budget goes to the ad set
calls.length = 0
await live().updateAd('A1', { status: 'PAUSED' })
assert.deepEqual(calls.filter((c) => c.method === 'POST').map((c) => [c.url.pathname.split('/').pop(), c.body.status]), [['A1', 'PAUSED']])
calls.length = 0
await live().updateAd('A1', { status: 'ACTIVE' })
assert.deepEqual(calls.filter((c) => c.method === 'POST').map((c) => c.url.pathname.split('/').pop()), ['C1', 'S1', 'A1'])
calls.length = 0
await live().updateAd('A1', { dailyBudget: 2000 })
assert.deepEqual(calls.filter((c) => c.method === 'POST').map((c) => [c.url.pathname.split('/').pop(), c.body.daily_budget]), [['S1', '200000']])

// the dashboard keeps only Click-to-WhatsApp ads and reads "conversations started" from the insights actions
const dash = await live().dashboard({ start: 1_762_300_800, end: 1_764_892_800 })
assert.equal(dash.ads.length, 1)
const a1 = dash.ads[0]!
assert.deepEqual([a1.name, a1.headline, a1.primaryText, a1.dailyBudget, a1.imageUrl], ['Ad one', 'Head', 'Body', 1500, 'https://t/1.jpg'])
assert.deepEqual([a1.metrics.spend, a1.metrics.conversations, a1.metrics.costPerConversation, a1.metrics.ctr, a1.metrics.cpc], [250.5, 40, 6.26, 2, 1.25])
assert.deepEqual(dash.daily, [{ date: '2026-11-01', spend: 100, impressions: 4000, clicks: 80, conversations: 16 }])
assert.equal(dash.totals.conversations, 40)
// permission / token problems become clear messages
const denied = createMetaAds({ adAccountId: '1', pageId: '2', accessToken: 'x', version: 'v20.0', fetchImpl: (async () => reply({ error: { code: 190, message: 'expired' } }, 401)) as any })
await assert.rejects(() => denied.currency(), (e: any) => e.code === 'meta_token')

/* ── referral from the webhook ──────────────────────────────────────────────────────────────────────────── */
const ref = extractReferral({ id: 'wamid.1', from: '919876543210', timestamp: '1762300800', referral: { source_url: 'https://fb.me/x', source_id: '120200', source_type: 'ad', headline: 'Flat 30% off', body: 'Chat now', media_type: 'image', image_url: 'https://i/1.jpg', ctwa_clid: 'ARAk9', welcome_message: { text: 'Hi!' } } }, 'Priya', '1055')!
assert.deepEqual([ref.waId, ref.sourceId, ref.ctwaClid, ref.headline, ref.mediaUrl, ref.welcomeText, ref.createdAt], ['919876543210', '120200', 'ARAk9', 'Flat 30% off', 'https://i/1.jpg', 'Hi!', '2025-11-05T00:00:00.000Z'])
assert.equal(extractReferral({ id: 'a', from: '1', timestamp: '1' }), null)
assert.equal(extractReferral({ id: 'a', from: '1', timestamp: '1', referral: { headline: 'x' } }), null)

/* ── the HTTP handler over sample data ──────────────────────────────────────────────────────────────────── */
const deps = createCtwa({ version: 'v20.0' }, null)
const call = (method: string, path: string, body: any = {}, query: any = {}) => handleCtwaRequest({ method, path, query, body }, deps)
const dres: any = await call('GET', '/dashboard')
assert.equal(dres.status, 200); assert.equal(dres.body.mode, 'sample'); assert.equal(dres.body.currency, 'INR')
assert.equal((await call('GET', '/dashboard', {}, { start: '5', end: '4' })).status, 400)
const c1: any = await call('POST', '/ads', { ...good, name: '' })
assert.equal(c1.status, 400); assert.ok(c1.body.fields.name)
const c2: any = await call('POST', '/ads', good)
assert.equal(c2.status, 201)
assert.equal((await call('PATCH', `/ads/${c2.body.adId}`, { status: 'ACTIVE' })).status, 200)
assert.equal((await call('PATCH', `/ads/${c2.body.adId}`, { status: 'DELETED' })).status, 400)
assert.equal((await call('PATCH', `/ads/${c2.body.adId}`, {})).status, 400)
assert.equal((await call('PATCH', '/ads/..%2Fsecret', { status: 'PAUSED' })).status, 404)                       // ids are never pasted into Graph URLs unchecked
assert.equal((await call('PATCH', '/ads/zzz_unknown', { status: 'PAUSED' })).status, 404)
assert.equal((await call('DELETE', `/ads/${c2.body.adId}`)).status, 200)

// leads and conversion events (simulated in sample mode: fake leads are never sent to Meta)
const leads: any = await call('GET', '/leads')
assert.equal(leads.status, 200); assert.ok(leads.body.leads.length >= 10); assert.equal(leads.body.capiLive, false)
assert.equal(((await call('GET', '/lead', {}, { waId: '+91 98765 43210' })) as any).body.lead.contactName, 'Priya Sharma')
assert.equal(((await call('GET', '/lead', {}, { waId: '919000000000' })) as any).body.lead, null)
const ev: any = await call('POST', '/events', { waId: '919876543210', eventName: 'QualifiedLead' })
assert.equal(ev.status, 200); assert.equal(ev.body.status, 'simulated')
assert.equal((await call('POST', '/events', { waId: '919876543210', eventName: 'QualifiedLead' })).status, 409)      // once per lead
assert.equal((await call('POST', '/events', { waId: '919876543210', eventName: 'Purchase' })).status, 400)          // a purchase needs a value
assert.equal((await call('POST', '/events', { waId: '919876543210', eventName: 'Purchase', value: 4999, currency: 'INR' })).status, 200)
assert.equal((await call('POST', '/events', { waId: '919876543210', eventName: 'Purchase', value: 100, currency: 'INR' })).status, 200)   // purchases can repeat
assert.equal((await call('POST', '/events', { waId: '919000000000', eventName: 'LeadSubmitted' })).status, 404)    // not from an ad
assert.equal((await call('POST', '/events', { waId: '919876543210', eventName: 'Nope' })).status, 400)
const after2: any = await call('GET', '/lead', {}, { waId: '919876543210' })
assert.deepEqual(after2.body.lead.events.map((e: any) => e.eventName), ['QualifiedLead', 'Purchase', 'Purchase'])
assert.equal(((await call('GET', '/nothing')) as any).status, 404)

/* ── Conversions API ────────────────────────────────────────────────────────────────────────────────────── */
const body = buildCapiBody({ wabaId: 'W1', partnerAgent: 'acme' }, 'CLID', validateEvent({ eventName: 'Purchase', value: '499.5', currency: 'inr' }), 1_700_000_000)
assert.deepEqual(body, { data: [{ event_name: 'Purchase', event_time: 1_700_000_000, action_source: 'business_messaging', messaging_channel: 'whatsapp', user_data: { whatsapp_business_account_id: 'W1', ctwa_clid: 'CLID' }, custom_data: { currency: 'INR', value: 499.5 } }], partner_agent: 'acme' })
assert.equal('custom_data' in buildCapiBody({ wabaId: 'W1' }, 'C', validateEvent({ eventName: 'LeadSubmitted' }), 1).data[0]!, false)
const capiCalls: Call[] = []
const capi = createCapi({ wabaId: 'W1', accessToken: 'T', version: 'v20.0', fetchImpl: (async (url: string, init: any) => {
  const u = new URL(url); capiCalls.push({ method: init.method, url: u, headers: init.headers, body: init.body ? JSON.parse(init.body) : undefined })
  if (u.pathname.endsWith('/dataset')) return reply(init.method === 'GET' ? { data: [] } : { id: 'D1' })
  return reply({ events_received: 1 })
}) as any })
await capi.send('CLID', validateEvent({ eventName: 'LeadSubmitted' }))
await capi.send('CLID2', validateEvent({ eventName: 'QualifiedLead' }))
assert.deepEqual(capiCalls.map((c) => `${c.method} ${c.url.pathname.replace('/v20.0/', '')}`), ['GET W1/dataset', 'POST W1/dataset', 'POST D1/events', 'POST D1/events'])   // dataset created once, then reused

// live mode without a WhatsApp Business Account id refuses to pretend an event was sent
const liveNoCapi = createCtwa({ version: 'v20.0', adAccountId: '5', pageId: '7', adsToken: 'x'.repeat(30) }, createSampleStore(Date.now, true))
assert.equal(liveNoCapi.ads.mode, 'live'); assert.equal(liveNoCapi.capi, null)
assert.equal((await handleCtwaRequest({ method: 'POST', path: '/events', query: {}, body: { waId: '919876543210', eventName: 'LeadSubmitted' } }, liveNoCapi)).status, 503)

console.log('ctwa ok')
