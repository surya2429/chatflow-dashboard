// IgCampaignWizard.jsx — "New Campaign" for Instagram. Same five-step modal as
// WhatsApp (Template → Audience → Personalise → Schedule → Review) with the
// Instagram rules baked in: a DM only reaches contacts inside their 24-hour
// window at the moment of sending, and a comment campaign is private replies
// (one text per comment, within 7 days).
import { useState, useMemo, useRef } from 'react'
import igPortal from './igPortal'
import clsx from 'clsx'
import {
  X, Check, Search, FileText, Users, Wand2, Calendar, CheckCircle2, Send,
  AlertCircle, CalendarClock, Loader2, Info, Reply, Pencil, Plus,
} from 'lucide-react'
import { NativeSelect } from '../Select'
import IgDmPreview from './IgDmPreview'
import IgTemplateBuilder from './IgTemplateBuilder'
import { CustomMessageEditor, emptyDraft, draftToTemplate, draftProblems } from './IgEditors'
import {
  HOUR, TOKENS, KINDS, POSTS, isPlainText, tokensIn, personalizeTemplate, summarize, windowState, commentState,
} from './igTemplateKit'

export const CHIP = {
  eligible: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  expired:  'bg-amber-50 text-amber-700 border-amber-200',
  optout:   'bg-slate-100 text-slate-500 border-slate-200',
}

const STEPS = [
  { label: 'Template',    icon: FileText },
  { label: 'Audience',    icon: Users },
  { label: 'Personalise', icon: Wand2 },
  { label: 'Schedule',    icon: Calendar },
  { label: 'Review',      icon: CheckCircle2 },
]

const KIND_DOT = { generic: 'bg-pink-50 text-pink-500', product: 'bg-amber-50 text-amber-500', button: 'bg-violet-50 text-violet-500', text: 'bg-sky-50 text-sky-500' }
const localIso = ms => new Date(ms - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16)

function Stat({ label, value, tone }) {
  return (
    <div className={clsx('rounded-lg border px-3 py-2', tone)}>
      <p className="text-lg font-bold leading-none tabular-nums">{value}</p>
      <p className="text-[10px] font-medium mt-1 opacity-80">{label}</p>
    </div>
  )
}

