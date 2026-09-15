// PoweredByDemoModal.jsx — the lead-capture step behind the widget's
// "Powered by ChatFlow" strip. A visitor who notices the branding is a
// visitor who might want this chatbot themselves, so clicking it asks for
// their details, books a demo, and sends them on to the ChatFlow site.
//
// Rendered INSIDE the widget frame (absolutely positioned over it) rather
// than as a page-level dialog, so it behaves identically everywhere the
// widget appears — the Widget Builder's own preview, the Flow Builder's
// popup simulator, the standalone Live Preview page and the hosted landing
// page — none of which share a common modal host.
import { useState } from 'react'
import clsx from 'clsx'
import { X, Check, ArrowRight, User, Mail, Building2, Globe, Sparkles } from 'lucide-react'
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

const inputClass = dark => clsx(
  'w-full rounded-lg border text-[11.5px] outline-none transition-colors',
  dark ? 'bg-slate-800 border-slate-700 text-slate-100 placeholder:text-slate-500 focus:border-slate-500'
       : 'bg-slate-50/70 border-slate-200 text-slate-800 placeholder:text-slate-400 focus:border-slate-400 focus:bg-white')

/* Input with a leading icon — the icon is absolutely placed and the input
   padded past it, so it can't be pushed around by the text.
   Defined at module scope ON PURPOSE: a component declared inside the
   modal's own render would be a brand-new component type on every render,
   so React would unmount and remount each input on every keystroke and the
   field would lose focus after a single character. */
function IconInput({ icon: Icon, invalid, dark, ...props }) {
  return (
    <div className="relative">
      <Icon size={12} className={clsx('absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none',
        dark ? 'text-slate-500' : 'text-slate-400')}/>
      <input {...props} className={clsx(inputClass(dark), 'pl-7 pr-2.5 py-2', invalid && '!border-red-300')}/>
    </div>
  )
}

/* A labelled field. The label sits above the control rather than relying on
   placeholder text alone, so a half-filled form still says what each box is
   — placeholders vanish the moment you type into them. */
function Field({ label, hint, error, dark, children }) {
  return (
    <div>
      <div className="flex items-baseline justify-between mb-1">
        <label className={clsx('text-[9.5px] font-bold uppercase tracking-wider',
          dark ? 'text-slate-500' : 'text-slate-400')}>{label}</label>
        {hint && <span className={clsx('text-[9px]', dark ? 'text-slate-600' : 'text-slate-300')}>{hint}</span>}
      </div>
      {children}
      {error && <p className="text-[9.5px] text-red-500 mt-1">{error}</p>}
    </div>
  )
}

