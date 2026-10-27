// DashboardTab.jsx — the business at a glance: recurring revenue, money in, clients won and lost,
// renewals coming up, and how the client base splits by plan, type, cycle, payment and source.
// Totals come from GET /admin/analytics; the splits are counted from the client list. Every
// breakdown row opens the client list already filtered to it.
import { useEffect, useMemo, useState } from 'react'
import clsx from 'clsx'
import { Loader2, Table2, BarChart3 } from 'lucide-react'
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts'
import { billingAdmin } from '../../lib/billingApi'
import { Kpi, ErrorNote, CUSTOMER_TYPES, rupees, num } from './ui'
import { cycleOf } from './ClientFilters'

// Categorical slots 1–2 of the reference palette (validated: CVD ΔE 24.7, normal 33.6, ≥ 3:1 on white).
const BLUE = '#2a78d6'
const ORANGE = '#eb6834'
const compact = (n) => Number(n || 0).toLocaleString('en-IN', { notation: 'compact', maximumFractionDigits: 1 })
const monthShort = (ym) => new Date(`${ym}-01T00:00:00`).toLocaleDateString('en-GB', { month: 'short' })
const dayShort = (sec) => new Date(sec * 1000).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
const live = (c) => c.status === 'active' || c.status === 'past_due'
const pct = (a, b) => (b ? Math.round((a / b) * 100) : 0)

function Card({ title, sub, children, className, table }) {
  const [asTable, setAsTable] = useState(false)
  return (
    <section className={clsx('bg-white border border-slate-200 rounded-2xl p-4 min-w-0', className)}>
      <div className="flex items-start gap-2 mb-3">
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-bold text-slate-800">{title}</h3>
          {sub && <p className="text-xs text-slate-400 mt-0.5">{sub}</p>}
        </div>
        {table && (
          <button type="button" onClick={() => setAsTable((v) => !v)} aria-pressed={asTable} title={asTable ? 'Show chart' : 'Show as table'}
            aria-label={asTable ? 'Show chart' : 'Show as table'} className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100">
            {asTable ? <BarChart3 size={14}/> : <Table2 size={14}/>}
          </button>
        )}
      </div>
      {asTable ? <DataTable {...table}/> : children}
    </section>
  )
}

function DataTable({ cols, rows }) {
  return (
    <div className="overflow-x-auto max-h-64">
      <table className="w-full text-xs">
        <thead><tr className="text-left text-slate-400">{cols.map((c, i) => <th key={c} className={clsx('py-1.5 pr-3 font-semibold', i && 'text-right')}>{c}</th>)}</tr></thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className="border-t border-slate-100">{r.map((v, j) => <td key={j} className={clsx('py-1.5 pr-3 text-slate-700', j && 'text-right tabular-nums')}>{v}</td>)}</tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function Legend({ items }) {
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-1 mb-2">
      {items.map(([color, label]) => (
        <span key={label} className="inline-flex items-center gap-1.5 text-xs text-slate-600">
          <span className="w-2.5 h-2.5 rounded-sm" style={{ background: color }}/>{label}
        </span>
      ))}
    </div>
  )
}

function ChartTip({ active, payload, label, fmt, labelFmt }) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-white border border-slate-200 rounded-lg shadow-lg px-3 py-2 text-xs">
      <p className="font-semibold text-slate-800 mb-1">{labelFmt ? labelFmt(label) : label}</p>
      {payload.map((p) => (
        <p key={p.dataKey} className="flex items-center gap-2 text-slate-600">
          <span className="w-2 h-2 rounded-sm" style={{ background: p.color }}/>{p.name}
          <span className="ml-auto pl-3 font-semibold text-slate-800 tabular-nums">{fmt(p.value)}</span>
        </p>
      ))}
    </div>
  )
}

