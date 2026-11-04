// MetaReportsTab.jsx — WhatsApp Analytics → "Meta Reports": the figures from Meta's own Insights page
// (messages sent / delivered, free vs paid, per-category volume and approximate charges), pulled from the
// WhatsApp Business Management API through /api/whatsapp/meta-reports.
//
// Two looks for the same numbers, switchable in the header (the choice is remembered):
//   Dashboard view — headline tiles → free-vs-paid donut + charges split → one breakdown table, styled like
//                    the other Analytics tabs.
//   Meta view      — the five outlined cards of Meta's own Insights page, in the same order and wording.
import { useEffect, useMemo, useState } from 'react'
import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts'
import clsx from 'clsx'
import { Send, CheckCheck, MessageSquare, Gift, CreditCard, Receipt, Info, Loader2, AlertCircle, RefreshCw } from 'lucide-react'
import { fetchMetaReport } from '../../lib/metaReportsApi'

/* Categories in Meta's order. `key` is Meta's pricing category, lower-cased. */
const CATEGORIES = [
  { key: 'marketing',                    label: 'Marketing',                       color: '#0066ff' },
  { key: 'utility',                      label: 'Utility',                         color: '#8B5CF6' },
  { key: 'authentication',               label: 'Authentication',                  color: '#F59E0B' },
  { key: 'service',                      label: 'Service',                         color: '#22C55E' },
  { key: 'marketing_lite',               label: 'Marketing - lite',                color: '#06b6d4' },
  { key: 'authentication_international', label: 'Authentication - international',  color: '#fb923c' },
  { key: 'ai_provider',                  label: 'AI provider',                     color: '#ec4899' },
]
/* Meta's own order and line colours, for the Meta view. */
const META_ROWS = [
  { key: 'marketing',                    label: 'Marketing',                      color: '#06b6d4' },
  { key: 'marketing_lite',               label: 'Marketing - lite',               color: '#f59e0b' },
  { key: 'utility',                      label: 'Utility',                        color: '#db2777' },
  { key: 'authentication',               label: 'Authentication',                 color: '#f97316' },
  { key: 'authentication_international', label: 'Authentication - international', color: '#64748b' },
  { key: 'ai_provider',                  label: 'AI provider',                    color: '#0891b2' },
  { key: 'service',                      label: 'Service',                        color: '#0d9488' },
]
const FREE_COLOR = '#22C55E'
const PAID_COLOR = '#0066ff'

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
const pct = (a, b) => (b > 0 ? `${((a / b) * 100).toFixed(a / b >= 0.1 ? 0 : 1)}%` : '0%')
const money = (n, currency) => {
  const v = Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  return currency === 'INR' ? `₹${v}` : `${v} ${currency}`
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

function Tip({ text }) {
  return <span title={text} className="inline-flex text-slate-300 hover:text-slate-500 cursor-help"><Info size={11}/></span>
}

/* Same look as the other tabs' metric tiles, with a hint line under the label. */
function Tile({ icon: Icon, label, value, hint, tip, color }) {
  return (
    <div className="bg-white border border-surface-border rounded-xl p-4 flex flex-col gap-2.5">
      <div className="flex items-center justify-between">
        <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: color + '14' }}>
          <Icon size={13} style={{ color }}/>
        </div>
        {tip && <Tip text={tip}/>}
      </div>
      <div>
        <p className="text-[20px] font-bold leading-none text-slate-800 tabular-nums">{value}</p>
        <p className="text-[10px] font-medium text-slate-400 mt-1">{label}</p>
        {hint && <p className="text-[10px] text-slate-400/80 mt-0.5">{hint}</p>}
      </div>
    </div>
  )
}

function Card({ title, sub, right, children, className = '' }) {
  return (
    <div className={clsx('bg-white border border-surface-border rounded-xl overflow-hidden flex flex-col', className)}>
      <div className="flex items-center justify-between px-4 py-3 border-b border-surface-border">
        <div>
          <p className="text-[12px] font-semibold text-slate-700">{title}</p>
          {sub && <p className="text-[10px] text-slate-400 mt-0.5">{sub}</p>}
        </div>
        {right}
      </div>
      <div className="flex-1">{children}</div>
    </div>
  )
}

