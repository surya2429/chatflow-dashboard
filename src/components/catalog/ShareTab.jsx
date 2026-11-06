import { useMemo, useState } from 'react'
import { Check, Copy, ImageIcon, Loader2, Search, Send } from 'lucide-react'
import clsx from 'clsx'
import { catalog, price } from '../../lib/catalogApi'
import { Banner, Card, Field, Segmented, inputCls } from '../ctwa/ui'

const KINDS = [['product', 'One product'], ['products', 'Several products'], ['catalog', 'Whole catalog']]
const LIMIT = { product: 1, products: 30, catalog: 1 }

/** Send products or the whole catalog to a customer in WhatsApp (Cloud API product, multi-product and catalog messages). */
export default function ShareTab({ status, catalogId, products, notify }) {
  const phones = status.phoneNumbers
  const [kind, setKind] = useState('products')
  const [phoneId, setPhoneId] = useState(phones[0]?.id || '')
  const [picked, setPicked] = useState([])
  const [q, setQ] = useState('')
  const [to, setTo] = useState('')
  const [body, setBody] = useState('')
  const [header, setHeader] = useState('')
  const [footer, setFooter] = useState('')
  const [busy, setBusy] = useState(false)
  const [errors, setErrors] = useState({})
  const [error, setError] = useState('')
  const [copied, setCopied] = useState(false)

  const phone = phones.find((p) => p.id === phoneId) || phones[0]
  const shown = useMemo(() => products.filter((p) => p.availability === 'in stock' && (!q.trim() || `${p.name} ${p.retailerId}`.toLowerCase().includes(q.trim().toLowerCase()))), [products, q])
  const chosen = picked.map((id) => products.find((p) => p.retailerId === id)).filter(Boolean)
  const limit = LIMIT[kind]
  const toggle = (id) => setPicked((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : kind === 'product' ? [id] : cur.length >= limit ? cur : [...cur, id]))
  const changeKind = (k) => { setKind(k); setPicked((cur) => cur.slice(0, LIMIT[k])); setErrors({}); setError('') }
  const catalogLink = phone ? `https://wa.me/c/${phone.display.replace(/\D/g, '')}` : ''

  async function send() {
    setBusy(true); setErrors({}); setError('')
    try {
      const r = await catalog.send({ catalog: catalogId, phoneNumberId: phone?.id, kind, to, retailerIds: picked, body, header, footer })
      notify(r.simulated ? 'Recorded as a test (sample mode). Nothing was sent to WhatsApp.' : `Sent on WhatsApp${r.id ? ` (message ${r.id.slice(-8)})` : ''}.`)
      if (!r.simulated) { setBody(''); setPicked([]) }
    } catch (e) { setErrors(e.fields || {}); setError(e.fields ? 'Some details need fixing.' : e.message) }
    finally { setBusy(false) }
  }

  if (!phones.length) return <Banner tone="warn">{status.waProblem?.message || 'No WhatsApp number is connected yet. Connect Facebook and share your WhatsApp Business account (Settings tab), then you can send products here.'}</Banner>

  return (
    <div className="grid grid-cols-1 lg:grid-cols-5 gap-5 items-start">
      <div className="lg:col-span-3 space-y-5">
        <Card title="What do you want to send?" bodyClass="p-4 space-y-4">
          <Segmented value={kind} onChange={changeKind} options={KINDS.map(([key, label]) => ({ key, label }))} />
          {kind === 'catalog'
            ? <p className="text-[11px] text-slate-500 leading-relaxed">Sends a message with a “View catalog” button that opens your whole catalog inside WhatsApp. The catalog must be connected to your number and visible (Settings tab). Optionally pick a product below to use as the picture.</p>
            : <p className="text-[11px] text-slate-500">{kind === 'product' ? 'Pick the product to show.' : 'Pick up to 30 products. Only products that are in stock are listed.'}</p>}

          <div className="relative">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search products" aria-label="Search products" className={clsx(inputCls, 'pl-8')} />
          </div>
          <ul className="max-h-72 overflow-y-auto border border-surface-border rounded-xl divide-y divide-surface-border/70">
            {shown.map((p) => {
              const on = picked.includes(p.retailerId)
              return (
                <li key={p.retailerId}>
                  <button onClick={() => toggle(p.retailerId)} aria-pressed={on} className={clsx('w-full flex items-center gap-3 px-3 py-2 text-left hover:bg-slate-50', on && 'bg-primary-50/50')}>
                    <span className={clsx('w-4 h-4 rounded border flex items-center justify-center flex-shrink-0', on ? 'bg-primary border-primary text-white' : 'border-slate-300')}>{on && <Check size={11} />}</span>
                    <span className="w-9 h-9 rounded-md bg-slate-100 overflow-hidden flex items-center justify-center flex-shrink-0">{p.imageUrl ? <img src={p.imageUrl} alt="" loading="lazy" className="w-full h-full object-cover" onError={(e) => { e.currentTarget.style.display = 'none' }} /> : <ImageIcon size={14} className="text-slate-300" />}</span>
                    <span className="min-w-0 flex-1"><span className="block text-xs font-semibold text-slate-800 truncate">{p.name}</span><span className="block text-[10px] text-slate-400 font-mono">{p.retailerId}</span></span>
                    <span className="text-xs font-semibold text-slate-700 tabular-nums">{price(p.salePrice || p.price, p.currency)}</span>
                  </button>
                </li>
              )
            })}
            {!shown.length && <li className="px-3 py-8 text-center text-xs text-slate-400">No products to pick.</li>}
          </ul>
          {errors.retailerIds && <p role="alert" className="text-[10.5px] text-red-600">{errors.retailerIds}</p>}
          <p className="text-[10.5px] text-slate-400">{picked.length} selected{kind === 'products' ? ` of ${limit}` : ''}</p>
        </Card>

        <Card title="Message" bodyClass="p-4 space-y-3">
          {error && <Banner tone="error">{error}</Banner>}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="Send from" hint="Your WhatsApp Business number">
              <select value={phone?.id} onChange={(e) => setPhoneId(e.target.value)} className={inputCls}>{phones.map((p) => <option key={p.id} value={p.id}>{p.display}{p.name ? ` · ${p.name}` : ''}</option>)}</select>
            </Field>
            <Field label="Customer’s WhatsApp number" error={errors.to} hint="With country code, e.g. 91 98765 43210"><input value={to} onChange={(e) => setTo(e.target.value)} inputMode="tel" className={inputCls} placeholder="91 98765 43210" /></Field>
          </div>
          {kind === 'products' && <Field label="Title" error={errors.header} hint="Shown above the list (up to 60 characters)"><input value={header} onChange={(e) => setHeader(e.target.value)} maxLength={60} className={inputCls} placeholder="Our products" /></Field>}
          <Field label={kind === 'product' ? 'Message (optional)' : 'Message'} error={errors.body}><textarea value={body} onChange={(e) => setBody(e.target.value)} rows={3} maxLength={1024} className={inputCls} placeholder="Here are a few things you might like…" /></Field>
          <Field label="Footer (optional)" hint="Up to 60 characters"><input value={footer} onChange={(e) => setFooter(e.target.value)} maxLength={60} className={inputCls} /></Field>
          <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
            <p className="text-[10.5px] text-slate-400 max-w-sm leading-relaxed">WhatsApp only delivers these inside a conversation the customer started in the last 24 hours.</p>
            <button onClick={send} disabled={busy} className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-primary text-white text-xs font-semibold hover:bg-primary-hover disabled:opacity-60">{busy ? <Loader2 size={13} className="animate-spin" /> : <Send size={13} />} Send on WhatsApp</button>
          </div>
        </Card>
      </div>

      <div className="lg:col-span-2 space-y-5 lg:sticky lg:top-4">
        <Card title="Preview" bodyClass="p-4 bg-[#efe9df]">
          <div className="max-w-[300px] mx-auto bg-white rounded-lg rounded-tl-none shadow-sm overflow-hidden text-[12.5px] text-slate-800">
            {kind === 'products' && header && <p className="px-3 pt-2.5 font-semibold">{header}</p>}
            {chosen.length > 0 && (
              <div className={clsx('grid gap-0.5 bg-slate-100', chosen.length === 1 ? 'grid-cols-1' : 'grid-cols-2')}>
                {chosen.slice(0, 4).map((p) => <div key={p.retailerId} className="aspect-square bg-slate-200 overflow-hidden">{p.imageUrl && <img src={p.imageUrl} alt="" className="w-full h-full object-cover" onError={(e) => { e.currentTarget.style.display = 'none' }} />}</div>)}
              </div>
            )}
            {kind === 'product' && chosen[0] && <div className="px-3 pt-2"><p className="font-semibold">{chosen[0].name}</p><p className="text-slate-500">{price(chosen[0].salePrice || chosen[0].price, chosen[0].currency)}</p></div>}
            <p className="px-3 py-2 whitespace-pre-wrap break-words">{body || <span className="text-slate-300">Your message…</span>}</p>
            {footer && <p className="px-3 pb-2 text-[11px] text-slate-400">{footer}</p>}
            <p className="text-center text-[#027eb5] font-semibold border-t border-slate-100 py-2">{kind === 'catalog' ? 'View catalog' : kind === 'product' ? 'View' : `View items${chosen.length ? ` (${chosen.length})` : ''}`}</p>
          </div>
        </Card>

        <Card title="Catalog link" sub="Put this on your website, Instagram bio or in a message" bodyClass="p-4">
          <div className="flex items-center gap-2">
            <input readOnly value={catalogLink} aria-label="Catalog link" className={clsx(inputCls, 'font-mono text-[11px]')} onFocus={(e) => e.target.select()} />
            <button onClick={() => navigator.clipboard?.writeText(catalogLink).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1300) }).catch(() => {})} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-surface-border text-xs font-semibold text-slate-600 hover:border-primary hover:text-primary whitespace-nowrap">{copied ? <Check size={12} /> : <Copy size={12} />} {copied ? 'Copied' : 'Copy'}</button>
          </div>
          <p className="text-[10.5px] text-slate-400 mt-2">Opens your catalog in WhatsApp. Works once the catalog is connected and visible.</p>
        </Card>
      </div>
    </div>
  )
}
