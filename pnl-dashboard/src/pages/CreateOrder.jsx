import { Link, useNavigate } from 'react-router-dom'
import { PackagePlus, Info, ArrowRight } from 'lucide-react'
import { useData } from '../store/DataContext'
import { useAuth } from '../store/AuthContext'
import { serviceLabel } from '../lib/domain'
import { fmtAgo, fmtMoney } from '../lib/format'
import { Card, PageHeader, SectionHeader, EmptyState } from '../components/ui'
import { OrderFormPanel } from '../components/OrderForm'
import { StatusBadge } from '../components/StatusBadge'

/**
 * Booking a shipment on a customer's behalf — over the phone, at the counter, or from a
 * quotation. The number issued here is the number the customer tracks with.
 */
export default function CreateOrder() {
  const { db, createOrder } = useData()
  const { user } = useAuth()
  const nav = useNavigate()

  const recent = db.orders.filter((o) => o.placedBy === 'staff').slice(0, 6)
  const customerName = (id) => {
    const c = db.customers.find((x) => x.id === id)
    return c ? c.name : id
  }

  return (
    <>
      <PageHeader
        title="Create Order"
        subtitle="Raise a shipment request for a customer. No online payment is taken — the charge is billed against the account or collected on pickup."
      />

      <div className="grid gap-5 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <OrderFormPanel
            customers={db.customers.filter((c) => c.status !== 'suspended')}
            branches={db.branches}
            onSubmit={(input) => {
              const created = createOrder(input, user.name, 'staff')
              if (created) nav('/orders/' + created.id)
            }}
          />
        </div>

        <div className="space-y-5">
          <Card className="card-pad">
            <div className="flex items-start gap-2.5">
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-navy-50 text-navy-600"><Info size={15} /></span>
              <div>
                <p className="text-sm font-semibold text-navy-900">One number, end to end</p>
                <p className="mt-1 text-xs leading-relaxed text-slate-500">
                  The shipment number is issued the moment this request is raised. It is the order
                  reference, the tracking number and the reference on the invoice — there is no
                  second identifier to reconcile.
                </p>
              </div>
            </div>
          </Card>

          <Card>
            <div className="card-pad pb-3">
              <SectionHeader title="Raised by your team" subtitle="The most recent counter bookings." />
            </div>
            {recent.length === 0 ? (
              <div className="px-5 pb-8"><EmptyState icon={PackagePlus} label="Nothing booked yet" /></div>
            ) : (
              <ul className="divide-y divide-slate-100">
                {recent.map((o) => (
                  <li key={o.id}>
                    <Link to={'/orders/' + o.id} className="block px-5 py-3 hover:bg-navy-50/60">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-mono text-[13px] font-semibold text-navy-900">{o.id}</span>
                        <StatusBadge status={o.status} />
                      </div>
                      <p className="mt-0.5 truncate text-xs text-slate-500">
                        {customerName(o.customerId)} · {serviceLabel(o.serviceId)}
                      </p>
                      <p className="mt-0.5 flex items-center justify-between gap-2 text-[11px] text-slate-400">
                        <span>{o.origin.city} → {o.destination.city}</span>
                        <span className="tnum">{fmtMoney(o.amount)} · {fmtAgo(o.createdAt)}</span>
                      </p>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
            <Link to="/orders" className="flex items-center gap-1 border-t border-slate-100 px-5 py-2.5 text-xs font-semibold text-navy-700 hover:bg-slate-50">
              All order requests <ArrowRight size={13} />
            </Link>
          </Card>
        </div>
      </div>
    </>
  )
}
