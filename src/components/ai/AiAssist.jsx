import { useEffect, useState } from 'react'
import { Sparkles, Settings2, Loader2, Send, AlertTriangle, Lightbulb, X, MessageSquareText, RefreshCw } from 'lucide-react'
import clsx from 'clsx'
import { ai, inboxPayload, toAiConversation, useAiSettings } from '../../lib/aiApi'
import { useConversations } from '../../context/ConversationContext'
import AiSetupDialog from './AiSetupDialog'

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
export function AiInboxInsights({ conversations }) {
  const { settings } = useAiSettings()
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
            <AskAi conversations={conversations} />
          </div>
        </div>
      )}
      {setup && <AiSetupDialog onClose={() => setSetup(false)} />}
    </div>
  )
}

const SUGGEST_ALL = ['How many customers are interested in buying?', 'How many booked an appointment?', 'Which customers sound unhappy?']
const SUGGEST_ONE = ['Is this customer interested?', 'Did they book an appointment?', 'What do they still need from us?']

/* Ask a question about the open chat, or (scope "all") about every chat in the inbox. Questions like "how many booked an
   appointment?" come back with the matching conversations listed, so the number can be checked. */
function AskAi({ conversation, conversations, compact }) {
  const [scope, setScope] = useState(conversation ? 'chat' : 'all')
  const [q, setQ] = useState('')
  const [asks, setAsks] = useState([])          // newest first: { q, scope, ...answer } | { q, scope, error }
  const [busy, setBusy] = useState(false)
  const id = conversation?.id
  useEffect(() => { setAsks([]); setScope(conversation ? 'chat' : 'all') }, [id]) // eslint-disable-line react-hooks/exhaustive-deps

  const names = Object.fromEntries((conversations || []).map((c) => [String(c.id), c.name]))
  async function ask(text) {
    const question = text.trim()
    if (!question || busy) return
    setBusy(true); setQ('')
    try {
      const payload = scope === 'chat' ? { conversation: toAiConversation(conversation) } : inboxPayload(conversations)
      const answer = await ai.run('ask', { ...payload, question })
      setAsks((a) => [{ q: question, scope, ...answer }, ...a])
    } catch (e) { setAsks((a) => [{ q: question, scope, error: e.message }, ...a]) }
    finally { setBusy(false) }
  }

  return (
    <div>
      {conversation && (
        <div className="inline-flex bg-slate-100 rounded-md p-0.5 mb-2">
          {[['chat', 'This chat'], ['all', `All chats (${conversations.length})`]].map(([k, lbl]) => (
            <button key={k} onClick={() => setScope(k)} className={clsx('px-2.5 py-0.5 rounded text-[10.5px] font-semibold transition-colors', scope === k ? 'bg-white shadow-sm text-slate-800' : 'text-slate-500 hover:text-slate-700')}>{lbl}</button>
          ))}
        </div>
      )}
      <form onSubmit={(e) => { e.preventDefault(); ask(q) }} className="flex gap-2">
        <input value={q} onChange={(e) => setQ(e.target.value)} maxLength={500} aria-label="Ask AI"
          placeholder={scope === 'chat' ? 'Ask about this chat, e.g. did they book an appointment?' : 'Ask about all chats, e.g. how many are interested?'}
          className="flex-1 min-w-0 rounded-lg border border-surface-border px-3 py-2 text-xs outline-none focus:border-primary placeholder:text-slate-400" />
        <button type="submit" disabled={!q.trim() || busy} aria-label="Ask" className="btn-primary px-3 disabled:opacity-50">{busy ? <Loader2 size={13} className="animate-spin" /> : <Send size={13} />}</button>
      </form>
      {!asks.length && !busy && (
        <div className="flex flex-wrap gap-1.5 mt-2">
          {(scope === 'chat' ? SUGGEST_ONE : SUGGEST_ALL).map((t) => (
            <button key={t} onClick={() => ask(t)} className="px-2.5 py-1 rounded-full border border-surface-border text-[10.5px] text-slate-500 hover:border-primary hover:text-primary transition-colors">{t}</button>
          ))}
        </div>
      )}
      <div className={clsx('mt-3 space-y-3 overflow-y-auto', compact && 'max-h-56')}>
        {asks.map((a, i) => (
          <div key={i} className="text-xs">
            <p className="font-semibold text-slate-800">{a.q} <span className="font-normal text-[10px] text-slate-400">· {a.scope === 'chat' ? 'this chat' : 'all chats'}</span></p>
            {a.error ? <p className="text-red-600 mt-0.5">{a.error}</p> : (
              <>
                {a.isCount && (
                  <p className="mt-1">
                    <span className="inline-flex items-baseline gap-1 px-2.5 py-1 rounded-lg bg-primary-50 text-primary">
                      <b className="text-sm">{a.matches.length}</b><span className="text-[10.5px] font-semibold">of {a.analysed} conversations</span>
                    </span>
                    {a.total > a.analysed && <span className="text-[10px] text-amber-600 ml-2">Only the {a.analysed} most recent of {a.total} were checked.</span>}
                  </p>
                )}
                {a.answer && <p className="text-slate-600 mt-1 whitespace-pre-wrap leading-relaxed">{a.answer}</p>}
                {a.matches?.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-1.5">
                    {a.matches.map((m) => <span key={m.id} title={m.why} className="px-2 py-0.5 rounded-full bg-slate-100 text-[10.5px] text-slate-600">{names[m.id] || m.id}</span>)}
                  </div>
                )}
              </>
            )}
          </div>
        ))}
      </div>
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

/* ═══ One conversation: summary + sentiment, and a suggested reply for the composer ═══ */
export function AiChatAssist({ conversation, onUseReply, conversations }) {
  const { settings } = useAiSettings()
  const ctx = useConversations()
  const all = conversations ?? ctx.allConversations     // Instagram keeps its own list, so its inbox passes it in
  const [setup, setSetup] = useState(false)
  const [asking, setAsking] = useState(false)
  const [sum, runSum, clearSum] = useAiTask()
  const [rep, runRep, clearRep] = useAiTask()
  const id = conversation?.id
  useEffect(() => { clearSum(); clearRep() }, [id]) // eslint-disable-line react-hooks/exhaustive-deps

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
        <div className="mt-2 rounded-lg border border-surface-border bg-slate-50/60 p-2.5">
          <AskAi conversation={conversation} conversations={all} compact />
        </div>
      )}
      {setup && <AiSetupDialog onClose={() => setSetup(false)} />}
    </div>
  )
}
