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
import { useState, useMemo, useCallback } from 'react'
import clsx from 'clsx'
import LocationMap, { useGoogleMaps, geocodeAddress, reverseGeocodeDetailed } from './LocationMap'
import {
  MapPin, Flag, ChevronRight, ChevronLeft, ChevronDown, LocateFixed, Search,
  Package, Plus, Filter, Zap, Check, Pencil, Truck as TruckIcon,
} from 'lucide-react'

const POPULAR_LOCATIONS = [
  { label: 'Andheri East', sub: 'Mumbai, Maharashtra · 400069', lat: 19.1197, lng: 72.8697, pincode: '400069', city: 'Mumbai', state: 'Maharashtra' },
  { label: 'Bandra West', sub: 'Mumbai, Maharashtra · 400050', lat: 19.0596, lng: 72.8295, pincode: '400050', city: 'Mumbai', state: 'Maharashtra' },
  { label: 'Mumbai Central', sub: 'Mumbai, Maharashtra · 400008', lat: 18.9696, lng: 72.8194, pincode: '400008', city: 'Mumbai', state: 'Maharashtra' },
  { label: 'BKC, Kurla', sub: 'Mumbai, Maharashtra · 400051', lat: 19.0728, lng: 72.8826, pincode: '400051', city: 'Mumbai', state: 'Maharashtra' },
  { label: 'Connaught Place', sub: 'Delhi, Delhi · 110001', lat: 28.6315, lng: 77.2167, pincode: '110001', city: 'Delhi', state: 'Delhi' },
  { label: 'Dwarka', sub: 'Delhi, Delhi · 110075', lat: 28.5921, lng: 77.0460, pincode: '110075', city: 'Delhi', state: 'Delhi' },
  { label: 'Saket', sub: 'Delhi, Delhi · 110017', lat: 28.5245, lng: 77.2066, pincode: '110017', city: 'Delhi', state: 'Delhi' },
  { label: 'Rohini', sub: 'Delhi, Delhi · 110085', lat: 28.7495, lng: 77.0565, pincode: '110085', city: 'Delhi', state: 'Delhi' },
]

const UNIT_TO_CM = { cm: 1, in: 2.54, ft: 30.48 }
const VOLUMETRIC_DIVISOR = 5000 // industry-standard air-cargo divisor, cm³ per kg

function field(dark) {
  return { background: dark ? '#111c30' : '#f8fafc', border: `1.5px solid ${dark ? '#22304a' : '#e2e8f0'}`, color: dark ? '#e2e8f0' : '#1e293b' }
}
function ink(dark) { return dark ? '#e2e8f0' : '#1e293b' }
function faint(dark) { return dark ? '#64748b' : '#94a3b8' }

/* ── slim progress bar — five segments, filled up to the current step ───── */
function StepProgress({ step, total, accent, dark }) {
  return (
    <div className="flex gap-1 px-3.5 pt-3">
      {Array.from({ length: total }, (_, i) => (
        <div key={i} className="flex-1 h-1 rounded-full overflow-hidden" style={{ background: dark ? '#1e293b' : '#e5e9f0' }}>
          <div className="h-full rounded-full transition-all duration-300"
            style={{ width: i < step ? '100%' : '0%', background: accent }}/>
        </div>
      ))}
    </div>
  )
}

/* ── the header every step shares: icon, title, one-line purpose ──────────
   `onBack`, when given, adds a small back chevron before the icon — used by
   a step's own FIRST screen (e.g. the delivery step's search stage), which
   has no confirm-stage nav bar of its own to put a Back button on. Without
   it, landing on step 2's search screen was a dead end with no way back to
   re-pick pickup. ────────────────────────────────────────────────────────── */
function StepHeader({ icon: Icon, color, title, subtitle, dark, onBack }) {
  return (
    <div className="flex items-center gap-2.5 px-3.5 pt-2.5 pb-1">
      {onBack && (
        <button type="button" onClick={onBack} className="w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0 -ml-1"
          style={{ color: faint(dark) }}>
          <ChevronLeft size={15}/>
        </button>
      )}
      <span className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: `${color}18` }}>
        <Icon size={15} style={{ color }}/>
      </span>
      <div className="min-w-0">
        <p className="text-[12.5px] font-bold leading-tight" style={{ color: ink(dark) }}>{title}</p>
        <p className="text-[10px] leading-snug" style={{ color: faint(dark) }}>{subtitle}</p>
      </div>
    </div>
  )
}

