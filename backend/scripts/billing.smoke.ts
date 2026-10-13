// billing.smoke.ts — exercises the billing service against an in-memory fake of
// Razorpay (no network, no keys), so the subscription / autopay paths can be
// checked even when the real account doesn't have Subscriptions switched on.
//
//   cd backend && npx tsx scripts/billing.smoke.ts
import { createBillingService } from '../src/billing/service.js'
import { hmacHex, type Razorpay, type RzEntity } from '../src/billing/razorpay.js'
import { gstinCheckChar, gstinError, normalizeMobile } from '../src/billing/india.js'
import { DUNNING_POLICY, assertPolicy, attemptTimes } from '../src/billing/dunning.js'
import type { BillingRecord, BillingStore } from '../src/billing/types.js'

const SECRET = 'test_secret'
const WEBHOOK = 'whsec_test'
let failures = 0
const check = (name: string, ok: boolean, extra?: unknown) => {
  console.log(`${ok ? '  ok ' : ' FAIL'}  ${name}${ok || extra === undefined ? '' : '  → ' + JSON.stringify(extra)}`)
  if (!ok) failures++
}

/* ── a tiny fake Razorpay ─────────────────────────────────────────────── */
function fakeRazorpay(clock: () => number) {
  let n = 0
  const debits: { paymentId: string; orderId: string; amount: number }[] = []
  const deletedTokens: string[] = []
  const refunds: string[] = []
  const state = { debit: 'capture' as 'capture' | 'fail' }
  const plans = new Map<string, RzEntity>()
  const subs = new Map<string, RzEntity>()
  const orders = new Map<string, RzEntity>()
  const payments = new Map<string, RzEntity>()
  const calls: string[] = []
  const links = new Map<string, RzEntity>()
  const subInvoices = new Map<string, RzEntity[]>()
  const rz: Razorpay = {
    verifySignature: (payload, sig) => hmacHex(SECRET, payload) === sig,
    async request(method, path, body) {
      calls.push(`${method} ${path}`)
      const b = (body ?? {}) as RzEntity
      let m: RegExpMatchArray | null
      if (method === 'GET' && path.startsWith('/plans?')) return { items: [...plans.values()] } as never
      if (method === 'POST' && path === '/plans') { const p = { id: `plan_${++n}`, period: b.period, item: b.item, notes: b.notes }; plans.set(p.id, p); return p as never }
      if (method === 'GET' && (m = path.match(/^\/plans\/(.+)$/))) return plans.get(m[1]!) as never
      if (method === 'POST' && path === '/orders') { const o = { id: `order_${++n}`, ...b }; orders.set(o.id, o); return o as never }
      if (method === 'GET' && (m = path.match(/^\/payments\/(.+)$/))) return payments.get(m[1]!) as never
      if (method === 'POST' && path === '/subscriptions') {
        const s = { id: `sub_${++n}`, plan_id: b.plan_id, status: 'created', paid_count: 0, remaining_count: b.total_count, has_scheduled_changes: false, start_at: b.start_at }
        subs.set(s.id, s); return s as never
      }
      if (method === 'GET' && (m = path.match(/^\/subscriptions\/([^/]+)$/))) return subs.get(m[1]!) as never
      if (method === 'PATCH' && (m = path.match(/^\/subscriptions\/([^/]+)$/))) {
        const s = subs.get(m[1]!)!
        if (b.schedule_change_at === 'now') s.plan_id = b.plan_id
        else s.has_scheduled_changes = true
        return s as never
      }
      if (method === 'POST' && (m = path.match(/^\/subscriptions\/([^/]+)\/cancel$/))) { const s = subs.get(m[1]!)!; if (!b.cancel_at_cycle_end) s.status = 'cancelled'; return s as never }
      if (method === 'GET' && path.startsWith('/invoices')) return { items: subInvoices.get(new URL('http://x' + path).searchParams.get('subscription_id') ?? '') ?? [] } as never
      if (method === 'POST' && path === '/payment_links') {
        const l = { id: `plink_${++n}`, short_url: `https://rzp.io/i/${n}`, status: 'created', amount: b.amount, notify: b.notify, description: b.description, expire_by: b.expire_by, notes: b.notes, customer: b.customer, payments: null as unknown }
        links.set(l.id, l); return l as never
      }
      if (method === 'GET' && (m = path.match(/^\/payment_links\/([^/]+)$/))) return links.get(m[1]!) as never
      if (method === 'POST' && (m = path.match(/^\/payment_links\/([^/]+)\/cancel$/))) { const l = links.get(m[1]!)!; l.status = 'cancelled'; return l as never }
      if (method === 'POST' && path === '/customers') return { id: `cust_${++n}` } as never
      if (method === 'GET' && (m = path.match(/^\/customers\/[^/]+\/tokens\/(.+)$/))) return { id: m[1], recurring_details: { status: 'confirmed' }, card: { last4: '5449', network: 'MasterCard' } } as never
      if (method === 'DELETE' && (m = path.match(/^\/customers\/[^/]+\/tokens\/(.+)$/))) { deletedTokens.push(m[1]!); return {} as never }
      if (method === 'POST' && (m = path.match(/^\/payments\/([^/]+)\/capture$/))) { const p = payments.get(m[1]!)!; p.status = 'captured'; return p as never }
      if (method === 'POST' && (m = path.match(/^\/payments\/([^/]+)\/refund$/))) { refunds.push(m[1]!); return {} as never }
      if (method === 'POST' && path === '/payments/create/recurring') {
        const o = orders.get(b.order_id)
        // Razorpay refuses a debit until the pre-debit notice period has passed.
        if (!o?.notification || clock() < o.notification.payment_after) throw new Error('pre_debit_notification_failed')
        if (b.amount !== o.amount || !b.token || !b.customer_id) throw new Error('bad debit request')
        const id = `pay_${++n}`
        payments.set(id, state.debit === 'capture'
          ? { id, order_id: b.order_id, status: 'captured', amount: b.amount, method: 'card', card: { last4: '5449', network: 'MasterCard' }, created_at: clock() }
          : { id, order_id: b.order_id, status: 'failed', amount: b.amount, method: 'card', error_description: 'Insufficient funds' })
        debits.push({ paymentId: id, orderId: b.order_id, amount: b.amount })
        return { razorpay_payment_id: id, razorpay_order_id: b.order_id } as never
      }
      throw new Error(`fake razorpay: unhandled ${method} ${path}`)
    },
  }
  return {
    rz, subs, calls, links, subInvoices, orders, debits, deletedTokens, refunds, state,
    pay(orderId: string | undefined, amount: number, extra: RzEntity = {}) {
      const id = `pay_${++n}`
      payments.set(id, { id, order_id: orderId, status: 'captured', amount, method: 'card', card: { last4: '1111', network: 'Visa' }, ...extra })
      return id
    },
  }
}

function memoryStore(): BillingStore {
  const all = new Map<string, BillingRecord>()
  const counters: Record<string, number> = {}
  return {
    async get(w) { return structuredClone(all.get(w) ?? null) },
    async put(r) { all.set(r.workspaceId, structuredClone(r)) },
    async findBySubscription(id) { return [...all.values()].find((r) => r.subscriptionId === id || r.upcoming?.subscriptionId === id) ?? null },
    async listActiveDunning() { return [...all.values()].filter((r) => r.dunning?.state === 'active').map((r) => structuredClone(r)) },
    async listTokenAutopay() { return [...all.values()].filter((r) => r.engine === 'token' && r.mandate && r.renewal).map((r) => structuredClone(r)) },
    async list() { return [...all.values()].map((r) => structuredClone(r)) },
    async nextSequence(key) { counters[key] = (counters[key] ?? 0) + 1; return counters[key]! },
  }
}

