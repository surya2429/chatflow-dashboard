import { useMemo, useState, useEffect } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { Check, X, Download, Filter, PackagePlus } from 'lucide-react'
import { useData } from '../store/DataContext'
import { useAuth } from '../store/AuthContext'
import { STATUS, SERVICES, serviceLabel, statusLabel, isLive } from '../lib/domain'
import { fmtDate, fmtMoney, fmtUnits, fmtAgo } from '../lib/format'
import {
  Card, PageHeader, Table, SearchInput, Select, Pagination, usePaged, Tabs, Badge, Modal, Field,
} from '../components/ui'
import { StatusBadge } from '../components/StatusBadge'

const VIEWS = [
  { id: 'requested', label: 'New requests' },
  { id: 'active', label: 'Active' },
  { id: 'delivered', label: 'Completed' },
  { id: 'closed', label: 'Cancelled / rejected' },
  { id: 'all', label: 'All orders' },
]

const inView = (o, view) => {
  if (view === 'all') return true
  if (view === 'active') return isLive(o.status)
  if (view === 'closed') return o.status === 'cancelled' || o.status === 'rejected'
  return o.status === view
}

/**
 * The order desk: requests waiting on a decision, everything currently moving, and the
 * closed book behind them. Confirming a request here is what turns it into a live shipment.
 */
