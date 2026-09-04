import { useState, useMemo, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Search, Plus, X, Star, Phone, Mail, MapPin, Building2, Globe, MessageSquare,
  FileText, CheckCircle2, XCircle, Shield, UserCheck, Send, Check, Tag, Upload,
  Download, Users, MoreVertical, ChevronDown, FileUp, SlidersHorizontal, Sparkles,
  Pencil, Save, Layers, FolderPlus, LayoutList, Table2, AtSign, Instagram as InstagramIcon,
  MessageCircle, Camera, Activity, Clock, Trash2, Variable, UserPlus,
  ArrowLeft, CheckSquare, MousePointer2,
} from 'lucide-react'
import clsx from 'clsx'
import { NativeSelect } from '../components/Select'
import { useApp } from '../context/AppContext'

/* ─── helpers ────────────────────────────────────────────────── */
const avBg  = () => ({ bg: '#fce7f3', color: '#be185d' })
const inits = n => (n || '').split(' ').map(p => p[0]).join('').toUpperCase().slice(0, 2)
const fmtR  = d => {
  if (!d) return '—'
  const v = Math.floor((Date.now() - new Date(d)) / 86400000)
  return v === 0 ? 'Today' : v === 1 ? 'Yesterday' : v < 7 ? `${v}d ago` : new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
}
const TAG_C = {
  vip: ['#fef9c3', '#854d0e'], customer: ['#dcfce7', '#166534'], lead: ['#dbeafe', '#1e40af'],
  influencer: ['#fdf4ff', '#7e22ce'], 'warm lead': ['#fff7ed', '#9a3412'], 'cold lead': ['#f1f5f9', '#475569'],
  'new follower': ['#e0f2fe', '#075985'], 'story fan': ['#fce7f3', '#9d174d'],
}
const tSt = t => { const [bg, c] = TAG_C[t.toLowerCase()] || ['#f1f5f9', '#64748b']; return { background: bg, color: c } }
const SRC_META = {
  dm:      { label: 'DM',      icon: Send,          color: 'text-primary bg-primary-50 border-primary/10' },
  comment: { label: 'Comment', icon: MessageCircle, color: 'text-emerald-600 bg-emerald-50 border-emerald-100' },
  story:   { label: 'Story',   icon: Camera,        color: 'text-pink-600 bg-pink-50 border-pink-100' },
}
const LOG_ST = {
  message:  { bg: '#dbeafe', c: '#2563eb', Icon: MessageSquare },
  comment:  { bg: '#dcfce7', c: '#16a34a', Icon: MessageCircle },
  story:    { bg: '#fce7f3', c: '#be185d', Icon: Camera        },
  created:  { bg: '#f1f5f9', c: '#64748b', Icon: UserPlus      },
  blocked:  { bg: '#fee2e2', c: '#dc2626', Icon: XCircle       },
}
const ALL_TAGS = ['vip', 'customer', 'lead', 'influencer', 'warm lead', 'cold lead', 'new follower', 'story fan']
const fmtD = d => d ? new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'

/* ─── date filter — same buckets as WhatsApp's Contacts.jsx ──── */
const DATE_OPTS = [
  { v: 'any',       l: 'Any time'    },
  { v: 'today',     l: 'Today'       },
  { v: 'yesterday', l: 'Yesterday'   },
  { v: 'week',      l: 'Last 7 days' },
  { v: 'month',     l: 'Last 30 days'},
  { v: 'thismonth', l: 'This month'  },
  { v: 'lastmonth', l: 'Last month'  },
]
function datePass(c, dateFil) {
  if (dateFil === 'any') return true
  const d = new Date(c.created)
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const yesterday = new Date(today); yesterday.setDate(yesterday.getDate() - 1)
  if (dateFil === 'today')     return d >= today
  if (dateFil === 'yesterday') return d >= yesterday && d < today
  if (dateFil === 'week')      { const t = new Date(today); t.setDate(t.getDate() - 7); return d >= t }
  if (dateFil === 'month')     { const t = new Date(today); t.setDate(t.getDate() - 30); return d >= t }
  if (dateFil === 'thismonth') return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()
  if (dateFil === 'lastmonth') {
    const lm = new Date(now.getFullYear(), now.getMonth() - 1, 1)
    return d.getMonth() === lm.getMonth() && d.getFullYear() === lm.getFullYear()
  }
  return true
}

const SEGS = [
  { id: 'all',        label: 'All contacts',    icon: Users,        fn: () => true },
  { id: 'starred',    label: 'Starred',         icon: Star,         fn: c => c.starred },
  { id: 'subscribed', label: 'Subscribed',      icon: CheckCircle2, fn: c => c.status === 'active' },
  { id: 'opted-out',  label: 'Unsubscribed',    icon: XCircle,      fn: c => c.status === 'inactive' },
  { id: 'unassigned', label: 'Unassigned',      icon: UserCheck,    fn: c => !c.agent },
]

const LANGS = ['Hindi', 'English', 'Tamil', 'Telugu', 'Kannada', 'Gujarati', 'Bengali', 'Malayalam']

const INIT_GROUPS = [
  { id: 'grp1', name: 'Warm Leads',       color: '#8B5CF6', desc: 'DM inquiries with buying intent' },
  { id: 'grp2', name: 'Influencers',      color: '#EC4899', desc: 'Creators & brand ambassadors' },
  { id: 'grp3', name: 'VIP Customers',    color: '#10b981', desc: 'Repeat buyers, high engagement' },
]

const INIT_CONTACTS = [
  { id: '1', name: 'Ananya Rao', handle: '@ananya.rao', avatar: 'AR', email: 'ananya.rao@gmail.com', company: '',
    phone: '+91 98450 12233', city: 'Bangalore', language: 'English',
    source: 'dm', status: 'active', starred: true, tags: ['lead', 'warm lead'], agent: 'Riya Patel',
    created: '2026-07-14', last: new Date(Date.now() - 2 * 60000).toISOString(), convos: 3,
    groupIds: ['grp1'], customAttrs: {}, notes: 'Interested in the summer collection — follow up with a discount code.',
    score: 78, aiSummary: 'Warm DM lead with 3 conversations in the last month. Asked about pricing twice — good candidate for a discount nudge.',
    log: [
      { t: 'message', text: 'Asked "do you ship to Bangalore?"', date: '2026-08-20' },
      { t: 'message', text: 'Sent pricing question via DM', date: '2026-08-05' },
      { t: 'created',  text: 'Created via Instagram DM', date: '2026-07-14' },
    ] },
  { id: '2', name: 'Karthik Iyer', handle: '@karthik.iyer', avatar: 'KI', email: 'karthik.iyer@outlook.com', company: 'Iyer Traders',
    phone: '+91 90031 55678', city: 'Chennai', language: 'Tamil',
    source: 'dm', status: 'active', starred: false, tags: ['customer'], agent: 'Riya Patel',
    created: '2026-06-02', last: new Date(Date.now() - 18 * 60000).toISOString(), convos: 5,
    groupIds: ['grp3'], customAttrs: {}, notes: '',
    score: 91, aiSummary: 'Repeat customer with 5 conversations over 3 months. Consistently positive engagement — great candidate for VIP perks.',
    log: [
      { t: 'message', text: 'Reordered via DM', date: '2026-08-18' },
      { t: 'message', text: 'Asked about restock timing', date: '2026-07-22' },
      { t: 'created',  text: 'Created via Instagram DM', date: '2026-06-02' },
    ] },
  { id: '3', name: 'Meera Nair', handle: '@meera.creates', avatar: 'MN', email: '', company: '',
    phone: '', city: 'Kochi', language: 'Malayalam',
    source: 'comment', status: 'active', starred: false, tags: ['influencer'], agent: null,
    created: '2026-05-28', last: new Date(Date.now() - 3600000).toISOString(), convos: 1,
    groupIds: ['grp2'], customAttrs: {}, notes: '',
    score: 64, aiSummary: 'Engaged creator who commented on a Reel — consider a collab or gifting outreach.',
    log: [
      { t: 'comment', text: 'Commented "love this!" on Summer Collection Reel', date: '2026-05-28' },
      { t: 'created',  text: 'Created via comment automation', date: '2026-05-28' },
    ] },
  { id: '4', name: 'Rohit Sharma', handle: '@rohit.s', avatar: 'RS', email: 'rohit.sharma@gmail.com', company: '',
    phone: '+91 98200 77441', city: 'Mumbai', language: 'Hindi',
    source: 'story', status: 'inactive', starred: false, tags: ['story fan'], agent: 'Arjun Dev',
    created: '2026-04-24', last: new Date(Date.now() - 2 * 86400000).toISOString(), convos: 2,
    groupIds: [], customAttrs: {}, notes: '',
    score: 38, aiSummary: 'No recent activity since replying to a story in April. Consider a re-engagement DM.',
    log: [
      { t: 'story',   text: 'Replied to "Flash sale" story', date: '2026-04-24' },
      { t: 'created', text: 'Created via story reply automation', date: '2026-04-24' },
    ] },
  { id: '5', name: 'Divya Menon', handle: '@divya.menon', avatar: 'DM', email: '', company: '',
    phone: '', city: '', language: 'English',
    source: 'dm', status: 'inactive', starred: false, tags: ['lead', 'cold lead'], agent: null,
    created: '2026-08-11', last: new Date(Date.now() - 5 * 86400000).toISOString(), convos: 1,
    groupIds: ['grp1'], customAttrs: {}, notes: '',
    score: 22, aiSummary: 'Cold lead — sent one DM inquiry, no follow-up since. Low engagement so far.',
    log: [
      { t: 'created', text: 'Created via Instagram DM', date: '2026-08-11' },
    ] },
]

/* ─── FilterChip ─────────────────────────────────────────────── */
function FilterChip({ label, active, onClear, children }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)
  useEffect(() => {
    if (!open) return
    const h = e => { if (!ref.current?.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [open])
  return (
    <div className="relative" ref={ref}>
      <div role="button" tabIndex={0} onClick={() => setOpen(p => !p)}
        onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setOpen(p => !p) } }}
        className={clsx('inline-flex items-center gap-1 px-2 py-0.5 rounded-md border text-[10px] font-semibold transition-all whitespace-nowrap cursor-pointer select-none',
          active ? 'bg-primary-50 text-primary border-primary/30' : 'bg-white text-slate-500 border-surface-border hover:bg-surface-hover')}>
        <span className="max-w-[80px] truncate">{label}</span>
        {active
          ? <button onMouseDown={e => { e.stopPropagation(); onClear() }} className="ml-0.5 hover:text-primary/60"><X size={8}/></button>
          : <ChevronDown size={8} className={clsx('transition-transform duration-150', open && 'rotate-180')}/>}
      </div>
      {open && (
        <div className="absolute top-full left-0 mt-1 bg-white border border-surface-border rounded-xl shadow-modal z-40 py-0.5 min-w-[160px] max-h-[280px] overflow-y-auto">
          {children({ close: () => setOpen(false) })}
        </div>
      )}
    </div>
  )
}
function DropOpt({ active, onClick, children }) {
  return (
    <button onClick={onClick}
      className={clsx('w-full flex items-center gap-2 px-3 py-1.5 text-xs text-left hover:bg-surface-hover transition-colors',
        active ? 'text-primary font-semibold bg-primary-50/60' : 'text-slate-600')}>
      {active && <Check size={11} className="flex-shrink-0"/>}
      <span className="truncate">{children}</span>
    </button>
  )
}

