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
import { X, Check, ArrowRight } from 'lucide-react'

// Where a submitted demo request goes. There's no backend in this build, so
// leads are kept client-side rather than thrown away — the Demo Requests
// list in the Widget Builder reads this back.
export const DEMO_LEADS_STORAGE_KEY = 'webchat_demo_leads'

export function saveDemoLead(lead) {
  try {
    const all = JSON.parse(localStorage.getItem(DEMO_LEADS_STORAGE_KEY) || '[]')
    all.unshift(lead)
    localStorage.setItem(DEMO_LEADS_STORAGE_KEY, JSON.stringify(all))
  } catch {}
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function PoweredByDemoModal({ open, onClose, cfg, brandBg, dark }) {
  const [form, setForm] = useState({ name: '', email: '', phone: '', company: '' })
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
      ...form,
      name: form.name.trim(), email: form.email.trim(),
      phone: form.phone.trim(), company: form.company.trim(),
      at: new Date().toISOString(),
      from: typeof window !== 'undefined' ? window.location.pathname : '',
    })
    setDone(true)
  }

  const panel = dark ? 'bg-slate-900 border-slate-700' : 'bg-white border-slate-200'
  const label = dark ? 'text-slate-400' : 'text-slate-500'
  const input = clsx('w-full rounded-lg border px-2.5 py-2 text-[11.5px] outline-none transition-colors',
    dark ? 'bg-slate-800 border-slate-700 text-slate-100 placeholder:text-slate-500 focus:border-slate-500'
         : 'bg-white border-slate-200 text-slate-800 placeholder:text-slate-300 focus:border-slate-400')

  return (
    <div className="absolute inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-[2px]"
      onClick={onClose}>
      <div onClick={e => e.stopPropagation()}
        className={clsx('w-full max-w-[300px] rounded-2xl border shadow-xl overflow-hidden', panel)}
        style={{ animation: 'wcPop 0.3s cubic-bezier(0.16,1,0.3,1) both' }}>

        {done ? (
          <div className="px-5 py-6 text-center">
            <div className="w-10 h-10 rounded-full bg-emerald-50 flex items-center justify-center mx-auto mb-3">
              <Check size={18} className="text-emerald-500"/>
            </div>
            <p className={clsx('text-[13px] font-bold', dark ? 'text-slate-100' : 'text-slate-800')}>You're all set</p>
            <p className={clsx('text-[11px] mt-1 leading-relaxed', label)}>
              We've got your details — our team will reach out to book your demo. We've opened our site in a new tab.
            </p>
            <button onClick={onClose}
              className="mt-4 w-full py-2 rounded-lg text-[11.5px] font-bold text-white"
              style={{ background: brandBg }}>
              Back to chat
            </button>
          </div>
        ) : (
          <>
            <div className="flex items-start gap-2 px-4 pt-4 pb-2">
              <div className="flex-1 min-w-0">
                <p className={clsx('text-[13px] font-bold leading-snug', dark ? 'text-slate-100' : 'text-slate-800')}>
                  Want a chatbot like this?
                </p>
                <p className={clsx('text-[11px] mt-1 leading-relaxed', label)}>
                  Tell us where to reach you and we'll book you a demo.
                </p>
              </div>
              <button onClick={onClose} title="Close"
                className={clsx('p-1 rounded-md flex-shrink-0 transition-colors',
                  dark ? 'text-slate-500 hover:text-slate-300' : 'text-slate-300 hover:text-slate-500')}>
                <X size={14}/>
              </button>
            </div>

            <div className="px-4 pb-4 space-y-2">
              <div>
                <input className={clsx(input, touched && !nameOk && '!border-red-300')}
                  placeholder="Your name" value={form.name} onChange={set('name')}/>
                {touched && !nameOk && <p className="text-[10px] text-red-500 mt-1">Please enter your name</p>}
              </div>
              <div>
                <input className={clsx(input, touched && !emailOk && '!border-red-300')} type="email"
                  placeholder="Work email" value={form.email} onChange={set('email')}/>
                {touched && !emailOk && <p className="text-[10px] text-red-500 mt-1">Please enter a valid email</p>}
              </div>
              <input className={input} type="tel" placeholder="Phone (optional)" value={form.phone} onChange={set('phone')}/>
              <input className={input} placeholder="Company (optional)" value={form.company} onChange={set('company')}/>

              <button onClick={submit}
                className="w-full mt-1 py-2.5 rounded-lg text-[11.5px] font-bold text-white flex items-center justify-center gap-1.5 transition-transform active:scale-[0.98]"
                style={{ background: brandBg }}>
                Book a demo <ArrowRight size={13}/>
              </button>
              <button onClick={onClose}
                className={clsx('w-full py-1 text-[10.5px] font-medium transition-colors',
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
