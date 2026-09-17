import { useMemo, useState } from 'react'
import { PackagePlus, Info, Save } from 'lucide-react'
import { SERVICES, quote, serviceById } from '../lib/domain'
import { fmtMoney } from '../lib/format'
import { Field, Select, Toggle, Modal, Card } from './ui'

const blank = {
  customerId: '', serviceId: 'air_freight',
  originCode: '', originAddress: '', destinationCode: '', destinationAddress: '',
  receiverName: '', receiverPhone: '',
  pieces: 1, quantity: 50, contents: '', declaredValue: 0, insured: false,
  paymentMode: 'Pay on collection', notes: '',
}

const fromOrder = (o) => ({
  customerId: o.customerId, serviceId: o.serviceId,
  originCode: o.origin.hub, originAddress: o.origin.address || '',
  destinationCode: o.destination.hub, destinationAddress: o.destination.address || '',
  receiverName: o.receiver.name, receiverPhone: o.receiver.phone,
  pieces: o.pieces, quantity: o.quantity, contents: o.contents,
  declaredValue: o.declaredValue, insured: o.insured,
  paymentMode: o.paymentMode, notes: o.notes || '',
})

/**
 * Shared booking form for staff and customers.
 *
 * Routes are drawn from the live branch network rather than a hard-coded list, so opening
 * a branch immediately makes it bookable. The brief is explicit that customers create
 * shipment requests without paying online, so payment is a collection method here, never
 * a card capture.
 */
export function useOrderForm({ order, branches, lockedCustomerId }) {
  const routable = useMemo(() => branches.filter((b) => b.status === 'active'), [branches])
  const [f, setF] = useState(() => {
    if (order) return fromOrder(order)
    return {
      ...blank,
      customerId: lockedCustomerId || '',
      originCode: routable[0] ? routable[0].code : '',
      destinationCode: routable[1] ? routable[1].code : '',
    }
  })

  const set = (k) => (v) => setF((s) => ({ ...s, [k]: v }))

  // Switching service switches the unit too, so carry the quantity over only when the two
  // services measure the same thing — 50 kg must never silently become 50 containers.
  const setService = (id) => setF((s) => {
    const from = serviceById(s.serviceId)
    const to = serviceById(id)
    return { ...s, serviceId: id, quantity: from.unit === to.unit ? s.quantity : to.defaultQty }
  })
  const branchByCode = (code) => routable.find((b) => b.code === code) || routable[0]

  const q = useMemo(
    () => quote({ serviceId: f.serviceId, quantity: f.quantity, pieces: f.pieces, insured: f.insured, declaredValue: f.declaredValue }),
    [f.serviceId, f.quantity, f.pieces, f.insured, f.declaredValue]
  )

  // Each service charges on its own basis, so the quantity field asks for whatever that
  // service actually measures — kilos, CBM, containers, tonnes, pallets or declarations.
  const svc = serviceById(f.serviceId)

  const errors = {
    customerId: !f.customerId ? 'Select the customer this order belongs to' : '',
    receiverName: !String(f.receiverName).trim() ? 'Receiver name is required' : '',
    quantity: !(Number(f.quantity) >= svc.minQty)
      ? 'Enter the ' + svc.unitLabel.toLowerCase() + ' (minimum ' + svc.minQty + ' ' + svc.unitShort + ')' : '',
    route: !f.originCode || !f.destinationCode ? 'Choose a collection and delivery branch'
      : f.originCode === f.destinationCode ? 'Collection and delivery must be different branches' : '',
  }
  const valid = !Object.values(errors).some(Boolean)

  const build = () => {
    const origin = branchByCode(f.originCode)
    const destination = branchByCode(f.destinationCode)
    return {
      customerId: f.customerId,
      serviceId: f.serviceId,
      origin: { city: origin.city, country: origin.country, hub: origin.code, branchId: origin.id, address: f.originAddress },
      destination: { city: destination.city, country: destination.country, hub: destination.code, branchId: destination.id, address: f.destinationAddress },
      receiver: { name: f.receiverName, phone: f.receiverPhone },
      pieces: Number(f.pieces) || 1,
      quantity: Number(f.quantity) || 0,
      contents: f.contents,
      declaredValue: Number(f.declaredValue) || 0,
      insured: f.insured,
      paymentMode: f.paymentMode,
      notes: f.notes,
    }
  }

  return { f, set, setService, q, errors, valid, build, routable, svc }
}

