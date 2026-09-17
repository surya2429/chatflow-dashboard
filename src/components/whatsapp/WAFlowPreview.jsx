// WAFlowPreview.jsx — run a WhatsApp flow inside a phone, from the builder.
//
// The WhatsApp builder could draw a flow but never play one: the only preview
// was a single static bubble inside one node's editor (WAPreview in
// FlowSetup.jsx), which shows what one message looks like and nothing about
// whether the flow actually works. This is the counterpart of the Website Chat
// builder's canvas simulator — the same idea, but WhatsApp's node catalog and
// WhatsApp's chrome.
//
// It runs the graph the canvas is holding, including unsaved edits, so the
// thing being tested is what is on screen rather than what was last saved.
import { useState, useEffect, useRef, useCallback } from 'react'
import clsx from 'clsx'
import {
  X, RotateCcw, Send, Paperclip, MapPin, Calendar, CreditCard,
  Check, CheckCheck, Phone, Video, ArrowLeft, List as ListIcon,
} from 'lucide-react'

/* WhatsApp's own palette. Hard-coded rather than themed: the entire point of
   this preview is to show the merchant their flow in WhatsApp's skin, so it
   should not follow the dashboard's theme. */
const WA = {
  header:   '#075E54',
  wallpaper:'#E5DDD5',
  outgoing: '#DCF8C6',
  incoming: '#FFFFFF',
  accent:   '#25D366',
  link:     '#027EB5',
}

/* Nodes that say something to the visitor, and nodes that merely happen.
   Assigning a conversation or calling an API is real flow progress but is not
   a chat message — showing those as bubbles would teach the merchant that
   their customer sees them, which is the opposite of true. They render as a
   thin system line instead. */
const SILENT_TYPES = new Set([
  'assign', 'unassign', 'resolve', 'update_conv', 'update_contact', 'update_company',
  'push_seq', 'add_note', 'set_var', 'jump', 'condition', 'switch_node',
  'working_hours', 'wait_order', 'sheets', 'api', 'razorpay', 'zoho_crm',
  'shopify', 'hubspot', 'delay', 'hint', 'gpt_kb',
])

/* Ask nodes whose reply is a tap on something, not typed text. Each gets its
   own composer affordance below so the merchant sees the shape of the answer
   WhatsApp will actually collect. */
const TAP_ANSWER = {
  ask_location:    { icon: MapPin,     label: 'Send location',        reply: '📍 Location shared' },
  ask_file:        { icon: Paperclip,  label: 'Attach file',          reply: '📎 invoice.pdf' },
  ask_date:        { icon: Calendar,   label: 'Pick a date',          reply: '24/09/2026' },
  ask_appointment: { icon: Calendar,   label: 'Choose a slot',        reply: '24 Sep, 10:00 AM' },
  ask_appointment_off: { icon: Calendar, label: 'Choose a slot',      reply: '25 Sep, 11:30 AM' },
  ask_payment:     { icon: CreditCard, label: 'Pay now',              reply: '✅ Payment successful' },
  ask_collection:  { icon: ListIcon,   label: 'Open catalogue',       reply: '🛒 2 items selected' },
  ask_form:        { icon: ListIcon,   label: 'Open form',            reply: '📝 Form submitted' },
}

/* Sample values for the {{variables}} a real conversation would already hold.
   Without these the preview shows raw handlebars, and the merchant cannot see
   whether their copy reads correctly once filled in — which is most of what a
   preview is for. */
const SAMPLE_VARS = {
  'recipient.name': 'Arjun',
  'recipient.phone': '+91 98765 43210',
  'intent.text': 'hi',
}

function interpolate(text, vars) {
  if (!text) return ''
  return String(text).replace(/\{\{\s*([^}]+?)\s*\}\}/g, (full, key) => {
    const k = key.trim()
    if (vars[k] != null && vars[k] !== '') return vars[k]
    if (SAMPLE_VARS[k] != null) return SAMPLE_VARS[k]
    // Unfilled and unknown: show the bare name rather than the braces, so the
    // sentence still reads as a sentence.
    return k.split('.').pop().replace(/_/g, ' ')
  })
}

