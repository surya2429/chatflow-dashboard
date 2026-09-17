import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Mail, MailCheck, MailX, Send, Bell } from 'lucide-react'
import { useData } from '../store/DataContext'
import { useAuth } from '../store/AuthContext'
import { EMAIL_EVENTS } from '../lib/domain'
import { fmtDateTime, fmtAgo, pct, fmtNum } from '../lib/format'
import {
  Card, PageHeader, Tabs, Table, SearchInput, Select, Pagination, usePaged,
  StatCard, Badge, Toggle, SectionHeader,
} from '../components/ui'

const fill = (text, meta) =>
  String(text || '')
    .replace('{waybill}', (meta && meta.waybill) || '—')
    .replace('{invoice}', (meta && meta.invoice) || '—')

export default function Notifications() {
  const { db, updateSettings } = useData()
  const { can } = useAuth()
  const [tab, setTab] = useState('log')
  const [q, setQ] = useState('')
  const [type, setType] = useState('all')

  const customerOf = useMemo(() => {
    const map = {}
    db.customers.forEach((c) => { map[c.id] = c })
    return map
  }, [db.customers])

  const rows = useMemo(() => {
    const term = q.trim().toLowerCase()
    return db.emails.filter((e) => {
      if (type !== 'all' && e.type !== type) return false
      if (!term) return true
      const c = customerOf[e.customerId]
      return e.to.toLowerCase().includes(term)
        || (c && c.name.toLowerCase().includes(term))
        || (e.meta && e.meta.waybill && e.meta.waybill.toLowerCase().includes(term))
    })
  }, [db.emails, q, type, customerOf])

  const paged = usePaged(rows, 14)

  const stats = useMemo(() => {
    const total = db.emails.length
    const delivered = db.emails.filter((e) => e.status === 'delivered').length
    const last7 = db.emails.filter((e) => Date.now() - new Date(e.at).getTime() < 7 * 864e5).length
    return { total, delivered, bounced: total - delivered, rate: pct(delivered, total), last7 }
  }, [db.emails])

  const perEvent = useMemo(
    () => Object.keys(EMAIL_EVENTS).map((k) => ({
      key: k,
      label: EMAIL_EVENTS[k].label,
      subject: EMAIL_EVENTS[k].subject,
      sent: db.emails.filter((e) => e.type === k).length,
      enabled: !!db.settings.emailToggles[k],
    })),
    [db.emails, db.settings.emailToggles]
  )

  const toggleEvent = (key, value) =>
    updateSettings({ emailToggles: { ...db.settings.emailToggles, [key]: value } })

  return (
    <>
      <PageHeader
        title="Email Notifications"
        subtitle="Every automated email the platform sends — registrations, shipment updates, delivery confirmations, enquiries and invoices."
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Emails sent" value={fmtNum(stats.total)} icon={Mail} tone="navy" hint={fmtNum(stats.last7) + ' in the last 7 days'} />
        <StatCard label="Delivered" value={fmtNum(stats.delivered)} icon={MailCheck} tone="green" hint={stats.rate + '% delivery rate'} />
        <StatCard label="Bounced" value={fmtNum(stats.bounced)} icon={MailX} tone="red" hint="Invalid or rejected addresses" />
        <StatCard label="Active templates" value={perEvent.filter((p) => p.enabled).length + ' / ' + perEvent.length} icon={Bell} tone="amber" />
      </div>

      <Tabs
        className="mt-6"
        active={tab}
        onChange={setTab}
        tabs={[
          { id: 'log', label: 'Delivery log', count: db.emails.length },
          { id: 'templates', label: 'Templates & triggers', count: perEvent.length },
        ]}
      />

      {tab === 'log' && (
        <Card className="mt-5">
          <div className="flex flex-wrap items-center gap-3 border-b border-slate-200 p-4">
            <SearchInput value={q} onChange={setQ} placeholder="Recipient, customer or tracking ID…" className="min-w-[240px] flex-1" />
            <Select
              value={type} onChange={setType} className="w-56"
              options={[{ value: 'all', label: 'All notification types' }, ...Object.entries(EMAIL_EVENTS).map(([k, v]) => ({ value: k, label: v.label }))]}
            />
          </div>

          <Table
            head={[
              { key: 't', label: 'Notification' }, { key: 'to', label: 'Recipient' },
              { key: 's', label: 'Subject' }, { key: 'st', label: 'Status' }, { key: 'at', label: 'Sent' },
            ]}
            empty={rows.length === 0}
            emptyLabel="No notifications match these filters"
          >
            {paged.slice.map((e) => {
              const c = customerOf[e.customerId]
              const ev = EMAIL_EVENTS[e.type]
              return (
                <tr key={e.id}>
                  <td className="td">
                    <div className="flex items-center gap-2.5">
                      <span className="grid h-7 w-7 shrink-0 place-items-center rounded-md bg-navy-50 text-navy-600"><Mail size={13} /></span>
                      <span className="font-medium text-navy-900">{ev ? ev.label : e.type}</span>
                    </div>
                  </td>
                  <td className="td">
                    {c && can('customers')
                      ? <Link to={'/customers/' + c.id} className="font-medium text-navy-800 hover:underline">{c.name}</Link>
                      : <span className="text-navy-800">{c ? c.name : '—'}</span>}
                    <p className="truncate text-[11px] text-slate-400">{e.to}</p>
                  </td>
                  <td className="td max-w-[280px] truncate text-slate-600">{fill(ev && ev.subject, e.meta)}</td>
                  <td className="td"><Badge tone={e.status === 'delivered' ? 'green' : 'red'} dot>{e.status}</Badge></td>
                  <td className="td whitespace-nowrap text-slate-600">
                    {fmtDateTime(e.at)}
                    <p className="text-[11px] text-slate-400">{fmtAgo(e.at)}</p>
                  </td>
                </tr>
              )
            })}
          </Table>

          <Pagination {...paged} />
        </Card>
      )}

      {tab === 'templates' && (
        <div className="mt-5 space-y-5">
          <Card className="card-pad">
            <SectionHeader
              title="Automated triggers"
              subtitle="Turn a notification stream off and the platform stops sending it — existing history is kept."
            />
            <div className="mt-5 divide-y divide-slate-100">
              {perEvent.map((p) => (
                <div key={p.key} className="flex flex-wrap items-center justify-between gap-4 py-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-semibold text-navy-900">{p.label}</p>
                      <Badge tone="slate">{fmtNum(p.sent)} sent</Badge>
                    </div>
                    <p className="mt-1 font-mono text-xs text-slate-500">{p.subject}</p>
                  </div>
                  <Toggle
                    checked={p.enabled}
                    onChange={(v) => toggleEvent(p.key, v)}
                    label={p.enabled ? 'Enabled' : 'Disabled'}
                    disabled={!can('settings') && !can('notifications')}
                  />
                </div>
              ))}
            </div>
          </Card>

          <Card className="card-pad">
            <SectionHeader title="Sample message" subtitle="How a shipment update reads to the customer." />
            <div className="mt-4 overflow-hidden rounded-xl border border-slate-200">
              <div className="border-b border-slate-200 bg-slate-50 px-4 py-2.5">
                <p className="text-xs text-slate-500">From: {db.settings.supportEmail}</p>
                <p className="text-sm font-semibold text-navy-900">Update on consignment PNL104278</p>
              </div>
              <div className="space-y-3 px-4 py-4 text-sm leading-relaxed text-slate-700">
                <p>Hello,</p>
                <p>
                  Your consignment <span className="font-mono font-semibold text-navy-900">PNL104278</span> has
                  reached a new milestone: <span className="font-semibold">Released from terminal</span> —
                  Apapa, Lagos.
                </p>
                <p>You can follow its progress at any time using the tracking page on our website.</p>
                <p className="text-slate-500">
                  {db.settings.company}<br />{db.settings.phone} · {db.settings.supportEmail}
                </p>
              </div>
            </div>
            <p className="mt-4 flex items-center gap-2 text-xs text-slate-500">
              <Send size={13} /> Sent automatically whenever an administrator records a milestone against the shipment.
            </p>
          </Card>
        </div>
      )}
    </>
  )
}
