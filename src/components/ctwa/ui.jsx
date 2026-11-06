import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import clsx from 'clsx'
import { ChevronLeft, ChevronRight, Inbox, Loader2, X } from 'lucide-react'
import { statusLabel } from '../../lib/ctwaApi'

/* The CTWA screens share the look of Broadcasting: white `card`s, uppercase micro-labels, segmented tabs,
   ringed status pills, rounded-lg header buttons and a stepped modal. */

export const inputCls = 'w-full rounded-lg border border-surface-border bg-white px-3 py-2 text-xs text-slate-800 outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all placeholder:text-slate-400 disabled:bg-slate-50 disabled:text-slate-400'

export const btnPrimary = 'inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary text-white text-xs font-semibold hover:bg-primary-hover transition-colors shadow-sm whitespace-nowrap disabled:opacity-60 disabled:cursor-not-allowed'
export const btnOutline = 'inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg border border-primary/30 bg-primary-50 text-primary text-xs font-semibold hover:bg-primary-100 hover:border-primary/50 transition-colors whitespace-nowrap disabled:opacity-60'
export const btnGhost = 'inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg border border-surface-border text-slate-600 text-xs font-semibold hover:bg-surface-hover transition-colors whitespace-nowrap disabled:opacity-50'
// the wizard's footer buttons are a little larger and rounder
export const btnPrimaryXl = 'inline-flex items-center justify-center gap-1.5 px-5 py-2 rounded-xl bg-primary text-white text-xs font-semibold hover:bg-primary-hover transition-all shadow-sm disabled:opacity-60 disabled:cursor-not-allowed'
export const btnGhostXl = 'inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl border border-surface-border text-slate-600 text-xs font-semibold hover:bg-surface-hover transition-colors'

export const thCls = 'px-4 py-3 text-left text-[11px] font-semibold text-slate-400 uppercase tracking-wider whitespace-nowrap'
export const microLabel = 'text-[10px] font-semibold text-slate-400 uppercase tracking-wider'

export function Card({ title, sub, right, children, className, bodyClass }) {
  return (
    <section className={clsx('card overflow-hidden', className)}>
      {(title || right) && (
        <div className="flex items-center gap-3 px-5 py-3.5 border-b border-surface-border">
          <div className="flex-1 min-w-0">
            <h3 className="text-xs font-bold text-slate-700">{title}</h3>
            {sub && <p className="text-[10px] text-slate-400 mt-0.5">{sub}</p>}
          </div>
          {right}
        </div>
      )}
      <div className={bodyClass}>{children}</div>
    </section>
  )
}

/** A headline number with an icon tile (the Broadcasting "primary metrics" card). */
export function Kpi({ icon: Icon, label, value, sub, iconBg = 'bg-blue-50', iconColor = 'text-blue-500', onClick }) {
  const Tag = onClick ? 'button' : 'div'
  return (
    <Tag onClick={onClick} className={clsx('card p-4 text-left', onClick && 'hover:border-primary/30 transition-colors')}>
      {Icon && <div className={clsx('w-7 h-7 rounded-lg flex items-center justify-center mb-3', iconBg)}><Icon size={14} className={iconColor} /></div>}
      <p className="text-xl font-bold text-slate-900 tabular-nums leading-tight">{value}</p>
      <p className="text-[11px] font-semibold text-slate-500 mt-0.5">{label}</p>
      {sub && <p className="text-[10px] text-slate-400 mt-1">{sub}</p>}
    </Tag>
  )
}

