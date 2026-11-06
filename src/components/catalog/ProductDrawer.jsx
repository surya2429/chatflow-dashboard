import { useState } from 'react'
import { ImageIcon, Loader2 } from 'lucide-react'
import { catalog } from '../../lib/catalogApi'
import { Banner, Drawer, Field, inputCls } from '../ctwa/ui'

const BLANK = { retailerId: '', name: '', description: '', brand: '', groupId: '', size: '', color: '', condition: 'new', price: '', salePrice: '', availability: 'in stock', inventory: '', imageUrl: '', url: '' }
const num = (v) => (v === '' || v === null || v === undefined ? null : Number(v))

/** Add a product, or change one. Meta reviews every new or changed product, so it shows as "In review" for a while afterwards. */
export default function ProductDrawer({ catalogId, product, currency, onClose, onSaved, notify }) {
  const editing = !!product
  const [f, setF] = useState(editing ? { ...BLANK, ...product, salePrice: product.salePrice ?? '', inventory: product.inventory ?? '' } : { ...BLANK, currency })
  const [errors, setErrors] = useState({})
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const set = (k) => (e) => setF((s) => ({ ...s, [k]: e.target.value }))
  const cur = f.currency || currency || 'INR'

  async function save() {
    setBusy(true); setErrors({}); setError('')
    const payload = { ...f, currency: cur.toUpperCase(), price: num(f.price), salePrice: num(f.salePrice), inventory: num(f.inventory) }
    try {
      await (editing ? catalog.update : catalog.create)(catalogId, payload)
      notify(editing ? `Saved “${f.name}”. Meta will review the change.` : `Added “${f.name}”. Meta will review it before it can be shared.`)
      onSaved()
    } catch (e) { setErrors(e.fields || {}); setError(e.fields ? 'Some details need fixing.' : e.message) }
    finally { setBusy(false) }
  }

  return (
    <Drawer onClose={onClose} width="max-w-[560px]" title={<h2 className="text-sm font-bold text-slate-900">{editing ? 'Edit product' : 'Add product'}</h2>} sub={<p className="text-[11px] text-slate-500">{editing ? `SKU ${product.retailerId}` : 'Products you add here are sent to your Facebook catalog.'}</p>}>
      <div className="p-5 space-y-4">
        {error && <Banner tone="error">{error}</Banner>}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field label="SKU (content ID)" error={errors.retailerId} hint="Unique. WhatsApp messages refer to the product by this."><input value={f.retailerId} onChange={set('retailerId')} disabled={editing} className={inputCls} placeholder="SKU-001" /></Field>
          <Field label="Brand" error={errors.brand}><input value={f.brand} onChange={set('brand')} className={inputCls} /></Field>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Field label="Variant group ID" hint="Same ID = variants of one item"><input value={f.groupId} onChange={set('groupId')} className={inputCls} placeholder="TSHIRT" /></Field>
          <Field label="Size"><input value={f.size} onChange={set('size')} className={inputCls} /></Field>
          <Field label="Colour"><input value={f.color} onChange={set('color')} className={inputCls} /></Field>
        </div>
        <Field label="Name" error={errors.name}><input value={f.name} onChange={set('name')} maxLength={200} className={inputCls} /></Field>
        <Field label="Description" error={errors.description}><textarea value={f.description} onChange={set('description')} rows={3} className={inputCls} /></Field>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Field label="Price" error={errors.price}><input type="number" min="0" step="0.01" value={f.price} onChange={set('price')} className={inputCls} /></Field>
          <Field label="Currency" error={errors.currency}><input value={cur} onChange={set('currency')} maxLength={3} className={inputCls} /></Field>
          <Field label="Sale price" error={errors.salePrice} hint="Optional"><input type="number" min="0" step="0.01" value={f.salePrice} onChange={set('salePrice')} className={inputCls} /></Field>
          <Field label="Stock" error={errors.inventory} hint="Optional"><input type="number" min="0" step="1" value={f.inventory} onChange={set('inventory')} className={inputCls} /></Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Availability" error={errors.availability}><select value={f.availability} onChange={set('availability')} className={inputCls}><option value="in stock">In stock</option><option value="out of stock">Out of stock</option></select></Field>
          <Field label="Condition" error={errors.condition}><select value={f.condition} onChange={set('condition')} className={inputCls}><option value="new">New</option><option value="refurbished">Refurbished</option><option value="used">Used</option></select></Field>
        </div>
        <Field label="Image link" error={errors.imageUrl} hint="JPEG or PNG, at least 500 × 500 px, a public https link.">
          <div className="flex items-center gap-3">
            <span className="w-14 h-14 rounded-lg bg-slate-100 flex items-center justify-center overflow-hidden flex-shrink-0">{/^https?:\/\//.test(f.imageUrl) ? <img src={f.imageUrl} alt="" className="w-full h-full object-cover" onError={(e) => { e.currentTarget.style.display = 'none' }} /> : <ImageIcon size={18} className="text-slate-300" />}</span>
            <input value={f.imageUrl} onChange={set('imageUrl')} className={inputCls} placeholder="https://…" />
          </div>
        </Field>
        <Field label="Product page link" error={errors.url}><input value={f.url} onChange={set('url')} className={inputCls} placeholder="https://yourstore.com/product" /></Field>
        <div className="flex items-center justify-end gap-2 pt-2">
          <button onClick={onClose} className="px-3.5 py-2 rounded-lg text-xs font-semibold text-slate-600 hover:bg-slate-100">Cancel</button>
          <button onClick={save} disabled={busy} className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-primary text-white text-xs font-semibold hover:bg-primary-hover disabled:opacity-60">{busy && <Loader2 size={13} className="animate-spin" />} {editing ? 'Save changes' : 'Add product'}</button>
        </div>
      </div>
    </Drawer>
  )
}
