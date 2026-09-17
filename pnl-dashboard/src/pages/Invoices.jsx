import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { FileText, Send, CheckCircle2, Wallet, Clock3, Printer, Plus } from 'lucide-react'
import { useData } from '../store/DataContext'
import { useAuth } from '../store/AuthContext'
import { INVOICE_STATUS, serviceLabel } from '../lib/domain'
import { fmtDate, fmtMoney, fmtDateTime, fmtUnits } from '../lib/format'
import {
  Card, PageHeader, Table, SearchInput, Select, Pagination, usePaged, StatCard,
  Modal, EmptyState, SectionHeader,
} from '../components/ui'
import { InvoiceBadge } from '../components/StatusBadge'

/** Printable invoice preview — what the customer receives against a shipment order. */
function InvoicePreview({ invoice, order, customer, settings, onClose, onStatus }) {
  if (!invoice) return null
  return (
    <Modal
      open
      onClose={onClose}
      title={'Invoice ' + invoice.id}
      subtitle={'Raised against order ' + invoice.orderId}
      width="max-w-3xl"
      footer={
        <>
          <button className="btn-ghost" onClick={() => window.print()}><Printer size={15} /> Print</button>
          {invoice.status === 'draft' && <button className="btn-primary" onClick={() => { onStatus(invoice.id, 'sent'); onClose() }}><Send size={15} /> Send to customer</button>}
          {invoice.status === 'sent' && <button className="btn-primary" onClick={() => { onStatus(invoice.id, 'paid'); onClose() }}><CheckCircle2 size={15} /> Mark paid</button>}
          {invoice.status !== 'void' && invoice.status !== 'paid' && <button className="btn-ghost text-red-600" onClick={() => { onStatus(invoice.id, 'void'); onClose() }}>Void</button>}
        </>
      }
    >
      <div className="rounded-xl border border-slate-200 p-6">
        <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-200 pb-5">
          <div>
            <p className="text-lg font-bold text-navy-900">{settings.company}</p>
            <p className="mt-1 max-w-xs text-xs leading-relaxed text-slate-500">{settings.address}</p>
            <p className="text-xs text-slate-500">{settings.supportEmail} · {settings.phone}</p>
          </div>
          <div className="text-right">
            <p className="text-[11px] font-bold uppercase tracking-widest text-slate-400">Tax invoice</p>
            <p className="mt-1 font-mono text-base font-bold text-navy-900">{invoice.id}</p>
            <p className="mt-1 text-xs text-slate-500">Issued {fmtDate(invoice.issuedAt)}</p>
            <p className="text-xs text-slate-500">Due {fmtDate(invoice.dueAt)}</p>
          </div>
        </div>

        <div className="grid gap-6 border-b border-slate-200 py-5 sm:grid-cols-2">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Billed to</p>
            <p className="mt-1.5 text-sm font-semibold text-navy-900">{customer ? customer.name : '—'}</p>
            {customer && customer.company && <p className="text-sm text-slate-600">{customer.company}</p>}
            {customer && <p className="text-sm text-slate-600">{customer.address}</p>}
            {customer && <p className="text-sm text-slate-600">{customer.city}, {customer.country}</p>}
          </div>
          {order && (
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Shipment</p>
              <p className="mt-1.5 font-mono text-sm font-semibold text-navy-900">{order.id}</p>
              <p className="text-sm text-slate-600">{serviceLabel(order.serviceId)}</p>
              <p className="text-sm text-slate-600">{order.origin.city} → {order.destination.city}</p>
              <p className="text-sm text-slate-600">{order.pieces} piece(s) · {fmtUnits(order.serviceId, order.quantity)}</p>
            </div>
          )}
        </div>

        <table className="mt-5 w-full">
          <thead>
            <tr>
              <th className="pb-2 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500">Description</th>
              <th className="pb-2 text-right text-[11px] font-semibold uppercase tracking-wide text-slate-500">Amount</th>
            </tr>
          </thead>
          <tbody>
            {invoice.lines.map((l) => (
              <tr key={l.label} className="border-t border-slate-100">
                <td className="py-2.5 text-sm text-slate-700">{l.label}</td>
                <td className="py-2.5 text-right text-sm tnum text-navy-800">{fmtMoney(l.amount)}</td>
              </tr>
            ))}
            <tr className="border-t-2 border-navy-900">
              <td className="pt-3 text-sm font-bold text-navy-900">Total due</td>
              <td className="pt-3 text-right text-base font-bold tnum text-navy-900">{fmtMoney(invoice.total)}</td>
            </tr>
          </tbody>
        </table>

        <div className="mt-5 flex items-center justify-between gap-3 rounded-lg bg-slate-50 px-4 py-3">
          <InvoiceBadge status={invoice.status} />
          <p className="text-xs text-slate-500">
            {invoice.paidAt ? 'Paid ' + fmtDateTime(invoice.paidAt) : 'Payable within 14 days of issue.'}
          </p>
        </div>
      </div>
    </Modal>
  )
}