/* ── the Back / Continue pair pinned to the bottom of every step ────────── */
function WizardNav({ onBack, onNext, nextLabel = 'Continue', nextDisabled, accent, dark, nextIcon: NextIcon = ChevronRight }) {
  return (
    <div className="flex gap-1.5 px-3.5 pb-3.5 pt-1">
      {onBack && (
        <button type="button" onClick={onBack}
          className="flex items-center justify-center gap-1 px-3 py-2.5 rounded-xl text-[11px] font-bold flex-shrink-0"
          style={{ background: dark ? '#111c30' : '#f1f5f9', color: faint(dark) }}>
          <ChevronLeft size={13}/> Back
        </button>
      )}
      <button type="button" disabled={nextDisabled} onClick={onNext}
        className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-[12px] font-bold text-white transition-opacity"
        style={{ background: accent, opacity: nextDisabled ? 0.35 : 1 }}>
        {nextLabel} <NextIcon size={13}/>
      </button>
    </div>
  )
}

/* ── two/more-option pill switch — themed off the merchant's brand accent
   rather than the reference screenshot's fixed navy/orange, so this reads as
   part of the same product as every other control. ─────────────────────── */
function Toggle({ options, value, onChange, accent, dark }) {
  return (
    <div className="flex rounded-lg overflow-hidden" style={{ border: `1.5px solid ${dark ? '#22304a' : '#e2e8f0'}` }}>
      {options.map((o, i) => {
        const on = value === o.value
        return (
          <button key={o.value} type="button" onClick={() => onChange(o.value)}
            className="flex-1 text-[10.5px] font-bold py-2 px-2.5 whitespace-nowrap transition-colors"
            style={{ background: on ? accent : 'transparent', color: on ? '#fff' : faint(dark), borderLeft: i > 0 ? `1.5px solid ${dark ? '#22304a' : '#e2e8f0'}` : 'none' }}>
            {o.label}
          </button>
        )
      })}
    </div>
  )
}

function FieldLabel({ children, dark }) {
  return <p className="text-[9.5px] font-bold uppercase tracking-wide mb-1" style={{ color: faint(dark) }}>{children}</p>
}

/* ── step 1 / 2 — pickup and delivery, as one component parametrised by
   direction. Search → popular locations, OR pincode → pin, then a confirm
   screen with a draggable map pin and editable pincode/city/state/street.
   This step's own content IS the picker — no separate modal, since in a
   wizard the step already owns the whole card. ─────────────────────────── */
