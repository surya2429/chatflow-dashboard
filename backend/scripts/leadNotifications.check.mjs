// Run: node scripts/leadNotifications.check.mjs  (from backend/) — recipients (max 5 per channel), the notification text and the HTML email.
import assert from 'node:assert/strict'
import {
  MAX_RECIPIENTS, NOTIFICATION_KINDS, addRecipient, buildNotificationMessage, formatPhone, formatStamp, normalizeRecipient, recipientsFor, SAMPLE_AT, SAMPLE_TOKEN, transcriptUrl,
} from '../../src/lib/leadNotifications.js'
import { buildEmailHtml } from '../../src/lib/emailTemplates.js'

// emails
assert.equal(normalizeRecipient('email', ' Boss@Company.COM ').value, 'boss@company.com')
assert.ok(normalizeRecipient('email', 'nope').error)
assert.ok(normalizeRecipient('email', '').error)

// SMS: Indian mobile numbers only, typed without the country code
assert.equal(normalizeRecipient('sms', '98765 43210').value, '+919876543210')
assert.equal(normalizeRecipient('sms', '098765-43210').value, '+919876543210', 'leading 0 dropped')
assert.equal(normalizeRecipient('sms', '+91 98765 43210').value, '+919876543210', 'typed with +91')
assert.match(normalizeRecipient('sms', '12345 67890').error, /Indian mobile/, 'must start 6-9')
assert.match(normalizeRecipient('sms', '98765').error, /Indian mobile/, 'too short')
assert.match(normalizeRecipient('sms', '+1 415 555 0132').error, /Indian mobile/, 'a foreign number is refused')
assert.match(normalizeRecipient('sms', '98765 43210', '+44').error, /Indian mobile/, 'India even if another dial is passed')
assert.ok(normalizeRecipient('sms', 'abc').error)
assert.equal(formatPhone('+919876543210'), '+91 98765 43210'); assert.equal(formatPhone('+14155550132'), '+14155550132')

// WhatsApp: Indian numbers only, same as SMS
assert.equal(normalizeRecipient('whatsapp', '98765 43210').value, '+919876543210')
assert.equal(normalizeRecipient('whatsapp', '+91 98765 43210').value, '+919876543210')
assert.match(normalizeRecipient('whatsapp', '415 555 0132', '+1').error, /WhatsApp works for Indian/, 'a foreign number is refused')
assert.match(normalizeRecipient('whatsapp', '+971 50 123 4567').error, /Indian mobile/)
assert.match(normalizeRecipient('whatsapp', '12345').error, /Indian mobile/)

// up to five, no duplicates, every kind on to begin with
let list = []
for (let i = 1; i <= MAX_RECIPIENTS; i++) { const r = addRecipient(list, 'email', `p${i}@x.com`); assert.ok(r.list && r.added.to === `p${i}@x.com`, i); list = r.list }
assert.match(addRecipient(list, 'email', 'p6@x.com').error, /up to 5/)
assert.match(addRecipient(list.slice(0, 2), 'email', 'P1@x.com').error, /already/)
assert.equal(new Set(list.map(r => r.id)).size, 5, 'unique ids')
assert.deepEqual(Object.keys(list[0].kinds), NOTIFICATION_KINDS.map(k => k.id)); assert.ok(Object.values(list[0].kinds).every(v => v === true))
assert.equal(NOTIFICATION_KINDS.length, 7)
assert.match(addRecipient(addRecipient([], 'sms', '9876543210').list, 'sms', '+91 98765 43210').error, /already/, 'same number typed two ways')

// who gets what
list[1].kinds.revisit = false
const cfg = { email: list }
assert.equal(recipientsFor(cfg, 'email', 'lead').length, 5)
assert.deepEqual(recipientsFor(cfg, 'email', 'revisit'), ['p1@x.com', 'p3@x.com', 'p4@x.com', 'p5@x.com'])
assert.deepEqual(recipientsFor(cfg, 'sms', 'lead'), [])
assert.equal(recipientsFor({ email: [{ to: 'old@x.com', kinds: { lead: true } }] }, 'email', 'weekly').length, 1, 'kind added later counts as on')
assert.equal(recipientsFor({ email: [{ to: 'old@x.com', kinds: { weekly: false } }] }, 'email', 'weekly').length, 0)

