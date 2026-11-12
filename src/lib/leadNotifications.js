/* Lead notifications: who is told about a lead, by email, SMS or WhatsApp, and what the message says.
   Each channel holds up to MAX_RECIPIENTS recipients; each recipient picks which kinds of notification they receive.
   The message always opens with the lead's details (mobile, email, location, source), then the chat transcript. */
export const MAX_RECIPIENTS = 5

export const NOTIFICATION_KINDS = [
  { id: 'lead',    label: 'Lead notification',          hint: 'When a visitor shares their details. Sent with the chat transcript.' },
  { id: 'revisit', label: 'Lead revisit (hot lead)',    hint: 'When a lead you already have comes back to chat. Sent with the chat transcript.' },
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
export const recipientsFor = (config, channel, kind) => (config?.[channel] || []).filter(r => r.kinds?.[kind]).map(r => r.to)

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