/* ─── Contact row (list view) ───────────────────────────────── */
function ContactRow({ c, active, selected, manualSelect, onClick, onToggleSelect }) {
  return (
    <div className={clsx('w-full flex items-center gap-1 px-2 py-2 transition-colors border-b border-surface-border/60 group',
      active ? 'bg-primary-50' : 'hover:bg-surface-hover')}>
      <div className="flex-shrink-0 w-3.5 flex items-center justify-center" onClick={e => { e.stopPropagation(); onToggleSelect() }}>
        <input type="checkbox" checked={selected} onChange={() => {}}
          className={clsx('w-3.5 h-3.5 rounded border-slate-300 text-primary focus:ring-primary/20 cursor-pointer transition-opacity',
            (selected || manualSelect) ? 'opacity-100' : 'opacity-0 group-hover:opacity-100')}/>
      </div>
      <button onClick={onClick} className="flex flex-1 items-center gap-2 text-left min-w-0">
        <div className="w-[34px] h-[34px] rounded-full flex items-center justify-center font-semibold text-[12px] flex-shrink-0"
          style={{ background: avBg().bg, color: avBg().color }}>{inits(c.name)}</div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-1.5 mb-[1px]">
            <p className={clsx('text-[12px] font-semibold truncate', active ? 'text-primary' : 'text-slate-800')}>{c.name}</p>
            <span className="text-[10px] text-slate-400 flex-shrink-0">{fmtR(c.last)}</span>
          </div>
          <div className="flex items-center justify-between gap-1.5">
            <p className="text-[11px] text-slate-500 truncate flex-1">{c.handle}</p>
            <div className="flex items-center gap-1 flex-shrink-0">
              {c.starred && <Star size={9} className="text-amber-400 fill-amber-400"/>}
              {c.tags[0] && <span className="px-1.5 py-0.5 rounded-full text-[9px] font-bold capitalize" style={tSt(c.tags[0])}>{c.tags[0]}</span>}
            </div>
          </div>
        </div>
      </button>
    </div>
  )
}

/* ─── Contact table (table view) ─────────────────────────────── */
function ContactTable({ contacts, activeId, selectedIds, manualSelect, onSelect, onToggleSelect, onToggleAll, allSelected }) {
  const TH = 'text-left px-3 py-2.5 text-[10px] font-bold text-slate-400 uppercase tracking-wider whitespace-nowrap bg-white select-none'
  return (
    <table className="w-full border-collapse">
      <thead>
        <tr className="sticky top-0 z-10 shadow-[0_1px_0_0_#e2e8f0]">
          <th className={clsx(TH, 'w-8')}>
            <input type="checkbox" checked={allSelected} onChange={onToggleAll} className="w-3.5 h-3.5 rounded border-slate-300 text-primary"/>
          </th>
          <th className={TH}>Name</th>
          <th className={TH}>Handle</th>
          <th className={TH}>Email</th>
          <th className={TH}>Source</th>
          <th className={TH}>Status</th>
          <th className={TH}>Tags</th>
          <th className={TH}>Last Active</th>
          <th className={TH}>Agent</th>
        </tr>
      </thead>
      <tbody>
        {contacts.map(c => {
          const active = c.id === activeId
          const selected = selectedIds.has(c.id)
          const src = SRC_META[c.source]
          return (
            <tr key={c.id} onClick={() => onSelect(c.id)}
              className={clsx('cursor-pointer transition-colors group',
                active ? 'bg-primary-50' : selected ? 'bg-primary-50/40' : 'hover:bg-slate-50/70')}>
              <td className="px-3 py-2" onClick={e => { e.stopPropagation(); onToggleSelect(c.id) }}>
                <input type="checkbox" checked={selected} onChange={() => {}}
                  className={clsx('w-3.5 h-3.5 rounded border-slate-300 text-primary transition-opacity',
                    (selected || manualSelect) ? 'opacity-100' : 'opacity-0 group-hover:opacity-100')}/>
              </td>
              <td className="px-3 py-2">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-full flex items-center justify-center font-semibold text-[10px] flex-shrink-0"
                    style={{ background: avBg().bg, color: avBg().color }}>{inits(c.name)}</div>
                  <span className="text-[12px] font-semibold text-slate-800 truncate">{c.name}</span>
                  {c.starred && <Star size={10} className="text-amber-400 fill-amber-400 flex-shrink-0"/>}
                </div>
              </td>
              <td className="px-3 py-2 text-[11px] text-slate-500">{c.handle}</td>
              <td className="px-3 py-2 text-[11px] text-slate-500 truncate max-w-[140px]">{c.email || '—'}</td>
              <td className="px-3 py-2">
                {src && <span className={clsx('inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-bold border', src.color)}><src.icon size={9}/>{src.label}</span>}
              </td>
              <td className="px-3 py-2">
                <span className={clsx('badge text-[9px]', c.status === 'active' ? 'badge-green' : 'badge-gray')}>{c.status === 'active' ? 'Subscribed' : 'Inactive'}</span>
              </td>
              <td className="px-3 py-2">
                <div className="flex flex-wrap gap-0.5 max-w-[140px]">
                  {c.tags.slice(0, 2).map(t => <span key={t} className="px-1.5 py-0.5 rounded-full text-[9px] font-bold capitalize" style={tSt(t)}>{t}</span>)}
                  {c.tags.length > 2 && <span className="text-[9px] text-slate-400">+{c.tags.length - 2}</span>}
                </div>
              </td>
              <td className="px-3 py-2 text-[11px] text-slate-500">{fmtR(c.last)}</td>
              <td className="px-3 py-2 text-[11px] text-slate-500 truncate">{c.agent || '—'}</td>
            </tr>
          )
        })}
      </tbody>
    </table>
  )
}

