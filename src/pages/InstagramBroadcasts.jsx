// InstagramBroadcasts.jsx — bulk outreach on Instagram, built to what Meta's
// Messaging API actually permits rather than to WhatsApp's broadcast model.
//
// WhatsApp can message anyone opted-in at any time using an approved template.
// Instagram cannot. Per Meta's docs (checked October 2026):
//   - A business may message a user only within 24 hours of that user's last
//     message to it. There are no approved templates that reopen a closed window.
//   - The HUMAN_AGENT tag stretches that to 7 days, but only for a real person
//     handling a support case — never for automated or promotional sends.
//   - One-Time Notifications and Sponsored Messages are Messenger-only, and
//     Recurring Notifications / Marketing Messages ended on 10 Feb 2026.
//   - A private reply to a comment is the one supported way to start a DM
//     with someone who has not messaged first: ONE text message per comment,
//     within 7 days of the comment.
// So an Instagram "broadcast" here is (1) a DM to contacts whose window is
// still open, with everyone else skipped and counted rather than silently
// dropped, and (2) private replies to recent comments on a post.
import { useState, useMemo } from 'react'
import clsx from 'clsx'
import {
  Radio, Send, Clock, Users, CheckCircle2, AlertCircle, MessageCircle, FileText,
  CalendarClock, ShieldCheck, Eye, Reply,
} from 'lucide-react'
import { NativeSelect } from '../components/Select'
import { INIT_CONTACTS, INIT_GROUPS } from './InstagramContacts'
import { InstagramTemplateComposer } from './InstagramInbox'

const HOUR = 3600000
const WINDOW_MS = 24 * HOUR
const COMMENT_WINDOW_MS = 7 * 24 * HOUR
const TEXT_MAX = 1000

/* Whether a DM sent at `at` still lands: opted-out contacts never do, and
   everyone else only while their 24h window (from their last message) is open.
   Evaluated at the SEND time, not now — a scheduled broadcast can outlive the
   window of someone who is eligible today. */
function windowState(contact, at) {
  if (contact.status !== 'active') return { key: 'optout', label: 'Unsubscribed' }
  const left = new Date(contact.last).getTime() + WINDOW_MS - at
  if (left <= 0) return { key: 'expired', label: 'Window closed' }
  const h = Math.floor(left / HOUR), m = Math.floor((left % HOUR) / 60000)
  return { key: 'eligible', label: h > 0 ? `${h}h ${m}m left` : `${m}m left` }
}

const CHIP = {
  eligible: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  expired:  'bg-amber-50 text-amber-700 border-amber-200',
  optout:   'bg-slate-100 text-slate-500 border-slate-200',
}

const POSTS = [
  { id: 'p1', title: 'Summer collection reel', comments: [
    { id: 'c1', user: '@meera.creates', text: 'Love this! Where can I buy?', ageH: 3,  replied: false },
    { id: 'c2', user: '@ananya.rao',    text: 'Is the blue one in stock?',   ageH: 20, replied: false },
    { id: 'c3', user: '@pooja.reddy',   text: 'Price please 😍',             ageH: 70, replied: true  },
    { id: 'c4', user: '@rohit.s',       text: 'Shipping to Mumbai?',         ageH: 200, replied: false },
  ] },
  { id: 'p2', title: 'Flash sale carousel', comments: [
    { id: 'c5', user: '@karthik.iyer',  text: 'Code?',                       ageH: 30, replied: false },
    { id: 'c6', user: '@sneha.kapoor',  text: 'Does this ship to Delhi?',    ageH: 52, replied: false },
  ] },
  { id: 'p3', title: 'Behind the scenes story', comments: [
    { id: 'c7', user: '@vikram.singh',  text: 'Nice!',                       ageH: 400, replied: false },
  ] },
]

const SEED_HISTORY = [
  { id: 'h1', name: 'Weekend restock alert', type: 'dm', kind: 'Card carousel', audience: 'VIP Customers',
    at: Date.now() - 2 * 86400000, status: 'sent', targeted: 18, skipped: 11, sent: 7, delivered: 7, seen: 5, replies: 2 },
  { id: 'h2', name: 'Reel comment follow-up', type: 'comments', kind: 'Private reply', audience: 'Summer collection reel',
    at: Date.now() - 4 * 86400000, status: 'sent', targeted: 9, skipped: 3, sent: 6, delivered: 6, seen: 4, replies: 3 },
]

