import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import clsx from 'clsx'
import { Check, Copy, Loader2, X } from 'lucide-react'
import { STATUS_STYLE, statusLabel } from '../../lib/ctwaApi'

export const inputCls = 'w-full rounded-lg border border-surface-border bg-white px-3 py-2 text-xs text-slate-800 outline-none focus:border-primary placeholder:text-slate-400 disabled:bg-slate-50 disabled:text-slate-400'

export function Card({ title, sub, right, children, className, bodyClass }) {
  return (
    <section className={clsx('bg-white border border-surface-border rounded-xl overflow-hidden', className)}>
      {(title || right) && (
        <div className="flex items-center gap-3 px-4 py-3 border-b border-surface-border">
          <div className="flex-1 min-w-0">
            <h3 className="text-xs font-bold text-slate-800">{title}</h3>
            {sub && <p className="text-[10.5px] text-slate-400 mt-0.5">{sub}</p>}
          </div>
          {right}
        </div>
      )}
      <div className={bodyClass}>{children}</div>
    </section>
  )
}

/** "▲ 12%" against the previous period. goodWhenUp: true = more is better, false = less is better (costs), null = neutral (spend). */
export function Delta({ now, before, goodWhenUp = true }) {
  if (!before || now === null || now === undefined) return null
  const change = ((now - before) / before) * 100
  if (!Number.isFinite(change) || Math.abs(change) < 0.5) return <span className="text-[10px] font-semibold text-slate-400">no change</span>
  const up = change > 0
  const tone = goodWhenUp === null ? 'text-slate-500 bg-slate-100' : up === goodWhenUp ? 'text-emerald-700 bg-emerald-50' : 'text-red-600 bg-red-50'
  return <span className={clsx('inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md text-[10px] font-bold tabular-nums', tone)}>{up ? '▲' : '▼'} {Math.abs(change) >= 100 ? Math.round(Math.abs(change)) : Math.abs(change).toFixed(1)}%</span>
}

/** A tiny trend line for a card. */
export function Spark({ values, color = '#5B5BF0', id }) {
  if (!values || values.length < 2) return <div className="h-8" />
  const max = Math.max(...values), min = Math.min(...values), span = max - min || 1
  const pts = values.map((v, i) => [(i / (values.length - 1)) * 100, 26 - ((v - min) / span) * 22])
  const line = pts.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)},${y.toFixed(1)}`).join(' ')
  return (
    <svg viewBox="0 0 100 28" preserveAspectRatio="none" className="w-full h-8" aria-hidden>
      <defs><linearGradient id={`sp-${id}`} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={color} stopOpacity="0.22" /><stop offset="100%" stopColor={color} stopOpacity="0" /></linearGradient></defs>
      <path d={`${line} L100,28 L0,28 Z`} fill={`url(#sp-${id})`} />
      <path d={line} fill="none" stroke={color} strokeWidth="1.6" vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
    </svg>
  )
}

/** A headline number: icon, the number, change vs the previous period, and a trend line. */
export function Stat({ label, value, sub, icon: Icon, tone = 'text-primary bg-primary-50', delta, spark, sparkColor, sparkId, onClick }) {
  const Tag = onClick ? 'button' : 'div'
  return (
    <Tag onClick={onClick} className={clsx('bg-white border border-surface-border rounded-2xl p-4 flex flex-col text-left shadow-[0_1px_2px_rgba(15,23,42,0.03)]', onClick && 'hover:border-primary/40 hover:shadow-md transition-all')}>
      <div className="flex items-start justify-between">
        <span className={clsx('w-8 h-8 rounded-xl flex items-center justify-center', tone)}>{Icon && <Icon size={15} />}</span>
        {delta}
      </div>
      <p className="text-[22px] font-bold leading-none text-slate-900 tabular-nums mt-3.5">{value}</p>
      <p className="text-[11px] font-semibold text-slate-500 mt-1.5">{label}</p>
      {sub && <p className="text-[10px] text-slate-400 mt-0.5">{sub}</p>}
      {spark && <div className="mt-2 -mx-1"><Spark values={spark} color={sparkColor} id={sparkId || label} /></div>}
    </Tag>
  )
}

