// catalog.ts — what SmatBot sells and what it costs, decided on the SERVER so a browser can never
// choose its own price (it only ever sends plan ids, add-on ids and quantities).
//
// The price list is editable in the admin console (Plans & add-ons). It is stored as the 'catalog'
// doc and loaded into the live views below with applyCatalog(); DEFAULT_CATALOG is the pricing sheet,
// used until someone edits it. Every importer reads PLAN_CATALOG / ADDON_CATALOG / PLAN_ORDER /
// FEATURES, which applyCatalog refills in place — so an edit is seen everywhere without a restart.
//
// Prices are ₹ excl. GST; GST is added on top at charge time. Customers keep the prices they bought
// at (PriceLock) until they change plan — a price edit only affects new sales.

export type PlanId = string
export type Period = 'monthly' | 'yearly'
/** true = included · false = not available · 'addon' = available as an add-on · text = shown as is ("Unlimited") */
export type FeatureValue = boolean | 'addon' | string

/* ── what can be metered ─────────────────────────────────────────────────
   count = consumed (messages, OTPs …), allowance is per month (a yearly or custom term gets every
   month credited upfront as one pool); gauge = how many exist right now (chatbots, live agents …). */
export const METRICS: Record<string, { label: string; kind: 'count' | 'gauge' }> = {
  wa_service:        { label: 'WhatsApp service messages', kind: 'count' },
  wa_bi:             { label: 'WhatsApp BI messages', kind: 'count' },
  web_chats:         { label: 'Website chats', kind: 'count' },
  ig_messages:       { label: 'Instagram messages', kind: 'count' },
  sms_otps:          { label: 'SMS OTPs', kind: 'count' },
  wa_otps:           { label: 'WhatsApp OTPs', kind: 'count' },
  email_otps:        { label: 'Email OTPs', kind: 'count' },
  sms_notifications: { label: 'SMS notifications', kind: 'count' },
  wa_notifications:  { label: 'WhatsApp notifications', kind: 'count' },
  chatbots:          { label: 'Chatbots', kind: 'gauge' },
  agents:            { label: 'Live agents', kind: 'gauge' },
  languages:         { label: 'Languages', kind: 'gauge' },
}
export const isMetric = (v: unknown): v is string => typeof v === 'string' && v in METRICS

export interface PlanInfo {
  id: PlanId
  name: string
  monthly: number
  yearly: number
  /** printed on the invoice and the pricing page */
  desc: string
  botType: string
  highlights: string[]
  /** allowance per metric; counts are per month. Missing = not included; null = unlimited. */
  limits: Record<string, number | null>
  features: Record<string, FeatureValue>
  /** public = on the pricing page · private = only SmatBot staff can give it (custom deals) */
  visibility: 'public' | 'private'
  /** archived = no new sales; customers already on it keep it */
  status: 'active' | 'archived'
}

export interface AddonDef {
  id: string
  name: string
  unit: string
  /** ₹ for ONE unit per period; yearly is the sheet's yearly price, not 12× monthly */
  monthly: number
  yearly: number
  /** most that can be bought at once; 1 = a flat-rate add-on */
  maxQty: number
  /** plans it can be bought with */
  plans: PlanId[]
  kind: 'feature' | 'usage'
  /** features it switches on, on plans where they are 'addon' */
  unlocks?: string[]
  /** what one unit adds to an allowance */
  meter?: { metric: string; size: number }
  /** WhatsApp-only (hidden for Website Chat) */
  whatsapp?: boolean
  /** can't be bought together with these */
  excludes?: string[]
  status: 'active' | 'archived'
}

export interface FeatureDef { key: string; group: string; label: string; note?: string; whatsapp?: boolean }

export interface Catalog {
  version: number
  updatedAt: number
  updatedBy?: string
  plans: PlanInfo[]
  addons: AddonDef[]
  features: FeatureDef[]
}

