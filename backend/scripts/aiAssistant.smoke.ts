// Run: npx tsx scripts/aiAssistant.smoke.ts  (from backend/)
import assert from 'node:assert/strict'
import { buildPrompt, decryptKey, encryptKey, extractJson, handleAiRequest, shapeResult, type AiStore, type StoredAi } from '../src/ai/aiAssistant.js'

// the key round-trips, and a wrong secret cannot read it
const enc = encryptKey('sk-test-1234567890', 'secret-secret-secret')
assert.ok(!enc.includes('sk-test'))
assert.equal(decryptKey(enc, 'secret-secret-secret'), 'sk-test-1234567890')
assert.throws(() => decryptKey(enc, 'another-secret-value!'))

// prompts: conversation text is trimmed, empty input is refused
const conv = { id: 'c1', name: 'Priya', channel: 'webchat', status: 'bot', messages: Array.from({ length: 100 }, (_, i) => ({ who: 'customer', text: `m${i} ${'x'.repeat(900)}` })) }
const p = buildPrompt('summary', { conversation: conv })!
assert.ok(p.user.includes('m99') && !p.user.includes('m39 ') && p.user.length < 60 * 520)
assert.equal(buildPrompt('summary', { conversation: { id: 'c', messages: [] } }), null)
assert.equal(buildPrompt('ask', { conversations: [conv], question: '' }), null)
assert.ok(buildPrompt('reply', { conversation: conv })!.system.includes('DATA'))

// model output is coerced to what the UI draws
assert.deepEqual(extractJson('Sure!\n```json\n{"a":1}\n```'), { a: 1 })
const s = shapeResult('summary', '{"summary":"S","sentiment":"furious","urgency":"high","topics":["a","b","c","d","e"],"nextStep":"N","extra":1}') as any
assert.deepEqual(s, { summary: 'S', sentiment: 'neutral', urgency: 'high', topics: ['a', 'b', 'c', 'd'], nextStep: 'N' })
assert.throws(() => shapeResult('inbox', 'no json here'))

// the handler: save verifies the key first, never returns it, run uses the stored one
const mem = new Map<string, StoredAi>()
const store: AiStore = { load: async (w) => mem.get(w) ?? null, save: async (w, v) => void mem.set(w, v), remove: async (w) => void mem.delete(w) }
const calls: any[] = []
let reject = false
const fetchFn = (async (url: string, init: any) => {
  calls.push({ url, init })
  if (reject) return { ok: false, status: 401, json: async () => ({}) }
  return { ok: true, status: 200, json: async () => ({ content: [{ text: calls.length === 1 ? 'OK' : '{"summary":"Wants a refund","sentiment":"negative","urgency":"high","topics":["refund"],"nextStep":"Refund"}' }] }) }
}) as any
const deps = { store, secret: 'secret-secret-secret', allow: () => true, fetchFn }
const base = { workspace: 'w', ip: '1.1.1.1' }

assert.equal((await handleAiRequest({ ...base, method: 'PUT', route: 'settings', body: { provider: 'anthropic', model: 'claude-sonnet-5-5' } }, deps)).status, 400)      // no key
assert.equal((await handleAiRequest({ ...base, method: 'PUT', route: 'settings', body: { provider: 'anthropic', model: 'bad model!', apiKey: 'sk-ant-123456789' } }, deps)).status, 400)
reject = true
assert.equal((await handleAiRequest({ ...base, method: 'PUT', route: 'settings', body: { provider: 'anthropic', model: 'claude-sonnet-5-5', apiKey: 'sk-ant-123456789' } }, deps)).status, 400)
assert.equal(mem.size, 0)                                                                                                                                                   // nothing saved for a rejected key
reject = false
calls.length = 0
const saved = await handleAiRequest({ ...base, method: 'PUT', route: 'settings', body: { provider: 'anthropic', model: 'claude-sonnet-5-5', apiKey: 'sk-ant-123456789' } }, deps)
assert.equal(saved.status, 200)
assert.ok(!JSON.stringify(saved.body).includes('sk-ant-123456789') && (saved.body as any).keyHint === '…6789')
assert.equal(calls[0].init.headers['x-api-key'], 'sk-ant-123456789')
const out = await handleAiRequest({ ...base, method: 'POST', route: 'run', body: { task: 'summary', conversation: { ...conv, messages: [{ who: 'customer', text: 'I want a refund' }] } } }, deps)
assert.equal(out.status, 200)
assert.equal((out.body as any).sentiment, 'negative')
assert.equal(calls[1].init.headers['x-api-key'], 'sk-ant-123456789')
// switching provider without a new key must not reuse the old key
assert.equal((await handleAiRequest({ ...base, method: 'PUT', route: 'settings', body: { provider: 'openai', model: 'gpt-4o-mini' } }, deps)).status, 400)
// not configured / rate-limited
assert.equal((await handleAiRequest({ ...base, workspace: 'other', method: 'POST', route: 'run', body: { task: 'ask', question: 'x', conversations: [conv] } }, deps)).status, 409)
assert.equal((await handleAiRequest({ ...base, method: 'POST', route: 'run', body: { task: 'summary', conversation: conv } }, { ...deps, allow: () => false })).status, 429)
assert.equal((await handleAiRequest({ ...base, method: 'DELETE', route: 'settings', body: {} }, deps)).status, 200)
assert.equal(mem.size, 0)
console.log('aiAssistant ok')
