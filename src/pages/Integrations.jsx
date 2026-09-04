import { useState, useRef, useEffect } from 'react'
import {
  Search, CheckCircle2, Plus, X, Zap, Settings,
  ChevronDown, Eye, EyeOff, Pencil, Trash2,
  ToggleLeft, ToggleRight, ExternalLink,
  BarChart2, BookOpen, MessageSquare, AlertCircle,
  ChevronLeft, RefreshCw, Upload, Globe, AlertTriangle,
  Save, FileText, Database, Layers,
  Info, GitMerge, Clock, Pause, Play, Lock, Sparkles, Copy, Table, Mail,
} from 'lucide-react'
import {
  INTEGRATIONS, INTEGRATION_CATEGORIES, AI_PROVIDERS,
  CATEGORY_CONNECT_FIELDS, CATEGORY_TARGET_FIELDS,
} from '../constants/integrations'
import { SOURCE_FIELDS, SOURCE_FIELD_GROUPS } from '../constants/customFields'
import { CRM_MODULES, CRM_MODULE_FIELDS } from '../constants/crmModules'
import { MOCK_FLOWS, findFlowQuestion } from '../constants/mockFlows'
import clsx from 'clsx'
import { NativeSelect } from '../components/Select'
import { useAuth } from '../context/AuthContext'
import CrmTriggersSection from '../components/CrmTriggersSection'

/* ─── dummy data (KB_DATA / RESPONSES_DATA) ─────────────────────────────────────────────── */
const KB_DATA = [
  { id: 1, name: 'test_gen_1',     tuningType: 'web_url', model: 'gpt-4.1',           status: 'Published', active: true,  createdAt: '08 Jul 2026 12:03' },
  { id: 2, name: 'support_kb',     tuningType: 'web_url', model: 'gpt-4o',            status: 'Published', active: true,  createdAt: '12 Jul 2026 09:15' },
  { id: 3, name: 'product_faq',    tuningType: 'docs',    model: 'claude-3-5-sonnet', status: 'Draft',     active: false, createdAt: '15 Jul 2026 14:22' },
  { id: 4, name: 'onboarding_bot', tuningType: 'docs',    model: 'gemini-1.5-pro',    status: 'Published', active: true,  createdAt: '18 Jul 2026 11:08' },
  { id: 5, name: 'healthcare_qa',  tuningType: 'both',    model: 'gpt-4-turbo',       status: 'Published', active: false, createdAt: '22 Jul 2026 16:44' },
]

const RESPONSES_DATA = [
  { id: 1,  query: 'Book an appointment',         response: 'Absolutely, I can help you with that. To book an appointment for your daughter, could you please provide your preferred date and time, the type of consultation, and the patient\'s name?', tokens: 1822, cost: 0.004442, createdAt: '30 Jul 2026 14:12' },
  { id: 2,  query: '7 yrs and its been 3 days',   response: 'Thank you for sharing more details. Since your daughter is 7 years old and has had a fever for 3 days, this does warrant medical attention. Please visit our clinic at the earliest.', tokens: 1445, cost: 0.004234, createdAt: '30 Jul 2026 14:17' },
  { id: 3,  query: 'My daughter has a fever',     response: 'I\'m sorry to hear that your daughter isn\'t feeling well. Fever in children is quite common and usually a sign that the body is fighting an infection. A temperature above 38°C is considered fever.', tokens: 948,  cost: 0.002958, createdAt: '30 Jul 2026 14:16' },
  { id: 4,  query: 'What are your clinic hours',  response: 'Our clinic is open Monday to Saturday from 9:00 AM to 7:00 PM. We are closed on Sundays and public holidays. Walk-ins are welcome during working hours.', tokens: 612,  cost: 0.001836, createdAt: '29 Jul 2026 10:05' },
  { id: 5,  query: 'Is Dr. Sharma available',     response: 'Dr. Sharma is available on Tuesday, Thursday, and Saturday between 10 AM and 2 PM. Would you like me to check available slots for you?', tokens: 534,  cost: 0.001602, createdAt: '29 Jul 2026 11:42' },
  { id: 6,  query: 'How to reschedule my visit',  response: 'You can reschedule your appointment easily. Please provide your booking ID or registered phone number and I\'ll pull up your appointment details right away.', tokens: 720,  cost: 0.002160, createdAt: '28 Jul 2026 09:33' },
  { id: 7,  query: 'Cost of blood test panel',    response: 'A standard blood test panel costs Rs.850 and includes CBC, blood sugar, lipid profile, and liver function tests. Home collection is also available.', tokens: 883,  cost: 0.002649, createdAt: '28 Jul 2026 15:21' },
  { id: 8,  query: 'Can I get home collection',   response: 'Yes, we offer home sample collection within a 5 km radius. There\'s a convenience fee of Rs.150. Shall I book a home collection for you?', tokens: 658,  cost: 0.001974, createdAt: '27 Jul 2026 13:55' },
  { id: 9,  query: 'Paediatric specialist query', response: 'Our paediatric specialist Dr. Meera Nair is available on Monday, Wednesday, and Friday mornings. She specialises in child development and infectious diseases.', tokens: 741,  cost: 0.002223, createdAt: '27 Jul 2026 16:08' },
  { id: 10, query: 'Vaccination schedule info',   response: 'We follow the IAP vaccination guidelines. Your child\'s next vaccine depends on their age — please share their date of birth and I\'ll tell you exactly what\'s due.', tokens: 802,  cost: 0.002406, createdAt: '26 Jul 2026 10:44' },
]

/* ─── Provider nav structure (mirrors Settings SECTIONS/GROUPS) ─ */
const PROVIDER_GROUPS = ['Configuration', 'Data', 'Analytics']
const PROVIDER_SECTIONS = [
  { key: 'overview',   label: 'Overview',        icon: Settings,     group: 'Configuration' },
  { key: 'kb',         label: 'Knowledge Base',  icon: BookOpen,     group: 'Data'          },
  { key: 'responses',  label: 'Responses',        icon: MessageSquare,group: 'Data'          },
  { key: 'usage',      label: 'Usage & Billing', icon: BarChart2,    group: 'Analytics'     },
]

const SECTION_META = {
  overview:  { title: 'Overview',        desc: 'Manage connection credentials and active model.' },
  kb:        { title: 'Knowledge Base',  desc: 'Fine-tune your AI with documents, URLs, and Q&A pairs.' },
  responses: { title: 'Responses',       desc: 'View AI-generated responses, token usage, and cost history.' },
  usage:     { title: 'Usage & Billing', desc: 'Monthly token consumption and cost breakdown.' },
}

/* ─── KB Create Modal ─────────────────────────────────────────── */
const KB_TABS = [
  { id: 'web_url', label: 'URLs', icon: Globe,    sub: 'Train from web pages' },
  { id: 'docs',    label: 'Docs', icon: FileText, sub: 'Upload files'         },
  { id: 'both',    label: 'Both', icon: Layers,   sub: 'URLs + documents'     },
]

const CRAWL_MAX = 5, CRAWL_MIN = 2, BATCH_MAX = 50, DOC_MAX = 20
const INSTRUCTIONS_MAX = 1800
const DOC_TYPES = '.pdf,.doc,.docx,.txt,.csv,.md'
const MAX_DOC_MB = 25

const TEMP_STOPS = [
  { at: 0.0, label: 'Precise',  hint: 'Sticks to your source material. Best for support & FAQ.' },
  { at: 0.5, label: 'Balanced', hint: 'Mixes accuracy with natural phrasing. Good all-rounder.' },
  { at: 1.0, label: 'Creative', hint: 'More varied wording. May drift from sources.' },
]

function normaliseUrl(raw) {
  const s = (raw || '').trim()
  if (!s) return ''
  return /^https?:\/\//i.test(s) ? s : `https://${s}`
}

function isValidUrl(raw) {
  const s = (raw || '').trim()
  if (!s) return true                       // empty rows are not "invalid", just incomplete
  try {
    const u = new URL(normaliseUrl(s))
    return !!u.hostname && u.hostname.includes('.') && !/\s/.test(s)
  } catch { return false }
}

/* Split a pasted blob into candidate URLs — handles newline, comma, space & tab */
function splitPaste(text) {
  return text.split(/[\s,;]+/).map(s => s.trim()).filter(Boolean)
}

