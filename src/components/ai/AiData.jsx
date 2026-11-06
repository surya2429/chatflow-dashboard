import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Download, Table2, BarChart3, Maximize2, X, Check, ArrowUp, ArrowDown } from 'lucide-react'
import clsx from 'clsx'
import { GROUPS, download, fileStem, groupCounts, sortRows, toCsv, toJson, toMarkdown, toTsv } from './aiTable'

/* ── Export menu: download CSV / JSON, or copy for a spreadsheet / as Markdown ── */
export function ExportMenu({ table, name, label = 'Export', className }) {
  const [pos, setPos] = useState(null)
  const [done, setDone] = useState('')
  const btn = useRef(null)
  const menu = useRef(null)

  useEffect(() => {
    if (!pos) return
    const away = (e) => { if (!menu.current?.contains(e.target) && !btn.current?.contains(e.target)) setPos(null) }
    const esc = (e) => { if (e.key === 'Escape') setPos(null) }
    document.addEventListener('mousedown', away); document.addEventListener('keydown', esc)
    return () => { document.removeEventListener('mousedown', away); document.removeEventListener('keydown', esc) }
  }, [pos])

  const stem = fileStem(name)
  const items = [
    ['Download CSV', 'opens in Excel & Sheets', () => download(`${stem}.csv`, `﻿${toCsv(table)}`, 'text/csv')],   // BOM so Excel reads UTF-8 names correctly
    ['Download JSON', 'for developers & tools', () => download(`${stem}.json`, toJson(table), 'application/json')],
    ['Copy for Excel / Sheets', 'paste straight into cells', () => navigator.clipboard.writeText(toTsv(table))],
    ['Copy as Markdown table', 'for docs, Notion, Slack', () => navigator.clipboard.writeText(toMarkdown(table))],
  ]
  async function run(item) {
    setPos(null)
    try { await item[2](); setDone(item[0].startsWith('Copy') ? 'Copied' : 'Downloaded'); setTimeout(() => setDone(''), 1800) } catch { setDone('Failed'); setTimeout(() => setDone(''), 1800) }
  }
  function toggle() {
    if (pos) return setPos(null)
    const r = btn.current.getBoundingClientRect()
    setPos({ top: r.bottom + 4, left: Math.max(8, Math.min(r.right - 230, window.innerWidth - 238)) })
  }

  return (
    <>
      <button ref={btn} onClick={toggle} disabled={!table.rows.length} aria-haspopup="menu" aria-expanded={!!pos}
        className={clsx('inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-surface-border text-[11px] font-semibold text-slate-600 hover:border-primary hover:text-primary transition-colors disabled:opacity-40', className)}>
        {done ? <Check size={12} className="text-emerald-500" /> : <Download size={12} />} {done || label}
      </button>
      {pos && createPortal(
        <div ref={menu} role="menu" data-ai-layer style={{ position: 'fixed', top: pos.top, left: pos.left, width: 230 }} className="z-[70] bg-white rounded-xl border border-surface-border shadow-modal py-1">
          {items.map((it) => (
            <button key={it[0]} role="menuitem" onClick={() => run(it)} className="w-full text-left px-3 py-2 hover:bg-slate-50">
              <span className="block text-xs font-semibold text-slate-700">{it[0]}</span>
              <span className="block text-[10.5px] text-slate-400">{it[1]}</span>
            </button>
          ))}
          <p className="px-3 pt-1.5 pb-1 text-[10px] text-slate-400 border-t border-surface-border mt-1">{table.rows.length} rows · {table.columns.length} columns</p>
        </div>, document.body)}
    </>
  )
}

