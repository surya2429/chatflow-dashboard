import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ExternalLink, Send, Copy, Check, MessageSquare, Mail, Building2, MapPin, Languages, Tag, UserRound, Inbox, Globe } from 'lucide-react'
import clsx from 'clsx'
import { useConversations } from '../../context/ConversationContext'
import { money } from '../../lib/ctwaApi'
import EventDialog from './EventDialog'
import { buildJourney, findConversation, revenueOf } from './journey'
import { Card, Drawer } from './ui'

const fmt = (iso) => new Date(iso).toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
const TONE = { blue: 'bg-blue-500', slate: 'bg-slate-400', violet: 'bg-violet-500', green: 'bg-emerald-500', red: 'bg-red-500' }
const CHAT_STATUS = { bot: ['Bot is handling', 'bg-blue-50 text-blue-700'], agent: ['With an agent', 'bg-emerald-50 text-emerald-700'], resolved: ['Resolved', 'bg-slate-100 text-slate-600'] }

function Row({ icon: Icon, label, children }) {
  if (!children) return null
  return (
    <div className="flex items-start gap-2.5 py-2 text-xs">
      <Icon size={13} className="text-slate-400 mt-0.5 flex-shrink-0" />
      <span className="w-20 flex-shrink-0 text-slate-400">{label}</span>
      <span className="font-medium text-slate-800 min-w-0 break-words">{children}</span>
    </div>
  )
}

function Bubble({ m }) {
  if (m.type === 'event') return <p className="text-center text-[10.5px] text-slate-400 py-0.5">{m.text}</p>
  if (m.type === 'note') return <p className="mx-auto max-w-[90%] text-[11px] bg-amber-50 border border-amber-100 text-amber-800 rounded-lg px-3 py-1.5">Private note{m.sender ? ` · ${m.sender}` : ''}: {m.text}</p>
  const mine = m.type === 'outgoing' || m.type === 'template'
  const text = m.type === 'answer' ? `${m.label}: ${m.value}` : m.type === 'template' ? (m.template?.body || 'Template message') : m.text
  if (!text) return null
  return (
    <div className={clsx('flex', mine ? 'justify-end' : 'justify-start')}>
      <div className={clsx('max-w-[82%] rounded-2xl px-3 py-1.5 text-xs leading-relaxed', mine ? 'bg-primary text-white rounded-br-md' : 'bg-white border border-surface-border text-slate-700 rounded-bl-md')}>
        {mine && <p className="text-[9.5px] opacity-70 mb-0.5">{m.sender === 'Bot' ? 'Bot' : m.agentName || m.sender || 'Agent'}</p>}
        {text}
        {m.time && <p className={clsx('text-[9px] mt-0.5 text-right', mine ? 'opacity-60' : 'text-slate-400')}>{m.time}</p>}
      </div>
    </div>
  )
}

/** Everything known about one lead from an ad: who they are, the ad that brought them, their journey, the chat,
    and what has been reported to Meta. */
