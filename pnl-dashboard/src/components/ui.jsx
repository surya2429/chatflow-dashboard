import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import clsx from 'clsx'
import { X, Search, ChevronLeft, ChevronRight, Inbox, AlertTriangle, CheckCircle2, Info } from 'lucide-react'

/* ── Surfaces ──────────────────────────────────────────────────────────────── */

export function Card({ className, children, ...rest }) {
  return <div className={clsx('card', className)} {...rest}>{children}</div>
}

export function SectionHeader({ title, subtitle, actions, className }) {
  return (
    <div className={clsx('flex flex-wrap items-start justify-between gap-3', className)}>
      <div>
        <h2 className="text-base font-semibold text-navy-900">{title}</h2>
        {subtitle && <p className="mt-0.5 text-sm text-slate-500">{subtitle}</p>}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  )
}

export function PageHeader({ title, subtitle, actions }) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
      <div>
        <h1 className="text-xl font-bold tracking-tight text-navy-900">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-slate-500 max-w-2xl">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  )
}

/* ── Badges ────────────────────────────────────────────────────────────────── */

const TONES = {
  navy:   'bg-navy-50 text-navy-700 border-navy-200',
  green:  'bg-emerald-50 text-emerald-700 border-emerald-200',
  amber:  'bg-amber-50 text-amber-700 border-amber-200',
  red:    'bg-red-50 text-red-700 border-red-200',
  cyan:   'bg-cyan-50 text-cyan-700 border-cyan-200',
  violet: 'bg-violet-50 text-violet-700 border-violet-200',
  slate:  'bg-slate-100 text-slate-600 border-slate-200',
}
const DOTS = {
  navy: 'bg-navy-500', green: 'bg-emerald-500', amber: 'bg-amber-500', red: 'bg-red-500',
  cyan: 'bg-cyan-500', violet: 'bg-violet-500', slate: 'bg-slate-400',
}

export function Badge({ tone = 'slate', dot = false, children, className }) {
  return (
    <span className={clsx('chip', TONES[tone] || TONES.slate, className)}>
      {dot && <span className={clsx('h-1.5 w-1.5 rounded-full', DOTS[tone] || DOTS.slate)} />}
      {children}
    </span>
  )
}

/* ── Stats ─────────────────────────────────────────────────────────────────── */

