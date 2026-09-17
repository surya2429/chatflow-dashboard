import { useMemo, useState } from 'react'
import { Link, useParams, useNavigate, useSearchParams } from 'react-router-dom'
import {
  ArrowLeft, MapPinned, Ban, Pencil, FileText, ExternalLink, Package, Check, X,
  ShieldCheck, Camera, PenLine, Send, Mail, Paperclip, Plus,
} from 'lucide-react'
import { useData } from '../store/DataContext'
import { useAuth } from '../store/AuthContext'
import {
  MILESTONE_KEYS, MILESTONES, NEXT_STATUS, statusLabel, serviceLabel, milestoneLabel,
  EMAIL_EVENTS, isLive, serviceById,
} from '../lib/domain'
import { fmtDate, fmtDateTime, fmtMoney, fmtUnits, fmtAgo, initials, avatarTone } from '../lib/format'
import {
  Card, PageHeader, Tabs, Badge, KeyValue, Modal, Field, Select, Toggle,
  EmptyState, Avatar, SectionHeader,
} from '../components/ui'
import { StatusBadge, InvoiceBadge } from '../components/StatusBadge'
import { Timeline, TrackingRail } from '../components/Timeline'
import OrderForm from '../components/OrderForm'

/* ── Log a milestone ───────────────────────────────────────────────────────── */
function MilestoneModal({ open, onClose, order, onSave }) {
  const suggested = NEXT_STATUS[order.status] || []
  const firstCode = MILESTONE_KEYS.find(
    (k) => !order.milestones.some((m) => m.code === k) && !['order_placed', 'order_confirmed'].includes(k)
  ) || 'in_transit'
  const [code, setCode] = useState(firstCode)
  const [location, setLocation] = useState(order.destination.city + ', ' + order.destination.country)
  const [hub, setHub] = useState(order.destination.hub)
  const [note, setNote] = useState('')
  const [signedBy, setSignedBy] = useState(order.receiver.name)
  const [photo, setPhoto] = useState(false)

  const isDelivery = code === 'delivered'

  return (
    <Modal
      open={open} onClose={onClose}
      title="Update shipment milestone"
      subtitle="The order status moves with the milestone and the customer is emailed automatically."
      footer={
        <>
          <button className="btn-ghost" onClick={onClose}>Cancel</button>
          <button
            className="btn-primary"
            onClick={() => { onSave({ code, location, hub, note, pod: isDelivery ? { signedBy, photo } : null }); onClose() }}
          >
            <MapPinned size={16} /> Log milestone
          </button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="Milestone" hint={'Current status: ' + statusLabel(order.status) + (suggested.length ? ' · suggested next: ' + suggested.map(statusLabel).join(', ') : '')}>
          <Select value={code} onChange={setCode} options={MILESTONE_KEYS.map((k) => ({ value: k, label: MILESTONES[k] }))} />
        </Field>
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Location" className="sm:col-span-2">
            <input className="field" value={location} onChange={(e) => setLocation(e.target.value)} />
          </Field>
          <Field label="Hub code">
            <input className="field font-mono uppercase" value={hub} onChange={(e) => setHub(e.target.value.toUpperCase())} maxLength={4} />
          </Field>
        </div>
        <Field label="Note to record" hint="Shown on the tracking history and in the customer notification.">
          <textarea className="field min-h-[68px]" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Held at customs, consignee unavailable…" />
        </Field>

        {isDelivery && (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
            <p className="flex items-center gap-2 text-sm font-semibold text-emerald-800">
              <ShieldCheck size={15} /> Proof of delivery
            </p>
            <div className="mt-3 space-y-3">
              <Field label="Signed by">
                <input className="field" value={signedBy} onChange={(e) => setSignedBy(e.target.value)} placeholder="Name of the person who received it" />
              </Field>
              <Toggle checked={photo} onChange={setPhoto} label="Photo proof captured" hint="Recorded against the shipment for dispute handling." />
            </div>
          </div>
        )}
      </div>
    </Modal>
  )
}

/* ── Page ──────────────────────────────────────────────────────────────────── */
export default function OrderDetail() {
  const { id } = useParams()
  const nav = useNavigate()
  const [params, setParams] = useSearchParams()
  const {
    db, confirmOrder, rejectOrder, addMilestone, cancelOrder, updateOrder, createInvoice, setInvoiceStatus,
  } = useData()
  const { user, can } = useAuth()

  const order = db.orders.find((o) => o.id === id)
  const [tab, setTab] = useState(params.get('tab') || 'shipment')
  const [milestoneOpen, setMilestoneOpen] = useState(false)
  const [editing, setEditing] = useState(false)
  const [closing, setClosing] = useState(null)   // 'cancel' | 'reject'
  const [reason, setReason] = useState('')

  const customer = useMemo(
    () => (order ? db.customers.find((c) => c.id === order.customerId) : null),
    [db.customers, order]
  )
  const invoice = useMemo(() => (order ? db.invoices.find((i) => i.orderId === order.id) : null), [db.invoices, order])
  const emails = useMemo(
    () => (order ? db.emails.filter((e) => e.meta && e.meta.orderId === order.id) : []),
    [db.emails, order]
  )
  const activity = useMemo(
    () => (order ? db.activity.filter((a) => a.orderId === order.id) : []),
    [db.activity, order]
  )

  if (!order) {
    return (
      <div className="py-24">
        <EmptyState label="Shipment not found" hint="It may have been removed, or the link is out of date." icon={Package}
          action={<Link to="/orders" className="btn-primary">Back to order requests</Link>} />
      </div>
    )
  }

  const setTabAndUrl = (t) => {
    setTab(t)
    params.set('tab', t)
    setParams(params, { replace: true })
  }

  const isRequest = order.status === 'requested'
  const moving = isLive(order.status)

  return (
    <>
      <button onClick={() => nav(-1)} className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-navy-900">
        <ArrowLeft size={15} /> Back
      </button>

      <PageHeader
        title={order.id}
        subtitle={
          <>
            {serviceLabel(order.serviceId)} · {order.origin.city} → {order.destination.city} · raised {fmtAgo(order.createdAt)}
          </>
        }
        actions={
          <>
            {isRequest && (
              <>
                <button className="btn-accent" onClick={() => confirmOrder(order.id, user.name)}>
                  <Check size={16} /> Confirm booking
                </button>
                <button className="btn-ghost text-red-600" onClick={() => { setClosing('reject'); setReason('') }}>
                  <X size={15} /> Reject
                </button>
              </>
            )}
            {moving && (
              <button className="btn-primary" onClick={() => setMilestoneOpen(true)}>
                <MapPinned size={16} /> Update status
              </button>
            )}
            <button className="btn-ghost" onClick={() => setEditing(true)}><Pencil size={15} /> Edit</button>
            {moving && (
              <button className="btn-ghost text-red-600" onClick={() => { setClosing('cancel'); setReason('') }}>
                <Ban size={15} /> Cancel
              </button>
            )}
          </>
        }
      />

      <div className="mb-5 flex flex-wrap items-center gap-2.5">
        <StatusBadge status={order.status} />
        <Badge tone="navy"><span className="font-mono">{order.id}</span> · order &amp; tracking number</Badge>
        <Badge tone="slate">{order.placedBy === 'customer' ? 'From the customer portal' : 'Raised by our team'}</Badge>
        {order.insured && <Badge tone="violet">Insured</Badge>}
        {invoice && <Badge tone={invoice.status === 'paid' ? 'green' : 'slate'}>{invoice.id} · {invoice.status}</Badge>}
      </div>

      <Card className="mb-5 card-pad">
        <TrackingRail
          milestones={order.milestones}
          cancelled={order.status === 'cancelled' || order.status === 'rejected'}
        />
      </Card>

      <Tabs
        className="mb-5"
        active={tab}
        onChange={setTabAndUrl}
        tabs={[
          { id: 'shipment', label: 'Shipment details' },
          { id: 'tracking', label: 'Tracking history', count: order.milestones.length },
          { id: 'invoice', label: 'Invoice' },
          { id: 'activity', label: 'Notifications & activity', count: emails.length + activity.length },
        ]}
      />

      {tab === 'shipment' && (
        <div className="grid gap-5 lg:grid-cols-3">
          <div className="space-y-5 lg:col-span-2">
            <Card className="card-pad">
              <SectionHeader title="Consignment" />
              <div className="mt-4">
                <KeyValue items={[
                  { label: 'Service', value: serviceLabel(order.serviceId) },
                  { label: 'Contents', value: order.contents || '—' },
                  { label: 'Pieces', value: order.pieces },
                  { label: serviceById(order.serviceId).unitLabel, value: fmtUnits(order.serviceId, order.quantity) },
                  { label: 'Declared value', value: fmtMoney(order.declaredValue) },
                  { label: 'Insurance', value: order.insured ? 'Covered' : 'Not covered' },
                  { label: 'Payment method', value: order.paymentMode },
                  { label: 'Charge', value: <span className="font-semibold">{fmtMoney(order.amount)}</span> },
                ]} />
              </div>
              {order.notes && (
                <p className="mt-5 rounded-lg border border-amber-200 bg-amber-50 px-3.5 py-2.5 text-sm text-amber-800">{order.notes}</p>
              )}
            </Card>

            <div className="grid gap-5 sm:grid-cols-2">
              <Card className="card-pad">
                <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Collection</p>
                <p className="mt-2 text-sm font-semibold text-navy-900">{order.origin.city}, {order.origin.country}</p>
                <p className="mt-0.5 text-sm text-slate-600">{order.origin.address || '—'}</p>
                <p className="mt-2 inline-block rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[10px] text-slate-500">{order.origin.hub}</p>
              </Card>
              <Card className="card-pad">
                <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Delivery</p>
                <p className="mt-2 text-sm font-semibold text-navy-900">{order.destination.city}, {order.destination.country}</p>
                <p className="mt-0.5 text-sm text-slate-600">{order.destination.address || '—'}</p>
                <p className="mt-2 text-sm text-slate-600">{order.receiver.name} · {order.receiver.phone}</p>
                <p className="mt-2 inline-block rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[10px] text-slate-500">{order.destination.hub}</p>
              </Card>
            </div>

            {order.pod && (
              <Card className="card-pad border-emerald-200 bg-emerald-50/40">
                <SectionHeader title="Proof of delivery" subtitle={'Delivered ' + fmtDateTime(order.deliveredAt)} />
                <div className="mt-4 flex flex-wrap gap-6">
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
                {order.pod.note && <p className="mt-4 text-sm text-slate-600">{order.pod.note}</p>}
              </Card>
            )}

            <Card className="card-pad">
              <SectionHeader
                title="Documents"
                subtitle="Paperwork uploaded with the shipment request."
                actions={<button className="btn-ghost btn-sm" onClick={() => updateOrder(order.id, {
                  documents: [...order.documents, { id: 'DOC-' + (order.documents.length + 1), name: 'uploaded-document-' + (order.documents.length + 1) + '.pdf', size: '128 KB', at: new Date().toISOString() }],
                }, user.name)}><Plus size={13} /> Add document</button>}
              />
              {order.documents.length === 0 ? (
                <p className="mt-4 text-sm text-slate-500">No documents attached to this shipment.</p>
              ) : (
                <ul className="mt-4 divide-y divide-slate-100">
                  {order.documents.map((d) => (
                    <li key={d.id} className="flex items-center gap-3 py-2.5">
                      <Paperclip size={15} className="text-slate-400" />
                      <span className="flex-1 truncate text-sm text-navy-800">{d.name}</span>
                      <span className="text-xs text-slate-400">{d.size}</span>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </div>

          <div className="space-y-5">
            <Card className="card-pad">
              <SectionHeader title="Customer" />
              {customer ? (
                <>
                  <div className="mt-4 flex items-center gap-3">
                    <Avatar name={initials(customer.name)} tone={avatarTone(customer.name)} size="lg" />
                    <div className="min-w-0">
                      <p className="truncate font-semibold text-navy-900">{customer.name}</p>
                      <p className="truncate text-sm text-slate-500">{customer.company || customer.accountType}</p>
                    </div>
                  </div>
                  <div className="mt-4 space-y-2 text-sm">
                    <p className="truncate text-slate-600">{customer.email}</p>
                    <p className="text-slate-600">{customer.phone}</p>
                    <p className="text-slate-600">{customer.city}, {customer.country}</p>
                  </div>
                  {can('customers') && (
                    <Link to={'/customers/' + customer.id} className="btn-ghost btn-sm mt-4 w-full">
                      View customer profile <ExternalLink size={13} />
                    </Link>
                  )}
                </>
              ) : <p className="mt-4 text-sm text-slate-500">Customer record not found.</p>}
            </Card>

            <Card className="card-pad">
              <SectionHeader title="Schedule" />
              <div className="mt-4">
                <KeyValue cols={1} items={[
                  { label: 'Request raised', value: fmtDateTime(order.createdAt) },
                  { label: 'Promised ETA', value: fmtDate(order.etaAt) },
                  { label: 'Last update', value: fmtDateTime(order.updatedAt) },
                  { label: 'Delivered', value: order.deliveredAt ? fmtDateTime(order.deliveredAt) : 'Not yet delivered' },
                ]} />
              </div>
            </Card>
          </div>
        </div>
      )}

      {tab === 'tracking' && (
        <div className="grid gap-5 lg:grid-cols-3">
          <Card className="card-pad lg:col-span-2">
            <SectionHeader
              title="Tracking history"
              subtitle="Every milestone recorded against this shipment, newest first."
              actions={moving ? (
                <button className="btn-primary btn-sm" onClick={() => setMilestoneOpen(true)}><MapPinned size={14} /> Update</button>
              ) : null}
            />
            <div className="mt-5"><Timeline milestones={order.milestones} /></div>
          </Card>
          <Card className="card-pad">
            <SectionHeader title="What the customer sees" subtitle="The public tracking view for this number." />
            <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
              <p className="font-mono text-sm font-bold text-navy-900">{order.id}</p>
              <p className="mt-1 text-xs text-slate-500">{order.origin.city} → {order.destination.city}</p>
              <p className="mt-4 text-xs font-semibold uppercase tracking-wide text-slate-500">Latest status</p>
              <p className="mt-1 text-sm font-semibold text-navy-900">
                {milestoneLabel(order.milestones[order.milestones.length - 1].code)}
              </p>
              <p className="text-xs text-slate-500">{order.milestones[order.milestones.length - 1].location}</p>
              <p className="mt-3 text-xs text-slate-500">
                {order.status === 'delivered'
                  ? 'Delivered ' + fmtDate(order.deliveredAt)
                  : order.status === 'cancelled' ? 'Shipment cancelled'
                  : order.status === 'rejected' ? 'Request rejected'
                  : 'Estimated delivery ' + fmtDate(order.etaAt)}
              </p>
            </div>
            <p className="mt-4 text-xs leading-relaxed text-slate-500">
              The customer sees this in their portal and on the website tracking page, and receives
              the same information by email each time a milestone is recorded.
            </p>
          </Card>
        </div>
      )}

      {tab === 'invoice' && (
        <Card>
          {invoice ? (
            <>
              <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-200 p-5">
                <div>
                  <p className="text-lg font-bold text-navy-900">{invoice.id}</p>
                  <p className="mt-1 text-sm text-slate-500">
                    Issued {fmtDate(invoice.issuedAt)} · due {fmtDate(invoice.dueAt)}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <InvoiceBadge status={invoice.status} />
                  {can('invoices') && invoice.status === 'draft' && (
                    <button className="btn-primary btn-sm" onClick={() => setInvoiceStatus(invoice.id, 'sent', user.name)}><Send size={13} /> Send to customer</button>
                  )}
                  {can('invoices') && invoice.status === 'sent' && (
                    <button className="btn-primary btn-sm" onClick={() => setInvoiceStatus(invoice.id, 'paid', user.name)}>Mark paid</button>
                  )}
                </div>
              </div>
              <div className="p-5">
                <table className="w-full">
                  <tbody>
                    {invoice.lines.map((l) => (
                      <tr key={l.label}>
                        <td className="py-2 text-sm text-slate-600">{l.label}</td>
                        <td className="py-2 text-right text-sm tnum text-navy-800">{fmtMoney(l.amount)}</td>
                      </tr>
                    ))}
                    <tr className="border-t border-slate-200">
                      <td className="pt-3 text-sm font-bold text-navy-900">Total</td>
                      <td className="pt-3 text-right text-sm font-bold tnum text-navy-900">{fmtMoney(invoice.total)}</td>
                    </tr>
                  </tbody>
                </table>
                {invoice.paidAt && <p className="mt-4 text-sm text-emerald-700">Paid {fmtDateTime(invoice.paidAt)}</p>}
              </div>
            </>
          ) : (
            <div className="p-12">
              <EmptyState
                icon={FileText}
                label="No invoice raised for this shipment yet"
                hint="Generate one whenever the shipment is ready to bill."
                action={can('invoices') ? (
                  <button className="btn-primary" onClick={() => createInvoice(order.id, user.name)}>
                    <FileText size={15} /> Generate invoice
                  </button>
                ) : null}
              />
            </div>
          )}
        </Card>
      )}

      {tab === 'activity' && (
        <div className="grid gap-5 lg:grid-cols-2">
          <Card>
            <div className="card-pad pb-3">
              <SectionHeader title="Automated notifications" subtitle="Emails this shipment has triggered." />
            </div>
            {emails.length === 0 ? (
              <div className="px-5 pb-10"><EmptyState label="No notifications sent yet" icon={Mail} /></div>
            ) : (
              <ul className="divide-y divide-slate-100">
                {emails.map((e) => (
                  <li key={e.id} className="flex items-start gap-3 px-5 py-3">
                    <span className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-navy-50 text-navy-600"><Mail size={14} /></span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-navy-900">
                        {EMAIL_EVENTS[e.type] ? EMAIL_EVENTS[e.type].label : e.type}
                      </p>
                      <p className="truncate text-xs text-slate-500">{e.to}</p>
                    </div>
                    <div className="shrink-0 text-right">
                      <Badge tone={e.status === 'delivered' ? 'green' : 'red'}>{e.status}</Badge>
                      <p className="mt-1 text-[11px] text-slate-400">{fmtAgo(e.at)}</p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card>
            <div className="card-pad pb-3">
              <SectionHeader title="Audit trail" subtitle="Who changed what on this shipment." />
            </div>
            {activity.length === 0 ? (
              <div className="px-5 pb-10"><EmptyState label="Nothing logged yet" /></div>
            ) : (
              <ul className="divide-y divide-slate-100">
                {activity.map((a) => (
                  <li key={a.id} className="px-5 py-3">
                    <p className="text-sm text-navy-800">{a.action}</p>
                    <p className="mt-0.5 text-xs text-slate-400">{a.actor} · {fmtDateTime(a.at)}</p>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      )}

      {milestoneOpen && (
        <MilestoneModal
          open={milestoneOpen}
          onClose={() => setMilestoneOpen(false)}
          order={order}
          onSave={(payload) => addMilestone(order.id, payload, user.name)}
        />
      )}

      {editing && (
        <OrderForm
          open={editing}
          onClose={() => setEditing(false)}
          order={order}
          customers={db.customers}
          branches={db.branches}
          onSubmit={(input) => updateOrder(order.id, input, user.name)}
        />
      )}

      <Modal
        open={!!closing}
        onClose={() => setClosing(null)}
        title={(closing === 'reject' ? 'Reject request ' : 'Cancel shipment ') + order.id + '?'}
        width="max-w-md"
        footer={
          <>
            <button className="btn-ghost" onClick={() => setClosing(null)}>Keep it open</button>
            <button
              className="btn-danger"
              onClick={() => {
                if (closing === 'reject') rejectOrder(order.id, reason, user.name)
                else cancelOrder(order.id, reason, user.name)
                setClosing(null)
              }}
            >
              {closing === 'reject' ? <X size={15} /> : <Ban size={15} />}
              {closing === 'reject' ? 'Reject request' : 'Cancel shipment'}
            </button>
          </>
        }
      >
        <p className="text-sm text-slate-600">
          {closing === 'reject'
            ? 'The customer is emailed with the reason and the shipment number is closed. Nothing is collected.'
            : 'The shipment stops moving, the customer is notified and any unpaid invoice is voided.'}
        </p>
        <Field label="Reason" className="mt-4">
          <input
            className="field" value={reason} onChange={(e) => setReason(e.target.value)}
            placeholder={closing === 'reject' ? 'Restricted contents for this destination' : 'Customer withdrew the booking'}
          />
        </Field>
      </Modal>
    </>
  )
}
