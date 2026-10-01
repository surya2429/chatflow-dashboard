import { useState, useRef, useEffect } from 'react'
import {
  Search, Send, MessageCircle, CheckCircle2, Star, X, Tag, Users, Inbox,
  ChevronDown, Plus, Archive, AlertCircle, RefreshCw, Filter, MoreVertical,
  Info, Paperclip, Smile, Mic, Camera, Hash,
  Mail, Building2, Pencil, CalendarDays, Link2, User2, Languages, Home,
  MapPin, Globe, Check, FileText, ShoppingBag, Activity, ChevronRight,
  AtSign, Instagram as InstagramIcon, Clock, ArrowRightLeft, Zap, UserPlus,
  BellOff, Bot, UserCheck,
} from 'lucide-react'
import clsx from 'clsx'
import { useApp } from '../context/AppContext'
import { NativeSelect } from '../components/Select'
import Select from '../components/Select'
import { AGENTS } from '../constants/mockData'

/* ─── mock data ──────────────────────────────────────────────── */
const STATUS_MAP = {
  bot:      { label: 'Bot',      dot: 'bg-blue-400',    badge: 'badge-blue'  },
  agent:    { label: 'Agent',    dot: 'bg-emerald-400', badge: 'badge-green' },
  resolved: { label: 'Resolved', dot: 'bg-slate-300',   badge: 'badge-gray'  },
}
const SOURCE_META = {
  dm:      { label: 'DM',      icon: Send,          color: 'text-primary' },
  comment: { label: 'Comment', icon: MessageCircle, color: 'text-emerald-600' },
  story:   { label: 'Story',   icon: Camera,        color: 'text-pink-600' },
}
const AGENT_STATUS_DOT = { online: 'bg-emerald-400', busy: 'bg-amber-400', offline: 'bg-slate-300' }
const AGENT_STATUS_LABEL = { online: 'Online', busy: 'Busy', offline: 'Offline' }

const CANNED = [
  { key: 'greet',    label: 'Greeting',        body: "Hey! 👋 Thanks for reaching out — how can I help?" },
  { key: 'ship',     label: 'Shipping Info',   body: 'We ship in 3–5 business days across India, with free shipping over ₹999!' },
  { key: 'wait',     label: 'Please Hold',     body: "Thanks for your patience! Checking this for you now — one moment 🙏" },
  { key: 'resolve',  label: 'Resolution',      body: "All set! Let me know if there's anything else I can help with 😊" },
  { key: 'escalate', label: 'Escalation Note', body: "I'm connecting you with a specialist who can help further — they'll be with you shortly!" },
]
const EMOJIS = ['😊','😂','❤️','👍','🙏','🎉','✅','⭐','🔥','💯','😭','🤔','👀','💪','🙌','😍','🥳','😅','👋','🤝']

/* ─── Instagram message templates ────────────────────────────────
   Instagram has no WhatsApp-style pre-approved template system — per
   Meta's docs, it has no equivalent that lets a business reach someone
   outside the 24-hour messaging window. What it DOES have are two real
   Send API structured message types, and this models their actual
   schema/limits rather than borrowing WhatsApp's category/approval
   concept, which doesn't apply here:
     - generic: a card, or a horizontally-scrolling carousel when more
       than one element is given. Up to 10 elements, each with a title
       (required, ≤80 chars), an optional subtitle (≤80 chars), an
       optional image, and up to 3 buttons.
     - button: plain text (≤640 chars) with up to 3 buttons attached.
   Both button types Meta supports: 'web_url' (opens a link) and
   'postback' (sends a payload string to the webhook — a quick-reply
   style option, not a literal WhatsApp "quick reply" button). */
const IG_TEMPLATE_LIMITS = { maxElements: 10, maxButtons: 3, titleMax: 80, subtitleMax: 80, textMax: 640 }

const IG_TEMPLATE_PRESETS = {
  generic: [
    { label: 'Product card', elements: [
      { title: 'Classic Tote Bag', subtitle: '₹1,499 · Available in 3 colors', imageUrl: '', buttons: [{ type: 'web_url', title: 'Shop now', url: 'https://example.com/product' }] },
    ] },
    { label: '2-card carousel', elements: [
      { title: 'Classic Tote Bag', subtitle: '₹1,499', imageUrl: '', buttons: [{ type: 'web_url', title: 'Shop now', url: 'https://example.com/tote' }] },
      { title: 'Mini Crossbody', subtitle: '₹999', imageUrl: '', buttons: [{ type: 'web_url', title: 'Shop now', url: 'https://example.com/crossbody' }] },
    ] },
  ],
  button: [
    { label: 'Quick options', text: 'How can we help today?', buttons: [
      { type: 'postback', title: 'Track my order', payload: 'TRACK_ORDER' },
      { type: 'postback', title: 'Talk to support', payload: 'TALK_TO_SUPPORT' },
    ] },
  ],
}

/* Shared by a generic element's buttons and a button-template's own —
   same type/limit rules either way. */
function IgButtonsEditor({ buttons, onChange }) {
  function update(i, patch) { onChange(buttons.map((b, idx) => idx === i ? { ...b, ...patch } : b)) }
  function add() { if (buttons.length >= IG_TEMPLATE_LIMITS.maxButtons) return; onChange([...buttons, { type: 'web_url', title: '', url: '' }]) }
  function remove(i) { onChange(buttons.filter((_, idx) => idx !== i)) }
  return (
    <div className="space-y-1.5">
      {buttons.map((b, i) => (
        <div key={i} className="flex items-center gap-1.5">
          <NativeSelect sm value={b.type} onChange={e => update(i, { type: e.target.value })} className="flex-shrink-0 w-[92px]">
            <option value="web_url">Link</option>
            <option value="postback">Quick reply</option>
          </NativeSelect>
          <input value={b.title} onChange={e => update(i, { title: e.target.value.slice(0, 20) })}
            placeholder="Button text" className="input-sm flex-1 min-w-0"/>
          {b.type === 'web_url' ? (
            <input value={b.url || ''} onChange={e => update(i, { url: e.target.value })}
              placeholder="https://…" className="input-sm flex-1 min-w-0"/>
          ) : (
            <input value={b.payload || ''} onChange={e => update(i, { payload: e.target.value })}
              placeholder="Payload sent to webhook" className="input-sm flex-1 min-w-0"/>
          )}
          <button onClick={() => remove(i)} className="text-slate-300 hover:text-red-500 flex-shrink-0"><X size={12}/></button>
        </div>
      ))}
      {buttons.length < IG_TEMPLATE_LIMITS.maxButtons && (
        <button onClick={add} className="text-[10px] font-semibold text-primary hover:underline flex items-center gap-1">
          <Plus size={10}/> Add button ({buttons.length}/{IG_TEMPLATE_LIMITS.maxButtons})
        </button>
      )}
    </div>
  )
}

