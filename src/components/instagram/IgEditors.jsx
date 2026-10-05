// IgEditors.jsx — form pieces shared by the template builder, the campaign
// wizard and Quick Send: text fields with live counters, buttons, quick
// replies, media attachment, the catalog product picker and the compact
// "custom message" editor.
//
// All of these are module-level components so inputs keep focus while typing.
import { useState } from 'react'
import clsx from 'clsx'
import {
  Plus, Trash2, Link2, Reply, Wand2, ChevronUp, ChevronDown, Image as ImageIcon, Video, Mic, FileText,
  Info, X, Check, ShoppingBag, MousePointerClick, MessageSquareQuote, Paperclip,
} from 'lucide-react'
import {
  LIMITS, TOKENS, MEDIA_TYPES, SAMPLE_CATALOG, newButton, newMedia, newQuickReply, newProduct,
  validateTemplate,
} from './igTemplateKit'

export const slug = s => s.trim().toUpperCase().replace(/[^A-Z0-9]+/g, '_').replace(/^_|_$/g, '')

export function Counter({ n, max }) {
  return <span className={clsx('text-[10px] tabular-nums', n > max * 0.9 ? 'text-amber-600 font-semibold' : 'text-slate-400')}>{n}/{max}</span>
}

export function Field({ label, hint, value, onChange, max, multiline, rows = 3, placeholder, focusRef, invalid, mono }) {
  const props = {
    value, placeholder, maxLength: max,
    onChange: e => onChange(e.target.value),
    onFocus: e => { if (focusRef) focusRef.current = { el: e.target, set: onChange, max } },
    className: clsx('input w-full text-xs', multiline && 'textarea', mono && 'font-mono', invalid && '!border-red-300'),
  }
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <label className="label !mb-0">{label}</label>
        {max ? <Counter n={value.length} max={max}/> : null}
      </div>
      {multiline ? <textarea rows={rows} {...props}/> : <input {...props}/>}
      {hint && <p className="text-[10.5px] text-slate-400 mt-1">{hint}</p>}
    </div>
  )
}

/* Insert {{token}} at the cursor of whichever Field was focused last. */
export function insertAtFocus(focusRef, key) {
  const f = focusRef.current
  if (!f || !f.el.isConnected) return
  const tok = `{{${key}}}`
  const el = f.el
  const s = el.selectionStart ?? el.value.length
  const e = el.selectionEnd ?? s
  const next = el.value.slice(0, s) + tok + el.value.slice(e)
  if (f.max && next.length > f.max) return
  f.set(next)
  requestAnimationFrame(() => { el.focus(); el.setSelectionRange(s + tok.length, s + tok.length) })
}

export function TokenBar({ onInsert }) {
  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      <span className="text-[10.5px] font-semibold text-slate-400 mr-0.5 flex items-center gap-1"><Wand2 size={11}/> Personalise</span>
      {TOKENS.map(tk => (
        <button key={tk.key} type="button" onMouseDown={e => e.preventDefault()} onClick={() => onInsert(tk.key)}
          className="px-2 py-0.5 rounded-full text-[11px] font-medium bg-white border border-surface-border text-slate-600 hover:border-primary hover:text-primary transition-colors">
          {`{{${tk.key}}}`}
        </button>
      ))}
    </div>
  )
}