export function PoweredByDemoModal({ open, onClose, cfg, brandBg, dark }) {
  const [form, setForm] = useState({ name: '', email: '', phone: '', company: '', website: '' })
  const [country, setCountry] = useDetectedCountry()
  const [touched, setTouched] = useState(false)
  const [done, setDone] = useState(false)

  if (!open) return null

  const set = k => e => setForm(f => ({ ...f, [k]: e.target.value }))
  const nameOk = form.name.trim().length > 1
  const emailOk = EMAIL_RE.test(form.email.trim())
  const valid = nameOk && emailOk

  function submit() {
    setTouched(true)
    if (!valid) return
    // Opened FIRST and synchronously in the click, before the storage write,
    // so the new tab still has the click's user activation behind it. No
    // windowFeatures argument either — passing one asks for a popup window
    // rather than a tab, which browsers block far more readily (the same
    // thing that made the Landing Page button land in the current tab).
    // `brandingUrl` is whatever the merchant set in the Widget Builder; it
    // defaults to this app's own site.
    const target = cfg?.brandingUrl?.trim() || '/'
    const win = window.open(target, '_blank')
    if (win) win.opener = null
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

  const card = dark ? 'bg-slate-900 border-slate-700' : 'bg-white border-slate-200'
  const sub = dark ? 'text-slate-400' : 'text-slate-500'

  return (
    <div className="absolute inset-0 z-[60] flex items-center justify-center p-3 bg-slate-900/50 backdrop-blur-[2px]"
      onClick={onClose}>
      <div onClick={e => e.stopPropagation()}
        className={clsx('w-full max-w-[330px] max-h-full overflow-y-auto rounded-2xl border shadow-2xl', card)}
        style={{ animation: 'wcPop 0.3s cubic-bezier(0.16,1,0.3,1) both' }}>

        {done ? (
          <div className="px-5 py-7 text-center">
            <div className="w-11 h-11 rounded-full bg-emerald-50 flex items-center justify-center mx-auto mb-3">
              <Check size={20} className="text-emerald-500"/>
            </div>
            <p className={clsx('text-[14px] font-bold', dark ? 'text-slate-100' : 'text-slate-800')}>You're all set</p>
            <p className={clsx('text-[11px] mt-1.5 leading-relaxed', sub)}>
              We've got your details — our team will reach out to book your demo.
              We've opened our site in a new tab.
            </p>
            <button onClick={onClose}
              className="mt-5 w-full py-2.5 rounded-lg text-[11.5px] font-bold text-white"
              style={{ background: brandBg }}>
              Back to chat
            </button>
          </div>
        ) : (
          <>
            {/* Brand-tinted head so the form reads as an offer, not a
                generic data-collection box bolted onto the chat. */}
            <div className="relative px-4 pt-4 pb-3.5" style={{ background: brandBg }}>
              <button onClick={onClose} title="Close"
                className="absolute top-3 right-3 p-1 rounded-md text-white/70 hover:text-white hover:bg-white/15 transition-colors">
                <X size={14}/>
              </button>
              <div className="flex items-center gap-2 pr-6">
                <div className="w-7 h-7 rounded-lg bg-white/20 flex items-center justify-center flex-shrink-0">
                  <Sparkles size={14} className="text-white"/>
                </div>
                <div className="min-w-0">
                  <p className="text-[13.5px] font-bold text-white leading-snug">Want a chatbot like this?</p>
                  <p className="text-[10.5px] text-white/80 leading-snug mt-0.5">Book a free 15-minute demo</p>
                </div>
              </div>
            </div>

            <div className="px-4 py-3.5 space-y-2.5">
              <Field label="Your name" dark={dark} error={touched && !nameOk ? 'Please enter your name' : null}>
                <IconInput icon={User} dark={dark} placeholder="Jane Cooper" value={form.name} onChange={set('name')}
                  invalid={touched && !nameOk}/>
              </Field>

              <Field label="Work email" dark={dark} error={touched && !emailOk ? 'Please enter a valid email' : null}>
                <IconInput icon={Mail} dark={dark} type="email" placeholder="jane@company.com" value={form.email}
                  onChange={set('email')} invalid={touched && !emailOk}/>
              </Field>

              <Field label="Phone" hint="optional" dark={dark}>
                <div className="flex items-center gap-1.5">
                  <CountryDialPicker country={country} setCountry={setCountry} dark={dark} dropDirection="down"/>
                  <input type="tel" placeholder="98765 43210" value={form.phone}
                    onChange={e => setForm(f => ({ ...f, phone: e.target.value.replace(/[^\d\s-]/g, '') }))}
                    className={clsx(inputClass(dark), 'flex-1 min-w-0 px-2.5 py-2')}/>
                </div>
              </Field>

              {/* Company and website share a row — both optional, and keeping
                  the form short matters inside a widget that can be short. */}
              <div className="grid grid-cols-2 gap-2">
                <Field label="Company" hint="optional" dark={dark}>
                  <IconInput icon={Building2} dark={dark} placeholder="Acme Inc" value={form.company} onChange={set('company')}/>
                </Field>
                <Field label="Website" hint="optional" dark={dark}>
                  <IconInput icon={Globe} dark={dark} placeholder="acme.com" value={form.website} onChange={set('website')}/>
                </Field>
              </div>

              <button onClick={submit}
                className="w-full !mt-3.5 py-2.5 rounded-lg text-[11.5px] font-bold text-white flex items-center justify-center gap-1.5 transition-transform active:scale-[0.98]"
                style={{ background: brandBg }}>
                Book a demo <ArrowRight size={13}/>
              </button>
              <button onClick={onClose}
                className={clsx('w-full !mt-1.5 py-1 text-[10.5px] font-medium transition-colors',
                  dark ? 'text-slate-500 hover:text-slate-300' : 'text-slate-400 hover:text-slate-600')}>
                No thanks
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
