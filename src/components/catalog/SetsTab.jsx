import { useCallback, useEffect, useMemo, useState } from 'react'
import { ImageIcon, Layers, Loader2, Plus, Search, Trash2 } from 'lucide-react'
import clsx from 'clsx'
import { catalog, price } from '../../lib/catalogApi'
import { Banner, Card, Drawer, Field, Segmented, Spinner, inputCls } from '../ctwa/ui'

/* Product sets: named groups of products ("All Products", "Summer collection"). WhatsApp collections and multi-product messages
   are built from them. A set is either a list of chosen products or rules that Meta keeps applying as the catalog changes. */

export function SetDrawer({ catalogId, products, initialIds = [], onClose, onSaved, notify }) {
  const [name, setName] = useState('')
  const [mode, setMode] = useState(initialIds.length ? 'pick' : 'rules')
  const [ids, setIds] = useState(initialIds)
  const [q, setQ] = useState('')
  const [rules, setRules] = useState({ name: '', brand: '', availability: '' })
  const [errors, setErrors] = useState({})
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const brands = useMemo(() => [...new Set(products.map((p) => p.brand).filter(Boolean))].sort(), [products])
  const list = useMemo(() => products.filter((p) => !q.trim() || `${p.name} ${p.retailerId}`.toLowerCase().includes(q.trim().toLowerCase())).slice(0, 200), [products, q])
  const toggle = (id) => setIds((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]))

  async function save() {
    setBusy(true); setErrors({}); setError('')
    try {
      const r = await catalog.createSet(catalogId, mode === 'pick' ? { name, retailerIds: ids } : { name, rules: Object.fromEntries(Object.entries(rules).filter(([, v]) => v)) })
      notify(`Created the set “${name.trim()}”.`)
      onSaved(r.set)
    } catch (e) { setErrors(e.fields || {}); setError(e.fields ? 'Some details need fixing.' : e.message) }
    finally { setBusy(false) }
  }

  return (
    <Drawer onClose={onClose} width="max-w-[540px]" title={<h2 className="text-sm font-bold text-slate-900">Create a product set</h2>} sub={<p className="text-[11px] text-slate-500">Group products to share them together on WhatsApp.</p>}>
      <div className="p-5 space-y-4">
        {error && <Banner tone="error">{error}</Banner>}
        <Field label="Set name" error={errors.name}><input value={name} onChange={(e) => setName(e.target.value)} maxLength={100} className={inputCls} placeholder="e.g. Summer collection" /></Field>
        <Segmented value={mode} onChange={setMode} options={[{ key: 'pick', label: 'Choose products' }, { key: 'rules', label: 'Use rules' }]} />
        {errors.filter && <p role="alert" className="text-[10.5px] text-red-600">{errors.filter}</p>}
        {mode === 'pick' ? (
          <>
            <div className="relative"><Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search products" aria-label="Search products" className={clsx(inputCls, 'pl-8')} /></div>
            <ul className="max-h-80 overflow-y-auto border border-surface-border rounded-xl divide-y divide-surface-border/70 bg-white">
              {list.map((p) => (
                <li key={p.retailerId}><label className="flex items-center gap-3 px-3 py-2 cursor-pointer hover:bg-slate-50">
                  <input type="checkbox" checked={ids.includes(p.retailerId)} onChange={() => toggle(p.retailerId)} className="rounded border-slate-300" />
                  <span className="min-w-0 flex-1"><span className="block text-xs font-semibold text-slate-800 truncate">{p.name}</span><span className="block text-[10px] text-slate-400 font-mono">{p.retailerId}</span></span>
                </label></li>
              ))}
              {!list.length && <li className="px-3 py-8 text-center text-xs text-slate-400">No products to pick.</li>}
            </ul>
            <p className="text-[10.5px] text-slate-400">{ids.length} selected</p>
          </>
        ) : (
          <div className="space-y-3">
            <p className="text-[11px] text-slate-500">Products that match all the rules you fill in are in the set, now and as the catalog changes.</p>
            <Field label="Name contains"><input value={rules.name} onChange={(e) => setRules({ ...rules, name: e.target.value })} className={inputCls} placeholder="e.g. shirt" /></Field>
            <Field label="Brand is"><select value={rules.brand} onChange={(e) => setRules({ ...rules, brand: e.target.value })} className={inputCls}><option value="">Any brand</option>{brands.map((b) => <option key={b} value={b}>{b}</option>)}</select></Field>
            <Field label="Availability is"><select value={rules.availability} onChange={(e) => setRules({ ...rules, availability: e.target.value })} className={inputCls}><option value="">Any</option><option value="in stock">In stock</option><option value="out of stock">Out of stock</option></select></Field>
          </div>
        )}
        <div className="flex justify-end gap-2 pt-1">
          <button onClick={onClose} className="px-3.5 py-2 rounded-lg text-xs font-semibold text-slate-600 hover:bg-slate-100">Cancel</button>
          <button onClick={save} disabled={busy} className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-primary text-white text-xs font-semibold hover:bg-primary-hover disabled:opacity-60">{busy && <Loader2 size={13} className="animate-spin" />} Create set</button>
        </div>
      </div>
    </Drawer>
  )
}

