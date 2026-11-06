import { useState } from 'react'
import { createPortal } from 'react-dom'
import { Download, FileSpreadsheet, Loader2, X } from 'lucide-react'
import { catalog } from '../../lib/catalogApi'
import { download } from '../ai/aiTable'
import { Banner } from '../ctwa/ui'
import { SUPPLEMENTARY_CSV, TEMPLATE_CSV, parseCsv, rowsToProducts } from './csv'

const MAX = 1000

/** Add or update many products from a CSV file (Meta's catalog feed columns). The same file can be imported again to update. */
export default function ImportDialog({ catalogId, currency, mode = 'add', onClose, onDone }) {
  const update = mode === 'update'
  const [parsed, setParsed] = useState(null)       // { name, products, unknown, missing }
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState(null)

  async function pick(file) {
    setError(''); setResult(null); setParsed(null)
    if (!file) return
    if (file.size > 2 * 1024 * 1024) return setError('That file is over 2 MB. Split it into smaller files.')
    const r = rowsToProducts(parseCsv(await file.text()), currency, update)
    if (r.missing.length) return setError(`The file needs these columns: ${r.missing.join(', ')}. Download the template to see the format.`)
    if (!r.products.length) return setError('The file has no products.')
    if (r.products.length > MAX) return setError(`Import up to ${MAX} products at a time.`)
    setParsed({ name: file.name, ...r })
  }

  async function run() {
    setBusy(true); setError('')
    try { setResult(await catalog.importMany(catalogId, parsed.products, mode)); onDone() }
    catch (e) { setError(e.message) }
    finally { setBusy(false) }
  }

  return createPortal(
    <div className="fixed inset-0 z-[70] bg-slate-900/40 flex items-center justify-center p-4" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div role="dialog" aria-label={update ? 'Update product details' : 'Import products'} className="bg-white rounded-2xl shadow-modal w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-5 py-4 border-b border-surface-border">
          <h2 className="text-sm font-bold text-slate-900">{update ? 'Add missing details from a file' : 'Import products from a file'}</h2>
          <button onClick={onClose} aria-label="Close" className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100"><X size={16} /></button>
        </div>
        <div className="p-5 space-y-4">
          {update
            ? <p className="text-xs text-slate-500 leading-relaxed">Use a CSV file with an <span className="font-mono text-[11px]">id</span> column and only the columns you want to fill in or correct (for example <span className="font-mono text-[11px]">brand, size, color, price</span>). Only products that already exist are changed, and only in the columns the file has. Nothing is added.</p>
            : <p className="text-xs text-slate-500 leading-relaxed">Use a CSV file with Meta’s catalog columns (<span className="font-mono text-[11px]">id, title, description, price, link, image_link, brand, item_group_id…</span>). Products whose SKU already exists are updated, the rest are added. A file you exported from here can be edited and imported again.</p>}
          <button onClick={() => download(update ? 'catalog-supplementary-template.csv' : 'catalog-template.csv', '﻿' + (update ? SUPPLEMENTARY_CSV : TEMPLATE_CSV), 'text/csv;charset=utf-8')} className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary hover:underline"><Download size={13} /> Download a template</button>

          <label className="flex flex-col items-center gap-2 border-2 border-dashed border-surface-border rounded-xl py-7 cursor-pointer hover:border-primary/50 hover:bg-primary-50/30 text-center">
            <FileSpreadsheet size={22} className="text-slate-400" />
            <span className="text-xs font-semibold text-slate-700">{parsed ? parsed.name : 'Choose a CSV file'}</span>
            <input type="file" accept=".csv,text/csv" className="sr-only" onChange={(e) => pick(e.target.files?.[0])} />
          </label>

          {error && <Banner tone="error">{error}</Banner>}
          {parsed && !result && (
            <Banner tone="info">
              {parsed.products.length} {parsed.products.length === 1 ? 'product' : 'products'} ready to import.{parsed.unknown.length > 0 && <> These columns are ignored: {parsed.unknown.join(', ')}.</>}
            </Banner>
          )}
          {result && (
            <div className="space-y-2">
              <Banner tone={result.sent ? 'ok' : 'warn'}>{result.sent} sent to Meta. {result.invalid.length + result.errors.length > 0 ? `${result.invalid.length + result.errors.length} not imported.` : 'Meta will review them before they can be shared.'}</Banner>
              {[...result.invalid.map((x) => ({ k: `r${x.row}`, t: `Row ${x.row}${x.retailerId ? ` (${x.retailerId})` : ''}: ${x.message}` })), ...result.errors.map((x, i) => ({ k: `m${i}`, t: `${x.retailerId}: ${x.message}` }))].slice(0, 20).map((x) => <p key={x.k} className="text-[11px] text-red-600">{x.t}</p>)}
            </div>
          )}

          <div className="flex justify-end gap-2 pt-1">
            <button onClick={onClose} className="px-3.5 py-2 rounded-lg text-xs font-semibold text-slate-600 hover:bg-slate-100">{result ? 'Close' : 'Cancel'}</button>
            {!result && <button onClick={run} disabled={!parsed || busy} className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-primary text-white text-xs font-semibold hover:bg-primary-hover disabled:opacity-50">{busy && <Loader2 size={13} className="animate-spin" />} Import</button>}
          </div>
        </div>
      </div>
    </div>, document.body)
}
