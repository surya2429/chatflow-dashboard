import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Calculator, Send, PackagePlus, MailCheck, MessageSquareQuote, Check, X, Inbox, Reply,
} from 'lucide-react'
import clsx from 'clsx'
import { useData } from '../store/DataContext'
import { useAuth } from '../store/AuthContext'
import { QUOTE_STATUS, serviceLabel, quote as priceQuote } from '../lib/domain'
import { fmtDate, fmtDateTime, fmtAgo, fmtMoney, fmtUnits, initials, avatarTone } from '../lib/format'
import {
  Card, PageHeader, StatCard, Tabs, EmptyState, Badge, SectionHeader, Field, Avatar, KeyValue,
} from '../components/ui'

function QuoteBadge({ status }) {
  const s = QUOTE_STATUS[status]
  return <Badge tone={s ? s.tone : 'slate'} dot>{s ? s.label : status}</Badge>
}

/** Pricing desk for one quotation — the rate card proposes, the operator decides. */
function QuoteDesk({ q, onSend }) {
  const suggested = useMemo(
    () => priceQuote({ serviceId: q.serviceId, quantity: q.quantity, pieces: q.pieces }).total,
    [q]
  )
  const [amount, setAmount] = useState(() => (q.quotedAmount != null ? q.quotedAmount : Math.round(suggested * 100) / 100))
  const [note, setNote] = useState(q.note || '')

  return (
    <div className="rounded-xl border border-navy-200 bg-navy-50 p-4">
      <p className="flex items-center gap-2 text-sm font-semibold text-navy-900">
        <Calculator size={15} /> Price this quotation
      </p>
      <p className="mt-1 text-xs text-navy-700">
        Rate card suggests <span className="font-semibold tnum">{fmtMoney(suggested)}</span> for{' '}
        {q.pieces} piece(s) at {fmtUnits(q.serviceId, q.quantity)} on {serviceLabel(q.serviceId)}.
      </p>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <Field label="Quoted amount">
          <input type="number" min="0" step="0.01" className="field tnum" value={amount} onChange={(e) => setAmount(e.target.value)} />
        </Field>
        <Field label="Valid for" hint="Quotes expire 30 days after they are sent.">
          <input className="field" value="30 days" disabled />
        </Field>
      </div>
      <Field label="Note to the customer" className="mt-3">
        <textarea className="field min-h-[68px]" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Rate assumes palletised goods and weekday collection…" />
      </Field>
      <button className="btn-primary mt-3 w-full" onClick={() => onSend(Number(amount), note)}>
        <Send size={15} /> {q.status === 'new' ? 'Send quote' : 'Re-send updated quote'}
      </button>
    </div>
  )
}

/**
 * Quotation requests from the website's "Request a Quote" form, with contact enquiries
 * behind them — both arrive from the same public forms and both get an acknowledgement
 * automatically, so this screen is about the human follow-up.
 */
