// PropertyCardsEditor.jsx — the full editor for the Property Cards question type (real estate).
// Three panes inside the question's edit popup: the list of projects, the form for the selected project, and a live
// preview of exactly the card a visitor will see. The buttons shared by every card (labels, on/off) sit on top.
// It edits the popup's draft; the popup's own Save changes / Cancel decide whether it sticks.
import { useState } from 'react'
import clsx from 'clsx'
import { AlertCircle, Building2, ChevronDown, ChevronLeft, ChevronRight, ChevronUp, Copy, ExternalLink, Play, Plus, Trash2, X } from 'lucide-react'
import { PropertyCard } from './AnswerControls'
import {
  GST_PRESETS, MAX_HIGHLIGHTS, MAX_MEDIA, STATUS_OPTIONS, cardProblems, highlightsOf, linkError, mediaOf, newPropertyCard, safeUrl, DEFAULT_PROPERTIES,
} from './propertyCards'

const box = 'rounded-xl bg-slate-50 border border-slate-100 p-3.5 space-y-3'
const heading = 'text-[10px] font-bold uppercase tracking-wider text-slate-400'
const field = 'input !py-1.5 text-xs w-full'

function Switch({ on, onChange, label }) {
  return (
    <button type="button" role="switch" aria-checked={on} aria-label={label} onClick={() => onChange(!on)}
      className={clsx('relative w-9 h-5 rounded-full transition-colors flex-shrink-0', on ? 'bg-emerald-500' : 'bg-slate-300')}>
      <span className={clsx('absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform', on && 'translate-x-4')}/>
    </button>
  )
}

/* A link field that says what is wrong while you type, and can be tried out. */
function LinkField({ value, onChange, placeholder, label }) {
  const err = linkError(value)
  return (
    <div className="space-y-1">
      {label && <label className="label">{label}</label>}
      <div className="flex items-center gap-1.5">
        <input className={clsx(field, err && '!border-red-300')} value={value || ''} onChange={e => onChange(e.target.value)} placeholder={placeholder} inputMode="url"/>
        {safeUrl(value) && <a href={safeUrl(value)} target="_blank" rel="noopener noreferrer" title="Open this link" className="p-1.5 rounded-lg text-slate-400 hover:text-primary hover:bg-white flex-shrink-0"><ExternalLink size={13}/></a>}
      </div>
      {err && <p role="alert" className="text-[10px] text-red-500">{err} (the widget ignores it until it is fixed).</p>}
    </div>
  )
}

function MediaTile({ url, first, last, onMove, onRemove }) {
  const m = mediaOf(url)
  const [bad, setBad] = useState(false)
  const src = m?.kind === 'image' ? m.src : m?.thumb
  return (
    <div className="relative w-[92px] flex-shrink-0">
      <div className="h-[64px] rounded-lg overflow-hidden bg-slate-200 flex items-center justify-center border border-slate-200" title={url}>
        {src && !bad ? <img src={src} alt="" className="w-full h-full object-cover" onError={() => setBad(true)}/>
          : m ? <Play size={16} className="text-slate-500"/> : <AlertCircle size={16} className="text-red-400"/>}
      </div>
      <span className="absolute left-1 top-1 px-1 rounded text-[8.5px] font-bold text-white bg-black/50">{first ? 'Cover' : (m?.label || 'Link?')}</span>
      <button type="button" onClick={onRemove} aria-label="Remove" className="absolute -right-1.5 -top-1.5 w-[18px] h-[18px] rounded-full bg-white border border-slate-200 text-slate-500 hover:text-red-500 flex items-center justify-center shadow-sm"><X size={10}/></button>
      <div className="flex justify-center gap-1 mt-1">
        <button type="button" disabled={first} onClick={() => onMove(-1)} aria-label="Move earlier" className="p-0.5 rounded text-slate-400 hover:bg-white disabled:opacity-30"><ChevronLeft size={12}/></button>
        <button type="button" disabled={last} onClick={() => onMove(1)} aria-label="Move later" className="p-0.5 rounded text-slate-400 hover:bg-white disabled:opacity-30"><ChevronRight size={12}/></button>
      </div>
    </div>
  )
}

