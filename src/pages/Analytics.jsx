import { useState, useRef, useEffect } from 'react'
import {
  AreaChart, Area, BarChart, Bar, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell,
} from 'recharts'
import {
  MessageSquare, Users, Bot, PhoneForwarded, CheckCircle2,
  XCircle, Activity, GitBranch, TrendingDown, AlertCircle,
  ShieldAlert, Timer, Clock, ThumbsUp, TrendingUp,
  Globe, Star, AlertTriangle, Wifi, RefreshCw, Coffee,
  Send, Eye, Zap, CalendarCheck, CalendarX, CalendarClock,
  ArrowUpRight, ArrowDownRight, Download, ChevronDown,
  Megaphone, Search, Calendar, Maximize2, X,
  Target, CornerUpLeft, MousePointerClick, MailOpen, CheckCheck, ChevronRight,
  Upload, Check,
} from 'lucide-react'
import clsx from 'clsx'
import { subDays, format } from 'date-fns'
import { NativeSelect } from '../components/Select'
import DatePicker from '../components/DatePicker'

/* ─── helpers ───────────────────────────────────────────────────── */
const rand  = (a, b) => Math.floor(a + Math.random() * (b - a))
const today = new Date()
const days  = (n) => Array.from({ length: n }, (_, i) => format(subDays(today, n - 1 - i), 'MMM d'))

/* ─── mock data ─────────────────────────────────────────────────── */
const makeChat = (n) => days(n).map(d => {
  const botHandled = rand(100, 320)
  const resolved   = rand(40, 140)
  const closed     = rand(20, 80)
  const active     = rand(5, 30)
  const handoff    = resolved + closed + active
  const totalChats = botHandled + handoff
  const ctwa       = rand(40, 180)
  const gCtwa      = rand(20, 90)
  const attended   = rand(30, 130)
  const unattended = rand(5, 40)
  return { date: d, totalChats, messages: rand(900, 3800), botHandled, handoff, resolved, closed, active, flowCompleted: rand(30, 160), dropOff: rand(10, 70), fallback: rand(5, 40), uniqueUsers: rand(100, 420), slaBreached: rand(1, 12), ctwa, gCtwa, attended, unattended, apptBooked: rand(10, 80) }
})
const CHAT_30 = makeChat(30), CHAT_7 = makeChat(7), CHAT_1 = makeChat(1)

const HOURS    = Array.from({ length: 24 }, (_, i) => `${String(i).padStart(2,'0')}:00`)
const WEEKDAYS = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun']
const HEATMAP  = WEEKDAYS.map(day => ({
  day,
  hours: HOURS.map(h => {
    const hr = parseInt(h), isWe = day === 'Sat' || day === 'Sun', peak = hr >= 9 && hr <= 20
    return { hour: h, value: rand(peak ? (isWe ? 5 : 30) : 0, peak ? (isWe ? 40 : 180) : 15) }
  }),
}))

const LEAD_SOURCES = [
  { source: 'Facebook',      count: 429, url: 'facebook.com/page',  color: '#1877F2' },
  { source: 'Website',       count: 339, url: 'yoursite.com/chat',  color: '#0066ff' },
  { source: 'Portals',       count: 303, url: 'portals.yoursite.com', color: '#8B5CF6' },
  { source: 'Knowlarity',    count: 184, url: 'knowlarity.com',     color: '#F59E0B' },
  { source: 'Google Ads',    count: 102, url: 'ads.google.com',     color: '#34A853' },
  { source: 'Others',        count: 64,  url: 'â€”',                  color: '#94a3b8' },
  { source: 'Unknown',       count: 2,   url: 'â€”',                  color: '#cbd5e1' },
  { source: 'Instagram',     count: 1,   url: 'instagram.com',      color: '#E1306C' },
  { source: 'Voice',         count: 1,   url: 'â€”',                  color: '#14B8A6' },
]
const LEAD_TOTAL = LEAD_SOURCES.reduce((s, l) => s + l.count, 0)

const LEAD_SOURCE_DAILY = [
  { source: 'Facebook',   color: '#1877F2', days: [49,82,80,68,73,41,36,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0], total: 429 },
  { source: 'Website',    color: '#0066ff', days: [35,42,65,44,60,33,60,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0], total: 339 },
  { source: 'Portals',    color: '#8B5CF6', days: [47,33,48,55,49,43,28,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0], total: 303 },
  { source: 'Knowlarity', color: '#F59E0B', days: [36,25,16,30,24,26,27,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0], total: 184 },
  { source: 'Google Ads', color: '#34A853', days: [17,11,11,20,11,19,13,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0], total: 102 },
  { source: 'Unknown',    color: '#cbd5e1', days: [0,0,0,1,0,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],        total: 2   },
  { source: 'Instagram',  color: '#E1306C', days: [0,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],        total: 1   },
  { source: 'Voice',      color: '#14B8A6', days: [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],        total: 1   },
  { source: 'Others',     color: '#94a3b8', days: [13,8,14,12,11,3,3,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],    total: 64  },
]

const TIME_BLOCKS_DAY = [
  { label: '12aâ€“2a', value: 142 }, { label: '2aâ€“4a', value: 118 },
  { label: '4aâ€“6a', value: 97  }, { label: '6aâ€“8a', value: 134 },
  { label: '8aâ€“10a', value: 298 }, { label: '10aâ€“12p', value: 541 },
  { label: '12pâ€“2p', value: 612 }, { label: '2pâ€“4p', value: 587 },
  { label: '4pâ€“6p', value: 1112 }, { label: '6pâ€“8p', value: 334 },
  { label: '8pâ€“10p', value: 284 }, { label: '10pâ€“12a', value: 257 },
]
const TIME_BLOCKS_WEEK = TIME_BLOCKS_DAY.map(b => ({ ...b, value: b.value * 6 + rand(0, 200) }))
const TIME_BLOCKS_MONTH = TIME_BLOCKS_DAY.map(b => ({ ...b, value: b.value * 26 + rand(0, 800) }))
const TIME_BLOCKS_YEAR = TIME_BLOCKS_DAY.map(b => ({ ...b, value: b.value * 300 + rand(0, 5000) }))

const OPTION_WISE = [
  { name: 'Book Appointment',   count: 53, color: '#0066ff', trend: 12 },
  { name: 'Ask your query',     count: 41, color: '#8B5CF6', trend: -3 },
  { name: 'Other',              count: 29, color: '#94a3b8', trend: 0  },
  { name: 'Screening Packages', count: 16, color: '#14B8A6', trend: 5  },
  { name: 'Check Status',       count: 14, color: '#F59E0B', trend: 8  },
  { name: 'Talk to Agent',      count: 12, color: '#EC4899', trend: 2  },
  { name: 'View Pricing',       count: 10, color: '#34A853', trend: -1 },
  { name: 'Get Support',        count: 9,  color: '#F87171', trend: 4  },
]
const OPTION_TOTAL = OPTION_WISE.reduce((s, o) => s + o.count, 0)

const FLOW_FUNNEL = [
  { stage: 'Sessions Started',     value: 4820, color: '#0066ff' },
  { stage: 'Welcome Shown',        value: 4612, color: '#2563EB' },
  { stage: 'Option Selected',      value: 3941, color: '#60A5FA' },
  { stage: 'Flow Completed',       value: 2876, color: '#22C55E' },
  { stage: 'Resolved / Converted', value: 1834, color: '#16A34A' },
]

const RT_DIST = [
  { range: '< 1 min',  count: 342, pct: 34.2, color: '#22C55E' },
  { range: '1â€“3 min',  count: 278, pct: 27.8, color: '#4ADE80' },
  { range: '3â€“5 min',  count: 156, pct: 15.6, color: '#F59E0B' },
  { range: '5â€“10 min', count: 124, pct: 12.4, color: '#F87171' },
  { range: '> 10 min', count: 100, pct: 10.0, color: '#EF4444' },
]

const makeCsat = (n) => days(n).map(d => ({ date: d, score: parseFloat((3.5 + Math.random() * 1.5).toFixed(1)), count: rand(20,80) }))
const CSAT_30 = makeCsat(30), CSAT_7 = makeCsat(7), CSAT_1 = makeCsat(1)

const RT_AGENTS = [
  { name: 'Rahul Mehta',  avatar: 'RM', status: 'online',  active: 4, queue: 2, avgReply: '1m 12s', avgHandle: '12m 30s', longest: '18m 04s', resolved: 18, transferred: 2, csat: 4.9, sla: 0 },
  { name: 'Priya Das',    avatar: 'PD', status: 'online',  active: 3, queue: 1, avgReply: '2m 04s', avgHandle: '16m 10s', longest: '22m 15s', resolved: 14, transferred: 1, csat: 4.6, sla: 1 },
  { name: 'Aryan Kapoor', avatar: 'AK', status: 'busy',    active: 5, queue: 3, avgReply: '3m 41s', avgHandle: '21m 45s', longest: '35m 50s', resolved: 11, transferred: 3, csat: 4.3, sla: 3 },
  { name: 'Sunita Rao',   avatar: 'SR', status: 'break',   active: 0, queue: 0, avgReply: 'â€”',      avgHandle: 'â€”',       longest: 'â€”',       resolved: 9,  transferred: 0, csat: 4.7, sla: 0 },
  { name: 'Vikram Singh', avatar: 'VS', status: 'offline', active: 0, queue: 0, avgReply: 'â€”',      avgHandle: 'â€”',       longest: 'â€”',       resolved: 6,  transferred: 1, csat: 4.5, sla: 0 },
]

const makeAppt = (n) => days(n).map(d => ({ date: d, booked: rand(4,22), completed: rand(3,18), cancelled: rand(0,5), noShow: rand(0,3), rescheduled: rand(0,4) }))
const APPT_30 = makeAppt(30), APPT_7 = makeAppt(7), APPT_1 = makeAppt(1)
const APPT_STATUS = [
  { name: 'Completed',   value: 61, color: '#22C55E' },
  { name: 'Cancelled',   value: 16, color: '#F87171' },
  { name: 'No Show',     value: 9,  color: '#F59E0B' },
  { name: 'Rescheduled', value: 9,  color: '#8B5CF6' },
  { name: 'Upcoming',    value: 5,  color: '#0066ff' },
]

const makeBc = (n) => days(n).map(d => ({ date: d, sent: rand(600,2400), delivered: rand(580,2200), read: rand(200,900), clicked: rand(40,220) }))
const BC_30 = makeBc(30), BC_7 = makeBc(7), BC_1 = makeBc(1)
const BC_CAMPAIGNS = [
  { name: 'Summer Sale',       sent: 4820, delivered: 4680, read: 2140, clicked: 386, replied: 270,  failed: 140, readRate: 45.7, clickRate: 8.0  },
  { name: 'Reorder Reminder',  sent: 2310, delivered: 2280, read: 1560, clicked: 290, replied: 204,  failed: 30,  readRate: 68.4, clickRate: 12.7 },
  { name: 'New Feature Alert', sent: 6100, delivered: 5920, read: 1890, clicked: 220, replied: 154,  failed: 180, readRate: 31.9, clickRate: 3.7  },
  { name: 'Feedback Request',  sent: 1850, delivered: 1820, read: 980,  clicked: 148, replied: 104,  failed: 30,  readRate: 53.8, clickRate: 8.1  },
]

// ── Template-level analytics ──────────────────────────────────────────────────
const BC_TEMPLATES = [
  {
    id: 'tpl_summer_sale',
    name: 'Summer Sale Offer',
    category: 'Marketing',
    status: 'APPROVED',
    campaigns: ['Summer Sale'],
    attempted: 48200, sent: 46800, delivered: 45100, read: 21400, clicked: 3860, failed: 1400,
    readRate: 47.5, clickRate: 8.6, deliveryRate: 96.4,
    replied: 1920, userInitiated: 4100,
    errors: [
      { code: '130111', type: "User's number part of an experiment", count: 820 },
      { code: '131026', type: 'Limit Reached',                       count: 580 },
    ],
    dailySent: BC_30.map(d => ({ date: d.date, sent: rand(800,2200), delivered: rand(760,2100), read: rand(300,900), clicked: rand(40,200) })),
  },
  {
    id: 'tpl_reorder',
    name: 'Reorder Reminder',
    category: 'Utility',
    status: 'APPROVED',
    campaigns: ['Reorder Reminder'],
    attempted: 23100, sent: 22800, delivered: 22400, read: 15600, clicked: 2900, failed: 400,
    readRate: 69.6, clickRate: 12.9, deliveryRate: 98.2,
    replied: 3100, userInitiated: 2200,
    errors: [
      { code: '100', type: 'Parameter is invalid', count: 400 },
    ],
    dailySent: BC_30.map(d => ({ date: d.date, sent: rand(300,900), delivered: rand(280,880), read: rand(180,620), clicked: rand(30,130) })),
  },
  {
    id: 'tpl_feature_alert',
    name: 'New Feature Alert',
    category: 'Marketing',
    status: 'APPROVED',
    campaigns: ['New Feature Alert'],
    attempted: 61000, sent: 59200, delivered: 56800, read: 18900, clicked: 2200, failed: 2400,
    readRate: 33.3, clickRate: 3.9, deliveryRate: 95.9,
    replied: 980, userInitiated: 1800,
    errors: [
      { code: '100',    type: 'Parameter is invalid',   count: 1200 },
      { code: '132000', type: 'Template parameter mismatch', count: 1200 },
    ],
    dailySent: BC_30.map(d => ({ date: d.date, sent: rand(1200,2800), delivered: rand(1100,2600), read: rand(280,800), clicked: rand(20,100) })),
  },
  {
    id: 'tpl_feedback',
    name: 'Feedback Request',
    category: 'Service',
    status: 'APPROVED',
    campaigns: ['Feedback Request'],
    attempted: 18500, sent: 18200, delivered: 17800, read: 9800, clicked: 1480, failed: 400,
    readRate: 55.1, clickRate: 8.3, deliveryRate: 97.8,
    replied: 2100, userInitiated: 1600,
    errors: [
      { code: '130111', type: 'Message Undeliverable', count: 400 },
    ],
    dailySent: BC_30.map(d => ({ date: d.date, sent: rand(300,750), delivered: rand(280,730), read: rand(120,400), clicked: rand(15,80) })),
  },
  {
    id: 'tpl_welcome',
    name: 'Welcome Message',
    category: 'Marketing',
    status: 'APPROVED',
    campaigns: [],
    attempted: 9200, sent: 9100, delivered: 8800, read: 6100, clicked: 820, failed: 300,
    readRate: 69.3, clickRate: 9.3, deliveryRate: 96.7,
    replied: 1400, userInitiated: 900,
    errors: [],
    dailySent: BC_30.map(d => ({ date: d.date, sent: rand(100,400), delivered: rand(95,390), read: rand(60,270), clicked: rand(5,40) })),
  },
]

const makeAI = (n) => days(n).map(d => ({ date: d, tokens: rand(12000,80000), sessions: rand(40,200), suggested: rand(30,160), accepted: rand(20,120) }))
const AI_30 = makeAI(30), AI_7 = makeAI(7), AI_1 = makeAI(1)
const AI_FEATURES = [
  { name: 'Intent Detection',   uses: 6120, rate: 89, color: '#1e293b' },
  { name: 'Sentiment Analysis', uses: 4210, rate: 100, color: '#374151' },
  { name: 'Smart Replies',      uses: 3840, rate: 77, color: '#6b7280' },
  { name: 'Auto Summarise',     uses: 1680, rate: 76, color: '#9ca3af' },
  { name: 'Flow Suggestions',   uses: 940,  rate: 64, color: '#d1d5db' },
]

const PRESETS = [
  { id: 'today', label: 'Today'   },
  { id: '7d',    label: '7 Days'  },
  { id: '30d',   label: '30 Days' },
]
const TABS = [
  { id: 'chat',      label: 'Chatbot & Live Agents' },
  { id: 'appt',      label: 'Appointments'          },
  { id: 'broadcast', label: 'Broadcasts'            },
  { id: 'ai',        label: 'AI Usage'              },
]

/* ─── tooltip ───────────────────────────────────────────────────── */
const ChartTip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-white border border-surface-border rounded-xl px-3 py-2 text-[10px] shadow-modal">
      <p className="font-semibold text-slate-600 mb-1.5">{label}</p>
      {payload.map(p => (
        <div key={p.dataKey} className="flex items-center gap-1.5 mb-0.5">
          <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: p.color }}/>
          <span className="text-slate-400">{p.name}:</span>
          <span className="font-bold text-slate-700">{typeof p.value === 'number' ? p.value.toLocaleString() : p.value}</span>
        </div>
      ))}
    </div>
  )
}

