import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { subDays, format } from 'date-fns'
import clsx from 'clsx'
import {
  Instagram as InstagramIcon, Send, MessageCircle, Camera,
  RefreshCw, Sparkles, CheckCircle2, ChevronRight, Clock, ThumbsUp,
  Bot, PhoneForwarded, Heart, MessageSquare, Users, XCircle, Activity,
  AlertCircle, GitBranch, TrendingDown, ShieldAlert, Timer, TrendingUp, Megaphone,
  Zap, Radio, Award,
} from 'lucide-react'
import { INITIAL_FLOWS } from './InstagramFlowBuilder'
import { INITIAL_QUICK_RULES, SOURCE_META } from './InstagramAutomations'
import { buildAutomationPerf, buildPostPerf, AutomationPerfCard, PostPerfTable } from '../components/instagram/shared'
import {
  ChartTip, MetricCard, ChartCard, RankedBarChart, FunnelChart,
  ResponseTimeChart, AnalyticsToolbar, scaleForRange, KPISection,
  RealtimeAgentSection, CsatTrendChart, DailyVolumeChart, TimingChart, SourceBreakdownChart,
} from '../components/analytics/shared'
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts'

const rand = (a, b) => Math.floor(a + Math.random() * (b - a))
const today = new Date()

/* ── 30 days of daily mock data — same shape/approach as WhatsApp's makeChat() ── */
function makeChatData(n) {
  return Array.from({ length: n }, (_, i) => {
    const d = subDays(today, n - 1 - i)
    const bot = rand(150, 260)
    const handoff = rand(40, 90)
    return {
      date: format(d, 'MMM d'),
      total: bot + handoff,
      bot, handoff,
      resolved: rand(30, 70),
      closed: rand(5, 20),
      active: rand(2, 10),
      flowCompleted: rand(60, 140),
      dropOff: rand(15, 45),
      fallback: rand(10, 35),
      uniqueUsers: rand(120, 220),
      slaBreached: rand(2, 12),
      messages: (bot + handoff) * rand(3, 6),
      adDms: rand(20, 70),
      storyReplyDms: rand(10, 40),
      attended: rand(35, 80),
      unattended: rand(3, 15),
      csat: +(3.9 + Math.random() * 1.1).toFixed(1),
    }
  })
}
const CHAT_30 = makeChatData(30)
const CHAT_7  = CHAT_30.slice(-7)
const CHAT_1  = CHAT_30.slice(-1)

const AI_TREND_30 = Array.from({ length: 30 }, (_, i) => {
  const d = subDays(today, 29 - i)
  return { date: format(d, 'MMM d'), 'AI resolved': rand(80, 220), 'Escalated to agent': rand(10, 45) }
})
const daysForRange = range => range === 'today' ? 1 : range === '7d' ? 7 : 30

const RULE_BREAKDOWN = [
  { name: 'Price Inquiry',   count: 1420, color: '#0066ff' },
  { name: 'Size Chart',      count: 980,  color: '#10B981' },
  { name: 'Order Status',    count: 740,  color: '#8B5CF6' },
  { name: 'Catalog Link',    count: 610,  color: '#EC4899' },
  { name: 'Discount Code',   count: 480,  color: '#f59e0b' },
  { name: 'Human Agent',     count: 260,  color: '#64748b' },
]

const FUNNEL_STEPS = [
  { label: 'Conversation started',    value: 5200, color: '#93c5fd' },
  { label: 'Flow / rule triggered',   value: 4180, color: '#60a5fa' },
  { label: 'Info collected',          value: 2960, color: '#3b82f6' },
  { label: 'Handed off / resolved',   value: 2410, color: '#1d4ed8' },
]

const RESPONSE_BUCKETS = [
  { label: '< 15s',   count: 58, color: '#22c55e' },
  { label: '15-60s',  count: 27, color: '#84cc16' },
  { label: '1-5 min', count: 11, color: '#f59e0b' },
  { label: '> 5 min', count: 4,  color: '#ef4444' },
]

