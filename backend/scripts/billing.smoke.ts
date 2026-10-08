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
function fakeRazorpay() {
  let n = 0
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
      if (method === 'GET' && path.startsWith('/invoices')) return { items: subInvoices.get(new URL('http://x' + path).searchParams.get('subscription_id') ?? '') ?? [] } as never
      if (method === 'POST' && path === '/payment_links') {
        const l = { id: `plink_${++n}`, short_url: `https://rzp.io/i/${n}`, status: 'created', amount: b.amount, notify: b.notify, description: b.description, expire_by: b.expire_by, notes: b.notes, customer: b.customer, payments: null as unknown }
        links.set(l.id, l); return l as never
      }
      if (method === 'GET' && (m = path.match(/^\/payment_links\/([^/]+)$/))) return links.get(m[1]!) as never
      if (method === 'POST' && (m = path.match(/^\/payment_links\/([^/]+)\/cancel$/))) { const l = links.get(m[1]!)!; l.status = 'cancelled'; return l as never }
      throw new Error(`fake razorpay: unhandled ${method} ${path}`)
    },
  }
  return {
    rz, subs, calls, links, subInvoices,
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
    async nextSequence(key) { counters[key] = (counters[key] ?? 0) + 1; return counters[key]! },
  }
}

async function main() {
  let t = 1_800_000_000
  const fake = fakeRazorpay()
  const store = memoryStore()
  const svc = createBillingService({ store, razorpay: fake.rz, keyId: 'rzp_test_x', webhookSecret: WEBHOOK, gstPercent: 18, now: () => t })
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

  console.log(failures ? `\n${failures} check(s) FAILED` : '\nall checks passed')
  process.exit(failures ? 1 : 0)
}

main().catch((e) => { console.error(e); process.exit(1) })