function MediaEditor({ media, onChange }) {
  const list = (media || []).filter(m => String(m || '').trim())
  const [draft, setDraft] = useState('')
  const [err, setErr] = useState('')
  const add = () => {
    const v = draft.trim()
    if (!v) return
    if (!safeUrl(v)) return setErr('Paste a full link starting with https://')
    if (list.length >= MAX_MEDIA) return setErr(`Up to ${MAX_MEDIA} photos or videos per project.`)
    setErr(''); setDraft(''); onChange([...list, v])
  }
  const move = (i, d) => { const j = i + d; const n = [...list]; [n[i], n[j]] = [n[j], n[i]]; onChange(n) }
  return (
    <div className={box}>
      <p className={heading}>Photos &amp; videos</p>
      {list.length > 0 && (
        <div className="flex flex-wrap gap-2.5">
          {list.map((u, i) => <MediaTile key={`${u}-${i}`} url={u} first={i === 0} last={i === list.length - 1} onMove={d => move(i, d)} onRemove={() => onChange(list.filter((_, k) => k !== i))}/>)}
        </div>
      )}
      <div className="space-y-1">
        <div className="flex gap-1.5">
          <input className={clsx(field, err && '!border-red-300')} value={draft} onChange={e => { setDraft(e.target.value); setErr('') }} onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), add())}
            placeholder="Paste a photo or video link (.jpg, .png, .mp4, YouTube, Vimeo) and press Add" disabled={list.length >= MAX_MEDIA}/>
          <button type="button" onClick={add} disabled={!draft.trim() || list.length >= MAX_MEDIA} className="px-3 rounded-lg text-[11px] font-semibold text-white bg-primary disabled:opacity-40 flex-shrink-0">Add</button>
        </div>
        {err && <p role="alert" className="text-[10px] text-red-500">{err}</p>}
        <p className="text-[10px] text-slate-400 leading-snug">{list.length}/{MAX_MEDIA}. The first one is the cover. Visitors swipe through the rest. Use links to files you host (or YouTube / Vimeo) rather than uploading, so the flow stays light.</p>
      </div>
    </div>
  )
}

function HighlightsEditor({ value, onChange }) {
  const tags = highlightsOf({ highlights: value })
  const [draft, setDraft] = useState('')
  const commit = (list) => onChange(list.join(', '))
  const add = () => { const t = draft.replace(/,/g, ' ').trim(); if (t && tags.length < MAX_HIGHLIGHTS && !tags.includes(t)) commit([...tags, t]); setDraft('') }
  return (
    <div className="space-y-1">
      <label className="label">Highlights <span className="normal-case font-normal tracking-normal">(up to {MAX_HIGHLIGHTS})</span></label>
      <div className="flex flex-wrap items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2 py-1.5">
        {tags.map(t => (
          <span key={t} className="inline-flex items-center gap-1 pl-2 pr-1 py-0.5 rounded-md bg-primary/10 text-primary text-[10.5px] font-semibold">
            {t}<button type="button" onClick={() => commit(tags.filter(x => x !== t))} aria-label={`Remove ${t}`} className="hover:text-red-500"><X size={10}/></button>
          </span>
        ))}
        {tags.length < MAX_HIGHLIGHTS && (
          <input className="flex-1 min-w-[110px] text-xs outline-none bg-transparent py-0.5" value={draft} placeholder={tags.length ? 'Add another…' : 'e.g. Clubhouse (press Enter)'}
            onChange={e => setDraft(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); add() } else if (e.key === 'Backspace' && !draft && tags.length) commit(tags.slice(0, -1)) }}
            onBlur={add}/>
        )}
      </div>
    </div>
  )
}

