// CouponsTab.jsx — discount codes customers type at checkout. A coupon takes money off ONE
// "Pay once" plan purchase, before GST; it never applies to autopay. Admins create and switch them off.
import { useEffect, useState } from 'react'
import clsx from 'clsx'
import { Plus, Loader2 } from 'lucide-react'
import { PLANS } from '../../constants/pricing'
import { billingAdmin } from '../../lib/billingApi'
import DatePicker from '../DatePicker'
import { Modal, Chips, ErrorNote, fmtDate, rupees, num, inputCls, labelCls, btnPrimary, btnGhost } from './ui'

const describe = (c) => (c.type === 'percent' ? `${c.value}% off` : `${rupees(c.value)} off`)
const appliesTo = (c) => [
  c.plans.length ? c.plans.map((id) => PLANS.find((p) => p.id === id)?.name).join(', ') : 'All plans',
  c.periods.length ? c.periods.join(' / ') : 'monthly & yearly',
].join(' · ')
function stateOf(c) {
  if (!c.active) return ['Off', 'bg-slate-100 text-slate-500 border-slate-200']
  if (c.expiresAt && c.expiresAt * 1000 < Date.now()) return ['Expired', 'bg-slate-100 text-slate-500 border-slate-200']
  if (c.maxUses !== null && c.uses >= c.maxUses) return ['Used up', 'bg-amber-50 text-amber-700 border-amber-200']
  return ['Live', 'bg-emerald-50 text-emerald-700 border-emerald-200']
}

function NewCoupon({ token, onDone, onClose }) {
  const [f, setF] = useState({ code: '', type: 'percent', value: '', plans: [], period: 'all', expires: '', maxUses: '', oncePerCustomer: true, note: '' })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const set = (patch) => setF((x) => ({ ...x, ...patch }))
  const togglePlan = (id) => set({ plans: f.plans.includes(id) ? f.plans.filter((x) => x !== id) : [...f.plans, id] })

  async function submit(e) {
    e.preventDefault()
    setSaving(true); setError('')
    try {
      onDone(await billingAdmin.createCoupon(token, {
        code: f.code, type: f.type, value: Number(f.value), plans: f.plans, periods: f.period === 'all' ? [] : [f.period],
        expiresAt: f.expires ? Math.floor(new Date(`${f.expires}T23:59:59`).getTime() / 1000) : null,
        maxUses: f.maxUses ? Number(f.maxUses) : null, oncePerCustomer: f.oncePerCustomer, note: f.note,
      }))
    } catch (err) { setError(err.message); setSaving(false) }
  }

  return (
    <Modal title="New coupon" subtitle="Works on Pay once plan purchases. Discount is taken before GST." onClose={onClose}>
      <form onSubmit={submit} className="p-5 space-y-4">
        <div>
          <label htmlFor="cp-code" className={labelCls}>Code</label>
          <input id="cp-code" required value={f.code} onChange={(e) => set({ code: e.target.value.toUpperCase().replace(/\s/g, '') })} maxLength={30}
            placeholder="e.g. DIWALI20" className={clsx(inputCls, 'font-mono uppercase')}/>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <fieldset>
            <legend className={labelCls}>Discount</legend>
            <Chips label="Discount type" value={f.type} onChange={(type) => set({ type })} options={[['percent', 'Percentage'], ['flat', 'Flat ₹']]}/>
          </fieldset>
          <div>
            <label htmlFor="cp-value" className={labelCls}>{f.type === 'percent' ? 'Percent off (1–99)' : 'Rupees off'}</label>
            <input id="cp-value" required type="number" min={1} max={f.type === 'percent' ? 99 : 1000000} step={f.type === 'percent' ? 1 : 'any'}
              value={f.value} onChange={(e) => set({ value: e.target.value })} className={inputCls}/>
          </div>
        </div>
        <fieldset>
          <legend className={labelCls}>Plans <span className="font-normal text-slate-400">(none picked = all plans)</span></legend>
          <div className="flex flex-wrap gap-1.5">
            {PLANS.map((p) => (
              <button key={p.id} type="button" aria-pressed={f.plans.includes(p.id)} onClick={() => togglePlan(p.id)}
                className={clsx('px-3 py-1.5 rounded-lg text-xs font-semibold border', f.plans.includes(p.id) ? 'bg-primary text-white border-primary' : 'bg-white text-slate-600 border-slate-200')}>
                {p.name}
              </button>
            ))}
          </div>
        </fieldset>
        <fieldset>
          <legend className={labelCls}>Billing</legend>
          <Chips label="Billing period" value={f.period} onChange={(period) => set({ period })} options={[['all', 'Monthly & yearly'], ['monthly', 'Monthly only'], ['yearly', 'Yearly only']]}/>
        </fieldset>
        <div className="grid grid-cols-2 gap-3">
          <fieldset>
            <legend className={labelCls}>Expires <span className="font-normal text-slate-400">(optional)</span></legend>
            <DatePicker value={f.expires} onChange={(expires) => set({ expires })} textSize="text-sm"/>
          </fieldset>
          <div>
            <label htmlFor="cp-max" className={labelCls}>Max uses <span className="font-normal text-slate-400">(optional)</span></label>
            <input id="cp-max" type="number" min={1} value={f.maxUses} onChange={(e) => set({ maxUses: e.target.value })} placeholder="Unlimited" className={inputCls}/>
          </div>
        </div>
        <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
          <input type="checkbox" checked={f.oncePerCustomer} onChange={(e) => set({ oncePerCustomer: e.target.checked })} className="w-4 h-4 accent-primary"/>
          Each customer can use it only once
        </label>
        <div>
          <label htmlFor="cp-note" className={labelCls}>Internal note <span className="font-normal text-slate-400">(optional)</span></label>
          <input id="cp-note" value={f.note} maxLength={200} onChange={(e) => set({ note: e.target.value })} placeholder="e.g. Diwali campaign" className={inputCls}/>
        </div>
        <ErrorNote>{error}</ErrorNote>
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className={btnGhost}>Cancel</button>
          <button type="submit" disabled={saving || !f.code || !f.value} className={btnPrimary}>{saving && <Loader2 size={14} className="animate-spin"/>} Create coupon</button>
        </div>
      </form>
    </Modal>
  )
}

