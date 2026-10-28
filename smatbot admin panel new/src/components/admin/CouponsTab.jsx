// CouponsTab.jsx — discount codes customers type at checkout. A coupon takes money off ONE "Pay once"
// plan purchase, before GST; it never applies to autopay. Admins create them (a full page, laid out
// like the rest of the billing tools: name and code, discount, who it applies to, validity) and switch
// them off. Support staff can only look.
import { useEffect, useState } from 'react'
import clsx from 'clsx'
import { Plus, Loader2, ArrowLeft, Info, X } from 'lucide-react'
import { billingAdmin } from '../../lib/billingApi'
import DatePicker from '../DatePicker'
import Select from '../Select'
import { ErrorNote, fmtDate, rupees, num, inputCls, btnPrimary, btnGhost } from './ui'

const describe = (c) => (c.type === 'percent' ? `${c.value}% off` : `${rupees(c.value)} off`)
const addonsText = (c, addonDefs) => (c.addons == null ? 'All add-ons' : c.addons.length ? c.addons.map((id) => addonDefs.find((a) => a.id === id)?.name || id).join(', ') : 'Plan only')
const appliesTo = (c, plans, addonDefs) => [
  c.plans.length ? c.plans.map((id) => plans.find((p) => p.id === id)?.name || id).join(', ') : 'All plans',
  addonsText(c, addonDefs),
  c.periods.length ? c.periods.join(' / ') : 'monthly & yearly',
].join(' · ')
function stateOf(c) {
  if (!c.active) return ['Off', 'bg-slate-100 text-slate-500 border-slate-200']
  if (c.expiresAt && c.expiresAt * 1000 < Date.now()) return ['Expired', 'bg-slate-100 text-slate-500 border-slate-200']
  if (c.maxUses !== null && c.uses >= c.maxUses) return ['Used up', 'bg-amber-50 text-amber-700 border-amber-200']
  return ['Live', 'bg-emerald-50 text-emerald-700 border-emerald-200']
}

/* A label on the left, the control on the right (stacked on phones). */
function Row({ id, label, required, tip, children }) {
  return (
    <div className="grid sm:grid-cols-[150px_minmax(0,1fr)] gap-1 sm:gap-3 items-start">
      <label htmlFor={id} className={clsx('text-sm sm:pt-2', required ? 'text-red-600' : 'text-slate-700')}>{label}{required && '*'}</label>
      <div className="flex items-start gap-2 min-w-0">
        <div className="flex-1 min-w-0">{children}</div>
        {tip && <span title={tip} aria-label={tip} className="mt-2.5 text-slate-400"><Info size={14}/></span>}
      </div>
    </div>
  )
}

