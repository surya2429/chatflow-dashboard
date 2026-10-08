// BillingDetailsForm.jsx — who is paying: name, contact, GSTIN and billing address.
//
// Collected before any payment because:
//   • GST law puts the recipient's name, address, state and (for a business) GSTIN
//     on the tax invoice, and the state decides CGST + SGST vs IGST.
//   • RBI's recurring-payment rules need working contact details: pre-debit
//     notices and the bank's approval codes go to this email and mobile.
// Fields are checked as you leave them; the server checks again and has the final say.
import { useState, useEffect } from 'react'
import clsx from 'clsx'
import { Loader2, ShieldCheck, Info, CheckCircle2 } from 'lucide-react'
import { stateNameOf } from './billingFormat'
import { toForm, toProfile, validateDetails, gstinError, SERVER_FIELD } from '../../lib/indiaValidation'

function Field({ label, error, hint, optional, children, className }) {
  return (
    <div className={className}>
      <label className="flex items-baseline justify-between mb-1">
        <span className="text-[11px] font-semibold text-slate-600">{label}{optional && <span className="font-normal text-slate-400"> · optional</span>}</span>
      </label>
      {children}
      {error ? <p className="text-[10.5px] text-red-600 mt-1 leading-snug">{error}</p> : hint ? <p className="text-[10.5px] text-slate-400 mt-1 leading-snug">{hint}</p> : null}
    </div>
  )
}

const inputCls = (bad) => clsx('input w-full text-xs', bad && '!border-red-300 !ring-red-100')

