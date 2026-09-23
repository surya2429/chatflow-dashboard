// LocationMap.jsx — the Google Maps surface shared by both location features:
// the visitor answering an "Ask Location" question, and the bot sending one.
//
// The loader lives here rather than in AnswerControls.jsx because two callers
// now need it, and two copies of a script-injecting singleton is exactly how a
// page ends up loading the Maps API twice and throwing
// "You have included the Google Maps JavaScript API multiple times".
//
// Everything degrades without a key. A merchant who has not configured one
// still gets a readable address card and a working "Open in Google Maps" link
// — that link is a plain maps.google.com URL and needs no API key at all — so
// the feature is never dead, it just isn't live.
import { useEffect, useRef, useState } from 'react'
import clsx from 'clsx'
import { MapPin, ExternalLink } from 'lucide-react'

let gmapsPromise = null

/* Google signals a REJECTED key (wrong key, referrer not allowed, billing off)
 * at runtime, not at load time: the script downloads fine, so `script.onerror`
 * never fires, and then the API paints its own "Oops! Something went wrong"
 * panel — complete with its own input box — straight into whatever element we
 * gave it. Inside a chat widget that reads as the merchant's bot breaking, and
 * our own "check the API key" hint never shows because as far as the loader is
 * concerned the script loaded.
 *
 * `gm_authFailure` is the documented hook for exactly this. It has to exist on
 * window before the script runs, which is why it is installed at module scope
 * alongside the loader rather than inside a component. */
let authFailed = false
const authListeners = new Set()
if (typeof window !== 'undefined') {
  window.gm_authFailure = () => {
    authFailed = true
    // Drop the cached promise so a corrected key can retry without a reload.
    gmapsPromise = null
    authListeners.forEach(fn => fn())
  }
}

/**
 * Loads the Maps JS API once per page. `places` is requested because the Ask
 * Location autocomplete needs it; asking for it here rather than per-caller
 * keeps every consumer on one script tag with one library set, which is the
 * only way the singleton is actually a singleton.
 */
