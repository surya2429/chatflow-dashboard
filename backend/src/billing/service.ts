// service.ts — billing rules, independent of any web framework.
//
// Two ways to pay, both through Razorpay Checkout:
//   once     a single payment (Orders API) that buys one billing period. No
//            recurring debit; the plan simply ends when the period does.
//   autopay  a Razorpay Subscription: the customer authorises once, Razorpay
//            debits every cycle. Needs Subscriptions enabled on the account.
//
// On top of that:
//   • every successful payment automatically gets a numbered GST tax invoice
//   • a failed autopay renewal enters dunning (see dunning.ts): up to 4 attempts in
//     9 days, 48–72 hours apart, plan stays active meanwhile, suspended after
//
// Rules that matter and are easy to get wrong:
//   • Amounts are decided HERE from the catalog. The browser sends only a plan id
//     and a period.
//   • A checkout is trusted only after its signature verifies against the order /
//     subscription id THIS server created — never the one the browser echoes back.
//   • Renewals above ₹15,000 need the customer to approve each debit (RBI), so
//     they are "automatic" only in the sense that Razorpay starts them.
//   • Razorpay can only change a plan on card-authorised subscriptions.
//   • Payments are idempotent by Razorpay payment id: a webhook, a poll and a
//     dashboard refresh can all report the same payment and it is recorded once.
import {
  AFA_LIMIT_RUPEES, PLAN_CATALOG, PLAN_ORDER, addPeriod, chargeFor, isPeriod, isPlanId,
  needsApprovalEachCycle, planKey, totalCount, type Period, type PlanId,
} from './catalog.js'
import { RazorpayError, verifyWebhookSignature, type Razorpay, type RzEntity } from './razorpay.js'
import { STATES, stateName, validateProfile } from './india.js'
import { DUNNING_POLICY, assertPolicy, attemptTimes, deadlineFor, type DunningPolicy } from './dunning.js'
import { buildInvoice, financialYear, invoiceNumber, renderInvoiceHtml, type SellerInfo } from './invoice.js'
import type {
  BillingRecord, BillingRequest, BillingResponse, BillingStore, Dunning, Invoice, PaymentMethod,
} from './types.js'

export interface BillingServiceOptions {
  store: BillingStore
  razorpay?: Razorpay
  keyId?: string
  webhookSecret?: string
  gstPercent: number
  /** GST code of the state we are registered in — decides CGST+SGST vs IGST. */
  supplierStateCode?: string
  /** Who issues the invoices. Defaults are placeholders — set them before real use. */
  seller?: Partial<SellerInfo>
  dunning?: DunningPolicy
  /** unix seconds; injectable for tests */
  now?: () => number
}

const TERMINAL = new Set(['cancelled', 'completed', 'expired', 'suspended'])
const reply = (status: number, body: unknown): BillingResponse => ({ status, body })
const err = (status: number, error: string, message?: string): BillingResponse => reply(status, { error, message })