export default function Quotations() {
  const { db, sendQuote, setQuoteStatus, convertQuoteToOrder, setEnquiryStatus } = useData()
  const { user } = useAuth()
  const nav = useNavigate()
  const [tab, setTab] = useState('new')
  const [selectedId, setSelectedId] = useState(null)

  const counts = useMemo(() => ({
    new: db.quotes.filter((q) => q.status === 'new').length,
    quoted: db.quotes.filter((q) => q.status === 'quoted').length,
    all: db.quotes.length,
    enquiries: db.enquiries.filter((e) => e.status === 'new').length,
    accepted: db.quotes.filter((q) => q.status === 'accepted').length,
  }), [db])

  const list = useMemo(() => {
    if (tab === 'enquiries') return db.enquiries
    if (tab === 'all') return db.quotes
    return db.quotes.filter((q) => q.status === tab)
  }, [db.quotes, db.enquiries, tab])

  // Resolve the selection against the whole set, not the filtered list: quoting or
  // accepting moves an item out of the current tab, and the operator still needs the
  // detail pane in front of them to take the next step.
  const pool = tab === 'enquiries' ? db.enquiries : db.quotes
  const selected = pool.find((x) => x.id === selectedId) || list[0] || null
  const isEnquiry = tab === 'enquiries'

  const wonValue = db.quotes.filter((q) => q.status === 'accepted').reduce((s, q) => s + (q.quotedAmount || 0), 0)

  return (
    <>
      <PageHeader
        title="Quotation Requests"
        subtitle="Price the rates customers ask for, send them out, and turn the accepted ones into shipments."
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Awaiting a rate" value={counts.new} icon={Inbox} tone="amber" onClick={() => { setTab('new'); setSelectedId(null) }} active={tab === 'new'} />
        <StatCard label="Quoted, pending reply" value={counts.quoted} icon={Send} tone="navy" onClick={() => { setTab('quoted'); setSelectedId(null) }} active={tab === 'quoted'} />
        <StatCard label="Accepted" value={counts.accepted} icon={Check} tone="green" hint={fmtMoney(wonValue) + ' won'} />
        <StatCard label="Contact enquiries" value={counts.enquiries} icon={MessageSquareQuote} tone="cyan" onClick={() => { setTab('enquiries'); setSelectedId(null) }} active={tab === 'enquiries'} />
      </div>

      <Tabs
        className="mt-6"
        active={tab}
        onChange={(t) => { setTab(t); setSelectedId(null) }}
        tabs={[
          { id: 'new', label: 'Awaiting quote', count: counts.new },
          { id: 'quoted', label: 'Quoted', count: counts.quoted },
          { id: 'all', label: 'All quotations', count: counts.all },
          { id: 'enquiries', label: 'Contact enquiries', count: db.enquiries.length },
        ]}
      />

      <div className="mt-5 grid gap-5 lg:grid-cols-5">
        <Card className="lg:col-span-2">
          {list.length === 0 ? (
            <div className="p-12"><EmptyState icon={MailCheck} label="Nothing waiting" hint="This queue is clear." /></div>
          ) : (
            <ul className="max-h-[640px] divide-y divide-slate-100 overflow-y-auto">
              {list.map((x) => (
                <li key={x.id}>
                  <button
                    onClick={() => setSelectedId(x.id)}
                    className={clsx('w-full px-5 py-3.5 text-left transition-colors',
                      selected && selected.id === x.id ? 'bg-navy-50' : 'hover:bg-slate-50')}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate text-sm font-semibold text-navy-900">{x.name}</span>
                      {isEnquiry
                        ? <Badge tone={x.status === 'new' ? 'amber' : 'green'} dot>{x.status === 'new' ? 'New' : 'Responded'}</Badge>
                        : <QuoteBadge status={x.status} />}
                    </div>
                    <p className="mt-1 truncate text-xs text-slate-500">
                      {isEnquiry ? x.subject : x.origin.city + ' → ' + x.destination.city + ' · ' + fmtUnits(x.serviceId, x.quantity)}
                    </p>
                    <p className="mt-1 flex items-center justify-between gap-2 text-[11px] text-slate-400">
                      <span>{x.id}</span>
                      <span>{fmtAgo(x.at)}</span>
                    </p>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <div className="lg:col-span-3">
          {!selected ? (
            <Card className="p-12"><EmptyState icon={Calculator} label="Select a request" /></Card>
          ) : isEnquiry ? (
            <Card className="card-pad">
              <SectionHeader
                title={selected.subject}
                subtitle={selected.name + (selected.company ? ' · ' + selected.company : '')}
                actions={selected.status === 'new'
                  ? <button className="btn-primary btn-sm" onClick={() => setEnquiryStatus(selected.id, 'responded', user.name)}><Reply size={14} /> Mark responded</button>
                  : <Badge tone="green" dot>Responded</Badge>}
              />
              <div className="mt-5 rounded-xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-sm leading-relaxed text-navy-800">{selected.message}</p>
              </div>
              <div className="mt-5">
                <KeyValue items={[
                  { label: 'Email', value: selected.email },
                  { label: 'Phone', value: selected.phone },
                  { label: 'Received', value: fmtDateTime(selected.at) },
                  { label: 'Reference', value: selected.id },
                ]} />
              </div>
              <p className="mt-5 rounded-lg border border-emerald-200 bg-emerald-50 px-3.5 py-2.5 text-xs text-emerald-800">
                An automated acknowledgement was emailed to {selected.email} when this enquiry was submitted.
              </p>
            </Card>
          ) : (
            <div className="space-y-5">
              <Card className="card-pad">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <Avatar name={initials(selected.name)} tone={avatarTone(selected.name)} size="lg" />
                    <div className="min-w-0">
                      <p className="font-semibold text-navy-900">{selected.name}</p>
                      <p className="truncate text-sm text-slate-500">{selected.company || 'Individual'} · {selected.email}</p>
                    </div>
                  </div>
                  <QuoteBadge status={selected.status} />
                </div>

                <div className="mt-5">
                  <KeyValue items={[
                    { label: 'Reference', value: selected.id },
                    { label: 'Received', value: fmtDateTime(selected.at) },
                    { label: 'Route', value: selected.origin.city + ' → ' + selected.destination.city },
                    { label: 'Service', value: serviceLabel(selected.serviceId) },
                    { label: 'Consignment', value: selected.pieces + ' piece(s) · ' + fmtUnits(selected.serviceId, selected.quantity) },
                    { label: 'Frequency', value: selected.frequency },
                  ]} />
                </div>

                <div className="mt-5 rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <p className="text-sm leading-relaxed text-navy-800">{selected.message}</p>
                </div>

                {selected.quotedAmount != null && (
                  <div className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3">
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-emerald-700">Quoted</p>
                      <p className="text-lg font-bold tnum text-navy-900">{fmtMoney(selected.quotedAmount)}</p>
                    </div>
                    <p className="text-xs text-emerald-800">
                      Sent {fmtDate(selected.quotedAt)} by {selected.quotedBy}
                      {selected.validUntil ? ' · valid to ' + fmtDate(selected.validUntil) : ''}
                    </p>
                  </div>
                )}

                <div className="mt-5 flex flex-wrap gap-2">
                  {selected.status === 'quoted' && (
                    <>
                      <button className="btn-primary btn-sm" onClick={() => setQuoteStatus(selected.id, 'accepted', user.name)}>
                        <Check size={14} /> Customer accepted
                      </button>
                      <button className="btn-ghost btn-sm" onClick={() => setQuoteStatus(selected.id, 'declined', user.name)}>
                        <X size={14} /> Customer declined
                      </button>
                    </>
                  )}
                  {selected.status === 'accepted' && !selected.orderId && (
                    <button
                      className="btn-accent btn-sm"
                      onClick={() => { const o = convertQuoteToOrder(selected.id, user.name); if (o) nav('/orders/' + o.id) }}
                    >
                      <PackagePlus size={14} /> Convert to order
                    </button>
                  )}
                  {selected.orderId && (
                    <button className="btn-ghost btn-sm" onClick={() => nav('/orders/' + selected.orderId)}>
                      Open shipment {selected.orderId}
                    </button>
                  )}
                </div>
              </Card>

              {['new', 'quoted'].includes(selected.status) && (
                <QuoteDesk
                  key={selected.id}
                  q={selected}
                  onSend={(amount, note) => sendQuote(selected.id, amount, note, user.name)}
                />
              )}
            </div>
          )}
        </div>
      </div>
    </>
  )
}
