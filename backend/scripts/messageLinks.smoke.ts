// Run: npx tsx scripts/messageLinks.smoke.ts  (from backend/)
// Checks the request shapes sent to Meta and the input guards. No network, no credentials.
import assert from 'node:assert/strict'
import { messageLinkResponse } from '../src/whatsapp/messageLinks.js'

const creds = { phoneNumberId: '555', accessToken: 'tok', version: 'v20.0' }
const calls: Array<{ url: string; method?: string; body?: unknown; auth?: string }> = []
const fake = (async (url: string, init: RequestInit = {}) => {
  calls.push({ url, method: init.method, body: init.body ? JSON.parse(String(init.body)) : undefined, auth: (init.headers as Record<string, string>)?.Authorization })
  const ok = (b: unknown) => ({ ok: true, status: 200, json: async () => b })
  if (init.method === 'DELETE') return ok({ success: true })
  if (init.method === 'GET') return ok({ data: [{ code: 'ABC123', prefilled_message: 'Hi', deep_link_url: 'https://wa.me/message/ABC123' }] })
  return ok({ code: 'ABC123', prefilled_message: 'Hi', deep_link_url: 'https://wa.me/message/ABC123', qr_image_url: 'https://qr/x.svg' })
}) as unknown as typeof fetch

const created = await messageLinkResponse({ method: 'POST', body: { prefilledMessage: ' Hi ' } }, creds, fake)
assert.equal(created.status, 201)
assert.deepEqual(calls[0]!.body, { prefilled_message: 'Hi', generate_qr_image: 'SVG' })
assert.ok(calls[0]!.url.endsWith('/555/message_qrdls') && calls[0]!.auth === 'Bearer tok')
assert.equal((created.body as { deepLinkUrl: string }).deepLinkUrl, 'https://wa.me/message/ABC123')

const list = await messageLinkResponse({ method: 'GET' }, creds, fake)
assert.equal((list.body as { items: unknown[] }).items.length, 1)

await messageLinkResponse({ method: 'PUT', code: 'ABC123', body: { prefilledMessage: 'Yo' } }, creds, fake)
assert.deepEqual(calls[2]!.body, { code: 'ABC123', prefilled_message: 'Yo' })

await messageLinkResponse({ method: 'DELETE', code: 'ABC123' }, creds, fake)
assert.ok(calls[3]!.url.endsWith('/message_qrdls/ABC123') && calls[3]!.method === 'DELETE')

// guards
assert.deepEqual((await messageLinkResponse({ method: 'GET' }, { version: 'v20.0' }, fake)).body, { configured: false })
assert.equal((await messageLinkResponse({ method: 'POST', body: { prefilledMessage: '' } }, creds, fake)).status, 400)
assert.equal((await messageLinkResponse({ method: 'POST', body: { prefilledMessage: 'x'.repeat(141) } }, creds, fake)).status, 400)
assert.equal((await messageLinkResponse({ method: 'DELETE', code: '../../me' }, creds, fake)).status, 400)
assert.equal(calls.length, 4)   // nothing invalid reached Meta
console.log('messageLinks ok')
