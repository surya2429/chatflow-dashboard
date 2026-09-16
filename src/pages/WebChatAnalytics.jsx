import { useState, useMemo } from 'react'
import clsx from 'clsx'
import { subDays, format } from 'date-fns'
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts'
import {
  MessageCircle, Users, Clock, CheckCircle2, ChevronRight, Palette, Download,
  ThumbsUp, Bot, PhoneForwarded, Sparkles, Heart, MessageSquare, XCircle, Activity,
  AlertCircle, GitBranch, TrendingDown, ShieldAlert, Timer, TrendingUp, Megaphone, Share2,
} from 'lucide-react'
import { BOT_ID } from '../constants/webchat'
import {
  ChartTip, MetricCard, ChartCard, RankedBarChart, FunnelChart,
  ResponseTimeChart, AnalyticsToolbar, scaleForRange, KPISection,
  RealtimeAgentSection, CsatTrendChart, DailyVolumeChart, TimingChart, SourceBreakdownChart,
} from '../components/analytics/shared'

const rand = (a, b) => Math.floor(a + Math.random() * (b - a))
const today = new Date()

function makeChatData(n) {
  return Array.from({ length: n }, (_, i) => {
    const d = subDays(today, n - 1 - i)
    const bot = rand(80, 150)
    const handoff = rand(20, 55)
    return {
      date: format(d, 'MMM d'),
      total: bot + handoff,
      bot, handoff,
      resolved: rand(18, 42),
      closed: rand(3, 14),
      active: rand(1, 8),
      flowCompleted: rand(35, 90),
      dropOff: rand(10, 30),
      fallback: rand(5, 22),
      uniqueUsers: rand(70, 140),
      slaBreached: rand(1, 8),
      messages: (bot + handoff) * rand(3, 6),
      paidChats: rand(15, 45),
      referralChats: rand(8, 30),
      attended: rand(20, 50),
      unattended: rand(2, 10),
      bounced: rand(10, 35),
      csat: +(3.8 + Math.random() * 1.2).toFixed(1),
    }
  })
}
const CHAT_30 = makeChatData(30)
const CHAT_7  = CHAT_30.slice(-7)
const CHAT_1  = CHAT_30.slice(-1)

const AI_TREND_30 = Array.from({ length: 30 }, (_, i) => {
  const d = subDays(today, 29 - i)
  return { date: format(d, 'MMM d'), 'AI resolved': rand(40, 130), 'Escalated to agent': rand(5, 30) }
})
const daysForRange = range => range === 'today' ? 1 : range === '7d' ? 7 : 30

const OPTION_BREAKDOWN = [
  { name: 'Pricing Info',    count: 980,  color: '#0066ff' },
  { name: 'Book a Demo',     count: 640,  color: '#10B981' },
  { name: 'Talk to Sales',   count: 520,  color: '#8B5CF6' },
  { name: 'Product Support', count: 470,  color: '#EC4899' },
  { name: 'Billing Help',    count: 310,  color: '#f59e0b' },
  { name: 'Something Else',  count: 180,  color: '#64748b' },
]

const TOP_PAGES = [
  { name: 'Pricing',       count: 412, color: '#0066ff' },
  { name: 'Home',          count: 296, color: '#10B981' },
  { name: 'Product Demo',  count: 210, color: '#8B5CF6' },
  { name: 'Contact Us',    count: 158, color: '#EC4899' },
  { name: 'Blog',          count: 88,  color: '#f59e0b' },
]

const FUNNEL_STEPS = [
  { label: 'Widget opened',      value: 3400, color: '#93c5fd' },
  { label: 'Conversation started', value: 1980, color: '#60a5fa' },
  { label: 'Question answered',  value: 1420, color: '#3b82f6' },
  { label: 'Lead captured',      value: 620,  color: '#1d4ed8' },
]

const RESPONSE_BUCKETS = [
  { label: '< 15s',   count: 62, color: '#22c55e' },
  { label: '15-60s',  count: 24, color: '#84cc16' },
  { label: '1-5 min', count: 10, color: '#f59e0b' },
  { label: '> 5 min', count: 4,  color: '#ef4444' },
]

