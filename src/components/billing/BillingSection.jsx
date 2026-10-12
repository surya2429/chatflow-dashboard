// BillingSection.jsx — "Billing & Plan" in Settings, wired to Razorpay.
//
// Tabs: Overview · Plans · Usage · Add-ons · Invoices
//
// What is real here: the subscription (plan, period, renewal, autopay, payment
// method) and invoices come from /api/billing, and every payment goes through
// Razorpay Checkout. What is still demo data: message-usage figures, add-on
// requests and the billing-details card.
//
// Two ways to pay: AUTOPAY (a Razorpay subscription, charged each cycle) or PAY
// ONCE (one payment buys one period, no renewal). The server decides every
// amount; this file only names a plan and a billing period.
import { useState, useEffect, useRef, Fragment } from 'react'
import clsx from 'clsx'
import {
  LayoutDashboard, Layers, BarChart2, Puzzle, Receipt, Check, Download, ArrowUpRight, CreditCard,
  CalendarDays, Info, ShieldCheck, Building2, Users, Languages, MessageSquare, Globe, Zap, Lock,
  Repeat, AlertCircle, Loader2, RefreshCw, ExternalLink, CheckCircle2, X,
} from 'lucide-react'
import { useApp } from '../../context/AppContext'
import { useAuth } from '../../context/AuthContext'
import {
  PLANS, PLAN_HIGHLIGHTS, FEATURE_GROUPS, FEATURE_ADDONS, USAGE_ADDONS, getPlan, planTier, planMath, inr, money, num, DEMO_USAGE,
} from '../../constants/pricing'
import { billing, payWithRazorpay } from '../../lib/billingApi'
import { useSubscription, setSubscription, setProfile, refreshSubscription, isLive } from '../../lib/subscriptionStore'
import PaymentDialog from './PaymentDialog'
import BillingDetailsForm from './BillingDetailsForm'
import { addressLine, stateNameOf } from './billingFormat'

const TABS = [
  { id: 'overview', label: 'Overview', icon: LayoutDashboard },
  { id: 'plans',    label: 'Plans',    icon: Layers },
  { id: 'usage',    label: 'Usage',    icon: BarChart2 },
  { id: 'addons',   label: 'Add-ons',  icon: Puzzle },
  { id: 'invoices', label: 'Invoices', icon: Receipt },
]