export default function CouponsTab({ token, canEdit }) {
  const [items, setItems] = useState(null)
  const [error, setError] = useState('')
  const [creating, setCreating] = useState(false)
  const [busy, setBusy] = useState('')

  useEffect(() => { billingAdmin.coupons(token).then((r) => setItems(r.items)).catch((e) => setError(e.message)) }, [token])

  async function toggle(c) {
    setBusy(c.code); setError('')
    try {
      const next = await billingAdmin.updateCoupon(token, { code: c.code, active: !c.active })
      setItems((list) => list.map((x) => (x.code === next.code ? next : x)))
    } catch (e) { setError(e.message) } finally { setBusy('') }
  }

  return (
    <section className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
      <div className="p-4 border-b border-slate-100 flex items-center gap-3">
        <div className="flex-1 min-w-0">
          <h2 className="text-sm font-bold text-slate-800">Coupons</h2>
          <p className="text-xs text-slate-500">Customers enter the code when they choose <b>Pay once</b>. Not available with autopay.</p>
        </div>
        {canEdit && <button type="button" onClick={() => setCreating(true)} className={btnPrimary}><Plus size={14}/> New coupon</button>}
      </div>
      {error && <div className="p-4"><ErrorNote>{error}</ErrorNote></div>}
      <div className="overflow-x-auto">
        <table className="w-full text-sm min-w-[720px]">
          <thead>
            <tr className="text-left text-[11px] uppercase tracking-wide text-slate-400 bg-slate-50">
              <th className="px-4 py-2.5 font-semibold">Code</th>
              <th className="px-3 py-2.5 font-semibold">Discount</th>
              <th className="px-3 py-2.5 font-semibold">Applies to</th>
              <th className="px-3 py-2.5 font-semibold">Used</th>
              <th className="px-3 py-2.5 font-semibold">Expires</th>
              <th className="px-3 py-2.5 font-semibold">State</th>
              <th className="px-4 py-2.5"><span className="sr-only">Actions</span></th>
            </tr>
          </thead>
          <tbody>
            {(items || []).map((c) => {
              const [label, cls] = stateOf(c)
              return (
                <tr key={c.code} className="border-t border-slate-100">
                  <td className="px-4 py-3">
                    <div className="font-mono font-semibold text-slate-800">{c.code}</div>
                    {c.note && <div className="text-[11px] text-slate-400 truncate max-w-[180px]" title={c.note}>{c.note}</div>}
                  </td>
                  <td className="px-3 py-3 text-slate-700 whitespace-nowrap">{describe(c)}</td>
                  <td className="px-3 py-3 text-slate-600 text-xs">{appliesTo(c)}{c.oncePerCustomer && <div className="text-slate-400">once per customer</div>}</td>
                  <td className="px-3 py-3 tabular-nums text-slate-700 whitespace-nowrap">{num(c.uses)}{c.maxUses !== null && <span className="text-slate-400"> / {num(c.maxUses)}</span>}</td>
                  <td className="px-3 py-3 text-slate-600 whitespace-nowrap">{c.expiresAt ? fmtDate(c.expiresAt) : 'Never'}</td>
                  <td className="px-3 py-3"><span className={clsx('inline-block text-[11px] font-semibold border rounded-md px-1.5 py-0.5', cls)}>{label}</span></td>
                  <td className="px-4 py-3 text-right">
                    {canEdit && (
                      <button type="button" disabled={busy === c.code} onClick={() => toggle(c)} className="text-xs font-semibold text-primary hover:underline disabled:opacity-50">
                        {c.active ? 'Switch off' : 'Switch on'}
                      </button>
                    )}
                  </td>
                </tr>
              )
            })}
            {items && !items.length && <tr><td colSpan={7} className="px-4 py-12 text-center text-sm text-slate-400">No coupons yet.</td></tr>}
            {!items && !error && <tr><td colSpan={7} className="px-4 py-12 text-center text-slate-400"><Loader2 size={18} className="animate-spin inline"/></td></tr>}
          </tbody>
        </table>
      </div>
      {creating && <NewCoupon token={token} onClose={() => setCreating(false)} onDone={(c) => { setItems((list) => [c, ...(list || [])]); setCreating(false) }}/>}
    </section>
  )
}
