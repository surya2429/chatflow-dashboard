import { useState, useRef, useEffect } from 'react'
import {
  MessageCircle, X, ChevronLeft, Send, Smile, Paperclip,
  Search, CheckCheck, ArrowRight, Zap, Star,
  MessageSquare, HelpCircle, ThumbsUp, ThumbsDown,
  Globe, Volume2, VolumeX, Minimize2,
} from 'lucide-react'

/* ─── CSS Keyframes ────────────────────────────────────────────── */
const WIDGET_CSS = `
  @keyframes wOpen {
    0%   { opacity:0; transform:scale(0.88) translateY(20px); }
    60%  { opacity:1; transform:scale(1.02) translateY(-4px); }
    100% { opacity:1; transform:scale(1) translateY(0); }
  }
  @keyframes wClose {
    from { opacity:1; transform:scale(1) translateY(0); }
    to   { opacity:0; transform:scale(0.9) translateY(16px); }
  }
  @keyframes msgSlideIn {
    from { opacity:0; transform:translateY(10px); }
    to   { opacity:1; transform:translateY(0); }
  }
  @keyframes screenSlide {
    from { opacity:0; transform:translateX(18px); }
    to   { opacity:1; transform:translateX(0); }
  }
  @keyframes screenBack {
    from { opacity:0; transform:translateX(-18px); }
    to   { opacity:1; transform:translateX(0); }
  }
  @keyframes launchFloat {
    0%,100% { transform:translateY(0); }
    50%     { transform:translateY(-5px); }
  }
  @keyframes dotBounce {
    0%,80%,100% { transform:translateY(0); opacity:.6; }
    40%         { transform:translateY(-6px); opacity:1; }
  }
  @keyframes pulseRing {
    0%   { transform:scale(1);   opacity:.5; }
    100% { transform:scale(1.75); opacity:0; }
  }
  @keyframes badgePop {
    0%   { transform:scale(0) rotate(-15deg); }
    65%  { transform:scale(1.25) rotate(5deg); }
    100% { transform:scale(1) rotate(0); }
  }
  @keyframes tooltipIn {
    from { opacity:0; transform:translateX(8px); }
    to   { opacity:1; transform:translateX(0); }
  }
  @keyframes ratingIn {
    from { opacity:0; transform:scale(.9); }
    to   { opacity:1; transform:scale(1); }
  }
  @keyframes checkIn {
    from { opacity:0; transform:scale(.5); }
    to   { opacity:1; transform:scale(1); }
  }
  @keyframes gradShift {
    0%,100% { background-position:0% 50%; }
    50%     { background-position:100% 50%; }
  }
  .cfw-window  { animation: wOpen .35s cubic-bezier(.22,1,.36,1) both; }
  .cfw-closing { animation: wClose .22s ease forwards; }
  .cfw-msg     { animation: msgSlideIn .28s ease both; }
  .cfw-screen  { animation: screenSlide .25s cubic-bezier(.4,0,.2,1) both; }
  .cfw-back    { animation: screenBack .25s cubic-bezier(.4,0,.2,1) both; }
  .cfw-launch  { animation: launchFloat 3.5s ease-in-out infinite; }
  .cfw-rating  { animation: ratingIn .3s cubic-bezier(.34,1.56,.64,1) both; }

  .cfw-msg-btn {
    padding:7px 15px; border-radius:20px; font-size:12px; font-weight:600;
    cursor:pointer; transition:all .18s; white-space:nowrap; border:none;
  }
  .cfw-msg-btn:hover { filter:brightness(1.08); transform:translateY(-1px); }

  .cfw-art-row { transition:background .15s, transform .15s; cursor:pointer; }
  .cfw-art-row:hover { background:#f8fafc; transform:translateX(2px); }

  .cfw-emoji-btn { background:none; border:none; font-size:19px; cursor:pointer; padding:3px; border-radius:7px; transition:background .12s, transform .12s; }
  .cfw-emoji-btn:hover { background:#f1f5f9; transform:scale(1.2); }

  .cfw-home-card {
    background:white; border-radius:16px; padding:15px 16px;
    box-shadow:0 2px 14px rgba(0,0,0,.07);
    cursor:pointer; transition:all .22s; border:1.5px solid transparent;
  }
  .cfw-home-card:hover {
    border-color:var(--cfw-color);
    transform:translateY(-2px);
    box-shadow:0 8px 28px rgba(0,0,0,.12);
  }

  .cfw-send-btn {
    border:none; cursor:pointer; display:flex; align-items:center;
    justify-content:center; transition:all .2s cubic-bezier(.34,1.56,.64,1);
  }
  .cfw-send-btn:not(:disabled):hover { transform:scale(1.12); filter:brightness(1.1); }
  .cfw-send-btn:disabled { cursor:default; }

  .cfw-input-wrap { transition:box-shadow .2s, border-color .2s; }
  .cfw-input-wrap:focus-within {
    border-color:var(--cfw-color) !important;
    box-shadow:0 0 0 3px color-mix(in srgb, var(--cfw-color) 15%, transparent);
  }
`

