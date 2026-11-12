import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { Lock, MessageSquareOff } from 'lucide-react'
import { SAMPLE_BOT, SAMPLE_LEAD, SAMPLE_TOKEN, SAMPLE_TRANSCRIPT, formatDay, formatTime } from '../lib/leadNotifications'

/* The page an email notification links to: one conversation, read-only, no login. Found only by its unguessable token;
   a wrong or expired link is a plain "not found". The token `sample` shows a made-up chat (the Settings preview links to it). */
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api'
const SAMPLE = { botName: SAMPLE_BOT, visitorName: SAMPLE_LEAD.name, messages: SAMPLE_TRANSCRIPT.map(m => ({ ...m, at: m.at.toISOString() })) }

function useTranscript(token) {
  const [state, setState] = useState(token === SAMPLE_TOKEN ? { data: SAMPLE } : { loading: true })
  useEffect(() => {
    if (token === SAMPLE_TOKEN) { setState({ data: SAMPLE }); return }
    let live = true
    setState({ loading: true })
    fetch(`${API_BASE_URL}/webchat/transcripts/${encodeURIComponent(token)}`)
      .then(r => r.ok ? r.json() : Promise.reject(r.status))
      .then(data => live && setState({ data }))
      .catch(code => live && setState({ error: code === 404 ? 'missing' : 'failed' }))
    return () => { live = false }
  }, [token])
  return state
}

export default function TranscriptView() {
  const { token } = useParams()
  const { data, loading, error } = useTranscript(token)

  useEffect(() => {   // a private page: keep it out of search engines
    const meta = document.createElement('meta')
    meta.name = 'robots'; meta.content = 'noindex, nofollow'
    document.head.appendChild(meta)
    const before = document.title
    document.title = 'Conversation'
    return () => { meta.remove(); document.title = before }
  }, [])

  if (loading) return <Shell><p className="text-center text-sm text-slate-400 py-20">Loading the conversation…</p></Shell>
  if (error) return (
    <Shell>
      <div className="text-center py-20 px-6">
        <MessageSquareOff size={34} className="mx-auto text-slate-300 mb-3"/>
        <p className="font-semibold text-slate-700">{error === 'missing' ? 'This conversation is not available' : 'Could not load the conversation'}</p>
        <p className="text-sm text-slate-400 mt-1">{error === 'missing' ? 'The link may be wrong or may have expired.' : 'Check your connection and try again.'}</p>
      </div>
    </Shell>
  )

  let lastDay = ''
  return (
    <Shell>
      <header className="flex items-center gap-3 px-5 py-4 border-b border-surface-border bg-white">
        <div className="w-10 h-10 rounded-full bg-primary text-white flex items-center justify-center font-bold text-sm">{(data.botName[0] || 'C').toUpperCase()}</div>
        <div className="min-w-0">
          <h1 className="font-bold text-slate-900 text-[15px] leading-tight truncate">{data.botName}</h1>
          <p className="text-xs text-slate-500 truncate">Conversation with {data.visitorName} · {data.messages.length} message{data.messages.length === 1 ? '' : 's'}</p>
        </div>
      </header>
      <ol className="px-4 sm:px-6 py-5 space-y-3 bg-slate-50">
        {data.messages.map((m, i) => {
          const at = new Date(m.at), day = formatDay(at), mine = m.from === 'user'
          const sep = day !== lastDay; lastDay = day
          return (
            <li key={i}>
              {sep && <p className="text-center text-[11px] font-semibold text-slate-400 my-3">{day}</p>}
              <div className={mine ? 'flex flex-col items-end' : 'flex flex-col items-start'}>
                <span className="text-[11px] font-semibold text-slate-500 mb-0.5 px-1">{m.from === 'user' ? data.visitorName : m.from === 'agent' ? 'Agent' : data.botName}</span>
                <div className={`max-w-[85%] whitespace-pre-wrap break-words text-[14px] leading-relaxed px-3.5 py-2 rounded-2xl shadow-sm ${mine ? 'bg-primary text-white rounded-tr-sm' : 'bg-white text-slate-800 border border-surface-border rounded-tl-sm'}`}>{m.text}</div>
                <span className="text-[10.5px] text-slate-400 mt-0.5 px-1">{formatTime(at)}</span>
              </div>
            </li>
          )
        })}
      </ol>
      <footer className="flex items-center justify-center gap-1.5 px-5 py-3 border-t border-surface-border bg-white text-[11px] text-slate-400">
        <Lock size={11}/> Private link: anyone who has it can read this conversation. Times are in India time (IST).
      </footer>
    </Shell>
  )
}

function Shell({ children }) {
  return (
    <div className="min-h-screen bg-slate-100 sm:py-8">
      <main className="max-w-2xl mx-auto bg-white sm:rounded-2xl sm:shadow-card overflow-hidden min-h-screen sm:min-h-0">{children}</main>
    </div>
  )
}
