import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { UserPlus, Check, Ban, Users as UsersIcon, UserCheck, Clock3, Download } from 'lucide-react'
import { useData } from '../store/DataContext'
import { useAuth } from '../store/AuthContext'
import { CUSTOMER_STATUS } from '../lib/domain'
import { fmtDate, fmtAgo, fmtMoney, initials, avatarTone } from '../lib/format'
import {
  Card, PageHeader, Table, SearchInput, Select, Pagination, usePaged, StatCard,
  Modal, Field, Avatar,
} from '../components/ui'
import { CustomerBadge } from '../components/StatusBadge'

function NewCustomerModal({ open, onClose, onSave }) {
  const [f, setF] = useState({ name: '', email: '', phone: '', company: '', city: 'Dubai', country: 'United Arab Emirates', address: '' })
  const set = (k) => (e) => setF((s) => ({ ...s, [k]: e.target.value }))
  const valid = f.name.trim() && /.+@.+\..+/.test(f.email)

  return (
    <Modal
      open={open} onClose={onClose}
      title="Register a customer"
      subtitle="Creates the account and sends the welcome email automatically."
      footer={
        <>
          <button className="btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn-primary" disabled={!valid} onClick={() => { onSave(f); onClose() }}>
            <UserPlus size={16} /> Create customer
          </button>
        </>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Full name"><input className="field" value={f.name} onChange={set('name')} /></Field>
        <Field label="Company" hint="Leave blank for an individual account"><input className="field" value={f.company} onChange={set('company')} /></Field>
        <Field label="Email"><input className="field" type="email" value={f.email} onChange={set('email')} /></Field>
        <Field label="Phone"><input className="field" value={f.phone} onChange={set('phone')} /></Field>
        <Field label="City"><input className="field" value={f.city} onChange={set('city')} /></Field>
        <Field label="Country"><input className="field" value={f.country} onChange={set('country')} /></Field>
        <Field label="Address" className="sm:col-span-2"><input className="field" value={f.address} onChange={set('address')} /></Field>
      </div>
    </Modal>
  )
}

export default function Customers() {
  const { db, setCustomerStatus, addCustomer } = useData()
  const { user } = useAuth()
  const nav = useNavigate()
  const [q, setQ] = useState('')
  const [status, setStatus] = useState('all')
  const [creating, setCreating] = useState(false)

  const enriched = useMemo(() => {
    const byCustomer = {}
    db.orders.forEach((o) => {
      const e = byCustomer[o.customerId] || (byCustomer[o.customerId] = { orders: 0, spend: 0, last: null })
      e.orders += 1
      if (o.status !== 'cancelled') e.spend += o.amount
      if (!e.last || new Date(o.createdAt) > new Date(e.last)) e.last = o.createdAt
    })
    return db.customers.map((c) => ({ ...c, ...(byCustomer[c.id] || { orders: 0, spend: 0, last: null }) }))
  }, [db.customers, db.orders])

  const rows = useMemo(() => {
    const term = q.trim().toLowerCase()
    return enriched.filter((c) => {
      if (status !== 'all' && c.status !== status) return false
      if (!term) return true
      return c.name.toLowerCase().includes(term) || c.email.toLowerCase().includes(term)
        || (c.company || '').toLowerCase().includes(term) || c.id.toLowerCase().includes(term)
        || c.city.toLowerCase().includes(term)
    })
  }, [enriched, q, status])

  const paged = usePaged(rows, 12)

  const counts = {
    all: enriched.length,
    active: enriched.filter((c) => c.status === 'active').length,
    pending: enriched.filter((c) => c.status === 'pending').length,
    suspended: enriched.filter((c) => c.status === 'suspended').length,
  }

  const exportCsv = () => {
    const head = ['Customer ID', 'Name', 'Company', 'Email', 'Phone', 'City', 'Country', 'Status', 'Orders', 'Lifetime value', 'Registered']
    const csv = [head, ...rows.map((c) => [c.id, c.name, c.company, c.email, c.phone, c.city, c.country, c.status, c.orders, c.spend.toFixed(2), fmtDate(c.registeredAt)])]
      .map((r) => r.map((v) => '"' + String(v == null ? '' : v).replace(/"/g, '""') + '"').join(',')).join('\n')
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }))
    const a = document.createElement('a')
    a.href = url
    a.download = 'pnc-customers-' + new Date().toISOString().slice(0, 10) + '.csv'
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <>
      <PageHeader
        title="Customer Management"
        subtitle="Registrations, profiles and the full activity trail for everyone shipping with Prime Next Logistics."
        actions={
          <>
            <button className="btn-ghost" onClick={exportCsv}><Download size={15} /> Export CSV</button>
            <button className="btn-primary" onClick={() => setCreating(true)}><UserPlus size={16} /> Register customer</button>
          </>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Total customers" value={counts.all} icon={UsersIcon} tone="navy" onClick={() => setStatus('all')} active={status === 'all'} />
        <StatCard label="Active accounts" value={counts.active} icon={UserCheck} tone="green" onClick={() => setStatus('active')} active={status === 'active'} />
        <StatCard label="Awaiting approval" value={counts.pending} icon={Clock3} tone="amber" onClick={() => setStatus('pending')} active={status === 'pending'} />
        <StatCard label="Suspended" value={counts.suspended} icon={Ban} tone="red" onClick={() => setStatus('suspended')} active={status === 'suspended'} />
      </div>

      <Card className="mt-6">
        <div className="flex flex-wrap items-center gap-3 border-b border-slate-200 p-4">
          <SearchInput value={q} onChange={setQ} placeholder="Name, email, company or city…" className="min-w-[240px] flex-1" />
          <Select
            value={status}
            onChange={setStatus}
            className="w-48"
            options={[{ value: 'all', label: 'All statuses' }, ...Object.entries(CUSTOMER_STATUS).map(([k, v]) => ({ value: k, label: v.label }))]}
          />
        </div>

        <Table
          head={[
            { key: 'c', label: 'Customer' },
            { key: 'contact', label: 'Contact' },
            { key: 'loc', label: 'Location' },
            { key: 'orders', label: 'Orders', align: 'right' },
            { key: 'spend', label: 'Lifetime value', align: 'right' },
            { key: 'reg', label: 'Registered' },
            { key: 'st', label: 'Status' },
            { key: 'act', label: '' },
          ]}
          empty={rows.length === 0}
          emptyLabel="No customers match this search"
        >
          {paged.slice.map((c) => (
            <tr key={c.id} className="row-link" onClick={() => nav('/customers/' + c.id)}>
              <td className="td">
                <div className="flex items-center gap-3">
                  <Avatar name={initials(c.name)} tone={avatarTone(c.name)} />
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-navy-900">{c.name}</p>
                    <p className="truncate text-[11px] text-slate-400">{c.company || 'Individual'} · {c.id}</p>
                  </div>
                </div>
              </td>
              <td className="td max-w-[200px]">
                <p className="truncate text-slate-700">{c.email}</p>
                <p className="text-[11px] text-slate-400">{c.phone}</p>
              </td>
              <td className="td whitespace-nowrap text-slate-600">{c.city}<p className="text-[11px] text-slate-400">{c.country}</p></td>
              <td className="td text-right tnum whitespace-nowrap">{c.orders}</td>
              <td className="td text-right tnum font-semibold whitespace-nowrap">{fmtMoney(c.spend)}</td>
              <td className="td whitespace-nowrap text-slate-600">{fmtDate(c.registeredAt)}<p className="text-[11px] text-slate-400">{fmtAgo(c.registeredAt)}</p></td>
              <td className="td"><CustomerBadge status={c.status} /></td>
              <td className="td text-right">
                {c.status === 'pending' ? (
                  <button className="btn-accent btn-sm" onClick={(e) => { e.stopPropagation(); setCustomerStatus(c.id, 'active', user.name) }}>
                    <Check size={13} /> Approve
                  </button>
                ) : c.status === 'active' ? (
                  <button className="btn-ghost btn-sm" onClick={(e) => { e.stopPropagation(); setCustomerStatus(c.id, 'suspended', user.name) }}>
                    Suspend
                  </button>
                ) : (
                  <button className="btn-ghost btn-sm" onClick={(e) => { e.stopPropagation(); setCustomerStatus(c.id, 'active', user.name) }}>
                    Reactivate
                  </button>
                )}
              </td>
            </tr>
          ))}
        </Table>

        <Pagination {...paged} />
      </Card>

      <NewCustomerModal open={creating} onClose={() => setCreating(false)} onSave={(f) => addCustomer(f, user.name)} />
    </>
  )
}
