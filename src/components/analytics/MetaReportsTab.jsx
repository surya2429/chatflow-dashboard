// MetaReportsTab.jsx — WhatsApp Analytics → "Meta Reports": the figures from Meta's own Insights page
// (messages sent / delivered, free vs paid, per-category volume and approximate charges), pulled from the
// WhatsApp Business Management API through /api/whatsapp/meta-reports.
import { useEffect, useState } from 'react'
import { Info, Loader2, AlertCircle, RefreshCw } from 'lucide-react'
import { fetchMetaReport } from '../../lib/metaReportsApi'

/* Rows every category card lists, in Meta's order. `key` is Meta's pricing category, lower-cased. */
const CATEGORY_ROWS = [
  { key: 'marketing',                  label: 'Marketing',                       color: '#06b6d4' },
  { key: 'marketing_lite',             label: 'Marketing - lite',                color: '#f59e0b' },
  { key: 'utility',                    label: 'Utility',                         color: '#db2777' },
  { key: 'authentication',             label: 'Authentication',                  color: '#f97316' },
  { key: 'authentication_international', label: 'Authentication - international', color: '#64748b' },
  { key: 'ai_provider',                label: 'AI provider',                     color: '#0891b2' },
  { key: 'service',                    label: 'Service',                         color: '#0d9488' },
]

/* Shown while no WhatsApp credentials are configured, so the layout can be reviewed. Clearly labelled. */
const SAMPLE = {
  configured: true,
  currency: 'INR',
  messages: { sent: 1626, delivered: 1606, received: 150 },
  deliveredByCategory: { marketing: 1182, utility: 280, service: 144 },
  free: { total: 144, customerService: 144, entryPoint: 0, other: 0 },
  paid: { total: 1462, byCategory: { marketing: 1182, utility: 280 } },
  charges: { total: 1055.73, byCategory: { marketing: 1023.53, utility: 32.2 } },
}

const num = (n) => (n == null ? '—' : Number(n).toLocaleString('en-US'))
const money = (n, currency) => {
  const v = Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  return currency === 'INR' ? `₹${v} INR` : `${v} ${currency}`
}

/* Unix-second window for the toolbar's range: presets end now, a custom range ends at the end of its last day. */
function windowFor(range, fromDate, toDate) {
  const now = Math.floor(Date.now() / 1000)
  if (range === 'custom' && fromDate && toDate) {
    const start = Math.floor(new Date(`${fromDate}T00:00:00`).getTime() / 1000)
    const end = Math.min(now, Math.floor(new Date(`${toDate}T23:59:59`).getTime() / 1000) + 1)
    return Number.isFinite(start) && Number.isFinite(end) && end > start ? { start, end } : null
  }
  if (range === 'today') {
    const d = new Date(); d.setHours(0, 0, 0, 0)
    return { start: Math.floor(d.getTime() / 1000), end: now }
  }
  const days = range === '7d' ? 7 : 30
  return { start: now - days * 86400, end: now }
}

function Dash({ color }) {
  return <span className="inline-block w-5 flex-shrink-0 border-t-2 border-dashed" style={{ borderColor: color }}/>
}

function Tip({ text }) {
  return <span title={text} className="inline-flex text-slate-400 cursor-help"><Info size={11}/></span>
}

function Row({ color, label, value, tip, muted }) {
  return (
    <div className="flex items-center gap-2 py-[5px] text-[11px]">
      <Dash color={color}/>
      <span className={muted ? 'text-slate-400' : 'text-slate-600'}>{label}</span>
      {tip && <Tip text={tip}/>}
      <span className="flex-1"/>
      <span className="text-slate-600 tabular-nums">{value}</span>
    </div>
  )
}

function StatCard({ title, tip, total, color, children, className = '' }) {
  return (
    <div className={`rounded-lg border border-slate-300 bg-white px-4 py-3.5 ${className}`}>
      <div className="flex items-center gap-2 pb-2.5">
        <Dash color={color}/>
        <span className="text-[12px] font-bold text-slate-800">{title}</span>
        {tip && <Tip text={tip}/>}
        <span className="flex-1"/>
        <span className="text-[13px] font-bold text-slate-900 tabular-nums">{total}</span>
      </div>
      {children}
    </div>
  )
}

