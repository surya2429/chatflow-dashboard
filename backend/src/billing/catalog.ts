// catalog.ts — what a plan costs, decided on the SERVER so a browser can never
// choose its own price. Mirrors src/constants/pricing.js on the dashboard; if you
// change a price there, change it here too (the dashboard only ever sends a
// plan id and a billing period, never an amount).
//
// Prices are in ₹ and exclusive of GST; GST is added on top at charge time.

export type PlanId = 'broadcast' | 'standard' | 'pro' | 'ai'
export type Period = 'monthly' | 'yearly'

export const PLAN_ORDER: PlanId[] = ['broadcast', 'standard', 'pro', 'ai']

export interface PlanInfo {
  name: string
  monthly: number
  yearly: number
  /** what the plan includes — printed on the invoice */
  desc: string
  /** WhatsApp allowances per month (yearly plans get all twelve months credited upfront) */
  serviceMsgs: number
  biMsgs: number
}

export const PLAN_CATALOG: Record<PlanId, PlanInfo> = {
  broadcast: {
    name: 'Broadcast', monthly: 1499, yearly: 14500, serviceMsgs: 1000, biMsgs: 1000,
    desc: 'WhatsApp template/broadcast messages with Google Sheets integration. No bot; replies are handled by an agent from the dashboard.',
  },
  standard: {
    name: 'Standard', monthly: 3500, yearly: 35000, serviceMsgs: 30000, biMsgs: 2000,
    desc: 'Flow/menu-driven chatbot with Google Sheets integration. Platforms: WhatsApp, Website, Instagram and Landing Page Chatbot. All add-ons available.',
  },
  pro: {
    name: 'Pro', monthly: 6500, yearly: 72000, serviceMsgs: 100000, biMsgs: 5000,
    desc: 'Flow-based bot with the full feature set. 6 platforms: WhatsApp, Website, Facebook Messenger, Instagram Messenger, Applications and Landing Page Chatbot. All add-ons available.',
  },
  ai: {
    name: 'AI', monthly: 8999, yearly: 96000, serviceMsgs: 500000, biMsgs: 10000,
    desc: 'Everything in Pro, plus AI integration. All add-ons available.',
  },
}

/* ── add-ons ───────────────────────────────────────────────────────────────
   Extra capacity sold on top of a plan. Mirrors ADDONS in src/constants/pricing.js (the pricing sheet)
   (keep them in sync). Prices are ₹, excl. GST, for ONE unit per billing period; yearly is
   the sheet's yearly price, not 12× monthly. The browser sends only ids and quantities. */
export interface AddonDef {
  id: string
  name: string
  unit: string
  monthly: number
  yearly: number
  /** most that can be bought at once; 1 = a flat-rate add-on */
  maxQty: number
  /** plans it can be bought with */
  plans: PlanId[]
  /** WhatsApp-only (hidden for Website Chat) */
  whatsapp?: boolean
  /** can't be bought together with these */
  excludes?: string[]
}
const ALL: PlanId[] = ['broadcast', 'standard', 'pro', 'ai']
const BS: PlanId[] = ['broadcast', 'standard']
export const ADDON_CATALOG: AddonDef[] = [
  { id: 'template-replies',  name: 'Template Text Replies + Template Button Click Responses', unit: 'flat rate (one add-on)', monthly: 1000,  yearly: 9600,   maxQty: 1,   plans: BS, whatsapp: true },
  { id: 'crm',               name: 'CRM',                            unit: 'flat rate',               monthly: 1000,  yearly: 9600,    maxQty: 1,   plans: BS },
  { id: 'cart-catalog',      name: 'WhatsApp Cart & Catalog',        unit: 'flat rate',               monthly: 1000,  yearly: 9600,    maxQty: 1,   plans: BS, whatsapp: true },
  { id: 'extra-live-agent',  name: 'Live Agent',                     unit: 'per agent',               monthly: 1000,  yearly: 9600,    maxQty: 50,  plans: ALL },
  { id: 'ai-agent',          name: 'AI Agent (Dialogflow)',          unit: 'flat rate',               monthly: 1000,  yearly: 9600,    maxQty: 1,   plans: BS },
  { id: 'extra-language',    name: 'Multi-Lingual / Extra Language', unit: 'per language',            monthly: 1000,  yearly: 9600,    maxQty: 20,  plans: ALL },
  { id: 'ai-integration',    name: 'AI Integration',                 unit: 'flat rate',               monthly: 2000,  yearly: 24000,   maxQty: 1,   plans: ['broadcast', 'standard', 'pro'] },
  { id: 'email-otp',         name: 'Email OTP Validation',           unit: 'per 1,000 email OTPs',    monthly: 500,   yearly: 6000,    maxQty: 100, plans: ['standard', 'pro', 'ai'] },
  { id: 'extra-chatbots',    name: 'Extra Chatbots',                 unit: 'per 5 chatbots',          monthly: 1000,  yearly: 9600,    maxQty: 20,  plans: ALL },
  { id: 'wa-bi-messages',    name: 'WhatsApp BI Messages',           unit: 'per 1,000 messages',      monthly: 200,   yearly: 2400,    maxQty: 100, plans: ALL, whatsapp: true },
  { id: 'web-chats',         name: 'UI / Website Chats',             unit: 'per 1,000 chats/mo',      monthly: 600,   yearly: 7200,    maxQty: 100, plans: ALL },
  { id: 'sms-otps',          name: 'SMS OTPs',                       unit: 'per 1,000 OTPs',          monthly: 500,   yearly: 6000,    maxQty: 100, plans: ALL },
  { id: 'wa-otps',           name: 'WhatsApp OTPs',                  unit: 'per 1,000 OTPs',          monthly: 500,   yearly: 6000,    maxQty: 100, plans: ALL, whatsapp: true },
  { id: 'sms-notifications', name: 'SMS Notifications',              unit: 'per 1,000 notifications', monthly: 500,   yearly: 6000,    maxQty: 100, plans: ALL },
  { id: 'wa-notifications',  name: 'WhatsApp Notifications',         unit: 'per 1,000 notifications', monthly: 500,   yearly: 6000,    maxQty: 100, plans: ALL, whatsapp: true },
  { id: 'text-to-speech',    name: 'Text to Speech',                 unit: 'flat rate',               monthly: 800,   yearly: 7200,    maxQty: 1,   plans: ALL },
  { id: 'remove-branding',   name: 'Remove Branding',                unit: 'flat rate',               monthly: 1900,  yearly: 20280,   maxQty: 1,   plans: ALL },
  { id: 'basic-support',     name: 'Basic Support',                  unit: 'flat rate',               monthly: 6999,  yearly: 71988,   maxQty: 1,   plans: ALL, excludes: ['premium-support'] },
  { id: 'premium-support',   name: 'Premium Support',                unit: 'flat rate',               monthly: 14999, yearly: 143988,  maxQty: 1,   plans: ALL, excludes: ['basic-support'] },
]
const ADDON_BY_ID = new Map(ADDON_CATALOG.map((a) => [a.id, a]))

