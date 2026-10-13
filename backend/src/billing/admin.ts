// admin.ts — the parts of the admin console that don't need the billing service:
// staff passwords, signed sign-in tokens, and coupons (who may use one and what it takes off).
import { createHmac, randomBytes, scrypt, timingSafeEqual } from 'node:crypto'
import { promisify } from 'node:util'
import { isPeriod, isPlanId, type Period, type PlanId } from './catalog.js'

/* ── staff accounts ──────────────────────────────────────────────────────
   admin    everything: plans, coupons, the team
   support  sees clients and renewals and can open a customer's dashboard; moves no money */
export type StaffRole = 'admin' | 'support'
export const isStaffRole = (v: unknown): v is StaffRole => v === 'admin' || v === 'support'

export interface StaffMember {
  email: string
  name: string
  role: StaffRole
  active: boolean
  passwordHash: string
  createdAt: number
  createdBy: string
  lastLoginAt?: number
}

const scryptAsync = promisify(scrypt) as (pw: string, salt: Buffer, len: number) => Promise<Buffer>

export async function hashPassword(pw: string): Promise<string> {
  const salt = randomBytes(16)
  return `scrypt$${salt.toString('base64')}$${(await scryptAsync(pw, salt, 32)).toString('base64')}`
}

export async function checkPassword(pw: string, stored: string): Promise<boolean> {
  const [kind, salt, hash] = stored.split('$')
  if (kind !== 'scrypt' || !salt || !hash) return false
  const got = await scryptAsync(pw, Buffer.from(salt, 'base64'), 32)
  const want = Buffer.from(hash, 'base64')
  return got.length === want.length && timingSafeEqual(got, want)
}

/* ── sign-in tokens: "<payload>.<signature>", good for 12 hours ─────────── */
export const SESSION_TTL = 12 * 3600

export function signSession(key: string, email: string, now: number): string {
  const payload = Buffer.from(JSON.stringify({ e: email, x: now + SESSION_TTL })).toString('base64url')
  return `${payload}.${createHmac('sha256', key).update(payload).digest('base64url')}`
}

/** The email a token was issued to, or null if it is forged or expired. */
export function readSession(key: string, token: string | undefined, now: number): string | null {
  const [payload, sig] = (token ?? '').split('.')
  if (!payload || !sig) return null
  const want = createHmac('sha256', key).update(payload).digest('base64url')
  if (sig.length !== want.length || !timingSafeEqual(Buffer.from(sig), Buffer.from(want))) return null
  try {
    const { e, x } = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'))
    return typeof e === 'string' && typeof x === 'number' && x > now ? e : null
  } catch { return null }
}

/* ── coupons ─────────────────────────────────────────────────────────────
   A coupon takes money off ONE "Pay once" plan purchase, before GST. Not on autopay: the customer
   would be authorising a recurring amount different from what they pay today. */
export interface Coupon {
  code: string
  type: 'percent' | 'flat'
  /** percent 1–99, or ₹ off */
  value: number
  /** empty = every plan */
  plans: PlanId[]
  /** empty = monthly and yearly */
  periods: Period[]
  expiresAt: number | null
  maxUses: number | null
  oncePerCustomer: boolean
  active: boolean
  uses: number
  note: string
  createdAt: number
  createdBy: string
}

type CouponFields = Pick<Coupon, 'code' | 'type' | 'value' | 'plans' | 'periods' | 'expiresAt' | 'maxUses' | 'oncePerCustomer' | 'note'>

export function parseCoupon(input: Record<string, unknown>, now: number): { ok: true; coupon: CouponFields } | { ok: false; message: string } {
  const fail = (message: string) => ({ ok: false as const, message })
  const code = String(input.code ?? '').trim().toUpperCase()
  if (!/^[A-Z0-9_-]{3,30}$/.test(code)) return fail('Code: 3–30 letters, digits, - or _.')
  const type = input.type
  if (type !== 'percent' && type !== 'flat') return fail('Choose a percentage or a flat amount.')
  const value = Number(input.value)
  if (type === 'percent' && !(Number.isInteger(value) && value >= 1 && value <= 99)) return fail('Percentage: a whole number from 1 to 99.')
  if (type === 'flat' && !(Number.isFinite(value) && value >= 1 && value <= 1_000_000)) return fail('Amount: ₹1 to ₹10,00,000.')
  const plans = Array.isArray(input.plans) ? input.plans : []
  if (!plans.every(isPlanId)) return fail('One of the plans is not valid.')
  const periods = Array.isArray(input.periods) ? input.periods : []
  if (!periods.every(isPeriod)) return fail('Billing must be monthly or yearly.')
  const expiresAt = input.expiresAt == null ? null : Number(input.expiresAt)
  if (expiresAt !== null && !(Number.isInteger(expiresAt) && expiresAt > now)) return fail('The expiry date must be in the future.')
  const maxUses = input.maxUses == null || input.maxUses === '' ? null : Number(input.maxUses)
  if (maxUses !== null && !(Number.isInteger(maxUses) && maxUses >= 1 && maxUses <= 100_000)) return fail('Maximum uses: a whole number, at least 1.')
  return {
    ok: true,
    coupon: {
      code, type, value: Math.round(value * 100) / 100, plans: [...new Set(plans)], periods: [...new Set(periods)],
      expiresAt, maxUses, oncePerCustomer: input.oncePerCustomer === true, note: String(input.note ?? '').trim().slice(0, 200),
    },
  }
}

/** Why this coupon can't be used on this purchase, or null if it can. */
export function couponProblem(c: Coupon | undefined, plan: PlanId, period: Period, now: number, usedBefore: boolean): string | null {
  if (!c || !c.active) return 'That coupon code is not valid.'
  if (c.expiresAt && c.expiresAt <= now) return 'That coupon has expired.'
  if (c.maxUses !== null && c.uses >= c.maxUses) return 'That coupon has been fully used.'
  if (c.plans.length && !c.plans.includes(plan)) return 'That coupon is not for this plan.'
  if (c.periods.length && !c.periods.includes(period)) return `That coupon is only for ${c.periods[0]} billing.`
  if (c.oncePerCustomer && usedBefore) return 'You have already used that coupon.'
  return null
}

/** ₹ off a price before GST. Always leaves at least ₹1, because Razorpay can't take a ₹0 payment. */
export function couponDiscount(c: Coupon, base: number): number {
  const off = c.type === 'percent' ? Math.round(base * c.value) / 100 : c.value
  return Math.max(0, Math.min(off, base - 1))
}
