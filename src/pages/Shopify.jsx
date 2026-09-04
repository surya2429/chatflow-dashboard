import { useState } from 'react'
import {
  ShoppingCart, Package, Truck, Zap, Settings, BarChart2,
  RefreshCw, Check, X, ChevronDown, ChevronRight,
  Search, Copy, ExternalLink, AlertCircle, CheckCircle2,
  ArrowUpRight, ArrowUp, Plus, Eye, Link2, Bell,
  Star, Tag, Clock, Users, TrendingUp, DollarSign,
  MessageCircle, Globe, ShoppingBag, RotateCcw,
  Send, Info, Grid, List, Sparkles, Activity,
  ChevronUp, Edit2, MoreHorizontal, Layers,
} from 'lucide-react'
import clsx from 'clsx'

/* ─── Constants ──────────────────────────────────────────────── */
const TABS = [
  { id: 'overview',    label: 'Overview',    icon: BarChart2    },
  { id: 'products',    label: 'Products',    icon: Package      },
  { id: 'orders',      label: 'Orders',      icon: ShoppingCart },
  { id: 'automations', label: 'Automations', icon: Zap          },
  { id: 'settings',    label: 'Settings',    icon: Settings     },
]

const MOCK_PRODUCTS = [
  { id:'SP001', name:'Premium Wireless Earbuds', price:4999, compareAt:6999, inventory:143, category:'Electronics', image:'🎧', inChat:true,  inWhatsApp:true  },
  { id:'SP002', name:'Organic Cotton T-Shirt',   price:799,  compareAt:1299, inventory:512, category:'Apparel',     image:'👕', inChat:true,  inWhatsApp:false },
  { id:'SP003', name:'Stainless Water Bottle',   price:1299, compareAt:null, inventory:89,  category:'Lifestyle',   image:'🍶', inChat:false, inWhatsApp:false },
  { id:'SP004', name:'Yoga Mat Pro',             price:2499, compareAt:3499, inventory:34,  category:'Fitness',     image:'🧘', inChat:true,  inWhatsApp:true  },
  { id:'SP005', name:'Artisan Coffee Blend',     price:649,  compareAt:null, inventory:220, category:'Food',        image:'☕', inChat:false, inWhatsApp:false },
  { id:'SP006', name:'Leather Wallet Slim',      price:1599, compareAt:2199, inventory:67,  category:'Accessories', image:'👜', inChat:true,  inWhatsApp:false },
  { id:'SP007', name:'Smart LED Desk Lamp',      price:3299, compareAt:4499, inventory:22,  category:'Electronics', image:'💡', inChat:false, inWhatsApp:false },
  { id:'SP008', name:'Running Shoes Pro X',      price:5499, compareAt:7999, inventory:18,  category:'Footwear',    image:'👟', inChat:true,  inWhatsApp:true  },
]

const MOCK_ORDERS = [
  { id:'#1042', customer:'Arjun Sharma',  phone:'+91 98765 43210', items:2, total:5798, status:'delivered', channel:'whatsapp', date:'Today, 10:24 AM'    },
  { id:'#1041', customer:'Neha Patel',    phone:'+91 87654 32109', items:1, total:4999, status:'shipped',   channel:'webchat',  date:'Today, 9:11 AM'     },
  { id:'#1040', customer:'Rahul Singh',   phone:'+91 76543 21098', items:3, total:2447, status:'confirmed', channel:'whatsapp', date:'Yesterday, 6:45 PM' },
  { id:'#1039', customer:'Priya Verma',   phone:'+91 65432 10987', items:1, total:1299, status:'delivered', channel:'webchat',  date:'Yesterday, 2:30 PM' },
  { id:'#1038', customer:'Ankit Joshi',   phone:'+91 54321 09876', items:4, total:11596,status:'cancelled', channel:'whatsapp', date:'2 days ago'         },
  { id:'#1037', customer:'Sunita Das',    phone:'+91 43210 98765', items:2, total:8298, status:'delivered', channel:'whatsapp', date:'3 days ago'         },
]

const ORDER_STATUS = {
  delivered: { label:'Delivered', cls:'bg-emerald-100 text-emerald-700', dot:'bg-emerald-500' },
  shipped:   { label:'Shipped',   cls:'bg-blue-100 text-blue-700',       dot:'bg-blue-500'    },
  confirmed: { label:'Confirmed', cls:'bg-amber-100 text-amber-700',     dot:'bg-amber-500'   },
  cancelled: { label:'Cancelled', cls:'bg-red-100 text-red-600',         dot:'bg-red-400'     },
}