/* One of the two buttons: continue inside the chat, or open this project's own link. */
function ButtonAction({ label, url, onChange }) {
  const mode = url === null || url === undefined || url === '' ? 'chat' : 'link'
  const [linkMode, setLinkMode] = useState(mode === 'link')
  return (
    <div className="space-y-1.5">
      <p className="text-[11.5px] font-semibold text-slate-700">“{label}” button</p>
      <div className="inline-flex rounded-lg bg-slate-200/70 p-0.5">
        {[[false, 'Continue in chat'], [true, 'Open a link']].map(([v, l]) => (
          <button key={l} type="button" onClick={() => { setLinkMode(v); if (!v) onChange('') }}
            className={clsx('px-2.5 py-1 rounded-md text-[10.5px] font-semibold', linkMode === v ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500')}>{l}</button>
        ))}
      </div>
      {linkMode
        ? <LinkField value={url} onChange={onChange} placeholder="https://… (opens in a new tab; the answer is still recorded)"/>
        : <p className="text-[10px] text-slate-400">The visitor's tap is recorded and the chat moves on to the next question.</p>}
    </div>
  )
}

export default function PropertyCardsEditor({ cards, onChange, d, set, accent = '#0066ff' }) {
  const [selId, setSelId] = useState(cards[0]?.id || null)
  const [confirmId, setConfirmId] = useState(null)
  const sel = cards.find(c => c.id === selId) || cards[0] || null
  const update = (id, patch) => onChange(cards.map(c => (c.id === id ? { ...c, ...patch } : c)))
  const add = (c = newPropertyCard()) => { onChange([...cards, c]); setSelId(c.id) }
  const duplicate = ({ id, ...rest }) => add(newPropertyCard({ ...rest, name: `${rest.name} (copy)`, media: [...(rest.media || [])] }))   // a copy gets its own id
  const remove = id => { const next = cards.filter(c => c.id !== id); onChange(next); setConfirmId(null); if (selId === id) setSelId(next[0]?.id || null) }
  const move = (i, dir) => { const j = i + dir; if (j < 0 || j >= cards.length) return; const n = [...cards]; [n[i], n[j]] = [n[j], n[i]]; onChange(n) }
  const gstOn = !!sel?.gstEnabled
  const problems = sel ? cardProblems(sel, d) : []

  return (
    <div className="space-y-3">
      {/* shared by every card */}
      <div className={box}>
        <p className={heading}>Buttons under every card</p>
        <div className="grid sm:grid-cols-2 gap-3">
          {[['interested', 'Interested'], ['siteVisit', 'Site visit']].map(([k, def]) => (
            <div key={k} className="flex items-center gap-2.5">
              <Switch on={d[`${k}Enabled`] !== false} onChange={v => set(`${k}Enabled`, v)} label={`Show the ${def} button`}/>
              <input className={clsx(field, d[`${k}Enabled`] === false && 'opacity-50')} value={d[`${k}Label`] || ''} disabled={d[`${k}Enabled`] === false} placeholder={def} onChange={e => set(`${k}Label`, e.target.value)} maxLength={24} aria-label={`${def} button text`}/>
            </div>
          ))}
        </div>
        <p className="text-[10px] text-slate-400">Turn a button off to hide it everywhere. Where each button leads is set per project below.</p>
      </div>

      {cards.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 px-4 py-8 text-center space-y-2">
          <Building2 size={22} className="mx-auto text-slate-300"/>
          <p className="text-[12px] font-semibold text-slate-600">No projects yet</p>
          <p className="text-[10.5px] text-slate-400">Until you add one, visitors see two sample projects.</p>
          <div className="flex justify-center gap-2 pt-1">
            <button type="button" onClick={() => add()} className="px-3 py-1.5 rounded-lg text-[11px] font-semibold text-white bg-primary flex items-center gap-1"><Plus size={12}/> Add your first project</button>
            <button type="button" onClick={() => { onChange(DEFAULT_PROPERTIES.map(({ id, ...rest }) => newPropertyCard(rest))); setSelId(null) }} className="px-3 py-1.5 rounded-lg text-[11px] font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200">Start from the samples</button>
          </div>
        </div>
      ) : (
        <div className="grid gap-3 lg:grid-cols-[205px_minmax(0,1fr)_262px] items-start">
          {/* 1. projects */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between"><p className={heading}>Projects ({cards.length})</p>
              <button type="button" onClick={() => add()} className="text-[11px] font-semibold text-primary flex items-center gap-0.5 hover:underline"><Plus size={11}/> Add</button></div>
            <ul className="space-y-1">
              {cards.map((c, i) => {
                const probs = cardProblems(c, d), cover = mediaOf((c.media || [])[0])
                const active = sel?.id === c.id
                return (
                  <li key={c.id} className={clsx('rounded-lg border', active ? 'border-primary bg-primary/5' : 'border-slate-200 bg-white')}>
                    <button type="button" onClick={() => setSelId(c.id)} className="w-full flex items-center gap-2 p-1.5 text-left">
                      <span className="w-9 h-9 rounded-md bg-slate-200 overflow-hidden flex items-center justify-center flex-shrink-0">
                        {(cover?.kind === 'image' || cover?.thumb) ? <img src={cover.kind === 'image' ? cover.src : cover.thumb} alt="" className="w-full h-full object-cover" onError={e => { e.currentTarget.style.display = 'none' }}/> : <Building2 size={14} className="text-slate-400"/>}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className={clsx('block text-[11.5px] font-semibold truncate', c.name?.trim() ? 'text-slate-800' : 'text-red-500 italic')}>{c.name?.trim() || 'Untitled project'}</span>
                        <span className="block text-[9.5px] text-slate-400 truncate">{c.price || 'No price yet'}</span>
                      </span>
                      {probs.length > 0 && <span title={probs.join('\n')}><AlertCircle size={13} className="text-amber-500 flex-shrink-0"/></span>}
                    </button>
                    {active && (
                      <div className="flex items-center gap-0.5 px-1.5 pb-1.5">
                        <button type="button" disabled={i === 0} onClick={() => move(i, -1)} aria-label="Move up" className="p-1 rounded text-slate-400 hover:bg-white disabled:opacity-30"><ChevronUp size={13}/></button>
                        <button type="button" disabled={i === cards.length - 1} onClick={() => move(i, 1)} aria-label="Move down" className="p-1 rounded text-slate-400 hover:bg-white disabled:opacity-30"><ChevronDown size={13}/></button>
                        <button type="button" onClick={() => duplicate(c)} aria-label="Duplicate" title="Duplicate" className="p-1 rounded text-slate-400 hover:text-primary hover:bg-white"><Copy size={12}/></button>
                        <span className="flex-1"/>
                        {confirmId === c.id
                          ? <span className="flex items-center gap-1.5 text-[10px]">Remove? <button type="button" onClick={() => remove(c.id)} className="font-bold text-red-600">Yes</button><button type="button" onClick={() => setConfirmId(null)} className="font-semibold text-slate-500">No</button></span>
                          : <button type="button" onClick={() => setConfirmId(c.id)} aria-label="Remove" title="Remove" className="p-1 rounded text-slate-400 hover:text-red-500 hover:bg-white"><Trash2 size={12}/></button>}
                      </div>
                    )}
                  </li>
                )
              })}
            </ul>
          </div>

          {/* 2. the selected project */}
          {sel && (
            <div className="space-y-3 min-w-0">
              {problems.length > 0 && (
                <div role="status" className="rounded-lg bg-amber-50 border border-amber-100 px-3 py-2 text-[10.5px] text-amber-800 space-y-0.5">
                  {problems.map(p => <p key={p} className="flex items-start gap-1.5"><AlertCircle size={11} className="mt-px flex-shrink-0"/>{p}</p>)}
                </div>
              )}
              <MediaEditor media={sel.media} onChange={m => update(sel.id, { media: m })}/>

              <div className={box}>
                <p className={heading}>Project</p>
                <div className="space-y-1"><label className="label">Project name</label>
                  <input className={clsx(field, !sel.name?.trim() && '!border-amber-300')} value={sel.name || ''} onChange={e => update(sel.id, { name: e.target.value })} placeholder="e.g. Skyline Heights" maxLength={80}/></div>
                <div className="space-y-1"><label className="label">Configuration &amp; size</label>
                  <input className={field} value={sel.config || ''} onChange={e => update(sel.id, { config: e.target.value })} placeholder="2 & 3 BHK · 950–1,450 sq ft" maxLength={80}/></div>
                <div className="space-y-1"><label className="label">Status badge</label>
                  <div className="flex flex-wrap items-center gap-1.5">
                    {STATUS_OPTIONS.map(s => (
                      <button key={s} type="button" onClick={() => update(sel.id, { status: sel.status === s ? '' : s })}
                        className={clsx('px-2 py-1 rounded-full text-[10.5px] font-semibold border', sel.status === s ? 'bg-primary text-white border-primary' : 'bg-white text-slate-600 border-slate-200 hover:border-primary/50')}>{s}</button>
                    ))}
                  </div>
                  <input className={clsx(field, 'mt-1.5')} value={sel.status || ''} onChange={e => update(sel.id, { status: e.target.value })} placeholder="…or type your own" maxLength={30}/></div>
                <HighlightsEditor value={sel.highlights} onChange={v => update(sel.id, { highlights: v })}/>
                <div className="space-y-1"><label className="label">RERA number <span className="normal-case font-normal tracking-normal">(optional)</span></label>
                  <input className={field} value={sel.rera || ''} onChange={e => update(sel.id, { rera: e.target.value })} maxLength={40}/></div>
              </div>

              <div className={box}>
                <p className={heading}>Location</p>
                <div className="space-y-1"><label className="label">Location text</label>
                  <input className={field} value={sel.location || ''} onChange={e => update(sel.id, { location: e.target.value })} placeholder="Baner, Pune" maxLength={80}/></div>
                <LinkField label="Map link (optional)" value={sel.locationUrl} onChange={v => update(sel.id, { locationUrl: v })} placeholder="https://maps.google.com/… (turns the location into a link)"/>
              </div>

              <div className={box}>
                <p className={heading}>Price</p>
                <div className="space-y-1"><label className="label">Price</label>
                  <input className={field} value={sel.price || ''} onChange={e => update(sel.id, { price: e.target.value })} placeholder="₹85 Lakh onwards" maxLength={40}/></div>
                <div className="flex items-center justify-between gap-3 rounded-lg bg-white border border-slate-200 px-3 py-2">
                  <span><span className="text-[11.5px] font-semibold text-slate-700 block">Show GST note</span><span className="text-[10px] text-slate-400">Turn off for projects where GST does not apply</span></span>
                  <Switch on={gstOn} onChange={v => update(sel.id, { gstEnabled: v })} label="Show GST note"/>
                </div>
                {gstOn && (
                  <div className="space-y-1.5"><label className="label">GST text</label>
                    <input className={field} value={sel.gst || ''} onChange={e => update(sel.id, { gst: e.target.value })} placeholder="+ 5% GST" maxLength={30}/>
                    <div className="flex flex-wrap gap-1.5">{GST_PRESETS.map(g => <button key={g} type="button" onClick={() => update(sel.id, { gst: g })} className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-white border border-slate-200 text-slate-600 hover:border-primary/50">{g}</button>)}</div></div>
                )}
              </div>

              {(d.interestedEnabled !== false || d.siteVisitEnabled !== false) && (
                <div className={box}>
                  <p className={heading}>Where the buttons lead (this project)</p>
                  {d.interestedEnabled !== false && <ButtonAction key={`i-${sel.id}`} label={d.interestedLabel || 'Interested'} url={sel.interestedUrl} onChange={v => update(sel.id, { interestedUrl: v })}/>}
                  {d.siteVisitEnabled !== false && <ButtonAction key={`s-${sel.id}`} label={d.siteVisitLabel || 'Site visit'} url={sel.siteVisitUrl} onChange={v => update(sel.id, { siteVisitUrl: v })}/>}
                </div>
              )}
            </div>
          )}

          {/* 3. what the visitor sees */}
          {sel && (
            <div className="lg:sticky lg:top-0 space-y-1.5">
              <p className={heading}>Live preview</p>
              <div className="rounded-xl p-3 flex justify-center" style={{ background: '#f1f5f9' }}>
                <PropertyCard key={sel.id} card={sel} accent={accent} dark={false} data={d}/>
              </div>
              <p className="text-[10px] text-slate-400 text-center">Exactly how this card looks in the chat.</p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
