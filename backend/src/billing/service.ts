// service.ts — billing rules, independent of any web framework.
//
// Two ways to pay, both through Razorpay Checkout:
//   once     a single payment (Orders API) that buys one billing period. No
//            recurring debit; the plan simply ends when the period does.
//   autopay  the customer authorises once and we renew every cycle. Two engines:
//              token         the card is saved under the RBI card-on-file rules and WE
//                            debit it (pre-debit notice first, then the charge). We also
//                            run the retries, so the 48–72 h dunning schedule is exact.
//                            Cards only, up to ₹15,000 per charge. Needs no extra
//                            Razorpay product, so it works on every account.
//              subscription  a Razorpay Subscription: Razorpay debits and retries on its
//                            own fixed schedule. Needs Subscriptions enabled on the
//                            account; used for charges above ₹15,000 (yearly plans).
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
  AFA_LIMIT_RUPEES, PLAN_CATALOG, PLAN_ORDER, ADDON_CATALOG, addPeriod, addonLines, chargeFor, eligibleAddons, normalizeAddons, isPeriod, isPlanId,
  needsApprovalEachCycle, planKey, totalCount, type AddonSel, type Period, type PlanId,
} from './catalog.js'
import { RazorpayError, verifyWebhookSignature, type Razorpay, type RzEntity } from './razorpay.js'
import { STATES, stateName, validateProfile } from './india.js'
import { DUNNING_POLICY, assertPolicy, attemptTimes, deadlineFor, type DunningPolicy } from './dunning.js'
import { buildInvoice, financialYear, invoiceNumber, renderInvoiceHtml, type SellerInfo } from './invoice.js'
import { DEFAULT_LOGO } from './logo.js'
import type {
  BillingRecord, BillingRequest, BillingResponse, BillingStore, Dunning, Invoice, PaymentMethod,
} from './types.js'
import type { Charge } from './catalog.js'

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
  /** 'auto' (default): saved-card autopay when the charge is ≤ ₹15,000, Razorpay Subscriptions above that */
  autopayEngine?: 'auto' | 'token' | 'subscription'
  /** unix seconds; injectable for tests */
  now?: () => number
}

const TERMINAL = new Set(['cancelled', 'completed', 'expired', 'suspended'])
const reply = (status: number, body: unknown): BillingResponse => ({ status, body })
const err = (status: number, error: string, message?: string): BillingResponse => reply(status, { error, message })