// the time reads in India time
assert.equal(formatStamp(SAMPLE_AT), '12 Nov 2026, 3:42 PM IST')
assert.equal(formatStamp(new Date('2026-12-31T20:30:00Z')), '1 Jan 2027, 2:00 AM IST')

// SMS: plain, short, names the chatbot, no transcript, no emoji
const sms = buildNotificationMessage({ kind: 'lead', channel: 'sms' }).text
assert.equal(sms, ['[Support Bot] New lead: Asha Rao', 'Mobile: +91 98765 43210', 'Email: asha@example.com', 'Location: Mumbai, India', 'Source: Website chat - Pricing page', 'Time: 12 Nov 2026, 3:42 PM IST'].join('\n'))
assert.ok(/^[\x20-\x7e\n]*$/.test(sms), 'basic characters only')
assert.ok(!/₹/.test(buildNotificationMessage({ kind: 'billing', channel: 'sms' }).text) && /Rs 4,999/.test(buildNotificationMessage({ kind: 'billing', channel: 'sms' }).text))
assert.match(buildNotificationMessage({ kind: 'revisit', channel: 'sms' }).text, /Visit: 3rd visit/)

// WhatsApp: formatted, names the chatbot, no transcript
const wa = buildNotificationMessage({ kind: 'lead', channel: 'whatsapp' }).text
assert.equal(wa, ['🔔 *New lead* · Support Bot', '', '👤 *Asha Rao*', '📱 +91 98765 43210', '✉️ asha@example.com', '📍 Mumbai, India', '🔗 Website chat · Pricing page', '', '🕒 12 Nov 2026, 3:42 PM IST'].join('\n'))
assert.match(buildNotificationMessage({ kind: 'revisit', channel: 'whatsapp' }).text, /^🔥 \*Hot lead is back\* · Support Bot[\s\S]*🔁 3rd visit/)
assert.match(buildNotificationMessage({ kind: 'weekly', channel: 'whatsapp', botName: 'Sales Bot' }).text, /^📈 \*Weekly report\* · Sales Bot\n\n\*Your week: 3 to 9 Nov 2026\*\n\n• Conversations: 412 \(\+12%\)/)

// email text: chatbot, details, then the transcript with the chatbot's name
const em = buildNotificationMessage({ kind: 'lead', channel: 'email' })
assert.equal(em.subject, '[Support Bot] New lead: Asha Rao')
assert.ok(em.text.includes('Chatbot: Support Bot') && em.text.indexOf('Source:') < em.text.indexOf('Chat transcript') && em.text.indexOf('Chat transcript') < em.text.indexOf('Support Bot: Hi!'))
assert.match(buildNotificationMessage({ kind: 'revisit', channel: 'email' }).subject, /^\[Support Bot\] Hot lead: Asha Rao/)
assert.match(buildNotificationMessage({ kind: 'lead', channel: 'sms', lead: { name: '' } }).text, /Mobile: Not shared/)

// every kind has a message on every channel, with the chatbot's name and a time; SMS stays short
for (const k of NOTIFICATION_KINDS) for (const channel of ['email', 'sms', 'whatsapp']) {
  const m = buildNotificationMessage({ kind: k.id, channel, botName: 'Acme Bot' })
  assert.ok(m.text.length > 20 && !m.text.includes('undefined') && !m.text.includes('NaN'), `${k.id}/${channel}`)
  assert.ok(m.text.includes('Acme Bot'), `${k.id}/${channel} bot name`)
  assert.ok(m.text.includes('12 Nov 2026, 3:42 PM IST'), `${k.id}/${channel} time`)
  assert.equal(!!m.subject, channel === 'email')
  assert.equal(m.text.includes('Chat transcript'), channel === 'email' && (k.id === 'lead' || k.id === 'revisit'), `${k.id}/${channel} transcript`)
  if (channel === 'sms') assert.ok(m.text.length <= 480, `${k.id} sms ${m.text.length}`)
}

