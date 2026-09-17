import { useMemo, useState } from 'react'
import clsx from 'clsx'
import {
  PackagePlus, Save, Ruler, SlidersHorizontal, Plus, X, ArrowUpDown, Boxes, Info,
} from 'lucide-react'
import {
  SERVICES, quote, serviceById, measureBoxes, chargeableQuantity, usesDimensions,
  LENGTH_UNITS, CURRENCY_SYMBOL,
} from '../lib/domain'
import { fmtMoney, fmtUnits } from '../lib/format'
import { Field, Select, Modal, Card } from './ui'
import AddressPicker from './AddressPicker'

/* ── Small controls the booking flow is built from ─────────────────────────── */

/** Either/or switch. Two taps beat a dropdown for a binary choice. */
function Segmented({ value, onChange, options, tone = 'navy', className }) {
  return (
    <div className={clsx('seg', className)} role="group">
      {options.map((o) => (
        <button
          key={String(o.value)}
          type="button"
          onClick={() => onChange(o.value)}
          aria-pressed={value === o.value}
          className={clsx('seg-btn', value === o.value && (tone === 'orange' ? 'seg-btn-on-orange' : 'seg-btn-on-navy'))}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

const UNIT_TONES = {
  navy:    { box: 'border-navy-200',    chip: 'bg-navy-50 text-navy-600' },
  orange:  { box: 'border-orange-200',  chip: 'bg-orange-50 text-orange-600' },
  emerald: { box: 'border-emerald-200', chip: 'bg-emerald-50 text-emerald-700' },
}

/** Number input that carries its unit inside the box, so the row reads as a sentence. */
function UnitField({ value, onChange, suffix, prefix, tone = 'navy', min, step, label }) {
  const t = UNIT_TONES[tone]
  return (
    <label className={clsx('unit-field', t.box)}>
      <span className="sr-only">{label}</span>
      {prefix && <span className="pl-3 text-sm font-bold text-emerald-700">{prefix}</span>}
      <input type="number" min={min} step={step} value={value} onChange={(e) => onChange(e.target.value)} />
      <span className={clsx('unit-suffix flex h-full items-center py-3', t.chip)}>{suffix}</span>
    </label>
  )
}

/* ── Form state ────────────────────────────────────────────────────────────── */

const newBox = () => ({ id: Math.random().toString(36).slice(2, 9), l: '', w: '', h: '', qty: 1 })

const blank = {
  customerId: '', serviceId: 'air_freight',
  originCode: '', originAddress: '', destinationCode: '', destinationAddress: '',
  receiverName: '', receiverPhone: '',
  pieces: 1, quantity: 50, contents: '', declaredValue: 0, insured: true,
  paymentMode: 'Prepaid', apptDelivery: false, freightMode: 'Prepaid', insuredBy: 'Owner',
  notes: '',
}

const fromOrder = (o) => ({
  customerId: o.customerId, serviceId: o.serviceId,
  originCode: o.origin.hub, originAddress: o.origin.address || '',
  destinationCode: o.destination.hub, destinationAddress: o.destination.address || '',
  receiverName: o.receiver.name, receiverPhone: o.receiver.phone,
  pieces: o.pieces, quantity: o.grossQuantity || o.quantity, contents: o.contents,
  declaredValue: o.declaredValue, insured: o.insured,
  paymentMode: o.paymentMode === 'Account (invoiced)' ? 'Account'
    : o.paymentMode === 'Pay on collection' ? 'COD' : 'Prepaid',
  apptDelivery: !!o.apptDelivery,
  freightMode: o.freightMode || 'Prepaid',
  insuredBy: o.insuredBy || (o.insured ? 'Owner' : 'Carrier'),
  notes: o.notes || '',
})

/**
 * Shared booking state for staff and customers.
 *
 * Routes come from the live branch network rather than a hard-coded list, so opening a
 * branch immediately makes it bookable. The brief is explicit that customers create
 * shipment requests without paying online, so payment here is a collection method, never
 * a card capture.
 */
export function useOrderForm({ order, branches, lockedCustomerId }) {
  const routable = useMemo(() => branches.filter((b) => b.status === 'active'), [branches])
  const [f, setF] = useState(() => {
    if (order) return fromOrder(order)
    const home = routable.find((b) => b.type === 'hq') || routable[0]
    const other = routable.find((b) => b.country === 'Nigeria' && b.city !== (home && home.city))
    return {
      ...blank,
      customerId: lockedCustomerId || '',
      originCode: home ? home.code : '',
      destinationCode: other ? other.code : '',
    }
  })
  const [boxes, setBoxes] = useState(() => (order && order.boxes && order.boxes.length ? order.boxes : [newBox()]))
  const [dimUnit, setDimUnit] = useState((order && order.dimUnit) || 'cm')

  const set = (k) => (v) => setF((s) => ({ ...s, [k]: v }))

  // Switching service switches the unit too, so carry the quantity over only when the two
  // services measure the same thing — 50 kg must never silently become 50 containers.
  const setService = (id) => setF((s) => {
    const from = serviceById(s.serviceId)
    const to = serviceById(id)
    return { ...s, serviceId: id, quantity: from.unit === to.unit ? s.quantity : to.defaultQty }
  })

  const swapRoute = () => setF((s) => ({
    ...s,
    originCode: s.destinationCode, destinationCode: s.originCode,
    originAddress: s.destinationAddress, destinationAddress: s.originAddress,
  }))

  const svc = serviceById(f.serviceId)
  const dimensional = usesDimensions(f.serviceId)

  const measured = useMemo(
    () => (dimensional ? measureBoxes(boxes, dimUnit) : null),
    [boxes, dimUnit, dimensional]
  )
  const hasMeasurements = !!(measured && (measured.cbm > 0 || measured.volumetricKg > 0))
  const chargeable = chargeableQuantity(f.serviceId, f.quantity, hasMeasurements ? measured : null)

  const q = useMemo(
    () => quote({ serviceId: f.serviceId, quantity: chargeable, pieces: f.pieces, insured: f.insured, declaredValue: f.declaredValue }),
    [f.serviceId, chargeable, f.pieces, f.insured, f.declaredValue]
  )

  const errors = {
    customerId: !f.customerId ? 'Choose the customer this job belongs to' : '',
    receiverName: !String(f.receiverName).trim() ? 'Who is receiving it?' : '',
    quantity: !(chargeable >= svc.minQty)
      ? 'Enter the ' + svc.unitLabel.toLowerCase() + ' (minimum ' + svc.minQty + ' ' + svc.unitShort + ')' : '',
    origin: !f.originCode ? 'Choose a collection branch' : '',
    destination: !f.destinationCode ? 'Choose a delivery branch'
      : f.destinationCode === f.originCode ? 'Collection and delivery must differ' : '',
  }
  const valid = !Object.values(errors).some(Boolean)

  const build = () => {
    const byCode = (c) => routable.find((b) => b.code === c) || routable[0]
    const origin = byCode(f.originCode)
    const destination = byCode(f.destinationCode)
    return {
      customerId: f.customerId,
      serviceId: f.serviceId,
      origin: { city: origin.city, country: origin.country, hub: origin.code, branchId: origin.id, address: f.originAddress },
      destination: { city: destination.city, country: destination.country, hub: destination.code, branchId: destination.id, address: f.destinationAddress },
      receiver: { name: f.receiverName, phone: f.receiverPhone },
      pieces: Number(f.pieces) || 1,
      // What gets billed is the chargeable figure, not the gross one the operator typed.
      quantity: Math.round(chargeable * 100) / 100,
      grossQuantity: Number(f.quantity) || 0,
      boxes: hasMeasurements ? boxes : [],
      dimUnit,
      contents: f.contents,
      declaredValue: Number(f.declaredValue) || 0,
      insured: f.insured,
      paymentMode: f.paymentMode === 'Account' ? 'Account (invoiced)'
        : f.paymentMode === 'COD' ? 'Pay on collection' : 'Prepaid',
      apptDelivery: f.apptDelivery,
      freightMode: f.freightMode,
      insuredBy: f.insuredBy,
      notes: f.notes,
    }
  }

  return {
    f, set, setService, swapRoute, q, errors, valid, build, routable, svc,
    boxes, setBoxes, dimUnit, setDimUnit, measured, hasMeasurements, chargeable, dimensional,
  }
}

/* ── Panels ────────────────────────────────────────────────────────────────── */

function DimensionsPanel({ form }) {
  const { boxes, setBoxes, dimUnit, setDimUnit, measured, svc, f, chargeable } = form
  const update = (id, k, v) => setBoxes((bs) => bs.map((b) => (b.id === id ? { ...b, [k]: v } : b)))

  return (
    <div className="panel border-navy-200 bg-navy-50/40">
      <div className="panel-head justify-between text-navy-700">
        <span className="flex items-center gap-2">
          <Ruler size={14} /> Dimensions
          <span className="seg w-auto border-navy-200">
            {Object.keys(LENGTH_UNITS).map((u) => (
              <button
                key={u} type="button" onClick={() => setDimUnit(u)} aria-pressed={dimUnit === u}
                className={clsx('seg-btn px-2.5 py-1 text-[10px] uppercase', dimUnit === u && 'seg-btn-on-orange')}
              >
                {u}
              </button>
            ))}
          </span>
        </span>
        <button
          type="button"
          className="btn-ghost btn-sm border-orange-300 text-orange-600 hover:bg-orange-50"
          onClick={() => setBoxes((bs) => [...bs, newBox()])}
        >
          <Plus size={13} /> Add box
        </button>
      </div>

      <div className="mt-3 space-y-2">
        <div className="hidden grid-cols-[1fr_1fr_1fr_80px_36px] gap-2 px-1 sm:grid">
          {['Length', 'Width', 'Height', 'Qty'].map((h) => (
            <span key={h} className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{h}</span>
          ))}
          <span />
        </div>
        {boxes.map((b) => (
          <div key={b.id} className="grid grid-cols-2 gap-2 sm:grid-cols-[1fr_1fr_1fr_80px_36px]">
            {['l', 'w', 'h'].map((k) => (
              <input
                key={k} type="number" min="0" step="0.1" value={b[k]} placeholder="0.0"
                onChange={(e) => update(b.id, k, e.target.value)}
                className="field tnum bg-white text-center"
              />
            ))}
            <input
              type="number" min="1" value={b.qty}
              onChange={(e) => update(b.id, 'qty', e.target.value)}
              className="field tnum bg-white text-center"
            />
            <button
              type="button"
              disabled={boxes.length === 1}
              onClick={() => setBoxes((bs) => bs.filter((x) => x.id !== b.id))}
              className="grid place-items-center rounded-lg border border-slate-200 bg-white text-slate-400 transition-colors hover:border-red-300 hover:text-red-600 disabled:opacity-40"
              aria-label="Remove box"
            >
              <X size={14} />
            </button>
          </div>
        ))}
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        <div className="flex flex-1 items-center justify-between gap-3 rounded-lg border border-navy-200 bg-white px-3 py-2">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
            {svc.unit === 'cbm' ? 'Measured volume' : 'Volumetric wt.'}
          </span>
          <span className="text-sm font-bold tnum text-navy-900">
            {svc.unit === 'cbm' ? measured.cbm.toFixed(2) + ' CBM' : measured.volumetricKg.toFixed(2) + ' kg'}
          </span>
        </div>
        <div className="flex flex-1 items-center justify-between gap-3 rounded-lg border border-orange-200 bg-orange-50 px-3 py-2">
          <span className="text-[10px] font-bold uppercase tracking-wider text-orange-500">Chargeable</span>
          <span className="text-sm font-bold tnum text-orange-700">{fmtUnits(f.serviceId, chargeable)}</span>
        </div>
      </div>

      <p className="mt-2 flex items-start gap-1.5 text-[11px] leading-relaxed text-slate-500">
        <Info size={12} className="mt-0.5 shrink-0" />
        {svc.unit === 'cbm'
          ? 'Ocean LCL bills the measured volume of the cargo.'
          : 'Billed on the greater of gross and volumetric weight (L×W×H ÷ 5000).'}
      </p>
    </div>
  )
}

function ServicesPanel({ form, lockedCustomerId }) {
  const { f, set } = form
  const rows = [
    {
      label: 'Payment', required: true, tone: 'navy', value: f.paymentMode, onChange: set('paymentMode'),
      options: [{ value: 'Prepaid', label: 'Prepaid' }, { value: 'COD', label: 'COD' }, { value: 'Account', label: 'Account' }],
    },
    {
      label: 'Appt. delivery', tone: 'orange', value: f.apptDelivery, onChange: set('apptDelivery'),
      options: [{ value: false, label: 'No' }, { value: true, label: 'Yes' }],
    },
    {
      label: 'Freight mode', tone: 'navy', value: f.freightMode, onChange: set('freightMode'),
      options: [{ value: 'Prepaid', label: 'Prepaid' }, { value: 'Pay After Pickup', label: 'Pay After Pickup' }],
    },
    {
      label: 'Insurance by', tone: 'orange', value: f.insuredBy,
      onChange: (v) => { set('insuredBy')(v); set('insured')(v === 'Owner') },
      options: [{ value: 'Owner', label: 'Owner' }, { value: 'Carrier', label: 'Carrier' }],
    },
  ]

  return (
    <div className="panel border-orange-200 bg-orange-50/40">
      <p className="panel-head text-orange-600"><SlidersHorizontal size={14} /> Additional services</p>
      <div className="mt-3 grid gap-x-4 gap-y-3 sm:grid-cols-2">
        {rows.map((r) => (
          <div key={r.label}>
            <p className="mb-1 text-[10px] font-bold uppercase tracking-wider text-slate-500">
              {r.label}{r.required && <span className="text-orange-500"> *</span>}
            </p>
            <Segmented value={r.value} onChange={r.onChange} options={r.options} tone={r.tone} />
          </div>
        ))}
      </div>
      <p className="mt-3 text-[11px] text-slate-500">
        {lockedCustomerId
          ? 'No payment is taken now — we confirm the rate first and invoice your account.'
          : 'Job requests are submitted without online payment.'}
      </p>
    </div>
  )
}

/* ── The stepped body ──────────────────────────────────────────────────────── */

export function OrderFormFields({ form, customers, lockedCustomerId, touched }) {
  const { f, set, setService, swapRoute, errors, routable, svc, dimensional, q } = form
  const [showDims, setShowDims] = useState(false)
  const [showServices, setShowServices] = useState(false)
  const err = (k) => (touched && errors[k] ? errors[k] : '')

  return (
    <div className="space-y-5">
      {/* Steps 1 and 2 — the route */}
      <div className="space-y-3">
        <AddressPicker
          tone="pickup"
          step="Step 1"
          title="— Pickup location"
          branches={routable}
          value={f.originCode}
          onChange={set('originCode')}
          address={f.originAddress}
          onAddressChange={set('originAddress')}
          error={err('origin')}
        />

        <div className="flex justify-center">
          <button
            type="button"
            onClick={swapRoute}
            className="-my-1 grid h-8 w-8 place-items-center rounded-full border border-slate-300 bg-white text-slate-500 shadow-sm transition-colors hover:border-navy-400 hover:text-navy-800"
            title="Swap pickup and delivery"
            aria-label="Swap pickup and delivery"
          >
            <ArrowUpDown size={14} />
          </button>
        </div>

        <AddressPicker
          tone="delivery"
          step="Step 2"
          title="— Where to deliver?"
          branches={routable}
          value={f.destinationCode}
          onChange={set('destinationCode')}
          address={f.destinationAddress}
          onAddressChange={set('destinationAddress')}
          error={err('destination')}
        />

        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Receiver name">
            <input className="field" value={f.receiverName} onChange={(e) => set('receiverName')(e.target.value)} placeholder="Who signs for it" />
            {err('receiverName') && <span className="mt-1 block text-xs text-red-600">{err('receiverName')}</span>}
          </Field>
          <Field label="Receiver phone">
            <input className="field" value={f.receiverPhone} onChange={(e) => set('receiverPhone')(e.target.value)} placeholder="+234 …" />
          </Field>
        </div>
      </div>

      {/* Step 3 — the consignment */}
      <div>
        <p className="step-head mb-1.5"><span className="step-dot bg-navy-900" /> Step 3 — Consignment</p>

        <div className="grid gap-3 sm:grid-cols-2">
          {!lockedCustomerId && (
            <Field label="Customer">
              <Select
                value={f.customerId}
                onChange={set('customerId')}
                options={[{ value: '', label: 'Select a customer…' },
                  ...customers.map((c) => ({ value: c.id, label: c.name + (c.company ? ' — ' + c.company : '') }))]}
              />
              {err('customerId') && <span className="mt-1 block text-xs text-red-600">{err('customerId')}</span>}
            </Field>
          )}
          <Field label="Service" className={lockedCustomerId ? 'sm:col-span-2' : ''}>
            <Select
              value={f.serviceId}
              onChange={setService}
              options={SERVICES.map((s) => ({ value: s.id, label: s.label + ' · ' + s.eta + ' day ETA' }))}
            />
          </Field>
        </div>

        <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-3">
          <UnitField label="Pieces" value={f.pieces} onChange={set('pieces')} suffix="pcs" tone="navy" min={1} step={1} />
          <UnitField label={svc.unitLabel} value={f.quantity} onChange={set('quantity')} suffix={svc.unitShort} tone="orange" min={0} step={svc.step} />
          <UnitField label="Declared value" value={f.declaredValue} onChange={set('declaredValue')} prefix={CURRENCY_SYMBOL} suffix="value" tone="emerald" min={0} step={1000} />
        </div>
        {err('quantity') && <p className="mt-1 text-xs text-red-600">{err('quantity')}</p>}

        <div className="mt-2 grid grid-cols-2 gap-2">
          <button
            type="button"
            disabled={!dimensional}
            onClick={() => setShowDims((v) => !v)}
            title={dimensional ? '' : svc.label + ' is not rated on dimensions'}
            className={clsx('btn btn-lg', showDims ? 'bg-navy-800 text-white' : 'btn-primary', !dimensional && 'opacity-40')}
          >
            {showDims ? <X size={15} /> : <Plus size={15} />} Dimensions
          </button>
          <button
            type="button"
            onClick={() => setShowServices((v) => !v)}
            className={clsx('btn btn-lg', showServices ? 'bg-orange-600 text-white' : 'btn-accent')}
          >
            {showServices ? <X size={15} /> : <Plus size={15} />} Services
          </button>
        </div>

        {showDims && dimensional && <div className="mt-3"><DimensionsPanel form={form} /></div>}
        {showServices && <div className="mt-3"><ServicesPanel form={form} lockedCustomerId={lockedCustomerId} /></div>}

        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <Field label="Cargo description">
            <input className="field" value={f.contents} onChange={(e) => set('contents')(e.target.value)} placeholder="General cargo, machinery parts, textiles…" />
          </Field>
          <Field label={lockedCustomerId ? 'Notes for our team' : 'Internal notes'}>
            <input className="field" value={f.notes} onChange={(e) => set('notes')(e.target.value)} placeholder="Handling or customs instructions…" />
          </Field>
        </div>
      </div>

      {/* Live quote — the same engine that later raises the invoice. */}
      <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
        <p className="panel-head text-slate-500"><Boxes size={14} /> Quoted charge</p>
        <ul className="mt-3 space-y-1">
          {q.lines.map((l) => (
            <li key={l.label} className="flex justify-between gap-4 text-xs text-slate-600">
              <span>{l.label}</span>
              <span className="tnum">{fmtMoney(l.amount)}</span>
            </li>
          ))}
        </ul>
        <div className="mt-2 flex items-baseline justify-between gap-4 border-t border-slate-200 pt-2">
          <span className="text-sm font-bold text-navy-900">Total</span>
          <span className="text-xl font-bold tnum text-navy-900">{fmtMoney(q.total)}</span>
        </div>
        <p className="mt-1 text-[11px] text-slate-500">Estimated delivery in {q.etaDays} working days.</p>
      </div>
    </div>
  )
}

/* ── Wrappers ──────────────────────────────────────────────────────────────── */

/** Full-page booking form — the admin and customer "Create Order" sections. */
export function OrderFormPanel({ customers, branches, lockedCustomerId, onSubmit, submitLabel = 'Raise job request' }) {
  const form = useOrderForm({ branches, lockedCustomerId })
  const [touched, setTouched] = useState(false)

  const submit = () => {
    setTouched(true)
    if (!form.valid) return
    onSubmit(form.build())
  }

  return (
    <Card className="card-pad">
      <OrderFormFields form={form} customers={customers} lockedCustomerId={lockedCustomerId} touched={touched} />
      <div className="mt-5 border-t border-slate-200 pt-5">
        <button className="btn-accent btn-lg w-full" onClick={submit}>
          <PackagePlus size={16} /> {submitLabel}
        </button>
        {touched && !form.valid && (
          <p className="mt-2 text-center text-xs text-red-600">Check the highlighted steps above.</p>
        )}
      </div>
    </Card>
  )
}

/** Modal variant — editing an existing job from its detail page. */
export default function OrderForm({ open, onClose, customers, branches, order, onSubmit }) {
  const form = useOrderForm({ order, branches })
  const [touched, setTouched] = useState(false)

  const submit = () => {
    setTouched(true)
    if (!form.valid) return
    onSubmit(form.build())
    onClose()
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={'Update job ' + order.id}
      subtitle="Changes are logged against the customer activity trail."
      width="max-w-3xl"
      footer={
        <>
          <button className="btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn-primary" onClick={submit}><Save size={16} /> Save changes</button>
        </>
      }
    >
      <OrderFormFields form={form} customers={customers} touched={touched} />
    </Modal>
  )
}
