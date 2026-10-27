// SubscriptionDialog.jsx — staff set up a client's subscription in one go: who they are (billing
// details for the GST invoice), the plan and add-ons, how many billing cycles from which start date,
// any discount (per item or on the total), and how it was paid (free, or offline). The price on the
// right is the server's own quote — exactly what will be invoiced. Admins only.
import { useEffect, useRef, useState } from 'react'
import clsx from 'clsx'
import { Loader2 } from 'lucide-react'
import { inr } from '../../constants/pricing'
import { billingAdmin } from '../../lib/billingApi'
import DatePicker from '../DatePicker'
import Select from '../Select'
import { Modal, Chips, ErrorNote, inputCls, labelCls, btnPrimary, btnGhost, rupees, fmtDate } from './ui'

const ymd = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
const today = () => ymd(new Date())
const startOfDay = (s) => Math.floor(new Date(`${s}T00:00:00`).getTime() / 1000)
const yearAgo = () => { const d = new Date(); d.setFullYear(d.getFullYear() - 1); return ymd(d) }
const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40)
const METHODS = [
  { value: 'bank_transfer', label: 'Bank transfer (NEFT / RTGS / IMPS)' }, { value: 'upi', label: 'UPI' },
  { value: 'cheque', label: 'Cheque' }, { value: 'cash', label: 'Cash' }, { value: 'card_offline', label: 'Card (POS / link)' }, { value: 'other', label: 'Other' },
]
const EMPTY_PROFILE = { legalName: '', contactName: '', email: '', phone: '', gstin: '', line1: '', line2: '', city: '', stateCode: '', pincode: '' }

function Section({ n, title, children, hint }) {
  return (
    <section className="space-y-3">
      <h3 className="flex items-center gap-2 text-sm font-bold text-slate-800">
        <span className="w-5 h-5 rounded-full bg-primary/10 text-primary text-[11px] flex items-center justify-center">{n}</span>{title}
        {hint && <span className="text-xs font-normal text-slate-400">{hint}</span>}
      </h3>
      {children}
    </section>
  )
}

function Field({ id, label, error, optional, children }) {
  return (
    <div>
      <label htmlFor={id} className={labelCls}>{label}{optional && <span className="font-normal text-slate-400"> (optional)</span>}</label>
      {children}
      {error && <p id={`${id}-err`} className="text-[11px] text-red-600 mt-1">{error}</p>}
    </div>
  )
}

