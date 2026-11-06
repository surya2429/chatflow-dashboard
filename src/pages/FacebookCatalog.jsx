import { useCallback, useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Package, Send, Settings2, RefreshCw, Plus, X } from 'lucide-react'
import clsx from 'clsx'
import { catalog } from '../lib/catalogApi'
import { NativeSelect } from '../components/Select'
import ProductsTab from '../components/catalog/ProductsTab'
import ProductDrawer from '../components/catalog/ProductDrawer'
import ImportDialog from '../components/catalog/ImportDialog'
import ShareTab from '../components/catalog/ShareTab'
import CatalogSettings from '../components/catalog/CatalogSettings'
import { useMetaConnection } from '../components/ctwa/useMetaConnection'
import { Banner, Spinner } from '../components/ctwa/ui'

const TABS = [['products', 'Products', Package], ['share', 'Share on WhatsApp', Send], ['settings', 'Settings', Settings2]]
const KEY = 'catalog.selected'
const remembered = () => { try { return localStorage.getItem(KEY) || '' } catch { return '' } }

/** The Facebook catalog behind WhatsApp shopping: products, sharing them in chats, and how WhatsApp uses the catalog. */
export default function FacebookCatalog() {
  const [params, setParams] = useSearchParams()
  const tab = TABS.some(([k]) => k === params.get('tab')) ? params.get('tab') : 'products'
  const setTab = (k) => setParams(k === 'products' ? {} : { tab: k }, { replace: true })

  const [status, setStatus] = useState(null)
  const [catalogId, setCatalogIdState] = useState(remembered())
  const [list, setList] = useState(null)            // { products, truncated }
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const [syncedAt, setSyncedAt] = useState(null)
  const [notice, setNotice] = useState(null)
  const [editing, setEditing] = useState(null)      // a product, or {} for a new one
  const [importing, setImporting] = useState(false)
  const timer = useRef(null)

  const notify = useCallback((message, tone = 'ok') => { setNotice({ message, tone }); clearTimeout(timer.current); timer.current = setTimeout(() => setNotice(null), 6000) }, [])
  useEffect(() => () => clearTimeout(timer.current), [])
  const setCatalogId = (id) => { setCatalogIdState(id); try { localStorage.setItem(KEY, id) } catch { /* the choice just isn't remembered */ } }

  // status first (it says which catalogs exist), then the products of the chosen one
  const load = useCallback(async () => {
    setError('')
    try {
      const s = await catalog.status()
      setStatus(s)
      const id = s.catalogs.some((c) => c.id === catalogId) ? catalogId : s.connectedId && s.catalogs.some((c) => c.id === s.connectedId) ? s.connectedId : s.catalogs[0]?.id || ''
      if (id !== catalogId) setCatalogId(id)
      if (id) { const p = await catalog.products(id); setList({ products: p.products, truncated: p.truncated }) } else setList({ products: [], truncated: false })
      setSyncedAt(new Date())
      return { s }
    } catch (e) { setError(e.message) } finally { setLoading(false) }
  }, [catalogId])      // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { setLoading(true); load() }, [load])
  const meta = useMetaConnection(() => { setLoading(true); load() })

  // Meta is read on every load, so syncing is a fresh pull of the catalog and its review results
  const sync = async () => {
    setSyncing(true)
    const r = await load()
    setSyncing(false)
    if (!r) return notify('Could not sync with Meta. Check the connection in Settings and try again.', 'error')
    notify(r.s.mode === 'live' ? 'Synced from Meta: the products and their review status are up to date.' : 'Refreshed the sample catalog. Connect Facebook in Settings to sync your real catalog from Meta.', r.s.mode === 'live' ? 'ok' : 'info')
  }

  const products = list?.products ?? []
  const currency = products[0]?.currency || 'INR'
  const saved = () => { setEditing(null); load() }

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 mb-0.5">
            <h1 className="text-[15px] font-bold text-slate-900">Facebook Catalog</h1>
            {list && <span className="text-[10px] font-bold bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full">{products.length} {products.length === 1 ? 'product' : 'products'}</span>}
            {status && <span className={clsx('text-[10px] font-bold px-2 py-0.5 rounded-full', status.mode === 'live' ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700')}>{status.mode === 'live' ? 'Live' : 'Sample data'}</span>}
          </div>
          <p className="text-[11px] text-slate-400">Your product catalog on Meta: manage products and sell on WhatsApp</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {status?.catalogs.length > 1 && (
            <NativeSelect value={catalogId} onChange={(e) => setCatalogId(e.target.value)} sm className="!w-48">
              {status.catalogs.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </NativeSelect>
          )}
          {syncedAt && <span className="hidden md:inline text-[10.5px] text-slate-400 whitespace-nowrap">Synced {syncedAt.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' })}</span>}
          <button onClick={sync} disabled={syncing} title="Pull the latest products and review results from Meta" className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-primary/30 bg-primary-50 text-primary text-xs font-semibold hover:bg-primary-100 hover:border-primary/50 transition-colors whitespace-nowrap disabled:opacity-60">
            <RefreshCw size={12} className={clsx(syncing && 'animate-spin')} /> {syncing ? 'Syncing…' : 'Sync from Meta'}
          </button>
          <button onClick={() => setEditing({})} disabled={!catalogId} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary text-white text-xs font-semibold hover:bg-primary-hover transition-colors shadow-sm whitespace-nowrap disabled:opacity-50"><Plus size={13} /> Add product</button>
        </div>
      </div>

      <div className="flex items-center gap-0.5 bg-slate-100 p-1 rounded-xl w-fit max-w-full overflow-x-auto" role="tablist" aria-label="Catalog sections">
        {TABS.map(([k, l, Icon]) => (
          <button key={k} role="tab" aria-selected={tab === k} onClick={() => setTab(k)} className={clsx('flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-all whitespace-nowrap', tab === k ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700')}>
            <Icon size={12} /> {l}
          </button>
        ))}
      </div>

      {notice && <Banner tone={notice.tone === 'error' ? 'error' : notice.tone === 'info' ? 'info' : 'ok'} action={<button onClick={() => setNotice(null)} aria-label="Dismiss" className="p-0.5 opacity-60 hover:opacity-100"><X size={14} /></button>}>{notice.message}</Banner>}
      {status?.mode === 'sample' && tab !== 'settings' && (
        <Banner tone="info" action={<button onClick={() => setTab('settings')} className="font-semibold underline whitespace-nowrap">Connect Facebook</button>}>You are looking at a sample catalog. Add, edit and share products to try everything; nothing reaches Meta or WhatsApp until you connect your Facebook account.</Banner>
      )}
      {status?.problem && tab !== 'settings' && <Banner tone="warn" action={<button onClick={() => setTab('settings')} className="font-semibold underline whitespace-nowrap">Open Settings</button>}>{status.problem.message}</Banner>}

      {tab === 'settings' ? (status ? <CatalogSettings meta={meta} status={status} catalogId={catalogId} setCatalogId={setCatalogId} reload={load} notify={notify} /> : error ? <Banner tone="error">{error}</Banner> : <Spinner />)
        : error ? <Banner tone="error" action={<button onClick={() => { setLoading(true); load() }} className="font-semibold underline">Try again</button>}>{error}</Banner>
        : loading && !list ? <Spinner />
        : !catalogId ? <Banner tone="warn" action={<button onClick={() => setTab('settings')} className="font-semibold underline whitespace-nowrap">Open Settings</button>}>No catalog yet. Connect Facebook and choose or create a catalog in Settings.</Banner>
        : tab === 'share' ? <ShareTab status={status} catalogId={catalogId} products={products} notify={notify} />
        : <ProductsTab catalogId={catalogId} products={products} truncated={list.truncated} reload={load} notify={notify} onEdit={setEditing} onAdd={() => setEditing({})} onImport={() => setImporting(true)} />}

      {editing && <ProductDrawer catalogId={catalogId} product={editing.retailerId ? editing : null} currency={currency} onClose={() => setEditing(null)} onSaved={saved} notify={notify} />}
      {importing && <ImportDialog catalogId={catalogId} currency={currency} onClose={() => setImporting(false)} onDone={load} />}
    </div>
  )
}
