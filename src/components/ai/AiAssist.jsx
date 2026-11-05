import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Sparkles, Settings2, Loader2, AlertTriangle, Lightbulb, X, MessageSquareText, RefreshCw } from 'lucide-react'
import clsx from 'clsx'
import { ai, inboxPayload, toAiConversation, useAiSettings } from '../../lib/aiApi'
import { useConversations } from '../../context/ConversationContext'
import AiSetupDialog from './AiSetupDialog'
import AiChat, { useThread } from './AiChat'

const SENTIMENT = { positive: 'bg-emerald-50 text-emerald-700', neutral: 'bg-slate-100 text-slate-600', negative: 'bg-red-50 text-red-600' }
const URGENCY = { low: 'bg-slate-100 text-slate-600', medium: 'bg-amber-50 text-amber-700', high: 'bg-red-50 text-red-600' }
const Chip = ({ cls, children }) => <span className={clsx('px-2 py-0.5 rounded-full text-[10px] font-bold capitalize', cls)}>{children}</span>

/* Runs one AI request and keeps its { data, loading, error } — used by every button below. */
function useAiTask() {
  const [state, setState] = useState({ data: null, loading: false, error: '' })
  const run = async (task, payload) => {
    setState((s) => ({ ...s, loading: true, error: '' }))
    try { const data = await ai.run(task, payload); setState({ data, loading: false, error: '' }); return data }
    catch (e) { setState((s) => ({ ...s, loading: false, error: e.message })); return null }
  }
  return [state, run, () => setState({ data: null, loading: false, error: '' })]
}

/* ═══ Inbox-wide: headline, top topics, complaints, chats needing attention, and "Ask AI" ═══ */
export function AiInboxInsights({ conversations, onOpen }) {
  const { settings } = useAiSettings()
  const thread = useThread()
  const [setup, setSetup] = useState(false)
  const [report, runReport] = useAiTask()

  const names = Object.fromEntries(conversations.map((c) => [String(c.id), c.name]))
  const ready = settings?.configured
  const r = report.data

  return (
    <div className="bg-white border border-surface-border rounded-xl overflow-hidden">
      <div className="flex items-center gap-2.5 px-4 py-3 border-b border-surface-border">
        <span className="w-7 h-7 rounded-lg bg-primary-50 text-primary flex items-center justify-center"><Sparkles size={14} /></span>
        <div className="flex-1 min-w-0">
          <h3 className="text-xs font-bold text-slate-800">AI Insights</h3>
          <p className="text-[10px] text-slate-400 truncate">{ready ? `${settings.model} · ${conversations.length} conversations` : 'Summaries, trends and answers from your conversations'}</p>
        </div>
        {ready && (
          <>
            <button onClick={() => runReport('inbox', inboxPayload(conversations))} disabled={report.loading || !conversations.length} className="btn-primary text-[11px] px-3 py-1.5 inline-flex items-center gap-1.5 disabled:opacity-50">
              {report.loading ? <Loader2 size={12} className="animate-spin" /> : r ? <RefreshCw size={12} /> : <Sparkles size={12} />} {r ? 'Refresh' : 'Generate insights'}
            </button>
            <button onClick={() => setSetup(true)} aria-label="AI settings" title="AI settings" className="p-1.5 rounded-lg text-slate-400 hover:bg-surface-hover hover:text-slate-600"><Settings2 size={14} /></button>
          </>
        )}
      </div>

      {!settings ? (
        <div className="px-4 py-6 text-center"><Loader2 size={15} className="animate-spin text-slate-400 inline" /></div>
      ) : !ready ? (
        <div className="px-4 py-6 text-center">
          <p className="text-xs text-slate-600 max-w-sm mx-auto">Connect an AI model to get conversation summaries, sentiment, top topics, suggested replies and a chat you can ask questions about your inbox.</p>
          <button onClick={() => setSetup(true)} className="btn-primary text-xs mt-3 inline-flex items-center gap-1.5"><Sparkles size={13} /> Set up AI</button>
          {settings.unavailable && <p className="text-[10.5px] text-amber-600 mt-2">{settings.unavailable}</p>}
        </div>
      ) : (
        <div className="p-4 space-y-4">
          {report.error && <p role="alert" className="text-[11px] text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">{report.error}</p>}

          {r && (
            <div className="space-y-4">
              <p className="text-[13px] font-semibold text-slate-800 leading-snug">{r.headline}</p>

              {r.topics.length > 0 && (
                <Section icon={MessageSquareText} title="What customers talk about">
                  <div className="space-y-1.5">
                    {r.topics.map((t) => (
                      <div key={t.name} className="flex items-baseline gap-2 text-xs">
                        <span className="min-w-[22px] text-center px-1.5 py-0.5 rounded-md bg-primary-50 text-primary text-[10px] font-bold">{t.count}</span>
                        <span className="font-semibold text-slate-700">{t.name}</span>
                        {t.example && <span className="text-slate-400 truncate">— {t.example}</span>}
                      </div>
                    ))}
                  </div>
                </Section>
              )}

              {r.needsAttention.length > 0 && (
                <Section icon={AlertTriangle} title="Needs attention" tone="text-amber-600">
                  <div className="space-y-1.5">
                    {r.needsAttention.map((n) => (
                      <div key={n.id} className="rounded-lg bg-amber-50/60 border border-amber-100 px-3 py-2 text-xs">
                        <span className="font-semibold text-slate-800">{names[n.id] || n.id}</span> <span className="text-slate-600">{n.reason}</span>
                      </div>
                    ))}
                  </div>
                </Section>
              )}

              {r.complaints.length > 0 && (
                <Section icon={AlertTriangle} title="Recurring complaints">
                  <ul className="list-disc pl-4 space-y-0.5 text-xs text-slate-600">{r.complaints.map((c, i) => <li key={i}>{c}</li>)}</ul>
                </Section>
              )}

              {r.suggestions.length > 0 && (
                <Section icon={Lightbulb} title="Suggestions">
                  <ul className="list-disc pl-4 space-y-0.5 text-xs text-slate-600">{r.suggestions.map((c, i) => <li key={i}>{c}</li>)}</ul>
                </Section>
              )}
            </div>
          )}

          <div className={clsx(r && 'border-t border-surface-border pt-4')}>
            <p className="text-[11px] font-bold text-slate-700 mb-2">Ask AI about your chats</p>
            <div className="h-[460px] rounded-xl border border-surface-border bg-white overflow-hidden">
              <AiChat thread={thread} conversations={conversations} onOpen={onOpen} />
            </div>
          </div>
        </div>
      )}
      {setup && <AiSetupDialog onClose={() => setSetup(false)} />}
    </div>
  )
}

