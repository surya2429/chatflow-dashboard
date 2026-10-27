import type { AddonSel, Discount, Period, PlanId, PriceLine, PriceLock } from './catalog.js'
import type { BillingProfile } from './india.js'

/* 'past_due' and 'suspended' are ours: a failed renewal is past due while we are still
   collecting (plan keeps working), and suspended once collection has run out. */
export type SubStatus =
  | 'none' | 'created' | 'authenticated' | 'active' | 'pending' | 'halted'
  | 'paused' | 'cancelled' | 'completed' | 'expired' | 'past_due' | 'suspended'

export interface PaymentMethod {
  type: string            // card | upi | emandate | netbanking | wallet …
  last4?: string
  network?: string
  vpa?: string
  bank?: string
}

export interface PaymentLogEntry {
  id: string              // Razorpay payment id
  orderId?: string
  subscriptionId?: string
  amountPaise: number
  at: number              // unix seconds
  plan: PlanId
  period: Period
  status: 'paid' | 'failed'
  method?: string
  /** coupon code used on this payment */
  coupon?: string
  /** what it paid for */
  kind?: Invoice['kind']
  /** recorded by staff: paid outside Razorpay (bank transfer, cheque, cash …) */
  offline?: { method: string; reference: string; by: string }
}

/** Proof that the customer agreed to recurring charges: what, how much, when, from where. */
export interface ConsentEntry {
  version: string
  at: number
  ip?: string
  userAgent?: string
  plan: PlanId
  period: Period
  amountPaise: number
  subscriptionId?: string
  orderId?: string
}

/* Autopay has two engines:
     subscription  a Razorpay Subscription — Razorpay debits and retries on ITS schedule.
                   Needs Subscriptions activated on the account; allows amounts above ₹15,000.
     token         a saved card token (RBI card-on-file mandate) — WE debit when due and retry
                   on OUR schedule (see dunning.ts). Works without Subscriptions, cards only,
                   up to ₹15,000 per charge, and every debit needs a pre-debit notice first. */
export type AutopayEngine = 'subscription' | 'token'

/** The saved-card authorisation behind token autopay. */
export interface TokenMandate {
  id: string
  customerId: string
  status: string           // Razorpay's: initiated | confirmed | rejected | cancelled | paused
  last4?: string
  network?: string
  maxAmountPaise: number
  expireAt: number
}

/** The next automatic debit on a token mandate. */
export interface Renewal {
  plan: PlanId
  period: Period
  addons?: AddonSel[]
  dueAt: number
  /** order created with the pre-debit notice; the debit may only fire after payAfter */
  orderId?: string
  payAfter?: number
  /** debit submitted but the bank hasn't confirmed yet */
  paymentId?: string
  submittedAt?: number
}

/** A checkout that has been started but not yet confirmed by a verified signature. */
export interface PendingCheckout {
  mode: 'once' | 'autopay'
  engine?: AutopayEngine
  /** token engine, "turn on at renewal": a ₹1 card verification instead of the full price */
  authOnly?: boolean
  /** replacing the saved card (₹1 verification, refunded) — nothing else changes */
  updateCard?: boolean
  /** a one-time add-on purchase on the current plan: no plan change, nothing recurring */
  addonsOnly?: boolean
  /** which price list those add-ons were bought at (a yearly plan can buy them monthly) */
  addonPeriod?: Period
  plan: PlanId
  period: Period
  addons?: AddonSel[]
  orderId?: string
  subscriptionId?: string
  /** the customer's consent to recurring charges, recorded when they authorise */
  consent?: ConsentEntry
  /** unix seconds the new subscription begins billing (turning autopay back on at renewal) */
  startAt?: number
  /** pay-once only: the coupon and the ₹ it took off before GST */
  coupon?: { code: string; discount: number }
  /** upgrade = a new plan starting now, unused time credited · addon_recurring = add-ons added to an autopay plan */
  purpose?: 'upgrade' | 'addon_recurring'
  /** exactly what is being charged — the invoice prints these lines */
  lines?: PriceLine[]
  /** add-ons bought once: when they end (worked out at checkout, so the price matches) */
  until?: number
  /** the exact amount Razorpay must report — decided at checkout, so a price edit meanwhile can't break it */
  amountPaise?: number
  createdAt: number
}

/** An autopay subscription that has been authorised but starts billing later. */
export interface UpcomingSubscription {
  subscriptionId: string
  plan: PlanId
  period: Period
  addons?: AddonSel[]
  startsAt: number
}

/* ── tax invoice ───────────────────────────────────────────────────────── */
export interface InvoiceItem {
  description: string
  qty: number
  unit: string            // month | year | the add-on's own unit
  rate: number            // per unit, before GST
  taxable: number
}