/* ── the pricing sheet (Downloads/smatbot-new-pricing) as defaults ───────── */
const Y = true, N = false, A = 'addon'
const FEATURE_ROWS: (FeatureDef & { v: FeatureValue[] })[] = [
  { key: 'whatsapp', group: 'Platforms', label: 'WhatsApp', whatsapp: true, v: [Y, Y, Y, Y] },
  { key: 'website', group: 'Platforms', label: 'Website', v: [Y, Y, Y, Y] },
  { key: 'facebook-messenger', group: 'Platforms', label: 'Facebook Messenger', v: [N, N, Y, Y] },
  { key: 'instagram', group: 'Platforms', label: 'Instagram Messenger', v: [N, Y, Y, Y] },
  { key: 'in-app', group: 'Platforms', label: 'Applications (in-app)', v: [N, N, Y, Y] },
  { key: 'landing-page', group: 'Platforms', label: 'Landing Page Chatbot', v: [N, Y, Y, Y] },
  { key: 'website-messages', group: 'Message & Chat Limits', label: 'Website Messages', v: [N, 'Unlimited', 'Unlimited', 'Unlimited'] },
  { key: 'instagram-messages', group: 'Message & Chat Limits', label: 'Instagram Messages', v: [N, 'Unlimited', 'Unlimited', 'Unlimited'] },
  { key: 'templates-broadcast', group: 'WhatsApp Behaviour', label: 'Send Template / Broadcast Messages', whatsapp: true, v: [Y, Y, Y, Y] },
  { key: 'two-way-bot', group: 'WhatsApp Behaviour', label: 'Two-Way Bot Conversation on WhatsApp', whatsapp: true, v: [N, Y, Y, Y] },
  { key: 'template-text-replies', group: 'WhatsApp Behaviour', label: 'Template Text Replies', note: 'Same add-on as Button Click Responses', whatsapp: true, v: [A, A, Y, Y] },
  { key: 'template-button-responses', group: 'WhatsApp Behaviour', label: 'Template Button Click Responses', note: 'Same add-on as Template Text Replies', whatsapp: true, v: [A, A, Y, Y] },
  { key: 'cart-catalog', group: 'WhatsApp Behaviour', label: 'WhatsApp Cart & Catalog', whatsapp: true, v: [A, A, Y, Y] },
  { key: 'google-sheets', group: 'Bot & Automation', label: 'Google Sheets Integration', v: [Y, Y, Y, Y] },
  { key: 'custom-google-sheet', group: 'Bot & Automation', label: 'Custom Google Sheet', v: [N, Y, Y, Y] },
  { key: 'custom-webhook', group: 'Bot & Automation', label: 'Custom Webhook Integration', v: [N, Y, Y, Y] },
  { key: 'dynamic-responses', group: 'Bot & Automation', label: 'Dynamic Responses', v: [N, Y, Y, Y] },
  { key: 'canned-responses', group: 'Bot & Automation', label: 'Canned Responses', v: [N, Y, Y, Y] },
  { key: 'live-agents', group: 'Bot & Automation', label: 'Live Agents', note: '3 included in Pro & AI', v: [A, A, Y, Y] },
  { key: 'media-upload', group: 'Bot & Automation', label: 'Media Upload', v: [Y, Y, Y, Y] },
  { key: 'contacts', group: 'Bot & Automation', label: 'Contacts', v: [Y, Y, Y, Y] },
  { key: 'crm', group: 'Bot & Automation', label: 'CRM', v: [A, A, Y, Y] },
  { key: 'ai-agent', group: 'Bot & Automation', label: 'AI Agent (Dialogflow)', v: [A, A, Y, Y] },
  { key: 'ai-integration', group: 'Bot & Automation', label: 'AI Integration', v: [A, A, A, Y] },
  { key: 'voice', group: 'Bot & Automation', label: 'Voice Enabled (Speech to Text)', v: [N, N, Y, Y] },
  { key: 'multi-lingual', group: 'Bot & Automation', label: 'Multi-Lingual (up to 2 languages)', v: [A, A, Y, Y] },
  { key: 'auto-email-followup', group: 'Bot & Automation', label: 'Auto Email Follow-up', v: [N, N, Y, Y] },
  { key: 'adwords', group: 'Bot & Automation', label: 'AdWords Tracking', v: [N, N, Y, Y] },
  { key: 'facebook-pixel', group: 'Bot & Automation', label: 'Facebook Pixel', v: [N, N, Y, Y] },
  { key: 'lead-email', group: 'Security & Notifications', label: 'Lead Email Notifications', v: [N, Y, Y, Y] },
  { key: 'hot-lead', group: 'Security & Notifications', label: 'Hot Lead Notifications', v: [N, N, Y, Y] },
  { key: 'email-otp', group: 'Security & Notifications', label: 'Email OTP Validation', v: [N, A, A, A] },
  { key: 'two-factor', group: 'Security & Notifications', label: 'Two-Factor Authentication (2FA)', v: [N, Y, Y, Y] },
  { key: 'analytics', group: 'Analytics & Reports', label: 'Analytics', v: [Y, Y, Y, Y] },
  { key: 'addons-available', group: 'Add-ons & Customization', label: 'Add-ons Available', v: [Y, Y, Y, Y] },
  { key: 'custom-development', group: 'Add-ons & Customization', label: 'Custom Development / Customization', note: 'Quoted & charged separately — all plans', v: ['Quoted', 'Quoted', 'Quoted', 'Quoted'] },
]
const featuresAt = (i: number) => Object.fromEntries(FEATURE_ROWS.map((r) => [r.key, r.v[i]!]))
const unlimitedChats = (i: number): Record<string, null> => (i === 0 ? {} : { web_chats: null, ig_messages: null })