export function loadGoogleMaps(apiKey) {
  if (!apiKey) return Promise.reject(new Error('no key'))
  if (window.google?.maps?.places) return Promise.resolve(window.google.maps)
  if (gmapsPromise) return gmapsPromise
  gmapsPromise = new Promise((resolve, reject) => {
    const cbName = '__wcGmapsCallback'
    window[cbName] = () => { resolve(window.google.maps); delete window[cbName] }
    const script = document.createElement('script')
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(apiKey)}&libraries=places&callback=${cbName}`
    script.async = true
    script.onerror = () => {
      // Clear the cached promise so a corrected key can retry — otherwise the
      // first bad key poisons the page until a reload.
      gmapsPromise = null
      reject(new Error('Google Maps failed to load — check the API key and that the Maps JavaScript API and Places API are enabled.'))
    }
    document.head.appendChild(script)
  })
  return gmapsPromise
}

/** 'no-key' | 'loading' | 'ready' | 'error' */
export function useGoogleMaps(apiKey) {
  const [status, setStatus] = useState(apiKey ? 'loading' : 'no-key')
  useEffect(() => {
    if (!apiKey) { setStatus('no-key'); return undefined }
    let cancelled = false
    if (authFailed) { setStatus('error'); return undefined }
    setStatus('loading')

    // A rejection can arrive after this component has already gone 'ready',
    // since Google validates the key asynchronously once the API first runs.
    const onAuthFail = () => { if (!cancelled) setStatus('error') }
    authListeners.add(onAuthFail)

    loadGoogleMaps(apiKey).then(
      () => { if (!cancelled && !authFailed) setStatus('ready') },
      () => { if (!cancelled) setStatus('error') },
    )
    return () => { cancelled = true; authListeners.delete(onAuthFail) }
  }, [apiKey])
  return status
}

/** Reverse-geocode a point. Resolves to null rather than throwing when Maps
 *  isn't available, so callers can always fall back to raw coordinates. */
export function reverseGeocode(lat, lng) {
  return new Promise(resolve => {
    if (!window.google?.maps?.Geocoder) return resolve(null)
    new window.google.maps.Geocoder().geocode({ location: { lat, lng } }, (results, status) => {
      resolve(status === 'OK' && results?.[0] ? results[0].formatted_address : null)
    })
  })
}

/** Pulls postal code / city / state out of a Geocoder result's
 *  address_components — the three fields an address FORM wants, which
 *  `formatted_address` alone doesn't separate. Google's naming is not
 *  intuitive: `locality` is the city and `administrative_area_level_1` is the
 *  state, and either can be missing for a rural or non-Indian address, so
 *  every lookup falls back to the next-broadest component rather than
 *  leaving a field blank when a narrower one exists. */
function pickComponents(components) {
  const find = (...types) => components?.find(c => types.some(t => c.types.includes(t)))?.long_name || ''
  return {
    pincode: find('postal_code'),
    city: find('locality', 'sublocality', 'administrative_area_level_2'),
    state: find('administrative_area_level_1'),
  }
}

/** Reverse-geocode a point into address + pincode/city/state, for a pin drag
 *  or a "use my current location" tap that needs to fill an address FORM, not
 *  just show a label. Resolves to null components (never throws) when Maps
 *  isn't available — the caller's fields stay editable and empty instead. */
export function reverseGeocodeDetailed(lat, lng) {
  return new Promise(resolve => {
    if (!window.google?.maps?.Geocoder) return resolve({ address: null, pincode: '', city: '', state: '' })
    new window.google.maps.Geocoder().geocode({ location: { lat, lng } }, (results, status) => {
      if (status !== 'OK' || !results?.[0]) return resolve({ address: null, pincode: '', city: '', state: '' })
      resolve({ address: results[0].formatted_address, ...pickComponents(results[0].address_components) })
    })
  })
}

/** Forward-geocode: turn typed text (a city, an area, a 6-digit pincode) into
 *  a point plus pincode/city/state. This is what powers "Or enter pincode →
 *  Use Pin" and a plain-text search that wasn't picked from the Autocomplete
 *  dropdown. Resolves to null when Maps isn't available or nothing matches,
 *  so the caller can fall back to entering everything by hand. */
export function geocodeAddress(query) {
  return new Promise(resolve => {
    const q = (query || '').trim()
    if (!q || !window.google?.maps?.Geocoder) return resolve(null)
    new window.google.maps.Geocoder().geocode({ address: q }, (results, status) => {
      if (status !== 'OK' || !results?.[0]) return resolve(null)
      const r = results[0]
      const loc = r.geometry?.location
      resolve({
        address: r.formatted_address, lat: loc ? loc.lat() : null, lng: loc ? loc.lng() : null,
        ...pickComponents(r.address_components),
      })
    })
  })
}

/** Keyless deep link — opens the native app on mobile, maps.google.com on
 *  desktop. Used by both the live map and the no-key fallback. */
export function mapsLink(lat, lng, address) {
  if (lat != null && lng != null) {
    return `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`
  }
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address || '')}`
}

/**
 * A map card.
 *
 * `onMove` makes the pin draggable and is what turns this from a picture into
 * a control — a visitor whose GPS lands them on the wrong side of the street
 * can correct it, which is the single most common reason a captured location
 * is useless to a driver.
 */
export default function LocationMap({
  lat, lng, address, label,
  apiKey, accent = '#0066ff', dark = false,
  height = 140, interactive = false, onMove,
  className,
}) {
  const status = useGoogleMaps(apiKey)
  const hostRef = useRef(null)
  const mapRef = useRef(null)
  const markerRef = useRef(null)
  const hasPoint = lat != null && lng != null

  // Build the map once the script is ready and we have somewhere to put it.
  useEffect(() => {
    if (status !== 'ready' || !hostRef.current || !hasPoint) return undefined
    const gm = window.google.maps
    const center = { lat: Number(lat), lng: Number(lng) }

    if (!mapRef.current) {
      mapRef.current = new gm.Map(hostRef.current, {
        center, zoom: 15,
        disableDefaultUI: true,
        zoomControl: interactive,
        gestureHandling: interactive ? 'greedy' : 'none',
        keyboardShortcuts: false,
        clickableIcons: false,
      })
      markerRef.current = new gm.Marker({
        map: mapRef.current, position: center, draggable: Boolean(onMove),
      })
      if (onMove) {
        markerRef.current.addListener('dragend', async e => {
          const nLat = e.latLng.lat(), nLng = e.latLng.lng()
          const addr = await reverseGeocode(nLat, nLng)
          onMove({ lat: nLat, lng: nLng, address: addr })
        })
      }
    } else {
      // Re-centre rather than rebuild: tearing the map down on every prop
      // change makes dragging the pin flicker the whole tile layer.
      mapRef.current.setCenter(center)
      markerRef.current?.setPosition(center)
    }
    return undefined
  }, [status, lat, lng, hasPoint, interactive, onMove])

  const surface = dark ? '#111c30' : '#f4f6f9'
  const border = dark ? '#22304a' : '#e3e8f0'
  const live = status === 'ready' && hasPoint

  return (
    <div className={clsx('rounded-xl overflow-hidden', className)}
      style={{ border: `1px solid ${border}`, background: surface }}>

      {/* Distinct keys so React builds a NEW element when switching between
          these, rather than reusing the one it already has. It matters because
          Google writes into the map host imperatively: on a rejected key it
          replaces the host's contents with its own error panel, and React —
          which only tracks the children it rendered itself — would happily
          keep that foreign DOM and render the fallback around it. */}
      {live ? (
        <div key="map" ref={hostRef} style={{ height, width: '100%' }}/>
      ) : (
        /* No key, still loading, or no coordinates. A flat band with the pin
           keeps the card the same shape as the live version, so the layout
           doesn't jump when a key is added. */
        <div key="fallback" className="flex items-center justify-center" style={{ height: Math.min(height, 96), background: dark ? '#0d1626' : '#eef2f7' }}>
          <MapPin size={20} style={{ color: accent, opacity: 0.55 }}/>
        </div>
      )}

      <div className="px-2.5 py-2">
        {label && (
          <p className="text-[11px] font-bold truncate" style={{ color: dark ? '#e2e8f0' : '#0f172a' }}>{label}</p>
        )}
        {address && (
          <p className="text-[10.5px] leading-snug mt-0.5" style={{ color: dark ? '#94a3b8' : '#64748b' }}>{address}</p>
        )}
        {!address && hasPoint && (
          <p className="text-[10.5px] font-mono mt-0.5" style={{ color: dark ? '#94a3b8' : '#64748b' }}>
            {Number(lat).toFixed(5)}, {Number(lng).toFixed(5)}
          </p>
        )}
        <a href={mapsLink(lat, lng, address)} target="_blank" rel="noreferrer"
          className="inline-flex items-center gap-1 mt-1.5 text-[10.5px] font-bold"
          style={{ color: accent }}>
          Open in Google Maps <ExternalLink size={10}/>
        </a>
        {status === 'error' && (
          <p className="text-[9.5px] mt-1" style={{ color: dark ? '#f87171' : '#dc2626' }}>
            Map unavailable — check the API key in Behavior settings.
          </p>
        )}
      </div>
    </div>
  )
}
