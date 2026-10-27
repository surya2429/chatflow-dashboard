// ui.jsx — small pieces shared by the admin console tabs (components/admin/*).
import { useEffect, useRef } from 'react'
import clsx from 'clsx'
import { X } from 'lucide-react'
import { PLANS, addonAllowances } from '../../constants/pricing'

export const fmtDate = (sec) => (sec ? new Date(sec * 1000).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '—')
export const daysFromNow = (sec) => Math.round((sec * 1000 - Date.now()) / 86400000)
export function fmtRel(sec) {
  if (!sec) return ''
  const d = daysFromNow(sec)
  if (d === 0) return 'today'
  if (d === 1) return 'tomorrow'
  if (d === -1) return 'yesterday'
  return d > 0 ? `in ${d} days` : `${-d} days ago`
}
export const rupees = (n) => '₹' + Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })
export const num = (n) => Number(n || 0).toLocaleString('en-IN')

export const inputCls = 'w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary/10 bg-white disabled:bg-slate-50'
export const labelCls = 'block text-xs font-semibold text-slate-600 mb-1.5'
export const btnPrimary = 'inline-flex items-center justify-center gap-1.5 bg-primary text-white rounded-lg px-3.5 py-2 text-sm font-semibold hover:bg-primary-hover disabled:opacity-50 disabled:cursor-not-allowed'
export const btnGhost = 'inline-flex items-center justify-center gap-1.5 border border-slate-200 bg-white text-slate-700 rounded-lg px-3 py-2 text-sm font-semibold hover:bg-slate-50 disabled:opacity-50'

const STATUS = {
  active:        ['Active', 'bg-emerald-50 text-emerald-700 border-emerald-200'],
  authenticated: ['Starting', 'bg-sky-50 text-sky-700 border-sky-200'],
  past_due:      ['Past due', 'bg-amber-50 text-amber-700 border-amber-200'],
  suspended:     ['Suspended', 'bg-red-50 text-red-700 border-red-200'],
  expired:       ['Expired', 'bg-slate-100 text-slate-600 border-slate-200'],
  cancelled:     ['Cancelled', 'bg-slate-100 text-slate-600 border-slate-200'],
  none:          ['No plan', 'bg-slate-50 text-slate-500 border-slate-200'],
}
/* How SmatBot sells to the client. A partner client belongs to a partner. */
export const CUSTOMER_TYPES = [
  ['direct', 'Direct client'],
  ['white_label', 'White label client'],
  ['partner', 'Partner'],
  ['partner_client', 'Partner client'],
  ['on_premise', 'On-premise client'],
]
export const customerTypeLabel = (t) => (CUSTOMER_TYPES.find(([v]) => v === t) || CUSTOMER_TYPES[0])[1]
export const PARTNER_TYPE = { partner_client: 'partner' }

export const STATUS_OPTIONS = [['active', 'Active'], ['past_due', 'Past due'], ['expired', 'Expired'], ['suspended', 'Suspended'], ['none', 'No plan']]

export function StatusPill({ status }) {
  const [label, cls] = STATUS[status] || [String(status).replace('_', ' '), 'bg-slate-50 text-slate-500 border-slate-200']
  return <span className={clsx('inline-block text-[11px] font-semibold border rounded-md px-1.5 py-0.5 whitespace-nowrap', cls)}>{label}</span>
}

/* Centred dialog, or a panel from the right (side). Escape and the backdrop close it —
   Escape only the top one, when one is open over another. */
