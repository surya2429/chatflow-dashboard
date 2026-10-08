import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Plus, X, Bot, MessageSquare, Workflow, Radio,
  BarChart2, Settings, MoreVertical, Pencil,
  Phone, Inbox, Search, ArrowUpDown,
} from 'lucide-react'
import { useApp } from '../context/AppContext'
import Select from '../components/Select'
import clsx from 'clsx'

/* ─── Toggle ─────────────────────────────────────────────────── */
function Toggle({ on, onChange }) {
  return (
    <button onClick={e => { e.stopPropagation(); onChange(!on) }} style={{
      width:34, height:18, borderRadius:9, border:'none', cursor:'pointer', position:'relative',
      background: on ? '#0066ff' : '#d1d5db', transition:'background 0.2s', padding:0, flexShrink:0,
    }}>
      <div style={{ position:'absolute', top:2, left: on ? 16 : 2, width:14, height:14, borderRadius:'50%',
        background:'#fff', transition:'left 0.2s', boxShadow:'0 1px 3px rgba(0,0,0,0.2)' }}/>
    </button>
  )
}

/* ─── Avatar with WhatsApp badge ─────────────────────────────── */
function BotAvatar({ bot }) {
  const off = bot.status === 'disconnected'
  return (
    <div className="relative flex-shrink-0">
      <div className="w-9 h-9 rounded-full flex items-center justify-center font-bold text-[11px] ring-2 ring-white"
        style={{ background: off ? '#e2e8f0' : bot.bg, color: off ? '#94a3b8' : bot.color }}>
        {bot.avatar}
      </div>
      <div className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full bg-[#25D366] flex items-center justify-center ring-1 ring-white">
        <MessageSquare size={7} color="white"/>
      </div>
    </div>
  )
}

/* ─── Section shortcuts ──────────────────────────────────────── */
const ACTIONS = [
  { icon: Pencil,    label: 'Edit',       dest: '/flows'         },
  { icon: Inbox,     label: 'Inbox',      dest: '/conversations' },
  { icon: Workflow,  label: 'Flows',      dest: '/flows'         },
  { icon: Radio,     label: 'Broadcasts', dest: '/broadcasting'  },
  { icon: BarChart2, label: 'Analytics',  dest: '/analytics'     },
  { icon: Settings,  label: 'Settings',   dest: '/settings'      },
]

/* ─── Status config ──────────────────────────────────────────── */
const STATUS = {
  active:       { label: 'Active',       dot: 'bg-emerald-400', text: 'text-emerald-600', bg: 'bg-emerald-50' },
  paused:       { label: 'Paused',       dot: 'bg-amber-400',   text: 'text-amber-600',   bg: 'bg-amber-50'   },
  disconnected: { label: 'Disconnected', dot: 'bg-slate-300',   text: 'text-slate-400',   bg: 'bg-slate-50'   },
}

/* ─── Bot Row Card ───────────────────────────────────────────── */
function BotCard({ bot, onOpen, onToggle }) {
  const [menu, setMenu] = useState(false)
  const st     = STATUS[bot.status]
  const off    = bot.status === 'disconnected'
  const isActive = bot.status === 'active'

  return (
    <div className="bg-white border border-surface-border rounded-xl hover:border-slate-300 transition-colors flex flex-col sm:flex-row sm:items-center px-4 py-3 gap-3 sm:gap-4">

      {/* ── Top row on mobile: avatar + info + toggle/more ── */}
      <div className="flex items-center gap-3 min-w-0 flex-1">
        <button
          onClick={() => !off && onOpen(bot, '/dashboard')}
          disabled={off}
          className="flex items-center gap-3 text-left min-w-0 flex-1 sm:w-48 sm:flex-none">
          <BotAvatar bot={bot}/>
          <div className="min-w-0">
            <p className="text-[12px] font-semibold text-slate-800 truncate leading-tight">{bot.name}</p>
            <div className="flex items-center gap-1 mt-0.5">
              <span className={clsx('w-1.5 h-1.5 rounded-full flex-shrink-0', st.dot)}/>
              <span className={clsx('text-[10px] font-medium', st.text)}>{st.label}</span>
            </div>
            <div className="flex items-center gap-1 mt-0.5">
              <Phone size={9} className="text-slate-300 flex-shrink-0"/>
              <span className="text-[10px] text-slate-400 truncate">{off ? 'Not connected' : bot.number}</span>
            </div>
          </div>
        </button>

        {/* Toggle + More — always visible on mobile right side */}
        <div className="flex items-center gap-2 flex-shrink-0 sm:hidden ml-auto">
          <Toggle on={isActive} onChange={() => onToggle(bot.id)}/>
          <div className="relative">
            <button onClick={e => { e.stopPropagation(); setMenu(p => !p) }}
              className="w-6 h-6 rounded-lg flex items-center justify-center text-slate-300 hover:text-slate-500 hover:bg-slate-100 transition-colors">
              <MoreVertical size={13}/>
            </button>
            {menu && (
              <div className="absolute right-0 top-full mt-1 bg-white border border-surface-border rounded-xl z-30 py-1 w-40 animate-fade-in shadow-modal"
                onMouseLeave={() => setMenu(false)}>
                {[
                  { label: 'Open Dashboard', dest: '/dashboard'    },
                  { label: 'View Inbox',     dest: '/conversations' },
                  { label: 'Edit Flows',     dest: '/flows'         },
                  { label: 'Broadcasts',     dest: '/broadcasting'  },
                  { label: 'Analytics',      dest: '/analytics'     },
                  { label: 'Settings',       dest: '/settings'      },
                ].map(item => (
                  <button key={item.dest} onClick={() => { onOpen(bot, item.dest); setMenu(false) }}
                    className="block w-full text-left px-3 py-1.5 text-[11px] text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition-colors">
                    {item.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Metrics ── */}
      <div className="flex items-center gap-4 flex-shrink-0 sm:gap-5">
        {[
          { label: 'Contacts',    value: off ? '—' : (bot.contacts > 0 ? bot.contacts.toLocaleString() : '0') },
          { label: 'Messages',    value: off ? '—' : (bot.stats?.messagesSent || 0).toLocaleString()           },
          { label: 'Flows',       value: off ? '—' : (bot.flows ?? 0)                                         },
        ].map(s => (
          <div key={s.label} className="flex flex-col items-center gap-0.5 w-16 sm:w-20">
            <p className="text-[12px] font-bold text-slate-800 leading-none">{s.value}</p>
            <p className="text-[9px] text-slate-400 whitespace-nowrap">{s.label}</p>
          </div>
        ))}
      </div>

      {/* ── Action icons (hidden on mobile) ── */}
      <div className="hidden sm:flex items-center gap-1 flex-1 justify-center">
        {ACTIONS.map(a => (
          <button key={a.label} title={a.label}
            onClick={() => !off && onOpen(bot, a.dest)}
            disabled={off}
            className={clsx(
              'flex flex-col items-center gap-0.5 px-2 py-1.5 rounded-lg transition-colors',
              off ? 'text-slate-200 cursor-not-allowed' : 'text-slate-400 hover:text-primary hover:bg-slate-50'
            )}>
            <a.icon size={12}/>
            <span className="text-[8px] font-medium leading-none">{a.label}</span>
          </button>
        ))}
      </div>

      {/* ── Toggle + More (desktop) ── */}
      <div className="hidden sm:flex items-center gap-2 flex-shrink-0">
        <Toggle on={isActive} onChange={() => onToggle(bot.id)}/>
        <div className="relative">
          <button onClick={e => { e.stopPropagation(); setMenu(p => !p) }}
            className="w-6 h-6 rounded-lg flex items-center justify-center text-slate-300 hover:text-slate-500 hover:bg-slate-100 transition-colors">
            <MoreVertical size={13}/>
          </button>
          {menu && (
            <div className="absolute right-0 top-full mt-1 bg-white border border-surface-border rounded-xl z-30 py-1 w-40 animate-fade-in shadow-modal"
              onMouseLeave={() => setMenu(false)}>
              {[
                { label: 'Open Dashboard', dest: '/dashboard'    },
                { label: 'View Inbox',     dest: '/conversations' },
                { label: 'Edit Flows',     dest: '/flows'         },
                { label: 'Broadcasts',     dest: '/broadcasting'  },
                { label: 'Analytics',      dest: '/analytics'     },
                { label: 'Settings',       dest: '/settings'      },
              ].map(item => (
                <button key={item.dest} onClick={() => { onOpen(bot, item.dest); setMenu(false) }}
                  className="block w-full text-left px-3 py-1.5 text-[11px] text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition-colors">
                  {item.label}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

/* ─── Add Bot Modal ──────────────────────────────────────────── */
function AddBotModal({ onClose, onAdd }) {
  const [name,   setName]   = useState('')
  const [number, setNumber] = useState('')

  function submit() {
    if (!name.trim()) return
    const initials = name.trim().split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()
    onAdd({
      name: name.trim(),
      number: number.trim() || 'Not connected',
      numberName: name.trim(),
      status: 'disconnected',
      color: '#0066ff', bg: '#eff4ff', avatar: initials,
      connectedAt: null, flows: 0, contacts: 0, agents: 1, agentsOnline: 0,
      stats: { openConvs:0, resolvedToday:0, botActive:0, messagesSent:0, deliveryRate:0, botRate:0, avgReply:'—', csat:0, newContacts:0 },
    })
    onClose()
  }

  return (
    <div className="fixed inset-0 bg-slate-900/20 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-sm border border-surface-border">
        <div className="flex items-center justify-between px-5 py-4 border-b border-surface-border">
          <p className="text-[13px] font-semibold text-slate-900">Create New Bot</p>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-slate-100 text-slate-400 transition-colors">
            <X size={14}/>
          </button>
        </div>
        <div className="p-5 space-y-3">
          <div>
            <label className="block text-[11px] font-semibold text-slate-500 mb-1.5">Bot name <span className="text-red-400">*</span></label>
            <input value={name} onChange={e => setName(e.target.value)} autoFocus
              placeholder="e.g. Support Bot" className="input-sm w-full"
              onKeyDown={e => e.key === 'Enter' && submit()}/>
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-slate-500 mb-1.5">
              WhatsApp number <span className="text-[10px] text-slate-400 font-normal">(optional)</span>
            </label>
            <input value={number} onChange={e => setNumber(e.target.value)}
              placeholder="+91 98765 43210" className="input-sm w-full"/>
          </div>
          <div className="flex gap-2 pt-1">
            <button onClick={onClose}
              className="flex-1 py-2 rounded-lg border border-surface-border text-[11px] font-semibold text-slate-500 hover:bg-slate-50 transition-colors">
              Cancel
            </button>
            <button onClick={submit}
              className="flex-1 py-2 rounded-lg bg-primary text-white text-[11px] font-semibold hover:bg-primary-hover transition-colors">
              Create Bot
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

/* ─── Main ───────────────────────────────────────────────────── */
export default function Home() {
  const navigate = useNavigate()
  const { bots, setActiveBotId, addBot, updateBotStatus } = useApp()
  const [showModal, setShowModal] = useState(false)

  function openBot(bot, route = '/dashboard') {
    setActiveBotId(bot.id)
    navigate(route)
  }

  function toggleBot(id) {
    const bot = bots.find(b => b.id === id)
    if (!bot || bot.status === 'disconnected') return
    updateBotStatus(id, bot.status === 'active' ? 'paused' : 'active')
  }

  const [search,       setSearch]       = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [sortBy,       setSortBy]       = useState('default')

  const active   = bots.filter(b => b.status === 'active')
  const limitPct = Math.min((active.length / 10) * 100, 100)

  // Search filter
  const searched = bots.filter(b =>
    b.name.toLowerCase().includes(search.toLowerCase()) ||
    b.number.toLowerCase().includes(search.toLowerCase())
  )

  // Status filter
  const statusFiltered = searched.filter(b => {
    if (statusFilter === 'active')   return b.status === 'active'
    if (statusFilter === 'inactive') return b.status !== 'active'
    return true
  })

  // Sort
  function applySort(list) {
    const s = [...list]
    if (sortBy === 'name_az')       return s.sort((a, b) => a.name.localeCompare(b.name))
    if (sortBy === 'name_za')       return s.sort((a, b) => b.name.localeCompare(a.name))
    if (sortBy === 'most_messages') return s.sort((a, b) => (b.stats?.messagesSent || 0) - (a.stats?.messagesSent || 0))
    if (sortBy === 'most_contacts') return s.sort((a, b) => (b.contacts || 0) - (a.contacts || 0))
    if (sortBy === 'recent')        return s.sort((a, b) => (b.id > a.id ? 1 : -1))
    return s
  }

  const filtered         = applySort(statusFiltered)
  const filteredActive   = filtered.filter(b => b.status === 'active')
  const filteredInactive = filtered.filter(b => b.status !== 'active')

  return (
    <div className="space-y-3 animate-fade-in">

      {/* ── Plan & Credits banner ── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {/* Plan */}
        <div className="card p-4 flex items-center justify-between">
          <div>
            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wide mb-1">Current Plan</p>
            <p className="text-sm font-bold text-slate-900">Pro</p>
            <p className="text-[10px] text-slate-400 mt-0.5">Yearly · renews Jan 1, 2027</p>
          </div>
          <button className="btn-primary text-[10px] px-2.5 py-1">Upgrade</button>
        </div>

        {/* Conversation Credits */}
        <div className="card p-4">
          <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wide mb-1">WhatsApp Message Credits</p>
          <div className="flex items-end justify-between">
            <div>
              <p className="text-sm font-bold text-slate-900">6,240 <span className="text-[10px] font-normal text-slate-400">/ 100,000</span></p>
              <p className="text-[10px] text-slate-400 mt-0.5">Messages used this month</p>
            </div>
            <span className="text-[10px] font-semibold text-emerald-600">6%</span>
          </div>
          <div className="mt-2 h-1.5 bg-slate-100 rounded-full overflow-hidden">
            <div className="h-full bg-primary rounded-full" style={{ width: '6%' }}/>
          </div>
        </div>

        {/* Active Bots */}
        <div className="card p-4">
          <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wide mb-1">Active Bots</p>
          <div className="flex items-end justify-between">
            <div>
              <p className="text-sm font-bold text-slate-900">{active.length} <span className="text-[10px] font-normal text-slate-400">/ 10</span></p>
              <p className="text-[10px] text-slate-400 mt-0.5">Bot slots used</p>
            </div>
            <span className="text-[10px] font-semibold text-primary">{Math.round(limitPct)}%</span>
          </div>
          <div className="mt-2 h-1.5 bg-slate-100 rounded-full overflow-hidden">
            <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${limitPct}%` }}/>
          </div>
        </div>
      </div>

      {/* ── Toolbar ── */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="relative">
          <Search size={11} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400"/>
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search bots…" className="input-sm pl-7 w-44 text-[11px]"/>
        </div>

        {/* Status filter */}
        <div className="w-36">
          <Select
            size="sm"
            value={statusFilter}
            onChange={setStatusFilter}
            options={[
              { value: 'all',      label: 'All Status' },
              { value: 'active',   label: 'Active'     },
              { value: 'inactive', label: 'Inactive'   },
            ]}
          />
        </div>

        {/* Sort */}
        <div className="w-44">
          <Select
            size="sm"
            value={sortBy}
            onChange={setSortBy}
            options={[
              { label: 'Sort by', options: [
                { value: 'default',       label: 'Default order'     },
                { value: 'name_az',       label: 'Name A → Z'        },
                { value: 'name_za',       label: 'Name Z → A'        },
                { value: 'most_messages', label: 'Most Messages'      },
                { value: 'most_contacts', label: 'Most Contacts'      },
                { value: 'recent',        label: 'Recently Added'     },
              ]},
            ]}
          />
        </div>

        <div className="flex-1"/>
        <button onClick={() => setShowModal(true)}
          className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-primary text-white text-[11px] font-semibold hover:bg-primary-hover transition-colors">
          <Plus size={11}/> Create New Bot
        </button>
      </div>

      {/* ── Active bots ── */}
      {filteredActive.length > 0 && (
        <>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2 mb-2">
            Active
            <span className="bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded-full">{filteredActive.length}</span>
          </p>
          {filteredActive.map(bot => (
            <BotCard key={bot.id} bot={bot} onOpen={openBot} onToggle={toggleBot}/>
          ))}
        </>
      )}

      {/* ── Inactive bots ── */}
      {filteredInactive.length > 0 && (
        <>
          <p className={clsx('text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2', filteredActive.length > 0 ? 'mt-4 mb-2' : 'mb-2')}>
            Inactive
            <span className="bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded-full">{filteredInactive.length}</span>
          </p>
          {filteredInactive.map(bot => (
            <BotCard key={bot.id} bot={bot} onOpen={openBot} onToggle={toggleBot}/>
          ))}
        </>
      )}

      {/* ── Add new bot row ── */}
      {filtered.length > 0 && (
        <button onClick={() => setShowModal(true)}
          className="w-full border border-dashed border-slate-200 rounded-xl flex items-center justify-center gap-2 py-3.5 hover:border-slate-400 hover:bg-slate-50 transition-colors group mt-1">
          <div className="w-6 h-6 rounded-lg bg-slate-100 group-hover:bg-slate-200 flex items-center justify-center transition-colors">
            <Plus size={12} className="text-slate-400"/>
          </div>
          <span className="text-[11px] font-semibold text-slate-400 group-hover:text-slate-600 transition-colors">Add New Bot</span>
        </button>
      )}

      {/* ── Empty state ── */}
      {filteredActive.length === 0 && filteredInactive.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center mb-3">
            <Bot size={18} className="text-slate-300"/>
          </div>
          <p className="text-[12px] font-semibold text-slate-500">No bots found</p>
          <p className="text-[11px] text-slate-400 mt-1">Try a different search or create a new bot</p>
          <button onClick={() => setShowModal(true)}
            className="mt-4 flex items-center gap-1 px-3 py-1.5 rounded-lg bg-primary text-white text-[11px] font-semibold hover:bg-primary-hover transition-colors">
            <Plus size={12}/> Create New Bot
          </button>
        </div>
      )}

      {showModal && <AddBotModal onClose={() => setShowModal(false)} onAdd={addBot}/>}
    </div>
  )
}
