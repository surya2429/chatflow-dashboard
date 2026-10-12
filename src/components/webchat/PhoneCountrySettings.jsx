// PhoneCountrySettings.jsx — the three settings that control a phone field's country picker:
//   • Countries list  — which countries the visitor can choose from (empty = all)
//   • Default country — what the picker starts on (India unless changed)
//   • Show country based on IP address — preselect the visitor's country from their IP (off by default)
// Shared by the Phone question type (flow builder) and the Book tab popup (widget Behavior settings),
// so both behave and look the same. The matching runtime is `useDetectedCountry(...)` in AnswerControls.
import { useState, useEffect, useRef } from 'react'
import clsx from 'clsx'
import { Search, Check, ChevronDown, X, Info } from 'lucide-react'
import { COUNTRIES } from './AnswerControls'

/* A small searchable dropdown — single choice, or multi with chips + "Select all / Clear". */
export function CountryPicker({ multi, value, onChange, options, placeholder }) {
  const [open, setOpen] = useState(false)
  const [q, setQ] = useState('')
  const ref = useRef(null)
  useEffect(() => {
    const onDoc = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [])
  const sel = multi ? value : [value]
  const shown = options.filter(c => !q.trim() || c.name.toLowerCase().includes(q.toLowerCase()) || c.code.toLowerCase() === q.trim().toLowerCase() || c.dial.includes(q.trim()))
  const toggle = (c) => {
    if (multi) onChange(value.includes(c.code) ? value.filter(x => x !== c.code) : [...value, c.code])
    else { onChange(c.code); setOpen(false); setQ('') }
  }
  const one = !multi ? options.find(c => c.code === value) : null
  return (
    <div className="relative" ref={ref}>
      <div role="button" tabIndex={0} onClick={() => setOpen(o => !o)} onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), setOpen(o => !o))}
        className="input flex items-center gap-1.5 flex-wrap min-h-[38px] cursor-pointer pr-8 relative">
        {multi ? (
          value.length === 0
            ? <span className="text-slate-400">{placeholder}</span>
            : value.map(code => {
                const c = COUNTRIES.find(x => x.code === code)
                return c && (
                  <span key={code} className="inline-flex items-center gap-1 text-[10.5px] font-semibold bg-slate-100 text-slate-700 rounded-md pl-1.5 pr-1 py-0.5">
                    {c.flag} {c.code}
                    <button type="button" aria-label={`Remove ${c.name}`} onClick={(e) => { e.stopPropagation(); onChange(value.filter(x => x !== code)) }} className="text-slate-400 hover:text-slate-700"><X size={10}/></button>
                  </span>
                )
              })
        ) : (
          <span className="truncate">{one ? `${one.flag} ${one.name} - ${one.code}` : placeholder}</span>
        )}
        <ChevronDown size={14} className={clsx('absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 transition-transform', open && 'rotate-180')}/>
      </div>
      {open && (
        <div className="absolute left-0 right-0 top-full mt-1 z-40 bg-white rounded-xl border border-surface-border shadow-xl overflow-hidden min-w-[220px]">
          <div className="flex items-center gap-1.5 px-2.5 py-2 border-b border-surface-border">
            <Search size={12} className="text-slate-400"/>
            <input autoFocus value={q} onChange={e => setQ(e.target.value)} placeholder="Search country or code…" className="flex-1 bg-transparent outline-none text-[11px] text-slate-700 placeholder-slate-400"/>
          </div>
          {multi && (
            <div className="flex items-center justify-between px-3 py-1.5 border-b border-surface-border text-[10px] font-semibold">
              <span className="text-slate-400">{value.length ? `${value.length} selected` : 'All countries allowed'}</span>
              <span className="flex gap-3">
                <button type="button" onClick={() => onChange(options.map(c => c.code))} className="text-primary hover:underline">Select all</button>
                <button type="button" onClick={() => onChange([])} className="text-slate-500 hover:underline">Clear</button>
              </span>
            </div>
          )}
          <div className="max-h-52 overflow-y-auto py-1">
            {shown.length === 0 && <p className="text-[10.5px] text-slate-400 text-center py-3">No match</p>}
            {shown.map(c => {
              const on = sel.includes(c.code)
              return (
                <button key={c.code} type="button" onClick={() => toggle(c)} className={clsx('w-full flex items-center gap-2 px-3 py-1.5 text-left text-[11px] hover:bg-slate-50', on && 'bg-primary/[0.04]')}>
                  <span className={clsx('w-3.5 h-3.5 flex items-center justify-center flex-shrink-0', multi ? 'rounded border' : '', on ? 'bg-primary border-primary text-white' : 'border-slate-300', !multi && 'w-3')}>
                    {on && <Check size={multi ? 10 : 12} className={multi ? '' : 'text-primary'}/>}
                  </span>
                  <span>{c.flag}</span><span className="flex-1 truncate text-slate-700">{c.name}</span><span className="text-slate-400">{c.dial}</span>
                </button>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

const Tip = ({ text }) => (
  <span title={text} className="inline-flex text-slate-300 hover:text-slate-500 cursor-help"><Info size={12}/></span>
)

/* `value` = { allowedCountries, defaultCountry, ipDetect }; `set(key, val)` changes one of them. */
export default function PhoneCountrySettings({ value = {}, set }) {
  const allowed = Array.isArray(value.allowedCountries) ? value.allowedCountries : []
  const pool = allowed.length ? COUNTRIES.filter(c => allowed.includes(c.code)) : COUNTRIES
  const wanted = value.defaultCountry || 'IN'
  const def = pool.some(c => c.code === wanted) ? wanted : pool[0]?.code
  const ip = value.ipDetect === true
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="space-y-1 min-w-0">
          <label className="label flex items-center gap-1.5">Countries list <Tip text="Only these countries appear in the visitor's country picker. Leave empty to allow every country."/></label>
          <CountryPicker multi value={allowed} onChange={v => set('allowedCountries', v)} options={COUNTRIES} placeholder="Select countries"/>
        </div>
        <div className="space-y-1 min-w-0">
          <label className="label flex items-center gap-1.5">Default country <Tip text="The country the picker starts on. It must be one of the countries in the list."/></label>
          <CountryPicker value={def} onChange={v => set('defaultCountry', v)} options={pool} placeholder="Select a country"/>
        </div>
      </div>
      <div className="space-y-1">
        <label className="label flex items-center gap-1.5">Show country based on IP address <Tip text="Looks up the visitor's country from their IP address and preselects it when it is in the list. Off = always start on the default country."/></label>
        <div className="flex items-center gap-2.5 p-2.5 rounded-lg border border-surface-border">
          <button type="button" role="switch" aria-checked={ip} aria-label="Show country based on IP address" onClick={() => set('ipDetect', !ip)}
            className="relative flex-shrink-0 rounded-full transition-colors" style={{ width: 34, height: 18, background: ip ? '#0066ff' : '#d1d5db' }}>
            <span className="absolute rounded-full bg-white shadow transition-all" style={{ top: 2, left: ip ? 18 : 2, width: 14, height: 14 }}/>
          </button>
          <p className="text-[11px] text-slate-500 leading-snug">{ip ? "Preselect the visitor's country from their IP address (if it's in the list)." : 'Do not select country based on IP address — the default country is used.'}</p>
        </div>
      </div>
    </div>
  )
}