/* ─── Emojis & Content ─────────────────────────────────────────── */
const EMOJIS = ['😊','😂','❤️','👍','🙏','😍','🔥','✨','🎉','💯','👋','🤔','😮','💪','🚀','⭐']

const BOT_REPLIES = [
  "Thanks for reaching out! I'm looking into this for you right now.",
  "Got it! I can definitely help with that.",
  "Great question! Let me find the best answer for you.",
  "I understand. Could you share a bit more detail so I can assist better?",
  "Absolutely! Here's what you need to know about that.",
]

const QUICK_REPLIES_INIT = ['Tell me more', 'Pricing info', 'Talk to an agent']

const ARTICLES = [
  { icon:'🚀', title:'Getting started guide',          views:'2.1k', time:'2 min read' },
  { icon:'💳', title:'Billing & subscription FAQ',      views:'1.8k', time:'4 min read' },
  { icon:'🔧', title:'Troubleshooting common issues',   views:'3.4k', time:'6 min read' },
  { icon:'📱', title:'Mobile app setup guide',          views:'892',  time:'3 min read' },
  { icon:'🔗', title:'Integrations & API docs',         views:'1.2k', time:'8 min read' },
  { icon:'🔒', title:'Security & privacy overview',     views:'670',  time:'5 min read' },
]

/* ─── Sub-components ───────────────────────────────────────────── */
function Avatar({ initial='B', bg='#0066ff', size=32, ring=false }) {
  return (
    <div style={{
      width:size, height:size, borderRadius:'50%', background:bg,
      display:'flex', alignItems:'center', justifyContent:'center',
      color:'white', fontSize:Math.round(size*.38), fontWeight:800,
      flexShrink:0,
      ...(ring ? { border:'2.5px solid white', boxShadow:'0 2px 8px rgba(0,0,0,.18)' } : {}),
    }}>
      {initial}
    </div>
  )
}

function TypingDots() {
  return (
    <div style={{ display:'flex', alignItems:'center', gap:5, padding:'11px 15px', background:'white', borderRadius:'18px 18px 18px 4px', boxShadow:'0 2px 8px rgba(0,0,0,.07)', width:'fit-content' }}>
      {[0,1,2].map(i => (
        <span key={i} style={{
          width:7, height:7, borderRadius:'50%', background:'#94a3b8', display:'block',
          animation:`dotBounce 1.3s ease infinite`,
          animationDelay:`${i * 0.18}s`,
        }} />
      ))}
    </div>
  )
}

function QuickReplies({ options, onSelect, color }) {
  return (
    <div style={{ display:'flex', flexWrap:'wrap', gap:7, padding:'4px 14px 10px' }}>
      {options.map(o => (
        <button key={o} className="cfw-msg-btn" onClick={() => onSelect(o)}
          style={{ background:'white', color, border:`1.5px solid ${color}` }}
          onMouseEnter={e => { e.currentTarget.style.background=color; e.currentTarget.style.color='white' }}
          onMouseLeave={e => { e.currentTarget.style.background='white'; e.currentTarget.style.color=color }}>
          {o}
        </button>
      ))}
    </div>
  )
}