function LocationStep({ direction, apiKey, accent, dark, value, onPick, onExit }) {
  const isPickup = direction === 'pickup'
  const brandColor = isPickup ? '#10b981' : '#f43f5e'
  const Icon = isPickup ? MapPin : Flag
  const gmapsStatus = useGoogleMaps(apiKey)
  const live = gmapsStatus === 'ready'

  const [stage, setStage] = useState(value ? 'confirm' : 'search')
  const [query, setQuery] = useState('')
  const [pincodeInput, setPincodeInput] = useState('')
  const [locating, setLocating] = useState(false)
  const [searching, setSearching] = useState(false)
  const [draft, setDraft] = useState(value)

  const openConfirm = point => { setDraft({ line1: '', ...point }); setStage('confirm') }

  const searchByText = async q => {
    if (!q.trim()) return
    setSearching(true)
    const result = await geocodeAddress(q)
    setSearching(false)
    if (result) openConfirm(result)
  }

  const useCurrentLocation = () => {
    if (!navigator.geolocation) return
    setLocating(true)
    navigator.geolocation.getCurrentPosition(
      async pos => {
        const { latitude: lat, longitude: lng } = pos.coords
        const details = await reverseGeocodeDetailed(lat, lng)
        setLocating(false)
        openConfirm({ lat, lng, address: details.address, pincode: details.pincode, city: details.city, state: details.state })
      },
      () => setLocating(false),
      { timeout: 6000 },
    )
  }

  const movePin = useCallback(async ({ lat, lng }) => {
    const details = await reverseGeocodeDetailed(lat, lng)
    setDraft(p => ({ ...p, lat, lng, address: details.address || p.address, pincode: details.pincode || p.pincode, city: details.city || p.city, state: details.state || p.state }))
  }, [])

  const canConfirm = draft && (draft.pincode || draft.city || draft.line1)
  const commit = () => {
    if (!canConfirm) return
    const summary = [draft.line1, draft.city, draft.pincode].filter(Boolean).join(', ') || draft.address || `${draft.lat?.toFixed?.(4)}, ${draft.lng?.toFixed?.(4)}`
    onPick({ ...draft, summary })
  }

  if (stage === 'search') {
    return (
      <>
        <StepHeader icon={Icon} color={brandColor} dark={dark} onBack={onExit}
          title={isPickup ? 'Where should we collect from?' : 'Where is it going?'}
          subtitle="Search, drop a pin, or pick a popular spot"/>
        <div className="flex-1 min-h-0 overflow-y-auto wc-scroll px-3.5 py-2 space-y-2">
          <div className="flex items-center gap-1.5 rounded-xl px-2.5 py-2" style={field(dark)}>
            <Search size={13} className="flex-shrink-0" style={{ color: faint(dark) }}/>
            <input autoFocus value={query} onChange={e => setQuery(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && searchByText(query)}
              placeholder="Try Mumbai, Pune, 411013…"
              className={clsx('flex-1 min-w-0 bg-transparent outline-none text-[11.5px]', dark ? 'text-slate-100 placeholder-slate-500' : 'text-slate-800 placeholder-slate-400')}/>
          </div>

          <div className="flex items-center gap-1.5">
            <input value={pincodeInput} onChange={e => setPincodeInput(e.target.value.replace(/\D/g, '').slice(0, 6))}
              onKeyDown={e => e.key === 'Enter' && searchByText(pincodeInput)}
              placeholder="Or a 6-digit pincode" inputMode="numeric"
              className="flex-1 min-w-0 rounded-xl px-2.5 py-2 text-[11.5px] outline-none" style={field(dark)}/>
            <button type="button" onClick={useCurrentLocation}
              className="flex-shrink-0 flex items-center gap-1 px-2.5 py-2 rounded-xl text-[10.5px] font-bold"
              style={{ background: `${brandColor}18`, color: brandColor }}>
              <LocateFixed size={12} className={locating ? 'animate-pulse' : ''}/> {locating ? '…' : 'My location'}
            </button>
          </div>
          {searching && <p className="text-[10px] text-center" style={{ color: faint(dark) }}>Searching…</p>}

          <p className="text-[9.5px] font-bold uppercase tracking-wide pt-1" style={{ color: faint(dark) }}>Popular</p>
          <div className="space-y-1">
            {POPULAR_LOCATIONS.map(loc => (
              <button key={loc.label} type="button"
                onClick={() => openConfirm({ lat: loc.lat, lng: loc.lng, address: `${loc.label}, ${loc.sub}`, pincode: loc.pincode, city: loc.city, state: loc.state })}
                className="w-full flex items-center gap-2 px-2.5 py-2 rounded-xl text-left transition-colors" style={field(dark)}>
                <span className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: `${brandColor}18` }}>
                  <MapPin size={11} style={{ color: brandColor }}/>
                </span>
                <span className="flex-1 min-w-0">
                  <span className="block text-[11px] font-bold truncate" style={{ color: ink(dark) }}>{loc.label}</span>
                  <span className="block text-[9.5px] truncate" style={{ color: brandColor }}>{loc.sub}</span>
                </span>
                <ChevronRight size={12} style={{ color: faint(dark) }}/>
              </button>
            ))}
          </div>
        </div>
      </>
    )
  }

  // stage === 'confirm'
  return (
    <>
      <StepHeader icon={Icon} color={brandColor} dark={dark}
        title="Pin the exact spot" subtitle="Drag the pin, or edit the fields below"/>
      <div className="flex-1 min-h-0 overflow-y-auto wc-scroll px-3.5 py-2 space-y-2">
        <LocationMap lat={draft.lat} lng={draft.lng} apiKey={apiKey} accent={brandColor} dark={dark} height={128} interactive onMove={movePin}/>
        {!live && (
          <p className="text-[9.5px] leading-relaxed rounded-lg px-2 py-1.5" style={{ background: `${brandColor}12`, color: brandColor }}>
            Address auto-fetch needs a Google Maps key (Behavior settings) — the fields below stay editable by hand.
          </p>
        )}
        <div className="grid grid-cols-2 gap-1.5">
          <div>
            <FieldLabel dark={dark}>Pincode</FieldLabel>
            <input value={draft.pincode || ''} onChange={e => setDraft(p => ({ ...p, pincode: e.target.value.replace(/\D/g, '').slice(0, 6) }))}
              inputMode="numeric" className="w-full rounded-lg px-2 py-1.5 text-[11px] outline-none" style={field(dark)}/>
          </div>
          <div>
            <FieldLabel dark={dark}>City</FieldLabel>
            <input value={draft.city || ''} onChange={e => setDraft(p => ({ ...p, city: e.target.value }))}
              className="w-full rounded-lg px-2 py-1.5 text-[11px] outline-none" style={field(dark)}/>
          </div>
        </div>
        <div>
          <FieldLabel dark={dark}>State</FieldLabel>
          <input value={draft.state || ''} onChange={e => setDraft(p => ({ ...p, state: e.target.value }))}
            className="w-full rounded-lg px-2 py-1.5 text-[11px] outline-none" style={field(dark)}/>
        </div>
        <div>
          <FieldLabel dark={dark}>Flat / society / street</FieldLabel>
          <input value={draft.line1 || ''} onChange={e => setDraft(p => ({ ...p, line1: e.target.value }))}
            placeholder="House / flat no., building, street"
            className="w-full rounded-lg px-2 py-1.5 text-[11px] outline-none" style={field(dark)}/>
        </div>
      </div>
      <WizardNav accent={brandColor} dark={dark} onBack={() => setStage('search')} onNext={commit} nextDisabled={!canConfirm} nextLabel="Use this address"/>
    </>
  )
}

