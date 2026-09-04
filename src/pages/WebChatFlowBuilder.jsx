// WebChatFlowBuilder.jsx — node-based pan/zoom canvas flow builder for the website
// chat widget, adapted from the same engine used by WhatsApp's FlowSetup.jsx and
// Instagram's InstagramFlowBuilder.jsx (pan/zoom/drag-to-connect/minimap/undo-redo),
// with a Web-Chat-relevant node palette (page-visit/idle/exit-intent triggers, lead
// capture, CSAT rating, live-agent handover) instead of DM/comment concepts.
import { useState, useRef, useEffect, useCallback, useMemo } from 'react'
import clsx from 'clsx'
import {
  Plus, X, ChevronLeft, ChevronDown, ChevronUp, Save, Trash2, Copy, Edit3, Check, Search,
  Send, Image as ImageIcon, MessageCircle, MessageSquareText, Hash, Variable,
  AlertCircle, ExternalLink, Clock, GitBranch, Shuffle, Link2, Zap, Maximize2, ZoomIn, ZoomOut,
  Globe, LogOut, Star, UserPlus, PhoneForwarded, BookOpen,
} from 'lucide-react'
import { NativeSelect } from '../components/Select'
import { QUESTION_TYPES as WEBCHAT_QUESTION_TYPES } from '../constants/webchatQuestionTypes'

/* ─── one draggable palette block per question type — "ask_<id>" — instead ──
   of a single generic "Ask Question" block, mirroring Instagram's flow builder.
   Reuses Web Chat's own 22 question types (Text/Choice/Date & Time/Media/Special)
   rather than a separate hardcoded list, so the palette can't drift from the
   Question Types catalog. ── */
const ASK_DEFS = Object.fromEntries(WEBCHAT_QUESTION_TYPES.map(q => [
  `ask_${q.id}`,
  { label: q.name, desc: q.desc, icon: q.icon, color: q.color, cat: 'ask', questionType: q.id },
]))

/* ─── node definitions — trimmed to what a website widget flow can actually do ── */
const DEFS = {
  start:        { label: 'Trigger',          icon: Zap,             color: '#0066ff', cat: 'system' },
  end:          { label: 'End Flow',         icon: X,               color: '#64748b', cat: 'system' },
  send_text:    { label: 'Send Message',     icon: Send,            color: '#10b981', cat: 'send' },
  send_media:   { label: 'Send Image',       icon: ImageIcon,       color: '#10b981', cat: 'send' },
  quick_replies:{ label: 'Quick Replies',    icon: MessageSquareText, color: '#10b981', cat: 'send' },
  show_article: { label: 'Show Help Article', icon: BookOpen,       color: '#10b981', cat: 'send' },
  ...ASK_DEFS,
  tag:          { label: 'Add Tag',          icon: Hash,            color: '#3b82f6', cat: 'action' },
  untag:        { label: 'Remove Tag',       icon: Hash,            color: '#3b82f6', cat: 'action' },
  setfield:     { label: 'Set Custom Field', icon: Variable,        color: '#3b82f6', cat: 'action' },
  notify:       { label: 'Notify Agent',     icon: AlertCircle,     color: '#3b82f6', cat: 'action' },
  crm:          { label: 'Push to CRM',      icon: ExternalLink,    color: '#3b82f6', cat: 'action' },
  lead_capture: { label: 'Capture Lead',     icon: UserPlus,        color: '#3b82f6', cat: 'action' },
  csat_rating:  { label: 'Trigger Rating',   icon: Star,            color: '#3b82f6', cat: 'action' },
  live_chat:    { label: 'Handover to Agent', icon: PhoneForwarded, color: '#3b82f6', cat: 'action' },
  delay:        { label: 'Smart Delay',      icon: Clock,           color: '#8b5cf6', cat: 'utility' },
  condition:    { label: 'Condition',        icon: GitBranch,       color: '#8b5cf6', cat: 'utility' },
  split:        { label: 'Random Split',     icon: Shuffle,         color: '#8b5cf6', cat: 'utility' },
  setvar:       { label: 'Set Variable',     icon: Variable,        color: '#8b5cf6', cat: 'utility' },
  webhook:      { label: 'External Request', icon: Link2,           color: '#06b6d4', cat: 'connector' },
}
const CAT_ORDER  = ['system', 'send', 'ask', 'action', 'utility', 'connector']
const CAT_LABELS = { system: 'Trigger & End', send: 'Send', ask: 'Ask Questions', action: 'Actions', utility: 'Utilities', connector: 'Connectors' }
const CAT_COLOR  = { system: '#0066ff', send: '#10b981', ask: '#f59e0b', action: '#3b82f6', utility: '#8b5cf6', connector: '#06b6d4' }

const TRIGGER_TYPES = [
  { v: 'widget_open',  l: 'Widget Opened',  icon: MessageCircle },
  { v: 'page_visit',   l: 'Page Visit',     icon: Globe },
  { v: 'keyword',      l: 'Message Keyword', icon: MessageSquareText },
  { v: 'idle_time',    l: 'Visitor Idle',   icon: Clock },
  { v: 'exit_intent',  l: 'Exit Intent',    icon: LogOut },
]

function makeDefaults(type) {
  const base = { name: DEFS[type]?.label || type }
  if (DEFS[type]?.cat === 'ask' && DEFS[type]?.questionType) return { ...base, questionType: DEFS[type].questionType, question: '', saveAs: '' }
  switch (type) {
    case 'start':         return { ...base, trigger: 'widget_open', keywords: '', pageUrl: '', idleSeconds: 30 }
    case 'end':           return { ...base, endMessage: '' }
    case 'send_text':     return { ...base, message: '' }
    case 'send_media':    return { ...base, mediaType: 'image', caption: '' }
    case 'quick_replies': return { ...base, message: '', buttons: [{ id: '1', label: '' }, { id: '2', label: '' }] }
    case 'show_article':  return { ...base, articleTitle: '', articleUrl: '' }
    case 'tag':            return { ...base, tagName: '' }
    case 'untag':          return { ...base, tagName: '' }
    case 'setfield':       return { ...base, field: '', value: '' }
    case 'notify':         return { ...base, note: '' }
    case 'crm':             return { ...base, note: 'Push visitor + collected fields to CRM' }
    case 'lead_capture':    return { ...base, captureName: true, captureEmail: true, capturePhone: false, message: 'Before we continue, can I get a few details?' }
    case 'csat_rating':     return { ...base, message: 'How would you rate this conversation?' }
    case 'live_chat':       return { ...base, note: 'Pauses the bot and assigns this conversation to a human agent' }
    case 'delay':          return { ...base, duration: 30, unit: 'seconds' }
    case 'condition':      return { ...base, variable: '', operator: 'equals', value: '', trueLabel: 'Yes', falseLabel: 'No' }
    case 'split':          return { ...base, labelA: 'Path A (50%)', labelB: 'Path B (50%)' }
    case 'setvar':         return { ...base, variable: '', value: '' }
    case 'webhook':         return { ...base, method: 'POST', url: '' }
    default:                return base
  }
}