/* ── buttons (web link / postback) ─────────────────────────────────────── */
export function ButtonsEditor({ buttons, onChange, focusRef, max = LIMITS.maxButtons, required }) {
  const set = (j, p) => onChange(buttons.map((b, k) => {
    if (k !== j) return b
    const next = { ...b, ...p }
    // keep an auto-derived payload in step with the title until the user edits it
    if ('title' in p && b.type === 'postback' && (!b.payload || b.payload === slug(b.title))) next.payload = slug(p.title)
    return next
  }))
  const setType = (j, type) => onChange(buttons.map((b, k) => k !== j ? b : (
    type === 'web_url'
      ? { type, title: b.title, url: '' }
      : { type, title: b.title, payload: slug(b.title) }
  )))
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <p className="label !mb-0">Buttons {required ? '' : <span className="font-normal text-slate-400">(optional)</span>}</p>
        <span className="text-[10px] text-slate-400 tabular-nums">{buttons.length}/{max}</span>
      </div>
      {buttons.map((b, j) => (
        <div key={j} className="rounded-xl border border-surface-border bg-slate-50/60 p-3 space-y-2">
          <div className="flex items-center gap-2">
            <div className="flex bg-white border border-surface-border rounded-lg p-0.5">
              {[['web_url', 'Open link', Link2], ['postback', 'Quick reply', Reply]].map(([k, l, Icon]) => (
                <button key={k} type="button" onClick={() => b.type !== k && setType(j, k)}
                  className={clsx('flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-semibold transition-colors',
                    b.type === k ? 'bg-primary text-white' : 'text-slate-500 hover:text-slate-700')}>
                  <Icon size={11}/> {l}
                </button>
              ))}
            </div>
            <button type="button" onClick={() => onChange(buttons.filter((_, k) => k !== j))}
              className="ml-auto p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors" title="Remove button">
              <Trash2 size={13}/>
            </button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <Field label="Button text" value={b.title} max={LIMITS.buttonTitle} focusRef={focusRef}
              placeholder={b.type === 'web_url' ? 'Shop now' : 'Track my order'}
              onChange={v => set(j, { title: v })}/>
            {b.type === 'web_url'
              ? <Field label="Link" value={b.url || ''} focusRef={focusRef} placeholder="https://example.com/product"
                  onChange={v => set(j, { url: v })}/>
              : <Field label="Payload" value={b.payload || ''} focusRef={focusRef} mono placeholder="TRACK_ORDER"
                  hint="Sent to your webhook when tapped" onChange={v => set(j, { payload: v })}/>}
          </div>
        </div>
      ))}
      {buttons.length < max && (
        <button type="button" onClick={() => onChange([...buttons, newButton()])}
          className="w-full flex items-center justify-center gap-1.5 py-2 rounded-xl border border-dashed border-slate-300 text-xs font-semibold text-slate-500 hover:border-primary hover:text-primary hover:bg-primary/5 transition-colors">
          <Plus size={13}/> Add button
        </button>
      )}
    </div>
  )
}

/* ── quick-reply chips (text messages) ─────────────────────────────────── */
export function QuickRepliesEditor({ replies, onChange, focusRef }) {
  const set = (j, p) => onChange(replies.map((r, k) => {
    if (k !== j) return r
    const next = { ...r, ...p }
    if ('title' in p && (!r.payload || r.payload === slug(r.title))) next.payload = slug(p.title)
    return next
  }))
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <p className="label !mb-0">Quick replies <span className="font-normal text-slate-400">(optional)</span></p>
        <span className="text-[10px] text-slate-400 tabular-nums">{replies.length}/{LIMITS.maxQuickReplies}</span>
      </div>
      <p className="text-[10.5px] text-slate-400 -mt-1">Chips shown under the message. Tapping one posts its text back to the chat.</p>
      {replies.map((r, j) => (
        <div key={j} className="flex items-start gap-2">
          <div className="flex-1 grid grid-cols-2 gap-2">
            <Field label={j === 0 ? 'Chip text' : ''} value={r.title} max={LIMITS.quickReplyTitle} focusRef={focusRef} placeholder="Shoes" onChange={v => set(j, { title: v })}/>
            <Field label={j === 0 ? 'Payload' : ''} value={r.payload || ''} focusRef={focusRef} mono placeholder="CAT_SHOES" onChange={v => set(j, { payload: v })}/>
          </div>
          <button type="button" onClick={() => onChange(replies.filter((_, k) => k !== j))} title="Remove"
            className={clsx('p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50', j === 0 ? 'mt-6' : 'mt-0.5')}><Trash2 size={13}/></button>
        </div>
      ))}
      {replies.length < LIMITS.maxQuickReplies && (
        <button type="button" onClick={() => onChange([...replies, newQuickReply()])}
          className="w-full flex items-center justify-center gap-1.5 py-2 rounded-xl border border-dashed border-slate-300 text-xs font-semibold text-slate-500 hover:border-primary hover:text-primary hover:bg-primary/5 transition-colors">
          <Plus size={13}/> Add quick reply
        </button>
      )}
    </div>
  )
}

