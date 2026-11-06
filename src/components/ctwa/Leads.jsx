import { useMemo, useState } from 'react'
import { Search, Send, Check, AlertCircle, FlaskConical, UserCheck, ShoppingBag, Users, IndianRupee } from 'lucide-react'
import clsx from 'clsx'
import { useConversations } from '../../context/ConversationContext'
import { money, num } from '../../lib/ctwaApi'
import { ExportMenu } from '../ai/AiData'
import EventDialog, { eventLabel } from './EventDialog'
import { leadsExportTable } from './exports'
import { findConversation, revenueOf } from './journey'
import LeadDetail from './LeadDetail'
import { EmptyState, Kpi, Pager, Segmented, thCls, usePaging } from './ui'

const when = (iso) => new Date(iso).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
const has = (l, n) => l.events.some((e) => e.eventName === n && e.status !== 'failed')
const CHAT = { bot: ['Bot', 'bg-blue-50 text-blue-700'], agent: ['Agent', 'bg-emerald-50 text-emerald-700'], resolved: ['Resolved', 'bg-slate-100 text-slate-600'] }

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
  const { conversations } = useConversations()
  const [tab, setTab] = useState('all')
  const [q, setQ] = useState('')
  const [adFilter, setAdFilter] = useState('all')
  const [dialog, setDialog] = useState(null)       // { lead, initial }
  const [openId, setOpenId] = useState(null)       // the lead whose full story is open

  const adName = useMemo(() => Object.fromEntries(ads.map((a) => [a.id, a.name])), [ads])
  const rows = useMemo(() => leads.map((l) => ({ ...l, adName: l.adName || adName[l.sourceId] || null })), [leads, adName])
  const counts = { all: rows.length, new: rows.filter((l) => !l.events.length).length, qualified: rows.filter((l) => has(l, 'QualifiedLead')).length, purchased: rows.filter((l) => has(l, 'Purchase')).length }
  const shown = rows.filter((l) => {
    if (adFilter !== 'all' && l.sourceId !== adFilter) return false
    if (tab === 'new' && l.events.length) return false
    if (tab === 'qualified' && !has(l, 'QualifiedLead')) return false
    if (tab === 'purchased' && !has(l, 'Purchase')) return false
    const s = q.trim().toLowerCase()
    return !s || (l.contactName || '').toLowerCase().includes(s) || l.waId.includes(s.replace(/\D/g, '') || '§') || (l.adName || '').toLowerCase().includes(s) || (l.sourceId || '').includes(s)
  })
  const paging = usePaging(shown, 10)
  const adOptions = [...new Map(rows.filter((l) => l.sourceId).map((l) => [l.sourceId, l.adName || l.headline || l.sourceId])).entries()]
  const purchases = rows.flatMap((l) => l.events.filter((e) => e.eventName === 'Purchase' && e.status !== 'failed'))

  const exportTable = useMemo(() => leadsExportTable({ leads: shown, ads, findChat: (l) => findConversation(l, conversations), currency }), [shown, ads, conversations, currency])
  const sent = (name, status) => { notify(status === 'simulated' ? `“${eventLabel(name)}” recorded as a test (sample mode, nothing was sent to Meta).` : `“${eventLabel(name)}” was sent to Meta.`, 'ok'); reload() }
  const openLead = rows.find((l) => l.id === openId)

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Kpi icon={Users} label="Leads from Ads" value={num(rows.length)} sub={`${num(counts.new)} not followed up yet`} />
        <Kpi icon={UserCheck} label="Qualified" value={num(counts.qualified)} sub={rows.length ? `${Math.round((counts.qualified / rows.length) * 100)}% of leads` : '—'} iconBg="bg-sky-50" iconColor="text-sky-500" />
        <Kpi icon={ShoppingBag} label="Purchases" value={num(purchases.length)} sub={`${num(counts.purchased)} buying ${counts.purchased === 1 ? 'customer' : 'customers'}`} iconBg="bg-emerald-50" iconColor="text-emerald-500" />
        <Kpi icon={IndianRupee} label="Revenue Reported" value={money(purchases.reduce((n, e) => n + (e.value || 0), 0), purchases[0]?.currency || currency)} sub="Sent to Meta as purchases" iconBg="bg-amber-50" iconColor="text-amber-500" />
      </div>

      <div className="card p-0 overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-2 px-5 py-2 border-b border-surface-border">
          <Segmented value={tab} onChange={setTab} options={[{ key: 'all', label: 'All', count: counts.all }, { key: 'new', label: 'New', count: counts.new }, { key: 'qualified', label: 'Qualified', count: counts.qualified }, { key: 'purchased', label: 'Purchased', count: counts.purchased }]} />
          <div className="flex flex-wrap items-center gap-2 py-2">
            <div className="relative">
              <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search leads" placeholder="Search name, number, ad or ID…" className="pl-8 pr-3 py-1.5 text-xs border border-surface-border rounded-lg w-60 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all placeholder-slate-400" />
            </div>
            <select value={adFilter} onChange={(e) => setAdFilter(e.target.value)} aria-label="Filter by ad" className="py-1.5 px-2.5 text-xs border border-surface-border rounded-lg w-48 bg-white focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary">
              <option value="all">All ads</option>
              {adOptions.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
            </select>
            <ExportMenu table={exportTable} name="ctwa-leads" label="Export leads" />
          </div>
        </div>

        {mode === 'sample' && <p className="px-5 py-2 text-[11px] bg-amber-50 text-amber-800 border-b border-amber-100">Sample leads. Events you send here are recorded as tests and never reach Meta.</p>}
        {mode === 'live' && !capiLive && <p className="px-5 py-2 text-[11px] bg-amber-50 text-amber-800 border-b border-amber-100">Set WA_BUSINESS_ACCOUNT_ID on the server (or share a WhatsApp account when connecting) to send conversion events to Meta.</p>}

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-surface-border bg-slate-50/60">
                <th className={clsx(thCls, 'px-5')}>Lead</th><th className={thCls}>Ad that brought them</th><th className={thCls}>Started chat</th><th className={thCls}>Chat</th><th className={thCls}>Sent to Meta</th><th className={clsx(thCls, 'px-5 text-right')}>Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-border">
              {paging.slice.map((l) => {
                const conv = findConversation(l, conversations), chat = conv && (CHAT[conv.status] || [conv.status, 'bg-slate-100 text-slate-600']), rev = revenueOf(l)
                return (
                  <tr key={l.id} onClick={() => setOpenId(l.id)} tabIndex={0} onKeyDown={(e) => e.key === 'Enter' && e.target === e.currentTarget && setOpenId(l.id)} aria-label={`Open ${l.contactName || l.waId}`}
                    className="hover:bg-slate-50/50 transition-colors cursor-pointer align-top focus:outline-none focus:bg-slate-50">
                    <td className="px-5 py-4 whitespace-nowrap"><p className="text-xs font-semibold text-slate-900">{l.contactName || 'Unknown'}</p><p className="text-[10px] text-slate-400">+{l.waId}</p>{rev > 0 && <p className="text-[10px] font-semibold text-emerald-600 mt-0.5">{money(rev, currency)} in sales</p>}</td>
                    <td className="px-4 py-4 max-w-[260px]"><p className="text-xs font-semibold text-slate-700 truncate">{l.adName || l.headline || '—'}</p>{l.sourceId && <p className="text-[9.5px] text-slate-300 font-mono mt-0.5">ID {l.sourceId}</p>}</td>
                    <td className="px-4 py-4 whitespace-nowrap text-xs text-slate-500">{when(l.createdAt)}</td>
                    <td className="px-4 py-4">{chat ? <span className={clsx('px-2 py-0.5 rounded-full text-[10px] font-bold', chat[1])}>{chat[0]}</span> : <span className="text-[10.5px] text-slate-300">Not in inbox</span>}</td>
                    <td className="px-4 py-4"><EventChips events={l.events} /></td>
                    <td className="px-5 py-4 whitespace-nowrap text-right" onClick={(e) => e.stopPropagation()}>
                      <div className="inline-flex items-center gap-1.5">
                        {!has(l, 'QualifiedLead') && <button onClick={() => setDialog({ lead: l, initial: 'QualifiedLead' })} className="px-2.5 py-1 rounded-lg border border-surface-border text-[11px] font-semibold text-slate-600 hover:border-primary hover:text-primary transition-colors">Qualified</button>}
                        <button onClick={() => setDialog({ lead: l, initial: 'Purchase' })} className="px-2.5 py-1 rounded-lg border border-surface-border text-[11px] font-semibold text-slate-600 hover:border-primary hover:text-primary transition-colors">Purchase</button>
                        <button onClick={() => setDialog({ lead: l, initial: 'LeadSubmitted' })} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-primary text-white text-[11px] font-semibold hover:bg-primary-hover transition-colors"><Send size={11} /> Event</button>
                      </div>
                    </td>
                  </tr>
                )
              })}
              {!shown.length && <tr><td colSpan={6}><EmptyState icon={Users} title={rows.length ? 'No leads match' : 'No leads from ads yet'} text={rows.length ? 'Try another filter or search.' : 'They appear here as soon as someone messages you from an ad.'} /></td></tr>}
            </tbody>
          </table>
        </div>
        <Pager paging={paging} of={rows.length} noun="leads" />
      </div>

      {openLead && <LeadDetail lead={openLead} currency={currency} mode={mode} capiLive={capiLive} onClose={() => setOpenId(null)} onChanged={reload} notify={notify} />}
      {dialog && <EventDialog lead={dialog.lead} initial={dialog.initial} currency={currency} onClose={() => setDialog(null)} onSent={sent} />}
    </div>
  )
}
