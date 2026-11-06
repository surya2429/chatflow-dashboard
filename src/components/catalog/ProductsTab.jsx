import { useMemo, useState } from 'react'
import { Search, Pencil, Trash2, ImageIcon, Loader2, Upload, Package, CheckCircle2, PackageX, AlertTriangle } from 'lucide-react'
import clsx from 'clsx'
import { catalog, needsAttention, price, REVIEW } from '../../lib/catalogApi'
import { ExportMenu } from '../ai/AiData'
import { Card, Segmented, Stat, Switch, inputCls } from '../ctwa/ui'
import { productsExportTable } from './exports'

const PAGE = 25
const FILTERS = [['all', 'All'], ['in', 'In stock'], ['out', 'Out of stock'], ['issues', 'Needs attention']]

function Thumb({ src }) {
  const [bad, setBad] = useState(false)
  return (
    <span className="w-11 h-11 rounded-lg bg-slate-100 flex items-center justify-center overflow-hidden flex-shrink-0">
      {src && !bad ? <img src={src} alt="" loading="lazy" className="w-full h-full object-cover" onError={() => setBad(true)} /> : <ImageIcon size={16} className="text-slate-300" />}
    </span>
  )
}

export function ReviewPill({ product }) {
  const [label, tone, dot] = REVIEW[product.reviewStatus] || ['Unknown', 'bg-slate-100 text-slate-500', 'bg-slate-300']
  return <span title={product.reviewNote || undefined} className={clsx('inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold whitespace-nowrap', tone)}><span className={clsx('w-1.5 h-1.5 rounded-full', dot)} />{label}</span>
}