/* ─── Editable field (matches Conversations.jsx pattern) ─────── */
function EditableField({ icon: Icon, label, value, onSave, placeholder, type = 'text' }) {
  const [editing, setEditing] = useState(false)
  const [local, setLocal] = useState(value || '')
  const inputRef = useRef(null)
  useEffect(() => { setLocal(value || '') }, [value])
  useEffect(() => { if (editing) inputRef.current?.focus() }, [editing])
  function commit() { onSave(local.trim()); setEditing(false) }
  function cancel() { setLocal(value || ''); setEditing(false) }
  if (editing) {
    return (
      <div className="flex items-start gap-2.5 px-4 py-2.5 bg-primary-50/40">
        <Icon size={12} className="text-primary flex-shrink-0 mt-1" />
        <div className="flex-1 min-w-0">
          <p className="text-[9px] text-primary font-semibold mb-0.5">{label}</p>
          <input ref={inputRef} type={type} value={local} onChange={e => setLocal(e.target.value)}
            onBlur={commit} onKeyDown={e => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') cancel() }}
            placeholder={placeholder || `Enter ${label.toLowerCase()}…`}
            className="w-full text-[11px] bg-transparent text-slate-800 outline-none border-b border-primary/50 pb-0.5 placeholder-slate-300" />
        </div>
      </div>
    )
  }
  return (
    <div onClick={() => setEditing(true)} className="flex items-start gap-2.5 px-4 py-2.5 group hover:bg-slate-50 cursor-pointer transition-colors">
      <Icon size={12} className={clsx('flex-shrink-0 mt-0.5', value ? 'text-slate-400' : 'text-slate-200')} />
      <div className="flex-1 min-w-0">
        <p className="text-[10px] text-slate-400 leading-none mb-0.5">{label}</p>
        <p className={clsx('text-[11px] break-all', value ? 'text-slate-700 font-medium' : 'text-slate-300 italic')}>{value || `Add ${label.toLowerCase()}…`}</p>
      </div>
      <Pencil size={10} className="text-slate-300 opacity-0 group-hover:opacity-100 flex-shrink-0 mt-1 transition-opacity" />
    </div>
  )
}
function EditableCustomField({ field, value, onSave }) {
  if (field.type === 'boolean') {
    const on = value === true || value === 'true'
    return (
      <div className="flex items-center justify-between gap-2.5 px-4 py-2.5">
        <p className="text-[11px] text-slate-700 font-medium truncate">{field.name}</p>
        <button onClick={() => onSave(!on)} className={clsx('w-8 h-4 rounded-full relative transition-colors flex-shrink-0', on ? 'bg-primary' : 'bg-slate-200')}>
          <div className={clsx('absolute top-0.5 w-3 h-3 rounded-full bg-white shadow transition-transform', on ? 'translate-x-4' : 'translate-x-0.5')} />
        </button>
      </div>
    )
  }
  if (field.type === 'dropdown') {
    return (
      <div className="px-4 py-2.5">
        <p className="text-[10px] text-slate-400 leading-none mb-1">{field.name}</p>
        <NativeSelect value={value || ''} onChange={e => onSave(e.target.value)} sm>
          <option value="">Not set</option>
          {(field.options || []).map(opt => <option key={opt} value={opt}>{opt}</option>)}
        </NativeSelect>
      </div>
    )
  }
  const inputType = ['number', 'date', 'email'].includes(field.type) ? field.type : field.type === 'phone' ? 'tel' : 'text'
  return <EditableField icon={Tag} label={field.name} value={value} onSave={onSave} type={inputType} />
}

/* ─── Contact panel (full parity with WhatsApp's Contacts.jsx) ── */
function ContactPanel({ c, onClose, onUpdate, onDelete, groups }) {
  const { customFields } = useApp()
  const navigate = useNavigate()
  const [tab, setTab] = useState('info')
  const [noteText, setNoteText] = useState(c.notes || '')
  const [noteDirty, setNoteDirty] = useState(false)
  const [editing, setEditing] = useState(false)
  const [editData, setEditData] = useState({})
  const [menuOpen, setMenuOpen] = useState(false)
  const [addTag, setAddTag] = useState(false)
  const [newTag, setNewTag] = useState('')
  const [addingAttr, setAddingAttr] = useState(false)
  const [newAttrKey, setNewAttrKey] = useState('')
  const [newAttrVal, setNewAttrVal] = useState('')
  const menuRef = useRef(null)

  useEffect(() => {
    setNoteText(c.notes || '')
    setNoteDirty(false)
    setTab('info')
    setAddTag(false)
    setEditing(false)
    setAddingAttr(false)
  }, [c.id])

  useEffect(() => {
    if (!menuOpen) return
    const h = e => { if (!menuRef.current?.contains(e.target)) setMenuOpen(false) }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [menuOpen])

  const TABS = [
    { key: 'info',     label: 'Info',     icon: AtSign },
    { key: 'activity', label: 'Activity', icon: Activity },
    { key: 'notes',    label: 'Notes',    icon: FileText },
  ]
  const src = SRC_META[c.source]
  const isActive = c.status === 'active'
  const hasNotes = (c.notes || '').trim().length > 0

  function startEdit() {
    setEditData({ name: c.name, phone: c.phone || '', email: c.email || '', company: c.company || '', city: c.city || '', language: c.language || '' })
    setEditing(true)
  }
  function saveEdit() { onUpdate(c.id, editData); setEditing(false) }
  function doAddTag() {
    const t = newTag.trim().toLowerCase()
    if (t && !c.tags.includes(t)) onUpdate(c.id, { tags: [...c.tags, t] })
    setNewTag(''); setAddTag(false)
  }
  function saveNote() { onUpdate(c.id, { notes: noteText }); setNoteDirty(false) }
  function goToChat() { navigate('/instagram/inbox') }
  function addCustomAttr() {
    const k = newAttrKey.trim(), v = newAttrVal.trim()
    if (!k) return
    onUpdate(c.id, { customAttrs: { ...(c.customAttrs || {}), [k]: v } })
    setNewAttrKey(''); setNewAttrVal(''); setAddingAttr(false)
  }
  function removeCustomAttr(key) {
    const next = { ...(c.customAttrs || {}) }; delete next[key]
    onUpdate(c.id, { customAttrs: next })
  }

  const fi = 'w-full text-[11px] border border-surface-border rounded-lg px-3 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-primary/10 focus:border-primary/40 placeholder-slate-300'

  return (
    <div className="flex-1 flex flex-col bg-white overflow-hidden border-l border-surface-border min-w-0">

      {/* ── Header ── */}
      <div className="flex-shrink-0 border-b border-surface-border bg-white px-4 py-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full flex items-center justify-center font-bold text-[14px] flex-shrink-0"
            style={{ background: avBg().bg, color: avBg().color }}>{inits(c.name)}</div>
          <div className="flex-1 min-w-0">
            <p className="text-[13px] font-bold text-slate-900 leading-tight truncate">{c.name}</p>
            <p className="text-[11px] text-slate-400 truncate">{c.handle}</p>
          </div>
          <div className="flex items-center gap-0.5 flex-shrink-0">
            <button onClick={startEdit} title="Edit contact" className="p-1.5 rounded-lg hover:bg-surface-hover text-slate-400 transition-colors"><Pencil size={14}/></button>
            <div className="relative" ref={menuRef}>
              <button onClick={() => setMenuOpen(p => !p)} className="p-1.5 rounded-lg hover:bg-surface-hover text-slate-400 transition-colors"><MoreVertical size={14}/></button>
              {menuOpen && (
                <div className="absolute right-0 top-full mt-1 w-44 bg-white border border-surface-border rounded-xl shadow-modal z-30 py-1 overflow-hidden" onClick={() => setMenuOpen(false)}>
                  <button onClick={() => onUpdate(c.id, { starred: !c.starred })} className="w-full flex items-center gap-2 px-3 py-1.5 text-[11px] text-slate-600 hover:bg-surface-hover">
                    <Star size={12} className={c.starred ? 'text-amber-400 fill-amber-400' : ''}/>{c.starred ? 'Remove star' : 'Star contact'}
                  </button>
                  <button onClick={() => onUpdate(c.id, { status: c.status === 'blocked' ? 'active' : 'blocked' })} className="w-full flex items-center gap-2 px-3 py-1.5 text-[11px] text-slate-600 hover:bg-surface-hover">
                    <Shield size={12}/>{c.status === 'blocked' ? 'Unblock' : 'Block contact'}
                  </button>
                  <div className="h-px bg-surface-border mx-2 my-1"/>
                  <button onClick={() => onDelete(c.id)} className="w-full flex items-center gap-2 px-3 py-1.5 text-[11px] text-red-500 hover:bg-red-50">
                    <Trash2 size={12}/>Delete contact
                  </button>
                </div>
              )}
            </div>
            <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-surface-hover text-slate-400 transition-colors"><X size={14}/></button>
          </div>
        </div>

        <div className="flex items-center justify-between mt-2.5">
          <div className="flex items-center gap-1 flex-wrap">
            {c.status === 'blocked'
              ? <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-red-50 text-red-600 border border-red-100"><Shield size={8}/>Blocked</span>
              : isActive
                ? <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-100"><CheckCircle2 size={8}/>Subscribed</span>
                : <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-slate-100 text-slate-500 border border-slate-200"><XCircle size={8}/>Unsubscribed</span>}
            {src && <span className={clsx('inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold border', src.color)}><src.icon size={8}/>{src.label}</span>}
            {c.starred && <Star size={10} className="text-amber-400 fill-amber-400 ml-0.5"/>}
          </div>
          <div className="flex items-center gap-1">
            <button onClick={goToChat} className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-primary text-white text-[11px] font-semibold hover:bg-primary/90 transition-colors"><Send size={11}/>Message</button>
            <button onClick={goToChat} className="flex items-center gap-1 px-2.5 py-1 rounded-lg border border-surface-border text-slate-600 text-[11px] font-semibold hover:bg-surface-hover transition-colors"><MessageSquare size={11}/>Chat</button>
          </div>
        </div>
      </div>

      {/* ── Edit mode overlay ── */}
      {editing && (
        <div className="flex-shrink-0 border-b border-surface-border bg-slate-50 px-4 py-3 space-y-2">
          <div className="flex items-center justify-between mb-1">
            <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Edit Contact</p>
            <div className="flex gap-1">
              <button onClick={() => setEditing(false)} className="px-2.5 py-1 rounded-lg border border-surface-border text-[11px] text-slate-500 hover:bg-surface-hover">Cancel</button>
              <button onClick={saveEdit} className="px-2.5 py-1 rounded-lg bg-primary text-white text-[11px] font-semibold hover:bg-primary/90 flex items-center gap-1"><Save size={11}/>Save</button>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <div>
              <p className="text-[10px] text-slate-400 mb-0.5 font-medium">Name *</p>
              <input value={editData.name || ''} onChange={e => setEditData(p => ({ ...p, name: e.target.value }))} className={fi} placeholder="Full name"/>
            </div>
            <div>
              <p className="text-[10px] text-slate-400 mb-0.5 font-medium">Handle (locked)</p>
              <input value={c.handle} disabled className={fi + ' bg-slate-50 text-slate-400 cursor-not-allowed'}/>
            </div>
            <div>
              <p className="text-[10px] text-slate-400 mb-0.5 font-medium">Phone</p>
              <input value={editData.phone || ''} onChange={e => setEditData(p => ({ ...p, phone: e.target.value }))} className={fi} placeholder="+91 98765 43210"/>
            </div>
            <div>
              <p className="text-[10px] text-slate-400 mb-0.5 font-medium">Email</p>
              <input value={editData.email || ''} onChange={e => setEditData(p => ({ ...p, email: e.target.value }))} className={fi} placeholder="email@example.com"/>
            </div>
            <div>
              <p className="text-[10px] text-slate-400 mb-0.5 font-medium">Company</p>
              <input value={editData.company || ''} onChange={e => setEditData(p => ({ ...p, company: e.target.value }))} className={fi} placeholder="Company name"/>
            </div>
            <div>
              <p className="text-[10px] text-slate-400 mb-0.5 font-medium">City</p>
              <input value={editData.city || ''} onChange={e => setEditData(p => ({ ...p, city: e.target.value }))} className={fi} placeholder="City"/>
            </div>
            <div>
              <p className="text-[10px] text-slate-400 mb-0.5 font-medium">Language</p>
              <NativeSelect value={editData.language || ''} onChange={e => setEditData(p => ({ ...p, language: e.target.value }))} sm>
                <option value="">Select language</option>
                {LANGS.map(l => <option key={l} value={l}>{l}</option>)}
              </NativeSelect>
            </div>
          </div>
        </div>
      )}

      {/* ── Tab bar ── */}
      <div className="flex items-center gap-0.5 bg-slate-100 p-1 mx-4 mt-3 mb-1.5 rounded-xl flex-shrink-0 w-fit">
        {TABS.map(({ key, label, icon: Icon }) => (
          <button key={key} onClick={() => setTab(key)}
            className={clsx('relative flex items-center gap-1.5 px-3.5 py-1.5 text-[11px] font-semibold rounded-lg transition-all',
              tab === key ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700')}>
            <Icon size={12}/>{label}
            {key === 'notes' && hasNotes && <span className="w-1.5 h-1.5 rounded-full bg-primary inline-block"/>}
          </button>
        ))}
      </div>

      {/* ── Tab content ── */}
      <div className="flex-1 overflow-y-auto">

        {/* INFO TAB */}
        {tab === 'info' && (
          <div className="p-4 space-y-3">

            <div className="bg-gradient-to-br from-violet-50 to-pink-50 border border-violet-100 rounded-xl overflow-hidden">
              <div className="flex items-center justify-between px-4 py-2.5 border-b border-violet-100/60">
                <div className="flex items-center gap-1.5">
                  <Sparkles size={11} className="text-violet-500"/>
                  <p className="text-[10px] font-bold text-violet-600 uppercase tracking-wider">AI Contact Intelligence</p>
                </div>
                <div className="flex items-center gap-1.5">
                  <p className="text-[10px] text-slate-500 font-medium">Score</p>
                  <div className={clsx('px-2 py-0.5 rounded-full text-[10px] font-bold',
                    c.score >= 80 ? 'bg-emerald-100 text-emerald-700' : c.score >= 50 ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-600')}>
                    {c.score}/100
                  </div>
                </div>
              </div>
              <div className="px-4 pt-2 pb-1">
                <div className="w-full h-1 bg-violet-100 rounded-full overflow-hidden">
                  <div className={clsx('h-full rounded-full transition-all', c.score >= 80 ? 'bg-emerald-400' : c.score >= 50 ? 'bg-amber-400' : 'bg-red-400')} style={{ width: `${c.score}%` }}/>
                </div>
              </div>
              <p className="px-4 py-2 text-[11px] text-slate-600 leading-relaxed">{c.aiSummary || 'No AI summary available yet.'}</p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
              <div className="bg-white border border-surface-border rounded-xl overflow-hidden">
                <div className="px-4 py-2.5 border-b border-surface-border bg-slate-50/50">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Contact Information</p>
                </div>
                <div className="divide-y divide-surface-border/60">
                  <div className="flex items-start gap-2.5 px-4 py-2.5">
                    <AtSign size={12} className="text-slate-400 flex-shrink-0 mt-0.5"/>
                    <div className="flex-1 min-w-0">
                      <p className="text-[10px] text-slate-400 leading-none mb-0.5">Handle</p>
                      <p className="text-[11px] text-slate-700 font-medium">{c.handle}</p>
                    </div>
                  </div>
                  <EditableField icon={Phone}     label="Phone"   value={c.phone}   onSave={v => onUpdate(c.id, { phone: v })}   type="tel" />
                  <EditableField icon={Mail}      label="Email"   value={c.email}   onSave={v => onUpdate(c.id, { email: v })}   type="email" />
                  <EditableField icon={Building2} label="Company" value={c.company} onSave={v => onUpdate(c.id, { company: v })} />
                  <EditableField icon={MapPin}    label="City"    value={c.city}    onSave={v => onUpdate(c.id, { city: v })} />
                  <EditableField icon={Globe}     label="Language" value={c.language} onSave={v => onUpdate(c.id, { language: v })} />
                </div>
              </div>

              <div className="space-y-3">
                <div className="bg-white border border-surface-border rounded-xl overflow-hidden">
                  <div className="px-4 py-2.5 border-b border-surface-border bg-slate-50/50">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Details</p>
                  </div>
                  <div className="divide-y divide-surface-border/60">
                    {[
                      ['Added on',      fmtD(c.created)],
                      ['Last active',   fmtR(c.last)],
                      ['Conversations', String(c.convos)],
                      ['Source',        src?.label || '—'],
                    ].map(([l, v]) => (
                      <div key={l} className="flex items-center justify-between px-4 py-2">
                        <span className="text-[10px] text-slate-400">{l}</span>
                        <span className="text-[11px] font-semibold text-slate-700">{v}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="bg-white border border-surface-border rounded-xl overflow-hidden">
                  <div className="px-4 py-2.5 border-b border-surface-border bg-slate-50/50">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Assigned Agent</p>
                  </div>
                  <div className="p-3">
                    <NativeSelect value={c.agent || ''} onChange={e => onUpdate(c.id, { agent: e.target.value || null })} sm>
                      <option value="">Unassigned</option>
                      {['Riya Patel', 'Arjun Dev', 'Neha Shah', 'Karan Mehta'].map(a => <option key={a}>{a}</option>)}
                    </NativeSelect>
                  </div>
                </div>
              </div>
            </div>

            {/* Subscribed toggle */}
            <div className="flex items-center justify-between px-4 py-2.5 bg-white border border-surface-border rounded-xl">
              <div className="flex items-center gap-2">
                <div className={clsx('w-6 h-6 rounded-full flex items-center justify-center', isActive ? 'bg-emerald-100' : 'bg-slate-100')}>
                  {isActive ? <CheckCircle2 size={12} className="text-emerald-600"/> : <XCircle size={12} className="text-slate-400"/>}
                </div>
                <div>
                  <p className="text-[11px] font-semibold text-slate-700">{isActive ? 'Subscribed' : 'Not Subscribed'}</p>
                  <p className="text-[10px] text-slate-400">{isActive ? 'Can receive DMs & automation' : 'Automation paused for this contact'}</p>
                </div>
              </div>
              <button onClick={() => onUpdate(c.id, { status: isActive ? 'inactive' : 'active' })}
                className={clsx('relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none', isActive ? 'bg-emerald-500' : 'bg-slate-200')}>
                <span className={clsx('pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow ring-0 transition-transform duration-200 ease-in-out', isActive ? 'translate-x-4' : 'translate-x-0')}/>
              </button>
            </div>

            {/* Tags */}
            <div className="bg-white border border-surface-border rounded-xl overflow-hidden">
              <div className="flex items-center justify-between px-4 py-2.5 border-b border-surface-border bg-slate-50/50">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Tags</p>
                <button onClick={() => setAddTag(p => !p)} className="flex items-center gap-1 text-[11px] text-primary font-semibold hover:underline"><Plus size={11}/>Add tag</button>
              </div>
              <div className="p-4">
                <div className="flex flex-wrap gap-2 min-h-[28px]">
                  {c.tags.map(t => (
                    <span key={t} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold" style={tSt(t)}>
                      {t}
                      <button onClick={() => onUpdate(c.id, { tags: c.tags.filter(x => x !== t) })} className="opacity-50 hover:opacity-100 ml-0.5"><X size={9}/></button>
                    </span>
                  ))}
                  {!c.tags.length && !addTag && <span className="text-[11px] text-slate-300 italic">No tags assigned</span>}
                </div>
                {addTag && (
                  <div className="mt-3 space-y-2">
                    <div className="flex gap-2">
                      <input autoFocus value={newTag} onChange={e => setNewTag(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter') doAddTag(); if (e.key === 'Escape') setAddTag(false) }}
                        placeholder="Type a tag name…"
                        className="flex-1 text-[11px] border border-surface-border rounded-lg px-3 py-1.5 focus:outline-none focus:border-primary/40 focus:ring-2 focus:ring-primary/10"/>
                      <button onClick={doAddTag} className="px-3 py-1.5 rounded-lg bg-primary text-white text-[11px] font-semibold">Add</button>
                      <button onClick={() => setAddTag(false)} className="px-2 py-1.5 rounded-lg text-slate-400 hover:bg-surface-hover"><X size={13}/></button>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {ALL_TAGS.filter(t => !c.tags.includes(t)).map(t => (
                        <button key={t} onClick={() => { onUpdate(c.id, { tags: [...c.tags, t] }); setAddTag(false) }}
                          className="px-2 py-0.5 rounded-full text-[10px] font-bold capitalize hover:opacity-80 transition-opacity" style={tSt(t)}>{t}</button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Groups */}
            <div className="bg-white border border-surface-border rounded-xl overflow-hidden">
              <div className="px-4 py-2.5 border-b border-surface-border bg-slate-50/50">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Groups</p>
              </div>
              <div className="p-3 space-y-2">
                <div className="flex flex-wrap gap-1.5">
                  {(c.groupIds || []).map(gid => {
                    const grp = groups.find(g => g.id === gid)
                    if (!grp) return null
                    return (
                      <span key={gid} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold" style={{ background: grp.color + '20', color: grp.color }}>
                        <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: grp.color }}/>
                        {grp.name}
                        <button onClick={() => onUpdate(c.id, { groupIds: (c.groupIds || []).filter(x => x !== gid) })} className="opacity-50 hover:opacity-100 ml-0.5"><X size={9}/></button>
                      </span>
                    )
                  })}
                  {!(c.groupIds || []).length && <span className="text-[11px] text-slate-300 italic">Not in any group</span>}
                </div>
                {groups.filter(g => !(c.groupIds || []).includes(g.id)).length > 0 && (
                  <NativeSelect value="" onChange={e => { if (e.target.value) onUpdate(c.id, { groupIds: [...(c.groupIds || []), e.target.value] }) }} sm>
                    <option value="">+ Add to group…</option>
                    {groups.filter(g => !(c.groupIds || []).includes(g.id)).map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
                  </NativeSelect>
                )}
              </div>
            </div>

            {customFields.contact.length > 0 && (
              <div className="bg-white border border-surface-border rounded-xl overflow-hidden">
                <div className="flex items-center gap-1.5 px-4 py-2.5 border-b border-surface-border bg-slate-50/50">
                  <Variable size={11} className="text-slate-400"/>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Custom Fields</p>
                </div>
                <div className="divide-y divide-surface-border/60">
                  {customFields.contact.map(f => (
                    <EditableCustomField key={f.id} field={f} value={(c.customAttrs || {})[f.key]}
                      onSave={v => onUpdate(c.id, { customAttrs: { ...(c.customAttrs || {}), [f.key]: v } })} />
                  ))}
                </div>
              </div>
            )}

            {/* Custom Attributes — ad-hoc key/value pairs from Add Contact or CSV Import,
               separate from the Settings-defined Custom Fields card above */}
            <div className="bg-white border border-surface-border rounded-xl overflow-hidden">
              <div className="flex items-center justify-between px-4 py-2.5 border-b border-surface-border bg-slate-50/50">
                <div className="flex items-center gap-1.5">
                  <Variable size={11} className="text-slate-400"/>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Custom Attributes</p>
                </div>
                <button onClick={() => setAddingAttr(p => !p)} className="flex items-center gap-1 text-[11px] text-primary font-semibold hover:underline">
                  <Plus size={11}/>Add
                </button>
              </div>
              <div className="p-3 space-y-2">
                {Object.keys(c.customAttrs || {}).filter(k => !customFields.contact.some(f => f.key === k)).length === 0 && !addingAttr && (
                  <p className="text-[11px] text-slate-300 italic px-1">No custom attributes yet.</p>
                )}
                {Object.entries(c.customAttrs || {}).filter(([k]) => !customFields.contact.some(f => f.key === k)).map(([k, v]) => (
                  <div key={k} className="flex items-center gap-2 bg-slate-50 rounded-lg px-3 py-1.5 border border-surface-border">
                    <span className="text-[10px] font-bold text-slate-400 font-mono min-w-[70px] truncate">{k}</span>
                    <span className="text-[11px] text-slate-500 mx-1">→</span>
                    <span className="flex-1 text-[11px] text-slate-700 font-medium truncate">{v}</span>
                    <button onClick={() => removeCustomAttr(k)} className="text-slate-300 hover:text-red-400 transition-colors flex-shrink-0"><X size={11}/></button>
                  </div>
                ))}
                {addingAttr && (
                  <div className="space-y-2 pt-1">
                    <div className="grid grid-cols-2 gap-2">
                      <input autoFocus value={newAttrKey} onChange={e => setNewAttrKey(e.target.value)} placeholder="Variable name"
                        className="text-[11px] border border-surface-border rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-primary/40 focus:ring-2 focus:ring-primary/10 placeholder-slate-300"/>
                      <input value={newAttrVal} onChange={e => setNewAttrVal(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter') addCustomAttr(); if (e.key === 'Escape') setAddingAttr(false) }}
                        placeholder="Value" className="text-[11px] border border-surface-border rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-primary/40 focus:ring-2 focus:ring-primary/10 placeholder-slate-300"/>
                    </div>
                    <div className="flex gap-2">
                      <button onClick={addCustomAttr} className="flex-1 py-1.5 rounded-lg bg-primary text-white text-[11px] font-semibold hover:bg-primary/90">Add Attribute</button>
                      <button onClick={() => { setAddingAttr(false); setNewAttrKey(''); setNewAttrVal('') }} className="px-3 py-1.5 rounded-lg border border-surface-border text-slate-400 text-[11px] hover:bg-surface-hover">Cancel</button>
                    </div>
                    <p className="text-[10px] text-slate-400 leading-relaxed">
                      Use attribute names like <span className="font-mono bg-slate-100 px-1 rounded">order_id</span>, <span className="font-mono bg-slate-100 px-1 rounded">plan</span> — map them in Quick Automations when personalizing messages.
                    </p>
                  </div>
                )}
              </div>
            </div>

            <button onClick={() => onDelete(c.id)}
              className="w-full py-2.5 rounded-xl border border-red-100 bg-red-50 text-red-500 text-[11px] font-semibold hover:bg-red-100 transition-colors flex items-center justify-center gap-1.5">
              <Trash2 size={12}/>Delete Contact
            </button>
          </div>
        )}

        {/* ACTIVITY TAB */}
        {tab === 'activity' && (
          <div className="p-4">
            {!(c.log || []).length
              ? <div className="flex flex-col items-center justify-center py-16 text-center">
                  <Clock size={28} className="text-slate-300 mb-3"/>
                  <p className="text-[13px] font-semibold text-slate-500">No activity yet</p>
                </div>
              : <div className="space-y-3">
                  {(c.log || []).map((l, i) => {
                    const s = LOG_ST[l.t] || LOG_ST.created
                    const Icon = s.Icon
                    return (
                      <div key={i} className="flex items-start gap-3 bg-white border border-surface-border rounded-xl p-3.5">
                        <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: s.bg }}>
                          <Icon size={13} style={{ color: s.c }}/>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-[11px] text-slate-700 leading-snug font-medium">{l.text}</p>
                          <p className="text-[10px] text-slate-400 mt-1">{fmtD(l.date)}</p>
                        </div>
                      </div>
                    )
                  })}
                </div>}
          </div>
        )}

        {/* NOTES TAB */}
        {tab === 'notes' && (
          <div className="p-4 flex flex-col gap-3 h-full">
            <div className="flex items-center justify-between">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Private Notes</p>
              {noteDirty && (
                <button onClick={saveNote} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary text-white text-[11px] font-semibold hover:bg-primary/90 transition-colors">
                  <Check size={11}/>Save
                </button>
              )}
              {!noteDirty && noteText.trim() && (
                <span className="flex items-center gap-1 text-[11px] text-emerald-500"><CheckCircle2 size={11}/>Saved</span>
              )}
            </div>
            <textarea
              value={noteText}
              onChange={e => { setNoteText(e.target.value); setNoteDirty(e.target.value !== (c.notes || '')) }}
              onBlur={saveNote}
              rows={16}
              placeholder={'Add private notes about this contact…\n\nThese notes are only visible to your team.'}
              className="w-full text-[12px] border border-surface-border rounded-xl p-4 text-slate-700 placeholder-slate-300 focus:outline-none focus:ring-2 focus:ring-primary/15 focus:border-primary/30 resize-none transition-all leading-relaxed bg-slate-50/40 focus:bg-white"/>
            <p className="text-[11px] text-slate-400 flex items-center gap-1.5"><CheckCircle2 size={11} className="text-slate-300"/>Auto-saved when you click away</p>
          </div>
        )}
      </div>
    </div>
  )
}

/* ─── shared lists ───────────────────────────────────────────── */
const AGENT_NAMES = ['Riya Patel', 'Arjun Dev', 'Neha Shah', 'Karan Mehta']

/* ─── CSV helpers — same shape as WhatsApp's, IG fields only ──── */
function parseCSV(text) {
  const lines = text.split(/\r?\n/).filter(l => l.trim())
  if (!lines.length) return []
  function parseLine(line) {
    const fields = []
    let cur = '', inQ = false
    for (let i = 0; i < line.length; i++) {
      const ch = line[i]
      if (ch === '"') { inQ = !inQ }
      else if (ch === ',' && !inQ) { fields.push(cur.trim()); cur = '' }
      else { cur += ch }
    }
    fields.push(cur.trim())
    return fields
  }
  const headers = parseLine(lines[0]).map(h => h.toLowerCase().replace(/^"|"$/g, ''))
  const map = h => {
    if (['name', 'full name', 'full_name'].includes(h)) return 'name'
    if (['handle', 'username', 'instagram handle', 'instagram_handle'].includes(h)) return 'handle'
    if (['phone', 'phone number', 'phone_number', 'mobile'].includes(h)) return 'phone'
    if (['email'].includes(h)) return 'email'
    if (['company', 'organisation', 'organization', 'business'].includes(h)) return 'company'
    if (['city'].includes(h)) return 'city'
    if (['language', 'lang'].includes(h)) return 'language'
    if (['tags', 'tag'].includes(h)) return 'tags'
    if (['agent', 'assigned to', 'assigned_to'].includes(h)) return 'agent'
    if (['notes', 'note'].includes(h)) return 'notes'
    if (['source'].includes(h)) return 'source'
    return null
  }
  const today = new Date().toISOString().slice(0, 10)
  return lines.slice(1).filter(l => l.trim()).map((line, i) => {
    const vals = parseLine(line)
    const row = {}
    const customAttrs = {}
    headers.forEach((h, idx) => {
      const key = map(h)
      const val = (vals[idx] || '').replace(/^"|"$/g, '').trim()
      if (key) row[key] = val
      else if (h && val) customAttrs[h] = val
    })
    if (!row.name && !row.handle) return null
    const handle = row.handle ? (row.handle.startsWith('@') ? row.handle : `@${row.handle}`) : ''
    return {
      id: `imp_${Date.now()}_${i}`,
      name: row.name || handle,
      handle, avatar: inits(row.name || handle),
      phone: row.phone || '', email: row.email || '', company: row.company || '',
      city: row.city || '', language: row.language || '',
      source: row.source || 'dm', status: 'active', starred: false,
      tags: row.tags ? row.tags.split(';').map(t => t.trim()).filter(Boolean) : [],
      agent: row.agent || null, notes: row.notes || '',
      created: today, last: today, convos: 0, score: 50, aiSummary: '',
      customAttrs: Object.keys(customAttrs).length ? customAttrs : {},
      groupIds: [],
      log: [{ t: 'created', text: 'Imported via CSV', date: today }],
    }
  }).filter(Boolean)
}

function exportContacts(contacts) {
  const headers = ['Name', 'Handle', 'Phone', 'Email', 'Company', 'City', 'Language', 'Source', 'Status', 'Tags', 'Agent', 'Created', 'Last Active', 'Conversations', 'Notes']
  const rows = contacts.map(c => [
    c.name, c.handle, c.phone || '', c.email || '', c.company || '', c.city || '', c.language || '', c.source, c.status,
    (c.tags || []).join(';'), c.agent || '', c.created || '', fmtR(c.last), c.convos || 0, (c.notes || '').replace(/\n/g, ' '),
  ])
  const escape = v => {
    const s = String(v)
    return s.includes(',') || s.includes('"') || s.includes('\n') ? `"${s.replace(/"/g, '""')}"` : s
  }
  const csv = [headers, ...rows].map(r => r.map(escape).join(',')).join('\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `instagram_contacts_${new Date().toISOString().slice(0, 10)}.csv`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

/* ─── Add contact modal ───────────────────────────────────────── */
function AddModal({ onClose, onAdd }) {
  const [f, setF] = useState({ name: '', handle: '', phone: '', email: '', company: '', city: '', language: '', source: 'dm', agent: '' })
  const [err, setErr] = useState('')
  const [attrs, setAttrs] = useState([])
  const [addingAttr, setAddingAttr] = useState(false)
  const [attrKey, setAttrKey] = useState('')
  const [attrVal, setAttrVal] = useState('')

  const up = k => e => setF(p => ({ ...p, [k]: e.target.value }))
  const fi = 'w-full text-[11px] border border-surface-border rounded-lg px-2.5 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-primary/15 focus:border-primary/40 placeholder-slate-300 transition-all'
  const lb = 'block text-[10px] font-semibold text-slate-500 mb-1'

  function addAttr() {
    const k = attrKey.trim(), v = attrVal.trim()
    if (!k) return
    setAttrs(p => [...p.filter(a => a.key !== k), { key: k, val: v }])
    setAttrKey(''); setAttrVal(''); setAddingAttr(false)
  }

  function submit() {
    if (!f.name.trim()) { setErr('Name is required'); return }
    if (!f.handle.trim()) { setErr('Instagram handle is required'); return }
    const handle = f.handle.trim().startsWith('@') ? f.handle.trim() : `@${f.handle.trim()}`
    const customAttrs = {}
    attrs.forEach(a => { if (a.key) customAttrs[a.key] = a.val })
    onAdd({
      ...f, handle, avatar: inits(f.name), id: String(Date.now()), starred: false, status: 'active', tags: [],
      agent: f.agent || null, convos: 0,
      created: new Date().toISOString().slice(0, 10),
      last: new Date().toISOString(),
      notes: '', score: 50, aiSummary: '', customAttrs, groupIds: [],
      log: [{ t: 'created', text: 'Created manually', date: new Date().toISOString().slice(0, 10) }],
    })
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="bg-white w-full max-w-md rounded-2xl shadow-modal flex flex-col max-h-[88vh] overflow-hidden border border-surface-border">
        <div className="flex items-center gap-3 px-4 py-3 border-b border-surface-border flex-shrink-0">
          <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: avBg().bg }}>
            <UserPlus size={13} style={{ color: avBg().color }}/>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[13px] font-bold text-slate-900">Add New Contact</p>
            <p className="text-[10px] text-slate-400">Fill in the details below to create a contact</p>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-surface-hover text-slate-400 transition-colors"><X size={14}/></button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          <div>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2.5">Basic Information</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <div>
                <label className={lb}>Name <span className="text-red-400">*</span></label>
                <input className={fi} placeholder="Priya Sharma" value={f.name} onChange={up('name')} autoFocus/>
              </div>
              <div>
                <label className={lb}>Instagram Handle <span className="text-red-400">*</span></label>
                <input className={fi} placeholder="@priya.sharma" value={f.handle} onChange={up('handle')}/>
              </div>
              <div>
                <label className={lb}>Phone</label>
                <input type="tel" className={fi} placeholder="+91 98765 43210" value={f.phone} onChange={up('phone')}/>
              </div>
              <div>
                <label className={lb}>Email</label>
                <input type="email" className={fi} placeholder="priya@email.com" value={f.email} onChange={up('email')}/>
              </div>
              <div>
                <label className={lb}>Company</label>
                <input className={fi} placeholder="Acme Corp" value={f.company} onChange={up('company')}/>
              </div>
              <div>
                <label className={lb}>City</label>
                <input className={fi} placeholder="Mumbai" value={f.city} onChange={up('city')}/>
              </div>
              <div>
                <label className={lb}>Language</label>
                <NativeSelect value={f.language} onChange={up('language')} sm>
                  <option value="">Select language</option>
                  {LANGS.map(l => <option key={l} value={l}>{l}</option>)}
                </NativeSelect>
              </div>
              <div>
                <label className={lb}>Source</label>
                <NativeSelect value={f.source} onChange={up('source')} sm>
                  <option value="dm">Direct Message</option>
                  <option value="comment">Comment</option>
                  <option value="story">Story</option>
                  <option value="manual">Manual</option>
                </NativeSelect>
              </div>
              <div>
                <label className={lb}>Assign To</label>
                <NativeSelect value={f.agent} onChange={up('agent')} sm>
                  <option value="">Unassigned</option>
                  {AGENT_NAMES.map(a => <option key={a}>{a}</option>)}
                </NativeSelect>
              </div>
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2.5">
              <div className="flex items-center gap-1.5">
                <Variable size={11} className="text-slate-400"/>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Custom Attributes</p>
              </div>
              <button onClick={() => setAddingAttr(p => !p)} className="flex items-center gap-1 text-[11px] text-primary font-semibold hover:underline">
                <Plus size={11}/>Add
              </button>
            </div>
            <div className="space-y-1.5">
              {attrs.map((a, i) => (
                <div key={i} className="flex items-center gap-2 bg-slate-50 rounded-lg px-3 py-1.5 border border-surface-border">
                  <span className="text-[10px] font-bold text-slate-400 font-mono min-w-[70px] truncate">{a.key}</span>
                  <span className="text-[11px] text-slate-500 mx-1">→</span>
                  <span className="flex-1 text-[11px] text-slate-700 font-medium truncate">{a.val || '—'}</span>
                  <button onClick={() => setAttrs(p => p.filter((_, j) => j !== i))} className="text-slate-300 hover:text-red-400 transition-colors flex-shrink-0"><X size={11}/></button>
                </div>
              ))}
              {!attrs.length && !addingAttr && <p className="text-[11px] text-slate-300 italic px-1">No custom attributes yet</p>}
            </div>
            {addingAttr && (
              <div className="mt-2 space-y-2">
                <div className="grid grid-cols-2 gap-2">
                  <input autoFocus value={attrKey} onChange={e => setAttrKey(e.target.value)} placeholder="Variable name" className={fi}/>
                  <input value={attrVal} onChange={e => setAttrVal(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') addAttr(); if (e.key === 'Escape') setAddingAttr(false) }}
                    placeholder="Value" className={fi}/>
                </div>
                <div className="flex gap-2">
                  <button onClick={addAttr} className="flex-1 py-1.5 rounded-lg bg-primary text-white text-[11px] font-semibold hover:bg-primary/90">Add Attribute</button>
                  <button onClick={() => { setAddingAttr(false); setAttrKey(''); setAttrVal('') }} className="px-3 py-1.5 rounded-lg border border-surface-border text-slate-400 text-[11px] hover:bg-surface-hover">Cancel</button>
                </div>
                <p className="text-[10px] text-slate-400">
                  Use these in Quick Automations → message personalization (e.g. <span className="font-mono bg-slate-100 px-1 rounded">order_id</span>, <span className="font-mono bg-slate-100 px-1 rounded">plan</span>)
                </p>
              </div>
            )}
          </div>

          {err && <p className="text-[11px] text-red-500 bg-red-50 border border-red-100 px-3 py-2 rounded-lg flex items-center gap-1.5"><X size={11}/>{err}</p>}
        </div>

        <div className="flex items-center justify-between px-4 py-2.5 border-t border-surface-border flex-shrink-0">
          <button onClick={onClose} className="text-[11px] text-slate-400 hover:text-slate-600 transition-colors">Cancel</button>
          <button onClick={submit} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary text-white text-[11px] font-semibold hover:bg-primary/90 transition-colors">
            <UserPlus size={11}/>Add Contact
          </button>
        </div>
      </div>
    </div>
  )
}

/* ─── Import contacts modal — CSV only, no WhatsApp-template branch ── */
function ImportModal({ onClose, onImport, groups = [] }) {
  const { customFields, addCustomField } = useApp()
  const [step, setStep] = useState('upload') // upload | preview | done
  const [parsed, setParsed] = useState([])
  const [drag, setDrag] = useState(false)
  const [assignGroup, setAssignGroup] = useState('')
  const [selectedCustomKeys, setSelectedCustomKeys] = useState([])
  const [newCustomFieldName, setNewCustomFieldName] = useState('')
  const fileRef = useRef(null)

  function toggleCustomKey(key) { setSelectedCustomKeys(prev => prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]) }
  function addAndSelectCustomField() {
    const name = newCustomFieldName.trim()
    if (!name) return
    const key = name.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '')
    if (!customFields.contact.some(f => f.key === key)) addCustomField('contact', { id: Date.now(), name, key, type: 'text', required: false })
    setSelectedCustomKeys(prev => prev.includes(key) ? prev : [...prev, key])
    setNewCustomFieldName('')
  }

  function handleFile(file) {
    if (!file) return
    const reader = new FileReader()
    reader.onload = e => { setParsed(parseCSV(e.target.result)); setStep('preview') }
    reader.readAsText(file)
  }

  function doImport() {
    const toImport = parsed.map(c => ({
      ...c, groupIds: assignGroup ? [...(c.groupIds || []), assignGroup].filter((v, i, a) => a.indexOf(v) === i) : (c.groupIds || []),
    }))
    onImport(toImport)
    setStep('done')
    setTimeout(onClose, 1800)
  }

  function downloadSample() {
    const extraHeaders = selectedCustomKeys.join(',')
    const extraVals = selectedCustomKeys.map(() => 'value').join(',')
    const csv = [
      `Name,Handle,Email,Company,Tags,Agent,Source,Notes${extraHeaders ? ',' + extraHeaders : ''}`,
      `Priya Sharma,@priya.sharma,priya@example.com,Sharma Enterprises,vip;customer,Riya Patel,dm,VIP customer${extraVals ? ',' + extraVals : ''}`,
      `Rahul Mehta,@rahul.mehta,rahul@techcorp.com,TechCorp Solutions,lead,Arjun Dev,comment,${extraVals ? ',' + extraVals : ''}`,
      `Anita Kapoor,@anita.kapoor,anita@example.com,Kapoor & Co,,,story,Follow up next week${extraVals ? ',' + extraVals : ''}`,
    ].join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = 'instagram_contacts_sample.csv'
    a.click()
    URL.revokeObjectURL(a.href)
  }

  const TITLES = { upload: 'Upload a CSV file', preview: `Preview — ${parsed.length} contacts found`, done: 'Import complete' }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="bg-white w-full max-w-lg rounded-2xl shadow-modal overflow-hidden border border-surface-border flex flex-col max-h-[85vh]">
        <div className="flex items-center gap-3 px-4 py-3.5 border-b border-surface-border">
          {step === 'preview' && (
            <button onClick={() => setStep('upload')} className="p-1 rounded-lg hover:bg-surface-hover text-slate-400 transition-colors flex-shrink-0"><ArrowLeft size={14}/></button>
          )}
          <div className="w-8 h-8 rounded-xl bg-violet-50 border border-violet-100 flex items-center justify-center flex-shrink-0">
            <FileUp size={14} className="text-violet-600"/>
          </div>
          <div className="flex-1">
            <p className="text-[13px] font-bold text-slate-900">Import Contacts</p>
            <p className="text-[11px] text-slate-400">{TITLES[step]}</p>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-surface-hover text-slate-400 transition-colors"><X size={14}/></button>
        </div>

        <div className="flex-1 overflow-y-auto">
          {step === 'upload' && (
            <div className="p-5 space-y-4">
              <div
                onDragOver={e => { e.preventDefault(); setDrag(true) }}
                onDragLeave={() => setDrag(false)}
                onDrop={e => { e.preventDefault(); setDrag(false); handleFile(e.dataTransfer.files[0]) }}
                onClick={() => fileRef.current?.click()}
                className={clsx('border-2 border-dashed rounded-xl p-10 flex flex-col items-center justify-center cursor-pointer transition-colors',
                  drag ? 'border-primary bg-primary-50' : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50')}>
                <Upload size={28} className={clsx('mb-3', drag ? 'text-primary' : 'text-slate-300')}/>
                <p className="text-[13px] font-semibold text-slate-600">Drop CSV file here</p>
                <p className="text-[11px] text-slate-400 mt-1">or click to browse</p>
                <input ref={fileRef} type="file" accept=".csv" className="hidden" onChange={e => handleFile(e.target.files[0])}/>
              </div>

              <div className="bg-slate-50 rounded-xl p-3.5 border border-surface-border">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Expected Columns</p>
                <div className="flex flex-wrap gap-1.5">
                  {['Name', 'Handle', 'Email', 'Company', 'Tags (;-sep)', 'Agent', 'Source', 'Notes', ...selectedCustomKeys].map(col => (
                    <span key={col} className="px-2 py-0.5 bg-white border border-slate-200 rounded-md text-[10px] font-mono text-slate-600">{col}</span>
                  ))}
                </div>
                <p className="text-[10px] text-slate-400 mt-2">Name or Handle is required. All other fields are optional.</p>
                <p className="text-[10px] text-slate-500 mt-1.5 flex items-center gap-1">
                  <span className="font-semibold text-violet-600">+</span> Any other column name → stored as <span className="font-semibold">Custom Attribute</span>
                </p>
                <div className="mt-3 pt-3 border-t border-slate-200">
                  <button onClick={downloadSample} className="flex items-center gap-1.5 text-[10px] font-semibold text-violet-600 hover:text-violet-700 transition-colors">
                    <Download size={11}/> Download sample CSV
                  </button>
                </div>
              </div>

              <div className="bg-slate-50 rounded-xl p-3.5 border border-surface-border">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Custom Fields (optional)</p>
                <p className="text-[10px] text-slate-500 mb-2.5">Pick fields to include as extra columns — matched from Settings → Custom Fields, or add a new one.</p>
                <div className="flex flex-wrap gap-1.5 mb-2.5">
                  {customFields.contact.map(f => (
                    <button key={f.id} type="button" onClick={() => toggleCustomKey(f.key)}
                      className={clsx('px-2 py-0.5 rounded-full text-[10px] font-semibold border transition-colors',
                        selectedCustomKeys.includes(f.key) ? 'bg-primary text-white border-primary' : 'bg-white text-slate-600 border-slate-200 hover:border-primary/40')}>
                      {f.name}
                    </button>
                  ))}
                  {!customFields.contact.length && <span className="text-[10px] text-slate-300 italic">No custom fields yet</span>}
                </div>
                <div className="flex gap-2">
                  <input value={newCustomFieldName} onChange={e => setNewCustomFieldName(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') addAndSelectCustomField() }}
                    placeholder="New field name…" className="flex-1 text-[11px] border border-surface-border rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-primary/40"/>
                  <button onClick={addAndSelectCustomField} className="px-3 py-1.5 rounded-lg border border-surface-border text-slate-600 text-[11px] font-semibold hover:bg-surface-hover">Add</button>
                </div>
              </div>

              {groups.length > 0 && (
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1.5">Assign all to group (optional)</label>
                  <NativeSelect value={assignGroup} onChange={e => setAssignGroup(e.target.value)} sm>
                    <option value="">No group</option>
                    {groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
                  </NativeSelect>
                </div>
              )}
            </div>
          )}

          {step === 'preview' && (
            <div className="p-5 space-y-3">
              {parsed.length === 0 ? (
                <p className="text-[12px] text-slate-400 text-center py-8">No valid rows found — check that your CSV has a Name or Handle column.</p>
              ) : (
                <div className="border border-surface-border rounded-xl overflow-hidden divide-y divide-surface-border max-h-72 overflow-y-auto">
                  {parsed.map(c => (
                    <div key={c.id} className="flex items-center gap-2.5 px-3 py-2">
                      <div className="w-7 h-7 rounded-full flex items-center justify-center font-semibold text-[10px] flex-shrink-0" style={{ background: avBg().bg, color: avBg().color }}>{c.avatar}</div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[11px] font-semibold text-slate-700 truncate">{c.name}</p>
                        <p className="text-[10px] text-slate-400 truncate">{c.handle || '—'} {c.email && `· ${c.email}`}</p>
                      </div>
                      {c.tags.length > 0 && <span className="text-[9px] text-slate-400 flex-shrink-0">{c.tags.join(', ')}</span>}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {step === 'done' && (
            <div className="p-8 flex flex-col items-center text-center">
              <div className="w-14 h-14 rounded-full bg-emerald-50 flex items-center justify-center mb-3"><CheckCircle2 size={24} className="text-emerald-500"/></div>
              <p className="text-[13px] font-bold text-slate-800">{parsed.length} contact{parsed.length !== 1 && 's'} imported</p>
              <p className="text-[11px] text-slate-400 mt-1">This window will close automatically.</p>
            </div>
          )}
        </div>

        {step === 'preview' && (
          <div className="flex items-center justify-between px-4 py-2.5 border-t border-surface-border flex-shrink-0">
            <button onClick={onClose} className="text-[11px] text-slate-400 hover:text-slate-600 transition-colors">Cancel</button>
            <button onClick={doImport} disabled={parsed.length === 0}
              className={clsx('flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-semibold transition-colors',
                parsed.length ? 'bg-primary text-white hover:bg-primary/90' : 'bg-slate-100 text-slate-400 cursor-not-allowed')}>
              <Upload size={11}/>Import {parsed.length} Contact{parsed.length !== 1 && 's'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

/* ─── Bulk DM modal — compose-and-send to N selected contacts ── */
function BulkDMModal({ count, onClose, onSend }) {
  const [message, setMessage] = useState('')
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="bg-white w-full max-w-sm rounded-2xl shadow-modal overflow-hidden border border-surface-border">
        <div className="flex items-center gap-3 px-4 py-3 border-b border-surface-border">
          <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: avBg().bg }}>
            <Send size={13} style={{ color: avBg().color }}/>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[13px] font-bold text-slate-900">Send DM</p>
            <p className="text-[10px] text-slate-400">To {count} selected contact{count !== 1 && 's'}</p>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-surface-hover text-slate-400 transition-colors"><X size={14}/></button>
        </div>
        <div className="p-4 space-y-2">
          <textarea autoFocus rows={4} value={message} onChange={e => setMessage(e.target.value)} placeholder="Type your message…"
            className="w-full text-[12px] border border-surface-border rounded-xl p-3 text-slate-700 placeholder-slate-300 focus:outline-none focus:ring-2 focus:ring-primary/15 focus:border-primary/30 resize-none"/>
          <p className="text-[10px] text-slate-400">Sent as an individual DM to each selected contact.</p>
        </div>
        <div className="flex items-center justify-between px-4 py-2.5 border-t border-surface-border">
          <button onClick={onClose} className="text-[11px] text-slate-400 hover:text-slate-600 transition-colors">Cancel</button>
          <button onClick={() => { if (message.trim()) { onSend(message.trim()); onClose() } }} disabled={!message.trim()}
            className={clsx('flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-semibold transition-colors',
              message.trim() ? 'bg-primary text-white hover:bg-primary/90' : 'bg-slate-100 text-slate-400 cursor-not-allowed')}>
            <Send size={11}/>Send to {count}
          </button>
        </div>
      </div>
    </div>
  )
}

/* ─── Create group modal ────────────────────────────────────── */
const GROUP_COLORS = ['#8B5CF6', '#EC4899', '#10b981', '#f59e0b', '#0066ff', '#ef4444']
function CreateGroupModal({ onClose, onSave }) {
  const [name, setName] = useState('')
  const [color, setColor] = useState(GROUP_COLORS[0])
  const [desc, setDesc] = useState('')
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="bg-white w-full max-w-sm rounded-2xl shadow-modal overflow-hidden border border-surface-border">
        <div className="flex items-center justify-between px-4 py-3.5 border-b border-surface-border">
          <p className="text-[13px] font-bold text-slate-900">Create Group</p>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-surface-hover text-slate-400"><X size={14}/></button>
        </div>
        <div className="p-4 space-y-3">
          <div>
            <label className="text-[10px] font-semibold text-slate-500 block mb-1">Name</label>
            <input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Warm Leads"
              className="w-full text-[12px] border border-surface-border rounded-lg px-3 py-1.5 focus:outline-none focus:border-primary/40" />
          </div>
          <div>
            <label className="text-[10px] font-semibold text-slate-500 block mb-1.5">Color</label>
            <div className="flex gap-2">
              {GROUP_COLORS.map(cColor => (
                <button key={cColor} onClick={() => setColor(cColor)}
                  className={clsx('w-7 h-7 rounded-full border-2 transition-all', color === cColor ? 'border-slate-800 scale-110' : 'border-transparent')}
                  style={{ background: cColor }} />
              ))}
            </div>
          </div>
          <div>
            <label className="text-[10px] font-semibold text-slate-500 block mb-1">Description (optional)</label>
            <input value={desc} onChange={e => setDesc(e.target.value)} placeholder="What's this group for?"
              className="w-full text-[12px] border border-surface-border rounded-lg px-3 py-1.5 focus:outline-none focus:border-primary/40" />
          </div>
        </div>
        <div className="flex items-center justify-between px-4 py-2.5 border-t border-surface-border">
          <button onClick={onClose} className="text-[11px] text-slate-400 hover:text-slate-600">Cancel</button>
          <button onClick={() => { if (name.trim()) { onSave({ id: 'grp' + Date.now(), name: name.trim(), color, desc }); onClose() } }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary text-white text-[11px] font-semibold hover:bg-primary/90">
            <Plus size={11}/>Create Group
          </button>
        </div>
      </div>
    </div>
  )
}

/* ─── Page ───────────────────────────────────────────────────── */
export default function InstagramContacts() {
  const [contacts, setContacts]   = useState(INIT_CONTACTS)
  const [selId, setSelId]         = useState(INIT_CONTACTS[0]?.id || null)
  const [viewMode, setViewMode]   = useState('list')
  const [search, setSearch]       = useState('')
  const [seg, setSeg]             = useState('all')
  const [tagFil, setTagFil]       = useState(null)
  const [sourceFil, setSourceFil] = useState(null)
  const [agentFil, setAgentFil]   = useState(null)
  const [groupFil, setGroupFil]   = useState(null)
  const [dateFil, setDateFil]     = useState('any')
  const [sortBy, setSortBy]       = useState('recent')
  const [groups, setGroups]       = useState(INIT_GROUPS)
  const [showCreateGroup, setShowCreateGroup] = useState(false)
  const [showFilters, setShowFilters] = useState(false)
  const [selectedIds, setSelectedIds] = useState(() => new Set())
  const [manualSelect, setManualSelect] = useState(false)
  const [showSelectMenu, setShowSelectMenu] = useState(false)
  const [showAdd, setShowAdd]     = useState(false)
  const [showImport, setShowImport] = useState(false)
  const [showBulkDM, setShowBulkDM] = useState(false)
  const selectMenuRef = useRef(null)

  useEffect(() => {
    if (!showSelectMenu) return
    function h(e) { if (selectMenuRef.current && !selectMenuRef.current.contains(e.target)) setShowSelectMenu(false) }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [showSelectMenu])

  const segCounts = useMemo(() => {
    const m = {}; SEGS.forEach(s => { m[s.id] = contacts.filter(s.fn).length }); return m
  }, [contacts])
  const tagCounts = useMemo(() => {
    const m = {}; contacts.forEach(c => c.tags.forEach(t => { m[t] = (m[t] || 0) + 1 })); return m
  }, [contacts])

  const list = useMemo(() => {
    const segFn = SEGS.find(s => s.id === seg)?.fn || (() => true)
    return contacts.filter(c => {
      if (!segFn(c)) return false
      if (tagFil && !c.tags.includes(tagFil)) return false
      if (sourceFil && c.source !== sourceFil) return false
      if (agentFil === 'unassigned' && c.agent) return false
      if (agentFil && agentFil !== 'unassigned' && c.agent !== agentFil) return false
      if (groupFil && !(c.groupIds || []).includes(groupFil)) return false
      if (!datePass(c, dateFil)) return false
      if (search) {
        const q = search.toLowerCase()
        if (!c.name.toLowerCase().includes(q) && !c.handle.toLowerCase().includes(q) && !(c.email || '').toLowerCase().includes(q)) return false
      }
      return true
    }).sort((a, b) => {
      if (sortBy === 'name-asc') return a.name.localeCompare(b.name)
      if (sortBy === 'name-desc') return b.name.localeCompare(a.name)
      return new Date(b.last) - new Date(a.last)
    })
  }, [contacts, seg, tagFil, sourceFil, agentFil, groupFil, dateFil, sortBy, search])

  const selContact = contacts.find(c => c.id === selId) || null
  function upd(id, patch) { setContacts(p => p.map(c => c.id === id ? { ...c, ...patch } : c)) }
  function del(id) { setContacts(p => p.filter(c => c.id !== id)); if (selId === id) setSelId(null) }
  function toggleSelect(id) { setSelectedIds(p => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n }) }
  function toggleAll() { setSelectedIds(p => p.size === list.length ? new Set() : new Set(list.map(c => c.id))) }
  function toggleSelectAll(rows) { setSelectedIds(new Set(rows.map(c => c.id))) }
  function addContact(c) { setContacts(p => [c, ...p]); setSelId(c.id) }
  function importContacts(newOnes) { setContacts(p => [...newOnes, ...p]) }
  function sendBulkDM(text) {
    const ids = selectedIds
    setContacts(p => p.map(c => ids.has(c.id)
      ? { ...c, last: new Date().toISOString(), convos: (c.convos || 0) + 1, log: [{ t: 'message', text: `Sent: "${text}"`, date: new Date().toISOString().slice(0, 10) }, ...(c.log || [])] }
      : c))
    setSelectedIds(new Set()); setManualSelect(false)
  }

  const activeFilters = [tagFil, sourceFil, agentFil, groupFil, dateFil !== 'any'].filter(Boolean).length
  const agentsInUse = [...new Set(contacts.map(c => c.agent).filter(Boolean))]

  return (
    <div className="h-[calc(100vh-48px)] md:h-screen -mx-3 -mt-3 -mb-3 sm:-mx-5 sm:-mt-5 sm:-mb-5 flex overflow-hidden">
      <div className={clsx('flex flex-col border-r border-surface-border bg-white overflow-hidden transition-all',
        viewMode === 'list' ? ['flex-shrink-0', 'w-full md:w-[300px]'] : ['flex-1'])}>

        {/* Row 1 */}
        <div className="flex items-center gap-1.5 px-3 py-2 border-b border-surface-border flex-shrink-0">
          <div className="flex-1 min-w-0">
            <p className="text-[13px] font-bold text-slate-800 leading-tight">Instagram Contacts</p>
            <p className="text-[10px] text-slate-400 truncate">{contacts.length} contacts · {contacts.filter(c => c.status === 'active').length} subscribed</p>
          </div>
          <div className="flex items-center bg-slate-100 rounded-lg p-0.5 flex-shrink-0">
            <button onClick={() => setViewMode('list')} title="List view" className={clsx('p-1 rounded-md transition-all', viewMode === 'list' ? 'bg-white shadow-sm text-slate-800' : 'text-slate-400')}><LayoutList size={12}/></button>
            <button onClick={() => setViewMode('table')} title="Table view" className={clsx('p-1 rounded-md transition-all', viewMode === 'table' ? 'bg-white shadow-sm text-slate-800' : 'text-slate-400')}><Table2 size={12}/></button>
          </div>
          <button onClick={() => setShowFilters(p => !p)} title="Filters"
            className={clsx('relative p-1.5 rounded-lg border transition-colors flex-shrink-0',
              activeFilters > 0 ? 'border-primary/30 bg-primary-50 text-primary' : 'border-surface-border bg-white text-slate-500 hover:bg-surface-hover')}>
            <SlidersHorizontal size={13}/>
            {activeFilters > 0 && <span className="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full bg-primary text-white text-[8px] font-bold flex items-center justify-center">{activeFilters}</span>}
          </button>
          <button onClick={() => setShowImport(true)} title="Import contacts" className="p-1.5 rounded-lg border border-surface-border bg-white text-slate-500 hover:bg-surface-hover transition-colors flex-shrink-0"><Upload size={13}/></button>
          <button onClick={() => exportContacts(list)} title="Export contacts" className="p-1.5 rounded-lg border border-surface-border bg-white text-slate-500 hover:bg-surface-hover transition-colors flex-shrink-0"><Download size={13}/></button>
          <button onClick={() => setShowAdd(true)} title="New contact" className="p-1.5 rounded-md bg-primary text-white hover:bg-primary/90 transition-colors flex-shrink-0"><Plus size={13}/></button>
        </div>

        {/* Row 2: search + group */}
        <div className="px-3 py-1.5 border-b border-surface-border flex items-center gap-1.5 flex-shrink-0">
          <div className="relative flex-1">
            <Search size={11} className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            <input className="w-full pl-6 pr-2 py-1 text-[11px] bg-slate-50 border border-surface-border rounded-lg placeholder-slate-400 focus:outline-none focus:border-primary/40 focus:bg-white transition-colors"
              placeholder="Search contacts…" value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <div className="relative flex-shrink-0" ref={selectMenuRef}>
            <button onClick={() => setShowSelectMenu(p => !p)} title="Select contacts"
              className={clsx('flex items-center gap-0.5 px-1.5 py-1.5 rounded-lg border transition-colors',
                (manualSelect || selectedIds.size > 0) ? 'border-primary/30 bg-primary-50 text-primary' : 'border-surface-border bg-white text-slate-500 hover:bg-surface-hover')}>
              <CheckSquare size={13}/><ChevronDown size={10}/>
            </button>
            {showSelectMenu && (
              <div className="absolute left-0 top-full mt-1 z-50 bg-white border border-surface-border rounded-xl shadow-lg py-1 min-w-[190px]">
                <button onClick={() => { toggleSelectAll(list); setManualSelect(true); setShowSelectMenu(false) }}
                  className="flex items-center gap-2.5 w-full px-3 py-2 text-[12px] text-slate-700 hover:bg-slate-50 transition-colors">
                  <CheckSquare size={13} className="text-primary flex-shrink-0"/>Select all
                </button>
                <button onClick={() => { setManualSelect(true); setShowSelectMenu(false) }}
                  className="flex items-center gap-2.5 w-full px-3 py-2 text-[12px] text-slate-700 hover:bg-slate-50 transition-colors">
                  <MousePointer2 size={13} className="text-slate-400 flex-shrink-0"/>Select manually
                </button>
                {(manualSelect || selectedIds.size > 0) && (
                  <>
                    <div className="my-1 border-t border-surface-border"/>
                    <button onClick={() => { setSelectedIds(new Set()); setManualSelect(false); setShowSelectMenu(false) }}
                      className="flex items-center gap-2.5 w-full px-3 py-2 text-[12px] text-slate-500 hover:bg-slate-50 transition-colors">
                      <X size={13} className="text-slate-400 flex-shrink-0"/>Clear selection
                    </button>
                  </>
                )}
              </div>
            )}
          </div>
          <FilterChip label={groupFil ? groups.find(g => g.id === groupFil)?.name : 'Group'} active={!!groupFil} onClear={() => setGroupFil(null)}>
            {({ close }) => (
              <>
                <DropOpt active={!groupFil} onClick={() => { setGroupFil(null); close() }}>All contacts</DropOpt>
                {groups.map(g => (
                  <DropOpt key={g.id} active={groupFil === g.id} onClick={() => { setGroupFil(g.id); close() }}>
                    <span className="inline-flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full" style={{ background: g.color }}/>{g.name}
                      <span className="text-slate-400">({contacts.filter(c => (c.groupIds || []).includes(g.id)).length})</span>
                    </span>
                  </DropOpt>
                ))}
                <div className="border-t border-surface-border mt-0.5 pt-0.5">
                  <button onClick={() => { setShowCreateGroup(true); close() }}
                    className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-primary font-semibold hover:bg-primary-50 text-left"><FolderPlus size={11}/> Create Group</button>
                </div>
              </>
            )}
          </FilterChip>
        </div>

        {/* Row 3: filter chips */}
        {(showFilters || activeFilters > 0) && (
          <div className="px-3 py-1.5 border-b border-surface-border flex flex-wrap gap-1 flex-shrink-0">
            <FilterChip label={seg === 'all' ? 'List' : SEGS.find(s => s.id === seg)?.label} active={seg !== 'all'} onClear={() => setSeg('all')}>
              {({ close }) => SEGS.map(s => (
                <DropOpt key={s.id} active={seg === s.id} onClick={() => { setSeg(s.id); close() }}>
                  {s.label} <span className="text-slate-400">({segCounts[s.id] || 0})</span>
                </DropOpt>
              ))}
            </FilterChip>
            <FilterChip label={tagFil || 'Tags'} active={!!tagFil} onClear={() => setTagFil(null)}>
              {({ close }) => Object.keys(tagCounts).map(t => (
                <DropOpt key={t} active={tagFil === t} onClick={() => { setTagFil(t); close() }}>#{t} ({tagCounts[t]})</DropOpt>
              ))}
            </FilterChip>
            <FilterChip label={sourceFil ? SRC_META[sourceFil]?.label : 'Source'} active={!!sourceFil} onClear={() => setSourceFil(null)}>
              {({ close }) => Object.entries(SRC_META).map(([k, v]) => (
                <DropOpt key={k} active={sourceFil === k} onClick={() => { setSourceFil(k); close() }}>{v.label}</DropOpt>
              ))}
            </FilterChip>
            <FilterChip label={agentFil || 'Agent'} active={!!agentFil} onClear={() => setAgentFil(null)}>
              {({ close }) => (<>
                <DropOpt active={agentFil === 'unassigned'} onClick={() => { setAgentFil('unassigned'); close() }}>Unassigned</DropOpt>
                {agentsInUse.map(a => <DropOpt key={a} active={agentFil === a} onClick={() => { setAgentFil(a); close() }}>{a}</DropOpt>)}
              </>)}
            </FilterChip>
            <FilterChip label={dateFil === 'any' ? 'Date' : DATE_OPTS.find(d => d.v === dateFil)?.l} active={dateFil !== 'any'} onClear={() => setDateFil('any')}>
              {({ close }) => DATE_OPTS.map(d => (
                <DropOpt key={d.v} active={dateFil === d.v} onClick={() => { setDateFil(d.v); close() }}>{d.l}</DropOpt>
              ))}
            </FilterChip>
            <FilterChip label="Sort" active={sortBy !== 'recent'} onClear={() => setSortBy('recent')}>
              {({ close }) => (<>
                <DropOpt active={sortBy === 'recent'} onClick={() => { setSortBy('recent'); close() }}>Most recent</DropOpt>
                <DropOpt active={sortBy === 'name-asc'} onClick={() => { setSortBy('name-asc'); close() }}>Name A-Z</DropOpt>
                <DropOpt active={sortBy === 'name-desc'} onClick={() => { setSortBy('name-desc'); close() }}>Name Z-A</DropOpt>
              </>)}
            </FilterChip>
            <span className="ml-auto text-[10px] text-slate-400 flex items-center flex-shrink-0">{list.length} result{list.length !== 1 && 's'}</span>
          </div>
        )}

        {/* Bulk action bar */}
        {selectedIds.size > 0 && (
          <div className="flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 bg-primary-50 border-b border-primary/15">
            <span className="text-[11px] font-semibold text-primary">{selectedIds.size} selected</span>
            <button onClick={() => setShowBulkDM(true)}
              className="ml-auto flex items-center gap-1 px-2 py-1 rounded-lg bg-white border border-primary/20 text-[10px] font-semibold text-primary hover:bg-primary-50"><Send size={10}/>DM</button>
            <button onClick={() => { setSelectedIds(new Set()); setManualSelect(false) }} className="text-[10px] text-slate-400 hover:text-slate-600">Clear</button>
          </div>
        )}

        {/* List / table body */}
        <div className="flex-1 overflow-y-auto">
          {list.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center px-4">
              <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mb-3"><Users size={18} className="text-slate-300" /></div>
              <p className="text-xs font-semibold text-slate-600">No contacts found</p>
              <p className="text-xs text-slate-400 mt-1">Try adjusting your filters</p>
            </div>
          ) : viewMode === 'list' ? (
            list.map(c => (
              <ContactRow key={c.id} c={c} active={c.id === selId} selected={selectedIds.has(c.id)} manualSelect={manualSelect}
                onClick={() => setSelId(c.id)} onToggleSelect={() => toggleSelect(c.id)} />
            ))
          ) : (
            <ContactTable contacts={list} activeId={selId} selectedIds={selectedIds} manualSelect={manualSelect}
              onSelect={setSelId} onToggleSelect={toggleSelect} onToggleAll={toggleAll} allSelected={selectedIds.size === list.length && list.length > 0} />
          )}
        </div>
      </div>

      {selContact ? (
        <ContactPanel c={selContact} onClose={() => setSelId(null)} onUpdate={upd} onDelete={del} groups={groups} />
      ) : (
        <div className="flex-1 hidden md:flex items-center justify-center bg-[#f7f8fc]">
          <div className="text-center">
            <div className="w-20 h-20 rounded-2xl bg-white border border-surface-border flex items-center justify-center mb-4 mx-auto">
              <InstagramIcon size={28} className="text-pink-300" />
            </div>
            <p className="font-semibold text-slate-600">Select a contact</p>
            <p className="text-sm text-slate-400 mt-1.5">Choose from the list on the left to view profile</p>
          </div>
        </div>
      )}

      {showCreateGroup && (
        <CreateGroupModal onClose={() => setShowCreateGroup(false)} onSave={g => setGroups(p => [...p, g])} />
      )}
      {showAdd && <AddModal onClose={() => setShowAdd(false)} onAdd={addContact}/>}
      {showImport && <ImportModal onClose={() => setShowImport(false)} onImport={importContacts} groups={groups}/>}
      {showBulkDM && <BulkDMModal count={selectedIds.size} onClose={() => setShowBulkDM(false)} onSend={sendBulkDM}/>}
    </div>
  )
}