/** The pill switcher used for sections and tabs: options are [{ key, label, icon?, count? }]. */
export function Segmented({ options, value, onChange, className }) {
  return (
    <div role="tablist" className={clsx('flex items-center gap-0.5 bg-slate-100 p-1 rounded-xl w-fit max-w-full overflow-x-auto', className)}>
      {options.map(({ key, label, icon: Icon, count }) => (
        <button key={key} role="tab" aria-selected={value === key} onClick={() => onChange(key)}
          className={clsx('flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-all whitespace-nowrap', value === key ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700')}>
          {Icon && <Icon size={12} />}{label}
          {count > 0 && <span className={clsx('text-[10px] font-bold px-1.5 py-0.5 rounded-full', value === key ? 'bg-primary/10 text-primary' : 'bg-slate-200 text-slate-500')}>{count}</span>}
        </button>
      ))}
    </div>
  )
}

const PILL = {
  ACTIVE:          ['bg-emerald-50 text-emerald-700 ring-emerald-200', 'bg-emerald-500'],
  PAUSED:          ['bg-slate-50 text-slate-600 ring-slate-200', 'bg-slate-400'],
  CAMPAIGN_PAUSED: ['bg-slate-50 text-slate-600 ring-slate-200', 'bg-slate-400'],
  ADSET_PAUSED:    ['bg-slate-50 text-slate-600 ring-slate-200', 'bg-slate-400'],
  PENDING_REVIEW:  ['bg-amber-50 text-amber-700 ring-amber-200', 'bg-amber-500'],
  IN_PROCESS:      ['bg-amber-50 text-amber-700 ring-amber-200', 'bg-amber-500'],
  DISAPPROVED:     ['bg-red-50 text-red-700 ring-red-200', 'bg-red-500'],
  WITH_ISSUES:     ['bg-red-50 text-red-700 ring-red-200', 'bg-red-500'],
}
export function StatusPill({ status, label }) {
  const [cls, dot] = PILL[status] || PILL.PAUSED
  return (
    <span className={clsx('inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold ring-1 whitespace-nowrap', cls)}>
      <span className={clsx('w-1.5 h-1.5 rounded-full flex-shrink-0', dot)} />{label ?? statusLabel(status)}
    </span>
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
      <label className="block text-[11px] font-semibold text-slate-600 mb-1.5">{label}</label>
      {children}
      {error ? <p role="alert" className="text-[10.5px] text-red-600 mt-1">{error}</p> : hint && <p className="text-[10px] text-slate-400 mt-1">{hint}</p>}
    </div>
  )
}

export const Spinner = ({ label = 'Loading…' }) => (
  <div className="flex items-center justify-center gap-2 py-16 text-xs text-slate-400"><Loader2 size={15} className="animate-spin" /> {label}</div>
)

export function Banner({ tone = 'info', children, action }) {
  const tones = { info: 'bg-blue-50 border-blue-100 text-blue-800', warn: 'bg-amber-50 border-amber-200 text-amber-800', error: 'bg-red-50 border-red-100 text-red-700', ok: 'bg-emerald-50 border-emerald-100 text-emerald-800' }
  return (
    <div role={tone === 'error' ? 'alert' : 'status'} className={clsx('flex items-start gap-3 rounded-xl border px-4 py-3 text-xs', tones[tone])}>
      <div className="flex-1 leading-relaxed">{children}</div>
      {action}
    </div>
  )
}

export function EmptyState({ icon: Icon = Inbox, title, text, action }) {
  return (
    <div className="py-16 text-center">
      <div className="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto mb-3"><Icon size={20} className="text-slate-300" /></div>
      <p className="text-xs font-semibold text-slate-500">{title}</p>
      {text && <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">{text}</p>}
      {action && <div className="mt-3">{action}</div>}
    </div>
  )
}

/* ── paging: the table footer ("Showing 10 of 24 ads") with page buttons ── */
export function usePaging(list, size = 10) {
  const [page, setPage] = useState(1)
  const pages = Math.max(1, Math.ceil(list.length / size))
  useEffect(() => { if (page > pages) setPage(pages) }, [page, pages])
  const slice = useMemo(() => list.slice((page - 1) * size, page * size), [list, page, size])
  return { page, setPage, pages, slice, size, total: list.length }
}
export function Pager({ paging, of, noun }) {
  const { page, setPage, pages, slice, total } = paging
  return (
    <div className="flex items-center justify-between px-5 py-3 border-t border-surface-border bg-slate-50/40">
      <p className="text-xs text-slate-400">Showing <span className="font-semibold text-slate-600">{slice.length}</span> of <span className="font-semibold text-slate-600">{total}</span>{of && of !== total ? <> (<span className="font-semibold text-slate-600">{of}</span> in total)</> : null} {noun}</p>
      <div className="flex items-center gap-1">
        <button onClick={() => setPage(page - 1)} disabled={page <= 1} aria-label="Previous page" className="p-1.5 rounded-lg hover:bg-surface-hover text-slate-400 disabled:opacity-30 transition-colors"><ChevronLeft size={14} /></button>
        <span className="px-3 py-1 rounded-lg bg-primary text-white text-xs font-semibold tabular-nums">{page}{pages > 1 && <span className="opacity-70"> / {pages}</span>}</span>
        <button onClick={() => setPage(page + 1)} disabled={page >= pages} aria-label="Next page" className="p-1.5 rounded-lg hover:bg-surface-hover text-slate-400 disabled:opacity-30 transition-colors"><ChevronRight size={14} /></button>
      </div>
    </div>
  )
}

/* ── overlays ── */
const openLayers = []                              // layers can stack (a lead over an ad, a dialog over a modal): Escape closes only the top one
function useEscape(onClose) {
  useEffect(() => {
    const me = {}
    openLayers.push(me)
    const esc = (e) => { if (e.key === 'Escape' && openLayers[openLayers.length - 1] === me) onClose() }
    document.addEventListener('keydown', esc)
    return () => { document.removeEventListener('keydown', esc); openLayers.splice(openLayers.indexOf(me), 1) }
  }, [onClose])
}

/** A panel that slides in from the right over the page. */
export function Drawer({ title, sub, onClose, width = 'max-w-[600px]', z = 'z-[60]', children }) {
  useEscape(onClose)
  return createPortal(
    <div className={clsx('fixed inset-0 flex justify-end', z)} style={{ background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(2px)' }} onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <aside role="dialog" aria-label={typeof title === 'string' ? title : 'Details'} className={clsx('w-full h-full bg-slate-50 shadow-2xl flex flex-col animate-fade-in', width)}>
        <header className="flex items-start gap-3 px-5 py-4 bg-white border-b border-surface-border flex-shrink-0">
          <div className="flex-1 min-w-0">{title}{sub && <div className="mt-0.5">{sub}</div>}</div>
          <button onClick={onClose} aria-label="Close" className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-surface-hover transition-colors"><X size={16} /></button>
        </header>
        <div className="flex-1 overflow-y-auto">{children}</div>
      </aside>
    </div>, document.body)
}

/** The Broadcasting modal: dimmed blurred backdrop, rounded-2xl sheet, header with step subtitle, optional footer. */
export function Modal({ title, sub, onClose, footer, size = 'max-w-3xl', z = 'z-50', children, belowHeader }) {
  useEscape(onClose)
  return createPortal(
    <div className={clsx('fixed inset-0 flex items-center justify-center p-4', z)} style={{ background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(2px)' }} onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div role="dialog" aria-label={typeof title === 'string' ? title : 'Dialog'} className={clsx('bg-white rounded-2xl shadow-2xl w-full flex flex-col overflow-hidden', size)} style={{ maxHeight: 'calc(100vh - 48px)' }}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-surface-border flex-shrink-0">
          <div><h2 className="text-sm font-bold text-slate-900">{title}</h2>{sub && <p className="text-[11px] text-slate-400 mt-0.5">{sub}</p>}</div>
          <button onClick={onClose} aria-label="Close" className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-surface-hover transition-colors"><X size={16} /></button>
        </div>
        {belowHeader}
        <div className="flex-1 overflow-y-auto min-h-0">{children}</div>
        {footer && <div className="flex items-center justify-between px-6 py-4 border-t border-surface-border flex-shrink-0 bg-slate-50/50">{footer}</div>}
      </div>
    </div>, document.body)
}