/* ── Meta view: the cards as Meta's Insights page lays them out ───────────── */
function Dash({ color }) {
  return <span className="inline-block w-5 flex-shrink-0 border-t-2 border-dashed" style={{ borderColor: color }}/>
}
function MRow({ color, label, value, tip }) {
  return (
    <div className="flex items-center gap-2 h-[34px] text-[11px]">
      <Dash color={color}/>
      <span className="text-slate-600 truncate">{label}</span>
      {tip && <Tip text={tip}/>}
      <span className="flex-1"/>
      <span className="text-slate-700 tabular-nums font-medium">{value}</span>
    </div>
  )
}
function MCard({ title, tip, total, color, children, className = '' }) {
  return (
    <div className={clsx('rounded-xl border border-slate-300 bg-white flex flex-col h-full overflow-hidden', className)}>
      <div className="flex items-center gap-2 h-[46px] px-4 border-b border-slate-200 bg-slate-50/70 flex-shrink-0">
        <Dash color={color}/>
        <span className="text-[12px] font-bold text-slate-800 truncate">{title}</span>
        {tip && <Tip text={tip}/>}
        <span className="flex-1"/>
        <span className="text-[14px] font-bold text-slate-900 tabular-nums">{total}</span>
      </div>
      <div className="px-4 py-1.5 divide-y divide-slate-100 flex-1">{children}</div>
    </div>
  )
}
function MetaView({ d, cur }) {
  const known = new Set(META_ROWS.map(r => r.key))
  const other = (map) => Object.entries(map || {}).filter(([k]) => !known.has(k)).reduce((n, [, v]) => n + v, 0)
  const list = (map, fmt) => {
    const out = META_ROWS.map(r => <MRow key={r.key} color={r.color} label={r.label} value={fmt(map?.[r.key] ?? 0)}/>)
    if (other(map) > 0) out.push(<MRow key="other" color="#94a3b8" label="Other" value={fmt(other(map))}/>)
    return out
  }
  const cash = (v) => (cur === 'INR' ? `₹${v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} INR` : `${v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${cur}`)
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4 items-stretch">
        <MCard className="lg:col-span-2" title="All messages" color="#6d28d9" total="">
          <MRow color="#db2777" label="Messages sent" tip="Messages sent from your WhatsApp Business Account." value={num(d.messages.sent)}/>
          <MRow color="#22d3ee" label="Messages delivered" tip="Messages that reached the customer's device." value={num(d.messages.delivered)}/>
          <MRow color="#a16207" label="Messages received" tip="Meta's reporting API doesn't return inbound counts, so this shows a dash when it isn't available." value={num(d.messages.received)}/>
        </MCard>
        <MCard className="lg:col-span-2" title="Messages delivered" tip="Delivered messages by pricing category, free and paid together." color="#0d9488" total={num(d.messages.delivered)}>
          {list(d.deliveredByCategory, num)}
        </MCard>
        <MCard className="lg:col-span-2" title="Free messages delivered" tip="Replies inside the 24-hour customer service window and click-to-WhatsApp entry points cost nothing." color="#6d28d9" total={num(d.free.total)}>
          <MRow color="#22d3ee" label="Free customer service" tip="Replies within the 24-hour customer service window." value={num(d.free.customerService)}/>
          <MRow color="#db2777" label="Free entry point" tip="Conversations started from a Click-to-WhatsApp ad or Facebook Page button." value={num(d.free.entryPoint)}/>
          {d.free.other > 0 && <MRow color="#94a3b8" label="Other free" value={num(d.free.other)}/>}
        </MCard>
        <MCard className="lg:col-span-3" title="Paid messages delivered" tip="Delivered messages that Meta charges for." color="#6d28d9" total={num(d.paid.total)}>
          {list(d.paid.byCategory, num)}
        </MCard>
        <MCard className="md:col-span-2 lg:col-span-3" title="Approximate total charges" tip="Estimated from Meta's pricing for this period. Your invoice is the final figure." color="#6d28d9" total={cash(d.charges.total)}>
          {list(d.charges.byCategory, cash)}
        </MCard>
    </div>
  )
}

