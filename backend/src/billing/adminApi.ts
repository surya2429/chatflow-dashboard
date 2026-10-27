// adminApi.ts — SmatBot's admin console (/api/billing/admin/*): clients and their plans, add-ons,
// offline payments, cancellations, downgrade impact, the price list, coupons, the team, usage,
// analytics and an activity log.
//
// Staff sign in with their own account; the server checks the token AND the role on every request
// (admin / owner: everything · support: read, notes and "log in as customer", never money or access).
// Plan changes go through the same engine as the customer's own purchases (AdminCtx), so a staff
// change follows exactly the same rules: one current period, locked prices, invoices for money taken.
import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto'
import {
  ADDON_CATALOG, FEATURES, METRICS, PLAN_CATALOG, addPeriod, addonDef, addonLines, currentCatalog, eligibleAddons, isPeriod, isPlanId,
  mergeAddons, normalizeAddons, planName, validateCatalog, DAY, AFA_LIMIT_RUPEES,
  type AddonSel, type Catalog, type Discount, type Period, type PlanId, type PriceLine, type PriceOpts, type Charge,
} from './catalog.js'
import {
  PARTNER_TYPE, checkPassword, customerTypeOf, hashPassword, isCustomerType, isStaffRole, parseCoupon, readSession, signSession,
  type Coupon, type StaffMember, type StaffRole,
} from './admin.js'
import { stateName, validateProfile } from './india.js'
import { renderInvoiceHtml, type SellerInfo } from './invoice.js'
import type { BillingRecord, BillingRequest, BillingResponse, BillingStore, Invoice, UsageItem } from './types.js'

type Staff = { email: string; name: string; role: 'owner' | StaffRole }
type Usage = { reported: boolean; lastReportAt: number | null; items: UsageItem[]; features?: Record<string, boolean> | null }

/** What the admin console borrows from the billing engine (service.ts). */
export interface AdminCtx {
  store: BillingStore
  now: () => number
  gstPercent: number
  seller: SellerInfo
  owner?: { email: string; password: string }
  maxDunningAttempts: number
  terminal: Set<string>
  chargeOf: (plan: PlanId, period: Period, rec?: BillingRecord | null, o?: Omit<PriceOpts, 'place'>) => Charge
  isLive: (rec: BillingRecord | null | undefined) => boolean
  termOf: (rec: BillingRecord) => number
  changeKind: (rec: BillingRecord, plan: PlanId, period: Period) => 'same' | 'upgrade' | 'downgrade'
  startPeriod: (rec: BillingRecord, o: { plan: PlanId; period: Period; months?: number | null; addons: AddonSel[]; start: number; end: number; paid: number; relock: boolean }) => void
  paidValue: (lines: PriceLine[]) => number
  recordPayment: (rec: BillingRecord, p: {
    paymentId: string; plan: PlanId; period: Period; amountPaise: number; addons?: AddonSel[]; addonsOnly?: boolean; method?: string; at?: number
    periodStart: number; periodEnd: number; kind: Invoice['kind']; lines?: PriceLine[]; months?: number; offline?: { method: string; reference: string; by: string }
  }) => Promise<Invoice | null>
  cancelPlan: (rec: BillingRecord, when: 'now' | 'period_end') => Promise<void>
  stopAutopay: (rec: BillingRecord) => Promise<void>
  addonPrice: (rec: BillingRecord & { plan: PlanId; period: Period; currentEnd: number }, addons: AddonSel[], how: 'month' | 'plan' | 'recurring') => { c: Charge; until: number; addonPeriod: Period }
  allowancesOf: (rec: BillingRecord) => Record<string, number | null>
  usageOf: (rec: BillingRecord) => Promise<Usage>
  loadCatalog: (force?: boolean) => Promise<void>
  blank: (workspaceId: string) => BillingRecord
  forgetPhoneMap: () => void
}

const reply = (status: number, body: unknown): BillingResponse => ({ status, body })
const err = (status: number, error: string, message?: string): BillingResponse => reply(status, { error, message })
const r2 = (n: number) => Math.round(n * 100) / 100
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const WS_RE = /^(?!__)[A-Za-z0-9_.@-]{1,64}$/
const OFFLINE_METHODS = ['bank_transfer', 'upi', 'cheque', 'cash', 'card_offline', 'other'] as const
const TICKET = 'imp|'
const TICKET_TTL = 120