function getOutputPorts(node) {
  const d = node.data || {}
  switch (node.type) {
    case 'end':            return []
    case 'condition':      return [{ label: d.trueLabel || 'Yes', idx: 0 }, { label: d.falseLabel || 'No', idx: 1 }]
    case 'split':           return [{ label: d.labelA || 'Path A', idx: 0 }, { label: d.labelB || 'Path B', idx: 1 }]
    case 'quick_replies':  return (d.buttons || []).map((b, i) => ({ label: b.label || `Option ${i + 1}`, idx: i }))
    default:                return [{ label: '→', idx: 0 }]
  }
}

const NODE_W = 210
const NODE_H = 66
const PORT_R = 7
const MAX_NODES = 60

let _uid = 100
const uid = () => `n${++_uid}`
const bezier = (x1, y1, x2, y2) => { const dx = Math.abs(x2 - x1) * 0.5; return `M${x1},${y1} C${x1 + dx},${y1} ${x2 - dx},${y2} ${x2},${y2}` }

/* ─── seed flows, expressed as node/edge graphs ──────────────────────── */
function seedFlows() {
  const flow1 = {
    nodes: [
      { id: 'n1', type: 'start',        x: 40,  y: 160, data: { name: 'Visitor Idle', trigger: 'idle_time', keywords: '', pageUrl: '', idleSeconds: 45 } },
      { id: 'n2', type: 'send_text',    x: 300, y: 160, data: { name: 'Nudge', message: 'Still there? 👋 Need help finding something?' } },
      { id: 'n3', type: 'quick_replies', x: 560, y: 160, data: { name: 'Offer help', message: '', buttons: [{ id: '1', label: 'Yes, help me' }, { id: '2', label: 'No thanks' }] } },
      { id: 'n4', type: 'notify',       x: 820, y: 60,  data: { name: 'Alert agent', note: 'Visitor requested help' } },
      { id: 'n5', type: 'end',          x: 820, y: 260, data: { name: 'End', endMessage: '' } },
    ],
    edges: [
      { id: 'e1', fromId: 'n1', fromPort: 0, toId: 'n2' },
      { id: 'e2', fromId: 'n2', fromPort: 0, toId: 'n3' },
      { id: 'e3', fromId: 'n3', fromPort: 0, toId: 'n4' },
      { id: 'e4', fromId: 'n3', fromPort: 1, toId: 'n5' },
    ],
  }
  const flow2 = {
    nodes: [
      { id: 'n1', type: 'start',        x: 40,  y: 160, data: { name: 'Widget Opened', trigger: 'widget_open', keywords: '', pageUrl: '', idleSeconds: 30 } },
      { id: 'n2', type: 'send_text',    x: 300, y: 160, data: { name: 'Greeting', message: "Hi there! 👋 I'm here to help — mind sharing a few details first?" } },
      { id: 'n3', type: 'lead_capture', x: 560, y: 160, data: { name: 'Capture lead', captureName: true, captureEmail: true, capturePhone: false, message: '' } },
      { id: 'n4', type: 'crm',          x: 820, y: 160, data: { name: 'Push lead', note: 'Push visitor + collected fields to CRM' } },
    ],
    edges: [
      { id: 'e1', fromId: 'n1', fromPort: 0, toId: 'n2' },
      { id: 'e2', fromId: 'n2', fromPort: 0, toId: 'n3' },
      { id: 'e3', fromId: 'n3', fromPort: 0, toId: 'n4' },
    ],
  }
  const flow3 = {
    nodes: [
      { id: 'n1', type: 'start',      x: 40,  y: 160, data: { name: 'Keyword Match', trigger: 'keyword', keywords: 'human, agent, support', pageUrl: '', idleSeconds: 30 } },
      { id: 'n2', type: 'send_text',  x: 300, y: 160, data: { name: 'Bridge message', message: "Sure — connecting you to our support team now..." } },
      { id: 'n3', type: 'live_chat',  x: 560, y: 160, data: { name: 'Handover', note: 'Pauses the bot and assigns this conversation to a human agent' } },
    ],
    edges: [
      { id: 'e1', fromId: 'n1', fromPort: 0, toId: 'n2' },
      { id: 'e2', fromId: 'n2', fromPort: 0, toId: 'n3' },
    ],
  }
  return [
    { id: 'f1', name: 'Idle Visitor Nudge',    active: true,  trigger: 'Visitor Idle',   graph: flow1, stats: { triggered: 862,  completed: 640 } },
    { id: 'f2', name: 'Lead Capture Funnel',   active: true,  trigger: 'Widget Opened',  graph: flow2, stats: { triggered: 1530, completed: 1120 } },
    { id: 'f3', name: 'Support Handoff',       active: false, trigger: 'Message Keyword', graph: flow3, stats: { triggered: 0,   completed: 0 } },
  ]
}
export const INITIAL_FLOWS = seedFlows()

/* ─── node card (SVG) ─────────────────────────────────────────────────── */
function NodeCard({ node, selected, onSelect, onDragStart, onPortMouseDown, isConnectTarget, connecting }) {
  const def = DEFS[node.type] || { label: node.type, icon: Zap, color: '#0066ff' }
  const Icon = def.icon
  const ports = getOutputPorts(node)
  const canReceive = connecting && connecting.fromId !== node.id

  return (
    <g transform={`translate(${node.x},${node.y})`} style={{ cursor: 'grab', userSelect: 'none' }}
      onMouseDown={e => { e.stopPropagation(); if (!connecting) onDragStart(e, node.id) }}
      onClick={e => { e.stopPropagation(); if (!connecting) onSelect(node.id) }}>
      <rect x={2} y={4} width={NODE_W} height={NODE_H} rx={10} fill="rgba(0,0,0,0.07)"/>
      <rect x={0} y={0} width={NODE_W} height={NODE_H} rx={10} fill="#fff"
        stroke={isConnectTarget ? '#0066ff' : selected ? '#0066ff' : '#e5e7eb'}
        strokeWidth={isConnectTarget ? 2.5 : selected ? 2 : 1}/>
      {isConnectTarget && <rect x={-3} y={-3} width={NODE_W + 6} height={NODE_H + 6} rx={13} fill="none" stroke="#0066ff" strokeWidth={1.5} opacity={0.25}/>}
      <rect x={0} y={0} width={5} height={NODE_H} rx={4} fill={def.color}/>
      <rect x={3} y={0} width={2} height={NODE_H} fill={def.color}/>
      <circle cx={30} cy={NODE_H / 2} r={16} fill={def.color + '1a'}/>
      <foreignObject x={22} y={NODE_H / 2 - 9} width={18} height={18}>
        <Icon size={16} color={def.color}/>
      </foreignObject>
      <text x={55} y={NODE_H / 2 - 7} fontSize={12} fontWeight={700} fill="#111827" dominantBaseline="middle">
        {(node.data?.name || def.label).slice(0, 20)}
      </text>
      <text x={55} y={NODE_H / 2 + 9} fontSize={10} fill="#9ca3af" dominantBaseline="middle">
        {def.label}
      </text>
      <circle cx={0} cy={NODE_H / 2} r={PORT_R}
        fill={isConnectTarget ? '#0066ff' : '#fff'}
        stroke={isConnectTarget ? '#0066ff' : '#d1d5db'}
        strokeWidth={1.5}
        style={{ cursor: canReceive ? 'crosshair' : 'default', pointerEvents: canReceive ? 'all' : 'none' }}/>
      <circle cx={0} cy={NODE_H / 2} r={3} fill={isConnectTarget ? '#fff' : '#9ca3af'} style={{ pointerEvents: 'none' }}/>
      {ports.map((p, i) => {
        const py = ports.length === 1 ? NODE_H / 2 : (NODE_H / (ports.length + 1)) * (i + 1)
        return (
          <g key={i}>
            <circle cx={NODE_W} cy={py} r={PORT_R + 5} fill="transparent" style={{ cursor: 'crosshair' }}
              onMouseDown={e => { e.stopPropagation(); onPortMouseDown && onPortMouseDown(e, node.id, i) }}/>
            <circle cx={NODE_W} cy={py} r={PORT_R} fill={def.color} stroke="#fff" strokeWidth={1.5} style={{ cursor: 'crosshair', pointerEvents: 'none' }}/>
            <circle cx={NODE_W} cy={py} r={3} fill="#fff" style={{ pointerEvents: 'none' }}/>
            {ports.length > 1 && (
              <text x={NODE_W - 10} y={py} fontSize={9} fill="#6b7280" textAnchor="end" dominantBaseline="middle" style={{ pointerEvents: 'none' }}>
                {p.label.slice(0, 14)}
              </text>
            )}
          </g>
        )
      })}
      {selected && <rect x={0} y={0} width={NODE_W} height={NODE_H} rx={10} fill="none" stroke="#0066ff" strokeWidth={2} opacity={0.3} style={{ pointerEvents: 'none' }}/>}
    </g>
  )
}

