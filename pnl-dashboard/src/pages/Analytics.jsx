import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  ResponsiveContainer, AreaChart, Area, BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
} from 'recharts'
import {
  Truck, PackageCheck, Clock, Ban, AlertTriangle, Timer, Wallet, UserPlus, Download,
  BarChart3, ArrowRight, Users as UsersIcon,
} from 'lucide-react'
import { useData } from '../store/DataContext'
import { useAuth } from '../store/AuthContext'
import { STATUS, SERVICES, statusLabel, isLive } from '../lib/domain'
import { fmtMoney, fmtMoneyShort, fmtNum, fmtUnits, fmtDate, fmtAgo, pct, initials, avatarTone } from '../lib/format'
import {
  Card, PageHeader, Tabs, Table, Select, StatCard, SectionHeader, EmptyState, Badge, Avatar,
} from '../components/ui'
import { StatusBadge } from '../components/StatusBadge'

const RANGES = [
  { value: '30', label: 'Last 30 days' },
  { value: '90', label: 'Last 90 days' },
  { value: '180', label: 'Last 6 months' },
  { value: 'all', label: 'All time' },
]

/** Keeps a status the same colour here as the badge it carries everywhere else. */
const TONE_HEX = {
  navy: '#2a4c78', green: '#059669', amber: '#f59e0b', red: '#dc2626',
  cyan: '#0891b2', violet: '#7c3aed', slate: '#94a3b8',
}
const SERIES_COLORS = ['#0c2340', '#2a4c78', '#3a6396', '#5d85b4', '#93b0d1']

function Tip({ active, payload, label, money }) {
  if (!active || !payload || !payload.length) return null
  return (
    <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 shadow-pop">
      <p className="text-xs font-semibold text-navy-900">{label}</p>
      {payload.map((p) => (
        <p key={String(p.dataKey) + p.name} className="mt-0.5 text-xs text-slate-600 tnum">
          {p.name}: <span className="font-semibold text-navy-900">{money ? fmtMoney(p.value) : fmtNum(p.value)}</span>
        </p>
      ))}
    </div>
  )
}

const csvDownload = (name, head, rows) => {
  const csv = [head, ...rows]
    .map((r) => r.map((v) => '"' + String(v == null ? '' : v).replace(/"/g, '""') + '"').join(','))
    .join('\n')
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }))
  const a = document.createElement('a')
  a.href = url
  a.download = name + '-' + new Date().toISOString().slice(0, 10) + '.csv'
  a.click()
  URL.revokeObjectURL(url)
}

/**
 * Analytics and reporting in one section, as the operation reads it: a live overview of
 * what is moving today, with the order, customer and shipment reports behind it.
 */
