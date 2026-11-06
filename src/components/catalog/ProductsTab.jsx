import { Fragment, useEffect, useMemo, useRef, useState } from 'react'
import { Search, Pencil, Trash2, ImageIcon, Loader2, Upload, Package, CheckCircle2, PackageX, AlertTriangle, ChevronRight, ChevronLeft, Columns3, ListFilter, Layers, X } from 'lucide-react'
import clsx from 'clsx'
import { catalog, needsAttention, price, REVIEW } from '../../lib/catalogApi'
import { ExportMenu } from '../ai/AiData'
import { NativeSelect } from '../Select'
import { Card, Segmented, Stat, Switch, inputCls } from '../ctwa/ui'
import { productsExportTable } from './exports'
import { groupProducts } from './groups'

const FILTERS = [['all', 'All products'], ['in', 'In stock'], ['out', 'Out of stock'], ['issues', 'Actions needed']]
const COLUMNS = [['status', 'Meta review'], ['variants', 'Variants'], ['availability', 'Availability'], ['price', 'Price'], ['brand', 'Brand'], ['condition', 'Condition']]
const COL_KEY = 'catalog.columns'
const loadCols = () => { try { return JSON.parse(localStorage.getItem(COL_KEY)) || ['status', 'variants', 'availability', 'price'] } catch { return ['status', 'variants', 'availability', 'price'] } }
const range = (g) => (g.min === g.max ? price(g.min, g.currency) : `${price(g.min, g.currency)}–${price(g.max, g.currency)}`)

function Thumb({ src }) {
  const [bad, setBad] = useState(false)
  return (
    <span className="w-11 h-11 rounded-lg bg-slate-100 flex items-center justify-center overflow-hidden flex-shrink-0">
      {src && !bad ? <img src={src} alt="" loading="lazy" className="w-full h-full object-cover" onError={() => setBad(true)} /> : <ImageIcon size={16} className="text-slate-300" />}
    </span>
  )
}

export function ReviewPill({ status, note }) {
  const [label, tone, dot] = REVIEW[status] || ['Unknown', 'bg-slate-100 text-slate-500', 'bg-slate-300']
  return <span title={note || undefined} className={clsx('inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold whitespace-nowrap', tone)}><span className={clsx('w-1.5 h-1.5 rounded-full', dot)} />{label}</span>
}

/** A button that opens a small panel and closes when you click elsewhere. */
function Popover({ label, icon: Icon, children, active }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)
  useEffect(() => {
    if (!open) return
    const off = (e) => { if (!ref.current?.contains(e.target) && !e.target.closest('[style*="99999"]')) setOpen(false) }
    document.addEventListener('mousedown', off)
    return () => document.removeEventListener('mousedown', off)
  }, [open])
  return (
    <div ref={ref} className="relative">
      <button onClick={() => setOpen((o) => !o)} aria-expanded={open} className={clsx('inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border bg-white text-xs font-semibold hover:border-primary hover:text-primary', active ? 'border-primary text-primary' : 'border-surface-border text-slate-700')}><Icon size={13} /> {label}</button>
      {open && <div className="absolute left-0 top-full mt-2 z-30 w-64 bg-white border border-surface-border rounded-xl shadow-modal p-3 space-y-3">{children}</div>}
    </div>
  )
}