export default function BillingDetailsForm({ initial, states, onSubmit, onCancel, submitLabel = 'Save details', busy }) {
  const [v, setV] = useState(() => toForm(initial))
  const [errors, setErrors] = useState({})
  const [touched, setTouched] = useState({})
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState(null)
  useEffect(() => { setV(toForm(initial)) }, [initial])

  const set = (k, val) => {
    setV((p) => {
      const next = { ...p, [k]: val }
      // A valid GSTIN tells us the state, so don't make people pick it twice.
      if (k === 'gstin') {
        const g = val.trim().toUpperCase()
        if (g.length === 15 && !gstinError(g, states) && !p.stateCode) next.stateCode = g.slice(0, 2)
      }
      return next
    })
    if (formError) setFormError(null)
  }
  const blur = (k) => {
    setTouched((t) => ({ ...t, [k]: true }))
    setErrors(validateDetails(v, states))
  }
  const err = (k) => (touched[k] || touched.__all ? errors[k] : undefined)

  async function submit(e) {
    e.preventDefault()
    const found = validateDetails(v, states)
    setErrors(found); setTouched({ __all: true })
    if (Object.keys(found).length) return
    setSaving(true); setFormError(null)
    try {
      await onSubmit(toProfile(v))
    } catch (ex) {
      if (ex.fields) {
        const mapped = {}
        for (const [k, msg] of Object.entries(ex.fields)) mapped[SERVER_FIELD[k] || k] = msg
        setErrors(mapped); setTouched({ __all: true })
      } else setFormError(ex.message)
    } finally { setSaving(false) }
  }

  const gstinOk = v.gstin.trim().length === 15 && !gstinError(v.gstin, states)
  const regState = gstinOk ? stateNameOf(states, v.gstin.trim().slice(0, 2)) : null
  const disabled = saving || busy

  return (
    <form onSubmit={submit} noValidate className="space-y-5">
      <section className="space-y-3">
        <h4 className="text-xs font-bold text-slate-800">Who's paying</h4>
        <Field label="Business or full name" error={err('legalName')} hint="Exactly as it should appear on your GST invoice.">
          <input className={inputCls(err('legalName'))} value={v.legalName} autoComplete="organization" maxLength={120}
            onChange={(e) => set('legalName', e.target.value)} onBlur={() => blur('legalName')} placeholder="Acme Retail Pvt Ltd"/>
        </Field>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field label="Contact person" error={err('contactName')}>
            <input className={inputCls(err('contactName'))} value={v.contactName} autoComplete="name" maxLength={80}
              onChange={(e) => set('contactName', e.target.value)} onBlur={() => blur('contactName')} placeholder="Asha Rao"/>
          </Field>
          <Field label="Mobile number" error={err('phone')} hint="Your bank sends approval codes here.">
            <div className="flex">
              <span className="inline-flex items-center px-2.5 text-xs text-slate-500 bg-slate-50 border border-r-0 border-surface-border rounded-l-lg">+91</span>
              <input className={clsx(inputCls(err('phone')), '!rounded-l-none')} value={v.phone} inputMode="numeric" autoComplete="tel-national" maxLength={14}
                onChange={(e) => set('phone', e.target.value)} onBlur={() => blur('phone')} placeholder="98765 43210"/>
            </div>
          </Field>
        </div>
        <Field label="Email for invoices & payment notices" error={err('email')} hint="You're notified here before every automatic charge.">
          <input className={inputCls(err('email'))} type="email" value={v.email} autoComplete="email" maxLength={254}
            onChange={(e) => set('email', e.target.value)} onBlur={() => blur('email')} placeholder="billing@acme.in"/>
        </Field>
      </section>

      <section className="space-y-3">
        <h4 className="text-xs font-bold text-slate-800">Billing address</h4>
        <Field label="Address line 1" error={err('line1')}>
          <input className={inputCls(err('line1'))} value={v.line1} autoComplete="address-line1" maxLength={100}
            onChange={(e) => set('line1', e.target.value)} onBlur={() => blur('line1')} placeholder="Building, street"/>
        </Field>
        <Field label="Address line 2" optional error={err('line2')}>
          <input className={inputCls(err('line2'))} value={v.line2} autoComplete="address-line2" maxLength={100}
            onChange={(e) => set('line2', e.target.value)} placeholder="Area, landmark"/>
        </Field>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Field label="City" error={err('city')}>
            <input className={inputCls(err('city'))} value={v.city} autoComplete="address-level2" maxLength={60}
              onChange={(e) => set('city', e.target.value)} onBlur={() => blur('city')} placeholder="Mumbai"/>
          </Field>
          <Field label="State" error={err('stateCode')} className="sm:col-span-1">
            <select className={clsx(inputCls(err('stateCode')), 'appearance-none bg-white')} value={v.stateCode}
              onChange={(e) => set('stateCode', e.target.value)} onBlur={() => blur('stateCode')}>
              <option value="">Select state…</option>
              {(states || []).map((s) => <option key={s.code} value={s.code}>{s.name}</option>)}
            </select>
          </Field>
          <Field label="PIN code" error={err('pincode')}>
            <input className={inputCls(err('pincode'))} value={v.pincode} inputMode="numeric" autoComplete="postal-code" maxLength={6}
              onChange={(e) => set('pincode', e.target.value.replace(/\D/g, ''))} onBlur={() => blur('pincode')} placeholder="400001"/>
          </Field>
        </div>
        <p className="text-[10.5px] text-slate-400">Country: India. Only Indian billing addresses are supported right now.</p>
      </section>

      <section className="space-y-2">
        <h4 className="text-xs font-bold text-slate-800">GST registration</h4>
        <Field label="GSTIN" optional error={err('gstin')} hint="Add it to claim input tax credit. Leave blank if you're not GST-registered.">
          <input className={clsx(inputCls(err('gstin')), 'font-mono uppercase tracking-wide')} value={v.gstin} maxLength={15} autoCapitalize="characters"
            onChange={(e) => set('gstin', e.target.value.toUpperCase().replace(/\s/g, ''))} onBlur={() => blur('gstin')} placeholder="27AAPFU0939F1ZV"/>
        </Field>
        {regState && !err('gstin') && (
          <p className="flex items-center gap-1.5 text-[11px] text-emerald-700"><CheckCircle2 size={12}/> Valid GSTIN · registered in {regState}</p>
        )}
      </section>

      <div className="flex items-start gap-2 p-3 rounded-xl bg-slate-50 border border-slate-200">
        <ShieldCheck size={13} className="text-slate-400 flex-shrink-0 mt-0.5"/>
        <p className="text-[11px] text-slate-500 leading-relaxed">
          We use these details for your GST invoice and to send payment notices. Card and UPI details are entered with Razorpay and never reach us.
        </p>
      </div>

      {formError && <p className="flex items-start gap-2 text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg p-3"><Info size={13} className="flex-shrink-0 mt-0.5"/> {formError}</p>}

      <div className="flex items-center justify-end gap-2">
        {onCancel && <button type="button" onClick={onCancel} disabled={disabled} className="px-4 py-2 rounded-lg text-xs font-semibold text-slate-600 hover:bg-slate-100 disabled:opacity-40">Cancel</button>}
        <button type="submit" disabled={disabled}
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold text-white bg-primary hover:bg-primary-hover transition-colors disabled:opacity-60">
          {saving && <Loader2 size={13} className="animate-spin"/>} {saving ? 'Saving…' : submitLabel}
        </button>
      </div>
    </form>
  )
}