/* ─── Main Widget ──────────────────────────────────────────────── */
export default function WebChatWidget({
  config = {},
  previewOpen   = false,
  previewScreen = 'home',
  embed         = false,
}) {
  const {
    primaryColor   = '#0066ff',
    botName        = 'ChatFlow Bot',
    tagline        = 'Typically replies instantly',
    greeting       = 'Hi there 👋',
    greetingSub    = 'How can we help you today?',
    welcomeMessage = 'Hi there! 👋 How can I help you today?',
    launcherText   = 'Need help? Chat with us!',
    avatarInitial  = 'C',
    position       = 'right',
    size           = 'medium',
    showBranding   = true,
    gradient       = true,
    showArticles   = true,
    showRating     = true,
    soundEnabled   = false,
    launcherIcon   = 'chat',
  } = config

  const [open,       setOpen]       = useState(previewOpen)
  const [screen,     setScreen]     = useState(previewScreen)
  const [closing,    setClosing]    = useState(false)
  const [messages,   setMessages]   = useState([])
  const [typing,     setTyping]     = useState(false)
  const [input,      setInput]      = useState('')
  const [unread,     setUnread]     = useState(1)
  const [quickReps,  setQuickReps]  = useState([])
  const [chatReady,  setChatReady]  = useState(false)
  const [emojiOpen,  setEmojiOpen]  = useState(false)
  const [ratingGiven,setRatingGiven]= useState(null)
  const [searchQ,    setSearchQ]    = useState('')
  const [muted,      setMuted]      = useState(!soundEnabled)
  const [showRatingCard, setShowRatingCard] = useState(false)

  const msgsRef   = useRef(null)
  const inputRef  = useRef(null)
  const launcherSz = size === 'small' ? 48 : size === 'large' ? 64 : 56

  /* ── auto-scroll ── */
  useEffect(() => {
    if (msgsRef.current) msgsRef.current.scrollTop = msgsRef.current.scrollHeight
  }, [messages, typing, quickReps])

  /* ── sync preview props ── */
  useEffect(() => { setOpen(previewOpen)   }, [previewOpen])
  useEffect(() => { setScreen(previewScreen)}, [previewScreen])

  /* ── helpers ── */
  function ts() { return new Date().toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'}) }

  function openWidget() { setOpen(true); setUnread(0); setClosing(false) }
  function closeWidget() {
    setClosing(true)
    setTimeout(() => { setOpen(false); setClosing(false) }, 240)
  }
  function toggleWidget() { open ? closeWidget() : openWidget() }

  function goTo(s) { setScreen(s) }

  function startChat() {
    goTo('chat')
    if (chatReady) return
    setChatReady(true)
    setTyping(true)
    setTimeout(() => {
      setTyping(false)
      addBotMsg(welcomeMessage)
      setTimeout(() => setQuickReps(QUICK_REPLIES_INIT), 300)
    }, 1100)
  }

  function addBotMsg(text) {
    setMessages(p => [...p, { id: Date.now(), from:'bot', text, ts:ts() }])
  }

  function sendMsg(text) {
    if (!text?.trim()) return
    setMessages(p => [...p, { id: Date.now(), from:'user', text:text.trim(), ts:ts() }])
    setInput('')
    setQuickReps([])
    setEmojiOpen(false)
    setTyping(true)
    const delay = 1200 + Math.random() * 700
    setTimeout(() => {
      setTyping(false)
      addBotMsg(BOT_REPLIES[Math.floor(Math.random() * BOT_REPLIES.length)])
      if (showRating && messages.length > 4 && !showRatingCard) {
        setTimeout(() => setShowRatingCard(true), 600)
      }
    }, delay)
  }

  /* ── gradient / color calc ── */
  const col = primaryColor
  const headerBg = gradient
    ? `linear-gradient(135deg, ${col} 0%, ${col}bb 100%)`
    : col

  const posStyle = embed ? {} : {
    position: 'fixed',
    bottom: 24,
    [position === 'right' ? 'right' : 'left']: 24,
    zIndex: 2147483647,
    display: 'flex',
    flexDirection: 'column',
    alignItems: position === 'right' ? 'flex-end' : 'flex-start',
    gap: 12,
  }

  /* ─────────────────────────────────────────────────────── HOME ── */
  function HomeScreen() {
    return (
      <div className="cfw-screen" style={{ display:'flex', flexDirection:'column', height:'100%', overflow:'hidden' }}>

        {/* Header */}
        <div style={{ background: headerBg, padding:'24px 18px 50px', position:'relative', overflow:'hidden', flexShrink:0 }}>
          {/* BG decoration */}
          <div style={{ position:'absolute', top:-40, right:-40, width:140, height:140, borderRadius:'50%', background:'rgba(255,255,255,.07)', pointerEvents:'none' }} />
          <div style={{ position:'absolute', bottom:-30, left:-20, width:100, height:100, borderRadius:'50%', background:'rgba(255,255,255,.05)', pointerEvents:'none' }} />

          {/* Top bar */}
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:18 }}>
            {/* Stacked avatars */}
            <div style={{ display:'flex', alignItems:'center' }}>
              {[col, '#8B5CF6', '#10B981'].map((bg, i) => (
                <div key={i} style={{
                  width:30, height:30, borderRadius:'50%', background:bg,
                  border:'2px solid rgba(255,255,255,.7)',
                  marginLeft: i === 0 ? 0 : -9,
                  display:'flex', alignItems:'center', justifyContent:'center',
                  color:'white', fontSize:11, fontWeight:800, zIndex:3-i,
                  filter:'brightness(1.25)',
                }}>
                  {['C','A','B'][i]}
                </div>
              ))}
              <span style={{ fontSize:10, color:'rgba(255,255,255,.7)', marginLeft:10, fontWeight:600 }}>3 online</span>
            </div>

            <div style={{ display:'flex', gap:6 }}>
              <button onClick={() => setMuted(p=>!p)} style={{ background:'rgba(255,255,255,.15)', border:'none', borderRadius:8, width:28, height:28, display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer', color:'rgba(255,255,255,.8)', transition:'background .15s' }}
              onMouseEnter={e=>e.currentTarget.style.background='rgba(255,255,255,.25)'}
              onMouseLeave={e=>e.currentTarget.style.background='rgba(255,255,255,.15)'}>
                {muted ? <VolumeX size={13}/> : <Volume2 size={13}/>}
              </button>
              {!embed && (
                <button onClick={closeWidget} style={{ background:'rgba(255,255,255,.15)', border:'none', borderRadius:8, width:28, height:28, display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer', color:'rgba(255,255,255,.8)', transition:'background .15s' }}
                onMouseEnter={e=>e.currentTarget.style.background='rgba(255,255,255,.25)'}
                onMouseLeave={e=>e.currentTarget.style.background='rgba(255,255,255,.15)'}>
                  <X size={13}/>
                </button>
              )}
            </div>
          </div>

          <p style={{ margin:0, color:'white', fontSize:22, fontWeight:800, lineHeight:1.15 }}>{greeting}</p>
          <p style={{ margin:'6px 0 0', color:'rgba(255,255,255,.75)', fontSize:13, lineHeight:1.4 }}>{greetingSub}</p>
        </div>

        {/* Body */}
        <div style={{ flex:1, overflowY:'auto', padding:'16px 12px 12px', background:'#f1f5f9', marginTop:-28 }}>

          {/* Start conversation card */}
          <div className="cfw-home-card" style={{ '--cfw-color': col, marginBottom:10 }} onClick={startChat}>
            <div style={{ display:'flex', alignItems:'center', gap:12 }}>
              <div style={{ width:42, height:42, borderRadius:13, background:`${col}18`, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                <MessageCircle size={20} color={col} />
              </div>
              <div style={{ flex:1, minWidth:0 }}>
                <p style={{ margin:0, fontSize:13, fontWeight:700, color:'#0f172a' }}>Start a conversation</p>
                <div style={{ display:'flex', alignItems:'center', gap:5, marginTop:3 }}>
                  <span style={{ width:7, height:7, borderRadius:'50%', background:'#22c55e', display:'inline-block', flexShrink:0 }} />
                  <p style={{ margin:0, fontSize:11, color:'#64748b' }}>We typically reply in seconds</p>
                </div>
              </div>
              <ArrowRight size={16} color="#cbd5e1" />
            </div>
          </div>

          {/* Articles section */}
          {showArticles && (
            <div style={{ background:'white', borderRadius:16, boxShadow:'0 2px 12px rgba(0,0,0,.07)', overflow:'hidden' }}>
              {/* Section header */}
              <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'13px 16px 8px' }}>
                <p style={{ margin:0, fontSize:10, fontWeight:800, color:'#94a3b8', textTransform:'uppercase', letterSpacing:.7 }}>Help Center</p>
                <button onClick={() => goTo('articles')} style={{ background:'none', border:'none', fontSize:11, color:col, fontWeight:700, cursor:'pointer', padding:0 }}>See all →</button>
              </div>

              {/* Search */}
              <div style={{ padding:'0 12px 8px' }}>
                <div style={{ position:'relative' }}>
                  <Search size={12} style={{ position:'absolute', left:10, top:'50%', transform:'translateY(-50%)', color:'#94a3b8', pointerEvents:'none' }} />
                  <input value={searchQ} onChange={e=>setSearchQ(e.target.value)}
                    placeholder="Search articles…"
                    style={{ width:'100%', padding:'8px 10px 8px 28px', border:'1.5px solid #e2e8f0', borderRadius:10, fontSize:12, outline:'none', background:'#f8fafc', boxSizing:'border-box', color:'#334155' }}
                    onFocus={e=>e.target.style.borderColor=col} onBlur={e=>e.target.style.borderColor='#e2e8f0'}
                  />
                </div>
              </div>

              {/* Article rows */}
              {ARTICLES.filter(a => !searchQ || a.title.toLowerCase().includes(searchQ.toLowerCase())).slice(0,3).map((a,i) => (
                <div key={i} className="cfw-art-row" style={{ display:'flex', alignItems:'center', gap:11, padding:'10px 16px', borderTop:'1px solid #f1f5f9' }}>
                  <span style={{ fontSize:20, flexShrink:0 }}>{a.icon}</span>
                  <div style={{ flex:1, minWidth:0 }}>
                    <p style={{ margin:0, fontSize:12, fontWeight:600, color:'#334155', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{a.title}</p>
                    <p style={{ margin:'1px 0 0', fontSize:10, color:'#94a3b8' }}>{a.time} · {a.views} views</p>
                  </div>
                  <ArrowRight size={12} color="#cbd5e1" style={{ flexShrink:0 }} />
                </div>
              ))}
            </div>
          )}
        </div>

        {showBranding && (
          <div style={{ padding:'8px', textAlign:'center', background:'white', borderTop:'1px solid #f1f5f9', flexShrink:0 }}>
            <p style={{ margin:0, fontSize:9, color:'#cbd5e1', fontWeight:600 }}>
              Powered by <span style={{ color:'#94a3b8' }}>ChatFlow</span> ⚡
            </p>
          </div>
        )}
      </div>
    )
  }

  /* ─────────────────────────────────────────────────── ARTICLES ── */
  function ArticlesScreen() {
    const [q, setQ] = useState('')
    const filtered = ARTICLES.filter(a => !q || a.title.toLowerCase().includes(q.toLowerCase()))
    return (
      <div className="cfw-screen" style={{ display:'flex', flexDirection:'column', height:'100%' }}>
        <div style={{ background:headerBg, padding:'14px 14px', display:'flex', alignItems:'center', gap:10, flexShrink:0 }}>
          <button onClick={()=>goTo('home')} style={{ background:'rgba(255,255,255,.2)', border:'none', borderRadius:9, width:30, height:30, display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer', color:'white', flexShrink:0, transition:'background .15s' }}
          onMouseEnter={e=>e.currentTarget.style.background='rgba(255,255,255,.3)'}
          onMouseLeave={e=>e.currentTarget.style.background='rgba(255,255,255,.2)'}>
            <ChevronLeft size={15}/>
          </button>
          <div style={{ flex:1 }}>
            <p style={{ margin:0, color:'white', fontWeight:800, fontSize:14 }}>Help Center</p>
            <p style={{ margin:0, color:'rgba(255,255,255,.65)', fontSize:10 }}>{ARTICLES.length} articles</p>
          </div>
          {!embed && (
            <button onClick={closeWidget} style={{ background:'rgba(255,255,255,.2)', border:'none', borderRadius:9, width:30, height:30, display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer', color:'white', flexShrink:0 }}>
              <X size={13}/>
            </button>
          )}
        </div>

        <div style={{ flex:1, overflowY:'auto', padding:'12px', background:'#f1f5f9' }}>
          <div style={{ position:'relative', marginBottom:10 }}>
            <Search size={13} style={{ position:'absolute', left:12, top:'50%', transform:'translateY(-50%)', color:'#94a3b8', pointerEvents:'none' }} />
            <input value={q} onChange={e=>setQ(e.target.value)} placeholder="Search help articles…"
              style={{ width:'100%', padding:'10px 12px 10px 34px', border:'1.5px solid #e2e8f0', borderRadius:12, fontSize:12, outline:'none', background:'white', boxSizing:'border-box', color:'#334155' }}
              onFocus={e=>e.target.style.borderColor=col} onBlur={e=>e.target.style.borderColor='#e2e8f0'}
            />
          </div>

          <div style={{ background:'white', borderRadius:14, boxShadow:'0 2px 10px rgba(0,0,0,.07)', overflow:'hidden' }}>
            {filtered.length === 0 ? (
              <div style={{ padding:'32px 20px', textAlign:'center' }}>
                <p style={{ margin:0, fontSize:13, color:'#94a3b8' }}>No articles found</p>
              </div>
            ) : filtered.map((a,i) => (
              <div key={i} className="cfw-art-row" style={{ display:'flex', alignItems:'center', gap:12, padding:'14px 16px', borderTop:i?'1px solid #f1f5f9':'none' }}>
                <div style={{ width:40, height:40, borderRadius:11, background:'#f1f5f9', display:'flex', alignItems:'center', justifyContent:'center', fontSize:20, flexShrink:0 }}>{a.icon}</div>
                <div style={{ flex:1, minWidth:0 }}>
                  <p style={{ margin:0, fontSize:12, fontWeight:600, color:'#334155' }}>{a.title}</p>
                  <p style={{ margin:'3px 0 0', fontSize:10, color:'#94a3b8' }}>{a.time} · {a.views} views</p>
                </div>
                <ArrowRight size={13} color="#cbd5e1" style={{ flexShrink:0 }}/>
              </div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  /* ──────────────────────────────────────────────────────── CHAT ── */
  function ChatScreen() {
    return (
      <div className="cfw-screen" style={{ display:'flex', flexDirection:'column', height:'100%' }}>

        {/* Chat Header */}
        <div style={{ background:headerBg, padding:'12px 14px', display:'flex', alignItems:'center', gap:10, flexShrink:0 }}>
          <button onClick={()=>goTo('home')} style={{ background:'rgba(255,255,255,.2)', border:'none', borderRadius:9, width:30, height:30, display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer', color:'white', flexShrink:0, transition:'background .15s' }}
          onMouseEnter={e=>e.currentTarget.style.background='rgba(255,255,255,.3)'}
          onMouseLeave={e=>e.currentTarget.style.background='rgba(255,255,255,.2)'}>
            <ChevronLeft size={15}/>
          </button>

          <Avatar initial={avatarInitial} bg={primaryColor} size={36} ring />

          <div style={{ flex:1, minWidth:0 }}>
            <p style={{ margin:0, color:'white', fontWeight:800, fontSize:13, lineHeight:1.2 }}>{botName}</p>
            <div style={{ display:'flex', alignItems:'center', gap:5, marginTop:2 }}>
              <span style={{ width:7, height:7, borderRadius:'50%', background:'#4ade80', display:'inline-block', flexShrink:0, boxShadow:'0 0 6px #4ade80' }} />
              <p style={{ margin:0, color:'rgba(255,255,255,.7)', fontSize:10 }}>{tagline}</p>
            </div>
          </div>

          {!embed && (
            <button onClick={closeWidget} style={{ background:'rgba(255,255,255,.2)', border:'none', borderRadius:9, width:30, height:30, display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer', color:'white', flexShrink:0, transition:'background .15s' }}
            onMouseEnter={e=>e.currentTarget.style.background='rgba(255,255,255,.3)'}
            onMouseLeave={e=>e.currentTarget.style.background='rgba(255,255,255,.2)'}>
              <X size={13}/>
            </button>
          )}
        </div>

        {/* Messages */}
        <div ref={msgsRef} style={{ flex:1, overflowY:'auto', padding:'14px 12px', background:'#f8fafc', display:'flex', flexDirection:'column', gap:10, scrollBehavior:'smooth' }}>

          {/* Date pill */}
          <div style={{ textAlign:'center', flexShrink:0 }}>
            <span style={{ fontSize:10, color:'#94a3b8', background:'#e2e8f0', padding:'3px 12px', borderRadius:20, fontWeight:700 }}>Today</span>
          </div>

          {/* Message list */}
          {messages.map((m, idx) => (
            <div key={m.id} className="cfw-msg" style={{ animationDelay:`${idx * .03}s` }}>
              {m.from === 'bot' ? (
                <div style={{ display:'flex', alignItems:'flex-end', gap:8 }}>
                  <Avatar initial={avatarInitial} bg={primaryColor} size={28} ring />
                  <div>
                    <div style={{
                      background:'white', padding:'10px 14px',
                      borderRadius:'18px 18px 18px 5px',
                      fontSize:13, color:'#1e293b', lineHeight:1.55,
                      boxShadow:'0 2px 8px rgba(0,0,0,.07)',
                      maxWidth:230, wordBreak:'break-word',
                    }}>
                      {m.text}
                    </div>
                    <p style={{ margin:'4px 0 0 4px', fontSize:9, color:'#94a3b8', fontWeight:500 }}>{m.ts}</p>
                  </div>
                </div>
              ) : (
                <div style={{ display:'flex', justifyContent:'flex-end' }}>
                  <div>
                    <div style={{
                      background: primaryColor,
                      padding:'10px 14px',
                      borderRadius:'18px 18px 5px 18px',
                      fontSize:13, color:'white', lineHeight:1.55,
                      maxWidth:230, wordBreak:'break-word',
                      boxShadow:`0 4px 14px ${primaryColor}44`,
                    }}>
                      {m.text}
                    </div>
                    <div style={{ display:'flex', alignItems:'center', justifyContent:'flex-end', gap:4, marginTop:4 }}>
                      <p style={{ margin:0, fontSize:9, color:'#94a3b8', fontWeight:500 }}>{m.ts}</p>
                      <CheckCheck size={11} color={primaryColor} />
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))}

          {/* Typing */}
          {typing && (
            <div className="cfw-msg" style={{ display:'flex', alignItems:'flex-end', gap:8 }}>
              <Avatar initial={avatarInitial} bg={primaryColor} size={28} ring />
              <TypingDots />
            </div>
          )}

          {/* Rating card */}
          {showRatingCard && !ratingGiven && (
            <div className="cfw-rating" style={{ background:'white', borderRadius:16, padding:'16px', boxShadow:'0 4px 20px rgba(0,0,0,.1)', border:`1.5px solid ${primaryColor}22` }}>
              <p style={{ margin:'0 0 12px', fontSize:12, fontWeight:700, color:'#334155', textAlign:'center' }}>Was this helpful? 💬</p>
              <div style={{ display:'flex', justifyContent:'center', gap:10 }}>
                {['😞','😕','😐','😊','🤩'].map((e,i) => (
                  <button key={i} onClick={()=>setRatingGiven(i+1)}
                    style={{ width:38, height:38, borderRadius:'50%', border:'1.5px solid #e2e8f0', background:'white', fontSize:20, cursor:'pointer', transition:'all .2s cubic-bezier(.34,1.56,.64,1)' }}
                    onMouseEnter={ev=>{ ev.currentTarget.style.transform='scale(1.3)'; ev.currentTarget.style.borderColor=primaryColor; ev.currentTarget.style.boxShadow=`0 4px 12px ${primaryColor}33` }}
                    onMouseLeave={ev=>{ ev.currentTarget.style.transform=''; ev.currentTarget.style.borderColor='#e2e8f0'; ev.currentTarget.style.boxShadow='' }}>
                    {e}
                  </button>
                ))}
              </div>
            </div>
          )}

          {ratingGiven && (
            <div className="cfw-msg" style={{ textAlign:'center', padding:'12px', background:'white', borderRadius:14, boxShadow:'0 2px 8px rgba(0,0,0,.06)' }}>
              <p style={{ margin:0, fontSize:13 }}>Thanks for your feedback! 🎉</p>
              <p style={{ margin:'4px 0 0', fontSize:11, color:'#64748b' }}>We're always improving.</p>
            </div>
          )}
        </div>

        {/* Quick replies */}
        {quickReps.length > 0 && (
          <div className="cfw-msg" style={{ background:'white', borderTop:'1px solid #f1f5f9', paddingTop:8, flexShrink:0 }}>
            <QuickReplies options={quickReps} onSelect={sendMsg} color={primaryColor} />
          </div>
        )}

        {/* Emoji picker */}
        {emojiOpen && (
          <div style={{ background:'white', borderTop:'1px solid #f1f5f9', padding:'8px 12px 4px', display:'flex', flexWrap:'wrap', gap:2, flexShrink:0 }}>
            {EMOJIS.map(e => (
              <button key={e} className="cfw-emoji-btn" onClick={()=>setInput(p=>p+e)}>{e}</button>
            ))}
          </div>
        )}

        {/* Input area */}
        <div style={{ padding:'10px 12px 12px', background:'white', borderTop:'1px solid #f1f5f9', flexShrink:0 }}>
          <div className="cfw-input-wrap" style={{
            display:'flex', alignItems:'flex-end', gap:8,
            background:'#f8fafc', border:'1.5px solid #e2e8f0',
            borderRadius:18, padding:'8px 10px',
            '--cfw-color': primaryColor,
          }}>
            <button onClick={()=>setEmojiOpen(p=>!p)} style={{ background:'none', border:'none', cursor:'pointer', color: emojiOpen ? primaryColor : '#94a3b8', padding:'2px', flexShrink:0, display:'flex', transition:'color .15s, transform .15s', transform: emojiOpen ? 'scale(1.1)' : 'scale(1)' }}>
              <Smile size={19} />
            </button>
            <textarea
              ref={inputRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => { if (e.key==='Enter' && !e.shiftKey) { e.preventDefault(); sendMsg(input) } }}
              placeholder="Type a message…"
              rows={1}
              style={{
                flex:1, border:'none', background:'transparent', resize:'none',
                outline:'none', fontSize:13, lineHeight:1.5, maxHeight:80,
                overflowY:'auto', fontFamily:'inherit', color:'#1e293b',
                padding:0, margin:'2px 0',
              }}
            />
            <button
              className="cfw-send-btn"
              onClick={() => sendMsg(input)}
              disabled={!input.trim()}
              style={{
                width:32, height:32, borderRadius:'50%',
                background: input.trim() ? primaryColor : '#e2e8f0',
                color: input.trim() ? 'white' : '#94a3b8',
                boxShadow: input.trim() ? `0 4px 12px ${primaryColor}44` : 'none',
                flexShrink:0,
              }}>
              <Send size={14} />
            </button>
          </div>

          {showBranding && (
            <p style={{ margin:'6px 0 0', textAlign:'center', fontSize:9, color:'#cbd5e1', fontWeight:600 }}>
              Powered by <span style={{ color:'#94a3b8' }}>ChatFlow</span> ⚡
            </p>
          )}
        </div>
      </div>
    )
  }

  /* ──────────────────────────────────────────── EMBEDDED (preview) */
  if (embed) {
    return (
      <div style={{ width:'100%', height:'100%', display:'flex', flexDirection:'column', overflow:'hidden' }}>
        <style>{WIDGET_CSS}</style>
        {screen === 'home'     && <HomeScreen />}
        {screen === 'chat'     && <ChatScreen />}
        {screen === 'articles' && <ArticlesScreen />}
      </div>
    )
  }

  /* ──────────────────────────────────────────── FLOATING (live embed) */
  return (
    <div style={posStyle}>
      <style>{WIDGET_CSS}</style>

      {/* Widget window */}
      {open && (
        <div className={closing ? 'cfw-closing' : 'cfw-window'} style={{
          width: 360, height: 580,
          borderRadius: 22,
          overflow: 'hidden',
          boxShadow: '0 32px 72px rgba(0,0,0,.22), 0 8px 24px rgba(0,0,0,.1)',
          background: 'white',
          display: 'flex',
          flexDirection: 'column',
          marginBottom: 14,
          border: '1px solid rgba(0,0,0,.07)',
        }}>
          {screen === 'home'     && <HomeScreen />}
          {screen === 'chat'     && <ChatScreen />}
          {screen === 'articles' && <ArticlesScreen />}
        </div>
      )}

      {/* Launcher */}
      <div style={{ display:'flex', flexDirection: position==='right' ? 'row-reverse' : 'row', alignItems:'center', gap:12 }}>

        {/* Tooltip */}
        {!open && launcherText && (
          <div style={{
            background:'white', borderRadius:14, padding:'9px 15px',
            boxShadow:'0 6px 24px rgba(0,0,0,.14)',
            fontSize:13, fontWeight:600, color:'#1e293b',
            animation:'tooltipIn .3s ease both',
            maxWidth:200, lineHeight:1.4, position:'relative',
            whiteSpace:'nowrap',
          }}>
            {launcherText}
          </div>
        )}

        {/* Button + rings */}
        <div style={{ position:'relative' }} className={open ? '' : 'cfw-launch'}>
          {/* Pulse rings when unread */}
          {!open && unread > 0 && (
            <>
              <div style={{ position:'absolute', inset:0, borderRadius:'50%', background:primaryColor, animation:'pulseRing 2s ease-out infinite', zIndex:-1 }} />
              <div style={{ position:'absolute', inset:0, borderRadius:'50%', background:primaryColor, animation:'pulseRing 2s ease-out infinite .6s', zIndex:-1 }} />
            </>
          )}

          {/* Unread badge */}
          {!open && unread > 0 && (
            <div style={{
              position:'absolute', top:-4, right:-4,
              width:20, height:20, borderRadius:'50%',
              background:'#ef4444', color:'white',
              fontSize:10, fontWeight:800,
              display:'flex', alignItems:'center', justifyContent:'center',
              border:'2px solid white', zIndex:2,
              animation:'badgePop .4s cubic-bezier(.34,1.56,.64,1) both',
            }}>
              {unread}
            </div>
          )}

          <button onClick={toggleWidget} style={{
            width: launcherSz, height: launcherSz,
            borderRadius:'50%', border:'none',
            background: open ? '#0f172a' : primaryColor,
            color:'white', cursor:'pointer',
            boxShadow: `0 8px 28px ${primaryColor}55, 0 2px 8px rgba(0,0,0,.18)`,
            display:'flex', alignItems:'center', justifyContent:'center',
            transition:'all .3s cubic-bezier(.34,1.56,.64,1)',
          }}>
            <div style={{ transition:'transform .3s cubic-bezier(.34,1.56,.64,1)', transform: open ? 'rotate(90deg) scale(.9)' : 'rotate(0) scale(1)' }}>
              {open ? <X size={Math.round(launcherSz*.42)} /> : <MessageCircle size={Math.round(launcherSz*.44)} />}
            </div>
          </button>
        </div>
      </div>
    </div>
  )
}
