import { useMemo, useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { PackagePlus, Download } from 'lucide-react'
import { useData } from '../../store/DataContext'
import { useAuth } from '../../store/AuthContext'
import { serviceLabel, statusLabel, isLive } from '../../lib/domain'
import { fmtDate, fmtMoney, fmtUnits, fmtAgo } from '../../lib/format'
import {
  Card, PageHeader, Table, SearchInput, Tabs, Pagination, usePaged, EmptyState,
} from '../../components/ui'
import { StatusBadge } from '../../components/StatusBadge'

const VIEWS = [
  { id: 'active', label: 'In progress' },
  { id: 'requested', label: 'Awaiting confirmation' },
  { id: 'delivered', label: 'Delivered' },
  { id: 'all', label: 'All shipments' },
]

const inView = (o, view) => {
  if (view === 'all') return true
  if (view === 'active') return isLive(o.status)
  return o.status === view
}

/** Order history — the customer's own record, and the only orders this screen can see. */
export default function PortalOrders() {
  const { db } = useData()
  const { customer } = useAuth()
  const nav = useNavigate()
  const [view, setView] = useState('active')
  const [q, setQ] = useState('')

  const mine = useMemo(() => db.orders.filter((o) => o.customerId === customer.id), [db.orders, customer.id])

  const counts = useMemo(() => ({
    active: mine.filter((o) => isLive(o.status)).length,
    requested: mine.filter((o) => o.status === 'requested').length,
    delivered: mine.filter((o) => o.status === 'delivered').length,
    all: mine.length,
  }), [mine])

  const rows = useMemo(() => {
    const term = q.trim().toLowerCase()
    return mine.filter((o) => {
      if (!inView(o, view)) return false
      if (!term) return true
      return o.id.toLowerCase().includes(term)
        || o.destination.city.toLowerCase().includes(term)
        || o.origin.city.toLowerCase().includes(term)
        || (o.contents || '').toLowerCase().includes(term)
        || o.receiver.name.toLowerCase().includes(term)
    })
  }, [mine, view, q])

  const paged = usePaged(rows, 12)

  const exportCsv = () => {
    const head = ['Shipment', 'Service', 'From', 'To', 'Receiver', 'Status', 'Weight kg', 'Amount', 'Booked', 'ETA', 'Delivered']
    const csv = [head, ...rows.map((o) => [
      o.id, serviceLabel(o.serviceId), o.origin.city, o.destination.city, o.receiver.name,
      statusLabel(o.status), o.quantity, o.amount, fmtDate(o.createdAt), fmtDate(o.etaAt),
      o.deliveredAt ? fmtDate(o.deliveredAt) : '',
    ])].map((r) => r.map((v) => '"' + String(v == null ? '' : v).replace(/"/g, '""') + '"').join(',')).join('\n')
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }))
    const a = document.createElement('a')
    a.href = url
    a.download = 'my-shipments-' + new Date().toISOString().slice(0, 10) + '.csv'
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <>
      <PageHeader
        title="My Orders"
        subtitle="Every shipment you have booked with us, and where each one has reached."
        actions={
          <>
            <button className="btn-ghost" onClick={exportCsv}><Download size={15} /> Export</button>
            <Link to="/portal/new-order" className="btn-primary"><PackagePlus size={16} /> Create order</Link>
          </>
        }
      />

      <Card>
        <Tabs className="px-2" active={view} onChange={setView} tabs={VIEWS.map((v) => ({ ...v, count: counts[v.id] }))} />

        <div className="border-b border-slate-200 p-4">
          <SearchInput value={q} onChange={setQ} placeholder="Shipment number, city, contents or receiver…" className="max-w-md" />
        </div>

        {mine.length === 0 ? (
          <div className="p-16">
            <EmptyState
              icon={PackagePlus}
              label="You have not booked anything yet"
              hint="Create your first shipment request and it will appear here."
              action={<Link to="/portal/new-order" className="btn-primary">Create order</Link>}
            />
          </div>
        ) : (
          <>
            <Table
              head={[
                { key: 'id', label: 'Shipment number' },
                { key: 'route', label: 'Route' },
                { key: 'svc', label: 'Service' },
                { key: 'st', label: 'Status' },
                { key: 'date', label: 'Booked / ETA' },
                { key: 'amt', label: 'Charge', align: 'right' },
              ]}
              empty={rows.length === 0}
              emptyLabel="Nothing in this view"
            >
              {paged.slice.map((o) => (
                <tr key={o.id} className="row-link" onClick={() => nav('/portal/orders/' + o.id)}>
                  <td className="td">
                    <p className="font-mono text-[13px] font-semibold text-navy-900">{o.id}</p>
                    <p className="truncate text-[11px] text-slate-400">{o.contents || 'General goods'} · {fmtUnits(o.serviceId, o.quantity)}</p>
                  </td>
                  <td className="td whitespace-nowrap text-slate-600">
                    {o.origin.city} <span className="text-slate-300">→</span> {o.destination.city}
                    <p className="truncate text-[11px] text-slate-400">to {o.receiver.name}</p>
                  </td>
                  <td className="td whitespace-nowrap text-slate-600">{serviceLabel(o.serviceId)}</td>
                  <td className="td"><StatusBadge status={o.status} /></td>
                  <td className="td whitespace-nowrap text-slate-600">
                    {fmtDate(o.createdAt)}
                    <p className="text-[11px] text-slate-400">
                      {o.status === 'delivered'
                        ? 'delivered ' + fmtAgo(o.deliveredAt)
                        : o.status === 'cancelled' || o.status === 'rejected' ? 'closed'
                        : 'due ' + fmtDate(o.etaAt)}
                    </p>
                  </td>
                  <td className="td text-right tnum font-semibold whitespace-nowrap">{fmtMoney(o.amount)}</td>
                </tr>
              ))}
            </Table>
            <Pagination {...paged} />
          </>
        )}
      </Card>
    </>
  )
}