const ALL: PlanId[] = ['broadcast', 'standard', 'pro', 'ai']
const BS: PlanId[] = ['broadcast', 'standard']
const addon = (a: Omit<AddonDef, 'status'>): AddonDef => ({ ...a, status: 'active' })

export const DEFAULT_CATALOG: Catalog = {
  version: 1,
  updatedAt: 0,
  features: FEATURE_ROWS.map(({ v: _v, ...f }) => f),
  plans: [
    {
      id: 'broadcast', name: 'Broadcast', monthly: 1499, yearly: 14500, botType: 'Broadcast only (no bot)',
      desc: 'WhatsApp template/broadcast messages with Google Sheets integration. No bot; replies are handled by an agent from the dashboard.',
      highlights: ['WhatsApp template & broadcast messages', 'Google Sheets integration', 'Replies handled by an agent (no bot)', '2 chatbots'],
      limits: { wa_service: 1000, wa_bi: 1000, chatbots: 2, agents: 0, languages: 1, ...unlimitedChats(0) }, features: featuresAt(0), visibility: 'public', status: 'active',
    },
    {
      id: 'standard', name: 'Standard', monthly: 3500, yearly: 35000, botType: 'Flow / menu-driven',
      desc: 'Flow/menu-driven chatbot with Google Sheets integration. Platforms: WhatsApp, Website, Instagram and Landing Page Chatbot. All add-ons available.',
      highlights: ['Everything in Broadcast, plus a bot', 'Flow / menu-driven chatbot · 5 chatbots', 'WhatsApp, Website, Instagram & Landing Page', 'Custom Google Sheet & webhook, lead emails, 2FA'],
      limits: { wa_service: 30000, wa_bi: 2000, chatbots: 5, agents: 0, languages: 1, ...unlimitedChats(1) }, features: featuresAt(1), visibility: 'public', status: 'active',
    },
    {
      id: 'pro', name: 'Pro', monthly: 6500, yearly: 72000, botType: 'Flow-based (full feature set)',
      desc: 'Flow-based bot with the full feature set. 6 platforms: WhatsApp, Website, Facebook Messenger, Instagram Messenger, Applications and Landing Page Chatbot. All add-ons available.',
      highlights: ['Everything in Standard', '6 platforms incl. Messenger & in-app · 10 chatbots', '3 live agents, CRM & AI Agent (Dialogflow) included', 'Voice, multi-lingual, auto email follow-up, hot-lead alerts'],
      limits: { wa_service: 100000, wa_bi: 5000, chatbots: 10, agents: 3, languages: 2, ...unlimitedChats(2) }, features: featuresAt(2), visibility: 'public', status: 'active',
    },
    {
      id: 'ai', name: 'AI', monthly: 8999, yearly: 96000, botType: 'Flow-based + AI integration',
      desc: 'Everything in Pro, plus AI integration. All add-ons available.',
      highlights: ['Everything in Pro', 'AI integration included', 'Highest message allowances', 'All add-ons available'],
      limits: { wa_service: 500000, wa_bi: 10000, chatbots: 10, agents: 3, languages: 2, ...unlimitedChats(3) }, features: featuresAt(3), visibility: 'public', status: 'active',
    },
  ],
  addons: [
    addon({ id: 'template-replies',  name: 'Template Text Replies + Template Button Click Responses', unit: 'flat rate (one add-on)', monthly: 1000, yearly: 9600, maxQty: 1, plans: BS, kind: 'feature', unlocks: ['template-text-replies', 'template-button-responses'], whatsapp: true }),
    addon({ id: 'crm',               name: 'CRM',                            unit: 'flat rate',               monthly: 1000,  yearly: 9600,   maxQty: 1,   plans: BS, kind: 'feature', unlocks: ['crm'] }),
    addon({ id: 'cart-catalog',      name: 'WhatsApp Cart & Catalog',        unit: 'flat rate',               monthly: 1000,  yearly: 9600,   maxQty: 1,   plans: BS, kind: 'feature', unlocks: ['cart-catalog'], whatsapp: true }),
    addon({ id: 'extra-live-agent',  name: 'Live Agent',                     unit: 'per agent',               monthly: 1000,  yearly: 9600,   maxQty: 50,  plans: ALL, kind: 'usage', unlocks: ['live-agents'], meter: { metric: 'agents', size: 1 } }),
    addon({ id: 'ai-agent',          name: 'AI Agent (Dialogflow)',          unit: 'flat rate',               monthly: 1000,  yearly: 9600,   maxQty: 1,   plans: BS, kind: 'feature', unlocks: ['ai-agent'] }),
    addon({ id: 'extra-language',    name: 'Multi-Lingual / Extra Language', unit: 'per language',            monthly: 1000,  yearly: 9600,   maxQty: 20,  plans: ALL, kind: 'usage', unlocks: ['multi-lingual'], meter: { metric: 'languages', size: 1 } }),
    addon({ id: 'ai-integration',    name: 'AI Integration',                 unit: 'flat rate',               monthly: 2000,  yearly: 24000,  maxQty: 1,   plans: ['broadcast', 'standard', 'pro'], kind: 'feature', unlocks: ['ai-integration'] }),
    addon({ id: 'email-otp',         name: 'Email OTP Validation',           unit: 'per 1,000 email OTPs',    monthly: 500,   yearly: 6000,   maxQty: 100, plans: ['standard', 'pro', 'ai'], kind: 'usage', unlocks: ['email-otp'], meter: { metric: 'email_otps', size: 1000 } }),
    addon({ id: 'extra-chatbots',    name: 'Extra Chatbots',                 unit: 'per 5 chatbots',          monthly: 1000,  yearly: 9600,   maxQty: 20,  plans: ALL, kind: 'usage', meter: { metric: 'chatbots', size: 5 } }),
    addon({ id: 'wa-bi-messages',    name: 'WhatsApp BI Messages',           unit: 'per 1,000 messages',      monthly: 200,   yearly: 2400,   maxQty: 100, plans: ALL, kind: 'usage', meter: { metric: 'wa_bi', size: 1000 }, whatsapp: true }),
    addon({ id: 'web-chats',         name: 'UI / Website Chats',             unit: 'per 1,000 chats/mo',      monthly: 600,   yearly: 7200,   maxQty: 100, plans: ALL, kind: 'usage', meter: { metric: 'web_chats', size: 1000 } }),
    addon({ id: 'sms-otps',          name: 'SMS OTPs',                       unit: 'per 1,000 OTPs',          monthly: 500,   yearly: 6000,   maxQty: 100, plans: ALL, kind: 'usage', meter: { metric: 'sms_otps', size: 1000 } }),
    addon({ id: 'wa-otps',           name: 'WhatsApp OTPs',                  unit: 'per 1,000 OTPs',          monthly: 500,   yearly: 6000,   maxQty: 100, plans: ALL, kind: 'usage', meter: { metric: 'wa_otps', size: 1000 }, whatsapp: true }),
    addon({ id: 'sms-notifications', name: 'SMS Notifications',              unit: 'per 1,000 notifications', monthly: 500,   yearly: 6000,   maxQty: 100, plans: ALL, kind: 'usage', meter: { metric: 'sms_notifications', size: 1000 } }),
    addon({ id: 'wa-notifications',  name: 'WhatsApp Notifications',         unit: 'per 1,000 notifications', monthly: 500,   yearly: 6000,   maxQty: 100, plans: ALL, kind: 'usage', meter: { metric: 'wa_notifications', size: 1000 }, whatsapp: true }),
    addon({ id: 'text-to-speech',    name: 'Text to Speech',                 unit: 'flat rate',               monthly: 800,   yearly: 7200,   maxQty: 1,   plans: ALL, kind: 'usage' }),
    addon({ id: 'remove-branding',   name: 'Remove Branding',                unit: 'flat rate',               monthly: 1900,  yearly: 20280,  maxQty: 1,   plans: ALL, kind: 'usage' }),
    addon({ id: 'basic-support',     name: 'Basic Support',                  unit: 'flat rate',               monthly: 6999,  yearly: 71988,  maxQty: 1,   plans: ALL, kind: 'usage', excludes: ['premium-support'] }),
    addon({ id: 'premium-support',   name: 'Premium Support',                unit: 'flat rate',               monthly: 14999, yearly: 143988, maxQty: 1,   plans: ALL, kind: 'usage', excludes: ['basic-support'] }),
  ],
}

