// Run: npx tsx scripts/marketingMessages.smoke.ts  (from backend/, with the WA_* env vars set — .env.example values are enough)
import assert from 'node:assert/strict'

process.env.MM_PRODUCT_POLICY = 'STRICT'
process.env.MM_ACTIVITY_SHARING = 'false'
const { MarketingMessagesClient } = await import('../src/whatsapp/marketingMessagesClient.js')
const { CloudApiClient } = await import('../src/whatsapp/cloudApiClient.js')
const { WhatsAppApiError } = await import('../src/whatsapp/types.js')
const { signLinkToken, verifyLinkToken, readTrackedLink, withTrackedLink, destinationWithQuery, clickIdOf } = await import('../src/marketing/trackedLink.js')
const { WebhookPayloadSchema } = await import('../src/webhooks/webhookTypes.js')
const { attributionService } = await import('../src/services/attributionService.js')
const { messageRepository } = await import('../src/db/repositories/messageRepository.js')

// ── the send endpoint ──
const calls: { url: string; body: any; auth: string }[] = []
globalThis.fetch = (async (url: string, init: any) => {
  calls.push({ url, body: JSON.parse(init.body), auth: init.headers.Authorization })
  return new Response(JSON.stringify({ messages: [{ id: 'wamid.X' }] }), { status: 200 })
}) as typeof fetch

const req = { to: '919876543210', template: { name: 'offer', language: { code: 'en' } }, callback: { messageId: 'm1', campaignId: 'c1' } }
const r = await new MarketingMessagesClient('111', 'tok').sendMarketingTemplate(req)
assert.equal(r.waMessageId, 'wamid.X')
assert.match(calls[0]!.url, /\/111\/marketing_messages$/); assert.equal(calls[0]!.body.type, 'template'); assert.equal(calls[0]!.auth, 'Bearer tok')
assert.equal(calls[0]!.body.biz_opaque_callback_data, undefined, 'an undocumented field is not sent to the new endpoint')
assert.equal(calls[0]!.body.product_policy, 'STRICT'); assert.equal(calls[0]!.body.message_activity_sharing, false)
await new CloudApiClient('111', 'tok').sendTemplate({ ...req, category: 'utility' })
assert.match(calls[1]!.url, /\/111\/messages$/)
assert.equal(new WhatsAppApiError('x', 400, 131_063).isMarketingTemplateOnCloudApi, true)
assert.equal(new WhatsAppApiError('x', 400, 131_047).isMarketingTemplateOnCloudApi, false)

// ── tracked link: signed per-message token ──
const SECRET = 'app-secret-for-tests-123456'
const MSG = '8f14e45f-ceea-4672-a1b2-0c3a5d2e9b77'
const token = signLinkToken(MSG, SECRET)
assert.ok(token.length < 60 && /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(token), 'short and URL-safe: it goes into a template URL button')
assert.equal(verifyLinkToken(token, SECRET), MSG)
assert.equal(verifyLinkToken(token, 'another-secret-123456789'), null)
assert.equal(verifyLinkToken(token.slice(0, -2) + 'AA', SECRET), null)
assert.equal(verifyLinkToken(signLinkToken('6ba7b810-9dad-11d1-80b4-00c04fd430c8', SECRET).split('.')[0] + '.' + token.split('.')[1], SECRET), null, 'a signature cannot be moved to another message')
for (const bad of ['', 'abc', 'a.b.c', '...', 'x'.repeat(100) + '.y']) assert.equal(verifyLinkToken(bad, SECRET), null)