/* ─── metric card ───────────────────────────────────────────────── */
function MetricCard({ icon: Icon, label, value, sub, trend, color = '#0066ff', warn = false, pro = false, onExpand }) {
  const up = trend > 0
  return (
    <div className={clsx(
      'bg-white border rounded-xl p-4 flex flex-col gap-2.5 group relative',
      warn ? 'border-red-200' : 'border-surface-border',
      onExpand && 'cursor-pointer hover:shadow-sm transition-shadow'
    )} onClick={onExpand}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
            style={{ background: '#f5f5f5' }}>
            <Icon size={13} style={{ color: warn ? '#ef4444' : '#374151' }}/>
          </div>
          {pro && <ProBadge/>}
        </div>
        <div className="flex items-center gap-1.5">
          {trend != null && (
            <span className={clsx(
              'flex items-center gap-0.5 text-[9px] font-bold px-1.5 py-0.5 rounded-full',
              up ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-500'
            )}>
              {up ? <ArrowUpRight size={8}/> : <ArrowDownRight size={8}/>}{Math.abs(trend)}%
            </span>
          )}
          {onExpand && (
            <span className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center w-5 h-5 rounded-md hover:bg-slate-100 text-slate-400">
              <Maximize2 size={10}/>
            </span>
          )}
        </div>
      </div>
      <div>
        <p className={clsx('text-[20px] font-bold leading-none', warn ? 'text-red-500' : 'text-slate-800')}>
          {value}
        </p>
        <p className="text-[10px] font-medium text-slate-400 mt-1">{label}</p>
        {sub && <p className="text-[9px] text-slate-300 mt-0.5">{sub}</p>}
      </div>
    </div>
  )
}

/* ─── chart card ─────────────────────────────────────────────────── */
function ChartCard({ title, sub, right, children, noPad = false, className = '' }) {
  return (
    <div className={clsx('bg-white border border-surface-border rounded-xl overflow-hidden flex flex-col', className)}>
      <div className="flex items-center justify-between px-4 py-3 border-b border-surface-border flex-shrink-0">
        <div>
          <p className="text-[12px] font-semibold text-slate-700">{title}</p>
          {sub && <p className="text-[10px] text-slate-400 mt-0.5">{sub}</p>}
        </div>
        {right}
      </div>
      <div className={clsx(noPad ? '' : 'p-4', 'flex-1')}>{children}</div>
    </div>
  )
}

/* ─── legend ─────────────────────────────────────────────────────── */
function Legend({ items }) {
  return (
    <div className="flex items-center gap-4 mt-3 flex-wrap">
      {items.map(l => (
        <span key={l.label} className="flex items-center gap-1.5 text-[10px] text-slate-400">
          <span className="w-2 h-2 rounded-sm flex-shrink-0" style={{ background: l.color }}/>{l.label}
        </span>
      ))}
    </div>
  )
}

/* ─── section label ─────────────────────────────────────────────── */
function SLabel({ children, open, onToggle }) {
  return (
    <div className={clsx('flex items-center justify-between mb-2 cursor-pointer group select-none')} onClick={onToggle}>
      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
        {children}
      </p>
      <span className={clsx(
        'flex items-center justify-center w-5 h-5 rounded-md text-slate-400 transition-all duration-200',
        'group-hover:bg-slate-100',
        open ? 'rotate-180' : 'rotate-0'
      )}>
        <ChevronDown size={12}/>
      </span>
    </div>
  )
}

/* ─── status badge ──────────────────────────────────────────────── */
const STATUS_CFG = {
  online:  { dot: 'bg-emerald-400', text: 'text-emerald-600', label: 'Online'  },
  busy:    { dot: 'bg-amber-400',   text: 'text-amber-600',   label: 'Busy'    },
  break:   { dot: 'bg-blue-400',    text: 'text-blue-600',    label: 'Break'   },
  offline: { dot: 'bg-slate-300',   text: 'text-slate-400',   label: 'Offline' },
}
function StatusDot({ status }) {
  const c = STATUS_CFG[status] || STATUS_CFG.offline
  return (
    <span className={clsx('inline-flex items-center gap-1 text-[10px] font-medium', c.text)}>
      <span className={clsx('w-1.5 h-1.5 rounded-full', c.dot)}/>{c.label}
    </span>
  )
}