export default function SubscriptionDialog({ token, initial, plans: allPlans, addonDefs, states, onDone, onClose }) {
  // Plans on sale (public or private), plus the one the client is on even if it is archived.
  const plans = allPlans.filter((p) => p.status === 'active' || p.id === initial?.plan)
  const isNew = !initial?.workspaceId
  const [ws, setWs] = useState(initial?.workspaceId || '')
  const [wsTouched, setWsTouched] = useState(false)
  const [prof, setProf] = useState(EMPTY_PROFILE)
  const [client, setClient] = useState(null)       // the full client record (plan, autopay …) once loaded
  const [plan, setPlan] = useState(initial?.plan || 'standard')
  const [period, setPeriod] = useState(initial?.period || 'monthly')
  const [cycles, setCycles] = useState(1)
  const [addons, setAddons] = useState(() => Object.fromEntries((initial?.addons || []).map((a) => [a.id, a.qty])))
  const [start, setStart] = useState('now')        // now · date · after_current
  const [startDate, setStartDate] = useState(today())
  const [discMode, setDiscMode] = useState('none')  // none · item · total
  const [itemDisc, setItemDisc] = useState({})      // { plan | addonId: { type, value } }
  const [totalDisc, setTotalDisc] = useState({ type: 'percent', value: '' })
  const [payType, setPayType] = useState('offline')
  const [amount, setAmount] = useState('')
  const [amountTouched, setAmountTouched] = useState(false)
  const [method, setMethod] = useState('bank_transfer')
  const [reference, setReference] = useState('')
  const [paidOn, setPaidOn] = useState(today())
  const [note, setNote] = useState('')
  const [stopAutopay, setStopAutopay] = useState(false)
  const [quote, setQuote] = useState(null)
  const [quoteError, setQuoteError] = useState('')
  const [fields, setFields] = useState({})
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const quoteSeq = useRef(0)

  // An existing client: load their saved billing details and current plan.
  useEffect(() => {
    if (isNew) return
    billingAdmin.customer(token, initial.workspaceId).then((c) => {
      setClient(c)
      const p = c.profile
      if (p) setProf({ legalName: p.legalName, contactName: p.contactName, email: p.email, phone: p.phone, gstin: p.gstin || '', line1: p.address.line1, line2: p.address.line2 || '', city: p.address.city, stateCode: p.address.stateCode, pincode: p.address.pincode })
    }).catch((e) => setError(e.message))
  }, [token, initial?.workspaceId, isNew])

  const setP = (k, v) => setProf((p) => ({ ...p, [k]: v }))
  const eligible = addonDefs.filter((a) => a.plans.includes(plan) && (a.status ?? 'active') === 'active')
  const chosen = eligible.filter((a) => addons[a.id] > 0).map((a) => ({ id: a.id, qty: addons[a.id] }))
  const maxCycles = period === 'yearly' ? 3 : 36
  const canContinue = client && ['active', 'past_due'].includes(client.status) && client.plan === plan && client.currentEnd

  const discounts = discMode === 'item'
    ? Object.entries(itemDisc).filter(([t, d]) => Number(d.value) > 0 && (t === 'plan' || chosen.some((a) => a.id === t))).map(([target, d]) => ({ target, type: d.type, value: Number(d.value) }))
    : discMode === 'total' && Number(totalDisc.value) > 0 ? [{ target: 'total', type: totalDisc.type, value: Number(totalDisc.value) }] : []
  const sub = {
    workspaceId: ws.trim(), plan, period, cycles, addons: chosen, discounts,
    start: start === 'after_current' ? 'after_current' : 'now', ...(start === 'date' ? { startDate: startOfDay(startDate) } : {}),
  }
  const subKey = JSON.stringify(sub)

  // Ask the server for the price whenever the subscription changes (it decides every amount).
  useEffect(() => {
    const seq = ++quoteSeq.current
    const timer = setTimeout(() => {
      billingAdmin.quote(token, sub)
        .then((q) => { if (seq === quoteSeq.current) { setQuote(q); setQuoteError('') } })
        .catch((e) => { if (seq === quoteSeq.current) { setQuote(null); setQuoteError(e.message) } })
    }, 250)
    return () => clearTimeout(timer)
  }, [subKey])   // eslint-disable-line react-hooks/exhaustive-deps

  // The amount received follows the price until staff type their own.
  useEffect(() => { if (quote && !amountTouched) setAmount(String(quote.charge.total)) }, [quote, amountTouched])

  const profileFilled = Object.entries(prof).some(([k, v]) => k !== 'stateCode' && String(v).trim())
  const profileBody = () => ({
    legalName: prof.legalName, contactName: prof.contactName, email: prof.email, phone: prof.phone, gstin: prof.gstin,
    address: { line1: prof.line1, line2: prof.line2, city: prof.city, stateCode: prof.stateCode, pincode: prof.pincode },
  })

  async function submit(e) {
    e.preventDefault()
    setSaving(true); setError(''); setFields({})
    try {
      const row = await billingAdmin.plan(token, {
        ...sub, note, stopAutopay,
        ...(profileFilled ? { profile: profileBody() } : {}),
        payment: payType === 'offline'
          ? { type: 'offline', amount: Number(amount), method, reference, paidAt: Math.min(startOfDay(paidOn) + 12 * 3600, Math.floor(Date.now() / 1000)) }
          : { type: 'free' },
      })
      onDone(row)
    } catch (err) {
      if (err.fields) setFields(err.fields)
      setError(err.message)
      setSaving(false)
    }
  }

  const fe = (k) => fields[k]
  const autopayOn = quote?.autopayRunning
  const blocked = saving || !ws.trim() || !quote || (autopayOn && !stopAutopay) || (payType === 'offline' && !(Number(amount) >= 1))

  return (
    <Modal wide title={isNew ? 'Add a client and their subscription' : `Subscription · ${initial.customer || initial.workspaceId}`}
      subtitle="Paid offline or free. Prices are worked out by the server; every offline payment gets a GST invoice." onClose={onClose}>
      <form onSubmit={submit} className="grid lg:grid-cols-[minmax(0,1fr)_340px] min-h-full">
        <div className="p-5 space-y-6 min-w-0">
          {/* 1 · client */}
          <Section n={1} title="Client details" hint="needed for the GST invoice">
            <div className="grid sm:grid-cols-2 gap-3">
              <Field id="sd-company" label="Company / legal name" error={fe('legalName')}>
                <input id="sd-company" value={prof.legalName} className={inputCls} aria-invalid={!!fe('legalName')}
                  onChange={(e) => { setP('legalName', e.target.value); if (isNew && !wsTouched) setWs(slug(e.target.value)) }}/>
              </Field>
              <Field id="sd-ws" label="Workspace ID">
                <input id="sd-ws" value={ws} disabled={!isNew} required className={clsx(inputCls, 'font-mono')} placeholder="e.g. sharma-traders"
                  onChange={(e) => { setWs(e.target.value); setWsTouched(true) }}/>
              </Field>
              <Field id="sd-contact" label="Contact person" error={fe('contactName')}>
                <input id="sd-contact" value={prof.contactName} onChange={(e) => setP('contactName', e.target.value)} className={inputCls}/>
              </Field>
              <Field id="sd-email" label="Email" error={fe('email')}>
                <input id="sd-email" type="email" value={prof.email} onChange={(e) => setP('email', e.target.value)} className={inputCls}/>
              </Field>
              <Field id="sd-phone" label="Mobile number" error={fe('phone')}>
                <div className="flex">
                  <span className="px-3 py-2 text-sm text-slate-500 border border-r-0 border-slate-200 rounded-l-lg bg-slate-50">+91</span>
                  <input id="sd-phone" inputMode="numeric" value={prof.phone} onChange={(e) => setP('phone', e.target.value)} className={clsx(inputCls, 'rounded-l-none')}/>
                </div>
              </Field>
              <Field id="sd-gstin" label="GSTIN" optional error={fe('gstin')}>
                <input id="sd-gstin" value={prof.gstin} onChange={(e) => setP('gstin', e.target.value.toUpperCase())} className={clsx(inputCls, 'font-mono uppercase')} maxLength={15}/>
              </Field>
              <div className="sm:col-span-2">
                <Field id="sd-line1" label="Address" error={fe('address.line1')}>
                  <input id="sd-line1" value={prof.line1} onChange={(e) => setP('line1', e.target.value)} placeholder="Building, street" className={inputCls}/>
                </Field>
              </div>
              <div className="sm:col-span-2">
                <Field id="sd-line2" label="Address line 2" optional error={fe('address.line2')}>
                  <input id="sd-line2" value={prof.line2} onChange={(e) => setP('line2', e.target.value)} placeholder="Area, landmark" className={inputCls}/>
                </Field>
              </div>
              <Field id="sd-city" label="City" error={fe('address.city')}>
                <input id="sd-city" value={prof.city} onChange={(e) => setP('city', e.target.value)} className={inputCls}/>
              </Field>
              <Field id="sd-pin" label="PIN code" error={fe('address.pincode')}>
                <input id="sd-pin" inputMode="numeric" maxLength={6} value={prof.pincode} onChange={(e) => setP('pincode', e.target.value.replace(/\D/g, ''))} className={inputCls}/>
              </Field>
              <div className="sm:col-span-2">
                <Field id="sd-state" label="State (place of supply)" error={fe('address.stateCode')}>
                  <Select value={prof.stateCode} onChange={(v) => setP('stateCode', v)} placeholder="Choose the state"
                    options={states.map((s) => ({ value: s.code, label: `${s.name} (${s.code})` }))}/>
                </Field>
              </div>
            </div>
          </Section>

          {/* 2 · plan and add-ons */}
          <Section n={2} title="Plan & add-ons">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {plans.map((p) => (
                <label key={p.id} className={clsx('border rounded-xl px-3 py-2 cursor-pointer has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-primary/30',
                  plan === p.id ? 'border-primary bg-primary/5' : 'border-slate-200 hover:border-slate-300')}>
                  <input type="radio" name="sd-plan" value={p.id} checked={plan === p.id} onChange={() => setPlan(p.id)} className="sr-only"/>
                  <div className="text-sm font-semibold text-slate-800">{p.name}</div>
                  <div className="text-xs text-slate-500">{inr(p[period])} / {period === 'yearly' ? 'yr' : 'mo'}</div>
                </label>
              ))}
            </div>
            <div className="max-h-52 overflow-y-auto border border-slate-200 rounded-xl divide-y divide-slate-100">
              {eligible.map((a) => (
                <div key={a.id} className="flex items-center gap-3 px-3 py-2">
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-medium text-slate-700">{a.name}</div>
                    <div className="text-[11px] text-slate-400">{inr(a[period])} / {period === 'yearly' ? 'yr' : 'mo'} · {a.unit}</div>
                  </div>
                  {a.maxQty === 1
                    ? <input type="checkbox" aria-label={a.name} checked={addons[a.id] > 0} onChange={(e) => setAddons((x) => ({ ...x, [a.id]: e.target.checked ? 1 : 0 }))} className="w-4 h-4 accent-primary"/>
                    : <input type="number" aria-label={`${a.name} quantity`} min={0} max={a.maxQty} value={addons[a.id] || 0}
                        onChange={(e) => setAddons((x) => ({ ...x, [a.id]: Math.max(0, Math.min(a.maxQty, parseInt(e.target.value, 10) || 0)) }))}
                        className="w-16 border border-slate-200 rounded-lg px-2 py-1 text-xs text-right outline-none focus:border-primary"/>}
                </div>
              ))}
            </div>
          </Section>

          {/* 3 · cycles and start */}
          <Section n={3} title="Billing cycles & start date">
            <div className="grid sm:grid-cols-2 gap-3">
              <fieldset>
                <legend className={labelCls}>Billed</legend>
                <Chips label="Billing period" value={period} onChange={(p) => { setPeriod(p); setCycles((c) => Math.min(c, p === 'yearly' ? 3 : 36)) }} options={[['monthly', 'Monthly'], ['yearly', 'Yearly']]}/>
              </fieldset>
              <Field id="sd-cycles" label={`Cycles (${period === 'yearly' ? 'years' : 'months'}, up to ${maxCycles})`}>
                <input id="sd-cycles" type="number" min={1} max={maxCycles} value={cycles}
                  onChange={(e) => setCycles(Math.max(1, Math.min(maxCycles, parseInt(e.target.value, 10) || 1)))} className={inputCls}/>
              </Field>
            </div>
            <p className="text-[11px] text-slate-500">All {cycles > 1 ? `${cycles} cycles are` : 'of it is'} billed now, in one payment. It doesn't renew by itself.</p>
            <fieldset>
              <legend className={labelCls}>Starts</legend>
              <Chips label="Start" value={start} onChange={setStart}
                options={[['now', 'Today'], ['date', 'On a past date'], ...(canContinue ? [['after_current', `When the current plan ends (${fmtDate(client.currentEnd)})`]] : [])]}/>
              {start === 'date' && (
                <div className="mt-2 w-56"><DatePicker value={startDate} onChange={setStartDate} min={yearAgo()} textSize="text-sm"/></div>
              )}
            </fieldset>
          </Section>

          {/* 4 · discount */}
          <Section n={4} title="Discount" hint="taken before GST">
            <Chips label="Discount" value={discMode} onChange={setDiscMode} options={[['none', 'No discount'], ['item', 'Item-wise'], ['total', 'On the total']]}/>
            {discMode === 'item' && (
              <div className="border border-slate-200 rounded-xl divide-y divide-slate-100">
                {[{ id: 'plan', name: `${plans.find((p) => p.id === plan)?.name} plan` }, ...chosen.map((a) => ({ id: a.id, name: addonDefs.find((d) => d.id === a.id)?.name }))].map((it) => {
                  const d = itemDisc[it.id] || { type: 'percent', value: '' }
                  return (
                    <div key={it.id} className="flex items-center gap-3 px-3 py-2">
                      <span className="flex-1 min-w-0 text-xs font-medium text-slate-700 truncate">{it.name}</span>
                      <Chips label={`Discount type for ${it.name}`} value={d.type} onChange={(type) => setItemDisc((x) => ({ ...x, [it.id]: { ...d, type } }))} options={[['percent', '%'], ['flat', '₹']]}/>
                      <input type="number" min={0} step="any" aria-label={`Discount on ${it.name}`} value={d.value} placeholder="0"
                        onChange={(e) => setItemDisc((x) => ({ ...x, [it.id]: { ...d, value: e.target.value } }))}
                        className="w-24 border border-slate-200 rounded-lg px-2 py-1.5 text-xs text-right outline-none focus:border-primary"/>
                    </div>
                  )
                })}
              </div>
            )}
            {discMode === 'total' && (
              <div className="flex items-center gap-3">
                <Chips label="Discount type" value={totalDisc.type} onChange={(type) => setTotalDisc((d) => ({ ...d, type }))} options={[['percent', '%'], ['flat', '₹']]}/>
                <input type="number" min={0} step="any" aria-label="Discount on the total" value={totalDisc.value} placeholder="0"
                  onChange={(e) => setTotalDisc((d) => ({ ...d, value: e.target.value }))} className="w-32 border border-slate-200 rounded-lg px-3 py-2 text-sm text-right outline-none focus:border-primary"/>
              </div>
            )}
          </Section>

          {/* 5 · payment */}
          <Section n={5} title="Payment">
            <Chips label="Payment" value={payType} onChange={setPayType} options={[['offline', 'Paid offline'], ['free', 'Free (no invoice)']]}/>
            {payType === 'offline' && (
              <div className="grid sm:grid-cols-2 gap-3">
                <Field id="sd-amount" label="Amount received, incl. GST (₹)">
                  <input id="sd-amount" type="number" min={1} step="any" value={amount} onChange={(e) => { setAmount(e.target.value); setAmountTouched(true) }} className={inputCls}/>
                </Field>
                <Field id="sd-method" label="Paid by">
                  <Select value={method} onChange={setMethod} options={METHODS}/>
                </Field>
                <Field id="sd-ref" label="Reference" optional>
                  <input id="sd-ref" value={reference} maxLength={100} onChange={(e) => setReference(e.target.value)} placeholder="UTR, cheque no., UPI ref" className={inputCls}/>
                </Field>
                <fieldset>
                  <legend className={labelCls}>Received on</legend>
                  <DatePicker value={paidOn} onChange={setPaidOn} min={yearAgo()} textSize="text-sm"/>
                </fieldset>
                {quote && amountTouched && Math.abs(Number(amount) - quote.charge.total) >= 0.01 && (
                  <p className="sm:col-span-2 text-[11px] text-amber-700">Differs from the price ({rupees(quote.charge.total)}): the invoice shows the difference as a price adjustment.</p>
                )}
              </div>
            )}
            <Field id="sd-note" label="Internal note" optional>
              <input id="sd-note" value={note} maxLength={500} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Annual deal agreed with Rahul" className={inputCls}/>
            </Field>
          </Section>
        </div>

        {/* summary */}
        <aside className="border-t lg:border-t-0 lg:border-l border-slate-100 bg-slate-50/70 p-5 flex flex-col gap-4">
          <div className="lg:sticky lg:top-0 space-y-4">
            <h3 className="text-sm font-bold text-slate-800">Summary</h3>
            {quoteError && <ErrorNote>{quoteError}</ErrorNote>}
            {!quote && !quoteError && <p className="text-xs text-slate-400 flex items-center gap-2"><Loader2 size={13} className="animate-spin"/> Working out the price…</p>}
            {quote && (
              <>
                <div className="rounded-xl bg-white border border-slate-200 divide-y divide-slate-100 text-xs">
                  {quote.charge.lines.map((l, i) => (
                    <div key={i} className={clsx('flex justify-between gap-3 px-3 py-2', l.amount < 0 && 'text-emerald-700')}>
                      <span className="min-w-0">{l.description}{l.qty > 1 ? ` × ${l.qty}` : ''}</span>
                      <span className="tabular-nums whitespace-nowrap">{l.amount < 0 ? `−${rupees(-l.amount)}` : rupees(l.amount)}</span>
                    </div>
                  ))}
                  <div className="flex justify-between px-3 py-2 text-slate-500"><span>GST ({quote.charge.gstPercent}%)</span><span className="tabular-nums">{rupees(quote.charge.gst)}</span></div>
                  <div className="flex justify-between px-3 py-2.5 font-bold text-slate-900 text-sm"><span>Total</span><span className="tabular-nums">{rupees(quote.charge.total)}</span></div>
                </div>
                {quote.discountTotal > 0 && <p className="text-xs text-emerald-700">Saving {rupees(quote.discountTotal)} on the list price of {rupees(quote.listPrice)} (before GST).</p>}
                <dl className="text-xs space-y-1.5">
                  <div className="flex justify-between"><dt className="text-slate-500">Runs</dt><dd className="text-slate-800 font-medium">{fmtDate(quote.from)} → {fmtDate(quote.end)}</dd></div>
                  <div className="flex justify-between"><dt className="text-slate-500">Cycles</dt><dd className="text-slate-800 font-medium">{quote.cycles} × {quote.period}</dd></div>
                </dl>
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
              <button type="submit" disabled={blocked} className={clsx(btnPrimary, 'flex-1')}>
                {saving && <Loader2 size={14} className="animate-spin"/>} {isNew ? 'Add client' : 'Save subscription'}
              </button>
            </div>
          </div>
        </aside>
      </form>
    </Modal>
  )
}
