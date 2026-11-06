import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { CheckCircle2, Loader2, MessageCircle, Plus } from 'lucide-react'
import { catalog } from '../../lib/catalogApi'
import ConnectMeta from '../ctwa/ConnectMeta'
import { Banner, Card, Field, Switch, inputCls } from '../ctwa/ui'

/** Where the catalog comes from and how WhatsApp uses it: the Facebook connection, which catalog, whether it is connected to the number, and whether customers can see it. */
export default function CatalogSettings({ meta, status, catalogId, setCatalogId, reload, notify }) {
  const navigate = useNavigate()
  const [name, setName] = useState('')
  const [busy, setBusy] = useState('')
  const [err, setErr] = useState('')
  const current = status.catalogs.find((c) => c.id === catalogId)
  const onWhatsApp = !!catalogId && status.connectedId === catalogId

  async function run(key, fn, ok) {
    setBusy(key); setErr('')
    try { await fn(); if (ok) notify(ok); await reload() }
    catch (e) { setErr(e.message) }
    finally { setBusy('') }
  }

  return (
    <div className="space-y-5">
      <ConnectMeta meta={meta} onNeedAdmin={() => navigate('/ctwa?tab=setup')} />
      <p className="text-[11px] text-slate-400 -mt-2">This is the same Facebook connection the Click to WA Ads section uses. Connecting once covers both.</p>

      {err && <Banner tone="error" action={<button onClick={() => setErr('')} className="font-semibold underline">Dismiss</button>}>{err}</Banner>}
      {status.problem && <Banner tone="warn">{status.problem.message}</Banner>}

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-5 items-start">
        <Card title="Catalog" sub={status.mode === 'sample' ? 'Sample catalog: changes stay on this server and never reach Meta' : 'The Meta catalog this section manages'} bodyClass="p-4 space-y-4">
          {status.catalogs.length > 0 ? (
            <Field label="Catalog in use">
              <select value={catalogId || ''} onChange={(e) => setCatalogId(e.target.value)} className={inputCls}>
                {status.catalogs.map((c) => <option key={c.id} value={c.id}>{c.name}{c.productCount !== null ? ` · ${c.productCount} products` : ''}</option>)}
              </select>
            </Field>
          ) : <p className="text-xs text-slate-500">No catalog found yet.</p>}
          {status.canCreate && (
            <form onSubmit={(e) => { e.preventDefault(); if (name.trim().length > 1) run('create', async () => { const r = await catalog.createCatalog(name.trim()); setCatalogId(r.catalog.id); setName('') }, `Created “${name.trim()}”.`) }} className="flex items-end gap-2">
              <Field label="Create a new catalog" className="flex-1"><input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Summer collection" maxLength={100} className={inputCls} /></Field>
              <button disabled={busy === 'create' || name.trim().length < 2} className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-surface-border text-xs font-semibold text-slate-700 hover:border-primary hover:text-primary disabled:opacity-50">{busy === 'create' ? <Loader2 size={13} className="animate-spin" /> : <Plus size={13} />} Create</button>
            </form>
          )}
        </Card>

        <Card title="WhatsApp" sub="Let customers browse and shop from your catalog inside WhatsApp" bodyClass="p-4 space-y-4">
          {status.waProblem && <Banner tone="warn">{status.waProblem.message}</Banner>}
          <div className="flex items-start gap-3">
            <span className={onWhatsApp ? 'text-emerald-500' : 'text-slate-300'}><CheckCircle2 size={18} /></span>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-bold text-slate-800">{onWhatsApp ? 'Connected to your WhatsApp Business account' : 'Not connected to WhatsApp yet'}</p>
              <p className="text-[11px] text-slate-500 mt-0.5 leading-relaxed">{onWhatsApp ? `“${current?.name}” is the catalog customers see.` : status.connectedId ? 'Another catalog is connected to WhatsApp. Connecting this one replaces it (a WhatsApp account has one catalog).' : 'Connect the catalog so products can be sent in chats and shown in your WhatsApp profile.'}</p>
            </div>
            {!onWhatsApp && <button onClick={() => run('wa', () => catalog.connectWhatsApp(catalogId), 'Catalog connected to WhatsApp.')} disabled={!catalogId || busy === 'wa'} className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-primary text-white text-xs font-semibold hover:bg-primary-hover disabled:opacity-50 whitespace-nowrap">{busy === 'wa' ? <Loader2 size={13} className="animate-spin" /> : <MessageCircle size={13} />} Connect</button>}
          </div>

          {status.phoneNumbers.map((p) => {
            const c = status.commerce[p.id]
            const set = (patch, ok) => run(`c${p.id}`, () => catalog.setCommerce(p.id, patch), ok)
            return (
              <div key={p.id} className="border border-surface-border rounded-xl p-3.5 space-y-3">
                <p className="text-xs font-bold text-slate-800">{p.display}{p.name ? <span className="font-normal text-slate-400"> · {p.name}</span> : null}</p>
                {!c ? <p className="text-[11px] text-slate-400">Could not read this number’s settings.</p> : (
                  <>
                    <label className="flex items-center justify-between gap-3"><span><span className="block text-xs font-semibold text-slate-700">Show the catalog in chats</span><span className="block text-[10.5px] text-slate-400">Adds the catalog icon to your chats and profile. Needed for catalog links and “View catalog” buttons.</span></span><Switch on={c.isCatalogVisible} onChange={(v) => set({ isCatalogVisible: v }, v ? 'The catalog is now visible on WhatsApp.' : 'The catalog is hidden on WhatsApp.')} disabled={busy === `c${p.id}`} label="Show the catalog in chats" /></label>
                    <label className="flex items-center justify-between gap-3"><span><span className="block text-xs font-semibold text-slate-700">Let customers use a cart</span><span className="block text-[10.5px] text-slate-400">Customers can add several products and send you their order.</span></span><Switch on={c.isCartEnabled} onChange={(v) => set({ isCartEnabled: v }, v ? 'Cart turned on.' : 'Cart turned off.')} disabled={busy === `c${p.id}`} label="Let customers use a cart" /></label>
                  </>
                )}
              </div>
            )
          })}
          {!status.phoneNumbers.length && !status.waProblem && <p className="text-xs text-slate-500">No WhatsApp number found. Connect Facebook and share your WhatsApp Business account.</p>}
        </Card>
      </div>

      <Card title="Permissions Meta needs" bodyClass="p-4 text-[11px] text-slate-500 leading-relaxed space-y-1.5">
        <p>The Facebook connection must include <b>catalog_management</b> and <b>business_management</b> (to read and change the catalog), plus <b>whatsapp_business_management</b> and <b>whatsapp_business_messaging</b> (to connect it to WhatsApp and send product messages). In the Facebook window, choose your catalog when asked.</p>
        <p>Meta reviews every new or changed product, so a product shows “In review” for a while and can only be shared once it is approved. Changes can also take a few minutes to appear after you press Sync.</p>
      </Card>
    </div>
  )
}
