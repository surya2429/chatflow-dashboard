import { useState } from 'react'
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { IndianRupee, MessageCircle, Target, MousePointerClick, Eye, Users } from 'lucide-react'
import clsx from 'clsx'
import { money, num, pct } from '../../lib/ctwaApi'
import { Card, Stat } from './ui'

const SERIES = [
  ['conversations', 'Conversations', '#25D366'],
  ['spend', 'Spend', '#5B5BF0'],
  ['clicks', 'Clicks', '#0ea5e9'],
  ['impressions', 'Impressions', '#a855f7'],
]

export default function Overview({ data }) {
  const [series, setSeries] = useState('conversations')
  const { totals: t, daily, ads, currency } = data
  const [, label, color] = SERIES.find(([k]) => k === series)
  const fmt = (v) => (series === 'spend' ? money(v, currency, 0) : num(v))
  const top = [...ads].sort((a, b) => b.metrics.conversations - a.metrics.conversations).filter((a) => a.metrics.conversations > 0).slice(0, 5)
  const maxConv = Math.max(1, ...top.map((a) => a.metrics.conversations))
  const funnel = [['Impressions', t.impressions], ['Clicks', t.clicks], ['Conversations started', t.conversations]]

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">
        <Stat label="Amount spent" value={money(t.spend, currency)} icon={IndianRupee} tone="text-indigo-600 bg-indigo-50" />
        <Stat label="Conversations started" value={num(t.conversations)} icon={MessageCircle} tone="text-emerald-600 bg-emerald-50" />
        <Stat label="Cost per conversation" value={money(t.costPerConversation, currency, 2)} icon={Target} tone="text-amber-600 bg-amber-50" />
        <Stat label="Link clicks" value={num(t.clicks)} sub={`CTR ${pct(t.ctr)}`} icon={MousePointerClick} tone="text-sky-600 bg-sky-50" />
        <Stat label="Impressions" value={num(t.impressions)} icon={Eye} tone="text-purple-600 bg-purple-50" />
        <Stat label="Reach" value={num(t.reach)} sub="Adds up each ad's reach" icon={Users} tone="text-pink-600 bg-pink-50" />
      </div>

      <Card title="Performance over time" sub={`${label} per day`}
        right={
          <div className="inline-flex bg-slate-100 rounded-lg p-0.5" role="tablist">
            {SERIES.map(([k, l]) => (
              <button key={k} role="tab" aria-selected={series === k} onClick={() => setSeries(k)}
                className={clsx('px-2.5 py-1 rounded-md text-[11px] font-semibold transition-colors', series === k ? 'bg-white shadow-sm text-slate-800' : 'text-slate-500 hover:text-slate-700')}>{l}</button>
            ))}
          </div>
        } bodyClass="px-2 pt-4 pb-2">
        <div className="h-[260px]">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={daily} margin={{ top: 4, right: 16, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="ctwaFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={color} stopOpacity={0.28} /><stop offset="100%" stopColor={color} stopOpacity={0} /></linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#eef0f4" vertical={false} />
              <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#94a3b8' }} tickLine={false} axisLine={false} tickFormatter={(d) => d.slice(5)} minTickGap={24} />
              <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} tickLine={false} axisLine={false} width={48} tickFormatter={(v) => (v >= 1000 ? `${Math.round(v / 100) / 10}k` : v)} />
              <Tooltip formatter={(v) => [fmt(v), label]} labelFormatter={(d) => d} contentStyle={{ fontSize: 11, borderRadius: 8, border: '1px solid #e5e7eb' }} />
              <Area type="monotone" dataKey={series} stroke={color} strokeWidth={2} fill="url(#ctwaFill)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <Card title="From impression to conversation" sub="How many people moved to the next step" bodyClass="p-4 space-y-3">
          {funnel.map(([l, v], i) => (
            <div key={l}>
              <div className="flex items-baseline justify-between text-xs mb-1">
                <span className="font-semibold text-slate-700">{l}</span>
                <span className="tabular-nums text-slate-800 font-bold">{num(v)}{i > 0 && funnel[i - 1][1] > 0 && <span className="ml-2 text-[10.5px] font-normal text-slate-400">{((v / funnel[i - 1][1]) * 100).toFixed(1)}% of previous</span>}</span>
              </div>
              <div className="h-2.5 rounded-full bg-slate-100 overflow-hidden"><div className="h-full rounded-full" style={{ width: `${funnel[0][1] ? Math.max(2, (v / funnel[0][1]) * 100) : 0}%`, background: ['#a855f7', '#0ea5e9', '#25D366'][i] }} /></div>
            </div>
          ))}
        </Card>

        <Card title="Top ads by conversations" sub="Which ads send you the most chats" bodyClass="p-4 space-y-3">
          {!top.length && <p className="text-xs text-slate-400 py-6 text-center">No conversations in this period yet.</p>}
          {top.map((a) => (
            <div key={a.id}>
              <div className="flex items-baseline justify-between gap-3 text-xs mb-1">
                <span className="font-semibold text-slate-700 truncate">{a.name}</span>
                <span className="tabular-nums font-bold text-slate-800 flex-shrink-0">{num(a.metrics.conversations)} <span className="font-normal text-[10.5px] text-slate-400">· {money(a.metrics.costPerConversation, currency, 2)} each</span></span>
              </div>
              <div className="h-2 rounded-full bg-slate-100 overflow-hidden"><div className="h-full rounded-full bg-emerald-500" style={{ width: `${(a.metrics.conversations / maxConv) * 100}%` }} /></div>
            </div>
          ))}
        </Card>
      </div>
    </div>
  )
}