export function createAdminApi(ctx: AdminCtx) {
  const { store, now, gstPercent, seller } = ctx
  const owner = ctx.owner?.email && ctx.owner.password ? { email: ctx.owner.email.trim().toLowerCase(), password: ctx.owner.password } : undefined
  const sessionKey = owner ? createHmac('sha256', owner.password).update('smatbot-admin-session-v1').digest('base64') : ''
  const digest = (s: string) => createHash('sha256').update(s).digest()   // equal lengths for timingSafeEqual
  const same = (a: string, b: string) => timingSafeEqual(digest(a), digest(b))
  const body = (req: BillingRequest) => (req.body ?? {}) as Record<string, unknown>

  const staffList = async () => (await store.getDoc<StaffMember[]>('staff')) ?? []
  const coupons = async () => (await store.getDoc<Coupon[]>('coupons')) ?? []
  const staffView = (s: StaffMember) => ({ email: s.email, name: s.name, role: s.role, active: s.active, createdAt: s.createdAt, createdBy: s.createdBy, lastLoginAt: s.lastLoginAt ?? null })
  const badPassword = (pw: unknown) => typeof pw !== 'string' || pw.length < 8 || pw.length > 200

  /* ── activity log ────────────────────────────────────────────────────────
     shortcut: one capped doc (last 2,000 entries); move to its own table when it needs search or more history. */
  interface AuditEntry { at: number; by: string; action: string; target?: string; detail?: string }
  async function audit(me: Staff, action: string, target?: string, detail?: string): Promise<void> {
    const list = (await store.getDoc<AuditEntry[]>('audit')) ?? []
    list.unshift({ at: now(), by: me.email, action, ...(target ? { target } : {}), ...(detail ? { detail } : {}) })
    await store.putDoc('audit', list.slice(0, 2000))
  }

  /* ── sign-in ───────────────────────────────────────────────────────────── */
  async function currentStaff(req: BillingRequest): Promise<Staff | null> {
    const email = readSession(sessionKey, req.headers['x-admin-token'], now())
    if (!email || !owner) return null
    if (email === owner.email) return { email, name: 'Owner', role: 'owner' }
    const s = (await staffList()).find((m) => m.email === email && m.active)   // switched off = signed out
    return s ? { email: s.email, name: s.name, role: s.role } : null
  }

  /* shortcut: the wrong-password lockout (5 tries, then 10 minutes) lives in memory, per email; a restart
     clears it and separate API instances don't share it — move it to Redis if that matters. */
  const failures = new Map<string, { n: number; until: number }>()

  async function login(req: BillingRequest): Promise<BillingResponse> {
    const { email: emailIn, password } = body(req)
    const email = typeof emailIn === 'string' ? emailIn.trim().toLowerCase().slice(0, 200) : ''
    const f = failures.get(email)
    if (f && f.until > now()) return err(429, 'too_many_attempts', 'Too many wrong passwords. Try again in 10 minutes.')
    let user: Staff | null = null
    if (owner && email && typeof password === 'string') {
      if (same(email, owner.email)) {
        if (same(password, owner.password)) user = { email, name: 'Owner', role: 'owner' }
      } else {
        const list = await staffList()
        const s = list.find((m) => m.email === email)
        if (s?.active && await checkPassword(password, s.passwordHash)) {
          user = { email: s.email, name: s.name, role: s.role }
          s.lastLoginAt = now()
          await store.putDoc('staff', list)
        }
      }
    }
    if (!user) {
      const n = (f?.n ?? 0) + 1
      failures.set(email, n >= 5 ? { n: 0, until: now() + 600 } : { n, until: 0 })
      return err(401, 'unauthorized', 'Wrong email or password.')
    }
    failures.delete(email)
    return reply(200, { token: signSession(sessionKey, user.email, now()), user })
  }

  /* ── the team ──────────────────────────────────────────────────────────── */
  async function createStaff(req: BillingRequest, me: Staff): Promise<BillingResponse> {
    const b = body(req)
    const name = typeof b.name === 'string' ? b.name.trim().slice(0, 80) : ''
    const email = typeof b.email === 'string' ? b.email.trim().toLowerCase() : ''
    if (!name) return err(400, 'invalid_name', 'Enter their name.')
    if (!EMAIL_RE.test(email) || email.length > 200) return err(400, 'invalid_email', 'Enter a valid email address.')
    if (!isStaffRole(b.role)) return err(400, 'invalid_role', 'Choose a role.')
    if (badPassword(b.password)) return err(400, 'invalid_password', 'Password: at least 8 characters.')
    const list = await staffList()
    if (email === owner!.email || list.some((m) => m.email === email)) return err(409, 'exists', 'Someone with that email already has access.')
    const m: StaffMember = { email, name, role: b.role, active: true, passwordHash: await hashPassword(b.password as string), createdAt: now(), createdBy: me.email }
    await store.putDoc('staff', [...list, m])
    await audit(me, 'Added employee', email, `role ${b.role}`)
    return reply(200, staffView(m))
  }

  async function updateStaff(req: BillingRequest, me: Staff): Promise<BillingResponse> {
    const b = body(req)
    const list = await staffList()
    const m = list.find((x) => x.email === String(b.email ?? '').trim().toLowerCase())
    if (!m) return err(404, 'not_found', 'No such employee.')
    if (m.email === me.email && (b.active === false || b.role === 'support')) return err(409, 'own_access', "You can't remove your own admin access.")
    const changes: string[] = []
    if (b.name !== undefined) {
      const name = String(b.name).trim().slice(0, 80)
      if (!name) return err(400, 'invalid_name', 'Enter their name.')
      m.name = name; changes.push('name')
    }
    if (b.role !== undefined) {
      if (!isStaffRole(b.role)) return err(400, 'invalid_role', 'Choose a role.')
      m.role = b.role; changes.push(`role ${b.role}`)
    }
    if (b.active !== undefined) { m.active = b.active === true; changes.push(m.active ? 'switched on' : 'switched off') }
    if (b.password !== undefined) {
      if (badPassword(b.password)) return err(400, 'invalid_password', 'Password: at least 8 characters.')
      m.passwordHash = await hashPassword(b.password as string); changes.push('password reset')
    }
    await store.putDoc('staff', list)
    await audit(me, 'Updated employee', m.email, changes.join(', '))
    return reply(200, staffView(m))
  }

  /* ── coupons ───────────────────────────────────────────────────────────── */
  async function createCoupon(req: BillingRequest, me: Staff): Promise<BillingResponse> {
    const p = parseCoupon(body(req), now())
    if (!p.ok) return err(400, 'invalid_coupon', p.message)
    const list = await coupons()
    if (list.some((c) => c.code === p.coupon.code)) return err(409, 'exists', 'A coupon with that code already exists.')
    const c: Coupon = { ...p.coupon, active: true, uses: 0, createdAt: now(), createdBy: me.email }
    await store.putDoc('coupons', [c, ...list])
    await audit(me, 'Created coupon', c.code, c.type === 'percent' ? `${c.value}% off` : `₹${c.value} off`)
    return reply(200, c)
  }

  async function updateCoupon(req: BillingRequest, me: Staff): Promise<BillingResponse> {
    const b = body(req)
    const list = await coupons()
    const c = list.find((x) => x.code === String(b.code ?? '').trim().toUpperCase())
    if (!c) return err(404, 'not_found', 'No such coupon.')
    if (typeof b.active !== 'boolean') return err(400, 'invalid_request', 'active must be true or false.')
    c.active = b.active
    await store.putDoc('coupons', list)
    await audit(me, c.active ? 'Switched coupon on' : 'Switched coupon off', c.code)
    return reply(200, c)
  }

  /* ── clients ───────────────────────────────────────────────────────────── */
  /* Would the customer still be charged (or chased for money) by autopay? */
  const autopayRunning = (r: BillingRecord) => Boolean(
    r.dunning?.state === 'active' || r.upcoming
    || (r.engine === 'token' ? r.renewal : r.mode === 'autopay' && !r.cancelAtCycleEnd && !ctx.terminal.has(r.status)),
  )

  /* The next time this customer pays: charged automatically (autopay), or due from them (manual). */
  function renewalOf(r: BillingRecord) {
    if (!r.plan || !r.period || !r.currentEnd || r.cancelAt || ['cancelled'].includes(r.status)) return null
    const sc = r.scheduledChange
    const next = r.engine === 'token' && r.renewal
      ? { at: r.renewal.dueAt, type: 'autopay', plan: r.renewal.plan, period: r.renewal.period, addons: r.renewal.addons, months: undefined }
      : r.upcoming
      ? { at: r.upcoming.startsAt, type: 'autopay', plan: r.upcoming.plan, period: r.upcoming.period, addons: r.upcoming.addons, months: undefined }
      : r.mode === 'autopay' && r.engine !== 'token' && !r.cancelAtCycleEnd && !ctx.terminal.has(r.status)
      ? { at: r.nextChargeAt ?? r.currentEnd, type: 'autopay', plan: sc?.plan ?? r.plan, period: sc?.period ?? r.period, addons: sc?.addons ?? r.addons, months: undefined }
      : { at: r.currentEnd, type: 'manual', plan: r.plan, period: r.period, addons: r.addons, months: r.termMonths ?? undefined }
    return {
      at: next.at, type: next.type as 'autopay' | 'manual', plan: next.plan, planName: planName(next.plan), period: next.period, months: next.months ?? null,
      total: ctx.chargeOf(next.plan, next.period, r, { addons: next.addons, months: next.months }).total,
    }
  }

  const statusOf = (r: BillingRecord) => (r.dunning?.state === 'active' ? 'past_due'
    : r.status === 'active' && r.currentEnd && r.currentEnd < now() && !autopayRunning(r) ? (r.cancelAt ? 'cancelled' : 'expired') : r.status)

  /** ₹ per month this client brings in (plan + add-ons, before GST) — 0 while not live or on a free plan. */
  function monthlyValue(r: BillingRecord): number {
    if (!ctx.isLive(r) || !r.plan || !r.period || r.periodPaid === 0) return 0
    return ctx.chargeOf(r.plan, r.period, r, { addons: r.addons, months: r.termMonths ?? undefined }).base / ctx.termOf(r)
  }

  const row = (r: BillingRecord) => {
    const p = r.profile
    const paid = r.payments.filter((x) => x.status === 'paid')
    return {
      workspaceId: r.workspaceId,
      customerType: customerTypeOf(r.customerType),
      partner: PARTNER_TYPE[customerTypeOf(r.customerType)] ? r.partner ?? null : null,
      /** who set up the current plan; older records: staff if their last grant made this term */
      source: r.plan ? r.source ?? (r.grants?.[0] && r.grants[0].until === r.currentEnd ? 'staff' : 'dashboard') : null,
      customer: p?.legalName ?? null,
      contactName: p?.contactName ?? null,
      email: p?.email ?? null,
      phone: p?.phone ?? null,
      gstin: p?.gstin ?? null,
      city: p?.address.city ?? null,
      stateCode: p?.address.stateCode ?? null,
      state: p ? stateName(p.address.stateCode) : null,
      plan: r.plan,
      planName: r.plan ? planName(r.plan) : null,
      period: r.period,
      termMonths: r.termMonths ?? null,
      mode: r.mode,
      status: statusOf(r),
      currentStart: r.currentStart ?? null,
      currentEnd: r.currentEnd ?? null,
      cancelAt: r.cancelAt ?? null,
      /** plan + add-ons for the current term, ₹ before GST, at their prices */
      planValue: r.plan && r.period ? ctx.chargeOf(r.plan, r.period, r, { addons: r.addons, months: r.termMonths ?? undefined }).base : null,
      monthlyValue: r2(monthlyValue(r)),
      /** ₹ before GST actually paid for the current term (after discounts); 0 = free */
      periodPaid: r.periodPaid ?? null,
      free: r.periodPaid === 0,
      autopay: autopayRunning(r),
      engine: r.engine ?? (r.mode === 'autopay' ? 'subscription' : null),
      card: r.mandate ? { last4: r.mandate.last4 ?? null, network: r.mandate.network ?? null } : null,
      renewal: renewalOf(r),
      addons: r.period ? addonLines(r.addons, r.period, r.priceLock).map((l) => ({ ...l, renews: Boolean(r.renewal?.addons?.some((a) => a.id === l.id)) })) : [],
      extraAddons: (r.extraAddons ?? []).filter((e) => e.until > now()).map((e) => ({ id: e.id, name: addonDef(e.id)?.name ?? e.id, qty: e.qty, at: e.at, until: e.until, term: e.term ?? null })),
      paidTotal: r2(paid.reduce((n, x) => n + x.amountPaise, 0) / 100),
      paymentsCount: paid.length,
      lastPaymentAt: paid[0]?.at ?? null,
      lastGrant: r.grants?.[0] ?? null,
      whatsappNumbers: r.whatsappNumbers ?? [],
      updatedAt: r.updatedAt,
    }
  }

  async function customer(ws: string): Promise<BillingResponse> {
    const r = await store.get(ws)
    if (!r) return err(404, 'not_found', 'No such customer.')
    const d = r.dunning
    return reply(200, {
      ...row(r),
      profile: r.profile ?? null,
      payments: r.payments.map((x) => ({
        id: x.id, at: x.at, amountPaise: x.amountPaise, planName: planName(x.plan), period: x.period, status: x.status, method: x.method ?? null, coupon: x.coupon ?? null,
        kind: x.kind ?? r.invoices?.find((i) => i.paymentId === x.id)?.kind ?? null, offline: x.offline ?? null,
      })),
      invoices: (r.invoices ?? []).map((i) => ({ id: i.id, number: i.number, at: i.issuedAt, amountPaise: i.amountPaise, kind: i.kind })),
      grants: r.grants ?? [],
      notes: r.notes ?? [],
      usage: await ctx.usageOf(r),
      allowances: ctx.allowancesOf(r),
      dunning: d?.state === 'active' ? { attempts: d.attempts.length, maxAttempts: ctx.maxDunningAttempts, deadline: d.deadline, nextAttemptAt: d.nextAttemptAt, amountPaise: d.amountPaise } : null,
      activity: ((await store.getDoc<AuditEntry[]>('audit')) ?? []).filter((a) => a.target === ws).slice(0, 50),
    })
  }

  const getRec = async (ws: unknown) => (typeof ws === 'string' && WS_RE.test(ws) ? store.get(ws) : null)

  async function setCustomerType(req: BillingRequest, me: Staff): Promise<BillingResponse> {
    const b = body(req)
    const rec = await getRec(b.workspaceId)
    if (!rec) return err(404, 'not_found', 'No such customer.')
    if (!isCustomerType(b.type)) return err(400, 'invalid_type', 'Choose a customer type.')
    const partnerType = PARTNER_TYPE[b.type]
    let partner: string | null = null
    if (partnerType && b.partner) {
      const p = await getRec(b.partner)
      if (!p || p.workspaceId === rec.workspaceId || customerTypeOf(p.customerType) !== partnerType) {
        return err(400, 'invalid_partner', 'Pick a partner.')
      }
      partner = p.workspaceId
    }
    rec.customerType = b.type; rec.partner = partner; rec.updatedAt = now()
    await store.put(rec)
    await audit(me, 'Changed customer type', rec.workspaceId, b.type + (partner ? ` under ${partner}` : ''))
    return reply(200, row(rec))
  }

  async function setProfile(req: BillingRequest, me: Staff): Promise<BillingResponse> {
    const b = body(req)
    const rec = await getRec(b.workspaceId)
    if (!rec) return err(404, 'not_found', 'No such customer.')
    const v = validateProfile((b.profile ?? {}) as Parameters<typeof validateProfile>[0], now())
    if (!v.ok) return reply(422, { error: 'invalid_profile', message: 'Some details need fixing.', fields: v.fields })
    rec.profile = v.profile; rec.updatedAt = now()
    await store.put(rec)
    await audit(me, 'Updated billing details', rec.workspaceId)
    return reply(200, row(rec))
  }

  async function addNote(req: BillingRequest, me: Staff): Promise<BillingResponse> {
    const b = body(req)
    const rec = await getRec(b.workspaceId)
    if (!rec) return err(404, 'not_found', 'No such customer.')
    const text = typeof b.text === 'string' ? b.text.trim().slice(0, 2000) : ''
    if (!text) return err(400, 'invalid_note', 'Write something first.')
    rec.notes = [{ at: now(), by: me.email, text }, ...(rec.notes ?? [])].slice(0, 500)
    rec.updatedAt = now()
    await store.put(rec)
    return reply(200, { notes: rec.notes })
  }

  /* Their WhatsApp numbers (Meta phone_number_id): how WhatsApp usage is matched to them. A number can belong to one client only. */
  async function setNumbers(req: BillingRequest, me: Staff): Promise<BillingResponse> {
    const b = body(req)
    const rec = await getRec(b.workspaceId)
    if (!rec) return err(404, 'not_found', 'No such customer.')
    const numbers = [...new Set((Array.isArray(b.numbers) ? b.numbers : []).map((n) => String(n).trim()).filter(Boolean))]
    if (numbers.length > 20 || numbers.some((n) => !/^\d{6,20}$/.test(n))) return err(400, 'invalid_numbers', 'Use Meta phone number IDs: digits only, up to 20 numbers.')
    for (const other of await store.list()) {
      if (other.workspaceId === rec.workspaceId) continue
      const clash = numbers.find((n) => other.whatsappNumbers?.includes(n))
      if (clash) return err(409, 'number_taken', `${clash} already belongs to ${other.profile?.legalName ?? other.workspaceId}.`)
    }
    rec.whatsappNumbers = numbers; rec.updatedAt = now()
    await store.put(rec)
    ctx.forgetPhoneMap()
    await audit(me, 'Set WhatsApp numbers', rec.workspaceId, numbers.join(', ') || 'none')
    return reply(200, row(rec))
  }

  async function invoice(ws: string, id: string): Promise<BillingResponse> {
    const inv = (await store.get(ws))?.invoices?.find((i) => i.id === id)
    if (!inv) return err(404, 'not_found', 'No such invoice.')
    return { status: 200, body: renderInvoiceHtml(inv, seller), contentType: 'text/html; charset=utf-8' }
  }

  /* ── money staff take outside Razorpay ───────────────────────────────────
     free     nothing is charged, no invoice (a trial, goodwill, a partner's own account)
     offline  money received by bank transfer / UPI / cheque / cash: recorded as a payment and
              invoiced. The amount is what was received INCLUDING GST; a difference from the list
              price shows on the invoice as a price adjustment. */
  interface PaymentIn { type: 'free' | 'offline'; amountPaise: number; method: string; reference: string; at: number }
  function paymentIn(v: unknown): { ok: true; p: PaymentIn } | { ok: false; res: BillingResponse } {
    const p = (v ?? {}) as Record<string, unknown>
    if (p.type !== 'offline') return { ok: true, p: { type: 'free', amountPaise: 0, method: '', reference: '', at: now() } }
    const amount = Number(p.amount)
    if (!Number.isFinite(amount) || amount < 1 || amount > 10_000_000) return { ok: false, res: err(400, 'invalid_amount', 'Enter the amount received, including GST.') }
    const method = String(p.method ?? '')
    if (!(OFFLINE_METHODS as readonly string[]).includes(method)) return { ok: false, res: err(400, 'invalid_method', 'Choose how it was paid.') }
    const at = p.paidAt == null ? now() : Number(p.paidAt)
    if (!Number.isInteger(at) || at > now() + 3600 || at < now() - 366 * DAY) return { ok: false, res: err(400, 'invalid_date', 'The payment date must be within the last year.') }
    return { ok: true, p: { type: 'offline', amountPaise: Math.round(amount * 100), method, reference: String(p.reference ?? '').trim().slice(0, 100), at } }
  }
  /** The charged lines with the amount actually received: any difference becomes an adjustment line. */
  function linesFor(c: Charge, received: PaymentIn): PriceLine[] {
    const base = r2(received.amountPaise / 100 / (1 + gstPercent / 100))
    const diff = r2(base - c.base)
    return Math.abs(diff) < 0.01 ? c.lines : [...c.lines, { kind: 'adjustment', description: diff < 0 ? 'Special price (discount agreed)' : 'Price adjustment', qty: 1, unit: '', rate: diff, amount: diff }]
  }
  const offlineId = () => `offline_${now()}_${randomBytes(3).toString('hex')}`

  /* Discounts staff give: one per item ('plan' or an add-on in this subscription) and/or one on the total. */
  function parseDiscounts(v: unknown, addons: AddonSel[]): { ok: true; discounts: Discount[] } | { ok: false; res: BillingResponse } {
    const fail = (message: string) => ({ ok: false as const, res: err(400, 'invalid_discount', message) })
    if (v == null) return { ok: true, discounts: [] }
    if (!Array.isArray(v) || v.length > 41) return fail('Discounts must be a list.')
    const out: Discount[] = []
    for (const raw of v) {
      const d = (raw ?? {}) as Record<string, unknown>
      const target = String(d.target ?? '')
      if (target !== 'total' && target !== 'plan' && !addons.some((a) => a.id === target)) return fail('A discount is on something that is not in this subscription.')
      if (d.type !== 'percent' && d.type !== 'flat') return fail('A discount is a percentage or an amount in ₹.')
      const value = Number(d.value)
      if (!Number.isFinite(value) || value <= 0 || (d.type === 'percent' ? value > 100 : value > 10_000_000)) return fail('Discounts: a percentage up to 100, or an amount in ₹.')
      if (out.some((x) => x.target === target)) return fail('One discount per item.')
      out.push({ target, type: d.type, value: r2(value) })
    }
    return { ok: true, discounts: out }
  }

  /* A subscription staff are setting up, checked — shared by the live quote and the change itself.
     cycles     how many billing periods it covers, billed upfront: monthly × 3 = 3 months, yearly × 2 =
                2 years (yearly price × years); up to 36 months. (months = the older custom-term field.)
     start      'now' (optionally backdated by startDate, up to a year) · 'after_current' (the same plan
                continues from the current end) · 'renewal' (card autopay: the next renewal changes) */
  function parseSubscription(b: Record<string, unknown>, rec: BillingRecord) {
    const fail = (res: BillingResponse) => ({ ok: false as const, res })
    const { plan } = b
    if (!isPlanId(plan)) return fail(err(400, 'invalid_plan', 'Choose a plan.'))
    const basePeriod: Period = isPeriod(b.period) ? b.period : 'monthly'
    const num = (v: unknown) => (v == null || v === '' ? undefined : Number(v))
    const cycles = num(b.cycles), monthsIn = num(b.months)
    const perCycle = basePeriod === 'yearly' ? 12 : 1
    if (cycles !== undefined && !(Number.isInteger(cycles) && cycles >= 1 && cycles * perCycle <= 36)) return fail(err(400, 'invalid_cycles', 'Up to 36 months: 1–36 monthly cycles, or 1–3 yearly ones.'))
    if (monthsIn !== undefined && !(Number.isInteger(monthsIn) && monthsIn >= 1 && monthsIn <= 36)) return fail(err(400, 'invalid_months', 'A custom term is 1 to 36 months.'))
    const months = cycles !== undefined ? (cycles > 1 ? cycles * perCycle : undefined) : monthsIn
    const period: Period = cycles === undefined && monthsIn ? 'monthly' : basePeriod
    const sel = normalizeAddons(b.addons, plan, true)
    if (!sel.ok) return fail(err(400, 'invalid_addons', sel.message))
    const disc = parseDiscounts(b.discounts, sel.addons)
    if (!disc.ok) return fail(disc.res)
    const start = b.start === 'after_current' || b.start === 'renewal' ? b.start : 'now'
    const t = now()
    let from = t
    if (start === 'after_current') {
      if (!ctx.isLive(rec) || rec.plan !== plan) return fail(err(409, 'not_same_plan', 'To change plan, start the new one now. "After the current period" continues the plan they are on.'))
      from = rec.currentEnd!
    } else if (start === 'now' && num(b.startDate) !== undefined) {
      const sd = num(b.startDate)!
      if (!Number.isInteger(sd) || sd > t + 3600 || sd < t - 366 * DAY) return fail(err(400, 'invalid_start', 'The start date can be today or up to a year back. To continue the plan they are on, start it after the current period.'))
      from = Math.min(sd, t)
    }
    const untilIn = num(b.until)
    const end = untilIn ?? addPeriod(from, period, months)
    if (!Number.isInteger(end) || end <= t || end > from + 5 * 366 * DAY) return fail(err(400, 'invalid_until', 'This subscription would already be over — pick a later start date or more cycles.'))
    return { ok: true as const, plan, period, months, cycles: cycles ?? 1, addons: sel.addons, discounts: disc.discounts, start, from, end }
  }

  /* The price of a subscription being set up, line by line — what the form shows before saving. */
  async function quote(req: BillingRequest): Promise<BillingResponse> {
    const b = body(req)
    const ws = typeof b.workspaceId === 'string' && WS_RE.test(b.workspaceId.trim()) ? b.workspaceId.trim() : '__quote'
    const rec = (ws === '__quote' ? null : await store.get(ws)) ?? ctx.blank(ws)
    const s = parseSubscription(b, rec)
    if (!s.ok) return s.res
    const c = ctx.chargeOf(s.plan, s.period, s.start === 'after_current' ? rec : null, { addons: s.addons, months: s.months, discounts: s.discounts })
    const listPrice = r2(c.lines.filter((l) => l.kind !== 'discount').reduce((n, l) => n + l.amount, 0))
    return reply(200, {
      charge: c, listPrice, discountTotal: r2(listPrice - c.base), from: s.from, end: s.end, period: s.period, months: s.months ?? null, cycles: s.cycles,
      autopayRunning: autopayRunning(rec), hasProfile: Boolean(rec.profile),
    })
  }

  /* ── plan changes by staff ───────────────────────────────────────────────
     A subscription (see parseSubscription) paid free or offline, with optional discounts and the
     client's billing details saved in the same step. Custom terms never renew automatically. */
  async function changePlan(req: BillingRequest, me: Staff): Promise<BillingResponse> {
    const b = body(req)
    const ws = typeof b.workspaceId === 'string' ? b.workspaceId.trim() : ''
    if (!WS_RE.test(ws)) return err(400, 'invalid_workspace', 'Workspace id: 1–64 letters, digits or . _ - @')
    const profile = b.profile == null ? null : validateProfile(b.profile as Parameters<typeof validateProfile>[0], now())
    if (profile && !profile.ok) return reply(422, { error: 'invalid_profile', message: 'Some client details need fixing.', fields: profile.fields })
    const pay = paymentIn(b.payment)
    if (!pay.ok) return pay.res
    const note = typeof b.note === 'string' ? b.note.trim().slice(0, 500) : ''
    const t = now()
    const rec = (await store.get(ws)) ?? ctx.blank(ws)
    const s = parseSubscription(b, rec)
    if (!s.ok) return s.res
    const { plan, period, months, start, from, end, discounts } = s
    const sel = { addons: s.addons }

    if (start === 'renewal') {
      if (months) return err(400, 'invalid_months', "A custom term can't renew automatically. Start it now instead.")
      if (discounts.length) return err(400, 'invalid_discount', 'Discounts apply to subscriptions staff bill now, not to automatic renewals.')
      if (rec.engine !== 'token' || !rec.mandate || !rec.renewal) return err(409, 'no_card_autopay', 'Only customers on card autopay have a renewal to change.')
      if (rec.renewal.orderId) return err(409, 'notice_sent', 'Their renewal notice has already gone out. Change it after it renews, or start the new plan now.')
      if (ctx.chargeOf(plan, period, rec, { addons: sel.addons }).total > AFA_LIMIT_RUPEES) return err(409, 'autopay_limit', `That renewal would be above the ₹${AFA_LIMIT_RUPEES.toLocaleString('en-IN')} card-autopay limit.`)
      rec.renewal = { ...rec.renewal, plan, period, addons: sel.addons }
      rec.scheduledChange = plan === rec.plan && period === rec.period ? null : { plan, period, at: rec.renewal.dueAt, addons: sel.addons }
      rec.updatedAt = t
      await store.put(rec)
      await audit(me, 'Changed plan at renewal', ws, `${planName(plan)} ${period}${note ? ` — ${note}` : ''}`)
      return reply(200, row(rec))
    }

    if (autopayRunning(rec) && b.stopAutopay !== true) {
      return err(409, 'autopay_running', 'This customer is on autopay. Confirm that their autopay should stop — otherwise they would be charged for this period as well.')
    }
    if (pay.p.type === 'offline' && !(profile?.ok ? profile.profile : rec.profile)) return err(409, 'billing_details_required', 'Add their billing details first — every payment gets a GST invoice.')
    if (profile?.ok) rec.profile = profile.profile

    const extend = start === 'after_current'
    // Priced like a sale: list prices for a new plan; their own (locked) prices when it continues.
    const c = ctx.chargeOf(plan, period, extend ? rec : null, { addons: sel.addons, months, discounts })
    if (autopayRunning(rec)) await ctx.stopAutopay(rec)
    const paid = pay.p.type === 'offline' ? ctx.paidValue(linesFor(c, pay.p)) : 0
    ctx.startPeriod(rec, {
      plan, period, months: months ?? null, addons: sel.addons, start: extend ? rec.currentStart! : from, end,
      paid: (extend ? rec.periodPaid ?? 0 : 0) + paid, relock: !extend,
    })
    rec.mode = 'once'; rec.engine = undefined; rec.subscriptionId = undefined; rec.nextChargeAt = null; rec.renewal = null
    rec.source = 'staff'
    if (pay.p.type === 'offline') {
      await ctx.recordPayment(rec, {
        paymentId: offlineId(), plan, period, amountPaise: pay.p.amountPaise, addons: sel.addons, method: pay.p.method, at: pay.p.at,
        periodStart: from, periodEnd: end, kind: extend ? 'renewal' : 'purchase', lines: linesFor(c, pay.p), months,
        offline: { method: pay.p.method, reference: pay.p.reference, by: me.email },
      })
    }
    rec.grants = [{ at: t, plan, period, addons: sel.addons, until: end, note: [pay.p.type === 'offline' ? `Paid offline ₹${(pay.p.amountPaise / 100).toLocaleString('en-IN')} (${pay.p.method}${pay.p.reference ? ` ${pay.p.reference}` : ''})` : 'Free', note].filter(Boolean).join(' — '), by: me.email }, ...(rec.grants ?? [])]
    rec.updatedAt = t
    await store.put(rec)
    const off = r2(-c.lines.filter((l) => l.kind === 'discount').reduce((n, l) => n + l.amount, 0))
    await audit(me, extend ? 'Renewed plan' : 'Changed plan', ws, `${planName(plan)} ${months ? `${months} months` : period}${off ? ` · ₹${off.toLocaleString('en-IN')} discount` : ''} until ${new Date(end * 1000).toISOString().slice(0, 10)} · ${pay.p.type}${note ? ` — ${note}` : ''}`)
    return reply(200, row(rec))
  }

  /* Add-ons given by staff: one-time (30 days, until the plan ends, or until a date — never past the
     plan's end) or recurring (part of the plan; on card autopay, charged from the next renewal). */
  async function addAddons(req: BillingRequest, me: Staff): Promise<BillingResponse> {
    const b = body(req)
    const rec = await getRec(b.workspaceId)
    if (!rec || !ctx.isLive(rec) || !rec.plan || !rec.period || !rec.currentEnd) return err(409, 'plan_not_active', 'Add-ons need a live plan.')
    const sel = normalizeAddons(b.addons, rec.plan, true)
    if (!sel.ok) return err(400, 'invalid_addons', sel.message)
    if (!sel.addons.length) return err(400, 'no_addons', 'Choose at least one add-on.')
    const how = b.how === 'recurring' || b.how === 'month' || b.how === 'until' ? b.how : 'plan'
    const pay = paymentIn(b.payment)
    if (!pay.ok) return pay.res
    if (pay.p.type === 'offline' && !rec.profile) return err(409, 'billing_details_required', 'Add their billing details first — every payment gets a GST invoice.')
    const t = now()
    const live = rec as BillingRecord & { plan: PlanId; period: Period; currentEnd: number }
    let until = how === 'month' ? Math.min(t + 30 * DAY, rec.currentEnd) : rec.currentEnd
    if (how === 'until') {
      const u = Number(b.until)
      if (!Number.isInteger(u) || u <= t) return err(400, 'invalid_until', 'Pick an end date in the future.')
      until = Math.min(u, rec.currentEnd)
    }
    if (how === 'recurring') {
      if (rec.renewal?.orderId) return err(409, 'notice_sent', 'Their renewal notice has already gone out. Add it after the renewal, or as one-time.')
      rec.addons = mergeAddons(rec.addons, sel.addons)
      if (rec.renewal) {
        rec.renewal = { ...rec.renewal, addons: mergeAddons(rec.renewal.addons, sel.addons) }
        if (ctx.chargeOf(rec.renewal.plan, rec.renewal.period, rec, { addons: rec.renewal.addons }).total > AFA_LIMIT_RUPEES) return err(409, 'autopay_limit', `Their renewal would go above the ₹${AFA_LIMIT_RUPEES.toLocaleString('en-IN')} card-autopay limit. Add them as one-time instead.`)
      }
    } else {
      rec.extraAddons = [...(rec.extraAddons ?? []), ...sel.addons.map((a) => ({ id: a.id, qty: a.qty, at: t, until, paymentId: '', ...(how === 'month' ? { term: 'monthly' as Period } : {}) }))]
    }
    if (pay.p.type === 'offline') {
      const { c } = ctx.addonPrice(live, sel.addons, how === 'recurring' ? 'recurring' : how === 'month' ? 'month' : 'plan')
      await ctx.recordPayment(rec, {
        paymentId: offlineId(), plan: rec.plan, period: rec.period, amountPaise: pay.p.amountPaise, addons: sel.addons, addonsOnly: true, method: pay.p.method, at: pay.p.at,
        periodStart: t, periodEnd: until, kind: 'addon', lines: linesFor(c, pay.p), offline: { method: pay.p.method, reference: pay.p.reference, by: me.email },
      })
    }
    rec.updatedAt = t
    await store.put(rec)
    await audit(me, how === 'recurring' ? 'Added recurring add-ons' : 'Added one-time add-ons', rec.workspaceId,
      `${sel.addons.map((a) => `${addonDef(a.id)?.name ?? a.id} ×${a.qty}`).join(', ')} · ${pay.p.type}`)
    return reply(200, row(rec))
  }

  async function removeAddon(req: BillingRequest, me: Staff): Promise<BillingResponse> {
    const b = body(req)
    const rec = await getRec(b.workspaceId)
    const id = String(b.id ?? '')
    if (!rec) return err(404, 'not_found', 'No such customer.')
    const now_ = b.when === 'now'
    if (b.kind === 'one_time') {
      rec.extraAddons = (rec.extraAddons ?? []).map((e) => (e.id === id && e.until > now() ? { ...e, until: now() } : e))
    } else {
      if (!rec.addons?.some((a) => a.id === id)) return err(404, 'not_found', 'That add-on is not on their plan.')
      if (rec.renewal?.orderId) return err(409, 'notice_sent', 'Their renewal notice has already gone out. Remove it after the renewal.')
      if (rec.renewal) rec.renewal = { ...rec.renewal, addons: (rec.renewal.addons ?? []).filter((a) => a.id !== id) }
      if (now_) rec.addons = rec.addons.filter((a) => a.id !== id)
    }
    rec.updatedAt = now()
    await store.put(rec)
    await audit(me, 'Removed add-on', rec.workspaceId, `${addonDef(id)?.name ?? id}${now_ ? ' (now)' : ' (from next renewal)'}`)
    return reply(200, row(rec))
  }

  /* Goodwill: more days on the current period, free. Card autopay moves its next renewal with it. */
  async function extend(req: BillingRequest, me: Staff): Promise<BillingResponse> {
    const b = body(req)
    const rec = await getRec(b.workspaceId)
    if (!rec || !rec.plan || !rec.currentEnd) return err(404, 'not_found', 'They have no plan to extend.')
    const until = Number(b.until)
    if (!Number.isInteger(until) || until <= rec.currentEnd || until > rec.currentEnd + 2 * 366 * DAY) return err(400, 'invalid_until', 'Pick a date after the current end date (up to 2 years later).')
    if (rec.mode === 'autopay' && rec.subscriptionId && !rec.cancelAtCycleEnd) return err(409, 'subscription_autopay', 'Their autopay is run by Razorpay on a fixed schedule; it can\'t be moved. Stop autopay first or give a free plan period instead.')
    if (rec.renewal?.orderId) return err(409, 'notice_sent', 'Their renewal notice has already gone out. Extend after it renews.')
    const from = rec.currentEnd
    rec.currentEnd = until
    if (rec.status !== 'active' && !ctx.terminal.has(rec.status)) rec.status = 'active'
    if (ctx.terminal.has(rec.status) || rec.status === 'none') { rec.status = 'active'; rec.cancelledAt = null }
    if (rec.renewal) { rec.renewal = { ...rec.renewal, dueAt: until }; rec.nextChargeAt = until }
    if (rec.cancelAt) rec.cancelAt = until
    const note = typeof b.note === 'string' ? b.note.trim().slice(0, 500) : ''
    rec.grants = [{ at: now(), plan: rec.plan, period: rec.period ?? 'monthly', addons: rec.addons ?? [], until, note: ['Extended free', note].filter(Boolean).join(' — '), by: me.email }, ...(rec.grants ?? [])]
    rec.updatedAt = now()
    await store.put(rec)
    await audit(me, 'Extended plan', rec.workspaceId, `${new Date(from * 1000).toISOString().slice(0, 10)} → ${new Date(until * 1000).toISOString().slice(0, 10)}${note ? ` — ${note}` : ''}`)
    return reply(200, row(rec))
  }

  async function cancel(req: BillingRequest, me: Staff): Promise<BillingResponse> {
    const b = body(req)
    const rec = await getRec(b.workspaceId)
    if (b.when !== 'now' && b.when !== 'period_end') return err(400, 'invalid_request', 'Choose to cancel now or at the end of the period.')
    if (!rec || !ctx.isLive(rec)) return err(409, 'no_plan', 'They have no running plan to cancel.')
    await ctx.cancelPlan(rec, b.when)
    await store.put(rec)
    await audit(me, b.when === 'now' ? 'Cancelled plan now' : 'Cancelled plan at period end', rec.workspaceId, typeof b.reason === 'string' ? b.reason.slice(0, 300) : undefined)
    return reply(200, row(rec))
  }

  /* ── downgrade impact ────────────────────────────────────────────────────
     Built from what the account actually uses (features and counts its services report, usage this
     period) — not just the plans' difference. "Unknown" means nothing has reported it yet. */
  async function impact(req: BillingRequest): Promise<BillingResponse> {
    const b = body(req)
    const rec = await getRec(b.workspaceId)
    const { plan } = b
    if (!rec || !rec.plan || !rec.period) return err(409, 'no_plan', 'They have no plan to compare with.')
    if (!isPlanId(plan)) return err(400, 'invalid_plan', 'Choose a plan.')
    const months = b.months ? Number(b.months) : undefined
    const period: Period = months ? 'monthly' : isPeriod(b.period) ? b.period : rec.period
    const cur = PLAN_CATALOG[rec.plan]!, next = PLAN_CATALOG[plan]!
    const usage = await ctx.usageOf(rec)
    const extras = (rec.extraAddons ?? []).filter((e) => e.until > now())
    const curAddons = mergeAddons(rec.addons, extras.map((e) => ({ id: e.id, qty: e.qty })))
    const keptAddons = eligibleAddons(rec.addons, plan)
    const droppedAddons = (rec.addons ?? []).filter((a) => !keptAddons.some((k) => k.id === a.id))
    const unlocked = (addons: AddonSel[]) => new Set(addons.flatMap((a) => addonDef(a.id)?.unlocks ?? []))
    const curUnlocked = unlocked(curAddons), nextUnlocked = unlocked(mergeAddons(keptAddons, extras.filter((e) => addonDef(e.id)?.plans.includes(plan)).map((e) => ({ id: e.id, qty: e.qty }))))
    const has = (p: typeof cur, key: string, un: Set<string>) => {
      const v = p.features[key]
      return v === true || (typeof v === 'string' && v !== 'addon' && v !== '') || (v === 'addon' && un.has(key))
    }
    const lost: { key: string; label: string; group: string; inUse: boolean | null; addon: { id: string; name: string } | null }[] = []
    const kept: string[] = []
    for (const f of FEATURES) {
      const a = has(cur, f.key, curUnlocked), n = has(next, f.key, nextUnlocked)
      if (!a) continue
      if (n) { kept.push(f.label); continue }
      const unlocker = next.features[f.key] === 'addon' ? ADDON_CATALOG.find((x) => x.status === 'active' && x.plans.includes(plan) && x.unlocks?.includes(f.key)) : undefined
      lost.push({ key: f.key, label: f.label, group: f.group, inUse: usage.features?.[f.key] ?? null, addon: unlocker ? { id: unlocker.id, name: unlocker.name } : null })
    }
    const sim = { ...rec, plan, period, termMonths: months ?? null, addons: keptAddons } as BillingRecord
    const nextAllow = ctx.allowancesOf(sim), curAllow = ctx.allowancesOf(rec)
    const limits = Object.keys({ ...curAllow, ...nextAllow }).map((m) => {
      const used = usage.items.find((i) => i.metric === m)?.used ?? null
      const nl = m in nextAllow ? nextAllow[m]! : 0
      return { metric: m, label: METRICS[m]?.label ?? m, kind: METRICS[m]?.kind ?? 'count', current: m in curAllow ? curAllow[m]! : 0, next: nl, used, over: nl !== null && used != null && used > nl }
    }).filter((l) => l.current !== l.next || l.over)
    const curValue = ctx.chargeOf(rec.plan, rec.period, rec, { addons: rec.addons, months: rec.termMonths ?? undefined })
    const nextValue = ctx.chargeOf(plan, period, null, { addons: keptAddons, months })
    const actions: string[] = []
    for (const l of lost) {
      if (l.inUse === true) actions.push(`${l.label} is in use and will stop working${l.addon ? ` — keep it with the "${l.addon.name}" add-on` : ''}.`)
      else if (l.inUse === null) actions.push(`Check whether they use ${l.label} (not reported) — it is not in ${next.name}${l.addon ? ` without the "${l.addon.name}" add-on` : ''}.`)
    }
    for (const l of limits) if (l.over) actions.push(`${l.label}: ${l.used?.toLocaleString('en-IN')} used this period, above ${next.name}'s ${l.next?.toLocaleString('en-IN')} — reduce it or add capacity.`)
    if (droppedAddons.length) actions.push(`These add-ons don't exist on ${next.name} and will be removed: ${droppedAddons.map((a) => addonDef(a.id)?.name ?? a.id).join(', ')}.`)
    if (autopayRunning(rec)) actions.push('Their autopay will be stopped. The new plan is not charged automatically — they can turn autopay on again from their dashboard.')
    return reply(200, {
      kind: ctx.changeKind(rec, plan, period),
      from: { plan: rec.plan, name: cur.name, period: rec.period, months: rec.termMonths ?? null, value: curValue.base },
      to: { plan, name: next.name, period, months: months ?? null, value: nextValue.base },
      lost, kept, limits,
      addons: { kept: addonLines(keptAddons, period), dropped: addonLines(droppedAddons, rec.period) },
      usageReported: usage.reported,
      safe: !lost.some((l) => l.inUse !== false) && !limits.some((l) => l.over),
      actions,
    })
  }

  /* ── the price list ──────────────────────────────────────────────────── */
  async function getCatalog(): Promise<BillingResponse> {
    await ctx.loadCatalog(true)
    const recs = await store.list()
    const onPlan: Record<string, number> = {}, onAddon: Record<string, number> = {}
    for (const r of recs) {
      if (!ctx.isLive(r) || !r.plan) continue
      onPlan[r.plan] = (onPlan[r.plan] ?? 0) + 1
      for (const a of r.addons ?? []) onAddon[a.id] = (onAddon[a.id] ?? 0) + 1
    }
    return reply(200, { catalog: currentCatalog(), metrics: METRICS, customersOnPlan: onPlan, customersOnAddon: onAddon })
  }

  async function putCatalog(req: BillingRequest, me: Staff): Promise<BillingResponse> {
    await ctx.loadCatalog(true)
    const prev = currentCatalog()
    const v = validateCatalog(body(req).catalog, prev)
    if (!v.ok) return err(400, 'invalid_catalog', v.message)
    const next: Catalog = { ...v.catalog, version: (prev.version ?? 1) + 1, updatedAt: now(), updatedBy: me.email }
    await store.putDoc('catalog', next)
    await ctx.loadCatalog(true)
    // What changed, in words, for the activity log.
    const changes: string[] = []
    for (const p of next.plans) {
      const o = prev.plans.find((x) => x.id === p.id)
      if (!o) changes.push(`new plan ${p.name}`)
      else {
        if (o.monthly !== p.monthly || o.yearly !== p.yearly) changes.push(`${p.name} ₹${o.monthly}/₹${o.yearly} → ₹${p.monthly}/₹${p.yearly}`)
        if (o.status !== p.status) changes.push(`${p.name} ${p.status}`)
        if (o.visibility !== p.visibility) changes.push(`${p.name} ${p.visibility}`)
      }
    }
    for (const a of next.addons) {
      const o = prev.addons.find((x) => x.id === a.id)
      if (!o) changes.push(`new add-on ${a.name}`)
      else if (o.monthly !== a.monthly || o.yearly !== a.yearly) changes.push(`${a.name} ₹${o.monthly}/₹${o.yearly} → ₹${a.monthly}/₹${a.yearly}`)
      else if (o.status !== a.status) changes.push(`${a.name} ${a.status}`)
    }
    await audit(me, 'Updated price list', `v${next.version}`, changes.join('; ').slice(0, 600) || 'details')
    return reply(200, { catalog: next })
  }

  /* ── usage across clients ─────────────────────────────────────────────── */
  async function usageOverview(): Promise<BillingResponse> {
    const recs = (await store.list()).filter((r) => ctx.isLive(r))
    const items = await Promise.all(recs.map(async (r) => {
      const u = await ctx.usageOf(r)
      const counted = u.items.filter((i) => i.used != null && i.limit)
      const top = counted.reduce<UsageItem | null>((m, i) => (!m || (i.pct ?? 0) > (m.pct ?? 0) ? i : m), null)
      return {
        workspaceId: r.workspaceId, customer: r.profile?.legalName ?? null, planName: planName(r.plan), period: r.period, termMonths: r.termMonths ?? null,
        currentStart: r.currentStart ?? null, currentEnd: r.currentEnd ?? null, whatsappNumbers: (r.whatsappNumbers ?? []).length,
        reported: u.reported, lastReportAt: u.lastReportAt, items: u.items, topPct: top?.pct ?? null, topLabel: top?.label ?? null,
      }
    }))
    return reply(200, { items })
  }

  /* ── analytics ───────────────────────────────────────────────────────────
     Everything is worked out from the billing records: revenue = payments received (incl. GST, and
     before GST); MRR = what live paying clients are worth per month at their prices (yearly ÷ 12,
     a custom term ÷ its months; free plans count 0). Months are calendar months in IST. */
  async function analytics(): Promise<BillingResponse> {
    const recs = await store.list()
    const t = now()
    const IST = 5.5 * 3600
    const monthOf = (s: number) => new Date((s + IST) * 1000).toISOString().slice(0, 7)
    const months: string[] = []
    {
      const d = new Date((t + IST) * 1000)
      for (let i = 11; i >= 0; i--) months.push(new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() - i, 1)).toISOString().slice(0, 7))
    }
    const series = Object.fromEntries(months.map((m) => [m, { month: m, gross: 0, net: 0, payments: 0, newClients: 0, churned: 0, offline: 0 }]))
    const live = recs.filter((r) => ctx.isLive(r))
    const paying = live.filter((r) => r.periodPaid !== 0)
    let mrr = 0
    const byPlan: Record<string, { plan: string; name: string; clients: number; mrr: number }> = {}
    const byType: Record<string, { type: string; clients: number; mrr: number }> = {}
    const byPeriod: Record<string, number> = { monthly: 0, yearly: 0, custom: 0 }
    let autopayClients = 0, freeClients = 0
    for (const r of live) {
      const v = monthlyValue(r)
      mrr += v
      const p = (byPlan[r.plan!] ??= { plan: r.plan!, name: planName(r.plan), clients: 0, mrr: 0 })
      p.clients++; p.mrr += v
      const ct = customerTypeOf(r.customerType)
      const ty = (byType[ct] ??= { type: ct, clients: 0, mrr: 0 })
      ty.clients++; ty.mrr += v
      const pk = r.termMonths ? 'custom' : r.period!
      byPeriod[pk] = (byPeriod[pk] ?? 0) + 1
      if (autopayRunning(r)) autopayClients++
      if (r.periodPaid === 0) freeClients++
    }
    let collected = 0, collectedThisMonth = 0, couponDiscount = 0, couponUses = 0
    const thisMonth = monthOf(t)
    for (const r of recs) {
      const paid = r.payments.filter((x) => x.status === 'paid')
      for (const x of paid) {
        const amt = x.amountPaise / 100
        collected += amt
        if (monthOf(x.at) === thisMonth) collectedThisMonth += amt
        const s = series[monthOf(x.at)]
        if (s) { s.gross += amt; s.net += amt / (1 + gstPercent / 100); s.payments++; if (x.offline) s.offline += amt }
      }
      for (const inv of r.invoices ?? []) if (inv.discount) { couponDiscount += inv.discount.amount; couponUses++ }
      // A client is new in the month they first had a plan (paid or given).
      const firsts = [...paid.map((x) => x.at), ...(r.grants ?? []).map((g) => g.at)]
      if (firsts.length) { const s = series[monthOf(Math.min(...firsts))]; if (s) s.newClients++ }
      // …and churned in the month their plan ended without being renewed.
      if (!ctx.isLive(r) && r.plan && r.currentEnd && ['expired', 'cancelled', 'suspended', 'completed'].includes(statusOf(r))) {
        const s = series[monthOf(r.cancelledAt ?? r.currentEnd)]; if (s) s.churned++
      }
    }
    // Renewals over the next 12 weeks, by week.
    const weeks = Array.from({ length: 12 }, (_, i) => ({ week: i, from: t + i * 7 * DAY, autopay: 0, manual: 0, count: 0 }))
    let dueNext30 = 0, dueNext30Value = 0
    for (const r of recs) {
      const rn = renewalOf(r)
      if (!rn || rn.at < t) continue
      const i = Math.floor((rn.at - t) / (7 * DAY))
      if (weeks[i]) { weeks[i]![rn.type] += rn.total; weeks[i]!.count++ }
      if (rn.at - t <= 30 * DAY) { dueNext30++; dueNext30Value += rn.total }
    }
    const pastDue = recs.filter((r) => r.dunning?.state === 'active')
    const overdueManual = recs.filter((r) => { const rn = renewalOf(r); return rn && rn.type === 'manual' && rn.at < t && rn.at > t - 30 * DAY })
    const top = recs.map((r) => ({ workspaceId: r.workspaceId, customer: r.profile?.legalName ?? r.workspaceId, planName: planName(r.plan), paid: r.payments.filter((x) => x.status === 'paid').reduce((n, x) => n + x.amountPaise, 0) / 100 }))
      .filter((x) => x.paid > 0).sort((a, b) => b.paid - a.paid).slice(0, 8)
    const usageRows = await store.usage(`${thisMonth}-01`)
    const usageThisMonth: Record<string, number> = {}
    for (const u of usageRows) usageThisMonth[u.metric] = (usageThisMonth[u.metric] ?? 0) + u.value
    const last = series[months[months.length - 1]!]!, prev = series[months[months.length - 2]!]!
    return reply(200, {
      generatedAt: t,
      kpis: {
        mrr: r2(mrr), arr: r2(mrr * 12), arpa: paying.length ? r2(mrr / paying.length) : 0,
        liveClients: live.length, payingClients: paying.length, freeClients, autopayClients, totalClients: recs.length,
        collected: r2(collected), collectedThisMonth: r2(collectedThisMonth), collectedLastMonth: r2(prev.gross),
        newThisMonth: last.newClients, churnedThisMonth: last.churned,
        dueNext30, dueNext30Value: r2(dueNext30Value),
        pastDue: pastDue.length, pastDueValue: r2(pastDue.reduce((n, r) => n + (r.dunning?.amountPaise ?? 0), 0) / 100),
        overdueManual: overdueManual.length,
        couponUses, couponDiscount: r2(couponDiscount),
      },
      monthly: months.map((m) => ({ ...series[m]!, gross: r2(series[m]!.gross), net: r2(series[m]!.net), offline: r2(series[m]!.offline) })),
      byPlan: Object.values(byPlan).map((p) => ({ ...p, mrr: r2(p.mrr) })).sort((a, b) => b.mrr - a.mrr),
      byType: Object.values(byType).map((p) => ({ ...p, mrr: r2(p.mrr) })),
      byPeriod,
      renewalsByWeek: weeks.map((w) => ({ ...w, autopay: r2(w.autopay), manual: r2(w.manual) })),
      topClients: top,
      usageThisMonth,
      metrics: METRICS,
    })
  }

  /* ── router ────────────────────────────────────────────────────────────── */
  const decode = (s: string) => { try { return decodeURIComponent(s) } catch { return '' } }

  async function handle(req: BillingRequest, path: string, route: string): Promise<BillingResponse> {
    if (!owner) return err(503, 'admin_not_configured', 'Set BILLING_ADMIN_EMAIL and BILLING_ADMIN_PASSWORD on the server to use the admin console.')
    if (route === 'POST /admin/login') return await login(req)
    const me = await currentStaff(req)
    if (!me) return err(401, 'unauthorized', 'Please sign in again.')
    const get = req.method.toUpperCase() === 'GET'
    const inv = path.match(/^\/admin\/customers\/([^/]{1,200})\/invoices\/([A-Za-z0-9_-]+)$/)
    const one = path.match(/^\/admin\/customers\/([^/]{1,200})$/)
    // Anyone signed in: reading, notes, and opening a customer's dashboard (logged).
    switch (route) {
      case 'GET /admin/me':        return reply(200, me)
      case 'GET /admin/customers': return reply(200, { items: (await store.list()).map(row) })
      case 'GET /admin/coupons':   return reply(200, { items: await coupons() })
      case 'GET /admin/catalog':   return await getCatalog()
      case 'GET /admin/usage':     return await usageOverview()
      case 'GET /admin/analytics': return await analytics()
      case 'GET /admin/activity':  return reply(200, { items: ((await store.getDoc<AuditEntry[]>('audit')) ?? []).slice(0, 500) })
      case 'POST /admin/notes':    return await addNote(req, me)
      case 'POST /admin/impact':   return await impact(req)
      case 'POST /admin/quote':    return await quote(req)
      case 'POST /admin/impersonate': {
        const rec = await getRec(body(req).workspaceId)
        if (!rec) return err(404, 'not_found', 'No such customer.')
        await audit(me, 'Opened customer dashboard', rec.workspaceId)
        // The dashboard is a separate app: it swaps this ticket for the customer at /impersonate/redeem.
        return reply(200, { ticket: signSession(sessionKey, `${TICKET}${rec.workspaceId}|${me.email}`, now(), TICKET_TTL) })
      }
    }
    if (get && inv) return await invoice(decode(inv[1]!), inv[2]!)
    if (get && one) return await customer(decode(one[1]!))
    // Everything below moves money or changes who has access.
    if (me.role === 'support') return err(403, 'forbidden', 'Only admins can do that.')
    switch (route) {
      case 'POST /admin/plan':             return await changePlan(req, me)
      case 'POST /admin/assign':           return await changePlan(req, me)      // the first console's name for it
      case 'POST /admin/addons':           return await addAddons(req, me)
      case 'POST /admin/addons/remove':    return await removeAddon(req, me)
      case 'POST /admin/extend':           return await extend(req, me)
      case 'POST /admin/cancel':           return await cancel(req, me)
      case 'POST /admin/customers/type':   return await setCustomerType(req, me)
      case 'POST /admin/customers/profile': return await setProfile(req, me)
      case 'POST /admin/customers/numbers': return await setNumbers(req, me)
      case 'PUT /admin/catalog':           return await putCatalog(req, me)
      case 'POST /admin/coupons':          return await createCoupon(req, me)
      case 'POST /admin/coupons/update':   return await updateCoupon(req, me)
      case 'GET /admin/staff':             return reply(200, { owner: { email: owner.email }, items: (await staffList()).map(staffView) })
      case 'POST /admin/staff':            return await createStaff(req, me)
      case 'POST /admin/staff/update':     return await updateStaff(req, me)
      default:                             return err(404, 'not_found')
    }
  }

  /* The customer dashboard swaps a "log in as customer" ticket for who to show. Only tickets
     (prefixed, 2 minutes) are accepted — never a staff session token.
     shortcut: a ticket can be reused within its 2 minutes; keep a used-ticket list if that matters. */
  async function redeemTicket(req: BillingRequest): Promise<BillingResponse> {
    const v = owner ? readSession(sessionKey, String(body(req).ticket ?? ''), now()) : null
    if (!v?.startsWith(TICKET)) return err(401, 'invalid_ticket', 'This link has expired. Open the customer again from the admin panel.')
    const [ws, ...by] = v.slice(TICKET.length).split('|')
    const rec = await getRec(ws)
    if (!rec) return err(404, 'not_found', 'No such customer.')
    const p = rec.profile
    return reply(200, {
      workspaceId: rec.workspaceId, by: by.join('|'),
      name: p?.contactName ?? p?.legalName ?? rec.workspaceId, email: p?.email ?? '', phone: p?.phone ?? '',
      company: p?.legalName ?? rec.workspaceId, planName: rec.plan ? planName(rec.plan) : null,
      city: p?.address.city ?? null, stateCode: p?.address.stateCode ?? null,
    })
  }

  return { handle, redeemTicket }
}
