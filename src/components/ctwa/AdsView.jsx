import { useMemo, useState } from 'react'
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { Archive, BarChart2, Eye, IndianRupee, Loader2, MessageCircle, MousePointerClick, Pencil, Plus, Search, Target, TrendingUp, Trophy, Users, Wallet, Zap, ImageIcon, Megaphone } from 'lucide-react'
import clsx from 'clsx'
import { ctwa, money, num, pct } from '../../lib/ctwaApi'
import { ExportMenu } from '../ai/AiData'
import { adsExportTable, dailyExportTable } from './exports'
import { btnPrimary, Card, EmptyState, Kpi, Pager, Segmented, StatusPill, Switch, thCls, usePaging } from './ui'

const SERIES = [['conversations', 'Conversations', '#25D366'], ['spend', 'Spend', '#5B5BF0'], ['clicks', 'Clicks', '#0ea5e9'], ['impressions', 'Impressions', '#a855f7']]
const ATTENTION = new Set(['DISAPPROVED', 'WITH_ISSUES', 'PENDING_REVIEW', 'IN_PROCESS', 'PENDING_BILLING_INFO'])
const OBJECTIVE = { OUTCOME_ENGAGEMENT: 'Messages', OUTCOME_LEADS: 'Leads', OUTCOME_SALES: 'Sales', OUTCOME_TRAFFIC: 'Traffic' }
const empty = { leads: 0, qualified: 0, purchases: 0, revenue: 0 }

const Bar = ({ label, value, max, text, color }) => (
  <div className="flex items-center gap-2">
    <span className="text-[10px] text-slate-400 w-14 flex-shrink-0">{label}</span>
    <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden"><div className={clsx('h-full rounded-full', color)} style={{ width: `${Math.min(100, max ? (value / max) * 100 : 0)}%` }} /></div>
    <span className="text-[10px] font-semibold text-slate-600 w-12 text-right tabular-nums">{text}</span>
  </div>
)

