import { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import {
  Smartphone, CheckCircle2, Copy, Check, Code,
  ExternalLink, AlertCircle, RefreshCw,
  Shield, X, ChevronDown, Monitor, Eye, Loader2, AlertTriangle, Search,
  Instagram as InstagramIcon, Globe, Wifi,
} from 'lucide-react'
import clsx from 'clsx'
import Select from '../components/Select'
import { useApp } from '../context/AppContext'
import { startInstagramOAuth, INSTAGRAM_OAUTH_SCOPES } from '../utils/instagramOAuth'
import { apiGet, apiPost } from '../utils/api'
import { useBotId, isBotIdLoaded } from '../constants/webchat'

/* ─── Real Meta / WhatsApp credentials ──────────────────────────── */
const APP_CONFIG = {
  appId:       '393397129404628',
  configId:    '1672466256848759',
  apiVersion:  'v25.0',
  webhookUrl:  'https://smatbot.com:7001/whatsappwebhook',
  verifyToken: '12345',
  businessId:  '2438679909480544',
}

/* ─── helpers ─────────────────────────────────────────────────── */
function CopyButton({ text, className = '' }) {
  const [copied, setCopied] = useState(false)
  function copy() {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true); setTimeout(() => setCopied(false), 2000)
    })
  }
  return (
    <button onClick={copy}
      className={clsx('inline-flex items-center gap-1.5 btn-secondary', className)}>
      {copied ? <Check size={11} className="text-emerald-500" /> : <Copy size={11} />}
      {copied ? 'Copied!' : 'Copy'}
    </button>
  )
}

