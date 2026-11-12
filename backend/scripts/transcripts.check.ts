// Run: npx tsx scripts/transcripts.check.ts  (from backend/) — the shareable conversation page: what is stored, and who can read it.
import assert from 'node:assert/strict'
import { MAX_MESSAGES, MAX_TEXT, TOKEN, TRANSCRIPT_DAYS, cleanTranscript, newToken, publishTranscript, viewTranscript, type StoredTranscript, type TranscriptStore } from '../src/transcripts/transcripts.js'

// in-memory stand-in for Postgres, with the same "one row per conversation, keeps its first token" rule
function memoryStore(): TranscriptStore & { rows: Map<string, { token: string; t: StoredTranscript; expiresAt: Date }> } {
  const rows = new Map<string, { token: string; t: StoredTranscript; expiresAt: Date }>()
  return {
    rows,
    async save(t, token, expiresAt) {
      const kept = rows.get(t.conversationId)?.token ?? token
      rows.set(t.conversationId, { token: kept, expiresAt, t: { botName: t.botName, visitorName: t.visitorName, messages: t.messages, updatedAt: new Date().toISOString() } })
      return kept
    },
    async find(token, now) {
      for (const r of rows.values()) if (r.token === token && r.expiresAt > now) return r.t
      return null
    },
  }
}
const msg = (from: string, text: string, at = '2026-11-12T10:00:00Z') => ({ from, at, text })
const convo = (id = 'c1', messages: unknown[] = [msg('bot', 'Hi!'), msg('user', 'Hello')]) => ({ conversationId: id, botName: 'Support Bot', visitorName: 'Asha', messages })

// tokens: long, url-safe, never repeated
const tokens = new Set(Array.from({ length: 500 }, newToken))
assert.equal(tokens.size, 500); assert.ok([...tokens].every(t => TOKEN.test(t)), '32 url-safe characters')

// cleaning: bad messages are dropped, text is trimmed and capped, an empty or id-less conversation is refused
const cleaned = cleanTranscript(convo('c1', [msg('bot', ' Hi '), msg('robot', 'x'), msg('user', ''), msg('user', 'a', 'not a date'), msg('agent', 'b'), null, 7, { from: 'user', text: 'no time' }]))!
assert.deepEqual(cleaned.messages.map(m => m.text), ['Hi', 'b']); assert.equal(cleaned.messages[0]!.at, '2026-11-12T10:00:00.000Z')
assert.equal(cleanTranscript(convo('c1', []))!, null); assert.equal(cleanTranscript(convo('', [msg('bot', 'x')])), null)
assert.equal(cleanTranscript(null), null); assert.equal(cleanTranscript('x'), null)
assert.equal(cleanTranscript(convo('c1', [msg('user', 'x'.repeat(MAX_TEXT + 50))]))!.messages[0]!.text.length, MAX_TEXT)
const many = cleanTranscript(convo('c1', Array.from({ length: MAX_MESSAGES + 20 }, (_, i) => msg('user', `m${i}`))))!
assert.equal(many.messages.length, MAX_MESSAGES); assert.equal(many.messages.at(-1)!.text, `m${MAX_MESSAGES + 19}`, 'keeps the latest')
assert.equal(cleanTranscript({ ...convo(), botName: '', visitorName: 42 })!.botName, 'Chatbot')

// publish, then read it back by the token
const store = memoryStore(), now = new Date('2026-11-12T10:00:00Z')
const a = (await publishTranscript(convo('c1'), store, now))!
assert.ok(TOKEN.test(a.token)); assert.equal(a.expiresAt.getTime() - now.getTime(), TRANSCRIPT_DAYS * 86_400_000)
const seen = await viewTranscript(a.token, store, now)
assert.equal(seen.status, 200); assert.deepEqual((seen.body as StoredTranscript).messages.map(m => m.text), ['Hi!', 'Hello'])
assert.ok(!JSON.stringify(seen.body).includes('c1'), 'the conversation id is not given out')

// each conversation has its own link; publishing the same one again keeps its link and refreshes what it shows
const b = (await publishTranscript(convo('c2'), store, now))!
assert.notEqual(a.token, b.token)
const again = (await publishTranscript(convo('c1', [msg('bot', 'Hi!'), msg('user', 'Hello'), msg('bot', 'More')]), store, now))!
assert.equal(again.token, a.token); assert.equal(((await viewTranscript(a.token, store, now)).body as StoredTranscript).messages.length, 3)
assert.equal(store.rows.size, 2)
assert.equal(await publishTranscript(convo('c3', []), store, now), null, 'nothing to publish')

// who gets a 404: a token that is wrong, malformed, unknown, or expired - all the same answer
assert.equal((await viewTranscript(newToken(), store, now)).status, 404)
for (const bad of ['', 'abc', a.token + 'x', a.token.slice(1), '../etc/passwd', "' OR 1=1 --"]) assert.equal((await viewTranscript(bad, store, now)).status, 404, bad)
assert.equal((await viewTranscript(a.token, store, new Date(now.getTime() + (TRANSCRIPT_DAYS + 1) * 86_400_000))).status, 404, 'expired')
assert.equal(((await viewTranscript('nope', store, now)).body as { error: string }).error, 'not_found')
console.log('transcripts: ok')
