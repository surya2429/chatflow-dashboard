// SubscriptionDialog.jsx — staff set up a client's subscription in four short tabs:
//   Plan & schedule · Client details · Payment · Summary
// The client's name and contact sit above the tabs; the total due and Back / Next stay pinned below, so
// nothing is lost between tabs. The price is the server's own quote — exactly what will be invoiced.
// One cycle is billed now; each next one is recorded from Renewals at these prices until it expires
// after N cycles (or never). Admins only. A dialog, or (inline) the Add subscription page.
import { useEffect, useRef, useState } from 'react'
import clsx from 'clsx'
import { Loader2, X, Plus, ArrowDown, ArrowLeft, ArrowRight, Check, Pencil, Layers, Building2, Wallet, ReceiptText, Banknote, Gift, AlertCircle } from 'lucide-react'
import { billingAdmin } from '../../lib/billingApi'
import DatePicker from '../DatePicker'
import Select from '../Select'
import ClientDocuments from './ClientDocuments'
import { Segmented, Switch, Stepper, OptionCard, Money } from './controls'
import { Modal, ErrorNote, StatusPill, inputCls, labelCls, btnPrimary, btnGhost, rupees, fmtDate, initialsOf } from './ui'

const ymd = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
const today = () => ymd(new Date())
const startOfDay = (s) => Math.floor(new Date(`${s}T00:00:00`).getTime() / 1000)
const yearAgo = () => { const d = new Date(); d.setFullYear(d.getFullYear() - 1); return ymd(d) }
const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40)
const GST_TREATMENTS = [
  { value: 'registered', label: 'Registered business – regular' }, { value: 'unregistered', label: 'Unregistered business' },
  { value: 'consumer', label: 'Consumer' }, { value: 'sez', label: 'Special economic zone (SEZ)' }, { value: 'overseas', label: 'Overseas' },
]
const TERMS = [[0, 'Due on receipt'], [7, 'Net 7'], [15, 'Net 15'], [30, 'Net 30'], [45, 'Net 45'], [60, 'Net 60']].map(([value, label]) => ({ value, label }))
const EMPTY_ADDR = { attention: '', line1: '', line2: '', city: '', stateCode: '', pincode: '' }
const EMPTY_PROFILE = {
  legalName: '', contactName: '', email: '', phone: '', gstin: '', gstTreatment: 'unregistered', pan: '', taxExempt: false, paymentTerms: 0,
  address: EMPTY_ADDR, shipping: EMPTY_ADDR, contacts: [],
}
const TABS = [['plan', 'Plan & schedule', Layers], ['client', 'Client details', Building2], ['payment', 'Payment', Wallet], ['summary', 'Summary', ReceiptText]]
const hasGstin = (t) => t === 'registered' || t === 'sez'
/** Which tab a field error from the server belongs to (null: the client band above the tabs). */
const tabOf = (f) => (['legalName', 'contactName', 'email', 'phone'].includes(f) ? null : 'client')
const fromProfile = (p) => ({
  legalName: p.legalName, contactName: p.contactName, email: p.email, phone: p.phone, gstin: p.gstin || '',
  gstTreatment: p.gstTreatment || (p.gstin ? 'registered' : 'unregistered'), pan: p.pan || '', taxExempt: Boolean(p.taxExempt), paymentTerms: p.paymentTerms ?? 0,
  address: { ...EMPTY_ADDR, ...p.address, attention: p.address.attention || '', line2: p.address.line2 || '' },
  shipping: p.shipping ? { ...EMPTY_ADDR, ...p.shipping, attention: p.shipping.attention || '', line2: p.shipping.line2 || '' } : EMPTY_ADDR,
  contacts: (p.contacts || []).map((c) => ({ name: c.name, email: c.email || '', phone: c.phone || '', role: c.role || '' })),
})

/* A titled group inside a tab. */
function Block({ title, hint, aside, children }) {
  return (
    <section className="space-y-3">
      <div className="flex items-end gap-3">
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-bold text-slate-900">{title}</h3>
          {hint && <p className="text-xs text-slate-500">{hint}</p>}
        </div>
        {aside}
      </div>
      {children}
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
      <Field id={`${prefix}-state`} label={prefix === 'address' ? 'State (place of supply)' : 'State'} error={fe(`${prefix}.stateCode`)}>
        <Select value={value.stateCode} onChange={(v) => set('stateCode', v)} placeholder="Select or type to search" options={states.map((s) => ({ value: s.code, label: `[${s.code}] ${s.name}` }))}/>
      </Field>
    </div>
  )
}

