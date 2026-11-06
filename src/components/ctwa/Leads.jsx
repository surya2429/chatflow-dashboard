import { useMemo, useState } from 'react'
import { Search, Send, Check, AlertCircle, FlaskConical, UserCheck, ShoppingBag, Users } from 'lucide-react'
import clsx from 'clsx'
import { money, num } from '../../lib/ctwaApi'
import { ExportMenu } from '../ai/AiData'
import EventDialog, { eventLabel } from './EventDialog'
import LeadDetail from './LeadDetail'
import { Card, Stat, inputCls } from './ui'

const when = (iso) => new Date(iso).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })

export function EventChips({ events }) {
  if (!events.length) return <span className="text-[11px] text-slate-300">None yet</span>
  return (
    <div className="flex flex-wrap gap-1">
      {events.map((e, i) => (
        <span key={i} title={e.error || (e.status === 'simulated' ? 'Test only: not sent to Meta (sample mode)' : `Sent ${when(e.at)}`)}
          className={clsx('inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold', e.status === 'failed' ? 'bg-red-50 text-red-600' : e.status === 'simulated' ? 'bg-amber-50 text-amber-700' : 'bg-emerald-50 text-emerald-700')}>
          {e.status === 'failed' ? <AlertCircle size={10} /> : e.status === 'simulated' ? <FlaskConical size={10} /> : <Check size={10} />}
          {eventLabel(e.eventName)}{e.value != null && ` · ${e.value}`}
        </span>
      ))}
    </div>
  )
}

