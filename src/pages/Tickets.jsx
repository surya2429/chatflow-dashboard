import { useState, useRef, useEffect, useMemo } from 'react'
import {
  TicketCheck, Plus, Search, Clock, AlertTriangle, CheckCircle,
  XCircle, Circle, User, Users, Flag, Send, Lock, Pencil, Trash2,
  RefreshCw, Star, Check, X, Zap, AlertCircle, Loader2,
  ChevronDown, Hash, Building2, Phone, Tag, Filter,
} from 'lucide-react'
import clsx from 'clsx'
import { NativeSelect } from '../components/Select'

/* ─── Data ───────────────────────────────────────────────────────────────── */

const TICKET_STATUS = {
  open:        { label: 'Open',        color: '#0066ff', bg: '#eff6ff', Icon: Circle       },
  in_progress: { label: 'In Progress', color: '#f59e0b', bg: '#fffbeb', Icon: Loader2      },
  pending:     { label: 'Pending',     color: '#8b5cf6', bg: '#f5f3ff', Icon: Clock        },
  resolved:    { label: 'Resolved',    color: '#22c55e', bg: '#f0fdf4', Icon: CheckCircle  },
  closed:      { label: 'Closed',      color: '#94a3b8', bg: '#f8fafc', Icon: XCircle      },
}

const TICKET_PRIORITY = {
  urgent: { label: 'Urgent', color: '#ef4444', bg: '#fef2f2', order: 0 },
  high:   { label: 'High',   color: '#f97316', bg: '#fff7ed', order: 1 },
  medium: { label: 'Medium', color: '#f59e0b', bg: '#fffbeb', order: 2 },
  low:    { label: 'Low',    color: '#22c55e', bg: '#f0fdf4', order: 3 },
}

const TICKET_TYPE = {
  support: { label: 'Support',  color: '#0066ff' },
  bug:     { label: 'Bug',      color: '#ef4444' },
  billing: { label: 'Billing',  color: '#f59e0b' },
  feature: { label: 'Feature',  color: '#8b5cf6' },
  general: { label: 'General',  color: '#64748b' },
}

const SLA_PRESETS = [
  { label: '2 Hours',  hours: 2  },
  { label: '4 Hours',  hours: 4  },
  { label: '8 Hours',  hours: 8  },
  { label: '24 Hours', hours: 24 },
  { label: '48 Hours', hours: 48 },
  { label: '72 Hours', hours: 72 },
]

const DEPARTMENTS = ['Support', 'Technical', 'Finance', 'Operations', 'Sales']

const AGENTS = [
  { id: 'a1', name: 'Rahul Mehta',  initials: 'RM', color: '#0066ff' },
  { id: 'a2', name: 'Priya Das',    initials: 'PD', color: '#22c55e' },
  { id: 'a3', name: 'Aryan Kapoor', initials: 'AK', color: '#f59e0b' },
  { id: 'a4', name: 'Sunita Rao',   initials: 'SR', color: '#8b5cf6' },
]

function ago(h) { const d = new Date(); d.setTime(d.getTime() - h * 3600000); return d.toISOString() }
function deadline(fromIso, h) { const d = new Date(fromIso); d.setTime(d.getTime() + h * 3600000); return d.toISOString() }