/** Pill switcher (time ranges, filters). options: [{ key, label, count? }] */
export function Segmented({ options, value, onChange, className }) {
  return (
    <div role="tablist" className={clsx('inline-flex items-center gap-0.5 bg-slate-100 p-0.5 rounded-xl max-w-full overflow-x-auto', className)}>
      {options.map(({ key, label, count }) => (
        <button key={key} role="tab" aria-selected={value === key} onClick={() => onChange(key)}
          className={clsx('flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-semibold rounded-[10px] transition-all whitespace-nowrap', value === key ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700')}>
          {label}{count !== undefined && <span className={clsx('text-[10px] font-bold px-1.5 rounded-full', value === key ? 'bg-primary/10 text-primary' : 'bg-slate-200/70 text-slate-500')}>{count}</span>}
        </button>
      ))}
    </div>
  )
}

const DOT = { ACTIVE: 'bg-emerald-500', PAUSED: 'bg-slate-400', CAMPAIGN_PAUSED: 'bg-slate-400', ADSET_PAUSED: 'bg-slate-400', PENDING_REVIEW: 'bg-amber-500', IN_PROCESS: 'bg-amber-500', DISAPPROVED: 'bg-red-500', WITH_ISSUES: 'bg-red-500' }
export const StatusPill = ({ status }) => (
  <span className={clsx('inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold whitespace-nowrap', STATUS_STYLE[status] || 'bg-slate-100 text-slate-600')}>
    <span className={clsx('w-1.5 h-1.5 rounded-full', DOT[status] || 'bg-slate-400')} />{statusLabel(status)}
  </span>
)

/** An id that copies on click. */
export function CopyChip({ value, label }) {
  const [done, setDone] = useState(false)
  return (
    <button onClick={() => navigator.clipboard?.writeText(value).then(() => { setDone(true); setTimeout(() => setDone(false), 1300) }).catch(() => {})} title="Copy" aria-label={`Copy ${label || value}`}
      className="inline-flex items-center gap-1.5 font-mono text-[11px] text-slate-600 hover:text-primary break-all text-left">
      {value}{done ? <Check size={11} className="text-emerald-500 flex-shrink-0" /> : <Copy size={11} className="text-slate-300 flex-shrink-0" />}
    </button>
  )
}

export function Switch({ on, onChange, disabled, label }) {
  return (
    <button role="switch" aria-checked={on} aria-label={label} disabled={disabled} onClick={() => onChange(!on)}
      className={clsx('relative w-9 h-5 rounded-full transition-colors flex-shrink-0 disabled:opacity-50', on ? 'bg-emerald-500' : 'bg-slate-300')}>
      <span className={clsx('absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform', on && 'translate-x-4')} />
    </button>
  )
}

export function Field({ label, hint, error, children, className }) {
  return (
    <div className={className}>
      <label className="block text-[11px] font-semibold text-slate-700 mb-1">{label}</label>
      {children}
      {error ? <p role="alert" className="text-[10.5px] text-red-600 mt-1">{error}</p> : hint && <p className="text-[10px] text-slate-400 mt-1">{hint}</p>}
    </div>
  )
}

export const Spinner = ({ label = 'Loading…' }) => (
  <div className="flex items-center justify-center gap-2 py-16 text-xs text-slate-400"><Loader2 size={15} className="animate-spin" /> {label}</div>
)

export function Banner({ tone = 'info', children, action }) {
  const tones = { info: 'bg-blue-50 border-blue-100 text-blue-800', warn: 'bg-amber-50 border-amber-100 text-amber-800', error: 'bg-red-50 border-red-100 text-red-700', ok: 'bg-emerald-50 border-emerald-100 text-emerald-800' }
  return (
    <div role={tone === 'error' ? 'alert' : 'status'} className={clsx('flex items-start gap-3 rounded-xl border px-4 py-3 text-xs', tones[tone])}>
      <div className="flex-1 leading-relaxed">{children}</div>
      {action}
    </div>
  )
}

/** A panel that slides in from the right over the page (Escape or a click outside closes it). */
const openDrawers = []                              // drawers can stack (an ad's page over the list, a lead over the ad): Escape closes only the top one
export function Drawer({ title, sub, onClose, width = 'max-w-[600px]', z = 'z-[60]', children }) {
  useEffect(() => {
    const me = {}
    openDrawers.push(me)
    const esc = (e) => { if (e.key === 'Escape' && openDrawers[openDrawers.length - 1] === me) onClose() }
    document.addEventListener('keydown', esc)
    return () => { document.removeEventListener('keydown', esc); openDrawers.splice(openDrawers.indexOf(me), 1) }
  }, [onClose])
  return createPortal(
    <div className={clsx('fixed inset-0 bg-slate-900/30 flex justify-end', z)} onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <aside role="dialog" aria-label={typeof title === 'string' ? title : 'Details'} className={clsx('w-full h-full bg-slate-50 shadow-modal flex flex-col animate-fade-in', width)}>
        <header className="flex items-start gap-3 px-5 py-4 bg-white border-b border-surface-border flex-shrink-0">
          <div className="flex-1 min-w-0">{title}{sub && <div className="mt-0.5">{sub}</div>}</div>
          <button onClick={onClose} aria-label="Close" className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100"><X size={16} /></button>
        </header>
        <div className="flex-1 overflow-y-auto">{children}</div>
      </aside>
    </div>, document.body)
}
