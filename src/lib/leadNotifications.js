/* Lead notifications: who is told about a lead, by email, SMS or WhatsApp, and what the message says.
   Each channel holds up to MAX_RECIPIENTS recipients; each recipient picks which kinds of notification they receive.
   The message always opens with the lead's details (mobile, email, location, source), then the chat transcript. */
export const MAX_RECIPIENTS = 5

/* What a recipient can be told about. `group` only decides where it sits in the settings screen. */
export const NOTIFICATION_KINDS = [
  { id: 'lead',        group: 'leads',   label: 'New lead is created in chatbot',        hint: "Sent with the lead's details and the chat transcript." },
  { id: 'revisit',     group: 'leads',   label: 'Lead revisit (hot lead)',               hint: "A lead you already have comes back to chat. Sent with the lead's details and the chat transcript." },
  { id: 'billing',     group: 'account', label: 'Billing and renewals',                  hint: 'Upcoming renewals and payments.' },
  { id: 'consumption', group: 'account', label: 'Chat consumption threshold',            hint: 'When your chat usage is close to its limit.' },
  { id: 'weekly',      group: 'account', label: 'Weekly statistics',                     hint: 'A summary of last week, every Monday.' },
  { id: 'templates',   group: 'account', label: 'Template statistics',                   hint: 'How your message templates performed.' },
  { id: 'updates',     group: 'account', label: 'New features and updates from SmatBot', hint: 'Product news and releases.' },
]
export const KIND_GROUPS = [
  { id: 'leads',   label: 'Leads' },
  { id: 'account', label: 'Account and reports' },
]

