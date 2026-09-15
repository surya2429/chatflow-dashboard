// PoweredByDemoModal.jsx — the lead-capture step behind the widget's
// "Powered by ChatFlow" strip. A visitor who notices the branding is a
// visitor who might want this chatbot themselves, so clicking it pitches the
// product, takes their details, books a demo and sends them to the site.
//
// Presented as a full PANEL over the widget rather than a small dialog
// floating in the middle of it. A centred card inside a ~400px-wide widget
// leaves a cramped ~300px of usable width with a dark scrim eating the rest
// — the form ends up feeling like a popup interruption. Taking over the
// whole widget instead gives the form the full width, room to explain what
// the visitor gets, and a CTA that stays pinned in view while the fields
// scroll. It reads as a screen of the widget, which is what it is.
//
// Lives INSIDE the widget frame (absolutely positioned over it) so it
// behaves identically everywhere the widget appears — the Widget Builder's
// preview, the Flow Builder's popup simulator, the standalone Live Preview
// page and the hosted landing page — none of which share a modal host.
import { useState, useEffect } from 'react'
import clsx from 'clsx'
import { ChevronLeft, Check, ArrowRight, Sparkles, ExternalLink } from 'lucide-react'
import { CountryDialPicker, useDetectedCountry } from './AnswerControls'

// Where a submitted demo request goes. There's no backend in this build, so
// leads are kept client-side rather than thrown away.
export const DEMO_LEADS_STORAGE_KEY = 'webchat_demo_leads'