export function StatCard({ label, value, hint, icon: Icon, tone = 'navy', onClick, active }) {
  const Tag = onClick ? 'button' : 'div'
  return (
    <Tag
      onClick={onClick}
      className={clsx(
        'card card-pad text-left w-full transition-all',
        onClick && 'hover:shadow-pop hover:-translate-y-0.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-navy-500',
        active && 'ring-2 ring-navy-900 ring-offset-1'
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
          <p className="mt-2 text-2xl font-bold tnum text-navy-900">{value}</p>
          {hint && <p className="mt-1 text-xs text-slate-500 truncate">{hint}</p>}
        </div>
        {Icon && (
          <span className={clsx('shrink-0 grid place-items-center h-9 w-9 rounded-lg border', TONES[tone] || TONES.navy)}>
            <Icon size={17} />
          </span>
        )}
      </div>
    </Tag>
  )
}

/* ── Table ─────────────────────────────────────────────────────────────────── */

export function Table({ head, children, empty, emptyLabel = 'Nothing to show here yet' }) {
  // A head entry is either a plain string or { key, label, align }; an action column
  // legitimately carries an empty label, so never fall back to the entry itself.
  const cols = head.map((h, i) => (typeof h === 'string' ? { key: h, label: h } : { key: h.key || String(i), ...h }))
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse">
        <thead>
          <tr>
            {cols.map((h) => (
              <th key={h.key} className={clsx('th', h.align === 'right' && 'text-right')}>{h.label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {empty
            ? <tr><td colSpan={cols.length} className="px-4 py-14"><EmptyState label={emptyLabel} /></td></tr>
            : children}
        </tbody>
      </table>
    </div>
  )
}

export function EmptyState({ label, hint, icon: Icon = Inbox, action }) {
  return (
    <div className="text-center">
      <span className="mx-auto grid place-items-center h-11 w-11 rounded-full bg-slate-100 text-slate-400">
        <Icon size={20} />
      </span>
      <p className="mt-3 text-sm font-semibold text-navy-800">{label}</p>
      {hint && <p className="mt-1 text-sm text-slate-500">{hint}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}

/* ── Search / filters ──────────────────────────────────────────────────────── */

export function SearchInput({ value, onChange, placeholder = 'Search…', className }) {
  return (
    <div className={clsx('relative', className)}>
      <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
      <input
        className="field pl-9"
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  )
}

export function Select({ value, onChange, options, className, ...rest }) {
  return (
    <select className={clsx('field', className)} value={value} onChange={(e) => onChange(e.target.value)} {...rest}>
      {options.map((o) => (
        <option key={o.value} value={o.value}>{o.label}</option>
      ))}
    </select>
  )
}

export function Field({ label, hint, children, className }) {
  return (
    <label className={clsx('block', className)}>
      <span className="label">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-slate-400">{hint}</span>}
    </label>
  )
}

export function Tabs({ tabs, active, onChange, className }) {
  return (
    <div className={clsx('flex items-center gap-1 overflow-x-auto border-b border-slate-200', className)}>
      {tabs.map((t) => (
        <button
          key={t.id}
          onClick={() => onChange(t.id)}
          className={clsx(
            'relative whitespace-nowrap px-3.5 py-2.5 text-sm font-semibold transition-colors',
            active === t.id ? 'text-navy-900' : 'text-slate-500 hover:text-navy-700'
          )}
        >
          {t.label}
          {t.count != null && (
            <span className={clsx('ml-2 rounded-full px-1.5 py-0.5 text-[10px] tnum',
              active === t.id ? 'bg-navy-900 text-white' : 'bg-slate-100 text-slate-500')}>{t.count}</span>
          )}
          {active === t.id && <span className="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-navy-900" />}
        </button>
      ))}
    </div>
  )
}

/* ── Pagination ────────────────────────────────────────────────────────────── */

export function usePaged(rows, size = 12) {
  const [page, setPage] = useState(1)
  const pages = Math.max(1, Math.ceil(rows.length / size))
  useEffect(() => { setPage(1) }, [rows.length])
  const safe = Math.min(page, pages)
  const slice = useMemo(() => rows.slice((safe - 1) * size, safe * size), [rows, safe, size])
  return { slice, page: safe, pages, setPage, total: rows.length, size }
}

export function Pagination({ page, pages, setPage, total, size }) {
  if (total === 0) return null
  const from = (page - 1) * size + 1
  const to = Math.min(total, page * size)
  return (
    <div className="flex items-center justify-between gap-3 border-t border-slate-200 px-4 py-3">
      <p className="text-xs text-slate-500 tnum">Showing {from}–{to} of {total}</p>
      <div className="flex items-center gap-1">
        <button className="btn btn-ghost btn-sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>
          <ChevronLeft size={14} /> Prev
        </button>
        <span className="px-2 text-xs text-slate-500 tnum">{page} / {pages}</span>
        <button className="btn btn-ghost btn-sm" disabled={page >= pages} onClick={() => setPage(page + 1)}>
          Next <ChevronRight size={14} />
        </button>
      </div>
    </div>
  )
}

/* ── Modal ─────────────────────────────────────────────────────────────────── */

export function Modal({ open, onClose, title, subtitle, children, footer, width = 'max-w-2xl' }) {
  useEffect(() => {
    if (!open) return
    const onKey = (e) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = prev }
  }, [open, onClose])

  if (!open) return null
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-navy-950/50 p-4 py-10 animate-fade-in" onMouseDown={onClose}>
      <div
        className={clsx('card w-full shadow-modal animate-pop-in', width)}
        onMouseDown={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-5 py-4">
          <div>
            <h3 className="text-base font-semibold text-navy-900">{title}</h3>
            {subtitle && <p className="mt-0.5 text-sm text-slate-500">{subtitle}</p>}
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-navy-700" aria-label="Close">
            <X size={17} />
          </button>
        </div>
        <div className="px-5 py-5">{children}</div>
        {footer && <div className="flex items-center justify-end gap-2 border-t border-slate-200 bg-slate-50 px-5 py-3.5 rounded-b-xl">{footer}</div>}
      </div>
    </div>,
    document.body
  )
}

export function ConfirmDialog({ open, onClose, onConfirm, title, message, confirmLabel = 'Confirm', danger }) {
  return (
    <Modal
      open={open} onClose={onClose} title={title} width="max-w-md"
      footer={
        <>
          <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button className={danger ? 'btn-danger' : 'btn-primary'} onClick={() => { onConfirm(); onClose() }}>{confirmLabel}</button>
        </>
      }
    >
      <p className="text-sm text-slate-600">{message}</p>
    </Modal>
  )
}

/* ── Toasts ────────────────────────────────────────────────────────────────── */

const TOAST_ICON = { success: CheckCircle2, warn: AlertTriangle, info: Info }
const TOAST_TONE = {
  success: 'border-emerald-200 bg-white text-emerald-700',
  warn: 'border-amber-200 bg-white text-amber-700',
  info: 'border-navy-200 bg-white text-navy-700',
}

export function Toaster({ toasts, dismiss }) {
  return createPortal(
    <div className="fixed bottom-5 right-5 z-[60] flex w-80 flex-col gap-2">
      {toasts.map((t) => {
        const Icon = TOAST_ICON[t.tone] || CheckCircle2
        return (
          <div key={t.id} className={clsx('flex items-start gap-2.5 rounded-lg border px-3.5 py-3 shadow-pop animate-slide-up', TOAST_TONE[t.tone] || TOAST_TONE.success)}>
            <Icon size={16} className="mt-0.5 shrink-0" />
            <p className="flex-1 text-sm font-medium text-navy-800">{t.message}</p>
            <button onClick={() => dismiss(t.id)} className="text-slate-400 hover:text-navy-700" aria-label="Dismiss"><X size={14} /></button>
          </div>
        )
      })}
    </div>,
    document.body
  )
}

/* ── Misc ──────────────────────────────────────────────────────────────────── */

export function Toggle({ checked, onChange, label, hint, disabled }) {
  return (
    <label className={clsx('flex items-start gap-3', disabled ? 'opacity-60' : 'cursor-pointer')}>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => !disabled && onChange(!checked)}
        className={clsx('mt-0.5 relative h-5 w-9 shrink-0 rounded-full transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-navy-500 focus-visible:ring-offset-2',
          checked ? 'bg-navy-900' : 'bg-slate-300')}
      >
        <span
          className="absolute left-0.5 top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform"
          style={{ transform: checked ? 'translateX(16px)' : 'none' }}
        />
      </button>
      <span className="min-w-0">
        <span className="block text-sm font-medium text-navy-800">{label}</span>
        {hint && <span className="block text-xs text-slate-500">{hint}</span>}
      </span>
    </label>
  )
}

export function Avatar({ name, tone, size = 'md' }) {
  const s = size === 'sm' ? 'h-7 w-7 text-[10px]' : size === 'lg' ? 'h-12 w-12 text-sm' : 'h-9 w-9 text-xs'
  return (
    <span className={clsx('grid place-items-center rounded-full font-bold shrink-0', s, tone)}>{name}</span>
  )
}

export function KeyValue({ items, cols = 2 }) {
  return (
    <dl className={clsx('grid gap-x-6 gap-y-4', cols === 2 ? 'sm:grid-cols-2' : cols === 3 ? 'sm:grid-cols-3' : '')}>
      {items.map((it) => (
        <div key={it.label} className="min-w-0">
          <dt className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{it.label}</dt>
          <dd className="mt-1 text-sm text-navy-800 break-words">{it.value ?? '—'}</dd>
        </div>
      ))}
    </dl>
  )
}
