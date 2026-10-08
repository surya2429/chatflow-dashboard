import type { Period, PlanId } from './catalog.js'
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
  plan: PlanId
  period: Period
  orderId?: string
  subscriptionId?: string
  /** the customer's consent to recurring charges, recorded when they authorise */
  consent?: ConsentEntry
  /** unix seconds the new subscription begins billing (turning autopay back on at renewal) */
  startAt?: number
  createdAt: number
}

/** An autopay subscription that has been authorised but starts billing later. */
export interface UpcomingSubscription {
  subscriptionId: string
  plan: PlanId
  period: Period
  startsAt: number
}

/* ── tax invoice ───────────────────────────────────────────────────────── */
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
  kind: 'purchase' | 'renewal' | 'dunning_recovery'
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

export interface BillingRecord {
  workspaceId: string
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
  currentStart?: number | null
  currentEnd?: number | null
  nextChargeAt?: number | null
  paidCount?: number
  remainingCount?: number
  /** autopay switched off — plan keeps running until currentEnd, then stops */
  cancelAtCycleEnd: boolean
  /** autopay stopped working (failed renewals) and the customer paid manually instead */
  autopayLapsed?: boolean
  scheduledChange?: { plan: PlanId; period: Period; at: number } | null
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
  updatedAt: number
}

/** Where billing state lives. A JSON file in dev, Postgres in production. */
export interface BillingStore {
  get(workspaceId: string): Promise<BillingRecord | null>
  put(record: BillingRecord): Promise<void>
  findBySubscription(subscriptionId: string): Promise<BillingRecord | null>
  /** Records currently in dunning — what the background job works through. */
  listActiveDunning(): Promise<BillingRecord[]>
  /** Records on token autopay — the job that sends notices and debits works through these. */
  listTokenAutopay(): Promise<BillingRecord[]>
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
