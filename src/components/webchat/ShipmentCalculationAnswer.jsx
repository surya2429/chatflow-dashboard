// ShipmentCalculationAnswer.jsx — the "Rate Calculator" question type.
//
// The companion to ShipmentBookingAnswer.jsx: same pickup/delivery/package
// steps (via shipmentShared.jsx), but it stops at a rate — no payment,
// appointment or insurance step, and nothing gets "booked". This is the
// second tab of the reference courier app ("Rate Calculator" next to
// "Shipment Booking") split out as its own question type rather than a mode
// switch inside the booking wizard, because a merchant who only wants an
// instant quote on their site (no live booking pipeline behind it) shouldn't
// have to wire up COD/appointment/insurance config that a pure calculator
// will never ask about.
import { useState, useMemo } from 'react'
import { Calculator, RotateCcw } from 'lucide-react'
import {
  UNIT_TO_CM, VOLUMETRIC_DIVISOR, ink, faint,
  StepProgress, StepHeader, LocationStep, PackageStep,
} from './shipmentShared'

/* ── step 4 — the result. No review-and-edit receipt like the booking
   wizard's, because there's nothing being submitted for someone else to
   act on — just a number the visitor came here to see, plus a clear way to
   change an input and see it update. ────────────────────────────────────── */
function ResultStep({ accent, dark, currency, pickup, delivery, boxCount, weight, value, chargeableKg, volumetricKg, rate, onRecalculate, onDone }) {
  return (
    <>
      <StepHeader icon={Calculator} color={accent} dark={dark} title="Your estimated rate" subtitle="Based on chargeable weight"/>
      <div className="flex-1 min-h-0 overflow-y-auto wc-scroll px-3.5 py-2 space-y-2.5">
        <div className="rounded-2xl px-4 py-5 text-center" style={{ background: `${accent}12` }}>
          <p className="text-[10px] font-bold uppercase tracking-wide" style={{ color: accent }}>Estimated cost</p>
          <p className="text-[30px] font-black leading-tight mt-1" style={{ color: accent }}>{currency}{rate.toFixed(0)}</p>
          <p className="text-[10px] mt-1" style={{ color: faint(dark) }}>
            {chargeableKg.toFixed(2)} kg chargeable{volumetricKg > Number(weight) ? ' (volumetric)' : ''}
          </p>
        </div>

        <div className="rounded-xl px-3 py-1" style={{ background: dark ? '#0b1424' : '#fff', border: `1.5px solid ${dark ? '#22304a' : '#e2e8f0'}` }}>
          <Row dark={dark} label="Pickup" value={pickup.summary}/>
          <Row dark={dark} label="Delivery" value={delivery.summary}/>
          <Row dark={dark} label="Package"
            value={`${boxCount || 1} box${Number(boxCount) === 1 ? '' : 'es'} · ${weight} kg${value ? ` · ${currency}${value}` : ''}`} last/>
        </div>

        <p className="text-[9.5px] leading-relaxed text-center" style={{ color: faint(dark) }}>
          This is an instant estimate, not a locked-in price — the final rate is confirmed when you book.
        </p>
      </div>

      <div className="px-3.5 pb-3.5 pt-2 space-y-1.5">
        <button type="button" onClick={onRecalculate}
          className="w-full flex items-center justify-center gap-1.5 py-2 rounded-xl text-[11px] font-bold"
          style={{ background: dark ? '#111c30' : '#f1f5f9', color: ink(dark) }}>
          <RotateCcw size={12}/> Start over
        </button>
        <button type="button" onClick={onDone}
          className="w-full flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-[12px] font-bold text-white"
          style={{ background: accent }}>
          Got it, thanks
        </button>
      </div>
    </>
  )
}
function Row({ label, value, dark, last }) {
  return (
    <div className="flex items-start justify-between gap-2 py-2" style={!last ? { borderBottom: `1px solid ${dark ? '#1e293b' : '#eef1f6'}` } : undefined}>
      <p className="text-[9px] font-bold uppercase tracking-wide flex-shrink-0" style={{ color: faint(dark) }}>{label}</p>
      <p className="text-[11px] font-semibold text-right" style={{ color: ink(dark) }}>{value}</p>
    </div>
  )
}

/* ── the wizard shell ─────────────────────────────────────────────────────
   `data` is the node's own saved config from the flow builder — currency
   symbol, rate estimate, and whether dimensions are asked for. Lighter than
   ShipmentBookingAnswer's `data` contract on purpose: no codEnabled /
   appointmentEnabled / insuranceEnabled, since none of that applies to a
   quote-only flow. */
export default function ShipmentCalculationAnswer({ accent, dark, onSubmit, data = {}, googleMapsApiKey }) {
  const currency = data.currency || '₹'
  const ratePerKg = Number(data.ratePerKg) || 5
  const showDimensions = data.showDimensions !== false

  const [step, setStep] = useState(1)
  const TOTAL_STEPS = 4

  const [pickup, setPickup] = useState(null)
  const [delivery, setDelivery] = useState(null)

  const [boxCount, setBoxCount] = useState('1')
  const [weight, setWeight] = useState('')
  const [value, setValue] = useState('')
  const [dimsOn, setDimsOn] = useState(false)
  const [dims, setDims] = useState([{ l: '', w: '', h: '', qty: 1 }])
  const [dimUnit, setDimUnit] = useState('cm')

  const volumetricKg = useMemo(() => {
    if (!dimsOn) return 0
    const factor = UNIT_TO_CM[dimUnit] ** 3
    return dims.reduce((sum, b) => sum + ((Number(b.l) || 0) * (Number(b.w) || 0) * (Number(b.h) || 0) * factor * (Number(b.qty) || 0)) / VOLUMETRIC_DIVISOR, 0)
  }, [dims, dimUnit, dimsOn])

  const actualKg = Number(weight) || 0
  const chargeableKg = Math.max(actualKg, volumetricKg)
  const rate = Math.max(chargeableKg, 0.5) * ratePerKg

  const done = () => {
    const lines = [
      `Pickup: ${pickup.summary}`,
      `Delivery: ${delivery.summary}`,
      `Package: ${boxCount || 1} box${Number(boxCount) === 1 ? '' : 'es'} · ${actualKg} kg${value ? ` · ${currency}${value}` : ''}`,
    ]
    if (volumetricKg > 0) lines.push(`Chargeable weight: ${chargeableKg.toFixed(2)} kg (volumetric ${volumetricKg.toFixed(2)} kg)`)
    lines.push(`Estimated rate: ${currency}${rate.toFixed(0)}`)
    onSubmit?.(lines.join('\n'))
  }

  const reset = () => {
    setStep(1); setPickup(null); setDelivery(null)
    setBoxCount('1'); setWeight(''); setValue('')
    setDimsOn(false); setDims([{ l: '', w: '', h: '', qty: 1 }]); setDimUnit('cm')
  }

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
          onBack={() => setStep(2)} onNext={() => setStep(4)} nextLabel="Calculate"/>
      )}
      {step === 4 && pickup && delivery && (
        <ResultStep accent={accent} dark={dark} currency={currency}
          pickup={pickup} delivery={delivery} boxCount={boxCount} weight={actualKg} value={value}
          chargeableKg={chargeableKg} volumetricKg={volumetricKg} rate={rate}
          onRecalculate={reset} onDone={done}/>
      )}
    </div>
  )
}