export default function IgCampaignWizard({ templates, contacts, groups, initialTemplate = null, onClose, onCreated, onSaveTemplate }) {
  const [step, setStep] = useState(initialTemplate ? 1 : 0)
  const [type, setType] = useState('dm') // 'dm' | 'comments'
  const [tplPicked, setTplPicked] = useState(initialTemplate)
  const [source, setSource] = useState('template') // 'template' | 'custom'
  const [draft, setDraft] = useState(emptyDraft)
  const [showBuilder, setShowBuilder] = useState(false)
  const [saveAsTpl, setSaveAsTpl] = useState(false)
  const focusRef = useRef(null)
  const [tplSearch, setTplSearch] = useState('')
  const [segment, setSegment] = useState('all')
  const [postId, setPostId] = useState(POSTS[0].id)
  const [fallbacks, setFallbacks] = useState({ first_name: 'there', name: 'there', handle: '', city: '' })
  const [name, setName] = useState('')
  const [when, setWhen] = useState('now')
  const [laterAt, setLaterAt] = useState(() => localIso(Date.now() + 2 * HOUR))
  const [launching, setLaunching] = useState(false)
  const [launched, setLaunched] = useState(false)

  const dm = type === 'dm'
  // A custom message is an unsaved text template, so everything downstream
  // (personalise, preview, send) treats both sources the same way.
  const tpl = source === 'custom' ? draftToTemplate(draft, !dm) : tplPicked
  const customProblems = source === 'custom' ? draftProblems(draft, !dm) : []
  const sendAt = when === 'later' ? new Date(laterAt).getTime() : Date.now()

  const tplList = useMemo(() => {
    const q = tplSearch.trim().toLowerCase()
    return templates.filter(t => t.status === 'ready' && (dm || isPlainText(t)) &&
      (!q || t.name.toLowerCase().includes(q) || summarize(t).toLowerCase().includes(q)))
  }, [templates, tplSearch, dm])

  const segments = useMemo(() => {
    const tags = [...new Set(contacts.flatMap(c => c.tags))]
    return [
      { value: 'all', label: 'All contacts', kind: 'Everyone', fn: () => true },
      ...groups.map(g => ({ value: `g:${g.id}`, label: g.name, kind: 'Group', fn: c => c.groupIds.includes(g.id) })),
      ...tags.map(t => ({ value: `t:${t}`, label: t, kind: 'Tag', fn: c => c.tags.includes(t) })),
    ]
  }, [contacts, groups])
  const seg = segments.find(s => s.value === segment) || segments[0]

  const rows = useMemo(
    () => contacts.filter(seg.fn).map(c => ({ c, w: windowState(c, sendAt) })),
    [contacts, seg, sendAt],
  )
  const eligible = rows.filter(r => r.w.key === 'eligible')
  const expired = rows.filter(r => r.w.key === 'expired').length
  const optout = rows.filter(r => r.w.key === 'optout').length
  const segCount = s => {
    const list = contacts.filter(s.fn)
    return { total: list.length, ok: list.filter(c => windowState(c, sendAt).key === 'eligible').length }
  }

  const post = POSTS.find(p => p.id === postId)
  const commentRows = post.comments.map(cm => ({ cm, state: commentState(cm) }))
  const replyable = commentRows.filter(r => r.state === 'ok')

  const reach = dm ? eligible.length : replyable.length
  const targeted = dm ? rows.length : post.comments.length
  const audienceLabel = dm ? `${seg.kind === 'Everyone' ? '' : `${seg.kind} · `}${seg.label}` : post.title
  const tokens = tokensIn(tpl)
  const sampleRecipients = dm
    ? eligible.slice(0, 3).map(r => r.c)
    : replyable.slice(0, 3).map(r => ({ name: r.cm.user.replace('@', '').replace(/[._]/g, ' ').replace(/\b\w/g, ch => ch.toUpperCase()), handle: r.cm.user, city: '' }))

  function pickType(t) {
    if (t === type) return
    setType(t)
    if (tplPicked && t === 'comments' && !isPlainText(tplPicked)) setTplPicked(null)
    if (t === 'comments') setWhen('now')
  }

  const scheduleOk = !!name.trim() && (when === 'now' || sendAt > Date.now())
  const canNext = [!!tpl && customProblems.length === 0 && (dm || isPlainText(tpl)), reach > 0, true, scheduleOk, true][step]

  function next() {
    if (step === 2 && !name.trim() && tpl) {
      setName(`${tpl.name} · ${new Date().toLocaleDateString([], { day: 'numeric', month: 'short' })}`)
    }
    setStep(s => s + 1)
  }

  async function launch() {
    setLaunching(true)
    await new Promise(r => setTimeout(r, 1200))
    const now = when === 'now'
    if (source === 'custom' && saveAsTpl && onSaveTemplate) onSaveTemplate({ ...tpl, name: name.trim() })
    const contactsOut = dm
      ? rows.map(r => ({ name: r.c.name, handle: r.c.handle, outcome: r.w.key === 'eligible' ? 'sent' : r.w.key }))
      : commentRows.map(r => ({ name: r.cm.user.replace('@', ''), handle: r.cm.user, outcome: r.state === 'ok' ? 'sent' : r.state === 'old' ? 'expired' : 'optout' }))
    onCreated({
      id: `c_${Date.now()}`, name: name.trim(), type,
      template: tpl, fallbacks,
      audienceLabel, sendAt: sendAt, date: new Date(sendAt).toISOString(),
      targeted, planned: reach,
      skippedExpired: dm ? expired : post.comments.length - replyable.length - commentRows.filter(r => r.state === 'replied').length,
      skippedOptout: dm ? optout : commentRows.filter(r => r.state === 'replied').length,
      sent: 0, delivered: 0, seen: 0, replied: 0, failed: 0, clicks: 0,
      status: now ? 'Sending' : 'Scheduled',
      contacts: contactsOut,
    })
    setLaunching(false)
    setLaunched(true)
    setTimeout(onClose, 1500)
  }

  if (showBuilder) {
    return igPortal(
      <IgTemplateBuilder initial={null} onBack={() => setShowBuilder(false)}
        onSave={t => {
          const saved = onSaveTemplate ? onSaveTemplate(t) : t
          setTplPicked(saved)
          setSource('template')
          setShowBuilder(false)
        }}/>,
    )
  }

  return igPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(2px)' }}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl flex flex-col overflow-hidden" style={{ maxHeight: 'calc(100vh - 48px)' }}>

        <div className="flex items-center justify-between px-6 py-4 border-b border-surface-border flex-shrink-0">
          <div>
            <h2 className="text-sm font-bold text-slate-900">Create New Campaign</h2>
            <p className="text-[11px] text-slate-400 mt-0.5">Step {step + 1} of {STEPS.length} — {STEPS[step].label}</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-surface-hover transition-colors"><X size={16}/></button>
        </div>

        <div className="flex items-center px-6 py-3.5 border-b border-surface-border bg-slate-50/50 flex-shrink-0">
          {STEPS.map((s, i) => {
            const done = i < step, current = i === step
            return (
              <div key={s.label} className="flex items-center flex-1 last:flex-none min-w-0">
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  <div className={clsx('w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold transition-all flex-shrink-0',
                    done ? 'bg-primary text-white' : current ? 'bg-primary text-white ring-4 ring-primary/20' : 'bg-slate-100 text-slate-400')}>
                    {done ? <Check size={11}/> : i + 1}
                  </div>
                  <span className={clsx('text-[11px] font-semibold hidden sm:block', current ? 'text-slate-900' : done ? 'text-slate-500' : 'text-slate-400')}>{s.label}</span>
                </div>
                {i < STEPS.length - 1 && <div className={clsx('flex-1 h-px mx-2 transition-all', i < step ? 'bg-primary' : 'bg-slate-200')}/>}
              </div>
            )
          })}
        </div>

        <div className="flex-1 overflow-y-auto min-h-0">

          {/* STEP 0 — Template */}
          {step === 0 && (
            <div className="flex flex-col h-full" style={{ minHeight: 420 }}>
              <div className="px-4 pt-4 pb-3 border-b border-surface-border flex-shrink-0">
                <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-2">Campaign type</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {[
                    ['dm', 'Direct messages', 'Message contacts who wrote to you in the last 24 hours', Send],
                    ['comments', 'Comment replies', 'Privately reply to comments on a post — one text each, within 7 days', Reply],
                  ].map(([k, l, d, Icon]) => (
                    <button key={k} onClick={() => pickType(k)}
                      className={clsx('flex items-start gap-2.5 text-left p-3 rounded-xl border-2 transition-all',
                        type === k ? 'border-primary bg-primary/5' : 'border-surface-border hover:border-slate-300')}>
                      <span className={clsx('w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0', type === k ? 'bg-primary text-white' : 'bg-slate-100 text-slate-500')}><Icon size={14}/></span>
                      <span className="min-w-0">
                        <span className="block text-xs font-bold text-slate-900">{l}</span>
                        <span className="block text-[11px] text-slate-500 leading-snug mt-0.5">{d}</span>
                      </span>
                    </button>
                  ))}
                </div>
              </div>
              <div className="px-4 py-2.5 border-b border-surface-border flex items-center gap-3 flex-shrink-0 flex-wrap">
                <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Message</p>
                <div className="flex items-center gap-0.5 bg-slate-100 p-1 rounded-xl">
                  {[['template', 'Use a template', FileText], ['custom', 'Write a custom message', Pencil]].map(([k, l, Icon]) => (
                    <button key={k} onClick={() => setSource(k)}
                      className={clsx('flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition-all whitespace-nowrap',
                        source === k ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700')}>
                      <Icon size={12}/> {l}
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex flex-1 min-h-0">
                {source === 'custom' ? (
                  <div className="flex-1 min-w-0 border-r border-surface-border p-4 space-y-3 overflow-y-auto">
                    <CustomMessageEditor draft={draft} onChange={setDraft} textOnly={!dm} focusRef={focusRef}/>
                    <label className="flex items-center gap-2 text-xs text-slate-600 cursor-pointer select-none pt-1">
                      <input type="checkbox" className="accent-primary" checked={saveAsTpl} onChange={e => setSaveAsTpl(e.target.checked)}/>
                      Also save this message as a template
                    </label>
                  </div>
                ) : (
                <div className="flex-1 flex flex-col border-r border-surface-border min-w-0">
                  <div className="p-4 border-b border-surface-border flex-shrink-0">
                    <div className="relative">
                      <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"/>
                      <input className="w-full pl-9 pr-4 py-2 text-sm border border-surface-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all placeholder-slate-400"
                        placeholder={dm ? 'Search ready templates…' : 'Search text templates…'} value={tplSearch} onChange={e => setTplSearch(e.target.value)}/>
                    </div>
                    <div className="flex items-center justify-between gap-2 mt-2">
                      <p className="text-[10.5px] text-slate-400">{dm ? 'Need something new — a carousel, product cards, buttons?' : 'Instagram only allows plain text in a private reply, so only plain Text templates are listed.'}</p>
                      <button onClick={() => setShowBuilder(true)} className="flex items-center gap-1 text-[11px] font-semibold text-primary hover:underline whitespace-nowrap flex-shrink-0"><Plus size={11}/> Create template</button>
                    </div>
                  </div>
                  <div className="flex-1 overflow-y-auto divide-y divide-surface-border">
                    {tplList.length === 0 ? (
                      <div className="flex flex-col items-center justify-center h-32 text-slate-300 text-center px-6">
                        <FileText size={24} className="mb-2"/>
                        <p className="text-xs">No matching templates</p>
                        <p className="text-[10.5px] mt-1">Create one from the Templates tab first.</p>
                      </div>
                    ) : tplList.map(t => {
                      const n = tokensIn(t).length
                      return (
                        <div key={t.id} onClick={() => setTplPicked(t)}
                          className={clsx('flex items-start gap-3 px-4 py-3 cursor-pointer transition-colors border-l-2',
                            tpl?.id === t.id ? 'bg-primary/5 border-primary' : 'hover:bg-slate-50 border-transparent')}>
                          <div className={clsx('w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5', KIND_DOT[t.kind])}><FileText size={13}/></div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                              <p className="text-xs font-semibold text-slate-800 truncate">{t.name}</p>
                              <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-slate-100 text-slate-500 flex-shrink-0">{KINDS[t.kind].short}</span>
                              {n > 0 && <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-amber-50 text-amber-600 flex-shrink-0">{n} placeholder{n > 1 ? 's' : ''}</span>}
                            </div>
                            <p className="text-xs text-slate-400 leading-snug line-clamp-2">{summarize(t)}</p>
                          </div>
                          {tpl?.id === t.id && <CheckCircle2 size={15} className="text-primary flex-shrink-0 mt-1"/>}
                        </div>
                      )
                    })}
                  </div>
                </div>
                )}
                <div className="w-52 flex-shrink-0 p-4 bg-slate-50 flex flex-col items-center overflow-y-auto">
                  <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-3 w-full">Preview</p>
                  {tpl
                    ? <IgDmPreview template={tpl} scale={0.6}/>
                    : <div className="w-full flex-1 flex flex-col items-center justify-center text-slate-300 text-center py-10"><FileText size={22}/><p className="text-[11px] mt-2">{source === 'custom' ? 'Start typing to preview' : 'Select a template'}</p></div>}
                </div>
              </div>
            </div>
          )}

          {/* STEP 1 — Audience */}
          {step === 1 && dm && (
            <div className="p-5 grid grid-cols-1 md:grid-cols-5 gap-4">
              <div className="md:col-span-2 space-y-2">
                <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Choose an audience</p>
                <div className="space-y-1.5 max-h-80 overflow-y-auto pr-1">
                  {segments.map(s => {
                    const c = segCount(s)
                    return (
                      <button key={s.value} onClick={() => setSegment(s.value)}
                        className={clsx('w-full flex items-center gap-3 px-3 py-2.5 rounded-xl border-2 text-left transition-all',
                          segment === s.value ? 'border-primary bg-primary/5' : 'border-surface-border hover:border-slate-300')}>
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-semibold text-slate-800 truncate">{s.label}</p>
                          <p className="text-[10px] text-slate-400">{s.kind}</p>
                        </div>
                        <div className="text-right flex-shrink-0">
                          <p className="text-xs font-bold text-emerald-600 tabular-nums">{c.ok}</p>
                          <p className="text-[10px] text-slate-400">of {c.total}</p>
                        </div>
                      </button>
                    )
                  })}
                </div>
              </div>
              <div className="md:col-span-3 space-y-3">
                <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Who will receive it</p>
                <div className="grid grid-cols-3 gap-2">
                  <Stat label="Will receive" value={eligible.length} tone="bg-emerald-50 border-emerald-200 text-emerald-700"/>
                  <Stat label="Window closed" value={expired} tone="bg-amber-50 border-amber-200 text-amber-700"/>
                  <Stat label="Unsubscribed" value={optout} tone="bg-slate-50 border-slate-200 text-slate-600"/>
                </div>
                <div className="divide-y divide-surface-border max-h-56 overflow-y-auto border border-surface-border rounded-xl px-3">
                  {rows.length === 0 && <p className="text-xs text-slate-400 py-4 text-center">No contacts in this audience</p>}
                  {rows.map(({ c, w }) => (
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
                <p className="flex items-start gap-1.5 text-[10.5px] text-slate-500"><Info size={12} className="flex-shrink-0 mt-0.5"/>
                  Counted as of now. If you schedule it for later, this is recalculated for that moment on the Review step.</p>
                {reach === 0 && rows.length > 0 && (
                  <p className="flex items-start gap-1.5 text-[11px] text-amber-700 bg-amber-50 border border-amber-100 rounded-lg p-2">
                    <AlertCircle size={12} className="flex-shrink-0 mt-0.5"/> Nobody in this audience can be messaged right now. Pick another audience.
                  </p>
                )}
              </div>
            </div>
          )}

          {step === 1 && !dm && (
            <div className="p-5 grid grid-cols-1 md:grid-cols-5 gap-4">
              <div className="md:col-span-2 space-y-2">
                <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Choose a post</p>
                <NativeSelect value={postId} onChange={e => setPostId(e.target.value)}>
                  {POSTS.map(p => <option key={p.id} value={p.id}>{p.title} · {p.comments.length} comments</option>)}
                </NativeSelect>
                <div className="grid grid-cols-2 gap-2 pt-1">
                  <Stat label="Can reply" value={replyable.length} tone="bg-emerald-50 border-emerald-200 text-emerald-700"/>
                  <Stat label="Can't reply" value={post.comments.length - replyable.length} tone="bg-amber-50 border-amber-200 text-amber-700"/>
                </div>
                <p className="text-[10.5px] text-slate-500 leading-snug">One private reply per comment, within 7 days of it being posted.</p>
              </div>
              <div className="md:col-span-3">
                <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-2">Comments on this post</p>
                <div className="divide-y divide-surface-border border border-surface-border rounded-xl px-3 max-h-72 overflow-y-auto">
                  {commentRows.map(({ cm, state }) => (
                    <div key={cm.id} className="py-2.5">
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

          {/* STEP 2 — Personalise */}
          {step === 2 && tpl && (
            <div className="flex" style={{ minHeight: 380 }}>
              <div className="flex-1 min-w-0 p-5 space-y-5">
                {tokens.length === 0 ? (
                  <div className="flex items-start gap-2.5 p-3.5 rounded-xl bg-emerald-50 border border-emerald-100">
                    <CheckCircle2 size={15} className="text-emerald-600 flex-shrink-0 mt-0.5"/>
                    <div>
                      <p className="text-xs font-bold text-emerald-800">Nothing to fill in</p>
                      <p className="text-[11.5px] text-emerald-700 mt-0.5">This template has no placeholders, so everyone receives exactly the same message.</p>
                    </div>
                  </div>
                ) : (
                  <>
                    <div>
                      <p className="text-xs font-bold text-slate-800">Fallbacks</p>
                      <p className="text-[11px] text-slate-500 mt-0.5">Instagram doesn't fill placeholders for you — we do, per recipient. If a contact is missing a value, this is used instead.</p>
                    </div>
                    <div className="space-y-3">
                      {tokens.map(k => {
                        const tk = TOKENS.find(x => x.key === k)
                        return (
                          <div key={k} className="grid grid-cols-5 gap-3 items-center">
                            <div className="col-span-2">
                              <span className="text-[11px] font-semibold px-2 py-0.5 rounded bg-amber-50 text-amber-700">{`{{${k}}}`}</span>
                              <p className="text-[10.5px] text-slate-400 mt-1">{tk.label} · e.g. {tk.sample}</p>
                            </div>
                            <input className="input col-span-3 text-xs" value={fallbacks[k] ?? ''} placeholder="Fallback text"
                              onChange={e => setFallbacks(f => ({ ...f, [k]: e.target.value }))}/>
                          </div>
                        )
                      })}
                    </div>
                  </>
                )}

                <div>
                  <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-2">How it reads for a few recipients</p>
                  <div className="space-y-1.5">
                    {sampleRecipients.length === 0 && <p className="text-xs text-slate-400">No recipients yet.</p>}
                    {sampleRecipients.map((c, i) => {
                      const p = personalizeTemplate(tpl, c, fallbacks)
                      const line = tpl.kind === 'generic' ? p.elements[0].title : p.text
                      return (
                        <div key={i} className="flex items-start gap-2 p-2.5 rounded-lg border border-surface-border">
                          <span className="text-[11px] font-semibold text-slate-600 w-24 flex-shrink-0 truncate">{c.name}</span>
                          <span className="text-[11.5px] text-slate-500 leading-snug line-clamp-2">{line}</span>
                        </div>
                      )
                    })}
                  </div>
                </div>
              </div>
              <div className="w-52 flex-shrink-0 p-4 bg-slate-50 border-l border-surface-border flex flex-col items-center">
                <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-3 w-full">Preview</p>
                <IgDmPreview template={tpl} scale={0.6} fallbacks={fallbacks}/>
              </div>
            </div>
          )}

          {/* STEP 3 — Schedule */}
          {step === 3 && (
            <div className="p-6 max-w-lg mx-auto space-y-5">
              <div>
                <label className="label">Campaign name</label>
                <input className="input mt-1 w-full" value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Weekend restock alert" autoFocus/>
                <p className="text-[10.5px] text-slate-400 mt-1">Only your team sees this.</p>
              </div>
              <div>
                <label className="label">When to send</label>
                <div className="grid grid-cols-2 gap-2 mt-1">
                  {[['now', 'Send now', 'Goes out immediately', Send], ['later', 'Schedule', dm ? 'Pick a date and time' : 'Not available for comments', CalendarClock]].map(([k, l, d, Icon]) => {
                    const off = k === 'later' && !dm
                    return (
                      <button key={k} disabled={off} onClick={() => setWhen(k)}
                        className={clsx('flex items-start gap-2.5 text-left p-3 rounded-xl border-2 transition-all',
                          when === k ? 'border-primary bg-primary/5' : 'border-surface-border hover:border-slate-300', off && 'opacity-40 cursor-not-allowed')}>
                        <Icon size={15} className={when === k ? 'text-primary mt-0.5' : 'text-slate-400 mt-0.5'}/>
                        <span><span className="block text-xs font-bold text-slate-900">{l}</span><span className="block text-[11px] text-slate-500">{d}</span></span>
                      </button>
                    )
                  })}
                </div>
                {when === 'later' && (
                  <div className="mt-3 space-y-2">
                    <input type="datetime-local" value={laterAt} onChange={e => setLaterAt(e.target.value)} className="input w-full"/>
                    {sendAt <= Date.now() && <p className="text-[11px] text-red-500">Pick a time in the future.</p>}
                    <p className="flex items-start gap-1.5 text-[10.5px] text-slate-500">
                      <CalendarClock size={12} className="flex-shrink-0 mt-0.5"/>
                      Eligibility is checked for that moment — contacts whose 24-hour window will have closed by then are left out.
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* STEP 4 — Review */}
          {step === 4 && tpl && (
            <div className="flex" style={{ minHeight: 380 }}>
              <div className="flex-1 min-w-0 p-5 space-y-4">
                <div className="rounded-xl border border-surface-border divide-y divide-surface-border">
                  {[
                    ['Campaign', name],
                    ['Type', dm ? 'Direct messages' : 'Private replies to comments'],
                    [source === 'custom' ? 'Message' : 'Template', source === 'custom' ? 'Custom message' + (saveAsTpl ? ' (saved as template)' : '') : tpl.name],
                    ['Audience', audienceLabel],
                    ['Sends', when === 'now' ? 'Immediately' : new Date(sendAt).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })],
                  ].map(([k, v]) => (
                    <div key={k} className="flex items-center justify-between gap-4 px-4 py-2.5">
                      <span className="text-[11px] text-slate-400">{k}</span>
                      <span className="text-xs font-semibold text-slate-800 text-right truncate">{v}</span>
                    </div>
                  ))}
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <Stat label={dm ? 'Will receive' : 'Will get a reply'} value={reach} tone="bg-emerald-50 border-emerald-200 text-emerald-700"/>
                  <Stat label={dm ? 'Window closed' : "Can't reply"} value={dm ? expired : post.comments.length - replyable.length - commentRows.filter(r => r.state === 'replied').length} tone="bg-amber-50 border-amber-200 text-amber-700"/>
                  <Stat label={dm ? 'Unsubscribed' : 'Already replied'} value={dm ? optout : commentRows.filter(r => r.state === 'replied').length} tone="bg-slate-50 border-slate-200 text-slate-600"/>
                </div>
                <p className="flex items-start gap-1.5 text-[11px] text-slate-500 leading-snug">
                  <Info size={12} className="flex-shrink-0 mt-0.5"/>
                  Skipped people are counted, never queued — Instagram wouldn't deliver to them. They become reachable again when they message you.
                </p>
              </div>
              <div className="w-52 flex-shrink-0 p-4 bg-slate-50 border-l border-surface-border flex flex-col items-center">
                <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-3 w-full">Preview</p>
                <IgDmPreview template={tpl} scale={0.6} fallbacks={fallbacks}/>
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center justify-between px-6 py-4 border-t border-surface-border flex-shrink-0 bg-white">
          <button onClick={() => (step === 0 ? onClose() : setStep(s => s - 1))} disabled={launching || launched} className="btn-secondary text-xs">
            {step === 0 ? 'Cancel' : 'Back'}
          </button>
          {step < STEPS.length - 1 ? (
            <button onClick={next} disabled={!canNext} className="btn-primary text-xs px-5 disabled:opacity-40">Continue →</button>
          ) : (
            <button onClick={launch} disabled={launching || launched} className="btn-primary text-xs px-5 flex items-center gap-1.5">
              {launched ? <><Check size={13}/> Launched</> : launching ? <><Loader2 size={13} className="animate-spin"/> Launching…</> : <><Send size={12}/> {when === 'now' ? 'Launch campaign' : 'Schedule campaign'}</>}
            </button>
          )}
        </div>
      </div>
    </div>)
}
