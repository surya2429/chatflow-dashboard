import { useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { Search, X, Clock, CheckCircle2, ArrowRightLeft, UserPlus, ChevronRight, Tag, Pencil, ChevronDown, Phone } from 'lucide-react'
import { useConversations } from '../../context/ConversationContext'
import { AGENTS } from '../../constants/mockData'
import { NativeSelect } from '../Select'
import clsx from 'clsx'

/**
 * Channel-agnostic inbox building blocks shared between the WhatsApp inbox
 * (src/pages/Conversations.jsx) and the Website Chat inbox
 * (src/pages/WebChatInbox.jsx). Nothing in this file references
 * WhatsApp-only concepts (templates, CTWA, 24h window). A country-code phone
 * picker lives here too — WhatsApp uses it to start a new conversation,
 * website chat uses it as an editable contact field — the picker itself
 * doesn't know or care which.
 */

/* ─── Constants ──────────────────────────────────────────────── */
export const STATUS_MAP = {
  bot:      { label: 'Bot',      dot: 'bg-primary',     badge: 'badge-blue'  },
  agent:    { label: 'Agent',    dot: 'bg-emerald-500', badge: 'badge-green' },
  resolved: { label: 'Resolved', dot: 'bg-slate-300',   badge: 'badge-gray'  },
}
export const AGENT_STATUS_DOT   = { online: 'bg-emerald-500', busy: 'bg-amber-400', offline: 'bg-slate-300' }
export const AGENT_STATUS_LABEL = { online: 'Online', busy: 'Busy', offline: 'Offline' }

export const ALL_LABELS = ['vip','lead','support','refund','appointment','order-issue','urgent','follow-up','prospect','payment']

export const EMOJIS = ['😊','😂','❤️','👍','🙏','🎉','✅','⭐','🔥','💯','😭','🤔','👀','💪','🙌','😍','🥳','😅','👋','🤝','📦','🛍️','💰','⚡','🚀']

export const CANNED = [
  { key: 'greet',    label: 'Greeting',       body: "Hi {{name}}! 👋 Thanks for reaching out. How can I help you today?" },
  { key: 'order',    label: 'Ask Order ID',    body: "Could you please share your Order ID so I can check the status for you?" },
  { key: 'wait',     label: 'Please Hold',     body: "Thanks for your patience! I'm checking this for you right now — give me just a moment." },
  { key: 'resolve',  label: 'Resolution',      body: "Your issue has been resolved! Let me know if there's anything else I can help with. 😊" },
  { key: 'escalate', label: 'Escalation Note', body: "I'm transferring you to a specialist who can better assist with your request. They'll be with you shortly!" },
]

/* ─── Small SVG icons ─────────────────────────────────────────── */
export const ExternalLinkIcon = ({ size = 12, className = '' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={className}>
    <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
    <polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/>
  </svg>
)

/* ─── Label Picker ────────────────────────────────────────────── */
export function LabelPicker({ conversation, onClose }) {
  const { addLabel, removeLabel } = useConversations()
  const labels = conversation.labels || []
  return (
    <div className="absolute top-full right-0 mt-1 w-56 bg-white rounded-xl shadow-modal border border-surface-border z-40 py-2 animate-fade-in">
      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-3 py-1.5">Labels</p>
      <div className="px-3 pb-2 flex flex-wrap gap-1.5">
        {ALL_LABELS.map(lbl => {
          const active = labels.includes(lbl)
          return (
            <button key={lbl}
              onClick={() => active ? removeLabel(conversation.id, lbl) : addLabel(conversation.id, lbl)}
              className={clsx(
                'px-2.5 py-1 rounded-full text-[11px] font-semibold border transition-all',
                active
                  ? 'bg-primary text-white border-primary'
                  : 'bg-slate-100 text-slate-600 border-slate-200 hover:border-primary hover:text-primary'
              )}>
              {active && <span className="mr-1">✓</span>}{lbl}
            </button>
          )
        })}
      </div>
      <div className="border-t border-surface-border pt-2 px-3">
        <button onClick={onClose} className="text-xs text-slate-400 hover:text-slate-600">Done</button>
      </div>
    </div>
  )
}

/* ─── Snooze picker ───────────────────────────────────────────── */
export function SnoozePicker({ onSnooze, onClose }) {
  const OPTIONS = [
    { label: '30 minutes',   value: '30m'  },
    { label: '1 hour',       value: '1h'   },
    { label: '3 hours',      value: '3h'   },
    { label: 'Tomorrow 9am', value: 'tmrw' },
    { label: 'Next Monday',  value: 'mon'  },
  ]
  return (
    <div className="absolute bottom-full right-0 mb-2 w-44 bg-white rounded-xl shadow-modal border border-surface-border z-30 py-1 animate-fade-in">
      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-3 py-1.5">Snooze until…</p>
      {OPTIONS.map(o => (
        <button key={o.value} onClick={() => { onSnooze(o.value); onClose() }}
          className="w-full text-left px-3 py-2 text-xs text-slate-700 hover:bg-surface-hover hover:text-primary transition-colors flex items-center gap-2">
          <Clock size={12} className="text-slate-400" /> {o.label}
        </button>
      ))}
    </div>
  )
}

/* ─── Transfer Agent Modal ────────────────────────────────────── */
export function TransferModal({ conversation, onClose, adminOnline }) {
  const [selected, setSelected] = useState(null)
  const [note, setNote] = useState('')
  const [search, setSearch] = useState('')
  const { assignAgent } = useConversations()

  const allOptions = [
    ...AGENTS,
    ...(adminOnline ? [{ id: 'admin', name: 'Deepak Kumar', avatar: 'DK', role: 'Admin', status: 'online', assigned: 0, color: 'bg-primary' }] : []),
  ].filter(a => a.name.toLowerCase().includes(search.toLowerCase()))

  function doTransfer() {
    if (!selected) return
    assignAgent(conversation.id, selected.id, selected.name)
    onClose()
  }

  return (
    <div className="fixed inset-0 bg-slate-900/25 z-50 flex items-center justify-center p-4" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="bg-white rounded-2xl w-full max-w-sm shadow-modal animate-fade-in overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-surface-border">
          <div>
            <h3 className="font-bold text-slate-900">Transfer Conversation</h3>
            <p className="text-xs text-slate-500 mt-0.5">Assign to another agent or admin</p>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-surface-hover text-slate-400 hover:text-slate-600 transition-colors"><X size={16} /></button>
        </div>
        <div className="px-4 pt-4 pb-2">
          <div className="relative">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input className="input pl-9 text-sm" placeholder="Search agents..." value={search} onChange={e => setSearch(e.target.value)} autoFocus />
          </div>
        </div>
        <div className="px-4 pb-2 space-y-1 max-h-52 overflow-y-auto">
          {allOptions.map(a => {
            const isSelected = selected?.id === a.id
            const isCurrent  = a.id === conversation.agentId
            return (
              <button key={a.id} disabled={isCurrent} onClick={() => setSelected(isSelected ? null : a)}
                className={clsx(
                  'w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-all border',
                  isCurrent   ? 'opacity-50 cursor-not-allowed border-transparent bg-slate-50'
                  : isSelected ? 'border-primary bg-primary-50'
                  : 'border-transparent hover:bg-surface-hover hover:border-surface-border'
                )}>
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
                    {a.assigned !== undefined && <span className="text-[10px] text-slate-400">{a.assigned} chats</span>}
                  </div>
                </div>
                {isSelected && <CheckCircle2 size={16} className="text-primary flex-shrink-0" />}
              </button>
            )
          })}
        </div>
        <div className="px-4 pb-4">
          <label className="label mb-1.5 block">Transfer note (optional)</label>
          <textarea className="textarea text-xs" rows={2} placeholder="Add a handover note for the agent…" value={note} onChange={e => setNote(e.target.value)} />
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

/* ─── Reassign Modal ──────────────────────────────────────────── */
export function ReassignModal({ conversation, onClose, adminOnline }) {
  const [step, setStep]       = useState(1)
  const [selected, setSelected] = useState(null)
  const [search, setSearch]   = useState('')
  const { assignAgent } = useConversations()

  const allOptions = [
    ...AGENTS,
    ...(adminOnline ? [{ id: 'admin', name: 'Deepak Kumar', avatar: 'DK', role: 'Admin', status: 'online', assigned: 0, color: 'bg-primary' }] : []),
  ].filter(a => a.name.toLowerCase().includes(search.toLowerCase()))

  function doReassign() {
    if (!selected) return
    assignAgent(conversation.id, selected.id, selected.name)
    onClose()
  }

  return (
    <div className="fixed inset-0 bg-slate-900/25 z-50 flex items-center justify-center p-4" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="bg-white rounded-2xl w-full max-w-sm shadow-modal animate-fade-in overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-surface-border">
          <div>
            <h3 className="font-bold text-slate-900">Reassign Agent</h3>
            <p className="text-xs text-slate-500 mt-0.5">{step === 1 ? 'Select a new agent' : 'Confirm reassignment'}</p>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-surface-hover text-slate-400 hover:text-slate-600 transition-colors"><X size={16} /></button>
        </div>

        {step === 1 ? (
          <>
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
                    className={clsx(
                      'w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-all border',
                      isCurrent   ? 'opacity-50 cursor-not-allowed border-transparent bg-slate-50'
                      : isSelected ? 'border-primary bg-primary-50'
                      : 'border-transparent hover:bg-surface-hover hover:border-surface-border'
                    )}>
                    <div className="relative flex-shrink-0">
                      <div className={clsx('w-9 h-9 rounded-full flex items-center justify-center text-white text-xs font-bold', a.color || 'bg-gradient-to-br from-slate-500 to-slate-600')}>{a.avatar}</div>
                      <span className={clsx('absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-white', AGENT_STATUS_DOT[a.status])} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-slate-800 truncate">{a.name}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className={clsx('text-[10px] font-medium', a.status === 'online' ? 'text-emerald-600' : a.status === 'busy' ? 'text-amber-600' : 'text-slate-400')}>● {AGENT_STATUS_LABEL[a.status]}</span>
                        <span className="text-[10px] text-slate-400">{a.role}</span>
                        {isCurrent && <span className="text-[10px] text-slate-400 italic">current</span>}
                      </div>
                    </div>
                    {isSelected && <CheckCircle2 size={16} className="text-primary flex-shrink-0" />}
                  </button>
                )
              })}
            </div>
            <div className="flex gap-2 px-4 pb-4">
              <button onClick={onClose} className="btn-secondary flex-1 justify-center text-sm">Cancel</button>
              <button onClick={() => selected && setStep(2)} disabled={!selected}
                className={clsx('flex-1 justify-center text-sm', selected ? 'btn-primary' : 'btn-secondary opacity-50 cursor-not-allowed')}>
                Next <ChevronRight size={14} />
              </button>
            </div>
          </>
        ) : (
          <div className="px-5 py-6 text-center">
            <div className={clsx('w-16 h-16 rounded-full flex items-center justify-center text-white text-xl font-bold mx-auto mb-4', selected?.color || 'bg-gradient-to-br from-slate-500 to-slate-600')}>
              {selected?.avatar}
            </div>
            <p className="font-bold text-slate-900 text-sm mb-1">Reassign to {selected?.name}?</p>
            <p className="text-xs text-slate-500 mb-6">This conversation will be transferred to {selected?.name}. They will be notified.</p>
            <div className="flex gap-2">
              <button onClick={() => setStep(1)} className="btn-secondary flex-1 justify-center">Back</button>
              <button onClick={doReassign} className="btn-primary flex-1 justify-center">
                <UserPlus size={14} /> Confirm
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

/* ─── Editable contact field — click to edit inline, used in both ContactPanels ── */
export function EditableField({ icon: Icon, label, value, onSave, placeholder, type = 'text' }) {
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
          <input
            ref={inputRef}
            type={type}
            value={local}
            onChange={e => setLocal(e.target.value)}
            onBlur={commit}
            onKeyDown={e => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') cancel() }}
            placeholder={placeholder || `Enter ${label.toLowerCase()}…`}
            className="w-full text-[11px] bg-transparent text-slate-800 outline-none border-b border-primary/50 pb-0.5 placeholder-slate-300"
          />
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

/* ─── Editable custom field — dropdown/boolean get dedicated widgets, everything else reuses EditableField ── */
export function EditableCustomField({ field, value, onSave }) {
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

/* ─── Country codes (comprehensive) ──────────────────────────── */
export const COUNTRY_CODES = [
  { code:'+93',  flag:'🇦🇫', name:'Afghanistan'              },
  { code:'+355', flag:'🇦🇱', name:'Albania'                  },
  { code:'+213', flag:'🇩🇿', name:'Algeria'                  },
  { code:'+376', flag:'🇦🇩', name:'Andorra'                  },
  { code:'+244', flag:'🇦🇴', name:'Angola'                   },
  { code:'+54',  flag:'🇦🇷', name:'Argentina'                },
  { code:'+374', flag:'🇦🇲', name:'Armenia'                  },
  { code:'+61',  flag:'🇦🇺', name:'Australia'                },
  { code:'+43',  flag:'🇦🇹', name:'Austria'                  },
  { code:'+994', flag:'🇦🇿', name:'Azerbaijan'               },
  { code:'+973', flag:'🇧🇭', name:'Bahrain'                  },
  { code:'+880', flag:'🇧🇩', name:'Bangladesh'               },
  { code:'+375', flag:'🇧🇾', name:'Belarus'                  },
  { code:'+32',  flag:'🇧🇪', name:'Belgium'                  },
  { code:'+501', flag:'🇧🇿', name:'Belize'                   },
  { code:'+229', flag:'🇧🇯', name:'Benin'                    },
  { code:'+975', flag:'🇧🇹', name:'Bhutan'                   },
  { code:'+591', flag:'🇧🇴', name:'Bolivia'                  },
  { code:'+387', flag:'🇧🇦', name:'Bosnia & Herzegovina'     },
  { code:'+267', flag:'🇧🇼', name:'Botswana'                 },
  { code:'+55',  flag:'🇧🇷', name:'Brazil'                   },
  { code:'+673', flag:'🇧🇳', name:'Brunei'                   },
  { code:'+359', flag:'🇧🇬', name:'Bulgaria'                 },
  { code:'+226', flag:'🇧🇫', name:'Burkina Faso'             },
  { code:'+855', flag:'🇰🇭', name:'Cambodia'                 },
  { code:'+237', flag:'🇨🇲', name:'Cameroon'                 },
  { code:'+1',   flag:'🇨🇦', name:'Canada'                   },
  { code:'+238', flag:'🇨🇻', name:'Cape Verde'               },
  { code:'+236', flag:'🇨🇫', name:'Central African Republic' },
  { code:'+56',  flag:'🇨🇱', name:'Chile'                    },
  { code:'+86',  flag:'🇨🇳', name:'China'                    },
  { code:'+57',  flag:'🇨🇴', name:'Colombia'                 },
  { code:'+242', flag:'🇨🇬', name:'Congo'                    },
  { code:'+506', flag:'🇨🇷', name:'Costa Rica'               },
  { code:'+385', flag:'🇭🇷', name:'Croatia'                  },
  { code:'+53',  flag:'🇨🇺', name:'Cuba'                     },
  { code:'+357', flag:'🇨🇾', name:'Cyprus'                   },
  { code:'+420', flag:'🇨🇿', name:'Czech Republic'           },
  { code:'+45',  flag:'🇩🇰', name:'Denmark'                  },
  { code:'+253', flag:'🇩🇯', name:'Djibouti'                 },
  { code:'+1809',flag:'🇩🇴', name:'Dominican Republic'       },
  { code:'+593', flag:'🇪🇨', name:'Ecuador'                  },
  { code:'+20',  flag:'🇪🇬', name:'Egypt'                    },
  { code:'+503', flag:'🇸🇻', name:'El Salvador'              },
  { code:'+372', flag:'🇪🇪', name:'Estonia'                  },
  { code:'+251', flag:'🇪🇹', name:'Ethiopia'                 },
  { code:'+358', flag:'🇫🇮', name:'Finland'                  },
  { code:'+33',  flag:'🇫🇷', name:'France'                   },
  { code:'+241', flag:'🇬🇦', name:'Gabon'                    },
  { code:'+220', flag:'🇬🇲', name:'Gambia'                   },
  { code:'+995', flag:'🇬🇪', name:'Georgia'                  },
  { code:'+49',  flag:'🇩🇪', name:'Germany'                  },
  { code:'+233', flag:'🇬🇭', name:'Ghana'                    },
  { code:'+30',  flag:'🇬🇷', name:'Greece'                   },
  { code:'+502', flag:'🇬🇹', name:'Guatemala'                },
  { code:'+224', flag:'🇬🇳', name:'Guinea'                   },
  { code:'+592', flag:'🇬🇾', name:'Guyana'                   },
  { code:'+509', flag:'🇭🇹', name:'Haiti'                    },
  { code:'+504', flag:'🇭🇳', name:'Honduras'                 },
  { code:'+852', flag:'🇭🇰', name:'Hong Kong'                },
  { code:'+36',  flag:'🇭🇺', name:'Hungary'                  },
  { code:'+354', flag:'🇮🇸', name:'Iceland'                  },
  { code:'+91',  flag:'🇮🇳', name:'India'                    },
  { code:'+62',  flag:'🇮🇩', name:'Indonesia'                },
  { code:'+98',  flag:'🇮🇷', name:'Iran'                     },
  { code:'+964', flag:'🇮🇶', name:'Iraq'                     },
  { code:'+353', flag:'🇮🇪', name:'Ireland'                  },
  { code:'+972', flag:'🇮🇱', name:'Israel'                   },
  { code:'+39',  flag:'🇮🇹', name:'Italy'                    },
  { code:'+225', flag:'🇨🇮', name:'Ivory Coast'              },
  { code:'+1876',flag:'🇯🇲', name:'Jamaica'                  },
  { code:'+81',  flag:'🇯🇵', name:'Japan'                    },
  { code:'+962', flag:'🇯🇴', name:'Jordan'                   },
  { code:'+7',   flag:'🇰🇿', name:'Kazakhstan'               },
  { code:'+254', flag:'🇰🇪', name:'Kenya'                    },
  { code:'+965', flag:'🇰🇼', name:'Kuwait'                   },
  { code:'+996', flag:'🇰🇬', name:'Kyrgyzstan'               },
  { code:'+856', flag:'🇱🇦', name:'Laos'                     },
  { code:'+371', flag:'🇱🇻', name:'Latvia'                   },
  { code:'+961', flag:'🇱🇧', name:'Lebanon'                  },
  { code:'+266', flag:'🇱🇸', name:'Lesotho'                  },
  { code:'+231', flag:'🇱🇷', name:'Liberia'                  },
  { code:'+218', flag:'🇱🇾', name:'Libya'                    },
  { code:'+370', flag:'🇱🇹', name:'Lithuania'                },
  { code:'+352', flag:'🇱🇺', name:'Luxembourg'               },
  { code:'+853', flag:'🇲🇴', name:'Macau'                    },
  { code:'+261', flag:'🇲🇬', name:'Madagascar'               },
  { code:'+265', flag:'🇲🇼', name:'Malawi'                   },
  { code:'+60',  flag:'🇲🇾', name:'Malaysia'                 },
  { code:'+960', flag:'🇲🇻', name:'Maldives'                 },
  { code:'+223', flag:'🇲🇱', name:'Mali'                     },
  { code:'+356', flag:'🇲🇹', name:'Malta'                    },
  { code:'+222', flag:'🇲🇷', name:'Mauritania'               },
  { code:'+230', flag:'🇲🇺', name:'Mauritius'                },
  { code:'+52',  flag:'🇲🇽', name:'Mexico'                   },
  { code:'+373', flag:'🇲🇩', name:'Moldova'                  },
  { code:'+976', flag:'🇲🇳', name:'Mongolia'                 },
  { code:'+382', flag:'🇲🇪', name:'Montenegro'               },
  { code:'+212', flag:'🇲🇦', name:'Morocco'                  },
  { code:'+258', flag:'🇲🇿', name:'Mozambique'                 },
  { code:'+95',  flag:'🇲🇲', name:'Myanmar'                  },
  { code:'+264', flag:'🇳🇦', name:'Namibia'                  },
  { code:'+977', flag:'🇳🇵', name:'Nepal'                    },
  { code:'+31',  flag:'🇳🇱', name:'Netherlands'              },
  { code:'+64',  flag:'🇳🇿', name:'New Zealand'              },
  { code:'+505', flag:'🇳🇮', name:'Nicaragua'                },
  { code:'+227', flag:'🇳🇪', name:'Niger'                    },
  { code:'+234', flag:'🇳🇬', name:'Nigeria'                  },
  { code:'+47',  flag:'🇳🇴', name:'Norway'                   },
  { code:'+968', flag:'🇴🇲', name:'Oman'                     },
  { code:'+92',  flag:'🇵🇰', name:'Pakistan'                 },
  { code:'+970', flag:'🇵🇸', name:'Palestine'                },
  { code:'+507', flag:'🇵🇦', name:'Panama'                   },
  { code:'+675', flag:'🇵🇬', name:'Papua New Guinea'         },
  { code:'+595', flag:'🇵🇾', name:'Paraguay'                 },
  { code:'+51',  flag:'🇵🇪', name:'Peru'                     },
  { code:'+63',  flag:'🇵🇭', name:'Philippines'              },
  { code:'+48',  flag:'🇵🇱', name:'Poland'                   },
  { code:'+351', flag:'🇵🇹', name:'Portugal'                 },
  { code:'+1787',flag:'🇵🇷', name:'Puerto Rico'              },
  { code:'+974', flag:'🇶🇦', name:'Qatar'                    },
  { code:'+40',  flag:'🇷🇴', name:'Romania'                  },
  { code:'+7',   flag:'🇷🇺', name:'Russia'                   },
  { code:'+250', flag:'🇷🇼', name:'Rwanda'                   },
  { code:'+966', flag:'🇸🇦', name:'Saudi Arabia'             },
  { code:'+221', flag:'🇸🇳', name:'Senegal'                  },
  { code:'+381', flag:'🇷🇸', name:'Serbia'                   },
  { code:'+232', flag:'🇸🇱', name:'Sierra Leone'             },
  { code:'+65',  flag:'🇸🇬', name:'Singapore'                },
  { code:'+421', flag:'🇸🇰', name:'Slovakia'                 },
  { code:'+386', flag:'🇸🇮', name:'Slovenia'                 },
  { code:'+252', flag:'🇸🇴', name:'Somalia'                  },
  { code:'+27',  flag:'🇿🇦', name:'South Africa'             },
  { code:'+82',  flag:'🇰🇷', name:'South Korea'              },
  { code:'+211', flag:'🇸🇸', name:'South Sudan'              },
  { code:'+34',  flag:'🇪🇸', name:'Spain'                    },
  { code:'+94',  flag:'🇱🇰', name:'Sri Lanka'                },
  { code:'+249', flag:'🇸🇩', name:'Sudan'                    },
  { code:'+597', flag:'🇸🇷', name:'Suriname'                 },
  { code:'+268', flag:'🇸🇿', name:'Swaziland'                },
  { code:'+46',  flag:'🇸🇪', name:'Sweden'                   },
  { code:'+41',  flag:'🇨🇭', name:'Switzerland'              },
  { code:'+886', flag:'🇹🇼', name:'Taiwan'                   },
  { code:'+992', flag:'🇹🇯', name:'Tajikistan'               },
  { code:'+255', flag:'🇹🇿', name:'Tanzania'                 },
  { code:'+66',  flag:'🇹🇭', name:'Thailand'                 },
  { code:'+228', flag:'🇹🇬', name:'Togo'                     },
  { code:'+1868',flag:'🇹🇹', name:'Trinidad & Tobago'        },
  { code:'+216', flag:'🇹🇳', name:'Tunisia'                  },
  { code:'+90',  flag:'🇹🇷', name:'Turkey'                   },
  { code:'+993', flag:'🇹🇲', name:'Turkmenistan'             },
  { code:'+256', flag:'🇺🇬', name:'Uganda'                   },
  { code:'+380', flag:'🇺🇦', name:'Ukraine'                  },
  { code:'+971', flag:'🇦🇪', name:'United Arab Emirates'     },
  { code:'+44',  flag:'🇬🇧', name:'United Kingdom'           },
  { code:'+1',   flag:'🇺🇸', name:'United States'            },
  { code:'+598', flag:'🇺🇾', name:'Uruguay'                  },
  { code:'+998', flag:'🇺🇿', name:'Uzbekistan'               },
  { code:'+58',  flag:'🇻🇪', name:'Venezuela'                },
  { code:'+84',  flag:'🇻🇳', name:'Vietnam'                  },
  { code:'+967', flag:'🇾🇪', name:'Yemen'                    },
  { code:'+260', flag:'🇿🇲', name:'Zambia'                   },
  { code:'+263', flag:'🇿🇼', name:'Zimbabwe'                 },
]

/* ─── Searchable country-code picker ──────────────────────────── */
export function CountryCodePicker({ value, onChange }) {
  const [open,   setOpen]   = useState(false)
  const [search, setSearch] = useState('')
  const btnRef  = useRef(null)
  const dropRef = useRef(null)
  const inputRef = useRef(null)

  const selected = COUNTRY_CODES.find(c => c.code === value) || COUNTRY_CODES[0]
  const filtered = search.trim()
    ? COUNTRY_CODES.filter(c =>
        c.name.toLowerCase().includes(search.toLowerCase()) ||
        c.code.includes(search)
      )
    : COUNTRY_CODES

  useEffect(() => {
    if (!open) return
    setTimeout(() => inputRef.current?.focus(), 50)
    function handle(e) {
      if (!btnRef.current?.contains(e.target) && !dropRef.current?.contains(e.target))
        setOpen(false)
    }
    document.addEventListener('mousedown', handle)
    return () => document.removeEventListener('mousedown', handle)
  }, [open])

  const [pos, setPos] = useState({ top:0, left:0, width:0 })
  function openPicker() {
    const r = btnRef.current.getBoundingClientRect()
    setPos({ top: r.bottom + 4, left: r.left, width: Math.max(r.width, 260) })
    setOpen(true)
    setSearch('')
  }

  return (
    <>
      <button ref={btnRef} type="button"
        onClick={open ? () => setOpen(false) : openPicker}
        className={clsx(
          'flex items-center gap-1.5 px-2.5 py-2 rounded-lg border text-sm transition-all flex-shrink-0',
          open ? 'border-primary ring-2 ring-primary/10 bg-white' : 'border-surface-border bg-white hover:border-primary/40'
        )}>
        <span className="text-base leading-none">{selected.flag}</span>
        <span className="font-mono text-slate-700 text-[12px]">{selected.code}</span>
        <ChevronDown size={11} className={clsx('text-slate-400 transition-transform', open && 'rotate-180')} />
      </button>

      {open && createPortal(
        <div ref={dropRef}
          className="bg-white rounded-xl border border-surface-border shadow-modal overflow-hidden flex flex-col"
          style={{ position:'fixed', top:pos.top, left:pos.left, width:260, zIndex:99999, maxHeight:320 }}>
          {/* Search */}
          <div className="px-2.5 py-2 border-b border-surface-border flex-shrink-0">
            <div className="relative">
              <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400"/>
              <input ref={inputRef} value={search} onChange={e => setSearch(e.target.value)}
                placeholder="Search country or code…"
                className="w-full pl-7 pr-2 py-1.5 text-[11px] border border-surface-border rounded-lg bg-slate-50 focus:outline-none focus:border-primary/40 focus:bg-white"/>
            </div>
          </div>
          {/* List */}
          <div className="overflow-y-auto flex-1 py-1">
            {filtered.length === 0 && (
              <p className="text-center text-[11px] text-slate-400 py-4">No results</p>
            )}
            {filtered.map((c, i) => (
              <button key={`${c.code}-${i}`}
                onClick={() => { onChange(c.code); setOpen(false) }}
                className={clsx(
                  'w-full flex items-center gap-2.5 px-3 py-1.5 text-left transition-colors',
                  c.code === value ? 'bg-primary-50 text-primary' : 'text-slate-700 hover:bg-surface-hover'
                )}>
                <span className="text-base leading-none flex-shrink-0">{c.flag}</span>
                <span className="flex-1 text-[11px] truncate">{c.name}</span>
                <span className="font-mono text-[11px] text-slate-400 flex-shrink-0">{c.code}</span>
                {c.code === value && <CheckCircle2 size={11} className="text-primary flex-shrink-0"/>}
              </button>
            ))}
          </div>
        </div>,
        document.body
      )}
    </>
  )
}

/* ─── Editable phone field — country-code picker + number, click to edit ──
   Used where a phone number is plain captured contact info rather than a
   channel identity (WhatsApp's own number is read-only elsewhere). ── */
export function EditablePhoneField({ label = 'Phone', value, onSave }) {
  const [editing, setEditing] = useState(false)
  const sortedCodes = [...COUNTRY_CODES].sort((a, b) => b.code.length - a.code.length)
  function split(v) {
    const match = (v || '').trim() && sortedCodes.find(c => (v || '').startsWith(c.code))
    return match
      ? { cc: match.code, number: v.slice(match.code.length).trim() }
      : { cc: '+91', number: (v || '').trim() }
  }
  const [cc, setCc]         = useState(() => split(value).cc)
  const [number, setNumber] = useState(() => split(value).number)
  const inputRef = useRef(null)

  useEffect(() => { const s = split(value); setCc(s.cc); setNumber(s.number) }, [value])
  useEffect(() => { if (editing) inputRef.current?.focus() }, [editing])

  function commit() {
    setEditing(false)
    onSave(number.trim() ? `${cc} ${number.trim()}` : '')
  }
  function cancel() { const s = split(value); setCc(s.cc); setNumber(s.number); setEditing(false) }

  if (editing) {
    return (
      <div className="flex items-start gap-2.5 px-3 py-2 bg-primary-50/40 border-b border-surface-border/40">
        <Phone size={12} className="text-primary flex-shrink-0 mt-1.5" />
        <div className="flex-1 min-w-0">
          <p className="text-[9px] text-primary font-semibold mb-1">{label}</p>
          <div className="flex items-center gap-1.5">
            <CountryCodePicker value={cc} onChange={setCc} />
            <input
              ref={inputRef}
              type="tel"
              value={number}
              onChange={e => setNumber(e.target.value)}
              onBlur={commit}
              onKeyDown={e => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') cancel() }}
              placeholder="98765 43210"
              className="flex-1 min-w-0 text-[12px] bg-white border border-surface-border rounded-lg px-2.5 py-2 text-slate-800 outline-none focus:border-primary/40"
            />
          </div>
        </div>
        <button onMouseDown={e => { e.preventDefault(); cancel() }}
          className="text-slate-300 hover:text-slate-500 mt-1 flex-shrink-0"><X size={10}/></button>
      </div>
    )
  }

  return (
    <div onClick={() => setEditing(true)}
      className="flex items-start gap-2.5 px-3 py-2 group hover:bg-slate-50 cursor-pointer border-b border-surface-border/40 transition-colors">
      <Phone size={12} className={clsx('flex-shrink-0 mt-0.5', value ? 'text-slate-400' : 'text-slate-200')} />
      <div className="flex-1 min-w-0">
        <p className="text-[9px] text-slate-400 leading-none mb-0.5">{label}</p>
        <p className={clsx('text-[11px] break-words leading-snug font-mono', value ? 'text-slate-700 font-medium' : 'text-slate-300 italic font-sans')}>
          {value || `Add ${label.toLowerCase()}…`}
        </p>
      </div>
      <Pencil size={10} className="text-slate-300 opacity-0 group-hover:opacity-100 flex-shrink-0 mt-1 transition-opacity" />
    </div>
  )
}

/* ─── Emoji Picker ────────────────────────────────────────────── */
export function EmojiPicker({ onSelect, onClose }) {
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
