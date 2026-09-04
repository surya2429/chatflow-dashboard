import { useState, useMemo } from 'react'
import clsx from 'clsx'
import {
  Phone, PhoneIncoming, PhoneOutgoing, PhoneMissed,
  Settings, BarChart2, List, Search, Download,
  CheckCircle2, XCircle, AlertCircle, Bot, Sparkles,
  ArrowRight, GitBranch, Mic, Zap, Brain, Volume2,
  Activity, ChevronDown, ChevronRight, Plus, Trash2,
  Info, Gauge, MessageSquare, ToggleLeft,
} from 'lucide-react'
import { useCall } from '../context/CallContext'
import { NativeSelect } from '../components/Select'

// ─── Constants ────────────────────────────────────────────────────────────────

const BLOCKED_PREFIXES = ['+1', '+20', '+84', '+234'] // US, CA, EG, VN, NG

const COUNTRY_CODES = [
  { value: '+91',  label: '🇮🇳 IN +91'  },
  { value: '+1',   label: '🇺🇸 US +1'   },
  { value: '+44',  label: '🇬🇧 GB +44'  },
  { value: '+971', label: '🇦🇪 AE +971' },
  { value: '+65',  label: '🇸🇬 SG +65'  },
  { value: '+60',  label: '🇲🇾 MY +60'  },
  { value: '+61',  label: '🇦🇺 AU +61'  },
  { value: '+49',  label: '🇩🇪 DE +49'  },
  { value: '+33',  label: '🇫🇷 FR +33'  },
  { value: '+55',  label: '🇧🇷 BR +55'  },
  { value: '+52',  label: '🇲🇽 MX +52'  },
  { value: '+20',  label: '🇪🇬 EG +20'  },
  { value: '+84',  label: '🇻🇳 VN +84'  },
  { value: '+234', label: '🇳🇬 NG +234' },
]

const TIMEZONES = [
  'Asia/Kolkata', 'Asia/Dubai', 'Asia/Singapore', 'Asia/Tokyo',
  'Europe/London', 'Europe/Paris', 'America/New_York', 'America/Los_Angeles',
  'Australia/Sydney', 'UTC',
]

const MOCK_CONTACTS = [
  { id: 'c1', name: 'Priya Sharma',  phone: '+91 98765 43210', optIn: true  },
  { id: 'c2', name: 'Rahul Mehta',   phone: '+91 87654 32109', optIn: true  },
  { id: 'c3', name: 'Ananya Singh',  phone: '+91 76543 21098', optIn: false },
  { id: 'c4', name: 'Vikram Patel',  phone: '+91 65432 10987', optIn: true  },
  { id: 'c5', name: 'Meera Joshi',   phone: '+91 54321 09876', optIn: true  },
  { id: 'c6', name: 'Arjun Nair',    phone: '+91 43210 98765', optIn: false },
  { id: 'c7', name: 'Kavya Reddy',   phone: '+44 7700 900123', optIn: true  },
]

const MOCK_CALLS = [
  { id:'c1', direction:'inbound',  contact:'Priya Sharma',  phone:'+91 98765 43210', duration:142, status:'answered', agent:'Deepak K', time:'2 min ago'   },
  { id:'c2', direction:'outbound', contact:'Rahul Mehta',   phone:'+91 87654 32109', duration:0,   status:'missed',   agent:'—',        time:'18 min ago'  },
  { id:'c3', direction:'inbound',  contact:'Ananya Singh',  phone:'+91 76543 21098', duration:87,  status:'answered', agent:'Priya D',  time:'1 hour ago'  },
  { id:'c4', direction:'outbound', contact:'Vikram Patel',  phone:'+91 65432 10987', duration:0,   status:'failed',   agent:'Deepak K', time:'3 hours ago' },
  { id:'c5', direction:'inbound',  contact:'Meera Joshi',   phone:'+91 54321 09876', duration:304, status:'answered', agent:'Priya D',  time:'Yesterday'   },
  { id:'c6', direction:'outbound', contact:'Kavya Reddy',   phone:'+44 7700 900123', duration:210, status:'answered', agent:'Deepak K', time:'Yesterday'   },
  { id:'c7', direction:'inbound',  contact:'Arjun Nair',    phone:'+91 43210 98765', duration:0,   status:'missed',   agent:'—',        time:'2 days ago'  },
]

function fmtDuration(secs) {
  if (!secs) return '—'
  const m = Math.floor(secs / 60), s = secs % 60
  return m > 0 ? `${m}m ${s}s` : `${s}s`
}

// ─── Shared UI bits ───────────────────────────────────────────────────────────

function DirectionIcon({ direction, status }) {
  if (status === 'missed' || status === 'failed')
    return <PhoneMissed size={14} className="text-red-400" />
  if (direction === 'inbound')
    return <PhoneIncoming size={14} className="text-emerald-500" />
  return <PhoneOutgoing size={14} className="text-blue-500" />
}

function CallStatusBadge({ status }) {
  const cls = { answered:'badge-green', missed:'badge-amber', failed:'badge-red' }[status] || 'badge-gray'
  return <span className={`badge ${cls} capitalize`}>{status}</span>
}

function CallRow({ call, showNote }) {
  return (
    <tr className="table-row">
      <td className="table-cell">
        <div className="flex items-center gap-1.5">
          <DirectionIcon direction={call.direction} status={call.status} />
          <span className="capitalize text-xs text-slate-500">{call.direction}</span>
        </div>
      </td>
      <td className="table-cell">
        <p className="text-xs font-semibold text-slate-800">{call.contact}</p>
        <p className="text-[10px] font-mono text-slate-400">{call.phone}</p>
      </td>
      <td className="table-cell"><CallStatusBadge status={call.status} /></td>
      <td className="table-cell text-xs font-mono text-slate-600">{fmtDuration(call.duration)}</td>
      <td className="table-cell text-xs text-slate-500">{call.agent}</td>
      <td className="table-cell text-xs text-slate-400 whitespace-nowrap">{call.time}</td>
      {showNote && (
        <td className="table-cell">
          <button className="text-[10px] text-primary hover:underline">Add note</button>
        </td>
      )}
    </tr>
  )
}

// ─── Tab 1: Overview ──────────────────────────────────────────────────────────

