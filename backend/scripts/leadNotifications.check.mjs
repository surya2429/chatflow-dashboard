// Run: node scripts/leadNotifications.check.mjs  (from backend/) — recipients (max 5 per channel), the notification text and the HTML email.
import assert from 'node:assert/strict'
import {
  MAX_RECIPIENTS, NOTIFICATION_KINDS, addRecipient, buildNotificationMessage, formatStamp, normalizeRecipient, recipientsFor, SAMPLE_AT,
} from '../../src/lib/leadNotifications.js'
import { buildEmailHtml, esc } from '../../src/lib/emailTemplates.js'

// addresses and numbers are checked
assert.equal(normalizeRecipient('email', ' Boss@Company.COM ').value, 'boss@company.com')
assert.ok(normalizeRecipient('email', 'nope').error)
assert.equal(normalizeRecipient('sms', '+91 98765-43210').value, '+919876543210')
assert.match(normalizeRecipient('sms', '9876543210').error, /country code/)
assert.ok(normalizeRecipient('whatsapp', '+12').error)
assert.ok(normalizeRecipient('email', '').error)

// up to five, no duplicates, every kind on to begin with
let list = []
for (let i = 1; i <= MAX_RECIPIENTS; i++) { const r = addRecipient(list, 'email', `p${i}@x.com`); assert.ok(r.list && r.added.to === `p${i}@x.com`, i); list = r.list }
assert.match(addRecipient(list, 'email', 'p6@x.com').error, /up to 5/)
assert.match(addRecipient(list.slice(0, 2), 'email', 'P1@x.com').error, /already/)
assert.equal(new Set(list.map(r => r.id)).size, 5, 'unique ids')
assert.deepEqual(Object.keys(list[0].kinds), NOTIFICATION_KINDS.map(k => k.id)); assert.ok(Object.values(list[0].kinds).every(v => v === true))
assert.equal(NOTIFICATION_KINDS.length, 7)

// who gets what
list[1].kinds.revisit = false
const cfg = { email: list }
assert.equal(recipientsFor(cfg, 'email', 'lead').length, 5)
assert.deepEqual(recipientsFor(cfg, 'email', 'revisit'), ['p1@x.com', 'p3@x.com', 'p4@x.com', 'p5@x.com'])
assert.deepEqual(recipientsFor(cfg, 'sms', 'lead'), [])
// a recipient saved before a kind existed still gets it; one who switched it off does not
assert.equal(recipientsFor({ email: [{ to: 'old@x.com', kinds: { lead: true } }] }, 'email', 'weekly').length, 1)
assert.equal(recipientsFor({ email: [{ to: 'old@x.com', kinds: { weekly: false } }] }, 'email', 'weekly').length, 0)

// the time reads in India time
assert.equal(formatStamp(SAMPLE_AT), '12 Nov 2026, 3:42 PM IST')
assert.equal(formatStamp(new Date('2026-12-31T20:30:00Z')), '1 Jan 2027, 2:00 AM IST')

// lead messages: time and details; the transcript only in the email
for (const channel of ['email', 'sms', 'whatsapp']) for (const kind of ['lead', 'revisit']) {
  const { text, subject } = buildNotificationMessage({ kind, channel })
  for (const d of ['Time: 12 Nov 2026, 3:42 PM IST', 'Mobile: +91 98765 43210', 'Email: asha@example.com', 'Location: Mumbai, India', 'Source: Website chat']) assert.ok(text.includes(d), `${channel}/${kind} ${d}`)
  assert.equal(text.includes('Chat transcript'), channel === 'email', `${channel}/${kind} transcript`)
  assert.equal(text.includes('Hi! How can we help'), channel === 'email')
  assert.ok(channel === 'email' ? !!subject : subject === undefined)
  assert.equal(text.includes('Visit: 3rd visit'), kind === 'revisit')
  assert.ok(text.indexOf('Time:') < text.indexOf('Mobile:'), 'details after the time, at the top')
}
const em = buildNotificationMessage({ kind: 'lead', channel: 'email' }).text
assert.ok(em.indexOf('Source:') < em.indexOf('Chat transcript') && em.indexOf('Chat transcript') < em.indexOf('Bot: Hi!'))
assert.match(buildNotificationMessage({ kind: 'revisit', channel: 'email' }).subject, /^Hot lead: Asha Rao/)
assert.match(buildNotificationMessage({ kind: 'lead', channel: 'whatsapp' }).text, /^\*New lead: Asha Rao\*/)
assert.match(buildNotificationMessage({ kind: 'lead', channel: 'sms', lead: { name: '' } }).text, /Mobile: Not shared/)