const AUTOMATIONS = [
  {
    id:'abandoned_cart', name:'Abandoned Cart Recovery', icon:'🛒', channel:'whatsapp', enabled:true,
    desc:'Recover lost sales by messaging customers who leave items in their cart.',
    delay:'1 hour after abandon',
    stats:{ sent:1247, opened:892, revenue:'₹1,84,320', rate:'71%' },
    template:'Hey {{name}}! 👋 You left something behind. Your {{product}} is still waiting. Use code SAVE10 for 10% off! 🎁',
  },
  {
    id:'order_confirmation', name:'Order Confirmation', icon:'✅', channel:'whatsapp', enabled:true,
    desc:'Send instant order details on WhatsApp as soon as an order is placed.',
    delay:'Instantly on order',
    stats:{ sent:2831, opened:2690, revenue:'—', rate:'95%' },
    template:'Your order {{order_id}} is confirmed! 🎉 Total: ₹{{total}}. We\'ll notify you when it ships.',
  },
  {
    id:'shipping_update', name:'Shipping Update', icon:'🚚', channel:'whatsapp', enabled:true,
    desc:'Notify customers when their order ships with live tracking info.',
    delay:'On fulfillment',
    stats:{ sent:2104, opened:1988, revenue:'—', rate:'94%' },
    template:'Great news! Your order {{order_id}} has shipped 📦. Track here: {{tracking_url}}',
  },
  {
    id:'delivery_confirm', name:'Delivery Confirmation', icon:'📬', channel:'whatsapp', enabled:false,
    desc:'Confirm delivery and request a review when an order is marked delivered.',
    delay:'On delivery',
    stats:{ sent:0, opened:0, revenue:'—', rate:'—' },
    template:'Your order has been delivered! 🙌 How was it? Leave a review: {{review_url}}',
  },
  {
    id:'back_in_stock', name:'Back in Stock Alert', icon:'🔔', channel:'both', enabled:true,
    desc:'Notify waitlisted customers the moment a product is restocked.',
    delay:'On restock',
    stats:{ sent:342, opened:298, revenue:'₹43,150', rate:'87%' },
    template:'{{product}} is back in stock! 🎉 Get yours before it runs out again: {{product_url}}',
  },
  {
    id:'review_request', name:'Review Request', icon:'⭐', channel:'whatsapp', enabled:false,
    desc:'Ask customers for a product review 3 days after delivery.',
    delay:'3 days post-delivery',
    stats:{ sent:0, opened:0, revenue:'—', rate:'—' },
    template:'Hi {{name}}! Enjoying your {{product}}? Your review helps others. Rate it here: {{review_url}} ⭐',
  },
  {
    id:'reorder_reminder', name:'Reorder Reminder', icon:'🔄', channel:'whatsapp', enabled:false,
    desc:'Remind customers to reorder consumables based on estimated usage.',
    delay:'Custom schedule',
    stats:{ sent:0, opened:0, revenue:'—', rate:'—' },
    template:'Running low on {{product}}? Time to restock! Order now: {{product_url}} 📦',
  },
  {
    id:'chat_order_lookup', name:'Order Tracking in Chat', icon:'🔍', channel:'both', enabled:true,
    desc:'Let customers get instant order status by typing their order number in chat.',
    delay:'On customer request',
    stats:{ sent:892, opened:892, revenue:'—', rate:'100%' },
    template:'Auto-generated: Order status, shipping details, and tracking link pulled live from Shopify.',
  },
]

const WEBHOOKS = [
  { event:'orders/create',     calls:2831 },
  { event:'orders/updated',    calls:1204 },
  { event:'orders/fulfilled',  calls:2104 },
  { event:'checkouts/create',  calls:4892 },
  { event:'products/update',   calls:341  },
  { event:'inventory/update',  calls:128  },
]

/* ─── Helpers ────────────────────────────────────────────────── */
function useCopy() {
  const [copied, setCopied] = useState(null)
  function copy(text, key) {
    navigator.clipboard.writeText(text).catch(()=>{})
    setCopied(key)
    setTimeout(()=>setCopied(null), 2000)
  }
  return { copied, copy }
}

function rupee(n) {
  return '₹' + (n/100).toLocaleString('en-IN', { minimumFractionDigits:0 })
}

/* ─── Shared UI atoms ────────────────────────────────────────── */
function Toggle({ checked, onChange }) {
  return (
    <button onClick={()=>onChange(!checked)} style={{
      width:34, height:18, borderRadius:9, border:'none', cursor:'pointer', position:'relative',
      background: checked ? '#0066ff' : '#d1d5db', transition:'background 0.2s', padding:0, flexShrink:0,
    }}>
      <div style={{ position:'absolute', top:2, left: checked ? 16 : 2, width:14, height:14, borderRadius:'50%',
        background:'#fff', transition:'left 0.2s', boxShadow:'0 1px 3px rgba(0,0,0,0.2)' }}/>
    </button>
  )
}

function StatusDot({ status }) {
  const s = ORDER_STATUS[status]
  return (
    <span className={clsx('inline-flex items-center gap-1.5 text-[10px] font-semibold px-2.5 py-1 rounded-full', s.cls)}>
      <span className={clsx('w-1.5 h-1.5 rounded-full flex-shrink-0', s.dot)}/>
      {s.label}
    </span>
  )
}

function ChannelPill({ channel }) {
  if (channel === 'both') return (
    <div className="flex gap-1">
      <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-700 font-bold">WA</span>
      <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-blue-100 text-blue-700 font-bold">Web</span>
    </div>
  )
  if (channel === 'whatsapp') return <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-700 font-bold">WhatsApp</span>
  return <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-blue-100 text-blue-700 font-bold">Web Chat</span>
}

function KpiCard({ label, value, change, icon: Icon, color }) {
  const palette = {
    emerald: { iconBg:'bg-emerald-50', iconClr:'text-emerald-500', changeBg:'bg-emerald-50', changeClr:'text-emerald-700' },
    blue:    { iconBg:'bg-blue-50',    iconClr:'text-blue-500',    changeBg:'bg-blue-50',    changeClr:'text-blue-700'    },
    amber:   { iconBg:'bg-amber-50',   iconClr:'text-amber-500',   changeBg:'bg-amber-50',   changeClr:'text-amber-700'   },
    purple:  { iconBg:'bg-purple-50',  iconClr:'text-purple-500',  changeBg:'bg-purple-50',  changeClr:'text-purple-700'  },
  }
  const c = palette[color]
  return (
    <div className="bg-white border border-surface-border rounded-xl p-4 hover:shadow-sm transition-shadow cursor-default">
      <div className="flex items-start justify-between mb-3">
        <div className={clsx('w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0', c.iconBg)}>
          <Icon size={15} className={c.iconClr}/>
        </div>
        {change && (
          <span className={clsx('flex items-center gap-0.5 text-[10px] font-bold px-1.5 py-0.5 rounded-full', c.changeBg, c.changeClr)}>
            <ArrowUp size={8}/>{change}
          </span>
        )}
      </div>
      <p className="text-[22px] font-bold text-slate-900 tracking-tight leading-none mb-1">{value}</p>
      <p className="text-[11px] text-slate-500 font-medium">{label}</p>
    </div>
  )
}

function CollapsibleCard({ title, icon: Icon, badge, defaultOpen=true, children }) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div className="bg-white border border-surface-border rounded-xl overflow-hidden">
      <button onClick={()=>setOpen(p=>!p)}
        className="w-full flex items-center gap-3 px-4 py-3.5 hover:bg-slate-50 transition-colors text-left">
        {Icon && <Icon size={14} className="text-slate-400 flex-shrink-0"/>}
        <span className="flex-1 text-sm font-semibold text-slate-800">{title}</span>
        {badge && <span className="text-[10px] bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full font-semibold">{badge}</span>}
        <ChevronDown size={14} className={clsx('text-slate-400 transition-transform duration-150', open && 'rotate-180')}/>
      </button>
      {open && <div className="border-t border-surface-border p-4 space-y-4">{children}</div>}
    </div>
  )
}