function OverviewTab({ onTabChange }) {
  const answered    = MOCK_CALLS.filter(c => c.status === 'answered').length
  const missed      = MOCK_CALLS.filter(c => c.status === 'missed').length
  const withDur     = MOCK_CALLS.filter(c => c.duration)
  const avgDuration = withDur.length
    ? Math.round(withDur.reduce((a, c) => a + c.duration, 0) / withDur.length) : 0
  const answerRate  = Math.round((answered / MOCK_CALLS.length) * 100)

  const stats = [
    { label: 'Calls today',  value: MOCK_CALLS.length,         color: 'text-slate-800'   },
    { label: 'Answered',     value: answered,                   color: 'text-emerald-600' },
    { label: 'Missed',       value: missed,                     color: 'text-amber-600'   },
    { label: 'Avg duration', value: fmtDuration(avgDuration),   color: 'text-slate-800'   },
    { label: 'Answer rate',  value: `${answerRate}%`,           color: 'text-primary'     },
  ]

  return (
    <div className="space-y-5">
      {/* Stats strip */}
      <div className="card p-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-xs font-semibold text-slate-700">Calling enabled</span>
          </div>
          <button onClick={() => onTabChange('settings')} className="text-xs text-primary hover:underline">
            Configure settings →
          </button>
        </div>
        <div className="grid grid-cols-5 divide-x divide-surface-border">
          {stats.map(({ label, value, color }) => (
            <div key={label} className="px-4 first:pl-0 last:pr-0">
              <div className={clsx('text-xl font-bold tabular-nums', color)}>{value}</div>
              <div className="text-[10px] text-slate-400 mt-0.5">{label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Recent calls table */}
      <div className="bg-white rounded-xl border border-surface-border overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-surface-border">
          <h3 className="text-sm font-semibold text-slate-800">Recent calls</h3>
          <button onClick={() => onTabChange('logs')} className="text-xs text-primary hover:underline">
            View all →
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px]">
            <thead>
              <tr>
                <th className="table-header">Direction</th>
                <th className="table-header">Contact</th>
                <th className="table-header">Status</th>
                <th className="table-header">Duration</th>
                <th className="table-header">Agent</th>
                <th className="table-header">Time</th>
              </tr>
            </thead>
            <tbody>
              {MOCK_CALLS.slice(0, 5).map(c => <CallRow key={c.id} call={c} />)}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

// ─── Tab 2: Call Logs ─────────────────────────────────────────────────────────

function CallLogsTab() {
  const [search,    setSearch]    = useState('')
  const [direction, setDirection] = useState('all')
  const [status,    setStatus]    = useState('all')

  const filtered = useMemo(() => MOCK_CALLS.filter(c => {
    const q = search.toLowerCase()
    return (!q || c.contact.toLowerCase().includes(q) || c.phone.includes(q))
        && (direction === 'all' || c.direction === direction)
        && (status    === 'all' || c.status    === status)
  }), [search, direction, status])

  return (
    <div className="bg-white rounded-xl border border-surface-border overflow-hidden">
      {/* Filters */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-surface-border flex-wrap">
        <div className="relative">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input className="input text-xs pl-8 w-48" placeholder="Search contact or number…"
            value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <NativeSelect className="w-36" sm value={direction} onChange={e => setDirection(e.target.value)}>
          <option value="all">All directions</option>
          <option value="inbound">Inbound</option>
          <option value="outbound">Outbound</option>
        </NativeSelect>
        <NativeSelect className="w-32" sm value={status} onChange={e => setStatus(e.target.value)}>
          <option value="all">All status</option>
          <option value="answered">Answered</option>
          <option value="missed">Missed</option>
          <option value="failed">Failed</option>
        </NativeSelect>
        <button className="btn-secondary text-xs flex items-center gap-1.5 ml-auto">
          <Download size={12} /> Export CSV
        </button>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px]">
          <thead>
            <tr>
              <th className="table-header">Direction</th>
              <th className="table-header">Contact</th>
              <th className="table-header">Status</th>
              <th className="table-header">Duration</th>
              <th className="table-header">Agent</th>
              <th className="table-header">Time</th>
              <th className="table-header w-20" />
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr><td colSpan={7} className="py-12 text-center">
                <Phone size={24} className="text-slate-200 mx-auto mb-2" />
                <p className="text-sm text-slate-400">No calls found</p>
              </td></tr>
            ) : filtered.map(c => <CallRow key={c.id} call={c} showNote />)}
          </tbody>
        </table>
      </div>

      {filtered.length > 0 && (
        <div className="px-4 py-3 border-t border-surface-border">
          <p className="text-xs text-slate-400">{filtered.length} call{filtered.length !== 1 ? 's' : ''}</p>
        </div>
      )}
    </div>
  )
}

// ─── Tab 3: Make a Call ───────────────────────────────────────────────────────

function MakeCallTab() {
  const { initiateCall, activeCall } = useCall()
  const [mode,        setMode]    = useState('contact')
  const [selectedId,  setSelected]  = useState('')
  const [countryCode, setCountry]   = useState('+91')
  const [manualNum,   setManual]    = useState('')

  const selectedContact = MOCK_CONTACTS.find(c => c.id === selectedId)
  const manualFull      = `${countryCode}${manualNum.replace(/\s/g, '')}`

  const callTarget = mode === 'contact'
    ? selectedContact
    : manualNum ? { name: null, phone: manualFull, optIn: false } : null

  const isBlockedRegion = callTarget
    && BLOCKED_PREFIXES.some(p => callTarget.phone.replace(/\s/g, '').startsWith(p))
  const hasOptIn = !!callTarget?.optIn
  const canCall  = !!(callTarget && !isBlockedRegion && hasOptIn && !activeCall)

  return (
    <div className="max-w-xl space-y-4">
      {/* Mode toggle */}
      <div className="flex gap-1 bg-slate-100 p-1 rounded-xl w-full sm:w-fit flex-wrap sm:flex-nowrap">
        {[['contact','From contacts'],['manual','Manual number']].map(([v, l]) => (
          <button key={v} onClick={() => setMode(v)}
            className={clsx('px-4 py-1.5 text-xs font-semibold rounded-lg transition-all',
              mode === v ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700')}>
            {l}
          </button>
        ))}
      </div>

      <div className="card p-5 space-y-4">
        {mode === 'contact' ? (
          <div>
            <label className="text-xs font-semibold text-slate-700 block mb-1.5">Select contact</label>
            <NativeSelect value={selectedId} onChange={e => setSelected(e.target.value)}>
              <option value="">Choose a contact…</option>
              {MOCK_CONTACTS.map(c => (
                <option key={c.id} value={c.id}>{c.name} — {c.phone}</option>
              ))}
            </NativeSelect>
          </div>
        ) : (
          <div>
            <label className="text-xs font-semibold text-slate-700 block mb-1.5">Phone number</label>
            <div className="flex gap-2">
              <NativeSelect className="w-40 flex-shrink-0" value={countryCode} onChange={e => setCountry(e.target.value)}>
                {COUNTRY_CODES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
              </NativeSelect>
              <input className="input text-sm flex-1" placeholder="98765 43210"
                value={manualNum} onChange={e => setManual(e.target.value.replace(/[^0-9 ]/g, ''))} />
            </div>
          </div>
        )}

        {/* Status indicators */}
        {callTarget && (
          <div className="space-y-2">
            <div className={clsx('flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium',
              hasOptIn ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-600')}>
              {hasOptIn
                ? <><CheckCircle2 size={14} /> User has opted in for WhatsApp calls</>
                : <><XCircle size={14} /> No opt-in on record — collect consent before calling</>}
            </div>
            {isBlockedRegion && (
              <div className="flex items-start gap-2 px-3 py-2 rounded-lg text-xs font-medium bg-amber-50 text-amber-700">
                <AlertCircle size={14} className="flex-shrink-0 mt-0.5" />
                Business-initiated calls are not available in this region (US, CA, EG, VN, NG per Meta policy)
              </div>
            )}
            {activeCall && (
              <div className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium bg-blue-50 text-blue-600">
                <Phone size={14} /> A call is already in progress
              </div>
            )}
          </div>
        )}

        <button
          disabled={!canCall}
          onClick={() => canCall && initiateCall(callTarget)}
          className={clsx('btn-primary w-full flex items-center justify-center gap-2',
            !canCall && 'opacity-40 cursor-not-allowed')}
        >
          <Phone size={16} /> Start Call
        </button>
        <p className="text-[10px] text-slate-400 leading-relaxed">
          Business-initiated calls route through WhatsApp's RTC infrastructure via Meta Cloud API v25.0.
          Users must have explicit opt-in consent. PSTN bridging is not permitted.
        </p>
      </div>

      {/* Recent outbound */}
      <div className="card p-4">
        <h3 className="text-xs font-semibold text-slate-700 mb-3">Recent outbound</h3>
        <div className="space-y-2">
          {MOCK_CALLS.filter(c => c.direction === 'outbound').slice(0, 3).map(c => (
            <div key={c.id} className="flex items-center gap-3 py-1.5">
              <PhoneOutgoing size={13} className="text-blue-400 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-slate-700 truncate">{c.contact}</p>
                <p className="text-[10px] font-mono text-slate-400">{c.phone}</p>
              </div>
              <CallStatusBadge status={c.status} />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ─── AI Voice Agent Card ──────────────────────────────────────────────────────

const STT_PROVIDERS = {
  deepgram: {
    label: 'Deepgram', badge: 'Best for calls',
    models: [
      { value: 'nova-2-phonecall', label: 'Nova 2 Phone Call — optimised for telephony audio' },
      { value: 'nova-2',           label: 'Nova 2 — general purpose, high accuracy' },
      { value: 'nova-2-meeting',   label: 'Nova 2 Meeting — multi-speaker' },
      { value: 'enhanced',         label: 'Enhanced — legacy, stable' },
    ],
  },
  sarvam: {
    label: 'Sarvam AI', badge: '🇮🇳 Indian languages',
    models: [
      { value: 'saarika:v2',      label: 'Saarika v2 — best for Indian languages, 10 langs' },
      { value: 'saarika:v1',      label: 'Saarika v1 — stable, production-ready' },
      { value: 'saarika:flash',   label: 'Saarika Flash — ultra-low latency' },
    ],
  },
  elevenlabs: {
    label: 'ElevenLabs Scribe', badge: null,
    models: [
      { value: 'scribe_v1',       label: 'Scribe v1 — 99 languages, high accuracy' },
      { value: 'scribe_v1_flash', label: 'Scribe v1 Flash — real-time, low latency' },
    ],
  },
  openai: {
    label: 'OpenAI Whisper', badge: null,
    models: [
      { value: 'whisper-1',              label: 'Whisper 1 — multilingual, robust' },
      { value: 'gpt-4o-transcribe',      label: 'GPT-4o Transcribe — highest accuracy' },
      { value: 'gpt-4o-mini-transcribe', label: 'GPT-4o Mini Transcribe — fast & cheap' },
    ],
  },
  google: {
    label: 'Google Speech', badge: null,
    models: [
      { value: 'chirp',        label: 'Chirp — universal speech model' },
      { value: 'latest_long',  label: 'Latest Long — long-form audio' },
      { value: 'telephony',    label: 'Telephony — phone-optimised' },
    ],
  },
  azure: {
    label: 'Azure Speech', badge: null,
    models: [
      { value: 'azure-default', label: 'Azure Neural — 110+ languages' },
    ],
  },
  assemblyai: {
    label: 'AssemblyAI', badge: null,
    models: [
      { value: 'best', label: 'Best — highest accuracy' },
      { value: 'nano', label: 'Nano — ultra-low latency' },
    ],
  },
}

const LLM_PROVIDERS = {
  openai: {
    label: 'OpenAI', badge: 'Most popular',
    models: [
      { value: 'gpt-4o',           label: 'GPT-4o — best reasoning, native audio' },
      { value: 'gpt-4o-mini',      label: 'GPT-4o Mini — fast & cost-efficient' },
      { value: 'gpt-4-turbo',      label: 'GPT-4 Turbo — large context' },
    ],
  },
  sarvam: {
    label: 'Sarvam AI', badge: '🇮🇳 Indian languages',
    models: [
      { value: 'sarvam-2b',        label: 'Sarvam-2B — 10 Indian languages, low latency' },
      { value: 'sarvam-m',         label: 'Sarvam-M — multilingual, best accuracy' },
    ],
  },
  anthropic: {
    label: 'Anthropic', badge: null,
    models: [
      { value: 'claude-3-5-sonnet-20241022', label: 'Claude 3.5 Sonnet — best overall' },
      { value: 'claude-3-5-haiku-20241022',  label: 'Claude 3.5 Haiku — fastest' },
      { value: 'claude-3-opus-20240229',     label: 'Claude 3 Opus — most capable' },
    ],
  },
  google: {
    label: 'Google', badge: null,
    models: [
      { value: 'gemini-1.5-pro',   label: 'Gemini 1.5 Pro — 1M context' },
      { value: 'gemini-1.5-flash', label: 'Gemini 1.5 Flash — low latency' },
      { value: 'gemini-2.0-flash', label: 'Gemini 2.0 Flash — fastest' },
    ],
  },
  groq: {
    label: 'Groq', badge: 'Fastest inference',
    models: [
      { value: 'llama-3.3-70b-versatile', label: 'Llama 3.3 70B — ultra-fast' },
      { value: 'llama-3.1-8b-instant',    label: 'Llama 3.1 8B Instant — lowest latency' },
      { value: 'mixtral-8x7b-32768',      label: 'Mixtral 8x7B — multilingual' },
    ],
  },
  mistral: {
    label: 'Mistral', badge: null,
    models: [
      { value: 'mistral-large-latest', label: 'Mistral Large — top capability' },
      { value: 'mistral-small-latest', label: 'Mistral Small — cost-efficient' },
    ],
  },
}

const TTS_PROVIDERS = {
  sarvam: {
    label: 'Sarvam AI', badge: '🇮🇳 Indian languages',
    models: [
      { value: 'bulbul:v2', label: 'Bulbul v2 — 11 Indian languages, most natural' },
      { value: 'bulbul:v1', label: 'Bulbul v1 — stable, production-ready' },
    ],
    voices: [
      { value: 'anushka',  label: 'Anushka — warm, professional (Female)' },
      { value: 'vidya',    label: 'Vidya — clear, formal (Female)' },
      { value: 'arjun',    label: 'Arjun — deep, authoritative (Male)' },
      { value: 'abhijeet', label: 'Abhijeet — friendly, conversational (Male)' },
      { value: 'diya',     label: 'Diya — soft, empathetic (Female)' },
      { value: 'neel',     label: 'Neel — young, energetic (Male)' },
      { value: 'pavithra', label: 'Pavithra — neutral, precise (Female)' },
      { value: 'maitreyi', label: 'Maitreyi — expressive (Female)' },
    ],
  },
  elevenlabs: {
    label: 'ElevenLabs', badge: 'Most natural',
    models: [
      { value: 'eleven_multilingual_v2', label: 'Multilingual v2 — 29 languages, most realistic' },
      { value: 'eleven_turbo_v2_5',      label: 'Turbo v2.5 — ultra-low latency' },
      { value: 'eleven_flash_v2_5',      label: 'Flash v2.5 — fastest, ~75ms' },
    ],
    voices: [
      { value: 'rachel',   label: 'Rachel — calm, professional (Female)' },
      { value: 'adam',     label: 'Adam — deep, authoritative (Male)' },
      { value: 'aria',     label: 'Aria — warm, conversational (Female)' },
      { value: 'charlie',  label: 'Charlie — casual, friendly (Male)' },
      { value: 'domi',     label: 'Domi — confident, assertive (Female)' },
      { value: 'fin',      label: 'Fin — aged, wise (Male)' },
      { value: 'sarah',    label: 'Sarah — soft, empathetic (Female)' },
      { value: 'will',     label: 'Will — approachable, young (Male)' },
    ],
  },
  openai: {
    label: 'OpenAI TTS', badge: null,
    models: [
      { value: 'tts-1',    label: 'TTS-1 — optimised for real-time' },
      { value: 'tts-1-hd', label: 'TTS-1 HD — higher quality, more latency' },
    ],
    voices: [
      { value: 'alloy',   label: 'Alloy — neutral (Gender-neutral)' },
      { value: 'echo',    label: 'Echo — male' },
      { value: 'fable',   label: 'Fable — British, expressive' },
      { value: 'onyx',    label: 'Onyx — deep male' },
      { value: 'nova',    label: 'Nova — female, warm' },
      { value: 'shimmer', label: 'Shimmer — female, expressive' },
    ],
  },
  cartesia: {
    label: 'Cartesia', badge: 'Lowest latency',
    models: [
      { value: 'sonic-english',       label: 'Sonic English — ~90ms, English only' },
      { value: 'sonic-multilingual',  label: 'Sonic Multilingual — 20+ languages' },
    ],
    voices: [
      { value: 'friendly-female',      label: 'Friendly Female' },
      { value: 'professional-male',    label: 'Professional Male' },
      { value: 'calm-female',          label: 'Calm Female' },
      { value: 'energetic-male',       label: 'Energetic Male' },
    ],
  },
  google: {
    label: 'Google TTS', badge: null,
    models: [
      { value: 'neural2',  label: 'Neural2 — natural, high quality' },
      { value: 'wavenet',  label: 'WaveNet — expressive' },
      { value: 'standard', label: 'Standard — low latency' },
    ],
    voices: [
      { value: 'en-US-Neural2-F', label: 'US Female — Neural2' },
      { value: 'en-US-Neural2-D', label: 'US Male — Neural2' },
      { value: 'en-GB-Neural2-A', label: 'UK Female — Neural2' },
      { value: 'en-IN-Neural2-A', label: 'India Female — Neural2' },
    ],
  },
}

const PIPELINE_STEPS = [
  { key: 'caller',  label: 'Caller',  icon: Phone,    color: 'bg-slate-100 text-slate-600'  },
  { key: 'stt',     label: 'STT',     icon: Mic,      color: 'bg-blue-50 text-blue-600'     },
  { key: 'llm',     label: 'LLM',     icon: Brain,    color: 'bg-violet-50 text-violet-600' },
  { key: 'tts',     label: 'TTS',     icon: Volume2,  color: 'bg-emerald-50 text-emerald-600'},
]

function Section({ title, icon: Icon, color, open, onToggle, children }) {
  return (
    <div className="border border-surface-border rounded-xl overflow-hidden">
      <button type="button" onClick={onToggle}
        className="w-full flex items-center gap-3 px-4 py-3.5 bg-white hover:bg-slate-50/60 transition-colors">
        <div className={clsx('w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0', color)}>
          <Icon size={14} />
        </div>
        <span className="text-sm font-semibold text-slate-800 flex-1 text-left">{title}</span>
        {open ? <ChevronDown size={14} className="text-slate-400" /> : <ChevronRight size={14} className="text-slate-400" />}
      </button>
      {open && <div className="px-5 pb-5 pt-2 bg-white space-y-4 border-t border-surface-border">{children}</div>}
    </div>
  )
}

function ProviderModelSelect({ providers, providerVal, modelVal, onProvider, onModel }) {
  const provider = providers[providerVal]
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      <div>
        <label className="text-xs font-semibold text-slate-700 block mb-1.5">Provider</label>
        <NativeSelect value={providerVal} onChange={e => { onProvider(e.target.value); onModel(providers[e.target.value].models[0].value) }}>
          {Object.entries(providers).map(([k, p]) => (
            <option key={k} value={k}>{p.label}{p.badge ? ` ★` : ''}</option>
          ))}
        </NativeSelect>
        {provider.badge && (
          <span className="inline-block mt-1 text-[10px] font-semibold text-primary bg-primary-50 px-2 py-0.5 rounded-full">{provider.badge}</span>
        )}
      </div>
      <div>
        <label className="text-xs font-semibold text-slate-700 block mb-1.5">Model</label>
        <NativeSelect value={modelVal} onChange={e => onModel(e.target.value)}>
          {provider.models.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
        </NativeSelect>
      </div>
    </div>
  )
}

function AIAgentTab() {
  return (
    <div className="max-w-2xl">
      <AIVoiceAgentCard />
    </div>
  )
}

function AIVoiceAgentCard() {
  const [aiOn, setAiOn] = useState(false)
  const [open,  setOpen]  = useState({ stt: true, llm: true, tts: true, conv: false, fn: false })
  const toggle = key => setOpen(p => ({ ...p, [key]: !p[key] }))

  // STT
  const [sttProvider, setSttProvider] = useState('deepgram')
  const [sttModel,    setSttModel]    = useState('nova-2-phonecall')
  const [sttLang,     setSttLang]     = useState('en')
  const [sttPunct,    setSttPunct]    = useState(true)
  const [sttDisfluency, setSttDisfluency] = useState(true)

  // LLM
  const [llmProvider,   setLlmProvider]   = useState('openai')
  const [llmModel,      setLlmModel]      = useState('gpt-4o')
  const [llmTemp,       setLlmTemp]       = useState('0.7')
  const [llmMaxTokens,  setLlmMaxTokens]  = useState('200')
  const [systemPrompt,  setSystemPrompt]  = useState(
`You are a friendly and professional AI voice assistant for this business.

Your responsibilities:
- Greet the caller warmly by name if known
- Understand their query clearly — ask a clarifying question if needed
- Resolve common queries: hours, pricing, order status, appointments
- Transfer to a human agent when: caller requests it, query is complex, or after 3 failed attempts

Keep responses brief (1–2 sentences max). Speak naturally. Never read out URLs or long codes.`)
  const [firstMessage,  setFirstMessage]  = useState("Hello, thanks for calling! I'm your AI assistant. How can I help you today?")

  // TTS
  const [ttsProvider, setTtsProvider] = useState('sarvam')
  const [ttsModel,    setTtsModel]    = useState('bulbul:v2')
  const [ttsVoice,    setTtsVoice]    = useState('anushka')
  const [ttsSpeed,    setTtsSpeed]    = useState('1.0')
  const [ttsStability, setTtsStability] = useState('0.5')

  // Conversation / VAD
  const [aiMode,        setAiMode]        = useState('greet')
  const [vadSensitivity, setVadSensitivity] = useState('medium')
  const [silenceMs,     setSilenceMs]     = useState('600')
  const [interruptions, setInterruptions] = useState(true)
  const [fillerWords,   setFillerWords]   = useState(true)
  const [backchannels,  setBackchannels]  = useState(false)
  const [endpointingMs, setEndpointingMs] = useState('500')
  const [transferAfter, setTransferAfter] = useState('30')

  // Functions
  const [functions, setFunctions] = useState([
    { id: 1, name: 'transfer_to_agent',    desc: 'Hand off call to a live human agent',          enabled: true  },
    { id: 2, name: 'end_call',             desc: 'Politely end the call',                         enabled: true  },
    { id: 3, name: 'check_order_status',   desc: 'Look up order status by order ID',              enabled: false },
    { id: 4, name: 'book_appointment',     desc: 'Book a meeting slot in the calendar',           enabled: false },
    { id: 5, name: 'send_sms_followup',    desc: 'Send an SMS summary after the call',            enabled: false },
  ])

  const ttsVoices = TTS_PROVIDERS[ttsProvider]?.voices || []
  const isElevenLabs = ttsProvider === 'elevenlabs'
  const isSarvam = ttsProvider === 'sarvam'

  return (
    <div className="card overflow-hidden">
      {/* Header */}
      <div className="px-5 py-4 border-b border-surface-border">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-violet-50 flex items-center justify-center">
              <Sparkles size={16} className="text-violet-600" />
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-800">AI Voice Agent</p>
              <p className="text-xs text-slate-500 mt-0.5">Full STT → LLM → TTS pipeline for automated voice calls</p>
            </div>
          </div>
          <button type="button" onClick={() => setAiOn(p => !p)}
            className={clsx('w-11 h-6 rounded-full transition-colors relative flex-shrink-0', aiOn ? 'bg-violet-500' : 'bg-slate-200')}>
            <span className={clsx('absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-all', aiOn ? 'left-6' : 'left-1')} />
          </button>
        </div>

        {/* Pipeline diagram */}
        {aiOn && (
          <div className="mt-4 flex items-center gap-1.5 overflow-x-auto pb-1">
            {PIPELINE_STEPS.map((step, i) => (
              <div key={step.key} className="flex items-center gap-1.5 flex-shrink-0">
                <div className={clsx('flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold', step.color)}>
                  <step.icon size={12} />
                  {step.label}
                </div>
                {i < PIPELINE_STEPS.length - 1 && (
                  <ArrowRight size={12} className="text-slate-300" />
                )}
              </div>
            ))}
            <ArrowRight size={12} className="text-slate-300 flex-shrink-0" />
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-100 text-slate-600 flex-shrink-0">
              <Phone size={12} /> Caller
            </div>
            <div className="ml-3 flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-600 border border-emerald-100 flex-shrink-0">
              <Activity size={10} />
              {sttProvider.charAt(0).toUpperCase() + sttProvider.slice(1)} · {llmProvider === 'openai' ? 'OpenAI' : llmProvider.charAt(0).toUpperCase() + llmProvider.slice(1)} · {ttsProvider === 'elevenlabs' ? 'ElevenLabs' : ttsProvider.charAt(0).toUpperCase() + ttsProvider.slice(1)}
            </div>
          </div>
        )}
      </div>

      {!aiOn && (
        <div className="px-5 py-6 text-center">
          <Bot size={28} className="text-slate-200 mx-auto mb-2" />
          <p className="text-sm text-slate-400">Enable the AI Voice Agent to configure the full pipeline</p>
        </div>
      )}

      {aiOn && (
        <div className="p-4 space-y-3">

          {/* Agent mode */}
          <div className="flex gap-2 mb-1">
            {[
              { value:'greet', label:'Greet & transfer', desc:'AI collects context, then routes to a human' },
              { value:'full',  label:'Full automation',  desc:'AI handles the entire call end-to-end' },
            ].map(opt => (
              <button key={opt.value} type="button" onClick={() => setAiMode(opt.value)}
                className={clsx('flex-1 text-left px-4 py-3 rounded-xl border-2 transition-all',
                  aiMode === opt.value ? 'border-violet-500 bg-violet-50' : 'border-surface-border hover:border-slate-300')}>
                <p className={clsx('text-xs font-semibold', aiMode === opt.value ? 'text-violet-700' : 'text-slate-700')}>{opt.label}</p>
                <p className="text-[10px] text-slate-400 mt-0.5">{opt.desc}</p>
              </button>
            ))}
          </div>

          {/* ── STT ── */}
          <Section title="Speech-to-Text (STT)" icon={Mic} color="bg-blue-50 text-blue-600" open={open.stt} onToggle={() => toggle('stt')}>
            <ProviderModelSelect
              providers={STT_PROVIDERS}
              providerVal={sttProvider} modelVal={sttModel}
              onProvider={setSttProvider} onModel={setSttModel}
            />
            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1.5">Language</label>
              <NativeSelect className="w-48" value={sttLang} onChange={e => setSttLang(e.target.value)}>
                {[['en','English'],['hi','Hindi'],['ar','Arabic'],['es','Spanish'],['fr','French'],
                  ['de','German'],['pt','Portuguese'],['ta','Tamil'],['te','Telugu'],['ja','Japanese'],
                  ['zh','Chinese'],['ko','Korean']].map(([v,l]) => <option key={v} value={v}>{l}</option>)}
              </NativeSelect>
            </div>
            <div className="flex flex-wrap gap-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" className="accent-primary rounded" checked={sttPunct}
                  onChange={e => setSttPunct(e.target.checked)} />
                <span className="text-xs text-slate-600">Auto-punctuation</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" className="accent-primary rounded" checked={sttDisfluency}
                  onChange={e => setSttDisfluency(e.target.checked)} />
                <span className="text-xs text-slate-600">Remove disfluencies (um, uh…)</span>
              </label>
            </div>
            <div className="flex items-start gap-2 p-3 bg-blue-50 rounded-xl text-[11px] text-blue-700">
              <Info size={12} className="flex-shrink-0 mt-0.5" />
              <span>
                Use <strong>Deepgram Nova 2 Phone Call</strong> for English telephony (best WER on 8kHz audio).
                For <strong>Hindi, Tamil, Telugu, Kannada</strong> and other Indian languages, use <strong>Sarvam Saarika v2</strong> — purpose-built for Indian accents and code-switching (Hindi + English mixed).
              </span>
            </div>
          </Section>

          {/* ── LLM ── */}
          <Section title="Language Model (LLM)" icon={Brain} color="bg-violet-50 text-violet-600" open={open.llm} onToggle={() => toggle('llm')}>
            <ProviderModelSelect
              providers={LLM_PROVIDERS}
              providerVal={llmProvider} modelVal={llmModel}
              onProvider={setLlmProvider} onModel={setLlmModel}
            />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1.5">
                  Temperature <span className="text-slate-400 font-normal">({llmTemp})</span>
                </label>
                <input type="range" min="0" max="1" step="0.1" value={llmTemp}
                  onChange={e => setLlmTemp(e.target.value)}
                  className="w-full accent-violet-500" />
                <div className="flex justify-between text-[9px] text-slate-400 mt-0.5">
                  <span>Precise</span><span>Creative</span>
                </div>
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1.5">Max tokens per response</label>
                <NativeSelect value={llmMaxTokens} onChange={e => setLlmMaxTokens(e.target.value)}>
                  {['50','100','150','200','300','500'].map(v => <option key={v} value={v}>{v} tokens (~{Math.round(v * 0.75)} words)</option>)}
                </NativeSelect>
              </div>
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1.5">First message <span className="text-slate-400 font-normal">(spoken when call connects)</span></label>
              <input className="input text-sm" value={firstMessage} onChange={e => setFirstMessage(e.target.value)}
                placeholder="Hello, thanks for calling! How can I help you today?" />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1.5">System prompt</label>
              <textarea className="input text-xs font-mono resize-none leading-relaxed" rows={7}
                value={systemPrompt} onChange={e => setSystemPrompt(e.target.value)} />
              <p className="text-[10px] text-slate-400 mt-1">{systemPrompt.length} chars · Keep instructions concise — shorter prompts = faster responses</p>
            </div>
          </Section>

          {/* ── TTS ── */}
          <Section title="Text-to-Speech (TTS)" icon={Volume2} color="bg-emerald-50 text-emerald-600" open={open.tts} onToggle={() => toggle('tts')}>
            <ProviderModelSelect
              providers={TTS_PROVIDERS}
              providerVal={ttsProvider} modelVal={ttsModel}
              onProvider={setTtsProvider} onModel={setTtsModel}
            />
            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1.5">Voice</label>
              <NativeSelect value={ttsVoice} onChange={e => setTtsVoice(e.target.value)}>
                {ttsVoices.map(v => <option key={v.value} value={v.value}>{v.label}</option>)}
              </NativeSelect>
            </div>

            {/* Sarvam language picker */}
            {isSarvam && (
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1.5">Output language</label>
                <NativeSelect className="w-64">
                  {[['hi','Hindi'],['en','English'],['ta','Tamil'],['te','Telugu'],
                    ['kn','Kannada'],['ml','Malayalam'],['mr','Marathi'],['bn','Bengali'],
                    ['gu','Gujarati'],['pa','Punjabi'],['od','Odia']].map(([v,l]) => (
                    <option key={v} value={v}>{l}</option>
                  ))}
                </NativeSelect>
                <p className="text-[10px] text-slate-400 mt-1">Sarvam Bulbul supports 11 Indian languages with natural prosody and intonation.</p>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1.5">
                  Speed <span className="text-slate-400 font-normal">({ttsSpeed}x)</span>
                </label>
                <input type="range" min="0.7" max="1.3" step="0.05" value={ttsSpeed}
                  onChange={e => setTtsSpeed(e.target.value)} className="w-full accent-emerald-500" />
                <div className="flex justify-between text-[9px] text-slate-400 mt-0.5">
                  <span>Slow</span><span>Fast</span>
                </div>
              </div>
              {isElevenLabs && (
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1.5">
                    Stability <span className="text-slate-400 font-normal">({ttsStability})</span>
                  </label>
                  <input type="range" min="0" max="1" step="0.05" value={ttsStability}
                    onChange={e => setTtsStability(e.target.value)} className="w-full accent-emerald-500" />
                  <div className="flex justify-between text-[9px] text-slate-400 mt-0.5">
                    <span>Expressive</span><span>Stable</span>
                  </div>
                </div>
              )}
            </div>
          </Section>

          {/* ── Conversation / VAD ── */}
          <Section title="Conversation & VAD" icon={Activity} color="bg-amber-50 text-amber-600" open={open.conv} onToggle={() => toggle('conv')}>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1.5">VAD sensitivity</label>
                <NativeSelect value={vadSensitivity} onChange={e => setVadSensitivity(e.target.value)}>
                  <option value="low">Low — ignores background noise</option>
                  <option value="medium">Medium — balanced (recommended)</option>
                  <option value="high">High — very sensitive</option>
                </NativeSelect>
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1.5">Silence before AI speaks</label>
                <NativeSelect value={silenceMs} onChange={e => setSilenceMs(e.target.value)}>
                  {[['300','300ms — very fast'],['500','500ms — fast'],['600','600ms — natural'],['800','800ms — relaxed'],['1000','1000ms — slow']].map(([v,l]) => (
                    <option key={v} value={v}>{l}</option>
                  ))}
                </NativeSelect>
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1.5">Endpointing (turn detection)</label>
                <NativeSelect value={endpointingMs} onChange={e => setEndpointingMs(e.target.value)}>
                  {[['300','300ms'],['500','500ms (default)'],['700','700ms'],['1000','1000ms']].map(([v,l]) => (
                    <option key={v} value={v}>{l}</option>
                  ))}
                </NativeSelect>
              </div>
              {aiMode === 'greet' && (
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1.5">Transfer to human after</label>
                  <NativeSelect value={transferAfter} onChange={e => setTransferAfter(e.target.value)}>
                    {[['20','20s'],['30','30s'],['45','45s'],['60','60s'],['90','90s'],['0','Never (caller must request)']].map(([v,l]) => (
                      <option key={v} value={v}>{l}</option>
                    ))}
                  </NativeSelect>
                </div>
              )}
            </div>
            <div className="space-y-3 pt-2 border-t border-surface-border">
              {[
                { key: 'interruptions', val: interruptions, set: setInterruptions,
                  label: 'Allow interruptions', desc: 'Caller can interrupt AI mid-sentence (barge-in)' },
                { key: 'fillerWords', val: fillerWords, set: setFillerWords,
                  label: 'Filler words while thinking', desc: 'AI says "Let me check that…" during LLM processing to reduce dead air' },
                { key: 'backchannels', val: backchannels, set: setBackchannels,
                  label: 'Backchannels', desc: 'AI says "mm-hmm", "I see" while caller is speaking' },
              ].map(item => (
                <div key={item.key} className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-semibold text-slate-700">{item.label}</p>
                    <p className="text-[11px] text-slate-400">{item.desc}</p>
                  </div>
                  <button type="button" onClick={() => item.set(p => !p)}
                    className={clsx('w-9 h-5 rounded-full transition-colors relative flex-shrink-0',
                      item.val ? 'bg-amber-500' : 'bg-slate-200')}>
                    <span className={clsx('absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-all',
                      item.val ? 'left-4' : 'left-0.5')} />
                  </button>
                </div>
              ))}
            </div>
          </Section>

          {/* ── Functions / Tools ── */}
          <Section title="Functions & Tools" icon={Zap} color="bg-orange-50 text-orange-600" open={open.fn} onToggle={() => toggle('fn')}>
            <p className="text-xs text-slate-500 mb-3">Actions the AI can trigger during a call. The LLM decides when to call each function.</p>
            <div className="space-y-2">
              {functions.map(fn => (
                <div key={fn.id} className="flex items-center gap-3 p-3 rounded-xl border border-surface-border bg-slate-50/50">
                  <button type="button" onClick={() => setFunctions(prev => prev.map(f => f.id === fn.id ? { ...f, enabled: !f.enabled } : f))}
                    className={clsx('w-8 h-4 rounded-full transition-colors relative flex-shrink-0',
                      fn.enabled ? 'bg-orange-500' : 'bg-slate-200')}>
                    <span className={clsx('absolute top-0.5 w-3 h-3 bg-white rounded-full shadow transition-all',
                      fn.enabled ? 'left-4' : 'left-0.5')} />
                  </button>
                  <div className="flex-1 min-w-0">
                    <p className={clsx('text-xs font-mono font-semibold', fn.enabled ? 'text-slate-800' : 'text-slate-400')}>{fn.name}</p>
                    <p className="text-[10px] text-slate-400">{fn.desc}</p>
                  </div>
                </div>
              ))}
            </div>
            <div className="flex items-start gap-2 p-3 bg-orange-50 rounded-xl text-[11px] text-orange-700 mt-2">
              <Info size={12} className="flex-shrink-0 mt-0.5" />
              Functions are called via your backend webhook. Each enabled function must have a corresponding handler at your webhook URL.
            </div>
          </Section>

        </div>
      )}
    </div>
  )
}

// ─── Tab 4: Settings ──────────────────────────────────────────────────────────

function Toggle({ on, onChange }) {
  return (
    <button type="button" onClick={onChange} style={{
      width:34, height:18, borderRadius:9, border:'none', cursor:'pointer', position:'relative',
      background: on ? '#0066ff' : '#d1d5db', transition:'background 0.2s', padding:0, flexShrink:0,
    }}>
      <div style={{ position:'absolute', top:2, left: on ? 16 : 2, width:14, height:14, borderRadius:'50%',
        background:'#fff', transition:'left 0.2s', boxShadow:'0 1px 3px rgba(0,0,0,0.2)' }}/>
    </button>
  )
}

function Radio({ name, value, checked, onChange, label, desc, badge }) {
  return (
    <label className="flex items-start gap-3 cursor-pointer">
      <input type="radio" name={name} value={value} checked={checked}
        onChange={onChange} className="accent-primary mt-0.5 flex-shrink-0" />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="text-xs font-semibold text-slate-700">{label}</p>
          {badge && (
            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-primary text-white">{badge}</span>
          )}
        </div>
        <p className="text-[11px] text-slate-400 mt-0.5">{desc}</p>
      </div>
    </label>
  )
}

function SettingsTab() {
  // ── Calling on/off ──────────────────────────────────────────────────────────
  const [callingOn,   setCallingOn]   = useState(true)

  // ── Business hours ──────────────────────────────────────────────────────────
  const [hoursMode,   setHoursMode]   = useState('custom')
  const [timezone,    setTimezone]    = useState('Asia/Kolkata')
  const [hours, setHours] = useState([
    { day:'Monday',    on:true,  open:'09:00', close:'18:00' },
    { day:'Tuesday',   on:true,  open:'09:00', close:'18:00' },
    { day:'Wednesday', on:true,  open:'09:00', close:'18:00' },
    { day:'Thursday',  on:true,  open:'09:00', close:'18:00' },
    { day:'Friday',    on:true,  open:'09:00', close:'18:00' },
    { day:'Saturday',  on:false, open:'10:00', close:'14:00' },
    { day:'Sunday',    on:false, open:'10:00', close:'14:00' },
  ])
  function setHour(i, key, val) {
    setHours(prev => prev.map((h, idx) => idx === i ? { ...h, [key]: val } : h))
  }

  // ── Call routing ────────────────────────────────────────────────────────────
  const [routing,     setRouting]     = useState('chat_assigned') // 'chat_assigned' | 'roundrobin' | 'skills' | 'queue' | 'ai_first'
  const [noAnswerSec, setNoAnswerSec] = useState('25')
  const [noAnswerFallback, setNoAnswerFallback] = useState('callback') // 'callback' | 'ai' | 'message'
  const [fallbackMsg, setFallbackMsg] = useState("We missed your call. Want us to call you back?")

  // ── Audio codec ─────────────────────────────────────────────────────────────
  const [codec,       setCodec]       = useState('opus')

  // ── Missed call ─────────────────────────────────────────────────────────────
  const [missedMode,  setMissedMode]  = useState('callback')
  const [callbackMsg, setCallbackMsg] = useState("We missed your call. Want us to call you back?")

  // ── Save ────────────────────────────────────────────────────────────────────
  const [saving,      setSaving]      = useState(false)
  const [saved,       setSaved]       = useState(false)

  async function handleSave() {
    setSaving(true)
    const payload = {
      calling_config: {
        enabled: callingOn,
        business_hours: {
          mode: hoursMode === 'always' ? 'ALWAYS_OPEN' : 'CUSTOM',
          timezone,
          hours: hoursMode === 'always' ? [] : hours.filter(h => h.on).map(h => ({
            day_of_week: h.day.toUpperCase(), open: h.open, close: h.close,
          })),
        },
        routing: {
          primary: routing,
          no_answer_timeout_seconds: parseInt(noAnswerSec),
          no_answer_fallback: noAnswerFallback,
          fallback_message: fallbackMsg,
        },
        callback_request: { enabled: missedMode === 'callback', message: callbackMsg },
      },
    }
    console.log('[WhatsApp Calling API] PUT /{PHONE_NUMBER_ID}/settings', payload)
    await new Promise(r => setTimeout(r, 800))
    setSaving(false); setSaved(true)
    setTimeout(() => setSaved(false), 3000)
  }

  const SC = ({ title, subtitle, icon: Icon, children }) => (
    <div className="card overflow-hidden">
      <div className="px-5 py-4 border-b border-surface-border flex items-center gap-2.5">
        {Icon && <Icon size={15} className="text-slate-400 flex-shrink-0" />}
        <div>
          <p className="text-sm font-semibold text-slate-800">{title}</p>
          {subtitle && <p className="text-xs text-slate-500 mt-0.5">{subtitle}</p>}
        </div>
      </div>
      <div className="p-5">{children}</div>
    </div>
  )

  return (
    <div className="max-w-2xl space-y-5">

      {/* ── Enable calling ── */}
      <div className="card p-5 flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold text-slate-800">Enable WhatsApp Calling</p>
          <p className="text-xs text-slate-500 mt-0.5">Allow customers to call your business directly via WhatsApp</p>
        </div>
        <Toggle on={callingOn} onChange={() => setCallingOn(p => !p)} />
      </div>

      {/* ── Business hours ── */}
      <SC title="Business hours" subtitle="Control when customers can reach you via WhatsApp calls" icon={Settings}>
        <div className="space-y-5">
          <div className="flex gap-2">
            {[
              { value:'always', label:'🕐 Available all the time', desc:'Calls ring 24/7, any day' },
              { value:'custom', label:'📅 Custom schedule',        desc:'Set hours per day'        },
            ].map(opt => (
              <button key={opt.value} type="button" onClick={() => setHoursMode(opt.value)}
                className={clsx('flex-1 flex flex-col items-start px-4 py-3 rounded-xl border-2 text-left transition-all',
                  hoursMode === opt.value ? 'border-primary bg-primary-50' : 'border-surface-border bg-white hover:border-slate-300')}>
                <span className={clsx('text-xs font-semibold', hoursMode === opt.value ? 'text-primary' : 'text-slate-700')}>{opt.label}</span>
                <span className="text-[10px] text-slate-400 mt-0.5">{opt.desc}</span>
              </button>
            ))}
          </div>
          {hoursMode === 'always' && (
            <div className="flex items-center gap-2.5 px-4 py-3 bg-emerald-50 border border-emerald-100 rounded-xl">
              <span className="w-2 h-2 rounded-full bg-emerald-500 flex-shrink-0" />
              <p className="text-xs text-emerald-700 font-medium">Calls will ring to available agents at any hour, every day of the week.</p>
            </div>
          )}
          {hoursMode === 'custom' && (
            <div className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1.5">Timezone</label>
                <NativeSelect className="w-64" value={timezone} onChange={e => setTimezone(e.target.value)}>
                  {TIMEZONES.map(tz => <option key={tz} value={tz}>{tz}</option>)}
                </NativeSelect>
              </div>
              <div className="space-y-2">
                {hours.map((h, i) => (
                  <div key={h.day} className="flex items-center gap-3">
                    <button onClick={() => setHour(i, 'on', !h.on)}
                      className={clsx('w-8 h-4 rounded-full transition-colors relative flex-shrink-0', h.on ? 'bg-primary' : 'bg-slate-200')}>
                      <span className={clsx('absolute top-0.5 w-3 h-3 bg-white rounded-full shadow transition-all', h.on ? 'left-4' : 'left-0.5')} />
                    </button>
                    <span className={clsx('text-xs w-24 font-medium', h.on ? 'text-slate-700' : 'text-slate-400')}>{h.day}</span>
                    {h.on ? (
                      <div className="flex items-center gap-2">
                        <input type="time" className="input text-xs py-1 w-28" value={h.open} onChange={e => setHour(i, 'open', e.target.value)} />
                        <span className="text-xs text-slate-400">to</span>
                        <input type="time" className="input text-xs py-1 w-28" value={h.close} onChange={e => setHour(i, 'close', e.target.value)} />
                      </div>
                    ) : <span className="text-xs text-slate-300">Closed</span>}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </SC>

      {/* ── Call routing ── */}
      <SC title="Call routing" subtitle="Who receives the call and in what order — synced with your live chat assignment logic" icon={GitBranch}>
        <div className="space-y-5">

          {/* Primary routing */}
          <div className="space-y-2.5">
            <p className="text-xs font-semibold text-slate-700">Primary routing</p>

            {/* Chat-assigned — highlighted as recommended */}
            <label className={clsx(
              'flex items-start gap-3 p-3.5 rounded-xl border-2 cursor-pointer transition-all',
              routing === 'chat_assigned' ? 'border-primary bg-primary-50' : 'border-surface-border hover:border-slate-300'
            )}>
              <input type="radio" name="routing" value="chat_assigned"
                checked={routing === 'chat_assigned'} onChange={() => setRouting('chat_assigned')}
                className="accent-primary mt-0.5 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className={clsx('text-xs font-semibold', routing === 'chat_assigned' ? 'text-primary' : 'text-slate-700')}>
                    Follow chat assignment
                  </p>
                  <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-primary text-white">Recommended</span>
                </div>
                <p className="text-[11px] text-slate-400 mt-0.5 leading-relaxed">
                  Route the call to whichever agent is currently handling this contact's chat conversation.
                  Keeps the same person across chat and voice — no context switching.
                </p>
                {routing === 'chat_assigned' && (
                  <div className="mt-2.5 flex items-center gap-2 text-[10px] text-primary bg-white border border-primary/20 rounded-lg px-3 py-2">
                    <ArrowRight size={11} />
                    Chat agent → <span className="font-semibold">if unavailable</span> → fallback routing below
                  </div>
                )}
              </div>
            </label>

            {/* AI first */}
            <label className={clsx(
              'flex items-start gap-3 p-3.5 rounded-xl border-2 cursor-pointer transition-all',
              routing === 'ai_first' ? 'border-violet-500 bg-violet-50' : 'border-surface-border hover:border-slate-300'
            )}>
              <input type="radio" name="routing" value="ai_first"
                checked={routing === 'ai_first'} onChange={() => setRouting('ai_first')}
                className="accent-primary mt-0.5 flex-shrink-0" />
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <p className={clsx('text-xs font-semibold', routing === 'ai_first' ? 'text-violet-700' : 'text-slate-700')}>
                    AI agent first
                  </p>
                  <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-violet-100 text-violet-700">AI</span>
                  <span className="text-[9px] text-slate-400">Configure in AI Agent tab</span>
                </div>
                <p className="text-[11px] text-slate-400 mt-0.5">AI handles the call first, transfers to assigned chat agent or round-robin when ready</p>
              </div>
            </label>

            {/* Other routing options */}
            {[
              { value:'roundrobin', label:'Round-robin',  desc:'Distribute calls evenly across all available agents' },
              { value:'skills',     label:'Skills-based', desc:'Route by language, department, or expertise tag' },
              { value:'queue',      label:'Open queue',   desc:'All available agents see the call — first to answer gets it' },
            ].map(opt => (
              <label key={opt.value} className="flex items-start gap-3 cursor-pointer py-1">
                <input type="radio" name="routing" value={opt.value}
                  checked={routing === opt.value} onChange={() => setRouting(opt.value)}
                  className="accent-primary mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-xs font-semibold text-slate-700">{opt.label}</p>
                  <p className="text-[11px] text-slate-400">{opt.desc}</p>
                </div>
              </label>
            ))}
          </div>

          {/* Fallback routing (when chat_assigned and agent is busy/offline) */}
          {routing === 'chat_assigned' && (
            <div className="bg-slate-50 rounded-xl p-4 space-y-3 border border-surface-border">
              <p className="text-xs font-semibold text-slate-700">Fallback — if chat agent is unavailable</p>
              <div className="space-y-2">
                {[
                  { value:'roundrobin', label:'Round-robin to other agents' },
                  { value:'queue',      label:'Open queue — all agents ring' },
                  { value:'ai',         label:'Hand off to AI Voice Agent (see AI Agent tab)' },
                ].map(opt => (
                  <label key={opt.value} className="flex items-center gap-2.5 cursor-pointer">
                    <input type="radio" name="chatFallback" value={opt.value}
                      defaultChecked={opt.value === 'roundrobin'}
                      className="accent-primary flex-shrink-0" />
                    <span className="text-xs text-slate-600">{opt.label}</span>
                  </label>
                ))}
              </div>
            </div>
          )}

          {/* No-answer timeout */}
          <div className="pt-1 border-t border-surface-border space-y-3">
            <p className="text-xs font-semibold text-slate-700">If no agent answers within</p>
            <div className="flex items-center gap-3 flex-wrap">
              <NativeSelect className="w-36" value={noAnswerSec} onChange={e => setNoAnswerSec(e.target.value)}>
                {['15','20','25','30','45','60','90'].map(s => (
                  <option key={s} value={s}>{s} seconds</option>
                ))}
              </NativeSelect>
              <span className="text-xs text-slate-400">then:</span>
            </div>
            <div className="space-y-2">
              {[
                { value:'callback', label:'Send callback request',   desc:'Message the contact offering to call them back' },
                { value:'ai',       label:'Route to AI Voice Agent', desc:'AI takes over if all humans miss the call (configure in AI Agent tab)' },
                { value:'message',  label:'Send auto-message and end', desc:'Play a recorded message, then hang up' },
              ].map(opt => (
                <label key={opt.value} className="flex items-start gap-3 cursor-pointer">
                  <input type="radio" name="noAnswerFallback" value={opt.value}
                    checked={noAnswerFallback === opt.value} onChange={() => setNoAnswerFallback(opt.value)}
                    className="accent-primary mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-xs font-semibold text-slate-700">{opt.label}</p>
                    <p className="text-[11px] text-slate-400">{opt.desc}</p>
                  </div>
                </label>
              ))}
            </div>
            {noAnswerFallback === 'callback' && (
              <div className="pl-6">
                <label className="text-xs font-semibold text-slate-700 block mb-1.5">Callback message</label>
                <input className="input text-sm" value={fallbackMsg} onChange={e => setFallbackMsg(e.target.value)} />
              </div>
            )}
          </div>

        </div>
      </SC>

      {/* ── Audio codec ── */}
      <SC title="Audio codec" icon={Mic}>
        <div className="space-y-3">
          {[
            { value:'opus',      label:'Opus (recommended)', desc:'Best quality, lowest latency. Default for all WhatsApp calls.' },
            { value:'g711-pcmu', label:'G.711 PCMU',         desc:'For legacy telephony / PSTN gateways. Adds transcoding latency.' },
            { value:'g711-pcma', label:'G.711 PCMA',         desc:'For legacy telephony / PSTN gateways. Adds transcoding latency.' },
          ].map(opt => (
            <Radio key={opt.value} name="codec" value={opt.value}
              checked={codec === opt.value} onChange={() => setCodec(opt.value)}
              label={opt.label} desc={opt.desc} />
          ))}
          {codec !== 'opus' && (
            <div className="flex items-start gap-2 px-3 py-2 bg-amber-50 rounded-lg text-xs text-amber-700">
              <AlertCircle size={13} className="flex-shrink-0 mt-0.5" />
              G.711 requires server-side transcoding and adds latency. Use Opus unless you need legacy PSTN interop.
            </div>
          )}
        </div>
      </SC>

      {/* ── Save ── */}
      <div className="flex items-center gap-3 pb-4">
        <button onClick={handleSave} disabled={saving}
          className="btn-primary flex items-center gap-2 px-6">
          {saving ? 'Saving…' : saved ? '✓ Saved' : 'Save settings'}
        </button>
        {saved && <span className="text-xs text-emerald-600">Settings saved successfully</span>}
      </div>
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

const TABS = [
  { id:'overview', label:'Overview',    icon: BarChart2 },
  { id:'logs',     label:'Call Logs',   icon: List      },
  { id:'call',     label:'Make a Call', icon: Phone     },
  { id:'ai',       label:'AI Agent',    icon: Bot       },
  { id:'settings', label:'Settings',    icon: Settings  },
]

export default function Voice() {
  const [tab, setTab] = useState('overview')

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[15px] font-bold text-slate-900">Voice Calling</h1>
          <p className="text-[11px] text-slate-400 mt-0.5">WhatsApp Business Calling · Meta Cloud API v25.0</p>
        </div>
        <span className="flex items-center gap-1.5 text-xs font-semibold text-emerald-600 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-lg">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> Calling enabled
        </span>
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 bg-slate-100 p-1 rounded-xl overflow-x-auto flex-nowrap w-full sm:w-fit">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button key={id} onClick={() => setTab(id)}
            className={clsx(
              'flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-lg transition-all whitespace-nowrap',
              tab === id ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
            )}>
            <Icon size={13} />{label}
          </button>
        ))}
      </div>

      {tab === 'overview' && <OverviewTab onTabChange={setTab} />}
      {tab === 'logs'     && <CallLogsTab />}
      {tab === 'call'     && <MakeCallTab />}
      {tab === 'ai'       && <AIAgentTab />}
      {tab === 'settings' && <SettingsTab />}
    </div>
  )
}
