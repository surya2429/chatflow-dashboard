import { useCallback, useEffect, useMemo, useState } from 'react'
import { Check, ChevronLeft, Copy, Pencil, Search } from 'lucide-react'
import clsx from 'clsx'
import { useConversations } from '../../context/ConversationContext'
import { ctwa, money, num, pct } from '../../lib/ctwaApi'
import { ExportMenu } from '../ai/AiData'
import AdPreview from './AdPreview'
import { leadsExportTable } from './exports'
import { findConversation, revenueOf } from './journey'
import LeadDetail from './LeadDetail'
import { EventChips } from './Leads'
import { Banner, btnGhost, Card, EmptyState, Pager, Segmented, Spinner, StatusPill, Switch, thCls, usePaging } from './ui'

const when = (iso) => new Date(iso).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
const CHAT = { bot: ['Bot', 'bg-blue-50 text-blue-700'], agent: ['Agent', 'bg-emerald-50 text-emerald-700'], resolved: ['Resolved', 'bg-slate-100 text-slate-600'] }
const OBJECTIVE = { OUTCOME_ENGAGEMENT: 'Messages', OUTCOME_LEADS: 'Leads', OUTCOME_SALES: 'Sales', OUTCOME_TRAFFIC: 'Traffic' }
const has = (l, n) => l.events.some((e) => e.eventName === n && e.status !== 'failed')

function CopyId({ value }) {
  const [done, setDone] = useState(false)
  return (
    <button onClick={() => navigator.clipboard?.writeText(value).then(() => { setDone(true); setTimeout(() => setDone(false), 1400) }).catch(() => {})} aria-label={`Copy ${value}`} className="inline-flex items-center gap-1.5 font-mono text-[11px] text-slate-600 hover:text-primary break-all text-left">
      {value}{done ? <Check size={11} className="text-emerald-500 flex-shrink-0" /> : <Copy size={11} className="text-slate-300 flex-shrink-0" />}
    </button>
  )
}