/* `saveAs` is written as `{{weight_kg}}` in the editors, but the variable it
   defines is `weight_kg`. Strip the braces so later messages referencing it
   actually resolve. */
const varName = saveAs => String(saveAs || '').replace(/[{}]/g, '').trim()

const now = () => new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })

/* What the bot actually says at an Ask node. Most types carry `question`, but
   a few describe themselves differently — a payment node has an amount and a
   description and no question at all, which rendered as an empty bubble until
   this existed. An empty bubble in a preview reads as a bug in the preview
   rather than as a gap in the node's own copy, which is the wrong lesson. */
function promptFor(node) {
  const d = node.data || {}
  if (d.question) return d.question
  if (node.type === 'ask_payment') {
    const amount = d.amount ? `${d.currency || 'INR'} ${d.amount}` : 'the amount due'
    return d.description ? `${d.description}\n\nAmount: ${amount}` : `Please pay ${amount} to confirm.`
  }
  if (node.type === 'ask_form') return d.title || 'Please fill in the form below.'
  if (node.type === 'ask_collection') return 'Browse the catalogue and pick what you need.'
  return d.title || d.headerText || ''
}

/**
 * Walks a {nodes, edges} graph the way WhatsApp would deliver it.
 *
 * Deliberately a separate engine from the Website Chat simulator rather than a
 * shared one: the two catalogs disagree on node type names, port semantics and
 * data fields, so a shared engine would be a pile of per-channel branches
 * pretending to be common code. What IS shared is the graph shape, which is
 * why this needs nothing but nodes and edges.
 */
