// pricing.js — the SmatBot plan structure (Broadcast · Standard · Pro · AI),
// from the "New Plan Structure" pricing sheet. One place, so Billing, the plan
// badge, the Home card and integration gating all agree.
//
// All prices are in ₹ and EXCLUSIVE of GST. Yearly plans are billed upfront and
// get all twelve months of message allowance credited at once.

export const PLANS = [
  {
    id: 'broadcast', name: 'Broadcast', color: '#64748b', monthly: 1499, yearly: 14500,
    desc: 'WhatsApp template/broadcast messages, plus unlimited Website and Instagram messages and Google Sheets integration. No bot — replies are handled by an agent from the dashboard.',
    serviceMsgs: 10000, biMsgs: 1000,
  },
  {
    id: 'standard', name: 'Standard', color: '#0066ff', monthly: 3500, yearly: 35000,
    desc: 'Flow/menu-driven chatbot with Google Sheets integration. Platforms: WhatsApp, Website, Instagram + Landing Page Chatbot. Feature add-ons available — upgrade to Pro for all add-ons.',
    serviceMsgs: 30000, biMsgs: 2000,
  },
  {
    id: 'pro', name: 'Pro', color: '#8b5cf6', monthly: 6500, yearly: 72000, highlight: true,
    desc: 'Flow-based bot with the full feature set. 6 platforms: WhatsApp, Website, Facebook Messenger, Instagram Messenger, Applications & Landing Page Chatbot. All add-ons available.',
    serviceMsgs: 100000, biMsgs: 5000,
  },
  {
    id: 'ai', name: 'AI', color: '#059669', monthly: 8999, yearly: 96000,
    desc: 'Everything in Pro, plus AI integration with ChatGPT. All add-ons available.',
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
  { group: 'Platforms', rows: [
    { label: 'WhatsApp',             wa: true, v: [Y, Y, Y, Y] },
    { label: 'Website',              v: [Y, Y, Y, Y] },
    { label: 'Facebook Messenger',   v: [N, N, Y, Y] },
    { label: 'Instagram Messenger',  v: [Y, Y, Y, Y] },
    { label: 'Applications (in-app)', v: [N, N, Y, Y] },
    { label: 'Landing Page Chatbot', v: [N, Y, Y, Y] },
  ] },
  { group: 'Message & Chat Limits', rows: [
    { label: 'Website Messages',   v: ['Unlimited', 'Unlimited', 'Unlimited', 'Unlimited'] },
    { label: 'Instagram Messages', v: ['Unlimited', 'Unlimited', 'Unlimited', 'Unlimited'] },
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
    { label: 'Dynamic Responses', v: [N, Y, Y, Y] },
    { label: 'Canned Responses', v: [N, Y, Y, Y] },
    { label: 'Live Agents', note: '3 included in Pro & AI', v: [A, A, Y, Y] },
    { label: 'CRM', v: [A, A, Y, Y] },
    { label: 'AI Agent (Dialogflow)', v: [A, A, Y, Y] },
    { label: 'ChatGPT Integration', v: [A, A, A, Y] },
    { label: 'Voice Enabled (Speech to Text)', v: [N, N, Y, Y] },
    { label: 'Multi-Lingual (up to 2 languages)', v: [A, A, Y, Y] },
    { label: 'Auto Email Follow-up', v: [N, N, Y, Y] },
    { label: 'AdWords Tracking', v: [N, Y, Y, Y] },
    { label: 'Facebook Pixel', v: [N, N, Y, Y] },
  ] },
  { group: 'Security & Notifications', rows: [
    { label: 'Lead Email Notifications', v: [N, Y, Y, Y] },
    { label: 'Two-Factor Authentication (2FA)', v: [N, Y, Y, Y] },
  ] },
  { group: 'Add-ons & Customization', rows: [
    { label: 'Add-ons Available', v: ['Feature add-ons only', 'Feature add-ons only', Y, Y] },
  ] },
]

/* Feature add-ons for plans that don't include the feature. Prices not set yet. */
export const FEATURE_ADDONS = [
  { name: 'Template Text Replies + Template Button Click Responses', note: 'one add-on', on: 'Broadcast, Standard', wa: true },
  { name: 'CRM', on: 'Broadcast, Standard' },
  { name: 'WhatsApp Cart & Catalog', on: 'Broadcast, Standard', wa: true },
  { name: 'Live Agents', on: 'Broadcast, Standard' },
  { name: 'AI Agent (Dialogflow)', on: 'Broadcast, Standard' },
  { name: 'Multi-Lingual (up to 2 languages)', on: 'Broadcast, Standard' },
  { name: 'ChatGPT Integration', on: 'Broadcast, Standard, Pro' },
]

/* Usage add-ons (Pro & AI only). Reference prices from the pricing sheet —
   to be confirmed before publishing. Yearly = what the sheet lists, not 12×. */
export const USAGE_ADDONS = [
  { name: 'Extra Chatbots',        unit: 'per 5 chatbots',          m: 1000,  y: 9600 },
  { name: 'Extra Live Agent',      unit: 'per agent',               m: 1000,  y: 9600 },
  { name: 'Extra Language',        unit: 'per language beyond 2',   m: 1000,  y: 9600 },
  { name: 'WhatsApp BI Messages',  unit: 'per 1,000 messages/mo',   m: 200,   y: 2400,   wa: true },
  { name: 'UI / Website Chats',    unit: 'per 1,000 chats/mo',      m: 600,   y: 7200 },
  { name: 'SMS OTPs',              unit: 'per 1,000 OTPs',          m: 500,   y: 6000 },
  { name: 'WhatsApp OTPs',         unit: 'per 1,000 OTPs',          m: 500,   y: 6000,   wa: true },
  { name: 'SMS Notifications',     unit: 'per 1,000 notifications', m: 500,   y: 6000 },
  { name: 'WhatsApp Notifications', unit: 'per 1,000 notifications', m: 500,  y: 6000,   wa: true },
  { name: 'Media Upload',          unit: 'per 50 files',            m: 800,   y: 9600 },
  { name: 'Text to Speech',        unit: 'flat rate',               m: 800,   y: 7200 },
  { name: 'Remove Branding',       unit: 'flat rate',               m: 1900,  y: 20280 },
  { name: 'Basic Support',         unit: 'flat rate',               m: 6999,  y: 71988 },
  { name: 'Premium Support',       unit: 'flat rate',               m: 14999, y: 143988 },
]

/* What each plan is for, in one glance (the long descriptions stay in PLANS). */
export const PLAN_HIGHLIGHTS = {
  broadcast: ['WhatsApp template & broadcast messages', 'Unlimited Website & Instagram messages', 'Google Sheets integration', 'Replies handled by an agent (no bot)'],
  standard:  ['Everything in Broadcast', 'Flow / menu-driven chatbot', 'WhatsApp, Website, Instagram & Landing Page', 'Canned & dynamic responses, lead emails, 2FA'],
  pro:       ['Everything in Standard', '6 platforms incl. Messenger & in-app', '3 live agents, CRM & AI Agent included', 'Voice, multi-lingual & auto email follow-up'],
  ai:        ['Everything in Pro', 'ChatGPT AI integration included', 'Highest message allowances', 'All add-ons available'],
}

/* Demo workspace subscription. */
export const SUBSCRIPTION = { start: '2026-01-01', renews: '2027-01-01' }