function SetProducts({ set, onClose }) {
  const [list, setList] = useState(null)
  const [error, setError] = useState('')
  useEffect(() => { catalog.setProducts(set.id).then((r) => setList(r.products)).catch((e) => setError(e.message)) }, [set.id])
  return (
    <Drawer onClose={onClose} width="max-w-[520px]" title={<h2 className="text-sm font-bold text-slate-900">{set.name}</h2>} sub={<p className="text-[11px] text-slate-500">{list ? `${list.length} products` : 'Loading…'}</p>}>
      <div className="p-5">
        {error && <Banner tone="error">{error}</Banner>}
        {!list && !error && <Spinner />}
        {list && (
          <ul className="border border-surface-border rounded-xl divide-y divide-surface-border/70 bg-white">
            {list.map((p) => (
              <li key={p.retailerId} className="flex items-center gap-3 px-3 py-2.5">
                <span className="w-10 h-10 rounded-lg bg-slate-100 overflow-hidden flex items-center justify-center flex-shrink-0">{p.imageUrl ? <img src={p.imageUrl} alt="" loading="lazy" className="w-full h-full object-cover" onError={(e) => { e.currentTarget.style.display = 'none' }} /> : <ImageIcon size={14} className="text-slate-300" />}</span>
                <span className="min-w-0 flex-1"><span className="block text-xs font-semibold text-slate-800 truncate">{p.name}</span><span className="block text-[10px] text-slate-400 font-mono">{p.retailerId}</span></span>
                <span className="text-xs font-semibold text-slate-700 tabular-nums">{price(p.salePrice || p.price, p.currency)}</span>
              </li>
            ))}
            {!list.length && <li className="px-3 py-8 text-center text-xs text-slate-400">No products in this set.</li>}
          </ul>
        )}
      </div>
    </Drawer>
  )
}

export default function SetsTab({ catalogId, products, notify, onCreate }) {
  const [sets, setSets] = useState(null)
  const [error, setError] = useState('')
  const [q, setQ] = useState('')
  const [open, setOpen] = useState(null)
  const [confirm, setConfirm] = useState('')
  const [busy, setBusy] = useState('')
  const load = useCallback(() => catalog.sets(catalogId).then((r) => { setSets(r.sets); setError('') }).catch((e) => setError(e.message)), [catalogId])
  useEffect(() => { setSets(null); load() }, [load])
  // a set created elsewhere on the page (from a product selection) shows up when the tab is opened again
  const rows = (sets ?? []).filter((s) => !q.trim() || s.name.toLowerCase().includes(q.trim().toLowerCase()))
  const imageOf = (s) => (s.productCount === products.length ? products.find((p) => p.imageUrl)?.imageUrl : '')

  async function remove(s) {
    setBusy(s.id)
    try { await catalog.deleteSet(catalogId, s.id); notify(`Deleted the set “${s.name}”.`); await load() }
    catch (e) { notify(e.message, 'error') }
    finally { setBusy(''); setConfirm('') }
  }

  return (
    <Card bodyClass="">
      <div className="flex flex-wrap items-center gap-2 px-4 py-3 border-b border-surface-border">
        <div className="relative flex-1 min-w-[220px]"><Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search sets" aria-label="Search sets" className={clsx(inputCls, 'pl-8')} /></div>
        <button onClick={onCreate} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary text-white text-xs font-semibold hover:bg-primary-hover"><Plus size={13} /> Create set</button>
      </div>
      {error && <div className="p-4"><Banner tone="error" action={<button onClick={load} className="font-semibold underline">Try again</button>}>{error}</Banner></div>}
      {!sets && !error && <Spinner />}
      {sets && (
        <table className="w-full text-xs">
          <thead><tr className="bg-slate-50 text-left text-[10.5px] font-semibold text-slate-500"><th className="px-4 py-2.5 border-b border-surface-border">Set</th><th className="px-4 py-2.5 border-b border-surface-border">Products</th><th className="px-4 py-2.5 border-b border-surface-border" /></tr></thead>
          <tbody>
            {rows.map((s) => (
              <tr key={s.id} onClick={(e) => !e.target.closest('button') && setOpen(s)} className="border-b border-surface-border/70 hover:bg-slate-50/60 cursor-pointer">
                <td className="px-4 py-3"><div className="flex items-center gap-3">
                  <span className="w-11 h-11 rounded-lg bg-slate-100 overflow-hidden flex items-center justify-center flex-shrink-0">{imageOf(s) ? <img src={imageOf(s)} alt="" className="w-full h-full object-cover" onError={(e) => { e.currentTarget.style.display = 'none' }} /> : <Layers size={16} className="text-slate-300" />}</span>
                  <button onClick={() => setOpen(s)} className="font-semibold text-primary hover:underline text-left">{s.name}</button>
                </div></td>
                <td className="px-4 py-3 tabular-nums text-slate-600">{s.productCount ?? '—'}</td>
                <td className="px-4 py-3 text-right whitespace-nowrap">
                  {confirm === s.id ? <span className="inline-flex items-center gap-1.5 text-[11px]">Delete?<button onClick={() => remove(s)} className="font-semibold text-red-600 hover:underline">Yes</button><button onClick={() => setConfirm('')} className="font-semibold text-slate-500 hover:underline">No</button></span>
                    : busy === s.id ? <Loader2 size={14} className="animate-spin text-slate-400 inline" />
                    : <button onClick={() => setConfirm(s.id)} aria-label={`Delete ${s.name}`} title="Delete set" className="p-1.5 rounded-lg text-slate-300 hover:text-red-500 hover:bg-red-50"><Trash2 size={13} /></button>}
                </td>
              </tr>
            ))}
            {!rows.length && <tr><td colSpan={3} className="py-12 text-center text-slate-400">{sets.length ? 'No sets match.' : 'No sets yet. Create one to group products.'}</td></tr>}
          </tbody>
        </table>
      )}
      {open && <SetProducts set={open} onClose={() => setOpen(null)} />}
    </Card>
  )
}
