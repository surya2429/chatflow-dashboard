// IgTemplatesView.jsx — the saved-templates library (WhatsApp "Templates" tab,
// adapted: Ready / Draft instead of Meta approval states, formats instead of
// categories). View, preview, edit, duplicate and delete live here; creating
// and editing open the full-screen builder via the callbacks.
import { useState, useMemo, useEffect, useRef } from 'react'
import igPortal from './igPortal'
import clsx from 'clsx'
import {
  Search, FileText, Pencil, Trash2, Copy, Eye, MoreHorizontal, X, Sun, Moon, Plus,
  LayoutGrid, MousePointerClick, Type, ShoppingBag, ChevronLeft, ChevronRight, Send,
} from 'lucide-react'
import { NativeSelect } from '../Select'
import IgDmPreview from './IgDmPreview'
import { KINDS, summarize, tokensIn } from './igTemplateKit'

const KIND_ICON = { generic: LayoutGrid, product: ShoppingBag, button: MousePointerClick, text: Type }
const KIND_TONE = {
  generic: { icon: 'bg-pink-50 text-pink-500',     tag: 'bg-pink-50 text-pink-600' },
  product: { icon: 'bg-amber-50 text-amber-500',   tag: 'bg-amber-50 text-amber-600' },
  button:  { icon: 'bg-violet-50 text-violet-500', tag: 'bg-violet-50 text-violet-600' },
  text:    { icon: 'bg-sky-50 text-sky-500',       tag: 'bg-sky-50 text-sky-600' },
}
const STATUS = {
  ready: { label: 'Ready', cls: 'bg-emerald-50 text-emerald-700 ring-emerald-200', dot: 'bg-emerald-500' },
  draft: { label: 'Draft', cls: 'bg-slate-50 text-slate-600 ring-slate-200',       dot: 'bg-slate-400' },
}
const PAGE_SIZE = 8

export function IgStatusPill({ status }) {
  const s = STATUS[status] || STATUS.draft
  return (
    <span className={clsx('inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold ring-1', s.cls)}>
      <span className={clsx('w-1.5 h-1.5 rounded-full flex-shrink-0', s.dot)}/>{s.label}
    </span>
  )
}

export function relTime(iso) {
  const d = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000)
  if (d <= 0) return 'Today'
  if (d === 1) return 'Yesterday'
  if (d < 30) return `${d} days ago`
  return new Date(iso).toLocaleDateString([], { dateStyle: 'medium' })
}

/* ── preview modal ─────────────────────────────────────────────────────── */
export function IgPreviewModal({ template, onClose, onUse }) {
  const [dark, setDark] = useState(false)
  useEffect(() => {
    const h = e => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', h)
    return () => document.removeEventListener('keydown', h)
  }, [onClose])
  const Icon = KIND_ICON[template.kind]
  return igPortal(
    <div className="fixed inset-0 z-[60] bg-slate-900/50 flex items-center justify-center p-4 overflow-y-auto"
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="bg-white rounded-2xl shadow-modal w-full max-w-sm animate-fade-in overflow-hidden my-auto">
        <div className="flex items-center justify-between px-4 py-3 border-b border-surface-border">
          <div className="flex items-center gap-2.5 min-w-0">
            <span className={clsx('w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0', KIND_TONE[template.kind].icon)}><Icon size={14}/></span>
            <div className="min-w-0">
              <p className="text-xs font-bold text-slate-800 truncate">{template.name}</p>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className={clsx('text-[9px] font-bold px-1.5 py-0.5 rounded', KIND_TONE[template.kind].tag)}>{KINDS[template.kind].short}</span>
                <IgStatusPill status={template.status}/>
              </div>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-surface-hover text-slate-400"><X size={15}/></button>
        </div>
        <div className="p-5 bg-slate-50 flex flex-col items-center gap-3">
          <div className="flex bg-white border border-surface-border rounded-lg p-0.5">
            {[[false, Sun, 'Light'], [true, Moon, 'Dark']].map(([d, I, l]) => (
              <button key={l} onClick={() => setDark(d)}
                className={clsx('flex items-center gap-1.5 px-3 py-1 rounded-md text-[11px] font-semibold transition-colors',
                  dark === d ? 'bg-primary text-white' : 'text-slate-500 hover:text-slate-700')}>
                <I size={11}/> {l}
              </button>
            ))}
          </div>
          <IgDmPreview template={template} dark={dark} scale={0.92}/>
          <p className="text-[10.5px] text-slate-400 text-center">Shown with sample details (Ananya Rao).</p>
        </div>
        {onUse && (
          <div className="px-4 py-3 border-t border-surface-border">
            <button onClick={() => onUse(template)} className="btn-primary w-full justify-center text-xs">
              <Send size={12}/> Use in a campaign
            </button>
          </div>
        )}
      </div>
    </div>)
}