const fmtSec = (sec) => (sec ? new Date(sec * 1000).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—')
const daysUntil = (sec) => Math.max(0, Math.ceil((sec * 1000 - Date.now()) / 86400000))

function describeMethod(m) {
  if (!m) return null
  if (m.type === 'card') return `${m.network || 'Card'} •••• ${m.last4 || '••••'}`
  if (m.type === 'upi') return `UPI · ${m.vpa || 'linked account'}`
  if (m.type === 'emandate') return `eMandate${m.bank ? ' · ' + m.bank : ''}`
  return m.type ? m.type[0].toUpperCase() + m.type.slice(1) : null
}

/* ── small pieces ──────────────────────────────────────────────────────── */
function Ring({ pct, color, size = 68, stroke = 7, children }) {
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  return (
    <div className="relative flex-shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#e2e8f0" strokeWidth={stroke}/>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={stroke} strokeLinecap="round"
          strokeDasharray={c} strokeDashoffset={c * (1 - Math.min(100, Math.max(0, pct)) / 100)} className="transition-all duration-500"/>
      </svg>
      <div className="absolute inset-0 flex items-center justify-center text-[11px] font-bold text-slate-800">{children}</div>
    </div>
  )
}

function Card({ title, desc, action, children, className }) {
  return (
    <div className={clsx('rounded-2xl border border-surface-border bg-white', className)}>
      {(title || action) && (
        <div className="flex items-start justify-between gap-3 px-5 pt-4 pb-3">
          <div>
            <h3 className="text-[13px] font-bold text-slate-900">{title}</h3>
            {desc && <p className="text-[11px] text-slate-400 mt-0.5">{desc}</p>}
          </div>
          {action}
        </div>
      )}
      <div className={clsx(title || action ? 'px-5 pb-5' : 'p-5')}>{children}</div>
    </div>
  )
}

function Tick({ color = '#16a34a' }) {
  return <span className="w-4 h-4 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: color + '1a' }}><Check size={10} style={{ color }} strokeWidth={3}/></span>
}

function Segmented({ value, onChange, options }) {
  return (
    <div className="inline-flex gap-1 p-1 bg-slate-100 rounded-full">
      {options.map(([k, l, hint]) => (
        <button key={k} onClick={() => onChange(k)}
          className={clsx('px-4 py-1.5 rounded-full text-xs font-semibold transition-all',
            value === k ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700')}>
          {l}{hint && <span className="ml-1.5 text-[10px] font-bold text-emerald-600">{hint}</span>}
        </button>
      ))}
    </div>
  )
}

const BillingSwitch = ({ value, onChange }) => <Segmented value={value} onChange={onChange} options={[['monthly', 'Monthly'], ['yearly', 'Yearly', 'Save up to 19%']]}/>

function FeatureCell({ v, yearly }) {
  if (v === true)    return <span className="text-emerald-600 font-extrabold">✓</span>
  if (v === false)   return <span className="text-slate-300 text-base">—</span>
  if (v === 'addon') return <span className="inline-block text-[10px] font-semibold text-amber-700 bg-amber-50 border border-amber-200 rounded-md px-1.5 py-0.5">Add-on</span>
  if (typeof v === 'string') return <span className="text-[11px] text-slate-500">{v}</span>
  return (
    <span>
      <span className="font-semibold text-slate-800">{yearly ? `${num(v.perMonth * 12)} / yr` : `${num(v.perMonth)} / mo`}</span>
      <span className="block text-[10px] text-slate-400">{yearly ? 'one pool · use any time' : 'credited each month'}</span>
    </span>
  )
}

function Notice({ tone = 'info', icon: Icon = Info, children, action }) {
  const tones = {
    info:  'bg-sky-50 border-sky-200 text-sky-900',
    warn:  'bg-amber-50 border-amber-200 text-amber-900',
    error: 'bg-red-50 border-red-200 text-red-800',
    ok:    'bg-emerald-50 border-emerald-200 text-emerald-900',
  }
  return (
    <div className={clsx('flex items-start gap-2.5 p-3 rounded-xl border text-xs leading-relaxed', tones[tone])}>
      <Icon size={14} className="flex-shrink-0 mt-0.5"/>
      <div className="flex-1 min-w-0">{children}</div>
      {action}
    </div>
  )
}

/* ── the page ──────────────────────────────────────────────────────────── */
export default function BillingSection() {
  const { activeProductId } = useApp()
  const { currentUser } = useAuth()
  const web = activeProductId === 'webchat'          // Website Chat has no WhatsApp rows
  const { loading, error: loadError, sub, config, profile } = useSubscription()

  const [tab, setTab] = useState('overview')
  const [view, setView] = useState('yearly')          // which price list the Plans tab shows
  const [payMode, setPayMode] = useState('autopay')   // autopay | once
  const [dialog, setDialog] = useState(null)
  const [busy, setBusy] = useState(false)
  const [dlgError, setDlgError] = useState(null)
  const [toast, setToast] = useState(null)
  const [invoices, setInvoices] = useState(null)
  const [requested, setRequested] = useState({})
  const [editingDetails, setEditingDetails] = useState(false)
  // What we already know about this customer from their account — used to pre-fill the form.
  const accountDefaults = {
    legalName: currentUser?.workspace?.name,
    contactName: currentUser?.name,
    email: currentUser?.email,
    phone: currentUser?.phone,
    city: currentUser?.workspace?.city,
    stateCode: currentUser?.workspace?.stateCode,
  }
  const [quote, setQuote] = useState(null)
  const mounted = useRef(true)
  // Re-arm on every mount: React's dev double-mount runs the cleanup once before the real mount.
  useEffect(() => { mounted.current = true; return () => { mounted.current = false } }, [])
  useEffect(() => { refreshSubscription() }, [])
  // Coming back from a payment link (or a bank app) in another tab: pick up what changed.
  useEffect(() => {
    const onFocus = () => refreshSubscription()
    window.addEventListener('focus', onFocus)
    return () => window.removeEventListener('focus', onFocus)
  }, [])

  const hasSub = !!sub && sub.status !== 'none'
  const live = isLive(sub)
  const current = hasSub ? getPlan(sub.planName) : null
  const curIdx = hasSub ? planTier(sub.planName) : -1
  const pooled = hasSub && sub.period === 'yearly'
  const configured = config?.configured !== false

  const flash = (text, tone = 'ok') => {
    setToast({ text, tone })
    setTimeout(() => mounted.current && setToast(null), 4500)
  }

  /* While a dialog is open, ask the server what THIS customer pays — the GST split
     (CGST+SGST vs IGST) depends on their state. */
  useEffect(() => {
    if (!dialog?.plan) { setQuote(null); return }
    let off = false
    billing.quote({ plan: dialog.plan, period: dialog.period, addons: dialog.addons || [], addonsOnly: dialog.kind === 'addons-once', term: dialog.term || (dialog.period === 'yearly' ? 'monthly' : 'plan') }).then(q => !off && setQuote(q)).catch(() => !off && setQuote(null))
    return () => { off = true }
  }, [dialog?.plan, dialog?.period, dialog?.kind, dialog?.term, JSON.stringify(dialog?.addons || []), profile?.address?.stateCode])

  async function saveProfile(values) {
    const saved = await billing.saveProfile(values)
    setProfile(saved.profile)
    return saved.profile
  }

  /* Invoices load when their tab opens and after any payment. */
  useEffect(() => {
    if (tab !== 'invoices' || !configured) return
    let off = false
    billing.invoices().then(r => !off && setInvoices(r.items)).catch(() => !off && setInvoices([]))
    return () => { off = true }
  }, [tab, sub?.status, sub?.paidCount, configured])

  /* After authorising autopay, Razorpay takes a few seconds to mark it active. */
  async function waitUntilActive() {
    for (let i = 0; i < 6; i++) {
      await new Promise(r => setTimeout(r, 3000))
      const s = await billing.subscription().catch(() => null)
      if (!mounted.current) return
      if (s) setSubscription(s)
      if (s && !['authenticated', 'created'].includes(s.status)) return
    }
  }

  /* ── payment flows ─────────────────────────────────────────────────── */
  async function runCheckout(d) {
    setBusy(true); setDlgError(null)
    try {
      const session = await billing.checkout({ plan: d.plan, period: d.period, mode: d.mode, startAtCycleEnd: !!d.startAtCycleEnd, consent: !!d.consent, addons: d.addons || [] })
      // Prefill from the billing details so Checkout never has to guess (or reuse someone else's saved info).
      const response = await payWithRazorpay(session, profile
        ? { name: profile.contactName, email: profile.email, contact: `+91${profile.phone}` }
        : { name: currentUser?.name, email: currentUser?.email })
      const result = await billing.verify(response)
      setSubscription(result)
      setDialog(null)
      const invoiceNote = !d.startAtCycleEnd && result.latestInvoice ? ` Invoice ${result.latestInvoice.number} is ready under Invoices.` : ''
      flash((d.startAtCycleEnd ? 'Autopay authorised — it starts when your current plan ends.' : d.mode === 'autopay' ? 'Autopay is set up. Welcome aboard!' : 'Payment received — your plan is active.') + invoiceNote)
      if (['authenticated', 'created'].includes(result.status)) waitUntilActive()
    } catch (e) {
      if (e.code === 'dismissed') flash('Checkout closed — nothing was charged.', 'info')
      else if (e.code === 'payment_failed') flash(e.message, 'error')
      else setDlgError(e)
    } finally {
      if (mounted.current) setBusy(false)
    }
  }

  async function runChange(d) {
    setBusy(true); setDlgError(null)
    try {
      const result = await billing.changePlan({ plan: d.plan, period: d.period })
      setSubscription(result)
      setDialog(null)
      flash(result.appliedNow ? `You're now on ${result.planName}.` : `Switching to ${PLANS.find(p => p.id === d.plan).name} at renewal.`)
    } catch (e) { setDlgError(e) }
    finally { if (mounted.current) setBusy(false) }
  }

  async function runAddonsOnce(d) {
    setBusy(true); setDlgError(null)
    try {
      const session = await billing.addonsCheckout(d.addons || [], d.term || (d.period === 'yearly' ? 'monthly' : 'plan'))
      const response = await payWithRazorpay(session, profile
        ? { name: profile.contactName, email: profile.email, contact: `+91${profile.phone}` }
        : { name: currentUser?.name, email: currentUser?.email })
      const result = await billing.verify(response)
      setSubscription(result)
      setDialog(null)
      const added = result.extraAddons?.length ? Math.max(...result.extraAddons.map(a => a.until)) : result.currentEnd
      flash('Add-ons added until ' + fmtSec(added) + '. They are one-time, so they won\'t renew.')
    } catch (e) {
      if (e.code === 'dismissed') flash('Checkout closed — nothing was charged.', 'info')
      else if (e.code === 'payment_failed') flash(e.message, 'error')
      else setDlgError(e)
    } finally {
      if (mounted.current) setBusy(false)
    }
  }

  async function runUpdateCard() {
    setBusy(true); setDlgError(null)
    try {
      const session = await billing.updateCard()
      const response = await payWithRazorpay(session, profile
        ? { name: profile.contactName, email: profile.email, contact: `+91${profile.phone}` }
        : { name: currentUser?.name, email: currentUser?.email })
      const result = await billing.verify(response)
      setSubscription(result)
      setDialog(null)
      flash('Card updated. Your next renewal will use it — the ₹1 check is refunded.')
    } catch (e) {
      if (e.code === 'dismissed') flash('Checkout closed — your card was not changed.', 'info')
      else if (e.code === 'payment_failed') flash(e.message, 'error')
      else setDlgError(e)
    } finally {
      if (mounted.current) setBusy(false)
    }
  }

  async function runAutopayOff() {
    setBusy(true); setDlgError(null)
    try {
      setSubscription(await billing.setAutopay(false))
      setDialog(null)
      flash('Autopay is off. Your plan runs until the end of this period.', 'info')
    } catch (e) { setDlgError(e) }
    finally { if (mounted.current) setBusy(false) }
  }

  const confirm = (extras) => (dialog.kind === 'autopay-off' ? runAutopayOff() : dialog.kind === 'update-card' ? runUpdateCard() : dialog.kind === 'addons-once' ? runAddonsOnce(dialog) : dialog.kind === 'change' ? runChange(dialog) : runCheckout({ ...dialog, consent: !!extras?.consent }))

  /* What a plan card's button does, given where the customer is today. */
  function actionFor(plan, i, period) {
    const price = config?.prices?.[plan.id]?.[period]
    const same = hasSub && sub.plan === plan.id && sub.period === period
    if (!configured) return { label: 'Payments unavailable', disabled: true }
    if (!live) {
      return { label: payMode === 'autopay' ? 'Subscribe with autopay' : `Pay ${price ? money(price.total) : ''} once`, open: { kind: 'new', plan: plan.id, period, mode: payMode } }
    }
    if (sub.mode === 'autopay' && sub.autopay.on) {
      if (same) return { label: 'Your current plan', disabled: true }
      const card = sub.autopay.engine === 'token'
      if (card && sub.autopay.next?.plan === plan.id && sub.autopay.next?.period === period) return { label: sub.autopay.next.changed ? 'Starts at renewal' : 'Your current plan', disabled: true }
      const upgrade = price && price.total > sub.charge.total
      return { label: card ? `Switch to ${plan.name} at renewal` : `${upgrade ? 'Upgrade' : 'Switch'} to ${plan.name}`, open: { kind: 'change', plan: plan.id, period, upgrade: upgrade && !card } }
    }
    // Live, but one-time or autopay switched off: the plan will simply end.
    if (payMode === 'autopay') {
      return { label: same ? 'Turn on autopay' : `Start ${plan.name} at renewal`, open: { kind: 'new', plan: plan.id, period, mode: 'autopay', startAtCycleEnd: true } }
    }
    return { label: same ? 'Renew now' : `Switch now`, open: { kind: 'new', plan: plan.id, period, mode: 'once' } }
  }
  const openAction = (a) => { setDlgError(null); setDialog(a.open) }

  const groups = FEATURE_GROUPS.filter(g => !(web && g.wa)).map(g => ({ ...g, rows: g.rows.filter(r => !(web && r.wa)) })).filter(g => g.rows.length)
  const featureAddons = FEATURE_ADDONS.filter(a => !(web && a.wa))
  const usageAddons = USAGE_ADDONS.filter(a => !(web && a.wa))
  const usageEligible = live && curIdx >= 2
  /* Extras bought once on the running plan — autopay or not. */
  const canBuyAddons = configured && !!sub?.canBuyAddons
  const openAddons = (name) => {
    const def = name ? config?.addons?.find(x => x.name === name) : null
    setDlgError(null)
    setDialog({ kind: 'addons-once', plan: sub.plan, period: sub.period, mode: 'once', addons: def ? [{ id: def.id, qty: 1 }] : [], term: sub.period === 'yearly' ? 'monthly' : 'plan' })
  }

  const span = pooled ? 12 : 1
  const per = pooled ? 'yr' : 'mo'
  const svcAllowance = current ? current.serviceMsgs * span : 0
  const biAllowance = current ? current.biMsgs * span : 0
  const svcUsed = DEMO_USAGE.svcUsed, biUsed = DEMO_USAGE.biUsed

  const meters = !hasSub ? [] : web
    ? [
        { key: 'web', icon: Globe, label: 'Website messages', used: '8,412', of: 'Unlimited', pct: 0, color: '#0066ff', unlimited: true },
        { key: 'agents', icon: Users, label: 'Live agents', used: '3', of: '3 included', pct: 100, color: '#8b5cf6' },
        { key: 'lang', icon: Languages, label: 'Languages', used: '2', of: '2 included', pct: 100, color: '#0ea5e9' },
      ]
    : [
        { key: 'svc', icon: MessageSquare, label: 'WhatsApp service messages', used: num(svcUsed), of: `${num(svcAllowance)} / ${per}`, pct: Math.max(1, Math.round(svcUsed / svcAllowance * 100)), color: '#16a34a' },
        { key: 'bi', icon: Zap, label: 'WhatsApp BI messages', used: num(biUsed), of: `${num(biAllowance)} / ${per}`, pct: Math.max(1, Math.round(biUsed / biAllowance * 100)), color: '#f59e0b' },
        { key: 'agents', icon: Users, label: 'Live agents', used: '3', of: '3 included', pct: 100, color: '#8b5cf6' },
        { key: 'lang', icon: Languages, label: 'Languages', used: '2', of: '2 included', pct: 100, color: '#0ea5e9' },
      ]

  const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  const monthly = [1420, 1880, 2310, 2540, 2760, 2980, 3120, 2870, 2401, 1200]
  const maxBar = Math.max(...monthly)

  const methodLabel = describeMethod(sub?.paymentMethod)
  const termPct = hasSub && sub.currentStart && sub.currentEnd
    ? Math.min(100, Math.max(0, ((Date.now() / 1000 - sub.currentStart) / (sub.currentEnd - sub.currentStart)) * 100)) : 0

  /* Things the customer should know or act on. */
  const notices = []
  if (loadError) notices.push(<Notice key="err" tone="warn" icon={AlertCircle} action={<button onClick={refreshSubscription} className="inline-flex items-center gap-1 font-semibold underline"><RefreshCw size={11}/> Retry</button>}>{loadError.message}</Notice>)
  else if (!loading && config && config.configured === false) notices.push(<Notice key="cfg" tone="warn" icon={AlertCircle}>Payments aren't switched on yet — the Razorpay keys are missing on the server. Plans are shown for reference.</Notice>)
  if (sub?.stale) notices.push(<Notice key="stale" tone="warn" icon={AlertCircle}>Couldn't reach Razorpay just now, so this may be slightly out of date.</Notice>)
  if (sub?.status === 'past_due' && sub.dunning) {
    const dn = sub.dunning
    notices.push(
      <Notice key="dun" tone="error" icon={AlertCircle}
        action={dn.payUrl && <a href={dn.payUrl} target="_blank" rel="noreferrer" className="font-bold underline whitespace-nowrap">Pay now</a>}>
        <b>Payment failed.</b> We couldn't collect your {money(dn.amountPaise / 100)} renewal (attempt {dn.attempt} of {dn.maxAttempts}).{' '}
        {dn.nextAttemptAt ? <>{dn.engine === 'token' ? "We'll try your card again on" : "We'll ask again on"} <b>{fmtSec(dn.nextAttemptAt)}</b>. </> : dn.engine === 'token' ? 'That was the last automatic retry. ' : 'That was the last reminder. '}
        Your plan keeps working until <b>{fmtSec(dn.deadline)}</b>; pay before then to avoid suspension.
      </Notice>)
  }
  if (sub?.status === 'suspended') notices.push(
    <Notice key="susp" tone="error" icon={AlertCircle}
      action={configured && <button onClick={() => setTab('plans')} className="font-bold underline whitespace-nowrap">Choose a plan</button>}>
      <b>Your plan is suspended.</b> We couldn't collect the renewal within {sub.dunning?.maxAttempts ?? 4} attempts over 9 days. Pick a plan to restore access.
    </Notice>)
  if (live && sub.autopay?.lapsed) notices.push(
    <Notice key="lapsed" tone="warn" icon={Repeat}
      action={configured && !sub.upcoming && <button onClick={() => { setPayMode('autopay'); openAction({ open: { kind: 'new', plan: sub.plan, period: sub.period, mode: 'autopay', startAtCycleEnd: true } }) }} className="font-bold underline whitespace-nowrap">Turn on autopay</button>}>
      Autopay stopped after the failed payments. You've paid manually through <b>{fmtSec(sub.currentEnd)}</b> — turn autopay on again to renew automatically.
    </Notice>)
  if (sub?.status === 'halted') notices.push(<Notice key="halt" tone="error" icon={AlertCircle}>Your last autopay charge failed and Razorpay has stopped retrying. Subscribe again from the Plans tab to restore your plan.</Notice>)
  if (sub?.status === 'pending') notices.push(<Notice key="pend" tone="warn" icon={AlertCircle}>A renewal charge is waiting for your approval. Approve it in the link your bank sent, or retry from your banking app.</Notice>)
  if (sub?.status === 'authenticated') notices.push(<Notice key="auth" tone="info" icon={Loader2}>Autopay is authorised. Your plan will show as active in a moment…</Notice>)
  if (live && sub.endsAt && !sub.upcoming) notices.push(
    <Notice key="ends" tone="warn" icon={CalendarDays}
      action={configured && <button onClick={() => { setTab('plans'); }} className="font-bold underline whitespace-nowrap">Keep my plan</button>}>
      Your <b>{sub.planName}</b> plan ends on <b>{fmtSec(sub.endsAt)}</b>{sub.mode === 'once' ? ' (you paid once)' : ' (autopay is off)'}. After that you'll be on the free tier.
    </Notice>)
  if (sub?.upcoming) notices.push(<Notice key="up" tone="ok" icon={Repeat}>Autopay for <b>{sub.upcoming.planName}</b> ({sub.upcoming.period}) is set up and starts on <b>{fmtSec(sub.upcoming.startsAt)}</b>.</Notice>)
  if (sub?.scheduledChange) notices.push(<Notice key="sched" tone="info" icon={Repeat}>Switching to <b>{PLANS.find(p => p.id === sub.scheduledChange.plan)?.name}</b> ({sub.scheduledChange.period}) on <b>{fmtSec(sub.scheduledChange.at)}</b>.</Notice>)

  return (
    <div>
      {/* Header */}
      <div className="flex items-start justify-between gap-3 flex-wrap mb-4">
        <div>
          <h2 className="text-[15px] font-bold text-slate-900">Billing &amp; Plan</h2>
          <p className="text-[11px] text-slate-400 mt-0.5">Your subscription, usage and payment history</p>
        </div>
        {loading ? (
          <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-slate-500 bg-slate-100 rounded-full px-2.5 py-1"><Loader2 size={11} className="animate-spin"/> Loading…</span>
        ) : live ? (
          <span className={clsx('inline-flex items-center gap-1.5 text-[11px] font-semibold rounded-full px-2.5 py-1 border',
            sub.status === 'past_due' ? 'text-red-700 bg-red-50 border-red-200' : 'text-emerald-700 bg-emerald-50 border-emerald-200')}>
            <span className={clsx('w-1.5 h-1.5 rounded-full', sub.status === 'past_due' ? 'bg-red-500' : 'bg-emerald-500')}/> {sub.planName} · {sub.period === 'yearly' ? 'Yearly' : 'Monthly'} · {sub.status === 'past_due' ? 'Payment due' : sub.autopay.on ? 'Autopay on' : 'Active'}
          </span>
        ) : (
          <span className={clsx('inline-flex items-center gap-1.5 text-[11px] font-semibold rounded-full px-2.5 py-1 border', sub?.status === 'suspended' ? 'text-red-700 bg-red-50 border-red-200' : 'text-slate-600 bg-slate-100 border-slate-200')}>{sub?.status === 'suspended' ? 'Plan suspended' : hasSub ? 'Plan ended' : 'No active plan'}</span>
        )}
      </div>

      {/* Tabs */}
      <div className="overflow-x-auto mb-5">
        <div className="flex items-center gap-0.5 bg-slate-100 p-1 rounded-xl w-fit">
          {TABS.map(t => {
            const Icon = t.icon
            return (
              <button key={t.id} onClick={() => setTab(t.id)}
                className={clsx('flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-all whitespace-nowrap',
                  tab === t.id ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700')}>
                <Icon size={13}/> {t.label}
              </button>
            )
          })}
        </div>
      </div>

      {notices.length > 0 && tab !== 'invoices' && <div className="space-y-2 mb-4">{notices}</div>}

      {/* ───────────────────────── Overview ───────────────────────── */}
      {tab === 'overview' && (
        <div className="space-y-4">
          {!live ? (
            <div className="relative overflow-hidden rounded-2xl p-6 text-white" style={{ background: 'linear-gradient(135deg,#0f172a 0%,#1e1b4b 100%)' }}>
              <div className="absolute -right-16 -top-16 w-64 h-64 rounded-full opacity-30 blur-3xl bg-violet-500"/>
              <div className="relative">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-white/60">{hasSub ? 'Your plan has ended' : 'Current plan'}</p>
                <h3 className="text-2xl font-extrabold tracking-tight mt-1">{hasSub ? `${sub.planName} ended` : 'Free'}</h3>
                <p className="text-sm text-white/70 mt-1.5 max-w-md">Choose a plan to unlock bots, broadcasts, live agents and more. Pay with autopay or just once — your call.</p>
                <button onClick={() => setTab('plans')} className="mt-4 inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-white text-slate-900 text-xs font-bold hover:bg-slate-100 transition-colors">
                  Choose a plan <ArrowUpRight size={13}/>
                </button>
              </div>
            </div>
          ) : (
            <div className="relative overflow-hidden rounded-2xl p-5 sm:p-6 text-white" style={{ background: 'linear-gradient(135deg,#0f172a 0%,#1e1b4b 100%)' }}>
              <div className="absolute -right-16 -top-16 w-64 h-64 rounded-full opacity-30 blur-3xl" style={{ background: current.color }}/>
              <div className="relative flex flex-col sm:flex-row sm:items-end justify-between gap-5">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-white/60">Current plan</p>
                  <div className="flex items-center gap-2.5 mt-1 flex-wrap">
                    <h3 className="text-2xl font-extrabold tracking-tight">{current.name}</h3>
                    <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-white/15">{pooled ? 'Yearly' : 'Monthly'}</span>
                    <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-white/15">{sub.mode === 'autopay' ? (sub.autopay.on ? 'Autopay' : 'Autopay off') : 'Paid once'}</span>
                  </div>
                  <p className="mt-2 text-sm text-white/80">
                    <span className="text-lg font-bold text-white">{inr(pooled ? current.yearly : current.monthly)}</span> / {pooled ? 'year' : 'month'} <span className="text-white/50">+ GST</span>
                    <span className="text-white/50"> · {money(sub.charge.total)} incl. {sub.charge.gstPercent}% GST{sub.addons?.length ? ' with add-ons' : ''}</span>
                  </p>
                  {(sub.addons?.length > 0 || sub.extraAddons?.length > 0) && (
                    <div className="mt-2.5 flex flex-wrap gap-1.5">
                      {sub.addons?.map(a => <span key={a.id} className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-white/15 text-white/90">{a.name}{a.qty > 1 ? ` × ${a.qty}` : ''}</span>)}
                      {sub.extraAddons?.map((a, i) => <span key={'x' + i} title="One-time — does not renew" className="text-[10px] font-semibold px-2 py-0.5 rounded-full border border-white/30 text-white/80">{a.name}{a.qty > 1 ? ` × ${a.qty}` : ''} · once, until {fmtSec(a.until)}</span>)}
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={() => setTab('plans')} className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-white text-slate-900 text-xs font-bold hover:bg-slate-100 transition-colors">
                    Change plan <ArrowUpRight size={13}/>
                  </button>
                  <button onClick={() => setTab('invoices')} className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-white/10 text-white text-xs font-semibold hover:bg-white/20 transition-colors">Invoices</button>
                </div>
              </div>
              <div className="relative mt-5">
                <div className="flex items-center justify-between text-[11px] text-white/70 mb-1.5">
                  <span className="flex items-center gap-1.5"><CalendarDays size={12}/> {fmtSec(sub.currentStart)} → {fmtSec(sub.currentEnd)}</span>
                  <span className="font-semibold text-white">{sub.currentEnd ? `${daysUntil(sub.currentEnd)} days ${sub.endsAt ? 'left' : 'until renewal'}` : '—'}</span>
                </div>
                <div className="h-1.5 rounded-full bg-white/15 overflow-hidden"><div className="h-full rounded-full bg-white/80" style={{ width: `${termPct}%` }}/></div>
              </div>
            </div>
          )}

          {live && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-[13px] font-bold text-slate-900">Usage snapshot</h3>
                <button onClick={() => setTab('usage')} className="text-[11px] font-semibold text-primary hover:underline">View details</button>
              </div>
              <div className={clsx('grid grid-cols-1 sm:grid-cols-2 gap-3', web ? 'xl:grid-cols-3' : 'xl:grid-cols-4')}>
                {meters.map(m => {
                  const Icon = m.icon
                  return (
                    <div key={m.key} className="rounded-2xl border border-surface-border bg-white p-4 flex items-center gap-3.5">
                      <Ring pct={m.unlimited ? 0 : m.pct} color={m.color}>{m.unlimited ? '∞' : `${m.pct}%`}</Ring>
                      <div className="min-w-0">
                        <p className="text-[11px] text-slate-500 flex items-center gap-1.5"><Icon size={12} style={{ color: m.color }}/> <span className="truncate">{m.label}</span></p>
                        <p className="text-base font-bold text-slate-900 tabular-nums mt-0.5">{m.used}</p>
                        <p className="text-[10.5px] text-slate-400">of {m.of}</p>
                      </div>
                    </div>
                  )
                })}
              </div>
              {pooled && !web && (
                <p className="flex items-start gap-1.5 text-[11px] text-slate-500 mt-2.5">
                  <Info size={12} className="flex-shrink-0 mt-0.5 text-slate-400"/>
                  Your yearly allowance is one pool — there's no monthly limit. Use it at any pace until {fmtSec(sub.currentEnd)}.
                </p>
              )}
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            {/* Autopay */}
            <Card title="Autopay"
              action={hasSub && <span className={clsx('text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full', sub.status === 'past_due' ? 'bg-red-50 text-red-700' : live && sub.autopay.on ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500')}>{sub.status === 'past_due' ? 'Past due' : live && sub.autopay.on ? 'On' : 'Off'}</span>}>
              {sub?.status === 'past_due' && sub.dunning ? (
                <div className="space-y-3">
                  <div className="rounded-xl bg-red-50/60 border border-red-100 px-4 py-3">
                    <p className="text-[10.5px] text-red-700/80">Amount due</p>
                    <p className="text-sm font-bold text-slate-900 mt-0.5">{money(sub.dunning.amountPaise / 100)} <span className="text-xs font-medium text-slate-500">· pay by {fmtSec(sub.dunning.deadline)}</span></p>
                  </div>
                  <ol className="space-y-1.5">
                    {sub.dunning.attempts.map(a => (
                      <li key={a.n} className="flex items-start gap-2 text-[11px]">
                        <span className={clsx('w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-bold flex-shrink-0 mt-0.5',
                          a.result === 'failed' || a.result === 'send_failed' ? 'bg-red-100 text-red-700' : a.result === 'paid' ? 'bg-emerald-100 text-emerald-700' : 'bg-sky-100 text-sky-700')}>{a.n}</span>
                        <span className="text-slate-600 leading-snug"><b className="text-slate-800">{fmtSec(a.at)}</b> · {a.kind === 'charge' ? (a.result === 'pending' ? 'Automatic debit submitted — waiting for the bank' : a.result === 'paid' ? 'Automatic debit succeeded' : `Automatic debit failed${a.reason ? ` (${a.reason})` : ''}`) : a.result === 'send_failed' ? "Couldn't send the reminder" : a.result === 'expired' ? 'Reminder sent (replaced by a newer one)' : 'Reminder sent by email & SMS'}</span>
                      </li>
                    ))}
                    {sub.dunning.nextAttemptAt && (
                      <li className="flex items-start gap-2 text-[11px] text-slate-400">
                        <span className="w-4 h-4 rounded-full border border-dashed border-slate-300 flex-shrink-0 mt-0.5"/>
                        <span>{sub.dunning.engine === 'token' ? 'Next automatic retry' : 'Next reminder'} <b className="text-slate-500">{fmtSec(sub.dunning.nextAttemptAt)}</b> (attempt {sub.dunning.attempt + 1} of {sub.dunning.maxAttempts})</span>
                      </li>
                    )}
                  </ol>
                  <div className="flex items-center gap-3">
                    {sub.dunning.payUrl && <a href={sub.dunning.payUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-primary text-white text-xs font-bold hover:bg-primary-hover transition-colors"><ExternalLink size={12}/> Pay now</a>}
                    {sub.autopay.canUpdateCard && <button onClick={() => { setDlgError(null); setDialog({ kind: 'update-card' }) }} className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline"><CreditCard size={11}/> Update card</button>}
                    <button onClick={refreshSubscription} className="inline-flex items-center gap-1 text-xs font-semibold text-slate-500 hover:text-slate-800"><RefreshCw size={11}/> I've paid — refresh</button>
                  </div>
                  <p className="text-[10.5px] text-slate-400 leading-relaxed">{sub.dunning.engine === 'token' ? 'We retry your saved card on the dates above and email you before each one. Paying now with the button above also clears this.' : 'Your bank may also retry the card automatically. If any attempt succeeds, this clears by itself.'}</p>
                </div>
              ) : live && sub.autopay.on ? (
                <div className="space-y-3">
                  <div className="rounded-xl bg-slate-50 border border-slate-100 px-4 py-3">
                    <p className="text-[10.5px] text-slate-400">Next charge</p>
                    <p className="text-sm font-bold text-slate-900 mt-0.5">{money(sub.autopay.next?.total ?? sub.charge.total)} <span className="text-xs font-medium text-slate-500">on {fmtSec(sub.nextChargeAt)}{sub.autopay.next?.changed ? ` · ${sub.autopay.next.planName}` : ''}</span></p>
                    {sub.autopay.engine === 'token' && <p className="text-[10.5px] text-slate-400 mt-1">{sub.autopay.next?.noticeSent ? 'Debit notice sent — the card is charged on this date.' : `We email you 2 days before.`}</p>}
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-[11px]">
                    <div className="rounded-lg border border-slate-100 px-3 py-2"><p className="text-slate-400">{sub.autopay.card ? 'Card' : 'Mandate'}</p><p className="font-semibold text-slate-700 mt-0.5">{sub.autopay.card ? `${sub.autopay.card.network || 'Card'} •••• ${sub.autopay.card.last4 || ''}` : `Up to ${money(sub.charge.total)} every ${sub.period === 'yearly' ? 'year' : 'month'}`}</p></div>
                    <div className="rounded-lg border border-slate-100 px-3 py-2"><p className="text-slate-400">Authorised</p><p className="font-semibold text-slate-700 mt-0.5">{sub.authorisedAt ? fmtSec(sub.authorisedAt) : '—'}</p></div>
                  </div>
                  <p className="text-[11px] text-slate-500 leading-relaxed">We notify you at <b>{profile?.email || 'your email'}</b> before every debit. You can turn autopay off any time.</p>
                  {sub.autopay.requiresApproval && sub.autopay.engine !== 'token' && (
                    <p className="flex items-start gap-2 text-[11px] text-amber-800 bg-amber-50 border border-amber-200 rounded-lg p-2.5 leading-relaxed">
                      <AlertCircle size={12} className="flex-shrink-0 mt-0.5"/>
                      Renewals above {money(sub.autopay.approvalLimit)} need your approval each time. Your bank sends a link about a day before — approve it and the plan renews.
                    </p>
                  )}
                  <div className="flex items-center gap-4 flex-wrap">
                    {sub.autopay.canUpdateCard && <button onClick={() => { setDlgError(null); setDialog({ kind: 'update-card' }) }} className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline"><CreditCard size={12}/> Update payment method</button>}
                    <button onClick={() => { setDlgError(null); setDialog({ kind: 'autopay-off' }) }} className="text-xs font-semibold text-red-600 hover:underline">Turn off autopay</button>
                  </div>
                </div>
              ) : live ? (
                <div className="space-y-3">
                  <p className="text-xs text-slate-500 leading-relaxed">
                    {sub.upcoming ? `Autopay for ${sub.upcoming.planName} starts on ${fmtSec(sub.upcoming.startsAt)}.`
                      : sub.mode === 'once' ? 'You paid once for this period, so nothing renews automatically.'
                      : 'Autopay is off, so nothing renews automatically.'}
                  </p>
                  {!sub.upcoming && configured && (
                    <button onClick={() => { setPayMode('autopay'); openAction({ open: { kind: 'new', plan: sub.plan, period: sub.period, mode: 'autopay', startAtCycleEnd: true } }) }}
                      className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-primary text-white text-xs font-bold hover:bg-primary-hover transition-colors">
                      <Repeat size={12}/> Turn on autopay
                    </button>
                  )}
                </div>
              ) : (
                <p className="text-xs text-slate-500">Autopay starts when you subscribe. You can turn it off any time.</p>
              )}
            </Card>

            {/* Payment method */}
            <Card title="Payment method">
              {methodLabel ? (
                <div className="flex items-center gap-3">
                  <span className="w-11 h-8 rounded-md bg-gradient-to-br from-slate-700 to-slate-900 flex items-center justify-center flex-shrink-0"><CreditCard size={15} className="text-white"/></span>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-slate-800">{methodLabel}</p>
                    <p className="text-[10.5px] text-slate-400">{sub.autopay?.on ? 'Used for renewals' : 'Used for your last payment'}</p>
                  </div>
                  {sub.autopay?.canUpdateCard && <button onClick={() => { setDlgError(null); setDialog({ kind: 'update-card' }) }} className="text-[11px] font-semibold text-primary hover:underline flex-shrink-0">Update</button>}
                </div>
              ) : (
                <p className="text-xs text-slate-500">No payment method yet — it's saved securely by Razorpay when you pay.</p>
              )}
              <p className="text-[10.5px] text-slate-400 mt-3 leading-relaxed">Card details never touch our servers. {sub?.autopay?.canUpdateCard ? 'Use Update to switch to a different card — your plan and renewal date stay the same.' : 'To use a different card, set up autopay again with the new one.'}</p>
            </Card>
          </div>
        </div>
      )}

      {/* ───────────────────────── Plans ───────────────────────── */}
      {tab === 'plans' && (
        <div className="space-y-5">
          <div className="flex flex-col items-center gap-3 text-center">
            <div className="flex items-center justify-center gap-3 flex-wrap">
              <BillingSwitch value={view} onChange={setView}/>
              <Segmented value={payMode} onChange={setPayMode} options={[['autopay', 'Autopay'], ['once', 'Pay once']]}/>
            </div>
            <p className="text-[11px] text-slate-400 max-w-md">
              {payMode === 'autopay' ? 'Authorise once and your plan renews automatically. Cancel any time.' : 'One payment for one period. It won’t renew on its own.'} Prices exclude GST — it's added at checkout.
            </p>
          </div>

          <div className="flex items-start gap-3 rounded-xl border border-surface-border bg-slate-50/60 px-4 py-3">
            <Building2 size={15} className="text-slate-400 flex-shrink-0 mt-0.5"/>
            <div className="flex-1 min-w-0 [overflow-wrap:anywhere]">
              {profile ? (
                <>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Billing to</p>
                  <p className="text-xs font-semibold text-slate-800 mt-0.5">{profile.legalName}</p>
                  <p className="text-[11px] text-slate-500 leading-snug">{addressLine(profile, config?.states)}</p>
                  <p className="text-[11px] text-slate-400">{profile.email} · +91 {profile.phone}{profile.gstin ? ' · GSTIN ' + profile.gstin : ''}</p>
                </>
              ) : (
                <>
                  <p className="text-xs font-semibold text-slate-800">Add your billing details</p>
                  <p className="text-[11px] text-slate-500 leading-snug">We'll pre-fill what we know from your account. Needed for your GST invoice and payment notices.</p>
                </>
              )}
            </div>
            <button onClick={() => setEditingDetails(true)} className="text-[11px] font-semibold text-primary hover:underline flex-shrink-0">{profile ? 'Edit' : 'Add details'}</button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3 pt-2">
            {PLANS.map((plan, i) => {
              const m = planMath(plan)
              const y = view === 'yearly'
              const price = config?.prices?.[plan.id]?.[view]
              const sameTier = live && sub.plan === plan.id
              const act = actionFor(plan, i, view)
              return (
                <div key={plan.id} className={clsx('relative rounded-2xl bg-white flex flex-col border-2 transition-shadow', sameTier ? 'shadow-md' : 'hover:shadow-md')}
                  style={{ borderColor: sameTier ? plan.color : '#e2e8f0' }}>
                  {(plan.highlight || sameTier) && (
                    <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 text-[10px] font-bold uppercase tracking-wider text-white px-2.5 py-0.5 rounded-full whitespace-nowrap" style={{ background: plan.color }}>
                      {sameTier ? 'Current plan' : 'Most popular'}
                    </span>
                  )}
                  <div className="p-5 pb-4">
                    <p className="text-[13px] font-bold" style={{ color: plan.color }}>{plan.name}</p>
                    <p className="mt-2 flex items-baseline gap-1">
                      <span className="text-[26px] font-extrabold tracking-tight text-slate-900">{inr(y ? plan.yearly : plan.monthly)}</span>
                      <span className="text-xs text-slate-400">/ {y ? 'year' : 'month'}</span>
                    </p>
                    <p className="text-[11px] text-slate-500 mt-0.5 h-4">{y ? `≈ ${inr(m.yearlyPerMonth)} / month` : `${inr(m.year)} over 12 months`}</p>
                    <div className="h-6 mt-2">
                      {y
                        ? <span className="inline-block text-[11px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-md px-1.5 py-0.5">Save {inr(m.saves)} ({m.savesPct}%)</span>
                        : <span className="text-[11px] font-semibold text-emerald-600">Save {m.savesPct}% with yearly</span>}
                    </div>
                    {price && <p className="text-[10.5px] text-slate-400 mt-1">{money(price.total)} incl. {price.gstPercent}% GST</p>}
                    <button disabled={act.disabled} onClick={() => openAction(act)}
                      className={clsx('w-full mt-3 py-2 rounded-lg text-xs font-bold transition-colors',
                        act.disabled ? 'bg-slate-100 text-slate-400 cursor-default' : 'text-white hover:opacity-90')}
                      style={act.disabled ? undefined : { background: plan.color }}>
                      {act.label}
                    </button>
                  </div>
                  <div className="border-t border-slate-100 p-5 pt-4 flex-1 space-y-2">
                    {PLAN_HIGHLIGHTS[plan.id].map(h => (
                      <p key={h} className="flex items-start gap-2 text-[11.5px] text-slate-600 leading-snug"><Tick color={plan.color}/> {h}</p>
                    ))}
                  </div>
                  {!web && (
                    <div className="border-t border-slate-100 px-5 py-3 bg-slate-50/70 rounded-b-2xl space-y-0.5">
                      <p className="text-[10.5px] text-slate-500"><b className="text-slate-700 tabular-nums">{num(y ? plan.serviceMsgs * 12 : plan.serviceMsgs)}</b> service msgs / {y ? 'yr' : 'mo'}</p>
                      <p className="text-[10.5px] text-slate-500"><b className="text-slate-700 tabular-nums">{num(y ? plan.biMsgs * 12 : plan.biMsgs)}</b> BI msgs / {y ? 'yr' : 'mo'}</p>
                    </div>
                  )}
                </div>
              )
            })}
          </div>

          <Card title="Good to know">
            <ul className="space-y-2.5">
              <li className="flex items-start gap-2.5 text-xs text-slate-600 leading-relaxed"><Info size={13} className="text-slate-400 flex-shrink-0 mt-0.5"/>
                <span><b>How limits are credited:</b> monthly plans get the monthly allowance every month. Yearly plans get all 12 months' allowance credited once, upfront, as one pool — there is no monthly cap.</span></li>
              <li className="flex items-start gap-2.5 text-xs text-slate-600 leading-relaxed"><Info size={13} className="text-slate-400 flex-shrink-0 mt-0.5"/>
                <span><b>Autopay and bigger renewals:</b> card and UPI rules require your approval for any automatic debit above ₹15,000. That includes every yearly plan — your bank sends an approval link before each renewal.</span></li>
              {!web && <li className="flex items-start gap-2.5 text-xs text-slate-600 leading-relaxed"><Info size={13} className="text-slate-400 flex-shrink-0 mt-0.5"/>
                <span><b>Meta charges:</b> on WhatsApp service (UI) and BI messages the customer must add a payment card in Meta Business Manager. Meta's per-message charges apply on top of the plan price.</span></li>}
              <li className="flex items-start gap-2.5 text-xs text-slate-600 leading-relaxed"><Info size={13} className="text-slate-400 flex-shrink-0 mt-0.5"/>
                <span><b>GST</b> is charged extra at checkout. Custom development is quoted and charged separately on every plan.</span></li>
            </ul>
          </Card>

          <div>
            <h3 className="text-[13px] font-bold text-slate-900 mb-2">Compare all features</h3>
            <div className="rounded-2xl border border-surface-border bg-white overflow-x-auto">
              <table className="w-full min-w-[680px]">
                <thead>
                  <tr className="border-b border-slate-200">
                    <th className="px-4 py-3 text-left text-[10px] font-bold text-slate-400 uppercase tracking-wider w-[28%]">Feature</th>
                    {PLANS.map((p, i) => (
                      <th key={p.id} className={clsx('px-3 py-3 text-center text-[11px] font-bold uppercase tracking-wider', live && i === curIdx && 'bg-slate-50')} style={{ color: p.color }}>
                        {p.name}{live && i === curIdx && <span className="block text-[9px] font-semibold text-slate-400 normal-case tracking-normal">Current</span>}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {groups.map(g => (
                    <Fragment key={g.group}>
                      <tr><td colSpan={5} className="px-4 py-2 bg-slate-50 border-y border-slate-100 text-[10px] font-bold text-slate-400 uppercase tracking-wider">{g.group}</td></tr>
                      {g.rows.map(r => (
                        <tr key={r.label} className="border-b border-slate-100 last:border-0">
                          <td className="px-4 py-2.5 text-xs font-medium text-slate-700">
                            {r.label}{r.note && <span className="block text-[10px] font-normal text-slate-400">{r.note}</span>}
                          </td>
                          {r.v.map((v, i) => <td key={i} className={clsx('px-3 py-2.5 text-center text-xs', live && i === curIdx && 'bg-slate-50/70')}><FeatureCell v={v} yearly={view === 'yearly'}/></td>)}
                        </tr>
                      ))}
                    </Fragment>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ───────────────────────── Usage ───────────────────────── */}
      {tab === 'usage' && (!hasSub ? (
        <Card><p className="text-xs text-slate-500">Usage shows up once you're on a plan. <button onClick={() => setTab('plans')} className="font-semibold text-primary hover:underline">Choose a plan</button></p></Card>
      ) : (
        <div className="space-y-4">
          {!web ? (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {meters.slice(0, 2).map(m => {
                  const Icon = m.icon
                  const left = (m.key === 'svc' ? svcAllowance - svcUsed : biAllowance - biUsed)
                  return (
                    <Card key={m.key}>
                      <div className="flex items-center gap-4">
                        <Ring pct={m.pct} color={m.color} size={84} stroke={9}>{m.pct}%</Ring>
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-semibold text-slate-600 flex items-center gap-1.5"><Icon size={13} style={{ color: m.color }}/> {m.label}</p>
                          <p className="text-xl font-extrabold text-slate-900 tabular-nums mt-1">{m.used}</p>
                          <p className="text-[11px] text-slate-400">used of {m.of}</p>
                          <p className="text-[11px] font-semibold mt-1.5" style={{ color: m.color }}>{num(left)} left {pooled ? 'in your yearly pool' : 'this month'}</p>
                        </div>
                      </div>
                    </Card>
                  )
                })}
              </div>

              {pooled && (
                <Card title="Service messages this year" desc="Your allowance is one pool for the year — use it at any pace, no monthly limit.">
                  <div className="flex gap-1.5 sm:gap-2.5">
                    {MONTHS.map((mo, i) => {
                      const v = monthly[i] || 0
                      const h = v ? Math.max(6, Math.round((v / maxBar) * 100)) : 0
                      return (
                        <div key={mo} className="flex-1 min-w-0 group" title={v ? `${mo}: ${num(v)} messages` : `${mo}: no usage yet`}>
                          <div className="h-32 flex flex-col justify-end items-stretch">
                            <span className="text-[10px] font-semibold tabular-nums text-slate-500 text-center mb-1 opacity-0 group-hover:opacity-100 transition-opacity">{v ? num(v) : ''}</span>
                            <div className="rounded-t-md transition-all"
                              style={{ height: v ? `${h * 0.9}%` : 4, background: v ? 'rgb(var(--accent))' : '#f1f5f9', opacity: i === monthly.length - 1 ? 0.55 : 1 }}/>
                          </div>
                          <p className="text-[10px] text-slate-400 text-center mt-1.5">{mo}</p>
                        </div>
                      )
                    })}
                  </div>
                  <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500 flex-wrap gap-1">
                    <span>{num(svcUsed)} used so far</span>
                    <span>{num(svcAllowance - svcUsed)} remaining until {fmtSec(sub.currentEnd)}</span>
                  </div>
                </Card>
              )}
            </>
          ) : (
            <Card title="Website chat" desc="Website and Instagram messages are unlimited on every plan.">
              <p className="text-2xl font-extrabold text-slate-900 tabular-nums">8,412 <span className="text-sm font-medium text-slate-400">messages this month</span></p>
            </Card>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {meters.filter(m => m.key === 'agents' || m.key === 'lang').map(m => {
              const Icon = m.icon
              return (
                <Card key={m.key}>
                  <div className="flex items-center gap-3">
                    <span className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: m.color + '1a' }}><Icon size={16} style={{ color: m.color }}/></span>
                    <div className="flex-1">
                      <p className="text-xs font-semibold text-slate-600">{m.label}</p>
                      <p className="text-[11px] text-slate-400">{m.used} of {m.of}</p>
                    </div>
                    <button onClick={() => setTab('addons')} className="text-[11px] font-semibold text-primary hover:underline">Need more?</button>
                  </div>
                </Card>
              )
            })}
          </div>
        </div>
      ))}

      {/* ───────────────────────── Add-ons ───────────────────────── */}
      {tab === 'addons' && (
        <div className="space-y-6">
          <div>
            <div className="mb-2">
              <h3 className="text-[13px] font-bold text-slate-900">Feature add-ons</h3>
              <p className="text-[11px] text-slate-400">Turn on features your plan doesn't include.</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
              {featureAddons.map(a => {
                const onPlans = a.on.split(', ')
                const needed = !current || onPlans.includes(current.name)
                const key = 'f:' + a.name
                return (
                  <div key={a.name} className="rounded-2xl border border-surface-border bg-white p-4 flex flex-col">
                    <p className="text-xs font-bold text-slate-900 leading-snug">{a.name}</p>
                    {a.note && <p className="text-[10px] text-slate-400">({a.note})</p>}
                    <p className="text-[10.5px] text-slate-400 mt-1">Add-on on {a.on}</p>
                    <div className="mt-auto pt-3">
                      {needed ? (
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-[11px] text-slate-500">Price on request</span>
                          <button onClick={() => setRequested(r => ({ ...r, [key]: true }))} disabled={requested[key]}
                            className={clsx('px-3 py-1.5 rounded-lg text-[11px] font-bold transition-colors', requested[key] ? 'bg-emerald-50 text-emerald-700' : 'bg-primary text-white hover:bg-primary-hover')}>
                            {requested[key] ? '✓ Requested' : 'Request'}
                          </button>
                        </div>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-emerald-700"><Tick/> Included in {current.name}</span>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          <div>
            <div className="flex items-end justify-between gap-3 flex-wrap mb-2">
              <div>
                <h3 className="text-[13px] font-bold text-slate-900">Usage add-ons</h3>
                <p className="text-[11px] text-slate-400">Extra capacity on Pro &amp; AI plans · excl. GST · add them when you subscribe or renew</p>
              </div>
              <BillingSwitch value={view} onChange={setView}/>
            </div>
            {canBuyAddons && (
              <div className="flex items-start gap-3 p-3.5 rounded-xl bg-primary/[0.04] border border-primary/20 mb-2">
                <Puzzle size={15} className="text-primary flex-shrink-0 mt-0.5"/>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-bold text-slate-800">Buy add-ons once</p>
                  <p className="text-[11px] text-slate-500 leading-relaxed mt-0.5">
                    One payment, no renewal. {sub.period === 'yearly' ? <>Take them for <b>one month</b> at the monthly price, or until <b>{fmtSec(sub.currentEnd)}</b> at the yearly price.</> : <>Valid until <b>{fmtSec(sub.currentEnd)}</b>.</>} {sub.autopay?.on ? 'Your autopay and plan are not changed.' : ''}
                  </p>
                  {sub.extraAddons?.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {sub.extraAddons.map((a, i) => <span key={i} className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-white border border-primary/20 text-slate-600">{a.name}{a.qty > 1 ? ` × ${a.qty}` : ''} · until {fmtSec(a.until)}</span>)}
                    </div>
                  )}
                </div>
                <button onClick={() => openAddons()} className="px-3 py-1.5 rounded-lg bg-primary text-white text-[11px] font-bold hover:bg-primary-hover flex-shrink-0">Choose add-ons</button>
              </div>
            )}
            {!usageEligible && (
              <div className="flex items-start gap-2 p-3 rounded-xl bg-slate-50 border border-slate-200 mb-2">
                <Lock size={13} className="text-slate-400 flex-shrink-0 mt-0.5"/>
                <p className="text-xs text-slate-500">Usage add-ons are available on Pro and AI plans. <button onClick={() => setTab('plans')} className="font-semibold text-primary hover:underline">{live ? 'Upgrade' : 'Choose a plan'}</button> to buy extra capacity.</p>
              </div>
            )}
            <div className="rounded-2xl border border-surface-border bg-white overflow-hidden">
              {usageAddons.map((a, i) => {
                const key = 'u:' + a.name
                return (
                  <div key={a.name} className={clsx('flex items-center gap-3 px-4 py-3', i > 0 && 'border-t border-slate-100')}>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-slate-800">{a.name}</p>
                      <p className="text-[10.5px] text-slate-400">{a.unit}</p>
                    </div>
                    <span className="text-xs font-bold text-slate-900 tabular-nums whitespace-nowrap">{canBuyAddons && sub.period === 'yearly' ? `${inr(a.m)} / mo · ${inr(a.y)} / yr` : (canBuyAddons ? sub.period : view) === 'yearly' ? `${inr(a.y)} / yr` : `${inr(a.m)} / mo`}</span>
                    <button disabled={!usageEligible || (!canBuyAddons && requested[key])} onClick={() => (canBuyAddons ? openAddons(a.name) : setRequested(r => ({ ...r, [key]: true })))}
                      className={clsx('w-[84px] py-1.5 rounded-lg text-[11px] font-bold transition-colors flex-shrink-0',
                        !canBuyAddons && requested[key] ? 'bg-emerald-50 text-emerald-700' : usageEligible ? 'border border-primary text-primary hover:bg-primary/5' : 'bg-slate-100 text-slate-300 cursor-not-allowed')}>
                      {!canBuyAddons && requested[key] ? '✓ Added' : canBuyAddons ? 'Buy once' : 'Add'}
                    </button>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}

      {/* ───────────────────────── Invoices ───────────────────────── */}
      {tab === 'invoices' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <Card title="Payment method">
              {methodLabel ? (
                <div className="flex items-center gap-3">
                  <span className="w-11 h-8 rounded-md bg-gradient-to-br from-slate-700 to-slate-900 flex items-center justify-center flex-shrink-0"><CreditCard size={15} className="text-white"/></span>
                  <div>
                    <p className="text-xs font-semibold text-slate-800">{methodLabel}</p>
                    <p className="text-[10.5px] text-slate-400">{sub.mode === 'autopay' ? 'Used for renewals' : 'Used for your last payment'}</p>
                  </div>
                </div>
              ) : <p className="text-xs text-slate-500">No payment method yet.</p>}
            </Card>
            <Card title="Billing details" action={<button onClick={() => setEditingDetails(true)} className="text-[11px] font-semibold text-primary hover:underline">{profile ? 'Edit' : 'Add details'}</button>}>
              {profile ? (
                <div className="flex items-start gap-3">
                  <span className="w-9 h-9 rounded-xl bg-slate-100 flex items-center justify-center flex-shrink-0"><Building2 size={16} className="text-slate-500"/></span>
                  <div className="min-w-0 [overflow-wrap:anywhere]">
                    <p className="text-xs font-semibold text-slate-800">{profile.legalName}</p>
                    <p className="text-[10.5px] text-slate-500 leading-snug">{addressLine(profile, config?.states)}</p>
                    <p className="text-[10.5px] text-slate-400 mt-1">{profile.contactName} · {profile.email} · +91 {profile.phone}</p>
                    <p className="text-[10.5px] text-slate-400 flex items-center gap-1 mt-0.5">
                      <ShieldCheck size={11}/> {profile.gstin ? <>GSTIN <span className="font-mono">{profile.gstin}</span></> : 'No GSTIN'} · Place of supply: {stateNameOf(config?.states, profile.address.stateCode)}
                    </p>
                  </div>
                </div>
              ) : (
                <p className="text-xs text-slate-500 leading-relaxed">Add who's paying — name, address and GSTIN — so your GST invoices are right. It's also asked at your first payment.</p>
              )}
            </Card>
          </div>

          <Card title="Payment history" desc="Amounts include GST">
            <div className="-mx-5 -mb-5 overflow-x-auto">
              <table className="w-full min-w-[560px]">
                <thead>
                  <tr className="border-y border-slate-100 bg-slate-50/60">
                    {['Invoice', 'Date', 'Description', 'Amount', 'Status', ''].map(h => <th key={h} className="px-5 py-2.5 text-left text-[10px] font-bold text-slate-400 uppercase tracking-wider">{h}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {invoices === null && <tr><td colSpan={6} className="px-5 py-8 text-center text-xs text-slate-400"><Loader2 size={14} className="animate-spin inline mr-1.5"/>Loading…</td></tr>}
                  {invoices?.length === 0 && <tr><td colSpan={6} className="px-5 py-10 text-center text-xs text-slate-400">No payments yet. They'll appear here after your first charge.</td></tr>}
                  {invoices?.map(inv => (
                    <tr key={inv.id} className="border-b border-slate-100 last:border-0">
                      <td className="px-5 py-3 text-xs font-mono font-semibold text-slate-800 max-w-[160px] truncate">{inv.number}</td>
                      <td className="px-5 py-3 text-xs text-slate-500 whitespace-nowrap">{fmtSec(inv.date)}</td>
                      <td className="px-5 py-3 text-xs text-slate-600">{inv.description}</td>
                      <td className="px-5 py-3 text-xs font-bold text-slate-900 tabular-nums whitespace-nowrap">{money(inv.amountPaise / 100)}</td>
                      <td className="px-5 py-3">
                        <span className={clsx('text-[10px] font-bold rounded-full px-2 py-0.5 border capitalize',
                          inv.status === 'paid' ? 'text-emerald-700 bg-emerald-50 border-emerald-200' : inv.status === 'failed' || inv.status === 'expired' ? 'text-red-700 bg-red-50 border-red-200' : 'text-amber-700 bg-amber-50 border-amber-200')}>{inv.status}</span>
                      </td>
                      <td className="px-5 py-3 text-right">
                        {inv.url
                          ? <a href={inv.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-slate-600 border border-surface-border rounded-lg px-2.5 py-1.5 hover:bg-surface-hover transition-colors"><ExternalLink size={11}/> Invoice</a>
                          : <span className="inline-flex items-center gap-1 text-[11px] text-slate-300"><Download size={11}/> —</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}

      {editingDetails && (
        <div className="fixed inset-0 z-[70] bg-slate-900/50 flex items-center justify-center p-4 overflow-y-auto" onClick={(e) => e.target === e.currentTarget && setEditingDetails(false)}>
          <div className="bg-white rounded-2xl shadow-modal w-full max-w-md animate-fade-in my-auto">
            <div className="flex items-start justify-between gap-3 px-5 pt-5 pb-3">
              <div><h3 className="text-[15px] font-bold text-slate-900">Billing details</h3><p className="text-xs text-slate-400 mt-0.5">Used on future invoices and payment notices</p></div>
              <button onClick={() => setEditingDetails(false)} className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100"><X size={15}/></button>
            </div>
            <div className="px-5 pb-5">
              <BillingDetailsForm initial={profile} defaults={accountDefaults} states={config?.states} onCancel={() => setEditingDetails(false)}
                onSubmit={async (values) => { await saveProfile(values); setEditingDetails(false); flash('Billing details saved.') }}/>
            </div>
          </div>
        </div>
      )}

      <PaymentDialog dialog={dialog} config={config} sub={sub} profile={profile} defaults={accountDefaults} quote={quote} busy={busy} error={dlgError}
        web={web} onAddonsChange={(addons) => setDialog(d => (d ? { ...d, addons } : d))} onTermChange={(term) => setDialog(d => (d ? { ...d, term } : d))} onSaveProfile={saveProfile} onConfirm={confirm} onClose={() => { if (!busy) setDialog(null) }}
        onPayOnceInstead={() => { setPayMode('once'); setDlgError(null); setDialog(d => ({ ...d, mode: 'once', startAtCycleEnd: false })) }}
        onStartAtRenewal={() => { setDlgError(null); setDialog(d => ({ kind: 'new', plan: d.plan, period: d.period, mode: 'autopay', startAtCycleEnd: true })) }}/>

      {toast && (
        <div className={clsx('fixed bottom-5 left-1/2 -translate-x-1/2 z-[80] flex items-center gap-2 px-4 py-2.5 rounded-xl text-white text-xs font-semibold shadow-xl animate-fade-in max-w-[90vw]',
          toast.tone === 'error' ? 'bg-red-600' : 'bg-slate-900')}>
          {toast.tone === 'error' ? <AlertCircle size={14}/> : <CheckCircle2 size={14} className={toast.tone === 'ok' ? 'text-emerald-400' : 'text-sky-300'}/>} {toast.text}
        </div>
      )}
    </div>
  )
}