export const NOTIFICATION_CHANNELS = {
  email:    { label: 'Email',    noun: 'email address', placeholder: 'name@company.com' },
  sms:      { label: 'SMS',      noun: 'mobile number', placeholder: '+91 98765 43210' },
  whatsapp: { label: 'WhatsApp', noun: 'WhatsApp number', placeholder: '+91 98765 43210' },
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/** Cleans what was typed. Returns { value } or { error }. Numbers need a country code and are stored as +digits. */
export function normalizeRecipient(channel, raw) {
  const t = String(raw || '').trim()
  if (!t) return { error: `Enter an ${NOTIFICATION_CHANNELS[channel].noun}.` }
  if (channel === 'email') return EMAIL.test(t) ? { value: t.toLowerCase() } : { error: 'Enter a valid email address.' }
  const digits = t.replace(/[\s().-]/g, '')
  if (!digits.startsWith('+')) return { error: 'Start with the country code, for example +91 98765 43210.' }
  return /^\+[1-9]\d{7,14}$/.test(digits) ? { value: digits } : { error: 'Enter a valid number with its country code.' }
}

/** Adds a recipient with every kind switched on. Returns { list } or { error }. */
export function addRecipient(list, channel, raw) {
  if (list.length >= MAX_RECIPIENTS) return { error: `You can add up to ${MAX_RECIPIENTS}.` }
  const r = normalizeRecipient(channel, raw)
  if (r.error) return r
  if (list.some(x => x.to === r.value)) return { error: 'That one is already in the list.' }
  const kinds = Object.fromEntries(NOTIFICATION_KINDS.map(k => [k.id, true]))
  return { list: [...list, { id: `r${Date.now().toString(36)}${list.length}`, to: r.value, kinds }] }
}

/** Who should get `kind` on `channel`: what a sender reads when a lead event happens. */
// a kind missing from a saved recipient (added after they were) counts as on, like it does for a new one
export const isOn = (recipient, kind) => recipient.kinds?.[kind] !== false
export const recipientsFor = (config, channel, kind) => (config?.[channel] || []).filter(r => isOn(r, kind)).map(r => r.to)

const KEY = 'cf_lead_notifications'
// shortcut: saved in this browser only, so another browser or teammate won't see it; move to the server with the sender.
export function loadNotificationConfig() {
  try {
    const c = JSON.parse(localStorage.getItem(KEY) || '{}')
    return Object.fromEntries(Object.keys(NOTIFICATION_CHANNELS).map(ch => [ch, (Array.isArray(c[ch]) ? c[ch] : []).slice(0, MAX_RECIPIENTS)]))
  } catch { return { email: [], sms: [], whatsapp: [] } }
}
export function saveNotificationConfig(config) {
  try { localStorage.setItem(KEY, JSON.stringify(config)) } catch { /* private mode: it just won't persist */ }
}

/* ── the message ─────────────────────────────────────────────────────────── */
export const SAMPLE_LEAD = {
  name: 'Asha Rao', phone: '+91 98765 43210', email: 'asha@example.com', location: 'Mumbai, India', source: 'Website chat · Pricing page', visits: 3,
}
export const SAMPLE_TRANSCRIPT = [
  { from: 'bot',  text: 'Hi! How can we help you today?' },
  { from: 'user', text: 'I want to know about the 2 BHK options.' },
  { from: 'bot',  text: 'Sure. Could I get your mobile number so our team can call you?' },
  { from: 'user', text: '+91 98765 43210' },
  { from: 'bot',  text: 'Thanks, Asha! Someone will call you shortly.' },
]

const dash = v => (String(v ?? '').trim() || 'Not shared')
const ordinal = n => n + (n % 100 >= 11 && n % 100 <= 13 ? 'th' : { 1: 'st', 2: 'nd', 3: 'rd' }[n % 10] || 'th')
const LIMITS = { sms: 480, whatsapp: 3800 }   // characters we keep for the whole message; email has no limit

/** The lines of the transcript that fit in `room` characters, keeping the most recent ones. */
function fitTranscript(lines, room) {
  if (room == null) return lines
  const kept = []
  let used = 0
  for (const l of [...lines].reverse()) {
    if (used + l.length + 1 > room) break
    kept.unshift(l); used += l.length + 1
  }
  if (kept.length < lines.length) {
    if (!kept.length && room > 20) kept.push(lines[lines.length - 1].slice(0, room - 1) + '…')
    kept.unshift('…')
  }
  return kept
}

/** { subject?, text } for one notification. `kind` is 'lead' or 'revisit'; the details always come before the transcript. */
export function buildLeadMessage({ kind, channel, lead = SAMPLE_LEAD, transcript = SAMPLE_TRANSCRIPT }) {
  const revisit = kind === 'revisit'
  const who = lead.name || 'A visitor'
  const bold = t => channel === 'whatsapp' ? `*${t}*` : t
  const title = revisit ? `Hot lead: ${who} is back on your website chat` : `New lead: ${who}`
  const details = [
    `Name: ${dash(lead.name)}`, `Mobile: ${dash(lead.phone)}`, `Email: ${dash(lead.email)}`,
    `Location: ${dash(lead.location)}`, `Source: ${dash(lead.source)}`,
    ...(revisit && lead.visits > 1 ? [`Visit: ${ordinal(lead.visits)} visit`] : []),
  ]
  const lines = transcript.map(m => `${m.from === 'bot' ? 'Bot' : who}: ${String(m.text ?? '').replace(/\s+/g, ' ').trim()}`)
  const head = [bold(title), '', ...details, '', bold('Chat transcript')]
  const room = LIMITS[channel] == null ? null : LIMITS[channel] - head.join('\n').length - 1
  const text = [...head, ...fitTranscript(lines, room)].join('\n')
  return channel === 'email' ? { subject: title, text } : { text }
}

/* The account and report notifications. Sample figures: they show the layout of each message. */
const SAMPLE_REPORTS = {
  billing:     { title: 'Your SmatBot Growth plan renews on 15 Dec 2026', lines: ['Plan: Growth (monthly)', 'Amount: ₹4,999 + GST', 'Renews on: 15 Dec 2026', 'Manage your plan under Settings > Billing & Plan.'] },
  consumption: { title: 'You have used 80% of your chat limit', lines: ['Chats used: 8,000 of 10,000', 'Plan: Growth', 'Resets on: 1 Dec 2026', 'Add more chats or upgrade under Settings > Billing & Plan to avoid interruption.'] },
  weekly:      { title: 'Your weekly SmatBot report: 3 to 9 Nov 2026', lines: ['Conversations: 412', 'New leads: 58', 'Hot lead revisits: 9', 'Average first response: 42 sec', 'Resolved: 87%'] },
  templates:   { title: 'Template statistics: last 7 days', lines: ['Sent: 12,400', 'Delivered: 11,980 (96.6%)', 'Read: 8,310 (66.9%)', 'Replies: 1,042', 'Failed: 62', 'Top template: order_update (3,100 sent)'] },
  updates:     { title: 'What is new at SmatBot', lines: ['Property Cards: a real estate question type with photos, videos and price.', 'OTP verification by SMS, WhatsApp or email.', 'Facebook Catalog: manage products and share them on WhatsApp.'] },
}

/** { subject?, text } for any notification kind, shown with sample data. */
export function buildNotificationMessage({ kind, channel }) {
  if (kind === 'lead' || kind === 'revisit') return buildLeadMessage({ kind, channel })
  const m = SAMPLE_REPORTS[kind]
  const text = [channel === 'whatsapp' ? `*${m.title}*` : m.title, '', ...m.lines].join('\n').slice(0, LIMITS[channel] ?? Infinity)
  return channel === 'email' ? { subject: m.title, text } : { text }
}
