import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Cell } from 'recharts'
import { Truck, PackageCheck, Clock, Wallet, PackagePlus, ArrowRight } from 'lucide-react'
import { useData } from '../../store/DataContext'
import { useAuth } from '../../store/AuthContext'
import { serviceLabel, isLive } from '../../lib/domain'
import { fmtMoney, fmtNum, fmtDate, fmtAgo } from '../../lib/format'
import { Card, PageHeader, StatCard, SectionHeader, EmptyState } from '../../components/ui'
import { StatusBadge } from '../../components/StatusBadge'

const MONTH_COLORS = ['#93b0d1', '#5d85b4', '#3a6396', '#2a4c78', '#14375f', '#0c2340']

function Tip({ active, payload, label }) {
  if (!active || !payload || !payload.length) return null
  return (
    <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 shadow-pop">
      <p className="text-xs font-semibold text-navy-900">{label}</p>
      <p className="mt-0.5 text-xs text-slate-600 tnum">
        Shipments: <span className="font-semibold text-navy-900">{payload[0].value}</span>
      </p>
    </div>
  )
}

/**
 * The customer's own figures — only what they need to see. Operational reporting stays in
 * the administration console; this answers "where are my parcels and what have I spent?".
 */
export default function PortalHome() {
  const { db } = useData()
  const { customer } = useAuth()

  const m = useMemo(() => {
    const mine = db.orders.filter((o) => o.customerId === customer.id)
    const invoices = db.invoices.filter((i) => i.customerId === customer.id)
    const delivered = mine.filter((o) => o.status === 'delivered')

    const months = []
    for (let i = 5; i >= 0; i--) {
      const d = new Date()
      d.setMonth(d.getMonth() - i, 1)
      const key = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0')
      months.push({
        key,
        label: d.toLocaleString('en-US', { month: 'short' }),
        Shipments: mine.filter((o) => {
          const od = new Date(o.createdAt)
          return od.getFullYear() + '-' + String(od.getMonth() + 1).padStart(2, '0') === key
        }).length,
      })
    }

    return {
      mine,
      active: mine.filter((o) => isLive(o.status)),
      requested: mine.filter((o) => o.status === 'requested'),
      delivered,
      spend: mine.filter((o) => o.status !== 'cancelled' && o.status !== 'rejected').reduce((s, o) => s + o.amount, 0),
      outstanding: invoices.filter((i) => i.status === 'sent').reduce((s, i) => s + i.total, 0),
      months,
    }
  }, [db, customer.id])

  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening'

  return (
    <>
      <PageHeader
        title={greeting + ', ' + customer.name.split(' ')[0]}
        subtitle="Your shipments with Prime Next Logistics at a glance."
        actions={<Link to="/portal/new-order" className="btn-primary"><PackagePlus size={16} /> Create order</Link>}
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="In transit" value={fmtNum(m.active.length)} icon={Truck} tone="cyan" hint="On their way right now" />
        <StatCard label="Awaiting confirmation" value={fmtNum(m.requested.length)} icon={Clock} tone="amber" hint="We are reviewing these" />
        <StatCard label="Delivered" value={fmtNum(m.delivered.length)} icon={PackageCheck} tone="green" hint="All time" />
        <StatCard label="Total shipping spend" value={fmtMoney(m.spend)} icon={Wallet} tone="navy" hint={m.outstanding ? fmtMoney(m.outstanding) + ' outstanding' : 'Nothing outstanding'} />
      </div>

      <div className="mt-6 grid gap-5 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <div className="card-pad pb-3">
            <SectionHeader
              title="Recent shipments"
              subtitle="Your five most recent bookings."
              actions={<Link to="/portal/orders" className="btn-ghost btn-sm">All shipments <ArrowRight size={13} /></Link>}
            />
          </div>
          {m.mine.length === 0 ? (
            <div className="px-5 pb-10">
              <EmptyState
                icon={PackagePlus}
                label="No shipments yet"
                hint="Create your first order and you will be able to track it here."
                action={<Link to="/portal/new-order" className="btn-primary">Create order</Link>}
              />
            </div>
          ) : (
            <ul className="divide-y divide-slate-100">
              {m.mine.slice(0, 5).map((o) => (
                <li key={o.id}>
                  <Link to={'/portal/orders/' + o.id} className="flex items-center gap-3 px-5 py-3 hover:bg-navy-50/60">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono text-[13px] font-semibold text-navy-900">{o.id}</span>
                        <StatusBadge status={o.status} />
                      </div>
                      <p className="mt-0.5 truncate text-xs text-slate-500">
                        {o.origin.city} → {o.destination.city} · {serviceLabel(o.serviceId)}
                      </p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="text-sm font-semibold tnum text-navy-900">{fmtMoney(o.amount)}</p>
                      <p className="text-[11px] text-slate-400">
                        {o.status === 'delivered' ? 'Delivered ' + fmtDate(o.deliveredAt) : 'ETA ' + fmtDate(o.etaAt)}
                      </p>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card>
          <div className="card-pad pb-2">
            <SectionHeader title="Your shipping activity" subtitle="Shipments booked per month." />
          </div>
          <div className="h-56 px-2 pb-4">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={m.months} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#94a3b8' }} tickLine={false} axisLine={{ stroke: '#e2e8f0' }} />
                <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} tickLine={false} axisLine={false} width={28} allowDecimals={false} />
                <Tooltip content={<Tip />} cursor={{ fill: '#f1f5f9' }} />
                <Bar dataKey="Shipments" radius={[4, 4, 0, 0]} maxBarSize={30}>
                  {m.months.map((_, i) => <Cell key={i} fill={MONTH_COLORS[i % MONTH_COLORS.length]} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="border-t border-slate-100 px-5 py-3">
            <p className="text-xs text-slate-500">
              {m.mine.length > 0
                ? 'Last booking ' + fmtAgo(m.mine[0].createdAt) + '.'
                : 'Nothing booked yet.'}
            </p>
          </div>
        </Card>
      </div>
    </>
  )
}
