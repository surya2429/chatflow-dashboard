// SubscriptionDialog.jsx — staff set up a client's subscription like a recurring invoice. Left: the
// client, the plan and add-ons (quantity, price, discount, tax, amount), when it starts and how many
// cycles it runs, the payment, and the client's tax details, addresses, contacts and files. Right: the
// order summary, always in view — the server's own quote, exactly what will be invoiced.
// One cycle is billed now; each next one is recorded from Renewals at these prices until it expires
// after N cycles (or never). Admins only. A dialog, or (inline) a page section on Add subscription.
import { useEffect, useRef, useState } from 'react'
import clsx from 'clsx'
import { Loader2, Plus, X, ArrowDown, Check, Pencil } from 'lucide-react'
import { billingAdmin } from '../../lib/billingApi'
import DatePicker from '../DatePicker'
import Select from '../Select'
import ClientDocuments from './ClientDocuments'
import { Modal, Chips, ErrorNote, StatusPill, inputCls, labelCls, btnPrimary, btnGhost, rupees, fmtDate, initialsOf } from './ui'

const ymd = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
const today = () => ymd(new Date())
const startOfDay = (s) => Math.floor(new Date(`${s}T00:00:00`).getTime() / 1000)
const yearAgo = () => { const d = new Date(); d.setFullYear(d.getFullYear() - 1); return ymd(d) }
const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40)
const money = (n) => Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
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
const TABS = [['other', 'Other details'], ['address', 'Address'], ['contacts', 'Contact persons'], ['files', 'Documents']]
const hasGstin = (t) => t === 'registered' || t === 'sez'
/** Which tab a field error from the server belongs to (none: it's in the client card). */
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

/* A numbered card: one step of the form. */
function Step({ n, title, hint, aside, children }) {
  return (
    <section className="bg-white border border-slate-200 rounded-2xl">
      <header className="flex items-center gap-3 px-5 pt-4 pb-3">
        <span className="w-6 h-6 rounded-full bg-primary/10 text-primary text-xs font-bold flex items-center justify-center flex-shrink-0">{n}</span>
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-bold text-slate-900">{title}</h3>
          {hint && <p className="text-xs text-slate-500">{hint}</p>}
        </div>
        {aside}
      </header>
      <div className="px-5 pb-5 space-y-4">{children}</div>
    </section>
  )
}

/* A label above its control. */
function Field({ id, label, required, error, hint, children, className }) {
  return (
    <div className={className}>
      <label htmlFor={id} className={clsx(labelCls, required && 'after:content-["*"] after:text-red-500 after:ml-0.5')}>{label}</label>
      {children}
      {error && <p className="text-[11px] text-red-600 mt-1">{error}</p>}
      {hint && !error && <p className="text-[11px] text-slate-400 mt-1">{hint}</p>}
    </div>
  )
}

