// Templates.jsx — Full rewrite aligned with dashboard design system (Tailwind CSS)
import { useState, useRef, useEffect, useMemo } from 'react'
import clsx from 'clsx'
import {
  Plus, Search, Eye, Pencil, Copy, Trash2, X, MoreHorizontal,
  FileText, Send, ChevronDown,
  Bold, Italic, Strikethrough, Code, Link2, AtSign, Hash,
  Image, Video, FileIcon, MapPin, Phone, Globe, MousePointer2,
  List, Layers, ShieldCheck, BarChart2, RefreshCw, AlertCircle,
  Check, Upload, Play, Sparkles, ChevronUp, Wand2,
} from 'lucide-react'
import { NativeSelect } from '../components/Select'

// ─── Data ────────────────────────────────────────────────────────────────────

const LANGUAGES = [
  { value: 'af', label: 'Afrikaans' }, { value: 'sq', label: 'Albanian' },
  { value: 'ar', label: 'Arabic' }, { value: 'az', label: 'Azerbaijani' },
  { value: 'bn', label: 'Bengali' }, { value: 'bg', label: 'Bulgarian' },
  { value: 'zh_CN', label: 'Chinese (Simplified)' }, { value: 'zh_TW', label: 'Chinese (Traditional)' },
  { value: 'hr', label: 'Croatian' }, { value: 'cs', label: 'Czech' },
  { value: 'da', label: 'Danish' }, { value: 'nl', label: 'Dutch' },
  { value: 'en', label: 'English' }, { value: 'en_GB', label: 'English (UK)' },
  { value: 'en_US', label: 'English (US)' }, { value: 'fi', label: 'Finnish' },
  { value: 'fr', label: 'French' }, { value: 'de', label: 'German' },
  { value: 'el', label: 'Greek' }, { value: 'gu', label: 'Gujarati' },
  { value: 'he', label: 'Hebrew' }, { value: 'hi', label: 'Hindi' },
  { value: 'hu', label: 'Hungarian' }, { value: 'id', label: 'Indonesian' },
  { value: 'it', label: 'Italian' }, { value: 'ja', label: 'Japanese' },
  { value: 'kn', label: 'Kannada' }, { value: 'ko', label: 'Korean' },
  { value: 'ms', label: 'Malay' }, { value: 'ml', label: 'Malayalam' },
  { value: 'mr', label: 'Marathi' }, { value: 'nb', label: 'Norwegian' },
  { value: 'fa', label: 'Persian' }, { value: 'pl', label: 'Polish' },
  { value: 'pt_BR', label: 'Portuguese (Brazil)' }, { value: 'pt_PT', label: 'Portuguese (Portugal)' },
  { value: 'pa', label: 'Punjabi' }, { value: 'ro', label: 'Romanian' },
  { value: 'ru', label: 'Russian' }, { value: 'es', label: 'Spanish' },
  { value: 'es_AR', label: 'Spanish (Argentina)' }, { value: 'es_ES', label: 'Spanish (Spain)' },
  { value: 'sw', label: 'Swahili' }, { value: 'sv', label: 'Swedish' },
  { value: 'ta', label: 'Tamil' }, { value: 'te', label: 'Telugu' },
  { value: 'th', label: 'Thai' }, { value: 'tr', label: 'Turkish' },
  { value: 'uk', label: 'Ukrainian' }, { value: 'ur', label: 'Urdu' },
  { value: 'vi', label: 'Vietnamese' }, { value: 'zu', label: 'Zulu' },
]

const CATEGORY_DEFS = [
  {
    value: 'MARKETING', label: 'Marketing', icon: '📣',
    desc: 'Promotions, offers, newsletters, announcements',
    color: 'border-primary bg-primary-50', accent: 'text-primary',
    badge: 'Most used', badgeColor: 'bg-primary text-white',
    subTypes: [
      { value: 'default',              label: 'Default',                     icon: '💬', desc: 'Send messages with media and customised buttons.' },
      { value: 'catalog',              label: 'Catalogue',                   icon: '🛍️', desc: 'Drive sales by connecting your product catalogue.' },
      { value: 'flows',                label: 'Flows',                       icon: '📋', desc: 'Send a form to capture interests or run surveys.' },
      { value: 'order_details',        label: 'Order details',               icon: '🧾', desc: 'Send messages through which customers can pay.' },
      { value: 'calling_permissions',  label: 'Calling permissions',         icon: '📞', desc: 'Ask customers if you can call them on WhatsApp.' },
    ],
  },
  {
    value: 'UTILITY', label: 'Utility', icon: '🔔',
    desc: 'Order confirmations, reminders, receipts, billing',
    color: 'border-amber-400 bg-amber-50', accent: 'text-amber-600',
    badge: null, badgeColor: null,
    subTypes: [
      { value: 'default',              label: 'Default',       icon: '💬', desc: 'Send messages about an existing order or account.' },
      { value: 'flows',                label: 'Flows',         icon: '📋', desc: 'Collect feedback, send reminders or manage orders.' },
      { value: 'order_status',         label: 'Order status',  icon: '📦', desc: 'Tell customers about the progress of their orders.' },
      { value: 'order_details',        label: 'Order details', icon: '🧾', desc: 'Send messages through which customers can pay.' },
      { value: 'calling_permissions',  label: 'Calling permissions', icon: '📞', desc: 'Ask customers if you can call them.' },
    ],
  },
  {
    value: 'AUTHENTICATION', label: 'Authentication', icon: '🔐',
    desc: 'OTPs, account verification, integrity challenges',
    color: 'border-emerald-400 bg-emerald-50', accent: 'text-emerald-600',
    badge: 'Instant approval', badgeColor: 'bg-emerald-500 text-white',
    subTypes: [
      { value: 'otp', label: 'One-time passcode', icon: '🔑', desc: 'Send codes to verify a transaction or login.' },
    ],
  },
]

const MOCK_TEMPLATES = [
  { id: 't1', name: 'order_confirmation',    category: 'UTILITY',         lang: 'English', status: 'approved', sent: 4821, opened: 3102, ctr: '64%', updatedAt: '2 days ago' },
  { id: 't2', name: 'welcome_offer',          category: 'MARKETING',       lang: 'English', status: 'approved', sent: 2341, opened: 1890, ctr: '81%', updatedAt: '1 week ago' },
  { id: 't3', name: 'otp_verification',       category: 'AUTHENTICATION',  lang: 'English', status: 'approved', sent: 9102, opened: 9102, ctr: '100%',updatedAt: '3 days ago' },
  { id: 't4', name: 'flash_sale_promo',       category: 'MARKETING',       lang: 'Hindi',   status: 'pending',  sent: 0,    opened: 0,    ctr: '—',   updatedAt: '1 day ago' },
  { id: 't5', name: 'appointment_reminder',   category: 'UTILITY',         lang: 'English', status: 'rejected', sent: 0,    opened: 0,    ctr: '—',   updatedAt: '3 days ago' },
  { id: 't6', name: 'reengagement_30d',       category: 'MARKETING',       lang: 'English', status: 'approved', sent: 1203, opened: 743,  ctr: '62%', updatedAt: '5 days ago' },
  { id: 't7', name: 'payment_receipt',        category: 'UTILITY',         lang: 'English', status: 'approved', sent: 3301, opened: 3100, ctr: '94%', updatedAt: '1 week ago' },
]

const TTL_OPTIONS = [
  { value: '5m', label: '5 minutes' }, { value: '10m', label: '10 minutes' },
  { value: '15m', label: '15 minutes' }, { value: '30m', label: '30 minutes' },
  { value: '1h', label: '1 hour' }, { value: '3h', label: '3 hours' },
  { value: '6h', label: '6 hours' }, { value: '12h', label: '12 hours' },
  { value: '24h', label: '24 hours' }, { value: '48h', label: '48 hours' },
  { value: '7d', label: '7 days' },
]

const COUNTRY_CODES = [
  { value: 'US +1',   label: 'United States (+1)' },
  { value: 'IN +91',  label: 'India (+91)' },
  { value: 'UK +44',  label: 'United Kingdom (+44)' },
  { value: 'AU +61',  label: 'Australia (+61)' },
  { value: 'DE +49',  label: 'Germany (+49)' },
  { value: 'AE +971', label: 'UAE (+971)' },
  { value: 'SA +966', label: 'Saudi Arabia (+966)' },
  { value: 'SG +65',  label: 'Singapore (+65)' },
]

// ─── Utilities ───────────────────────────────────────────────────────────────

function extractVariables(text) {
  if (!text) return []
  return [...new Set([...text.matchAll(/\{\{(\d+)\}\}/g)].map(m => parseInt(m[1])))].sort((a, b) => a - b)
}

