// AnswerControls.jsx — the ONE shared implementation of "what the answer control
// looks like" for every website-chat question type, used by both:
//  1. WebChatAppearance.jsx's "Question Types" tab (a cosmetic, non-interactive-
//     but-still-reactive preview — interactive={false}).
//  2. WebChatFlowBuilder.jsx's live Preview simulator (fully interactive, calls
//     onSubmit(value) to advance the simulated flow — interactive={true}).
// Everything is themed off `accent` (brand color hex) and `dark` (boolean) instead
// of hardcoded Tailwind blue/slate classes, since the whole widget is cfg-driven.
import { useState, useEffect, useRef, useCallback } from 'react'
import clsx from 'clsx'
import {
  Send, Star, Calendar as CalendarIcon, ChevronLeft, ChevronRight, ChevronDown,
  Check, X, Upload, Image as ImageIcon, Pencil, MapPin, CreditCard, Lock,
  Clock, Search, LocateFixed, Plus, FileText, Paperclip,
} from 'lucide-react'

/* ── shared style injection (custom keyframes Tailwind can't express) ───── */
let stylesInjected = false
function useAnswerControlStyles() {
  useEffect(() => {
    if (stylesInjected || document.getElementById('wc-answer-control-styles')) { stylesInjected = true; return }
    const tag = document.createElement('style')
    tag.id = 'wc-answer-control-styles'
    tag.textContent = `
      @keyframes wcAcPop { 0%{ transform:scale(.6); opacity:0 } 100%{ transform:scale(1); opacity:1 } }
      @keyframes wcAcFade { 0%{ opacity:0; transform:translateY(4px) } 100%{ opacity:1; transform:translateY(0) } }
      .wc-ac-pop { animation: wcAcPop .22s cubic-bezier(.16,1,.3,1) both; }
      .wc-ac-fade { animation: wcAcFade .18s ease both; }
    `
    document.head.appendChild(tag)
    stylesInjected = true
  }, [])
}

/* ── country / dial-code data ────────────────────────────────────────────
   Regional-indicator flag emoji derived from the ISO code so we don't have
   to hand-author 60+ flag glyphs. */
function flagEmoji(iso2) {
  if (!iso2 || iso2.length !== 2) return '🏳️'
  return String.fromCodePoint(...[...iso2.toUpperCase()].map(c => 0x1f1e6 + c.charCodeAt(0) - 65))
}
const COUNTRIES = [
  ['US','United States','+1'], ['IN','India','+91'], ['GB','United Kingdom','+44'],
  ['CA','Canada','+1'], ['AU','Australia','+61'], ['DE','Germany','+49'],
  ['FR','France','+33'], ['ES','Spain','+34'], ['IT','Italy','+39'],
  ['BR','Brazil','+55'], ['MX','Mexico','+52'], ['JP','Japan','+81'],
  ['CN','China','+86'], ['SG','Singapore','+65'], ['AE','UAE','+971'],
  ['SA','Saudi Arabia','+966'], ['ZA','South Africa','+27'], ['NG','Nigeria','+234'],
  ['ID','Indonesia','+62'], ['PK','Pakistan','+92'], ['BD','Bangladesh','+880'],
  ['PH','Philippines','+63'], ['VN','Vietnam','+84'], ['TH','Thailand','+66'],
  ['MY','Malaysia','+60'], ['NL','Netherlands','+31'], ['SE','Sweden','+46'],
  ['NO','Norway','+47'], ['DK','Denmark','+45'], ['FI','Finland','+358'],
  ['PL','Poland','+48'], ['RU','Russia','+7'], ['TR','Turkey','+90'],
  ['KR','South Korea','+82'], ['NZ','New Zealand','+64'], ['IE','Ireland','+353'],
  ['CH','Switzerland','+41'], ['AT','Austria','+43'], ['BE','Belgium','+32'],
  ['PT','Portugal','+351'], ['GR','Greece','+30'], ['EG','Egypt','+20'],
  ['IL','Israel','+972'], ['AR','Argentina','+54'], ['CL','Chile','+56'],
  ['CO','Colombia','+57'],
].map(([code, name, dial]) => ({ code, name, dial, flag: flagEmoji(code) }))

/* Attempts an IP-geolocation lookup once on mount to preselect the visitor's
   own country for the phone control. Times out fast and falls back silently
   — this may run in a sandboxed/offline environment. */
export function useDetectedCountry() {
  const [country, setCountry] = useState(() => COUNTRIES.find(c => c.code === 'US'))
  const [status, setStatus] = useState('detecting') // detecting | detected | fallback
  useEffect(() => {
    let cancelled = false
    const ctrl = new AbortController()
    const timer = setTimeout(() => ctrl.abort(), 2500)
    fetch('https://ipapi.co/json/', { signal: ctrl.signal })
      .then(r => r.ok ? r.json() : Promise.reject(new Error('bad status')))
      .then(data => {
        if (cancelled) return
        const iso = (data && data.country_code) ? String(data.country_code).toUpperCase() : null
        const match = iso && COUNTRIES.find(c => c.code === iso)
        if (match) { setCountry(match); setStatus('detected') }
        else setStatus('fallback')
      })
      .catch(() => { if (!cancelled) setStatus('fallback') })
      .finally(() => clearTimeout(timer))
    return () => { cancelled = true; clearTimeout(timer); clearTimeout(timer) }
  }, [])
  return [country, setCountry, status]
}

/* ── shared composer-pill chrome — short/long/number/email/url/phone render
   AS the composer itself instead of a boxed form field, so answering a
   question never feels like a jarring departure from normal typing. ────── */
function ComposerPill({ dark, accent, children, className }) {
  return (
    <div className={clsx('flex items-end gap-1.5 w-full', className)}
      style={{
        borderRadius: 22, padding: '6px 6px 6px 10px',
        background: dark ? '#111c30' : '#f4f6f9',
        border: `1.5px solid ${dark ? '#22304a' : '#e3e8f0'}`,
        transition: 'border-color .18s ease, box-shadow .18s ease',
      }}
      onFocus={e => { e.currentTarget.style.borderColor = accent; e.currentTarget.style.boxShadow = `0 0 0 3px ${accent}22` }}
      onBlur={e => { e.currentTarget.style.borderColor = dark ? '#22304a' : '#e3e8f0'; e.currentTarget.style.boxShadow = 'none' }}>
      {children}
    </div>
  )
}
function SendBtn({ accent, onClick, disabled, title = 'Send' }) {
  return (
    <button title={title} onClick={onClick} disabled={disabled}
      className="flex items-center justify-center flex-shrink-0 transition-transform active:scale-90"
      style={{ width: 32, height: 32, borderRadius: '50%', background: accent, opacity: disabled ? 0.4 : 1,
        boxShadow: disabled ? 'none' : `0 4px 12px -4px ${accent}99` }}>
      <Send size={14} className="text-white" style={{ marginLeft: 1, marginTop: -1 }}/>
    </button>
  )
}

/* ── free-text family: short / long / number / url ──────────────────────── */
/* Matches the widget's own main composer textarea (WebChatAppearance.jsx,
   draftRef) — measures scrollHeight after commit and grows up to a cap,
   then lets the textarea's own overflow-y scroll internally beyond that. */
const AUTOGROW_CAP = 92
function useAutoGrowTextarea(value) {
  const ref = useRef(null)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = Math.min(el.scrollHeight, AUTOGROW_CAP) + 'px'
  }, [value])
  return ref
}
function FreeTextAnswer({ questionType, accent, dark, onSubmit }) {
  const [val, setVal] = useState('')
  const placeholder = { number: 'Type a number…', url: 'https://example.com', long: 'Type your answer…' }[questionType] || 'Type an answer…'
  const submit = () => { if (val.trim()) onSubmit?.(val.trim()) }
  const growRef = useAutoGrowTextarea(val)
  // Every free-text type — not just "long" — wraps and grows like a normal
  // chat compose box. A single-line <input> was used for short/number/url
  // before, which doesn't wrap at all: a longer answer just ran on in one
  // line and scrolled horizontally out of the box instead of growing
  // downward, which reads as broken in a chat widget. A <textarea> is the
  // only element that wraps text, so all four route through it now —
  // "number" still nudges the visitor with inputMode/pattern hints but
  // isn't a native type="number" input (textareas don't support that).
  const numeric = questionType === 'number'
  return (
    <ComposerPill dark={dark} accent={accent}>
      <textarea autoFocus rows={1} ref={growRef} value={val}
        onChange={e => setVal(numeric ? e.target.value.replace(/[^0-9.\-]/g, '') : e.target.value)}
        placeholder={placeholder}
        inputMode={numeric ? 'decimal' : undefined}
        onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submit() } }}
        style={{ maxHeight: AUTOGROW_CAP }}
        className={clsx('flex-1 bg-transparent outline-none min-w-0 px-1 py-1.5 resize-none text-[12px]', dark ? 'text-slate-100 placeholder-slate-500' : 'text-slate-800 placeholder-slate-400')}/>
      <SendBtn accent={accent} onClick={submit} disabled={!val.trim()}/>
    </ComposerPill>
  )
}

