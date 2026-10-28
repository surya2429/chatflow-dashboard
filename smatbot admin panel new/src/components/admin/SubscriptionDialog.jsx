// SubscriptionDialog.jsx — staff set up a client's subscription, laid out like a recurring invoice:
// the client and the subscription's details; a line for the plan and one per add-on (quantity, price,
// discount, tax, amount); a discount per line or on the total; the payment; then the client's tax
// details, addresses, contact persons, remarks and files. One cycle is billed now; each next one is
// recorded from Renewals at these prices until it expires after N cycles (or never). The totals are
// the server's own quote — exactly what will be invoiced. Admins only. A dialog, or (inline) a card
// on the Add subscription page.
import { useEffect, useRef, useState } from 'react'
import clsx from 'clsx'
import { Loader2, Plus, X, ArrowDown } from 'lucide-react'
import { billingAdmin } from '../../lib/billingApi'
import DatePicker from '../DatePicker'
import Select from '../Select'
import ClientDocuments from './ClientDocuments'
import { Modal, Chips, ErrorNote, inputCls, btnPrimary, btnGhost, rupees, fmtDate } from './ui'

const ymd = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
const today = () => ymd(new Date())
const startOfDay = (s) => Math.floor(new Date(`${s}T00:00:00`).getTime() / 1000)
const yearAgo = () => { const d = new Date(); d.setFullYear(d.getFullYear() - 1); return ymd(d) }
const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40)
const money = (n) => Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const METHODS = [
  { value: 'bank_transfer', label: 'Bank transfer (NEFT / RTGS / IMPS)' }, { value: 'upi', label: 'UPI' },
  { value: 'cheque', label: 'Cheque' }, { value: 'cash', label: 'Cash' }, { value: 'card_offline', label: 'Card (POS / link)' }, { value: 'other', label: 'Other' },
]
const GST_TREATMENTS = [
  { value: 'registered', label: 'Registered business – regular' }, { value: 'unregistered', label: 'Unregistered business' },
  { value: 'consumer', label: 'Consumer' }, { value: 'sez', label: 'Special economic zone (SEZ)' }, { value: 'overseas', label: 'Overseas' },
]
const TERMS = [[0, 'Due on receipt'], [7, 'Net 7'], [15, 'Net 15'], [30, 'Net 30'], [45, 'Net 45'], [60, 'Net 60']].map(([value, label]) => ({ value, label }))
const DISCOUNT_MODES = [{ value: 'none', label: 'No discounts' }, { value: 'item', label: 'Item-level' }, { value: 'total', label: 'Transaction-level' }]
const EMPTY_ADDR = { attention: '', line1: '', line2: '', city: '', stateCode: '', pincode: '' }
const EMPTY_PROFILE = {
  legalName: '', contactName: '', email: '', phone: '', gstin: '', gstTreatment: 'unregistered', pan: '', taxExempt: false, paymentTerms: 0,
  address: EMPTY_ADDR, shipping: EMPTY_ADDR, contacts: [],
}
const TABS = [['other', 'Other details'], ['address', 'Address'], ['contacts', 'Contact persons'], ['remarks', 'Remarks'], ['files', 'Documents']]
const hasGstin = (t) => t === 'registered' || t === 'sez'
/** Which tab a field error from the server belongs to (none: it's in the top section). */
const tabOf = (f) => (f.startsWith('address.') || f.startsWith('shipping.') ? 'address' : f.startsWith('contacts') ? 'contacts'
  : ['gstin', 'gstTreatment', 'pan', 'paymentTerms'].includes(f) ? 'other' : null)
const fromProfile = (p) => ({
  legalName: p.legalName, contactName: p.contactName, email: p.email, phone: p.phone, gstin: p.gstin || '',
  gstTreatment: p.gstTreatment || (p.gstin ? 'registered' : 'unregistered'), pan: p.pan || '', taxExempt: Boolean(p.taxExempt), paymentTerms: p.paymentTerms ?? 0,
  address: { ...EMPTY_ADDR, ...p.address, attention: p.address.attention || '', line2: p.address.line2 || '' },
  shipping: p.shipping ? { ...EMPTY_ADDR, ...p.shipping, attention: p.shipping.attention || '', line2: p.shipping.line2 || '' } : EMPTY_ADDR,
  contacts: (p.contacts || []).map((c) => ({ name: c.name, email: c.email || '', phone: c.phone || '', role: c.role || '' })),
})
let nextKey = 0
const newRow = (id = '', qty = 1) => ({ key: ++nextKey, id, qty })

/* A label on the left, the control on the right (stacked on phones). */
function Row({ id, label, required, error, hint, children }) {
  return (
    <div className="grid sm:grid-cols-[150px_minmax(0,1fr)] gap-1 sm:gap-3 items-start">
      <label htmlFor={id} className={clsx('text-sm sm:pt-2', required ? 'text-red-600' : 'text-slate-600')}>{label}{required && '*'}</label>
      <div className="min-w-0">
        {children}
        {error && <p className="text-[11px] text-red-600 mt-1">{error}</p>}
        {hint && !error && <p className="text-[11px] text-slate-400 mt-1">{hint}</p>}
      </div>
    </div>
  )
}