/* The service badge and SAC code shown under each line, as on the invoice. */
const Sac = ({ sac }) => (
  <span className="inline-flex items-center gap-1.5 text-[11px] text-slate-500">
    <span className="px-1 py-px rounded bg-emerald-600 text-white text-[9px] font-bold tracking-wide">SERVICE</span>SAC {sac}
  </span>
)

/* The %-or-₹ discount on one line. */
function LineDiscount({ label, value, onChange }) {
  return (
    <div className="flex rounded-lg border border-slate-200 bg-white focus-within:border-primary overflow-hidden">
      <input type="number" min={0} step="any" aria-label={`Discount on ${label}`} value={value.value} placeholder="Discount" onChange={(e) => onChange({ ...value, value: e.target.value })}
        className="w-20 px-2 py-1.5 text-sm text-right outline-none tabular-nums bg-transparent"/>
      <select aria-label={`Discount type for ${label}`} value={value.type} onChange={(e) => onChange({ ...value, type: e.target.value })}
        className="border-l border-slate-200 bg-slate-50 px-1.5 text-xs text-slate-600 outline-none">
        <option value="percent">%</option><option value="flat">₹</option>
      </select>
    </div>
  )
}

/* One line of the subscription: the plan, or an add-on. */
function Line({ title, sub, qty, price, discount, amount, per, onRemove }) {
  return (
    <li className="px-4 py-3.5 flex flex-wrap items-center gap-x-4 gap-y-3">
      <div className="flex-1 min-w-[180px]">
        <div className="text-sm font-semibold text-slate-900">{title}</div>
        <div className="text-xs text-slate-500 flex flex-wrap items-center gap-x-2.5 gap-y-1 mt-0.5">{sub}</div>
      </div>
      <div className="flex flex-wrap items-center justify-end gap-3 ml-auto">
        {qty}{price}{discount}
        <div className="w-28 text-right">
          <div className="text-sm font-bold tabular-nums text-slate-900">{rupees(amount)}</div>
          <div className="text-[11px] text-slate-400">{per}</div>
        </div>
        <div className="w-7">{onRemove && <button type="button" onClick={onRemove} aria-label={`Remove ${title}`} className="p-1 rounded-md text-slate-400 hover:text-red-600 hover:bg-red-50"><X size={15}/></button>}</div>
      </div>
    </li>
  )
}

/* The Add subscription page shows the form as a card instead of a dialog. */
function Page({ children }) {
  return <div className="bg-white border border-slate-200 rounded-2xl max-w-4xl mx-auto w-full">{children}</div>
}