/* ── media attachment ──────────────────────────────────────────────────── */
const MEDIA_ICON = { image: ImageIcon, video: Video, audio: Mic, file: FileText }
const SAMPLE_MEDIA = {
  image: 'https://picsum.photos/seed/igpromo/800/800.jpg',
}

export function MediaEditor({ media, onChange, focusRef }) {
  if (!media) {
    return (
      <div className="space-y-2">
        <p className="label !mb-0">Media <span className="font-normal text-slate-400">(optional)</span></p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {Object.entries(MEDIA_TYPES).map(([k, spec]) => {
            const Icon = MEDIA_ICON[k]
            return (
              <button key={k} type="button" onClick={() => onChange(newMedia(k))}
                className="flex items-center justify-center gap-1.5 py-2.5 rounded-xl border border-dashed border-slate-300 text-xs font-semibold text-slate-500 hover:border-primary hover:text-primary hover:bg-primary/5 transition-colors">
                <Icon size={13}/> {spec.label}
              </button>
            )
          })}
        </div>
      </div>
    )
  }
  const spec = MEDIA_TYPES[media.type]
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <p className="label !mb-0">Media</p>
        <button type="button" onClick={() => onChange(null)} className="flex items-center gap-1 text-[11px] text-slate-400 hover:text-red-500"><X size={11}/> Remove</button>
      </div>
      <div className="rounded-xl border border-surface-border bg-slate-50/60 p-3 space-y-2.5">
        <div className="flex bg-white border border-surface-border rounded-lg p-0.5 w-fit flex-wrap">
          {Object.entries(MEDIA_TYPES).map(([k, s]) => {
            const Icon = MEDIA_ICON[k]
            return (
              <button key={k} type="button" onClick={() => onChange({ ...media, type: k })}
                className={clsx('flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-semibold transition-colors',
                  media.type === k ? 'bg-primary text-white' : 'text-slate-500 hover:text-slate-700')}>
                <Icon size={11}/> {s.label}
              </button>
            )
          })}
        </div>
        <Field label={`${spec.label} link`} value={media.url} focusRef={focusRef} placeholder={`https://example.com/file.${spec.exts[0]}`}
          hint={`${spec.note}. Must be a public HTTPS link — Instagram fetches it when the message is sent.`}
          onChange={v => onChange({ ...media, url: v })}/>
        {media.type === 'image' && !media.url && (
          <button type="button" onClick={() => onChange({ ...media, url: SAMPLE_MEDIA.image })} className="text-[11px] font-semibold text-primary hover:underline">Use a sample image</button>
        )}
        {media.type === 'file' && (
          <Field label="File name shown in the preview" value={media.name || ''} placeholder="Lookbook.pdf" onChange={v => onChange({ ...media, name: v })}/>
        )}
        <p className="flex items-start gap-1.5 text-[10.5px] text-slate-500 leading-snug">
          <Info size={12} className="flex-shrink-0 mt-0.5"/>
          Instagram can't put buttons on a media message, so this is sent as its own message just before the one below it.
          Want an image with buttons in a single message? Use a Card instead.
        </p>
      </div>
    </div>
  )
}

