import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts'
import { ArrowLeft, MessageSquare, CheckCircle2, Clock, Users, TrendingUp, TrendingDown } from 'lucide-react'
import { useApp } from '../context/AppContext'
import { MESSAGE_VOLUME, RECENT_ACTIVITY } from '../constants/mockData'

// ─── Tooltip ──────────────────────────────────────────────────────────────────
function ChartTip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  return (
    <div style={{ background:'#fff', border:'1px solid #e2e8f0', borderRadius:8, padding:'10px 14px',
      fontSize:12, boxShadow:'0 4px 12px rgba(0,0,0,0.08)' }}>
      <p style={{ color:'#64748b', margin:'0 0 6px', fontWeight:500 }}>{label}</p>
      {payload.map(p => (
        <div key={p.name} style={{ display:'flex', alignItems:'center', gap:8, marginTop:3 }}>
          <span style={{ width:8, height:8, borderRadius:'50%', background:p.color, display:'inline-block' }}/>
          <span style={{ color:'#64748b' }}>{p.name}:</span>
          <span style={{ fontWeight:700, color:'#0f172a' }}>{p.value.toLocaleString()}</span>
        </div>
      ))}
    </div>
  )
}

// ─── Stat Card ────────────────────────────────────────────────────────────────
function StatCard({ label, value, trend, up }) {
  return (
    <div style={{ background:'#fff', border:'1px solid #e2e8f0', borderRadius:10, padding:'16px 18px' }}>
      <p style={{ fontSize:12, color:'#64748b', margin:'0 0 8px', fontWeight:500 }}>{label}</p>
      <p style={{ fontSize:18, fontWeight:700, color:'#0f172a', margin:0 }}>{value}</p>
      {trend && (
        <div style={{ display:'flex', alignItems:'center', gap:4, marginTop:6,
          fontSize:12, fontWeight:500, color: up ? '#16a34a' : '#dc2626' }}>
          {up ? <TrendingUp size={12}/> : <TrendingDown size={12}/>}
          <span>{trend} vs yesterday</span>
        </div>
      )}
    </div>
  )
}