const TIME_BLOCKS = {
  Day: [
    { label: '12-2am', value: 20 }, { label: '2-4am', value: 12 }, { label: '4-6am', value: 18 },
    { label: '6-8am', value: 44 },  { label: '8-10am', value: 96 }, { label: '10-12pm', value: 132 },
    { label: '12-2pm', value: 118 }, { label: '2-4pm', value: 104 }, { label: '4-6pm', value: 88 },
    { label: '6-8pm', value: 66 },  { label: '8-10pm', value: 40 }, { label: '10-12am', value: 24 },
  ],
  Week: [
    { label: 'Mon', value: 540 }, { label: 'Tue', value: 610 }, { label: 'Wed', value: 640 },
    { label: 'Thu', value: 600 }, { label: 'Fri', value: 690 }, { label: 'Sat', value: 380 }, { label: 'Sun', value: 300 },
  ],
  Month: [
    { label: 'Week 1', value: 2100 }, { label: 'Week 2', value: 2380 }, { label: 'Week 3', value: 2260 }, { label: 'Week 4', value: 2520 },
  ],
  Year: [
    { label: 'Jan', value: 7100 }, { label: 'Feb', value: 6800 }, { label: 'Mar', value: 7600 }, { label: 'Apr', value: 8200 },
    { label: 'May', value: 8600 }, { label: 'Jun', value: 9100 }, { label: 'Jul', value: 9600 }, { label: 'Aug', value: 5400 },
    { label: 'Sep', value: 0 }, { label: 'Oct', value: 0 }, { label: 'Nov', value: 0 }, { label: 'Dec', value: 0 },
  ],
}

const SOURCE_DAYS = Array.from({ length: 14 }, (_, i) => i + 1)
const SOURCE_BREAKDOWN = [
  { name: 'Organic Search', days: Array.from({ length: 14 }, () => rand(10, 55)) },
  { name: 'Paid Ads',       days: Array.from({ length: 14 }, () => rand(5, 40)) },
  { name: 'Direct',         days: Array.from({ length: 14 }, () => rand(8, 45)) },
  { name: 'Referral',       days: Array.from({ length: 14 }, () => rand(2, 25)) },
  { name: 'Social',         days: Array.from({ length: 14 }, () => rand(1, 20)) },
].map(s => ({ ...s, total: s.days.reduce((a, b) => a + b, 0) }))

const AGENTS = [
  { name: 'Priya Das',   avatar: 'PD', status: 'online',  active: 3, queue: 1, avgReply: '11s', avgHandle: '2m 40s', longest: '14m', resolved: 30, transferred: 2, csat: 4.5, sla: 0 },
  { name: 'Rahul Mehta', avatar: 'RM', status: 'online',  active: 5, queue: 2, avgReply: '16s', avgHandle: '3m 50s', longest: '26m', resolved: 27, transferred: 4, csat: 4.2, sla: 1 },
  { name: 'Sana Iyer',   avatar: 'SI', status: 'offline', active: 0, queue: 0, avgReply: '—',   avgHandle: '—',      longest: '—',   resolved: 15, transferred: 1, csat: 4.3, sla: 0 },
]

const AI_FEATURES = [
  { name: 'AI Chat Auto-reply', count: 1620, color: '#0066ff' },
  { name: 'Lead Qualification', count: 820,  color: '#10B981' },
  { name: 'Smart Suggestions',  count: 540,  color: '#8B5CF6' },
]

const RECENT = [
  { id: 1, name: 'Arjun Sharma',  page: 'Pricing',      msgs: 7,  status: 'resolved',  time: '2m ago',  lead: true  },
  { id: 2, name: 'Neha Patel',    page: 'Home',         msgs: 3,  status: 'active',    time: '5m ago',  lead: false },
  { id: 3, name: 'Rahul Singh',   page: 'Product Demo', msgs: 12, status: 'resolved',  time: '18m ago', lead: true  },
  { id: 4, name: 'Visitor #4821', page: 'Blog',         msgs: 2,  status: 'abandoned', time: '34m ago', lead: false },
  { id: 5, name: 'Priya Verma',   page: 'Contact Us',   msgs: 5,  status: 'resolved',  time: '1h ago',  lead: true  },
]
const SB = { active: 'bg-emerald-100 text-emerald-700', resolved: 'bg-blue-100 text-blue-700', abandoned: 'bg-slate-100 text-slate-500' }