/** One ad on its own page (like a campaign's insights in Broadcasting): performance, costs, the ad itself, and every lead it brought in. */
export default function AdInsights({ ad, stats, currency, mode, capiLive, rangeLabel, onBack, onEdit, onChanged, notify, onToggle }) {
  const { conversations } = useConversations()
  const [tab, setTab] = useState('overview')
  const [leads, setLeads] = useState(null)
  const [error, setError] = useState('')
  const [lt, setLt] = useState('all')
  const [q, setQ] = useState('')
  const [openId, setOpenId] = useState(null)
  const m = ad.metrics
  const s = stats ?? { leads: 0, qualified: 0, purchases: 0, revenue: 0 }

  const load = useCallback(() => ctwa.leads(ad.id).then((r) => { setLeads(r.leads); setError('') }).catch((e) => setError(e.message)), [ad.id])
  useEffect(() => { setLeads(null); load() }, [load])
  const changed = () => { load(); onChanged?.() }

  const counts = useMemo(() => ({ all: leads?.length ?? 0, qualified: leads?.filter((l) => has(l, 'QualifiedLead')).length ?? 0, purchased: leads?.filter((l) => has(l, 'Purchase')).length ?? 0, new: leads?.filter((l) => !l.events.length).length ?? 0 }), [leads])
  const shown = useMemo(() => (leads ?? []).filter((l) => {
    if (lt === 'qualified' && !has(l, 'QualifiedLead')) return false
    if (lt === 'purchased' && !has(l, 'Purchase')) return false
    if (lt === 'new' && l.events.length) return false
    const t = q.trim().toLowerCase()
    return !t || (l.contactName || '').toLowerCase().includes(t) || l.waId.includes(t.replace(/\D/g, '') || '§')
  }), [leads, lt, q])
  const paging = usePaging(shown, 10)
  const exportTable = useMemo(() => leadsExportTable({ leads: shown.map((l) => ({ ...l, adName: l.adName || ad.name })), ads: [ad], findChat: (l) => findConversation(l, conversations), currency }), [shown, ad, conversations, currency])
  const open = leads?.find((l) => l.id === openId)

  const chatRate = m.clicks ? (m.conversations / m.clicks) * 100 : 0
  const funnel = [['Impressions', m.impressions, 'bg-purple-400'], ['Link clicks', m.clicks, 'bg-sky-400'], ['Conversations started', m.conversations, 'bg-emerald-400'], ['Leads captured', s.leads, 'bg-teal-500'], ['Qualified', s.qualified, 'bg-primary'], ['Purchased', s.purchases, 'bg-amber-400']]
  const tiles = [
    ['Impressions', num(m.impressions), 'text-slate-900', 100, 'bg-purple-400', `${num(m.reach)} reached`],
    ['Link clicks', num(m.clicks), 'text-sky-600', Math.min(100, (m.ctr || 0) * 10), 'bg-sky-400', `${pct(m.ctr)} click-through`],
    ['Conversations', num(m.conversations), 'text-emerald-600', Math.min(100, chatRate), 'bg-emerald-500', `${chatRate.toFixed(1)}% of clicks`],
    ['Leads', num(s.leads), 'text-violet-600', m.conversations ? Math.min(100, (s.leads / m.conversations) * 100) : 0, 'bg-violet-500', `${num(s.qualified)} qualified`],
    ['Sales', money(s.revenue, currency), 'text-amber-600', s.leads ? Math.min(100, (s.purchases / s.leads) * 100) : 0, 'bg-amber-500', `${num(s.purchases)} ${s.purchases === 1 ? 'purchase' : 'purchases'}`],
  ]

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex flex-wrap items-center gap-3">
        <button onClick={onBack} className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-900 transition-colors font-medium"><ChevronLeft size={16} /> Back to Ads</button>
        <span className="text-slate-300">/</span>
        <span className="text-sm font-semibold text-slate-900 truncate max-w-[400px]">{ad.name}</span>
        <StatusPill status={ad.effectiveStatus} />
        <div className="ml-auto flex items-center gap-2">
          <Switch on={ad.status === 'ACTIVE'} onChange={(on) => onToggle(ad, on)} label={`${ad.status === 'ACTIVE' ? 'Pause' : 'Turn on'} ${ad.name}`} />
          <button onClick={() => onEdit(ad)} className={btnGhost}><Pencil size={12} /> Edit</button>
        </div>
      </div>

      <Segmented value={tab} onChange={setTab} options={[{ key: 'overview', label: 'Overview' }, { key: 'leads', label: 'Leads', count: leads?.length || 0 }]} />

      {tab === 'overview' && (
        <div className="space-y-5">
          <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider -mb-2">{rangeLabel}</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            {tiles.map(([label, value, color, bar, barColor, sub]) => (
              <div key={label} className="card p-4">
                <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1">{label}</p>
                <p className={clsx('text-xl font-bold leading-none mb-1 tabular-nums', color)}>{value}</p>
                <div className="h-1 bg-slate-100 rounded-full mb-1.5"><div className={clsx('h-full rounded-full', barColor)} style={{ width: `${Math.max(bar > 0 ? 3 : 0, bar)}%` }} /></div>
                <p className="text-[10px] text-slate-400">{sub}</p>
              </div>
            ))}
          </div>

          <div className="card p-4">
            <div className="grid grid-cols-2 sm:grid-cols-5 divide-surface-border sm:divide-x gap-y-3">
              {[['Amount spent', money(m.spend, currency)], ['Cost per conversation', money(m.costPerConversation, currency, 2)], ['Cost per lead', money(s.leads ? m.spend / s.leads : null, currency, 2)], ['Cost per click', money(m.cpc, currency, 2)], ['Return on ad spend', m.spend && s.revenue ? `${(s.revenue / m.spend).toFixed(2)}x` : '—']].map(([l, v]) => (
                <div key={l} className="px-6 first:pl-0 last:pr-0"><p className="text-sm font-bold text-slate-900 tabular-nums">{v}</p><p className="text-[10px] text-slate-400 mt-0.5">{l}</p></div>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
            <div className="lg:col-span-3 card p-5">
              <h3 className="text-xs font-bold text-slate-700 mb-4">From Click to Sale</h3>
              <div className="space-y-3">
                {funnel.map(([label, value, bar]) => {
                  const p = funnel[0][1] ? (value / funnel[0][1]) * 100 : 0
                  return (
                    <div key={label} className="flex items-center gap-3">
                      <span className="text-xs text-slate-500 w-36 flex-shrink-0">{label}</span>
                      <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden"><div className={clsx('h-full rounded-full transition-all', bar)} style={{ width: `${Math.min(100, Math.max(value ? 1.5 : 0, p))}%` }} /></div>
                      <span className="text-xs text-slate-400 w-14 text-right tabular-nums">{num(value)}</span>
                    </div>
                  )
                })}
              </div>
              <p className="text-[10px] text-slate-400 mt-4">{mode === 'sample' ? 'Sample mode only has a few example leads, so lead counts are far below the conversations in the sample numbers.' : 'Leads can be fewer than Meta’s conversations because some people message without the ad details attached.'}</p>
            </div>

            <div className="lg:col-span-2 card p-5">
              <h3 className="text-xs font-bold text-slate-700 mb-4">Ad Details</h3>
              <dl className="space-y-3 text-xs">
                {[['Ad ID', <CopyId key="a" value={ad.id} />], ['Campaign', ad.campaignName], ['Campaign ID', <CopyId key="c" value={ad.campaignId} />], ['Ad set ID', <CopyId key="s" value={ad.adsetId} />],
                  ['Goal', OBJECTIVE[ad.objective] || ad.objective], ['Daily budget', money(ad.dailyBudget, currency)], ['Created', when(ad.createdAt)]].map(([k, v]) => (
                  <div key={k} className="flex items-start justify-between gap-3"><dt className="text-slate-400 flex-shrink-0">{k}</dt><dd className="font-medium text-slate-800 text-right min-w-0">{v}</dd></div>
                ))}
              </dl>
            </div>
          </div>

          <div className="card p-5">
            <div className="flex flex-col sm:flex-row items-start gap-4 sm:gap-8">
              <div className="flex-1 min-w-0">
                <p className="text-xs font-bold text-slate-700 mb-1">{ad.headline || 'Untitled ad'}</p>
                <p className="text-xs text-slate-500 leading-relaxed whitespace-pre-wrap">{ad.primaryText}</p>
                <div className="flex flex-wrap gap-1.5 mt-3">
                  <span className="text-[10px] font-semibold text-primary border border-primary/30 px-2 py-0.5 rounded-full bg-primary/5">Send message</span>
                  <span className="text-[10px] font-semibold text-slate-500 border border-surface-border px-2 py-0.5 rounded-full">Opens WhatsApp</span>
                </div>
              </div>
              <div className="flex-shrink-0 w-full sm:w-[340px]">
                <AdPreview pageName="Your business" headline={ad.headline} primaryText={ad.primaryText} imageUrl={ad.imageUrl} welcome={{ type: 'autofill', greeting: '', autofillMessage: '', iceBreakers: [] }} />
              </div>
            </div>
          </div>
        </div>
      )}

      {tab === 'leads' && (
        <div className="card p-0 overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-2 px-5 py-2 border-b border-surface-border">
            <Segmented value={lt} onChange={setLt} options={[{ key: 'all', label: 'All', count: counts.all }, { key: 'new', label: 'New', count: counts.new }, { key: 'qualified', label: 'Qualified', count: counts.qualified }, { key: 'purchased', label: 'Purchased', count: counts.purchased }]} />
            <div className="flex items-center gap-2 py-2">
              <div className="relative">
                <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search leads" placeholder="Search name or number…" className="pl-8 pr-3 py-1.5 text-xs border border-surface-border rounded-lg w-52 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all placeholder-slate-400" />
              </div>
              <ExportMenu table={exportTable} name={`leads-${ad.name}`} label="Export leads" />
            </div>
          </div>
          {error && <div className="p-4"><Banner tone="error">{error}</Banner></div>}
          {!leads && !error && <Spinner label="Loading leads…" />}
          {leads && (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="border-b border-surface-border bg-slate-50/60"><th className={clsx(thCls, 'px-5')}>Lead</th><th className={thCls}>Started chat</th><th className={thCls}>Chat</th><th className={thCls}>Sent to Meta</th><th className={clsx(thCls, 'px-5 text-right')}>Sales</th></tr></thead>
                <tbody className="divide-y divide-surface-border">
                  {paging.slice.map((l) => {
                    const conv = findConversation(l, conversations), chat = conv && (CHAT[conv.status] || [conv.status, 'bg-slate-100 text-slate-600']), rev = revenueOf(l)
                    return (
                      <tr key={l.id} onClick={() => setOpenId(l.id)} tabIndex={0} onKeyDown={(e) => e.key === 'Enter' && setOpenId(l.id)} aria-label={`Open ${l.contactName || l.waId}`} className="hover:bg-slate-50/50 transition-colors cursor-pointer align-top focus:outline-none focus:bg-slate-50">
                        <td className="px-5 py-4 whitespace-nowrap"><p className="text-xs font-semibold text-slate-900">{l.contactName || 'Unknown'}</p><p className="text-[10px] text-slate-400">+{l.waId}</p></td>
                        <td className="px-4 py-4 whitespace-nowrap text-xs text-slate-500">{when(l.createdAt)}</td>
                        <td className="px-4 py-4">{chat ? <span className={clsx('px-2 py-0.5 rounded-full text-[10px] font-bold', chat[1])}>{chat[0]}</span> : <span className="text-[10.5px] text-slate-300">Not in inbox</span>}</td>
                        <td className="px-4 py-4"><EventChips events={l.events} /></td>
                        <td className="px-5 py-4 text-right text-xs tabular-nums font-semibold text-slate-700">{rev ? money(rev, currency) : '—'}</td>
                      </tr>
                    )
                  })}
                  {!shown.length && <tr><td colSpan={5}><EmptyState title={leads.length ? 'No leads match' : 'No leads from this ad yet'} text={leads.length ? 'Try another filter or search.' : 'They appear here as soon as someone messages you from it.'} /></td></tr>}
                </tbody>
              </table>
            </div>
          )}
          {leads && <Pager paging={paging} of={leads.length} noun="leads" />}
        </div>
      )}

      {open && <LeadDetail lead={{ ...open, adName: open.adName || ad.name }} currency={currency} mode={mode} capiLive={capiLive} onClose={() => setOpenId(null)} onChanged={changed} notify={notify} />}
    </div>
  )
}
