import { useMemo, useState } from 'react'
import { useSearchParams, Link } from 'react-router-dom'
import { Truck, MapPinned, AlertTriangle, Timer, Radar, ChevronRight } from 'lucide-react'
import clsx from 'clsx'
import { useData } from '../store/DataContext'
import { useAuth } from '../store/AuthContext'
import { milestoneLabel, serviceLabel, isLive } from '../lib/domain'
import { fmtDate, fmtAgo, fmtDateTime } from '../lib/format'
import { Card, PageHeader, SearchInput, Select, StatCard, EmptyState, Badge, Pagination, usePaged, SectionHeader } from '../components/ui'
import { StatusBadge } from '../components/StatusBadge'
import { TrackingRail } from '../components/Timeline'

const VIEWS = [
  { value: 'live', label: 'Live shipments' },
  { value: 'attention', label: 'Needs attention' },
  { value: 'today', label: 'Out for delivery today' },
  { value: 'delivered', label: 'Recently delivered' },
  { value: 'all', label: 'All shipments' },
]

export default function Shipments() {
  const { db } = useData()
  const { can } = useAuth()
  const [params] = useSearchParams()
  const [view, setView] = useState(params.get('filter') || 'live')
  const [q, setQ] = useState('')
  const [selectedId, setSelectedId] = useState(null)

  const customerOf = useMemo(() => {
    const map = {}
    db.customers.forEach((c) => { map[c.id] = c })
    return map
  }, [db.customers])

  // A shipment exists once the request is confirmed; unconfirmed and rejected requests
  // belong to the order desk, not to tracking.
  const tracked = useMemo(
    () => db.orders.filter((o) => !['requested', 'rejected'].includes(o.status)),
    [db.orders]
  )

  const stats = useMemo(() => {
    const now = Date.now()
    return {
      inTransit: tracked.filter((o) => ['picked_up', 'in_transit'].includes(o.status)).length,
      outForDelivery: tracked.filter((o) => o.status === 'out_for_delivery').length,
      exceptions: tracked.filter((o) => o.status === 'exception').length,
      late: tracked.filter((o) => isLive(o.status) && new Date(o.etaAt).getTime() < now).length,
    }
  }, [tracked])

  const rows = useMemo(() => {
    const now = Date.now()
    const term = q.trim().toLowerCase()
    let list = tracked
    if (view === 'live') list = list.filter((o) => isLive(o.status))
    if (view === 'attention') list = list.filter((o) => o.status === 'exception' || (isLive(o.status) && new Date(o.etaAt).getTime() < now))
    if (view === 'today') list = list.filter((o) => o.status === 'out_for_delivery')
    if (view === 'delivered') list = list.filter((o) => o.status === 'delivered').slice(0, 60)
    if (term) {
      list = list.filter((o) => {
        const c = customerOf[o.customerId]
        return o.id.toLowerCase().includes(term)
          || o.destination.city.toLowerCase().includes(term)
          || o.origin.city.toLowerCase().includes(term)
          || (c && c.name.toLowerCase().includes(term))
      })
    }
    return list
  }, [tracked, view, q, customerOf])

  const paged = usePaged(rows, 10)
  const selected = rows.find((o) => o.id === selectedId) || paged.slice[0] || null

  return (
    <>
      <PageHeader
        title="Shipment Tracking"
        subtitle="Real-time position of every consignment in the network, with the milestone history behind it."
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="In transit" value={stats.inTransit} icon={Truck} tone="cyan" onClick={() => setView('live')} active={view === 'live'} />
        <StatCard label="Out for delivery" value={stats.outForDelivery} icon={MapPinned} tone="violet" onClick={() => setView('today')} active={view === 'today'} />
        <StatCard label="Exceptions" value={stats.exceptions} icon={AlertTriangle} tone="red" onClick={() => setView('attention')} active={view === 'attention'} />
        <StatCard label="Past promised ETA" value={stats.late} icon={Timer} tone="amber" onClick={() => setView('attention')} />
      </div>

      <div className="mt-6 grid gap-5 lg:grid-cols-5">
        <Card className="lg:col-span-3">
          <div className="flex flex-wrap items-center gap-3 border-b border-slate-200 p-4">
            <SearchInput value={q} onChange={setQ} placeholder="Shipment number, city or customer…" className="min-w-[200px] flex-1" />
            <Select value={view} onChange={setView} options={VIEWS} className="w-52" />
          </div>

          {rows.length === 0 ? (
            <div className="p-12"><EmptyState icon={Radar} label="No shipments in this view" hint="Try a different filter or clear the search." /></div>
          ) : (
            <ul className="divide-y divide-slate-100">
              {paged.slice.map((o) => {
                const c = customerOf[o.customerId]
                const last = o.milestones[o.milestones.length - 1]
                const late = isLive(o.status) && new Date(o.etaAt) < new Date()
                const active = selected && selected.id === o.id
                return (
                  <li key={o.id}>
                    <button
                      onClick={() => setSelectedId(o.id)}
                      className={clsx('flex w-full items-center gap-3 px-5 py-3.5 text-left transition-colors', active ? 'bg-navy-50' : 'hover:bg-slate-50')}
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-mono text-[13px] font-semibold text-navy-900">{o.id}</span>
                          <StatusBadge status={o.status} />
                          {late && <Badge tone="red">Late</Badge>}
                        </div>
                        <p className="mt-1 truncate text-xs text-slate-500">
                          {c ? c.name : '—'} · {o.origin.city} → {o.destination.city}
                        </p>
                        <p className="mt-0.5 truncate text-xs text-slate-400">
                          {milestoneLabel(last.code)} · {last.location} · {fmtAgo(last.at)}
                        </p>
                      </div>
                      <ChevronRight size={16} className={clsx('shrink-0', active ? 'text-navy-700' : 'text-slate-300')} />
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
          <Pagination {...paged} />
        </Card>

        {/* Detail rail */}
        <div className="lg:col-span-2">
          {selected ? (
            <Card className="sticky top-0">
              <div className="border-b border-slate-200 p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-mono text-base font-bold text-navy-900">{selected.id}</p>
                    <p className="mt-0.5 truncate text-sm text-slate-500">
                      {(customerOf[selected.customerId] || {}).name} · {serviceLabel(selected.serviceId)}
                    </p>
                  </div>
                  <StatusBadge status={selected.status} />
                </div>
                <div className="mt-4 flex items-center justify-between gap-3 text-xs">
                  <div>
                    <p className="font-semibold uppercase tracking-wide text-slate-400">From</p>
                    <p className="mt-0.5 font-medium text-navy-800">{selected.origin.city}</p>
                  </div>
                  <span className="h-px flex-1 bg-slate-200" />
                  <div className="text-right">
                    <p className="font-semibold uppercase tracking-wide text-slate-400">To</p>
                    <p className="mt-0.5 font-medium text-navy-800">{selected.destination.city}</p>
                  </div>
                </div>
              </div>

              <div className="border-b border-slate-200 px-5 py-4">
                <TrackingRail milestones={selected.milestones} cancelled={selected.status === 'cancelled'} compact />
              </div>

              <div className="p-5">
                <SectionHeader title="Recent milestones" />
                <ul className="mt-3 space-y-3">
                  {[...selected.milestones].reverse().slice(0, 4).map((m) => (
                    <li key={m.id} className="flex gap-3">
                      <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-navy-400" />
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-navy-900">{milestoneLabel(m.code)}</p>
                        <p className="text-xs text-slate-500">{m.location}</p>
                        <p className="text-[11px] text-slate-400">{fmtDateTime(m.at)}</p>
                      </div>
                    </li>
                  ))}
                </ul>
                <div className="mt-5 rounded-lg bg-slate-50 px-3.5 py-3 text-xs text-slate-600">
                  {selected.status === 'delivered'
                    ? 'Delivered ' + fmtDate(selected.deliveredAt) + (selected.pod ? ' · signed by ' + selected.pod.signedBy : '')
                    : selected.status === 'cancelled' ? 'This shipment was cancelled.'
                    : 'Estimated delivery ' + fmtDate(selected.etaAt)}
                </div>
                {can('order_requests') && (
                  <Link to={'/orders/' + selected.id + '?tab=tracking'} className="btn-primary mt-4 w-full">
                    <MapPinned size={15} /> Open shipment
                  </Link>
                )}
              </div>
            </Card>
          ) : (
            <Card className="p-12"><EmptyState icon={Radar} label="Select a shipment" hint="Pick a consignment on the left to see its live position." /></Card>
          )}
        </div>
      </div>
    </>
  )
}