// the designed email, for every kind
for (const k of NOTIFICATION_KINDS) {
  const { subject, preheader, html } = buildEmailHtml({ kind: k.id, botName: 'Acme Bot', baseUrl: 'https://app.test', to: 'me@x.com' })
  assert.ok(html.startsWith('<!doctype html>') && subject.startsWith('[Acme Bot] ') && preheader, k.id)
  assert.ok(html.includes('Acme Bot') && html.includes('>AB<'), `${k.id} chatbot in the header`)
  assert.ok(html.includes('12 Nov 2026, 3:42 PM IST'), `${k.id} time in the email`)
  assert.ok(html.includes('me@x.com') && html.includes('https://app.test/settings'), `${k.id} footer`)
  assert.ok(!html.includes('undefined') && !html.includes('NaN'), `${k.id} no undefined`)
  assert.ok(/href="https:\/\/app\.test\/[^"]+"/.test(html), `${k.id} button`)
}
const lead = buildEmailHtml({ kind: 'lead' }).html
assert.ok(lead.includes('href="tel:+919876543210"') && lead.includes('mailto:asha%40example.com') && lead.includes('https://wa.me/919876543210'), 'call, mail and WhatsApp links')
assert.ok(lead.includes('Conversation') && lead.includes('Hi! How can we help you today?') && lead.includes('3:38 PM'), 'transcript with times')
assert.ok(buildEmailHtml({ kind: 'revisit' }).html.includes('3rd visit.') && !lead.includes('3rd visit.'))
const usage = buildEmailHtml({ kind: 'consumption' }).html
assert.ok(usage.includes('80%') && usage.includes('width="80%"'), 'usage bar')
assert.ok(buildEmailHtml({ kind: 'billing' }).html.includes('₹4,999'))

// the conversation link: its own page, no login; the email shows it as the main button, the plain text gives it too
const link = transcriptUrl('https://app.test', 'Ab3_-xyz')
assert.equal(link, 'https://app.test/transcript/Ab3_-xyz'); assert.equal(transcriptUrl('https://app.test', SAMPLE_TOKEN), 'https://app.test/transcript/sample')
assert.equal(transcriptUrl('https://app.test', 'a/b?c'), 'https://app.test/transcript/a%2Fb%3Fc', 'a token cannot change the path')
const withLink = buildEmailHtml({ kind: 'lead', baseUrl: 'https://app.test', transcriptLink: link }).html
assert.ok(withLink.includes(`href="${link}"`) && withLink.includes('View conversation') && withLink.includes('without a login'))
assert.ok(!withLink.includes('Open conversation') && withLink.includes('https://app.test/webchat/inbox'), 'the dashboard is a small link, not the button')
const noLink = buildEmailHtml({ kind: 'lead', baseUrl: 'https://app.test' }).html
assert.ok(!noLink.includes('View conversation') && noLink.includes('Open conversation'), 'without a link the email is as before')
assert.ok(buildEmailHtml({ kind: 'revisit', baseUrl: 'https://app.test', transcriptLink: link }).html.includes('View conversation'))
assert.ok(!buildEmailHtml({ kind: 'weekly', baseUrl: 'https://app.test', transcriptLink: link }).html.includes('/transcript/'), 'reports have no conversation')
assert.ok(buildEmailHtml({ kind: 'lead', transcriptLink: 'x" onmouseover="alert(1)' }).html.includes('x&quot; onmouseover=&quot;'), 'link is escaped')
assert.ok(buildNotificationMessage({ kind: 'lead', channel: 'email', transcriptLink: link }).text.includes(`without logging in: ${link}`))
for (const channel of ['sms', 'whatsapp']) assert.ok(!buildNotificationMessage({ kind: 'lead', channel, transcriptLink: link }).text.includes('/transcript/'), `${channel} has no transcript`)
assert.ok(!buildNotificationMessage({ kind: 'weekly', channel: 'email', transcriptLink: link }).text.includes('/transcript/'))

// what a visitor typed can't inject markup or a link
const evil = buildEmailHtml({
  kind: 'lead', botName: '<i>Bot</i>',
  lead: { name: '<script>alert(1)</script>', phone: '"><img src=x onerror=alert(1)>', email: 'not an email', location: '<b>x</b>', source: "'; drop" },
  transcript: [{ from: 'user', at: SAMPLE_AT, text: '<img src=x onerror=alert(1)> <a href="javascript:alert(1)">hi</a>' }],
}).html
assert.ok(!evil.includes('<script>') && !evil.includes('<img src=x') && !evil.includes('<a href="javascript:') && !evil.includes('<b>x</b>') && !evil.includes('<i>Bot'), 'escaped')
assert.ok(!evil.includes('tel:') && !evil.includes('mailto:') && !evil.includes('wa.me'), 'bad phone/email get no link')
assert.ok(!buildEmailHtml({ kind: 'lead', transcript: [] }).html.includes('Conversation'), 'empty chat leaves the transcript out')
console.log('notifications: ok')
