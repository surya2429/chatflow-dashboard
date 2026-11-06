// Run: npx tsx scripts/marketingMessages.smoke.ts  (from backend/, with the WA_* env vars set — .env.example values are enough)
import assert from 'node:assert/strict'
import { MarketingMessagesClient } from '../src/whatsapp/marketingMessagesClient.js'
import { CloudApiClient } from '../src/whatsapp/cloudApiClient.js'
import { WhatsAppApiError } from '../src/whatsapp/types.js'

const calls: { url: string; body: any; auth: string }[] = []
globalThis.fetch = (async (url: string, init: any) => {
  calls.push({ url, body: JSON.parse(init.body), auth: init.headers.Authorization })
  return new Response(JSON.stringify({ messages: [{ id: 'wamid.X' }] }), { status: 200 })
}) as typeof fetch

const req = { to: '919876543210', template: { name: 'offer', language: { code: 'en' } }, callback: { messageId: 'm1', campaignId: 'c1' } }
const r = await new MarketingMessagesClient('111', 'tok').sendMarketingTemplate(req)
assert.equal(r.waMessageId, 'wamid.X')
assert.match(calls[0]!.url, /\/111\/marketing_messages$/); assert.equal(calls[0]!.body.type, 'template'); assert.equal(calls[0]!.auth, 'Bearer tok')
await new CloudApiClient('111', 'tok').sendTemplate({ ...req, category: 'utility' })
assert.match(calls[1]!.url, /\/111\/messages$/)
assert.equal(new WhatsAppApiError('x', 400, 131_063).isMarketingTemplateOnCloudApi, true)
assert.equal(new WhatsAppApiError('x', 400, 131_047).isMarketingTemplateOnCloudApi, false)
console.log('marketing messages smoke: ok')
