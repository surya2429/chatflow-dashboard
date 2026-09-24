// shipmentShared.jsx — building blocks shared by the two courier question
// types: ShipmentBookingAnswer.jsx (book a pickup end-to-end) and
// ShipmentCalculationAnswer.jsx (estimate a rate with no booking at all).
// Both are step wizards that start with the same pickup/delivery picker and
// the same package/dimensions step — extracted here once split-booking added
// a second consumer, so a fix to the location picker or the volumetric-weight
// formula lands in both instead of drifting between two copies.
import { useState, useMemo, useCallback } from 'react'
import clsx from 'clsx'
import LocationMap, { useGoogleMaps, geocodeAddress, reverseGeocodeDetailed } from './LocationMap'
import {
  MapPin, Flag, ChevronRight, ChevronLeft, ChevronDown, LocateFixed, Search, Package, Plus,
} from 'lucide-react'

export const POPULAR_LOCATIONS = [
  { label: 'Andheri East', sub: 'Mumbai, Maharashtra · 400069', lat: 19.1197, lng: 72.8697, pincode: '400069', city: 'Mumbai', state: 'Maharashtra' },
  { label: 'Bandra West', sub: 'Mumbai, Maharashtra · 400050', lat: 19.0596, lng: 72.8295, pincode: '400050', city: 'Mumbai', state: 'Maharashtra' },
  { label: 'Mumbai Central', sub: 'Mumbai, Maharashtra · 400008', lat: 18.9696, lng: 72.8194, pincode: '400008', city: 'Mumbai', state: 'Maharashtra' },
  { label: 'BKC, Kurla', sub: 'Mumbai, Maharashtra · 400051', lat: 19.0728, lng: 72.8826, pincode: '400051', city: 'Mumbai', state: 'Maharashtra' },
  { label: 'Connaught Place', sub: 'Delhi, Delhi · 110001', lat: 28.6315, lng: 77.2167, pincode: '110001', city: 'Delhi', state: 'Delhi' },
  { label: 'Dwarka', sub: 'Delhi, Delhi · 110075', lat: 28.5921, lng: 77.0460, pincode: '110075', city: 'Delhi', state: 'Delhi' },
  { label: 'Saket', sub: 'Delhi, Delhi · 110017', lat: 28.5245, lng: 77.2066, pincode: '110017', city: 'Delhi', state: 'Delhi' },
  { label: 'Rohini', sub: 'Delhi, Delhi · 110085', lat: 28.7495, lng: 77.0565, pincode: '110085', city: 'Delhi', state: 'Delhi' },
]

export const UNIT_TO_CM = { cm: 1, in: 2.54, ft: 30.48 }
export const VOLUMETRIC_DIVISOR = 5000 // industry-standard air-cargo divisor, cm³ per kg

export function field(dark) {
  return { background: dark ? '#111c30' : '#f8fafc', border: `1.5px solid ${dark ? '#22304a' : '#e2e8f0'}`, color: dark ? '#e2e8f0' : '#1e293b' }
}
export function ink(dark) { return dark ? '#e2e8f0' : '#1e293b' }
export function faint(dark) { return dark ? '#64748b' : '#94a3b8' }

/* ── slim progress bar — N segments, filled up to the current step ──────── */
export function StepProgress({ step, total, accent, dark }) {
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
   has no confirm-stage nav bar of its own to put a Back button on. ──────── */
export function StepHeader({ icon: Icon, color, title, subtitle, dark, onBack }) {
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
export function WizardNav({ onBack, onNext, nextLabel = 'Continue', nextDisabled, accent, dark, nextIcon: NextIcon = ChevronRight }) {
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
   rather than a fixed color, so this reads as part of the same product as
   every other control. ──────────────────────────────────────────────────── */
export function Toggle({ options, value, onChange, accent, dark }) {
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

export function FieldLabel({ children, dark }) {
  return <p className="text-[9.5px] font-bold uppercase tracking-wide mb-1" style={{ color: faint(dark) }}>{children}</p>
}

/* ── pickup / delivery step, parametrised by direction. Search → popular
   locations, OR pincode → pin, then a confirm screen with a draggable map pin
   and editable pincode/city/state/street. This step's own content IS the
   picker — no separate modal, since in a wizard the step already owns the
   whole card. ─────────────────────────────────────────────────────────────── */
export function LocationStep({ direction, apiKey, accent, dark, value, onPick, onExit }) {
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

/* ── package + optional dimensions. Dimensions are a toggle, not a separate
   step: they're optional detail about the SAME thing (the package), and a
   visitor who doesn't know their box dimensions shouldn't be blocked on a
   whole extra screen to skip. ────────────────────────────────────────────── */
export function DimensionsEditor({ boxes, onChange, unit, onUnitChange, accent, dark }) {
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

export function PackageStep({ accent, dark, boxCount, setBoxCount, weight, setWeight, value, setValue, showDimensions, dims, setDims, dimUnit, setDimUnit, dimsOn, setDimsOn, onBack, onNext, currency, nextLabel }) {
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
      <WizardNav accent={accent} dark={dark} onBack={onBack} onNext={onNext} nextDisabled={!ready} nextLabel={nextLabel}/>
    </>
  )
}