export default function SubscriptionDialog({ token, initial, plans: allPlans, addonDefs, states, sac = '998314', onDone, onClose, inline, picker }) {
  const Shell = inline ? Page : Modal
  // Plans on sale (public or private), plus the one the client is on even if it is archived.
  const plans = allPlans.filter((p) => p.status === 'active' || p.id === initial?.plan)
  const isNew = !initial?.workspaceId
  const [tab, setTab] = useState('plan')
  const [ws, setWs] = useState(initial?.workspaceId || '')
  const [wsTouched, setWsTouched] = useState(false)
  const [prof, setProf] = useState(EMPTY_PROFILE)
  const [client, setClient] = useState(null)        // the full client record once loaded
  const [editClient, setEditClient] = useState(isNew)
  const [team, setTeam] = useState([])
  const [plan, setPlan] = useState(initial?.plan || 'standard')
  const [period, setPeriod] = useState(initial?.period || 'monthly')
  const [addons, setAddons] = useState(() => (initial?.addons || []).map((a) => ({ id: a.id, qty: a.qty })))
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
  const chosen = addons.filter((a) => eligible.some((e) => e.id === a.id))
  const addable = eligible.filter((a) => !chosen.some((c) => c.id === a.id))
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
    setAddons((list) => list.filter((a) => ok.includes(a.id)))
  }
  function changePeriod(p) { setPeriod(p); setPrices({}) }   // typed prices are per cycle, so they start over
  const addAddon = (id) => id && setAddons((list) => (list.some((a) => a.id === id) ? list : [...list, { id, qty: 1 }]))
  const setQty = (id, qty) => setAddons((list) => list.map((a) => (a.id === id ? { ...a, qty } : a)))
  function removeAddon(id) {
    setAddons((list) => list.filter((a) => a.id !== id))
    setPrices(({ [id]: _p, ...rest }) => rest)
    setItemDisc(({ [id]: _d, ...rest }) => rest)
  }
  function pickStart(v) {                                  // the options beside the date picker
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
    if (blocked) return                       // Enter in a field can submit while Create is disabled
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
        setTab(t || 'summary')
      }
      setError(err.message)
      setSaving(false)
    }
  }

  const fe = (k) => fields[k]
  const autopayOn = quote?.autopayRunning
  const blocked = saving || !ws.trim() || !quote || (autopayOn && !stopAutopay) || (offline && !(Number(amount) >= 1))
  const lines = quote?.charge.lines ?? []
  const startShown = start === 'after_current' && client?.currentEnd ? ymd(new Date(client.currentEnd * 1000)) : startDate
  const differs = quote && amountTouched && Math.abs(Number(amount) - quote.charge.total) >= 0.01
  const tabHasError = (t) => (t === 'plan' ? Boolean(quoteError) : Object.keys(fields).some((f) => tabOf(f) === t))
  const a = prof.address
  // What the invoice still needs; the server checks it all again on Create.
  const missing = [
    !ws.trim() && { label: 'Workspace ID' }, !prof.legalName.trim() && { label: 'Customer name' }, !prof.contactName.trim() && { label: 'Contact person' },
    !prof.email.trim() && { label: 'Email' }, !prof.phone.trim() && { label: 'Mobile' },
    !a.line1.trim() && { label: 'Billing address', tab: 'client' }, !a.city.trim() && { label: 'City', tab: 'client' },
    !a.pincode && { label: 'PIN code', tab: 'client' }, !a.stateCode && { label: 'State', tab: 'client' },
    hasGstin(prof.gstTreatment) && !prof.gstin.trim() && { label: 'GSTIN', tab: 'client' },
  ].filter(Boolean)
  const here = TABS.findIndex(([id]) => id === tab)
  const go = (i) => { setTab(TABS[i][0]); document.getElementById('sd-top')?.scrollIntoView({ block: 'nearest' }) }
  function onTabKey(e) {
    const n = e.key === 'ArrowRight' ? (here + 1) % TABS.length : e.key === 'ArrowLeft' ? (here + TABS.length - 1) % TABS.length : null
    if (n === null) return
    e.preventDefault(); setTab(TABS[n][0]); document.getElementById(`sd-tab-${TABS[n][0]}`)?.focus()
  }

  return (
    <Shell wide title={isNew ? 'New subscription' : `Subscription · ${initial.customer || initial.workspaceId}`}
      subtitle="One cycle is billed now; each next one is recorded from Renewals." onClose={onClose}>
      <form onSubmit={submit} className="flex flex-col min-h-full">
        <div id="sd-top"/>
        {/* ── the client ── */}
        <div className="px-4 sm:px-6 py-4 bg-slate-50/70 border-b border-slate-200 rounded-t-2xl">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            <h3 className="text-sm font-bold text-slate-900">Client</h3>
            {picker && <div className="w-full sm:w-80 sm:ml-auto">{picker}</div>}
            {!picker && !isNew && !editClient && client?.profile && (
              <button type="button" onClick={() => setEditClient(true)} className="ml-auto inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline"><Pencil size={12}/> Edit details</button>
            )}
          </div>
          {!isNew && !editClient ? (
            <div className="flex items-center gap-3 mt-3">
              <span className="w-10 h-10 rounded-full bg-primary/10 text-primary text-sm font-bold flex items-center justify-center flex-shrink-0">{initialsOf(prof.legalName || ws)}</span>
              <div className="min-w-0 flex-1">
                <div className="font-semibold text-slate-900 truncate">{prof.legalName || ws}</div>
                <div className="text-xs text-slate-500 truncate">{[prof.contactName, prof.email, prof.phone && `+91 ${prof.phone}`].filter(Boolean).join(' · ')}</div>
              </div>
              {client && (
                <div className="text-right text-xs text-slate-500 flex-shrink-0">
                  <StatusPill status={client.status}/>
                  {client.planName && <div className="mt-1 hidden sm:block">{client.planName} until {fmtDate(client.currentEnd)}</div>}
                </div>
              )}
              {picker && client?.profile && <button type="button" onClick={() => setEditClient(true)} className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline flex-shrink-0"><Pencil size={12}/> Edit</button>}
            </div>
          ) : (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3 mt-3">
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
                  <span className="px-3 py-2 text-sm text-slate-500 border border-r-0 border-slate-200 rounded-l-lg bg-white">+91</span>
                  <input id="sd-phone" inputMode="numeric" value={prof.phone} onChange={(e) => setP('phone', e.target.value)} className={clsx(inputCls, 'rounded-l-none')}/>
                </div>
              </Field>
            </div>
          )}
        </div>

        {/* ── tabs ── */}
        <div role="tablist" aria-label="Subscription steps" onKeyDown={onTabKey} className="flex gap-1 px-2 sm:px-4 border-b border-slate-200 overflow-x-auto">
          {TABS.map(([id, label], i) => (
            <button key={id} type="button" role="tab" id={`sd-tab-${id}`} aria-selected={tab === id} aria-controls={`sd-panel-${id}`} tabIndex={tab === id ? 0 : -1} onClick={() => setTab(id)}
              className={clsx('relative inline-flex items-center gap-2 px-3 sm:px-4 py-3.5 text-sm font-semibold whitespace-nowrap outline-none focus-visible:bg-slate-50 transition-colors', tab === id ? 'text-primary' : 'text-slate-500 hover:text-slate-800')}>
              <span className={clsx('w-5 h-5 rounded-full text-[11px] flex items-center justify-center', tab === id ? 'bg-primary text-white' : 'bg-slate-100 text-slate-500')}>{i < here && !tabHasError(id) ? <Check size={11}/> : i + 1}</span>
              {label}
              {tabHasError(id) && <span aria-label="has an error" className="w-1.5 h-1.5 rounded-full bg-red-500"/>}
              {tab === id && <span className="absolute inset-x-3 -bottom-px h-0.5 rounded-full bg-primary"/>}
            </button>
          ))}
        </div>

        {/* ── the tab ── */}
        <div role="tabpanel" id={`sd-panel-${tab}`} aria-labelledby={`sd-tab-${tab}`} key={tab} className="flex-1 px-4 sm:px-6 py-6 space-y-8 animate-fade-in">
          {tab === 'plan' && (
            <>
              <Block title="Plan" aside={<Segmented label="Billing period" value={period} onChange={changePeriod} size="sm" options={[['monthly', 'Monthly'], ['yearly', 'Yearly']]}/>}>
                <div role="radiogroup" aria-label="Plan" className="grid grid-cols-[repeat(auto-fill,minmax(150px,1fr))] gap-2.5">
                  {plans.map((p) => (
                    <label key={p.id} className={clsx('relative border rounded-xl px-3.5 py-3 cursor-pointer transition-colors has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-primary/30',
                      plan === p.id ? 'border-primary bg-primary/5' : 'border-slate-200 hover:border-slate-300')}>
                      <input type="radio" name="sd-plan" value={p.id} checked={plan === p.id} onChange={() => changePlan(p.id)} className="sr-only"/>
                      {plan === p.id && <Check size={14} className="absolute top-3 right-3 text-primary"/>}
                      <div className="text-sm font-semibold text-slate-900 pr-5 truncate">{p.name}</div>
                      <div className="text-xs text-slate-500">{rupees(p[period])} / {period === 'yearly' ? 'yr' : 'mo'}</div>
                    </label>
                  ))}
                </div>
              </Block>

              <Block title="Items & pricing" hint="Change a price to give this client their own rate. Prices are before GST.">
                <ul className="rounded-xl border border-slate-200 divide-y divide-slate-100 bg-white">
                  <Line title={`${planDef?.name} plan`} sub={<><span>Billed every {unit}</span><Sac sac={sac}/></>}
                    price={<Money label="Plan price" value={priceOf('plan')} onChange={(v) => setPrices((x) => ({ ...x, plan: v }))} className="w-28"/>}
                    discount={discMode === 'item' && <LineDiscount label="the plan" value={itemDisc.plan || { type: 'percent', value: '' }} onChange={(d) => setItemDisc((x) => ({ ...x, plan: d }))}/>}
                    amount={lineAmount('plan', 1)} per={`per ${unit}`}/>
                  {chosen.map((c) => {
                    const def = addonDefs.find((d) => d.id === c.id)
                    return (
                      <Line key={c.id} title={def?.name} sub={<><span>{def?.unit}</span><Sac sac={sac}/></>}
                        qty={def?.maxQty > 1 ? <Stepper label={def.name} value={c.qty} max={def.maxQty} onChange={(q) => setQty(c.id, q)}/> : null}
                        price={<Money label={`${def?.name} price`} value={priceOf(c.id)} onChange={(v) => setPrices((x) => ({ ...x, [c.id]: v }))} className="w-28"/>}
                        discount={discMode === 'item' && <LineDiscount label={def?.name} value={itemDisc[c.id] || { type: 'percent', value: '' }} onChange={(d) => setItemDisc((x) => ({ ...x, [c.id]: d }))}/>}
                        amount={lineAmount(c.id, c.qty)} per={`per ${unit}`} onRemove={() => removeAddon(c.id)}/>
                    )
                  })}
                  {addable.length > 0 && (
                    <li className="px-4 py-3 bg-slate-50/70 rounded-b-xl">
                      <div className="max-w-xs">
                        <Select size="sm" value="" onChange={addAddon} placeholder="+ Add an add-on"
                          options={addable.map((d) => ({ value: d.id, label: d.name, sub: `${rupees(d[period])} / ${unit} · ${d.unit}` }))}/>
                      </div>
                    </li>
                  )}
                </ul>

                <div className="flex flex-wrap items-center gap-x-5 gap-y-3 pt-1">
                  <Segmented label="Discount" value={discMode} onChange={setDiscMode} size="sm" options={[['none', 'No discount'], ['item', 'Per item'], ['total', 'On the total']]}/>
                  {discMode !== 'none' && (
                    <label className="inline-flex items-center gap-2.5 text-sm text-slate-700 cursor-pointer">
                      <Switch checked={discountRenews} onChange={setDiscountRenews} label="Keep the discount on every renewal"/>
                      Keep it on every renewal
                    </label>
                  )}
                </div>
                {discMode === 'total' && (
                  <div className="grid sm:grid-cols-[minmax(0,1fr)_160px_130px] gap-3 rounded-xl border border-slate-200 bg-slate-50/60 p-3">
                    <Field id="sd-dname" label="Discount name"><input id="sd-dname" value={totalDisc.name} maxLength={60} onChange={(e) => setTotalDisc((d) => ({ ...d, name: e.target.value }))} className={inputCls}/></Field>
                    <Field id="sd-dtype" label="Type"><Select value={totalDisc.type} onChange={(type) => setTotalDisc((d) => ({ ...d, type }))} options={[{ value: 'flat', label: 'Flat (₹)' }, { value: 'percent', label: 'Percentage (%)' }]}/></Field>
                    <Field id="sd-dval" label="Value"><input id="sd-dval" type="number" min={0} step="any" value={totalDisc.value} placeholder="0" onChange={(e) => setTotalDisc((d) => ({ ...d, value: e.target.value }))} className={clsx(inputCls, 'text-right')}/></Field>
                  </div>
                )}
              </Block>

              <Block title="Schedule" hint="When it starts and how long it runs">
                <div className="grid sm:grid-cols-2 gap-x-8 gap-y-5">
                  <Field id="sd-start" label="Start date" hint={start === 'date' ? 'Backdated — the plan counts from this date.' : start === 'after_current' ? 'Runs on from when their current plan ends.' : 'You can go back up to a year.'}>
                    <div className={clsx(start === 'after_current' && 'pointer-events-none opacity-60')}>
                      <DatePicker value={startShown} onChange={(v) => { setStartDate(v); setStart(v === today() ? 'now' : 'date') }} min={yearAgo()} max={today()} textSize="text-sm"/>
                    </div>
                    <Segmented label="Start" value={start === 'date' ? '' : start} onChange={pickStart} size="sm" className="mt-2"
                      options={[['now', 'Today'], ...(canContinue ? [['after_current', `After current plan (${fmtDate(client.currentEnd)})`]] : [])]}/>
                  </Field>
                  <Field id="sd-expires" label="Runs for" hint={never ? 'Renews every cycle until it is cancelled.' : `Ends after ${expiresAfter || 1} ${period === 'yearly' ? 'years' : 'months'} in all.`}>
                    <label className="flex items-center gap-2.5 text-sm text-slate-700 cursor-pointer py-1.5">
                      <Switch id="sd-expires" checked={never} onChange={setNever} label="Never expires"/> Never expires
                    </label>
                    {!never && (
                      <div className="flex mt-1.5 max-w-[200px]">
                        <input aria-label="Cycles" type="number" min={1} max={120} value={expiresAfter} onChange={(e) => setExpiresAfter(e.target.value)} className={clsx(inputCls, 'rounded-r-none')}/>
                        <span className="px-3 py-2 text-sm text-slate-500 border border-l-0 border-slate-200 rounded-r-lg bg-slate-50">cycles</span>
                      </div>
                    )}
                  </Field>
                  <Field id="sd-sales" label="Salesperson" className="sm:col-span-2 sm:max-w-sm">
                    <Select value={salesperson} onChange={setSalesperson} placeholder="Select a salesperson"
                      options={[{ value: '', label: 'None' }, ...team.map((s) => ({ value: s.email, label: s.name ? `${s.name} (${s.email})` : s.email }))]}/>
                  </Field>
                </div>
                {quoteError && <ErrorNote>{quoteError}</ErrorNote>}
              </Block>
            </>
          )}

          {tab === 'client' && (
            <>
              <Block title="Tax details">
                <div className="grid sm:grid-cols-2 gap-4">
                  <Field id="sd-gtt" label="GST treatment" required error={fe('gstTreatment')}>
                    <Select value={prof.gstTreatment} onChange={(v) => setP('gstTreatment', v)} options={GST_TREATMENTS}/>
                  </Field>
                  {hasGstin(prof.gstTreatment) && (
                    <Field id="sd-gstin" label="GSTIN" required error={fe('gstin')}>
                      <input id="sd-gstin" value={prof.gstin} onChange={(e) => setP('gstin', e.target.value.toUpperCase())} maxLength={15} className={clsx(inputCls, 'font-mono uppercase')}/>
                    </Field>
                  )}
                  <Field id="sd-pan" label="PAN" error={fe('pan')}>
                    <input id="sd-pan" value={prof.pan} maxLength={10} onChange={(e) => setP('pan', e.target.value.toUpperCase())} className={clsx(inputCls, 'font-mono uppercase')}/>
                  </Field>
                  <Field id="sd-terms" label="Payment terms" error={fe('paymentTerms')}>
                    <Select value={prof.paymentTerms} onChange={(v) => setP('paymentTerms', v)} options={TERMS}/>
                  </Field>
                  <Field id="sd-taxpref" label="Tax preference">
                    <Segmented label="Tax preference" value={prof.taxExempt ? 'exempt' : 'taxable'} onChange={(v) => setP('taxExempt', v === 'exempt')} options={[['taxable', 'Taxable'], ['exempt', 'Tax exempt']]}/>
                  </Field>
                </div>
              </Block>

              <Block title="Addresses">
                <div className="grid md:grid-cols-2 gap-x-8 gap-y-6">
                  <div>
                    <h4 className="text-xs font-bold uppercase tracking-wide text-slate-500 mb-3">Billing</h4>
                    <AddressFields prefix="address" value={prof.address} onChange={(v) => setP('address', v)} states={states} fe={fe}/>
                  </div>
                  <div>
                    <h4 className="text-xs font-bold uppercase tracking-wide text-slate-500 mb-3 flex flex-wrap items-center gap-2">Shipping
                      <button type="button" onClick={() => setP('shipping', { ...prof.address })} className="inline-flex items-center gap-0.5 text-xs font-semibold normal-case tracking-normal text-primary hover:underline">
                        <ArrowDown size={11}/> Copy billing address
                      </button>
                    </h4>
                    <AddressFields prefix="shipping" value={prof.shipping} onChange={(v) => setP('shipping', v)} states={states} fe={fe}/>
                  </div>
                </div>
              </Block>

              <Block title="Other contacts" hint="Besides the contact person above"
                aside={<button type="button" disabled={prof.contacts.length >= 10} onClick={() => setP('contacts', [...prof.contacts, { name: '', email: '', phone: '', role: '' }])}
                  className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline disabled:opacity-50"><Plus size={13}/> Add contact</button>}>
                {prof.contacts.length === 0 && <p className="text-xs text-slate-400">No other contacts.</p>}
                <div className="space-y-2">
                  {prof.contacts.map((c, i) => {
                    const set = (k, v) => setP('contacts', prof.contacts.map((x, j) => (j === i ? { ...x, [k]: v } : x)))
                    return (
                      <div key={i} className="grid grid-cols-2 lg:grid-cols-[1fr_1fr_1fr_1fr_auto] gap-2 items-start rounded-xl border border-slate-200 p-2.5">
                        {[['name', 'Name'], ['email', 'Email'], ['phone', 'Mobile'], ['role', 'Designation']].map(([k, ph]) => (
                          <div key={k}>
                            <input aria-label={`Contact ${i + 1} ${k}`} placeholder={ph} value={c[k]} onChange={(e) => set(k, e.target.value)} className={clsx(inputCls, 'py-1.5')}/>
                            {fe(`contacts.${i}.${k}`) && <p className="text-[11px] text-red-600 mt-1">{fe(`contacts.${i}.${k}`)}</p>}
                          </div>
                        ))}
                        <button type="button" onClick={() => setP('contacts', prof.contacts.filter((_, j) => j !== i))} aria-label={`Remove contact ${i + 1}`} className="p-2 rounded-md text-slate-400 hover:text-red-600 hover:bg-red-50 justify-self-end"><X size={15}/></button>
                      </div>
                    )
                  })}
                </div>
              </Block>

              <Block title="Documents" hint="A PO, the signed agreement …">
                {isNew || !client
                  ? <p className="text-xs text-slate-500">Create the subscription first — then attach files here or from the client's page.</p>
                  : <ClientDocuments token={token} workspaceId={ws} initial={client.documents || []} canEdit/>}
              </Block>
            </>
          )}

          {tab === 'payment' && (
            <>
              <Block title="How is it being paid?">
                <div className="grid sm:grid-cols-2 gap-3">
                  <OptionCard name="sd-pay" checked={offline} onChange={() => setOffline(true)} icon={<Banknote size={18}/>} title="Collect payment offline" text="They paid by bank transfer, UPI, cheque or cash. A GST invoice is made."/>
                  <OptionCard name="sd-pay" checked={!offline} onChange={() => setOffline(false)} icon={<Gift size={18}/>} title="Free" text="No payment and no invoice."/>
                </div>
              </Block>
              {offline && (
                <Block title="Amount received" hint="Including GST">
                  <div className="flex flex-wrap items-center gap-3">
                    <Money id="sd-amount" label="Amount received" value={amount} onChange={(v) => { setAmount(v); setAmountTouched(true) }} className="w-52 [&_input]:text-base [&_input]:py-2.5 [&_input]:font-semibold"/>
                    {quote && <span className="text-sm text-slate-500">Total due <b className="text-slate-900 tabular-nums">{rupees(quote.charge.total)}</b></span>}
                  </div>
                  {differs && (
                    <p className="text-xs text-amber-700 flex items-center gap-2">
                      <AlertCircle size={14} className="flex-shrink-0"/> This is different from the total, so the invoice shows the difference as a price adjustment.
                      <button type="button" onClick={() => setAmountTouched(false)} className="font-semibold underline whitespace-nowrap">Use the total</button>
                    </p>
                  )}
                </Block>
              )}
            </>
          )}

          {tab === 'summary' && (
            <>
              {missing.length > 0 && (
                <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 flex flex-wrap items-center gap-x-3 gap-y-2">
                  <AlertCircle size={16} className="flex-shrink-0"/>
                  <span className="font-semibold">Still needed for the invoice:</span>
                  {missing.map((m) => (m.tab
                    ? <button key={m.label} type="button" onClick={() => setTab(m.tab)} className="underline font-medium">{m.label}</button>
                    : <span key={m.label} className="font-medium">{m.label} <span className="font-normal text-amber-700">(at the top)</span></span>))}
                </div>
              )}
              {quoteError && <ErrorNote>{quoteError}</ErrorNote>}
              {!quote && !quoteError && <p className="text-sm text-slate-400 flex items-center gap-2"><Loader2 size={14} className="animate-spin"/> Working out the price…</p>}
              {quote && (
                <div className="grid md:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)] gap-6 items-start">
                  <div className="rounded-2xl border border-slate-200 overflow-hidden">
                    <div className="px-5 py-4 bg-slate-50 border-b border-slate-200 flex items-center gap-3">
                      <span className="w-9 h-9 rounded-full bg-primary/10 text-primary text-xs font-bold flex items-center justify-center flex-shrink-0">{initialsOf(prof.legalName || ws)}</span>
                      <div className="min-w-0">
                        <div className="text-sm font-bold text-slate-900 truncate">{prof.legalName || 'New client'}</div>
                        <div className="text-xs text-slate-500 truncate">{planDef?.name} · every {unit}</div>
                      </div>
                    </div>
                    <dl className="px-5 py-4 space-y-2.5">
                      {lines.map((l, i) => (
                        <div key={i} className={clsx('flex justify-between gap-4', l.amount < 0 ? 'text-emerald-700' : 'text-slate-700')}>
                          <dt className="min-w-0 text-xs leading-5">{l.description}{l.qty > 1 ? ` × ${l.qty}` : ''}</dt>
                          <dd className="tabular-nums whitespace-nowrap text-xs leading-5">{l.amount < 0 ? `−${rupees(-l.amount)}` : rupees(l.amount)}</dd>
                        </div>
                      ))}
                      <div className="flex justify-between gap-4 pt-2.5 border-t border-slate-100 text-slate-500"><dt className="text-xs">Taxable value</dt><dd className="text-xs tabular-nums">{rupees(quote.charge.base)}</dd></div>
                      {quote.charge.gstPercent === 0
                        ? <div className="flex justify-between text-slate-500"><dt className="text-xs">GST</dt><dd className="text-xs">Exempt</dd></div>
                        : quote.charge.tax.kind === 'intra'
                          ? <>
                              <div className="flex justify-between text-slate-500"><dt className="text-xs">CGST ({quote.charge.gstPercent / 2}%)</dt><dd className="text-xs tabular-nums">{rupees(quote.charge.tax.cgst)}</dd></div>
                              <div className="flex justify-between text-slate-500"><dt className="text-xs">SGST ({quote.charge.gstPercent / 2}%)</dt><dd className="text-xs tabular-nums">{rupees(quote.charge.tax.sgst)}</dd></div>
                            </>
                          : <div className="flex justify-between text-slate-500"><dt className="text-xs">{quote.charge.tax.kind === 'inter' ? 'IGST' : 'GST'} ({quote.charge.gstPercent}%)</dt><dd className="text-xs tabular-nums">{rupees(quote.charge.gst)}</dd></div>}
                    </dl>
                    <div className="flex items-baseline justify-between px-5 py-4 bg-primary/5 border-t border-slate-200">
                      <span className="text-sm font-semibold text-slate-700">Total due now</span>
                      <span className="text-2xl font-bold text-slate-900 tabular-nums">{rupees(quote.charge.total)}</span>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <h3 className="text-sm font-bold text-slate-900">What happens next</h3>
                    <ul className="space-y-3 text-sm text-slate-600">
                      {[
                        <>Runs <b className="text-slate-900">{fmtDate(quote.from)}</b> to <b className="text-slate-900">{fmtDate(quote.end)}</b>{start === 'after_current' ? ', after their current plan' : start === 'date' ? ' (backdated)' : ''}.</>,
                        quote.renewal != null
                          ? <>Then <b className="text-slate-900">{rupees(quote.renewal)}</b> every {unit}{quote.expiresAfter ? `, ${quote.expiresAfter - quote.cycles} more time${quote.expiresAfter - quote.cycles > 1 ? 's' : ''}` : ' until cancelled'}. You record each payment on Renewals.</>
                          : 'Nothing more after this cycle.',
                        offline ? <><b className="text-slate-900">{rupees(Number(amount) || 0)}</b> is recorded as paid offline and a GST invoice is made.</> : 'Free — no payment and no invoice.',
                        quote.discountTotal > 0 && <>The client saves <b className="text-emerald-700">{rupees(quote.discountTotal)}</b> before GST{discMode !== 'none' && (discountRenews ? ', on every renewal' : ', on this first cycle only')}.</>,
                        salesperson && <>Salesperson: <b className="text-slate-900">{team.find((t) => t.email === salesperson)?.name || salesperson}</b>.</>,
                      ].filter(Boolean).map((t, i) => (
                        <li key={i} className="flex gap-2.5"><Check size={15} className="text-primary mt-0.5 flex-shrink-0"/><span>{t}</span></li>
                      ))}
                    </ul>
                    {autopayOn && (
                      <label className="flex items-start gap-2 text-xs text-amber-900 bg-amber-50 border border-amber-200 rounded-lg p-3 cursor-pointer">
                        <input type="checkbox" checked={stopAutopay} onChange={(e) => setStopAutopay(e.target.checked)} className="mt-0.5 accent-primary"/>
                        <span>This client is on autopay. <b>Stop their autopay</b> — otherwise they would be charged for this period as well.</span>
                      </label>
                    )}
                  </div>
                </div>
              )}
            </>
          )}
          <ErrorNote>{error}</ErrorNote>
        </div>

        {/* ── always in view ── */}
        <div className="sticky bottom-0 z-10 border-t border-slate-200 bg-white/95 backdrop-blur px-4 sm:px-6 py-3 flex items-center gap-3 rounded-b-2xl">
          <div className="flex-1 min-w-0">
            <div className="text-[11px] text-slate-500">Total due now · incl. GST</div>
            <div className="flex items-baseline gap-2">
              <span className="text-lg font-bold text-slate-900 tabular-nums">{quote ? rupees(quote.charge.total) : '—'}</span>
              {quote?.renewal != null && <span className="text-xs text-slate-400 truncate hidden sm:inline">then {rupees(quote.renewal)} / {unit}</span>}
            </div>
          </div>
          {here === 0
            ? <button type="button" onClick={onClose} className={btnGhost}>Cancel</button>
            : <button type="button" onClick={() => go(here - 1)} className={btnGhost}><ArrowLeft size={15}/> Back</button>}
          {here < TABS.length - 1
            ? <button type="button" onClick={() => go(here + 1)} className={btnPrimary}>Next <ArrowRight size={15}/></button>
            : <button type="submit" disabled={blocked} className={btnPrimary}>{saving && <Loader2 size={14} className="animate-spin"/>} {isNew ? 'Create subscription' : 'Save subscription'}</button>}
        </div>
      </form>
    </Shell>
  )
}