export default function Invoices() {
  const { db, setInvoiceStatus, createInvoice } = useData()
  const { user } = useAuth()
  const nav = useNavigate()
  const [q, setQ] = useState('')
  const [status, setStatus] = useState('all')
  const [openId, setOpenId] = useState(null)
  const [picking, setPicking] = useState(false)

  const customerOf = useMemo(() => {
    const map = {}
    db.customers.forEach((c) => { map[c.id] = c })
    return map
  }, [db.customers])

  const rows = useMemo(() => {
    const term = q.trim().toLowerCase()
    return db.invoices.filter((i) => {
      if (status !== 'all' && i.status !== status) return false
      if (!term) return true
      const c = customerOf[i.customerId]
      return i.id.toLowerCase().includes(term) || i.orderId.toLowerCase().includes(term)
        || (c && c.name.toLowerCase().includes(term))
    })
  }, [db.invoices, q, status, customerOf])

  const paged = usePaged(rows, 12)

  const totals = useMemo(() => {
    const active = db.invoices.filter((i) => i.status !== 'void')
    return {
      billed: active.reduce((s, i) => s + i.total, 0),
      paid: db.invoices.filter((i) => i.status === 'paid').reduce((s, i) => s + i.total, 0),
      outstanding: db.invoices.filter((i) => i.status === 'sent').reduce((s, i) => s + i.total, 0),
      drafts: db.invoices.filter((i) => i.status === 'draft').length,
    }
  }, [db.invoices])

  const open = db.invoices.find((i) => i.id === openId)
  const uninvoiced = useMemo(
    () => db.orders.filter((o) => o.status !== 'cancelled' && !db.invoices.some((i) => i.orderId === o.id)),
    [db.orders, db.invoices]
  )

  return (
    <>
      <PageHeader
        title="Invoicing"
        subtitle="Generate invoices against shipment orders, send them to customers and track what has been settled."
        actions={<button className="btn-primary" onClick={() => setPicking(true)}><Plus size={16} /> Generate invoice</button>}
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Total billed" value={fmtMoney(totals.billed)} icon={FileText} tone="navy" />
        <StatCard label="Settled" value={fmtMoney(totals.paid)} icon={CheckCircle2} tone="green" onClick={() => setStatus('paid')} active={status === 'paid'} />
        <StatCard label="Outstanding" value={fmtMoney(totals.outstanding)} icon={Wallet} tone="amber" onClick={() => setStatus('sent')} active={status === 'sent'} />
        <StatCard label="Drafts" value={totals.drafts} icon={Clock3} tone="slate" onClick={() => setStatus('draft')} active={status === 'draft'} />
      </div>

      <Card className="mt-6">
        <div className="flex flex-wrap items-center gap-3 border-b border-slate-200 p-4">
          <SearchInput value={q} onChange={setQ} placeholder="Invoice, order or customer…" className="min-w-[240px] flex-1" />
          <Select
            value={status} onChange={setStatus} className="w-44"
            options={[{ value: 'all', label: 'All statuses' }, ...Object.entries(INVOICE_STATUS).map(([k, v]) => ({ value: k, label: v.label }))]}
          />
        </div>

        <Table
          head={[
            { key: 'id', label: 'Invoice' }, { key: 'cust', label: 'Customer' }, { key: 'order', label: 'Order' },
            { key: 'iss', label: 'Issued' }, { key: 'due', label: 'Due' }, { key: 'st', label: 'Status' },
            { key: 'amt', label: 'Total', align: 'right' }, { key: 'act', label: '' },
          ]}
          empty={rows.length === 0}
          emptyLabel="No invoices match these filters"
        >
          {paged.slice.map((i) => {
            const c = customerOf[i.customerId]
            const overdue = i.status === 'sent' && new Date(i.dueAt) < new Date()
            return (
              <tr key={i.id} className="row-link" onClick={() => setOpenId(i.id)}>
                <td className="td font-mono text-[13px] font-semibold text-navy-900">{i.id}</td>
                <td className="td">
                  <p className="truncate font-medium text-navy-900">{c ? c.name : '—'}</p>
                  <p className="truncate text-[11px] text-slate-400">{c && c.company ? c.company : ''}</p>
                </td>
                <td className="td">
                  <Link to={'/orders/' + i.orderId} className="text-slate-600 hover:text-navy-900 hover:underline" onClick={(e) => e.stopPropagation()}>
                    {i.orderId}
                  </Link>
                </td>
                <td className="td whitespace-nowrap text-slate-600">{fmtDate(i.issuedAt)}</td>
                <td className="td whitespace-nowrap">
                  <span className={overdue ? 'font-medium text-red-600' : 'text-slate-600'}>{fmtDate(i.dueAt)}</span>
                  {overdue && <p className="text-[11px] text-red-500">Overdue</p>}
                </td>
                <td className="td"><InvoiceBadge status={i.status} /></td>
                <td className="td text-right tnum font-semibold whitespace-nowrap">{fmtMoney(i.total)}</td>
                <td className="td text-right">
                  {i.status === 'draft' && (
                    <button className="btn-accent btn-sm" onClick={(e) => { e.stopPropagation(); setInvoiceStatus(i.id, 'sent', user.name) }}>
                      <Send size={13} /> Send
                    </button>
                  )}
                  {i.status === 'sent' && (
                    <button className="btn-ghost btn-sm" onClick={(e) => { e.stopPropagation(); setInvoiceStatus(i.id, 'paid', user.name) }}>
                      Mark paid
                    </button>
                  )}
                  {(i.status === 'paid' || i.status === 'void') && (
                    <button className="btn-ghost btn-sm" onClick={(e) => { e.stopPropagation(); setOpenId(i.id) }}>View</button>
                  )}
                </td>
              </tr>
            )
          })}
        </Table>

        <Pagination {...paged} />
      </Card>

      {open && (
        <InvoicePreview
          invoice={open}
          order={db.orders.find((o) => o.id === open.orderId)}
          customer={customerOf[open.customerId]}
          settings={db.settings}
          onClose={() => setOpenId(null)}
          onStatus={(id, s) => setInvoiceStatus(id, s, user.name)}
        />
      )}

      {picking && (
        <Modal
          open onClose={() => setPicking(false)}
          title="Generate an invoice"
          subtitle="Pick a shipment order that has not been billed yet."
          width="max-w-2xl"
        >
          {uninvoiced.length === 0 ? (
            <EmptyState icon={FileText} label="Every order has been invoiced" />
          ) : (
            <>
              <SectionHeader title={uninvoiced.length + ' orders awaiting an invoice'} className="mb-3" />
              <ul className="max-h-80 divide-y divide-slate-100 overflow-y-auto rounded-lg border border-slate-200">
                {uninvoiced.slice(0, 40).map((o) => {
                  const c = customerOf[o.customerId]
                  return (
                    <li key={o.id} className="flex items-center gap-3 px-4 py-2.5">
                      <div className="min-w-0 flex-1">
                        <p className="font-mono text-[13px] font-semibold text-navy-900">{o.id}</p>
                        <p className="truncate text-xs text-slate-500">{c ? c.name : ''} · {o.origin.city} → {o.destination.city}</p>
                      </div>
                      <span className="shrink-0 text-sm tnum font-semibold text-navy-800">{fmtMoney(o.amount)}</span>
                      <button
                        className="btn-primary btn-sm shrink-0"
                        onClick={() => { const inv = createInvoice(o.id, user.name); setPicking(false); if (inv) setOpenId(inv.id) }}
                      >
                        Generate
                      </button>
                    </li>
                  )
                })}
              </ul>
            </>
          )}
        </Modal>
      )}
    </>
  )
}
