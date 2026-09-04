import { useState, useRef, useEffect } from 'react'
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts'
import clsx from 'clsx'
import {
  ArrowUpRight, ArrowDownRight, Maximize2, ChevronDown, Calendar, Download,
  Wifi, MessageSquare, RefreshCw, Coffee, Star, AlertTriangle, Zap,
} from 'lucide-react'

/* ─── date range presets (identical to WhatsApp Analytics) ──────── */
export const PRESETS = [
  { id: 'today', label: 'Today'   },
  { id: '7d',    label: '7 Days'  },
  { id: '30d',   label: '30 Days' },
]

/** Scale a 30-day-total number down to what it'd look like for the selected preset. */
export function scaleForRange(value, range) {
  const factor = range === 'today' ? 1 / 30 : range === '7d' ? 7 / 30 : 1
  return Math.max(1, Math.round(value * factor))
}

/* ─── toolbar: pill tabs + date range presets + custom picker + export ── */
export function AnalyticsToolbar({ tabs, tab, setTab, range, setRange, rightExtra }) {
  const [showPicker, setShowPicker] = useState(false)
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')
  const pickerRef = useRef(null)

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

  const customLabel = range === 'custom' && fromDate && toDate ? `${fromDate} – ${toDate}` : 'Custom'

  return (
    <div className="flex items-center gap-2 flex-wrap">
      {/* tabs */}
      <div className="flex items-center gap-1 bg-slate-100 rounded-xl p-1">
        {tabs.map(t => (
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

      {rightExtra}

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
                <button onClick={() => setShowPicker(false)} className="btn-secondary flex-1 justify-center">Cancel</button>
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
  )
}

/* ─── tooltip ───────────────────────────────────────────────────── */
export const ChartTip = ({ active, payload, label }) => {
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
export function MetricCard({ icon: Icon, label, value, sub, trend, warn = false, onExpand }) {
  const up = trend > 0
  return (
    <div className={clsx(
      'bg-white border rounded-xl p-4 flex flex-col gap-2.5 group relative',
      warn ? 'border-red-200' : 'border-surface-border',
      onExpand && 'cursor-pointer hover:shadow-sm transition-shadow'
    )} onClick={onExpand}>
      <div className="flex items-center justify-between">
        <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: '#f5f5f5' }}>
          <Icon size={13} style={{ color: warn ? '#ef4444' : '#374151' }}/>
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
        <p className={clsx('text-[20px] font-bold leading-none', warn ? 'text-red-500' : 'text-slate-800')}>{value}</p>
        <p className="text-[10px] font-medium text-slate-400 mt-1">{label}</p>
        {sub && <p className="text-[9px] text-slate-300 mt-0.5">{sub}</p>}
      </div>
    </div>
  )
}

/* ─── chart card ─────────────────────────────────────────────────── */
export function ChartCard({ title, sub, right, children, noPad = false, className = '' }) {
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
export function Legend({ items }) {
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
export function SLabel({ children, open, onToggle }) {
  return (
    <div className="flex items-center justify-between mb-2 cursor-pointer group select-none" onClick={onToggle}>
      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">{children}</p>
      <span className={clsx(
        'flex items-center justify-center w-5 h-5 rounded-md text-slate-400 transition-all duration-200',
        'group-hover:bg-slate-100', open ? 'rotate-180' : 'rotate-0'
      )}>
        <ChevronDown size={12}/>
      </span>
    </div>
  )
}

/* ─── collapsible KPI section (Chat Volume / Live Agents / Engagement & Quality) ── */
export function KPISection({ title, open, onToggle, children }) {
  return (
    <div>
      <SLabel open={open} onToggle={onToggle}>{title}</SLabel>
      {open && <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">{children}</div>}
    </div>
  )
}

/* ─── ranked horizontal bar breakdown (option-wise style) ───────── */
export function RankedBarChart({ title, sub, data, unit = '' }) {
  const sorted = [...data].sort((a, b) => b.count - a.count)
  const total = sorted.reduce((s, d) => s + d.count, 0)
  const maxCount = sorted[0]?.count || 1
  return (
    <ChartCard title={title} sub={sub}>
      <div className="space-y-2.5">
        {sorted.map((opt, i) => {
          const pct = total ? Math.round((opt.count / total) * 100) : 0
          const barW = Math.round((opt.count / maxCount) * 100)
          return (
            <div key={opt.name} className="flex items-center gap-3">
              <span className="text-[10px] font-bold text-slate-300 w-3 flex-shrink-0 text-right">{i + 1}</span>
              <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: opt.color }}/>
              <span className="w-32 text-[11px] font-semibold text-slate-700 truncate flex-shrink-0">{opt.name}</span>
              <div className="flex-1 h-7 bg-slate-50 border border-slate-100 rounded-lg overflow-hidden relative">
                <div className="absolute inset-y-0 left-0 rounded-lg flex items-center transition-all duration-500"
                  style={{ width: `${barW}%`, background: `linear-gradient(90deg, ${opt.color}28, ${opt.color})` }}>
                  {barW > 22 && <span className="text-[10px] font-bold text-white ml-auto pr-2.5">{opt.count}{unit}</span>}
                </div>
                {barW <= 22 && <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] font-bold text-slate-600">{opt.count}{unit}</span>}
              </div>
              <span className="text-[13px] font-bold text-slate-700 w-9 text-right flex-shrink-0">{pct}%</span>
            </div>
          )
        })}
      </div>
    </ChartCard>
  )
}

/* ─── funnel ─────────────────────────────────────────────────────── */
export function FunnelChart({ title, sub, steps }) {
  const first = steps[0]?.value || 1
  return (
    <ChartCard title={title} sub={sub}>
      <div className="space-y-2">
        {steps.map((s, i) => {
          const pct = Math.round((s.value / first) * 100)
          const prev = i > 0 ? steps[i - 1].value : s.value
          const dropoff = i > 0 ? Math.round(((prev - s.value) / prev) * 100) : 0
          return (
            <div key={s.label}>
              <div className="flex items-center justify-between mb-1">
                <span className="text-[11px] font-semibold text-slate-700">{s.label}</span>
                <div className="flex items-center gap-2">
                  {i > 0 && dropoff > 0 && (
                    <span className="text-[9px] font-bold text-red-500 bg-red-50 px-1.5 py-0.5 rounded-full">-{dropoff}%</span>
                  )}
                  <span className="text-[11px] font-bold text-slate-800">{s.value.toLocaleString()}</span>
                </div>
              </div>
              <div className="h-5 bg-slate-50 border border-slate-100 rounded-md overflow-hidden">
                <div className="h-full rounded-md transition-all duration-500" style={{ width: `${pct}%`, background: s.color || '#0066ff' }}/>
              </div>
            </div>
          )
        })}
      </div>
    </ChartCard>
  )
}

/* ─── response time distribution ─────────────────────────────────── */
export function ResponseTimeChart({ title = 'Response Time Distribution', sub, buckets }) {
  const max = Math.max(...buckets.map(b => b.count))
  return (
    <ChartCard title={title} sub={sub}>
      <div className="space-y-2.5">
        {buckets.map(b => (
          <div key={b.label} className="flex items-center gap-3">
            <span className="w-16 text-[10px] font-semibold text-slate-500 flex-shrink-0">{b.label}</span>
            <div className="flex-1 h-6 bg-slate-50 border border-slate-100 rounded-lg overflow-hidden relative">
              <div className="absolute inset-y-0 left-0 rounded-lg" style={{ width: `${(b.count / max) * 100}%`, background: b.color || '#60a5fa' }}/>
              <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] font-bold text-slate-600">{b.count}%</span>
            </div>
          </div>
        ))}
      </div>
    </ChartCard>
  )
}

/* ─── live agent roster ──────────────────────────────────────────── */
const STATUS_CFG = {
  online:  { dot: 'bg-emerald-400', text: 'text-emerald-600', label: 'Online'  },
  busy:    { dot: 'bg-amber-400',   text: 'text-amber-600',   label: 'Busy'    },
  break:   { dot: 'bg-blue-400',    text: 'text-blue-600',    label: 'Break'   },
  offline: { dot: 'bg-slate-300',   text: 'text-slate-400',   label: 'Offline' },
}
export function StatusDot({ status }) {
  const c = STATUS_CFG[status] || STATUS_CFG.offline
  return (
    <span className={clsx('inline-flex items-center gap-1 text-[10px] font-medium', c.text)}>
      <span className={clsx('w-1.5 h-1.5 rounded-full', c.dot)}/>{c.label}
    </span>
  )
}

/* ─── realtime agent analytics: live KPI strip + full roster table ── */
export function RealtimeAgentSection({ title = 'Realtime Agent Analytics', agents }) {
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

  const rtOnline = agents.filter(a => a.status === 'online').length
  const rtActive = agents.reduce((s, a) => s + a.active, 0)
  const rtQueue  = agents.reduce((s, a) => s + a.queue, 0)
  const rtBreak  = agents.filter(a => a.status === 'break').length

  return (
    <div>
      <div className="flex items-center gap-2 mb-2 flex-wrap">
        <SLabel>{title}</SLabel>
        <span className="flex items-center gap-1 text-[9px] font-bold text-emerald-600 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full -mt-2">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"/>LIVE
        </span>
        <div className="ml-auto flex items-center gap-2 -mt-2">
          <span className="text-[9px] text-slate-400">{secAgo === 0 ? 'Just synced' : `Synced ${secAgo}s ago`}</span>
          <button onClick={handleSync} disabled={syncing}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-slate-200 bg-white text-[10px] font-semibold text-slate-600 hover:bg-slate-50 transition-colors disabled:opacity-60">
            <RefreshCw size={10} className={syncing ? 'animate-spin' : ''}/>
            {syncing ? 'Syncing…' : 'Sync Now'}
          </button>
        </div>
      </div>

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
              {agents.map(a => (
                <tr key={a.name} className="hover:bg-slate-50/60 transition-colors">
                  <td className="pl-4 pr-3 py-3">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-full flex items-center justify-center text-white text-[9px] font-bold flex-shrink-0 bg-slate-600">{a.avatar}</div>
                      <span className="font-semibold text-slate-700 whitespace-nowrap">{a.name}</span>
                    </div>
                  </td>
                  <td className="px-3 py-3"><StatusDot status={a.status}/></td>
                  <td className="px-3 py-3"><span className={clsx('font-bold text-[13px]', a.active > 4 ? 'text-red-500' : a.active > 0 ? 'text-slate-700' : 'text-slate-300')}>{a.active || '—'}</span></td>
                  <td className="px-3 py-3"><span className={clsx('font-bold text-[13px]', a.queue > 2 ? 'text-amber-500' : a.queue > 0 ? 'text-slate-700' : 'text-slate-300')}>{a.queue || '—'}</span></td>
                  <td className="px-3 py-3 text-slate-500">{a.avgReply}</td>
                  <td className="px-3 py-3 text-slate-500">{a.avgHandle}</td>
                  <td className="px-3 py-3"><span className={clsx(a.longest !== '—' && parseInt(a.longest) > 25 ? 'text-red-400 font-semibold' : 'text-slate-500')}>{a.longest}</span></td>
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
                      : <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-emerald-50 text-emerald-600 text-[9px] font-bold">✓ OK</span>}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="bg-slate-50 border-t border-surface-border">
                <td className="pl-4 pr-3 py-2.5 text-[9px] font-bold text-slate-500 uppercase tracking-wide">Team Total</td>
                <td/>
                <td className="px-3 py-2.5 font-bold text-slate-700">{agents.reduce((s,a)=>s+a.active,0)}</td>
                <td className="px-3 py-2.5 font-bold text-slate-700">{agents.reduce((s,a)=>s+a.queue,0)}</td>
                <td colSpan={3}/>
                <td className="px-3 py-2.5 font-bold text-emerald-600">{agents.reduce((s,a)=>s+a.resolved,0)}</td>
                <td className="px-3 py-2.5 font-bold text-slate-700">{agents.reduce((s,a)=>s+a.transferred,0)}</td>
                <td className="px-3 py-2.5 text-[10px] text-slate-500">★ {(agents.filter(a=>a.csat>0).reduce((s,a)=>s+a.csat,0)/Math.max(agents.filter(a=>a.csat>0).length,1)).toFixed(1)} avg</td>
                <td className="px-3 py-2.5 text-[10px] font-bold text-red-500">{agents.reduce((s,a)=>s+a.sla,0)} total</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  )
}

/* ─── CSAT trend (daily rolling average) ─────────────────────────── */
export function CsatTrendChart({ title = 'CSAT Trend', sub = 'Daily average rating out of 5', data }) {
  return (
    <ChartCard title={title} sub={sub} noPad>
      <div className="h-40 px-2 pt-3">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 4, right: 12, left: -18, bottom: 0 }}>
            <defs>
              <linearGradient id="csatGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#F59E0B" stopOpacity={0.3}/><stop offset="95%" stopColor="#F59E0B" stopOpacity={0}/>
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9"/>
            <XAxis dataKey="date" tick={{ fontSize: 9, fill: '#94a3b8' }} axisLine={false} tickLine={false}/>
            <YAxis domain={[0, 5]} tick={{ fontSize: 9, fill: '#94a3b8' }} axisLine={false} tickLine={false}/>
            <Tooltip content={<ChartTip/>}/>
            <Area type="monotone" dataKey="csat" name="CSAT" stroke="#F59E0B" fill="url(#csatGrad)" strokeWidth={2}/>
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </ChartCard>
  )
}

/* ─── daily volume: total / bot handled / handed-off, area chart ──── */
export function DailyVolumeChart({ title = 'Daily Volume', sub = 'Volume breakdown over time', data, range }) {
  return (
    <ChartCard title={title} sub={sub}
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
            {[{id:'dvT',c:'#374151'},{id:'dvB',c:'#6b7280'},{id:'dvH',c:'#9ca3af'}].map(g => (
              <linearGradient key={g.id} id={g.id} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={g.c} stopOpacity={0.15}/><stop offset="100%" stopColor={g.c} stopOpacity={0}/>
              </linearGradient>
            ))}
          </defs>
          <CartesianGrid strokeDasharray="2 4" stroke="#f1f5f9" vertical={false}/>
          <XAxis dataKey="date" tick={{ fontSize:9, fill:'#94a3b8' }} tickLine={false} axisLine={false} interval={range === '30d' ? 5 : 0}/>
          <YAxis tick={{ fontSize:9, fill:'#94a3b8' }} tickLine={false} axisLine={false}/>
          <Tooltip content={<ChartTip/>}/>
          <Area type="monotone" dataKey="total"   name="Total"           stroke="#374151" strokeWidth={2}   fill="url(#dvT)" dot={false}/>
          <Area type="monotone" dataKey="bot"     name="Bot Handled"     stroke="#6b7280" strokeWidth={1.5} fill="url(#dvB)" dot={false}/>
          <Area type="monotone" dataKey="handoff" name="Handoff to Agents" stroke="#9ca3af" strokeWidth={1.5} fill="url(#dvH)" dot={false}/>
        </AreaChart>
      </ResponsiveContainer>
    </ChartCard>
  )
}

/* ─── time-of-day chart with Day/Week/Month/Year toggle ──────────── */
export function TimingChart({ title, sub, blocksByRange, unitLabel = 'items' }) {
  const [vtRange, setVtRange] = useState('Day')
  const vtRanges = ['Day', 'Week', 'Month', 'Year']
  const blocks = blocksByRange[vtRange]
  const total = blocks.reduce((s, b) => s + b.value, 0)
  const peak  = blocks.reduce((a, b) => b.value > a.value ? b : a, blocks[0])
  const yMax  = Math.ceil(peak.value / 20) * 20 || 1

  return (
    <div className="bg-white border border-surface-border rounded-xl overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-surface-border">
        <div>
          <p className="text-[12px] font-semibold text-slate-700">{title}</p>
          <p className="text-[10px] text-slate-400 mt-0.5">{sub}</p>
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
          {total.toLocaleString()} {unitLabel}
        </span>
        <span className="flex items-center gap-1.5 bg-white border border-blue-200 text-blue-600 text-[11px] font-semibold px-2.5 py-1 rounded-full">
          <Zap size={10} className="fill-blue-500"/>
          Peak {peak.label} · {peak.value.toLocaleString()}
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

/* ─── source breakdown: daily heatmap grid table with CSV export ─── */
export function SourceBreakdownChart({ title, sub, sources, days }) {
  const maxVal = Math.max(...sources.flatMap(r => r.days))
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
  const colTotals = days.map((_, di) => sources.reduce((s, r) => s + (r.days[di] || 0), 0))
  const grandTotal = sources.reduce((s, r) => s + r.total, 0)

  const downloadRow = (src) => {
    const header = ['Source', ...days, 'Total']
    const row = [src.name, ...src.days, src.total]
    const csv = [header, row].map(r => r.join(',')).join('\n')
    const a = document.createElement('a')
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }))
    a.download = `${title.toLowerCase().replace(/\s+/g, '-')}-${src.name.toLowerCase().replace(/\s+/g, '-')}.csv`
    a.click()
  }

  return (
    <div className="bg-white border border-surface-border rounded-xl overflow-hidden">
      <div className="flex items-center justify-between px-5 py-3.5 border-b border-surface-border">
        <div>
          <p className="text-[13px] font-semibold text-slate-800">{title}</p>
          <p className="text-[10px] text-slate-400 mt-0.5">{sub}</p>
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="text-[11px] border-collapse" style={{ width: 'max-content' }}>
          <thead>
            <tr className="border-b border-slate-100">
              <th className="sticky left-0 z-20 bg-white px-4 py-2.5 text-left text-[9px] font-bold text-slate-400 uppercase tracking-wider w-28 whitespace-nowrap">Source</th>
              {days.map(d => (
                <th key={d} className="px-0 py-2.5 text-center text-[9px] font-medium text-slate-400 w-9" style={{ minWidth: 32 }}>{d}</th>
              ))}
              <th className="bg-amber-50 px-3 py-2.5 text-center text-[9px] font-bold text-amber-500 uppercase tracking-wider whitespace-nowrap border-l border-amber-100">TOTAL</th>
            </tr>
          </thead>
          <tbody>
            {sources.map((src, ri) => (
              <tr key={src.name} className={clsx('group border-b border-slate-100', ri % 2 === 1 && 'bg-slate-50/40')}>
                <td className="sticky left-0 z-10 bg-inherit px-4 py-1.5 font-semibold text-slate-700 whitespace-nowrap">
                  <div className="flex items-center justify-between gap-3 pr-1">
                    <span>{src.name}</span>
                    <button onClick={() => downloadRow(src)}
                      className="opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0 inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded border border-slate-200 bg-white text-[8px] font-semibold text-slate-400 hover:text-slate-600 hover:bg-slate-50">
                      <Download size={8}/> CSV
                    </button>
                  </div>
                </td>
                {src.days.map((v, di) => {
                  const bg = cellBg(v)
                  return (
                    <td key={di} className="px-0.5 py-1 text-center border-r border-slate-100/60" style={{ minWidth: 32 }}>
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
              <td className="sticky left-0 z-20 bg-emerald-50 px-4 py-2 font-bold text-emerald-600 text-[10px] whitespace-nowrap">Total</td>
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
