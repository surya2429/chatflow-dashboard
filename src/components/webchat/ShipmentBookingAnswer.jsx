// ShipmentBookingAnswer.jsx — the "Shipment Booking" question type.
//
// Every other Ask control collects one value. This one is a small booking app
// in its own right — pickup, delivery, package details, dimensions, payment
// and delivery preferences, a rate estimate, and a book action — because that
// is genuinely what a courier bot needs to collect in one step rather than
// twelve. It is its own file, not another case crammed into
// AnswerControls.jsx, for the same reason LocationMap got one: this is a
// real sub-feature, not a five-line control.
//
// The two location pickers (pickup, delivery) are one component parametrised
// by direction, not two — the copy, colour and icon differ, the picking flow
// does not.
import { useState, useMemo, useCallback } from 'react'
import clsx from 'clsx'
import LocationMap, { useGoogleMaps, geocodeAddress, reverseGeocodeDetailed } from './LocationMap'
import {
  MapPin, Flag, X, ChevronRight, ChevronDown, LocateFixed, Search,
  Package, Ruler, Plus, Filter, Zap, Check,
} from 'lucide-react'

/* Illustrative default list — a merchant has no reason to curate "popular
   pickup points" for a chat control, so this exists to make the picker feel
   real out of the box rather than opening on an empty list. Coordinates are
   approximate area centres, accurate enough for a map preview and nowhere
   near precise enough to be mistaken for surveyed data. */
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

function fieldStyle(dark) {
  return { background: dark ? '#111c30' : '#f4f6f9', border: `1.5px solid ${dark ? '#22304a' : '#e3e8f0'}`, color: dark ? '#e2e8f0' : '#1e293b' }
}

/* A two-option pill switch — Payment (Prepaid/COD), Appointment delivery
   (No/Yes), Freight mode, Insurance by. Themed off `accent` rather than the
   navy/orange in the reference screenshot: every other control in this file
   follows the merchant's brand colour, and a shipment control that suddenly
   didn't would look like it belonged to a different product. */
function Toggle({ options, value, onChange, accent, dark }) {
  return (
    <div className="flex rounded-lg overflow-hidden" style={{ border: `1.5px solid ${dark ? '#22304a' : '#e3e8f0'}` }}>
      {options.map((o, i) => {
        const on = value === o.value
        return (
          <button key={o.value} type="button" onClick={() => onChange(o.value)}
            className="flex-1 text-[10.5px] font-bold py-1.5 transition-colors"
            style={{
              background: on ? accent : 'transparent',
              color: on ? '#fff' : (dark ? '#94a3b8' : '#64748b'),
              borderLeft: i > 0 ? `1.5px solid ${dark ? '#22304a' : '#e3e8f0'}` : 'none',
            }}>
            {o.label}
          </button>
        )
      })}
    </div>
  )
}

function FieldLabel({ children }) {
  return <p className="text-[9px] font-bold uppercase tracking-wide mb-1" style={{ color: 'inherit', opacity: 0.6 }}>{children}</p>
}

