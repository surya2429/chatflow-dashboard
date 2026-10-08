// PaymentDialog.jsx — everything the customer sees before money moves.
//
// Step 1  Billing details   (only when none are saved yet, or when they choose Edit)
// Step 2  Review & authorise: who is billed, the price with GST split for their
//         state, and — for autopay — a plain statement of the recurring charge
//         with an explicit consent checkbox (RBI e-mandate framework: informed
//         consent, amount and frequency disclosed, notice before each debit,
//         cancel any time).
// Nothing is charged until they confirm here and then finish Razorpay Checkout.
//
// kinds: new · change (switch plan on an autopay subscription) · autopay-off
import { useState, useEffect } from 'react'
import clsx from 'clsx'
import { X, ShieldCheck, Info, AlertCircle, Loader2, Repeat, CreditCard, Pencil, BellRing, Ban } from 'lucide-react'
import { PLANS, money } from '../../constants/pricing'
import BillingDetailsForm from './BillingDetailsForm'
import { addressLine } from './billingFormat'

const fmtDate = (sec) => new Date(sec * 1000).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
const planOf = (id) => PLANS.find((p) => p.id === id)

function Row({ k, v, strong, muted, sub }) {
  return (
    <div className="flex items-start justify-between gap-4 py-1.5">
      <span className={clsx('text-xs', muted ? 'text-slate-400' : 'text-slate-500')}>{k}{sub && <span className="block text-[10px] text-slate-400">{sub}</span>}</span>
      <span className={clsx('text-xs tabular-nums', strong ? 'font-bold text-slate-900 text-sm' : 'font-semibold text-slate-700')}>{v}</span>
    </div>
  )
}

/* The tax lines for this customer: CGST+SGST in their state, IGST elsewhere. */
function TaxRows({ charge }) {
  const half = charge.gstPercent / 2
  if (charge.tax?.kind === 'intra') {
    return (<>
      <Row k={`CGST (${half}%)`} v={money(charge.tax.cgst)} muted />
      <Row k={`SGST (${half}%)`} v={money(charge.tax.sgst)} muted />
    </>)
  }
  if (charge.tax?.kind === 'inter') return <Row k={`IGST (${charge.gstPercent}%)`} v={money(charge.tax.igst)} muted />
  return <Row k={`GST (${charge.gstPercent}%)`} v={money(charge.gst)} muted />
}