const openModals = []
export function Modal({ title, subtitle, onClose, side, wide, children }) {
  const close = useRef(onClose)
  close.current = onClose
  useEffect(() => {
    const self = {}
    openModals.push(self)
    const onKey = (e) => e.key === 'Escape' && openModals[openModals.length - 1] === self && close.current()
    window.addEventListener('keydown', onKey)
    return () => { openModals.splice(openModals.indexOf(self), 1); window.removeEventListener('keydown', onKey) }
  }, [])
  return (
    <div className={clsx('fixed inset-0 z-50 bg-slate-900/40 flex', side ? 'justify-end' : 'items-center justify-center p-4')}
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div role="dialog" aria-modal="true" aria-label={title}
        className={clsx('bg-white shadow-2xl flex flex-col min-w-0', side ? 'w-full max-w-2xl h-full' : clsx('w-full rounded-2xl max-h-[92vh]', wide ? 'max-w-4xl h-[92vh]' : 'max-w-lg'))}>
        <div className="flex items-start gap-3 px-5 py-4 border-b border-slate-100">
          <div className="flex-1 min-w-0">
            <h2 className="text-base font-bold text-slate-900 truncate">{title}</h2>
            {subtitle && <div className="text-xs text-slate-500 mt-0.5">{subtitle}</div>}
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100"><X size={16}/></button>
        </div>
        <div className="flex-1 overflow-y-auto">{children}</div>
      </div>
    </div>
  )
}

export function Kpi({ label, value, sub, warn }) {
  return (
    <div className="bg-white border border-slate-200 rounded-xl px-4 py-3 min-w-0">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400 truncate">{label}</p>
      <p className={clsx('text-xl font-bold mt-1 tabular-nums truncate', warn ? 'text-amber-600' : 'text-slate-900')}>{value}</p>
      {sub && <p className="text-xs text-slate-400 mt-0.5 truncate">{sub}</p>}
    </div>
  )
}

/* A row of toggle buttons for one filter. */
export function Chips({ label, value, onChange, options }) {
  return (
    <div role="group" aria-label={label} className="flex flex-wrap gap-1">
      {options.map(([v, l]) => (
        <button key={v} type="button" aria-pressed={value === v} onClick={() => onChange(v)}
          className={clsx('px-2.5 py-1 rounded-lg text-xs font-semibold border transition-colors whitespace-nowrap',
            value === v ? 'bg-primary text-white border-primary' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50')}>
          {l}
        </button>
      ))}
    </div>
  )
}

export function ErrorNote({ children }) {
  return children ? <p role="alert" className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{children}</p> : null
}

/* Spreadsheet download. Cells starting with = + - @ are prefixed so Excel doesn't run them as formulas. */
export function downloadCsv(filename, rows) {
  const cell = (v) => {
    let s = String(v ?? '')
    if (/^[=+\-@]/.test(s)) s = `'${s}`
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
  }
  const url = URL.createObjectURL(new Blob([rows.map((r) => r.map(cell).join(',')).join('\n')], { type: 'text/csv;charset=utf-8' }))
  const a = document.createElement('a')
  a.href = url; a.download = filename; a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

/* What the customer's plan and add-ons entitle them to — same arithmetic as Settings → Billing → Usage.
   Consumption isn't metered yet, so these are allowances, not usage. */
export function allowancesOf(c) {
  const p = PLANS.find((x) => x.id === c.plan)
  if (!p) return []
  const span = c.period === 'yearly' ? 12 : 1
  const per = c.period === 'yearly' ? 'per year' : 'per month'
  const ex = addonAllowances({ period: c.period, addons: c.addons, extraAddons: c.extraAddons })
  const proLike = p.id === 'pro' || p.id === 'ai'
  return [
    { label: 'Chatbots', value: p.chatbots + ex.bots, extra: ex.bots },
    { label: 'WhatsApp service messages', value: p.serviceMsgs * span, per },
    { label: 'WhatsApp BI messages', value: p.biMsgs * span + ex.bi, per, extra: ex.bi },
    { label: 'Live agents', value: (proLike ? 3 : 0) + ex.agents, extra: ex.agents },
    { label: 'Languages', value: (proLike ? 2 : 1) + ex.lang, extra: ex.lang },
    ...(p.id !== 'broadcast' ? [{ label: 'Website & Instagram messages', value: 'Unlimited' }] : []),
    ...ex.own.map((o) => ({ label: o.label, value: o.allowance, per: o.sources.every((s) => s.kind === 'plan') ? per : 'incl. one-time add-ons' })),
  ]
}

export const initialsOf = (name) => String(name || '?').split(/\s+/).filter(Boolean).map((w) => w[0]).join('').slice(0, 2).toUpperCase()