/* ── the location picker modal, shared by pickup and delivery ───────────── */
function LocationPickerModal({ direction, apiKey, accent, dark, onClose, onConfirm }) {
  const isPickup = direction === 'pickup'
  const brandColor = isPickup ? '#10b981' : '#f43f5e'
  const Icon = isPickup ? MapPin : Flag
  const gmapsStatus = useGoogleMaps(apiKey)
  const live = gmapsStatus === 'ready'

  const [stage, setStage] = useState('search') // 'search' | 'confirm'
  const [query, setQuery] = useState('')
  const [pincodeInput, setPincodeInput] = useState('')
  const [locating, setLocating] = useState(false)
  const [searching, setSearching] = useState(false)
  const [picked, setPicked] = useState(null) // { lat, lng, address, pincode, city, state, line1 }

  const openConfirm = point => {
    setPicked({ line1: '', ...point })
    setStage('confirm')
  }

  const searchByText = async q => {
    if (!q.trim()) return
    setSearching(true)
    const result = await geocodeAddress(q)
    setSearching(false)
    if (result) openConfirm({ ...result, address: result.address })
    // No key / no match: stay on search rather than open a confirm screen
    // with nothing in it — there is nothing useful to confirm yet.
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
    setPicked(p => ({ ...p, lat, lng, address: details.address || p.address, pincode: details.pincode || p.pincode, city: details.city || p.city, state: details.state || p.state }))
  }, [])

  const canConfirm = picked && (picked.pincode || picked.city || picked.line1)
  const confirm = () => {
    if (!canConfirm) return
    const summary = [picked.line1, picked.city, picked.pincode].filter(Boolean).join(', ') || picked.address || `${picked.lat?.toFixed?.(4)}, ${picked.lng?.toFixed?.(4)}`
    onConfirm({ ...picked, summary })
  }

  return (
    <div className="absolute inset-0 z-40 flex flex-col rounded-2xl overflow-hidden" style={{ background: dark ? '#0b1424' : '#fff' }}>
      <div className="flex-shrink-0 px-3.5 py-3 flex items-start gap-2.5" style={{ background: brandColor }}>
        <Icon size={16} className="text-white flex-shrink-0 mt-0.5"/>
        <div className="flex-1 min-w-0">
          <p className="text-white text-[12.5px] font-bold leading-tight">
            {stage === 'confirm' ? `${isPickup ? 'Pickup from' : 'Deliver to'} — pin your exact location` : `${isPickup ? 'Pick pickup' : 'Pick delivery'} location`}
          </p>
          <p className="text-white/80 text-[10px] mt-0.5 leading-snug">
            {stage === 'confirm' ? 'Drag the pin, or edit the fields below' : 'Search city, area, or 6-digit pincode'}
          </p>
        </div>
        <button onClick={onClose} className="w-6 h-6 rounded-full hover:bg-white/15 flex items-center justify-center flex-shrink-0">
          <X size={13} className="text-white"/>
        </button>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto wc-scroll p-3 space-y-2.5">
        {stage === 'search' ? (
          <>
            <div className="flex items-center gap-1.5 rounded-xl px-2.5 py-2" style={fieldStyle(dark)}>
              <Search size={13} className="flex-shrink-0" style={{ color: dark ? '#64748b' : '#94a3b8' }}/>
              <input autoFocus value={query} onChange={e => setQuery(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && searchByText(query)}
                placeholder="Try Mumbai, Pune, 411013…"
                className={clsx('flex-1 min-w-0 bg-transparent outline-none text-[11.5px]', dark ? 'text-slate-100 placeholder-slate-500' : 'text-slate-800 placeholder-slate-400')}/>
            </div>

            <div className="flex items-center gap-1.5">
              <input value={pincodeInput} onChange={e => setPincodeInput(e.target.value.replace(/\D/g, '').slice(0, 6))}
                onKeyDown={e => e.key === 'Enter' && searchByText(pincodeInput)}
                placeholder="Or enter pincode" inputMode="numeric"
                className="flex-1 min-w-0 rounded-xl px-2.5 py-2 text-[11.5px] outline-none" style={fieldStyle(dark)}/>
              <button type="button" onClick={useCurrentLocation}
                className="flex-shrink-0 flex items-center gap-1 px-2.5 py-2 rounded-xl text-[10.5px] font-bold"
                style={{ background: `${brandColor}18`, color: brandColor }}>
                <LocateFixed size={12} className={locating ? 'animate-pulse' : ''}/> {locating ? '…' : 'Use Pin'}
              </button>
            </div>
            {searching && <p className="text-[10px] text-center" style={{ color: dark ? '#64748b' : '#94a3b8' }}>Searching…</p>}

            <p className="text-[9.5px] font-bold uppercase tracking-wide pt-1" style={{ color: dark ? '#64748b' : '#94a3b8' }}>Popular locations</p>
            <div className="space-y-1">
              {POPULAR_LOCATIONS.map(loc => (
                <button key={loc.label} type="button"
                  onClick={() => openConfirm({ lat: loc.lat, lng: loc.lng, address: `${loc.label}, ${loc.sub}`, pincode: loc.pincode, city: loc.city, state: loc.state })}
                  className="w-full flex items-center gap-2 px-2.5 py-2 rounded-xl text-left" style={fieldStyle(dark)}>
                  <span className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: `${brandColor}18` }}>
                    <MapPin size={11} style={{ color: brandColor }}/>
                  </span>
                  <span className="flex-1 min-w-0">
                    <span className="block text-[11px] font-bold truncate" style={{ color: dark ? '#e2e8f0' : '#1e293b' }}>{loc.label}</span>
                    <span className="block text-[9.5px] truncate" style={{ color: brandColor }}>{loc.sub}</span>
                  </span>
                  <ChevronRight size={12} style={{ color: dark ? '#64748b' : '#94a3b8' }}/>
                </button>
              ))}
            </div>
          </>
        ) : (
          <>
            <LocationMap lat={picked.lat} lng={picked.lng} apiKey={apiKey} accent={brandColor} dark={dark}
              height={120} interactive onMove={movePin}/>
            {!live && (
              <p className="text-[9.5px] leading-relaxed rounded-lg px-2 py-1.5" style={{ background: `${brandColor}12`, color: brandColor }}>
                Address auto-fetch from Google Maps needs an API key (Behavior settings) — fill the fields in by hand below.
              </p>
            )}
            <div className="grid grid-cols-2 gap-1.5">
              <div style={{ color: dark ? '#e2e8f0' : '#1e293b' }}>
                <FieldLabel>Pincode</FieldLabel>
                <input value={picked.pincode || ''} onChange={e => setPicked(p => ({ ...p, pincode: e.target.value.replace(/\D/g, '').slice(0, 6) }))}
                  inputMode="numeric" className="w-full rounded-lg px-2 py-1.5 text-[11px] outline-none" style={fieldStyle(dark)}/>
              </div>
              <div style={{ color: dark ? '#e2e8f0' : '#1e293b' }}>
                <FieldLabel>City</FieldLabel>
                <input value={picked.city || ''} onChange={e => setPicked(p => ({ ...p, city: e.target.value }))}
                  className="w-full rounded-lg px-2 py-1.5 text-[11px] outline-none" style={fieldStyle(dark)}/>
              </div>
            </div>
            <div style={{ color: dark ? '#e2e8f0' : '#1e293b' }}>
              <FieldLabel>State</FieldLabel>
              <input value={picked.state || ''} onChange={e => setPicked(p => ({ ...p, state: e.target.value }))}
                className="w-full rounded-lg px-2 py-1.5 text-[11px] outline-none" style={fieldStyle(dark)}/>
            </div>
            <div style={{ color: dark ? '#e2e8f0' : '#1e293b' }}>
              <FieldLabel>Flat / society / street</FieldLabel>
              <input value={picked.line1 || ''} onChange={e => setPicked(p => ({ ...p, line1: e.target.value }))}
                placeholder="House / flat no., building, street"
                className="w-full rounded-lg px-2 py-1.5 text-[11px] outline-none" style={fieldStyle(dark)}/>
            </div>
          </>
        )}
      </div>

      {stage === 'confirm' && (
        <div className="flex-shrink-0 flex gap-1.5 p-3 border-t" style={{ borderColor: dark ? '#22304a' : '#e3e8f0' }}>
          <button type="button" onClick={() => setStage('search')}
            className="px-3 py-2 rounded-xl text-[11px] font-bold flex items-center gap-1"
            style={{ background: dark ? '#111c30' : '#f4f6f9', color: dark ? '#94a3b8' : '#64748b' }}>
            <ChevronDown size={12} className="rotate-90"/> Re-pick
          </button>
          <button type="button" disabled={!canConfirm} onClick={confirm}
            className="flex-1 py-2 rounded-xl text-[11.5px] font-bold text-white transition-opacity"
            style={{ background: brandColor, opacity: canConfirm ? 1 : 0.4 }}>
            Confirm
          </button>
        </div>
      )}
    </div>
  )
}