export function createBillingService(opts: BillingServiceOptions) {
  const { store, razorpay: rz, keyId, webhookSecret, gstPercent } = opts
  const now = opts.now ?? (() => Math.floor(Date.now() / 1000))
  const supplier = opts.supplierStateCode ?? '27'
  const policy = opts.dunning ?? DUNNING_POLICY
  assertPolicy(policy)
  const CONSENT_VERSION = 'recurring-v1'
  const seller: SellerInfo = {
    name: 'SmatBot', address: 'Registered address — set BILLING_SELLER_ADDRESS', stateCode: supplier, sac: '998314', prefix: 'SB',
    ...opts.seller,
  }

  /* The charge for a plan, with GST labelled for the customer's state when known.
     The TOTAL is the same either way; only CGST/SGST vs IGST changes. */
  const chargeOf = (plan: PlanId, period: Period, rec?: BillingRecord | null) =>
    chargeFor(plan, period, gstPercent, { supplier, customer: rec?.profile?.address.stateCode })

  /* What goes on the Razorpay order / subscription as notes (visible in their dashboard). */
  const notesFor = (rec: BillingRecord, plan: PlanId, period: Period) => ({
    workspaceId: rec.workspaceId, plan, period,
    ...(rec.profile ? {
      billedTo: rec.profile.legalName.slice(0, 100),
      gstin: rec.profile.gstin ?? 'unregistered',
      placeOfSupply: `${rec.profile.address.stateCode} ${stateName(rec.profile.address.stateCode)}`,
    } : {}),
  })

  /* Razorpay Plan ids, looked up (or created once) by the key stored in notes. */
  const planIdCache = new Map<string, string>()
  const keyByPlanId = new Map<string, { plan: PlanId; period: Period }>()

  async function ensureRazorpayPlan(plan: PlanId, period: Period): Promise<string> {
    const c = chargeFor(plan, period, gstPercent)
    const key = planKey(plan, period)
    const cacheKey = `${key}:${c.totalPaise}`
    const cached = planIdCache.get(cacheKey)
    if (cached) return cached

    const list = await rz!.request<RzEntity>('GET', '/plans?count=100')
    const found = (list.items ?? []).find(
      (p: RzEntity) => p.notes?.key === key && p.item?.amount === c.totalPaise && p.period === period,
    )
    if (found) {
      planIdCache.set(cacheKey, found.id)
      keyByPlanId.set(found.id, { plan, period })
      return found.id
    }
    const created = await rz!.request<RzEntity>('POST', '/plans', {
      period,
      interval: 1,
      item: {
        name: `SmatBot ${PLAN_CATALOG[plan].name} (${period === 'monthly' ? 'Monthly' : 'Yearly'})`,
        description: `Includes ${gstPercent}% GST`,
        amount: c.totalPaise,
        currency: 'INR',
      },
      notes: { key },
    })
    planIdCache.set(cacheKey, created.id)
    keyByPlanId.set(created.id, { plan, period })
    return created.id
  }

  async function planFromRazorpayPlanId(planId: string): Promise<{ plan: PlanId; period: Period } | null> {
    const hit = keyByPlanId.get(planId)
    if (hit) return hit
    try {
      const p = await rz!.request<RzEntity>('GET', `/plans/${planId}`)
      const [plan, period] = String(p.notes?.key ?? '').split('_')
      if (isPlanId(plan) && isPeriod(period)) {
        keyByPlanId.set(planId, { plan, period })
        return { plan, period }
      }
    } catch { /* fall through */ }
    return null
  }

  const methodOf = (p: RzEntity | null | undefined): PaymentMethod | null => !p ? null : ({
    type: p.method ?? 'unknown',
    last4: p.card?.last4,
    network: p.card?.network,
    vpa: p.vpa,
    bank: p.bank,
  })

  const blank = (workspaceId: string): BillingRecord => ({
    workspaceId, plan: null, period: null, mode: null, status: 'none',
    cancelAtCycleEnd: false, payments: [], updatedAt: now(),
  })

  /* Copy a Razorpay subscription entity onto our record. */
  async function applySubscription(rec: BillingRecord, sub: RzEntity): Promise<void> {
    rec.mode = 'autopay'
    rec.subscriptionId = sub.id
    rec.status = sub.status
    rec.currentStart = sub.current_start ?? rec.currentStart ?? null
    rec.currentEnd = sub.current_end ?? rec.currentEnd ?? null
    rec.nextChargeAt = sub.charge_at ?? null
    rec.paidCount = sub.paid_count
    rec.remainingCount = sub.remaining_count
    if (sub.plan_id) {
      const info = await planFromRazorpayPlanId(sub.plan_id)
      if (info) { rec.plan = info.plan; rec.period = info.period }
    }
    if (rec.scheduledChange && !sub.has_scheduled_changes) rec.scheduledChange = null
    rec.updatedAt = now()
  }

  /* ── payments → ledger → invoice ───────────────────────────────────────── */
  interface PaymentInput {
    paymentId: string
    orderId?: string
    subscriptionId?: string
    plan: PlanId
    period: Period
    amountPaise: number
    method?: string
    at?: number
    periodStart: number
    periodEnd: number
    kind: Invoice['kind']
  }

  /* Idempotent: the same Razorpay payment id is only ever recorded and invoiced once. */
  async function recordPayment(rec: BillingRecord, p: PaymentInput): Promise<Invoice | null> {
    if (!rec.payments.some((x) => x.id === p.paymentId)) {
      rec.payments.unshift({
        id: p.paymentId, orderId: p.orderId, subscriptionId: p.subscriptionId, amountPaise: p.amountPaise,
        at: p.at ?? now(), plan: p.plan, period: p.period, status: 'paid', method: p.method,
      })
    }
    rec.invoices ??= []
    const existing = rec.invoices.find((i) => i.paymentId === p.paymentId)
    if (existing) return existing
    if (!rec.profile) return null            // checkout requires details, so this is only a safety net

    const issuedAt = p.at ?? now()
    const fy = financialYear(issuedAt)
    const seq = await store.nextSequence(`inv:${fy}`)
    const inv = buildInvoice({
      seller, buyer: rec.profile, number: invoiceNumber(seller.prefix, fy, seq), issuedAt,
      paymentId: p.paymentId, orderId: p.orderId, subscriptionId: p.subscriptionId,
      plan: p.plan, period: p.period, periodStart: p.periodStart, periodEnd: p.periodEnd,
      gstPercent, amountPaise: p.amountPaise, method: p.method, kind: p.kind,
    })
    rec.invoices.unshift(inv)
    return inv
  }

  /* Pick up charges Razorpay made on its own (renewals, retries) that we haven't seen yet. */
  async function syncAutopayPayments(rec: BillingRecord, sub: RzEntity): Promise<void> {
    const known = rec.payments.filter((p) => p.subscriptionId === sub.id).length
    if ((sub.paid_count ?? 0) <= known || !rec.plan || !rec.period) return
    const list = await rz!.request<RzEntity>('GET', `/invoices?subscription_id=${sub.id}&count=50`)
    for (const inv of list.items ?? []) {
      if (inv.status !== 'paid' || !inv.payment_id || rec.payments.some((p) => p.id === inv.payment_id)) continue
      const payment = await rz!.request<RzEntity>('GET', `/payments/${inv.payment_id}`).catch(() => null)
      const start = inv.billing_start ?? sub.current_start ?? now()
      const wasDunning = rec.dunning?.state === 'active'
      await recordPayment(rec, {
        paymentId: inv.payment_id, subscriptionId: sub.id, plan: rec.plan, period: rec.period,
        amountPaise: inv.amount ?? chargeOf(rec.plan, rec.period, rec).totalPaise, method: payment?.method,
        at: inv.paid_at ?? now(), periodStart: start, periodEnd: inv.billing_end ?? addPeriod(start, rec.period),
        kind: wasDunning ? 'dunning_recovery' : rec.payments.length ? 'renewal' : 'purchase',
      })
      rec.paymentMethod = methodOf(payment) ?? rec.paymentMethod
      if (wasDunning) await resolveDunning(rec, 'razorpay_retry')
    }
  }

  /* ── dunning ───────────────────────────────────────────────────────────── */
  const stopLink = (id?: string) => (id ? rz!.request('POST', `/payment_links/${id}/cancel`).catch(() => undefined) : undefined)

  function startDunning(rec: BillingRecord, reason: string): void {
    if (!rec.plan || !rec.period) return
    const t = now()
    const times = attemptTimes(t, policy)
    const dun: Dunning = {
      state: 'active', cycleKey: rec.currentEnd ?? t, startedAt: t, deadline: deadlineFor(t, policy),
      amountPaise: chargeOf(rec.plan, rec.period, rec).totalPaise, plan: rec.plan, period: rec.period,
      attempts: [{ n: 1, at: t, kind: 'charge', result: 'failed', reason }],
      nextAttemptAt: times[1] ?? null,
    }
    rec.dunning = dun
  }

  async function resolveDunning(rec: BillingRecord, how: NonNullable<Dunning['resolution']>): Promise<void> {
    const d = rec.dunning
    if (!d || d.state !== 'active') return
    for (const a of d.attempts) if (a.result === 'sent') { await stopLink(a.linkId); if (how !== 'paid_via_link') a.result = 'expired' }
    d.state = 'recovered'; d.resolution = how; d.resolvedAt = now(); d.nextAttemptAt = null
  }

  /* Ask the customer to pay what's due — Razorpay emails and texts them a pay-now link. */
  async function sendCollection(rec: BillingRecord, d: Dunning): Promise<void> {
    const n = d.attempts.length + 1
    const times = attemptTimes(d.startedAt, policy)
    const t = now()
    for (const a of d.attempts) if (a.result === 'sent') { await stopLink(a.linkId); a.result = 'expired' }   // one live link at a time
    const p = rec.profile
    try {
      const link = await rz!.request<RzEntity>('POST', '/payment_links', {
        amount: d.amountPaise, currency: 'INR', accept_partial: false,
        description: `SmatBot ${PLAN_CATALOG[d.plan].name} plan renewal — reminder ${n} of ${policy.maxAttempts}`,
        reference_id: `dun_${rec.workspaceId}_${d.startedAt}_${n}`.slice(0, 40),
        ...(p ? { customer: { name: p.contactName, email: p.email, contact: `+91${p.phone}` }, notify: { sms: true, email: true } } : {}),
        reminder_enable: true,
        ...(d.deadline - t > 1800 ? { expire_by: d.deadline } : {}),
        notes: { workspaceId: rec.workspaceId, plan: d.plan, period: d.period, dunning: String(d.startedAt) },
      })
      d.attempts.push({ n, at: t, kind: 'collection', result: 'sent', linkId: link.id, linkUrl: link.short_url })
    } catch (e) {
      d.attempts.push({ n, at: t, kind: 'collection', result: 'send_failed', reason: e instanceof Error ? e.message : 'unknown' })
    }
    d.nextAttemptAt = n < policy.maxAttempts ? (times[n] ?? null) : null
  }

  async function recoverViaPayment(rec: BillingRecord, d: Dunning, paymentId: string): Promise<void> {
    if (!rec.plan || !rec.period) return
    const payment = await rz!.request<RzEntity>('GET', `/payments/${paymentId}`).catch(() => null)
    const live = d.attempts.find((a) => a.result === 'sent')
    if (live) live.result = 'paid'
    // Razorpay's own retries must not also charge this cycle.
    if (rec.subscriptionId && !TERMINAL.has(rec.status)) {
      await rz!.request('POST', `/subscriptions/${rec.subscriptionId}/cancel`, { cancel_at_cycle_end: 0 }).catch(() => undefined)
    }
    const start = rec.currentEnd ?? now()
    rec.currentStart = start
    rec.currentEnd = addPeriod(start, rec.period)
    rec.status = 'active'; rec.mode = 'once'; rec.autopayLapsed = true; rec.cancelAtCycleEnd = false
    rec.nextChargeAt = null; rec.scheduledChange = null
    rec.paymentMethod = methodOf(payment) ?? rec.paymentMethod
    await recordPayment(rec, {
      paymentId, subscriptionId: rec.subscriptionId, plan: rec.plan, period: rec.period, amountPaise: d.amountPaise,
      method: payment?.method, periodStart: start, periodEnd: rec.currentEnd, kind: 'dunning_recovery',
    })
    d.state = 'recovered'; d.resolution = 'paid_via_link'; d.resolvedAt = now(); d.nextAttemptAt = null
  }

  async function exhaustDunning(rec: BillingRecord, d: Dunning): Promise<void> {
    for (const a of d.attempts) if (a.result === 'sent') { await stopLink(a.linkId); a.result = 'expired' }
    if (rec.subscriptionId && rec.mode === 'autopay') {
      await rz!.request('POST', `/subscriptions/${rec.subscriptionId}/cancel`, { cancel_at_cycle_end: 0 }).catch(() => undefined)
    }
    d.state = 'exhausted'; d.resolution = 'window_elapsed'; d.resolvedAt = now(); d.nextAttemptAt = null
    rec.status = 'suspended'; rec.nextChargeAt = null
  }

  /* One pass over a record in dunning. Returns true if anything changed. */
  async function processDunning(rec: BillingRecord): Promise<boolean> {
    const d = rec.dunning
    if (!d || d.state !== 'active') return false
    let changed = false

    // Did the customer pay one of our links?
    for (const a of d.attempts) {
      if (a.result !== 'sent' || !a.linkId) continue
      const link = await rz!.request<RzEntity>('GET', `/payment_links/${a.linkId}`).catch(() => null)
      if (link?.status === 'paid') {
        const paymentId = link.payments?.[0]?.payment_id ?? link.payment_id
        if (paymentId) { await recoverViaPayment(rec, d, paymentId); return true }
      } else if (link?.status === 'expired' || link?.status === 'cancelled') { a.result = 'expired'; changed = true }
    }

    if (now() >= d.deadline) { await exhaustDunning(rec, d); return true }

    if (d.nextAttemptAt && now() >= d.nextAttemptAt && d.attempts.length < policy.maxAttempts) {
      await sendCollection(rec, d)
      changed = true
    }
    return changed
  }

  /* Bring an autopay record in line with Razorpay: status, dates, new charges, failures. */
  async function refreshAutopay(rec: BillingRecord): Promise<void> {
    const sub = await rz!.request<RzEntity>('GET', `/subscriptions/${rec.subscriptionId}`)
    await applySubscription(rec, sub)
    await syncAutopayPayments(rec, sub)
    // A failed renewal puts the subscription in pending / halted: start collecting, once per cycle.
    if ((sub.status === 'pending' || sub.status === 'halted') && rec.dunning?.state !== 'active') {
      const cycle = rec.currentEnd ?? 0
      if (!rec.dunning || rec.dunning.cycleKey !== cycle) startDunning(rec, sub.status === 'halted' ? 'Razorpay stopped retrying the card' : 'Automatic debit failed')
    }
  }

  /* ── the dashboard's view of a record ──────────────────────────────────── */
  async function summarize(rec: BillingRecord | null) {
    if (!rec || rec.status === 'none' || !rec.plan || !rec.period) {
      return { configured: true, status: 'none', gstPercent }
    }
    let stale = false
    let dirty = false

    // An autopay plan queued to start at renewal takes over once its time comes.
    if (rec.upcoming && now() >= rec.upcoming.startsAt) {
      try {
        const sub = await rz!.request<RzEntity>('GET', `/subscriptions/${rec.upcoming.subscriptionId}`)
        await applySubscription(rec, sub)
        rec.cancelAtCycleEnd = false
        rec.upcoming = null
        dirty = true
      } catch { stale = true }
    }

    if (rec.mode === 'autopay' && rec.subscriptionId && !TERMINAL.has(rec.status)) {
      try { await refreshAutopay(rec); dirty = true } catch { stale = true }
    }
    if (rec.dunning?.state === 'active') {
      try { if (await processDunning(rec)) dirty = true } catch { stale = true }
    }
    if (rec.mode === 'once' && rec.status === 'active' && rec.currentEnd && rec.currentEnd < now()) {
      rec.status = 'expired'
      dirty = true
    }
    if (dirty) { rec.updatedAt = now(); await store.put(rec) }

    const c = chargeOf(rec.plan, rec.period, rec)
    const d = rec.dunning
    const status = d?.state === 'active' ? 'past_due' : rec.status
    const ending = rec.mode === 'once' || rec.cancelAtCycleEnd
    const live = ['active', 'authenticated', 'pending', 'past_due'].includes(status)
    const latest = rec.invoices?.[0]
    const openLink = d?.attempts.slice().reverse().find((a) => a.result === 'sent')
    return {
      configured: true,
      stale,
      status,
      plan: rec.plan,
      planName: PLAN_CATALOG[rec.plan].name,
      period: rec.period,
      mode: rec.mode,
      charge: { base: c.base, gst: c.gst, total: c.total, gstPercent, tax: c.tax },
      currentStart: rec.currentStart ?? null,
      currentEnd: rec.currentEnd ?? null,
      nextChargeAt: ending || status === 'past_due' ? null : (rec.nextChargeAt ?? rec.currentEnd ?? null),
      endsAt: ending && !['cancelled', 'suspended'].includes(status) ? (rec.currentEnd ?? null) : null,
      autopay: {
        on: rec.mode === 'autopay' && !rec.cancelAtCycleEnd && live,
        requiresApproval: needsApprovalEachCycle(c),
        approvalLimit: AFA_LIMIT_RUPEES,
        lapsed: Boolean(rec.autopayLapsed),
      },
      dunning: d && d.state !== 'recovered' ? {
        state: d.state,
        attempt: d.attempts.length,
        maxAttempts: policy.maxAttempts,
        startedAt: d.startedAt,
        deadline: d.deadline,
        nextAttemptAt: d.nextAttemptAt,
        amountPaise: d.amountPaise,
        payUrl: d.state === 'active' ? (openLink?.linkUrl ?? null) : null,
        attempts: d.attempts.map((a) => ({ n: a.n, at: a.at, kind: a.kind, result: a.result, reason: a.reason ?? null })),
      } : null,
      scheduledChange: rec.scheduledChange ?? null,
      upcoming: rec.upcoming
        ? { ...rec.upcoming, planName: PLAN_CATALOG[rec.upcoming.plan].name, charge: chargeOf(rec.upcoming.plan, rec.upcoming.period, rec) }
        : null,
      paymentMethod: rec.paymentMethod ?? null,
      authorisedAt: rec.consents?.[0]?.at ?? null,
      latestInvoice: latest ? { id: latest.id, number: latest.number, url: `/api/billing/invoices/${latest.id}/view` } : null,
      paidCount: rec.paidCount ?? rec.payments.length,
      remainingCount: rec.remainingCount ?? null,
      subscriptionId: rec.subscriptionId ?? null,
    }
  }

  /* ── handlers ──────────────────────────────────────────────────────────── */
  async function checkout(req: BillingRequest): Promise<BillingResponse> {
    const { plan, period, mode, startAtCycleEnd, consent } = (req.body ?? {}) as Record<string, unknown>
    if (!isPlanId(plan) || !isPeriod(period) || (mode !== 'once' && mode !== 'autopay')) {
      return err(400, 'invalid_request', 'plan, period and mode are required.')
    }
    const rec = (await store.get(req.workspaceId)) ?? blank(req.workspaceId)
    // No payment starts without knowing who is being billed (GST invoice, bank notices).
    if (!rec.profile) return err(409, 'billing_details_required', 'Add your billing details before paying.')
    // A recurring mandate needs the customer's explicit, recorded agreement.
    if (mode === 'autopay' && consent !== true) return err(409, 'consent_required', 'Please confirm that you authorise the recurring charges.')
    const c = chargeOf(plan, period, rec)
    const description = `SmatBot ${PLAN_CATALOG[plan].name} · ${period} (incl. ${gstPercent}% GST)`
    const base = { keyId, amount: c.totalPaise, currency: 'INR', description, plan, period }

    if (mode === 'once') {
      const order = await rz!.request<RzEntity>('POST', '/orders', {
        amount: c.totalPaise,
        currency: 'INR',
        receipt: `${req.workspaceId}-${now()}`.slice(0, 40),
        notes: notesFor(rec, plan, period),
      })
      rec.pending = { mode: 'once', plan, period, orderId: order.id, createdAt: now() }
      rec.updatedAt = now()
      await store.put(rec)
      return reply(200, { ...base, mode, orderId: order.id })
    }

    // autopay
    const planId = await ensureRazorpayPlan(plan, period)
    const body: Record<string, unknown> = {
      plan_id: planId,
      total_count: totalCount(period),
      customer_notify: 1,
      notes: notesFor(rec, plan, period),
    }
    let startAt: number | undefined
    if (startAtCycleEnd === true) {
      if (!rec.currentEnd || rec.currentEnd <= now() + 60) return err(409, 'no_current_period', 'There is no running plan to continue from.')
      startAt = rec.currentEnd
      body.start_at = startAt
    }
    const sub = await rz!.request<RzEntity>('POST', '/subscriptions', body)
    rec.pending = {
      mode: 'autopay', plan, period, subscriptionId: sub.id, startAt, createdAt: now(),
      consent: { version: CONSENT_VERSION, at: now(), ip: req.ip, userAgent: req.userAgent, plan, period, amountPaise: c.totalPaise, subscriptionId: sub.id },
    }
    rec.updatedAt = now()
    await store.put(rec)
    return reply(200, { ...base, mode, subscriptionId: sub.id, startsAt: startAt ?? null })
  }

  async function verify(req: BillingRequest): Promise<BillingResponse> {
    const b = (req.body ?? {}) as Record<string, string | undefined>
    const paymentId = b.razorpay_payment_id
    const signature = b.razorpay_signature
    if (!paymentId || !signature) return err(400, 'invalid_request', 'payment id and signature are required.')

    const rec = await store.get(req.workspaceId)
    const pend = rec?.pending
    if (!rec || !pend) return err(409, 'no_pending_checkout', 'There is no checkout waiting to be confirmed.')

    // Verify against the id we stored, not what the browser says.
    const signedPayload = pend.mode === 'once' ? `${pend.orderId}|${paymentId}` : `${paymentId}|${pend.subscriptionId}`
    if (!rz!.verifySignature(signedPayload, signature)) {
      return err(400, 'invalid_signature', 'The payment signature did not match, so it was not applied.')
    }

    const payment = await rz!.request<RzEntity>('GET', `/payments/${paymentId}`).catch(() => null)
    const c = chargeOf(pend.plan, pend.period, rec)

    if (pend.mode === 'once') {
      // A valid signature proves Razorpay issued it; the payment itself must still
      // be confirmed with Razorpay before we hand out a plan.
      let p = payment
      if (!p) return err(502, 'payment_lookup_failed', 'Could not confirm the payment with Razorpay. Nothing was applied — try again in a moment.')
      if (p.order_id !== pend.orderId) return err(400, 'order_mismatch', 'That payment belongs to a different order.')
      // If the account is set to manual capture the payment is only "authorized".
      if (p.status === 'authorized') {
        p = await rz!.request<RzEntity>('POST', `/payments/${paymentId}/capture`, { amount: c.totalPaise, currency: 'INR' })
      }
      if (p.status !== 'captured') return err(402, 'payment_not_captured', `Payment status is "${p.status}".`)
      if (p.amount !== c.totalPaise) return err(400, 'amount_mismatch', 'The amount paid does not match the plan price.')

      const start = now()
      rec.plan = pend.plan; rec.period = pend.period; rec.mode = 'once'; rec.status = 'active'
      rec.subscriptionId = undefined; rec.cancelAtCycleEnd = false; rec.scheduledChange = null; rec.upcoming = null
      rec.dunning = null; rec.autopayLapsed = false
      rec.currentStart = start; rec.currentEnd = addPeriod(start, pend.period); rec.nextChargeAt = null
      rec.paymentMethod = methodOf(p)
      await recordPayment(rec, {
        paymentId, orderId: pend.orderId, plan: pend.plan, period: pend.period, amountPaise: c.totalPaise, method: p.method,
        periodStart: rec.currentStart, periodEnd: rec.currentEnd, kind: 'purchase',
      })
    } else {
      const sub = await rz!.request<RzEntity>('GET', `/subscriptions/${pend.subscriptionId}`)
      if (pend.startAt) {
        // Authorised now, bills when the current period ends.
        rec.upcoming = { subscriptionId: sub.id, plan: pend.plan, period: pend.period, startsAt: pend.startAt }
        rec.cancelAtCycleEnd = true      // the running plan stops; the queued one continues it
        rec.paymentMethod = methodOf(payment) ?? rec.paymentMethod
        // Don't leave the old autopay running alongside the new one.
        if (rec.subscriptionId && rec.mode === 'autopay' && !TERMINAL.has(rec.status)) {
          await rz!.request('POST', `/subscriptions/${rec.subscriptionId}/cancel`, { cancel_at_cycle_end: 1 }).catch(() => undefined)
        }
      } else {
        await applySubscription(rec, sub)
        rec.cancelAtCycleEnd = false; rec.scheduledChange = null; rec.upcoming = null
        rec.dunning = null; rec.autopayLapsed = false
        rec.paymentMethod = methodOf(payment)
        // The first debit is charged with the authorisation; invoice it as soon as it's captured.
        if (payment?.status === 'captured') {
          const start = sub.current_start ?? now()
          await recordPayment(rec, {
            paymentId, subscriptionId: sub.id, plan: pend.plan, period: pend.period, amountPaise: c.totalPaise, method: payment.method,
            periodStart: start, periodEnd: sub.current_end ?? addPeriod(start, pend.period), kind: 'purchase',
          })
        }
      }
    }
    // Keep the proof that the customer agreed to the recurring charge.
    if (pend.consent) rec.consents = [pend.consent, ...(rec.consents ?? [])]
    rec.pending = null
    rec.updatedAt = now()
    await store.put(rec)
    return reply(200, await summarize(rec))
  }

  async function changePlan(req: BillingRequest): Promise<BillingResponse> {
    const { plan, period } = (req.body ?? {}) as Record<string, unknown>
    if (!isPlanId(plan) || !isPeriod(period)) return err(400, 'invalid_request', 'plan and period are required.')
    const rec = await store.get(req.workspaceId)
    if (!rec || rec.mode !== 'autopay' || !rec.subscriptionId || !rec.plan || !rec.period) {
      return err(409, 'no_autopay_subscription', 'Plan changes need an active autopay subscription.')
    }
    if (rec.plan === plan && rec.period === period) return err(409, 'same_plan', 'That is already your plan.')
    if (!['active', 'authenticated'].includes(rec.status) || rec.dunning?.state === 'active') {
      return err(409, 'not_changeable', 'Fix the payment issue on your current plan before changing it.')
    }

    const cur = chargeFor(rec.plan, rec.period, gstPercent)
    const next = chargeFor(plan, period, gstPercent)
    const upgrade = next.totalPaise > cur.totalPaise
    try {
      const planId = await ensureRazorpayPlan(plan, period)
      await rz!.request('PATCH', `/subscriptions/${rec.subscriptionId}`, {
        plan_id: planId,
        remaining_count: totalCount(period),
        schedule_change_at: upgrade ? 'now' : 'cycle_end',
        customer_notify: 1,
      })
    } catch (e) {
      if (e instanceof RazorpayError && e.status === 400) {
        return err(409, 'change_not_supported', `${e.message} Razorpay only allows plan changes on card-authorised autopay, so you may need to subscribe again instead.`)
      }
      throw e
    }
    if (upgrade) {
      const sub = await rz!.request<RzEntity>('GET', `/subscriptions/${rec.subscriptionId}`)
      await applySubscription(rec, sub)
      rec.plan = plan; rec.period = period
    } else {
      rec.scheduledChange = { plan, period, at: rec.currentEnd ?? now() }
    }
    rec.updatedAt = now()
    await store.put(rec)
    return reply(200, { ...(await summarize(rec) as object), appliedNow: upgrade })
  }

  async function setAutopay(req: BillingRequest): Promise<BillingResponse> {
    const rec = await store.get(req.workspaceId)
    if (!rec) return err(409, 'no_subscription', 'There is no plan to change.')
    const enabled = (req.body as Record<string, unknown> | undefined)?.enabled
    if (enabled !== false) return err(400, 'invalid_request', 'Turn autopay on by starting a new autopay checkout.')

    if (rec.mode === 'autopay' && rec.subscriptionId && !TERMINAL.has(rec.status) && !rec.cancelAtCycleEnd) {
      const immediate = rec.status === 'authenticated' && !rec.paidCount
      await rz!.request('POST', `/subscriptions/${rec.subscriptionId}/cancel`, { cancel_at_cycle_end: immediate ? 0 : 1 })
      if (immediate) rec.status = 'cancelled'
      rec.cancelAtCycleEnd = true
      rec.scheduledChange = null
      rec.updatedAt = now()
      await store.put(rec)
    }
    return reply(200, await summarize(rec))
  }

  /* Every payment has an invoice; ones made before invoicing existed are issued now. */
  async function backfillInvoices(rec: BillingRecord): Promise<boolean> {
    let changed = false
    for (const p of [...rec.payments].reverse()) {
      if (p.status !== 'paid' || rec.invoices?.some((i) => i.paymentId === p.id)) continue
      const start = p.at
      const before = rec.invoices?.length ?? 0
      await recordPayment(rec, {
        paymentId: p.id, orderId: p.orderId, subscriptionId: p.subscriptionId, plan: p.plan, period: p.period, amountPaise: p.amountPaise,
        method: p.method, at: p.at, periodStart: start, periodEnd: addPeriod(start, p.period), kind: 'purchase',
      })
      if ((rec.invoices?.length ?? 0) > before) changed = true
    }
    return changed
  }

  async function invoices(req: BillingRequest): Promise<BillingResponse> {
    const rec = await store.get(req.workspaceId)
    if (!rec) return reply(200, { items: [] })
    if (await backfillInvoices(rec)) { rec.updatedAt = now(); await store.put(rec) }
    const items = (rec.invoices ?? []).map((i) => ({
      id: i.id, number: i.number, date: i.issuedAt, amountPaise: i.amountPaise, status: 'paid',
      description: `${PLAN_CATALOG[i.plan].name} plan · ${i.period}${i.kind === 'renewal' ? ' · renewal' : i.kind === 'dunning_recovery' ? ' · renewal (recovered)' : ''}`,
      url: `/api/billing/invoices/${i.id}/view`, paymentId: i.paymentId,
    }))
    return reply(200, { items })
  }

  async function invoiceView(req: BillingRequest, id: string): Promise<BillingResponse> {
    const rec = await store.get(req.workspaceId)
    const inv = rec?.invoices?.find((i) => i.id === id)
    if (!inv) return err(404, 'not_found', 'No such invoice.')
    return { status: 200, body: renderInvoiceHtml(inv), contentType: 'text/html; charset=utf-8' }
  }

  async function webhook(req: BillingRequest): Promise<BillingResponse> {
    if (!webhookSecret) return err(503, 'webhook_secret_not_configured', 'Set RAZORPAY_WEBHOOK_SECRET to accept webhooks.')
    if (!req.rawBody || !verifyWebhookSignature(req.rawBody, req.headers['x-razorpay-signature'], webhookSecret)) {
      return err(400, 'invalid_signature')
    }
    const event = String((req.body as Record<string, unknown> | undefined)?.event ?? '')
    const payload = ((req.body as Record<string, RzEntity> | undefined)?.payload ?? {}) as Record<string, RzEntity>
    const sub = payload.subscription?.entity as RzEntity | undefined
    const pay = payload.payment?.entity as RzEntity | undefined

    if (sub?.id) {
      const rec = await store.findBySubscription(sub.id)
      if (rec) {
        await applySubscription(rec, sub)
        if (event === 'subscription.charged' && pay?.id && rec.plan && rec.period) {
          const wasDunning = rec.dunning?.state === 'active'
          const start = sub.current_start ?? now()
          await recordPayment(rec, {
            paymentId: pay.id, subscriptionId: sub.id, plan: rec.plan, period: rec.period, amountPaise: pay.amount, method: pay.method,
            at: pay.created_at ?? now(), periodStart: start, periodEnd: sub.current_end ?? addPeriod(start, rec.period),
            kind: wasDunning ? 'dunning_recovery' : rec.payments.length ? 'renewal' : 'purchase',
          })
          rec.paymentMethod = methodOf(pay) ?? rec.paymentMethod
          if (wasDunning) await resolveDunning(rec, 'razorpay_retry')
        }
        // A failed renewal: begin collecting (once per cycle).
        if ((event === 'subscription.pending' || event === 'subscription.halted') && rec.dunning?.state !== 'active') {
          const cycle = rec.currentEnd ?? 0
          if (!rec.dunning || rec.dunning.cycleKey !== cycle) startDunning(rec, event === 'subscription.halted' ? 'Razorpay stopped retrying the card' : 'Automatic debit failed')
        }
        await store.put(rec)
      }
    }

    // The customer paid one of our dunning links.
    const link = payload.payment_link?.entity as RzEntity | undefined
    if (event === 'payment_link.paid' && link?.notes?.workspaceId) {
      const rec = await store.get(String(link.notes.workspaceId))
      const d = rec?.dunning
      const paymentId = pay?.id ?? link.payments?.[0]?.payment_id
      if (rec && d?.state === 'active' && paymentId && d.attempts.some((a) => a.linkId === link.id)) {
        await recoverViaPayment(rec, d, paymentId)
        rec.updatedAt = now()
        await store.put(rec)
      }
    }
    return reply(200, { ok: true })
  }

  /* Run by a timer (dev server every minute, API every few minutes): advance every
     record that is being collected on. Safe to call as often as you like. */
  async function runDue(): Promise<number> {
    if (!rz) return 0
    let n = 0
    for (const rec of await store.listActiveDunning()) {
      try {
        if (rec.mode === 'autopay' && rec.subscriptionId && !TERMINAL.has(rec.status)) await refreshAutopay(rec)
        await processDunning(rec)
        rec.updatedAt = now()
        await store.put(rec)
        n++
      } catch { /* try again next tick */ }
    }
    return n
  }

  async function getProfile(req: BillingRequest): Promise<BillingResponse> {
    const rec = await store.get(req.workspaceId)
    return reply(200, { profile: rec?.profile ?? null, complete: Boolean(rec?.profile) })
  }

  async function putProfile(req: BillingRequest): Promise<BillingResponse> {
    const v = validateProfile((req.body ?? {}) as Parameters<typeof validateProfile>[0], now())
    if (!v.ok) return reply(422, { error: 'invalid_profile', message: 'Some details need fixing.', fields: v.fields })
    const rec = (await store.get(req.workspaceId)) ?? blank(req.workspaceId)
    // A change of address after a checkout began could change the tax split; start over.
    if (rec.pending && rec.profile?.address.stateCode !== v.profile.address.stateCode) rec.pending = null
    rec.profile = v.profile
    rec.updatedAt = now()
    await store.put(rec)
    return reply(200, { profile: rec.profile, complete: true })
  }

  /* What a plan will cost THIS customer, with GST labelled for their state. */
  async function quote(req: BillingRequest): Promise<BillingResponse> {
    const { plan, period } = (req.body ?? {}) as Record<string, unknown>
    if (!isPlanId(plan) || !isPeriod(period)) return err(400, 'invalid_request', 'plan and period are required.')
    const rec = await store.get(req.workspaceId)
    const c = chargeOf(plan, period, rec)
    return reply(200, { plan, planName: PLAN_CATALOG[plan].name, period, charge: c, requiresApproval: needsApprovalEachCycle(c), approvalLimit: AFA_LIMIT_RUPEES })
  }

  /* ── router ────────────────────────────────────────────────────────────── */
  async function handle(req: BillingRequest): Promise<BillingResponse> {
    const path = req.path.replace(/\/+$/, '') || '/'
    const route = `${req.method.toUpperCase()} ${path}`

    if (route === 'GET /config') {
      const prices = Object.fromEntries(PLAN_ORDER.map((p) => [p, {
        monthly: chargeFor(p, 'monthly', gstPercent), yearly: chargeFor(p, 'yearly', gstPercent),
      }]))
      return reply(200, {
        configured: Boolean(rz && keyId), keyId: keyId ?? null, gstPercent, approvalLimit: AFA_LIMIT_RUPEES, prices,
        states: STATES, supplierStateCode: supplier,
        dunning: { maxAttempts: policy.maxAttempts, windowDays: policy.windowDays, retryAfterHours: policy.retryAfterHours },
      })
    }
    if (!rz || !keyId) return err(503, 'payments_not_configured', 'Razorpay keys are not configured on the server.')

    try {
      const view = path.match(/^\/invoices\/([A-Za-z0-9_-]+)\/view$/)
      if (req.method.toUpperCase() === 'GET' && view) return await invoiceView(req, view[1]!)

      switch (route) {
        case 'GET /subscription':   return reply(200, await summarize(await store.get(req.workspaceId)))
        case 'GET /profile':        return await getProfile(req)
        case 'PUT /profile':        return await putProfile(req)
        case 'POST /quote':         return await quote(req)
        case 'POST /checkout':      return await checkout(req)
        case 'POST /verify':        return await verify(req)
        case 'POST /change-plan':   return await changePlan(req)
        case 'POST /autopay':       return await setAutopay(req)
        case 'GET /invoices':       return await invoices(req)
        case 'POST /webhook':       return await webhook(req)
        default:                    return err(404, 'not_found')
      }
    } catch (e) {
      if (e instanceof RazorpayError) {
        if (e.status === 401) return err(503, 'razorpay_unauthorized', e.message)
        return err(502, 'razorpay_error', e.message)
      }
      throw e
    }
  }

  return { handle, runDue }
}

export type BillingService = ReturnType<typeof createBillingService>
