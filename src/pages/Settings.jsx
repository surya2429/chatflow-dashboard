// Settings.jsx — Full-featured settings (Conversations-sidebar style + #0066ff primary)
import { useState, useContext, createContext, useRef, useEffect, Fragment } from 'react'
import { useApp } from '../context/AppContext'
import {
  Settings as SettingsIcon, MessageSquare, Clock, Bell, Users, Shield, Timer,
  Tag, List, Bot, Code, CreditCard, Lock, FileText,
  Plus, Trash2, Edit3, Check, X, Copy, Eye, EyeOff, RefreshCw,
  Upload, Download, Search,
  Calendar, CheckCircle2, Activity, Send,
  UserPlus, Zap, Globe, GripVertical, Languages, Repeat2, ChevronDown,
  Building2, Phone, Mail, AlertCircle, Search as SearchIcon,
} from 'lucide-react'
import clsx from 'clsx'
import Select, { NativeSelect } from '../components/Select'
import { PLANS, FEATURE_GROUPS, FEATURE_ADDONS, USAGE_ADDONS, CURRENT_PLAN, CURRENT_BILLING, getPlan, planMath, inr, num } from '../constants/pricing'

/* ─── Nav structure ───────────────────────────────────────────────────────── */
const SECTIONS = [
  { id:'general',        label:'General',            icon:SettingsIcon, group:'Account'      },
  { id:'whatsapp',       label:'WhatsApp Profile',   icon:MessageSquare,group:'Account'      },
  { id:'business_hours', label:'Business Hours',     icon:Clock,        group:'Account'      },
  { id:'notifications',  label:'Notifications',      icon:Bell,         group:'Account'      },
  { id:'team',           label:'Team Members',       icon:Users,        group:'Team'         },
  { id:'departments',    label:'Departments',         icon:Building2,    group:'Team'         },
  { id:'roles',          label:'Roles & Permissions',icon:Shield,       group:'Team'         },
  { id:'sla',            label:'SLA & Routing',      icon:Timer,        group:'Team'         },
  { id:'canned',         label:'Canned Responses',   icon:MessageSquare,group:'Productivity' },
  { id:'tags',           label:'Tags & Labels',      icon:Tag,          group:'Productivity' },
  { id:'custom_fields',  label:'Custom Fields',      icon:List,         group:'Productivity' },
  { id:'auto_reply',     label:'Auto Replies',       icon:Bot,          group:'Productivity' },
  { id:'api',            label:'API & Webhooks',     icon:Code,         group:'Developer'    },
  { id:'billing',        label:'Billing & Plan',     icon:CreditCard,   group:'Billing'      },
  { id:'security',       label:'Security',           icon:Lock,         group:'Security'     },
  { id:'audit',          label:'Audit Log',          icon:FileText,     group:'Security'     },
  { id:'language',       label:'Language',           icon:Languages,    group:'Bot'          },
  { id:'wa_conversations',label:'Conversations',     icon:Repeat2,      group:'Bot'          },
  { id:'wa_automation',  label:'Automation',         icon:Zap,          group:'Bot'          },
]
const GROUPS = ['Account','Team','Productivity','Developer','Billing','Security','Bot']

/* Sections that only make sense for one channel. The workspace-level settings
   (team, roles, billing, security…) are shared by every product. */
const WHATSAPP_ONLY_SECTIONS = ['whatsapp', 'wa_conversations', 'wa_automation']
const sectionsFor = productId =>
  productId === 'webchat' ? SECTIONS.filter(s => !WHATSAPP_ONLY_SECTIONS.includes(s.id)) : SECTIONS

/* ─── Bot shared context ──────────────────────────────────────────────────── */
const BotCtx = createContext(null)

/* ─── Department shared context ──────────────────────────────────────────── */
const DeptCtx = createContext(null)

const DEPT_COLORS = ['#0066ff','#22c55e','#f59e0b','#ef4444','#8b5cf6','#0ea5e9','#ec4899','#64748b']
const INIT_DEPARTMENTS = [
  { id:1, name:'Sales',      color:'#0066ff', memberIds:[1,2,3], defaultRole:'Agent' },
  { id:2, name:'Support',    color:'#22c55e', memberIds:[4,5],   defaultRole:'Agent' },
  { id:3, name:'Operations', color:'#8b5cf6', memberIds:[6],     defaultRole:'Supervisor' },
]

/* ─── Shared data ─────────────────────────────────────────────────────────── */
const TIMEZONES = ['Asia/Kolkata (IST +5:30)','Asia/Dubai (GST +4:00)','Asia/Singapore (SGT +8:00)',
  'Europe/London (GMT +0:00)','Europe/Paris (CET +1:00)','America/New_York (EST -5:00)',
  'America/Los_Angeles (PST -8:00)','Australia/Sydney (AEST +10:00)']
const LANGUAGES_LIST = ['English','Hindi','Arabic','French','Spanish','German','Portuguese','Malay','Indonesian']
const LABEL_COLORS = ['#ef4444','#f97316','#eab308','#22c55e','#06b6d4','#0066ff','#8b5cf6','#ec4899','#64748b']

/* ─── Primitive components ────────────────────────────────────────────────── */
function Toggle({ value, onChange }) {
  return (
    <button onClick={() => onChange(!value)} style={{
      width:34, height:18, borderRadius:9, border:'none', cursor:'pointer', position:'relative',
      background: value ? '#0066ff' : '#d1d5db', transition:'background 0.2s', padding:0, flexShrink:0,
    }}>
      <div style={{ position:'absolute', top:2, left: value ? 16 : 2, width:14, height:14, borderRadius:'50%',
        background:'#fff', transition:'left 0.2s', boxShadow:'0 1px 3px rgba(0,0,0,0.2)' }}/>
    </button>
  )
}

function SaveBar({ onSave, saved }) {
  return (
    <div style={{ display:'flex', justifyContent:'flex-end', gap:10, paddingTop:12, marginTop:12, borderTop:'1px solid #e2e8f0' }}>
      {saved && <span style={{ fontSize:12, color:'#22c55e', display:'flex', alignItems:'center', gap:5 }}>
        <CheckCircle2 size={13}/> Saved
      </span>}
      <button onClick={onSave}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary text-white text-[11px] font-semibold hover:bg-primary/90 transition-colors">
        Save Changes
      </button>
    </div>
  )
}

function SectionHeader({ title, desc }) {
  return (
    <div style={{ marginBottom:14 }}>
      <h2 style={{ fontSize:14, fontWeight:700, color:'#0f172a', margin:0 }}>{title}</h2>
      {desc && <p style={{ fontSize:11, color:'#64748b', marginTop:3, margin:'3px 0 0' }}>{desc}</p>}
    </div>
  )
}

function Field({ label, hint, children }) {
  return (
    <div style={{ marginBottom:10 }}>
      <label style={{ display:'block', fontSize:11, fontWeight:600, color:'#374151', marginBottom:4 }}>{label}</label>
      {children}
      {hint && <p style={{ fontSize:10, color:'#94a3b8', marginTop:3 }}>{hint}</p>}
    </div>
  )
}

const inputCss = {
  width:'100%', border:'1px solid #e2e8f0', borderRadius:8, padding:'8px 12px',
  fontSize:13, color:'#0f172a', background:'#fff', outline:'none', boxSizing:'border-box',
}

function Input({ value, onChange, placeholder, type='text', disabled }) {
  return (
    <input type={type} value={value} onChange={e=>onChange(e.target.value)} placeholder={placeholder}
      disabled={disabled} style={{ ...inputCss, height: 36, background: disabled?'#f8fafc':'#fff' }}
      onFocus={e=>e.target.style.borderColor='#0066ff'}
      onBlur={e=>e.target.style.borderColor='#e2e8f0'}
    />
  )
}

function SettingsSelect({ value, onChange, options }) {
  return (
    <NativeSelect value={value} onChange={e=>onChange(e.target.value)} className="!h-9">
      {options.map(o => <option key={o.v||o} value={o.v||o}>{o.l||o}</option>)}
    </NativeSelect>
  )
}

function Textarea({ value, onChange, placeholder, rows=3 }) {
  return (
    <textarea value={value} onChange={e=>onChange(e.target.value)} placeholder={placeholder} rows={rows}
      style={{ ...inputCss, resize:'vertical' }}
      onFocus={e=>e.target.style.borderColor='#0066ff'}
      onBlur={e=>e.target.style.borderColor='#e2e8f0'}
    />
  )
}

function Badge({ children, color='#0066ff', bg='#eff4ff' }) {
  return (
    <span style={{ fontSize:11, fontWeight:600, color, background:bg, borderRadius:20,
      padding:'2px 8px', display:'inline-flex', alignItems:'center', gap:3 }}>{children}</span>
  )
}

function PrimaryBtn({ onClick, children, style }) {
  return (
    <button onClick={onClick} style={style}
      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary text-white text-[11px] font-semibold hover:bg-primary/90 transition-colors whitespace-nowrap flex-shrink-0">
      {children}
    </button>
  )
}

function GhostBtn({ onClick, children, danger }) {
  return (
    <button onClick={onClick}
      className={clsx(
        'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-semibold border transition-colors whitespace-nowrap flex-shrink-0',
        danger
          ? 'text-red-500 border-red-200 bg-white hover:bg-red-50'
          : 'text-slate-600 border-surface-border bg-white hover:bg-surface-hover'
      )}>
      {children}
    </button>
  )
}

function CollapsibleCard({ title, badge, defaultOpen=true, children }) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div style={{ marginBottom:12, borderRadius:12, border:'1px solid #e2e8f0', overflow:'hidden' }}>
      <button onClick={()=>setOpen(p=>!p)} style={{
        width:'100%', display:'flex', alignItems:'center', justifyContent:'space-between',
        padding:'10px 14px', background:'#f8fafc', border:'none', cursor:'pointer',
        borderBottom: open ? '1px solid #e2e8f0' : 'none',
      }}>
        <div style={{ display:'flex', alignItems:'center', gap:8 }}>
          <span style={{ fontSize:12, fontWeight:600, color:'#0f172a' }}>{title}</span>
          {badge != null && (
            <span style={{ fontSize:10, color:'#64748b', background:'#e2e8f0',
              borderRadius:10, padding:'1px 7px', fontWeight:500 }}>{badge}</span>
          )}
        </div>
        <ChevronDown size={14} color="#94a3b8"
          style={{ transform: open ? 'rotate(0deg)' : 'rotate(-90deg)', transition:'transform 0.15s', flexShrink:0 }}/>
      </button>
      {open && (
        <div style={{ padding:'12px 14px', background:'#fff' }}>
          {children}
        </div>
      )}
    </div>
  )
}