export default function LeadDetail({ lead, currency, mode, capiLive, onClose, onChanged, notify, z }) {
  const { conversations, selectConversation } = useConversations()
  const navigate = useNavigate()
  const [dialog, setDialog] = useState(null)
  const [copied, setCopied] = useState(false)
  const conv = useMemo(() => findConversation(lead, conversations), [lead, conversations])
  const steps = useMemo(() => buildJourney(lead, conv, fmt), [lead, conv])
  const revenue = revenueOf(lead)
  const name = lead.contactName || conv?.name || `+${lead.waId}`
  const chat = conv && (CHAT_STATUS[conv.status] || [conv.status, 'bg-slate-100 text-slate-600'])
  const messages = conv?.messages ?? []
  const place = [conv?.city, conv?.state, conv?.country].filter(Boolean).join(', ')
  const copyClid = () => navigator.clipboard?.writeText(lead.ctwaClid).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1500) }).catch(() => {})
  const sent = (n, status) => { notify?.(status === 'simulated' ? 'Recorded as a test (sample mode, nothing was sent to Meta).' : 'Sent to Meta.', 'ok'); onChanged?.() }
  const openInbox = () => { selectConversation(conv.id); navigate('/conversations') }

  return (
    <>
      <Drawer onClose={onClose} z={z}
        title={<div className="flex items-center gap-3">
          <span className="w-10 h-10 rounded-full bg-emerald-100 text-emerald-700 font-bold flex items-center justify-center flex-shrink-0">{name.replace(/[^A-Za-z0-9 ]/g, '').split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase() || '#'}</span>
          <div className="min-w-0"><h2 className="text-sm font-bold text-slate-900 truncate">{name}</h2><p className="text-[11px] text-slate-500">+{lead.waId} · lead since {fmt(lead.createdAt)}</p></div>
        </div>}>
        <div className="p-5 space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            {chat && <span className={clsx('px-2.5 py-1 rounded-full text-[10.5px] font-bold', chat[1])}>{chat[0]}</span>}
            {conv?.agentName && <span className="inline-flex items-center gap-1 text-[11px] text-slate-500"><UserRound size={12} /> {conv.agentName}</span>}
            <div className="ml-auto flex gap-2">
              {conv && <button onClick={openInbox} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-surface-border bg-white text-[11px] font-semibold text-slate-700 hover:border-primary hover:text-primary"><Inbox size={12} /> Open in inbox</button>}
              <button onClick={() => setDialog('LeadSubmitted')} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary text-white text-[11px] font-semibold hover:bg-primary-hover"><Send size={12} /> Send event to Meta</button>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            {[['Revenue', revenue ? money(revenue, currency) : '—'], ['Events sent', lead.events.filter((e) => e.status !== 'failed').length], ['Messages', messages.filter((m) => m.type === 'incoming' || m.type === 'outgoing').length || '—']].map(([l, v]) => (
              <div key={l} className="bg-white border border-surface-border rounded-xl p-3"><p className="text-lg font-bold text-slate-800 tabular-nums leading-none">{v}</p><p className="text-[10.5px] text-slate-400 mt-1.5">{l}</p></div>
            ))}
          </div>

          <Card title="Contact" bodyClass="px-4 py-1.5 divide-y divide-surface-border/60">
            <Row icon={MessageSquare} label="WhatsApp">+{lead.waId}</Row>
            <Row icon={Mail} label="Email">{conv?.email}</Row>
            <Row icon={Building2} label="Company">{[conv?.company, conv?.website].filter(Boolean).join(' · ')}</Row>
            <Row icon={MapPin} label="Location">{place}</Row>
            <Row icon={Languages} label="Language">{conv?.language}</Row>
            <Row icon={Tag} label="Labels">{(conv?.labels || []).map((l) => `#${l}`).join('  ')}</Row>
            {!conv && <p className="py-3 text-[11px] text-slate-400">This chat is not in the inbox yet, so only what the ad gave us is shown. Name and number come from WhatsApp.</p>}
          </Card>

          <Card title="The ad that brought them" bodyClass="p-4 space-y-3">
            <div className="flex gap-3">
              {lead.mediaUrl && <img src={lead.mediaUrl} alt="" className="w-16 h-16 rounded-lg object-cover flex-shrink-0" />}
              <div className="min-w-0">
                <p className="text-xs font-bold text-slate-800">{lead.adName || 'Click-to-WhatsApp ad'}</p>
                {lead.headline && <p className="text-xs text-slate-600 mt-0.5">“{lead.headline}”</p>}
                {lead.body && <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">{lead.body}</p>}
              </div>
            </div>
            <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-[11px]">
              <div><dt className="text-slate-400">Source</dt><dd className="font-medium text-slate-700 capitalize">{lead.sourceType || 'ad'}{lead.mediaType ? ` · ${lead.mediaType}` : ''}</dd></div>
              <div><dt className="text-slate-400">Ad ID</dt><dd className="font-medium text-slate-700 break-all">{lead.sourceId || '—'}</dd></div>
              {lead.sourceUrl && <div className="col-span-2"><dt className="text-slate-400">Ad link</dt><dd><a href={lead.sourceUrl} target="_blank" rel="noreferrer" className="font-medium text-primary hover:underline inline-flex items-center gap-1 break-all"><Globe size={11} /> {lead.sourceUrl}<ExternalLink size={10} /></a></dd></div>}
              <div className="col-span-2"><dt className="text-slate-400">Click ID <span className="text-slate-300">(how Meta matches events to this ad)</span></dt>
                <dd className="font-mono text-[10.5px] text-slate-600 flex items-center gap-1.5 break-all">{lead.ctwaClid || 'Not provided by Meta'}{lead.ctwaClid && <button onClick={copyClid} aria-label="Copy click id" className="text-slate-400 hover:text-slate-700">{copied ? <Check size={12} className="text-emerald-500" /> : <Copy size={12} />}</button>}</dd></div>
            </dl>
          </Card>

          <Card title="Journey" sub="From seeing the ad to becoming a customer" bodyClass="px-4 py-4">
            <ol className="relative">
              {steps.map((s, i) => (
                <li key={s.key} className="flex gap-3 pb-4 last:pb-0 relative">
                  {i < steps.length - 1 && <span className="absolute left-[5px] top-3 bottom-0 w-px bg-slate-200" aria-hidden />}
                  <span className={clsx('w-[11px] h-[11px] rounded-full mt-1 flex-shrink-0 ring-4 ring-white z-[1]', TONE[s.tone])} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline gap-2"><p className="text-xs font-semibold text-slate-800">{s.title}</p>{s.when && <span className="text-[10.5px] text-slate-400 whitespace-nowrap ml-auto">{s.when}</span>}</div>
                    {s.detail && <p className="text-[11px] text-slate-500 mt-0.5 leading-relaxed break-words">{s.detail}</p>}
                  </div>
                </li>
              ))}
            </ol>
          </Card>

          {messages.length > 0 && (
            <Card title="Conversation" sub={`${messages.length} items`} bodyClass="p-4 bg-slate-50/60 max-h-[360px] overflow-y-auto space-y-2">
              {messages.filter((m) => !(m.type === 'event' && m.event === 'ctwa_entry')).map((m) => <Bubble key={m.id} m={m} />)}
            </Card>
          )}

          <Card title="Sent to Meta" sub={mode === 'sample' ? 'Sample mode: events are test records only' : 'Conversion events for this lead'} bodyClass="">
            {!lead.events.length ? <p className="px-4 py-5 text-xs text-slate-400">Nothing sent yet. Tell Meta when this lead becomes a qualified lead or buys.</p> : (
              <table className="w-full text-xs">
                <tbody>
                  {[...lead.events].sort((a, b) => b.at.localeCompare(a.at)).map((e, i) => (
                    <tr key={i} className="border-b border-surface-border/60 last:border-0">
                      <td className="px-4 py-2.5 font-semibold text-slate-700">{e.eventName}</td>
                      <td className="px-2 py-2.5 text-slate-600 tabular-nums">{e.value != null ? `${e.currency || ''} ${e.value}` : '—'}</td>
                      <td className="px-2 py-2.5"><span className={clsx('inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold', e.status === 'failed' ? 'bg-red-50 text-red-600' : e.status === 'simulated' ? 'bg-amber-50 text-amber-700' : 'bg-emerald-50 text-emerald-700')}>{e.status === 'failed' ? 'Failed' : e.status === 'simulated' ? 'Test' : 'Sent'}</span>{e.error && <p className="text-[10px] text-red-500 mt-0.5">{e.error}</p>}</td>
                      <td className="px-4 py-2.5 text-right text-slate-400 whitespace-nowrap">{fmt(e.at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Card>
        </div>
      </Drawer>
      {dialog && <EventDialog lead={lead} initial={dialog} currency={currency} onClose={() => setDialog(null)} onSent={sent} />}
    </>
  )
}