export interface AddonSel { id: string; qty: number }
export interface AddonLine { id: string; name: string; unit: string; qty: number; rate: number; amount: number }

/** Validate what the browser sent: known ids, sensible quantities, allowed on this plan. */
export function normalizeAddons(input: unknown, plan: PlanId): { ok: true; addons: AddonSel[] } | { ok: false; message: string } {
  if (input === undefined || input === null) return { ok: true, addons: [] }
  if (!Array.isArray(input) || input.length > 40) return { ok: false, message: 'Add-ons must be a list.' }
  const qtyById = new Map<string, number>()
  for (const raw of input) {
    const r = (raw ?? {}) as Record<string, unknown>
    const def = typeof r.id === 'string' ? ADDON_BY_ID.get(r.id) : undefined
    if (!def) return { ok: false, message: 'One of the add-ons is not available.' }
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

export function addonLines(addons: AddonSel[] | undefined, period: Period): AddonLine[] {
  const out: AddonLine[] = []
  for (const a of addons ?? []) {
    const def = ADDON_BY_ID.get(a.id)
    if (!def) continue
    const rate = def[period]
    out.push({ id: def.id, name: def.name, unit: def.unit, qty: a.qty, rate, amount: rate * a.qty })
  }
  return out
}
export const addonsBase = (addons: AddonSel[] | undefined, period: Period) => addonLines(addons, period).reduce((n, l) => n + l.amount, 0)

/** RBI: card / UPI recurring debits above this need the customer to approve each one. */
export const AFA_LIMIT_RUPEES = 15000

export function isPlanId(v: unknown): v is PlanId {
  return typeof v === 'string' && (PLAN_ORDER as string[]).includes(v)
}
export function isPeriod(v: unknown): v is Period {
  return v === 'monthly' || v === 'yearly'
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
}

/** supplier = the state we are registered in; customer = place of supply. */
export interface PlaceOfSupply { supplier: string; customer?: string }

export function chargeFor(plan: PlanId, period: Period, gstPercent: number, place?: PlaceOfSupply, addons?: AddonSel[], addonsOnly = false, addonPeriod?: Period): Charge {
  // addonsOnly: a one-time add-on purchase on top of a plan that is already paid for.
  // addonPeriod: which price list the add-ons use — a yearly plan can buy them at the monthly rate.
  const base = (addonsOnly ? 0 : PLAN_CATALOG[plan][period]) + addonsBase(addons, addonPeriod ?? period)
  const totalPaise = Math.round(base * (1 + gstPercent / 100) * 100)
  const total = totalPaise / 100
  const gst = Math.round((total - base) * 100) / 100
  // The total never changes — only how it is labelled on the invoice.
  let tax: TaxSplit = { kind: 'unknown', cgst: 0, sgst: 0, igst: 0 }
  if (place?.customer) {
    if (place.customer === place.supplier) {
      const half = Math.round(gst * 100 / 2) / 100
      tax = { kind: 'intra', cgst: half, sgst: Math.round((gst - half) * 100) / 100, igst: 0 }
    } else {
      tax = { kind: 'inter', cgst: 0, sgst: 0, igst: gst }
    }
  }
  return { base, gst, total, totalPaise, gstPercent, tax }
}

/** Stable key used to find the matching Razorpay Plan again later. */
export const planKey = (plan: PlanId, period: Period) => `${plan}_${period}`

/** Whether renewals on this plan will need the customer to approve each debit. */
export const needsApprovalEachCycle = (c: Charge) => c.total > AFA_LIMIT_RUPEES

/** Billing cycles to authorise. Razorpay only needs a large-enough number. */
export const totalCount = (period: Period) => (period === 'monthly' ? 360 : 30)

/** Add one billing period to a unix-seconds timestamp (calendar-aware, UTC). */
export function addPeriod(fromSeconds: number, period: Period): number {
  const d = new Date(fromSeconds * 1000)
  if (period === 'monthly') d.setUTCMonth(d.getUTCMonth() + 1)
  else d.setUTCFullYear(d.getUTCFullYear() + 1)
  return Math.floor(d.getTime() / 1000)
}