/* ─── General ─────────────────────────────────────────────────────────────── */
function GeneralSection() {
  const [saved, setSaved] = useState(false)
  const [form, setForm] = useState({
    name:'ChatFlow Inc.', email:'admin@chatflow.io', phone:'+91 9876543210',
    website:'https://chatflow.io', address:'Mumbai, India',
    timezone:'Asia/Kolkata (IST +5:30)', language:'English',
    dateFormat:'DD/MM/YYYY', currency:'INR',
  })
  const f = (k,v) => setForm(p=>({...p,[k]:v}))
  function save() { setSaved(true); setTimeout(()=>setSaved(false),2500) }

  return (
    <div>
      <SectionHeader title="General Settings" desc="Manage your workspace profile, timezone, and regional preferences"/>

      {/* Logo card */}
      <div style={{ display:'flex', alignItems:'center', gap:16, marginBottom:14, padding:12,
        background:'#f8fafc', borderRadius:12, border:'1px solid #e2e8f0' }}>
        <div style={{ width:68, height:68, borderRadius:14, background:'#0066ff',
          display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
          <Zap size={30} color="#fff"/>
        </div>
        <div style={{ flex:1 }}>
          <p style={{ fontWeight:600, fontSize:14, color:'#0f172a', margin:0 }}>Workspace Logo</p>
          <p style={{ fontSize:12, color:'#64748b', marginTop:3 }}>PNG, JPG up to 2MB. Recommended 256×256px</p>
          <div style={{ display:'flex', gap:8, marginTop:10 }}>
            <button style={{ fontSize:12, fontWeight:600, color:'#0066ff', background:'#eff4ff',
              border:'1px solid #b9d0ff', borderRadius:7, padding:'5px 12px', cursor:'pointer', display:'flex', alignItems:'center', gap:5 }}>
              <Upload size={12}/> Upload Logo
            </button>
            <button style={{ fontSize:12, color:'#ef4444', background:'#fff', border:'1px solid #fecaca',
              borderRadius:7, padding:'5px 12px', cursor:'pointer' }}>Remove</button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
        <Field label="Workspace Name"><Input value={form.name} onChange={v=>f('name',v)} placeholder="Your company name"/></Field>
        <Field label="Business Email"><Input value={form.email} onChange={v=>f('email',v)} type="email"/></Field>
        <Field label="Phone Number"><Input value={form.phone} onChange={v=>f('phone',v)}/></Field>
        <Field label="Website"><Input value={form.website} onChange={v=>f('website',v)}/></Field>
      </div>
      <Field label="Business Address">
        <Input value={form.address} onChange={v=>f('address',v)} placeholder="City, Country"/>
      </Field>

      <div style={{ borderTop:'1px solid #e2e8f0', paddingTop:12, marginTop:4, marginBottom:10 }}>
        <p style={{ fontSize:12, fontWeight:600, color:'#0f172a', marginBottom:10 }}>Regional Settings</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          <Field label="Timezone"><SettingsSelect value={form.timezone} onChange={v=>f('timezone',v)} options={TIMEZONES}/></Field>
          <Field label="Language"><SettingsSelect value={form.language} onChange={v=>f('language',v)} options={LANGUAGES_LIST}/></Field>
          <Field label="Date Format">
            <SettingsSelect value={form.dateFormat} onChange={v=>f('dateFormat',v)}
              options={[{v:'DD/MM/YYYY',l:'DD/MM/YYYY'},{v:'MM/DD/YYYY',l:'MM/DD/YYYY'},{v:'YYYY-MM-DD',l:'YYYY-MM-DD'}]}/>
          </Field>
          <Field label="Currency">
            <SettingsSelect value={form.currency} onChange={v=>f('currency',v)} options={['INR','USD','EUR','GBP','AED','SGD','AUD']}/>
          </Field>
        </div>
      </div>
      <SaveBar onSave={save} saved={saved}/>
    </div>
  )
}

/* ─── WhatsApp Profile ────────────────────────────────────────────────────── */
function WhatsAppSection() {
  const [saved, setSaved] = useState(false)
  const [form, setForm] = useState({
    displayName:'ChatFlow Support', about:"We reply within minutes. Available Mon–Sat, 9am–7pm.",
    category:'COMMUNICATION', website:'https://chatflow.io', email:'support@chatflow.io',
    address:'Mumbai, MH 400001, India', description:'',
  })
  const f = (k,v) => setForm(p=>({...p,[k]:v}))
  function save() { setSaved(true); setTimeout(()=>setSaved(false),2500) }

  const CATEGORIES = ['AUTOMOTIVE','BEAUTY_SPA_SALON','CLOTHING_APPAREL','EDUCATION','ENTERTAINMENT',
    'EVENT_PLANNING','FINANCE','FOOD_GROCERY','GOVERNMENT','HEALTH_MEDICAL','HOTEL_LODGING',
    'NONPROFIT','PROFESSIONAL_SERVICES','SHOPPING_RETAIL','TECHNOLOGY','COMMUNICATION','OTHER']

  return (
    <div>
      <SectionHeader title="WhatsApp Business Profile" desc="Manage your public-facing WhatsApp profile visible to customers"/>

      <div style={{ display:'flex', alignItems:'center', gap:16, marginBottom:14, padding:12,
        background:'#f0fdf4', borderRadius:12, border:'1px solid #bbf7d0' }}>
        <div style={{ width:68, height:68, borderRadius:'50%', background:'#22c55e',
          display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
          <MessageSquare size={28} color="#fff"/>
        </div>
        <div style={{ flex:1 }}>
          <p style={{ fontWeight:600, fontSize:14, color:'#0f172a', margin:0 }}>Profile Photo</p>
          <p style={{ fontSize:12, color:'#4ade80', marginTop:2 }}>Visible to all WhatsApp users</p>
          <div style={{ display:'flex', gap:8, marginTop:8 }}>
            <button style={{ fontSize:12, fontWeight:600, color:'#16a34a', background:'#dcfce7',
              border:'1px solid #bbf7d0', borderRadius:7, padding:'5px 12px', cursor:'pointer', display:'flex', alignItems:'center', gap:5 }}>
              <Upload size={12}/> Change Photo
            </button>
          </div>
        </div>
        <div style={{ textAlign:'right' }}>
          <Badge color="#16a34a" bg="#dcfce7">✓ Connected</Badge>
          <p style={{ fontSize:11, color:'#64748b', marginTop:4 }}>+91 98765 43210</p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
        <Field label="Display Name" hint="This appears as your WhatsApp business name">
          <Input value={form.displayName} onChange={v=>f('displayName',v)}/>
        </Field>
        <Field label="Business Category">
          <SettingsSelect value={form.category} onChange={v=>f('category',v)} options={CATEGORIES}/>
        </Field>
      </div>
      <Field label="About / Status" hint="Max 139 characters. Shown on your profile.">
        <Textarea value={form.about} onChange={v=>f('about',v)} rows={2}/>
        <div style={{ textAlign:'right', fontSize:11, color: form.about.length>139?'#ef4444':'#94a3b8', marginTop:2 }}>
          {form.about.length}/139
        </div>
      </Field>
      <Field label="Business Description">
        <Textarea value={form.description} onChange={v=>f('description',v)} placeholder="Describe your business..." rows={3}/>
      </Field>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
        <Field label="Website"><Input value={form.website} onChange={v=>f('website',v)}/></Field>
        <Field label="Email"><Input value={form.email} onChange={v=>f('email',v)} type="email"/></Field>
      </div>
      <Field label="Address"><Input value={form.address} onChange={v=>f('address',v)}/></Field>
      <SaveBar onSave={save} saved={saved}/>
    </div>
  )
}

/* ─── Business Hours ──────────────────────────────────────────────────────── */
const DEFAULT_HOURS = {
  monday:    { enabled:true,  open:'09:00', close:'18:00' },
  tuesday:   { enabled:true,  open:'09:00', close:'18:00' },
  wednesday: { enabled:true,  open:'09:00', close:'18:00' },
  thursday:  { enabled:true,  open:'09:00', close:'18:00' },
  friday:    { enabled:true,  open:'09:00', close:'18:00' },
  saturday:  { enabled:true,  open:'10:00', close:'15:00' },
  sunday:    { enabled:false, open:'09:00', close:'18:00' },
}
const DAYS_LIST = ['monday','tuesday','wednesday','thursday','friday','saturday','sunday']
const DAY_ABBR  = { monday:'Mon',tuesday:'Tue',wednesday:'Wed',thursday:'Thu',friday:'Fri',saturday:'Sat',sunday:'Sun' }

function BusinessHoursSection() {
  const [saved, setSaved]       = useState(false)
  const [hoursMode, setHoursMode] = useState('custom') // 'always' | 'custom'
  const [hours, setHours]       = useState(DEFAULT_HOURS)
  const [timezone, setTimezone] = useState('Asia/Kolkata (IST +5:30)')
  const [awayMsg, setAwayMsg]   = useState("We're currently offline. We'll get back to you during business hours.")
  const [holidays, setHolidays] = useState([
    { id:1, name:"Republic Day", date:"2026-01-26" },
    { id:2, name:"Independence Day", date:"2026-08-15" },
  ])
  const [newHoliday, setNewHoliday] = useState({ name:'', date:'' })

  function toggleDay(d) { setHours(h=>({...h,[d]:{...h[d],enabled:!h[d].enabled}})) }
  function setTime(d,field,val) { setHours(h=>({...h,[d]:{...h[d],[field]:val}})) }
  function addHoliday() {
    if(!newHoliday.name||!newHoliday.date) return
    setHolidays(p=>[...p,{id:Date.now(),...newHoliday}])
    setNewHoliday({name:'',date:''})
  }
  function removeHoliday(id) { setHolidays(p=>p.filter(h=>h.id!==id)) }
  function save() { setSaved(true); setTimeout(()=>setSaved(false),2500) }

  const TIME_OPTIONS = Array.from({length:48},(_,i)=>{
    const h=Math.floor(i/2).toString().padStart(2,'0')
    const m=i%2===0?'00':'30'
    return `${h}:${m}`
  })

  return (
    <div>
      <SectionHeader title="Business Hours" desc="Controls availability for both your chatbot and live agents. Away messages are sent outside these hours."/>

      {/* Scope badges */}
      <div style={{ display:'flex', gap:6, marginBottom:14 }}>
        {['🤖 Chatbot', '👤 Live Chat'].map(label => (
          <span key={label} style={{ fontSize:11, fontWeight:600, padding:'3px 10px',
            borderRadius:20, background:'#f1f5f9', color:'#475569', border:'1px solid #e2e8f0' }}>
            {label}
          </span>
        ))}
        <span style={{ fontSize:11, color:'#94a3b8', alignSelf:'center', marginLeft:4 }}>
          — both use this schedule
        </span>
      </div>

      {/* Mode selector */}
      <div style={{ display:'flex', gap:10, marginBottom:16 }}>
        {[
          { value:'always', label:'🕐 Available all the time', desc:'Chatbot + agents active 24/7' },
          { value:'custom', label:'📅 Custom schedule',        desc:'Set hours per day for both'   },
        ].map(opt => (
          <button key={opt.value} type="button" onClick={() => setHoursMode(opt.value)}
            style={{
              flex:1, display:'flex', flexDirection:'column', alignItems:'flex-start',
              padding:'12px 16px', borderRadius:12, cursor:'pointer',
              border: hoursMode === opt.value ? '2px solid #0066ff' : '2px solid #e2e8f0',
              background: hoursMode === opt.value ? '#eff6ff' : '#fff',
              transition:'all 0.15s',
            }}>
            <span style={{ fontSize:13, fontWeight:600, color: hoursMode === opt.value ? '#0066ff' : '#0f172a' }}>
              {opt.label}
            </span>
            <span style={{ fontSize:11, color:'#94a3b8', marginTop:2 }}>{opt.desc}</span>
          </button>
        ))}
      </div>

      {/* Always available notice */}
      {hoursMode === 'always' && (
        <div style={{ display:'flex', alignItems:'flex-start', gap:10, padding:'12px 16px',
          background:'#f0fdf4', border:'1px solid #bbf7d0', borderRadius:12, marginBottom:16 }}>
          <span style={{ width:8, height:8, borderRadius:'50%', background:'#22c55e', flexShrink:0, marginTop:3 }}/>
          <div>
            <p style={{ fontSize:12, color:'#15803d', fontWeight:600, margin:'0 0 2px' }}>
              Active 24 hours a day, 7 days a week
            </p>
            <p style={{ fontSize:11, color:'#16a34a', margin:0 }}>
              Your chatbot will respond instantly at any hour. Live agents will receive incoming chats
              whenever they're online — no restrictions applied.
            </p>
          </div>
        </div>
      )}

      {/* Custom schedule */}
      {hoursMode === 'custom' && (<>
        <Field label="Timezone">
          <SettingsSelect value={timezone} onChange={setTimezone} options={TIMEZONES}/>
        </Field>

        <div style={{ border:'1px solid #e2e8f0', borderRadius:12, overflow:'hidden', marginBottom:12 }}>
          {DAYS_LIST.map((day,i)=>{
            const h = hours[day]
            return (
              <div key={day} style={{ display:'flex', alignItems:'center', gap:14, padding:'12px 16px',
                background: i%2===0?'#fff':'#f8fafc', borderBottom: i<6?'1px solid #f1f5f9':'none' }}>
                <Toggle value={h.enabled} onChange={()=>toggleDay(day)}/>
                <span style={{ width:36, fontSize:13, fontWeight:600, color: h.enabled?'#0f172a':'#94a3b8' }}>{DAY_ABBR[day]}</span>
                {h.enabled ? (
                  <div style={{ display:'flex', alignItems:'center', gap:8, flex:1 }}>
                    <Select
                      value={h.open}
                      onChange={v=>setTime(day,'open',v)}
                      options={TIME_OPTIONS.map(t=>({ value: t, label: t }))}
                      size="sm"
                    />
                    <span style={{ fontSize:12, color:'#94a3b8' }}>to</span>
                    <Select
                      value={h.close}
                      onChange={v=>setTime(day,'close',v)}
                      options={TIME_OPTIONS.map(t=>({ value: t, label: t }))}
                      size="sm"
                    />
                  </div>
                ) : (
                  <span style={{ fontSize:13, color:'#94a3b8', flex:1 }}>Closed</span>
                )}
              </div>
            )
          })}
        </div>
      </>)}

      <Field label="Away Message" hint="Sent by the chatbot when a customer messages outside your business hours. Live agents won't be notified until hours resume.">
        <Textarea value={awayMsg} onChange={setAwayMsg} rows={3}/>
      </Field>

      <div style={{ marginBottom:12 }}>
        <p style={{ fontSize:12, fontWeight:600, color:'#0f172a', marginBottom:8 }}>Holidays</p>
        {holidays.map(h=>(
          <div key={h.id} style={{ display:'flex', alignItems:'center', gap:10, padding:'9px 12px',
            background:'#fff', border:'1px solid #e2e8f0', borderRadius:8, marginBottom:8 }}>
            <Calendar size={14} color="#64748b"/>
            <span style={{ flex:1, fontSize:13, color:'#0f172a', fontWeight:500 }}>{h.name}</span>
            <span style={{ fontSize:12, color:'#64748b' }}>{h.date}</span>
            <button onClick={()=>removeHoliday(h.id)} style={{ border:'none', background:'none', cursor:'pointer', color:'#ef4444', padding:4 }}>
              <Trash2 size={13}/>
            </button>
          </div>
        ))}
        <div style={{ display:'flex', gap:8, marginTop:8 }}>
          <input value={newHoliday.name} onChange={e=>setNewHoliday(p=>({...p,name:e.target.value}))}
            placeholder="Holiday name"
            style={{ flex:1, border:'1px solid #e2e8f0', borderRadius:8, padding:'6px 12px', fontSize:12, outline:'none' }}
            onFocus={e=>e.target.style.borderColor='#0066ff'} onBlur={e=>e.target.style.borderColor='#e2e8f0'}
          />
          <input type="date" value={newHoliday.date} onChange={e=>setNewHoliday(p=>({...p,date:e.target.value}))}
            style={{ border:'1px solid #e2e8f0', borderRadius:8, padding:'6px 12px', fontSize:12, outline:'none' }}
            onFocus={e=>e.target.style.borderColor='#0066ff'} onBlur={e=>e.target.style.borderColor='#e2e8f0'}
          />
          <PrimaryBtn onClick={addHoliday}><Plus size={13}/> Add</PrimaryBtn>
        </div>
      </div>
      <SaveBar onSave={save} saved={saved}/>
    </div>
  )
}

/* ─── Notifications ───────────────────────────────────────────────────────── */
function NotificationsSection() {
  const [saved, setSaved] = useState(false)
  const [prefs, setPrefs] = useState({
    browser_new_conv:true, browser_new_msg:true, browser_assign:true, browser_mention:true,
    email_new_conv:false, email_daily_summary:true, email_weekly_report:true, email_assign:true,
    sound_enabled:true, sound_volume:'medium', push_enabled:false,
    sla_breach:true, sla_warning:true,
  })
  const p = (k,v)=>setPrefs(pr=>({...pr,[k]:v}))
  function save() { setSaved(true); setTimeout(()=>setSaved(false),2500) }

  function NotifRow({ label, desc, k }) {
    return (
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'10px 0', borderBottom:'1px solid #f1f5f9' }}>
        <div>
          <p style={{ fontSize:13, fontWeight:500, color:'#0f172a', margin:0 }}>{label}</p>
          {desc && <p style={{ fontSize:11, color:'#94a3b8', marginTop:2 }}>{desc}</p>}
        </div>
        <Toggle value={prefs[k]} onChange={v=>p(k,v)}/>
      </div>
    )
  }

  function Group({ title, children }) {
    return (
      <div style={{ marginBottom:14 }}>
        <p style={{ fontSize:10, fontWeight:700, color:'#94a3b8', textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:2 }}>{title}</p>
        {children}
      </div>
    )
  }

  return (
    <div>
      <SectionHeader title="Notifications" desc="Control how and when you receive alerts"/>
      <Group title="Browser Notifications">
        <NotifRow label="New Conversation" desc="When a new conversation is assigned or created" k="browser_new_conv"/>
        <NotifRow label="New Message" desc="When a customer sends a message" k="browser_new_msg"/>
        <NotifRow label="Assignment" desc="When a conversation is assigned to you" k="browser_assign"/>
        <NotifRow label="Mentions" desc="When someone @mentions you in a note" k="browser_mention"/>
      </Group>
      <Group title="Email Notifications">
        <NotifRow label="New Conversation Assigned" k="email_assign"/>
        <NotifRow label="Daily Summary" desc="End-of-day conversation summary" k="email_daily_summary"/>
        <NotifRow label="Weekly Report" desc="Sent every Monday morning" k="email_weekly_report"/>
        <NotifRow label="New Conversation" k="email_new_conv"/>
      </Group>
      <Group title="Sound">
        <NotifRow label="Enable notification sounds" k="sound_enabled"/>
        {prefs.sound_enabled && (
          <Field label="Volume">
            <SettingsSelect value={prefs.sound_volume} onChange={v=>p('sound_volume',v)} options={['low','medium','high']}/>
          </Field>
        )}
      </Group>
      <Group title="SLA Alerts">
        <NotifRow label="SLA Breach Alert" desc="When a conversation misses SLA" k="sla_breach"/>
        <NotifRow label="SLA Warning (30 min before)" k="sla_warning"/>
      </Group>
      <Group title="Push Notifications">
        <NotifRow label="Mobile Push Notifications" desc="Requires mobile app" k="push_enabled"/>
      </Group>
      <SaveBar onSave={save} saved={saved}/>
    </div>
  )
}

/* ─── Team Members ────────────────────────────────────────────────────────── */
const MOCK_MEMBERS = [
  { id:1, name:'Rahul Mehta',  email:'rahul@chatflow.io',  role:'Admin',     status:'active',  avatar:'RM', lastSeen:'Now'       },
  { id:2, name:'Priya Sharma', email:'priya@chatflow.io',  role:'Agent',     status:'active',  avatar:'PS', lastSeen:'5 min ago' },
  { id:3, name:'Arjun Patel',  email:'arjun@chatflow.io',  role:'Agent',     status:'away',    avatar:'AP', lastSeen:'2 hr ago'  },
  { id:4, name:'Sneha Gupta',  email:'sneha@chatflow.io',  role:'Supervisor',status:'active',  avatar:'SG', lastSeen:'1 min ago' },
  { id:5, name:'Vikram Singh', email:'vikram@chatflow.io', role:'Agent',     status:'offline', avatar:'VS', lastSeen:'Yesterday' },
  { id:6, name:'Anjali Nair',  email:'anjali@chatflow.io', role:'Viewer',    status:'active',  avatar:'AN', lastSeen:'Just now'  },
]
const STATUS_COLOR = { active:'#22c55e', away:'#f59e0b', offline:'#94a3b8' }
const ROLE_BADGE = {
  Admin:{ c:'#0066ff', bg:'#eff4ff' }, Agent:{ c:'#0ea5e9', bg:'#e0f2fe' },
  Supervisor:{ c:'#8b5cf6', bg:'#f5f3ff' }, Viewer:{ c:'#64748b', bg:'#f1f5f9' }
}

function TeamSection() {
  const { activeProductId } = useApp()
  const { departments, assignMemberToDept } = useContext(DeptCtx)
  const [members, setMembers] = useState(MOCK_MEMBERS)
  const [showInvite, setShowInvite] = useState(false)
  const [invite, setInvite] = useState({
    name:'', email:'', password:'', phone:'', countryCode:'+91',
    role:'Agent', department:'',
    emailNotif:false, waNotif:false,
  })
  const [showPass, setShowPass] = useState(false)
  const [emailVerified, setEmailVerified] = useState(false)
  const [search, setSearch] = useState('')
  const [editMember, setEditMember] = useState(null)
  const [editForm, setEditForm] = useState({ name:'', email:'', role:'Agent' })

  const filtered = members.filter(m=>
    m.name.toLowerCase().includes(search.toLowerCase()) ||
    m.email.toLowerCase().includes(search.toLowerCase())
  )

  function getMemberDept(memberId) {
    return departments.find(d => d.memberIds.includes(memberId))
  }

  function sendInvite() {
    if (!invite.email) return
    const displayName = invite.name || invite.email.split('@')[0]
    const avatar = displayName.split(' ').map(w=>w[0]).join('').slice(0,2).toUpperCase()
    const newM = { id:Date.now(), name:displayName, email:invite.email,
      role:invite.role, status:'offline', avatar, lastSeen:'Invited' }
    setMembers(p=>[...p, newM])
    if (invite.department) {
      assignMemberToDept(newM.id, Number(invite.department))
    }
    setInvite({ name:'', email:'', password:'', phone:'', countryCode:'+91', role:'Agent', department:'', emailNotif:false, waNotif:false })
    setEmailVerified(false)
    setShowInvite(false)
  }

  function openEdit(m) {
    setEditMember(m.id)
    setEditForm({ name:m.name, email:m.email, role:m.role })
  }

  function saveEdit() {
    setMembers(p=>p.map(m=>m.id===editMember
      ? { ...m, name:editForm.name, email:editForm.email, role:editForm.role,
          avatar: editForm.name.split(' ').map(w=>w[0]).join('').slice(0,2).toUpperCase() }
      : m
    ))
    setEditMember(null)
  }

  function removeMember(id) { setMembers(p=>p.filter(m=>m.id!==id)) }
  function changeRole(id, role) { setMembers(p=>p.map(m=>m.id===id?{...m,role}:m)) }

  return (
    <div>
      <SectionHeader title="Team Members" desc="Manage who has access to your workspace"/>

      {/* Edit Member Modal */}
      {editMember && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm"
          onClick={e => e.target===e.currentTarget && setEditMember(null)}>
          <div className="bg-white w-full max-w-md rounded-2xl shadow-modal flex flex-col max-h-[88vh] overflow-hidden border border-surface-border">
            <div className="flex items-center gap-3 px-4 py-3 border-b border-surface-border flex-shrink-0">
              <div className="w-7 h-7 rounded-lg bg-primary-50 flex items-center justify-center flex-shrink-0">
                <Edit3 size={13} className="text-primary"/>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[13px] font-bold text-slate-900">Edit Member</p>
                <p className="text-[10px] text-slate-400">Update member details and access role</p>
              </div>
              <button onClick={()=>setEditMember(null)} className="p-1 rounded-lg hover:bg-surface-hover text-slate-400 transition-colors">
                <X size={14}/>
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {[
                { label:'Full Name', key:'name', placeholder:'Full name', type:'text' },
                { label:'Email', key:'email', placeholder:'email@company.com', type:'email' },
              ].map(({label,key,placeholder,type})=>(
                <div key={key}>
                  <label className="block text-[10px] font-semibold text-slate-500 mb-1">{label}</label>
                  <input value={editForm[key]} onChange={e=>setEditForm(p=>({...p,[key]:e.target.value}))}
                    type={type} placeholder={placeholder}
                    className="w-full text-[12px] border border-surface-border rounded-lg px-2.5 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-primary/15 focus:border-primary/40 transition-all placeholder-slate-300"/>
                </div>
              ))}
              <div>
                <label className="block text-[10px] font-semibold text-slate-500 mb-1">Role</label>
                <SettingsSelect value={editForm.role} onChange={v=>setEditForm(p=>({...p,role:v}))}
                  options={['Admin','Supervisor','Agent','Viewer'].map(r=>({v:r,l:r}))}/>
              </div>
            </div>
            <div className="flex items-center justify-between px-4 py-2.5 border-t border-surface-border flex-shrink-0">
              <button onClick={()=>setEditMember(null)} className="text-[11px] text-slate-400 hover:text-slate-600 transition-colors">Cancel</button>
              <button onClick={saveEdit} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary text-white text-[11px] font-semibold hover:bg-primary/90 transition-colors">
                <Check size={11}/> Save Changes
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 mb-3">
        {[
          { label:'Total Members', value:members.length, color:'#0066ff' },
          { label:'Active Now', value:members.filter(m=>m.status==='active').length, color:'#22c55e' },
          { label:'Agents', value:members.filter(m=>m.role==='Agent').length, color:'#0ea5e9' },
          { label:'Admins', value:members.filter(m=>m.role==='Admin').length, color:'#f59e0b' },
        ].map(s=>(
          <div key={s.label} style={{ background:'#f8fafc', border:'1px solid #e2e8f0', borderRadius:10, padding:'10px 12px' }}>
            <p style={{ fontSize:11, color:'#64748b', margin:0 }}>{s.label}</p>
            <p style={{ fontSize:16, fontWeight:700, color:s.color, margin:'3px 0 0' }}>{s.value}</p>
          </div>
        ))}
      </div>

      <div style={{ display:'flex', gap:8, marginBottom:10 }}>
        <div style={{ flex:1, position:'relative' }}>
          <Search size={14} style={{ position:'absolute', left:10, top:'50%', transform:'translateY(-50%)', color:'#94a3b8' }}/>
          <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search members..."
            style={{ width:'100%', border:'1px solid #e2e8f0', borderRadius:8, padding:'6px 12px 6px 32px', fontSize:12, outline:'none', boxSizing:'border-box' }}
            onFocus={e=>e.target.style.borderColor='#0066ff'} onBlur={e=>e.target.style.borderColor='#e2e8f0'}
          />
        </div>
        <PrimaryBtn onClick={()=>setShowInvite(true)}><UserPlus size={14}/> Invite Member</PrimaryBtn>
      </div>

      {/* Create User Modal */}
      {showInvite && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm"
          onClick={e => e.target===e.currentTarget && setShowInvite(false)}>
          <div className="bg-white w-full max-w-md rounded-2xl shadow-modal flex flex-col max-h-[92vh] overflow-hidden border border-surface-border">

            {/* Header */}
            <div className="flex items-center gap-3 px-4 py-3 border-b border-surface-border flex-shrink-0">
              <div className="w-7 h-7 rounded-lg bg-primary-50 flex items-center justify-center flex-shrink-0">
                <UserPlus size={13} className="text-primary"/>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[13px] font-bold text-slate-900">Create User</p>
                <p className="text-[10px] text-slate-400">Add a user to your workspace.</p>
              </div>
              <button onClick={()=>setShowInvite(false)} className="p-1 rounded-lg hover:bg-surface-hover text-slate-400 transition-colors">
                <X size={14}/>
              </button>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3">

              {/* Role */}
              <div>
                <label className="block text-[10px] font-semibold text-slate-500 mb-1">Role</label>
                <SettingsSelect value={invite.role} onChange={v=>setInvite(p=>({...p,role:v}))}
                  options={['Admin','Supervisor','Agent','Viewer'].map(r=>({v:r,l:r}))}/>
              </div>

              {/* Name */}
              <div>
                <label className="block text-[10px] font-semibold text-slate-500 mb-1">Full Name</label>
                <input value={invite.name} onChange={e=>setInvite(p=>({...p,name:e.target.value}))}
                  placeholder="Full name"
                  className="w-full text-[12px] border border-surface-border rounded-lg px-2.5 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-primary/15 focus:border-primary/40 transition-all placeholder-slate-300"/>
              </div>

              {/* Email */}
              <div>
                <label className="block text-[10px] font-semibold text-slate-500 mb-1">Email</label>
                <div className="relative mb-1.5">
                  <Mail size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-300 pointer-events-none"/>
                  <input value={invite.email} onChange={e=>{ setInvite(p=>({...p,email:e.target.value})); setEmailVerified(false) }}
                    type="email" placeholder="user@example.com"
                    className="w-full text-[12px] border border-surface-border rounded-lg pl-8 pr-2.5 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-primary/15 focus:border-primary/40 transition-all placeholder-slate-300"/>
                </div>
                {invite.email && !emailVerified && (
                  <p className="text-[10px] text-slate-400 mb-1.5">Use a valid email address, for example {invite.email}.</p>
                )}
                <button onClick={()=>setEmailVerified(true)}
                  className={`w-full flex items-center justify-center gap-2 py-2 rounded-lg text-[12px] font-semibold text-white transition-colors ${emailVerified?'bg-green-500':'bg-primary hover:bg-primary/90'}`}>
                  {emailVerified ? <><Check size={13}/> Email Verified</> : <><Mail size={13}/> Verify Email Address</>}
                </button>
              </div>

              {/* Password */}
              <div>
                <label className="block text-[10px] font-semibold text-slate-500 mb-1">Password</label>
                <div className="relative">
                  <input value={invite.password} onChange={e=>setInvite(p=>({...p,password:e.target.value}))}
                    type={showPass?'text':'password'} placeholder="Enter a password"
                    className="w-full text-[12px] border border-surface-border rounded-lg px-2.5 pr-9 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-primary/15 focus:border-primary/40 transition-all placeholder-slate-300"/>
                  <button onClick={()=>setShowPass(p=>!p)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors">
                    {showPass ? <EyeOff size={14}/> : <Eye size={14}/>}
                  </button>
                </div>
                <p className="text-[10px] text-slate-400 mt-1">8–16 characters, one uppercase letter, one number, one special character.</p>
              </div>

              {/* Phone */}
              <div>
                <label className="block text-[10px] font-semibold text-slate-500 mb-1">Phone Number</label>
                <div className="flex gap-2">
                  <div className="flex items-center gap-1.5 border border-surface-border rounded-lg px-2.5 py-2 bg-white flex-shrink-0 cursor-pointer">
                    <span className="text-base leading-none">🇮🇳</span>
                    <span className="text-[12px] font-medium text-slate-700">+91</span>
                    <ChevronDown size={10} className="text-slate-400"/>
                  </div>
                  <input value={invite.phone} onChange={e=>setInvite(p=>({...p,phone:e.target.value}))}
                    type="tel" placeholder="Phone number"
                    className="flex-1 text-[12px] border border-surface-border rounded-lg px-2.5 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-primary/15 focus:border-primary/40 transition-all placeholder-slate-300"/>
                </div>
                <p className="text-[10px] text-slate-400 mt-1">Enter the number without +91 (10 digits).</p>
              </div>

              {/* Department */}
              <div>
                <label className="block text-[10px] font-semibold text-slate-500 mb-1">Department</label>
                <SettingsSelect value={invite.department} onChange={v=>setInvite(p=>({...p,department:v}))}
                  options={[{v:'',l:'— None —'}, ...departments.map(d=>({v:String(d.id),l:d.name}))]}/>
              </div>

              {/* Notifications */}
              <div className="space-y-2.5 pt-1">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Notifications</p>
                {[
                  { key:'emailNotif', label:'Email notification', desc:'Notify this user by email.' },
                  ...(activeProductId === 'webchat' ? [] : [{ key:'waNotif', label:'WhatsApp notification', desc:'Notify this user on WhatsApp.' }]),
                ].map(n=>(
                  <div key={n.key} className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-[12px] font-semibold text-slate-800">{n.label}</p>
                      <p className="text-[10px] text-slate-400">{n.desc}</p>
                    </div>
                    <Toggle value={invite[n.key]} onChange={v=>setInvite(p=>({...p,[n.key]:v}))}/>
                  </div>
                ))}
              </div>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between px-4 py-2.5 border-t border-surface-border flex-shrink-0">
              <button onClick={()=>setShowInvite(false)} className="text-[11px] text-slate-400 hover:text-slate-600 transition-colors">Cancel</button>
              <button onClick={sendInvite} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary text-white text-[11px] font-semibold hover:bg-primary/90 transition-colors">
                <UserPlus size={11}/> Create User
              </button>
            </div>
          </div>
        </div>
      )}

      <div style={{ border:'1px solid #e2e8f0', borderRadius:12, overflow:'hidden' }}>
        <table style={{ width:'100%', borderCollapse:'collapse' }}>
          <thead>
            <tr style={{ background:'#f8fafc', borderBottom:'1px solid #e2e8f0' }}>
              {['Member','Department','Role','Status','Last Seen',''].map(h=>(
                <th key={h} style={{ padding:'10px 14px', textAlign:'left', fontSize:11, fontWeight:700, color:'#94a3b8', textTransform:'uppercase', letterSpacing:'0.05em' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map((m,i)=>(
              <tr key={m.id} style={{ borderBottom: i<filtered.length-1?'1px solid #f1f5f9':'none' }}
                onMouseEnter={e=>e.currentTarget.style.background='#f8fafc'}
                onMouseLeave={e=>e.currentTarget.style.background='transparent'}>
                <td style={{ padding:'12px 14px' }}>
                  <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                    <div style={{ width:34, height:34, borderRadius:'50%', background:'#0066ff',
                      display:'flex', alignItems:'center', justifyContent:'center', fontSize:12, fontWeight:700, color:'#fff', flexShrink:0 }}>
                      {m.avatar}
                    </div>
                    <div>
                      <p style={{ fontSize:13, fontWeight:600, color:'#0f172a', margin:0 }}>{m.name}</p>
                      <p style={{ fontSize:11, color:'#94a3b8', margin:0 }}>{m.email}</p>
                    </div>
                  </div>
                </td>
                <td style={{ padding:'12px 14px' }}>
                  {(() => {
                    const dept = getMemberDept(m.id)
                    return (
                      <select
                        value={dept?.id ?? ''}
                        onChange={e => assignMemberToDept(m.id, e.target.value ? Number(e.target.value) : null)}
                        style={{ border:'1px solid #e2e8f0', borderRadius:7, padding:'4px 8px', fontSize:12, color:'#374151',
                          background:'#fff', cursor:'pointer', outline:'none', maxWidth:120 }}>
                        <option value=''>— None —</option>
                        {departments.map(d=>(
                          <option key={d.id} value={d.id}>{d.name}</option>
                        ))}
                      </select>
                    )
                  })()}
                </td>
                <td style={{ padding:'12px 14px' }}>
                  <Select
                    value={m.role}
                    onChange={v=>changeRole(m.id,v)}
                    options={['Admin','Supervisor','Agent','Viewer'].map(r=>({ value: r, label: r }))}
                    size="sm"
                  />
                </td>
                <td style={{ padding:'12px 14px' }}>
                  <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                    <div style={{ width:7, height:7, borderRadius:'50%', background:STATUS_COLOR[m.status] }}/>
                    <span style={{ fontSize:12, color:'#374151', textTransform:'capitalize' }}>{m.status}</span>
                  </div>
                </td>
                <td style={{ padding:'12px 14px', fontSize:12, color:'#64748b' }}>{m.lastSeen}</td>
                <td style={{ padding:'12px 14px' }}>
                  <div style={{ display:'flex', gap:5 }}>
                    <button onClick={()=>openEdit(m)}
                      style={{ border:'1px solid #e2e8f0', background:'#fff', borderRadius:7, padding:'5px 8px',
                        cursor:'pointer', color:'#374151', display:'flex', alignItems:'center' }}>
                      <Edit3 size={13}/>
                    </button>
                    <button onClick={()=>removeMember(m.id)}
                      style={{ border:'1px solid #fecaca', background:'#fff', borderRadius:7, padding:'5px 8px',
                        cursor:'pointer', color:'#ef4444', display:'flex', alignItems:'center' }}>
                      <Trash2 size={13}/>
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

/* ─── Roles & Permissions ─────────────────────────────────────────────────── */
const PERMISSIONS = [
  { group:'Conversations', items:['View conversations','Reply to conversations','Assign conversations','Delete conversations','Export conversations'] },
  { group:'Contacts', items:['View contacts','Create contacts','Edit contacts','Delete contacts','Import/Export contacts'] },
  { group:'Broadcasts', items:['View broadcasts','Create broadcasts','Send broadcasts','Delete broadcasts'] },
  { group:'Templates', items:['View templates','Create templates','Submit for approval','Delete templates'] },
  { group:'Flows / Automation', items:['View flows','Create/Edit flows','Publish flows','Delete flows'] },
  { group:'Analytics', items:['View reports','Export reports'] },
  { group:'Settings', items:['View settings','Edit workspace settings','Manage team members','Manage billing'] },
]
const ROLES_DEF = {
  Admin:      { color:'#0066ff', desc:'Full access to all features and settings' },
  Supervisor: { color:'#8b5cf6', desc:'Team management + all agent capabilities' },
  Agent:      { color:'#0ea5e9', desc:'Handle conversations and contacts' },
  Viewer:     { color:'#64748b', desc:'Read-only access to conversations and reports' },
}
const DEFAULT_PERMS = {
  Admin:      { all: true },
  Supervisor: { 'View conversations':1,'Reply to conversations':1,'Assign conversations':1,'Delete conversations':1,'Export conversations':1,'View contacts':1,'Create contacts':1,'Edit contacts':1,'Delete contacts':1,'Import/Export contacts':1,'View broadcasts':1,'Create broadcasts':1,'Send broadcasts':1,'View templates':1,'Create templates':1,'Submit for approval':1,'View flows':1,'Create/Edit flows':1,'Publish flows':1,'View reports':1,'Export reports':1,'View settings':1,'Manage team members':1 },
  Agent:      { 'View conversations':1,'Reply to conversations':1,'Assign conversations':1,'View contacts':1,'Create contacts':1,'Edit contacts':1,'View broadcasts':1,'View templates':1,'View flows':1,'View reports':1 },
  Viewer:     { 'View conversations':1,'View contacts':1,'View broadcasts':1,'View templates':1,'View flows':1,'View reports':1 },
}

function RolesSection() {
  const { activeProductId } = useApp()
  const { departments } = useContext(DeptCtx)
  const [activeRole, setActiveRole] = useState('Agent')
  const [perms, setPerms] = useState(DEFAULT_PERMS)
  const [saved, setSaved] = useState(false)
  function toggle(role, perm) { setPerms(p=>({...p,[role]:{...p[role],[perm]:p[role][perm]?0:1}})) }
  function save() { setSaved(true); setTimeout(()=>setSaved(false),2500) }
  const isAdmin = activeRole==='Admin'
  const depsUsingRole = departments.filter(d => d.defaultRole === activeRole)

  return (
    <div>
      <SectionHeader title="Roles & Permissions" desc="Define what each role can do in your workspace"/>
      <div style={{ display:'flex', gap:8, marginBottom:20 }}>
        {Object.keys(ROLES_DEF).map(r=>(
          <button key={r} onClick={()=>setActiveRole(r)}
            style={{ border:`2px solid ${activeRole===r?ROLES_DEF[r].color:'#e2e8f0'}`,
              borderRadius:10, padding:'8px 16px', cursor:'pointer',
              background: activeRole===r?ROLES_DEF[r].color+'15':'#fff',
              display:'flex', flexDirection:'column', alignItems:'center', gap:3, minWidth:110 }}>
            <span style={{ fontSize:13, fontWeight:600, color: activeRole===r?ROLES_DEF[r].color:'#374151' }}>{r}</span>
            <span style={{ fontSize:10, color:'#94a3b8', textAlign:'center' }}>{ROLES_DEF[r].desc}</span>
          </button>
        ))}
      </div>

      {depsUsingRole.length > 0 && (
        <div style={{ display:'flex', alignItems:'center', gap:10, padding:'10px 14px', marginBottom:12,
          background:'#f8fafc', border:'1px solid #e2e8f0', borderRadius:10 }}>
          <Building2 size={14} color="#64748b"/>
          <span style={{ fontSize:12, color:'#64748b' }}>Departments using this role: </span>
          <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
            {depsUsingRole.map(d=>(
              <span key={d.id} style={{ display:'inline-flex', alignItems:'center', gap:4, fontSize:11, fontWeight:600,
                color:'#fff', background:d.color, borderRadius:12, padding:'2px 9px' }}>
                {d.name}
              </span>
            ))}
          </div>
        </div>
      )}

      {isAdmin ? (
        <div style={{ padding:20, background:'#f0fdf4', border:'1px solid #bbf7d0', borderRadius:10, display:'flex', alignItems:'center', gap:10 }}>
          <CheckCircle2 size={20} color="#22c55e"/>
          <p style={{ fontSize:13, color:'#166534', margin:0 }}>Admins have full access to all features. Permissions cannot be modified.</p>
        </div>
      ) : (
        <div style={{ border:'1px solid #e2e8f0', borderRadius:12, overflow:'hidden' }}>
          {PERMISSIONS.filter(g => !(activeProductId === 'webchat' && ['Broadcasts','Templates'].includes(g.group))).map((g, gi)=>(
            <div key={g.group}>
              <div style={{ background:'#f8fafc', padding:'8px 16px', borderTop: gi>0?'1px solid #e2e8f0':'none' }}>
                <span style={{ fontSize:11, fontWeight:700, color:'#374151', textTransform:'uppercase', letterSpacing:'0.05em' }}>{g.group}</span>
              </div>
              {g.items.map(item=>(
                <div key={item} style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'10px 16px', borderTop:'1px solid #f1f5f9' }}>
                  <span style={{ fontSize:13, color:'#374151' }}>{item}</span>
                  <Toggle value={!!(perms[activeRole]?.[item])} onChange={()=>toggle(activeRole,item)}/>
                </div>
              ))}
            </div>
          ))}
        </div>
      )}
      {!isAdmin && <SaveBar onSave={save} saved={saved}/>}
    </div>
  )
}

/* ─── SLA & Routing ───────────────────────────────────────────────────────── */
function SLASection() {
  const [saved, setSaved] = useState(false)
  const [form, setForm] = useState({
    frt:'5', frtUnit:'minutes', tat:'24', tatUnit:'hours',
    assignment:'round_robin', maxConvsPerAgent:'20', autoReassign:true,
    slaEnabled:true, slaBreachNotify:true, slaPauseOnHoliday:true,
  })
  const f = (k,v)=>setForm(p=>({...p,[k]:v}))
  function save() { setSaved(true); setTimeout(()=>setSaved(false),2500) }

  function Row({ label, desc, children }) {
    return (
      <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', padding:'14px 0', borderBottom:'1px solid #f1f5f9', gap:20 }}>
        <div style={{ flex:1 }}>
          <p style={{ fontSize:13, fontWeight:600, color:'#0f172a', margin:0 }}>{label}</p>
          {desc && <p style={{ fontSize:11, color:'#94a3b8', marginTop:2 }}>{desc}</p>}
        </div>
        <div style={{ flexShrink:0 }}>{children}</div>
      </div>
    )
  }

  return (
    <div>
      <SectionHeader title="SLA & Routing" desc="Configure response time targets and conversation assignment rules"/>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:10,
        padding:'10px 14px', background:'#f8fafc', border:'1px solid #e2e8f0', borderRadius:10 }}>
        <span style={{ fontSize:13, fontWeight:600, color:'#374151' }}>Enable SLA Tracking</span>
        <Toggle value={form.slaEnabled} onChange={v=>f('slaEnabled',v)}/>
      </div>

      {form.slaEnabled && (
        <div style={{ marginBottom:12 }}>
          <p style={{ fontSize:10, fontWeight:700, color:'#94a3b8', textTransform:'uppercase', letterSpacing:'0.05em', marginBottom:8 }}>Response Targets</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <div style={{ border:'1px solid #e2e8f0', borderRadius:10, padding:14 }}>
              <p style={{ fontSize:13, fontWeight:600, color:'#64748b', marginBottom:10 }}>First Response Time (FRT)</p>
              <div style={{ display:'flex', gap:8 }}>
                <input value={form.frt} onChange={e=>f('frt',e.target.value)} type="number" min="1"
                  style={{ flex:1, border:'1px solid #e2e8f0', borderRadius:7, padding:'7px 10px', fontSize:13, outline:'none' }}/>
                <Select
                  value={form.frtUnit}
                  onChange={v=>f('frtUnit',v)}
                  options={[{ value: 'minutes', label: 'Minutes' }, { value: 'hours', label: 'Hours' }]}
                  size="sm"
                />
              </div>
            </div>
            <div style={{ border:'1px solid #e2e8f0', borderRadius:10, padding:14 }}>
              <p style={{ fontSize:13, fontWeight:600, color:'#64748b', marginBottom:10 }}>Total Resolution Time (TAT)</p>
              <div style={{ display:'flex', gap:8 }}>
                <input value={form.tat} onChange={e=>f('tat',e.target.value)} type="number" min="1"
                  style={{ flex:1, border:'1px solid #e2e8f0', borderRadius:7, padding:'7px 10px', fontSize:13, outline:'none' }}/>
                <Select
                  value={form.tatUnit}
                  onChange={v=>f('tatUnit',v)}
                  options={[{ value: 'hours', label: 'Hours' }, { value: 'days', label: 'Days' }]}
                  size="sm"
                />
              </div>
            </div>
          </div>
          <Row label="SLA Breach Notification" desc="Alert agents when SLA is about to be breached">
            <Toggle value={form.slaBreachNotify} onChange={v=>f('slaBreachNotify',v)}/>
          </Row>
          <Row label="Pause SLA on Holidays" desc="Don't count holiday hours toward SLA">
            <Toggle value={form.slaPauseOnHoliday} onChange={v=>f('slaPauseOnHoliday',v)}/>
          </Row>
        </div>
      )}

      <p style={{ fontSize:10, fontWeight:700, color:'#94a3b8', textTransform:'uppercase', letterSpacing:'0.05em', marginBottom:8 }}>Conversation Routing</p>
      <Field label="Assignment Mode" hint="How new conversations are distributed to agents">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
          {[
            { v:'round_robin',   l:'Round Robin',   desc:'Evenly distributed' },
            { v:'load_balanced', l:'Load Balanced', desc:'Least conversations' },
            { v:'manual',        l:'Manual',        desc:'Assign yourself' },
          ].map(opt=>(
            <button key={opt.v} onClick={()=>f('assignment',opt.v)}
              style={{ border:`2px solid ${form.assignment===opt.v?'#0066ff':'#e2e8f0'}`,
                borderRadius:10, padding:'10px 12px', cursor:'pointer', textAlign:'center',
                background: form.assignment===opt.v?'#eff4ff':'#fff' }}>
              <p style={{ fontSize:13, fontWeight:600, color: form.assignment===opt.v?'#0066ff':'#374151', margin:0 }}>{opt.l}</p>
              <p style={{ fontSize:11, color:'#94a3b8', marginTop:2 }}>{opt.desc}</p>
            </button>
          ))}
        </div>
      </Field>

      <Row label="Max Conversations per Agent" desc="Limit simultaneous open conversations">
        <input value={form.maxConvsPerAgent} onChange={e=>f('maxConvsPerAgent',e.target.value)} type="number" min="1" max="999"
          style={{ width:70, border:'1px solid #e2e8f0', borderRadius:7, padding:'7px 10px', fontSize:13, outline:'none', textAlign:'center' }}/>
      </Row>
      <Row label="Auto-Reassign on Away" desc="Redistribute conversations when agent goes offline">
        <Toggle value={form.autoReassign} onChange={v=>f('autoReassign',v)}/>
      </Row>
      <SaveBar onSave={save} saved={saved}/>
    </div>
  )
}

/* ─── Canned Responses ────────────────────────────────────────────────────── */
const MOCK_CANNED = [
  { id:1, shortcut:'/hi',      name:'Greeting',       message:'Hello! 👋 Welcome to ChatFlow support. How can I help you today?', category:'Greetings' },
  { id:2, shortcut:'/thanks',  name:'Thank You',      message:'Thank you for reaching out! Your query has been noted. 🙏',        category:'Greetings' },
  { id:3, shortcut:'/wait',    name:'Please Wait',    message:"Please give me a moment to check on this for you. I'll be right back! ⏳", category:'Support' },
  { id:4, shortcut:'/order',   name:'Order Status',   message:"To check your order status, please share your Order ID and we'll look into it.", category:'Sales' },
  { id:5, shortcut:'/resolve', name:'Issue Resolved', message:'Your issue has been resolved. If you face any further trouble, feel free to reach out. ✅', category:'Support' },
  { id:6, shortcut:'/pricing', name:'Pricing Info',   message:'Our pricing plans start at ₹999/month. You can view the complete plans at chatflow.io/pricing 💰', category:'Sales' },
]

function CannedSection() {
  const [items, setItems] = useState(MOCK_CANNED)
  const [search, setSearch] = useState('')
  const [editId, setEditId] = useState(null)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ shortcut:'', name:'', message:'', category:'Support' })
  const ff = (k,v)=>setForm(p=>({...p,[k]:v}))

  const categories = [...new Set(items.map(i=>i.category))]
  const filtered = items.filter(i=> !search ||
    i.name.toLowerCase().includes(search.toLowerCase()) ||
    i.shortcut.toLowerCase().includes(search.toLowerCase()) ||
    i.message.toLowerCase().includes(search.toLowerCase())
  )

  function save() {
    if(!form.shortcut||!form.message) return
    if(editId) { setItems(p=>p.map(i=>i.id===editId?{...i,...form}:i)); setEditId(null) }
    else { setItems(p=>[...p,{id:Date.now(),...form}]) }
    setForm({shortcut:'',name:'',message:'',category:'Support'}); setShowForm(false)
  }

  function startEdit(item) {
    setForm({shortcut:item.shortcut,name:item.name,message:item.message,category:item.category})
    setEditId(item.id); setShowForm(true)
  }

  return (
    <div>
      <SectionHeader title="Canned Responses" desc="Save and reuse frequent reply templates. Type the shortcut in chat to insert."/>
      <div style={{ display:'flex', gap:8, marginBottom:10 }}>
        <div style={{ flex:1, position:'relative' }}>
          <Search size={13} style={{ position:'absolute', left:10, top:'50%', transform:'translateY(-50%)', color:'#94a3b8' }}/>
          <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search by name, shortcut, or content..."
            style={{ width:'100%', border:'1px solid #e2e8f0', borderRadius:8, padding:'6px 12px 6px 32px', fontSize:12, outline:'none', boxSizing:'border-box' }}
            onFocus={e=>e.target.style.borderColor='#0066ff'} onBlur={e=>e.target.style.borderColor='#e2e8f0'}
          />
        </div>
        <PrimaryBtn onClick={()=>{setShowForm(true);setEditId(null);setForm({shortcut:'',name:'',message:'',category:'Support'})}}><Plus size={14}/> New Response</PrimaryBtn>
      </div>

      {showForm && (
        <div style={{ background:'#f8fafc', border:'1px solid #e2e8f0', borderRadius:12, padding:12, marginBottom:10 }}>
          <p style={{ fontSize:12, fontWeight:600, color:'#0f172a', marginBottom:10 }}>{editId ? 'Edit Response' : 'New Canned Response'}</p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 mb-2">
            <Field label="Shortcut (e.g. /hi)"><Input value={form.shortcut} onChange={v=>ff('shortcut',v)} placeholder="/shortcut"/></Field>
            <Field label="Name"><Input value={form.name} onChange={v=>ff('name',v)} placeholder="Response name"/></Field>
            <Field label="Category">
              <input value={form.category} onChange={e=>ff('category',e.target.value)} list="cat-list"
                style={{ ...inputCss }}
                onFocus={e=>e.target.style.borderColor='#0066ff'} onBlur={e=>e.target.style.borderColor='#e2e8f0'}
              />
              <datalist id="cat-list">{categories.map(c=><option key={c} value={c}/>)}</datalist>
            </Field>
          </div>
          <Field label="Message">
            <Textarea value={form.message} onChange={v=>ff('message',v)} placeholder="Type your response..." rows={4}/>
          </Field>
          <div style={{ display:'flex', gap:8 }}>
            <PrimaryBtn onClick={save}>{editId?'Update':'Save'} Response</PrimaryBtn>
            <GhostBtn onClick={()=>{setShowForm(false);setEditId(null)}}>Cancel</GhostBtn>
          </div>
        </div>
      )}

      <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
        {filtered.map(item=>(
          <div key={item.id} style={{ display:'flex', alignItems:'flex-start', gap:12, padding:'12px 14px',
            background:'#fff', border:'1px solid #e2e8f0', borderRadius:10 }}
            onMouseEnter={e=>e.currentTarget.style.borderColor='#b9d0ff'}
            onMouseLeave={e=>e.currentTarget.style.borderColor='#e2e8f0'}>
            <div style={{ background:'#eff4ff', color:'#0066ff', borderRadius:7, padding:'3px 9px',
              fontSize:12, fontWeight:700, fontFamily:'monospace', flexShrink:0, marginTop:1 }}>
              {item.shortcut}
            </div>
            <div style={{ flex:1, minWidth:0 }}>
              <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:3 }}>
                <span style={{ fontSize:13, fontWeight:600, color:'#0f172a' }}>{item.name}</span>
                <Badge color="#64748b" bg="#f1f5f9">{item.category}</Badge>
              </div>
              <p style={{ fontSize:12, color:'#64748b', margin:0, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{item.message}</p>
            </div>
            <div style={{ display:'flex', gap:4, flexShrink:0 }}>
              <button onClick={()=>startEdit(item)} style={{ border:'none', background:'none', cursor:'pointer', color:'#64748b', padding:4 }}><Edit3 size={14}/></button>
              <button onClick={()=>setItems(p=>p.filter(i=>i.id!==item.id))} style={{ border:'none', background:'none', cursor:'pointer', color:'#ef4444', padding:4 }}><Trash2 size={14}/></button>
            </div>
          </div>
        ))}
        {filtered.length===0 && <div style={{ textAlign:'center', padding:'30px 0', color:'#94a3b8', fontSize:13 }}>No canned responses found</div>}
      </div>
    </div>
  )
}

/* ─── Tags & Labels ───────────────────────────────────────────────────────── */
const MOCK_TAGS = [
  { id:1, name:'VIP',       color:'#f59e0b', type:'contact',      count:34  },
  { id:2, name:'Hot Lead',  color:'#ef4444', type:'conversation', count:12  },
  { id:3, name:'Support',   color:'#3b82f6', type:'conversation', count:87  },
  { id:4, name:'Refund',    color:'#8b5cf6', type:'conversation', count:9   },
  { id:5, name:'Premium',   color:'#0066ff', type:'contact',      count:23  },
  { id:6, name:'Follow Up', color:'#22c55e', type:'conversation', count:41  },
  { id:7, name:'Escalated', color:'#ef4444', type:'conversation', count:6   },
  { id:8, name:'Newsletter',color:'#06b6d4', type:'contact',      count:156 },
]

function TagsSection() {
  const [tags, setTags] = useState(MOCK_TAGS)
  const [filter, setFilter] = useState('all')
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ name:'', color:LABEL_COLORS[0], type:'conversation' })
  const ff = (k,v)=>setForm(p=>({...p,[k]:v}))
  const filtered = tags.filter(t=> filter==='all' || t.type===filter)

  function addTag() {
    if(!form.name.trim()) return
    setTags(p=>[...p,{id:Date.now(),count:0,...form}])
    setForm({name:'',color:LABEL_COLORS[0],type:'conversation'}); setShowForm(false)
  }

  return (
    <div>
      <SectionHeader title="Tags & Labels" desc="Organize conversations and contacts with color-coded labels"/>
      <div style={{ display:'flex', gap:8, marginBottom:16 }}>
        <div style={{ display:'flex', gap:4, flex:1 }}>
          {['all','conversation','contact'].map(t=>(
            <button key={t} onClick={()=>setFilter(t)}
              className={clsx(
                'px-3 py-1.5 rounded-lg border text-[11px] font-semibold capitalize transition-colors whitespace-nowrap',
                filter===t ? 'border-primary bg-primary-50 text-primary' : 'border-surface-border bg-white text-slate-600 hover:bg-surface-hover'
              )}>
              {t==='all'?'All':t+'s'}
            </button>
          ))}
        </div>
        <PrimaryBtn onClick={()=>setShowForm(true)} small><Plus size={14}/> New Tag</PrimaryBtn>
      </div>

      {showForm && (
        <div style={{ background:'#f8fafc', border:'1px solid #e2e8f0', borderRadius:10, padding:14, marginBottom:14 }}>
          <div style={{ display:'flex', alignItems:'flex-end', gap:12 }}>
            <div style={{ flex:1 }}>
              <label style={{ display:'block', fontSize:13, fontWeight:600, color:'#374151', marginBottom:6 }}>Tag Name</label>
              <Input value={form.name} onChange={v=>ff('name',v)} placeholder="Enter tag name"/>
            </div>
            <div style={{ marginBottom:0 }}>
              <label style={{ display:'block', fontSize:13, fontWeight:600, color:'#374151', marginBottom:6 }}>Color</label>
              <div style={{ display:'flex', gap:6 }}>
                {LABEL_COLORS.map(c=>(
                  <button key={c} onClick={()=>ff('color',c)}
                    style={{ width:24, height:24, borderRadius:'50%', background:c, border: form.color===c?'3px solid #0f172a':'2px solid transparent', cursor:'pointer', flexShrink:0 }}/>
                ))}
              </div>
            </div>
            <div>
              <label style={{ display:'block', fontSize:13, fontWeight:600, color:'#374151', marginBottom:6 }}>Type</label>
              <Select
                value={form.type}
                onChange={v=>ff('type',v)}
                options={[{ value: 'conversation', label: 'Conversation' }, { value: 'contact', label: 'Contact' }]}
                size="sm"
              />
            </div>
            <div style={{ display:'flex', gap:8 }}>
              <PrimaryBtn onClick={addTag} small>Add</PrimaryBtn>
              <GhostBtn onClick={()=>setShowForm(false)}>Cancel</GhostBtn>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
        {filtered.map(tag=>(
          <div key={tag.id} style={{ border:'1px solid #e2e8f0', borderRadius:10, padding:'12px 14px', background:'#fff', display:'flex', alignItems:'center', gap:10 }}>
            <div style={{ width:12, height:12, borderRadius:'50%', background:tag.color, flexShrink:0 }}/>
            <div style={{ flex:1, minWidth:0 }}>
              <p style={{ fontSize:13, fontWeight:600, color:'#0f172a', margin:0 }}>{tag.name}</p>
              <p style={{ fontSize:11, color:'#94a3b8', margin:0, textTransform:'capitalize' }}>{tag.type} · {tag.count}</p>
            </div>
            <button onClick={()=>setTags(p=>p.filter(t=>t.id!==tag.id))} style={{ border:'none', background:'none', cursor:'pointer', color:'#d1d5db', padding:2 }}>
              <X size={13}/>
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}

/* ─── Custom Fields ───────────────────────────────────────────────────────── */
const FIELD_TYPES = [
  {v:'text',l:'Text'},{v:'number',l:'Number'},{v:'date',l:'Date'},
  {v:'boolean',l:'Yes/No'},{v:'dropdown',l:'Dropdown'},{v:'url',l:'URL'},{v:'phone',l:'Phone'},{v:'email',l:'Email'},
]
function CustomFieldsSection() {
  const { customFields: fields, addCustomField, removeCustomField } = useApp()
  const [tab, setTab] = useState('contact')
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ name:'', key:'', type:'text', required:false, options:'' })
  const ff = (k,v)=>setForm(p=>({...p,[k]:v}))
  function autoKey(name) { return name.toLowerCase().replace(/\s+/g,'_').replace(/[^a-z0-9_]/g,'') }

  function addField() {
    if(!form.name) return
    const newField = { id:Date.now(), ...form, key:form.key||autoKey(form.name),
      options: form.type==='dropdown'?form.options.split('\n').filter(Boolean):undefined }
    addCustomField(tab, newField)
    setForm({name:'',key:'',type:'text',required:false,options:''}); setShowForm(false)
  }

  const TYPE_COLOR = {text:'#0066ff',number:'#f59e0b',date:'#3b82f6',boolean:'#22c55e',dropdown:'#8b5cf6',url:'#06b6d4',phone:'#10b981',email:'#ef4444'}

  return (
    <div>
      <SectionHeader title="Custom Fields" desc="Add extra data fields to contacts and conversations"/>
      <div style={{ display:'flex', gap:4, marginBottom:16 }}>
        {['contact','conversation'].map(t=>(
          <button key={t} onClick={()=>setTab(t)}
            className={clsx(
              'px-3 py-1.5 rounded-lg border text-[11px] font-semibold capitalize transition-colors whitespace-nowrap',
              tab===t ? 'border-primary bg-primary-50 text-primary' : 'border-surface-border bg-white text-slate-600 hover:bg-surface-hover'
            )}>
            {t} Fields ({fields[t].length})
          </button>
        ))}
        <PrimaryBtn onClick={()=>setShowForm(true)} style={{ marginLeft:'auto' }} small><Plus size={14}/> Add Field</PrimaryBtn>
      </div>

      {showForm && (
        <div style={{ background:'#f8fafc', border:'1px solid #e2e8f0', borderRadius:10, padding:16, marginBottom:16 }}>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-3">
            <Field label="Field Name"><Input value={form.name} onChange={v=>{ff('name',v);if(!form.key)ff('key',autoKey(v))}} placeholder="e.g. Company Size"/></Field>
            <Field label="Field Key" hint="Auto-generated, used in API"><Input value={form.key} onChange={v=>ff('key',v)} placeholder="company_size"/></Field>
            <Field label="Field Type"><SettingsSelect value={form.type} onChange={v=>ff('type',v)} options={FIELD_TYPES}/></Field>
          </div>
          {form.type==='dropdown' && (
            <Field label="Options (one per line)">
              <Textarea value={form.options} onChange={v=>ff('options',v)} placeholder={"Option 1\nOption 2\nOption 3"} rows={4}/>
            </Field>
          )}
          <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:12 }}>
            <Toggle value={form.required} onChange={v=>ff('required',v)}/>
            <span style={{ fontSize:13, color:'#374151' }}>Required field</span>
          </div>
          <div style={{ display:'flex', gap:8 }}>
            <PrimaryBtn onClick={addField}>Add Field</PrimaryBtn>
            <GhostBtn onClick={()=>setShowForm(false)}>Cancel</GhostBtn>
          </div>
        </div>
      )}

      <div style={{ border:'1px solid #e2e8f0', borderRadius:12, overflow:'hidden' }}>
        <div style={{ overflowX:'auto' }}>
        <div style={{ background:'#f8fafc', padding:'8px 14px', display:'grid', gridTemplateColumns:'2fr 1.5fr 1fr 80px 40px', gap:12, borderBottom:'1px solid #e2e8f0', minWidth:480 }}>
          {['Field Name','API Key','Type','Required',''].map(h=>(
            <span key={h} style={{ fontSize:11, fontWeight:700, color:'#94a3b8', textTransform:'uppercase' }}>{h}</span>
          ))}
        </div>
        {fields[tab].map((fi,i)=>(
          <div key={fi.id} style={{ display:'grid', gridTemplateColumns:'2fr 1.5fr 1fr 80px 40px', gap:12,
            padding:'11px 14px', alignItems:'center', minWidth:480,
            borderBottom: i<fields[tab].length-1?'1px solid #f1f5f9':'none',
            background: i%2===0?'#fff':'#f8fafc' }}>
            <span style={{ fontSize:13, fontWeight:600, color:'#0f172a' }}>{fi.name}</span>
            <code style={{ fontSize:11, color:'#64748b', background:'#f1f5f9', padding:'2px 7px', borderRadius:5 }}>{fi.key}</code>
            <span style={{ display:'flex', alignItems:'center', gap:5 }}>
              <span style={{ width:8, height:8, borderRadius:'50%', background:TYPE_COLOR[fi.type]||'#94a3b8', display:'inline-block' }}/>
              <span style={{ fontSize:12, color:'#374151', textTransform:'capitalize' }}>{fi.type}</span>
            </span>
            <span style={{ fontSize:12, color: fi.required?'#ef4444':'#94a3b8' }}>{fi.required?'Yes':'No'}</span>
            <button onClick={()=>removeCustomField(tab, fi.id)} style={{ border:'none', background:'none', cursor:'pointer', color:'#ef4444', padding:4 }}>
              <Trash2 size={13}/>
            </button>
          </div>
        ))}
        {fields[tab].length===0 && <div style={{ textAlign:'center', padding:'24px 0', color:'#94a3b8', fontSize:13 }}>No custom fields yet</div>}
        </div>
      </div>
    </div>
  )
}

/* ─── Auto Replies ────────────────────────────────────────────────────────── */
function AutoReplySection() {
  const [saved, setSaved] = useState(false)
  const [welcome, setWelcome] = useState({ enabled:true, message:"Hi {{contact.name}}! 👋 Thanks for messaging us. We'll get back to you shortly." })
  const [away, setAway] = useState({ enabled:true, message:"Hi there! We're currently away. Our business hours are Mon–Sat, 9am–7pm IST. We'll reply soon! 🙏" })
  const [oos, setOos] = useState({ enabled:false, message:"Thanks for reaching out! Our team is currently unavailable. We'll respond during the next business day." })
  const [keywords, setKeywords] = useState([
    { id:1, trigger:'price|pricing|cost', response:'Our plans start at ₹999/month. Visit chatflow.io/pricing for details!', matchType:'any' },
    { id:2, trigger:'refund|cancel',       response:"We're sorry! Please share your order ID and we'll process the refund within 3-5 days.", matchType:'any' },
    { id:3, trigger:'hello|hi|hey',        response:"Hello! 👋 Welcome to ChatFlow. How can I assist you today?", matchType:'any' },
  ])
  const [kForm, setKForm] = useState({ trigger:'', response:'', matchType:'any' })
  const [showKForm, setShowKForm] = useState(false)
  const kf = (k,v)=>setKForm(p=>({...p,[k]:v}))

  function addKeyword() {
    if(!kForm.trigger||!kForm.response) return
    setKeywords(p=>[...p,{id:Date.now(),...kForm}])
    setKForm({trigger:'',response:'',matchType:'any'}); setShowKForm(false)
  }
  function save() { setSaved(true); setTimeout(()=>setSaved(false),2500) }

  function ReplyCard({ title, desc, state, setState }) {
    return (
      <div style={{ border:'1px solid #e2e8f0', borderRadius:12, padding:16, marginBottom:14 }}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:12 }}>
          <div>
            <p style={{ fontSize:14, fontWeight:600, color:'#0f172a', margin:0 }}>{title}</p>
            <p style={{ fontSize:12, color:'#94a3b8', marginTop:2 }}>{desc}</p>
          </div>
          <Toggle value={state.enabled} onChange={v=>setState(p=>({...p,enabled:v}))}/>
        </div>
        {state.enabled && (
          <Textarea value={state.message} onChange={v=>setState(p=>({...p,message:v}))} rows={3}
            placeholder="Type your auto-reply... Use {{contact.name}} for personalization"/>
        )}
      </div>
    )
  }

  return (
    <div>
      <SectionHeader title="Auto Replies" desc="Set up automatic responses for greetings, away periods, and keywords"/>
      <p style={{ fontSize:11, fontWeight:700, color:'#94a3b8', textTransform:'uppercase', letterSpacing:'0.05em', marginBottom:12 }}>Automated Messages</p>
      <ReplyCard title="Welcome Message" desc="Sent when a contact messages for the first time" state={welcome} setState={setWelcome}/>
      <ReplyCard title="Away Message" desc="Sent outside business hours" state={away} setState={setAway}/>
      <ReplyCard title="Out-of-Office" desc="Sent when all agents are offline" state={oos} setState={setOos}/>

      <div style={{ marginTop:8 }}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:12 }}>
          <div>
            <p style={{ fontSize:14, fontWeight:600, color:'#0f172a', margin:0 }}>Keyword Auto-Replies</p>
            <p style={{ fontSize:12, color:'#94a3b8', marginTop:2 }}>Trigger replies based on message keywords</p>
          </div>
          <PrimaryBtn onClick={()=>setShowKForm(true)} small><Plus size={13}/> Add Rule</PrimaryBtn>
        </div>

        {showKForm && (
          <div style={{ background:'#f8fafc', border:'1px solid #e2e8f0', borderRadius:10, padding:14, marginBottom:12 }}>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-2.5">
              <Field label="Keywords (comma or | separated)"><Input value={kForm.trigger} onChange={v=>kf('trigger',v)} placeholder="price|pricing|cost"/></Field>
              <Field label="Match Type">
                <SettingsSelect value={kForm.matchType} onChange={v=>kf('matchType',v)}
                  options={[{v:'any',l:'Any keyword'},{v:'exact',l:'Exact phrase'},{v:'all',l:'All keywords'}]}/>
              </Field>
            </div>
            <Field label="Auto Reply Message">
              <Textarea value={kForm.response} onChange={v=>kf('response',v)} placeholder="Response message..." rows={3}/>
            </Field>
            <div style={{ display:'flex', gap:8 }}>
              <PrimaryBtn onClick={addKeyword}>Add Rule</PrimaryBtn>
              <GhostBtn onClick={()=>setShowKForm(false)}>Cancel</GhostBtn>
            </div>
          </div>
        )}

        <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
          {keywords.map(k=>(
            <div key={k.id} style={{ border:'1px solid #e2e8f0', borderRadius:10, padding:'11px 14px', background:'#fff', display:'flex', gap:12 }}>
              <div style={{ flex:1 }}>
                <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:4 }}>
                  <span style={{ fontSize:11, fontWeight:700, color:'#0066ff', background:'#eff4ff', padding:'2px 7px', borderRadius:5, fontFamily:'monospace' }}>{k.trigger}</span>
                  <Badge color="#64748b" bg="#f1f5f9">{k.matchType}</Badge>
                </div>
                <p style={{ fontSize:12, color:'#64748b', margin:0 }}>{k.response}</p>
              </div>
              <button onClick={()=>setKeywords(p=>p.filter(kw=>kw.id!==k.id))} style={{ border:'none', background:'none', cursor:'pointer', color:'#ef4444', padding:4, alignSelf:'flex-start' }}>
                <Trash2 size={13}/>
              </button>
            </div>
          ))}
        </div>
      </div>
      <SaveBar onSave={save} saved={saved}/>
    </div>
  )
}