const INIT_TICKETS = [
  {
    id: 'T-1001', seq: 1001,
    title: 'Payment not processed after multiple attempts',
    description: 'Customer attempted to pay for order #ORD-4821 three times. The amount was deducted from their bank account but the order still shows as unpaid. Requires urgent investigation and refund or order confirmation.',
    status: 'open', priority: 'urgent', type: 'billing',
    assigneeId: 'a1',
    reporterName: 'Priya Sharma', reporterPhone: '+91 98765 43210', reporterAvatar: 'PS',
    department: 'Support', tags: ['billing', 'payment', 'refund'],
    createdAt: ago(2), updatedAt: ago(0.5), resolvedAt: null,
    slaDeadline: deadline(ago(2), 4),
    conversationId: 'c1', starred: false,
    comments: [
      { id: 'c1', type: 'event', text: 'Ticket created', time: ago(2), sender: 'System' },
      { id: 'c2', type: 'note',  text: 'Checked payment gateway logs — TXN-8821 is in pending state. Escalating to billing team.', time: ago(1.5), sender: 'Rahul Mehta', senderId: 'a1' },
      { id: 'c3', type: 'event', text: 'Priority changed to Urgent', time: ago(1.2), sender: 'System' },
      { id: 'c4', type: 'reply', text: 'Hi Priya, we can see the issue with your payment. Our billing team has been notified and will resolve this within 2 hours — either processing a refund or confirming your order.', time: ago(0.5), sender: 'Rahul Mehta', senderId: 'a1' },
    ],
    watchers: ['a2'],
  },
  {
    id: 'T-1002', seq: 1002,
    title: 'App crashes on iOS 17 when opening old conversations',
    description: 'Multiple customers on iOS 17.4 report that the app crashes immediately when tapping any conversation older than 30 days. Affects iPhone 12 and above. Not reproducible on Android.',
    status: 'in_progress', priority: 'high', type: 'bug',
    assigneeId: 'a2',
    reporterName: 'Amit Verma', reporterPhone: '+91 87654 32109', reporterAvatar: 'AV',
    department: 'Technical', tags: ['ios', 'crash', 'bug'],
    createdAt: ago(6), updatedAt: ago(3), resolvedAt: null,
    slaDeadline: deadline(ago(6), 8),
    conversationId: null, starred: true,
    comments: [
      { id: 'c5', type: 'event', text: 'Ticket created', time: ago(6), sender: 'System' },
      { id: 'c6', type: 'event', text: 'Assigned to Priya Das', time: ago(5.5), sender: 'System' },
      { id: 'c7', type: 'note',  text: 'Reproduced on iPhone 14 Pro with iOS 17.4. Stack trace points to ChatHistoryViewController:234. Likely a memory pagination bug with the new iOS memory policies.', time: ago(4), sender: 'Priya Das', senderId: 'a2' },
      { id: 'c8', type: 'reply', text: 'We have identified the issue and our engineering team is working on a fix. We expect to ship a hotfix within 24 hours. Thank you for your patience.', time: ago(3), sender: 'Priya Das', senderId: 'a2' },
    ],
    watchers: ['a1', 'a3'],
  },
  {
    id: 'T-1003', seq: 1003,
    title: 'Request for bulk export of all contact data',
    description: 'Customer needs to export 5,000+ contacts to CSV for CRM migration. Current export caps at 500 records at a time. Manual workaround is too slow for their deadline.',
    status: 'pending', priority: 'medium', type: 'feature',
    assigneeId: null,
    reporterName: 'Meena Joshi', reporterPhone: '+91 76543 21098', reporterAvatar: 'MJ',
    department: 'Operations', tags: ['feature-request', 'export', 'contacts'],
    createdAt: ago(24), updatedAt: ago(12), resolvedAt: null,
    slaDeadline: deadline(ago(24), 48),
    conversationId: null, starred: false,
    comments: [
      { id: 'c9',  type: 'event', text: 'Ticket created', time: ago(24), sender: 'System' },
      { id: 'c10', type: 'reply', text: 'Thank you for raising this. We are evaluating a bulk export feature with the product team. We will update you within 3 business days.', time: ago(20), sender: 'Rahul Mehta', senderId: 'a1' },
      { id: 'c11', type: 'event', text: 'Status changed to Pending — awaiting product team decision', time: ago(12), sender: 'System' },
    ],
    watchers: [],
  },
  {
    id: 'T-1004', seq: 1004,
    title: 'WhatsApp template rejected — incorrect category',
    description: "Template 'order_confirmation_v3' was rejected by Meta. Submitted as UTILITY but Meta flagged it as MARKETING due to the included upsell section. Needs resubmission.",
    status: 'resolved', priority: 'medium', type: 'support',
    assigneeId: 'a3',
    reporterName: 'Rohan Pillai', reporterPhone: '+91 65432 10987', reporterAvatar: 'RP',
    department: 'Support', tags: ['template', 'whatsapp', 'meta'],
    createdAt: ago(48), updatedAt: ago(24), resolvedAt: ago(24),
    slaDeadline: deadline(ago(48), 24),
    conversationId: null, starred: false,
    comments: [
      { id: 'c12', type: 'event', text: 'Ticket created', time: ago(48), sender: 'System' },
      { id: 'c13', type: 'note',  text: "Template includes a promotional upsell which triggers MARKETING classification per Meta's updated guidelines (April 2024). Must add opt-out footer.", time: ago(36), sender: 'Aryan Kapoor', senderId: 'a3' },
      { id: 'c14', type: 'reply', text: 'We have resubmitted the template under the MARKETING category with the required opt-out footer. Meta approval is expected within 24–48 hours.', time: ago(28), sender: 'Aryan Kapoor', senderId: 'a3' },
      { id: 'c15', type: 'event', text: 'Ticket resolved', time: ago(24), sender: 'System' },
    ],
    watchers: [],
  },
  {
    id: 'T-1005', seq: 1005,
    title: 'Customer not receiving OTP on WhatsApp',
    description: 'User with phone +91 9123456789 has not received OTP via WhatsApp for 3 days. SMS OTP also not arriving. Account is active and number is valid. DND registration suspected.',
    status: 'open', priority: 'high', type: 'support',
    assigneeId: 'a4',
    reporterName: 'Kavya Nair', reporterPhone: '+91 91234 56789', reporterAvatar: 'KN',
    department: 'Support', tags: ['otp', 'whatsapp', 'delivery'],
    createdAt: ago(5), updatedAt: ago(2), resolvedAt: null,
    slaDeadline: deadline(ago(5), 8),
    conversationId: null, starred: false,
    comments: [
      { id: 'c16', type: 'event', text: 'Ticket created', time: ago(5), sender: 'System' },
      { id: 'c17', type: 'event', text: 'Assigned to Sunita Rao', time: ago(4.5), sender: 'System' },
      { id: 'c18', type: 'note',  text: 'Delivery logs show messages dispatched but marked undelivered. Suspect DND registration or carrier block. Raised with telecom API team.', time: ago(3), sender: 'Sunita Rao', senderId: 'a4' },
    ],
    watchers: ['a1'],
  },
  {
    id: 'T-1006', seq: 1006,
    title: 'March invoice shows ₹0 GST despite GST registration',
    description: 'March 2024 invoice generated with ₹0 GST. Customer is GST-registered (GSTIN: 27AAPFU0939F1ZV). Corrected invoice required for tax filing before 31st March deadline.',
    status: 'closed', priority: 'low', type: 'billing',
    assigneeId: 'a1',
    reporterName: 'Deepak Gupta', reporterPhone: '+91 80123 45678', reporterAvatar: 'DG',
    department: 'Finance', tags: ['invoice', 'gst', 'billing'],
    createdAt: ago(72), updatedAt: ago(48), resolvedAt: ago(50),
    slaDeadline: deadline(ago(72), 72),
    conversationId: null, starred: false,
    comments: [
      { id: 'c19', type: 'event', text: 'Ticket created', time: ago(72), sender: 'System' },
      { id: 'c20', type: 'reply', text: 'Corrected invoice with 18% GST has been generated and sent to your registered email. Please check your inbox and spam folder.', time: ago(52), sender: 'Rahul Mehta', senderId: 'a1' },
      { id: 'c21', type: 'event', text: 'Ticket resolved', time: ago(50), sender: 'System' },
      { id: 'c22', type: 'event', text: 'Ticket closed', time: ago(48), sender: 'System' },
    ],
    watchers: [],
  },
  {
    id: 'T-1007', seq: 1007,
    title: 'Bot not triggering for new WhatsApp contacts',
    description: 'Since yesterday evening, first-time contacts who message the WhatsApp number are not getting the welcome bot flow triggered. Existing contacts who have messaged before are working fine. Affects all new leads.',
    status: 'open', priority: 'urgent', type: 'bug',
    assigneeId: null,
    reporterName: 'Sakshi Agarwal', reporterPhone: '+91 72345 67890', reporterAvatar: 'SA',
    department: 'Technical', tags: ['bot', 'automation', 'critical'],
    createdAt: ago(1), updatedAt: ago(0.3), resolvedAt: null,
    slaDeadline: deadline(ago(1), 2),
    conversationId: null, starred: true,
    comments: [
      { id: 'c23', type: 'event', text: 'Ticket created', time: ago(1), sender: 'System' },
      { id: 'c24', type: 'event', text: 'Priority set to Urgent — production impact', time: ago(0.8), sender: 'System' },
    ],
    watchers: [],
  },
]

/* ─── Helpers ────────────────────────────────────────────────────────────── */

function getAgent(id) { return AGENTS.find(a => a.id === id) || null }

function fmtTime(iso) {
  if (!iso) return '—'
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1)  return 'just now'
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  const d = Math.floor(h / 24)
  if (d < 7)  return `${d}d ago`
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
}

function slaInfo(ticket) {
  if (!ticket.slaDeadline) return null
  if (ticket.status === 'resolved' || ticket.status === 'closed') return null
  const diff = new Date(ticket.slaDeadline).getTime() - Date.now()
  const m = Math.floor(Math.abs(diff) / 60000)
  const h = Math.floor(m / 60)
  const d = Math.floor(h / 24)
  if (diff < 0) {
    const label = d > 0 ? `${d}d overdue` : h > 0 ? `${h}h overdue` : `${m}m overdue`
    return { label, breach: true, warning: false }
  }
  const label = h >= 24 ? `${d}d left` : h > 0 ? `${h}h left` : `${m}m left`
  return { label, breach: false, warning: diff < 4 * 3600000 }
}

/* ─── Atoms ──────────────────────────────────────────────────────────────── */