export function useWAFlowSimulation(nodes, edges) {
  const [messages, setMessages] = useState([])
  const [awaiting, setAwaiting] = useState(null)   // the ask node blocking progress
  const [ended, setEnded] = useState(false)
  const [typing, setTyping] = useState(false)
  const [currentId, setCurrentId] = useState(null)
  const varsRef = useRef({})
  const midRef = useRef(0)
  const timerRef = useRef(null)

  const push = useCallback((msg) => {
    setMessages(m => [...m, { id: `m${++midRef.current}`, time: now(), ...msg }])
  }, [])

  const entryId = useCallback(() => {
    const start = nodes.find(n => n.type === 'start')
    return (start || nodes[0])?.id ?? null
  }, [nodes])

  const reset = useCallback(() => {
    clearTimeout(timerRef.current)
    varsRef.current = {}
    midRef.current = 0
    setMessages([])
    setAwaiting(null)
    setEnded(false)
    setTyping(false)
    setCurrentId(entryId())
  }, [entryId])

  // Start on mount, and restart if the flow being previewed changes.
  useEffect(() => { reset() }, [reset])

  const nextFrom = useCallback((nodeId, port) => {
    const edge = edges.find(e => e.fromId === nodeId && (e.fromPort ?? 0) === port)
    return edge ? edge.toId : null
  }, [edges])

  /* Advance one node. Bot messages are delivered behind a short typing
     indicator, because a flow that dumps six bubbles at once reads as fine in
     a preview and as spam on a real phone — the pause is part of what the
     merchant is meant to be judging. */
  useEffect(() => {
    if (!currentId || ended) return undefined
    const node = nodes.find(n => n.id === currentId)
    if (!node) { setEnded(true); return undefined }
    const d = node.data || {}
    const vars = varsRef.current

    const go = (port = 0) => {
      const to = nextFrom(node.id, port)
      if (to) setCurrentId(to)
      else { setEnded(true); setCurrentId(null) }
    }

    const speak = (body, extra = {}) => {
      setTyping(true)
      timerRef.current = setTimeout(() => {
        setTyping(false)
        push({ from: 'bot', text: interpolate(body, vars), ...extra })
        extra.thenWait ? setAwaiting(node) : go(0)
      }, 420)
    }

    switch (node.type) {
      case 'start':
        go(0)
        break

      case 'end':
        setTyping(true)
        timerRef.current = setTimeout(() => {
          setTyping(false)
          if (d.endMessage) push({ from: 'bot', text: interpolate(d.endMessage, vars) })
          setEnded(true)
          setCurrentId(null)
        }, 420)
        break

      case 'text':
        speak(d.message || '(empty message)')
        break

      case 'media':
        speak(d.caption || '', { media: d.mediaType || 'image' })
        break

      case 'template':
        speak(d.templateName ? `[Template: ${d.templateName}]` : '[Template message]')
        break

      case 'send_voice':
        speak('', { voice: true })
        break

      case 'catalog':
        speak(d.message || 'Browse our catalogue', { catalog: true })
        break

      /* Interactive sends wait for a tap even though they are "send" nodes —
         that is what makes them interactive, and each button is a port. */
      case 'send_buttons':
      case 'send_list':
      case 'ask_button':
      case 'ask_list':
      case 'ask_keyword':
        setTyping(true)
        timerRef.current = setTimeout(() => {
          setTyping(false)
          push({
            from: 'bot',
            text: interpolate(promptFor(node) || d.message || '', vars),
            footer: d.footerText ? interpolate(d.footerText, vars) : null,
          })
          setAwaiting(node)
        }, 420)
        break

      default:
        if (SILENT_TYPES.has(node.type)) {
          // Not a message: record it as flow activity and keep moving.
          push({ system: true, text: `${d.name || node.type} ran` })
          go(0)
        } else if (node.type.startsWith('ask_')) {
          setTyping(true)
          timerRef.current = setTimeout(() => {
            setTyping(false)
            push({ from: 'bot', text: interpolate(promptFor(node), vars) })
            setAwaiting(node)
          }, 420)
        } else {
          go(0)
        }
        break
    }

    return () => clearTimeout(timerRef.current)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentId, ended, nodes, nextFrom, push])

  /* The visitor answers. `port` matters for the branching types — a tap on the
     second button must follow the second port, not just "onwards". */
  const answer = useCallback((displayText, { port = 0, saveAs, value } = {}) => {
    if (!awaiting) return
    const name = varName(saveAs ?? awaiting.data?.saveAs)
    if (name) varsRef.current[name] = value ?? displayText
    push({ from: 'user', text: displayText })
    setAwaiting(null)
    const to = nextFrom(awaiting.id, port)
    if (to) setCurrentId(to)
    else { setEnded(true); setCurrentId(null) }
  }, [awaiting, nextFrom, push])

  useEffect(() => () => clearTimeout(timerRef.current), [])

  return { messages, awaiting, ended, typing, reset, answer }
}

/* ─── UI ──────────────────────────────────────────────────────────────── */

function Bubble({ m }) {
  if (m.system) {
    return (
      <div className="flex justify-center my-1.5">
        <span className="text-[10px] text-slate-600 bg-white/70 rounded-full px-2.5 py-1 shadow-sm">
          ⚙ {m.text}
        </span>
      </div>
    )
  }
  const mine = m.from === 'user'
  return (
    <div className={clsx('flex mb-1.5', mine ? 'justify-end' : 'justify-start')}>
      <div className="max-w-[78%] rounded-lg px-2.5 py-1.5 shadow-sm relative"
        style={{ background: mine ? WA.outgoing : WA.incoming,
          borderTopRightRadius: mine ? 3 : 8, borderTopLeftRadius: mine ? 8 : 3 }}>
        {m.media && (
          <div className="h-20 rounded mb-1 bg-slate-200 flex items-center justify-center text-[10px] text-slate-500">
            {m.media}
          </div>
        )}
        {m.voice && (
          <div className="flex items-center gap-2 py-0.5 w-40">
            <span className="w-6 h-6 rounded-full flex items-center justify-center text-white text-[10px]"
              style={{ background: WA.accent }}>▶</span>
            <div className="flex-1 h-1 rounded bg-slate-300"/>
            <span className="text-[9px] text-slate-500">0:07</span>
          </div>
        )}
        {m.catalog && (
          <div className="h-16 rounded mb-1 bg-slate-100 border border-slate-200 flex items-center justify-center text-[10px] text-slate-500">
            🛍 Catalogue
          </div>
        )}
        {m.text && (
          <p className="text-[12.5px] text-slate-800 leading-snug whitespace-pre-wrap break-words">{m.text}</p>
        )}
        {m.footer && <p className="text-[10px] text-slate-400 mt-1">{m.footer}</p>}
        <div className="flex items-center justify-end gap-1 mt-0.5">
          <span className="text-[9px] text-slate-400">{m.time}</span>
          {mine && <CheckCheck size={11} className="text-[#53bdeb]"/>}
        </div>
      </div>
    </div>
  )
}