function Section({ icon: Icon, title, tone = 'text-primary', children }) {
  return (
    <div>
      <h4 className="text-[11px] font-bold text-slate-700 mb-2 flex items-center gap-1.5"><Icon size={12} className={tone} /> {title}</h4>
      {children}
    </div>
  )
}

/* ═══ The ✨ icon in the inbox list header (next to refresh): ask about ALL chats in this inbox ═══ */
export function AiInboxButton({ conversations, onOpen }) {
  const { settings } = useAiSettings()
  const ctx = useConversations()
  const all = conversations ?? ctx.allConversations        // Instagram keeps its own list, so its inbox passes it in
  const thread = useThread()
  const [pos, setPos] = useState(null)                     // null = closed
  const [setup, setSetup] = useState(false)
  const btn = useRef(null)
  const pop = useRef(null)

  useEffect(() => {
    if (!pos) return
    const away = (e) => { if (!pop.current?.contains(e.target) && !btn.current?.contains(e.target)) setPos(null) }
    const esc = (e) => { if (e.key === 'Escape') setPos(null) }
    document.addEventListener('mousedown', away); document.addEventListener('keydown', esc)
    return () => { document.removeEventListener('mousedown', away); document.removeEventListener('keydown', esc) }
  }, [pos])

  function toggle() {
    if (pos) return setPos(null)
    const r = btn.current.getBoundingClientRect()
    const w = Math.min(440, window.innerWidth - 16)
    setPos({ top: r.bottom + 6, left: Math.max(8, Math.min(r.left - 16, window.innerWidth - w - 8)), width: w })
  }

  return (
    <>
      <button ref={btn} onClick={toggle} title="Ask AI about all chats" aria-label="Ask AI about all chats" aria-expanded={!!pos}
        className={clsx('p-1.5 rounded-lg transition-colors', pos ? 'bg-primary-50 text-primary' : 'text-primary/80 hover:bg-primary-50 hover:text-primary')}>
        <Sparkles size={12} />
      </button>
      {pos && createPortal(
        <div ref={pop} role="dialog" aria-label="Ask AI about all chats"
          style={{ position: 'fixed', top: pos.top, left: pos.left, width: pos.width, height: `min(640px, calc(100vh - ${pos.top + 12}px))` }}
          className="z-50 flex flex-col bg-white rounded-2xl border border-surface-border shadow-modal overflow-hidden">
          <div className="flex items-center gap-2 px-4 py-3 border-b border-surface-border flex-shrink-0">
            <span className="w-6 h-6 rounded-lg bg-primary-50 text-primary flex items-center justify-center"><Sparkles size={13} /></span>
            <p className="text-[13px] font-bold text-slate-800 flex-1">Ask AI <span className="font-normal text-slate-400 text-xs">· {all.length} chats</span></p>
            {thread.items.length > 0 && <button onClick={thread.clear} className="text-[11px] font-semibold text-slate-500 hover:text-primary px-2 py-1 rounded-lg hover:bg-slate-100">New chat</button>}
            {settings?.configured && <button onClick={() => { setPos(null); setSetup(true) }} aria-label="AI settings" title="AI settings" className="p-1.5 rounded-lg text-slate-300 hover:text-slate-500 hover:bg-slate-100"><Settings2 size={13} /></button>}
            <button onClick={() => setPos(null)} aria-label="Close" className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100"><X size={13} /></button>
          </div>
          <div className="flex-1 min-h-0">
            {!settings ? <Loader2 size={14} className="animate-spin text-slate-400 mx-auto my-6" />
              : settings.configured ? <AiChat thread={thread} conversations={all} onOpen={onOpen && ((id) => { setPos(null); onOpen(id) })} />
              : (
                <div className="text-center py-8 px-6">
                  <p className="text-xs text-slate-500 mb-3">Connect an AI model to ask questions like “how many booked an appointment?”.</p>
                  <button onClick={() => { setPos(null); setSetup(true) }} className="btn-primary text-xs inline-flex items-center gap-1.5"><Sparkles size={12} /> Set up AI</button>
                </div>
              )}
          </div>
        </div>, document.body)}
      {setup && <AiSetupDialog onClose={() => setSetup(false)} />}
    </>
  )
}