/* ─── Meta logo SVG ─────────────────────────────────────────────── */
const MetaLogo = ({ size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
    <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
  </svg>
)

const QUALITY_CFG = {
  High:   { color: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-200', dot: 'bg-emerald-400', bar: 'bg-emerald-400', pct: 92 },
  Medium: { color: 'text-amber-600',   bg: 'bg-amber-50',   border: 'border-amber-200',   dot: 'bg-amber-400',   bar: 'bg-amber-400',   pct: 60 },
  Low:    { color: 'text-red-500',     bg: 'bg-red-50',     border: 'border-red-200',     dot: 'bg-red-400',     bar: 'bg-red-400',     pct: 28 },
}

const MOCK_NUMBER = {
  display:      '+91 98765 43210',
  raw:          '919876543210',
  phoneId:      '104xxxxxxxxxx',
  wabaId:       '10215xxxxxxxxx',
  displayName:  'Acme Corp Support',
  businessName: 'Acme Corp Pvt Ltd',
  category:     'Business & Retail',
  quality:      'High',
  tier:         'Tier 1 — 1,000 conversations / 24hr',
  verified:     true,
  nameStatus:   'APPROVED',
  accountType:  'WhatsApp Business API',
  connectedOn:  '12 Mar 2025',
}

/* ─── Country codes ─────────────────────────────────────────────── */
const COUNTRY_CODES = [
  { code:'+91',  flag:'🇮🇳', name:'India' },
  { code:'+1',   flag:'🇺🇸', name:'United States' },
  { code:'+44',  flag:'🇬🇧', name:'United Kingdom' },
  { code:'+971', flag:'🇦🇪', name:'UAE' },
  { code:'+966', flag:'🇸🇦', name:'Saudi Arabia' },
  { code:'+974', flag:'🇶🇦', name:'Qatar' },
  { code:'+965', flag:'🇰🇼', name:'Kuwait' },
  { code:'+973', flag:'🇧🇭', name:'Bahrain' },
  { code:'+968', flag:'🇴🇲', name:'Oman' },
  { code:'+65',  flag:'🇸🇬', name:'Singapore' },
  { code:'+60',  flag:'🇲🇾', name:'Malaysia' },
  { code:'+61',  flag:'🇦🇺', name:'Australia' },
  { code:'+49',  flag:'🇩🇪', name:'Germany' },
  { code:'+33',  flag:'🇫🇷', name:'France' },
  { code:'+39',  flag:'🇮🇹', name:'Italy' },
  { code:'+34',  flag:'🇪🇸', name:'Spain' },
  { code:'+31',  flag:'🇳🇱', name:'Netherlands' },
  { code:'+55',  flag:'🇧🇷', name:'Brazil' },
  { code:'+52',  flag:'🇲🇽', name:'Mexico' },
  { code:'+7',   flag:'🇷🇺', name:'Russia' },
  { code:'+86',  flag:'🇨🇳', name:'China' },
  { code:'+81',  flag:'🇯🇵', name:'Japan' },
  { code:'+82',  flag:'🇰🇷', name:'South Korea' },
  { code:'+62',  flag:'🇮🇩', name:'Indonesia' },
  { code:'+92',  flag:'🇵🇰', name:'Pakistan' },
  { code:'+880', flag:'🇧🇩', name:'Bangladesh' },
  { code:'+94',  flag:'🇱🇰', name:'Sri Lanka' },
  { code:'+977', flag:'🇳🇵', name:'Nepal' },
  { code:'+20',  flag:'🇪🇬', name:'Egypt' },
  { code:'+234', flag:'🇳🇬', name:'Nigeria' },
  { code:'+27',  flag:'🇿🇦', name:'South Africa' },
  { code:'+254', flag:'🇰🇪', name:'Kenya' },
  { code:'+57',  flag:'🇨🇴', name:'Colombia' },
  { code:'+54',  flag:'🇦🇷', name:'Argentina' },
]

/* ─── Country code picker (portal-based to escape overflow clipping) ── */
function CountryCodeSelect({ value, onChange }) {
  const [open,   setOpen]   = useState(false)
  const [search, setSearch] = useState('')
  const [pos,    setPos]    = useState({ top: 0, left: 0, width: 260 })
  const btnRef  = useRef(null)
  const selected = COUNTRY_CODES.find(c => c.code === value) || COUNTRY_CODES[0]
  const filtered = COUNTRY_CODES.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase()) || c.code.includes(search)
  )

  function openDropdown() {
    if (btnRef.current) {
      const r = btnRef.current.getBoundingClientRect()
      setPos({ top: r.bottom + 4, left: r.left })
    }
    setOpen(true)
  }

  useEffect(() => {
    if (!open) return
    function handleClick(e) {
      if (!btnRef.current?.contains(e.target)) { setOpen(false); setSearch('') }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [open])

  return (
    <div className="relative flex-shrink-0">
      <button ref={btnRef} type="button" onClick={openDropdown}
        className="flex items-center gap-1.5 h-full px-3 border-r border-surface-border bg-surface hover:bg-surface-hover transition-colors text-xs text-slate-700 min-w-[86px] rounded-l-lg">
        <span className="text-sm leading-none">{selected.flag}</span>
        <span className="font-medium">{selected.code}</span>
        <ChevronDown size={10} className="text-slate-400 ml-auto"/>
      </button>

      {open && createPortal(
        <div style={{ position:'fixed', top: pos.top, left: pos.left, width: 260, zIndex: 99999 }}
          className="bg-white border border-surface-border rounded-xl shadow-modal overflow-hidden animate-fade-in">
          <div className="p-2 border-b border-surface-border">
            <div className="flex items-center gap-2 px-2.5 py-1.5 bg-surface border border-surface-border rounded-lg">
              <Search size={11} className="text-slate-400 flex-shrink-0"/>
              <input autoFocus value={search} onChange={e => setSearch(e.target.value)}
                placeholder="Search country or code…"
                className="flex-1 text-xs bg-transparent focus:outline-none text-slate-700 placeholder-slate-400"/>
            </div>
          </div>
          <div className="max-h-52 overflow-y-auto">
            {filtered.length === 0
              ? <p className="px-4 py-3 text-xs text-slate-400 text-center">No results</p>
              : filtered.map(c => (
                <button key={c.code} type="button"
                  onMouseDown={e => e.preventDefault()}
                  onClick={() => { onChange(c.code); setOpen(false); setSearch('') }}
                  className={clsx(
                    'w-full flex items-center gap-2.5 px-3 py-2 text-xs text-left transition-colors',
                    c.code === value ? 'bg-primary-50 text-primary font-semibold' : 'text-slate-700 hover:bg-surface-hover'
                  )}>
                  <span className="text-base leading-none w-5 flex-shrink-0">{c.flag}</span>
                  <span className="flex-1 truncate">{c.name}</span>
                  <span className="text-slate-400 font-mono text-[10px]">{c.code}</span>
                </button>
              ))
            }
          </div>
        </div>,
        document.body
      )}
    </div>
  )
}

/* ─── BSP options for manual connection ─────────────────────────── */
const BSPS = [
  {
    id: 'meta', label: 'Meta',
    fields: [
      { key: 'name',      label: 'WhatsApp Name',               placeholder: 'e.g. Acme Support',          phone: false },
      { key: 'phone',     label: 'Phone Number',                placeholder: 'Phone number',               phone: true  },
      { key: 'token',     label: 'Product Token',               placeholder: 'Enter your product token',   phone: false },
      { key: 'namespace', label: 'Namespace',                   placeholder: 'Enter your namespace',       phone: false },
      { key: 'phoneId',   label: 'Meta Phone Number ID',        placeholder: 'e.g. 104000000000',          phone: false },
      { key: 'wabaId',    label: 'WhatsApp Business Account ID',placeholder: 'e.g. 102150000000',          phone: false },
    ],
  },
  {
    id: '360cloud', label: '360 Cloud',
    fields: [
      { key: 'name',  label: 'WhatsApp Name', placeholder: 'e.g. Acme Support',        phone: false },
      { key: 'phone', label: 'Phone Number',  placeholder: 'Phone number',             phone: true  },
      { key: 'token', label: 'Product Token', placeholder: 'Enter your product token', phone: false },
    ],
  },
  {
    id: 'route', label: 'Route Mobile',
    fields: [
      { key: 'name',  label: 'WhatsApp Name', placeholder: 'e.g. Acme Support',        phone: false },
      { key: 'phone', label: 'Phone Number',  placeholder: 'Phone number',             phone: true  },
      { key: 'token', label: 'Product Token', placeholder: 'Enter your product token', phone: false },
    ],
  },
]

/* ─── Manual Connect Side Panel ──────────────────────────────────── */
function ManualConnectPanel({ onClose, onSave }) {
  const [bspId,       setBspId]       = useState('meta')
  const [values,      setValues]      = useState({})
  const [countryCode, setCountryCode] = useState('+91')
  const [errors,      setErrors]      = useState({})
  const bsp = BSPS.find(b => b.id === bspId)

  function handleBsp(id) { setBspId(id); setValues({}); setErrors({}) }
  function handleChange(key, val) {
    setValues(v => ({ ...v, [key]: val }))
    if (errors[key]) setErrors(e => ({ ...e, [key]: null }))
  }
  function handleSave() {
    const newErrors = {}
    bsp.fields.forEach(f => { if (!values[f.key]?.trim()) newErrors[f.key] = 'Required' })
    if (Object.keys(newErrors).length) { setErrors(newErrors); return }
    onSave({ bsp: bsp.label, countryCode, ...values })
  }

  return createPortal(
    <>
      {/* Overlay — covers the full viewport including sidebar */}
      <div className="side-panel-overlay" onClick={onClose}/>

      {/* Panel */}
      <div className="side-panel" style={{ width: 420 }}>

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-surface-border flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-primary-50 flex items-center justify-center flex-shrink-0">
              <Smartphone size={15} className="text-primary"/>
            </div>
            <div>
              <h3 className="sp-title">Connect WhatsApp Number</h3>
              <p className="sp-sub">Link a number via your BSP credentials</p>
            </div>
          </div>
          <button onClick={onClose}
            className="w-8 h-8 rounded-lg hover:bg-surface-hover text-slate-400 hover:text-slate-600 flex items-center justify-center transition-colors flex-shrink-0">
            <X size={15}/>
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5">

          {/* BSP selector */}
          <div>
            <label className="label mb-1.5 block">Provider (BSP)</label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              {BSPS.map(b => (
                <button key={b.id} type="button" onClick={() => handleBsp(b.id)}
                  className={clsx(
                    'py-2 px-3 rounded-lg border text-xs font-semibold transition-all text-center',
                    bspId === b.id
                      ? 'border-primary bg-primary-50 text-primary'
                      : 'border-surface-border text-slate-600 hover:border-primary/40 hover:text-primary hover:bg-primary-50/40'
                  )}>
                  {b.label}
                </button>
              ))}
            </div>
          </div>

          {/* Divider */}
          <div className="border-t border-surface-border"/>

          {/* Dynamic fields */}
          {bsp.fields.map(f => (
            <div key={f.key}>
              <label className="label mb-1.5 block">
                {f.label} <span className="text-red-400">*</span>
              </label>
              {f.phone ? (
                <div className={clsx(
                  'flex items-stretch border rounded-lg transition-all',
                  errors[f.key] ? 'border-red-400' : 'border-surface-border focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/10'
                )}>
                  <CountryCodeSelect value={countryCode} onChange={setCountryCode}/>
                  <input type="tel"
                    value={values[f.key] || ''}
                    onChange={e => handleChange(f.key, e.target.value)}
                    placeholder={f.placeholder}
                    className="flex-1 px-3 py-2 text-xs text-slate-700 placeholder-slate-400 focus:outline-none bg-white min-w-0 rounded-r-lg"/>
                </div>
              ) : (
                <input
                  value={values[f.key] || ''}
                  onChange={e => handleChange(f.key, e.target.value)}
                  placeholder={f.placeholder}
                  className={clsx('input', errors[f.key] && 'border-red-400')}/>
              )}
              {errors[f.key] && (
                <p className="text-[11px] text-red-500 mt-1 flex items-center gap-1">
                  <AlertTriangle size={10}/> {errors[f.key]}
                </p>
              )}
            </div>
          ))}

        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-surface-border flex-shrink-0">
          <button onClick={onClose} className="btn-secondary">Cancel</button>
          <button onClick={handleSave} className="btn-primary">
            <CheckCircle2 size={12}/> Save &amp; Connect
          </button>
        </div>
      </div>
    </>,
    document.body
  )
}

function WhatsAppSection() {
  // 'idle' | 'waiting' | 'connected'
  const [step,        setStep]        = useState('connected')
  const [error,       setError]       = useState(null)
  const [showManual,  setShowManual]  = useState(false)
  const sessionRef                    = useRef({})
  const connected                     = step === 'connected'
  const n = MOCK_NUMBER
  const q = QUALITY_CFG[n.quality]

  function handleManualSave(data) {
    // In production: POST data to API, then refresh connection state
    setShowManual(false)
    setStep('connected')
  }

  /* ── Load the real Meta JS SDK once ── */
  useEffect(() => {
    window.fbAsyncInit = function () {
      window.FB.init({
        appId:            APP_CONFIG.appId,
        autoLogAppEvents: true,
        xfbml:            true,
        version:          APP_CONFIG.apiVersion,
      })
    }
    if (!document.getElementById('facebook-jssdk')) {
      const s     = document.createElement('script')
      s.id        = 'facebook-jssdk'
      s.src       = 'https://connect.facebook.net/en_US/sdk.js'
      s.async     = true
      s.defer     = true
      s.crossOrigin = 'anonymous'
      document.body.appendChild(s)
    }

    /* ── Listen for WA_EMBEDDED_SIGNUP postMessage ── */
    function handleMessage(event) {
      if (event.origin !== 'https://www.facebook.com') return
      try {
        const data = JSON.parse(event.data)
        if (data.type === 'WA_EMBEDDED_SIGNUP') {
          sessionRef.current = data.data || {}
        }
      } catch { /* non-JSON frames — ignore */ }
    }
    window.addEventListener('message', handleMessage)
    return () => window.removeEventListener('message', handleMessage)
  }, [])

  /* ── Open the real Meta Embedded Signup popup ── */
  function launchSignup() {
    setStep('waiting')
    setError(null)

    function open() {
      try {
        window.FB.login(
          (response) => {
            if (response?.authResponse?.code) {
              // Auth code received — number connected
              setStep('connected')
            } else {
              // User cancelled or denied
              setStep('idle')
            }
          },
          {
            config_id:                    APP_CONFIG.configId,
            response_type:                'code',
            override_default_response_type: true,
            extras: { version: 'v4' },
          }
        )
      } catch (e) {
        setError('Could not open Meta. Please disable any pop-up blocker and try again.')
        setStep('idle')
      }
    }

    // FB SDK may still be loading — give it 500 ms if needed
    if (typeof window.FB !== 'undefined') {
      open()
    } else {
      setTimeout(open, 500)
    }
  }

  return (
    <div className="space-y-3">

      {/* ── Header ── */}
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-[13px] font-bold text-slate-800">WhatsApp Channel</h2>
          <p className="text-[11px] text-slate-400 mt-0.5">One WhatsApp Business number per chatbot — connected via Meta Embedded Signup</p>
        </div>
        <a href="https://developers.facebook.com/docs/whatsapp/embedded-signup" target="_blank" rel="noreferrer"
          className="inline-flex items-center gap-1 text-[10px] text-primary hover:underline font-medium">
          Meta Docs <ExternalLink size={9}/>
        </a>
      </div>

      {/* ── Notice ── */}
      <div className="flex items-start gap-2.5 p-3 rounded-xl bg-amber-50 border border-amber-200">
        <AlertCircle size={13} className="text-amber-500 flex-shrink-0 mt-0.5"/>
        <p className="text-[11px] text-amber-700 leading-relaxed">
          Each chatbot supports <strong>one WhatsApp number</strong> only. Disconnect the current number before connecting a new one.
        </p>
      </div>

      {/* ── Error banner ── */}
      {error && (
        <div className="flex items-start gap-2.5 p-3 rounded-xl bg-red-50 border border-red-200">
          <AlertTriangle size={13} className="text-red-500 flex-shrink-0 mt-0.5"/>
          <p className="text-[11px] text-red-600 leading-relaxed flex-1">{error}</p>
          <button onClick={() => setError(null)} className="text-red-400 hover:text-red-600 flex-shrink-0">
            <X size={12}/>
          </button>
        </div>
      )}

      {/* ── Meta Embedded Signup card (always visible) ── */}
      <div className="border border-surface-border rounded-xl overflow-hidden">
        {/* Card header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-surface-border bg-slate-50">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center">
              <MetaLogo size={14} className="text-primary" />
            </div>
            <div>
              <p className="text-slate-800 text-[12px] font-semibold leading-none">Meta Embedded Signup</p>
              <p className="text-slate-400 text-[9px] mt-0.5">Official Meta Business integration — secure OAuth flow</p>
            </div>
          </div>
          {connected && (
            <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 text-[9px] font-semibold">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"/> Authorized
            </span>
          )}
          {step === 'waiting' && (
            <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-full bg-primary/10 text-primary text-[9px] font-semibold">
              <Loader2 size={10} className="animate-spin"/> Waiting…
            </span>
          )}
        </div>

        {/* Card body */}
        <div className="p-4 bg-white">
          {connected ? (
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <CheckCircle2 size={18} className="text-emerald-500 flex-shrink-0"/>
                <div>
                  <p className="text-[12px] font-semibold text-slate-700">Connected as <span className="text-slate-900">{n.businessName}</span></p>
                  <p className="text-[10px] text-slate-400 mt-0.5">WABA ID: {n.wabaId} · Connected on {n.connectedOn}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button className="btn-secondary" onClick={() => setShowManual(true)}>
                  <Smartphone size={11}/> Manual Setup
                </button>
                <button className="btn-secondary" onClick={launchSignup}>
                  <RefreshCw size={11}/> Reconnect
                </button>
                <button onClick={() => setStep('idle')}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-red-200 text-[11px] font-semibold text-red-500 hover:bg-red-50 transition-colors">
                  <X size={11}/> Disconnect
                </button>
              </div>
            </div>
          ) : step === 'waiting' ? (
            <div className="flex items-center gap-3">
              <Loader2 size={18} className="text-primary animate-spin flex-shrink-0"/>
              <div>
                <p className="text-[12px] font-semibold text-slate-700">Meta login window is open</p>
                <p className="text-[10px] text-slate-400 mt-0.5">Complete the steps in the Meta popup to connect your WhatsApp number</p>
              </div>
              <button onClick={() => setStep('idle')}
                className="ml-auto text-slate-400 hover:text-slate-600 flex-shrink-0">
                <X size={14}/>
              </button>
            </div>
          ) : (
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <p className="text-[12px] font-semibold text-slate-700">Not connected</p>
                <p className="text-[10px] text-slate-400 mt-0.5">Use Meta Embedded Signup or connect manually via your BSP</p>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <button onClick={() => setShowManual(true)} className="btn-secondary">
                  <Smartphone size={11}/> Connect Manually
                </button>
                <button onClick={launchSignup}
                  className="btn-primary gap-2">
                  <MetaLogo size={12}/> Continue with Meta
                </button>
              </div>
            </div>
          )}
        </div>

      </div>

      {/* ── Connected number details ── */}
      {connected && (
        <div className="border border-surface-border rounded-xl overflow-hidden">
          {/* Number header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-surface-border bg-white">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-emerald-50 flex items-center justify-center flex-shrink-0">
                <Smartphone size={16} className="text-emerald-600"/>
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <p className="text-[14px] font-bold text-slate-800">{n.display}</p>
                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-emerald-50 text-emerald-600 text-[9px] font-bold border border-emerald-200">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"/> ACTIVE
                  </span>
                </div>
                <p className="text-[10px] text-slate-400 mt-0.5">{n.accountType}</p>
              </div>
            </div>
            <button className="btn-secondary">
              <RefreshCw size={11}/> Sync
            </button>
          </div>

          {/* Details grid */}
          <div className="p-4 bg-white grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">

            {/* Display Name */}
            <div className="bg-slate-50 rounded-xl px-3 py-2.5">
              <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1">Display Name</p>
              <div className="flex items-center gap-1.5">
                <p className="text-[12px] font-semibold text-slate-800">{n.displayName}</p>
                <span className="text-[8px] font-bold px-1 py-0.5 rounded bg-emerald-100 text-emerald-700">{n.nameStatus}</span>
              </div>
            </div>

            {/* Messaging Quality */}
            <div className={clsx('rounded-xl px-3 py-2.5 border', q.bg, q.border)}>
              <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1">Messaging Quality</p>
              <div className="flex items-center gap-2">
                <span className={clsx('text-[12px] font-bold', q.color)}>{n.quality}</span>
                <div className="flex-1 h-1.5 bg-white/60 rounded-full overflow-hidden">
                  <div className={clsx('h-full rounded-full', q.bar)} style={{ width: `${q.pct}%` }}/>
                </div>
                <span className={clsx('text-[9px] font-bold', q.color)}>{q.pct}%</span>
              </div>
            </div>

            {/* Business Name */}
            <div className="bg-slate-50 rounded-xl px-3 py-2.5">
              <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1">Business Name</p>
              <div className="flex items-center gap-1.5">
                <p className="text-[12px] font-semibold text-slate-800 truncate">{n.businessName}</p>
                {n.verified && <CheckCircle2 size={11} className="text-primary flex-shrink-0"/>}
              </div>
            </div>

            {/* Phone Number ID */}
            <div className="bg-slate-50 rounded-xl px-3 py-2.5">
              <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1">Phone Number ID</p>
              <div className="flex items-center gap-1.5">
                <p className="text-[11px] font-mono text-slate-600 truncate">{n.phoneId}</p>
                <button onClick={() => navigator.clipboard.writeText(n.phoneId)}
                  className="text-slate-300 hover:text-slate-600 transition-colors flex-shrink-0">
                  <Copy size={9}/>
                </button>
              </div>
            </div>

            {/* WABA ID */}
            <div className="bg-slate-50 rounded-xl px-3 py-2.5">
              <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1">WABA ID</p>
              <div className="flex items-center gap-1.5">
                <p className="text-[11px] font-mono text-slate-600 truncate">{n.wabaId}</p>
                <button onClick={() => navigator.clipboard.writeText(n.wabaId)}
                  className="text-slate-300 hover:text-slate-600 transition-colors flex-shrink-0">
                  <Copy size={9}/>
                </button>
              </div>
            </div>

            {/* Messaging Tier */}
            <div className="bg-slate-50 rounded-xl px-3 py-2.5">
              <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1">Messaging Limit</p>
              <p className="text-[12px] font-semibold text-slate-800">{n.tier}</p>
            </div>

            {/* Category */}
            <div className="bg-slate-50 rounded-xl px-3 py-2.5">
              <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1">Business Category</p>
              <p className="text-[12px] font-semibold text-slate-800">{n.category}</p>
            </div>

            {/* Account Type */}
            <div className="bg-slate-50 rounded-xl px-3 py-2.5">
              <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1">Account Type</p>
              <p className="text-[12px] font-semibold text-slate-800">{n.accountType}</p>
            </div>

            {/* Connected On */}
            <div className="bg-slate-50 rounded-xl px-3 py-2.5">
              <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1">Connected On</p>
              <p className="text-[12px] font-semibold text-slate-800">{n.connectedOn}</p>
            </div>

          </div>
        </div>
      )}

      {/* ── Manual Connect Panel ── */}
      {showManual && (
        <ManualConnectPanel
          onClose={() => setShowManual(false)}
          onSave={handleManualSave}
        />
      )}
    </div>
  )
}

/* ─── Widget Generator ───────────────────────────────────────────── */
const POSITIONS = ['bottom-right','bottom-left','top-right','top-left']
const THEMES = [
  { label: 'WhatsApp Green', value: '#25D366' },
  { label: 'Brand Blue',     value: '#0066ff' },
  { label: 'Midnight',       value: '#1e293b' },
  { label: 'Custom',         value: 'custom'  },
]

function WidgetSection() {
  const [number,      setNumber]      = useState('919876543210')
  const [message,     setMessage]     = useState('Hello! I would like to know more about your services.')
  const [position,    setPosition]    = useState('bottom-right')
  const [themeVal,    setThemeVal]    = useState('#25D366')
  const [customColor, setCustomColor] = useState('#25D366')
  const [btnText,     setBtnText]     = useState('Chat with us')
  const [showBadge,   setShowBadge]   = useState(true)
  const [badgeText,   setBadgeText]   = useState('We reply instantly')
  const [tab,         setTab]         = useState('script') // 'script' | 'preview'

  const color = themeVal === 'custom' ? customColor : themeVal

  const script = `<!-- ChatFlow WhatsApp Widget -->
<script>
  window.CFWidgetConfig = {
    number:   "${number}",
    message:  "${message}",
    position: "${position}",
    color:    "${color}",
    text:     "${btnText}",
    badge:    ${showBadge ? `"${badgeText}"` : 'false'},
  };
</script>
<script src="https://cdn.chatflow.ai/widget/v2/widget.min.js" async></script>`

  const isRight = position.includes('right')
  const isBottom = position.includes('bottom')

  return (
    <div>
      <div className="mb-4">
        <h2 className="text-[13px] font-bold text-slate-800">Website Widget</h2>
        <p className="text-[11px] text-slate-400 mt-0.5">Generate a WhatsApp chat button for your website — visitors click it to open WhatsApp directly</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">

        {/* ── Config panel ── */}
        <div className="lg:col-span-3 bg-white border border-surface-border rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-surface-border">
            <p className="text-[11px] font-semibold text-slate-700">Widget Settings</p>
          </div>
          <div className="p-4 space-y-4">

            {/* WhatsApp Number */}
            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">WhatsApp Number</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[11px] text-slate-400 font-medium">+</span>
                <input value={number} onChange={e => setNumber(e.target.value.replace(/\D/g,''))}
                  placeholder="919876543210"
                  className="w-full border border-surface-border rounded-lg pl-6 pr-3 py-2 text-[11px] text-slate-700 focus:outline-none focus:border-primary"/>
              </div>
              <p className="text-[9px] text-slate-400 mt-1">Include country code without + (e.g. 919876543210)</p>
            </div>

            {/* Pre-fill message */}
            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Pre-fill Message</label>
              <textarea value={message} onChange={e => setMessage(e.target.value)} rows={2}
                className="w-full border border-surface-border rounded-lg px-3 py-2 text-[11px] text-slate-700 focus:outline-none focus:border-primary resize-none"/>
            </div>

            {/* Button text */}
            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Button Label</label>
              <input value={btnText} onChange={e => setBtnText(e.target.value)}
                className="w-full border border-surface-border rounded-lg px-3 py-2 text-[11px] text-slate-700 focus:outline-none focus:border-primary"/>
            </div>

            {/* Position + Color */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Position</label>
                <Select
                  value={position}
                  onChange={v => setPosition(v)}
                  options={POSITIONS.map(p => ({ value: p, label: p.replace('-', ' ') }))}
                  size="sm"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Theme Color</label>
                <Select
                  value={themeVal}
                  onChange={v => setThemeVal(v)}
                  options={THEMES.map(t => ({ value: t.value, label: t.label }))}
                  size="sm"
                />
                {themeVal === 'custom' && (
                  <div className="flex items-center gap-2 mt-2">
                    <input type="color" value={customColor} onChange={e => setCustomColor(e.target.value)}
                      className="w-8 h-8 rounded-lg border border-surface-border cursor-pointer p-0.5"/>
                    <span className="text-[10px] text-slate-500 font-mono">{customColor}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Badge toggle */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Tooltip Badge</label>
                <button onClick={() => setShowBadge(p => !p)}
                  style={{ width:36, height:20, borderRadius:10, border:'none', cursor:'pointer', position:'relative',
                    background: showBadge ? '#0066ff' : '#d1d5db', transition:'background 0.2s', padding:0, flexShrink:0 }}>
                  <div style={{ position:'absolute', top:2, left: showBadge ? 16 : 2, width:16, height:16, borderRadius:'50%',
                    background:'#fff', transition:'left 0.2s', boxShadow:'0 1px 3px rgba(0,0,0,0.2)' }}/>
                </button>
              </div>
              {showBadge && (
                <input value={badgeText} onChange={e => setBadgeText(e.target.value)}
                  className="w-full border border-surface-border rounded-lg px-3 py-2 text-[11px] text-slate-700 focus:outline-none focus:border-primary"/>
              )}
            </div>

          </div>
        </div>

        {/* ── Output panel ── */}
        <div className="lg:col-span-2 flex flex-col gap-3">

          {/* Tab switcher */}
          <div className="flex bg-slate-100 rounded-xl p-1 gap-1">
            {[{ id:'script', icon:Code, label:'Script' },{ id:'preview', icon:Eye, label:'Preview' }].map(t => (
              <button key={t.id} onClick={() => setTab(t.id)}
                className={clsx('flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-[11px] font-semibold transition-all',
                  tab === t.id ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700')}>
                <t.icon size={11}/>{t.label}
              </button>
            ))}
          </div>

          {/* Script output */}
          {tab === 'script' && (
            <div className="bg-white border border-surface-border rounded-xl overflow-hidden flex-1">
              <div className="flex items-center justify-between px-4 py-3 border-b border-surface-border">
                <div className="flex items-center gap-1.5">
                  <div className="w-2.5 h-2.5 rounded-full bg-red-400"/>
                  <div className="w-2.5 h-2.5 rounded-full bg-amber-400"/>
                  <div className="w-2.5 h-2.5 rounded-full bg-emerald-400"/>
                  <span className="text-[10px] text-slate-400 ml-1 font-mono">widget-embed.html</span>
                </div>
                <CopyButton text={script}/>
              </div>
              <pre className="p-4 text-[10px] font-mono text-slate-600 leading-relaxed overflow-x-auto whitespace-pre-wrap">
                <span className="text-slate-400">{'<!-- ChatFlow WhatsApp Widget -->'}{'\n'}</span>
                <span className="text-primary">{'<script>'}{'\n'}</span>
                <span className="text-slate-500">{'  window.CFWidgetConfig = {'}{'\n'}</span>
                {[
                  ['number',   `"${number}"`],
                  ['message',  `"${message.slice(0,40)}${message.length>40?'…':''}"`],
                  ['position', `"${position}"`],
                  ['color',    `"${color}"`],
                  ['text',     `"${btnText}"`],
                  ['badge',    showBadge ? `"${badgeText}"` : 'false'],
                ].map(([k,v]) => (
                  <span key={k}>
                    <span className="text-slate-500">{'    '}</span>
                    <span className="text-amber-600">{k}</span>
                    <span className="text-slate-400">: </span>
                    <span className="text-emerald-600">{v}</span>
                    <span className="text-slate-400">,{'\n'}</span>
                  </span>
                ))}
                <span className="text-slate-500">{'  };'}{'\n'}</span>
                <span className="text-primary">{'</script>'}{'\n'}</span>
                <span className="text-primary">{'<script '}</span>
                <span className="text-amber-600">src</span>
                <span className="text-slate-400">{"="}</span>
                <span className="text-emerald-600">{'"https://cdn.chatflow.ai/widget/v2/widget.min.js"'}</span>
                <span className="text-amber-600">{' async'}</span>
                <span className="text-primary">{'></script>'}</span>
              </pre>
              <div className="px-4 py-3 border-t border-surface-border bg-slate-50 flex items-center justify-between">
                <p className="text-[10px] text-slate-400">Paste before <code className="font-mono bg-slate-200 px-1 rounded">&lt;/body&gt;</code> tag</p>
                <CopyButton text={script}/>
              </div>
            </div>
          )}

          {/* Widget Preview */}
          {tab === 'preview' && (
            <div className="bg-white border border-surface-border rounded-xl overflow-hidden flex-1 flex flex-col">
              <div className="px-4 py-3 border-b border-surface-border flex items-center gap-2">
                <Monitor size={12} className="text-slate-400"/>
                <span className="text-[11px] font-semibold text-slate-700">Widget Preview</span>
              </div>
              <div className="relative flex-1 bg-slate-50 min-h-[280px] overflow-hidden rounded-b-xl">
                {/* Fake page content */}
                <div className="absolute inset-0 p-4 opacity-30">
                  <div className="h-4 bg-slate-300 rounded w-3/4 mb-2"/>
                  <div className="h-3 bg-slate-200 rounded w-full mb-1.5"/>
                  <div className="h-3 bg-slate-200 rounded w-5/6 mb-1.5"/>
                  <div className="h-3 bg-slate-200 rounded w-4/6"/>
                </div>

                {/* Widget button */}
                <div className={clsx(
                  'absolute flex flex-col gap-2',
                  isRight ? 'right-4' : 'left-4',
                  isBottom ? 'bottom-4' : 'top-4',
                  isRight ? 'items-end' : 'items-start',
                )}>
                  {/* Badge */}
                  {showBadge && (
                    <div className="bg-white border border-surface-border rounded-xl px-3 py-2 shadow-md max-w-[160px]">
                      <p className="text-[10px] font-semibold text-slate-700 leading-tight">{badgeText}</p>
                      <div className={clsx('w-2 h-2 bg-white border-b border-r border-surface-border rotate-45 absolute -bottom-1',
                        isRight ? 'right-4' : 'left-4')}/>
                    </div>
                  )}
                  {/* Button */}
                  <button className="flex items-center gap-2 px-3 py-2.5 rounded-full text-white text-[11px] font-bold shadow-lg hover:opacity-90 transition-opacity"
                    style={{ background: color }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="white">
                      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347"/>
                    </svg>
                    {btnText}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* CDN info */}
          <div className="bg-white border border-surface-border rounded-xl p-3 flex items-start gap-2.5">
            <Shield size={12} className="text-primary flex-shrink-0 mt-0.5"/>
            <div>
              <p className="text-[10px] font-semibold text-slate-700">Lightweight &amp; Secure</p>
              <p className="text-[9px] text-slate-400 mt-0.5">~4KB gzipped · No cookies · GDPR compliant · Served from global CDN</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

/* ─── Instagram Business Login (moved here from Instagram Automation → Connect) ── */
function InstagramConnectSection() {
  const [status, setStatus] = useState('loading') // 'loading' | 'connected' | 'disconnected' | 'unreachable'
  const [account, setAccount] = useState(null)
  const [disconnecting, setDisconnecting] = useState(false)

  useEffect(() => {
    let cancelled = false
    apiGet('/instagram/status')
      .then(data => {
        if (cancelled) return
        setStatus(data.connected ? 'connected' : 'disconnected')
        setAccount(data.connected ? data : null)
      })
      .catch(() => { if (!cancelled) setStatus('unreachable') })
    return () => { cancelled = true }
  }, [])

  async function disconnect() {
    setDisconnecting(true)
    try {
      await apiPost('/instagram/disconnect')
      setStatus('disconnected')
      setAccount(null)
    } catch {
      // backend unreachable — nothing to roll back, the connect state was never confirmed anyway
    } finally {
      setDisconnecting(false)
    }
  }

  return (
    <div className="space-y-3">
      <div>
        <h2 className="text-[13px] font-bold text-slate-800">Instagram Business Account</h2>
        <p className="text-[11px] text-slate-400 mt-0.5">Required for DM, comment &amp; story automation via the Meta API</p>
      </div>

      <div className="border border-surface-border rounded-xl p-4">
        {status === 'loading' && (
          <div className="flex items-center gap-2 p-3 rounded-xl bg-slate-50 border border-surface-border">
            <Loader2 size={14} className="text-slate-400 animate-spin flex-shrink-0"/>
            <p className="text-[12px] text-slate-500">Checking connection status…</p>
          </div>
        )}

        {status === 'connected' && account && (
          <div className="flex items-center gap-2 p-3 rounded-xl bg-emerald-50 border border-emerald-200">
            <CheckCircle2 size={15} className="text-emerald-600 flex-shrink-0"/>
            <div className="flex-1">
              <p className="text-[12px] font-semibold text-emerald-700">@{account.username} is connected</p>
              <p className="text-[10px] text-emerald-600">
                {account.connectedAt ? `Connected ${new Date(account.connectedAt).toLocaleDateString()}` : 'Connected via Instagram Business Login'}
              </p>
            </div>
            <button onClick={disconnect} disabled={disconnecting}
              className="text-[11px] font-semibold text-red-500 hover:text-red-600 disabled:opacity-50 flex-shrink-0">
              {disconnecting ? 'Disconnecting…' : 'Disconnect'}
            </button>
          </div>
        )}

        {(status === 'disconnected' || status === 'unreachable') && (
          <div className="flex items-center gap-3 mb-1">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: 'linear-gradient(135deg,#f9ce34,#ee2a7b,#6228d7)' }}>
              <InstagramIcon size={18} className="text-white"/>
            </div>
            <div className="flex-1">
              <p className="text-[12px] font-semibold text-slate-700">Not connected</p>
              <p className="text-[10px] text-slate-400 mt-0.5">Link your Instagram Business or Creator account to enable automation</p>
            </div>
          </div>
        )}

        {(status === 'disconnected' || status === 'unreachable') && (
          <>
            <button onClick={() => startInstagramOAuth()}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-white text-[13px] font-semibold mt-3"
              style={{ background: 'linear-gradient(135deg,#f9ce34,#ee2a7b,#6228d7)' }}>
              <InstagramIcon size={15}/> Continue with Instagram
            </button>
            {status === 'unreachable' && (
              <p className="text-[10px] text-amber-600 mt-2 flex items-center gap-1">
                <AlertCircle size={11} className="flex-shrink-0"/> Can't reach the backend to check live status — you can still start the connection.
              </p>
            )}
          </>
        )}
      </div>

      <div className="border border-surface-border rounded-xl p-4">
        <p className="text-xs font-semibold text-slate-800 mb-3">Requirements</p>
        <div className="space-y-2">
          {[
            'Instagram account converted to a Business or Creator account',
            'Instagram account linked to a Facebook Page you manage',
            'Admin access to that Facebook Page',
          ].map(req => (
            <div key={req} className="flex items-start gap-2">
              <CheckCircle2 size={13} className="text-emerald-500 flex-shrink-0 mt-0.5"/>
              <span className="text-[12px] text-slate-600">{req}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="border border-surface-border rounded-xl p-4">
        <p className="text-xs font-semibold text-slate-800 mb-3">Permissions requested</p>
        <div className="flex flex-wrap gap-2">
          {INSTAGRAM_OAUTH_SCOPES.map(p => (
            <span key={p} className="text-[10px] font-mono px-2 py-1 rounded-md bg-slate-100 text-slate-600">{p}</span>
          ))}
        </div>
      </div>
    </div>
  )
}

/* ─── Web Chat widget installation — one snippet, every website ───── */

/* Where the loader is served from. One place to change when the CDN moves;
   the bot id rides along in the query string so the snippet is a single
   self-contained tag with nothing to configure around it. */
const WIDGET_CDN = 'https://cdn.chatflow.io/v2/widget.js'

/**
 * The install code customers actually paste — one tag, id included.
 *
 * Everything that used to sit in this snippet (colours, position, the loader
 * body) moved into public/widget.js and the dashboard. That is not just
 * cosmetic: config that lives in the customer's HTML has to be re-pasted by a
 * developer every time a merchant changes their brand colour, whereas config
 * keyed to the bot id is changed in the Widget Builder and is live
 * immediately. The snippet becomes something you paste once and never touch.
 *
 * `async` so it never blocks the host page's first paint, which is the other
 * half of "it won't affect your site".
 */
function universalSnippet(widgetId) {
  return `<script src="${WIDGET_CDN}?id=${widgetId}" async></script>`
}

/* What the loader is actually doing to keep this promise — see the contract
   comment at the top of public/widget.js, which these mirror. Worth stating on
   the page because "will your script break my CSS" is the first question every
   developer installing a third-party widget asks. */
const ISOLATION_POINTS = [
  ['One element, zero stylesheets',
   'Adds a single <div> to <body> and nothing at all to <head> — no CSS reset, no font, no globals.'],
  ['Rendered in an iframe',
   'Its own document and its own cascade, so no style crosses in either direction — not even inherited font or colour.'],
  ['Immune to !important',
   'Every layout-critical property is set inline with !important, which outranks any stylesheet on your page.'],
  ['Only as big as it looks',
   'Closed, it is a 92px box in one corner — it never covers your cookie banner, and never adds a scrollbar.'],
]

/* Optional query params on the same tag, for the one thing a snippet genuinely
   can't decide for the merchant: which corner is already occupied. */
const SNIPPET_OPTIONS = [
  ['position', 'bottom-left', 'Which corner the launcher sits in'],
  ['offset-x', '20',          'Distance from the side edge, in px'],
  ['offset-y', '90',          'Distance from the top/bottom edge — raise it to clear a sticky bar'],
]

/* Same snippet everywhere — only the file you paste it into changes. */
const WC_WEB_TARGETS = [
  {
    id: 'html', label: 'HTML', color: '#E34F26',
    file: 'index.html',
    steps: [
      'Open the file that renders your <head> — usually index.html, or a shared header include such as header.php or _header.html.',
      'Paste the snippet immediately after the opening <head> tag.',
      'Re-upload or redeploy. The launcher appears on every page that uses that head.',
    ],
  },
  {
    id: 'react', label: 'React / Next.js', color: '#61DAFB',
    file: 'index.html · app/layout.tsx · pages/_document.jsx',
    steps: [
      'Vite or Create React App: paste it into the <head> of index.html (public/index.html on CRA).',
      'Next.js App Router: paste it inside the <head> you already render in app/layout.tsx.',
      'Next.js Pages Router: paste it inside <Head> in pages/_document.jsx.',
      'Do not wrap it in a component — the widget attaches to document.body, so it already survives route changes and never re-mounts.',
    ],
  },
  {
    id: 'vue', label: 'Vue / Nuxt', color: '#42b883',
    file: 'index.html · app.html',
    steps: [
      'Vue (Vite): paste it into the <head> of index.html in your project root.',
      'Nuxt: create or open app.html in your project root and paste it inside <head>.',
      'Nothing to register with createApp() or app.use() — the loader runs on its own.',
    ],
  },
  {
    id: 'wordpress', label: 'WordPress', color: '#21759B',
    file: 'header.php',
    steps: [
      'Appearance → Theme File Editor → header.php, and paste the snippet just before </head>.',
      'If your theme offers Theme Options → Custom Code → Header, use that instead — it survives theme updates.',
      'Save, then hard-refresh your site.',
    ],
  },
  {
    id: 'shopify', label: 'Shopify', color: '#95BF47',
    file: 'layout/theme.liquid',
    steps: [
      'Online Store → Themes → ⋯ → Edit code.',
      'Open layout/theme.liquid and paste the snippet just before </head>.',
      'Save. Every storefront page that uses this layout picks it up.',
    ],
  },
  {
    id: 'builder', label: 'Webflow / Wix / Squarespace', color: '#4353FF',
    file: 'Custom code → Head',
    steps: [
      'Webflow: Project Settings → Custom Code → Head Code, then Publish.',
      'Wix: Settings → Custom Code → Add Code, placed in <head> on all pages.',
      'Squarespace: Settings → Developer Tools → Code Injection → Header.',
    ],
  },
]

const WC_MOBILE_TARGETS = [
  { id: 'ios',     label: 'iOS (Swift)',  detail: 'WKWebView',              builtIn: true,  color: '#0f172a' },
  { id: 'android', label: 'Android',      detail: 'android.webkit.WebView', builtIn: true,  color: '#3DDC84' },
  { id: 'rn',      label: 'React Native', detail: 'react-native-webview',   builtIn: false, color: '#61DAFB' },
  { id: 'flutter', label: 'Flutter',      detail: 'webview_flutter',        builtIn: false, color: '#02569B' },
]

function useCopy() {
  const [copied, setCopied] = useState(null)
  function copy(text, key) {
    navigator.clipboard.writeText(text).catch(()=>{})
    setCopied(key); setTimeout(()=>setCopied(null), 2000)
  }
  return { copied, copy }
}

function WCCodeBlock({ code, lang = 'js', id, copied, onCopy }) {
  return (
    <div className="relative rounded-lg overflow-hidden border border-slate-700">
      <div className="flex items-center justify-between px-3 py-2 bg-slate-800">
        <span className="text-[10px] font-mono text-slate-400 uppercase tracking-wider">{lang}</span>
        <button onClick={() => onCopy(code, id)}
          className="flex items-center gap-1 text-[10px] font-semibold text-slate-300 hover:text-white transition-colors">
          {copied === id ? <><Check size={10} className="text-emerald-400"/>Copied</> : <><Copy size={10}/>Copy</>}
        </button>
      </div>
      <pre className="px-4 py-3 bg-slate-900 text-[11px] font-mono text-slate-200 overflow-x-auto leading-relaxed whitespace-pre">
        {code}
      </pre>
    </div>
  )
}

function WebChatInstallSection() {
  const { copied, copy } = useCopy()
  const [target, setTarget] = useState('html')
  const t       = WC_WEB_TARGETS.find(x => x.id === target)
  const BOT_ID  = useBotId()
  const assigned = isBotIdLoaded()
  const snippet = universalSnippet(BOT_ID)
  const chatUrl = `https://chat.chatflow.io/w/${BOT_ID}`

  return (
    <div className="space-y-5">

      {/* ── Header ── */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-[13px] font-bold text-slate-800">Website Chat Widget</h2>
          <p className="text-[11px] text-slate-400 mt-0.5">One script tag, every website — nothing for your customers to install</p>
        </div>
        <div className="flex items-center gap-2 p-2.5 bg-slate-50 border border-surface-border rounded-xl">
          <span className="text-[10px] font-semibold text-slate-500">Bot ID:</span>
          <code className="text-[11px] font-mono text-slate-800">{BOT_ID}</code>
          <button onClick={()=>copy(BOT_ID,'wid')}
            className="text-[10px] font-semibold text-primary hover:text-primary-hover flex items-center gap-0.5">
            {copied==='wid'?<><Check size={10}/>Copied</>:<><Copy size={10}/>Copy</>}
          </button>
        </div>
      </div>

      {/* ── The one snippet ── */}
      <div className="bg-white border border-surface-border rounded-xl overflow-hidden">
        <div className="flex items-center gap-3 px-4 py-3 border-b border-surface-border">
          <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
            <Code size={15} className="text-primary"/>
          </div>
          <div className="min-w-0">
            <p className="text-xs font-bold text-slate-900">Your install code</p>
            <p className="text-[10px] text-slate-400 mt-0.5">
              One tag, pasted once inside <code className="font-mono bg-slate-100 px-1 rounded">&lt;head&gt;</code> — your Bot ID is already in it
            </p>
          </div>
          <span className="ml-auto flex-shrink-0 inline-flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
            <Globe size={9}/> Works everywhere
          </span>
        </div>

        <div className="p-4 space-y-3">
          {/* The id is issued by the server, so there is a real window where
              this page has no id to show. Saying so beats rendering a dash and
              letting someone copy a snippet that cannot work. */}
          {!assigned && (
            <div className="flex gap-2.5 bg-amber-50 border border-amber-200 rounded-lg p-3">
              <AlertCircle size={13} className="text-amber-500 flex-shrink-0 mt-0.5"/>
              <p className="text-[11px] text-amber-700 leading-relaxed">
                No Bot ID assigned yet. The number is issued by the server when the bot is
                created — it is never generated in the browser, because it runs as one sequence
                across every account. Create the bot (or start the API) and this snippet fills in.
              </p>
            </div>
          )}
          <WCCodeBlock code={snippet} lang="html" id="universal" copied={copied} onCopy={copy}/>

          {/* Everything else is configured in the Widget Builder against this
              id, so the tag itself never needs re-pasting. The exceptions are
              here: only the merchant knows which corner their site already
              uses. */}
          <div className="border border-surface-border rounded-lg overflow-hidden">
            <div className="px-3 py-2 bg-slate-50 border-b border-surface-border">
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                Optional — add to the same tag
              </p>
            </div>
            <div className="divide-y divide-surface-border">
              {SNIPPET_OPTIONS.map(([key, example, desc]) => (
                <div key={key} className="flex items-center gap-3 px-3 py-2">
                  <code className="text-[10.5px] font-mono text-slate-700 bg-slate-100 px-1.5 py-0.5 rounded flex-shrink-0">
                    &amp;{key}={example}
                  </code>
                  <p className="text-[11px] text-slate-500 leading-snug">{desc}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ── Why it can't break their site ── */}
      <div className="bg-white border border-surface-border rounded-xl overflow-hidden">
        <div className="flex items-center gap-3 px-4 py-3 border-b border-surface-border">
          <div className="w-8 h-8 rounded-lg bg-emerald-50 flex items-center justify-center flex-shrink-0">
            <Shield size={15} className="text-emerald-600"/>
          </div>
          <div>
            <p className="text-xs font-bold text-slate-900">It can't touch your site's CSS</p>
            <p className="text-[10px] text-slate-400 mt-0.5">No style leaks in either direction, and nothing overlaps what it isn't covering</p>
          </div>
        </div>
        <div className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-2">
          {ISOLATION_POINTS.map(([title, sub]) => (
            <div key={title} className="flex items-start gap-2 bg-slate-50 rounded-lg px-3 py-2.5">
              <CheckCircle2 size={12} className="text-emerald-500 flex-shrink-0 mt-0.5"/>
              <div className="min-w-0">
                <p className="text-[11px] font-semibold text-slate-700 leading-none">{title}</p>
                <p className="text-[10px] text-slate-400 mt-1 leading-snug">{sub}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Where to paste it ── */}
      <div className="bg-white border border-surface-border rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-surface-border">
          <p className="text-xs font-bold text-slate-900">Where do I paste it?</p>
          <p className="text-[10px] text-slate-400 mt-0.5">The code above never changes — only the file you paste it into does.</p>
        </div>

        <div className="flex flex-wrap gap-1.5 px-4 pt-3.5">
          {WC_WEB_TARGETS.map(x => (
            <button key={x.id} onClick={()=>setTarget(x.id)}
              className={clsx(
                'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-[11px] font-semibold transition-all',
                target===x.id
                  ? 'border-primary bg-primary/5 text-primary'
                  : 'border-surface-border text-slate-600 hover:border-primary/40 hover:bg-slate-50'
              )}>
              <span className="w-2 h-2 rounded-full flex-shrink-0" style={{background: x.color}}/>
              {x.label}
            </button>
          ))}
        </div>

        <div className="p-4">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">File</span>
            <code className="text-[11px] font-mono text-slate-700 bg-slate-100 px-2 py-1 rounded">{t.file}</code>
          </div>
          <ol className="space-y-2">
            {t.steps.map((s, i) => (
              <li key={i} className="flex items-start gap-2.5">
                <span className="w-4 h-4 rounded-full bg-primary/10 text-primary text-[9px] font-bold flex items-center justify-center flex-shrink-0 mt-0.5">
                  {i+1}
                </span>
                <p className="text-[12px] text-slate-600 leading-relaxed">{s}</p>
              </li>
            ))}
          </ol>
        </div>
      </div>

      {/* ── Mobile apps ── */}
      <div className="bg-white border border-surface-border rounded-xl overflow-hidden">
        <div className="flex items-center gap-3 px-4 py-3 border-b border-surface-border">
          <div className="w-8 h-8 rounded-lg bg-purple-50 flex items-center justify-center flex-shrink-0">
            <Smartphone size={15} className="text-purple-600"/>
          </div>
          <div>
            <p className="text-xs font-bold text-slate-900">Inside a mobile app?</p>
            <p className="text-[10px] text-slate-400 mt-0.5">A native app has no &lt;head&gt; — point a WebView at your hosted chat page instead</p>
          </div>
        </div>

        <div className="p-4 space-y-3">
          <WCCodeBlock code={chatUrl} lang="url" id="mobile-url" copied={copied} onCopy={copy}/>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {WC_MOBILE_TARGETS.map(m => (
              <div key={m.id} className="flex items-center gap-2.5 bg-slate-50 rounded-lg px-3 py-2.5">
                <span className="w-2 h-2 rounded-full flex-shrink-0" style={{background: m.color}}/>
                <div className="min-w-0 flex-1">
                  <p className="text-[11px] font-semibold text-slate-700 leading-none">{m.label}</p>
                  <p className="text-[10px] font-mono text-slate-400 mt-1 truncate">{m.detail}</p>
                </div>
                <span className={clsx('text-[9px] font-bold px-1.5 py-0.5 rounded flex-shrink-0',
                  m.builtIn ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-600')}>
                  {m.builtIn ? 'Built in' : 'Platform pkg'}
                </span>
              </div>
            ))}
          </div>

          <div className="flex gap-2.5 bg-slate-50 border border-surface-border rounded-lg p-3">
            <AlertCircle size={13} className="text-slate-400 flex-shrink-0 mt-0.5"/>
            <p className="text-[11px] text-slate-500 leading-relaxed">
              iOS and Android ship a WebView in the OS, so there is nothing to add. React Native and Flutter
              have no built-in WebView — those two need their own platform's standard WebView package, never a
              ChatFlow one.
            </p>
          </div>
        </div>
      </div>

      <ConnectionStatusCard/>
    </div>
  )
}

/* ─── Connection status / test install ──────────────────────────── */
function ConnectionStatusCard() {
  // 'idle' | 'checking' | 'connected' | 'not_found'
  const [status, setStatus] = useState('idle')
  const [lastChecked, setLastChecked] = useState(null)

  function runTest() {
    setStatus('checking')
    setTimeout(() => {
      setStatus('connected')
      setLastChecked(new Date())
    }, 1600)
  }

  const STATUS_CFG = {
    idle:      { bg:'bg-slate-50',   border:'border-surface-border', icon: Wifi,      iconColor:'text-slate-400', title:'Not tested yet',       sub:'Run a test to confirm the widget script is live on your site.' },
    checking:  { bg:'bg-primary/5',  border:'border-primary/20',     icon: Loader2,   iconColor:'text-primary',   title:'Checking your website…', sub:'Looking for the ChatFlow widget script and pinging the CDN.' },
    connected: { bg:'bg-emerald-50', border:'border-emerald-200',    icon: CheckCircle2, iconColor:'text-emerald-500', title:'Widget detected and active', sub:'Your website is loading the ChatFlow script correctly.' },
    not_found: { bg:'bg-red-50',     border:'border-red-200',        icon: AlertTriangle, iconColor:'text-red-500', title:'Widget not detected',  sub:"We couldn't find the script — double-check it's pasted inside <head> and the page has been redeployed." },
  }
  const cfg = STATUS_CFG[status]

  return (
    <div className="bg-white border border-surface-border rounded-xl overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-surface-border bg-slate-50">
        <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Connection Status</p>
        <button onClick={runTest} disabled={status==='checking'}
          className="flex items-center gap-1.5 text-[11px] font-semibold text-primary hover:text-primary-hover disabled:opacity-50 transition-colors">
          {status==='checking' ? <Loader2 size={12} className="animate-spin"/> : <RefreshCw size={12}/>}
          Test Connection
        </button>
      </div>
      <div className={clsx('p-4 flex items-start gap-3 transition-colors', cfg.bg)}>
        <div className={clsx('w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 bg-white border', cfg.border)}>
          <cfg.icon size={16} className={clsx(cfg.iconColor, status==='checking' && 'animate-spin')}/>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[12px] font-semibold text-slate-800">{cfg.title}</p>
          <p className="text-[11px] text-slate-500 mt-0.5">{cfg.sub}</p>
        </div>
      </div>
      {status === 'connected' && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-4 pt-0">
          <div className="bg-slate-50 rounded-xl px-3 py-2.5">
            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1">Domain Detected</p>
            <p className="text-[12px] font-semibold text-slate-800">yourwebsite.com</p>
          </div>
          <div className="bg-slate-50 rounded-xl px-3 py-2.5">
            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1">Script Location</p>
            <p className="text-[12px] font-semibold text-slate-800">&lt;head&gt;</p>
          </div>
          <div className="bg-slate-50 rounded-xl px-3 py-2.5">
            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1">Last Checked</p>
            <p className="text-[12px] font-semibold text-slate-800">{lastChecked ? lastChecked.toLocaleTimeString([], { hour:'2-digit', minute:'2-digit' }) : '—'}</p>
          </div>
        </div>
      )}
    </div>
  )
}

/* ─── Root ───────────────────────────────────────────────────────── */
export default function Installation() {
  const { activeProductId } = useApp()

  if (activeProductId === 'instagram') {
    return (
      <div className="space-y-5 animate-fade-in">
        <div className="bg-white border border-surface-border rounded-xl p-4">
          <InstagramConnectSection />
        </div>
      </div>
    )
  }

  if (activeProductId === 'webchat') {
    return (
      <div className="space-y-5 animate-fade-in">
        <div className="bg-white border border-surface-border rounded-xl p-4">
          <WebChatInstallSection />
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-5 animate-fade-in">

      {/* WhatsApp Number connection */}
      <div className="bg-white border border-surface-border rounded-xl p-4">
        <WhatsAppSection />
      </div>

      {/* Website Widget */}
      <div className="bg-white border border-surface-border rounded-xl p-4">
        <WidgetSection />
      </div>

    </div>
  )
}