export default function AdsView({ data, reload, notify, onCreate, onOpenAd, onEditAd }) {
  const { ads, totals: t, daily, currency, leadStats = {} } = data
  const [series, setSeries] = useState('conversations')
  const [tab, setTab] = useState('all')
  const [q, setQ] = useState('')
  const [busy, setBusy] = useState('')
  const [confirm, setConfirm] = useState('')
  const stats = (a) => leadStats[a.id] ?? empty

  const sum = useMemo(() => Object.values(leadStats).reduce((n, s) => ({ leads: n.leads + s.leads, qualified: n.qualified + s.qualified, purchases: n.purchases + s.purchases, revenue: n.revenue + s.revenue }), { ...empty }), [leadStats])
  const counts = { all: ads.length, ACTIVE: ads.filter((a) => a.status === 'ACTIVE').length, PAUSED: ads.filter((a) => a.status === 'PAUSED').length, issues: ads.filter((a) => ATTENTION.has(a.effectiveStatus)).length }
  const rows = useMemo(() => ads.filter((a) => {
    if (tab === 'ACTIVE' || tab === 'PAUSED') { if (a.status !== tab) return false }
    if (tab === 'issues' && !ATTENTION.has(a.effectiveStatus)) return false
    const s = q.trim().toLowerCase()
    return !s || a.name.toLowerCase().includes(s) || a.campaignName.toLowerCase().includes(s) || a.headline.toLowerCase().includes(s) || a.id.includes(s)
  }), [ads, tab, q])
  const paging = usePaging(rows, 8)

  const budget = ads.filter((a) => a.status === 'ACTIVE').reduce((n, a) => n + (a.dailyBudget || 0), 0)
  const today = daily[daily.length - 1]?.spend ?? 0
  const best = [...ads].filter((a) => a.metrics.conversations > 0).sort((a, b) => b.metrics.conversations - a.metrics.conversations)[0]
  const maxCtr = Math.max(0.01, ...ads.map((a) => a.metrics.ctr || 0)), maxChat = Math.max(0.01, ...ads.map((a) => (a.metrics.clicks ? (a.metrics.conversations / a.metrics.clicks) * 100 : 0)))
  const [, label, color] = SERIES.find(([k]) => k === series)
  const fmt = (v) => (series === 'spend' ? money(v, currency, 0) : num(v))

  const adsExport = useMemo(() => adsExportTable({ ads: rows, leadStats, currency, range: data.range }), [rows, leadStats, currency, data.range])
  const dailyExport = useMemo(() => dailyExportTable({ daily, currency }), [daily, currency])

  async function run(id, fn, ok) {
    setBusy(id)
    try { await fn(); notify(ok, 'ok'); await reload() } catch (e) { notify(e.message, 'error') } finally { setBusy(''); setConfirm('') }
  }
  const toggle = (a, on) => run(a.id, () => ctwa.updateAd(a.id, { status: on ? 'ACTIVE' : 'PAUSED' }), on ? `“${a.name}” is on.` : `“${a.name}” is paused.`)
  const archive = (a) => run(a.id, () => ctwa.archiveAd(a.id), `“${a.name}” was archived.`)

  return (
    <div className="space-y-5">
      {/* ── Account health ── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="card p-4">
          <div className="flex items-start justify-between mb-3">
            <div><p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-0.5">Daily Budget</p><p className="text-[11px] font-semibold text-slate-900">Spend vs. Budget</p></div>
            <Wallet size={13} className="text-slate-300 flex-shrink-0" />
          </div>
          <div className="mb-2.5">
            <div className="flex justify-between text-[10px] mb-1.5"><span className="text-slate-400">Spent today</span><span className="font-semibold text-slate-700">{money(today, currency)} <span className="text-slate-400 font-normal">/ {money(budget, currency)}</span></span></div>
            <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden"><div className="h-full bg-primary rounded-full" style={{ width: `${budget ? Math.min(100, (today / budget) * 100) : 0}%` }} /></div>
          </div>
          <div className="flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-emerald-400 flex-shrink-0" /><p className="text-[10px] text-slate-500">{money(Math.max(0, budget - today), currency)} left across {counts.ACTIVE} active {counts.ACTIVE === 1 ? 'ad' : 'ads'}</p></div>
        </div>

        <div className="card p-4">
          <div className="flex items-start justify-between mb-3">
            <div><p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-0.5">Delivery</p><p className="text-[11px] font-semibold text-slate-900">Ad Status</p></div>
            <Zap size={13} className="text-amber-400 flex-shrink-0" />
          </div>
          <div className="flex items-end gap-5 mb-3">
            {[['Active', counts.ACTIVE, 'text-emerald-600'], ['Paused', counts.PAUSED, 'text-slate-600'], ['Attention', counts.issues, counts.issues ? 'text-red-600' : 'text-slate-400']].map(([l, v, c]) => (
              <div key={l}><p className={clsx('text-xl font-bold leading-none tabular-nums', c)}>{v}</p><p className="text-[10px] text-slate-400 mt-1">{l}</p></div>
            ))}
          </div>
          <p className="text-[10px] text-slate-500">{counts.issues ? `${counts.issues} ${counts.issues === 1 ? 'ad needs' : 'ads need'} a look: in review or rejected by Meta` : 'Everything is delivering normally'}</p>
        </div>

        <div className="card p-4">
          <div className="flex items-start justify-between mb-3">
            <div><p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-0.5">Top Performer</p><p className="text-[11px] font-semibold text-slate-900">Most Conversations</p></div>
            <Trophy size={13} className="text-amber-400 flex-shrink-0" />
          </div>
          {best ? (
            <>
              <button onClick={() => onOpenAd(best)} className="text-left block max-w-full"><p className="text-xs font-bold text-slate-900 truncate hover:text-primary transition-colors">{best.name}</p></button>
              <p className="text-[11px] text-slate-500 mt-1"><span className="font-bold text-slate-800 tabular-nums">{num(best.metrics.conversations)}</span> conversations · <span className="tabular-nums">{money(best.metrics.costPerConversation, currency, 2)}</span> each</p>
              <p className="text-[10px] text-slate-400 mt-2">{num(stats(best).leads)} leads · {money(stats(best).revenue, currency)} in sales</p>
            </>
          ) : <p className="text-xs text-slate-400 mt-2">No conversations in this period yet.</p>}
        </div>
      </div>

      {/* ── Primary metrics ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Kpi icon={IndianRupee} label="Amount Spent" value={money(t.spend, currency)} sub={`${money(today, currency)} today`} iconBg="bg-indigo-50" iconColor="text-indigo-500" />
        <Kpi icon={MessageCircle} label="Conversations Started" value={num(t.conversations)} sub={`${money(t.costPerConversation, currency, 2)} per conversation`} iconBg="bg-emerald-50" iconColor="text-emerald-500" />
        <Kpi icon={Users} label="Leads Captured" value={num(sum.leads)} sub={`${num(sum.qualified)} qualified · ${num(sum.purchases)} bought`} iconBg="bg-violet-50" iconColor="text-violet-500" />
        <Kpi icon={TrendingUp} label="Sales Reported" value={money(sum.revenue, currency)} sub={t.spend && sum.revenue ? `${(sum.revenue / t.spend).toFixed(2)}x return on ad spend` : 'No purchases reported yet'} iconBg="bg-amber-50" iconColor="text-amber-500" />
      </div>

      {/* ── Secondary metrics ── */}
      <div className="card p-4">
        <div className="grid grid-cols-2 sm:grid-cols-4 divide-surface-border sm:divide-x gap-y-3">
          {[['Impressions', num(t.impressions), Eye, 'text-purple-600'], ['Reach', num(t.reach), Users, 'text-pink-600'], ['Link clicks', num(t.clicks), MousePointerClick, 'text-sky-600'], ['Click-through rate', pct(t.ctr), Target, 'text-amber-600']].map(([l, v, Icon, c]) => (
            <div key={l} className="px-6 first:pl-0 last:pr-0 flex items-center gap-3">
              <Icon size={14} className={c} /><span className={clsx('text-sm font-bold tabular-nums', c)}>{v}</span><span className="text-[10px] text-slate-400 leading-tight">{l}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ── Performance over time ── */}
      <Card title="Performance over time" sub={`${label} per day`}
        right={<div className="flex items-center gap-2"><Segmented value={series} onChange={setSeries} options={SERIES.map(([key, l]) => ({ key, label: l }))} /><ExportMenu table={dailyExport} name="ctwa-daily" /></div>} bodyClass="px-2 pt-4 pb-2">
        <div className="h-[240px]">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={daily} margin={{ top: 4, right: 16, left: 0, bottom: 0 }}>
              <defs><linearGradient id="ctwaFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={color} stopOpacity={0.28} /><stop offset="100%" stopColor={color} stopOpacity={0} /></linearGradient></defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#eef0f4" vertical={false} />
              <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#94a3b8' }} tickLine={false} axisLine={false} tickFormatter={(d) => d.slice(5)} minTickGap={24} />
              <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} tickLine={false} axisLine={false} width={48} tickFormatter={(v) => (v >= 1000 ? `${Math.round(v / 100) / 10}k` : v)} />
              <Tooltip formatter={(v) => [fmt(v), label]} contentStyle={{ fontSize: 11, borderRadius: 8, border: '1px solid #e5e7eb' }} />
              <Area type="monotone" dataKey={series} stroke={color} strokeWidth={2} fill="url(#ctwaFill)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </Card>

      {/* ── Ads table ── */}
      <div className="card p-0 overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-2 px-5 py-2 border-b border-surface-border">
          <Segmented value={tab} onChange={setTab} options={[{ key: 'all', label: 'All', count: counts.all }, { key: 'ACTIVE', label: 'Active', count: counts.ACTIVE }, { key: 'PAUSED', label: 'Paused', count: counts.PAUSED }, { key: 'issues', label: 'Needs attention', count: counts.issues }]} />
          <div className="flex items-center gap-2 py-2">
            <div className="relative">
              <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search ads" placeholder="Search ads, campaigns or IDs…" className="pl-8 pr-3 py-1.5 text-xs border border-surface-border rounded-lg w-60 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all placeholder-slate-400" />
            </div>
            <ExportMenu table={adsExport} name="ctwa-ads" label="Export ads" />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-surface-border bg-slate-50/60">
                <th className={clsx(thCls, 'px-5')}>Ad</th><th className={thCls}>Budget / Spent</th><th className={thCls}>Conversations</th>
                <th className={clsx(thCls, 'min-w-[190px]')}>Performance</th><th className={thCls}>Leads</th><th className={thCls}>Status</th><th className={thCls}>Created</th><th className={clsx(thCls, 'px-5 text-right')}>Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-border">
              {paging.slice.map((a) => {
                const m = a.metrics, s = stats(a), working = busy === a.id
                const chat = m.clicks ? (m.conversations / m.clicks) * 100 : 0
                return (
                  <tr key={a.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-5 py-4">
                      <div className="flex items-start gap-3">
                        <span className="w-9 h-9 rounded-lg bg-gradient-to-br from-emerald-100 to-sky-100 flex items-center justify-center flex-shrink-0 overflow-hidden mt-0.5">
                          {a.imageUrl ? <img src={a.imageUrl} alt="" className="w-full h-full object-cover" /> : <ImageIcon size={13} className="text-slate-400" />}
                        </span>
                        <div className="min-w-0">
                          <button onClick={() => onOpenAd(a)} className="text-left block"><p className="text-xs font-semibold text-slate-900 hover:text-primary transition-colors max-w-[220px] truncate">{a.name}</p></button>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-violet-50 text-violet-600">{OBJECTIVE[a.objective] || 'Messages'}</span>
                            <span className="text-[10px] text-slate-400 truncate max-w-[130px]">{a.campaignName}</span>
                          </div>
                          <p className="text-[9.5px] text-slate-300 mt-0.5 font-mono">ID {a.id}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-4"><p className="text-xs font-semibold text-slate-800 tabular-nums">{money(a.dailyBudget, currency)}<span className="text-slate-400 font-normal"> /day</span></p><p className="text-[10px] text-slate-400 tabular-nums">{money(m.spend, currency)} spent</p></td>
                    <td className="px-4 py-4"><p className="text-xs font-bold text-slate-900 tabular-nums">{num(m.conversations)}</p><p className="text-[10px] text-slate-400 tabular-nums">{money(m.costPerConversation, currency, 2)} each</p></td>
                    <td className="px-4 py-4"><div className="space-y-1.5">
                      <Bar label="Click rate" value={m.ctr || 0} max={maxCtr} text={pct(m.ctr).replace(/\.00%/, '%')} color="bg-sky-400" />
                      <Bar label="Chat rate" value={chat} max={maxChat} text={`${chat.toFixed(1)}%`} color="bg-emerald-400" />
                    </div></td>
                    <td className="px-4 py-4"><button onClick={() => onOpenAd(a)} title="See the leads from this ad" className="text-xs font-bold text-primary hover:underline tabular-nums">{num(s.leads)}</button><p className="text-[10px] text-slate-400 tabular-nums">{s.revenue ? money(s.revenue, currency) : 'no sales yet'}</p></td>
                    <td className="px-4 py-4"><div className="flex items-center gap-2.5">
                      {working ? <Loader2 size={14} className="animate-spin text-slate-400" /> : <Switch on={a.status === 'ACTIVE'} onChange={(on) => toggle(a, on)} label={`${a.status === 'ACTIVE' ? 'Pause' : 'Turn on'} ${a.name}`} />}
                      <StatusPill status={a.effectiveStatus} />
                    </div></td>
                    <td className="px-4 py-4"><p className="text-xs text-slate-500 whitespace-nowrap">{new Date(a.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</p></td>
                    <td className="px-5 py-4 text-right whitespace-nowrap">
                      {confirm === a.id ? (
                        <span className="inline-flex items-center gap-1.5 text-[11px]">Archive?
                          <button onClick={() => archive(a)} className="font-semibold text-red-600 hover:underline">Yes</button>
                          <button onClick={() => setConfirm('')} className="font-semibold text-slate-500 hover:underline">No</button>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-0.5">
                          <button onClick={() => onOpenAd(a)} className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary hover:bg-primary/5 px-3 py-1.5 rounded-lg transition-colors"><BarChart2 size={12} /> Analytics</button>
                          <button onClick={() => onEditAd(a)} aria-label={`Edit ${a.name}`} title="Edit name or budget" className="p-1.5 rounded-lg text-slate-300 hover:text-slate-700 hover:bg-surface-hover"><Pencil size={13} /></button>
                          <button onClick={() => setConfirm(a.id)} aria-label={`Archive ${a.name}`} title="Archive" className="p-1.5 rounded-lg text-slate-300 hover:text-red-500 hover:bg-red-50"><Archive size={13} /></button>
                        </span>
                      )}
                    </td>
                  </tr>
                )
              })}
              {!rows.length && (
                <tr><td colSpan={8}>
                  <EmptyState icon={Megaphone} title={q || tab !== 'all' ? 'No ads match' : 'No Click-to-WhatsApp ads yet'} text={q || tab !== 'all' ? 'Try another filter or search.' : 'Create your first ad and it will show up here with its results.'}
                    action={!q && tab === 'all' && <button onClick={onCreate} className={btnPrimary}><Plus size={13} /> Create Ad</button>} />
                </td></tr>
              )}
            </tbody>
          </table>
        </div>
        <Pager paging={paging} of={ads.length} noun="ads" />
      </div>
    </div>
  )
}