/* ── email: composer pill + live validity affordance ─────────────────────── */
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/
function EmailAnswer({ accent, dark, onSubmit }) {
  const [val, setVal] = useState('')
  const touched = val.length > 2
  const valid = EMAIL_RE.test(val)
  const submit = () => { if (valid) onSubmit?.(val.trim()) }
  return (
    <ComposerPill dark={dark} accent={accent}>
      <input autoFocus type="email" value={val} onChange={e => setVal(e.target.value)}
        onKeyDown={e => e.key === 'Enter' && submit()}
        placeholder="you@example.com"
        className={clsx('flex-1 bg-transparent outline-none min-w-0 px-1 py-1.5 text-[12px]', dark ? 'text-slate-100 placeholder-slate-500' : 'text-slate-800 placeholder-slate-400')}
        style={{ color: touched && !valid ? '#ef4444' : undefined }}/>
      {touched && (
        <span className="flex-shrink-0 flex items-center justify-center wc-ac-pop" style={{ width: 18, height: 18, marginBottom: 6 }}>
          {valid ? <Check size={14} color="#10b981" strokeWidth={3}/> : <X size={14} color="#ef4444" strokeWidth={3}/>}
        </span>
      )}
      <SendBtn accent={accent} onClick={submit} disabled={!valid}/>
    </ComposerPill>
  )
}

/* ── shared country/dial-code picker (trigger + searchable popover) — used
   by the standalone Phone question AND the Phone field inside a multi-field
   Form, so the country-picker UX/logic lives in exactly one place. ────── */
