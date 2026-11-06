import { useCallback, useEffect, useMemo, useState } from 'react'
import { ImageIcon } from 'lucide-react'
import clsx from 'clsx'
import { useConversations } from '../../context/ConversationContext'
import { ctwa, money, num, pct } from '../../lib/ctwaApi'
import { ExportMenu } from '../ai/AiData'
import { leadsExportTable } from './exports'
import { findConversation, revenueOf } from './journey'
import LeadDetail from './LeadDetail'
import { EventChips } from './Leads'
import { LeadFilterBar, useLeadFilters } from './filters'
import { Banner, Card, CopyChip, Drawer, Spinner, StatusPill } from './ui'

const when = (iso) => new Date(iso).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
const CHAT = { bot: ['Bot', 'bg-blue-50 text-blue-700'], agent: ['Agent', 'bg-emerald-50 text-emerald-700'], resolved: ['Resolved', 'bg-slate-100 text-slate-600'] }

/** One ad on its own: how it is doing, what it looks like, and every lead it brought in — click a lead for the whole story. */
export default function AdDetail({ ad, stats, currency, mode, capiLive, rangeLabel, onClose, onChanged, notify }) {
  const { conversations } = useConversations()
  const [leads, setLeads] = useState(null)
  const [error, setError] = useState('')
  const [openId, setOpenId] = useState(null)
  const filters = useLeadFilters(leads ?? [])
  const shown = filters.shown
  const m = ad.metrics
  const s = stats ?? { leads: 0, qualified: 0, purchases: 0, revenue: 0 }

  const load = useCallback(() => ctwa.leads(ad.id).then((r) => { setLeads(r.leads); setError('') }).catch((e) => setError(e.message)), [ad.id])
  useEffect(() => { setLeads(null); load() }, [load])
  const changed = () => { load(); onChanged?.() }

  const exportTable = useMemo(() => leadsExportTable({ leads: shown.map((l) => ({ ...l, adName: l.adName || ad.name })), ads: [ad], findChat: (l) => findConversation(l, conversations), currency }), [shown, ad, conversations, currency])

  const funnel = [['Conversations started', m.conversations, 'On Meta'], ['Leads captured', s.leads, 'In your dashboard'], ['Qualified', s.qualified], ['Purchased', s.purchases]]
  const open = leads?.find((l) => l.id === openId)

  return (
    <>
      <Drawer onClose={onClose} width="max-w-[760px]"
        title={<div className="flex items-center gap-3">
          <span className="w-11 h-11 rounded-lg bg-gradient-to-br from-emerald-100 to-sky-100 flex items-center justify-center overflow-hidden flex-shrink-0">{ad.imageUrl ? <img src={ad.imageUrl} alt="" className="w-full h-full object-cover" /> : <ImageIcon size={16} className="text-slate-400" />}</span>
          <div className="min-w-0"><h2 className="text-sm font-bold text-slate-900 truncate">{ad.name}</h2><p className="text-[11px] text-slate-500 truncate">{ad.campaignName}</p></div>
          <StatusPill status={ad.effectiveStatus} />
        </div>}>
        <div className="p-5 space-y-4">
          <div>
            <p className="text-[10.5px] font-semibold text-slate-400 uppercase tracking-wide mb-2">{rangeLabel}</p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                ['Spent', money(m.spend, currency)],
                ['Leads', num(s.leads), m.conversations ? `${money(s.leads ? m.spend / s.leads : null, currency, 2)} per lead` : null],
                ['Sales', money(s.revenue, currency), `${num(s.purchases)} ${s.purchases === 1 ? 'purchase' : 'purchases'}`],
                ['Return on ad spend', m.spend && s.revenue ? `${(s.revenue / m.spend).toFixed(2)}x` : '—', 'Sales ÷ spend'],
              ].map(([l, v, sub]) => (
                <div key={l} className="bg-white border border-surface-border rounded-xl p-3.5"><p className="text-lg font-bold text-slate-900 tabular-nums leading-none">{v}</p><p className="text-[11px] text-slate-500 mt-1.5">{l}</p>{sub && <p className="text-[10px] text-slate-400 mt-0.5">{sub}</p>}</div>
              ))}
            </div>
          </div>

          <div className="bg-white border border-surface-border rounded-xl px-4 py-3.5 grid grid-cols-2 sm:grid-cols-4 gap-4">
            {[['Cost per conversation', money(m.costPerConversation, currency, 2)], ['Cost per click', money(m.cpc, currency, 2)], ['Click-through rate', pct(m.ctr)], ['Reach', num(m.reach)]].map(([l, v]) => (
              <div key={l}><p className="text-sm font-bold text-slate-900 tabular-nums">{v}</p><p className="text-[10.5px] text-slate-400 mt-0.5">{l}</p></div>
            ))}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card title="From click to sale" bodyClass="p-4 space-y-2.5">
              {funnel.map(([l, v, hint], i) => (
                <div key={l}>
                  <div className="flex items-baseline justify-between text-xs mb-1"><span className="font-semibold text-slate-700">{l}{hint && <span className="ml-1.5 text-[10px] font-normal text-slate-400">{hint}</span>}</span><span className="tabular-nums font-bold text-slate-800">{num(v)}</span></div>
                  <div className="h-2 rounded-full bg-slate-100 overflow-hidden"><div className="h-full rounded-full" style={{ width: `${funnel[0][1] ? Math.min(100, Math.max(v ? 3 : 0, (v / funnel[0][1]) * 100)) : 0}%`, background: ['#0ea5e9', '#25D366', '#5B5BF0', '#f59e0b'][i] }} /></div>
                </div>
              ))}
              <p className="text-[10px] text-slate-400 pt-1">
                {mode === 'sample' ? 'Sample mode only has a few example leads, so lead counts are far below the conversations in the sample numbers.' : 'Leads can be fewer than Meta’s conversations because some people message without the ad details attached.'}
              </p>
            </Card>

            <Card title="The ad" bodyClass="p-4 space-y-3">
              <div className="aspect-[1.91/1] rounded-lg bg-gradient-to-br from-emerald-100 via-sky-100 to-indigo-100 overflow-hidden flex items-center justify-center">
                {ad.imageUrl ? <img src={ad.imageUrl} alt="Ad" className="w-full h-full object-cover" /> : <ImageIcon size={24} className="text-slate-300" />}
              </div>
              <div><p className="text-xs font-bold text-slate-800">{ad.headline || '—'}</p><p className="text-[11px] text-slate-500 mt-1 leading-relaxed">{ad.primaryText}</p></div>
              <p className="text-[10.5px] text-slate-400">Budget {money(ad.dailyBudget, currency)}/day · CTR {pct(m.ctr)} · {num(m.clicks)} clicks · created {new Date(ad.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</p>
              <dl className="space-y-1.5 pt-3 border-t border-surface-border text-[11px]">
                {[['Ad ID', ad.id], ['Campaign ID', ad.campaignId], ['Ad set ID', ad.adsetId]].map(([k, v]) => <div key={k} className="flex items-start justify-between gap-3"><dt className="text-slate-400 flex-shrink-0">{k}</dt><dd className="text-right min-w-0"><CopyChip value={v} label={k} /></dd></div>)}
              </dl>
            </Card>
          </div>

          <div className="space-y-3">
            <div><h3 className="text-xs font-bold text-slate-800">Leads from this ad</h3><p className="text-[10.5px] text-slate-400 mt-0.5">Everyone who started a chat from it, newest first. Filter by date, stage or name.</p></div>
            {leads?.length > 0 && <LeadFilterBar filters={filters} total={leads.length} right={<ExportMenu table={exportTable} name={`leads-${ad.name}`} />} />}
          <Card bodyClass="">
            {error && <div className="p-4"><Banner tone="error">{error}</Banner></div>}
            {!leads && !error && <Spinner label="Loading leads…" />}
            {leads && !leads.length && <p className="px-4 py-10 text-center text-xs text-slate-400">No leads from this ad yet. They appear here as soon as someone messages you from it.</p>}
            {leads?.length > 0 && !shown.length && <p className="px-4 py-10 text-center text-xs text-slate-400">No leads match these filters.</p>}
            {shown.length > 0 && (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead><tr className="bg-slate-50 text-left text-[10.5px] font-semibold text-slate-500">{['Lead', 'Started chat', 'Chat', 'Sent to Meta', 'Sales'].map((h) => <th key={h} className={clsx('px-4 py-2.5 border-b border-surface-border whitespace-nowrap', h === 'Sales' && 'text-right')}>{h}</th>)}</tr></thead>
                  <tbody>
                    {shown.map((l) => {
                      const conv = findConversation(l, conversations)
                      const chat = conv && (CHAT[conv.status] || [conv.status, 'bg-slate-100 text-slate-600'])
                      const rev = revenueOf(l)
                      return (
                        <tr key={l.id} onClick={() => setOpenId(l.id)} tabIndex={0} onKeyDown={(e) => e.key === 'Enter' && setOpenId(l.id)} aria-label={`Open ${l.contactName || l.waId}`}
                          className="border-b border-surface-border/70 hover:bg-slate-50 cursor-pointer align-top focus:outline-none focus:bg-slate-50">
                          <td className="px-4 py-3 whitespace-nowrap"><p className="font-semibold text-slate-800">{l.contactName || 'Unknown'}</p><p className="text-[10.5px] text-slate-400">+{l.waId}</p></td>
                          <td className="px-4 py-3 whitespace-nowrap text-slate-600">{when(l.createdAt)}</td>
                          <td className="px-4 py-3">{chat ? <span className={clsx('px-2 py-0.5 rounded-full text-[10px] font-bold', chat[1])}>{chat[0]}</span> : <span className="text-[10.5px] text-slate-300">Not in inbox</span>}</td>
                          <td className="px-4 py-3"><EventChips events={l.events} /></td>
                          <td className="px-4 py-3 text-right tabular-nums font-semibold text-slate-700">{rev ? money(rev, currency) : '—'}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
          </div>
        </div>
      </Drawer>
      {open && <LeadDetail lead={{ ...open, adName: open.adName || ad.name }} currency={currency} mode={mode} capiLive={capiLive} z="z-[65]" onClose={() => setOpenId(null)} onChanged={changed} notify={notify} />}
    </>
  )
}