export default function Analytics() {
  const { db } = useData()
  const { user, can } = useAuth()
  const nav = useNavigate()
  const [tab, setTab] = useState('overview')
  const [range, setRange] = useState('90')

  const customerOf = useMemo(() => {
    const map = {}
    db.customers.forEach((c) => { map[c.id] = c })
    return map
  }, [db.customers])

  /* ── Live overview (all time, not range-filtered — this is "right now") ──── */
  const live = useMemo(() => {
    const o = db.orders
    const now = Date.now()
    const active = o.filter((x) => isLive(x.status))
    const completed = o.filter((x) => x.status === 'delivered')
    const requests = o.filter((x) => x.status === 'requested')
    const cancelled = o.filter((x) => x.status === 'cancelled' || x.status === 'rejected')
    const exceptions = o.filter((x) => x.status === 'exception')
    const overdue = active.filter((x) => new Date(x.etaAt).getTime() < now)

    const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).getTime()
    const revenueMonth = db.invoices
      .filter((i) => i.status !== 'void' && new Date(i.issuedAt).getTime() >= monthStart)
      .reduce((s, i) => s + i.total, 0)
    const outstanding = db.invoices.filter((i) => i.status === 'sent').reduce((s, i) => s + i.total, 0)
    const onTime = completed.filter((x) => new Date(x.deliveredAt) <= new Date(x.etaAt)).length

    const weeks = []
    for (let w = 11; w >= 0; w--) {
      const end = now - w * 7 * 864e5
      const start = end - 7 * 864e5
      const inWeek = o.filter((x) => {
        const t = new Date(x.createdAt).getTime()
        return t >= start && t < end
      })
      weeks.push({
        label: fmtDate(new Date(start)).slice(0, 6),
        Orders: inWeek.length,
        Delivered: inWeek.filter((x) => x.status === 'delivered').length,
      })
    }

    const byService = SERVICES.map((s) => ({
      name: s.short,
      Shipments: o.filter((x) => x.serviceId === s.id).length,
    }))

    return {
      active, completed, requests, cancelled, exceptions, overdue,
      revenueMonth, outstanding, onTimeRate: pct(onTime, completed.length),
      weeks, byService,
      newCustomers: db.customers.filter((c) => now - new Date(c.registeredAt).getTime() < 30 * 864e5),
      pendingCustomers: db.customers.filter((c) => c.status === 'pending'),
      openQuotes: db.quotes.filter((q) => q.status === 'new'),
    }
  }, [db])

  const attention = useMemo(
    () => [...live.exceptions, ...live.overdue]
      .filter((v, i, a) => a.findIndex((x) => x.id === v.id) === i)
      .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt))
      .slice(0, 6),
    [live]
  )

  /* ── Range-filtered reporting ────────────────────────────────────────────── */
  const since = useMemo(() => (range === 'all' ? 0 : Date.now() - Number(range) * 864e5), [range])
  const orders = useMemo(() => db.orders.filter((o) => new Date(o.createdAt).getTime() >= since), [db.orders, since])
  const invoices = useMemo(() => db.invoices.filter((i) => new Date(i.issuedAt).getTime() >= since), [db.invoices, since])

  const byMonth = useMemo(() => {
    const buckets = {}
    orders.forEach((o) => {
      const d = new Date(o.createdAt)
      const key = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0')
      const b = buckets[key] || (buckets[key] = { key, label: d.toLocaleString('en-US', { month: 'short', year: '2-digit' }), Orders: 0, Delivered: 0, Cancelled: 0 })
      b.Orders += 1
      if (o.status === 'delivered') b.Delivered += 1
      if (o.status === 'cancelled' || o.status === 'rejected') b.Cancelled += 1
    })
    return Object.values(buckets).sort((a, b) => a.key.localeCompare(b.key))
  }, [orders])

  const byServiceReport = useMemo(() => SERVICES.map((s) => {
    const list = orders.filter((o) => o.serviceId === s.id)
    const delivered = list.filter((o) => o.status === 'delivered')
    const onTime = delivered.filter((o) => new Date(o.deliveredAt) <= new Date(o.etaAt)).length
    return {
      id: s.id,
      name: s.label,
      Shipments: list.length,
      delivered: delivered.length,
      revenue: list.filter((o) => o.status !== 'cancelled' && o.status !== 'rejected').reduce((a, o) => a + o.amount, 0),
      // Grouped by service, so averaging the quantity is meaningful — each row is all kg,
      // all CBM or all containers, never a mixture.
      avgQty: list.length ? list.reduce((a, o) => a + o.quantity, 0) / list.length : 0,
      onTime: pct(onTime, delivered.length),
    }
  }), [orders])

  const byStatus = useMemo(
    () => Object.keys(STATUS)
      .map((k) => ({ name: statusLabel(k), fill: TONE_HEX[STATUS[k].tone], value: orders.filter((o) => o.status === k).length }))
      .filter((x) => x.value),
    [orders]
  )

  const topCustomers = useMemo(() => {
    const map = {}
    orders.forEach((o) => {
      const e = map[o.customerId] || (map[o.customerId] = { id: o.customerId, orders: 0, spend: 0, delivered: 0 })
      e.orders += 1
      if (o.status !== 'cancelled' && o.status !== 'rejected') e.spend += o.amount
      if (o.status === 'delivered') e.delivered += 1
    })
    return Object.values(map).sort((a, b) => b.spend - a.spend).slice(0, 15)
  }, [orders])

  const signupsByMonth = useMemo(() => {
    const buckets = {}
    db.customers
      .filter((c) => new Date(c.registeredAt).getTime() >= since)
      .forEach((c) => {
        const d = new Date(c.registeredAt)
        const key = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0')
        const b = buckets[key] || (buckets[key] = { key, label: d.toLocaleString('en-US', { month: 'short', year: '2-digit' }), Registrations: 0 })
        b.Registrations += 1
      })
    return Object.values(buckets).sort((a, b) => a.key.localeCompare(b.key))
  }, [db.customers, since])

  const lanes = useMemo(() => {
    const map = {}
    orders.forEach((o) => {
      const key = o.origin.city + ' → ' + o.destination.city
      // A lane carries every service, so quantities are not comparable across it — kilos,
      // CBM and containers do not add up. Pieces do.
      const e = map[key] || (map[key] = { lane: key, shipments: 0, pieces: 0, delivered: 0, late: 0, revenue: 0 })
      e.shipments += 1
      e.pieces += o.pieces
      if (o.status === 'delivered') {
        e.delivered += 1
        if (new Date(o.deliveredAt) > new Date(o.etaAt)) e.late += 1
      }
      if (o.status !== 'cancelled' && o.status !== 'rejected') e.revenue += o.amount
    })
    return Object.values(map).sort((a, b) => b.shipments - a.shipments).slice(0, 15)
  }, [orders])

  const performance = useMemo(() => {
    const delivered = orders.filter((o) => o.status === 'delivered')
    const onTime = delivered.filter((o) => new Date(o.deliveredAt) <= new Date(o.etaAt)).length
    const avgDays = delivered.length
      ? delivered.reduce((a, o) => a + (new Date(o.deliveredAt) - new Date(o.createdAt)) / 864e5, 0) / delivered.length
      : 0
    return { delivered: delivered.length, onTime, onTimeRate: pct(onTime, delivered.length), avgDays }
  }, [orders])

  const revenue = orders.filter((o) => o.status !== 'cancelled' && o.status !== 'rejected').reduce((a, o) => a + o.amount, 0)
  const collected = invoices.filter((i) => i.status === 'paid').reduce((a, i) => a + i.total, 0)

  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening'
  const customerName = (id) => (customerOf[id] ? customerOf[id].name : id)

  return (
    <>
      <PageHeader
        title="Analytics & Reports"
        subtitle={tab === 'overview'
          ? greeting + ', ' + user.name.split(' ')[0] + ' — what is moving, what is waiting and what needs a decision today.'
          : 'Order, customer and shipment reports across the period you choose, exportable for finance and management.'}
        actions={tab !== 'overview' ? <Select value={range} onChange={setRange} options={RANGES} className="w-44" /> : null}
      />

      <Tabs
        className="mb-6"
        active={tab}
        onChange={setTab}
        tabs={[
          { id: 'overview', label: 'Operations overview' },
          { id: 'orders', label: 'Order report' },
          { id: 'customers', label: 'Customer report' },
          { id: 'shipments', label: 'Shipment report' },
        ]}
      />

      {tab === 'overview' && (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard
              label="Active shipments" value={fmtNum(live.active.length)} icon={Truck} tone="navy"
              hint="Confirmed, collected or in transit"
              onClick={can('shipments') ? () => nav('/shipments') : undefined}
            />
            <StatCard
              label="Order requests" value={fmtNum(live.requests.length)} icon={Clock} tone="amber"
              hint="Waiting for your confirmation"
              onClick={can('order_requests') ? () => nav('/orders?status=requested') : undefined}
            />
            <StatCard
              label="Completed orders" value={fmtNum(live.completed.length)} icon={PackageCheck} tone="green"
              hint={live.onTimeRate + '% delivered within ETA'}
              onClick={can('order_requests') ? () => nav('/orders?status=delivered') : undefined}
            />
            <StatCard
              label="Cancelled / rejected" value={fmtNum(live.cancelled.length)} icon={Ban} tone="slate"
              hint={pct(live.cancelled.length, db.orders.length) + '% of all bookings'}
              onClick={can('order_requests') ? () => nav('/orders?status=closed') : undefined}
            />
          </div>

          <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard label="Invoiced this month" value={fmtMoney(live.revenueMonth)} icon={Wallet} tone="navy" hint={fmtMoney(live.outstanding) + ' still outstanding'} />
            <StatCard label="Open exceptions" value={fmtNum(live.exceptions.length)} icon={AlertTriangle} tone="red" hint="Shipments needing an operator" />
            <StatCard label="Past ETA" value={fmtNum(live.overdue.length)} icon={Timer} tone="amber" hint="Moving but behind schedule" />
            <StatCard label="New customers (30d)" value={fmtNum(live.newCustomers.length)} icon={UserPlus} tone="green" hint={live.pendingCustomers.length + ' awaiting approval'} />
          </div>

          <div className="mt-6 grid gap-5 lg:grid-cols-3">
            <Card className="lg:col-span-2">
              <div className="card-pad pb-2">
                <SectionHeader title="Booking volume" subtitle="Orders received per week over the last quarter, and how many of them have completed." />
              </div>
              <div className="h-64 px-2 pb-4">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={live.weeks} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="gOrders" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#0c2340" stopOpacity={0.28} />
                        <stop offset="100%" stopColor="#0c2340" stopOpacity={0.02} />
                      </linearGradient>
                      <linearGradient id="gDone" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#f59e0b" stopOpacity={0.3} />
                        <stop offset="100%" stopColor="#f59e0b" stopOpacity={0.02} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                    <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#94a3b8' }} tickLine={false} axisLine={{ stroke: '#e2e8f0' }} />
                    <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} tickLine={false} axisLine={false} width={32} allowDecimals={false} />
                    <Tooltip content={<Tip />} />
                    <Area type="monotone" dataKey="Orders" stroke="#0c2340" strokeWidth={2} fill="url(#gOrders)" />
                    <Area type="monotone" dataKey="Delivered" stroke="#f59e0b" strokeWidth={2} fill="url(#gDone)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
              <div className="flex items-center gap-5 border-t border-slate-100 px-5 py-3">
                <span className="flex items-center gap-1.5 text-xs text-slate-500"><span className="h-2 w-2 rounded-full bg-navy-900" /> Orders booked</span>
                <span className="flex items-center gap-1.5 text-xs text-slate-500"><span className="h-2 w-2 rounded-full bg-amber-500" /> Delivered</span>
              </div>
            </Card>

            <Card>
              <div className="card-pad pb-2">
                <SectionHeader title="Service mix" subtitle="Shipments booked per service line." />
              </div>
              <div className="h-64 px-2 pb-4">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={live.byService} layout="vertical" margin={{ top: 8, right: 20, left: 8, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" horizontal={false} />
                    <XAxis type="number" tick={{ fontSize: 11, fill: '#94a3b8' }} tickLine={false} axisLine={false} allowDecimals={false} />
                    <YAxis type="category" dataKey="name" width={92} tick={{ fontSize: 11, fill: '#64748b' }} tickLine={false} axisLine={false} />
                    <Tooltip content={<Tip />} cursor={{ fill: '#f1f5f9' }} />
                    <Bar dataKey="Shipments" radius={[0, 4, 4, 0]} barSize={16}>
                      {live.byService.map((_, i) => <Cell key={i} fill={SERIES_COLORS[i % SERIES_COLORS.length]} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Card>
          </div>

          <div className="mt-5 grid gap-5 lg:grid-cols-3">
            <Card className="lg:col-span-2">
              <div className="card-pad pb-3">
                <SectionHeader
                  title="Needs attention"
                  subtitle="Exceptions and shipments running past their promised ETA."
                  actions={can('shipments') ? <Link to="/shipments?filter=attention" className="btn-ghost btn-sm">Open tracking <ArrowRight size={13} /></Link> : null}
                />
              </div>
              {attention.length === 0 ? (
                <div className="px-5 pb-8"><EmptyState label="Nothing is off track" hint="Every active shipment is within its ETA." /></div>
              ) : (
                <ul className="divide-y divide-slate-100">
                  {attention.map((o) => {
                    const late = new Date(o.etaAt).getTime() < Date.now()
                    return (
                      <li key={o.id}>
                        <Link to={'/orders/' + o.id} className="flex items-center gap-3 px-5 py-3 hover:bg-navy-50/60">
                          <span className={'grid h-8 w-8 shrink-0 place-items-center rounded-lg ' + (o.status === 'exception' ? 'bg-red-50 text-red-600' : 'bg-amber-50 text-amber-600')}>
                            {o.status === 'exception' ? <AlertTriangle size={15} /> : <Timer size={15} />}
                          </span>
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="font-mono text-[13px] font-semibold text-navy-900">{o.id}</p>
                              <StatusBadge status={o.status} />
                            </div>
                            <p className="mt-0.5 truncate text-xs text-slate-500">
                              {customerName(o.customerId)} · {o.origin.city} → {o.destination.city}
                            </p>
                          </div>
                          <p className={'shrink-0 text-xs tnum ' + (late ? 'text-red-600' : 'text-slate-500')}>
                            {late ? 'ETA passed ' + fmtAgo(o.etaAt) : 'ETA ' + fmtDate(o.etaAt)}
                          </p>
                        </Link>
                      </li>
                    )
                  })}
                </ul>
              )}
            </Card>

            <div className="space-y-5">
              <Card>
                <div className="card-pad pb-3">
                  <SectionHeader title="Order requests" subtitle={live.requests.length + ' waiting for confirmation'} />
                </div>
                {live.requests.length === 0 ? (
                  <div className="px-5 pb-6"><EmptyState label="Queue is clear" /></div>
                ) : (
                  <ul className="divide-y divide-slate-100">
                    {live.requests.slice(0, 4).map((o) => (
                      <li key={o.id}>
                        <Link to={'/orders/' + o.id} className="block px-5 py-2.5 hover:bg-navy-50/60">
                          <p className="font-mono text-[12px] font-semibold text-navy-900">{o.id}</p>
                          <p className="truncate text-xs text-slate-500">{customerName(o.customerId)} · {fmtAgo(o.createdAt)}</p>
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
                {can('order_requests') && live.requests.length > 4 && (
                  <Link to="/orders?status=requested" className="block border-t border-slate-100 px-5 py-2.5 text-xs font-semibold text-navy-700 hover:bg-slate-50">
                    View all {live.requests.length} →
                  </Link>
                )}
              </Card>

              {can('quotations') && (
                <Card>
                  <div className="card-pad pb-3">
                    <SectionHeader title="Quotations to price" subtitle={live.openQuotes.length + ' awaiting a rate'} />
                  </div>
                  {live.openQuotes.length === 0 ? (
                    <div className="px-5 pb-6"><EmptyState label="No open quotations" /></div>
                  ) : (
                    <ul className="divide-y divide-slate-100">
                      {live.openQuotes.slice(0, 4).map((q) => (
                        <li key={q.id}>
                          <Link to="/quotations" className="flex items-center gap-3 px-5 py-2.5 hover:bg-navy-50/60">
                            <Avatar name={initials(q.name)} tone={avatarTone(q.name)} size="sm" />
                            <span className="min-w-0 flex-1">
                              <span className="block truncate text-[13px] font-semibold text-navy-900">{q.name}</span>
                              <span className="block truncate text-xs text-slate-500">{q.origin.city} → {q.destination.city}</span>
                            </span>
                            <span className="shrink-0 text-[11px] text-slate-400">{fmtAgo(q.at)}</span>
                          </Link>
                        </li>
                      ))}
                    </ul>
                  )}
                </Card>
              )}
            </div>
          </div>

          <div className="mt-5 grid gap-5 lg:grid-cols-3">
            <Card className="card-pad">
              <SectionHeader title="Status spread" subtitle="Where every order in the system currently sits." />
              <ul className="mt-4 space-y-3">
                {Object.entries(STATUS).map(([key, s]) => {
                  const n = db.orders.filter((o) => o.status === key).length
                  const p = pct(n, db.orders.length)
                  return (
                    <li key={key}>
                      <div className="flex items-center justify-between gap-2 text-xs">
                        <span className="font-medium text-navy-800">{s.label}</span>
                        <span className="tnum text-slate-500">{fmtNum(n)} · {p}%</span>
                      </div>
                      <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-slate-100">
                        <div className="h-full rounded-full" style={{ width: Math.max(p, n ? 2 : 0) + '%', backgroundColor: TONE_HEX[s.tone] }} />
                      </div>
                    </li>
                  )
                })}
              </ul>
            </Card>

            <Card className="lg:col-span-2">
              <div className="card-pad pb-3">
                <SectionHeader title="Recent activity" subtitle="Customer actions and operator updates across the platform." />
              </div>
              <ul className="divide-y divide-slate-100">
                {db.activity.slice(0, 8).map((a) => (
                  <li key={a.id} className="flex items-start gap-3 px-5 py-3">
                    <Badge tone={
                      a.kind === 'shipment' ? 'cyan' : a.kind === 'order' ? 'navy' : a.kind === 'invoice' ? 'green'
                        : a.kind === 'content' ? 'violet' : a.kind === 'user' || a.kind === 'branch' ? 'amber' : 'slate'
                    }>
                      {a.kind}
                    </Badge>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm text-navy-800">{a.action}</p>
                      <p className="mt-0.5 text-xs text-slate-400">{a.actor} · {fmtAgo(a.at)}</p>
                    </div>
                    {a.orderId && can('order_requests') && (
                      <Link to={'/orders/' + a.orderId} className="shrink-0 text-xs font-semibold text-navy-700 hover:underline">Open</Link>
                    )}
                  </li>
                ))}
              </ul>
            </Card>
          </div>
        </>
      )}

      {tab !== 'overview' && (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard label="Orders in period" value={fmtNum(orders.length)} icon={BarChart3} tone="navy" />
          <StatCard label="Billable value" value={fmtMoney(revenue)} icon={Wallet} tone="green" hint={fmtMoney(collected) + ' collected'} />
          <StatCard label="On-time delivery" value={performance.onTimeRate + '%'} icon={Truck} tone="cyan" hint={fmtNum(performance.delivered) + ' completed'} />
          <StatCard label="Avg transit" value={performance.avgDays.toFixed(1) + ' days'} icon={Timer} tone="amber" hint="Request to delivery" />
        </div>
      )}

      {tab === 'orders' && (
        <div className="mt-5 space-y-5">
          <div className="grid gap-5 lg:grid-cols-3">
            <Card className="lg:col-span-2">
              <div className="card-pad pb-2">
                <SectionHeader title="Orders by month" subtitle="Booked, delivered and closed volumes." />
              </div>
              <div className="h-72 px-2 pb-4">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={byMonth} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                    <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#94a3b8' }} tickLine={false} axisLine={{ stroke: '#e2e8f0' }} />
                    <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} tickLine={false} axisLine={false} width={32} allowDecimals={false} />
                    <Tooltip content={<Tip />} cursor={{ fill: '#f1f5f9' }} />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    <Bar dataKey="Orders" fill="#0c2340" radius={[4, 4, 0, 0]} maxBarSize={28} />
                    <Bar dataKey="Delivered" fill="#3a6396" radius={[4, 4, 0, 0]} maxBarSize={28} />
                    <Bar dataKey="Cancelled" fill="#f59e0b" radius={[4, 4, 0, 0]} maxBarSize={28} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Card>

            <Card>
              <div className="card-pad pb-2">
                <SectionHeader title="Status mix" subtitle="Share of orders by current status." />
              </div>
              <div className="h-72 pb-4">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={byStatus} dataKey="value" nameKey="name" innerRadius={52} outerRadius={84} paddingAngle={2}>
                      {byStatus.map((s, i) => <Cell key={i} fill={s.fill || SERIES_COLORS[i % SERIES_COLORS.length]} />)}
                    </Pie>
                    <Tooltip content={<Tip />} />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </Card>
          </div>

          <Card>
            <div className="card-pad pb-3">
              <SectionHeader
                title="Orders by service line"
                actions={
                  <button
                    className="btn-ghost btn-sm"
                    onClick={() => csvDownload('pnc-order-report',
                      ['Service', 'Shipments', 'Delivered', 'On-time %', 'Average size', 'Billable value'],
                      byServiceReport.map((s) => [s.name, s.Shipments, s.delivered, s.onTime, fmtUnits(s.id, s.avgQty), s.revenue]))}
                  >
                    <Download size={13} /> Export
                  </button>
                }
              />
            </div>
            <Table head={[
              { key: 's', label: 'Service' }, { key: 'n', label: 'Shipments', align: 'right' },
              { key: 'd', label: 'Delivered', align: 'right' }, { key: 'o', label: 'On-time', align: 'right' },
              { key: 'w', label: 'Average size', align: 'right' }, { key: 'r', label: 'Billable value', align: 'right' },
            ]}>
              {byServiceReport.map((s) => (
                <tr key={s.id}>
                  <td className="td font-medium text-navy-900">{s.name}</td>
                  <td className="td text-right tnum whitespace-nowrap">{fmtNum(s.Shipments)}</td>
                  <td className="td text-right tnum whitespace-nowrap">{fmtNum(s.delivered)}</td>
                  <td className="td text-right tnum whitespace-nowrap">{s.onTime}%</td>
                  <td className="td text-right tnum whitespace-nowrap">{fmtUnits(s.id, s.avgQty)}</td>
                  <td className="td text-right tnum font-semibold whitespace-nowrap">{fmtMoney(s.revenue)}</td>
                </tr>
              ))}
            </Table>
          </Card>
        </div>
      )}

      {tab === 'customers' && (
        <div className="mt-5 space-y-5">
          <Card>
            <div className="card-pad pb-2">
              <SectionHeader title="New registrations" subtitle="Customer sign-ups per month in the selected period." />
            </div>
            <div className="h-64 px-2 pb-4">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={signupsByMonth} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                  <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#94a3b8' }} tickLine={false} axisLine={{ stroke: '#e2e8f0' }} />
                  <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} tickLine={false} axisLine={false} width={32} allowDecimals={false} />
                  <Tooltip content={<Tip />} />
                  <Line type="monotone" dataKey="Registrations" stroke="#0c2340" strokeWidth={2.5} dot={{ r: 3, fill: '#0c2340' }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </Card>

          <Card>
            <div className="card-pad pb-3">
              <SectionHeader
                title="Top customers by value"
                actions={
                  <button
                    className="btn-ghost btn-sm"
                    onClick={() => csvDownload('pnc-customer-report',
                      ['Customer', 'Company', 'Email', 'Country', 'Orders', 'Delivered', 'Billable value'],
                      topCustomers.map((t) => {
                        const c = customerOf[t.id] || {}
                        return [c.name, c.company, c.email, c.country, t.orders, t.delivered, t.spend.toFixed(2)]
                      }))}
                  >
                    <Download size={13} /> Export
                  </button>
                }
              />
            </div>
            <Table head={[
              { key: 'c', label: 'Customer' }, { key: 'loc', label: 'Country' },
              { key: 'o', label: 'Orders', align: 'right' }, { key: 'd', label: 'Delivered', align: 'right' },
              { key: 's', label: 'Billable value', align: 'right' },
            ]} empty={topCustomers.length === 0} emptyLabel="No customer activity in this period">
              {topCustomers.map((t) => {
                const c = customerOf[t.id] || {}
                return (
                  <tr key={t.id}>
                    <td className="td">
                      <p className="font-medium text-navy-900">{c.name}</p>
                      <p className="text-[11px] text-slate-400">{c.company || 'Individual'} · {t.id}</p>
                    </td>
                    <td className="td text-slate-600">{c.country}</td>
                    <td className="td text-right tnum whitespace-nowrap">{t.orders}</td>
                    <td className="td text-right tnum whitespace-nowrap">{t.delivered}</td>
                    <td className="td text-right tnum font-semibold whitespace-nowrap">{fmtMoney(t.spend)}</td>
                  </tr>
                )
              })}
            </Table>
          </Card>
        </div>
      )}

      {tab === 'shipments' && (
        <div className="mt-5 space-y-5">
          <div className="grid gap-4 sm:grid-cols-3">
            <StatCard label="Completed shipments" value={fmtNum(performance.delivered)} icon={Truck} tone="green" />
            <StatCard label="Delivered on time" value={fmtNum(performance.onTime)} icon={PackageCheck} tone="navy" hint={performance.onTimeRate + '% of completed'} />
            <StatCard label="Average transit" value={performance.avgDays.toFixed(1) + ' days'} icon={UsersIcon} tone="amber" />
          </div>

          <Card>
            <div className="card-pad pb-3">
              <SectionHeader
                title="Busiest lanes"
                subtitle="Origin to destination pairs ranked by volume."
                actions={
                  <button
                    className="btn-ghost btn-sm"
                    onClick={() => csvDownload('pnc-shipment-report',
                      ['Lane', 'Shipments', 'Pieces', 'Delivered', 'Late deliveries', 'Billable value'],
                      lanes.map((l) => [l.lane, l.shipments, l.pieces, l.delivered, l.late, l.revenue]))}
                  >
                    <Download size={13} /> Export
                  </button>
                }
              />
            </div>
            <Table head={[
              { key: 'l', label: 'Lane' }, { key: 'n', label: 'Shipments', align: 'right' },
              { key: 'w', label: 'Pieces', align: 'right' }, { key: 'd', label: 'Delivered', align: 'right' },
              { key: 'x', label: 'Late', align: 'right' }, { key: 'r', label: 'Billable value', align: 'right' },
            ]} empty={lanes.length === 0} emptyLabel="No shipments in this period">
              {lanes.map((l) => (
                <tr key={l.lane}>
                  <td className="td font-medium text-navy-900">{l.lane}</td>
                  <td className="td text-right tnum whitespace-nowrap">{fmtNum(l.shipments)}</td>
                  <td className="td text-right tnum whitespace-nowrap">{fmtNum(l.pieces)}</td>
                  <td className="td text-right tnum whitespace-nowrap">{fmtNum(l.delivered)}</td>
                  <td className="td text-right tnum whitespace-nowrap">{l.late ? <span className="text-red-600">{l.late}</span> : '0'}</td>
                  <td className="td text-right tnum font-semibold whitespace-nowrap">{fmtMoney(l.revenue)}</td>
                </tr>
              ))}
            </Table>
          </Card>

          <Card>
            <div className="card-pad pb-3">
              <SectionHeader title="Exception log" subtitle="Shipments currently flagged for an operator." />
            </div>
            <Table head={[
              { key: 't', label: 'Shipment' }, { key: 'c', label: 'Customer' }, { key: 'r', label: 'Route' },
              { key: 'n', label: 'Last note' }, { key: 'd', label: 'Since' },
            ]} empty={orders.filter((o) => o.status === 'exception').length === 0} emptyLabel="No open exceptions — the network is clean">
              {orders.filter((o) => o.status === 'exception').slice(0, 20).map((o) => {
                const last = o.milestones[o.milestones.length - 1]
                return (
                  <tr key={o.id}>
                    <td className="td font-mono text-[13px] font-semibold text-navy-900">{o.id}</td>
                    <td className="td text-slate-600">{customerName(o.customerId)}</td>
                    <td className="td whitespace-nowrap text-slate-600">{o.origin.city} → {o.destination.city}</td>
                    <td className="td max-w-[280px] truncate text-slate-600">{last.note || '—'}</td>
                    <td className="td whitespace-nowrap text-slate-600">{fmtDate(last.at)}</td>
                  </tr>
                )
              })}
            </Table>
          </Card>
        </div>
      )}
    </>
  )
}
