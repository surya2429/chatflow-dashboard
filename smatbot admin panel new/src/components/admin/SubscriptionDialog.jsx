// SubscriptionDialog.jsx — staff set up a client's subscription in four short tabs:
//   Plan & schedule · Client details · Payment · Summary
// The plan comes first: a slim header names the client, and everything about them (contact, tax,
// addresses, files) lives in its own tab. The total due and Back / Next stay pinned below, and a tab
// shows a tick only when what it needs is really filled in. The price is the server's own quote —
// exactly what will be invoiced. One cycle is billed now; each next one is recorded from Renewals at
// these prices until it expires after N cycles (or never). Admins only. A dialog, or (inline) the
// Add subscription page.
import { useEffect, useRef, useState } from 'react'
import clsx from 'clsx'
import { Loader2, X, Plus, ArrowLeft, ArrowRight, Check, Pencil, Layers, Building2, Wallet, ReceiptText, Banknote, Gift, AlertCircle, CalendarClock, Repeat, BadgeCheck, Sparkles, Receipt } from 'lucide-react'
import { billingAdmin } from '../../lib/billingApi'
import DatePicker from '../DatePicker'
import Select from '../Select'
import ClientDocuments from './ClientDocuments'
import { Segmented, Switch, Stepper, OptionCard, Money } from './controls'
import { Modal, ErrorNote, StatusPill, labelCls, btnGhost, rupees, fmtDate, initialsOf } from './ui'

const ymd = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
const today = () => ymd(new Date())
const startOfDay = (s) => Math.floor(new Date(`${s}T00:00:00`).getTime() / 1000)
const yearAgo = () => { const d = new Date(); d.setFullYear(d.getFullYear() - 1); return ymd(d) }
const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40)
const compact = (n) => Number(n).toLocaleString('en-IN', { notation: 'compact', maximumFractionDigits: 1 })
const planFacts = (p) => [p.limits?.wa_service != null && `${compact(p.limits.wa_service)} service msgs`, p.limits?.chatbots != null && `${p.limits.chatbots} chatbots`].filter(Boolean).join(' · ')

// Inputs for this form: roomier and rounder than the rest of the admin.
const inp = 'w-full h-10 border border-slate-200 rounded-xl px-3 text-sm text-slate-900 bg-white outline-none transition placeholder:text-slate-400 focus:border-primary focus:ring-4 focus:ring-primary/10 disabled:bg-slate-50 disabled:text-slate-500'
const primaryBtn = 'inline-flex items-center justify-center gap-1.5 h-10 px-5 rounded-xl bg-primary text-white text-sm font-semibold shadow-sm shadow-primary/20 hover:bg-primary-hover transition disabled:opacity-50 disabled:shadow-none disabled:cursor-not-allowed'
const ghostBtn = `${btnGhost} h-10 rounded-xl`

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
const TABS = [['client', 'Client details', Building2], ['plan', 'Plan & schedule', Layers], ['payment', 'Payment', Wallet], ['summary', 'Summary', ReceiptText]]
const DISCOUNT_MODES = [{ value: 'none', label: 'No discounts' }, { value: 'item', label: 'Item-level' }, { value: 'total', label: 'Transaction-level' }]
const hasGstin = (t) => t === 'registered' || t === 'sez'
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
    <section className="space-y-4">
      <div className="flex items-end gap-3">
        <div className="flex-1 min-w-0">
          <h3 className="text-[15px] font-semibold text-slate-900">{title}</h3>
          {hint && <p className="text-[13px] text-slate-500 mt-0.5">{hint}</p>}
        </div>
        {aside}
      </div>
      {children}
    </section>
  )
}

