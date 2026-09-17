import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Mail, Bell, PackageCheck, Truck, FileText, UserCheck, Calculator } from 'lucide-react'
import { useData } from '../../store/DataContext'
import { useAuth } from '../../store/AuthContext'
import { EMAIL_EVENTS } from '../../lib/domain'
import { fmtDateTime, fmtAgo } from '../../lib/format'
import { Card, PageHeader, Tabs, EmptyState, Badge, SectionHeader } from '../../components/ui'

const ICONS = {
  customer_registration: UserCheck,
  shipment_creation: Truck,
  shipment_update: Truck,
  delivery_confirmation: PackageCheck,
  invoice_issued: FileText,
  quote_request: Calculator,
  contact_enquiry: Mail,
}
const TONES = {
  customer_registration: 'navy',
  shipment_creation: 'cyan',
  shipment_update: 'cyan',
  delivery_confirmation: 'green',
  invoice_issued: 'amber',
  quote_request: 'violet',
  contact_enquiry: 'slate',
}

const fill = (text, meta) =>
  String(text || '')
    .replace('{waybill}', (meta && meta.waybill) || '')
    .replace('{invoice}', (meta && meta.invoice) || '')

/** Everything Prime Next Logistics has sent this customer, newest first. */
export default function PortalNotifications() {
  const { db } = useData()
  const { customer } = useAuth()
  const [tab, setTab] = useState('all')

  const mine = useMemo(
    () => db.emails.filter((e) => e.customerId === customer.id),
    [db.emails, customer.id]
  )

  const counts = useMemo(() => ({
    all: mine.length,
    shipments: mine.filter((e) => ['shipment_creation', 'shipment_update', 'delivery_confirmation'].includes(e.type)).length,
    billing: mine.filter((e) => e.type === 'invoice_issued').length,
  }), [mine])

  const list = useMemo(() => {
    if (tab === 'shipments') return mine.filter((e) => ['shipment_creation', 'shipment_update', 'delivery_confirmation'].includes(e.type))
    if (tab === 'billing') return mine.filter((e) => e.type === 'invoice_issued')
    return mine
  }, [mine, tab])

  const unreadWeek = mine.filter((e) => Date.now() - new Date(e.at).getTime() < 7 * 864e5).length

  return (
    <>
      <PageHeader
        title="Notifications"
        subtitle="Every update we have emailed you about your account and your shipments."
      />

      <Card>
        <div className="card-pad pb-3">
          <SectionHeader
            title={counts.all + ' notifications'}
            subtitle={unreadWeek + ' in the last seven days'}
            actions={<Badge tone="navy" dot>{customer.email}</Badge>}
          />
        </div>

        <Tabs
          className="px-2"
          active={tab}
          onChange={setTab}
          tabs={[
            { id: 'all', label: 'All', count: counts.all },
            { id: 'shipments', label: 'Shipments', count: counts.shipments },
            { id: 'billing', label: 'Billing', count: counts.billing },
          ]}
        />

        {list.length === 0 ? (
          <div className="p-16"><EmptyState icon={Bell} label="Nothing here yet" hint="Updates about your shipments will appear here." /></div>
        ) : (
          <ul className="divide-y divide-slate-100">
            {list.slice(0, 80).map((e) => {
              const ev = EMAIL_EVENTS[e.type]
              const Icon = ICONS[e.type] || Mail
              const waybill = e.meta && e.meta.waybill
              return (
                <li key={e.id} className="flex items-start gap-3 px-5 py-4">
                  <span className={'mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-lg border ' + ({
                    navy: 'bg-navy-50 text-navy-600 border-navy-200',
                    cyan: 'bg-cyan-50 text-cyan-700 border-cyan-200',
                    green: 'bg-emerald-50 text-emerald-700 border-emerald-200',
                    amber: 'bg-amber-50 text-amber-700 border-amber-200',
                    violet: 'bg-violet-50 text-violet-700 border-violet-200',
                    slate: 'bg-slate-100 text-slate-500 border-slate-200',
                  }[TONES[e.type] || 'slate'])}>
                    <Icon size={16} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-navy-900">{ev ? ev.label : e.type}</p>
                    <p className="mt-0.5 text-sm text-slate-600">{fill(ev && ev.subject, e.meta)}</p>
                    <p className="mt-1 text-[11px] text-slate-400">{fmtDateTime(e.at)} · {fmtAgo(e.at)}</p>
                  </div>
                  {waybill && (
                    <Link to={'/portal/orders/' + waybill} className="shrink-0 self-center text-xs font-semibold text-navy-700 hover:underline">
                      View
                    </Link>
                  )}
                </li>
              )
            })}
          </ul>
        )}
      </Card>
    </>
  )
}