function parseWAText(text, samples = {}) {
  if (!text) return null
  let s = text.replace(/\{\{(\d+)\}\}/g, (_, n) => samples[n] ? `\x00S:${samples[n]}\x00` : `{{${n}}}`)
  const parts = []
  s.split(/(\*[^*\n]+\*|_[^_\n]+_|~[^~\n]+~|`[^`\n]+`|\x00S:[^\x00]+\x00|\{\{\d+\}\})/g).forEach((t, i) => {
    if (!t) return
    if (t.startsWith('\x00S:')) parts.push(<span key={i} className="bg-blue-100 text-blue-700 rounded px-0.5 text-[11px]">{t.slice(3, -1)}</span>)
    else if (/^\{\{\d+\}\}$/.test(t)) parts.push(<span key={i} className="bg-amber-100 text-amber-800 rounded px-0.5 font-mono text-[10px]">{t}</span>)
    else if (t.startsWith('*') && t.endsWith('*')) parts.push(<strong key={i}>{t.slice(1, -1)}</strong>)
    else if (t.startsWith('_') && t.endsWith('_')) parts.push(<em key={i}>{t.slice(1, -1)}</em>)
    else if (t.startsWith('~') && t.endsWith('~')) parts.push(<s key={i}>{t.slice(1, -1)}</s>)
    else if (t.startsWith('`') && t.endsWith('`')) parts.push(<code key={i} className="font-mono bg-slate-100 rounded px-0.5 text-[11px]">{t.slice(1, -1)}</code>)
    else parts.push(<span key={i}>{t}</span>)
  })
  return parts
}

const MEDIA_ICONS = { image: '🖼', video: '▶', document: '📄', location: '📍' }

// ─── Status Badge ─────────────────────────────────────────────────────────────

function StatusBadge({ status }) {
  const cfg = {
    approved: 'badge-green',
    pending:  'badge-amber',
    rejected: 'badge-red',
    draft:    'badge-gray',
  }[status] || 'badge-gray'
  const label = { approved: 'Approved', pending: 'Pending', rejected: 'Rejected', draft: 'Draft' }[status] || status
  return <span className={`badge ${cfg}`}>{label}</span>
}

// ─── Category Badge ───────────────────────────────────────────────────────────

function CatBadge({ category }) {
  const cfg = {
    MARKETING:      'bg-primary-50 text-primary border border-primary-100',
    UTILITY:        'bg-amber-50 text-amber-700 border border-amber-200',
    AUTHENTICATION: 'bg-emerald-50 text-emerald-700 border border-emerald-200',
  }[category] || 'bg-slate-100 text-slate-600'
  const label = { MARKETING: 'Marketing', UTILITY: 'Utility', AUTHENTICATION: 'Auth' }[category] || category
  return <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold ${cfg}`}>{label}</span>
}

// ─── Phone Preview ────────────────────────────────────────────────────────────