export interface Invoice {
  id: string                  // URL-safe, e.g. SB-2026-27-000001
  number: string              // as printed, e.g. SB/2026-27/000001
  issuedAt: number
  paymentId: string
  orderId?: string
  subscriptionId?: string
  plan: PlanId
  period: Period
  periodStart: number
  periodEnd: number
  description: string
  /** plan summary and allowances printed under the description */
  details?: string[]
  qty?: number
  /** per-unit price before GST */
  rate?: number
  /** plan + each add-on, one row apiece */
  items?: InvoiceItem[]
  sac: string
  seller: { name: string; brand?: string; cin?: string; address: string; gstin?: string; stateCode: string }
  /** snapshot of who was billed at the time — later edits to the profile don't rewrite history */
  buyer: BillingProfile
  placeOfSupplyCode: string
  taxable: number
  gstPercent: number
  taxKind: 'intra' | 'inter'
  cgst: number
  sgst: number
  igst: number
  total: number
  amountPaise: number
  method?: string
  kind: 'purchase' | 'renewal' | 'dunning_recovery' | 'addon' | 'upgrade'
  /** coupon taken off before GST */
  discount?: { code: string; amount: number }
  /** a custom term in months */
  months?: number
  /** paid offline and recorded by staff */
  offline?: boolean
  /** subscription number, reference and remarks staff put on the subscription */
  extra?: { subscription?: string; reference?: string; remarks?: string }
}

/* ── dunning (failed-renewal recovery) ─────────────────────────────────── */
export interface DunningAttempt {
  n: number
  at: number
  /** charge = the failed automatic debit; collection = a pay-now request sent to the customer */
  kind: 'charge' | 'collection'
  /** pending = a debit was submitted and the bank hasn't answered yet */
  result: 'failed' | 'sent' | 'paid' | 'send_failed' | 'expired' | 'pending'
  reason?: string
  paymentId?: string
  linkId?: string
  linkUrl?: string
}

export interface Dunning {
  state: 'active' | 'recovered' | 'exhausted'
  engine?: AutopayEngine
  /** the billing cycle that failed — identifies it so we never start twice for one cycle */
  cycleKey: number
  startedAt: number
  /** suspend when this passes without payment */
  deadline: number
  amountPaise: number
  plan: PlanId
  period: Period
  addons?: AddonSel[]
  attempts: DunningAttempt[]
  nextAttemptAt: number | null
  /** token engine: a pay-now link kept open so the customer can fix it immediately */
  linkId?: string
  linkUrl?: string
  /** token engine: the notified order the NEXT debit retry will use */
  retryOrder?: { orderId: string; payAfter: number } | null
  resolvedAt?: number
  resolution?: 'paid_via_link' | 'razorpay_retry' | 'auto_retry' | 'window_elapsed'
}

/** An add-on bought once: it runs until the plan period it was bought in ends, and does not renew. */
export interface ExtraAddon {
  id: string
  qty: number
  at: number
  until: number
  paymentId: string
  /** 'monthly' = bought for one month (30 days, never past the plan's end) */
  term?: Period
}

/** A note staff keep on a client (calls, promises, context). */
export interface StaffNote { at: number; by: string; text: string }

/** A plan given to a customer from the admin panel — paid offline, or free. No Razorpay payment, no invoice. */
export interface AdminGrant {
  at: number
  plan: PlanId
  period: Period
  addons: AddonSel[]
  until: number
  note: string
  /** staff email that assigned it */
  by?: string
}

/** A subscription staff set up in the admin panel. Like a recurring invoice: one cycle is billed when it
    is set up and each next one when staff record its payment (Renewals), at the same prices — and the same
    discounts when they apply on every renewal — until `cycles` have been billed (null = until cancelled). */
export interface StaffSub {
  number: string                 // SUB-00001
  cycles: number | null
  billed: number
  discounts: Discount[]
  discountRenews: boolean
  reference?: string
  /** staff email */
  salesperson?: string
  remarks?: string
  startedAt: number
  by: string
}

export interface ClientDocument { id: string; name: string; type: string; size: number; at: number; by: string }

/** How SmatBot sells to this customer (set in the admin console). Unset = direct. white_label = a
    white-label client; a partner_client belongs to a partner. Older records may still hold reseller /
    reseller_client / white_label_client — admin.ts customerTypeOf reads them as today's types. */
export type CustomerType = 'direct' | 'white_label' | 'partner' | 'partner_client' | 'on_premise'

