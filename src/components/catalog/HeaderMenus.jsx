import { useEffect, useRef, useState } from 'react'
import { ChevronDown, FileSpreadsheet, LayoutGrid, Pencil, Plus, Settings2, Wand2 } from 'lucide-react'
import clsx from 'clsx'

function useOutside(onOutside) {
  const ref = useRef(null)
  useEffect(() => {
    const off = (e) => { if (!ref.current?.contains(e.target)) onOutside() }
    document.addEventListener('mousedown', off)
    return () => document.removeEventListener('mousedown', off)
  }, [onOutside])
  return ref
}

/** Which catalog you are working in, listed like Commerce Manager's catalogue picker. */
export function CatalogSwitcher({ catalogs, value, onChange, onManage }) {
  const [open, setOpen] = useState(false)
  const ref = useOutside(() => setOpen(false))
  const current = catalogs.find((c) => c.id === value)
  return (
    <div ref={ref} className="relative">
      <button onClick={() => setOpen((o) => !o)} aria-expanded={open} aria-haspopup="listbox" className={clsx('flex items-center gap-2 pl-2 pr-2.5 py-1.5 rounded-lg border bg-white text-xs font-semibold text-slate-700 max-w-[220px]', open ? 'border-primary' : 'border-surface-border hover:border-primary/50')}>
        <LayoutGrid size={13} className="text-slate-400 flex-shrink-0" /><span className="truncate">{current?.name || 'Choose a catalog'}</span><ChevronDown size={12} className="text-slate-400 flex-shrink-0" />
      </button>
      {open && (
        <div role="listbox" aria-label="Catalogs" className="absolute right-0 top-full mt-2 z-40 w-72 bg-white border border-surface-border rounded-xl shadow-modal overflow-hidden">
          <div className="px-4 py-3 border-b border-surface-border"><p className="text-xs font-bold text-slate-800">{catalogs.length} {catalogs.length === 1 ? 'catalog' : 'catalogs'}</p><p className="text-[10.5px] text-slate-400">Pick the one to manage</p></div>
          <ul className="max-h-72 overflow-y-auto p-1.5">
            {catalogs.map((c) => (
              <li key={c.id}>
                <button role="option" aria-selected={c.id === value} onClick={() => { onChange(c.id); setOpen(false) }} className={clsx('w-full flex items-center gap-3 px-2.5 py-2 rounded-lg text-left hover:bg-slate-50', c.id === value && 'bg-primary-50/60')}>
                  <span className={clsx('w-4 h-4 rounded-full border flex items-center justify-center flex-shrink-0', c.id === value ? 'border-primary' : 'border-slate-300')}>{c.id === value && <span className="w-2 h-2 rounded-full bg-primary" />}</span>
                  <span className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center flex-shrink-0"><LayoutGrid size={14} className="text-slate-400" /></span>
                  <span className="min-w-0"><span className="block text-xs font-semibold text-slate-800 truncate">{c.name}</span><span className="block text-[10.5px] text-slate-400">{c.productCount !== null ? `${c.productCount} products` : 'Catalog'}</span></span>
                </button>
              </li>
            ))}
          </ul>
          <button onClick={() => { setOpen(false); onManage() }} className="w-full flex items-center gap-2 px-4 py-2.5 border-t border-surface-border text-[11px] font-semibold text-slate-600 hover:bg-slate-50"><Settings2 size={12} /> Create or connect a catalog</button>
        </div>
      )}
    </div>
  )
}

/** "Add" menu: the ways to put products into the catalog. */
export function AddMenu({ disabled, onManual, onFile, onSupplementary }) {
  const [open, setOpen] = useState(false)
  const ref = useOutside(() => setOpen(false))
  const items = [
    ['Add products via', null],
    ['Data file', FileSpreadsheet, 'Add or update many products from a CSV file', onFile],
    ['Manual entry', Pencil, 'Add products one at a time by filling in a form', onManual],
    ['Upload additional information', null],
    ['Supplementary data', Wand2, 'Fill in details that are missing or wrong on products you already have', onSupplementary],
  ]
  return (
    <div ref={ref} className="relative">
      <button onClick={() => setOpen((o) => !o)} disabled={disabled} aria-expanded={open} aria-haspopup="menu" className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary text-white text-xs font-semibold hover:bg-primary-hover transition-colors shadow-sm whitespace-nowrap disabled:opacity-50"><Plus size={13} /> Add <ChevronDown size={12} /></button>
      {open && (
        <div role="menu" className="absolute right-0 top-full mt-2 z-40 w-72 bg-white border border-surface-border rounded-xl shadow-modal py-1.5">
          {items.map(([label, Icon, hint, fn]) => Icon ? (
            <button key={label} role="menuitem" onClick={() => { setOpen(false); fn() }} className="w-full flex items-start gap-3 px-4 py-2.5 text-left hover:bg-slate-50">
              <Icon size={15} className="text-slate-500 mt-0.5 flex-shrink-0" /><span><span className="block text-xs font-semibold text-slate-800">{label}</span><span className="block text-[10.5px] text-slate-400 leading-snug">{hint}</span></span>
            </button>
          ) : <p key={label} className="px-4 pt-2.5 pb-1 text-[10px] font-bold text-slate-400 uppercase tracking-wide">{label}</p>)}
        </div>
      )}
    </div>
  )
}