export function CountryDialPicker({ country, setCountry, dark, dropDirection = 'up' }) {
  const [open, setOpen] = useState(false)
  const [q, setQ] = useState('')
  const ref = useRef(null)
  useEffect(() => {
    function onDoc(e) { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [])
  const filtered = COUNTRIES.filter(c => !q.trim() || c.name.toLowerCase().includes(q.toLowerCase()) || c.dial.includes(q))
  return (
    <div className="relative flex-shrink-0" ref={ref}>
      <button onClick={() => setOpen(o => !o)} type="button"
        className="flex items-center gap-1 px-2 py-1.5 rounded-full text-[11.5px] font-semibold transition-colors"
        style={{ background: dark ? '#1e293b' : '#fff', border: `1px solid ${dark ? '#334155' : '#e2e8f0'}`, color: dark ? '#e2e8f0' : '#334155' }}>
        <span>{country.flag}</span><span>{country.dial}</span>
        <ChevronDown size={11} className={clsx('transition-transform', open && 'rotate-180')}/>
      </button>
      {open && (
        <div className={clsx('absolute left-0 z-30 wc-ac-fade', dropDirection === 'up' ? 'bottom-9' : 'top-9')} style={{ width: 220 }}>
          <div className="rounded-xl overflow-hidden shadow-xl"
            style={{ background: dark ? '#1e293b' : '#fff', border: `1px solid ${dark ? '#334155' : '#e2e8f0'}` }}>
            <div className="flex items-center gap-1.5 px-2.5 py-2 border-b" style={{ borderColor: dark ? '#334155' : '#eef1f6' }}>
              <Search size={12} className={dark ? 'text-slate-500' : 'text-slate-400'}/>
              <input autoFocus value={q} onChange={e => setQ(e.target.value)} placeholder="Search country or code…"
                className={clsx('flex-1 bg-transparent outline-none text-[11px]', dark ? 'text-slate-100 placeholder-slate-500' : 'text-slate-700 placeholder-slate-400')}/>
            </div>
            <div className="max-h-40 overflow-y-auto">
              {filtered.length === 0 && <p className="text-[10.5px] text-slate-400 px-3 py-3 text-center">No match</p>}
              {filtered.map(c => (
                <button key={c.code} type="button" onClick={() => { setCountry(c); setOpen(false); setQ('') }}
                  className="w-full flex items-center gap-2 px-3 py-1.5 text-[11px] text-left transition-colors"
                  style={{ background: c.code === country.code ? (dark ? '#334155' : '#f1f5f9') : 'transparent', color: dark ? '#e2e8f0' : '#334155' }}>
                  <span>{c.flag}</span><span className="flex-1 truncate">{c.name}</span><span className="opacity-60">{c.dial}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
/* ── phone: composer pill + searchable country/dial-code popover ─────────── */
function PhoneAnswer({ accent, dark, onSubmit }) {
  const [val, setVal] = useState('')
  const [country, setCountry] = useDetectedCountry()
  const submit = () => { if (val.trim()) onSubmit?.(`${country.dial} ${val.trim()}`) }
  return (
    <ComposerPill dark={dark} accent={accent} className="relative">
      <CountryDialPicker country={country} setCountry={setCountry} dark={dark} dropDirection="up"/>
      <input autoFocus type="tel" value={val} onChange={e => setVal(e.target.value.replace(/[^\d\s-]/g, ''))}
        onKeyDown={e => e.key === 'Enter' && submit()}
        placeholder="Phone number"
        className={clsx('flex-1 bg-transparent outline-none min-w-0 px-1 py-1.5 text-[12px]', dark ? 'text-slate-100 placeholder-slate-500' : 'text-slate-800 placeholder-slate-400')}/>
      <SendBtn accent={accent} onClick={submit} disabled={!val.trim()}/>
    </ComposerPill>
  )
}

/* ── single / multi choice: ONE grouped card with divided rows — a bare
   radio circle on plain floating pills read as flat/generic ("this ui is
   not good"). Modern chat polls (WhatsApp/Telegram list messages) present
   options as rows of a single cohesive card, each with a lettered badge,
   not a scatter of separately-bordered pills — that's the bar to match. ── */
const OPTIONS = ['Option A', 'Option B', 'Option C']
const OPTION_LETTERS = ['A', 'B', 'C', 'D', 'E', 'F']
function ChoiceRow({ letter, label, selected, accent, dark, onClick, shape = 'radio', last }) {
  const [hover, setHover] = useState(false)
  return (
    <button onClick={onClick} type="button"
      onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
      className="w-full flex items-center gap-3 px-3.5 py-3 text-left transition-colors"
      style={{
        borderBottom: last ? 'none' : `1px solid ${dark ? '#1e293b' : '#f1f5f9'}`,
        background: selected ? `${accent}12` : hover ? (dark ? '#111c30' : '#f8fafc') : 'transparent',
      }}>
      <span className="flex items-center justify-center flex-shrink-0 font-bold transition-all"
        style={{
          width: 26, height: 26, borderRadius: shape === 'radio' ? '50%' : 8,
          fontSize: 11,
          background: selected ? accent : (dark ? '#1e293b' : '#eef1f6'),
          color: selected ? '#fff' : (dark ? '#94a3b8' : '#94a3b8'),
          boxShadow: selected ? `0 3px 10px -3px ${accent}99` : 'none',
        }}>
        {selected ? <Check size={13} strokeWidth={3} className="wc-ac-pop"/> : letter}
      </span>
      <span className="flex-1 text-[12.5px] font-semibold truncate" style={{ color: selected ? accent : (dark ? '#e2e8f0' : '#334155') }}>{label}</span>
    </button>
  )
}
function ChoiceCard({ children, dark }) {
  return (
    <div className="w-full rounded-2xl overflow-hidden"
      style={{
        background: dark ? '#0b1526' : '#fff',
        border: `1px solid ${dark ? '#1e293b' : '#eef1f6'}`,
        boxShadow: dark ? '0 6px 20px -8px rgba(0,0,0,0.4)' : '0 6px 20px -10px rgba(15,23,42,0.15)',
      }}>
      {children}
    </div>
  )
}
function SingleChoiceAnswer({ accent, dark, onSubmit }) {
  const [sel, setSel] = useState(null)
  return (
    <ChoiceCard dark={dark}>
      {OPTIONS.map((o, i) => (
        <ChoiceRow key={o} letter={OPTION_LETTERS[i]} label={o} selected={sel === o} accent={accent} dark={dark}
          last={i === OPTIONS.length - 1}
          onClick={() => { setSel(o); onSubmit?.(o) }}/>
      ))}
    </ChoiceCard>
  )
}
function MultiChoiceAnswer({ accent, dark, onSubmit }) {
  const [sel, setSel] = useState([])
  const toggle = o => setSel(p => p.includes(o) ? p.filter(x => x !== o) : [...p, o])
  return (
    <div className="flex flex-col gap-2 w-full">
      <ChoiceCard dark={dark}>
        {OPTIONS.map((o, i) => (
          <ChoiceRow key={o} letter={OPTION_LETTERS[i]} label={o} selected={sel.includes(o)} accent={accent} dark={dark}
            shape="check" last={i === OPTIONS.length - 1} onClick={() => toggle(o)}/>
        ))}
      </ChoiceCard>
      <button onClick={() => onSubmit?.(sel.length ? sel.join(', ') : '(none selected)')}
        className="w-full py-2.5 rounded-2xl text-[12px] font-bold text-white transition-all active:scale-[0.98]"
        style={{ background: accent, boxShadow: `0 6px 16px -8px ${accent}99` }}>
        Done{sel.length ? ` · ${sel.length} selected` : ''}
      </button>
    </div>
  )
}

/* ── dropdown: custom trigger + animated panel (no native <select> chrome) ── */
function DropdownAnswer({ accent, dark, onSubmit }) {
  const [val, setVal] = useState('')
  const [open, setOpen] = useState(false)
  const ref = useRef(null)
  useEffect(() => {
    function onDoc(e) { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [])
  return (
    <div className="relative w-full" ref={ref}>
      <button onClick={() => setOpen(o => !o)} type="button"
        className="w-full flex items-center justify-between px-3.5 py-2.5 rounded-2xl text-[12px] font-medium transition-colors"
        style={{ background: dark ? '#111c30' : '#f4f6f9', border: `1.5px solid ${open ? accent : (dark ? '#22304a' : '#e3e8f0')}`, color: val ? (dark ? '#e2e8f0' : '#1e293b') : (dark ? '#64748b' : '#94a3b8') }}>
        <span>{val || 'Select an option'}</span>
        <ChevronDown size={14} className={clsx('transition-transform', open && 'rotate-180')}/>
      </button>
      {open && (
        <div className="absolute left-0 right-0 bottom-11 z-30 rounded-xl overflow-hidden shadow-xl wc-ac-fade"
          style={{ background: dark ? '#1e293b' : '#fff', border: `1px solid ${dark ? '#334155' : '#e2e8f0'}` }}>
          {OPTIONS.map(o => (
            <button key={o} type="button" onClick={() => { setVal(o); setOpen(false); onSubmit?.(o) }}
              className="w-full flex items-center justify-between px-3.5 py-2 text-[11.5px] text-left transition-colors"
              style={{ background: val === o ? (dark ? '#334155' : '#f1f5f9') : 'transparent', color: dark ? '#e2e8f0' : '#334155' }}>
              {o}{val === o && <Check size={12} color={accent}/>}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

/* ── yes/no: two substantial tappable cards ──────────────────────────────── */
function YesNoCard({ v, Icon, color, dark, sel, onPick }) {
  const active = sel === v
  return (
    <button onClick={() => onPick(v)} type="button"
      className="flex-1 flex flex-col items-center justify-center gap-1.5 py-4 rounded-2xl transition-all active:scale-[0.97] wc-yn-card"
      style={{
        border: `2px solid ${active ? color : (dark ? '#293548' : '#e2e8f0')}`,
        background: active ? `${color}1c` : (dark ? '#111c30' : '#fff'),
        boxShadow: active ? `0 6px 18px -10px ${color}99` : 'none',
        transition: 'border-color .18s ease, background .18s ease, box-shadow .18s ease, transform .12s ease',
      }}>
      <span className="flex items-center justify-center rounded-full transition-all"
        style={{ width: 34, height: 34, background: active ? color : (dark ? '#1c2942' : '#f1f5f9'), color: active ? '#fff' : (dark ? '#64748b' : '#94a3b8') }}>
        <Icon size={17} strokeWidth={2.5}/>
      </span>
      <span className="text-[12.5px] font-bold" style={{ color: active ? color : (dark ? '#cbd5e1' : '#475569') }}>{v}</span>
    </button>
  )
}
function YesNoAnswer({ accent, dark, onSubmit }) {
  const [sel, setSel] = useState(null)
  const pick = v => { setSel(v); onSubmit?.(v) }
  return (
    <div className="flex gap-2.5 w-full">
      <YesNoCard v="Yes" Icon={Check} color="#10b981" dark={dark} sel={sel} onPick={pick}/>
      <YesNoCard v="No" Icon={X} color="#ef4444" dark={dark} sel={sel} onPick={pick}/>
    </div>
  )
}

/* ── rating: stars with hover preview ────────────────────────────────────── */
function RatingAnswer({ accent, onSubmit }) {
  const [hover, setHover] = useState(0)
  const [sel, setSel] = useState(0)
  const shown = hover || sel
  return (
    <div className="flex gap-1.5 justify-center w-full">
      {[1, 2, 3, 4, 5].map(n => (
        <button key={n} onMouseEnter={() => setHover(n)} onMouseLeave={() => setHover(0)}
          onClick={() => { setSel(n); onSubmit?.(`${n} star${n === 1 ? '' : 's'}`) }}
          className="transition-transform" style={{ transform: shown >= n ? 'scale(1.12)' : 'scale(1)' }}>
          <Star size={26} className="transition-colors" style={{ color: '#f59e0b', fill: shown >= n ? '#f59e0b' : 'transparent' }}/>
        </button>
      ))}
    </div>
  )
}

/* ── nps: 0-10 segmented scale with a smooth color gradient ─────────────── */
function NpsAnswer({ onSubmit }) {
  const [sel, setSel] = useState(null)
  const colorFor = i => {
    // smooth red -> amber -> emerald across 0..10
    const stops = [[239,68,68],[245,158,11],[16,185,129]]
    const t = i / 10
    const seg = t < 0.5 ? 0 : 1
    const localT = t < 0.5 ? t / 0.5 : (t - 0.5) / 0.5
    const [r1,g1,b1] = stops[seg], [r2,g2,b2] = stops[seg+1]
    const r = Math.round(r1 + (r2-r1)*localT), g = Math.round(g1 + (g2-g1)*localT), b = Math.round(b1 + (b2-b1)*localT)
    return `rgb(${r},${g},${b})`
  }
  return (
    <div className="w-full">
      <div className="flex gap-1">
        {Array.from({ length: 11 }, (_, i) => {
          const c = colorFor(i)
          const active = sel === i
          return (
            <button key={i} onClick={() => { setSel(i); onSubmit?.(String(i)) }}
              className="flex-1 py-2 text-[10px] font-bold text-center rounded-lg transition-all"
              style={{
                border: `1.5px solid ${active ? c : `${c}55`}`,
                background: active ? c : `${c}14`,
                color: active ? '#fff' : c,
              }}>
              {i}
            </button>
          )
        })}
      </div>
      <div className="flex justify-between text-[9px] font-medium text-slate-400 mt-1.5"><span>Not likely</span><span>Very likely</span></div>
    </div>
  )
}

/* ── shared mini calendar (used by date / daterange / appt) ─────────────── */
const WEEKDAYS = ['Su','Mo','Tu','We','Th','Fr','Sa']
const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December']
function sameDay(a, b) { return a && b && a.getFullYear()===b.getFullYear() && a.getMonth()===b.getMonth() && a.getDate()===b.getDate() }
function inRange(d, a, b) { if (!a || !b) return false; const [lo, hi] = a <= b ? [a, b] : [b, a]; return d >= lo && d <= hi }

function MiniCalendar({ accent, dark, selected, rangeEnd, onPick }) {
  const today = new Date(); today.setHours(0,0,0,0)
  const [viewDate, setViewDate] = useState(new Date(selected || today))
  const year = viewDate.getFullYear(), month = viewDate.getMonth()
  const firstOfMonth = new Date(year, month, 1)
  const startOffset = firstOfMonth.getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const daysInPrevMonth = new Date(year, month, 0).getDate()
  const totalCells = Math.ceil((startOffset + daysInMonth) / 7) * 7
  const cells = Array.from({ length: totalCells }, (_, idx) => {
    const dayNum = idx - startOffset + 1
    if (dayNum < 1) return { date: new Date(year, month - 1, daysInPrevMonth + dayNum), outside: true }
    if (dayNum > daysInMonth) return { date: new Date(year, month + 1, dayNum - daysInMonth), outside: true }
    return { date: new Date(year, month, dayNum), outside: false }
  })
  return (
    <div className="w-full">
      <div className="flex items-center justify-between mb-2">
        <button onClick={() => setViewDate(new Date(year, month - 1, 1))} type="button"
          className="w-6 h-6 rounded-lg flex items-center justify-center transition-colors" style={{ color: dark ? '#94a3b8' : '#64748b' }}>
          <ChevronLeft size={14}/>
        </button>
        <span className="text-[11.5px] font-bold" style={{ color: dark ? '#e2e8f0' : '#1e293b' }}>{MONTHS[month]} {year}</span>
        <button onClick={() => setViewDate(new Date(year, month + 1, 1))} type="button"
          className="w-6 h-6 rounded-lg flex items-center justify-center transition-colors" style={{ color: dark ? '#94a3b8' : '#64748b' }}>
          <ChevronRight size={14}/>
        </button>
      </div>
      <div className="grid grid-cols-7 mb-1">
        {WEEKDAYS.map(w => <div key={w} className="text-[8.5px] font-bold text-center py-1" style={{ color: dark ? '#475569' : '#94a3b8' }}>{w}</div>)}
      </div>
      <div className="grid grid-cols-7 gap-y-1">
        {cells.map((c, i) => {
          const isSelected = sameDay(c.date, selected)
          const isEnd = rangeEnd && sameDay(c.date, rangeEnd)
          const isBetween = rangeEnd && !isSelected && !isEnd && inRange(c.date, selected, rangeEnd)
          const isToday = sameDay(c.date, today)
          const isPast = c.date < today
          return (
            <div key={i} className="flex items-center justify-center">
              <button type="button" disabled={isPast} onClick={() => onPick(c.date)}
                className="w-7 h-7 rounded-full text-[10.5px] font-semibold flex items-center justify-center transition-colors"
                style={{
                  color: c.outside ? (dark ? '#334155' : '#cbd5e1') : isPast ? (dark ? '#334155' : '#cbd5e1') : (isSelected || isEnd) ? '#fff' : (dark ? '#cbd5e1' : '#334155'),
                  background: (isSelected || isEnd) ? accent : isBetween ? `${accent}22` : 'transparent',
                  boxShadow: !isSelected && !isEnd && isToday ? `inset 0 0 0 1.5px ${accent}` : 'none',
                  cursor: isPast ? 'not-allowed' : 'pointer',
                }}>
                {c.date.getDate()}
              </button>
            </div>
          )
        })}
      </div>
    </div>
  )
}
function DateAnswer({ accent, dark, onSubmit }) {
  const [sel, setSel] = useState(null)
  const fmt = d => d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })
  return (
    <div className="w-full">
      <MiniCalendar accent={accent} dark={dark} selected={sel} onPick={setSel}/>
      <button disabled={!sel} onClick={() => sel && onSubmit?.(fmt(sel))}
        className="w-full mt-2.5 py-2 rounded-xl text-[11.5px] font-bold text-white transition-opacity"
        style={{ background: accent, opacity: sel ? 1 : 0.4 }}>
        {sel ? `Confirm ${fmt(sel)}` : 'Pick a date'}
      </button>
    </div>
  )
}
function DateRangeAnswer({ accent, dark, onSubmit }) {
  const [a, setA] = useState(null)
  const [b, setB] = useState(null)
  const fmt = d => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  const pick = d => {
    if (!a || (a && b)) { setA(d); setB(null) }
    else { if (d < a) { setB(a); setA(d) } else setB(d) }
  }
  return (
    <div className="w-full">
      <MiniCalendar accent={accent} dark={dark} selected={a} rangeEnd={b} onPick={pick}/>
      <button disabled={!a || !b} onClick={() => a && b && onSubmit?.(`${fmt(a)} → ${fmt(b)}`)}
        className="w-full mt-2.5 py-2 rounded-xl text-[11.5px] font-bold text-white transition-opacity"
        style={{ background: accent, opacity: a && b ? 1 : 0.4 }}>
        {a && b ? `Confirm ${fmt(a)} → ${fmt(b)}` : a ? 'Pick an end date' : 'Pick a start date'}
      </button>
    </div>
  )
}

/* ── time: segmented hour/minute + AM/PM stepper (no native <input type=time>) ── */
function TimeStepper({ label, value, dark, onUp, onDown }) {
  return (
    <div className="flex flex-col items-center gap-1">
      <button type="button" onClick={onUp} className="w-7 h-5 rounded-md flex items-center justify-center transition-colors" style={{ color: dark ? '#94a3b8' : '#64748b' }}><ChevronRight size={13} style={{ transform: 'rotate(-90deg)' }}/></button>
      <div className="w-11 h-11 rounded-xl flex items-center justify-center text-[16px] font-bold" style={{ background: dark ? '#111c30' : '#f4f6f9', color: dark ? '#e2e8f0' : '#1e293b' }}>{String(value).padStart(2, '0')}</div>
      <button type="button" onClick={onDown} className="w-7 h-5 rounded-md flex items-center justify-center transition-colors" style={{ color: dark ? '#94a3b8' : '#64748b' }}><ChevronRight size={13} style={{ transform: 'rotate(90deg)' }}/></button>
      <span className="text-[8px] font-bold uppercase tracking-wide" style={{ color: dark ? '#64748b' : '#94a3b8' }}>{label}</span>
    </div>
  )
}
function TimeAnswer({ accent, dark, onSubmit }) {
  const [h, setH] = useState(9), [m, setM] = useState(0), [ampm, setAmpm] = useState('AM')
  const step = (setter, val, max, min, delta) => setter((val + delta + (max - min + 1)) % (max - min + 1) + min)
  return (
    <div className="w-full">
      <div className="flex items-center justify-center gap-3">
        <TimeStepper label="Hour" value={h} dark={dark} onUp={() => step(setH, h, 12, 1, 1)} onDown={() => step(setH, h, 12, 1, -1)}/>
        <span className="text-[18px] font-bold" style={{ color: dark ? '#475569' : '#cbd5e1' }}>:</span>
        <TimeStepper label="Min" value={m} dark={dark} onUp={() => step(setM, m, 59, 0, 5)} onDown={() => step(setM, m, 59, 0, -5)}/>
        <div className="flex flex-col gap-1">
          {['AM', 'PM'].map(p => (
            <button key={p} type="button" onClick={() => setAmpm(p)}
              className="px-2.5 py-1.5 rounded-lg text-[10.5px] font-bold transition-colors"
              style={{ background: ampm === p ? accent : (dark ? '#111c30' : '#f4f6f9'), color: ampm === p ? '#fff' : (dark ? '#94a3b8' : '#64748b') }}>
              {p}
            </button>
          ))}
        </div>
      </div>
      <button onClick={() => onSubmit?.(`${h}:${String(m).padStart(2, '0')} ${ampm}`)}
        className="w-full mt-3 py-2 rounded-xl text-[11.5px] font-bold text-white" style={{ background: accent }}>
        Confirm {h}:{String(m).padStart(2, '0')} {ampm}
      </button>
    </div>
  )
}

/* ── appointment: mini calendar + slot chip grid ─────────────────────────── */
const APPT_SLOT_SETS = [
  ['9:00 AM', '11:30 AM', '2:00 PM'],
  ['10:00 AM', '1:00 PM', '3:30 PM', '5:00 PM'],
  ['9:30 AM', '12:00 PM'],
]
function slotsForDate(date) {
  const seed = date.getFullYear() * 372 + date.getMonth() * 31 + date.getDate()
  if (seed % 7 === 6) return []
  return APPT_SLOT_SETS[seed % APPT_SLOT_SETS.length]
}
function ApptAnswer({ accent, dark, onSubmit }) {
  const today = new Date(); today.setHours(0,0,0,0)
  const [sel, setSel] = useState(today)
  const [slot, setSlot] = useState(null)
  const slots = slotsForDate(sel)
  const fmt = d => d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
  return (
    <div className="w-full">
      <MiniCalendar accent={accent} dark={dark} selected={sel} onPick={d => { setSel(d); setSlot(null) }}/>
      <p className="text-[9px] font-bold uppercase tracking-wide mt-3 mb-1.5" style={{ color: dark ? '#64748b' : '#94a3b8' }}>Available times — {fmt(sel)}</p>
      {slots.length === 0 ? (
        <p className="text-[10.5px] italic py-1" style={{ color: dark ? '#64748b' : '#94a3b8' }}>No slots this day — try another date.</p>
      ) : (
        <div className="grid grid-cols-3 gap-1.5">
          {slots.map(t => (
            <button key={t} type="button" onClick={() => setSlot(t)}
              className="rounded-lg py-1.5 text-[10px] font-bold text-center transition-colors"
              style={{ background: slot === t ? accent : (dark ? '#111c30' : '#f4f6f9'), color: slot === t ? '#fff' : (dark ? '#cbd5e1' : '#64748b') }}>
              {t}
            </button>
          ))}
        </div>
      )}
      <button disabled={!slot} onClick={() => slot && onSubmit?.(`${fmt(sel)} at ${slot}`)}
        className="w-full mt-3 py-2 rounded-xl text-[11.5px] font-bold text-white transition-opacity"
        style={{ background: accent, opacity: slot ? 1 : 0.4 }}>
        {slot ? `Confirm ${fmt(sel)} at ${slot}` : 'Pick a time slot'}
      </button>
    </div>
  )
}

/* ── file / image: real drag-and-drop dropzone with picker fallback ─────── */
function DropzoneAnswer({ accent, dark, onSubmit, kind }) {
  const isImage = kind === 'image'
  const [dragOver, setDragOver] = useState(false)
  const [file, setFile] = useState(null)
  const [previewUrl, setPreviewUrl] = useState(null)
  const inputRef = useRef(null)

  const handleFiles = useCallback((files) => {
    const f = files && files[0]
    if (!f) return
    setFile(f)
    if (isImage && f.type?.startsWith('image/')) {
      try { setPreviewUrl(URL.createObjectURL(f)) } catch { setPreviewUrl(null) }
    }
  }, [isImage])

  useEffect(() => () => { if (previewUrl) URL.revokeObjectURL(previewUrl) }, [previewUrl])

  const simulate = () => {
    const name = isImage ? 'screenshot.png' : 'document.pdf'
    setFile({ name, size: 214000 })
  }

  const fmtSize = b => b ? `${(b / 1024).toFixed(0)} KB` : ''

  return (
    <div className="w-full">
      {!file ? (
        <div
          onDragOver={e => { e.preventDefault(); setDragOver(true) }}
          onDragLeave={() => setDragOver(false)}
          onDrop={e => { e.preventDefault(); setDragOver(false); handleFiles(e.dataTransfer.files) }}
          onClick={() => inputRef.current?.click()}
          className="w-full rounded-2xl border-2 border-dashed py-6 flex flex-col items-center gap-1.5 cursor-pointer transition-colors"
          style={{ borderColor: dragOver ? accent : (dark ? '#334155' : '#cbd5e1'), background: dragOver ? `${accent}14` : (dark ? '#111c30' : '#f8fafc') }}>
          {isImage ? <ImageIcon size={20} style={{ color: dragOver ? accent : (dark ? '#64748b' : '#94a3b8') }}/> : <Upload size={20} style={{ color: dragOver ? accent : (dark ? '#64748b' : '#94a3b8') }}/>}
          <span className="text-[11px] font-semibold" style={{ color: dark ? '#94a3b8' : '#64748b' }}>
            {dragOver ? 'Drop it here' : isImage ? 'Drag an image here, or click to browse' : 'Drag a file here, or click to browse'}
          </span>
          <button type="button" onClick={e => { e.stopPropagation(); simulate() }}
            className="text-[9.5px] font-bold mt-0.5 underline" style={{ color: accent }}>
            Simulate {isImage ? 'upload' : 'upload'} instead
          </button>
          <input ref={inputRef} type="file" accept={isImage ? 'image/*' : undefined} className="hidden"
            onChange={e => handleFiles(e.target.files)}/>
        </div>
      ) : (
        <div className="w-full rounded-2xl p-2.5 flex items-center gap-2.5" style={{ background: dark ? '#111c30' : '#f4f6f9', border: `1.5px solid ${dark ? '#22304a' : '#e3e8f0'}` }}>
          {previewUrl ? (
            <img src={previewUrl} alt="" className="w-10 h-10 rounded-lg object-cover flex-shrink-0"/>
          ) : (
            <div className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: `${accent}18`, color: accent }}>
              {isImage ? <ImageIcon size={16}/> : <FileText size={16}/>}
            </div>
          )}
          <div className="flex-1 min-w-0">
            <p className="text-[11px] font-semibold truncate" style={{ color: dark ? '#e2e8f0' : '#1e293b' }}>{file.name}</p>
            <p className="text-[9.5px]" style={{ color: dark ? '#64748b' : '#94a3b8' }}>{fmtSize(file.size)}</p>
          </div>
          <button type="button" onClick={() => { setFile(null); setPreviewUrl(null) }} className="p-1 rounded-full flex-shrink-0" style={{ color: dark ? '#64748b' : '#94a3b8' }}><X size={13}/></button>
          <button type="button" onClick={() => onSubmit?.(`${isImage ? '🖼️' : '📎'} ${file.name}`)}
            className="px-3 py-1.5 rounded-full text-[10.5px] font-bold text-white flex-shrink-0" style={{ background: accent }}>
            Use this
          </button>
        </div>
      )}
    </div>
  )
}

/* ── signature: a real drawable canvas pad ───────────────────────────────── */
function SignatureAnswer({ accent, dark, onSubmit }) {
  const canvasRef = useRef(null)
  const drawing = useRef(false)
  const hasDrawn = useRef(false)
  const [empty, setEmpty] = useState(true)

  const getCtx = () => canvasRef.current?.getContext('2d')
  const pos = e => {
    const rect = canvasRef.current.getBoundingClientRect()
    const p = e.touches ? e.touches[0] : e
    return { x: p.clientX - rect.left, y: p.clientY - rect.top }
  }
  const start = e => {
    drawing.current = true
    const ctx = getCtx(); if (!ctx) return
    const { x, y } = pos(e)
    ctx.beginPath(); ctx.moveTo(x, y)
  }
  const move = e => {
    if (!drawing.current) return
    e.preventDefault()
    const ctx = getCtx(); if (!ctx) return
    const { x, y } = pos(e)
    ctx.lineTo(x, y); ctx.strokeStyle = dark ? '#e2e8f0' : '#1e293b'; ctx.lineWidth = 2; ctx.lineCap = 'round'; ctx.stroke()
    hasDrawn.current = true
    setEmpty(false)
  }
  const end = () => { drawing.current = false }
  const clear = () => {
    const c = canvasRef.current, ctx = getCtx()
    if (c && ctx) ctx.clearRect(0, 0, c.width, c.height)
    hasDrawn.current = false
    setEmpty(true)
  }
  return (
    <div className="w-full">
      <canvas ref={canvasRef} width={340} height={110}
        className="w-full rounded-2xl border-2 border-dashed touch-none"
        style={{ borderColor: dark ? '#334155' : '#cbd5e1', background: dark ? '#111c30' : '#fff', cursor: 'crosshair' }}
        onMouseDown={start} onMouseMove={move} onMouseUp={end} onMouseLeave={end}
        onTouchStart={start} onTouchMove={move} onTouchEnd={end}/>
      {empty && <p className="text-[10px] text-center mt-1" style={{ color: dark ? '#64748b' : '#94a3b8' }}>Sign above with your mouse or finger</p>}
      <div className="flex gap-2 mt-2">
        <button type="button" onClick={clear} disabled={empty}
          className="flex-1 py-1.5 rounded-lg text-[10.5px] font-bold transition-opacity"
          style={{ background: dark ? '#1e293b' : '#f1f5f9', color: dark ? '#94a3b8' : '#64748b', opacity: empty ? 0.5 : 1 }}>
          Clear
        </button>
        <button type="button" disabled={empty} onClick={() => onSubmit?.('✍️ Signed')}
          className="flex-1 py-1.5 rounded-lg text-[10.5px] font-bold text-white transition-opacity"
          style={{ background: accent, opacity: empty ? 0.4 : 1 }}>
          Done
        </button>
      </div>
    </div>
  )
}

/* ── location: search input + real geolocation button ────────────────────── */
/* ── Google Maps JS API (Places library) — loaded once, lazily, only when a
   merchant has actually configured a key (Widget Builder → Behavior →
   "Location Search"). Without a key, LocationAnswer below falls back to a
   plain address text field — it never breaks, it just doesn't get live
   autocomplete/geocoding until a key is supplied. ────────────────────────── */
let gmapsPromise = null
function loadGoogleMaps(apiKey) {
  if (!apiKey) return Promise.reject(new Error('no key'))
  if (window.google?.maps?.places) return Promise.resolve(window.google.maps)
  if (gmapsPromise) return gmapsPromise
  gmapsPromise = new Promise((resolve, reject) => {
    const cbName = '__wcGmapsCallback'
    window[cbName] = () => { resolve(window.google.maps); delete window[cbName] }
    const script = document.createElement('script')
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(apiKey)}&libraries=places&callback=${cbName}`
    script.async = true
    script.onerror = () => { gmapsPromise = null; reject(new Error('Google Maps failed to load — check the API key and that the Places API is enabled.')) }
    document.head.appendChild(script)
  })
  return gmapsPromise
}
function useGoogleMaps(apiKey) {
  const [status, setStatus] = useState(apiKey ? 'loading' : 'no-key') // no-key | loading | ready | error
  useEffect(() => {
    if (!apiKey) { setStatus('no-key'); return }
    let cancelled = false
    setStatus('loading')
    loadGoogleMaps(apiKey).then(
      () => { if (!cancelled) setStatus('ready') },
      () => { if (!cancelled) setStatus('error') },
    )
    return () => { cancelled = true }
  }, [apiKey])
  return status
}

function LocationAnswer({ accent, dark, onSubmit, googleMapsApiKey }) {
  const [val, setVal] = useState('')
  const [locating, setLocating] = useState(false)
  const [picked, setPicked] = useState(null) // { address, lat, lng } once a real place is chosen
  const inputRef = useRef(null)
  const autocompleteRef = useRef(null)
  const gmapsStatus = useGoogleMaps(googleMapsApiKey)
  const live = gmapsStatus === 'ready'

  // Wire real Places Autocomplete onto the input once the script is loaded.
  useEffect(() => {
    if (!live || !inputRef.current || autocompleteRef.current) return
    const ac = new window.google.maps.places.Autocomplete(inputRef.current, { fields: ['formatted_address', 'geometry', 'name'] })
    ac.addListener('place_changed', () => {
      const place = ac.getPlace()
      const address = place?.formatted_address || place?.name || inputRef.current.value
      const loc = place?.geometry?.location
      setVal(address)
      setPicked({ address, lat: loc ? loc.lat() : null, lng: loc ? loc.lng() : null })
    })
    autocompleteRef.current = ac
    return () => { window.google?.maps?.event?.clearInstanceListeners(ac) }
  }, [live])

  const geocode = (lat, lng) => new Promise(resolve => {
    if (!live) return resolve(null)
    new window.google.maps.Geocoder().geocode({ location: { lat, lng } }, (results, status) => {
      resolve(status === 'OK' && results?.[0] ? results[0].formatted_address : null)
    })
  })

  const useMyLocation = () => {
    if (!navigator.geolocation) { onSubmit?.('📍 Location unavailable'); return }
    setLocating(true)
    navigator.geolocation.getCurrentPosition(
      async pos => {
        const { latitude: lat, longitude: lng } = pos.coords
        const address = await geocode(lat, lng)
        setLocating(false)
        onSubmit?.(address ? `📍 ${address}` : `📍 ${lat.toFixed(4)}, ${lng.toFixed(4)}`)
      },
      () => { setLocating(false); onSubmit?.('📍 Permission denied — please type your address') },
      { timeout: 5000 },
    )
  }

  const submit = () => {
    if (!val.trim()) return
    onSubmit?.(picked?.address === val ? `📍 ${val.trim()}` : val.trim())
  }

  return (
    <div className="w-full space-y-1.5">
      <ComposerPill dark={dark} accent={accent}>
        <Search size={13} className="flex-shrink-0 mb-1.5" style={{ color: dark ? '#64748b' : '#94a3b8' }}/>
        <input ref={inputRef} autoFocus value={val}
          onChange={e => { setVal(e.target.value); if (picked) setPicked(null) }}
          onKeyDown={e => e.key === 'Enter' && submit()}
          placeholder={live ? 'Search for an address…' : 'Search address…'}
          className={clsx('flex-1 bg-transparent outline-none min-w-0 px-1 py-1.5 text-[12px]', dark ? 'text-slate-100 placeholder-slate-500' : 'text-slate-800 placeholder-slate-400')}/>
        <SendBtn accent={accent} onClick={submit} disabled={!val.trim()}/>
      </ComposerPill>
      {picked?.lat != null && (
        <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg wc-ac-fade" style={{ background: `${accent}12` }}>
          <MapPin size={11} style={{ color: accent, flexShrink: 0 }}/>
          <span className="text-[10px] font-medium truncate" style={{ color: dark ? '#e2e8f0' : '#334155' }}>Pinned location selected</span>
        </div>
      )}
      <button type="button" onClick={useMyLocation}
        className="w-full flex items-center justify-center gap-1.5 py-1.5 rounded-xl text-[10.5px] font-bold transition-colors"
        style={{ background: dark ? '#111c30' : '#f4f6f9', color: accent, border: `1.5px solid ${dark ? '#22304a' : '#e3e8f0'}` }}>
        <LocateFixed size={12} className={locating ? 'animate-pulse' : ''}/> {locating ? 'Locating…' : 'Use my current location'}
      </button>
      {googleMapsApiKey && gmapsStatus === 'error' && (
        <p className="text-[9.5px] text-center" style={{ color: dark ? '#f87171' : '#dc2626' }}>
          Couldn't load Google Maps — check the API key in Behavior settings.
        </p>
      )}
    </div>
  )
}

/* ── payment: modern, trustworthy card-entry form — card number always gets
   its own full-width row, expiry+CVV share the row below; NEVER a 3-up
   row (that's what caused horizontal overflow at the widget's ~360-400px
   width previously) ──────────────────────────────────────────────────── */
function cardBrand(num) {
  if (/^4/.test(num)) return 'VISA'
  if (/^5[1-5]/.test(num)) return 'Mastercard'
  if (/^3[47]/.test(num)) return 'Amex'
  if (/^6(?:011|5)/.test(num)) return 'Discover'
  return ''
}
const BRAND_COLOR = { VISA: '#1a1f71', Mastercard: '#eb001b', Amex: '#2e77bc', Discover: '#f76b1c' }
function PaymentField({ label, dark, children }) {
  return (
    <div className="min-w-0">
      <p className="text-[8.5px] font-bold uppercase tracking-wide mb-1" style={{ color: dark ? '#64748b' : '#94a3b8' }}>{label}</p>
      {children}
    </div>
  )
}
function PaymentAnswer({ accent, dark, onSubmit }) {
  const [num, setNum] = useState('')
  const [exp, setExp] = useState('')
  const [cvv, setCvv] = useState('')
  const formatNum = v => v.replace(/\D/g, '').slice(0, 16).replace(/(\d{4})(?=\d)/g, '$1 ')
  const formatExp = v => v.replace(/\D/g, '').slice(0, 4).replace(/(\d{2})(?=\d)/, '$1/')
  const cleanNum = num.replace(/\s/g, '')
  const brand = cardBrand(cleanNum)
  const complete = cleanNum.length >= 15 && exp.length === 5 && cvv.length >= 3
  const fieldStyle = { width: '100%', minWidth: 0, background: dark ? '#111c30' : '#f4f6f9', border: `1.5px solid ${dark ? '#22304a' : '#e3e8f0'}`, color: dark ? '#e2e8f0' : '#1e293b', boxSizing: 'border-box' }
  return (
    <div className="w-full rounded-2xl p-3 space-y-2.5" style={{ background: dark ? '#0b1424' : '#fff', border: `1.5px solid ${dark ? '#22304a' : '#e3e8f0'}` }}>
      <PaymentField label="Card number" dark={dark}>
        <div className="relative w-full min-w-0">
          <input value={num} onChange={e => setNum(formatNum(e.target.value))} placeholder="1234 5678 9012 3456" inputMode="numeric"
            className="rounded-xl px-3 py-2.5 pr-16 text-[12px] font-mono tracking-wide outline-none" style={fieldStyle}/>
          {brand && (
            <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[8.5px] font-black px-1.5 py-1 rounded-md text-white wc-ac-pop"
              style={{ background: BRAND_COLOR[brand] || accent }}>{brand === 'Mastercard' ? 'MC' : brand === 'Discover' ? 'DISC' : brand}</span>
          )}
        </div>
      </PaymentField>
      <div className="grid grid-cols-2 gap-2">
        <PaymentField label="Expiry" dark={dark}>
          <input value={exp} onChange={e => setExp(formatExp(e.target.value))} placeholder="MM/YY" inputMode="numeric"
            className="rounded-xl px-3 py-2.5 text-[12px] font-mono outline-none" style={fieldStyle}/>
        </PaymentField>
        <PaymentField label="CVV" dark={dark}>
          <input value={cvv} onChange={e => setCvv(e.target.value.replace(/\D/g, '').slice(0, 4))} placeholder="123" inputMode="numeric" type="password"
            className="rounded-xl px-3 py-2.5 text-[12px] font-mono outline-none" style={fieldStyle}/>
        </PaymentField>
      </div>
      <button disabled={!complete} onClick={() => onSubmit?.('💳 Payment completed')}
        className="w-full flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-[11.5px] font-bold text-white transition-opacity"
        style={{ background: accent, opacity: complete ? 1 : 0.4 }}>
        <Lock size={12}/> Pay securely
      </button>
    </div>
  )
}

/* ── otp: per-digit boxes with auto-advance ──────────────────────────────── */
/* Countdown + resend are each independently optional (a flow author may want
   just the timer as a hint, just a resend button with no wait, both, or
   neither) — controlled by `showTimer`/`showResend`/`seconds`, configurable
   per-node in NodeEditModal's OTP panel and defaulting to a sensible 30s
   countdown + resend for the cosmetic Appearance-tab preview (no node
   context there). Resending clears the entered digits and restarts the
   countdown, matching real OTP UX. */
function OtpAnswer({ accent, dark, onSubmit, showTimer = true, showResend = true, seconds = 30 }) {
  const LEN = 6
  const [digits, setDigits] = useState(Array(LEN).fill(''))
  const [left, setLeft] = useState(showTimer ? seconds : 0)
  const refs = useRef([])
  useEffect(() => {
    if (left <= 0) return
    const t = setTimeout(() => setLeft(s => Math.max(0, s - 1)), 1000)
    return () => clearTimeout(t)
  }, [left])
  const setDigit = (i, v) => {
    const clean = v.replace(/\D/g, '').slice(-1)
    setDigits(p => { const n = [...p]; n[i] = clean; return n })
    if (clean && i < LEN - 1) refs.current[i + 1]?.focus()
  }
  const onKeyDown = (i, e) => {
    if (e.key === 'Backspace' && !digits[i] && i > 0) refs.current[i - 1]?.focus()
  }
  const resend = () => {
    setDigits(Array(LEN).fill(''))
    setLeft(showTimer ? seconds : 0)
    refs.current[0]?.focus()
  }
  const complete = digits.every(d => d !== '')
  const mm = Math.floor(left / 60), ss = String(left % 60).padStart(2, '0')
  const mutedColor = dark ? '#64748b' : '#94a3b8'
  return (
    <div className="w-full">
      <div className="flex gap-1.5 justify-center">
        {digits.map((d, i) => (
          <input key={i} ref={el => refs.current[i] = el} value={d} maxLength={1} inputMode="numeric"
            onChange={e => setDigit(i, e.target.value)} onKeyDown={e => onKeyDown(i, e)}
            className="w-9 h-11 rounded-xl text-center text-[15px] font-bold outline-none transition-colors"
            style={{ background: dark ? '#111c30' : '#f4f6f9', border: `1.5px solid ${d ? accent : (dark ? '#22304a' : '#e3e8f0')}`, color: dark ? '#e2e8f0' : '#1e293b' }}/>
        ))}
      </div>
      <button disabled={!complete} onClick={() => onSubmit?.(digits.join(''))}
        className="w-full mt-3 py-2 rounded-xl text-[11.5px] font-bold text-white transition-opacity"
        style={{ background: accent, opacity: complete ? 1 : 0.4 }}>
        Verify code
      </button>
      {showResend && (
        <div className="flex items-center justify-center mt-2">
          {left > 0
            ? <span className="text-[10.5px] font-medium" style={{ color: mutedColor }}>Resend code in {mm}:{ss}</span>
            : <button type="button" onClick={resend} className="text-[10.5px] font-bold transition-opacity hover:opacity-70" style={{ color: accent }}>↻ Resend code</button>}
        </div>
      )}
      {!showResend && showTimer && left > 0 && (
        <p className="text-center text-[10.5px] font-medium mt-2" style={{ color: mutedColor }}>Code expires in {mm}:{ss}</p>
      )}
    </div>
  )
}

/* ── multi-field form: configurable per node (formFields), falling back to
   the default Name/Email/Phone set when no config is given (e.g. the
   Appearance tab's cosmetic preview, which has no per-node flow context). ── */
export const DEFAULT_FORM_FIELDS = [
  { id: 'name', label: 'Name', type: 'text', enabled: true },
  { id: 'email', label: 'Email', type: 'email', enabled: true },
  { id: 'phone', label: 'Phone', type: 'phone', enabled: true },
]
const FORM_REQUIRED_IDS = new Set(['name', 'email'])
function FormField({ label, dark, fieldStyle, children }) {
  return (
    <div className="min-w-0">
      <p className="text-[8.5px] font-bold uppercase tracking-wide mb-1" style={{ color: dark ? '#64748b' : '#94a3b8' }}>{label}</p>
      {children}
    </div>
  )
}
function FormPhoneField({ label, dark, fieldStyle, onChange }) {
  const [num, setNum] = useState('')
  const [country, setCountry] = useDetectedCountry()
  useEffect(() => { onChange(num.trim() ? `${country.dial} ${num.trim()}` : '') }, [num, country]) // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <FormField label={label} dark={dark}>
      <div className="flex items-center gap-1 rounded-lg pl-1 pr-2 py-1" style={fieldStyle}>
        <CountryDialPicker country={country} setCountry={setCountry} dark={dark} dropDirection="down"/>
        <input value={num} onChange={e => setNum(e.target.value.replace(/[^\d\s-]/g, ''))} placeholder="Phone number" type="tel"
          className={clsx('flex-1 min-w-0 bg-transparent outline-none text-[11.5px] px-1 py-1', dark ? 'text-slate-100 placeholder-slate-500' : 'text-slate-800 placeholder-slate-400')}/>
      </div>
    </FormField>
  )
}
function FormDropdownField({ label, dark, fieldStyle, options, onChange }) {
  const [val, setVal] = useState('')
  useEffect(() => { onChange(val) }, [val]) // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <FormField label={label} dark={dark}>
      <select value={val} onChange={e => setVal(e.target.value)}
        className="w-full rounded-lg px-2.5 py-1.5 text-[11.5px] outline-none appearance-none" style={fieldStyle}>
        <option value="">Select…</option>
        {options.map(o => <option key={o} value={o}>{o}</option>)}
      </select>
    </FormField>
  )
}
function FormAnswer({ accent, dark, onSubmit, formFields }) {
  const fields = (formFields && formFields.length ? formFields : DEFAULT_FORM_FIELDS).filter(f => f.enabled !== false)
  const [values, setValues] = useState({})
  const setField = (id, v) => setValues(p => ({ ...p, [id]: v }))
  const fieldStyle = { background: dark ? '#111c30' : '#f4f6f9', border: `1.5px solid ${dark ? '#22304a' : '#e3e8f0'}`, color: dark ? '#e2e8f0' : '#1e293b' }
  const complete = fields.filter(f => FORM_REQUIRED_IDS.has(f.id)).every(f => (values[f.id] || '').trim())
  const submit = () => {
    const summary = fields.map(f => (values[f.id] || '').trim()).filter(Boolean).join(' · ')
    onSubmit?.(summary || '(empty form)')
  }
  return (
    <div className="w-full rounded-2xl p-3 space-y-2" style={{ background: dark ? '#0b1424' : '#fff', border: `1.5px solid ${dark ? '#22304a' : '#e3e8f0'}` }}>
      {fields.map(f => {
        if (f.type === 'phone') {
          return <FormPhoneField key={f.id} label={f.label} dark={dark} fieldStyle={fieldStyle} onChange={v => setField(f.id, v)}/>
        }
        if (f.type === 'dropdown') {
          return <FormDropdownField key={f.id} label={f.label} dark={dark} fieldStyle={fieldStyle} options={f.options || []} onChange={v => setField(f.id, v)}/>
        }
        return (
          <FormField key={f.id} label={f.label} dark={dark}>
            <input value={values[f.id] || ''} onChange={e => setField(f.id, e.target.value)}
              placeholder={f.type === 'email' ? 'you@example.com' : f.label} type={f.type === 'email' ? 'email' : 'text'}
              className="w-full rounded-lg px-2.5 py-1.5 text-[11.5px] outline-none" style={fieldStyle}/>
          </FormField>
        )
      })}
      <button disabled={!complete} onClick={submit}
        className="w-full py-2 rounded-lg text-[11px] font-bold text-white transition-opacity" style={{ background: accent, opacity: complete ? 1 : 0.4 }}>
        Submit
      </button>
    </div>
  )
}

/* ── carousel family: horizontally-scrollable card rows ─────────────────── */
function CardRow({ items, dark, accent, renderFoot }) {
  return (
    <div className="flex gap-2 w-full overflow-x-auto pb-1" style={{ scrollSnapType: 'x mandatory' }}>
      {items.map((it, i) => (
        <div key={i} className="flex-shrink-0 rounded-2xl overflow-hidden transition-transform"
          style={{ width: 128, scrollSnapAlign: 'start', background: dark ? '#111c30' : '#fff', border: `1.5px solid ${dark ? '#22304a' : '#eef1f6'}`, boxShadow: '0 6px 16px -10px rgba(15,23,42,.3)' }}>
          <div className="h-16 flex items-center justify-center" style={{ background: it.color }}>
            {it.badge && <p className="text-[13px] font-black text-white">{it.badge}</p>}
          </div>
          <div className="p-2">
            <p className="text-[10.5px] font-bold truncate" style={{ color: dark ? '#e2e8f0' : '#1e293b' }}>{it.title}</p>
            {it.sub && <p className="text-[9px] truncate mt-0.5" style={{ color: dark ? '#64748b' : '#94a3b8' }}>{it.sub}</p>}
            {renderFoot(it, i)}
          </div>
        </div>
      ))}
    </div>
  )
}
function CarouselAnswer({ accent, dark, onSubmit }) {
  const items = [
    { title: 'Starter Plan', sub: 'Best for individuals', color: '#93C5FD' },
    { title: 'Growth Plan', sub: 'For growing teams', color: '#C4B5FD' },
    { title: 'Enterprise Plan', sub: 'Custom & scalable', color: '#6EE7B7' },
  ]
  return <CardRow items={items} dark={dark} accent={accent} renderFoot={it => (
    <button onClick={() => onSubmit?.(it.title)} className="w-full mt-1.5 py-1 rounded-md text-[9.5px] font-bold" style={{ background: `${accent}18`, color: accent }}>Select</button>
  )}/>
}
function CarouselButtonsAnswer({ accent, dark, onSubmit }) {
  const items = [
    { title: 'Starter', badge: '$19/mo', color: '#93C5FD' },
    { title: 'Growth', badge: '$49/mo', color: '#C4B5FD' },
    { title: 'Enterprise', badge: 'Custom', color: '#6EE7B7' },
  ]
  return <CardRow items={items} dark={dark} accent={accent} renderFoot={it => (
    <button onClick={() => onSubmit?.(`Selected: ${it.title}`)} className="w-full mt-1.5 py-1 rounded-md text-[9.5px] font-bold text-white" style={{ background: accent }}>Select</button>
  )}/>
}
function CatalogAnswer({ accent, dark, onSubmit }) {
  const items = [
    { title: 'Classic Tee', badge: '₹799', color: '#FDE68A' },
    { title: 'Denim Jacket', badge: '₹2,499', color: '#BFDBFE' },
    { title: 'Canvas Bag', badge: '₹999', color: '#FBCFE8' },
    { title: 'Running Shoes', badge: '₹3,199', color: '#C7D2FE' },
  ]
  return <CardRow items={items} dark={dark} accent={accent} renderFoot={it => (
    <div className="flex items-center justify-between mt-1">
      <span className="text-[10px] font-bold" style={{ color: dark ? '#e2e8f0' : '#1e293b' }}>{it.badge}</span>
      <button onClick={() => onSubmit?.(`Added to cart: ${it.title}`)}
        className="w-5 h-5 rounded-full flex items-center justify-center" style={{ background: `${accent}18`, color: accent }}>
        <Plus size={11}/>
      </button>
    </div>
  )}/>
}

/* ── public entry point ──────────────────────────────────────────────────── */
export function AnswerControl({ questionType, accent = '#0066ff', dark = false, onSubmit, interactive = true, formFields, otpConfig, googleMapsApiKey }) {
  useAnswerControlStyles()
  const submit = interactive ? onSubmit : undefined

  switch (questionType) {
    case 'short': case 'number': case 'url':
      return <FreeTextAnswer questionType={questionType} accent={accent} dark={dark} onSubmit={submit}/>
    case 'long':
      return <FreeTextAnswer questionType="long" accent={accent} dark={dark} onSubmit={submit}/>
    case 'email':
      return <EmailAnswer accent={accent} dark={dark} onSubmit={submit}/>
    case 'phone':
      return <PhoneAnswer accent={accent} dark={dark} onSubmit={submit}/>
    case 'single':
      return <SingleChoiceAnswer accent={accent} dark={dark} onSubmit={submit}/>
    case 'multi':
      return <MultiChoiceAnswer accent={accent} dark={dark} onSubmit={submit}/>
    case 'dropdown':
      return <DropdownAnswer accent={accent} dark={dark} onSubmit={submit}/>
    case 'yesno':
      return <YesNoAnswer accent={accent} dark={dark} onSubmit={submit}/>
    case 'rating':
      return <RatingAnswer accent={accent} dark={dark} onSubmit={submit}/>
    case 'nps':
      return <NpsAnswer accent={accent} dark={dark} onSubmit={submit}/>
    case 'date':
      return <DateAnswer accent={accent} dark={dark} onSubmit={submit}/>
    case 'daterange':
      return <DateRangeAnswer accent={accent} dark={dark} onSubmit={submit}/>
    case 'time':
      return <TimeAnswer accent={accent} dark={dark} onSubmit={submit}/>
    case 'appt':
      return <ApptAnswer accent={accent} dark={dark} onSubmit={submit}/>
    case 'file':
      return <DropzoneAnswer kind="file" accent={accent} dark={dark} onSubmit={submit}/>
    case 'image':
      return <DropzoneAnswer kind="image" accent={accent} dark={dark} onSubmit={submit}/>
    case 'signature':
      return <SignatureAnswer accent={accent} dark={dark} onSubmit={submit}/>
    case 'location':
      return <LocationAnswer accent={accent} dark={dark} onSubmit={submit} googleMapsApiKey={googleMapsApiKey}/>
    case 'payment':
      return <PaymentAnswer accent={accent} dark={dark} onSubmit={submit}/>
    case 'otp':
      return <OtpAnswer accent={accent} dark={dark} onSubmit={submit}
        showTimer={otpConfig?.showTimer ?? true} showResend={otpConfig?.showResend ?? true} seconds={otpConfig?.seconds ?? 30}/>
    case 'form':
      return <FormAnswer accent={accent} dark={dark} onSubmit={submit} formFields={formFields}/>
    case 'carousel':
      return <CarouselAnswer accent={accent} dark={dark} onSubmit={submit}/>
    case 'carousel_buttons':
      return <CarouselButtonsAnswer accent={accent} dark={dark} onSubmit={submit}/>
    case 'catalog':
      return <CatalogAnswer accent={accent} dark={dark} onSubmit={submit}/>
    default:
      return <FreeTextAnswer questionType="short" accent={accent} dark={dark} onSubmit={submit}/>
  }
}
