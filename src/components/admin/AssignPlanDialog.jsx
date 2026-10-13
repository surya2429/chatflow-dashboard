// AssignPlanDialog.jsx — give a customer a plan without a Razorpay payment (paid offline, or a
// free / trial plan). It runs like a pay-once plan and ends on the chosen date. Admins only.
import { useState } from 'react'
import clsx from 'clsx'
import { Loader2 } from 'lucide-react'
import { PLANS, inr } from '../../constants/pricing'
import { billingAdmin } from '../../lib/billingApi'
import DatePicker from '../DatePicker'
import { Modal, ErrorNote, inputCls, labelCls, btnPrimary, btnGhost } from './ui'

const ymd = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
function onePeriodFromToday(period) {
  const d = new Date()
  if (period === 'monthly') d.setMonth(d.getMonth() + 1)
  else d.setFullYear(d.getFullYear() + 1)
  return ymd(d)
}

export default function AssignPlanDialog({ token, initial, addonDefs, onDone, onClose }) {
  const period0 = initial?.period || 'yearly'
  const [form, setForm] = useState({
    workspaceId: initial?.workspaceId || '', plan: initial?.plan || 'standard', period: period0, note: '',
    addons: Object.fromEntries((initial?.addons || []).map((a) => [a.id, a.qty])), until: onePeriodFromToday(period0),
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const set = (patch) => setForm((f) => ({ ...f, ...patch }))
  const setAddon = (id, qty) => setForm((f) => ({ ...f, addons: { ...f.addons, [id]: qty } }))

  const plan = PLANS.find((p) => p.id === form.plan)
  const eligible = addonDefs.filter((a) => a.plans.includes(form.plan))
  const chosen = eligible.filter((a) => form.addons[a.id] > 0)
  const listPrice = plan[form.period] + chosen.reduce((n, a) => n + a[form.period] * form.addons[a.id], 0)

  async function submit(e) {
    e.preventDefault()
    setSaving(true); setError('')
    try {
      const row = await billingAdmin.assign(token, {
        workspaceId: form.workspaceId.trim(), plan: form.plan, period: form.period,
        addons: chosen.map((a) => ({ id: a.id, qty: form.addons[a.id] })),
        until: Math.floor(new Date(`${form.until}T23:59:59`).getTime() / 1000),   // to the end of the chosen day
        note: form.note,
      })
      onDone(row)
    } catch (err) {
      setError(err.message)
      setSaving(false)
    }
  }

  return (
    <Modal title={initial?.workspaceId ? `Change plan · ${initial.customer || initial.workspaceId}` : 'Assign a plan to a new customer'}
      subtitle="Paid offline, or free / trial. No Razorpay payment and no invoice is created." onClose={onClose}>
      <form onSubmit={submit} className="p-5 space-y-4">
        <div>
          <label htmlFor="assign-ws" className={labelCls}>Workspace ID</label>
          <input id="assign-ws" required value={form.workspaceId} disabled={!!initial?.workspaceId}
            onChange={(e) => set({ workspaceId: e.target.value })} placeholder="e.g. default" className={inputCls}/>
        </div>

        <fieldset>
          <legend className={labelCls}>Plan</legend>
          <div className="grid grid-cols-2 gap-2">
            {PLANS.map((p) => (
              <label key={p.id} className={clsx('border rounded-xl px-3 py-2 cursor-pointer transition-colors has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-primary/30',
                form.plan === p.id ? 'border-primary bg-primary/5' : 'border-slate-200 hover:border-slate-300')}>
                <input type="radio" name="assign-plan" value={p.id} checked={form.plan === p.id} onChange={() => set({ plan: p.id })} className="sr-only"/>
                <div className="text-sm font-semibold text-slate-800">{p.name}</div>
                <div className="text-xs text-slate-500">{inr(p[form.period])} / {form.period === 'monthly' ? 'mo' : 'yr'}</div>
              </label>
            ))}
          </div>
        </fieldset>

        <fieldset>
          <legend className={labelCls}>Billing period</legend>
          <div className="inline-flex p-1 bg-slate-100 rounded-xl">
            {['monthly', 'yearly'].map((pd) => (
              <label key={pd} className={clsx('px-4 py-1.5 rounded-lg text-xs font-semibold capitalize cursor-pointer has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-primary/30',
                form.period === pd ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500')}>
                <input type="radio" name="assign-period" value={pd} checked={form.period === pd} onChange={() => set({ period: pd, until: onePeriodFromToday(pd) })} className="sr-only"/>
                {pd}
              </label>
            ))}
          </div>
        </fieldset>

        <fieldset>
          <legend className={labelCls}>Add-ons <span className="font-normal text-slate-400">(optional)</span></legend>
          <div className="max-h-48 overflow-y-auto border border-slate-200 rounded-xl divide-y divide-slate-100">
            {eligible.map((a) => (
              <div key={a.id} className="flex items-center gap-3 px-3 py-2">
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-medium text-slate-700">{a.name}</div>
                  <div className="text-[11px] text-slate-400">{inr(a[form.period])} · {a.unit}</div>
                </div>
                {a.maxQty === 1
                  ? <input type="checkbox" aria-label={a.name} checked={form.addons[a.id] > 0}
                      onChange={(e) => setAddon(a.id, e.target.checked ? 1 : 0)} className="w-4 h-4 accent-primary"/>
                  : <input type="number" aria-label={`${a.name} quantity`} min={0} max={a.maxQty} value={form.addons[a.id] || 0}
                      onChange={(e) => setAddon(a.id, Math.max(0, Math.min(a.maxQty, parseInt(e.target.value, 10) || 0)))}
                      className="w-16 border border-slate-200 rounded-lg px-2 py-1 text-xs text-right outline-none focus:border-primary"/>}
              </div>
            ))}
          </div>
        </fieldset>

        <fieldset>
          <legend className={labelCls}>Plan ends on</legend>
          <DatePicker value={form.until} onChange={(until) => set({ until })} textSize="text-sm"/>
        </fieldset>

        <div>
          <label htmlFor="assign-note" className={labelCls}>Note</label>
          <input id="assign-note" value={form.note} maxLength={500} onChange={(e) => set({ note: e.target.value })}
            placeholder="e.g. Paid by NEFT, UTR 1234 · or 30-day trial" className={inputCls}/>
        </div>

        <div className="rounded-xl bg-slate-50 px-3 py-2.5 text-xs text-slate-600 flex justify-between">
          <span>List price, for reference</span>
          <span className="font-semibold text-slate-800">{inr(listPrice)} + GST</span>
        </div>

        <ErrorNote>{error}</ErrorNote>

        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className={btnGhost}>Cancel</button>
          <button type="submit" disabled={saving || !form.workspaceId.trim() || !form.until} className={btnPrimary}>
            {saving && <Loader2 size={14} className="animate-spin"/>} Assign plan
          </button>
        </div>
      </form>
    </Modal>
  )
}