/* ── live views: refilled in place by applyCatalog ───────────────────────── */
export const PLAN_CATALOG: Record<PlanId, PlanInfo> = {}
export const PLAN_ORDER: PlanId[] = []
export const ADDON_CATALOG: AddonDef[] = []
export const FEATURES: FeatureDef[] = []
const ADDON_BY_ID = new Map<string, AddonDef>()
let current: Catalog = DEFAULT_CATALOG

export function applyCatalog(c: Catalog): void {
  current = c
  for (const k of Object.keys(PLAN_CATALOG)) delete PLAN_CATALOG[k]
  for (const p of c.plans) PLAN_CATALOG[p.id] = p
  PLAN_ORDER.splice(0, PLAN_ORDER.length, ...c.plans.map((p) => p.id))
  ADDON_CATALOG.splice(0, ADDON_CATALOG.length, ...c.addons)
  FEATURES.splice(0, FEATURES.length, ...c.features)
  ADDON_BY_ID.clear()
  for (const a of c.addons) ADDON_BY_ID.set(a.id, a)
}
applyCatalog(DEFAULT_CATALOG)
export const currentCatalog = (): Catalog => current
export const addonDef = (id: string): AddonDef | undefined => ADDON_BY_ID.get(id)
/** Plans are never deleted (only archived), but a record may outlive a bad edit: never crash on a name. */
export const planName = (id: PlanId | null | undefined): string => (id ? PLAN_CATALOG[id]?.name ?? id : '—')

