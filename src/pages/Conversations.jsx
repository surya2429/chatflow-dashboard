import { useState, useRef, useEffect } from 'react'
import { useCall } from '../context/CallContext'
import {
  Search, Bot, UserCheck, CheckCircle2, Send, Paperclip, Mic,
  Smile, MoreVertical, Phone, X, Star, FileText,
  ChevronDown, Settings, Plus, Archive, AlertCircle,
  MessageCircle, PhoneCall, Grid3x3, SlidersHorizontal,
  RefreshCw, Zap, AtSign, Clock, Users, Inbox, Radio,
  Hash, TrendingUp, Activity, ShieldCheck, BarChart2,
  ArrowRightLeft, Bell, BellOff, Globe, Bold, Italic,
  Image, Eye, Filter, Tag, Package, ShoppingBag, ChevronRight,
  RotateCcw, UserPlus, MessageSquare, ThumbsUp, Megaphone,
  Mail, MapPin, Building2, CalendarDays, Link2,
  User2, Languages, Home, Landmark, CircleDashed, PhoneMissed, PhoneIncoming, PhoneOutgoing,
} from 'lucide-react'
import { useConversations } from '../context/ConversationContext'
import { useApp } from '../context/AppContext'
import { AGENTS, TEMPLATES, PAST_CONVERSATIONS, MOCK_ORDERS } from '../constants/mockData'
import Select, { NativeSelect } from '../components/Select'
import {
  STATUS_MAP, AGENT_STATUS_DOT, AGENT_STATUS_LABEL, ALL_LABELS, EMOJIS, CANNED,
  LabelPicker, SnoozePicker, EmojiPicker, TransferModal, ReassignModal,
  EditableField, EditableCustomField, ExternalLinkIcon, CountryCodePicker,
} from '../components/inbox/SharedInboxParts'
import clsx from 'clsx'

/* ─── Constants (WhatsApp-only — CTWA ad-source attribution) ──── */
const CTWA_SOURCES = [
  { key: 'ctwa',   label: 'CTWA',   full: 'Click to WhatsApp',  desc: 'Meta Facebook/Instagram ads → WhatsApp CTA', color: 'text-blue-600',    bg: 'bg-blue-50'    },
  { key: 'g-ctwa', label: 'G-CTWA', full: 'Google Click to WA', desc: 'Google Ads → WhatsApp as click destination', color: 'text-emerald-600', bg: 'bg-emerald-50' },
  { key: 't-ctwa', label: 'T-CTWA', full: 'TikTok Click to WA', desc: 'TikTok Ads → WhatsApp as click destination', color: 'text-pink-600',    bg: 'bg-pink-50'    },
]

const VIEW_FILTERS = [
  { key: 'all',        label: 'All chats',      icon: Inbox         },
  { key: 'active',     label: 'Active chats',   icon: MessageCircle },
  { key: 'assigned',   label: 'Assigned to me', icon: UserCheck     },
  { key: 'unassigned', label: 'Unassigned',     icon: Users         },
]
const MORE_FILTERS = [
  { key: 'last24',     label: 'Last 24 Hours',  icon: Clock,         color: '' },
  { key: 'favorite',   label: 'Favourite only', icon: Star,          color: '' },
  { key: 'open',       label: 'Open',           icon: MessageCircle, color: 'text-emerald-600' },
  { key: 'pending',    label: 'Pending',        icon: AlertCircle,   color: 'text-amber-600'   },
  { key: 'solved',     label: 'Solved',         icon: CheckCircle2,  color: 'text-slate-500'   },
  { key: 'broadcasts', label: 'Broadcasts',     icon: Radio,         color: '' },
  { key: 'unread',     label: 'Unread',         icon: Hash,          color: '' },
]
const STATUS_TABS = [
  { key: 'all',      label: 'All'      },
  { key: 'open',     label: 'Open'     },
  { key: 'bot',      label: 'Bot'      },
  { key: 'agent',    label: 'Agent'    },
  { key: 'resolved', label: 'Resolved' },
  { key: 'closed',   label: 'Closed'   },
]