export interface BillingRecord {
  workspaceId: string
  customerType?: CustomerType
  /** who set up the current subscription: SmatBot staff (admin panel) or the customer paying in their dashboard */
  source?: 'staff' | 'dashboard'
  /** the subscription staff set up, billed one cycle at a time (see adminApi.ts) */
  staffSub?: StaffSub | null
  /** files staff attached to this client (a PO, the agreement …); the content is in the doc `file:<id>` */
  documents?: ClientDocument[]
  /** for a partner client: the partner's workspaceId */
  partner?: string | null
  plan: PlanId | null
  period: Period | null
  mode: 'once' | 'autopay' | null
  status: SubStatus
  subscriptionId?: string
  engine?: AutopayEngine
  /** Razorpay customer the saved card belongs to */
  customerId?: string
  mandate?: TokenMandate | null
  renewal?: Renewal | null
  /** add-ons bought with the current plan; they renew with it */
  addons?: AddonSel[]
  /** one-time add-ons — they do not renew */
  extraAddons?: ExtraAddon[]
  currentStart?: number | null
  currentEnd?: number | null
  nextChargeAt?: number | null
  paidCount?: number
  remainingCount?: number
  /** autopay switched off — plan keeps running until currentEnd, then stops */
  cancelAtCycleEnd: boolean
  /** autopay stopped working (failed renewals) and the customer paid manually instead */
  autopayLapsed?: boolean
  scheduledChange?: { plan: PlanId; period: Period; at: number; addons?: AddonSel[] } | null
  upcoming?: UpcomingSubscription | null
  paymentMethod?: PaymentMethod | null
  payments: PaymentLogEntry[]
  invoices?: Invoice[]
  dunning?: Dunning | null
  /** who is being billed — name, address, GSTIN (see india.ts for why) */
  profile?: BillingProfile | null
  /** every recurring-charge authorisation, newest first */
  consents?: ConsentEntry[]
  pending?: PendingCheckout | null
  /** plans assigned from the admin panel, newest first */
  grants?: AdminGrant[]
  /** the prices this customer bought at; renewals keep them when the list price changes */
  priceLock?: PriceLock | null
  /** a custom term (in months) for the current period, e.g. 6 — priced monthly × months */
  termMonths?: number | null
  /** ₹ before GST paid for the current period (0 for a free plan) — what an upgrade credits back */
  periodPaid?: number | null
  /** cancellation booked for the end of the period (unix seconds) */
  cancelAt?: number | null
  cancelledAt?: number | null
  /** Meta phone_number_ids of their WhatsApp numbers — how message usage is matched to them */
  whatsappNumbers?: string[]
  notes?: StaffNote[]
  updatedAt: number
}

export interface UsageRow { workspaceId: string; day: string; metric: string; value: number }
/** One metric for the current period: used (null = not reported) against the limit (null = unlimited, 0 = not included). */
export interface UsageItem { metric: string; label: string; kind: 'count' | 'gauge'; used: number | null; limit: number | null; pct: number | null }

/** Where billing state lives. A JSON file in dev, Postgres in production. */
export interface BillingStore {
  get(workspaceId: string): Promise<BillingRecord | null>
  put(record: BillingRecord): Promise<void>
  findBySubscription(subscriptionId: string): Promise<BillingRecord | null>
  /** Records currently in dunning — what the background job works through. */
  listActiveDunning(): Promise<BillingRecord[]>
  /** Records on token autopay — the job that sends notices and debits works through these. */
  listTokenAutopay(): Promise<BillingRecord[]>
  /** Every record, most recently changed first — the admin panel's customer list. */
  list(): Promise<BillingRecord[]>
  /** Small shared documents for the admin console: 'staff', 'coupons', 'catalog', 'audit' … */
  getDoc<T>(key: string): Promise<T | null>
  putDoc(key: string, value: unknown): Promise<void>
  /** Add to a usage counter atomically — one row per workspace, IST day ('YYYY-MM-DD') and metric. */
  addUsage(workspaceId: string, day: string, metric: string, qty: number): Promise<void>
  /** Usage rows from `fromDay` on (inclusive), for one workspace or for everyone. */
  usage(fromDay: string, workspaceId?: string): Promise<UsageRow[]>
  /** Atomic counter (invoice numbers must be gapless and never repeat, across all customers). */
  nextSequence(key: string): Promise<number>
}

export interface BillingRequest {
  method: string
  /** path below /api/billing, e.g. "/checkout" */
  path: string
  body?: Record<string, unknown>
  rawBody?: Buffer | string
  headers: Record<string, string | undefined>
  workspaceId: string
  /** caller's address and browser, kept with consent records */
  ip?: string
  userAgent?: string
}

export interface BillingResponse {
  status: number
  body: unknown
  /** set for non-JSON bodies (the printable invoice page) */
  contentType?: string
}
