import { useState, useMemo, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Search, Plus, X, Star, Phone, Mail, MapPin, Building2,
  Globe, MessageSquare, FileText, PhoneCall, PhoneOutgoing,
  CheckCircle2, XCircle, Shield, UserPlus, Trash2, UserCheck,
  Send, Check, Tag, Upload, Download, Users, Clock,
  MoreVertical, ChevronDown, FileUp, SlidersHorizontal, Sparkles,
  Pencil, Save, Variable, Layers, FolderPlus, LayoutList, Table2,
  CheckSquare, MousePointer2, MessageSquareText, Database, ArrowLeft,
  FileSpreadsheet, ExternalLink, Copy, AlertTriangle, ArrowRight,
} from 'lucide-react'
import { useConversations } from '../context/ConversationContext'
import { useApp } from '../context/AppContext'
import clsx from 'clsx'
import { NativeSelect } from '../components/Select'
import { APPROVED_TEMPLATES } from '../constants/approvedTemplates'
import { extractParams, getDynamicUrlButtons } from '../utils/templateParams'

/* ── helpers ─────────────────────────────────────────────────── */
const avBg  = () => ({ bg: '#EEF4FF', color: '#2563EB' })
const inits = n => (n||'').split(' ').map(p=>p[0]).join('').toUpperCase().slice(0,2)
const fmtD  = d => d ? new Date(d).toLocaleDateString('en-IN',{day:'numeric',month:'short',year:'numeric'}) : '—'
const fmtR  = d => {
  if (!d) return '—'
  const v = Math.floor((Date.now()-new Date(d))/86400000)
  return v===0?'Today':v===1?'Yesterday':v<7?`${v}d ago`:fmtD(d)
}
const inMo = d => {
  if (!d) return false
  const n=new Date(), t=new Date(d)
  return t.getMonth()===n.getMonth() && t.getFullYear()===n.getFullYear()
}

const TAG_C = {
  vip:['#fef9c3','#854d0e'], customer:['#dcfce7','#166534'], lead:['#dbeafe','#1e40af'],
  prospect:['#ede9fe','#5b21b6'], refund:['#fee2e2','#991b1b'], appointment:['#e0f2fe','#075985'],
  urgent:['#fff1f2','#9f1239'], 'follow-up':['#faf5ff','#6b21a8'], payment:['#d1fae5','#065f46'],
  partner:['#fdf4ff','#7e22ce'],
}
const tSt = t => { const [bg,c]=TAG_C[t]||['#f1f5f9','#64748b']; return {background:bg,color:c} }
const SRC = {
  WhatsApp:{bg:'#dcfce7',c:'#15803d'}, CTWA:{bg:'#dbeafe',c:'#1d4ed8'},
  'G-CTWA':{bg:'#fef3c7',c:'#92400e'}, Import:{bg:'#f3e8ff',c:'#6d28d9'},
  API:{bg:'#ffe4e6',c:'#be123c'}, CSV:{bg:'#f1f5f9',c:'#475569'}, Manual:{bg:'#f0fdf4',c:'#166534'},
}

const TAGS    = ['vip','customer','lead','prospect','refund','appointment','urgent','follow-up','payment','partner']
const AGENTS  = ['Riya Patel','Arjun Dev','Neha Shah','Karan Mehta']
const LANGS   = ['Hindi','English','Tamil','Telugu','Kannada','Gujarati','Bengali','Malayalam']
const SOURCES = ['WhatsApp','CTWA','G-CTWA','Import','API','CSV','Manual']

const CONTACT_FIELDS = [
  { key:'name',     label:'Name'     },
  { key:'phone',    label:'Phone'    },
  { key:'email',    label:'Email'    },
  { key:'company',  label:'Company'  },
  { key:'city',     label:'City'     },
  { key:'language', label:'Language' },
  { key:'source',   label:'Source'   },
]

const INIT_GROUPS = [
  { id: 'grp1', name: 'E-commerce Leads',  color: '#8B5CF6', desc: 'CTWA leads from e-com ads' },
  { id: 'grp2', name: 'Festival Campaign',  color: '#f59e0b', desc: 'Diwali promo segment' },
  { id: 'grp3', name: 'Premium Members',    color: '#10b981', desc: 'VIP & payment contacts' },
]

const SEGS = [
  { id:'all',       label:'All contacts',   icon:Users,        fn:()=>true },
  { id:'starred',   label:'Starred',        icon:Star,         fn:c=>c.starred },
  { id:'opted-in',  label:'Opted In',       icon:CheckCircle2, fn:c=>c.optIn&&c.status==='active' },
  { id:'opted-out', label:'Opted Out',      icon:XCircle,      fn:c=>!c.optIn||c.status==='opted-out' },
  { id:'blocked',   label:'Blocked',        icon:Shield,       fn:c=>c.status==='blocked' },
  { id:'unassigned',label:'Unassigned',     icon:UserCheck,    fn:c=>!c.agent },
  { id:'new',       label:'New This Month', icon:UserPlus,     fn:c=>inMo(c.created) },
]

const TEMPLATES = [
  // ── Original templates ──────────────────────────────────────────────────
  { id:'t1',  name:'Welcome Message',            cat:'Utility',   headerType:'NONE',     prev:"Hi {{1}}, welcome to SmatBot! We're excited to have you on board."                                         },
  { id:'t2',  name:'Order Confirmation',         cat:'Utility',   headerType:'NONE',     prev:'Your order #{{1}} has been confirmed. Expected delivery: {{2}}.'                                            },
  { id:'t3',  name:'Follow-up',                  cat:'Marketing', headerType:'NONE',     prev:'Hi {{1}}, just checking in! Is there anything we can help you with?'                                        },
  { id:'t4',  name:'Payment Reminder',           cat:'Utility',   headerType:'NONE',     prev:'Hi {{1}}, your payment of ₹{{2}} is due on {{3}}.'                                                         },
  { id:'t5',  name:'Feedback Request',           cat:'Marketing', headerType:'NONE',     prev:"Hi {{1}}, we'd love your feedback. It takes just 2 minutes!"                                               },
  { id:'t6',  name:'Appointment Reminder',       cat:'Utility',   headerType:'NONE',     prev:'Your appointment is on {{1}} at {{2}}. Reply YES to confirm.'                                               },
  { id:'t7',  name:'Restock Alert',              cat:'Marketing', headerType:'NONE',     prev:"Good news! The item you wanted is back in stock. Order now!"                                                },
  { id:'t8',  name:'Support Ticket',             cat:'Utility',   headerType:'NONE',     prev:"Hi {{1}}, your support ticket #{{2}} has been received. We'll respond in 24h."                             },
  // ── Rich templates (all header / param / button types) ─────────────────
  { id:'at1', name:'Exclusive Festival Offer',   cat:'Marketing', headerType:'IMAGE',    prev:'Hi {{1}}, as a cherished member, we have a special festival surprise just for you! 🎁'                     },
  { id:'at2', name:'Spring Sale Final',          cat:'Marketing', headerType:'IMAGE',    prev:"Hi {{1}}, up to 40% off ends at midnight. Don't miss out!"                                                 },
  { id:'at3', name:'Store Credits Reminder',     cat:'Marketing', headerType:'TEXT',     prev:'Hi {{1}}, you have ₹{{2}} in store credits. Use them before {{3}}.'                                        },
  { id:'at4', name:'Order Confirmation v3',      cat:'Utility',   headerType:'TEXT',     prev:'Hi {{1}}, your order #{{2}} is confirmed and arrives by {{3}}.'                                            },
  { id:'at5', name:'Payment Receipt',            cat:'Utility',   headerType:'DOCUMENT', prev:'Hi {{1}}, your payment of ₹{{2}} has been received. Receipt #{{3}} is attached.'                           },
  { id:'at6', name:'Store Pickup Location',      cat:'Utility',   headerType:'LOCATION', prev:'Hi {{1}}, your order is ready for pickup at our {{2}} store.'                                              },
  { id:'at7', name:'Video Tutorial Welcome',     cat:'Utility',   headerType:'VIDEO',    prev:'Hi {{1}}, your account is active! Watch the intro video. Trial expires on {{2}}.'                          },
  { id:'at8', name:'Invoice Payment Due',        cat:'Utility',   headerType:'DOCUMENT', prev:'Hi {{1}}, invoice #{{2}} for {{3}} is due on {{4}}. Pay early to save {{5}}.'                              },
  { id:'at9', name:'Appointment Confirmation',   cat:'Utility',   headerType:'TEXT',     prev:'Hi {{1}}, your appointment with {{2}} is confirmed for {{3}}. Fee: {{4}}.'                                 },
  { id:'at10',name:'Order Invoice Full Summary', cat:'Utility',   headerType:'TEXT',     prev:'Hi {{2}}, your order summary: Subtotal {{3}}, Tax {{4}}, Total {{5}}. Delivery: {{6}}. Tracking: {{7}}.'  },
]

const EMAIL_TEMPLATES = [
  { id:'em1', name:'Welcome Email',        cat:'Utility',   prev:"Hi {{1}}, welcome to SmatBot! Your account is now active. Get started at {{2}} — we're excited to have you on board."                  },
  { id:'em2', name:'Monthly Newsletter',   cat:'Marketing', prev:'Hi {{1}}, here\'s your monthly update! Key highlights: {{2}}. Read the full newsletter: {{3}}.'                                          },
  { id:'em3', name:'Payment Receipt',      cat:'Utility',   prev:'Hi {{1}}, your payment of ₹{{2}} has been received. Transaction ID: {{3}}. Thank you for your prompt payment!'                           },
  { id:'em4', name:'Appointment Reminder', cat:'Utility',   prev:'Hi {{1}}, reminder for your appointment on {{2}} at {{3}}. Please reply to confirm or reschedule.'                                        },
  { id:'em5', name:'Follow-up Outreach',   cat:'Marketing', prev:'Hi {{1}}, following up on our conversation about {{2}}. Would {{3}} work for a quick call?'                                               },
  { id:'em6', name:'Proposal Sent',        cat:'Utility',   prev:'Hi {{1}}, please find attached the proposal for {{2}}. The offer is valid until {{3}}. Feel free to reach out with any questions.'        },
  { id:'em7', name:'Feedback Survey',      cat:'Marketing', prev:'Hi {{1}}, your opinion matters! Share your experience: {{2}}. As a thank-you, enjoy {{3}} off your next order.'                          },
  { id:'em8', name:'Order Shipped',        cat:'Utility',   prev:'Great news, {{1}}! Your order #{{2}} has shipped via {{3}}. Expected delivery: {{4}}. Track here: {{5}}.'                                 },
]

const LOG_ST = {
  message:  { bg:'#dbeafe', c:'#2563eb', Icon:MessageSquare },
  resolved: { bg:'#dcfce7', c:'#16a34a', Icon:CheckCircle2  },
  template: { bg:'#ede9fe', c:'#7c3aed', Icon:FileText      },
  created:  { bg:'#f1f5f9', c:'#64748b', Icon:UserPlus      },
  blocked:  { bg:'#fee2e2', c:'#dc2626', Icon:XCircle       },
}

const INIT_CONTACTS = [
  {id:'1', name:'Priya Sharma',    phone:'+91 98765 43210',email:'priya@example.com',   company:'Sharma Enterprises', city:'Mumbai',    language:'Hindi',    source:'WhatsApp',optIn:true, status:'active',   starred:true, tags:['vip','customer'],    agent:'Riya Patel', created:'2024-11-10',last:'2025-04-15',convos:12,notes:'VIP customer — respond within 2 hours.',groupIds:['grp3'],
   score:92, aiSummary:'VIP customer with 12 conversations over 5 months. Prefers early morning contact. Consistent high-value orders and positive engagement.',
   log:[{t:'message',text:'Sent order issue query #3821',date:'2025-04-15'},{t:'resolved',text:'Complaint resolved by Riya',date:'2025-04-10'},{t:'template',text:'Received "Feedback Request" template',date:'2025-03-28'},{t:'created',text:'Created via WhatsApp',date:'2024-11-10'}]},
  {id:'2', name:'Rahul Mehta',     phone:'+91 82341 09876',email:'rahul@techcorp.com',   company:'TechCorp Solutions', city:'Delhi',     language:'English',  source:'CTWA',    optIn:true, status:'active',   starred:false,tags:['lead'],              agent:'Arjun Dev',  created:'2025-04-14',last:'2025-04-14',convos:3, notes:'',groupIds:['grp1'],
   score:68, aiSummary:'Recent CTWA lead from enterprise segment. Showed strong interest in pricing. High conversion potential.',
   log:[{t:'created',text:'Created via CTWA ad',date:'2025-04-14'},{t:'message',text:'Asked about enterprise pricing',date:'2025-04-14'}]},
  {id:'3', name:'Anita Kapoor',    phone:'+91 91234 56789',email:'anita@gmail.com',      company:'',                   city:'Bangalore', language:'Kannada',  source:'WhatsApp',optIn:true, status:'active',   starred:false,tags:['appointment'],        agent:null,         created:'2025-01-20',last:'2025-04-13',convos:5, notes:'',
   score:55, aiSummary:'Regular appointment-based customer. Moderate engagement, no recent activity.',
   log:[{t:'message',text:'Booked appointment for 20 May',date:'2025-04-13'}]},
  {id:'4', name:'Vikram Singh',    phone:'+91 77890 12345',email:'vikram@yahoo.com',     company:'',                   city:'Pune',      language:'Hindi',    source:'WhatsApp',optIn:false,status:'blocked',  starred:false,tags:['refund'],             agent:null,         created:'2025-02-05',last:'2025-04-12',convos:2, notes:'Blocked — abusive language.',
   score:10, aiSummary:'Blocked contact. Refund-related complaint history.',
   log:[{t:'blocked',text:'Flagged and blocked',date:'2025-04-12'}]},
  {id:'5', name:'Meera Joshi',     phone:'+91 88001 23456',email:'meera@outlook.com',    company:'Joshi & Associates', city:'Chennai',   language:'Tamil',    source:'CSV',     optIn:true, status:'active',   starred:true, tags:['customer','payment'], agent:'Riya Patel', created:'2025-03-01',last:'2025-04-10',convos:4, notes:'Reliable customer.',
   score:78, aiSummary:'Reliable customer with consistent payment history. Positive feedback shared recently.',
   log:[{t:'message',text:'Shared positive feedback',date:'2025-04-10'}]},
  {id:'6', name:'Arjun Nair',      phone:'+91 99100 23456',email:'arjun@business.in',    company:'Nair Global Ltd.',   city:'Hyderabad', language:'Malayalam',source:'API',     optIn:true, status:'active',   starred:false,tags:['lead','vip'],         agent:'Arjun Dev',  created:'2025-03-10',last:'2025-04-09',convos:7, notes:'Partner API lead.',groupIds:['grp1'],
   score:74, aiSummary:'Enterprise API lead with 7 conversations. Interested in product demos and integration support. Medium-high conversion potential.',
   log:[{t:'message',text:'Requested product demo',date:'2025-04-09'}]},
  {id:'7', name:'Kavya Reddy',     phone:'+91 87654 32109',email:'kavya@example.com',    company:'',                   city:'Bangalore', language:'Telugu',   source:'WhatsApp',optIn:true, status:'active',   starred:false,tags:['customer'],           agent:null,         created:'2025-02-14',last:'2025-04-08',convos:6, notes:'',
   score:61, aiSummary:'Steady customer from Bangalore. Regular orders with positive engagement. No complaints on record.',
   log:[{t:'message',text:'Placed new order',date:'2025-04-08'}]},
  {id:'8', name:'Suresh Babu',     phone:'+91 76543 21098',email:'suresh@import.com',    company:'Babu Textiles',      city:'Coimbatore',language:'Tamil',    source:'Import',  optIn:true, status:'active',   starred:false,tags:['lead'],              agent:null,         created:'2025-02-20',last:'2025-04-07',convos:2, notes:'',
   score:42, aiSummary:'Imported lead from textiles industry. Limited engagement so far. Follow-up needed on bulk pricing inquiry.',
   log:[{t:'message',text:'Enquired about bulk pricing',date:'2025-04-07'}]},
  {id:'9', name:'Deepika Patel',   phone:'+91 93456 78901',email:'deepika@patel.com',    company:'Patel Industries',   city:'Mumbai',    language:'Gujarati', source:'WhatsApp',optIn:true, status:'active',   starred:true, tags:['vip','payment'],     agent:'Riya Patel', created:'2024-10-05',last:'2025-04-06',convos:18,notes:'Premium subscriber.',groupIds:['grp3'],
   score:95, aiSummary:'Premium subscriber with the highest conversation count. Consistent payments and high product engagement. Key account.',
   log:[{t:'template',text:'Sent "Payment Due" reminder',date:'2025-04-06'}]},
  {id:'10',name:'Kiran Kumar',     phone:'+91 70001 23456',email:'kiran@startup.io',     company:'Kiran Startup',      city:'Bangalore', language:'Kannada',  source:'G-CTWA', optIn:true, status:'active',   starred:false,tags:['lead'],              agent:'Neha Shah',  created:'2025-04-01',last:'2025-04-05',convos:2, notes:'',groupIds:['grp1'],
   score:38, aiSummary:'Very recent G-CTWA lead. Early stage with only 2 conversations. Potential startup customer worth nurturing.',
   log:[{t:'created',text:'Created via G-CTWA ad',date:'2025-04-01'}]},
  {id:'11',name:'Sunita Rao',      phone:'+91 85555 12345',email:'sunita@rao.com',       company:'Rao Consultancy',    city:'Delhi',     language:'Hindi',    source:'CSV',     optIn:true, status:'active',   starred:false,tags:['prospect'],           agent:'Karan Mehta',created:'2025-03-15',last:'2025-04-04',convos:3, notes:'',
   score:50, aiSummary:'Prospect from consultancy sector. Requested pricing info. Mid-funnel lead requiring follow-up.',
   log:[{t:'message',text:'Requested pricing info',date:'2025-04-04'}]},
  {id:'12',name:'Aditya Verma',    phone:'+91 98001 56789',email:'aditya@verma.co',      company:'Verma Group',        city:'Jaipur',    language:'Hindi',    source:'WhatsApp',optIn:true, status:'active',   starred:false,tags:['follow-up'],          agent:'Arjun Dev',  created:'2025-02-28',last:'2025-04-03',convos:5, notes:'',
   score:63, aiSummary:'Active follow-up contact interested in growth plans. Consistent engagement across 5 conversations. Good upsell opportunity.',
   log:[{t:'message',text:'Interested in growth plan',date:'2025-04-03'}]},
  {id:'13',name:'Pooja Mishra',    phone:'+91 72222 34567',email:'pooja@mishra.in',      company:'',                   city:'Lucknow',   language:'Hindi',    source:'WhatsApp',optIn:true, status:'active',   starred:false,tags:['customer'],           agent:null,         created:'2025-01-10',last:'2025-04-02',convos:8, notes:'',
   score:70, aiSummary:'Established customer with 8 conversations. Delivery issue resolved successfully, indicating positive experience with support.',
   log:[{t:'resolved',text:'Delivery issue resolved',date:'2025-04-02'}]},
  {id:'14',name:'Rohit Sharma',    phone:'+91 99876 11223',email:'rohit@biz.com',        company:'Sharma Biz Pvt.',    city:'Ahmedabad', language:'Gujarati', source:'API',     optIn:true, status:'active',   starred:true, tags:['vip','urgent'],       agent:'Riya Patel', created:'2024-12-01',last:'2025-04-01',convos:10,notes:'Major account.',
   score:88, aiSummary:'Major account with 10 conversations. Requests revised proposals frequently — high-value and time-sensitive relationship.',
   log:[{t:'message',text:'Requested revised proposal',date:'2025-04-01'}]},
  {id:'15',name:'Nisha Agarwal',   phone:'+91 88990 22334',email:'nisha@agarwal.net',    company:'Agarwal Retail',     city:'Surat',     language:'Gujarati', source:'CTWA',    optIn:true, status:'active',   starred:false,tags:['prospect'],           agent:'Karan Mehta',created:'2025-03-20',last:'2025-03-30',convos:2, notes:'',
   score:45, aiSummary:'CTWA prospect from retail sector. Early-stage engagement with 2 conversations. Follow-up recommended.',
   log:[{t:'created',text:'Created via CTWA ad',date:'2025-03-20'}]},
  {id:'16',name:'Manish Gupta',    phone:'+91 77665 44556',email:'manish@guptaltd.com',  company:'Gupta Ltd.',         city:'Kolkata',   language:'Bengali',  source:'Import',  optIn:false,status:'opted-out',starred:false,tags:['lead'],              agent:null,         created:'2025-01-05',last:'2025-03-25',convos:1, notes:'Opted out.',
   score:15, aiSummary:'Contact has opted out of messaging. Only 1 conversation on record. No further outreach possible.',
   log:[{t:'blocked',text:'Opted out of messaging',date:'2025-03-25'}]},
  {id:'17',name:'Prashant Tiwari', phone:'+91 96660 77889',email:'prashant@tiwari.in',   company:'Tiwari Logistics',   city:'Varanasi',  language:'Hindi',    source:'WhatsApp',optIn:true, status:'active',   starred:false,tags:['follow-up'],          agent:'Neha Shah',  created:'2025-04-05',last:'2025-04-05',convos:1, notes:'',
   score:33, aiSummary:'Very new contact from logistics sector. Single conversation so far. Needs follow-up to determine intent.',
   log:[{t:'created',text:'Created via WhatsApp',date:'2025-04-05'}]},
  {id:'18',name:'Divya Krishnan',  phone:'+91 84440 66778',email:'divya@krishnan.co',    company:'Krishnan Tech',      city:'Bangalore', language:'Tamil',    source:'G-CTWA', optIn:true, status:'active',   starred:false,tags:['lead'],              agent:'Arjun Dev',  created:'2025-03-25',last:'2025-04-04',convos:4, notes:'',
   score:58, aiSummary:'Tech lead inquiring about API integration. 4 conversations showing strong technical interest. Good fit for developer plan.',
   log:[{t:'message',text:'Asked about API integration',date:'2025-04-04'}]},
  {id:'19',name:'Ravi Shankar',    phone:'+91 73330 55667',email:'ravi@shankar.biz',     company:'Shankar Pharma',     city:'Hyderabad', language:'Telugu',   source:'CSV',     optIn:true, status:'active',   starred:false,tags:['payment','customer'],  agent:'Riya Patel', created:'2024-09-15',last:'2025-04-02',convos:15,notes:'Renewed subscription.',
   score:85, aiSummary:'Long-term pharma customer with 15 conversations. Recently renewed subscription. Highly loyal with strong payment record.',
   log:[{t:'message',text:'Renewed subscription for another year',date:'2025-04-02'}]},
  {id:'20',name:'Lakshmi Iyer',    phone:'+91 92220 44556',email:'lakshmi@iyer.com',     company:'Iyer Consulting',    city:'Chennai',   language:'Tamil',    source:'WhatsApp',optIn:true, status:'active',   starred:true, tags:['vip'],               agent:'Karan Mehta',created:'2025-02-10',last:'2025-04-06',convos:9, notes:'Referred by Priya.',groupIds:['grp3'],
   score:82, aiSummary:'VIP referral from Priya Sharma. 9 conversations with consistent interest in premium services. Strong loyalty signals.',
   log:[{t:'message',text:'Requested premium service info',date:'2025-04-06'}]},
]