/* ── collapsed field row on the main card ────────────────────────────────── */
function LocationRow({ direction, value, dark, accent, onOpen }) {
  const isPickup = direction === 'pickup'
  const brandColor = isPickup ? '#10b981' : '#f43f5e'
  const Icon = isPickup ? MapPin : Flag
  return (
    <button type="button" onClick={onOpen}
      className="w-full flex items-center gap-2.5 rounded-xl px-2.5 py-2.5 text-left transition-colors"
      style={{ background: dark ? '#111c30' : (value ? `${brandColor}08` : '#fafbfc'), border: `1.5px dashed ${value ? brandColor : (dark ? '#22304a' : '#e3e8f0')}` }}>
      <span className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: `${brandColor}18` }}>
        <Icon size={13} style={{ color: brandColor }}/>
      </span>
      <span className="flex-1 min-w-0">
        <span className="block text-[9px] font-bold uppercase tracking-wide" style={{ color: brandColor }}>
          {isPickup ? 'Step 1 — Pickup location' : 'Step 2 — Where to deliver?'}
        </span>
        {value ? (
          <span className="block text-[11.5px] font-bold truncate" style={{ color: dark ? '#e2e8f0' : '#1e293b' }}>{value.summary}</span>
        ) : (
          <span className="block text-[10px] truncate" style={{ color: dark ? '#64748b' : '#94a3b8' }}>
            {isPickup ? 'Tap GPS icon or search city/pincode' : 'Search area name or 6-digit PIN'}
          </span>
        )}
      </span>
      {value ? <Check size={13} style={{ color: brandColor, flexShrink: 0 }}/> : <ChevronRight size={13} style={{ color: dark ? '#64748b' : '#94a3b8', flexShrink: 0 }}/>}
    </button>
  )
}