function StatusBadge({ status, sm }) {
  const s = TICKET_STATUS[status]
  if (!s) return null
  const { Icon } = s
  return (
    <span className={clsx('inline-flex items-center gap-1 font-semibold rounded-full whitespace-nowrap',
      sm ? 'text-[10px] px-1.5 py-0.5' : 'text-[11px] px-2 py-0.5')}
      style={{ background: s.bg, color: s.color }}>
      <Icon size={sm ? 9 : 10} /> {s.label}
    </span>
  )
}

function PriorityDot({ priority }) {
  const p = TICKET_PRIORITY[priority]
  return <span className="inline-block w-2 h-2 rounded-full flex-shrink-0" style={{ background: p?.color }} title={p?.label} />
}

function PriorityPill({ priority }) {
  const p = TICKET_PRIORITY[priority]
  return (
    <span className="inline-flex items-center gap-1 text-[10px] font-bold rounded-md px-1.5 py-0.5"
      style={{ background: p?.bg, color: p?.color }}>
      <Flag size={9} /> {p?.label}
    </span>
  )
}

function SLABadge({ ticket }) {
  const s = slaInfo(ticket)
  if (!s) return null
  return (
    <span className={clsx('inline-flex items-center gap-1 text-[10px] font-semibold rounded-md px-1.5 py-0.5',
      s.breach  ? 'bg-red-50 text-red-600'
    : s.warning ? 'bg-amber-50 text-amber-600'
    :             'bg-slate-50 text-slate-500')}>
      <Clock size={9} /> {s.label}
    </span>
  )
}

function AgentChip({ agentId, size = 16 }) {
  const a = getAgent(agentId)
  if (!a) return <span className="text-[10px] text-red-500 font-semibold">Unassigned</span>
  return (
    <span className="inline-flex items-center gap-1 text-[10px] text-slate-600">
      <span className="rounded-full flex items-center justify-center text-white font-bold flex-shrink-0"
        style={{ width: size, height: size, background: a.color, fontSize: size * 0.42 }}>
        {a.initials}
      </span>
      {a.name.split(' ')[0]}
    </span>
  )
}

/* ─── Filter Sidebar ─────────────────────────────────────────────────────── */

function FilterSidebar({ filter, setFilter, tickets }) {
  const counts = useMemo(() => {
    const c = { all: tickets.length, unassigned: 0, starred: 0, sla_breach: 0 }
    Object.keys(TICKET_STATUS).forEach(k => { c[`s_${k}`] = 0 })
    Object.keys(TICKET_PRIORITY).forEach(k => { c[`p_${k}`] = 0 })
    tickets.forEach(t => {
      if (!t.assigneeId) c.unassigned++
      if (t.starred) c.starred++
      if (slaInfo(t)?.breach) c.sla_breach++
      c[`s_${t.status}`] = (c[`s_${t.status}`] || 0) + 1
      c[`p_${t.priority}`] = (c[`p_${t.priority}`] || 0) + 1
    })
    return c
  }, [tickets])

  function Item({ id, label, Icon, count }) {
    const active = filter === id
    return (
      <button onClick={() => setFilter(id)}
        className={clsx('w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-[12px] font-medium transition-colors text-left',
          active ? 'bg-primary-50 text-primary font-semibold' : 'text-slate-600 hover:bg-surface-hover')}>
        {Icon && <Icon size={13} className={active ? 'text-primary' : 'text-slate-400'} />}
        <span className="flex-1 truncate">{label}</span>
        {count > 0 && (
          <span className={clsx('text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[20px] text-center',
            active ? 'bg-primary text-white' : 'bg-slate-100 text-slate-500')}>
            {count}
          </span>
        )}
      </button>
    )
  }

  function Sep({ label }) {
    return <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider px-2.5 pt-3 pb-1">{label}</p>
  }

  return (
    <div className="w-48 flex-shrink-0 border-r border-surface-border bg-white flex flex-col">
      <div className="px-3 py-2.5 border-b border-surface-border flex-shrink-0">
        <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Filters</p>
      </div>
      <div className="flex-1 overflow-y-auto p-2 space-y-0.5">
        <Item id="all"        label="All Tickets"   Icon={TicketCheck}     count={counts.all} />
        <Item id="unassigned" label="Unassigned"    Icon={Users}           count={counts.unassigned} />
        <Item id="starred"    label="Starred"       Icon={Star}            count={counts.starred} />
        <Item id="sla_breach" label="SLA Breached"  Icon={AlertTriangle}   count={counts.sla_breach} />

        <Sep label="By Status" />
        {Object.entries(TICKET_STATUS).map(([k, v]) => (
          <Item key={k} id={`s:${k}`} label={v.label} count={counts[`s_${k}`] || 0} />
        ))}

        <Sep label="By Priority" />
        {Object.entries(TICKET_PRIORITY).map(([k, v]) => (
          <Item key={k} id={`p:${k}`} label={v.label} count={counts[`p_${k}`] || 0} />
        ))}
      </div>
    </div>
  )
}

/* ─── Ticket Row ─────────────────────────────────────────────────────────── */