/* ── step 3 — package + optional dimensions ──────────────────────────────
   Dimensions are a toggle, not a separate step: they're optional detail
   about the SAME thing (the package), and a visitor who doesn't know their
   box dimensions shouldn't be blocked on a whole extra screen to skip. ──── */
function DimensionsEditor({ boxes, onChange, unit, onUnitChange, accent, dark }) {
  const addBox = () => onChange([...boxes, { l: '', w: '', h: '', qty: 1 }])
  const update = (i, patch) => onChange(boxes.map((b, idx) => idx === i ? { ...b, ...patch } : b))
  const remove = i => onChange(boxes.filter((_, idx) => idx !== i))
  const volumetricKg = useMemo(() => {
    const factor = UNIT_TO_CM[unit] ** 3
    return boxes.reduce((sum, b) => sum + ((Number(b.l) || 0) * (Number(b.w) || 0) * (Number(b.h) || 0) * factor * (Number(b.qty) || 0)) / VOLUMETRIC_DIVISOR, 0)
  }, [boxes, unit])

  return (
    <div className="rounded-xl p-2.5 space-y-1.5 wc-ac-fade" style={{ background: dark ? '#0d1626' : '#f8fafc', border: `1.5px dashed ${dark ? '#22304a' : '#e2e8f0'}` }}>
      <div className="flex items-center justify-between gap-2">
        <p className="text-[9.5px] font-bold uppercase tracking-wide" style={{ color: faint(dark) }}>Length · Width · Height</p>
        <button type="button" onClick={addBox}
          className="flex items-center gap-1 pl-1.5 pr-2 py-1 rounded-lg text-[10px] font-bold flex-shrink-0"
          style={{ background: `${accent}15`, color: accent }}>
          <Plus size={11}/> Add box
        </button>
      </div>
      <Toggle options={[{ value: 'cm', label: 'Centimetres' }, { value: 'in', label: 'Inches' }, { value: 'ft', label: 'Feet' }]} value={unit} onChange={onUnitChange} accent={accent} dark={dark}/>
      {boxes.map((b, i) => (
        <div key={i} className="grid items-center gap-1" style={{ gridTemplateColumns: '1fr 1fr 1fr 40px 18px' }}>
          {['l', 'w', 'h'].map(k => (
            <input key={k} value={b[k]} onChange={e => update(i, { [k]: e.target.value.replace(/[^\d.]/g, '') })}
              placeholder="0.0" inputMode="decimal" className="w-full rounded-md px-1.5 py-1.5 text-[10.5px] text-center outline-none" style={field(dark)}/>
          ))}
          <input value={b.qty} onChange={e => update(i, { qty: e.target.value.replace(/\D/g, '') })}
            placeholder="1" inputMode="numeric" className="w-full rounded-md px-1 py-1.5 text-[10.5px] text-center outline-none" style={field(dark)}/>
          {boxes.length > 1 && (
            <button type="button" onClick={() => remove(i)} style={{ color: faint(dark) }}><ChevronDown size={12} className="rotate-45"/></button>
          )}
        </div>
      ))}
      <div className="rounded-lg px-2.5 py-1.5 flex items-center justify-between text-[10px] font-bold" style={{ background: `${accent}10`, color: accent }}>
        <span>Volumetric weight</span><span>{volumetricKg.toFixed(2)} kg</span>
      </div>
    </div>
  )
}