/* ── validating an edited catalog ────────────────────────────────────────
   Plans and add-ons can be added, edited and archived — never removed, because customers and
   invoices refer to them by id. */
const SLUG = /^[a-z0-9][a-z0-9-]{1,39}$/
const money = (v: unknown, min = 0) => typeof v === 'number' && Number.isFinite(v) && v >= min && v <= 10_000_000
export function validateCatalog(input: unknown, previous: Catalog): { ok: true; catalog: Omit<Catalog, 'version' | 'updatedAt' | 'updatedBy'> } | { ok: false; message: string } {
  const fail = (message: string) => ({ ok: false as const, message })
  const c = (input ?? {}) as Partial<Catalog>
  if (!Array.isArray(c.plans) || !Array.isArray(c.addons)) return fail('plans and addons are required.')
  const features = Array.isArray(c.features) && c.features.length ? c.features : previous.features
  const featureKeys = new Set<string>()
  for (const f of features) {
    if (!f || !SLUG.test(f.key) || featureKeys.has(f.key)) return fail(`Feature "${f?.key}" needs a unique id (lowercase letters, digits, -).`)
    if (!f.label?.trim() || !f.group?.trim()) return fail(`Feature "${f.key}" needs a label and a group.`)
    featureKeys.add(f.key)
  }
  const planIds = new Set<string>()
  for (const p of c.plans as PlanInfo[]) {
    const who = `Plan "${p?.name || p?.id}"`
    if (!p || !SLUG.test(p.id) || planIds.has(p.id)) return fail(`${who} needs a unique id (lowercase letters, digits, -).`)
    planIds.add(p.id)
    if (!p.name?.trim() || p.name.length > 40) return fail(`${who} needs a name (up to 40 characters).`)
    if (!money(p.monthly, 1) || !money(p.yearly, 1)) return fail(`${who}: monthly and yearly prices must be at least ₹1.`)
    if (p.visibility !== 'public' && p.visibility !== 'private') return fail(`${who}: visibility must be public or private.`)
    if (p.status !== 'active' && p.status !== 'archived') return fail(`${who}: status must be active or archived.`)
    for (const [m, v] of Object.entries(p.limits ?? {})) {
      if (!isMetric(m) || !(v === null || (Number.isInteger(v) && v >= 0 && v <= 1e9))) return fail(`${who}: the limit for ${m} must be a whole number, or unlimited.`)
    }
    for (const [k, v] of Object.entries(p.features ?? {})) {
      if (!featureKeys.has(k) || !(typeof v === 'boolean' || typeof v === 'string')) return fail(`${who}: unknown feature "${k}".`)
    }
    if (!Array.isArray(p.highlights) || p.highlights.some((h) => typeof h !== 'string')) return fail(`${who}: highlights must be a list of text.`)
  }
  for (const old of previous.plans) if (!planIds.has(old.id)) return fail(`Plan "${old.name}" can't be removed — archive it instead (customers may be on it).`)
  if (!(c.plans as PlanInfo[]).some((p) => p.status === 'active' && p.visibility === 'public')) return fail('Keep at least one active public plan, or customers have nothing to buy.')
  const addonIds = new Set<string>()
  for (const a of c.addons as AddonDef[]) {
    const who = `Add-on "${a?.name || a?.id}"`
    if (!a || !SLUG.test(a.id) || addonIds.has(a.id)) return fail(`${who} needs a unique id (lowercase letters, digits, -).`)
    addonIds.add(a.id)
    if (!a.name?.trim() || !a.unit?.trim()) return fail(`${who} needs a name and a unit.`)
    if (!money(a.monthly, 1) || !money(a.yearly, 1)) return fail(`${who}: monthly and yearly prices must be at least ₹1.`)
    if (!Number.isInteger(a.maxQty) || a.maxQty < 1 || a.maxQty > 10000) return fail(`${who}: max quantity must be 1 or more.`)
    if (!Array.isArray(a.plans) || a.plans.some((id) => !planIds.has(id))) return fail(`${who}: pick plans that exist.`)
    if (a.kind !== 'feature' && a.kind !== 'usage') return fail(`${who}: kind must be feature or usage.`)
    if (a.status !== 'active' && a.status !== 'archived') return fail(`${who}: status must be active or archived.`)
    if (a.unlocks?.some((k) => !featureKeys.has(k))) return fail(`${who}: it unlocks a feature that doesn't exist.`)
    if (a.meter && (!isMetric(a.meter.metric) || !Number.isInteger(a.meter.size) || a.meter.size < 1)) return fail(`${who}: the allowance it adds is not valid.`)
  }
  for (const a of c.addons as AddonDef[]) if (a.excludes?.some((x) => !addonIds.has(x))) return fail(`Add-on "${a.name}" excludes one that doesn't exist.`)
  for (const old of previous.addons) if (!addonIds.has(old.id)) return fail(`Add-on "${old.name}" can't be removed — archive it instead.`)
  return { ok: true, catalog: { plans: c.plans as PlanInfo[], addons: c.addons as AddonDef[], features } }
}