/* ─── Visitor Timing Chart ───────────────────────────────────── */
function VisitorTimingChart() {
  const [vtRange, setVtRange] = useState('Day')
  const vtRanges = ['Day', 'Week', 'Month', 'Year']
  const blocks = vtRange === 'Day' ? TIME_BLOCKS_DAY : vtRange === 'Week' ? TIME_BLOCKS_WEEK : vtRange === 'Month' ? TIME_BLOCKS_MONTH : TIME_BLOCKS_YEAR
  const total = blocks.reduce((s, b) => s + b.value, 0)
  const peak  = blocks.reduce((a, b) => b.value > a.value ? b : a, blocks[0])
  const yMax  = Math.ceil(peak.value / 200) * 200

  return (
    <div className="bg-white border border-surface-border rounded-xl overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-surface-border">
        <div>
          <p className="text-[12px] font-semibold text-slate-700">When leads come in</p>
          <p className="text-[10px] text-slate-400 mt-0.5">Total leads by time of day Â· 2-hour blocks</p>
        </div>
        <div className="flex items-center gap-0.5 bg-slate-100 rounded-lg p-0.5">
          {vtRanges.map(r => (
            <button key={r} onClick={() => setVtRange(r)}
              className={clsx('px-2.5 py-1 rounded-md text-[11px] font-semibold transition-all',
                vtRange === r ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700')}>
              {r}
            </button>
          ))}
        </div>
      </div>
      <div className="px-4 pt-3 pb-1 flex items-center gap-2 flex-wrap">
        <span className="flex items-center gap-1.5 bg-slate-100 text-slate-600 text-[11px] font-semibold px-2.5 py-1 rounded-full">
          {total.toLocaleString()} leads
        </span>
        <span className="flex items-center gap-1.5 bg-white border border-blue-200 text-blue-600 text-[11px] font-semibold px-2.5 py-1 rounded-full">
          <Zap size={10} className="fill-blue-500"/>
          Peak {peak.label} Â· {peak.value.toLocaleString()}
        </span>
      </div>
      <div className="px-4 pb-4 pt-2">
        <div className="flex items-end gap-1.5" style={{ height: 160 }}>
          {blocks.map(b => {
            const isPeak = b.label === peak.label
            const h = Math.round((b.value / yMax) * 140)
            return (
              <div key={b.label} className="flex-1 flex flex-col items-center gap-1 group relative">
                {isPeak && (
                  <span className="absolute -top-6 left-1/2 -translate-x-1/2 bg-slate-900 text-white text-[9px] font-bold px-2 py-0.5 rounded-full whitespace-nowrap">
                    {b.value.toLocaleString()}
                  </span>
                )}
                <div className="w-full rounded-t-md transition-all"
                  style={{ height: h, background: isPeak ? '#2563EB' : '#BFDBFE' }}
                  title={`${b.label}: ${b.value.toLocaleString()}`}/>
              </div>
            )
          })}
        </div>
        <div className="flex gap-1.5 mt-1.5">
          {blocks.map(b => (
            <div key={b.label} className="flex-1 text-center text-[8px] text-slate-400 whitespace-nowrap overflow-hidden">{b.label}</div>
          ))}
        </div>
      </div>
    </div>
  )
}

/* ─── Lead Sources Chart ─────────────────────────────────────── */
function LeadSourcesChart() {
  const [lsView, setLsView] = useState('Daily')
  const ALL_DAYS = Array.from({ length: 31 }, (_, i) => i + 1)
  const maxVal = Math.max(...LEAD_SOURCE_DAILY.flatMap(r => r.days))

  const cellBg = (v) => {
    if (!v) return null
    const t = v / maxVal
    if (t < 0.15) return '#dbeafe'
    if (t < 0.35) return '#bfdbfe'
    if (t < 0.55) return '#93c5fd'
    if (t < 0.75) return '#60a5fa'
    return '#3b82f6'
  }
  const cellColor = (v) => (v / maxVal) >= 0.55 ? '#fff' : '#1e40af'

  const colTotals = ALL_DAYS.map((_, di) =>
    LEAD_SOURCE_DAILY.reduce((s, r) => s + (r.days[di] || 0), 0)
  )
  const grandTotal = LEAD_SOURCE_DAILY.reduce((s, r) => s + r.total, 0)

  const downloadRow = (src) => {
    const header = ['Source', ...ALL_DAYS.map(d => `Day ${d}`), 'Total']
    const row = [src.source, ...src.days, src.total]
    const csv = [header, row].map(r => r.join(',')).join('\n')
    const a = document.createElement('a')
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }))
    a.download = `leads-${src.source.toLowerCase().replace(/\s+/g, '-')}.csv`
    a.click()
  }

  return (
    <div className="bg-white border border-surface-border rounded-xl overflow-hidden">
      {/* header */}
      <div className="flex items-center justify-between px-5 py-3.5 border-b border-surface-border">
        <div>
          <p className="text-[13px] font-semibold text-slate-800">Leads by Source</p>
          <p className="text-[10px] text-slate-400 mt-0.5">Daily Â· August 2026</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center bg-slate-100 rounded-lg p-0.5">
            {['Daily','Weekly','Monthly'].map(v => (
              <button key={v} onClick={() => setLsView(v)}
                className={clsx('px-2.5 py-1 rounded-md text-[11px] font-semibold transition-all',
                  lsView === v ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-500 hover:text-slate-700')}>
                {v}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-1 border border-slate-200 rounded-lg px-2.5 py-1.5 text-[11px] font-medium text-slate-600 cursor-pointer select-none hover:bg-slate-50">
            Aug 2026 <ChevronDown size={11} className="text-slate-400 ml-0.5"/>
          </div>
        </div>
      </div>

      {/* grid table */}
      <div className="overflow-x-auto">
        <table className="text-[11px] border-collapse" style={{ width: 'max-content' }}>
          <thead>
            <tr className="border-b border-slate-100">
              <th className="sticky left-0 z-20 bg-white px-4 py-2.5 text-left text-[9px] font-bold text-slate-400 uppercase tracking-wider w-28 whitespace-nowrap">Source</th>
              {ALL_DAYS.map(d => (
                <th key={d} className="px-0 py-2.5 text-center text-[9px] font-medium text-slate-400 w-8" style={{ minWidth: 28 }}>{d}</th>
              ))}
              <th className="bg-amber-50 px-3 py-2.5 text-center text-[9px] font-bold text-amber-500 uppercase tracking-wider whitespace-nowrap border-l border-amber-100">TOTAL</th>
            </tr>
          </thead>
          <tbody>
            {LEAD_SOURCE_DAILY.map((src, ri) => (
              <tr key={src.source} className={clsx('group border-b border-slate-100', ri % 2 === 1 && 'bg-slate-50/40')}>
                <td className="sticky left-0 z-10 bg-inherit px-4 py-1.5 font-semibold text-slate-700 whitespace-nowrap">
                  <div className="flex items-center justify-between gap-3 pr-1">
                    <span>{src.source}</span>
                    <button
                      onClick={() => downloadRow(src)}
                      className="opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0 inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded border border-slate-200 bg-white text-[8px] font-semibold text-slate-400 hover:text-slate-600 hover:bg-slate-50">
                      <Download size={8}/> CSV
                    </button>
                  </div>
                </td>
                {src.days.map((v, di) => {
                  const bg = cellBg(v)
                  return (
                    <td key={di} className="px-0.5 py-1 text-center border-r border-slate-100/60" style={{ minWidth: 28 }}>
                      {bg ? (
                        <div className="flex items-center justify-center rounded text-[10px] font-semibold"
                          style={{ background: bg, color: cellColor(v), height: 22, margin: '0 1px' }}>
                          {v}
                        </div>
                      ) : null}
                    </td>
                  )
                })}
                <td className="bg-amber-50 px-3 py-1.5 text-center font-bold text-amber-500 border-l border-amber-100">{src.total}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t border-slate-200 bg-emerald-50/60">
              <td className="sticky left-0 z-20 bg-emerald-50 px-4 py-2 font-bold text-emerald-600 text-[10px] whitespace-nowrap">Total Leads</td>
              {colTotals.map((t, i) => (
                <td key={i} className="px-0 py-2 text-center text-[10px] font-semibold text-emerald-600 border-r border-emerald-100/60">{t || 0}</td>
              ))}
              <td className="bg-emerald-50 px-3 py-2 text-center font-bold text-emerald-600 border-l border-emerald-100">{grandTotal}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  )
}

/* ─── Option Wise Breakdown ──────────────────────────────────── */
function OptionWiseChart() {
  const sorted = [...OPTION_WISE].sort((a, b) => b.count - a.count)
  const maxCount = sorted[0].count
  return (
    <ChartCard
      title="Option Wise Breakdown"
      sub={`${OPTION_TOTAL} total selections Â· chatbot menu interactions`}
      right={
        <span className="text-[10px] font-semibold text-slate-400 bg-slate-100 px-2.5 py-1 rounded-lg">
          {OPTION_WISE.length} options
        </span>
      }
    >
      <div className="space-y-2.5">
        {sorted.map((opt, i) => {
          const pct = Math.round((opt.count / OPTION_TOTAL) * 100)
          const barW = Math.round((opt.count / maxCount) * 100)
          const isUp = opt.trend > 0
          return (
            <div key={opt.name} className="flex items-center gap-3 group">
              <span className="text-[10px] font-bold text-slate-300 w-3 flex-shrink-0 text-right">{i + 1}</span>
              <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: opt.color }}/>
              <span className="w-36 text-[11px] font-semibold text-slate-700 truncate flex-shrink-0">{opt.name}</span>
              <div className="flex-1 h-7 bg-slate-50 border border-slate-100 rounded-lg overflow-hidden relative">
                <div
                  className="absolute inset-y-0 left-0 rounded-lg flex items-center transition-all duration-500"
                  style={{ width: `${barW}%`, background: `linear-gradient(90deg, ${opt.color}28, ${opt.color})` }}
                >
                  {barW > 22 && (
                    <span className="text-[10px] font-bold text-white ml-auto pr-2.5">{opt.count}</span>
                  )}
                </div>
                {barW <= 22 && (
                  <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] font-bold text-slate-600">{opt.count}</span>
                )}
              </div>
              <span className="text-[13px] font-bold text-slate-700 w-9 text-right flex-shrink-0">{pct}%</span>
              <div className="w-14 flex-shrink-0 flex justify-end">
                {opt.trend !== 0 && (
                  <span className={clsx(
                    'inline-flex items-center gap-0.5 text-[9px] font-bold px-1.5 py-0.5 rounded-full',
                    isUp ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-500'
                  )}>
                    {isUp ? <ArrowUpRight size={8}/> : <ArrowDownRight size={8}/>}{Math.abs(opt.trend)}%
                  </span>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </ChartCard>
  )
}

/* ─── Flow Funnel Chart ──────────────────────────────────────── */
function FlowFunnelChart() {
  const maxVal = FLOW_FUNNEL[0].value
  return (
    <ChartCard title="Bot Flow Completion Funnel" sub="How users progress through the chatbot flow">
      <div className="space-y-1.5 py-1">
        {FLOW_FUNNEL.map((step, i) => {
          const barW = Math.round((step.value / maxVal) * 100)
          const pct  = ((step.value / maxVal) * 100).toFixed(1)
          const drop = i > 0
            ? (((FLOW_FUNNEL[i-1].value - step.value) / FLOW_FUNNEL[i-1].value) * 100).toFixed(1)
            : null
          return (
            <div key={step.stage}>
              <div className="flex items-center gap-3">
                <div className="w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold flex-shrink-0 text-white"
                  style={{ background: step.color }}>{i + 1}</div>
                <span className="w-40 text-[11px] font-semibold text-slate-700 flex-shrink-0 leading-tight">{step.stage}</span>
                <div className="flex-1 h-8 bg-slate-50 rounded-xl border border-slate-100 overflow-hidden relative">
                  <div
                    className="absolute inset-y-0 left-0 rounded-xl flex items-center justify-end pr-3"
                    style={{ width: `${barW}%`, background: `linear-gradient(90deg, ${step.color}35, ${step.color})` }}
                  >
                    {barW > 20 && (
                      <span className="text-[10px] font-bold text-white">{step.value.toLocaleString()}</span>
                    )}
                  </div>
                  {barW <= 20 && (
                    <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] font-bold text-slate-600">{step.value.toLocaleString()}</span>
                  )}
                </div>
                <span className="text-[12px] font-bold text-slate-700 w-11 text-right flex-shrink-0">{pct}%</span>
              </div>
              {drop !== null && (
                <div className="flex items-center gap-3 h-4 ml-8">
                  <div className="w-40 flex-shrink-0"/>
                  <div className="flex-1 flex items-center gap-1.5 pl-3">
                    <div className="w-px h-4 bg-slate-200"/>
                    <span className="text-[8px] text-red-400 font-semibold">â–¼ {drop}% drop-off</span>
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </ChartCard>
  )
}

/* ─── CSAT Trend Chart ───────────────────────────────────────── */
function CsatTrendChart({ range }) {
  const data = range === 'today' ? CSAT_1 : range === '7d' ? CSAT_7 : CSAT_30
  const avg  = (data.reduce((s, d) => s + d.score, 0) / data.length).toFixed(1)
  return (
    <ChartCard
      title="CSAT Score Trend"
      sub="Customer satisfaction over time"
      right={
        <div className="flex items-center gap-1.5 bg-amber-50 border border-amber-100 px-2.5 py-1 rounded-lg">
          <Star size={11} className="text-amber-400 fill-amber-400"/>
          <span className="text-[12px] font-bold text-amber-600">{avg}</span>
          <span className="text-[9px] text-amber-400">/ 5</span>
        </div>
      }
    >
      <ResponsiveContainer width="100%" height={150}>
        <AreaChart data={data} margin={{ top:4, right:4, left:-20, bottom:0 }}>
          <defs>
            <linearGradient id="gCsat" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#F59E0B" stopOpacity={0.2}/>
              <stop offset="100%" stopColor="#F59E0B" stopOpacity={0}/>
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="2 4" stroke="#f1f5f9" vertical={false}/>
          <XAxis dataKey="date" tick={{ fontSize:9, fill:'#94a3b8' }} tickLine={false} axisLine={false} interval={range==='30d'?5:0}/>
          <YAxis domain={[0,5]} ticks={[1,2,3,4,5]} tick={{ fontSize:9, fill:'#94a3b8' }} tickLine={false} axisLine={false}/>
          <Tooltip content={<ChartTip/>}/>
          <Area type="monotone" dataKey="score" name="CSAT Score" stroke="#F59E0B" strokeWidth={2} fill="url(#gCsat)" dot={false}/>
        </AreaChart>
      </ResponsiveContainer>
    </ChartCard>
  )
}

/* ─── Response Time Distribution ─────────────────────────────── */
function ResponseTimeChart() {
  const total = RT_DIST.reduce((s, r) => s + r.count, 0)
  const fast  = RT_DIST[0].count + RT_DIST[1].count
  return (
    <ChartCard title="Response Time Distribution" sub="Agent first reply â€” time to respond">
      <div className="space-y-3">
        {RT_DIST.map(r => (
          <div key={r.range} className="flex items-center gap-3">
            <span className="w-14 text-[10px] font-semibold text-slate-500 flex-shrink-0">{r.range}</span>
            <div className="flex-1 h-6 bg-slate-50 border border-slate-100 rounded-lg overflow-hidden relative">
              <div className="absolute inset-y-0 left-0 rounded-lg flex items-center justify-end pr-2 transition-all duration-500"
                style={{ width: `${r.pct}%`, background: `linear-gradient(90deg, ${r.color}30, ${r.color})` }}>
                {r.pct > 20 && <span className="text-[9px] font-bold text-white">{r.count}</span>}
              </div>
              {r.pct <= 20 && <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[9px] font-bold text-slate-600">{r.count}</span>}
            </div>
            <span className="text-[12px] font-bold w-9 text-right flex-shrink-0" style={{ color: r.color }}>{r.pct}%</span>
          </div>
        ))}
        <div className="pt-1.5 border-t border-slate-50 flex items-center gap-2 text-[10px] text-slate-400">
          <span className="w-2 h-2 rounded-full bg-emerald-400 flex-shrink-0"/>
          {Math.round((fast / total) * 100)}% of chats responded within 3 minutes
        </div>
      </div>
    </ChartCard>
  )
}

/* ─── Realtime Agent Section ─────────────────────────────────── */
function RealtimeAgentSection() {
  const [lastSync, setLastSync] = useState(new Date())
  const [syncing, setSyncing]   = useState(false)
  const [secAgo, setSecAgo]     = useState(0)

  useEffect(() => {
    const t = setInterval(() => setSecAgo(Math.floor((Date.now() - lastSync.getTime()) / 1000)), 1000)
    return () => clearInterval(t)
  }, [lastSync])

  const handleSync = () => {
    setSyncing(true)
    setTimeout(() => { setSyncing(false); setLastSync(new Date()); setSecAgo(0) }, 800)
  }

  const rtOnline = RT_AGENTS.filter(a => a.status === 'online').length
  const rtActive = RT_AGENTS.reduce((s, a) => s + a.active, 0)
  const rtQueue  = RT_AGENTS.reduce((s, a) => s + a.queue, 0)
  const rtBreak  = RT_AGENTS.filter(a => a.status === 'break').length

  return (
    <div>
      <div className="flex items-center gap-2 mb-2 flex-wrap">
        <SLabel>Realtime Agent Analytics</SLabel>
        <span className="flex items-center gap-1 text-[9px] font-bold text-emerald-600 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full -mt-2">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"/>LIVE
        </span>
        <div className="ml-auto flex items-center gap-2 -mt-2">
          <span className="text-[9px] text-slate-400">
            {secAgo === 0 ? 'Just synced' : `Synced ${secAgo}s ago`}
          </span>
          <button onClick={handleSync} disabled={syncing}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-slate-200 bg-white text-[10px] font-semibold text-slate-600 hover:bg-slate-50 transition-colors disabled:opacity-60">
            <RefreshCw size={10} className={syncing ? 'animate-spin' : ''}/>
            {syncing ? 'Syncingâ€¦' : 'Sync Now'}
          </button>
        </div>
      </div>

      {/* live KPI strip */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3 mb-3">
        {[
          { icon: Wifi,          label: 'Agents Online', value: rtOnline, color: '#22C55E' },
          { icon: MessageSquare, label: 'Active Chats',  value: rtActive, color: '#0066ff' },
          { icon: RefreshCw,     label: 'In Queue',      value: rtQueue,  color: rtQueue > 3 ? '#ef4444' : '#F59E0B', warn: rtQueue > 3 },
          { icon: Coffee,        label: 'On Break',      value: rtBreak,  color: '#8B5CF6' },
        ].map(k => {
          const KIcon = k.icon
          return (
            <div key={k.label} className={clsx('bg-white border rounded-xl px-4 py-3 flex items-center gap-3', k.warn ? 'border-red-200' : 'border-surface-border')}>
              <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: '#f5f5f5' }}>
                <KIcon size={13} style={{ color: '#374151' }}/>
              </div>
              <div>
                <p className="text-[18px] font-bold leading-none" style={{ color: k.color }}>{k.value}</p>
                <p className="text-[9px] font-medium text-slate-400 mt-0.5">{k.label}</p>
              </div>
            </div>
          )
        })}
      </div>

      {/* agent table */}
      <div className="bg-white border border-surface-border rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-[11px] min-w-[860px]">
            <thead>
              <tr className="bg-slate-50 border-b border-surface-border">
                {['Agent','Status','Active','Queue','Avg Reply','Avg Handle','Longest Chat','Resolved','Transferred','CSAT','SLA'].map(h => (
                  <th key={h} className="px-3 py-2.5 text-left text-[9px] font-bold text-slate-400 uppercase tracking-wider whitespace-nowrap first:pl-4">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-border">
              {RT_AGENTS.map(a => (
                <tr key={a.name} className="hover:bg-slate-50/60 transition-colors">
                  <td className="pl-4 pr-3 py-3">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-full flex items-center justify-center text-white text-[9px] font-bold flex-shrink-0 bg-slate-600">{a.avatar}</div>
                      <span className="font-semibold text-slate-700 whitespace-nowrap">{a.name}</span>
                    </div>
                  </td>
                  <td className="px-3 py-3"><StatusDot status={a.status}/></td>
                  <td className="px-3 py-3"><span className={clsx('font-bold text-[13px]', a.active > 4 ? 'text-red-500' : a.active > 0 ? 'text-slate-700' : 'text-slate-300')}>{a.active || 'â€”'}</span></td>
                  <td className="px-3 py-3"><span className={clsx('font-bold text-[13px]', a.queue > 2 ? 'text-amber-500' : a.queue > 0 ? 'text-slate-700' : 'text-slate-300')}>{a.queue || 'â€”'}</span></td>
                  <td className="px-3 py-3 text-slate-500">{a.avgReply}</td>
                  <td className="px-3 py-3 text-slate-500">{a.avgHandle}</td>
                  <td className="px-3 py-3"><span className={clsx(a.longest !== 'â€”' && parseInt(a.longest) > 25 ? 'text-red-400 font-semibold' : 'text-slate-500')}>{a.longest}</span></td>
                  <td className="px-3 py-3"><span className="font-bold text-emerald-600 text-[13px]">{a.resolved}</span></td>
                  <td className="px-3 py-3 text-slate-500">{a.transferred}</td>
                  <td className="px-3 py-3">
                    <span className="flex items-center gap-0.5 font-bold text-slate-700">
                      <Star size={9} className="text-amber-400 fill-amber-400"/>{a.csat}
                    </span>
                  </td>
                  <td className="px-3 py-3">
                    {a.sla > 0
                      ? <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-red-50 text-red-500 text-[9px] font-bold border border-red-100"><AlertTriangle size={8}/>{a.sla}</span>
                      : <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-emerald-50 text-emerald-600 text-[9px] font-bold">âœ“ OK</span>}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="bg-slate-50 border-t border-surface-border">
                <td className="pl-4 pr-3 py-2.5 text-[9px] font-bold text-slate-500 uppercase tracking-wide">Team Total</td>
                <td/>
                <td className="px-3 py-2.5 font-bold text-slate-700">{RT_AGENTS.reduce((s,a)=>s+a.active,0)}</td>
                <td className="px-3 py-2.5 font-bold text-slate-700">{RT_AGENTS.reduce((s,a)=>s+a.queue,0)}</td>
                <td colSpan={3}/>
                <td className="px-3 py-2.5 font-bold text-emerald-600">{RT_AGENTS.reduce((s,a)=>s+a.resolved,0)}</td>
                <td className="px-3 py-2.5 font-bold text-slate-700">{RT_AGENTS.reduce((s,a)=>s+a.transferred,0)}</td>
                <td className="px-3 py-2.5 text-[10px] text-slate-500">â˜… {(RT_AGENTS.filter(a=>a.csat>0).reduce((s,a)=>s+a.csat,0)/RT_AGENTS.filter(a=>a.csat>0).length).toFixed(1)} avg</td>
                <td className="px-3 py-2.5 text-[10px] font-bold text-red-500">{RT_AGENTS.reduce((s,a)=>s+a.sla,0)} total</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  )
}

/*/* --- Metric Detail Drawer --- */
function MetricDetailDrawer({ metric, onClose }) {
  if (!metric) return null

  const chartData = (metric.fullData || []).map(d => ({
    date: d.date,
    value: metric.dataKey ? (d[metric.dataKey] ?? 0) : 0,
  }))

  const vals   = chartData.map(d => d.value).filter(v => v > 0)
  const avg    = vals.length ? Math.round(vals.reduce((s,v) => s+v, 0) / vals.length) : 0
  const peak   = vals.length ? Math.max(...vals) : 0
  const low    = vals.length ? Math.min(...vals) : 0
  const latest = chartData[chartData.length - 1]?.value ?? 0
  const prev   = chartData[chartData.length - 2]?.value ?? 0
  const dayChg = prev ? (((latest - prev) / prev) * 100).toFixed(1) : null
  const up     = metric.trend > 0

  return (
    <div className="fixed inset-0 z-50 flex" onClick={onClose}>
      <div className="flex-1 bg-black/25"/>
      <div
        className="w-[400px] bg-white flex flex-col shadow-2xl border-l border-surface-border"
        onClick={e => e.stopPropagation()}
      >
        {/* header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-surface-border flex-shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: '#f5f5f5' }}>
              <metric.icon size={15} className="text-slate-600"/>
            </div>
            <div>
              <p className="text-[13px] font-bold text-slate-800">{metric.label}</p>
              {metric.sub && <p className="text-[10px] text-slate-400 mt-0.5">{metric.sub}</p>}
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 transition-colors">
            <X size={15}/>
          </button>
        </div>

        {/* KPI hero */}
        <div className="px-5 py-5 border-b border-surface-border flex-shrink-0">
          <div className="flex items-end gap-3 mb-4">
            <span className="text-[36px] font-bold text-slate-900 leading-none">{metric.value}</span>
            {metric.trend != null && (
              <span className={clsx(
                'flex items-center gap-0.5 text-[11px] font-bold px-2 py-0.5 rounded-full mb-1',
                up ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-500'
              )}>
                {up ? <ArrowUpRight size={10}/> : <ArrowDownRight size={10}/>}{Math.abs(metric.trend)}% vs prior period
              </span>
            )}
          </div>
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: 'Peak Day',  value: peak.toLocaleString() },
              { label: 'Daily Avg', value: avg.toLocaleString()  },
              { label: 'Low Day',   value: low.toLocaleString()  },
            ].map(s => (
              <div key={s.label} className="bg-slate-50 rounded-xl p-3">
                <p className="text-[16px] font-bold text-slate-800">{s.value}</p>
                <p className="text-[9px] text-slate-400 mt-0.5">{s.label}</p>
              </div>
            ))}
          </div>
        </div>

        {/* trend chart */}
        {metric.dataKey && chartData.length > 0 && (
          <div className="px-5 py-4 border-b border-surface-border flex-shrink-0">
            <div className="flex items-center justify-between mb-3">
              <p className="text-[11px] font-semibold text-slate-500">30-day trend</p>
              {dayChg !== null && (
                <span className={clsx(
                  'text-[9px] font-bold px-1.5 py-0.5 rounded-full',
                  Number(dayChg) >= 0 ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-500'
                )}>
                  {Number(dayChg) >= 0 ? '+' : ''}{dayChg}% today vs yesterday
                </span>
              )}
            </div>
            <ResponsiveContainer width="100%" height={160}>
              <AreaChart data={chartData} margin={{ top:4, right:4, left:-28, bottom:0 }}>
                <defs>
                  <linearGradient id="mdGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={metric.color || '#0066ff'} stopOpacity={0.18}/>
                    <stop offset="100%" stopColor={metric.color || '#0066ff'} stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="2 4" stroke="#f1f5f9" vertical={false}/>
                <XAxis dataKey="date" tick={{ fontSize:8, fill:'#94a3b8' }} tickLine={false} axisLine={false} interval={5}/>
                <YAxis tick={{ fontSize:8, fill:'#94a3b8' }} tickLine={false} axisLine={false}/>
                <Tooltip content={({ active, payload, label }) => active && payload?.length ? (
                  <div className="bg-white border border-surface-border rounded-lg px-2.5 py-1.5 text-[10px] shadow-md">
                    <p className="font-semibold text-slate-500 mb-1">{label}</p>
                    <p className="font-bold text-slate-800">{payload[0].value?.toLocaleString()}</p>
                  </div>
                ) : null}/>
                <Area type="monotone" dataKey="value" name={metric.label}
                  stroke={metric.color || '#0066ff'} strokeWidth={2} fill="url(#mdGrad)" dot={false}/>
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* related metrics */}
        {metric.related?.length > 0 && (
          <div className="px-5 py-4 flex-1 overflow-y-auto">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-3">Related Metrics</p>
            <div className="space-y-2">
              {metric.related.map(r => (
                <div key={r.label} className="flex items-center justify-between py-2.5 border-b border-slate-50 last:border-0">
                  <span className="text-[11px] text-slate-500">{r.label}</span>
                  <span className="text-[13px] font-bold text-slate-700">{r.value}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
/*════════════════════════════════════════════════════════════════
   CHAT TAB
════════════════════════════════════════════════════════════════ */
function ChatTab({ range }) {
  const [expandedMetric, setExpandedMetric] = useState(null)
  const [openSections, setOpenSections] = useState({ volume: false, agents: false, engagement: false })
  const toggle = (key) => setOpenSections(s => ({ ...s, [key]: !s[key] }))
  const data = range === 'today' ? CHAT_1 : range === '7d' ? CHAT_7 : CHAT_30
  const sum  = (k) => data.reduce((a, d) => a + d[k], 0)

  const botHandled  = sum('botHandled')
  const handoff     = sum('handoff')
  const totalChats  = botHandled + handoff
  const resolved    = sum('resolved')
  const closed      = sum('closed')
  const activeNow   = data[data.length - 1]?.active ?? 0
  const flowDone    = sum('flowCompleted')
  const dropOff     = sum('dropOff')
  const fallback    = sum('fallback')
  const uniqueUsers = sum('uniqueUsers')
  const slaBreached = sum('slaBreached')
  const apptBooked  = sum('apptBooked')
  const totalMsgs   = sum('messages')
  const ctwa        = sum('ctwa')
  const gCtwa       = sum('gCtwa')
  const attended    = sum('attended')
  const unattended  = sum('unattended')

  const ex = (cfg) => () => setExpandedMetric({ ...cfg, fullData: CHAT_30 })

  const heatMax = Math.max(...HEATMAP.flatMap(r => r.hours.map(h => h.value)))
  const heatClr = (v) => {
    const t = v / heatMax
    if (t < 0.15) return '#f8fafc'
    if (t < 0.35) return '#bfdbfe'
    if (t < 0.6)  return '#60a5fa'
    if (t < 0.8)  return '#2563eb'
    return '#0066ff'
  }

  return (
    <div className="space-y-5">

      {/* ── Volume ── */}
      <div>
        <SLabel open={openSections.volume} onToggle={() => toggle('volume')}>Chat Volume</SLabel>
        {openSections.volume && <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
          <MetricCard icon={MessageSquare} label="Total Chats"    value={totalChats.toLocaleString()}  sub="Bot + Handoff"  trend={8}  color="#0066ff"
            onExpand={ex({ icon: MessageSquare, label: "Total Chats", value: totalChats.toLocaleString(), sub: "Bot + Handoff", trend: 8, color: "#0066ff", dataKey: "totalChats",
              related: [{ label: "Bot Handled", value: botHandled.toLocaleString() }, { label: "Handoff to Agents", value: handoff.toLocaleString() }, { label: "Unique Users", value: uniqueUsers.toLocaleString() }] })}/>
          <MetricCard icon={MessageSquare} label="Total Messages" value={totalMsgs.toLocaleString()}   trend={11}  color="#8B5CF6"
            onExpand={ex({ icon: MessageSquare, label: "Total Messages", value: totalMsgs.toLocaleString(), trend: 11, color: "#8B5CF6", dataKey: "messages",
              related: [{ label: "Total Chats", value: totalChats.toLocaleString() }, { label: "Avg per Chat", value: Math.round(totalMsgs / Math.max(totalChats, 1)) + " msgs" }] })}/>
          <MetricCard icon={Users}         label="Unique Users"   value={uniqueUsers.toLocaleString()} trend={6}   color="#14B8A6"
            onExpand={ex({ icon: Users, label: "Unique Users", value: uniqueUsers.toLocaleString(), trend: 6, color: "#14B8A6", dataKey: "uniqueUsers",
              related: [{ label: "Total Chats", value: totalChats.toLocaleString() }, { label: "Bot Handled", value: botHandled.toLocaleString() }, { label: "Handoff to Agents", value: handoff.toLocaleString() }] })}/>
          <MetricCard icon={Bot}           label="Bot Handled"    value={botHandled.toLocaleString()}  sub="Auto-resolved"  trend={3}  color="#0066ff"
            onExpand={ex({ icon: Bot, label: "Bot Handled", value: botHandled.toLocaleString(), sub: "Auto-resolved", trend: 3, color: "#0066ff", dataKey: "botHandled",
              related: [{ label: "Total Chats", value: totalChats.toLocaleString() }, { label: "Handoff to Agents", value: handoff.toLocaleString() }, { label: "Bot Rate", value: Math.round((botHandled / Math.max(totalChats, 1)) * 100) + "%" }] })}/>
          <MetricCard icon={Megaphone}     label="CTWA Chats"     value={ctwa.toLocaleString()}        sub="WhatsApp Ads"   trend={14} color="#0066ff"
            onExpand={ex({ icon: Megaphone, label: "CTWA Chats", value: ctwa.toLocaleString(), sub: "WhatsApp Ads", trend: 14, color: "#0066ff", dataKey: "ctwa",
              related: [{ label: "G-CTWA Chats", value: gCtwa.toLocaleString() }, { label: "Total Chats", value: totalChats.toLocaleString() }] })}/>
          <MetricCard icon={Search}        label="G-CTWA Chats"   value={gCtwa.toLocaleString()}       sub="Google Ads"     trend={9}  color="#0066ff"
            onExpand={ex({ icon: Search, label: "G-CTWA Chats", value: gCtwa.toLocaleString(), sub: "Google Ads", trend: 9, color: "#0066ff", dataKey: "gCtwa",
              related: [{ label: "CTWA Chats", value: ctwa.toLocaleString() }, { label: "Total Chats", value: totalChats.toLocaleString() }] })}/>
        </div>}
      </div>

      {/* ── Live Agents ── */}
      <div>
        <SLabel open={openSections.agents} onToggle={() => toggle('agents')}>Live Agents</SLabel>
        {openSections.agents && <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
          <MetricCard icon={PhoneForwarded} label="Handoff to Agents" value={handoff.toLocaleString()} sub="Resolved + Closed + Active" trend={-2} color="#F59E0B"
            onExpand={ex({ icon: PhoneForwarded, label: "Handoff to Agents", value: handoff.toLocaleString(), sub: "Resolved + Closed + Active", trend: -2, color: "#F59E0B", dataKey: "handoff",
              related: [{ label: "Resolved", value: resolved.toLocaleString() }, { label: "Closed", value: closed.toLocaleString() }, { label: "Active Now", value: String(activeNow) }] })}/>
          <MetricCard icon={CheckCircle2} label="Resolved by Agents" value={resolved.toLocaleString()} trend={5} color="#22C55E"
            onExpand={ex({ icon: CheckCircle2, label: "Resolved by Agents", value: resolved.toLocaleString(), trend: 5, color: "#22C55E", dataKey: "resolved",
              related: [{ label: "Handoff to Agents", value: handoff.toLocaleString() }, { label: "Resolution Rate", value: Math.round((resolved / Math.max(handoff, 1)) * 100) + "%" }] })}/>
          <MetricCard icon={XCircle} label="Closed by Agents" value={closed.toLocaleString()} trend={1} color="#64748b"
            onExpand={ex({ icon: XCircle, label: "Closed by Agents", value: closed.toLocaleString(), trend: 1, color: "#64748b", dataKey: "closed",
              related: [{ label: "Resolved by Agents", value: resolved.toLocaleString() }, { label: "Handoff to Agents", value: handoff.toLocaleString() }] })}/>
          <MetricCard icon={Activity} label="Active Chats Right Now" value={activeNow} sub="ongoing" color="#EC4899"
            onExpand={ex({ icon: Activity, label: "Active Chats Right Now", value: String(activeNow), sub: "ongoing", color: "#EC4899", dataKey: "active",
              related: [{ label: "Handoff to Agents", value: handoff.toLocaleString() }, { label: "In Queue", value: "5" }] })}/>
          <MetricCard icon={CheckCircle2} label="Attended Chats" value={attended.toLocaleString()} sub="Handoff to Agent" trend={7} color="#22C55E"
            onExpand={ex({ icon: CheckCircle2, label: "Attended Chats", value: attended.toLocaleString(), sub: "Handoff to Agent", trend: 7, color: "#22C55E", dataKey: "attended",
              related: [{ label: "Unattended Chats", value: unattended.toLocaleString() }, { label: "Attend Rate", value: Math.round((attended / Math.max(attended + unattended, 1)) * 100) + "%" }] })}/>
          <MetricCard icon={AlertCircle} label="Unattended Chats" value={unattended.toLocaleString()} sub="Handoff to Agent" trend={-3} color="#64748b"
            onExpand={ex({ icon: AlertCircle, label: "Unattended Chats", value: unattended.toLocaleString(), sub: "Handoff to Agent", trend: -3, color: "#64748b", dataKey: "unattended",
              related: [{ label: "Attended Chats", value: attended.toLocaleString() }, { label: "Handoff to Agents", value: handoff.toLocaleString() }] })}/>
        </div>}
      </div>

      {/* ── Engagement ── */}
      <div>
        <SLabel open={openSections.engagement} onToggle={() => toggle('engagement')}>Engagement & Quality</SLabel>
        {openSections.engagement && <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
          <MetricCard icon={GitBranch} label="Flow Completion" value={flowDone.toLocaleString()} trend={9} color="#8B5CF6"
            onExpand={ex({ icon: GitBranch, label: "Flow Completion", value: flowDone.toLocaleString(), trend: 9, color: "#8B5CF6", dataKey: "flowCompleted",
              related: [{ label: "Drop-Off Users", value: dropOff.toLocaleString() }, { label: "Completion Rate", value: Math.round((flowDone / Math.max(totalChats, 1)) * 100) + "%" }] })}/>
          <MetricCard icon={TrendingDown} label="Drop-Off Users" value={dropOff.toLocaleString()} trend={-4} color="#F87171"
            onExpand={ex({ icon: TrendingDown, label: "Drop-Off Users", value: dropOff.toLocaleString(), trend: -4, color: "#F87171", dataKey: "dropOff",
              related: [{ label: "Flow Completion", value: flowDone.toLocaleString() }, { label: "Fallback Triggers", value: fallback.toLocaleString() }, { label: "Drop Rate", value: Math.round((dropOff / Math.max(totalChats, 1)) * 100) + "%" }] })}/>
          <MetricCard icon={AlertCircle} label="Fallback Triggers" value={fallback.toLocaleString()} trend={-7} color="#F59E0B"
            onExpand={ex({ icon: AlertCircle, label: "Fallback Triggers", value: fallback.toLocaleString(), trend: -7, color: "#F59E0B", dataKey: "fallback",
              related: [{ label: "Drop-Off Users", value: dropOff.toLocaleString() }, { label: "Total Chats", value: totalChats.toLocaleString() }, { label: "Fallback Rate", value: Math.round((fallback / Math.max(totalChats, 1)) * 100) + "%" }] })}/>
          <MetricCard icon={ShieldAlert} label="SLA Breached" value={slaBreached.toLocaleString()} trend={2} color="#64748b"
            onExpand={ex({ icon: ShieldAlert, label: "SLA Breached", value: slaBreached.toLocaleString(), trend: 2, color: "#ef4444", dataKey: "slaBreached",
              related: [{ label: "Total Handoffs", value: handoff.toLocaleString() }, { label: "SLA Breach Rate", value: Math.round((slaBreached / Math.max(handoff, 1)) * 100) + "%" }] })}/>
          <MetricCard icon={Timer}        label="Avg Resolution Time"   value="14m 38s"                      trend={-5} color="#0066ff"/>
          <MetricCard icon={Clock}        label="Avg First Response"    value="1m 52s"                       trend={-8} color="#22C55E"/>
          <MetricCard icon={CalendarCheck} label="Appointments Booked" value={apptBooked.toLocaleString()}  trend={15} color="#14B8A6" sub="via chatbot"
            onExpand={ex({ icon: CalendarCheck, label: "Appointments Booked", value: apptBooked.toLocaleString(), sub: "via chatbot", trend: 15, color: "#14B8A6", dataKey: "apptBooked",
              related: [{ label: "Flow Completions", value: flowDone.toLocaleString() }, { label: "Booking Rate", value: Math.round((apptBooked / Math.max(flowDone, 1)) * 100) + "%" }, { label: "Total Chats", value: totalChats.toLocaleString() }] })}/>
          <MetricCard icon={ThumbsUp}   label="CSAT Score"      value="4.6 / 5" sub="avg" color="#F59E0B"/>
          <MetricCard icon={TrendingUp} label="Escalation Rate" value="6.2%"    trend={-1} color="#64748b"/>
        </div>}
      </div>

      {/* ── Daily Chats Chart ── */}
      <ChartCard title="Daily Chats" sub="Volume breakdown over time"
        right={
          <div className="flex items-center gap-3">
            {[{color:'#374151',label:'Total'},{color:'#6b7280',label:'Bot'},{color:'#9ca3af',label:'Handoff'}].map(l => (
              <span key={l.label} className="flex items-center gap-1 text-[9px] text-slate-400">
                <span className="w-2 h-2 rounded-sm" style={{ background: l.color }}/>{l.label}
              </span>
            ))}
          </div>
        }>
        <ResponsiveContainer width="100%" height={200}>
          <AreaChart data={data} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
            <defs>
              {[{id:'dT',c:'#374151'},{id:'dB',c:'#6b7280'},{id:'dH',c:'#9ca3af'}].map(g => (
                <linearGradient key={g.id} id={g.id} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%"   stopColor={g.c} stopOpacity={0.15}/>
                  <stop offset="100%" stopColor={g.c} stopOpacity={0}/>
                </linearGradient>
              ))}
            </defs>
            <CartesianGrid strokeDasharray="2 4" stroke="#f1f5f9" vertical={false}/>
            <XAxis dataKey="date" tick={{ fontSize:9, fill:'#94a3b8' }} tickLine={false} axisLine={false}
              interval={range==='30d'?5:0}/>
            <YAxis tick={{ fontSize:9, fill:'#94a3b8' }} tickLine={false} axisLine={false}/>
            <Tooltip content={<ChartTip/>}/>
            <Area type="monotone" dataKey="totalChats" name="Total Chats"       stroke="#374151" strokeWidth={2}   fill="url(#dT)" dot={false}/>
            <Area type="monotone" dataKey="botHandled" name="Bot Handled"       stroke="#6b7280" strokeWidth={1.5} fill="url(#dB)" dot={false}/>
            <Area type="monotone" dataKey="handoff"    name="Handoff to Agents" stroke="#9ca3af" strokeWidth={1.5} fill="url(#dH)" dot={false}/>
          </AreaChart>
        </ResponsiveContainer>
      </ChartCard>

      {/* ── Appointment Bookings ── */}
      <ChartCard title="Appointment Bookings" sub="Daily appointments booked via chatbot"
        right={
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1 text-[9px] text-slate-400">
              <span className="w-2 h-2 rounded-sm" style={{ background: '#14B8A6' }}/>Booked
            </span>
            <span className="flex items-center gap-1 text-[9px] font-semibold text-teal-600">
              {apptBooked.toLocaleString()} total
            </span>
          </div>
        }>
        <ResponsiveContainer width="100%" height={200}>
          <AreaChart data={data} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
            <defs>
              <linearGradient id="apptGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%"   stopColor="#14B8A6" stopOpacity={0.25}/>
                <stop offset="100%" stopColor="#14B8A6" stopOpacity={0}/>
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="2 4" stroke="#f1f5f9" vertical={false}/>
            <XAxis dataKey="date" tick={{ fontSize:9, fill:'#94a3b8' }} tickLine={false} axisLine={false}
              interval={range==='30d'?5:0}/>
            <YAxis tick={{ fontSize:9, fill:'#94a3b8' }} tickLine={false} axisLine={false}/>
            <Tooltip content={({ active, payload, label }) => active && payload?.length ? (
              <div className="bg-white border border-surface-border rounded-lg px-2.5 py-1.5 text-[10px] shadow-md">
                <p className="font-semibold text-slate-500 mb-1">{label}</p>
                <p className="font-bold text-teal-600">{payload[0].value} appointments</p>
              </div>
            ) : null}/>
            <Area type="monotone" dataKey="apptBooked" name="Appointments Booked"
              stroke="#14B8A6" strokeWidth={2} fill="url(#apptGrad)" dot={false}
              activeDot={{ r: 4, fill: '#14B8A6', stroke: '#fff', strokeWidth: 2 }}/>
          </AreaChart>
        </ResponsiveContainer>
      </ChartCard>

      {/* -- Option Wise Breakdown -- */}
      <OptionWiseChart/>

      {/* -- Flow Funnel + CSAT + Response Time -- */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <FlowFunnelChart/>
        <div className="space-y-4">
          <CsatTrendChart range={range}/>
          <ResponseTimeChart/>
        </div>
      </div>

      {/* ── When Leads Come In ── */}
      <VisitorTimingChart/>

      {/* ── Lead Sources ── */}
      <LeadSourcesChart/>


      {/* ── Realtime Agent Analytics ── */}
      <RealtimeAgentSection/>

      {/* Metric detail drawer */}
      <MetricDetailDrawer metric={expandedMetric} onClose={() => setExpandedMetric(null)}/>

    </div>
  )
}

/* ════════════════════════════════════════════════════════════════
   APPOINTMENTS TAB
════════════════════════════════════════════════════════════════ */
function AppointmentsTab({ range }) {
  const data = range === 'today' ? APPT_1 : range === '7d' ? APPT_7 : APPT_30
  const sum  = (k) => data.reduce((a,d) => a + d[k], 0)
  const booked = sum('booked'), completed = sum('completed'), cancelled = sum('cancelled'), noShow = sum('noShow'), rescheduled = sum('rescheduled')
  const rate = Math.round((completed / booked) * 100)

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
        <MetricCard icon={CalendarCheck}  label="Total Booked"    value={booked.toLocaleString()}       trend={6}  color="#0066ff"/>
        <MetricCard icon={CheckCircle2}   label="Completed"       value={completed.toLocaleString()}     trend={9}  color="#22C55E"/>
        <MetricCard icon={CalendarX}      label="Cancelled"       value={cancelled.toLocaleString()}     trend={-3} color="#F87171"/>
        <MetricCard icon={CalendarClock}  label="Rescheduled"     value={rescheduled.toLocaleString()}   trend={4}  color="#8B5CF6"/>
        <MetricCard icon={Timer}          label="Completion Rate"  value={`${rate}%`}                    trend={2}  color="#0066ff"/>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="md:col-span-2">
          <ChartCard title="Appointment Trends" sub="Booked vs completed over time">
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart data={data} margin={{ top:4, right:4, left:-20, bottom:0 }}>
                <defs>
                  <linearGradient id="aBk" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#374151" stopOpacity={0.15}/><stop offset="100%" stopColor="#374151" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="aCp" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#6b7280" stopOpacity={0.15}/><stop offset="100%" stopColor="#6b7280" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="2 4" stroke="#f1f5f9" vertical={false}/>
                <XAxis dataKey="date" tick={{ fontSize:9, fill:'#94a3b8' }} tickLine={false} axisLine={false} interval={range==='30d'?5:0}/>
                <YAxis tick={{ fontSize:9, fill:'#94a3b8' }} tickLine={false} axisLine={false}/>
                <Tooltip content={<ChartTip/>}/>
                <Area type="monotone" dataKey="booked"    name="Booked"    stroke="#374151" strokeWidth={2}   fill="url(#aBk)" dot={false}/>
                <Area type="monotone" dataKey="completed" name="Completed" stroke="#6b7280" strokeWidth={1.5} fill="url(#aCp)" dot={false}/>
              </AreaChart>
            </ResponsiveContainer>
            <Legend items={[{color:'#374151',label:'Booked'},{color:'#6b7280',label:'Completed'}]}/>
          </ChartCard>
        </div>

        <ChartCard title="Status Breakdown">
          <div className="flex flex-col items-center">
            <div className="relative">
              <ResponsiveContainer width={120} height={120}>
                <PieChart>
                  <Pie data={APPT_STATUS} cx="50%" cy="50%" innerRadius={36} outerRadius={56} dataKey="value" strokeWidth={2} stroke="#fff">
                    {APPT_STATUS.map((e,i) => <Cell key={i} fill={e.color}/>)}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <p className="text-[18px] font-bold text-slate-800">{rate}%</p>
                <p className="text-[8px] text-slate-400">done</p>
              </div>
            </div>
            <div className="w-full space-y-2 mt-3">
              {APPT_STATUS.map(s => (
                <div key={s.name} className="flex items-center justify-between">
                  <span className="flex items-center gap-1.5 text-[10px] text-slate-500">
                    <span className="w-2 h-2 rounded-sm" style={{ background: s.color }}/>{s.name}
                  </span>
                  <span className="text-[12px] font-bold text-slate-700">{s.value}%</span>
                </div>
              ))}
            </div>
          </div>
        </ChartCard>
      </div>

      <ChartCard title="Cancellations, Rescheduled & No-Shows" sub="Last 7 days">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
          <div className="bg-red-50 border border-red-100 rounded-xl p-3 flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: '#f5f5f5' }}>
              <CalendarX size={14} style={{ color: '#374151' }}/>
            </div>
            <div>
              <p className="text-[20px] font-bold text-red-500">{cancelled}</p>
              <p className="text-[9px] text-red-400 font-semibold">Cancelled</p>
            </div>
          </div>
          <div className="bg-violet-50 border border-violet-100 rounded-xl p-3 flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: '#f5f5f5' }}>
              <CalendarClock size={14} style={{ color: '#374151' }}/>
            </div>
            <div>
              <p className="text-[20px] font-bold text-violet-500">{rescheduled}</p>
              <p className="text-[9px] text-violet-500 font-semibold">Rescheduled</p>
            </div>
          </div>
          <div className="bg-amber-50 border border-amber-100 rounded-xl p-3 flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: '#f5f5f5' }}>
              <AlertCircle size={14} style={{ color: '#374151' }}/>
            </div>
            <div>
              <p className="text-[20px] font-bold text-amber-500">{noShow}</p>
              <p className="text-[9px] text-amber-500 font-semibold">No-Shows</p>
            </div>
          </div>
        </div>
        <ResponsiveContainer width="100%" height={110}>
          <BarChart data={data.slice(-7)} margin={{ top:4, right:4, left:-20, bottom:0 }} barSize={14}>
            <CartesianGrid strokeDasharray="2 4" stroke="#f1f5f9" vertical={false}/>
            <XAxis dataKey="date" tick={{ fontSize:8, fill:'#94a3b8' }} tickLine={false} axisLine={false}/>
            <YAxis tick={{ fontSize:8, fill:'#94a3b8' }} tickLine={false} axisLine={false}/>
            <Tooltip content={<ChartTip/>}/>
            <Bar dataKey="cancelled"   name="Cancelled"   fill="#F87171" radius={[3,3,0,0]} stackId="a"/>
            <Bar dataKey="rescheduled" name="Rescheduled" fill="#8B5CF6" radius={[0,0,0,0]} stackId="a"/>
            <Bar dataKey="noShow"      name="No Show"     fill="#F59E0B" radius={[3,3,0,0]} stackId="a"/>
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>
    </div>
  )
}

/* ════════════════════════════════════════════════════════════════
   BROADCASTS TAB
════════════════════════════════════════════════════════════════ */
function ProBadge() {
  return <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[8px] font-bold bg-blue-600 text-white leading-none">Pro</span>
}

/* ── Retarget helpers (Campaign Performance) ─────────────────────────────── */
const ANA_RETARGET_SEGS = [
  { key: 'replied',   label: 'Replied',   icon: CornerUpLeft,      color: '#8b5cf6', bg: '#f5f3ff', border: '#ede9fe', field: 'replied'   },
  { key: 'clicked',   label: 'Clicked',   icon: MousePointerClick,  color: '#3b82f6', bg: '#eff6ff', border: '#dbeafe', field: 'clicked'   },
  { key: 'read',      label: 'Read',      icon: MailOpen,           color: '#14b8a6', bg: '#f0fdfa', border: '#ccfbf1', field: 'read'      },
  { key: 'delivered', label: 'Delivered', icon: CheckCheck,         color: '#10b981', bg: '#f0fdf4', border: '#bbf7d0', field: 'delivered' },
  { key: 'failed',    label: 'Failed',    icon: AlertCircle,        color: '#ef4444', bg: '#fef2f2', border: '#fecaca', field: 'failed'    },
]

const ANA_MOCK_TEMPLATES = [
  { id: 't1', name: 'Follow Up Offer',    body: 'Hi {{1}}, we noticed your recent activity. Here\'s a special offer just for you — use code {{2}} at checkout!' },
  { id: 't2', name: 'Re-engagement',      body: 'Hey {{1}}! We\'d love to hear from you. Reply with {{2}} to connect with our team anytime.' },
  { id: 't3', name: 'Exclusive Discount', body: 'Hi {{1}}, you\'re getting {{2}}% off your next purchase. Valid until {{3}}. Don\'t miss out!' },
  { id: 't4', name: 'Feedback Request',   body: 'Hi {{1}}, we value your opinion about {{2}}. Could you spare 1 minute to share your thoughts?' },
]

function extractAnaParams(tpl) {
  if (!tpl) return []
  const matches = (tpl.body || '').match(/\{\{(\d+)\}\}/g) || []
  return [...new Set(matches.map(m => m.replace(/\{\{|\}\}/g, '')))]
    .sort((a, b) => Number(a) - Number(b))
}

const ANA_PREVIEW_CONTACTS = [
  { firstName: 'Amit',  lastName: 'Sharma', phone: '+91 98100 00001', city: 'Mumbai',    email: 'amit@ex.com',  custom1: 'VIP'     },
  { firstName: 'Priya', lastName: 'Nair',   phone: '+91 98110 00002', city: 'Bangalore', email: 'priya@ex.com', custom1: 'Regular' },
  { firstName: 'Rahul', lastName: 'Kumar',  phone: '+91 98120 00003', city: 'Delhi',     email: 'rahul@ex.com', custom1: 'Premium' },
  { firstName: 'Sneha', lastName: 'Patel',  phone: '+91 98130 00004', city: 'Ahmedabad', email: 'sneha@ex.com', custom1: 'VIP'     },
  { firstName: 'Arun',  lastName: 'Mehta',  phone: '+91 98140 00005', city: 'Pune',      email: 'arun@ex.com',  custom1: 'Regular' },
]

const ANA_CONTACT_FIELDS = [
  { key: 'firstName', label: 'First Name' },
  { key: 'lastName',  label: 'Last Name'  },
  { key: 'phone',     label: 'Phone'      },
  { key: 'city',      label: 'City'       },
  { key: 'email',     label: 'Email'      },
  { key: 'custom1',   label: 'Custom Field 1' },
]

function AnalyticsRetargetModal({ campaign, onClose, initialSegment = null }) {
  const [step,         setStep]         = useState(initialSegment ? 'campaign' : 'segment')
  const [segKey,       setSegKey]       = useState(initialSegment)
  const [campaignName, setCampaignName] = useState('')
  const [query,        setQuery]        = useState('')
  const [selTpl,       setSelTpl]       = useState(null)
  const [paramMode,    setParamMode]    = useState('global')
  const [globalParams, setGlobalParams] = useState({})
  const [fieldMap,     setFieldMap]     = useState({})
  const [csvRows,      setCsvRows]      = useState(null)
  const [csvError,     setCsvError]     = useState('')
  const [scheduleMode, setScheduleMode] = useState('now')
  const [scheduleDate, setScheduleDate] = useState('')
  const [scheduleTime, setScheduleTime] = useState('')
  const [sending,      setSending]      = useState(false)
  const [done,         setDone]         = useState(false)

  const seg       = ANA_RETARGET_SEGS.find(s => s.key === segKey)
  const count     = seg ? (campaign[seg.field] ?? 0) : 0
  const tpls      = ANA_MOCK_TEMPLATES.filter(t => !query || t.name.toLowerCase().includes(query.toLowerCase()))
  const paramNums = selTpl ? extractAnaParams(selTpl) : []
  const hasParams = paramNums.length > 0

  const stepSequence = [
    ...(!initialSegment ? ['segment'] : []),
    'campaign',
    ...(hasParams ? ['variables'] : []),
    'preview',
    'confirm',
  ]
  const STEP_LABELS = { segment: 'Segment', campaign: 'Setup', variables: 'Personalize', preview: 'Preview', confirm: 'Send' }

  useEffect(() => {
    if (step === 'variables' && !hasParams) setStep('preview')
  }, [hasParams])

  function goNext() {
    const idx = stepSequence.indexOf(step)
    if (idx < stepSequence.length - 1) setStep(stepSequence[idx + 1])
  }
  function goBack() {
    const idx = stepSequence.indexOf(step)
    if (idx > 0) setStep(stepSequence[idx - 1])
  }

  function getParamValue(contact, n) {
    if (paramMode === 'global') return globalParams[n] || `{{${n}}}`
    if (paramMode === 'field') { const fk = fieldMap[n]; return fk ? (contact[fk] || `{{${n}}}`) : `{{${n}}}` }
    if (paramMode === 'csv') {
      const row = csvRows?.find(r => r.phone.replace(/\s/g,'') === contact.phone.replace(/\s/g,''))
      return row?.params?.[n] || `{{${n}}}`
    }
    return `{{${n}}}`
  }
  function getMsg(contact) {
    if (!selTpl) return ''
    return paramNums.reduce((b, n) => b.replace(new RegExp(`\\{\\{${n}\\}\\}`, 'g'), getParamValue(contact, n)), selTpl.body)
  }

  const canFromCampaign  = !!selTpl && !!campaignName.trim()
  const canFromVariables = !hasParams || (
    paramMode === 'global' ? paramNums.every(n => globalParams[n]?.trim()) :
    paramMode === 'field'  ? paramNums.every(n => !!fieldMap[n]) :
    !!(csvRows?.length)
  )
  const canSend = scheduleMode === 'now' || (!!scheduleDate && !!scheduleTime)

  function handleCsvUpload(e) {
    const file = e.target.files?.[0]; if (!file) return
    setCsvError('')
    const reader = new FileReader()
    reader.onload = ev => {
      try {
        const lines = ev.target.result.trim().split('\n').filter(Boolean)
        if (lines.length < 2) { setCsvError('CSV needs a header row + at least 1 data row.'); return }
        const rows = lines.slice(1).map(line => {
          const cols = line.split(',').map(c => c.trim().replace(/^"|"$/g, ''))
          const row = { phone: cols[0] || '', params: {} }
          paramNums.forEach((n, i) => { row.params[n] = cols[i + 1] || '' })
          return row
        }).filter(r => r.phone)
        if (!rows.length) { setCsvError('No valid rows found.'); return }
        setCsvRows(rows)
      } catch { setCsvError('Failed to parse CSV.') }
    }
    reader.readAsText(file)
  }

  function downloadCsvTemplate() {
    const hdr = ['phone', ...paramNums.map(n => `param_${n}`)].join(',')
    const ex  = ['+91 98100 00001', ...paramNums.map(n => `Value ${n}`)].join(',')
    const blob = new Blob([[hdr, ex].join('\n')], { type: 'text/csv' })
    const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(blob), download: 'retarget_template.csv' })
    a.click(); URL.revokeObjectURL(a.href)
  }

  function handleSend() {
    setSending(true)
    setTimeout(() => { setSending(false); setDone(true); setTimeout(onClose, 2000) }, 1400)
  }

  const previewContacts = (paramMode === 'csv' && csvRows?.length)
    ? csvRows.slice(0, 5).map((r, i) => ({ ...ANA_PREVIEW_CONTACTS[i % ANA_PREVIEW_CONTACTS.length], phone: r.phone }))
    : ANA_PREVIEW_CONTACTS

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(15,23,42,0.45)', backdropFilter: 'blur(4px)' }}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="bg-white rounded-2xl shadow-2xl flex flex-col overflow-hidden"
        style={{ width: 'min(600px, calc(100vw - 24px))', maxHeight: '92vh' }}>

        {/* Header */}
        <div className="flex items-center gap-3 px-5 py-4 border-b border-slate-100">
          <div className="w-9 h-9 rounded-xl bg-primary-50 flex items-center justify-center flex-shrink-0">
            <Target size={16} className="text-primary"/>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[13px] font-bold text-slate-800">Retarget Campaign</p>
            <p className="text-[10px] text-slate-400 truncate">{campaign.name}</p>
          </div>
          <button onClick={onClose} className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors">
            <X size={14}/>
          </button>
        </div>

        {/* Step indicator */}
        {!done && (
          <div className="flex items-center gap-0.5 px-5 py-2.5 bg-slate-50 border-b border-slate-100 overflow-x-auto scrollbar-none">
            {stepSequence.map((s, i) => {
              const past = stepSequence.indexOf(step) > i
              const curr = step === s
              return (
                <span key={s} className="flex items-center gap-0.5 flex-shrink-0">
                  <span className={clsx('flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold transition-all',
                    curr ? 'bg-primary text-white' : past ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-400')}>
                    {past && <Check size={8}/>}
                    {STEP_LABELS[s]}
                  </span>
                  {i < stepSequence.length - 1 && <ChevronRight size={10} className="text-slate-300 mx-0.5"/>}
                </span>
              )
            })}
          </div>
        )}

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5">
          {done ? (
            <div className="flex flex-col items-center justify-center py-12 gap-3">
              <div className="w-14 h-14 rounded-full bg-emerald-50 flex items-center justify-center">
                <CheckCircle2 size={28} className="text-emerald-500"/>
              </div>
              <p className="text-[14px] font-bold text-slate-700">
                {scheduleMode === 'later' ? 'Campaign Scheduled!' : 'Campaign Sent!'}
              </p>
              <p className="text-[11px] text-slate-400 text-center">
                {scheduleMode === 'later'
                  ? `"${campaignName}" scheduled for ${scheduleDate ? new Date(scheduleDate+'T00:00').toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric'}) : ''} at ${scheduleTime}.`
                  : `"${campaignName}" dispatched to ${count.toLocaleString()} contacts.`}
              </p>
            </div>

          ) : step === 'segment' ? (
            <div className="space-y-3">
              <p className="text-[11px] text-slate-500">Choose which contacts from <span className="font-semibold text-slate-700">{campaign.name}</span> to retarget.</p>
              <div className="grid grid-cols-2 gap-2">
                {ANA_RETARGET_SEGS.map(s => {
                  const cnt = campaign[s.field] ?? 0
                  const Icon = s.icon
                  return (
                    <button key={s.key} onClick={() => { setSegKey(s.key); setStep('campaign') }}
                      className="flex items-center gap-2.5 p-3 rounded-xl border-2 transition-all text-left hover:shadow-sm"
                      style={{ borderColor: s.border, background: s.bg }}>
                      <Icon size={14} style={{ color: s.color }}/>
                      <div>
                        <p className="text-[11px] font-semibold" style={{ color: s.color }}>{s.label}</p>
                        <p className="text-[10px] text-slate-500">{cnt.toLocaleString()} contacts</p>
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>

          ) : step === 'campaign' ? (
            <div className="space-y-4">
              {seg && (
                <div className="flex items-center gap-2 p-2.5 rounded-lg border" style={{ borderColor: seg.border, background: seg.bg }}>
                  <seg.icon size={12} style={{ color: seg.color }}/>
                  <p className="text-[11px] font-semibold" style={{ color: seg.color }}>
                    Retargeting {count.toLocaleString()} {seg.label} contacts
                  </p>
                </div>
              )}
              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1.5">Campaign Name</label>
                <input
                  className="w-full border border-slate-200 rounded-xl px-3 py-2 text-[12px] outline-none focus:border-primary focus:ring-1 focus:ring-primary/10"
                  placeholder="e.g. July Replied Follow-up"
                  value={campaignName}
                  onChange={e => setCampaignName(e.target.value)}
                />
              </div>
              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1.5">Template</label>
                <div className="relative mb-2">
                  <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400"/>
                  <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search templates…"
                    className="w-full pl-7 pr-3 py-1.5 border border-slate-200 rounded-lg text-[11px] focus:outline-none focus:border-primary"/>
                </div>
                <div className="space-y-1.5 max-h-48 overflow-y-auto">
                  {tpls.map(t => (
                    <button key={t.id} onClick={() => { setSelTpl(t); setGlobalParams({}); setFieldMap({}); setCsvRows(null) }}
                      className={clsx('w-full text-left p-3 rounded-xl border-2 transition-all',
                        selTpl?.id === t.id ? 'border-primary bg-primary-50' : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50')}>
                      <div className="flex items-center justify-between">
                        <p className="text-[11px] font-semibold text-slate-700">{t.name}</p>
                        {selTpl?.id === t.id && <Check size={11} className="text-primary flex-shrink-0"/>}
                      </div>
                      <p className="text-[10px] text-slate-400 mt-0.5 line-clamp-1">{t.body}</p>
                    </button>
                  ))}
                </div>
              </div>
            </div>

          ) : step === 'variables' ? (
            <div className="space-y-4">
              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-2">How to fill variables?</label>
                <div className="flex rounded-xl border border-slate-200 overflow-hidden text-[11px] font-semibold">
                  {[{ k: 'global', label: 'Same for all' }, { k: 'field', label: 'Contact field' }, { k: 'csv', label: 'Upload CSV' }].map(({ k, label }) => (
                    <button key={k} onClick={() => setParamMode(k)}
                      className={clsx('flex-1 py-2 transition-colors', paramMode === k ? 'bg-primary text-white' : 'bg-white text-slate-500 hover:bg-slate-50')}>
                      {label}
                    </button>
                  ))}
                </div>
                <p className="text-[10px] text-slate-400 mt-1.5">
                  {paramMode === 'global' ? 'One value per variable — same for all contacts.' :
                   paramMode === 'field'  ? 'Map each variable to a contact attribute for personalization.' :
                   'Upload a CSV with per-contact values. Download template to get started.'}
                </p>
              </div>

              {paramMode === 'global' && (
                <div className="space-y-2">
                  {paramNums.map(n => (
                    <div key={n} className="flex items-center gap-2">
                      <span className="text-[10px] font-mono bg-slate-100 text-slate-600 px-2 py-1.5 rounded-lg w-12 text-center flex-shrink-0">{`{{${n}}}`}</span>
                      <input
                        className="flex-1 border border-slate-200 rounded-xl px-3 py-1.5 text-[11px] outline-none focus:border-primary"
                        placeholder={`Value for {{${n}}} — sent to all contacts`}
                        value={globalParams[n] || ''}
                        onChange={e => setGlobalParams(p => ({ ...p, [n]: e.target.value }))}
                      />
                    </div>
                  ))}
                </div>
              )}

              {paramMode === 'field' && (
                <div className="space-y-2">
                  {paramNums.map(n => (
                    <div key={n} className="flex items-center gap-2">
                      <span className="text-[10px] font-mono bg-slate-100 text-slate-600 px-2 py-1.5 rounded-lg w-12 text-center flex-shrink-0">{`{{${n}}}`}</span>
                      <NativeSelect sm
                        className="flex-1"
                        value={fieldMap[n] || ''}
                        onChange={e => setFieldMap(m => ({ ...m, [n]: e.target.value }))}>
                        <option value="">— Select contact field —</option>
                        {ANA_CONTACT_FIELDS.map(f => <option key={f.key} value={f.key}>{f.label}</option>)}
                      </NativeSelect>
                    </div>
                  ))}
                </div>
              )}

              {paramMode === 'csv' && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-[10px] text-slate-500">Expected columns: <span className="font-mono text-slate-700">phone, {paramNums.map(n=>`param_${n}`).join(', ')}</span></p>
                    <button onClick={downloadCsvTemplate} className="text-[10px] font-semibold text-primary hover:text-primary-hover flex items-center gap-1 flex-shrink-0 ml-2">
                      <Download size={10}/> Template
                    </button>
                  </div>
                  <label className={clsx('flex flex-col items-center justify-center gap-2 border-2 border-dashed rounded-xl p-6 cursor-pointer transition-colors',
                    csvRows ? 'border-emerald-300 bg-emerald-50' : 'border-slate-300 hover:border-primary hover:bg-primary-50/40')}>
                    <input type="file" accept=".csv" className="hidden" onChange={handleCsvUpload}/>
                    {csvRows ? (
                      <><CheckCircle2 size={20} className="text-emerald-500"/><p className="text-[11px] font-semibold text-emerald-700">{csvRows.length} contacts loaded</p><p className="text-[10px] text-emerald-600">Click to replace</p></>
                    ) : (
                      <><Upload size={20} className="text-slate-400"/><p className="text-[11px] font-semibold text-slate-600">Click to upload CSV</p><p className="text-[10px] text-slate-400">phone, {paramNums.map(n=>`{{${n}}}`).join(', ')}</p></>
                    )}
                  </label>
                  {csvError && <p className="text-[10px] text-red-600 flex items-center gap-1"><AlertCircle size={10}/> {csvError}</p>}
                  {csvRows && (
                    <div className="border border-slate-200 rounded-xl overflow-hidden">
                      <div className="overflow-x-auto">
                        <table className="w-full text-[10px]">
                          <thead>
                            <tr className="bg-slate-50 border-b border-slate-200">
                              <th className="text-left px-3 py-2 text-slate-500 font-semibold">Phone</th>
                              {paramNums.map(n => <th key={n} className="text-left px-3 py-2 text-slate-500 font-semibold">{`{{${n}}}`}</th>)}
                            </tr>
                          </thead>
                          <tbody>
                            {csvRows.slice(0, 4).map((r, i) => (
                              <tr key={i} className="border-b border-slate-100 last:border-0">
                                <td className="px-3 py-1.5 text-slate-600 font-mono">{r.phone}</td>
                                {paramNums.map(n => <td key={n} className="px-3 py-1.5 text-slate-700">{r.params[n] || <span className="text-red-400 italic">empty</span>}</td>)}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                      {csvRows.length > 4 && <p className="text-[10px] text-slate-400 text-center py-1.5 border-t border-slate-100">+ {csvRows.length - 4} more rows</p>}
                    </div>
                  )}
                </div>
              )}
            </div>

          ) : step === 'preview' ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-[11px] font-semibold text-slate-700">Message preview per contact</p>
                <span className="text-[10px] text-slate-400">Showing 5 of {count.toLocaleString()}</span>
              </div>
              {!selTpl ? (
                <p className="text-[11px] text-slate-400 text-center py-8">No template selected.</p>
              ) : previewContacts.map((c, i) => (
                <div key={i} className="border border-slate-200 rounded-xl p-3 space-y-2">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-full bg-primary-100 flex items-center justify-center flex-shrink-0">
                      <span className="text-[9px] font-bold text-primary">{c.firstName[0]}{c.lastName[0]}</span>
                    </div>
                    <div>
                      <p className="text-[11px] font-semibold text-slate-700">{c.firstName} {c.lastName}</p>
                      <p className="text-[9px] text-slate-400 font-mono">{c.phone}</p>
                    </div>
                  </div>
                  <div className="flex justify-end">
                    <div className="bg-[#dcf8c6] rounded-2xl rounded-tr-sm px-3 py-1.5 max-w-[85%]">
                      <p className="text-[11px] text-slate-800 leading-relaxed">{getMsg(c)}</p>
                      <p className="text-[9px] text-slate-400 text-right mt-0.5">12:00 ✓✓</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>

          ) : step === 'confirm' ? (
            <div className="space-y-4">
              <div className="border border-slate-200 rounded-xl overflow-hidden">
                <div className="bg-slate-50 px-3 py-2 border-b border-slate-200">
                  <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Campaign Summary</p>
                </div>
                {[
                  { label: 'Campaign Name',    value: campaignName },
                  { label: 'Source Campaign',  value: campaign.name },
                  { label: 'Segment',          value: seg ? `${seg.label} (${count.toLocaleString()})` : '—', color: seg?.color },
                  { label: 'Template',         value: selTpl?.name || '—' },
                  { label: 'Personalization',  value: paramMode === 'global' ? 'Same for all contacts' : paramMode === 'field' ? 'Contact field mapping' : `CSV (${csvRows?.length || 0} rows)` },
                ].map(({ label, value, color }) => (
                  <div key={label} className="flex justify-between items-center px-3 py-2 border-b border-slate-100 last:border-0">
                    <span className="text-[10px] text-slate-500">{label}</span>
                    <span className="text-[11px] font-semibold truncate max-w-[60%] text-right" style={{ color: color || undefined }}>{value}</span>
                  </div>
                ))}
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-2">Delivery</label>
                <div className="flex rounded-xl border border-slate-200 overflow-hidden text-[11px] font-semibold">
                  {[{ k: 'now', label: 'Send Now', icon: Send }, { k: 'later', label: 'Schedule', icon: Calendar }].map(({ k, label, icon: Icon }) => (
                    <button key={k} onClick={() => setScheduleMode(k)}
                      className={clsx('flex-1 py-2 flex items-center justify-center gap-1.5 transition-colors',
                        scheduleMode === k ? 'bg-primary text-white' : 'bg-white text-slate-500 hover:bg-slate-50')}>
                      <Icon size={10}/> {label}
                    </button>
                  ))}
                </div>
                {scheduleMode === 'later' && (
                  <div className="flex gap-2 mt-3">
                    <DatePicker
                      value={scheduleDate}
                      onChange={setScheduleDate}
                      min={new Date().toISOString().split('T')[0]}
                      className="flex-1"
                    />
                    <NativeSelect value={scheduleTime} onChange={e => setScheduleTime(e.target.value)}
                      className="flex-1">
                      <option value="">Select time</option>
                      {Array.from({length:144},(_,i)=>{const h=Math.floor(i/6),m=(i%6)*10,hh=String(h).padStart(2,'0'),mm=String(m).padStart(2,'0'),ampm=h<12?'AM':'PM',h12=h===0?12:h>12?h-12:h;return <option key={i} value={`${hh}:${mm}`}>{`${h12}:${mm} ${ampm}`}</option>})}
                    </NativeSelect>
                  </div>
                )}
              </div>

              <div className="flex items-start gap-2 p-3 rounded-xl bg-amber-50 border border-amber-200">
                <AlertCircle size={12} className="text-amber-600 flex-shrink-0 mt-0.5"/>
                <p className="text-[10px] text-amber-700 leading-relaxed">
                  This will {scheduleMode === 'later' ? 'schedule' : 'send'} <span className="font-bold">{count.toLocaleString()} messages</span>
                  {scheduleMode === 'later' && scheduleDate && scheduleTime ? (() => { const d=new Date(scheduleDate+'T00:00'); const [h,m]=scheduleTime.split(':').map(Number); const ampm=h<12?'AM':'PM'; const h12=h===0?12:h>12?h-12:h; return ` on ${d.toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric'})} at ${h12}:${String(m).padStart(2,'0')} ${ampm}` })() : scheduleMode === 'now' ? ' immediately' : ''}.
                  {' '}Standard WhatsApp charges apply.
                </p>
              </div>
            </div>
          ) : null}
        </div>

        {/* Footer */}
        {!done && (
          <div className="flex items-center justify-between px-5 py-3.5 border-t border-slate-100 bg-slate-50/60">
            <div>
              {step !== stepSequence[0] && (
                <button onClick={goBack} className="px-4 py-1.5 rounded-lg text-[11px] font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 transition-colors">
                  ← Back
                </button>
              )}
            </div>
            <div className="flex items-center gap-2">
              <button onClick={onClose} className="px-3 py-1.5 rounded-lg text-[11px] font-semibold text-slate-500 hover:text-slate-700 transition-colors">
                Cancel
              </button>
              {step === 'segment' && (
                <span className="text-[10px] text-slate-400 italic">Select a segment above</span>
              )}
              {step === 'campaign' && (
                <button onClick={goNext} disabled={!canFromCampaign}
                  className="px-4 py-1.5 rounded-lg text-[11px] font-semibold text-white bg-primary hover:bg-primary-hover transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
                  Next →
                </button>
              )}
              {step === 'variables' && (
                <button onClick={goNext} disabled={!canFromVariables}
                  className="px-4 py-1.5 rounded-lg text-[11px] font-semibold text-white bg-primary hover:bg-primary-hover transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
                  Preview →
                </button>
              )}
              {step === 'preview' && (
                <button onClick={goNext}
                  className="px-4 py-1.5 rounded-lg text-[11px] font-semibold text-white bg-primary hover:bg-primary-hover transition-colors">
                  Confirm →
                </button>
              )}
              {step === 'confirm' && (
                <button onClick={handleSend} disabled={sending || !canSend}
                  className="px-4 py-1.5 rounded-lg text-[11px] font-semibold text-white bg-primary hover:bg-primary-hover transition-colors disabled:opacity-60">
                  {sending ? 'Sending…' : scheduleMode === 'later'
                    ? <><Calendar size={11} className="inline mr-1"/>Schedule</>
                    : <><Send size={11} className="inline mr-1"/>Send Campaign</>}
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function BroadcastsTab({ range, selTemplateId, setSelTemplateId }) {
  const [expandedCampaign, setExpandedCampaign] = useState(null)
  const [campRecipTab,     setCampRecipTab]     = useState('All')
  const [showRetarget,     setShowRetarget]     = useState(false)
  const [retargetSeg,      setRetargetSeg]      = useState(null)
  const [retargetCampaign, setRetargetCampaign] = useState(null)

  const selTpl   = selTemplateId === 'all' ? null : BC_TEMPLATES.find(t => t.id === selTemplateId)
  const data     = range === 'today' ? BC_1 : range === '7d' ? BC_7 : BC_30
  const chartData = selTpl ? selTpl.dailySent : data

  /* funnel numbers â€” switch between template-level and aggregate */
  const attempted     = selTpl ? selTpl.attempted     : 1234567
  const sent          = selTpl ? selTpl.sent          : 124345
  const delivered     = selTpl ? selTpl.delivered     : 98200
  const read          = selTpl ? selTpl.read          : 11122
  const replied       = selTpl ? selTpl.replied       : 5000
  const clicked       = selTpl ? selTpl.clicked       : 4000
  const failed        = selTpl ? selTpl.failed        : 12313
  const userInitiated = selTpl ? selTpl.userInitiated : 10000

  const FUNNEL = [
    { label: 'Total Attempted', value: attempted, pro: false },
    { label: 'Sent',            value: sent,      pro: false },
    { label: 'Delivered',       value: delivered, pro: false },
    { label: 'Read',            value: read,      pro: false },
    { label: 'Replied',         value: replied,   pro: true  },
    { label: 'Clicked',         value: clicked,   pro: true  },
  ]

  /* conversation category data */
  const convData = selTpl
    ? selTpl.dailySent.map(d => ({ date: d.date, sent: d.sent, delivered: d.delivered, read: d.read, clicked: d.clicked }))
    : data.map(d => ({
        date: d.date,
        marketing:      rand(5000, 45000),
        service:        rand(3000, 25000),
        authentication: rand(1000, 30000),
        utility:        rand(2000, 20000),
      }))

  /* approx charges data */
  const chargesData = data.map(d => ({
    date:           d.date,
    marketing:      rand(4000, 40000),
    service:        rand(2000, 18000),
    authentication: rand(800,  22000),
    utility:        rand(1500, 14000),
  }))

  /* conversation category summary */
  const CATS = [
    { cat: 'Marketing',            paid: 200000, charges: 40000 },
    { cat: 'Utility',              paid: 12340,  charges: 12340 },
    { cat: 'Authentication',       paid: 0,      charges: 0     },
    { cat: 'Authentication (Int)', paid: 0,      charges: 0     },
    { cat: 'Service',              paid: 144679, charges: 4679  },
  ]
  const totalPaid    = CATS.reduce((s,r) => s + r.paid, 0)
  const totalCharges = CATS.reduce((s,r) => s + r.charges, 0)

  /* WA errors â€” template-specific or aggregate */
  const WA_ERRORS = selTpl?.errors?.length ? selTpl.errors : [
    { code: '100',    type: 'Parameter is invalid',                count: 6000 },
    { code: '130111', type: "User's number part of an experiment", count: 5800 },
    { code: '130111', type: 'Message Undeliverable',               count: 4200 },
    { code: '130111', type: 'WhatsApp Not Available',              count: 3100 },
    { code: '131026', type: 'Limit Reached',                       count: 2900 },
    { code: '132000', type: 'Template parameter count mismatch',   count: 1500 },
  ]
  const totalErrors = WA_ERRORS.reduce((s,e) => s + e.count, 0)

  const AREA_LINES = [
    { key: 'marketing',      name: 'Marketing',      color: '#374151' },
    { key: 'service',        name: 'Service',        color: '#6b7280' },
    { key: 'authentication', name: 'Authentication', color: '#9ca3af' },
    { key: 'utility',        name: 'Utility',        color: '#d1d5db' },
  ]

  const CAT_COLOR = { Marketing: '#8B5CF6', Utility: '#0066ff', Service: '#22C55E', Authentication: '#F59E0B' }

  return (
    <div className="space-y-5">

      {/* ── Template context bar â€” shown when a template is selected ── */}
      {selTpl && (
        <div className="flex items-center gap-2 py-2 px-3 bg-slate-50 border border-surface-border rounded-xl">
          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full"
            style={{ background: CAT_COLOR[selTpl.category] + '18', color: CAT_COLOR[selTpl.category] }}>
            {selTpl.category}
          </span>
          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-600">
            {selTpl.status}
          </span>
          {selTpl.campaigns.length > 0 && (
            <span className="text-[10px] text-slate-400">
              Used in: <span className="font-semibold text-slate-600">{selTpl.campaigns.join(', ')}</span>
            </span>
          )}
          <div className="flex-1" />
          <button
            onClick={() => setSelTemplateId('all')}
            className="text-[10px] text-slate-400 hover:text-slate-600 font-semibold transition-colors">
            âœ• Clear filter
          </button>
        </div>
      )}

      {/* ── Overview metric cards ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
        <MetricCard icon={Send}          label="Total Attempted" value={attempted.toLocaleString()}     trend={20}  color="#0066ff"/>
        <MetricCard icon={CheckCircle2}  label="Sent"            value={sent.toLocaleString()}          trend={12}  color="#0066ff"/>
        <MetricCard icon={Eye}           label="Delivered"       value={delivered.toLocaleString()}     trend={-2}  color="#0066ff"/>
        <MetricCard icon={XCircle}       label="Failed"          value={failed.toLocaleString()}        trend={-8}  color="#0066ff"/>
        <MetricCard icon={Eye}           label="Read"            value={read.toLocaleString()}          trend={-22} color="#0066ff"/>
        <MetricCard icon={Users}         label="User Initiated"  value={userInitiated.toLocaleString()} trend={5}   color="#0066ff"/>
        <MetricCard icon={MessageSquare} label="Replied"         value={replied.toLocaleString()}       trend={18}  color="#8B5CF6" pro/>
        <MetricCard icon={TrendingUp}    label="Clicked"         value={clicked.toLocaleString()}       trend={18}  color="#8B5CF6" pro/>
      </div>

      {/* ── Delivery Funnel ── */}
      <ChartCard
        title="Message Delivery Funnel"
        sub="Step-by-step conversion from attempted to clicked"
        right={
          <span className="text-[10px] text-slate-400 font-medium">
            Overall CTR: <span className="font-bold text-slate-700">{((clicked/attempted)*100).toFixed(2)}%</span>
          </span>
        }
      >
        <div className="space-y-2">
          {FUNNEL.map((step, i) => {
            const pct      = ((step.value / attempted) * 100).toFixed(1)
            const convRate = i > 0 ? ((step.value / FUNNEL[i-1].value) * 100).toFixed(1) : null
            const barW     = Math.max((step.value / attempted) * 100, 0.5)
            return (
              <div key={step.label}>
                <div className="flex items-center gap-3">
                  <div className="w-5 h-5 rounded-full bg-slate-100 flex items-center justify-center text-[9px] font-bold text-slate-500 flex-shrink-0">
                    {i + 1}
                  </div>
                  <div className="w-28 flex-shrink-0 flex items-center gap-1.5">
                    <span className="text-[11px] font-medium text-slate-600 leading-tight">{step.label}</span>
                    {step.pro && <ProBadge/>}
                  </div>
                  <div className="flex-1 h-7 bg-slate-50 rounded-lg border border-surface-border overflow-hidden">
                    <div className="h-full bg-slate-800 rounded-lg flex items-center justify-end pr-2.5 transition-all duration-700"
                      style={{ width: `${barW}%` }}>
                      {barW > 12 && (
                        <span className="text-[9px] font-bold text-white whitespace-nowrap">{step.value.toLocaleString()}</span>
                      )}
                    </div>
                  </div>
                  <div className="w-28 flex-shrink-0 flex items-center justify-end gap-3">
                    <span className="text-[11px] font-bold text-slate-700">{pct}%</span>
                    {convRate !== null && (
                      <span className={clsx(
                        'text-[9px] font-semibold px-1.5 py-0.5 rounded-full',
                        Number(convRate) >= 70 ? 'bg-emerald-50 text-emerald-600' :
                        Number(convRate) >= 30 ? 'bg-amber-50 text-amber-600' : 'bg-red-50 text-red-500'
                      )}>â†“{convRate}%</span>
                    )}
                  </div>
                </div>
                {i < FUNNEL.length - 1 && (
                  <div className="flex items-center gap-3 h-2 mt-0.5">
                    <div className="w-5 flex-shrink-0"/>
                    <div className="w-28 flex-shrink-0"/>
                    <div className="flex-1 flex"><div className="ml-3 w-px h-2 bg-slate-200"/></div>
                    <div className="w-28"/>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </ChartCard>

      {/* ── Conversation Insights + Paid Conversations ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 items-stretch">
        <div className="lg:col-span-2 flex flex-col">
          {selTpl ? (
            /* ── Template-specific delivery trend ── */
            <ChartCard
              className="flex-1"
              title={`Delivery Trend â€” ${selTpl.name}`}
              sub="Sent â†’ Delivered â†’ Read â†’ Clicked over time"
              right={
                <div className="flex items-center gap-3 flex-wrap">
                  {[{color:'#374151',label:'Sent'},{color:'#6b7280',label:'Delivered'},{color:'#22C55E',label:'Read'},{color:'#8B5CF6',label:'Clicked'}].map(l => (
                    <span key={l.label} className="flex items-center gap-1 text-[9px] text-slate-400">
                      <span className="w-2 h-2 rounded-sm" style={{ background: l.color }}/>{l.label}
                    </span>
                  ))}
                </div>
              }
            >
              <ResponsiveContainer width="100%" height={280}>
                <AreaChart data={convData} margin={{ top:4, right:4, left:-10, bottom:0 }}>
                  <defs>
                    {[{id:'tSent',c:'#374151'},{id:'tDlv',c:'#6b7280'},{id:'tRd',c:'#22C55E'},{id:'tClk',c:'#8B5CF6'}].map(g => (
                      <linearGradient key={g.id} id={g.id} x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={g.c} stopOpacity={0.15}/><stop offset="100%" stopColor={g.c} stopOpacity={0}/>
                      </linearGradient>
                    ))}
                  </defs>
                  <CartesianGrid strokeDasharray="2 4" stroke="#f1f5f9" vertical={false}/>
                  <XAxis dataKey="date" tick={{ fontSize:9, fill:'#94a3b8' }} tickLine={false} axisLine={false} interval={range==='30d'?5:0}/>
                  <YAxis tick={{ fontSize:9, fill:'#94a3b8' }} tickLine={false} axisLine={false} tickFormatter={v => v>=1000?(v/1000).toFixed(0)+'k':v}/>
                  <Tooltip content={<ChartTip/>}/>
                  <Area type="monotone" dataKey="sent"      name="Sent"      stroke="#374151" strokeWidth={2}   fill="url(#tSent)" dot={false}/>
                  <Area type="monotone" dataKey="delivered" name="Delivered" stroke="#6b7280" strokeWidth={1.5} fill="url(#tDlv)"  dot={false}/>
                  <Area type="monotone" dataKey="read"      name="Read"      stroke="#22C55E" strokeWidth={1.5} fill="url(#tRd)"   dot={false}/>
                  <Area type="monotone" dataKey="clicked"   name="Clicked"   stroke="#8B5CF6" strokeWidth={1.5} fill="url(#tClk)"  dot={false}/>
                </AreaChart>
              </ResponsiveContainer>
            </ChartCard>
          ) : (
            /* ── All-template category breakdown ── */
            <ChartCard
              className="flex-1"
              title="Conversation Insights"
              sub="By category over time"
              right={
                <div className="flex items-center gap-3 flex-wrap">
                  {AREA_LINES.map(l => (
                    <span key={l.key} className="flex items-center gap-1 text-[9px] text-slate-400">
                      <span className="w-2 h-2 rounded-sm" style={{ background: l.color }}/>{l.name}
                    </span>
                  ))}
                </div>
              }
            >
              <ResponsiveContainer width="100%" height={280}>
                <AreaChart data={convData} margin={{ top:4, right:4, left:-10, bottom:0 }}>
                  <defs>
                    {AREA_LINES.map(l => (
                      <linearGradient key={l.key} id={`bc${l.key}`} x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%"   stopColor={l.color} stopOpacity={0.15}/>
                        <stop offset="100%" stopColor={l.color} stopOpacity={0}/>
                      </linearGradient>
                    ))}
                  </defs>
                  <CartesianGrid strokeDasharray="2 4" stroke="#f1f5f9" vertical={false}/>
                  <XAxis dataKey="date" tick={{ fontSize:9, fill:'#94a3b8' }} tickLine={false} axisLine={false} interval={range==='30d'?5:0}/>
                  <YAxis tick={{ fontSize:9, fill:'#94a3b8' }} tickLine={false} axisLine={false} tickFormatter={v => v>=1000?(v/1000).toFixed(0)+'k':v}/>
                  <Tooltip content={<ChartTip/>}/>
                  {AREA_LINES.map(l => (
                    <Area key={l.key} type="monotone" dataKey={l.key} name={l.name}
                      stroke={l.color} strokeWidth={1.5} fill={`url(#bc${l.key})`} dot={false} stackId="conv"/>
                  ))}
                </AreaChart>
              </ResponsiveContainer>
            </ChartCard>
          )}
        </div>

        <ChartCard title="Paid Conversations" sub="By category + charges">
          <div className="flex items-center justify-center mb-4">
            <div className="relative">
              <ResponsiveContainer width={110} height={110}>
                <PieChart>
                  <Pie data={CATS.filter(c=>c.paid>0)} cx="50%" cy="50%"
                    innerRadius={32} outerRadius={52} dataKey="paid" strokeWidth={2} stroke="#fff">
                    {CATS.filter(c=>c.paid>0).map((_, i) => (
                      <Cell key={i} fill={['#1e293b','#475569','#94a3b8'][i % 3]}/>
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <p className="text-[13px] font-bold text-slate-800">{(totalPaid/1000).toFixed(0)}k</p>
                <p className="text-[8px] text-slate-400">total</p>
              </div>
            </div>
          </div>
          <div className="space-y-1.5">
            {CATS.map((c, i) => (
              <div key={c.cat} className="flex items-center justify-between py-1.5 border-b border-slate-50 last:border-0">
                <span className="flex items-center gap-2 text-[10px] text-slate-500 min-w-0">
                  <span className="w-2 h-2 rounded-sm flex-shrink-0"
                    style={{ background: ['#1e293b','#475569','#94a3b8','#cbd5e1','#e2e8f0'][i] }}/>
                  <span className="truncate">{c.cat}</span>
                </span>
                <div className="flex items-center gap-3 flex-shrink-0">
                  <span className="text-[10px] font-semibold text-slate-700">{c.paid.toLocaleString()}</span>
                  <span className="text-[9px] text-slate-400 w-14 text-right">â‚¹{c.charges.toLocaleString()}</span>
                </div>
              </div>
            ))}
            <div className="flex items-center justify-between pt-2 border-t border-slate-100">
              <span className="text-[10px] font-bold text-slate-600">Total</span>
              <div className="flex items-center gap-3">
                <span className="text-[10px] font-bold text-slate-800">{totalPaid.toLocaleString()}</span>
                <span className="text-[9px] font-bold text-slate-600 w-14 text-right">â‚¹{totalCharges.toLocaleString()}</span>
              </div>
            </div>
          </div>
        </ChartCard>
      </div>

      {/* ── Approximate Charges + Template Errors ── */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 items-stretch">
        <div className="lg:col-span-3 flex flex-col">
          <ChartCard
            className="flex-1"
            title="Approximate Charges"
            sub="â‚¹ spend trend by conversation type"
            right={
              <div className="flex items-center gap-2">
                <button className="btn-secondary">Conversations <ChevronDown size={9}/></button>
                <button className="btn-secondary">Customise <ChevronDown size={9}/></button>
              </div>
            }
          >
            <ResponsiveContainer width="100%" height={190}>
              <AreaChart data={chargesData} margin={{ top:4, right:4, left:-4, bottom:0 }}>
                <defs>
                  {AREA_LINES.map(l => (
                    <linearGradient key={`ch${l.key}`} id={`ch${l.key}`} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%"   stopColor={l.color} stopOpacity={0.18}/>
                      <stop offset="100%" stopColor={l.color} stopOpacity={0}/>
                    </linearGradient>
                  ))}
                </defs>
                <CartesianGrid strokeDasharray="2 4" stroke="#f1f5f9" vertical={false}/>
                <XAxis dataKey="date" tick={{ fontSize:9, fill:'#94a3b8' }} tickLine={false} axisLine={false} interval={range==='30d'?5:0}/>
                <YAxis tick={{ fontSize:9, fill:'#94a3b8' }} tickLine={false} axisLine={false} tickFormatter={v => 'â‚¹'+(v/1000).toFixed(0)+'k'}/>
                <Tooltip content={<ChartTip/>}/>
                {AREA_LINES.map(l => (
                  <Area key={l.key} type="monotone" dataKey={l.key} name={l.name}
                    stroke={l.color} strokeWidth={1.5} fill={`url(#ch${l.key})`} dot={false} stackId="charges"/>
                ))}
              </AreaChart>
            </ResponsiveContainer>
          </ChartCard>
        </div>

        <div className="lg:col-span-2 flex flex-col">
          <ChartCard
            className="flex-1"
            title="Template Errors"
            sub={`${totalErrors.toLocaleString()} total`}
            right={
              <span className="text-[9px] font-bold text-red-500 bg-red-50 border border-red-100 px-2 py-0.5 rounded-full">
                {WA_ERRORS.length} types
              </span>
            }
            noPad
          >
            <div className="divide-y divide-surface-border">
              {WA_ERRORS.map((e, i) => {
                const pct = Math.round((e.count / totalErrors) * 100)
                return (
                  <div key={i} className="px-4 py-2.5 hover:bg-slate-50/60 transition-colors">
                    <div className="flex items-start justify-between gap-2 mb-1.5">
                      <span className="text-[10px] text-slate-500 leading-snug flex-1">{e.type}</span>
                      <span className="text-[11px] font-bold text-slate-700 flex-shrink-0">{e.count.toLocaleString()}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[9px] text-slate-400 font-mono">{e.code}</span>
                      <div className="flex-1 h-1 bg-slate-100 rounded-full overflow-hidden">
                        <div className="h-full rounded-full bg-red-300" style={{ width:`${pct}%` }}/>
                      </div>
                      <span className="text-[9px] text-slate-400">{pct}%</span>
                    </div>
                  </div>
                )
              })}
            </div>
          </ChartCard>
        </div>
      </div>

      {/* ── Campaign Performance ── */}
      <ChartCard
        title="Campaign Performance"
        sub={selTpl
          ? `Campaigns using "${selTpl.name}"`
          : `${BC_CAMPAIGNS.length} campaigns`}
        noPad
      >
        <div className="divide-y divide-surface-border">
          {BC_CAMPAIGNS.filter(c => !selTpl || selTpl.campaigns.includes(c.name)).length === 0 ? (
            <div className="py-10 text-center">
              <Megaphone size={24} className="text-slate-200 mx-auto mb-2" />
              <p className="text-xs text-slate-400">This template hasn't been used in any campaign yet</p>
            </div>
          ) : BC_CAMPAIGNS
            .filter(c => !selTpl || selTpl.campaigns.includes(c.name))
            .map(c => {
            const dlvPct   = Math.round((c.delivered / c.sent) * 100)
            const isOpen   = expandedCampaign === c.name

            /* fake recipient rows per segment */
            const NAMES = ['Amit Sharma','Priya Nair','Ravi Kumar','Sneha Patel','Arjun Mehta','Kavya Reddy','Rohit Singh','Ananya Joshi']
            const makeRows = (seg) => {
              const cnt = seg === 'All' ? c.delivered
                : seg === 'Delivered' ? c.delivered
                : seg === 'Read'      ? c.read
                : seg === 'Clicked'   ? c.clicked
                : seg === 'Replied'   ? c.replied
                :                      c.failed
              return Array.from({ length: Math.min(cnt, 5) }, (_, i) => ({
                name:   NAMES[i % NAMES.length],
                phone:  `+91 98${String(10000000 + i * 1234567).slice(0,8)}`,
                status: seg === 'All' ? 'Delivered' : seg,
              }))
            }
            const CAMP_RECIP_TABS = [
              { key: 'All',       label: 'All',       count: c.delivered },
              { key: 'Delivered', label: 'Delivered', count: c.delivered },
              { key: 'Read',      label: 'Read',      count: c.read      },
              { key: 'Clicked',   label: 'Clicked',   count: c.clicked   },
              { key: 'Replied',   label: 'Replied',   count: c.replied   },
              { key: 'Failed',    label: 'Failed',    count: c.failed    },
            ]
            const activeRows = makeRows(campRecipTab)

            return (
              <div key={c.name}>
                {/* campaign summary row */}
                <button
                  className="w-full text-left px-4 py-3 hover:bg-slate-50/40 transition-colors"
                  onClick={() => {
                    setExpandedCampaign(isOpen ? null : c.name)
                    setCampRecipTab('All')
                  }}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <ChevronDown size={13} className={clsx('text-slate-400 transition-transform flex-shrink-0', isOpen && 'rotate-180')}/>
                      <span className="text-[12px] font-semibold text-slate-700">{c.name}</span>
                    </div>
                    <div className="flex items-center gap-4">
                      <span className="text-[10px] text-slate-400">{c.sent.toLocaleString()} sent</span>
                      <span className={clsx('text-[11px] font-bold', c.readRate > 50 ? 'text-emerald-600' : 'text-amber-500')}>
                        {c.readRate}% read
                      </span>
                      <span className={clsx('text-[11px] font-bold', c.clickRate > 8 ? 'text-emerald-600' : 'text-slate-500')}>
                        {c.clickRate}% click
                      </span>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {[
                      { label: 'Delivered', value: dlvPct },
                      { label: 'Read',      value: c.readRate },
                      { label: 'Clicked',   value: c.clickRate },
                      { label: 'Replied',   value: Math.round(c.clickRate * 0.7) },
                    ].map(bar => (
                      <div key={bar.label}>
                        <div className="flex items-center justify-between mb-0.5">
                          <span className="text-[8px] text-slate-400">{bar.label}</span>
                          <span className="text-[8px] font-bold text-slate-600">{bar.value}%</span>
                        </div>
                        <div className="h-1 bg-slate-100 rounded-full overflow-hidden">
                          <div className="h-full rounded-full bg-slate-700" style={{ width:`${Math.min(bar.value,100)}%` }}/>
                        </div>
                      </div>
                    ))}
                  </div>
                </button>

                {/* expanded recipients section */}
                {isOpen && (
                  <div className="border-t border-surface-border bg-slate-50/40">
                    {/* sub-tab toolbar */}
                    <div className="flex items-center gap-2 px-4 py-2 border-b border-surface-border min-w-0">
                      <div className="flex-1 overflow-x-auto scrollbar-none min-w-0">
                        <div className="flex items-center gap-1">
                          {CAMP_RECIP_TABS.map(t => (
                            <button key={t.key}
                              onClick={() => setCampRecipTab(t.key)}
                              className={clsx(
                                'flex-shrink-0 flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-semibold transition-colors whitespace-nowrap',
                                campRecipTab === t.key
                                  ? 'bg-slate-800 text-white'
                                  : 'bg-white border border-surface-border text-slate-500 hover:bg-slate-100',
                              )}>
                              {t.label}
                              <span className={clsx('px-1 py-0.5 rounded-full text-[9px] font-bold',
                                campRecipTab === t.key ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-500')}>
                                {t.count.toLocaleString()}
                              </span>
                            </button>
                          ))}
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        <button className="flex items-center gap-1 px-2.5 py-1 rounded-lg border border-surface-border bg-white text-[10px] font-semibold text-slate-600 hover:bg-slate-50 transition-colors">
                          <Download size={10}/> Export CSV
                        </button>
                        {campRecipTab !== 'All' && (
                          <button
                            onClick={() => {
                              const segKey = campRecipTab.toLowerCase()
                              setRetargetSeg(segKey)
                              setRetargetCampaign(c)
                              setShowRetarget(true)
                            }}
                            className="flex items-center gap-1 px-2.5 py-1 rounded-lg border border-primary-100 bg-primary-50 text-[10px] font-semibold text-primary hover:bg-primary-100 transition-colors">
                            <Target size={10}/> Retarget {campRecipTab}
                          </button>
                        )}
                      </div>
                    </div>

                    {/* recipient rows */}
                    <div className="divide-y divide-surface-border">
                      {activeRows.length === 0 ? (
                        <div className="py-6 text-center">
                          <p className="text-[11px] text-slate-400">No contacts in this segment</p>
                        </div>
                      ) : activeRows.map((r, i) => (
                        <div key={i} className="flex items-center gap-3 px-4 py-2">
                          <div className="w-6 h-6 rounded-full bg-slate-200 flex items-center justify-center flex-shrink-0">
                            <span className="text-[9px] font-bold text-slate-600">{r.name[0]}</span>
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-[11px] font-semibold text-slate-700 truncate">{r.name}</p>
                            <p className="text-[10px] text-slate-400">{r.phone}</p>
                          </div>
                          <span className={clsx('text-[9px] font-bold px-2 py-0.5 rounded-full',
                            r.status === 'Delivered' ? 'bg-emerald-50 text-emerald-600' :
                            r.status === 'Read'      ? 'bg-teal-50 text-teal-600'     :
                            r.status === 'Clicked'   ? 'bg-blue-50 text-blue-600'     :
                            r.status === 'Replied'   ? 'bg-violet-50 text-violet-600' :
                            r.status === 'Failed'    ? 'bg-red-50 text-red-500'       :
                            'bg-slate-100 text-slate-500')}>
                            {r.status}
                          </span>
                        </div>
                      ))}
                      {CAMP_RECIP_TABS.find(t => t.key === campRecipTab)?.count > 5 && (
                        <div className="px-4 py-2 text-center">
                          <p className="text-[10px] text-slate-400">
                            Showing 5 of {CAMP_RECIP_TABS.find(t => t.key === campRecipTab)?.count.toLocaleString()} contacts
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </ChartCard>

      {/* retarget modal */}
      {showRetarget && retargetCampaign && (
        <AnalyticsRetargetModal
          campaign={retargetCampaign}
          initialSegment={retargetSeg}
          onClose={() => { setShowRetarget(false); setRetargetSeg(null); setRetargetCampaign(null) }}
        />
      )}

    </div>
  )
}

/* ════════════════════════════════════════════════════════════════
   AI USAGE TAB
════════════════════════════════════════════════════════════════ */
function AITab({ range }) {
  const data       = range === 'today' ? AI_1 : range === '7d' ? AI_7 : AI_30
  const sum        = (k) => data.reduce((a,d) => a + d[k], 0)
  const tokens     = sum('tokens'), sessions = sum('sessions'), suggested = sum('suggested'), accepted = sum('accepted')
  const acceptRate = Math.round((accepted / suggested) * 100)

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
        <MetricCard icon={Zap}          label="Tokens Used"          value={(tokens/1000).toFixed(0)+'K'} trend={22} color="#8B5CF6"/>
        <MetricCard icon={Bot}          label="AI Sessions"          value={sessions.toLocaleString()}    trend={18} color="#0066ff"/>
        <MetricCard icon={CheckCircle2} label="Suggestions Accepted" value={`${acceptRate}%`}             trend={4}  color="#22C55E"/>
        <MetricCard icon={TrendingUp}   label="Automation Rate"      value="71%"                          trend={6}  color="#F59E0B"/>
      </div>

      <ChartCard title="Token Usage Over Time" sub="AI tokens consumed per day">
        <ResponsiveContainer width="100%" height={200}>
          <AreaChart data={data} margin={{ top:4, right:4, left:-10, bottom:0 }}>
            <defs>
              <linearGradient id="gTok" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#374151" stopOpacity={0.15}/><stop offset="100%" stopColor="#374151" stopOpacity={0}/>
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="2 4" stroke="#f1f5f9" vertical={false}/>
            <XAxis dataKey="date" tick={{ fontSize:9, fill:'#94a3b8' }} tickLine={false} axisLine={false} interval={range==='30d'?5:0}/>
            <YAxis tick={{ fontSize:9, fill:'#94a3b8' }} tickLine={false} axisLine={false} tickFormatter={v=>(v/1000).toFixed(0)+'K'}/>
            <Tooltip content={<ChartTip/>}/>
            <Area type="monotone" dataKey="tokens" name="Tokens" stroke="#374151" strokeWidth={2} fill="url(#gTok)" dot={false}/>
          </AreaChart>
        </ResponsiveContainer>
      </ChartCard>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <ChartCard title="Suggestions vs Accepted" sub="Last 7 days">
          <ResponsiveContainer width="100%" height={170}>
            <BarChart data={data.slice(-7)} margin={{ top:4, right:4, left:-20, bottom:0 }} barSize={16} barGap={3}>
              <CartesianGrid strokeDasharray="2 4" stroke="#f1f5f9" vertical={false}/>
              <XAxis dataKey="date" tick={{ fontSize:8, fill:'#94a3b8' }} tickLine={false} axisLine={false}/>
              <YAxis tick={{ fontSize:8, fill:'#94a3b8' }} tickLine={false} axisLine={false}/>
              <Tooltip content={<ChartTip/>}/>
              <Bar dataKey="suggested" name="Suggested" fill="#d1d5db" radius={[3,3,0,0]}/>
              <Bar dataKey="accepted"  name="Accepted"  fill="#374151" radius={[3,3,0,0]}/>
            </BarChart>
          </ResponsiveContainer>
          <Legend items={[{color:'#d1d5db',label:'Suggested'},{color:'#374151',label:'Accepted'}]}/>
        </ChartCard>

        <ChartCard title="Feature Acceptance">
          <div className="space-y-4">
            {AI_FEATURES.map(f => (
              <div key={f.name}>
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-2">
                    <div className="w-5 h-5 rounded flex items-center justify-center" style={{ background: '#f5f5f5' }}>
                      <Zap size={10} style={{ color: '#374151' }}/>
                    </div>
                    <span className="text-[11px] font-medium text-slate-600">{f.name}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-slate-400">{f.uses.toLocaleString()}</span>
                    <span className="text-[11px] font-bold w-8 text-right text-slate-700">{f.rate}%</span>
                  </div>
                </div>
                <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                  <div className="h-full rounded-full" style={{ width:`${f.rate}%`, background: f.color }}/>
                </div>
              </div>
            ))}
          </div>
        </ChartCard>
      </div>
    </div>
  )
}

/* ════════════════════════════════════════════════════════════════
   ROOT
════════════════════════════════════════════════════════════════ */
export default function Analytics() {
  const [tab,           setTab]           = useState('chat')
  const [range,         setRange]         = useState('30d')
  const [showPicker,    setShowPicker]    = useState(false)
  const [fromDate,      setFromDate]      = useState('')
  const [toDate,        setToDate]        = useState('')
  const [selTemplateId, setSelTemplateId] = useState('all')
  const pickerRef = useRef(null)

  /* close picker on outside click */
  useEffect(() => {
    function handle(e) {
      if (pickerRef.current && !pickerRef.current.contains(e.target)) setShowPicker(false)
    }
    document.addEventListener('mousedown', handle)
    return () => document.removeEventListener('mousedown', handle)
  }, [])

  function applyCustom() {
    if (!fromDate || !toDate) return
    setRange('custom')
    setShowPicker(false)
  }

  /* label shown on the custom button */
  const customLabel = range === 'custom' && fromDate && toDate
    ? `${fromDate} â€“ ${toDate}`
    : 'Custom'

  return (
    <div className="space-y-4 animate-fade-in">

      {/* ── toolbar ── */}
      <div className="flex items-center gap-2 flex-wrap">
        {/* tabs */}
        <div className="flex items-center gap-1 bg-slate-100 rounded-xl p-1">
          {TABS.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={clsx(
                'px-3 py-1.5 rounded-lg text-[11px] font-semibold transition-all whitespace-nowrap',
                tab === t.id ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'
              )}>
              {t.label}
            </button>
          ))}
        </div>

        <div className="flex-1"/>

        {/* template filter â€” only visible on Broadcasts tab */}
        {tab === 'broadcast' && (
          <NativeSelect value={selTemplateId} onChange={e => setSelTemplateId(e.target.value)} sm className="font-semibold">
            <option value="all">All Templates</option>
            {BC_TEMPLATES.map(t => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </NativeSelect>
        )}

        {/* date range presets */}
        <div className="flex items-center gap-1 bg-slate-100 rounded-xl p-1">
          {PRESETS.map(p => (
            <button key={p.id} onClick={() => { setRange(p.id); setShowPicker(false) }}
              className={clsx(
                'px-2.5 py-1 rounded-lg text-[10px] font-semibold transition-all whitespace-nowrap',
                range === p.id ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'
              )}>
              {p.label}
            </button>
          ))}

          {/* custom date button */}
          <div className="relative" ref={pickerRef}>
            <button
              onClick={() => setShowPicker(p => !p)}
              className={clsx(
                'flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-semibold transition-all whitespace-nowrap',
                range === 'custom' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'
              )}>
              <Calendar size={10}/>
              {customLabel}
            </button>

            {/* date picker dropdown */}
            {showPicker && (
              <div className="absolute right-0 top-full mt-2 z-50 bg-white border border-surface-border rounded-xl shadow-modal p-4 w-64 animate-fade-in">
                <p className="text-[11px] font-semibold text-slate-700 mb-3">Custom Date Range</p>
                <div className="space-y-2.5">
                  <div>
                    <label className="block text-[10px] font-semibold text-slate-500 mb-1">From</label>
                    <input
                      type="date"
                      value={fromDate}
                      max={toDate || undefined}
                      onChange={e => setFromDate(e.target.value)}
                      className="w-full border border-surface-border rounded-lg px-2.5 py-1.5 text-[11px] text-slate-700 focus:outline-none focus:border-primary"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-semibold text-slate-500 mb-1">To</label>
                    <input
                      type="date"
                      value={toDate}
                      min={fromDate || undefined}
                      onChange={e => setToDate(e.target.value)}
                      className="w-full border border-surface-border rounded-lg px-2.5 py-1.5 text-[11px] text-slate-700 focus:outline-none focus:border-primary"
                    />
                  </div>
                </div>
                <div className="flex gap-2 mt-3">
                  <button
                    onClick={() => { setShowPicker(false) }}
                    className="btn-secondary flex-1 justify-center">
                    Cancel
                  </button>
                  <button
                    onClick={applyCustom}
                    disabled={!fromDate || !toDate}
                    className="btn-primary flex-1 justify-center disabled:opacity-40 disabled:cursor-not-allowed">
                    Apply
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        <button className="btn-secondary">
          <Download size={11}/> Export
        </button>
      </div>

      {/* ── content ── */}
      {tab === 'chat'      && <ChatTab range={range}/>}
      {tab === 'appt'      && <AppointmentsTab range={range}/>}
      {tab === 'broadcast' && <BroadcastsTab range={range} selTemplateId={selTemplateId} setSelTemplateId={setSelTemplateId}/>}
      {tab === 'ai'        && <AITab range={range}/>}

    </div>
  )
}
