// controls.jsx — small, modern form controls for the admin forms: a pill switcher, an on/off switch,
// a quantity stepper, selectable option cards and a ₹ input.
import clsx from 'clsx'
import { Check, Minus, Plus } from 'lucide-react'

/* One option is on. options: [[value, label]]. A value that matches none leaves all off. */
export function Segmented({ label, value, onChange, options, size = 'md', className }) {
  return (
    <div role="radiogroup" aria-label={label} className={clsx('inline-flex flex-wrap p-1 gap-1 rounded-xl bg-slate-100', className)}>
      {options.map(([v, l]) => (
        <button key={v} type="button" role="radio" aria-checked={value === v} onClick={() => onChange(v)}
          className={clsx('rounded-lg font-semibold whitespace-nowrap transition-all outline-none focus-visible:ring-2 focus-visible:ring-primary/40',
            size === 'sm' ? 'px-2.5 py-1 text-xs' : 'px-3.5 py-1.5 text-sm',
            value === v ? 'bg-white text-slate-900 shadow-sm ring-1 ring-slate-200' : 'text-slate-500 hover:text-slate-800')}>
          {l}
        </button>
      ))}
    </div>
  )
}

export function Switch({ checked, onChange, label, id }) {
  return (
    <button id={id} type="button" role="switch" aria-checked={checked} aria-label={label} onClick={() => onChange(!checked)}
      className={clsx('relative inline-flex h-6 w-11 flex-shrink-0 rounded-full transition-colors outline-none focus-visible:ring-2 focus-visible:ring-primary/40', checked ? 'bg-primary' : 'bg-slate-300')}>
      <span className={clsx('absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform', checked && 'translate-x-5')}/>
    </button>
  )
}

export function Stepper({ value, onChange, min = 1, max = 99, label }) {
  const btn = 'p-1.5 text-slate-500 hover:bg-slate-50 hover:text-slate-900 disabled:opacity-30 disabled:hover:bg-transparent outline-none focus-visible:bg-slate-100'
  return (
    <div className="inline-flex items-center rounded-lg border border-slate-200 bg-white">
      <button type="button" aria-label={`Fewer ${label}`} disabled={value <= min} onClick={() => onChange(value - 1)} className={clsx(btn, 'rounded-l-lg')}><Minus size={14}/></button>
      <span role="status" aria-label={`${label}: ${value}`} className="w-9 text-center text-sm font-semibold tabular-nums">{value}</span>
      <button type="button" aria-label={`More ${label}`} disabled={value >= max} onClick={() => onChange(value + 1)} className={clsx(btn, 'rounded-r-lg')}><Plus size={14}/></button>
    </div>
  )
}

/* A big radio you can click: a title, a line of text and an icon. */
export function OptionCard({ checked, onChange, name, title, text, icon }) {
  return (
    <label className={clsx('relative flex gap-3 rounded-xl border p-4 cursor-pointer transition-colors has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-primary/30',
      checked ? 'border-primary bg-primary/5' : 'border-slate-200 bg-white hover:border-slate-300')}>
      <input type="radio" name={name} checked={checked} onChange={onChange} className="sr-only"/>
      {icon && <span className={clsx('w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 transition-colors', checked ? 'bg-primary text-white' : 'bg-slate-100 text-slate-500')}>{icon}</span>}
      <span className="min-w-0 pr-5">
        <span className="block text-sm font-semibold text-slate-900">{title}</span>
        <span className="block text-xs text-slate-500 mt-0.5">{text}</span>
      </span>
      {checked && <Check size={15} className="absolute top-3.5 right-3.5 text-primary"/>}
    </label>
  )
}

/* ₹ amount. */
export function Money({ id, value, onChange, label, disabled, className }) {
  return (
    <div className={clsx('flex items-center rounded-lg border border-slate-200 focus-within:border-primary focus-within:ring-1 focus-within:ring-primary/10', disabled ? 'bg-slate-50' : 'bg-white', className)}>
      <span className="pl-2.5 text-sm text-slate-400">₹</span>
      <input id={id} type="number" min={0} step="any" aria-label={label} disabled={disabled} value={value} onChange={(e) => onChange(e.target.value)}
        className="w-full min-w-0 bg-transparent px-2 py-1.5 text-sm text-right outline-none tabular-nums"/>
    </div>
  )
}