function AddressFields({ prefix, value, onChange, states, fe }) {
  const set = (k, v) => onChange({ ...value, [k]: v })
  return (
    <div className="space-y-3">
      <Row id={`${prefix}-att`} label="Attention" error={fe(`${prefix}.attention`)}>
        <input id={`${prefix}-att`} value={value.attention} onChange={(e) => set('attention', e.target.value)} className={inputCls}/>
      </Row>
      <Row id={`${prefix}-l1`} label="Address" error={fe(`${prefix}.line1`) || fe(`${prefix}.line2`)}>
        <input id={`${prefix}-l1`} value={value.line1} onChange={(e) => set('line1', e.target.value)} placeholder="Street 1" className={inputCls}/>
        <input aria-label="Street 2" value={value.line2} onChange={(e) => set('line2', e.target.value)} placeholder="Street 2" className={clsx(inputCls, 'mt-2')}/>
      </Row>
      <Row id={`${prefix}-city`} label="City" error={fe(`${prefix}.city`)}>
        <input id={`${prefix}-city`} value={value.city} onChange={(e) => set('city', e.target.value)} className={inputCls}/>
      </Row>
      <Row id={`${prefix}-state`} label="State" error={fe(`${prefix}.stateCode`)}>
        <Select value={value.stateCode} onChange={(v) => set('stateCode', v)} placeholder="Select or type to search" options={states.map((s) => ({ value: s.code, label: `[${s.code}] ${s.name}` }))}/>
      </Row>
      <Row id={`${prefix}-pin`} label="PIN code" error={fe(`${prefix}.pincode`)}>
        <input id={`${prefix}-pin`} inputMode="numeric" maxLength={6} value={value.pincode} onChange={(e) => set('pincode', e.target.value.replace(/\D/g, ''))} className={inputCls}/>
      </Row>
    </div>
  )
}

/* The service badge and SAC code shown under each line, as on the invoice. */
const Sac = ({ sac }) => (
  <div className="mt-1.5 flex items-center gap-1.5 text-[11px] text-slate-500">
    <span className="px-1 py-px rounded bg-emerald-600 text-white text-[9px] font-bold tracking-wide">SERVICE</span>SAC: <span className="text-primary">{sac}</span>
  </div>
)

const cellInput = 'w-full border border-transparent hover:border-slate-200 focus:border-primary rounded-md px-2 py-1.5 text-sm text-right outline-none bg-transparent tabular-nums'
const th = 'px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500 border-b border-slate-200'
const td = 'px-3 py-3 align-top border-b border-slate-100'

/* The %-or-₹ discount on one line. */
function LineDiscount({ label, value, onChange }) {
  return (
    <div className="flex items-center gap-1">
      <input type="number" min={0} step="any" aria-label={`Discount on ${label}`} value={value.value} placeholder="0"
        onChange={(e) => onChange({ ...value, value: e.target.value })} className={clsx(cellInput, 'w-16')}/>
      <select aria-label={`Discount type for ${label}`} value={value.type} onChange={(e) => onChange({ ...value, type: e.target.value })}
        className="border border-slate-200 rounded-md px-1 py-1 text-xs bg-slate-50 outline-none focus:border-primary">
        <option value="percent">%</option><option value="flat">₹</option>
      </select>
    </div>
  )
}

/* The Add subscription page shows the form as a card instead of a dialog. */
function Card({ title, subtitle, children }) {
  return (
    <section className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
      <div className="px-5 py-4 border-b border-slate-100">
        <h2 className="text-base font-bold text-slate-900">{title}</h2>
        {subtitle && <div className="text-xs text-slate-500 mt-0.5">{subtitle}</div>}
      </div>
      {children}
    </section>
  )
}