/* ── dimensions: rows of L×W×H×Qty, unit toggle, volumetric weight ──────── */
const UNIT_TO_CM = { cm: 1, in: 2.54, ft: 30.48 }
const VOLUMETRIC_DIVISOR = 5000 // industry-standard air-cargo divisor, cm³ per kg

function DimensionsEditor({ boxes, onChange, unit, onUnitChange, accent, dark }) {
  const addBox = () => onChange([...boxes, { l: '', w: '', h: '', qty: 1 }])
  const update = (i, patch) => onChange(boxes.map((b, idx) => idx === i ? { ...b, ...patch } : b))
  const remove = i => onChange(boxes.filter((_, idx) => idx !== i))

  const volumetricKg = useMemo(() => {
    const factor = UNIT_TO_CM[unit] ** 3
    return boxes.reduce((sum, b) => {
      const l = Number(b.l) || 0, w = Number(b.w) || 0, h = Number(b.h) || 0, qty = Number(b.qty) || 0
      return sum + (l * w * h * factor * qty) / VOLUMETRIC_DIVISOR
    }, 0)
  }, [boxes, unit])

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <p className="text-[9.5px] font-bold uppercase tracking-wide" style={{ color: dark ? '#64748b' : '#94a3b8' }}>Length · Width · Height</p>
        <div className="flex items-center gap-1">
          <Toggle options={[{ value: 'cm', label: 'CM' }, { value: 'in', label: 'IN' }, { value: 'ft', label: 'FT' }]}
            value={unit} onChange={onUnitChange} accent={accent} dark={dark}/>
          <button type="button" onClick={addBox}
            className="flex items-center gap-0.5 px-2 py-1 rounded-lg text-[10px] font-bold flex-shrink-0"
            style={{ background: `${accent}15`, color: accent }}>
            <Plus size={10}/> Box
          </button>
        </div>
      </div>

      {boxes.map((b, i) => (
        <div key={i} className="grid items-center gap-1" style={{ gridTemplateColumns: '1fr 1fr 1fr 44px 20px' }}>
          {['l', 'w', 'h'].map(k => (
            <input key={k} value={b[k]} onChange={e => update(i, { [k]: e.target.value.replace(/[^\d.]/g, '') })}
              placeholder="0.0" inputMode="decimal"
              className="w-full rounded-md px-1.5 py-1.5 text-[10.5px] text-center outline-none" style={fieldStyle(dark)}/>
          ))}
          <input value={b.qty} onChange={e => update(i, { qty: e.target.value.replace(/\D/g, '') })}
            placeholder="1" inputMode="numeric"
            className="w-full rounded-md px-1 py-1.5 text-[10.5px] text-center outline-none" style={fieldStyle(dark)}/>
          {boxes.length > 1 && (
            <button type="button" onClick={() => remove(i)} className="flex items-center justify-center" style={{ color: dark ? '#64748b' : '#94a3b8' }}>
              <X size={12}/>
            </button>
          )}
        </div>
      ))}

      <div className="rounded-lg px-2.5 py-1.5 flex items-center justify-between text-[10px] font-bold" style={{ background: `${accent}10`, color: accent }}>
        <span>Volumetric wt.</span>
        <span>{volumetricKg.toFixed(2)} Kg</span>
      </div>
    </div>
  )
}

