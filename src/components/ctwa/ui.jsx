import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import clsx from 'clsx'
import { Loader2, X } from 'lucide-react'
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

export function Stat({ label, value, sub, icon: Icon, tone = 'text-primary bg-primary-50' }) {
  return (
    <div className="bg-white border border-surface-border rounded-xl p-4 flex flex-col gap-3">
      <span className={clsx('w-8 h-8 rounded-lg flex items-center justify-center', tone)}>{Icon && <Icon size={15} />}</span>
      <div>
        <p className="text-[22px] font-bold leading-none text-slate-800 tabular-nums">{value}</p>
        <p className="text-[11px] font-medium text-slate-500 mt-1.5">{label}</p>
        {sub && <p className="text-[10px] text-slate-400 mt-0.5">{sub}</p>}
      </div>
    </div>
  )
}

export const StatusPill = ({ status }) => (
  <span className={clsx('inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold whitespace-nowrap', STATUS_STYLE[status] || 'bg-slate-100 text-slate-600')}>{statusLabel(status)}</span>
)

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