/* ── add-on selections ─────────────────────────────────────────────────── */
export interface AddonSel { id: string; qty: number }
export interface AddonLine { id: string; name: string; unit: string; qty: number; rate: number; amount: number }

/** Validate what the browser sent: known ids, sensible quantities, allowed on this plan.
    Archived add-ons can't be newly bought (staff = true skips that, for keeping what a customer has). */
export function normalizeAddons(input: unknown, plan: PlanId, staff = false): { ok: true; addons: AddonSel[] } | { ok: false; message: string } {
  if (input === undefined || input === null) return { ok: true, addons: [] }
  if (!Array.isArray(input) || input.length > 40) return { ok: false, message: 'Add-ons must be a list.' }
  const qtyById = new Map<string, number>()
  for (const raw of input) {
    const r = (raw ?? {}) as Record<string, unknown>
    const def = typeof r.id === 'string' ? ADDON_BY_ID.get(r.id) : undefined
    if (!def || (def.status === 'archived' && !staff)) return { ok: false, message: 'One of the add-ons is not available.' }
    const qty = Number(r.qty)
    if (!Number.isInteger(qty) || qty < 0 || qty > def.maxQty) return { ok: false, message: `${def.name}: choose between 0 and ${def.maxQty}.` }
    if (qty === 0) continue
    if (!def.plans.includes(plan)) return { ok: false, message: `${def.name} is not available on this plan.` }
    qtyById.set(def.id, (qtyById.get(def.id) ?? 0) + qty)
  }
  const addons: AddonSel[] = []
  for (const def of ADDON_CATALOG) {
    const qty = qtyById.get(def.id)
    if (!qty) continue
    if (qty > def.maxQty) return { ok: false, message: `${def.name}: choose between 0 and ${def.maxQty}.` }
    if (def.excludes?.some((x) => qtyById.has(x))) return { ok: false, message: `${def.name} can't be combined with ${ADDON_BY_ID.get(def.excludes.find((x) => qtyById.has(x))!)!.name}.` }
    addons.push({ id: def.id, qty })
  }
  return { ok: true, addons }
}

/** The add-ons that still apply after a plan change. */
export const eligibleAddons = (addons: AddonSel[] | undefined, plan: PlanId): AddonSel[] =>
  (addons ?? []).filter((a) => ADDON_BY_ID.get(a.id)?.plans.includes(plan))

/** Two add-on lists added together (the same add-on twice = one line with both quantities). */
export function mergeAddons(a: AddonSel[] | undefined, b: AddonSel[] | undefined): AddonSel[] {
  const m = new Map<string, number>()
  for (const x of [...(a ?? []), ...(b ?? [])]) m.set(x.id, (m.get(x.id) ?? 0) + x.qty)
  return [...m].map(([id, qty]) => ({ id, qty }))
}

/* ── price lock: what this customer pays, kept when the list price changes ── */
export interface PriceLock {
  plans: Record<PlanId, { monthly: number; yearly: number }>
  addons: Record<string, { monthly: number; yearly: number }>
  at: number
}
/** Today's list prices for this plan and add-ons, merged over an existing lock (other plans' prices are kept). */
export function lockPrices(plan: PlanId, addons: AddonSel[] | undefined, at: number, keep?: PriceLock | null): PriceLock {
  const p = PLAN_CATALOG[plan]
  const lock: PriceLock = { plans: { ...(keep?.plans ?? {}) }, addons: { ...(keep?.addons ?? {}) }, at }
  if (p && !keep?.plans[plan]) lock.plans[plan] = { monthly: p.monthly, yearly: p.yearly }
  for (const a of addons ?? []) {
    const d = ADDON_BY_ID.get(a.id)
    if (d && !keep?.addons[a.id]) lock.addons[a.id] = { monthly: d.monthly, yearly: d.yearly }
  }
  return lock
}
export const planRate = (plan: PlanId, period: Period, lock?: PriceLock | null): number => lock?.plans[plan]?.[period] ?? PLAN_CATALOG[plan]?.[period] ?? 0
export const addonRate = (id: string, period: Period, lock?: PriceLock | null): number => lock?.addons[id]?.[period] ?? ADDON_BY_ID.get(id)?.[period] ?? 0