export default function SubscriptionDialog({ token, initial, plans: allPlans, addonDefs, states, sac = '998314', onDone, onClose, inline }) {
  const Shell = inline ? Card : Modal
  // Plans on sale (public or private), plus the one the client is on even if it is archived.
  const plans = allPlans.filter((p) => p.status === 'active' || p.id === initial?.plan)
  const isNew = !initial?.workspaceId
  const [ws, setWs] = useState(initial?.workspaceId || '')
  const [wsTouched, setWsTouched] = useState(false)
  const [prof, setProf] = useState(EMPTY_PROFILE)
  const [client, setClient] = useState(null)        // the full client record once loaded
  const [team, setTeam] = useState([])
  const [plan, setPlan] = useState(initial?.plan || 'standard')
  const [period, setPeriod] = useState(initial?.period || 'monthly')
  const [rows, setRows] = useState(() => (initial?.addons?.length ? initial.addons.map((a) => newRow(a.id, a.qty)) : [newRow()]))
  const [prices, setPrices] = useState({})          // { plan | addonId: '₹ per cycle' } — only the ones staff changed
  const [start, setStart] = useState('now')         // now · date · after_current
  const [startDate, setStartDate] = useState(today())
  const [never, setNever] = useState(true)
  const [expiresAfter, setExpiresAfter] = useState('12')
  const [reference, setReference] = useState('')
  const [salesperson, setSalesperson] = useState('')
  const [discMode, setDiscMode] = useState('none')
  const [discountRenews, setDiscountRenews] = useState(true)
  const [itemDisc, setItemDisc] = useState({})       // { plan | addonId: { type, value } }
  const [totalDisc, setTotalDisc] = useState({ name: 'Manual discount', type: 'flat', value: '' })
  const [offline, setOffline] = useState(true)
  const [amount, setAmount] = useState('')
  const [amountTouched, setAmountTouched] = useState(false)
  const [method, setMethod] = useState('bank_transfer')
  const [payRef, setPayRef] = useState('')
  const [paidOn, setPaidOn] = useState(today())
  const [remarks, setRemarks] = useState('')
  const [note, setNote] = useState('')
  const [tab, setTab] = useState('other')
  const [stopAutopay, setStopAutopay] = useState(false)
  const [quote, setQuote] = useState(null)
  const [quoteError, setQuoteError] = useState('')
  const [fields, setFields] = useState({})
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const quoteSeq = useRef(0)

  // An existing client: their details, and the terms of the subscription staff set up last time.
  useEffect(() => {
    if (isNew) return
    billingAdmin.customer(token, initial.workspaceId).then((c) => {
      setClient(c)
      if (c.profile) setProf(fromProfile(c.profile))
      const s = c.staffSub
      if (s) {
        setNever(s.cycles === null); if (s.cycles) setExpiresAfter(String(s.cycles))
        setReference(s.reference || ''); setSalesperson(s.salesperson || ''); setRemarks(s.remarks || ''); setDiscountRenews(s.discountRenews)
        const total = s.discounts.find((d) => d.target === 'total')
        if (total) { setDiscMode('total'); setTotalDisc({ name: total.name || 'Manual discount', type: total.type, value: String(total.value) }) }
        else if (s.discounts.length) { setDiscMode('item'); setItemDisc(Object.fromEntries(s.discounts.map((d) => [d.target, { type: d.type, value: String(d.value) }]))) }
      }
      // their own prices where they differ from today's list
      if (c.prices && c.plan === initial.plan && c.period === initial.period) {
        const list = (id) => (id === 'plan' ? allPlans.find((p) => p.id === c.plan) : addonDefs.find((a) => a.id === id))?.[c.period]
        setPrices(Object.fromEntries(Object.entries(c.prices).filter(([id, v]) => v !== list(id)).map(([id, v]) => [id, String(v)])))
      }
    }).catch((e) => setError(e.message))
  }, [token, initial?.workspaceId, isNew])   // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    billingAdmin.staff(token).then((s) => setTeam([{ email: s.owner.email, name: 'Owner' }, ...s.items.filter((x) => x.active)])).catch(() => setTeam([]))
  }, [token])

  const setP = (k, v) => setProf((p) => ({ ...p, [k]: v }))
  const planDef = plans.find((p) => p.id === plan)
  const eligible = addonDefs.filter((a) => a.plans.includes(plan) && (a.status ?? 'active') === 'active')
  const chosen = rows.filter((r) => r.id && eligible.some((a) => a.id === r.id)).map((r) => ({ id: r.id, qty: r.qty }))
  const listPrice = (id) => (id === 'plan' ? planDef?.[period] : addonDefs.find((a) => a.id === id)?.[period]) ?? 0
  const priceOf = (id) => prices[id] ?? String(listPrice(id))
  const canContinue = client && ['active', 'past_due'].includes(client.status) && client.plan === plan && client.currentEnd
  const unit = period === 'yearly' ? 'year' : 'month'

  const discounts = discMode === 'item'
    ? Object.entries(itemDisc).filter(([t, d]) => Number(d.value) > 0 && (t === 'plan' || chosen.some((a) => a.id === t))).map(([target, d]) => ({ target, type: d.type, value: Number(d.value) }))
    : discMode === 'total' && Number(totalDisc.value) > 0 ? [{ target: 'total', type: totalDisc.type, value: Number(totalDisc.value), name: totalDisc.name }] : []
  const sentPrices = Object.fromEntries(Object.entries(prices).filter(([k, v]) => v !== '' && (k === 'plan' || chosen.some((a) => a.id === k))).map(([k, v]) => [k, Number(v)]))
  const sub = {
    workspaceId: ws.trim(), plan, period, addons: chosen, prices: sentPrices, discounts, discountRenews,
    expiresAfter: never ? null : Math.max(1, parseInt(expiresAfter, 10) || 1),
    start: start === 'after_current' ? 'after_current' : 'now', ...(start === 'date' ? { startDate: startOfDay(startDate) } : {}),
  }
  const subKey = JSON.stringify([sub, prof.taxExempt, prof.address.stateCode])

  // Ask the server for the price whenever the subscription changes (it decides every amount).
  useEffect(() => {
    const seq = ++quoteSeq.current
    const timer = setTimeout(() => {
      billingAdmin.quote(token, { ...sub, profile: { taxExempt: prof.taxExempt, address: { stateCode: prof.address.stateCode } } })
        .then((q) => { if (seq === quoteSeq.current) { setQuote(q); setQuoteError('') } })
        .catch((e) => { if (seq === quoteSeq.current) { setQuote(null); setQuoteError(e.message) } })
    }, 250)
    return () => clearTimeout(timer)
  }, [subKey])   // eslint-disable-line react-hooks/exhaustive-deps

  // The amount received follows the price until staff type their own.
  useEffect(() => { if (quote && !amountTouched) setAmount(String(quote.charge.total)) }, [quote, amountTouched])

  function changePlan(id) {
    setPlan(id)
    setPrices(({ plan: _old, ...rest }) => rest)
    const ok = addonDefs.filter((a) => a.plans.includes(id)).map((a) => a.id)
    setRows((rs) => { const kept = rs.filter((r) => !r.id || ok.includes(r.id)); return kept.length ? kept : [newRow()] })
  }
  function changePeriod(p) { setPeriod(p); setPrices({}) }   // typed prices are per cycle, so they start over
  const setRow = (key, patch) => setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...patch } : r)))
  const removeRow = (key) => setRows((rs) => { const left = rs.filter((r) => r.key !== key); return left.length ? left : [newRow()] })

  /** What a line comes to before GST, as the form shows it (the server's quote has the final word). */
  function lineAmount(id, qty) {
    const gross = (Number(priceOf(id)) || 0) * qty
    const d = discMode === 'item' && itemDisc[id]
    const off = d && Number(d.value) > 0 ? (d.type === 'percent' ? (gross * Number(d.value)) / 100 : Number(d.value)) : 0
    return Math.max(0, gross - off)
  }

  async function submit(e) {
    e.preventDefault()
    setSaving(true); setError(''); setFields({})
    try {
      const row = await billingAdmin.plan(token, {
        ...sub, reference, salesperson, remarks, note, stopAutopay,
        profile: { ...prof, gstin: hasGstin(prof.gstTreatment) ? prof.gstin : '' },
        payment: offline
          ? { type: 'offline', amount: Number(amount), method, reference: payRef, paidAt: Math.min(startOfDay(paidOn) + 12 * 3600, Math.floor(Date.now() / 1000)) }
          : { type: 'free' },
      })
      onDone(row)
    } catch (err) {
      if (err.fields) {
        setFields(err.fields)
        const t = Object.keys(err.fields).map(tabOf).find(Boolean)
        if (t) setTab(t)
      }
      setError(err.message)
      setSaving(false)
    }
  }

  const fe = (k) => fields[k]
  const autopayOn = quote?.autopayRunning
  const blocked = saving || !ws.trim() || !quote || (autopayOn && !stopAutopay) || (offline && !(Number(amount) >= 1))
  const tax = prof.taxExempt ? 'Exempt' : `GST${quote?.charge.gstPercent ?? 18} [${quote?.charge.gstPercent ?? 18}%]`
  const subNumber = start === 'after_current' && client?.staffSub?.number
  const tabErrors = (t) => Object.keys(fields).some((f) => tabOf(f) === t)
  const lines = quote?.charge.lines ?? []
  const subtotal = lines.filter((l) => l.kind === 'plan' || l.kind === 'addon').reduce((n, l) => n + l.amount, 0)

  return (
    <Shell wide title={isNew ? 'New subscription' : `Subscription · ${initial.customer || initial.workspaceId}`}
      subtitle="One cycle is billed now; each next one is recorded from Renewals. Every offline payment gets a GST invoice." onClose={onClose}>
      <form onSubmit={submit} className="flex flex-col min-h-full">
        <div className="p-5 space-y-7 flex-1">
          {/* ── client and subscription ── */}
          <div className="grid lg:grid-cols-2 gap-x-10 gap-y-3">
            <div className="space-y-3">
              <Row id="sd-company" label="Customer name" required error={fe('legalName')}>
                <input id="sd-company" value={prof.legalName} className={inputCls} placeholder="Company or legal name"
                  onChange={(e) => { setP('legalName', e.target.value); if (isNew && !wsTouched) setWs(slug(e.target.value)) }}/>
              </Row>
              <Row id="sd-ws" label="Workspace ID" required hint={isNew ? 'Their SmatBot workspace' : undefined}>
                <input id="sd-ws" value={ws} disabled={!isNew} className={clsx(inputCls, 'font-mono')} placeholder="e.g. sharma-traders"
                  onChange={(e) => { setWs(e.target.value); setWsTouched(true) }}/>
              </Row>
              <Row id="sd-contact" label="Contact person" required error={fe('contactName')}>
                <input id="sd-contact" value={prof.contactName} onChange={(e) => setP('contactName', e.target.value)} className={inputCls}/>
              </Row>
              <Row id="sd-email" label="Email" required error={fe('email')}>
                <input id="sd-email" type="email" value={prof.email} onChange={(e) => setP('email', e.target.value)} className={inputCls}/>
              </Row>
              <Row id="sd-phone" label="Mobile" required error={fe('phone')}>
                <div className="flex">
                  <span className="px-3 py-2 text-sm text-slate-500 border border-r-0 border-slate-200 rounded-l-lg bg-slate-50">+91</span>
                  <input id="sd-phone" inputMode="numeric" value={prof.phone} onChange={(e) => setP('phone', e.target.value)} className={clsx(inputCls, 'rounded-l-none')}/>
                </div>
              </Row>
            </div>
            <div className="space-y-3">
              <Row id="sd-number" label="Subscription number">
                <input id="sd-number" readOnly value={subNumber || 'Assigned when saved'} className={clsx(inputCls, 'bg-slate-50 text-slate-500')}/>
              </Row>
              <Row id="sd-start" label="Start date">
                <Chips label="Start" value={start} onChange={setStart}
                  options={[['now', 'Today'], ['date', 'On a past date'], ...(canContinue ? [['after_current', `After current (${fmtDate(client.currentEnd)})`]] : [])]}/>
                {start === 'date' && <div className="mt-2 w-56"><DatePicker value={startDate} onChange={setStartDate} min={yearAgo()} textSize="text-sm"/></div>}
              </Row>
              <Row id="sd-period" label="Bills every">
                <Chips label="Billing period" value={period} onChange={changePeriod} options={[['monthly', 'Month'], ['yearly', 'Year']]}/>
              </Row>
              <Row id="sd-expires" label="Expires after" hint={never ? 'Renews every cycle until it is cancelled.' : `Ends after ${expiresAfter || 1} ${period === 'yearly' ? 'years' : 'months'}.`}>
                <div className="flex">
                  <input id="sd-expires" type="number" min={1} max={120} disabled={never} value={never ? '' : expiresAfter}
                    onChange={(e) => setExpiresAfter(e.target.value)} className={clsx(inputCls, 'rounded-r-none')}/>
                  <span className="px-3 py-2 text-sm text-slate-500 border border-l-0 border-slate-200 rounded-r-lg bg-slate-50">cycles</span>
                </div>
                <label className="mt-1.5 inline-flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
                  <input type="checkbox" checked={never} onChange={(e) => setNever(e.target.checked)} className="w-4 h-4 accent-primary"/> Never expires
                </label>
              </Row>
              <Row id="sd-ref" label="Reference number">
                <input id="sd-ref" value={reference} maxLength={50} onChange={(e) => setReference(e.target.value)} placeholder="PO or order number" className={inputCls}/>
              </Row>
              <Row id="sd-sales" label="Salesperson">
                <Select value={salesperson} onChange={setSalesperson} placeholder="Select a salesperson"
                  options={[{ value: '', label: 'None' }, ...team.map((s) => ({ value: s.email, label: s.name ? `${s.name} (${s.email})` : s.email }))]}/>
              </Row>
            </div>
          </div>

          {/* ── items ── */}
          <section className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <div className="w-48"><Select size="sm" value={discMode} onChange={setDiscMode} options={DISCOUNT_MODES}/></div>
              {discMode !== 'none' && (
                <div className="w-48"><Select size="sm" value={discountRenews ? 'every' : 'first'} onChange={(v) => setDiscountRenews(v === 'every')}
                  options={[{ value: 'every', label: 'Every renewal' }, { value: 'first', label: 'First cycle only' }]}/></div>
              )}
            </div>

            <div className="overflow-x-auto border border-slate-200 rounded-xl">
              <table className="w-full text-sm min-w-[820px]">
                <thead className="bg-slate-50 text-left">
                  <tr>
                    <th className={th}>Plan name</th><th className={clsx(th, 'text-right w-24')}>Quantity</th><th className={clsx(th, 'text-right w-32')}>Price</th>
                    {discMode === 'item' && <th className={clsx(th, 'w-36')}>Discount</th>}
                    <th className={clsx(th, 'w-32')}>Tax</th><th className={clsx(th, 'text-right w-36')}>Amount</th><th className={clsx(th, 'w-10')}/>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td className={td}>
                      <Select value={plan} onChange={changePlan} options={plans.map((p) => ({ value: p.id, label: p.name, sub: `${rupees(p[period])} / ${unit}` }))}/>
                      <p className="text-xs text-slate-400 mt-1.5">SmatBot {planDef?.name} plan — billed every {unit}</p>
                      <Sac sac={sac}/>
                    </td>
                    <td className={clsx(td, 'text-right tabular-nums pt-5')}>1.00</td>
                    <td className={td}>
                      <input type="number" min={0} step="any" aria-label="Plan price" value={priceOf('plan')} onChange={(e) => setPrices((x) => ({ ...x, plan: e.target.value }))} className={cellInput}/>
                      {prices.plan !== undefined && Number(prices.plan) !== listPrice('plan') && <p className="text-[10px] text-slate-400 text-right pr-2">list {rupees(listPrice('plan'))}</p>}
                    </td>
                    {discMode === 'item' && <td className={td}><LineDiscount label="the plan" value={itemDisc.plan || { type: 'percent', value: '' }} onChange={(d) => setItemDisc((x) => ({ ...x, plan: d }))}/></td>}
                    <td className={clsx(td, 'pt-5 text-slate-600')}>{tax}</td>
                    <td className={clsx(td, 'text-right pt-5')}>
                      <div className="font-semibold tabular-nums">Rs. {money(lineAmount('plan', 1))}</div>
                      <div className="text-[11px] text-slate-400">per {unit}</div>
                    </td>
                    <td className={td}/>
                  </tr>
                </tbody>
              </table>
            </div>

            <div>
              <h3 className="text-sm font-semibold text-slate-700 mb-2">Add-ons</h3>
              <div className="overflow-x-auto border border-slate-200 rounded-xl">
                <table className="w-full text-sm min-w-[820px]">
                  <thead className="bg-slate-50 text-left">
                    <tr>
                      <th className={th}>Add-on name</th><th className={clsx(th, 'text-right w-24')}>Quantity</th><th className={clsx(th, 'text-right w-32')}>Price</th>
                      {discMode === 'item' && <th className={clsx(th, 'w-36')}>Discount</th>}
                      <th className={clsx(th, 'w-32')}>Tax</th><th className={clsx(th, 'text-right w-36')}>Amount</th><th className={clsx(th, 'w-10')}/>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r) => {
                      const def = eligible.find((a) => a.id === r.id)
                      const taken = rows.filter((x) => x.key !== r.key).map((x) => x.id)
                      return (
                        <tr key={r.key}>
                          <td className={td}>
                            <Select value={r.id} onChange={(id) => setRow(r.key, { id, qty: 1 })} placeholder="Type or click to select an add-on"
                              options={eligible.filter((a) => !taken.includes(a.id)).map((a) => ({ value: a.id, label: a.name, sub: `${rupees(a[period])} / ${unit} · ${a.unit}` }))}/>
                            {def && <><p className="text-xs text-slate-400 mt-1.5">1 unit : {def.unit}</p><Sac sac={sac}/></>}
                          </td>
                          <td className={td}>
                            <input type="number" aria-label={`${def?.name || 'Add-on'} quantity`} min={1} max={def?.maxQty || 1} disabled={!def || def.maxQty === 1} value={def ? r.qty : 1}
                              onChange={(e) => setRow(r.key, { qty: Math.max(1, Math.min(def.maxQty, parseInt(e.target.value, 10) || 1)) })} className={cellInput}/>
                          </td>
                          <td className={td}>
                            <input type="number" min={0} step="any" aria-label={`${def?.name || 'Add-on'} price`} disabled={!def} value={def ? priceOf(r.id) : '0.00'}
                              onChange={(e) => setPrices((x) => ({ ...x, [r.id]: e.target.value }))} className={cellInput}/>
                          </td>
                          {discMode === 'item' && (
                            <td className={td}>{def && <LineDiscount label={def.name} value={itemDisc[r.id] || { type: 'percent', value: '' }} onChange={(d) => setItemDisc((x) => ({ ...x, [r.id]: d }))}/>}</td>
                          )}
                          <td className={clsx(td, 'pt-5', def ? 'text-slate-600' : 'text-slate-300')}>{def ? tax : 'Select a tax'}</td>
                          <td className={clsx(td, 'text-right pt-5 font-semibold tabular-nums')}>Rs. {money(def ? lineAmount(r.id, r.qty) : 0)}</td>
                          <td className={clsx(td, 'pt-4')}>
                            {(def || rows.length > 1) && (
                              <button type="button" onClick={() => removeRow(r.key)} aria-label={`Remove ${def?.name || 'this row'}`} className="p-1 rounded text-slate-400 hover:text-red-600 hover:bg-red-50"><X size={14}/></button>
                            )}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
              <button type="button" onClick={() => setRows((rs) => [...rs, newRow()])} disabled={rows.length >= eligible.length}
                className="mt-2 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-100 text-sm font-semibold text-slate-700 hover:bg-slate-200 disabled:opacity-50">
                <Plus size={14} className="text-primary"/> Add new row
              </button>
            </div>

            {discMode === 'total' && (
              <div>
                <h3 className="text-sm font-semibold text-slate-700 mb-2">Discount</h3>
                <div className="overflow-x-auto border border-slate-200 rounded-xl">
                  <table className="w-full text-sm min-w-[560px]">
                    <thead className="bg-slate-50 text-left"><tr><th className={th}>Discount name</th><th className={clsx(th, 'w-48')}>Discount type</th><th className={clsx(th, 'text-right w-40')}>Value</th><th className={clsx(th, 'w-10')}/></tr></thead>
                    <tbody>
                      <tr>
                        <td className={td}><input aria-label="Discount name" value={totalDisc.name} maxLength={60} onChange={(e) => setTotalDisc((d) => ({ ...d, name: e.target.value }))} className={clsx(cellInput, 'text-left')}/></td>
                        <td className={td}><Select size="sm" value={totalDisc.type} onChange={(type) => setTotalDisc((d) => ({ ...d, type }))} options={[{ value: 'flat', label: 'Flat (₹)' }, { value: 'percent', label: 'Percentage (%)' }]}/></td>
                        <td className={td}><input type="number" min={0} step="any" aria-label="Discount value" value={totalDisc.value} placeholder="0" onChange={(e) => setTotalDisc((d) => ({ ...d, value: e.target.value }))} className={cellInput}/></td>
                        <td className={td}><button type="button" onClick={() => setDiscMode('none')} aria-label="Remove the discount" className="p-1 rounded text-red-500 hover:bg-red-50"><X size={14}/></button></td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </section>

          {/* ── payment and totals ── */}
          <div className="grid lg:grid-cols-[minmax(0,1fr)_380px] gap-6 items-start">
            <section className="space-y-3">
              <Row id="sd-offline" label="Payment mode">
                <label className="inline-flex items-center gap-2 text-sm text-slate-700 cursor-pointer pt-2">
                  <input id="sd-offline" type="checkbox" checked={offline} onChange={(e) => setOffline(e.target.checked)} className="w-4 h-4 accent-primary"/> Collect payment offline
                </label>
                {!offline && <p className="text-[11px] text-slate-400 mt-1">Free — no payment and no invoice.</p>}
              </Row>
              {offline && (
                <>
                  <Row id="sd-amount" label="Amount received" hint="incl. GST">
                    <input id="sd-amount" type="number" min={1} step="any" value={amount} onChange={(e) => { setAmount(e.target.value); setAmountTouched(true) }} className={inputCls}/>
                    {quote && amountTouched && Math.abs(Number(amount) - quote.charge.total) >= 0.01 && (
                      <p className="text-[11px] text-amber-700 mt-1">Differs from the total ({rupees(quote.charge.total)}): the invoice shows the difference as a price adjustment.</p>
                    )}
                  </Row>
                  <Row id="sd-method" label="Paid by"><Select value={method} onChange={setMethod} options={METHODS}/></Row>
                  <Row id="sd-payref" label="Payment reference">
                    <input id="sd-payref" value={payRef} maxLength={100} onChange={(e) => setPayRef(e.target.value)} placeholder="UTR, cheque no., UPI ref" className={inputCls}/>
                  </Row>
                  <Row id="sd-paidon" label="Received on"><DatePicker value={paidOn} onChange={setPaidOn} min={yearAgo()} textSize="text-sm"/></Row>
                </>
              )}
            </section>

            <aside className="rounded-xl bg-slate-50 border border-slate-200 p-4 space-y-3 text-sm">
              {quoteError && <ErrorNote>{quoteError}</ErrorNote>}
              {!quote && !quoteError && <p className="text-xs text-slate-400 flex items-center gap-2"><Loader2 size={13} className="animate-spin"/> Working out the price…</p>}
              {quote && (
                <>
                  <dl className="space-y-1.5">
                    <div className="flex justify-between"><dt className="text-slate-600">Sub total</dt><dd className="tabular-nums">{rupees(subtotal)}</dd></div>
                    {lines.filter((l) => l.kind !== 'plan' && l.kind !== 'addon').map((l, i) => (
                      <div key={i} className={clsx('flex justify-between gap-3', l.amount < 0 ? 'text-emerald-700' : 'text-slate-600')}>
                        <dt className="min-w-0">{l.description}</dt><dd className="tabular-nums whitespace-nowrap">{l.amount < 0 ? `−${rupees(-l.amount)}` : rupees(l.amount)}</dd>
                      </div>
                    ))}
                    {quote.charge.gstPercent === 0
                      ? <div className="flex justify-between text-slate-600"><dt>GST</dt><dd>Exempt</dd></div>
                      : quote.charge.tax.kind === 'intra'
                        ? <>
                            <div className="flex justify-between text-slate-600"><dt>CGST ({quote.charge.gstPercent / 2}%)</dt><dd className="tabular-nums">{rupees(quote.charge.tax.cgst)}</dd></div>
                            <div className="flex justify-between text-slate-600"><dt>SGST ({quote.charge.gstPercent / 2}%)</dt><dd className="tabular-nums">{rupees(quote.charge.tax.sgst)}</dd></div>
                          </>
                        : <div className="flex justify-between text-slate-600"><dt>{quote.charge.tax.kind === 'inter' ? 'IGST' : 'GST'} ({quote.charge.gstPercent}%)</dt><dd className="tabular-nums">{rupees(quote.charge.gst)}</dd></div>}
                  </dl>
                  <div className="flex justify-between pt-2 border-t border-slate-200 font-bold text-base text-slate-900"><span>Total</span><span className="tabular-nums">{rupees(quote.charge.total)}</span></div>
                  <p className="text-xs text-slate-500">
                    Covers {fmtDate(quote.from)} → {fmtDate(quote.end)}.{' '}
                    {quote.renewal != null
                      ? <>Then <b className="text-slate-700">{rupees(quote.renewal)}</b> every {unit}{quote.expiresAfter ? `, ${quote.expiresAfter - quote.cycles} more time${quote.expiresAfter - quote.cycles > 1 ? 's' : ''}` : ' until cancelled'}.</>
                      : 'Nothing more after this cycle.'}
                  </p>
                </>
              )}
              {autopayOn && (
                <label className="flex items-start gap-2 text-xs text-amber-900 bg-amber-50 border border-amber-200 rounded-lg p-3 cursor-pointer">
                  <input type="checkbox" checked={stopAutopay} onChange={(e) => setStopAutopay(e.target.checked)} className="mt-0.5 accent-primary"/>
                  <span>This client is on autopay. <b>Stop their autopay</b> — otherwise they would be charged for this period as well.</span>
                </label>
              )}
            </aside>
          </div>

          {/* ── client details ── */}
          <section>
            <div role="tablist" aria-label="Client details" className="flex gap-1 border-b border-slate-200 overflow-x-auto">
              {TABS.map(([id, label]) => (
                <button key={id} type="button" role="tab" aria-selected={tab === id} onClick={() => setTab(id)}
                  className={clsx('px-3 py-2 text-sm font-semibold whitespace-nowrap border-b-2 -mb-px', tab === id ? 'border-primary text-slate-900' : 'border-transparent text-slate-500 hover:text-slate-800')}>
                  {label}{tabErrors(id) && <span className="ml-1 text-red-600">•</span>}
                </button>
              ))}
            </div>
            <div role="tabpanel" className="pt-5">
              {tab === 'other' && (
                <div className="max-w-xl space-y-3">
                  <Row id="sd-gtt" label="GST treatment" required error={fe('gstTreatment')}>
                    <Select value={prof.gstTreatment} onChange={(v) => setP('gstTreatment', v)} options={GST_TREATMENTS}/>
                  </Row>
                  {hasGstin(prof.gstTreatment) && (
                    <Row id="sd-gstin" label="GSTIN" required error={fe('gstin')}>
                      <input id="sd-gstin" value={prof.gstin} onChange={(e) => setP('gstin', e.target.value.toUpperCase())} maxLength={15} className={clsx(inputCls, 'font-mono uppercase')}/>
                    </Row>
                  )}
                  <Row id="sd-pos" label="Place of supply" required error={fe('address.stateCode')} hint="The state of their billing address">
                    <Select value={prof.address.stateCode} onChange={(v) => setP('address', { ...prof.address, stateCode: v })} placeholder="Choose the state"
                      options={states.map((s) => ({ value: s.code, label: `[${s.code}] ${s.name}` }))}/>
                  </Row>
                  <Row id="sd-pan" label="PAN" error={fe('pan')}>
                    <input id="sd-pan" value={prof.pan} maxLength={10} onChange={(e) => setP('pan', e.target.value.toUpperCase())} className={clsx(inputCls, 'font-mono uppercase')}/>
                  </Row>
                  <Row id="sd-taxpref" label="Tax preference" required>
                    <div role="radiogroup" aria-label="Tax preference" className="flex gap-5 pt-2 text-sm text-slate-700">
                      <label className="inline-flex items-center gap-2 cursor-pointer"><input type="radio" name="sd-taxpref" checked={!prof.taxExempt} onChange={() => setP('taxExempt', false)} className="accent-primary"/> Taxable</label>
                      <label className="inline-flex items-center gap-2 cursor-pointer"><input type="radio" name="sd-taxpref" checked={prof.taxExempt} onChange={() => setP('taxExempt', true)} className="accent-primary"/> Tax exempt</label>
                    </div>
                  </Row>
                  <Row id="sd-terms" label="Payment terms" error={fe('paymentTerms')}>
                    <Select value={prof.paymentTerms} onChange={(v) => setP('paymentTerms', v)} options={TERMS}/>
                  </Row>
                  <Row id="sd-currency" label="Currency"><input id="sd-currency" readOnly value="INR – Indian Rupee" className={clsx(inputCls, 'bg-slate-50 text-slate-500')}/></Row>
                </div>
              )}
              {tab === 'address' && (
                <div className="grid lg:grid-cols-2 gap-x-10 gap-y-6">
                  <div>
                    <h4 className="text-sm font-bold text-slate-800 mb-3">Billing address</h4>
                    <AddressFields prefix="address" value={prof.address} onChange={(v) => setP('address', v)} states={states} fe={fe}/>
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-slate-800 mb-3 flex items-center gap-2">Shipping address
                      <button type="button" onClick={() => setP('shipping', { ...prof.address })} className="inline-flex items-center gap-0.5 text-xs font-semibold text-primary hover:underline">
                        (<ArrowDown size={11}/> Copy billing address)
                      </button>
                    </h4>
                    <AddressFields prefix="shipping" value={prof.shipping} onChange={(v) => setP('shipping', v)} states={states} fe={fe}/>
                  </div>
                </div>
              )}
              {tab === 'contacts' && (
                <div className="space-y-2">
                  <div className="overflow-x-auto border border-slate-200 rounded-xl">
                    <table className="w-full text-sm min-w-[640px]">
                      <thead className="bg-slate-50 text-left"><tr><th className={th}>Name</th><th className={th}>Email</th><th className={th}>Mobile</th><th className={th}>Designation</th><th className={clsx(th, 'w-10')}/></tr></thead>
                      <tbody>
                        <tr className="text-slate-500">
                          <td className={td}>{prof.contactName || '—'} <span className="text-[10px] font-semibold uppercase text-primary ml-1">Primary</span></td>
                          <td className={td}>{prof.email || '—'}</td><td className={td}>{prof.phone ? `+91 ${prof.phone}` : '—'}</td><td className={td}/><td className={td}/>
                        </tr>
                        {prof.contacts.map((c, i) => {
                          const set = (k, v) => setP('contacts', prof.contacts.map((x, j) => (j === i ? { ...x, [k]: v } : x)))
                          return (
                            <tr key={i}>
                              {['name', 'email', 'phone', 'role'].map((k) => (
                                <td key={k} className={td}>
                                  <input aria-label={`Contact ${i + 1} ${k}`} value={c[k]} onChange={(e) => set(k, e.target.value)} className={clsx(inputCls, 'py-1.5')}/>
                                  {fe(`contacts.${i}.${k}`) && <p className="text-[11px] text-red-600 mt-1">{fe(`contacts.${i}.${k}`)}</p>}
                                </td>
                              ))}
                              <td className={td}><button type="button" onClick={() => setP('contacts', prof.contacts.filter((_, j) => j !== i))} aria-label={`Remove contact ${i + 1}`} className="p-1 rounded text-slate-400 hover:text-red-600 hover:bg-red-50"><X size={14}/></button></td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                  <button type="button" disabled={prof.contacts.length >= 10} onClick={() => setP('contacts', [...prof.contacts, { name: '', email: '', phone: '', role: '' }])}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-100 text-sm font-semibold text-slate-700 hover:bg-slate-200 disabled:opacity-50">
                    <Plus size={14} className="text-primary"/> Add contact person
                  </button>
                </div>
              )}
              {tab === 'remarks' && (
                <div className="max-w-2xl space-y-3">
                  <Row id="sd-remarks" label="Remarks" hint="Printed on the invoice.">
                    <textarea id="sd-remarks" rows={3} maxLength={500} value={remarks} onChange={(e) => setRemarks(e.target.value)} className={inputCls} placeholder="e.g. Thanks for your business."/>
                  </Row>
                  <Row id="sd-note" label="Internal note" hint="Only staff see this.">
                    <input id="sd-note" value={note} maxLength={500} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Annual deal agreed with Rahul" className={inputCls}/>
                  </Row>
                </div>
              )}
              {tab === 'files' && (isNew || !client
                ? <p className="text-sm text-slate-500">Save the subscription first — then attach files here or from the client's page.</p>
                : <ClientDocuments token={token} workspaceId={ws} initial={client.documents || []} canEdit/>)}
            </div>
          </section>
        </div>

        {/* ── save ── */}
        <div className="sticky bottom-0 bg-white border-t border-slate-200 px-5 py-3 flex flex-wrap items-center gap-3">
          <div className="flex-1 min-w-0"><ErrorNote>{error}</ErrorNote></div>
          {quote && <span className="text-sm text-slate-500">Total <b className="text-slate-900 tabular-nums">{rupees(quote.charge.total)}</b></span>}
          <button type="button" onClick={onClose} className={btnGhost}>Cancel</button>
          <button type="submit" disabled={blocked} className={btnPrimary}>{saving && <Loader2 size={14} className="animate-spin"/>} {isNew ? 'Create subscription' : 'Save subscription'}</button>
        </div>
      </form>
    </Shell>
  )
}