/* Two-series columns over time (stacked or side by side), one y-axis. */
function Columns({ data, x, xFmt, series, stacked, fmt, yFmt }) {
  return (
    <>
      <Legend items={series.map((s) => [s.color, s.name])}/>
      <div className="h-56">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 4, right: 4, left: 0, bottom: 0 }} barGap={2}>
            <CartesianGrid vertical={false} stroke="#f1f5f9"/>
            <XAxis dataKey={x} tickFormatter={xFmt} tick={{ fill: '#94a3b8', fontSize: 11 }} axisLine={{ stroke: '#e2e8f0' }} tickLine={false} interval="preserveStartEnd"/>
            <YAxis tickFormatter={yFmt} tick={{ fill: '#94a3b8', fontSize: 11 }} axisLine={false} tickLine={false} width={48} allowDecimals={false}/>
            <Tooltip cursor={{ fill: '#f8fafc' }} content={<ChartTip fmt={fmt} labelFmt={xFmt}/>}/>
            {series.map((s, i) => (
              <Bar key={s.key} dataKey={s.key} name={s.name} fill={s.color} maxBarSize={24} stackId={stacked ? 'a' : undefined}
                stroke="#fff" strokeWidth={stacked ? 1 : 0}
                radius={!stacked || i === series.length - 1 ? [4, 4, 0, 0] : 0}/>
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>
    </>
  )
}

/* Ranked horizontal bars; a row is a link to the filtered client list. */
function BarList({ items, onPick, empty = 'Nothing yet.' }) {
  const max = Math.max(...items.map((i) => i.value), 0)
  if (!items.length) return <p className="text-xs text-slate-400 py-4">{empty}</p>
  return (
    <ul className="space-y-1">
      {items.map((it) => (
        <li key={it.key}>
          <button type="button" disabled={!onPick} onClick={() => onPick?.(it.key)}
            className="w-full text-left rounded-lg px-2 py-1.5 -mx-2 hover:bg-slate-50 disabled:hover:bg-transparent group">
            <div className="flex items-baseline gap-2 text-xs">
              <span className="font-semibold text-slate-700 truncate group-hover:text-primary">{it.label}</span>
              {it.sub && <span className="text-slate-400 truncate">{it.sub}</span>}
              <span className="ml-auto font-semibold text-slate-800 tabular-nums whitespace-nowrap">{it.display ?? num(it.value)}</span>
            </div>
            <div className="mt-1 h-1.5">
              <div className="h-full rounded-r" style={{ width: `${max ? Math.max(1, (it.value / max) * 100) : 0}%`, background: BLUE }}/>
            </div>
          </button>
        </li>
      ))}
    </ul>
  )
}

export default function DashboardTab({ token, customers, rev, onOpen, onFilter, onAuthLost }) {
  const [a, setA] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    let off = false
    billingAdmin.analytics(token).then((d) => !off && setA(d)).catch((e) => {
      if (off) return
      if (e.status === 401) onAuthLost(); else setError(e.message)
    })
    return () => { off = true }
  }, [token, rev])   // eslint-disable-line react-hooks/exhaustive-deps

  // Splits of the client base, counted from the list so they match the filters exactly.
  const mix = useMemo(() => {
    const on = customers.filter(live)
    const count = (rows, fn) => rows.reduce((m, c) => { const k = fn(c); if (k) m[k] = (m[k] || 0) + 1; return m }, {})
    return {
      on,
      status: count(customers, (c) => (['expired', 'cancelled', 'completed'].includes(c.status) ? 'expired' : c.status)),
      cycle: count(on, cycleOf),
      payment: count(on, (c) => (c.autopay ? 'autopay' : 'once')),
      source: count(on, (c) => c.source),
    }
  }, [customers])

  if (error) return <ErrorNote>{error}</ErrorNote>
  if (!a) return <p className="text-sm text-slate-400 flex items-center gap-2 py-10 justify-center"><Loader2 size={16} className="animate-spin"/> Loading the numbers…</p>

  const k = a.kpis
  const monthly = a.monthly.map((m) => ({ ...m, online: Math.max(0, Math.round((m.gross - m.offline) * 100) / 100) }))
  const change = k.collectedLastMonth ? Math.round(((k.collectedThisMonth - k.collectedLastMonth) / k.collectedLastMonth) * 100) : null
  const typeRows = CUSTOMER_TYPES.map(([type, label]) => {
    const t = a.byType.find((x) => x.type === type)
    return { key: type, label, value: t?.clients ?? 0, sub: t?.mrr ? `${rupees(t.mrr)}/mo` : '' }
  })
  const share = (m, keys) => keys.map(([key, label]) => ({ key, label, value: m[key] || 0, sub: `${pct(m[key] || 0, mix.on.length)}%` }))
  const usage = Object.entries(a.usageThisMonth).filter(([m]) => a.metrics[m]?.kind === 'count').sort((x, y) => y[1] - x[1])

  return (
    <div className="space-y-4">
      {/* headline */}
      <div className="grid xl:grid-cols-[minmax(0,1fr)_minmax(0,2fr)] gap-3">
        <section className="bg-white border border-slate-200 rounded-2xl p-5 flex flex-col justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Monthly recurring revenue</p>
            <p className="text-5xl font-bold text-slate-900 mt-2 tabular-nums">{rupees(k.mrr)}</p>
            <p className="text-xs text-slate-400 mt-1">before GST · plans and add-ons of every live, paying client</p>
          </div>
          <dl className="grid grid-cols-3 gap-3 mt-5 pt-4 border-t border-slate-100">
            <div><dt className="text-[11px] text-slate-400">ARR</dt><dd className="text-sm font-bold text-slate-800 tabular-nums">{rupees(k.arr)}</dd></div>
            <div><dt className="text-[11px] text-slate-400">Per paying client</dt><dd className="text-sm font-bold text-slate-800 tabular-nums">{rupees(k.arpa)}</dd></div>
            <div><dt className="text-[11px] text-slate-400">Paying clients</dt><dd className="text-sm font-bold text-slate-800 tabular-nums">{num(k.payingClients)}</dd></div>
          </dl>
        </section>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Kpi label="Live clients" value={num(k.liveClients)} sub={`${num(k.payingClients)} paying · ${num(k.freeClients)} free`}/>
          <Kpi label="On autopay" value={num(k.autopayClients)} sub={`${pct(k.autopayClients, k.liveClients)}% of live clients`}/>
          <Kpi label="Collected this month" value={rupees(k.collectedThisMonth)}
            sub={change === null ? `last month ${rupees(k.collectedLastMonth)}` : `${change >= 0 ? '+' : '−'}${Math.abs(change)}% vs last month`}/>
          <Kpi label="New this month" value={num(k.newThisMonth)} sub={`${num(k.churnedThisMonth)} lost this month`}/>
          <Kpi label="Renewing in 30 days" value={num(k.dueNext30)} sub={`${rupees(k.dueNext30Value)} incl. GST`}/>
          <Kpi label="Past due" value={num(k.pastDue)} sub={`${rupees(k.pastDueValue)} failed debits`} warn={k.pastDue > 0}/>
          <Kpi label="Overdue renewals" value={num(k.overdueManual)} sub="pay once, last 30 days" warn={k.overdueManual > 0}/>
          <Kpi label="Collected, all time" value={rupees(k.collected)} sub={`${num(k.couponUses)} coupons · ${rupees(k.couponDiscount)} off`}/>
        </div>
      </div>

      {/* money and clients over time */}
      <div className="grid lg:grid-cols-2 gap-3">
        <Card title="Money collected by month" sub="incl. GST, last 12 months"
          table={{ cols: ['Month', 'Online', 'Offline', 'Total', 'Payments'], rows: monthly.map((m) => [m.month, rupees(m.online), rupees(m.offline), rupees(m.gross), m.payments]) }}>
          <Columns data={monthly} x="month" xFmt={monthShort} stacked fmt={rupees} yFmt={(v) => `₹${compact(v)}`}
            series={[{ key: 'online', name: 'Online (Razorpay)', color: BLUE }, { key: 'offline', name: 'Offline (recorded by staff)', color: ORANGE }]}/>
        </Card>
        <Card title="Clients won and lost" sub="first plan vs plan ended without renewal, by month"
          table={{ cols: ['Month', 'New', 'Lost'], rows: monthly.map((m) => [m.month, m.newClients, m.churned]) }}>
          <Columns data={monthly} x="month" xFmt={monthShort} fmt={num} yFmt={compact}
            series={[{ key: 'newClients', name: 'New clients', color: BLUE }, { key: 'churned', name: 'Lost clients', color: ORANGE }]}/>
        </Card>
      </div>

      <div className="grid lg:grid-cols-3 gap-3">
        <Card className="lg:col-span-2" title="Renewals coming up" sub="incl. GST, next 12 weeks, by week"
          table={{ cols: ['Week of', 'Autopay', 'Manual', 'Clients'], rows: a.renewalsByWeek.map((w) => [dayShort(w.from), rupees(w.autopay), rupees(w.manual), w.count]) }}>
          <Columns data={a.renewalsByWeek} x="from" xFmt={dayShort} stacked fmt={rupees} yFmt={(v) => `₹${compact(v)}`}
            series={[{ key: 'autopay', name: 'Charged by autopay', color: BLUE }, { key: 'manual', name: 'To collect (pay once)', color: ORANGE }]}/>
        </Card>
        <Card title="Monthly revenue by plan" sub="live clients · click a plan to see them">
          <BarList items={a.byPlan.map((p) => ({ key: p.plan, label: p.name, sub: `${num(p.clients)} clients`, value: p.mrr, display: rupees(p.mrr) }))}
            onPick={(plan) => onFilter('active', { plan })} empty="No live plans yet."/>
        </Card>
      </div>

      {/* who the clients are */}
      <div className="grid md:grid-cols-2 xl:grid-cols-4 gap-3">
        <Card title="Customer types" sub="live clients">
          <BarList items={typeRows} onPick={(type) => onFilter('active', { type })}/>
        </Card>
        <Card title="All clients by status">
          <BarList onPick={(status) => onFilter('clients', { status })}
            items={[['active', 'Active'], ['past_due', 'Past due'], ['expired', 'Expired'], ['suspended', 'Suspended'], ['none', 'No plan']]
              .map(([key, label]) => ({ key, label, value: mix.status[key] || 0 }))}/>
        </Card>
        <Card title="Billing cycle" sub="live clients">
          <BarList onPick={(cycle) => onFilter('active', { cycle })} items={share(mix.cycle, [['monthly', 'Monthly'], ['yearly', 'Yearly'], ['multi', 'Multi-cycle']])}/>
        </Card>
        <Card title="How they pay" sub="live clients">
          <BarList onPick={(key) => onFilter('active', key === 'autopay' || key === 'once' ? { payment: key } : { source: key })}
            items={[...share(mix.payment, [['autopay', 'Autopay'], ['once', 'Pay once']]), ...share(mix.source, [['staff', 'Manual (by staff)'], ['dashboard', 'Paid from dashboard']])]}/>
        </Card>
      </div>

      <div className="grid lg:grid-cols-2 gap-3">
        <Card title="Top clients" sub="by money paid, all time, incl. GST">
          {a.topClients.length ? (
            <ol className="divide-y divide-slate-100">
              {a.topClients.map((t, i) => (
                <li key={t.workspaceId} className="flex items-center gap-3 py-2 text-sm">
                  <span className="w-5 text-xs text-slate-400 tabular-nums">{i + 1}</span>
                  <button type="button" onClick={() => onOpen(t.workspaceId)} className="flex-1 min-w-0 text-left font-semibold text-slate-800 hover:text-primary truncate">{t.customer}</button>
                  <span className="text-xs text-slate-400 whitespace-nowrap">{t.planName || '—'}</span>
                  <span className="w-28 text-right font-semibold tabular-nums text-slate-800">{rupees(t.paid)}</span>
                </li>
              ))}
            </ol>
          ) : <p className="text-xs text-slate-400 py-4">No payments yet.</p>}
        </Card>
        <Card title="Usage this month" sub="reported by the product, all clients">
          {usage.length ? (
            <BarList items={usage.map(([m, v]) => ({ key: m, label: a.metrics[m].label, value: v }))}/>
          ) : <p className="text-xs text-slate-400 py-4">No usage reported yet this month.</p>}
        </Card>
      </div>
    </div>
  )
}
