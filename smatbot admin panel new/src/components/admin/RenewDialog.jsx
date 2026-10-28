// RenewDialog.jsx — the next cycle of a subscription staff set up: record its payment (offline, or
// free) and it runs on from the end of the current cycle, at the subscription's own prices.
import { useState } from 'react'
import clsx from 'clsx'
import { Loader2 } from 'lucide-react'
import { billingAdmin } from '../../lib/billingApi'
import DatePicker from '../DatePicker'
import Select from '../Select'
import { Modal, Chips, ErrorNote, inputCls, labelCls, btnPrimary, btnGhost, rupees, fmtDate } from './ui'

const ymd = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
const yearAgo = () => { const d = new Date(); d.setFullYear(d.getFullYear() - 1); return ymd(d) }
const METHODS = [
  { value: 'bank_transfer', label: 'Bank transfer (NEFT / RTGS / IMPS)' }, { value: 'upi', label: 'UPI' },
  { value: 'cheque', label: 'Cheque' }, { value: 'cash', label: 'Cash' }, { value: 'card_offline', label: 'Card (POS / link)' }, { value: 'other', label: 'Other' },
]

export default function RenewDialog({ token, client: c, onDone, onClose }) {
  const s = c.subscription
  const [type, setType] = useState('offline')
  const [amount, setAmount] = useState(String(c.renewal.total))
  const [method, setMethod] = useState('bank_transfer')
  const [reference, setReference] = useState('')
  const [paidOn, setPaidOn] = useState(ymd(new Date()))
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function submit(e) {
    e.preventDefault()
    setSaving(true); setError('')
    try {
      onDone(await billingAdmin.renew(token, {
        workspaceId: c.workspaceId, note,
        payment: type === 'offline'
          ? { type, amount: Number(amount), method, reference, paidAt: Math.min(Math.floor(new Date(`${paidOn}T12:00:00`).getTime() / 1000), Math.floor(Date.now() / 1000)) }
          : { type: 'free' },
      }))
    } catch (err) { setError(err.message); setSaving(false) }
  }

  return (
    <Modal title={`Record cycle ${c.renewal.cycle}${s.cycles ? ` of ${s.cycles}` : ''} · ${s.number}`} subtitle={`${c.customer || c.workspaceId} · ${c.renewal.planName}, ${c.renewal.period}`} onClose={onClose}>
      <form onSubmit={submit} className="p-5 space-y-4">
        <div className="rounded-xl bg-slate-50 border border-slate-200 p-3 text-sm flex justify-between gap-3">
          <span className="text-slate-600">Due {fmtDate(c.renewal.at)} · covers one {c.renewal.period === 'yearly' ? 'year' : 'month'}</span>
          <b className="tabular-nums text-slate-900">{rupees(c.renewal.total)}</b>
        </div>
        <Chips label="Payment" value={type} onChange={setType} options={[['offline', 'Paid offline'], ['free', 'Free (no invoice)']]}/>
        {type === 'offline' && (
          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <label htmlFor="rn-amount" className={labelCls}>Amount received, incl. GST (₹)</label>
              <input id="rn-amount" type="number" min={1} step="any" value={amount} onChange={(e) => setAmount(e.target.value)} className={inputCls}/>
            </div>
            <div><span className={labelCls}>Paid by</span><Select value={method} onChange={setMethod} options={METHODS}/></div>
            <div>
              <label htmlFor="rn-ref" className={labelCls}>Payment reference</label>
              <input id="rn-ref" value={reference} maxLength={100} onChange={(e) => setReference(e.target.value)} placeholder="UTR, cheque no., UPI ref" className={inputCls}/>
            </div>
            <div><span className={labelCls}>Received on</span><DatePicker value={paidOn} onChange={setPaidOn} min={yearAgo()} textSize="text-sm"/></div>
            {Math.abs(Number(amount) - c.renewal.total) >= 0.01 && (
              <p className="sm:col-span-2 text-[11px] text-amber-700">Differs from the amount due: the invoice shows the difference as a price adjustment.</p>
            )}
          </div>
        )}
        <div>
          <label htmlFor="rn-note" className={labelCls}>Internal note <span className="font-normal text-slate-400">(optional)</span></label>
          <input id="rn-note" value={note} maxLength={500} onChange={(e) => setNote(e.target.value)} className={inputCls}/>
        </div>
        <ErrorNote>{error}</ErrorNote>
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className={btnGhost}>Cancel</button>
          <button type="submit" disabled={saving || (type === 'offline' && !(Number(amount) >= 1))} className={clsx(btnPrimary)}>
            {saving && <Loader2 size={14} className="animate-spin"/>} Record {type === 'offline' ? 'payment' : 'free cycle'}
          </button>
        </div>
      </form>
    </Modal>
  )
}