export default function OrderRequests() {
  const { db, confirmOrder, rejectOrder } = useData()
  const { user } = useAuth()
  const nav = useNavigate()
  const [params, setParams] = useSearchParams()

  const [view, setView] = useState(params.get('status') || 'requested')
  const [q, setQ] = useState('')
  const [service, setService] = useState('all')
  const [rejecting, setRejecting] = useState(null)
  const [reason, setReason] = useState('')

  useEffect(() => {
    const s = params.get('status')
    if (s && s !== view) setView(s)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params])

  const customerOf = useMemo(() => {
    const map = {}
    db.customers.forEach((c) => { map[c.id] = c })
    return map
  }, [db.customers])

  const counts = useMemo(() => ({
    requested: db.orders.filter((o) => o.status === 'requested').length,
    active: db.orders.filter((o) => isLive(o.status)).length,
    delivered: db.orders.filter((o) => o.status === 'delivered').length,
    closed: db.orders.filter((o) => o.status === 'cancelled' || o.status === 'rejected').length,
    all: db.orders.length,
  }), [db.orders])

  const rows = useMemo(() => {
    const term = q.trim().toLowerCase()
    return db.orders.filter((o) => {
      if (!inView(o, view)) return false
      if (service !== 'all' && o.serviceId !== service) return false
      if (!term) return true
      const c = customerOf[o.customerId]
      return o.id.toLowerCase().includes(term)
        || (c && (c.name.toLowerCase().includes(term) || c.email.toLowerCase().includes(term)))
        || o.destination.city.toLowerCase().includes(term)
        || o.origin.city.toLowerCase().includes(term)
    })
  }, [db.orders, q, view, service, customerOf])

  const paged = usePaged(rows, 12)

  const changeView = (v) => {
    setView(v)
    if (params.get('status')) { params.delete('status'); setParams(params, { replace: true }) }
  }

  const exportCsv = () => {
    const head = ['Shipment', 'Customer', 'Service', 'Origin', 'Destination', 'Status', 'Weight kg', 'Amount', 'Raised', 'ETA', 'Placed by']
    const lines = rows.map((o) => [
      o.id, (customerOf[o.customerId] || {}).name || '', serviceLabel(o.serviceId),
      o.origin.city, o.destination.city, statusLabel(o.status), o.quantity, o.amount,
      fmtDate(o.createdAt), fmtDate(o.etaAt), o.placedBy,
    ])
    const csv = [head, ...lines].map((r) => r.map((v) => '"' + String(v).replace(/"/g, '""') + '"').join(',')).join('\n')
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }))
    const a = document.createElement('a')
    a.href = url
    a.download = 'pnc-orders-' + new Date().toISOString().slice(0, 10) + '.csv'
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <>
      <PageHeader
        title="Order Requests"
        subtitle="Confirm or reject incoming requests, then drive each shipment through its delivery status."
        actions={
          <>
            <button className="btn-ghost" onClick={exportCsv}><Download size={15} /> Export CSV</button>
            <Link to="/create-order" className="btn-primary"><PackagePlus size={16} /> Create order</Link>
          </>
        }
      />

      <Card>
        <Tabs
          className="px-2"
          active={view}
          onChange={changeView}
          tabs={VIEWS.map((v) => ({ ...v, count: counts[v.id] }))}
        />

        <div className="flex flex-wrap items-center gap-3 border-b border-slate-200 p-4">
          <SearchInput value={q} onChange={setQ} placeholder="Shipment number, customer or city…" className="min-w-[240px] flex-1" />
          <div className="flex items-center gap-2">
            <Filter size={15} className="text-slate-400" />
            <Select
              value={service}
              onChange={setService}
              options={[{ value: 'all', label: 'All services' }, ...SERVICES.map((s) => ({ value: s.id, label: s.label }))]}
              className="w-48"
            />
          </div>
        </div>

        <Table
          head={[
            { key: 'id', label: 'Shipment number' },
            { key: 'cust', label: 'Customer' },
            { key: 'route', label: 'Route' },
            { key: 'svc', label: 'Service' },
            { key: 'st', label: 'Status' },
            { key: 'eta', label: 'ETA' },
            { key: 'amt', label: 'Amount', align: 'right' },
            { key: 'act', label: '' },
          ]}
          empty={rows.length === 0}
          emptyLabel={view === 'requested' ? 'No requests waiting — the queue is clear' : 'No orders match these filters'}
        >
          {paged.slice.map((o) => {
            const c = customerOf[o.customerId]
            const late = isLive(o.status) && new Date(o.etaAt) < new Date()
            return (
              <tr key={o.id} className="row-link" onClick={() => nav('/orders/' + o.id)}>
                <td className="td">
                  <p className="font-mono text-[13px] font-semibold text-navy-900">{o.id}</p>
                  <p className="text-[11px] text-slate-400">
                    {o.placedBy === 'customer' ? 'From the customer portal' : 'Raised by our team'}
                  </p>
                </td>
                <td className="td max-w-[200px]">
                  <p className="truncate font-medium text-navy-900">{c ? c.name : '—'}</p>
                  <p className="truncate text-[11px] text-slate-400">{c && c.company ? c.company : c ? c.email : ''}</p>
                </td>
                <td className="td whitespace-nowrap text-slate-600">
                  {o.origin.city} <span className="text-slate-300">→</span> {o.destination.city}
                  <p className="text-[11px] text-slate-400">{o.pieces} pc · {fmtUnits(o.serviceId, o.quantity)}</p>
                </td>
                <td className="td whitespace-nowrap text-slate-600">{serviceLabel(o.serviceId)}</td>
                <td className="td"><StatusBadge status={o.status} /></td>
                <td className="td whitespace-nowrap">
                  <span className={late ? 'text-red-600' : 'text-slate-600'}>{fmtDate(o.etaAt)}</span>
                  <p className="text-[11px] text-slate-400">raised {fmtAgo(o.createdAt)}</p>
                </td>
                <td className="td text-right tnum font-semibold whitespace-nowrap">{fmtMoney(o.amount)}</td>
                <td className="td text-right">
                  {o.status === 'requested' ? (
                    <div className="flex justify-end gap-1">
                      <button
                        className="btn-accent btn-sm"
                        onClick={(e) => { e.stopPropagation(); confirmOrder(o.id, user.name) }}
                      >
                        <Check size={13} /> Confirm
                      </button>
                      <button
                        className="btn-ghost btn-sm text-red-600"
                        onClick={(e) => { e.stopPropagation(); setRejecting(o); setReason('') }}
                      >
                        <X size={13} />
                      </button>
                    </div>
                  ) : (
                    <Link to={'/orders/' + o.id} className="btn-ghost btn-sm" onClick={(e) => e.stopPropagation()}>Open</Link>
                  )}
                </td>
              </tr>
            )
          })}
        </Table>

        <Pagination {...paged} />
      </Card>

      <div className="mt-4 flex flex-wrap items-center gap-2 text-xs text-slate-500">
        <span className="font-semibold uppercase tracking-wide">Legend</span>
        {Object.entries(STATUS).map(([k, s]) => <Badge key={k} tone={s.tone} dot>{s.label}</Badge>)}
      </div>

      <Modal
        open={!!rejecting}
        onClose={() => setRejecting(null)}
        title={rejecting ? 'Reject request ' + rejecting.id + '?' : ''}
        width="max-w-md"
        footer={
          <>
            <button className="btn-ghost" onClick={() => setRejecting(null)}>Keep request</button>
            <button
              className="btn-danger"
              onClick={() => { rejectOrder(rejecting.id, reason, user.name); setRejecting(null) }}
            >
              <X size={15} /> Reject request
            </button>
          </>
        }
      >
        <p className="text-sm text-slate-600">
          The customer is emailed with the reason and the shipment number is closed. Nothing is collected.
        </p>
        <Field label="Reason" className="mt-4">
          <input className="field" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Restricted contents for this destination" />
        </Field>
      </Modal>
    </>
  )
}
