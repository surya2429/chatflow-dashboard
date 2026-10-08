// PaymentDialog.jsx — the "review before you pay" step. Nothing is charged until
// the customer confirms here and then completes Razorpay Checkout.
//
// kinds:
//   new         first purchase, renewing after a plan ended, or starting at renewal
//   change      switch plan on an existing autopay subscription
//   autopay-off stop future automatic charges (plan keeps running until it ends)
import clsx from 'clsx'
import { X, ShieldCheck, Info, AlertCircle, Loader2, Repeat, CreditCard } from 'lucide-react'
import { PLANS, money as inr } from '../../constants/pricing'

const fmtDate = (sec) => new Date(sec * 1000).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
const planOf = (id) => PLANS.find((p) => p.id === id)

function Row({ k, v, strong, muted }) {
  return (
    <div className="flex items-center justify-between gap-4 py-1.5">
      <span className={clsx('text-xs', muted ? 'text-slate-400' : 'text-slate-500')}>{k}</span>
      <span className={clsx('text-xs tabular-nums', strong ? 'font-bold text-slate-900 text-sm' : 'font-semibold text-slate-700')}>{v}</span>
    </div>
  )
}

export default function PaymentDialog({ dialog, config, sub, busy, error, onConfirm, onClose, onPayOnceInstead, onStartAtRenewal }) {
  if (!dialog) return null
  const { kind, plan, period, mode, startAtCycleEnd, upgrade } = dialog
  const p = plan ? planOf(plan) : null
  const price = plan && config?.prices?.[plan]?.[period]
  const testMode = (config?.keyId || '').startsWith('rzp_test_')
  const perWord = period === 'yearly' ? 'year' : 'month'
  const approval = price && price.total > (config?.approvalLimit ?? 15000)
  const endDate = sub?.currentEnd ? fmtDate(sub.currentEnd) : null

  let title, cta, tone = 'primary'
  if (kind === 'autopay-off') { title = 'Turn off autopay?'; cta = 'Turn off autopay'; tone = 'danger' }
  else if (kind === 'change') { title = `${upgrade ? 'Upgrade' : 'Switch'} to ${p.name}`; cta = upgrade ? 'Upgrade now' : 'Schedule change' }
  else if (startAtCycleEnd) { title = mode === 'autopay' ? `Continue ${p.name} with autopay` : `Start ${p.name}`; cta = 'Authorise autopay' }
  else { title = mode === 'autopay' ? `Subscribe to ${p.name}` : `Pay for ${p.name}`; cta = mode === 'autopay' ? 'Continue to Razorpay' : `Pay ${inr(price?.total ?? 0)}` }

  return (
    <div className="fixed inset-0 z-[70] bg-slate-900/50 flex items-center justify-center p-4 overflow-y-auto" onClick={(e) => e.target === e.currentTarget && !busy && onClose()}>
      <div className="bg-white rounded-2xl shadow-modal w-full max-w-md animate-fade-in my-auto overflow-hidden">
        <div className="flex items-start justify-between gap-3 px-5 pt-5 pb-3">
          <div>
            <h3 className="text-[15px] font-bold text-slate-900">{title}</h3>
            {kind !== 'autopay-off' && p && <p className="text-xs text-slate-400 mt-0.5">{p.name} · billed {period}</p>}
          </div>
          <button onClick={onClose} disabled={busy} className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 disabled:opacity-40"><X size={15}/></button>
        </div>

        <div className="px-5 pb-4 space-y-3">
          {kind === 'autopay-off' ? (
            <p className="text-xs text-slate-600 leading-relaxed">
              Your <b>{sub?.planName}</b> plan stays active{endDate ? <> until <b>{endDate}</b></> : ''}, then stops. You won't be charged again.
              You can turn autopay back on any time before then.
            </p>
          ) : (
            <>
              {price && (
                <div className="rounded-xl border border-surface-border bg-slate-50/60 px-4 py-2.5 divide-y divide-slate-100">
                  <Row k={`${p.name} plan (${period})`} v={inr(price.base)} />
                  <Row k={`GST (${price.gstPercent}%)`} v={inr(price.gst)} muted />
                  <Row k={mode === 'autopay' ? `Charged every ${perWord}` : 'Total today'} v={inr(price.total)} strong />
                </div>
              )}

              {kind === 'change' ? (
                <p className="flex items-start gap-2 text-xs text-slate-600 leading-relaxed">
                  <Info size={13} className="text-slate-400 flex-shrink-0 mt-0.5"/>
                  {upgrade
                    ? <span>Your plan changes <b>right away</b>. Razorpay charges the prorated difference for the rest of this period, then bills the new price from the next renewal.</span>
                    : <span>You keep <b>{sub?.planName}</b> until {endDate || 'the end of this period'}. <b>{p.name}</b> starts then, at the new price.</span>}
                </p>
              ) : startAtCycleEnd ? (
                <p className="flex items-start gap-2 text-xs text-slate-600 leading-relaxed">
                  <Repeat size={13} className="text-slate-400 flex-shrink-0 mt-0.5"/>
                  <span>You authorise autopay now. Your current plan keeps running and <b>{inr(price?.total ?? 0)}</b> is first charged on <b>{endDate}</b>, when it ends.</span>
                </p>
              ) : mode === 'autopay' ? (
                <p className="flex items-start gap-2 text-xs text-slate-600 leading-relaxed">
                  <Repeat size={13} className="text-slate-400 flex-shrink-0 mt-0.5"/>
                  <span>You authorise once and Razorpay charges <b>{inr(price?.total ?? 0)}</b> every {perWord} until you turn autopay off.</span>
                </p>
              ) : (
                <p className="flex items-start gap-2 text-xs text-slate-600 leading-relaxed">
                  <CreditCard size={13} className="text-slate-400 flex-shrink-0 mt-0.5"/>
                  <span>One payment for one {perWord}. It <b>doesn't renew</b> — you can turn on autopay later.{sub?.status === 'active' && !startAtCycleEnd && ' Unused time on your current plan is not credited.'}</span>
                </p>
              )}

              {mode === 'autopay' && approval && (
                <p className="flex items-start gap-2 text-[11px] text-amber-800 bg-amber-50 border border-amber-200 rounded-lg p-2.5 leading-relaxed">
                  <AlertCircle size={13} className="flex-shrink-0 mt-0.5"/>
                  <span>Card and UPI rules (RBI) require your approval for any automatic debit above {inr(config?.approvalLimit ?? 15000)}. Each renewal, your bank will send an approval link a day or so before — the plan renews once you approve it.</span>
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
          <button onClick={onConfirm} disabled={busy}
            className={clsx('inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold text-white transition-colors disabled:opacity-60',
              tone === 'danger' ? 'bg-red-500 hover:bg-red-600' : 'bg-primary hover:bg-primary-hover')}>
            {busy && <Loader2 size={13} className="animate-spin"/>} {busy ? 'Working…' : cta}
          </button>
        </div>
      </div>
    </div>
  )
}