// ─── Main ──────────────────────────────────────────────────────────────────────
export default function BotDashboard() {
  const navigate   = useNavigate()
  const { activeBot } = useApp()

  if (!activeBot) {
    return (
      <div style={{ textAlign:'center', paddingTop:80 }}>
        <p style={{ fontSize:14, color:'#64748b' }}>No bot selected.{' '}
          <button onClick={() => navigate('/')}
            style={{ color:'#0066ff', border:'none', background:'none', cursor:'pointer', fontSize:14 }}>
            ← Go to bots
          </button>
        </p>
      </div>
    )
  }

  const s = activeBot.stats

  const stats = [
    { label:'Open Conversations', value: s.openConvs,              trend:'+4',    up:false },
    { label:'Resolved Today',     value: s.resolvedToday,          trend:'+18%',  up:true  },
    { label:'Bot Handled',        value: `${s.botRate}%`,          trend:'+3%',   up:true  },
    { label:'Messages Sent',      value: s.messagesSent.toLocaleString(), trend:'+12%', up:true },
    { label:'Avg Response Time',  value: s.avgReply,               trend:'+0.3m', up:false },
  ]

  const recentConvs = [
    { name:'Priya Sharma',  phone:'+91 98765 43210', msg:'I need help with my order #3821', time:'2 min ago',  status:'Bot'      },
    { name:'Rahul Mehta',   phone:'+91 82341 09876', msg:'What are your pricing plans?',    time:'1 hr ago',   status:'Agent'    },
    { name:'Anita Kapoor',  phone:'+91 91234 56789', msg:'My appointment is confirmed.',    time:'3 hrs ago',  status:'Resolved' },
    { name:'Vikram Singh',  phone:'+91 77890 12345', msg:'Can I get a refund?',              time:'5 hrs ago',  status:'Agent'    },
    { name:'Sneha Patel',   phone:'+91 98123 45678', msg:'How do I track my shipment?',     time:'7 hrs ago',  status:'Resolved' },
  ]

  const STATUS_DOT = { Bot:'#0066ff', Agent:'#22c55e', Resolved:'#94a3b8' }

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:20 }}>

      {/* ── Back + Bot name ── */}
      <div style={{ display:'flex', alignItems:'center', gap:12 }}>
        <button onClick={() => navigate('/')}
          style={{ border:'1px solid #e2e8f0', background:'#fff', borderRadius:8, padding:'6px 10px',
            cursor:'pointer', color:'#64748b', display:'flex', alignItems:'center', gap:5, fontSize:13 }}>
          <ArrowLeft size={14}/> All Bots
        </button>
        <div style={{ display:'flex', alignItems:'center', gap:8 }}>
          <div style={{ width:30, height:30, borderRadius:8, background:'#f1f5f9',
            display:'flex', alignItems:'center', justifyContent:'center',
            fontSize:12, fontWeight:700, color:'#475569' }}>
            {activeBot.avatar}
          </div>
          <span style={{ fontSize:14, fontWeight:700, color:'#0f172a' }}>{activeBot.name}</span>
          <span style={{ fontSize:12, color:'#94a3b8' }}>{activeBot.number}</span>
        </div>
      </div>

      {/* ── Stats row ── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {stats.map(s => <StatCard key={s.label} {...s}/>)}
      </div>

      {/* ── Chart ── */}
      <div style={{ background:'#fff', border:'1px solid #e2e8f0', borderRadius:12, padding:'20px 20px 10px' }}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:20 }}>
          <div>
            <p style={{ fontSize:13, fontWeight:600, color:'#0f172a', margin:0 }}>Conversation Volume</p>
            <p style={{ fontSize:11, color:'#94a3b8', marginTop:3 }}>Incoming vs outgoing — last 30 days</p>
          </div>
          <div style={{ display:'flex', gap:16, fontSize:12, color:'#64748b' }}>
            <span style={{ display:'flex', alignItems:'center', gap:5 }}>
              <span style={{ width:10, height:2, background:'#0066ff', display:'inline-block', borderRadius:1 }}/>
              Outgoing
            </span>
            <span style={{ display:'flex', alignItems:'center', gap:5 }}>
              <span style={{ width:10, height:2, background:'#94a3b8', display:'inline-block', borderRadius:1 }}/>
              Incoming
            </span>
          </div>
        </div>
        <ResponsiveContainer width="100%" height={200}>
          <AreaChart data={MESSAGE_VOLUME} margin={{ top:0, right:0, left:-20, bottom:0 }}>
            <defs>
              <linearGradient id="gA" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%"  stopColor="#0066ff" stopOpacity={0.1}/>
                <stop offset="95%" stopColor="#0066ff" stopOpacity={0}/>
              </linearGradient>
              <linearGradient id="gB" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%"  stopColor="#94a3b8" stopOpacity={0.08}/>
                <stop offset="95%" stopColor="#94a3b8" stopOpacity={0}/>
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false}/>
            <XAxis dataKey="date" tick={{ fontSize:10, fill:'#94a3b8' }} tickLine={false} axisLine={false} interval={6}/>
            <YAxis tick={{ fontSize:10, fill:'#94a3b8' }} tickLine={false} axisLine={false}/>
            <Tooltip content={<ChartTip/>}/>
            <Area type="monotone" dataKey="outgoing" name="Outgoing" stroke="#0066ff" strokeWidth={1.5} fill="url(#gA)" dot={false}/>
            <Area type="monotone" dataKey="incoming" name="Incoming" stroke="#94a3b8" strokeWidth={1.5} fill="url(#gB)" dot={false}/>
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* ── Recent Conversations ── */}
      <div style={{ background:'#fff', border:'1px solid #e2e8f0', borderRadius:12, overflow:'hidden' }} className="overflow-x-auto">
        <div style={{ padding:'16px 20px', borderBottom:'1px solid #f1f5f9',
          display:'flex', justifyContent:'space-between', alignItems:'center' }}>
          <p style={{ fontSize:13, fontWeight:600, color:'#0f172a', margin:0 }}>Recent Conversations</p>
          <button onClick={() => navigate('/conversations')}
            style={{ fontSize:12, color:'#0066ff', background:'none', border:'none', cursor:'pointer', fontWeight:500 }}>
            Open Inbox →
          </button>
        </div>
        <table style={{ width:'100%', borderCollapse:'collapse' }}>
          <thead>
            <tr style={{ background:'#f8fafc' }}>
              {['Contact','Last message','Time','Status'].map(h => (
                <th key={h} style={{ padding:'10px 20px', textAlign:'left', fontSize:11, fontWeight:600,
                  color:'#94a3b8', textTransform:'uppercase', letterSpacing:'0.04em' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {recentConvs.map((c, i) => (
              <tr key={c.name}
                style={{ borderTop:'1px solid #f8fafc', cursor:'pointer' }}
                onClick={() => navigate('/conversations')}
                onMouseEnter={e => e.currentTarget.style.background = '#fafafa'}
                onMouseLeave={e => e.currentTarget.style.background = 'none'}>
                <td style={{ padding:'12px 20px' }}>
                  <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                    <div style={{ width:32, height:32, borderRadius:'50%', background:'#f1f5f9',
                      display:'flex', alignItems:'center', justifyContent:'center',
                      fontSize:12, fontWeight:700, color:'#475569', flexShrink:0 }}>
                      {c.name.split(' ').map(n => n[0]).join('')}
                    </div>
                    <div>
                      <p style={{ fontSize:12, fontWeight:600, color:'#0f172a', margin:0 }}>{c.name}</p>
                      <p style={{ fontSize:10, color:'#94a3b8', margin:0 }}>{c.phone}</p>
                    </div>
                  </div>
                </td>
                <td style={{ padding:'12px 20px', fontSize:12, color:'#64748b', maxWidth:260 }}>
                  <span style={{ overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', display:'block' }}>
                    {c.msg}
                  </span>
                </td>
                <td style={{ padding:'12px 20px', fontSize:12, color:'#94a3b8', whiteSpace:'nowrap' }}>{c.time}</td>
                <td style={{ padding:'12px 20px' }}>
                  <span style={{ display:'inline-flex', alignItems:'center', gap:5, fontSize:12,
                    color: STATUS_DOT[c.status] }}>
                    <span style={{ width:6, height:6, borderRadius:'50%', background:STATUS_DOT[c.status], display:'inline-block' }}/>
                    {c.status}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
