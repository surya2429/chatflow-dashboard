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
import LocationMap, { useGoogleMaps, reverseGeocode } from './LocationMap'
import { isFreeEmail, COMPANY_EMAIL_MESSAGE } from '../../lib/emailDomains'
import ShipmentBookingAnswer from './ShipmentBookingAnswer'
import ShipmentCalculationAnswer from './ShipmentCalculationAnswer'
import {
  Send, Star, Calendar as CalendarIcon, ChevronLeft, ChevronRight, ChevronDown,
  Check, X, Upload, Image as ImageIcon, Pencil, MapPin, CreditCard, Lock,
  Clock, Search, LocateFixed, Plus, FileText, Paperclip,
  HelpCircle, Sparkles, BadgeCheck, ExternalLink, List, Layers, Tags, LayoutGrid,
  AlignJustify, Grid2x2,
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
export const COUNTRIES = [
  ['US','United States','+1'], ['IN','India','+91'], ['GB','United Kingdom','+44'],
  ['CA','Canada','+1'], ['AU','Australia','+61'], ['DE','Germany','+49'],
  ['FR','France','+33'], ['ES','Spain','+34'], ['IT','Italy','+39'],
  ['BR','Brazil','+55'], ['MX','Mexico','+52'], ['JP','Japan','+81'],
  ['CN','China','+86'], ['SG','Singapore','+65'], ['AE','United Arab Emirates','+971'],
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
/* The rest of the world, alphabetically after the popular ones above. */
COUNTRIES.push(...('AF|Afghanistan|+93;AL|Albania|+355;DZ|Algeria|+213;AD|Andorra|+376;AO|Angola|+244;AM|Armenia|+374;AZ|Azerbaijan|+994;BS|Bahamas|+1242;BH|Bahrain|+973;BB|Barbados|+1246;BY|Belarus|+375;BZ|Belize|+501;BJ|Benin|+229;BT|Bhutan|+975;BO|Bolivia|+591;BA|Bosnia and Herzegovina|+387;BW|Botswana|+267;BN|Brunei|+673;BG|Bulgaria|+359;BF|Burkina Faso|+226;BI|Burundi|+257;KH|Cambodia|+855;CM|Cameroon|+237;CV|Cape Verde|+238;CF|Central African Republic|+236;TD|Chad|+235;KM|Comoros|+269;CG|Congo|+242;CD|DR Congo|+243;CR|Costa Rica|+506;HR|Croatia|+385;CU|Cuba|+53;CY|Cyprus|+357;CZ|Czechia|+420;DJ|Djibouti|+253;DO|Dominican Republic|+1809;EC|Ecuador|+593;SV|El Salvador|+503;GQ|Equatorial Guinea|+240;ER|Eritrea|+291;EE|Estonia|+372;SZ|Eswatini|+268;ET|Ethiopia|+251;FJ|Fiji|+679;GA|Gabon|+241;GM|Gambia|+220;GE|Georgia|+995;GH|Ghana|+233;GT|Guatemala|+502;GN|Guinea|+224;GY|Guyana|+592;HT|Haiti|+509;HN|Honduras|+504;HK|Hong Kong|+852;HU|Hungary|+36;IS|Iceland|+354;IQ|Iraq|+964;IR|Iran|+98;JM|Jamaica|+1876;JO|Jordan|+962;KZ|Kazakhstan|+7;KE|Kenya|+254;KW|Kuwait|+965;KG|Kyrgyzstan|+996;LA|Laos|+856;LV|Latvia|+371;LB|Lebanon|+961;LS|Lesotho|+266;LR|Liberia|+231;LY|Libya|+218;LI|Liechtenstein|+423;LT|Lithuania|+370;LU|Luxembourg|+352;MO|Macao|+853;MG|Madagascar|+261;MW|Malawi|+265;MV|Maldives|+960;ML|Mali|+223;MT|Malta|+356;MR|Mauritania|+222;MU|Mauritius|+230;MD|Moldova|+373;MC|Monaco|+377;MN|Mongolia|+976;ME|Montenegro|+382;MA|Morocco|+212;MZ|Mozambique|+258;MM|Myanmar|+95;NA|Namibia|+264;NP|Nepal|+977;NI|Nicaragua|+505;NE|Niger|+227;MK|North Macedonia|+389;OM|Oman|+968;PA|Panama|+507;PG|Papua New Guinea|+675;PY|Paraguay|+595;PE|Peru|+51;PS|Palestine|+970;PR|Puerto Rico|+1787;QA|Qatar|+974;RO|Romania|+40;RW|Rwanda|+250;SN|Senegal|+221;RS|Serbia|+381;SL|Sierra Leone|+232;SK|Slovakia|+421;SI|Slovenia|+386;SO|Somalia|+252;LK|Sri Lanka|+94;SD|Sudan|+249;SR|Suriname|+597;SY|Syria|+963;TW|Taiwan|+886;TJ|Tajikistan|+992;TZ|Tanzania|+255;TG|Togo|+228;TT|Trinidad and Tobago|+1868;TN|Tunisia|+216;TM|Turkmenistan|+993;UG|Uganda|+256;UA|Ukraine|+380;UY|Uruguay|+598;UZ|Uzbekistan|+998;VE|Venezuela|+58;YE|Yemen|+967;ZM|Zambia|+260;ZW|Zimbabwe|+263').split(';').map(x => x.split('|'))
  .filter(([c]) => !COUNTRIES.some(k => k.code === c))
  .map(([code, name, dial]) => ({ code, name, dial, flag: flagEmoji(code) }))
  .sort((a, b) => a.name.localeCompare(b.name)))

/* Picks the country for a phone control.
   - With no options (Book tab, forms): best offline guess from the browser, then an IP lookup refines it.
   - With options (the Phone question type's settings): `defaultCode` is used as is, and the IP lookup runs
     ONLY when `ip` is true; `allowed` limits the countries on offer. The lookup times out fast and falls back
     silently — this may run in a sandboxed/offline environment. */
export function useDetectedCountry(opts = {}) {
  const { defaultCode, ip = true, allowed } = opts
  const allowedKey = (allowed || []).join(',')
  const pool = allowed?.length ? COUNTRIES.filter(c => allowed.includes(c.code)) : COUNTRIES
  const [country, setCountry] = useState(() => {
    if (defaultCode) return pool.find(c => c.code === defaultCode) || pool[0] || COUNTRIES.find(c => c.code === 'US')
    const TZ_COUNTRY = { 'Asia/Kolkata': 'IN', 'Asia/Calcutta': 'IN', 'Asia/Dubai': 'AE', 'Asia/Karachi': 'PK', 'Asia/Dhaka': 'BD', 'Asia/Singapore': 'SG', 'Asia/Tokyo': 'JP', 'Asia/Seoul': 'KR', 'Asia/Manila': 'PH', 'Asia/Jakarta': 'ID', 'Asia/Bangkok': 'TH', 'Asia/Riyadh': 'SA', 'Europe/London': 'GB', 'Europe/Berlin': 'DE', 'Europe/Paris': 'FR', 'Australia/Sydney': 'AU', 'Australia/Melbourne': 'AU', 'America/Toronto': 'CA', 'America/Sao_Paulo': 'BR', 'Africa/Lagos': 'NG', 'Africa/Johannesburg': 'ZA' }
    let guess
    try { guess = TZ_COUNTRY[Intl.DateTimeFormat().resolvedOptions().timeZone] } catch { /* no Intl */ }
    if (!guess) { try { guess = (navigator.language || '').split('-')[1]?.toUpperCase() } catch { /* no navigator */ } }
    return pool.find(c => c.code === guess) || pool.find(c => c.code === 'US') || pool[0]
  })
  const [status, setStatus] = useState(ip ? 'detecting' : 'fallback') // detecting | detected | fallback

  // The merchant changed the default / the allowed list: follow it (and never sit on a country that was removed).
  useEffect(() => {
    if (!defaultCode && !allowedKey) return
    setCountry(cur => {
      if (defaultCode && pool.some(c => c.code === defaultCode) && !ip) return pool.find(c => c.code === defaultCode)
      return pool.some(c => c.code === cur?.code) ? cur : (pool.find(c => c.code === defaultCode) || pool[0] || cur)
    })
  }, [defaultCode, allowedKey, ip]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!ip) { setStatus('fallback'); return }
    let cancelled = false
    const ctrl = new AbortController()
    const timer = setTimeout(() => ctrl.abort(), 2500)
    fetch('https://ipapi.co/json/', { signal: ctrl.signal })
      .then(r => r.ok ? r.json() : Promise.reject(new Error('bad status')))
      .then(data => {
        if (cancelled) return
        const iso = (data && data.country_code) ? String(data.country_code).toUpperCase() : null
        const match = iso && pool.find(c => c.code === iso)
        if (match) { setCountry(match); setStatus('detected') }
        else setStatus('fallback')
      })
      .catch(() => { if (!cancelled) setStatus('fallback') })
      .finally(() => clearTimeout(timer))
    return () => { cancelled = true; clearTimeout(timer) }
  }, [ip]) // eslint-disable-line react-hooks/exhaustive-deps
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
function EmailAnswer({ accent, dark, onSubmit, data = {} }) {
  const [val, setVal] = useState('')
  const companyOnly = data.companyEmailOnly === true
  const touched = val.length > 2
  const formatOk = EMAIL_RE.test(val)
  const personal = companyOnly && formatOk && isFreeEmail(val)     // a real address, but not a company one
  const valid = formatOk && !personal
  const submit = () => { if (valid) onSubmit?.(val.trim()) }
  return (
    <div className="w-full">
      <ComposerPill dark={dark} accent={accent}>
        <input autoFocus type="email" value={val} onChange={e => setVal(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && submit()}
          placeholder={companyOnly ? 'you@company.com' : 'you@example.com'}
          className={clsx('flex-1 bg-transparent outline-none min-w-0 px-1 py-1.5 text-[12px]', dark ? 'text-slate-100 placeholder-slate-500' : 'text-slate-800 placeholder-slate-400')}
          style={{ color: touched && !valid ? '#ef4444' : undefined }}/>
        {touched && (
          <span className="flex-shrink-0 flex items-center justify-center wc-ac-pop" style={{ width: 18, height: 18, marginBottom: 6 }}>
            {valid ? <Check size={14} color="#10b981" strokeWidth={3}/> : <X size={14} color="#ef4444" strokeWidth={3}/>}
          </span>
        )}
        <SendBtn accent={accent} onClick={submit} disabled={!valid}/>
      </ComposerPill>
      {personal && <p className="text-[10px] mt-1 px-3 leading-snug" style={{ color: '#ef4444' }}>{COMPANY_EMAIL_MESSAGE}</p>}
    </div>
  )
}

export function CountryDialPicker({ country, setCountry, dark, dropDirection = 'up', countries = COUNTRIES }) {
  const [open, setOpen] = useState(false)
  const [q, setQ] = useState('')
  const ref = useRef(null)
  useEffect(() => {
    function onDoc(e) { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [])
  const filtered = countries.filter(c => !q.trim() || c.name.toLowerCase().includes(q.toLowerCase()) || c.dial.includes(q))
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
function PhoneAnswer({ accent, dark, onSubmit, data = {} }) {
  const [val, setVal] = useState('')
  /* Settings from the flow builder: which countries are offered, the default one, and whether the
     visitor's country is taken from their IP address (off unless switched on). */
  const allowed = Array.isArray(data.allowedCountries) && data.allowedCountries.length ? data.allowedCountries : null
  const offered = allowed ? COUNTRIES.filter(c => allowed.includes(c.code)) : COUNTRIES
  const [country, setCountry] = useDetectedCountry({ defaultCode: data.defaultCountry || 'IN', ip: data.ipDetect === true, allowed })
  const submit = () => { if (val.trim()) onSubmit?.(`${country.dial} ${val.trim()}`) }
  return (
    <ComposerPill dark={dark} accent={accent} className="relative">
      <CountryDialPicker country={country} setCountry={setCountry} dark={dark} dropDirection="up" countries={offered}/>
      <input autoFocus type="tel" value={val} onChange={e => setVal(e.target.value.replace(/[^\d\s-]/g, ''))}
        onKeyDown={e => e.key === 'Enter' && submit()}
        placeholder="Phone number"
        className={clsx('flex-1 bg-transparent outline-none min-w-0 px-1 py-1.5 text-[12px]', dark ? 'text-slate-100 placeholder-slate-500' : 'text-slate-800 placeholder-slate-400')}/>
      <SendBtn accent={accent} onClick={submit} disabled={!val.trim()}/>
    </ComposerPill>
  )
}

/* ── single / multi choice — FOUR selectable UI styles, picked per-node from
   the flow builder's edit-question popup (`data.choiceStyle`, default
   'list'). One shared renderer (`ChoiceOptions`) so single-select
   (auto-submits on pick) and multi-select (submits via a Done button) stay
   visually identical for whichever style is chosen — the two question types
   differ in selection behavior, not in layout options. ────────────────────
   - list:  WhatsApp/Telegram-style grouped card with divided rows — the
            original design here, kept as the default.
   - cards: the same row content, but each option is its own separate
            tappable card — more presence per option, better for longer or
            more important-feeling choices.
   - pills: compact wrapping chip row — best for many short options (tags,
            categories) where a full-width list wastes space.
   - grid:    2-column tiles — best for 4+ short options that benefit from
              being scannable as a block rather than a long vertical list.
   - buttons: solid stacked buttons — a menu of actions rather than a form
              field (matches a Quick Replies / Main Menu look), for when the
              options ARE the point of the message.
   - outline: outlined pills, accent-colored even at rest — the other
              common "menu of buttons" look (courier-app style quick
              actions).

   No internal scrolling and no text truncation anywhere here — every
   option's full text is always visible, and the container simply grows to
   fit however many options and however long their labels are. An earlier
   version capped the list at 260px with overflow-y-auto and ellipsised long
   labels; that hid content instead of showing it, which is exactly what
   this whole control exists to avoid doing.

   `direction` ('vertical' | 'horizontal', per CHOICE_DIRECTIONS below) sets
   whether options stack one-per-row (full width) or flow side by side and
   wrap — meaningful for every style except 'list', whose grouped-card-of-
   rows shape has no horizontal equivalent. Each style has its own natural
   default (CHOICE_DEFAULT_DIRECTION) rather than one global default, so choosing
   no direction still renders each style the way its name implies.

   `inline: true` (buttons, outline) marks a style that answers attached
   under its OWN question bubble instead of the fixed composer slot — see
   isInlineAskAwaiting in WebChatFlowBuilder.jsx, which is what actually
   reads this flag. Kept on the style's own catalog entry rather than a
   separate list so the two can never drift out of sync with each other. ── */
// 20 options, not 3 — the realistic case a real option list looks like.
// Deliberately mixed lengths (2 chars to a full sentence) rather than
// uniform "Option A" text — a merchant's real option list is never uniform,
// and a style whose layout only holds up for short, evenly-sized labels
// isn't actually usable.
const OPTION_LETTERS = Array.from({ length: 26 }, (_, i) => String.fromCharCode(65 + i))
const OPTIONS = [
  'Yes', 'No', 'Maybe later',
  'Basic', 'Pro', 'Enterprise',
  'Free Shipping', 'International Delivery', 'Same-Day Dispatch',
  '24/7 Customer Support', 'Extended Warranty Coverage',
  'I already have an account with you',
  'Send me a text message instead of email',
  'North America', 'European Union', 'Asia Pacific',
  'None of the above, something else entirely',
  'A', 'Option with a genuinely very long label that keeps going and going',
  'Standard (5-7 business days)',
]
export const CHOICE_STYLES = [
  { id: 'list',    label: 'List',    icon: List,       desc: 'Grouped rows, one card' },
  { id: 'cards',   label: 'Cards',   icon: Layers,     desc: 'Separate tappable cards' },
  { id: 'pills',   label: 'Pills',   icon: Tags,       desc: 'Compact wrapping chips' },
  { id: 'grid',    label: 'Grid',    icon: LayoutGrid, desc: '2-column tiles' },
  { id: 'buttons', label: 'Buttons', icon: AlignJustify, desc: 'Stacked buttons under the message', inline: true },
  { id: 'outline', label: 'Outline', icon: Grid2x2,    desc: 'Outlined pills under the message', inline: true },
]
export const CHOICE_DIRECTIONS = [
  { id: 'vertical',   label: 'Vertical',   icon: AlignJustify, desc: 'One option per row' },
  { id: 'horizontal', label: 'Horizontal', icon: Grid2x2,      desc: 'Side by side, wraps as needed' },
]
// Each style's own natural layout — 'list' has no entry since it doesn't
// support a direction toggle at all (see ChoiceStyleEditor).
export const CHOICE_DEFAULT_DIRECTION = { cards: 'vertical', pills: 'horizontal', grid: 'horizontal', buttons: 'vertical', outline: 'horizontal' }

function ChoiceBadge({ letter, selected, accent, dark, shape }) {
  return (
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
  )
}
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
      <ChoiceBadge letter={letter} selected={selected} accent={accent} dark={dark} shape={shape}/>
      <span className="flex-1 text-[12.5px] font-semibold leading-snug" style={{ color: selected ? accent : (dark ? '#e2e8f0' : '#334155') }}>{label}</span>
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
/* 'cards' style — the same row content as ChoiceRow, as its own card.
   `full` (direction === 'vertical', the default) stretches it to the full
   row width; horizontal direction lets it size to its own content instead,
   so cards flow side by side and wrap. */
function ChoiceTile({ letter, label, selected, accent, dark, onClick, shape = 'radio', full = true }) {
  return (
    <button onClick={onClick} type="button"
      className={clsx('flex items-center gap-3 px-3.5 py-3 rounded-2xl text-left transition-all active:scale-[0.98]', full ? 'w-full' : 'flex-shrink-0 max-w-full')}
      style={{
        background: selected ? `${accent}12` : (dark ? '#0b1526' : '#fff'),
        border: `1.5px solid ${selected ? accent : (dark ? '#1e293b' : '#eef1f6')}`,
        boxShadow: selected ? `0 6px 16px -10px ${accent}99` : (dark ? 'none' : '0 4px 14px -10px rgba(15,23,42,0.12)'),
      }}>
      <ChoiceBadge letter={letter} selected={selected} accent={accent} dark={dark} shape={shape}/>
      <span className={clsx('text-[12.5px] font-semibold leading-snug', full && 'flex-1')} style={{ color: selected ? accent : (dark ? '#e2e8f0' : '#334155') }}>{label}</span>
    </button>
  )
}
/* 'pills' style — compact chips, no letter badge (too tight). No truncation
   and no fixed max-width: a long label wraps onto a second line within its
   own chip instead of being cut off — the chip's box grows to fit its full
   text rather than hiding any of it. `full` (direction === 'vertical')
   stretches each pill to the row's full width and centres its text, for a
   vertical stack of pill-shaped buttons instead of a wrapping chip row. */
function ChoicePill({ label, selected, accent, dark, onClick, full = false }) {
  return (
    <button onClick={onClick} type="button"
      className={clsx('px-3.5 py-2 rounded-full text-[11.5px] font-bold leading-snug transition-all active:scale-[0.96]', full ? 'w-full text-center' : 'max-w-full')}
      style={{
        background: selected ? accent : (dark ? '#111c30' : '#f1f5f9'),
        color: selected ? '#fff' : (dark ? '#cbd5e1' : '#475569'),
        border: `1.5px solid ${selected ? accent : (dark ? '#22304a' : '#e2e8f0')}`,
        boxShadow: selected ? `0 4px 12px -6px ${accent}99` : 'none',
      }}>
      {label}
    </button>
  )
}
/* 'grid' style — 2-column tiles, badge above label so short text stays centred */
function ChoiceGridTile({ letter, label, selected, accent, dark, onClick, shape = 'radio' }) {
  return (
    <button onClick={onClick} type="button"
      className="flex flex-col items-center justify-center gap-1.5 px-2 py-3.5 rounded-2xl text-center transition-all active:scale-[0.97]"
      style={{
        background: selected ? `${accent}12` : (dark ? '#0b1526' : '#fff'),
        border: `1.5px solid ${selected ? accent : (dark ? '#1e293b' : '#eef1f6')}`,
        boxShadow: selected ? `0 6px 16px -10px ${accent}99` : (dark ? 'none' : '0 4px 14px -10px rgba(15,23,42,0.12)'),
      }}>
      <ChoiceBadge letter={letter} selected={selected} accent={accent} dark={dark} shape={shape}/>
      <span className="text-[11.5px] font-semibold leading-snug" style={{ color: selected ? accent : (dark ? '#e2e8f0' : '#334155') }}>{label}</span>
    </button>
  )
}
/* 'buttons' style — solid stacked buttons, matching a merchant's own Quick
   Replies / Main Menu look rather than a form control: every option reads
   at full visual weight, not just the selected one. Selection (multi mode)
   shows as a check + a white ring rather than a color change, since there's
   no "unselected" tint to fall back to on an already-solid button. `full`
   (direction === 'vertical', the default) spans the full row; horizontal
   sizes to content and wraps. */
function ChoiceButton({ label, selected, accent, dark, onClick, full = true }) {
  return (
    <button onClick={onClick} type="button"
      className={clsx('flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-full text-[11px] font-bold text-white text-center leading-snug transition-all active:scale-[0.98]', full ? 'w-full' : 'flex-shrink-0 max-w-full')}
      style={{
        background: accent,
        boxShadow: selected
          ? `0 0 0 2px ${dark ? '#0b1526' : '#fff'}, 0 0 0 4px ${accent}, 0 6px 16px -6px ${accent}b3`
          : `0 5px 14px -6px ${accent}99`,
      }}>
      {selected && <Check size={13} strokeWidth={3} className="wc-ac-pop flex-shrink-0"/>}
      <span>{label}</span>
    </button>
  )
}
/* 'outline' style — outlined pills, accent-colored even at rest (no gray
   "unselected" state) — the other common quick-action-menu look, e.g. a
   courier app's "Courier Booking / Track Shipment / …" buttons. Direction
   is handled by the grid's own column count (see ChoiceOptions), not a
   `full` prop here — a CSS grid cell already stretches its item to the
   column's width by default. */
function ChoiceOutlinePill({ label, selected, accent, dark, onClick }) {
  return (
    <button onClick={onClick} type="button"
      className="flex items-center justify-center gap-1 px-2.5 py-1.5 rounded-full text-[10.5px] font-bold text-center leading-snug transition-all active:scale-[0.96]"
      style={{
        background: selected ? `${accent}14` : (dark ? '#0b1526' : '#fff'),
        color: accent,
        border: `1.5px solid ${selected ? accent : `${accent}80`}`,
      }}>
      {selected && <Check size={12} strokeWidth={3} className="wc-ac-pop flex-shrink-0"/>}
      <span>{label}</span>
    </button>
  )
}

function ChoiceOptions({ options, mode, style, direction, isSelected, onPick, accent, dark }) {
  const shape = mode === 'multi' ? 'check' : 'radio'
  const dir = direction || CHOICE_DEFAULT_DIRECTION[style] || 'vertical'
  const vertical = dir === 'vertical'

  if (style === 'cards') {
    return (
      <div className={clsx('w-full gap-2', vertical ? 'flex flex-col' : 'flex flex-wrap')}>
        {options.map((o, i) => (
          <ChoiceTile key={o} letter={OPTION_LETTERS[i]} label={o} selected={isSelected(o)} shape={shape} full={vertical}
            accent={accent} dark={dark} onClick={() => onPick(o)}/>
        ))}
      </div>
    )
  }
  if (style === 'pills') {
    return (
      <div className={clsx('w-full gap-2', vertical ? 'flex flex-col' : 'flex flex-wrap')}>
        {options.map(o => (
          <ChoicePill key={o} label={o} selected={isSelected(o)} accent={accent} dark={dark} full={vertical} onClick={() => onPick(o)}/>
        ))}
      </div>
    )
  }
  if (style === 'grid') {
    return (
      <div className={clsx('w-full gap-2 grid', vertical ? 'grid-cols-1' : 'grid-cols-2')}>
        {options.map((o, i) => (
          <ChoiceGridTile key={o} letter={OPTION_LETTERS[i]} label={o} selected={isSelected(o)} shape={shape}
            accent={accent} dark={dark} onClick={() => onPick(o)}/>
        ))}
      </div>
    )
  }
  if (style === 'buttons') {
    return (
      <div className={clsx('w-full gap-1.5', vertical ? 'flex flex-col' : 'flex flex-wrap')}>
        {options.map(o => (
          <ChoiceButton key={o} label={o} selected={isSelected(o)} accent={accent} dark={dark} full={vertical} onClick={() => onPick(o)}/>
        ))}
      </div>
    )
  }
  if (style === 'outline') {
    return (
      <div className={clsx('w-full gap-1.5 grid', vertical ? 'grid-cols-1' : 'grid-cols-2')}>
        {options.map(o => (
          <ChoiceOutlinePill key={o} label={o} selected={isSelected(o)} accent={accent} dark={dark} onClick={() => onPick(o)}/>
        ))}
      </div>
    )
  }
  // 'list' — default, no direction toggle (a grouped card of rows has no
  // horizontal equivalent)
  return (
    <ChoiceCard dark={dark}>
      {options.map((o, i) => (
        <ChoiceRow key={o} letter={OPTION_LETTERS[i]} label={o} selected={isSelected(o)} accent={accent} dark={dark}
          shape={shape} last={i === options.length - 1} onClick={() => onPick(o)}/>
      ))}
    </ChoiceCard>
  )
}

function SingleChoiceAnswer({ accent, dark, onSubmit, data = {} }) {
  const [sel, setSel] = useState(null)
  return (
    <ChoiceOptions options={OPTIONS} mode="single" style={data.choiceStyle || 'list'} direction={data.choiceDirection} accent={accent} dark={dark}
      isSelected={o => sel === o} onPick={o => { setSel(o); onSubmit?.(o) }}/>
  )
}
function MultiChoiceAnswer({ accent, dark, onSubmit, data = {} }) {
  const [sel, setSel] = useState([])
  const toggle = o => setSel(p => p.includes(o) ? p.filter(x => x !== o) : [...p, o])
  return (
    <div className="flex flex-col gap-2 w-full">
      <ChoiceOptions options={OPTIONS} mode="multi" style={data.choiceStyle || 'list'} direction={data.choiceDirection} accent={accent} dark={dark}
        isSelected={o => sel.includes(o)} onPick={toggle}/>
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

  const useMyLocation = () => {
    if (!navigator.geolocation) { onSubmit?.('📍 Location unavailable'); return }
    setLocating(true)
    navigator.geolocation.getCurrentPosition(
      async pos => {
        const { latitude: lat, longitude: lng } = pos.coords
        const address = await reverseGeocode(lat, lng)
        setLocating(false)
        /* Pin it instead of sending it. GPS routinely lands a visitor on the
           wrong side of the street or inside the neighbouring building, and a
           location they never saw is one the driver cannot use. They confirm
           — or drag the pin — and then send. */
        setPicked({ address, lat, lng })
        setVal(address || `${lat.toFixed(5)}, ${lng.toFixed(5)}`)
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
        <div className="wc-ac-fade">
          <LocationMap
            lat={picked.lat} lng={picked.lng} address={picked.address}
            apiKey={googleMapsApiKey} accent={accent} dark={dark}
            height={120} interactive
            onMove={({ lat, lng, address }) => {
              setPicked({ lat, lng, address })
              setVal(address || `${lat.toFixed(5)}, ${lng.toFixed(5)}`)
            }}/>
          <p className="text-[9.5px] mt-1 text-center" style={{ color: dark ? '#64748b' : '#94a3b8' }}>
            Drag the pin if it's not quite right
          </p>
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
  { id: 'name', label: 'Name', type: 'text', enabled: true, required: true },
  { id: 'email', label: 'Email', type: 'email', enabled: true, required: true },
  { id: 'phone', label: 'Phone', type: 'phone', enabled: true, required: false },
]

/* The one catalog of field types a form can contain. Exported so the flow
   builder's field editor renders its type picker from this rather than its own
   hardcoded list — the previous editor offered only Text and Dropdown while the
   renderer silently fell back to a plain text input for anything else, which is
   how a "date" field ends up as a free-text box that accepts "next tuesdayish".

   `options` marks the types that need a choice list. */
export const FORM_FIELD_TYPES = [
  { id: 'text',        label: 'Text' },
  { id: 'textarea',    label: 'Long text' },
  { id: 'email',       label: 'Email' },
  { id: 'phone',       label: 'Phone' },
  { id: 'number',      label: 'Number' },
  { id: 'url',         label: 'Website / URL' },
  { id: 'date',        label: 'Date' },
  { id: 'time',        label: 'Time' },
  { id: 'dropdown',    label: 'Dropdown', options: true },
  { id: 'multiselect', label: 'Multi-select', options: true },
  { id: 'radio',       label: 'Single choice', options: true },
  { id: 'checkbox',    label: 'Checkbox / consent' },
  { id: 'location',    label: 'Location' },
]
export const FORM_TYPES_WITH_OPTIONS = new Set(FORM_FIELD_TYPES.filter(t => t.options).map(t => t.id))

function FormField({ label, dark, hint, children }) {
  return (
    <div className="min-w-0">
      <p className="text-[8.5px] font-bold uppercase tracking-wide mb-1" style={{ color: dark ? '#64748b' : '#94a3b8' }}>{label}</p>
      {children}
      {hint && <p className="text-[8.5px] mt-0.5" style={{ color: dark ? '#64748b' : '#94a3b8' }}>{hint}</p>}
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

/* Chips rather than a native <select multiple>. A native multi-select needs
   ctrl/cmd-click on desktop and renders as a cramped scroll box on phones,
   where most of these forms are actually filled in — tapping chips is the only
   version that works on a touch screen without instructions. */
function FormMultiSelectField({ label, dark, accent, options, onChange }) {
  const [picked, setPicked] = useState([])
  useEffect(() => { onChange(picked.join(', ')) }, [picked]) // eslint-disable-line react-hooks/exhaustive-deps
  const toggle = o => setPicked(p => p.includes(o) ? p.filter(x => x !== o) : [...p, o])
  return (
    <FormField label={label} dark={dark} hint={picked.length ? `${picked.length} selected` : 'Tap to select one or more'}>
      <div className="flex flex-wrap gap-1">
        {options.map(o => {
          const on = picked.includes(o)
          return (
            <button key={o} type="button" onClick={() => toggle(o)}
              className="px-2 py-1 rounded-full text-[10.5px] font-semibold transition-colors"
              style={{
                background: on ? accent : (dark ? '#111c30' : '#f4f6f9'),
                color: on ? '#fff' : (dark ? '#94a3b8' : '#475569'),
                border: `1.5px solid ${on ? accent : (dark ? '#22304a' : '#e3e8f0')}`,
              }}>
              {on && <Check size={9} className="inline mr-0.5 -mt-px"/>}{o}
            </button>
          )
        })}
      </div>
    </FormField>
  )
}

function FormRadioField({ label, dark, accent, options, onChange }) {
  const [val, setVal] = useState('')
  useEffect(() => { onChange(val) }, [val]) // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <FormField label={label} dark={dark}>
      <div className="flex flex-wrap gap-1">
        {options.map(o => {
          const on = val === o
          return (
            <button key={o} type="button" onClick={() => setVal(o)}
              className="px-2 py-1 rounded-full text-[10.5px] font-semibold transition-colors"
              style={{
                background: on ? accent : (dark ? '#111c30' : '#f4f6f9'),
                color: on ? '#fff' : (dark ? '#94a3b8' : '#475569'),
                border: `1.5px solid ${on ? accent : (dark ? '#22304a' : '#e3e8f0')}`,
              }}>
              {o}
            </button>
          )
        })}
      </div>
    </FormField>
  )
}

/* A single tick — consent, terms, "keep me updated". Its value is the label
   itself rather than "true", so the captured answer in the Inbox reads as the
   thing that was agreed to instead of a bare boolean nobody can interpret
   later. */
function FormCheckboxField({ label, dark, accent, text, onChange }) {
  const [on, setOn] = useState(false)
  useEffect(() => { onChange(on ? (text || label) : '') }, [on]) // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <button type="button" onClick={() => setOn(v => !v)} className="w-full flex items-start gap-2 text-left">
      <span className="w-4 h-4 rounded flex items-center justify-center flex-shrink-0 mt-px transition-colors"
        style={{ background: on ? accent : 'transparent', border: `1.5px solid ${on ? accent : (dark ? '#22304a' : '#cbd5e1')}` }}>
        {on && <Check size={11} className="text-white"/>}
      </span>
      <span className="text-[10.5px] leading-snug" style={{ color: dark ? '#cbd5e1' : '#475569' }}>{text || label}</span>
    </button>
  )
}

/* Address plus an optional pin. Deliberately lighter than the standalone Ask
   Location control: inside a form this is one row among several, so it opens as
   a plain address box and only grows a map once the visitor actually uses
   "locate me" — a form that renders three maps on mount is unusable on a
   phone. */
function FormLocationField({ label, dark, accent, fieldStyle, apiKey, onChange }) {
  const [text, setText] = useState('')
  const [pin, setPin] = useState(null)
  const [locating, setLocating] = useState(false)

  useEffect(() => { onChange(pin?.address || text) }, [text, pin]) // eslint-disable-line react-hooks/exhaustive-deps

  const locate = () => {
    if (!navigator.geolocation) return
    setLocating(true)
    navigator.geolocation.getCurrentPosition(
      async pos => {
        const { latitude: lat, longitude: lng } = pos.coords
        const address = await reverseGeocode(lat, lng)
        setLocating(false)
        setPin({ lat, lng, address })
        setText(address || `${lat.toFixed(5)}, ${lng.toFixed(5)}`)
      },
      () => setLocating(false),
      { timeout: 5000 },
    )
  }

  return (
    <FormField label={label} dark={dark}>
      <div className="flex items-center gap-1 rounded-lg px-2 py-1" style={fieldStyle}>
        <input value={text} onChange={e => { setText(e.target.value); if (pin) setPin(null) }}
          placeholder="Street, area, city"
          className={clsx('flex-1 min-w-0 bg-transparent outline-none text-[11.5px] px-0.5 py-1', dark ? 'text-slate-100 placeholder-slate-500' : 'text-slate-800 placeholder-slate-400')}/>
        <button type="button" onClick={locate} title="Use my current location"
          className="flex-shrink-0 p-1 rounded-md" style={{ color: accent }}>
          <LocateFixed size={13} className={locating ? 'animate-pulse' : ''}/>
        </button>
      </div>
      {pin && (
        <div className="mt-1.5">
          <LocationMap lat={pin.lat} lng={pin.lng} address={pin.address}
            apiKey={apiKey} accent={accent} dark={dark} height={96} interactive
            onMove={({ lat, lng, address }) => { setPin({ lat, lng, address }); setText(address || `${lat.toFixed(5)}, ${lng.toFixed(5)}`) }}/>
        </div>
      )}
    </FormField>
  )
}

function FormAnswer({ accent, dark, onSubmit, formFields, googleMapsApiKey }) {
  const fields = (formFields && formFields.length ? formFields : DEFAULT_FORM_FIELDS).filter(f => f.enabled !== false)
  const [values, setValues] = useState({})
  const setField = (id, v) => setValues(p => ({ ...p, [id]: v }))
  const fieldStyle = { background: dark ? '#111c30' : '#f4f6f9', border: `1.5px solid ${dark ? '#22304a' : '#e3e8f0'}`, color: dark ? '#e2e8f0' : '#1e293b' }

  /* Required-ness comes from the field's own flag, not from its id. It used to
     be a hardcoded set of {name, email}, so a merchant's own required field was
     never enforced and any field they happened to call "email" silently became
     mandatory. */
  const complete = fields.filter(f => f.required).every(f => String(values[f.id] || '').trim())

  const submit = () => {
    /* Labelled pairs, not bare values joined by a dot. A six-field form
       submitted as "Arjun · yes · 3 · Bengaluru" is unreadable in the Inbox,
       and the agent reading it has no way to recover which answer was which. */
    const summary = fields
      .map(f => [f.label, String(values[f.id] || '').trim()])
      .filter(([, v]) => v)
      .map(([label, v]) => `${label}: ${v}`)
      .join('\n')
    onSubmit?.(summary || '(empty form)')
  }

  return (
    <div className="w-full rounded-2xl p-3 space-y-2" style={{ background: dark ? '#0b1424' : '#fff', border: `1.5px solid ${dark ? '#22304a' : '#e3e8f0'}` }}>
      {fields.map(f => {
        const opts = f.options || []
        const common = { key: f.id, label: f.label, dark, accent, fieldStyle, onChange: v => setField(f.id, v) }
        switch (f.type) {
          case 'phone':       return <FormPhoneField {...common}/>
          case 'dropdown':    return <FormDropdownField {...common} options={opts}/>
          case 'multiselect': return <FormMultiSelectField {...common} options={opts}/>
          case 'radio':       return <FormRadioField {...common} options={opts}/>
          case 'checkbox':    return <FormCheckboxField {...common} text={f.text}/>
          case 'location':    return <FormLocationField {...common} apiKey={googleMapsApiKey}/>
          case 'textarea':
            return (
              <FormField key={f.id} label={f.label} dark={dark}>
                <textarea value={values[f.id] || ''} onChange={e => setField(f.id, e.target.value)}
                  rows={3} placeholder={f.placeholder || f.label}
                  className="w-full rounded-lg px-2.5 py-1.5 text-[11.5px] outline-none resize-none" style={fieldStyle}/>
              </FormField>
            )
          default: {
            /* Native input types do real work here: `number` brings up a
               numeric keypad on a phone, `date`/`time` open the OS pickers,
               and `url`/`email` get free format validation. Rendering all of
               them as type="text" — which is what happened before — throws all
               of that away. */
            const nativeType =
                f.type === 'number' ? 'number'
              : f.type === 'date'   ? 'date'
              : f.type === 'time'   ? 'time'
              : f.type === 'url'    ? 'url'
              : f.type === 'email'  ? 'email'
              : 'text'
            const placeholder =
                f.type === 'email' ? 'you@example.com'
              : f.type === 'url'   ? 'https://example.com'
              : f.placeholder || f.label
            return (
              <FormField key={f.id} label={f.label} dark={dark}>
                <input value={values[f.id] || ''} onChange={e => setField(f.id, e.target.value)}
                  type={nativeType} placeholder={placeholder}
                  min={f.min !== '' && f.min != null ? f.min : undefined}
                  max={f.max !== '' && f.max != null ? f.max : undefined}
                  inputMode={f.type === 'number' ? 'decimal' : undefined}
                  className="w-full rounded-lg px-2.5 py-1.5 text-[11.5px] outline-none" style={fieldStyle}/>
              </FormField>
            )
          }
        }
      })}
      <button disabled={!complete} onClick={submit}
        className="w-full py-2 rounded-lg text-[11px] font-bold transition-opacity"
        style={{ background: accent, color: '#fff', opacity: complete ? 1 : 0.4 }}>
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
/* ── statement: the bot says something and waits for acknowledgement ──────
   Not a question at all, which is exactly why it earns a type: disclaimers,
   handover notices and "here is what happens next" currently have to be faked
   with a Short Text nobody is meant to fill in, or a Send Message that races
   past before it is read. This one stops and waits. */
function StatementAnswer({ accent, dark, onSubmit, data = {} }) {
  const label = data.continueLabel || 'Continue'
  return (
    <div className="w-full space-y-1.5">
      {data.statementText && (
        <div className="rounded-xl px-3 py-2.5 text-[11.5px] leading-relaxed"
          style={{ background: dark ? '#111c30' : '#f4f6f9', border: `1.5px solid ${dark ? '#22304a' : '#e3e8f0'}`, color: dark ? '#cbd5e1' : '#475569' }}>
          {data.statementText}
        </div>
      )}
      <button type="button" onClick={() => onSubmit?.(label)}
        className="w-full py-2 rounded-xl text-[11.5px] font-bold text-white" style={{ background: accent }}>
        {label}
      </button>
    </div>
  )
}

/* ── faq: browse the answers instead of asking for them ──────────────────
   Answers open inline rather than being sent as chat messages. A visitor
   checking three questions would otherwise bury their own conversation under
   six bubbles, and the thing they wanted to compare scrolls away. */
const FALLBACK_FAQS = [
  { id: 'f1', q: 'What are your opening hours?', a: 'We are open Monday to Saturday, 9am to 7pm.' },
  { id: 'f2', q: 'How long does delivery take?', a: 'Most orders arrive within 2–3 working days.' },
  { id: 'f3', q: 'What is your refund policy?', a: 'Returns are accepted within 30 days, unused and in original packaging.' },
]
function FaqAnswer({ accent, dark, onSubmit, data = {} }) {
  const items = (data.faqItems && data.faqItems.length ? data.faqItems : FALLBACK_FAQS)
  const [openId, setOpenId] = useState(null)
  const [viewed, setViewed] = useState([])
  const surface = { background: dark ? '#111c30' : '#f4f6f9', border: `1.5px solid ${dark ? '#22304a' : '#e3e8f0'}` }

  const open = item => {
    setOpenId(o => (o === item.id ? null : item.id))
    setViewed(v => (v.includes(item.q) ? v : [...v, item.q]))
  }

  return (
    <div className="w-full space-y-1.5">
      <div className="space-y-1 max-h-52 overflow-y-auto wc-scroll">
        {items.map(item => {
          const isOpen = openId === item.id
          return (
            <div key={item.id} className="rounded-xl overflow-hidden" style={surface}>
              <button type="button" onClick={() => open(item)}
                className="w-full flex items-start gap-2 px-2.5 py-2 text-left">
                <HelpCircle size={12} style={{ color: accent, flexShrink: 0, marginTop: 1 }}/>
                <span className="flex-1 text-[11.5px] font-semibold leading-snug" style={{ color: dark ? '#e2e8f0' : '#1e293b' }}>{item.q}</span>
                <ChevronDown size={12} className={clsx('flex-shrink-0 transition-transform', isOpen && 'rotate-180')}
                  style={{ color: dark ? '#64748b' : '#94a3b8', marginTop: 1 }}/>
              </button>
              {isOpen && (
                <p className="px-2.5 pb-2.5 -mt-0.5 text-[11px] leading-relaxed wc-ac-fade" style={{ color: dark ? '#94a3b8' : '#64748b' }}>
                  {item.a}
                </p>
              )}
            </div>
          )
        })}
      </div>
      <button type="button"
        onClick={() => onSubmit?.(viewed.length ? `Read: ${viewed.join(' · ')}` : (data.skipLabel || 'None of these'))}
        className="w-full py-2 rounded-xl text-[11.5px] font-bold text-white" style={{ background: accent }}>
        {viewed.length ? (data.doneLabel || 'That answers it') : (data.skipLabel || 'None of these — talk to someone')}
      </button>
    </div>
  )
}

/* ── ai answer: ask anything, answered from the knowledge base ────────────
   The control owns the whole ask→answer→ask-again loop rather than sending
   each question into the flow, because an AI Q&A turn is one step from the
   flow's point of view however many questions the visitor asks inside it.

   There is no AI backend in this repo, so the answer shown comes from the
   node's own `sampleAnswer`/`fallback`. That is deliberately visible in the
   editor rather than hidden behind a fake spinner pretending to reason. */
function AiAnswerAnswer({ accent, dark, onSubmit, data = {} }) {
  const [q, setQ] = useState('')
  const [asked, setAsked] = useState(null)
  const [thinking, setThinking] = useState(false)
  const answer = data.sampleAnswer || data.fallback
    || "I don't have that in my knowledge base yet — let me pass you to someone who can help."

  const ask = () => {
    const value = q.trim()
    if (!value) return
    setAsked(value)
    setQ('')
    setThinking(true)
    setTimeout(() => setThinking(false), 700)
  }

  return (
    <div className="w-full space-y-1.5">
      {asked && (
        <div className="rounded-xl px-2.5 py-2 wc-ac-fade" style={{ background: dark ? '#111c30' : '#f4f6f9', border: `1.5px solid ${dark ? '#22304a' : '#e3e8f0'}` }}>
          <p className="text-[10px] font-bold mb-1" style={{ color: dark ? '#64748b' : '#94a3b8' }}>You asked</p>
          <p className="text-[11px] mb-2" style={{ color: dark ? '#cbd5e1' : '#475569' }}>{asked}</p>
          {thinking ? (
            <div className="flex items-center gap-1.5">
              {[0, 1, 2].map(i => (
                <span key={i} className="w-1.5 h-1.5 rounded-full" style={{ background: accent, opacity: 0.5, animation: `wcAcDot 1s ${i * 0.15}s infinite ease-in-out` }}/>
              ))}
            </div>
          ) : (
            <>
              <div className="flex items-center gap-1 mb-1">
                <Sparkles size={10} style={{ color: accent }}/>
                <p className="text-[10px] font-bold" style={{ color: accent }}>
                  {data.kbName ? `From ${data.kbName}` : 'Answer'}
                </p>
              </div>
              <p className="text-[11px] leading-relaxed" style={{ color: dark ? '#e2e8f0' : '#1e293b' }}>{answer}</p>
            </>
          )}
        </div>
      )}

      <ComposerPill dark={dark} accent={accent}>
        <Sparkles size={13} className="flex-shrink-0 mb-1.5" style={{ color: dark ? '#64748b' : '#94a3b8' }}/>
        <input autoFocus value={q} onChange={e => setQ(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && ask()}
          placeholder={data.placeholder || 'Ask anything…'}
          className={clsx('flex-1 bg-transparent outline-none min-w-0 px-1 py-1.5 text-[12px]', dark ? 'text-slate-100 placeholder-slate-500' : 'text-slate-800 placeholder-slate-400')}/>
        <SendBtn accent={accent} onClick={ask} disabled={!q.trim()}/>
      </ComposerPill>

      {asked && !thinking && (
        <button type="button" onClick={() => onSubmit?.(asked)}
          className="w-full py-1.5 rounded-xl text-[10.5px] font-bold"
          style={{ background: dark ? '#111c30' : '#f4f6f9', color: accent, border: `1.5px solid ${dark ? '#22304a' : '#e3e8f0'}` }}>
          {data.doneLabel || 'That helps — continue'}
        </button>
      )}
    </div>
  )
}

/* ── consent: an explicit, recorded opt-in ───────────────────────────────
   Distinct from Yes/No because the record has to say WHAT was agreed to. A
   stored "yes" is worthless six months later when someone asks which version
   of the terms the customer accepted, so the submitted value carries the
   wording rather than a bare boolean. */
function ConsentAnswer({ accent, dark, onSubmit, data = {} }) {
  const [ticked, setTicked] = useState(false)
  const text = data.consentText || 'I agree to be contacted about my enquiry.'
  return (
    <div className="w-full space-y-2 rounded-xl p-2.5" style={{ background: dark ? '#0b1424' : '#fff', border: `1.5px solid ${dark ? '#22304a' : '#e3e8f0'}` }}>
      <button type="button" onClick={() => setTicked(v => !v)} className="w-full flex items-start gap-2 text-left">
        <span className="w-4 h-4 rounded flex items-center justify-center flex-shrink-0 mt-px transition-colors"
          style={{ background: ticked ? accent : 'transparent', border: `1.5px solid ${ticked ? accent : (dark ? '#22304a' : '#cbd5e1')}` }}>
          {ticked && <Check size={11} className="text-white"/>}
        </span>
        <span className="text-[11px] leading-snug" style={{ color: dark ? '#cbd5e1' : '#475569' }}>{text}</span>
      </button>

      {data.policyUrl && (
        <a href={data.policyUrl} target="_blank" rel="noreferrer"
          className="inline-flex items-center gap-1 text-[10.5px] font-bold ml-6" style={{ color: accent }}>
          {data.policyLabel || 'Read the full policy'} <ExternalLink size={9}/>
        </a>
      )}

      <div className="flex gap-1.5">
        <button type="button" disabled={!ticked}
          onClick={() => onSubmit?.(`Agreed: ${text}`)}
          className="flex-1 py-2 rounded-xl text-[11.5px] font-bold text-white transition-opacity"
          style={{ background: accent, opacity: ticked ? 1 : 0.4 }}>
          {data.agreeLabel || 'I agree'}
        </button>
        <button type="button" onClick={() => onSubmit?.(data.declineLabel || 'Declined')}
          className="px-3 py-2 rounded-xl text-[11.5px] font-bold"
          style={{ background: dark ? '#111c30' : '#f4f6f9', color: dark ? '#94a3b8' : '#64748b', border: `1.5px solid ${dark ? '#22304a' : '#e3e8f0'}` }}>
          {data.declineLabel || 'Not now'}
        </button>
      </div>
    </div>
  )
}

/* ── verify document: choose a document, upload it, see it checked ────────
   The three states are separated on purpose. Collapsing upload and result
   into one step is what makes identity checks feel like they silently failed:
   the visitor needs to see that something is being examined, and then see the
   verdict, before the conversation moves on.

   The check itself is simulated here — there is no verification provider
   wired up — which the editor says plainly rather than implying a real check
   happened. */
const DEFAULT_DOC_TYPES = ['Passport', 'Driving licence', 'National ID']
function VerifyDocAnswer({ accent, dark, onSubmit, data = {} }) {
  const types = (data.docTypes && data.docTypes.length ? data.docTypes : DEFAULT_DOC_TYPES)
  const [docType, setDocType] = useState(null)
  const [sides, setSides] = useState({})
  const [stage, setStage] = useState('pick') // pick | upload | checking | done
  const needsBack = data.requireBack !== false
  const required = needsBack ? ['front', 'back'] : ['front']
  const ready = required.every(s => sides[s])
  const surface = { background: dark ? '#111c30' : '#f4f6f9', border: `1.5px solid ${dark ? '#22304a' : '#e3e8f0'}` }

  const check = () => {
    setStage('checking')
    setTimeout(() => setStage('done'), 1200)
  }

  if (stage === 'done') {
    return (
      <div className="w-full rounded-xl px-3 py-2.5 flex items-center gap-2 wc-ac-fade"
        style={{ background: `${accent}12`, border: `1.5px solid ${accent}55` }}>
        <BadgeCheck size={16} style={{ color: accent, flexShrink: 0 }}/>
        <div className="flex-1 min-w-0">
          <p className="text-[11.5px] font-bold" style={{ color: dark ? '#e2e8f0' : '#1e293b' }}>{docType} verified</p>
          <p className="text-[10px]" style={{ color: dark ? '#64748b' : '#94a3b8' }}>Document accepted</p>
        </div>
        <button type="button" onClick={() => onSubmit?.(`${docType} verified`)}
          className="px-2.5 py-1.5 rounded-lg text-[10.5px] font-bold text-white flex-shrink-0" style={{ background: accent }}>
          Continue
        </button>
      </div>
    )
  }

  if (stage === 'checking') {
    return (
      <div className="w-full rounded-xl px-3 py-3 flex items-center gap-2" style={surface}>
        {[0, 1, 2].map(i => (
          <span key={i} className="w-1.5 h-1.5 rounded-full" style={{ background: accent, animation: `wcAcDot 1s ${i * 0.15}s infinite ease-in-out` }}/>
        ))}
        <p className="text-[11px] font-semibold ml-1" style={{ color: dark ? '#cbd5e1' : '#475569' }}>Checking your {docType?.toLowerCase()}…</p>
      </div>
    )
  }

  if (stage === 'pick') {
    return (
      <div className="w-full space-y-1">
        <p className="text-[10px] font-bold uppercase tracking-wide px-0.5" style={{ color: dark ? '#64748b' : '#94a3b8' }}>Choose a document</p>
        {types.map(t => (
          <button key={t} type="button" onClick={() => { setDocType(t); setStage('upload') }}
            className="w-full flex items-center gap-2 px-2.5 py-2 rounded-xl text-left" style={surface}>
            <FileText size={13} style={{ color: accent, flexShrink: 0 }}/>
            <span className="flex-1 text-[11.5px] font-semibold" style={{ color: dark ? '#e2e8f0' : '#1e293b' }}>{t}</span>
            <ChevronRight size={12} style={{ color: dark ? '#64748b' : '#94a3b8' }}/>
          </button>
        ))}
      </div>
    )
  }

  return (
    <div className="w-full space-y-1.5">
      <div className="flex items-center gap-1.5 px-0.5">
        <button type="button" onClick={() => { setStage('pick'); setSides({}) }} style={{ color: dark ? '#64748b' : '#94a3b8' }}>
          <ChevronLeft size={13}/>
        </button>
        <p className="text-[11px] font-bold" style={{ color: dark ? '#e2e8f0' : '#1e293b' }}>{docType}</p>
      </div>
      {required.map(side => (
        <label key={side} className="flex items-center gap-2 px-2.5 py-2 rounded-xl cursor-pointer" style={surface}>
          <input type="file" accept="image/*,application/pdf" className="hidden"
            onChange={e => setSides(s => ({ ...s, [side]: e.target.files?.[0]?.name || 'uploaded' }))}/>
          {sides[side]
            ? <Check size={13} style={{ color: accent, flexShrink: 0 }}/>
            : <Upload size={13} style={{ color: dark ? '#64748b' : '#94a3b8', flexShrink: 0 }}/>}
          <span className="flex-1 text-[11px] truncate" style={{ color: sides[side] ? (dark ? '#e2e8f0' : '#1e293b') : (dark ? '#64748b' : '#94a3b8') }}>
            {sides[side] || `Upload the ${side}`}
          </span>
        </label>
      ))}
      <button type="button" disabled={!ready} onClick={check}
        className="w-full py-2 rounded-xl text-[11.5px] font-bold text-white transition-opacity"
        style={{ background: accent, opacity: ready ? 1 : 0.4 }}>
        Verify
      </button>
    </div>
  )
}

/* ── pre-chat form: name, email and phone as ONE question ───────────────
   "Mandatory" is a single switch on the node (data.required, on unless turned
   off). Mandatory: all three are needed and there is no way past it. Optional:
   blanks are fine and there is a Skip button — but whatever IS typed must still
   be valid, so a half-typed email never reaches the Inbox. The answer is
   labelled lines, like the multi-field form, so an agent can tell which is which. */
const PRECHAT_EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/
function PrechatAnswer({ accent, dark, onSubmit, data = {} }) {
  const mandatory = data.required !== false
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [num, setNum] = useState('')
  const [country, setCountry] = useDetectedCountry()
  const [tried, setTried] = useState(false)

  const digits = num.replace(/\D/g, '')
  const problem = {
    name:  name.trim() ? '' : (mandatory ? 'Please enter your name' : ''),
    email: !email.trim() ? (mandatory ? 'Please enter your email' : '') : PRECHAT_EMAIL_RE.test(email.trim()) ? '' : "That email doesn't look right",
    phone: !digits ? (mandatory ? 'Please enter your phone number' : '') : (digits.length < 6 || digits.length > 15) ? "That number doesn't look right" : '',
  }
  const valid = !problem.name && !problem.email && !problem.phone

  const submit = () => {
    setTried(true)
    if (!valid) return
    const lines = [
      name.trim() && `Name: ${name.trim()}`,
      email.trim() && `Email: ${email.trim()}`,
      digits && `Phone: ${country.dial} ${num.trim()}`,
    ].filter(Boolean)
    onSubmit?.(lines.join('\n'))
  }

  const fieldStyle = { background: dark ? '#111c30' : '#f4f6f9', border: `1.5px solid ${dark ? '#22304a' : '#e3e8f0'}`, color: dark ? '#e2e8f0' : '#1e293b' }
  const inputCls = clsx('w-full bg-transparent outline-none text-[11.5px]', dark ? 'text-slate-100 placeholder-slate-500' : 'text-slate-800 placeholder-slate-400')
  const Err = ({ k }) => (tried && problem[k]) ? <p className="text-[9px] mt-0.5 text-red-500">{problem[k]}</p> : null
  const star = mandatory ? ' *' : ''

  return (
    <div className="w-full rounded-2xl p-3 space-y-2" style={{ background: dark ? '#0b1424' : '#fff', border: `1.5px solid ${dark ? '#22304a' : '#e3e8f0'}` }}>
      <FormField label={`Name${star}`} dark={dark}>
        <input value={name} onChange={e => setName(e.target.value)} placeholder="Your name" autoComplete="name"
          className={clsx(inputCls, 'rounded-lg px-2.5 py-1.5')} style={fieldStyle}/>
        <Err k="name"/>
      </FormField>
      <FormField label={`Email${star}`} dark={dark}>
        <input value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" type="email" autoComplete="email"
          className={clsx(inputCls, 'rounded-lg px-2.5 py-1.5')} style={fieldStyle}/>
        <Err k="email"/>
      </FormField>
      <FormField label={`Phone${star}`} dark={dark}>
        <div className="flex items-center gap-1 rounded-lg pl-1 pr-2 py-1" style={fieldStyle}>
          <CountryDialPicker country={country} setCountry={setCountry} dark={dark} dropDirection="down"/>
          <input value={num} onChange={e => setNum(e.target.value.replace(/[^\d\s-]/g, ''))} placeholder="Phone number" type="tel" autoComplete="tel-national"
            className={clsx(inputCls, 'flex-1 min-w-0 px-1 py-1')}/>
        </div>
        <Err k="phone"/>
      </FormField>
      <button type="button" onClick={submit}
        className="w-full py-2 rounded-lg text-[11px] font-bold transition-opacity"
        style={{ background: accent, color: '#fff', opacity: tried && !valid ? 0.6 : 1 }}>
        {data.submitLabel || 'Start chat'}
      </button>
      {!mandatory && (
        <button type="button" onClick={() => onSubmit?.('')}
          className="w-full text-[10.5px] font-semibold py-0.5" style={{ color: dark ? '#94a3b8' : '#64748b' }}>
          {data.skipLabel || 'Skip for now'}
        </button>
      )}
    </div>
  )
}

export function AnswerControl({ questionType, accent = '#0066ff', dark = false, onSubmit, interactive = true, formFields, otpConfig, googleMapsApiKey, nodeData }) {
  useAnswerControlStyles()
  const submit = interactive ? onSubmit : undefined

  switch (questionType) {
    case 'short': case 'number': case 'url':
      return <FreeTextAnswer questionType={questionType} accent={accent} dark={dark} onSubmit={submit}/>
    case 'long':
      return <FreeTextAnswer questionType="long" accent={accent} dark={dark} onSubmit={submit}/>
    case 'email':
      return <EmailAnswer accent={accent} dark={dark} onSubmit={submit} data={nodeData}/>
    case 'phone':
      return <PhoneAnswer accent={accent} dark={dark} onSubmit={submit} data={nodeData}/>
    case 'single':
      return <SingleChoiceAnswer accent={accent} dark={dark} onSubmit={submit} data={nodeData}/>
    case 'multi':
      return <MultiChoiceAnswer accent={accent} dark={dark} onSubmit={submit} data={nodeData}/>
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
    case 'statement':
      return <StatementAnswer accent={accent} dark={dark} onSubmit={submit} data={nodeData}/>
    case 'faq':
      return <FaqAnswer accent={accent} dark={dark} onSubmit={submit} data={nodeData}/>
    case 'ai_answer':
      return <AiAnswerAnswer accent={accent} dark={dark} onSubmit={submit} data={nodeData}/>
    case 'prechat':
      return <PrechatAnswer accent={accent} dark={dark} onSubmit={submit} data={nodeData}/>
    case 'consent':
      return <ConsentAnswer accent={accent} dark={dark} onSubmit={submit} data={nodeData}/>
    case 'verify_doc':
      return <VerifyDocAnswer accent={accent} dark={dark} onSubmit={submit} data={nodeData}/>
    case 'shipment_booking':
      return <ShipmentBookingAnswer accent={accent} dark={dark} onSubmit={submit} data={nodeData} googleMapsApiKey={googleMapsApiKey}/>
    case 'shipment_calculation':
      return <ShipmentCalculationAnswer accent={accent} dark={dark} onSubmit={submit} data={nodeData} googleMapsApiKey={googleMapsApiKey}/>
    case 'form':
      return <FormAnswer accent={accent} dark={dark} onSubmit={submit} formFields={formFields} googleMapsApiKey={googleMapsApiKey}/>
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