export default function ProductsTab({ catalogId, products, truncated, total, reload, notify, onEdit, onAdd, onImport, onCreateSet }) {
  const [q, setQ] = useState('')
  const [tab, setTab] = useState('all')
  const [f, setF] = useState({ brand: '', condition: '', review: '' })
  const [cols, setCols] = useState(loadCols)
  const [open, setOpen] = useState(() => new Set())       // expanded group keys
  const [picked, setPicked] = useState(() => new Set())   // selected SKUs
  const [page, setPage] = useState(0)
  const [size, setSize] = useState(15)
  const [busy, setBusy] = useState('')
  const [confirm, setConfirm] = useState('')              // 'bulk' or a SKU / group key awaiting "Remove?"

  const brands = useMemo(() => [...new Set(products.map((p) => p.brand).filter(Boolean))].sort(), [products])
  const counts = useMemo(() => ({ all: products.length, in: products.filter((p) => p.availability === 'in stock').length, out: products.filter((p) => p.availability === 'out of stock').length, issues: products.filter(needsAttention).length }), [products])

  const visible = useMemo(() => products.filter((p) => {
    if (tab === 'in' && p.availability !== 'in stock') return false
    if (tab === 'out' && p.availability !== 'out of stock') return false
    if (tab === 'issues' && !needsAttention(p)) return false
    if (f.brand && p.brand !== f.brand) return false
    if (f.condition && p.condition !== f.condition) return false
    if (f.review && p.reviewStatus !== f.review) return false
    const s = q.trim().toLowerCase()
    return !s || p.name.toLowerCase().includes(s) || p.retailerId.toLowerCase().includes(s) || p.brand.toLowerCase().includes(s) || p.groupId.toLowerCase().includes(s)
  }), [products, q, tab, f])
  const groups = useMemo(() => groupProducts(visible), [visible])
  const pages = Math.max(1, Math.ceil(groups.length / size))
  const shown = groups.slice(page * size, page * size + size)
  const exportTable = useMemo(() => productsExportTable(visible), [visible])
  const activeFilters = Object.entries(f).filter(([, v]) => v)
  const show = (c) => cols.includes(c)

  const reset = () => setPage(0)
  const toggleCol = (c) => setCols((cur) => { const n = cur.includes(c) ? cur.filter((x) => x !== c) : [...cur, c]; try { localStorage.setItem(COL_KEY, JSON.stringify(n)) } catch { /* not remembered */ } return n })
  const flip = (set, setter, v) => setter((cur) => { const n = new Set(cur); n.has(v) ? n.delete(v) : n.add(v); return n })
  const pickMany = (skus, on) => setPicked((cur) => { const n = new Set(cur); skus.forEach((s) => (on ? n.add(s) : n.delete(s))); return n })

  async function act(key, fn, ok) {
    setBusy(key)
    try { await fn(); notify(ok); setPicked(new Set()); await reload() }
    catch (e) { notify(e.message, 'error') }
    finally { setBusy(''); setConfirm('') }
  }
  const stock = (skus, inStock, label) => act(label, () => catalog.bulk(catalogId, skus, inStock ? 'in stock' : 'out of stock'), `${skus.length} ${skus.length === 1 ? 'product is' : 'products are'} now ${inStock ? 'in stock' : 'out of stock'}.`)
  const remove = (skus, key) => act(key, () => catalog.bulk(catalogId, skus, 'delete'), `Removed ${skus.length} ${skus.length === 1 ? 'product' : 'products'} from the catalog.`)
  const chosen = [...picked]

  const th = 'px-3 py-2.5 border-b border-surface-border whitespace-nowrap'

  const renderRow = (g) => {
    const expanded = open.has(g.key)
    const skus = g.items.map((i) => i.retailerId)
    const all = skus.every((s) => picked.has(s)), some = skus.some((s) => picked.has(s))
    const only = g.items[0]
    return (
      <>
        <tr onClick={(e) => { if (e.target.closest('button,input,[role=switch]')) return; g.isGroup ? flip(open, setOpen, g.key) : onEdit(only) }} className="border-b border-surface-border/70 hover:bg-slate-50/60 cursor-pointer align-middle">
          <td className="pl-3 py-3 w-8"><input type="checkbox" checked={all} ref={(el) => el && (el.indeterminate = some && !all)} onChange={(e) => pickMany(skus, e.target.checked)} aria-label={`Select ${g.name}`} className="rounded border-slate-300" /></td>
          <td className="px-1 py-3 w-6">{g.isGroup && <button onClick={() => flip(open, setOpen, g.key)} aria-label={expanded ? 'Hide variants' : 'Show variants'} aria-expanded={expanded} className="p-0.5 text-slate-500"><ChevronRight size={14} className={clsx('transition-transform', expanded && 'rotate-90')} /></button>}</td>
          <td className="px-3 py-3">
            <div className="flex items-center gap-3 min-w-[240px]">
              <Thumb src={g.image} />
              <div className="min-w-0">
                <p className="font-semibold text-slate-800 truncate max-w-[300px]">{g.isGroup ? g.name.replace(/\s*\([^)]*\)\s*$/, '') : g.name}</p>
                <p className="text-[10px] text-slate-400 font-mono">{g.isGroup ? `Group ID: ${g.groupId}` : `SKU ${only.retailerId}`}{g.brand && !show('brand') ? ` · ${g.brand}` : ''}</p>
              </div>
            </div>
          </td>
          {show('status') && <td className="px-3 py-3"><ReviewPill status={g.status} note={only.reviewNote} />{!g.isGroup && only.reviewStatus === 'rejected' && only.reviewNote && <p className="text-[10px] text-red-500 mt-1 max-w-[200px]">{only.reviewNote}</p>}</td>}
          {show('variants') && <td className="px-3 py-3 tabular-nums text-slate-700">{g.items.length}</td>}
          {show('availability') && (
            <td className="px-3 py-3">
              {g.isGroup ? <p className="text-[11px] text-slate-700 whitespace-nowrap font-semibold">{g.inStock === g.items.length ? 'In stock' : g.inStock === 0 ? 'Out of stock' : 'Partly in stock'}<span className="block text-[10px] font-normal text-slate-400">{g.inStock} of {g.items.length} variants</span></p>
                : <div className="flex items-center gap-2">
                  {busy === only.retailerId ? <Loader2 size={14} className="animate-spin text-slate-400" /> : <Switch on={only.availability === 'in stock'} onChange={(on) => stock([only.retailerId], on, only.retailerId)} label={`${only.availability === 'in stock' ? 'Mark out of stock' : 'Mark in stock'}: ${only.name}`} />}
                  <span className="text-[11px] text-slate-600 whitespace-nowrap">{only.availability === 'in stock' ? 'In stock' : 'Out of stock'}{only.inventory !== null && ` · ${only.inventory}`}</span>
                </div>}
            </td>
          )}
          {show('price') && <td className="px-3 py-3 whitespace-nowrap tabular-nums font-bold text-slate-900">{range(g)}</td>}
          {show('brand') && <td className="px-3 py-3 text-slate-600">{g.brand || '—'}</td>}
          {show('condition') && <td className="px-3 py-3 capitalize text-slate-600">{g.isGroup ? '' : only.condition}</td>}
          <td className="px-3 py-3 whitespace-nowrap text-right">
            {confirm === g.key ? (
              <span className="inline-flex items-center gap-1.5 text-[11px]">Remove{g.isGroup ? ` ${g.items.length}` : ''}?
                <button onClick={() => remove(skus, g.key)} className="font-semibold text-red-600 hover:underline">Yes</button>
                <button onClick={() => setConfirm('')} className="font-semibold text-slate-500 hover:underline">No</button>
              </span>
            ) : (
              <span className="inline-flex items-center">
                {!g.isGroup && <button onClick={() => onEdit(only)} aria-label={`Edit ${only.name}`} title="Edit" className="p-1.5 rounded-lg text-slate-400 hover:text-primary hover:bg-primary-50"><Pencil size={13} /></button>}
                <button onClick={() => setConfirm(g.key)} aria-label={`Remove ${g.name}`} title={g.isGroup ? 'Remove all variants' : 'Remove from catalog'} className="p-1.5 rounded-lg text-slate-300 hover:text-red-500 hover:bg-red-50"><Trash2 size={13} /></button>
              </span>
            )}
          </td>
        </tr>
        {expanded && g.items.map((v) => (
          <tr key={v.retailerId} onClick={(e) => !e.target.closest('button,input,[role=switch]') && onEdit(v)} className="border-b border-surface-border/50 bg-slate-50/60 hover:bg-slate-100/60 cursor-pointer align-middle">
            <td className="pl-3 py-2.5 w-8"><input type="checkbox" checked={picked.has(v.retailerId)} onChange={() => flip(picked, setPicked, v.retailerId)} aria-label={`Select ${v.name}`} className="rounded border-slate-300" /></td>
            <td />
            <td className="px-3 py-2.5 pl-8"><p className="text-xs font-semibold text-slate-700">{[v.size, v.color].filter(Boolean).join(' · ') || v.name}</p><p className="text-[10px] text-slate-400 font-mono">SKU {v.retailerId}</p></td>
            {show('status') && <td className="px-3 py-2.5"><ReviewPill status={v.reviewStatus} note={v.reviewNote} /></td>}
            {show('variants') && <td />}
            {show('availability') && <td className="px-3 py-2.5"><div className="flex items-center gap-2">{busy === v.retailerId ? <Loader2 size={14} className="animate-spin text-slate-400" /> : <Switch on={v.availability === 'in stock'} onChange={(on) => stock([v.retailerId], on, v.retailerId)} label={`${v.availability === 'in stock' ? 'Mark out of stock' : 'Mark in stock'}: ${v.name}`} />}<span className="text-[11px] text-slate-600 whitespace-nowrap">{v.availability === 'in stock' ? 'In stock' : 'Out of stock'}{v.inventory !== null && ` · ${v.inventory}`}</span></div></td>}
            {show('price') && <td className="px-3 py-2.5 whitespace-nowrap tabular-nums text-slate-800">{price(v.salePrice || v.price, v.currency)}{v.salePrice ? <span className="ml-1 text-[10px] text-slate-400 line-through">{price(v.price, v.currency)}</span> : null}</td>}
            {show('brand') && <td className="px-3 py-2.5 text-slate-600">{v.brand || '—'}</td>}
            {show('condition') && <td className="px-3 py-2.5 capitalize text-slate-600">{v.condition}</td>}
            <td className="px-3 py-2.5 text-right"><button onClick={() => onEdit(v)} aria-label={`Edit ${v.name}`} title="Edit" className="p-1.5 rounded-lg text-slate-400 hover:text-primary hover:bg-primary-50"><Pencil size={13} /></button></td>
          </tr>
        ))}
      </>
    )
  }

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Stat label="Products" value={counts.all} icon={Package} sub={`${groups.length === visible.length ? '' : `${groups.length} items with variants`}${truncated ? ` · first ${products.length} of ${total ?? '…'} loaded` : ''}`.replace(/^ · /, '') || null} />
        <Stat label="In stock" value={counts.in} icon={CheckCircle2} tone="text-emerald-600 bg-emerald-50" />
        <Stat label="Out of stock" value={counts.out} icon={PackageX} tone="text-slate-600 bg-slate-100" />
        <Stat label="Actions needed" value={counts.issues} icon={AlertTriangle} tone="text-amber-600 bg-amber-50" sub="Rejected or in review" onClick={counts.issues ? () => { setTab('issues'); reset() } : undefined} />
      </div>

      <Card bodyClass="">
        <div className="px-4 pt-3"><Segmented value={tab} onChange={(k) => { setTab(k); reset() }} options={FILTERS.map(([key, label]) => ({ key, label, count: counts[key] }))} /></div>
        <div className="flex flex-wrap items-center gap-2 px-4 py-3">
          <div className="relative flex-1 min-w-[220px]">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input value={q} onChange={(e) => { setQ(e.target.value); reset() }} placeholder="Search name, SKU, group ID or brand" aria-label="Search products" className={clsx(inputCls, 'pl-8')} />
          </div>
          <Popover label="Add filter" icon={ListFilter} active={activeFilters.length > 0}>
            {[['brand', 'Brand', brands.map((b) => [b, b])], ['condition', 'Condition', [['new', 'New'], ['refurbished', 'Refurbished'], ['used', 'Used']]], ['review', 'Meta review', Object.entries(REVIEW).map(([k, v]) => [k, v[0]])]].map(([key, label, opts]) => (
              <div key={key}><p className="text-[10.5px] font-semibold text-slate-500 mb-1">{label}</p>
                <NativeSelect sm value={f[key]} onChange={(e) => { setF((s) => ({ ...s, [key]: e.target.value })); reset() }}><option value="">Any</option>{opts.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</NativeSelect></div>
            ))}
          </Popover>
          <Popover label="Columns" icon={Columns3}>
            <p className="text-[10.5px] font-semibold text-slate-500">Show columns</p>
            {COLUMNS.map(([k, l]) => <label key={k} className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer"><input type="checkbox" checked={cols.includes(k)} onChange={() => toggleCol(k)} className="rounded border-slate-300" /> {l}</label>)}
          </Popover>
          <button onClick={onImport} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-surface-border bg-white text-xs font-semibold text-slate-700 hover:border-primary hover:text-primary"><Upload size={12} /> Import</button>
          <ExportMenu table={exportTable} name="facebook-catalog" />
        </div>
        {activeFilters.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5 px-4 pb-3">
            {activeFilters.map(([k, v]) => <span key={k} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-primary-50 text-primary text-[10.5px] font-semibold">{k === 'review' ? 'Review' : k[0].toUpperCase() + k.slice(1)}: {REVIEW[v]?.[0] || v}<button onClick={() => { setF((s) => ({ ...s, [k]: '' })); reset() }} aria-label={`Remove ${k} filter`}><X size={11} /></button></span>)}
            <button onClick={() => { setF({ brand: '', condition: '', review: '' }); reset() }} className="text-[10.5px] font-semibold text-slate-500 hover:text-primary">Clear all</button>
          </div>
        )}

        {chosen.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 px-4 py-2.5 bg-primary-50/60 border-y border-primary/10 text-xs">
            <span className="font-semibold text-slate-800">{chosen.length} selected</span>
            <button onClick={() => stock(chosen, true, 'bulk')} disabled={!!busy} className="px-2.5 py-1 rounded-lg bg-white border border-surface-border font-semibold text-slate-700 hover:border-primary hover:text-primary disabled:opacity-50">Mark in stock</button>
            <button onClick={() => stock(chosen, false, 'bulk')} disabled={!!busy} className="px-2.5 py-1 rounded-lg bg-white border border-surface-border font-semibold text-slate-700 hover:border-primary hover:text-primary disabled:opacity-50">Mark out of stock</button>
            <button onClick={() => onCreateSet(chosen)} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white border border-surface-border font-semibold text-slate-700 hover:border-primary hover:text-primary"><Layers size={12} /> Create set</button>
            {confirm === 'bulk' ? <span className="inline-flex items-center gap-1.5 text-[11px]">Remove {chosen.length} from the catalog?<button onClick={() => remove(chosen, 'bulk')} className="font-semibold text-red-600 hover:underline">Yes</button><button onClick={() => setConfirm('')} className="font-semibold text-slate-500 hover:underline">No</button></span>
              : <button onClick={() => setConfirm('bulk')} className="px-2.5 py-1 rounded-lg bg-white border border-red-200 font-semibold text-red-600 hover:bg-red-50">Remove</button>}
            {busy === 'bulk' && <Loader2 size={14} className="animate-spin text-slate-400" />}
            <button onClick={() => setPicked(new Set())} className="ml-auto font-semibold text-slate-500 hover:text-primary">Clear selection</button>
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-slate-50 text-left text-[10.5px] font-semibold text-slate-500">
                <th className="pl-3 py-2.5 border-b border-surface-border w-8"><input type="checkbox" aria-label="Select all on this page" checked={shown.length > 0 && shown.every((g) => g.items.every((i) => picked.has(i.retailerId)))} onChange={(e) => pickMany(shown.flatMap((g) => g.items.map((i) => i.retailerId)), e.target.checked)} className="rounded border-slate-300" /></th>
                <th className="border-b border-surface-border w-6" />
                <th className={th}>Name</th>
                {show('status') && <th className={th}>Meta review</th>}
                {show('variants') && <th className={th}>Variants</th>}
                {show('availability') && <th className={th}>Availability</th>}
                {show('price') && <th className={th}>Price</th>}
                {show('brand') && <th className={th}>Brand</th>}
                {show('condition') && <th className={th}>Condition</th>}
                <th className={th} />
              </tr>
            </thead>
            <tbody>
              {shown.map((g) => <Fragment key={g.key}>{renderRow(g)}</Fragment>)}
              {!shown.length && (
                <tr><td colSpan={10} className="py-14 text-center text-slate-400">
                  {products.length ? 'No products match.' : <>This catalog has no products yet. <button onClick={onAdd} className="font-semibold text-primary hover:underline">Add a product</button> or <button onClick={onImport} className="font-semibold text-primary hover:underline">import a file</button>.</>}
                </td></tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="flex items-center justify-end gap-3 px-4 py-3 border-t border-surface-border text-[11px] text-slate-500">
          <span>Page {Math.min(page + 1, pages)} of {pages}</span>
          <NativeSelect sm value={String(size)} onChange={(e) => { setSize(Number(e.target.value)); reset() }} className="!w-16"><option value="15">15</option><option value="25">25</option><option value="50">50</option><option value="100">100</option></NativeSelect>
          <button onClick={() => setPage((p) => Math.max(0, p - 1))} disabled={page === 0} aria-label="Previous page" className="p-1.5 rounded-lg border border-surface-border disabled:opacity-40 hover:border-primary"><ChevronLeft size={14} /></button>
          <button onClick={() => setPage((p) => Math.min(pages - 1, p + 1))} disabled={page >= pages - 1} aria-label="Next page" className="p-1.5 rounded-lg border border-surface-border disabled:opacity-40 hover:border-primary"><ChevronRight size={14} /></button>
        </div>
      </Card>
    </div>
  )
}
