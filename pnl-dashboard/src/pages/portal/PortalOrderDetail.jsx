import { useMemo } from 'react'
import { Link, useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Package, ShieldCheck, Camera, PenLine, FileText, Mail } from 'lucide-react'
import { useData } from '../../store/DataContext'
import { useAuth } from '../../store/AuthContext'
import { serviceLabel, EMAIL_EVENTS } from '../../lib/domain'
import { fmtDate, fmtDateTime, fmtMoney, fmtUnits, fmtAgo } from '../../lib/format'
import { Card, PageHeader, Badge, KeyValue, EmptyState, SectionHeader } from '../../components/ui'
import { StatusBadge, InvoiceBadge } from '../../components/StatusBadge'
import { Timeline, TrackingRail } from '../../components/Timeline'

/**
 * The customer-facing view of one shipment: where it is, where it has been, and what it
 * cost. Read-only — changes to a booking go through our team.
 */
export default function PortalOrderDetail() {
  const { id } = useParams()
  const nav = useNavigate()
  const { db } = useData()
  const { customer } = useAuth()

  const order = db.orders.find((o) => o.id === id && o.customerId === customer.id)
  const invoice = useMemo(
    () => (order ? db.invoices.find((i) => i.orderId === order.id && i.status !== 'draft') : null),
    [db.invoices, order]
  )
  const emails = useMemo(
    () => (order ? db.emails.filter((e) => e.meta && e.meta.orderId === order.id) : []),
    [db.emails, order]
  )

  if (!order) {
    return (
      <div className="py-24">
        <EmptyState
          icon={Package}
          label="Shipment not found"
          hint="We could not find that shipment number on your account."
          action={<Link to="/portal/orders" className="btn-primary">Back to my orders</Link>}
        />
      </div>
    )
  }

  const closed = order.status === 'cancelled' || order.status === 'rejected'

  return (
    <>
      <button onClick={() => nav(-1)} className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-navy-900">
        <ArrowLeft size={15} /> Back
      </button>

      <PageHeader
        title={order.id}
        subtitle={serviceLabel(order.serviceId) + ' · ' + order.origin.city + ' → ' + order.destination.city + ' · booked ' + fmtAgo(order.createdAt)}
      />

      <div className="mb-5 flex flex-wrap items-center gap-2.5">
        <StatusBadge status={order.status} />
        {order.insured && <Badge tone="violet">Insured</Badge>}
        <Badge tone="slate">{order.pieces} piece(s) · {fmtUnits(order.serviceId, order.quantity)}</Badge>
        {order.status === 'delivered'
          ? <Badge tone="green">Delivered {fmtDate(order.deliveredAt)}</Badge>
          : !closed && <Badge tone="navy">Estimated delivery {fmtDate(order.etaAt)}</Badge>}
      </div>

      <Card className="mb-5 card-pad">
        <TrackingRail milestones={order.milestones} cancelled={closed} />
      </Card>

      <div className="grid gap-5 lg:grid-cols-3">
        <Card className="card-pad lg:col-span-2">
          <SectionHeader title="Tracking history" subtitle="Every update recorded against this shipment, newest first." />
          <div className="mt-5"><Timeline milestones={order.milestones} /></div>
        </Card>

        <div className="space-y-5">
          <Card className="card-pad">
            <SectionHeader title="Shipment details" />
            <div className="mt-4">
              <KeyValue cols={1} items={[
                { label: 'Service', value: serviceLabel(order.serviceId) },
                { label: 'Contents', value: order.contents || '—' },
                { label: 'Collection', value: order.origin.address ? order.origin.address + ', ' + order.origin.city : order.origin.city },
                { label: 'Delivery', value: order.destination.address ? order.destination.address + ', ' + order.destination.city : order.destination.city },
                { label: 'Shipper', value: order.sender && order.sender.name
                  ? order.sender.name + (order.sender.company ? ' · ' + order.sender.company : '')
                  : '—' },
                { label: 'Receiver', value: order.receiver.name
                  + (order.receiver.company ? ' · ' + order.receiver.company : '')
                  + (order.receiver.phone ? ' · ' + order.receiver.phone : '') },
                { label: 'Payment', value: order.paymentMode },
                { label: 'Charge', value: <span className="font-semibold">{fmtMoney(order.amount)}</span> },
              ]} />
            </div>
          </Card>

          {order.pod && (
            <Card className="card-pad border-emerald-200 bg-emerald-50/40">
              <SectionHeader title="Proof of delivery" subtitle={'Delivered ' + fmtDateTime(order.deliveredAt)} />
              <div className="mt-4 space-y-3">
                <div className="flex items-center gap-2.5">
                  <span className="grid h-9 w-9 place-items-center rounded-lg bg-white text-emerald-600 shadow-card"><PenLine size={16} /></span>
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Signed by</p>
                    <p className="text-sm font-semibold text-navy-900">{order.pod.signedBy}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2.5">
                  <span className="grid h-9 w-9 place-items-center rounded-lg bg-white text-emerald-600 shadow-card"><Camera size={16} /></span>
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Photo proof</p>
                    <p className="text-sm font-semibold text-navy-900">{order.pod.photo ? 'Captured' : 'Not captured'}</p>
                  </div>
                </div>
              </div>
            </Card>
          )}

          {invoice && (
            <Card className="card-pad">
              <SectionHeader
                title="Invoice"
                actions={<InvoiceBadge status={invoice.status} />}
              />
              <div className="mt-4 flex items-center gap-3">
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-navy-50 text-navy-600"><FileText size={16} /></span>
                <div className="min-w-0">
                  <p className="font-mono text-sm font-semibold text-navy-900">{invoice.id}</p>
                  <p className="text-xs text-slate-500">
                    {invoice.status === 'paid' ? 'Paid ' + fmtDate(invoice.paidAt) : 'Due ' + fmtDate(invoice.dueAt)}
                  </p>
                </div>
                <p className="ml-auto shrink-0 text-sm font-bold tnum text-navy-900">{fmtMoney(invoice.total)}</p>
              </div>
            </Card>
          )}

          <Card className="card-pad">
            <SectionHeader title="Updates we sent you" />
            {emails.length === 0 ? (
              <p className="mt-4 text-sm text-slate-500">No notifications for this shipment yet.</p>
            ) : (
              <ul className="mt-4 space-y-3">
                {emails.slice(0, 6).map((e) => (
                  <li key={e.id} className="flex items-start gap-2.5">
                    <span className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-slate-100 text-slate-500"><Mail size={13} /></span>
                    <div className="min-w-0">
                      <p className="text-sm text-navy-800">{EMAIL_EVENTS[e.type] ? EMAIL_EVENTS[e.type].label : e.type}</p>
                      <p className="text-[11px] text-slate-400">{fmtDateTime(e.at)}</p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          {order.status === 'requested' && (
            <Card className="card-pad border-amber-200 bg-amber-50">
              <div className="flex items-start gap-2.5">
                <ShieldCheck size={16} className="mt-0.5 shrink-0 text-amber-600" />
                <div>
                  <p className="text-sm font-semibold text-navy-900">Awaiting our confirmation</p>
                  <p className="mt-1 text-xs leading-relaxed text-amber-800">
                    We are reviewing this request. You will get an email as soon as it is confirmed,
                    and this page will start showing live milestones.
                  </p>
                </div>
              </div>
            </Card>
          )}
        </div>
      </div>
    </>
  )
}
