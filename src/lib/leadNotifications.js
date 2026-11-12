/* Notifications: who is told what, by email, SMS or WhatsApp, and what the message says.
   Each channel holds up to MAX_RECIPIENTS recipients; each recipient picks which kinds they receive.
   Every message carries a timestamp. Lead messages open with the lead's details (mobile, email, location, source);
   only the email adds the chat transcript. The designed HTML email is built in emailTemplates.js from the same data. */
export const MAX_RECIPIENTS = 5

/* What a recipient can be told about. `group` only decides where it sits in the settings screen. */
export const NOTIFICATION_KINDS = [
  { id: 'lead',        group: 'leads',   label: 'New lead is created in chatbot',        hint: "The lead's details and the time. The email also has the chat transcript." },
  { id: 'revisit',     group: 'leads',   label: 'Lead revisit (hot lead)',               hint: 'A lead you already have comes back to chat. Same details; the email has the transcript.' },
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

/** Adds a recipient with every kind switched on. Returns { list, added } or { error }. */
export function addRecipient(list, channel, raw) {
  if (list.length >= MAX_RECIPIENTS) return { error: `You can add up to ${MAX_RECIPIENTS}.` }
  const r = normalizeRecipient(channel, raw)
  if (r.error) return r
  if (list.some(x => x.to === r.value)) return { error: 'That one is already in the list.' }
  const kinds = Object.fromEntries(NOTIFICATION_KINDS.map(k => [k.id, true]))
  const added = { id: `r${Date.now().toString(36)}${list.length}`, to: r.value, kinds }
  return { list: [...list, added], added }
}

// a kind missing from a saved recipient (added after they were) counts as on, like it does for a new one
export const isOn = (recipient, kind) => recipient.kinds?.[kind] !== false
/** Who should get `kind` on `channel`: what a sender reads when an event happens. */
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

/* ── time ────────────────────────────────────────────────────────────────── */
// shortcut: times are shown in India time, the workspace default; use the workspace time zone once Settings stores one.
const TZ = 'Asia/Kolkata'
export const formatTime = (d, timeZone = TZ) => new Intl.DateTimeFormat('en-US', { timeZone, hour: 'numeric', minute: '2-digit', hour12: true }).format(d)
export const formatDay = (d, timeZone = TZ) => new Intl.DateTimeFormat('en-GB', { timeZone, day: 'numeric', month: 'short', year: 'numeric' }).format(d)
/** "12 Nov 2026, 3:42 PM IST" */
export const formatStamp = (d, timeZone = TZ) => `${formatDay(d, timeZone)}, ${formatTime(d, timeZone)}${timeZone === TZ ? ' IST' : ''}`

/* ── sample data (what the previews show) ────────────────────────────────── */
export const SAMPLE_AT = new Date('2026-11-12T10:12:00Z')
export const SAMPLE_LEAD = {
  name: 'Asha Rao', phone: '+91 98765 43210', email: 'asha@example.com', location: 'Mumbai, India', source: 'Website chat · Pricing page', visits: 3,
}
const minutesBefore = n => new Date(SAMPLE_AT.getTime() - n * 60_000)
export const SAMPLE_TRANSCRIPT = [
  { from: 'bot',  at: minutesBefore(4), text: 'Hi! How can we help you today?' },
  { from: 'user', at: minutesBefore(3), text: 'I want to know about the 2 BHK options.' },
  { from: 'bot',  at: minutesBefore(2), text: 'Sure. Could I get your mobile number so our team can call you?' },
  { from: 'user', at: minutesBefore(1), text: '+91 98765 43210' },
  { from: 'bot',  at: SAMPLE_AT,        text: 'Thanks, Asha! Someone will call you shortly.' },
]

/* The account and report notifications. Sample figures: they show the layout of each message.
   `rows` and `stats` are facts shown in every channel; `intro`, `meter`, `items` and `cta` dress up the email. */
export const REPORTS = {
  billing: {
    title: 'Your SmatBot Growth plan renews on 15 Dec 2026', kicker: 'Billing and renewals',
    intro: 'Your plan renews automatically in 33 days. Nothing to do if your payment details are up to date.',
    rows: [['Plan', 'Growth (monthly)'], ['Amount', '₹4,999 + GST'], ['Renews on', '15 Dec 2026']],
    cta: { label: 'Manage billing', path: '/settings?section=billing' },
  },
  consumption: {
    title: 'You have used 80% of your chat limit', kicker: 'Chat usage',
    intro: 'Add more chats or upgrade your plan before you reach the limit, so conversations are never interrupted.',
    meter: { label: 'Chats used', used: 8000, limit: 10000 },
    rows: [['Plan', 'Growth'], ['Resets on', '1 Dec 2026']],
    cta: { label: 'Add chats or upgrade', path: '/settings?section=billing' },
  },
  weekly: {
    title: 'Your weekly SmatBot report: 3 to 9 Nov 2026', kicker: 'Weekly statistics',
    intro: 'Here is how last week went across your chatbot.',
    stats: [['Conversations', '412', '+12%'], ['New leads', '58', '+8%'], ['Hot lead revisits', '9', '+3'], ['Resolved', '87%', '+2 pts'], ['First response', '42 sec', '-6 sec']],
    cta: { label: 'Open analytics', path: '/analytics' },
  },
  templates: {
    title: 'Template statistics: last 7 days', kicker: 'Template statistics',
    intro: 'How your WhatsApp message templates performed this week.',
    stats: [['Sent', '12,400', ''], ['Delivered', '11,980', '96.6%'], ['Read', '8,310', '66.9%'], ['Replies', '1,042', '8.4%'], ['Failed', '62', '0.5%']],
    rows: [['Top template', 'order_update (3,100 sent)']],
    cta: { label: 'View templates', path: '/templates' },
  },
  updates: {
    title: 'What is new at SmatBot', kicker: 'New features and updates',
    intro: 'A few things we shipped recently.',
    items: [
      ['Property Cards', 'A real estate question type with photos, videos and prices.'],
      ['OTP verification', 'Verify a visitor by SMS, WhatsApp or email.'],
      ['Facebook Catalog', 'Manage products and share them on WhatsApp.'],
    ],
    cta: { label: 'See what is new', path: '/' },
  },
}

const dash = v => (String(v ?? '').trim() || 'Not shared')
export const ordinal = n => n + (n % 100 >= 11 && n % 100 <= 13 ? 'th' : { 1: 'st', 2: 'nd', 3: 'rd' }[n % 10] || 'th')
export const leadTitle = (kind, lead) => kind === 'revisit' ? `Hot lead: ${lead.name || 'A visitor'} is back on your website chat` : `New lead: ${lead.name || 'A visitor'}`

/** The lead's details, in the order they are shown. */
export const leadRows = (kind, lead) => [
  ['Name', dash(lead.name)], ['Mobile', dash(lead.phone)], ['Email', dash(lead.email)], ['Location', dash(lead.location)], ['Source', dash(lead.source)],
  ...(kind === 'revisit' && lead.visits > 1 ? [['Visit', `${ordinal(lead.visits)} visit`]] : []),
]

/** The facts of a report as "Label: value" lines. */
const reportFacts = m => [
  ...(m.rows || []).map(([k, v]) => `${k}: ${v}`),
  ...(m.stats || []).map(([k, v, d]) => `${k}: ${v}${d ? ` (${d})` : ''}`),
  ...(m.meter ? [`${m.meter.label}: ${m.meter.used.toLocaleString('en-US')} of ${m.meter.limit.toLocaleString('en-US')} (${Math.round(m.meter.used / m.meter.limit * 100)}%)`] : []),
  ...(m.items || []).map(([k, v]) => `${k}: ${v}`),
]

/** { subject?, text } for one notification, as plain text. Only the email carries the chat transcript.
    `at` is when it happened (a Date); the sample time is used when none is given. */
export function buildNotificationMessage({ kind, channel, lead = SAMPLE_LEAD, transcript = SAMPLE_TRANSCRIPT, at = SAMPLE_AT }) {
  const bold = t => channel === 'whatsapp' ? `*${t}*` : t
  const isLead = kind === 'lead' || kind === 'revisit'
  const m = REPORTS[kind]
  const title = isLead ? leadTitle(kind, lead) : m.title
  const body = isLead ? leadRows(kind, lead).map(([k, v]) => `${k}: ${v}`) : reportFacts(m)
  const parts = [bold(title), `${isLead ? 'Time' : 'Sent'}: ${formatStamp(at)}`, '', ...body]
  if (isLead && channel === 'email') {
    const who = lead.name || 'Visitor'
    parts.push('', bold('Chat transcript'), ...transcript.map(t => `${t.from === 'bot' ? 'Bot' : who}: ${String(t.text ?? '').replace(/\s+/g, ' ').trim()}`))
  }
  const text = parts.join('\n')
  return channel === 'email' ? { subject: title, text } : { text: channel === 'sms' ? text.slice(0, 480) : text }
}
