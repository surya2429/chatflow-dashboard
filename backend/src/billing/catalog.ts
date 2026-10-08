// catalog.ts — what a plan costs, decided on the SERVER so a browser can never
// choose its own price. Mirrors src/constants/pricing.js on the dashboard; if you
// change a price there, change it here too (the dashboard only ever sends a
// plan id and a billing period, never an amount).
//
// Prices are in ₹ and exclusive of GST; GST is added on top at charge time.

export type PlanId = 'broadcast' | 'standard' | 'pro' | 'ai'
export type Period = 'monthly' | 'yearly'

export const PLAN_ORDER: PlanId[] = ['broadcast', 'standard', 'pro', 'ai']

export const PLAN_CATALOG: Record<PlanId, { name: string; monthly: number; yearly: number }> = {
  broadcast: { name: 'Broadcast', monthly: 1499, yearly: 14500 },
  standard:  { name: 'Standard',  monthly: 3500, yearly: 35000 },
  pro:       { name: 'Pro',       monthly: 6500, yearly: 72000 },
  ai:        { name: 'AI',        monthly: 8999, yearly: 96000 },
}

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

export function chargeFor(plan: PlanId, period: Period, gstPercent: number, place?: PlaceOfSupply): Charge {
  const base = PLAN_CATALOG[plan][period]
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
