// IgTemplateBuilder.jsx — full-screen Instagram template builder.
//
// Same shape as the WhatsApp "Create Template" flow (Setup → Design → Review,
// live phone preview beside the editor), adapted to what Instagram supports:
// no approval step, no categories — instead a Card/Carousel, a Buttons message
// or plain Text, each checked live against Meta's Send API limits.
import { useState, useRef, useMemo } from 'react'
import clsx from 'clsx'
import {
  X, Check, Plus, LayoutGrid, Type, MousePointerClick, Sun, Moon, ShoppingBag,
  Copy, CheckCircle2, Circle, Info, ArrowLeft, ArrowRight, Code2, Smartphone,
  ChevronLeft, ChevronRight, Image as ImageIcon, Save, ShieldCheck,
} from 'lucide-react'
import IgDmPreview from './IgDmPreview'
import { Field, ButtonsEditor, QuickRepliesEditor, MediaEditor, ProductsEditor, TokenBar, insertAtFocus } from './IgEditors'
import {
  LIMITS, KINDS, emptyTemplate, newCard, validateTemplate, toApiPayloads, tokensIn,
} from './igTemplateKit'

const STEPS = ['Setup', 'Design', 'Review']
const KIND_ICON = { generic: LayoutGrid, product: ShoppingBag, button: MousePointerClick, text: Type }
const KIND_TONE = {
  generic: 'bg-pink-50 text-pink-600',
  product: 'bg-amber-50 text-amber-600',
  button:  'bg-violet-50 text-violet-600',
  text:    'bg-sky-50 text-sky-600',
}
const SAMPLE_IMAGES = [
  'https://picsum.photos/seed/igbag/600/314',
  'https://picsum.photos/seed/igshoe/600/314',
  'https://picsum.photos/seed/igwatch/600/314',
  'https://picsum.photos/seed/igcafe/600/314',
]

/* ── small shared pieces ───────────────────────────────────────────────── */
function CheckList({ checks, compact }) {
  return (
    <ul className={clsx('space-y-1.5', compact && 'space-y-1')}>
      {checks.map(c => (
        <li key={c.id} className="flex items-start gap-2">
          {c.ok
            ? <CheckCircle2 size={compact ? 13 : 14} className="text-emerald-500 flex-shrink-0 mt-px"/>
            : <Circle size={compact ? 13 : 14} className="text-slate-300 flex-shrink-0 mt-px"/>}
          <span className={clsx('text-[11.5px] leading-snug', c.ok ? 'text-slate-600' : 'text-slate-800 font-medium')}>{c.label}</span>
        </li>
      ))}
    </ul>
  )
}