export default function MetaReportsTab({ range, fromDate, toDate }) {
  const [state, setState] = useState({ loading: true, data: null, error: null })
  const [reload, setReload] = useState(0)

  useEffect(() => {
    const win = windowFor(range, fromDate, toDate)
    if (!win) { setState({ loading: false, data: null, error: 'Pick a start and end date.' }); return }
    let off = false
    setState(s => ({ ...s, loading: true, error: null }))
    fetchMetaReport(win.start, win.end)
      .then(data => !off && setState({ loading: false, data, error: null }))
      .catch(e => !off && setState({ loading: false, data: null, error: e.message }))
    return () => { off = true }
  }, [range, fromDate, toDate, reload])

  const { loading, data: live, error } = state
  const sample = live?.configured === false
  const d = sample ? SAMPLE : live

  const note = <p className="text-[11px] text-slate-500">
    <b className="font-semibold text-slate-700">Note:</b> All insights data is approximate and may differ from what's shown on your invoices due to small variations in data processing.
  </p>

  if (loading && !d) {
    return <div className="space-y-4">{note}<div className="flex items-center gap-2 text-xs text-slate-400 py-10 justify-center"><Loader2 size={14} className="animate-spin"/> Loading Meta reports…</div></div>
  }
  if (error && !d) {
    return (
      <div className="space-y-4">
        {note}
        <div className="flex items-start gap-2.5 text-xs text-red-700 bg-red-50 border border-red-200 rounded-xl p-3.5">
          <AlertCircle size={14} className="flex-shrink-0 mt-0.5"/>
          <div className="flex-1">
            <p className="font-semibold">Couldn't load Meta reports</p>
            <p className="mt-0.5">{error}</p>
          </div>
          <button onClick={() => setReload(n => n + 1)} className="inline-flex items-center gap-1 font-semibold underline"><RefreshCw size={11}/> Retry</button>
        </div>
      </div>
    )
  }

  const cur = d.currency || 'INR'
  /* Anything Meta reports in a category not listed above still counts toward the totals; show it as "Other". */
  const known = new Set(CATEGORY_ROWS.map(r => r.key))
  const otherOf = (map) => Object.entries(map || {}).filter(([k]) => !known.has(k)).reduce((n, [, v]) => n + v, 0)
  const catRows = (map, fmt) => {
    const rows = CATEGORY_ROWS.map(r => <Row key={r.key} color={r.color} label={r.label} value={fmt(map?.[r.key] ?? 0)}/>)
    const other = otherOf(map)
    if (other > 0) rows.push(<Row key="other" color="#94a3b8" label="Other" value={fmt(other)}/>)
    return rows
  }

  return (
    <div className="space-y-4">
      {sample && (
        <div className="flex items-start gap-2.5 text-[11px] text-amber-800 bg-amber-50 border border-amber-200 rounded-xl p-3 leading-relaxed">
          <Info size={13} className="flex-shrink-0 mt-0.5"/>
          <span><b>Sample data.</b> Your WhatsApp Business Account isn't connected to the reports API yet. Set <code className="font-mono">WA_BUSINESS_ACCOUNT_ID</code> and <code className="font-mono">WA_ACCESS_TOKEN</code> on the server to see your real Meta numbers here.</span>
        </div>
      )}
      {error && <div className="text-[11px] text-red-600">Couldn't refresh: {error}</div>}
      {note}

      <div className={`space-y-4 transition-opacity ${loading ? 'opacity-50' : ''}`}>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 items-start">
          <StatCard title="All messages" color="#6d28d9" total="">
            <Row color="#db2777" label="Messages sent" tip="Messages sent from your WhatsApp Business Account." value={num(d.messages.sent)}/>
            <Row color="#22d3ee" label="Messages delivered" tip="Messages that reached the customer's device." value={num(d.messages.delivered)}/>
            <Row color="#a16207" label="Messages received" tip="Meta's reporting API doesn't return inbound counts, so this shows — when it isn't available." value={num(d.messages.received)}/>
          </StatCard>

          <StatCard title="Messages delivered" tip="Delivered messages by pricing category, free and paid together." color="#0d9488" total={num(d.messages.delivered)}>
            {catRows(d.deliveredByCategory, num)}
          </StatCard>

          <StatCard title="Free messages delivered" tip="Messages that cost nothing: replies inside the 24-hour customer service window and click-to-WhatsApp entry points." color="#6d28d9" total={num(d.free.total)}>
            <Row color="#22d3ee" label="Free customer service" tip="Replies within the 24-hour customer service window." value={num(d.free.customerService)}/>
            <Row color="#db2777" label="Free entry point" tip="Conversations started from a Click-to-WhatsApp ad or Facebook Page button." value={num(d.free.entryPoint)}/>
            {d.free.other > 0 && <Row color="#94a3b8" label="Other free" value={num(d.free.other)}/>}
          </StatCard>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start max-w-[820px]">
          <StatCard title="Paid messages delivered" tip="Delivered messages that Meta charges for." color="#6d28d9" total={num(d.paid.total)}>
            {catRows(d.paid.byCategory, num)}
          </StatCard>
          <StatCard title="Approximate total charges" tip="Estimated from Meta's pricing for the period. Your invoice is the final figure." color="#6d28d9" total={money(d.charges.total, cur)}>
            {catRows(d.charges.byCategory, v => money(v, cur))}
          </StatCard>
        </div>
      </div>
    </div>
  )
}