/* ── catalog products ──────────────────────────────────────────────────── */
export function ProductsEditor({ products, onChange }) {
  const has = id => products.some(p => p.id === id)
  const toggle = p => onChange(has(p.id) ? products.filter(x => x.id !== p.id) : (products.length < LIMITS.maxProducts ? [...products, { ...p }] : products))
  const move = (i, d) => {
    const j = i + d
    if (j < 0 || j >= products.length) return
    const next = [...products];
    [next[i], next[j]] = [next[j], next[i]]
    onChange(next)
  }
  const set = (i, p) => onChange(products.map((x, k) => k === i ? { ...x, ...p } : x))
  return (
    <div className="space-y-4">
      <div className="flex items-start gap-2.5 p-3 rounded-xl bg-blue-50 border border-blue-100">
        <ShoppingBag size={14} className="text-blue-500 flex-shrink-0 mt-0.5"/>
        <p className="text-[11px] text-blue-900 leading-relaxed">
          Instagram builds each card itself from your <b>Instagram Shop catalog</b> — image, title and price come from the product, so only the product ID is sent.
          You need a connected catalog and the commerce permission on your app. The sample products below stand in for it.
        </p>
      </div>

      <div>
        <p className="label">Pick from your catalog</p>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {SAMPLE_CATALOG.map(p => {
            const on = has(p.id)
            return (
              <button key={p.id} type="button" onClick={() => toggle(p)}
                className={clsx('flex items-center gap-2 p-2 rounded-xl border-2 text-left transition-all',
                  on ? 'border-primary bg-primary/5' : 'border-surface-border hover:border-slate-300')}>
                <span className="w-9 h-9 rounded-lg flex items-center justify-center text-lg flex-shrink-0" style={{ background: p.tint }}>{p.emoji}</span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[11px] font-semibold text-slate-800 truncate">{p.name}</span>
                  <span className="block text-[10.5px] text-slate-400">{p.price}</span>
                </span>
                {on && <Check size={13} className="text-primary flex-shrink-0"/>}
              </button>
            )
          })}
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <p className="label !mb-0">In this carousel</p>
          <span className="text-[10px] text-slate-400 tabular-nums">{products.length}/{LIMITS.maxProducts}</span>
        </div>
        {products.length === 0 && <p className="text-xs text-slate-400 py-2">No products yet — pick some above or add one by ID.</p>}
        {products.map((p, i) => (
          <div key={i} className="flex items-center gap-2 rounded-xl border border-surface-border bg-white p-2">
            <span className="w-8 h-8 rounded-lg flex items-center justify-center text-base flex-shrink-0" style={{ background: p.tint || '#e5e7eb' }}>{p.emoji || '🛍️'}</span>
            <div className="flex-1 min-w-0 grid grid-cols-1 sm:grid-cols-2 gap-1.5">
              <input className="input !py-1 text-xs" value={p.name} placeholder="Name (for your reference)" onChange={e => set(i, { name: e.target.value })}/>
              <input className="input !py-1 text-xs font-mono" value={p.id} placeholder="Catalog product ID" onChange={e => set(i, { id: e.target.value.replace(/\s+/g, '') })}/>
            </div>
            <div className="flex flex-col">
              <button type="button" onClick={() => move(i, -1)} disabled={i === 0} className="p-0.5 text-slate-400 hover:text-slate-700 disabled:opacity-25"><ChevronUp size={13}/></button>
              <button type="button" onClick={() => move(i, 1)} disabled={i === products.length - 1} className="p-0.5 text-slate-400 hover:text-slate-700 disabled:opacity-25"><ChevronDown size={13}/></button>
            </div>
            <button type="button" onClick={() => onChange(products.filter((_, k) => k !== i))} className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50" title="Remove"><Trash2 size={13}/></button>
          </div>
        ))}
        {products.length < LIMITS.maxProducts && (
          <button type="button" onClick={() => onChange([...products, newProduct()])}
            className="w-full flex items-center justify-center gap-1.5 py-2 rounded-xl border border-dashed border-slate-300 text-xs font-semibold text-slate-500 hover:border-primary hover:text-primary hover:bg-primary/5 transition-colors">
            <Plus size={13}/> Add product by ID
          </button>
        )}
      </div>
    </div>
  )
}

/* ── custom message (wizard + Quick Send) ──────────────────────────────── */
export const emptyDraft = () => ({ text: '', buttons: [], quickReplies: [], media: null })