export default function PaymentDialog({
  dialog, config, sub, profile, quote, busy, error,
  onSaveProfile, onConfirm, onClose, onPayOnceInstead, onStartAtRenewal,
}) {
  const { kind, plan, period, mode, startAtCycleEnd, upgrade } = dialog || {}
  const needsDetails = kind === 'new' && !profile
  const [step, setStep] = useState(needsDetails ? 'details' : 'review')
  const [consent, setConsent] = useState(false)
  useEffect(() => { setStep(kind === 'new' && !profile ? 'details' : 'review'); setConsent(false) }, [dialog]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!dialog) return null
  const states = config?.states
  const p = plan ? planOf(plan) : null
  const fallback = plan && config?.prices?.[plan]?.[period]
  const charge = quote?.plan === plan && quote?.period === period ? quote.charge : fallback
  const testMode = (config?.keyId || '').startsWith('rzp_test_')
  const perWord = period === 'yearly' ? 'year' : 'month'
  const approval = charge && charge.total > (config?.approvalLimit ?? 15000)
  const endDate = sub?.currentEnd ? fmtDate(sub.currentEnd) : null
  const isAutopayNew = kind === 'new' && mode === 'autopay'

  let title, cta, tone = 'primary'
  if (step === 'details') { title = 'Billing details'; cta = '' }
  else if (kind === 'autopay-off') { title = 'Turn off autopay?'; cta = 'Turn off autopay'; tone = 'danger' }
  else if (kind === 'change') { title = `${upgrade ? 'Upgrade' : 'Switch'} to ${p.name}`; cta = upgrade ? 'Upgrade now' : 'Schedule change' }
  else if (startAtCycleEnd) { title = `Continue ${p.name} with autopay`; cta = 'Authorise autopay' }
  else { title = mode === 'autopay' ? `Subscribe to ${p.name}` : `Pay for ${p.name}`; cta = mode === 'autopay' ? 'Authorise & continue' : `Pay ${money(charge?.total ?? 0)}` }

  const canConfirm = !busy && (!isAutopayNew || consent)

  return (
    <div className="fixed inset-0 z-[70] bg-slate-900/50 flex items-center justify-center p-4 overflow-y-auto" onClick={(e) => e.target === e.currentTarget && !busy && onClose()}>
      <div className="bg-white rounded-2xl shadow-modal w-full max-w-md animate-fade-in my-auto overflow-hidden">
        <div className="flex items-start justify-between gap-3 px-5 pt-5 pb-3">
          <div>
            <h3 className="text-[15px] font-bold text-slate-900">{title}</h3>
            {step === 'details'
              ? <p className="text-xs text-slate-400 mt-0.5">Step 1 of 2 · needed for your GST invoice and payment notices</p>
              : kind !== 'autopay-off' && p && <p className="text-xs text-slate-400 mt-0.5">{needsDetails ? 'Step 2 of 2 · ' : ''}{p.name} · billed {period}</p>}
          </div>
          <button onClick={onClose} disabled={busy} className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 disabled:opacity-40"><X size={15}/></button>
        </div>

        {step === 'details' ? (
          <div className="px-5 pb-5">
            <BillingDetailsForm initial={profile} states={states} submitLabel="Save & continue" onCancel={onClose}
              onSubmit={async (values) => { await onSaveProfile(values); setStep('review') }}/>
          </div>
        ) : (
          <>
            <div className="px-5 pb-4 space-y-3">
              {kind === 'autopay-off' ? (
                <p className="text-xs text-slate-600 leading-relaxed">
                  Your <b>{sub?.planName}</b> plan stays active{endDate ? <> until <b>{endDate}</b></> : ''}, then stops. You won't be charged again.
                  You can turn autopay back on any time before then.
                </p>
              ) : (
                <>
                  {profile && kind === 'new' && (
                    <div className="rounded-xl border border-surface-border px-4 py-3 flex items-start gap-3">
                      <div className="flex-1 min-w-0">
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Billed to</p>
                        <p className="text-xs font-semibold text-slate-800 mt-0.5">{profile.legalName}</p>
                        <p className="text-[11px] text-slate-500 leading-snug">{addressLine(profile, states)}</p>
                        <p className="text-[11px] text-slate-400 mt-0.5">{profile.gstin ? `GSTIN ${profile.gstin}` : 'No GSTIN'} · {profile.email}</p>
                      </div>
                      <button onClick={() => setStep('details')} disabled={busy} className="inline-flex items-center gap-1 text-[11px] font-semibold text-primary hover:underline flex-shrink-0"><Pencil size={11}/> Edit</button>
                    </div>
                  )}

                  {charge && (
                    <div className="rounded-xl border border-surface-border bg-slate-50/60 px-4 py-2.5 divide-y divide-slate-100">
                      <Row k={`${p.name} plan (${period})`} v={money(charge.base)} />
                      <TaxRows charge={charge}/>
                      <Row k={mode === 'autopay' ? `Charged every ${perWord}` : 'Total today'} v={money(charge.total)} strong />
                    </div>
                  )}

                  {kind === 'change' ? (
                    <p className="flex items-start gap-2 text-xs text-slate-600 leading-relaxed">
                      <Info size={13} className="text-slate-400 flex-shrink-0 mt-0.5"/>
                      {upgrade
                        ? <span>Your plan changes <b>right away</b>. Razorpay charges the prorated difference for the rest of this period, then bills the new price from the next renewal.</span>
                        : <span>You keep <b>{sub?.planName}</b> until {endDate || 'the end of this period'}. <b>{p.name}</b> starts then, at the new price.</span>}
                    </p>
                  ) : isAutopayNew ? (
                    <div className="rounded-xl border border-violet-200 bg-violet-50/50 px-4 py-3 space-y-2">
                      <p className="text-[10px] font-bold text-violet-700 uppercase tracking-wider flex items-center gap-1.5"><Repeat size={11}/> Autopay mandate</p>
                      <ul className="text-[11.5px] text-slate-600 leading-relaxed space-y-1">
                        <li>• <b>{money(charge?.total ?? 0)}</b> incl. GST, every <b>{perWord}</b>{startAtCycleEnd ? <>, first on <b>{endDate}</b></> : ', starting today'}.</li>
                        <li className="flex items-start gap-1.5"><BellRing size={11} className="flex-shrink-0 mt-1 text-slate-400"/> <span>We notify you at {profile?.email || 'your email'} before every debit.</span></li>
                        <li className="flex items-start gap-1.5"><Ban size={11} className="flex-shrink-0 mt-1 text-slate-400"/> <span>Cancel any time in Settings → Billing → Autopay. Takes effect immediately for future charges.</span></li>
                        {approval && <li>• Above {money(config?.approvalLimit ?? 15000)}, your bank asks you to approve each debit — the plan renews once you do.</li>}
                      </ul>
                      <label className="flex items-start gap-2.5 pt-1 cursor-pointer select-none">
                        <input type="checkbox" className="mt-0.5 accent-primary" checked={consent} onChange={(e) => setConsent(e.target.checked)}/>
                        <span className="text-[11.5px] text-slate-700 leading-relaxed">
                          I authorise SmatBot to charge <b>{money(charge?.total ?? 0)}</b> every {perWord} to my selected payment method through Razorpay until I turn autopay off.
                        </span>
                      </label>
                    </div>
                  ) : (
                    <p className="flex items-start gap-2 text-xs text-slate-600 leading-relaxed">
                      <CreditCard size={13} className="text-slate-400 flex-shrink-0 mt-0.5"/>
                      <span>One payment for one {perWord}. It <b>doesn't renew</b> — you can turn on autopay later.{sub?.status === 'active' && !startAtCycleEnd && ' Unused time on your current plan is not credited.'}</span>
                    </p>
                  )}
                </>
              )}

              {testMode && kind !== 'autopay-off' && (
                <p className="flex items-start gap-2 text-[11px] text-sky-800 bg-sky-50 border border-sky-200 rounded-lg p-2.5 leading-relaxed">
                  <ShieldCheck size={13} className="flex-shrink-0 mt-0.5"/>
                  <span><b>Test mode</b> — no real money moves. Use card <span className="font-mono">4111 1111 1111 1111</span> with any future date and CVV, or UPI <span className="font-mono">success@razorpay</span>.</span>
                </p>
              )}

              {error && (
                <div className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg p-3 space-y-2">
                  <p className="flex items-start gap-2"><AlertCircle size={13} className="flex-shrink-0 mt-0.5"/> <span>{error.message}</span></p>
                  {error.code === 'razorpay_unauthorized' && onPayOnceInstead && (
                    <button onClick={onPayOnceInstead} className="font-semibold text-red-800 underline">Pay once instead (no autopay)</button>
                  )}
                  {error.code === 'change_not_supported' && onStartAtRenewal && (
                    <button onClick={onStartAtRenewal} className="font-semibold text-red-800 underline">Start {p.name} at renewal instead</button>
                  )}
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-surface-border bg-slate-50/60">
              <button onClick={onClose} disabled={busy} className="px-4 py-2 rounded-lg text-xs font-semibold text-slate-600 hover:bg-slate-100 disabled:opacity-40">Cancel</button>
              <button onClick={() => onConfirm({ consent })} disabled={!canConfirm}
                className={clsx('inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed',
                  tone === 'danger' ? 'bg-red-500 hover:bg-red-600' : 'bg-primary hover:bg-primary-hover')}>
                {busy && <Loader2 size={13} className="animate-spin"/>} {busy ? 'Working…' : cta}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