function summarize(t) {
  if (!t) return ''
  if (t.kind === 'generic') return `Card${t.elements.length > 1 ? ` carousel · ${t.elements.length} cards` : ''} · ${t.elements[0]?.title || ''}`
  return `Button template · ${t.text.slice(0, 40)}`
}

function Stat({ label, value, tone }) {
  return (
    <div className={clsx('rounded-lg border px-3 py-2', tone)}>
      <p className="text-lg font-bold leading-none">{value}</p>
      <p className="text-[10px] font-medium mt-1 opacity-80">{label}</p>
    </div>
  )
}

export default function InstagramBroadcasts() {
  const [tab, setTab] = useState('dm')
  const [history, setHistory] = useState(SEED_HISTORY)
  const [toast, setToast] = useState('')

  // DM broadcast
  const [name, setName] = useState('')
  const [segment, setSegment] = useState('all')
  const [mode, setMode] = useState('text') // 'text' | 'template'
  const [text, setText] = useState('')
  const [template, setTemplate] = useState(null)
  const [showComposer, setShowComposer] = useState(false)
  const [when, setWhen] = useState('now') // 'now' | 'later'
  const [laterAt, setLaterAt] = useState(() => new Date(Date.now() + 2 * HOUR - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16))

  // Comment campaign
  const [postId, setPostId] = useState('p1')
  const [replyText, setReplyText] = useState('')

  const sendAt = when === 'later' ? new Date(laterAt).getTime() : Date.now()

  const segments = useMemo(() => {
    const tags = [...new Set(INIT_CONTACTS.flatMap(c => c.tags))]
    return [
      { value: 'all', label: 'All contacts', fn: () => true },
      ...INIT_GROUPS.map(g => ({ value: `g:${g.id}`, label: `Group · ${g.name}`, fn: c => c.groupIds.includes(g.id) })),
      ...tags.map(t => ({ value: `t:${t}`, label: `Tag · ${t}`, fn: c => c.tags.includes(t) })),
    ]
  }, [])
  const seg = segments.find(s => s.value === segment) || segments[0]

  const audience = useMemo(
    () => INIT_CONTACTS.filter(seg.fn).map(c => ({ c, w: windowState(c, sendAt) })),
    [seg, sendAt],
  )
  const eligible = audience.filter(a => a.w.key === 'eligible')
  const expired = audience.filter(a => a.w.key === 'expired').length
  const optout = audience.filter(a => a.w.key === 'optout').length

  const contentReady = mode === 'text' ? text.trim().length > 0 : Boolean(template)
  const canSendDm = name.trim() && contentReady && eligible.length > 0 && (when === 'now' || sendAt > Date.now())

  function record(rec) {
    setHistory(h => [rec, ...h])
    setTab('history')
  }
  function sendDm() {
    if (!canSendDm) return
    const n = eligible.length
    const now = when === 'now'
    record({
      id: `h${Date.now()}`, name: name.trim(), type: 'dm',
      kind: mode === 'text' ? 'Text' : (template.kind === 'generic' ? 'Card' : 'Button template'),
      audience: seg.label, at: sendAt, status: now ? 'sent' : 'scheduled',
      targeted: audience.length, skipped: expired + optout, sent: n,
      delivered: now ? n : 0, seen: now ? Math.round(n * 0.6) : 0, replies: now ? Math.round(n * 0.2) : 0,
    })
    setToast(now ? `Sent to ${n} contact${n === 1 ? '' : 's'} · ${expired + optout} skipped` : `Scheduled for ${new Date(sendAt).toLocaleString()}`)
    setName(''); setText(''); setTemplate(null)
    setTimeout(() => setToast(''), 4000)
  }

  const post = POSTS.find(p => p.id === postId)
  const commentRows = post.comments.map(cm => {
    const age = cm.ageH * HOUR
    const state = cm.replied ? 'replied' : age >= COMMENT_WINDOW_MS ? 'old' : 'ok'
    return { cm, state }
  })
  const replyable = commentRows.filter(r => r.state === 'ok')

  function sendReplies() {
    if (!replyText.trim() || replyable.length === 0) return
    record({
      id: `h${Date.now()}`, name: `Private replies · ${post.title}`, type: 'comments', kind: 'Private reply', audience: post.title,
      at: Date.now(), status: 'sent', targeted: post.comments.length, skipped: post.comments.length - replyable.length,
      sent: replyable.length, delivered: replyable.length, seen: Math.round(replyable.length * 0.6), replies: Math.round(replyable.length * 0.3),
    })
    setToast(`Sent ${replyable.length} private repl${replyable.length === 1 ? 'y' : 'ies'}`)
    setReplyText('')
    setTimeout(() => setToast(''), 4000)
  }

  return (
    <div className="space-y-4 animate-fade-in max-w-5xl">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center text-white flex-shrink-0"
            style={{ background: 'linear-gradient(135deg,#f9ce34,#ee2a7b,#6228d7)' }}>
            <Radio size={18}/>
          </div>
          <div>
            <h1 className="text-base font-bold text-slate-900">Instagram Broadcasts</h1>
            <p className="text-xs text-slate-500 mt-0.5">Reach people inside Meta's messaging window — and nobody outside it.</p>
          </div>
        </div>
        {toast && (
          <span className="flex items-center gap-1.5 text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-3 py-1.5 rounded-lg">
            <CheckCircle2 size={13}/> {toast}
          </span>
        )}
      </div>

      <div className="flex items-start gap-2.5 p-3 rounded-xl bg-blue-50 border border-blue-100">
        <ShieldCheck size={14} className="text-blue-500 flex-shrink-0 mt-0.5"/>
        <div className="text-[11.5px] text-blue-900 leading-relaxed">
          <p className="font-semibold mb-0.5">How Instagram broadcasts differ from WhatsApp</p>
          Instagram only lets you message someone within <b>24 hours of their last message to you</b>. There are no approved
          templates to reopen a closed window, and One-Time and Recurring Notifications don't exist on Instagram. Contacts whose
          window has closed are skipped and counted — never queued. To start a conversation with someone who hasn't messaged
          first, use a <b>private reply to their comment</b> (one per comment, within 7 days).
        </div>
      </div>

      <div className="flex gap-1 border-b border-surface-border">
        {[['dm', 'DM broadcast', Send], ['comments', 'Comment replies', MessageCircle], ['history', `History (${history.length})`, Clock]].map(([id, label, Icon]) => (
          <button key={id} onClick={() => setTab(id)}
            className={clsx('flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold border-b-2 -mb-px transition-colors',
              tab === id ? 'border-primary text-primary' : 'border-transparent text-slate-500 hover:text-slate-700')}>
            <Icon size={13}/> {label}
          </button>
        ))}
      </div>

      {tab === 'dm' && (
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
          <div className="lg:col-span-3 bg-white border border-surface-border rounded-xl p-4 space-y-4">
            <div>
              <label className="label">Broadcast name</label>
              <input className="input mt-1" value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Weekend restock alert"/>
            </div>

            <div>
              <label className="label">Audience</label>
              <div className="mt-1"><NativeSelect value={segment} onChange={e => setSegment(e.target.value)}>
                {segments.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
              </NativeSelect></div>
            </div>

            <div>
              <label className="label">Message</label>
              <div className="flex gap-1.5 mt-1 mb-2">
                {[['text', 'Text'], ['template', 'Card / Button template']].map(([k, l]) => (
                  <button key={k} onClick={() => setMode(k)}
                    className={clsx('px-3 py-1.5 rounded-lg text-[11px] font-semibold transition-colors',
                      mode === k ? 'bg-primary text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200')}>{l}</button>
                ))}
              </div>
              {mode === 'text' ? (
                <>
                  <textarea className="textarea w-full text-xs" rows={4} value={text} maxLength={TEXT_MAX}
                    onChange={e => setText(e.target.value)} placeholder="Hi! Your order update…"/>
                  <p className="text-[10px] text-slate-400 text-right mt-0.5">{text.length}/{TEXT_MAX}</p>
                </>
              ) : (
                <div className="flex items-center gap-2 p-3 rounded-lg border border-dashed border-surface-border">
                  <FileText size={15} className="text-slate-400 flex-shrink-0"/>
                  <p className="flex-1 min-w-0 text-xs text-slate-600 truncate">{template ? summarize(template) : 'No template built yet'}</p>
                  <button onClick={() => setShowComposer(true)} className="btn-secondary text-xs flex-shrink-0">
                    {template ? 'Edit' : 'Build template'}
                  </button>
                </div>
              )}
            </div>

            <div>
              <label className="label">When</label>
              <div className="flex items-center gap-2 mt-1 flex-wrap">
                {[['now', 'Send now'], ['later', 'Schedule']].map(([k, l]) => (
                  <button key={k} onClick={() => setWhen(k)}
                    className={clsx('px-3 py-1.5 rounded-lg text-[11px] font-semibold transition-colors',
                      when === k ? 'bg-primary text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200')}>{l}</button>
                ))}
                {when === 'later' && (
                  <input type="datetime-local" value={laterAt} onChange={e => setLaterAt(e.target.value)} className="input-sm"/>
                )}
              </div>
              {when === 'later' && (
                <p className="flex items-start gap-1.5 text-[10.5px] text-slate-500 mt-2">
                  <CalendarClock size={12} className="flex-shrink-0 mt-0.5"/>
                  Eligibility is checked for that moment — contacts whose window will have closed by then are excluded from the count.
                </p>
              )}
            </div>

            <button onClick={sendDm} disabled={!canSendDm}
              className={clsx('w-full justify-center', canSendDm ? 'btn-primary' : 'btn-secondary opacity-50 cursor-not-allowed')}>
              <Send size={14}/> {when === 'now' ? 'Send' : 'Schedule'} to {eligible.length} contact{eligible.length === 1 ? '' : 's'}
            </button>
          </div>

          <div className="lg:col-span-2 bg-white border border-surface-border rounded-xl p-4 space-y-3 self-start">
            <p className="text-xs font-bold text-slate-800 flex items-center gap-1.5"><Users size={13}/> Who will receive it</p>
            <div className="grid grid-cols-3 gap-2">
              <Stat label="Will receive" value={eligible.length} tone="bg-emerald-50 border-emerald-200 text-emerald-700"/>
              <Stat label="Window closed" value={expired} tone="bg-amber-50 border-amber-200 text-amber-700"/>
              <Stat label="Unsubscribed" value={optout} tone="bg-slate-50 border-slate-200 text-slate-600"/>
            </div>
            <div className="divide-y divide-surface-border max-h-72 overflow-y-auto">
              {audience.length === 0 && <p className="text-xs text-slate-400 py-3 text-center">No contacts in this audience</p>}
              {audience.map(({ c, w }) => (
                <div key={c.id} className="flex items-center gap-2 py-2">
                  <div className="w-7 h-7 rounded-full bg-slate-100 text-slate-600 text-[10px] font-bold flex items-center justify-center flex-shrink-0">{c.avatar}</div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-semibold text-slate-800 truncate">{c.name}</p>
                    <p className="text-[10px] text-slate-400 truncate">{c.handle}</p>
                  </div>
                  <span className={clsx('text-[10px] font-semibold px-2 py-0.5 rounded-full border flex-shrink-0', CHIP[w.key])}>{w.label}</span>
                </div>
              ))}
            </div>
            {expired > 0 && (
              <p className="flex items-start gap-1.5 text-[10.5px] text-amber-700 bg-amber-50 border border-amber-100 rounded-lg p-2">
                <AlertCircle size={12} className="flex-shrink-0 mt-0.5"/>
                {expired} contact{expired === 1 ? ' last messaged' : 's last messaged'} you over 24 hours ago, so Instagram won't deliver to them.
                They'll be reachable again as soon as they message you.
              </p>
            )}
          </div>
        </div>
      )}

      {tab === 'comments' && (
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
          <div className="lg:col-span-3 bg-white border border-surface-border rounded-xl p-4 space-y-4">
            <div>
              <label className="label">Post</label>
              <div className="mt-1"><NativeSelect value={postId} onChange={e => setPostId(e.target.value)}>
                {POSTS.map(p => <option key={p.id} value={p.id}>{p.title} · {p.comments.length} comments</option>)}
              </NativeSelect></div>
            </div>
            <div>
              <label className="label">Private reply</label>
              <textarea className="textarea w-full text-xs mt-1" rows={4} value={replyText} maxLength={TEXT_MAX}
                onChange={e => setReplyText(e.target.value)} placeholder="Thanks for the comment! Here's the link you asked about…"/>
              <p className="text-[10px] text-slate-400 mt-0.5">Text only — Instagram doesn't allow cards or buttons in a private reply. {replyText.length}/{TEXT_MAX}</p>
            </div>
            <button onClick={sendReplies} disabled={!replyText.trim() || replyable.length === 0}
              className={clsx('w-full justify-center', replyText.trim() && replyable.length ? 'btn-primary' : 'btn-secondary opacity-50 cursor-not-allowed')}>
              <Reply size={14}/> Send {replyable.length} private repl{replyable.length === 1 ? 'y' : 'ies'}
            </button>
          </div>
          <div className="lg:col-span-2 bg-white border border-surface-border rounded-xl p-4 space-y-2 self-start">
            <p className="text-xs font-bold text-slate-800">Comments on this post</p>
            <p className="text-[10.5px] text-slate-500">One private reply per comment, within 7 days of it being posted.</p>
            <div className="divide-y divide-surface-border">
              {commentRows.map(({ cm, state }) => (
                <div key={cm.id} className="py-2">
                  <div className="flex items-center gap-2">
                    <p className="text-xs font-semibold text-slate-800 flex-1 truncate">{cm.user}</p>
                    <span className={clsx('text-[10px] font-semibold px-2 py-0.5 rounded-full border flex-shrink-0',
                      state === 'ok' ? CHIP.eligible : state === 'old' ? CHIP.expired : CHIP.optout)}>
                      {state === 'ok' ? 'Can reply' : state === 'old' ? 'Over 7 days' : 'Already replied'}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 mt-0.5 truncate">{cm.text}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {tab === 'history' && (
        <div className="bg-white border border-surface-border rounded-xl overflow-hidden">
          <div className="hidden md:grid grid-cols-12 gap-2 px-4 py-2.5 bg-slate-50 border-b border-surface-border text-[10px] font-bold text-slate-400 uppercase tracking-wider">
            <span className="col-span-4">Broadcast</span><span className="col-span-2">Status</span>
            <span className="col-span-1 text-right">Targeted</span><span className="col-span-1 text-right">Skipped</span>
            <span className="col-span-1 text-right">Sent</span><span className="col-span-1 text-right">Seen</span>
            <span className="col-span-2 text-right">Replies</span>
          </div>
          {history.map(h => (
            <div key={h.id} className="grid grid-cols-2 md:grid-cols-12 gap-2 px-4 py-3 border-b border-surface-border last:border-0 items-center">
              <div className="col-span-2 md:col-span-4 min-w-0">
                <p className="text-xs font-semibold text-slate-800 truncate">{h.name}</p>
                <p className="text-[10.5px] text-slate-400 truncate">{h.kind} · {h.audience} · {new Date(h.at).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}</p>
              </div>
              <div className="md:col-span-2">
                <span className={clsx('text-[10px] font-bold px-2 py-0.5 rounded-full border',
                  h.status === 'sent' ? CHIP.eligible : CHIP.expired)}>
                  {h.status === 'sent' ? 'Sent' : 'Scheduled'}
                </span>
              </div>
              <span className="md:col-span-1 md:text-right text-xs text-slate-600">{h.targeted}<span className="md:hidden text-slate-400"> targeted</span></span>
              <span className="md:col-span-1 md:text-right text-xs text-amber-600">{h.skipped}<span className="md:hidden text-slate-400"> skipped</span></span>
              <span className="md:col-span-1 md:text-right text-xs text-slate-800 font-semibold">{h.sent}<span className="md:hidden text-slate-400 font-normal"> sent</span></span>
              <span className="md:col-span-1 md:text-right text-xs text-slate-600 flex items-center md:justify-end gap-1"><Eye size={11} className="text-slate-300"/>{h.seen}</span>
              <span className="md:col-span-2 md:text-right text-xs text-slate-600">{h.replies}<span className="md:hidden text-slate-400"> replies</span></span>
            </div>
          ))}
        </div>
      )}

      {showComposer && (
        <InstagramTemplateComposer
          onClose={() => setShowComposer(false)}
          onSend={payload => { setTemplate(payload); setShowComposer(false) }}
          title="Build broadcast template" submitLabel="Use this template"
        />
      )}
    </div>
  )
}
