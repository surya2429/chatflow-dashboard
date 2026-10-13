// pricing.js — the SmatBot plan structure (Broadcast · Standard · Pro · AI),
// from the "New Plan Structure" pricing sheet. One place, so Billing, the plan
// badge, the Home card and integration gating all agree.
//
// All prices are in ₹ and EXCLUSIVE of GST. Yearly plans are billed upfront and
// get all twelve months of message allowance credited at once.

export const PLANS = [
  {
    id: 'broadcast', name: 'Broadcast', color: '#64748b', monthly: 1499, yearly: 14500, chatbots: 2,
    desc: 'WhatsApp template/broadcast messages with Google Sheets integration. No bot — replies are handled by an agent from the dashboard.',
    serviceMsgs: 1000, biMsgs: 1000,
  },
  {
    id: 'standard', name: 'Standard', color: '#0066ff', monthly: 3500, yearly: 35000, chatbots: 5,
    desc: 'Flow/menu-driven chatbot with Google Sheets integration. Platforms: WhatsApp, Website, Instagram + Landing Page Chatbot. All add-ons available.',
    serviceMsgs: 30000, biMsgs: 2000,
  },
  {
    id: 'pro', name: 'Pro', color: '#8b5cf6', monthly: 6500, yearly: 72000, chatbots: 10, highlight: true,
    desc: 'Flow-based bot with the full feature set. 6 platforms: WhatsApp, Website, Facebook Messenger, Instagram Messenger, Applications & Landing Page Chatbot. All add-ons available.',
    serviceMsgs: 100000, biMsgs: 5000,
  },
  {
    id: 'ai', name: 'AI', color: '#059669', monthly: 8999, yearly: 96000, chatbots: 10,
    desc: 'Everything in Pro, plus AI integration. All add-ons available.',
    serviceMsgs: 500000, biMsgs: 10000,
  },
]

/* Plan order doubles as the tier: Broadcast 0 · Standard 1 · Pro 2 · AI 3. */
export const planTier = name => PLANS.findIndex(p => p.name.toLowerCase() === String(name || '').toLowerCase())
export const getPlan = name => PLANS[planTier(name)] || null

/* Derived figures so they can never drift from the prices above. */
export function planMath(p) {
  const year = p.monthly * 12
  const saves = year - p.yearly
  return { year, saves, savesPct: Math.round((saves / year) * 100), yearlyPerMonth: Math.round(p.yearly / 12) }
}

export const inr = n => `₹${Math.round(n).toLocaleString('en-US')}`
export const num = n => Math.round(n).toLocaleString('en-US')

/* The plan this demo workspace is on. */
export const CURRENT_PLAN = 'Pro'
export const CURRENT_BILLING = 'yearly'

/* ── Feature comparison ────────────────────────────────────────────────────
   Cell values, one per plan in PLANS order:
     true / false  → tick / dash         'addon'      → "Add-on" badge
     'text'        → shown as a note     { perMonth } → allowance, credited monthly or upfront
   `wa: true` marks WhatsApp-only rows (hidden for Website Chat).               */
