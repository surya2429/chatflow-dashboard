import { useEffect, useRef, useState } from 'react'
import { Sparkles, ArrowUp, Copy, Check, RotateCcw, Loader2 } from 'lucide-react'
import clsx from 'clsx'
import { ai, inboxPayload, toAiConversation } from '../../lib/aiApi'

/* A ChatGPT-style thread: your questions on the right, the AI's answers on the left, follow-ups remembered.
   The parent owns the thread (useThread) so closing a panel does not lose the conversation. */
export function useThread() {
  const [items, setItems] = useState([])
  return { items, setItems, clear: () => setItems([]) }
}

/* ── tiny markdown: paragraphs, "- " / "1. " lists, **bold**, `code` — built as elements, never as HTML ── */
function inline(text) {
  return text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g).map((p, i) => {
    if (p.length > 4 && p.startsWith('**') && p.endsWith('**')) return <strong key={i} className="font-semibold text-slate-900">{p.slice(2, -2)}</strong>
    if (p.length > 2 && p.startsWith('`') && p.endsWith('`')) return <code key={i} className="px-1 rounded bg-slate-100 text-[12px]">{p.slice(1, -1)}</code>
    return p
  })
}
function Markdown({ text }) {
  const blocks = []
  let list = null
  for (const raw of text.split('\n')) {
    const m = raw.match(/^\s*(?:[-*•]|\d+[.)])\s+(.*)$/)
    if (m) {
      const ordered = /^\s*\d/.test(raw)
      if (!list || list.ordered !== ordered) { list = { ordered, items: [] }; blocks.push(list) }
      list.items.push(m[1])
    } else { list = null; if (raw.trim()) blocks.push({ p: raw.replace(/^#{1,4}\s+/, '').trim() }) }
  }
  return (
    <div className="space-y-2.5">
      {blocks.map((b, i) => b.p !== undefined
        ? <p key={i}>{inline(b.p)}</p>
        : b.ordered
          ? <ol key={i} className="list-decimal pl-5 space-y-1.5 marker:text-slate-400">{b.items.map((t, j) => <li key={j}>{inline(t)}</li>)}</ol>
          : <ul key={i} className="list-disc pl-5 space-y-1.5 marker:text-slate-300">{b.items.map((t, j) => <li key={j}>{inline(t)}</li>)}</ul>)}
    </div>
  )
}

const STARTERS_ALL = ['How many customers are interested in buying?', 'How many booked an appointment?', 'Which customers sound unhappy?', 'Who is still waiting for a reply?']
const STARTERS_ONE = ['Is this customer interested?', 'Did they book an appointment?', 'What do they still need from us?', 'Summarise this chat in two lines']

function Avatar() {
  return <span className="w-6 h-6 rounded-full bg-primary-50 text-primary flex items-center justify-center flex-shrink-0 mt-0.5"><Sparkles size={12} /></span>
}

export default function AiChat({ thread, conversation, conversations, onOpen }) {
  const { items, setItems } = thread
  const [scope, setScope] = useState(conversation ? 'chat' : 'all')
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  const [copied, setCopied] = useState(-1)
  const end = useRef(null)
  const box = useRef(null)
  const id = conversation?.id

  useEffect(() => { setScope(conversation ? 'chat' : 'all') }, [id]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { end.current?.scrollIntoView({ block: 'end', behavior: 'smooth' }) }, [items.length, busy])

  const names = Object.fromEntries((conversations || []).map((c) => [String(c.id), c.name]))

  async function send(text, base = items) {
    const q = text.trim()
    if (!q || busy) return
    const history = base.filter((i) => (i.role === 'user' || i.role === 'ai') && !i.error).map((i) => ({ role: i.role === 'user' ? 'user' : 'assistant', content: i.text }))
    setItems([...base, { role: 'user', text: q }])
    setInput('')
    if (box.current) box.current.style.height = 'auto'
    setBusy(true)
    try {
      const payload = scope === 'chat' ? { conversation: toAiConversation(conversation) } : inboxPayload(conversations)
      const r = await ai.run('ask', { ...payload, question: q, history })
      setItems((cur) => [...cur, { role: 'ai', text: r.answer || 'I could not find an answer in these conversations.', ...r }])
    } catch (e) {
      setItems((cur) => [...cur, { role: 'ai', error: e.message, retry: q }])
    } finally { setBusy(false) }
  }

  function switchScope(next) {
    if (next === scope) return
    setScope(next)
    if (items.length) setItems((cur) => [...cur, { role: 'note', text: next === 'chat' ? 'Now asking about this chat only' : `Now asking about all ${conversations.length} chats` }])
  }
  const regenerate = () => {
    const lastUser = [...items].reverse().find((i) => i.role === 'user')
    if (!lastUser) return
    const cut = items.map((i) => i.role).lastIndexOf('user')
    send(lastUser.text, items.slice(0, cut))
  }
  const copy = (text, i) => { navigator.clipboard?.writeText(text).then(() => { setCopied(i); setTimeout(() => setCopied(-1), 1500) }).catch(() => {}) }
  const grow = (el) => { el.style.height = 'auto'; el.style.height = `${Math.min(el.scrollHeight, 120)}px` }

  const lastAi = items.map((i) => i.role).lastIndexOf('ai')
  const starters = scope === 'chat' ? STARTERS_ONE : STARTERS_ALL

  return (
    <div className="flex flex-col h-full min-h-0">
      {conversation && (
        <div className="px-4 pt-3 pb-1 flex-shrink-0">
          <div className="inline-flex bg-slate-100 rounded-lg p-0.5">
            {[['chat', 'This chat'], ['all', `All chats (${conversations.length})`]].map(([k, lbl]) => (
              <button key={k} onClick={() => switchScope(k)} className={clsx('px-3 py-1 rounded-md text-[11px] font-semibold transition-colors', scope === k ? 'bg-white shadow-sm text-slate-800' : 'text-slate-500 hover:text-slate-700')}>{lbl}</button>
            ))}
          </div>
        </div>
      )}

      <div className="flex-1 min-h-0 overflow-y-auto px-4 py-4 space-y-5">
        {!items.length && !busy && (
          <div className="h-full flex flex-col items-center justify-center text-center px-2">
            <span className="w-10 h-10 rounded-2xl bg-primary-50 text-primary flex items-center justify-center mb-3"><Sparkles size={18} /></span>
            <p className="text-sm font-bold text-slate-800">{scope === 'chat' ? 'Ask about this conversation' : `Ask about your ${conversations.length} chats`}</p>
            <p className="text-xs text-slate-500 mt-1 mb-4 max-w-[270px]">I read the messages and answer with the customers and details behind it.</p>
            <div className="w-full space-y-1.5">
              {starters.map((t) => (
                <button key={t} onClick={() => send(t)} className="w-full text-left px-3.5 py-2.5 rounded-xl border border-surface-border text-xs text-slate-600 hover:border-primary/40 hover:bg-primary-50/40 hover:text-slate-800 transition-colors">{t}</button>
              ))}
            </div>
          </div>
        )}

        {items.map((m, i) => {
          if (m.role === 'note') return <p key={i} className="text-center text-[10.5px] text-slate-400">{m.text}</p>
          if (m.role === 'user') return (
            <div key={i} className="flex justify-end">
              <p className="max-w-[85%] bg-primary text-white text-[13px] leading-relaxed rounded-2xl rounded-br-md px-3.5 py-2 whitespace-pre-wrap">{m.text}</p>
            </div>
          )
          return (
            <div key={i} className="flex gap-2.5">
              <Avatar />
              <div className="flex-1 min-w-0 text-[13px] leading-relaxed text-slate-700">
                {m.error ? (
                  <div>
                    <p className="text-red-600">{m.error}</p>
                    {m.retry && <button onClick={() => send(m.retry, items.slice(0, i - 1))} className="mt-1.5 inline-flex items-center gap-1 text-[11px] font-semibold text-primary hover:underline"><RotateCcw size={11} /> Try again</button>}
                  </div>
                ) : (
                  <>
                    <Markdown text={m.text} />
                    {m.matches?.length > 0 && (
                      <div className="mt-3">
                        <p className="text-[10.5px] font-semibold text-slate-400 uppercase tracking-wide mb-1.5">
                          {m.isCount ? `${m.matches.length} of ${m.analysed} conversations` : 'Conversations'}
                          {m.total > m.analysed && <span className="normal-case font-normal text-amber-600"> · latest {m.analysed} of {m.total} checked</span>}
                        </p>
                        <div className="flex flex-wrap gap-1.5">
                          {m.matches.map((x) => onOpen
                            ? <button key={x.id} onClick={() => onOpen(x.id)} title={x.why ? `${x.why} · open chat` : 'Open chat'} className="px-2.5 py-1 rounded-full bg-slate-100 text-[11px] font-medium text-slate-600 hover:bg-primary-50 hover:text-primary transition-colors">{names[x.id] || x.id}</button>
                            : <span key={x.id} title={x.why} className="px-2.5 py-1 rounded-full bg-slate-100 text-[11px] font-medium text-slate-600">{names[x.id] || x.id}</span>)}
                        </div>
                      </div>
                    )}
                    <div className="flex items-center gap-1 mt-2 -ml-1">
                      <button onClick={() => copy(m.text, i)} aria-label="Copy answer" title="Copy" className="p-1 rounded text-slate-300 hover:text-slate-600 hover:bg-slate-100">{copied === i ? <Check size={12} className="text-emerald-500" /> : <Copy size={12} />}</button>
                      {i === lastAi && !busy && <button onClick={regenerate} aria-label="Regenerate answer" title="Regenerate" className="p-1 rounded text-slate-300 hover:text-slate-600 hover:bg-slate-100"><RotateCcw size={12} /></button>}
                    </div>
                    {i === lastAi && !busy && m.followUps?.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mt-2">
                        {m.followUps.map((f) => <button key={f} onClick={() => send(f)} className="px-2.5 py-1 rounded-full border border-surface-border text-[11px] text-slate-500 hover:border-primary hover:text-primary transition-colors text-left">{f}</button>)}
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          )
        })}

        {busy && (
          <div className="flex gap-2.5 items-center" role="status" aria-label="AI is thinking">
            <Avatar />
            <span className="flex gap-1">{[0, 150, 300].map((d) => <i key={d} style={{ animationDelay: `${d}ms` }} className="w-1.5 h-1.5 rounded-full bg-slate-300 animate-bounce" />)}</span>
          </div>
        )}
        <div ref={end} />
      </div>

      <div className="px-3 pb-3 pt-1 flex-shrink-0">
        <form onSubmit={(e) => { e.preventDefault(); send(input) }}
          className="flex items-end gap-2 rounded-2xl border border-surface-border bg-white px-3.5 py-2 shadow-sm focus-within:border-primary transition-colors">
          <textarea ref={box} value={input} rows={1} maxLength={500} aria-label="Ask AI"
            onChange={(e) => { setInput(e.target.value); grow(e.target) }}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(input) } }}
            placeholder={scope === 'chat' ? 'Ask about this chat…' : 'Ask about all your chats…'}
            className="flex-1 min-w-0 resize-none bg-transparent text-[13px] text-slate-800 placeholder:text-slate-400 outline-none py-1 max-h-[120px]" />
          <button type="submit" disabled={!input.trim() || busy} aria-label="Send"
            className="w-7 h-7 rounded-full bg-primary text-white flex items-center justify-center flex-shrink-0 mb-0.5 disabled:opacity-30 transition-opacity">
            {busy ? <Loader2 size={13} className="animate-spin" /> : <ArrowUp size={14} />}
          </button>
        </form>
        <p className="text-[10px] text-slate-400 text-center mt-1.5">AI can make mistakes. Check the conversations it points to.</p>
      </div>
    </div>
  )
}
