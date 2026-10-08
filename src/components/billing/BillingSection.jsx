// BillingSection.jsx — "Billing & Plan" in Settings.
//
// Five focused tabs instead of one long scroll:
//   Overview  – the current plan, how much is used, what's next
//   Plans     – monthly/yearly switch, the four plans, full comparison
//   Usage     – allowances and how the year is going
//   Add-ons   – feature add-ons and usage add-ons
//   Invoices  – payment method, billing details and history
//
// Prices, allowances and features come from constants/pricing.js. The demo
// workspace is on Pro, billed yearly. A yearly plan's allowance is ONE pool for
// the year — there is no monthly cap.
import { useState, Fragment } from 'react'
import clsx from 'clsx'
import {
  LayoutDashboard, Layers, BarChart2, Puzzle, Receipt, Check, Download, ArrowUpRight, CreditCard,
  CalendarDays, Info, Sparkles, ShieldCheck, Building2, Users, Languages, MessageSquare, Globe, Zap, Lock,
} from 'lucide-react'
import { useApp } from '../../context/AppContext'
import {
  PLANS, PLAN_HIGHLIGHTS, FEATURE_GROUPS, FEATURE_ADDONS, USAGE_ADDONS, CURRENT_PLAN, CURRENT_BILLING,
  SUBSCRIPTION, getPlan, planTier, planMath, inr, num,
} from '../../constants/pricing'

const TABS = [
  { id: 'overview', label: 'Overview', icon: LayoutDashboard },
  { id: 'plans',    label: 'Plans',    icon: Layers },
  { id: 'usage',    label: 'Usage',    icon: BarChart2 },
  { id: 'addons',   label: 'Add-ons',  icon: Puzzle },
  { id: 'invoices', label: 'Invoices', icon: Receipt },
]

const INVOICES = [
  { id: 'INV-2026-01', date: 'Jan 1, 2026', desc: 'Pro plan · yearly', amount: 72000, status: 'Paid' },
]

const DAY = 86400000
const fmtDate = d => new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })

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