function InstagramTemplateComposer({ onSend, onClose }) {
  const [kind, setKind] = useState('generic') // 'generic' | 'button'
  const [elements, setElements] = useState([{ title: '', subtitle: '', imageUrl: '', buttons: [] }])
  const [text, setText] = useState('')
  const [buttons, setButtons] = useState([])

  function addElement() { if (elements.length >= IG_TEMPLATE_LIMITS.maxElements) return; setElements([...elements, { title: '', subtitle: '', imageUrl: '', buttons: [] }]) }
  function updateElement(i, patch) { setElements(elements.map((e, idx) => idx === i ? { ...e, ...patch } : e)) }
  function removeElement(i) { setElements(elements.filter((_, idx) => idx !== i)) }
  function loadPreset(p) {
    if (kind === 'generic') setElements(p.elements.map(e => ({ ...e, buttons: e.buttons.map(b => ({ ...b })) })))
    else { setText(p.text); setButtons(p.buttons.map(b => ({ ...b }))) }
  }

  const genericValid = elements.length > 0 && elements.every(e => e.title.trim())
  const buttonValid = text.trim().length > 0
  const canSend = kind === 'generic' ? genericValid : buttonValid

  function handleSend() {
    if (!canSend) return
    onSend(kind === 'generic' ? { kind: 'generic', elements } : { kind: 'button', text, buttons })
  }

  return (
    <div className="fixed inset-0 bg-slate-900/25 z-50 flex items-center justify-center p-4" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="bg-white rounded-2xl w-full max-w-lg shadow-modal animate-fade-in overflow-hidden flex flex-col max-h-[85vh]">
        <div className="flex items-center justify-between px-5 py-4 border-b border-surface-border flex-shrink-0">
          <div>
            <h3 className="font-bold text-slate-900">Send a template message</h3>
            <p className="text-xs text-slate-500 mt-0.5">Instagram's structured Generic &amp; Button templates</p>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-surface-hover text-slate-400 hover:text-slate-600 transition-colors"><X size={16} /></button>
        </div>

        <div className="flex gap-1.5 px-5 pt-3 flex-shrink-0">
          {[['generic', 'Generic (card / carousel)'], ['button', 'Button']].map(([k, label]) => (
            <button key={k} onClick={() => setKind(k)}
              className={clsx('px-3 py-1.5 rounded-lg text-[11px] font-semibold transition-colors',
                kind === k ? 'bg-primary text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200')}>
              {label}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-3 space-y-3">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[9.5px] font-bold text-slate-400 uppercase tracking-wider">Start from</span>
            {IG_TEMPLATE_PRESETS[kind].map(p => (
              <button key={p.label} onClick={() => loadPreset(p)}
                className="text-[10.5px] px-2 py-1 rounded-full border border-surface-border text-slate-600 hover:border-primary hover:text-primary transition-colors">
                {p.label}
              </button>
            ))}
          </div>

          {kind === 'generic' ? (
            <div className="space-y-3">
              {elements.map((el, i) => (
                <div key={i} className="border border-surface-border rounded-xl p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Card {i + 1}</span>
                    {elements.length > 1 && <button onClick={() => removeElement(i)} className="text-slate-300 hover:text-red-500"><X size={12}/></button>}
                  </div>
                  <div>
                    <input value={el.title} onChange={e => updateElement(i, { title: e.target.value.slice(0, IG_TEMPLATE_LIMITS.titleMax) })}
                      placeholder="Title (required)" className="input-sm w-full"/>
                    <p className="text-[9px] text-slate-400 text-right mt-0.5">{el.title.length}/{IG_TEMPLATE_LIMITS.titleMax}</p>
                  </div>
                  <input value={el.subtitle} onChange={e => updateElement(i, { subtitle: e.target.value.slice(0, IG_TEMPLATE_LIMITS.subtitleMax) })}
                    placeholder="Subtitle (optional)" className="input-sm w-full"/>
                  <input value={el.imageUrl} onChange={e => updateElement(i, { imageUrl: e.target.value })}
                    placeholder="Image URL (optional)" className="input-sm w-full"/>
                  <IgButtonsEditor buttons={el.buttons} onChange={b => updateElement(i, { buttons: b })}/>
                </div>
              ))}
              {elements.length < IG_TEMPLATE_LIMITS.maxElements && (
                <button onClick={addElement} className="text-[11px] font-semibold text-primary hover:underline flex items-center gap-1">
                  <Plus size={11}/> Add card ({elements.length}/{IG_TEMPLATE_LIMITS.maxElements})
                </button>
              )}
            </div>
          ) : (
            <div className="space-y-2">
              <div>
                <textarea value={text} onChange={e => setText(e.target.value.slice(0, IG_TEMPLATE_LIMITS.textMax))} rows={3}
                  placeholder="Message text (required)" className="textarea w-full text-xs"/>
                <p className="text-[9px] text-slate-400 text-right mt-0.5">{text.length}/{IG_TEMPLATE_LIMITS.textMax}</p>
              </div>
              <IgButtonsEditor buttons={buttons} onChange={setButtons}/>
            </div>
          )}

          <div className="flex items-start gap-2 p-2.5 rounded-lg bg-blue-50 border border-blue-100">
            <AlertCircle size={12} className="text-blue-500 flex-shrink-0 mt-0.5"/>
            <p className="text-[10.5px] text-blue-800 leading-relaxed">
              Unlike WhatsApp, Instagram has no pre-approved templates — this still only sends within the
              standard 24-hour reply window, or up to 7 days if the conversation is tagged <code className="font-mono">HUMAN_AGENT</code> for
              an ongoing support case (never for marketing).
            </p>
          </div>
        </div>

        <div className="flex gap-2 px-5 pb-4 pt-1 flex-shrink-0">
          <button onClick={onClose} className="btn-secondary flex-1 justify-center text-sm">Cancel</button>
          <button onClick={handleSend} disabled={!canSend} className={clsx('flex-1 justify-center text-sm', canSend ? 'btn-primary' : 'btn-secondary opacity-50 cursor-not-allowed')}>
            <Send size={14}/> Send template
          </button>
        </div>
      </div>
    </div>
  )
}

const CONVERSATIONS = [
  { id: 'ic1', name: 'Ananya Rao', handle: '@ananya.rao', avatar: 'AR', time: '2m', unread: 2, starred: true,
    status: 'bot', agentId: null, agentName: null, source: 'dm', labels: ['lead'],
    lastMessage: 'Is the blue one still in stock?', archived: false,
    email: 'ananya.rao@gmail.com', company: '', website: '', dob: '', gender: '', language: 'English',
    customFields: {}, timestamp: new Date(Date.now() - 2 * 60000).toISOString(),
    messages: [
      { id: 1, from: 'contact', text: 'Hey! Saw your story about the new collection', time: '10:02 AM' },
      { id: 2, from: 'contact', text: 'Is the blue one still in stock?', time: '10:03 AM' },
    ] },
  { id: 'ic2', name: 'Karthik Iyer', handle: '@karthik.iyer', avatar: 'KI', time: '18m', unread: 0, starred: false,
    status: 'agent', agentId: 'a1', agentName: 'Riya Patel', source: 'dm', labels: ['customer'],
    lastMessage: 'Thanks for the quick reply!', archived: false,
    email: 'karthik.iyer@outlook.com', company: 'Iyer Traders', website: '', dob: '', gender: '', language: 'English',
    customFields: {}, timestamp: new Date(Date.now() - 18 * 60000).toISOString(),
    messages: [
      { id: 1, from: 'contact', text: 'Do you ship to Bangalore?', time: '9:40 AM' },
      { id: 2, from: 'agent', sender: 'Riya Patel', text: 'Yes, 3-5 business days!', time: '9:42 AM' },
      { id: 3, from: 'contact', text: 'Thanks for the quick reply!', time: '9:45 AM' },
    ] },
  { id: 'ic3', name: 'Meera Nair', handle: '@meera.creates', avatar: 'MN', time: '1h', unread: 1, starred: false,
    status: 'bot', agentId: null, agentName: null, source: 'comment', labels: ['influencer'],
    lastMessage: 'Commented on your reel 🔥', archived: false,
    email: '', company: '', website: '', dob: '', gender: '', language: 'English',
    customFields: {}, timestamp: new Date(Date.now() - 3600000).toISOString(),
    messages: [
      { id: 1, from: 'contact', text: 'Commented on your reel 🔥', time: '8:30 AM' },
    ] },
  { id: 'ic4', name: 'Rohit Sharma', handle: '@rohit.s', avatar: 'RS', time: '2d', unread: 0, starred: false,
    status: 'resolved', agentId: 'a2', agentName: 'Arjun Dev', source: 'story', labels: [],
    lastMessage: 'Perfect, thank you!', archived: false,
    email: 'rohit.sharma@gmail.com', company: '', website: '', dob: '', gender: '', language: 'Hindi',
    customFields: {}, timestamp: new Date(Date.now() - 2 * 86400000).toISOString(),
    messages: [
      { id: 1, from: 'contact', text: 'Replied to your story!', time: 'Mon' },
      { id: 2, from: 'agent', sender: 'Arjun Dev', text: 'Glad you liked it 🙌', time: 'Mon' },
      { id: 3, from: 'contact', text: 'Perfect, thank you!', time: 'Mon' },
    ] },
  { id: 'ic5', name: 'Divya Menon', handle: '@divya.menon', avatar: 'DM', time: '5d', unread: 0, starred: false,
    status: 'resolved', agentId: null, agentName: null, source: 'dm', labels: ['lead'],
    lastMessage: 'Will check and get back', archived: true,
    email: '', company: '', website: '', dob: '', gender: '', language: 'English',
    customFields: {}, timestamp: new Date(Date.now() - 5 * 86400000).toISOString(),
    messages: [
      { id: 1, from: 'contact', text: 'Do you do bulk orders?', time: 'Fri' },
      { id: 2, from: 'bot', text: 'Yes! Let me connect you with our team.', time: 'Fri' },
      { id: 3, from: 'contact', text: 'Will check and get back', time: 'Fri' },
    ] },
]

const PAST_CONVERSATIONS = [
  { id: 'p1', contactId: 'ic1', snippet: 'Asked about return policy', date: '2 weeks ago', status: 'Resolved' },
]

/* followers with no open thread yet — pool for "New Conversation" */
const IG_FOLLOWERS = [
  { id: 'f1', name: 'Priya Sharma',  handle: '@priya.sharma',  avatar: 'PS' },
  { id: 'f2', name: 'Vikram Singh',  handle: '@vikram.singh',  avatar: 'VS' },
  { id: 'f3', name: 'Neha Gupta',    handle: '@neha.gupta',    avatar: 'NG' },
  { id: 'f4', name: 'Arjun Mehta',   handle: '@arjun.mehta',   avatar: 'AM' },
  { id: 'f5', name: 'Sana Khan',     handle: '@sana.khan',     avatar: 'SK' },
]

/* ─── shared small pieces ────────────────────────────────────── */
function EditableField({ icon: Icon, label, value, onSave, placeholder, type = 'text' }) {
  const [editing, setEditing] = useState(false)
  const [local, setLocal]     = useState(value || '')
  const inputRef              = useRef(null)
  useEffect(() => { setLocal(value || '') }, [value])
  useEffect(() => { if (editing) inputRef.current?.focus() }, [editing])
  function commit() { onSave(local.trim()); setEditing(false) }
  function cancel() { setLocal(value || ''); setEditing(false) }

  if (editing) {
    return (
      <div className="flex items-start gap-2.5 px-3 py-2 bg-primary-50/40 border-b border-surface-border/40">
        <Icon size={12} className="text-primary flex-shrink-0 mt-1" />
        <div className="flex-1 min-w-0">
          <p className="text-[9px] text-primary font-semibold mb-0.5">{label}</p>
          <input ref={inputRef} type={type} value={local} onChange={e => setLocal(e.target.value)}
            onBlur={commit}
            onKeyDown={e => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') cancel() }}
            placeholder={placeholder || `Enter ${label.toLowerCase()}…`}
            className="w-full text-[11px] bg-transparent text-slate-800 outline-none border-b border-primary/50 pb-0.5 placeholder-slate-300" />
        </div>
        <button onMouseDown={e => { e.preventDefault(); cancel() }}
          className="text-slate-300 hover:text-slate-500 mt-1 flex-shrink-0"><X size={10}/></button>
      </div>
    )
  }
  return (
    <div onClick={() => setEditing(true)}
      className="flex items-start gap-2.5 px-3 py-2 group hover:bg-slate-50 cursor-pointer border-b border-surface-border/40 transition-colors">
      <Icon size={12} className={clsx('flex-shrink-0 mt-0.5', value ? 'text-slate-400' : 'text-slate-200')} />
      <div className="flex-1 min-w-0">
        <p className="text-[9px] text-slate-400 leading-none mb-0.5">{label}</p>
        <p className={clsx('text-[11px] break-words leading-snug', value ? 'text-slate-700 font-medium' : 'text-slate-300 italic')}>
          {value || `Add ${label.toLowerCase()}…`}
        </p>
      </div>
      <Pencil size={10} className="text-slate-300 opacity-0 group-hover:opacity-100 flex-shrink-0 mt-1 transition-opacity" />
    </div>
  )
}

function EditableCustomField({ field, value, onSave }) {
  if (field.type === 'boolean') {
    const on = value === true || value === 'true'
    return (
      <div className="flex items-center justify-between gap-2.5 px-3 py-2 border-b border-surface-border/40">
        <div className="flex items-center gap-2.5 min-w-0">
          <Tag size={12} className={clsx('flex-shrink-0', on ? 'text-slate-400' : 'text-slate-200')} />
          <p className="text-[11px] text-slate-700 font-medium truncate">{field.name}</p>
        </div>
        <button onClick={() => onSave(!on)}
          className={clsx('w-8 h-4 rounded-full relative transition-colors flex-shrink-0', on ? 'bg-primary' : 'bg-slate-200')}>
          <div className={clsx('absolute top-0.5 w-3 h-3 rounded-full bg-white shadow transition-transform', on ? 'translate-x-4' : 'translate-x-0.5')} />
        </button>
      </div>
    )
  }
  if (field.type === 'dropdown') {
    return (
      <div className="flex items-start gap-2.5 px-3 py-2 border-b border-surface-border/40">
        <Tag size={12} className={clsx('flex-shrink-0 mt-0.5', value ? 'text-slate-400' : 'text-slate-200')} />
        <div className="flex-1 min-w-0">
          <p className="text-[9px] text-slate-400 leading-none mb-1">{field.name}</p>
          <NativeSelect value={value || ''} onChange={e => onSave(e.target.value)} sm>
            <option value="">Not set</option>
            {(field.options || []).map(opt => <option key={opt} value={opt}>{opt}</option>)}
          </NativeSelect>
        </div>
      </div>
    )
  }
  const inputType = ['number', 'date', 'email'].includes(field.type) ? field.type : field.type === 'phone' ? 'tel' : 'text'
  return <EditableField icon={Tag} label={field.name} value={value} onSave={onSave} type={inputType} />
}

function LabelPicker({ conversation, onClose, onAdd, onRemove }) {
  const ALL_LABELS = ['lead', 'customer', 'influencer', 'vip', 'urgent', 'follow-up']
  return (
    <div className="bg-white border border-surface-border rounded-xl shadow-modal z-50 overflow-hidden w-48">
      <div className="px-3 py-2 border-b border-surface-border flex items-center justify-between">
        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Labels</p>
        <button onClick={onClose}><X size={11} className="text-slate-400"/></button>
      </div>
      <div className="py-1 max-h-48 overflow-y-auto">
        {ALL_LABELS.map(l => {
          const active = (conversation.labels || []).includes(l)
          return (
            <button key={l} onClick={() => active ? onRemove(l) : onAdd(l)}
              className="w-full flex items-center gap-2 px-3 py-1.5 text-xs hover:bg-surface-hover transition-colors text-left">
              <span className={clsx('w-3.5 h-3.5 rounded border flex items-center justify-center flex-shrink-0',
                active ? 'bg-primary border-primary' : 'border-slate-300')}>
                {active && <Check size={9} className="text-white"/>}
              </span>
              #{l}
            </button>
          )
        })}
      </div>
    </div>
  )
}

/* ─── Snooze picker ───────────────────────────────────────────── */
function SnoozePicker({ onSnooze, onClose }) {
  const OPTIONS = [
    { label: '30 minutes',   value: '30m'  },
    { label: '1 hour',       value: '1h'   },
    { label: '3 hours',      value: '3h'   },
    { label: 'Tomorrow 9am', value: 'tmrw' },
    { label: 'Next Monday',  value: 'mon'  },
  ]
  return (
    <div className="absolute top-full right-0 mt-1 w-44 bg-white rounded-xl shadow-modal border border-surface-border z-30 py-1 animate-fade-in">
      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-3 py-1.5">Snooze until…</p>
      {OPTIONS.map(o => (
        <button key={o.value} onClick={() => { onSnooze(o.value, o.label); onClose() }}
          className="w-full text-left px-3 py-2 text-xs text-slate-700 hover:bg-surface-hover hover:text-primary transition-colors flex items-center gap-2">
          <Clock size={12} className="text-slate-400" /> {o.label}
        </button>
      ))}
    </div>
  )
}

/* ─── Transfer / reassign agent modal ─────────────────────────── */
function TransferModal({ conversation, onClose, onAssign, adminOnline }) {
  const [selected, setSelected] = useState(null)
  const [search, setSearch] = useState('')

  const allOptions = [
    ...AGENTS,
    ...(adminOnline ? [{ id: 'admin', name: 'Deepak Kumar', avatar: 'DK', role: 'Admin', status: 'online', color: 'bg-primary' }] : []),
  ].filter(a => a.name.toLowerCase().includes(search.toLowerCase()))

  function doTransfer() {
    if (!selected) return
    onAssign(conversation.id, selected.id, selected.name)
    onClose()
  }

  return (
    <div className="fixed inset-0 bg-slate-900/25 z-50 flex items-center justify-center p-4" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="bg-white rounded-2xl w-full max-w-sm shadow-modal animate-fade-in overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-surface-border">
          <div>
            <h3 className="font-bold text-slate-900">Transfer Conversation</h3>
            <p className="text-xs text-slate-500 mt-0.5">Assign this DM to another agent or admin</p>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-surface-hover text-slate-400 hover:text-slate-600 transition-colors"><X size={16} /></button>
        </div>
        <div className="px-4 pt-4 pb-2">
          <div className="relative">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input className="input pl-9 text-sm" placeholder="Search agents..." value={search} onChange={e => setSearch(e.target.value)} autoFocus />
          </div>
        </div>
        <div className="px-4 pb-4 space-y-1 max-h-64 overflow-y-auto">
          {allOptions.map(a => {
            const isSelected = selected?.id === a.id
            const isCurrent  = a.id === conversation.agentId
            return (
              <button key={a.id} disabled={isCurrent} onClick={() => setSelected(isSelected ? null : a)}
                className={clsx('w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-all border',
                  isCurrent    ? 'opacity-50 cursor-not-allowed border-transparent bg-slate-50'
                  : isSelected ? 'border-primary bg-primary-50'
                  : 'border-transparent hover:bg-surface-hover hover:border-surface-border')}>
                <div className="relative flex-shrink-0">
                  <div className={clsx('w-9 h-9 rounded-full flex items-center justify-center text-white text-xs font-bold', a.color || 'bg-gradient-to-br from-slate-500 to-slate-600')}>{a.avatar}</div>
                  <span className={clsx('absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-white', AGENT_STATUS_DOT[a.status])} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-xs font-semibold text-slate-800 truncate">{a.name}</p>
                    {isCurrent && <span className="text-[10px] text-slate-400 italic">current</span>}
                  </div>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className={clsx('text-[10px] font-medium', a.status === 'online' ? 'text-emerald-600' : a.status === 'busy' ? 'text-amber-600' : 'text-slate-400')}>● {AGENT_STATUS_LABEL[a.status]}</span>
                    <span className="text-[10px] text-slate-400">{a.role}</span>
                  </div>
                </div>
                {isSelected && <CheckCircle2 size={16} className="text-primary flex-shrink-0" />}
              </button>
            )
          })}
        </div>
        <div className="flex gap-2 px-4 pb-4">
          <button onClick={onClose} className="btn-secondary flex-1 justify-center text-sm">Cancel</button>
          <button onClick={doTransfer} disabled={!selected} className={clsx('flex-1 justify-center text-sm', selected ? 'btn-primary' : 'btn-secondary opacity-50 cursor-not-allowed')}>
            <ArrowRightLeft size={14} /> Transfer
          </button>
        </div>
      </div>
    </div>
  )
}

/* ─── Emoji picker ────────────────────────────────────────────── */
function EmojiPicker({ onSelect, onClose }) {
  return (
    <div className="absolute bottom-full right-0 mb-2 bg-white rounded-xl shadow-modal border border-surface-border z-40 p-3 w-52 animate-fade-in">
      <div className="grid grid-cols-5 gap-1">
        {EMOJIS.map((em, i) => (
          <button key={i} onClick={() => { onSelect(em); onClose() }}
            className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-surface-hover text-lg transition-colors">
            {em}
          </button>
        ))}
      </div>
    </div>
  )
}

/* ─── Canned responses picker ─────────────────────────────────── */
function CannedPicker({ onSelect, onClose }) {
  return (
    <div className="absolute bottom-full right-0 mb-2 bg-white rounded-xl shadow-modal border border-surface-border z-40 p-2.5 w-64 animate-fade-in">
      <div className="flex items-center justify-between mb-1.5 px-0.5">
        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Canned Responses</p>
        <button onClick={onClose} className="text-slate-300 hover:text-slate-500"><X size={11} /></button>
      </div>
      <div className="space-y-1 max-h-48 overflow-y-auto">
        {CANNED.map(c => (
          <button key={c.key} onClick={() => { onSelect(c.body); onClose() }}
            className="w-full text-left px-2.5 py-1.5 rounded-lg hover:bg-primary-50/60 hover:border-primary border border-transparent transition-all group">
            <p className="text-[11px] font-semibold text-slate-700 group-hover:text-primary">{c.label}</p>
            <p className="text-[10px] text-slate-400 truncate mt-0.5">{c.body}</p>
          </button>
        ))}
      </div>
    </div>
  )
}

/* ─── New Conversation modal ──────────────────────────────────── */
function NewConversationModal({ onClose, onStart, existingHandles }) {
  const [search, setSearch] = useState('')
  const [message, setMessage] = useState('')
  const [selected, setSelected] = useState(null)
  const filtered = IG_FOLLOWERS.filter(f => !existingHandles.includes(f.handle)
    && (f.name.toLowerCase().includes(search.toLowerCase()) || f.handle.toLowerCase().includes(search.toLowerCase())))

  return (
    <div className="fixed inset-0 bg-slate-900/25 z-50 flex items-center justify-center p-4" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="bg-white rounded-2xl w-full max-w-sm shadow-modal animate-fade-in overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-surface-border">
          <div>
            <h3 className="font-bold text-slate-900">New Conversation</h3>
            <p className="text-xs text-slate-500 mt-0.5">Start a DM with a follower who hasn't messaged you yet</p>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-surface-hover text-slate-400 hover:text-slate-600 transition-colors"><X size={16} /></button>
        </div>
        <div className="px-4 pt-4 pb-2">
          <div className="relative">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input className="input pl-9 text-sm" placeholder="Search followers..." value={search} onChange={e => setSearch(e.target.value)} autoFocus />
          </div>
        </div>
        <div className="px-4 pb-2 space-y-1 max-h-52 overflow-y-auto">
          {filtered.length === 0 && <p className="text-xs text-slate-400 text-center py-6">No matching followers</p>}
          {filtered.map(f => {
            const isSelected = selected?.id === f.id
            return (
              <button key={f.id} onClick={() => setSelected(isSelected ? null : f)}
                className={clsx('w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-all border',
                  isSelected ? 'border-primary bg-primary-50' : 'border-transparent hover:bg-surface-hover hover:border-surface-border')}>
                <div className="w-9 h-9 rounded-full bg-slate-600 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">{f.avatar}</div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-slate-800 truncate">{f.name}</p>
                  <p className="text-[10px] text-slate-400 truncate">{f.handle}</p>
                </div>
                {isSelected && <CheckCircle2 size={16} className="text-primary flex-shrink-0" />}
              </button>
            )
          })}
        </div>
        {selected && (
          <div className="px-4 pb-2">
            <label className="label mb-1.5 block">Opening message (optional)</label>
            <textarea className="textarea text-xs" rows={2} placeholder="Say hi…" value={message} onChange={e => setMessage(e.target.value)} />
          </div>
        )}
        <div className="flex gap-2 px-4 pb-4 pt-2">
          <button onClick={onClose} className="btn-secondary flex-1 justify-center text-sm">Cancel</button>
          <button onClick={() => selected && onStart(selected, message.trim())} disabled={!selected}
            className={clsx('flex-1 justify-center text-sm', selected ? 'btn-primary' : 'btn-secondary opacity-50 cursor-not-allowed')}>
            <Send size={14} /> Start Conversation
          </button>
        </div>
      </div>
    </div>
  )
}

/* ─── Inbox insights — live queue snapshot, distinct from the full Analytics page ── */
function InboxInsightsPanel({ allConversations, adminOnline }) {
  const open        = allConversations.filter(c => c.status !== 'resolved').length
  const botActive   = allConversations.filter(c => c.status === 'bot').length
  const agentActive = allConversations.filter(c => c.status === 'agent').length
  const unassigned  = allConversations.filter(c => !c.agentId && c.status !== 'resolved').length

  return (
    <div className="flex-1 overflow-y-auto bg-[#f7f8fc] p-5">
      <div className="max-w-3xl mx-auto space-y-5">
        {adminOnline && (
          <div className="flex items-center gap-3 px-4 py-3 bg-emerald-50 border border-emerald-200 rounded-xl">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
            <p className="text-xs font-semibold text-emerald-800">You are online as an agent — conversations can be assigned to you</p>
          </div>
        )}
        <div>
          <h3 className="text-xs font-bold text-slate-800 mb-3 flex items-center gap-2"><Activity size={14} className="text-primary" /> Live Queue</h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: 'Open Chats',   value: open,        Icon: MessageCircle, color: '#0066ff' },
              { label: 'Bot Handling', value: botActive,   Icon: Bot,           color: '#8B5CF6' },
              { label: 'With Agent',   value: agentActive, Icon: UserCheck,     color: '#22C55E' },
              { label: 'Unassigned',   value: unassigned,  Icon: AlertCircle,   color: '#F59E0B' },
            ].map(s => (
              <div key={s.label} className="bg-white border border-surface-border rounded-xl p-4 flex flex-col gap-2.5">
                <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: '#f5f5f5' }}>
                  <s.Icon size={13} style={{ color: '#374151' }} />
                </div>
                <div>
                  <p className="text-[20px] font-bold leading-none text-slate-800">{s.value}</p>
                  <p className="text-[10px] font-medium text-slate-400 mt-1">{s.label}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
        <div>
          <h3 className="text-xs font-bold text-slate-800 mb-3 flex items-center gap-2"><Users size={14} className="text-primary" /> Agent Real-time Status</h3>
          <div className="bg-white rounded-xl border border-surface-border overflow-hidden">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-surface-border">
                  {['Agent', 'Active', 'Assigned', 'Resolved', 'Avg Reply', 'CSAT'].map((h, i) => (
                    <th key={h} className={clsx('px-4 py-2.5 text-slate-500 font-semibold', i === 0 ? 'text-left' : 'text-center')}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-border/60">
                {AGENTS.map(a => (
                  <tr key={a.id} className="hover:bg-surface-hover transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2.5">
                        <div className="relative">
                          <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-[10px] font-bold bg-slate-600">{a.avatar}</div>
                          <span className={clsx('absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-white', AGENT_STATUS_DOT[a.status])} />
                        </div>
                        <div><p className="font-semibold text-slate-800">{a.name}</p><p className="text-[10px] text-slate-400">{a.role}</p></div>
                      </div>
                    </td>
                    <td className="px-3 py-3 text-center">
                      <span className={clsx('inline-flex items-center justify-center w-6 h-6 rounded-full text-[10px] font-bold', a.active > 0 ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-400')}>{a.active}</span>
                    </td>
                    <td className="px-3 py-3 text-center font-bold text-slate-800">{a.assigned}</td>
                    <td className="px-3 py-3 text-center font-bold text-emerald-600">{a.resolved}</td>
                    <td className="px-3 py-3 text-center text-slate-600">{a.avgReply}</td>
                    <td className="px-3 py-3 text-center">
                      <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold text-amber-600"><span>★</span>{a.csat}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}

/* ─── Filter sidebar ─────────────────────────────────────────── */
function FilterSidebar({ sidebarKey, onSelect, allConversations, adminOnline, setAdminOnline }) {
  const [showMore, setShowMore] = useState(true)

  const cnt = {
    dm:         allConversations.filter(c => c.source === 'dm').length,
    comment:    allConversations.filter(c => c.source === 'comment').length,
    story:      allConversations.filter(c => c.source === 'story').length,
    all:        allConversations.length,
    active:     allConversations.filter(c => c.status === 'bot' || c.status === 'agent').length,
    assigned:   allConversations.filter(c => c.agentId === 'admin').length,
    unassigned: allConversations.filter(c => !c.agentId && c.status !== 'resolved').length,
    open:       allConversations.filter(c => c.status === 'bot' || c.status === 'agent').length,
    pending:    allConversations.filter(c => c.status === 'bot').length,
    solved:     allConversations.filter(c => c.status === 'resolved').length,
    unread:     allConversations.filter(c => (c.unread || 0) > 0).length,
  }

  const CHANNELS = [
    { key: 'dm',      label: 'Direct Messages', icon: Send,          count: cnt.dm },
    { key: 'comment', label: 'Comments',        icon: MessageCircle, count: cnt.comment },
    { key: 'story',   label: 'Story Replies',   icon: Camera,        count: cnt.story },
  ]
  const VIEWS = [
    { key: 'all',        label: 'All chats',      icon: Inbox,        count: cnt.all },
    { key: 'active',     label: 'Active chats',   icon: MessageCircle,count: cnt.active },
    { key: 'assigned',   label: 'Assigned to me', icon: CheckCircle2, count: cnt.assigned },
    { key: 'unassigned', label: 'Unassigned',     icon: Users,        count: cnt.unassigned },
  ]
  const MORE = [
    { key: 'favorite',   label: 'Favourite only', icon: Star,         count: null },
    { key: 'open',       label: 'Open',           icon: MessageCircle,color: 'text-emerald-600', count: cnt.open },
    { key: 'pending',    label: 'Pending',        icon: AlertCircle,  color: 'text-amber-600',   count: cnt.pending },
    { key: 'solved',     label: 'Solved',         icon: CheckCircle2, color: 'text-slate-500',   count: cnt.solved },
    { key: 'unread',     label: 'Unread',         icon: Hash,         color: 'text-blue-600',    count: cnt.unread },
  ]

  function row(key, Icon, label, count, color = '') {
    const isActive = sidebarKey === key
    return (
      <button key={key} onClick={() => onSelect(key)}
        className={clsx('w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs font-medium transition-colors text-left',
          isActive ? 'bg-primary-50 text-primary' : [color || 'text-slate-600', 'hover:bg-surface-hover'])}>
        <Icon size={13} className="flex-shrink-0" />
        <span className="flex-1 truncate">{label}</span>
        {count !== null && count !== undefined && count > 0 && (
          <span className={clsx('text-[10px] font-bold', isActive ? 'text-primary' : 'text-slate-400')}>{count}</span>
        )}
      </button>
    )
  }

  return (
    <div className="w-48 flex-shrink-0 bg-white border-r border-surface-border flex flex-col overflow-hidden">
      <button onClick={() => setAdminOnline(p => !p)}
        className={clsx('flex items-center gap-2 px-3 py-2 text-xs font-semibold border-b transition-colors w-full',
          adminOnline ? 'bg-emerald-50 border-emerald-100 text-emerald-700' : 'bg-slate-50 border-surface-border text-slate-500 hover:bg-surface-hover')}>
        <span className={clsx('w-2 h-2 rounded-full flex-shrink-0', adminOnline ? 'bg-emerald-500 animate-pulse' : 'bg-slate-300')} />
        {adminOnline ? 'You are Online' : 'Go Online (as Agent)'}
      </button>

      <div className="flex-1 overflow-y-auto py-2">
        <div className="px-3 mb-1">
          <div className="flex items-center gap-1.5 py-1 mb-0.5">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Channels</span>
          </div>
          {CHANNELS.map(ch => row(ch.key, ch.icon, ch.label, ch.count))}
        </div>

        <div className="mx-3 border-t border-surface-border my-1.5" />

        <div className="px-3 mb-1">
          {VIEWS.map(f => row(f.key, f.icon, f.label, f.count))}
        </div>

        <div className="mx-3 border-t border-surface-border my-1.5" />

        <div className="px-3">
          <button onClick={() => setShowMore(p => !p)}
            className="flex items-center gap-1 text-[10px] text-slate-500 hover:text-slate-700 font-semibold mb-1 w-full py-1">
            <ChevronDown size={11} className={clsx('transition-transform', !showMore && '-rotate-90')} />
            {showMore ? 'Less' : 'More'}
          </button>
          {showMore && MORE.map(f => row(f.key, f.icon, f.label, f.count, f.color))}
        </div>
      </div>
    </div>
  )
}

/* ─── Advanced filter panel ──────────────────────────────────── */
const SOURCE_OPTS = [
  { key: 'all',     label: 'All sources' },
  { key: 'dm',      label: 'Direct Message' },
  { key: 'comment', label: 'Comment' },
  { key: 'story',   label: 'Story' },
]

function AdvancedFilterPanel({
  labelFilter, setLabelFilter, starredOnly, setStarredOnly, unreadOnly, setUnreadOnly,
  showArchived, setShowArchived, sourceFilter, setSourceFilter,
  agentSel, setAgentSel, setAgentFilter, setFilter, currentStatus,
  customFieldDefs = [], customFieldFilters = {}, setCustomFieldFilter,
  onClear, onClose,
}) {
  const Toggle = ({ label, value, set }) => (
    <label className="flex items-center justify-between cursor-pointer py-1.5">
      <span className="text-[11px] text-slate-600">{label}</span>
      <div onClick={() => set(p => !p)}
        className={clsx('w-8 h-4 rounded-full relative transition-colors cursor-pointer flex-shrink-0', value ? 'bg-primary' : 'bg-slate-200')}>
        <div className={clsx('absolute top-0.5 w-3 h-3 rounded-full bg-white shadow transition-transform', value ? 'translate-x-4' : 'translate-x-0.5')} />
      </div>
    </label>
  )

  return (
    <div className="absolute top-full right-0 mt-1.5 bg-white rounded-xl border border-surface-border shadow-modal z-40 w-64 overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-surface-border">
        <span className="text-xs font-semibold text-slate-800">Filters</span>
        <div className="flex items-center gap-2">
          <button onClick={onClear} className="text-[10px] text-primary font-medium hover:underline">Clear all</button>
          <button onClick={onClose} className="p-1 rounded hover:bg-surface-hover text-slate-400"><X size={11} /></button>
        </div>
      </div>

      <div className="px-4 py-3 space-y-3">
        <div>
          <p className="text-[9px] font-semibold text-slate-400 uppercase tracking-wide mb-1.5">Status</p>
          <Select size="sm" value={currentStatus} onChange={v => setFilter(v)}
            options={[
              { value: 'all',      label: 'All'      },
              { value: 'bot',      label: 'Bot'      },
              { value: 'agent',    label: 'Agent'    },
              { value: 'resolved', label: 'Resolved' },
            ]} />
        </div>

        <div>
          <p className="text-[9px] font-semibold text-slate-400 uppercase tracking-wide mb-1.5">Agent</p>
          <Select size="sm" value={agentSel} onChange={v => { setAgentSel(v); setAgentFilter(v) }}
            options={[
              { value: 'all',        label: 'All Agents'  },
              { value: 'unassigned', label: 'Unassigned'  },
              ...AGENTS.map(a => ({ value: a.id, label: a.name })),
            ]} />
        </div>

        <div>
          <p className="text-[9px] font-semibold text-slate-400 uppercase tracking-wide mb-1.5">Label</p>
          <Select size="sm" value={labelFilter[0] || ''} onChange={v => setLabelFilter(v ? [v] : [])}
            options={[
              { value: '', label: 'All Labels' },
              ...['lead', 'customer', 'influencer', 'vip', 'urgent', 'follow-up'].map(l => ({ value: l, label: `#${l}` })),
            ]} />
        </div>

        <div>
          <p className="text-[9px] font-semibold text-slate-400 uppercase tracking-wide mb-1.5">Source</p>
          <Select size="sm" value={sourceFilter} onChange={v => setSourceFilter(v)}
            options={SOURCE_OPTS.map(s => ({ value: s.key, label: s.label }))} />
        </div>

        <div className="border-t border-surface-border pt-2 -mx-4 px-4">
          <Toggle label="Starred only"  value={starredOnly}  set={setStarredOnly}  />
          <Toggle label="Unread only"   value={unreadOnly}   set={setUnreadOnly}   />
          <Toggle label="Show archived" value={showArchived} set={setShowArchived} />
        </div>

        {customFieldDefs.length > 0 && (
          <div className="border-t border-surface-border pt-2 -mx-4 px-4 space-y-2">
            <p className="text-[9px] font-semibold text-slate-400 uppercase tracking-wide">Custom Fields</p>
            {customFieldDefs.map(f => f.type === 'boolean' ? (
              <Toggle key={f.id} label={f.name}
                value={customFieldFilters[f.key] === true}
                set={fn => setCustomFieldFilter(f.key, fn(customFieldFilters[f.key] === true) ? true : '')} />
            ) : (
              <Select key={f.id} size="sm" value={customFieldFilters[f.key] || ''} onChange={v => setCustomFieldFilter(f.key, v)}
                options={[{ value: '', label: f.name }, ...(f.options || []).map(opt => ({ value: opt, label: opt }))]} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

/* ─── Conversation list ──────────────────────────────────────── */
function ConversationList({ conversations, allConversations, activeId, onSelect, search, setSearch,
  sidebarKey, onSidebarSelect, adminOnline, setAdminOnline,
  agentFilter, setAgentFilter, sourceFilter, setSourceFilter,
  labelFilter, setLabelFilter, starredOnly, setStarredOnly, unreadOnly, setUnreadOnly,
  showArchived, setShowArchived, filter, setFilter,
  customFieldFilters, setCustomFieldFilter, clearCustomFieldFilters,
  view, setView, onNewConversation,
}) {
  const { customFields } = useApp()
  const [showFilters, setShowFilters] = useState(false)
  const [agentSel, setAgentSel]       = useState('all')
  const [showAgentDrop, setShowAgentDrop] = useState(false)
  const agentRef = useRef(null)
  const filterableCustomFields = customFields.contact.filter(f => f.type === 'dropdown' || f.type === 'boolean')

  useEffect(() => {
    function h(e) { if (agentRef.current && !agentRef.current.contains(e.target)) setShowAgentDrop(false) }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [])

  const activeFilterCount = [
    labelFilter.length > 0, starredOnly, unreadOnly, showArchived,
    agentSel !== 'all', sourceFilter !== 'all', filter !== 'all',
    Object.keys(customFieldFilters).length > 0,
  ].filter(Boolean).length

  return (
    <div className="flex flex-col h-full">
      {/* Row 1 */}
      <div className="flex items-center gap-1.5 px-3 py-2 border-b border-surface-border flex-shrink-0">
        <p className="text-[13px] font-bold text-slate-800 flex-1 truncate min-w-0">Instagram</p>

        {/* Chats / Insights toggle — icon+text compact pills */}
        <div className="flex items-center bg-slate-100 rounded-md p-0.5 flex-shrink-0">
          {[['chats', MessageCircle, 'Chats'], ['insights', Activity, 'Insights']].map(([k, Icon, lbl]) => (
            <button key={k} onClick={() => setView(k)}
              className={clsx('flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold transition-colors whitespace-nowrap',
                view === k ? 'bg-white shadow-sm text-slate-800' : 'text-slate-500 hover:text-slate-700')}>
              <Icon size={10} /> {lbl}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-0.5 flex-shrink-0">
          <button className="p-1.5 rounded-lg text-slate-400 hover:bg-surface-hover hover:text-slate-600 transition-colors"><RefreshCw size={11} /></button>
          <button onClick={onNewConversation} title="Start new conversation"
            className="p-1.5 rounded-md bg-primary text-white hover:bg-primary-hover transition-colors"><Plus size={12} /></button>
        </div>
      </div>

      {/* Row 2: search + agent + filters */}
      <div className="flex items-center gap-1.5 px-3 py-1.5 border-b border-surface-border flex-shrink-0">
        <div className="relative flex-1">
          <Search size={11} className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          <input
            className="w-full pl-6 pr-2 py-1 text-[11px] bg-slate-50 border border-surface-border rounded-lg placeholder-slate-400 focus:outline-none focus:border-primary/40 focus:bg-white transition-colors"
            placeholder="Search…" value={search} onChange={e => setSearch(e.target.value)} />
        </div>

        <div ref={agentRef} className="relative flex-shrink-0">
          <button onClick={() => setShowAgentDrop(p => !p)} title="Filter by Agent"
            className={clsx('relative flex items-center justify-center w-7 h-7 rounded-lg border transition-colors',
              agentSel !== 'all' ? 'border-primary/30 bg-primary-50 text-primary' : 'border-surface-border bg-white text-slate-500 hover:border-primary/30 hover:text-slate-700')}>
            <Users size={13} />
            {agentSel !== 'all' && <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-primary border border-white" />}
          </button>
          {showAgentDrop && (
            <div className="absolute top-full right-0 mt-1 bg-white rounded-xl shadow-modal border border-surface-border z-30 py-1 w-44">
              <button onClick={() => { setAgentSel('all'); setAgentFilter('all'); setShowAgentDrop(false) }}
                className="w-full text-left px-3 py-1.5 text-xs hover:bg-surface-hover text-slate-700 flex items-center gap-2">
                <Users size={11} className="text-slate-400" /> All Agents
              </button>
              <div className="border-t border-surface-border my-0.5" />
              {AGENTS.map(a => (
                <button key={a.id} onClick={() => { setAgentSel(a.id); setAgentFilter(a.id); setShowAgentDrop(false) }}
                  className={clsx('w-full text-left px-3 py-1.5 text-xs hover:bg-surface-hover transition-colors flex items-center gap-2',
                    agentSel === a.id ? 'text-primary bg-primary-50' : 'text-slate-700')}>
                  <div className="relative flex-shrink-0">
                    <div className={clsx('w-5 h-5 rounded-full flex items-center justify-center text-white text-[8px] font-bold', a.color)}>{a.avatar}</div>
                    <span className={clsx('absolute -bottom-0.5 -right-0.5 w-1.5 h-1.5 rounded-full border border-white', AGENT_STATUS_DOT[a.status])} />
                  </div>
                  <span className="flex-1 truncate font-medium">{a.name.split(' ')[0]}</span>
                </button>
              ))}
              <div className="border-t border-surface-border my-0.5" />
              <button onClick={() => { setAgentSel('unassigned'); setAgentFilter('unassigned'); setShowAgentDrop(false) }}
                className="w-full text-left px-3 py-1.5 text-xs hover:bg-surface-hover text-amber-600 flex items-center gap-2">
                <AlertCircle size={11} /> Unassigned
              </button>
            </div>
          )}
        </div>

        <div className="relative flex-shrink-0">
          <button onClick={() => setShowFilters(p => !p)} title="Filters"
            className={clsx('relative flex items-center justify-center w-7 h-7 rounded-lg border transition-colors',
              showFilters ? 'border-primary/40 bg-primary-50 text-primary' : 'border-surface-border bg-white text-slate-500 hover:border-primary/30 hover:text-slate-700')}>
            <Filter size={13} />
            {activeFilterCount > 0 && <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-primary border border-white" />}
          </button>
          {showFilters && (
            <AdvancedFilterPanel
              labelFilter={labelFilter} setLabelFilter={setLabelFilter}
              starredOnly={starredOnly} setStarredOnly={setStarredOnly}
              unreadOnly={unreadOnly} setUnreadOnly={setUnreadOnly}
              showArchived={showArchived} setShowArchived={setShowArchived}
              sourceFilter={sourceFilter} setSourceFilter={setSourceFilter}
              agentSel={agentSel} setAgentSel={setAgentSel} setAgentFilter={setAgentFilter}
              setFilter={setFilter} currentStatus={filter}
              customFieldDefs={filterableCustomFields}
              customFieldFilters={customFieldFilters} setCustomFieldFilter={setCustomFieldFilter}
              onClear={() => {
                setLabelFilter([]); setStarredOnly(false); setUnreadOnly(false); setShowArchived(false)
                setSourceFilter('all'); setAgentSel('all'); setAgentFilter('all'); setFilter('all')
                clearCustomFieldFilters()
              }}
              onClose={() => setShowFilters(false)}
            />
          )}
        </div>
      </div>

      {/* Filter sidebar row (compact chip strip for channel/view since the real sidebar lives in parent grid) */}
      <div className="flex-1 overflow-y-auto">
        {conversations.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center px-4">
            <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mb-3">
              <Inbox size={18} className="text-slate-300" />
            </div>
            <p className="text-xs font-semibold text-slate-600">No conversations</p>
            <p className="text-xs text-slate-400 mt-1">Try adjusting your filters</p>
          </div>
        ) : conversations.map(c => {
          const isActive = c.id === activeId
          const sm = STATUS_MAP[c.status] || STATUS_MAP.resolved
          return (
            <div key={c.id} onClick={() => onSelect(c.id)}
              className={clsx('flex items-start gap-2.5 px-3 py-2.5 cursor-pointer transition-colors relative',
                isActive ? 'bg-primary-50' : 'hover:bg-surface-hover')}>
              {isActive && <span className="absolute left-0 top-0 bottom-0 w-0.5 bg-primary rounded-r" />}
              <div className="relative flex-shrink-0">
                <div className={clsx('w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold text-white',
                  isActive ? 'bg-primary' : 'bg-slate-600')}>{c.avatar}</div>
                <span className={clsx('absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full border-2 border-white', sm.dot)} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-0.5">
                  <div className="flex items-center gap-1">
                    <span className={clsx('text-[12px] font-semibold truncate', c.unread > 0 ? 'text-slate-900' : 'text-slate-700')}>{c.name}</span>
                    {c.starred && <Star size={10} className="text-amber-400 fill-amber-400 flex-shrink-0" />}
                    {c.snoozed && <BellOff size={10} className="text-amber-400 flex-shrink-0" />}
                  </div>
                  <span className="text-[10px] text-slate-400 flex-shrink-0 ml-1">{c.time}</span>
                </div>
                <div className={clsx('text-[11px] truncate flex items-center gap-1', c.unread > 0 ? 'text-slate-700' : 'text-slate-400')}>
                  <span className="truncate">{c.lastMessage}</span>
                </div>
                <div className="flex items-center justify-between mt-1">
                  <div className="flex items-center gap-1 flex-wrap">
                    {SOURCE_META[c.source] && (
                      <span className={clsx('flex items-center gap-0.5 text-[9px] px-1.5 py-0.5 rounded-full bg-slate-50 border border-slate-200 font-semibold', SOURCE_META[c.source].color)}>
                        {(() => { const SIcon = SOURCE_META[c.source].icon; return <SIcon size={8}/> })()}{SOURCE_META[c.source].label}
                      </span>
                    )}
                    {c.agentName && <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-blue-50 text-blue-600 border border-blue-100 font-medium">{c.agentName.split(' ')[0]}</span>}
                    {c.labels.slice(0, 1).map(t => <span key={t} className="text-[9px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-500">#{t}</span>)}
                  </div>
                  {c.unread > 0 && <span className="min-w-[16px] h-4 rounded-full bg-primary flex items-center justify-center text-white text-[9px] font-bold px-1">{c.unread}</span>}
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

/* ─── Chat window ─────────────────────────────────────────────── */
function ChatWindow({ conversation, onSend, onSendTemplate, onTakeover, onResolve, onReopen, onStar, onArchive, onAddLabel, onRemoveLabel, onSnooze, onAssign, adminOnline, showPanel, onTogglePanel }) {
  const [message, setMessage] = useState('')
  const [showMore, setShowMore] = useState(false)
  const [showLabels, setShowLabels] = useState(false)
  const [showSnooze, setShowSnooze] = useState(false)
  const [showTransfer, setShowTransfer] = useState(false)
  const [showEmoji, setShowEmoji] = useState(false)
  const [showCanned, setShowCanned] = useState(false)
  const [showTemplateComposer, setShowTemplateComposer] = useState(false)
  const [archiveConfirm, setArchiveConfirm] = useState(false)
  const moreRef = useRef(null)
  const snoozeRef = useRef(null)
  const emojiRef = useRef(null)
  const cannedRef = useRef(null)
  const scrollRef = useRef(null)

  useEffect(() => {
    function h(e) {
      if (moreRef.current && !moreRef.current.contains(e.target)) setShowMore(false)
      if (snoozeRef.current && !snoozeRef.current.contains(e.target)) setShowSnooze(false)
      if (emojiRef.current && !emojiRef.current.contains(e.target)) setShowEmoji(false)
      if (cannedRef.current && !cannedRef.current.contains(e.target)) setShowCanned(false)
    }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [])
  useEffect(() => { scrollRef.current?.scrollTo({ top: 999999 }) }, [conversation?.messages?.length, conversation?.id])
  useEffect(() => { setArchiveConfirm(false) }, [conversation?.id])

  if (!conversation) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center bg-[#f7f8fc] text-center p-8">
        <div className="w-20 h-20 rounded-2xl bg-white border border-surface-border flex items-center justify-center mb-4">
          <InstagramIcon size={28} className="text-pink-300" />
        </div>
        <p className="font-semibold text-slate-600">Select a conversation</p>
        <p className="text-sm text-slate-400 mt-1.5 max-w-xs">Choose a DM, comment, or story reply from the list to start replying.</p>
      </div>
    )
  }

  const sm = STATUS_MAP[conversation.status] || STATUS_MAP.resolved
  const src = SOURCE_META[conversation.source]

  function send() {
    if (!message.trim()) return
    onSend(conversation.id, message.trim())
    setMessage('')
  }

  return (
    <div className="flex-1 flex flex-col min-w-0 bg-white">
      {/* Header */}
      <div className="flex items-center px-3 py-2 border-b border-surface-border bg-white flex-shrink-0 gap-2 min-w-0">
        <div className="relative flex-shrink-0">
          <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center text-white text-xs font-bold">{conversation.avatar}</div>
          <span className={clsx('absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full border-2 border-white', sm.dot)} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <span className="font-semibold text-slate-900 text-[13px] leading-none truncate">{conversation.name}</span>
            <span className={clsx('badge text-[9px]', sm.badge)}>{sm.label}</span>
            {src && (
              <span className={clsx('flex items-center gap-0.5 text-[9px] font-semibold', src.color)}>
                <src.icon size={9}/>{src.label}
              </span>
            )}
            {conversation.snoozed && <BellOff size={10} className="text-amber-500 flex-shrink-0" title={`Snoozed until ${conversation.snoozedLabel || ''}`}/>}
          </div>
          <p className="text-[11px] text-slate-400 mt-0.5 truncate">{conversation.handle}</p>
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          {conversation.status === 'bot' && (
            <button onClick={() => onTakeover(conversation.id)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary text-white hover:bg-primary-hover text-xs font-semibold transition-colors">
              Take Over
            </button>
          )}
          <div className="relative">
            <button onClick={() => setShowLabels(p => !p)} className="p-1.5 rounded-lg text-slate-400 hover:bg-surface-hover hover:text-slate-600 transition-colors"><Tag size={14}/></button>
            {showLabels && (
              <div className="absolute right-0 top-full mt-1 z-30">
                <LabelPicker conversation={conversation} onClose={() => setShowLabels(false)}
                  onAdd={l => onAddLabel(conversation.id, l)} onRemove={l => onRemoveLabel(conversation.id, l)} />
              </div>
            )}
          </div>
          <div ref={moreRef} className="relative">
            <button onClick={() => setShowMore(p => !p)} className="p-1.5 rounded-lg text-slate-400 hover:bg-surface-hover hover:text-slate-600 transition-colors"><MoreVertical size={14}/></button>
            {showMore && (
              <div className="absolute right-0 top-full mt-1 bg-white border border-surface-border rounded-xl shadow-modal z-30 py-1 w-48">
                {conversation.status !== 'resolved' ? (
                  <button onClick={() => { onResolve(conversation.id); setShowMore(false) }}
                    className="w-full flex items-center gap-2.5 px-3 py-2 text-xs hover:bg-surface-hover text-slate-700"><CheckCircle2 size={12}/> Mark Resolved</button>
                ) : (
                  <button onClick={() => { onReopen(conversation.id); setShowMore(false) }}
                    className="w-full flex items-center gap-2.5 px-3 py-2 text-xs hover:bg-surface-hover text-slate-700"><RefreshCw size={12}/> Reopen</button>
                )}
                {conversation.status !== 'resolved' && (
                  <button onClick={() => { setShowTransfer(true); setShowMore(false) }}
                    className="w-full flex items-center gap-2.5 px-3 py-2 text-xs hover:bg-surface-hover text-slate-700"><ArrowRightLeft size={12}/> Transfer conversation</button>
                )}
                <button onClick={() => { onStar(conversation.id); setShowMore(false) }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 text-xs hover:bg-surface-hover text-slate-700">
                  <Star size={12}/> {conversation.starred ? 'Unstar' : 'Star'}
                </button>
                <div ref={snoozeRef} className="relative">
                  <button onClick={() => setShowSnooze(p => !p)}
                    className="w-full flex items-center gap-2.5 px-3 py-2 text-xs hover:bg-surface-hover text-slate-700"><Clock size={12}/> Snooze</button>
                  {showSnooze && (
                    <SnoozePicker onSnooze={(v, label) => { onSnooze(conversation.id, v, label); setShowSnooze(false); setShowMore(false) }} onClose={() => setShowSnooze(false)}/>
                  )}
                </div>
                <div className="border-t border-surface-border my-1"/>
                <button onClick={() => { setArchiveConfirm(true); setShowMore(false) }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 text-xs text-red-500 hover:bg-red-50 transition-colors"><Archive size={12} className="text-red-400"/> Archive</button>
              </div>
            )}
          </div>
          <button onClick={onTogglePanel} title={showPanel ? 'Hide info panel' : 'Show info panel'}
            className="p-1.5 rounded-lg text-slate-400 hover:bg-surface-hover hover:text-slate-600 transition-colors"><Info size={14}/></button>
        </div>
      </div>

      {/* Archive confirm banner */}
      {archiveConfirm && (
        <div className="flex items-center gap-3 px-4 py-2.5 bg-amber-50 border-b border-amber-200 flex-shrink-0">
          <Archive size={13} className="text-amber-600" />
          <span className="text-xs text-amber-800 font-medium flex-1">Archive this conversation? It will be moved to archived chats.</span>
          <button onClick={() => { onArchive(conversation.id); setArchiveConfirm(false) }}
            className="text-xs font-semibold text-white bg-amber-500 hover:bg-amber-600 px-3 py-1 rounded-lg transition-colors">Archive</button>
          <button onClick={() => setArchiveConfirm(false)} className="text-xs text-slate-500 hover:text-slate-700 font-medium">Cancel</button>
        </div>
      )}

      {conversation.status === 'bot' && (
        <div className="flex items-center gap-2 px-4 py-2 bg-primary-50 border-b border-primary/10">
          <Bot size={13} className="text-primary flex-shrink-0"/>
          <p className="text-[11px] text-primary flex-1">Bot is handling this conversation</p>
          <button onClick={() => onTakeover(conversation.id)} className="text-[11px] text-primary font-semibold hover:underline">Take over →</button>
        </div>
      )}
      {conversation.status === 'agent' && (
        <div className="flex items-center gap-2 px-4 py-2 bg-emerald-50 border-b border-emerald-100">
          <CheckCircle2 size={12} className="text-emerald-600 flex-shrink-0"/>
          <p className="text-[11px] text-emerald-700 flex-1">{conversation.agentName} is handling this conversation</p>
          <button onClick={() => setShowTransfer(true)}
            className="text-[10px] px-2.5 py-1 rounded-lg border border-emerald-200 bg-white text-emerald-700 hover:bg-emerald-50 hover:border-emerald-300 transition-colors font-medium flex items-center gap-1 flex-shrink-0">
            <UserPlus size={10}/> Reassign
          </button>
        </div>
      )}

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-5 py-4 space-y-2 bg-[#f0f4f8]">
        {conversation.messages.map(m => {
          if (m.type === 'template') {
            const t = m.igTemplate
            return (
              <div key={m.id} className="flex justify-end my-1">
                <div className="max-w-[78%] rounded-2xl border border-surface-border bg-white overflow-hidden shadow-sm">
                  <div className="flex items-center justify-between px-3 pt-2.5 pb-1">
                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">
                      {t.kind === 'generic' ? (t.elements.length > 1 ? 'Card carousel' : 'Card') : 'Button template'}
                    </span>
                    <span className="text-[9px] font-bold text-pink-500">Instagram</span>
                  </div>
                  {t.kind === 'generic' ? (
                    <div className={clsx('flex gap-2 px-3 pb-2.5', t.elements.length > 1 && 'overflow-x-auto')}>
                      {t.elements.map((el, i) => (
                        <div key={i} className="flex-shrink-0 w-44 border border-surface-border rounded-xl overflow-hidden">
                          {el.imageUrl && <img src={el.imageUrl} alt="" className="w-full h-24 object-cover bg-slate-100"/>}
                          <div className="p-2">
                            <p className="font-bold text-slate-900 text-[11px] leading-tight">{el.title}</p>
                            {el.subtitle && <p className="text-[10px] text-slate-500 mt-0.5 leading-snug">{el.subtitle}</p>}
                          </div>
                          {el.buttons?.length > 0 && (
                            <div className="border-t border-surface-border">
                              {el.buttons.map((btn, bi) => (
                                <button key={bi} className={clsx('w-full py-1.5 text-[10.5px] font-semibold text-primary hover:bg-primary-50 flex items-center justify-center gap-1', bi > 0 && 'border-t border-surface-border')}>
                                  {btn.type === 'web_url' && <Link2 size={9}/>}{btn.title}
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <>
                      <div className="px-3 pb-2"><p className="text-xs text-slate-700 leading-relaxed">{t.text}</p></div>
                      {t.buttons?.length > 0 && (
                        <div className="border-t border-surface-border">
                          {t.buttons.map((btn, bi) => (
                            <button key={bi} className={clsx('w-full py-2 text-xs font-semibold text-primary hover:bg-primary-50 flex items-center justify-center gap-1.5', bi > 0 && 'border-t border-surface-border')}>
                              {btn.type === 'web_url' && <Link2 size={11}/>}{btn.title}
                            </button>
                          ))}
                        </div>
                      )}
                    </>
                  )}
                  <div className="px-3 pb-2 pt-1.5 text-right"><span className="text-[9px] text-slate-400">{m.time}</span></div>
                </div>
              </div>
            )
          }
          const outgoing = m.from === 'bot' || m.from === 'agent'
          return (
            <div key={m.id} className={clsx('flex items-end gap-2', outgoing ? 'justify-end' : 'justify-start')}>
              <div className={clsx('max-w-[72%] rounded-2xl px-3 py-2 shadow-sm',
                !outgoing ? 'bg-white text-slate-800 rounded-tl-sm'
                  : m.from === 'bot' ? 'bg-primary text-white rounded-tr-sm' : 'bg-emerald-500 text-white rounded-tr-sm')}>
                {outgoing && <p className="text-[9px] font-medium mb-0.5 opacity-70">{m.from === 'bot' ? '🤖 Bot' : `👤 ${m.sender}`}</p>}
                <p className="text-xs leading-relaxed">{m.text}</p>
                <p className={clsx('text-[9px] mt-1 text-right', !outgoing ? 'text-slate-400' : 'opacity-60')}>{m.time}</p>
              </div>
            </div>
          )
        })}
      </div>

      {/* Composer */}
      <div className="border-t border-surface-border bg-white flex-shrink-0">
        <div className="px-3 py-2.5">
          <div className="flex items-end gap-2 rounded-xl px-3 py-2 border bg-surface border-surface-border">
            <div className="flex items-center gap-0.5 pb-0.5">
              <div ref={cannedRef} className="relative">
                <button onClick={() => { setShowCanned(p => !p); setShowEmoji(false) }} title="Canned Responses"
                  className={clsx('p-1.5 rounded-lg transition-colors', showCanned ? 'bg-primary-50 text-primary' : 'text-slate-400 hover:bg-surface-hover hover:text-primary')}>
                  <Zap size={15}/>
                </button>
                {showCanned && <CannedPicker onSelect={body => setMessage(body)} onClose={() => setShowCanned(false)}/>}
              </div>
              <button className="p-1.5 rounded-lg text-slate-400 hover:bg-surface-hover hover:text-slate-600"><Paperclip size={15}/></button>
              <button onClick={() => setShowTemplateComposer(true)} title="Send Template"
                className="p-1.5 rounded-lg text-slate-400 hover:bg-surface-hover hover:text-primary transition-colors">
                <FileText size={15}/>
              </button>
            </div>
            <textarea
              value={message} onChange={e => setMessage(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() } }}
              placeholder="Type a message…" rows={1}
              className="flex-1 bg-transparent text-xs placeholder-slate-400 resize-none focus:outline-none py-0.5 min-h-[24px] max-h-28 text-slate-800" />
            <div className="flex items-center gap-0.5 pb-0.5">
              <div ref={emojiRef} className="relative">
                <button onClick={() => { setShowEmoji(p => !p); setShowCanned(false) }}
                  className={clsx('p-1.5 rounded-lg transition-colors', showEmoji ? 'bg-primary-50 text-primary' : 'text-slate-400 hover:bg-surface-hover hover:text-slate-600')}>
                  <Smile size={15}/>
                </button>
                {showEmoji && <EmojiPicker onSelect={em => setMessage(prev => prev + em)} onClose={() => setShowEmoji(false)}/>}
              </div>
              <button className="p-1.5 rounded-lg text-slate-400 hover:bg-surface-hover hover:text-slate-600"><Mic size={15}/></button>
              <button onClick={send}
                className={clsx('p-2 rounded-lg transition-all', message.trim() ? 'bg-primary hover:bg-primary-hover text-white shadow-btn' : 'text-slate-300 cursor-not-allowed')}>
                <Send size={15} />
              </button>
            </div>
          </div>
        </div>
      </div>

      {showTransfer && (
        <TransferModal conversation={conversation} onClose={() => setShowTransfer(false)} onAssign={onAssign} adminOnline={adminOnline}/>
      )}

      {showTemplateComposer && (
        <InstagramTemplateComposer
          onClose={() => setShowTemplateComposer(false)}
          onSend={payload => { onSendTemplate(conversation.id, payload); setShowTemplateComposer(false) }}
        />
      )}
    </div>
  )
}

/* ─── Contact panel ───────────────────────────────────────────── */
function ContactPanel({ conversation, onClose, onUpdate, onAssign, onAddNote }) {
  const { customFields } = useApp()
  const [tab, setTab] = useState('contact')
  const [noteText, setNoteText] = useState('')
  const [info, setInfo] = useState({})
  const [customValues, setCustomValues] = useState({})

  useEffect(() => {
    setInfo({
      email: conversation?.email || '', company: conversation?.company || '', website: conversation?.website || '',
      dob: conversation?.dob || '', gender: conversation?.gender || '', language: conversation?.language || 'English',
    })
    setCustomValues(conversation?.customFields || {})
  }, [conversation?.id])

  if (!conversation) return null

  function setField(key) { return val => { setInfo(p => ({ ...p, [key]: val })); onUpdate(conversation.id, { [key]: val }) } }
  function setCustomField(key) { return val => { setCustomValues(p => ({ ...p, [key]: val })); onUpdate(conversation.id, { customFields: { ...customValues, [key]: val } }) } }

  const sm = STATUS_MAP[conversation.status] || STATUS_MAP.resolved
  const src = SOURCE_META[conversation.source]
  const notes = (conversation.notes || [])
  const pastChats = PAST_CONVERSATIONS.filter(p => p.contactId === conversation.id)

  const TABS = [
    { key: 'contact', Icon: User2,        label: 'Info'     },
    { key: 'notes',   Icon: FileText,     label: 'Notes'    },
    { key: 'chats',   Icon: MessageCircle,label: 'Chats'    },
    { key: 'activity',Icon: Activity,     label: 'Timeline' },
  ]

  return (
    <div className="w-[290px] border-l border-surface-border bg-white flex-shrink-0 flex flex-col overflow-hidden">
      <div className="flex-shrink-0 border-b border-surface-border bg-gradient-to-b from-slate-50/80 to-white">
        <div className="flex items-center justify-between px-3.5 pt-3 pb-0">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Contact</span>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-surface-hover text-slate-400 transition-colors"><X size={14}/></button>
        </div>
        <div className="flex items-center gap-3 px-3.5 pt-2.5 pb-0">
          <div className="relative flex-shrink-0">
            <div className="w-11 h-11 rounded-2xl bg-primary flex items-center justify-center text-white font-bold text-sm shadow-sm">{conversation.avatar}</div>
            <span className={clsx('absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-white', sm.dot)}/>
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-bold text-slate-900 text-[13px] leading-tight truncate">{conversation.name}</p>
            <p className="text-[11px] text-slate-400 mt-0.5 truncate">{conversation.handle}</p>
          </div>
        </div>
        <div className="flex items-center gap-1.5 px-3.5 pt-2 flex-wrap">
          <span className={clsx('inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border',
            conversation.status === 'bot' ? 'bg-blue-50 text-blue-600 border-blue-200'
              : conversation.status === 'agent' ? 'bg-emerald-50 text-emerald-600 border-emerald-200'
              : 'bg-slate-100 text-slate-500 border-slate-200')}>
            <span className={clsx('w-1.5 h-1.5 rounded-full', sm.dot)}/>{sm.label}
          </span>
          {conversation.agentName && (
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-violet-50 text-violet-600 border border-violet-200 max-w-[100px] truncate">
              @{conversation.agentName.split(' ')[0]}
            </span>
          )}
          {conversation.labels.slice(0, 2).map(l => (
            <span key={l} className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-primary-50 text-primary border border-primary/20">#{l}</span>
          ))}
        </div>
        <div className="grid grid-cols-3 gap-1.5 px-3.5 pt-2.5 pb-3">
          {[
            { Icon: Send,  label: 'Message', cls: 'bg-primary text-white hover:bg-primary/90 col-span-2' },
            { Icon: Star,  label: conversation.starred ? 'Starred' : 'Star',
              cls: clsx('border', conversation.starred ? 'bg-amber-50 border-amber-200 text-amber-500' : 'bg-white border-surface-border text-slate-500 hover:text-amber-500 hover:border-amber-200') },
          ].map(({ Icon, label, cls }) => (
            <button key={label} className={clsx('flex items-center justify-center gap-1 py-1.5 rounded-xl text-[10px] font-semibold transition-colors', cls)}>
              <Icon size={11}/>{label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex items-center gap-0.5 bg-slate-100 p-1 mx-3 my-2 rounded-xl flex-shrink-0">
        {TABS.map(({ key, Icon, label }) => (
          <button key={key} onClick={() => setTab(key)}
            className={clsx('flex flex-col items-center gap-0.5 flex-1 py-1.5 rounded-lg transition-all',
              tab === key ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-400 hover:text-slate-600')}>
            <Icon size={13}/>
            <span className="text-[9px] font-semibold">{label}</span>
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto">
        {tab === 'contact' && (
          <div className="pb-6 space-y-0">
            <div className="mt-4">
              <div className="flex items-center justify-between px-4 py-2">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Contact Information</p>
                <span className="text-[9px] text-slate-300">Click any field to edit</span>
              </div>
              <div className="border-t border-surface-border">
                <div className="flex items-start gap-2.5 px-3 py-2 border-b border-surface-border/40 bg-slate-50/60">
                  <AtSign size={12} className="text-slate-400 flex-shrink-0 mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <p className="text-[9px] text-slate-400 leading-none mb-0.5">Handle</p>
                    <p className="text-[11px] text-slate-700 font-medium">{conversation.handle}</p>
                  </div>
                  <span className="text-[9px] px-1.5 py-0.5 rounded bg-pink-50 text-pink-600 border border-pink-200 font-bold flex-shrink-0 mt-0.5">IG</span>
                </div>
                <EditableField icon={Mail}      label="Email"    value={info.email}   onSave={setField('email')}   type="email" />
                <EditableField icon={Building2} label="Company"  value={info.company} onSave={setField('company')} />
                <EditableField icon={Link2}     label="Website"  value={info.website} onSave={setField('website')} placeholder="www.example.com" />
              </div>
            </div>

            <div className="mt-4">
              <div className="px-4 py-2">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Personal Details</p>
              </div>
              <div className="border-t border-surface-border">
                <EditableField icon={CalendarDays} label="Date of Birth" value={info.dob}      onSave={setField('dob')}      type="date" />
                <EditableField icon={User2}        label="Gender"        value={info.gender}   onSave={setField('gender')}   placeholder="e.g. Male / Female / Other" />
                <EditableField icon={Languages}    label="Language"      value={info.language} onSave={setField('language')} placeholder="e.g. English, Hindi…" />
              </div>
            </div>

            {customFields.contact.length > 0 && (
              <div className="mt-4">
                <div className="flex items-center justify-between px-4 py-2">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Custom Fields</p>
                  <span className="text-[9px] text-slate-300">Click any field to edit</span>
                </div>
                <div className="border-t border-surface-border">
                  {customFields.contact.map(f => (
                    <EditableCustomField key={f.id} field={f} value={customValues[f.key]} onSave={setCustomField(f.key)} />
                  ))}
                </div>
              </div>
            )}

            <div className="mt-4">
              <div className="px-4 py-2">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Conversation</p>
              </div>
              <div className="border-t border-b border-surface-border divide-y divide-surface-border/40">
                {[
                  { k: 'Status',  v: sm.label },
                  { k: 'Handler', v: conversation.agentName || (conversation.status === 'bot' ? 'Bot' : 'Unassigned') },
                  { k: 'Channel', v: 'Instagram' },
                  { k: 'Source',  v: src?.label || 'Direct Message' },
                ].map(({ k, v }) => (
                  <div key={k} className="flex justify-between items-center px-3 py-2">
                    <span className="text-[11px] text-slate-400">{k}</span>
                    <span className="text-[11px] font-semibold text-slate-700">{v}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-4 mx-4">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Labels</p>
              <div className="flex flex-wrap gap-1.5">
                {conversation.labels.map(lbl => (
                  <span key={lbl} className="flex items-center gap-1 badge badge-blue text-[10px]">#{lbl}</span>
                ))}
                {conversation.labels.length === 0 && <span className="text-[11px] text-slate-300 italic">No labels</span>}
              </div>
            </div>

            <div className="mt-4 mx-4">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Assigned Agent</p>
              <NativeSelect value={conversation.agentId || ''} onChange={e => { const a = AGENTS.find(ag => ag.id === e.target.value); onAssign(conversation.id, a?.id || null, a?.name || null) }} sm>
                <option value="">Unassigned</option>
                {AGENTS.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
              </NativeSelect>
            </div>
          </div>
        )}

        {tab === 'notes' && (
          <div className="p-4 space-y-3">
            <div className="space-y-2">
              <textarea className="textarea text-xs" rows={4} placeholder="Add a private note…" value={noteText} onChange={e => setNoteText(e.target.value)} />
              <button onClick={() => { if (noteText.trim()) { onAddNote(conversation.id, noteText.trim()); setNoteText('') } }}
                disabled={!noteText.trim()}
                className={clsx('w-full justify-center text-xs', noteText.trim() ? 'btn-primary' : 'btn-secondary opacity-50 cursor-not-allowed')}>
                <Send size={12}/> Save Note
              </button>
            </div>
            {notes.length === 0 ? (
              <div className="text-center py-8">
                <FileText size={20} className="mx-auto text-slate-300 mb-2" />
                <p className="text-xs text-slate-400">No notes yet</p>
              </div>
            ) : notes.map((n, i) => (
              <div key={i} className="p-3 rounded-xl bg-amber-50 border border-amber-100">
                <p className="text-xs text-amber-900">{n.text}</p>
                <p className="text-[10px] text-amber-600 mt-1">{n.time}</p>
              </div>
            ))}
          </div>
        )}

        {tab === 'chats' && (
          <div className="p-4 space-y-2">
            {pastChats.length === 0 ? (
              <div className="text-center py-8">
                <MessageCircle size={20} className="mx-auto text-slate-300 mb-2" />
                <p className="text-xs text-slate-400">No past conversations</p>
              </div>
            ) : pastChats.map(p => (
              <div key={p.id} className="p-3 rounded-xl border border-surface-border hover:border-primary/20 hover:bg-primary-50/30 transition-colors cursor-pointer">
                <p className="text-xs text-slate-700">{p.snippet}</p>
                <div className="flex items-center justify-between mt-1.5">
                  <span className="text-[10px] text-slate-400">{p.date}</span>
                  <span className="badge badge-gray text-[9px]">{p.status}</span>
                </div>
              </div>
            ))}
          </div>
        )}

        {tab === 'activity' && (
          <div className="p-4">
            <div className="relative pl-6">
              <div className="absolute left-3 top-1 bottom-1 w-px bg-slate-100" />
              {[
                { icon: MessageCircle, text: 'Started conversation', time: conversation.time },
                { icon: Tag, text: 'Tagged as ' + (conversation.labels[0] || '—'), time: conversation.time },
              ].map((ev, i) => (
                <div key={i} className="flex items-start gap-2.5 mb-4 relative">
                  <div className="w-6 h-6 rounded-full bg-white border border-surface-border flex items-center justify-center flex-shrink-0 z-10 -ml-6">
                    <ev.icon size={11} className="text-slate-400"/>
                  </div>
                  <div>
                    <p className="text-[11px] text-slate-700">{ev.text}</p>
                    <p className="text-[10px] text-slate-400">{ev.time}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

/* ─── Page ─────────────────────────────────────────────────────── */
export default function InstagramInbox() {
  const [conversations, setConversations] = useState(CONVERSATIONS)
  const [activeId, setActiveId]     = useState(CONVERSATIONS[0]?.id || null)
  const [sidebarKey, setSidebarKey] = useState('all')
  const [adminOnline, setAdminOnline] = useState(false)
  const [showPanel, setShowPanel]   = useState(true)
  const [search, setSearch]         = useState('')
  const [filter, setFilter]         = useState('all')
  const [agentFilter, setAgentFilter] = useState('all')
  const [sourceFilter, setSourceFilter] = useState('all')
  const [labelFilter, setLabelFilter] = useState([])
  const [starredOnly, setStarredOnly] = useState(false)
  const [unreadOnly, setUnreadOnly]   = useState(false)
  const [showArchived, setShowArchived] = useState(false)
  const [customFieldFilters, setCustomFieldFiltersState] = useState({})
  const [view, setView] = useState('chats')
  const [showNewConv, setShowNewConv] = useState(false)

  function setCustomFieldFilter(key, value) {
    setCustomFieldFiltersState(prev => {
      if (value === '' || value == null) { const { [key]: _o, ...rest } = prev; return rest }
      return { ...prev, [key]: value }
    })
  }
  function clearCustomFieldFilters() { setCustomFieldFiltersState({}) }

  function handleSidebarSelect(key) {
    setFilter('all'); setAgentFilter('all'); setSourceFilter('all'); setStarredOnly(false); setUnreadOnly(false); setShowArchived(false)
    switch (key) {
      case 'dm': case 'comment': case 'story': setSourceFilter(key); break
      case 'active':     setFilter('open' === key ? 'open' : 'all'); break
      case 'assigned':   setAgentFilter('admin'); break
      case 'unassigned': setAgentFilter('unassigned'); break
      case 'favorite':   setStarredOnly(true); break
      case 'open':       setFilter('all'); break
      case 'pending':    setFilter('bot'); break
      case 'solved':     setFilter('resolved'); break
      case 'unread':     setUnreadOnly(true); break
      default: break
    }
    setSidebarKey(key)
  }

  const active = conversations.find(c => c.id === activeId) || null

  const filtered = conversations.filter(c => {
    const matchStatus = filter === 'all' ? true
      : filter === 'open' ? (c.status === 'bot' || c.status === 'agent')
      : c.status === filter
    const matchAgent  = agentFilter === 'all' || c.agentId === agentFilter || (agentFilter === 'unassigned' && !c.agentId)
    const matchSource = sourceFilter === 'all' || c.source === sourceFilter
    const matchSearch = !search.trim() || c.name.toLowerCase().includes(search.toLowerCase()) || c.handle.toLowerCase().includes(search.toLowerCase()) || c.lastMessage.toLowerCase().includes(search.toLowerCase())
    const matchArchived = showArchived ? c.archived : !c.archived
    const matchStarred = !starredOnly || c.starred
    const matchUnread  = !unreadOnly || (c.unread || 0) > 0
    const matchLabel   = labelFilter.length === 0 || labelFilter.every(l => c.labels.includes(l))
    const matchCustom  = Object.entries(customFieldFilters).every(([k, v]) => (c.customFields || {})[k] === v)
    return matchStatus && matchAgent && matchSource && matchSearch && matchArchived && matchStarred && matchUnread && matchLabel && matchCustom
  })

  function updateConv(id, patch) { setConversations(p => p.map(c => c.id === id ? { ...c, ...patch } : c)) }
  function selectConv(id) { setActiveId(id); updateConv(id, { unread: 0 }) }
  function sendMessage(id, text) {
    setConversations(p => p.map(c => c.id === id
      ? { ...c, lastMessage: text, messages: [...c.messages, { id: Date.now(), from: 'agent', sender: 'You', text, time: 'now' }] }
      : c))
  }
  function sendTemplate(id, payload) {
    const preview = payload.kind === 'generic'
      ? `📇 ${payload.elements[0]?.title || 'Template'}${payload.elements.length > 1 ? ` +${payload.elements.length - 1} more` : ''}`
      : `🔘 ${payload.text.slice(0, 60)}`
    setConversations(p => p.map(c => c.id === id
      ? { ...c, lastMessage: preview, messages: [...c.messages, { id: Date.now(), from: 'agent', sender: 'You', time: 'now', type: 'template', igTemplate: payload }] }
      : c))
  }
  function takeover(id) { updateConv(id, { status: 'agent', agentId: 'admin', agentName: 'Deepak Kumar' }) }
  function resolve(id)  { updateConv(id, { status: 'resolved', unread: 0 }) }
  function reopen(id)   { updateConv(id, { status: 'bot', agentId: null, agentName: null }) }
  function toggleStar(id) { setConversations(p => p.map(c => c.id === id ? { ...c, starred: !c.starred } : c)) }
  function archive(id)  { updateConv(id, { archived: true }) }
  function addLabel(id, label) { setConversations(p => p.map(c => c.id === id && !c.labels.includes(label) ? { ...c, labels: [...c.labels, label] } : c)) }
  function removeLabel(id, label) { setConversations(p => p.map(c => c.id === id ? { ...c, labels: c.labels.filter(l => l !== label) } : c)) }
  function assignAgent(id, agentId, agentName) { updateConv(id, { status: agentId ? 'agent' : 'bot', agentId, agentName }) }
  function addNote(id, text) { setConversations(p => p.map(c => c.id === id ? { ...c, notes: [...(c.notes || []), { text, time: 'Just now' }] } : c)) }
  function snoozeConversation(id, value, label) { updateConv(id, { snoozed: true, snoozedLabel: label }) }
  function startConversation(follower, msg) {
    const id = `ic${Date.now()}`
    const newConv = {
      id, name: follower.name, handle: follower.handle, avatar: follower.avatar, time: 'now', unread: 0, starred: false,
      status: msg ? 'agent' : 'bot', agentId: msg ? 'admin' : null, agentName: msg ? 'Deepak Kumar' : null, source: 'dm', labels: [],
      lastMessage: msg || 'New conversation', archived: false,
      email: '', company: '', website: '', dob: '', gender: '', language: 'English', customFields: {},
      timestamp: new Date().toISOString(),
      messages: msg ? [{ id: Date.now(), from: 'agent', sender: 'You', text: msg, time: 'now' }] : [],
    }
    setConversations(p => [newConv, ...p])
    setActiveId(id)
    setShowNewConv(false)
    setView('chats')
  }

  return (
    <div className="h-[calc(100vh-48px)] md:h-screen -mx-3 -mt-3 -mb-3 sm:-mx-5 sm:-mt-5 sm:-mb-5 flex overflow-hidden">
      <div className="hidden md:flex flex-shrink-0">
        <FilterSidebar sidebarKey={sidebarKey} onSelect={handleSidebarSelect} allConversations={conversations}
          adminOnline={adminOnline} setAdminOnline={setAdminOnline} />
      </div>

      <div className="flex-shrink-0 min-w-0 w-full md:w-[280px] flex flex-col border-r border-surface-border">
        <ConversationList
          conversations={filtered} allConversations={conversations} activeId={activeId} onSelect={selectConv}
          search={search} setSearch={setSearch}
          sidebarKey={sidebarKey} onSidebarSelect={handleSidebarSelect}
          adminOnline={adminOnline} setAdminOnline={setAdminOnline}
          agentFilter={agentFilter} setAgentFilter={setAgentFilter}
          sourceFilter={sourceFilter} setSourceFilter={setSourceFilter}
          labelFilter={labelFilter} setLabelFilter={setLabelFilter}
          starredOnly={starredOnly} setStarredOnly={setStarredOnly}
          unreadOnly={unreadOnly} setUnreadOnly={setUnreadOnly}
          showArchived={showArchived} setShowArchived={setShowArchived}
          filter={filter} setFilter={setFilter}
          customFieldFilters={customFieldFilters} setCustomFieldFilter={setCustomFieldFilter}
          clearCustomFieldFilters={clearCustomFieldFilters}
          view={view} setView={setView} onNewConversation={() => setShowNewConv(true)}
        />
      </div>

      <div className="flex flex-1 min-w-0 overflow-hidden">
        {view === 'insights' ? (
          <InboxInsightsPanel allConversations={conversations} adminOnline={adminOnline}/>
        ) : (
          <>
            <ChatWindow conversation={active} onSend={sendMessage} onSendTemplate={sendTemplate} onTakeover={takeover} onResolve={resolve} onReopen={reopen}
              onStar={toggleStar} onArchive={archive} onAddLabel={addLabel} onRemoveLabel={removeLabel}
              onSnooze={snoozeConversation} onAssign={assignAgent} adminOnline={adminOnline}
              showPanel={showPanel} onTogglePanel={() => setShowPanel(p => !p)} />
            {showPanel && active && (
              <div className="hidden lg:flex flex-shrink-0">
                <ContactPanel conversation={active} onClose={() => setShowPanel(false)} onUpdate={updateConv} onAssign={assignAgent} onAddNote={addNote} />
              </div>
            )}
          </>
        )}
      </div>

      {showNewConv && (
        <NewConversationModal onClose={() => setShowNewConv(false)} onStart={startConversation}
          existingHandles={conversations.map(c => c.handle)}/>
      )}
    </div>
  )
}