export default function Leads({ leads, ads, currency, mode, capiLive, reload, notify }) {
  const [q, setQ] = useState('')
  const [adFilter, setAdFilter] = useState('all')
  const [dialog, setDialog] = useState(null)       // { lead, initial }
  const [openId, setOpenId] = useState(null)         // the lead whose full story is open

  const adName = useMemo(() => Object.fromEntries(ads.map((a) => [a.id, a.name])), [ads])
  const rows = useMemo(() => leads.map((l) => ({ ...l, adName: l.adName || adName[l.sourceId] || null })), [leads, adName])
  const shown = rows.filter((l) => {
    if (adFilter !== 'all' && l.sourceId !== adFilter) return false
    const s = q.trim().toLowerCase()
    return !s || (l.contactName || '').toLowerCase().includes(s) || l.waId.includes(s.replace(/\D/g, '') || '§') || (l.adName || '').toLowerCase().includes(s) || (l.headline || '').toLowerCase().includes(s)
  })
  const adOptions = [...new Map(rows.filter((l) => l.sourceId).map((l) => [l.sourceId, l.adName || l.headline || l.sourceId])).entries()]

  const has = (l, name) => l.events.some((e) => e.eventName === name && e.status !== 'failed')
  const purchases = rows.flatMap((l) => l.events.filter((e) => e.eventName === 'Purchase' && e.status !== 'failed'))
  const exportTable = useMemo(() => ({
    columns: [['name', 'Name'], ['wa', 'WhatsApp number'], ['ad', 'Ad'], ['headline', 'Ad headline'], ['date', 'Started chat'], ['events', 'Events sent to Meta']].map(([key, label]) => ({ key, label })),
    rows: shown.map((l) => ({ id: l.id, name: l.contactName || '', wa: `+${l.waId}`, ad: l.adName || '', headline: l.headline || '', date: l.createdAt, events: l.events.filter((e) => e.status !== 'failed').map((e) => eventLabel(e.eventName)).join(', ') })),
  }), [shown])

  const sent = (name, status) => { notify(status === 'simulated' ? `“${eventLabel(name)}” recorded as a test (sample mode, nothing was sent to Meta).` : `“${eventLabel(name)}” was sent to Meta.`, 'ok'); reload() }

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Stat label="Leads from ads" value={num(rows.length)} icon={Users} />
        <Stat label="Qualified" value={num(rows.filter((l) => has(l, 'QualifiedLead')).length)} icon={UserCheck} tone="text-sky-600 bg-sky-50" />
        <Stat label="Purchases" value={num(purchases.length)} icon={ShoppingBag} tone="text-emerald-600 bg-emerald-50" />
        <Stat label="Revenue reported" value={money(purchases.reduce((n, e) => n + (e.value || 0), 0), purchases[0]?.currency || currency)} icon={ShoppingBag} tone="text-amber-600 bg-amber-50" />
      </div>

      <Card bodyClass="">
        <div className="flex flex-wrap items-center gap-2 px-4 py-3 border-b border-surface-border">
          <div className="relative">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name, number or ad" aria-label="Search leads" className={clsx(inputCls, 'pl-8 w-60')} />
          </div>
          <select value={adFilter} onChange={(e) => setAdFilter(e.target.value)} aria-label="Filter by ad" className={clsx(inputCls, 'w-52')}>
            <option value="all">All ads</option>
            {adOptions.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
          </select>
          <div className="ml-auto"><ExportMenu table={exportTable} name="ctwa-leads" /></div>
        </div>

        {mode === 'sample' && <p className="px-4 py-2 text-[11px] bg-amber-50 text-amber-800 border-b border-amber-100">Sample leads. Events you send here are recorded as tests and never reach Meta.</p>}
        {mode === 'live' && !capiLive && <p className="px-4 py-2 text-[11px] bg-amber-50 text-amber-800 border-b border-amber-100">Set WA_BUSINESS_ACCOUNT_ID on the server to send conversion events to Meta.</p>}

        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-slate-50 text-left text-[10.5px] font-semibold text-slate-500">
                {['Lead', 'Ad that brought them', 'Started chat', 'Sent to Meta', ''].map((h) => <th key={h} className="px-4 py-2.5 border-b border-surface-border whitespace-nowrap">{h}</th>)}
              </tr>
            </thead>
            <tbody>
              {shown.map((l) => (
                <tr key={l.id} onClick={() => setOpenId(l.id)} tabIndex={0} onKeyDown={(e) => e.key === 'Enter' && e.target === e.currentTarget && setOpenId(l.id)} aria-label={`Open ${l.contactName || l.waId}`}
                  className="border-b border-surface-border/70 hover:bg-slate-50 cursor-pointer align-top focus:outline-none focus:bg-slate-50">
                  <td className="px-4 py-3 whitespace-nowrap"><p className="font-semibold text-slate-800">{l.contactName || 'Unknown'}</p><p className="text-[10.5px] text-slate-400">+{l.waId}</p></td>
                  <td className="px-4 py-3 max-w-[280px]"><p className="font-semibold text-slate-700 truncate">{l.adName || l.headline || '—'}</p>{l.adName && l.headline && <p className="text-[10.5px] text-slate-400 truncate">{l.headline}</p>}</td>
                  <td className="px-4 py-3 whitespace-nowrap text-slate-600">{when(l.createdAt)}</td>
                  <td className="px-4 py-3"><EventChips events={l.events} /></td>
                  <td className="px-4 py-3 whitespace-nowrap text-right" onClick={(e) => e.stopPropagation()}>
                    <div className="inline-flex items-center gap-1.5">
                      {!has(l, 'QualifiedLead') && <button onClick={() => setDialog({ lead: l, initial: 'QualifiedLead' })} className="px-2.5 py-1 rounded-lg border border-surface-border text-[11px] font-semibold text-slate-600 hover:border-primary hover:text-primary">Qualified</button>}
                      <button onClick={() => setDialog({ lead: l, initial: 'Purchase' })} className="px-2.5 py-1 rounded-lg border border-surface-border text-[11px] font-semibold text-slate-600 hover:border-primary hover:text-primary">Purchase</button>
                      <button onClick={() => setDialog({ lead: l, initial: 'LeadSubmitted' })} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-primary text-white text-[11px] font-semibold hover:bg-primary-hover"><Send size={11} /> Event</button>
                    </div>
                  </td>
                </tr>
              ))}
              {!shown.length && <tr><td colSpan={5} className="py-14 text-center text-slate-400">{rows.length ? 'No leads match.' : 'No chats from ads yet. They appear here as soon as someone messages you from an ad.'}</td></tr>}
            </tbody>
          </table>
        </div>
      </Card>

      {rows.find((l) => l.id === openId) && <LeadDetail lead={rows.find((l) => l.id === openId)} currency={currency} mode={mode} capiLive={capiLive} onClose={() => setOpenId(null)} onChanged={reload} notify={notify} />}
      {dialog && <EventDialog lead={dialog.lead} initial={dialog.initial} currency={currency} onClose={() => setDialog(null)} onSent={sent} />}
    </div>
  )
}