const Y = true, N = false, A = 'addon'
export const FEATURE_GROUPS = [
  { group: 'Overview', rows: [
    { label: 'Bot Type', v: ['Broadcast only (no bot)', 'Flow / menu-driven', 'Flow-based (full feature set)', 'Flow-based + AI integration'] },
    { label: 'Chatbots Included', v: PLANS.map(p => String(p.chatbots)) },
  ] },
  { group: 'Platforms', rows: [
    { label: 'WhatsApp',             wa: true, v: [Y, Y, Y, Y] },
    { label: 'Website',              v: [Y, Y, Y, Y] },
    { label: 'Facebook Messenger',   v: [N, N, Y, Y] },
    { label: 'Instagram Messenger',  v: [N, Y, Y, Y] },
    { label: 'Applications (in-app)', v: [N, N, Y, Y] },
    { label: 'Landing Page Chatbot', v: [N, Y, Y, Y] },
  ] },
  { group: 'Message & Chat Limits', rows: [
    { label: 'Website Messages',   v: [N, 'Unlimited', 'Unlimited', 'Unlimited'] },
    { label: 'Instagram Messages', v: [N, 'Unlimited', 'Unlimited', 'Unlimited'] },
    { label: 'WhatsApp Service (UI) Messages', note: '+ Meta charges applicable', wa: true, v: PLANS.map(p => ({ perMonth: p.serviceMsgs })) },
    { label: 'WhatsApp BI Messages',           note: '+ Meta charges applicable', wa: true, v: PLANS.map(p => ({ perMonth: p.biMsgs })) },
  ] },
  { group: 'WhatsApp Behaviour', wa: true, rows: [
    { label: 'Send Template / Broadcast Messages', v: [Y, Y, Y, Y] },
    { label: 'Two-Way Bot Conversation on WhatsApp', v: [N, Y, Y, Y] },
    { label: 'Template Text Replies', note: 'Same add-on as Button Click Responses', v: [A, A, Y, Y] },
    { label: 'Template Button Click Responses', note: 'Same add-on as Template Text Replies', v: [A, A, Y, Y] },
    { label: 'WhatsApp Cart & Catalog', v: [A, A, Y, Y] },
  ] },
  { group: 'Bot & Automation', rows: [
    { label: 'Google Sheets Integration', v: [Y, Y, Y, Y] },
    { label: 'Custom Google Sheet', v: [N, Y, Y, Y] },
    { label: 'Custom Webhook Integration', v: [N, Y, Y, Y] },
    { label: 'Dynamic Responses', v: [N, Y, Y, Y] },
    { label: 'Canned Responses', v: [N, Y, Y, Y] },
    { label: 'Live Agents', note: '3 included in Pro & AI', v: [A, A, Y, Y] },
    { label: 'Media Upload', v: [Y, Y, Y, Y] },
    { label: 'Contacts', v: [Y, Y, Y, Y] },
    { label: 'CRM', v: [A, A, Y, Y] },
    { label: 'AI Agent (Dialogflow)', v: [A, A, Y, Y] },
    { label: 'AI Integration', v: [A, A, A, Y] },
    { label: 'Voice Enabled (Speech to Text)', v: [N, N, Y, Y] },
    { label: 'Multi-Lingual (up to 2 languages)', v: [A, A, Y, Y] },
    { label: 'Auto Email Follow-up', v: [N, N, Y, Y] },
    { label: 'AdWords Tracking', v: [N, N, Y, Y] },
    { label: 'Facebook Pixel', v: [N, N, Y, Y] },
  ] },
  { group: 'Security & Notifications', rows: [
    { label: 'Lead Email Notifications', v: [N, Y, Y, Y] },
    { label: 'Hot Lead Notifications', v: [N, N, Y, Y] },
    { label: 'Email OTP Validation', v: [N, A, A, A] },
    { label: 'Two-Factor Authentication (2FA)', v: [N, Y, Y, Y] },
  ] },
  { group: 'Analytics & Reports', rows: [
    { label: 'Analytics', v: [Y, Y, Y, Y] },
  ] },
  { group: 'Add-ons & Customization', rows: [
    { label: 'Add-ons Available', v: [Y, Y, Y, Y] },
    { label: 'Custom Development / Customization', note: 'Quoted & charged separately — all plans', v: ['Quoted', 'Quoted', 'Quoted', 'Quoted'] },
  ] },
]

/* Add-ons, exactly as on the pricing sheet. `on` = the plans each can be bought with (the server's catalog,
   backend/src/billing/catalog.ts, mirrors this — keep them in sync). Prices are ₹ excl. GST; `y` is the
   sheet's yearly price, not 12× monthly. `kind: 'feature'` = a capability a higher plan already includes;
   `kind: 'usage'` = extra capacity. `wa` = WhatsApp-only (hidden for Website Chat). */