export function OrderFormFields({ form, customers, lockedCustomerId, touched }) {
  const { f, set, setService, q, errors, routable, svc } = form
  const err = (k) => (touched && errors[k] ? <span className="mt-1 block text-xs text-red-600">{errors[k]}</span> : null)
  const branchOptions = routable.map((b) => ({ value: b.code, label: b.city + ', ' + b.country + ' — ' + b.code }))

  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2">
        {!lockedCustomerId && (
          <Field label="Customer">
            <Select
              value={f.customerId}
              onChange={set('customerId')}
              options={[{ value: '', label: 'Select a customer…' },
                ...customers.map((c) => ({ value: c.id, label: c.name + (c.company ? ' — ' + c.company : '') }))]}
            />
            {err('customerId')}
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

      <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
        <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500">Route</p>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Collect from"><Select value={f.originCode} onChange={set('originCode')} options={branchOptions} /></Field>
          <Field label="Deliver to"><Select value={f.destinationCode} onChange={set('destinationCode')} options={branchOptions} /></Field>
          <Field label="Pickup address">
            <input className="field" value={f.originAddress} onChange={(e) => set('originAddress')(e.target.value)} placeholder="Street, building, area" />
          </Field>
          <Field label="Delivery address">
            <input className="field" value={f.destinationAddress} onChange={(e) => set('destinationAddress')(e.target.value)} placeholder="Street, building, area" />
          </Field>
        </div>
        {err('route')}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Receiver name">
          <input className="field" value={f.receiverName} onChange={(e) => set('receiverName')(e.target.value)} />
          {err('receiverName')}
        </Field>
        <Field label="Receiver phone">
          <input className="field" value={f.receiverPhone} onChange={(e) => set('receiverPhone')(e.target.value)} placeholder="+234 …" />
        </Field>
      </div>

      <div className="grid gap-4 sm:grid-cols-4">
        <Field label="Pieces">
          <input type="number" min="1" className="field tnum" value={f.pieces} onChange={(e) => set('pieces')(e.target.value)} />
        </Field>
        <Field label={svc.unitLabel + ' (' + svc.unitShort + ')'}>
          <input
            type="number" min={svc.minQty} step={svc.step} className="field tnum"
            value={f.quantity} onChange={(e) => set('quantity')(e.target.value)}
          />
          {err('quantity')}
        </Field>
        <Field label="Declared value" className="sm:col-span-2">
          <input type="number" min="0" className="field tnum" value={f.declaredValue} onChange={(e) => set('declaredValue')(e.target.value)} />
        </Field>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Contents">
          <input className="field" value={f.contents} onChange={(e) => set('contents')(e.target.value)} placeholder="General cargo, machinery parts, textiles…" />
        </Field>
        <Field label="Payment method" hint="Job requests are submitted without online payment.">
          <Select
            value={f.paymentMode}
            onChange={set('paymentMode')}
            options={[
              { value: 'Pay on collection', label: 'Pay on collection' },
              { value: 'Account (invoiced)', label: 'Account — invoiced monthly' },
              { value: 'Cash on delivery', label: 'Cash on delivery' },
            ]}
          />
        </Field>
      </div>

      <Toggle
        checked={f.insured}
        onChange={set('insured')}
        label="Insure this cargo"
        hint="Adds cover at 1.5% of declared value, minimum ₦15,000."
      />

      <Field label={lockedCustomerId ? 'Notes for our team' : 'Internal notes'}>
        <textarea className="field min-h-[72px]" value={f.notes} onChange={(e) => set('notes')(e.target.value)} placeholder="Handling instructions, customs notes…" />
      </Field>

      {/* Live quote — the same engine that later raises the invoice. */}
      <div className="rounded-xl border border-navy-200 bg-navy-50 p-4">
        <div className="flex items-start gap-2">
          <Info size={15} className="mt-0.5 shrink-0 text-navy-600" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-navy-900">Quoted charge</p>
            <ul className="mt-2 space-y-1">
              {q.lines.map((l) => (
                <li key={l.label} className="flex justify-between gap-4 text-xs text-navy-700">
                  <span>{l.label}</span>
                  <span className="tnum">{fmtMoney(l.amount)}</span>
                </li>
              ))}
            </ul>
            <div className="mt-2 flex justify-between gap-4 border-t border-navy-200 pt-2 text-sm font-bold text-navy-900">
              <span>Total</span>
              <span className="tnum">{fmtMoney(q.total)}</span>
            </div>
            <p className="mt-1.5 text-[11px] text-navy-600">Estimated delivery in {q.etaDays} working days.</p>
          </div>
        </div>
      </div>
    </div>
  )
}

/** Full-page booking form — the admin and customer "Create Order" sections. */
export function OrderFormPanel({ customers, branches, lockedCustomerId, onSubmit, submitLabel = 'Raise order request' }) {
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
      <div className="mt-6 flex items-center justify-end gap-2 border-t border-slate-200 pt-5">
        <button className="btn-primary" onClick={submit}><PackagePlus size={16} /> {submitLabel}</button>
      </div>
    </Card>
  )
}

/** Modal variant — editing an existing order from its detail page. */
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
      title={'Update order ' + order.id}
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
