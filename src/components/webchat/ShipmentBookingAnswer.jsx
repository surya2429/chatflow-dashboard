// ShipmentBookingAnswer.jsx — the "Shipment Booking" question type.
//
// Built as a guided, single-purpose-per-screen WIZARD rather than one dense
// form, because a form is the wrong shape for a ~340px chat composer. Cramming
// pickup + delivery + package + dimensions + payment + delivery preferences
// onto one scrolling card (the first version of this, and the shape of the
// reference courier-app screenshots it was modelled on) works on a desktop
// booking page with room to spare; in a chat widget it reads as a wall of
// inputs before the visitor has done anything. Five short, focused steps with
// a visible progress bar and one clear next action is the pattern chat
// commerce (WhatsApp Flows, Instagram forms) converges on for exactly this
// reason — less to parse per screen, an obvious way forward, and a real
// review step at the end instead of trusting the visitor to have got a dense
// form right the first time.
//
// Still its own file, not a case in AnswerControls.jsx — this is a five-step
// sub-app with its own state machine, not a five-line control.
import { useState, useMemo } from 'react'
import { Filter, Zap, Check, Pencil, Truck as TruckIcon } from 'lucide-react'
import {
  UNIT_TO_CM, VOLUMETRIC_DIVISOR, field, ink, faint,
  StepProgress, StepHeader, WizardNav, Toggle, FieldLabel, LocationStep, PackageStep,
} from './shipmentShared'

/* ── step 4 — payment, appointment, freight, insurance ───────────────────
   Each preference is one labelled toggle row; a conditional field fades in
   directly under the toggle that triggered it, so cause and effect stay
   visually adjacent instead of the field appearing somewhere else on a
   crowded shared card. ──────────────────────────────────────────────────── */
function PreferencesStep({ accent, dark, codEnabled, appointmentEnabled, insuranceEnabled,
  payment, setPayment, codAmount, setCodAmount, apptDelivery, setApptDelivery, deliveryDate, setDeliveryDate,
  freightMode, setFreightMode, insuranceBy, setInsuranceBy, onBack, onNext, currency }) {
  const codReady = payment !== 'cod' || Boolean(codAmount)
  const apptReady = apptDelivery !== 'yes' || Boolean(deliveryDate)
  return (
    <>
      <StepHeader icon={TruckIcon} color={accent} dark={dark} title="Delivery preferences" subtitle="Payment, timing and cover"/>
      <div className="flex-1 min-h-0 overflow-y-auto wc-scroll px-3.5 py-2 space-y-2.5">
        <div>
          <FieldLabel dark={dark}>Payment{codEnabled ? ' *' : ''}</FieldLabel>
          <Toggle accent={accent} dark={dark} value={payment} onChange={setPayment}
            options={codEnabled ? [{ value: 'prepaid', label: 'Prepaid' }, { value: 'cod', label: 'Cash on delivery' }] : [{ value: 'prepaid', label: 'Prepaid' }]}/>
          {payment === 'cod' && (
            <div className="mt-1.5 wc-ac-fade">
              <input value={codAmount} onChange={e => setCodAmount(e.target.value.replace(/[^\d.]/g, ''))} inputMode="decimal"
                placeholder={`Amount to collect (${currency})`}
                className="w-full rounded-lg px-2.5 py-2 text-[11px] outline-none" style={{ ...field(dark), borderColor: accent }}/>
            </div>
          )}
        </div>

        {appointmentEnabled && (
          <div>
            <FieldLabel dark={dark}>Appointment delivery</FieldLabel>
            <Toggle accent={accent} dark={dark} value={apptDelivery} onChange={setApptDelivery}
              options={[{ value: 'no', label: 'No' }, { value: 'yes', label: 'Yes, schedule it' }]}/>
            {apptDelivery === 'yes' && (
              <div className="mt-1.5 wc-ac-fade">
                <input type="date" value={deliveryDate} onChange={e => setDeliveryDate(e.target.value)}
                  className="w-full rounded-lg px-2.5 py-2 text-[11px] outline-none" style={{ ...field(dark), borderColor: accent }}/>
              </div>
            )}
          </div>
        )}

        <div>
          <FieldLabel dark={dark}>Freight mode</FieldLabel>
          <Toggle accent={accent} dark={dark} value={freightMode} onChange={setFreightMode}
            options={[{ value: 'prepaid', label: 'Prepaid' }, { value: 'topay', label: 'Pay after pickup' }]}/>
        </div>

        {insuranceEnabled && (
          <div>
            <FieldLabel dark={dark}>Insurance by</FieldLabel>
            <Toggle accent={accent} dark={dark} value={insuranceBy} onChange={setInsuranceBy}
              options={[{ value: 'owner', label: 'Owner' }, { value: 'carrier', label: 'Carrier' }]}/>
          </div>
        )}
      </div>
      <WizardNav accent={accent} dark={dark} onBack={onBack} onNext={onNext} nextDisabled={!codReady || !apptReady} nextLabel="Review"/>
    </>
  )
}

