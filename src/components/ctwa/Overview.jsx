import { useMemo, useState } from 'react'
import { Area, CartesianGrid, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { AlertTriangle, CheckCircle2, IndianRupee, MessageCircle, MousePointerClick, Sparkles, Target, TrendingUp, Users } from 'lucide-react'
import clsx from 'clsx'
import { ExportMenu } from '../ai/AiData'
import { money, num, pct } from '../../lib/ctwaApi'
import { dailyExportTable } from './exports'
import { Card, Delta, Segmented, Stat } from './ui'

const SERIES = [['conversations', 'Conversations', '#25D366'], ['spend', 'Spend', '#5B5BF0'], ['clicks', 'Clicks', '#0ea5e9'], ['impressions', 'Impressions', '#a855f7']]
const zero = { leads: 0, qualified: 0, purchases: 0, revenue: 0 }
const addStats = (m) => Object.values(m ?? {}).reduce((n, s) => ({ leads: n.leads + s.leads, qualified: n.qualified + s.qualified, purchases: n.purchases + s.purchases, revenue: n.revenue + s.revenue }), { ...zero })

export default function Overview({ data, prev, leads, rangeLabel, onOpenAd, onGoLeads }) {
  const [series, setSeries] = useState('conversations')
  const [compare, setCompare] = useState(true)
  const { totals: t, daily, ads, currency } = data
  const pt = prev?.totals
  const sum = useMemo(() => addStats(data.leadStats), [data.leadStats])
  const psum = useMemo(() => addStats(prev?.leadStats), [prev])
  const [, label, color] = SERIES.find(([k]) => k === series)
  const fmt = (v) => (series === 'spend' ? money(v, currency, 0) : num(v))
  const chart = useMemo(() => daily.map((d, i) => ({ ...d, prev: prev?.daily?.[i]?.[series] ?? null })), [daily, prev, series])
  const dailyExport = useMemo(() => dailyExportTable({ daily, currency }), [daily, currency])

  const top = [...ads].sort((a, b) => b.metrics.conversations - a.metrics.conversations).filter((a) => a.metrics.conversations > 0).slice(0, 5)
  const maxConv = Math.max(1, ...top.map((a) => a.metrics.conversations))
  const funnel = [['Impressions', t.impressions, '#a855f7'], ['Link clicks', t.clicks, '#0ea5e9'], ['Conversations', t.conversations, '#25D366'], ['Leads captured', sum.leads, '#14b8a6'], ['Qualified', sum.qualified, '#5B5BF0'], ['Purchased', sum.purchases, '#f59e0b']]

  // things worth a look, worked out from the numbers on screen
  const notes = useMemo(() => {
    const out = []
    const avg = t.costPerConversation
    for (const a of ads) {
      if (a.effectiveStatus === 'DISAPPROVED' || a.effectiveStatus === 'WITH_ISSUES') out.push({ tone: 'red', ad: a, text: <><b>{a.name}</b> has a problem Meta flagged, so it is not delivering.</> })
      else if (a.status === 'ACTIVE' && a.metrics.spend > 0 && a.metrics.conversations === 0) out.push({ tone: 'amber', ad: a, text: <><b>{a.name}</b> spent {money(a.metrics.spend, currency)} without starting a conversation.</> })
      else if (avg && a.metrics.conversations >= 20 && a.metrics.costPerConversation > avg * 1.5) out.push({ tone: 'amber', ad: a, text: <><b>{a.name}</b> costs {money(a.metrics.costPerConversation, currency, 2)} per conversation, {(a.metrics.costPerConversation / avg).toFixed(1)}× your average.</> })
    }
    const waiting = (leads ?? []).filter((l) => !l.events.length).length
    if (waiting) out.push({ tone: 'blue', go: true, text: <><b>{waiting}</b> {waiting === 1 ? 'lead has' : 'leads have'} not been followed up yet. Tell Meta when they qualify or buy.</> })
    return out.slice(0, 5)
  }, [ads, t.costPerConversation, leads, currency])

  const spark = (k) => daily.map((d) => d[k])
  const cpcSpark = daily.map((d) => (d.conversations ? d.spend / d.conversations : 0))

  return (
    <div className="space-y-5">
      {/* ── the headline ── */}
      <div className="rounded-2xl border border-primary/15 bg-gradient-to-br from-primary-50 via-white to-emerald-50/50 p-5 flex flex-wrap items-center gap-x-8 gap-y-4">
        <div className="flex-1 min-w-[260px]">
          <p className="text-[10px] font-bold text-primary uppercase tracking-wider mb-1.5">{rangeLabel}</p>
          <p className="text-[15px] leading-relaxed text-slate-700">
            You spent <b className="text-slate-900">{money(t.spend, currency)}</b> and started <b className="text-slate-900">{num(t.conversations)}</b> WhatsApp conversations at <b className="text-slate-900">{money(t.costPerConversation, currency, 2)}</b> each.
          </p>
          <div className="flex items-center gap-2 mt-2 text-[11px] text-slate-500">vs the previous period: <Delta now={t.conversations} before={pt?.conversations} /> conversations <Delta now={t.costPerConversation} before={pt?.costPerConversation} goodWhenUp={false} /> cost each</div>
        </div>
        <div className="flex gap-6">
          {[['Leads', num(sum.leads)], ['Sales', money(sum.revenue, currency)], ['Return on spend', t.spend && sum.revenue ? `${(sum.revenue / t.spend).toFixed(2)}x` : '—']].map(([l, v]) => (
            <div key={l}><p className="text-xl font-bold text-slate-900 tabular-nums leading-none">{v}</p><p className="text-[10.5px] text-slate-500 mt-1.5">{l}</p></div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">
        <Stat label="Amount spent" value={money(t.spend, currency)} icon={IndianRupee} tone="text-indigo-600 bg-indigo-50" delta={<Delta now={t.spend} before={pt?.spend} goodWhenUp={null} />} spark={spark('spend')} sparkColor="#5B5BF0" sparkId="spend" />
        <Stat label="Conversations" value={num(t.conversations)} icon={MessageCircle} tone="text-emerald-600 bg-emerald-50" delta={<Delta now={t.conversations} before={pt?.conversations} />} spark={spark('conversations')} sparkColor="#25D366" sparkId="conv" />
        <Stat label="Cost per conversation" value={money(t.costPerConversation, currency, 2)} icon={Target} tone="text-amber-600 bg-amber-50" delta={<Delta now={t.costPerConversation} before={pt?.costPerConversation} goodWhenUp={false} />} spark={cpcSpark} sparkColor="#f59e0b" sparkId="cpc" />
        <Stat label="Leads captured" value={num(sum.leads)} sub={`${num(sum.qualified)} qualified`} icon={Users} tone="text-violet-600 bg-violet-50" delta={<Delta now={sum.leads} before={psum.leads} />} onClick={onGoLeads} />
        <Stat label="Sales reported" value={money(sum.revenue, currency)} sub={`${num(sum.purchases)} ${sum.purchases === 1 ? 'purchase' : 'purchases'}`} icon={TrendingUp} tone="text-teal-600 bg-teal-50" delta={<Delta now={sum.revenue} before={psum.revenue} />} />
        <Stat label="Link clicks" value={num(t.clicks)} sub={`CTR ${pct(t.ctr)}`} icon={MousePointerClick} tone="text-sky-600 bg-sky-50" delta={<Delta now={t.clicks} before={pt?.clicks} />} spark={spark('clicks')} sparkColor="#0ea5e9" sparkId="clicks" />
      </div>

      <Card title="Performance over time" sub={`${label} per day`}
        right={<div className="flex items-center gap-2.5">
          {prev && <label className="inline-flex items-center gap-1.5 text-[11px] text-slate-500 cursor-pointer select-none"><input type="checkbox" checked={compare} onChange={(e) => setCompare(e.target.checked)} className="accent-primary" /> Compare to previous period</label>}
          <Segmented value={series} onChange={setSeries} options={SERIES.map(([key, l]) => ({ key, label: l }))} />
          <ExportMenu table={dailyExport} name="ctwa-daily" />
        </div>} bodyClass="px-2 pt-4 pb-2">
        <div className="h-[270px]">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={chart} margin={{ top: 4, right: 16, left: 0, bottom: 0 }}>
              <defs><linearGradient id="ctwaFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={color} stopOpacity={0.28} /><stop offset="100%" stopColor={color} stopOpacity={0} /></linearGradient></defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#eef0f4" vertical={false} />
              <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#94a3b8' }} tickLine={false} axisLine={false} tickFormatter={(d) => d.slice(5)} minTickGap={24} />
              <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} tickLine={false} axisLine={false} width={48} tickFormatter={(v) => (v >= 1000 ? `${Math.round(v / 100) / 10}k` : v)} />
              <Tooltip formatter={(v, name) => [fmt(v), name === 'prev' ? 'Previous period' : label]} labelFormatter={(d) => d} contentStyle={{ fontSize: 11, borderRadius: 10, border: '1px solid #e5e7eb' }} />
              <Area type="monotone" dataKey={series} name={label} stroke={color} strokeWidth={2} fill="url(#ctwaFill)" />
              {compare && prev && <Line type="monotone" dataKey="prev" name="prev" stroke="#94a3b8" strokeWidth={1.5} strokeDasharray="4 4" dot={false} />}
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <Card title="From impression to sale" sub="How many people moved to the next step" bodyClass="p-4 space-y-3.5">
          {funnel.map(([l, v, c], i) => (
            <div key={l}>
              <div className="flex items-baseline justify-between text-xs mb-1">
                <span className="font-semibold text-slate-700">{l}</span>
                <span className="tabular-nums text-slate-800 font-bold">{num(v)}{i > 0 && funnel[i - 1][1] > 0 && <span className="ml-2 text-[10.5px] font-normal text-slate-400">{((v / funnel[i - 1][1]) * 100).toFixed(1)}%</span>}</span>
              </div>
              <div className="h-2 rounded-full bg-slate-100 overflow-hidden"><div className="h-full rounded-full transition-all" style={{ width: `${funnel[0][1] ? Math.max(v ? 1.5 : 0, (v / funnel[0][1]) * 100) : 0}%`, background: c }} /></div>
            </div>
          ))}
        </Card>

        <Card title="Top ads" sub="Most conversations in this period" bodyClass="p-2">
          {!top.length && <p className="text-xs text-slate-400 py-8 text-center">No conversations in this period yet.</p>}
          {top.map((a, i) => {
            const s = data.leadStats?.[a.id] ?? zero
            return (
              <button key={a.id} onClick={() => onOpenAd(a)} className="w-full text-left flex items-center gap-3 px-2.5 py-2.5 rounded-xl hover:bg-slate-50 transition-colors">
                <span className={clsx('w-6 h-6 rounded-lg text-[11px] font-bold flex items-center justify-center flex-shrink-0', i === 0 ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-500')}>{i + 1}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-slate-800 truncate">{a.name}</p>
                  <div className="h-1.5 rounded-full bg-slate-100 overflow-hidden mt-1.5"><div className="h-full rounded-full bg-emerald-500" style={{ width: `${(a.metrics.conversations / maxConv) * 100}%` }} /></div>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="text-xs font-bold text-slate-900 tabular-nums">{num(a.metrics.conversations)}</p>
                  <p className="text-[10px] text-slate-400 tabular-nums">{money(a.metrics.costPerConversation, currency, 2)} · {num(s.leads)} leads</p>
                </div>
              </button>
            )
          })}
        </Card>

        <Card title="Worth a look" sub="Spotted from your numbers" bodyClass="p-3 space-y-2">
          {!notes.length && <div className="flex items-center gap-2.5 px-2 py-6 text-xs text-slate-500 justify-center"><CheckCircle2 size={16} className="text-emerald-500" /> Nothing needs attention right now.</div>}
          {notes.map((n, i) => {
            const Icon = n.tone === 'blue' ? Sparkles : AlertTriangle
            return (
              <button key={i} onClick={() => (n.go ? onGoLeads() : onOpenAd(n.ad))} className={clsx('w-full text-left flex items-start gap-2.5 rounded-xl border px-3 py-2.5 text-[11.5px] leading-relaxed text-slate-600 hover:shadow-sm transition-all', n.tone === 'red' ? 'bg-red-50/60 border-red-100' : n.tone === 'blue' ? 'bg-blue-50/60 border-blue-100' : 'bg-amber-50/60 border-amber-100')}>
                <Icon size={14} className={clsx('mt-0.5 flex-shrink-0', n.tone === 'red' ? 'text-red-500' : n.tone === 'blue' ? 'text-blue-500' : 'text-amber-500')} /><span>{n.text}</span>
              </button>
            )
          })}
        </Card>
      </div>
    </div>
  )
}
