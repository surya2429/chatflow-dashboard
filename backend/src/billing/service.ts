// service.ts — billing rules, independent of any web framework.
//
// Two ways to pay, both through Razorpay Checkout:
//   once     a single payment (Orders API) that buys one billing period. No
//            recurring debit; the plan simply ends when the period does.
//   autopay  a Razorpay Subscription: the customer authorises once, Razorpay
//            debits every cycle. Needs Subscriptions enabled on the account.
//
// Rules that matter and are easy to get wrong:
//   • Amounts are decided HERE from the catalog. The browser sends only a plan id
//     and a period.
//   • A checkout is trusted only after its signature verifies against the order /
//     subscription id THIS server created — never the one the browser echoes back.
//   • Renewals above ₹15,000 need the customer to approve each debit (RBI), so
//     they are "automatic" only in the sense that Razorpay starts them.
//   • Razorpay can only change a plan on card-authorised subscriptions.
import {
  AFA_LIMIT_RUPEES, PLAN_CATALOG, PLAN_ORDER, addPeriod, chargeFor, isPeriod, isPlanId,
  needsApprovalEachCycle, planKey, totalCount, type Period, type PlanId,
} from './catalog.js'
import { RazorpayError, verifyWebhookSignature, type Razorpay, type RzEntity } from './razorpay.js'
import type {
  BillingRecord, BillingRequest, BillingResponse, BillingStore, PaymentLogEntry, PaymentMethod,
} from './types.js'

export interface BillingServiceOptions {
  store: BillingStore
  razorpay?: Razorpay
  keyId?: string
  webhookSecret?: string
  gstPercent: number
  /** unix seconds; injectable for tests */
  now?: () => number
}

const TERMINAL = new Set(['cancelled', 'completed', 'expired'])
const reply = (status: number, body: unknown): BillingResponse => ({ status, body })
const err = (status: number, error: string, message?: string): BillingResponse => reply(status, { error, message })