async function main() {
  let t = 1_800_000_000
  const fake = fakeRazorpay(() => t)
  const store = memoryStore()
  const svc = createBillingService({ store, razorpay: fake.rz, keyId: 'rzp_test_x', webhookSecret: WEBHOOK, gstPercent: 18, supplierStateCode: '27', autopayEngine: 'subscription', now: () => t })
  const call = (method: string, path: string, body?: Record<string, unknown>, ws = 'ws1', extra: Partial<Parameters<typeof svc.handle>[0]> = {}) =>
    svc.handle({ method, path, body, headers: {}, workspaceId: ws, ip: '203.0.113.9', userAgent: 'smoke-test', ...extra })
  const sign = (a: string, b: string) => hmacHex(SECRET, `${a}|${b}`)

  console.log('\nconfig + empty state')
  let r = await call('GET', '/config')
  check('config exposes key id but no secret', (r.body as RzEntity).keyId === 'rzp_test_x' && !JSON.stringify(r.body).includes(SECRET))
  r = await call('GET', '/subscription')
  check('no subscription yet', (r.body as RzEntity).status === 'none')

  console.log('\nindia validators')
  check('known-good GSTIN passes', gstinError('27AAPFU0939F1ZV') === null, gstinError('27AAPFU0939F1ZV'))
  check('GSTIN with a wrong check character fails', gstinError('27AAPFU0939F1ZX') !== null)
  check('GSTIN check char is computed', gstinCheckChar('27AAPFU0939F1Z') === 'V')
  check('mobile numbers normalise', normalizeMobile('+91 98765 43210') === '9876543210' && normalizeMobile('12345') === null)

  console.log('\nbilling details gate')
  r = await call('POST', '/checkout', { plan: 'pro', period: 'monthly', mode: 'once' })
  check('checkout refused until billing details exist', r.status === 409 && (r.body as RzEntity).error === 'billing_details_required', r.body)
  const good = { legalName: 'Acme Retail Pvt Ltd', contactName: 'Asha Rao', email: 'Asha@Acme.in', phone: '98765 43210', gstin: '27AAPFU0939F1ZV',
    address: { line1: '12 MG Road', line2: '', city: 'Mumbai', stateCode: '27', pincode: '400001' } }
  r = await call('PUT', '/profile', { ...good, email: 'nope', address: { ...good.address, pincode: '12' } })
  check('bad email and PIN rejected with field messages', r.status === 422 && !!(r.body as RzEntity).fields.email && !!(r.body as RzEntity).fields['address.pincode'], r.body)
  r = await call('PUT', '/profile', { ...good, address: { ...good.address, stateCode: '29' } })
  check('GSTIN state must match the billing state', r.status === 422 && !!(r.body as RzEntity).fields['address.stateCode'], r.body)
  r = await call('PUT', '/profile', good)
  check('valid profile saved and normalised', r.status === 200 && (r.body as RzEntity).profile.phone === '9876543210' && (r.body as RzEntity).profile.email === 'asha@acme.in', r.body)
  r = await call('POST', '/quote', { plan: 'pro', period: 'yearly' })
  let q = (r.body as RzEntity).charge
  check('same-state customer is split CGST + SGST', q.tax.kind === 'intra' && q.tax.cgst === 6480 && q.tax.sgst === 6480 && q.total === 84960, q.tax)
  await call('PUT', '/profile', { ...good, gstin: '', address: { ...good.address, stateCode: '29' } })
  q = ((await call('POST', '/quote', { plan: 'pro', period: 'yearly' })).body as RzEntity).charge
  check('other-state customer is charged IGST, same total', q.tax.kind === 'inter' && q.tax.igst === 12960 && q.total === 84960, q.tax)
  await call('PUT', '/profile', good)

  console.log('\nvalidation')
  r = await call('POST', '/checkout', { plan: 'gold', period: 'monthly', mode: 'once' })
  check('unknown plan rejected', r.status === 400)
  r = await call('POST', '/verify', { razorpay_payment_id: 'pay_x', razorpay_signature: 'x' })
  check('verify without a checkout rejected', r.status === 409)

  console.log('\none-time payment')
  r = await call('POST', '/checkout', { plan: 'pro', period: 'yearly', mode: 'once' })
  const co = r.body as RzEntity
  check('order amount is server-decided (₹72,000 + 18% GST)', co.amount === 8_496_000, co.amount)
  r = await call('POST', '/verify', { razorpay_payment_id: 'pay_1', razorpay_signature: 'forged' })
  check('forged signature rejected', r.status === 400 && (r.body as RzEntity).error === 'invalid_signature')
  const payShort = fake.pay(co.orderId, 1_000)           // wrong amount
  r = await call('POST', '/verify', { razorpay_payment_id: payShort, razorpay_signature: sign(co.orderId, payShort) })
  check('amount mismatch rejected', r.status === 400 && (r.body as RzEntity).error === 'amount_mismatch', r.body)
  const payOk = fake.pay(co.orderId, co.amount)
  r = await call('POST', '/verify', { razorpay_payment_id: payOk, razorpay_signature: sign(co.orderId, payOk) })
  let s = r.body as RzEntity
  check('valid payment activates the plan', r.status === 200 && s.status === 'active' && s.mode === 'once' && s.plan === 'pro', s)
  check('one-time plan has no autopay and ends after a year', s.autopay.on === false && s.endsAt === 1_800_000_000 + 365 * 86400, s.endsAt)
  check('card details kept for display', s.paymentMethod?.last4 === '1111')
  r = await call('GET', '/invoices')
  check('payment appears in invoices', (r.body as RzEntity).items.length === 1)

  console.log('\nautopay subscription')
  r = await call('POST', '/checkout', { plan: 'pro', period: 'monthly', mode: 'autopay' })
  check('autopay refused without explicit consent', r.status === 409 && (r.body as RzEntity).error === 'consent_required', r.body)
  r = await call('POST', '/checkout', { plan: 'pro', period: 'monthly', mode: 'autopay', consent: true })
  const sc = r.body as RzEntity
  check('subscription created with its own Razorpay plan', Boolean(sc.subscriptionId) && fake.calls.includes('POST /plans'))
  r = await call('POST', '/checkout', { plan: 'pro', period: 'monthly', mode: 'autopay', consent: true })
  check('second checkout reuses the Razorpay plan', fake.calls.filter((c) => c === 'POST /plans').length === 1)
  const sc2 = r.body as RzEntity
  const payAuto = fake.pay(undefined, sc2.amount)
  fake.subs.get(sc2.subscriptionId)!.status = 'active'
  Object.assign(fake.subs.get(sc2.subscriptionId)!, { current_start: t, current_end: t + 30 * 86400, charge_at: t + 30 * 86400, paid_count: 1 })
  r = await call('POST', '/verify', { razorpay_payment_id: payAuto, razorpay_signature: sign(payAuto, sc2.subscriptionId) })
  s = r.body as RzEntity
  check('autopay verified and active', s.status === 'active' && s.mode === 'autopay' && s.autopay.on === true, s)
  check('monthly Pro (₹7,670) renews without approval', s.autopay.requiresApproval === false)
  check('next charge date known', s.nextChargeAt === t + 30 * 86400)
  const consent = (await store.get('ws1'))?.consents?.[0]
  check('consent recorded with amount, time and origin', consent?.amountPaise === 767000 && consent?.ip === '203.0.113.9' && consent?.userAgent === 'smoke-test' && consent?.version === 'recurring-v1', consent)

  console.log('\nplan changes')
  r = await call('POST', '/change-plan', { plan: 'ai', period: 'monthly' })
  s = r.body as RzEntity
  check('upgrade applies immediately', r.status === 200 && s.appliedNow === true && s.plan === 'ai', s)
  r = await call('POST', '/change-plan', { plan: 'standard', period: 'monthly' })
  s = r.body as RzEntity
  check('downgrade is scheduled for the end of the cycle', r.status === 200 && s.appliedNow === false && s.scheduledChange?.plan === 'standard', s)
  r = await call('POST', '/change-plan', { plan: 'standard', period: 'monthly' }, 'ws-none')
  check('plan change without a subscription rejected', r.status === 409)

  console.log('\nautopay off')
  r = await call('POST', '/autopay', { enabled: false })
  s = r.body as RzEntity
  check('autopay off keeps the plan until the cycle ends', s.autopay.on === false && s.endsAt === t + 30 * 86400 && s.status === 'active', s)
  check('Razorpay told to cancel at cycle end', fake.calls.some((c) => c.endsWith('/cancel')))

  console.log('\nturn autopay back on at renewal')
  r = await call('POST', '/checkout', { plan: 'pro', period: 'yearly', mode: 'autopay', consent: true, startAtCycleEnd: true })
  const up = r.body as RzEntity
  check('new subscription starts at the current period end', up.startsAt === t + 30 * 86400, up)
  const payUp = fake.pay(undefined, up.amount)
  fake.subs.get(up.subscriptionId)!.status = 'authenticated'
  r = await call('POST', '/verify', { razorpay_payment_id: payUp, razorpay_signature: sign(payUp, up.subscriptionId) })
  s = r.body as RzEntity
  check('queued plan shown as upcoming', s.upcoming?.plan === 'pro' && s.upcoming?.period === 'yearly', s.upcoming)
  t += 31 * 86400
  const queued = fake.subs.get(up.subscriptionId)!
  Object.assign(queued, { status: 'active', current_start: t, current_end: t + 365 * 86400, charge_at: t + 365 * 86400, paid_count: 1 })
  s = (await call('GET', '/subscription')).body as RzEntity
  check('queued plan takes over once the old period ends', s.plan === 'pro' && s.period === 'yearly' && s.upcoming === null && s.autopay.on === true, s)
  check('yearly Pro flagged: every renewal needs approval', s.autopay.requiresApproval === true)

  console.log('\nwebhook')
  const body = JSON.stringify({ event: 'subscription.halted', payload: { subscription: { entity: { id: up.subscriptionId, status: 'halted', plan_id: queued.plan_id, paid_count: 1 } } } })
  r = await call('POST', '/webhook', JSON.parse(body), 'ws1', { rawBody: Buffer.from(body), headers: { 'x-razorpay-signature': 'nope' } })
  check('bad webhook signature rejected', r.status === 400)
  r = await call('POST', '/webhook', JSON.parse(body), 'ws1', { rawBody: Buffer.from(body), headers: { 'x-razorpay-signature': hmacHex(WEBHOOK, body) } })
  check('good webhook accepted', r.status === 200)
  s = (await call('GET', '/subscription')).body as RzEntity
  fake.subs.get(up.subscriptionId)!.status = 'halted'
  s = (await call('GET', '/subscription')).body as RzEntity
  check('a halted subscription starts dunning instead of cutting the plan off', s.status === 'past_due' && s.dunning?.attempt === 1 && s.dunning?.maxAttempts === 4, s)

  /* ── invoices ──────────────────────────────────────────────────────────── */
  console.log('\ninvoices')
  const buyOnce = async (ws: string, profile: Record<string, unknown>) => {
    await call('PUT', '/profile', profile, ws)
    const co = (await call('POST', '/checkout', { plan: 'pro', period: 'monthly', mode: 'once' }, ws)).body as RzEntity
    const pay = fake.pay(co.orderId, co.amount)
    return (await call('POST', '/verify', { razorpay_payment_id: pay, razorpay_signature: sign(co.orderId, pay) }, ws)).body as RzEntity
  }
  let sum = await buyOnce('wi1', good)
  check('payment activates the plan and returns its invoice', sum.status === 'active' && !!sum.latestInvoice?.number, sum.latestInvoice)
  const inv1 = ((await call('GET', '/invoices', undefined, 'wi1')).body as RzEntity).items[0]
  check('invoice is numbered in the Indian financial-year series', /^SB\/\d{4}-\d{2}\/\d{6}$/.test(inv1.number), inv1.number)
  check('invoice is linked for download', inv1.url.endsWith('/view'), inv1.url)
  const view = await call('GET', `/invoices/${inv1.id}/view`, undefined, 'wi1')
  const html = String(view.body)
  check('invoice page is HTML with the GST split, buyer and SAC', view.contentType?.startsWith('text/html') === true && html.includes('CGST @ 9%') && html.includes('SGST @ 9%') && html.includes('Demo Retail') === false && html.includes('Acme Retail Pvt Ltd') && html.includes('998314') && html.includes('27AAPFU0939F1ZV'))
  check('amount on the invoice is ₹7,670.00 (₹6,500 + 18%)', html.includes('₹7,670.00') && html.includes('₹6,500.00'))
  r = await call('GET', '/invoices/SB-2000-01-999999/view', undefined, 'wi1')
  check('unknown invoice is a 404', r.status === 404)
  r = await call('GET', `/invoices/${inv1.id}/view`, undefined, 'someone-else')
  check("one workspace can't open another's invoice", r.status === 404)

  sum = await buyOnce('wi2', { ...good, legalName: '<img src=x onerror=alert(1)>', gstin: '', address: { ...good.address, stateCode: '29' } })
  const inv2 = ((await call('GET', '/invoices', undefined, 'wi2')).body as RzEntity).items[0]
  const html2 = String((await call('GET', `/invoices/${inv2.id}/view`, undefined, 'wi2')).body)
  check('customer-supplied text is escaped on the invoice', html2.includes('&lt;img') && !html2.includes('<img src=x'))
  check('other-state customer gets IGST', html2.includes('IGST @ 18%') && !html2.includes('CGST'))
  check('invoice numbers never repeat across customers', Number(inv2.number.slice(-6)) === Number(inv1.number.slice(-6)) + 1, [inv1.number, inv2.number])

  /* ── dunning ───────────────────────────────────────────────────────────── */
  console.log('\ndunning policy')
  check('default policy is 4 attempts, 9 days, 48–72h gaps', DUNNING_POLICY.maxAttempts === 4 && DUNNING_POLICY.windowDays === 9 && DUNNING_POLICY.retryAfterHours.every((h) => h >= 48 && h <= 72))
  const hrs = attemptTimes(0).map((x) => x / 3600)
  check('attempts fall on day 0, 2, 5 and 8', JSON.stringify(hrs) === JSON.stringify([0, 48, 120, 192]), hrs)
  const bad = (p: Parameters<typeof assertPolicy>[0]) => { try { assertPolicy(p); return false } catch { return true } }
  check('a 24h gap is rejected', bad({ maxAttempts: 4, windowDays: 9, retryAfterHours: [24, 72, 72] }))
  check('a 5th attempt is rejected', bad({ maxAttempts: 5, windowDays: 9, retryAfterHours: [48, 48, 48, 48] }))
  check('a window too short for the last attempt is rejected', bad({ maxAttempts: 4, windowDays: 5, retryAfterHours: [72, 72, 72] }))

  const activate = async (ws: string) => {
    await call('PUT', '/profile', good, ws)
    const co = (await call('POST', '/checkout', { plan: 'pro', period: 'monthly', mode: 'autopay', consent: true }, ws)).body as RzEntity
    const pay = fake.pay(undefined, co.amount)
    const sub = fake.subs.get(co.subscriptionId)!
    Object.assign(sub, { status: 'active', current_start: t, current_end: t + 30 * 86400, charge_at: t + 30 * 86400, paid_count: 1 })
    await call('POST', '/verify', { razorpay_payment_id: pay, razorpay_signature: sign(pay, co.subscriptionId) }, ws)
    return { sub, subId: co.subscriptionId as string }
  }
  const status = async (ws: string) => (await call('GET', '/subscription', undefined, ws)).body as RzEntity
  const HOUR = 3600

  console.log('\nfirst autopay charge is invoiced')
  const A = await activate('wd')
  let d = await status('wd')
  check('first charge produced an invoice', ((await call('GET', '/invoices', undefined, 'wd')).body as RzEntity).items.length === 1)

  console.log('\nfailed renewal → dunning → suspension')
  t += 30 * 86400
  A.sub.status = 'pending'
  const T0 = t
  d = await status('wd')
  check('failed renewal is past due, plan still works', d.status === 'past_due' && d.autopay.on === true, d.status)
  check('attempt 1 (the failed debit) is logged, 3 retries to come', d.dunning.attempt === 1 && d.dunning.attempts[0].kind === 'charge' && d.dunning.attempts[0].result === 'failed')
  check('next attempt is scheduled 48 hours out', d.dunning.nextAttemptAt === T0 + 48 * HOUR, d.dunning.nextAttemptAt - T0)
  check('window ends 9 days after the first failure', d.dunning.deadline === T0 + 9 * 86400)
  await svc.runDue()
  check('nothing is sent before the 48 hours are up', fake.links.size === 0)
  t = T0 + 47 * HOUR; await svc.runDue()
  check('still nothing at 47 hours', fake.links.size === 0)
  t = T0 + 48 * HOUR; await svc.runDue()
  d = await status('wd')
  const link2 = [...fake.links.values()][0]!
  check('attempt 2: a pay-now link is sent by email and SMS', d.dunning.attempt === 2 && d.dunning.attempts[1].kind === 'collection' && link2?.notify?.email === true && link2?.notify?.sms === true, d.dunning)
  check('the link is for the renewal amount (₹7,670) and expires with the window', link2.amount === 767000 && link2.expire_by === T0 + 9 * 86400, link2)
  check("the dashboard is handed the link to pay", typeof d.dunning.payUrl === 'string' && d.dunning.payUrl.startsWith('https://rzp.io/'))
  check('next retry is 72 hours later', d.dunning.nextAttemptAt === T0 + 120 * HOUR)
  t = T0 + 120 * HOUR; await svc.runDue()
  d = await status('wd')
  check('attempt 3 sent, and the old link is cancelled (one live link at a time)', d.dunning.attempt === 3 && link2.status === 'cancelled' && fake.links.size === 2)
  t = T0 + 192 * HOUR; await svc.runDue()
  d = await status('wd')
  check('attempt 4 is the last, with nothing further scheduled', d.dunning.attempt === 4 && d.dunning.nextAttemptAt === null, d.dunning)
  const gaps = d.dunning.attempts.slice(1).map((a: RzEntity, i: number) => (a.at - d.dunning.attempts[i].at) / HOUR)
  check('every gap between attempts is 48–72 hours', gaps.every((g: number) => g >= 48 && g <= 72), gaps)
  t = T0 + 9 * 86400 - 1; await svc.runDue()
  check('plan still active one second before the window closes', (await status('wd')).status === 'past_due')
  t = T0 + 9 * 86400; await svc.runDue()
  d = await status('wd')
  check('after 9 days unpaid the plan is suspended', d.status === 'suspended' && d.dunning.state === 'exhausted' && d.autopay.on === false, d.status)
  check('the open link and the Razorpay subscription are cancelled', [...fake.links.values()].every((l) => l.status === 'cancelled') && A.sub.status === 'cancelled')

  console.log('\ncustomer pays the link → recovered')
  const R = await activate('wr')
  const renewalDue = R.sub.current_end as number
  t = renewalDue; R.sub.status = 'pending'
  const TR = t
  await status('wr')
  t = TR + 48 * HOUR; await svc.runDue()
  d = await status('wr')
  const rLink = fake.links.get([...fake.links.keys()].pop()!)!
  const rPay = fake.pay(undefined, 767000)
  Object.assign(rLink, { status: 'paid', payments: [{ payment_id: rPay }] })
  t = TR + 50 * HOUR; await svc.runDue()
  d = await status('wr')
  check('payment of the link recovers the plan', d.status === 'active' && d.mode === 'once' && d.dunning === null, d)
  check('a fresh period is granted from the missed renewal date', d.currentStart === renewalDue && d.currentEnd > renewalDue + 27 * 86400, [d.currentStart, d.currentEnd])
  check('Razorpay is told to stop charging so the customer is not billed twice', R.sub.status === 'cancelled')
  check('autopay is flagged as lapsed so the customer can set it up again', d.autopay.lapsed === true)
  const rInv = ((await call('GET', '/invoices', undefined, 'wr')).body as RzEntity).items
  check('recovery payment was invoiced automatically', rInv.length === 2 && rInv[0].description.includes('recovered'), rInv.map((i: RzEntity) => i.description))

  console.log('\nRazorpay\'s own retry succeeds first → recovered')
  const F = await activate('wf')
  t = F.sub.current_end as number; F.sub.status = 'pending'
  const TF = t
  await status('wf')
  t = TF + 48 * HOUR; await svc.runDue()
  const fLink = fake.links.get([...fake.links.keys()].pop()!)!
  const fPay = fake.pay(undefined, 767000)
  Object.assign(F.sub, { status: 'active', paid_count: 2, current_start: TF, current_end: TF + 30 * 86400, charge_at: TF + 60 * 86400 })
  fake.subInvoices.set(F.subId, [{ id: 'inv_r', status: 'paid', payment_id: fPay, amount: 767000, paid_at: t, billing_start: TF, billing_end: TF + 30 * 86400 }])
  d = await status('wf')
  check('plan is back to active with autopay intact', d.status === 'active' && d.mode === 'autopay' && d.autopay.on === true && d.dunning === null, d)
  check('the now-pointless pay link is cancelled', fLink.status === 'cancelled')
  const fInv = ((await call('GET', '/invoices', undefined, 'wf')).body as RzEntity).items
  check('the retried charge was invoiced', fInv.length === 2)

  /* ── saved-card (token) autopay ─────────────────────────────────────── */
  const svcT = createBillingService({ store, razorpay: fake.rz, keyId: 'rzp_test_x', webhookSecret: WEBHOOK, gstPercent: 18, supplierStateCode: '27', now: () => t })
  const callT = (method: string, path: string, body?: Record<string, unknown>, ws = 'wt') =>
    svcT.handle({ method, path, body, headers: {}, workspaceId: ws, ip: '203.0.113.9', userAgent: 'smoke-test' })
  const statusT = async (ws: string) => (await callT('GET', '/subscription', undefined, ws)).body as RzEntity
  // two passes: the first submits a debit, the second reads how the bank answered
  const tick = async () => { await svcT.runDue(); await svcT.runDue() }
  let tokenN = 0
  async function activateT(ws: string, plan = 'pro', period = 'monthly', addons?: { id: string; qty: number }[]) {
    await callT('PUT', '/profile', good, ws)
    const co = (await callT('POST', '/checkout', { plan, period, mode: 'autopay', consent: true, addons }, ws)).body as RzEntity
    const tokenId = `token_${++tokenN}`
    const payId = fake.pay(co.orderId, co.amount, { status: 'authorized', token_id: tokenId, customer_id: co.customerId })
    const v = await callT('POST', '/verify', { razorpay_payment_id: payId, razorpay_order_id: co.orderId, razorpay_signature: sign(co.orderId, payId) }, ws)
    return { co, tokenId, payId, v, sum: v.body as RzEntity }
  }
  const noticeOrders = () => [...fake.orders.values()].filter((o) => o.notification)

  console.log('\nsaved-card autopay: set up')
  fake.state.debit = 'capture'
  await callT('PUT', '/profile', good, 'wt')
  const co1 = (await callT('POST', '/checkout', { plan: 'pro', period: 'monthly', mode: 'autopay', consent: true })).body as RzEntity
  const ord1 = fake.orders.get(co1.orderId)!
  check('monthly autopay uses the saved-card engine (no Subscriptions needed)', co1.engine === 'token' && co1.recurring === true && !!co1.customerId && !co1.subscriptionId, co1)
  check('the order is card-only, for the customer, with the mandate limit and the full first charge', ord1.method === 'card' && ord1.customer_id === co1.customerId && ord1.token.max_amount === 1500000 && ord1.amount === 767000, ord1)
  const tokPay = fake.pay(co1.orderId, 767000, { status: 'authorized', token_id: 'token_a', customer_id: co1.customerId })
  r = await callT('POST', '/verify', { razorpay_payment_id: tokPay, razorpay_order_id: co1.orderId, razorpay_signature: 'bad' })
  check('a wrong signature is refused', r.status === 400, r.body)
  r = await callT('POST', '/verify', { razorpay_payment_id: tokPay, razorpay_order_id: co1.orderId, razorpay_signature: sign(co1.orderId, tokPay) })
  let s1 = r.body as RzEntity
  check('authorised card: plan active, autopay on, card remembered', s1.status === 'active' && s1.autopay.on && s1.autopay.engine === 'token' && s1.autopay.card.last4 === '1111' && s1.autopay.requiresApproval === false, s1)
  check('the authorised payment was captured', fake.calls.some((c) => c === `POST /payments/${tokPay}/capture`))
  check('first charge is invoiced automatically', !!s1.latestInvoice?.number, s1.latestInvoice)
  const due1 = s1.currentEnd as number
  check('next charge is on the period end', s1.nextChargeAt === due1 && s1.autopay.next.noticeSent === false)

  console.log('\nsaved-card autopay: renewal')
  t = due1 - 49 * HOUR; await tick()
  check('no notice more than 48 hours ahead', noticeOrders().length === 0)
  t = due1 - 48 * HOUR; await tick()
  check('pre-debit notice goes out 48 hours before (an order with a notification)', noticeOrders().length === 1 && noticeOrders()[0]!.notification.token_id === 'token_a' && noticeOrders()[0]!.notification.payment_after === due1, noticeOrders())
  check('nothing is debited before the notice period is over', fake.debits.length === 0)
  check('dashboard shows the notice was sent', (await statusT('wt')).autopay.next.noticeSent === true)
  r = await callT('POST', '/change-plan', { plan: 'standard', period: 'monthly' })
  check('plan can no longer change once the notice is out', r.status === 409 && (r.body as RzEntity).error === 'notice_sent', r.body)
  t = due1; await tick()
  s1 = await statusT('wt')
  check('on the due date the card is debited for the plan price', fake.debits.length === 1 && fake.debits[0]!.amount === 767000)
  check('plan renews for another month, still on autopay', s1.status === 'active' && s1.autopay.on && s1.currentStart === due1 && s1.currentEnd > due1 + 27 * 86400, [s1.status, s1.currentStart, s1.currentEnd])
  const tInv1 = ((await callT('GET', '/invoices', undefined, 'wt')).body as RzEntity).items
  check('the renewal is invoiced automatically', tInv1.length === 2 && tInv1[0].description.includes('renewal'), tInv1.map((i: RzEntity) => i.description))
  await tick()
  check('nothing is charged twice for the same cycle', fake.debits.length === 1)

  await callT('POST', '/autopay', { enabled: false })   // keep the sections independent

  console.log('\nsaved-card autopay: failed debit → dunning (48/72/72 hours)')
  fake.state.debit = 'fail'
  const W2 = await activateT('wt2')
  const due2 = W2.sum.currentEnd as number
  const orders0 = noticeOrders().length
  t = due2 - 48 * HOUR; await tick()
  t = due2; await tick()
  let d2 = await statusT('wt2')
  const T2 = t
  check('failed renewal is past due, plan still works', d2.status === 'past_due' && d2.autopay.on === true, d2.status)
  check('attempt 1 (the failed debit) is logged with the bank reason', d2.dunning.attempt === 1 && d2.dunning.attempts[0].result === 'failed' && /Insufficient/.test(d2.dunning.attempts[0].reason ?? ''), d2.dunning.attempts)
  check('a pay-now link was sent straight away', typeof d2.dunning.payUrl === 'string' && [...fake.links.values()].some((l) => l.notify?.email && l.notify?.sms && l.amount === 767000))
  check('the next debit is scheduled 48 hours out, with its notice already sent', d2.dunning.nextAttemptAt === T2 + 48 * HOUR && noticeOrders().length === orders0 + 2)
  const retryOrder = noticeOrders().slice(-1)[0]!
  check('the retry notice respects the 36-hour rule', retryOrder.notification.payment_after - T2 >= 37 * 3600, retryOrder.notification)
  t = T2 + 47 * HOUR; await tick()
  check('no retry before 48 hours', fake.debits.length === 2)
  t = T2 + 48 * HOUR; await tick()
  d2 = await statusT('wt2')
  check('attempt 2 fails; attempt 3 is 72 hours after', d2.dunning.attempt === 2 && d2.dunning.attempts[1].result === 'failed' && d2.dunning.nextAttemptAt === T2 + 120 * HOUR, d2.dunning)
  t = T2 + 120 * HOUR; await tick()
  d2 = await statusT('wt2')
  check('attempt 3 fails; attempt 4 is 72 hours after', d2.dunning.attempt === 3 && d2.dunning.nextAttemptAt === T2 + 192 * HOUR, d2.dunning)
  fake.state.debit = 'capture'
  t = T2 + 192 * HOUR; await tick()
  d2 = await statusT('wt2')
  const gaps2 = (await store.get('wt2'))!.dunning!.attempts.slice(1).map((a, i, arr) => (a.at - (i ? arr[i - 1]!.at : T2)) / HOUR)
  check('attempt 4 succeeds: plan current, autopay intact, dunning cleared', d2.status === 'active' && d2.autopay.on && d2.dunning === null && d2.currentStart === due2, d2)
  check('every gap between debits was 48–72 hours', gaps2.every((g) => g >= 48 && g <= 72), gaps2)
  check('the pay-now link is cancelled once the card works', [...fake.links.values()].filter((l) => l.notes?.workspaceId === 'wt2').every((l) => l.status === 'cancelled'))
  const tInv2 = ((await callT('GET', '/invoices', undefined, 'wt2')).body as RzEntity).items
  check('the recovered payment is invoiced', tInv2.length === 2 && tInv2[0].description.includes('recovered'), tInv2.map((i: RzEntity) => i.description))
  check('exactly four debits were attempted for that cycle', fake.debits.length === 1 + 4)

  await callT('POST', '/autopay', { enabled: false }, undefined, 'wt2')   // keep the sections independent

  console.log('\nsaved-card autopay: nothing works → suspended')
  fake.state.debit = 'fail'
  const W3 = await activateT('wt3')
  const due3 = W3.sum.currentEnd as number
  t = due3 - 48 * HOUR; await tick()
  t = due3; await tick()
  const T3 = t
  for (const h of [48, 120, 192]) { t = T3 + h * HOUR; await tick() }
  check('four failed debits, nothing more scheduled', (await statusT('wt3')).dunning.attempt === 4 && (await statusT('wt3')).dunning.nextAttemptAt === null)
  t = T3 + 9 * 86400 - 1; await tick()
  check('still active one second before the window closes', (await statusT('wt3')).status === 'past_due')
  t = T3 + 9 * 86400; await tick()
  const d3 = await statusT('wt3')
  check('after 9 days the plan is suspended and the saved card removed', d3.status === 'suspended' && d3.autopay.on === false && fake.deletedTokens.includes(W3.tokenId), d3.status)
  const debitsBefore = fake.debits.length
  t += 40 * 86400; await tick()
  check('a suspended plan is never charged again', fake.debits.length === debitsBefore)

  console.log('\nsaved-card autopay: customer pays the link')
  fake.state.debit = 'fail'
  const W4 = await activateT('wt4')
  const due4 = W4.sum.currentEnd as number
  t = due4 - 48 * HOUR; await tick(); t = due4; await tick()
  const T4 = t
  const link4 = [...fake.links.values()].pop()!
  const payLink = fake.pay(undefined, 767000)
  Object.assign(link4, { status: 'paid', payments: [{ payment_id: payLink }] })
  t = T4 + 3600; await tick()
  const d4 = await statusT('wt4')
  check('paying the link recovers the plan and keeps autopay on', d4.status === 'active' && d4.autopay.on === true && d4.autopay.lapsed === false && d4.dunning === null && d4.currentStart === due4, d4)
  check('the card stays saved for the next renewal', d4.nextChargeAt === d4.currentEnd && d4.autopay.card.last4 === '1111')

  await callT('POST', '/autopay', { enabled: false }, undefined, 'wt4')   // keep the sections independent

  console.log('\nsaved-card autopay: switching it off, plan changes, limits')
  fake.state.debit = 'capture'
  const W5 = await activateT('wt5')
  r = await callT('POST', '/change-plan', { plan: 'standard', period: 'monthly' }, 'wt5')
  let s5 = r.body as RzEntity
  check('a plan change is queued for the next renewal', r.status === 200 && s5.appliedNow === false && s5.scheduledChange?.plan === 'standard' && s5.autopay.next.plan === 'standard', r.body)
  r = await callT('POST', '/change-plan', { plan: 'pro', period: 'yearly' }, 'wt5')
  check('a yearly plan cannot be paid by card autopay (over ₹15,000)', r.status === 409 && (r.body as RzEntity).error === 'autopay_limit', r.body)
  t = (W5.sum.currentEnd as number) - 48 * HOUR; await tick(); t = W5.sum.currentEnd as number; await tick()
  s5 = await statusT('wt5')
  check('the renewal charges the NEW plan price (Standard ₹4,130)', fake.debits.slice(-1)[0]!.amount === 413000 && s5.plan === 'standard', [s5.plan, fake.debits.slice(-1)[0]])
  r = await callT('POST', '/autopay', { enabled: false }, 'wt5')
  s5 = r.body as RzEntity
  check('turning autopay off removes the saved card and keeps the plan until the period ends', s5.autopay.on === false && s5.status === 'active' && s5.endsAt === s5.currentEnd && fake.deletedTokens.length >= 2, s5)
  const before5 = fake.debits.length
  t = (s5.currentEnd as number) + 3600; await tick()
  s5 = await statusT('wt5')
  check('no debit after switching off; the plan then ends', fake.debits.length === before5 && s5.status === 'expired', [s5.status, fake.debits.length - before5])
  const y = (await callT('POST', '/checkout', { plan: 'pro', period: 'yearly', mode: 'autopay', consent: true }, 'wt')).body as RzEntity
  check('yearly autopay still goes through Razorpay Subscriptions (needs it enabled)', y.engine === undefined && !!y.subscriptionId && !y.orderId, y)

  console.log('\nadd-ons bought with the plan')
  await callT('PUT', '/profile', good, 'wa1')
  const AD = [{ id: 'extra-live-agent', qty: 2 }, { id: 'remove-branding', qty: 1 }]
  r = await callT('POST', '/quote', { plan: 'pro', period: 'monthly', addons: AD }, 'wa1')
  const qa = r.body as RzEntity
  check('quote prices the plan plus add-ons (₹6,500 + 2×₹1,000 + ₹1,900 + 18% GST)', qa.charge.base === 10400 && qa.charge.total === 12272 && qa.planBase === 6500 && qa.addons.length === 2 && qa.addons[0].amount === 2000, qa)
  r = await callT('POST', '/quote', { plan: 'pro', period: 'monthly', addons: [{ id: 'crm', qty: 1 }] }, 'wa1')
  check('add-ons not offered on a plan are refused (CRM is for Broadcast / Standard — Pro includes it)', r.status === 400 && (r.body as RzEntity).error === 'invalid_addons', r.body)
  r = await callT('POST', '/quote', { plan: 'pro', period: 'monthly', addons: [{ id: 'extra-live-agent', qty: 999 }] }, 'wa1')
  check('absurd quantities are refused', r.status === 400, r.body)
  r = await callT('POST', '/quote', { plan: 'pro', period: 'monthly', addons: [{ id: 'basic-support', qty: 1 }, { id: 'premium-support', qty: 1 }] }, 'wa1')
  check('Basic and Premium Support cannot be combined', r.status === 400, r.body)
  r = await callT('POST', '/quote', { plan: 'pro', period: 'monthly', addons: [{ id: 'nope', qty: 1 }] }, 'wa1')
  check('unknown add-ons are refused', r.status === 400, r.body)
  r = await callT('POST', '/checkout', { plan: 'pro', period: 'monthly', mode: 'autopay', consent: true, addons: [{ id: 'basic-support', qty: 1 }] }, 'wa1')
  check('plan + add-ons over ₹15,000 cannot use card autopay (falls to Subscriptions)', (r.body as RzEntity).engine !== 'token', r.body)
  const WA = await activateT('wa2', 'pro', 'monthly', AD)
  check('plan and add-ons are charged together in one payment', WA.co.amount === 1227200 && fake.orders.get(WA.co.orderId)!.amount === 1227200, WA.co.amount)
  check('add-ons are active with the plan, listed with their prices', WA.sum.status === 'active' && WA.sum.addons.length === 2 && WA.sum.addons[0].name === 'Live Agent' && WA.sum.addons[0].qty === 2 && WA.sum.charge.total === 12272, WA.sum.addons)
  const waInv = ((await callT('GET', '/invoices', undefined, 'wa2')).body as RzEntity).items[0]
  const waPage = String((await callT('GET', `/invoices/${waInv.id}/view`, undefined, 'wa2')).body)
  check('the invoice has a row for the plan and one per add-on, totalling the payment', waInv.amountPaise === 1227200 && waPage.includes('Add-on: Live Agent') && waPage.includes('Add-on: Remove Branding') && waPage.includes('₹10,400.00') && waPage.includes('₹12,272.00') && waPage.includes('₹2,000.00'))
  const dueA = WA.sum.currentEnd as number
  t = dueA - 48 * HOUR; await tick(); t = dueA; await tick()
  check('the renewal debits the plan AND its add-ons', fake.debits.slice(-1)[0]!.amount === 1227200, fake.debits.slice(-1)[0])
  r = await callT('POST', '/change-plan', { plan: 'standard', period: 'monthly' }, 'wa2')
  check('add-ons offered on both plans carry over to the new plan (₹3,500 + ₹3,900 + GST = ₹8,732)', r.status === 200 && (r.body as RzEntity).droppedAddons === 0 && (r.body as RzEntity).autopay.next.total === 8732, r.body)
  await callT('POST', '/autopay', { enabled: false }, 'wa2')
  await activateT('wa3', 'standard', 'monthly', [{ id: 'crm', qty: 1 }, { id: 'extra-live-agent', qty: 1 }])
  r = await callT('POST', '/change-plan', { plan: 'pro', period: 'monthly' }, 'wa3')
  check('moving up to Pro drops CRM (it is included there), keeps the Live Agent, and says so', r.status === 200 && (r.body as RzEntity).droppedAddons === 1 && (r.body as RzEntity).autopay.next.addons.length === 1 && (r.body as RzEntity).autopay.next.total === 8850, r.body)
  await callT('POST', '/autopay', { enabled: false }, 'wa3')
  const once = (await callT('POST', '/checkout', { plan: 'pro', period: 'yearly', mode: 'once', addons: [{ id: 'extra-chatbots', qty: 1 }] }, 'wa1')).body as RzEntity
  check('pay-once includes add-ons too (₹72,000 + ₹9,600 + 18% = ₹96,288)', once.amount === 9628800, once.amount)

  console.log('\nchanging the payment card')
  fake.state.debit = 'capture'
  const CU = await activateT('wc1')
  const dueC = CU.sum.currentEnd as number
  r = await callT('POST', '/payment-method', {}, 'wc1')
  const cu = r.body as RzEntity
  check('a ₹1 card check is started on the same customer', r.status === 200 && cu.amount === 100 && cu.updateCard === true && cu.customerId === CU.co.customerId && fake.orders.get(cu.orderId)!.method === 'card', r.body)
  const newPay = fake.pay(cu.orderId, 100, { status: 'authorized', token_id: 'token_new1', customer_id: cu.customerId, card: { last4: '4242', network: 'Visa' } })
  r = await callT('POST', '/verify', { razorpay_payment_id: newPay, razorpay_order_id: cu.orderId, razorpay_signature: 'bad' }, 'wc1')
  check('a forged signature changes nothing', r.status === 400 && (await statusT('wc1')).autopay.card.last4 === '1111')
  t = dueC - 48 * HOUR; await tick()
  const noticeBefore = noticeOrders().filter((o) => o.notification.token_id === CU.tokenId).length
  r = await callT('POST', '/verify', { razorpay_payment_id: newPay, razorpay_order_id: cu.orderId, razorpay_signature: sign(cu.orderId, newPay) }, 'wc1')
  const cs = r.body as RzEntity
  check('the new card replaces the old one; plan and renewal date unchanged', cs.autopay.card.last4 === '4242' && cs.status === 'active' && cs.currentEnd === dueC && cs.autopay.next.dueAt === dueC, cs.autopay)
  check('the old card is removed from Razorpay and the ₹1 is refunded', fake.deletedTokens.includes(CU.tokenId) && fake.refunds.includes(newPay))
  check('the ₹1 check is not a payment or an invoice', ((await callT('GET', '/invoices', undefined, 'wc1')).body as RzEntity).items.length === 1)
  check('a fresh renewal notice goes out for the new card straight away', cs.autopay.next.noticeSent === true)
  await tick()
  const newNotice = noticeOrders().filter((o) => o.notification.token_id === 'token_new1')
  check('…addressed to the new card', newNotice.length === 1 && noticeBefore === 1, [newNotice.length, noticeBefore])
  t = dueC; await tick()
  check('the renewal is debited on the new card', (await statusT('wc1')).currentStart === dueC && fake.debits.slice(-1)[0]!.orderId === newNotice[0]!.id)
  fake.state.debit = 'fail'
  const CD = await activateT('wc2')
  const dueD = CD.sum.currentEnd as number
  t = dueD - 48 * HOUR; await tick(); t = dueD; await tick()
  check('(setup) debit failed, plan is past due', (await statusT('wc2')).status === 'past_due')
  const retryBefore = (await store.get('wc2'))!.dunning!.retryOrder!.orderId
  r = await callT('POST', '/payment-method', {}, 'wc2')
  const cu2 = r.body as RzEntity
  const pay2 = fake.pay(cu2.orderId, 100, { status: 'authorized', token_id: 'token_new2', customer_id: cu2.customerId })
  r = await callT('POST', '/verify', { razorpay_payment_id: pay2, razorpay_order_id: cu2.orderId, razorpay_signature: sign(cu2.orderId, pay2) }, 'wc2')
  const dunAfter = (await store.get('wc2'))!.dunning!
  check('fixing the card during dunning re-aims the next retry at the new card', r.status === 200 && dunAfter.retryOrder!.orderId !== retryBefore && fake.orders.get(dunAfter.retryOrder!.orderId)!.notification.token_id === 'token_new2', dunAfter.retryOrder)
  check('and keeps the 48-hour schedule', dunAfter.nextAttemptAt === dueD + 48 * HOUR)
  fake.state.debit = 'capture'
  t = dueD + 48 * HOUR; await tick()
  const wc2 = await statusT('wc2')
  check('the retry on the new card recovers the plan', wc2.status === 'active' && wc2.dunning === null && fake.debits.slice(-1)[0]!.orderId === dunAfter.retryOrder!.orderId, wc2.status)
  await callT('POST', '/autopay', { enabled: false }, 'wc2')
  await callT('POST', '/autopay', { enabled: false }, 'wc1')
  r = await callT('POST', '/payment-method', {}, 'wc1')
  check('no card to change once autopay is off', r.status === 409, r.body)

  console.log('\none-time add-ons on a running plan')
  fake.state.debit = 'capture'
  const OA = await activateT('wo1')
  const dueO = OA.sum.currentEnd as number
  const AO = [{ id: 'extra-live-agent', qty: 2 }]
  r = await callT('POST', '/quote', { plan: 'pro', period: 'monthly', addons: AO, addonsOnly: true }, 'wo1')
  const qo = r.body as RzEntity
  check('quote is for the add-ons alone (₹2,000 + 18% GST = ₹2,360)', qo.planBase === 0 && qo.charge.base === 2000 && qo.charge.total === 2360, qo)
  check('autopay customers are told they can buy add-ons', (await statusT('wo1')).canBuyAddons === true)
  r = await callT('POST', '/addons/checkout', { addons: [] }, 'wo1')
  check('an empty basket is refused', r.status === 400 && (r.body as RzEntity).error === 'no_addons', r.body)
  r = await callT('POST', '/addons/checkout', { addons: AO }, 'wo1')
  const ao = r.body as RzEntity
  check('checkout is a plain one-off payment (no card saving, no mandate)', r.status === 200 && ao.mode === 'once' && ao.amount === 236000 && !ao.recurring && !ao.customerId && fake.orders.get(ao.orderId)!.amount === 236000, ao)
  const wrong = fake.pay(ao.orderId, 100000)
  r = await callT('POST', '/verify', { razorpay_payment_id: wrong, razorpay_order_id: ao.orderId, razorpay_signature: sign(ao.orderId, wrong) }, 'wo1')
  check('a payment of the wrong amount is refused', r.status === 400 && (r.body as RzEntity).error === 'amount_mismatch', r.body)
  const aoPay = fake.pay(ao.orderId, 236000)
  r = await callT('POST', '/verify', { razorpay_payment_id: aoPay, razorpay_order_id: ao.orderId, razorpay_signature: sign(ao.orderId, aoPay) }, 'wo1')
  const so = r.body as RzEntity
  check('the add-ons are active until the period ends', r.status === 200 && so.extraAddons.length === 1 && so.extraAddons[0].name === 'Live Agent' && so.extraAddons[0].qty === 2 && so.extraAddons[0].until === dueO, so.extraAddons)
  check('plan, autopay and card are untouched', so.plan === 'pro' && so.autopay.on && so.autopay.engine === 'token' && so.autopay.card.last4 === '1111' && so.currentEnd === dueO && so.paymentMethod.last4 === '1111', so.autopay)
  check('the next renewal is still just the plan (₹7,670) — nothing recurring was added', so.autopay.next.total === 7670 && so.addons.length === 0 && so.nextChargeAt === dueO, so.autopay.next)
  const oInv = ((await callT('GET', '/invoices', undefined, 'wo1')).body as RzEntity).items
  check('it is invoiced on its own', oInv.length === 2 && oInv[0].amountPaise === 236000 && oInv[0].description.includes('Add-ons'), oInv.map((i: RzEntity) => i.description))
  const oPage = String((await callT('GET', `/invoices/${oInv[0].id}/view`, undefined, 'wo1')).body)
  check('invoice shows only the add-on, its validity and that it does not renew', oPage.includes('Add-on: Live Agent') && oPage.includes('Valid until') && oPage.includes('does not renew') && !oPage.includes('Pro Plan —') && oPage.includes('₹2,000.00') && oPage.includes('₹2,360.00'))
  t = dueO - 48 * HOUR; await tick(); t = dueO; await tick()
  const afterO = await statusT('wo1')
  check('the renewal charges the plan only; the one-time add-ons have ended', fake.debits.slice(-1)[0]!.amount === 767000 && afterO.extraAddons.length === 0 && afterO.status === 'active', [fake.debits.slice(-1)[0], afterO.extraAddons])
  await callT('POST', '/autopay', { enabled: false }, 'wo1')

  const SO = await activateT('wo2', 'standard')
  r = await callT('POST', '/addons/checkout', { addons: [{ id: 'crm', qty: 1 }] }, 'wo2')
  check('Standard can buy one-time add-ons too (CRM ₹1,000 + GST = ₹1,180)', r.status === 200 && (r.body as RzEntity).amount === 118000 && SO.sum.canBuyAddons === true, r.body)
  r = await callT('POST', '/addons/checkout', { addons: [{ id: 'email-otp', qty: 1 }, { id: 'ai-integration', qty: 1 }] }, 'wo2')
  check('…and add-ons priced per the sheet (Email OTP ₹500 + AI Integration ₹2,000 + GST = ₹2,950)', (r.body as RzEntity).amount === 295000, r.body)
  await callT('POST', '/autopay', { enabled: false }, 'wo2')

  fake.state.debit = 'fail'
  const PD = await activateT('wo3')
  t = (PD.sum.currentEnd as number) - 48 * HOUR; await tick(); t = PD.sum.currentEnd as number; await tick()
  r = await callT('POST', '/addons/checkout', { addons: AO }, 'wo3')
  check('not while a renewal payment is overdue', r.status === 409 && (r.body as RzEntity).error === 'payment_overdue' && (await statusT('wo3')).canBuyAddons === false, r.body)
  await callT('POST', '/autopay', { enabled: false }, 'wo3')
  fake.state.debit = 'capture'

  await callT('PUT', '/profile', good, 'wo4')
  const po = (await callT('POST', '/checkout', { plan: 'pro', period: 'monthly', mode: 'once' }, 'wo4')).body as RzEntity
  const poPay = fake.pay(po.orderId, po.amount)
  await callT('POST', '/verify', { razorpay_payment_id: poPay, razorpay_order_id: po.orderId, razorpay_signature: sign(po.orderId, poPay) }, 'wo4')
  r = await callT('POST', '/addons/checkout', { addons: AO }, 'wo4')
  const po2 = r.body as RzEntity
  const po2Pay = fake.pay(po2.orderId, po2.amount)
  r = await callT('POST', '/verify', { razorpay_payment_id: po2Pay, razorpay_order_id: po2.orderId, razorpay_signature: sign(po2.orderId, po2Pay) }, 'wo4')
  check('pay-once customers can add them too, ending with their plan', r.status === 200 && (r.body as RzEntity).mode === 'once' && (r.body as RzEntity).extraAddons[0].until === (r.body as RzEntity).currentEnd, r.body)

  console.log('\nyearly plans can buy add-ons monthly')
  await callT('PUT', '/profile', good, 'wo5')
  const yo = (await callT('POST', '/checkout', { plan: 'pro', period: 'yearly', mode: 'once' }, 'wo5')).body as RzEntity
  const yoPay = fake.pay(yo.orderId, yo.amount)
  const yoSum = (await callT('POST', '/verify', { razorpay_payment_id: yoPay, razorpay_order_id: yo.orderId, razorpay_signature: sign(yo.orderId, yoPay) }, 'wo5')).body as RzEntity
  r = await callT('POST', '/quote', { plan: 'pro', period: 'yearly', addons: AO, addonsOnly: true, term: 'monthly' }, 'wo5')
  check('monthly rate: 2 agents = ₹2,000 + GST = ₹2,360', (r.body as RzEntity).charge.total === 2360 && (r.body as RzEntity).addonPeriod === 'monthly', r.body)
  r = await callT('POST', '/quote', { plan: 'pro', period: 'yearly', addons: AO, addonsOnly: true }, 'wo5')
  check('yearly rate for the rest of the year: ₹19,200 + GST = ₹22,656', (r.body as RzEntity).charge.total === 22656, r.body)
  r = await callT('POST', '/addons/checkout', { addons: AO, term: 'monthly' }, 'wo5')
  const ym = r.body as RzEntity
  check('checkout charges the monthly rate', ym.amount === 236000, ym)
  const ymPay = fake.pay(ym.orderId, 236000)
  const tBuy = t
  r = await callT('POST', '/verify', { razorpay_payment_id: ymPay, razorpay_order_id: ym.orderId, razorpay_signature: sign(ym.orderId, ymPay) }, 'wo5')
  const ys = r.body as RzEntity
  check('they run for one month — not the whole year — and the yearly plan is unchanged', ys.extraAddons[0].term === 'monthly' && ys.extraAddons[0].until > tBuy + 27 * 86400 && ys.extraAddons[0].until < tBuy + 32 * 86400 && ys.currentEnd === yoSum.currentEnd && ys.period === 'yearly', [ys.extraAddons, ys.currentEnd])
  const yInv = ((await callT('GET', '/invoices', undefined, 'wo5')).body as RzEntity).items[0]
  const yPage = String((await callT('GET', `/invoices/${yInv.id}/view`, undefined, 'wo5')).body)
  check('the invoice says 1 month', yInv.amountPaise === 236000 && yPage.includes('1 month'))
  r = await callT('POST', '/addons/checkout', { addons: AO }, 'wo5')
  check('without choosing a term they pay the yearly rate', (r.body as RzEntity).amount === 2265600, r.body)
  r = await callT('POST', '/addons/checkout', { addons: AO, term: 'monthly' }, 'wo4')
  check('on a monthly plan the term makes no difference (₹2,360)', (r.body as RzEntity).amount === 236000, r.body)
  t += 40 * 86400
  check('after a month they are gone, the plan is still there', (await statusT('wo5')).extraAddons.length === 0 && (await statusT('wo5')).status === 'active')

  console.log('\nthe tax invoice')
  const invPage = String((await callT('GET', `/invoices/${(s1.latestInvoice as RzEntity).id}/view`, undefined, 'wt')).body)
  check('shows the supplier: legal name, product, CIN, GSTIN, address', ['Feso Social Media Private Limited', 'SMATBOT', 'U22222TG2015PTC100809', '36AACCF6679F1ZD', 'Ashoka Hitech Chambers', 'Banjara Hills', 'Telangana'].every((x) => invPage.includes(x)))
  check('shows contact details', invPage.includes('sales@smatbot.com') && invPage.includes('accounts@bytequark.com') && invPage.includes('+91 9205308991'))
  check('shows the SmatBot logo', invPage.includes('<img class="logo" src="data:image/png;base64,'))
  check('notes say no refunds, Meta charges are the client pays, and the plan allowance', invPage.includes('we do not have any refund policy') && invPage.includes('Meta charges are separate') && invPage.includes('must be paid by the client') && invPage.includes('1,00,000 WhatsApp service messages'))
  check('line item: plan, start and end date, qty and rate — no long description', invPage.includes('Plan start date') && invPage.includes('Plan end date') && invPage.includes('1 month') && invPage.includes('₹6,500.00') && !invPage.includes('Flow-based bot with the full feature set'))
  check('contact details sit in the footer, not the supplier box', invPage.lastIndexOf('sales@smatbot.com') > invPage.indexOf('class="foot') && invPage.indexOf('sales@smatbot.com') === invPage.lastIndexOf('sales@smatbot.com'))

  console.log('\nadmin panel: assign a plan without payment')
  const ADMIN = { email: 'ops@smatbot.test', password: 'smoke-only-pass' }
  const asvc = createBillingService({ store, gstPercent: 18, admin: ADMIN, now: () => t })   // no Razorpay: admin routes must not need it
  const login = (body: Record<string, unknown>) => asvc.handle({ method: 'POST', path: '/admin/login', body, headers: {}, workspaceId: 'ignored' })
  check('admin routes are off when no login is configured', (await call('GET', '/admin/customers')).status === 503)
  check('a wrong password is refused', (await login({ email: ADMIN.email, password: 'smoke-only-pas' })).status === 401)
  check('a wrong email is refused', (await login({ email: 'x@smatbot.test', password: ADMIN.password })).status === 401)
  r = await login({ email: ' OPS@smatbot.test ', password: ADMIN.password })
  const TOKEN = (r.body as RzEntity).token as string
  check('the right login (email in any case) returns a token, not the password', r.status === 200 && TOKEN?.length > 20 && !TOKEN.includes(ADMIN.password), r.body)
  const adm = (method: string, path: string, body?: Record<string, unknown>, token = TOKEN) =>
    asvc.handle({ method, path, body, headers: { 'x-admin-token': token }, workspaceId: 'ignored' })
  check('admin calls without that token are refused', (await adm('GET', '/admin/customers', undefined, 'forged')).status === 401)
  check('the token stops working when the password changes', (await createBillingService({ store, gstPercent: 18, admin: { ...ADMIN, password: 'another-pass-1' } }).handle({ method: 'GET', path: '/admin/customers', headers: { 'x-admin-token': TOKEN }, workspaceId: 'x' })).status === 401)
  r = await adm('POST', '/admin/assign', { workspaceId: 'wa1', plan: 'standard', period: 'yearly', addons: [{ id: 'crm', qty: 1 }], note: 'NEFT UTR 123' })
  const ga = r.body as RzEntity
  check('plan assigned for a year with its add-on and note', r.status === 200 && ga.planName === 'Standard' && ga.status === 'active' && ga.currentEnd > t + 364 * 86400 && ga.addons[0]?.id === 'crm' && ga.lastGrant?.note === 'NEFT UTR 123', ga)
  s = (await call('GET', '/subscription', undefined, 'wa1')).body as RzEntity
  check('the customer sees it as a plan that ends, no autopay, no invoice', s.status === 'active' && s.plan === 'standard' && s.autopay.on === false && s.endsAt === ga.currentEnd && !s.latestInvoice, s)
  r = await adm('POST', '/admin/assign', { workspaceId: 'wa1', plan: 'pro', period: 'monthly', addons: [{ id: 'crm', qty: 1 }] })
  check('an add-on the plan cannot have is rejected', r.status === 400 && (r.body as RzEntity).error === 'invalid_addons', r.body)
  r = await adm('POST', '/admin/assign', { workspaceId: 'wa1', plan: 'pro', period: 'monthly', until: t - 1 })
  check('an end date in the past is rejected', r.status === 400 && (r.body as RzEntity).error === 'invalid_until', r.body)
  r = await adm('POST', '/admin/assign', { workspaceId: '../x', plan: 'pro', period: 'monthly' })
  check('a bad workspace id is rejected', r.status === 400 && (r.body as RzEntity).error === 'invalid_workspace', r.body)
  await store.put({ ...(await store.get('wa1'))!, workspaceId: 'wa2', engine: 'token', renewal: { plan: 'pro', period: 'monthly', dueAt: t + 86400 } })
  r = await adm('POST', '/admin/assign', { workspaceId: 'wa2', plan: 'ai', period: 'monthly' })
  check('refused while the customer is on autopay (they would be charged too)', r.status === 409 && (r.body as RzEntity).error === 'autopay_running', r.body)
  const rows = ((await adm('GET', '/admin/customers')).body as RzEntity).items as RzEntity[]
  check('customer list shows the assigned plan and who is on autopay', rows.some((x) => x.workspaceId === 'wa1' && x.plan === 'standard' && !x.autopay) && rows.some((x) => x.workspaceId === 'wa2' && x.autopay), rows.length)
  t = ga.currentEnd + 1
  check('after the end date the plan has ended', ((await call('GET', '/subscription', undefined, 'wa1')).body as RzEntity).status === 'expired')

  console.log(failures ? `\n${failures} check(s) FAILED` : '\nall checks passed')
  process.exit(failures ? 1 : 0)
}

main().catch((e) => { console.error(e); process.exit(1) })