function TicketRow({ ticket, active, checked, onSelect, onCheck }) {
  const sla = slaInfo(ticket)
  return (
    <div onClick={() => onSelect(ticket.id)}
      className={clsx(
        'group flex items-start gap-2.5 px-3 py-3 cursor-pointer border-b border-surface-border transition-colors relative',
        active          ? 'bg-primary-50 border-l-[3px] border-l-primary'
        : sla?.breach   ? 'bg-red-50/50 hover:bg-red-50'
        :                 'hover:bg-surface-hover'
      )}>
      {/* Checkbox */}
      <div className="flex-shrink-0 pt-0.5"
        onClick={e => { e.stopPropagation(); onCheck(ticket.id) }}>
        <div className={clsx('w-4 h-4 rounded border-2 flex items-center justify-center transition-all',
          checked ? 'bg-primary border-primary' : 'border-slate-300 group-hover:border-slate-400')}>
          {checked && <Check size={10} className="text-white" />}
        </div>
      </div>

      <div className="flex-1 min-w-0">
        {/* Row 1 */}
        <div className="flex items-center gap-1.5 mb-1">
          <PriorityDot priority={ticket.priority} />
          <span className="text-[10px] font-mono text-slate-400 flex-shrink-0">#{ticket.id}</span>
          {ticket.starred && <Star size={10} className="text-amber-400 fill-amber-400 flex-shrink-0" />}
          <div className="ml-auto flex-shrink-0">
            <StatusBadge status={ticket.status} sm />
          </div>
        </div>

        {/* Title */}
        <p className={clsx('text-[12px] font-semibold leading-snug line-clamp-2 mb-1.5',
          sla?.breach ? 'text-red-800' : 'text-slate-900')}>
          {ticket.title}
        </p>

        {/* Reporter + type */}
        <div className="flex items-center gap-1.5 mb-1.5 min-w-0">
          <span className="text-[10px] text-slate-500 truncate">{ticket.reporterName}</span>
          <span className="text-slate-300 flex-shrink-0">·</span>
          <span className="text-[10px] font-medium flex-shrink-0"
            style={{ color: TICKET_TYPE[ticket.type]?.color }}>
            {TICKET_TYPE[ticket.type]?.label}
          </span>
        </div>

        {/* Bottom row */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <SLABadge ticket={ticket} />
          <AgentChip agentId={ticket.assigneeId} />
          <span className="ml-auto text-[10px] text-slate-400 flex-shrink-0">{fmtTime(ticket.updatedAt)}</span>
        </div>
      </div>
    </div>
  )
}

/* ─── Ticket List Panel ───────────────────────────────────────────────────── */

function TicketListPanel({ tickets, activeId, onSelect, onCreate, selected, onCheck, onCheckAll, onClearSel, search, setSearch, sort, setSort }) {
  const allChecked = tickets.length > 0 && tickets.every(t => selected.includes(t.id))

  return (
    <div className="w-72 flex-shrink-0 border-r border-surface-border bg-white flex flex-col">
      {/* Header */}
      <div className="px-3 py-2.5 border-b border-surface-border flex-shrink-0 space-y-2">
        <div className="flex items-center gap-2">
          <span className="text-[12px] font-bold text-slate-800 flex-1">
            {tickets.length} ticket{tickets.length !== 1 ? 's' : ''}
          </span>
          <NativeSelect value={sort} onChange={e => setSort(e.target.value)} sm>
            <option value="newest">Newest</option>
            <option value="oldest">Oldest</option>
            <option value="priority">Priority</option>
            <option value="sla">SLA</option>
          </NativeSelect>
          <button onClick={onCreate}
            className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-primary text-white text-[11px] font-semibold hover:bg-primary/90 transition-colors whitespace-nowrap flex-shrink-0">
            <Plus size={11} /> New
          </button>
        </div>
        {/* Search */}
        <div className="relative">
          <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search tickets…"
            className="w-full pl-7 pr-7 py-1.5 text-[11px] bg-slate-50 border border-surface-border rounded-lg focus:outline-none focus:border-primary/40 focus:bg-white transition-all placeholder-slate-400" />
          {search && (
            <button onClick={() => setSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
              <X size={10} />
            </button>
          )}
        </div>
      </div>

      {/* Bulk select bar */}
      {selected.length > 0 && (
        <div className="flex items-center gap-2 px-3 py-1.5 bg-primary-50 border-b border-primary/20 flex-shrink-0">
          <input type="checkbox" checked={allChecked}
            onChange={e => e.target.checked ? onCheckAll(tickets.map(t => t.id)) : onClearSel()}
            className="accent-primary w-3.5 h-3.5 cursor-pointer" />
          <span className="text-[11px] font-semibold text-primary flex-1">{selected.length} selected</span>
          <button onClick={onClearSel}><X size={11} className="text-slate-400 hover:text-slate-600" /></button>
        </div>
      )}

      {/* List */}
      <div className="flex-1 overflow-y-auto">
        {tickets.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-14 px-4 text-center">
            <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center mb-3">
              <TicketCheck size={18} className="text-slate-300" />
            </div>
            <p className="text-[12px] font-semibold text-slate-700 mb-1">No tickets found</p>
            <p className="text-[11px] text-slate-400">{search ? 'Try a different search term' : 'No tickets match this filter'}</p>
          </div>
        ) : tickets.map(t => (
          <TicketRow key={t.id} ticket={t}
            active={t.id === activeId}
            checked={selected.includes(t.id)}
            onSelect={onSelect}
            onCheck={onCheck} />
        ))}
      </div>
    </div>
  )
}

/* ─── Comment Item ────────────────────────────────────────────────────────── */

function CommentBubble({ c }) {
  if (c.type === 'event') return (
    <div className="flex items-center gap-2 py-1">
      <div className="w-5 h-5 rounded-full bg-slate-100 flex items-center justify-center flex-shrink-0">
        <Zap size={9} className="text-slate-400" />
      </div>
      <p className="text-[11px] text-slate-400 flex-1">{c.text}</p>
      <span className="text-[10px] text-slate-300 flex-shrink-0">{fmtTime(c.time)}</span>
    </div>
  )

  const isNote = c.type === 'note'
  const initials = c.sender.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()

  return (
    <div className={clsx('rounded-xl p-3 border',
      isNote ? 'bg-amber-50/70 border-amber-100' : 'bg-white border-surface-border shadow-sm')}>
      <div className="flex items-center gap-2 mb-1.5">
        <div className="w-5 h-5 rounded-full bg-primary flex items-center justify-center text-[8px] font-bold text-white flex-shrink-0">
          {initials}
        </div>
        <span className="text-[11px] font-semibold text-slate-800">{c.sender}</span>
        {isNote && (
          <span className="text-[9px] font-bold bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full flex items-center gap-1">
            <Lock size={8} /> Internal Note
          </span>
        )}
        <span className="ml-auto text-[10px] text-slate-400">{fmtTime(c.time)}</span>
      </div>
      <p className="text-[12px] text-slate-700 leading-relaxed whitespace-pre-line">{c.text}</p>
    </div>
  )
}

/* ─── Ticket Detail ───────────────────────────────────────────────────────── */

function TicketDetail({ ticket, onUpdate }) {
  const [replyMode, setReplyMode] = useState('reply')
  const [replyText, setReplyText] = useState('')
  const [editingTitle, setEditingTitle] = useState(false)
  const [titleDraft, setTitleDraft] = useState(ticket.title)
  const titleRef = useRef(null)
  const bottomRef = useRef(null)

  const sla = slaInfo(ticket)
  const isDone = ticket.status === 'resolved' || ticket.status === 'closed'

  useEffect(() => {
    setTitleDraft(ticket.title)
    setEditingTitle(false)
    setReplyText('')
  }, [ticket.id])

  useEffect(() => {
    if (editingTitle) titleRef.current?.focus()
  }, [editingTitle])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [ticket.comments.length])

  function commitTitle() {
    const t = titleDraft.trim()
    if (t && t !== ticket.title) {
      onUpdate(ticket.id, { title: t }, { type: 'event', text: `Title updated` })
    }
    setEditingTitle(false)
  }

  function addComment() {
    if (!replyText.trim()) return
    // Corner case: auto-reopen closed/resolved ticket when a new reply is added
    if (isDone && replyMode === 'reply') {
      onUpdate(ticket.id, { status: 'open', resolvedAt: null },
        { type: 'event', text: 'Ticket reopened — customer replied' })
    }
    onUpdate(ticket.id, {}, { type: replyMode, text: replyText.trim(), sender: 'You (Admin)', senderId: 'admin' })
    setReplyText('')
  }

  function resolveAndReply() {
    if (!replyText.trim()) return
    onUpdate(ticket.id, {}, { type: 'reply', text: replyText.trim(), sender: 'You (Admin)', senderId: 'admin' })
    onUpdate(ticket.id, { status: 'resolved', resolvedAt: new Date().toISOString() },
      { type: 'event', text: 'Ticket resolved' })
    setReplyText('')
  }

  function changeStatus(s) {
    const patch = s === 'resolved' ? { resolvedAt: new Date().toISOString() }
                : s === 'open'    ? { resolvedAt: null }
                : {}
    onUpdate(ticket.id, { status: s, ...patch },
      { type: 'event', text: `Status changed to ${TICKET_STATUS[s].label}` })
  }

  function changePriority(p) {
    onUpdate(ticket.id, { priority: p },
      { type: 'event', text: `Priority changed to ${TICKET_PRIORITY[p].label}` })
  }

  function changeAssignee(id) {
    const a = getAgent(id)
    onUpdate(ticket.id, { assigneeId: id || null },
      { type: 'event', text: id ? `Assigned to ${a.name}` : 'Ticket unassigned' })
  }

  return (
    <div className="flex-1 flex flex-col bg-white min-w-0 overflow-hidden">

      {/* ── Header ── */}
      <div className="flex items-start gap-3 px-5 py-3 border-b border-surface-border flex-shrink-0">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1.5 flex-wrap">
            <span className="text-[11px] font-mono text-slate-400">#{ticket.id}</span>
            <StatusBadge status={ticket.status} />
            <PriorityPill priority={ticket.priority} />
            {sla && (
              <span className={clsx('text-[10px] font-semibold flex items-center gap-1',
                sla.breach ? 'text-red-600' : sla.warning ? 'text-amber-600' : 'text-slate-400')}>
                <Clock size={10} /> SLA: {sla.label}
              </span>
            )}
            <button onClick={() => onUpdate(ticket.id, { starred: !ticket.starred })}
              className="ml-auto text-slate-300 hover:text-amber-400 transition-colors">
              <Star size={14} className={ticket.starred ? 'text-amber-400 fill-amber-400' : ''} />
            </button>
          </div>
          {editingTitle ? (
            <input ref={titleRef} value={titleDraft}
              onChange={e => setTitleDraft(e.target.value)}
              onBlur={commitTitle}
              onKeyDown={e => { if (e.key === 'Enter') commitTitle(); if (e.key === 'Escape') { setTitleDraft(ticket.title); setEditingTitle(false) } }}
              className="w-full text-[15px] font-bold text-slate-900 border-b-2 border-primary outline-none bg-transparent pb-0.5" />
          ) : (
            <button onClick={() => setEditingTitle(true)}
              className="group text-left text-[15px] font-bold text-slate-900 hover:text-primary transition-colors w-full">
              {ticket.title}
              <Pencil size={11} className="inline ml-2 text-slate-300 group-hover:text-primary transition-colors" />
            </button>
          )}
        </div>
      </div>

      {/* ── Meta strip ── */}
      <div className="flex items-center gap-0 border-b border-surface-border bg-slate-50/60 flex-shrink-0 overflow-x-auto scrollbar-none">
        {[
          {
            label: 'Assignee',
            content: (
              <select value={ticket.assigneeId || ''} onChange={e => changeAssignee(e.target.value)}
                className="text-[11px] font-semibold text-slate-700 bg-transparent border-0 outline-none cursor-pointer max-w-[120px]">
                <option value="">Unassigned</option>
                {AGENTS.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
            )
          },
          {
            label: 'Priority',
            content: (
              <select value={ticket.priority} onChange={e => changePriority(e.target.value)}
                className="text-[11px] font-semibold bg-transparent border-0 outline-none cursor-pointer"
                style={{ color: TICKET_PRIORITY[ticket.priority]?.color }}>
                {Object.entries(TICKET_PRIORITY).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
              </select>
            )
          },
          { label: 'Type',       content: <span className="text-[11px] font-semibold" style={{ color: TICKET_TYPE[ticket.type]?.color }}>{TICKET_TYPE[ticket.type]?.label}</span> },
          { label: 'Requester',  content: <span className="text-[11px] font-semibold text-slate-700">{ticket.reporterName}</span> },
          { label: 'Dept',       content: <span className="text-[11px] font-semibold text-slate-700">{ticket.department}</span> },
          { label: 'Created',    content: <span className="text-[11px] text-slate-600">{fmtTime(ticket.createdAt)}</span> },
          ...(ticket.resolvedAt ? [{ label: 'Resolved', content: <span className="text-[11px] text-slate-600">{fmtTime(ticket.resolvedAt)}</span> }] : []),
        ].map((item, i, arr) => (
          <div key={item.label} className="flex items-center gap-0 flex-shrink-0">
            <div className="flex items-center gap-1.5 px-3 py-2">
              <span className="text-[10px] text-slate-400 font-medium">{item.label}</span>
              {item.content}
            </div>
            {i < arr.length - 1 && <div className="w-px h-4 bg-slate-200 flex-shrink-0" />}
          </div>
        ))}
      </div>

      {/* ── Alerts ── */}
      {sla?.breach && (
        <div className="flex items-center gap-2 px-5 py-2 bg-red-50 border-b border-red-200 flex-shrink-0">
          <AlertTriangle size={13} className="text-red-500 flex-shrink-0" />
          <p className="text-[11px] font-semibold text-red-700 flex-1">SLA Breached — {sla.label}. This ticket requires immediate attention.</p>
          <button onClick={() => changePriority('urgent')}
            className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-red-500 text-white text-[11px] font-semibold hover:bg-red-600 transition-colors whitespace-nowrap flex-shrink-0">
            <Flag size={11} /> Set Urgent
          </button>
        </div>
      )}

      {isDone && (
        <div className="flex items-center gap-2 px-5 py-2 bg-amber-50 border-b border-amber-200 flex-shrink-0">
          <AlertCircle size={13} className="text-amber-500 flex-shrink-0" />
          <p className="text-[11px] text-amber-700">
            This ticket is <span className="font-semibold">{ticket.status}</span>.
            {' '}Sending a reply will automatically reopen it.
          </p>
        </div>
      )}

      {!ticket.assigneeId && !isDone && (
        <div className="flex items-center gap-2 px-5 py-2 bg-orange-50 border-b border-orange-200 flex-shrink-0">
          <Users size={13} className="text-orange-500 flex-shrink-0" />
          <p className="text-[11px] text-orange-700 flex-1">This ticket is <span className="font-semibold">unassigned</span>. Assign it to an agent to track accountability.</p>
        </div>
      )}

      {/* ── Description ── */}
      {ticket.description && (
        <div className="px-5 py-3 border-b border-surface-border flex-shrink-0">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Description</p>
          <p className="text-[12px] text-slate-700 leading-relaxed">{ticket.description}</p>
          {ticket.tags.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-2">
              {ticket.tags.map(tag => (
                <span key={tag} className="text-[10px] bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full font-medium">#{tag}</span>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Activity ── */}
      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Activity & Comments</p>
        {ticket.comments.map(c => <CommentBubble key={c.id} c={c} />)}
        <div ref={bottomRef} />
      </div>

      {/* ── Reply Box ── */}
      <div className="border-t border-surface-border p-3 flex-shrink-0 bg-white">
        {/* Mode tabs */}
        <div className="flex items-center gap-0.5 bg-slate-100 p-0.5 rounded-lg w-fit mb-2">
          {[['reply', 'Reply'], ['note', 'Internal Note']].map(([k, l]) => (
            <button key={k} onClick={() => setReplyMode(k)}
              className={clsx('flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-semibold transition-all',
                replyMode === k ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700')}>
              {k === 'note' && <Lock size={10} />} {l}
            </button>
          ))}
        </div>

        <div className={clsx('border rounded-xl overflow-hidden',
          replyMode === 'note' ? 'border-amber-200 bg-amber-50/40' : 'border-surface-border')}>
          <textarea
            value={replyText}
            onChange={e => setReplyText(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) addComment() }}
            placeholder={replyMode === 'note' ? 'Add an internal note (only visible to agents)…' : 'Write a reply to the customer…'}
            rows={3}
            className="w-full p-3 text-[12px] bg-transparent outline-none resize-none text-slate-800 placeholder-slate-400" />
          <div className="flex items-center justify-between px-3 py-2 border-t border-surface-border/50">
            <span className="text-[10px] text-slate-400">⌘ + Enter to send</span>
            <div className="flex items-center gap-2">
              {!isDone && replyMode === 'reply' && (
                <button onClick={resolveAndReply}
                  disabled={!replyText.trim()}
                  className="text-[11px] text-emerald-600 font-semibold hover:text-emerald-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
                  Reply & Resolve
                </button>
              )}
              <button onClick={addComment} disabled={!replyText.trim()}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary text-white text-[11px] font-semibold hover:bg-primary/90 transition-colors disabled:opacity-40 disabled:cursor-not-allowed whitespace-nowrap">
                <Send size={11} /> {replyMode === 'note' ? 'Add Note' : 'Send Reply'}
              </button>
            </div>
          </div>
        </div>

        {/* Quick actions row */}
        <div className="flex items-center gap-3 mt-2 flex-wrap">
          {isDone ? (
            <button onClick={() => changeStatus('open')}
              className="flex items-center gap-1 text-[11px] font-semibold text-primary hover:underline">
              <RefreshCw size={11} /> Reopen Ticket
            </button>
          ) : (
            <>
              <button onClick={() => changeStatus('resolved')}
                className="flex items-center gap-1 text-[11px] font-semibold text-emerald-600 hover:text-emerald-700 transition-colors">
                <CheckCircle size={11} /> Resolve
              </button>
              <span className="text-slate-200">|</span>
              <button onClick={() => changeStatus('pending')}
                className="flex items-center gap-1 text-[11px] font-semibold text-violet-600 hover:text-violet-700 transition-colors">
                <Clock size={11} /> Pending
              </button>
              <span className="text-slate-200">|</span>
              <button onClick={() => changeStatus('closed')}
                className="flex items-center gap-1 text-[11px] font-semibold text-slate-500 hover:text-slate-700 transition-colors">
                <XCircle size={11} /> Close
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

/* ─── Bulk Actions Bar ────────────────────────────────────────────────────── */

function BulkBar({ count, tickets, selected, onApply, onDelete, onClear }) {
  const [showStatus, setShowStatus] = useState(false)

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 px-4 py-2.5 bg-slate-900 text-white rounded-2xl shadow-modal text-[11px] font-semibold animate-fade-in">
      <span className="text-slate-300">{count} selected</span>
      <div className="w-px h-4 bg-slate-700" />

      {/* Assign */}
      <div className="relative group">
        <button className="flex items-center gap-1.5 hover:text-primary transition-colors">
          <User size={12} /> Assign
          <ChevronDown size={10} />
        </button>
        <div className="absolute bottom-full mb-2 left-0 bg-white border border-surface-border rounded-xl shadow-modal overflow-hidden hidden group-hover:block min-w-[140px]">
          <div className="py-1">
            <button onClick={() => { onApply('assigneeId', null); }}
              className="w-full text-left px-3 py-1.5 text-[11px] text-slate-600 hover:bg-surface-hover">
              Unassigned
            </button>
            {AGENTS.map(a => (
              <button key={a.id} onClick={() => onApply('assigneeId', a.id)}
                className="w-full text-left px-3 py-1.5 text-[11px] text-slate-600 hover:bg-surface-hover">
                {a.name}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Status */}
      <div className="relative group">
        <button className="flex items-center gap-1.5 hover:text-primary transition-colors">
          <Circle size={12} /> Status
          <ChevronDown size={10} />
        </button>
        <div className="absolute bottom-full mb-2 left-0 bg-white border border-surface-border rounded-xl shadow-modal overflow-hidden hidden group-hover:block min-w-[130px]">
          <div className="py-1">
            {Object.entries(TICKET_STATUS).map(([k, v]) => (
              <button key={k} onClick={() => onApply('status', k)}
                className="w-full text-left px-3 py-1.5 text-[11px] hover:bg-surface-hover"
                style={{ color: v.color }}>
                {v.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Priority */}
      <div className="relative group">
        <button className="flex items-center gap-1.5 hover:text-primary transition-colors">
          <Flag size={12} /> Priority
          <ChevronDown size={10} />
        </button>
        <div className="absolute bottom-full mb-2 left-0 bg-white border border-surface-border rounded-xl shadow-modal overflow-hidden hidden group-hover:block min-w-[110px]">
          <div className="py-1">
            {Object.entries(TICKET_PRIORITY).map(([k, v]) => (
              <button key={k} onClick={() => onApply('priority', k)}
                className="w-full text-left px-3 py-1.5 text-[11px] hover:bg-surface-hover"
                style={{ color: v.color }}>
                {v.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="w-px h-4 bg-slate-700" />
      <button onClick={onDelete}
        className="flex items-center gap-1.5 text-red-300 hover:text-red-200 transition-colors">
        <Trash2 size={12} /> Delete
      </button>
      <div className="w-px h-4 bg-slate-700" />
      <button onClick={onClear}><X size={13} className="text-slate-400 hover:text-white transition-colors" /></button>
    </div>
  )
}

/* ─── Create Ticket Modal ─────────────────────────────────────────────────── */

function CreateModal({ onClose, onCreate, nextSeq }) {
  const [form, setForm] = useState({
    title: '', description: '',
    priority: 'medium', type: 'support',
    assigneeId: '', department: 'Support',
    reporterName: '', reporterPhone: '',
    slaHours: '8', tags: '',
  })
  const f = (k, v) => setForm(p => ({ ...p, [k]: v }))
  const valid = form.title.trim() && form.reporterName.trim()

  function submit() {
    if (!valid) return
    const now = new Date().toISOString()
    const slaDeadline = form.slaHours ? new Date(Date.now() + Number(form.slaHours) * 3600000).toISOString() : null
    const initials = form.reporterName.trim().split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()
    const agent = getAgent(form.assigneeId)
    const ticket = {
      id: `T-${nextSeq}`, seq: nextSeq,
      title: form.title.trim(),
      description: form.description.trim(),
      status: 'open', priority: form.priority, type: form.type,
      assigneeId: form.assigneeId || null,
      reporterName: form.reporterName.trim(),
      reporterPhone: form.reporterPhone.trim(),
      reporterAvatar: initials,
      department: form.department,
      tags: form.tags.split(',').map(t => t.trim()).filter(Boolean),
      createdAt: now, updatedAt: now, resolvedAt: null,
      slaDeadline, conversationId: null, starred: false,
      comments: [
        { id: `ce${Date.now()}`, type: 'event', text: 'Ticket created', time: now, sender: 'System' },
        ...(agent ? [{ id: `ce${Date.now() + 1}`, type: 'event', text: `Assigned to ${agent.name}`, time: now, sender: 'System' }] : []),
      ],
      watchers: [],
    }
    onCreate(ticket)
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm"
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="bg-white w-full max-w-lg rounded-2xl shadow-modal flex flex-col max-h-[90vh] overflow-hidden border border-surface-border">

        {/* Header */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-surface-border flex-shrink-0">
          <div className="w-7 h-7 rounded-lg bg-primary-50 flex items-center justify-center flex-shrink-0">
            <TicketCheck size={13} className="text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[13px] font-bold text-slate-900">Create Ticket</p>
            <p className="text-[10px] text-slate-400">Open a new support ticket for tracking and resolution</p>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-surface-hover text-slate-400 transition-colors">
            <X size={14} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">

          <div>
            <label className="block text-[10px] font-semibold text-slate-500 mb-1">
              Subject / Title <span className="text-red-400">*</span>
            </label>
            <input value={form.title} onChange={e => f('title', e.target.value)}
              placeholder="Brief description of the issue"
              className="w-full text-[12px] border border-surface-border rounded-lg px-2.5 py-2 focus:outline-none focus:ring-2 focus:ring-primary/15 focus:border-primary/40 transition-all placeholder-slate-300" />
          </div>

          <div>
            <label className="block text-[10px] font-semibold text-slate-500 mb-1">Description</label>
            <textarea value={form.description} onChange={e => f('description', e.target.value)}
              placeholder="Detailed description of the issue, steps to reproduce, expected vs actual behavior…"
              rows={3}
              className="w-full text-[12px] border border-surface-border rounded-lg px-2.5 py-2 focus:outline-none focus:ring-2 focus:ring-primary/15 focus:border-primary/40 transition-all placeholder-slate-300 resize-none" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[10px] font-semibold text-slate-500 mb-1">Priority</label>
              <NativeSelect value={form.priority} onChange={e => f('priority', e.target.value)} sm className="w-full">
                {Object.entries(TICKET_PRIORITY).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
              </NativeSelect>
            </div>
            <div>
              <label className="block text-[10px] font-semibold text-slate-500 mb-1">Type</label>
              <NativeSelect value={form.type} onChange={e => f('type', e.target.value)} sm className="w-full">
                {Object.entries(TICKET_TYPE).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
              </NativeSelect>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[10px] font-semibold text-slate-500 mb-1">
                Requester Name <span className="text-red-400">*</span>
              </label>
              <input value={form.reporterName} onChange={e => f('reporterName', e.target.value)}
                placeholder="Customer full name"
                className="w-full text-[12px] border border-surface-border rounded-lg px-2.5 py-2 focus:outline-none focus:ring-2 focus:ring-primary/15 focus:border-primary/40 transition-all placeholder-slate-300" />
            </div>
            <div>
              <label className="block text-[10px] font-semibold text-slate-500 mb-1">Phone</label>
              <input value={form.reporterPhone} onChange={e => f('reporterPhone', e.target.value)}
                placeholder="+91 9XXXXXXXXX"
                className="w-full text-[12px] border border-surface-border rounded-lg px-2.5 py-2 focus:outline-none focus:ring-2 focus:ring-primary/15 focus:border-primary/40 transition-all placeholder-slate-300" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[10px] font-semibold text-slate-500 mb-1">Assign To</label>
              <NativeSelect value={form.assigneeId} onChange={e => f('assigneeId', e.target.value)} sm className="w-full">
                <option value="">Unassigned</option>
                {AGENTS.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
              </NativeSelect>
            </div>
            <div>
              <label className="block text-[10px] font-semibold text-slate-500 mb-1">Department</label>
              <NativeSelect value={form.department} onChange={e => f('department', e.target.value)} sm className="w-full">
                {DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}
              </NativeSelect>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[10px] font-semibold text-slate-500 mb-1">SLA Deadline</label>
              <NativeSelect value={form.slaHours} onChange={e => f('slaHours', e.target.value)} sm className="w-full">
                <option value="">No SLA</option>
                {SLA_PRESETS.map(p => <option key={p.hours} value={p.hours}>{p.label}</option>)}
              </NativeSelect>
            </div>
            <div>
              <label className="block text-[10px] font-semibold text-slate-500 mb-1">Tags (comma-separated)</label>
              <input value={form.tags} onChange={e => f('tags', e.target.value)}
                placeholder="billing, refund, urgent"
                className="w-full text-[12px] border border-surface-border rounded-lg px-2.5 py-2 focus:outline-none focus:ring-2 focus:ring-primary/15 focus:border-primary/40 transition-all placeholder-slate-300" />
            </div>
          </div>

          {/* Warnings */}
          {!form.assigneeId && (
            <div className="flex items-start gap-2 p-2.5 bg-amber-50 border border-amber-200 rounded-lg">
              <AlertCircle size={13} className="text-amber-500 flex-shrink-0 mt-0.5" />
              <p className="text-[11px] text-amber-700">Ticket will be <span className="font-semibold">unassigned</span>. You can assign it later from the ticket view.</p>
            </div>
          )}
          {form.priority === 'urgent' && (
            <div className="flex items-start gap-2 p-2.5 bg-red-50 border border-red-200 rounded-lg">
              <AlertTriangle size={13} className="text-red-500 flex-shrink-0 mt-0.5" />
              <p className="text-[11px] text-red-700">Urgent priority — this ticket will appear at the top of the queue and SLA timers start immediately.</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-4 py-2.5 border-t border-surface-border flex-shrink-0">
          <button onClick={onClose} className="text-[11px] text-slate-400 hover:text-slate-600 transition-colors">Cancel</button>
          <button onClick={submit} disabled={!valid}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary text-white text-[11px] font-semibold hover:bg-primary/90 transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
            <TicketCheck size={11} /> Create Ticket
          </button>
        </div>
      </div>
    </div>
  )
}

/* ─── Page ────────────────────────────────────────────────────────────────── */

export default function Tickets() {
  const [tickets, setTickets]     = useState(INIT_TICKETS)
  const [filter, setFilter]       = useState('all')
  const [search, setSearch]       = useState('')
  const [sort, setSort]           = useState('newest')
  const [activeId, setActiveId]   = useState(INIT_TICKETS[0].id)
  const [selected, setSelected]   = useState([])
  const [showCreate, setShowCreate] = useState(false)

  const nextSeq = useMemo(() => Math.max(...tickets.map(t => t.seq), 1007) + 1, [tickets])

  /* Filter + search + sort */
  const visible = useMemo(() => {
    let arr = [...tickets]

    if (filter === 'unassigned')  arr = arr.filter(t => !t.assigneeId)
    else if (filter === 'starred')     arr = arr.filter(t => t.starred)
    else if (filter === 'sla_breach')  arr = arr.filter(t => slaInfo(t)?.breach)
    else if (filter.startsWith('s:'))  arr = arr.filter(t => t.status   === filter.slice(2))
    else if (filter.startsWith('p:'))  arr = arr.filter(t => t.priority === filter.slice(2))
    // 'all' and 'mine' (mine = admin, placeholder same as all for now)

    if (search.trim()) {
      const q = search.toLowerCase()
      arr = arr.filter(t =>
        t.title.toLowerCase().includes(q) ||
        t.id.toLowerCase().includes(q) ||
        t.reporterName.toLowerCase().includes(q) ||
        t.tags.some(tag => tag.toLowerCase().includes(q))
      )
    }

    if (sort === 'newest')   arr.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt))
    if (sort === 'oldest')   arr.sort((a, b) => new Date(a.updatedAt) - new Date(b.updatedAt))
    if (sort === 'priority') arr.sort((a, b) => TICKET_PRIORITY[a.priority].order - TICKET_PRIORITY[b.priority].order)
    if (sort === 'sla')      arr.sort((a, b) => new Date(a.slaDeadline || '9999') - new Date(b.slaDeadline || '9999'))

    return arr
  }, [tickets, filter, search, sort])

  const activeTicket = tickets.find(t => t.id === activeId)

  /* Keep active selection in sync when filter changes */
  useEffect(() => {
    if (visible.length > 0 && !visible.find(t => t.id === activeId)) {
      setActiveId(visible[0].id)
    }
    if (visible.length === 0) setActiveId(null)
  }, [visible])

  function updateTicket(id, patch, comment) {
    setTickets(prev => prev.map(t => {
      if (t.id !== id) return t
      const next = { ...t, ...patch, updatedAt: new Date().toISOString() }
      if (comment) next.comments = [...t.comments, { id: `c${Date.now()}`, time: new Date().toISOString(), ...comment }]
      return next
    }))
  }

  function createTicket(ticket) {
    setTickets(p => [ticket, ...p])
    setActiveId(ticket.id)
    setFilter('all')
    setSearch('')
  }

  function deleteSelected() {
    setTickets(p => p.filter(t => !selected.includes(t.id)))
    if (selected.includes(activeId)) setActiveId(null)
    setSelected([])
  }

  function bulkApply(field, value) {
    setTickets(prev => prev.map(t => {
      if (!selected.includes(t.id)) return t
      const patch = { [field]: value, updatedAt: new Date().toISOString() }
      const comment = { id: `c${Date.now()}`, type: 'event', time: new Date().toISOString(),
        text: field === 'status'   ? `Status changed to ${TICKET_STATUS[value]?.label || 'Unassigned'}`
            : field === 'priority' ? `Priority changed to ${TICKET_PRIORITY[value]?.label}`
            : field === 'assigneeId' ? (value ? `Assigned to ${getAgent(value)?.name}` : 'Ticket unassigned')
            : 'Updated', sender: 'System' }
      return { ...t, ...patch, comments: [...t.comments, comment] }
    }))
    setSelected([])
  }

  /* Stats for header */
  const openCount   = tickets.filter(t => t.status === 'open' || t.status === 'in_progress').length
  const breachCount = tickets.filter(t => slaInfo(t)?.breach).length
  const unassigned  = tickets.filter(t => !t.assigneeId && t.status !== 'closed' && t.status !== 'resolved').length

  return (
    <div className="flex flex-col h-full bg-white">

      {/* ── Page header ── */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-surface-border flex-shrink-0">
        <div>
          <div className="flex items-center gap-2 mb-0.5">
            <h1 className="text-[15px] font-bold text-slate-900">Tickets</h1>
            <span className="text-[10px] font-bold bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full">{tickets.length} total</span>
          </div>
          <p className="text-[11px] text-slate-400">Track and resolve customer issues with full lifecycle management</p>
        </div>

        {/* Quick stats */}
        <div className="flex items-center gap-3">
          {breachCount > 0 && (
            <button onClick={() => setFilter('sla_breach')}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-50 border border-red-200 text-red-600 text-[11px] font-semibold hover:bg-red-100 transition-colors whitespace-nowrap">
              <AlertTriangle size={12} /> {breachCount} SLA Breach{breachCount > 1 ? 'es' : ''}
            </button>
          )}
          {unassigned > 0 && (
            <button onClick={() => setFilter('unassigned')}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-orange-50 border border-orange-200 text-orange-600 text-[11px] font-semibold hover:bg-orange-100 transition-colors whitespace-nowrap">
              <Users size={12} /> {unassigned} Unassigned
            </button>
          )}
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary-50 text-primary text-[11px] font-semibold whitespace-nowrap">
            <Circle size={12} /> {openCount} Open
          </div>
          <button onClick={() => setShowCreate(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary text-white text-[11px] font-semibold hover:bg-primary/90 transition-colors whitespace-nowrap">
            <Plus size={13} /> Create Ticket
          </button>
        </div>
      </div>

      {/* ── Body ── */}
      <div className="flex flex-1 min-h-0">
        <FilterSidebar filter={filter} setFilter={setFilter} tickets={tickets} />

        <TicketListPanel
          tickets={visible}
          activeId={activeId}
          onSelect={id => { setActiveId(id); setSelected([]) }}
          onCreate={() => setShowCreate(true)}
          selected={selected}
          onCheck={id => setSelected(p => p.includes(id) ? p.filter(x => x !== id) : [...p, id])}
          onCheckAll={ids => setSelected(ids)}
          onClearSel={() => setSelected([])}
          search={search} setSearch={setSearch}
          sort={sort} setSort={setSort}
        />

        {activeTicket ? (
          <TicketDetail key={activeId} ticket={activeTicket} onUpdate={updateTicket} />
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-center p-10">
            <div className="w-14 h-14 rounded-2xl bg-primary-50 flex items-center justify-center mb-4">
              <TicketCheck size={26} className="text-primary" />
            </div>
            <p className="text-[14px] font-bold text-slate-900 mb-1">Select a ticket</p>
            <p className="text-[12px] text-slate-400 mb-5">Pick a ticket from the list to see details and respond</p>
            <button onClick={() => setShowCreate(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary text-white text-[11px] font-semibold hover:bg-primary/90 transition-colors">
              <Plus size={13} /> Create First Ticket
            </button>
          </div>
        )}
      </div>

      {/* ── Bulk bar ── */}
      {selected.length > 0 && (
        <BulkBar
          count={selected.length}
          selected={selected}
          onApply={bulkApply}
          onDelete={deleteSelected}
          onClear={() => setSelected([])}
        />
      )}

      {/* ── Create modal ── */}
      {showCreate && (
        <CreateModal
          onClose={() => setShowCreate(false)}
          onCreate={createTicket}
          nextSeq={nextSeq}
        />
      )}
    </div>
  )
}
