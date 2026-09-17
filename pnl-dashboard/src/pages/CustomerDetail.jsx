import { useMemo, useState } from 'react'
import { Link, useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Pencil, Check, Ban, Mail, Package, Users, FileText, Activity } from 'lucide-react'
import { useData } from '../store/DataContext'
import { useAuth } from '../store/AuthContext'
import { EMAIL_EVENTS, serviceLabel } from '../lib/domain'
import { fmtDate, fmtDateTime, fmtAgo, fmtMoney, initials, avatarTone } from '../lib/format'
import {
  Card, Tabs, Table, KeyValue, Modal, Field, EmptyState, Avatar, Badge,
  SectionHeader, StatCard,
} from '../components/ui'
import { StatusBadge, CustomerBadge, InvoiceBadge } from '../components/StatusBadge'

function EditModal({ open, onClose, customer, onSave }) {
  const [f, setF] = useState({ ...customer })
  const set = (k) => (e) => setF((s) => ({ ...s, [k]: e.target.value }))
  return (
    <Modal
      open={open} onClose={onClose} title="Edit customer profile"
      footer={
        <>
          <button className="btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn-primary" onClick={() => { onSave(f); onClose() }}>Save profile</button>
        </>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Full name"><input className="field" value={f.name} onChange={set('name')} /></Field>
        <Field label="Company"><input className="field" value={f.company || ''} onChange={set('company')} /></Field>
        <Field label="Email"><input className="field" value={f.email} onChange={set('email')} /></Field>
        <Field label="Phone"><input className="field" value={f.phone} onChange={set('phone')} /></Field>
        <Field label="City"><input className="field" value={f.city} onChange={set('city')} /></Field>
        <Field label="Country"><input className="field" value={f.country} onChange={set('country')} /></Field>
        <Field label="Address" className="sm:col-span-2"><input className="field" value={f.address || ''} onChange={set('address')} /></Field>
        <Field label="Internal notes" className="sm:col-span-2">
          <textarea className="field min-h-[72px]" value={f.notes || ''} onChange={set('notes')} placeholder="Account preferences, special handling…" />
        </Field>
      </div>
    </Modal>
  )
}

export default function CustomerDetail() {
  const { id } = useParams()
  const nav = useNavigate()
  const { db, setCustomerStatus, updateCustomer } = useData()
  const { user, can } = useAuth()
  const [tab, setTab] = useState('orders')
  const [editing, setEditing] = useState(false)

  const customer = db.customers.find((c) => c.id === id)

  const orders = useMemo(() => db.orders.filter((o) => o.customerId === id), [db.orders, id])
  const invoices = useMemo(() => db.invoices.filter((i) => i.customerId === id), [db.invoices, id])
  const emails = useMemo(() => db.emails.filter((e) => e.customerId === id), [db.emails, id])
  const activity = useMemo(() => db.activity.filter((a) => a.customerId === id), [db.activity, id])

  if (!customer) {
    return (
      <div className="py-24">
        <EmptyState icon={Users} label="Customer not found" action={<Link to="/customers" className="btn-primary">Back to customers</Link>} />
      </div>
    )
  }

  const spend = orders.filter((o) => o.status !== 'cancelled').reduce((s, o) => s + o.amount, 0)
  const outstanding = invoices.filter((i) => i.status === 'sent').reduce((s, i) => s + i.total, 0)
  const delivered = orders.filter((o) => o.status === 'delivered').length

  return (
    <>
      <button onClick={() => nav(-1)} className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-navy-900">
        <ArrowLeft size={15} /> Back
      </button>

      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-center gap-4">
          <Avatar name={initials(customer.name)} tone={avatarTone(customer.name)} size="lg" />
          <div>
            <h1 className="text-xl font-bold tracking-tight text-navy-900">{customer.name}</h1>
            <p className="mt-0.5 text-sm text-slate-500">
              {customer.company || 'Individual account'} · {customer.id} · registered {fmtDate(customer.registeredAt)}
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              <CustomerBadge status={customer.status} />
              <Badge tone="slate">{customer.accountType === 'business' ? 'Business' : 'Individual'}</Badge>
              {customer.verified && <Badge tone="green">Verified</Badge>}
            </div>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button className="btn-ghost" onClick={() => setEditing(true)}><Pencil size={15} /> Edit profile</button>
          {customer.status === 'pending' && (
            <button className="btn-accent" onClick={() => setCustomerStatus(customer.id, 'active', user.name)}><Check size={15} /> Approve registration</button>
          )}
          {customer.status === 'active' && (
            <button className="btn-ghost text-red-600" onClick={() => setCustomerStatus(customer.id, 'suspended', user.name)}><Ban size={15} /> Suspend</button>
          )}
          {customer.status === 'suspended' && (
            <button className="btn-primary" onClick={() => setCustomerStatus(customer.id, 'active', user.name)}>Reactivate account</button>
          )}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Total orders" value={orders.length} icon={Package} tone="navy" hint={delivered + ' delivered'} />
        <StatCard label="Lifetime value" value={fmtMoney(spend)} icon={FileText} tone="green" />
        <StatCard label="Outstanding" value={fmtMoney(outstanding)} icon={FileText} tone="amber" hint={invoices.filter((i) => i.status === 'sent').length + ' unpaid invoices'} />
        <StatCard label="Notifications sent" value={emails.length} icon={Mail} tone="cyan" />
      </div>

      <div className="mt-6 grid gap-5 lg:grid-cols-3">
        <Card className="card-pad">
          <SectionHeader title="Profile" />
          <div className="mt-4">
            <KeyValue cols={1} items={[
              { label: 'Email', value: customer.email },
              { label: 'Phone', value: customer.phone },
              { label: 'Address', value: customer.address },
              { label: 'City / country', value: customer.city + ', ' + customer.country },
              { label: 'Registered', value: fmtDateTime(customer.registeredAt) },
              { label: 'Notes', value: customer.notes || '—' },
            ]} />
          </div>
        </Card>

        <div className="lg:col-span-2">
          <Tabs
            className="mb-4"
            active={tab}
            onChange={setTab}
            tabs={[
              { id: 'orders', label: 'Orders', count: orders.length },
              { id: 'invoices', label: 'Invoices', count: invoices.length },
              { id: 'activity', label: 'Activity log', count: activity.length },
              { id: 'emails', label: 'Notifications', count: emails.length },
            ]}
          />

          {tab === 'orders' && (
            <Card>
              <Table
                head={[{ key: 'id', label: 'Order' }, { key: 'route', label: 'Route' }, { key: 'svc', label: 'Service' }, { key: 'st', label: 'Status' }, { key: 'amt', label: 'Amount', align: 'right' }]}
                empty={orders.length === 0}
                emptyLabel="This customer has not booked anything yet"
              >
                {orders.map((o) => (
                  <tr key={o.id} className="row-link" onClick={() => can('order_requests') && nav('/orders/' + o.id)}>
                    <td className="td">
                      <p className="font-mono text-[13px] font-semibold text-navy-900">{o.id}</p>
                      <p className="text-[11px] text-slate-400">{fmtDate(o.createdAt)}</p>
                    </td>
                    <td className="td whitespace-nowrap text-slate-600">{o.origin.city} → {o.destination.city}</td>
                    <td className="td whitespace-nowrap text-slate-600">{serviceLabel(o.serviceId)}</td>
                    <td className="td"><StatusBadge status={o.status} /></td>
                    <td className="td text-right tnum font-semibold whitespace-nowrap">{fmtMoney(o.amount)}</td>
                  </tr>
                ))}
              </Table>
            </Card>
          )}

          {tab === 'invoices' && (
            <Card>
              <Table
                head={[{ key: 'id', label: 'Invoice' }, { key: 'order', label: 'Order' }, { key: 'issued', label: 'Issued' }, { key: 'st', label: 'Status' }, { key: 'amt', label: 'Total', align: 'right' }]}
                empty={invoices.length === 0}
                emptyLabel="No invoices raised for this customer"
              >
                {invoices.map((i) => (
                  <tr key={i.id}>
                    <td className="td font-mono text-[13px] font-semibold text-navy-900">{i.id}</td>
                    <td className="td text-slate-600">{i.orderId}</td>
                    <td className="td whitespace-nowrap text-slate-600">{fmtDate(i.issuedAt)}</td>
                    <td className="td"><InvoiceBadge status={i.status} /></td>
                    <td className="td text-right tnum font-semibold whitespace-nowrap">{fmtMoney(i.total)}</td>
                  </tr>
                ))}
              </Table>
            </Card>
          )}

          {tab === 'activity' && (
            <Card>
              {activity.length === 0 ? (
                <div className="p-12"><EmptyState icon={Activity} label="No activity recorded" /></div>
              ) : (
                <ul className="divide-y divide-slate-100">
                  {activity.slice(0, 40).map((a) => (
                    <li key={a.id} className="flex items-start gap-3 px-5 py-3">
                      <Badge tone={a.kind === 'shipment' ? 'cyan' : a.kind === 'order' ? 'navy' : a.kind === 'invoice' ? 'green' : 'slate'}>{a.kind}</Badge>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm text-navy-800">{a.action}</p>
                        <p className="mt-0.5 text-xs text-slate-400">{a.actor} · {fmtDateTime(a.at)}</p>
                      </div>
                      {a.orderId && can('order_requests') && (
                        <Link to={'/orders/' + a.orderId} className="shrink-0 text-xs font-semibold text-navy-700 hover:underline">Open</Link>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          )}

          {tab === 'emails' && (
            <Card>
              {emails.length === 0 ? (
                <div className="p-12"><EmptyState icon={Mail} label="No notifications sent" /></div>
              ) : (
                <ul className="divide-y divide-slate-100">
                  {emails.slice(0, 40).map((e) => (
                    <li key={e.id} className="flex items-start gap-3 px-5 py-3">
                      <span className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-navy-50 text-navy-600"><Mail size={14} /></span>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-navy-900">{EMAIL_EVENTS[e.type] ? EMAIL_EVENTS[e.type].label : e.type}</p>
                        <p className="truncate text-xs text-slate-500">
                          {(EMAIL_EVENTS[e.type] ? EMAIL_EVENTS[e.type].subject : '')
                            .replace('{waybill}', (e.meta && e.meta.waybill) || '')
                            .replace('{invoice}', (e.meta && e.meta.invoice) || '')}
                        </p>
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
          )}
        </div>
      </div>

      {editing && (
        <EditModal
          open={editing}
          onClose={() => setEditing(false)}
          customer={customer}
          onSave={(f) => updateCustomer(customer.id, f, user.name)}
        />
      )}
    </>
  )
}
