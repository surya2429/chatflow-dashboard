// billing.smoke.ts — exercises the billing service against an in-memory fake of
// Razorpay (no network, no keys), so the subscription / autopay paths can be
// checked even when the real account doesn't have Subscriptions switched on.
//
//   cd backend && npx tsx scripts/billing.smoke.ts
import { createBillingService } from '../src/billing/service.js'
import { hmacHex, type Razorpay, type RzEntity } from '../src/billing/razorpay.js'
import type { BillingRecord, BillingStore } from '../src/billing/types.js'

const SECRET = 'test_secret'
const WEBHOOK = 'whsec_test'
let failures = 0
const check = (name: string, ok: boolean, extra?: unknown) => {
  console.log(`${ok ? '  ok ' : ' FAIL'}  ${name}${ok || extra === undefined ? '' : '  → ' + JSON.stringify(extra)}`)
  if (!ok) failures++
}

/* ── a tiny fake Razorpay ─────────────────────────────────────────────── */
function fakeRazorpay() {
  let n = 0
  const plans = new Map<string, RzEntity>()
  const subs = new Map<string, RzEntity>()
  const orders = new Map<string, RzEntity>()
  const payments = new Map<string, RzEntity>()
  const calls: string[] = []
  const rz: Razorpay = {
    verifySignature: (payload, sig) => hmacHex(SECRET, payload) === sig,
    async request(method, path, body) {
      calls.push(`${method} ${path}`)
      const b = (body ?? {}) as RzEntity
      let m: RegExpMatchArray | null
      if (method === 'GET' && path.startsWith('/plans?')) return { items: [...plans.values()] } as never
      if (method === 'POST' && path === '/plans') { const p = { id: `plan_${++n}`, period: b.period, item: b.item, notes: b.notes }; plans.set(p.id, p); return p as never }
      if (method === 'GET' && (m = path.match(/^\/plans\/(.+)$/))) return plans.get(m[1]!) as never
      if (method === 'POST' && path === '/orders') { const o = { id: `order_${++n}`, amount: b.amount }; orders.set(o.id, o); return o as never }
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
      if (method === 'GET' && path.startsWith('/invoices')) return { items: [{ id: 'inv_1', invoice_number: 'INV-1', issued_at: 1700000000, amount: 8496000, status: 'paid', short_url: 'https://rzp.io/i/x' }] } as never
      throw new Error(`fake razorpay: unhandled ${method} ${path}`)
    },
  }
  return {
    rz, subs, calls,
    pay(orderId: string | undefined, amount: number, extra: RzEntity = {}) {
      const id = `pay_${++n}`
      payments.set(id, { id, order_id: orderId, status: 'captured', amount, method: 'card', card: { last4: '1111', network: 'Visa' }, ...extra })
      return id
    },
  }
}

function memoryStore(): BillingStore {
  const all = new Map<string, BillingRecord>()
  return {
    async get(w) { return structuredClone(all.get(w) ?? null) },
    async put(r) { all.set(r.workspaceId, structuredClone(r)) },
    async findBySubscription(id) { return [...all.values()].find((r) => r.subscriptionId === id || r.upcoming?.subscriptionId === id) ?? null },
  }
}

async function main() {
  let t = 1_800_000_000
  const fake = fakeRazorpay()
  const svc = createBillingService({ store: memoryStore(), razorpay: fake.rz, keyId: 'rzp_test_x', webhookSecret: WEBHOOK, gstPercent: 18, now: () => t })
  const call = (method: string, path: string, body?: Record<string, unknown>, ws = 'ws1', extra: Partial<Parameters<typeof svc.handle>[0]> = {}) =>
    svc.handle({ method, path, body, headers: {}, workspaceId: ws, ...extra })
  const sign = (a: string, b: string) => hmacHex(SECRET, `${a}|${b}`)

  console.log('\nconfig + empty state')
  let r = await call('GET', '/config')
  check('config exposes key id but no secret', (r.body as RzEntity).keyId === 'rzp_test_x' && !JSON.stringify(r.body).includes(SECRET))
  r = await call('GET', '/subscription')
  check('no subscription yet', (r.body as RzEntity).status === 'none')

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
  const sc = r.body as RzEntity
  check('subscription created with its own Razorpay plan', Boolean(sc.subscriptionId) && fake.calls.includes('POST /plans'))
  r = await call('POST', '/checkout', { plan: 'pro', period: 'monthly', mode: 'autopay' })
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
  r = await call('POST', '/checkout', { plan: 'pro', period: 'yearly', mode: 'autopay', startAtCycleEnd: true })
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
  check('halted subscription is surfaced', s.status === 'halted' && s.autopay.on === false, s.status)

  console.log(failures ? `\n${failures} check(s) FAILED` : '\nall checks passed')
  process.exit(failures ? 1 : 0)
}

main().catch((e) => { console.error(e); process.exit(1) })