function KBCreateModal({ provider, onClose }) {
  const [tab,          setTab]          = useState('web_url')
  const [name,         setName]         = useState('')
  const [touchedName,  setTouchedName]  = useState(false)
  const [model,        setModel]        = useState(provider.models[0])
  const [temperature,  setTemperature]  = useState(0)
  const [webCrawling,  setWebCrawling]  = useState(false)
  const [instructions, setInstructions] = useState('')
  const [urls,         setUrls]         = useState([''])
  const [docs,         setDocs]         = useState([])
  const [bulkMode,     setBulkMode]     = useState(false)
  const [bulkText,     setBulkText]     = useState('')
  const [notice,       setNotice]       = useState(null)   // { kind, text }
  const [pendingOff,   setPendingOff]   = useState(false)  // confirm truncation dialog
  const [dragDoc,      setDragDoc]      = useState(false)
  const [submitted,    setSubmitted]    = useState(false)

  const fileRef   = useRef(null)
  const listRef   = useRef(null)
  const noticeRef = useRef(null)

  const showURL  = tab === 'web_url' || tab === 'both'
  const showDocs = tab === 'docs'    || tab === 'both'

  const URL_MAX = webCrawling ? CRAWL_MAX : BATCH_MAX
  const URL_MIN = webCrawling ? CRAWL_MIN : 1

  /* ── derived url state ─────────────────────────────────────── */
  const filled     = urls.filter(u => u.trim())
  const invalid    = urls.filter(u => u.trim() && !isValidUrl(u))
  const dupeSet    = (() => {
    const seen = new Set(), dupes = new Set()
    filled.forEach(u => {
      const k = normaliseUrl(u).replace(/\/+$/, '').toLowerCase()
      if (seen.has(k)) dupes.add(k); else seen.add(k)
    })
    return dupes
  })()
  const canAddUrl  = urls.length < URL_MAX
  const remaining  = URL_MAX - filled.length
  const atCapacity = filled.length >= URL_MAX

  /* ── validation ────────────────────────────────────────────── */
  const nameTrim  = name.trim()
  const nameTaken = KB_DATA.some(k => k.name.toLowerCase() === nameTrim.toLowerCase())
  const nameBad   = nameTrim && !/^[a-z0-9][a-z0-9_-]{1,39}$/i.test(nameTrim)
  const nameError = !nameTrim ? 'Name is required'
                  : nameBad   ? 'Use 2–40 letters, numbers, hyphens or underscores'
                  : nameTaken ? 'A knowledge base with this name already exists'
                  : null

  const urlError = !showURL ? null
    : invalid.length          ? `${invalid.length} URL${invalid.length > 1 ? 's are' : ' is'} not valid`
    : filled.length < URL_MIN ? (webCrawling
        ? `Web crawling needs at least ${CRAWL_MIN} starting URLs`
        : 'Add at least one URL')
    : null

  const docError = !showDocs ? null
    : (tab === 'docs' && docs.length === 0) ? 'Upload at least one document'
    : null

  const errors = [nameError, urlError, docError].filter(Boolean)
  const canSubmit = errors.length === 0

  /* ── auto-dismiss transient notices ────────────────────────── */
  useEffect(() => {
    if (!notice) return
    clearTimeout(noticeRef.current)
    noticeRef.current = setTimeout(() => setNotice(null), 5000)
    return () => clearTimeout(noticeRef.current)
  }, [notice])

  /* ── Esc to close ──────────────────────────────────────────── */
  useEffect(() => {
    function onKey(e) {
      if (e.key !== 'Escape') return
      if (pendingOff) { setPendingOff(false); return }
      onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose, pendingOff])

  /* ── url helpers ───────────────────────────────────────────── */
  function setUrl(i, v) { setUrls(u => u.map((x, j) => (j === i ? v : x))) }

  function addUrl() {
    if (!canAddUrl) return
    setUrls(u => [...u, ''])
    requestAnimationFrame(() => {
      const el = listRef.current
      if (el) el.scrollTop = el.scrollHeight
    })
  }

  function removeUrl(i) {
    setUrls(u => {
      const next = u.filter((_, j) => j !== i)
      while (next.length < URL_MIN) next.push('')
      return next.length ? next : ['']
    })
  }

  /* Merge a list of pasted URLs into the rows, respecting the cap */
  function mergeUrls(incoming, replaceIndex = null) {
    const clean = incoming.map(normaliseUrl).filter(Boolean)
    if (!clean.length) return

    const base = replaceIndex === null
      ? urls.filter(u => u.trim())
      : urls.map((u, i) => (i === replaceIndex ? '' : u)).filter(u => u.trim())

    const seen = new Set(base.map(u => normaliseUrl(u).replace(/\/+$/, '').toLowerCase()))
    let dupes = 0
    const added = []
    for (const u of clean) {
      const k = u.replace(/\/+$/, '').toLowerCase()
      if (seen.has(k)) { dupes++; continue }
      seen.add(k); added.push(u)
    }

    const room    = URL_MAX - base.length
    const kept    = added.slice(0, Math.max(0, room))
    const dropped = added.length - kept.length

    const next = [...base, ...kept]
    while (next.length < URL_MIN) next.push('')
    setUrls(next.length ? next : [''])

    const parts = []
    if (kept.length) parts.push(`Added ${kept.length} URL${kept.length > 1 ? 's' : ''}`)
    if (dupes)       parts.push(`skipped ${dupes} duplicate${dupes > 1 ? 's' : ''}`)
    if (dropped)     parts.push(`${dropped} didn't fit — save this batch, then retrain with the rest`)
    setNotice(parts.length ? { kind: dropped || dupes ? 'warn' : 'ok', text: parts.join(' · ') } : null)
  }

  function handleRowPaste(e, i) {
    const text = e.clipboardData.getData('text')
    const items = splitPaste(text)
    if (items.length < 2) return            // single URL → let the browser paste normally
    e.preventDefault()
    mergeUrls(items, i)
  }

  function applyBulk() {
    const items = splitPaste(bulkText)
    if (!items.length) { setNotice({ kind: 'warn', text: 'Nothing to add — paste some URLs first' }); return }
    mergeUrls(items)
    setBulkText('')
    setBulkMode(false)
  }

  function clearUrls() {
    setUrls(Array.from({ length: URL_MIN }, () => ''))
    setNotice({ kind: 'ok', text: 'Cleared all URLs' })
  }

  /* ── crawling toggle — never silently destroy data ─────────── */
  function requestToggleCrawling() {
    if (!webCrawling) {
      // turning ON → may need to drop rows beyond CRAWL_MAX
      if (filled.length > CRAWL_MAX) { setPendingOff(true); return }
      applyCrawling(true)
    } else {
      applyCrawling(false)
    }
  }

  function applyCrawling(on) {
    setWebCrawling(on)
    setPendingOff(false)
    setUrls(prev => {
      const kept = prev.filter(u => u.trim())
      const max  = on ? CRAWL_MAX : BATCH_MAX
      const min  = on ? CRAWL_MIN : 1
      const next = kept.slice(0, max)
      while (next.length < min) next.push('')
      return next.length ? next : ['']
    })
    if (on && filled.length > CRAWL_MAX) {
      setNotice({ kind: 'warn', text: `Kept the first ${CRAWL_MAX} URLs as crawl starting points` })
    }
  }

  /* ── documents ─────────────────────────────────────────────── */
  function addFiles(fileList) {
    const incoming = Array.from(fileList || [])
    if (!incoming.length) return

    const tooBig = [], badType = [], dupe = [], ok = []
    const exts = DOC_TYPES.split(',')
    for (const f of incoming) {
      const ext = '.' + f.name.split('.').pop().toLowerCase()
      if (!exts.includes(ext))                       { badType.push(f); continue }
      if (f.size > MAX_DOC_MB * 1024 * 1024)         { tooBig.push(f);  continue }
      if (docs.some(d => d.name === f.name && d.size === f.size)) { dupe.push(f); continue }
      ok.push(f)
    }

    const room    = DOC_MAX - docs.length
    const kept    = ok.slice(0, Math.max(0, room))
    const dropped = ok.length - kept.length

    if (kept.length) setDocs(d => [...d, ...kept])

    const parts = []
    if (kept.length)    parts.push(`Added ${kept.length} file${kept.length > 1 ? 's' : ''}`)
    if (dupe.length)    parts.push(`skipped ${dupe.length} already added`)
    if (badType.length) parts.push(`${badType.length} unsupported type`)
    if (tooBig.length)  parts.push(`${tooBig.length} over ${MAX_DOC_MB}MB`)
    if (dropped)        parts.push(`${dropped} over the ${DOC_MAX}-file limit`)
    if (parts.length) {
      const bad = badType.length || tooBig.length || dropped || dupe.length
      setNotice({ kind: bad ? 'warn' : 'ok', text: parts.join(' · ') })
    }
  }

  function removeDoc(i) { setDocs(d => d.filter((_, j) => j !== i)) }

  const totalDocMB = docs.reduce((s, f) => s + f.size, 0) / 1024 / 1024

  /* ── submit ────────────────────────────────────────────────── */
  function submit() {
    setSubmitted(true)
    setTouchedName(true)
    if (!canSubmit) return
    onClose()
  }

  const tempStop = TEMP_STOPS.reduce((best, s) =>
    Math.abs(s.at - temperature) < Math.abs(best.at - temperature) ? s : best, TEMP_STOPS[0])

  const showNameErr = (touchedName || submitted) && nameError

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-fade-in"
      onClick={e => e.target === e.currentTarget && onClose()}>

      <div className="bg-white w-full max-w-2xl rounded-2xl shadow-modal border border-surface-border
                      flex flex-col max-h-[88vh] animate-slide-up overflow-hidden">

        {/* ── Header ─────────────────────────────────────────── */}
        <div className="flex items-center gap-3 px-5 py-3.5 border-b border-surface-border flex-shrink-0">
          <div className="w-8 h-8 rounded-xl bg-primary-50 border border-primary-100 flex items-center justify-center flex-shrink-0">
            <Database size={14} className="text-primary"/>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[13px] font-bold text-slate-900 leading-snug">New Knowledge Base</p>
            <p className="text-[11px] text-slate-400 leading-snug truncate">
              Train {provider.name} on your own content
            </p>
          </div>
          <button onClick={onClose}
            className="p-1 rounded-lg hover:bg-surface-hover text-slate-400 hover:text-slate-600 transition-colors flex-shrink-0">
            <X size={14}/>
          </button>
        </div>

        {/* ── Source tabs ────────────────────────────────────── */}
        <div className="flex gap-2 px-5 py-3 bg-slate-50 border-b border-surface-border flex-shrink-0">
          {KB_TABS.map(t => {
            const TIcon  = t.icon
            const active = tab === t.id
            return (
              <button key={t.id} onClick={() => setTab(t.id)}
                className={clsx(
                  'flex-1 min-w-0 flex items-center justify-center sm:justify-start gap-1.5 sm:gap-2',
                  'px-2 sm:px-3 py-2 rounded-lg border text-left transition-all',
                  active
                    ? 'bg-white border-primary/40 shadow-btn ring-2 ring-primary/10'
                    : 'bg-white/60 border-surface-border hover:border-slate-300 hover:bg-white'
                )}>
                <TIcon size={13} className={clsx('flex-shrink-0', active ? 'text-primary' : 'text-slate-400')}/>
                <span className="min-w-0">
                  <span className={clsx('block text-[11px] font-semibold leading-tight truncate',
                    active ? 'text-primary' : 'text-slate-600')}>{t.label}</span>
                  <span className="hidden sm:block text-[10px] text-slate-400 leading-tight truncate">{t.sub}</span>
                </span>
              </button>
            )
          })}
        </div>

        {/* ── Body ───────────────────────────────────────────── */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">

          {/* Name + model */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="form-group">
              <label className="label">
                Name <span className="text-red-500">*</span>
              </label>
              <input type="text" value={name} autoFocus
                onChange={e => setName(e.target.value)}
                onBlur={() => setTouchedName(true)}
                placeholder="support_kb"
                className={clsx('input', showNameErr && 'border-red-300 focus:border-red-400 focus:ring-red-100')}/>
              <p className={clsx('text-[10px] mt-1 leading-snug', showNameErr ? 'text-red-500' : 'text-slate-400')}>
                {showNameErr || 'Letters, numbers, hyphens & underscores'}
              </p>
            </div>

            <div className="form-group">
              <label className="label">Model</label>
              <NativeSelect value={model} onChange={e => setModel(e.target.value)}>
                {provider.models.map(m => <option key={m} value={m}>{m}</option>)}
              </NativeSelect>
              <p className="text-[10px] text-slate-400 mt-1 leading-snug">Used to embed & answer from this data</p>
            </div>
          </div>

          {/* Temperature */}
          <div className="card p-3.5">
            <div className="flex items-center justify-between mb-2">
              <label className="label mb-0">Response style</label>
              <span className="badge badge-blue">{tempStop.label} · {temperature.toFixed(1)}</span>
            </div>
            <input type="range" min="0" max="1" step="0.1" value={temperature}
              onChange={e => setTemperature(parseFloat(e.target.value))}
              className="w-full h-1.5 rounded-full appearance-none cursor-pointer bg-slate-200
                         [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3.5
                         [&::-webkit-slider-thumb]:h-3.5 [&::-webkit-slider-thumb]:rounded-full
                         [&::-webkit-slider-thumb]:bg-primary [&::-webkit-slider-thumb]:cursor-pointer
                         [&::-webkit-slider-thumb]:shadow-btn"/>
            <div className="flex justify-between mt-1.5">
              {TEMP_STOPS.map(s => (
                <button key={s.label} onClick={() => setTemperature(s.at)}
                  className={clsx('text-[10px] font-medium transition-colors',
                    tempStop.label === s.label ? 'text-primary' : 'text-slate-400 hover:text-slate-600')}>
                  {s.label}
                </button>
              ))}
            </div>
            <p className="text-[10px] text-slate-400 mt-1.5 leading-snug">{tempStop.hint}</p>
          </div>

          {/* Instructions */}
          <div className="form-group">
            <label className="label">
              Instructions <span className="text-slate-400 font-normal">(optional)</span>
            </label>
            <textarea rows={5} value={instructions} maxLength={INSTRUCTIONS_MAX}
              onChange={e => setInstructions(e.target.value)}
              placeholder="e.g. Answer only in English. Never discuss pricing — route those to a human agent."
              className="textarea"/>
            <p className="text-[10px] text-slate-400 mt-1 text-right">{instructions.length}/{INSTRUCTIONS_MAX}</p>
          </div>

          {/* ── WEB SOURCES ─────────────────────────────────── */}
          {showURL && (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Web sources</span>
                <span className="flex-1 divider"/>
              </div>

              {/* Crawling toggle */}
              <button onClick={requestToggleCrawling}
                className={clsx('w-full flex items-start gap-3 p-3.5 rounded-xl border text-left transition-all',
                  webCrawling
                    ? 'bg-primary-50 border-primary/30'
                    : 'bg-white border-surface-border hover:border-slate-300')}>
                <div className={clsx('w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 border',
                  webCrawling ? 'bg-white border-primary/20' : 'bg-slate-50 border-surface-border')}>
                  <Globe size={14} className={webCrawling ? 'text-primary' : 'text-slate-400'}/>
                </div>
                <div className="flex-1 min-w-0">
                  <p className={clsx('text-[12px] font-semibold leading-snug',
                    webCrawling ? 'text-primary' : 'text-slate-700')}>Web crawling</p>
                  <p className="text-[10px] text-slate-500 mt-0.5 leading-snug">
                    {webCrawling
                      ? `On — give ${CRAWL_MIN}–${CRAWL_MAX} starting pages and we follow their links automatically.`
                      : `Off — we index exactly the URLs you list, up to ${BATCH_MAX} per batch.`}
                  </p>
                </div>
                <span className={clsx('w-9 h-5 rounded-full flex-shrink-0 mt-0.5 transition-colors relative',
                  webCrawling ? 'bg-primary' : 'bg-slate-300')}>
                  <span className={clsx('absolute top-0.5 w-4 h-4 rounded-full bg-white shadow-sm transition-all',
                    webCrawling ? 'left-[18px]' : 'left-0.5')}/>
                </span>
              </button>

              {/* URL toolbar */}
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-[11px] font-semibold text-slate-700">
                    {webCrawling ? 'Starting URLs' : 'URLs'}
                  </span>
                  <span className={clsx('badge', atCapacity ? 'badge-amber' : 'badge-gray')}>
                    {filled.length} / {URL_MAX}
                  </span>
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  {!webCrawling && (
                    <button onClick={() => setBulkMode(v => !v)}
                      className={clsx('btn-ghost !py-1 !px-2 !text-[10px]', bulkMode && 'bg-surface-hover text-primary')}>
                      <Layers size={10}/> Paste list
                    </button>
                  )}
                  {filled.length > 0 && (
                    <button onClick={clearUrls} className="btn-ghost !py-1 !px-2 !text-[10px] hover:!text-red-500">
                      <Trash2 size={10}/> Clear
                    </button>
                  )}
                </div>
              </div>

              {/* Bulk paste */}
              {bulkMode && !webCrawling && (
                <div className="card p-3 bg-slate-50 space-y-2">
                  <textarea rows={4} value={bulkText} onChange={e => setBulkText(e.target.value)}
                    placeholder={'https://example.com/pricing\nhttps://example.com/faq\nhttps://example.com/docs'}
                    className="textarea font-mono !text-[11px] bg-white"/>
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-[10px] text-slate-400 leading-snug">
                      One per line. Duplicates and anything past {BATCH_MAX} are skipped.
                    </p>
                    <div className="flex gap-1.5 flex-shrink-0">
                      <button onClick={() => { setBulkMode(false); setBulkText('') }} className="btn-secondary !py-1 !px-2.5 !text-[10px]">Cancel</button>
                      <button onClick={applyBulk} className="btn-primary !py-1 !px-2.5 !text-[10px]">
                        <Plus size={10}/> Add {splitPaste(bulkText).length || ''}
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* URL rows */}
              <div ref={listRef} className="space-y-1.5 max-h-56 overflow-y-auto pr-0.5">
                {urls.map((u, i) => {
                  const bad  = u.trim() && !isValidUrl(u)
                  const dupe = u.trim() && dupeSet.has(normaliseUrl(u).replace(/\/+$/, '').toLowerCase())
                  return (
                    <div key={i}>
                      <div className="flex items-center gap-2">
                        <span className="w-5 text-[10px] font-mono text-slate-300 text-right flex-shrink-0">{i + 1}</span>
                        <input type="url" value={u}
                          onChange={e => setUrl(i, e.target.value)}
                          onPaste={e => handleRowPaste(e, i)}
                          onKeyDown={e => {
                            if (e.key === 'Enter') { e.preventDefault(); addUrl() }
                            if (e.key === 'Backspace' && !u && urls.length > URL_MIN) { e.preventDefault(); removeUrl(i) }
                          }}
                          placeholder={webCrawling ? 'https://example.com' : 'https://example.com/page'}
                          className={clsx('input-sm flex-1 font-mono',
                            bad && 'border-red-300 focus:border-red-400 focus:ring-red-100',
                            dupe && !bad && 'border-amber-300 focus:border-amber-400 focus:ring-amber-100')}/>
                        <button onClick={() => removeUrl(i)}
                          disabled={urls.length <= URL_MIN && !u.trim()}
                          className="p-1 rounded-md text-slate-300 hover:text-red-500 hover:bg-red-50
                                     disabled:opacity-30 disabled:hover:text-slate-300 disabled:hover:bg-transparent
                                     transition-colors flex-shrink-0">
                          <X size={12}/>
                        </button>
                      </div>
                      {(bad || dupe) && (
                        <p className={clsx('text-[10px] mt-0.5 ml-7', bad ? 'text-red-500' : 'text-amber-600')}>
                          {bad ? 'Doesn\'t look like a valid URL' : 'Duplicate — it will only be indexed once'}
                        </p>
                      )}
                    </div>
                  )
                })}
              </div>

              {/* Add / capacity */}
              {canAddUrl ? (
                <button onClick={addUrl} className="btn-ghost !text-[11px] !text-primary hover:!bg-primary-50">
                  <Plus size={12}/> Add URL
                  <span className="text-slate-400 font-normal">· {remaining} left</span>
                </button>
              ) : (
                <div className={clsx('flex items-start gap-2 p-3 rounded-xl border',
                  webCrawling ? 'bg-primary-50 border-primary/20' : 'bg-amber-50 border-amber-200')}>
                  <AlertCircle size={13} className={clsx('flex-shrink-0 mt-px', webCrawling ? 'text-primary' : 'text-amber-600')}/>
                  <p className={clsx('text-[10px] leading-relaxed', webCrawling ? 'text-primary' : 'text-amber-700')}>
                    {webCrawling
                      ? `Maximum ${CRAWL_MAX} starting points. The crawler will discover the rest of the site from here.`
                      : `Batch full at ${BATCH_MAX} URLs. Create this knowledge base, then use Retrain to add the next ${BATCH_MAX} — repeat as many times as you need.`}
                  </p>
                </div>
              )}
            </div>
          )}

          {/* ── DOCUMENTS ───────────────────────────────────── */}
          {showDocs && (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Documents</span>
                <span className="flex-1 divider"/>
                {docs.length > 0 && (
                  <span className="badge badge-gray">{docs.length} / {DOC_MAX} · {totalDocMB.toFixed(1)} MB</span>
                )}
              </div>

              {docs.length < DOC_MAX && (
                <div
                  onDragOver={e => { e.preventDefault(); setDragDoc(true) }}
                  onDragLeave={() => setDragDoc(false)}
                  onDrop={e => { e.preventDefault(); setDragDoc(false); addFiles(e.dataTransfer.files) }}
                  onClick={() => fileRef.current?.click()}
                  className={clsx('border-2 border-dashed rounded-xl px-4 py-6 flex flex-col items-center justify-center cursor-pointer transition-colors',
                    dragDoc ? 'border-primary bg-primary-50' : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50')}>
                  <Upload size={20} className={clsx('mb-2', dragDoc ? 'text-primary' : 'text-slate-300')}/>
                  <p className="text-[12px] font-semibold text-slate-600">Drop files here</p>
                  <p className="text-[10px] text-slate-400 mt-0.5">or click to browse</p>
                  <p className="text-[10px] text-slate-400 mt-2">PDF, DOC, DOCX, TXT, CSV, MD · max {MAX_DOC_MB}MB each</p>
                  <input ref={fileRef} type="file" multiple accept={DOC_TYPES} className="hidden"
                    onChange={e => { addFiles(e.target.files); e.target.value = '' }}/>
                </div>
              )}

              {docs.length > 0 && (
                <div className="space-y-1.5 max-h-40 overflow-y-auto pr-0.5">
                  {docs.map((f, i) => (
                    <div key={i} className="flex items-center gap-2.5 px-3 py-2 rounded-lg bg-white border border-surface-border">
                      <FileText size={13} className="text-slate-400 flex-shrink-0"/>
                      <span className="flex-1 text-[11px] text-slate-700 truncate">{f.name}</span>
                      <span className="text-[10px] text-slate-400 flex-shrink-0">{(f.size / 1024 / 1024).toFixed(1)} MB</span>
                      <button onClick={() => removeDoc(i)}
                        className="p-0.5 rounded-md text-slate-300 hover:text-red-500 hover:bg-red-50 transition-colors flex-shrink-0">
                        <X size={11}/>
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {docs.length >= DOC_MAX && (
                <div className="flex items-start gap-2 p-3 rounded-xl bg-amber-50 border border-amber-200">
                  <AlertCircle size={13} className="text-amber-600 flex-shrink-0 mt-px"/>
                  <p className="text-[10px] text-amber-700 leading-relaxed">
                    Batch full at {DOC_MAX} documents. Create this knowledge base, then use Retrain to upload more.
                  </p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* ── Notice bar ─────────────────────────────────────── */}
        {notice && (
          <div className={clsx('flex items-start gap-2 px-5 py-2.5 border-t flex-shrink-0',
            notice.kind === 'warn' ? 'bg-amber-50 border-amber-200' : 'bg-emerald-50 border-emerald-200')}>
            {notice.kind === 'warn'
              ? <AlertTriangle size={12} className="text-amber-600 flex-shrink-0 mt-px"/>
              : <CheckCircle2  size={12} className="text-emerald-600 flex-shrink-0 mt-px"/>}
            <p className={clsx('text-[10px] leading-relaxed flex-1',
              notice.kind === 'warn' ? 'text-amber-700' : 'text-emerald-700')}>{notice.text}</p>
            <button onClick={() => setNotice(null)}
              className={clsx('flex-shrink-0', notice.kind === 'warn' ? 'text-amber-400' : 'text-emerald-400')}>
              <X size={11}/>
            </button>
          </div>
        )}

        {/* ── Footer ─────────────────────────────────────────── */}
        <div className="flex items-center justify-between gap-3 px-5 py-3 border-t border-surface-border bg-white flex-shrink-0">
          {submitted && errors.length ? (
            <p className="text-[10px] text-red-500 font-medium leading-snug min-w-0 flex-1">{errors[0]}</p>
          ) : (
            <p className="hidden sm:block text-[10px] text-slate-400 leading-snug min-w-0 flex-1">
              {showURL && !webCrawling
                ? `Up to ${BATCH_MAX} URLs now — retrain with another ${BATCH_MAX} anytime.`
                : showURL && webCrawling
                  ? `Crawler follows links from ${filled.length || CRAWL_MIN} starting page${filled.length === 1 ? '' : 's'} automatically.`
                  : `Up to ${DOC_MAX} documents per batch.`}
            </p>
          )}
          <div className="flex items-center gap-3 flex-shrink-0">
            <button onClick={onClose} className="text-[11px] font-semibold text-slate-500 hover:text-slate-700 transition-colors">Cancel</button>
            <button onClick={submit} disabled={submitted && !canSubmit}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary text-white text-[11px] font-semibold hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
              <Save size={11}/> Create
            </button>
          </div>
        </div>
      </div>

      {/* ── Truncation confirm ─────────────────────────────── */}
      {pendingOff && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm"
          onClick={e => e.target === e.currentTarget && setPendingOff(false)}>
          <div className="bg-white w-full max-w-sm rounded-2xl shadow-modal border border-surface-border p-5 animate-slide-up">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-xl bg-amber-50 border border-amber-100 flex items-center justify-center flex-shrink-0">
                <AlertTriangle size={14} className="text-amber-600"/>
              </div>
              <div className="min-w-0">
                <p className="text-[13px] font-bold text-slate-900">Turn on web crawling?</p>
                <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">
                  Crawling takes at most {CRAWL_MAX} starting URLs. You have {filled.length} —
                  the last {filled.length - CRAWL_MAX} will be removed.
                </p>
              </div>
            </div>
            <div className="flex justify-end items-center gap-3 mt-4">
              <button onClick={() => setPendingOff(false)} className="text-[11px] font-semibold text-slate-500 hover:text-slate-700 transition-colors">Keep my URLs</button>
              <button onClick={() => applyCrawling(true)}
                className="px-3 py-1.5 rounded-lg bg-primary text-white text-[11px] font-semibold hover:bg-primary/90 transition-colors">Turn on crawling</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function OverviewPanel({ provider }) {
  const [model,      setModel]      = useState(provider.models[0])
  const [fields,     setFields]     = useState({})
  const [showKeys,   setShowKeys]   = useState({})
  const [testing,    setTesting]    = useState(false)
  const [testResult, setTestResult] = useState(null)

  const inputStyle = {
    width:'100%', border:'1px solid #e2e8f0', borderRadius:8, padding:'7px 10px',
    fontSize:13, color:'#0f172a', outline:'none', boxSizing:'border-box', background:'#fff',
  }
  const labelStyle = { fontSize:12, fontWeight:600, color:'#374151', marginBottom:5, display:'block' }

  function runTest() {
    setTesting(true); setTestResult(null)
    setTimeout(() => { setTesting(false); setTestResult('ok') }, 1400)
  }

  return (
    <div style={{ maxWidth:560 }}>
      {/* status card */}
      <div style={{ display:'flex', alignItems:'center', gap:12, padding:'12px 16px',
        borderRadius:12, border:'1px solid #bbf7d0', background:'#f0fdf4', marginBottom:20 }}>
        <div style={{ width:32, height:32, borderRadius:8, background:'#dcfce7', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
          <CheckCircle2 size={16} style={{ color:'#16a34a' }}/>
        </div>
        <div style={{ flex:1 }}>
          <p style={{ fontSize:13, fontWeight:600, color:'#15803d', margin:0 }}>Connected &amp; Active</p>
          <p style={{ fontSize:11, color:'#22c55e', margin:'2px 0 0' }}>Last verified: Today at 09:41 AM</p>
        </div>
        <button onClick={runTest} disabled={testing} style={{ display:'flex', alignItems:'center', gap:5,
          fontSize:11, fontWeight:600, color:'#15803d', background:'#dcfce7', border:'none',
          borderRadius:6, padding:'5px 10px', cursor:'pointer' }}>
          <RefreshCw size={11} style={testing ? { animation:'spin 1s linear infinite' } : {}}/>
          {testing ? 'Testing…' : 'Test Connection'}
        </button>
      </div>

      {testResult === 'ok' && (
        <div style={{ display:'flex', alignItems:'center', gap:8, padding:'8px 12px', borderRadius:8,
          background:'#f0fdf4', border:'1px solid #bbf7d0', marginBottom:16, fontSize:12, color:'#15803d' }}>
          <CheckCircle2 size={13}/> API key is valid — connection test passed.
        </div>
      )}

      {/* model */}
      <div style={{ marginBottom:16 }}>
        <label style={labelStyle}>Active Model</label>
        <div style={{ position:'relative' }}>
          <select style={{ ...inputStyle, appearance:'none', paddingRight:28 }} value={model} onChange={e => setModel(e.target.value)}>
            {provider.models.map(m => <option key={m}>{m}</option>)}
          </select>
          <ChevronDown size={13} style={{ position:'absolute', right:10, top:'50%', transform:'translateY(-50%)', color:'#94a3b8', pointerEvents:'none' }}/>
        </div>
      </div>

      {/* fields */}
      {provider.fields.map(f => (
        <div key={f.key} style={{ marginBottom:16 }}>
          <label style={labelStyle}>
            {f.label} {f.optional && <span style={{ fontWeight:400, color:'#94a3b8', fontSize:11 }}>(optional)</span>}
          </label>
          <div style={{ position:'relative' }}>
            <input
              type={f.type === 'password' && !showKeys[f.key] ? 'password' : 'text'}
              style={{ ...inputStyle, paddingRight: f.type==='password' ? 36 : 10 }}
              placeholder={f.placeholder}
              value={fields[f.key] || ''}
              onChange={e => setFields(p => ({ ...p, [f.key]: e.target.value }))}
            />
            {f.type === 'password' && (
              <button type="button" onClick={() => setShowKeys(p => ({ ...p, [f.key]: !p[f.key] }))}
                style={{ position:'absolute', right:10, top:'50%', transform:'translateY(-50%)',
                  background:'none', border:'none', cursor:'pointer', color:'#94a3b8', padding:0, display:'flex' }}>
                {showKeys[f.key] ? <EyeOff size={14}/> : <Eye size={14}/>}
              </button>
            )}
          </div>
        </div>
      ))}

      <div style={{ display:'flex', gap:10, paddingTop:4, borderTop:'1px solid #e2e8f0', marginTop:8 }}>
        <button style={{ flex:1, background:'none', border:'1px solid #e2e8f0', borderRadius:8,
          padding:'7px 0', fontSize:12, fontWeight:600, color:'#ef4444', cursor:'pointer' }}>Disconnect</button>
        <button style={{ flex:1, background:'#0066ff', color:'#fff', border:'none', borderRadius:8,
          padding:'7px 0', fontWeight:600, fontSize:12, cursor:'pointer' }}>Save Changes</button>
      </div>
    </div>
  )
}

function KnowledgeBasePanel({ provider }) {
  const [search,   setSearch]   = useState('')
  const [toggles,  setToggles]  = useState(() => Object.fromEntries(KB_DATA.map(r => [r.id, r.active])))
  const [creating, setCreating] = useState(false)

  const filtered = KB_DATA.filter(r =>
    r.name.toLowerCase().includes(search.toLowerCase()) ||
    r.model.toLowerCase().includes(search.toLowerCase())
  )

  const typeIcon = t => t === 'web_url' ? <Globe size={11}/> : t === 'docs' ? <Upload size={11}/> : null

  return (
    <>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:16 }}>
        <div className="relative" style={{ flex:1, maxWidth:280, marginRight:12 }}>
          <Search size={13} style={{ position:'absolute', left:10, top:'50%', transform:'translateY(-50%)', color:'#94a3b8' }}/>
          <input style={{ width:'100%', border:'1px solid #e2e8f0', borderRadius:8, padding:'7px 10px 7px 30px',
            fontSize:12, color:'#0f172a', outline:'none', boxSizing:'border-box' }}
            placeholder="Search by name or model…"
            value={search} onChange={e => setSearch(e.target.value)}/>
        </div>
        <button onClick={() => setCreating(true)}
          style={{ display:'flex', alignItems:'center', gap:6, background:'#0066ff', color:'#fff',
            border:'none', borderRadius:8, padding:'7px 14px', fontSize:12, fontWeight:600, cursor:'pointer', flexShrink:0 }}>
          <Plus size={13}/> Create New
        </button>
      </div>

      <div style={{ border:'1px solid #e2e8f0', borderRadius:12, overflow:'hidden' }}>
        <table style={{ width:'100%', borderCollapse:'collapse' }}>
          <thead>
            <tr style={{ background:'#f8fafc', borderBottom:'1px solid #e2e8f0' }}>
              {['Name','Type','Model','Status','Active',''].map(h => (
                <th key={h} style={{ textAlign:'left', fontSize:10, fontWeight:700, color:'#94a3b8',
                  textTransform:'uppercase', letterSpacing:'0.05em', padding:'10px 14px' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map((row, i) => (
              <tr key={row.id} style={{ borderBottom: i < filtered.length-1 ? '1px solid #f1f5f9' : 'none' }}>
                <td style={{ padding:'12px 14px' }}>
                  <p style={{ fontSize:12, fontWeight:600, color:'#0066ff', margin:0 }}>{row.name}</p>
                  <p style={{ fontSize:10, color:'#94a3b8', margin:'2px 0 0' }}>{row.createdAt}</p>
                </td>
                <td style={{ padding:'12px 14px' }}>
                  <span style={{ display:'inline-flex', alignItems:'center', gap:4, fontSize:10, fontWeight:600,
                    color:'#d97706', background:'#fef3c7', border:'1px solid #fde68a',
                    padding:'2px 8px', borderRadius:20 }}>
                    {typeIcon(row.tuningType)}{row.tuningType}
                  </span>
                </td>
                <td style={{ padding:'12px 14px', fontSize:11, color:'#475569', maxWidth:120 }}>
                  <span style={{ display:'block', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{row.model}</span>
                </td>
                <td style={{ padding:'12px 14px' }}>
                  <span style={{ fontSize:10, fontWeight:600, padding:'2px 8px', borderRadius:20,
                    ...(row.status==='Published'
                      ? { background:'#f0fdf4', color:'#16a34a', border:'1px solid #bbf7d0' }
                      : { background:'#fffbeb', color:'#d97706', border:'1px solid #fde68a' }) }}>
                    {row.status}
                  </span>
                </td>
                <td style={{ padding:'12px 14px' }}>
                  <button onClick={() => setToggles(p => ({ ...p, [row.id]: !p[row.id] }))}
                    style={{ background:'none', border:'none', cursor:'pointer', padding:0, display:'flex' }}>
                    {toggles[row.id]
                      ? <ToggleRight size={20} style={{ color:'#0066ff' }}/>
                      : <ToggleLeft  size={20} style={{ color:'#cbd5e1' }}/>}
                  </button>
                </td>
                <td style={{ padding:'12px 14px' }}>
                  <div style={{ display:'flex', alignItems:'center', gap:4 }}>
                    <button style={{ background:'none', border:'none', cursor:'pointer', color:'#94a3b8',
                      padding:4, borderRadius:6, display:'flex' }}><Pencil size={12}/></button>
                    <button style={{ background:'none', border:'none', cursor:'pointer', color:'#94a3b8',
                      padding:4, borderRadius:6, display:'flex' }}><Trash2 size={12}/></button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {creating && <KBCreateModal provider={provider} onClose={() => setCreating(false)}/>}
    </>
  )
}

function ResponsesPanel() {
  const [search,   setSearch]   = useState('')
  const [expanded, setExpanded] = useState(null)

  const filtered    = RESPONSES_DATA.filter(r => r.query.toLowerCase().includes(search.toLowerCase()))
  const totalTokens = RESPONSES_DATA.reduce((s, r) => s + r.tokens, 0)
  const totalCost   = RESPONSES_DATA.reduce((s, r) => s + r.cost,   0)

  return (
    <>
      {/* stats */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:12, marginBottom:20 }}>
        {[
          { label:'Total Queries', value: RESPONSES_DATA.length,        color:'#0066ff'  },
          { label:'Total Tokens',  value: totalTokens.toLocaleString(), color:'#d97706'  },
          { label:'Total Cost',    value: `$${totalCost.toFixed(4)}`,   color:'#16a34a' },
        ].map(s => (
          <div key={s.label} style={{ border:'1px solid #e2e8f0', borderRadius:10, padding:'12px 16px', textAlign:'center' }}>
            <p style={{ fontSize:18, fontWeight:700, color:s.color, margin:0 }}>{s.value}</p>
            <p style={{ fontSize:11, color:'#94a3b8', margin:'3px 0 0' }}>{s.label}</p>
          </div>
        ))}
      </div>

      {/* toolbar */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:16 }}>
        <div style={{ position:'relative', flex:1, maxWidth:280, marginRight:12 }}>
          <Search size={13} style={{ position:'absolute', left:10, top:'50%', transform:'translateY(-50%)', color:'#94a3b8' }}/>
          <input style={{ width:'100%', border:'1px solid #e2e8f0', borderRadius:8, padding:'7px 10px 7px 30px',
            fontSize:12, color:'#0f172a', outline:'none', boxSizing:'border-box' }}
            placeholder="Search queries…"
            value={search} onChange={e => setSearch(e.target.value)}/>
        </div>
        <button style={{ display:'flex', alignItems:'center', gap:6, background:'none', border:'1px solid #e2e8f0',
          borderRadius:8, padding:'7px 14px', fontSize:12, fontWeight:600, color:'#475569', cursor:'pointer', flexShrink:0 }}>
          <ExternalLink size={12}/> Export CSV
        </button>
      </div>

      <div style={{ border:'1px solid #e2e8f0', borderRadius:12, overflow:'hidden' }}>
        <table style={{ width:'100%', borderCollapse:'collapse' }}>
          <thead>
            <tr style={{ background:'#f8fafc', borderBottom:'1px solid #e2e8f0' }}>
              {['Query','Tokens','Cost','Date'].map(h => (
                <th key={h} style={{ textAlign:'left', fontSize:10, fontWeight:700, color:'#94a3b8',
                  textTransform:'uppercase', letterSpacing:'0.05em', padding:'10px 14px' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map((row, i) => (
              <tr key={row.id} onClick={() => setExpanded(expanded===row.id ? null : row.id)}
                style={{ borderBottom: i < filtered.length-1 ? '1px solid #f1f5f9' : 'none', cursor:'pointer' }}>
                <td style={{ padding:'12px 14px', maxWidth:200 }}>
                  <p style={{ fontSize:12, fontWeight:600, color:'#0066ff', margin:0,
                    overflow:'hidden', textOverflow:'ellipsis', whiteSpace: expanded===row.id ? 'normal' : 'nowrap' }}>
                    {row.query}
                  </p>
                  {expanded===row.id && (
                    <p style={{ fontSize:11, color:'#64748b', margin:'6px 0 0', lineHeight:1.5 }}>{row.response}</p>
                  )}
                </td>
                <td style={{ padding:'12px 14px', fontSize:12, fontWeight:600, color:'#374151', verticalAlign:'top' }}>
                  {row.tokens.toLocaleString()}
                </td>
                <td style={{ padding:'12px 14px', fontSize:12, color:'#64748b', verticalAlign:'top' }}>
                  ${row.cost.toFixed(7)}
                </td>
                <td style={{ padding:'12px 14px', fontSize:11, color:'#94a3b8', whiteSpace:'nowrap', verticalAlign:'top' }}>
                  {row.createdAt}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  )
}

function UsagePanel({ provider }) {
  const stats = [
    { label:'API Calls (Jul)', value:'48,291', sub:'+12% from Jun', color:'#0066ff'  },
    { label:'Tokens Used',     value:'9.2M',   sub:'of 20M limit',  color:'#d97706'  },
    { label:'Spend (Jul)',     value:'$24.60',  sub:'of $50 budget', color:'#16a34a' },
    { label:'Avg Latency',     value:'320 ms',  sub:'per request',   color:'#8b5cf6' },
  ]

  return (
    <>
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, marginBottom:20 }}>
        {stats.map(s => (
          <div key={s.label} style={{ border:'1px solid #e2e8f0', borderRadius:12, padding:16 }}>
            <p style={{ fontSize:22, fontWeight:700, color:s.color, margin:0 }}>{s.value}</p>
            <p style={{ fontSize:12, fontWeight:600, color:'#374151', margin:'6px 0 2px' }}>{s.label}</p>
            <p style={{ fontSize:11, color:'#94a3b8', margin:0 }}>{s.sub}</p>
          </div>
        ))}
      </div>

      {[
        { label:'Token Budget',  used:'9.2M',  total:'20M',   pct:46, color:'#0066ff' },
        { label:'Monthly Spend', used:'$24.60', total:'$50.00',pct:49, color:'#16a34a' },
      ].map(b => (
        <div key={b.label} style={{ border:'1px solid #e2e8f0', borderRadius:12, padding:16, marginBottom:12 }}>
          <div style={{ display:'flex', justifyContent:'space-between', fontSize:12, marginBottom:8 }}>
            <span style={{ fontWeight:600, color:'#374151' }}>{b.label}</span>
            <span style={{ color:'#64748b' }}>{b.used} / {b.total}</span>
          </div>
          <div style={{ height:8, borderRadius:4, background:'#f1f5f9', overflow:'hidden' }}>
            <div style={{ height:'100%', width:`${b.pct}%`, borderRadius:4, background:b.color, transition:'width 0.5s' }}/>
          </div>
          <div style={{ display:'flex', justifyContent:'space-between', fontSize:10, color:'#94a3b8', marginTop:6 }}>
            <span>{b.pct}% used</span>
          </div>
        </div>
      ))}

      <div style={{ display:'flex', alignItems:'flex-start', gap:10, padding:'12px 14px',
        border:'1px solid #fde68a', borderRadius:10, background:'#fffbeb' }}>
        <AlertCircle size={15} style={{ color:'#f59e0b', marginTop:1, flexShrink:0 }}/>
        <div>
          <p style={{ fontSize:12, fontWeight:600, color:'#92400e', margin:0 }}>Budget alert enabled at 80%</p>
          <p style={{ fontSize:11, color:'#b45309', margin:'3px 0 0' }}>You'll receive an email when spend reaches $40.00.</p>
        </div>
      </div>
    </>
  )
}

/* ─── Provider detail view — exact Settings layout pattern ───── */
function ProviderDetailView({ provider, onBack }) {
  const [section, setSection] = useState('overview')

  const groupedSections = PROVIDER_GROUPS.reduce((acc, g) => {
    acc[g] = PROVIDER_SECTIONS.filter(s => s.group === g)
    return acc
  }, {})

  const meta = SECTION_META[section]

  return (
    <div className="flex flex-col md:flex-row md:h-screen md:-m-5 overflow-hidden">

      {/* ── Left sidebar — exact Settings pattern ── */}
      <div className="md:w-52 flex-shrink-0 border-b md:border-b-0 md:border-r border-surface-border bg-white flex flex-col overflow-hidden">

        {/* back + provider identity */}
        <div style={{ padding:'12px 12px 0', borderBottom:'1px solid #e2e8f0' }}>
          <button onClick={onBack}
            className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-primary transition-colors font-medium mb-3">
            <ChevronLeft size={13}/> Back to Integrations
          </button>
          <div style={{ display:'flex', alignItems:'center', gap:10, paddingBottom:12 }}>
            <div style={{ width:36, height:36, borderRadius:10, display:'flex', alignItems:'center',
              justifyContent:'center', fontSize:18, flexShrink:0,
              background:`${provider.color}18`, border:`1px solid ${provider.color}28` }}>
              {provider.icon}
            </div>
            <div style={{ minWidth:0 }}>
              <p style={{ fontSize:13, fontWeight:700, color:'#0f172a', margin:0, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{provider.name}</p>
              <div style={{ display:'flex', alignItems:'center', gap:5, marginTop:2 }}>
                <span style={{ width:6, height:6, borderRadius:'50%', background:'#22c55e', flexShrink:0 }}/>
                <span style={{ fontSize:11, fontWeight:500, color:'#16a34a' }}>Connected</span>
              </div>
            </div>
          </div>
        </div>

        {/* grouped nav — exact Settings structure */}
        <div className="overflow-y-auto flex-1 py-2">
          {PROVIDER_GROUPS.map(group => (
            <div key={group} style={{ padding:'0 8px', marginBottom:4 }}>
              <div style={{ padding:'6px 8px 3px' }}>
                <span style={{ fontSize:10, fontWeight:700, color:'#94a3b8', textTransform:'uppercase', letterSpacing:'0.08em' }}>
                  {group}
                </span>
              </div>
              {groupedSections[group].map(sec => {
                const Icon = sec.icon
                const isActive = section === sec.key
                return (
                  <button key={sec.key} onClick={() => setSection(sec.key)}
                    className={clsx(
                      'w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs font-medium transition-colors text-left',
                      isActive ? 'bg-primary-50 text-primary font-semibold' : 'text-slate-600 hover:bg-surface-hover'
                    )}>
                    <Icon size={13} className="flex-shrink-0"/>
                    <span className="truncate">{sec.label}</span>
                  </button>
                )
              })}
            </div>
          ))}
        </div>
      </div>

      {/* ── Right content — exact Settings pattern ── */}
      <div className="flex-1 overflow-y-auto bg-white p-4 md:p-5">
        {/* page title — Settings SectionHeader style */}
        <div style={{ marginBottom:14 }}>
          <h2 style={{ fontSize:14, fontWeight:700, color:'#0f172a', margin:0 }}>{meta.title}</h2>
          <p style={{ fontSize:11, color:'#64748b', margin:'3px 0 0' }}>{meta.desc}</p>
        </div>

        {section === 'overview'  && <OverviewPanel      provider={provider}/>}
        {section === 'kb'        && <KnowledgeBasePanel provider={provider}/>}
        {section === 'responses' && <ResponsesPanel/>}
        {section === 'usage'     && <UsagePanel         provider={provider}/>}
      </div>
    </div>
  )
}

/* ─── Connect modal (unconnected AI providers) ───────────────── */
function AIConnectModal({ provider, onClose }) {
  const [fields,   setFields]   = useState({})
  const [model,    setModel]    = useState(provider.models[0])
  const [showKeys, setShowKeys] = useState({})
  const [loading,  setLoading]  = useState(false)
  const [done,     setDone]     = useState(false)

  const inputStyle = {
    width:'100%', border:'1px solid #e2e8f0', borderRadius:8, padding:'7px 10px',
    fontSize:13, color:'#0f172a', outline:'none', boxSizing:'border-box',
  }

  function handleConnect() {
    setLoading(true)
    setTimeout(() => { setLoading(false); setDone(true) }, 1400)
  }

  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(15,23,42,0.4)', display:'flex',
      alignItems:'center', justifyContent:'center', zIndex:9999, padding:16 }}>
      <div style={{ background:'#fff', borderRadius:16, width:420, maxWidth:'100%',
        boxShadow:'0 24px 80px rgba(0,0,0,0.22)', overflow:'hidden' }}>

        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between',
          padding:'14px 20px', borderBottom:'1px solid #e2e8f0' }}>
          <div style={{ display:'flex', alignItems:'center', gap:10 }}>
            <div style={{ width:36, height:36, borderRadius:10, display:'flex', alignItems:'center',
              justifyContent:'center', fontSize:18, background:`${provider.color}18`, flexShrink:0 }}>
              {provider.icon}
            </div>
            <div>
              <p style={{ fontSize:13, fontWeight:700, color:'#0f172a', margin:0 }}>Connect {provider.name}</p>
              <p style={{ fontSize:11, color:'#94a3b8', margin:'2px 0 0' }}>{provider.tagline}</p>
            </div>
          </div>
          <button onClick={onClose} style={{ background:'none', border:'none', cursor:'pointer', color:'#64748b', padding:4, display:'flex' }}>
            <X size={16}/>
          </button>
        </div>

        {done ? (
          <div style={{ padding:32, textAlign:'center' }}>
            <div style={{ width:56, height:56, borderRadius:'50%', background:'#f0fdf4', display:'flex',
              alignItems:'center', justifyContent:'center', margin:'0 auto 12px' }}>
              <CheckCircle2 size={28} style={{ color:'#22c55e' }}/>
            </div>
            <p style={{ fontSize:14, fontWeight:700, color:'#0f172a', margin:'0 0 6px' }}>Successfully connected!</p>
            <p style={{ fontSize:12, color:'#64748b', margin:'0 0 16px', lineHeight:1.6 }}>
              {provider.name} is now active. Click <strong>Manage</strong> on the provider card to configure Knowledge Base and Responses.
            </p>
            <button onClick={onClose} style={{ background:'#0066ff', color:'#fff', border:'none', borderRadius:8,
              padding:'8px 24px', fontWeight:600, fontSize:12, cursor:'pointer' }}>Done</button>
          </div>
        ) : (
          <>
            <div style={{ padding:20 }}>
              <div style={{ marginBottom:14 }}>
                <label style={{ fontSize:12, fontWeight:600, color:'#374151', display:'block', marginBottom:5 }}>Model</label>
                <div style={{ position:'relative' }}>
                  <select style={{ ...inputStyle, appearance:'none', paddingRight:28 }} value={model} onChange={e=>setModel(e.target.value)}>
                    {provider.models.map(m => <option key={m}>{m}</option>)}
                  </select>
                  <ChevronDown size={13} style={{ position:'absolute', right:10, top:'50%', transform:'translateY(-50%)', color:'#94a3b8', pointerEvents:'none' }}/>
                </div>
              </div>
              {provider.fields.map(f => (
                <div key={f.key} style={{ marginBottom:14 }}>
                  <label style={{ fontSize:12, fontWeight:600, color:'#374151', display:'block', marginBottom:5 }}>
                    {f.label} {f.optional && <span style={{ fontWeight:400, color:'#94a3b8' }}>(optional)</span>}
                  </label>
                  <div style={{ position:'relative' }}>
                    <input type={f.type==='password' && !showKeys[f.key] ? 'password' : 'text'}
                      style={{ ...inputStyle, paddingRight: f.type==='password' ? 36 : 10 }}
                      placeholder={f.placeholder} value={fields[f.key]||''}
                      onChange={e=>setFields(p=>({...p,[f.key]:e.target.value}))}/>
                    {f.type==='password' && (
                      <button type="button" onClick={()=>setShowKeys(p=>({...p,[f.key]:!p[f.key]}))}
                        style={{ position:'absolute', right:10, top:'50%', transform:'translateY(-50%)',
                          background:'none', border:'none', cursor:'pointer', color:'#94a3b8', padding:0, display:'flex' }}>
                        {showKeys[f.key] ? <EyeOff size={14}/> : <Eye size={14}/>}
                      </button>
                    )}
                  </div>
                </div>
              ))}
              {provider.oauth && (
                <button style={{ width:'100%', display:'flex', alignItems:'center', justifyContent:'center', gap:8,
                  padding:'8px 16px', background:'#fff', border:'1px solid #e2e8f0', borderRadius:8,
                  fontSize:12, fontWeight:600, color:'#374151', cursor:'pointer', marginBottom:14 }}>
                  🔵 Continue with Google OAuth
                </button>
              )}
            </div>
            <div style={{ display:'flex', gap:10, padding:'12px 20px', borderTop:'1px solid #e2e8f0' }}>
              <button onClick={onClose} style={{ flex:1, background:'none', border:'1px solid #e2e8f0', borderRadius:8,
                padding:'7px 0', fontSize:12, fontWeight:600, color:'#475569', cursor:'pointer' }}>Cancel</button>
              <button onClick={handleConnect} disabled={loading}
                style={{ flex:1, background:'#0066ff', color:'#fff', border:'none', borderRadius:8,
                  padding:'7px 0', fontWeight:600, fontSize:12, cursor:'pointer',
                  display:'flex', alignItems:'center', justifyContent:'center', gap:6 }}>
                {loading ? <><span style={{ width:12, height:12, border:'2px solid rgba(255,255,255,0.3)',
                  borderTop:'2px solid #fff', borderRadius:'50%', animation:'spin 0.8s linear infinite' }}/> Authenticating…</>
                : <><Zap size={13}/> Authenticate</>}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

/* ─── shared bits for non-AI integration connect/manage ─────── */
function MiniToggle({ value, onChange }) {
  return (
    <button type="button" onClick={() => onChange(!value)}
      className={clsx('w-9 h-5 rounded-full flex-shrink-0 transition-colors relative', value ? 'bg-primary' : 'bg-slate-300')}>
      <span className={clsx('absolute top-0.5 w-4 h-4 rounded-full bg-white shadow-sm transition-all', value ? 'left-[18px]' : 'left-0.5')}/>
    </button>
  )
}

function PasswordField({ value, onChange, placeholder }) {
  const [show, setShow] = useState(false)
  return (
    <div className="relative">
      <input type={show ? 'text' : 'password'} className="input pr-9" placeholder={placeholder}
        value={value} onChange={e => onChange(e.target.value)}/>
      <button type="button" onClick={() => setShow(v => !v)}
        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
        {show ? <EyeOff size={13}/> : <Eye size={13}/>}
      </button>
    </div>
  )
}

function SourceFieldSelect({ value, onChange, sm = true }) {
  return (
    <NativeSelect value={value} onChange={onChange} sm={sm} className="flex-1">
      <option value="">Not mapped</option>
      {SOURCE_FIELD_GROUPS.map(g => (
        <optgroup key={g} label={g}>
          {SOURCE_FIELDS.filter(f => f.group === g).map(f => <option key={f.key} value={f.key}>{f.label}</option>)}
        </optgroup>
      ))}
    </NativeSelect>
  )
}

/* ─── Test-payload modal — real sample inputs, one per mapped field ─────────── */
function TestPayloadModal({ integrationName, entries, sending, onClose, onSend }) {
  const [values, setValues] = useState({})

  function setVal(entryKey, v) {
    setValues(p => ({ ...p, [entryKey]: v }))
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm"
      onMouseDown={e => { if (e.target === e.currentTarget && !sending) onClose() }}>
      <div className="bg-white w-full max-w-md rounded-2xl shadow-modal border border-surface-border flex flex-col max-h-[85vh] overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-surface-border flex-shrink-0">
          <div>
            <p className="text-[13px] font-bold text-slate-900">Test {integrationName} integration</p>
            <p className="text-[11px] text-slate-400 mt-0.5">Enter sample values for each mapped field to preview the payload.</p>
          </div>
          <button onClick={onClose} disabled={sending} className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-surface-hover flex-shrink-0">
            <X size={15}/>
          </button>
        </div>

        <div className="overflow-y-auto p-5 space-y-3">
          {entries.map(e => (
            <div key={e.entryKey} className="space-y-1">
              <label className="label mb-0">
                {e.label}{e.required && <span className="text-red-400 ml-0.5">*</span>}
                <span className="text-slate-400 font-normal"> — from {e.source}</span>
              </label>
              <input type="text" className="input" placeholder={`Sample ${e.label.toLowerCase()}…`}
                value={values[e.entryKey] || ''} onChange={ev => setVal(e.entryKey, ev.target.value)}/>
            </div>
          ))}
        </div>

        <div className="flex gap-2 p-5 border-t border-surface-border flex-shrink-0">
          <button onClick={onClose} disabled={sending} className="btn-secondary flex-1 justify-center">Cancel</button>
          <button onClick={() => onSend(values)} disabled={sending} className="btn-primary flex-1 justify-center">
            {sending
              ? <><span className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin"/> Sending…</>
              : <><Zap size={13}/> Send test payload</>}
          </button>
        </div>
      </div>
    </div>
  )
}

/* ─── Connect modal — real validated connect flow for the 44 non-AI integrations ── */
/* ─── Add Custom Webhook — user-defined endpoint, not from the built-in catalog ── */
const WEBHOOK_ICONS = ['🔗', '⚙️', '🛰️', '📡', '🧩', '🪝']
function isValidWebhookUrl(v) {
  try { const u = new URL(v.trim()); return (u.protocol === 'http:' || u.protocol === 'https:') && !!u.hostname }
  catch { return false }
}

function AddWebhookModal({ onClose, onCreate }) {
  const [name,        setName]        = useState('')
  const [url,         setUrl]         = useState('')
  const [description, setDescription] = useState('')
  const [errors,      setErrors]      = useState({})

  function submit() {
    const errs = {}
    if (!name.trim()) errs.name = 'Required'
    if (!url.trim()) errs.url = 'Required'
    else if (!isValidWebhookUrl(url)) errs.url = 'Enter a valid http(s) URL'
    if (Object.keys(errs).length) { setErrors(errs); return }

    onCreate({
      id: `custom-${Date.now()}`,
      name: name.trim(),
      category: 'Custom',
      status: 'connected',
      tier: 'free',
      description: description.trim() || 'Custom webhook — pushes chatbot data to your own endpoint.',
      color: '#0066ff',
      icon: WEBHOOK_ICONS[Math.floor(Math.random() * WEBHOOK_ICONS.length)],
      freeform: true,
      isCustom: true,
      connectFields: [{ key: 'webhookUrl', label: 'Webhook URL', type: 'text' }],
      connectValues: { webhookUrl: url.trim() },
    })
  }

  return (
    <div className="fixed inset-0 bg-slate-900/25 z-50 flex items-center justify-center p-4"
      onMouseDown={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="bg-white border border-surface-border rounded-2xl w-full max-w-md shadow-modal">
        <div className="flex items-center gap-3 p-5 border-b border-surface-border">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl flex-shrink-0"
            style={{ background: '#0066ff18' }}>🔗</div>
          <div>
            <h3 className="font-semibold text-slate-900 text-sm">Add Custom Webhook</h3>
            <span className="text-[11px] text-slate-500">Push chatbot data to any endpoint you control</span>
          </div>
        </div>
        <div className="p-5 space-y-4">
          <div className="space-y-1.5">
            <label className="label">Name</label>
            <input type="text" className="input" placeholder="e.g. Order Confirmation Webhook"
              value={name} onChange={e => { setName(e.target.value); setErrors(p => ({ ...p, name: null })) }}/>
            {errors.name && <p className="text-[10px] text-red-500">{errors.name}</p>}
          </div>
          <div className="space-y-1.5">
            <label className="label">Webhook URL</label>
            <input type="text" className="input font-mono" placeholder="https://your-server.com/webhook/..."
              value={url} onChange={e => { setUrl(e.target.value); setErrors(p => ({ ...p, url: null })) }}/>
            {errors.url && <p className="text-[10px] text-red-500">{errors.url}</p>}
          </div>
          <div className="space-y-1.5">
            <label className="label">Description <span className="text-slate-400 font-normal">(optional)</span></label>
            <input type="text" className="input" placeholder="What does this webhook do?"
              value={description} onChange={e => setDescription(e.target.value)}/>
          </div>
          <p className="text-[10px] text-slate-400 leading-relaxed">
            You'll map chatbot-collected fields into whatever parameter names your endpoint expects on the next screen.
          </p>
        </div>
        <div className="flex gap-2 p-5 border-t border-surface-border">
          <button onClick={onClose} className="btn-secondary flex-1 justify-center">Cancel</button>
          <button onClick={submit} className="btn-primary flex-1 justify-center">
            <Plus size={13}/> Create Webhook
          </button>
        </div>
      </div>
    </div>
  )
}

function IntegrationConnectModal({ integration, onClose, onConnected }) {
  const { currentUser } = useAuth()
  const connectFields = integration.connectFields ?? CATEGORY_CONNECT_FIELDS[integration.category] ?? []
  const planTier = { starter: 0, growth: 1, scale: 2 }[(currentUser?.workspace?.plan || '').toLowerCase()] ?? 0
  const isGated  = integration.tier === 'enterprise' && planTier < 2

  const [fields,     setFields]     = useState({})
  const [errors,     setErrors]     = useState({})
  const [connecting, setConnecting] = useState(false)
  const [done,       setDone]       = useState(false)

  function setField(key, v) {
    setFields(p => ({ ...p, [key]: v }))
    setErrors(p => (p[key] ? { ...p, [key]: null } : p))
  }

  function submit() {
    const errs = {}
    connectFields.forEach(f => { if (!f.optional && !String(fields[f.key] || '').trim()) errs[f.key] = 'Required' })
    if (Object.keys(errs).length) { setErrors(errs); return }
    setConnecting(true)
    setTimeout(() => { setConnecting(false); setDone(true) }, 1500)
  }

  return (
    <div className="fixed inset-0 bg-slate-900/25 z-50 flex items-center justify-center p-4"
      onMouseDown={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="bg-white border border-surface-border rounded-2xl w-full max-w-md shadow-modal flex flex-col max-h-[88vh] overflow-hidden">
        <div className="flex items-center justify-between p-5 border-b border-surface-border flex-shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl flex-shrink-0"
              style={{ background: `${integration.color}18` }}>{integration.icon}</div>
            <div className="min-w-0">
              <h3 className="font-semibold text-slate-900 text-sm truncate">{done ? 'Connected' : `Connect ${integration.name}`}</h3>
              <span className="text-[11px] text-slate-500">{integration.category}</span>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-surface-hover flex-shrink-0">
            <X size={15}/>
          </button>
        </div>

        <div className="overflow-y-auto">
          {isGated ? (
            <div className="p-6 text-center">
              <div className="w-12 h-12 rounded-full bg-purple-50 border border-purple-100 flex items-center justify-center mx-auto mb-3">
                <Lock size={20} className="text-purple-500"/>
              </div>
              <p className="text-sm font-bold text-slate-900 mb-1.5">Enterprise integration</p>
              <p className="text-[12px] text-slate-500 leading-relaxed mb-4">
                {integration.name} is available on the <strong>Scale</strong> plan. Upgrade to connect enterprise tools and push chatbot data straight into them.
              </p>
              <span className="badge badge-purple">Requires Scale plan</span>
            </div>
          ) : done ? (
            <div className="p-6 text-center">
              <div className="w-14 h-14 rounded-full bg-emerald-50 flex items-center justify-center mx-auto mb-3">
                <CheckCircle2 size={26} className="text-emerald-500"/>
              </div>
              <p className="text-sm font-bold text-slate-900 mb-1.5">Successfully connected!</p>
              <p className="text-[12px] text-slate-500 leading-relaxed">
                {integration.name} is now active. Map your chatbot-collected fields to start pushing data.
              </p>
            </div>
          ) : (
            <div className="p-5 space-y-4">
              <p className="text-[12px] text-slate-500 leading-relaxed">{integration.description}</p>
              {connectFields.map(f => (
                <div key={f.key} className="space-y-1.5">
                  <label className="label">{f.label} {f.optional && <span className="text-slate-400 font-normal">(optional)</span>}</label>
                  {f.type === 'password'
                    ? <PasswordField value={fields[f.key] || ''} onChange={v => setField(f.key, v)} placeholder={f.placeholder}/>
                    : <input type="text" className="input" placeholder={f.placeholder} value={fields[f.key] || ''} onChange={e => setField(f.key, e.target.value)}/>}
                  {errors[f.key] && <p className="text-[10px] text-red-500">{errors[f.key]}</p>}
                </div>
              ))}
              {integration.oauth && (
                <button type="button" onClick={submit} disabled={connecting}
                  className="w-full flex items-center justify-center gap-2 py-2 rounded-lg border border-surface-border bg-white text-[12px] font-semibold text-slate-700 hover:bg-surface-hover transition-colors">
                  {connecting
                    ? <><span className="w-3 h-3 border-2 border-slate-300 border-t-slate-600 rounded-full animate-spin"/> Connecting…</>
                    : <>{integration.oauthLabel || `Continue with ${integration.name}`}</>}
                </button>
              )}
            </div>
          )}
        </div>

        <div className="flex gap-2 p-5 border-t border-surface-border flex-shrink-0">
          {isGated ? (
            <button onClick={onClose} className="btn-secondary flex-1 justify-center">Close</button>
          ) : done ? (
            <>
              <button onClick={onClose} className="btn-secondary flex-1 justify-center">Done</button>
              <button onClick={() => onConnected(integration)} className="btn-primary flex-1 justify-center">
                <GitMerge size={13}/> Set up Field Mapping
              </button>
            </>
          ) : (
            <>
              <button onClick={onClose} className="btn-secondary flex-1 justify-center">Cancel</button>
              {!integration.oauth && (
                <button onClick={submit} disabled={connecting} className="btn-primary flex-1 justify-center">
                  {connecting
                    ? <><span className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin"/> Connecting…</>
                    : <><Zap size={13}/> Connect</>}
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}

/* ─── Detail/manage page for a CONNECTED non-AI integration ──────────────── */
/* NOTE: one connection per integration id — multi-instance (e.g. two separate  */
/* Google Sheets connections) is not supported by this data model.             */
const INTEGRATION_DETAIL_GROUPS = ['General', 'Monitoring']
const INTEGRATION_DETAIL_SECTIONS = [
  { key: 'overview', label: 'Overview',        icon: Info,     group: 'General'    },
  { key: 'mapping',  label: 'Field Mapping',   icon: GitMerge, group: 'General'    },
  { key: 'triggers', label: 'Triggers',        icon: Zap,      group: 'General'    },
  { key: 'activity', label: 'Activity Log',    icon: Clock,    group: 'Monitoring' },
  { key: 'settings', label: 'Settings',        icon: Settings, group: 'Monitoring' },
]

function IntegrationDetailView({ integration, initialSection = 'overview', savedState, onBack, onSaveState, onDisconnect, onDeleteWebhook }) {
  const [section, setSection] = useState(initialSection)
  const [testing, setTesting] = useState(false)

  const isCrm         = integration.category === 'CRM'
  const isCustomSheet = Boolean(integration.customSheetBuilder)
  const payloadMode   = integration.noMapping ? 'none' : integration.freeform ? 'freeform' : 'fixed'
  const targetFields  = integration.targetFields ?? CATEGORY_TARGET_FIELDS[integration.category] ?? []
  const connectFields = integration.connectFields ?? CATEGORY_CONNECT_FIELDS[integration.category] ?? []

  // Custom Google Sheets — bring-your-own-sheet builder, lives entirely in the Field Mapping tab
  const [sheetUrl,      setSheetUrl]      = useState(() => savedState?.sheetConfig?.sheetUrl ?? '')
  const [sharedEmails,  setSharedEmails]  = useState(() => savedState?.sheetConfig?.sharedEmails ?? [])
  const [sheetMappings, setSheetMappings] = useState(() => savedState?.sheetConfig?.mappings ?? [
    { id: 'm1', flowId: 'main', questionId: 'q1', column: 'User Name' },
    { id: 'm2', flowId: 'main', questionId: 'q2', column: 'Mobile No' },
    { id: 'm3', flowId: 'main', questionId: 'q3', column: 'Email Address' },
  ])
  const [sheetConditions, setSheetConditions] = useState(() => savedState?.sheetConfig?.conditions ?? [])
  const [sheetLogicOp,    setSheetLogicOp]    = useState(() => savedState?.sheetConfig?.logicOp ?? 'AND')
  const [sheetAction,     setSheetAction]     = useState(() => savedState?.sheetConfig?.action ?? 'insert')
  const [sheetSavedFlash, setSheetSavedFlash] = useState(false)

  function saveSheetConfig() {
    setSheetSavedFlash(true)
    setTimeout(() => setSheetSavedFlash(false), 2500)
    onSaveState(integration.id, {
      sheetConfig: { sheetUrl, sharedEmails, mappings: sheetMappings, conditions: sheetConditions, logicOp: sheetLogicOp, action: sheetAction },
    })
  }

  // CRM-only: trigger definitions (question -> wait -> push to module)
  const [triggers,           setTriggers]           = useState(() => savedState?.triggers ?? [])
  const [triggersSavedFlash, setTriggersSavedFlash]  = useState(false)

  function updateTriggers(updater) {
    setTriggers(prev => {
      const next = typeof updater === 'function' ? updater(prev) : updater
      onSaveState(integration.id, { triggers: next })
      setTriggersSavedFlash(true)
      setTimeout(() => setTriggersSavedFlash(false), 2000)
      return next
    })
  }
  const [mapping,          setMapping]          = useState(() => savedState?.mapping ?? {})
  const [customParams,     setCustomParams]     = useState(() => savedState?.customParams ?? [])
  const [freeformParams,   setFreeformParams]   = useState(() => savedState?.freeformParams ?? [])
  const [paused,           setPaused]           = useState(() => savedState?.paused ?? false)
  const [savedFlash,       setSavedFlash]       = useState(false)
  const [testResult,       setTestResult]       = useState(null)
  const [activity,         setActivity]         = useState(() => savedState?.activity ?? [])
  const [showDisconnect,   setShowDisconnect]   = useState(false)
  const [showTestModal,    setShowTestModal]    = useState(false)

  // CRM-only: per-module field catalog + mapping (Leads/Contacts/Accounts/Deals)
  const [activeModule,      setActiveModule]      = useState(() => savedState?.activeModule ?? CRM_MODULES[0])
  const [moduleMapping,     setModuleMapping]      = useState(() => savedState?.moduleMapping ?? {})
  const [moduleCustomParams,setModuleCustomParams] = useState(() => savedState?.moduleCustomParams ?? {})
  const [fieldSearch,       setFieldSearch]        = useState('')

  function moduleHasMapping(mod) {
    return Object.values(moduleMapping[mod] || {}).some(m => m?.mode === 'fixed' ? m?.value?.trim() : m?.value)
  }
  const incompleteTriggers = triggers.filter(t => t.enabled && (!t.questionId || !moduleHasMapping(t.module)))

  const allModuleFields = CRM_MODULE_FIELDS[activeModule] || []
  const moduleFields    = fieldSearch.trim()
    ? allModuleFields.filter(f =>
        f.name.toLowerCase().includes(fieldSearch.trim().toLowerCase()) ||
        f.dataType.toLowerCase().includes(fieldSearch.trim().toLowerCase()))
    : allModuleFields
  const moduleMap      = moduleMapping[activeModule] || {}
  const moduleParams   = moduleCustomParams[activeModule] || []

  function setMapRow(key, patch) {
    setMapping(m => ({ ...m, [key]: { mode: 'source', value: '', ...m[key], ...patch } }))
  }

  function setModuleMapRow(fieldName, patch) {
    setModuleMapping(mm => ({
      ...mm,
      [activeModule]: {
        ...(mm[activeModule] || {}),
        [fieldName]: { mode: 'source', value: '', ...(mm[activeModule]?.[fieldName]), ...patch },
      },
    }))
  }

  function setModuleParams(updater) {
    setModuleCustomParams(mm => ({ ...mm, [activeModule]: updater(mm[activeModule] || []) }))
  }

  const requiredUnmapped = targetFields.filter(f => f.required &&
    !(mapping[f.key]?.mode === 'fixed' ? mapping[f.key]?.value?.trim() : mapping[f.key]?.value))
  const moduleRequiredUnmapped = allModuleFields.filter(f => f.required &&
    !(moduleMap[f.name]?.mode === 'fixed' ? moduleMap[f.name]?.value?.trim() : moduleMap[f.name]?.value))
  const usedSources = Object.values(isCrm ? moduleMap : mapping).filter(m => m?.mode !== 'fixed' && m?.value).map(m => m.value)
  const dupeSources = usedSources.filter((v, i) => usedSources.indexOf(v) !== i)
  const activeParamList    = isCrm ? moduleParams : (payloadMode === 'fixed' ? customParams : freeformParams)
  const setActiveParamList = isCrm ? setModuleParams : (payloadMode === 'fixed' ? setCustomParams : setFreeformParams)
  const blockingRequired = isCrm ? moduleRequiredUnmapped : requiredUnmapped

  function sourceLabel(row) {
    if (row.mode === 'fixed') return `Fixed value: "${row.value}"`
    return SOURCE_FIELDS.find(s => s.key === row.value)?.label || row.value
  }

  const mappedEntries = isCrm
    ? [
        ...allModuleFields.filter(f => moduleMap[f.name]?.value).map(f => ({
          entryKey: `f-${f.name}`, payloadKey: f.name, label: f.name, required: f.required,
          source: sourceLabel(moduleMap[f.name]),
          onRemove: () => setModuleMapRow(f.name, { mode: 'source', value: '' }),
        })),
        ...moduleParams.filter(p => p.name && p.sourceKey).map(p => ({
          entryKey: `p-${p.id}`, payloadKey: p.name, label: p.name, required: false,
          source: SOURCE_FIELDS.find(s => s.key === p.sourceKey)?.label || p.sourceKey,
          onRemove: () => setModuleParams(list => list.map(x => x.id === p.id ? { ...x, sourceKey: '' } : x)),
        })),
      ]
    : payloadMode === 'fixed'
    ? [
        ...targetFields.filter(f => mapping[f.key]?.value).map(f => ({
          entryKey: `f-${f.key}`, payloadKey: f.key, label: f.label, required: f.required,
          source: sourceLabel(mapping[f.key]),
          onRemove: () => setMapRow(f.key, { mode: 'source', value: '' }),
        })),
        ...customParams.filter(p => p.name && p.sourceKey).map(p => ({
          entryKey: `p-${p.id}`, payloadKey: p.name, label: p.name, required: false,
          source: SOURCE_FIELDS.find(s => s.key === p.sourceKey)?.label || p.sourceKey,
          onRemove: () => setCustomParams(list => list.map(x => x.id === p.id ? { ...x, sourceKey: '' } : x)),
        })),
      ]
    : freeformParams.filter(p => p.name && p.sourceKey).map(p => ({
        entryKey: `p-${p.id}`, payloadKey: p.name, label: p.name, required: false,
        source: SOURCE_FIELDS.find(s => s.key === p.sourceKey)?.label || p.sourceKey,
        onRemove: () => setFreeformParams(list => list.map(x => x.id === p.id ? { ...x, sourceKey: '' } : x)),
      }))

  function saveMapping() {
    if (blockingRequired.length) return
    setSavedFlash(true)
    setTimeout(() => setSavedFlash(false), 2500)
    onSaveState(integration.id, { mapping, customParams, freeformParams, activeModule, moduleMapping, moduleCustomParams, hasSavedMapping: true, activity })
  }

  function submitTestPayload(values) {
    setTesting(true)
    setTimeout(() => {
      setTesting(false)
      setShowTestModal(false)
      const payload = {}
      mappedEntries.forEach(e => { payload[e.payloadKey] = values[e.entryKey]?.trim() || `<empty — no sample value entered>` })
      setTestResult({ module: isCrm ? activeModule : null, payload })
      const nextActivity = [{ id: Date.now(), label: isCrm ? `Test payload sent (${activeModule})` : 'Test payload sent', at: 'Just now' }, ...activity]
      setActivity(nextActivity)
      onSaveState(integration.id, { mapping, customParams, freeformParams, activeModule, moduleMapping, moduleCustomParams, activity: nextActivity })
    }, 1200)
  }

  function togglePaused() {
    const next = !paused
    setPaused(next)
    onSaveState(integration.id, { paused: next })
  }

  return (
    <div className="flex flex-col md:flex-row md:h-screen md:-m-5 overflow-hidden">
      {/* sidebar */}
      <div className="md:w-52 flex-shrink-0 border-b md:border-b-0 md:border-r border-surface-border bg-white flex flex-col overflow-hidden">
        <div style={{ padding: '12px 12px 0', borderBottom: '1px solid #e2e8f0' }}>
          <button onClick={onBack} className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-primary transition-colors font-medium mb-3">
            <ChevronLeft size={13}/> Back to Integrations
          </button>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, paddingBottom: 12 }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, flexShrink: 0,
              background: `${integration.color}18`, border: `1px solid ${integration.color}28` }}>
              {integration.icon}
            </div>
            <div style={{ minWidth: 0 }}>
              <p style={{ fontSize: 13, fontWeight: 700, color: '#0f172a', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{integration.name}</p>
              <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 2 }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: paused ? '#f59e0b' : '#22c55e', flexShrink: 0 }}/>
                <span style={{ fontSize: 11, fontWeight: 500, color: paused ? '#d97706' : '#16a34a' }}>{paused ? 'Paused' : 'Connected'}</span>
              </div>
            </div>
          </div>
        </div>

        <div className="overflow-y-auto flex-1 py-2">
          {INTEGRATION_DETAIL_GROUPS.map(group => (
            <div key={group} style={{ padding: '0 8px', marginBottom: 4 }}>
              <div style={{ padding: '6px 8px 3px' }}>
                <span style={{ fontSize: 10, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.08em' }}>{group}</span>
              </div>
              {INTEGRATION_DETAIL_SECTIONS.filter(s => s.group === group && !(s.key === 'triggers' && !isCrm)).map(sec => {
                const Icon = sec.icon
                const active = section === sec.key
                return (
                  <button key={sec.key} onClick={() => setSection(sec.key)}
                    className={clsx('w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs font-medium transition-colors text-left',
                      active ? 'bg-primary-50 text-primary font-semibold' : 'text-slate-600 hover:bg-surface-hover')}>
                    <Icon size={13} className="flex-shrink-0"/>
                    <span className="truncate flex-1">{sec.key === 'mapping' && isCustomSheet ? 'Sheet Configuration' : sec.label}</span>
                    {sec.key === 'mapping' && !isCustomSheet && payloadMode !== 'none' && blockingRequired.length > 0 && (
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-400 flex-shrink-0"/>
                    )}
                    {sec.key === 'triggers' && isCrm && incompleteTriggers.length > 0 && (
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-400 flex-shrink-0"/>
                    )}
                  </button>
                )
              })}
            </div>
          ))}
        </div>
      </div>

      {/* content */}
      <div className="flex-1 overflow-y-auto bg-white p-4 md:p-5">

        {section === 'overview' && (
          <div style={{ maxWidth: 560 }}>
            <div style={{ marginBottom: 14 }}>
              <h2 style={{ fontSize: 14, fontWeight: 700, color: '#0f172a', margin: 0 }}>Overview</h2>
              <p style={{ fontSize: 11, color: '#64748b', margin: '3px 0 0' }}>{integration.description}</p>
            </div>
            <div className={clsx('flex items-center gap-3 p-3 rounded-xl border mb-5',
              paused ? 'bg-amber-50 border-amber-200' : 'bg-emerald-50 border-emerald-200')}>
              <div className={clsx('w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0', paused ? 'bg-amber-100' : 'bg-emerald-100')}>
                {paused ? <Pause size={14} className="text-amber-600"/> : <CheckCircle2 size={14} className="text-emerald-600"/>}
              </div>
              <div className="flex-1">
                <p className={clsx('text-[13px] font-semibold', paused ? 'text-amber-700' : 'text-emerald-700')}>{paused ? 'Paused' : 'Connected & Active'}</p>
                <p className={clsx('text-[11px]', paused ? 'text-amber-600' : 'text-emerald-600')}>{paused ? 'Not syncing data until resumed' : 'Last verified: Today'}</p>
              </div>
            </div>
            <div className="space-y-2">
              {connectFields.map(f => (
                <div key={f.key} className="flex items-center justify-between gap-3 px-3 py-2.5 rounded-lg border border-surface-border bg-slate-50">
                  <span className="text-[11px] text-slate-500 flex-shrink-0">{f.label}</span>
                  <span className="text-[11px] font-mono text-slate-700 truncate">
                    {f.type === 'password' ? '••••••••' : integration.connectValues?.[f.key] || '✓ configured'}
                  </span>
                </div>
              ))}
              {integration.oauth && connectFields.length === 0 && (
                <div className="flex items-center gap-2 px-3 py-2.5 rounded-lg border border-surface-border bg-slate-50">
                  <Sparkles size={13} className="text-primary flex-shrink-0"/>
                  <span className="text-[11px] text-slate-600">Connected via {integration.oauthLabel || 'OAuth'}</span>
                </div>
              )}
              {isCustomSheet && (
                <div className="flex items-center justify-between gap-3 px-3 py-2.5 rounded-lg border border-surface-border bg-slate-50">
                  <span className="text-[11px] text-slate-500 flex-shrink-0">Sheet URL</span>
                  <span className="text-[11px] font-mono text-slate-700 truncate">{sheetUrl || 'Not set — configure in Sheet Configuration'}</span>
                </div>
              )}
              {isCustomSheet && sharedEmails.length > 0 && (
                <div className="flex items-center justify-between gap-3 px-3 py-2.5 rounded-lg border border-surface-border bg-slate-50">
                  <span className="text-[11px] text-slate-500 flex-shrink-0">Shared with</span>
                  <span className="text-[11px] text-slate-700 truncate">{sharedEmails.join(', ')}</span>
                </div>
              )}
              {isCrm && triggers.length > 0 && (
                <div className="flex items-center justify-between gap-3 px-3 py-2.5 rounded-lg border border-surface-border bg-slate-50">
                  <span className="text-[11px] text-slate-500 flex-shrink-0">Triggers</span>
                  <span className="text-[11px] text-slate-700">{triggers.filter(t => t.enabled).length} active / {triggers.length} total</span>
                </div>
              )}
            </div>
          </div>
        )}

        {section === 'triggers' && isCrm && (
          <div>
            <div style={{ marginBottom: 14 }}>
              <h2 style={{ fontSize: 14, fontWeight: 700, color: '#0f172a', margin: 0 }}>Triggers</h2>
              <p style={{ fontSize: 11, color: '#64748b', margin: '3px 0 0' }}>
                Push flow-collected answers into {integration.name} the moment a specific question is answered — with configurable timing.
              </p>
            </div>
            <CrmTriggersSection
              triggers={triggers}
              onChange={updateTriggers}
              savedFlash={triggersSavedFlash}
              moduleMapping={moduleMapping}
            />
          </div>
        )}

        {section === 'mapping' && isCustomSheet && (
          <div>
            <div style={{ marginBottom: 14 }}>
              <h2 style={{ fontSize: 14, fontWeight: 700, color: '#0f172a', margin: 0 }}>Sheet Configuration</h2>
              <p style={{ fontSize: 11, color: '#64748b', margin: '3px 0 0' }}>
                Connect your own Google Sheet and map bot questions to exact columns — with optional conditional insert/update rules.
              </p>
            </div>
            <CustomSheetFieldsSection
              sheetUrl={sheetUrl} setSheetUrl={setSheetUrl}
              sharedEmails={sharedEmails} setSharedEmails={setSharedEmails}
              mappings={sheetMappings} setMappings={setSheetMappings}
              conditions={sheetConditions} setConditions={setSheetConditions}
              logicOp={sheetLogicOp} setLogicOp={setSheetLogicOp}
              action={sheetAction} setAction={setSheetAction}
              onSave={saveSheetConfig} savedFlash={sheetSavedFlash}
            />
          </div>
        )}

        {section === 'mapping' && !isCustomSheet && (
          <div style={{ maxWidth: isCrm ? 780 : 640 }}>
            <div style={{ marginBottom: 14 }}>
              <h2 style={{ fontSize: 14, fontWeight: 700, color: '#0f172a', margin: 0 }}>Field Mapping</h2>
              <p style={{ fontSize: 11, color: '#64748b', margin: '3px 0 0' }}>
                {isCrm
                  ? `${integration.name} ships these fields by default in every module. Map each one to a standard field, custom field, or flow automation question from your dashboard.`
                  : `Map data your chatbot collects to ${integration.name}'s fields.`}
              </p>
            </div>

            {payloadMode === 'none' ? (
              <div className="text-center py-14">
                <Info size={22} className="text-slate-300 mx-auto mb-2"/>
                <p className="text-[12px] text-slate-500">This integration doesn't use field mapping — it syncs {integration.category === 'Google' ? 'files/events' : 'data'} directly.</p>
              </div>
            ) : (
              <>
                {isCrm && (
                  <>
                    {/* module tabs */}
                    <div className="flex gap-1.5 mb-4 flex-wrap">
                      {CRM_MODULES.map(mod => {
                        const modUnmapped = (CRM_MODULE_FIELDS[mod] || []).filter(f => f.required &&
                          !(moduleMapping[mod]?.[f.name]?.mode === 'fixed' ? moduleMapping[mod]?.[f.name]?.value?.trim() : moduleMapping[mod]?.[f.name]?.value))
                        return (
                          <button key={mod} onClick={() => { setActiveModule(mod); setFieldSearch('') }}
                            className={clsx('flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-[11px] font-semibold transition-colors',
                              activeModule === mod ? 'border-primary bg-primary-50 text-primary' : 'border-surface-border bg-white text-slate-600 hover:bg-surface-hover')}>
                            {mod}
                            {modUnmapped.length > 0 && <span className="w-1.5 h-1.5 rounded-full bg-amber-400"/>}
                          </button>
                        )
                      })}
                    </div>

                    {/* search within this module's fields */}
                    <div className="relative mb-3">
                      <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"/>
                      <input type="text" className="input-sm pl-8" placeholder={`Search ${activeModule} fields…`}
                        value={fieldSearch} onChange={e => setFieldSearch(e.target.value)}/>
                      {fieldSearch && (
                        <button type="button" onClick={() => setFieldSearch('')}
                          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                          <X size={13}/>
                        </button>
                      )}
                    </div>
                    {fieldSearch.trim() && (
                      <p className="text-[10px] text-slate-400 mb-2">
                        {moduleFields.length} of {allModuleFields.length} fields match "{fieldSearch.trim()}"
                      </p>
                    )}

                    {/* field catalog table — every field this module ships by default */}
                    {moduleFields.length === 0 ? (
                      <div className="text-center py-10 border border-surface-border rounded-xl mb-4">
                        <Search size={18} className="text-slate-300 mx-auto mb-2"/>
                        <p className="text-[12px] text-slate-500">No {activeModule} fields match "{fieldSearch.trim()}"</p>
                        <button type="button" onClick={() => setFieldSearch('')} className="text-[11px] text-primary font-medium hover:underline mt-1.5">Clear search</button>
                      </div>
                    ) : (
                    <div className="border border-surface-border rounded-xl overflow-hidden mb-4">
                      <div className="overflow-x-auto">
                        <table className="w-full border-collapse min-w-[640px]">
                          <thead>
                            <tr className="bg-slate-50 border-b border-surface-border">
                              <th className="text-left text-[10px] font-bold text-slate-400 uppercase tracking-wide px-3 py-2.5 w-[26%]">Field</th>
                              <th className="text-left text-[10px] font-bold text-slate-400 uppercase tracking-wide px-3 py-2.5 w-[14%]">Data Type</th>
                              <th className="text-center text-[10px] font-bold text-slate-400 uppercase tracking-wide px-3 py-2.5 w-[8%]">Custom</th>
                              <th className="text-left text-[10px] font-bold text-slate-400 uppercase tracking-wide px-3 py-2.5">Map From</th>
                            </tr>
                          </thead>
                          <tbody>
                            {moduleFields.map((f, i) => {
                              const row = moduleMap[f.name] || { mode: 'source', value: '' }
                              const err = moduleRequiredUnmapped.some(u => u.name === f.name)
                              return (
                                <tr key={f.name} className={clsx(i > 0 && 'border-t border-surface-border', err && 'bg-red-50/40')}>
                                  <td className="px-3 py-2 align-middle">
                                    <span className="text-[12px] font-medium text-primary">{f.name}</span>
                                    {f.required && <span className="text-red-400 ml-0.5">*</span>}
                                    {err && <p className="text-[10px] text-red-500 mt-0.5">Required</p>}
                                  </td>
                                  <td className="px-3 py-2 align-middle">
                                    <span className="text-[11px] text-slate-500">{f.dataType}</span>
                                  </td>
                                  <td className="px-3 py-2 align-middle text-center">
                                    {f.custom && <CheckCircle2 size={12} className="text-slate-400 inline-block"/>}
                                  </td>
                                  <td className="px-3 py-2 align-middle">
                                    <div className="flex items-center gap-2">
                                      {row.mode === 'fixed' ? (
                                        <input type="text" className="input-sm flex-1" placeholder="Fixed value"
                                          value={row.value} onChange={e => setModuleMapRow(f.name, { value: e.target.value })}/>
                                      ) : (
                                        <SourceFieldSelect value={row.value} onChange={e => setModuleMapRow(f.name, { value: e.target.value })}/>
                                      )}
                                      <button type="button" onClick={() => setModuleMapRow(f.name, { mode: row.mode === 'fixed' ? 'source' : 'fixed', value: '' })}
                                        className="text-[10px] text-primary font-medium hover:underline flex-shrink-0">
                                        {row.mode === 'fixed' ? 'Mapped' : 'Fixed'}
                                      </button>
                                    </div>
                                  </td>
                                </tr>
                              )
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                    )}
                  </>
                )}

                {!isCrm && payloadMode === 'fixed' && targetFields.map(f => {
                  const row = mapping[f.key] || { mode: 'source', value: '' }
                  const err = requiredUnmapped.some(u => u.key === f.key)
                  return (
                    <div key={f.key} className="mb-3">
                      <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                        <div className="sm:w-40 flex-shrink-0">
                          <span className="text-[12px] font-medium text-slate-700">{f.label}</span>
                          {f.required && <span className="text-red-400 ml-0.5">*</span>}
                        </div>
                        {row.mode === 'fixed' ? (
                          <input type="text" className="input-sm flex-1" placeholder="Fixed value"
                            value={row.value} onChange={e => setMapRow(f.key, { value: e.target.value })}/>
                        ) : (
                          <SourceFieldSelect value={row.value} onChange={e => setMapRow(f.key, { value: e.target.value })}/>
                        )}
                        <button type="button" onClick={() => setMapRow(f.key, { mode: row.mode === 'fixed' ? 'source' : 'fixed', value: '' })}
                          className="text-[10px] text-primary font-medium hover:underline flex-shrink-0 sm:w-28 text-left sm:text-right">
                          {row.mode === 'fixed' ? 'Use mapped field' : 'Use fixed value'}
                        </button>
                      </div>
                      {err && <p className="text-[10px] text-red-500 mt-1 sm:ml-40">This field is required</p>}
                    </div>
                  )
                })}

                {activeParamList.map(p => (
                  <div key={p.id} className="flex flex-col sm:flex-row sm:items-center gap-2 mb-3">
                    <input type="text" className="input-sm sm:w-40 flex-shrink-0 font-mono" placeholder="param_name"
                      value={p.name} onChange={e => setActiveParamList(list => list.map(x => x.id === p.id ? { ...x, name: e.target.value } : x))}/>
                    <SourceFieldSelect value={p.sourceKey} onChange={e => setActiveParamList(list => list.map(x => x.id === p.id ? { ...x, sourceKey: e.target.value } : x))}/>
                    <button onClick={() => setActiveParamList(list => list.filter(x => x.id !== p.id))} className="text-slate-400 hover:text-red-500 flex-shrink-0">
                      <X size={13}/>
                    </button>
                  </div>
                ))}

                {dupeSources.length > 0 && (
                  <div className="flex items-start gap-2 p-2.5 rounded-lg bg-amber-50 border border-amber-200 mb-3">
                    <AlertTriangle size={12} className="text-amber-600 flex-shrink-0 mt-px"/>
                    <p className="text-[10px] text-amber-700 leading-relaxed">
                      More than one field maps to the same source — that's fine (e.g. reusing an email in two places), just double-check it's intentional.
                    </p>
                  </div>
                )}

                {/* Mapped so far — quick recap of every field that's actually wired up */}
                <div className="mb-5">
                  <div className="flex items-center gap-2 mb-2">
                    <p className="text-[11px] font-semibold text-slate-700">
                      Mapped {isCrm ? `in ${activeModule}` : ''} ({mappedEntries.length})
                    </p>
                    {mappedEntries.length > 0 && <span className="flex-1 divider"/>}
                  </div>
                  {mappedEntries.length === 0 ? (
                    <p className="text-[11px] text-slate-400 italic">Nothing mapped yet — pick a source for any field above.</p>
                  ) : (
                    <div className="border border-surface-border rounded-xl divide-y divide-surface-border overflow-hidden">
                      {mappedEntries.map(e => (
                        <div key={e.entryKey} className="flex items-center gap-2 px-3 py-2 bg-emerald-50/40">
                          <CheckCircle2 size={12} className="text-emerald-500 flex-shrink-0"/>
                          <span className="text-[11px] font-medium text-slate-700 flex-shrink-0">
                            {e.label}{e.required && <span className="text-red-400">*</span>}
                          </span>
                          <span className="text-slate-300 flex-shrink-0">→</span>
                          <span className="text-[11px] text-slate-500 truncate flex-1">{e.source}</span>
                          <button type="button" onClick={e.onRemove} className="text-slate-400 hover:text-red-500 flex-shrink-0" title="Remove mapping">
                            <X size={12}/>
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <button type="button"
                  onClick={() => setActiveParamList(p => [...p, { id: String(Date.now()), name: '', sourceKey: '' }])}
                  className="w-full text-[11px] text-primary bg-primary-50 rounded-lg py-1.5 font-semibold flex items-center justify-center gap-1 hover:bg-primary/10 transition-colors mb-5">
                  <Plus size={11}/> {isCrm ? 'Add extra param not in this list' : payloadMode === 'fixed' ? 'Add custom param' : 'Add parameter'}
                </button>

                <div className="flex items-start gap-2 p-2.5 rounded-lg bg-slate-50 border border-surface-border mb-5">
                  <Sparkles size={12} className="text-primary flex-shrink-0 mt-px"/>
                  <p className="text-[10px] text-slate-500 leading-relaxed">
                    Syncs automatically — the moment a conversation collects every required field mapped above, it's pushed to {integration.name} in real time. No manual trigger to configure.
                  </p>
                </div>

                <div className="flex items-center gap-3 mb-2 flex-wrap">
                  <button type="button" onClick={() => setShowTestModal(true)} disabled={mappedEntries.length === 0} className="btn-secondary">
                    <Zap size={12}/> Test this integration
                  </button>
                  {mappedEntries.length === 0 && <span className="text-[10px] text-slate-400">Map at least one field to test</span>}
                  {savedFlash && <span className="text-[11px] text-emerald-600 font-medium flex items-center gap-1"><CheckCircle2 size={12}/> Mapping saved</span>}
                </div>

                {testResult && (
                  <div className="mt-2 mb-5">
                    {testResult.module && <p className="text-[10px] text-slate-400 mb-1">Module: {testResult.module}</p>}
                    <pre className="text-[10px] font-mono bg-slate-900 text-slate-100 rounded-lg p-3 overflow-x-auto leading-relaxed">{JSON.stringify(testResult.payload, null, 2)}</pre>
                    <p className="text-[10px] text-emerald-600 mt-1.5 flex items-center gap-1"><CheckCircle2 size={11}/> Test payload sent successfully</p>
                  </div>
                )}

                <button type="button" onClick={saveMapping} disabled={blockingRequired.length > 0} className="btn-primary">
                  <Save size={12}/> Save &amp; Activate{isCrm ? ` ${activeModule} Mapping` : ''}
                </button>
                {blockingRequired.length > 0 && (
                  <p className="text-[10px] text-red-500 mt-2">Map all required fields (marked *) before activating{isCrm ? ` this ${activeModule} module` : ''}.</p>
                )}
              </>
            )}
          </div>
        )}

        {section === 'activity' && (
          <div style={{ maxWidth: 640 }}>
            <div style={{ marginBottom: 14 }}>
              <h2 style={{ fontSize: 14, fontWeight: 700, color: '#0f172a', margin: 0 }}>Activity Log</h2>
              <p style={{ fontSize: 11, color: '#64748b', margin: '3px 0 0' }}>Recent syncs to {integration.name}.</p>
            </div>
            {activity.length === 0 ? (
              <div className="text-center py-14">
                <Clock size={22} className="text-slate-300 mx-auto mb-2"/>
                <p className="text-[12px] text-slate-500 font-medium">No sync activity yet</p>
                <p className="text-[11px] text-slate-400 mt-1">Save your field mapping and send a test payload to get started.</p>
              </div>
            ) : (
              <div className="border border-surface-border rounded-xl overflow-hidden">
                {activity.map((a, i) => (
                  <div key={a.id} className={clsx('flex items-center justify-between px-4 py-2.5', i > 0 && 'border-t border-surface-border')}>
                    <div className="flex items-center gap-2.5">
                      <CheckCircle2 size={13} className="text-emerald-500 flex-shrink-0"/>
                      <span className="text-[12px] text-slate-700">{a.label}</span>
                    </div>
                    <span className="text-[10px] text-slate-400">{a.at}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {section === 'settings' && (
          <div style={{ maxWidth: 560 }}>
            <div style={{ marginBottom: 14 }}>
              <h2 style={{ fontSize: 14, fontWeight: 700, color: '#0f172a', margin: 0 }}>Settings</h2>
              <p style={{ fontSize: 11, color: '#64748b', margin: '3px 0 0' }}>Manage this connection.</p>
            </div>
            <div className="flex items-center justify-between p-3.5 rounded-xl border border-surface-border mb-4">
              <div>
                <p className="text-[12px] font-semibold text-slate-700">{paused ? 'Paused' : 'Active'}</p>
                <p className="text-[11px] text-slate-400">Pause to stop syncing without disconnecting.</p>
              </div>
              <MiniToggle value={!paused} onChange={togglePaused}/>
            </div>
            <button type="button" onClick={() => setShowDisconnect(true)}
              className="btn-secondary text-red-500 hover:text-red-600 hover:border-red-200">
              {integration.isCustom ? 'Delete Webhook' : 'Disconnect'}
            </button>

            {showDisconnect && (
              <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/40"
                onMouseDown={e => { if (e.target === e.currentTarget) setShowDisconnect(false) }}>
                <div className="bg-white w-full max-w-sm rounded-2xl shadow-modal border border-surface-border p-5">
                  {integration.isCustom ? (
                    <>
                      <p className="text-[13px] font-bold text-slate-900 mb-1.5">Delete {integration.name}?</p>
                      <p className="text-[11px] text-slate-500 leading-relaxed mb-4">
                        This permanently removes the webhook and its field mapping — this can't be undone.
                      </p>
                      <div className="flex flex-col gap-2">
                        <button onClick={() => onDeleteWebhook(integration.id)}
                          className="w-full py-2 rounded-lg text-[11px] font-semibold text-white bg-red-500 hover:bg-red-600 transition-colors">
                          Delete Webhook
                        </button>
                        <button onClick={() => setShowDisconnect(false)} className="text-[11px] text-slate-400 hover:text-slate-600 mt-1">Cancel</button>
                      </div>
                    </>
                  ) : (
                    <>
                      <p className="text-[13px] font-bold text-slate-900 mb-1.5">Disconnect {integration.name}?</p>
                      <p className="text-[11px] text-slate-500 leading-relaxed mb-4">
                        You can keep your field mapping so reconnecting later picks up right where you left off, or remove it entirely.
                      </p>
                      <div className="flex flex-col gap-2">
                        <button onClick={() => onDisconnect(integration.id, true)} className="btn-secondary justify-center">Disconnect &amp; keep field mapping</button>
                        <button onClick={() => onDisconnect(integration.id, false)}
                          className="w-full py-2 rounded-lg text-[11px] font-semibold text-white bg-red-500 hover:bg-red-600 transition-colors">
                          Disconnect &amp; remove field mapping
                        </button>
                        <button onClick={() => setShowDisconnect(false)} className="text-[11px] text-slate-400 hover:text-slate-600 mt-1">Cancel</button>
                      </div>
                    </>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {showTestModal && (
        <TestPayloadModal
          integrationName={integration.name}
          entries={mappedEntries}
          sending={testing}
          onClose={() => setShowTestModal(false)}
          onSend={submitTestPayload}
        />
      )}
    </div>
  )
}

/* ─── Integration card ───────────────────────────────────────── */
/* ─── Custom Google Sheets — bespoke builder (bring-your-own sheet) ─────── */
/* Separate from the "Google Sheets" flagship integration: that one is a    */
/* generic managed connection; this lets a customer paste ANY sheet they    */
/* own, share access to it, and precisely map bot questions to columns,     */
/* including conditional insert/update logic — mirrors the reference flow. */
const COLUMN_PRESETS = ['User Name', 'Mobile No', 'Email Address', 'Full Name', 'Company', 'City', 'Order ID', 'Budget', 'Custom Field']
const CONDITION_OPERATORS = [
  { v: 'equals', l: 'Equals' },
  { v: 'not_equals', l: 'Not Equals' },
  { v: 'contains', l: 'Contains' },
  { v: 'is_empty', l: 'Is Empty' },
]

function CustomSheetFieldsSection({
  sheetUrl, setSheetUrl, sharedEmails, setSharedEmails,
  mappings, setMappings, conditions, setConditions, logicOp, setLogicOp, action, setAction,
  onSave, savedFlash,
}) {
  const [emailDraft, setEmailDraft] = useState('')
  const [emailError, setEmailError] = useState('')
  const [copied, setCopied] = useState(false)
  const [testResult, setTestResult] = useState(null)
  const [testing, setTesting] = useState(false)

  function addEmail() {
    const v = emailDraft.trim()
    if (!v) return
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) { setEmailError('Enter a valid email address'); return }
    if (sharedEmails.includes(v)) { setEmailError('Already added'); return }
    if (sharedEmails.length >= 5) { setEmailError('You can share access to up to 5 emails'); return }
    setSharedEmails(e => [...e, v])
    setEmailDraft('')
    setEmailError('')
  }
  function removeEmail(email) { setSharedEmails(e => e.filter(x => x !== email)) }

  function addMapping() {
    setMappings(m => [...m, { id: `m${Date.now()}`, flowId: 'main', questionId: '', column: '' }])
  }
  function updateMapping(id, patch) {
    setMappings(m => m.map(row => row.id === id ? { ...row, ...patch } : row))
  }
  function removeMapping(id) {
    setMappings(m => m.filter(row => row.id !== id))
  }

  function addCondition() {
    setConditions(c => [...c, { id: `c${Date.now()}`, column: mappings[0]?.column ?? '', operator: 'equals', value: '' }])
  }
  function updateCondition(id, patch) {
    setConditions(c => c.map(row => row.id === id ? { ...row, ...patch } : row))
  }
  function removeCondition(id) {
    setConditions(c => c.filter(row => row.id !== id))
  }

  function copyUrl() {
    if (sheetUrl) { navigator.clipboard?.writeText(sheetUrl); setCopied(true); setTimeout(() => setCopied(false), 1500) }
  }

  function runTest() {
    setTesting(true)
    setTimeout(() => {
      setTesting(false)
      setTestResult({ ok: true, action, rowsAffected: action === 'update' ? 1 : 1 })
    }, 1000)
  }

  const validMappings = mappings.filter(m => m.questionId && m.column)
  const canSave = Boolean(sheetUrl.trim()) && validMappings.length > 0

  return (
    <div style={{ maxWidth: 720 }}>
      <div className="space-y-5">
          {/* Sheet URL */}
          <div className="space-y-1.5">
            <label className="label mb-0">Google Sheet URL</label>
            <p className="text-[10px] text-slate-400"><span className="font-semibold text-slate-500">Note:</span> Sheet access will be shared to the account email registered with ChatFlow.</p>
            <div className="flex items-center gap-2 p-2.5 rounded-lg bg-slate-50 border border-surface-border">
              <input type="text" className="flex-1 bg-transparent text-[12px] text-slate-700 outline-none font-mono"
                placeholder="https://docs.google.com/spreadsheets/d/..." value={sheetUrl} onChange={e => setSheetUrl(e.target.value)}/>
              <button type="button" onClick={copyUrl} disabled={!sheetUrl} title="Copy link"
                className="p-1.5 rounded-md text-slate-400 hover:text-primary hover:bg-white transition-colors disabled:opacity-30 flex-shrink-0">
                {copied ? <CheckCircle2 size={14} className="text-emerald-500"/> : <Copy size={14}/>}
              </button>
              <a href={sheetUrl || undefined} target="_blank" rel="noreferrer"
                onClick={e => { if (!sheetUrl) e.preventDefault() }}
                className={clsx('p-1.5 rounded-md hover:bg-white transition-colors flex-shrink-0', sheetUrl ? 'text-slate-400 hover:text-primary' : 'text-slate-300 pointer-events-none')}>
                <ExternalLink size={14}/>
              </a>
            </div>
          </div>

          {/* Share access */}
          <div className="space-y-1.5">
            <label className="label mb-0 flex items-center gap-1.5">Share Sheet Access <Info size={11} className="text-slate-400"/></label>
            <p className="text-[10px] text-slate-400"><span className="font-semibold text-slate-500">Note:</span> You can share access to up to 5 emails.</p>
            <div className="flex flex-wrap gap-1.5">
              {sharedEmails.map(email => (
                <span key={email} className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-full bg-primary-50 border border-primary/20 text-primary text-[11px] font-medium">
                  <Mail size={10}/> {email}
                  <button type="button" onClick={() => removeEmail(email)} className="hover:text-red-500"><X size={10}/></button>
                </span>
              ))}
            </div>
            {sharedEmails.length < 5 && (
              <div>
                <div className="flex items-center gap-2 px-3 py-2 rounded-lg border border-surface-border focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/10 max-w-xs">
                  <input type="email" className="flex-1 text-[12px] outline-none min-w-0" placeholder="Enter your email"
                    value={emailDraft}
                    onChange={e => { setEmailDraft(e.target.value); setEmailError('') }}
                    onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addEmail() } }}/>
                  <button type="button" onClick={addEmail} className="text-primary hover:text-primary-hover flex-shrink-0"><CheckCircle2 size={14}/></button>
                  <button type="button" onClick={() => { setEmailDraft(''); setEmailError('') }} className="text-slate-400 hover:text-slate-600 flex-shrink-0"><X size={14}/></button>
                </div>
                {emailError && <p className="text-[10px] text-red-500 mt-1">{emailError}</p>}
              </div>
            )}
          </div>

          <div className="divider"/>

          {/* Question -> column mapping */}
          <div className="space-y-2">
            <label className="label mb-0">Select the questions to be stored in google sheets</label>
            <div className="space-y-1.5">
              {mappings.map(row => {
                const flow = MOCK_FLOWS.find(f => f.id === row.flowId)
                return (
                  <div key={row.id} className="flex items-center gap-1.5 flex-wrap sm:flex-nowrap">
                    <span className="px-2.5 py-1.5 rounded-lg bg-slate-100 text-[11px] font-semibold text-slate-500 flex-shrink-0">Question</span>
                    <div className="w-full sm:w-28 flex-shrink-0">
                      <NativeSelect sm value={row.flowId} onChange={e => updateMapping(row.id, { flowId: e.target.value, questionId: '' })}>
                        {MOCK_FLOWS.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
                      </NativeSelect>
                    </div>
                    <div className="flex-1 min-w-[140px]">
                      <NativeSelect sm value={row.questionId} onChange={e => updateMapping(row.id, { questionId: e.target.value })}>
                        <option value="">Select question…</option>
                        {(flow?.questions ?? []).map(q => <option key={q.id} value={q.id}>{q.label}</option>)}
                      </NativeSelect>
                    </div>
                    <div className="w-full sm:w-36 flex-shrink-0">
                      <NativeSelect sm value={row.column} onChange={e => updateMapping(row.id, { column: e.target.value })}>
                        <option value="">Column…</option>
                        {COLUMN_PRESETS.map(c => <option key={c} value={c}>{c}</option>)}
                      </NativeSelect>
                    </div>
                    <button type="button" onClick={() => removeMapping(row.id)} className="p-1.5 rounded-lg text-red-400 hover:text-red-600 hover:bg-red-50 transition-colors flex-shrink-0">
                      <Trash2 size={14}/>
                    </button>
                  </div>
                )
              })}
            </div>
            <button type="button" onClick={addMapping} className="text-[11px] text-primary font-semibold hover:underline flex items-center gap-1">
              <Plus size={12}/> Add New
            </button>
          </div>

          <div className="divider"/>

          {/* Operations (optional) */}
          <div className="space-y-2">
            <label className="label mb-0">Select Operations <span className="text-slate-400 font-normal">(Optional)</span></label>
            <div className="space-y-1.5">
              {conditions.map((c, i) => (
                <div key={c.id}>
                  {i > 0 && (
                    <div className="my-1.5">
                      <NativeSelect sm className="w-20" value={logicOp} onChange={e => setLogicOp(e.target.value)}>
                        <option value="AND">AND</option>
                        <option value="OR">OR</option>
                      </NativeSelect>
                    </div>
                  )}
                  <div className="flex items-center gap-1.5 flex-wrap sm:flex-nowrap">
                    <span className="w-5 h-5 rounded-full bg-slate-100 text-[10px] font-bold text-slate-500 flex items-center justify-center flex-shrink-0">{i + 1}</span>
                    <div className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-50 border border-surface-border flex-1 min-w-[110px]">
                      <select className="flex-1 bg-transparent text-[11px] font-medium text-slate-700 outline-none" value={c.column} onChange={e => updateCondition(c.id, { column: e.target.value })}>
                        <option value="">Field…</option>
                        {validMappings.map(m => <option key={m.id} value={m.column}>{m.column}</option>)}
                      </select>
                      <button type="button" onClick={() => removeCondition(c.id)} className="text-red-400 hover:text-red-600 flex-shrink-0"><X size={11}/></button>
                    </div>
                    <div className="w-28 flex-shrink-0">
                      <NativeSelect sm value={c.operator} onChange={e => updateCondition(c.id, { operator: e.target.value })}>
                        {CONDITION_OPERATORS.map(o => <option key={o.v} value={o.v}>{o.l}</option>)}
                      </NativeSelect>
                    </div>
                    {c.operator !== 'is_empty' && (
                      <div className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-50 border border-surface-border flex-1 min-w-[100px]">
                        <input type="text" className="flex-1 bg-transparent text-[11px] outline-none" placeholder="Value" value={c.value} onChange={e => updateCondition(c.id, { value: e.target.value })}/>
                      </div>
                    )}
                    <button type="button" onClick={() => removeCondition(c.id)} className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors flex-shrink-0">
                      <Trash2 size={13}/>
                    </button>
                  </div>
                </div>
              ))}
            </div>
            <button type="button" onClick={addCondition} disabled={validMappings.length === 0}
              className="text-[11px] text-primary font-semibold hover:underline flex items-center gap-1 disabled:opacity-40 disabled:no-underline">
              <Plus size={12}/> Add Condition
            </button>

            <div className="w-44 pt-1">
              <NativeSelect value={action} onChange={e => setAction(e.target.value)}>
                <option value="insert">Insert new row</option>
                <option value="update">Update a row</option>
              </NativeSelect>
            </div>
            {action === 'update' && conditions.length === 0 && (
              <p className="text-[10px] text-amber-600">Add at least one condition above so we know which row to update.</p>
            )}
          </div>

          <div className="divider"/>

          {/* Sample sheet preview / test */}
          <div className="space-y-2">
            <label className="label mb-0">Sample Sheet Preview / Test Your Integration</label>
            {validMappings.length === 0 ? (
              <p className="text-[11px] text-slate-400">Map at least one question to a column above to preview the sheet.</p>
            ) : (
              <div className="border border-surface-border rounded-xl overflow-hidden">
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="bg-slate-50 border-b border-surface-border">
                      {validMappings.map((m, i) => (
                        <th key={m.id} className="text-center text-[10px] font-bold text-primary px-3 py-1.5 border-r border-surface-border last:border-r-0">
                          {String.fromCharCode(65 + i)}
                        </th>
                      ))}
                    </tr>
                    <tr className="border-b border-surface-border">
                      {validMappings.map(m => (
                        <th key={m.id} className="text-center text-[11px] font-semibold text-slate-700 px-3 py-1.5 border-r border-surface-border last:border-r-0">
                          {m.column}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      {validMappings.map(m => (
                        <td key={m.id} className="text-center text-[11px] text-slate-400 px-3 py-1.5 border-r border-surface-border last:border-r-0">test</td>
                      ))}
                    </tr>
                  </tbody>
                </table>
              </div>
            )}

            <div className="flex items-center gap-3 flex-wrap">
              <button type="button" onClick={runTest} disabled={testing || validMappings.length === 0} className="btn-secondary">
                {testing ? <><span className="w-3 h-3 border-2 border-slate-300 border-t-slate-600 rounded-full animate-spin"/> Testing…</> : <><Table size={12}/> Test</>}
              </button>
              {testResult && (
                <span className="text-[11px] text-emerald-600 font-medium flex items-center gap-1">
                  <CheckCircle2 size={12}/> Test succeeded — {action === 'update' ? 'row updated' : 'row inserted'}
                </span>
              )}
            </div>
          </div>

          <button type="button" onClick={onSave} disabled={!canSave} className="btn-primary">
            <CheckCircle2 size={13}/> Save &amp; Activate
          </button>
          {savedFlash && <span className="ml-3 text-[11px] text-emerald-600 font-medium inline-flex items-center gap-1"><CheckCircle2 size={12}/> Saved</span>}
          {!canSave && <p className="text-[10px] text-red-500 mt-2">Add a sheet URL and map at least one question to a column before activating.</p>}
      </div>
    </div>
  )
}

function IntegrationCard({ integration, onSelect }) {
  return (
    <div className="card p-4 hover:border-primary/30 hover:shadow-sm transition-all cursor-pointer group relative overflow-hidden"
      onClick={() => onSelect(integration)}>
      {integration.status === 'connected' && (
        <div className="absolute top-2.5 right-2.5">
          <span className="badge badge-green text-[10px]"><CheckCircle2 size={9}/> Active</span>
        </div>
      )}
      {integration.tier === 'enterprise' && integration.status !== 'connected' && (
        <div className="absolute top-2.5 right-2.5">
          <span className="badge badge-purple text-[10px]">Enterprise</span>
        </div>
      )}
      <div className="w-11 h-11 rounded-xl flex items-center justify-center text-2xl mb-3"
        style={{ background:`${integration.color}18` }}>{integration.icon}</div>
      <h3 className="font-semibold text-slate-900 text-sm group-hover:text-primary transition-colors leading-tight">{integration.name}</h3>
      <span className="text-[11px] text-slate-400 font-medium">{integration.category}</span>
      <p className="text-[11px] text-slate-500 mt-2 leading-relaxed line-clamp-2">{integration.description}</p>
      <button className={clsx(
        'mt-3 w-full py-1.5 rounded-lg text-xs font-medium transition-colors border',
        integration.status === 'connected'
          ? 'bg-surface border-surface-border text-slate-600 hover:bg-surface-hover'
          : 'bg-primary-50 border-primary/20 text-primary hover:bg-primary-100'
      )}>
        {integration.status === 'connected' ? 'Manage' : 'Connect'}
      </button>
    </div>
  )
}

/* ─── Page ───────────────────────────────────────────────────── */
export default function Integrations() {
  const [search,             setSearch]             = useState('')
  const [category,           setCategory]           = useState('All')
  const [selected,           setSelected]           = useState(null)   // unconnected non-AI -> IntegrationConnectModal
  const [selectedAI,         setSelectedAI]         = useState(null)
  const [activeProvider,     setActiveProvider]     = useState(null)
  const [activeIntegration,  setActiveIntegration]  = useState(null)   // connected non-AI -> IntegrationDetailView
  const [initialDetailSection, setInitialDetailSection] = useState('overview')
  const [integrationOverrides, setIntegrationOverrides] = useState({}) // { [id]: {status, paused, mapping, ...} } — session-local, since imported constants can't be mutated
  const [customWebhooks,    setCustomWebhooks]    = useState([])       // user-created custom webhook integrations
  const [showAddWebhook,    setShowAddWebhook]    = useState(false)

  function handleAICard(provider) {
    if (provider.status === 'connected') setActiveProvider(provider)
    else setSelectedAI(provider)
  }

  function saveIntegrationState(id, patch) {
    setIntegrationOverrides(o => ({ ...o, [id]: { ...o[id], ...patch } }))
  }

  function handleConnected(integration) {
    saveIntegrationState(integration.id, { status: 'connected' })
    setSelected(null)
    setActiveIntegration(integration)
    setInitialDetailSection('mapping')
  }

  function handleDisconnect(id, keepMapping) {
    saveIntegrationState(id, keepMapping
      ? { status: 'available' }
      : { status: 'available', mapping: {}, customParams: [], freeformParams: [], hasSavedMapping: false, activity: [] })
    setActiveIntegration(null)
  }

  function handleCreateWebhook(webhook) {
    setCustomWebhooks(w => [...w, webhook])
    setShowAddWebhook(false)
    setActiveIntegration(webhook)
    setInitialDetailSection('mapping')
  }

  function handleDeleteWebhook(id) {
    setCustomWebhooks(w => w.filter(x => x.id !== id))
    setIntegrationOverrides(o => { const { [id]: _, ...rest } = o; return rest })
    setActiveIntegration(null)
  }

  if (activeProvider) {
    return <ProviderDetailView provider={activeProvider} onBack={() => setActiveProvider(null)}/>
  }

  if (activeIntegration) {
    const liveIntegration = { ...activeIntegration, ...integrationOverrides[activeIntegration.id] }
    return (
      <IntegrationDetailView
        integration={liveIntegration}
        initialSection={initialDetailSection}
        savedState={integrationOverrides[activeIntegration.id]}
        onBack={() => setActiveIntegration(null)}
        onSaveState={saveIntegrationState}
        onDisconnect={handleDisconnect}
        onDeleteWebhook={handleDeleteWebhook}
      />
    )
  }

  const liveIntegrations = INTEGRATIONS.map(i => ({ ...i, ...integrationOverrides[i.id] }))
  const liveWebhooks     = customWebhooks.map(w => ({ ...w, ...integrationOverrides[w.id] }))

  const aiAsIntegrations = AI_PROVIDERS.map(p => ({
    ...p,
    category: 'AI & ML',
    _isAI: true,
  }))

  const filtered = [...liveIntegrations, ...liveWebhooks, ...aiAsIntegrations].filter(i => {
    const matchCat    = category === 'All' || i.category === category
    const matchSearch = i.name.toLowerCase().includes(search.toLowerCase()) ||
                        i.description.toLowerCase().includes(search.toLowerCase())
    return matchCat && matchSearch
  })

  const connected = filtered.filter(i => i.status === 'connected')
  const available  = filtered.filter(i => i.status !== 'connected')

  function handleCard(i) {
    if (i._isAI) return handleAICard(i)
    if (i.customSheetBuilder) {
      // No separate credential step — the sheet URL + share access ARE the connection, configured inline in the detail view.
      if (i.status !== 'connected') saveIntegrationState(i.id, { status: 'connected' })
      setActiveIntegration(i)
      setInitialDetailSection('mapping')
      return
    }
    if (i.status === 'connected') { setActiveIntegration(i); setInitialDetailSection('overview'); return }
    setSelected(i)
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="page-header">
        <div>
          <h1 className="page-title">Integrations</h1>
          <p className="text-[11px] text-slate-400 mt-0.5">Connect your favourite tools — plug and play, no code required.</p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <button onClick={() => setShowAddWebhook(true)} className="btn-primary"><Zap size={14}/> Add Custom Webhook</button>
          <button className="btn-secondary"><Plus size={14}/> Request Integration</button>
        </div>
      </div>

      <div className="card p-4">
        <div className="relative">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"/>
          <input type="text" className="input pl-9" placeholder="Search integrations…"
            value={search} onChange={e => setSearch(e.target.value)}/>
        </div>
        <div className="flex flex-wrap gap-2 mt-3">
          {INTEGRATION_CATEGORIES.map(cat => (
            <button key={cat} onClick={() => setCategory(cat)}
              className={clsx('px-3 py-1 rounded-full text-xs font-medium transition-colors border',
                category===cat ? 'bg-primary text-white border-primary' : 'bg-white text-slate-600 border-surface-border hover:border-primary/40')}>
              {cat}
            </button>
          ))}
        </div>
      </div>

      {connected.length > 0 && (
        <div>
          <h3 className="section-title mb-3">Connected ({connected.length})</h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
            {connected.map(i => <IntegrationCard key={i.id} integration={i} onSelect={handleCard}/>)}
          </div>
        </div>
      )}

      {available.length > 0 && (
        <div>
          <h3 className="section-title mb-3">Available ({available.length})</h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
            {available.map(i => <IntegrationCard key={i.id} integration={i} onSelect={handleCard}/>)}
          </div>
        </div>
      )}

      {filtered.length === 0 && (
        <div className="text-center py-16">
          <div className="text-4xl mb-3">🔍</div>
          <p className="text-slate-500 font-medium">No integrations found</p>
          <p className="text-slate-400 text-xs mt-1">Try a different search or category</p>
        </div>
      )}

      {selected      && <IntegrationConnectModal integration={selected} onClose={() => setSelected(null)} onConnected={handleConnected}/>}
      {selectedAI    && <AIConnectModal          provider={selectedAI}  onClose={() => setSelectedAI(null)}/>}
      {showAddWebhook && <AddWebhookModal onClose={() => setShowAddWebhook(false)} onCreate={handleCreateWebhook}/>}
    </div>
  )
}