/* A small label over a value. */
const Detail = ({ k, children }) => (
  <div className="min-w-0">
    <dt className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">{k}</dt>
    <dd className="text-slate-900 mt-0.5 break-words">{children}</dd>
  </div>
)
const money2 = (n) => `₹${Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

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
        <input id={`${prefix}-att`} value={value.attention} onChange={(e) => set('attention', e.target.value)} className={inp}/>
      </Field>
      <Field id={`${prefix}-l1`} label="Address" error={fe(`${prefix}.line1`) || fe(`${prefix}.line2`)}>
        <input id={`${prefix}-l1`} value={value.line1} onChange={(e) => set('line1', e.target.value)} placeholder="Street 1" className={inp}/>
        <input aria-label="Street 2" value={value.line2} onChange={(e) => set('line2', e.target.value)} placeholder="Street 2" className={clsx(inp, 'mt-2')}/>
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field id={`${prefix}-city`} label="City" error={fe(`${prefix}.city`)}>
          <input id={`${prefix}-city`} value={value.city} onChange={(e) => set('city', e.target.value)} className={inp}/>
        </Field>
        <Field id={`${prefix}-pin`} label="PIN code" error={fe(`${prefix}.pincode`)}>
          <input id={`${prefix}-pin`} inputMode="numeric" maxLength={6} value={value.pincode} onChange={(e) => set('pincode', e.target.value.replace(/\D/g, ''))} className={inp}/>
        </Field>
      </div>
      <Field id={`${prefix}-state`} label={prefix === 'address' ? 'State (place of supply)' : 'State'} error={fe(`${prefix}.stateCode`)}>
        <Select value={value.stateCode} onChange={(v) => set('stateCode', v)} placeholder="Select or type to search" options={states.map((s) => ({ value: s.code, label: `[${s.code}] ${s.name}` }))}/>
      </Field>
    </div>
  )
}

/* The %-or-₹ discount on one line. */
function LineDiscount({ label, value, onChange }) {
  return (
    <div className="flex h-9 rounded-lg border border-slate-200 bg-white focus-within:border-primary focus-within:ring-4 focus-within:ring-primary/10 overflow-hidden transition">
      <input type="number" min={0} step="any" aria-label={`Discount on ${label}`} value={value.value} placeholder="Discount" onChange={(e) => onChange({ ...value, value: e.target.value })}
        className="w-20 px-2 text-sm text-right outline-none tabular-nums bg-transparent"/>
      <select aria-label={`Discount type for ${label}`} value={value.type} onChange={(e) => onChange({ ...value, type: e.target.value })}
        className="border-l border-slate-200 bg-slate-50 px-1.5 text-xs text-slate-600 outline-none">
        <option value="percent">%</option><option value="flat">₹</option>
      </select>
    </div>
  )
}

/* One line of the subscription: the plan, or an add-on. */
function Line({ icon, title, sub, billing, qty, price, discount, tax, amount, per, onRemove }) {
  return (
    <li className="px-4 py-4 flex flex-wrap items-center gap-x-4 gap-y-3">
      <span className="w-9 h-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center flex-shrink-0">{icon}</span>
      <div className="flex-1 min-w-[150px]">
        <div className="text-sm font-semibold text-slate-900">{title}</div>
        <div className="text-xs text-slate-500 mt-0.5">{sub}</div>
        {billing && <div className="mt-2">{billing}</div>}
      </div>
      <div className="flex flex-wrap items-center justify-end gap-3 ml-auto">
        {qty}{price}{discount}
        <div className="w-16 text-center text-xs font-medium text-slate-500" title="Tax">{tax}</div>
        <div className="w-24 text-right">
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
  return <div className="bg-white border border-slate-200/70 rounded-3xl shadow-sm max-w-4xl mx-auto w-full">{children}</div>
}

export default function SubscriptionDialog({ token, initial, plans: allPlans, addonDefs, states, sac = '998314', gstPercent = 18, onDone, onClose, inline, picker }) {
  const Shell = inline ? Page : Modal
  // Plans on sale (public or private), plus the one the client is on even if it is archived.
  const plans = allPlans.filter((p) => p.status === 'active' || p.id === initial?.plan)
  const isNew = !initial?.workspaceId
  const [tab, setTab] = useState('client')
  const [ws, setWs] = useState(initial?.workspaceId || '')
  const [wsTouched, setWsTouched] = useState(false)
  const [prof, setProf] = useState(EMPTY_PROFILE)
  const [sameShip, setSameShip] = useState(true)    // shipping address = billing address (nothing extra is saved)
  const [client, setClient] = useState(null)        // the full client record once loaded
  const [editClient, setEditClient] = useState(isNew)
  const [team, setTeam] = useState([])
  const [plan, setPlan] = useState(initial?.plan || 'standard')
  const [period, setPeriod] = useState(initial?.period || 'monthly')
  const [addons, setAddons] = useState(() => (initial?.addons || []).map((a) => ({ id: a.id, qty: a.qty })))
  const [monthlyIds, setMonthlyIds] = useState([])   // add-ons bought at the monthly price on a yearly plan (30 days)
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
      if (c.profile) { setProf(fromProfile(c.profile)); setSameShip(!c.profile.shipping) } else setEditClient(true)
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
  const isMonthly = (id) => period === 'yearly' && monthlyIds.includes(id)
  const listPrice = (id) => (id === 'plan' ? planDef?.[period] : addonDefs.find((a) => a.id === id)?.[isMonthly(id) ? 'monthly' : period]) ?? 0
  const priceOf = (id) => prices[id] ?? String(listPrice(id))
  // "After the current plan ends" is for a client with a running plan — any plan can follow it.
  const canContinue = Boolean(client && ['active', 'past_due'].includes(client.status) && client.currentEnd && client.currentEnd * 1000 > Date.now())
  const scheduled = start === 'after_current'
  const unit = period === 'yearly' ? 'year' : 'month'
  const taxLabel = prof.taxExempt ? 'Exempt' : `GST ${quote?.charge.gstPercent || gstPercent}%`

  const discounts = discMode === 'item'
    ? Object.entries(itemDisc).filter(([t, d]) => Number(d.value) > 0 && (t === 'plan' || chosen.some((a) => a.id === t))).map(([target, d]) => ({ target, type: d.type, value: Number(d.value) }))
    : discMode === 'total' && Number(totalDisc.value) > 0 ? [{ target: 'total', type: totalDisc.type, value: Number(totalDisc.value), name: totalDisc.name }] : []
  const sentPrices = Object.fromEntries(Object.entries(prices).filter(([k, v]) => v !== '' && (k === 'plan' || chosen.some((a) => a.id === k))).map(([k, v]) => [k, Number(v)]))
  const sub = {
    workspaceId: ws.trim(), plan, period, addons: chosen, prices: sentPrices, discounts, discountRenews,
    monthlyAddons: period === 'yearly' ? monthlyIds.filter((id) => chosen.some((c) => c.id === id)) : [],
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
    setMonthlyIds((ids) => ids.filter((x) => ok.includes(x)))
  }
  function changePeriod(p) { setPeriod(p); setPrices({}); setMonthlyIds([]) }   // typed prices are per cycle, so they start over
  const addAddon = (id) => id && setAddons((list) => (list.some((a) => a.id === id) ? list : [...list, { id, qty: 1 }]))
  const setQty = (id, qty) => setAddons((list) => list.map((a) => (a.id === id ? { ...a, qty } : a)))
  function removeAddon(id) {
    setAddons((list) => list.filter((a) => a.id !== id))
    setPrices(({ [id]: _p, ...rest }) => rest)
    setItemDisc(({ [id]: _d, ...rest }) => rest)
    setMonthlyIds((ids) => ids.filter((x) => x !== id))
  }
  function setMonthly(id, on) {                          // with the plan (yearly price) or by the month (30 days)
    setMonthlyIds((ids) => (on ? [...ids.filter((x) => x !== id), id] : ids.filter((x) => x !== id)))
    setPrices(({ [id]: _p, ...rest }) => rest)             // a typed price belonged to the other billing
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
    if (blockReason) return                   // Enter in a field can submit while Create is disabled
    setSaving(true); setError(''); setFields({})
    try {
      const row = await billingAdmin.plan(token, {
        ...sub, salesperson, stopAutopay,
        profile: { ...prof, gstin: hasGstin(prof.gstTreatment) ? prof.gstin : '', shipping: sameShip ? null : prof.shipping },
        ...(scheduled ? {} : { payment: offline ? { type: 'offline', amount: Number(amount) } : { type: 'free' } }),   // a scheduled one is paid when it starts
      })
      onDone(row)
    } catch (err) {
      if (err.fields) {
        setFields(err.fields)
        setEditClient(true)
        if (Object.keys(err.fields).some((f) => f.startsWith('shipping.'))) setSameShip(false)
        setTab('client')
      }
      setError(err.message)
      setSaving(false)
    }
  }

  const fe = (k) => fields[k]
  const autopayOn = quote?.autopayRunning
  const lines = quote?.charge.lines ?? []
  const startShown = start === 'after_current' && client?.currentEnd ? ymd(new Date(client.currentEnd * 1000)) : startDate
  const differs = quote && amountTouched && Math.abs(Number(amount) - quote.charge.total) >= 0.01
  const a = prof.address
  // What the invoice still needs; the server checks it all again on Create.
  const missing = [
    !ws.trim() && 'Workspace ID', !prof.legalName.trim() && 'Customer name', !prof.contactName.trim() && 'Contact person', !prof.email.trim() && 'Email', !prof.phone.trim() && 'Mobile',
    !a.line1.trim() && 'Billing address', !a.city.trim() && 'City', !a.pincode && 'PIN code', !a.stateCode && 'State',
    hasGstin(prof.gstTreatment) && !prof.gstin.trim() && 'GSTIN',
  ].filter(Boolean)
  // A tick means the tab really has what it needs; a dot means the server turned something down in it.
  const done = { plan: Boolean(quote) && !quoteError, client: missing.length === 0, payment: scheduled || !offline || Number(amount) >= 1, summary: false }
  const hasError = { plan: Boolean(quoteError), client: Object.keys(fields).length > 0, payment: false, summary: false }
  const blockReason = saving ? 'Saving…' : !ws.trim() ? 'Add a workspace ID in Client details' : !quote ? (quoteError || 'Working out the price…')
    : autopayOn && !stopAutopay ? 'Confirm stopping their autopay' : !scheduled && offline && !(Number(amount) >= 1) ? 'Enter the amount received in Payment' : ''
  const here = TABS.findIndex(([id]) => id === tab)
  const go = (i) => { setTab(TABS[i][0]); document.getElementById('sd-top')?.scrollIntoView({ block: 'nearest' }) }
  function onTabKey(e) {
    const n = e.key === 'ArrowRight' ? (here + 1) % TABS.length : e.key === 'ArrowLeft' ? (here + TABS.length - 1) % TABS.length : null
    if (n === null) return
    e.preventDefault(); setTab(TABS[n][0]); document.getElementById(`sd-tab-${TABS[n][0]}`)?.focus()
  }
  const showName = prof.legalName.trim() || (isNew ? 'New client' : initial.customer || ws)
  // The invoice as the server priced it, split so every number can be read: price, discount, amount.
  const itemRows = lines.filter((l) => l.kind === 'plan' || l.kind === 'addon').map((l) => {
    const key = l.kind === 'plan' ? 'plan' : l.id
    const def = l.kind === 'addon' ? addonDefs.find((d) => d.id === l.id) : null
    const monthly = l.kind === 'addon' && isMonthly(l.id)
    const listRate = l.kind === 'plan' ? planDef?.[period] : def?.[monthly ? 'monthly' : period]
    const disc = lines.filter((x) => x.kind === 'discount' && x.id === key).reduce((n, x) => n - x.amount, 0)
    return {
      key: l.id || l.kind, name: l.kind === 'plan' ? `${planDef?.name} plan` : def?.name || l.id,
      sub: l.kind === 'plan' ? `${period === 'yearly' ? 'Yearly' : 'Monthly'} plan · SAC ${sac}` : `${[monthly ? 'Monthly add-on · 30 days' : period === 'yearly' ? 'Yearly add-on' : null, def?.unit].filter(Boolean).join(' · ')} · SAC ${sac}`,
      qty: l.qty, rate: l.rate, listRate, custom: listRate != null && Math.abs(l.rate - listRate) >= 0.005, gross: l.amount, disc, net: l.amount - disc,
    }
  })
  const itemDiscounts = itemRows.reduce((n, r) => n + r.disc, 0)
  const wholeDiscounts = lines.filter((x) => x.kind === 'discount' && x.id === 'total')
  const listTotal = itemRows.reduce((n, r) => n + (r.listRate ?? r.rate) * r.qty, 0)
  const agreedDelta = itemRows.reduce((n, r) => n + r.gross, 0) - listTotal
  const saved = itemDiscounts + wholeDiscounts.reduce((n, x) => n - x.amount, 0) + Math.max(0, -agreedDelta)
  const placeName = states.find((x) => x.code === a.stateCode)?.name
  const gstLabel = GST_TREATMENTS.find((g) => g.value === prof.gstTreatment)?.label
  const monthlyNames = chosen.filter((c) => isMonthly(c.id)).map((c) => addonDefs.find((d) => d.id === c.id)?.name).filter(Boolean)

  return (
    <Shell wide title={isNew ? 'New subscription' : `Subscription · ${initial.customer || initial.workspaceId}`}
      subtitle="One cycle is billed now; each next one is recorded from Renewals." onClose={onClose}>
      <form onSubmit={submit} className="flex flex-col min-h-full">
        <div id="sd-top"/>
        {/* ── who it is for: one slim row ── */}
        <div className="px-4 sm:px-6 pt-5 pb-4 flex flex-wrap items-center gap-x-4 gap-y-3">
          <span className="w-11 h-11 rounded-2xl bg-gradient-to-br from-primary to-primary/60 text-white text-sm font-bold flex items-center justify-center flex-shrink-0 shadow-sm shadow-primary/20">{initialsOf(showName)}</span>
          <div className="min-w-0 flex-1">
            <div className="text-base font-semibold text-slate-900 truncate">{showName}</div>
            <div className="text-xs text-slate-500 flex flex-wrap items-center gap-x-2 gap-y-1">
              {client ? <><StatusPill status={client.status}/>{client.planName && <span>{client.planName} until {fmtDate(client.currentEnd)}</span>}</>
                : isNew ? <span>New client</span> : <span>Loading…</span>}
            </div>
          </div>
          {picker && <div className="w-full sm:w-72">{picker}</div>}
        </div>

        {/* ── tabs ── */}
        <div className="px-4 sm:px-6 pb-5">
          <div role="tablist" aria-label="Subscription steps" onKeyDown={onTabKey} className="grid grid-cols-4 gap-1 rounded-2xl bg-slate-100 p-1">
            {TABS.map(([id, label], i) => {
              const on = tab === id
              return (
                <button key={id} type="button" role="tab" id={`sd-tab-${id}`} aria-selected={on} aria-controls={`sd-panel-${id}`} tabIndex={on ? 0 : -1} onClick={() => setTab(id)}
                  className={clsx('relative flex items-center justify-center gap-2 rounded-xl px-2 py-2.5 text-sm font-semibold transition-all outline-none focus-visible:ring-2 focus-visible:ring-primary/40',
                    on ? 'bg-white text-slate-900 shadow-sm ring-1 ring-slate-200/70' : 'text-slate-500 hover:text-slate-800')}>
                  <span className={clsx('w-5 h-5 rounded-full text-[11px] flex items-center justify-center flex-shrink-0 transition-colors',
                    done[id] ? 'bg-emerald-500 text-white' : on ? 'bg-primary text-white' : 'bg-slate-200 text-slate-600')}>{done[id] ? <Check size={11} strokeWidth={3}/> : i + 1}</span>
                  <span className={clsx('truncate', !on && 'hidden sm:inline')}>{label}</span>
                  {hasError[id] && <span aria-label="has an error" className="absolute top-1.5 right-2 w-2 h-2 rounded-full bg-red-500"/>}
                </button>
              )
            })}
          </div>
        </div>

        {/* ── the tab ── */}
        <div role="tabpanel" id={`sd-panel-${tab}`} aria-labelledby={`sd-tab-${tab}`} key={tab} className="flex-1 px-4 sm:px-6 pb-8 space-y-9 animate-fade-in">
          {tab === 'plan' && (
            <>
              <Block title="Pricing options" hint="Set these first — they apply to every line below.">
                <div className="grid sm:grid-cols-3 gap-3">
                  <Field id="sd-discmode" label="Discount"><Select value={discMode} onChange={setDiscMode} options={DISCOUNT_MODES}/></Field>
                  <Field id="sd-discrenew" label="Discount applies to">
                    <Select value={discountRenews ? 'every' : 'first'} onChange={(v) => setDiscountRenews(v === 'every')} disabled={discMode === 'none'}
                      options={[{ value: 'every', label: 'Every renewal' }, { value: 'first', label: 'First cycle only' }]}/>
                  </Field>
                  <Field id="sd-tax" label="Tax" hint="Saved on the client's profile">
                    <Select value={prof.taxExempt ? 'exempt' : 'taxable'} onChange={(v) => setP('taxExempt', v === 'exempt')}
                      options={[{ value: 'taxable', label: `GST${gstPercent} [${gstPercent}%]` }, { value: 'exempt', label: 'Tax exempt [0%]' }]}/>
                  </Field>
                </div>
                {discMode === 'total' && (
                  <div className="grid sm:grid-cols-[minmax(0,1fr)_160px_130px] gap-3 rounded-2xl border border-slate-200 bg-slate-50/60 p-4">
                    <Field id="sd-dname" label="Discount name"><input id="sd-dname" value={totalDisc.name} maxLength={60} onChange={(e) => setTotalDisc((d) => ({ ...d, name: e.target.value }))} className={inp}/></Field>
                    <Field id="sd-dtype" label="Type"><Select value={totalDisc.type} onChange={(type) => setTotalDisc((d) => ({ ...d, type }))} options={[{ value: 'flat', label: 'Flat (₹)' }, { value: 'percent', label: 'Percentage (%)' }]}/></Field>
                    <Field id="sd-dval" label="Value"><input id="sd-dval" type="number" min={0} step="any" value={totalDisc.value} placeholder="0" onChange={(e) => setTotalDisc((d) => ({ ...d, value: e.target.value }))} className={clsx(inp, 'text-right')}/></Field>
                  </div>
                )}
              </Block>

              <Block title="Choose a plan" aside={<Segmented label="Billing period" value={period} onChange={changePeriod} size="sm" options={[['monthly', 'Monthly'], ['yearly', 'Yearly']]}/>}>
                <div role="radiogroup" aria-label="Plan" className="grid grid-cols-[repeat(auto-fill,minmax(170px,1fr))] gap-3">
                  {plans.map((p) => {
                    const on = plan === p.id
                    return (
                      <label key={p.id} className={clsx('relative rounded-2xl border p-4 cursor-pointer transition-all has-[:focus-visible]:ring-4 has-[:focus-visible]:ring-primary/20',
                        on ? 'border-primary bg-primary/[0.04] ring-1 ring-primary shadow-sm' : 'border-slate-200 hover:border-slate-300 hover:shadow-sm')}>
                        <input type="radio" name="sd-plan" value={p.id} checked={on} onChange={() => changePlan(p.id)} className="sr-only"/>
                        <span className={clsx('absolute top-3.5 right-3.5 w-5 h-5 rounded-full flex items-center justify-center transition-colors', on ? 'bg-primary text-white' : 'border border-slate-300')}>{on && <Check size={12} strokeWidth={3}/>}</span>
                        <div className="text-sm font-semibold text-slate-900 pr-7 truncate">{p.name}</div>
                        <div className="mt-1.5"><span className="text-xl font-bold text-slate-900 tabular-nums">{rupees(p[period])}</span><span className="text-xs text-slate-500"> / {period === 'yearly' ? 'yr' : 'mo'}</span></div>
                        {planFacts(p) && <div className="text-[11px] text-slate-500 mt-1.5 leading-4">{planFacts(p)}</div>}
                      </label>
                    )
                  })}
                </div>
              </Block>

              <Block title="Items & pricing" hint="Change a price to give this client their own rate. Amounts are before GST.">
                <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden">
                  <ul className="divide-y divide-slate-100">
                    <Line icon={<Layers size={17}/>} title={`${planDef?.name} plan`} sub={`Billed every ${unit} · SAC ${sac}`}
                      price={<Money label="Plan price" value={priceOf('plan')} onChange={(v) => setPrices((x) => ({ ...x, plan: v }))} className="w-28 h-9"/>}
                      discount={discMode === 'item' && <LineDiscount label="the plan" value={itemDisc.plan || { type: 'percent', value: '' }} onChange={(d) => setItemDisc((x) => ({ ...x, plan: d }))}/>}
                      tax={taxLabel} amount={lineAmount('plan', 1)} per={`per ${unit}`}/>
                    {chosen.map((c) => {
                      const def = addonDefs.find((d) => d.id === c.id)
                      return (
                        <Line key={c.id} icon={<Sparkles size={17}/>} title={def?.name} sub={`${def?.unit} · SAC ${sac}`}
                          billing={period === 'yearly' ? <Segmented label={`${def?.name} billing`} size="sm" value={isMonthly(c.id) ? 'month' : 'plan'} onChange={(v) => setMonthly(c.id, v === 'month')}
                            options={[['plan', `Yearly · ${rupees(def?.yearly)}`], ['month', `Monthly · ${rupees(def?.monthly)} · 30 days`]]}/> : null}
                          qty={def?.maxQty > 1 ? <Stepper label={def.name} value={c.qty} max={def.maxQty} onChange={(q) => setQty(c.id, q)}/> : null}
                          price={<Money label={`${def?.name} price`} value={priceOf(c.id)} onChange={(v) => setPrices((x) => ({ ...x, [c.id]: v }))} className="w-28 h-9"/>}
                          discount={discMode === 'item' && <LineDiscount label={def?.name} value={itemDisc[c.id] || { type: 'percent', value: '' }} onChange={(d) => setItemDisc((x) => ({ ...x, [c.id]: d }))}/>}
                          tax={taxLabel} amount={lineAmount(c.id, c.qty)} per={isMonthly(c.id) ? 'for 30 days' : `per ${unit}`} onRemove={() => removeAddon(c.id)}/>
                      )
                    })}
                  </ul>
                  {addable.length > 0 && (
                    <div className="px-4 py-3 border-t border-dashed border-slate-200 bg-slate-50/60">
                      <div className="max-w-xs">
                        <Select size="sm" value="" onChange={addAddon} placeholder="+ Add an add-on"
                          options={addable.map((d) => ({ value: d.id, label: d.name, sub: period === 'yearly' ? `${rupees(d.yearly)} / yr, or ${rupees(d.monthly)} / mo · ${d.unit}` : `${rupees(d[period])} / ${unit} · ${d.unit}` }))}/>
                      </div>
                    </div>
                  )}
                  {quote && (
                    <dl className="px-4 py-3.5 border-t border-slate-200 bg-slate-50 text-sm space-y-1.5">
                      <div className="flex justify-between text-slate-500"><dt>Subtotal</dt><dd className="tabular-nums">{rupees(quote.listPrice)}</dd></div>
                      {quote.discountTotal > 0 && <div className="flex justify-between text-emerald-700"><dt>Discount</dt><dd className="tabular-nums">−{rupees(quote.discountTotal)}</dd></div>}
                      <div className="flex justify-between text-slate-500"><dt>{quote.charge.gstPercent === 0 ? 'GST (exempt)' : `GST ${quote.charge.gstPercent}%`}</dt><dd className="tabular-nums">{rupees(quote.charge.gst)}</dd></div>
                      <div className="flex justify-between pt-1.5 border-t border-slate-200 font-bold text-slate-900"><dt>Total due now</dt><dd className="tabular-nums">{rupees(quote.charge.total)}</dd></div>
                    </dl>
                  )}
                </div>
              </Block>

              <Block title="Schedule">
                <div className="grid md:grid-cols-3 gap-x-6 gap-y-5">
                  <Field id="sd-start" label="Starts" hint={start === 'date' ? 'Backdated — counts from this date.' : scheduled ? `Starts when ${client?.planName || 'their current plan'} ends. Nothing is charged until then.` : canContinue ? 'Up to a year back, or after their current plan.' : 'Up to a year back. “After current plan” is for a client with a running plan.'}>
                    <div className={clsx(start === 'after_current' && 'pointer-events-none opacity-60')}>
                      <DatePicker value={startShown} onChange={(v) => { setStartDate(v); setStart(v === today() ? 'now' : 'date') }} min={yearAgo()} max={today()} textSize="text-sm"/>
                    </div>
                    <Segmented label="Start" value={start === 'date' ? '' : start} onChange={pickStart} size="sm" className="mt-2"
                      options={[['now', 'Today'], ['after_current', canContinue ? `After current plan (${fmtDate(client.currentEnd)})` : 'After current plan ends', canContinue ? undefined : { disabled: true, title: 'Pick a client who has a running plan' }]]}/>
                  </Field>
                  <Field id="sd-expires" label="Runs for" hint={never ? 'Renews until it is cancelled.' : `Ends after ${expiresAfter || 1} ${period === 'yearly' ? 'years' : 'months'} in all.`}>
                    <label className="flex items-center gap-2.5 text-sm text-slate-700 cursor-pointer h-10">
                      <Switch id="sd-expires" checked={never} onChange={setNever} label="Never expires"/> Never expires
                    </label>
                    {!never && (
                      <div className="flex max-w-[180px]">
                        <input aria-label="Cycles" type="number" min={1} max={120} value={expiresAfter} onChange={(e) => setExpiresAfter(e.target.value)} className={clsx(inp, 'rounded-r-none')}/>
                        <span className="px-3 h-10 inline-flex items-center text-sm text-slate-500 border border-l-0 border-slate-200 rounded-r-xl bg-slate-50">cycles</span>
                      </div>
                    )}
                  </Field>
                  <Field id="sd-sales" label="Salesperson">
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
              <Block title="Who is it?" aside={!isNew && !editClient && client?.profile && (
                <button type="button" onClick={() => setEditClient(true)} className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline"><Pencil size={12}/> Edit details</button>
              )}>
                {!isNew && !editClient ? (
                  <div className="rounded-2xl border border-slate-200 p-4 text-sm space-y-0.5">
                    <div className="font-semibold text-slate-900">{prof.legalName}</div>
                    <div className="text-slate-500">{[prof.contactName, prof.email, prof.phone && `+91 ${prof.phone}`].filter(Boolean).join(' · ')}</div>
                    <div className="text-xs text-slate-400 font-mono">{ws}</div>
                  </div>
                ) : (
                  <div className="grid sm:grid-cols-2 gap-4">
                    <Field id="sd-company" label="Customer name" required error={fe('legalName')}>
                      <input id="sd-company" value={prof.legalName} className={inp} placeholder="Company or legal name"
                        onChange={(e) => { setP('legalName', e.target.value); if (isNew && !wsTouched) setWs(slug(e.target.value)) }}/>
                    </Field>
                    <Field id="sd-ws" label="Workspace ID" required hint={isNew ? 'Their SmatBot workspace' : undefined}>
                      <input id="sd-ws" value={ws} disabled={!isNew} className={clsx(inp, 'font-mono')} placeholder="e.g. sharma-traders"
                        onChange={(e) => { setWs(e.target.value); setWsTouched(true) }}/>
                    </Field>
                    <Field id="sd-contact" label="Contact person" required error={fe('contactName')}>
                      <input id="sd-contact" value={prof.contactName} onChange={(e) => setP('contactName', e.target.value)} className={inp}/>
                    </Field>
                    <Field id="sd-email" label="Email" required error={fe('email')}>
                      <input id="sd-email" type="email" value={prof.email} onChange={(e) => setP('email', e.target.value)} className={inp}/>
                    </Field>
                    <Field id="sd-phone" label="Mobile" required error={fe('phone')}>
                      <div className="flex">
                        <span className="px-3 h-10 inline-flex items-center text-sm text-slate-500 border border-r-0 border-slate-200 rounded-l-xl bg-slate-50">+91</span>
                        <input id="sd-phone" inputMode="numeric" value={prof.phone} onChange={(e) => setP('phone', e.target.value)} className={clsx(inp, 'rounded-l-none')}/>
                      </div>
                    </Field>
                  </div>
                )}
              </Block>

              <Block title="Tax details">
                <div className="grid sm:grid-cols-2 gap-4">
                  <Field id="sd-gtt" label="GST treatment" required error={fe('gstTreatment')}>
                    <Select value={prof.gstTreatment} onChange={(v) => setP('gstTreatment', v)} options={GST_TREATMENTS}/>
                  </Field>
                  {hasGstin(prof.gstTreatment) && (
                    <Field id="sd-gstin" label="GSTIN" required error={fe('gstin')}>
                      <input id="sd-gstin" value={prof.gstin} onChange={(e) => setP('gstin', e.target.value.toUpperCase())} maxLength={15} className={clsx(inp, 'font-mono uppercase')}/>
                    </Field>
                  )}
                  <Field id="sd-pan" label="PAN" error={fe('pan')}>
                    <input id="sd-pan" value={prof.pan} maxLength={10} onChange={(e) => setP('pan', e.target.value.toUpperCase())} className={clsx(inp, 'font-mono uppercase')}/>
                  </Field>
                  <Field id="sd-terms" label="Payment terms" error={fe('paymentTerms')}>
                    <Select value={prof.paymentTerms} onChange={(v) => setP('paymentTerms', v)} options={TERMS}/>
                  </Field>
                </div>
              </Block>

              <Block title="Billing address" hint="This goes on the GST invoice.">
                <div className="max-w-xl"><AddressFields prefix="address" value={prof.address} onChange={(v) => setP('address', v)} states={states} fe={fe}/></div>
                <label className="inline-flex items-center gap-2.5 text-sm text-slate-700 cursor-pointer">
                  <Switch checked={sameShip} onChange={setSameShip} label="Shipping address is the same as billing"/> Shipping address is the same
                </label>
                {!sameShip && <div className="max-w-xl pt-1"><AddressFields prefix="shipping" value={prof.shipping} onChange={(v) => setP('shipping', v)} states={states} fe={fe}/></div>}
              </Block>

              <Block title="Other contacts" hint="Besides the contact person"
                aside={<button type="button" disabled={prof.contacts.length >= 10} onClick={() => setP('contacts', [...prof.contacts, { name: '', email: '', phone: '', role: '' }])}
                  className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline disabled:opacity-50"><Plus size={13}/> Add contact</button>}>
                <div className="space-y-2">
                  {prof.contacts.map((c, i) => {
                    const set = (k, v) => setP('contacts', prof.contacts.map((x, j) => (j === i ? { ...x, [k]: v } : x)))
                    return (
                      <div key={i} className="grid grid-cols-2 lg:grid-cols-[1fr_1fr_1fr_1fr_auto] gap-2 items-start rounded-2xl border border-slate-200 p-3">
                        {[['name', 'Name'], ['email', 'Email'], ['phone', 'Mobile'], ['role', 'Designation']].map(([k, ph]) => (
                          <div key={k}>
                            <input aria-label={`Contact ${i + 1} ${k}`} placeholder={ph} value={c[k]} onChange={(e) => set(k, e.target.value)} className={inp}/>
                            {fe(`contacts.${i}.${k}`) && <p className="text-[11px] text-red-600 mt-1">{fe(`contacts.${i}.${k}`)}</p>}
                          </div>
                        ))}
                        <button type="button" onClick={() => setP('contacts', prof.contacts.filter((_, j) => j !== i))} aria-label={`Remove contact ${i + 1}`} className="p-2.5 rounded-md text-slate-400 hover:text-red-600 hover:bg-red-50 justify-self-end"><X size={15}/></button>
                      </div>
                    )
                  })}
                </div>
              </Block>

              <Block title="Documents" hint="A PO, the signed agreement …">
                {isNew || !client
                  ? <p className="text-[13px] text-slate-500">Create the subscription first — then attach files here or from the client's page.</p>
                  : <ClientDocuments token={token} workspaceId={ws} initial={client.documents || []} canEdit/>}
              </Block>
            </>
          )}

          {tab === 'payment' && scheduled && (
            <Block title="Paid when it starts">
              <div className="rounded-2xl border border-violet-200 bg-violet-50/60 p-5 flex gap-4">
                <span className="w-10 h-10 rounded-xl bg-violet-100 text-violet-700 flex items-center justify-center flex-shrink-0"><CalendarClock size={20}/></span>
                <div className="text-sm text-slate-700 space-y-2">
                  <p className="font-semibold text-slate-900">Nothing is charged today.</p>
                  <p>This starts on <b className="text-slate-900">{quote ? fmtDate(quote.from) : fmtDate(client?.currentEnd)}</b>, when {client?.planName || 'their current plan'} ends. Until then they keep the plan they have.</p>
                  <p>On that day, open <b>Add subscription</b>, find it in the list and press <b>Record payment</b>{quote ? <> (<b className="text-slate-900">{rupees(quote.charge.total)}</b> incl. GST)</> : null}. The invoice is made then.</p>
                </div>
              </div>
            </Block>
          )}
          {tab === 'payment' && !scheduled && (
            <>
              <Block title="How is it being paid?">
                <div className="grid sm:grid-cols-2 gap-3">
                  <OptionCard name="sd-pay" checked={offline} onChange={() => setOffline(true)} icon={<Banknote size={18}/>} title="Collect payment offline" text="They paid by bank transfer, UPI, cheque or cash. A GST invoice is made."/>
                  <OptionCard name="sd-pay" checked={!offline} onChange={() => setOffline(false)} icon={<Gift size={18}/>} title="Free" text="No payment and no invoice."/>
                </div>
              </Block>
              {offline && (
                <Block title="Amount received" hint="Including GST">
                  <div className="flex flex-wrap items-center gap-x-5 gap-y-3">
                    <Money id="sd-amount" label="Amount received" value={amount} onChange={(v) => { setAmount(v); setAmountTouched(true) }} className="w-56 h-12 rounded-xl [&_input]:text-lg [&_input]:font-semibold [&_span]:text-base"/>
                    {quote && <span className="text-sm text-slate-500">Total due <b className="text-slate-900 tabular-nums">{rupees(quote.charge.total)}</b></span>}
                  </div>
                  {differs && (
                    <p className="text-[13px] text-amber-700 flex flex-wrap items-center gap-x-2 gap-y-1">
                      <AlertCircle size={14} className="flex-shrink-0"/> This differs from the total, so the invoice shows the difference as a price adjustment.
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
                <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3.5 text-sm text-amber-900 flex flex-wrap items-center gap-x-2 gap-y-1.5">
                  <AlertCircle size={16} className="flex-shrink-0"/>
                  <span className="font-semibold">Still needed for the invoice:</span>
                  <span>{missing.join(', ')}.</span>
                  <button type="button" onClick={() => setTab('client')} className="underline font-semibold">Fill in Client details</button>
                </div>
              )}
              {quoteError && <ErrorNote>{quoteError}</ErrorNote>}
              {!quote && !quoteError && <p className="text-sm text-slate-400 flex items-center gap-2"><Loader2 size={14} className="animate-spin"/> Working out the price…</p>}
              {quote && (
                <div className="space-y-6">
                  {/* 1 · who and what */}
                  <section className="rounded-2xl border border-slate-200 bg-white overflow-hidden">
                    <header className="px-5 py-3.5 bg-slate-50 border-b border-slate-200 flex items-center gap-3">
                      <h3 className="text-sm font-bold text-slate-900">Subscription details</h3>
                      {scheduled && <span className="ml-auto text-[11px] font-semibold px-2 py-0.5 rounded-md bg-violet-50 text-violet-700 border border-violet-200">Scheduled</span>}
                    </header>
                    <dl className="grid sm:grid-cols-2 gap-x-8 gap-y-4 px-5 py-4 text-sm">
                      <Detail k="Client">{prof.legalName || '—'}<div className="text-xs text-slate-500">{[prof.contactName, prof.email].filter(Boolean).join(' · ')}</div></Detail>
                      <Detail k="Billed to">{gstLabel || '—'}<div className="text-xs text-slate-500">{prof.gstin ? `GSTIN ${prof.gstin}` : 'No GSTIN'}{placeName ? ` · ${placeName}` : ''}</div></Detail>
                      <Detail k="Plan">{planDef?.name} · {period === 'yearly' ? 'Yearly' : 'Monthly'} billing</Detail>
                      <Detail k="Tax">{prof.taxExempt ? 'Tax exempt (no GST)' : `GST ${quote.charge.gstPercent}%`}</Detail>
                      <Detail k={scheduled ? 'Starts' : 'This period'}>
                        {scheduled ? fmtDate(quote.from) : `${fmtDate(quote.from)} → ${fmtDate(quote.end)}`}
                        <div className="text-xs text-slate-500">{scheduled ? `after ${client?.planName || 'their current plan'}, to ${fmtDate(quote.end)}` : start === 'date' ? 'Backdated' : 'Starts today'}</div>
                      </Detail>
                      <Detail k="Runs for">{never ? 'Until it is cancelled' : `${expiresAfter || 1} ${period === 'yearly' ? 'year' : 'month'}${Number(expiresAfter) === 1 ? '' : 's'} in all`}</Detail>
                      {salesperson && <Detail k="Salesperson">{team.find((t) => t.email === salesperson)?.name || salesperson}</Detail>}
                    </dl>
                  </section>

                  {/* 2 · the price, line by line */}
                  <section className="rounded-2xl border border-slate-200 bg-white overflow-hidden shadow-sm">
                    <header className="px-5 py-3.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between gap-3">
                      <h3 className="text-sm font-bold text-slate-900">Price breakdown</h3>
                      <span className="text-xs text-slate-400">Amounts in ₹, before GST until the tax lines</span>
                    </header>
                    <table className="hidden md:table w-full text-sm">
                      <thead>
                        <tr className="text-left text-[11px] uppercase tracking-wide text-slate-400 border-b border-slate-100">
                          <th className="px-5 py-2.5 font-semibold">Item</th><th className="py-2.5 font-semibold text-right">Qty</th><th className="py-2.5 font-semibold text-right">Price</th>
                          <th className="py-2.5 font-semibold text-right">Discount</th><th className="px-5 py-2.5 font-semibold text-right">Amount</th>
                        </tr>
                      </thead>
                      <tbody>
                        {itemRows.map((r) => (
                          <tr key={r.key} className="border-b border-slate-100 last:border-0">
                            <td className="px-5 py-3.5"><div className="font-medium text-slate-900">{r.name}</div><div className="text-xs text-slate-500">{r.sub}</div></td>
                            <td className="py-3.5 text-right tabular-nums text-slate-700">{r.qty}</td>
                            <td className="py-3.5 text-right tabular-nums text-slate-700">
                              {money2(r.rate)}{r.custom && <div className="text-[11px] text-slate-400">list <span className="line-through">{money2(r.listRate)}</span></div>}
                            </td>
                            <td className="py-3.5 text-right tabular-nums">{r.disc > 0 ? <span className="text-emerald-700">−{money2(r.disc)}</span> : <span className="text-slate-300">—</span>}</td>
                            <td className="px-5 py-3.5 text-right tabular-nums font-semibold text-slate-900">{money2(r.net)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    <ul className="md:hidden divide-y divide-slate-100">
                      {itemRows.map((r) => (
                        <li key={r.key} className="px-4 py-3.5">
                          <div className="flex justify-between gap-3">
                            <div className="min-w-0"><div className="font-medium text-slate-900">{r.name}</div><div className="text-xs text-slate-500">{r.sub}</div></div>
                            <div className="font-semibold tabular-nums text-slate-900">{money2(r.net)}</div>
                          </div>
                          <div className="mt-1.5 text-xs text-slate-500">
                            {r.qty} × {money2(r.rate)}{r.custom && ` (list ${money2(r.listRate)})`}{r.disc > 0 && <span className="text-emerald-700"> · discount −{money2(r.disc)}</span>}
                          </div>
                        </li>
                      ))}
                    </ul>

                    <dl className="px-5 py-4 border-t border-slate-200 bg-slate-50/60 text-sm space-y-2">
                      <div className="flex justify-between gap-4 text-slate-600"><dt>Items at list price</dt><dd className="tabular-nums">{money2(listTotal)}</dd></div>
                      {Math.abs(agreedDelta) >= 0.005 && <div className={clsx('flex justify-between gap-4', agreedDelta < 0 ? 'text-emerald-700' : 'text-slate-600')}><dt>Agreed prices, against list</dt><dd className="tabular-nums">{agreedDelta < 0 ? '−' : '+'}{money2(Math.abs(agreedDelta))}</dd></div>}
                      {itemDiscounts > 0 && <div className="flex justify-between gap-4 text-emerald-700"><dt>Item discounts</dt><dd className="tabular-nums">−{money2(itemDiscounts)}</dd></div>}
                      {wholeDiscounts.map((x, i) => <div key={i} className="flex justify-between gap-4 text-emerald-700"><dt>{x.description}</dt><dd className="tabular-nums">−{money2(-x.amount)}</dd></div>)}
                      <div className="flex justify-between gap-4 pt-2 border-t border-slate-200 font-semibold text-slate-900"><dt>Taxable value</dt><dd className="tabular-nums">{money2(quote.charge.base)}</dd></div>
                      {quote.charge.gstPercent === 0
                        ? <div className="flex justify-between gap-4 text-slate-600"><dt>GST</dt><dd>Exempt · ₹0.00</dd></div>
                        : quote.charge.tax.kind === 'intra'
                          ? <>
                              <div className="flex justify-between gap-4 text-slate-600"><dt>CGST @ {quote.charge.gstPercent / 2}%</dt><dd className="tabular-nums">{money2(quote.charge.tax.cgst)}</dd></div>
                              <div className="flex justify-between gap-4 text-slate-600"><dt>SGST @ {quote.charge.gstPercent / 2}%</dt><dd className="tabular-nums">{money2(quote.charge.tax.sgst)}</dd></div>
                            </>
                          : <div className="flex justify-between gap-4 text-slate-600"><dt>{quote.charge.tax.kind === 'inter' ? 'IGST' : 'GST'} @ {quote.charge.gstPercent}%</dt><dd className="tabular-nums">{money2(quote.charge.gst)}</dd></div>}
                    </dl>
                    <div className="px-5 py-4 bg-primary/[0.06] border-t border-slate-200">
                      <div className="flex items-baseline justify-between gap-4">
                        <span className="text-sm font-semibold text-slate-700">{scheduled ? `Total due on ${fmtDate(quote.from)}` : 'Total due now'} <span className="font-normal text-slate-500">(incl. GST)</span></span>
                        <span className="text-2xl font-bold text-slate-900 tabular-nums">{money2(quote.charge.total)}</span>
                      </div>
                      {saved >= 0.005 && <p className="text-xs text-emerald-700 mt-1.5">The client saves {money2(saved)} before GST{discMode !== 'none' && (discountRenews ? ', on every renewal' : ', on this first cycle only')}.</p>}
                    </div>
                  </section>

                  {/* 3 · payment and what follows */}
                  <section className="rounded-2xl border border-slate-200 bg-white overflow-hidden">
                    <header className="px-5 py-3.5 bg-slate-50 border-b border-slate-200"><h3 className="text-sm font-bold text-slate-900">Payment & what happens next</h3></header>
                    <ol className="px-5 py-4 space-y-4">
                      {[
                        scheduled
                          ? [CalendarClock, <><b className="text-slate-900">Nothing is charged today.</b> {client?.planName || 'Their current plan'} keeps running until {fmtDate(quote.from)}.</>]
                          : [BadgeCheck, offline
                            ? <><b className="text-slate-900">{money2(Number(amount) || 0)}</b> is recorded as paid offline{differs ? ` — ${money2(Math.abs((Number(amount) || 0) - quote.charge.total))} ${(Number(amount) || 0) < quote.charge.total ? 'less' : 'more'} than the total, shown on the invoice as a price adjustment` : ''}, and a GST invoice is made.</>
                            : 'Free — no payment and no invoice.'],
                        scheduled && [Receipt, <>On {fmtDate(quote.from)}, press <b className="text-slate-900">Record payment</b> on the subscription ({money2(quote.charge.total)}). The invoice is made then.</>],
                        monthlyNames.length > 0 && quote.monthlyUntil && [Sparkles, <>{monthlyNames.join(', ')} {monthlyNames.length > 1 ? 'are' : 'is'} bought by the month: valid until <b className="text-slate-900">{fmtDate(quote.monthlyUntil)}</b> (30 days) and not renewed with the plan.</>],
                        [Repeat, quote.renewal != null
                          ? <>Then <b className="text-slate-900">{money2(quote.renewal)}</b> every {unit}{quote.expiresAfter ? `, ${quote.expiresAfter - quote.cycles} more time${quote.expiresAfter - quote.cycles > 1 ? 's' : ''}` : ' until cancelled'}. You record each payment from Add subscription or Renewals.</>
                          : 'Nothing more after this cycle.'],
                      ].filter(Boolean).map(([Icon, text], i) => (
                        <li key={i} className="flex gap-3 text-sm text-slate-600">
                          <span className="w-8 h-8 rounded-xl bg-primary/10 text-primary flex items-center justify-center flex-shrink-0"><Icon size={16}/></span>
                          <span className="pt-1">{text}</span>
                        </li>
                      ))}
                    </ol>
                    {autopayOn && (
                      <label className="mx-5 mb-4 flex items-start gap-2 text-xs text-amber-900 bg-amber-50 border border-amber-200 rounded-xl p-3 cursor-pointer">
                        <input type="checkbox" checked={stopAutopay} onChange={(e) => setStopAutopay(e.target.checked)} className="mt-0.5 accent-primary"/>
                        <span>This client is on autopay. <b>Stop their autopay</b> — otherwise they would be charged {scheduled ? 'again when this period ends' : 'for this period as well'}.</span>
                      </label>
                    )}
                  </section>
                </div>
              )}
            </>
          )}
          <ErrorNote>{error}</ErrorNote>
        </div>

        {/* ── always in view ── */}
        <div className="sticky bottom-0 z-10 border-t border-slate-200 bg-white/90 backdrop-blur-md px-4 sm:px-6 py-3.5 flex items-center gap-3 rounded-b-3xl">
          <div className="flex-1 min-w-0">
            <div className="text-[11px] text-slate-500">{here === TABS.length - 1 && blockReason && !saving ? <span className="text-amber-700 font-medium">{blockReason}</span> : scheduled ? 'Due when it starts · incl. GST' : 'Total due now · incl. GST'}</div>
            <div className="flex items-baseline gap-2">
              <span className="text-xl font-bold text-slate-900 tabular-nums">{quote ? rupees(quote.charge.total) : '—'}</span>
              {quote?.renewal != null && <span className="text-xs text-slate-400 truncate hidden sm:inline">then {rupees(quote.renewal)} / {unit}</span>}
            </div>
          </div>
          {here === 0
            ? <button type="button" onClick={onClose} className={ghostBtn}>Cancel</button>
            : <button type="button" onClick={() => go(here - 1)} className={ghostBtn}><ArrowLeft size={15}/> Back</button>}
          {here < TABS.length - 1
            ? <button type="button" onClick={() => go(here + 1)} className={primaryBtn}>Next <ArrowRight size={15}/></button>
            : <button type="submit" disabled={Boolean(blockReason)} className={primaryBtn}>{saving && <Loader2 size={14} className="animate-spin"/>} {isNew ? 'Create subscription' : 'Save subscription'}</button>}
        </div>
      </form>
    </Shell>
  )
}
