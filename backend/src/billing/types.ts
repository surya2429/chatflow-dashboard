import type { Period, PlanId } from './catalog.js'
import type { BillingProfile } from './india.js'

export type SubStatus =
  | 'none' | 'created' | 'authenticated' | 'active' | 'pending' | 'halted'
  | 'paused' | 'cancelled' | 'completed' | 'expired'

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

/** A checkout that has been started but not yet confirmed by a verified signature. */
export interface PendingCheckout {
  mode: 'once' | 'autopay'
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
}

/** An autopay subscription that has been authorised but starts billing later. */
export interface UpcomingSubscription {
  subscriptionId: string
  plan: PlanId
  period: Period
  startsAt: number
}

export interface BillingRecord {
  workspaceId: string
  plan: PlanId | null
  period: Period | null
  mode: 'once' | 'autopay' | null
  status: SubStatus
  subscriptionId?: string
  currentStart?: number | null
  currentEnd?: number | null
  nextChargeAt?: number | null
  paidCount?: number
  remainingCount?: number
  /** autopay switched off — plan keeps running until currentEnd, then stops */
  cancelAtCycleEnd: boolean
  scheduledChange?: { plan: PlanId; period: Period; at: number } | null
  upcoming?: UpcomingSubscription | null
  paymentMethod?: PaymentMethod | null
  payments: PaymentLogEntry[]
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
}