const TIME_BLOCKS = {
  Day: [
    { label: '12-2am', value: 18 }, { label: '2-4am', value: 10 }, { label: '4-6am', value: 14 },
    { label: '6-8am', value: 38 },  { label: '8-10am', value: 92 }, { label: '10-12pm', value: 126 },
    { label: '12-2pm', value: 140 }, { label: '2-4pm', value: 118 }, { label: '4-6pm', value: 96 },
    { label: '6-8pm', value: 84 },  { label: '8-10pm', value: 58 }, { label: '10-12am', value: 30 },
  ],
  Week: [
    { label: 'Mon', value: 620 }, { label: 'Tue', value: 680 }, { label: 'Wed', value: 710 },
    { label: 'Thu', value: 690 }, { label: 'Fri', value: 780 }, { label: 'Sat', value: 540 }, { label: 'Sun', value: 410 },
  ],
  Month: [
    { label: 'Week 1', value: 2400 }, { label: 'Week 2', value: 2820 }, { label: 'Week 3', value: 2610 }, { label: 'Week 4', value: 2980 },
  ],
  Year: [
    { label: 'Jan', value: 8200 }, { label: 'Feb', value: 7600 }, { label: 'Mar', value: 8900 }, { label: 'Apr', value: 9100 },
    { label: 'May', value: 9600 }, { label: 'Jun', value: 10200 }, { label: 'Jul', value: 10800 }, { label: 'Aug', value: 6200 },
    { label: 'Sep', value: 0 }, { label: 'Oct', value: 0 }, { label: 'Nov', value: 0 }, { label: 'Dec', value: 0 },
  ],
}

const SOURCE_DAYS = Array.from({ length: 14 }, (_, i) => i + 1)
const SOURCE_BREAKDOWN = [
  { name: 'Profile Bio',    days: Array.from({ length: 14 }, () => rand(10, 60)) },
  { name: 'Story Reply',    days: Array.from({ length: 14 }, () => rand(5, 40)) },
  { name: 'Post Comment',   days: Array.from({ length: 14 }, () => rand(8, 50)) },
  { name: 'Instagram Ads',  days: Array.from({ length: 14 }, () => rand(2, 30)) },
  { name: 'Direct Search',  days: Array.from({ length: 14 }, () => rand(1, 20)) },
].map(s => ({ ...s, total: s.days.reduce((a, b) => a + b, 0) }))

const AGENTS = [
  { name: 'Priya Das',   avatar: 'PD', status: 'online',  active: 4, queue: 1, avgReply: '9s',  avgHandle: '3m 20s', longest: '18m', resolved: 42, transferred: 3, csat: 4.7, sla: 0 },
  { name: 'Rahul Mehta', avatar: 'RM', status: 'online',  active: 6, queue: 3, avgReply: '14s', avgHandle: '4m 05s', longest: '31m', resolved: 38, transferred: 5, csat: 4.4, sla: 2 },
  { name: 'Sana Iyer',   avatar: 'SI', status: 'break',   active: 0, queue: 0, avgReply: '—',   avgHandle: '—',      longest: '—',   resolved: 21, transferred: 1, csat: 4.6, sla: 0 },
]

const AI_FEATURES = [
  { name: 'AI DM Auto-reply',      count: 2140, color: '#0066ff' },
  { name: 'AI Comment Reply',      count: 980,  color: '#10B981' },
  { name: 'AI Story Reply',        count: 410,  color: '#EC4899' },
  { name: 'Smart Reply Suggestions', count: 640, color: '#8B5CF6' },
]

const RECENT_ACTIVITY = [
  { id: 1, type: 'dm',      text: 'Replied to @meera.k — "What sizes do you have?"', at: '2 min ago', aiHandled: true },
  { id: 2, type: 'comment', text: 'Auto-replied on Summer Collection Reel', at: '8 min ago', aiHandled: true },
  { id: 3, type: 'story',   text: 'Auto-replied to story reply from @arjun.dev', at: '19 min ago', aiHandled: true },
  { id: 4, type: 'dm',      text: 'Sent welcome quick-replies to @newuser22', at: '31 min ago', aiHandled: false },
  { id: 5, type: 'comment', text: 'Sent catalog DM after "LINK" comment', at: '44 min ago', aiHandled: false },
  { id: 6, type: 'story',   text: 'Thanked @priya.styles for story mention', at: '1 hr ago', aiHandled: true },
]
const ACTIVITY_ICON = { dm: Send, comment: MessageCircle, story: Camera }