function BillingSwitch({ value, onChange }) {
  return (
    <div className="inline-flex gap-1 p-1 bg-slate-100 rounded-full">
      {[['monthly', 'Monthly'], ['yearly', 'Yearly']].map(([k, l]) => (
        <button key={k} onClick={() => onChange(k)}
          className={clsx('px-4 py-1.5 rounded-full text-xs font-semibold transition-all',
            value === k ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700')}>
          {l}{k === 'yearly' && <span className="ml-1.5 text-[10px] font-bold text-emerald-600">Save up to 19%</span>}
        </button>
      ))}
    </div>
  )
}

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

/* ── the page ──────────────────────────────────────────────────────────── */
export default function BillingSection() {
  const { activeProductId } = useApp()
  const web = activeProductId === 'webchat'          // Website Chat has no WhatsApp rows
  const [tab, setTab] = useState('overview')
  const [view, setView] = useState(CURRENT_BILLING)  // which price list the Plans tab shows
  const [requested, setRequested] = useState({})

  const current = getPlan(CURRENT_PLAN)
  const curIdx = planTier(CURRENT_PLAN)
  const pooled = CURRENT_BILLING === 'yearly'
  const span = pooled ? 12 : 1
  const per = pooled ? 'yr' : 'mo'
  const svcAllowance = current.serviceMsgs * span
  const biAllowance = current.biMsgs * span
  const svcUsed = 23481, biUsed = 1204

  const now = Date.now()
  const start = new Date(SUBSCRIPTION.start).getTime(), end = new Date(SUBSCRIPTION.renews).getTime()
  const daysLeft = Math.max(0, Math.ceil((end - now) / DAY))
  const termPct = Math.min(100, Math.max(0, ((now - start) / (end - start)) * 100))
  const price = pooled ? current.yearly : current.monthly

  const groups = FEATURE_GROUPS.filter(g => !(web && g.wa)).map(g => ({ ...g, rows: g.rows.filter(r => !(web && r.wa)) })).filter(g => g.rows.length)
  const featureAddons = FEATURE_ADDONS.filter(a => !(web && a.wa))
  const usageAddons = USAGE_ADDONS.filter(a => !(web && a.wa))
  const usageEligible = curIdx >= 2

  const meters = web
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
  const monthly = [1420, 1880, 2310, 2540, 2760, 2980, 3120, 2870, 2401, 1200]   // sums to svcUsed
  const maxBar = Math.max(...monthly)

  return (
    <div>
      {/* Header */}
      <div className="flex items-start justify-between gap-3 flex-wrap mb-4">
        <div>
          <h2 className="text-[15px] font-bold text-slate-900">Billing &amp; Plan</h2>
          <p className="text-[11px] text-slate-400 mt-0.5">Your subscription, usage and payment history</p>
        </div>
        <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-full px-2.5 py-1">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"/> {current.name} · {pooled ? 'Yearly' : 'Monthly'} · Active
        </span>
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

      {/* ───────────────────────── Overview ───────────────────────── */}
      {tab === 'overview' && (
        <div className="space-y-4">
          {/* hero */}
          <div className="relative overflow-hidden rounded-2xl p-5 sm:p-6 text-white" style={{ background: 'linear-gradient(135deg,#0f172a 0%,#1e1b4b 100%)' }}>
            <div className="absolute -right-16 -top-16 w-64 h-64 rounded-full opacity-30 blur-3xl" style={{ background: current.color }}/>
            <div className="relative flex flex-col sm:flex-row sm:items-end justify-between gap-5">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wider text-white/60">Current plan</p>
                <div className="flex items-center gap-2.5 mt-1">
                  <h3 className="text-2xl font-extrabold tracking-tight">{current.name}</h3>
                  <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-white/15">{pooled ? 'Yearly' : 'Monthly'}</span>
                </div>
                <p className="mt-2 text-sm text-white/80">
                  <span className="text-lg font-bold text-white">{inr(price)}</span> / {pooled ? 'year' : 'month'} <span className="text-white/50">+ GST</span>
                  {pooled && <span className="text-white/50"> · ≈ {inr(planMath(current).yearlyPerMonth)} / mo</span>}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => setTab('plans')} className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-white text-slate-900 text-xs font-bold hover:bg-slate-100 transition-colors">
                  Change plan <ArrowUpRight size={13}/>
                </button>
                <button onClick={() => setTab('invoices')} className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-white/10 text-white text-xs font-semibold hover:bg-white/20 transition-colors">
                  Invoices
                </button>
              </div>
            </div>
            <div className="relative mt-5">
              <div className="flex items-center justify-between text-[11px] text-white/70 mb-1.5">
                <span className="flex items-center gap-1.5"><CalendarDays size={12}/> {fmtDate(SUBSCRIPTION.start)} → {fmtDate(SUBSCRIPTION.renews)}</span>
                <span className="font-semibold text-white">{daysLeft} days until renewal</span>
              </div>
              <div className="h-1.5 rounded-full bg-white/15 overflow-hidden"><div className="h-full rounded-full bg-white/80" style={{ width: `${termPct}%` }}/></div>
            </div>
          </div>

          {/* usage snapshot */}
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
                Your yearly allowance is one pool — there's no monthly limit. Use it at any pace until {fmtDate(SUBSCRIPTION.renews)}.
              </p>
            )}
          </div>

          {/* upgrade nudge + details */}
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-3">
            {curIdx < PLANS.length - 1 && (
              <div className="lg:col-span-3 rounded-2xl border border-violet-200 bg-gradient-to-br from-violet-50 to-white p-5 flex items-start gap-3.5">
                <span className="w-9 h-9 rounded-xl bg-violet-100 flex items-center justify-center flex-shrink-0"><Sparkles size={16} className="text-violet-600"/></span>
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-bold text-slate-900">Add ChatGPT to your bot</p>
                  <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                    {PLANS[curIdx + 1].name} includes everything in {current.name}, plus {curIdx + 1 === 3 ? 'built-in ChatGPT, and the highest message allowances.' : 'more platforms and allowances.'}
                  </p>
                  <button onClick={() => { setView(CURRENT_BILLING); setTab('plans') }} className="mt-3 inline-flex items-center gap-1.5 text-xs font-bold text-violet-700 hover:underline">
                    Compare plans <ArrowUpRight size={12}/>
                  </button>
                </div>
              </div>
            )}
            <Card title="Payment method" className={curIdx < PLANS.length - 1 ? 'lg:col-span-2' : 'lg:col-span-5'}>
              <div className="flex items-center gap-3">
                <span className="w-11 h-8 rounded-md bg-gradient-to-br from-slate-700 to-slate-900 flex items-center justify-center flex-shrink-0"><CreditCard size={15} className="text-white"/></span>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-slate-800">Visa •••• 4242</p>
                  <p className="text-[10.5px] text-slate-400">Expires 08 / 28</p>
                </div>
                <button className="text-[11px] font-semibold text-primary hover:underline">Update</button>
              </div>
            </Card>
          </div>
        </div>
      )}

      {/* ───────────────────────── Plans ───────────────────────── */}
      {tab === 'plans' && (
        <div className="space-y-5">
          <div className="flex flex-col items-center gap-2 text-center">
            <BillingSwitch value={view} onChange={setView}/>
            <p className="text-[11px] text-slate-400">All prices are in ₹ and exclusive of GST.</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3 pt-2">
            {PLANS.map((plan, i) => {
              const m = planMath(plan)
              const y = view === 'yearly'
              const isCurrent = i === curIdx && view === CURRENT_BILLING
              const sameTier = i === curIdx
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
                    <button disabled={isCurrent}
                      className={clsx('w-full mt-3 py-2 rounded-lg text-xs font-bold transition-colors',
                        isCurrent ? 'bg-slate-100 text-slate-400 cursor-default' : 'text-white hover:opacity-90')}
                      style={isCurrent ? undefined : { background: plan.color }}>
                      {isCurrent ? 'Your current plan' : sameTier ? `Switch to ${view}` : i > curIdx ? `Upgrade to ${plan.name}` : `Switch to ${plan.name}`}
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
                      <th key={p.id} className={clsx('px-3 py-3 text-center text-[11px] font-bold uppercase tracking-wider', i === curIdx && 'bg-slate-50')} style={{ color: p.color }}>
                        {p.name}{i === curIdx && <span className="block text-[9px] font-semibold text-slate-400 normal-case tracking-normal">Current</span>}
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
                          {r.v.map((v, i) => <td key={i} className={clsx('px-3 py-2.5 text-center text-xs', i === curIdx && 'bg-slate-50/70')}><FeatureCell v={v} yearly={view === 'yearly'}/></td>)}
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
      {tab === 'usage' && (
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
                    <span>{num(svcAllowance - svcUsed)} remaining until {fmtDate(SUBSCRIPTION.renews)}</span>
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
      )}

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
                const needed = onPlans.includes(current.name)
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
                <p className="text-[11px] text-slate-400">Extra capacity on Pro &amp; AI plans · indicative prices, excl. GST</p>
              </div>
              <BillingSwitch value={view} onChange={setView}/>
            </div>
            {!usageEligible && (
              <div className="flex items-start gap-2 p-3 rounded-xl bg-slate-50 border border-slate-200 mb-2">
                <Lock size={13} className="text-slate-400 flex-shrink-0 mt-0.5"/>
                <p className="text-xs text-slate-500">Usage add-ons are available on Pro and AI plans. <button onClick={() => setTab('plans')} className="font-semibold text-primary hover:underline">Upgrade</button> to buy extra capacity.</p>
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
                    <span className="text-xs font-bold text-slate-900 tabular-nums whitespace-nowrap">{view === 'yearly' ? `${inr(a.y)} / yr` : `${inr(a.m)} / mo`}</span>
                    <button disabled={!usageEligible || requested[key]} onClick={() => setRequested(r => ({ ...r, [key]: true }))}
                      className={clsx('w-[84px] py-1.5 rounded-lg text-[11px] font-bold transition-colors flex-shrink-0',
                        requested[key] ? 'bg-emerald-50 text-emerald-700' : usageEligible ? 'border border-primary text-primary hover:bg-primary/5' : 'bg-slate-100 text-slate-300 cursor-not-allowed')}>
                      {requested[key] ? '✓ Added' : 'Add'}
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
            <Card title="Payment method" action={<button className="text-[11px] font-semibold text-primary hover:underline">Update</button>}>
              <div className="flex items-center gap-3">
                <span className="w-11 h-8 rounded-md bg-gradient-to-br from-slate-700 to-slate-900 flex items-center justify-center flex-shrink-0"><CreditCard size={15} className="text-white"/></span>
                <div>
                  <p className="text-xs font-semibold text-slate-800">Visa •••• 4242</p>
                  <p className="text-[10.5px] text-slate-400">Expires 08 / 28 · used for renewals</p>
                </div>
              </div>
            </Card>
            <Card title="Billing details" action={<button className="text-[11px] font-semibold text-primary hover:underline">Edit</button>}>
              <div className="flex items-start gap-3">
                <span className="w-9 h-9 rounded-xl bg-slate-100 flex items-center justify-center flex-shrink-0"><Building2 size={16} className="text-slate-500"/></span>
                <div>
                  <p className="text-xs font-semibold text-slate-800">ChatFlow Inc.</p>
                  <p className="text-[10.5px] text-slate-400">Mumbai, India · admin@chatflow.io</p>
                  <p className="text-[10.5px] text-slate-400 flex items-center gap-1 mt-0.5"><ShieldCheck size={11}/> GST invoice details on file</p>
                </div>
              </div>
            </Card>
          </div>

          <Card title="Invoice history" desc="Amounts exclude GST, which is shown on each invoice">
            <div className="-mx-5 -mb-5 overflow-x-auto">
              <table className="w-full min-w-[560px]">
                <thead>
                  <tr className="border-y border-slate-100 bg-slate-50/60">
                    {['Invoice', 'Date', 'Description', 'Amount', 'Status', ''].map(h => <th key={h} className="px-5 py-2.5 text-left text-[10px] font-bold text-slate-400 uppercase tracking-wider">{h}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {INVOICES.map(inv => (
                    <tr key={inv.id} className="border-b border-slate-100 last:border-0">
                      <td className="px-5 py-3 text-xs font-mono font-semibold text-slate-800">{inv.id}</td>
                      <td className="px-5 py-3 text-xs text-slate-500">{inv.date}</td>
                      <td className="px-5 py-3 text-xs text-slate-600">{inv.desc}</td>
                      <td className="px-5 py-3 text-xs font-bold text-slate-900 tabular-nums">{inr(inv.amount)}</td>
                      <td className="px-5 py-3"><span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-full px-2 py-0.5">{inv.status}</span></td>
                      <td className="px-5 py-3 text-right">
                        <button className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-slate-600 border border-surface-border rounded-lg px-2.5 py-1.5 hover:bg-surface-hover transition-colors"><Download size={11}/> PDF</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}
    </div>
  )
}
