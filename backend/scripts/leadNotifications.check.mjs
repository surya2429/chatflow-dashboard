// Run: node scripts/leadNotifications.check.mjs  (from backend/) — recipients (max 5 per channel) and the notification text.
import assert from 'node:assert/strict'
import { MAX_RECIPIENTS, addRecipient, buildLeadMessage, normalizeRecipient, recipientsFor, SAMPLE_LEAD } from '../../src/lib/leadNotifications.js'

// addresses and numbers are checked
assert.equal(normalizeRecipient('email', ' Boss@Company.COM ').value, 'boss@company.com')
assert.ok(normalizeRecipient('email', 'nope').error)
assert.equal(normalizeRecipient('sms', '+91 98765-43210').value, '+919876543210')
assert.match(normalizeRecipient('sms', '9876543210').error, /country code/)
assert.ok(normalizeRecipient('whatsapp', '+12').error)
assert.ok(normalizeRecipient('email', '').error)

// up to five, no duplicates, every kind on to begin with
let list = []
for (let i = 1; i <= MAX_RECIPIENTS; i++) { const r = addRecipient(list, 'email', `p${i}@x.com`); assert.ok(r.list, i); list = r.list }
assert.match(addRecipient(list, 'email', 'p6@x.com').error, /up to 5/)
assert.match(addRecipient(list.slice(0, 2), 'email', 'P1@x.com').error, /already/)
assert.equal(new Set(list.map(r => r.id)).size, 5, 'unique ids')
assert.deepEqual(list[0].kinds, { lead: true, revisit: true })

// who gets what
list[1].kinds.revisit = false
const cfg = { email: list }
assert.equal(recipientsFor(cfg, 'email', 'lead').length, 5)
assert.deepEqual(recipientsFor(cfg, 'email', 'revisit'), ['p1@x.com', 'p3@x.com', 'p4@x.com', 'p5@x.com'])
assert.deepEqual(recipientsFor(cfg, 'sms', 'lead'), [])

// details come before the transcript, on every channel and kind
for (const channel of ['email', 'sms', 'whatsapp']) for (const kind of ['lead', 'revisit']) {
  const { text, subject } = buildLeadMessage({ kind, channel })
  const at = s => text.indexOf(s)
  for (const d of ['Mobile: +91 98765 43210', 'Email: asha@example.com', 'Location: Mumbai, India', 'Source: Website chat']) assert.ok(at(d) > -1, `${channel}/${kind} ${d}`)
  assert.ok(at('Source:') < at('Chat transcript') && at('Chat transcript') < at('Bot: Hi!'), `${channel}/${kind} order`)
  assert.ok(channel === 'email' ? !!subject : subject === undefined)
  assert.equal(text.includes('Visit: 3rd visit'), kind === 'revisit')
}
assert.match(buildLeadMessage({ kind: 'revisit', channel: 'email' }).subject, /^Hot lead: Asha Rao/)
assert.match(buildLeadMessage({ kind: 'lead', channel: 'whatsapp' }).text, /^\*New lead: Asha Rao\*/)
// missing details say so instead of printing "undefined"
assert.match(buildLeadMessage({ kind: 'lead', channel: 'sms', lead: { name: '' } }).text, /Mobile: Not shared/)
// a long chat is cut to the most recent messages for SMS, never for email
const long = Array.from({ length: 80 }, (_, i) => ({ from: i % 2 ? 'user' : 'bot', text: `message number ${i} with some words in it` }))
const sms = buildLeadMessage({ kind: 'lead', channel: 'sms', transcript: long }).text
assert.ok(sms.length <= 480, `sms ${sms.length}`); assert.ok(sms.includes('message number 79') && !sms.includes('message number 0 '))
assert.ok(buildLeadMessage({ kind: 'lead', channel: 'email', transcript: long }).text.includes('message number 0 '))
assert.ok(SAMPLE_LEAD.phone)
console.log('lead notifications: ok')