function PackageStep({ accent, dark, boxCount, setBoxCount, weight, setWeight, value, setValue, showDimensions, dims, setDims, dimUnit, setDimUnit, dimsOn, setDimsOn, onBack, onNext, currency }) {
  const ready = Number(weight) > 0
  return (
    <>
      <StepHeader icon={Package} color={accent} dark={dark} title="What are you sending?" subtitle="Boxes, weight and value"/>
      <div className="flex-1 min-h-0 overflow-y-auto wc-scroll px-3.5 py-2 space-y-2.5">
        <div className="grid grid-cols-3 gap-1.5">
          <div>
            <FieldLabel dark={dark}>Boxes</FieldLabel>
            <input value={boxCount} onChange={e => setBoxCount(e.target.value.replace(/\D/g, ''))} inputMode="numeric" placeholder="1"
              className="w-full rounded-lg px-2 py-2 text-[12px] font-semibold text-center outline-none" style={field(dark)}/>
          </div>
          <div>
            <FieldLabel dark={dark}>Weight (kg)</FieldLabel>
            <input value={weight} onChange={e => setWeight(e.target.value.replace(/[^\d.]/g, ''))} inputMode="decimal" placeholder="0.0"
              className="w-full rounded-lg px-2 py-2 text-[12px] font-semibold text-center outline-none" style={{ ...field(dark), borderColor: ready ? accent : field(dark).border }}/>
          </div>
          <div>
            <FieldLabel dark={dark}>Value ({currency})</FieldLabel>
            <input value={value} onChange={e => setValue(e.target.value.replace(/[^\d.]/g, ''))} inputMode="decimal" placeholder="0"
              className="w-full rounded-lg px-2 py-2 text-[12px] font-semibold text-center outline-none" style={field(dark)}/>
          </div>
        </div>

        {showDimensions && (
          <label className="flex items-center gap-2 select-none cursor-pointer" onClick={() => setDimsOn(v => !v)}>
            <span className="w-8 h-[18px] rounded-full relative flex-shrink-0 transition-colors" style={{ background: dimsOn ? accent : (dark ? '#22304a' : '#e2e8f0') }}>
              <span className="absolute top-[2px] w-[14px] h-[14px] rounded-full bg-white transition-all" style={{ left: dimsOn ? 16 : 2 }}/>
            </span>
            <span className="text-[11px] font-semibold" style={{ color: ink(dark) }}>Add box dimensions</span>
            <span className="text-[10px]" style={{ color: faint(dark) }}>(optional)</span>
          </label>
        )}
        {showDimensions && dimsOn && (
          <DimensionsEditor boxes={dims} onChange={setDims} unit={dimUnit} onUnitChange={setDimUnit} accent={accent} dark={dark}/>
        )}
      </div>
      <WizardNav accent={accent} dark={dark} onBack={onBack} onNext={onNext} nextDisabled={!ready}/>
    </>
  )
}

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