/* The header's two-way switch; the choice sticks across visits. */
const VIEW_KEY = 'chatflow_meta_reports_view'
function loadView() {
  try { return localStorage.getItem(VIEW_KEY) === 'meta' ? 'meta' : 'dashboard' } catch { return 'dashboard' }
}

export default function MetaReportsTab({ range, fromDate, toDate }) {
  const [state, setState] = useState({ loading: true, data: null, error: null })
  const [reload, setReload] = useState(0)
  const [view, setViewState] = useState(loadView)
  const setView = (v) => { setViewState(v); try { localStorage.setItem(VIEW_KEY, v) } catch { /* private mode: just not remembered */ } }

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

  /* One row per category (plus "Other" for any category Meta reports that isn't listed above). */
  const rows = useMemo(() => {
    if (!d) return []
    const known = new Set(CATEGORIES.map(c => c.key))
    const sumOther = (map) => Object.entries(map || {}).filter(([k]) => !known.has(k)).reduce((n, [, v]) => n + v, 0)
    const list = CATEGORIES.map(c => ({
      key: c.key, label: c.label, color: c.color,
      delivered: d.deliveredByCategory?.[c.key] ?? 0,
      paid: d.paid.byCategory?.[c.key] ?? 0,
      charges: d.charges.byCategory?.[c.key] ?? 0,
    }))
    const other = { key: 'other', label: 'Other', color: '#94a3b8', delivered: sumOther(d.deliveredByCategory), paid: sumOther(d.paid.byCategory), charges: sumOther(d.charges.byCategory) }
    if (other.delivered || other.paid || other.charges) list.push(other)
    return list.map(r => ({ ...r, free: Math.max(0, r.delivered - r.paid) }))
  }, [d])

  const header = (
    <div className="flex items-start justify-between gap-3 flex-wrap">
      <div>
        <h2 className="text-[13px] font-bold text-slate-800 flex items-center gap-2">
          Meta Reports
          {sample && <span className="text-[9px] font-bold uppercase tracking-wide text-amber-700 bg-amber-100 rounded-full px-2 py-0.5">Sample data</span>}
        </h2>
        <p className="text-[11px] text-slate-400 mt-0.5">Message volume and charges straight from Meta's WhatsApp Business API. Figures are approximate and can differ slightly from your invoices.</p>
      </div>
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-1 bg-slate-100 rounded-xl p-1" role="group" aria-label="Report layout">
          {[['dashboard', 'Dashboard view'], ['meta', 'Meta view']].map(([id, label]) => (
            <button key={id} onClick={() => setView(id)} aria-pressed={view === id}
              className={clsx('px-2.5 py-1 rounded-lg text-[10px] font-semibold transition-all whitespace-nowrap', view === id ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700')}>
              {label}
            </button>
          ))}
        </div>
        <button onClick={() => setReload(n => n + 1)} disabled={loading}
          className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-surface-border text-[11px] font-semibold text-slate-500 hover:bg-slate-50 disabled:opacity-50">
          <RefreshCw size={11} className={loading ? 'animate-spin' : ''}/> Refresh
        </button>
      </div>
    </div>
  )

  if (loading && !d) {
    return <div className="space-y-4">{header}<div className="flex items-center gap-2 text-xs text-slate-400 py-16 justify-center"><Loader2 size={14} className="animate-spin"/> Loading Meta reports…</div></div>
  }
  if (error && !d) {
    return (
      <div className="space-y-4">
        {header}
        <div className="flex items-start gap-2.5 text-xs text-red-700 bg-red-50 border border-red-200 rounded-xl p-4">
          <AlertCircle size={14} className="flex-shrink-0 mt-0.5"/>
          <div className="flex-1">
            <p className="font-semibold">Couldn't load Meta reports</p>
            <p className="mt-0.5 text-red-600">{error}</p>
          </div>
          <button onClick={() => setReload(n => n + 1)} className="font-semibold underline">Retry</button>
        </div>
      </div>
    )
  }

  const cur = d.currency || 'INR'
  const { sent, delivered, received } = d.messages
  const paidTotal = d.paid.total
  const freeTotal = d.free.total
  const chargeRows = rows.filter(r => r.charges > 0).sort((a, b) => b.charges - a.charges)
  const donut = [{ name: 'Free', value: freeTotal, color: FREE_COLOR }, { name: 'Paid', value: paidTotal, color: PAID_COLOR }].filter(x => x.value > 0)
  const tableRows = rows.filter(r => r.delivered || r.paid || r.charges)
  const maxCharge = Math.max(...chargeRows.map(r => r.charges), 1)

  return (
    <div className="space-y-4">
      {header}

      {sample && (
        <div className="flex items-start gap-2.5 text-[11px] text-amber-800 bg-amber-50 border border-amber-200 rounded-xl px-3.5 py-2.5 leading-relaxed">
          <Info size={13} className="flex-shrink-0 mt-0.5"/>
          <span>Your WhatsApp Business Account isn't connected to the reports API yet, so these are example numbers. Set <code className="font-mono bg-white/60 px-1 rounded">WA_BUSINESS_ACCOUNT_ID</code> and <code className="font-mono bg-white/60 px-1 rounded">WA_ACCESS_TOKEN</code> on the server to see your real Meta data.</span>
        </div>
      )}
      {error && <p className="text-[11px] text-red-600">Couldn't refresh: {error}</p>}

      <div className={clsx('space-y-4 transition-opacity', loading && 'opacity-50')}>
        {view === 'meta' ? <MetaView d={d} cur={cur}/> : (<>
        {/* headline numbers */}
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
          <Tile icon={Send} color="#0066ff" label="Messages sent" value={num(sent)} tip="Messages sent from your WhatsApp Business Account."/>
          <Tile icon={CheckCheck} color="#22C55E" label="Messages delivered" value={num(delivered)} hint={`${pct(delivered, sent)} delivery rate`} tip="Messages that reached the customer's device."/>
          <Tile icon={MessageSquare} color="#8B5CF6" label="Messages received" value={num(received)} hint={received == null ? 'Not provided by Meta' : undefined}
            tip="Meta's reporting API doesn't return inbound message counts, so this can show a dash."/>
          <Tile icon={Gift} color="#22C55E" label="Free delivered" value={num(freeTotal)} hint={`${pct(freeTotal, delivered)} of delivered`} tip="Replies within the 24-hour customer service window and click-to-WhatsApp entry points cost nothing."/>
          <Tile icon={CreditCard} color="#0066ff" label="Paid delivered" value={num(paidTotal)} hint={`${pct(paidTotal, delivered)} of delivered`} tip="Delivered messages that Meta charges for."/>
          <Tile icon={Receipt} color="#F59E0B" label="Approx. total charges" value={money(d.charges.total, cur)} hint={paidTotal > 0 ? `${money(d.charges.total / paidTotal, cur)} per paid message` : undefined}
            tip="Estimated from Meta's pricing for this period. Your invoice is the final figure."/>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
          {/* free vs paid */}
          <Card title="Free vs paid" sub="Delivered messages" className="lg:col-span-2">
            <div className="p-4 flex items-center gap-5">
              <div className="relative w-[132px] h-[132px] flex-shrink-0">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={donut.length ? donut : [{ name: 'None', value: 1, color: '#f1f5f9' }]} dataKey="value" innerRadius={44} outerRadius={62} paddingAngle={donut.length > 1 ? 2 : 0} stroke="none" startAngle={90} endAngle={-270}>
                      {(donut.length ? donut : [{ color: '#f1f5f9' }]).map((x, i) => <Cell key={i} fill={x.color}/>)}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                  <span className="text-[17px] font-bold text-slate-800 tabular-nums leading-none">{num(delivered)}</span>
                  <span className="text-[9px] text-slate-400 mt-1">delivered</span>
                </div>
              </div>
              <div className="flex-1 space-y-3 min-w-0">
                {[
                  { label: 'Paid', value: paidTotal, color: PAID_COLOR, sub: 'Charged by Meta' },
                  { label: 'Free', value: freeTotal, color: FREE_COLOR, sub: d.free.entryPoint > 0 ? `${num(d.free.customerService)} service · ${num(d.free.entryPoint)} entry point` : 'Customer service window' },
                ].map(x => (
                  <div key={x.label} className="flex items-start gap-2">
                    <span className="w-2.5 h-2.5 rounded-sm mt-1 flex-shrink-0" style={{ background: x.color }}/>
                    <div className="min-w-0">
                      <p className="text-[12px] font-bold text-slate-800 tabular-nums leading-tight">{num(x.value)} <span className="text-[10px] font-semibold text-slate-400">{pct(x.value, delivered)}</span></p>
                      <p className="text-[10px] text-slate-400 truncate">{x.label} · {x.sub}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </Card>

          {/* where the money goes */}
          <Card title="Charges by category" sub={`Approximate, in ${cur}`} className="lg:col-span-3"
            right={<span className="text-[12px] font-bold text-slate-800 tabular-nums">{money(d.charges.total, cur)}</span>}>
            <div className="p-4 space-y-3">
              {chargeRows.length === 0 && <p className="text-[11px] text-slate-400 py-6 text-center">No paid messages in this period.</p>}
              {chargeRows.map(r => (
                <div key={r.key}>
                  <div className="flex items-center justify-between text-[11px] mb-1">
                    <span className="flex items-center gap-1.5 text-slate-600 font-medium"><span className="w-2 h-2 rounded-sm" style={{ background: r.color }}/>{r.label}</span>
                    <span className="tabular-nums text-slate-700"><b className="font-semibold">{money(r.charges, cur)}</b> <span className="text-slate-400">· {pct(r.charges, d.charges.total)}</span></span>
                  </div>
                  <div className="h-1.5 rounded-full bg-slate-100 overflow-hidden">
                    <div className="h-full rounded-full transition-all" style={{ width: `${Math.max(2, (r.charges / maxCharge) * 100)}%`, background: r.color }}/>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>

        {/* everything per category, one place */}
        <Card title="Breakdown by category" sub="Delivered, paid and free messages with their charges">
          <div className="overflow-x-auto">
            <table className="w-full text-[11px] min-w-[560px]">
              <thead>
                <tr className="text-[10px] uppercase tracking-wide text-slate-400 border-b border-surface-border bg-slate-50/60">
                  <th className="text-left font-semibold px-4 py-2">Category</th>
                  <th className="text-right font-semibold px-3 py-2">Delivered</th>
                  <th className="text-right font-semibold px-3 py-2">Paid</th>
                  <th className="text-right font-semibold px-3 py-2">Free</th>
                  <th className="text-right font-semibold px-3 py-2">Charges</th>
                  <th className="text-right font-semibold px-4 py-2">Per paid message</th>
                </tr>
              </thead>
              <tbody>
                {tableRows.length === 0 && <tr><td colSpan={6} className="text-center text-slate-400 py-8">No messages in this period.</td></tr>}
                {tableRows.map(r => (
                  <tr key={r.key} className="border-b border-slate-50 last:border-0 hover:bg-slate-50/50">
                    <td className="px-4 py-2.5"><span className="flex items-center gap-2 font-medium text-slate-700"><span className="w-2 h-2 rounded-sm flex-shrink-0" style={{ background: r.color }}/>{r.label}</span></td>
                    <td className="px-3 py-2.5 text-right tabular-nums text-slate-700">{num(r.delivered)}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums text-slate-700">{r.paid ? num(r.paid) : <span className="text-slate-300">—</span>}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums text-slate-700">{r.free ? num(r.free) : <span className="text-slate-300">—</span>}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums font-semibold text-slate-800">{r.charges ? money(r.charges, cur) : <span className="text-slate-300 font-normal">—</span>}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums text-slate-500">{r.paid && r.charges ? money(r.charges / r.paid, cur) : <span className="text-slate-300">—</span>}</td>
                  </tr>
                ))}
              </tbody>
              {tableRows.length > 0 && (
                <tfoot>
                  <tr className="border-t border-surface-border bg-slate-50/60 font-bold text-slate-800">
                    <td className="px-4 py-2.5">Total</td>
                    <td className="px-3 py-2.5 text-right tabular-nums">{num(delivered)}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums">{num(paidTotal)}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums">{num(freeTotal)}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums">{money(d.charges.total, cur)}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums text-slate-500 font-semibold">{paidTotal > 0 ? money(d.charges.total / paidTotal, cur) : '—'}</td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </Card>
        </>)}
      </div>
    </div>
  )
}
