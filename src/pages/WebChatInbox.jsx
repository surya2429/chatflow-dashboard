import { useState, useRef, useEffect } from 'react'
import {
  Search, Bot, UserCheck, CheckCircle2, Send, Paperclip, Mic,
  Smile, MoreVertical, X, Star, FileText,
  ChevronDown, Plus, Archive, AlertCircle,
  MessageCircle, SlidersHorizontal,
  RefreshCw, Zap, AtSign, Clock, Users, Inbox,
  Hash, Activity, ShieldCheck,
  ArrowRightLeft, BellOff, Bold, Italic,
  Image, Filter, Tag, ChevronRight,
  RotateCcw, UserPlus, MessageSquare, ThumbsUp,
  Globe, Monitor, MapPin, Link2, Eye, Info,
  Mail, Building2, Home, Landmark, CalendarDays, User2, Languages, ShoppingBag, Phone, Video,
} from 'lucide-react'
import { useConversations } from '../context/ConversationContext'
import { useWebchatCall } from '../context/WebchatCallContext'
import { useApp } from '../context/AppContext'
import { AGENTS, PAST_CONVERSATIONS, MOCK_ORDERS } from '../constants/mockData'
import Select, { NativeSelect } from '../components/Select'
import {
  STATUS_MAP, AGENT_STATUS_DOT, AGENT_STATUS_LABEL, CANNED,
  LabelPicker, SnoozePicker, EmojiPicker, TransferModal, ReassignModal,
  EditableField, EditableCustomField, EditablePhoneField, ExternalLinkIcon,
} from '../components/inbox/SharedInboxParts'
import clsx from 'clsx'

/**
 * Website Chat inbox — structural/behavioral parity with the WhatsApp inbox
 * (src/pages/Conversations.jsx), minus WhatsApp-only concepts: no message
 * templates, no CTWA ad-source attribution, no 24h session window, no
 * phone/country-code flows, no "start new conversation" (webchat is
 * visitor-initiated). The interactive pieces that don't depend on any of
 * that (labels, snooze, transfer/reassign, emoji picker, canned replies,
 * status map) are shared with the WhatsApp inbox via
 * src/components/inbox/SharedInboxParts.jsx.
 */

/* Icon shown per question type in the "Captured from Chat" list — falls
   back to a generic message icon for types with no dedicated one. */
const ANSWER_ICON = { phone: Phone, email: Mail }

/* ─── Filter sidebar (no Channels switcher, no Ad Sources) ─────── */
function FilterSidebar({ sidebarKey, onSelect, allConversations, adminOnline, setAdminOnline }) {
  const [showMore, setShowMore] = useState(true)

  const cnt = {
    all:        allConversations.length,
    active:     allConversations.filter(c => c.status === 'bot' || c.status === 'agent').length,
    assigned:   allConversations.filter(c => c.agentId === 'admin').length,
    unassigned: allConversations.filter(c => !c.agentId && c.status !== 'resolved').length,
    open:       allConversations.filter(c => c.status === 'bot' || c.status === 'agent').length,
    pending:    allConversations.filter(c => c.status === 'bot').length,
    solved:     allConversations.filter(c => c.status === 'resolved').length,
    unread:     allConversations.filter(c => (c.unread || 0) > 0).length,
  }

  const VIEWS = [
    { key: 'all',        label: 'All chats',      icon: Inbox,        count: cnt.all        },
    { key: 'active',     label: 'Active chats',   icon: MessageCircle,count: cnt.active     },
    { key: 'assigned',   label: 'Assigned to me', icon: UserCheck,    count: cnt.assigned   },
    { key: 'unassigned', label: 'Unassigned',     icon: Users,        count: cnt.unassigned },
  ]

  const MORE = [
    { key: 'last24',     label: 'Last 24 Hours',  icon: Clock,        color: '',                 count: null        },
    { key: 'favorite',   label: 'Favourite only', icon: Star,         color: '',                 count: null        },
    { key: 'open',       label: 'Open',           icon: MessageCircle,color: 'text-emerald-600', count: cnt.open    },
    { key: 'pending',    label: 'Pending',        icon: AlertCircle,  color: 'text-amber-600',   count: cnt.pending },
    { key: 'solved',     label: 'Solved',         icon: CheckCircle2, color: 'text-slate-500',   count: cnt.solved  },
    { key: 'unread',     label: 'Unread',         icon: Hash,         color: 'text-blue-600',    count: cnt.unread  },
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
          {showMore && MORE.map(f => row(f.key, f.icon, f.label, f.count, f.color))}
        </div>
      </div>
    </div>
  )
}