/* ── The data behind an answer, as a table or a chart ── */
function Body({ table, view, group, sort, onSort, onOpen, tall }) {
  const rows = sort.key ? sortRows(table.rows, sort.key, sort.dir) : table.rows
  if (view === 'chart') {
    const data = groupCounts(table.rows, group)
    const max = Math.max(1, ...data.map((d) => d.count))
    return (
      <div className={clsx('overflow-y-auto px-3 py-3 space-y-2', tall ? 'max-h-[60vh]' : 'max-h-64')}>
        {data.map((d) => (
          <div key={d.label} className="flex items-center gap-2 text-xs">
            <span className="w-24 flex-shrink-0 truncate text-slate-600" title={d.label}>{d.label}</span>
            <span className="flex-1 h-5 rounded bg-slate-100 overflow-hidden"><span className="block h-full rounded bg-primary/80" style={{ width: `${(d.count / max) * 100}%` }} /></span>
            <span className="w-14 text-right tabular-nums font-semibold text-slate-700">{d.count} <span className="font-normal text-slate-400">{Math.round((d.count / table.rows.length) * 100)}%</span></span>
          </div>
        ))}
      </div>
    )
  }
  return (
    <div className={clsx('overflow-auto', tall ? 'max-h-[60vh]' : 'max-h-64')}>
      <table className="w-full text-[11.5px] border-separate border-spacing-0">
        <thead>
          <tr>
            {table.columns.map((c, i) => (
              <th key={c.key} scope="col" aria-sort={sort.key === c.key ? (sort.dir === 'asc' ? 'ascending' : 'descending') : 'none'}
                className={clsx('sticky top-0 z-10 bg-slate-50 border-b border-surface-border text-left font-semibold text-slate-500 whitespace-nowrap', i === 0 && 'left-0 z-20')}>
                <button onClick={() => onSort(c.key)} className="inline-flex items-center gap-1 px-2.5 py-1.5 w-full hover:text-slate-800">
                  {c.label}{sort.key === c.key && (sort.dir === 'asc' ? <ArrowUp size={10} /> : <ArrowDown size={10} />)}
                </button>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} className="hover:bg-slate-50/70">
              {table.columns.map((c, i) => (
                <td key={c.key} className={clsx('px-2.5 py-1.5 border-b border-surface-border/60 text-slate-600 align-top', c.key === 'lastMessage' || c.key === 'why' ? 'min-w-[180px] max-w-[260px]' : 'whitespace-nowrap', i === 0 && 'sticky left-0 bg-white font-semibold text-slate-800')}>
                  {i === 0 && onOpen ? <button onClick={() => onOpen(r.id)} title="Open chat" className="hover:text-primary hover:underline text-left">{r[c.key]}</button> : r[c.key]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export function DataPanel({ table, name, onOpen, defaultView = 'table', footer }) {
  const [view, setView] = useState(defaultView)
  const [group, setGroup] = useState('status')
  const [sort, setSort] = useState({ key: '', dir: 'asc' })
  const [big, setBig] = useState(false)
  const groups = GROUPS.filter(([k]) => table.columns.some((c) => c.key === k))
  const onSort = (key) => setSort((s) => (s.key === key ? (s.dir === 'asc' ? { key, dir: 'desc' } : { key: '', dir: 'asc' }) : { key, dir: 'asc' }))

  const head = (inModal) => (
    <div className="flex items-center gap-2 px-2.5 py-2 border-b border-surface-border bg-white flex-wrap">
      <div className="inline-flex bg-slate-100 rounded-lg p-0.5" role="tablist">
        {[['table', Table2, 'Table'], ['chart', BarChart3, 'Chart']].map(([k, Icon, lbl]) => (
          <button key={k} role="tab" aria-selected={view === k} onClick={() => setView(k)}
            className={clsx('inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-semibold transition-colors', view === k ? 'bg-white shadow-sm text-slate-800' : 'text-slate-500 hover:text-slate-700')}>
            <Icon size={11} /> {lbl}
          </button>
        ))}
      </div>
      {view === 'chart' && (
        <label className="inline-flex items-center gap-1.5 text-[11px] text-slate-500">By
          <select value={group} onChange={(e) => setGroup(e.target.value)} className="rounded-md border border-surface-border bg-white px-1.5 py-0.5 text-[11px] text-slate-700 outline-none">
            {groups.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
          </select>
        </label>
      )}
      <span className="text-[10.5px] text-slate-400">{table.rows.length} {table.rows.length === 1 ? 'chat' : 'chats'}</span>
      <div className="ml-auto flex items-center gap-1.5">
        <ExportMenu table={table} name={name} />
        {!inModal && <button onClick={() => setBig(true)} aria-label="Expand" title="Expand" className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100"><Maximize2 size={12} /></button>}
      </div>
    </div>
  )

  return (
    <>
      <div className="mt-3 rounded-xl border border-surface-border bg-white overflow-hidden">
        {head(false)}
        <Body table={table} view={view} group={group} sort={sort} onSort={onSort} onOpen={onOpen} />
        {footer && <div className="px-3 py-2 border-t border-surface-border bg-slate-50/60 text-[10.5px] text-slate-500 flex items-center gap-2 flex-wrap">{footer}</div>}
      </div>
      {big && createPortal(
        <div data-ai-layer className="fixed inset-0 z-[65] bg-slate-900/40 flex items-center justify-center p-4" onClick={(e) => e.target === e.currentTarget && setBig(false)}>
          <div role="dialog" aria-label="Data" className="bg-white rounded-2xl shadow-modal w-full max-w-5xl overflow-hidden">
            <div className="flex items-center px-4 py-3 border-b border-surface-border">
              <p className="text-sm font-bold text-slate-800 flex-1 truncate">{name || 'Data'}</p>
              <button onClick={() => setBig(false)} aria-label="Close" className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100"><X size={15} /></button>
            </div>
            {head(true)}
            <Body table={table} view={view} group={group} sort={sort} onSort={onSort} onOpen={onOpen && ((id) => { setBig(false); onOpen(id) })} tall />
          </div>
        </div>, document.body)}
    </>
  )
}
