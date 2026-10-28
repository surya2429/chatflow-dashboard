// RenewDialog.jsx — the next cycle of a subscription staff set up: record its payment (offline, or
// free) and it runs on from the end of the current cycle, at the subscription's own prices.
import { useState } from 'react'
import { Loader2 } from 'lucide-react'
import { billingAdmin } from '../../lib/billingApi'
import { Modal, Chips, ErrorNote, inputCls, labelCls, btnPrimary, btnGhost, rupees, fmtDate } from './ui'

export default function RenewDialog({ token, client: c, onDone, onClose }) {
  const scheduled = Boolean(c.renewal.scheduled)
  const s = scheduled && c.nextSub ? c.nextSub : c.subscription       // the subscription this bill belongs to
  const [type, setType] = useState('offline')
  const [amount, setAmount] = useState(String(c.renewal.total))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function submit(e) {
    e.preventDefault()
    setSaving(true); setError('')
    try {
      onDone(await billingAdmin.renew(token, { workspaceId: c.workspaceId, payment: type === 'offline' ? { type, amount: Number(amount) } : { type: 'free' } }))
    } catch (err) { setError(err.message); setSaving(false) }
  }

  return (
    <Modal title={scheduled ? `Start ${s.number} · ${c.renewal.planName}` : `Record cycle ${c.renewal.cycle}${s.cycles ? ` of ${s.cycles}` : ''} · ${s.number}`} subtitle={`${c.customer || c.workspaceId} · ${c.renewal.planName}, ${c.renewal.period}`} onClose={onClose}>
      <form onSubmit={submit} className="p-5 space-y-4">
        <div className="rounded-xl bg-slate-50 border border-slate-200 p-3 text-sm flex justify-between gap-3">
          <span className="text-slate-600">Due {fmtDate(c.renewal.at)} · covers one {c.renewal.period === 'yearly' ? 'year' : 'month'}</span>
          <b className="tabular-nums text-slate-900">{rupees(c.renewal.total)}</b>
        </div>
        <Chips label="Payment" value={type} onChange={setType} options={[['offline', 'Paid offline'], ['free', 'Free (no invoice)']]}/>
        {type === 'offline' && (
          <div className="sm:max-w-xs">
            <label htmlFor="rn-amount" className={labelCls}>Amount received (incl. GST)</label>
            <div className="flex">
              <span className="px-3 py-2 text-sm text-slate-500 border border-r-0 border-slate-200 rounded-l-lg bg-slate-50">₹</span>
              <input id="rn-amount" type="number" min={1} step="any" value={amount} onChange={(e) => setAmount(e.target.value)} className={`${inputCls} rounded-l-none`}/>
            </div>
            {Math.abs(Number(amount) - c.renewal.total) >= 0.01 && (
              <p className="text-[11px] text-amber-700 mt-1">Differs from the amount due: the invoice shows the difference as a price adjustment.</p>
            )}
          </div>
        )}
        <ErrorNote>{error}</ErrorNote>
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className={btnGhost}>Cancel</button>
          <button type="submit" disabled={saving || (type === 'offline' && !(Number(amount) >= 1))} className={btnPrimary}>
            {saving && <Loader2 size={14} className="animate-spin"/>} {scheduled ? 'Start' : 'Record'} {type === 'offline' ? (scheduled ? 'and record payment' : 'payment') : (scheduled ? 'free' : 'free cycle')}
          </button>
        </div>
      </form>
    </Modal>
  )
}