function PhonePreview({ form }) {
  const bSamples = useMemo(() => {
    const s = {}
    extractVariables(form.body || '').forEach(n => { s[n] = form.samples?.[`b${n}`] || '' })
    return s
  }, [form.body, form.samples])

  const hSamples = useMemo(() => {
    const s = {}
    extractVariables(form.headerText || '').forEach(n => { s[n] = form.samples?.[`h${n}`] || '' })
    return s
  }, [form.headerText, form.samples])

  const hasMedia = form.mediaSample && form.mediaSample !== 'none'
  const ctaBtns  = (form.buttons || []).filter(b => b.kind !== 'custom')
  const qrBtns   = (form.buttons || []).filter(b => b.kind === 'custom')

  const btnLabel = { url: 'Visit Website', phone: 'Call Phone', wa_call: 'WhatsApp Call', copy_code: 'Copy Code' }
  const btnIcon  = { url: '🔗', phone: '📞', wa_call: '📲', copy_code: '📋' }

  return (
    <div className="flex flex-col items-center w-full">
      {/* Label */}
      <div className="flex items-center gap-2 mb-4 w-full">
        <div className="flex-1 h-px bg-surface-border" />
        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest whitespace-nowrap">Live Preview</span>
        <div className="flex-1 h-px bg-surface-border" />
      </div>

      {/* Phone shell */}
      <div className="w-[220px] bg-[#18181b] rounded-[40px] shadow-2xl p-[6px] ring-1 ring-white/10">
        {/* Screen */}
        <div className="rounded-[34px] overflow-hidden bg-[#eae6df] flex flex-col">

          {/* Status bar */}
          <div className="flex items-center justify-between px-4 pt-2.5 pb-1 bg-[#075e54]">
            <span className="text-[9px] font-bold text-white/90">9:41</span>
            <div className="w-16 h-3.5 bg-[#18181b] rounded-full mx-auto absolute left-1/2 -translate-x-1/2 top-[6px]" />
            <div className="flex items-center gap-1">
              <svg width="10" height="8" viewBox="0 0 10 8" fill="white" opacity="0.9"><rect x="0" y="3" width="2" height="5"/><rect x="3" y="2" width="2" height="6"/><rect x="6" y="1" width="2" height="7"/><rect x="9" y="0" width="1" height="8"/></svg>
              <svg width="10" height="8" viewBox="0 0 12 9" fill="none" stroke="white" strokeWidth="1.5" opacity="0.9"><path d="M1 7 Q6 1 11 7"/><path d="M3 7 Q6 3 9 7"/><circle cx="6" cy="7" r="1" fill="white" stroke="none"/></svg>
              <svg width="14" height="8" viewBox="0 0 18 10" fill="none" opacity="0.9"><rect x="0" y="1" width="15" height="8" rx="2" stroke="white" strokeWidth="1.2"/><rect x="1.5" y="2.5" width="9" height="5" rx="1" fill="white"/><rect x="15.5" y="3.5" width="2" height="3" rx="0.5" fill="white"/></svg>
            </div>
          </div>

          {/* WhatsApp chat header */}
          <div className="bg-[#075e54] px-3 pb-2.5 flex items-center gap-2.5">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" opacity="0.8"><path d="M15 18l-6-6 6-6"/></svg>
            <div className="w-8 h-8 rounded-full bg-emerald-600 flex items-center justify-center text-white text-xs font-bold flex-shrink-0 ring-2 ring-white/20">B</div>
            <div className="flex-1 min-w-0">
              <div className="text-[11px] font-bold text-white leading-tight truncate">Your Business</div>
              <div className="text-[9px] text-emerald-200 leading-tight">Business Account · via WhatsApp</div>
            </div>
            <div className="flex items-center gap-2 opacity-80">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round"><path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07A19.5 19.5 0 013.24 9.09 19.79 19.79 0 01.19 0.38 2 2 0 012.18 0h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L6.91 7.09a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 16.92z"/></svg>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/><circle cx="5" cy="12" r="1"/></svg>
            </div>
          </div>

          {/* Chat background */}
          <div className="flex-1 px-3 py-3 space-y-2 min-h-[200px] bg-[#eae6df]"
            style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='60' height='60'%3E%3Ccircle cx='30' cy='30' r='28' fill='none' stroke='%23c8bdb0' stroke-width='0.5' opacity='0.3'/%3E%3C/svg%3E\")" }}>

            {/* Date chip */}
            <div className="flex justify-center">
              <span className="text-[9px] bg-white/60 text-slate-500 px-2.5 py-0.5 rounded-full font-medium shadow-sm">Today</span>
            </div>

            {/* Message bubble */}
            <div className="flex justify-end">
              <div className="max-w-[85%] min-w-[100px]">
                {/* Bubble */}
                <div className="bg-[#dcf8c6] rounded-[12px_12px_2px_12px] shadow-sm overflow-hidden">
                  {/* Media placeholder */}
                  {hasMedia && (
                    <div className={clsx(
                      'h-24 flex flex-col items-center justify-center gap-1',
                      form.mediaSample === 'image'    ? 'bg-slate-200' :
                      form.mediaSample === 'video'    ? 'bg-slate-700' :
                      form.mediaSample === 'document' ? 'bg-slate-100' : 'bg-slate-100'
                    )}>
                      <span className="text-2xl">{MEDIA_ICONS[form.mediaSample]}</span>
                      <span className={clsx('text-[9px] font-medium capitalize', form.mediaSample === 'video' ? 'text-slate-300' : 'text-slate-500')}>
                        {form.mediaSample} file
                      </span>
                    </div>
                  )}

                  <div className="px-2.5 pt-2 pb-1">
                    {/* Header text */}
                    {!hasMedia && form.headerText && (
                      <p className="text-[11px] font-bold text-[#111] mb-1 leading-snug">
                        {parseWAText(form.headerText, hSamples)}
                      </p>
                    )}
                    {/* Body */}
                    <div className="text-[10.5px] text-[#111] leading-[1.5] whitespace-pre-wrap break-words">
                      {form.body
                        ? parseWAText(form.body, bSamples)
                        : <span className="text-slate-400 italic text-[10px]">Your message will appear here…</span>
                      }
                    </div>
                    {/* Footer */}
                    {form.footer && (
                      <p className="text-[9px] text-slate-400 mt-1 leading-tight">{form.footer}</p>
                    )}
                    {/* Timestamp */}
                    <div className="flex items-center justify-end gap-1 mt-1">
                      <span className="text-[8px] text-slate-400">11:59</span>
                      <svg width="12" height="8" viewBox="0 0 16 10" fill="#53bdeb"><path d="M1 5l3 3 5-7"/><path d="M6 5l3 3 5-7"/></svg>
                    </div>
                  </div>

                  {/* CTA buttons inside bubble */}
                  {ctaBtns.length > 0 && (
                    <div className="border-t border-[#c8e6b5]">
                      {ctaBtns.map((b, i) => (
                        <div key={b.id} className={clsx(
                          'flex items-center justify-center gap-1.5 py-2 text-[10px] font-semibold text-[#128c7e]',
                          i > 0 && 'border-t border-[#c8e6b5]'
                        )}>
                          <span className="text-[11px]">{btnIcon[b.kind]}</span>
                          <span className="truncate max-w-[140px]">{b.text || btnLabel[b.kind] || 'Button'}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Quick reply chips — below the bubble */}
                {qrBtns.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-1.5 justify-end">
                    {qrBtns.map(b => (
                      <div key={b.id} className="bg-white rounded-[10px] px-2.5 py-1 text-[9.5px] font-semibold text-[#128c7e] shadow-sm border border-[#d1e8cf] whitespace-nowrap">
                        {b.text || 'Quick Reply'}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Input bar */}
          <div className="bg-[#f0f0f0] px-3 py-2 flex items-center gap-2 border-t border-[#d4d4d4]/50">
            <div className="flex-1 bg-white rounded-full px-3 py-1.5 text-[9px] text-slate-300 shadow-sm">Type a message</div>
            <div className="w-7 h-7 rounded-full bg-[#25d366] flex items-center justify-center shadow-sm">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="white"><path d="M22 2L11 13"/><path d="M22 2L15 22l-4-9-9-4 20-7z" stroke="white" fill="white" strokeWidth="0"/></svg>
            </div>
          </div>

        </div>
      </div>
    </div>
  )
}

// ─── Validation Checklist ─────────────────────────────────────────────────────

function ValidationPanel({ form }) {
  const bodyVars    = extractVariables(form.body || '')
  const headerVars  = extractVariables(form.headerText || '')
  const allSampleKeys = [...bodyVars.map(n => `b${n}`), ...headerVars.map(n => `h${n}`)]
  const missingSamples = allSampleKeys.filter(k => !form.samples?.[k]?.trim()).length
  const hasMedia    = form.mediaSample && form.mediaSample !== 'none'
  const urlBtns     = (form.buttons || []).filter(b => b.kind === 'url')
  const phoneBtns   = (form.buttons || []).filter(b => b.kind === 'phone')
  const qrTexts     = (form.buttons || []).filter(b => b.kind === 'custom').map(b => (b.text || '').trim().toLowerCase())
  const hasDupQr    = new Set(qrTexts).size !== qrTexts.length

  const checks = [
    { label: 'Template name',    ok: !!(form.name && /^[a-z0-9_]+$/.test(form.name)),      detail: !form.name ? 'Required' : !/^[a-z0-9_]+$/.test(form.name) ? 'Lowercase & underscores only' : `${form.name.length}/512` },
    { label: 'Body content',     ok: !!(form.body?.trim()),                                  detail: form.body?.trim() ? `${form.body.length}/1024 chars` : 'Required' },
    { label: 'Sample values',    ok: allSampleKeys.length === 0 || missingSamples === 0,    detail: allSampleKeys.length === 0 ? 'No variables' : `${allSampleKeys.length - missingSamples}/${allSampleKeys.length} filled` },
    { label: 'Media upload',     ok: !hasMedia || !!(form.mediaUrl),                         detail: !hasMedia ? 'Not required' : form.mediaUrl ? 'Uploaded ✓' : 'Upload required' },
    { label: 'Button limits',    ok: (form.buttons || []).length <= 10 && urlBtns.length <= 2 && phoneBtns.length <= 1 && !hasDupQr, detail: `${(form.buttons || []).length}/10 buttons${hasDupQr ? ' · Duplicate QR' : ''}` },
    { label: 'Variable sequence',ok: bodyVars.every((v, i) => v === i + 1),                  detail: bodyVars.length === 0 ? 'No variables' : bodyVars.every((v, i) => v === i + 1) ? `${bodyVars.length} var(s) ✓` : 'Non-sequential!' },
  ]
  const allOk = checks.every(c => c.ok)

  return (
    <div className="bg-white rounded-xl border border-surface-border overflow-hidden">
      <div className="flex items-center justify-between px-4 py-2.5 bg-slate-50 border-b border-surface-border">
        <span className="text-xs font-semibold text-slate-700">Submission Checklist</span>
        <span className={clsx('text-[11px] font-bold', allOk ? 'text-emerald-600' : 'text-red-500')}>
          {allOk ? '✓ Ready' : `${checks.filter(c => !c.ok).length} issue(s)`}
        </span>
      </div>
      <div className="divide-y divide-slate-50">
        {checks.map((c, i) => (
          <div key={i} className="flex items-start gap-2.5 px-4 py-2">
            <div className={clsx('w-4 h-4 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 text-[8px] font-black',
              c.ok ? 'bg-emerald-100 text-emerald-600' : 'bg-red-100 text-red-500'
            )}>
              {c.ok ? '✓' : '✗'}
            </div>
            <div className="min-w-0">
              <div className="text-[11px] font-medium text-slate-700">{c.label}</div>
              <div className={clsx('text-[10px]', c.ok ? 'text-slate-400' : 'text-red-500')}>{c.detail}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Section Card ─────────────────────────────────────────────────────────────

function SectionCard({ title, subtitle, children }) {
  return (
    <div className="bg-white rounded-xl border border-surface-border overflow-hidden">
      <div className="px-4 py-3 border-b border-surface-border">
        <div className="text-sm font-semibold text-slate-800">{title}</div>
        {subtitle && <div className="text-xs text-slate-500 mt-0.5">{subtitle}</div>}
      </div>
      <div className="p-4">{children}</div>
    </div>
  )
}

// ─── Field Label ──────────────────────────────────────────────────────────────

function FieldLabel({ children, optional, count, max, info }) {
  return (
    <div className="flex items-center justify-between mb-1.5">
      <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-700">
        {children}
        {optional && <span className="font-normal text-slate-400">· Optional</span>}
        {info && (
          <span className="inline-flex items-center justify-center w-3.5 h-3.5 rounded-full bg-slate-100 border border-slate-200 text-[8px] text-slate-400 cursor-help font-bold" title={info}>i</span>
        )}
      </div>
      {count !== undefined && (
        <span className={clsx('text-[10px]', count > (max * 0.9) ? 'text-red-500' : 'text-slate-400')}>{count}/{max}</span>
      )}
    </div>
  )
}

// ─── Step 1: Setup ────────────────────────────────────────────────────────────

function SetupStep({ form, setForm }) {
  const catDef = CATEGORY_DEFS.find(c => c.value === form.category)

  function setCategory(cat) {
    const def = CATEGORY_DEFS.find(c => c.value === cat)
    setForm(f => ({ ...f, category: cat, subType: def.subTypes[0].value }))
  }

  return (
    <div className="flex-1 overflow-y-auto bg-surface">
      <div className="max-w-3xl mx-auto px-6 py-10">

        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-primary-50 border border-primary/20 rounded-full mb-3">
            <div className="w-1.5 h-1.5 rounded-full bg-primary" />
            <span className="text-[10px] font-bold text-primary uppercase tracking-widest">Step 1 of 3</span>
          </div>
          <h2 className="text-xl font-bold text-slate-900 mb-2">What type of template?</h2>
          <p className="text-sm text-slate-500 max-w-md mx-auto leading-relaxed">
            Choose a category that best describes your message. Meta uses this to determine pricing and approval.
          </p>
        </div>

        {/* Category cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
          {CATEGORY_DEFS.map(cat => {
            const isSelected = form.category === cat.value
            return (
              <button key={cat.value} type="button" onClick={() => setCategory(cat.value)}
                className={clsx(
                  'relative p-5 border-2 rounded-xl text-left transition-all outline-none cursor-pointer',
                  isSelected ? cat.color + ' shadow-sm' : 'border-surface-border bg-white hover:border-slate-300 hover:shadow-sm'
                )}>
                {/* Badge */}
                {cat.badge && (
                  <div className={clsx('absolute -top-px left-4 px-2 py-0.5 rounded-b-lg text-[10px] font-bold', cat.badgeColor)}>
                    {cat.badge}
                  </div>
                )}
                {/* Check */}
                {isSelected && (
                  <div className="absolute top-3 right-3 w-5 h-5 rounded-full bg-primary flex items-center justify-center">
                    <Check size={10} className="text-white" strokeWidth={3} />
                  </div>
                )}
                {/* Icon */}
                <div className={clsx(
                  'w-11 h-11 rounded-xl flex items-center justify-center text-xl mb-3 transition-colors',
                  isSelected ? 'bg-white/60' : 'bg-surface'
                )}>
                  {cat.icon}
                </div>
                <div className={clsx('text-sm font-bold mb-1.5', isSelected ? cat.accent : 'text-slate-800')}>
                  {cat.label}
                </div>
                <div className="text-xs text-slate-500 leading-relaxed">{cat.desc}</div>
              </button>
            )
          })}
        </div>

        {/* Subtype */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-4">
            <div className="flex-1 h-px bg-surface-border" />
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-widest whitespace-nowrap">Select template type</span>
            <div className="flex-1 h-px bg-surface-border" />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {catDef?.subTypes.map(st => {
              const isSelected = form.subType === st.value
              return (
                <button key={st.value} type="button"
                  onClick={() => setForm(f => ({ ...f, subType: st.value }))}
                  className={clsx(
                    'flex items-start gap-3 p-3.5 border-2 rounded-xl text-left transition-all outline-none cursor-pointer',
                    isSelected ? 'border-primary bg-primary-50' : 'border-surface-border bg-white hover:border-slate-300'
                  )}>
                  <div className={clsx(
                    'w-8 h-8 rounded-lg flex items-center justify-center text-base flex-shrink-0',
                    isSelected ? 'bg-primary/10' : 'bg-surface'
                  )}>
                    {st.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className={clsx('text-xs font-semibold', isSelected ? 'text-primary' : 'text-slate-800')}>{st.label}</span>
                      {isSelected && <Check size={11} className="text-primary" strokeWidth={3} />}
                    </div>
                    <div className="text-[11px] text-slate-500 leading-snug">{st.desc}</div>
                  </div>
                </button>
              )
            })}
          </div>
        </div>

      </div>
    </div>
  )
}

// ─── Drag-drop Upload ─────────────────────────────────────────────────────────

function DragDropUpload({ type, value, onChange }) {
  const [drag, setDrag] = useState(false)
  const ref = useRef(null)
  function handleFile(f) { if (f) onChange(URL.createObjectURL(f)) }
  return (
    <div
      onClick={() => ref.current?.click()}
      onDragOver={e => { e.preventDefault(); setDrag(true) }}
      onDragLeave={() => setDrag(false)}
      onDrop={e => { e.preventDefault(); setDrag(false); handleFile(e.dataTransfer.files[0]) }}
      className={clsx(
        'border-2 border-dashed rounded-xl p-5 text-center cursor-pointer transition-all',
        drag ? 'border-primary bg-primary-50' :
        value ? 'border-emerald-400 bg-emerald-50' :
        'border-surface-border bg-surface hover:border-primary/40 hover:bg-primary-50/30'
      )}>
      <input ref={ref} type="file"
        accept={type === 'image' ? 'image/*' : type === 'video' ? 'video/*' : '.pdf,.doc,.docx'}
        className="hidden"
        onChange={e => handleFile(e.target.files[0])} />
      {value ? (
        <div className="flex items-center justify-center gap-2">
          <span className="text-lg">{MEDIA_ICONS[type]}</span>
          <span className="text-xs text-emerald-600 font-medium">File uploaded ✓</span>
          <button type="button" onClick={e => { e.stopPropagation(); onChange('') }}
            className="text-[11px] text-red-500 hover:text-red-700 font-medium transition-colors">Remove</button>
        </div>
      ) : (
        <div>
          <Upload size={18} className="text-slate-300 mx-auto mb-1.5" />
          <p className="text-xs text-slate-600 mb-0.5">Drag and drop to upload</p>
          <p className="text-[11px] text-primary font-medium">Or choose from your device</p>
        </div>
      )}
    </div>
  )
}

// ─── Button Builder ───────────────────────────────────────────────────────────

const BUTTON_TYPES = [
  { kind: 'custom',     label: 'Quick Reply',   icon: '💬', max: 10 },
  { kind: 'url',        label: 'Visit Website', icon: '🔗', max: 2  },
  { kind: 'phone',      label: 'Call Phone',    icon: '📞', max: 1  },
  { kind: 'copy_code',  label: 'Copy Code',     icon: '📋', max: 1  },
  { kind: 'wa_call',    label: 'WhatsApp Call', icon: '📲', max: 1  },
]

function ButtonBuilder({ buttons, setButtons }) {
  const dragIdx = useRef(null)
  const [overIdx, setOverIdx] = useState(null)

  function addButton(kind) {
    setButtons([...buttons, { id: Date.now().toString(), kind, text: '', url: '', phone: '', code: '', urlType: 'static', countryCode: 'IN +91' }])
  }
  function updateButton(id, key, val) {
    setButtons(buttons.map(b => b.id === id ? { ...b, [key]: val } : b))
  }
  function removeButton(id) {
    setButtons(buttons.filter(b => b.id !== id))
  }

  function onDragStart(idx) {
    dragIdx.current = idx
  }
  function onDragOver(e, idx) {
    e.preventDefault()
    if (dragIdx.current === null || dragIdx.current === idx) return
    setOverIdx(idx)
  }
  function onDrop(idx) {
    if (dragIdx.current === null || dragIdx.current === idx) { setOverIdx(null); return }
    const next = [...buttons]
    const [moved] = next.splice(dragIdx.current, 1)
    next.splice(idx, 0, moved)
    setButtons(next)
    dragIdx.current = null
    setOverIdx(null)
  }
  function onDragEnd() {
    dragIdx.current = null
    setOverIdx(null)
  }

  return (
    <div className="space-y-2">
      {buttons.map((b, idx) => (
        <div
          key={b.id}
          draggable
          onDragStart={() => onDragStart(idx)}
          onDragOver={e => onDragOver(e, idx)}
          onDrop={() => onDrop(idx)}
          onDragEnd={onDragEnd}
          className={clsx(
            'border rounded-xl p-3 space-y-2 bg-slate-50/50 transition-all',
            overIdx === idx ? 'border-primary border-dashed bg-primary-50/40 scale-[1.01]' : 'border-surface-border',
            dragIdx.current === idx ? 'opacity-40' : 'opacity-100',
          )}
        >
          <div className="flex items-center gap-2">
            {/* Drag handle */}
            <div
              className="flex flex-col gap-[3px] cursor-grab active:cursor-grabbing px-0.5 flex-shrink-0 opacity-30 hover:opacity-70 transition-opacity"
              title="Drag to reorder"
            >
              {[0,1,2].map(i => (
                <div key={i} className="flex gap-[3px]">
                  <div className="w-[3px] h-[3px] rounded-full bg-slate-500" />
                  <div className="w-[3px] h-[3px] rounded-full bg-slate-500" />
                </div>
              ))}
            </div>
            <span className="text-xs font-medium text-slate-400 w-4 text-center flex-shrink-0">{idx + 1}</span>
            <input className="input text-xs flex-1" placeholder="Button label"
              value={b.text} onChange={e => updateButton(b.id, 'text', e.target.value)} />
            <span className="text-[10px] text-slate-400 bg-slate-100 px-2 py-1 rounded-full whitespace-nowrap flex-shrink-0">
              {BUTTON_TYPES.find(t => t.kind === b.kind)?.label || b.kind}
            </span>
            <button type="button" onClick={() => removeButton(b.id)} className="p-1 text-slate-300 hover:text-red-400 transition-colors flex-shrink-0">
              <X size={13} />
            </button>
          </div>

          {/* Extra fields — indent past drag handle + number */}
          <div className="pl-9">
            {b.kind === 'url' && (
              <div className="space-y-1.5">
                <div className="flex gap-2">
                  {['static','dynamic'].map(t => (
                    <button key={t} type="button"
                      onClick={() => updateButton(b.id, 'urlType', t)}
                      className={clsx('px-2.5 py-1 rounded-full text-[10px] font-medium border transition-colors',
                        b.urlType === t ? 'bg-primary text-white border-primary' : 'bg-white text-slate-500 border-slate-200 hover:border-primary'
                      )}>{t === 'static' ? 'Static URL' : 'Dynamic URL'}</button>
                  ))}
                </div>
                <input className="input text-xs" placeholder={b.urlType === 'static' ? 'https://example.com' : 'https://example.com/{{1}}'}
                  value={b.url} onChange={e => updateButton(b.id, 'url', e.target.value)} />
                {b.urlType === 'dynamic' && (
                  <input className="input text-xs" placeholder="Sample value for {{1}}"
                    value={b.dynamicSample || ''} onChange={e => updateButton(b.id, 'dynamicSample', e.target.value)} />
                )}
              </div>
            )}
            {b.kind === 'phone' && (
              <div className="flex gap-2">
                <NativeSelect sm className="w-40"
                  value={b.countryCode} onChange={e => updateButton(b.id, 'countryCode', e.target.value)}>
                  {COUNTRY_CODES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                </NativeSelect>
                <input className="input text-xs flex-1" placeholder="Phone number"
                  value={b.phone} onChange={e => updateButton(b.id, 'phone', e.target.value)} />
              </div>
            )}
            {b.kind === 'copy_code' && (
              <input className="input text-xs w-full" placeholder="Coupon code e.g. SAVE20"
                value={b.code} onChange={e => updateButton(b.id, 'code', e.target.value)} />
            )}
          </div>
        </div>
      ))}

      {/* Add button chips */}
      {buttons.length < 10 && (
        <div className="flex flex-wrap gap-2 pt-1">
          {BUTTON_TYPES.filter(t => {
            const count = buttons.filter(b => b.kind === t.kind).length
            return count < t.max
          }).map(t => (
            <button key={t.kind} type="button" onClick={() => addButton(t.kind)}
              className="flex items-center gap-1 px-2.5 py-1.5 border border-dashed border-slate-200 rounded-lg text-[11px] text-slate-500 hover:border-primary hover:text-primary hover:bg-primary-50 transition-colors">
              <Plus size={10} /> {t.icon} {t.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── AI Assist ───────────────────────────────────────────────────────────────

const AI_CAT_LABELS = { MARKETING: 'Marketing', UTILITY: 'Utility', AUTHENTICATION: 'Authentication' }

const PROMO_KEYWORDS = [
  'sale','save','off','discount','offer','deal','free','shop now','buy now',
  'order now','hurry','limited time','exclusive','amazing','incredible','special',
  "don't miss",'grab','claim','act now','promotion','promo','win','gift','reward',
  'flash','clearance','bonus','savings','biggest','lowest price','best deal',
  'shop','buy','get it now','limited','mega','huge'
]

function detectPromoKeywords(text) {
  if (!text) return []
  const lower = text.toLowerCase()
  return [...new Set(PROMO_KEYWORDS.filter(kw => lower.includes(kw)))]
}

const PROMO_SUBS = [
  // Emojis
  [/[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu, ''],
  // Hype adjectives before a noun — replace so noun stays readable
  [/\b(amazing|incredible|fantastic|awesome|spectacular|unbelievable)\s+/gi, ''],
  [/\b(huge|massive|mega|biggest|greatest)\s+/gi, ''],
  // "X and save big" → "and save"
  [/\s+and\s+save\s+(big|more|huge|massively)\b/gi, ' and save'],
  // Action CTAs that have no factual value → remove
  [/[,.]?\s*\b(shop now|buy now|order now|act now|grab now|claim now|get it now|get yours now)\b[,.]?/gi, ''],
  // Urgency phrases → neutral qualifier
  [/\b(don'?t miss out|don'?t miss|hurry|limited time only|for a limited time|while supplies last)\b/gi, 'available for a limited period'],
  // Promo labels
  [/\b(exclusive offer|special offer|special deal|best deal|mega deal)\b/gi, 'offer'],
  [/\b(flash sale|clearance sale|mega sale|big sale|huge sale)\b/gi, 'sale'],
  // Exclamations
  [/!+/g, '.'],
  // Clean up
  [/\s{2,}/g, ' '],
]

function cleanForUtility(text) {
  let t = text
  for (const [re, sub] of PROMO_SUBS) t = t.replace(re, sub)
  // Fix punctuation artifacts
  t = t.replace(/[,\s]*\.\s*\./g, '.')
         .replace(/\s+,/g, ',')
         .replace(/\s+\./g, '.')
         // Remove orphan "and"/"or" left after a CTA was stripped
         .replace(/\.\s+and\s+/g, '. ')
         .replace(/\.\s+or\s+/g, '. ')
         // Remove sentence-starting "and/or"
         .replace(/^(and|or)\s+/i, '')
         .replace(/\s{2,}/g, ' ')
         .trim()
  return t.charAt(0).toUpperCase() + t.slice(1)
}

function aiGenerateVariations(text, targetCat) {
  if (targetCat === 'UTILITY') {
    const clean = cleanForUtility(text).replace(/\.$/, '')
    return [
      `Hi {{1}},\n\nWe'd like to inform you: ${clean}.\n\nFor any queries, please contact our support team.`,
      `Dear {{1}},\n\nPlease note: ${clean}.\n\nKindly review the details and take action if required. Thank you for choosing us.`,
      `Hi {{1}},\n\nImportant update: ${clean}.\n\nIf you need assistance, reply to this message or visit our help center.`,
    ]
  }

  if (targetCat === 'MARKETING') {
    const core = text.replace(/[.!]+$/, '').trim()
    return [
      `🎉 Hey {{1}}! ${core} — and it's only for a limited time! Don't miss out. Tap below to get started now! 🚀`,
      `✨ Exclusive for you, {{1}}! ${core}. 💫 Hurry, this won't last long! Reply YES to claim your offer now.`,
      `🔥 Special deal just for you, {{1}}! ${core}. 🎁 Act now — grab it before it's gone!`,
    ]
  }

  if (targetCat === 'AUTHENTICATION') {
    return [
      `Your verification code is: {{1}}\n\nThis code expires in 10 minutes. Do not share it with anyone.`,
      `{{1}} is your one-time password (OTP). Valid for 10 minutes.\n\nIf you didn't request this, please contact support immediately.`,
      `Security code: {{1}}\n\nEnter this code to complete verification. It expires in 10 minutes. Never share it with anyone.`,
    ]
  }

  return [cleanForUtility(text)]
}

function HighlightedText({ text, keywords }) {
  if (!keywords.length || !text) return <span className="text-[10px] text-slate-600 font-mono leading-relaxed whitespace-pre-wrap">{text}</span>
  const escaped = keywords.map(k => k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')
  const regex = new RegExp(`(${escaped})`, 'gi')
  const parts = text.split(regex)
  return (
    <span className="text-[10px] font-mono leading-relaxed whitespace-pre-wrap">
      {parts.map((p, i) =>
        regex.test(p)
          ? <mark key={i} className="bg-amber-200 text-amber-900 rounded px-0.5 not-italic">{p}</mark>
          : <span key={i} className="text-slate-600">{p}</span>
      )}
    </span>
  )
}

function AIAssistPopup({ body, onApply, currentCategory, onClose }) {
  const [targetCat,  setTargetCat]  = useState(currentCategory === 'MARKETING' ? 'UTILITY' : 'MARKETING')
  const [generating, setGenerating] = useState(false)
  const [variations, setVariations] = useState([])
  const [applied,    setApplied]    = useState(null)
  const ref = useRef()
  const keywords = detectPromoKeywords(body)

  useEffect(() => {
    const fn = e => { if (ref.current && !ref.current.contains(e.target)) onClose() }
    document.addEventListener('mousedown', fn)
    return () => document.removeEventListener('mousedown', fn)
  }, [onClose])

  function handleGenerate() {
    if (!body?.trim()) return
    setGenerating(true)
    setVariations([])
    setApplied(null)
    setTimeout(() => {
      setVariations(aiGenerateVariations(body, targetCat))
      setGenerating(false)
    }, 850)
  }

  function handleApply(v) {
    onApply(v.slice(0, 1024))
    setApplied(v)
  }

  const allCats = ['MARKETING', 'UTILITY', 'AUTHENTICATION']

  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center bg-black/30 backdrop-blur-[2px]">
      <div ref={ref} className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-xl mx-4 max-h-[85vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center gap-3 px-5 py-4 border-b border-slate-100">
          <div className="flex items-center justify-center w-8 h-8 rounded-xl bg-primary/10">
            <Sparkles size={14} className="text-primary" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-bold text-slate-900">AI Rewrite Assist</p>
            <p className="text-[10px] text-slate-400">Rewrite your content for a different category or tone</p>
          </div>
          <button type="button" onClick={onClose} className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-slate-100 text-slate-400 transition-colors">
            <X size={14} />
          </button>
        </div>

        <div className="overflow-y-auto flex-1 p-5 space-y-4">
          {/* Current content with keyword highlights */}
          <div>
            <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-widest mb-2">Your current content</p>
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 leading-relaxed">
              <HighlightedText text={body || ''} keywords={keywords} />
            </div>
            {keywords.length > 0 && (
              <div className="mt-2 flex items-start gap-2">
                <AlertCircle size={12} className="text-amber-500 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-[10px] text-amber-700 font-semibold">Promotional keywords detected — highlighted above</p>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {keywords.map(k => (
                      <span key={k} className="px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 text-[9px] font-semibold">{k}</span>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Target category picker */}
          <div>
            <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-widest mb-2">Rewrite as</p>
            <div className="flex gap-2 flex-wrap">
              {allCats.map(c => (
                <button
                  key={c}
                  type="button"
                  onClick={() => { setTargetCat(c); setVariations([]); setApplied(null) }}
                  className={clsx('flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-[11px] font-semibold transition-colors',
                    targetCat === c
                      ? 'bg-primary text-white border-primary shadow-sm'
                      : 'bg-white text-slate-600 border-slate-200 hover:border-primary hover:text-primary'
                  )}
                >
                  {c === currentCategory && <span className="text-[8px] opacity-60">(current)</span>}
                  {AI_CAT_LABELS[c]}
                </button>
              ))}
            </div>
            {targetCat === currentCategory && (
              <p className="text-[10px] text-slate-400 mt-1.5">Will generate tone/style variations within the same category.</p>
            )}
          </div>

          {/* Generate button */}
          <button
            type="button"
            onClick={handleGenerate}
            disabled={generating || !body?.trim()}
            className={clsx('w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-[12px] font-semibold transition-all',
              generating || !body?.trim()
                ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                : 'bg-primary text-white hover:bg-primary-hover shadow-sm hover:shadow'
            )}
          >
            <Wand2 size={13} />
            {generating ? `Writing ${AI_CAT_LABELS[targetCat]} variations…` : `Generate ${AI_CAT_LABELS[targetCat]} variations`}
          </button>

          {/* Spinner */}
          {generating && (
            <div className="flex items-center justify-center gap-2 py-2">
              <RefreshCw size={13} className="text-primary animate-spin" />
              <span className="text-[11px] text-primary font-medium">AI is rewriting your content…</span>
            </div>
          )}

          {/* Variations */}
          {!generating && variations.length > 0 && (
            <div className="space-y-3">
              <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-widest">{variations.length} variations — pick one to use</p>
              {variations.map((v, i) => (
                <div key={i} className={clsx(
                  'rounded-xl border p-3 transition-all',
                  applied === v ? 'border-primary bg-primary/5 ring-1 ring-primary/20' : 'border-slate-200 bg-slate-50 hover:border-primary/40 hover:bg-white'
                )}>
                  <p className="text-[10px] text-slate-700 font-mono leading-relaxed whitespace-pre-wrap mb-2">{v}</p>
                  <div className="flex items-center justify-between">
                    <span className="text-[9px] text-slate-400">Variation {i + 1}</span>
                    <button
                      type="button"
                      onClick={() => handleApply(v)}
                      className={clsx('flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-semibold transition-colors',
                        applied === v
                          ? 'bg-primary text-white'
                          : 'bg-primary-50 text-primary hover:bg-primary-100 border border-primary/20'
                      )}
                    >
                      {applied === v ? <><Check size={9}/> Applied</> : 'Use this'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-slate-100 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg text-[11px] font-semibold text-slate-600 hover:bg-slate-100 transition-colors">
            Close
          </button>
          {applied && (
            <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg text-[11px] font-semibold bg-primary text-white hover:bg-primary-hover transition-colors">
              Done
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Step 2: Edit ─────────────────────────────────────────────────────────────

function EditStep({ form, setForm }) {
  const taRef = useRef(null)
  const [showAIAssist, setShowAIAssist] = useState(false)
  const bodyVars   = extractVariables(form.body || '')
  const headerVars = extractVariables(form.headerText || '')
  const isAuth     = form.category === 'AUTHENTICATION'
  const promoKws   = detectPromoKeywords(form.body || '')

  function wrapBody(pre, suf) {
    const ta = taRef.current; if (!ta) return
    const s = ta.selectionStart, e = ta.selectionEnd
    const next = (form.body || '').slice(0, s) + pre + (form.body || '').slice(s, e) + suf + (form.body || '').slice(e)
    setForm(f => ({ ...f, body: next }))
    setTimeout(() => { ta.focus(); ta.setSelectionRange(s + pre.length, e + pre.length) }, 0)
  }

  function addBodyVar() {
    const vars = extractVariables(form.body || '')
    const next = vars.length ? Math.max(...vars) + 1 : 1
    const ta = taRef.current
    const pos = ta ? ta.selectionStart : (form.body || '').length
    setForm(f => ({ ...f, body: (f.body || '').slice(0, pos) + `{{${next}}}` + (f.body || '').slice(pos) }))
    setTimeout(() => ta?.focus(), 0)
  }

  const allVarNums = [...bodyVars.map(n => ({ key: `b${n}`, label: `{{${n}}} (body)` })),
                      ...headerVars.map(n => ({ key: `h${n}`, label: `{{${n}}} (header)` }))]

  return (
    <div className="flex flex-1 overflow-hidden">
      {/* ── Form (left) ── */}
      <div className="flex-1 overflow-y-auto p-5 space-y-4 bg-surface">

        {/* ── Name + Language ── */}
        <SectionCard title="Template details" subtitle="Set a unique name and language for this template.">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <FieldLabel count={form.name?.length || 0} max={512}>Template name *</FieldLabel>
              <input
                className="input text-sm"
                placeholder="e.g. order_confirmation"
                value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '') }))}
              />
              <p className="text-[10px] text-slate-400 mt-1">Lowercase, underscores only. Cannot be changed after approval.</p>
            </div>
            <div>
              <FieldLabel>Language</FieldLabel>
              <NativeSelect value={form.language} onChange={e => setForm(f => ({ ...f, language: e.target.value }))}>
                {LANGUAGES.map(l => <option key={l.value} value={l.value}>{l.label}</option>)}
              </NativeSelect>
            </div>
          </div>
        </SectionCard>

        {/* Header section */}
        {!isAuth && (
          <SectionCard title="Header" subtitle="Optional. Add a title or media to your message.">
            <div className="space-y-3">
              {/* Media type selector */}
              <div className="flex flex-wrap gap-2">
                {[{v:'none',l:'None'},{v:'image',l:'🖼 Image'},{v:'video',l:'▶ Video'},{v:'document',l:'📄 Document'}].map(o => (
                  <button key={o.v} type="button"
                    onClick={() => setForm(f => ({ ...f, mediaSample: o.v, headerText: o.v !== 'none' ? '' : f.headerText }))}
                    className={clsx('px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors',
                      form.mediaSample === o.v ? 'bg-primary text-white border-primary' : 'bg-white text-slate-600 border-slate-200 hover:border-primary hover:text-primary'
                    )}>{o.l}</button>
                ))}
                <button type="button"
                  onClick={() => setForm(f => ({ ...f, mediaSample: 'none', headerText: f.headerText || '' }))}
                  className={clsx('px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors',
                    (!form.mediaSample || form.mediaSample === 'none') && form.headerText !== undefined ? 'hidden' : 'hidden'
                  )}>Text</button>
              </div>
              {/* Text header */}
              {(!form.mediaSample || form.mediaSample === 'none') && (
                <div>
                  <FieldLabel count={form.headerText?.length || 0} max={60} optional>Header text</FieldLabel>
                  <input className="input text-xs" placeholder="Header text (optional)"
                    value={form.headerText || ''} onChange={e => setForm(f => ({ ...f, headerText: e.target.value.slice(0, 60) }))} />
                </div>
              )}
              {/* Media upload */}
              {form.mediaSample && form.mediaSample !== 'none' && (
                <DragDropUpload type={form.mediaSample} value={form.mediaUrl} onChange={v => setForm(f => ({ ...f, mediaUrl: v }))} />
              )}
            </div>
          </SectionCard>
        )}

        {/* Auth OTP */}
        {isAuth && (
          <SectionCard title="OTP Configuration" subtitle="Set up code delivery and expiry settings.">
            <div className="space-y-3">
              <div>
                <FieldLabel>Code expiry</FieldLabel>
                <NativeSelect sm className="w-48" value={form.ttl || '10m'} onChange={e => setForm(f => ({ ...f, ttl: e.target.value }))}>
                  {TTL_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </NativeSelect>
              </div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" className="accent-primary rounded" checked={!!form.addSecurityRec} onChange={e => setForm(f => ({ ...f, addSecurityRec: e.target.checked }))} />
                <span className="text-xs text-slate-600">Add security recommendation text</span>
              </label>
            </div>
          </SectionCard>
        )}

        {/* Body */}
        <SectionCard title="Body" subtitle="Enter the text of your message.">
          {/* Toolbar */}
          <div className="flex items-center gap-0.5 mb-2 pb-2 border-b border-surface-border flex-wrap">
            {[
              { title: 'Bold',          onClick: () => wrapBody('*','*'),    icon: 'B', cls: 'font-bold' },
              { title: 'Italic',        onClick: () => wrapBody('_','_'),    icon: 'I', cls: 'italic' },
              { title: 'Strikethrough', onClick: () => wrapBody('~','~'),    icon: 'S', cls: 'line-through' },
              { title: 'Code',          onClick: () => wrapBody('`','`'),    icon: '<>', cls: 'font-mono text-[10px]' },
            ].map(t => (
              <button key={t.title} type="button" title={t.title} onClick={t.onClick}
                className={clsx('w-7 h-7 flex items-center justify-center rounded text-xs text-slate-500 hover:bg-surface-hover transition-colors', t.cls)}>
                {t.icon}
              </button>
            ))}
            <div className="w-px h-4 bg-surface-border mx-1" />
            <button type="button" onClick={addBodyVar}
              className="flex items-center gap-1 px-2 py-1 rounded text-[10px] text-primary bg-primary-50 hover:bg-primary-100 transition-colors font-medium">
              <Plus size={10} /> Add variable
            </button>
            <div className="w-px h-4 bg-surface-border mx-1" />
            <button type="button" onClick={() => setShowAIAssist(true)}
              className="flex items-center gap-1 px-2 py-1 rounded text-[10px] font-semibold bg-gradient-to-r from-primary to-blue-500 text-white hover:opacity-90 transition-opacity shadow-sm">
              <Sparkles size={10} /> AI Assist
            </button>
          </div>
          <FieldLabel count={form.body?.length || 0} max={1024}>Message body *</FieldLabel>
          <textarea
            ref={taRef}
            className="input text-xs font-mono resize-none leading-relaxed"
            rows={6}
            placeholder="Type your message here. Use *bold*, _italic_, ~strikethrough~. Add {{1}} for variables."
            value={form.body || ''}
            onChange={e => setForm(f => ({ ...f, body: e.target.value.slice(0, 1024) }))}
          />
          {/* Promotional keyword chips */}
          {promoKws.length > 0 && (
            <div className="mt-2 flex items-start gap-2 p-2.5 rounded-lg bg-amber-50 border border-amber-200">
              <AlertCircle size={12} className="text-amber-500 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-[10px] text-amber-700 font-semibold mb-1">Promotional keywords detected in your message</p>
                <div className="flex flex-wrap gap-1">
                  {promoKws.map(k => (
                    <span key={k} className="px-1.5 py-0.5 rounded bg-amber-200 text-amber-900 text-[9px] font-semibold">{k}</span>
                  ))}
                </div>
                <button type="button" onClick={() => setShowAIAssist(true)}
                  className="mt-1.5 text-[10px] text-amber-700 underline font-semibold hover:text-amber-900 transition-colors">
                  Use AI Assist to convert to Utility →
                </button>
              </div>
            </div>
          )}
          {/* AI Assist Popup */}
          {showAIAssist && (
            <AIAssistPopup
              body={form.body}
              currentCategory={form.category || 'MARKETING'}
              onApply={v => setForm(f => ({ ...f, body: v }))}
              onClose={() => setShowAIAssist(false)}
            />
          )}
        </SectionCard>

        {/* Footer */}
        {!isAuth && (
          <SectionCard title="Footer" subtitle="Optional short text at the bottom of the message.">
            <FieldLabel count={form.footer?.length || 0} max={60} optional>Footer text</FieldLabel>
            <input className="input text-xs" placeholder="e.g. Reply STOP to unsubscribe"
              value={form.footer || ''} onChange={e => setForm(f => ({ ...f, footer: e.target.value.slice(0, 60) }))} />
          </SectionCard>
        )}

        {/* Buttons */}
        {!isAuth && (
          <SectionCard title="Buttons" subtitle="Add up to 10 buttons. Max 2 URLs, 1 phone number.">
            <ButtonBuilder buttons={form.buttons || []} setButtons={btns => setForm(f => ({ ...f, buttons: btns }))} />
          </SectionCard>
        )}

        {/* Sample values */}
        {allVarNums.length > 0 && (
          <SectionCard title="Sample variable values" subtitle="Required for approval — shows Meta what real data looks like.">
            <div className="space-y-2">
              {allVarNums.map(({ key, label }) => (
                <div key={key}>
                  <FieldLabel>{label}</FieldLabel>
                  <input className="input text-xs" placeholder={`Sample for ${label}`}
                    value={form.samples?.[key] || ''}
                    onChange={e => setForm(f => ({ ...f, samples: { ...f.samples, [key]: e.target.value } }))} />
                </div>
              ))}
            </div>
          </SectionCard>
        )}
      </div>

      {/* ── Preview (right) ── */}
      <div className="w-72 flex-shrink-0 border-l border-surface-border bg-slate-50/50 overflow-y-auto p-5 hidden md:block">
        <div className="sticky top-0 space-y-4">
          <PhonePreview form={form} />
          <ValidationPanel form={form} />
        </div>
      </div>
    </div>
  )
}

// ─── Step 3: Review ───────────────────────────────────────────────────────────

function ReviewStep({ form }) {
  const catDef  = CATEGORY_DEFS.find(c => c.value === form.category)
  const subType = catDef?.subTypes.find(s => s.value === form.subType)

  return (
    <div className="flex flex-1 overflow-hidden">
      <div className="flex-1 overflow-y-auto p-5 bg-surface space-y-4">
        <div className="text-center mb-6">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-primary-50 border border-primary/20 rounded-full mb-2">
            <div className="w-1.5 h-1.5 rounded-full bg-primary" />
            <span className="text-[10px] font-bold text-primary uppercase tracking-widest">Step 3 of 3</span>
          </div>
          <h2 className="text-xl font-bold text-slate-900 mb-1">Review & Submit</h2>
          <p className="text-sm text-slate-500">Check everything before sending to Meta for approval.</p>
        </div>

        {/* Summary card */}
        <div className="bg-white rounded-xl border border-surface-border divide-y divide-surface-border">
          {[
            { label: 'Template name', value: form.name || '—' },
            { label: 'Category',      value: catDef?.label || '—' },
            { label: 'Type',          value: subType?.label || '—' },
            { label: 'Language',      value: LANGUAGES.find(l => l.value === form.language)?.label || '—' },
            { label: 'Header',        value: form.mediaSample && form.mediaSample !== 'none' ? `${form.mediaSample} media` : form.headerText || 'None' },
            { label: 'Body length',   value: `${form.body?.length || 0} / 1024 characters` },
            { label: 'Footer',        value: form.footer || 'None' },
            { label: 'Buttons',       value: (form.buttons || []).length > 0 ? `${form.buttons.length} button(s)` : 'None' },
          ].map((row, i) => (
            <div key={i} className="flex items-center gap-4 px-4 py-2.5">
              <span className="text-xs text-slate-400 w-28 flex-shrink-0">{row.label}</span>
              <span className="text-xs font-medium text-slate-700 truncate">{row.value}</span>
            </div>
          ))}
        </div>

        {/* Validation */}
        <ValidationPanel form={form} />

        {/* Info */}
        <div className="flex items-start gap-3 bg-blue-50 border border-blue-100 rounded-xl p-4">
          <AlertCircle size={15} className="text-blue-500 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-xs font-semibold text-blue-800">Review typically takes 24–48 hours</p>
            <p className="text-xs text-blue-600 mt-0.5">Meta will notify you via email once your template is approved, rejected, or requires changes.</p>
          </div>
        </div>
      </div>

      {/* Preview panel */}
      <div className="w-72 flex-shrink-0 border-l border-surface-border bg-slate-50/50 p-5 hidden md:flex flex-col">
        <PhonePreview form={form} />
      </div>
    </div>
  )
}

// ─── Create Wizard Modal ──────────────────────────────────────────────────────

const BLANK_FORM = {
  name: '', category: 'MARKETING', subType: 'default', language: 'en',
  mediaSample: 'none', headerText: '', mediaUrl: '',
  body: '', footer: '', buttons: [], samples: {},
  ttl: '10m', addSecurityRec: false,
}

const STEPS = ['Set up template', 'Edit template', 'Submit for review']

function CreateWizard({ onClose, onSave }) {
  const [step, setStep] = useState(0)
  const [form, setForm] = useState({ ...BLANK_FORM })

  function canNext() {
    if (step === 0) return true
    if (step === 1) return !!(form.name && /^[a-z0-9_]+$/.test(form.name) && form.body?.trim())
    return true
  }

  function handleSubmit() {
    onSave(form)
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-white animate-fade-in">
      {/* Top bar */}
      <div className="flex items-center justify-between px-5 h-14 border-b border-surface-border bg-white flex-shrink-0">
        <div className="flex items-center gap-3">
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-surface-hover text-slate-400 transition-colors">
            <X size={16} />
          </button>
          <span className="text-sm font-bold text-slate-800">Create Template</span>
        </div>

        {/* Step bar */}
        <div className="hidden sm:flex items-center gap-0">
          {STEPS.map((s, i) => (
            <div key={i} className="flex items-center">
              <div className="flex items-center gap-1.5">
                <div className={clsx(
                  'w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0',
                  i < step  ? 'bg-emerald-500 text-white' :
                  i === step ? 'bg-primary text-white' :
                  'border-2 border-surface-border text-slate-400'
                )}>
                  {i < step ? '✓' : i + 1}
                </div>
                <span className={clsx('text-xs font-medium whitespace-nowrap',
                  i === step ? 'text-primary' : i < step ? 'text-emerald-600' : 'text-slate-400'
                )}>{s}</span>
              </div>
              {i < STEPS.length - 1 && (
                <div className={clsx('w-8 h-0.5 mx-2', i < step ? 'bg-emerald-400' : 'bg-surface-border')} />
              )}
            </div>
          ))}
        </div>

        <div className="flex items-center gap-2">
          {step > 0 && (
            <button onClick={() => setStep(s => s - 1)} className="btn-secondary text-xs">Back</button>
          )}
          {step < STEPS.length - 1 ? (
            <button onClick={() => setStep(s => s + 1)} disabled={!canNext()} className="btn-primary text-xs px-4 disabled:opacity-40">
              Continue →
            </button>
          ) : (
            <button onClick={handleSubmit} className="btn-primary text-xs px-5 flex items-center gap-1.5">
              <Send size={11} /> Submit for Review
            </button>
          )}
        </div>
      </div>

      {/* Step content */}
      <div className="flex-1 overflow-hidden flex flex-col">
        {step === 0 && <SetupStep form={form} setForm={setForm} />}
        {step === 1 && <EditStep  form={form} setForm={setForm} />}
        {step === 2 && <ReviewStep form={form} />}
      </div>
    </div>
  )
}

// ─── Preview Modal ────────────────────────────────────────────────────────────

function PreviewModal({ template, onClose }) {
  // Build a dummy form for the preview from the template data
  const dummyForm = {
    body: `Hello! This is the *${template.name}* template.\n\nThank you for your business. 🙏`,
    headerText: template.name.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
    footer: 'Powered by ChatFlow',
    buttons: template.category === 'AUTHENTICATION' ? [{ id: 'x', kind: 'copy_code', text: 'Copy code', code: 'OTP1234' }] : [],
    mediaSample: 'none',
    samples: {},
  }

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/40 flex items-center justify-center p-4" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="bg-white rounded-2xl shadow-modal w-full max-w-xs animate-fade-in overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-surface-border">
          <div>
            <p className="text-xs font-bold text-slate-800">{template.name}</p>
            <div className="flex items-center gap-1.5 mt-0.5">
              <CatBadge category={template.category} />
              <StatusBadge status={template.status} />
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-surface-hover text-slate-400 transition-colors">
            <X size={15} />
          </button>
        </div>
        <div className="p-5">
          <PhonePreview form={dummyForm} />
        </div>
      </div>
    </div>
  )
}

// ─── Row Menu ─────────────────────────────────────────────────────────────────

function RowMenu({ template, onPreview, onDelete }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    function h(e) { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [])

  return (
    <div ref={ref} className="relative">
      <button onClick={() => setOpen(p => !p)}
        className="p-1.5 rounded-lg hover:bg-surface-hover text-slate-400 hover:text-slate-600 transition-colors">
        <MoreHorizontal size={14} />
      </button>
      {open && (
        <div className="absolute top-full right-0 mt-1 w-44 bg-white rounded-xl shadow-modal border border-surface-border z-20 py-1 animate-fade-in">
          <button onClick={() => { onPreview(); setOpen(false) }}
            className="w-full flex items-center gap-2 px-3 py-2 text-xs text-slate-700 hover:bg-surface-hover transition-colors">
            <Eye size={12} className="text-slate-400" /> Preview
          </button>
          <button onClick={() => setOpen(false)}
            className="w-full flex items-center gap-2 px-3 py-2 text-xs text-slate-700 hover:bg-surface-hover transition-colors">
            <Pencil size={12} className="text-slate-400" /> Edit
          </button>
          <button onClick={() => setOpen(false)}
            className="w-full flex items-center gap-2 px-3 py-2 text-xs text-slate-700 hover:bg-surface-hover transition-colors">
            <Copy size={12} className="text-slate-400" /> Duplicate
          </button>
          <button onClick={() => setOpen(false)}
            className="w-full flex items-center gap-2 px-3 py-2 text-xs text-slate-700 hover:bg-surface-hover transition-colors">
            <BarChart2 size={12} className="text-slate-400" /> Analytics
          </button>
          <div className="border-t border-surface-border my-1" />
          <button onClick={() => { onDelete(); setOpen(false) }}
            className="w-full flex items-center gap-2 px-3 py-2 text-xs text-red-600 hover:bg-red-50 transition-colors">
            <Trash2 size={12} /> Delete
          </button>
        </div>
      )}
    </div>
  )
}

// ─── Named export for external use (e.g. Broadcasting.jsx) ───────────────────

export function TemplateBuilder({ onBack }) {
  return <CreateWizard onClose={onBack ?? (() => {})} onSave={() => { onBack?.() }} />
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function Templates() {
  const [templates, setTemplates] = useState(MOCK_TEMPLATES)
  const [showCreate, setShowCreate]   = useState(false)
  const [preview,    setPreview]      = useState(null)
  const [search,     setSearch]       = useState('')
  const [catFilter,  setCatFilter]    = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')

  const filtered = templates.filter(t => {
    const matchSearch = t.name.toLowerCase().includes(search.toLowerCase())
    const matchCat    = catFilter === 'all' || t.category === catFilter
    const matchStatus = statusFilter === 'all' || t.status === statusFilter
    return matchSearch && matchCat && matchStatus
  })

  function handleSave(form) {
    setTemplates(prev => [...prev, {
      id: Date.now().toString(),
      name: form.name,
      category: form.category,
      lang: LANGUAGES.find(l => l.value === form.language)?.label || 'English',
      status: 'pending',
      sent: 0, opened: 0, ctr: '—',
      updatedAt: 'Just now',
    }])
  }

  function handleDelete(id) {
    setTemplates(prev => prev.filter(t => t.id !== id))
  }

  return (
    <div className="space-y-5 animate-fade-in">

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-[15px] font-bold text-slate-900">Templates</h1>
          <p className="text-[11px] text-slate-400 mt-0.5">WhatsApp message templates approved by Meta</p>
        </div>
        <div className="flex items-center gap-2">
          <button className="btn-secondary text-xs flex items-center gap-1.5">
            <RefreshCw size={11} /> Sync from Meta
          </button>
          <button onClick={() => setShowCreate(true)} className="btn-primary text-xs flex items-center gap-1.5 px-4">
            <Plus size={13} /> Create Template
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-surface-border overflow-hidden">
        {/* Filter bar */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-surface-border flex-wrap">
          <div className="relative flex-1 min-w-[180px]">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input className="input pl-9 text-xs w-full" placeholder="Search templates…"
              value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <NativeSelect sm className="w-36" value={catFilter} onChange={e => setCatFilter(e.target.value)}>
            <option value="all">All categories</option>
            <option value="MARKETING">Marketing</option>
            <option value="UTILITY">Utility</option>
            <option value="AUTHENTICATION">Authentication</option>
          </NativeSelect>
          <NativeSelect sm className="w-32" value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
            <option value="all">All status</option>
            <option value="approved">Approved</option>
            <option value="pending">Pending</option>
            <option value="rejected">Rejected</option>
            <option value="draft">Draft</option>
          </NativeSelect>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px]">
            <thead>
              <tr>
                <th className="table-header">Template name</th>
                <th className="table-header">Category</th>
                <th className="table-header">Language</th>
                <th className="table-header">Status</th>
                <th className="table-header text-right">Sent</th>
                <th className="table-header text-right">Opened</th>
                <th className="table-header text-right">CTR</th>
                <th className="table-header text-right">Updated</th>
                <th className="table-header w-10"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-4 py-12 text-center">
                    <FileText size={28} className="text-slate-200 mx-auto mb-2" />
                    <p className="text-sm text-slate-400">No templates found</p>
                    <p className="text-xs text-slate-300 mt-1">Try adjusting your search or filters</p>
                  </td>
                </tr>
              ) : filtered.map(t => (
                <tr key={t.id} className="table-row">
                  <td className="table-cell">
                    <span className="font-mono text-xs text-slate-700 font-medium">{t.name}</span>
                  </td>
                  <td className="table-cell"><CatBadge category={t.category} /></td>
                  <td className="table-cell text-xs text-slate-500">{t.lang}</td>
                  <td className="table-cell"><StatusBadge status={t.status} /></td>
                  <td className="table-cell text-right text-xs text-slate-700">{t.sent.toLocaleString()}</td>
                  <td className="table-cell text-right text-xs text-slate-700">{t.opened.toLocaleString()}</td>
                  <td className="table-cell text-right text-xs font-medium text-slate-700">{t.ctr}</td>
                  <td className="table-cell text-right text-xs text-slate-400">{t.updatedAt}</td>
                  <td className="table-cell">
                    <RowMenu template={t} onPreview={() => setPreview(t)} onDelete={() => handleDelete(t.id)} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Footer */}
        {filtered.length > 0 && (
          <div className="px-4 py-2.5 border-t border-surface-border flex items-center justify-between">
            <span className="text-xs text-slate-400">Showing {filtered.length} of {templates.length} templates</span>
            <span className="text-xs text-slate-400">Auto-synced from Meta</span>
          </div>
        )}
      </div>

      {/* Modals */}
      {showCreate && <CreateWizard onClose={() => setShowCreate(false)} onSave={handleSave} />}
      {preview    && <PreviewModal template={preview} onClose={() => setPreview(null)} />}
    </div>
  )
}