/* ── step 1: setup ─────────────────────────────────────────────────────── */
function SetupStep({ t, patch, locked }) {
  return (
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-4xl mx-auto px-5 py-8 space-y-7">
        <div>
          <h2 className="text-base font-bold text-slate-900">Name your template</h2>
          <p className="text-xs text-slate-500 mt-0.5">Only your team sees the name. Customers never do.</p>
          <input className="input w-full mt-3 text-sm" autoFocus value={t.name} maxLength={60}
            onChange={e => patch({ name: e.target.value })} placeholder="e.g. New arrivals carousel"/>
        </div>

        <div>
          <h2 className="text-base font-bold text-slate-900">Choose a format</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            {locked ? "The format can't be changed once a template exists — duplicate it into a new one instead." : 'Instagram supports these message layouts.'}
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mt-3">
            {Object.entries(KINDS).map(([k, info]) => {
              const Icon = KIND_ICON[k]
              const on = t.kind === k
              return (
                <button key={k} type="button" disabled={locked && !on}
                  onClick={() => !locked && patch({ ...emptyTemplate(k), name: t.name, note: t.note, id: t.id })}
                  className={clsx('text-left rounded-2xl border-2 p-4 transition-all',
                    on ? 'border-primary bg-primary/5 shadow-sm' : 'border-surface-border bg-white hover:border-slate-300',
                    locked && !on && 'opacity-40 cursor-not-allowed')}>
                  <div className="flex items-center justify-between mb-3">
                    <span className={clsx('w-9 h-9 rounded-xl flex items-center justify-center', KIND_TONE[k])}><Icon size={17}/></span>
                    {on && <span className="w-5 h-5 rounded-full bg-primary text-white flex items-center justify-center"><Check size={12}/></span>}
                  </div>
                  <p className="text-sm font-bold text-slate-900">{info.label}</p>
                  <p className="text-[11.5px] text-slate-500 mt-1 leading-snug">{info.desc}</p>
                  <div className="flex flex-wrap gap-1 mt-3">
                    {info.rules.map(r => <span key={r} className="text-[9.5px] font-semibold px-1.5 py-0.5 rounded bg-slate-100 text-slate-500">{r}</span>)}
                  </div>
                </button>
              )
            })}
          </div>
        </div>

        <div>
          <h2 className="text-base font-bold text-slate-900">Internal note <span className="text-xs font-normal text-slate-400">(optional)</span></h2>
          <textarea className="textarea w-full mt-2 text-xs" rows={2} value={t.note} maxLength={200}
            onChange={e => patch({ note: e.target.value })} placeholder="When should the team use this?"/>
        </div>

        <div className="flex items-start gap-2.5 p-3.5 rounded-xl bg-blue-50 border border-blue-100">
          <ShieldCheck size={15} className="text-blue-500 flex-shrink-0 mt-0.5"/>
          <p className="text-[11.5px] text-blue-900 leading-relaxed">
            <b>Unlike WhatsApp, Instagram templates aren't submitted to Meta for review</b> — they're ready the moment you save.
            The trade-off: a template can't reopen a closed conversation. It can only be delivered to someone who messaged you in the
            last 24 hours, or used as a private reply to a recent comment (plain text only).
          </p>
        </div>
      </div>
    </div>
  )
}