/* ─── Tab: Overview ──────────────────────────────────────────── */
function OverviewTab() {
  const ACTIVITY = [
    { icon:'🛒', text:'Abandoned cart recovered',  sub:'Arjun Sharma — Order #1042 · ₹5,798',   time:'10m', color:'emerald' },
    { icon:'📦', text:'Order shipped',              sub:'Neha Patel — #1041 · Delhivery',          time:'1h',  color:'blue'    },
    { icon:'🔔', text:'Back in stock alert sent',   sub:'48 customers — Yoga Mat Pro restocked',   time:'2h',  color:'amber'   },
    { icon:'⭐', text:'New review via WhatsApp',    sub:'Rahul Singh — Premium Earbuds · 5★',      time:'3h',  color:'purple'  },
    { icon:'🛒', text:'Cart recovered',             sub:'Priya Verma — Order #1039 · ₹1,299',     time:'5h',  color:'emerald' },
    { icon:'✅', text:'Order confirmed',             sub:'Ankit Joshi — #1038 · ₹11,596',          time:'1d',  color:'blue'    },
  ]
  const actColor = { emerald:'bg-emerald-100', blue:'bg-blue-100', amber:'bg-amber-100', purple:'bg-purple-100' }

  return (
    <div className="space-y-5">
      {/* KPI row */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        <KpiCard label="Revenue via Chat"   value="₹3,84,290" change="+34%" icon={DollarSign}  color="emerald"/>
        <KpiCard label="Orders via Bot"     value="312"        change="+22%" icon={ShoppingCart}color="blue"/>
        <KpiCard label="Cart Recovery Rate" value="71%"        change="+8%"  icon={RotateCcw}   color="amber"/>
        <KpiCard label="Products in Chat"   value="5 / 8"      change={null} icon={Package}     color="purple"/>
      </div>

      {/* Middle row */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Revenue by channel */}
        <div className="bg-white border border-surface-border rounded-xl p-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-bold text-slate-800">Revenue by Channel</h3>
            <span className="text-[10px] text-slate-400 font-medium">This month</span>
          </div>
          <div className="space-y-4">
            {[
              { label:'WhatsApp', pct:68, amount:'₹2,61,317', color:'bg-emerald-500', light:'bg-emerald-50' },
              { label:'Web Chat', pct:32, amount:'₹1,22,973', color:'bg-blue-500',    light:'bg-blue-50'    },
            ].map(r => (
              <div key={r.label}>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <div className={clsx('w-2 h-2 rounded-full', r.color)}/>
                    <span className="text-[12px] font-semibold text-slate-700">{r.label}</span>
                  </div>
                  <div className="text-right">
                    <span className="text-[12px] font-bold text-slate-800">{r.amount}</span>
                    <span className="text-[10px] text-slate-400 ml-1.5">{r.pct}%</span>
                  </div>
                </div>
                <div className="h-2.5 bg-slate-100 rounded-full overflow-hidden">
                  <div className={clsx('h-full rounded-full transition-all duration-700', r.color)} style={{width:`${r.pct}%`}}/>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-4 pt-4 border-t border-surface-border flex items-center justify-between">
            <span className="text-[11px] text-slate-500">Total revenue attributed</span>
            <span className="text-sm font-bold text-slate-900">₹3,84,290</span>
          </div>
        </div>

        {/* Top products */}
        <div className="bg-white border border-surface-border rounded-xl p-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-bold text-slate-800">Top Products via Chat</h3>
            <button className="text-[11px] text-primary font-semibold hover:underline flex items-center gap-0.5">
              View all <ChevronRight size={11}/>
            </button>
          </div>
          <div className="space-y-3">
            {[
              { name:'Premium Wireless Earbuds', orders:89, rev:'₹44,511', img:'🎧', pct:89 },
              { name:'Running Shoes Pro X',      orders:54, rev:'₹29,646', img:'👟', pct:54 },
              { name:'Yoga Mat Pro',             orders:47, rev:'₹11,753', img:'🧘', pct:47 },
              { name:'Leather Wallet Slim',      orders:38, rev:'₹6,076',  img:'👜', pct:38 },
            ].map((p,i) => (
              <div key={i} className="flex items-center gap-3">
                <div className="w-7 h-7 rounded-lg bg-slate-50 border border-surface-border flex items-center justify-center text-base flex-shrink-0">{p.img}</div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-[11px] font-semibold text-slate-700 truncate">{p.name}</p>
                    <span className="text-[11px] font-bold text-slate-800 ml-2 flex-shrink-0">{p.rev}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                      <div className="h-full bg-primary rounded-full" style={{width:`${p.pct}%`}}/>
                    </div>
                    <span className="text-[10px] text-slate-400 flex-shrink-0">{p.orders} orders</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Live activity */}
      <div className="bg-white border border-surface-border rounded-xl overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3.5 border-b border-surface-border">
          <div className="flex items-center gap-2">
            <Activity size={14} className="text-primary"/>
            <h3 className="text-sm font-bold text-slate-800">Live Activity</h3>
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"/>
          </div>
          <button className="text-[11px] text-primary font-semibold hover:underline flex items-center gap-0.5">
            View all <ChevronRight size={11}/>
          </button>
        </div>
        <div className="divide-y divide-surface-border">
          {ACTIVITY.map((a,i) => (
            <div key={i} className="flex items-center gap-4 px-4 py-3 hover:bg-slate-50/80 transition-colors">
              <div className={clsx('w-8 h-8 rounded-xl flex items-center justify-center text-base flex-shrink-0', actColor[a.color])}>
                {a.icon}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[12px] font-semibold text-slate-800">{a.text}</p>
                <p className="text-[10px] text-slate-400 mt-0.5 truncate">{a.sub}</p>
              </div>
              <span className="text-[10px] text-slate-400 flex-shrink-0 bg-slate-50 px-2 py-0.5 rounded-full font-medium">{a.time} ago</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

/* ─── Tab: Products ──────────────────────────────────────────── */
function ProductsTab() {
  const [products, setProducts] = useState(MOCK_PRODUCTS)
  const [search, setSearch] = useState('')
  const [view, setView] = useState('grid')
  const [syncing, setSyncing] = useState(false)

  function toggle(id, field) {
    setProducts(p => p.map(pr => pr.id === id ? { ...pr, [field]: !pr[field] } : pr))
  }
  function syncNow() { setSyncing(true); setTimeout(()=>setSyncing(false), 2000) }

  const filtered = products.filter(p => !search || p.name.toLowerCase().includes(search.toLowerCase()))

  return (
    <div className="space-y-4">
      {/* Stats strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label:'Total Products',  value:products.length,                           icon:Package,      color:'text-slate-500',  bg:'bg-slate-50'    },
          { label:'Synced to Chat',  value:products.filter(p=>p.inChat).length,       icon:Globe,        color:'text-blue-500',   bg:'bg-blue-50'     },
          { label:'On WhatsApp',     value:products.filter(p=>p.inWhatsApp).length,   icon:MessageCircle,color:'text-emerald-500',bg:'bg-emerald-50'  },
          { label:'Low Stock (<30)', value:products.filter(p=>p.inventory<30).length, icon:AlertCircle,  color:'text-amber-500',  bg:'bg-amber-50'    },
        ].map(s => (
          <div key={s.label} className="bg-white border border-surface-border rounded-xl p-3 flex items-center gap-3">
            <div className={clsx('w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0', s.bg)}>
              <s.icon size={16} className={s.color}/>
            </div>
            <div>
              <p className="text-xl font-bold text-slate-900">{s.value}</p>
              <p className="text-[10px] text-slate-500 font-medium">{s.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[180px]">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"/>
          <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search products…"
            className="input pl-8 text-xs h-9"/>
        </div>
        <div className="flex items-center bg-white border border-surface-border rounded-lg p-1 gap-0.5">
          {[{id:'grid',icon:Grid},{id:'list',icon:List}].map(({id,icon:Icon})=>(
            <button key={id} onClick={()=>setView(id)}
              className={clsx('p-1.5 rounded-md transition-colors', view===id ? 'bg-primary text-white' : 'text-slate-400 hover:text-slate-600')}>
              <Icon size={13}/>
            </button>
          ))}
        </div>
        <button onClick={syncNow} className={clsx('btn-secondary text-xs flex items-center gap-1.5 h-9', syncing&&'opacity-70')}>
          <RefreshCw size={11} className={syncing?'animate-spin':''}/>{syncing?'Syncing…':'Sync from Shopify'}
        </button>
        <button className="btn-primary text-xs flex items-center gap-1.5 h-9">
          <Plus size={11}/> Add to Chat
        </button>
      </div>

      {/* Grid view */}
      {view === 'grid' ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
          {filtered.map(p => (
            <div key={p.id} className="bg-white border border-surface-border rounded-xl overflow-hidden hover:shadow-md hover:border-slate-300 transition-all group">
              <div className="h-28 bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center text-5xl relative border-b border-surface-border">
                {p.inventory < 30 && (
                  <span className="absolute top-2 left-2 text-[9px] px-2 py-0.5 rounded-full bg-amber-500 text-white font-bold">Low stock</span>
                )}
                {p.compareAt && (
                  <span className="absolute top-2 right-2 text-[9px] px-2 py-0.5 rounded-full bg-red-500 text-white font-bold">Sale</span>
                )}
                {p.image}
              </div>
              <div className="p-3">
                <p className="text-[11px] text-slate-400 font-medium mb-0.5">{p.category}</p>
                <p className="text-[12px] font-bold text-slate-800 leading-tight mb-2 truncate">{p.name}</p>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-[13px] font-bold text-slate-900">{rupee(p.price)}</span>
                  {p.compareAt && <span className="text-[10px] text-slate-400 line-through">{rupee(p.compareAt)}</span>}
                </div>
                <p className="text-[10px] text-slate-400 mb-3">{p.inventory} in stock</p>
                <div className="space-y-2 pt-3 border-t border-surface-border">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <Globe size={10} className="text-blue-400"/>
                      <span className="text-[10px] text-slate-600 font-medium">Web Chat</span>
                    </div>
                    <Toggle checked={p.inChat} onChange={()=>toggle(p.id,'inChat')}/>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <MessageCircle size={10} className="text-emerald-500"/>
                      <span className="text-[10px] text-slate-600 font-medium">WhatsApp</span>
                    </div>
                    <Toggle checked={p.inWhatsApp} onChange={()=>toggle(p.id,'inWhatsApp')}/>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="bg-white border border-surface-border rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full" style={{minWidth:640}}>
              <thead>
                <tr className="bg-slate-50 border-b border-surface-border">
                  {['Product','Price','Stock','Category','Web Chat','WhatsApp'].map(h=>(
                    <th key={h} className="text-left text-[10px] font-bold text-slate-400 uppercase tracking-wider px-4 py-3">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-border">
                {filtered.map(p=>(
                  <tr key={p.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-slate-50 border border-surface-border flex items-center justify-center text-xl">{p.image}</div>
                        <div>
                          <p className="text-[12px] font-semibold text-slate-800">{p.name}</p>
                          <p className="text-[10px] text-slate-400">{p.id}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-[12px] font-bold text-slate-800">{rupee(p.price)}</p>
                      {p.compareAt && <p className="text-[10px] text-slate-400 line-through">{rupee(p.compareAt)}</p>}
                    </td>
                    <td className="px-4 py-3">
                      <span className={clsx('text-[10px] px-2.5 py-1 rounded-full font-semibold', p.inventory < 30 ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-600')}>
                        {p.inventory}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-[11px] text-slate-500">{p.category}</td>
                    <td className="px-4 py-3"><Toggle checked={p.inChat} onChange={()=>toggle(p.id,'inChat')}/></td>
                    <td className="px-4 py-3"><Toggle checked={p.inWhatsApp} onChange={()=>toggle(p.id,'inWhatsApp')}/></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}

/* ─── Tab: Orders ────────────────────────────────────────────── */
function OrdersTab() {
  const [lookup, setLookup] = useState('')
  const [lookupResult, setLookupResult] = useState(null)
  const [loading, setLoading] = useState(false)
  const [activeStatus, setActiveStatus] = useState('All')

  function doLookup() {
    if (!lookup.trim()) return
    setLoading(true)
    setTimeout(()=>{
      setLoading(false)
      setLookupResult({
        id:'#1042', customer:'Arjun Sharma', email:'arjun@example.com', phone:'+91 98765 43210',
        status:'delivered', date:'Today, 10:24 AM', total:5798,
        items:[
          { name:'Premium Wireless Earbuds', qty:1, price:4999, img:'🎧' },
          { name:'Leather Wallet Slim',       qty:1, price:799,  img:'👜' },
        ],
        shipping:{ carrier:'Delhivery', tracking:'DEL123456789' },
        timeline:[
          { status:'Order Placed',     time:'Today, 8:00 AM',  done:true  },
          { status:'Payment Confirmed',time:'Today, 8:01 AM',  done:true  },
          { status:'Packed',           time:'Today, 9:30 AM',  done:true  },
          { status:'Shipped',          time:'Today, 9:45 AM',  done:true  },
          { status:'Delivered',        time:'Today, 12:30 PM', done:true  },
        ],
      })
    }, 1000)
  }

  const statuses = ['All', 'Delivered', 'Shipped', 'Confirmed', 'Cancelled']
  const filtered = activeStatus === 'All' ? MOCK_ORDERS : MOCK_ORDERS.filter(o => ORDER_STATUS[o.status].label === activeStatus)

  return (
    <div className="space-y-5">
      {/* Order lookup */}
      <div className="bg-white border border-surface-border rounded-xl overflow-hidden">
        <div className="px-4 py-3.5 border-b border-surface-border bg-slate-50/60">
          <h3 className="text-sm font-bold text-slate-800">Order Lookup</h3>
          <p className="text-[11px] text-slate-400 mt-0.5">Search by order ID, customer email, or phone number</p>
        </div>
        <div className="p-4 space-y-4">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"/>
              <input value={lookup} onChange={e=>setLookup(e.target.value)} onKeyDown={e=>e.key==='Enter'&&doLookup()}
                placeholder="#1042 or arjun@example.com or +91 98765…"
                className="input pl-8 text-sm h-9 w-full"/>
            </div>
            <button onClick={doLookup} disabled={loading}
              className={clsx('btn-primary text-xs flex items-center gap-1.5 flex-shrink-0 h-9 px-4', loading&&'opacity-70')}>
              {loading ? <RefreshCw size={11} className="animate-spin"/> : <Search size={11}/>}
              {loading ? 'Searching…' : 'Search'}
            </button>
          </div>

          {lookupResult && (
            <div className="border border-surface-border rounded-xl overflow-hidden">
              {/* Order header */}
              <div className="flex flex-wrap items-center justify-between gap-3 p-4 bg-slate-50 border-b border-surface-border">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center text-primary text-sm font-bold flex-shrink-0">
                    {lookupResult.customer[0]}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-bold text-slate-900">{lookupResult.id}</p>
                      <StatusDot status={lookupResult.status}/>
                    </div>
                    <p className="text-[10px] text-slate-500 mt-0.5">{lookupResult.customer} · {lookupResult.phone}</p>
                  </div>
                </div>
                <button className="btn-primary text-xs flex items-center gap-1.5 h-8">
                  <Send size={10}/> Send Update
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-surface-border">
                {/* Items */}
                <div className="p-4">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-3">Items</p>
                  <div className="space-y-3">
                    {lookupResult.items.map((item,i)=>(
                      <div key={i} className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-lg bg-slate-50 border border-surface-border flex items-center justify-center text-xl">{item.img}</div>
                        <div className="flex-1 min-w-0">
                          <p className="text-[11px] font-semibold text-slate-800 truncate">{item.name}</p>
                          <p className="text-[10px] text-slate-400">Qty {item.qty} · ₹{item.price.toLocaleString('en-IN')}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="flex justify-between text-[12px] font-bold pt-3 mt-3 border-t border-surface-border">
                    <span className="text-slate-600">Order Total</span>
                    <span className="text-slate-900">₹{lookupResult.total.toLocaleString('en-IN')}</span>
                  </div>
                </div>

                {/* Timeline */}
                <div className="p-4">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-3">Tracking</p>
                  <p className="text-[11px] text-slate-600 mb-4">
                    <span className="font-semibold">{lookupResult.shipping.carrier}</span>
                    <span className="text-slate-400 ml-1.5 font-mono text-[10px]">{lookupResult.shipping.tracking}</span>
                  </p>
                  <div className="space-y-3">
                    {lookupResult.timeline.map((t,i)=>(
                      <div key={i} className="flex items-start gap-3">
                        <div className={clsx('w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 transition-colors',
                          t.done ? 'bg-emerald-500' : 'bg-slate-100')}>
                          {t.done ? <Check size={10} className="text-white"/> : <div className="w-2 h-2 rounded-full bg-slate-300"/>}
                        </div>
                        <div>
                          <p className={clsx('text-[11px] font-semibold', t.done ? 'text-slate-800' : 'text-slate-400')}>{t.status}</p>
                          <p className="text-[10px] text-slate-400 mt-0.5">{t.time}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Orders table */}
      <div className="bg-white border border-surface-border rounded-xl overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3.5 border-b border-surface-border">
          <h3 className="text-sm font-bold text-slate-800">Orders via Chat</h3>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1 bg-slate-50 border border-surface-border rounded-lg p-0.5">
              {statuses.map(s=>(
                <button key={s} onClick={()=>setActiveStatus(s)}
                  className={clsx('text-[10px] font-semibold px-2.5 py-1 rounded-md transition-colors',
                    activeStatus===s ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700')}>
                  {s}
                </button>
              ))}
            </div>
            <button className="btn-ghost text-xs h-8">Export</button>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full" style={{minWidth:600}}>
            <thead>
              <tr className="bg-slate-50 border-b border-surface-border">
                {['Order','Customer','Items','Total','Status','Channel','Date',''].map(h=>(
                  <th key={h} className="text-left text-[10px] font-bold text-slate-400 uppercase tracking-wider px-4 py-3">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-border">
              {filtered.map(o=>(
                <tr key={o.id} className="hover:bg-slate-50/80 transition-colors">
                  <td className="px-4 py-3 text-[12px] font-bold text-primary">{o.id}</td>
                  <td className="px-4 py-3">
                    <p className="text-[12px] font-semibold text-slate-800">{o.customer}</p>
                    <p className="text-[10px] text-slate-400">{o.phone}</p>
                  </td>
                  <td className="px-4 py-3 text-[12px] text-slate-600 font-medium">{o.items}</td>
                  <td className="px-4 py-3 text-[12px] font-bold text-slate-800">₹{o.total.toLocaleString('en-IN')}</td>
                  <td className="px-4 py-3"><StatusDot status={o.status}/></td>
                  <td className="px-4 py-3"><ChannelPill channel={o.channel}/></td>
                  <td className="px-4 py-3 text-[10px] text-slate-400 whitespace-nowrap">{o.date}</td>
                  <td className="px-4 py-3">
                    <button className="text-[11px] text-primary font-semibold hover:underline flex items-center gap-1">
                      <Send size={9}/> Notify
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

/* ─── Tab: Automations ───────────────────────────────────────── */
function AutomationsTab() {
  const [automations, setAutomations] = useState(AUTOMATIONS)
  const [expanded, setExpanded] = useState(null)

  function toggleEnabled(id) {
    setAutomations(p=>p.map(a=>a.id===id ? {...a,enabled:!a.enabled} : a))
  }

  const active = automations.filter(a=>a.enabled).length

  return (
    <div className="space-y-4">
      {/* Stats strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label:'Active Automations', value:active,        icon:Zap,          color:'text-primary',   bg:'bg-primary/5'    },
          { label:'Messages Sent',      value:'6,416',       icon:Send,         color:'text-blue-500',  bg:'bg-blue-50'      },
          { label:'Avg Open Rate',      value:'89%',         icon:Eye,          color:'text-emerald-500',bg:'bg-emerald-50'  },
          { label:'Revenue Attributed', value:'₹2,27,470',  icon:TrendingUp,   color:'text-amber-500', bg:'bg-amber-50'     },
        ].map(s=>(
          <div key={s.label} className="bg-white border border-surface-border rounded-xl p-3 flex items-center gap-3">
            <div className={clsx('w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0', s.bg)}>
              <s.icon size={16} className={s.color}/>
            </div>
            <div>
              <p className="text-xl font-bold text-slate-900">{s.value}</p>
              <p className="text-[10px] text-slate-500 font-medium">{s.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Automation cards */}
      <div className="space-y-2.5">
        {automations.map(a=>(
          <div key={a.id} className={clsx('bg-white border rounded-xl overflow-hidden transition-all',
            a.enabled ? 'border-surface-border' : 'border-surface-border opacity-60')}>
            <div className="flex items-center gap-4 p-4">
              {/* Icon */}
              <div className={clsx('w-10 h-10 rounded-xl flex items-center justify-center text-xl flex-shrink-0',
                a.enabled ? 'bg-slate-50' : 'bg-slate-50/60')}>
                {a.icon}
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap mb-0.5">
                  <p className="text-[13px] font-bold text-slate-800">{a.name}</p>
                  <ChannelPill channel={a.channel}/>
                  {a.enabled && (
                    <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-700 font-bold flex items-center gap-1">
                      <span className="w-1 h-1 rounded-full bg-emerald-500 inline-block animate-pulse"/>Active
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-slate-500 leading-relaxed">{a.desc}</p>
              </div>

              {/* Stats (visible on md+) */}
              {a.enabled && (
                <div className="hidden md:flex items-center gap-5 flex-shrink-0">
                  {[
                    { l:'Sent',    v:a.stats.sent.toLocaleString() },
                    { l:'Rate',    v:a.stats.rate },
                    { l:'Revenue', v:a.stats.revenue },
                  ].map(s=>(
                    <div key={s.l} className="text-center">
                      <p className="text-[12px] font-bold text-slate-800">{s.v}</p>
                      <p className="text-[9px] text-slate-400 mt-0.5 uppercase tracking-wide font-medium">{s.l}</p>
                    </div>
                  ))}
                </div>
              )}

              {/* Controls */}
              <div className="flex items-center gap-3 flex-shrink-0">
                <Toggle checked={a.enabled} onChange={()=>toggleEnabled(a.id)}/>
                <button onClick={()=>setExpanded(expanded===a.id ? null : a.id)}
                  className="w-7 h-7 flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors">
                  <ChevronDown size={14} className={clsx('transition-transform duration-150', expanded===a.id&&'rotate-180')}/>
                </button>
              </div>
            </div>

            {/* Mobile stats */}
            {a.enabled && (
              <div className="md:hidden flex items-center gap-5 px-4 pb-3">
                {[
                  { l:'Sent',    v:a.stats.sent.toLocaleString() },
                  { l:'Rate',    v:a.stats.rate },
                  { l:'Revenue', v:a.stats.revenue },
                ].map(s=>(
                  <div key={s.l}>
                    <p className="text-[11px] font-bold text-slate-800">{s.v}</p>
                    <p className="text-[9px] text-slate-400 uppercase tracking-wide font-medium">{s.l}</p>
                  </div>
                ))}
              </div>
            )}

            {/* Expanded template editor */}
            {expanded===a.id && (
              <div className="border-t border-surface-border p-4 space-y-3 bg-slate-50/40">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-[12px] font-bold text-slate-700">Message Template</p>
                    <p className="text-[10px] text-slate-400 mt-0.5">Trigger: <span className="font-medium text-slate-600">{a.delay}</span></p>
                  </div>
                </div>
                <textarea defaultValue={a.template} rows={3}
                  className="input text-[11px] font-mono resize-none leading-relaxed w-full"/>
                <div className="flex flex-wrap gap-1.5">
                  {['{{name}}','{{order_id}}','{{product}}','{{total}}','{{tracking_url}}','{{review_url}}'].map(v=>(
                    <button key={v}
                      className="text-[9px] px-2 py-1 rounded-full bg-primary/5 text-primary font-mono font-semibold hover:bg-primary hover:text-white transition-colors border border-primary/10">
                      {v}
                    </button>
                  ))}
                </div>
                <div className="flex items-center gap-2 pt-1">
                  <button className="btn-primary text-xs h-8">Save Template</button>
                  <button className="btn-secondary text-xs flex items-center gap-1.5 h-8"><Send size={10}/>Send Test</button>
                  <button className="btn-ghost text-xs text-slate-400 h-8">Reset to default</button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

/* ─── Tab: Settings ──────────────────────────────────────────── */
function SettingsTab() {
  const { copied, copy } = useCopy()
  const [connected, setConnected] = useState(true)
  const [syncFreq, setSyncFreq] = useState('realtime')
  const [syncItems, setSyncItems] = useState({ products:true, orders:true, customers:true, inventory:true })
  const [saved, setSaved] = useState(false)
  const WEBHOOK_URL = 'https://api.chatflow.io/webhooks/shopify/abc123'

  function handleSave() { setSaved(true); setTimeout(()=>setSaved(false), 2500) }

  return (
    <div className="space-y-5 max-w-2xl">

      {/* ── Store Connection ── */}
      <div className="bg-white border border-surface-border rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-surface-border">
          <p className="text-[13px] font-semibold text-slate-900">Store Connection</p>
          <p className="text-[11px] text-slate-400 mt-0.5">Manage your connected Shopify store</p>
        </div>
        <div className="px-5 py-4 space-y-4">
          {/* Connected store row */}
          <div className={clsx('flex items-center gap-3 p-3 rounded-lg border',
            connected ? 'border-emerald-200 bg-emerald-50/50' : 'border-slate-200 bg-slate-50')}>
            <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
              style={{background:'#96BF48'}}>
              <span className="text-white text-xs font-black">S</span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-slate-800">acmecorp.myshopify.com</p>
              <p className="text-[11px] text-slate-500 mt-0.5">Shopify Plus · Connected 14 days ago · Last synced 3 min ago</p>
            </div>
            {connected
              ? <span className="flex items-center gap-1 text-[10px] font-semibold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"/>Active
                </span>
              : null}
          </div>

          {connected ? (
            <div className="flex items-center justify-between py-1">
              <div>
                <p className="text-xs font-medium text-slate-700">Disconnect store</p>
                <p className="text-[11px] text-slate-400 mt-0.5">This will stop all syncs and automations</p>
              </div>
              <button onClick={()=>setConnected(false)}
                className="text-[11px] font-semibold text-red-500 hover:text-red-600 border border-red-200 hover:border-red-300 bg-white rounded-lg px-3 py-1.5 transition-colors">
                Disconnect
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              <div>
                <label className="label">Shopify Store URL</label>
                <input className="input" placeholder="yourstore.myshopify.com"/>
              </div>
              <button onClick={()=>setConnected(true)}
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg text-white text-xs font-bold transition-opacity hover:opacity-90"
                style={{background:'#96BF48'}}>
                <span className="font-black">S</span> Connect with Shopify OAuth
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ── Sync Configuration ── */}
      <div className="bg-white border border-surface-border rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-surface-border">
          <p className="text-[13px] font-semibold text-slate-900">Sync Configuration</p>
          <p className="text-[11px] text-slate-400 mt-0.5">Control how and what data gets synced from Shopify</p>
        </div>
        <div className="px-5 py-4 space-y-5">
          {/* Sync frequency */}
          <div>
            <label className="label">Sync Frequency</label>
            <div className="grid grid-cols-3 gap-2 mt-1">
              {[
                {val:'realtime', label:'Real-time', sub:'Via webhooks'},
                {val:'hourly',   label:'Hourly',    sub:'Every 60 min'},
                {val:'daily',    label:'Daily',     sub:'Once per day'},
              ].map(s=>(
                <button key={s.val} onClick={()=>setSyncFreq(s.val)}
                  className={clsx('text-left p-3 rounded-lg border transition-all',
                    syncFreq===s.val
                      ? 'border-primary bg-primary/5'
                      : 'border-surface-border hover:border-slate-300 bg-white')}>
                  <p className={clsx('text-xs font-semibold', syncFreq===s.val ? 'text-primary' : 'text-slate-800')}>{s.label}</p>
                  <p className="text-[11px] text-slate-400 mt-0.5">{s.sub}</p>
                </button>
              ))}
            </div>
          </div>

          {/* What to sync */}
          <div>
            <label className="label">What to sync</label>
            <div className="border border-surface-border rounded-lg overflow-hidden mt-1">
              {[
                {k:'products',  l:'Products & Variants',   sub:'SKUs, prices, stock levels', icon:Package},
                {k:'orders',    l:'Orders & Fulfillments',  sub:'Order status, tracking info', icon:ShoppingCart},
                {k:'customers', l:'Customer Profiles',      sub:'Contact details, history',    icon:Users},
                {k:'inventory', l:'Inventory Levels',       sub:'Stock counts per location',   icon:Layers},
              ].map(({k,l,sub,icon:Icon},i)=>(
                <div key={k} className={clsx('flex items-center justify-between px-4 py-3 bg-white', i&&'border-t border-surface-border')}>
                  <div className="flex items-center gap-3">
                    <div className="w-7 h-7 rounded-md bg-slate-50 border border-surface-border flex items-center justify-center flex-shrink-0">
                      <Icon size={13} className="text-slate-400"/>
                    </div>
                    <div>
                      <p className="text-xs font-medium text-slate-800">{l}</p>
                      <p className="text-[10px] text-slate-400">{sub}</p>
                    </div>
                  </div>
                  <Toggle checked={syncItems[k]} onChange={v=>setSyncItems(p=>({...p,[k]:v}))}/>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ── Webhooks ── */}
      <div className="bg-white border border-surface-border rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-surface-border flex items-center justify-between">
          <div>
            <p className="text-[13px] font-semibold text-slate-900">Webhooks</p>
            <p className="text-[11px] text-slate-400 mt-0.5">Shopify sends real-time events to this endpoint</p>
          </div>
          <span className="text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded-full">
            {WEBHOOKS.length} active
          </span>
        </div>
        <div className="px-5 py-4 space-y-4">
          <div>
            <label className="label">Webhook Endpoint URL</label>
            <div className="flex items-center gap-2 bg-slate-50 border border-surface-border rounded-lg px-3 py-2 mt-1">
              <code className="text-[11px] font-mono text-slate-700 flex-1 truncate">{WEBHOOK_URL}</code>
              <button onClick={()=>copy(WEBHOOK_URL,'wh')}
                className="flex items-center gap-1 text-[10px] font-semibold text-slate-500 hover:text-slate-700 transition-colors flex-shrink-0 border border-surface-border bg-white rounded-md px-2 py-1">
                {copied==='wh'
                  ? <><Check size={10} className="text-emerald-500"/>Copied</>
                  : <><Copy size={10}/>Copy</>}
              </button>
            </div>
          </div>
          <div>
            <label className="label">Active Events</label>
            <div className="border border-surface-border rounded-lg overflow-hidden mt-1">
              {WEBHOOKS.map((w,i)=>(
                <div key={i} className={clsx('flex items-center gap-3 px-4 py-2.5 bg-white', i&&'border-t border-surface-border')}>
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 flex-shrink-0"/>
                  <code className="text-[11px] font-mono text-slate-700 flex-1 min-w-0 truncate">{w.event}</code>
                  <span className="text-[10px] text-slate-400 flex-shrink-0">{w.calls.toLocaleString()} calls</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ── Chat Flow ── */}
      <div className="bg-white border border-surface-border rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-surface-border flex items-center justify-between">
          <div>
            <p className="text-[13px] font-semibold text-slate-900">Chat Order Lookup</p>
            <p className="text-[11px] text-slate-400 mt-0.5">Automatic order tracking via chat triggers</p>
          </div>
          <button className="text-[11px] font-semibold text-primary hover:text-primary-hover transition-colors flex items-center gap-1">
            <Settings size={11}/> Configure
          </button>
        </div>
        <div className="px-5 py-4 space-y-3">
          <div className="flex gap-2.5 bg-blue-50 border border-blue-200 rounded-lg p-3">
            <Info size={13} className="text-blue-500 flex-shrink-0 mt-0.5"/>
            <p className="text-[11px] text-blue-700 leading-relaxed">
              Customers can type <strong>"track my order"</strong> in WhatsApp or Web Chat. The bot fetches live Shopify status and replies automatically.
            </p>
          </div>
          <div className="border border-surface-border rounded-lg overflow-hidden">
            <div className="grid grid-cols-2 gap-0 bg-slate-50 px-4 py-2 border-b border-surface-border">
              <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide">Trigger</p>
              <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide">Action</p>
            </div>
            {[
              { trigger:'"track order" / "where is my order"', action:'Fetch Shopify order → reply with status' },
              { trigger:'"#1042" or any order number',         action:'Directly fetch order and reply'          },
              { trigger:'"cancel order"',                      action:'Check eligibility → escalate or cancel'  },
              { trigger:'"return" / "refund"',                 action:'Show return policy → start flow'         },
            ].map((f,i)=>(
              <div key={i} className={clsx('grid grid-cols-2 gap-0 px-4 py-2.5 bg-white', i&&'border-t border-surface-border')}>
                <code className="text-[11px] font-mono text-primary pr-3">{f.trigger}</code>
                <p className="text-[11px] text-slate-500">{f.action}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Save bar ── */}
      <div className="flex items-center justify-end gap-3 pt-1">
        {saved && (
          <span className="flex items-center gap-1.5 text-[11px] text-emerald-600 font-semibold">
            <Check size={12}/> Settings saved
          </span>
        )}
        <button onClick={handleSave} className="btn-primary flex items-center gap-1.5">
          <Check size={13}/> Save Settings
        </button>
      </div>

    </div>
  )
}

/* ─── Main Page ──────────────────────────────────────────────── */
export default function Shopify() {
  const [tab, setTab] = useState('overview')

  return (
    <div className="space-y-5">
      {/* ── Header ── */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 mb-0.5">
            <h1 className="text-[15px] font-bold text-slate-900">Shopify</h1>
            <span className="text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded-full flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block animate-pulse"/>Connected
            </span>
            <span className="text-[10px] font-bold bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full">Shopify Plus</span>
          </div>
          <p className="text-[11px] text-slate-400">acmecorp.myshopify.com · 8 products · 5 active automations · Synced 3 min ago</p>
        </div>
        <div className="flex items-center gap-2 flex-nowrap">
          <button className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-surface-border bg-white text-slate-600 text-xs font-semibold hover:bg-surface-hover transition-colors">
            <RefreshCw size={12}/> Sync now
          </button>
          <button className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-primary text-white text-xs font-semibold hover:bg-primary-hover transition-colors shadow-sm">
            <ExternalLink size={12}/> Open Shopify
          </button>
        </div>
      </div>

      {/* ── Tab switcher ── */}
      <div className="flex items-center gap-0.5 bg-slate-100 p-1 rounded-xl w-fit overflow-x-auto">
        {TABS.map(t=>(
          <button key={t.id} onClick={()=>setTab(t.id)}
            className={clsx('flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-semibold whitespace-nowrap transition-all',
              tab===t.id
                ? 'bg-white text-slate-800 shadow-sm'
                : 'text-slate-500 hover:text-slate-700')}>
            <t.icon size={13}/>{t.label}
          </button>
        ))}
      </div>

      {/* ── Tab Content ── */}
      {tab==='overview'    && <OverviewTab/>}
      {tab==='products'    && <ProductsTab/>}
      {tab==='orders'      && <OrdersTab/>}
      {tab==='automations' && <AutomationsTab/>}
      {tab==='settings'    && <SettingsTab/>}
    </div>
  )
}