export default function ProductsTab({ catalogId, products, truncated, reload, notify, onEdit, onAdd, onImport }) {
  const [q, setQ] = useState('')
  const [filter, setFilter] = useState('all')
  const [shownCount, setShownCount] = useState(PAGE)
  const [busy, setBusy] = useState('')            // SKU with a request in flight
  const [confirm, setConfirm] = useState('')

  const counts = useMemo(() => ({ all: products.length, in: products.filter((p) => p.availability === 'in stock').length, out: products.filter((p) => p.availability === 'out of stock').length, issues: products.filter(needsAttention).length }), [products])
  const rows = useMemo(() => products.filter((p) => {
    if (filter === 'in' && p.availability !== 'in stock') return false
    if (filter === 'out' && p.availability !== 'out of stock') return false
    if (filter === 'issues' && !needsAttention(p)) return false
    const s = q.trim().toLowerCase()
    return !s || p.name.toLowerCase().includes(s) || p.retailerId.toLowerCase().includes(s) || p.brand.toLowerCase().includes(s)
  }), [products, q, filter])
  const exportTable = useMemo(() => productsExportTable(rows), [rows])

  async function act(sku, fn, ok) {
    setBusy(sku)
    try { await fn(); notify(ok); await reload() }
    catch (e) { notify(e.message, 'error') }
    finally { setBusy(''); setConfirm('') }
  }
  const toggleStock = (p, inStock) => act(p.retailerId, () => catalog.update(catalogId, { retailerId: p.retailerId, availability: inStock ? 'in stock' : 'out of stock' }), `“${p.name}” is now ${inStock ? 'in stock' : 'out of stock'}.`)
  const remove = (p) => act(p.retailerId, () => catalog.remove(catalogId, p.retailerId), `Removed “${p.name}” from the catalog.`)

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Stat label="Products" value={counts.all} icon={Package} sub={truncated ? 'First 500 shown' : null} />
        <Stat label="In stock" value={counts.in} icon={CheckCircle2} tone="text-emerald-600 bg-emerald-50" />
        <Stat label="Out of stock" value={counts.out} icon={PackageX} tone="text-slate-600 bg-slate-100" />
        <Stat label="Need attention" value={counts.issues} icon={AlertTriangle} tone="text-amber-600 bg-amber-50" sub="Rejected or in review" onClick={counts.issues ? () => setFilter('issues') : undefined} />
      </div>

      <Card bodyClass="">
        <div className="flex flex-wrap items-center gap-2 px-4 py-3 border-b border-surface-border">
          <Segmented value={filter} onChange={(k) => { setFilter(k); setShownCount(PAGE) }} options={FILTERS.map(([key, label]) => ({ key, label, count: counts[key] }))} />
          <div className="relative">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input value={q} onChange={(e) => { setQ(e.target.value); setShownCount(PAGE) }} placeholder="Search name, SKU or brand" aria-label="Search products" className={clsx(inputCls, 'pl-8 w-56')} />
          </div>
          <div className="ml-auto flex items-center gap-2">
            <button onClick={onImport} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-surface-border bg-white text-xs font-semibold text-slate-700 hover:border-primary hover:text-primary"><Upload size={12} /> Import</button>
            <ExportMenu table={exportTable} name="facebook-catalog" />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-slate-50 text-left text-[10.5px] font-semibold text-slate-500">
                {['Product', 'Price', 'Availability', 'Meta review', 'Condition', ''].map((h) => <th key={h} className="px-4 py-2.5 border-b border-surface-border whitespace-nowrap">{h}</th>)}
              </tr>
            </thead>
            <tbody>
              {rows.slice(0, shownCount).map((p) => {
                const working = busy === p.retailerId
                return (
                  <tr key={p.retailerId} onClick={(e) => !e.target.closest('button,[role=switch]') && onEdit(p)} className="border-b border-surface-border/70 hover:bg-slate-50/60 cursor-pointer align-middle">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3 min-w-[240px]">
                        <Thumb src={p.imageUrl} />
                        <div className="min-w-0">
                          <p className="font-semibold text-slate-800 truncate max-w-[280px]">{p.name}</p>
                          <p className="text-[10px] text-slate-400 font-mono">SKU {p.retailerId}{p.brand ? ` · ${p.brand}` : ''}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap tabular-nums">
                      {p.salePrice ? <><span className="font-bold text-slate-900">{price(p.salePrice, p.currency)}</span> <span className="text-[10.5px] text-slate-400 line-through">{price(p.price, p.currency)}</span></> : <span className="font-bold text-slate-900">{price(p.price, p.currency)}</span>}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        {working ? <Loader2 size={14} className="animate-spin text-slate-400" /> : <Switch on={p.availability === 'in stock'} onChange={(on) => toggleStock(p, on)} label={`${p.availability === 'in stock' ? 'Mark out of stock' : 'Mark in stock'}: ${p.name}`} />}
                        <span className="text-[11px] text-slate-600 whitespace-nowrap">{p.availability === 'in stock' ? 'In stock' : 'Out of stock'}{p.inventory !== null && ` · ${p.inventory}`}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3"><ReviewPill product={p} />{p.reviewStatus === 'rejected' && p.reviewNote && <p className="text-[10px] text-red-500 mt-1 max-w-[220px]">{p.reviewNote}</p>}</td>
                    <td className="px-4 py-3 capitalize text-slate-600">{p.condition}</td>
                    <td className="px-4 py-3 whitespace-nowrap text-right">
                      {confirm === p.retailerId ? (
                        <span className="inline-flex items-center gap-1.5 text-[11px]">Remove?
                          <button onClick={() => remove(p)} className="font-semibold text-red-600 hover:underline">Yes</button>
                          <button onClick={() => setConfirm('')} className="font-semibold text-slate-500 hover:underline">No</button>
                        </span>
                      ) : (
                        <span className="inline-flex items-center">
                          <button onClick={() => onEdit(p)} aria-label={`Edit ${p.name}`} title="Edit" className="p-1.5 rounded-lg text-slate-400 hover:text-primary hover:bg-primary-50"><Pencil size={13} /></button>
                          <button onClick={() => setConfirm(p.retailerId)} aria-label={`Remove ${p.name}`} title="Remove from catalog" className="p-1.5 rounded-lg text-slate-300 hover:text-red-500 hover:bg-red-50"><Trash2 size={13} /></button>
                        </span>
                      )}
                    </td>
                  </tr>
                )
              })}
              {!rows.length && (
                <tr><td colSpan={6} className="py-14 text-center text-slate-400">
                  {products.length ? 'No products match.' : <>This catalog has no products yet. <button onClick={onAdd} className="font-semibold text-primary hover:underline">Add a product</button> or <button onClick={onImport} className="font-semibold text-primary hover:underline">import a file</button>.</>}
                </td></tr>
              )}
            </tbody>
          </table>
        </div>
        {rows.length > shownCount && (
          <div className="px-4 py-3 border-t border-surface-border text-center">
            <button onClick={() => setShownCount((n) => n + PAGE)} className="text-xs font-semibold text-primary hover:underline">Show more ({rows.length - shownCount} left)</button>
          </div>
        )}
      </Card>
    </div>
  )
}