/* ── step 2: design ────────────────────────────────────────────────────── */
function DesignStep({ t, setT, patch, focusRef, dark, setDark, active, setActive }) {
  const v = useMemo(() => validateTemplate(t), [t])
  const els = t.elements
  const card = els[active] || els[0]

  const patchCard = (i, p) => setT(prev => ({ ...prev, elements: prev.elements.map((e, k) => k === i ? { ...e, ...p } : e) }))
  const addCard = () => {
    if (els.length >= LIMITS.maxCards) return
    setT(prev => ({ ...prev, elements: [...prev.elements, newCard()] }))
    setActive(els.length)
  }
  const removeCard = i => {
    if (els.length <= 1) return
    setT(prev => ({ ...prev, elements: prev.elements.filter((_, k) => k !== i) }))
    setActive(a => Math.max(0, Math.min(a > i ? a - 1 : a, els.length - 2)))
  }
  const moveCard = (i, d) => {
    const j = i + d
    if (j < 0 || j >= els.length) return
    setT(prev => {
      const next = [...prev.elements];
      [next[i], next[j]] = [next[j], next[i]]
      return { ...prev, elements: next }
    })
    setActive(j)
  }

  const insertToken = key => insertAtFocus(focusRef, key)

  return (
    <div className="flex-1 flex min-h-0 flex-col lg:flex-row overflow-y-auto lg:overflow-hidden">
      {/* editor */}
      <div className="flex-shrink-0 lg:flex-shrink lg:flex-1 lg:overflow-y-auto min-w-0">
        <div className="max-w-2xl mx-auto px-5 py-6 space-y-5">
          <div className="flex items-center gap-2">
            <span className={clsx('w-8 h-8 rounded-lg flex items-center justify-center', KIND_TONE[t.kind])}>
              {(() => { const Icon = KIND_ICON[t.kind]; return <Icon size={15}/> })()}
            </span>
            <div className="min-w-0">
              <p className="text-sm font-bold text-slate-900 truncate">{t.name || 'Untitled template'}</p>
              <p className="text-[11px] text-slate-400">{KINDS[t.kind].label}</p>
            </div>
          </div>

          {t.kind !== 'product' && <TokenBar onInsert={insertToken}/>}

          {t.kind === 'generic' && (
            <>
              {/* card strip */}
              <div className="flex items-center gap-1.5 flex-wrap">
                {els.map((e, i) => (
                  <button key={i} type="button" onClick={() => setActive(i)}
                    className={clsx('flex items-center gap-1.5 pl-3 pr-2 py-1.5 rounded-lg text-xs font-semibold border transition-colors',
                      i === active ? 'bg-primary text-white border-primary' : 'bg-white border-surface-border text-slate-600 hover:border-slate-300')}>
                    Card {i + 1}
                    {els.length > 1 && (
                      <span role="button" tabIndex={0} title="Remove card"
                        onClick={ev => { ev.stopPropagation(); removeCard(i) }}
                        onKeyDown={ev => { if (ev.key === 'Enter') { ev.stopPropagation(); removeCard(i) } }}
                        className={clsx('rounded p-0.5', i === active ? 'hover:bg-white/20' : 'hover:bg-slate-100')}>
                        <X size={11}/>
                      </span>
                    )}
                  </button>
                ))}
                {els.length < LIMITS.maxCards && (
                  <button type="button" onClick={addCard}
                    className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold border border-dashed border-slate-300 text-slate-500 hover:border-primary hover:text-primary transition-colors">
                    <Plus size={12}/> Add card
                  </button>
                )}
                <span className="ml-auto text-[10px] text-slate-400 tabular-nums">{els.length}/{LIMITS.maxCards} cards</span>
              </div>

              <div className="rounded-2xl border border-surface-border bg-white p-4 space-y-4">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-bold text-slate-800">Card {active + 1}</p>
                  {els.length > 1 && (
                    <div className="flex items-center gap-0.5">
                      <button type="button" onClick={() => moveCard(active, -1)} disabled={active === 0}
                        className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 disabled:opacity-30" title="Move left"><ChevronLeft size={14}/></button>
                      <button type="button" onClick={() => moveCard(active, 1)} disabled={active === els.length - 1}
                        className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 disabled:opacity-30" title="Move right"><ChevronRight size={14}/></button>
                    </div>
                  )}
                </div>

                <div>
                  <Field label="Image link" value={card.imageUrl} focusRef={focusRef} placeholder="https://…/photo.jpg"
                    onChange={val => patchCard(active, { imageUrl: val })}
                    hint="Public HTTPS image, ideally 1.91 : 1. Instagram fetches it when the message is sent."/>
                  <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                    <span className="text-[10.5px] text-slate-400 flex items-center gap-1"><ImageIcon size={11}/> Try a sample</span>
                    {SAMPLE_IMAGES.map((u, i) => (
                      <button key={u} type="button" onClick={() => patchCard(active, { imageUrl: u })}
                        className="w-10 h-6 rounded overflow-hidden border border-surface-border hover:ring-2 hover:ring-primary/40 transition">
                        <img src={u} alt={`Sample ${i + 1}`} className="w-full h-full object-cover"/>
                      </button>
                    ))}
                    {card.imageUrl && (
                      <button type="button" onClick={() => patchCard(active, { imageUrl: '' })}
                        className="text-[10.5px] text-slate-400 hover:text-red-500 ml-1">Remove</button>
                    )}
                  </div>
                </div>

                <Field label="Title" value={card.title} max={LIMITS.title} focusRef={focusRef} placeholder="Classic Tote Bag"
                  onChange={val => patchCard(active, { title: val })}/>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <Field label="Price" value={card.price || ''} focusRef={focusRef} placeholder="₹1,499" onChange={val => patchCard(active, { price: val })}/>
                  <div className="sm:col-span-2">
                    <Field label="Subtitle" value={card.subtitle} max={LIMITS.subtitle} focusRef={focusRef} placeholder="3 colours · free shipping"
                      onChange={val => patchCard(active, { subtitle: val })}/>
                  </div>
                </div>
                <p className="text-[10.5px] text-slate-400 -mt-2">Instagram has no price field, so the price is shown in front of the subtitle ("₹1,499 · 3 colours") — together they must fit in {LIMITS.subtitle} characters.</p>
                <Field label="When the card is tapped, open" value={card.actionUrl} focusRef={focusRef} placeholder="https://example.com/product"
                  hint="Optional. The whole card becomes a link (default_action)."
                  onChange={val => patchCard(active, { actionUrl: val })}/>

                <ButtonsEditor buttons={card.buttons} focusRef={focusRef}
                  onChange={bs => patchCard(active, { buttons: bs })}/>
              </div>
            </>
          )}

          {t.kind === 'product' && (
            <div className="rounded-2xl border border-surface-border bg-white p-4">
              <ProductsEditor products={t.products || []} onChange={ps => patch({ products: ps })}/>
            </div>
          )}

          {(t.kind === 'button' || t.kind === 'text') && (
            <div className="rounded-2xl border border-surface-border bg-white p-4 space-y-4">
              <Field label="Message" multiline rows={t.kind === 'text' ? 6 : 4} value={t.text} focusRef={focusRef}
                max={t.kind === 'button' ? LIMITS.buttonText : LIMITS.text}
                placeholder={t.kind === 'button' ? 'Hi {{first_name}}! How can we help you today?' : 'Hi {{first_name}}, thanks for reaching out…'}
                onChange={val => patch({ text: val })}
                hint={t.kind === 'text' ? "Text only — this is the format a private reply to a comment can use." : undefined}/>
              {t.kind === 'button' && (
                <ButtonsEditor buttons={t.buttons} required focusRef={focusRef} onChange={bs => patch({ buttons: bs })}/>
              )}
              {t.kind === 'text' && (
                <QuickRepliesEditor replies={t.quickReplies || []} focusRef={focusRef} onChange={qs => patch({ quickReplies: qs })}/>
              )}
              <MediaEditor media={t.media} focusRef={focusRef} onChange={m => patch({ media: m })}/>
            </div>
          )}
        </div>
      </div>

      {/* live preview */}
      <aside className="lg:w-[400px] flex-shrink-0 border-t lg:border-t-0 lg:border-l border-surface-border bg-slate-50 lg:overflow-y-auto">
        <div className="p-5 flex flex-col items-center gap-4">
          <div className="w-full flex items-center justify-between">
            <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1.5"><Smartphone size={12}/> Live preview</p>
            <div className="flex bg-white border border-surface-border rounded-lg p-0.5">
              {[[false, Sun], [true, Moon]].map(([d, Icon]) => (
                <button key={String(d)} type="button" onClick={() => setDark(d)} title={d ? 'Dark mode' : 'Light mode'}
                  className={clsx('p-1.5 rounded-md transition-colors', dark === d ? 'bg-primary text-white' : 'text-slate-400 hover:text-slate-600')}>
                  <Icon size={12}/>
                </button>
              ))}
            </div>
          </div>
          <IgDmPreview template={t} dark={dark} scale={0.92} focusCard={t.kind === 'generic' ? active : null}/>
          <p className="text-[10.5px] text-slate-400 text-center leading-snug max-w-[260px]">
            An approximation of how it looks in the Instagram app. Fonts and spacing vary slightly by device and app version.
          </p>
          <div className="w-full rounded-xl bg-white border border-surface-border p-3.5">
            <div className="flex items-center justify-between mb-2.5">
              <p className="text-xs font-bold text-slate-800">Meta requirements</p>
              <span className={clsx('text-[10.5px] font-bold px-2 py-0.5 rounded-full', v.valid ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500')}>
                {v.passed}/{v.checks.length}
              </span>
            </div>
            <CheckList checks={v.checks} compact/>
          </div>
        </div>
      </aside>
    </div>
  )
}

/* ── step 3: review ────────────────────────────────────────────────────── */
function ReviewStep({ t }) {
  const v = useMemo(() => validateTemplate(t), [t])
  const [view, setView] = useState('preview')
  const [copied, setCopied] = useState(false)
  const calls = useMemo(() => toApiPayloads(t), [t])
  const json = useMemo(() => JSON.stringify(calls.length === 1 ? calls[0].body : calls.map(c => c.body), null, 2), [calls])
  const used = tokensIn(t)

  function copy() {
    navigator.clipboard?.writeText(json)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  return (
    <div className="flex-1 flex min-h-0 flex-col lg:flex-row overflow-y-auto lg:overflow-hidden">
      <div className="lg:w-[360px] flex-shrink-0 lg:overflow-y-auto p-5 space-y-4 border-b lg:border-b-0 lg:border-r border-surface-border">
        <div className="rounded-xl border border-surface-border bg-white p-4">
          <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-2">Summary</p>
          <p className="text-sm font-bold text-slate-900">{t.name || 'Untitled template'}</p>
          <p className="text-xs text-slate-500 mt-0.5">{KINDS[t.kind].label}{t.kind === 'generic' && t.elements.length > 1 ? ` · ${t.elements.length} cards` : ''}</p>
          {t.note && <p className="text-[11.5px] text-slate-500 mt-2 leading-snug">{t.note}</p>}
          {used.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-3">
              {used.map(k => <span key={k} className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-amber-50 text-amber-700">{`{{${k}}}`}</span>)}
            </div>
          )}
        </div>
        <div className="rounded-xl border border-surface-border bg-white p-4">
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs font-bold text-slate-800">Meta requirements</p>
            <span className={clsx('text-[10.5px] font-bold px-2 py-0.5 rounded-full', v.valid ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700')}>
              {v.valid ? 'All passed' : `${v.checks.length - v.passed} to fix`}
            </span>
          </div>
          <CheckList checks={v.checks}/>
        </div>
        <div className="flex items-start gap-2 p-3 rounded-xl bg-amber-50 border border-amber-100">
          <Info size={13} className="text-amber-600 flex-shrink-0 mt-0.5"/>
          <p className="text-[11px] text-amber-800 leading-snug">
            Delivery depends on the recipient's 24-hour window, not on the template. Anyone outside it is skipped when you broadcast.
          </p>
        </div>
      </div>

      <div className="flex-shrink-0 lg:flex-shrink lg:flex-1 min-w-0 lg:overflow-y-auto bg-slate-50 p-5">
        <div className="flex bg-white border border-surface-border rounded-lg p-0.5 w-fit mx-auto lg:mx-0">
          {[['preview', 'Preview', Smartphone], ['payload', 'API payload', Code2]].map(([k, l, Icon]) => (
            <button key={k} type="button" onClick={() => setView(k)}
              className={clsx('flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-colors',
                view === k ? 'bg-primary text-white' : 'text-slate-500 hover:text-slate-700')}>
              <Icon size={12}/> {l}
            </button>
          ))}
        </div>

        {view === 'preview' ? (
          <div className="flex flex-wrap justify-center gap-8 mt-6">
            {[false, true].map(d => (
              <div key={String(d)} className="flex flex-col items-center gap-2">
                <IgDmPreview template={t} dark={d} scale={0.88}/>
                <span className="text-[11px] font-semibold text-slate-400">{d ? 'Dark mode' : 'Light mode'}</span>
              </div>
            ))}
          </div>
        ) : (
          <div className="mt-4 rounded-xl overflow-hidden border border-slate-800 bg-slate-900">
            <div className="flex items-center justify-between px-4 py-2 border-b border-slate-800">
              <p className="text-[11px] font-mono text-slate-400">POST /me/messages{calls.length > 1 ? ` × ${calls.length}, in order: ${calls.map(c => c.label).join(' → ')}` : ''}</p>
              <button type="button" onClick={copy} className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-300 hover:text-white">
                {copied ? <><Check size={12} className="text-emerald-400"/> Copied</> : <><Copy size={12}/> Copy</>}
              </button>
            </div>
            <pre className="p-4 text-[11.5px] leading-relaxed text-emerald-300 overflow-x-auto font-mono">{json}</pre>
          </div>
        )}
        {view === 'payload' && (
          <p className="text-[11px] text-slate-400 mt-3 leading-snug">
            Exactly what is sent to Instagram's Send API for one recipient{calls.length > 1 ? ` — ${calls.length} messages, in this order` : ''}. <span className="font-mono">{'<IGSID>'}</span> is replaced per contact, and
            placeholders are filled in before sending.
          </p>
        )}
      </div>
    </div>
  )
}

/* ── the builder ───────────────────────────────────────────────────────── */
export default function IgTemplateBuilder({ initial = null, onBack, onSave }) {
  const editing = Boolean(initial?.id)
  const [step, setStep] = useState(editing ? 1 : 0)
  const [t, setT] = useState(() => initial ? structuredClone(initial) : emptyTemplate('generic'))
  const [dark, setDark] = useState(false)
  const [active, setActive] = useState(0)
  const focusRef = useRef(null)
  const patch = p => setT(prev => ({ ...prev, ...p }))
  const v = useMemo(() => validateTemplate(t), [t])
  const named = t.name.trim().length > 0

  function save(status) {
    onSave({ ...t, name: t.name.trim(), status })
  }
  const canNext = step === 0 ? named : step === 1 ? named : true

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-white animate-fade-in">
      <div className="flex items-center justify-between gap-3 px-5 h-14 border-b border-surface-border bg-white flex-shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <button onClick={onBack} className="p-1.5 rounded-lg hover:bg-surface-hover text-slate-400 transition-colors" title="Close without saving">
            <X size={16}/>
          </button>
          <span className="text-sm font-bold text-slate-800 truncate">{editing ? 'Edit template' : 'Create template'}</span>
        </div>

        <div className="hidden md:flex items-center">
          {STEPS.map((s, i) => (
            <div key={s} className="flex items-center">
              <button type="button" onClick={() => (i <= step || canNext) && named && setStep(i)} className="flex items-center gap-1.5">
                <span className={clsx('w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0',
                  i < step ? 'bg-emerald-500 text-white' : i === step ? 'bg-primary text-white' : 'border-2 border-surface-border text-slate-400')}>
                  {i < step ? <Check size={10}/> : i + 1}
                </span>
                <span className={clsx('text-xs font-medium whitespace-nowrap', i === step ? 'text-primary' : i < step ? 'text-emerald-600' : 'text-slate-400')}>{s}</span>
              </button>
              {i < STEPS.length - 1 && <div className={clsx('w-8 h-0.5 mx-2', i < step ? 'bg-emerald-400' : 'bg-surface-border')}/>}
            </div>
          ))}
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          {step > 0 && (
            <button onClick={() => setStep(s => s - 1)} className="btn-secondary text-xs flex items-center gap-1.5"><ArrowLeft size={12}/> Back</button>
          )}
          {step >= 1 && (
            <button onClick={() => save('draft')} disabled={!named} className="btn-secondary text-xs flex items-center gap-1.5 disabled:opacity-40">
              <Save size={12}/> <span className="hidden sm:inline">Save as draft</span><span className="sm:hidden">Draft</span>
            </button>
          )}
          {step < STEPS.length - 1 ? (
            <button onClick={() => setStep(s => s + 1)} disabled={!canNext} className="btn-primary text-xs px-4 flex items-center gap-1.5 disabled:opacity-40">
              Continue <ArrowRight size={12}/>
            </button>
          ) : (
            <button onClick={() => save('ready')} disabled={!v.valid} className="btn-primary text-xs px-4 flex items-center gap-1.5 disabled:opacity-40"
              title={v.valid ? '' : 'Fix the failing requirements first'}>
              <Check size={13}/> Save template
            </button>
          )}
        </div>
      </div>

      {step === 0 && <SetupStep t={t} patch={patch} locked={editing}/>}
      {step === 1 && <DesignStep t={t} setT={setT} patch={patch} focusRef={focusRef} dark={dark} setDark={setDark} active={Math.min(active, Math.max(0, t.elements.length - 1))} setActive={setActive}/>}
      {step === 2 && <ReviewStep t={t}/>}
    </div>
  )
}