/* ─── API & Webhooks ──────────────────────────────────────────────────────── */
const MOCK_KEYS = [
  { id:1, name:'Production Key', key:'cf_live_a8b3c91d2e4f5678901234567890abcd', created:'Jan 12, 2026', lastUsed:'2 min ago',  scope:'full' },
  { id:2, name:'Read-Only Key',  key:'cf_live_b9c4d02e3f5g6789012345678901bcde', created:'Feb 3, 2026',  lastUsed:'5 days ago', scope:'read' },
]
const WEBHOOK_EVENTS = ['message.received','message.sent','message.delivered','message.read','message.failed',
  'conversation.assigned','conversation.resolved','conversation.created','contact.created','contact.updated',
  'broadcast.sent','broadcast.delivered','template.approved','template.rejected']

function APISection() {
  const { activeProductId } = useApp()
  const [keys, setKeys] = useState(MOCK_KEYS)
  const [showKey, setShowKey] = useState({})
  const [copied, setCopied] = useState('')
  const [webhookUrl, setWebhookUrl] = useState('https://your-server.com/webhook')
  const [webhookSecret, setWebhookSecret] = useState('whsec_a1b2c3d4e5f6')
  const [selectedEvents, setSelectedEvents] = useState(['message.received','conversation.assigned','conversation.resolved'])
  const [newKeyName, setNewKeyName] = useState('')
  const [showNewKey, setShowNewKey] = useState(false)
  const [saved, setSaved] = useState(false)

  function copy(val,id) { navigator.clipboard?.writeText(val); setCopied(id); setTimeout(()=>setCopied(''),2000) }
  function generateKey() {
    if(!newKeyName) return
    const raw = 'cf_live_'+Math.random().toString(36).slice(2)+Math.random().toString(36).slice(2)
    setKeys(p=>[...p,{id:Date.now(),name:newKeyName,key:raw,created:'Today',lastUsed:'Never',scope:'full'}])
    setNewKeyName(''); setShowNewKey(false)
  }
  function toggleEvent(ev) { setSelectedEvents(p=>p.includes(ev)?p.filter(e=>e!==ev):[...p,ev]) }
  function saveWebhook() { setSaved(true); setTimeout(()=>setSaved(false),2500) }

  return (
    <div>
      <SectionHeader title="API & Webhooks" desc="Manage API keys and configure webhook endpoints for real-time events"/>

      <div style={{ marginBottom:16 }}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:10 }}>
          <p style={{ fontSize:12, fontWeight:600, color:'#0f172a', margin:0 }}>API Keys</p>
          <PrimaryBtn onClick={()=>setShowNewKey(true)} small><Plus size={13}/> New Key</PrimaryBtn>
        </div>

        {showNewKey && (
          <div style={{ background:'#f8fafc', border:'1px solid #e2e8f0', borderRadius:10, padding:14, marginBottom:14 }}>
            <div style={{ display:'flex', gap:10 }}>
              <input value={newKeyName} onChange={e=>setNewKeyName(e.target.value)} placeholder="Key name (e.g. Production)"
                style={{ flex:1, border:'1px solid #e2e8f0', borderRadius:8, padding:'8px 12px', fontSize:13, outline:'none' }}
                onFocus={e=>e.target.style.borderColor='#0066ff'} onBlur={e=>e.target.style.borderColor='#e2e8f0'}
              />
              <PrimaryBtn onClick={generateKey}>Generate</PrimaryBtn>
              <GhostBtn onClick={()=>setShowNewKey(false)}><X size={14}/></GhostBtn>
            </div>
          </div>
        )}

        <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
          {keys.map(k=>(
            <div key={k.id} style={{ border:'1px solid #e2e8f0', borderRadius:10, padding:'14px 16px', background:'#fff' }}>
              <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', marginBottom:10 }}>
                <div>
                  <p style={{ fontSize:13, fontWeight:600, color:'#0f172a', margin:0 }}>{k.name}</p>
                  <p style={{ fontSize:11, color:'#94a3b8', marginTop:2 }}>Created {k.created} · Last used {k.lastUsed}</p>
                </div>
                <div style={{ display:'flex', gap:8 }}>
                  <Badge color={k.scope==='full'?'#0066ff':'#0ea5e9'} bg={k.scope==='full'?'#eff4ff':'#e0f2fe'}>
                    {k.scope==='full'?'Full Access':'Read Only'}
                  </Badge>
                  <button onClick={()=>setKeys(p=>p.filter(kk=>kk.id!==k.id))} style={{ border:'none', background:'none', cursor:'pointer', color:'#ef4444', padding:2 }}><Trash2 size={13}/></button>
                </div>
              </div>
              <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                <code style={{ flex:1, fontSize:12, background:'#f8fafc', border:'1px solid #f1f5f9', borderRadius:7,
                  padding:'6px 12px', color:'#374151', fontFamily:'monospace', letterSpacing: showKey[k.id]?'0':'0.1em' }}>
                  {showKey[k.id] ? k.key : k.key.slice(0,12)+'•'.repeat(20)}
                </code>
                <button onClick={()=>setShowKey(p=>({...p,[k.id]:!p[k.id]}))} style={{ border:'1px solid #e2e8f0', background:'#fff', borderRadius:7, padding:'6px 9px', cursor:'pointer', color:'#64748b' }}>
                  {showKey[k.id]?<EyeOff size={13}/>:<Eye size={13}/>}
                </button>
                <button onClick={()=>copy(k.key,k.id)} style={{ border:'1px solid #e2e8f0', background:'#fff', borderRadius:7, padding:'6px 9px', cursor:'pointer', color:'#64748b' }}>
                  {copied===k.id?<Check size={13} color="#22c55e"/>:<Copy size={13}/>}
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div>
        <p style={{ fontSize:12, fontWeight:600, color:'#0f172a', marginBottom:10 }}>Webhook Configuration</p>
        <Field label="Webhook URL" hint="We'll POST event payloads to this URL">
          <Input value={webhookUrl} onChange={setWebhookUrl} placeholder="https://your-server.com/webhook"/>
        </Field>
        <Field label="Webhook Secret" hint="Used to sign webhook payloads (verify with HMAC-SHA256)">
          <div style={{ display:'flex', gap:8 }}>
            <Input value={webhookSecret} onChange={setWebhookSecret}/>
            <button onClick={()=>setWebhookSecret('whsec_'+Math.random().toString(36).slice(2))}
              style={{ border:'1px solid #e2e8f0', background:'#fff', borderRadius:8, padding:'8px 12px', cursor:'pointer', color:'#64748b', flexShrink:0, display:'flex', alignItems:'center', gap:5, fontSize:13 }}>
              <RefreshCw size={13}/> Rotate
            </button>
          </div>
        </Field>
        <div style={{ marginBottom:10 }}>
          <label style={{ display:'block', fontSize:11, fontWeight:600, color:'#374151', marginBottom:8 }}>Subscribed Events</label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
            {WEBHOOK_EVENTS.filter(ev => !(activeProductId === 'webchat' && /^(broadcast|template)\./.test(ev))).map(ev=>(
              <label key={ev} style={{ display:'flex', alignItems:'center', gap:8, cursor:'pointer',
                padding:'7px 10px', borderRadius:7, border:`1px solid ${selectedEvents.includes(ev)?'#b9d0ff':'#e2e8f0'}`,
                background: selectedEvents.includes(ev)?'#eff4ff':'#fff' }}>
                <input type="checkbox" checked={selectedEvents.includes(ev)} onChange={()=>toggleEvent(ev)} style={{ accentColor:'#0066ff' }}/>
                <code style={{ fontSize:12, color: selectedEvents.includes(ev)?'#0066ff':'#374151' }}>{ev}</code>
              </label>
            ))}
          </div>
        </div>
        <div style={{ display:'flex', gap:10 }}>
          <PrimaryBtn onClick={saveWebhook}>{saved?<><Check size={13}/> Saved</>:<>Save Webhook</>}</PrimaryBtn>
          <GhostBtn onClick={()=>{}}><Send size={13}/> Test Webhook</GhostBtn>
        </div>
      </div>
    </div>
  )
}

/* ─── Billing & Plan ──────────────────────────────────────────────────────── */
const INVOICES = [
  { id:'INV-2026-01', date:'Jan 1, 2026', amount:'₹72,000', note:'Pro · yearly, + GST', status:'Paid' },
]

/* One cell of the feature comparison. */
function FeatureCell({ v, yearly }) {
  if (v === true)    return <span className="text-emerald-600 font-extrabold">✓</span>
  if (v === false)   return <span className="text-slate-300 text-base">—</span>
  if (v === 'addon') return <span className="inline-block text-[10px] font-semibold text-amber-700 bg-amber-50 border border-amber-200 rounded-md px-1.5 py-0.5">Add-on</span>
  if (typeof v === 'string') return <span className="text-[11px] text-slate-500">{v}</span>
  return (
    <span>
      <span className="font-semibold text-slate-800">{yearly ? `${num(v.perMonth * 12)} / yr` : `${num(v.perMonth)} / mo`}</span>
      <span className="block text-[10px] text-slate-400">{yearly ? 'credited upfront' : 'credited each month'}</span>
    </span>
  )
}

function BillingSection() {
  const { activeProductId } = useApp()
  const web = activeProductId === 'webchat'          // Website Chat has no WhatsApp rows
  const [billing, setBilling] = useState(CURRENT_BILLING)
  const [showCompare, setShowCompare] = useState(false)
  const yearly = billing === 'yearly'

  const current = getPlan(CURRENT_PLAN)
  const cm = planMath(current)
  const currentPrice = CURRENT_BILLING === 'yearly' ? `${inr(current.yearly)}/year` : `${inr(current.monthly)}/month`

  const tiles = web
    ? [
        { l:'Website Messages', v:'8,412', t:'Unlimited' },
        { l:'Live Agents', v:'3', t:'3 included' },
        { l:'Languages', v:'2', t:'2 included' },
      ]
    : [
        { l:'WhatsApp Service Msgs', v:'23,481', t:`${num(current.serviceMsgs)} / mo` },
        { l:'WhatsApp BI Msgs', v:'1,204', t:`${num(current.biMsgs)} / mo` },
        { l:'Live Agents', v:'3', t:'3 included' },
        { l:'Languages', v:'2', t:'2 included' },
      ]
  const used = 23481
  const usedPct = Math.round((used / current.serviceMsgs) * 100)

  const groups = FEATURE_GROUPS
    .filter(g => !(web && g.wa))
    .map(g => ({ ...g, rows: g.rows.filter(r => !(web && r.wa)) }))
    .filter(g => g.rows.length > 0)
  const featureAddons = FEATURE_ADDONS.filter(a => !(web && a.wa))
  const usageAddons = USAGE_ADDONS.filter(a => !(web && a.wa))

  const th = 'px-3 py-2.5 text-center text-[10px] font-bold text-slate-400 uppercase tracking-wider'

  return (
    <div>
      <SectionHeader title="Billing & Plan" desc="Manage your subscription, usage, and payment history"/>

      {/* Current plan */}
      <div style={{ background:'linear-gradient(135deg,#0066ff,#0052cc)', borderRadius:12, padding:14, color:'#fff', marginBottom:12 }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start' }}>
          <div>
            <p style={{ fontSize:12, opacity:0.8, margin:0 }}>Current Plan</p>
            <p style={{ fontSize:18, fontWeight:800, margin:'4px 0' }}>{current.name} Plan</p>
            <p style={{ fontSize:13, opacity:0.9 }}>{currentPrice} + GST · Renews Jan 1, 2027</p>
          </div>
          <Badge color="#fff" bg="rgba(255,255,255,0.2)">Active</Badge>
        </div>
        <div className={clsx('grid grid-cols-2 gap-2.5 mt-3', web ? 'sm:grid-cols-3' : 'sm:grid-cols-4')}>
          {tiles.map(u=>(
            <div key={u.l} style={{ background:'rgba(255,255,255,0.15)', borderRadius:10, padding:'10px 12px' }}>
              <p style={{ fontSize:12, opacity:0.8, margin:0 }}>{u.l}</p>
              <p style={{ fontSize:16, fontWeight:700, margin:'3px 0 0' }}>{u.v}</p>
              <p style={{ fontSize:11, opacity:0.7, margin:0 }}>of {u.t}</p>
            </div>
          ))}
        </div>
      </div>

      {!web && (
        <div style={{ border:'1px solid #e2e8f0', borderRadius:12, padding:12, marginBottom:12 }}>
          <p style={{ fontSize:12, fontWeight:600, color:'#0f172a', marginBottom:8 }}>WhatsApp Service Messages This Month</p>
          <div style={{ marginBottom:6, display:'flex', justifyContent:'space-between', fontSize:12, color:'#64748b' }}>
            <span>{num(used)} used</span><span>{num(current.serviceMsgs)} / month</span>
          </div>
          <div style={{ height:8, background:'#e2e8f0', borderRadius:4, overflow:'hidden' }}>
            <div style={{ width:`${usedPct}%`, height:'100%', background:'linear-gradient(90deg,#0066ff,#0052cc)', borderRadius:4 }}/>
          </div>
          <p style={{ fontSize:11, color:'#94a3b8', marginTop:6 }}>
            {usedPct}% used · {num(current.serviceMsgs - used)} messages remaining this month. Meta's per-message charges apply on top of your plan.
          </p>
        </div>
      )}

      {/* Billing period */}
      <div className="flex items-center justify-between flex-wrap gap-2 mb-2.5">
        <p style={{ fontSize:12, fontWeight:600, color:'#0f172a' }}>Plans</p>
        <div className="inline-flex gap-1 p-1 bg-slate-100 rounded-full">
          {[['monthly','Monthly'],['yearly','Yearly']].map(([k,l])=>(
            <button key={k} onClick={()=>setBilling(k)}
              className={clsx('px-3.5 py-1 rounded-full text-xs font-semibold transition-colors',
                billing===k ? 'bg-primary text-white' : 'text-slate-500 hover:text-slate-700')}>
              {l}{k==='yearly' && <span className={clsx('ml-1.5 text-[10px] font-bold', billing==='yearly' ? 'text-emerald-200' : 'text-emerald-600')}>Save up to 19%</span>}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-2.5 mb-3">
        {PLANS.map(plan=>{
          const m = planMath(plan)
          const isCurrent = plan.name === current.name && billing === CURRENT_BILLING
          return (
            <div key={plan.id} style={{ border:`2px solid ${plan.name===current.name?plan.color:'#e2e8f0'}`,
              borderRadius:14, padding:16, background: plan.name===current.name?plan.color+'0d':'#fff', position:'relative' }}>
              {plan.name===current.name && (
                <div style={{ position:'absolute', top:-10, left:'50%', transform:'translateX(-50%)',
                  background:plan.color, color:'#fff', fontSize:10, fontWeight:700, padding:'3px 10px', borderRadius:20, whiteSpace:'nowrap' }}>
                  CURRENT PLAN
                </div>
              )}
              <p style={{ fontSize:13, fontWeight:700, color:plan.color, margin:'0 0 4px' }}>{plan.name}</p>
              <p style={{ fontSize:18, fontWeight:800, color:'#0f172a', margin:0 }}>
                {yearly ? inr(plan.yearly) : inr(plan.monthly)}
                <span style={{ fontSize:12, color:'#94a3b8', fontWeight:500 }}> / {yearly ? 'yr' : 'mo'}</span>
              </p>
              <p style={{ fontSize:11, color:'#64748b', margin:'3px 0 6px' }}>
                {yearly ? `≈ ${inr(m.yearlyPerMonth)} / mo, billed yearly` : `${inr(m.year)} over 12 months`}
              </p>
              <div style={{ minHeight:22, marginBottom:6 }}>
                {yearly
                  ? <span className="inline-block text-[11px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-md px-1.5 py-0.5">Save {inr(m.saves)} ({m.savesPct}%)</span>
                  : <span className="text-[11px] font-semibold text-emerald-600">Save {m.savesPct}% with yearly</span>}
              </div>
              <p style={{ fontSize:10.5, color:'#94a3b8', margin:'0 0 10px' }}>+ GST</p>
              <p style={{ fontSize:12, color:'#334155', lineHeight:1.5, marginBottom:14 }}>{plan.desc}</p>
              <button disabled={isCurrent} style={{ width:'100%', border: isCurrent?'none':'1px solid '+plan.color,
                borderRadius:8, padding:'8px 0', cursor: isCurrent?'default':'pointer',
                background: isCurrent?plan.color:'transparent',
                color: isCurrent?'#fff':plan.color, fontSize:13, fontWeight:600 }}>
                {isCurrent ? 'Current Plan' : PLANS.indexOf(plan) > PLANS.findIndex(p=>p.name===current.name) ? 'Upgrade' : 'Switch'}
              </button>
            </div>
          )
        })}
      </div>

      <div className="flex items-start gap-2 p-3 rounded-xl bg-amber-50 border border-amber-200 mb-3">
        <AlertCircle size={14} className="text-amber-600 flex-shrink-0 mt-0.5"/>
        <div className="text-[11.5px] text-amber-900 leading-relaxed space-y-1">
          <p><b>How limits are credited:</b> monthly plans get the monthly allowance every month. Yearly plans get all 12 months' allowance credited once, upfront.</p>
          {!web && <p><b>Meta charges:</b> on WhatsApp service (UI) and BI messages the customer must add a payment card in Meta Business Manager. Meta's per-message charges apply on top of the plan price.</p>}
          <p>All prices are <b>exclusive of GST</b>, which is charged extra at checkout. Custom development is quoted and charged separately on every plan.</p>
        </div>
      </div>

      {/* Comparison */}
      <div style={{ border:'1px solid #e2e8f0', borderRadius:12, overflow:'hidden', marginBottom:12 }}>
        <button onClick={()=>setShowCompare(s=>!s)} className="w-full flex items-center justify-between px-4 py-3 bg-slate-50 hover:bg-slate-100 transition-colors text-left">
          <span style={{ fontSize:12, fontWeight:600, color:'#0f172a' }}>Compare all features</span>
          <ChevronDown size={15} className={clsx('text-slate-400 transition-transform', showCompare && 'rotate-180')}/>
        </button>
        {showCompare && (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px]">
              <thead>
                <tr className="border-y border-slate-200">
                  <th className={clsx(th, '!text-left w-[28%]')}>Feature</th>
                  {PLANS.map(p => <th key={p.id} className={th} style={{ color:p.color }}>{p.name}</th>)}
                </tr>
              </thead>
              <tbody>
                {groups.map(g => (
                  <Fragment key={g.group}>
                    <tr><td colSpan={5} className="px-3 py-2 bg-slate-50 border-y border-slate-100 text-[10px] font-bold text-slate-400 uppercase tracking-wider">{g.group}</td></tr>
                    {g.rows.map(r => (
                      <tr key={r.label} className="border-b border-slate-100 last:border-0">
                        <td className="px-3 py-2.5 text-xs font-medium text-slate-700">
                          {r.label}
                          {r.note && <span className="block text-[10px] font-normal text-slate-400">{r.note}</span>}
                        </td>
                        {r.v.map((v, i) => <td key={i} className="px-3 py-2.5 text-center text-xs"><FeatureCell v={v} yearly={yearly}/></td>)}
                      </tr>
                    ))}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add-ons */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-2.5 mb-3">
        <div style={{ border:'1px solid #e2e8f0', borderRadius:12, overflow:'hidden' }}>
          <div className="px-4 py-2.5 bg-slate-50 border-b border-slate-200">
            <p style={{ fontSize:12, fontWeight:600, color:'#0f172a' }}>Feature Add-ons</p>
            <p style={{ fontSize:11, color:'#94a3b8' }}>For plans that don't include the feature</p>
          </div>
          {featureAddons.map(a => (
            <div key={a.name} className="flex items-center gap-3 px-4 py-2.5 border-b border-slate-100 last:border-0">
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-slate-800">{a.name}{a.note && <span className="text-[10px] text-slate-400"> ({a.note})</span>}</p>
                <p className="text-[10px] text-slate-400">Available on {a.on}</p>
              </div>
              <span className="text-[11px] text-slate-500 whitespace-nowrap">Price on request</span>
            </div>
          ))}
        </div>

        <div style={{ border:'1px solid #e2e8f0', borderRadius:12, overflow:'hidden' }}>
          <div className="px-4 py-2.5 bg-slate-50 border-b border-slate-200">
            <p style={{ fontSize:12, fontWeight:600, color:'#0f172a' }}>Usage Add-ons</p>
            <p style={{ fontSize:11, color:'#94a3b8' }}>Pro &amp; AI plans only · indicative, excl. GST</p>
          </div>
          <div className="max-h-[360px] overflow-y-auto">
            {usageAddons.map(a => (
              <div key={a.name} className="flex items-center gap-3 px-4 py-2.5 border-b border-slate-100 last:border-0">
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-slate-800">{a.name}</p>
                  <p className="text-[10px] text-slate-400">{a.unit}</p>
                </div>
                <span className="text-xs font-semibold text-slate-800 whitespace-nowrap">{yearly ? `${inr(a.y)} / yr` : `${inr(a.m)} / mo`}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div>
        <p style={{ fontSize:12, fontWeight:600, color:'#0f172a', marginBottom:8 }}>Invoice History</p>
        <div style={{ border:'1px solid #e2e8f0', borderRadius:12, overflow:'hidden' }}>
          {INVOICES.map((inv,i)=>(
            <div key={inv.id} style={{ display:'flex', alignItems:'center', gap:14, padding:'12px 16px', flexWrap:'wrap',
              borderBottom: i<INVOICES.length-1?'1px solid #f1f5f9':'none', background: i%2===0?'#fff':'#f8fafc' }}>
              <span style={{ fontSize:13, fontWeight:600, color:'#0f172a', flex:1, fontFamily:'monospace' }}>{inv.id}</span>
              <span style={{ fontSize:12, color:'#64748b' }}>{inv.date}</span>
              <span style={{ fontSize:13, fontWeight:600, color:'#0f172a' }}>{inv.amount}<span style={{ fontSize:11, fontWeight:400, color:'#94a3b8' }}> · {inv.note}</span></span>
              <Badge color="#15803d" bg="#dcfce7">{inv.status}</Badge>
              <button style={{ border:'1px solid #e2e8f0', background:'#fff', borderRadius:7, padding:'5px 10px',
                cursor:'pointer', fontSize:12, color:'#374151', display:'flex', alignItems:'center', gap:4 }}>
                <Download size={12}/> PDF
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

/* ─── Security ────────────────────────────────────────────────────────────── */
const MOCK_SESSIONS = [
  { id:1, device:'Chrome on Windows', ip:'103.21.50.14', location:'Mumbai, IN',    current:true,  lastActive:'Now'      },
  { id:2, device:'Safari on iPhone',  ip:'49.36.99.102', location:'Delhi, IN',     current:false, lastActive:'3 hr ago' },
  { id:3, device:'Firefox on Mac',    ip:'74.125.0.99',  location:'Bangalore, IN', current:false, lastActive:'2 days ago' },
]

function SecuritySection() {
  const [saved, setSaved] = useState(false)
  const [twoFA, setTwoFA] = useState(true)
  const [ipWhitelist, setIpWhitelist] = useState(false)
  const [sessions, setSessions] = useState(MOCK_SESSIONS)
  const [ipList, setIpList] = useState('103.21.50.0/24\n192.168.1.0/24')
  const [pwForm, setPwForm] = useState({ current:'', newPw:'', confirm:'' })
  const pwf = (k,v)=>setPwForm(p=>({...p,[k]:v}))
  const [pwSaved, setPwSaved] = useState(false)

  function revokeSession(id) { setSessions(p=>p.filter(s=>s.id!==id)) }
  function saveSec() { setSaved(true); setTimeout(()=>setSaved(false),2500) }
  function savePw() { setPwSaved(true); setPwForm({current:'',newPw:'',confirm:''}); setTimeout(()=>setPwSaved(false),2500) }

  return (
    <div>
      <SectionHeader title="Security" desc="Manage authentication, active sessions, and access controls"/>

      <div style={{ border:'1px solid #e2e8f0', borderRadius:12, padding:12, marginBottom:10 }}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom: twoFA?10:0 }}>
          <div>
            <p style={{ fontSize:14, fontWeight:600, color:'#0f172a', margin:0 }}>Two-Factor Authentication (2FA)</p>
            <p style={{ fontSize:12, color:'#94a3b8', marginTop:2 }}>Require OTP verification on login for all team members</p>
          </div>
          <Toggle value={twoFA} onChange={setTwoFA}/>
        </div>
        {twoFA && (
          <div style={{ background:'#f0fdf4', border:'1px solid #bbf7d0', borderRadius:8, padding:'10px 14px', display:'flex', alignItems:'center', gap:8 }}>
            <CheckCircle2 size={16} color="#22c55e"/>
            <span style={{ fontSize:13, color:'#166534' }}>2FA is enabled. All admins must use an authenticator app.</span>
          </div>
        )}
      </div>

      <div style={{ border:'1px solid #e2e8f0', borderRadius:12, padding:12, marginBottom:10 }}>
        <p style={{ fontSize:12, fontWeight:600, color:'#0f172a', marginBottom:10 }}>Change Password</p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
          <Field label="Current Password"><Input value={pwForm.current} onChange={v=>pwf('current',v)} type="password" placeholder="••••••••"/></Field>
          <Field label="New Password"><Input value={pwForm.newPw} onChange={v=>pwf('newPw',v)} type="password" placeholder="••••••••"/></Field>
          <Field label="Confirm Password"><Input value={pwForm.confirm} onChange={v=>pwf('confirm',v)} type="password" placeholder="••••••••"/></Field>
        </div>
        <PrimaryBtn onClick={savePw}>{pwSaved?<><Check size={13}/> Updated!</>:<>Update Password</>}</PrimaryBtn>
      </div>

      <div style={{ border:'1px solid #e2e8f0', borderRadius:12, padding:16, marginBottom:16 }}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom: ipWhitelist?10:0 }}>
          <div>
            <p style={{ fontSize:14, fontWeight:600, color:'#0f172a', margin:0 }}>IP Whitelist</p>
            <p style={{ fontSize:12, color:'#94a3b8', marginTop:2 }}>Restrict login to specific IP addresses or CIDR ranges</p>
          </div>
          <Toggle value={ipWhitelist} onChange={setIpWhitelist}/>
        </div>
        {ipWhitelist && (
          <Field label="Allowed IPs / CIDR ranges (one per line)" hint="e.g. 103.21.50.14 or 192.168.1.0/24">
            <Textarea value={ipList} onChange={setIpList} rows={4}/>
          </Field>
        )}
      </div>

      <div style={{ border:'1px solid #e2e8f0', borderRadius:12, overflow:'hidden', marginBottom:10 }}>
        <div style={{ padding:'10px 14px', borderBottom:'1px solid #e2e8f0', background:'#f8fafc', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
          <p style={{ fontSize:12, fontWeight:600, color:'#0f172a', margin:0 }}>Active Sessions</p>
          <button onClick={()=>setSessions(p=>p.filter(s=>s.current))} style={{ fontSize:12, color:'#ef4444', background:'none', border:'none', cursor:'pointer', fontWeight:600 }}>
            Revoke All Others
          </button>
        </div>
        {sessions.map((s,i)=>(
          <div key={s.id} style={{ display:'flex', alignItems:'center', gap:12, padding:'12px 16px', borderBottom: i<sessions.length-1?'1px solid #f1f5f9':'none' }}>
            <div style={{ width:36, height:36, borderRadius:8, background: s.current?'#eff4ff':'#f8fafc', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
              <Activity size={16} color={s.current?'#0066ff':'#94a3b8'}/>
            </div>
            <div style={{ flex:1 }}>
              <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                <span style={{ fontSize:13, fontWeight:600, color:'#0f172a' }}>{s.device}</span>
                {s.current && <Badge color="#15803d" bg="#dcfce7">Current</Badge>}
              </div>
              <span style={{ fontSize:11, color:'#94a3b8' }}>{s.ip} · {s.location} · {s.lastActive}</span>
            </div>
            {!s.current && (
              <button onClick={()=>revokeSession(s.id)} style={{ fontSize:12, color:'#ef4444', background:'none', border:'1px solid #fecaca', borderRadius:7, padding:'5px 10px', cursor:'pointer', fontWeight:600 }}>
                Revoke
              </button>
            )}
          </div>
        ))}
      </div>
      <SaveBar onSave={saveSec} saved={saved}/>
    </div>
  )
}

/* ─── Audit Log ───────────────────────────────────────────────────────────── */
const AUDIT_EVENTS = [
  { id:1,  actor:'Rahul Mehta',  action:'Updated workspace settings',       target:'General',         time:'2 min ago',  ip:'103.21.50.14', type:'settings' },
  { id:2,  actor:'Priya Sharma', action:'Invited team member',              target:'vikram@chatflow.io',time:'18 min ago',ip:'49.36.99.102', type:'team'     },
  { id:3,  actor:'Rahul Mehta',  action:'Generated API key',                target:'Production Key',  time:'1 hr ago',   ip:'103.21.50.14', type:'api'      },
  { id:4,  actor:'Sneha Gupta',  action:'Published automation flow',        target:'Lead Capture',    time:'2 hr ago',   ip:'117.55.4.12',  type:'flow'     },
  { id:5,  actor:'Arjun Patel',  action:'Exported contact list',            target:'All Contacts',    time:'3 hr ago',   ip:'49.36.99.102', type:'data'     },
  { id:6,  actor:'Rahul Mehta',  action:'Changed billing plan',             target:'Starter → Growth',time:'1 day ago',  ip:'103.21.50.14', type:'billing'  },
  { id:7,  actor:'Priya Sharma', action:'Created canned response',          target:'/pricing',        time:'1 day ago',  ip:'49.36.99.102', type:'settings' },
  { id:8,  actor:'Rahul Mehta',  action:'Enabled two-factor authentication',target:'Security',        time:'2 days ago', ip:'103.21.50.14', type:'security' },
  { id:9,  actor:'System',       action:'SLA breach detected',              target:'Conv #2841',      time:'2 days ago', ip:'—',            type:'sla'      },
  { id:10, actor:'Vikram Singh', action:'Resolved conversation',            target:'Conv #2810',      time:'3 days ago', ip:'117.55.9.87',  type:'conv'     },
]
const AUDIT_TYPE_COLORS = {
  settings:{ c:'#0066ff', bg:'#eff4ff' }, team:{ c:'#0ea5e9', bg:'#e0f2fe' },
  api:{ c:'#8b5cf6', bg:'#f5f3ff' },      flow:{ c:'#22c55e', bg:'#dcfce7' },
  data:{ c:'#f59e0b', bg:'#fef3c7' },     billing:{ c:'#ef4444', bg:'#fee2e2' },
  security:{ c:'#dc2626', bg:'#fee2e2' }, sla:{ c:'#f97316', bg:'#ffedd5' },
  conv:{ c:'#64748b', bg:'#f1f5f9' },
}

function AuditSection() {
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState('all')

  const filtered = AUDIT_EVENTS.filter(e=>{
    const matchSearch = !search || e.actor.toLowerCase().includes(search.toLowerCase()) || e.action.toLowerCase().includes(search.toLowerCase())
    const matchType = typeFilter==='all' || e.type===typeFilter
    return matchSearch && matchType
  })

  const types = ['all',...new Set(AUDIT_EVENTS.map(e=>e.type))]

  return (
    <div>
      <SectionHeader title="Audit Log" desc="Track all actions performed in your workspace"/>
      <div style={{ display:'flex', gap:10, marginBottom:16, alignItems:'center' }}>
        <div style={{ flex:1, position:'relative' }}>
          <Search size={14} style={{ position:'absolute', left:10, top:'50%', transform:'translateY(-50%)', color:'#94a3b8' }}/>
          <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search by actor or action..."
            style={{ width:'100%', border:'1px solid #e2e8f0', borderRadius:8, padding:'6px 12px 6px 32px', fontSize:12, outline:'none', boxSizing:'border-box' }}
            onFocus={e=>e.target.style.borderColor='#0066ff'} onBlur={e=>e.target.style.borderColor='#e2e8f0'}
          />
        </div>
        <div style={{ width:160, flexShrink:0 }}>
          <Select
            value={typeFilter}
            onChange={v=>setTypeFilter(v)}
            options={types.map(t=>({ value: t, label: t==='all'?'All Types':t }))}
            size="sm"
          />
        </div>
        <GhostBtn><Download size={12}/> Export CSV</GhostBtn>
      </div>

      <div style={{ border:'1px solid #e2e8f0', borderRadius:12, overflow:'hidden' }}>
        <div style={{ overflowX:'auto' }}>
        <div style={{ display:'grid', gridTemplateColumns:'2fr 2fr 1.5fr 1fr 1fr', gap:12, padding:'9px 16px', minWidth:520,
          background:'#f8fafc', borderBottom:'1px solid #e2e8f0' }}>
          {['Actor','Action','Target','Time','IP'].map(h=>(
            <span key={h} style={{ fontSize:11, fontWeight:700, color:'#94a3b8', textTransform:'uppercase', letterSpacing:'0.04em' }}>{h}</span>
          ))}
        </div>
        {filtered.map((e,i)=>(
          <div key={e.id} style={{ display:'grid', gridTemplateColumns:'2fr 2fr 1.5fr 1fr 1fr', gap:12, minWidth:520,
            padding:'11px 16px', alignItems:'center', borderTop:'1px solid #f1f5f9',
            background: i%2===0?'#fff':'#f8fafc' }}>
            <div style={{ display:'flex', alignItems:'center', gap:8 }}>
              <div style={{ width:28, height:28, borderRadius:'50%', background:'#0066ff',
                display:'flex', alignItems:'center', justifyContent:'center', fontSize:11, fontWeight:700, color:'#fff', flexShrink:0 }}>
                {e.actor==='System'?'⚙':e.actor.split(' ').map(w=>w[0]).join('').slice(0,2)}
              </div>
              <span style={{ fontSize:12, fontWeight:600, color:'#0f172a' }}>{e.actor}</span>
            </div>
            <div style={{ display:'flex', alignItems:'center', gap:6 }}>
              <Badge color={AUDIT_TYPE_COLORS[e.type]?.c||'#64748b'} bg={AUDIT_TYPE_COLORS[e.type]?.bg||'#f1f5f9'}>{e.type}</Badge>
              <span style={{ fontSize:12, color:'#374151' }}>{e.action}</span>
            </div>
            <span style={{ fontSize:12, color:'#64748b', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{e.target}</span>
            <span style={{ fontSize:12, color:'#94a3b8' }}>{e.time}</span>
            <span style={{ fontSize:11, color:'#94a3b8', fontFamily:'monospace' }}>{e.ip}</span>
          </div>
        ))}
        {filtered.length===0 && <div style={{ textAlign:'center', padding:'28px 0', color:'#94a3b8', fontSize:13 }}>No events found</div>}
        </div>
      </div>
    </div>
  )
}

/* ─── Section map ─────────────────────────────────────────────────────────── */
/* ─── Language ────────────────────────────────────────────────────────────── */
const ALL_LANGS = ['English','Hindi','Arabic','French','Spanish','German','Nepali','Sanskrit','Tamil','Telugu','Malay','Indonesian']

function LanguageSection() {
  const { botLangs, setBotLangs, botDefaultLang, setBotDefaultLang, botMultiLingual, setBotMultiLingual } = useContext(BotCtx)
  const [addLang,       setAddLang]       = useState('')
  const [prefStatement, setPrefStatement] = useState('Please choose a language of your preference.')
  const [confirmRemove, setConfirmRemove] = useState(null)
  const [saved,         setSaved]         = useState(false)
  const save = () => { setSaved(true); setTimeout(()=>setSaved(false), 2500) }

  function doRemove() { setBotLangs(p=>p.filter(x=>x!==confirmRemove)); setConfirmRemove(null) }
  function addLanguage() {
    if (addLang && !botLangs.includes(addLang)) setBotLangs(p=>[...p,addLang])
    setAddLang('')
  }

  return (
    <div>
      <SectionHeader title="Language" desc="Configure the languages your bot supports and communicates in."/>

      {/* Remove confirmation overlay */}
      {confirmRemove && (
        <div style={{ position:'fixed', inset:0, background:'rgba(15,23,42,0.5)', display:'flex',
          alignItems:'center', justifyContent:'center', zIndex:9999, padding:16 }}>
          <div style={{ background:'#fff', borderRadius:16, padding:24, maxWidth:400, width:'100%',
            boxShadow:'0 24px 80px rgba(0,0,0,0.2)' }}>
            <div style={{ display:'flex', alignItems:'flex-start', gap:14, marginBottom:16 }}>
              <div style={{ width:42, height:42, borderRadius:12, background:'#fef2f2', flexShrink:0,
                display:'flex', alignItems:'center', justifyContent:'center' }}>
                <X size={20} color="#ef4444"/>
              </div>
              <div>
                <p style={{ fontSize:14, fontWeight:700, color:'#0f172a', margin:'0 0 3px' }}>Remove "{confirmRemove}"?</p>
                <p style={{ fontSize:12, color:'#64748b', margin:0 }}>This will affect your bot's language configuration.</p>
              </div>
            </div>
            <div style={{ background:'#fef2f2', border:'1px solid #fecaca', borderRadius:10,
              padding:'10px 14px', marginBottom:20 }}>
              <p style={{ fontSize:11, fontWeight:700, color:'#dc2626', margin:'0 0 6px', textTransform:'uppercase', letterSpacing:'0.04em' }}>Consequences</p>
              <ul style={{ fontSize:12, color:'#374151', margin:0, paddingLeft:16, lineHeight:2 }}>
                <li>Users who selected <strong>{confirmRemove}</strong> will fall back to <strong>{botDefaultLang}</strong></li>
                <li>The bot's <strong>{confirmRemove}</strong> restart message will be deleted</li>
                <li>The <strong>{confirmRemove}</strong> end-of-conversation message will be deleted</li>
              </ul>
            </div>
            <div style={{ display:'flex', gap:10, justifyContent:'flex-end' }}>
              <GhostBtn onClick={()=>setConfirmRemove(null)}>Cancel</GhostBtn>
              <GhostBtn danger onClick={doRemove}>Remove Language</GhostBtn>
            </div>
          </div>
        </div>
      )}

      {/* Bot Language toggle */}
      <CollapsibleCard title="Bot Language">
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'8px 0' }}>
          <div>
            <p style={{ fontSize:13, fontWeight:500, color:'#0f172a', margin:0 }}>Multi-lingual Bot</p>
            <p style={{ fontSize:11, color:'#94a3b8', marginTop:2 }}>Allow the bot to detect and respond in multiple languages</p>
          </div>
          <Toggle value={botMultiLingual} onChange={setBotMultiLingual}/>
        </div>
      </CollapsibleCard>

      {/* Default language */}
      <CollapsibleCard title="Default Language" badge={botDefaultLang}>
        <Field label="Primary Language" hint="Used when the bot starts a conversation or the user's language is unknown">
          <SettingsSelect value={botDefaultLang} onChange={setBotDefaultLang} options={ALL_LANGS}/>
        </Field>
      </CollapsibleCard>

      {/* Supported languages */}
      <CollapsibleCard title="Supported Languages" badge={`${botLangs.length} added`}>
        <Field label="Add Language" hint="Additional languages this bot can handle">
          <div style={{ display:'flex', gap:8, alignItems:'center' }}>
            <div style={{ flex:1 }}>
              <SettingsSelect value={addLang} onChange={setAddLang}
                options={[{v:'',l:'Select language…'},...ALL_LANGS.filter(l=>!botLangs.includes(l)).map(l=>({v:l,l}))]}/>
            </div>
            <PrimaryBtn onClick={addLanguage}>Add</PrimaryBtn>
          </div>
        </Field>
        {botLangs.length > 0 && (
          <div style={{ display:'flex', flexWrap:'wrap', gap:6, marginTop:4 }}>
            {botLangs.map(l => (
              <span key={l} style={{ display:'inline-flex', alignItems:'center', gap:5, padding:'4px 10px 4px 12px',
                background: l===botDefaultLang ? '#eff6ff' : '#f8fafc',
                border:`1px solid ${l===botDefaultLang?'#bfdbfe':'#e2e8f0'}`,
                borderRadius:20, fontSize:12, color: l===botDefaultLang?'#1d4ed8':'#374151',
                fontWeight: l===botDefaultLang ? 600 : 400 }}>
                {l}
                {l===botDefaultLang
                  ? <span style={{ fontSize:9, fontWeight:700, background:'#0066ff', color:'#fff',
                      padding:'1px 6px', borderRadius:10, marginLeft:2 }}>DEFAULT</span>
                  : <button onClick={()=>setConfirmRemove(l)} style={{ background:'none', border:'none',
                      cursor:'pointer', padding:'1px 0 0 2px', color:'#94a3b8', display:'flex', alignItems:'center' }}>
                      <X size={11}/>
                    </button>
                }
              </span>
            ))}
          </div>
        )}
      </CollapsibleCard>

      {/* Preference statement */}
      <CollapsibleCard title="Language Selection Message" defaultOpen={false}>
        <Field label="Preference Statement" hint="Shown when asking the user to choose their preferred language">
          <Textarea value={prefStatement} onChange={setPrefStatement} rows={3}/>
        </Field>
      </CollapsibleCard>

      <SaveBar onSave={save} saved={saved}/>
    </div>
  )
}

/* ─── WhatsApp Conversations ─────────────────────────────────────────────── */
function WAConversationsSection() {
  const { botLangs, botDefaultLang } = useContext(BotCtx)
  const langs = botLangs.length > 0 ? botLangs : ['English']

  const [cmds,           setCmds]           = useState(['Menu','hi','Hello'])
  const [newCmd,         setNewCmd]         = useState('')
  const [anyKeyword,     setAnyKeyword]     = useState(false)
  const [restartMsgs,    setRestartMsgs]    = useState({ English:'Type *Menu* anytime to start from beginning.' })
  const [endMsgs,        setEndMsgs]        = useState({ English:'You have reached the end of the flow' })
  const [activeLang,     setActiveLang]     = useState(botDefaultLang||'English')
  const [saved,          setSaved]          = useState(false)
  const save = () => { setSaved(true); setTimeout(()=>setSaved(false), 2500) }

  const addCmd = () => {
    const v = newCmd.trim()
    if (v && !cmds.includes(v)) setCmds(p=>[...p,v])
    setNewCmd('')
  }

  return (
    <div>
      <SectionHeader title="WhatsApp Conversations" desc="Configure restart commands and per-language conversation messages."/>

      {/* Flow Restart Commands */}
      <CollapsibleCard title="Flow Restart Commands" badge={`${cmds.length} keywords`}>
        {/* New user any-keyword toggle */}
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between',
          padding:'8px 0 12px', borderBottom:'1px solid #f1f5f9', marginBottom:12 }}>
          <div>
            <p style={{ fontSize:13, fontWeight:500, color:'#0f172a', margin:0 }}>New User — Start with Any Keyword</p>
            <p style={{ fontSize:11, color:'#94a3b8', marginTop:2 }}>
              When enabled, new users will trigger the flow by sending any message, not just the listed keywords
            </p>
          </div>
          <Toggle value={anyKeyword} onChange={setAnyKeyword}/>
        </div>

        <Field label="Keywords" hint="Existing users can type any of these to restart the conversation from the beginning">
          <div style={{ display:'flex', gap:8, alignItems:'center' }}>
            <Input value={newCmd} onChange={setNewCmd} placeholder="Type a keyword and press Add…"/>
            <PrimaryBtn onClick={addCmd}>Add</PrimaryBtn>
          </div>
        </Field>
        {cmds.length > 0 && (
          <div style={{ display:'flex', flexWrap:'wrap', gap:6, marginTop:6 }}>
            {cmds.map(c=>(
              <span key={c} style={{ display:'inline-flex', alignItems:'center', gap:5, padding:'4px 10px 4px 12px',
                background:'#f8fafc', border:'1px solid #e2e8f0', borderRadius:20, fontSize:12, color:'#374151' }}>
                {c}
                <button onClick={()=>setCmds(p=>p.filter(x=>x!==c))}
                  style={{ background:'none', border:'none', cursor:'pointer', padding:'1px 0 0', color:'#94a3b8', display:'flex', alignItems:'center' }}>
                  <X size={11}/>
                </button>
              </span>
            ))}
          </div>
        )}
      </CollapsibleCard>

      {/* Per-language messages */}
      <CollapsibleCard title="Conversation Messages" badge={langs.length > 1 ? `${langs.length} languages` : null}>
        {/* Language tabs */}
        {langs.length > 1 && (
          <div style={{ display:'flex', borderBottom:'1px solid #e2e8f0', marginBottom:14, overflowX:'auto', margin:'0 -14px 14px' }}>
            {langs.map(lang=>(
              <button key={lang} onClick={()=>setActiveLang(lang)} style={{
                padding:'7px 14px', border:'none', flexShrink:0,
                borderBottom: activeLang===lang ? '2px solid #0066ff' : '2px solid transparent',
                background:'none', fontSize:12,
                fontWeight: activeLang===lang ? 600 : 500,
                color: activeLang===lang ? '#0066ff' : '#64748b',
                cursor:'pointer', marginBottom:-1, display:'flex', alignItems:'center', gap:5 }}>
                {lang}
                {lang===botDefaultLang && (
                  <span style={{ fontSize:9, fontWeight:700, background:'#0066ff', color:'#fff',
                    padding:'1px 5px', borderRadius:8 }}>DEFAULT</span>
                )}
              </button>
            ))}
          </div>
        )}
        <Field label="Conversation Restart Statement" hint="Sent immediately after a restart command is detected">
          <Textarea value={restartMsgs[activeLang]||''} onChange={v=>setRestartMsgs(p=>({...p,[activeLang]:v}))} rows={3}/>
        </Field>
        <Field label="End of Conversation Statement" hint="Shown when the user reaches the end of the flow">
          <Textarea value={endMsgs[activeLang]||''} onChange={v=>setEndMsgs(p=>({...p,[activeLang]:v}))} rows={3}/>
        </Field>
      </CollapsibleCard>

      <SaveBar onSave={save} saved={saved}/>
    </div>
  )
}

/* ─── WhatsApp Automation ────────────────────────────────────────────────── */
function WAAutomationSection() {
  const [editTab,     setEditTab]     = useState(null) // null | 'icebreakers' | 'commands'
  const [icebreakers, setIcebreakers] = useState(['im interested','im not interested'])
  const [commands,    setCommands]    = useState([
    { text:'/deepak', desc:'deeeeeeeeeeeeeeeeee' },
    { text:'/suryaf', desc:'sssssssssssssss'     },
  ])
  const [saved, setSaved] = useState(false)
  const save = () => { setSaved(true); setEditTab(null); setTimeout(()=>setSaved(false), 2500) }

  function WaPreview() {
    return (
      <div style={{ width:190, flexShrink:0, border:'1px solid #e2e8f0', borderRadius:14,
        overflow:'hidden', boxShadow:'0 2px 12px rgba(0,0,0,0.08)', alignSelf:'flex-start' }}>
        <div style={{ background:'#075E54', color:'#fff', padding:'10px 12px', display:'flex', alignItems:'center', gap:8 }}>
          <div style={{ width:30, height:30, borderRadius:'50%', background:'#0066ff',
            display:'flex', alignItems:'center', justifyContent:'center', fontSize:10, fontWeight:800 }}>SB</div>
          <div>
            <div style={{ fontWeight:700, fontSize:11 }}>SmatBot</div>
            <div style={{ fontSize:9, opacity:0.8 }}>914 04 9520 079x</div>
          </div>
        </div>
        <div style={{ background:'#ECE5DD', minHeight:160, padding:10 }}>
          {editTab==='icebreakers' && icebreakers.filter(Boolean).map((ib,i)=>(
            <div key={i} style={{ display:'flex', justifyContent:'flex-end', marginBottom:6 }}>
              <div style={{ background:'#fff', borderRadius:'10px 2px 10px 10px', padding:'5px 10px 5px 12px',
                fontSize:11, display:'flex', alignItems:'center', gap:7, maxWidth:150,
                boxShadow:'0 1px 2px rgba(0,0,0,0.08)' }}>
                <span>{ib}</span>
                <span style={{ color:'#25D366', fontSize:18, lineHeight:1 }}>›</span>
              </div>
            </div>
          ))}
          {editTab==='commands' && (
            <div style={{ background:'#fff', borderRadius:8, overflow:'hidden', boxShadow:'0 1px 3px rgba(0,0,0,0.08)' }}>
              {commands.filter(c=>c.text).map((c,i)=>(
                <div key={i} style={{ padding:'6px 10px', borderBottom:i<commands.filter(x=>x.text).length-1?'1px solid #f1f5f9':'none' }}>
                  <div style={{ fontWeight:700, fontSize:11 }}>{c.text}</div>
                  <div style={{ fontSize:10, color:'#64748b' }}>{c.desc}</div>
                </div>
              ))}
            </div>
          )}
        </div>
        <div style={{ background:'#f0f0f0', padding:'6px 10px', display:'flex', alignItems:'center', gap:6 }}>
          <span style={{ fontSize:18 }}>☺</span>
          <div style={{ flex:1, background:'#fff', borderRadius:20, padding:'4px 10px', fontSize:10, color:'#94a3b8' }}>
            {editTab==='commands' ? '/' : 'Message'}
          </div>
          <span style={{ fontSize:14 }}>📎</span>
        </div>
        <div style={{ fontSize:9, color:'#94a3b8', textAlign:'center', padding:'4px 8px 6px', background:'#fafafa' }}>
          This experience may look different across devices.
        </div>
      </div>
    )
  }

  return (
    <div>
      <SectionHeader title="Automation Settings"
        desc="Automations that can enhance conversational experiences. Using AI can help make these components more efficient."/>

      {/* Edit modal */}
      {editTab && (
        <div style={{ position:'fixed', inset:0, background:'rgba(15,23,42,0.5)', display:'flex',
          alignItems:'center', justifyContent:'center', zIndex:9999, padding:16 }}>
          <div style={{ background:'#fff', borderRadius:16, width:780, maxWidth:'100%', maxHeight:'92vh',
            display:'flex', flexDirection:'column', boxShadow:'0 24px 80px rgba(0,0,0,0.22)' }}>

            {/* Modal header */}
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between',
              padding:'14px 20px', borderBottom:'1px solid #e2e8f0', flexShrink:0 }}>
              <p style={{ fontSize:14, fontWeight:700, color:'#0f172a', margin:0 }}>Conversational components</p>
              <button onClick={()=>setEditTab(null)} style={{ background:'none', border:'none', cursor:'pointer',
                color:'#64748b', padding:4, borderRadius:6, display:'flex', alignItems:'center' }}>
                <X size={16}/>
              </button>
            </div>

            {/* Modal tabs */}
            <div style={{ display:'flex', padding:'0 20px', borderBottom:'1px solid #e2e8f0', flexShrink:0 }}>
              {[['icebreakers','Icebreakers'],['commands','Commands']].map(([id,label])=>(
                <button key={id} onClick={()=>setEditTab(id)} style={{ padding:'10px 16px', border:'none',
                  borderBottom: editTab===id ? '2px solid #0066ff' : '2px solid transparent',
                  background:'none', fontSize:13, fontWeight: editTab===id ? 600 : 500,
                  color: editTab===id ? '#0066ff' : '#64748b', cursor:'pointer', marginBottom:-1 }}>
                  {label}
                </button>
              ))}
            </div>

            {/* Modal body */}
            <div style={{ flex:1, overflowY:'auto', padding:20, display:'flex', gap:20, minHeight:0 }}>
              <div style={{ flex:1 }}>
                {editTab==='icebreakers' && (
                  <>
                    <p style={{ fontSize:13, fontWeight:600, color:'#0f172a', margin:'0 0 4px' }}>Icebreakers</p>
                    <p style={{ fontSize:12, color:'#64748b', margin:'0 0 16px' }}>
                      To start using icebreakers, read{' '}
                      <span style={{ color:'#0066ff', textDecoration:'underline', cursor:'pointer' }}>how to set up icebreakers</span>.
                      {' '}Then, you can fill in the fields on this page.
                    </p>
                    {icebreakers.map((ib,i)=>(
                      <Field key={i} label={`Icebreaker ${i+1}`}>
                        <div style={{ display:'flex', gap:6, alignItems:'center' }}>
                          <div style={{ position:'relative', flex:1 }}>
                            <Input value={ib} onChange={v=>setIcebreakers(p=>p.map((x,j)=>j===i?v:x))}/>
                            <span style={{ position:'absolute', right:10, top:'50%', transform:'translateY(-50%)',
                              fontSize:10, color:'#94a3b8', pointerEvents:'none' }}>{ib.length}/80</span>
                          </div>
                          <button onClick={()=>setIcebreakers(p=>p.filter((_,j)=>j!==i))}
                            style={{ background:'none', border:'none', cursor:'pointer', color:'#94a3b8', padding:4 }}>
                            <X size={14}/>
                          </button>
                        </div>
                      </Field>
                    ))}
                    <button onClick={()=>setIcebreakers(p=>[...p,''])}
                      style={{ display:'flex', alignItems:'center', gap:5, background:'none', border:'none',
                        color:'#0066ff', fontSize:12, fontWeight:600, cursor:'pointer', padding:'4px 0', marginTop:4 }}>
                      <Plus size={13}/> Add icebreaker
                    </button>
                  </>
                )}
                {editTab==='commands' && (
                  <>
                    <p style={{ fontSize:13, fontWeight:600, color:'#0f172a', margin:'0 0 4px' }}>Commands</p>
                    <p style={{ fontSize:12, color:'#64748b', margin:'0 0 2px' }}>
                      To start using commands, read{' '}
                      <span style={{ color:'#0066ff', textDecoration:'underline', cursor:'pointer' }}>how to set up commands</span>.
                      {' '}Then, you can fill in the fields on this page.
                    </p>
                    <p style={{ fontSize:12, color:'#64748b', margin:'0 0 16px' }}>You must use a / before each keyword.</p>
                    {commands.map((c,i)=>(
                      <div key={i} style={{ background:'#f8fafc', border:'1px solid #e2e8f0', borderRadius:10,
                        padding:12, marginBottom:8, display:'flex', gap:8, alignItems:'flex-start' }}>
                        <GripVertical size={13} style={{ color:'#cbd5e1', cursor:'grab', marginTop:10, flexShrink:0 }}/>
                        <div style={{ flex:1 }}>
                          <Field label="Command text">
                            <div style={{ position:'relative' }}>
                              <Input value={c.text} onChange={v=>setCommands(p=>p.map((x,j)=>j===i?{...x,text:v}:x))}/>
                              <span style={{ position:'absolute', right:10, top:'50%', transform:'translateY(-50%)',
                                fontSize:10, color:'#94a3b8', pointerEvents:'none' }}>{c.text.length}/32</span>
                            </div>
                          </Field>
                          <Field label="Command description">
                            <div style={{ position:'relative' }}>
                              <Input value={c.desc} onChange={v=>setCommands(p=>p.map((x,j)=>j===i?{...x,desc:v}:x))}/>
                              <span style={{ position:'absolute', right:10, top:'50%', transform:'translateY(-50%)',
                                fontSize:10, color:'#94a3b8', pointerEvents:'none' }}>{c.desc.length}/256</span>
                            </div>
                          </Field>
                        </div>
                        <button onClick={()=>setCommands(p=>p.filter((_,j)=>j!==i))}
                          style={{ background:'none', border:'none', cursor:'pointer', color:'#94a3b8', padding:4, marginTop:2 }}>
                          <X size={13}/>
                        </button>
                      </div>
                    ))}
                    <button onClick={()=>setCommands(p=>[...p,{text:'/',desc:''}])}
                      style={{ display:'flex', alignItems:'center', gap:5, background:'none', border:'none',
                        color:'#0066ff', fontSize:12, fontWeight:600, cursor:'pointer', padding:'4px 0', marginTop:4 }}>
                      <Plus size={13}/> Add command
                    </button>
                  </>
                )}
              </div>
              <WaPreview/>
            </div>

            {/* Modal footer */}
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center',
              padding:'12px 20px', borderTop:'1px solid #e2e8f0', flexShrink:0 }}>
              <GhostBtn onClick={()=>setEditTab(null)}>Cancel</GhostBtn>
              <PrimaryBtn onClick={save}>Save</PrimaryBtn>
            </div>
          </div>
        </div>
      )}

      {/* Component list card */}
      <CollapsibleCard title="Conversational Components">
        <p style={{ fontSize:11, color:'#64748b', margin:'0 0 12px' }}>
          Automations that enhance conversational experiences.{' '}
          <span style={{ color:'#0066ff', cursor:'pointer' }}>Using AI</span> can make these more efficient.
        </p>

        {/* Icebreakers row */}
        <div style={{ display:'flex', alignItems:'center', gap:12, padding:'12px 0',
          borderBottom:'1px solid #f1f5f9' }}>
          <div style={{ width:34, height:34, borderRadius:9, background:'#eff6ff', flexShrink:0,
            display:'flex', alignItems:'center', justifyContent:'center' }}>
            <MessageSquare size={15} color="#0066ff"/>
          </div>
          <div style={{ flex:1 }}>
            <p style={{ fontSize:13, fontWeight:600, color:'#0f172a', margin:0 }}>Icebreakers</p>
            <p style={{ fontSize:11, color:'#64748b', marginTop:1 }}>
              Common questions people can easily ask.{' '}
              <span style={{ color:'#0066ff', cursor:'pointer', textDecoration:'underline' }}>Learn more</span>
            </p>
          </div>
          <GhostBtn onClick={()=>setEditTab('icebreakers')} small>Edit</GhostBtn>
        </div>

        {/* Commands row */}
        <div style={{ display:'flex', alignItems:'center', gap:12, padding:'12px 0 2px' }}>
          <div style={{ width:34, height:34, borderRadius:9, background:'#f0fdf4', flexShrink:0,
            display:'flex', alignItems:'center', justifyContent:'center' }}>
            <Code size={15} color="#16a34a"/>
          </div>
          <div style={{ flex:1 }}>
            <p style={{ fontSize:13, fontWeight:600, color:'#0f172a', margin:0 }}>Commands</p>
            <p style={{ fontSize:11, color:'#64748b', marginTop:1 }}>
              Special keywords that tell the bot what to do.{' '}
              <span style={{ color:'#0066ff', cursor:'pointer', textDecoration:'underline' }}>Learn more</span>
            </p>
          </div>
          <GhostBtn onClick={()=>setEditTab('commands')} small>Edit</GhostBtn>
        </div>
      </CollapsibleCard>

      <FollowUpMessagesCard/>

      {saved && (
        <div style={{ display:'flex', justifyContent:'flex-end', paddingTop:10 }}>
          <span style={{ fontSize:12, color:'#22c55e', display:'flex', alignItems:'center', gap:5 }}>
            <CheckCircle2 size={13}/> Saved successfully
          </span>
        </div>
      )}
    </div>
  )
}

/* ─── Follow-up Messages — re-engage contacts who go quiet ──────────────── */
const FOLLOWUP_TRIGGERS = [
  { v:'left_chat', l:'User left the chat', desc:'Sent when the contact closes or leaves the conversation without it being marked resolved.' },
  { v:'idle',      l:'User is idle',       desc:"Sent when the contact hasn't sent a message for the selected duration." },
  { v:'no_reply',  l:'No reply to last message', desc:'Sent when your last message goes unanswered for the selected duration.' },
]
const FOLLOWUP_TRIGGER_DESC = Object.fromEntries(FOLLOWUP_TRIGGERS.map(t => [t.v, t.desc]))

function FollowUpMessagesCard() {
  const [enabled, setEnabled] = useState(true)
  const [rules, setRules] = useState([
    { id:1, trigger:'left_chat', enabled:true,  delay:30, unit:'minutes', message:"Hey! Just checking in — are you still there? Let me know if you need anything 😊" },
    { id:2, trigger:'idle',      enabled:true,  delay:2,  unit:'hours',   message:"Still around? I'm here whenever you're ready to continue 👋" },
    { id:3, trigger:'no_reply',  enabled:false, delay:24, unit:'hours',   message:"Just following up on my last message — happy to help whenever you're ready!" },
  ])
  const [saved, setSaved] = useState(false)
  function save() { setSaved(true); setTimeout(()=>setSaved(false), 2500) }
  function updateRule(id, patch) { setRules(p => p.map(r => r.id===id ? {...r, ...patch} : r)) }
  function removeRule(id) { setRules(p => p.filter(r => r.id!==id)) }
  function addRule() { setRules(p => [...p, { id: Date.now(), trigger:'idle', enabled:true, delay:1, unit:'hours', message:'' }]) }

  return (
    <CollapsibleCard title="Follow-up Messages" badge={enabled ? `${rules.filter(r=>r.enabled).length} active` : 'Off'}>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', paddingBottom:12, marginBottom:12, borderBottom:'1px solid #f1f5f9' }}>
        <div>
          <p style={{ fontSize:13, fontWeight:600, color:'#0f172a', margin:0 }}>Enable follow-up messages</p>
          <p style={{ fontSize:11, color:'#64748b', marginTop:2, maxWidth:420 }}>
            Automatically re-engage contacts who go quiet. Add as many triggers as you need — each can have its own wait time and message.
          </p>
        </div>
        <Toggle value={enabled} onChange={setEnabled}/>
      </div>

      {enabled && (
        <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
          {rules.map(r => (
            <div key={r.id} style={{ border:'1px solid #e2e8f0', borderRadius:10, padding:12, opacity: r.enabled ? 1 : 0.55, transition:'opacity 0.15s' }}>
              <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:2 }}>
                <div style={{ display:'flex', alignItems:'center', gap:8, flex:1, minWidth:0 }}>
                  <div style={{ width:28, height:28, borderRadius:8, background:'#eff4ff', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                    <Timer size={13} color="#0066ff"/>
                  </div>
                  <div style={{ flex:1, minWidth:0, maxWidth:220 }}>
                    <SettingsSelect value={r.trigger} onChange={v=>updateRule(r.id,{trigger:v})}
                      options={FOLLOWUP_TRIGGERS.map(t=>({v:t.v,l:t.l}))}/>
                  </div>
                </div>
                <div style={{ display:'flex', alignItems:'center', gap:8, flexShrink:0 }}>
                  <Toggle value={r.enabled} onChange={v=>updateRule(r.id,{enabled:v})}/>
                  <button onClick={()=>removeRule(r.id)} style={{ background:'none', border:'none', cursor:'pointer', color:'#94a3b8', padding:4 }}>
                    <Trash2 size={13}/>
                  </button>
                </div>
              </div>
              <p style={{ fontSize:10, color:'#94a3b8', margin:'4px 0 10px' }}>{FOLLOWUP_TRIGGER_DESC[r.trigger]}</p>
              <div className="grid grid-cols-1 sm:grid-cols-[90px_110px_1fr] gap-2.5">
                <Field label="Wait"><Input type="number" value={r.delay} onChange={v=>updateRule(r.id,{delay: v === '' ? '' : +v})}/></Field>
                <Field label="Unit">
                  <SettingsSelect value={r.unit} onChange={v=>updateRule(r.id,{unit:v})}
                    options={[{v:'minutes',l:'Minutes'},{v:'hours',l:'Hours'},{v:'days',l:'Days'}]}/>
                </Field>
                <Field label="Follow-up message">
                  <Textarea rows={2} value={r.message} onChange={v=>updateRule(r.id,{message:v})} placeholder="What should we send?"/>
                </Field>
              </div>
            </div>
          ))}
          <button onClick={addRule}
            style={{ display:'flex', alignItems:'center', gap:5, background:'none', border:'none',
              color:'#0066ff', fontSize:12, fontWeight:600, cursor:'pointer', padding:'4px 0' }}>
            <Plus size={13}/> Add follow-up trigger
          </button>
        </div>
      )}

      <SaveBar onSave={save} saved={saved}/>
    </CollapsibleCard>
  )
}

/* ─── Member Multi-Select ────────────────────────────────────────────────── */
function MemberMultiSelect({ value, onChange, members, accentColor }) {
  const [open,  setOpen]  = useState(false)
  const [query, setQuery] = useState('')
  const ref       = useRef(null)
  const searchRef = useRef(null)

  useEffect(() => {
    if (!open) return
    setTimeout(() => searchRef.current?.focus(), 30)
    function handler(e) { if (!ref.current?.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  const filtered = members.filter(m =>
    m.name.toLowerCase().includes(query.toLowerCase()) ||
    m.role.toLowerCase().includes(query.toLowerCase())
  )
  const selected = members.filter(m => value.includes(m.id))

  function toggle(id) {
    onChange(value.includes(id) ? value.filter(x => x !== id) : [...value, id])
  }

  return (
    <div className="relative" ref={ref}>
      {/* Trigger */}
      <button type="button" onClick={() => setOpen(p => !p)}
        className={`w-full flex items-center justify-between gap-2 border rounded-lg px-2.5 py-2 text-left transition-all min-h-[38px] ${open ? 'border-primary ring-2 ring-primary/10 bg-white' : 'border-surface-border bg-white hover:border-primary/40'}`}>
        <div className="flex flex-wrap gap-1 flex-1 min-w-0">
          {selected.length === 0
            ? <span className="text-[12px] text-slate-300">Select members…</span>
            : <>
                {selected.slice(0, 4).map(m => (
                  <span key={m.id} className="inline-flex items-center gap-1 text-[10px] font-semibold text-white rounded-full pl-1 pr-1.5 py-0.5 leading-none"
                    style={{ background: accentColor }}>
                    <span className="w-4 h-4 rounded-full bg-white/25 flex items-center justify-center text-[9px] font-bold">{m.avatar}</span>
                    {m.name.split(' ')[0]}
                    <button type="button" onClick={e => { e.stopPropagation(); toggle(m.id) }}
                      className="ml-0.5 opacity-70 hover:opacity-100 leading-none">×</button>
                  </span>
                ))}
                {selected.length > 4 && (
                  <span className="text-[11px] text-slate-500 self-center">+{selected.length - 4} more</span>
                )}
              </>
          }
        </div>
        <ChevronDown size={13} className={`flex-shrink-0 text-slate-400 transition-transform duration-150 ${open ? 'rotate-180' : ''}`}/>
      </button>

      {/* Dropdown — opens upward to stay inside modal */}
      {open && (
        <div className="absolute bottom-full left-0 right-0 mb-1 bg-white border border-surface-border rounded-xl shadow-modal overflow-hidden z-20">
          {/* Search */}
          <div className="p-2 border-b border-surface-border">
            <div className="relative">
              <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-300 pointer-events-none"/>
              <input ref={searchRef} value={query} onChange={e => setQuery(e.target.value)}
                placeholder="Search members…"
                className="w-full text-[11px] border border-surface-border rounded-lg pl-7 pr-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-primary/15 focus:border-primary/40 transition-all placeholder-slate-300"/>
            </div>
          </div>

          {/* Options */}
          <div className="max-h-44 overflow-y-auto">
            {filtered.length === 0
              ? <p className="text-[11px] text-slate-400 text-center py-4">No members found</p>
              : filtered.map((m, i) => {
                  const sel = value.includes(m.id)
                  return (
                    <button key={m.id} type="button" onClick={() => toggle(m.id)}
                      className={`w-full flex items-center gap-2.5 px-3 py-2 text-left transition-colors ${sel ? 'bg-primary-50' : 'hover:bg-surface-hover'} ${i > 0 ? 'border-t border-surface-border' : ''}`}>
                      <div className="w-3.5 h-3.5 rounded flex items-center justify-center flex-shrink-0 transition-colors border"
                        style={{ background: sel ? accentColor : 'transparent', borderColor: sel ? accentColor : '#cbd5e1' }}>
                        {sel && <Check size={9} color="#fff"/>}
                      </div>
                      <div className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold text-white flex-shrink-0 transition-colors"
                        style={{ background: sel ? accentColor : '#94a3b8' }}>
                        {m.avatar}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[12px] font-semibold text-slate-900">{m.name}</p>
                        <p className="text-[10px] text-slate-400">{m.role}</p>
                      </div>
                      {sel && <Check size={12} style={{ color: accentColor }} className="flex-shrink-0"/>}
                    </button>
                  )
                })
            }
          </div>

          {/* Footer */}
          {value.length > 0 && (
            <div className="px-3 py-1.5 border-t border-surface-border flex items-center justify-between">
              <span className="text-[10px] text-slate-500">{value.length} selected</span>
              <button type="button" onClick={() => onChange([])}
                className="text-[10px] text-red-400 hover:text-red-600 transition-colors">Clear all</button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

/* ─── Departments ─────────────────────────────────────────────────────────── */
function DepartmentsSection() {
  const { departments, setDepartments } = useContext(DeptCtx)
  const allMembers = MOCK_MEMBERS

  const [modalOpen, setModalOpen] = useState(false)
  const [editId,    setEditId]    = useState(null)
  const [form, setForm] = useState({ name:'', color: DEPT_COLORS[0], defaultRole:'Agent', memberIds:[] })
  const [deptSearch, setDeptSearch] = useState('')
  const f = (k,v) => setForm(p=>({...p,[k]:v}))

  function openCreate() {
    setEditId(null)
    setForm({ name:'', color:DEPT_COLORS[0], defaultRole:'Agent', memberIds:[] })
    setModalOpen(true)
  }

  function openEdit(dept) {
    setEditId(dept.id)
    setForm({ name:dept.name, color:dept.color, defaultRole:dept.defaultRole, memberIds:[...dept.memberIds] })
    setModalOpen(true)
  }

  function save() {
    if (!form.name.trim()) return
    if (editId) {
      setDepartments(p=>p.map(d=>d.id===editId ? {...d,...form} : d))
    } else {
      setDepartments(p=>[...p,{id:Date.now(),...form}])
    }
    setModalOpen(false)
  }

  function deleteDept(id) { setDepartments(p=>p.filter(d=>d.id!==id)) }


  const ROLE_COLOR = { Admin:'#f59e0b', Supervisor:'#8b5cf6', Agent:'#0ea5e9', Viewer:'#64748b' }

  return (
    <div>
      <SectionHeader title="Departments" desc="Organise your team into departments and link them with roles and permissions"/>

      {/* Stats row */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 mb-4">
        <div style={{ background:'#f8fafc', border:'1px solid #e2e8f0', borderRadius:10, padding:'10px 14px' }}>
          <p style={{ fontSize:11, color:'#64748b', margin:0 }}>Total Departments</p>
          <p style={{ fontSize:20, fontWeight:700, color:'#0066ff', margin:'2px 0 0' }}>{departments.length}</p>
        </div>
        <div style={{ background:'#f8fafc', border:'1px solid #e2e8f0', borderRadius:10, padding:'10px 14px' }}>
          <p style={{ fontSize:11, color:'#64748b', margin:0 }}>Members Assigned</p>
          <p style={{ fontSize:20, fontWeight:700, color:'#22c55e', margin:'2px 0 0' }}>
            {new Set(departments.flatMap(d=>d.memberIds)).size}
          </p>
        </div>
        <div style={{ background:'#f8fafc', border:'1px solid #e2e8f0', borderRadius:10, padding:'10px 14px' }}>
          <p style={{ fontSize:11, color:'#64748b', margin:0 }}>Unassigned</p>
          <p style={{ fontSize:20, fontWeight:700, color:'#f59e0b', margin:'2px 0 0' }}>
            {allMembers.filter(m=>!departments.some(d=>d.memberIds.includes(m.id))).length}
          </p>
        </div>
      </div>

      <div style={{ display:'flex', gap:8, marginBottom:14 }}>
        <div style={{ flex:1, position:'relative' }}>
          <Search size={14} style={{ position:'absolute', left:10, top:'50%', transform:'translateY(-50%)', color:'#94a3b8', pointerEvents:'none' }}/>
          <input value={deptSearch} onChange={e=>setDeptSearch(e.target.value)} placeholder="Search departments..."
            style={{ width:'100%', border:'1px solid #e2e8f0', borderRadius:8, padding:'6px 12px 6px 32px', fontSize:12, outline:'none', boxSizing:'border-box' }}
            onFocus={e=>e.target.style.borderColor='#0066ff'} onBlur={e=>e.target.style.borderColor='#e2e8f0'}
          />
        </div>
        <PrimaryBtn onClick={openCreate}><Plus size={14}/> Create Department</PrimaryBtn>
      </div>

      {/* Empty state */}
      {departments.length === 0 && (
        <div style={{ textAlign:'center', padding:'48px 20px', border:'2px dashed #e2e8f0', borderRadius:14 }}>
          <div style={{ width:52, height:52, borderRadius:14, background:'#f1f5f9', display:'flex', alignItems:'center',
            justifyContent:'center', margin:'0 auto 12px' }}>
            <Building2 size={24} color="#94a3b8"/>
          </div>
          <p style={{ fontSize:14, fontWeight:600, color:'#374151', margin:'0 0 4px' }}>No departments yet</p>
          <p style={{ fontSize:12, color:'#94a3b8', margin:'0 0 16px' }}>Create departments to organise your team</p>
          <PrimaryBtn onClick={openCreate}><Plus size={13}/> Create First Department</PrimaryBtn>
        </div>
      )}

      {/* Department cards grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {departments.filter(d => d.name.toLowerCase().includes(deptSearch.toLowerCase())).map(dept => {
          const members = allMembers.filter(m => dept.memberIds.includes(m.id))
          return (
            <div key={dept.id} style={{ border:'1px solid #e2e8f0', borderRadius:14, overflow:'hidden', background:'#fff' }}>
              {/* Card header strip */}
              <div style={{ background: dept.color + '12', borderBottom:'1px solid ' + dept.color + '30',
                padding:'12px 14px', display:'flex', alignItems:'center', gap:10 }}>
                <div style={{ width:36, height:36, borderRadius:10, background:dept.color,
                  display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                  <Building2 size={16} color="#fff"/>
                </div>
                <div style={{ flex:1, minWidth:0 }}>
                  <p style={{ fontSize:13, fontWeight:700, color:'#0f172a', margin:0, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{dept.name}</p>
                  <span style={{ fontSize:10, fontWeight:600, color: ROLE_COLOR[dept.defaultRole] || '#64748b',
                    background: (ROLE_COLOR[dept.defaultRole] || '#64748b') + '18', borderRadius:8, padding:'1px 7px', display:'inline-block', marginTop:2 }}>
                    {dept.defaultRole}
                  </span>
                </div>
                <div style={{ display:'flex', gap:5, flexShrink:0 }}>
                  <button onClick={()=>openEdit(dept)}
                    style={{ border:'1px solid #e2e8f0', background:'#fff', borderRadius:7, padding:'5px 7px',
                      cursor:'pointer', color:'#374151', display:'flex', alignItems:'center' }}>
                    <Edit3 size={12}/>
                  </button>
                  <button onClick={()=>deleteDept(dept.id)}
                    style={{ border:'1px solid #fecaca', background:'#fff', borderRadius:7, padding:'5px 7px',
                      cursor:'pointer', color:'#ef4444', display:'flex', alignItems:'center' }}>
                    <Trash2 size={12}/>
                  </button>
                </div>
              </div>

              {/* Card body */}
              <div style={{ padding:'12px 14px' }}>
                {members.length === 0 ? (
                  <p style={{ fontSize:11, color:'#94a3b8', margin:0 }}>No members assigned</p>
                ) : (
                  <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                    <div style={{ display:'flex' }}>
                      {members.slice(0,5).map((m,i)=>(
                        <div key={m.id} title={m.name} style={{
                          width:28, height:28, borderRadius:'50%', background:dept.color,
                          display:'flex', alignItems:'center', justifyContent:'center', fontSize:10, fontWeight:700,
                          color:'#fff', border:'2px solid #fff', marginLeft: i===0?0:-8, flexShrink:0, zIndex:5-i }}>
                          {m.avatar}
                        </div>
                      ))}
                    </div>
                    <span style={{ fontSize:11, color:'#64748b', marginLeft: members.length>0?4:0 }}>
                      {members.length} {members.length===1?'member':'members'}
                      {members.length > 5 && ` (+${members.length-5} more)`}
                    </span>
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {/* Create / Edit Department modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm"
          onClick={e => e.target===e.currentTarget && setModalOpen(false)}>
          <div className="bg-white w-full max-w-md rounded-2xl shadow-modal flex flex-col max-h-[92vh] overflow-hidden border border-surface-border">

            {/* Header */}
            <div className="flex items-center gap-3 px-4 py-3 border-b border-surface-border flex-shrink-0">
              <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0" style={{background: form.color}}>
                <Building2 size={13} color="#fff"/>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[13px] font-bold text-slate-900">{editId ? 'Edit Department' : 'New Department'}</p>
                <p className="text-[10px] text-slate-400">{editId ? 'Update department settings' : 'Create a new department for your team'}</p>
              </div>
              <button onClick={()=>setModalOpen(false)} className="p-1 rounded-lg hover:bg-surface-hover text-slate-400 transition-colors">
                <X size={14}/>
              </button>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              <div>
                <label className="block text-[10px] font-semibold text-slate-500 mb-1">Department Name</label>
                <input value={form.name} onChange={e=>f('name',e.target.value)} placeholder="e.g. Sales, Support, Engineering"
                  className="w-full text-[12px] border border-surface-border rounded-lg px-2.5 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-primary/15 focus:border-primary/40 transition-all placeholder-slate-300"/>
              </div>

              <div>
                <label className="block text-[10px] font-semibold text-slate-500 mb-1">Default Role</label>
                <p className="text-[10px] text-slate-400 mb-1">Members in this department default to this role</p>
                <SettingsSelect value={form.defaultRole} onChange={v=>f('defaultRole',v)}
                  options={['Admin','Supervisor','Agent','Viewer'].map(r=>({v:r,l:r}))}/>
              </div>

              <div>
                <label className="block text-[10px] font-semibold text-slate-500 mb-2">Color</label>
                <div className="flex gap-2 flex-wrap">
                  {DEPT_COLORS.map(c=>(
                    <button key={c} onClick={()=>f('color',c)}
                      className="w-7 h-7 rounded-full flex-shrink-0 transition-all"
                      style={{ background:c, border: form.color===c?`3px solid #0f172a`:'3px solid transparent',
                        outline: form.color===c?`2px solid ${c}55`:'none' }}/>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-semibold text-slate-500 mb-1">Members</label>
                <p className="text-[10px] text-slate-400 mb-1.5">Select who belongs to this department</p>
                <MemberMultiSelect
                  value={form.memberIds}
                  onChange={ids => f('memberIds', ids)}
                  members={allMembers}
                  accentColor={form.color}
                />
              </div>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between px-4 py-2.5 border-t border-surface-border flex-shrink-0">
              <button onClick={()=>setModalOpen(false)} className="text-[11px] text-slate-400 hover:text-slate-600 transition-colors">Cancel</button>
              <button onClick={save} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary text-white text-[11px] font-semibold hover:bg-primary/90 transition-colors">
                <Check size={11}/> {editId ? 'Save Changes' : 'Create Department'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

const SECTION_COMPONENTS = {
  general: GeneralSection, whatsapp: WhatsAppSection, business_hours: BusinessHoursSection,
  notifications: NotificationsSection, team: TeamSection, departments: DepartmentsSection, roles: RolesSection,
  sla: SLASection, canned: CannedSection, tags: TagsSection, custom_fields: CustomFieldsSection,
  auto_reply: AutoReplySection, api: APISection, billing: BillingSection,
  security: SecuritySection, audit: AuditSection,
  language: LanguageSection, wa_conversations: WAConversationsSection, wa_automation: WAAutomationSection,
}

/* ─── Main Settings Page ──────────────────────────────────────────────────── */
/* Compact-layout navigation: a searchable dropdown instead of a wrapped grid of
   section links. The desktop sidebar is unchanged. */
function SectionPicker({ sections, groups, current, onSelect }) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [hi, setHi] = useState(0)
  const ref = useRef(null)
  const inputRef = useRef(null)

  const q = query.trim().toLowerCase()
  const matches = sections.filter(s => !q || s.label.toLowerCase().includes(q) || s.group.toLowerCase().includes(q))
  const flat = groups.flatMap(g => matches.filter(s => s.group === g))
  const cur = sections.find(s => s.id === current) || sections[0]
  const CurIcon = cur.icon

  useEffect(() => {
    if (!open) return
    const onDown = e => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', onDown)
    inputRef.current?.focus()
    return () => document.removeEventListener('mousedown', onDown)
  }, [open])
  useEffect(() => setHi(0), [query])

  function pick(id) { onSelect(id); setOpen(false); setQuery('') }
  function onKey(e) {
    if (e.key === 'Escape') { setOpen(false); setQuery('') }
    else if (e.key === 'ArrowDown') { e.preventDefault(); setHi(h => Math.min(flat.length - 1, h + 1)) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setHi(h => Math.max(0, h - 1)) }
    else if (e.key === 'Enter' && flat[hi]) { e.preventDefault(); pick(flat[hi].id) }
  }

  return (
    <div ref={ref} className="relative">
      <button type="button" onClick={() => setOpen(o => !o)} aria-haspopup="listbox" aria-expanded={open}
        className={clsx('w-full flex items-center gap-2 px-3 py-2 rounded-xl border text-left transition-colors',
          open ? 'border-primary ring-2 ring-primary/15 bg-white' : 'border-surface-border bg-white hover:border-slate-300')}>
        <CurIcon size={14} className="text-primary flex-shrink-0"/>
        <span className="flex-1 min-w-0">
          <span className="block text-[10px] font-semibold text-slate-400 uppercase tracking-wider leading-none">{cur.group}</span>
          <span className="block text-[13px] font-semibold text-slate-900 truncate mt-0.5">{cur.label}</span>
        </span>
        <ChevronDown size={15} className={clsx('text-slate-400 transition-transform flex-shrink-0', open && 'rotate-180')}/>
      </button>

      {open && (
        <div className="absolute left-0 right-0 top-full mt-1.5 z-30 bg-white rounded-xl border border-surface-border shadow-modal animate-fade-in overflow-hidden">
          <div className="relative p-2 border-b border-surface-border">
            <SearchIcon size={13} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"/>
            <input ref={inputRef} value={query} onChange={e => setQuery(e.target.value)} onKeyDown={onKey}
              placeholder="Search settings…"
              className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 border border-surface-border rounded-lg focus:outline-none focus:border-primary/40 focus:bg-white placeholder-slate-400"/>
          </div>
          <div role="listbox" className="max-h-72 overflow-y-auto py-1">
            {flat.length === 0 && <p className="text-xs text-slate-400 text-center py-6">No settings match “{query}”</p>}
            {groups.map(g => {
              const items = matches.filter(m => m.group === g)
              if (!items.length) return null
              return (
                <div key={g}>
                  <p className="px-3 pt-2 pb-1 text-[10px] font-bold text-slate-400 uppercase tracking-wider">{g}</p>
                  {items.map(sec => {
                    const Icon = sec.icon
                    const idx = flat.indexOf(sec)
                    return (
                      <button key={sec.id} type="button" role="option" aria-selected={sec.id === current}
                        onClick={() => pick(sec.id)} onMouseEnter={() => setHi(idx)}
                        className={clsx('w-full flex items-center gap-2.5 px-3 py-2 text-xs text-left transition-colors',
                          idx === hi ? 'bg-surface-hover' : '',
                          sec.id === current ? 'text-primary font-semibold' : 'text-slate-700 font-medium')}>
                        <Icon size={13} className="flex-shrink-0"/>
                        <span className="flex-1 truncate">{sec.label}</span>
                        {sec.id === current && <Check size={13} className="flex-shrink-0"/>}
                      </button>
                    )
                  })}
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

export default function Settings() {
  const { activeProductId } = useApp()
  const [active, setActive] = useState('general')
  const [botLangs,       setBotLangs]       = useState(['English','Nepali','Sanskrit'])
  const [botDefaultLang, setBotDefaultLang] = useState('English')
  const [botMultiLingual,setBotMultiLingual]= useState(true)
  const [departments,    setDepartments]    = useState(INIT_DEPARTMENTS)

  function assignMemberToDept(memberId, deptId) {
    setDepartments(prev => prev.map(d => {
      if (deptId === null || d.id !== deptId) {
        return { ...d, memberIds: d.memberIds.filter(id => id !== memberId) }
      }
      if (!d.memberIds.includes(memberId)) {
        return { ...d, memberIds: [...d.memberIds, memberId] }
      }
      return d
    }))
  }

  const visibleSections = sectionsFor(activeProductId)
  const grouped = GROUPS.reduce((acc, g) => {
    acc[g] = visibleSections.filter(s => s.group === g)
    return acc
  }, {})
  const shownGroups = GROUPS.filter(g => grouped[g].length > 0)
  // If the product changes while a now-hidden section is open, fall back to General.
  const current = visibleSections.some(s => s.id === active) ? active : 'general'

  const ActiveComponent = SECTION_COMPONENTS[current] || GeneralSection

  const botCtxValue = { botLangs, setBotLangs, botDefaultLang, setBotDefaultLang, botMultiLingual, setBotMultiLingual }
  const deptCtxValue = { departments, setDepartments, assignMemberToDept }
  return (
    <DeptCtx.Provider value={deptCtxValue}>
    <BotCtx.Provider value={botCtxValue}>
      <div className="flex flex-col md:flex-row md:h-screen md:-m-5 md:overflow-hidden">

      {/* ── Left sidebar ── */}
      <div className="md:w-48 flex-shrink-0 border-b md:border-b-0 md:border-r border-surface-border bg-white flex flex-col md:overflow-hidden relative z-20">

        {/* Compact layout: searchable dropdown */}
        <div className="md:hidden p-3">
          <SectionPicker sections={visibleSections} groups={shownGroups} current={current} onSelect={setActive}/>
        </div>

        {/* Nav groups */}
        <div className="hidden md:block md:overflow-x-hidden md:overflow-y-auto md:flex-1 py-2">
          <div className="block">
          {shownGroups.map(group => (
            <div key={group} className="flex-shrink-0 px-2 md:px-3 md:mb-1">
              {/* Group label — hidden on mobile horizontal layout */}
              <div className="hidden md:block py-1 mt-1.5 mb-0.5">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{group}</span>
              </div>
              {grouped[group].map(sec => {
                const Icon = sec.icon
                const isActive = current === sec.id
                return (
                  <button
                    key={sec.id}
                    onClick={() => setActive(sec.id)}
                    className={clsx(
                      'w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs font-medium transition-colors text-left border-none whitespace-nowrap',
                      isActive
                        ? 'bg-primary-50 text-primary font-semibold'
                        : 'text-slate-600 hover:bg-surface-hover'
                    )}
                  >
                    <Icon size={13} className="flex-shrink-0"/>
                    <span className="truncate">{sec.label}</span>
                  </button>
                )
              })}
            </div>
          ))}
          </div>
        </div>
      </div>

      {/* ── Right content ── */}
      <div className="flex-1 overflow-y-auto bg-white p-4 md:p-5">
        <ActiveComponent key={current}/>
      </div>

    </div>
    </BotCtx.Provider>
    </DeptCtx.Provider>
  )
}