/* A custom message is an unsaved text/button template. */
export function draftToTemplate(d, textOnly = false) {
  if (!d.text.trim()) return null
  const base = { id: null, name: 'Custom message', status: 'ready', note: '', elements: [], products: [], text: d.text }
  if (textOnly) return { ...base, kind: 'text', buttons: [], quickReplies: [], media: null }
  return d.buttons.length
    ? { ...base, kind: 'button', buttons: d.buttons, quickReplies: [], media: d.media }
    : { ...base, kind: 'text', buttons: [], quickReplies: d.quickReplies, media: d.media }
}

export function draftProblems(d, textOnly = false) {
  const t = draftToTemplate(d, textOnly)
  if (!t) return []
  return validateTemplate({ ...t, name: 'Custom message' }).checks.filter(c => !c.ok && c.id !== 'name')
}

export function CustomMessageEditor({ draft, onChange, textOnly = false, focusRef, autoFocus }) {
  const [open, setOpen] = useState({ buttons: draft.buttons.length > 0, replies: draft.quickReplies.length > 0, media: !!draft.media })
  const set = p => onChange({ ...draft, ...p })
  const max = draft.buttons.length ? LIMITS.buttonText : LIMITS.text
  const hasButtons = draft.buttons.length > 0
  const hasReplies = draft.quickReplies.length > 0
  const problems = draftProblems(draft, textOnly)

  const addOn = (key, label, Icon, disabled, tip, onOpen) => (
    <button key={key} type="button" disabled={disabled} title={tip}
      onClick={() => { setOpen(o => ({ ...o, [key]: true })); onOpen?.() }}
      className={clsx('flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-[11px] font-semibold transition-colors',
        open[key] ? 'border-primary bg-primary/5 text-primary' : 'border-surface-border text-slate-500 hover:border-slate-300',
        disabled && 'opacity-40 cursor-not-allowed')}>
      <Icon size={12}/> {label}
    </button>
  )

  return (
    <div className="space-y-3">
      <div>
        <Field label="Your message" multiline rows={textOnly ? 7 : 5} value={draft.text} max={textOnly ? LIMITS.text : max} focusRef={focusRef}
          placeholder={textOnly ? 'Thanks for commenting, {{first_name}}! Here is the link you asked about…' : 'Hi {{first_name}}! Just a quick update on your order…'}
          onChange={v => set({ text: v })}/>
        <div className="mt-2"><TokenBar onInsert={k => insertAtFocus(focusRef, k)}/></div>
      </div>

      {textOnly ? (
        <p className="flex items-start gap-1.5 text-[10.5px] text-slate-500 leading-snug">
          <Info size={12} className="flex-shrink-0 mt-0.5"/>
          A private reply to a comment is plain text only — Instagram doesn't allow buttons, quick replies or media there.
        </p>
      ) : (
        <>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[10.5px] font-semibold text-slate-400 flex items-center gap-1"><Paperclip size={11}/> Add</span>
            {addOn('buttons', 'Buttons', MousePointerClick, hasReplies, 'Buttons and quick replies can’t be combined — remove the quick replies first')}
            {addOn('replies', 'Quick replies', MessageSquareQuote, hasButtons, 'Buttons and quick replies can’t be combined — remove the buttons first')}
            {addOn('media', 'Image / video / PDF', ImageIcon, false)}
          </div>
          {open.buttons && !hasReplies && (
            <ButtonsEditor buttons={draft.buttons} required focusRef={focusRef} onChange={bs => set({ buttons: bs })}/>
          )}
          {open.replies && !hasButtons && (
            <QuickRepliesEditor replies={draft.quickReplies} focusRef={focusRef} onChange={qs => set({ quickReplies: qs })}/>
          )}
          {open.media && <MediaEditor media={draft.media} focusRef={focusRef} onChange={m => set({ media: m })}/>}
        </>
      )}

      {problems.length > 0 && (
        <ul className="space-y-0.5">
          {problems.map(p => <li key={p.id} className="text-[11px] text-red-600">• {p.label}</li>)}
        </ul>
      )}
    </div>
  )
}