// every kind has a message on every channel, with a time; SMS stays short
for (const k of NOTIFICATION_KINDS) for (const channel of ['email', 'sms', 'whatsapp']) {
  const m = buildNotificationMessage({ kind: k.id, channel })
  assert.ok(m.text.length > 20 && !m.text.includes('undefined'), `${k.id}/${channel}`)
  assert.ok(/(Time|Sent): 12 Nov 2026, 3:42 PM IST/.test(m.text), `${k.id}/${channel} time`)
  assert.equal(!!m.subject, channel === 'email')
  if (channel === 'sms') assert.ok(m.text.length <= 480, `${k.id} sms ${m.text.length}`)
}
assert.match(buildNotificationMessage({ kind: 'billing', channel: 'whatsapp' }).text, /^\*Your SmatBot/)

// the designed email, for every kind
for (const k of NOTIFICATION_KINDS) {
  const { subject, preheader, html } = buildEmailHtml({ kind: k.id, baseUrl: 'https://app.test', to: 'me@x.com' })
  assert.ok(html.startsWith('<!doctype html>') && subject && preheader, k.id)
  assert.ok(html.includes('12 Nov 2026, 3:42 PM IST'), `${k.id} time in the email`)
  assert.ok(html.includes('me@x.com') && html.includes('https://app.test/settings'), `${k.id} footer`)
  assert.ok(!html.includes('undefined') && !html.includes('NaN'), `${k.id} no undefined`)
  assert.ok(/href="https:\/\/app\.test\/[^"]+"/.test(html), `${k.id} button`)
}
const lead = buildEmailHtml({ kind: 'lead' }).html
assert.ok(lead.includes('tel:+919876543210') && lead.includes('mailto:asha%40example.com'), 'call and mail links')
assert.ok(lead.includes('Chat transcript') && lead.includes('Hi! How can we help you today?') && lead.includes('3:38 PM'), 'transcript with times')
assert.ok(buildEmailHtml({ kind: 'revisit' }).html.includes('3 visits so far'))
assert.ok(!buildEmailHtml({ kind: 'lead' }).html.includes('visits so far'))
assert.ok(buildEmailHtml({ kind: 'consumption' }).html.includes('80%') && buildEmailHtml({ kind: 'consumption' }).html.includes('width="80%"'), 'usage bar')

// what a visitor typed can't inject markup or a link
const evil = buildEmailHtml({
  kind: 'lead',
  lead: { name: '<script>alert(1)</script>', phone: '"><img src=x onerror=alert(1)>', email: 'not an email', location: '<b>x</b>', source: "'; drop" },
  transcript: [{ from: 'user', at: SAMPLE_AT, text: '<img src=x onerror=alert(1)> <a href="javascript:alert(1)">hi</a>' }],
}).html
assert.ok(!evil.includes('<script>') && !evil.includes('<img src=x') && !evil.includes('<a href="javascript:') && !evil.includes('<b>x</b>'), 'escaped')
assert.ok(!evil.includes('tel:') && !evil.includes('mailto:'), 'bad phone/email get no link')
// an empty chat just leaves the transcript out
assert.ok(!buildEmailHtml({ kind: 'lead', transcript: [] }).html.includes('Chat transcript'))
console.log('notifications: ok')