/* ── filter options ─────────────────────────────────────────── */
const DATE_OPTS = [
  { id:'any',       label:'Any time'      },
  { id:'today',     label:'Today'         },
  { id:'yesterday', label:'Yesterday'     },
  { id:'week',      label:'Last 7 days'   },
  { id:'month',     label:'Last 30 days'  },
  { id:'thismonth', label:'This month'    },
  { id:'lastmonth', label:'Last month'    },
]
const SORT_OPTS = [
  { id:'recent',    label:'Most recent'        },
  { id:'name-asc',  label:'Name A → Z'         },
  { id:'name-desc', label:'Name Z → A'         },
  { id:'convos',    label:'Most conversations' },
]

function datePass(c, dateFil) {
  if (dateFil === 'any') return true
  const d = new Date(c.last), now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const yesterday = new Date(today); yesterday.setDate(yesterday.getDate()-1)
  if (dateFil === 'today')     return d >= today
  if (dateFil === 'yesterday') return d >= yesterday && d < today
  if (dateFil === 'week')      { const t = new Date(today); t.setDate(t.getDate()-7); return d >= t }
  if (dateFil === 'month')     { const t = new Date(today); t.setDate(t.getDate()-30); return d >= t }
  if (dateFil === 'thismonth') return d.getMonth()===now.getMonth() && d.getFullYear()===now.getFullYear()
  if (dateFil === 'lastmonth') {
    const lm = new Date(now.getFullYear(), now.getMonth()-1, 1)
    const em = new Date(now.getFullYear(), now.getMonth(), 1)
    return d >= lm && d < em
  }
  return true
}