/* ─── Small SVG icons ─────────────────────────────────────────── */
const IgIcon = ({ size = 13 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
    <circle cx="12" cy="12" r="4" />
    <circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none" />
  </svg>
)

/* ─── Template Picker ─────────────────────────────────────────── */
function TemplatePicker({ onSelect, onClose }) {
  const [search, setSearch] = useState('')
  const [cat, setCat]       = useState('ALL')

  const CATS = ['ALL', 'MARKETING', 'TRANSACTIONAL', 'UTILITY', 'AUTHENTICATION']
  const CAT_COLOR = {
    MARKETING:      'badge-purple',
    TRANSACTIONAL:  'badge-blue',
    UTILITY:        'badge-amber',
    AUTHENTICATION: 'badge-gray',
  }

  const filteredTmpl = TEMPLATES.filter(t =>
    (cat === 'ALL' || t.category === cat) &&
    (t.name.toLowerCase().includes(search.toLowerCase()) || t.body.toLowerCase().includes(search.toLowerCase()))
  ).filter(t => t.status === 'APPROVED')

  return (
    <div className="border-t border-surface-border bg-white flex-shrink-0 shadow-[0_-4px_12px_rgba(0,0,0,0.06)]">
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-surface-border">
        <div className="flex items-center gap-2">
          <FileText size={14} className="text-primary" />
          <span className="text-xs font-semibold text-slate-800">Send Template</span>
          <span className="text-[10px] text-slate-400">Approved templates only</span>
        </div>
        <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-surface-hover text-slate-400 hover:text-slate-600 transition-colors"><X size={14} /></button>
      </div>
      <div className="px-4 pt-2.5 pb-2 space-y-2">
        <div className="relative">
          <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input className="input-sm pl-8 w-full" placeholder="Search templates…" value={search} onChange={e => setSearch(e.target.value)} autoFocus />
        </div>
        <div className="flex items-center gap-1 overflow-x-auto scrollbar-hide">
          {CATS.map(c => (
            <button key={c} onClick={() => setCat(c)}
              className={clsx('flex-shrink-0 px-2.5 py-0.5 rounded-full text-[10px] font-semibold transition-colors',
                cat === c ? 'bg-primary text-white' : 'bg-slate-100 text-slate-500 hover:bg-slate-200')}>
              {c === 'ALL' ? 'All' : c.charAt(0) + c.slice(1).toLowerCase()}
            </button>
          ))}
        </div>
      </div>
      <div className="max-h-56 overflow-y-auto px-4 pb-3 space-y-2">
        {filteredTmpl.length === 0 && <p className="text-xs text-slate-400 text-center py-4">No approved templates found</p>}
        {filteredTmpl.map(t => (
          <div key={t.id} className="border border-surface-border rounded-xl p-3 hover:border-primary/30 hover:bg-primary-50/40 transition-all group">
            <div className="flex items-start justify-between gap-2 mb-1.5">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs font-semibold text-slate-800">{t.name}</span>
                <span className={clsx('badge text-[9px]', CAT_COLOR[t.category] || 'badge-gray')}>
                  {t.category.charAt(0) + t.category.slice(1).toLowerCase()}
                </span>
              </div>
              <button onClick={() => onSelect(t.body)} className="flex-shrink-0 text-[11px] px-3 py-1 rounded-lg bg-primary text-white font-medium opacity-0 group-hover:opacity-100 transition-opacity">Send</button>
            </div>
            <p className="text-[11px] text-slate-500 leading-relaxed line-clamp-2">{t.body}</p>
          </div>
        ))}
      </div>
    </div>
  )
}

/* ─── Filter sidebar ──────────────────────────────────────────── */
function FilterSidebar({ sidebarKey, onSelect, allConversations, adminOnline, setAdminOnline }) {
  const [showMore, setShowMore] = useState(true)

  /* Live badge counts from allConversations */
  const cnt = {
    whatsapp:   allConversations.filter(c => (c.channel || 'whatsapp') === 'whatsapp').length,
    calls:      allConversations.filter(c => c.channel === 'calls').length,
    all:        allConversations.length,
    active:     allConversations.filter(c => c.status === 'bot' || c.status === 'agent').length,
    assigned:   allConversations.filter(c => c.agentId === 'admin').length,
    unassigned: allConversations.filter(c => !c.agentId && c.status !== 'resolved').length,
    open:       allConversations.filter(c => c.status === 'bot' || c.status === 'agent').length,
    pending:    allConversations.filter(c => c.status === 'bot').length,
    solved:     allConversations.filter(c => c.status === 'resolved').length,
    broadcasts: allConversations.filter(c => c.source === 'broadcast').length,
    unread:     allConversations.filter(c => (c.unread || 0) > 0).length,
    ctwa:       allConversations.filter(c => c.source === 'ctwa').length,
    'g-ctwa':   allConversations.filter(c => c.source === 'g-ctwa').length,
    't-ctwa':   allConversations.filter(c => c.source === 't-ctwa').length,
  }

  const CHANNELS = [
    { key: 'whatsapp', label: 'WhatsApp',       icon: MessageCircle, count: cnt.whatsapp },
    { key: 'calls',    label: 'WhatsApp Calls', icon: PhoneCall,     count: cnt.calls    },
  ]

  const VIEWS = [
    { key: 'all',        label: 'All chats',      icon: Inbox,        count: cnt.all        },
    { key: 'active',     label: 'Active chats',   icon: MessageCircle,count: cnt.active     },
    { key: 'assigned',   label: 'Assigned to me', icon: UserCheck,    count: cnt.assigned   },
    { key: 'unassigned', label: 'Unassigned',     icon: Users,        count: cnt.unassigned },
  ]

  const MORE = [
    { key: 'last24',     label: 'Last 24 Hours',  icon: Clock,        color: '',                 count: null           },
    { key: 'favorite',   label: 'Favourite only', icon: Star,         color: '',                 count: null           },
    { key: 'open',       label: 'Open',           icon: MessageCircle,color: 'text-emerald-600', count: cnt.open       },
    { key: 'pending',    label: 'Pending',        icon: AlertCircle,  color: 'text-amber-600',   count: cnt.pending    },
    { key: 'solved',     label: 'Solved',         icon: CheckCircle2, color: 'text-slate-500',   count: cnt.solved     },
    { key: 'broadcasts', label: 'Broadcasts',     icon: Radio,        color: '',                 count: cnt.broadcasts },
    { key: 'unread',     label: 'Unread',         icon: Hash,         color: 'text-blue-600',    count: cnt.unread     },
  ]

  function row(key, Icon, label, count, color = '') {
    const isActive = sidebarKey === key
    return (
      <button key={key} onClick={() => onSelect(key)}
        className={clsx(
          'w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs font-medium transition-colors text-left',
          isActive ? 'bg-primary-50 text-primary' : [color || 'text-slate-600', 'hover:bg-surface-hover']
        )}>
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
      {/* Online toggle */}
      <button
        onClick={() => setAdminOnline(p => !p)}
        className={clsx('flex items-center gap-2 px-3 py-2 text-xs font-semibold border-b transition-colors w-full',
          adminOnline ? 'bg-emerald-50 border-emerald-100 text-emerald-700' : 'bg-slate-50 border-surface-border text-slate-500 hover:bg-surface-hover')}>
        <span className={clsx('w-2 h-2 rounded-full flex-shrink-0', adminOnline ? 'bg-emerald-500 animate-pulse' : 'bg-slate-300')} />
        {adminOnline ? 'You are Online' : 'Go Online (as Agent)'}
      </button>

      <div className="flex-1 overflow-y-auto py-2">

        {/* ── Channels ── */}
        <div className="px-3 mb-1">
          <div className="flex items-center gap-1.5 py-1 mb-0.5">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Channels</span>
            <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-primary text-white font-bold leading-none">New</span>
          </div>
          {CHANNELS.map(ch => row(ch.key, ch.icon, ch.label, ch.count))}
        </div>

        <div className="mx-3 border-t border-surface-border my-1.5" />

        {/* ── View filters ── */}
        <div className="px-3 mb-1">
          {VIEWS.map(f => row(f.key, f.icon, f.label, f.count))}
        </div>

        <div className="mx-3 border-t border-surface-border my-1.5" />

        {/* ── More / Less ── */}
        <div className="px-3">
          <button onClick={() => setShowMore(p => !p)}
            className="flex items-center gap-1 text-[10px] text-slate-500 hover:text-slate-700 font-semibold mb-1 w-full py-1">
            <ChevronDown size={11} className={clsx('transition-transform', !showMore && '-rotate-90')} />
            {showMore ? 'Less' : 'More'}
          </button>
          {showMore && (
            <>
              {MORE.map(f => row(f.key, f.icon, f.label, f.count, f.color))}

              {/* ── Ad Sources ── */}
              <div className="mt-2 pt-2 border-t border-surface-border/60">
                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider px-2 block mb-1">Ad Sources</span>
                {CTWA_SOURCES.map(src => {
                  const isActive = sidebarKey === src.key
                  const srcCount = cnt[src.key] || 0
                  return (
                    <button key={src.key} onClick={() => onSelect(src.key)} title={src.desc}
                      className={clsx('w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs transition-colors text-left',
                        isActive ? `${src.bg} ${src.color} font-semibold` : 'text-slate-600 hover:bg-surface-hover')}>
                      <span className={clsx('text-[9px] font-bold px-1.5 py-0.5 rounded border flex-shrink-0',
                        isActive ? `${src.bg} ${src.color} border-current` : 'bg-slate-100 text-slate-500 border-slate-200')}>
                        {src.label}
                      </span>
                      <span className="flex-1 truncate text-[11px]">{src.full}</span>
                      {srcCount > 0 && (
                        <span className={clsx('text-[10px] font-bold', isActive ? src.color : 'text-slate-400')}>{srcCount}</span>
                      )}
                    </button>
                  )
                })}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

/* ─── Advanced Filter Panel ───────────────────────────────── */
const ALL_LABELS_LIST = ['vip','lead','support','refund','appointment','order-issue','urgent','follow-up','prospect','payment','satisfied']
const DATE_PRESETS = [
  { key: 'all',       label: 'All time'    },
  { key: 'today',     label: 'Today'       },
  { key: 'yesterday', label: 'Yesterday'   },
  { key: 'last7',     label: 'Last 7 days' },
  { key: 'last30',    label: 'Last 30 days'},
  { key: 'custom',    label: 'Custom'      },
]
const SOURCE_OPTS = [
  { key: 'all',    label: 'All sources' },
  { key: 'direct', label: 'Direct'      },
  { key: 'ctwa',   label: 'CTWA (Meta)' },
  { key: 'g-ctwa', label: 'G-CTWA'      },
  { key: 't-ctwa', label: 'T-CTWA'      },
]

function AdvancedFilterPanel({
  dateRange, setDateRange, dateFrom, setDateFrom, dateTo, setDateTo,
  labelFilter, setLabelFilter,
  starredOnly, setStarredOnly, unreadOnly, setUnreadOnly,
  showArchived, setShowArchived,
  sourceFilter, setSourceFilter,
  agentSel, setAgentSel, setAgentFilter,
  setFilter, currentStatus,
  customFieldDefs = [], customFieldFilters = {}, setCustomFieldFilter,
  onClear, onClose,
}) {
  const sel = 'w-full text-[11px] border border-surface-border rounded-lg px-2.5 py-1.5 text-slate-700 bg-white focus:outline-none focus:border-primary/40 cursor-pointer'
  const Toggle = ({ label, value, set }) => (
    <label className="flex items-center justify-between cursor-pointer py-1.5">
      <span className="text-[11px] text-slate-600">{label}</span>
      <div onClick={() => set(p => !p)}
        className={clsx('w-8 h-4 rounded-full relative transition-colors cursor-pointer flex-shrink-0',
          value ? 'bg-primary' : 'bg-slate-200')}>
        <div className={clsx('absolute top-0.5 w-3 h-3 rounded-full bg-white shadow transition-transform',
          value ? 'translate-x-4' : 'translate-x-0.5')} />
      </div>
    </label>
  )

  return (
    <div className="absolute top-full right-0 mt-1.5 bg-white rounded-xl border border-surface-border shadow-modal z-40 w-64 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-surface-border">
        <span className="text-xs font-semibold text-slate-800">Filters</span>
        <div className="flex items-center gap-2">
          <button onClick={onClear} className="text-[10px] text-primary font-medium hover:underline">Clear all</button>
          <button onClick={onClose} className="p-1 rounded hover:bg-surface-hover text-slate-400"><X size={11} /></button>
        </div>
      </div>

      <div className="px-4 py-3 space-y-3">
        {/* Status */}
        <div>
          <p className="text-[9px] font-semibold text-slate-400 uppercase tracking-wide mb-1.5">Status</p>
          <Select size="sm" value={currentStatus} onChange={v => setFilter(v)}
            options={[
              { value: 'all',      label: 'All'      },
              { value: 'open',     label: 'Open'     },
              { value: 'bot',      label: 'Bot'      },
              { value: 'agent',    label: 'Agent'    },
              { value: 'resolved', label: 'Resolved' },
              { value: 'closed',   label: 'Closed'   },
            ]} />
        </div>

        {/* Agent */}
        <div>
          <p className="text-[9px] font-semibold text-slate-400 uppercase tracking-wide mb-1.5">Agent</p>
          <Select size="sm" value={agentSel} onChange={v => { setAgentSel(v); setAgentFilter(v) }}
            options={[
              { value: 'all',        label: 'All Agents'  },
              { value: 'unassigned', label: 'Unassigned'  },
              ...AGENTS.map(a => ({ value: a.id, label: a.name })),
            ]} />
        </div>

        {/* Date */}
        <div>
          <p className="text-[9px] font-semibold text-slate-400 uppercase tracking-wide mb-1.5">Date Range</p>
          <Select size="sm" value={dateRange} onChange={v => setDateRange(v)}
            options={DATE_PRESETS.map(p => ({ value: p.key, label: p.label }))} />
          {dateRange === 'custom' && (
            <div className="flex items-center gap-1.5 mt-2">
              <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
                className="flex-1 min-w-0 text-[10px] border border-surface-border rounded-lg px-2 py-1.5 text-slate-700 bg-white focus:outline-none focus:border-primary/40" />
              <span className="text-[9px] text-slate-400 flex-shrink-0">–</span>
              <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
                className="flex-1 min-w-0 text-[10px] border border-surface-border rounded-lg px-2 py-1.5 text-slate-700 bg-white focus:outline-none focus:border-primary/40" />
            </div>
          )}
        </div>

        {/* Label */}
        {ALL_LABELS_LIST.length > 0 && (
          <div>
            <p className="text-[9px] font-semibold text-slate-400 uppercase tracking-wide mb-1.5">Label</p>
            <Select size="sm" value={labelFilter[0] || ''} onChange={v => setLabelFilter(v ? [v] : [])}
              options={[
                { value: '', label: 'All Labels' },
                ...ALL_LABELS_LIST.map(l => ({ value: l, label: `#${l}` })),
              ]} />
          </div>
        )}

        {/* Source */}
        <div>
          <p className="text-[9px] font-semibold text-slate-400 uppercase tracking-wide mb-1.5">Source</p>
          <Select size="sm" value={sourceFilter} onChange={v => setSourceFilter(v)}
            options={SOURCE_OPTS.map(s => ({ value: s.key, label: s.label }))} />
        </div>

        {/* Toggles */}
        <div className="border-t border-surface-border pt-2 -mx-4 px-4">
          <Toggle label="Starred only"   value={starredOnly}  set={setStarredOnly}  />
          <Toggle label="Unread only"    value={unreadOnly}   set={setUnreadOnly}   />
          <Toggle label="Show archived"  value={showArchived} set={setShowArchived} />
        </div>

        {/* Custom Fields — dropdown & yes/no fields defined in Settings → Custom Fields */}
        {customFieldDefs.length > 0 && (
          <div className="border-t border-surface-border pt-2 -mx-4 px-4 space-y-2">
            <p className="text-[9px] font-semibold text-slate-400 uppercase tracking-wide">Custom Fields</p>
            {customFieldDefs.map(f => f.type === 'boolean' ? (
              <Toggle key={f.id} label={f.name}
                value={customFieldFilters[f.key] === true}
                set={fn => setCustomFieldFilter(f.key, fn(customFieldFilters[f.key] === true) ? true : '')} />
            ) : (
              <div key={f.id}>
                <Select size="sm" value={customFieldFilters[f.key] || ''} onChange={v => setCustomFieldFilter(f.key, v)}
                  options={[
                    { value: '', label: f.name },
                    ...(f.options || []).map(opt => ({ value: opt, label: opt })),
                  ]} />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

/* ─── Quick contacts for new conversation ─────────────────────── */
const QUICK_CONTACTS = [
  { id:'c1',  name:'Priya Sharma',   phone:'+91 98765 43210', avatar:'PS', optIn:true,  company:'Sharma Enterprises'   },
  { id:'c2',  name:'Rahul Mehta',    phone:'+91 82341 09876', avatar:'RM', optIn:true,  company:'TechCorp Solutions'    },
  { id:'c3',  name:'Anita Kapoor',   phone:'+91 91234 56789', avatar:'AK', optIn:true,  company:''                      },
  { id:'c4',  name:'Vikram Singh',   phone:'+91 77890 12345', avatar:'VS', optIn:false, company:''                      },
  { id:'c5',  name:'Meera Joshi',    phone:'+91 88001 23456', avatar:'MJ', optIn:true,  company:''                      },
  { id:'c6',  name:'Suresh Verma',   phone:'+91 94500 67890', avatar:'SV', optIn:true,  company:''                      },
  { id:'c7',  name:'Nisha Agarwal',  phone:'+91 96001 34567', avatar:'NA', optIn:true,  company:''                      },
  { id:'c8',  name:'Kiran Patel',    phone:'+91 99001 55678', avatar:'KP', optIn:true,  company:'Patel & Sons'          },
  { id:'c9',  name:'Divya Roy',      phone:'+91 87654 32100', avatar:'DR', optIn:true,  company:'Roy Consultants'       },
  { id:'c10', name:'Amit Gupta',     phone:'+91 76543 21098', avatar:'AG', optIn:false, company:'Gupta Industries'      },
]

/* Variable label hints per template */
const TMPL_VAR_LABELS = {
  't1':  { '1':'Customer Name',   '2':'Order Number',     '3':'Delivery Date'                                                        },
  't2':  { '1':'Customer Name',   '2':'Promo Code',       '3':'Discount %',       '4':'Shop URL'                                     },
  't3':  { '1':'Date',            '2':'Time'                                                                                          },
  't4':  { '1':'Business Name',   '2':'Customer Name'                                                                                 },
  't5':  { '1':'Customer Name',   '2':'Order Number',     '3':'Tracking URL'                                                         },
  'at1': { '1':'Customer Name'                                                                                                        },
  'at2': { '1':'Customer Name'                                                                                                        },
  'at3': { '1':'Customer Name',   '2':'Credit Amount',    '3':'Expiry Date'                                                          },
  'at4': { '1':'Customer Name',   '2':'Order ID',         '3':'Delivery Date'                                                        },
  'at5': { '1':'Customer Name',   '2':'Amount Paid',      '3':'Receipt Number'                                                       },
  'at6': { '1':'Customer Name',   '2':'Store Name'                                                                                   },
  'at7': { '1':'Customer Name',   '2':'Trial Expiry Date'                                                                            },
  'at8': { '1':'Customer Name',   '2':'Invoice Number',   '3':'Invoice Amount',   '4':'Due Date',  '5':'Savings Amount'              },
  'at9': { '1':'Customer Name',   '2':'Doctor / Staff',   '3':'Appointment Date', '4':'Fee Amount'                                   },
  'at10':{ '1':'Invoice Number',  '2':'Customer Name',    '3':'Items Subtotal',   '4':'Tax Amount','5':'Grand Total','6':'Delivery Date','7':'Tracking ID' },
}

/* Header type display config */
const HEADER_TYPE_BADGE = {
  IMAGE:    { label: '🖼️ Image',    cls: 'bg-pink-50 text-pink-600'      },
  VIDEO:    { label: '🎥 Video',    cls: 'bg-purple-50 text-purple-600'  },
  DOCUMENT: { label: '📄 Document', cls: 'bg-blue-50 text-blue-600'      },
  LOCATION: { label: '📍 Location', cls: 'bg-emerald-50 text-emerald-600'},
  TEXT:     { label: '✏️ Text',     cls: 'bg-slate-100 text-slate-600'   },
}

function extractVars(body) {
  return [...new Set((body.match(/\{\{(\w+)\}\}/g) || []).map(m => m.slice(2, -2)))]
}
function fillVars(body, vals) {
  return body.replace(/\{\{(\w+)\}\}/g, (_, k) => vals[k] || `{{${k}}}`)
}
function isPhoneValid(s) { return /^\+?[\d\s\-()]{8,15}$/.test(s.trim()) }

const TMPL_CAT_COLOR = {
  MARKETING:      'bg-purple-100 text-purple-700',
  TRANSACTIONAL:  'bg-blue-100 text-blue-700',
  UTILITY:        'bg-amber-100 text-amber-700',
  AUTHENTICATION: 'bg-slate-100 text-slate-600',
}

/* ─── New Conversation Modal ─────────────────────────────────── */
function NewConversationModal({ onClose, onSend }) {
  const [step,        setStep]        = useState(1)
  const [tab,         setTab]         = useState('contacts') // 'contacts' | 'phone'
  const [search,      setSearch]      = useState('')
  // Phone-entry tab state
  const [phoneNum,    setPhoneNum]    = useState('')
  const [phoneName,   setPhoneName]   = useState('')
  const [phoneCC,     setPhoneCC]     = useState('+91')
  const [recipient,   setRecipient]   = useState(null)
  const [tSearch,     setTSearch]     = useState('')
  const [tCat,        setTCat]        = useState('ALL')
  const [template,    setTemplate]    = useState(null)
  const [varVals,     setVarVals]     = useState({})

  const vars    = template ? extractVars(template.body) : []
  const preview = template ? fillVars(template.body, varVals) : ''

  const filteredContacts = QUICK_CONTACTS.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase()) || c.phone.includes(search)
  )

  const approvedTmpl = TEMPLATES.filter(t => t.status === 'APPROVED')
  const filteredTmpl = approvedTmpl.filter(t =>
    (tCat === 'ALL' || t.category === tCat) &&
    (t.name.toLowerCase().includes(tSearch.toLowerCase()) || t.body.toLowerCase().includes(tSearch.toLowerCase()))
  )
  const categories = ['ALL', ...new Set(approvedTmpl.map(t => t.category))]

  const fullPhone      = `${phoneCC}${phoneNum.replace(/\s/g,'')}`
  const phoneReady     = phoneName.trim().length > 0 && isPhoneValid(phoneNum)

  function selectContact(c) { setRecipient(c); setStep(2) }
  function selectPhoneRecipient() {
    if (!phoneReady) return
    const initials = phoneName.trim().split(' ').map(w => w[0]).join('').slice(0,2).toUpperCase()
    setRecipient({ name: phoneName.trim(), phone: fullPhone, avatar: initials, optIn: true, manual: true })
    setStep(2)
  }
  function selectTemplate(t){ setTemplate(t); setVarVals({}); setStep(3) }
  function setVar(k, v)     { setVarVals(p => ({ ...p, [k]: v })) }
  const canSend = recipient && template && vars.every(v => varVals[v]?.trim())

  const STEPS = ['Recipient', 'Template', 'Preview & Send']

  return (
    <div className="fixed inset-0 bg-slate-900/30 z-50 flex items-center justify-center p-4" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="bg-white rounded-2xl w-full max-w-md shadow-modal flex flex-col overflow-hidden" style={{ maxHeight:'90vh' }}>

        {/* ── Header ── */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-surface-border flex-shrink-0">
          <div>
            <h3 className="font-bold text-slate-900 text-sm">New Conversation</h3>
            <div className="flex items-center gap-1.5 mt-1.5">
              {STEPS.map((s, i) => (
                <div key={s} className="flex items-center gap-1.5">
                  <div className={clsx('flex items-center gap-1',
                    i + 1 < step ? 'text-emerald-600' : i + 1 === step ? 'text-primary' : 'text-slate-300')}>
                    <div className={clsx('w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-bold border',
                      i + 1 < step  ? 'bg-emerald-500 border-emerald-500 text-white'
                      : i + 1 === step ? 'bg-primary border-primary text-white'
                      : 'border-slate-200 text-slate-400')}>
                      {i + 1 < step ? '✓' : i + 1}
                    </div>
                    <span className="text-[10px] font-semibold">{s}</span>
                  </div>
                  {i < STEPS.length - 1 && <div className={clsx('w-4 h-px', i + 1 < step ? 'bg-emerald-400' : 'bg-slate-200')} />}
                </div>
              ))}
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-surface-hover text-slate-400 hover:text-slate-600 transition-colors">
            <X size={16}/>
          </button>
        </div>

        {/* ── WhatsApp API notice ── */}
        <div className="mx-4 mt-3 flex-shrink-0 flex gap-2 p-3 bg-amber-50 border border-amber-200 rounded-xl">
          <AlertCircle size={13} className="text-amber-500 flex-shrink-0 mt-0.5"/>
          <p className="text-[11px] text-amber-800 leading-relaxed">
            WhatsApp Cloud API requires a <strong>pre-approved template</strong> to initiate conversations.
            Free-form messages are only available after the contact replies first.
          </p>
        </div>

        {/* ── Step 1: Recipient ── */}
        {step === 1 && (
          <div className="flex flex-col min-h-0 flex-1 overflow-hidden">

            {/* Tab switcher */}
            <div className="flex mx-4 mt-3 bg-slate-100 rounded-xl p-0.5 flex-shrink-0">
              {[['contacts','From Contacts', Users], ['phone','Enter Phone Number', Phone]].map(([k, lbl, Icon]) => (
                <button key={k} onClick={() => setTab(k)}
                  className={clsx('flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-[11px] font-semibold transition-all',
                    tab === k ? 'bg-white shadow-sm text-slate-800' : 'text-slate-500 hover:text-slate-700')}>
                  <Icon size={12}/>{lbl}
                </button>
              ))}
            </div>

            {/* ── Tab: From Contacts ── */}
            {tab === 'contacts' && (
              <>
                <div className="px-4 pt-3 pb-2 flex-shrink-0">
                  <div className="relative">
                    <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"/>
                    <input autoFocus value={search} onChange={e => setSearch(e.target.value)}
                      placeholder="Search by name or phone…"
                      className="input pl-9 text-sm w-full"/>
                  </div>
                </div>
                <div className="flex-1 overflow-y-auto px-4 pb-4 space-y-1">
                  {filteredContacts.map(c => (
                    <button key={c.id} onClick={() => c.optIn ? selectContact(c) : null} disabled={!c.optIn}
                      className={clsx('w-full flex items-center gap-3 px-3 py-2.5 rounded-xl border text-left transition-all',
                        c.optIn
                          ? 'border-transparent hover:bg-primary-50 hover:border-primary/20 cursor-pointer'
                          : 'border-transparent bg-slate-50 opacity-60 cursor-not-allowed')}>
                      <div className="w-9 h-9 rounded-full bg-slate-600 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                        {c.avatar}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-slate-800 truncate">{c.name}</p>
                        <p className="text-[10px] text-slate-400 font-mono">{c.phone}</p>
                        {c.company && <p className="text-[10px] text-slate-400 truncate">{c.company}</p>}
                      </div>
                      <div className="flex-shrink-0">
                        {c.optIn
                          ? <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-emerald-50 text-emerald-600 border border-emerald-200">Opted In</span>
                          : <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-red-50 text-red-500 border border-red-200">Opted Out</span>}
                      </div>
                    </button>
                  ))}
                  {filteredContacts.length === 0 && (
                    <div className="text-center py-10">
                      <Users size={24} className="text-slate-200 mx-auto mb-2"/>
                      <p className="text-xs text-slate-400">No contacts found</p>
                      <button onClick={() => setTab('phone')}
                        className="mt-2 text-[11px] text-primary hover:underline font-medium">
                        Enter a phone number instead →
                      </button>
                    </div>
                  )}
                </div>
              </>
            )}

            {/* ── Tab: Enter Phone Number ── */}
            {tab === 'phone' && (
              <div className="px-4 pt-3 pb-4 flex-1 overflow-y-auto">
                <div className="space-y-3">

                  {/* Name */}
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-500 mb-1.5">
                      Contact Name <span className="text-red-400">*</span>
                    </label>
                    <input
                      autoFocus
                      value={phoneName}
                      onChange={e => setPhoneName(e.target.value)}
                      placeholder="e.g. Arjun Sharma"
                      className="input text-sm w-full"
                      onKeyDown={e => e.key === 'Enter' && phoneReady && selectPhoneRecipient()}
                    />
                  </div>

                  {/* Phone number with country code */}
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-500 mb-1.5">
                      WhatsApp Number <span className="text-red-400">*</span>
                    </label>
                    <div className="flex gap-2">
                      <CountryCodePicker value={phoneCC} onChange={setPhoneCC} />
                      <input
                        value={phoneNum}
                        onChange={e => setPhoneNum(e.target.value.replace(/[^\d\s]/g,''))}
                        placeholder="98765 43210"
                        className="input text-sm flex-1 font-mono"
                        onKeyDown={e => e.key === 'Enter' && phoneReady && selectPhoneRecipient()}
                      />
                    </div>
                    {phoneNum.trim().length > 0 && (
                      <p className="text-[10px] text-slate-400 mt-1.5 font-mono">
                        Full number: <span className="text-slate-600 font-semibold">{fullPhone}</span>
                      </p>
                    )}
                  </div>

                  {/* Opt-in acknowledgement */}
                  <div className="flex gap-2 p-3 bg-blue-50 border border-blue-100 rounded-xl">
                    <CheckCircle2 size={13} className="text-blue-500 flex-shrink-0 mt-0.5"/>
                    <p className="text-[11px] text-blue-700 leading-relaxed">
                      By proceeding, you confirm this contact has <strong>opted in</strong> to receive WhatsApp messages from your business.
                    </p>
                  </div>

                  {/* Preview chip */}
                  {phoneReady && (
                    <div className="flex items-center gap-3 px-3 py-2.5 bg-primary-50 border border-primary/20 rounded-xl">
                      <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center text-white text-[10px] font-bold flex-shrink-0">
                        {phoneName.trim().split(' ').map(w=>w[0]).join('').slice(0,2).toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-primary truncate">{phoneName.trim()}</p>
                        <p className="text-[10px] text-primary/70 font-mono">{fullPhone}</p>
                      </div>
                      <CheckCircle2 size={14} className="text-primary flex-shrink-0"/>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── Step 2: Template ── */}
        {step === 2 && (
          <div className="flex flex-col min-h-0 flex-1 overflow-hidden">
            {/* Recipient summary */}
            <div className="mx-4 mt-3 flex-shrink-0 flex items-center gap-2.5 px-3 py-2 bg-slate-50 rounded-xl border border-surface-border">
              <div className="w-7 h-7 rounded-full bg-primary flex items-center justify-center text-white text-[10px] font-bold flex-shrink-0">
                {recipient?.avatar || recipient?.name?.[0]}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-slate-800 truncate">{recipient?.name}</p>
                <p className="text-[10px] text-slate-400 font-mono">{recipient?.phone}</p>
              </div>
              <button onClick={() => setStep(1)} className="text-[10px] text-primary hover:underline flex-shrink-0">Change</button>
            </div>

            <div className="px-4 pt-3 pb-2 flex-shrink-0 space-y-2">
              <div className="relative">
                <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400"/>
                <input value={tSearch} onChange={e => setTSearch(e.target.value)} autoFocus
                  placeholder="Search templates…" className="input-sm pl-8 w-full"/>
              </div>
              <div className="flex gap-1.5 overflow-x-auto scrollbar-hide">
                {categories.map(c => (
                  <button key={c} onClick={() => setTCat(c)}
                    className={clsx('flex-shrink-0 px-2.5 py-0.5 rounded-full text-[10px] font-semibold transition-colors',
                      tCat === c ? 'bg-primary text-white' : 'bg-slate-100 text-slate-500 hover:bg-slate-200')}>
                    {c === 'ALL' ? 'All' : c.charAt(0) + c.slice(1).toLowerCase()}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex-1 overflow-y-auto px-4 pb-4 space-y-2">
              {filteredTmpl.length === 0 && (
                <div className="text-center py-8">
                  <FileText size={24} className="text-slate-200 mx-auto mb-2"/>
                  <p className="text-xs text-slate-400">No approved templates found</p>
                </div>
              )}
              {filteredTmpl.map(t => (
                <div key={t.id} onClick={() => selectTemplate(t)}
                  className={clsx('border rounded-xl p-3 cursor-pointer transition-all group',
                    template?.id === t.id
                      ? 'border-primary bg-primary-50'
                      : 'border-surface-border hover:border-primary/30 hover:bg-slate-50')}>
                  <div className="flex items-start justify-between gap-2 mb-1.5">
                    <div className="flex items-center gap-1.5 flex-wrap min-w-0">
                      <p className="text-xs font-semibold text-slate-800 truncate">{t.name.replace(/_/g,' ')}</p>
                      <span className={clsx('text-[9px] font-bold px-1.5 py-0.5 rounded-full flex-shrink-0', TMPL_CAT_COLOR[t.category] || 'bg-slate-100 text-slate-600')}>
                        {t.category.charAt(0) + t.category.slice(1).toLowerCase()}
                      </span>
                      {t.headerType && t.headerType !== 'NONE' && HEADER_TYPE_BADGE[t.headerType] && (
                        <span className={clsx('text-[9px] font-bold px-1.5 py-0.5 rounded flex-shrink-0', HEADER_TYPE_BADGE[t.headerType].cls)}>
                          {HEADER_TYPE_BADGE[t.headerType].label}
                        </span>
                      )}
                    </div>
                    <span className="text-[9px] text-slate-400 flex-shrink-0">{t.language}</span>
                  </div>
                  <p className="text-[11px] text-slate-500 leading-relaxed line-clamp-2">{t.body}</p>
                  {extractVars(t.body).length > 0 && (
                    <p className="text-[9px] text-slate-400 mt-1.5 flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-400 inline-block"/>
                      {extractVars(t.body).length} variable{extractVars(t.body).length > 1 ? 's' : ''} to fill
                    </p>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Step 3: Fill variables + Preview ── */}
        {step === 3 && (
          <div className="flex flex-col min-h-0 flex-1 overflow-hidden">
            <div className="flex-1 overflow-y-auto px-4 py-3 space-y-4">

              {/* Recipient + Template summary row */}
              <div className="flex items-center gap-2">
                <div className="flex-1 flex items-center gap-2 px-2.5 py-2 bg-slate-50 rounded-xl border border-surface-border min-w-0">
                  <div className="w-6 h-6 rounded-full bg-primary flex items-center justify-center text-white text-[9px] font-bold flex-shrink-0">
                    {recipient?.avatar || recipient?.name?.[0]}
                  </div>
                  <p className="text-[11px] font-semibold text-slate-700 truncate">{recipient?.name}</p>
                </div>
                <ChevronRight size={12} className="text-slate-300 flex-shrink-0"/>
                <div className="flex-1 px-2.5 py-2 bg-slate-50 rounded-xl border border-surface-border min-w-0">
                  <p className="text-[11px] font-semibold text-slate-700 truncate">{template?.name.replace(/_/g,' ')}</p>
                  <span className={clsx('text-[9px] font-bold px-1.5 py-0.5 rounded-full', TMPL_CAT_COLOR[template?.category])}>
                    {template?.category?.charAt(0) + template?.category?.slice(1).toLowerCase()}
                  </span>
                </div>
                <button onClick={() => setStep(2)} className="text-[10px] text-primary hover:underline flex-shrink-0">Edit</button>
              </div>

              {/* Variables */}
              {vars.length > 0 && (
                <div className="space-y-2">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Fill Template Variables</p>
                  {vars.map(v => {
                    const lbl = TMPL_VAR_LABELS[template?.id]?.[v] || `Variable ${v}`
                    return (
                      <div key={v}>
                        <label className="block text-[11px] font-semibold text-slate-500 mb-1">
                          {lbl} <span className="font-normal text-slate-300 text-[10px]">{'{{' + v + '}}'}</span>
                        </label>
                        <input
                          value={varVals[v] || ''}
                          onChange={e => setVar(v, e.target.value)}
                          placeholder={`Enter ${lbl.toLowerCase()}…`}
                          className="input-sm w-full"
                        />
                      </div>
                    )
                  })}
                </div>
              )}

              {/* WhatsApp message preview */}
              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Message Preview</p>
                <div className="rounded-xl overflow-hidden border border-surface-border">
                  {/* WA chat header mock */}
                  <div className="flex items-center gap-2.5 px-3 py-2 bg-[#075E54]">
                    <div className="w-7 h-7 rounded-full bg-white/20 flex items-center justify-center text-white text-[10px] font-bold flex-shrink-0">
                      {recipient?.avatar || recipient?.name?.[0]}
                    </div>
                    <div>
                      <p className="text-[11px] font-semibold text-white">{recipient?.name}</p>
                      <p className="text-[9px] text-white/60">{recipient?.phone}</p>
                    </div>
                  </div>
                  {/* Chat area */}
                  <div className="bg-[#e5ddd5] px-4 py-4 min-h-[80px]">
                    <div className="max-w-[85%] ml-auto">
                      <div className="bg-[#dcf8c6] rounded-xl rounded-tr-none px-3 py-2 shadow-sm">
                        <p className="text-[12px] text-slate-800 leading-relaxed whitespace-pre-wrap">{preview || template?.body}</p>
                        <div className="flex items-center justify-end gap-1 mt-1">
                          <span className="text-[9px] text-slate-400">
                            {new Date().toLocaleTimeString([], { hour:'2-digit', minute:'2-digit' })}
                          </span>
                          <CheckCircle2 size={10} className="text-blue-500"/>
                        </div>
                      </div>
                      <p className="text-[9px] text-slate-400 text-right mt-1 px-1">Template message</p>
                    </div>
                  </div>
                </div>
              </div>

            </div>
          </div>
        )}

        {/* ── Footer ── */}
        <div className="flex items-center gap-2 px-4 py-3 border-t border-surface-border flex-shrink-0">
          {step > 1 && (
            <button onClick={() => setStep(s => s - 1)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-surface-border text-xs font-semibold text-slate-600 hover:bg-slate-50 transition-colors">
              <ChevronRight size={13} className="rotate-180"/> Back
            </button>
          )}
          <div className="flex-1"/>
          {step < 3 ? (
            <button
              disabled={step === 1 ? (tab === 'contacts' ? !recipient : !phoneReady) : !template}
              onClick={() => {
                if (step === 1 && tab === 'phone') { selectPhoneRecipient(); return }
                setStep(s => s + 1)
              }}
              className={clsx('flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold transition-colors',
                (step === 1 ? (tab === 'contacts' ? recipient : phoneReady) : template)
                  ? 'bg-primary text-white hover:bg-primary-hover'
                  : 'bg-slate-100 text-slate-400 cursor-not-allowed')}>
              Next <ChevronRight size={13}/>
            </button>
          ) : (
            <button
              disabled={!canSend}
              onClick={() => onSend({ recipient, template, varVals, preview })}
              className={clsx('flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold transition-colors',
                canSend
                  ? 'bg-emerald-600 text-white hover:bg-emerald-700'
                  : 'bg-slate-100 text-slate-400 cursor-not-allowed')}>
              <Send size={13}/> Send Template
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

/* ─── Conversation list panel ─────────────────────────────────── */
function ConversationList({ onSelect, activeId, view, setView }) {
  const {
    conversations, allConversations, search, setFilter, setSearch,
    agentFilter, setAgentFilter, setSourceFilter, setChannelFilter,
    sourceFilter, channelFilter,
    dateRange, setDateRange, dateFrom, setDateFrom, dateTo, setDateTo,
    labelFilter, setLabelFilter,
    starredOnly, setStarredOnly, unreadOnly, setUnreadOnly,
    showArchived, setShowArchived,
    customFieldFilters, setCustomFieldFilter, clearCustomFieldFilters,
    addConversation,
  } = useConversations()
  const { customFields } = useApp()
  const filterableCustomFields = customFields.contact.filter(f => f.type === 'dropdown' || f.type === 'boolean')
  const [workspace, setWorkspace]         = useState('ChatFlow')
  const [showWsMenu, setShowWsMenu]       = useState(false)
  const [showFilters, setShowFilters]     = useState(false)
  const [showNewConv, setShowNewConv]     = useState(false)
  const [activeTab, setActiveTab]         = useState('all')
  const [agentSel, setAgentSel]           = useState('all')
  const [showAgentDrop, setShowAgentDrop] = useState(false)
  const agentRef = useRef(null)

  function handleNewConversation({ recipient, template, varVals, preview }) {
    const initials = recipient.name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()
    const now      = new Date()
    const timeStr  = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    const newConv  = {
      id:          `conv-${Date.now()}`,
      name:        recipient.name,
      phone:       recipient.phone,
      avatar:      initials,
      lastMessage: preview,
      time:        'Just now',
      unread:      0,
      status:      'bot',
      tags:        [],
      agentId:     null,
      agentName:   null,
      source:      'broadcast',
      channel:     'whatsapp',
      starred:     false,
      archived:    false,
      snoozed:     null,
      timestamp:   now.toISOString(),
      labels:      [],
      messages: [
        {
          id:        `m-${Date.now()}`,
          type:      'template',
          direction: 'outgoing',
          sender:    'Agent',
          template: {
            name:     template.name.replace(/_/g, ' '),
            category: template.category,
            body:     preview,
            buttons:  [],
          },
          time: timeStr,
        },
        {
          id:    `e-${Date.now() + 1}`,
          type:  'event',
          event: 'broadcast',
          text:  `Template "${template.name.replace(/_/g, ' ')}" sent to ${recipient.name}`,
          time:  timeStr,
        },
      ],
    }
    addConversation(newConv)
    onSelect(newConv.id)
    setShowNewConv(false)
  }

  // Sync local agentSel badge with context (e.g. when sidebar sets agentFilter)
  useEffect(() => { setAgentSel(agentFilter) }, [agentFilter])

  useEffect(() => {
    function h(e) { if (agentRef.current && !agentRef.current.contains(e.target)) setShowAgentDrop(false) }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [])

  const totalUnread = allConversations.reduce((s, c) => s + (c.unread || 0), 0)
  const unassigned  = allConversations.filter(c => !c.agentId && c.status !== 'resolved').length
  const tabCounts   = {
    all:      allConversations.length,
    open:     allConversations.filter(c => c.status === 'bot' || c.status === 'agent').length,
    bot:      allConversations.filter(c => c.status === 'bot').length,
    agent:    allConversations.filter(c => c.status === 'agent').length,
    resolved: allConversations.filter(c => c.status === 'resolved').length,
    closed:   allConversations.filter(c => c.archived === true).length,
  }

  const currentAgent = agentSel === 'all'
    ? null
    : agentSel === 'unassigned'
      ? { name: 'Unassigned' }
      : AGENTS.find(a => a.id === agentSel)

  const activeFilterCount = [
    dateRange !== 'all',
    labelFilter.length > 0,
    starredOnly,
    unreadOnly,
    showArchived,
    agentSel !== 'all',
    sourceFilter !== 'all',
    channelFilter !== 'all',
    activeTab !== 'all',
    Object.keys(customFieldFilters).length > 0,
  ].filter(Boolean).length

  return (
    <div className="flex flex-col h-full border-r border-surface-border bg-white">

      {/* ── Row 1: Workspace + view toggle + actions ── */}
      <div className="flex items-center gap-1.5 px-3 py-2 border-b border-surface-border flex-shrink-0">
        {/* Workspace picker */}
        <div className="relative flex-1 min-w-0">
          <button onClick={() => setShowWsMenu(p => !p)}
            className="flex items-center gap-1 text-[13px] font-bold text-slate-800 hover:text-primary transition-colors truncate max-w-full">
            <span className="truncate">{workspace}</span>
            <ChevronDown size={11} className="text-slate-400 flex-shrink-0" />
          </button>
          {showWsMenu && (
            <div className="absolute top-full left-0 mt-1 w-36 bg-white rounded-xl shadow-modal border border-surface-border z-20 py-1">
              {['ChatFlow', 'Support', 'Sales'].map(w => (
                <button key={w} onClick={() => { setWorkspace(w); setShowWsMenu(false) }}
                  className="w-full text-left px-3 py-1.5 text-xs hover:bg-surface-hover text-slate-700">{w}</button>
              ))}
            </div>
          )}
        </div>

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

        {/* Actions */}
        <div className="flex items-center gap-0.5 flex-shrink-0">
          <button className="p-1.5 rounded-lg text-slate-400 hover:bg-surface-hover hover:text-slate-600 transition-colors"><RefreshCw size={11} /></button>
          <button onClick={() => setShowNewConv(true)} title="Start new conversation"
            className="p-1.5 rounded-md bg-primary text-white hover:bg-primary-hover transition-colors"><Plus size={12} /></button>
        </div>
      </div>

      {/* ── Row 2: Search + agent filter ── */}
      <div className="flex items-center gap-1.5 px-3 py-1.5 border-b border-surface-border flex-shrink-0">
        <div className="relative flex-1">
          <Search size={11} className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          <input
            className="w-full pl-6 pr-2 py-1 text-[11px] bg-slate-50 border border-surface-border rounded-lg placeholder-slate-400 focus:outline-none focus:border-primary/40 focus:bg-white transition-colors"
            placeholder="Search…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>

        {/* Agent filter inline — compact */}
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
                  <span className="text-[9px] text-slate-400 flex-shrink-0">{a.assigned}</span>
                </button>
              ))}
              <div className="border-t border-surface-border my-0.5" />
              <button onClick={() => { setAgentSel('unassigned'); setAgentFilter('unassigned'); setShowAgentDrop(false) }}
                className="w-full text-left px-3 py-1.5 text-xs hover:bg-surface-hover text-amber-600 flex items-center gap-2">
                <AlertCircle size={11} /> Unassigned
                {unassigned > 0 && <span className="ml-auto text-[9px] font-bold bg-amber-100 text-amber-600 px-1.5 rounded-full">{unassigned}</span>}
              </button>
            </div>
          )}
        </div>

        {/* Filters toggle button */}
        <div className="relative flex-shrink-0">
          <button
            onClick={() => setShowFilters(p => !p)} title="Filters"
            className={clsx('relative flex items-center justify-center w-7 h-7 rounded-lg border transition-colors',
              showFilters ? 'border-primary/40 bg-primary-50 text-primary' : 'border-surface-border bg-white text-slate-500 hover:border-primary/30 hover:text-slate-700')}>
            <Filter size={13} />
            {activeFilterCount > 0 && (
              <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-primary border border-white" />
            )}
          </button>
          {showFilters && (
            <AdvancedFilterPanel
              dateRange={dateRange} setDateRange={setDateRange}
              dateFrom={dateFrom} setDateFrom={setDateFrom}
              dateTo={dateTo} setDateTo={setDateTo}
              labelFilter={labelFilter} setLabelFilter={setLabelFilter}
              starredOnly={starredOnly} setStarredOnly={setStarredOnly}
              unreadOnly={unreadOnly} setUnreadOnly={setUnreadOnly}
              showArchived={showArchived} setShowArchived={setShowArchived}
              sourceFilter={sourceFilter} setSourceFilter={setSourceFilter}
              agentSel={agentSel} setAgentSel={setAgentSel} setAgentFilter={setAgentFilter}
              setFilter={val => { setActiveTab(val); setFilter(val) }}
              currentStatus={activeTab}
              customFieldDefs={filterableCustomFields}
              customFieldFilters={customFieldFilters}
              setCustomFieldFilter={setCustomFieldFilter}
              onClear={() => {
                setDateRange('all'); setDateFrom(''); setDateTo('')
                setLabelFilter([]); setStarredOnly(false); setUnreadOnly(false)
                setShowArchived(false); setSourceFilter('all')
                setChannelFilter('all')
                setAgentSel('all'); setAgentFilter('all')
                setActiveTab('all'); setFilter('all')
                clearCustomFieldFilters()
              }}
              onClose={() => setShowFilters(false)}
            />
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto divide-y divide-surface-border/40">
        {conversations.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 text-center px-4">
            <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mb-3">
              <MessageCircle size={20} className="text-slate-300" />
            </div>
            <p className="text-xs font-semibold text-slate-600">No chats found</p>
            <p className="text-xs text-slate-400 mt-1">Try a different filter</p>
          </div>
        )}
        {conversations.map(c => {
          const sm = STATUS_MAP[c.status] || STATUS_MAP.bot
          const isActive = c.id === activeId
          const src = CTWA_SOURCES.find(s => s.key === c.source)
          return (
            <div key={c.id} onClick={() => onSelect(c.id)}
              className={clsx('flex items-start gap-2.5 px-3 py-2.5 cursor-pointer transition-colors relative',
                isActive ? 'bg-primary-50' : 'hover:bg-surface-hover')}>
              {isActive && <span className="absolute left-0 top-0 bottom-0 w-0.5 bg-primary rounded-r" />}
              <div className="relative flex-shrink-0">
                <div className={clsx('w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold text-white',
                  isActive ? 'bg-primary' : 'bg-slate-600')}>
                  {c.avatar}
                </div>
                <span className={clsx('absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full border-2 border-white', sm.dot)} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-0.5">
                  <div className="flex items-center gap-1">
                    <span className={clsx('text-[12px] font-semibold truncate', c.unread > 0 ? 'text-slate-900' : 'text-slate-700')}>{c.name}</span>
                    {c.starred && <Star size={10} className="text-amber-400 fill-amber-400 flex-shrink-0" />}
                  </div>
                  <span className="text-[10px] text-slate-400 flex-shrink-0 ml-1">{c.time}</span>
                </div>
                <div className={clsx('text-[11px] truncate flex items-center gap-1', c.unread > 0 ? 'text-slate-700' : 'text-slate-400')}>
                  {c.channel === 'calls' && (
                    c.lastMessage?.includes('Missed') || c.lastMessage?.includes('missed')
                      ? <PhoneMissed size={11} className="text-red-400 flex-shrink-0" />
                      : <PhoneIncoming size={11} className="text-emerald-500 flex-shrink-0" />
                  )}
                  <span className="truncate">{c.lastMessage}</span>
                </div>
                <div className="flex items-center justify-between mt-1">
                  <div className="flex items-center gap-1 flex-wrap">
                    {c.agentName && (
                      <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-blue-50 text-blue-600 border border-blue-100 font-medium">{c.agentName.split(' ')[0]}</span>
                    )}
                    {src && (
                      <span className={clsx('text-[9px] px-1.5 py-0.5 rounded border font-bold', src.bg, src.color)}>{src.label}</span>
                    )}
                    {c.tags.slice(0, 1).map(t => (
                      <span key={t} className="text-[9px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-500">#{t}</span>
                    ))}
                  </div>
                  {c.unread > 0 && (
                    <span className="min-w-[16px] h-4 rounded-full bg-primary flex items-center justify-center text-white text-[9px] font-bold px-1">{c.unread}</span>
                  )}
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {showNewConv && (
        <NewConversationModal
          onClose={() => setShowNewConv(false)}
          onSend={handleNewConversation}
        />
      )}
    </div>
  )
}

/* ─── Insights panel ──────────────────────────────────────────── */
function InsightsPanel({ adminOnline }) {
  const { allConversations } = useConversations()
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
          <div className="grid grid-cols-4 gap-3">
            {[
              { label: 'Open Chats',   value: open,        Icon: MessageSquare, color: '#0066ff'  },
              { label: 'Bot Handling', value: botActive,   Icon: Bot,           color: '#8B5CF6'  },
              { label: 'With Agent',   value: agentActive, Icon: UserCheck,     color: '#22C55E'  },
              { label: 'Unassigned',   value: unassigned,  Icon: AlertCircle,   color: '#F59E0B'  },
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
                  {['Agent', 'Active', 'Pending', 'Assigned', 'Resolved', 'Avg Reply', 'CSAT', 'Actions'].map((h, i) => (
                    <th key={h} className={clsx('px-4 py-2.5 text-slate-500 font-semibold', i === 0 ? 'text-left' : i === 7 ? 'text-right pr-4' : 'text-center')}>{h}</th>
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
                    <td className="px-3 py-3 text-center">
                      <span className={clsx('inline-flex items-center justify-center w-6 h-6 rounded-full text-[10px] font-bold', a.pending > 0 ? 'bg-amber-50 text-amber-700' : 'bg-slate-100 text-slate-400')}>{a.pending}</span>
                    </td>
                    <td className="px-3 py-3 text-center font-bold text-slate-800">{a.assigned}</td>
                    <td className="px-3 py-3 text-center font-bold text-emerald-600">{a.resolved}</td>
                    <td className="px-3 py-3 text-center text-slate-600">{a.avgReply}</td>
                    <td className="px-3 py-3 text-center">
                      <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold text-amber-600">
                        <span>★</span>{a.csat}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button className="text-[10px] px-2.5 py-1 rounded-lg bg-primary-50 text-primary border border-primary/20 hover:bg-primary hover:text-white transition-colors font-medium">View Chats</button>
                    </td>
                  </tr>
                ))}
                {adminOnline && (
                  <tr className="bg-primary-50/50">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2.5">
                        <div className="relative">
                          <div className="w-8 h-8 rounded-full bg-slate-600 flex items-center justify-center text-white text-[10px] font-bold">DK</div>
                          <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-white bg-emerald-500" />
                        </div>
                        <div>
                          <div className="flex items-center gap-1.5">
                            <p className="font-semibold text-slate-800">Deepak Kumar</p>
                            <span className="text-[9px] bg-primary text-white px-1.5 py-0.5 rounded font-bold">YOU</span>
                          </div>
                          <p className="text-[10px] text-slate-400">Admin</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-3 text-center">
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> Online
                      </span>
                    </td>
                    <td colSpan={6} className="px-4 py-3 text-center text-xs text-slate-400 italic">Admin — can handle any chat</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
        <div>
          <h3 className="text-xs font-bold text-slate-800 mb-3 flex items-center gap-2"><TrendingUp size={14} className="text-primary" /> Ad Source Breakdown</h3>
          <div className="grid grid-cols-3 gap-3">
            {CTWA_SOURCES.map(src => {
              const count = allConversations.filter(c => c.source === src.key).length
              return (
                <div key={src.key} className="bg-white border border-surface-border rounded-xl p-4 flex flex-col gap-2.5">
                  <div className="flex items-center justify-between">
                    <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: '#f5f5f5' }}>
                      <Megaphone size={13} style={{ color: '#374151' }} />
                    </div>
                    <span className={clsx('text-[9px] font-bold px-1.5 py-0.5 rounded-full border', src.color, 'border-current bg-white')}>{src.label}</span>
                  </div>
                  <div>
                    <p className="text-[20px] font-bold leading-none text-slate-800">{count}</p>
                    <p className="text-[10px] font-medium text-slate-400 mt-1">{src.full}</p>
                    <p className="text-[9px] text-slate-300 mt-0.5">{src.desc}</p>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
        <div>
          <h3 className="text-xs font-bold text-slate-800 mb-3 flex items-center gap-2"><BarChart2 size={14} className="text-primary" /> Today's Summary</h3>
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: 'Avg First Response', value: '2.8 min', Icon: Clock        },
              { label: 'Resolution Rate',    value: '76%',     Icon: CheckCircle2 },
              { label: 'CSAT Score',         value: '4.6 / 5', Icon: ThumbsUp     },
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
      </div>
    </div>
  )
}

/* ─── Chat Window ─────────────────────────────────────────────── */
function ChatWindow({ conversation, adminOnline, showPanel, onTogglePanel }) {
  const { initiateCall, activeCall } = useCall()
  const [showDialer, setShowDialer]         = useState(false)
  const [message, setMessage]               = useState('')
  const [replyMode, setReplyMode]           = useState('reply')
  const [showCanned, setShowCanned]         = useState(false)
  const [showTemplate, setShowTemplate]     = useState(false)
  const [showTransfer, setShowTransfer]     = useState(false)
  const [showReassign, setShowReassign]     = useState(false)
  const [showSnooze, setShowSnooze]         = useState(false)
  const [showMoreActions, setShowMoreActions] = useState(false)
  const [showLabelPicker, setShowLabelPicker] = useState(false)
  const [showEmoji, setShowEmoji]           = useState(false)
  const [showTranslate, setShowTranslate]   = useState(false)
  const [archiveConfirm, setArchiveConfirm] = useState(false)

  const {
    sendMessage, takeoverConversation, resolveConversation, returnToBot,
    assignAgent, toggleStar, archiveConversation, snoozeConversation, addNote,
  } = useConversations()

  const msgsRef   = useRef(null)
  const moreRef   = useRef(null)
  const labelRef  = useRef(null)
  const snoozeRef = useRef(null)
  const emojiRef  = useRef(null)

  // Scroll messages container directly — avoids scrollIntoView bubbling up through overflow:hidden parents
  useEffect(() => {
    if (msgsRef.current) msgsRef.current.scrollTop = msgsRef.current.scrollHeight
  }, [conversation?.messages])

  useEffect(() => {
    function h(e) {
      if (moreRef.current  && !moreRef.current.contains(e.target))  setShowMoreActions(false)
      if (labelRef.current && !labelRef.current.contains(e.target))  setShowLabelPicker(false)
      if (emojiRef.current && !emojiRef.current.contains(e.target))  setShowEmoji(false)
    }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [])

  if (!conversation) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center bg-[#f7f8fc] text-center p-8">
        <div className="w-20 h-20 rounded-2xl bg-white border border-surface-border flex items-center justify-center mb-5">
          <MessageCircle size={32} className="text-slate-200" />
        </div>
        <p className="font-semibold text-slate-600">Select a conversation</p>
        <p className="text-sm text-slate-400 mt-1.5 max-w-xs">Choose from the list on the left to start</p>
        <div className="mt-5 flex items-center gap-2 text-xs text-slate-400 bg-white px-4 py-2 rounded-full border border-surface-border">
          <ShieldCheck size={13} className="text-primary" />
          Admin view — reply to any conversation
        </div>
      </div>
    )
  }

  const sm  = STATUS_MAP[conversation.status]
  const src = CTWA_SOURCES.find(s => s.key === conversation.source)

  function handleSend() {
    if (!message.trim()) return
    if (replyMode === 'note') {
      addNote(conversation.id, message, 'Deepak Kumar')
    } else {
      sendMessage(conversation.id, message)
    }
    setMessage('')
    setShowCanned(false)
    setShowTemplate(false)
  }

  function renderMessage(m) {
    // Event bubble
    if (m.type === 'event') {
      return (
        <div key={m.id} className="flex items-center justify-center my-3">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-100 border border-slate-200 text-xs text-slate-500">
            {m.event === 'ctwa_entry' && (
              <span className="text-blue-600 font-bold text-[10px] px-2 py-0.5 rounded bg-blue-50 border border-blue-200 mr-1">AD</span>
            )}
            {m.event === 'assigned'       && <UserCheck size={11} className="text-emerald-500" />}
            {m.event === 'bot_handover'   && <Bot size={11} className="text-primary" />}
            {m.event === 'ctwa_entry'     && <Globe size={11} className="text-blue-500" />}
            {m.event === 'call_answered'  && <Phone size={11} className="text-emerald-500" />}
            {m.event === 'call_missed'    && <PhoneMissed size={11} className="text-red-400" />}
            {m.event === 'call_ended'     && <Phone size={11} className="text-slate-400" />}
            {m.text}
          </div>
        </div>
      )
    }

    // Template message
    if (m.type === 'template') {
      const { template } = m
      return (
        <div key={m.id} className="flex justify-end my-2">
          <div className="max-w-xs rounded-2xl border border-surface-border bg-white overflow-hidden">
            <div className="flex items-center justify-between px-3 pt-2.5 pb-1">
              <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Template</span>
              <span className="badge badge-blue text-[9px]">{template.category}</span>
            </div>
            <div className="px-3 pb-1"><p className="font-bold text-slate-900 text-xs">{template.header}</p></div>
            <div className="px-3 pb-2"><p className="text-xs text-slate-700 leading-relaxed">{template.body}</p></div>
            {template.footer && <div className="px-3 pb-1.5"><p className="text-[10px] text-slate-400">{template.footer}</p></div>}
            {template.buttons?.length > 0 && (
              <div className="border-t border-surface-border">
                {template.buttons.map((btn, i) => (
                  <button key={i} className={clsx('w-full py-2 text-xs font-semibold text-primary hover:bg-primary-50 transition-colors', i > 0 ? 'border-t border-surface-border' : '')}>{btn}</button>
                ))}
              </div>
            )}
            <div className="px-3 pb-2 text-right"><span className="text-[10px] text-slate-400">{m.time}</span></div>
          </div>
        </div>
      )
    }

    // Private note
    if (m.type === 'note') {
      return (
        <div key={m.id} className="flex justify-end my-2">
          <div className="max-w-[72%]">
            <div className="flex items-center justify-end gap-1 mb-0.5">
              <span className="text-[10px] text-amber-600 font-medium">🔒 Private Note · {m.sender}</span>
            </div>
            <div className="bg-amber-50 border border-amber-200 rounded-2xl rounded-tr-sm px-3 py-2">
              <p className="text-xs text-amber-900 leading-relaxed">{m.text}</p>
              <p className="text-[9px] text-amber-500 mt-1 text-right">{m.time}</p>
            </div>
          </div>
        </div>
      )
    }

    // Button reply
    if (m.isButtonReply) {
      return (
        <div key={m.id} className="flex justify-start my-1">
          <div className="max-w-[72%]">
            <div className="flex items-center gap-1 mb-0.5">
              <span className="text-[9px] text-slate-400 flex items-center gap-0.5">↩ Quick Reply</span>
            </div>
            <div className="bg-white rounded-2xl rounded-tl-sm px-3 py-1.5 border border-primary/30 shadow-sm">
              <p className="text-xs text-primary font-medium">{m.text}</p>
            </div>
          </div>
        </div>
      )
    }

    // Regular incoming / outgoing
    const isIncoming = m.type === 'incoming'
    return (
      <div key={m.id} className={clsx('flex items-end gap-2', isIncoming ? 'justify-start' : 'justify-end')}>
        {isIncoming && (
          <div className="w-6 h-6 rounded-full bg-slate-400 flex items-center justify-center text-white text-[10px] font-bold flex-shrink-0">
            {conversation.avatar[0]}
          </div>
        )}
        <div className="max-w-[72%]">
          {isIncoming && showTranslate && (
            <div className="text-[9px] text-blue-600 mb-0.5 flex items-center gap-1">
              <Globe size={9} /> Translated from Hindi
            </div>
          )}
          <div className={clsx('rounded-2xl px-3 py-2 shadow-sm',
            isIncoming        ? 'bg-white text-slate-800 rounded-tl-sm'
            : m.sender === 'Bot' ? 'bg-primary text-white rounded-tr-sm'
            : 'bg-emerald-500 text-white rounded-tr-sm')}>
            {!isIncoming && (
              <p className="text-[9px] font-medium mb-0.5 opacity-70">
                {m.sender === 'Bot' ? '🤖 Bot' : m.agentName ? `👤 ${m.agentName}` : '👤 Agent'}
              </p>
            )}
            <p className="text-xs leading-relaxed">{m.text}</p>
            <p className={clsx('text-[9px] mt-1 text-right', isIncoming ? 'text-slate-400' : 'opacity-60')}>{m.time}</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex-1 flex flex-col bg-white min-w-0 relative">
      {/* ── Chat header ── */}
      <div className="flex items-center px-3 py-2 border-b border-surface-border bg-white flex-shrink-0 gap-2 min-w-0">

        {/* Left: avatar + contact info (single row, no wrap) */}
        <div className="flex items-center gap-2.5 min-w-0 flex-1">
          <div className="relative flex-shrink-0">
            <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center text-white text-xs font-bold">{conversation.avatar}</div>
            <span className={clsx('absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full border-2 border-white', sm.dot)} />
          </div>
          <div className="min-w-0 flex-1">
            {/* Row 1: name + status badge — NO wrap */}
            <div className="flex items-center gap-1.5 min-w-0">
              <p className="font-semibold text-slate-900 text-[13px] leading-none truncate">{conversation.name}</p>
              <span className={clsx('badge text-[9px] flex-shrink-0', sm.badge)}>{sm.label}</span>
              {conversation.snoozed && <BellOff size={9} className="text-amber-500 flex-shrink-0" />}
            </div>
            {/* Row 2: phone only — clean, no agent name inline */}
            <p className="text-[11px] text-slate-400 mt-0.5 truncate">{conversation.phone}</p>
          </div>
        </div>

        {/* Right: max 4 items — primary action + labels + more + panel toggle */}
        <div className="flex items-center gap-1 flex-shrink-0">

          {/* Single primary action button — Take Over only (Resolve/Reopen live in ⋮ menu) */}
          {conversation.status === 'bot' && (
            <button onClick={() => takeoverConversation(conversation.id)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary text-white hover:bg-primary-hover text-xs font-semibold transition-colors whitespace-nowrap">
              <UserCheck size={12} /> Take Over
            </button>
          )}

          {/* 📞 Call button */}
          <div className="relative">
            <button
              onClick={() => setShowDialer(p => !p)}
              title="Start WhatsApp call"
              className={clsx(
                'p-1.5 rounded-lg transition-colors',
                showDialer ? 'bg-emerald-50 text-emerald-600' : 'hover:bg-surface-hover text-slate-400 hover:text-emerald-500'
              )}
            >
              <Phone size={14} />
            </button>

            {/* Mini dialer modal */}
            {showDialer && (
              <div className="absolute top-full right-0 mt-1 w-64 bg-white rounded-xl shadow-modal border border-surface-border z-30 animate-fade-in p-4">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-bold text-slate-800">WhatsApp Call</span>
                  <button onClick={() => setShowDialer(false)} className="text-slate-300 hover:text-slate-500 p-0.5">
                    <X size={13} />
                  </button>
                </div>
                {/* Contact info */}
                <div className="flex items-center gap-2.5 mb-3 p-2.5 bg-slate-50 rounded-lg">
                  <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary flex-shrink-0">
                    {(conversation.contact?.charAt(0) || '?').toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-slate-800 truncate">{conversation.contact}</p>
                    <p className="text-[10px] font-mono text-slate-400">{conversation.phone || '+91 XXXXX XXXXX'}</p>
                  </div>
                </div>
                {/* Opt-in badge */}
                <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-emerald-50 text-emerald-700 text-[11px] font-medium mb-3">
                  <CheckCircle2 size={12} /> Opted in for WhatsApp calls
                </div>
                {/* Buttons */}
                <div className="flex gap-2">
                  <button
                    disabled={!!activeCall}
                    onClick={() => {
                      initiateCall({ name: conversation.contact, phone: conversation.phone || '+91 00000 00000' })
                      setShowDialer(false)
                    }}
                    className={clsx(
                      'flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-semibold transition-colors',
                      activeCall
                        ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                        : 'bg-emerald-500 hover:bg-emerald-600 text-white'
                    )}
                  >
                    <Phone size={13} /> {activeCall ? 'Call in progress' : 'Start Call'}
                  </button>
                  <button onClick={() => setShowDialer(false)}
                    className="px-3 py-2 rounded-lg text-xs font-medium text-slate-500 hover:bg-slate-50 transition-colors border border-surface-border">
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Label picker */}
          <div ref={labelRef} className="relative">
            <button onClick={() => setShowLabelPicker(p => !p)} title="Labels"
              className={clsx('p-1.5 rounded-lg transition-colors', showLabelPicker ? 'bg-primary-50 text-primary' : 'hover:bg-surface-hover text-slate-400 hover:text-slate-600')}>
              <Tag size={13} />
            </button>
            {showLabelPicker && conversation && (
              <LabelPicker conversation={conversation} onClose={() => setShowLabelPicker(false)} />
            )}
          </div>

          {/* ⋮ More — all secondary actions live here */}
          <div ref={moreRef} className="relative">
            <button onClick={() => setShowMoreActions(p => !p)}
              className="p-1.5 rounded-lg hover:bg-surface-hover text-slate-400 hover:text-slate-600 transition-colors">
              <MoreVertical size={14} />
            </button>
            {showMoreActions && (
              <div className="absolute top-full right-0 mt-1 w-52 bg-white rounded-xl shadow-modal border border-surface-border z-30 py-1 animate-fade-in">
                {/* ── Resolution actions (always visible, state-aware) ── */}
                <button
                  disabled={conversation.status === 'resolved'}
                  onClick={() => { resolveConversation(conversation.id); setShowMoreActions(false) }}
                  className={clsx('w-full flex items-center gap-2.5 px-3 py-2 text-xs font-medium transition-colors',
                    conversation.status === 'resolved'
                      ? 'text-emerald-400 cursor-default bg-emerald-50/60'
                      : 'text-emerald-700 hover:bg-emerald-50')}>
                  <CheckCircle2 size={13} className={conversation.status === 'resolved' ? 'text-emerald-400' : 'text-emerald-500'} />
                  Mark as Resolved
                  {conversation.status === 'resolved' && <span className="ml-auto text-[10px] font-normal text-emerald-500">✓ Active</span>}
                </button>
                <button
                  disabled={conversation.status !== 'resolved'}
                  onClick={() => { returnToBot(conversation.id); setShowMoreActions(false) }}
                  className={clsx('w-full flex items-center gap-2.5 px-3 py-2 text-xs font-medium transition-colors',
                    conversation.status !== 'resolved'
                      ? 'text-slate-300 cursor-default'
                      : 'text-amber-700 hover:bg-amber-50')}>
                  <CircleDashed size={13} className={conversation.status !== 'resolved' ? 'text-slate-300' : 'text-amber-500'} />
                  Mark as Unresolved
                </button>
                <button
                  disabled={conversation.status !== 'resolved'}
                  onClick={() => { takeoverConversation(conversation.id); setShowMoreActions(false) }}
                  className={clsx('w-full flex items-center gap-2.5 px-3 py-2 text-xs font-medium transition-colors',
                    conversation.status !== 'resolved'
                      ? 'text-slate-300 cursor-default'
                      : 'text-slate-700 hover:bg-surface-hover')}>
                  <RotateCcw size={13} className={conversation.status !== 'resolved' ? 'text-slate-200' : 'text-slate-400'} />
                  Reopen Chat
                </button>
                <div className="border-t border-surface-border my-1" />

                {/* Status-based secondary actions */}
                {conversation.status === 'agent' && (
                  <button onClick={() => { returnToBot(conversation.id); setShowMoreActions(false) }}
                    className="w-full flex items-center gap-2.5 px-3 py-2 text-xs text-slate-700 hover:bg-surface-hover transition-colors">
                    <Bot size={13} className="text-slate-400" /> Return to Bot
                  </button>
                )}
                {conversation.status !== 'resolved' && (
                  <button onClick={() => { setShowTransfer(true); setShowMoreActions(false) }}
                    className="w-full flex items-center gap-2.5 px-3 py-2 text-xs text-slate-700 hover:bg-surface-hover transition-colors">
                    <ArrowRightLeft size={13} className="text-slate-400" /> Transfer conversation
                  </button>
                )}
                <button onClick={() => { toggleStar(conversation.id); setShowMoreActions(false) }}
                  className={clsx('w-full flex items-center gap-2.5 px-3 py-2 text-xs hover:bg-surface-hover transition-colors', conversation.starred ? 'text-amber-500' : 'text-slate-700')}>
                  <Star size={13} className={conversation.starred ? 'fill-amber-400 text-amber-400' : 'text-slate-400'} />
                  {conversation.starred ? 'Unstar' : 'Star'}
                </button>
                <button onClick={() => { setShowSnooze(true); setShowMoreActions(false) }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 text-xs text-slate-700 hover:bg-surface-hover transition-colors">
                  <BellOff size={13} className="text-slate-400" /> Snooze
                </button>
                <button onClick={() => { setShowTranslate(p => !p); setShowMoreActions(false) }}
                  className={clsx('w-full flex items-center gap-2.5 px-3 py-2 text-xs hover:bg-surface-hover transition-colors', showTranslate ? 'text-blue-600' : 'text-slate-700')}>
                  <Globe size={13} className={showTranslate ? 'text-blue-500' : 'text-slate-400'} />
                  {showTranslate ? 'Hide Translation' : 'Translate'}
                </button>
                <button onClick={() => { setShowTemplate(true); setShowMoreActions(false) }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 text-xs text-slate-700 hover:bg-surface-hover transition-colors">
                  <FileText size={13} className="text-slate-400" /> Send Template
                </button>
                <button className="w-full flex items-center gap-2.5 px-3 py-2 text-xs text-slate-700 hover:bg-surface-hover transition-colors">
                  <Phone size={13} className="text-slate-400" /> Call Contact
                </button>
                <div className="border-t border-surface-border my-1" />
                <button onClick={() => { setArchiveConfirm(true); setShowMoreActions(false) }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 text-xs text-red-500 hover:bg-red-50 transition-colors">
                  <Archive size={13} className="text-red-400" /> Archive
                </button>
              </div>
            )}
          </div>

          {/* Panel toggle */}
          <button onClick={onTogglePanel} title={showPanel ? 'Hide info panel' : 'Show info panel'}
            className={clsx('p-1.5 rounded-lg transition-colors border', showPanel ? 'bg-primary-50 text-primary border-primary/20' : 'border-transparent hover:bg-surface-hover text-slate-400 hover:text-slate-600')}>
            <ChevronRight size={13} className={clsx('transition-transform duration-200', showPanel ? 'rotate-0' : 'rotate-180')} />
          </button>
        </div>
      </div>

      {/* Archive confirm banner */}
      {archiveConfirm && (
        <div className="flex items-center gap-3 px-4 py-2.5 bg-amber-50 border-b border-amber-200 flex-shrink-0">
          <Archive size={13} className="text-amber-600" />
          <span className="text-xs text-amber-800 font-medium flex-1">Archive this conversation? It will be moved to archived chats.</span>
          <button onClick={() => { archiveConversation(conversation.id); setArchiveConfirm(false) }}
            className="text-xs font-semibold text-white bg-amber-500 hover:bg-amber-600 px-3 py-1 rounded-lg transition-colors">Archive</button>
          <button onClick={() => setArchiveConfirm(false)} className="text-xs text-slate-500 hover:text-slate-700 font-medium">Cancel</button>
        </div>
      )}

      {/* Status bar */}
      {conversation.status === 'bot' && (
        <div className="flex items-center gap-2 px-4 py-2 bg-primary-50 border-b border-primary/10 flex-shrink-0">
          <Bot size={13} className="text-primary" />
          <span className="text-xs text-primary font-medium">Bot is handling this conversation</span>
          <button onClick={() => takeoverConversation(conversation.id)} className="ml-auto text-xs text-primary font-semibold hover:underline">Take over →</button>
        </div>
      )}
      {conversation.status === 'agent' && (
        <div className="flex items-center gap-2 px-4 py-2 bg-emerald-50 border-b border-emerald-100 flex-shrink-0">
          <UserCheck size={13} className="text-emerald-600" />
          <span className="text-xs text-emerald-700 font-medium">{conversation.agentName || 'Agent'} is handling this conversation</span>
          <div className="ml-auto">
            <button onClick={() => setShowReassign(true)}
              className="text-xs px-3 py-1 rounded-lg border border-emerald-200 bg-white text-emerald-700 hover:bg-emerald-50 hover:border-emerald-300 transition-colors font-medium flex items-center gap-1.5">
              <UserPlus size={11} /> Reassign
            </button>
          </div>
        </div>
      )}

      {/* Translate banner */}
      {showTranslate && (
        <div className="flex items-center gap-2 px-4 py-2 bg-blue-50 border-b border-blue-100 flex-shrink-0">
          <Globe size={13} className="text-blue-500" />
          <span className="text-xs text-blue-700 font-medium">Translating incoming messages from Hindi to English</span>
          <button onClick={() => setShowTranslate(false)} className="ml-auto text-xs text-blue-600 hover:underline font-medium">Disable</button>
        </div>
      )}

      {/* Messages */}
      <div ref={msgsRef} className="flex-1 overflow-y-auto px-5 py-4 space-y-2 bg-[#f0f4f8]">
        {conversation.messages.map(m => renderMessage(m))}
      </div>

      {/* Canned responses */}
      {showCanned && (
        <div className="border-t border-surface-border bg-slate-50 px-4 pt-3 pb-2 flex-shrink-0">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-semibold text-slate-700 flex items-center gap-1.5"><Zap size={12} className="text-primary" /> Canned Responses</p>
            <button onClick={() => setShowCanned(false)} className="text-slate-400 hover:text-slate-600"><X size={13} /></button>
          </div>
          <div className="space-y-1 max-h-32 overflow-y-auto">
            {CANNED.map(c => (
              <button key={c.key} onClick={() => { setMessage(c.body); setShowCanned(false) }}
                className="w-full text-left px-3 py-2 rounded-lg bg-white border border-surface-border hover:border-primary hover:bg-primary-50/60 transition-all group">
                <p className="text-[11px] font-semibold text-slate-700 group-hover:text-primary">{c.label}</p>
                <p className="text-[10px] text-slate-400 truncate mt-0.5">{c.body}</p>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Template picker */}
      {showTemplate && (
        <TemplatePicker onSelect={body => { setMessage(body); setShowTemplate(false) }} onClose={() => setShowTemplate(false)} />
      )}

      {/* Composer */}
      <div className="border-t border-surface-border bg-white flex-shrink-0">
        <div className="flex items-center px-3 py-2 border-b border-surface-border">
          <div className="flex items-center gap-0.5 bg-slate-100 p-0.5 rounded-lg w-fit">
            {[['reply', 'Reply'], ['note', 'Private Note']].map(([k, lbl]) => (
              <button key={k} onClick={() => setReplyMode(k)}
                className={clsx('px-3 py-1 text-[11px] font-semibold rounded-md transition-all',
                  replyMode === k ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700')}>
                {lbl}
              </button>
            ))}
          </div>
          <div className="ml-auto flex items-center gap-1 py-1.5">
            {[Bold, Italic, AtSign].map((Icon, i) => (
              <button key={i} className="p-1.5 rounded hover:bg-surface-hover text-slate-400 hover:text-slate-600 transition-colors"><Icon size={13} /></button>
            ))}
          </div>
        </div>

        <div className="px-3 py-2.5">
          <div className={clsx('flex items-end gap-2 rounded-xl px-3 py-2 border',
            replyMode === 'note' ? 'bg-amber-50 border-amber-200' : 'bg-surface border-surface-border')}>
            <div className="flex items-center gap-0.5 pb-0.5">
              <button onClick={() => { setShowCanned(p => !p); setShowTemplate(false) }}
                title="Canned Responses"
                className={clsx('p-1.5 rounded-lg transition-colors', showCanned ? 'bg-primary-50 text-primary' : 'hover:bg-surface-hover text-slate-400 hover:text-primary')}>
                <Zap size={15} />
              </button>
              <button onClick={() => { setShowTemplate(p => !p); setShowCanned(false) }}
                title="Send Template"
                className={clsx('p-1.5 rounded-lg transition-colors', showTemplate ? 'bg-primary-50 text-primary' : 'hover:bg-surface-hover text-slate-400 hover:text-primary')}>
                <FileText size={15} />
              </button>
              <button className="p-1.5 rounded-lg hover:bg-surface-hover text-slate-400 hover:text-slate-600 transition-colors"><Paperclip size={15} /></button>
              <button className="p-1.5 rounded-lg hover:bg-surface-hover text-slate-400 hover:text-slate-600 transition-colors"><Image size={15} /></button>
            </div>

            <textarea
              value={message}
              onChange={e => setMessage(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend() } }}
              placeholder={replyMode === 'note' ? 'Write a private note…' : 'Type a message…'}
              rows={1}
              className={clsx('flex-1 bg-transparent text-xs placeholder-slate-400 resize-none focus:outline-none py-0.5 min-h-[24px] max-h-28',
                replyMode === 'note' ? 'text-amber-900' : 'text-slate-800')}
            />

            <div className="flex items-center gap-0.5 pb-0.5">
              {/* Emoji picker */}
              <div ref={emojiRef} className="relative">
                <button onClick={() => setShowEmoji(p => !p)}
                  className={clsx('p-1.5 rounded-lg transition-colors', showEmoji ? 'bg-primary-50 text-primary' : 'hover:bg-surface-hover text-slate-400 hover:text-slate-600')}>
                  <Smile size={15} />
                </button>
                {showEmoji && (
                  <EmojiPicker onSelect={em => setMessage(prev => prev + em)} onClose={() => setShowEmoji(false)} />
                )}
              </div>
              <button className="p-1.5 rounded-lg hover:bg-surface-hover text-slate-400 hover:text-slate-600 transition-colors"><Mic size={15} /></button>
              <button onClick={handleSend} disabled={!message.trim()}
                className={clsx('p-2 rounded-lg transition-all',
                  message.trim() ? 'bg-primary hover:bg-primary-hover text-white shadow-btn' : 'text-slate-300 cursor-not-allowed')}>
                <Send size={15} />
              </button>
            </div>
          </div>
        </div>
      </div>

      {showTransfer && <TransferModal conversation={conversation} onClose={() => setShowTransfer(false)} adminOnline={adminOnline} />}
      {showReassign && <ReassignModal conversation={conversation} onClose={() => setShowReassign(false)} adminOnline={adminOnline} />}
    </div>
  )
}

/* ─── Editable contact field ──────────────────────────────────── */
/* ─── Contact Panel ───────────────────────────────────────────── */
function ContactPanel({ conversation, adminOnline, onClose }) {
  const [activeTab, setActiveTab]             = useState('contact')
  const [noteText, setNoteText]               = useState('')
  const [showLabelInline, setShowLabelInline] = useState(false)
  const { assignAgent, addLabel, removeLabel, addNote } = useConversations()
  const { customFields } = useApp()

  /* ── Editable contact info ── */
  const [info, setInfo] = useState({})
  const [customValues, setCustomValues] = useState({})
  useEffect(() => {
    setInfo({
      email:    conversation?.email    || '',
      company:  conversation?.company  || '',
      website:  conversation?.website  || '',
      address:  conversation?.address  || '',
      city:     conversation?.city     || '',
      state:    conversation?.state    || '',
      zip:      conversation?.zip      || '',
      country:  conversation?.country  || '',
      dob:      conversation?.dob      || '',
      gender:   conversation?.gender   || '',
      language: conversation?.language || 'English',
    })
    setCustomValues(conversation?.customFields || {})
  }, [conversation?.id])

  function setField(key) { return val => setInfo(p => ({ ...p, [key]: val })) }
  function setCustomField(key) { return val => setCustomValues(p => ({ ...p, [key]: val })) }

  if (!conversation) return null

  const convNotes  = conversation.messages.filter(m => m.type === 'note')
  const convEvents = conversation.messages.filter(m => m.type === 'event' || m.type === 'note')
  const pastChats  = PAST_CONVERSATIONS.filter(p => p.contactId === conversation.id)
  const labels     = conversation.labels || []
  const hasCTWA    = conversation.messages.some(m => m.type === 'event' && m.event === 'ctwa_entry')
  const ctwaEvent  = conversation.messages.find(m => m.type === 'event' && m.event === 'ctwa_entry')
  const src        = CTWA_SOURCES.find(s => s.key === conversation.source)
  const initials   = conversation.name?.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase() || '??'
  const sm         = STATUS_MAP[conversation.status] || STATUS_MAP.resolved

  function handleAddNote() {
    if (!noteText.trim()) return
    addNote(conversation.id, noteText.trim(), 'Deepak Kumar')
    setNoteText('')
  }

  const totalSpent = MOCK_ORDERS.reduce((s, o) => s + parseInt(o.amount.replace(/[₹,]/g, '')), 0)

  const TABS = [
    { key: 'contact',  Icon: UserCheck,     label: 'Info'     },
    { key: 'notes',    Icon: FileText,       label: 'Notes'    },
    { key: 'chats',    Icon: MessageCircle,  label: 'Chats'    },
    { key: 'orders',   Icon: ShoppingBag,    label: 'Orders'   },
    { key: 'activity', Icon: Activity,       label: 'Timeline' },
  ]

  return (
    <div className="w-[290px] border-l border-surface-border bg-white flex-shrink-0 flex flex-col overflow-hidden">

      {/* ── Contact header ── */}
      <div className="flex-shrink-0 border-b border-surface-border bg-gradient-to-b from-slate-50/80 to-white">
        {/* Top row */}
        <div className="flex items-center justify-between px-3.5 pt-3 pb-0">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Contact</span>
          <button onClick={onClose} title="Close panel"
            className="p-1 rounded-lg hover:bg-surface-hover text-slate-400 transition-colors">
            <X size={14}/>
          </button>
        </div>

        {/* Avatar + name + phone */}
        <div className="flex items-center gap-3 px-3.5 pt-2.5 pb-0">
          <div className="relative flex-shrink-0">
            <div className="w-11 h-11 rounded-2xl bg-primary flex items-center justify-center text-white font-bold text-sm shadow-sm">
              {initials}
            </div>
            <span className={clsx('absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-white', sm.dot)}/>
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-bold text-slate-900 text-[13px] leading-tight truncate">{conversation.name}</p>
            <p className="text-[11px] text-slate-400 font-mono mt-0.5 truncate">{conversation.phone}</p>
          </div>
        </div>

        {/* Status badges */}
        <div className="flex items-center gap-1.5 px-3.5 pt-2 flex-wrap">
          <span className={clsx('inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border',
            conversation.status === 'bot'
              ? 'bg-blue-50 text-blue-600 border-blue-200'
              : conversation.status === 'agent'
              ? 'bg-emerald-50 text-emerald-600 border-emerald-200'
              : 'bg-slate-100 text-slate-500 border-slate-200')}>
            <span className={clsx('w-1.5 h-1.5 rounded-full', sm.dot)}/>
            {sm.label}
          </span>
          {conversation.agentName && (
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-violet-50 text-violet-600 border border-violet-200 max-w-[100px] truncate">
              @{conversation.agentName.split(' ')[0]}
            </span>
          )}
          {labels.slice(0,1).map(l => (
            <span key={l} className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-primary-50 text-primary border border-primary/20">
              #{l}
            </span>
          ))}
          {labels.length > 1 && (
            <span className="text-[10px] text-slate-400">+{labels.length - 1}</span>
          )}
        </div>

        {/* Quick action buttons */}
        <div className="grid grid-cols-4 gap-1.5 px-3.5 pt-2.5 pb-3">
          {[
            { Icon: Send,    label: 'Message', cls: 'bg-primary text-white hover:bg-primary/90 col-span-2' },
            { Icon: Phone,   label: 'Call',    cls: 'bg-white border border-surface-border text-slate-500 hover:text-primary hover:border-primary/30' },
            { Icon: Star,    label: conversation.starred ? 'Starred' : 'Star',
                             cls: clsx('border', conversation.starred
                               ? 'bg-amber-50 border-amber-200 text-amber-500'
                               : 'bg-white border-surface-border text-slate-500 hover:text-amber-500 hover:border-amber-200') },
          ].map(({ Icon, label, cls }) => (
            <button key={label}
              className={clsx('flex items-center justify-center gap-1 py-1.5 rounded-xl text-[10px] font-semibold transition-colors', cls)}>
              <Icon size={11}/>{label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Tab bar ── */}
      <div className="flex items-center gap-0.5 bg-slate-100 p-1 mx-3 my-2 rounded-xl flex-shrink-0">
        {TABS.map(({ key, Icon, label }) => (
          <button key={key} onClick={() => setActiveTab(key)}
            className={clsx(
              'flex flex-col items-center gap-0.5 flex-1 py-1.5 rounded-lg transition-all',
              activeTab === key ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-400 hover:text-slate-600'
            )}>
            <Icon size={13}/>
            <span className="text-[9px] font-semibold">{label}</span>
          </button>
        ))}
      </div>

      {/* ── Tab Content ── */}
      <div className="flex-1 overflow-y-auto">

        {/* ── Info tab ── */}
        {activeTab === 'contact' && (
          <div className="pb-6 space-y-0">

            {/* ── WhatsApp Opt-in banner ── */}
            <div className="flex items-center gap-2.5 mx-4 mt-4 p-2.5 rounded-xl bg-emerald-50 border border-emerald-100">
              <div className="w-6 h-6 rounded-full bg-emerald-100 flex items-center justify-center flex-shrink-0">
                <CheckCircle2 size={11} className="text-emerald-600"/>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[11px] font-semibold text-emerald-800">WhatsApp Opted In</p>
                <p className="text-[10px] text-emerald-600">Since Jan 2024</p>
              </div>
            </div>

            {/* ── Contact Information ── */}
            <div className="mt-4">
              <div className="flex items-center justify-between px-4 py-2">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Contact Information</p>
                <span className="text-[9px] text-slate-300">Click any field to edit</span>
              </div>
              <div className="border-t border-surface-border">

                {/* Phone – read-only (WA number) */}
                <div className="flex items-start gap-2.5 px-3 py-2 border-b border-surface-border/40 bg-slate-50/60">
                  <Phone size={12} className="text-slate-400 flex-shrink-0 mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <p className="text-[9px] text-slate-400 leading-none mb-0.5">Phone</p>
                    <p className="text-[11px] text-slate-700 font-medium font-mono">{conversation.phone}</p>
                  </div>
                  <span className="text-[9px] px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-600 border border-emerald-200 font-bold flex-shrink-0 mt-0.5">WA</span>
                </div>

                <EditableField icon={Mail}      label="Email"     value={info.email}    onSave={setField('email')}   type="email" />
                <EditableField icon={Building2} label="Company"   value={info.company}  onSave={setField('company')}  />
                <EditableField icon={Link2}     label="Website"   value={info.website}  onSave={setField('website')} placeholder="www.example.com" />
              </div>
            </div>

            {/* ── Address ── */}
            <div className="mt-4">
              <div className="px-4 py-2">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Address</p>
              </div>
              <div className="border-t border-surface-border">
                <EditableField icon={Home}     label="Street Address" value={info.address} onSave={setField('address')} placeholder="Building, street, area…" />
                <EditableField icon={Landmark} label="City"           value={info.city}    onSave={setField('city')}    />
                <EditableField icon={MapPin}   label="State / Province" value={info.state} onSave={setField('state')}  />
                <div className="flex border-b border-surface-border/40">
                  <div className="flex-1 border-r border-surface-border/40">
                    <EditableField icon={MapPin} label="ZIP / PIN" value={info.zip}     onSave={setField('zip')}     placeholder="400001" />
                  </div>
                  <div className="flex-1">
                    <EditableField icon={Globe}  label="Country"   value={info.country} onSave={setField('country')} placeholder="India" />
                  </div>
                </div>
              </div>
            </div>

            {/* ── Personal Details ── */}
            <div className="mt-4">
              <div className="px-4 py-2">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Personal Details</p>
              </div>
              <div className="border-t border-surface-border">
                <EditableField icon={CalendarDays} label="Date of Birth" value={info.dob}      onSave={setField('dob')}      type="date" />
                <EditableField icon={User2}         label="Gender"        value={info.gender}   onSave={setField('gender')}   placeholder="e.g. Male / Female / Other" />
                <EditableField icon={Languages}     label="Language"      value={info.language} onSave={setField('language')} placeholder="e.g. English, Hindi…" />
              </div>
            </div>

            {/* ── Custom Fields (defined in Settings → Custom Fields) ── */}
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

            {/* ── Conversation Details ── */}
            <div className="mt-4">
              <div className="px-4 py-2">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Conversation</p>
              </div>
              <div className="border-t border-b border-surface-border divide-y divide-surface-border/40">
                {[
                  { k: 'Status',  v: conversation.status.charAt(0).toUpperCase() + conversation.status.slice(1) },
                  { k: 'Handler', v: conversation.agentName || (conversation.status === 'bot' ? 'Bot' : 'Unassigned') },
                  { k: 'Channel', v: conversation.channel === 'calls' ? 'WhatsApp Calls' : 'WhatsApp' },
                  { k: 'Source',  v: conversation.source === 'broadcast' ? 'Broadcast' : conversation.source === 'direct' ? 'Direct' : conversation.source?.toUpperCase() || 'Direct' },
                  { k: 'Created', v: 'Apr 15, 2024' },
                ].map(({ k, v }) => (
                  <div key={k} className="flex justify-between items-center px-3 py-2">
                    <span className="text-[11px] text-slate-400">{k}</span>
                    <span className="text-[11px] font-semibold text-slate-700">{v}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* ── Conversation Custom Fields ── */}
            {customFields.conversation.length > 0 && (
              <div className="mt-4">
                <div className="flex items-center justify-between px-4 py-2">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Conversation Fields</p>
                  <span className="text-[9px] text-slate-300">Click any field to edit</span>
                </div>
                <div className="border-t border-surface-border">
                  {customFields.conversation.map(f => (
                    <EditableCustomField key={f.id} field={f} value={customValues[f.key]} onSave={setCustomField(f.key)} />
                  ))}
                </div>
              </div>
            )}

            {/* ── Ad Source / CTWA ── */}
            {(hasCTWA || src) && (
              <div className="mt-4 mx-4">
                {hasCTWA && ctwaEvent && (
                  <div className="rounded-xl p-3 bg-blue-50 border border-blue-100">
                    <p className="text-[10px] font-bold text-blue-400 uppercase tracking-wider mb-1.5">Ad Entry Point</p>
                    <span className="text-[9px] font-bold px-2 py-0.5 rounded bg-blue-100 text-blue-700 border border-blue-200">AD</span>
                    <p className="text-[11px] text-slate-600 mt-1.5 leading-relaxed">{ctwaEvent.text}</p>
                  </div>
                )}
                {!hasCTWA && src && (
                  <div className={clsx('rounded-xl p-3 border', src.bg)}>
                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Ad Source</p>
                    <span className={clsx('text-xs font-bold px-2 py-1 rounded border', src.color, src.bg, 'border-current')}>{src.label}</span>
                    <p className="text-[11px] text-slate-600 mt-1.5 leading-relaxed">{src.desc}</p>
                  </div>
                )}
              </div>
            )}

            {/* ── Labels ── */}
            <div className="mt-4 mx-4">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Labels</p>
              <div className="flex flex-wrap gap-1.5">
                {labels.map(lbl => (
                  <span key={lbl} className="flex items-center gap-1 badge badge-blue text-[10px]">
                    #{lbl}
                    <button onClick={() => removeLabel(conversation.id, lbl)} className="ml-0.5 text-blue-400 hover:text-blue-700">×</button>
                  </span>
                ))}
                <div className="relative">
                  <button onClick={() => setShowLabelInline(p => !p)}
                    className="text-xs px-2 py-0.5 rounded-full border border-dashed border-slate-300 text-slate-400 hover:border-primary hover:text-primary transition-colors">
                    + Add
                  </button>
                  {showLabelInline && (
                    <div className="absolute left-0 top-full mt-1 z-20">
                      <LabelPicker conversation={conversation} onClose={() => setShowLabelInline(false)} />
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* ── Assigned Agent ── */}
            <div className="mt-4 mx-4">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Assigned Agent</p>
              <NativeSelect value={conversation.agentId || ''} onChange={e => { const a = AGENTS.find(ag => ag.id === e.target.value); if (a) assignAgent(conversation.id, a.id, a.name) }} sm>
                <option value="">Unassigned</option>
                {AGENTS.map(a => <option key={a.id} value={a.id}>{a.name} ({AGENT_STATUS_LABEL[a.status]})</option>)}
                {adminOnline && <option value="admin">Deepak Kumar (You)</option>}
              </NativeSelect>
            </div>

          </div>
        )}

        {/* ── Notes tab ── */}
        {activeTab === 'notes' && (
          <div className="p-4 space-y-3">
            <div className="space-y-2">
              <textarea
                className="textarea text-xs"
                rows={4}
                placeholder="Add a private note… (@mention to notify teammates)"
                value={noteText}
                onChange={e => setNoteText(e.target.value)}
              />
              <button onClick={handleAddNote} disabled={!noteText.trim()}
                className={clsx('w-full justify-center text-xs', noteText.trim() ? 'btn-primary' : 'btn-secondary opacity-50 cursor-not-allowed')}>
                <Send size={12}/> Save Note
              </button>
            </div>
            {convNotes.length === 0 && (
              <div className="text-center py-8">
                <FileText size={24} className="text-slate-200 mx-auto mb-2"/>
                <p className="text-xs text-slate-400">No notes yet</p>
                <p className="text-[10px] text-slate-300 mt-0.5">Notes are private to your team</p>
              </div>
            )}
            {convNotes.map(note => (
              <div key={note.id} className="p-3 rounded-xl bg-amber-50 border border-amber-100 relative group">
                <p className="text-xs text-amber-800 leading-relaxed">{note.text}</p>
                <div className="flex items-center justify-between mt-1.5">
                  <p className="text-[10px] text-amber-500">By {note.sender}</p>
                  <p className="text-[10px] text-amber-400">{note.time}</p>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ── Chats tab ── */}
        {activeTab === 'chats' && (
          <div className="p-4 space-y-3">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Past Conversations</p>
            {pastChats.length === 0 && (
              <div className="text-center py-8">
                <MessageCircle size={24} className="text-slate-200 mx-auto mb-2"/>
                <p className="text-xs text-slate-400">No past conversations</p>
              </div>
            )}
            {pastChats.map(pc => (
              <div key={pc.id} className="p-3 rounded-xl border border-surface-border hover:border-primary/20 hover:bg-primary-50/30 transition-all cursor-pointer">
                <div className="flex items-center justify-between mb-1">
                  <span className="badge badge-green text-[9px]">{pc.status}</span>
                  <span className="text-[10px] text-slate-400">{pc.date}</span>
                </div>
                <p className="text-xs text-slate-700 font-medium leading-snug">{pc.snippet}</p>
                <div className="flex items-center justify-between mt-1.5">
                  <span className="text-[10px] text-slate-400">Agent: {pc.agent}</span>
                  <span className="text-[10px] text-slate-400">{pc.msgCount} msgs</span>
                </div>
              </div>
            ))}
            <button className="w-full btn-secondary text-xs justify-center mt-2">
              <Plus size={12}/> Start new conversation
            </button>
          </div>
        )}

        {/* ── Orders tab ── */}
        {activeTab === 'orders' && (
          <div className="p-4 space-y-4">
            <div className="grid grid-cols-3 gap-2">
              <div className="rounded-xl p-2.5 bg-primary-50 border border-primary/10 text-center">
                <p className="text-sm font-bold text-primary">₹{totalSpent.toLocaleString()}</p>
                <p className="text-[9px] text-slate-500 mt-0.5">Spent</p>
              </div>
              <div className="rounded-xl p-2.5 bg-emerald-50 border border-emerald-100 text-center">
                <p className="text-sm font-bold text-emerald-600">{MOCK_ORDERS.length}</p>
                <p className="text-[9px] text-slate-500 mt-0.5">Orders</p>
              </div>
              <div className="rounded-xl p-2.5 bg-slate-50 border border-surface-border text-center">
                <p className="text-sm font-bold text-slate-700">Apr 15</p>
                <p className="text-[9px] text-slate-500 mt-0.5">Last Buy</p>
              </div>
            </div>
            <div className="space-y-2">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Order History</p>
              {MOCK_ORDERS.map(order => (
                <div key={order.id} className="border border-surface-border rounded-xl p-3 hover:border-primary/20 transition-colors">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs font-semibold text-slate-800">{order.id}</span>
                    <span className={clsx('badge text-[9px]', order.statusColor)}>{order.status}</span>
                  </div>
                  <div className="flex items-center justify-between text-[11px] text-slate-500">
                    <span>{order.items} item{order.items > 1 ? 's' : ''}</span>
                    <span className="font-semibold text-slate-700">{order.amount}</span>
                    <span>{order.date}</span>
                  </div>
                  <button className="mt-1.5 text-[10px] text-primary hover:underline flex items-center gap-0.5">
                    View <ExternalLinkIcon size={9}/>
                  </button>
                </div>
              ))}
            </div>
            <button className="text-xs text-primary hover:underline flex items-center gap-1">
              View in Shopify <ExternalLinkIcon size={10}/>
            </button>
          </div>
        )}

        {/* ── Activity tab ── */}
        {activeTab === 'activity' && (
          <div className="p-4 space-y-3">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Timeline</p>
            {convEvents.map((item, i) => {
              const isNote = item.type === 'note'
              const isLast = i === convEvents.length - 1
              return (
                <div key={item.id || i} className="flex items-start gap-2.5 relative">
                  {!isLast && <div className="absolute left-3 top-6 bottom-0 w-px bg-slate-100"/>}
                  <div className={clsx('w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 z-10',
                    isNote ? 'bg-amber-100' : 'bg-primary-50')}>
                    {isNote
                      ? <FileText size={11} className="text-amber-600"/>
                      : item.event === 'assigned'     ? <UserCheck size={11} className="text-primary"/>
                      : item.event === 'bot_handover' ? <Bot size={11} className="text-primary"/>
                      : item.event === 'ctwa_entry'   ? <Globe size={11} className="text-blue-500"/>
                      : <Activity size={11} className="text-primary"/>
                    }
                  </div>
                  <div className="flex-1 min-w-0 pb-3">
                    <p className="text-xs text-slate-700 font-medium leading-snug">{item.text}</p>
                    {isNote && <p className="text-[10px] text-amber-500 mt-0.5">Note by {item.sender}</p>}
                    <p className="text-[10px] text-slate-400 mt-0.5">{item.time}</p>
                  </div>
                </div>
              )
            })}
            {[
              { Icon: FileText,     text: 'Template "order_confirmation" sent',  time: '10:41 AM', bg: 'bg-blue-50',    ic: 'text-blue-500'    },
              { Icon: Tag,          text: 'Labels changed: +vip, +order-issue',  time: '10:43 AM', bg: 'bg-slate-100',  ic: 'text-slate-500'   },
              { Icon: CheckCircle2, text: 'Customer replied to template button', time: '10:42 AM', bg: 'bg-emerald-50', ic: 'text-emerald-500' },
            ].map((item, i, arr) => (
              <div key={`s-${i}`} className="flex items-start gap-2.5 relative">
                {i < arr.length - 1 && <div className="absolute left-3 top-6 bottom-0 w-px bg-slate-100"/>}
                <div className={clsx('w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 z-10', item.bg)}>
                  <item.Icon size={11} className={item.ic}/>
                </div>
                <div className="flex-1 min-w-0 pb-3">
                  <p className="text-xs text-slate-700 font-medium">{item.text}</p>
                  <p className="text-[10px] text-slate-400 mt-0.5">{item.time}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

/* ─── Page ────────────────────────────────────────────────────── */
export default function Conversations() {
  const {
    selectConversation, active, activeId, allConversations,
    setFilter, setAgentFilter, setSourceFilter, setChannelFilter,
    setStarredOnly, setUnreadOnly, setShowArchived, setDateRange,
  } = useConversations()

  const [sidebarKey, setSidebarKey]   = useState('all')
  const [adminOnline, setAdminOnline] = useState(false)
  const [view, setView]               = useState('chats')
  const [showPanel, setShowPanel]     = useState(true)
  // Mobile: 'list' shows conversation list, 'chat' shows the active chat
  const [mobileView, setMobileView]   = useState('list')

  // ConversationProvider is shared across routes, so channelFilter can be left
  // at 'webchat' by the Website Chat inbox when navigating here. Reset it to
  // this page's default ('all' = WhatsApp channels only) on every visit.
  useEffect(() => { setChannelFilter('all') }, []) // eslint-disable-line react-hooks/exhaustive-deps

  /** Central handler: resets all filters then applies the selected one */
  function handleSidebarSelect(key) {
    setFilter('all'); setAgentFilter('all'); setSourceFilter('all')
    setChannelFilter('all'); setStarredOnly(false); setUnreadOnly(false)
    setShowArchived(false); setDateRange('all')
    switch (key) {
      case 'whatsapp':    setChannelFilter('whatsapp');  break
      case 'calls':       setChannelFilter('calls');     break
      case 'active':      setFilter('open');             break
      case 'assigned':    setAgentFilter('admin');       break
      case 'unassigned':  setAgentFilter('unassigned');  break
      case 'last24':      setDateRange('last24');        break
      case 'favorite':    setStarredOnly(true);          break
      case 'open':        setFilter('open');             break
      case 'pending':     setFilter('pending');          break
      case 'solved':      setFilter('resolved');         break
      case 'broadcasts':  setSourceFilter('broadcast');  break
      case 'unread':      setUnreadOnly(true);           break
      case 'ctwa':        setSourceFilter('ctwa');       break
      case 'g-ctwa':      setSourceFilter('g-ctwa');     break
      case 't-ctwa':      setSourceFilter('t-ctwa');     break
    }
    setSidebarKey(key)
  }

  function handleSelectConv(conv) {
    selectConversation(conv)
    setMobileView('chat') // switch to chat view on mobile
  }

  return (
    <div className="h-[calc(100vh-48px)] md:h-screen -mx-3 -mt-3 -mb-3 sm:-mx-5 sm:-mt-5 sm:-mb-5 flex animate-fade-in overflow-hidden">

      {/* Filter sidebar — hidden on mobile */}
      <div className="hidden md:flex flex-shrink-0">
        <FilterSidebar
          sidebarKey={sidebarKey}
          onSelect={handleSidebarSelect}
          allConversations={allConversations}
          adminOnline={adminOnline}
          setAdminOnline={setAdminOnline}
        />
      </div>

      {/* Conversation list — full width on mobile when mobileView=list, fixed width on md+ */}
      <div className={clsx(
        'flex-shrink-0 min-w-0 transition-all',
        'w-full md:w-[260px]',
        mobileView === 'chat' ? 'hidden md:flex md:flex-col' : 'flex flex-col'
      )}>
        <ConversationList
          onSelect={handleSelectConv}
          activeId={activeId}
          view={view}
          setView={setView}
        />
      </div>

      {/* Chat + contact panel — hidden on mobile when mobileView=list */}
      <div className={clsx(
        'flex flex-1 min-w-0 overflow-hidden',
        mobileView === 'list' ? 'hidden md:flex' : 'flex'
      )}>
        {/* Mobile back button injected via wrapper */}
        <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
          {/* Mobile back button bar */}
          <div className="md:hidden flex items-center gap-2 px-3 py-2 bg-white border-b border-surface-border flex-shrink-0">
            <button onClick={() => setMobileView('list')}
              className="flex items-center gap-1.5 text-xs font-semibold text-primary">
              <ChevronRight size={14} className="rotate-180"/> Back to list
            </button>
          </div>
          {view === 'insights'
            ? <InsightsPanel adminOnline={adminOnline} />
            : <ChatWindow conversation={active} adminOnline={adminOnline} showPanel={showPanel} onTogglePanel={() => setShowPanel(p => !p)} />
          }
        </div>
        {/* Contact panel — hidden on mobile */}
        {view === 'chats' && showPanel && (
          <div className="hidden lg:flex flex-shrink-0">
            <ContactPanel conversation={active} adminOnline={adminOnline} onClose={() => setShowPanel(false)} />
          </div>
        )}
      </div>
    </div>
  )
}