/* ── row menu ──────────────────────────────────────────────────────────── */
function RowMenu({ onPreview, onEdit, onDuplicate, onUse, onDelete }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)
  useEffect(() => {
    const h = e => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [])
  const item = (Icon, label, fn, cls = 'text-slate-700 hover:bg-surface-hover', ic = 'text-slate-400') => (
    <button onClick={() => { setOpen(false); fn() }} className={clsx('w-full flex items-center gap-2 px-3 py-2 text-xs transition-colors', cls)}>
      <Icon size={12} className={ic}/> {label}
    </button>
  )
  return (
    <div ref={ref} className="relative inline-block">
      <button onClick={() => setOpen(o => !o)} aria-label="More actions"
        className="p-1.5 rounded-lg hover:bg-surface-hover text-slate-400 hover:text-slate-600 transition-colors">
        <MoreHorizontal size={14}/>
      </button>
      {open && (
        <div className="absolute top-full right-0 mt-1 w-48 bg-white rounded-xl shadow-modal border border-surface-border z-20 py-1 animate-fade-in text-left">
          {item(Eye, 'Preview', onPreview)}
          {item(Pencil, 'Edit', onEdit)}
          {item(Copy, 'Duplicate', onDuplicate)}
          {onUse && item(Send, 'Use in campaign', onUse)}
          <div className="border-t border-surface-border my-1"/>
          {item(Trash2, 'Delete', onDelete, 'text-red-600 hover:bg-red-50', 'text-red-500')}
        </div>
      )}
    </div>
  )
}