/* The reply affordance for whichever node is waiting. WhatsApp shows a very
   different control per interactive type, and collapsing them all to a text
   box would hide the thing most worth checking — whether the merchant picked
   the right question type for the answer they want. */
function Composer({ awaiting, ended, onAnswer, onRestart }) {
  const [draft, setDraft] = useState('')
  useEffect(() => { setDraft('') }, [awaiting?.id])

  if (ended) {
    return (
      <div className="px-3 py-2.5 bg-white border-t border-slate-200 text-center">
        <p className="text-[11px] text-slate-500 mb-1.5">This conversation has ended</p>
        <button onClick={onRestart}
          className="inline-flex items-center gap-1.5 text-[11px] font-semibold px-3 py-1.5 rounded-full text-white"
          style={{ background: WA.accent }}>
          <RotateCcw size={11}/> Start again
        </button>
      </div>
    )
  }

  if (!awaiting) {
    return (
      <div className="px-3 py-3 bg-white border-t border-slate-200">
        <p className="text-[11px] text-slate-400 text-center">Bot is working…</p>
      </div>
    )
  }

  const d = awaiting.data || {}

  // Branching types: one tap per port.
  const options =
      awaiting.type === 'ask_button' || awaiting.type === 'send_buttons'
        ? (d.buttons || []).map((b, i) => ({ label: b.label || `Option ${i + 1}`, value: b.value, port: i }))
    : awaiting.type === 'ask_list' || awaiting.type === 'send_list'
        ? (d.sections || []).flatMap(s => s.items || []).slice(0, 10)
            .map((it, i) => ({ label: it.title || `Item ${i + 1}`, value: it.value, port: i, desc: it.description }))
    : awaiting.type === 'ask_keyword'
        ? (d.keywords || []).map((k, i) => ({ label: k.label || k.value || `Keyword ${i + 1}`, value: k.value, port: i }))
    : null

  if (options && options.length) {
    return (
      <div className="px-3 py-2.5 bg-white border-t border-slate-200 space-y-1.5 max-h-44 overflow-y-auto">
        {d.buttonLabel && <p className="text-[10px] text-slate-400 text-center">{d.buttonLabel}</p>}
        {options.map(o => (
          <button key={o.port} onClick={() => onAnswer(o.label, { port: o.port, value: o.value })}
            className="w-full rounded-lg border px-3 py-2 text-left hover:bg-slate-50 transition-colors"
            style={{ borderColor: WA.accent }}>
            <span className="text-[12px] font-semibold" style={{ color: WA.header }}>{o.label}</span>
            {o.desc && <span className="block text-[10px] text-slate-400 mt-0.5">{o.desc}</span>}
          </button>
        ))}
      </div>
    )
  }

  const tap = TAP_ANSWER[awaiting.type]
  if (tap) {
    const Icon = tap.icon
    return (
      <div className="px-3 py-2.5 bg-white border-t border-slate-200">
        <button onClick={() => onAnswer(tap.reply)}
          className="w-full flex items-center justify-center gap-2 rounded-full py-2.5 text-white text-[12px] font-semibold"
          style={{ background: WA.accent }}>
          <Icon size={14}/> {tap.label}
        </button>
      </div>
    )
  }

  // Everything else is typed: text, number, phone, email, url.
  const placeholder =
      awaiting.type === 'ask_number' ? 'Type a number…'
    : awaiting.type === 'ask_email'  ? 'you@example.com'
    : awaiting.type === 'ask_phone'  ? '+91 98765 43210'
    : awaiting.type === 'ask_url'    ? 'https://…'
    : 'Type a message'

  const send = () => {
    const v = draft.trim()
    if (!v) return
    onAnswer(v)
    setDraft('')
  }

  return (
    <div className="px-2 py-2 bg-white border-t border-slate-200 flex items-center gap-1.5">
      <div className="flex-1 flex items-center gap-1.5 bg-slate-100 rounded-full px-3 py-2">
        <input value={draft} onChange={e => setDraft(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') send() }}
          placeholder={placeholder}
          inputMode={awaiting.type === 'ask_number' ? 'numeric' : undefined}
          className="flex-1 bg-transparent text-[12.5px] text-slate-800 placeholder-slate-400 focus:outline-none min-w-0"/>
      </div>
      <button onClick={send} disabled={!draft.trim()}
        className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 disabled:opacity-40 transition-opacity"
        style={{ background: WA.accent }}>
        <Send size={15} className="text-white" style={{ marginLeft: 1 }}/>
      </button>
    </div>
  )
}

/**
 * The docked phone. Rendered beside the canvas rather than over it, so the
 * merchant can watch which node they are on while they answer.
 */
export default function WAFlowPreview({ nodes, edges, flowName, onClose }) {
  const { messages, awaiting, ended, typing, reset, answer } = useWAFlowSimulation(nodes, edges)
  const listRef = useRef(null)

  // Follow the conversation as it grows, the way a real chat does.
  useEffect(() => {
    const el = listRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [messages, typing])

  return (
    <div className="fixed right-5 bottom-5 z-40 flex flex-col rounded-2xl overflow-hidden shadow-2xl border border-slate-300 bg-white"
      style={{ width: 340, height: 'min(620px, calc(100vh - 40px))' }}>

      {/* WhatsApp header */}
      <div className="flex items-center gap-2.5 px-3 py-2.5 flex-shrink-0" style={{ background: WA.header }}>
        <ArrowLeft size={16} className="text-white/80 flex-shrink-0"/>
        <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center text-white text-[11px] font-bold flex-shrink-0">
          {(flowName || 'Bot').slice(0, 2).toUpperCase()}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-white text-[12.5px] font-semibold truncate">{flowName || 'Flow preview'}</p>
          <p className="text-white/70 text-[10px]">{typing ? 'typing…' : 'online'}</p>
        </div>
        <Video size={15} className="text-white/80 flex-shrink-0"/>
        <Phone size={14} className="text-white/80 flex-shrink-0"/>
        <button onClick={reset} title="Restart"
          className="w-7 h-7 rounded-full hover:bg-white/15 flex items-center justify-center flex-shrink-0">
          <RotateCcw size={13} className="text-white"/>
        </button>
        <button onClick={onClose} title="Close preview"
          className="w-7 h-7 rounded-full hover:bg-white/15 flex items-center justify-center flex-shrink-0">
          <X size={15} className="text-white"/>
        </button>
      </div>

      {/* Thread */}
      <div ref={listRef} className="flex-1 min-h-0 overflow-y-auto px-3 py-3" style={{ background: WA.wallpaper }}>
        {messages.length === 0 && !typing && (
          <p className="text-[11px] text-slate-500 text-center mt-6">
            Starting the flow…
          </p>
        )}
        {messages.map(m => <Bubble key={m.id} m={m}/>)}
        {typing && (
          <div className="flex justify-start mb-1.5">
            <div className="rounded-lg px-3 py-2 shadow-sm flex items-center gap-1" style={{ background: WA.incoming }}>
              {[0, 1, 2].map(i => (
                <span key={i} className="w-1.5 h-1.5 rounded-full bg-slate-400"
                  style={{ animation: `waDot 1s ${i * 0.15}s infinite ease-in-out` }}/>
              ))}
            </div>
          </div>
        )}
      </div>

      <Composer awaiting={awaiting} ended={ended} onAnswer={answer} onRestart={reset}/>

      <style>{`
        @keyframes waDot { 0%,60%,100% { opacity:.35; transform:translateY(0) } 30% { opacity:1; transform:translateY(-3px) } }
      `}</style>
    </div>
  )
}