/* Pick all of them, or choose some. */
function Chosen({ options, value, onChange }) {
  return (
    <div className="flex flex-wrap gap-1.5 mt-2">
      {options.map((o) => (
        <button key={o.id} type="button" aria-pressed={value.includes(o.id)} onClick={() => onChange(value.includes(o.id) ? value.filter((x) => x !== o.id) : [...value, o.id])}
          className={clsx('px-3 py-1.5 rounded-lg text-xs font-semibold border', value.includes(o.id) ? 'bg-primary text-white border-primary' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50')}>
          {o.name}
        </button>
      ))}
    </div>
  )
}

function NewCoupon({ token, plans, addonDefs, onDone, onClose }) {
  const [f, setF] = useState({
    name: '', code: '', type: 'flat', value: '', redemption: 'once', planMode: 'all', plans: [], addonMode: 'all', addons: [], period: 'all', expires: '', maxUses: '',
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const set = (patch) => setF((x) => ({ ...x, ...patch }))
  const planShown = plans.filter((p) => p.status === 'active')
  const addonShown = addonDefs.filter((a) => (a.status ?? 'active') === 'active')
  const missing = (f.planMode === 'some' && !f.plans.length) || (f.addonMode === 'some' && !f.addons.length)

  async function submit(e) {
    e.preventDefault()
    setSaving(true); setError('')
    try {
      onDone(await billingAdmin.createCoupon(token, {
        name: f.name, code: f.code, type: f.type, value: Number(f.value),
        plans: f.planMode === 'all' ? [] : f.plans, periods: f.period === 'all' ? [] : [f.period],
        addons: f.addonMode === 'all' ? null : f.addonMode === 'none' ? [] : f.addons,
        expiresAt: f.expires ? Math.floor(new Date(`${f.expires}T23:59:59`).getTime() / 1000) : null,
        maxUses: f.maxUses ? Number(f.maxUses) : null, oncePerCustomer: f.redemption === 'once',
      }))
    } catch (err) { setError(err.message); setSaving(false) }
  }

  return (
    <form onSubmit={submit} className="bg-white border border-slate-200 rounded-2xl overflow-hidden max-w-5xl">
      <div className="bg-slate-50 border-b border-slate-200 px-6 py-5 space-y-4">
        <div className="grid lg:grid-cols-2 gap-x-10 gap-y-4">
          <Row id="cp-name" label="Coupon name" required>
            <input id="cp-name" required autoFocus value={f.name} maxLength={60} onChange={(e) => set({ name: e.target.value })} placeholder="e.g. Diwali offer" className={inputCls}/>
          </Row>
          <Row id="cp-code" label="Coupon code" required tip="What customers type at checkout: 3–30 letters, digits, - or _.">
            <input id="cp-code" required value={f.code} onChange={(e) => set({ code: e.target.value.toUpperCase().replace(/\s/g, '') })} maxLength={30}
              placeholder="e.g. DIWALI20" className={clsx(inputCls, 'font-mono uppercase')}/>
          </Row>
          <Row id="cp-value" label={f.type === 'flat' ? 'Discount (INR)' : 'Discount (%)'} required>
            <div className="flex">
              <input id="cp-value" required type="number" min={1} max={f.type === 'percent' ? 99 : 1000000} step={f.type === 'percent' ? 1 : 'any'}
                value={f.value} onChange={(e) => set({ value: e.target.value })} className={clsx(inputCls, 'rounded-r-none')}/>
              <select aria-label="Discount type" value={f.type} onChange={(e) => set({ type: e.target.value, value: '' })}
                className="border border-l-0 border-slate-200 rounded-r-lg bg-slate-50 px-2 text-sm text-slate-700 outline-none focus:border-primary">
                <option value="flat">Flat</option><option value="percent">%</option>
              </select>
            </div>
          </Row>
          <Row id="cp-redeem" label="Redemption type" required tip="One-time: each customer can use the code once. Any number of times: they can use it on every Pay once purchase.">
            <Select value={f.redemption} onChange={(redemption) => set({ redemption })}
              options={[{ value: 'once', label: 'One-Time', sub: 'once per customer' }, { value: 'many', label: 'Any number of times' }]}/>
          </Row>
        </div>
        <p className="text-xs text-slate-500 flex items-start gap-1.5"><Info size={13} className="mt-px flex-shrink-0"/> A coupon works on <b>Pay once</b> plan purchases, and the discount is taken before GST. It never applies to autopay.</p>
      </div>

      <div className="px-6 py-6 space-y-8">
        <section className="space-y-4">
          <h3 className="text-base font-bold text-slate-900">Applicability</h3>
          <div className="max-w-xl space-y-4">
            <Row id="cp-plans" label="Associate plans" required>
              <Select value={f.planMode} onChange={(planMode) => set({ planMode })} options={[{ value: 'all', label: 'All plans' }, { value: 'some', label: 'Selected plans' }]}/>
              {f.planMode === 'some' && <Chosen options={planShown} value={f.plans} onChange={(plans) => set({ plans })}/>}
            </Row>
            <Row id="cp-addons" label="Associate add-ons" required tip="The discount is taken off the plan and the add-ons chosen here.">
              <Select value={f.addonMode} onChange={(addonMode) => set({ addonMode })}
                options={[{ value: 'all', label: 'All add-ons' }, { value: 'none', label: 'No add-ons (the plan only)' }, { value: 'some', label: 'Selected add-ons' }]}/>
              {f.addonMode === 'some' && <Chosen options={addonShown} value={f.addons} onChange={(addons) => set({ addons })}/>}
            </Row>
            <Row id="cp-period" label="Billing period" required>
              <Select value={f.period} onChange={(period) => set({ period })} options={[{ value: 'all', label: 'Monthly & yearly' }, { value: 'monthly', label: 'Monthly only' }, { value: 'yearly', label: 'Yearly only' }]}/>
            </Row>
          </div>
        </section>

        <hr className="border-slate-200"/>

        <section className="space-y-4">
          <h3 className="text-base font-bold text-slate-900">Validity</h3>
          <div className="grid lg:grid-cols-2 gap-x-10 gap-y-4">
            <Row id="cp-expiry" label="Expiration date">
              <div className="flex items-center gap-2">
                <DatePicker value={f.expires} onChange={(expires) => set({ expires })} textSize="text-sm" className="flex-1"/>
                {f.expires && <button type="button" onClick={() => set({ expires: '' })} aria-label="Clear the expiration date" className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100"><X size={14}/></button>}
              </div>
            </Row>
            <Row id="cp-max" label="Maximum redemptions" tip="Across all customers. Leave empty for no limit.">
              <input id="cp-max" type="number" min={1} value={f.maxUses} onChange={(e) => set({ maxUses: e.target.value })} placeholder="Enter a number" className={inputCls}/>
            </Row>
          </div>
        </section>

        <ErrorNote>{error || (missing ? 'Choose at least one plan or add-on, or switch to “All”.' : '')}</ErrorNote>
        <div className="flex gap-2">
          <button type="submit" disabled={saving || missing || !f.name.trim() || !f.code || !f.value} className={btnPrimary}>{saving && <Loader2 size={14} className="animate-spin"/>} Save</button>
          <button type="button" onClick={onClose} className={btnGhost}>Cancel</button>
        </div>
      </div>
    </form>
  )
}

export default function CouponsTab({ token, canEdit, plans, addonDefs }) {
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

  if (creating) {
    return (
      <div className="space-y-4">
        <button type="button" onClick={() => setCreating(false)} className="inline-flex items-center gap-1.5 text-sm font-semibold text-slate-600 hover:text-slate-900"><ArrowLeft size={15}/> All coupons</button>
        <h2 className="text-lg font-bold text-slate-900">New coupon</h2>
        <NewCoupon token={token} plans={plans} addonDefs={addonDefs} onClose={() => setCreating(false)} onDone={(c) => { setItems((list) => [c, ...(list || [])]); setCreating(false) }}/>
      </div>
    )
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
        <table className="w-full text-sm min-w-[760px]">
          <thead>
            <tr className="text-left text-[11px] uppercase tracking-wide text-slate-400 bg-slate-50">
              <th className="px-4 py-2.5 font-semibold">Coupon</th>
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
                    {c.name && <div className="font-semibold text-slate-800 truncate max-w-[200px]">{c.name}</div>}
                    <div className={clsx('font-mono', c.name ? 'text-xs text-slate-500' : 'font-semibold text-slate-800')}>{c.code}</div>
                  </td>
                  <td className="px-3 py-3 text-slate-700 whitespace-nowrap">{describe(c)}</td>
                  <td className="px-3 py-3 text-slate-600 text-xs max-w-[280px]">{appliesTo(c, plans, addonDefs)}<div className="text-slate-400">{c.oncePerCustomer ? 'one-time per customer' : 'any number of times'}</div></td>
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
    </section>
  )
}