/* ── the table ─────────────────────────────────────────────────────────── */
export default function IgTemplatesView({ templates, onCreate, onEdit, onDuplicate, onDelete, onDeleteMany, onUse }) {
  const [search, setSearch] = useState('')
  const [kindFilter, setKindFilter] = useState('ALL')
  const [statusFilter, setStatusFilter] = useState('ALL')
  const [selected, setSelected] = useState(new Set())
  const [preview, setPreview] = useState(null)
  const [confirm, setConfirm] = useState(null) // template(s) pending delete
  const [page, setPage] = useState(1)

  const tabs = [
    { key: 'ALL',   label: 'All',   count: templates.length },
    { key: 'ready', label: 'Ready', count: templates.filter(t => t.status === 'ready').length },
    { key: 'draft', label: 'Draft', count: templates.filter(t => t.status === 'draft').length },
  ]

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return templates.filter(t =>
      (!q || t.name.toLowerCase().includes(q) || summarize(t).toLowerCase().includes(q)) &&
      (kindFilter === 'ALL' || t.kind === kindFilter) &&
      (statusFilter === 'ALL' || t.status === statusFilter))
  }, [templates, search, kindFilter, statusFilter])

  useEffect(() => setPage(1), [search, kindFilter, statusFilter])
  const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const shown = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)
  const allSelected = shown.length > 0 && shown.every(t => selected.has(t.id))

  const toggle = id => setSelected(s => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n })
  const toggleAll = () => setSelected(allSelected ? new Set() : new Set(shown.map(t => t.id)))

  function doDelete() {
    if (confirm.many) { onDeleteMany([...selected]); setSelected(new Set()) }
    else onDelete(confirm.t.id)
    setConfirm(null)
  }

  const th = 'px-4 py-3 text-left text-[11px] font-semibold text-slate-400 uppercase tracking-wider whitespace-nowrap'

  return (
    <div className="card p-0 overflow-hidden">
      <div className="flex items-center justify-between px-5 py-2 border-b border-surface-border gap-3 flex-wrap min-h-[48px]">
        <div className="flex items-center gap-0.5 bg-slate-100 p-1 rounded-xl w-fit">
          {tabs.map(tab => (
            <button key={tab.key} onClick={() => setStatusFilter(tab.key)}
              className={clsx('flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-all whitespace-nowrap',
                statusFilter === tab.key ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700')}>
              {tab.label}
              {tab.count > 0 && (
                <span className={clsx('text-[10px] font-bold px-1.5 py-0.5 rounded-full',
                  statusFilter === tab.key ? 'bg-primary/10 text-primary' : 'bg-slate-200 text-slate-500')}>{tab.count}</span>
              )}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2 py-2">
          <NativeSelect value={kindFilter} onChange={e => setKindFilter(e.target.value)} sm>
            <option value="ALL">All formats</option>
            {Object.entries(KINDS).map(([k, i]) => <option key={k} value={k}>{i.label}</option>)}
          </NativeSelect>
          <div className="relative">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"/>
            <input className="pl-8 pr-3 py-1.5 text-xs border border-surface-border rounded-lg w-48 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all placeholder-slate-400"
              placeholder="Search templates…" value={search} onChange={e => setSearch(e.target.value)}/>
          </div>
        </div>
      </div>

      {selected.size > 0 && (
        <div className="flex items-center gap-3 px-5 py-2.5 bg-primary/5 border-b border-surface-border">
          <span className="text-xs font-semibold text-primary">{selected.size} selected</span>
          <div className="w-px h-4 bg-primary/20"/>
          <button className="flex items-center gap-1 text-xs text-red-600 font-medium hover:text-red-700"
            onClick={() => setConfirm({ many: true })}>
            <Trash2 size={12}/> Delete selected
          </button>
          <button className="text-xs text-slate-400 ml-auto hover:text-slate-600" onClick={() => setSelected(new Set())}>Clear</button>
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-surface-border bg-slate-50/60">
              <th className="px-5 py-3 w-10"><input type="checkbox" checked={allSelected} onChange={toggleAll} className="cursor-pointer accent-primary"/></th>
              <th className={th}>Template</th>
              <th className={th}>Format</th>
              <th className={th}>Status</th>
              <th className={th}>Sent</th>
              <th className={th}>Seen rate</th>
              <th className={th}>Last edited</th>
              <th className={clsx(th, 'text-right px-5')}>Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-surface-border">
            {shown.length === 0 ? (
              <tr>
                <td colSpan={8} className="py-16 text-center">
                  <div className="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto mb-3"><FileText size={20} className="text-slate-300"/></div>
                  <p className="text-xs font-semibold text-slate-500">{templates.length === 0 ? 'No templates yet' : 'No templates found'}</p>
                  <p className="text-xs text-slate-400 mt-1">{templates.length === 0 ? 'Create your first Instagram template to get started' : 'Try adjusting your search or filter'}</p>
                  {templates.length === 0 && (
                    <button onClick={onCreate} className="mt-3 inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-primary text-white text-xs font-semibold hover:bg-primary-hover shadow-sm">
                      <Plus size={12}/> Create Template
                    </button>
                  )}
                </td>
              </tr>
            ) : shown.map(t => {
              const tone = KIND_TONE[t.kind]
              const Icon = KIND_ICON[t.kind]
              const toks = tokensIn(t).length
              return (
                <tr key={t.id} className="hover:bg-slate-50/50 transition-colors">
                  <td className="px-5 py-4 w-10">
                    <input type="checkbox" checked={selected.has(t.id)} onChange={() => toggle(t.id)} className="cursor-pointer accent-primary"/>
                  </td>
                  <td className="px-5 py-4">
                    <button onClick={() => setPreview(t)} className="flex items-start gap-3 text-left group/n">
                      <div className={clsx('w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5', tone.icon)}><Icon size={13}/></div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 mb-0.5">
                          <p className="text-xs font-semibold text-slate-900 truncate max-w-[200px] group-hover/n:text-primary transition-colors">{t.name}</p>
                          {toks > 0 && <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-amber-50 text-amber-600 flex-shrink-0">{toks} placeholder{toks > 1 ? 's' : ''}</span>}
                        </div>
                        <p className="text-xs text-slate-400 truncate max-w-[260px]">{summarize(t) || '—'}</p>
                      </div>
                    </button>
                  </td>
                  <td className="px-4 py-4">
                    <span className={clsx('text-[9px] font-bold px-1.5 py-0.5 rounded', tone.tag)}>{KINDS[t.kind].short}</span>
                    {t.kind === 'generic' && t.elements.length > 1 && <span className="text-[10px] text-slate-400 ml-1.5 whitespace-nowrap">{t.elements.length} cards</span>}
                  </td>
                  <td className="px-4 py-4"><IgStatusPill status={t.status}/></td>
                  <td className="px-4 py-4"><p className="text-xs font-semibold text-slate-800 tabular-nums">{(t.sent ?? 0).toLocaleString()}</p></td>
                  <td className="px-4 py-4"><p className="text-xs text-slate-500 tabular-nums">{t.sent ? `${Math.round((t.seen / t.sent) * 100)}%` : '—'}</p></td>
                  <td className="px-4 py-4"><p className="text-xs text-slate-400 whitespace-nowrap">{relTime(t.updatedAt)}</p></td>
                  <td className="px-5 py-4 text-right whitespace-nowrap">
                    <button onClick={() => setPreview(t)} className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:bg-slate-100 px-2.5 py-1.5 rounded-lg transition-colors">
                      <Eye size={12}/> Preview
                    </button>
                    <button onClick={() => onEdit(t)} className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary hover:bg-primary/5 px-2.5 py-1.5 rounded-lg transition-colors">
                      <Pencil size={12}/> Edit
                    </button>
                    <RowMenu onPreview={() => setPreview(t)} onEdit={() => onEdit(t)} onDuplicate={() => onDuplicate(t)}
                      onUse={t.status === 'ready' ? () => onUse(t) : null} onDelete={() => setConfirm({ t })}/>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between px-5 py-3 border-t border-surface-border bg-slate-50/40">
        <p className="text-xs text-slate-400">
          Showing <span className="font-semibold text-slate-600">{shown.length}</span> of <span className="font-semibold text-slate-600">{filtered.length}</span> templates
        </p>
        <div className="flex items-center gap-1">
          <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="p-1.5 rounded-lg hover:bg-surface-hover text-slate-400 disabled:opacity-30"><ChevronLeft size={14}/></button>
          <button className="px-3 py-1 rounded-lg bg-primary text-white text-xs font-semibold">{page}</button>
          <button onClick={() => setPage(p => Math.min(pages, p + 1))} disabled={page === pages} className="p-1.5 rounded-lg hover:bg-surface-hover text-slate-400 disabled:opacity-30"><ChevronRight size={14}/></button>
        </div>
      </div>

      {preview && <IgPreviewModal template={preview} onClose={() => setPreview(null)} onUse={preview.status === 'ready' ? t => { setPreview(null); onUse(t) } : null}/>}

      {confirm && igPortal(
        <div className="fixed inset-0 z-[60] bg-slate-900/50 flex items-center justify-center p-4" onClick={e => e.target === e.currentTarget && setConfirm(null)}>
          <div className="bg-white rounded-2xl shadow-modal w-full max-w-sm p-5 animate-fade-in">
            <div className="w-10 h-10 rounded-xl bg-red-50 flex items-center justify-center mb-3"><Trash2 size={17} className="text-red-500"/></div>
            <h3 className="text-sm font-bold text-slate-900">
              {confirm.many ? `Delete ${selected.size} template${selected.size > 1 ? 's' : ''}?` : `Delete “${confirm.t.name}”?`}
            </h3>
            <p className="text-xs text-slate-500 mt-1.5 leading-relaxed">
              This can't be undone. Campaigns that already used {confirm.many ? 'them' : 'it'} keep their history.
            </p>
            <div className="flex justify-end gap-2 mt-5">
              <button onClick={() => setConfirm(null)} className="btn-secondary text-xs">Cancel</button>
              <button onClick={doDelete} className="px-4 py-2 rounded-lg bg-red-500 hover:bg-red-600 text-white text-xs font-semibold transition-colors">Delete</button>
            </div>
          </div>
        </div>)}
    </div>
  )
}