/* ═══ One conversation: summary + sentiment, and a suggested reply for the composer ═══ */
export function AiChatAssist({ conversation, onUseReply, conversations, onOpen }) {
  const { settings } = useAiSettings()
  const ctx = useConversations()
  const all = conversations ?? ctx.allConversations     // Instagram keeps its own list, so its inbox passes it in
  const openChat = onOpen ?? (conversations ? undefined : ctx.setActiveId)
  const thread = useThread()
  const [setup, setSetup] = useState(false)
  const [asking, setAsking] = useState(false)
  const [sum, runSum, clearSum] = useAiTask()
  const [rep, runRep, clearRep] = useAiTask()
  const id = conversation?.id
  useEffect(() => { clearSum(); clearRep(); thread.clear() }, [id]) // eslint-disable-line react-hooks/exhaustive-deps

  const ready = settings?.configured
  const one = () => ({ conversation: toAiConversation(conversation) })
  const s = sum.data

  async function suggest() {
    const out = await runRep('reply', one())
    if (out?.reply) onUseReply(out.reply)
  }
  const btn = 'inline-flex items-center gap-1 px-2.5 py-1 rounded-full border border-surface-border text-[11px] font-semibold text-slate-600 hover:border-primary hover:text-primary transition-colors disabled:opacity-50'

  return (
    <div className="px-3 pt-2.5">
      <div className="flex items-center gap-1.5">
        <Sparkles size={12} className="text-primary" />
        {!ready ? (
          <button onClick={() => setSetup(true)} className={btn} disabled={!settings}>Set up AI for summaries &amp; suggested replies</button>
        ) : (
          <>
            <button onClick={() => runSum('summary', one())} disabled={sum.loading} className={btn}>{sum.loading ? <Loader2 size={11} className="animate-spin" /> : null} Summarise</button>
            <button onClick={suggest} disabled={rep.loading} className={btn}>{rep.loading ? <Loader2 size={11} className="animate-spin" /> : null} Suggest reply</button>
            <button onClick={() => setAsking((v) => !v)} aria-expanded={asking} className={clsx(btn, asking && 'border-primary text-primary')}>Ask AI</button>
            <button onClick={() => setSetup(true)} aria-label="AI settings" title="AI settings" className="ml-auto p-1 rounded text-slate-300 hover:text-slate-500"><Settings2 size={12} /></button>
          </>
        )}
      </div>
      {(sum.error || rep.error) && <p role="alert" className="text-[10.5px] text-red-600 mt-1.5">{sum.error || rep.error}</p>}
      {s && (
        <div className="mt-2 rounded-lg border border-primary/15 bg-primary-50/40 px-3 py-2.5 relative">
          <button onClick={clearSum} aria-label="Dismiss summary" className="absolute top-1.5 right-1.5 p-1 text-slate-400 hover:text-slate-600"><X size={11} /></button>
          <div className="flex flex-wrap items-center gap-1.5 mb-1.5 pr-5">
            <Chip cls={SENTIMENT[s.sentiment]}>{s.sentiment}</Chip>
            <Chip cls={URGENCY[s.urgency]}>{s.urgency} urgency</Chip>
            {s.topics.map((t) => <span key={t} className="text-[10px] text-slate-500 bg-white border border-surface-border rounded-full px-2 py-0.5">{t}</span>)}
          </div>
          <p className="text-xs text-slate-700 leading-relaxed">{s.summary}</p>
          {s.nextStep && <p className="text-[11px] text-slate-500 mt-1.5"><span className="font-semibold text-slate-700">Next step:</span> {s.nextStep}</p>}
        </div>
      )}
      {ready && asking && (
        <div className="mt-2 h-[380px] rounded-xl border border-surface-border bg-white overflow-hidden">
          <AiChat thread={thread} conversation={conversation} conversations={all} onOpen={openChat} />
        </div>
      )}
      {setup && <AiSetupDialog onClose={() => setSetup(false)} />}
    </div>
  )
}