/* ── FilterChip component ────────────────────────────────────── */
function FilterChip({ label, active, onClear, children }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)
  useEffect(() => {
    if (!open) return
    const h = e => { if (!ref.current?.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', h); return () => document.removeEventListener('mousedown', h)
  }, [open])
  return (
    <div className="relative" ref={ref}>
      <button onClick={() => setOpen(p=>!p)}
        className={clsx(
          'inline-flex items-center gap-1 px-2 py-0.5 rounded-md border text-[10px] font-semibold transition-all whitespace-nowrap',
          active
            ? 'bg-primary-50 text-primary border-primary/30'
            : 'bg-white text-slate-500 border-surface-border hover:bg-surface-hover'
        )}>
        <span className="max-w-[80px] truncate">{label}</span>
        {active
          ? <button onMouseDown={e=>{e.stopPropagation();onClear()}} className="ml-0.5 hover:text-primary/60"><X size={8}/></button>
          : <ChevronDown size={8} className={clsx('transition-transform duration-150', open && 'rotate-180')}/>
        }
      </button>
      {open && (
        <div className="absolute top-full left-0 mt-1 bg-white border border-surface-border rounded-xl shadow-modal z-40 py-0.5 min-w-[160px] max-h-[280px] overflow-y-auto">
          {children({ close: () => setOpen(false) })}
        </div>
      )}
    </div>
  )
}

function DropOpt({ label, active, icon: Icon, count, onClick }) {
  return (
    <button onClick={onClick}
      className={clsx('w-full text-left flex items-center gap-2 px-3 py-1.5 text-[11px] transition-colors',
        active ? 'bg-primary-50 text-primary font-semibold' : 'text-slate-600 hover:bg-surface-hover')}>
      {Icon && (typeof Icon === 'function' ? <Icon/> : <Icon size={11} className="flex-shrink-0 opacity-70"/>)}
      <span className="flex-1 truncate">{label}</span>
      {count !== undefined && count > 0 && <span className={clsx('text-[10px] font-bold', active ? 'text-primary' : 'text-slate-400')}>{count}</span>}
    </button>
  )
}

/* ── contact list row ───────────────────────────────────────── */
function ContactRow({ c, active, onClick, selected, onToggle, manualSelect }) {
  return (
    <div className={clsx(
      'w-full flex items-center gap-1 px-2 py-2 transition-colors border-b border-surface-border/60 group',
      active ? 'bg-primary-50' : 'hover:bg-surface-hover'
    )}>
      {/* checkbox — visible on hover, when selected, or in manual select mode */}
      <div className="flex-shrink-0 w-3.5 flex items-center justify-center" onClick={e => e.stopPropagation()}>
        <input type="checkbox" checked={!!selected} onChange={() => onToggle(c.id)}
          className={clsx(
            'w-3.5 h-3.5 rounded border-slate-300 text-primary focus:ring-primary/20 cursor-pointer transition-opacity',
            (selected || manualSelect) ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
          )}/>
      </div>
      <button onClick={onClick} className="flex flex-1 items-center gap-2 text-left min-w-0">
        {/* avatar */}
        <div className="w-[34px] h-[34px] rounded-full flex items-center justify-center font-semibold text-[12px] flex-shrink-0"
          style={{background:avBg().bg, color:avBg().color}}>{inits(c.name)}</div>
        {/* content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-1.5 mb-[1px]">
            <p className={clsx('text-[12px] font-semibold truncate', active ? 'text-primary' : 'text-slate-800')}>{c.name}</p>
            <span className="text-[10px] text-slate-400 flex-shrink-0">{fmtR(c.last)}</span>
          </div>
          <div className="flex items-center justify-between gap-1.5">
            <p className="text-[11px] text-slate-500 font-mono truncate flex-1">{c.phone}</p>
            <div className="flex items-center gap-1 flex-shrink-0">
              {c.starred && <Star size={9} className="text-amber-400 fill-amber-400"/>}
              {c.tags[0] && (
                <span className="px-1.5 py-0.5 rounded-full text-[9px] font-bold capitalize" style={tSt(c.tags[0])}>{c.tags[0]}</span>
              )}
            </div>
          </div>
          {c.company && <p className="text-[10px] text-slate-400 truncate mt-[1px]">{c.company}</p>}
        </div>
      </button>
    </div>
  )
}

/* ── contact table view ──────────────────────────────────────── */
function ContactTable({ contacts, selId, onContactClick, selectedIds, onToggle, onToggleAll, onTemplate, onCall }) {
  const allSelected = contacts.length > 0 && contacts.every(c => selectedIds.has(c.id))
  const someSelected = contacts.some(c => selectedIds.has(c.id))
  const cbRef = useRef(null)

  useEffect(() => {
    if (cbRef.current) cbRef.current.indeterminate = someSelected && !allSelected
  }, [someSelected, allSelected])

  const TH = 'text-left px-3 py-2.5 text-[10px] font-bold text-slate-400 uppercase tracking-wider whitespace-nowrap bg-white select-none'

  if (!contacts.length) return (
    <div className="flex flex-col items-center justify-center flex-1 py-20 text-center">
      <Users size={28} className="text-slate-300 mb-3"/>
      <p className="text-[13px] font-semibold text-slate-500 mb-1">No contacts found</p>
      <p className="text-[12px] text-slate-400">Try adjusting your search or filters</p>
    </div>
  )

  return (
    <div className="flex-1 overflow-auto min-h-0">
      <table className="w-full border-collapse">
        <thead className="sticky top-0 z-10 shadow-[0_1px_0_0_#e2e8f0]">
          <tr>
            <th className={clsx(TH, 'w-10')}>
              <input ref={cbRef} type="checkbox" checked={allSelected}
                onChange={() => onToggleAll(contacts)}
                className="w-3.5 h-3.5 rounded border-slate-300 text-primary focus:ring-primary/20 cursor-pointer"/>
            </th>
            <th className={TH}>Name</th>
            <th className={TH}>Phone</th>
            <th className={TH}>Email</th>
            <th className={TH}>Company</th>
            <th className={TH}>Source</th>
            <th className={TH}>Status</th>
            <th className={TH}>Tags</th>
            <th className={TH}>Last Contact</th>
            <th className={TH}>Agent</th>
            <th className={clsx(TH, 'text-right')}>Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-surface-border">
          {contacts.map(c => {
            const isSel  = selectedIds.has(c.id)
            const isActive = selId === c.id
            const isOptedIn = c.optIn && c.status === 'active'
            return (
              <tr key={c.id} onClick={() => onContactClick(c.id)}
                className={clsx(
                  'cursor-pointer transition-colors group',
                  isActive ? 'bg-primary-50' : isSel ? 'bg-primary-50/40' : 'hover:bg-slate-50/70'
                )}>
                <td className="px-3 py-2.5" onClick={e => e.stopPropagation()}>
                  <input type="checkbox" checked={isSel} onChange={() => onToggle(c.id)}
                    className="w-3.5 h-3.5 rounded border-slate-300 text-primary focus:ring-primary/20 cursor-pointer"/>
                </td>
                <td className="px-3 py-2.5">
                  <div className="flex items-center gap-2.5">
                    <div className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0"
                      style={{background:avBg().bg, color:avBg().color}}>
                      {inits(c.name)}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1">
                        <p className={clsx('text-[11px] font-semibold whitespace-nowrap', isActive ? 'text-primary' : 'text-slate-800')}>{c.name}</p>
                        {c.starred && <Star size={9} className="text-amber-400 fill-amber-400 flex-shrink-0"/>}
                      </div>
                    </div>
                  </div>
                </td>
                <td className="px-3 py-2.5 font-mono text-[11px] text-slate-600 whitespace-nowrap">{c.phone}</td>
                <td className="px-3 py-2.5 text-[11px] text-slate-500 max-w-[150px] truncate">{c.email || '—'}</td>
                <td className="px-3 py-2.5 text-[11px] text-slate-500 whitespace-nowrap">{c.company || '—'}</td>
                <td className="px-3 py-2.5">
                  <span className="px-1.5 py-0.5 rounded text-[9px] font-bold whitespace-nowrap"
                    style={{background:SRC[c.source]?.bg||'#f1f5f9', color:SRC[c.source]?.c||'#475569'}}>
                    {c.source}
                  </span>
                </td>
                <td className="px-3 py-2.5">
                  {c.status === 'blocked'
                    ? <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[9px] font-semibold bg-red-50 text-red-600"><Shield size={8}/>Blocked</span>
                    : isOptedIn
                      ? <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[9px] font-semibold bg-emerald-50 text-emerald-700"><CheckCircle2 size={8}/>Opted In</span>
                      : <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[9px] font-semibold bg-slate-100 text-slate-500"><XCircle size={8}/>Opted Out</span>
                  }
                </td>
                <td className="px-3 py-2.5">
                  <div className="flex flex-wrap gap-0.5">
                    {c.tags.slice(0,2).map(t => (
                      <span key={t} className="px-1.5 py-0.5 rounded-full text-[9px] font-bold capitalize whitespace-nowrap" style={tSt(t)}>{t}</span>
                    ))}
                    {c.tags.length > 2 && <span className="text-[9px] text-slate-400 self-center">+{c.tags.length-2}</span>}
                  </div>
                </td>
                <td className="px-3 py-2.5 text-[11px] text-slate-400 whitespace-nowrap">{fmtR(c.last)}</td>
                <td className="px-3 py-2.5 text-[11px] text-slate-500">{c.agent?.split(' ')[0] || '—'}</td>
                <td className="px-3 py-2.5 text-right" onClick={e => e.stopPropagation()}>
                  <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={() => onTemplate(c)} title="Send template"
                      className="p-1.5 rounded-lg hover:bg-primary-50 text-slate-400 hover:text-primary transition-colors">
                      <FileText size={12}/>
                    </button>
                    <button onClick={() => onCall(c)} title="Call"
                      className="p-1.5 rounded-lg hover:bg-primary-50 text-slate-400 hover:text-primary transition-colors">
                      <Phone size={12}/>
                    </button>
                  </div>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

/* ── send template modal (with params support) ───────────────── */
function TemplateModal({ contact, onClose }) {
  const [channel, setChannel] = useState('whatsapp')  // 'whatsapp' | 'email'
  const [step,    setStep]   = useState(1)
  const [sel,     setSel]    = useState(null)
  const [sent,    setSent]   = useState(false)
  const [q,       setQ]      = useState('')
  const [params,  setParams] = useState({})

  const tplList = channel === 'whatsapp' ? TEMPLATES : EMAIL_TEMPLATES
  const list = tplList.filter(t =>
    t.name.toLowerCase().includes(q.toLowerCase()) ||
    t.cat.toLowerCase().includes(q.toLowerCase())
  )

  const selTpl = tplList.find(t => t.id === sel)

  const paramNums = useMemo(() => {
    if (!selTpl) return []
    const matches = [...(selTpl.prev.matchAll(/\{\{(\d+)\}\}/g))]
    return [...new Set(matches.map(m => m[1]))].sort((a,b) => Number(a)-Number(b))
  }, [selTpl])

  const preview = useMemo(() => {
    if (!selTpl) return ''
    return selTpl.prev.replace(/\{\{(\d+)\}\}/g, (_, n) => params[n] || `{{${n}}}`)
  }, [selTpl, params])

  function selectTemplate(id) { setSel(id); setParams({}) }
  function goNext()  { if (sel) setStep(2) }
  function goBack()  { setStep(1); setSent(false) }
  function send()    { if (!sel) return; setSent(true); setTimeout(onClose, 1300) }
  const isWA = channel === 'whatsapp'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm"
      onClick={e => e.target===e.currentTarget && onClose()}>
      <div className="bg-white w-full max-w-md rounded-2xl shadow-modal flex flex-col max-h-[88vh] overflow-hidden border border-surface-border">

        {/* ── Header ── */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-surface-border">
          <div className={clsx('w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0',
            isWA ? 'bg-emerald-50 border border-emerald-100' : 'bg-blue-50 border border-blue-100')}>
            {isWA ? <MessageSquare size={13} className="text-emerald-600"/> : <Mail size={13} className="text-blue-600"/>}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="text-[13px] font-bold text-slate-900">Send Template</p>
              {/* channel tabs */}
              <div className="flex items-center gap-0.5 bg-slate-100 p-0.5 rounded-lg">
                <button onClick={() => { setChannel('whatsapp'); setSel(null); setStep(1) }}
                  className={clsx('flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold transition-all',
                    isWA ? 'bg-white shadow-sm text-slate-900' : 'text-slate-500 hover:text-slate-700')}>
                  <MessageSquare size={9}/>WA
                </button>
                <button onClick={() => { setChannel('email'); setSel(null); setStep(1) }}
                  className={clsx('flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold transition-all',
                    !isWA ? 'bg-white shadow-sm text-slate-900' : 'text-slate-500 hover:text-slate-700')}>
                  <Mail size={9}/>Email
                </button>
              </div>
            </div>
            <p className="text-[10px] text-slate-400 mt-0.5">
              {step===1 ? <>Step 1: Choose a template · To: <span className="font-semibold text-slate-600">{contact?.name}</span></>
                        : <>Step 2: Fill variables · <span className="font-semibold text-violet-600">{selTpl?.name}</span></>}
            </p>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-surface-hover text-slate-400 transition-colors">
            <X size={14}/>
          </button>
        </div>

        {/* ── Step 1: Search + Pick ── */}
        {step === 1 && (
          <>
            <div className="px-3 py-2 border-b border-surface-border">
              <div className="relative">
                <Search size={11} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"/>
                <input value={q} onChange={e=>setQ(e.target.value)} placeholder="Search templates…"
                  className="w-full pl-7 pr-3 py-1.5 text-[11px] rounded-lg bg-surface-hover border border-surface-border focus:outline-none focus:ring-2 focus:ring-primary/15 focus:border-primary/40 focus:bg-white transition-all placeholder-slate-400"/>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-3 space-y-1.5">
              {list.map(t => {
                const on = sel === t.id
                return (
                  <button key={t.id} onClick={() => selectTemplate(t.id)}
                    className={clsx('w-full text-left p-3 rounded-xl border transition-all',
                      on ? 'border-primary/30 bg-primary-50/50' : 'border-surface-border hover:border-slate-300 hover:bg-surface-hover')}>
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <span className="text-[12px] font-semibold text-slate-800 leading-snug">{t.name}</span>
                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        <span className={clsx('text-[9px] font-bold px-1.5 py-0.5 rounded-full',
                          t.cat==='Marketing'?'bg-amber-50 text-amber-700 border border-amber-200':'bg-sky-50 text-sky-700 border border-sky-200')}>
                          {t.cat}
                        </span>
                        {on && <Check size={11} className="text-primary"/>}
                      </div>
                    </div>
                    {t.headerType && t.headerType !== 'NONE' && (
                      <div className="mb-1">
                        {t.headerType === 'IMAGE'    && <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-pink-50 text-pink-600">🖼️ Image</span>}
                        {t.headerType === 'VIDEO'    && <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-purple-50 text-purple-600">🎥 Video</span>}
                        {t.headerType === 'DOCUMENT' && <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-blue-50 text-blue-600">📄 Document</span>}
                        {t.headerType === 'LOCATION' && <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-600">📍 Location</span>}
                        {t.headerType === 'TEXT'     && <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-slate-100 text-slate-600">✏️ Text header</span>}
                      </div>
                    )}
                    <p className="text-[11px] text-slate-500 leading-relaxed line-clamp-2">{t.prev}</p>
                  </button>
                )
              })}
              {!list.length && <p className="text-center text-[11px] text-slate-400 py-8">No templates found</p>}
            </div>
            <div className="flex items-center justify-between px-4 py-2.5 border-t border-surface-border">
              <button onClick={onClose} className="text-[11px] text-slate-400 hover:text-slate-600 transition-colors">Cancel</button>
              <button onClick={goNext} disabled={!sel}
                className={clsx('flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-semibold transition-all',
                  sel ? 'bg-primary text-white hover:bg-primary/90' : 'bg-slate-100 text-slate-400 cursor-not-allowed')}>
                Next <ChevronDown size={11} className="-rotate-90"/>
              </button>
            </div>
          </>
        )}

        {/* ── Step 2: Fill vars + preview ── */}
        {step === 2 && (
          <>
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {/* variables */}
              {paramNums.length > 0 && (
                <div>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2.5">Fill Template Variables</p>
                  <div className="space-y-3">
                    {paramNums.map(n => (
                      <div key={n} className="space-y-1.5">
                        <div className="flex items-center gap-2.5">
                          <span className="text-[11px] text-slate-500 font-mono w-9 flex-shrink-0 text-center bg-slate-50 border border-surface-border rounded px-1 py-0.5">
                            {'{{'}{n}{'}}'}
                          </span>
                          <input
                            autoFocus={n==='1'}
                            value={params[n]||''}
                            onChange={e => setParams(p=>({...p,[n]:e.target.value}))}
                            placeholder={`Type a value or pick a field →`}
                            className="flex-1 text-[11px] border border-surface-border rounded-lg px-2.5 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-primary/10 focus:border-primary/40 placeholder-slate-300"/>
                        </div>
                        {/* contact field quick-fill chips */}
                        <div className="flex flex-wrap gap-1 pl-11">
                          {CONTACT_FIELDS.filter(f => contact?.[f.key]).map(f => {
                            const val = contact[f.key]
                            const active = params[n] === val
                            return (
                              <button key={f.key} onClick={() => setParams(p => ({...p, [n]: active ? '' : val}))}
                                className={clsx('inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-semibold border transition-all',
                                  active
                                    ? 'bg-primary text-white border-primary'
                                    : 'bg-slate-50 text-slate-500 border-slate-200 hover:border-primary/40 hover:text-primary hover:bg-primary-50')}>
                                <span className="opacity-60">{f.label}:</span>
                                <span className="truncate max-w-[80px]">{String(val)}</span>
                              </button>
                            )
                          })}
                          {Object.entries(contact?.customAttrs || {}).map(([k, v]) => {
                            const active = params[n] === v
                            return (
                              <button key={k} onClick={() => setParams(p => ({...p, [n]: active ? '' : v}))}
                                className={clsx('inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-semibold border transition-all',
                                  active
                                    ? 'bg-violet-500 text-white border-violet-500'
                                    : 'bg-violet-50 text-violet-600 border-violet-200 hover:bg-violet-100')}>
                                <span className="opacity-70">{k}:</span>
                                <span className="truncate max-w-[80px]">{String(v)}</span>
                              </button>
                            )
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {/* preview */}
              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Message Preview</p>
                <div className={clsx('rounded-xl px-3 py-2.5 text-[11px] text-slate-800 leading-relaxed whitespace-pre-wrap shadow-sm',
                  isWA ? 'bg-[#dcf8c6]' : 'bg-blue-50 border border-blue-100')}>
                  {preview}
                </div>
                <p className="text-[10px] text-slate-400 mt-1.5 flex items-center gap-1">
                  <CheckCircle2 size={10} className="text-slate-300"/>Unfilled variables will appear as {'{{n}}'} in the sent message
                </p>
              </div>
            </div>
            <div className="flex items-center justify-between px-4 py-2.5 border-t border-surface-border">
              <button onClick={goBack} className="flex items-center gap-1 text-[11px] text-slate-400 hover:text-slate-600 transition-colors">
                <ChevronDown size={11} className="rotate-90"/> Back
              </button>
              <button onClick={send}
                className={clsx('flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-semibold transition-all',
                  sent ? 'bg-emerald-500 text-white' : 'bg-primary text-white hover:bg-primary/90')}>
                {sent ? <><CheckCircle2 size={11}/>Sent!</> : <><Send size={11}/>Send</>}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

/* ── bulk send template modal ────────────────────────────────── */
function BulkTemplateModal({ count, onClose, defaultChannel = 'whatsapp' }) {
  const [channel, setChannel] = useState(defaultChannel)
  const [step,    setStep]   = useState(1)
  const [sel,     setSel]    = useState(null)
  const [sent,    setSent]   = useState(false)
  const [q,       setQ]      = useState('')
  const [params,  setParams] = useState({})

  const tplList = channel === 'whatsapp' ? TEMPLATES : EMAIL_TEMPLATES
  const list = tplList.filter(t =>
    t.name.toLowerCase().includes(q.toLowerCase()) ||
    t.cat.toLowerCase().includes(q.toLowerCase())
  )
  const selTpl = tplList.find(t => t.id === sel)

  const paramNums = useMemo(() => {
    if (!selTpl) return []
    const matches = [...(selTpl.prev.matchAll(/\{\{(\d+)\}\}/g))]
    return [...new Set(matches.map(m => m[1]))].sort((a,b) => Number(a)-Number(b))
  }, [selTpl])

  const preview = useMemo(() => {
    if (!selTpl) return ''
    return selTpl.prev.replace(/\{\{(\d+)\}\}/g, (_, n) => params[n] || `{{${n}}}`)
  }, [selTpl, params])

  function selectTemplate(id) { setSel(id); setParams({}) }
  function goNext() { if (sel) setStep(2) }
  function goBack() { setStep(1); setSent(false) }
  function send()   { if (!sel) return; setSent(true); setTimeout(onClose, 1400) }
  const isWA = channel === 'whatsapp'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm"
      onClick={e => e.target===e.currentTarget && onClose()}>
      <div className="bg-white w-full max-w-md rounded-2xl shadow-modal flex flex-col max-h-[88vh] overflow-hidden border border-surface-border">

        {/* Header */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-surface-border">
          <div className={clsx('w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0',
            isWA ? 'bg-emerald-50 border border-emerald-100' : 'bg-blue-50 border border-blue-100')}>
            {isWA ? <MessageSquare size={13} className="text-emerald-600"/> : <Mail size={13} className="text-blue-600"/>}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="text-[13px] font-bold text-slate-900">Send to {count} contacts</p>
              <div className="flex items-center gap-0.5 bg-slate-100 p-0.5 rounded-lg">
                <button onClick={() => { setChannel('whatsapp'); setSel(null); setStep(1) }}
                  className={clsx('flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold transition-all',
                    isWA ? 'bg-white shadow-sm text-slate-900' : 'text-slate-500 hover:text-slate-700')}>
                  <MessageSquare size={9}/>WA
                </button>
                <button onClick={() => { setChannel('email'); setSel(null); setStep(1) }}
                  className={clsx('flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold transition-all',
                    !isWA ? 'bg-white shadow-sm text-slate-900' : 'text-slate-500 hover:text-slate-700')}>
                  <Mail size={9}/>Email
                </button>
              </div>
            </div>
            <p className="text-[10px] text-slate-400 mt-0.5">
              {step===1 ? `Step 1: Choose a ${isWA ? 'WhatsApp' : 'email'} template`
                        : <><span className="font-semibold text-violet-600">{selTpl?.name}</span> · Step 2: Fill variables</>}
            </p>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-surface-hover text-slate-400 transition-colors">
            <X size={14}/>
          </button>
        </div>

        {/* Step 1: pick */}
        {step === 1 && (
          <>
            <div className="px-3 py-2 border-b border-surface-border">
              <div className="relative">
                <Search size={11} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"/>
                <input value={q} onChange={e=>setQ(e.target.value)} placeholder="Search templates…"
                  className="w-full pl-7 pr-3 py-1.5 text-[11px] rounded-lg bg-surface-hover border border-surface-border focus:outline-none focus:ring-2 focus:ring-primary/15 focus:border-primary/40 focus:bg-white transition-all placeholder-slate-400"/>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-3 space-y-1.5">
              {list.map(t => {
                const on = sel === t.id
                return (
                  <button key={t.id} onClick={() => selectTemplate(t.id)}
                    className={clsx('w-full text-left p-3 rounded-xl border transition-all',
                      on ? 'border-primary/30 bg-primary-50/50' : 'border-surface-border hover:border-slate-300 hover:bg-surface-hover')}>
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <span className="text-[12px] font-semibold text-slate-800 leading-snug">{t.name}</span>
                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        <span className={clsx('text-[9px] font-bold px-1.5 py-0.5 rounded-full',
                          t.cat==='Marketing'?'bg-amber-50 text-amber-700 border border-amber-200':'bg-sky-50 text-sky-700 border border-sky-200')}>
                          {t.cat}
                        </span>
                        {on && <Check size={11} className="text-primary"/>}
                      </div>
                    </div>
                    <p className="text-[11px] text-slate-500 leading-relaxed line-clamp-2">{t.prev}</p>
                  </button>
                )
              })}
              {!list.length && <p className="text-center text-[11px] text-slate-400 py-8">No templates found</p>}
            </div>
            <div className="flex items-center justify-between px-4 py-2.5 border-t border-surface-border">
              <button onClick={onClose} className="text-[11px] text-slate-400 hover:text-slate-600 transition-colors">Cancel</button>
              <button onClick={goNext} disabled={!sel}
                className={clsx('flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-semibold transition-all',
                  sel ? 'bg-primary text-white hover:bg-primary/90' : 'bg-slate-100 text-slate-400 cursor-not-allowed')}>
                Next <ChevronDown size={11} className="-rotate-90"/>
              </button>
            </div>
          </>
        )}

        {/* Step 2: fill + preview */}
        {step === 2 && (
          <>
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {paramNums.length > 0 && (
                <div>
                  <div className="flex items-center justify-between mb-2.5">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Map Variables to Contact Fields</p>
                    <span className="text-[9px] text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">resolved per contact on send</span>
                  </div>
                  <div className="space-y-3">
                    {paramNums.map(n => (
                      <div key={n} className="space-y-1.5">
                        <div className="flex items-center gap-2.5">
                          <span className="text-[11px] text-slate-500 font-mono w-9 flex-shrink-0 text-center bg-slate-50 border border-surface-border rounded px-1 py-0.5">
                            {'{{'}{n}{'}}'}
                          </span>
                          <input autoFocus={n==='1'} value={params[n]||''} onChange={e=>setParams(p=>({...p,[n]:e.target.value}))}
                            placeholder="Type a value or pick a field below →"
                            className="flex-1 text-[11px] border border-surface-border rounded-lg px-2.5 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-primary/10 focus:border-primary/40 placeholder-slate-300"/>
                        </div>
                        {/* contact field token chips */}
                        <div className="flex flex-wrap gap-1 pl-11">
                          {CONTACT_FIELDS.map(f => {
                            const token = `[${f.key}]`
                            const active = params[n] === token
                            return (
                              <button key={f.key} onClick={() => setParams(p => ({...p, [n]: active ? '' : token}))}
                                className={clsx('px-1.5 py-0.5 rounded text-[9px] font-semibold border transition-all',
                                  active
                                    ? 'bg-primary text-white border-primary'
                                    : 'bg-slate-50 text-slate-500 border-slate-200 hover:border-primary/40 hover:text-primary hover:bg-primary-50')}>
                                {f.label}
                              </button>
                            )
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Preview Template</p>
                <div className={clsx('rounded-xl px-3 py-2.5 text-[11px] text-slate-800 leading-relaxed shadow-sm',
                  isWA ? 'bg-[#dcf8c6]' : 'bg-blue-50 border border-blue-100')}>
                  {/* render [field] tokens as styled badges inline */}
                  {preview.split(/(\[[a-z_]+\])/g).map((part, i) =>
                    /^\[[a-z_]+\]$/.test(part)
                      ? <span key={i} className="inline-flex items-center px-1 py-0.5 rounded bg-primary/15 text-primary text-[10px] font-bold mx-0.5">{part}</span>
                      : <span key={i}>{part}</span>
                  )}
                </div>
                <p className="text-[10px] text-slate-400 mt-1.5 flex items-center gap-1">
                  <CheckCircle2 size={10} className="text-slate-300"/>
                  <span className="text-primary font-semibold">[field]</span> tokens are replaced with each contact's data when sent
                </p>
              </div>
            </div>
            <div className="flex items-center justify-between px-4 py-2.5 border-t border-surface-border">
              <button onClick={goBack} className="flex items-center gap-1 text-[11px] text-slate-400 hover:text-slate-600 transition-colors">
                <ChevronDown size={11} className="rotate-90"/> Back
              </button>
              <button onClick={send}
                className={clsx('flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-semibold transition-all',
                  sent ? 'bg-emerald-500 text-white' : 'bg-primary text-white hover:bg-primary/90')}>
                {sent ? <><CheckCircle2 size={11}/>Sent to {count}!</> : <><Send size={11}/>Send to {count} contacts</>}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

/* ── call modal ──────────────────────────────────────────────── */
function CallModal({ c, onClose }) {
  const [ph, setPh] = useState('idle')
  useEffect(() => {
    if (ph==='calling') { const t=setTimeout(()=>setPh('live'),2200); return()=>clearTimeout(t) }
    if (ph==='ended')   { const t=setTimeout(onClose,1100); return()=>clearTimeout(t) }
  }, [ph])
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm"
      onClick={e => e.target===e.currentTarget && ph==='idle' && onClose()}>
      <div className="bg-white w-68 rounded-2xl shadow-modal overflow-hidden border border-surface-border">
        <div className="px-7 pt-8 pb-7 flex flex-col items-center text-center">
          <div className="relative mb-4">
            <div className="w-16 h-16 rounded-2xl flex items-center justify-center text-xl font-bold shadow-sm"
              style={{background:avBg().bg, color:avBg().color}}>{inits(c.name)}</div>
            {ph==='calling' && <span className="absolute inset-0 rounded-2xl border-4 border-emerald-400/40 animate-ping"/>}
            {ph==='live' && <span className="absolute -bottom-1 -right-1 w-5 h-5 bg-emerald-500 rounded-full flex items-center justify-center shadow-sm"><PhoneCall size={10} className="text-white"/></span>}
          </div>
          <p className="text-[14px] font-bold text-slate-900 mb-0.5">{c.name}</p>
          <p className="text-[11px] text-slate-400 font-mono mb-1">{c.phone}</p>
          <p className={clsx('text-[11px] font-semibold mb-6 min-h-4',
            ph==='calling'?'text-amber-500':ph==='live'?'text-emerald-600':'text-slate-400')}>
            {ph==='idle'?'WhatsApp Voice Call':ph==='calling'?'Calling…':ph==='live'?'Connected':'Call ended'}
          </p>
          {ph==='idle' && (
            <div className="flex gap-2 w-full">
              <button onClick={onClose} className="btn-secondary flex-1 justify-center text-xs">Cancel</button>
              <button onClick={()=>setPh('calling')} className="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg bg-emerald-500 text-white text-xs font-semibold hover:bg-emerald-600 transition-colors shadow-sm">
                <PhoneOutgoing size={12}/>Call Now
              </button>
            </div>
          )}
          {(ph==='calling'||ph==='live') && (
            <button onClick={()=>setPh('ended')} className="w-12 h-12 rounded-full bg-red-500 hover:bg-red-600 text-white flex items-center justify-center shadow-md transition-colors">
              <Phone size={18} className="rotate-[135deg]"/>
            </button>
          )}
          {ph==='ended' && <p className="text-xs text-slate-500 flex items-center gap-1.5"><CheckCircle2 size={12} className="text-emerald-500"/>Call ended</p>}
        </div>
      </div>
    </div>
  )
}

/* ── add contact modal ───────────────────────────────────────── */
function AddModal({ onClose, onAdd }) {
  const [f, setF]        = useState({ name:'', phone:'', email:'', company:'', city:'', language:'', source:'Manual', agent:'' })
  const [err, setErr]    = useState('')
  const [attrs, setAttrs]= useState([])          // [{key:'', val:''}]
  const [addingAttr, setAddingAttr] = useState(false)
  const [attrKey, setAttrKey] = useState('')
  const [attrVal, setAttrVal] = useState('')

  const up = k => e => setF(p => ({...p, [k]: e.target.value}))
  const fi = 'w-full text-[11px] border border-surface-border rounded-lg px-2.5 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-primary/15 focus:border-primary/40 placeholder-slate-300 transition-all'
  const lb = 'block text-[10px] font-semibold text-slate-500 mb-1'

  function addAttr() {
    const k = attrKey.trim(), v = attrVal.trim()
    if (!k) return
    setAttrs(p => [...p.filter(a => a.key !== k), {key: k, val: v}])
    setAttrKey(''); setAttrVal(''); setAddingAttr(false)
  }

  function submit() {
    if (!f.name.trim())  { setErr('Name is required');  return }
    if (!f.phone.trim()) { setErr('Phone is required'); return }
    const customAttrs = {}
    attrs.forEach(a => { if (a.key) customAttrs[a.key] = a.val })
    onAdd({
      ...f, id: String(Date.now()), starred: false, optIn: true, status: 'active', tags: [],
      agent: f.agent || null, convos: 0,
      created: new Date().toISOString().slice(0,10),
      last:    new Date().toISOString().slice(0,10),
      notes: '', score: 50, aiSummary: '', customAttrs,
      log: [{t:'created', text:'Created manually', date: new Date().toISOString().slice(0,10)}]
    })
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm"
      onClick={e => e.target===e.currentTarget && onClose()}>
      <div className="bg-white w-full max-w-md rounded-2xl shadow-modal flex flex-col max-h-[88vh] overflow-hidden border border-surface-border">

        {/* Header */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-surface-border flex-shrink-0">
          <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
            style={{background: avBg().bg}}>
            <UserPlus size={13} style={{color: avBg().color}}/>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[13px] font-bold text-slate-900">Add New Contact</p>
            <p className="text-[10px] text-slate-400">Fill in the details below to create a contact</p>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-surface-hover text-slate-400 transition-colors">
            <X size={14}/>
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">

          {/* Basic Info */}
          <div>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2.5">Basic Information</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <div>
                <label className={lb}>Name <span className="text-red-400">*</span></label>
                <input className={fi} placeholder="Priya Sharma" value={f.name} onChange={up('name')} autoFocus/>
              </div>
              <div>
                <label className={lb}>Phone <span className="text-red-400">*</span></label>
                <input className={fi} placeholder="+91 98765 43210" value={f.phone} onChange={up('phone')}/>
              </div>
              <div>
                <label className={lb}>Email</label>
                <input type="email" className={fi} placeholder="priya@email.com" value={f.email} onChange={up('email')}/>
              </div>
              <div>
                <label className={lb}>Company</label>
                <input className={fi} placeholder="Acme Corp" value={f.company} onChange={up('company')}/>
              </div>
              <div>
                <label className={lb}>City</label>
                <input className={fi} placeholder="Mumbai" value={f.city} onChange={up('city')}/>
              </div>
              <div>
                <label className={lb}>Language</label>
                <NativeSelect value={f.language} onChange={up('language')} sm>
                  <option value="">Select…</option>
                  {LANGS.map(l => <option key={l}>{l}</option>)}
                </NativeSelect>
              </div>
              <div>
                <label className={lb}>Source</label>
                <NativeSelect value={f.source} onChange={up('source')} sm>
                  {SOURCES.map(s => <option key={s}>{s}</option>)}
                </NativeSelect>
              </div>
              <div>
                <label className={lb}>Assign To</label>
                <NativeSelect value={f.agent} onChange={up('agent')} sm>
                  <option value="">Unassigned</option>
                  {AGENTS.map(a => <option key={a}>{a}</option>)}
                </NativeSelect>
              </div>
            </div>
          </div>

          {/* Custom Attributes */}
          <div>
            <div className="flex items-center justify-between mb-2.5">
              <div className="flex items-center gap-1.5">
                <Variable size={11} className="text-slate-400"/>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Custom Attributes</p>
              </div>
              <button onClick={() => setAddingAttr(p => !p)}
                className="flex items-center gap-1 text-[11px] text-primary font-semibold hover:underline">
                <Plus size={11}/>Add
              </button>
            </div>

            <div className="space-y-1.5">
              {attrs.map((a, i) => (
                <div key={i} className="flex items-center gap-2 bg-slate-50 rounded-lg px-3 py-1.5 border border-surface-border">
                  <span className="text-[10px] font-bold text-slate-400 font-mono min-w-[70px] truncate">{a.key}</span>
                  <span className="text-[11px] text-slate-500 mx-1">→</span>
                  <span className="flex-1 text-[11px] text-slate-700 font-medium truncate">{a.val || '—'}</span>
                  <button onClick={() => setAttrs(p => p.filter((_,j) => j !== i))}
                    className="text-slate-300 hover:text-red-400 transition-colors flex-shrink-0"><X size={11}/></button>
                </div>
              ))}
              {!attrs.length && !addingAttr && (
                <p className="text-[11px] text-slate-300 italic px-1">No custom attributes yet</p>
              )}
            </div>

            {addingAttr && (
              <div className="mt-2 space-y-2">
                <div className="grid grid-cols-2 gap-2">
                  <input autoFocus value={attrKey} onChange={e => setAttrKey(e.target.value)}
                    placeholder="Variable name"
                    className={fi}/>
                  <input value={attrVal} onChange={e => setAttrVal(e.target.value)}
                    onKeyDown={e => { if(e.key==='Enter') addAttr(); if(e.key==='Escape') setAddingAttr(false) }}
                    placeholder="Value"
                    className={fi}/>
                </div>
                <div className="flex gap-2">
                  <button onClick={addAttr}
                    className="flex-1 py-1.5 rounded-lg bg-primary text-white text-[11px] font-semibold hover:bg-primary/90">
                    Add Attribute
                  </button>
                  <button onClick={() => { setAddingAttr(false); setAttrKey(''); setAttrVal('') }}
                    className="px-3 py-1.5 rounded-lg border border-surface-border text-slate-400 text-[11px] hover:bg-surface-hover">
                    Cancel
                  </button>
                </div>
                <p className="text-[10px] text-slate-400">
                  Use these in Broadcasting → template variable mapping (e.g. <span className="font-mono bg-slate-100 px-1 rounded">order_id</span>, <span className="font-mono bg-slate-100 px-1 rounded">plan</span>)
                </p>
              </div>
            )}
          </div>

          {err && (
            <p className="text-[11px] text-red-500 bg-red-50 border border-red-100 px-3 py-2 rounded-lg flex items-center gap-1.5">
              <X size={11}/>{err}
            </p>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-4 py-2.5 border-t border-surface-border flex-shrink-0">
          <button onClick={onClose} className="text-[11px] text-slate-400 hover:text-slate-600 transition-colors">Cancel</button>
          <button onClick={submit}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary text-white text-[11px] font-semibold hover:bg-primary/90 transition-colors">
            <UserPlus size={11}/>Add Contact
          </button>
        </div>
      </div>
    </div>
  )
}

/* ── create group modal ──────────────────────────────────────── */
const GROUP_COLORS = ['#8B5CF6','#f59e0b','#10b981','#3b82f6','#f43f5e','#64748b']

function CreateGroupModal({ onClose, onSave }) {
  const [name,  setName]  = useState('')
  const [color, setColor] = useState(GROUP_COLORS[0])
  const [desc,  setDesc]  = useState('')
  const [err,   setErr]   = useState('')
  const fi = 'w-full text-[11px] border border-surface-border rounded-lg px-2.5 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-primary/15 focus:border-primary/40 placeholder-slate-300 transition-all'

  function save() {
    if (!name.trim()) { setErr('Group name is required'); return }
    onSave({ id: 'grp' + Date.now(), name: name.trim(), color, desc: desc.trim() })
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm"
      onClick={e => e.target===e.currentTarget && onClose()}>
      <div className="bg-white w-full max-w-sm rounded-2xl shadow-modal flex flex-col overflow-hidden border border-surface-border">
        {/* Header */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-surface-border flex-shrink-0">
          <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
            style={{background:'#EEF4FF'}}>
            <Users size={13} style={{color:'#2563EB'}}/>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[13px] font-bold text-slate-900">Create Group</p>
            <p className="text-[10px] text-slate-400">Organise contacts into a named group</p>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-surface-hover text-slate-400 transition-colors">
            <X size={14}/>
          </button>
        </div>

        {/* Body */}
        <div className="p-4 space-y-4">
          <div>
            <label className="block text-[10px] font-semibold text-slate-500 mb-1">Group Name <span className="text-red-400">*</span></label>
            <input autoFocus className={fi} placeholder="e.g. Premium Members" value={name} onChange={e=>setName(e.target.value)}/>
          </div>
          <div>
            <label className="block text-[10px] font-semibold text-slate-500 mb-2">Color</label>
            <div className="flex gap-2 flex-wrap">
              {GROUP_COLORS.map(c => (
                <button key={c} onClick={() => setColor(c)}
                  className="w-7 h-7 rounded-full border-2 transition-all"
                  style={{background:c, borderColor: color===c ? '#1e40af' : 'transparent', outline: color===c ? '2px solid #93c5fd' : 'none'}}/>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-[10px] font-semibold text-slate-500 mb-1">Description <span className="text-slate-300">(optional)</span></label>
            <input className={fi} placeholder="Short description…" value={desc} onChange={e=>setDesc(e.target.value)}/>
          </div>
          {err && (
            <p className="text-[11px] text-red-500 bg-red-50 border border-red-100 px-3 py-2 rounded-lg flex items-center gap-1.5">
              <X size={11}/>{err}
            </p>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-4 py-2.5 border-t border-surface-border flex-shrink-0">
          <button onClick={onClose} className="text-[11px] text-slate-400 hover:text-slate-600 transition-colors">Cancel</button>
          <button onClick={save}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary text-white text-[11px] font-semibold hover:bg-primary/90 transition-colors">
            <Plus size={11}/>Create Group
          </button>
        </div>
      </div>
    </div>
  )
}

/* ── import modal ─────────────────────────────────────────────── */
function parseCSV(text) {
  const lines = text.split(/\r?\n/).filter(l => l.trim())
  if (!lines.length) return []
  function parseLine(line) {
    const fields = []
    let cur = '', inQ = false
    for (let i = 0; i < line.length; i++) {
      const ch = line[i]
      if (ch === '"') { inQ = !inQ }
      else if (ch === ',' && !inQ) { fields.push(cur.trim()); cur = '' }
      else { cur += ch }
    }
    fields.push(cur.trim())
    return fields
  }
  const headers = parseLine(lines[0]).map(h => h.toLowerCase().replace(/^"|"$/g,''))
  const map = h => {
    if (['name','full name','full_name'].includes(h)) return 'name'
    if (['phone','mobile','phone number'].includes(h)) return 'phone'
    if (['email'].includes(h)) return 'email'
    if (['company','organisation','organization','business'].includes(h)) return 'company'
    if (['city','location'].includes(h)) return 'city'
    if (['language','lang'].includes(h)) return 'language'
    if (['tags','tag'].includes(h)) return 'tags'
    if (['agent','assigned to','assigned_to'].includes(h)) return 'agent'
    if (['notes','note'].includes(h)) return 'notes'
    if (['source'].includes(h)) return 'source'
    return null
  }
  const today = new Date().toISOString().slice(0,10)
  return lines.slice(1).filter(l=>l.trim()).map((line, i) => {
    const vals = parseLine(line)
    const row = {}
    const customAttrs = {}
    headers.forEach((h, idx) => {
      const key = map(h)
      const val = (vals[idx]||'').replace(/^"|"$/g,'').trim()
      if (key) {
        row[key] = val
      } else if (h && val) {
        customAttrs[h] = val
      }
    })
    if (!row.name && !row.phone) return null
    return {
      id: `imp_${Date.now()}_${i}`,
      name: row.name || '',
      phone: row.phone || '',
      email: row.email || '',
      company: row.company || '',
      city: row.city || '',
      language: row.language || '',
      source: row.source || 'Import',
      tags: row.tags ? row.tags.split(';').map(t=>t.trim()).filter(Boolean) : [],
      agent: row.agent || null,
      notes: row.notes || '',
      starred: false,
      optIn: true,
      status: 'active',
      convos: 0,
      created: today,
      last: today,
      score: 50,
      aiSummary: '',
      customAttrs: Object.keys(customAttrs).length ? customAttrs : {},
      groupIds: [],
      log: [{t:'created', text:'Imported via CSV', date: today}],
    }
  }).filter(Boolean)
}

const TPL_STATUS_CFG = {
  APPROVED: { bg: 'bg-emerald-50', text: 'text-emerald-700', ring: 'ring-emerald-200', dot: 'bg-emerald-500', label: 'Approved' },
  PENDING:  { bg: 'bg-amber-50',   text: 'text-amber-700',   ring: 'ring-amber-200',   dot: 'bg-amber-400',  label: 'Pending Approval' },
  REJECTED: { bg: 'bg-red-50',     text: 'text-red-700',     ring: 'ring-red-200',     dot: 'bg-red-500',    label: 'Rejected' },
}
function TplStatusPill({ status }) {
  const cfg = TPL_STATUS_CFG[status] || TPL_STATUS_CFG.APPROVED
  return (
    <span className={clsx('inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-semibold ring-1 flex-shrink-0', cfg.bg, cfg.text, cfg.ring)}>
      <span className={clsx('w-1.5 h-1.5 rounded-full flex-shrink-0', cfg.dot)} />
      {cfg.label}
    </span>
  )
}

/** Extra sheet columns a template needs, beyond Name/Phone — body {{n}} params + dynamic-URL CTA params */
function getTemplateColumns(tpl) {
  if (!tpl) return []
  const bodyParams = extractParams(tpl)
  const ctaButtons = getDynamicUrlButtons(tpl)
  return [
    ...bodyParams.map(p => ({ key: `body_param_${p}`, label: `Body Param ${p}`, hint: `Fills {{${p}}} in the message body` })),
    ...ctaButtons.map(btn => ({ key: `cta_${btn.index + 1}_param`, label: `${btn.text} — Link Param`, hint: `Fills {{1}} in the "${btn.text}" button URL` })),
  ]
}

function downloadTemplateSampleSheet(tpl) {
  const cols = getTemplateColumns(tpl)
  const headers = ['name', 'phone', ...cols.map(c => c.key)]
  const exampleRows = [
    ['Priya Sharma', '+919876543210', ...cols.map(() => 'value')],
    ['Rahul Mehta',  '+918234109876', ...cols.map(() => 'value')],
  ]
  const csv = [headers.join(','), ...exampleRows.map(r => r.join(','))].join('\n')
  const blob = new Blob([csv], { type: 'text/csv' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = `${tpl.name}_import_sheet.csv`
  a.click()
  URL.revokeObjectURL(a.href)
}

function ImportModal({ onClose, onImport, groups = [] }) {
  const { customFields, addCustomField } = useApp()
  const [step, setStep] = useState('purpose')       // purpose | template-select | template-sheet | upload | preview | done
  const [purpose, setPurpose] = useState(null)       // 'general' | 'template'
  const [templateId, setTemplateId] = useState('')
  const [copiedHeaders, setCopiedHeaders] = useState(false)
  const [parsed, setParsed] = useState([])
  const [drag, setDrag] = useState(false)
  const [assignGroup, setAssignGroup] = useState('')
  const [selectedCustomKeys, setSelectedCustomKeys] = useState([])
  const [newCustomFieldName, setNewCustomFieldName] = useState('')
  const fileRef = useRef(null)

  const [templateStatusFilter, setTemplateStatusFilter] = useState('ALL')
  const templateStatusTabs = [
    { key: 'ALL',      label: 'All',      count: APPROVED_TEMPLATES.length },
    { key: 'APPROVED', label: 'Approved', count: APPROVED_TEMPLATES.filter(t=>t.status==='APPROVED').length },
    { key: 'PENDING',  label: 'Pending Approval', count: APPROVED_TEMPLATES.filter(t=>t.status==='PENDING').length },
    { key: 'REJECTED', label: 'Rejected', count: APPROVED_TEMPLATES.filter(t=>t.status==='REJECTED').length },
  ]
  const visibleTemplates = APPROVED_TEMPLATES.filter(t => templateStatusFilter === 'ALL' || t.status === templateStatusFilter)
  const selectedTemplate = APPROVED_TEMPLATES.find(t => t.id === templateId) || null
  const templateColumns = getTemplateColumns(selectedTemplate)

  function toggleCustomKey(key) {
    setSelectedCustomKeys(prev => prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key])
  }
  function addAndSelectCustomField() {
    const name = newCustomFieldName.trim()
    if (!name) return
    const key = name.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '')
    if (!customFields.contact.some(f => f.key === key)) {
      addCustomField('contact', { id: Date.now(), name, key, type: 'text', required: false })
    }
    setSelectedCustomKeys(prev => prev.includes(key) ? prev : [...prev, key])
    setNewCustomFieldName('')
  }

  function handleFile(file) {
    if (!file) return
    const reader = new FileReader()
    reader.onload = e => {
      const contacts = parseCSV(e.target.result)
      setParsed(contacts)
      setStep('preview')
    }
    reader.readAsText(file)
  }

  function doImport() {
    const toImport = parsed.map(c => ({
      ...c,
      groupIds: assignGroup ? [...(c.groupIds||[]), assignGroup].filter((v,i,a)=>a.indexOf(v)===i) : (c.groupIds||[]),
      ...(purpose === 'template' && selectedTemplate ? {
        source: 'Import',
        tags: [...new Set([...(c.tags||[]), 'template-ready'])],
        readyTemplateId: selectedTemplate.id,
        readyTemplateName: selectedTemplate.name,
      } : {}),
    }))
    onImport(toImport)
    setStep('done')
    setTimeout(onClose, 1800)
  }

  function copyHeaders() {
    const headers = ['name', 'phone', ...templateColumns.map(c => c.key)]
    navigator.clipboard?.writeText(headers.join('\t'))
    setCopiedHeaders(true)
    setTimeout(() => setCopiedHeaders(false), 2000)
  }

  const hasCustomAttrs = parsed.some(c => Object.keys(c.customAttrs||{}).length > 0)
  const missingParamsCount = purpose === 'template' && templateColumns.length > 0
    ? parsed.filter(c => templateColumns.some(col => !(c.customAttrs||{})[col.key])).length
    : 0

  const TITLES = {
    purpose: 'What are you importing for?',
    'template-select': 'Choose an approved template',
    'template-sheet': 'Prepare your data sheet',
    upload: 'Upload a CSV file',
    preview: `Preview — ${parsed.length} contacts found`,
    done: 'Import complete',
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm"
      onClick={e => e.target===e.currentTarget && onClose()}>
      <div className="bg-white w-full max-w-lg rounded-2xl shadow-modal overflow-hidden border border-surface-border flex flex-col max-h-[85vh]">
        {/* header */}
        <div className="flex items-center gap-3 px-4 py-3.5 border-b border-surface-border">
          {step !== 'purpose' && step !== 'done' && (
            <button
              onClick={() => {
                if (step === 'template-select') { setStep('purpose'); setPurpose(null) }
                else if (step === 'template-sheet') setStep('template-select')
                else if (step === 'upload') setStep(purpose === 'template' ? 'template-sheet' : 'purpose')
                else if (step === 'preview') setStep('upload')
              }}
              className="p-1 rounded-lg hover:bg-surface-hover text-slate-400 transition-colors flex-shrink-0">
              <ArrowLeft size={14}/>
            </button>
          )}
          <div className="w-8 h-8 rounded-xl bg-violet-50 border border-violet-100 flex items-center justify-center flex-shrink-0">
            <FileUp size={14} className="text-violet-600"/>
          </div>
          <div className="flex-1">
            <p className="text-[13px] font-bold text-slate-900">Import Contacts</p>
            <p className="text-[11px] text-slate-400">{TITLES[step]}</p>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-surface-hover text-slate-400 transition-colors"><X size={14}/></button>
        </div>

        <div className="flex-1 overflow-y-auto">
          {/* Step 0: Purpose */}
          {step === 'purpose' && (
            <div className="p-5 space-y-3">
              <button
                onClick={() => { setPurpose('general'); setStep('upload') }}
                className="w-full flex items-start gap-3 p-4 rounded-xl border-2 border-slate-200 hover:border-primary hover:bg-primary-50/40 transition-colors text-left">
                <div className="w-9 h-9 rounded-lg bg-slate-100 flex items-center justify-center flex-shrink-0">
                  <Database size={16} className="text-slate-500"/>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-bold text-slate-800">General Import</p>
                  <p className="text-[11px] text-slate-500 mt-0.5">Just storing contacts — CRM records, lead lists, general contact info.</p>
                </div>
                <ArrowRight size={14} className="text-slate-300 flex-shrink-0 mt-1"/>
              </button>

              <button
                onClick={() => { setPurpose('template'); setStep('template-select') }}
                className="w-full flex items-start gap-3 p-4 rounded-xl border-2 border-slate-200 hover:border-primary hover:bg-primary-50/40 transition-colors text-left">
                <div className="w-9 h-9 rounded-lg bg-emerald-50 flex items-center justify-center flex-shrink-0">
                  <MessageSquareText size={16} className="text-emerald-600"/>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-bold text-slate-800">For Sending a Template</p>
                  <p className="text-[11px] text-slate-500 mt-0.5">Pick an approved WhatsApp template — we'll generate a sheet with exactly the columns its dynamic params need.</p>
                </div>
                <ArrowRight size={14} className="text-slate-300 flex-shrink-0 mt-1"/>
              </button>
            </div>
          )}

          {/* Step: Template select */}
          {step === 'template-select' && (
            <div className="p-5 space-y-4">
              {/* Status filter tabs */}
              <div className="flex items-center gap-1.5 flex-wrap">
                {templateStatusTabs.map(tab => (
                  <button key={tab.key} type="button"
                    onClick={() => { setTemplateStatusFilter(tab.key); if (!visibleTemplates.some(t=>t.id===templateId)) setTemplateId('') }}
                    className={clsx('flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-semibold border transition-colors',
                      templateStatusFilter === tab.key
                        ? 'bg-primary text-white border-primary'
                        : 'bg-white text-slate-600 border-slate-200 hover:border-primary/40')}>
                    {tab.label}
                    <span className={clsx('text-[10px] px-1 rounded-full',
                      templateStatusFilter === tab.key ? 'bg-white/20' : 'bg-slate-100 text-slate-400')}>{tab.count}</span>
                  </button>
                ))}
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1.5">Template</label>
                <NativeSelect value={templateId} onChange={e=>setTemplateId(e.target.value)}>
                  <option value="">Select a template…</option>
                  {visibleTemplates.map(t => (
                    <option key={t.id} value={t.id}>
                      {t.name} · {t.category}{templateStatusFilter === 'ALL' && t.status !== 'APPROVED' ? ` · ${TPL_STATUS_CFG[t.status]?.label}` : ''}
                    </option>
                  ))}
                </NativeSelect>
                {visibleTemplates.length === 0 && (
                  <p className="text-[11px] text-slate-400 mt-1.5">No templates in this status.</p>
                )}
              </div>

              {selectedTemplate && (
                <div className="rounded-xl border border-surface-border overflow-hidden">
                  <div className="flex items-center justify-between gap-2 bg-slate-50 px-3.5 py-2.5 border-b border-surface-border">
                    <p className="text-[11px] font-semibold text-slate-700">{selectedTemplate.body}</p>
                    <TplStatusPill status={selectedTemplate.status}/>
                  </div>
                  <div className="p-3.5 space-y-2.5">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] text-slate-500">Body dynamic params</span>
                      <span className="text-[11px] font-bold text-slate-800">{extractParams(selectedTemplate).length}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] text-slate-500">CTA button dynamic params</span>
                      <span className="text-[11px] font-bold text-slate-800">{getDynamicUrlButtons(selectedTemplate).length}</span>
                    </div>
                    {selectedTemplate.buttons.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 pt-1">
                        {selectedTemplate.buttonDefs.map((b,i) => (
                          <span key={i} className={clsx('px-2 py-0.5 rounded-full text-[10px] font-semibold border',
                            b.type==='URL' && b.url?.includes('{{') ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-slate-100 text-slate-500 border-slate-200')}>
                            {b.text}{b.type==='URL' && b.url?.includes('{{') && ' (dynamic)'}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                  {selectedTemplate.status !== 'APPROVED' && (
                    <div className="flex items-center gap-2 px-3.5 py-2.5 bg-amber-50 border-t border-amber-100">
                      <AlertTriangle size={12} className="text-amber-600 flex-shrink-0"/>
                      <p className="text-[10px] text-amber-700">
                        {selectedTemplate.status === 'PENDING'
                          ? "Still awaiting Meta approval — you can prepare the sheet now, but sending will only unlock once it's approved."
                          : "This template was rejected and can't be sent. You can still prepare a sheet, but you'll need an approved template to broadcast."}
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Step: Template sheet generation */}
          {step === 'template-sheet' && selectedTemplate && (
            <div className="p-5 space-y-4">
              <div className="bg-slate-50 rounded-xl p-3.5 border border-surface-border">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Required Columns</p>
                <div className="space-y-1.5">
                  {[{key:'name',label:'Name',hint:'Contact display name'},{key:'phone',label:'Phone',hint:'WhatsApp number, with country code'},...templateColumns].map(col => (
                    <div key={col.key} className="flex items-center justify-between gap-2 bg-white rounded-lg border border-slate-200 px-2.5 py-1.5">
                      <span className="text-[11px] font-mono text-slate-700">{col.key}</span>
                      <span className="text-[10px] text-slate-400 text-right">{col.hint}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <button onClick={() => downloadTemplateSampleSheet(selectedTemplate)}
                  className="flex flex-col items-center gap-1.5 p-3.5 rounded-xl border border-surface-border hover:border-primary hover:bg-primary-50/40 transition-colors">
                  <Download size={18} className="text-primary"/>
                  <span className="text-[11px] font-semibold text-slate-700">Downloadable Sheet</span>
                  <span className="text-[9px] text-slate-400 text-center">CSV with the right headers, ready to fill</span>
                </button>
                <a href="https://docs.google.com/spreadsheets/create" target="_blank" rel="noopener noreferrer"
                  onClick={copyHeaders}
                  className="flex flex-col items-center gap-1.5 p-3.5 rounded-xl border border-surface-border hover:border-primary hover:bg-primary-50/40 transition-colors">
                  <FileSpreadsheet size={18} className="text-emerald-600"/>
                  <span className="text-[11px] font-semibold text-slate-700 flex items-center gap-1">Custom Google Sheet <ExternalLink size={9}/></span>
                  <span className="text-[9px] text-slate-400 text-center">
                    {copiedHeaders ? <span className="text-emerald-600 font-semibold flex items-center justify-center gap-0.5"><Copy size={8}/> Headers copied — paste into row 1</span> : 'Opens a blank sheet + copies headers'}
                  </span>
                </a>
              </div>

              <p className="text-[10px] text-slate-400">Fill one row per contact, then continue to upload the completed sheet as CSV.</p>
            </div>
          )}

          {/* Step: Upload */}
          {step==='upload' && (
            <div className="p-5 space-y-4">
              <div
                onDragOver={e=>{e.preventDefault();setDrag(true)}}
                onDragLeave={()=>setDrag(false)}
                onDrop={e=>{e.preventDefault();setDrag(false);handleFile(e.dataTransfer.files[0])}}
                onClick={()=>fileRef.current?.click()}
                className={clsx('border-2 border-dashed rounded-xl p-10 flex flex-col items-center justify-center cursor-pointer transition-colors',
                  drag?'border-primary bg-primary-50':'border-slate-200 hover:border-slate-300 hover:bg-slate-50')}>
                <Upload size={28} className={clsx('mb-3', drag?'text-primary':'text-slate-300')}/>
                <p className="text-[13px] font-semibold text-slate-600">Drop CSV file here</p>
                <p className="text-[11px] text-slate-400 mt-1">or click to browse</p>
                <input ref={fileRef} type="file" accept=".csv" className="hidden" onChange={e=>handleFile(e.target.files[0])}/>
              </div>
              <div className="bg-slate-50 rounded-xl p-3.5 border border-surface-border">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Expected Columns</p>
                <div className="flex flex-wrap gap-1.5">
                  {(purpose === 'template'
                    ? ['Name','Phone', ...templateColumns.map(c=>c.key)]
                    : ['Name','Phone','Email','Company','City','Language','Tags (;-sep)','Agent','Source','Notes', ...selectedCustomKeys]
                  ).map(col=>(
                    <span key={col} className="px-2 py-0.5 bg-white border border-slate-200 rounded-md text-[10px] font-mono text-slate-600">{col}</span>
                  ))}
                </div>
                <p className="text-[10px] text-slate-400 mt-2">Name or Phone is required. All other fields are optional.</p>
                {purpose === 'template' ? (
                  <p className="text-[10px] text-slate-500 mt-1.5 flex items-center gap-1">
                    <span className="font-semibold text-violet-600">+</span> Column names must match exactly so we can map them to <span className="font-semibold">{selectedTemplate?.name}</span>'s params
                  </p>
                ) : (
                  <p className="text-[10px] text-slate-500 mt-1.5 flex items-center gap-1">
                    <span className="font-semibold text-violet-600">+</span> Any other column name → stored as <span className="font-semibold">Custom Attribute</span> (usable in Broadcasting template params)
                  </p>
                )}
                {purpose !== 'template' && (
                  <div className="mt-3 pt-3 border-t border-slate-200">
                    <button
                      onClick={() => {
                        const extraHeaders = selectedCustomKeys.join(',')
                        const extraVals    = selectedCustomKeys.map(() => 'value').join(',')
                        const csv = [
                          `Name,Phone,Email,Company,City,Language,Tags,Agent,Source,Notes,order_id,plan${extraHeaders ? ','+extraHeaders : ''}`,
                          `Priya Sharma,+919876543210,priya@example.com,Sharma Enterprises,Mumbai,Hindi,vip;customer,Riya Patel,WhatsApp,VIP customer,ORD-1001,premium${extraVals ? ','+extraVals : ''}`,
                          `Rahul Mehta,+918234109876,rahul@techcorp.com,TechCorp Solutions,Delhi,English,lead,Arjun Dev,CTWA,,ORD-1002,basic${extraVals ? ','+extraVals : ''}`,
                          `Anita Kapoor,+919123456789,anita@example.com,Kapoor & Co,Pune,Marathi,appointment,,WhatsApp,Follow up next week,,${extraVals ? ','+extraVals : ''}`,
                        ].join('\n')
                        const blob = new Blob([csv], { type: 'text/csv' })
                        const a = document.createElement('a')
                        a.href = URL.createObjectURL(blob)
                        a.download = 'contacts_sample.csv'
                        a.click()
                        URL.revokeObjectURL(a.href)
                      }}
                      className="flex items-center gap-1.5 text-[10px] font-semibold text-violet-600 hover:text-violet-700 transition-colors">
                      <Download size={11}/> Download sample CSV
                    </button>
                  </div>
                )}
              </div>

              {/* Custom fields to include — general purpose only */}
              {purpose !== 'template' && (
                <div className="bg-slate-50 rounded-xl p-3.5 border border-surface-border">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Custom Fields (optional)</p>
                  <p className="text-[10px] text-slate-500 mb-2.5">Pick fields to include as extra columns — matched from Settings → Custom Fields, or add a new one.</p>
                  <div className="flex flex-wrap gap-1.5 mb-2.5">
                    {customFields.contact.map(f => (
                      <button key={f.id} type="button" onClick={() => toggleCustomKey(f.key)}
                        className={clsx('px-2 py-1 rounded-lg border text-[10px] font-semibold transition-colors flex items-center gap-1',
                          selectedCustomKeys.includes(f.key)
                            ? 'bg-primary text-white border-primary'
                            : 'bg-white text-slate-600 border-slate-200 hover:border-primary/40')}>
                        {selectedCustomKeys.includes(f.key) && <Check size={10}/>}
                        {f.name}
                      </button>
                    ))}
                    {customFields.contact.length === 0 && (
                      <span className="text-[10px] text-slate-400 italic">No custom fields defined yet</span>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5">
                    <input
                      value={newCustomFieldName}
                      onChange={e=>setNewCustomFieldName(e.target.value)}
                      onKeyDown={e=>{ if (e.key==='Enter') { e.preventDefault(); addAndSelectCustomField() } }}
                      placeholder="New custom field name…"
                      className="flex-1 text-[11px] border border-surface-border rounded-lg px-2.5 py-1.5 text-slate-700 bg-white focus:outline-none focus:border-primary/40"
                    />
                    <button type="button" onClick={addAndSelectCustomField} disabled={!newCustomFieldName.trim()}
                      className={clsx('flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[10px] font-semibold transition-colors flex-shrink-0',
                        newCustomFieldName.trim() ? 'bg-primary text-white hover:bg-primary/90' : 'bg-slate-100 text-slate-400 cursor-not-allowed')}>
                      <Plus size={11}/> Add
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Step: Preview */}
          {step==='preview' && (
            <div className="p-4">
              {parsed.length === 0
                ? <div className="text-center py-10">
                    <p className="text-sm text-slate-500 mb-1">No valid contacts found</p>
                    <p className="text-[12px] text-slate-400">Make sure your CSV has Name or Phone columns.</p>
                  </div>
                : <>
                    <p className="text-[11px] text-slate-500 mb-2">Showing first {Math.min(10, parsed.length)} of {parsed.length} contacts:</p>
                    {purpose === 'template' && missingParamsCount > 0 && (
                      <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-amber-50 border border-amber-200 mb-3">
                        <AlertTriangle size={13} className="text-amber-600 flex-shrink-0"/>
                        <p className="text-[11px] text-amber-700">{missingParamsCount} of {parsed.length} rows are missing one or more required template params — they'll import, but can't be used to send the template until completed.</p>
                      </div>
                    )}
                    <div className="overflow-x-auto rounded-xl border border-surface-border">
                      <table className="w-full text-[11px]">
                        <thead className="bg-slate-50 border-b border-surface-border">
                          <tr>
                            {[
                              'Name','Phone',
                              ...(purpose === 'template' ? templateColumns.map(c=>c.label) : ['Email','Company','Tags', ...(hasCustomAttrs ? ['Custom Attrs'] : [])]),
                            ].map(h=>(
                              <th key={h} className="text-left px-3 py-2 text-[10px] font-bold text-slate-400 uppercase tracking-wider whitespace-nowrap">{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-surface-border">
                          {parsed.slice(0,10).map((c, i)=>(
                            <tr key={i} className="hover:bg-slate-50">
                              <td className="px-3 py-2 font-medium text-slate-800 whitespace-nowrap">{c.name||'—'}</td>
                              <td className="px-3 py-2 font-mono text-slate-600 whitespace-nowrap">{c.phone||'—'}</td>
                              {purpose === 'template' ? (
                                templateColumns.map(col => (
                                  <td key={col.key} className={clsx('px-3 py-2 whitespace-nowrap', (c.customAttrs||{})[col.key] ? 'text-slate-600' : 'text-red-400 italic')}>
                                    {(c.customAttrs||{})[col.key] || 'missing'}
                                  </td>
                                ))
                              ) : (
                                <>
                                  <td className="px-3 py-2 text-slate-500 max-w-[120px] truncate">{c.email||'—'}</td>
                                  <td className="px-3 py-2 text-slate-500 whitespace-nowrap">{c.company||'—'}</td>
                                  <td className="px-3 py-2">
                                    <div className="flex flex-wrap gap-0.5">
                                      {c.tags.slice(0,2).map(t=>(
                                        <span key={t} className="px-1.5 py-0.5 rounded-full text-[9px] font-bold capitalize" style={tSt(t)}>{t}</span>
                                      ))}
                                    </div>
                                  </td>
                                  {hasCustomAttrs && (
                                    <td className="px-3 py-2 text-slate-500 text-[10px] font-mono">
                                      {Object.keys(c.customAttrs||{}).join(', ') || '—'}
                                    </td>
                                  )}
                                </>
                              )}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </>
              }
            </div>
          )}

          {/* Step: Done */}
          {step==='done' && (
            <div className="flex flex-col items-center justify-center py-14 px-6 text-center">
              <div className="w-14 h-14 rounded-full bg-emerald-100 flex items-center justify-center mb-4">
                <CheckCircle2 size={28} className="text-emerald-500"/>
              </div>
              <p className="text-[15px] font-bold text-slate-800 mb-1">Import Successful!</p>
              <p className="text-[12px] text-slate-500">{parsed.length} contacts processed. New contacts were added — existing ones (matched by phone) had their group, tags &amp; custom fields merged in.</p>
              {purpose === 'template' && selectedTemplate && (
                <p className="text-[11px] text-emerald-600 mt-1.5 font-medium">Tagged and ready to send "{selectedTemplate.name}" from Broadcasting.</p>
              )}
            </div>
          )}
        </div>

        {/* footer */}
        {step !== 'done' && step !== 'purpose' && (
          <div className="border-t border-surface-border">
            {step==='preview' && parsed.length > 0 && groups.length > 0 && (
              <div className="px-4 pt-3 pb-0">
                <div className="flex items-center gap-3">
                  <label className="text-[10px] font-semibold text-slate-500 whitespace-nowrap">Assign to Group</label>
                  <NativeSelect value={assignGroup} onChange={e=>setAssignGroup(e.target.value)} sm className="flex-1">
                    <option value="">— None —</option>
                    {groups.map(g => (
                      <option key={g.id} value={g.id}>{g.name}</option>
                    ))}
                  </NativeSelect>
                </div>
                {assignGroup && (
                  <p className="text-[10px] text-slate-400 mt-1">Contacts already in your list (matched by phone) will be added to this group too — safe to re-import.</p>
                )}
              </div>
            )}
            <div className="flex gap-2 px-4 py-3">
              <button onClick={onClose} className="btn-secondary flex-1 justify-center text-xs">Cancel</button>
              {step === 'template-select' && (
                <button onClick={()=>setStep('template-sheet')} disabled={!selectedTemplate}
                  className={clsx('flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-semibold transition-colors',
                    selectedTemplate ? 'bg-primary text-white hover:bg-primary/90' : 'bg-slate-100 text-slate-400 cursor-not-allowed')}>
                  Continue <ArrowRight size={12}/>
                </button>
              )}
              {step === 'template-sheet' && (
                <button onClick={()=>setStep('upload')}
                  className="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg bg-primary text-white text-xs font-semibold hover:bg-primary/90 transition-colors">
                  Continue to Upload <ArrowRight size={12}/>
                </button>
              )}
              {step==='preview' && parsed.length > 0 && (
                <button onClick={doImport}
                  className="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg bg-primary text-white text-xs font-semibold hover:bg-primary/90 transition-colors">
                  <FileUp size={12}/>Import {parsed.length} contacts
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

/* ── right contact panel ─────────────────────────────────────── */
function ContactPanel({ c, onClose, onUpdate, onDelete, onTemplate, onCall, groups = [] }) {
  const navigate = useNavigate()
  const { conversations, selectConversation } = useConversations()
  const [tab,       setTab]      = useState('info')
  const [editing,   setEditing]  = useState(false)
  const [editData,  setEditData] = useState({})
  const [noteText,  setNoteText] = useState(c.notes||'')
  const [noteDirty, setNoteDirty]= useState(false)
  const [addTag,    setAddTag]   = useState(false)
  const [newTag,    setNewTag]   = useState('')
  const [menuOpen,  setMenuOpen] = useState(false)
  const [newAttrKey, setNewAttrKey] = useState('')
  const [newAttrVal, setNewAttrVal] = useState('')
  const [addingAttr, setAddingAttr] = useState(false)
  const menuRef = useRef(null)

  useEffect(() => {
    setNoteText(c.notes||'')
    setNoteDirty(false)
    setTab('info')
    setAddTag(false)
    setEditing(false)
  }, [c.id])

  useEffect(() => {
    if (!menuOpen) return
    const h = e => { if(!menuRef.current?.contains(e.target)) setMenuOpen(false) }
    document.addEventListener('mousedown', h); return () => document.removeEventListener('mousedown', h)
  }, [menuOpen])

  const isActive = c.optIn && c.status==='active'
  const hasNotes = (c.notes||'').trim().length > 0

  function startEdit() {
    setEditData({ name: c.name, email: c.email||'', company: c.company||'', city: c.city||'', language: c.language||'', source: c.source||'Manual' })
    setEditing(true)
  }
  function saveEdit() {
    onUpdate(c.id, editData)
    setEditing(false)
  }
  function doAddTag() {
    const t = newTag.trim().toLowerCase()
    if (t && !c.tags.includes(t)) onUpdate(c.id, {tags:[...c.tags, t]})
    setNewTag(''); setAddTag(false)
  }
  function saveNote() {
    onUpdate(c.id, {notes: noteText})
    setNoteDirty(false)
  }
  function addCustomAttr() {
    const k = newAttrKey.trim(), v = newAttrVal.trim()
    if (!k) return
    onUpdate(c.id, { customAttrs: { ...(c.customAttrs||{}), [k]: v } })
    setNewAttrKey(''); setNewAttrVal(''); setAddingAttr(false)
  }
  function removeCustomAttr(key) {
    const next = { ...(c.customAttrs||{}) }; delete next[key]
    onUpdate(c.id, { customAttrs: next })
  }
  function goToChat() {
    const phone = c.phone.replace(/\s/g,'')
    const conv = conversations.find(cv => cv.phone && cv.phone.replace(/\s/g,'') === phone)
    if (conv) selectConversation(conv.id)
    navigate('/conversations')
  }

  const TABS = [
    { key:'info',     label:'Info'     },
    { key:'activity', label:'Activity' },
    { key:'notes',    label:'Notes'    },
  ]

  const fi = 'w-full text-[11px] border border-surface-border rounded-lg px-3 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-primary/10 focus:border-primary/40 placeholder-slate-300'

  return (
    <div className="flex-1 flex flex-col bg-white overflow-hidden border-l border-surface-border min-w-0">

      {/* ── Header — compact single block ── */}
      <div className="flex-shrink-0 border-b border-surface-border bg-white px-4 py-3">
        {/* Row: avatar + info + action icons */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full flex items-center justify-center font-bold text-[14px] flex-shrink-0"
            style={{background:avBg().bg, color:avBg().color}}>{inits(c.name)}</div>
          <div className="flex-1 min-w-0">
            <p className="text-[13px] font-bold text-slate-900 leading-tight truncate">{c.name}</p>
            <p className="text-[11px] text-slate-400 font-mono">{c.phone}</p>
          </div>
          {/* icon buttons */}
          <div className="flex items-center gap-0.5 flex-shrink-0">
            <button onClick={startEdit} title="Edit contact"
              className="p-1.5 rounded-lg hover:bg-surface-hover text-slate-400 transition-colors">
              <Pencil size={14}/>
            </button>
            <div className="relative" ref={menuRef}>
              <button onClick={() => setMenuOpen(p=>!p)}
                className="p-1.5 rounded-lg hover:bg-surface-hover text-slate-400 transition-colors">
                <MoreVertical size={14}/>
              </button>
              {menuOpen && (
                <div className="absolute right-0 top-full mt-1 w-44 bg-white border border-surface-border rounded-xl shadow-modal z-30 py-1 overflow-hidden"
                  onClick={() => setMenuOpen(false)}>
                  <button onClick={() => onUpdate(c.id,{starred:!c.starred})}
                    className="w-full flex items-center gap-2 px-3 py-1.5 text-[11px] text-slate-600 hover:bg-surface-hover">
                    <Star size={12} className={c.starred?'text-amber-400 fill-amber-400':''}/>
                    {c.starred?'Remove star':'Star contact'}
                  </button>
                  <button onClick={() => onUpdate(c.id,{status:c.status==='blocked'?'active':'blocked',optIn:c.status==='blocked'})}
                    className="w-full flex items-center gap-2 px-3 py-1.5 text-[11px] text-slate-600 hover:bg-surface-hover">
                    <Shield size={12}/>{c.status==='blocked'?'Unblock':'Block contact'}
                  </button>
                  <div className="h-px bg-surface-border mx-2 my-1"/>
                  <button onClick={() => onDelete(c.id)}
                    className="w-full flex items-center gap-2 px-3 py-1.5 text-[11px] text-red-500 hover:bg-red-50">
                    <Trash2 size={12}/>Delete contact
                  </button>
                </div>
              )}
            </div>
            <button onClick={onClose}
              className="p-1.5 rounded-lg hover:bg-surface-hover text-slate-400 transition-colors">
              <X size={14}/>
            </button>
          </div>
        </div>

        {/* status badges + action buttons in one compact row */}
        <div className="flex items-center justify-between mt-2.5">
          <div className="flex items-center gap-1 flex-wrap">
            {c.status==='blocked'
              ? <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-red-50 text-red-600 border border-red-100"><Shield size={8}/>Blocked</span>
              : isActive
                ? <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-100"><CheckCircle2 size={8}/>Opted In</span>
                : <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-slate-100 text-slate-500 border border-slate-200"><XCircle size={8}/>Opted Out</span>
            }
            <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-primary-50 text-primary border border-primary/10">{c.source}</span>
            {c.starred && <Star size={10} className="text-amber-400 fill-amber-400 ml-0.5"/>}
          </div>
          <div className="flex items-center gap-1">
            <button onClick={() => onTemplate(c)}
              className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-primary text-white text-[11px] font-semibold hover:bg-primary/90 transition-colors">
              <FileText size={11}/>Template
            </button>
            <button onClick={() => onCall(c)}
              className="flex items-center gap-1 px-2.5 py-1 rounded-lg border border-surface-border text-slate-600 text-[11px] font-semibold hover:bg-surface-hover transition-colors">
              <Phone size={11}/>Call
            </button>
            <button onClick={goToChat}
              className="flex items-center gap-1 px-2.5 py-1 rounded-lg border border-surface-border text-slate-600 text-[11px] font-semibold hover:bg-surface-hover transition-colors">
              <MessageSquare size={11}/>Chat
            </button>
          </div>
        </div>
      </div>

      {/* ── Edit mode overlay ── */}
      {editing && (
        <div className="flex-shrink-0 border-b border-surface-border bg-slate-50 px-4 py-3 space-y-2">
          <div className="flex items-center justify-between mb-1">
            <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Edit Contact</p>
            <div className="flex gap-1">
              <button onClick={() => setEditing(false)}
                className="px-2.5 py-1 rounded-lg border border-surface-border text-[11px] text-slate-500 hover:bg-surface-hover">Cancel</button>
              <button onClick={saveEdit}
                className="px-2.5 py-1 rounded-lg bg-primary text-white text-[11px] font-semibold hover:bg-primary/90 flex items-center gap-1">
                <Save size={11}/>Save
              </button>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <div>
              <p className="text-[10px] text-slate-400 mb-0.5 font-medium">Name *</p>
              <input value={editData.name||''} onChange={e=>setEditData(p=>({...p,name:e.target.value}))} className={fi} placeholder="Full name"/>
            </div>
            <div>
              <p className="text-[10px] text-slate-400 mb-0.5 font-medium">Phone (locked)</p>
              <input value={c.phone} disabled className={fi + ' bg-slate-50 text-slate-400 cursor-not-allowed'}/>
            </div>
            <div>
              <p className="text-[10px] text-slate-400 mb-0.5 font-medium">Email</p>
              <input value={editData.email||''} onChange={e=>setEditData(p=>({...p,email:e.target.value}))} className={fi} placeholder="email@example.com"/>
            </div>
            <div>
              <p className="text-[10px] text-slate-400 mb-0.5 font-medium">Company</p>
              <input value={editData.company||''} onChange={e=>setEditData(p=>({...p,company:e.target.value}))} className={fi} placeholder="Company name"/>
            </div>
            <div>
              <p className="text-[10px] text-slate-400 mb-0.5 font-medium">City</p>
              <input value={editData.city||''} onChange={e=>setEditData(p=>({...p,city:e.target.value}))} className={fi} placeholder="City"/>
            </div>
            <div>
              <p className="text-[10px] text-slate-400 mb-0.5 font-medium">Language</p>
              <NativeSelect value={editData.language||''} onChange={e=>setEditData(p=>({...p,language:e.target.value}))} sm>
                <option value="">Select…</option>
                {LANGS.map(l=><option key={l}>{l}</option>)}
              </NativeSelect>
            </div>
            <div>
              <p className="text-[10px] text-slate-400 mb-0.5 font-medium">Source</p>
              <NativeSelect value={editData.source||''} onChange={e=>setEditData(p=>({...p,source:e.target.value}))} sm>
                {SOURCES.map(s=><option key={s}>{s}</option>)}
              </NativeSelect>
            </div>
          </div>
        </div>
      )}

      {/* ── Tab bar ── */}
      <div className="flex items-center gap-0.5 bg-slate-100 p-1 mx-4 mt-3 mb-1.5 rounded-xl flex-shrink-0 w-fit">
        {TABS.map(({ key, label }) => (
          <button key={key} onClick={() => setTab(key)}
            className={clsx(
              'relative flex items-center gap-1.5 px-3.5 py-1.5 text-[11px] font-semibold rounded-lg transition-all',
              tab===key ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
            )}>
            {label}
            {key==='notes' && hasNotes && (
              <span className="w-1.5 h-1.5 rounded-full bg-primary inline-block"/>
            )}
          </button>
        ))}
      </div>

      {/* ── Tab content ── */}
      <div className="flex-1 overflow-y-auto">

        {/* INFO TAB */}
        {tab==='info' && (
          <div className="p-4 space-y-3">

            {/* AI Contact Intelligence card */}
            <div className="bg-gradient-to-br from-violet-50 to-blue-50 border border-violet-100 rounded-xl overflow-hidden">
              <div className="flex items-center justify-between px-4 py-2.5 border-b border-violet-100/60">
                <div className="flex items-center gap-1.5">
                  <Sparkles size={11} className="text-violet-500"/>
                  <p className="text-[10px] font-bold text-violet-600 uppercase tracking-wider">AI Contact Intelligence</p>
                </div>
                <div className="flex items-center gap-1.5">
                  <p className="text-[10px] text-slate-500 font-medium">Score</p>
                  <div className={clsx('px-2 py-0.5 rounded-full text-[10px] font-bold',
                    c.score >= 80 ? 'bg-emerald-100 text-emerald-700' :
                    c.score >= 50 ? 'bg-amber-100 text-amber-700' :
                    'bg-red-100 text-red-600')}>
                    {c.score}/100
                  </div>
                </div>
              </div>
              {/* Score bar */}
              <div className="px-4 pt-2 pb-1">
                <div className="w-full h-1 bg-violet-100 rounded-full overflow-hidden">
                  <div className={clsx('h-full rounded-full transition-all',
                    c.score >= 80 ? 'bg-emerald-400' : c.score >= 50 ? 'bg-amber-400' : 'bg-red-400')}
                    style={{width: `${c.score}%`}}/>
                </div>
              </div>
              {/* Summary */}
              <p className="px-4 py-2 text-[11px] text-slate-600 leading-relaxed">{c.aiSummary || 'No AI summary available yet.'}</p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
              {/* Column 1: Contact Information card */}
              <div className="bg-white border border-surface-border rounded-xl overflow-hidden">
                <div className="px-4 py-2.5 border-b border-surface-border bg-slate-50/50">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Contact Information</p>
                </div>
                <div className="divide-y divide-surface-border/60">
                  {[
                    {Icon:Phone,    label:'Phone',    val:c.phone,         mono:true},
                    {Icon:Mail,     label:'Email',    val:c.email||'—'},
                    {Icon:Building2,label:'Company',  val:c.company||'—'},
                    {Icon:MapPin,   label:'City',     val:c.city||'—'},
                    {Icon:Globe,    label:'Language', val:c.language||'—'},
                  ].map(({Icon,label,val,mono}) => (
                    <div key={label} className="flex items-start gap-2.5 px-4 py-2.5">
                      <Icon size={12} className="text-slate-400 flex-shrink-0 mt-0.5"/>
                      <div className="flex-1 min-w-0">
                        <p className="text-[10px] text-slate-400 leading-none mb-0.5">{label}</p>
                        <p className={clsx('text-[11px] text-slate-700 font-medium break-all', mono&&'font-mono')}>{val}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Column 2: details + agent */}
              <div className="space-y-3">
                {/* Details card */}
                <div className="bg-white border border-surface-border rounded-xl overflow-hidden">
                  <div className="px-4 py-2.5 border-b border-surface-border bg-slate-50/50">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Details</p>
                  </div>
                  <div className="divide-y divide-surface-border/60">
                    {[
                      ['Added on',       fmtD(c.created)],
                      ['Last contact',   fmtD(c.last)],
                      ['Conversations',  String(c.convos)],
                      ['Source',         c.source],
                    ].map(([l,v]) => (
                      <div key={l} className="flex items-center justify-between px-4 py-2">
                        <span className="text-[10px] text-slate-400">{l}</span>
                        <span className="text-[11px] font-semibold text-slate-700">{v}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Assigned Agent card */}
                <div className="bg-white border border-surface-border rounded-xl overflow-hidden">
                  <div className="px-4 py-2.5 border-b border-surface-border bg-slate-50/50">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Assigned Agent</p>
                  </div>
                  <div className="p-3">
                    <NativeSelect value={c.agent||''} onChange={e => onUpdate(c.id,{agent:e.target.value||null})} sm>
                      <option value="">Unassigned</option>
                      {AGENTS.map(a => <option key={a}>{a}</option>)}
                    </NativeSelect>
                  </div>
                </div>
              </div>
            </div>

            {/* WhatsApp opt-in toggle row */}
            <div className="flex items-center justify-between px-4 py-2.5 bg-white border border-surface-border rounded-xl">
              <div className="flex items-center gap-2">
                <div className={clsx('w-6 h-6 rounded-full flex items-center justify-center', isActive ? 'bg-emerald-100' : 'bg-slate-100')}>
                  {isActive ? <CheckCircle2 size={12} className="text-emerald-600"/> : <XCircle size={12} className="text-slate-400"/>}
                </div>
                <div>
                  <p className="text-[11px] font-semibold text-slate-700">{isActive ? 'Opted In' : 'Not Opted In'}</p>
                  <p className="text-[10px] text-slate-400">{isActive ? 'Can receive messages' : 'Cannot receive messages'}</p>
                </div>
              </div>
              <button
                onClick={() => onUpdate(c.id, { optIn: !c.optIn, status: !c.optIn ? 'active' : 'opted-out' })}
                className={clsx(
                  'relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none',
                  isActive ? 'bg-emerald-500' : 'bg-slate-200'
                )}>
                <span className={clsx(
                  'pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow ring-0 transition-transform duration-200 ease-in-out',
                  isActive ? 'translate-x-4' : 'translate-x-0'
                )}/>
              </button>
            </div>

            {/* Tags — full width */}
            <div className="bg-white border border-surface-border rounded-xl overflow-hidden">
              <div className="flex items-center justify-between px-4 py-2.5 border-b border-surface-border bg-slate-50/50">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Tags</p>
                <button onClick={() => setAddTag(p=>!p)}
                  className="flex items-center gap-1 text-[11px] text-primary font-semibold hover:underline">
                  <Plus size={11}/>Add tag
                </button>
              </div>
              <div className="p-4">
                <div className="flex flex-wrap gap-2 min-h-[28px]">
                  {c.tags.map(t => (
                    <span key={t} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold" style={tSt(t)}>
                      {t}
                      <button onClick={() => onUpdate(c.id,{tags:c.tags.filter(x=>x!==t)})} className="opacity-50 hover:opacity-100 ml-0.5"><X size={9}/></button>
                    </span>
                  ))}
                  {!c.tags.length && !addTag && <span className="text-[11px] text-slate-300 italic">No tags assigned</span>}
                </div>
                {addTag && (
                  <div className="mt-3 space-y-2">
                    <div className="flex gap-2">
                      <input autoFocus value={newTag} onChange={e=>setNewTag(e.target.value)}
                        onKeyDown={e=>{if(e.key==='Enter')doAddTag();if(e.key==='Escape')setAddTag(false)}}
                        placeholder="Type a tag name…"
                        className="flex-1 text-[11px] border border-surface-border rounded-lg px-3 py-1.5 focus:outline-none focus:border-primary/40 focus:ring-2 focus:ring-primary/10"/>
                      <button onClick={doAddTag} className="px-3 py-1.5 rounded-lg bg-primary text-white text-[11px] font-semibold">Add</button>
                      <button onClick={()=>setAddTag(false)} className="px-2 py-1.5 rounded-lg text-slate-400 hover:bg-surface-hover"><X size={13}/></button>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {TAGS.filter(t=>!c.tags.includes(t)).map(t=>(
                        <button key={t} onClick={() => {onUpdate(c.id,{tags:[...c.tags,t]});setAddTag(false)}}
                          className="px-2 py-0.5 rounded-full text-[10px] font-bold capitalize hover:opacity-80 transition-opacity" style={tSt(t)}>{t}</button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Groups card */}
            {groups.length > 0 && (
              <div className="bg-white border border-surface-border rounded-xl overflow-hidden">
                <div className="px-4 py-2.5 border-b border-surface-border bg-slate-50/50">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Groups</p>
                </div>
                <div className="p-3 space-y-2">
                  <div className="flex flex-wrap gap-1.5">
                    {(c.groupIds||[]).map(gid => {
                      const grp = groups.find(g=>g.id===gid)
                      if (!grp) return null
                      return (
                        <span key={gid} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold"
                          style={{background: grp.color + '20', color: grp.color}}>
                          <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{background:grp.color}}/>
                          {grp.name}
                          <button onClick={() => onUpdate(c.id, {groupIds:(c.groupIds||[]).filter(x=>x!==gid)})}
                            className="opacity-50 hover:opacity-100 ml-0.5"><X size={9}/></button>
                        </span>
                      )
                    })}
                    {!(c.groupIds||[]).length && <span className="text-[11px] text-slate-300 italic">Not in any group</span>}
                  </div>
                  {groups.filter(g=>!(c.groupIds||[]).includes(g.id)).length > 0 && (
                    <NativeSelect
                      value=""
                      onChange={e => {
                        if (!e.target.value) return
                        onUpdate(c.id, { groupIds: [...(c.groupIds||[]), e.target.value] })
                      }}
                      sm>
                      <option value="">+ Add to group…</option>
                      {groups.filter(g=>!(c.groupIds||[]).includes(g.id)).map(g=>(
                        <option key={g.id} value={g.id}>{g.name}</option>
                      ))}
                    </NativeSelect>
                  )}
                </div>
              </div>
            )}

            {/* Custom Attributes card */}
            <div className="bg-white border border-surface-border rounded-xl overflow-hidden">
              <div className="flex items-center justify-between px-4 py-2.5 border-b border-surface-border bg-slate-50/50">
                <div className="flex items-center gap-1.5">
                  <Variable size={11} className="text-slate-400"/>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Custom Attributes</p>
                </div>
                <button onClick={() => setAddingAttr(p=>!p)}
                  className="flex items-center gap-1 text-[11px] text-primary font-semibold hover:underline">
                  <Plus size={11}/>Add
                </button>
              </div>
              <div className="p-3 space-y-2">
                {Object.keys(c.customAttrs||{}).length === 0 && !addingAttr && (
                  <p className="text-[11px] text-slate-300 italic px-1">No custom attributes yet.</p>
                )}
                {Object.entries(c.customAttrs||{}).map(([k, v]) => (
                  <div key={k} className="flex items-center gap-2 bg-slate-50 rounded-lg px-3 py-1.5 border border-surface-border">
                    <span className="text-[10px] font-bold text-slate-400 font-mono min-w-[70px] truncate">{k}</span>
                    <span className="text-[11px] text-slate-500 mx-1">→</span>
                    <span className="flex-1 text-[11px] text-slate-700 font-medium truncate">{v}</span>
                    <button onClick={() => removeCustomAttr(k)} className="text-slate-300 hover:text-red-400 transition-colors flex-shrink-0"><X size={11}/></button>
                  </div>
                ))}
                {addingAttr && (
                  <div className="space-y-2 pt-1">
                    <div className="grid grid-cols-2 gap-2">
                      <input autoFocus value={newAttrKey} onChange={e=>setNewAttrKey(e.target.value)}
                        placeholder="Variable name"
                        className="text-[11px] border border-surface-border rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-primary/40 focus:ring-2 focus:ring-primary/10 placeholder-slate-300"/>
                      <input value={newAttrVal} onChange={e=>setNewAttrVal(e.target.value)}
                        onKeyDown={e=>{if(e.key==='Enter')addCustomAttr();if(e.key==='Escape')setAddingAttr(false)}}
                        placeholder="Value"
                        className="text-[11px] border border-surface-border rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-primary/40 focus:ring-2 focus:ring-primary/10 placeholder-slate-300"/>
                    </div>
                    <div className="flex gap-2">
                      <button onClick={addCustomAttr} className="flex-1 py-1.5 rounded-lg bg-primary text-white text-[11px] font-semibold hover:bg-primary/90">
                        Add Attribute
                      </button>
                      <button onClick={()=>{setAddingAttr(false);setNewAttrKey('');setNewAttrVal('')}}
                        className="px-3 py-1.5 rounded-lg border border-surface-border text-slate-400 text-[11px] hover:bg-surface-hover">
                        Cancel
                      </button>
                    </div>
                    <p className="text-[10px] text-slate-400 leading-relaxed">
                      Use attribute names like <span className="font-mono bg-slate-100 px-1 rounded">order_id</span>, <span className="font-mono bg-slate-100 px-1 rounded">plan</span> — map them in Broadcasting when sending template campaigns.
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Delete button */}
            <button onClick={() => onDelete(c.id)}
              className="w-full py-2.5 rounded-xl border border-red-100 bg-red-50 text-red-500 text-[11px] font-semibold hover:bg-red-100 transition-colors flex items-center justify-center gap-1.5">
              <Trash2 size={12}/>Delete Contact
            </button>
          </div>
        )}

        {/* ACTIVITY TAB */}
        {tab==='activity' && (
          <div className="p-4">
            {!(c.log||[]).length
              ? <div className="flex flex-col items-center justify-center py-16 text-center">
                  <Clock size={28} className="text-slate-300 mb-3"/>
                  <p className="text-[13px] font-semibold text-slate-500">No activity yet</p>
                </div>
              : <div className="space-y-3">
                  {(c.log||[]).map((l,i) => {
                    const s = LOG_ST[l.t] || LOG_ST.created
                    const Icon = s.Icon
                    return (
                      <div key={i} className="flex items-start gap-3 bg-white border border-surface-border rounded-xl p-3.5">
                        <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0" style={{background:s.bg}}>
                          <Icon size={13} style={{color:s.c}}/>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-[11px] text-slate-700 leading-snug font-medium">{l.text}</p>
                          <p className="text-[10px] text-slate-400 mt-1">{fmtD(l.date)}</p>
                        </div>
                      </div>
                    )
                  })}
                </div>
            }
          </div>
        )}

        {/* NOTES TAB */}
        {tab==='notes' && (
          <div className="p-4 flex flex-col gap-3 h-full">
            <div className="flex items-center justify-between">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Private Notes</p>
              {noteDirty && (
                <button onClick={saveNote}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary text-white text-[11px] font-semibold hover:bg-primary/90 transition-colors">
                  <Check size={11}/>Save
                </button>
              )}
              {!noteDirty && noteText.trim() && (
                <span className="flex items-center gap-1 text-[11px] text-emerald-500">
                  <CheckCircle2 size={11}/>Saved
                </span>
              )}
            </div>
            <textarea
              value={noteText}
              onChange={e=>{setNoteText(e.target.value);setNoteDirty(e.target.value !== (c.notes||''))}}
              onBlur={saveNote}
              rows={16}
              placeholder="Add private notes about this contact…&#10;&#10;These notes are only visible to your team."
              className="w-full text-[12px] border border-surface-border rounded-xl p-4 text-slate-700 placeholder-slate-300 focus:outline-none focus:ring-2 focus:ring-primary/15 focus:border-primary/30 resize-none transition-all leading-relaxed bg-slate-50/40 focus:bg-white"/>
            <p className="text-[11px] text-slate-400 flex items-center gap-1.5">
              <CheckCircle2 size={11} className="text-slate-300"/>Auto-saved when you click away
            </p>
          </div>
        )}
      </div>
    </div>
  )
}

/* ── export contacts to CSV ──────────────────────────────────── */
function exportContacts(contacts) {
  const headers = ['Name','Phone','Email','Company','City','Language','Source','Status','Opted In','Tags','Agent','Created','Last Contact','Conversations','Notes']
  const rows = contacts.map(c => [
    c.name, c.phone, c.email||'', c.company||'', c.city||'', c.language||'',
    c.source, c.status, c.optIn?'Yes':'No',
    (c.tags||[]).join(';'), c.agent||'',
    c.created||'', c.last||'', c.convos||0, (c.notes||'').replace(/\n/g,' ')
  ])
  const escape = v => {
    const s = String(v)
    return s.includes(',') || s.includes('"') || s.includes('\n') ? `"${s.replace(/"/g,'""')}"` : s
  }
  const csv = [headers, ...rows].map(r => r.map(escape).join(',')).join('\n')
  const blob = new Blob([csv], {type:'text/csv;charset=utf-8;'})
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  const date = new Date().toISOString().slice(0,10)
  a.href = url
  a.download = `contacts_${date}.csv`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

/* ── main ────────────────────────────────────────────────────── */
export default function Contacts() {
  const [contacts,    setCon]       = useState(INIT_CONTACTS)
  const [selId,       setSelId]     = useState(null)
  const [search,      setSearch]    = useState('')
  const [seg,         setSeg]       = useState('all')
  const [tagFil,      setTagFil]    = useState(null)
  const [dateFil,     setDateFil]   = useState('any')
  const [sourceFil,   setSourceFil] = useState(null)
  const [agentFil,    setAgentFil]  = useState(null)
  const [sortBy,      setSortBy]    = useState('recent')
  const [tplC,        setTpl]       = useState(null)
  const [callC,       setCall]      = useState(null)
  const [showAdd,     setAdd]       = useState(false)
  const [showImport,  setImport]    = useState(false)
  const [showFilters, setShowFilters] = useState(false)
  const [groups,      setGroups]    = useState(INIT_GROUPS)
  const [groupFil,    setGroupFil]  = useState(null)
  const [showGroupDrop, setShowGroupDrop] = useState(false)
  const [showCreateGroup, setShowCreateGroup] = useState(false)
  const groupDropRef = useRef(null)
  const [viewMode,    setViewMode]  = useState('list')      // 'list' | 'table'
  const [selectedIds, setSelectedIds] = useState(() => new Set())
  const [bulkChannel, setBulkChannel] = useState(null)      // null | 'whatsapp' | 'email'
  const [showSelectMenu, setShowSelectMenu] = useState(false)
  const [manualSelectMode, setManualSelectMode] = useState(false)
  const selectMenuRef = useRef(null)

  /* ── counts for dropdown options ── */
  const segCounts = useMemo(() => {
    const m = {}
    SEGS.forEach(s => { m[s.id] = contacts.filter(s.fn).length })
    return m
  }, [contacts])

  const tagCounts = useMemo(() => {
    const m = {}
    contacts.forEach(c => c.tags.forEach(t => { m[t] = (m[t]||0)+1 }))
    return m
  }, [contacts])

  /* ── filtered + sorted list ── */
  const list = useMemo(() => {
    const segFn = SEGS.find(s=>s.id===seg)?.fn || (()=>true)
    return contacts.filter(c => {
      if (!segFn(c)) return false
      if (tagFil    && !c.tags.includes(tagFil)) return false
      if (sourceFil && c.source !== sourceFil)   return false
      if (agentFil === 'unassigned' && c.agent)  return false
      if (agentFil && agentFil !== 'unassigned' && c.agent !== agentFil) return false
      if (!datePass(c, dateFil)) return false
      if (groupFil  && !(c.groupIds||[]).includes(groupFil)) return false
      if (search) {
        const q = search.toLowerCase()
        if (!c.name.toLowerCase().includes(q) && !c.phone.includes(q) &&
            !(c.email||'').toLowerCase().includes(q) && !(c.company||'').toLowerCase().includes(q)) return false
      }
      return true
    }).sort((a,b) => {
      if (sortBy==='name-asc')  return a.name.localeCompare(b.name)
      if (sortBy==='name-desc') return b.name.localeCompare(a.name)
      if (sortBy==='convos')    return b.convos - a.convos
      return new Date(b.last) - new Date(a.last)
    })
  }, [contacts, seg, tagFil, sourceFil, agentFil, dateFil, sortBy, search, groupFil])

  const selContact = contacts.find(c=>c.id===selId) || null

  function upd(id, patch) { setCon(p=>p.map(c=>c.id===id?{...c,...patch}:c)) }
  function del(id)         { setCon(p=>p.filter(c=>c.id!==id)); if(selId===id) setSelId(null) }
  function add(c)          { setCon(p=>[c,...p]); setSelId(c.id) }
  function onImport(newContacts) {
    setCon(p => {
      const byPhone = new Map(p.map(c => [c.phone, c]))
      const brandNew = []
      const patches = new Map() // phone -> patch to merge into an existing contact
      newContacts.forEach(nc => {
        const existing = nc.phone && byPhone.get(nc.phone)
        if (existing) {
          // Contact already exists (re-importing, e.g. to add them to another group) —
          // merge groups/tags/custom attrs into the existing record instead of dropping the row.
          patches.set(nc.phone, {
            groupIds: [...new Set([...(existing.groupIds||[]), ...(nc.groupIds||[])])],
            tags:     [...new Set([...(existing.tags||[]),     ...(nc.tags||[])])],
            customAttrs: { ...(existing.customAttrs||{}), ...(nc.customAttrs||{}) },
          })
        } else {
          brandNew.push(nc)
        }
      })
      const merged = p.map(c => patches.has(c.phone) ? { ...c, ...patches.get(c.phone) } : c)
      return [...brandNew, ...merged]
    })
  }

  const counts = useMemo(() => ({
    total:   contacts.length,
    optedIn: contacts.filter(c=>c.optIn&&c.status==='active').length,
  }), [contacts])

  /* active filter count */
  const activeFilters = [seg!=='all', tagFil, sourceFil, agentFil, dateFil!=='any', sortBy!=='recent'].filter(Boolean).length

  function clearAll() { setSeg('all'); setTagFil(null); setDateFil('any'); setSourceFil(null); setAgentFil(null); setSortBy('recent') }

  function toggleSelect(id) {
    setSelectedIds(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n })
  }
  function toggleSelectAll(contactsList) {
    const allSel = contactsList.every(c => selectedIds.has(c.id))
    setSelectedIds(prev => {
      const n = new Set(prev)
      if (allSel) contactsList.forEach(c => n.delete(c.id))
      else contactsList.forEach(c => n.add(c.id))
      return n
    })
  }

  /* close group dropdown on outside click */
  useEffect(() => {
    if (!showGroupDrop) return
    const h = e => { if (!groupDropRef.current?.contains(e.target)) setShowGroupDrop(false) }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [showGroupDrop])

  /* close select dropdown on outside click */
  useEffect(() => {
    if (!showSelectMenu) return
    const h = e => { if (!selectMenuRef.current?.contains(e.target)) setShowSelectMenu(false) }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [showSelectMenu])

  // Mobile: show 'list' or 'detail'
  const [mobileContactView, setMobileContactView] = useState('list')

  function handleContactClick(id) {
    setSelId(p => p===id ? null : id)
    setMobileContactView('detail')
  }

  return (
    <div className="h-[calc(100vh-48px)] md:h-screen -mx-3 -mt-3 -mb-3 sm:-mx-5 sm:-mt-5 sm:-mb-5 flex overflow-hidden">

      {/* ── Left/Main panel ── */}
      <div className={clsx(
        'flex flex-col border-r border-surface-border bg-white overflow-hidden transition-all',
        viewMode === 'list'
          ? ['flex-shrink-0', 'w-full md:w-[280px]', mobileContactView === 'detail' ? 'hidden md:flex' : 'flex']
          : ['flex-1', mobileContactView === 'detail' ? 'hidden md:flex' : 'flex']
      )}>

        {/* ── Header row 1: title + buttons ── */}
        <div className="flex items-center gap-1.5 px-3 py-2 border-b border-surface-border flex-shrink-0">
          <div className="flex-1 min-w-0">
            <p className="text-[13px] font-bold text-slate-800 leading-tight">Contacts</p>
            <p className="text-[10px] text-slate-400 truncate">{counts.total} contacts · {counts.optedIn} opted in</p>
          </div>
          {/* View mode toggle */}
          <div className="flex items-center bg-slate-100 rounded-lg p-0.5 flex-shrink-0">
            <button onClick={() => setViewMode('list')} title="List view"
              className={clsx('p-1 rounded-md transition-all', viewMode==='list' ? 'bg-white shadow-sm text-slate-800' : 'text-slate-500 hover:text-slate-700')}>
              <LayoutList size={12}/>
            </button>
            <button onClick={() => setViewMode('table')} title="Table view"
              className={clsx('p-1 rounded-md transition-all', viewMode==='table' ? 'bg-white shadow-sm text-slate-800' : 'text-slate-500 hover:text-slate-700')}>
              <Table2 size={12}/>
            </button>
          </div>
          {/* Filter icon button */}
          <button onClick={() => setShowFilters(p=>!p)} title="Filters"
            className={clsx('relative p-1.5 rounded-lg border transition-colors',
              activeFilters > 0
                ? 'border-primary/30 bg-primary-50 text-primary'
                : 'border-surface-border bg-white text-slate-500 hover:bg-surface-hover')}>
            <SlidersHorizontal size={13}/>
            {activeFilters > 0 && (
              <span className="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full bg-primary text-white text-[8px] font-bold flex items-center justify-center">{activeFilters}</span>
            )}
          </button>
          <button onClick={() => setImport(true)} title="Import contacts"
            className="p-1.5 rounded-lg border border-surface-border bg-white text-slate-500 hover:bg-surface-hover transition-colors">
            <Upload size={13}/>
          </button>
          <button onClick={() => exportContacts(contacts)} title="Export contacts"
            className="p-1.5 rounded-lg border border-surface-border bg-white text-slate-500 hover:bg-surface-hover transition-colors">
            <Download size={13}/>
          </button>
          <button onClick={() => setAdd(true)} title="New contact"
            className="p-1.5 rounded-md bg-primary text-white hover:bg-primary/90 transition-colors">
            <UserPlus size={13}/>
          </button>
        </div>

        {/* ── Header row 2: search + select + group icons ── */}
        <div className="px-3 py-1.5 border-b border-surface-border flex-shrink-0 flex items-center gap-1.5">
          <div className="relative flex-1 min-w-0">
            <Search size={11} className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"/>
            <input value={search} onChange={e=>setSearch(e.target.value)}
              placeholder="Search contacts…"
              className="pl-6 pr-2 py-1 text-[11px] bg-slate-50 border border-surface-border rounded-lg w-full focus:outline-none focus:border-primary/40 focus:bg-white transition-all placeholder-slate-400"/>
            {search && <button onClick={()=>setSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"><X size={10}/></button>}
          </div>

          {/* Select dropdown */}
          <div className="relative flex-shrink-0" ref={selectMenuRef}>
            <button
              onClick={() => setShowSelectMenu(p => !p)}
              title="Select contacts"
              className={clsx(
                'flex items-center gap-0.5 px-1.5 py-1.5 rounded-lg border transition-colors',
                (manualSelectMode || selectedIds.size > 0)
                  ? 'border-primary/30 bg-primary-50 text-primary'
                  : 'border-surface-border bg-white text-slate-500 hover:bg-surface-hover'
              )}>
              <CheckSquare size={13}/>
              <ChevronDown size={10}/>
            </button>
            {showSelectMenu && (
              <div className="absolute right-0 top-full mt-1 z-50 bg-white border border-surface-border rounded-xl shadow-lg py-1 min-w-[190px]">
                <button
                  onClick={() => { toggleSelectAll(list); setManualSelectMode(true); setShowSelectMenu(false) }}
                  className="flex items-center gap-2.5 w-full px-3 py-2 text-[12px] text-slate-700 hover:bg-slate-50 transition-colors">
                  <CheckSquare size={13} className="text-primary flex-shrink-0"/>
                  Select all
                </button>
                <button
                  onClick={() => { setManualSelectMode(true); setShowSelectMenu(false) }}
                  className="flex items-center gap-2.5 w-full px-3 py-2 text-[12px] text-slate-700 hover:bg-slate-50 transition-colors">
                  <MousePointer2 size={13} className="text-slate-400 flex-shrink-0"/>
                  Select manually
                </button>
                {(manualSelectMode || selectedIds.size > 0) && (
                  <>
                    <div className="my-1 border-t border-surface-border"/>
                    <button
                      onClick={() => { setSelectedIds(new Set()); setManualSelectMode(false); setShowSelectMenu(false) }}
                      className="flex items-center gap-2.5 w-full px-3 py-2 text-[12px] text-slate-500 hover:bg-slate-50 transition-colors">
                      <X size={13} className="text-slate-400 flex-shrink-0"/>
                      Clear selection
                    </button>
                  </>
                )}
              </div>
            )}
          </div>

          {/* Group filter icon */}
          <div className="relative flex-shrink-0" ref={groupDropRef}>
            <button onClick={() => setShowGroupDrop(p=>!p)} title="Filter by group"
              className={clsx('relative p-1.5 rounded-lg border transition-colors',
                groupFil
                  ? 'border-primary/30 bg-primary-50 text-primary'
                  : 'border-surface-border bg-white text-slate-500 hover:bg-surface-hover')}>
              <Layers size={13}/>
              {groupFil && (
                <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full border-2 border-white flex-shrink-0"
                  style={{background: groups.find(g=>g.id===groupFil)?.color || '#0066ff'}}/>
              )}
            </button>
            {showGroupDrop && (
              <div className="absolute top-full right-0 mt-1 w-48 bg-white border border-surface-border rounded-xl shadow-lg z-50 overflow-hidden py-1">
                <button onClick={() => { setGroupFil(null); setShowGroupDrop(false) }}
                  className={clsx('w-full flex items-center gap-2 px-3 py-1.5 text-left transition-colors',
                    !groupFil ? 'bg-primary-50 text-primary' : 'text-slate-600 hover:bg-surface-hover')}>
                  <span className="w-2 h-2 rounded-full bg-slate-300 flex-shrink-0"/>
                  <span className="flex-1 text-[11px] font-medium">All contacts</span>
                  {!groupFil && <Check size={10}/>}
                </button>
                {groups.map(g => {
                  const cnt = contacts.filter(c=>(c.groupIds||[]).includes(g.id)).length
                  const active = groupFil === g.id
                  return (
                    <button key={g.id} onClick={() => { setGroupFil(g.id); setShowGroupDrop(false) }}
                      className={clsx('w-full flex items-center gap-2 px-3 py-1.5 text-left transition-colors',
                        active ? 'bg-primary-50' : 'hover:bg-surface-hover')}>
                      <span className="w-2 h-2 rounded-full flex-shrink-0" style={{background:g.color}}/>
                      <span className={clsx('flex-1 text-[11px] font-medium truncate', active ? 'text-primary' : 'text-slate-600')}>{g.name}</span>
                      <span className={clsx('text-[10px] font-bold tabular-nums', active ? 'text-primary' : 'text-slate-400')}>{cnt}</span>
                    </button>
                  )
                })}
                {!groups.length && <p className="text-[11px] text-slate-400 italic px-3 py-2">No groups yet</p>}
              </div>
            )}
          </div>

          {/* Create group icon */}
          <button onClick={() => setShowCreateGroup(true)} title="Create new group"
            className="flex-shrink-0 p-1.5 rounded-lg border border-surface-border bg-white text-slate-500 hover:bg-surface-hover transition-colors">
            <FolderPlus size={13}/>
          </button>
        </div>

        {/* ── Header row 3: filter chips (shown when showFilters or any active) ── */}
        {(showFilters || activeFilters > 0) && (
          <div className="px-3 py-1.5 border-b border-surface-border flex-shrink-0 flex flex-wrap gap-1">
            {/* List filter */}
            <FilterChip
              label={seg === 'all' ? 'List' : SEGS.find(s=>s.id===seg)?.label}
              active={seg !== 'all'}
              onClear={() => setSeg('all')}>
              {({ close }) => (
                <div className="py-1">
                  {SEGS.map(s => (
                    <DropOpt key={s.id} label={s.label} count={segCounts[s.id]||0} active={seg===s.id}
                      icon={s.icon} onClick={() => { setSeg(s.id); close() }}/>
                  ))}
                </div>
              )}
            </FilterChip>

            {/* Tags filter */}
            <FilterChip
              label={tagFil || 'Tags'}
              active={!!tagFil}
              onClear={() => setTagFil(null)}>
              {({ close }) => (
                <div className="py-1">
                  <DropOpt label="All tags" active={!tagFil} onClick={() => { setTagFil(null); close() }}/>
                  {Object.entries(tagCounts).sort((a,b)=>b[1]-a[1]).map(([t,cnt]) => (
                    <DropOpt key={t} label={t} count={cnt} active={tagFil===t}
                      icon={() => <span className="w-1.5 h-1.5 rounded-full flex-shrink-0 inline-block" style={{background:tSt(t).color}}/>}
                      onClick={() => { setTagFil(t); close() }}/>
                  ))}
                </div>
              )}
            </FilterChip>

            {/* Source filter */}
            <FilterChip
              label={sourceFil || 'Source'}
              active={!!sourceFil}
              onClear={() => setSourceFil(null)}>
              {({ close }) => (
                <div className="py-1">
                  <DropOpt label="All sources" active={!sourceFil} onClick={() => { setSourceFil(null); close() }}/>
                  {SOURCES.map(s => (
                    <DropOpt key={s} label={s} active={sourceFil===s} onClick={() => { setSourceFil(s); close() }}/>
                  ))}
                </div>
              )}
            </FilterChip>

            {/* Agent filter */}
            <FilterChip
              label={agentFil ? (agentFil === 'unassigned' ? 'Unassigned' : agentFil.split(' ')[0]) : 'Agent'}
              active={!!agentFil}
              onClear={() => setAgentFil(null)}>
              {({ close }) => (
                <div className="py-1">
                  <DropOpt label="All agents" active={!agentFil} onClick={() => { setAgentFil(null); close() }}/>
                  <DropOpt label="Unassigned" active={agentFil==='unassigned'} onClick={() => { setAgentFil('unassigned'); close() }}/>
                  {AGENTS.map(a => (
                    <DropOpt key={a} label={a} active={agentFil===a} onClick={() => { setAgentFil(a); close() }}/>
                  ))}
                </div>
              )}
            </FilterChip>

            {/* Sort filter */}
            <FilterChip
              label={SORT_OPTS.find(s=>s.id===sortBy)?.label || 'Sort'}
              active={sortBy !== 'recent'}
              onClear={() => setSortBy('recent')}>
              {({ close }) => (
                <div className="py-1">
                  {SORT_OPTS.map(s => (
                    <DropOpt key={s.id} label={s.label} active={sortBy===s.id} onClick={() => { setSortBy(s.id); close() }}/>
                  ))}
                </div>
              )}
            </FilterChip>

            {/* Clear all */}
            {activeFilters > 0 && (
              <button onClick={clearAll} className="text-[10px] text-red-500 hover:text-red-600 font-semibold px-1.5 py-0.5 rounded hover:bg-red-50 transition-colors">
                Clear all
              </button>
            )}

            {/* Result count */}
            <span className="ml-auto text-[10px] text-slate-400 self-center">{list.length} {list.length===1?'contact':'contacts'}</span>
          </div>
        )}

        {/* ── Bulk action bar ── */}
        {selectedIds.size > 0 && (
          <div className="flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 bg-primary-50 border-b border-primary/15">
            <span className="text-[11px] font-semibold text-primary mr-1">{selectedIds.size} selected</span>
            <button onClick={() => setBulkChannel('whatsapp')}
              className="flex items-center gap-1 px-2 py-0.5 rounded-lg bg-emerald-500 text-white text-[10px] font-semibold hover:bg-emerald-600 transition-colors">
              <MessageSquare size={9}/>WhatsApp
            </button>
            <button onClick={() => setBulkChannel('email')}
              className="flex items-center gap-1 px-2 py-0.5 rounded-lg bg-blue-500 text-white text-[10px] font-semibold hover:bg-blue-600 transition-colors">
              <Mail size={9}/>Email
            </button>
            <button onClick={() => setSelectedIds(new Set())}
              className="ml-auto flex items-center gap-0.5 text-[10px] text-slate-500 hover:text-slate-700 transition-colors">
              <X size={10}/>Clear
            </button>
          </div>
        )}

        {/* ── Contact list / table ── */}
        {viewMode === 'list' ? (
          <>
            {/* select-all header for list view — visible in manual mode or when contacts are selected */}
            {list.length > 0 && (manualSelectMode || selectedIds.size > 0) && (
              <div className="flex items-center gap-2 px-2.5 py-1.5 border-b border-surface-border bg-primary-50/60 flex-shrink-0">
                <input type="checkbox"
                  ref={el => { if (el) el.indeterminate = list.some(c => selectedIds.has(c.id)) && !list.every(c => selectedIds.has(c.id)) }}
                  checked={list.length > 0 && list.every(c => selectedIds.has(c.id))}
                  onChange={() => toggleSelectAll(list)}
                  className="w-3.5 h-3.5 rounded border-slate-300 text-primary focus:ring-primary/20 cursor-pointer"/>
                <span className="text-[10px] text-slate-500 select-none flex-1">
                  {selectedIds.size > 0
                    ? <><span className="font-semibold text-primary">{selectedIds.size}</span> of {list.length} selected</>
                    : <span className="text-slate-400">Click contacts to select</span>}
                </span>
                <button
                  onClick={() => { setSelectedIds(new Set()); setManualSelectMode(false) }}
                  className="text-[10px] text-slate-400 hover:text-slate-600 transition-colors px-1">
                  Cancel
                </button>
              </div>
            )}
            <div className="flex-1 overflow-y-auto min-h-0">
              {!list.length
                ? <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
                    <Users size={28} className="text-slate-300 mb-3"/>
                    <p className="text-[13px] font-semibold text-slate-500 mb-1">No contacts found</p>
                    <p className="text-[12px] text-slate-400">Try adjusting your search or filters</p>
                  </div>
                : list.map(c => (
                    <ContactRow key={c.id} c={c} active={selId===c.id}
                      selected={selectedIds.has(c.id)}
                      onToggle={toggleSelect}
                      manualSelect={manualSelectMode}
                      onClick={() => handleContactClick(c.id)}/>
                  ))
              }
            </div>
          </>
        ) : (
          <ContactTable
            contacts={list}
            selId={selId}
            onContactClick={handleContactClick}
            selectedIds={selectedIds}
            onToggle={toggleSelect}
            onToggleAll={toggleSelectAll}
            onTemplate={c => setTpl(c)}
            onCall={c => setCall(c)}
          />
        )}

      </div>

      {/* ── Right panel: detail view ── */}
      <div className={clsx(
        'flex flex-col overflow-hidden',
        viewMode === 'list'
          ? ['flex-1 min-w-0', mobileContactView === 'list' ? 'hidden md:flex' : 'flex']
          : selId ? 'flex flex-shrink-0 w-[380px] border-l border-surface-border' : 'hidden'
      )}>
        {/* Mobile back button */}
        <div className="md:hidden flex items-center gap-2 px-3 py-2 bg-white border-b border-surface-border flex-shrink-0">
          <button onClick={() => setMobileContactView('list')}
            className="flex items-center gap-1.5 text-xs font-semibold text-primary">
            <ChevronDown size={14} className="rotate-90"/> Back to contacts
          </button>
        </div>
      {selContact
        ? <ContactPanel
            c={selContact}
            onClose={()=>{ setSelId(null); setMobileContactView('list') }}
            onUpdate={upd}
            onDelete={del}
            onTemplate={c=>setTpl(c)}
            onCall={c=>setCall(c)}
            groups={groups}
          />
        : <div className="flex-1 flex flex-col items-center justify-center bg-[#f7f8fc] text-center p-8">
            <div className="w-20 h-20 rounded-2xl bg-white border border-surface-border flex items-center justify-center mb-5">
              <Users size={32} className="text-slate-200"/>
            </div>
            <p className="font-semibold text-slate-600">Select a contact</p>
            <p className="text-sm text-slate-400 mt-1.5 max-w-xs">Choose from the list on the left to view profile</p>
            <button onClick={()=>setAdd(true)}
              className="mt-5 flex items-center gap-2 text-xs text-slate-400 bg-white px-4 py-2 rounded-full border border-surface-border hover:border-primary/30 hover:text-primary transition-colors">
              <Plus size={13}/>Add new contact
            </button>
          </div>
      }
      </div>{/* end right panel wrapper */}

      {/* modals */}
      {tplC        && <TemplateModal contact={tplC} onClose={()=>setTpl(null)}/>}
      {callC       && <CallModal c={callC} onClose={()=>setCall(null)}/>}
      {showAdd     && <AddModal onClose={()=>setAdd(false)} onAdd={add}/>}
      {showImport  && <ImportModal onClose={()=>setImport(false)} onImport={onImport} groups={groups}/>}
      {showCreateGroup && <CreateGroupModal onClose={()=>setShowCreateGroup(false)} onSave={g=>setGroups(p=>[...p,g])}/>}
      {bulkChannel && <BulkTemplateModal count={selectedIds.size} defaultChannel={bulkChannel} onClose={()=>setBulkChannel(null)}/>}
    </div>
  )
}
