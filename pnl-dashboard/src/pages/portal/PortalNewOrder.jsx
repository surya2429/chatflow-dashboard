import { useNavigate } from 'react-router-dom'
import { Info, ShieldCheck, Clock } from 'lucide-react'
import { useData } from '../../store/DataContext'
import { useAuth } from '../../store/AuthContext'
import { Card, PageHeader, SectionHeader } from '../../components/ui'
import { OrderFormPanel } from '../../components/OrderForm'

const STEPS = [
  { icon: Info, title: 'You raise the request', body: 'Tell us what is moving and where. A shipment number is issued immediately — that is your tracking number too.' },
  { icon: Clock, title: 'We confirm it', body: 'Our team checks the route and the rate, then confirms the booking. You get an email either way.' },
  { icon: ShieldCheck, title: 'You follow it', body: 'Every milestone lands in your portal and your inbox, right through to proof of delivery.' },
]

/** The brief is explicit: customers create shipment requests without making online payments. */
export default function PortalNewOrder() {
  const { db, createOrder } = useData()
  const { customer } = useAuth()
  const nav = useNavigate()

  return (
    <>
      <PageHeader
        title="Create Order"
        subtitle="Tell us what needs moving. No payment is taken now — we confirm the rate first and invoice your account."
      />

      <div className="grid gap-5 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <OrderFormPanel
            customers={[customer]}
            branches={db.branches}
            lockedCustomerId={customer.id}
            submitLabel="Submit shipment request"
            onSubmit={(input) => {
              const created = createOrder(input, customer.name, 'customer')
              if (created) nav('/portal/orders/' + created.id)
            }}
          />
        </div>

        <div className="space-y-5">
          <Card className="card-pad">
            <SectionHeader title="What happens next" />
            <ol className="mt-4 space-y-4">
              {STEPS.map((s, i) => (
                <li key={s.title} className="flex gap-3">
                  <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-navy-900 text-[11px] font-bold text-white">{i + 1}</span>
                  <div>
                    <p className="text-sm font-semibold text-navy-900">{s.title}</p>
                    <p className="mt-0.5 text-xs leading-relaxed text-slate-500">{s.body}</p>
                  </div>
                </li>
              ))}
            </ol>
          </Card>

          <Card className="card-pad">
            <SectionHeader title="Booking for" />
            <div className="mt-3 space-y-1 text-sm">
              <p className="font-semibold text-navy-900">{customer.name}</p>
              {customer.company && <p className="text-slate-600">{customer.company}</p>}
              <p className="text-slate-600">{customer.email}</p>
              <p className="text-slate-600">{customer.city}, {customer.country}</p>
            </div>
            <p className="mt-4 text-xs leading-relaxed text-slate-500">
              Need something changed on your account? Contact us at {db.settings.supportEmail}.
            </p>
          </Card>
        </div>
      </div>
    </>
  )
}