const ALL = ['broadcast', 'standard', 'pro', 'ai']
export const ADDONS = [
  { id: 'template-replies', kind: 'feature', name: 'Template Text Replies + Template Button Click Responses', note: 'one add-on', unit: 'flat rate', on: ['broadcast', 'standard'], m: 1000, y: 9600, wa: true },
  { id: 'crm',              kind: 'feature', name: 'CRM',                         unit: 'flat rate', on: ['broadcast', 'standard'], m: 1000, y: 9600 },
  { id: 'cart-catalog',     kind: 'feature', name: 'WhatsApp Cart & Catalog',     unit: 'flat rate', on: ['broadcast', 'standard'], m: 1000, y: 9600, wa: true },
  { id: 'extra-live-agent', kind: 'usage',   name: 'Live Agent',                  unit: 'per agent (Pro & AI: beyond the 3 included)', on: ALL, m: 1000, y: 9600 },
  { id: 'ai-agent',         kind: 'feature', name: 'AI Agent (Dialogflow)',       unit: 'flat rate', on: ['broadcast', 'standard'], m: 1000, y: 9600 },
  { id: 'extra-language',   kind: 'usage',   name: 'Multi-Lingual / Extra Language', unit: 'Broadcast & Standard: up to 2 languages · Pro & AI: per language beyond 2', on: ALL, m: 1000, y: 9600 },
  { id: 'ai-integration',   kind: 'feature', name: 'AI Integration',              unit: 'flat rate', on: ['broadcast', 'standard', 'pro'], m: 2000, y: 24000 },
  { id: 'email-otp',        kind: 'usage',   name: 'Email OTP Validation',        unit: '1,000 email OTPs / mo (12,000 / yr added upfront)', on: ['standard', 'pro', 'ai'], m: 500, y: 6000 },
  { id: 'extra-chatbots',   kind: 'usage',   name: 'Extra Chatbots',              unit: 'per 5 chatbots', on: ALL, m: 1000, y: 9600 },
  { id: 'wa-bi-messages',   kind: 'usage',   name: 'WhatsApp BI Messages',        unit: '1,000 messages / mo (12,000 / yr added upfront)', on: ALL, m: 200, y: 2400, wa: true },
  { id: 'web-chats',        kind: 'usage',   name: 'UI / Website Chats',          unit: 'per 1,000 chats / mo', on: ALL, m: 600, y: 7200 },
  { id: 'sms-otps',         kind: 'usage',   name: 'SMS OTPs',                    unit: '1,000 OTPs / mo (12,000 / yr added upfront)', on: ALL, m: 500, y: 6000 },
  { id: 'wa-otps',          kind: 'usage',   name: 'WhatsApp OTPs',               unit: '1,000 OTPs / mo (12,000 / yr added upfront)', on: ALL, m: 500, y: 6000, wa: true },
  { id: 'sms-notifications', kind: 'usage',  name: 'SMS Notifications',           unit: '1,000 notifications / mo (12,000 / yr added upfront)', on: ALL, m: 500, y: 6000 },
  { id: 'wa-notifications', kind: 'usage',   name: 'WhatsApp Notifications',      unit: '1,000 notifications / mo (12,000 / yr added upfront)', on: ALL, m: 500, y: 6000, wa: true },
  { id: 'text-to-speech',   kind: 'usage',   name: 'Text to Speech',              unit: 'flat rate', on: ALL, m: 800, y: 7200 },
  { id: 'remove-branding',  kind: 'usage',   name: 'Remove Branding',             unit: 'flat rate', on: ALL, m: 1900, y: 20280 },
  { id: 'basic-support',    kind: 'usage',   name: 'Basic Support',               unit: 'flat rate', on: ALL, m: 6999, y: 71988 },
  { id: 'premium-support',  kind: 'usage',   name: 'Premium Support',             unit: 'flat rate', on: ALL, m: 14999, y: 143988 },
]

/* What each plan is for, in one glance (the long descriptions stay in PLANS). */
export const PLAN_HIGHLIGHTS = {
  broadcast: ['WhatsApp template & broadcast messages', 'Google Sheets integration', 'Replies handled by an agent (no bot)', '2 chatbots'],
  standard:  ['Everything in Broadcast, plus a bot', 'Flow / menu-driven chatbot · 5 chatbots', 'WhatsApp, Website, Instagram & Landing Page', 'Custom Google Sheet & webhook, lead emails, 2FA'],
  pro:       ['Everything in Standard', '6 platforms incl. Messenger & in-app · 10 chatbots', '3 live agents, CRM & AI Agent included', 'Voice, multi-lingual, auto email follow-up, hot-lead alerts'],
  ai:        ['Everything in Pro', 'AI integration included', 'Highest message allowances', 'All add-ons available'],
}

/* Demo workspace subscription. */
export const SUBSCRIPTION = { start: '2026-01-01', renews: '2027-01-01' }

/* ₹ amount that keeps paise when there are any (GST makes ₹1,768.82, not ₹1,769). */
export const money = (n) => '₹' + Number(n).toLocaleString('en-US', { minimumFractionDigits: Number.isInteger(n) ? 0 : 2, maximumFractionDigits: 2 })

/* Demo usage figures — one place so Billing, Home and the profile menu agree. */
export const DEMO_USAGE = { svcUsed: 23481, biUsed: 1204 }