export function createBillingService(opts: BillingServiceOptions) {
  const { store, razorpay: rz, keyId, webhookSecret, gstPercent } = opts
  const now = opts.now ?? (() => Math.floor(Date.now() / 1000))
  const supplier = opts.supplierStateCode ?? '36'
  const policy = opts.dunning ?? DUNNING_POLICY
  assertPolicy(policy)
  const CONSENT_VERSION = 'recurring-v1'
  const engineMode = opts.autopayEngine ?? 'auto'
  /* Pre-debit notice (RBI): Razorpay sends the customer the notice when the order is created and
     refuses the debit until 36 h later. We send ours 48 h before a renewal, and never schedule a
     debit closer than 37 h to the notice. */
  const NOTICE_LEAD = 48 * 3600
  const MIN_NOTICE = 37 * 3600
  const TOKEN_MAX_PAISE = AFA_LIMIT_RUPEES * 100
  const useToken = (c: Charge) => engineMode === 'token' || (engineMode === 'auto' && c.total <= AFA_LIMIT_RUPEES)
  /* Only one worker may move a record's money at a time. In-process guard — if you run several
     API instances, run the due-job on one of them (or add a database lock). */
  const busy = new Set<string>()
  const seller: SellerInfo = {
    name: 'Feso Social Media Private Limited',
    brand: 'SMATBOT',
    cin: 'U22222TG2015PTC100809',
    address: '4th Floor, 8-2-120/76/1/B/16, 17, 18, Ashoka Hitech Chambers,\nRoad No. 2, Banjara Hills,\nHyderabad, Telangana 500034, India',
    gstin: '36AACCF6679F1ZD',
    stateCode: supplier, sac: '998314', prefix: 'SB',
    emails: ['sales@smatbot.com', 'accounts@bytequark.com'],
    phone: '+91 9205308991',
    logo: DEFAULT_LOGO,
    notes: [
      'No refunds: we do not have any refund policy, so fees paid for a plan are non-refundable.',
      'Meta charges are separate: WhatsApp messaging charges levied by Meta are not included in the plan price. They are charged by Meta and must be paid by the client.',
      'Add-ons and usage beyond the plan allowance are billed separately.',
      'The total above includes GST. Please quote the invoice number in any billing correspondence.',
    ],
    ...opts.seller,
  }

  /* The charge for a plan, with GST labelled for the customer's state when known.
     The TOTAL is the same either way; only CGST/SGST vs IGST changes. */
  const chargeOf = (plan: PlanId, period: Period, rec?: BillingRecord | null, addons?: AddonSel[]) =>
    chargeFor(plan, period, gstPercent, { supplier, customer: rec?.profile?.address.stateCode }, addons)

  /* What goes on the Razorpay order / subscription as notes (visible in their dashboard). */
  const notesFor = (rec: BillingRecord, plan: PlanId, period: Period, addons?: AddonSel[]) => ({
    workspaceId: rec.workspaceId, plan, period,
    ...(addons?.length ? { addons: addons.map((a) => `${a.id}x${a.qty}`).join(',').slice(0, 250) } : {}),
    ...(rec.profile ? {
      billedTo: rec.profile.legalName.slice(0, 100),
      gstin: rec.profile.gstin ?? 'unregistered',
      placeOfSupply: `${rec.profile.address.stateCode} ${stateName(rec.profile.address.stateCode)}`,
    } : {}),
  })

  /* Razorpay Plan ids, looked up (or created once) by the key stored in notes. */
  const planIdCache = new Map<string, string>()
  const keyByPlanId = new Map<string, { plan: PlanId; period: Period }>()

  async function ensureRazorpayPlan(plan: PlanId, period: Period, addons?: AddonSel[]): Promise<string> {
    const c = chargeFor(plan, period, gstPercent, undefined, addons)
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
        name: `SmatBot ${PLAN_CATALOG[plan].name} (${period === 'monthly' ? 'Monthly' : 'Yearly'})${addons?.length ? ' + add-ons' : ''}`,
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
    if (rec.scheduledChange && !sub.has_scheduled_changes) { if (rec.scheduledChange.addons) rec.addons = rec.scheduledChange.addons; rec.scheduledChange = null }
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
    addons?: AddonSel[]
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
      gstPercent, amountPaise: p.amountPaise, addons: p.addons, method: p.method, kind: p.kind,
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
        amountPaise: inv.amount ?? chargeOf(rec.plan, rec.period, rec, rec.addons).totalPaise, addons: rec.addons, method: payment?.method,
        at: inv.paid_at ?? now(), periodStart: start, periodEnd: inv.billing_end ?? addPeriod(start, rec.period),
        kind: wasDunning ? 'dunning_recovery' : rec.payments.length ? 'renewal' : 'purchase',
      })
      rec.paymentMethod = methodOf(payment) ?? rec.paymentMethod
      if (wasDunning) await resolveDunning(rec, 'razorpay_retry')
    }
  }

  /* ── dunning ───────────────────────────────────────────────────────────── */
  const stopLink = (id?: string) => (id ? rz!.request('POST', `/payment_links/${id}/cancel`).catch(() => undefined) : undefined)

  function startDunning(rec: BillingRecord, reason: string, due?: { plan: PlanId; period: Period; addons?: AddonSel[] }): void {
    const plan = due?.plan ?? rec.plan
    const period = due?.period ?? rec.period
    const addons = due ? due.addons : rec.addons
    if (!plan || !period) return
    const t = now()
    const times = attemptTimes(t, policy)
    const dun: Dunning = {
      state: 'active', engine: rec.engine ?? 'subscription', cycleKey: rec.currentEnd ?? t, startedAt: t, deadline: deadlineFor(t, policy),
      amountPaise: chargeOf(plan, period, rec, addons).totalPaise, plan, period, addons,
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
    if (d.engine === 'token') { await completeRenewal(rec, paymentId, payment, 'paid_via_link'); return }
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
    if (d.linkId) { await stopLink(d.linkId); d.linkId = undefined; d.linkUrl = undefined }
    if (d.engine === 'token') await dropMandate(rec)
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
    if (d.engine === 'token') return processTokenDunning(rec, d)
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

  /* ── saved-card (token) autopay ────────────────────────────────────────── */
  async function ensureCustomer(rec: BillingRecord): Promise<string> {
    if (rec.customerId) return rec.customerId
    const p = rec.profile!
    const c = await rz!.request<RzEntity>('POST', '/customers', {
      name: p.contactName, email: p.email, contact: `+91${p.phone}`, fail_existing: '0', notes: { workspaceId: rec.workspaceId },
    })
    rec.customerId = c.id
    return c.id
  }

  /* Forget the saved card — on cancel, suspension, or when a new card replaces it. */
  async function dropMandate(rec: BillingRecord): Promise<void> {
    if (rec.mandate && rec.customerId) {
      await rz!.request('DELETE', `/customers/${rec.customerId}/tokens/${rec.mandate.id}`).catch(() => undefined)
    }
    rec.mandate = null
    rec.renewal = null
  }

  /* Creating this order is what sends the customer their pre-debit notice. */
  async function noticeOrder(rec: BillingRecord, amountPaise: number, payAfter: number): Promise<string> {
    const o = await rz!.request<RzEntity>('POST', '/orders', {
      amount: amountPaise, currency: 'INR', payment_capture: true,
      receipt: `${rec.workspaceId}-n${now()}`.slice(0, 40), customer_id: rec.customerId,
      notes: { workspaceId: rec.workspaceId, purpose: 'autopay renewal' },
      notification: { token_id: rec.mandate!.id, payment_after: payAfter },
    })
    return o.id
  }

  async function submitDebit(rec: BillingRecord, orderId: string, amountPaise: number, plan: PlanId): Promise<string> {
    const p = rec.profile!
    const r = await rz!.request<RzEntity>('POST', '/payments/create/recurring', {
      email: p.email, contact: `+91${p.phone}`, amount: amountPaise, currency: 'INR', order_id: orderId,
      customer_id: rec.customerId, token: rec.mandate!.id, recurring: true,
      description: `SmatBot ${PLAN_CATALOG[plan].name} plan renewal`,
    })
    const id = r.razorpay_payment_id ?? r.id
    if (!id) throw new Error('Razorpay did not return a payment id for the debit.')
    return id
  }

  /* The cycle is paid: grant the next period, invoice it, line up the following renewal. */
  async function completeRenewal(rec: BillingRecord, paymentId: string, payment: RzEntity | null, how?: 'paid_via_link'): Promise<void> {
    const r = rec.renewal
    if (!r || rec.payments.some((x) => x.id === paymentId)) return
    const d = rec.dunning
    const start = r.dueAt
    const end = addPeriod(start, r.period)
    rec.plan = r.plan; rec.period = r.period; rec.addons = r.addons; rec.mode = 'autopay'; rec.status = 'active'
    rec.currentStart = start; rec.currentEnd = end; rec.nextChargeAt = end
    rec.paidCount = (rec.paidCount ?? 0) + 1
    rec.cancelAtCycleEnd = false; rec.scheduledChange = null; rec.autopayLapsed = false
    rec.paymentMethod = methodOf(payment) ?? rec.paymentMethod
    await recordPayment(rec, {
      paymentId, orderId: payment?.order_id, plan: r.plan, period: r.period,
      amountPaise: payment?.amount ?? chargeOf(r.plan, r.period, rec, r.addons).totalPaise, addons: r.addons, method: payment?.method,
      periodStart: start, periodEnd: end, kind: d?.state === 'active' ? 'dunning_recovery' : 'renewal',
    })
    if (d?.state === 'active') {
      await stopLink(d.linkId)
      for (const a of d.attempts) if (a.result === 'pending' && a.paymentId === paymentId) a.result = 'paid'
      d.linkId = undefined; d.linkUrl = undefined; d.retryOrder = null
      d.state = 'recovered'; d.resolution = how ?? 'auto_retry'; d.resolvedAt = now(); d.nextAttemptAt = null
    }
    rec.renewal = { plan: r.plan, period: r.period, addons: r.addons, dueAt: end }
  }

  /* A pay-now link kept open for the whole window, so the customer can fix it at any moment. */
  async function openPayLink(rec: BillingRecord, d: Dunning): Promise<void> {
    const p = rec.profile
    try {
      const link = await rz!.request<RzEntity>('POST', '/payment_links', {
        amount: d.amountPaise, currency: 'INR', accept_partial: false,
        description: `SmatBot ${PLAN_CATALOG[d.plan].name} plan renewal — pay now to keep your plan active`,
        reference_id: `dun_${rec.workspaceId}_${d.startedAt}`.slice(0, 40),
        ...(p ? { customer: { name: p.contactName, email: p.email, contact: `+91${p.phone}` }, notify: { sms: true, email: true } } : {}),
        reminder_enable: true,
        ...(d.deadline - now() > 1800 ? { expire_by: d.deadline } : {}),
        notes: { workspaceId: rec.workspaceId, plan: d.plan, period: d.period, dunning: String(d.startedAt) },
      })
      d.linkId = link.id; d.linkUrl = link.short_url
    } catch { /* the automatic retries still go ahead */ }
  }

  /* After a failed charge: when is the next one, and send its pre-debit notice now. */
  async function scheduleRetry(rec: BillingRecord, d: Dunning): Promise<void> {
    const times = attemptTimes(d.startedAt, policy)
    d.retryOrder = null
    d.nextAttemptAt = d.attempts.length < policy.maxAttempts ? (times[d.attempts.length] ?? null) : null
    if (!d.nextAttemptAt || !rec.mandate) return
    try {
      const payAfter = Math.max(d.nextAttemptAt, now() + MIN_NOTICE)
      d.retryOrder = { orderId: await noticeOrder(rec, d.amountPaise, payAfter), payAfter }
    } catch { /* tried again on the next pass */ }
  }

  /* The renewal debit failed: start collecting. Attempt 1 is this failure; 2–4 are our retries. */
  async function failRenewal(rec: BillingRecord, reason: string): Promise<void> {
    const r = rec.renewal!
    rec.renewal = { plan: r.plan, period: r.period, addons: r.addons, dueAt: r.dueAt }
    startDunning(rec, reason, { plan: r.plan, period: r.period, addons: r.addons })
    const d = rec.dunning!
    await openPayLink(rec, d)
    await scheduleRetry(rec, d)
  }

  const payFailureReason = (p: RzEntity | null) => String(p?.error_description ?? p?.error_reason ?? 'The bank declined the debit').slice(0, 200)

  /* Normal (not failing) renewal: notice 48 h ahead, then the debit. */
  async function advanceRenewal(rec: BillingRecord): Promise<boolean> {
    const r = rec.renewal
    if (!r || !rec.mandate || !rec.profile || rec.dunning?.state === 'active') return false
    const amount = chargeOf(r.plan, r.period, rec, r.addons).totalPaise

    if (r.paymentId) {                                   // a debit is in flight
      const p = await rz!.request<RzEntity>('GET', `/payments/${r.paymentId}`).catch(() => null)
      if (p?.status === 'captured') { await completeRenewal(rec, r.paymentId, p); return true }
      if (p?.status === 'failed' || now() - (r.submittedAt ?? 0) > 24 * 3600) { await failRenewal(rec, payFailureReason(p)); return true }
      return false
    }
    if (!r.orderId) {                                    // send the pre-debit notice
      if (now() < r.dueAt - NOTICE_LEAD) return false
      r.payAfter = Math.max(r.dueAt, now() + MIN_NOTICE)
      r.orderId = await noticeOrder(rec, amount, r.payAfter)
      return true
    }
    if (now() >= (r.payAfter ?? r.dueAt)) {              // notice period over: take the money
      try { r.paymentId = await submitDebit(rec, r.orderId, amount, r.plan); r.submittedAt = now() }
      catch (e) { await failRenewal(rec, e instanceof Error ? e.message : 'Debit could not be started'); }
      return true
    }
    return false
  }

  /* Dunning for a saved card: check the link, check the in-flight debit, then the next retry. */
  async function processTokenDunning(rec: BillingRecord, d: Dunning): Promise<boolean> {
    let changed = false

    if (d.linkId) {                                      // did the customer pay the link?
      const link = await rz!.request<RzEntity>('GET', `/payment_links/${d.linkId}`).catch(() => null)
      if (link?.status === 'paid') {
        const paymentId = link.payments?.[0]?.payment_id ?? link.payment_id
        if (paymentId) { await recoverViaPayment(rec, d, paymentId); return true }
      } else if (link?.status === 'expired' || link?.status === 'cancelled') { d.linkId = undefined; d.linkUrl = undefined; changed = true }
    }

    const inFlight = d.attempts.find((a) => a.result === 'pending')
    if (inFlight?.paymentId) {                           // a retry was submitted: how did it go?
      const p = await rz!.request<RzEntity>('GET', `/payments/${inFlight.paymentId}`).catch(() => null)
      if (p?.status === 'captured') { await completeRenewal(rec, inFlight.paymentId, p); return true }
      if (p?.status === 'failed' || now() - inFlight.at > 24 * 3600) {
        inFlight.result = 'failed'; inFlight.reason = payFailureReason(p)
        await scheduleRetry(rec, d)
        changed = true
      } else return changed
    }

    if (now() >= d.deadline) { await exhaustDunning(rec, d); return true }

    if (d.nextAttemptAt && rec.mandate && d.attempts.length < policy.maxAttempts) {
      if (!d.retryOrder) { await scheduleRetry(rec, d); changed = true }
      const order = d.retryOrder
      if (order && now() >= Math.max(d.nextAttemptAt, order.payAfter)) {
        const n = d.attempts.length + 1
        const at = now()
        try {
          const paymentId = await submitDebit(rec, order.orderId, d.amountPaise, d.plan)
          d.attempts.push({ n, at, kind: 'charge', result: 'pending', paymentId })
          d.retryOrder = null; d.nextAttemptAt = null
        } catch (e) {
          d.attempts.push({ n, at, kind: 'charge', result: 'failed', reason: e instanceof Error ? e.message.slice(0, 200) : 'Debit could not be started' })
          await scheduleRetry(rec, d)
        }
        changed = true
      }
    }
    return changed
  }

  /* The one entry point for moving a saved-card record forward. */
  async function advanceToken(rec: BillingRecord): Promise<boolean> {
    if (busy.has(rec.workspaceId)) return false
    busy.add(rec.workspaceId)
    try {
      return rec.dunning?.state === 'active' ? await processDunning(rec) : await advanceRenewal(rec)
    } finally { busy.delete(rec.workspaceId) }
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
        if (rec.upcoming.addons) rec.addons = rec.upcoming.addons
        rec.upcoming = null
        dirty = true
      } catch { stale = true }
    }

    if (rec.mode === 'autopay' && rec.subscriptionId && !TERMINAL.has(rec.status)) {
      try { await refreshAutopay(rec); dirty = true } catch { stale = true }
    }
    if (rec.engine === 'token') {
      try { if (await advanceToken(rec)) dirty = true } catch { stale = true }
    } else if (rec.dunning?.state === 'active') {
      try { if (await processDunning(rec)) dirty = true } catch { stale = true }
    }
    // A one-off plan, or saved-card autopay that was switched off, simply ends with its period.
    if ((rec.mode === 'once' || (rec.engine === 'token' && !rec.renewal && rec.dunning?.state !== 'active')) && rec.status === 'active' && rec.currentEnd && rec.currentEnd < now()) {
      rec.status = 'expired'
      dirty = true
    }
    if (dirty) { rec.updatedAt = now(); await store.put(rec) }

    const c = chargeOf(rec.plan, rec.period, rec, rec.addons)
    const d = rec.dunning
    const status = d?.state === 'active' ? 'past_due' : rec.status
    const ending = rec.mode === 'once' || rec.cancelAtCycleEnd
    const live = ['active', 'authenticated', 'pending', 'past_due'].includes(status)
    const latest = rec.invoices?.[0]
    const openLink = d?.engine === 'token' ? { linkUrl: d.linkUrl } : d?.attempts.slice().reverse().find((a) => a.result === 'sent')
    const token = rec.engine === 'token'
    const rn = rec.renewal
    return {
      configured: true,
      stale,
      status,
      plan: rec.plan,
      planName: PLAN_CATALOG[rec.plan].name,
      period: rec.period,
      mode: rec.mode,
      charge: { base: c.base, gst: c.gst, total: c.total, gstPercent, tax: c.tax },
      addons: addonLines(rec.addons, rec.period),
      currentStart: rec.currentStart ?? null,
      currentEnd: rec.currentEnd ?? null,
      nextChargeAt: ending || status === 'past_due' ? null : (token ? (rn?.dueAt ?? null) : (rec.nextChargeAt ?? rec.currentEnd ?? null)),
      endsAt: ending && !['cancelled', 'suspended'].includes(status) ? (rec.currentEnd ?? null) : null,
      autopay: {
        on: rec.mode === 'autopay' && !rec.cancelAtCycleEnd && live,
        requiresApproval: token ? false : needsApprovalEachCycle(c),
        approvalLimit: AFA_LIMIT_RUPEES,
        lapsed: Boolean(rec.autopayLapsed),
        engine: rec.engine ?? 'subscription',
        canUpdateCard: Boolean(token && rec.mandate && rec.renewal),
        card: token && rec.mandate ? { last4: rec.mandate.last4 ?? null, network: rec.mandate.network ?? null } : null,
        next: token && rn && !rec.cancelAtCycleEnd ? (() => {
          const nc = chargeOf(rn.plan, rn.period, rec, rn.addons)
          return { plan: rn.plan, planName: PLAN_CATALOG[rn.plan].name, period: rn.period, total: nc.total, dueAt: rn.dueAt, noticeSent: Boolean(rn.orderId), changed: rn.plan !== rec.plan || rn.period !== rec.period, addons: addonLines(rn.addons, rn.period) }
        })() : null,
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
        engine: d.engine ?? 'subscription',
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
    const { plan, period, mode, startAtCycleEnd, consent, addons: addonsIn } = (req.body ?? {}) as Record<string, unknown>
    if (!isPlanId(plan) || !isPeriod(period) || (mode !== 'once' && mode !== 'autopay')) {
      return err(400, 'invalid_request', 'plan, period and mode are required.')
    }
    const sel = normalizeAddons(addonsIn, plan)
    if (!sel.ok) return err(400, 'invalid_addons', sel.message)
    const addons = sel.addons
    const rec = (await store.get(req.workspaceId)) ?? blank(req.workspaceId)
    // No payment starts without knowing who is being billed (GST invoice, bank notices).
    if (!rec.profile) return err(409, 'billing_details_required', 'Add your billing details before paying.')
    // A recurring mandate needs the customer's explicit, recorded agreement.
    if (mode === 'autopay' && consent !== true) return err(409, 'consent_required', 'Please confirm that you authorise the recurring charges.')
    const c = chargeOf(plan, period, rec, addons)
    const description = `SmatBot ${PLAN_CATALOG[plan].name}${addons.length ? ' + add-ons' : ''} · ${period} (incl. ${gstPercent}% GST)`
    const base = { keyId, amount: c.totalPaise, currency: 'INR', description, plan, period }

    if (mode === 'once') {
      const order = await rz!.request<RzEntity>('POST', '/orders', {
        amount: c.totalPaise,
        currency: 'INR',
        receipt: `${req.workspaceId}-${now()}`.slice(0, 40),
        notes: notesFor(rec, plan, period, addons),
      })
      rec.pending = { mode: 'once', plan, period, addons, orderId: order.id, createdAt: now() }
      rec.updatedAt = now()
      await store.put(rec)
      return reply(200, { ...base, mode, orderId: order.id })
    }

    // autopay on a saved card (RBI card-on-file): works without Subscriptions, charges up to ₹15,000
    if (useToken(c)) {
      if (c.total > AFA_LIMIT_RUPEES) return err(409, 'autopay_limit', `Card autopay is limited to ₹${AFA_LIMIT_RUPEES.toLocaleString('en-IN')} per charge. Pay once, or pick a monthly plan.`)
      const authOnly = startAtCycleEnd === true
      if (authOnly && (!rec.currentEnd || rec.currentEnd <= now() + 60)) return err(409, 'no_current_period', 'There is no running plan to continue from.')
      const customerId = await ensureCustomer(rec)
      const amount = authOnly ? 100 : c.totalPaise          // turning autopay on mid-plan: a ₹1 card check, refunded
      const order = await rz!.request<RzEntity>('POST', '/orders', {
        amount, currency: 'INR', receipt: `${req.workspaceId}-${now()}`.slice(0, 40), customer_id: customerId, method: 'card',
        token: { max_amount: TOKEN_MAX_PAISE, expire_at: now() + 10 * 365 * 86400, frequency: 'as_presented' },
        notes: notesFor(rec, plan, period, addons),
      })
      rec.pending = {
        mode: 'autopay', engine: 'token', authOnly, plan, period, addons, orderId: order.id, startAt: authOnly ? rec.currentEnd ?? undefined : undefined, createdAt: now(),
        consent: { version: CONSENT_VERSION, at: now(), ip: req.ip, userAgent: req.userAgent, plan, period, amountPaise: c.totalPaise, orderId: order.id },
      }
      rec.updatedAt = now()
      await store.put(rec)
      return reply(200, { ...base, amount, mode, engine: 'token', orderId: order.id, customerId, recurring: true, authOnly, startsAt: authOnly ? rec.currentEnd : null })
    }

    // autopay on a Razorpay Subscription
    const planId = await ensureRazorpayPlan(plan, period, addons)
    const body: Record<string, unknown> = {
      plan_id: planId,
      total_count: totalCount(period),
      customer_notify: 1,
      notes: notesFor(rec, plan, period, addons),
    }
    let startAt: number | undefined
    if (startAtCycleEnd === true) {
      if (!rec.currentEnd || rec.currentEnd <= now() + 60) return err(409, 'no_current_period', 'There is no running plan to continue from.')
      startAt = rec.currentEnd
      body.start_at = startAt
    }
    const sub = await rz!.request<RzEntity>('POST', '/subscriptions', body)
    rec.pending = {
      mode: 'autopay', plan, period, addons, subscriptionId: sub.id, startAt, createdAt: now(),
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
    const signedPayload = pend.mode === 'once' || pend.engine === 'token' ? `${pend.orderId}|${paymentId}` : `${paymentId}|${pend.subscriptionId}`
    if (!rz!.verifySignature(signedPayload, signature)) {
      return err(400, 'invalid_signature', 'The payment signature did not match, so it was not applied.')
    }

    if (pend.updateCard) return verifyCardUpdate(rec, pend, paymentId)
    const payment = await rz!.request<RzEntity>('GET', `/payments/${paymentId}`).catch(() => null)
    const c = chargeOf(pend.plan, pend.period, rec, pend.addons)

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
      rec.dunning = null; rec.autopayLapsed = false; rec.addons = pend.addons ?? []
      if (rec.engine === 'token') await dropMandate(rec)
      rec.engine = undefined
      rec.currentStart = start; rec.currentEnd = addPeriod(start, pend.period); rec.nextChargeAt = null
      rec.paymentMethod = methodOf(p)
      await recordPayment(rec, {
        paymentId, orderId: pend.orderId, plan: pend.plan, period: pend.period, amountPaise: c.totalPaise, addons: pend.addons, method: p.method,
        periodStart: rec.currentStart, periodEnd: rec.currentEnd, kind: 'purchase',
      })
    } else if (pend.engine === 'token') {
      // The card was authorised by a real payment. Confirm it with Razorpay before trusting it.
      let p = payment
      if (!p) return err(502, 'payment_lookup_failed', 'Could not confirm the payment with Razorpay. Nothing was applied — try again in a moment.')
      if (p.order_id !== pend.orderId) return err(400, 'order_mismatch', 'That payment belongs to a different order.')
      const expected = pend.authOnly ? 100 : c.totalPaise
      if (p.status === 'authorized') p = await rz!.request<RzEntity>('POST', `/payments/${paymentId}/capture`, { amount: expected, currency: 'INR' })
      if (p.status !== 'captured') return err(402, 'payment_not_captured', `Payment status is "${p.status}".`)
      if (p.amount !== expected) return err(400, 'amount_mismatch', 'The amount paid does not match.')
      const tokenId = p.token_id as string | undefined
      const customerId = (p.customer_id as string | undefined) ?? rec.customerId
      if (!tokenId || !customerId) return err(502, 'card_not_saved', 'The card was charged but could not be saved for autopay. Contact support.')
      const tok = await rz!.request<RzEntity>('GET', `/customers/${customerId}/tokens/${tokenId}`).catch(() => null)
      if (tok?.recurring_details?.status === 'rejected') return err(402, 'card_rejected', 'Your bank did not allow this card for autopay.')

      // Whatever autopay was running before is replaced.
      const wasSubscription = rec.mode === 'autopay' && rec.engine !== 'token' && rec.subscriptionId && !TERMINAL.has(rec.status)
      if (rec.engine === 'token') await dropMandate(rec)
      if (wasSubscription) await rz!.request('POST', `/subscriptions/${rec.subscriptionId}/cancel`, { cancel_at_cycle_end: pend.authOnly ? 1 : 0 }).catch(() => undefined)
      if (rec.dunning?.state === 'active') await stopLink(rec.dunning.linkId)
      rec.engine = 'token'; rec.mode = 'autopay'; rec.customerId = customerId
      rec.mandate = { id: tokenId, customerId, status: tok?.recurring_details?.status ?? 'confirmed', last4: p.card?.last4 ?? tok?.card?.last4, network: p.card?.network ?? tok?.card?.network, maxAmountPaise: TOKEN_MAX_PAISE, expireAt: now() + 10 * 365 * 86400 }
      rec.paymentMethod = methodOf(p) ?? rec.paymentMethod
      rec.upcoming = null; rec.subscriptionId = undefined; rec.cancelAtCycleEnd = false; rec.scheduledChange = null
      rec.dunning = null; rec.autopayLapsed = false

      if (pend.authOnly) {
        await rz!.request('POST', `/payments/${paymentId}/refund`, { amount: 100 }).catch(() => undefined)
        rec.renewal = { plan: pend.plan, period: pend.period, addons: pend.addons, dueAt: rec.currentEnd ?? now() }
      } else {
        const start = now()
        rec.plan = pend.plan; rec.period = pend.period; rec.addons = pend.addons ?? []; rec.status = 'active'
        rec.currentStart = start; rec.currentEnd = addPeriod(start, pend.period); rec.nextChargeAt = rec.currentEnd
        rec.paidCount = (rec.paidCount ?? 0) + 1
        rec.renewal = { plan: pend.plan, period: pend.period, addons: pend.addons, dueAt: rec.currentEnd }
        await recordPayment(rec, {
          paymentId, orderId: pend.orderId, plan: pend.plan, period: pend.period, amountPaise: c.totalPaise, addons: pend.addons, method: p.method,
          periodStart: start, periodEnd: rec.currentEnd, kind: 'purchase',
        })
      }
    } else {
      const sub = await rz!.request<RzEntity>('GET', `/subscriptions/${pend.subscriptionId}`)
      if (pend.startAt) {
        // Authorised now, bills when the current period ends.
        rec.upcoming = { subscriptionId: sub.id, plan: pend.plan, period: pend.period, addons: pend.addons, startsAt: pend.startAt }
        rec.cancelAtCycleEnd = true      // the running plan stops; the queued one continues it
        rec.paymentMethod = methodOf(payment) ?? rec.paymentMethod
        // Don't leave the old autopay running alongside the new one.
        if (rec.subscriptionId && rec.mode === 'autopay' && !TERMINAL.has(rec.status)) {
          await rz!.request('POST', `/subscriptions/${rec.subscriptionId}/cancel`, { cancel_at_cycle_end: 1 }).catch(() => undefined)
        }
      } else {
        await applySubscription(rec, sub)
        rec.cancelAtCycleEnd = false; rec.scheduledChange = null; rec.upcoming = null; rec.addons = pend.addons ?? []
        rec.dunning = null; rec.autopayLapsed = false
        rec.paymentMethod = methodOf(payment)
        // The first debit is charged with the authorisation; invoice it as soon as it's captured.
        if (payment?.status === 'captured') {
          const start = sub.current_start ?? now()
          await recordPayment(rec, {
            paymentId, subscriptionId: sub.id, plan: pend.plan, period: pend.period, amountPaise: c.totalPaise, addons: pend.addons, method: payment.method,
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
    if (rec?.engine === 'token' && rec.mandate && rec.renewal && rec.plan && rec.period) {
      // Saved-card autopay: the change takes effect at the next renewal.
      const r = rec.renewal
      if (r.plan === plan && r.period === period) return err(409, 'same_plan', 'That is already your plan.')
      if (rec.dunning?.state === 'active') return err(409, 'not_changeable', 'Fix the payment issue on your current plan before changing it.')
      if (r.orderId) return err(409, 'notice_sent', 'Your next renewal notice has already been sent, so it can no longer be changed. Change your plan after it renews.')
      const kept = eligibleAddons(r.addons, plan)
      const dropped = (r.addons ?? []).length - kept.length
      const next = chargeOf(plan, period, rec, kept)
      if (next.total > AFA_LIMIT_RUPEES) return err(409, 'autopay_limit', `Card autopay is limited to ₹${AFA_LIMIT_RUPEES.toLocaleString('en-IN')} per charge, so this plan can only be paid once.`)
      rec.renewal = { ...r, plan, period, addons: kept }
      rec.scheduledChange = plan === rec.plan && period === rec.period && !dropped ? null : { plan, period, at: r.dueAt, addons: kept }
      rec.updatedAt = now()
      await store.put(rec)
      return reply(200, { ...(await summarize(rec) as object), appliedNow: false, droppedAddons: dropped })
    }
    if (!rec || rec.mode !== 'autopay' || !rec.subscriptionId || !rec.plan || !rec.period) {
      return err(409, 'no_autopay_subscription', 'Plan changes need an active autopay subscription.')
    }
    if (rec.plan === plan && rec.period === period) return err(409, 'same_plan', 'That is already your plan.')
    if (!['active', 'authenticated'].includes(rec.status) || rec.dunning?.state === 'active') {
      return err(409, 'not_changeable', 'Fix the payment issue on your current plan before changing it.')
    }

    const keptAddons = eligibleAddons(rec.addons, plan)
    const cur = chargeFor(rec.plan, rec.period, gstPercent, undefined, rec.addons)
    const next = chargeFor(plan, period, gstPercent, undefined, keptAddons)
    const upgrade = next.totalPaise > cur.totalPaise
    try {
      const planId = await ensureRazorpayPlan(plan, period, keptAddons)
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
      rec.plan = plan; rec.period = period; rec.addons = keptAddons
    } else {
      rec.scheduledChange = { plan, period, at: rec.currentEnd ?? now(), addons: keptAddons }
    }
    rec.updatedAt = now()
    await store.put(rec)
    return reply(200, { ...(await summarize(rec) as object), appliedNow: upgrade })
  }

  /* ── replace the saved card ───────────────────────────────────────────── */
  async function cardUpdateCheckout(req: BillingRequest): Promise<BillingResponse> {
    const rec = await store.get(req.workspaceId)
    if (!rec || rec.engine !== 'token' || !rec.mandate || !rec.renewal || !rec.profile) {
      return err(409, 'no_card_autopay', 'There is no saved card to replace. Turn autopay on instead.')
    }
    const r = rec.renewal
    const c = chargeOf(r.plan, r.period, rec, r.addons)
    const customerId = await ensureCustomer(rec)
    const order = await rz!.request<RzEntity>('POST', '/orders', {
      amount: 100, currency: 'INR', receipt: `${req.workspaceId}-c${now()}`.slice(0, 40), customer_id: customerId, method: 'card',
      token: { max_amount: TOKEN_MAX_PAISE, expire_at: now() + 10 * 365 * 86400, frequency: 'as_presented' },
      notes: { workspaceId: rec.workspaceId, purpose: 'replace card' },
    })
    rec.pending = {
      mode: 'autopay', engine: 'token', updateCard: true, authOnly: true, plan: r.plan, period: r.period, addons: r.addons, orderId: order.id, createdAt: now(),
      consent: { version: CONSENT_VERSION, at: now(), ip: req.ip, userAgent: req.userAgent, plan: r.plan, period: r.period, amountPaise: c.totalPaise, orderId: order.id },
    }
    rec.updatedAt = now()
    await store.put(rec)
    return reply(200, {
      keyId, amount: 100, currency: 'INR', description: 'SmatBot · change payment card', mode: 'autopay', engine: 'token',
      orderId: order.id, customerId, recurring: true, authOnly: true, updateCard: true, plan: r.plan, period: r.period,
    })
  }

  async function verifyCardUpdate(rec: BillingRecord, pend: NonNullable<BillingRecord['pending']>, paymentId: string): Promise<BillingResponse> {
    let p = await rz!.request<RzEntity>('GET', `/payments/${paymentId}`).catch(() => null)
    if (!p) return err(502, 'payment_lookup_failed', 'Could not confirm the card with Razorpay. Nothing was changed — try again in a moment.')
    if (p.order_id !== pend.orderId) return err(400, 'order_mismatch', 'That payment belongs to a different order.')
    if (p.status === 'authorized') p = await rz!.request<RzEntity>('POST', `/payments/${paymentId}/capture`, { amount: 100, currency: 'INR' })
    if (p.status !== 'captured' || p.amount !== 100) return err(402, 'payment_not_captured', `Card check status is "${p.status}".`)
    const tokenId = p.token_id as string | undefined
    const customerId = (p.customer_id as string | undefined) ?? rec.customerId
    if (!tokenId || !customerId) return err(502, 'card_not_saved', 'The card could not be saved for autopay. Your old card is unchanged.')
    const tok = await rz!.request<RzEntity>('GET', `/customers/${customerId}/tokens/${tokenId}`).catch(() => null)
    if (tok?.recurring_details?.status === 'rejected') return err(402, 'card_rejected', 'Your bank did not allow this card for autopay. Your old card is unchanged.')
    // The ₹1 check is returned either way.
    await rz!.request('POST', `/payments/${paymentId}/refund`, { amount: 100 }).catch(() => undefined)
    if (rec.engine !== 'token' || !rec.mandate || !rec.renewal) {
      rec.pending = null; await store.put(rec)
      return err(409, 'autopay_off', 'Autopay was turned off meanwhile, so the new card was not saved.')
    }
    const old = rec.mandate
    rec.mandate = { id: tokenId, customerId, status: tok?.recurring_details?.status ?? 'confirmed', last4: p.card?.last4 ?? tok?.card?.last4, network: p.card?.network ?? tok?.card?.network, maxAmountPaise: TOKEN_MAX_PAISE, expireAt: now() + 10 * 365 * 86400 }
    rec.customerId = customerId
    rec.paymentMethod = methodOf(p) ?? rec.paymentMethod
    await rz!.request('DELETE', `/customers/${old.customerId}/tokens/${old.id}`).catch(() => undefined)
    // Notices already sent were for the old card: send them again for the new one.
    if (rec.renewal && !rec.renewal.paymentId) { rec.renewal.orderId = undefined; rec.renewal.payAfter = undefined }
    const d = rec.dunning
    if (d?.state === 'active' && !d.attempts.some((a) => a.result === 'pending')) await scheduleRetry(rec, d)
    if (pend.consent) rec.consents = [pend.consent, ...(rec.consents ?? [])]
    rec.pending = null
    rec.updatedAt = now()
    await store.put(rec)
    return reply(200, await summarize(rec))
  }

  async function setAutopay(req: BillingRequest): Promise<BillingResponse> {
    const rec = await store.get(req.workspaceId)
    if (!rec) return err(409, 'no_subscription', 'There is no plan to change.')
    const enabled = (req.body as Record<string, unknown> | undefined)?.enabled
    if (enabled !== false) return err(400, 'invalid_request', 'Turn autopay on by starting a new autopay checkout.')

    if (rec.engine === 'token' && rec.mandate) {
      await dropMandate(rec)
      rec.cancelAtCycleEnd = true; rec.scheduledChange = null; rec.updatedAt = now()
      await store.put(rec)
    } else if (rec.mode === 'autopay' && rec.subscriptionId && !TERMINAL.has(rec.status) && !rec.cancelAtCycleEnd) {
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
    const filled = await backfillInvoices(rec)
    if (reissueDrafts(rec) || filled) { rec.updatedAt = now(); await store.put(rec) }
    const items = (rec.invoices ?? []).map((i) => ({
      id: i.id, number: i.number, date: i.issuedAt, amountPaise: i.amountPaise, status: 'paid',
      description: `${PLAN_CATALOG[i.plan].name} plan · ${i.period}${i.kind === 'renewal' ? ' · renewal' : i.kind === 'dunning_recovery' ? ' · renewal (recovered)' : ''}`,
      url: `/api/billing/invoices/${i.id}/view`, paymentId: i.paymentId,
    }))
    return reply(200, { items })
  }

  /* Invoices issued while the supplier details were still placeholders (no GSTIN) are
     re-issued under the same number with the real details — they were never valid anyway. */
  function reissueDrafts(rec: BillingRecord): boolean {
    if (!seller.gstin || !rec.profile) return false
    let changed = false
    rec.invoices = (rec.invoices ?? []).map((inv) => {
      if (inv.seller.gstin) return inv
      changed = true
      return buildInvoice({
        seller, buyer: inv.buyer, number: inv.number, issuedAt: inv.issuedAt, paymentId: inv.paymentId, orderId: inv.orderId,
        subscriptionId: inv.subscriptionId, plan: inv.plan, period: inv.period, periodStart: inv.periodStart, periodEnd: inv.periodEnd,
        gstPercent, amountPaise: inv.amountPaise, method: inv.method, kind: inv.kind,
      })
    })
    return changed
  }

  async function invoiceView(req: BillingRequest, id: string): Promise<BillingResponse> {
    const rec = await store.get(req.workspaceId)
    if (rec && reissueDrafts(rec)) { rec.updatedAt = now(); await store.put(rec) }
    const inv = rec?.invoices?.find((i) => i.id === id)
    if (!inv) return err(404, 'not_found', 'No such invoice.')
    return { status: 200, body: renderInvoiceHtml(inv, seller), contentType: 'text/html; charset=utf-8' }
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
      if (rec && d?.state === 'active' && paymentId && (d.linkId === link.id || d.attempts.some((a) => a.linkId === link.id))) {
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
    const seen = new Set<string>()
    for (const rec of [...(await store.listActiveDunning()), ...(await store.listTokenAutopay())]) {
      if (seen.has(rec.workspaceId)) continue
      seen.add(rec.workspaceId)
      try {
        if (rec.engine === 'token') await advanceToken(rec)
        else {
          if (rec.mode === 'autopay' && rec.subscriptionId && !TERMINAL.has(rec.status)) await refreshAutopay(rec)
          await processDunning(rec)
        }
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
    const { plan, period, addons: addonsIn } = (req.body ?? {}) as Record<string, unknown>
    if (!isPlanId(plan) || !isPeriod(period)) return err(400, 'invalid_request', 'plan and period are required.')
    const sel = normalizeAddons(addonsIn, plan)
    if (!sel.ok) return err(400, 'invalid_addons', sel.message)
    const rec = await store.get(req.workspaceId)
    const c = chargeOf(plan, period, rec, sel.addons)
    return reply(200, { plan, planName: PLAN_CATALOG[plan].name, period, charge: c, planBase: PLAN_CATALOG[plan][period], addons: addonLines(sel.addons, period), requiresApproval: needsApprovalEachCycle(c), approvalLimit: AFA_LIMIT_RUPEES })
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
        states: STATES, supplierStateCode: supplier, autopayEngine: engineMode,
        addons: ADDON_CATALOG,
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
        case 'POST /payment-method': return await cardUpdateCheckout(req)
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
