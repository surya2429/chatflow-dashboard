// ShipmentCalculationAnswer.jsx — the "Rate Calculator" question type.
//
// The companion to ShipmentBookingAnswer.jsx, but deliberately lighter in two
// ways that match the reference app's own "Rate Calculator" tab: pickup and
// delivery are a single pincode/city field each — no map, no saved address,
// no full street address — since a calculator only needs a rough lane to
// estimate off, and asking a visitor to drop a pin just to see a ballpark
// number is the kind of friction that gets the tab abandoned. And it never
// shows a computed number: there's no rate card behind this yet, so the
// result step says the details were received and the team will follow up,
// rather than presenting a made-up figure as if it were a real quote.
import { useState } from 'react'
import { MapPin, Flag, Send, RotateCcw } from 'lucide-react'
import {
  field, ink, faint,
  StepProgress, StepHeader, WizardNav, PackageStep,
} from './shipmentShared'

/* ── step 1 / 2 — pickup and delivery, reduced to the one field a rate
   estimate actually needs. No LocationStep here on purpose — that map/pin
   picker is for a real pickup booking, not a quote. ─────────────────────── */
function SimpleLocationStep({ direction, accent, dark, value, onNext, onBack }) {
  const isPickup = direction === 'pickup'
  const brandColor = isPickup ? '#10b981' : '#f43f5e'
  const Icon = isPickup ? MapPin : Flag
  const [text, setText] = useState(value || '')
  const ready = text.trim().length > 0
  return (
    <>
      <StepHeader icon={Icon} color={brandColor} dark={dark}
        title={isPickup ? 'Where should we collect from?' : 'Where is it going?'}
        subtitle="Pincode or city is enough for an estimate"/>
      <div className="flex-1 min-h-0 overflow-y-auto wc-scroll px-3.5 py-2">
        <input autoFocus value={text} onChange={e => setText(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && ready && onNext(text.trim())}
          placeholder={isPickup ? 'e.g. 411013 or Pune' : 'e.g. 560066 or Bengaluru'}
          className="w-full rounded-xl px-3 py-2.5 text-[12.5px] outline-none"
          style={{ ...field(dark), borderColor: ready ? brandColor : field(dark).border }}/>
      </div>
      <WizardNav accent={brandColor} dark={dark} onBack={onBack} onNext={() => onNext(text.trim())} nextDisabled={!ready}/>
    </>
  )
}

/* ── step 4 — the result. Not a rate — this widget has no live rate card
   behind it yet, so showing one would just be a made-up number dressed up as
   a real quote. Instead it confirms the details were captured and hands the
   visitor off to a human, which is what's actually true right now. ──────── */
function ResultStep({ accent, dark, currency, pickup, delivery, boxCount, weight, value, onRecalculate, onDone }) {
  return (
    <>
      <StepHeader icon={Send} color={accent} dark={dark} title="Details received" subtitle="We'll follow up with a quote"/>
      <div className="flex-1 min-h-0 overflow-y-auto wc-scroll px-3.5 py-2 space-y-2.5">
        <div className="rounded-2xl px-4 py-5 text-center" style={{ background: `${accent}12` }}>
          <p className="text-[10px] font-bold uppercase tracking-wide" style={{ color: accent }}>Estimated cost</p>
          <p className="text-[30px] font-black leading-tight mt-1 tracking-wider" style={{ color: accent }}>XXXX</p>
          <p className="text-[10px] mt-1" style={{ color: faint(dark) }}>
            We've collected your shipment details — our team will get back to you shortly.
          </p>
        </div>

        <div className="rounded-xl px-3 py-1" style={{ background: dark ? '#0b1424' : '#fff', border: `1.5px solid ${dark ? '#22304a' : '#e2e8f0'}` }}>
          <Row dark={dark} label="Pickup" value={pickup}/>
          <Row dark={dark} label="Delivery" value={delivery}/>
          <Row dark={dark} label="Package"
            value={`${boxCount || 1} box${Number(boxCount) === 1 ? '' : 'es'} · ${weight} kg${value ? ` · ${currency}${value}` : ''}`} last/>
        </div>
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
   symbol and whether dimensions are asked for. No ratePerKg use yet (no rate
   is shown), kept in the data contract so a real rate card can be wired in
   later without a node-config migration. */
export default function ShipmentCalculationAnswer({ accent, dark, onSubmit, data = {} }) {
  const currency = data.currency || '₹'
  const showDimensions = data.showDimensions !== false

  const [step, setStep] = useState(1)
  const TOTAL_STEPS = 4

  const [pickup, setPickup] = useState('')
  const [delivery, setDelivery] = useState('')

  const [boxCount, setBoxCount] = useState('1')
  const [weight, setWeight] = useState('')
  const [value, setValue] = useState('')
  const [dimsOn, setDimsOn] = useState(false)
  const [dims, setDims] = useState([{ l: '', w: '', h: '', qty: 1 }])
  const [dimUnit, setDimUnit] = useState('cm')

  const actualKg = Number(weight) || 0

  const done = () => {
    const lines = [
      `Pickup: ${pickup}`,
      `Delivery: ${delivery}`,
      `Package: ${boxCount || 1} box${Number(boxCount) === 1 ? '' : 'es'} · ${actualKg} kg${value ? ` · ${currency}${value}` : ''}`,
      `We've collected your shipment details — our team will get back to you shortly.`,
    ]
    onSubmit?.(lines.join('\n'))
  }

  const reset = () => {
    setStep(1); setPickup(''); setDelivery('')
    setBoxCount('1'); setWeight(''); setValue('')
    setDimsOn(false); setDims([{ l: '', w: '', h: '', qty: 1 }]); setDimUnit('cm')
  }

  return (
    <div className="w-full rounded-2xl overflow-hidden flex flex-col" style={{ background: dark ? '#0b1424' : '#fff', border: `1.5px solid ${dark ? '#22304a' : '#e2e8f0'}`, boxShadow: dark ? 'none' : '0 8px 24px -12px rgba(15,23,42,0.18)', maxHeight: 420 }}>
      <StepProgress step={step} total={TOTAL_STEPS} accent={accent} dark={dark}/>

      {step === 1 && (
        <SimpleLocationStep direction="pickup" accent={accent} dark={dark}
          value={pickup} onNext={t => { setPickup(t); setStep(2) }}/>
      )}
      {step === 2 && (
        <SimpleLocationStep direction="delivery" accent={accent} dark={dark}
          value={delivery} onNext={t => { setDelivery(t); setStep(3) }} onBack={() => setStep(1)}/>
      )}
      {step === 3 && (
        <PackageStep accent={accent} dark={dark} currency={currency}
          boxCount={boxCount} setBoxCount={setBoxCount} weight={weight} setWeight={setWeight} value={value} setValue={setValue}
          showDimensions={showDimensions} dims={dims} setDims={setDims} dimUnit={dimUnit} setDimUnit={setDimUnit} dimsOn={dimsOn} setDimsOn={setDimsOn}
          onBack={() => setStep(2)} onNext={() => setStep(4)} nextLabel="Submit"/>
      )}
      {step === 4 && pickup && delivery && (
        <ResultStep accent={accent} dark={dark} currency={currency}
          pickup={pickup} delivery={delivery} boxCount={boxCount} weight={actualKg} value={value}
          onRecalculate={reset} onDone={done}/>
      )}
    </div>
  )
}