const CHECKLIST = [
  { done: true,  label: 'Connect Instagram Business account', path: '/installation' },
  { done: true,  label: 'Create your first quick automation', path: '/instagram/automations' },
  { done: true,  label: 'Set up comment automation',          path: '/instagram/automations' },
  { done: false, label: 'Enable AI story reply handling',     path: '/instagram/automations?tab=rules' },
  { done: false, label: 'Build a multi-step flow',            path: '/instagram/automations?tab=flows' },
  { done: true,  label: 'Configure AI response settings',     path: '/integrations' },
]

const TABS = [
  { id: 'chat',        label: 'Chatbot & Live Agents' },
  { id: 'ai',          label: 'AI Usage' },
  { id: 'automations', label: 'Automations & Posts' },
]

const AUTOMATION_PERF = buildAutomationPerf(INITIAL_QUICK_RULES)
const POST_PERF = buildPostPerf(INITIAL_QUICK_RULES)

export default function InstagramAnalytics() {
  const navigate = useNavigate()
  const [tab, setTab] = useState('chat')
  const [range, setRange] = useState('30d')
  const [openSections, setOpenSections] = useState({ volume: true, agents: true, engagement: true })
  const toggle = key => setOpenSections(s => ({ ...s, [key]: !s[key] }))

  const activeCount = a => a.filter(x => x.active).length

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
  const adDms       = sum('adDms')
  const storyDms    = sum('storyReplyDms')
  const attended    = sum('attended')
  const unattended  = sum('unattended')
  const avgCsat     = (data.reduce((a, d) => a + d.csat, 0) / data.length).toFixed(1)

  const aiTrend = useMemo(() => AI_TREND_30.slice(-daysForRange(range)), [range])
  const csatData = useMemo(() => data.map(d => ({ date: d.date, csat: d.csat })), [data])

  const activeFlows = activeCount(INITIAL_FLOWS)

  const topAutomation = useMemo(() => AUTOMATION_PERF.slice().sort((a, b) => b.stats.triggered - a.stats.triggered)[0], [])
  const topAutomationLabel = topAutomation ? (topAutomation.name.length > 20 ? `${topAutomation.name.slice(0, 18)}…` : topAutomation.name) : '—'

  return (
    <div className="space-y-4 animate-fade-in">
      <div>
        <h1 className="text-[15px] font-bold text-slate-900 mb-0.5">Instagram Analytics</h1>
        <p className="text-[11px] text-slate-400">How your Instagram automation is performing</p>
      </div>

      <div className="bg-white border border-surface-border rounded-xl overflow-hidden">
        <div className="flex items-center gap-3 px-4 py-3 border-b border-surface-border">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: 'linear-gradient(135deg,#f9ce34,#ee2a7b,#6228d7)' }}>
            <InstagramIcon size={16} className="text-white"/>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[13px] font-semibold text-slate-800">@acmecorp.official</p>
            <p className="text-[11px] text-slate-400">Business account · Connected via Meta</p>
          </div>
          <span className="text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded-full flex items-center gap-1 flex-shrink-0">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block animate-pulse"/>Connected
          </span>
        </div>
        <div className="grid grid-cols-4 divide-x divide-surface-border">
          {[{l:'Followers',v:'48.2K'},{l:'Active Flows',v:activeFlows},{l:'AI resolution rate',v:'87%'},{l:'Avg. reply time',v:'12s'}].map(s => (
            <div key={s.l} className="p-3 text-center">
              <p className="text-sm font-bold text-slate-900">{s.v}</p>
              <p className="text-[10px] text-slate-400">{s.l}</p>
            </div>
          ))}
        </div>
      </div>

      <AnalyticsToolbar tabs={TABS} tab={tab} setTab={setTab} range={range} setRange={setRange}/>

      {tab === 'chat' && (
        <div className="space-y-5">

          <KPISection title="Chat Volume" open={openSections.volume} onToggle={() => toggle('volume')}>
            <MetricCard icon={MessageSquare} label="Total Conversations" value={totalChats.toLocaleString()} sub="Bot + Handoff" trend={8}/>
            <MetricCard icon={MessageSquare} label="Total Messages"      value={totalMsgs.toLocaleString()}  trend={11}/>
            <MetricCard icon={Users}         label="Unique Users"        value={uniqueUsers.toLocaleString()} trend={6}/>
            <MetricCard icon={Bot}           label="Bot Handled"         value={botHandled.toLocaleString()} sub="Auto-resolved" trend={3}/>
            <MetricCard icon={Megaphone}     label="Ad-initiated DMs"    value={adDms.toLocaleString()}      sub="Instagram Ads" trend={14}/>
            <MetricCard icon={Camera}        label="Story Reply DMs"     value={storyDms.toLocaleString()}   sub="From story mentions" trend={9}/>
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
            <MetricCard icon={GitBranch}    label="Flow Completion"          value={flowDone.toLocaleString()}   trend={9}/>
            <MetricCard icon={TrendingDown} label="Drop-Off Users"           value={dropOff.toLocaleString()}    trend={-4}/>
            <MetricCard icon={AlertCircle}  label="Fallback Triggers"        value={fallback.toLocaleString()}   trend={-7}/>
            <MetricCard icon={ShieldAlert}  label="SLA Breached"             value={slaBreached.toLocaleString()} trend={2} warn/>
            <MetricCard icon={Timer}        label="Avg Resolution Time"      value="9m 14s"                      trend={-5}/>
            <MetricCard icon={Clock}        label="Avg First Response"       value="48s"                         trend={-8}/>
            <MetricCard icon={MessageCircle} label="Comment → DM Conversions" value={scaleForRange(1840, range).toLocaleString()} sub="from comment rules" trend={12}/>
            <MetricCard icon={ThumbsUp}     label="CSAT Score"               value={`${avgCsat} / 5`} sub="avg"/>
            <MetricCard icon={TrendingUp}   label="Escalation Rate"          value="5.4%" trend={-1}/>
          </KPISection>

          <DailyVolumeChart title="Daily Conversations" sub="Volume breakdown over time" data={data} range={range}/>

          <RankedBarChart title="Rule & Keyword Breakdown" sub={`${RULE_BREAKDOWN.reduce((s,r)=>s+r.count,0).toLocaleString()} total triggers · DM + comment automation`} data={RULE_BREAKDOWN}/>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <FunnelChart title="Automation Funnel" sub="From first message to resolution" steps={FUNNEL_STEPS}/>
            <div className="space-y-4">
              <CsatTrendChart data={csatData}/>
              <ResponseTimeChart sub="Share of replies by first-response time" buckets={RESPONSE_BUCKETS}/>
            </div>
          </div>

          <TimingChart title="When engagement happens" sub="DMs, comments & story replies by time of day" blocksByRange={TIME_BLOCKS} unitLabel="interactions"/>

          <SourceBreakdownChart title="DM Source Breakdown" sub="Where conversations start on Instagram · last 14 days" sources={SOURCE_BREAKDOWN} days={SOURCE_DAYS}/>

          <RealtimeAgentSection title="Realtime Agent Analytics (Instagram Inbox)" agents={AGENTS}/>
        </div>
      )}

      {tab === 'ai' && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <MetricCard icon={Bot} label="AI-resolved conversations" value={scaleForRange(4170, range).toLocaleString()} trend={11}/>
            <MetricCard icon={PhoneForwarded} label="Escalated to agent" value={scaleForRange(286, range).toLocaleString()} trend={-6}/>
            <MetricCard icon={Sparkles} label="AI resolution rate" value="87%" trend={3}/>
            <MetricCard icon={Heart} label="AI reply satisfaction" value="4.5/5" trend={1}/>
          </div>
          <ChartCard title="AI Resolution Trend" sub="AI-resolved vs escalated" noPad>
            <div className="h-56 px-2 pt-3">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={aiTrend} margin={{ top: 4, right: 12, left: -18, bottom: 0 }}>
                  <defs>
                    <linearGradient id="igAiOk" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#8B5CF6" stopOpacity={0.3}/><stop offset="95%" stopColor="#8B5CF6" stopOpacity={0}/></linearGradient>
                    <linearGradient id="igAiEsc" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#f59e0b" stopOpacity={0.3}/><stop offset="95%" stopColor="#f59e0b" stopOpacity={0}/></linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9"/>
                  <XAxis dataKey="date" tick={{ fontSize: 9, fill: '#94a3b8' }} axisLine={false} tickLine={false}/>
                  <YAxis tick={{ fontSize: 9, fill: '#94a3b8' }} axisLine={false} tickLine={false}/>
                  <Tooltip content={<ChartTip/>}/>
                  <Area type="monotone" dataKey="AI resolved" stroke="#8B5CF6" fill="url(#igAiOk)" strokeWidth={2}/>
                  <Area type="monotone" dataKey="Escalated to agent" stroke="#f59e0b" fill="url(#igAiEsc)" strokeWidth={2}/>
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </ChartCard>
          <RankedBarChart title="AI Feature Usage" sub="Which AI-powered features are used most" data={AI_FEATURES}/>
        </div>
      )}

      {tab === 'automations' && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <MetricCard icon={Zap} label="Active Automations" value={INITIAL_QUICK_RULES.filter(r => r.active).length} sub={`${INITIAL_QUICK_RULES.length} total`}/>
            <MetricCard icon={Radio} label="Total Triggers (30d)" value={INITIAL_QUICK_RULES.reduce((s, r) => s + r.stats.triggered, 0).toLocaleString()} trend={9}/>
            <MetricCard icon={TrendingUp} label="Avg Completion Rate" value={`${Math.round(AUTOMATION_PERF.reduce((s, r) => s + r.completionRate, 0) / AUTOMATION_PERF.length)}%`}/>
            <MetricCard icon={Award} label="Top Performer" value={topAutomationLabel}/>
          </div>

          <div>
            <p className="text-xs font-semibold text-slate-800 mb-0.5">Automation Performance</p>
            <p className="text-[10px] text-slate-400 mb-3">Triggers, trend & conversion funnel — per automation, last 30 days</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {AUTOMATION_PERF.map(r => <AutomationPerfCard key={r.id} r={r} sourceMeta={SOURCE_META}/>)}
            </div>
          </div>

          <PostPerfTable postPerf={POST_PERF}/>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white border border-surface-border rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-surface-border flex items-center justify-between">
            <p className="text-xs font-semibold text-slate-800">Recent Activity</p>
            <RefreshCw size={12} className="text-slate-400"/>
          </div>
          <div className="divide-y divide-surface-border max-h-72 overflow-y-auto">
            {RECENT_ACTIVITY.map(a => {
              const Icon = ACTIVITY_ICON[a.type]
              return (
                <div key={a.id} className="flex items-start gap-2.5 px-4 py-2.5">
                  <Icon size={13} className="text-slate-400 flex-shrink-0 mt-0.5"/>
                  <div className="min-w-0 flex-1">
                    <p className="text-[11px] text-slate-700 leading-relaxed">{a.text}</p>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <span className="text-[10px] text-slate-400">{a.at}</span>
                      {a.aiHandled && <span className="text-[9px] font-bold text-purple-600 flex items-center gap-0.5"><Sparkles size={8}/> AI</span>}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        <div className="bg-white border border-surface-border rounded-xl p-4">
          <p className="text-xs font-semibold text-slate-800 mb-3">Quick Setup Checklist</p>
          <div className="space-y-2">
            {CHECKLIST.map(item => (
              <button key={item.label} onClick={() => navigate(item.path)}
                className="w-full flex items-center gap-2.5 text-left px-2 py-1.5 rounded-lg hover:bg-surface-hover transition-colors">
                <CheckCircle2 size={15} className={item.done ? 'text-emerald-500' : 'text-slate-300'}/>
                <span className={clsx('text-[12px] flex-1', item.done ? 'text-slate-500 line-through' : 'text-slate-700 font-medium')}>{item.label}</span>
                <ChevronRight size={12} className="text-slate-300"/>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