export function createBillingService(opts: BillingServiceOptions) {
  const { store, razorpay: rz, keyId, webhookSecret, gstPercent } = opts
  const now = opts.now ?? (() => Math.floor(Date.now() / 1000))

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

  /* Bring a record up to date and turn it into what the dashboard shows. */
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
      try {
        const sub = await rz!.request<RzEntity>('GET', `/subscriptions/${rec.subscriptionId}`)
        await applySubscription(rec, sub)
        dirty = true
      } catch { stale = true }
    }

    if (rec.mode === 'once' && rec.status === 'active' && rec.currentEnd && rec.currentEnd < now()) {
      rec.status = 'expired'
      dirty = true
    }
    if (dirty) await store.put(rec)

    const c = chargeFor(rec.plan, rec.period, gstPercent)
    const ending = rec.mode === 'once' || rec.cancelAtCycleEnd
    const live = rec.status === 'active' || rec.status === 'authenticated' || rec.status === 'pending'
    return {
      configured: true,
      stale,
      status: rec.status,
      plan: rec.plan,
      planName: PLAN_CATALOG[rec.plan].name,
      period: rec.period,
      mode: rec.mode,
      charge: { base: c.base, gst: c.gst, total: c.total, gstPercent },
      currentStart: rec.currentStart ?? null,
      currentEnd: rec.currentEnd ?? null,
      nextChargeAt: ending ? null : (rec.nextChargeAt ?? rec.currentEnd ?? null),
      endsAt: ending && rec.status !== 'cancelled' ? (rec.currentEnd ?? null) : null,
      autopay: {
        on: rec.mode === 'autopay' && !rec.cancelAtCycleEnd && live,
        requiresApproval: needsApprovalEachCycle(c),
        approvalLimit: AFA_LIMIT_RUPEES,
      },
      scheduledChange: rec.scheduledChange ?? null,
      upcoming: rec.upcoming
        ? { ...rec.upcoming, planName: PLAN_CATALOG[rec.upcoming.plan].name, charge: chargeFor(rec.upcoming.plan, rec.upcoming.period, gstPercent) }
        : null,
      paymentMethod: rec.paymentMethod ?? null,
      paidCount: rec.paidCount ?? rec.payments.length,
      remainingCount: rec.remainingCount ?? null,
      subscriptionId: rec.subscriptionId ?? null,
    }
  }

  /* ── handlers ──────────────────────────────────────────────────────────── */
  async function checkout(req: BillingRequest): Promise<BillingResponse> {
    const { plan, period, mode, startAtCycleEnd } = (req.body ?? {}) as Record<string, unknown>
    if (!isPlanId(plan) || !isPeriod(period) || (mode !== 'once' && mode !== 'autopay')) {
      return err(400, 'invalid_request', 'plan, period and mode are required.')
    }
    const rec = (await store.get(req.workspaceId)) ?? blank(req.workspaceId)
    const c = chargeFor(plan, period, gstPercent)
    const description = `SmatBot ${PLAN_CATALOG[plan].name} · ${period} (incl. ${gstPercent}% GST)`
    const base = { keyId, amount: c.totalPaise, currency: 'INR', description, plan, period }

    if (mode === 'once') {
      const order = await rz!.request<RzEntity>('POST', '/orders', {
        amount: c.totalPaise,
        currency: 'INR',
        receipt: `${req.workspaceId}-${now()}`.slice(0, 40),
        notes: { workspaceId: req.workspaceId, plan, period },
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
      notes: { workspaceId: req.workspaceId, plan, period },
    }
    let startAt: number | undefined
    if (startAtCycleEnd === true) {
      if (!rec.currentEnd || rec.currentEnd <= now() + 60) return err(409, 'no_current_period', 'There is no running plan to continue from.')
      startAt = rec.currentEnd
      body.start_at = startAt
    }
    const sub = await rz!.request<RzEntity>('POST', '/subscriptions', body)
    rec.pending = { mode: 'autopay', plan, period, subscriptionId: sub.id, startAt, createdAt: now() }
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
    const c = chargeFor(pend.plan, pend.period, gstPercent)

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
      rec.currentStart = start; rec.currentEnd = addPeriod(start, pend.period); rec.nextChargeAt = null
      rec.paymentMethod = methodOf(p)
      rec.payments.unshift(ledger(paymentId, pend, c.totalPaise, p?.method))
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
        rec.paymentMethod = methodOf(payment)
        rec.payments.unshift(ledger(paymentId, pend, c.totalPaise, payment?.method))
      }
    }
    rec.pending = null
    rec.updatedAt = now()
    await store.put(rec)
    return reply(200, await summarize(rec))
  }

  const ledger = (id: string, pend: { orderId?: string; subscriptionId?: string; plan: PlanId; period: Period }, amountPaise: number, method?: string): PaymentLogEntry => ({
    id, orderId: pend.orderId, subscriptionId: pend.subscriptionId, amountPaise, at: now(), plan: pend.plan, period: pend.period, status: 'paid', method,
  })

  async function changePlan(req: BillingRequest): Promise<BillingResponse> {
    const { plan, period } = (req.body ?? {}) as Record<string, unknown>
    if (!isPlanId(plan) || !isPeriod(period)) return err(400, 'invalid_request', 'plan and period are required.')
    const rec = await store.get(req.workspaceId)
    if (!rec || rec.mode !== 'autopay' || !rec.subscriptionId || !rec.plan || !rec.period) {
      return err(409, 'no_autopay_subscription', 'Plan changes need an active autopay subscription.')
    }
    if (rec.plan === plan && rec.period === period) return err(409, 'same_plan', 'That is already your plan.')
    if (!['active', 'authenticated'].includes(rec.status)) return err(409, 'not_changeable', `A ${rec.status} subscription cannot be changed.`)

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

  async function invoices(req: BillingRequest): Promise<BillingResponse> {
    const rec = await store.get(req.workspaceId)
    if (!rec) return reply(200, { items: [] })
    type Item = { id: string; number: string; date: number; amountPaise: number; status: string; url?: string; description: string }
    const items: Item[] = []

    if (rec.mode === 'autopay' && rec.subscriptionId) {
      try {
        const list = await rz!.request<RzEntity>('GET', `/invoices?subscription_id=${rec.subscriptionId}&count=50`)
        for (const inv of list.items ?? []) {
          items.push({
            id: inv.id, number: inv.invoice_number ?? inv.receipt ?? inv.id, date: inv.issued_at ?? inv.created_at,
            amountPaise: inv.amount, status: inv.status, url: inv.short_url,
            description: `${rec.plan ? PLAN_CATALOG[rec.plan].name : 'SmatBot'} plan · autopay`,
          })
        }
      } catch { /* fall back to the ledger below */ }
    }
    if (!items.length) {
      for (const p of rec.payments) {
        items.push({
          id: p.id, number: p.id, date: p.at, amountPaise: p.amountPaise, status: p.status === 'paid' ? 'paid' : 'failed',
          description: `${PLAN_CATALOG[p.plan].name} plan · ${p.period}${p.subscriptionId ? '' : ' (one-time)'}`,
        })
      }
    }
    items.sort((a, b) => b.date - a.date)
    return reply(200, { items })
  }

  async function webhook(req: BillingRequest): Promise<BillingResponse> {
    if (!webhookSecret) return err(503, 'webhook_secret_not_configured', 'Set RAZORPAY_WEBHOOK_SECRET to accept webhooks.')
    if (!req.rawBody || !verifyWebhookSignature(req.rawBody, req.headers['x-razorpay-signature'], webhookSecret)) {
      return err(400, 'invalid_signature')
    }
    const event = String((req.body as Record<string, unknown> | undefined)?.event ?? '')
    const payload = ((req.body as Record<string, RzEntity> | undefined)?.payload ?? {}) as Record<string, RzEntity>
    const sub = payload.subscription?.entity as RzEntity | undefined
    if (sub?.id) {
      const rec = await store.findBySubscription(sub.id)
      if (rec) {
        await applySubscription(rec, sub)
        const pay = payload.payment?.entity as RzEntity | undefined
        if (event === 'subscription.charged' && pay?.id && !rec.payments.some((p) => p.id === pay.id) && rec.plan && rec.period) {
          rec.payments.unshift({ id: pay.id, subscriptionId: sub.id, amountPaise: pay.amount, at: pay.created_at ?? now(), plan: rec.plan, period: rec.period, status: 'paid', method: pay.method })
          rec.paymentMethod = methodOf(pay) ?? rec.paymentMethod
        }
        await store.put(rec)
      }
    }
    return reply(200, { ok: true })
  }

  /* ── router ────────────────────────────────────────────────────────────── */
  async function handle(req: BillingRequest): Promise<BillingResponse> {
    const route = `${req.method.toUpperCase()} ${req.path.replace(/\/+$/, '') || '/'}`

    if (route === 'GET /config') {
      const prices = Object.fromEntries(PLAN_ORDER.map((p) => [p, {
        monthly: chargeFor(p, 'monthly', gstPercent), yearly: chargeFor(p, 'yearly', gstPercent),
      }]))
      return reply(200, { configured: Boolean(rz && keyId), keyId: keyId ?? null, gstPercent, approvalLimit: AFA_LIMIT_RUPEES, prices })
    }
    if (!rz || !keyId) return err(503, 'payments_not_configured', 'Razorpay keys are not configured on the server.')

    try {
      switch (route) {
        case 'GET /subscription':   return reply(200, await summarize(await store.get(req.workspaceId)))
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

  return { handle }
}

export type BillingService = ReturnType<typeof createBillingService>
