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
// kinds: new · change (switch plan on an autopay subscription) · autopay-off · update-card · addons-once (extras bought once on the running plan)
import { useState, useEffect } from 'react'
import clsx from 'clsx'
import { X, ShieldCheck, Info, AlertCircle, Loader2, Repeat, CreditCard, Pencil, BellRing, Ban, Plus, Minus, Puzzle } from 'lucide-react'
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

const sigOf = (list) => (list || []).map((a) => `${a.id}x${a.qty}`).join(',')

/* Optional extras bought together with the plan. The server re-prices them; this only picks ids and quantities. */
function AddonPicker({ defs, period, selected, onChange, disabled }) {
  const qtyOf = (id) => selected.find((a) => a.id === id)?.qty || 0
  const set = (def, qty) => {
    let next = selected.filter((a) => a.id !== def.id)
    if (qty > 0) next.push({ id: def.id, qty })
    if (qty > 0 && def.excludes) next = next.filter((a) => !def.excludes.includes(a.id))   // Basic ⇄ Premium Support
    onChange(next)
  }
  const per = period === 'yearly' ? 'yr' : 'mo'
  return (
    <div className="rounded-xl border border-surface-border divide-y divide-slate-100 max-h-56 overflow-y-auto">
      {defs.map((def) => {
        const q = qtyOf(def.id)
        return (
          <div key={def.id} className={clsx('flex items-center gap-3 px-3 py-2', q > 0 && 'bg-primary/[0.04]')}>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-slate-800">{def.name}</p>
              <p className="text-[10px] text-slate-400">{def.unit} · {money(def[period])} / {per}</p>
            </div>
            {def.maxQty === 1 ? (
              <button type="button" disabled={disabled} onClick={() => set(def, q ? 0 : 1)}
                className={clsx('px-2.5 py-1 rounded-lg text-[11px] font-bold border transition-colors disabled:opacity-50', q ? 'bg-primary text-white border-primary' : 'text-primary border-primary/30 hover:bg-primary/5')}>
                {q ? 'Added' : 'Add'}
              </button>
            ) : (
              <div className="inline-flex items-center rounded-lg border border-slate-200 overflow-hidden">
                <button type="button" disabled={disabled || q === 0} onClick={() => set(def, q - 1)} aria-label={`Fewer ${def.name}`} className="w-6 h-6 flex items-center justify-center text-slate-500 hover:bg-slate-100 disabled:opacity-30"><Minus size={11}/></button>
                <span className="w-7 text-center text-xs font-bold tabular-nums text-slate-800">{q}</span>
                <button type="button" disabled={disabled || q >= def.maxQty} onClick={() => set(def, q + 1)} aria-label={`More ${def.name}`} className="w-6 h-6 flex items-center justify-center text-slate-500 hover:bg-slate-100 disabled:opacity-30"><Plus size={11}/></button>
              </div>
            )}
          </div>
        )
      })}
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
  dialog, config, sub, profile, defaults, quote, busy, error,
  onSaveProfile, onConfirm, onClose, onPayOnceInstead, onStartAtRenewal, onAddonsChange, web,
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
  // What was picked, priced from the catalog; the server's quote (with the GST split) replaces it when it arrives.
  const selected = dialog.addons || []
  const defs = (config?.addons || []).filter((a) => a.plans.includes(plan) && !(web && a.whatsapp))
  const quoteOk = !!quote && quote.plan === plan && quote.period === period && sigOf(quote.addons) === sigOf(selected)
  const planBase = quoteOk ? quote.planBase : fallback?.base
  const lines = selected.map((a) => { const d = defs.find((x) => x.id === a.id); return d ? { id: d.id, name: d.name, unit: d.unit, qty: a.qty, amount: d[period] * a.qty } : null }).filter(Boolean)
  const addonsOnly = kind === 'addons-once'
  let charge = quoteOk ? quote.charge : addonsOnly ? null : fallback
  if (!quoteOk && lines.length && (fallback || addonsOnly)) {
    const gstPct = fallback?.gstPercent ?? config?.gstPercent ?? 18
    const sum = (addonsOnly ? 0 : fallback.base) + lines.reduce((n, l) => n + l.amount, 0)
    const total = Math.round(sum * (1 + gstPct / 100) * 100) / 100
    charge = { base: sum, gst: Math.round((total - sum) * 100) / 100, total, gstPercent: gstPct, tax: { kind: 'unknown' } }
  }
  const showAddons = (kind === 'new' || addonsOnly) && !!config?.addons
  const testMode = (config?.keyId || '').startsWith('rzp_test_')
  const perWord = period === 'yearly' ? 'year' : 'month'
  const approvalLimit = config?.approvalLimit ?? 15000
  const approval = charge && charge.total > approvalLimit
  // Monthly plans are charged to a saved card by us (RBI card-on-file); anything above the limit needs Razorpay Subscriptions.
  const cardAutopay = mode === 'autopay' && config?.autopayEngine !== 'subscription' && charge && charge.total <= approvalLimit
  const cardChange = kind === 'change' && sub?.autopay?.engine === 'token'
  const endDate = sub?.currentEnd ? fmtDate(sub.currentEnd) : null
  const isAutopayNew = kind === 'new' && mode === 'autopay'

  let title, cta, tone = 'primary'
  if (step === 'details') { title = profile ? 'Edit billing details' : 'Billing details'; cta = '' }
  else if (kind === 'autopay-off') { title = 'Turn off autopay?'; cta = 'Turn off autopay'; tone = 'danger' }
  else if (kind === 'update-card') { title = 'Change payment card'; cta = 'Add new card' }
  else if (addonsOnly) { title = 'Buy add-ons'; cta = `Pay ${money(charge?.total ?? 0)}` }
  else if (kind === 'change') { title = `${upgrade && !cardChange ? 'Upgrade' : 'Switch'} to ${p.name}`; cta = upgrade && !cardChange ? 'Upgrade now' : 'Schedule change' }
  else if (startAtCycleEnd) { title = `Continue ${p.name} with autopay`; cta = 'Authorise autopay' }
  else { title = mode === 'autopay' ? `Subscribe to ${p.name}` : `Pay for ${p.name}`; cta = mode === 'autopay' ? 'Authorise & continue' : `Pay ${money(charge?.total ?? 0)}` }

  const canConfirm = !busy && (!isAutopayNew || consent) && (kind !== 'update-card' || consent) && (!addonsOnly || selected.length > 0)

  return (
    <div className="fixed inset-0 z-[70] bg-slate-900/50 flex items-center justify-center p-4 overflow-y-auto" onClick={(e) => e.target === e.currentTarget && !busy && onClose()}>
      <div className="bg-white rounded-2xl shadow-modal w-full max-w-md animate-fade-in my-auto overflow-hidden">
        <div className="flex items-start justify-between gap-3 px-5 pt-5 pb-3">
          <div>
            <h3 className="text-[15px] font-bold text-slate-900">{title}</h3>
            {step === 'details'
              ? <p className="text-xs text-slate-400 mt-0.5">{needsDetails ? 'Step 1 of 2 · ' : ''}needed for your GST invoice and payment notices</p>
              : kind !== 'autopay-off' && p && <p className="text-xs text-slate-400 mt-0.5">{needsDetails ? 'Step 2 of 2 · ' : ''}{p.name} · billed {period}</p>}
          </div>
          <button onClick={onClose} disabled={busy} className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 disabled:opacity-40"><X size={15}/></button>
        </div>

        {step === 'details' ? (
          <div className="px-5 pb-5">
            <BillingDetailsForm initial={profile} defaults={defaults} states={states} submitLabel={profile ? 'Save changes' : 'Save & continue'} onCancel={profile ? () => setStep('review') : onClose}
              onSubmit={async (values) => { await onSaveProfile(values); setStep('review') }}/>
          </div>
        ) : (
          <>
            <div className="px-5 pb-4 space-y-3">
              {kind === 'update-card' ? (
                <div className="space-y-3">
                  <p className="text-xs text-slate-600 leading-relaxed">
                    Your plan stays exactly as it is. We charge <b>₹1</b> to check the new card (it is refunded straight away) and use it for your next renewals.
                    {sub?.autopay?.card && <> Your current card, <b>{sub.autopay.card.network || 'Card'} •••• {sub.autopay.card.last4}</b>, is then removed.</>}
                  </p>
                  {sub?.status === 'past_due' && (
                    <p className="flex items-start gap-2 text-[11px] text-amber-800 bg-amber-50 border border-amber-200 rounded-lg p-2.5 leading-relaxed">
                      <AlertCircle size={12} className="flex-shrink-0 mt-0.5"/>
                      Your last renewal payment didn't go through. We'll try the new card on the next retry date{sub.dunning?.nextAttemptAt ? ` (${new Date(sub.dunning.nextAttemptAt * 1000).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })})` : ''}, or you can pay now from the Autopay card.
                    </p>
                  )}
                  <label className="flex items-start gap-2.5 cursor-pointer select-none rounded-xl border border-violet-200 bg-violet-50/50 px-4 py-3">
                    <input type="checkbox" className="mt-0.5 accent-primary" checked={consent} onChange={(e) => setConsent(e.target.checked)}/>
                    <span className="text-[11.5px] text-slate-700 leading-relaxed">
                      I authorise SmatBot to charge <b>{money(sub?.autopay?.next?.total ?? sub?.charge?.total ?? 0)}</b> every {(sub?.autopay?.next?.period ?? sub?.period) === 'yearly' ? 'year' : 'month'} to this new card through Razorpay until I turn autopay off. At checkout, tick <i>"Save this card as per RBI guidelines"</i>.
                    </span>
                  </label>
                </div>
              ) : kind === 'autopay-off' ? (
                <p className="text-xs text-slate-600 leading-relaxed">
                  Your <b>{sub?.planName}</b> plan stays active{endDate ? <> until <b>{endDate}</b></> : ''}, then stops. You won't be charged again.
                  You can turn autopay back on any time before then.
                </p>
              ) : (
                <>
                  {profile && (kind === 'new' || addonsOnly) && (
                    <div className="rounded-xl border border-surface-border px-4 py-3 flex items-start gap-3">
                      <div className="flex-1 min-w-0 [overflow-wrap:anywhere]">
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Billed to</p>
                        <p className="text-xs font-semibold text-slate-800 mt-0.5">{profile.legalName}</p>
                        <p className="text-[11px] text-slate-500 leading-snug">{addressLine(profile, states)}</p>
                        <p className="text-[11px] text-slate-400 mt-0.5">{profile.email} · +91 {profile.phone}</p>
                        <p className="text-[11px] text-slate-400">{profile.gstin ? `GSTIN ${profile.gstin}` : 'No GSTIN'}</p>
                      </div>
                      <button onClick={() => setStep('details')} disabled={busy} className="inline-flex items-center gap-1 text-[11px] font-semibold text-primary hover:underline flex-shrink-0"><Pencil size={11}/> Edit</button>
                    </div>
                  )}

                  {showAddons && (
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5"><Puzzle size={11}/> Add-ons <span className="normal-case font-medium tracking-normal">(optional)</span></p>
                        {selected.length > 0 && <button type="button" onClick={() => onAddonsChange?.([])} disabled={busy} className="text-[10.5px] font-semibold text-slate-400 hover:text-slate-600">Clear</button>}
                      </div>
                      {defs.length > 0 ? (
                        <AddonPicker defs={defs} period={period} selected={selected} onChange={(a) => onAddonsChange?.(a)} disabled={busy}/>
                      ) : (
                        <p className="text-[11px] text-slate-500 leading-relaxed rounded-xl border border-dashed border-slate-200 px-3 py-2.5">
                          Extra capacity is sold with Pro and AI. Feature add-ons for {p.name} (CRM, Live Agents, Cart &amp; Catalog…) are priced on request.
                        </p>
                      )}
                    </div>
                  )}

                  {charge && (
                    <div className="rounded-xl border border-surface-border bg-slate-50/60 px-4 py-2.5 divide-y divide-slate-100">
                      {!addonsOnly && <Row k={`${p.name} plan (${period})`} v={money(planBase ?? charge.base)} />}
                      {lines.map((l) => <Row key={l.id} k={`${l.name}${l.qty > 1 ? ` × ${l.qty}` : ''}`} v={money(l.amount)} sub={l.unit} />)}
                      <TaxRows charge={charge}/>
                      <Row k={mode === 'autopay' ? `Charged every ${perWord}` : 'Total today'} v={money(charge.total)} strong />
                    </div>
                  )}

                  {addonsOnly ? (
                    <p className="flex items-start gap-2 text-xs text-slate-600 leading-relaxed">
                      <Info size={13} className="text-slate-400 flex-shrink-0 mt-0.5"/>
                      <span>
                        A <b>one-time</b> purchase: these add-ons run until <b>{endDate || 'the end of your current period'}</b> and <b>don't renew</b>.
                        {sub?.autopay?.on ? ' Your plan and autopay stay exactly as they are — the next renewal is charged as usual.' : ''}
                        {' '}Pick them again next period if you still need them, or add them to your plan when you subscribe.
                      </span>
                    </p>
                  ) : kind === 'change' ? (
                    <p className="flex items-start gap-2 text-xs text-slate-600 leading-relaxed">
                      <Info size={13} className="text-slate-400 flex-shrink-0 mt-0.5"/>
                      {cardChange
                        ? <span>You keep <b>{sub?.planName}</b> until {endDate || 'the end of this period'}. From then your saved card is charged <b>{money(charge?.total ?? 0)}</b> every {perWord} for <b>{p.name}</b>. We email you 2 days before.</span>
                        : upgrade
                        ? <span>Your plan changes <b>right away</b>. Razorpay charges the prorated difference for the rest of this period, then bills the new price from the next renewal.</span>
                        : <span>You keep <b>{sub?.planName}</b> until {endDate || 'the end of this period'}. <b>{p.name}</b> starts then, at the new price.</span>}
                    </p>
                  ) : isAutopayNew ? (
                    <div className="rounded-xl border border-violet-200 bg-violet-50/50 px-4 py-3 space-y-2">
                      <p className="text-[10px] font-bold text-violet-700 uppercase tracking-wider flex items-center gap-1.5"><Repeat size={11}/> Autopay mandate</p>
                      <ul className="text-[11.5px] text-slate-600 leading-relaxed space-y-1">
                        <li>• <b>{money(charge?.total ?? 0)}</b> incl. GST, every <b>{perWord}</b>{startAtCycleEnd ? <>, first on <b>{endDate}</b></> : ', starting today'}.</li>
                        {cardAutopay && <li>• Paid with a <b>credit or debit card</b>. At checkout, tick <i>"Save this card as per RBI guidelines"</i>. Your bank records a ceiling of {money(approvalLimit)} per charge; we only ever charge your plan price.{startAtCycleEnd ? ' We charge ₹1 now only to verify the card — it is refunded.' : ''}</li>}
                        <li className="flex items-start gap-1.5"><BellRing size={11} className="flex-shrink-0 mt-1 text-slate-400"/> <span>We notify you at {profile?.email || 'your email'} {cardAutopay ? <b>2 days before</b> : 'before'} every debit.</span></li>
                        {cardAutopay && <li>• If a debit fails, we try again up to <b>3 more times</b> over 9 days (every 48–72 hours) and keep your plan running meanwhile. If it still fails, the plan is suspended.</li>}
                        <li className="flex items-start gap-1.5"><Ban size={11} className="flex-shrink-0 mt-1 text-slate-400"/> <span>Cancel any time in Settings → Billing → Autopay. Takes effect immediately for future charges.</span></li>
                        {approval && <li>• Above {money(approvalLimit)}, your bank asks you to approve each debit — the plan renews once you do.</li>}
                      </ul>
                      <label className="flex items-start gap-2.5 pt-1 cursor-pointer select-none">
                        <input type="checkbox" className="mt-0.5 accent-primary" checked={consent} onChange={(e) => setConsent(e.target.checked)}/>
                        <span className="text-[11.5px] text-slate-700 leading-relaxed">
                          I authorise SmatBot to charge <b>{money(charge?.total ?? 0)}</b> every {perWord} to my {cardAutopay ? 'saved card' : 'selected payment method'} through Razorpay until I turn autopay off.
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
                  <span><b>Test mode</b> — no real money moves. Use card <span className="font-mono">5267 3181 8797 5449</span> with any future date and CVV (OTP: any 6 digits){cardAutopay || kind === 'update-card' ? '' : <>, or UPI <span className="font-mono">success@razorpay</span></>}.</span>
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