export function addonLines(addons: AddonSel[] | undefined, period: Period, lock?: PriceLock | null): AddonLine[] {
  const out: AddonLine[] = []
  for (const a of addons ?? []) {
    const def = ADDON_BY_ID.get(a.id)
    if (!def) continue
    const rate = addonRate(a.id, period, lock)
    out.push({ id: def.id, name: def.name, unit: def.unit, qty: a.qty, rate, amount: rate * a.qty })
  }
  return out
}

/** RBI: card / UPI recurring debits above this need the customer to approve each one. */
export const AFA_LIMIT_RUPEES = 15000

export function isPlanId(v: unknown): v is PlanId {
  return typeof v === 'string' && v in PLAN_CATALOG
}
export function isPeriod(v: unknown): v is Period {
  return v === 'monthly' || v === 'yearly'
}

/* ── pricing ─────────────────────────────────────────────────────────────
   Every charge is a list of lines (plan, add-ons, discount, credit) that adds up to the taxable
   amount; the GST invoice prints the same lines. */
export interface PriceLine {
  kind: 'plan' | 'addon' | 'discount' | 'credit' | 'adjustment'
  id?: string
  description: string
  qty: number
  unit: string
  rate: number
  amount: number
}

export interface TaxSplit {
  /** intra = same state as us (CGST + SGST); inter = another state (IGST); unknown = no state given yet */
  kind: 'intra' | 'inter' | 'unknown'
  cgst: number
  sgst: number
  igst: number
}

export interface Charge {
  base: number          // ₹, excl. GST
  gst: number           // ₹
  total: number         // ₹, what the customer pays
  totalPaise: number    // integer paise — what Razorpay is told
  gstPercent: number
  tax: TaxSplit
  lines: PriceLine[]
}

/** supplier = the state we are registered in; customer = place of supply. */
export interface PlaceOfSupply { supplier: string; customer?: string }

export interface PriceOpts {
  place?: PlaceOfSupply
  addons?: AddonSel[]
  /** only the add-ons (bought on top of a plan already paid for) */
  addonsOnly?: boolean
  /** price list for the add-ons — a yearly plan can buy them at the monthly rate */
  addonPeriod?: Period
  /** a term of several months, for the plan and its add-ons: on a yearly plan in whole years it is the
      yearly price × years (yearly cycles), otherwise the monthly price × months */
  months?: number
  /** staff discounts before GST: on one item ('plan' or an add-on id) or on the 'total' */
  discounts?: Discount[]
  /** share of the period actually sold (0–1), e.g. add-ons cut short by the plan's end */
  fraction?: number
  /** text for a prorated line, e.g. "12 of 30 days" */
  prorateNote?: string
  /** ₹ off before GST, with its line text (a coupon) */
  discount?: number
  discountLabel?: string
  /** ₹ credited before GST for unused time on the old plan (an upgrade) */
  credit?: number
  creditLabel?: string
  /** a manual amount difference (an offline payment at a negotiated price), + or − */
  adjustment?: number
  adjustmentLabel?: string
  lock?: PriceLock | null
}

export interface Discount { target: string; type: 'percent' | 'flat'; value: number }

const r2 = (n: number) => Math.round(n * 100) / 100
const inYears = (period: Period, months?: number) => Boolean(months && period === 'yearly' && months % 12 === 0)
const termWord = (period: Period, months?: number) => (inYears(period, months) ? `${months! / 12} years`
  : months ? `${months} month${months > 1 ? 's' : ''}` : period === 'yearly' ? 'Yearly' : 'Monthly')