/* ─── Advanced Filter Panel (no Source/CTWA dropdown) ───────────── */
const ALL_LABELS_LIST = ['vip','lead','support','refund','appointment','order-issue','urgent','follow-up','prospect','payment','satisfied']
const DATE_PRESETS = [
  { key: 'all',       label: 'All time'    },
  { key: 'today',     label: 'Today'       },
  { key: 'yesterday', label: 'Yesterday'   },
  { key: 'last7',     label: 'Last 7 days' },
  { key: 'last30',    label: 'Last 30 days'},
  { key: 'custom',    label: 'Custom'      },
]

function AdvancedFilterPanel({
  dateRange, setDateRange, dateFrom, setDateFrom, dateTo, setDateTo,
  labelFilter, setLabelFilter,
  starredOnly, setStarredOnly, unreadOnly, setUnreadOnly,
  showArchived, setShowArchived,
  agentSel, setAgentSel, setAgentFilter,
  setFilter, currentStatus,
  customFieldDefs = [], customFieldFilters = {}, setCustomFieldFilter,
  onClear, onClose,
}) {
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
        <div>
          <p className="text-[9px] font-semibold text-slate-400 uppercase tracking-wide mb-1.5">Label</p>
          <Select size="sm" value={labelFilter[0] || ''} onChange={v => setLabelFilter(v ? [v] : [])}
            options={[
              { value: '', label: 'All Labels' },
              ...ALL_LABELS_LIST.map(l => ({ value: l, label: `#${l}` })),
            ]} />
        </div>

        {/* Toggles */}
        <div className="border-t border-surface-border pt-2 -mx-4 px-4">
          <Toggle label="Starred only"   value={starredOnly}  set={setStarredOnly}  />
          <Toggle label="Unread only"    value={unreadOnly}   set={setUnreadOnly}   />
          <Toggle label="Show archived"  value={showArchived} set={setShowArchived} />
        </div>

        {/* Custom Fields */}
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

/* ─── Conversation list panel ─────────────────────────────────── */
function ConversationList({ onSelect, activeId, view, setView }) {
  const {
    conversations, allConversations, search, setFilter, setSearch,
    agentFilter, setAgentFilter,
    dateRange, setDateRange, dateFrom, setDateFrom, dateTo, setDateTo,
    labelFilter, setLabelFilter,
    starredOnly, setStarredOnly, unreadOnly, setUnreadOnly,
    showArchived, setShowArchived,
    customFieldFilters, setCustomFieldFilter, clearCustomFieldFilters,
  } = useConversations()
  const { customFields } = useApp()
  const filterableCustomFields = customFields.contact.filter(f => f.type === 'dropdown' || f.type === 'boolean')
  const [showFilters, setShowFilters]     = useState(false)
  const [activeTab, setActiveTab]         = useState('all')
  const [agentSel, setAgentSel]           = useState('all')
  const [showAgentDrop, setShowAgentDrop] = useState(false)
  const agentRef = useRef(null)

  useEffect(() => { setAgentSel(agentFilter) }, [agentFilter])

  useEffect(() => {
    function h(e) { if (agentRef.current && !agentRef.current.contains(e.target)) setShowAgentDrop(false) }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [])

  const unassigned = allConversations.filter(c => !c.agentId && c.status !== 'resolved').length

  const activeFilterCount = [
    dateRange !== 'all',
    labelFilter.length > 0,
    starredOnly,
    unreadOnly,
    showArchived,
    agentSel !== 'all',
    activeTab !== 'all',
    Object.keys(customFieldFilters).length > 0,
  ].filter(Boolean).length

  return (
    <div className="flex flex-col h-full border-r border-surface-border bg-white">

      {/* ── Row 1: title + view toggle + actions ── */}
      <div className="flex items-center gap-1.5 px-3 py-2 border-b border-surface-border flex-shrink-0">
        <p className="text-[13px] font-bold text-slate-800 flex-1 truncate min-w-0">Website Chat</p>

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

        {/* Agent filter inline */}
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
              agentSel={agentSel} setAgentSel={setAgentSel} setAgentFilter={setAgentFilter}
              setFilter={val => { setActiveTab(val); setFilter(val) }}
              currentStatus={activeTab}
              customFieldDefs={filterableCustomFields}
              customFieldFilters={customFieldFilters}
              setCustomFieldFilter={setCustomFieldFilter}
              onClear={() => {
                setDateRange('all'); setDateFrom(''); setDateTo('')
                setLabelFilter([]); setStarredOnly(false); setUnreadOnly(false)
                setShowArchived(false)
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
                <p className="text-[10px] text-slate-400 truncate">{c.page} · {c.browser}/{c.os}</p>
                <div className={clsx('text-[11px] truncate flex items-center gap-1', c.unread > 0 ? 'text-slate-700' : 'text-slate-400')}>
                  <span className="truncate">{c.lastMessage}</span>
                </div>
                <div className="flex items-center justify-between mt-1">
                  <div className="flex items-center gap-1 flex-wrap">
                    {c.agentName && (
                      <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-blue-50 text-blue-600 border border-blue-100 font-medium">{c.agentName.split(' ')[0]}</span>
                    )}
                    {(c.tags || []).slice(0, 1).map(t => (
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
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
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
                  {['Agent', 'Active', 'Pending', 'Assigned', 'Resolved', 'Avg Reply', 'CSAT'].map((h, i) => (
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
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        <div>
          <h3 className="text-xs font-bold text-slate-800 mb-3 flex items-center gap-2"><ThumbsUp size={14} className="text-primary" /> Today's Summary</h3>
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: 'Avg First Response', value: '1.4 min', Icon: Clock        },
              { label: 'Resolution Rate',    value: '81%',     Icon: CheckCircle2 },
              { label: 'CSAT Score',         value: '4.7 / 5', Icon: ThumbsUp     },
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

/* ─── Chat Window (real phone/video calls via WebchatCallContext; still no Send Template) ─── */
function ChatWindow({ conversation, adminOnline, showPanel, onTogglePanel }) {
  const [message, setMessage]               = useState('')
  const [replyMode, setReplyMode]           = useState('reply')
  const [showCanned, setShowCanned]         = useState(false)
  const [showTransfer, setShowTransfer]     = useState(false)
  const [showReassign, setShowReassign]     = useState(false)
  const [showSnooze, setShowSnooze]         = useState(false)
  const [showMoreActions, setShowMoreActions] = useState(false)
  const [showLabelPicker, setShowLabelPicker] = useState(false)
  const [showEmoji, setShowEmoji]           = useState(false)
  const [archiveConfirm, setArchiveConfirm] = useState(false)

  const {
    sendMessage, takeoverConversation, resolveConversation, returnToBot,
    toggleStar, archiveConversation, snoozeConversation, addNote,
  } = useConversations()
  const { initiateCall, activeCall, setWatchedVisitor } = useWebchatCall()

  const msgsRef   = useRef(null)
  const moreRef   = useRef(null)
  const labelRef  = useRef(null)
  const emojiRef  = useRef(null)

  useEffect(() => {
    if (msgsRef.current) msgsRef.current.scrollTop = msgsRef.current.scrollHeight
  }, [conversation?.messages])

  // Let WebchatCallProvider listen on this visitor's signaling room while
  // their chat is open, so an inbound call-request from them can be caught.
  useEffect(() => {
    setWatchedVisitor(conversation?.visitorId)
    return () => setWatchedVisitor(null)
  }, [conversation?.visitorId])

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

  const sm = STATUS_MAP[conversation.status]

  function handleSend() {
    if (!message.trim()) return
    if (replyMode === 'note') {
      addNote(conversation.id, message, 'Deepak Kumar')
    } else {
      sendMessage(conversation.id, message)
    }
    setMessage('')
    setShowCanned(false)
  }

  function renderMessage(m) {
    if (m.type === 'event') {
      return (
        <div key={m.id} className="flex items-center justify-center my-3">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-100 border border-slate-200 text-xs text-slate-500">
            {m.event === 'assigned'     && <UserCheck size={11} className="text-emerald-500" />}
            {m.event === 'bot_handover' && <Bot size={11} className="text-primary" />}
            {m.text}
          </div>
        </div>
      )
    }

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

    /* Answer to a bot-flow question type (phone, email, name, …) — shown
       inline in the thread as a compact card, same data that also lands in
       the Visitor panel's "Captured from Chat" section. */
    if (m.type === 'answer') {
      const AIcon = ANSWER_ICON[m.questionType] || MessageSquare
      return (
        <div key={m.id} className="flex justify-start my-2">
          <div className="w-6 h-6 rounded-full bg-slate-400 flex items-center justify-center text-white text-[10px] font-bold flex-shrink-0 mr-2">
            {conversation.avatar[0]}
          </div>
          <div className="max-w-[72%] bg-emerald-50 border border-emerald-200 rounded-2xl rounded-tl-sm px-3 py-2">
            <div className="flex items-center gap-1.5">
              <AIcon size={11} className="text-emerald-600 flex-shrink-0" />
              <p className="text-[9px] font-semibold text-emerald-600 uppercase tracking-wide">{m.label}</p>
            </div>
            <p className="text-xs text-emerald-900 font-medium mt-0.5">{m.value}</p>
            <p className="text-[9px] text-emerald-500 mt-1">{m.time}</p>
          </div>
        </div>
      )
    }

    const isIncoming = m.type === 'incoming'
    return (
      <div key={m.id} className={clsx('flex items-end gap-2', isIncoming ? 'justify-start' : 'justify-end')}>
        {isIncoming && (
          <div className="w-6 h-6 rounded-full bg-slate-400 flex items-center justify-center text-white text-[10px] font-bold flex-shrink-0">
            {conversation.avatar[0]}
          </div>
        )}
        <div className="max-w-[72%]">
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
    <div className="flex-1 flex flex-col bg-white min-w-0 min-h-0 relative">
      {/* ── Chat header ── */}
      <div className="flex items-center px-3 py-2 border-b border-surface-border bg-white flex-shrink-0 gap-2 min-w-0">

        <div className="flex items-center gap-2.5 min-w-0 flex-1">
          <div className="relative flex-shrink-0">
            <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center text-white text-xs font-bold">{conversation.avatar}</div>
            <span className={clsx('absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full border-2 border-white', sm.dot)} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5 min-w-0">
              <p className="font-semibold text-slate-900 text-[13px] leading-none truncate">{conversation.name}</p>
              <span className={clsx('badge text-[9px] flex-shrink-0', sm.badge)}>{sm.label}</span>
              {conversation.snoozed && <BellOff size={9} className="text-amber-500 flex-shrink-0" />}
            </div>
            <p className="text-[11px] text-slate-400 mt-0.5 truncate">{conversation.page} · {conversation.browser}/{conversation.os}</p>
          </div>
        </div>

        <div className="flex items-center gap-1 flex-shrink-0">

          {conversation.status === 'bot' && (
            <button onClick={() => takeoverConversation(conversation.id)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary text-white hover:bg-primary-hover text-xs font-semibold transition-colors whitespace-nowrap">
              <UserCheck size={12} /> Take Over
            </button>
          )}

          {/* Voice / video call */}
          <button
            onClick={() => initiateCall(conversation, { video: false })}
            disabled={!!activeCall}
            title="Voice call"
            className={clsx('p-1.5 rounded-lg transition-colors', activeCall ? 'text-slate-300 cursor-not-allowed' : 'hover:bg-surface-hover text-slate-400 hover:text-slate-600')}>
            <Phone size={13} />
          </button>
          <button
            onClick={() => initiateCall(conversation, { video: true })}
            disabled={!!activeCall}
            title="Video call"
            className={clsx('p-1.5 rounded-lg transition-colors', activeCall ? 'text-slate-300 cursor-not-allowed' : 'hover:bg-surface-hover text-slate-400 hover:text-slate-600')}>
            <Video size={13} />
          </button>

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

          {/* Info panel toggle icon (mirrors WhatsApp's) */}
          <button title="Visitor info" className="p-1.5 rounded-lg hover:bg-surface-hover text-slate-400 hover:text-slate-600 transition-colors hidden">
            <Info size={13} />
          </button>

          {/* ⋮ More */}
          <div ref={moreRef} className="relative">
            <button onClick={() => setShowMoreActions(p => !p)}
              className="p-1.5 rounded-lg hover:bg-surface-hover text-slate-400 hover:text-slate-600 transition-colors">
              <MoreVertical size={14} />
            </button>
            {showMoreActions && (
              <div className="absolute top-full right-0 mt-1 w-52 bg-white rounded-xl shadow-modal border border-surface-border z-30 py-1 animate-fade-in">
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
                  <RotateCcw size={13} className={conversation.status !== 'resolved' ? 'text-slate-200' : 'text-amber-500'} />
                  Mark as Unresolved
                </button>
                <div className="border-t border-surface-border my-1" />
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
                <div className="border-t border-surface-border my-1" />
                <button onClick={() => { setArchiveConfirm(true); setShowMoreActions(false) }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 text-xs text-red-500 hover:bg-red-50 transition-colors">
                  <Archive size={13} className="text-red-400" /> Archive
                </button>
              </div>
            )}
          </div>

          <button onClick={onTogglePanel} title={showPanel ? 'Hide info panel' : 'Show info panel'}
            className={clsx('p-1.5 rounded-lg transition-colors border', showPanel ? 'bg-primary-50 text-primary border-primary/20' : 'border-transparent hover:bg-surface-hover text-slate-400 hover:text-slate-600')}>
            <ChevronRight size={13} className={clsx('transition-transform duration-200', showPanel ? 'rotate-0' : 'rotate-180')} />
          </button>
        </div>
      </div>

      {archiveConfirm && (
        <div className="flex items-center gap-3 px-4 py-2.5 bg-amber-50 border-b border-amber-200 flex-shrink-0">
          <Archive size={13} className="text-amber-600" />
          <span className="text-xs text-amber-800 font-medium flex-1">Archive this conversation? It will be moved to archived chats.</span>
          <button onClick={() => { archiveConversation(conversation.id); setArchiveConfirm(false) }}
            className="text-xs font-semibold text-white bg-amber-500 hover:bg-amber-600 px-3 py-1 rounded-lg transition-colors">Archive</button>
          <button onClick={() => setArchiveConfirm(false)} className="text-xs text-slate-500 hover:text-slate-700 font-medium">Cancel</button>
        </div>
      )}

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

      {/* Messages — `min-h-0` is load-bearing here: a flex item's default
          min-height is `auto` (its content size), which overrides `flex-1`
          and `overflow-y-auto` and lets this pane grow to fit EVERY message
          instead of being clipped to the space actually available. For a
          short demo conversation that never showed — the content fit either
          way — but once a thread gets long (many restarts of a flow test,
          lots of Q&A), this pane silently stopped scrolling internally and
          started growing the whole page instead, so the auto-scroll-to-
          -newest-message effect below was setting `scrollTop` on an element
          that was never actually the true scroll container. That's what
          made a long-running flow test look like new messages "weren't
          storing": they were, but nothing on screen was carrying you down
          to them without a manual page-scroll. */}
      <div ref={msgsRef} className="flex-1 min-h-0 overflow-y-auto px-5 py-4 space-y-2 bg-[#f0f4f8]">
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
              <button onClick={() => setShowCanned(p => !p)}
                title="Canned Responses"
                className={clsx('p-1.5 rounded-lg transition-colors', showCanned ? 'bg-primary-50 text-primary' : 'hover:bg-surface-hover text-slate-400 hover:text-primary')}>
                <Zap size={15} />
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
      {showSnooze && (
        <div className="absolute bottom-16 right-4">
          <SnoozePicker onSnooze={until => snoozeConversation(conversation.id, until)} onClose={() => setShowSnooze(false)} />
        </div>
      )}
    </div>
  )
}

/* ─── Visitor info panel (replaces WhatsApp's ContactPanel) ────── */
function ContactPanel({ conversation, adminOnline, onClose }) {
  const [activeTab, setActiveTab]             = useState('info')
  const [noteText, setNoteText]               = useState('')
  const [showLabelInline, setShowLabelInline] = useState(false)
  const { assignAgent, removeLabel, addNote } = useConversations()
  const { customFields } = useApp()

  /* ── Editable contact info — same fields as the WhatsApp panel, plus an
     editable Phone (with country code) since website chat has no WA number to
     fall back on. Phone/Email default from whatever the visitor answered to a
     matching question type during the chat, if the field isn't set directly.
     Re-derives whenever the message COUNT changes (not just when a different
     conversation is selected) — a bot flow can capture its email/phone
     answer well after this panel is already open and watching the thread
     (e.g. testing a flow live), and depending on `conversation?.id` alone
     meant this only ever computed once per conversation, so an answer that
     arrived after that point silently never reached these fields even
     though it was already showing correctly under "Captured from Chat"
     below (which reads conversation.messages directly, every render). ── */
  const [info, setInfo] = useState({})
  const [customValues, setCustomValues] = useState({})
  useEffect(() => {
    const answers = (conversation?.messages || []).filter(m => m.type === 'answer')
    const answerFor = qType => answers.find(a => a.questionType === qType)?.value || ''
    setInfo({
      phone:    conversation?.phone    || answerFor('phone') || '',
      email:    conversation?.email    || answerFor('email') || '',
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
  }, [conversation?.id, conversation?.messages?.length])

  function setField(key) { return val => setInfo(p => ({ ...p, [key]: val })) }
  function setCustomField(key) { return val => setCustomValues(p => ({ ...p, [key]: val })) }

  if (!conversation) return null

  const convNotes  = conversation.messages.filter(m => m.type === 'note')
  const convEvents = conversation.messages.filter(m => m.type === 'event' || m.type === 'note')
  const convAnswers = conversation.messages.filter(m => m.type === 'answer')
  const pastChats  = PAST_CONVERSATIONS.filter(p => p.contactId === conversation.id)
  const labels     = conversation.labels || []
  const initials   = conversation.name?.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase() || '??'
  const sm         = STATUS_MAP[conversation.status] || STATUS_MAP.resolved

  function handleAddNote() {
    if (!noteText.trim()) return
    addNote(conversation.id, noteText.trim(), 'Deepak Kumar')
    setNoteText('')
  }

  const totalSpent = MOCK_ORDERS.reduce((s, o) => s + parseInt(o.amount.replace(/[₹,]/g, '')), 0)

  const TABS = [
    { key: 'info',     Icon: Monitor,      label: 'Visitor'  },
    { key: 'notes',    Icon: FileText,     label: 'Notes'    },
    { key: 'chats',    Icon: MessageCircle,label: 'Chats'    },
    { key: 'orders',   Icon: ShoppingBag,  label: 'Orders'   },
    { key: 'activity', Icon: Activity,     label: 'Timeline' },
  ]

  return (
    <div className="w-[290px] border-l border-surface-border bg-white flex-shrink-0 flex flex-col overflow-hidden">

      {/* ── Header ── */}
      <div className="flex-shrink-0 border-b border-surface-border bg-gradient-to-b from-slate-50/80 to-white">
        <div className="flex items-center justify-between px-3.5 pt-3 pb-0">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Visitor</span>
          <button onClick={onClose} title="Close panel"
            className="p-1 rounded-lg hover:bg-surface-hover text-slate-400 transition-colors">
            <X size={14}/>
          </button>
        </div>

        <div className="flex items-center gap-3 px-3.5 pt-2.5 pb-0">
          <div className="relative flex-shrink-0">
            <div className="w-11 h-11 rounded-2xl bg-primary flex items-center justify-center text-white font-bold text-sm shadow-sm">
              {initials}
            </div>
            <span className={clsx('absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-white', sm.dot)}/>
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-bold text-slate-900 text-[13px] leading-tight truncate">{conversation.name}</p>
            <p className="text-[11px] text-slate-400 mt-0.5 truncate">{conversation.location}</p>
          </div>
        </div>

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

        <div className="grid grid-cols-3 gap-1.5 px-3.5 pt-2.5 pb-3">
          {[
            { Icon: Send,    label: 'Message', cls: 'bg-primary text-white hover:bg-primary/90 col-span-2' },
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

        {/* ── Visitor tab ── */}
        {activeTab === 'info' && (
          <div className="pb-6 space-y-0">

            <div className="flex items-center gap-2.5 mx-4 mt-4 p-2.5 rounded-xl bg-blue-50 border border-blue-100">
              <div className="w-6 h-6 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
                <Globe size={11} className="text-blue-600"/>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[11px] font-semibold text-blue-800">Website Visitor</p>
                <p className="text-[10px] text-blue-600">First seen {conversation.firstSeen}</p>
              </div>
            </div>

            <div className="mt-4">
              <div className="px-4 py-2">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Session</p>
              </div>
              <div className="border-t border-b border-surface-border divide-y divide-surface-border/40">
                {[
                  { Icon: Hash,    k: 'Visitor ID',   v: conversation.visitorId, mono: true, title: "Persisted client-side (localStorage) by the chat widget — this is what keeps every visit from this browser in one thread, and what the Contacts page's \"Open Chat\" matches on." },
                  { Icon: Link2,   k: 'Current page', v: conversation.page                                  },
                  { Icon: Monitor, k: 'Browser',      v: `${conversation.browser} on ${conversation.os}`    },
                  { Icon: MapPin,  k: 'Location',     v: conversation.location                               },
                  { Icon: Globe,   k: 'Referrer',     v: conversation.referrer                               },
                  { Icon: Eye,     k: 'Visits',       v: `${conversation.visits} visit${conversation.visits === 1 ? '' : 's'}` },
                ].filter(row => row.v).map(({ Icon, k, v, mono, title }) => (
                  <div key={k} className="flex items-start gap-2.5 px-3 py-2" title={title}>
                    <Icon size={12} className="text-slate-400 flex-shrink-0 mt-0.5" />
                    <div className="flex-1 min-w-0">
                      <p className="text-[9px] text-slate-400 leading-none mb-0.5">{k}</p>
                      <p className={clsx('text-[11px] text-slate-700 font-medium break-words', mono && 'font-mono')}>{v}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* ── Captured from Chat — every question-type answer the visitor
                 gave during this conversation, whatever the bot flow asked
                 for (phone, email, name, …). Phone/Email also prefill the
                 editable fields below. ── */}
            {convAnswers.length > 0 && (
              <div className="mt-4">
                <div className="px-4 py-2">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Captured from Chat</p>
                </div>
                <div className="border-t border-b border-surface-border divide-y divide-surface-border/40">
                  {convAnswers.map(a => {
                    const AIcon = ANSWER_ICON[a.questionType] || MessageSquare
                    return (
                      <div key={a.id} className="flex items-start gap-2.5 px-3 py-2">
                        <AIcon size={12} className="text-emerald-500 flex-shrink-0 mt-0.5" />
                        <div className="flex-1 min-w-0">
                          <p className="text-[9px] text-slate-400 leading-none mb-0.5">{a.label}</p>
                          <p className="text-[11px] text-slate-700 font-medium break-words">{a.value}</p>
                        </div>
                        <span className="text-[9px] text-slate-300 flex-shrink-0 mt-0.5">{a.time}</span>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* ── Contact Information ── */}
            <div className="mt-4">
              <div className="flex items-center justify-between px-4 py-2">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Contact Information</p>
                <span className="text-[9px] text-slate-300">Click any field to edit</span>
              </div>
              <div className="border-t border-surface-border">
                <EditablePhoneField label="Phone"   value={info.phone}    onSave={setField('phone')}   />
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

            <div className="mt-4">
              <div className="px-4 py-2">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Conversation</p>
              </div>
              <div className="border-t border-b border-surface-border divide-y divide-surface-border/40">
                {[
                  { k: 'Status',  v: conversation.status.charAt(0).toUpperCase() + conversation.status.slice(1) },
                  { k: 'Handler', v: conversation.agentName || (conversation.status === 'bot' ? 'Bot' : 'Unassigned') },
                  { k: 'Channel', v: 'Website Chat' },
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
            {convEvents.length === 0 && (
              <div className="text-center py-8">
                <Activity size={24} className="text-slate-200 mx-auto mb-2"/>
                <p className="text-xs text-slate-400">No activity yet</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

/* ─── Page ────────────────────────────────────────────────────── */
export default function WebChatInbox() {
  const {
    selectConversation, active, activeId, allConversations,
    setFilter, setAgentFilter, setChannelFilter,
    setStarredOnly, setUnreadOnly, setShowArchived, setDateRange,
  } = useConversations()

  const [sidebarKey, setSidebarKey]   = useState('all')
  const [adminOnline, setAdminOnline] = useState(false)
  const [view, setView]               = useState('chats')
  const [showPanel, setShowPanel]     = useState(true)
  const [mobileView, setMobileView]   = useState('list')

  // ConversationProvider is shared across routes — scope it to webchat
  // conversations only, and start from a clean filter state, every visit.
  useEffect(() => {
    setChannelFilter('webchat')
    setFilter('all'); setAgentFilter('all'); setStarredOnly(false)
    setUnreadOnly(false); setShowArchived(false); setDateRange('all')
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  function handleSidebarSelect(key) {
    setFilter('all'); setAgentFilter('all')
    setStarredOnly(false); setUnreadOnly(false)
    setShowArchived(false); setDateRange('all')
    switch (key) {
      case 'active':      setFilter('open');             break
      case 'assigned':    setAgentFilter('admin');       break
      case 'unassigned':  setAgentFilter('unassigned');  break
      case 'last24':      setDateRange('last24');        break
      case 'favorite':    setStarredOnly(true);          break
      case 'open':        setFilter('open');             break
      case 'pending':     setFilter('pending');          break
      case 'solved':      setFilter('resolved');         break
      case 'unread':      setUnreadOnly(true);           break
    }
    setSidebarKey(key)
  }

  function handleSelectConv(conv) {
    selectConversation(conv)
    setMobileView('chat')
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

      {/* Conversation list */}
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

      {/* Chat + contact panel */}
      <div className={clsx(
        'flex flex-1 min-w-0 overflow-hidden',
        mobileView === 'list' ? 'hidden md:flex' : 'flex'
      )}>
        <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
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
        {view === 'chats' && showPanel && (
          <div className="hidden lg:flex flex-shrink-0">
            <ContactPanel conversation={active} adminOnline={adminOnline} onClose={() => setShowPanel(false)} />
          </div>
        )}
      </div>
    </div>
  )
}