/* ── step 5 — a receipt-style review, not another form. Each section has its
   own small edit affordance that jumps straight back to the step that owns
   it, rather than trusting the visitor to have got everything right the
   first time through. ────────────────────────────────────────────────────── */
function ReviewRow({ label, value, onEdit, dark }) {
  return (
    <div className="flex items-start justify-between gap-2 py-2 border-b last:border-b-0" style={{ borderColor: dark ? '#1e293b' : '#eef1f6' }}>
      <div className="min-w-0">
        <p className="text-[9px] font-bold uppercase tracking-wide" style={{ color: faint(dark) }}>{label}</p>
        <p className="text-[11.5px] font-semibold mt-0.5 leading-snug" style={{ color: ink(dark) }}>{value}</p>
      </div>
      <button type="button" onClick={onEdit} className="flex-shrink-0 p-1 rounded-md" style={{ color: faint(dark) }}>
        <Pencil size={11}/>
      </button>
    </div>
  )
}

function ReviewStep({ accent, dark, currency, pickup, delivery, boxCount, weight, value, chargeableKg, volumetricKg,
  payment, codAmount, apptDelivery, deliveryDate, freightMode, insuranceBy, insuranceEnabled,
  rateEstimate, onCheckRates, onBook, goTo }) {
  return (
    <>
      <StepHeader icon={Check} color={accent} dark={dark} title="Review & confirm" subtitle="Everything look right?"/>
      <div className="flex-1 min-h-0 overflow-y-auto wc-scroll px-3.5 py-1">
        <div className="rounded-xl px-3 py-0.5" style={{ background: dark ? '#0b1424' : '#fff', border: `1.5px solid ${dark ? '#22304a' : '#e2e8f0'}` }}>
          <ReviewRow dark={dark} label="Pickup" value={pickup.summary} onEdit={() => goTo(1)}/>
          <ReviewRow dark={dark} label="Delivery" value={delivery.summary} onEdit={() => goTo(2)}/>
          <ReviewRow dark={dark} label="Package"
            value={`${boxCount || 1} box${Number(boxCount) === 1 ? '' : 'es'} · ${weight} kg${volumetricKg > 0 ? ` (${chargeableKg.toFixed(2)} kg chargeable)` : ''} · ${currency}${value || 0}`}
            onEdit={() => goTo(3)}/>
          <ReviewRow dark={dark} label="Preferences"
            value={[
              payment === 'cod' ? `COD ${currency}${codAmount}` : 'Prepaid',
              apptDelivery === 'yes' ? `Scheduled ${deliveryDate}` : 'No appointment',
              freightMode === 'prepaid' ? 'Freight prepaid' : 'Freight pay after pickup',
              insuranceEnabled ? `${insuranceBy === 'owner' ? 'Owner' : 'Carrier'} insures` : null,
            ].filter(Boolean).join(' · ')}
            onEdit={() => goTo(4)}/>
        </div>

        {rateEstimate != null && (
          <div className="rounded-xl px-3 py-2.5 mt-2 flex items-center justify-between wc-ac-fade" style={{ background: `${accent}12` }}>
            <span className="text-[11px] font-semibold" style={{ color: ink(dark) }}>Estimated rate</span>
            <span className="text-[15px] font-black" style={{ color: accent }}>{currency}{rateEstimate.toFixed(0)}</span>
          </div>
        )}
      </div>

      <div className="px-3.5 pb-3.5 pt-2 space-y-1.5">
        <button type="button" onClick={onCheckRates}
          className="w-full flex items-center justify-center gap-1.5 py-2 rounded-xl text-[11px] font-bold"
          style={{ background: dark ? '#111c30' : '#f1f5f9', color: ink(dark) }}>
          <Filter size={12}/> Check rates
        </button>
        <button type="button" onClick={onBook}
          className="w-full flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-[12px] font-bold text-white"
          style={{ background: accent }}>
          <Zap size={13}/> Confirm & book
        </button>
      </div>
    </>
  )
}