const TABS = [
  { id: 'chat', label: 'Chatbot & Live Agents' },
  { id: 'ai',   label: 'AI Usage' },
]

export default function WebChatAnalytics() {
  const [tab, setTab] = useState('chat')
  const [range, setRange] = useState('30d')
  const [openSections, setOpenSections] = useState({ volume: true, agents: true, engagement: true })
  const toggle = key => setOpenSections(s => ({ ...s, [key]: !s[key] }))

  const data = range === 'today' ? CHAT_1 : range === '7d' ? CHAT_7 : CHAT_30
  const sum = k => data.reduce((a, d) => a + d[k], 0)

  const botHandled  = sum('bot')
  const handoff     = sum('handoff')
  const totalChats  = botHandled + handoff
  const resolved    = sum('resolved')
  const closed      = sum('closed')
  const activeNow   = data[data.length - 1]?.active ?? 0
  const flowDone    = sum('flowCompleted')
  const dropOff     = sum('dropOff')
  const fallback    = sum('fallback')
  const uniqueUsers = sum('uniqueUsers')
  const slaBreached = sum('slaBreached')
  const totalMsgs   = sum('messages')
  const paidChats   = sum('paidChats')
  const referral    = sum('referralChats')
  const attended    = sum('attended')
  const unattended  = sum('unattended')
  const bounced     = sum('bounced')
  const avgCsat     = (data.reduce((a, d) => a + d.csat, 0) / data.length).toFixed(1)
  const resolutionRate = Math.round((resolved / Math.max(handoff, 1)) * 100)

  const aiTrend = useMemo(() => AI_TREND_30.slice(-daysForRange(range)), [range])
  const csatData = useMemo(() => data.map(d => ({ date: d.date, csat: d.csat })), [data])

  const leadsCaptured = scaleForRange(342, range)

  return (
    <div className="space-y-4 animate-fade-in">
      <div>
        <h1 className="text-[15px] font-bold text-slate-900 mb-0.5">Website Chat Analytics</h1>
        <p className="text-[11px] text-slate-400">How your live chat widget is performing</p>
      </div>

      {/* Active widget + quick actions */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 bg-white border border-surface-border rounded-xl p-4">
          <div className="flex items-center justify-between mb-3">
            <p className="text-[13px] font-semibold text-slate-900">Active Widget</p>
            <span className="flex items-center gap-1.5 text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"/>Live
            </span>
          </div>
          <div className="space-y-2.5">
            {[
              { label: 'Bot ID',       value: BOT_ID },
              { label: 'Domain',       value: 'yourwebsite.com' },
              { label: 'Installed on', value: '3 pages' },
              { label: 'Last active',  value: '2 min ago' },
            ].map(r => (
              <div key={r.label} className="flex items-center justify-between py-1.5 border-b border-surface-border last:border-0">
                <span className="text-[11px] text-slate-500">{r.label}</span>
                <span className="text-[11px] font-medium text-slate-800">{r.value}</span>
              </div>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-2 mt-3 pt-3 border-t border-surface-border">
            {[{l:'Leads Captured',v:leadsCaptured.toLocaleString()},{l:'Resolution Rate',v:`${resolutionRate}%`}].map(s => (
              <div key={s.l} className="text-center">
                <p className="text-sm font-bold text-slate-900">{s.v}</p>
                <p className="text-[10px] text-slate-400">{s.l}</p>
              </div>
            ))}
          </div>
        </div>
        <div className="space-y-3">
          {[
            { icon: Palette,       label: 'Customize Widget', sub: 'Colors, fonts, position',    color: 'bg-blue-50 text-blue-600'    },
            { icon: MessageCircle, label: 'Manage Questions', sub: 'Edit flow & question types', color: 'bg-purple-50 text-purple-600' },
            { icon: Download,      label: 'Install on App',   sub: 'iOS, Android, React Native', color: 'bg-emerald-50 text-emerald-600' },
          ].map(a => (
            <div key={a.label} className="bg-white border border-surface-border rounded-xl p-3.5 flex items-center gap-3 hover:border-primary/30 cursor-pointer transition-colors group">
              <div className={clsx('w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0', a.color.split(' ')[0])}>
                <a.icon size={15} className={a.color.split(' ')[1]}/>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-slate-800">{a.label}</p>
                <p className="text-[10px] text-slate-400">{a.sub}</p>
              </div>
              <ChevronRight size={13} className="text-slate-300 group-hover:text-primary transition-colors"/>
            </div>
          ))}
        </div>
      </div>

      <AnalyticsToolbar tabs={TABS} tab={tab} setTab={setTab} range={range} setRange={setRange}/>

      {tab === 'chat' && (
        <div className="space-y-5">

          <KPISection title="Chat Volume" open={openSections.volume} onToggle={() => toggle('volume')}>
            <MetricCard icon={MessageSquare} label="Total Conversations" value={totalChats.toLocaleString()} sub="Bot + Handoff" trend={12}/>
            <MetricCard icon={MessageSquare} label="Total Messages"      value={totalMsgs.toLocaleString()}  trend={9}/>
            <MetricCard icon={Users}         label="Unique Visitors"     value={uniqueUsers.toLocaleString()} trend={6}/>
            <MetricCard icon={Bot}           label="Bot Handled"         value={botHandled.toLocaleString()} sub="Auto-resolved" trend={3}/>
            <MetricCard icon={Users}         label="Leads Captured"      value={leadsCaptured.toLocaleString()} trend={8}/>
            <MetricCard icon={Megaphone}     label="Paid Traffic Chats"  value={paidChats.toLocaleString()}  sub="From ad campaigns" trend={14}/>
            <MetricCard icon={Share2}        label="Referral Chats"      value={referral.toLocaleString()}   sub="From external links" trend={7}/>
          </KPISection>

          <KPISection title="Live Agents" open={openSections.agents} onToggle={() => toggle('agents')}>
            <MetricCard icon={PhoneForwarded} label="Handoff to Agents" value={handoff.toLocaleString()}   sub="Resolved + Closed + Active" trend={-2}/>
            <MetricCard icon={CheckCircle2}   label="Resolved by Agents" value={resolved.toLocaleString()} trend={5}/>
            <MetricCard icon={XCircle}        label="Closed by Agents"   value={closed.toLocaleString()}   trend={1}/>
            <MetricCard icon={Activity}       label="Active Chats Right Now" value={String(activeNow)}/>
            <MetricCard icon={CheckCircle2}   label="Attended Chats"    value={attended.toLocaleString()}   sub="Handoff to Agent" trend={7}/>
            <MetricCard icon={AlertCircle}    label="Unattended Chats"  value={unattended.toLocaleString()} sub="Handoff to Agent" trend={-3}/>
          </KPISection>

          <KPISection title="Engagement & Quality" open={openSections.engagement} onToggle={() => toggle('engagement')}>
            <MetricCard icon={GitBranch}    label="Flow Completion"     value={flowDone.toLocaleString()}   trend={9}/>
            <MetricCard icon={TrendingDown} label="Drop-Off Users"      value={dropOff.toLocaleString()}    trend={-4}/>
            <MetricCard icon={AlertCircle}  label="Fallback Triggers"   value={fallback.toLocaleString()}   trend={-7}/>
            <MetricCard icon={ShieldAlert}  label="SLA Breached"        value={slaBreached.toLocaleString()} trend={2} warn/>
            <MetricCard icon={Timer}        label="Avg Resolution Time" value="7m 52s"                      trend={-5}/>
            <MetricCard icon={Clock}        label="Avg First Response"  value="18s"                         trend={-8}/>
            <MetricCard icon={TrendingDown} label="Widget Bounce Rate"  value={`${Math.round((bounced / Math.max(bounced + totalChats, 1)) * 100)}%`} sub="opened, no message sent" trend={-3}/>
            <MetricCard icon={ThumbsUp}     label="CSAT Score"          value={`${avgCsat} / 5`} sub="avg"/>
            <MetricCard icon={TrendingUp}   label="Escalation Rate"     value="4.8%" trend={-1}/>
          </KPISection>

          <DailyVolumeChart title="Daily Conversations" sub="Volume breakdown over time" data={data} range={range}/>

          <RankedBarChart title="Option Wise Breakdown" sub={`${OPTION_BREAKDOWN.reduce((s,r)=>s+r.count,0).toLocaleString()} total selections · widget menu interactions`} data={OPTION_BREAKDOWN}/>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <RankedBarChart title="Top Pages" sub="Where on your site conversations start" data={TOP_PAGES}/>
            <FunnelChart title="Visitor Funnel" sub="From widget open to captured lead" steps={FUNNEL_STEPS}/>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <CsatTrendChart data={csatData}/>
            <ResponseTimeChart sub="Share of replies by first-response time" buckets={RESPONSE_BUCKETS}/>
          </div>

          <TimingChart title="When visitors chat" sub="Conversations started by time of day" blocksByRange={TIME_BLOCKS} unitLabel="conversations"/>

          <SourceBreakdownChart title="Traffic Source Breakdown" sub="Where widget conversations originate · last 14 days" sources={SOURCE_BREAKDOWN} days={SOURCE_DAYS}/>

          <RealtimeAgentSection title="Realtime Agent Analytics (Web Chat)" agents={AGENTS}/>
        </div>
      )}

      {tab === 'ai' && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <MetricCard icon={Bot} label="AI-resolved conversations" value={scaleForRange(1020, range).toLocaleString()} trend={9}/>
            <MetricCard icon={PhoneForwarded} label="Escalated to agent" value={scaleForRange(164, range).toLocaleString()} trend={-4}/>
            <MetricCard icon={Sparkles} label="AI resolution rate" value="81%" trend={2}/>
            <MetricCard icon={Heart} label="AI reply satisfaction" value="4.3/5" trend={1}/>
          </div>
          <ChartCard title="AI Resolution Trend" sub="AI-resolved vs escalated" noPad>
            <div className="h-56 px-2 pt-3">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={aiTrend} margin={{ top: 4, right: 12, left: -18, bottom: 0 }}>
                  <defs>
                    <linearGradient id="wcAiOk" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#8B5CF6" stopOpacity={0.3}/><stop offset="95%" stopColor="#8B5CF6" stopOpacity={0}/></linearGradient>
                    <linearGradient id="wcAiEsc" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#f59e0b" stopOpacity={0.3}/><stop offset="95%" stopColor="#f59e0b" stopOpacity={0}/></linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9"/>
                  <XAxis dataKey="date" tick={{ fontSize: 9, fill: '#94a3b8' }} axisLine={false} tickLine={false}/>
                  <YAxis tick={{ fontSize: 9, fill: '#94a3b8' }} axisLine={false} tickLine={false}/>
                  <Tooltip content={<ChartTip/>}/>
                  <Area type="monotone" dataKey="AI resolved" stroke="#8B5CF6" fill="url(#wcAiOk)" strokeWidth={2}/>
                  <Area type="monotone" dataKey="Escalated to agent" stroke="#f59e0b" fill="url(#wcAiEsc)" strokeWidth={2}/>
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </ChartCard>
          <RankedBarChart title="AI Feature Usage" sub="Which AI-powered features are used most" data={AI_FEATURES}/>
        </div>
      )}

      {/* Recent conversations */}
      <div className="bg-white border border-surface-border rounded-xl overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-surface-border">
          <p className="text-[13px] font-semibold text-slate-900">Recent Conversations</p>
          <button className="text-[11px] text-primary font-semibold hover:text-primary-hover">View all</button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr>
                {['Visitor', 'Page', 'Messages', 'Status', 'Lead', 'Time'].map(h => (
                  <th key={h} className="table-header whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {RECENT.map(r => (
                <tr key={r.id} className="table-row">
                  <td className="table-cell font-medium text-slate-800">{r.name}</td>
                  <td className="table-cell text-slate-500">{r.page}</td>
                  <td className="table-cell">{r.msgs}</td>
                  <td className="table-cell">
                    <span className={clsx('text-[10px] font-semibold px-2 py-0.5 rounded-full capitalize', SB[r.status])}>{r.status}</span>
                  </td>
                  <td className="table-cell">
                    {r.lead && <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full">Lead</span>}
                  </td>
                  <td className="table-cell text-slate-400">{r.time}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