/* ── the top-level control ────────────────────────────────────────────────
   `data` is the node's own saved config from the flow builder — currency
   symbol, rate estimate, and which optional sections the merchant wants. */
export default function ShipmentBookingAnswer({ accent, dark, onSubmit, data = {}, googleMapsApiKey }) {
  const currency = data.currency || '₹'
  const ratePerKg = Number(data.ratePerKg) || 5
  const showDimensions = data.showDimensions !== false
  const codEnabled = data.codEnabled !== false
  const insuranceEnabled = data.insuranceEnabled !== false
  const appointmentEnabled = data.appointmentEnabled !== false

  const [openPicker, setOpenPicker] = useState(null) // null | 'pickup' | 'delivery'
  const [pickup, setPickup] = useState(null)
  const [delivery, setDelivery] = useState(null)

  const [boxCount, setBoxCount] = useState('1')
  const [weight, setWeight] = useState('')
  const [value, setValue] = useState('')

  const [dimsOpen, setDimsOpen] = useState(false)
  const [dims, setDims] = useState([{ l: '', w: '', h: '', qty: 1 }])
  const [dimUnit, setDimUnit] = useState('cm')

  const [servicesOpen, setServicesOpen] = useState(false)
  const [payment, setPayment] = useState('prepaid')
  const [codAmount, setCodAmount] = useState('')
  const [apptDelivery, setApptDelivery] = useState('no')
  const [deliveryDate, setDeliveryDate] = useState('')
  const [freightMode, setFreightMode] = useState('prepaid')
  const [insuranceBy, setInsuranceBy] = useState('owner')

  const [rateEstimate, setRateEstimate] = useState(null)

  const volumetricKg = useMemo(() => {
    const factor = UNIT_TO_CM[dimUnit] ** 3
    return dims.reduce((sum, b) => {
      const l = Number(b.l) || 0, w = Number(b.w) || 0, h = Number(b.h) || 0, qty = Number(b.qty) || 0
      return sum + (l * w * h * factor * qty) / VOLUMETRIC_DIVISOR
    }, 0)
  }, [dims, dimUnit])

  const actualKg = Number(weight) || 0
  const chargeableKg = Math.max(actualKg, showDimensions ? volumetricKg : 0)

  const ready = Boolean(pickup && delivery && actualKg > 0)
  const codReady = payment !== 'cod' || Boolean(codAmount)
  const apptReady = apptDelivery !== 'yes' || Boolean(deliveryDate)
  const canBook = ready && codReady && apptReady

  const checkRates = () => {
    if (!ready) return
    setRateEstimate(Math.max(chargeableKg, 0.5) * ratePerKg)
  }

  const book = () => {
    if (!canBook) return
    const lines = [
      `Pickup: ${pickup.summary}`,
      `Delivery: ${delivery.summary}`,
      `Package: ${boxCount || 1} box${Number(boxCount) === 1 ? '' : 'es'} · ${actualKg} kg · ${currency}${value || 0}`,
    ]
    if (showDimensions && volumetricKg > 0) {
      lines.push(`Chargeable weight: ${chargeableKg.toFixed(2)} kg (volumetric ${volumetricKg.toFixed(2)} kg)`)
    }
    lines.push(`Payment: ${payment === 'cod' ? `COD — collect ${currency}${codAmount}` : 'Prepaid'}`)
    if (appointmentEnabled) {
      lines.push(apptDelivery === 'yes' ? `Appointment delivery: ${deliveryDate}` : 'Appointment delivery: No')
    }
    lines.push(`Freight mode: ${freightMode === 'prepaid' ? 'Prepaid' : 'Pay after pickup'}`)
    if (insuranceEnabled) lines.push(`Insurance by: ${insuranceBy === 'owner' ? 'Owner' : 'Carrier'}`)
    if (rateEstimate != null) lines.push(`Estimated rate: ${currency}${rateEstimate.toFixed(0)}`)
    onSubmit?.(lines.join('\n'))
  }

  return (
    <div className="w-full rounded-2xl p-2.5 space-y-2 relative overflow-hidden" style={{ background: dark ? '#0b1424' : '#fff', border: `1.5px solid ${dark ? '#22304a' : '#e3e8f0'}` }}>
      <LocationRow direction="pickup" value={pickup} dark={dark} accent={accent} onOpen={() => setOpenPicker('pickup')}/>
      <LocationRow direction="delivery" value={delivery} dark={dark} accent={accent} onOpen={() => setOpenPicker('delivery')}/>

      <div>
        <p className="text-[9px] font-bold uppercase tracking-wide mb-1" style={{ color: dark ? '#64748b' : '#94a3b8' }}>Step 3 — Package</p>
        <div className="grid grid-cols-3 gap-1.5">
          {[
            { label: 'Boxes', suffix: 'BX', val: boxCount, set: setBoxCount, numeric: true },
            { label: 'Weight', suffix: 'KG', val: weight, set: setWeight, numeric: true },
            { label: 'Value', suffix: currency, val: value, set: setValue, numeric: true },
          ].map(f => (
            <div key={f.label} className="relative">
              <input value={f.val} onChange={e => f.set(e.target.value.replace(/[^\d.]/g, ''))}
                inputMode="decimal" placeholder={f.label}
                className="w-full rounded-lg pl-2 pr-6 py-2 text-[11px] outline-none" style={fieldStyle(dark)}/>
              <span className="absolute right-1.5 top-1/2 -translate-y-1/2 text-[8.5px] font-bold pointer-events-none" style={{ color: dark ? '#64748b' : '#94a3b8' }}>{f.suffix}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="flex gap-1.5">
        {showDimensions && (
          <button type="button" onClick={() => setDimsOpen(o => !o)}
            className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-[10.5px] font-bold"
            style={{ background: dimsOpen ? accent : (dark ? '#111c30' : '#0f172a'), color: '#fff' }}>
            <Ruler size={11}/> Dimensions {dimsOpen ? <ChevronDown size={11}/> : <Plus size={11}/>}
          </button>
        )}
        <button type="button" onClick={() => setServicesOpen(o => !o)}
          className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-[10.5px] font-bold text-white"
          style={{ background: servicesOpen ? accent : '#f97316' }}>
          <Package size={11}/> Services {servicesOpen ? <ChevronDown size={11}/> : <Plus size={11}/>}
        </button>
      </div>

      {dimsOpen && showDimensions && (
        <div className="rounded-xl p-2.5 wc-ac-fade" style={{ background: dark ? '#111c30' : '#f8fafc', border: `1.5px solid ${dark ? '#22304a' : '#e3e8f0'}` }}>
          <DimensionsEditor boxes={dims} onChange={setDims} unit={dimUnit} onUnitChange={setDimUnit} accent={accent} dark={dark}/>
        </div>
      )}

      {servicesOpen && (
        <div className="rounded-xl p-2.5 space-y-2 wc-ac-fade" style={{ background: dark ? '#111c30' : '#fff7ed', border: `1.5px solid ${dark ? '#22304a' : '#fed7aa'}` }}>
          <div className="grid grid-cols-2 gap-2">
            <div style={{ color: dark ? '#e2e8f0' : '#1e293b' }}>
              <FieldLabel>Payment {codEnabled ? '*' : ''}</FieldLabel>
              <Toggle accent={accent} dark={dark} value={payment} onChange={setPayment}
                options={codEnabled ? [{ value: 'prepaid', label: 'Prepaid' }, { value: 'cod', label: 'COD' }] : [{ value: 'prepaid', label: 'Prepaid' }]}/>
            </div>
            {appointmentEnabled && (
              <div style={{ color: dark ? '#e2e8f0' : '#1e293b' }}>
                <FieldLabel>Appt. delivery</FieldLabel>
                <Toggle accent={accent} dark={dark} value={apptDelivery} onChange={setApptDelivery}
                  options={[{ value: 'no', label: 'No' }, { value: 'yes', label: 'Yes' }]}/>
              </div>
            )}
          </div>

          {payment === 'cod' && (
            <div className="wc-ac-fade" style={{ color: dark ? '#e2e8f0' : '#1e293b' }}>
              <FieldLabel>COD amount *</FieldLabel>
              <input value={codAmount} onChange={e => setCodAmount(e.target.value.replace(/[^\d.]/g, ''))}
                inputMode="decimal" placeholder="Amount to collect at delivery"
                className="w-full rounded-lg px-2.5 py-2 text-[11px] outline-none" style={{ ...fieldStyle(dark), borderColor: accent }}/>
            </div>
          )}

          {appointmentEnabled && apptDelivery === 'yes' && (
            <div className="wc-ac-fade" style={{ color: dark ? '#e2e8f0' : '#1e293b' }}>
              <FieldLabel>Delivery date *</FieldLabel>
              <input type="date" value={deliveryDate} onChange={e => setDeliveryDate(e.target.value)}
                className="w-full rounded-lg px-2.5 py-2 text-[11px] outline-none" style={{ ...fieldStyle(dark), borderColor: accent }}/>
            </div>
          )}

          <div className="grid grid-cols-2 gap-2">
            <div style={{ color: dark ? '#e2e8f0' : '#1e293b' }}>
              <FieldLabel>Freight mode</FieldLabel>
              <Toggle accent={accent} dark={dark} value={freightMode} onChange={setFreightMode}
                options={[{ value: 'prepaid', label: 'Prepaid' }, { value: 'topay', label: 'Pay After Pickup' }]}/>
            </div>
            {insuranceEnabled && (
              <div style={{ color: dark ? '#e2e8f0' : '#1e293b' }}>
                <FieldLabel>Insurance by</FieldLabel>
                <Toggle accent={accent} dark={dark} value={insuranceBy} onChange={setInsuranceBy}
                  options={[{ value: 'owner', label: 'Owner' }, { value: 'carrier', label: 'Carrier' }]}/>
              </div>
            )}
          </div>
        </div>
      )}

      {rateEstimate != null && (
        <div className="rounded-xl px-2.5 py-2 flex items-center justify-between wc-ac-fade" style={{ background: `${accent}12` }}>
          <span className="text-[10.5px] font-semibold" style={{ color: dark ? '#cbd5e1' : '#475569' }}>Estimated rate</span>
          <span className="text-[13px] font-black" style={{ color: accent }}>{currency}{rateEstimate.toFixed(0)}</span>
        </div>
      )}

      <div className="flex gap-1.5 pt-0.5">
        <button type="button" disabled={!ready} onClick={checkRates}
          className="flex-1 flex items-center justify-center gap-1 py-2.5 rounded-xl text-[11px] font-bold text-white transition-opacity"
          style={{ background: '#0f172a', opacity: ready ? 1 : 0.4 }}>
          <Filter size={11}/> Check Rates
        </button>
        <button type="button" disabled={!canBook} onClick={book}
          className="flex-1 flex items-center justify-center gap-1 py-2.5 rounded-xl text-[11px] font-bold text-white transition-opacity"
          style={{ background: '#f97316', opacity: canBook ? 1 : 0.4 }}>
          <Zap size={11}/> 1-Click Book
        </button>
      </div>

      {openPicker && (
        <LocationPickerModal
          direction={openPicker} apiKey={googleMapsApiKey} accent={accent} dark={dark}
          onClose={() => setOpenPicker(null)}
          onConfirm={picked => {
            if (openPicker === 'pickup') setPickup(picked)
            else setDelivery(picked)
            setOpenPicker(null)
          }}/>
      )}
    </div>
  )
}