export function chargeFor(plan: PlanId, period: Period, gstPercent: number, o: PriceOpts = {}): Charge {
  const lines: PriceLine[] = []
  const f = o.fraction ?? 1
  const years = inYears(period, o.months)
  const per = o.months ? (years ? o.months / 12 : o.months) : 1
  const pricePeriod: Period = o.months && !years ? 'monthly' : period
  const note = f < 1 && o.prorateNote ? ` · prorated, ${o.prorateNote}` : ''
  const term = o.months ? ` · ${termWord(period, o.months)}` : ''
  if (!o.addonsOnly) {
    const rate = r2(planRate(plan, pricePeriod, o.lock) * per * f)
    lines.push({ kind: 'plan', id: plan, description: `SmatBot ${planName(plan)} Plan — ${termWord(period, o.months)} subscription${note}`, qty: 1, unit: o.months ? 'term' : period === 'yearly' ? 'year' : 'month', rate, amount: rate })
  }
  const ap: Period = o.months ? pricePeriod : (o.addonPeriod ?? period)
  for (const a of o.addons ?? []) {
    const def = ADDON_BY_ID.get(a.id)
    if (!def) continue
    const rate = r2(addonRate(a.id, ap, o.lock) * per * f)
    lines.push({ kind: 'addon', id: a.id, description: `Add-on: ${def.name} (${def.unit})${term}${note}`, qty: a.qty, unit: def.unit, rate, amount: r2(rate * a.qty) })
  }
  // Staff discounts: each item's first, then one on what is left.
  const pct = (d: Discount) => (d.type === 'percent' ? ` (${d.value}%)` : '')
  for (const d of o.discounts ?? []) {
    const item = d.target === 'total' ? undefined : lines.find((l) => (d.target === 'plan' ? l.kind === 'plan' : l.kind === 'addon' && l.id === d.target))
    if (!item) continue
    const off = r2(Math.min(item.amount, d.type === 'percent' ? (item.amount * d.value) / 100 : d.value))
    const name = item.kind === 'plan' ? `${planName(plan)} plan` : ADDON_BY_ID.get(item.id!)?.name ?? item.id
    if (off > 0) lines.push({ kind: 'discount', id: d.target, description: `Discount on ${name}${pct(d)}`, qty: 1, unit: '', rate: -off, amount: -off })
  }
  const onTotal = o.discounts?.find((d) => d.target === 'total')
  if (onTotal) {
    const sub = r2(lines.reduce((n, l) => n + l.amount, 0))
    const off = r2(Math.min(sub, onTotal.type === 'percent' ? (sub * onTotal.value) / 100 : onTotal.value))
    if (off > 0) lines.push({ kind: 'discount', id: 'total', description: `Discount on the total${pct(onTotal)}`, qty: 1, unit: '', rate: -off, amount: -off })
  }
  const gross = r2(lines.reduce((n, l) => n + l.amount, 0))
  const credit = Math.min(o.credit ?? 0, gross)
  if (credit > 0) lines.push({ kind: 'credit', description: o.creditLabel ?? 'Credit for unused time', qty: 1, unit: '', rate: -r2(credit), amount: -r2(credit) })
  const discount = Math.min(o.discount ?? 0, gross - credit)
  if (discount > 0) lines.push({ kind: 'discount', description: o.discountLabel ?? 'Discount', qty: 1, unit: '', rate: -r2(discount), amount: -r2(discount) })
  if (o.adjustment) lines.push({ kind: 'adjustment', description: o.adjustmentLabel ?? 'Price adjustment', qty: 1, unit: '', rate: r2(o.adjustment), amount: r2(o.adjustment) })
  const base = Math.max(0, r2(lines.reduce((n, l) => n + l.amount, 0)))
  const totalPaise = Math.round(base * (1 + gstPercent / 100) * 100)
  const total = totalPaise / 100
  const gst = r2(total - base)
  // The total never changes — only how it is labelled on the invoice.
  let tax: TaxSplit = { kind: 'unknown', cgst: 0, sgst: 0, igst: 0 }
  if (o.place?.customer) {
    if (o.place.customer === o.place.supplier) {
      const half = r2(gst / 2)
      tax = { kind: 'intra', cgst: half, sgst: r2(gst - half), igst: 0 }
    } else {
      tax = { kind: 'inter', cgst: 0, sgst: 0, igst: gst }
    }
  }
  return { base, gst, total, totalPaise, gstPercent, tax, lines }
}

/** Monthly-equivalent list price: how plans are ranked for upgrades. */
export const monthlyEquivalent = (plan: PlanId, period: Period, lock?: PriceLock | null) =>
  period === 'yearly' ? planRate(plan, 'yearly', lock) / 12 : planRate(plan, 'monthly', lock)

/** Stable key used to find the matching Razorpay Plan again later. */
export const planKey = (plan: PlanId, period: Period) => `${plan}_${period}`

/** Whether renewals on this plan will need the customer to approve each debit. */
export const needsApprovalEachCycle = (c: Charge) => c.total > AFA_LIMIT_RUPEES

/** Billing cycles to authorise. Razorpay only needs a large-enough number. */
export const totalCount = (period: Period) => (period === 'monthly' ? 360 : 30)

export const DAY = 86400
/** Add one billing period (or a number of months) to a unix-seconds timestamp (calendar-aware, UTC). */
export function addPeriod(fromSeconds: number, period: Period, months?: number): number {
  const d = new Date(fromSeconds * 1000)
  if (months) d.setUTCMonth(d.getUTCMonth() + months)
  else if (period === 'monthly') d.setUTCMonth(d.getUTCMonth() + 1)
  else d.setUTCFullYear(d.getUTCFullYear() + 1)
  return Math.floor(d.getTime() / 1000)
}
/** Whole days from a to b, rounded up (a part-day counts). */
export const daysBetween = (a: number, b: number) => Math.max(0, Math.ceil((b - a) / DAY))