export function saveDemoLead(lead) {
  try {
    const all = JSON.parse(localStorage.getItem(DEMO_LEADS_STORAGE_KEY) || '[]')
    all.unshift(lead)
    localStorage.setItem(DEMO_LEADS_STORAGE_KEY, JSON.stringify(all))
  } catch {}
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

// How long the confirmation is left on screen before the visitor is sent on.
// Long enough to actually read that the demo request landed — being yanked
// away the instant you hit submit reads as though something went wrong.
const REDIRECT_DELAY_SECONDS = 5

const SELLING_POINTS = [
  'A 15-minute walkthrough, built around your use case',
  'See the flow builder, live chat and handover in action',
  'No setup or credit card to get started',
]

const fieldClass = (dark, invalid) => clsx(
  'w-full rounded-xl border px-3 py-2.5 text-[12.5px] outline-none transition-all',
  dark
    ? 'bg-slate-800/60 border-slate-700 text-slate-100 placeholder:text-slate-500 focus:border-slate-500 focus:bg-slate-800'
    : 'bg-slate-50 border-slate-200 text-slate-800 placeholder:text-slate-400 focus:border-slate-400 focus:bg-white',
  invalid && '!border-red-300 !bg-red-50/50',
)

/* Module scope ON PURPOSE. Declared inside the panel's own render this would
   be a brand-new component type every render, so React would unmount and
   remount the input on each keystroke and the field would lose focus after a
   single character. */
function Field({ label, hint, error, dark, children }) {
  return (
    <div>
      <div className="flex items-baseline justify-between mb-1.5">
        <label className={clsx('text-[11px] font-semibold', dark ? 'text-slate-300' : 'text-slate-700')}>{label}</label>
        {hint && <span className={clsx('text-[10px]', dark ? 'text-slate-600' : 'text-slate-400')}>{hint}</span>}
      </div>
      {children}
      {error && <p className="text-[10.5px] text-red-500 mt-1.5">{error}</p>}
    </div>
  )
}

export function PoweredByDemoModal({ open, onClose, cfg, brandBg, dark }) {
  const [form, setForm] = useState({ name: '', email: '', phone: '', company: '', website: '' })
  const [country, setCountry] = useDetectedCountry()
  const [touched, setTouched] = useState(false)
  const [done, setDone] = useState(false)
  const [secondsLeft, setSecondsLeft] = useState(REDIRECT_DELAY_SECONDS)
  const [holding, setHolding] = useState(false) // visitor chose to stay

  const target = cfg?.brandingUrl?.trim() || '/'

  // Sends the visitor on. A new tab is attempted first, but this runs off a
  // timer rather than a click, so there's no user activation behind it and
  // browsers will usually block the popup — `window.open` then returns null
  // and this navigates the current tab instead, so the redirect the visitor
  // was promised still happens rather than silently doing nothing.
  function goToSite() {
    const win = window.open(target, '_blank')
    if (win) { win.opener = null; return }
    window.location.href = target
  }

  // Tick down once the request is in, unless the visitor opted to stay.
  useEffect(() => {
    if (!open || !done || holding) return
    if (secondsLeft <= 0) { goToSite(); return }
    const t = setTimeout(() => setSecondsLeft(s => s - 1), 1000)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, done, holding, secondsLeft])

  // Closing resets the panel, so reopening it starts from a clean form rather
  // than the previous submission's confirmation (and stops the countdown).
  useEffect(() => {
    if (open) return
    setDone(false); setTouched(false); setHolding(false)
    setSecondsLeft(REDIRECT_DELAY_SECONDS)
    setForm({ name: '', email: '', phone: '', company: '', website: '' })
  }, [open])

  if (!open) return null

  const set = k => e => setForm(f => ({ ...f, [k]: e.target.value }))
  const nameOk = form.name.trim().length > 1
  const emailOk = EMAIL_RE.test(form.email.trim())
  const valid = nameOk && emailOk

  function submit() {
    setTouched(true)
    if (!valid) return
    // Only records the lead and shows the confirmation — the redirect is on
    // the countdown in the effect above, so the visitor gets to read that
    // their request went through before being sent anywhere.
    saveDemoLead({
      name: form.name.trim(),
      email: form.email.trim(),
      // Stored with the dial code so the number is dialable on its own.
      phone: form.phone.trim() ? `${country.dial} ${form.phone.trim()}` : '',
      company: form.company.trim(),
      website: form.website.trim(),
      at: new Date().toISOString(),
      from: typeof window !== 'undefined' ? window.location.pathname : '',
    })
    setDone(true)
  }

  const surface = dark ? 'bg-slate-900' : 'bg-white'
  const muted = dark ? 'text-slate-400' : 'text-slate-500'
  const hairline = dark ? 'border-slate-800' : 'border-slate-100'

  if (done) {
    return (
      <div className={clsx('absolute inset-0 z-[60] flex flex-col items-center justify-center px-7 text-center', surface)}
        style={{ animation: 'wcPop 0.3s cubic-bezier(0.16,1,0.3,1) both' }}>
        <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4"
          style={{ background: dark ? 'rgba(16,185,129,0.15)' : '#ecfdf5' }}>
          <Check size={26} className="text-emerald-500" strokeWidth={2.5}/>
        </div>
        <p className={clsx('text-[17px] font-bold tracking-tight', dark ? 'text-slate-100' : 'text-slate-900')}>
          You're all set
        </p>
        <p className={clsx('text-[12.5px] mt-2 leading-relaxed', muted)}>
          Thanks{form.name.trim() ? `, ${form.name.trim().split(' ')[0]}` : ''} — we'll email you at{' '}
          <span className={dark ? 'text-slate-300 font-medium' : 'text-slate-700 font-medium'}>{form.email.trim()}</span>{' '}
          to lock in a time.
        </p>

        {!holding && (
          <>
            {/* A visible countdown rather than a silent jump — being moved
                without warning feels like a misclick. The bar doubles as the
                progress indicator so the wait is legible at a glance. */}
            <p className={clsx('text-[11.5px] mt-5 font-medium', muted)}>
              {secondsLeft > 0 ? `Taking you to our site in ${secondsLeft}s…` : 'Opening our site…'}
            </p>
            <div className={clsx('w-full h-1 rounded-full mt-2 overflow-hidden', dark ? 'bg-slate-800' : 'bg-slate-100')}>
              <div className="h-full rounded-full transition-[width] duration-1000 ease-linear"
                style={{ width: `${((REDIRECT_DELAY_SECONDS - secondsLeft) / REDIRECT_DELAY_SECONDS) * 100}%`, background: brandBg }}/>
            </div>
          </>
        )}

        {/* This one IS a click, so it has user activation and opens a real new
            tab — unlike the timer-driven redirect, which browsers demote to a
            same-tab navigation. */}
        <button onClick={goToSite}
          className="mt-5 w-full py-3 rounded-xl text-[12.5px] font-bold text-white flex items-center justify-center gap-1.5 transition-transform active:scale-[0.99]"
          style={{ background: brandBg }}>
          Go now <ExternalLink size={13}/>
        </button>
        <button onClick={() => { setHolding(true); onClose() }}
          className={clsx('mt-2.5 w-full py-1.5 text-[11px] font-medium transition-colors',
            dark ? 'text-slate-500 hover:text-slate-300' : 'text-slate-400 hover:text-slate-600')}>
          Stay in the chat
        </button>
      </div>
    )
  }

  return (
    <div className={clsx('absolute inset-0 z-[60] flex flex-col', surface)}
      style={{ animation: 'wcWindowIn 0.32s cubic-bezier(0.16,1,0.3,1) both' }}>

      {/* Slim bar — a back affordance, not a title bar competing with the
          headline below it. */}
      <div className={clsx('flex-shrink-0 flex items-center gap-1.5 px-2.5 py-2 border-b', hairline)}>
        <button onClick={onClose}
          className={clsx('flex items-center gap-0.5 pl-1 pr-2 py-1 rounded-lg text-[11.5px] font-semibold transition-colors',
            dark ? 'text-slate-400 hover:text-slate-200 hover:bg-slate-800' : 'text-slate-500 hover:text-slate-800 hover:bg-slate-100')}>
          <ChevronLeft size={15}/> Back
        </button>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto">
        {/* Pitch first — this is a CTA, so it earns the ask before making it. */}
        <div className="px-5 pt-5 pb-4">
          <div className="w-11 h-11 rounded-2xl flex items-center justify-center mb-3.5"
            style={{ background: brandBg }}>
            <Sparkles size={19} className="text-white"/>
          </div>
          <h2 className={clsx('text-[19px] font-bold leading-[1.25] tracking-tight', dark ? 'text-slate-50' : 'text-slate-900')}>
            Want a chatbot<br/>like this one?
          </h2>
          <p className={clsx('text-[12.5px] mt-2 leading-relaxed', muted)}>
            Tell us where to reach you and we'll set up a demo.
          </p>

          <ul className="mt-4 space-y-2">
            {SELLING_POINTS.map(point => (
              <li key={point} className="flex items-start gap-2">
                <span className="w-4 h-4 rounded-full flex items-center justify-center flex-shrink-0 mt-[1px]"
                  style={{ background: dark ? 'rgba(16,185,129,0.15)' : '#ecfdf5' }}>
                  <Check size={10} className="text-emerald-500" strokeWidth={3}/>
                </span>
                <span className={clsx('text-[11.5px] leading-snug', muted)}>{point}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className={clsx('mx-5 border-t', hairline)}/>

        <div className="px-5 pt-4 pb-5 space-y-3.5">
          <Field label="Your name" dark={dark} error={touched && !nameOk ? 'Please enter your name' : null}>
            <input className={fieldClass(dark, touched && !nameOk)} placeholder="Jane Cooper"
              value={form.name} onChange={set('name')}/>
          </Field>

          <Field label="Work email" dark={dark} error={touched && !emailOk ? 'Please enter a valid email address' : null}>
            <input className={fieldClass(dark, touched && !emailOk)} type="email" placeholder="jane@company.com"
              value={form.email} onChange={set('email')}/>
          </Field>

          <Field label="Phone" hint="Optional" dark={dark}>
            <div className="flex items-center gap-2">
              <CountryDialPicker country={country} setCountry={setCountry} dark={dark} dropDirection="down"/>
              <input type="tel" placeholder="98765 43210" value={form.phone}
                onChange={e => setForm(f => ({ ...f, phone: e.target.value.replace(/[^\d\s-]/g, '') }))}
                className={clsx(fieldClass(dark), 'flex-1 min-w-0')}/>
            </div>
          </Field>

          <Field label="Company" hint="Optional" dark={dark}>
            <input className={fieldClass(dark)} placeholder="Acme Inc"
              value={form.company} onChange={set('company')}/>
          </Field>

          <Field label="Website" hint="Optional" dark={dark}>
            <input className={fieldClass(dark)} placeholder="acme.com"
              value={form.website} onChange={set('website')}/>
          </Field>
        </div>
      </div>

      {/* Pinned, so the CTA is reachable without scrolling back down and the
          panel still works in a short widget. */}
      <div className={clsx('flex-shrink-0 px-5 py-3.5 border-t', hairline, surface)}>
        <button onClick={submit}
          className="w-full py-3 rounded-xl text-[12.5px] font-bold text-white flex items-center justify-center gap-1.5 transition-transform active:scale-[0.99]"
          style={{ background: brandBg }}>
          Book my demo <ArrowRight size={14}/>
        </button>
        <p className={clsx('text-[10px] text-center mt-2.5', dark ? 'text-slate-600' : 'text-slate-400')}>
          No spam — we'll only use this to arrange your demo.
        </p>
      </div>
    </div>
  )
}