assert.deepEqual(readTrackedLink({ trackedLink: { destination: 'https://shop.test/offer', buttonIndex: 1 } }), { buttonIndex: 1, destination: 'https://shop.test/offer' })
assert.equal(readTrackedLink({ trackedLink: { destination: 'http://shop.test' } }), null, 'https only')
assert.equal(readTrackedLink({ trackedLink: { destination: 'javascript:alert(1)' } }), null)
assert.equal(readTrackedLink({}), null)
const cfg = { buttonIndex: 0, destination: 'https://shop.test/offer' }
const comps = withTrackedLink([{ type: 'body', parameters: [{ type: 'text', text: 'Asha' }] }], cfg, token)
assert.deepEqual(comps[1], { type: 'button', sub_type: 'url', index: '0', parameters: [{ type: 'text', text: token }] })
assert.equal(withTrackedLink(comps, cfg, 'other').length, 2, 'a button the caller already supplied is left alone')
assert.equal(destinationWithQuery('https://shop.test/offer?utm=a', { click_id: 'abc', utm: 'zzz', n: ['x'] }), 'https://shop.test/offer?utm=a&click_id=abc', "Meta's click_id survives; the destination's own parameters win")
assert.equal(clickIdOf({ click_id: 'c1' }), 'c1'); assert.equal(clickIdOf({ fbclid: 'f1' }), 'f1'); assert.equal(clickIdOf({}), null)

// ── Meta's webhooks: link click event and status pricing category ──
const clickPayload = { object: 'whatsapp_business_account', entry: [{ id: 'w', changes: [{ field: 'messages', value: { messaging_product: 'whatsapp', metadata: { phone_number_id: '111' }, user_actions: [{ action_type: 'marketing_messages_link_click', timestamp: '1760000000', marketing_messages_link_click_data: { click_component: 'cta', click_id: 'cid', tracking_token: 't', product_id: 'sku' } }] } }] }] }
const parsed = WebhookPayloadSchema.parse(clickPayload)
assert.equal(parsed.entry[0]!.changes[0]!.value.user_actions![0]!.marketing_messages_link_click_data!.click_id, 'cid')
const statusPayload = { object: 'whatsapp_business_account', entry: [{ id: 'w', changes: [{ field: 'messages', value: { messaging_product: 'whatsapp', metadata: { phone_number_id: '111' }, statuses: [{ id: 'wamid.X', status: 'delivered', timestamp: '1', recipient_id: '9198', pricing: { category: 'marketing_lite', billable: true } }] } }] }] }
assert.equal(WebhookPayloadSchema.parse(statusPayload).entry[0]!.changes[0]!.value.statuses![0]!.pricing!.category, 'marketing_lite')

// ── replies: which campaign does an inbound message belong to? (repository stubbed) ──
const msgs: Record<string, any> = {
  'wamid.campaign': { campaign_id: 'camp-1', wa_message_id: 'wamid.campaign' },
  'wamid.agent': { campaign_id: null, wa_message_id: 'wamid.agent' },
}
messageRepository.findByWaMessageId = (async (id: string) => msgs[id] ?? null) as any
let windowLookups = 0
messageRepository.findLatestMarketingToContact = (async (contactId: string) => { windowLookups++; return contactId === 'recent' ? { campaign_id: 'camp-2', wa_message_id: 'wamid.recent' } : null }) as any

let a = await attributionService.resolveCampaignId({ contextMessageId: 'wamid.campaign', contactId: 'c' })
assert.deepEqual([a.campaignId, a.via], ['camp-1', 'context']); assert.equal(windowLookups, 0)
a = await attributionService.resolveCampaignId({ contactId: 'recent' }) // typed an answer, quoted nothing
assert.deepEqual([a.campaignId, a.via, a.originMessageId], ['camp-2', 'window', 'wamid.recent'])
a = await attributionService.resolveCampaignId({ contextMessageId: 'wamid.agent', contactId: 'recent' }) // replying to an agent message is a conversation, not a campaign reply
assert.deepEqual([a.campaignId, a.via], [null, null])
a = await attributionService.resolveCampaignId({ contactId: 'stranger' })
assert.deepEqual([a.campaignId, a.via], [null, null])

console.log('marketing messages smoke: ok')
process.exit(0) // the DB pool opened by the repository import keeps the process alive otherwise