function AddressFields({ prefix, value, onChange, states, fe }) {
  const set = (k, v) => onChange({ ...value, [k]: v })
  return (
    <div className="space-y-3">
      <Field id={`${prefix}-att`} label="Attention" error={fe(`${prefix}.attention`)}>
        <input id={`${prefix}-att`} value={value.attention} onChange={(e) => set('attention', e.target.value)} className={inputCls}/>
      </Field>
      <Field id={`${prefix}-l1`} label="Address" error={fe(`${prefix}.line1`) || fe(`${prefix}.line2`)}>
        <input id={`${prefix}-l1`} value={value.line1} onChange={(e) => set('line1', e.target.value)} placeholder="Street 1" className={inputCls}/>
        <input aria-label="Street 2" value={value.line2} onChange={(e) => set('line2', e.target.value)} placeholder="Street 2" className={clsx(inputCls, 'mt-2')}/>
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field id={`${prefix}-city`} label="City" error={fe(`${prefix}.city`)}>
          <input id={`${prefix}-city`} value={value.city} onChange={(e) => set('city', e.target.value)} className={inputCls}/>
        </Field>
        <Field id={`${prefix}-pin`} label="PIN code" error={fe(`${prefix}.pincode`)}>
          <input id={`${prefix}-pin`} inputMode="numeric" maxLength={6} value={value.pincode} onChange={(e) => set('pincode', e.target.value.replace(/\D/g, ''))} className={inputCls}/>
        </Field>
      </div>
      <Field id={`${prefix}-state`} label="State" error={fe(`${prefix}.stateCode`)}>
        <Select value={value.stateCode} onChange={(v) => set('stateCode', v)} placeholder="Select or type to search" options={states.map((s) => ({ value: s.code, label: `[${s.code}] ${s.name}` }))}/>
      </Field>
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
const td = 'px-3 py-3 align-top border-b border-slate-100 last:border-b-0'

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

/* The Add subscription page shows the form as a section instead of a dialog. */
function Page({ children }) {
  return <div className="bg-slate-50 rounded-2xl">{children}</div>
}

export default function SubscriptionDialog({ token, initial, plans: allPlans, addonDefs, states, sac = '998314', onDone, onClose, inline }) {
  const Shell = inline ? Page : Modal
  // Plans on sale (public or private), plus the one the client is on even if it is archived.
  const plans = allPlans.filter((p) => p.status === 'active' || p.id === initial?.plan)
  const isNew = !initial?.workspaceId
  const [ws, setWs] = useState(initial?.workspaceId || '')
  const [wsTouched, setWsTouched] = useState(false)
  const [prof, setProf] = useState(EMPTY_PROFILE)
  const [client, setClient] = useState(null)        // the full client record once loaded
  const [editClient, setEditClient] = useState(isNew)
  const [team, setTeam] = useState([])
  const [plan, setPlan] = useState(initial?.plan || 'standard')
  const [period, setPeriod] = useState(initial?.period || 'monthly')
  const [rows, setRows] = useState(() => (initial?.addons?.length ? initial.addons.map((a) => newRow(a.id, a.qty)) : [newRow()]))
  const [prices, setPrices] = useState({})          // { plan | addonId: '₹ per cycle' } — only the ones staff changed
  const [start, setStart] = useState('now')         // now · date · after_current
  const [startDate, setStartDate] = useState(today())
  const [never, setNever] = useState(true)
  const [expiresAfter, setExpiresAfter] = useState('12')
  const [salesperson, setSalesperson] = useState('')
  const [discMode, setDiscMode] = useState('none')
  const [discountRenews, setDiscountRenews] = useState(true)
  const [itemDisc, setItemDisc] = useState({})       // { plan | addonId: { type, value } }
  const [totalDisc, setTotalDisc] = useState({ name: 'Manual discount', type: 'flat', value: '' })
  const [offline, setOffline] = useState(true)
  const [amount, setAmount] = useState('')
  const [amountTouched, setAmountTouched] = useState(false)
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
      if (c.profile) setProf(fromProfile(c.profile)); else setEditClient(true)
      const s = c.staffSub
      if (s) {
        setNever(s.cycles === null); if (s.cycles) setExpiresAfter(String(s.cycles))
        setSalesperson(s.salesperson || ''); setDiscountRenews(s.discountRenews)
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
  function pickStart(v) {                                  // the chips next to the date picker
    setStart(v)
    if (v === 'now') setStartDate(today())
  }

  /** What a line comes to before GST, as the form shows it (the server's quote has the final word). */
  function lineAmount(id, qty) {
    const gross = (Number(priceOf(id)) || 0) * qty
    const d = discMode === 'item' && itemDisc[id]
    const off = d && Number(d.value) > 0 ? (d.type === 'percent' ? (gross * Number(d.value)) / 100 : Number(d.value)) : 0
    return Math.max(0, gross - off)
  }

  async function submit(e) {
    e.preventDefault()
    if (blocked) return                       // Enter in a field can submit while Save is disabled
    setSaving(true); setError(''); setFields({})
    try {
      const row = await billingAdmin.plan(token, {
        ...sub, salesperson, stopAutopay,
        profile: { ...prof, gstin: hasGstin(prof.gstTreatment) ? prof.gstin : '' },
        payment: offline ? { type: 'offline', amount: Number(amount) } : { type: 'free' },
      })
      onDone(row)
    } catch (err) {
      if (err.fields) {
        setFields(err.fields)
        setEditClient(true)
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
  const tax = prof.taxExempt ? 'Exempt' : `GST ${quote?.charge.gstPercent ?? 18}%`
  const tabErrors = (t) => Object.keys(fields).some((f) => tabOf(f) === t)
  const lines = quote?.charge.lines ?? []
  const startShown = start === 'after_current' && client?.currentEnd ? ymd(new Date(client.currentEnd * 1000)) : startDate
  const saveLabel = isNew ? 'Create subscription' : 'Save subscription'
  const differs = quote && amountTouched && Math.abs(Number(amount) - quote.charge.total) >= 0.01

  const summary = (
    <aside className="xl:sticky xl:top-4 self-start rounded-2xl bg-white border border-slate-200 overflow-hidden">
      <div className="px-5 py-4 border-b border-slate-100">
        <h3 className="text-sm font-bold text-slate-900">Order summary</h3>
        <p className="text-xs text-slate-500 truncate">{prof.legalName || 'New client'} · {planDef?.name} · every {unit}</p>
      </div>
      <div className="px-5 py-4 space-y-4">
        {quoteError && <ErrorNote>{quoteError}</ErrorNote>}
        {!quote && !quoteError && <p className="text-xs text-slate-400 flex items-center gap-2"><Loader2 size={13} className="animate-spin"/> Working out the price…</p>}
        {quote && (
          <>
            <dl className="space-y-2 text-sm">
              {lines.map((l, i) => (
                <div key={i} className={clsx('flex justify-between gap-3', l.amount < 0 ? 'text-emerald-700' : 'text-slate-700')}>
                  <dt className="min-w-0 text-xs leading-5">{l.description}{l.qty > 1 ? ` × ${l.qty}` : ''}</dt>
                  <dd className="tabular-nums whitespace-nowrap text-xs leading-5">{l.amount < 0 ? `−${rupees(-l.amount)}` : rupees(l.amount)}</dd>
                </div>
              ))}
              <div className="flex justify-between gap-3 pt-2 border-t border-slate-100 text-slate-500"><dt className="text-xs">Taxable value</dt><dd className="text-xs tabular-nums">{rupees(quote.charge.base)}</dd></div>
              {quote.charge.gstPercent === 0
                ? <div className="flex justify-between text-slate-500"><dt className="text-xs">GST</dt><dd className="text-xs">Exempt</dd></div>
                : quote.charge.tax.kind === 'intra'
                  ? <>
                      <div className="flex justify-between text-slate-500"><dt className="text-xs">CGST ({quote.charge.gstPercent / 2}%)</dt><dd className="text-xs tabular-nums">{rupees(quote.charge.tax.cgst)}</dd></div>
                      <div className="flex justify-between text-slate-500"><dt className="text-xs">SGST ({quote.charge.gstPercent / 2}%)</dt><dd className="text-xs tabular-nums">{rupees(quote.charge.tax.sgst)}</dd></div>
                    </>
                  : <div className="flex justify-between text-slate-500"><dt className="text-xs">{quote.charge.tax.kind === 'inter' ? 'IGST' : 'GST'} ({quote.charge.gstPercent}%)</dt><dd className="text-xs tabular-nums">{rupees(quote.charge.gst)}</dd></div>}
            </dl>
            <div className="flex items-baseline justify-between rounded-xl bg-primary/5 px-4 py-3">
              <span className="text-sm font-semibold text-slate-700">Total due now</span>
              <span className="text-2xl font-bold text-slate-900 tabular-nums">{rupees(quote.charge.total)}</span>
            </div>
            {quote.discountTotal > 0 && <p className="text-xs text-emerald-700 -mt-1">You save {rupees(quote.discountTotal)} before GST.</p>}
            <ul className="space-y-2 text-xs text-slate-600">
              <li className="flex gap-2"><Check size={13} className="text-primary mt-0.5 flex-shrink-0"/><span>Covers <b className="text-slate-800">{fmtDate(quote.from)}</b> to <b className="text-slate-800">{fmtDate(quote.end)}</b></span></li>
              <li className="flex gap-2"><Check size={13} className="text-primary mt-0.5 flex-shrink-0"/>
                <span>{quote.renewal != null
                  ? <>Then <b className="text-slate-800">{rupees(quote.renewal)}</b> every {unit}{quote.expiresAfter ? `, ${quote.expiresAfter - quote.cycles} more time${quote.expiresAfter - quote.cycles > 1 ? 's' : ''}` : ' until cancelled'}. You record each payment on Renewals.</>
                  : 'Nothing more after this cycle.'}</span></li>
            </ul>
          </>
        )}
        {autopayOn && (
          <label className="flex items-start gap-2 text-xs text-amber-900 bg-amber-50 border border-amber-200 rounded-lg p-3 cursor-pointer">
            <input type="checkbox" checked={stopAutopay} onChange={(e) => setStopAutopay(e.target.checked)} className="mt-0.5 accent-primary"/>
            <span>This client is on autopay. <b>Stop their autopay</b> — otherwise they would be charged for this period as well.</span>
          </label>
        )}
        <ErrorNote>{error}</ErrorNote>
        <div className="flex gap-2">
          <button type="button" onClick={onClose} className={btnGhost}>Cancel</button>
          <button type="submit" disabled={blocked} className={clsx(btnPrimary, 'flex-1')}>{saving && <Loader2 size={14} className="animate-spin"/>} {saveLabel}</button>
        </div>
      </div>
    </aside>
  )

  return (
    <Shell wide title={isNew ? 'New subscription' : `Subscription · ${initial.customer || initial.workspaceId}`}
      subtitle="One cycle is billed now; each next one is recorded from Renewals. Every offline payment gets a GST invoice." onClose={onClose}>
      <form onSubmit={submit} className="bg-slate-50 min-h-full p-4 sm:p-5 grid xl:grid-cols-[minmax(0,1fr)_340px] gap-5 items-start">
        <div className="space-y-5 min-w-0">
          {/* 1 · client */}
          <Step n={1} title="Client" hint="Who the GST invoice is made out to"
            aside={!isNew && !editClient && client?.profile && (
              <button type="button" onClick={() => setEditClient(true)} className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline"><Pencil size={12}/> Edit details</button>
            )}>
            {!isNew && !editClient ? (
              <div className="flex items-center gap-3">
                <span className="w-10 h-10 rounded-full bg-primary/10 text-primary text-sm font-bold flex items-center justify-center flex-shrink-0">{initialsOf(prof.legalName || ws)}</span>
                <div className="min-w-0 flex-1">
                  <div className="font-semibold text-slate-900 truncate">{prof.legalName || ws}</div>
                  <div className="text-xs text-slate-500 truncate">{[prof.contactName, prof.email, prof.phone && `+91 ${prof.phone}`].filter(Boolean).join(' · ')}</div>
                  <div className="text-[11px] text-slate-400 font-mono">{ws}</div>
                </div>
                {client && (
                  <div className="text-right text-xs text-slate-500 flex-shrink-0">
                    <StatusPill status={client.status}/>
                    {client.planName && <div className="mt-1">{client.planName} until {fmtDate(client.currentEnd)}</div>}
                  </div>
                )}
              </div>
            ) : (
              <div className="grid sm:grid-cols-2 gap-4">
                <Field id="sd-company" label="Customer name" required error={fe('legalName')}>
                  <input id="sd-company" value={prof.legalName} className={inputCls} placeholder="Company or legal name"
                    onChange={(e) => { setP('legalName', e.target.value); if (isNew && !wsTouched) setWs(slug(e.target.value)) }}/>
                </Field>
                <Field id="sd-ws" label="Workspace ID" required hint={isNew ? 'Their SmatBot workspace' : undefined}>
                  <input id="sd-ws" value={ws} disabled={!isNew} className={clsx(inputCls, 'font-mono')} placeholder="e.g. sharma-traders"
                    onChange={(e) => { setWs(e.target.value); setWsTouched(true) }}/>
                </Field>
                <Field id="sd-contact" label="Contact person" required error={fe('contactName')}>
                  <input id="sd-contact" value={prof.contactName} onChange={(e) => setP('contactName', e.target.value)} className={inputCls}/>
                </Field>
                <Field id="sd-email" label="Email" required error={fe('email')}>
                  <input id="sd-email" type="email" value={prof.email} onChange={(e) => setP('email', e.target.value)} className={inputCls}/>
                </Field>
                <Field id="sd-phone" label="Mobile" required error={fe('phone')}>
                  <div className="flex">
                    <span className="px-3 py-2 text-sm text-slate-500 border border-r-0 border-slate-200 rounded-l-lg bg-slate-50">+91</span>
                    <input id="sd-phone" inputMode="numeric" value={prof.phone} onChange={(e) => setP('phone', e.target.value)} className={clsx(inputCls, 'rounded-l-none')}/>
                  </div>
                </Field>
              </div>
            )}
          </Step>

          {/* 2 · plan and items */}
          <Step n={2} title="Plan & add-ons"
            aside={<Chips label="Billing period" value={period} onChange={changePeriod} options={[['monthly', 'Monthly'], ['yearly', 'Yearly']]}/>}>
            <div role="radiogroup" aria-label="Plan" className="grid grid-cols-[repeat(auto-fill,minmax(150px,1fr))] gap-2">
              {plans.map((p) => (
                <label key={p.id} className={clsx('relative border rounded-xl px-3 py-2.5 cursor-pointer transition-colors has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-primary/30',
                  plan === p.id ? 'border-primary bg-primary/5' : 'border-slate-200 hover:border-slate-300')}>
                  <input type="radio" name="sd-plan" value={p.id} checked={plan === p.id} onChange={() => changePlan(p.id)} className="sr-only"/>
                  {plan === p.id && <Check size={14} className="absolute top-2.5 right-2.5 text-primary"/>}
                  <div className="text-sm font-semibold text-slate-900 pr-5 truncate">{p.name}</div>
                  <div className="text-xs text-slate-500">{rupees(p[period])} / {period === 'yearly' ? 'yr' : 'mo'}</div>
                </label>
              ))}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-semibold text-slate-500">Discount</span>
              <div className="w-44"><Select size="sm" value={discMode} onChange={setDiscMode} options={DISCOUNT_MODES}/></div>
              {discMode !== 'none' && (
                <div className="w-40"><Select size="sm" value={discountRenews ? 'every' : 'first'} onChange={(v) => setDiscountRenews(v === 'every')}
                  options={[{ value: 'every', label: 'Every renewal' }, { value: 'first', label: 'First cycle only' }]}/></div>
              )}
            </div>

            <div className="overflow-x-auto border border-slate-200 rounded-xl">
              <table className="w-full text-sm min-w-[660px]">
                <thead className="bg-slate-50 text-left">
                  <tr>
                    <th className={th}>Item</th><th className={clsx(th, 'text-right w-20')}>Qty</th><th className={clsx(th, 'text-right w-28')}>Price</th>
                    {discMode === 'item' && <th className={clsx(th, 'w-32')}>Discount</th>}
                    <th className={clsx(th, 'w-20')}>Tax</th><th className={clsx(th, 'text-right w-32')}>Amount</th><th className={clsx(th, 'w-8')}/>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td className={td}>
                      <div className="font-medium text-slate-900">{planDef?.name} plan</div>
                      <p className="text-xs text-slate-400">SmatBot {planDef?.name} — billed every {unit}</p>
                      <Sac sac={sac}/>
                    </td>
                    <td className={clsx(td, 'text-right tabular-nums pt-4')}>1</td>
                    <td className={td}>
                      <input type="number" min={0} step="any" aria-label="Plan price" value={priceOf('plan')} onChange={(e) => setPrices((x) => ({ ...x, plan: e.target.value }))} className={cellInput}/>
                      {prices.plan !== undefined && Number(prices.plan) !== listPrice('plan') && <p className="text-[10px] text-slate-400 text-right pr-2">list {rupees(listPrice('plan'))}</p>}
                    </td>
                    {discMode === 'item' && <td className={td}><LineDiscount label="the plan" value={itemDisc.plan || { type: 'percent', value: '' }} onChange={(d) => setItemDisc((x) => ({ ...x, plan: d }))}/></td>}
                    <td className={clsx(td, 'pt-4 text-xs text-slate-600 whitespace-nowrap')}>{tax}</td>
                    <td className={clsx(td, 'text-right pt-4')}>
                      <div className="font-semibold tabular-nums">Rs. {money(lineAmount('plan', 1))}</div>
                      <div className="text-[11px] text-slate-400">per {unit}</div>
                    </td>
                    <td className={td}/>
                  </tr>
                  {rows.map((r) => {
                    const def = eligible.find((a) => a.id === r.id)
                    const taken = rows.filter((x) => x.key !== r.key).map((x) => x.id)
                    return (
                      <tr key={r.key}>
                        <td className={td}>
                          <Select size="sm" value={r.id} onChange={(id) => setRow(r.key, { id, qty: 1 })} placeholder="Add an add-on…"
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
                        <td className={clsx(td, 'pt-4 text-xs whitespace-nowrap', def ? 'text-slate-600' : 'text-slate-300')}>{def ? tax : '—'}</td>
                        <td className={clsx(td, 'text-right pt-4 font-semibold tabular-nums')}>Rs. {money(def ? lineAmount(r.id, r.qty) : 0)}</td>
                        <td className={clsx(td, 'pt-3')}>
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
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-100 text-sm font-semibold text-slate-700 hover:bg-slate-200 disabled:opacity-50">
              <Plus size={14} className="text-primary"/> Add new row
            </button>

            {discMode === 'total' && (
              <div className="grid sm:grid-cols-[minmax(0,1fr)_170px_130px_auto] gap-3 items-end rounded-xl border border-slate-200 bg-slate-50/60 p-3">
                <Field id="sd-dname" label="Discount name"><input id="sd-dname" value={totalDisc.name} maxLength={60} onChange={(e) => setTotalDisc((d) => ({ ...d, name: e.target.value }))} className={inputCls}/></Field>
                <Field id="sd-dtype" label="Discount type"><Select value={totalDisc.type} onChange={(type) => setTotalDisc((d) => ({ ...d, type }))} options={[{ value: 'flat', label: 'Flat (₹)' }, { value: 'percent', label: 'Percentage (%)' }]}/></Field>
                <Field id="sd-dval" label="Value"><input id="sd-dval" type="number" min={0} step="any" value={totalDisc.value} placeholder="0" onChange={(e) => setTotalDisc((d) => ({ ...d, value: e.target.value }))} className={clsx(inputCls, 'text-right')}/></Field>
                <button type="button" onClick={() => setDiscMode('none')} aria-label="Remove the discount" className="p-2.5 rounded-lg text-red-500 hover:bg-red-50"><X size={16}/></button>
              </div>
            )}
          </Step>

          {/* 3 · schedule */}
          <Step n={3} title="Schedule" hint="When it starts and how long it runs">
            <div className="grid sm:grid-cols-2 gap-x-6 gap-y-4">
              <Field id="sd-start" label="Start date" hint={start === 'date' ? 'Backdated — the plan counts from this date.' : start === 'after_current' ? 'Runs on from when their current plan ends.' : 'You can go back up to a year.'}>
                <div className={clsx(start === 'after_current' && 'pointer-events-none opacity-60')}>
                  <DatePicker value={startShown} onChange={(v) => { setStartDate(v); setStart(v === today() ? 'now' : 'date') }} min={yearAgo()} max={today()} textSize="text-sm"/>
                </div>
                <div className="mt-2">
                  <Chips label="Start" value={start === 'after_current' ? 'after_current' : start === 'now' ? 'now' : ''} onChange={pickStart}
                    options={[['now', 'Today'], ...(canContinue ? [['after_current', `When the current plan ends (${fmtDate(client.currentEnd)})`]] : [])]}/>
                </div>
              </Field>
              <Field id="sd-expires" label="Expires after" hint={never ? 'Renews every cycle until it is cancelled.' : `Ends after ${expiresAfter || 1} ${period === 'yearly' ? 'years' : 'months'} in all.`}>
                <div className="flex">
                  <input id="sd-expires" type="number" min={1} max={120} disabled={never} value={never ? '' : expiresAfter}
                    onChange={(e) => setExpiresAfter(e.target.value)} className={clsx(inputCls, 'rounded-r-none')}/>
                  <span className="px-3 py-2 text-sm text-slate-500 border border-l-0 border-slate-200 rounded-r-lg bg-slate-50">cycles</span>
                </div>
                <label className="mt-2 inline-flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
                  <input type="checkbox" checked={never} onChange={(e) => setNever(e.target.checked)} className="w-4 h-4 accent-primary"/> Never expires
                </label>
              </Field>
              <Field id="sd-sales" label="Salesperson" className="sm:col-span-2 sm:max-w-sm">
                <Select value={salesperson} onChange={setSalesperson} placeholder="Select a salesperson"
                  options={[{ value: '', label: 'None' }, ...team.map((s) => ({ value: s.email, label: s.name ? `${s.name} (${s.email})` : s.email }))]}/>
              </Field>
            </div>
          </Step>

          {/* 4 · payment */}
          <Step n={4} title="Payment">
            <div role="radiogroup" aria-label="Payment" className="grid sm:grid-cols-2 gap-2">
              {[[true, 'Collect payment offline', 'Record what the client paid. A GST invoice is made.'], [false, 'Free', 'No payment and no invoice.']].map(([v, label, text]) => (
                <label key={label} className={clsx('border rounded-xl px-3 py-2.5 cursor-pointer has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-primary/30', offline === v ? 'border-primary bg-primary/5' : 'border-slate-200 hover:border-slate-300')}>
                  <input type="radio" name="sd-pay" checked={offline === v} onChange={() => setOffline(v)} className="sr-only"/>
                  <div className="text-sm font-semibold text-slate-900">{label}</div>
                  <div className="text-xs text-slate-500">{text}</div>
                </label>
              ))}
            </div>
            {offline && (
              <Field id="sd-amount" label="Amount received (incl. GST)" className="sm:max-w-xs"
                hint={quote && !differs ? `Matches the total, ${rupees(quote.charge.total)}.` : undefined}>
                <div className="flex">
                  <span className="px-3 py-2 text-sm text-slate-500 border border-r-0 border-slate-200 rounded-l-lg bg-slate-50">₹</span>
                  <input id="sd-amount" type="number" min={1} step="any" value={amount} onChange={(e) => { setAmount(e.target.value); setAmountTouched(true) }} className={clsx(inputCls, 'rounded-l-none')}/>
                </div>
                {differs && (
                  <p className="text-[11px] text-amber-700 mt-1">
                    Differs from the total ({rupees(quote.charge.total)}): the invoice shows the difference as a price adjustment.{' '}
                    <button type="button" onClick={() => { setAmountTouched(false) }} className="font-semibold underline">Use the total</button>
                  </p>
                )}
              </Field>
            )}
          </Step>

          {/* 5 · more about the client */}
          <Step n={5} title="More about the client" hint="Tax details, addresses, contacts and files — optional">
            <div role="tablist" aria-label="Client details" className="flex gap-1 border-b border-slate-200 overflow-x-auto -mt-1">
              {TABS.map(([id, label]) => (
                <button key={id} type="button" role="tab" aria-selected={tab === id} onClick={() => setTab(id)}
                  className={clsx('px-3 py-2 text-sm font-semibold whitespace-nowrap border-b-2 -mb-px', tab === id ? 'border-primary text-slate-900' : 'border-transparent text-slate-500 hover:text-slate-800')}>
                  {label}{tabErrors(id) && <span className="ml-1 text-red-600">•</span>}
                </button>
              ))}
            </div>
            <div role="tabpanel">
              {tab === 'other' && (
                <div className="grid sm:grid-cols-2 gap-4">
                  <Field id="sd-gtt" label="GST treatment" required error={fe('gstTreatment')}>
                    <Select value={prof.gstTreatment} onChange={(v) => setP('gstTreatment', v)} options={GST_TREATMENTS}/>
                  </Field>
                  {hasGstin(prof.gstTreatment) && (
                    <Field id="sd-gstin" label="GSTIN" required error={fe('gstin')}>
                      <input id="sd-gstin" value={prof.gstin} onChange={(e) => setP('gstin', e.target.value.toUpperCase())} maxLength={15} className={clsx(inputCls, 'font-mono uppercase')}/>
                    </Field>
                  )}
                  <Field id="sd-pos" label="Place of supply" required error={fe('address.stateCode')} hint="The state of their billing address">
                    <Select value={prof.address.stateCode} onChange={(v) => setP('address', { ...prof.address, stateCode: v })} placeholder="Choose the state"
                      options={states.map((s) => ({ value: s.code, label: `[${s.code}] ${s.name}` }))}/>
                  </Field>
                  <Field id="sd-pan" label="PAN" error={fe('pan')}>
                    <input id="sd-pan" value={prof.pan} maxLength={10} onChange={(e) => setP('pan', e.target.value.toUpperCase())} className={clsx(inputCls, 'font-mono uppercase')}/>
                  </Field>
                  <Field id="sd-taxpref" label="Tax preference" required>
                    <div role="radiogroup" aria-label="Tax preference" className="flex gap-5 pt-2 text-sm text-slate-700">
                      <label className="inline-flex items-center gap-2 cursor-pointer"><input type="radio" name="sd-taxpref" checked={!prof.taxExempt} onChange={() => setP('taxExempt', false)} className="accent-primary"/> Taxable</label>
                      <label className="inline-flex items-center gap-2 cursor-pointer"><input type="radio" name="sd-taxpref" checked={prof.taxExempt} onChange={() => setP('taxExempt', true)} className="accent-primary"/> Tax exempt</label>
                    </div>
                  </Field>
                  <Field id="sd-terms" label="Payment terms" error={fe('paymentTerms')}>
                    <Select value={prof.paymentTerms} onChange={(v) => setP('paymentTerms', v)} options={TERMS}/>
                  </Field>
                  <Field id="sd-currency" label="Currency"><input id="sd-currency" readOnly value="INR – Indian Rupee" className={clsx(inputCls, 'bg-slate-50 text-slate-500')}/></Field>
                </div>
              )}
              {tab === 'address' && (
                <div className="grid md:grid-cols-2 gap-x-8 gap-y-6">
                  <div>
                    <h4 className="text-sm font-bold text-slate-800 mb-3">Billing address</h4>
                    <AddressFields prefix="address" value={prof.address} onChange={(v) => setP('address', v)} states={states} fe={fe}/>
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-slate-800 mb-3 flex flex-wrap items-center gap-2">Shipping address
                      <button type="button" onClick={() => setP('shipping', { ...prof.address })} className="inline-flex items-center gap-0.5 text-xs font-semibold text-primary hover:underline">
                        <ArrowDown size={11}/> Copy billing address
                      </button>
                    </h4>
                    <AddressFields prefix="shipping" value={prof.shipping} onChange={(v) => setP('shipping', v)} states={states} fe={fe}/>
                  </div>
                </div>
              )}
              {tab === 'contacts' && (
                <div className="space-y-2">
                  <div className="overflow-x-auto border border-slate-200 rounded-xl">
                    <table className="w-full text-sm min-w-[600px]">
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
              {tab === 'files' && (isNew || !client
                ? <p className="text-sm text-slate-500">Save the subscription first — then attach files here or from the client's page.</p>
                : <ClientDocuments token={token} workspaceId={ws} initial={client.documents || []} canEdit/>)}
            </div>
          </Step>
        </div>

        {summary}

        {/* below xl the summary sits under the form, so the total and Save stay in reach */}
        <div className="xl:hidden sticky bottom-0 z-10 -mx-4 sm:-mx-5 -mb-4 sm:-mb-5 px-4 sm:px-5 py-3 bg-white border-t border-slate-200 flex items-center gap-3">
          <div className="flex-1 min-w-0">
            <div className="text-[11px] text-slate-500">Total due now</div>
            <div className="font-bold text-slate-900 tabular-nums">{quote ? rupees(quote.charge.total) : '—'}</div>
          </div>
          <button type="submit" disabled={blocked} className={btnPrimary}>{saving && <Loader2 size={14} className="animate-spin"/>} {saveLabel}</button>
        </div>
      </form>
    </Shell>
  )
}