/* ── the wizard shell ─────────────────────────────────────────────────────
   `data` is the node's own saved config from the flow builder — currency
   symbol, rate estimate, and which optional sections the merchant wants. */
export default function ShipmentBookingAnswer({ accent, dark, onSubmit, data = {}, googleMapsApiKey }) {
  const currency = data.currency || '₹'
  const ratePerKg = Number(data.ratePerKg) || 5
  const showDimensions = data.showDimensions !== false
  const codEnabled = data.codEnabled !== false
  const insuranceEnabled = data.insuranceEnabled !== false
  const appointmentEnabled = data.appointmentEnabled !== false

  const [step, setStep] = useState(1)
  const TOTAL_STEPS = 5

  const [pickup, setPickup] = useState(null)
  const [delivery, setDelivery] = useState(null)

  const [boxCount, setBoxCount] = useState('1')
  const [weight, setWeight] = useState('')
  const [value, setValue] = useState('')
  const [dimsOn, setDimsOn] = useState(false)
  const [dims, setDims] = useState([{ l: '', w: '', h: '', qty: 1 }])
  const [dimUnit, setDimUnit] = useState('cm')

  const [payment, setPayment] = useState('prepaid')
  const [codAmount, setCodAmount] = useState('')
  const [apptDelivery, setApptDelivery] = useState('no')
  const [deliveryDate, setDeliveryDate] = useState('')
  const [freightMode, setFreightMode] = useState('prepaid')
  const [insuranceBy, setInsuranceBy] = useState('owner')

  const [rateEstimate, setRateEstimate] = useState(null)

  const volumetricKg = useMemo(() => {
    if (!dimsOn) return 0
    const factor = UNIT_TO_CM[dimUnit] ** 3
    return dims.reduce((sum, b) => sum + ((Number(b.l) || 0) * (Number(b.w) || 0) * (Number(b.h) || 0) * factor * (Number(b.qty) || 0)) / VOLUMETRIC_DIVISOR, 0)
  }, [dims, dimUnit, dimsOn])

  const actualKg = Number(weight) || 0
  const chargeableKg = Math.max(actualKg, volumetricKg)

  const checkRates = () => setRateEstimate(Math.max(chargeableKg, 0.5) * ratePerKg)

  const book = () => {
    const lines = [
      `Pickup: ${pickup.summary}`,
      `Delivery: ${delivery.summary}`,
      `Package: ${boxCount || 1} box${Number(boxCount) === 1 ? '' : 'es'} · ${actualKg} kg · ${currency}${value || 0}`,
    ]
    if (volumetricKg > 0) lines.push(`Chargeable weight: ${chargeableKg.toFixed(2)} kg (volumetric ${volumetricKg.toFixed(2)} kg)`)
    lines.push(`Payment: ${payment === 'cod' ? `COD — collect ${currency}${codAmount}` : 'Prepaid'}`)
    if (appointmentEnabled) lines.push(apptDelivery === 'yes' ? `Appointment delivery: ${deliveryDate}` : 'Appointment delivery: No')
    lines.push(`Freight mode: ${freightMode === 'prepaid' ? 'Prepaid' : 'Pay after pickup'}`)
    if (insuranceEnabled) lines.push(`Insurance by: ${insuranceBy === 'owner' ? 'Owner' : 'Carrier'}`)
    if (rateEstimate != null) lines.push(`Estimated rate: ${currency}${rateEstimate.toFixed(0)}`)
    onSubmit?.(lines.join('\n'))
  }

  // Steps effectively still gate on required data at the wizard level (via
  // each step's own WizardNav disabled state) — `goTo` from the review step
  // is trusted because you can only reach review by having already cleared
  // every step's own gate once.
  const goTo = n => setStep(n)

  return (
    <div className="w-full rounded-2xl overflow-hidden flex flex-col" style={{ background: dark ? '#0b1424' : '#fff', border: `1.5px solid ${dark ? '#22304a' : '#e2e8f0'}`, boxShadow: dark ? 'none' : '0 8px 24px -12px rgba(15,23,42,0.18)', maxHeight: 420 }}>
      <StepProgress step={step} total={TOTAL_STEPS} accent={accent} dark={dark}/>

      {step === 1 && (
        <LocationStep key="pickup" direction="pickup" apiKey={googleMapsApiKey} accent={accent} dark={dark}
          value={pickup} onPick={p => { setPickup(p); setStep(2) }}/>
      )}
      {step === 2 && (
        <LocationStep key="delivery" direction="delivery" apiKey={googleMapsApiKey} accent={accent} dark={dark}
          value={delivery} onPick={p => { setDelivery(p); setStep(3) }} onExit={() => setStep(1)}/>
      )}
      {step === 3 && (
        <PackageStep accent={accent} dark={dark} currency={currency}
          boxCount={boxCount} setBoxCount={setBoxCount} weight={weight} setWeight={setWeight} value={value} setValue={setValue}
          showDimensions={showDimensions} dims={dims} setDims={setDims} dimUnit={dimUnit} setDimUnit={setDimUnit} dimsOn={dimsOn} setDimsOn={setDimsOn}
          onBack={() => setStep(2)} onNext={() => setStep(4)}/>
      )}
      {step === 4 && (
        <PreferencesStep accent={accent} dark={dark} currency={currency}
          codEnabled={codEnabled} appointmentEnabled={appointmentEnabled} insuranceEnabled={insuranceEnabled}
          payment={payment} setPayment={setPayment} codAmount={codAmount} setCodAmount={setCodAmount}
          apptDelivery={apptDelivery} setApptDelivery={setApptDelivery} deliveryDate={deliveryDate} setDeliveryDate={setDeliveryDate}
          freightMode={freightMode} setFreightMode={setFreightMode} insuranceBy={insuranceBy} setInsuranceBy={setInsuranceBy}
          onBack={() => setStep(3)} onNext={() => setStep(5)}/>
      )}
      {step === 5 && pickup && delivery && (
        <ReviewStep accent={accent} dark={dark} currency={currency}
          pickup={pickup} delivery={delivery} boxCount={boxCount} weight={actualKg} value={value}
          chargeableKg={chargeableKg} volumetricKg={volumetricKg}
          payment={payment} codAmount={codAmount} apptDelivery={apptDelivery} deliveryDate={deliveryDate}
          freightMode={freightMode} insuranceBy={insuranceBy} insuranceEnabled={insuranceEnabled}
          rateEstimate={rateEstimate} onCheckRates={checkRates} onBook={book} goTo={goTo}/>
      )}
    </div>
  )
}