/* ─── left block-library palette ──────────────────────────────────────── */
function LeftPalette({ onAdd, nodeCount }) {
  const [q, setQ] = useState('')
  const [openCat, setOpenCat] = useState('send')
  const filtered = q ? Object.entries(DEFS).filter(([, d]) => d.label.toLowerCase().includes(q.toLowerCase())) : null

  return (
    <div className="w-56 flex-shrink-0 bg-white border-r border-surface-border flex flex-col overflow-hidden">
      <div className="p-2.5 border-b border-surface-border flex-shrink-0">
        <div className="relative">
          <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"/>
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search nodes..."
            className="w-full pl-7 pr-3 py-1.5 text-[11px] border border-surface-border rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-primary/15 focus:border-primary/40 transition-all"/>
        </div>
        <div className="flex items-center justify-between mt-1.5 px-0.5">
          <span className="text-[10px] text-slate-400">Nodes</span>
          <span className="text-[10px] font-bold text-slate-400">{nodeCount}/{MAX_NODES}</span>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto">
        {filtered ? (
          <div className="p-1.5 space-y-0.5">
            {filtered.map(([type, def]) => {
              const Icon = def.icon
              return (
                <button key={type} onClick={() => nodeCount < MAX_NODES && onAdd(type)} disabled={nodeCount >= MAX_NODES}
                  className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-slate-50 transition-colors text-left disabled:opacity-40">
                  <div className="w-6 h-6 rounded-md flex items-center justify-center flex-shrink-0" style={{ background: def.color + '18' }}>
                    <Icon size={12} style={{ color: def.color }}/>
                  </div>
                  <span className="text-[11px] font-medium text-slate-700 truncate">{def.label}</span>
                </button>
              )
            })}
            {filtered.length === 0 && <p className="text-[11px] text-slate-400 text-center py-4">No nodes found</p>}
          </div>
        ) : (
          CAT_ORDER.map(cat => {
            const catNodes = Object.entries(DEFS).filter(([, d]) => d.cat === cat)
            const isOpen = openCat === cat
            return (
              <div key={cat}>
                <button onClick={() => setOpenCat(isOpen ? null : cat)}
                  className="w-full flex items-center justify-between px-3 py-2 hover:bg-slate-50 transition-colors border-b border-surface-border">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full" style={{ background: CAT_COLOR[cat] }}/>
                    <span className="text-[11px] font-bold text-slate-600">{CAT_LABELS[cat]}</span>
                    <span className="text-[10px] text-slate-400 bg-slate-100 rounded-full px-1.5">{catNodes.length}</span>
                  </div>
                  {isOpen ? <ChevronUp size={11} className="text-slate-400"/> : <ChevronDown size={11} className="text-slate-400"/>}
                </button>
                {isOpen && (
                  <div className="p-1.5 bg-slate-50/50 space-y-0.5">
                    {catNodes.map(([type, def]) => {
                      const Icon = def.icon
                      return (
                        <button key={type} onClick={() => nodeCount < MAX_NODES && onAdd(type)} disabled={nodeCount >= MAX_NODES}
                          className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-white transition-colors text-left disabled:opacity-40 border border-transparent hover:border-surface-border">
                          <div className="w-5 h-5 rounded flex items-center justify-center flex-shrink-0" style={{ background: def.color + '18' }}>
                            <Icon size={11} style={{ color: def.color }}/>
                          </div>
                          <span className="text-[11px] text-slate-600 truncate">{def.label}</span>
                        </button>
                      )
                    })}
                  </div>
                )}
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}

/* ─── minimap ──────────────────────────────────────────────────────────── */
function Minimap({ nodes, edges, zoom, pan, svgRef }) {
  const MM_W = 160, MM_H = 110
  if (!nodes.length) return null
  const xs = nodes.map(n => n.x), ys = nodes.map(n => n.y)
  const minX = Math.min(...xs) - 20, minY = Math.min(...ys) - 20
  const maxX = Math.max(...xs) + NODE_W + 20, maxY = Math.max(...ys) + NODE_H + 20
  const w = maxX - minX || 1, h = maxY - minY || 1
  const s = Math.min(MM_W / w, MM_H / h, 1)
  const tx = n => (n.x - minX) * s
  const ty = n => (n.y - minY) * s
  let vpX = 0, vpY = 0, vpW = MM_W, vpH = MM_H
  if (svgRef?.current) {
    const r = svgRef.current.getBoundingClientRect()
    const vx = (-pan.x) / zoom, vy = (-pan.y) / zoom
    const vw = r.width / zoom, vh = r.height / zoom
    vpX = (vx - minX) * s; vpY = (vy - minY) * s; vpW = vw * s; vpH = vh * s
  }
  return (
    <div className="absolute bottom-4 right-4 z-20 bg-white border border-surface-border rounded-xl shadow-md overflow-hidden" style={{ width: MM_W + 8, height: MM_H + 8 }}>
      <svg width={MM_W} height={MM_H} style={{ display: 'block', margin: 4 }}>
        {edges.map(e => {
          const from = nodes.find(n => n.id === e.fromId), to = nodes.find(n => n.id === e.toId)
          if (!from || !to) return null
          return <line key={e.id} x1={tx(from) + NODE_W * s} y1={ty(from) + NODE_H / 2 * s} x2={tx(to)} y2={ty(to) + NODE_H / 2 * s} stroke="#cbd5e1" strokeWidth={1}/>
        })}
        {nodes.map(n => {
          const def = DEFS[n.type] || {}
          return <rect key={n.id} x={tx(n)} y={ty(n)} width={Math.max(NODE_W * s, 4)} height={Math.max(NODE_H * s, 3)} rx={2} fill={def.color || '#94a3b8'} opacity={0.7}/>
        })}
        <rect x={vpX} y={vpY} width={vpW} height={vpH} fill="none" stroke="#0066ff" strokeWidth={1.5} strokeDasharray="3,2" opacity={0.6}/>
      </svg>
    </div>
  )
}

/* ─── node properties editor (modal) — lean, per-type field sets ───────── */
function NodeEditModal({ node, onChange, onDelete, onClose }) {
  const def = DEFS[node.type] || { label: node.type, icon: Zap, color: '#0066ff', cat: 'system' }
  const Icon = def.icon
  const catColor = CAT_COLOR[def.cat] || '#0066ff'
  const [local, setLocal] = useState(node)
  useEffect(() => { setLocal(node) }, [node.id])
  const d = local.data || {}
  const set = (k, v) => setLocal(n => ({ ...n, data: { ...n.data, [k]: v } }))
  const save = () => { onChange(local); onClose() }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(15,23,42,0.45)', backdropFilter: 'blur(4px)' }}
      onMouseDown={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md flex flex-col overflow-hidden max-h-[85vh]">
        <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: catColor + '15', border: `1.5px solid ${catColor}25` }}>
              <Icon size={14} style={{ color: catColor }}/>
            </div>
            <div className="min-w-0">
              <p className="text-xs font-bold text-slate-900 truncate">{def.label}</p>
              <span className="text-[9px] font-semibold rounded-full px-1.5 py-0.5" style={{ color: catColor, background: catColor + '15' }}>{CAT_LABELS[def.cat]}</span>
            </div>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-surface-hover text-slate-400 flex-shrink-0"><X size={15}/></button>
        </div>

        <div className="p-4 space-y-3 overflow-y-auto">
          <div className="space-y-1">
            <label className="label">Node name</label>
            <input className="input" value={d.name || ''} onChange={e => set('name', e.target.value)}/>
          </div>

          {node.type === 'start' && (
            <>
              <div className="space-y-1">
                <label className="label">Trigger</label>
                <div className="grid grid-cols-2 gap-1.5">
                  {TRIGGER_TYPES.map(t => (
                    <button key={t.v} onClick={() => set('trigger', t.v)}
                      className={clsx('flex items-center gap-1.5 px-2 py-1.5 rounded-lg border text-[11px] font-semibold transition-colors',
                        d.trigger === t.v ? 'border-primary bg-primary-50 text-primary' : 'border-surface-border text-slate-600 hover:bg-surface-hover')}>
                      <t.icon size={11}/> {t.l}
                    </button>
                  ))}
                </div>
              </div>
              {d.trigger === 'page_visit' && (
                <div className="space-y-1"><label className="label">Page URL contains</label>
                  <input className="input" placeholder="e.g. /pricing" value={d.pageUrl || ''} onChange={e => set('pageUrl', e.target.value)}/>
                </div>
              )}
              {d.trigger === 'keyword' && (
                <div className="space-y-1"><label className="label">Keywords</label>
                  <input className="input" placeholder="e.g. price, cost, refund" value={d.keywords || ''} onChange={e => set('keywords', e.target.value)}/>
                </div>
              )}
              {d.trigger === 'idle_time' && (
                <div className="space-y-1"><label className="label">Idle for (seconds)</label>
                  <input type="number" className="input" value={d.idleSeconds ?? 30} onChange={e => set('idleSeconds', +e.target.value)}/>
                </div>
              )}
            </>
          )}

          {node.type === 'end' && (
            <div className="space-y-1"><label className="label">Final message (optional)</label>
              <textarea className="textarea" rows={2} value={d.endMessage || ''} onChange={e => set('endMessage', e.target.value)}/>
            </div>
          )}

          {node.type === 'send_text' && (
            <div className="space-y-1"><label className="label">Message</label>
              <textarea className="textarea" rows={3} value={d.message || ''} onChange={e => set('message', e.target.value)}/>
            </div>
          )}

          {node.type === 'send_media' && (
            <>
              <div className="space-y-1"><label className="label">Media type</label>
                <NativeSelect sm value={d.mediaType} onChange={e => set('mediaType', e.target.value)}>
                  <option value="image">Image</option><option value="video">Video</option>
                </NativeSelect>
              </div>
              <div className="space-y-1"><label className="label">Caption</label>
                <textarea className="textarea" rows={2} value={d.caption || ''} onChange={e => set('caption', e.target.value)}/>
              </div>
            </>
          )}

          {node.type === 'quick_replies' && (
            <>
              <div className="space-y-1"><label className="label">Message</label>
                <textarea className="textarea" rows={2} value={d.message || ''} onChange={e => set('message', e.target.value)}/>
              </div>
              <div className="space-y-1.5">
                <label className="label">Buttons <span className="text-slate-400 font-normal">(each is a separate output — max 3)</span></label>
                {(d.buttons || []).map((b, i) => (
                  <div key={b.id} className="flex gap-1.5">
                    <input className="input-sm flex-1" placeholder={`Option ${i + 1}`} value={b.label}
                      onChange={e => set('buttons', d.buttons.map(x => x.id === b.id ? { ...x, label: e.target.value } : x))}/>
                    <button onClick={() => set('buttons', d.buttons.filter(x => x.id !== b.id))} className="p-1.5 text-slate-400 hover:text-red-500"><X size={13}/></button>
                  </div>
                ))}
                {(d.buttons || []).length < 3 && (
                  <button onClick={() => set('buttons', [...(d.buttons || []), { id: String(Date.now()), label: '' }])}
                    className="text-[11px] text-primary font-semibold hover:underline flex items-center gap-1"><Plus size={11}/> Add button</button>
                )}
              </div>
            </>
          )}

          {node.type === 'show_article' && (
            <>
              <div className="space-y-1"><label className="label">Article title</label>
                <input className="input" placeholder="e.g. How do refunds work?" value={d.articleTitle || ''} onChange={e => set('articleTitle', e.target.value)}/>
              </div>
              <div className="space-y-1"><label className="label">Article URL / slug</label>
                <input className="input" placeholder="e.g. help/refunds" value={d.articleUrl || ''} onChange={e => set('articleUrl', e.target.value)}/>
              </div>
              <p className="text-[9px] text-slate-400">Opens the widget's Help Center screen directly on this article.</p>
            </>
          )}

          {def.cat === 'ask' && def.questionType && (
            <>
              {def.desc && (
                <div className="flex items-center gap-2 p-2.5 rounded-lg bg-slate-50 border border-surface-border">
                  <Icon size={13} style={{ color: def.color, flexShrink: 0 }}/>
                  <p className="text-[10px] text-slate-500 leading-snug">{def.desc}</p>
                </div>
              )}
              <div className="space-y-1"><label className="label">Question text</label>
                <textarea className="textarea" rows={2} placeholder={`e.g. What's your ${def.label.toLowerCase()}?`} value={d.question || ''} onChange={e => set('question', e.target.value)}/>
              </div>
              <div className="space-y-1"><label className="label">Save answer as</label>
                <input className="input" placeholder="e.g. email" value={d.saveAs || ''} onChange={e => set('saveAs', e.target.value)}/>
              </div>
            </>
          )}

          {(node.type === 'tag' || node.type === 'untag') && (
            <div className="space-y-1"><label className="label">Tag name</label>
              <input className="input" placeholder="e.g. Warm Lead" value={d.tagName || ''} onChange={e => set('tagName', e.target.value)}/>
            </div>
          )}

          {node.type === 'setfield' && (
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1"><label className="label">Field</label><input className="input" value={d.field || ''} onChange={e => set('field', e.target.value)}/></div>
              <div className="space-y-1"><label className="label">Value</label><input className="input" value={d.value || ''} onChange={e => set('value', e.target.value)}/></div>
            </div>
          )}

          {(node.type === 'notify' || node.type === 'crm') && (
            <div className="space-y-1"><label className="label">Note</label>
              <textarea className="textarea" rows={2} value={d.note || ''} onChange={e => set('note', e.target.value)}/>
            </div>
          )}

          {node.type === 'lead_capture' && (
            <>
              <p className="text-[10px] text-slate-400 -mt-1">Fields shown are tied to the widget's Lead Capture settings.</p>
              <div className="space-y-1.5">
                {[
                  { k: 'captureName',  l: 'Name' },
                  { k: 'captureEmail', l: 'Email' },
                  { k: 'capturePhone', l: 'Phone' },
                ].map(f => (
                  <label key={f.k} className="flex items-center justify-between p-2.5 rounded-xl border border-surface-border">
                    <span className="text-[12px] font-semibold text-slate-700">{f.l}</span>
                    <input type="checkbox" className="w-4 h-4 rounded accent-primary" checked={Boolean(d[f.k])} onChange={e => set(f.k, e.target.checked)}/>
                  </label>
                ))}
              </div>
              <div className="space-y-1"><label className="label">Intro message (optional)</label>
                <textarea className="textarea" rows={2} value={d.message || ''} onChange={e => set('message', e.target.value)}/>
              </div>
            </>
          )}

          {node.type === 'csat_rating' && (
            <div className="space-y-1"><label className="label">Prompt message</label>
              <textarea className="textarea" rows={2} value={d.message || ''} onChange={e => set('message', e.target.value)}/>
              <p className="text-[9px] text-slate-400">Shows the widget's star-rating card, same as the Behavior tab's rating toggle.</p>
            </div>
          )}

          {node.type === 'live_chat' && (
            <div className="space-y-1"><label className="label">Handover note for the agent</label>
              <textarea className="textarea" rows={2} value={d.note || ''} onChange={e => set('note', e.target.value)}/>
              <p className="text-[9px] text-slate-400">Pauses this bot session and assigns the conversation to a human agent in the Inbox.</p>
            </div>
          )}

          {node.type === 'delay' && (
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1"><label className="label">Duration</label><input type="number" className="input" value={d.duration ?? 0} onChange={e => set('duration', +e.target.value)}/></div>
              <div className="space-y-1"><label className="label">Unit</label>
                <NativeSelect sm value={d.unit} onChange={e => set('unit', e.target.value)}>
                  <option value="seconds">Seconds</option><option value="minutes">Minutes</option><option value="hours">Hours</option>
                </NativeSelect>
              </div>
            </div>
          )}

          {node.type === 'condition' && (
            <>
              <div className="grid grid-cols-3 gap-2">
                <div className="space-y-1"><label className="label">Variable</label><input className="input-sm" value={d.variable || ''} onChange={e => set('variable', e.target.value)}/></div>
                <div className="space-y-1"><label className="label">Operator</label>
                  <NativeSelect sm value={d.operator} onChange={e => set('operator', e.target.value)}>
                    <option value="equals">=</option><option value="contains">contains</option><option value="not_equals">≠</option>
                  </NativeSelect>
                </div>
                <div className="space-y-1"><label className="label">Value</label><input className="input-sm" value={d.value || ''} onChange={e => set('value', e.target.value)}/></div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1"><label className="label">True branch label</label><input className="input-sm" value={d.trueLabel || ''} onChange={e => set('trueLabel', e.target.value)}/></div>
                <div className="space-y-1"><label className="label">False branch label</label><input className="input-sm" value={d.falseLabel || ''} onChange={e => set('falseLabel', e.target.value)}/></div>
              </div>
            </>
          )}

          {node.type === 'split' && (
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1"><label className="label">Path A label</label><input className="input-sm" value={d.labelA || ''} onChange={e => set('labelA', e.target.value)}/></div>
              <div className="space-y-1"><label className="label">Path B label</label><input className="input-sm" value={d.labelB || ''} onChange={e => set('labelB', e.target.value)}/></div>
            </div>
          )}

          {node.type === 'setvar' && (
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1"><label className="label">Variable</label><input className="input" value={d.variable || ''} onChange={e => set('variable', e.target.value)}/></div>
              <div className="space-y-1"><label className="label">Value</label><input className="input" value={d.value || ''} onChange={e => set('value', e.target.value)}/></div>
            </div>
          )}

          {node.type === 'webhook' && (
            <div className="grid grid-cols-[80px_1fr] gap-2">
              <div className="space-y-1"><label className="label">Method</label>
                <NativeSelect sm value={d.method} onChange={e => set('method', e.target.value)}>
                  <option>GET</option><option>POST</option><option>PUT</option>
                </NativeSelect>
              </div>
              <div className="space-y-1"><label className="label">URL</label><input className="input" placeholder="https://…" value={d.url || ''} onChange={e => set('url', e.target.value)}/></div>
            </div>
          )}
        </div>

        <div className="flex gap-2 p-4 border-t border-surface-border flex-shrink-0">
          <button onClick={onDelete} className="p-2 rounded-lg text-red-500 hover:bg-red-50 transition-colors flex-shrink-0"><Trash2 size={14}/></button>
          <button onClick={onClose} className="btn-secondary flex-1 justify-center">Cancel</button>
          <button onClick={save} className="btn-primary flex-1 justify-center"><Check size={13}/> Save</button>
        </div>
      </div>
    </div>
  )
}

/* ─── canvas builder view ──────────────────────────────────────────────── */
function BuilderView({ flow, onBack, onSave }) {
  const [nodes, setNodes] = useState(flow.graph.nodes)
  const [edges, setEdges] = useState(flow.graph.edges)
  const [selectedId, setSelectedId] = useState(null)
  const [selectedEdgeId, setSelectedEdgeId] = useState(null)
  const [zoom, setZoom] = useState(1)
  const [pan, setPan] = useState({ x: 60, y: 60 })
  const [dragging, setDragging] = useState(null)
  const [panning, setPanning] = useState(false)
  const [panStart, setPanStart] = useState({ x: 0, y: 0 })
  const [flowName, setFlowName] = useState(flow.name)
  const [editName, setEditName] = useState(false)
  const [saved, setSaved] = useState(false)
  const [history, setHistory] = useState([{ nodes: flow.graph.nodes, edges: flow.graph.edges }])
  const [histIdx, setHistIdx] = useState(0)
  const [connecting, setConnecting] = useState(null)
  const [hoverPortNode, setHoverPortNode] = useState(null)
  const svgRef = useRef(null)

  const selectedNode = nodes.find(n => n.id === selectedId)

  const pushHistory = useCallback((nn, ne) => {
    setHistory(h => [...h.slice(0, histIdx + 1), { nodes: nn, edges: ne }].slice(-30))
    setHistIdx(i => Math.min(i + 1, 29))
  }, [histIdx])
  const applyHistory = useCallback((nn, ne) => { setNodes(nn); setEdges(ne); pushHistory(nn, ne) }, [pushHistory])
  const undo = useCallback(() => { if (histIdx <= 0) return; const idx = histIdx - 1; setHistIdx(idx); setNodes(history[idx].nodes); setEdges(history[idx].edges) }, [history, histIdx])
  const redo = useCallback(() => { if (histIdx >= history.length - 1) return; const idx = histIdx + 1; setHistIdx(idx); setNodes(history[idx].nodes); setEdges(history[idx].edges) }, [history, histIdx])

  useEffect(() => {
    const h = e => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'z' && !e.shiftKey) { e.preventDefault(); undo() }
      if ((e.metaKey || e.ctrlKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) { e.preventDefault(); redo() }
      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (document.activeElement.tagName === 'INPUT' || document.activeElement.tagName === 'TEXTAREA') return
        if (selectedEdgeId) { applyHistory(nodes, edges.filter(x => x.id !== selectedEdgeId)); setSelectedEdgeId(null) }
        else if (selectedId) { applyHistory(nodes.filter(n => n.id !== selectedId), edges.filter(e2 => e2.fromId !== selectedId && e2.toId !== selectedId)); setSelectedId(null) }
      }
      if (e.key === 'Escape') { setSelectedId(null); setSelectedEdgeId(null); setConnecting(null); setHoverPortNode(null) }
    }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [undo, redo, selectedId, selectedEdgeId, nodes, edges, applyHistory])

  const toCanvas = useCallback((cx, cy) => {
    const rect = svgRef.current?.getBoundingClientRect()
    if (!rect) return { x: 0, y: 0 }
    return { x: (cx - rect.left - pan.x) / zoom, y: (cy - rect.top - pan.y) / zoom }
  }, [pan, zoom])

  const startDrag = useCallback((e, nodeId) => {
    if (connecting) return
    const pt = toCanvas(e.clientX, e.clientY)
    const node = nodes.find(n => n.id === nodeId)
    setDragging({ nodeId, ox: pt.x - node.x, oy: pt.y - node.y })
  }, [nodes, toCanvas, connecting])

  const startConnect = useCallback((e, nodeId, portIdx) => {
    e.stopPropagation()
    const from = nodes.find(n => n.id === nodeId)
    if (!from) return
    const ports = getOutputPorts(from)
    const py = ports.length <= 1 ? NODE_H / 2 : (NODE_H / (ports.length + 1)) * (portIdx + 1)
    const pt = toCanvas(e.clientX, e.clientY)
    setConnecting({ fromId: nodeId, fromPort: portIdx, x1: from.x + NODE_W, y1: from.y + py, x2: pt.x, y2: pt.y })
    setDragging(null); setSelectedId(null); setSelectedEdgeId(null)
  }, [nodes, toCanvas])

  const onSvgMouseMove = useCallback(e => {
    const pt = toCanvas(e.clientX, e.clientY)
    if (connecting) {
      let snap = null
      for (const n of nodes) {
        if (n.id === connecting.fromId) continue
        const dx = pt.x - n.x, dy = pt.y - (n.y + NODE_H / 2)
        if (dx > -PORT_R * 3 && dx < NODE_W * 0.4 && Math.abs(dy) < PORT_R * 3) { snap = n; break }
      }
      setHoverPortNode(snap ? snap.id : null)
      setConnecting(c => ({ ...c, x2: snap ? snap.x : pt.x, y2: snap ? snap.y + NODE_H / 2 : pt.y }))
      return
    }
    if (dragging) setNodes(ns => ns.map(n => n.id === dragging.nodeId ? { ...n, x: pt.x - dragging.ox, y: pt.y - dragging.oy } : n))
    if (panning) setPan({ x: e.clientX - panStart.x, y: e.clientY - panStart.y })
  }, [dragging, panning, panStart, toCanvas, connecting, nodes])

  const onSvgMouseDown = useCallback(e => {
    if (connecting) { setConnecting(null); setHoverPortNode(null); return }
    if (e.target === svgRef.current || e.target.tagName === 'svg') {
      setPanning(true); setPanStart({ x: e.clientX - pan.x, y: e.clientY - pan.y }); setSelectedId(null); setSelectedEdgeId(null)
    }
  }, [pan, connecting])

  const onSvgMouseUp = useCallback(() => {
    if (connecting) {
      if (hoverPortNode && hoverPortNode !== connecting.fromId) {
        const dup = edges.some(e => e.fromId === connecting.fromId && e.fromPort === connecting.fromPort)
        const ne = dup
          ? [...edges.filter(e => !(e.fromId === connecting.fromId && e.fromPort === connecting.fromPort)), { id: 'e' + Date.now(), fromId: connecting.fromId, fromPort: connecting.fromPort, toId: hoverPortNode }]
          : [...edges, { id: 'e' + Date.now(), fromId: connecting.fromId, fromPort: connecting.fromPort, toId: hoverPortNode }]
        applyHistory(nodes, ne)
      }
      setConnecting(null); setHoverPortNode(null); return
    }
    if (dragging) { pushHistory(nodes, edges); setDragging(null) }
    setPanning(false)
  }, [dragging, nodes, edges, pushHistory, connecting, hoverPortNode, applyHistory])

  const onWheel = useCallback(e => { e.preventDefault(); setZoom(z => Math.min(2.5, Math.max(0.25, z * (e.deltaY < 0 ? 1.1 : 0.9)))) }, [])
  useEffect(() => {
    const el = svgRef.current; if (!el) return
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [onWheel])

  const addNode = useCallback(type => {
    if (nodes.length >= MAX_NODES) return
    const n = { id: uid(), type, x: (-pan.x + 400) / zoom, y: (-pan.y + 250) / zoom, data: makeDefaults(type) }
    const nn = [...nodes, n]
    applyHistory(nn, edges); setSelectedId(n.id)
  }, [nodes, edges, pan, zoom, applyHistory])

  const updateNode = useCallback(updated => { const nn = nodes.map(n => n.id === updated.id ? updated : n); setNodes(nn); pushHistory(nn, edges) }, [nodes, edges, pushHistory])
  const deleteNode = useCallback(id => { const nn = nodes.filter(n => n.id !== id); const ne = edges.filter(e => e.fromId !== id && e.toId !== id); applyHistory(nn, ne); setSelectedId(null) }, [nodes, edges, applyHistory])

  const fitScreen = useCallback(() => {
    if (!svgRef.current || nodes.length === 0) return
    const rect = svgRef.current.getBoundingClientRect()
    const minX = Math.min(...nodes.map(n => n.x)) - 40, minY = Math.min(...nodes.map(n => n.y)) - 40
    const maxX = Math.max(...nodes.map(n => n.x + NODE_W)) + 40, maxY = Math.max(...nodes.map(n => n.y + NODE_H)) + 40
    const newZoom = Math.min(rect.width / (maxX - minX), rect.height / (maxY - minY), 2)
    setZoom(newZoom); setPan({ x: -minX * newZoom + 20, y: -minY * newZoom + 20 })
  }, [nodes])

  const handleSave = () => { onSave({ name: flowName, graph: { nodes, edges } }); setSaved(true); setTimeout(() => setSaved(false), 1500) }

  const edgePaths = useMemo(() => edges.map(e => {
    const from = nodes.find(n => n.id === e.fromId), to = nodes.find(n => n.id === e.toId)
    if (!from || !to) return null
    const ports = getOutputPorts(from)
    const pi = e.fromPort || 0
    const py = ports.length <= 1 ? NODE_H / 2 : (NODE_H / (ports.length + 1)) * (pi + 1)
    return { ...e, path: bezier(from.x + NODE_W, from.y + py, to.x, to.y + NODE_H / 2) }
  }).filter(Boolean), [nodes, edges])

  return (
    <div className="fixed inset-0 z-50 bg-[#f0f4f8] flex flex-col">
      <div className="h-12 bg-white border-b border-surface-border flex items-center px-3 gap-2 flex-shrink-0 z-10">
        <button onClick={onBack} className="flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900 transition-colors border border-surface-border rounded-lg px-2.5 py-1.5 hover:bg-slate-50">
          <ChevronLeft size={13}/> Back
        </button>
        <div className="w-px h-5 bg-surface-border mx-1"/>
        {editName
          ? <input autoFocus value={flowName} onChange={e => setFlowName(e.target.value)} onBlur={() => setEditName(false)} onKeyDown={e => e.key === 'Enter' && setEditName(false)}
              className="text-sm font-bold border border-primary/40 rounded-lg px-2.5 py-1 outline-none focus:ring-2 focus:ring-primary/15 max-w-44"/>
          : <button onClick={() => setEditName(true)} className="flex items-center gap-1.5 text-sm font-bold text-slate-800 hover:text-slate-900">{flowName} <Edit3 size={11} className="text-slate-400"/></button>}
        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-500">{nodes.length} nodes</span>
        <div className="flex-1"/>
        <button onClick={undo} disabled={histIdx <= 0} className="text-[11px] border border-surface-border rounded-lg px-2.5 py-1.5 disabled:opacity-40 hover:bg-slate-50 transition-colors text-slate-600">↩ Undo</button>
        <button onClick={redo} disabled={histIdx >= history.length - 1} className="text-[11px] border border-surface-border rounded-lg px-2.5 py-1.5 disabled:opacity-40 hover:bg-slate-50 transition-colors text-slate-600">↪ Redo</button>
        <div className="flex items-center border border-surface-border rounded-lg overflow-hidden">
          <button onClick={() => setZoom(z => Math.max(0.25, z - 0.1))} className="p-1.5 hover:bg-slate-50 transition-colors border-r border-surface-border"><ZoomOut size={12} className="text-slate-600"/></button>
          <span className="text-[11px] font-bold text-slate-600 w-10 text-center">{Math.round(zoom * 100)}%</span>
          <button onClick={() => setZoom(z => Math.min(2.5, z + 0.1))} className="p-1.5 hover:bg-slate-50 transition-colors border-l border-surface-border"><ZoomIn size={12} className="text-slate-600"/></button>
        </div>
        <button onClick={fitScreen} className="text-[11px] border border-surface-border rounded-lg px-2.5 py-1.5 hover:bg-slate-50 transition-colors text-slate-600 flex items-center gap-1"><Maximize2 size={11}/> Fit</button>
        <button onClick={handleSave} className={clsx('text-xs font-semibold px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-all', saved ? 'bg-emerald-500 text-white' : 'bg-primary text-white hover:bg-primary/90')}>
          {saved ? <><Check size={12}/> Saved!</> : <><Save size={12}/> Save</>}
        </button>
      </div>

      <div className="flex-1 flex overflow-hidden">
        <LeftPalette onAdd={addNode} nodeCount={nodes.length}/>
        <div className="flex-1 relative overflow-hidden">
          <svg className="absolute inset-0 w-full h-full pointer-events-none">
            <defs>
              <pattern id="wc-dots-bg" x={pan.x % 24} y={pan.y % 24} width={24 * zoom} height={24 * zoom} patternUnits="userSpaceOnUse">
                <circle cx={0} cy={0} r={1} fill="#c8d6e5" opacity={0.6}/>
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#wc-dots-bg)"/>
          </svg>
          <svg ref={svgRef} className="absolute inset-0 w-full h-full" style={{ cursor: connecting ? 'crosshair' : panning ? 'grabbing' : 'default' }}
            onMouseDown={onSvgMouseDown} onMouseMove={onSvgMouseMove} onMouseUp={onSvgMouseUp} onMouseLeave={e => { if (!connecting) onSvgMouseUp(e) }}>
            <defs>
              <marker id="wc-arrow" markerWidth={10} markerHeight={7} refX={8} refY={3.5} orient="auto"><polygon points="0 0,10 3.5,0 7" fill="#94a3b8"/></marker>
              <marker id="wc-arrow-sel" markerWidth={10} markerHeight={7} refX={8} refY={3.5} orient="auto"><polygon points="0 0,10 3.5,0 7" fill="#0066ff"/></marker>
            </defs>
            <g transform={`translate(${pan.x},${pan.y}) scale(${zoom})`}>
              {edgePaths.map(e => {
                const hl = e.id === selectedEdgeId || e.fromId === selectedId || e.toId === selectedId
                const fromDef = DEFS[nodes.find(n => n.id === e.fromId)?.type]
                const edgeColor = hl ? '#0066ff' : fromDef?.color || '#94a3b8'
                return (
                  <g key={e.id} style={{ cursor: 'pointer' }} onClick={ev => { ev.stopPropagation(); setSelectedEdgeId(e.id === selectedEdgeId ? null : e.id); setSelectedId(null) }}>
                    <path d={e.path} stroke="transparent" strokeWidth={12 / zoom} fill="none"/>
                    <path d={e.path} stroke={edgeColor} strokeWidth={(hl ? 2.5 : 1.5) / zoom} strokeOpacity={hl ? 1 : 0.55} fill="none" markerEnd={hl ? 'url(#wc-arrow-sel)' : 'url(#wc-arrow)'}/>
                    {e.id === selectedEdgeId && (() => {
                      const from = nodes.find(n => n.id === e.fromId), to = nodes.find(n => n.id === e.toId)
                      if (!from || !to) return null
                      const mx = (from.x + NODE_W + to.x) / 2, my = (from.y + NODE_H / 2 + to.y + NODE_H / 2) / 2, btnR = 9 / zoom
                      return (
                        <g style={{ cursor: 'pointer' }} onClick={ev => { ev.stopPropagation(); applyHistory(nodes, edges.filter(x => x.id !== e.id)); setSelectedEdgeId(null) }}>
                          <circle cx={mx} cy={my} r={btnR} fill="#ef4444" stroke="#fff" strokeWidth={1.5 / zoom}/>
                          <text x={mx} y={my} fontSize={10 / zoom} fill="#fff" textAnchor="middle" dominantBaseline="middle" fontWeight="bold">×</text>
                        </g>
                      )
                    })()}
                  </g>
                )
              })}
              {connecting && (
                <path d={bezier(connecting.x1, connecting.y1, connecting.x2, connecting.y2)} stroke="#0066ff" strokeWidth={2 / zoom}
                  strokeDasharray={`${6 / zoom},${3 / zoom}`} fill="none" markerEnd="url(#wc-arrow-sel)" opacity={0.85} style={{ pointerEvents: 'none' }}/>
              )}
              {nodes.map(n => (
                <NodeCard key={n.id} node={n} selected={n.id === selectedId}
                  onSelect={id => { setSelectedId(id); setSelectedEdgeId(null) }} onDragStart={startDrag} onPortMouseDown={startConnect}
                  isConnectTarget={hoverPortNode === n.id} connecting={connecting}/>
              ))}
            </g>
          </svg>

          {nodes.length === 0 && (
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              <div className="w-16 h-16 rounded-2xl bg-white border border-surface-border flex items-center justify-center mb-4 shadow-sm"><Zap size={28} className="text-slate-300"/></div>
              <p className="text-base font-bold text-slate-500">Start building your flow</p>
              <p className="text-sm text-slate-400 mt-1">Click a node in the left panel to add it</p>
            </div>
          )}
          {connecting && (
            <div className="absolute top-3 left-1/2 -translate-x-1/2 bg-primary text-white text-xs font-semibold px-4 py-1.5 rounded-full shadow-lg pointer-events-none flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-white animate-pulse"/>Drag to a node input port to connect · Esc to cancel
            </div>
          )}
          {selectedEdgeId && !connecting && (
            <div className="absolute top-3 left-1/2 -translate-x-1/2 bg-red-500 text-white text-xs font-semibold px-4 py-1.5 rounded-full shadow-lg pointer-events-none">
              Edge selected · Press Delete to remove · Click × on edge
            </div>
          )}
          <Minimap nodes={nodes} edges={edges} zoom={zoom} pan={pan} svgRef={svgRef}/>
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-3 bg-white/90 border border-surface-border rounded-full px-4 py-1.5 text-[10px] text-slate-400 font-medium shadow-sm pointer-events-none">
            <span>Drag port → connect</span><span className="w-px h-3 bg-slate-200"/><span>Click edge → select</span><span className="w-px h-3 bg-slate-200"/>
            <span>Del → delete selected</span><span className="w-px h-3 bg-slate-200"/><span>Scroll → zoom</span><span className="w-px h-3 bg-slate-200"/><span>Ctrl+Z → undo</span>
          </div>
        </div>

        {selectedNode && (
          <NodeEditModal node={selectedNode} onChange={updateNode} onDelete={() => deleteNode(selectedId)} onClose={() => setSelectedId(null)}/>
        )}
      </div>
    </div>
  )
}

/* ─── page: flow list + entry into the canvas ─────────────────────────── */
export default function WebChatFlowBuilder() {
  const [flows, setFlows] = useState(INITIAL_FLOWS)
  const [editingId, setEditingId] = useState(null)

  const editingFlow = flows.find(f => f.id === editingId)

  function toggle(id, active) { setFlows(fs => fs.map(f => f.id === id ? { ...f, active } : f)) }
  function remove(id) { setFlows(fs => fs.filter(f => f.id !== id)) }
  function duplicate(f) { setFlows(fs => [...fs, { ...f, id: `f${Date.now()}`, name: `${f.name} (copy)`, active: false, stats: { triggered: 0, completed: 0 } }]) }
  function createNew() {
    const id = `f${Date.now()}`
    const nf = { id, name: 'New Flow', active: false,
      trigger: 'Widget Opened',
      graph: { nodes: [{ id: 'n1', type: 'start', x: 60, y: 180, data: makeDefaults('start') }], edges: [] },
      stats: { triggered: 0, completed: 0 } }
    setFlows(fs => [...fs, nf])
    setEditingId(id)
  }
  function saveGraph({ name, graph }) {
    setFlows(fs => fs.map(f => f.id === editingId ? { ...f, name, graph, active: true } : f))
  }

  if (editingFlow) {
    return <BuilderView flow={editingFlow} onBack={() => setEditingId(null)} onSave={saveGraph}/>
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-[11px] text-slate-400">Multi-step flows with branching logic on a real drag-and-drop canvas.</p>
        <button onClick={createNew} className="btn-primary flex-shrink-0"><Plus size={13}/> Create Flow</button>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-3">
        {flows.map(f => {
          const rate = f.stats.triggered ? Math.round((f.stats.completed / f.stats.triggered) * 100) : 0
          return (
            <div key={f.id} className="bg-white border border-surface-border rounded-2xl p-3.5 flex flex-col gap-2.5 hover:shadow-[0_4px_20px_-4px_rgba(15,23,42,0.12)] transition-all">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-[13px] font-semibold text-slate-800 truncate">{f.name}</p>
                  <p className="text-[11px] text-slate-400 mt-0.5">Trigger: {f.trigger} · {f.graph.nodes.length} nodes</p>
                </div>
                <button onClick={() => toggle(f.id, !f.active)} className={clsx('text-[9px] font-bold px-2 py-0.5 rounded-full flex-shrink-0', f.active ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-400')}>
                  {f.active ? 'Live' : 'Paused'}
                </button>
              </div>
              <div className="flex items-center gap-3 text-[10px] text-slate-400">
                <span><span className="font-bold text-slate-600">{f.stats.triggered.toLocaleString()}</span> triggered</span>
                {f.stats.triggered > 0 && <span className="font-bold text-emerald-500">{rate}% completion</span>}
              </div>
              <div className="flex items-center gap-1.5 mt-1">
                <button onClick={() => setEditingId(f.id)} className="btn-secondary flex-1 justify-center !py-1.5"><Edit3 size={11}/> Edit</button>
                <button onClick={() => duplicate(f)} title="Duplicate" className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"><Copy size={13}/></button>
                <button onClick={() => remove(f.id)} title="Delete" className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors"><Trash2 size={13}/></button>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
