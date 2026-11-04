// WidgetQRSection.jsx — Settings → "Widget & QR Codes" (WhatsApp).
//
//   Website Widget            a floating "Chat on WhatsApp" button + greeting card for the merchant's site. It is a
//                             plain link to WhatsApp (click-to-chat, or a message link) — public/wa-widget.js.
//   QR Codes & Message Links  WhatsApp's own "message links": a wa.me/message/<code> short link + QR code that opens
//                             a chat with a message already typed in. Managed through Meta's QR Codes and Short
//                             Links API (backend/src/whatsapp/messageLinks.ts): create, edit, delete.
import { useCallback, useEffect, useMemo, useState } from 'react'
import QRCode from 'qrcode'
import clsx from 'clsx'
import {
  Plus, Copy, Download, Pencil, Trash2, X, Check, QrCode, ExternalLink, Info, Loader2, AlertCircle, RefreshCw,
  MessageCircle, Smartphone, Monitor,
} from 'lucide-react'
import { messageLinks, MAX_MESSAGE_CHARS } from '../../lib/messageLinksApi'

const WA_WIDGET_SRC = 'https://cdn.chatflow.io/v2/wa-widget.js'
const GLYPH = 'M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.45 1.32 4.95L2.05 22l5.25-1.38c1.45.79 3.08 1.21 4.74 1.21 5.46 0 9.91-4.45 9.91-9.91 0-2.65-1.03-5.14-2.9-7.01A9.816 9.816 0 0 0 12.04 2zm0 1.67c2.2 0 4.26.86 5.82 2.42a8.225 8.225 0 0 1 2.41 5.83c0 4.54-3.7 8.23-8.24 8.23-1.48 0-2.93-.39-4.19-1.15l-.3-.17-3.12.82.83-3.04-.2-.31a8.188 8.188 0 0 1-1.26-4.38c.01-4.54 3.7-8.24 8.25-8.24zM8.53 7.33c-.16 0-.43.06-.66.31-.22.25-.87.86-.87 2.07 0 1.22.89 2.39 1 2.56.14.17 1.76 2.67 4.25 3.73.59.27 1.05.42 1.41.53.59.19 1.13.16 1.56.1.48-.07 1.46-.6 1.67-1.18.21-.58.21-1.07.15-1.18-.07-.1-.23-.16-.48-.27-.25-.14-1.47-.74-1.69-.82-.23-.09-.39-.12-.56.12-.17.25-.64.81-.78.97-.14.17-.29.19-.53.07-.26-.13-1.06-.39-2-1.23-.74-.66-1.23-1.47-1.38-1.72-.12-.25-.01-.39.11-.5.11-.11.25-.29.37-.43.12-.14.17-.25.25-.41.08-.17.04-.31-.02-.43-.06-.12-.56-1.34-.76-1.84-.2-.48-.4-.42-.56-.43-.14 0-.3-.01-.47-.01z'
const WaGlyph = ({ size = 20, className }) => (
  <svg viewBox="0 0 24 24" width={size} height={size} fill="currentColor" className={className} aria-hidden="true"><path d={GLYPH}/></svg>
)

const charCount = (s) => [...s].length

/* ── Message links state, shared by both tabs ─────────────────────────────────────────────────────────
   Live: Meta's API through our server. Not connected (no WhatsApp credentials): a local sample list so the screen
   can be tried; those links are not real and nothing is sent to WhatsApp. */
const SAMPLE_CODE = () => Array.from({ length: 14 }, () => 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[Math.floor(Math.random() * 32)]).join('')
const SAMPLE_LINKS = [{ code: 'RLCP76WN676EO1', prefilledMessage: 'deepaktest', deepLinkUrl: 'https://wa.me/message/RLCP76WN676EO1' }]

function useMessageLinks() {
  const [state, setState] = useState({ loading: true, sample: false, items: [], error: null })
  const load = useCallback(() => {
    setState(s => ({ ...s, loading: true, error: null }))
    messageLinks.list()
      .then(r => setState(r.configured === false ? { loading: false, sample: true, items: SAMPLE_LINKS, error: null } : { loading: false, sample: false, items: r.items, error: null }))
      .catch(e => setState(s => ({ ...s, loading: false, error: e.message })))
  }, [])
  useEffect(load, [load])

  const sampleSet = (fn) => setState(s => ({ ...s, items: fn(s.items) }))
  return {
    ...state,
    reload: load,
    async create(text) {
      if (state.sample) { const it = { code: SAMPLE_CODE(), prefilledMessage: text, deepLinkUrl: '' }; it.deepLinkUrl = `https://wa.me/message/${it.code}`; sampleSet(l => [it, ...l]); return it }
      const it = await messageLinks.create(text)
      setState(s => ({ ...s, items: [it, ...s.items] }))
      return it
    },
    async update(code, text) {
      if (!state.sample) await messageLinks.update(code, text)
      sampleSet(l => l.map(x => x.code === code ? { ...x, prefilledMessage: text } : x))
    },
    async remove(code) {
      if (!state.sample) await messageLinks.remove(code)
      sampleSet(l => l.filter(x => x.code !== code))
    },
  }
}

/* ── small pieces ─────────────────────────────────────────────────────────────────────────────────── */
function Modal({ title, onClose, children, footer, wide }) {
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])
  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-slate-900/50" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div role="dialog" aria-label={title} className={clsx('bg-white rounded-xl shadow-modal w-full max-h-[92vh] overflow-y-auto', wide ? 'max-w-md' : 'max-w-lg')}>
        <div className="flex items-center justify-between px-5 pt-4 pb-2">
          <h3 className="text-[14px] font-bold text-slate-900">{title}</h3>
          <button onClick={onClose} aria-label="Close" className="p-1 rounded-md text-slate-500 hover:bg-slate-100"><X size={16}/></button>
        </div>
        <div className="px-5 pb-4">{children}</div>
        {footer && <div className="px-5 pb-4 flex justify-end gap-2">{footer}</div>}
      </div>
    </div>
  )
}

const btnPrimary = 'inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-lg bg-primary text-white text-xs font-bold hover:bg-primary-hover disabled:opacity-40 disabled:cursor-not-allowed transition-colors'
const btnGhost = 'inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-lg border border-surface-border bg-white text-slate-600 text-xs font-semibold hover:bg-slate-50 disabled:opacity-40 transition-colors'
const inputCls = 'w-full rounded-lg border border-surface-border bg-white px-3 py-2 text-xs text-slate-800 outline-none focus:border-primary placeholder:text-slate-400'

/* A QR for `url`, drawn here (Meta only returns an image when a code is created). */
function QrImage({ url, size = 160, className }) {
  const [src, setSrc] = useState('')
  useEffect(() => {
    let off = false
    QRCode.toDataURL(url, { width: size * 2, margin: 2, errorCorrectionLevel: 'M' }).then(s => !off && setSrc(s)).catch(() => !off && setSrc(''))
    return () => { off = true }
  }, [url, size])
  return src
    ? <img src={src} width={size} height={size} alt={`QR code for ${url}`} className={className}/>
    : <div style={{ width: size, height: size }} className={clsx('bg-slate-100 animate-pulse rounded', className)}/>
}

function saveBlob(blob, name) {
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = name
  document.body.appendChild(a); a.click(); a.remove()
  setTimeout(() => URL.revokeObjectURL(a.href), 1000)
}
async function downloadQr(item, format) {
  if (format === 'svg') {
    const svg = await QRCode.toString(item.deepLinkUrl, { type: 'svg', margin: 2, errorCorrectionLevel: 'M' })
    saveBlob(new Blob([svg], { type: 'image/svg+xml' }), `whatsapp-qr-${item.code}.svg`)
  } else {
    const url = await QRCode.toDataURL(item.deepLinkUrl, { width: 1024, margin: 2, errorCorrectionLevel: 'M' })
    saveBlob(await (await fetch(url)).blob(), `whatsapp-qr-${item.code}.png`)
  }
}

function useCopy() {
  const [done, setDone] = useState(null)
  return [done, (text, key = text) => {
    navigator.clipboard?.writeText(text).then(() => { setDone(key); setTimeout(() => setDone(d => (d === key ? null : d)), 1500) }).catch(() => {})
  }]
}

/* ── QR codes & message links tab ─────────────────────────────────────────────────────────────────── */
function MessageForm({ initial, onSave, onClose }) {
  const [text, setText] = useState(initial?.prefilledMessage ?? '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const n = charCount(text)
  const editing = Boolean(initial)
  async function submit() {
    setSaving(true); setError('')
    try { await onSave(text.trim()); onClose() } catch (e) { setError(e.message); setSaving(false) }
  }
  return (
    <Modal title={editing ? 'Edit message link' : 'Create code'} onClose={onClose}>
      <label className="block text-xs font-bold text-slate-800" htmlFor="ml-message">Message</label>
      <p className="text-[11px] text-slate-500 mb-2">This will pre-compose a message for users to edit and send</p>
      <div className="relative">
        <textarea id="ml-message" autoFocus rows={4} value={text} onChange={(e) => setText(e.target.value)} className={clsx(inputCls, 'resize-none pr-14 py-2.5')}
          placeholder="e.g. Hi, I'd like to know more about your offer"/>
        <span className={clsx('absolute right-2.5 top-2 text-[10px] tabular-nums', n > MAX_MESSAGE_CHARS ? 'text-red-500 font-bold' : 'text-slate-400')}>{n}/{MAX_MESSAGE_CHARS}</span>
      </div>
      {editing && <p className="text-[11px] text-slate-500 mt-2 flex gap-1.5"><Info size={12} className="flex-shrink-0 mt-0.5 text-slate-400"/> The link and QR code stay the same, so anything already printed keeps working with the new message.</p>}
      {error && <p className="text-[11px] text-red-600 mt-2 flex gap-1.5"><AlertCircle size={12} className="flex-shrink-0 mt-0.5"/>{error}</p>}
      <div className="flex justify-end gap-2 mt-4">
        <button className={btnGhost} onClick={onClose} disabled={saving}>Cancel</button>
        <button className={btnPrimary} onClick={submit} disabled={saving || !text.trim() || n > MAX_MESSAGE_CHARS}>
          {saving && <Loader2 size={12} className="animate-spin"/>} Save
        </button>
      </div>
    </Modal>
  )
}

function QrPreview({ item, onClose }) {
  const [copied, copy] = useCopy()
  return (
    <Modal title="Message link" onClose={onClose} wide>
      <div className="flex flex-col items-center gap-3">
        <div className="p-3 bg-white border border-surface-border rounded-xl"><QrImage url={item.deepLinkUrl} size={220}/></div>
        <p className="text-xs font-mono text-slate-700 break-all text-center">{item.deepLinkUrl}</p>
        <p className="text-xs text-slate-500 text-center max-w-xs">"{item.prefilledMessage}"</p>
        <div className="flex flex-wrap justify-center gap-2 mt-1">
          <button className={btnGhost} onClick={() => copy(item.deepLinkUrl)}>{copied ? <Check size={12}/> : <Copy size={12}/>} {copied ? 'Copied' : 'Copy link'}</button>
          <button className={btnGhost} onClick={() => downloadQr(item, 'svg')}><Download size={12}/> SVG (print)</button>
          <button className={btnGhost} onClick={() => downloadQr(item, 'png')}><Download size={12}/> PNG</button>
        </div>
      </div>
    </Modal>
  )
}

function QrTab({ ml }) {
  const [form, setForm] = useState(null)          // null | { item? }
  const [preview, setPreview] = useState(null)
  const [del, setDel] = useState(null)
  const [delBusy, setDelBusy] = useState(false)
  const [delError, setDelError] = useState('')
  const [menu, setMenu] = useState(null)          // code whose download menu is open
  const [copied, copy] = useCopy()

  useEffect(() => {
    if (!menu) return
    const close = () => setMenu(null)
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [menu])

  return (
    <div className="space-y-4">
      {ml.sample && (
        <div className="flex items-start gap-2.5 text-[11px] text-amber-800 bg-amber-50 border border-amber-200 rounded-xl px-3.5 py-2.5 leading-relaxed">
          <Info size={13} className="flex-shrink-0 mt-0.5"/>
          <span><b>Sample mode.</b> Your WhatsApp number isn't connected to the API yet, so these links are examples and nothing is created on WhatsApp. Set <code className="font-mono bg-white/60 px-1 rounded">WA_PHONE_NUMBER_ID</code> and <code className="font-mono bg-white/60 px-1 rounded">WA_ACCESS_TOKEN</code> on the server to manage your real message links.</span>
        </div>
      )}

      <div className="flex items-start justify-between gap-3 flex-wrap">
        <p className="text-[11px] text-slate-500 max-w-xl leading-relaxed">
          A message link is a short WhatsApp link with a QR code. When someone scans or taps it, WhatsApp opens a chat with you and your message already typed in — put it on posters, packaging, receipts or your site.
        </p>
        <button className={btnPrimary} onClick={() => setForm({})}><Plus size={13}/> Create message link</button>
      </div>

      {ml.error && (
        <div className="flex items-start gap-2.5 text-xs text-red-700 bg-red-50 border border-red-200 rounded-xl p-3.5">
          <AlertCircle size={14} className="flex-shrink-0 mt-0.5"/>
          <div className="flex-1"><p className="font-semibold">Couldn't load your message links</p><p className="mt-0.5 text-red-600">{ml.error}</p></div>
          <button onClick={ml.reload} className="inline-flex items-center gap-1 font-semibold underline"><RefreshCw size={11}/> Retry</button>
        </div>
      )}

      <div className="border border-surface-border rounded-xl overflow-hidden bg-white">
        <div className="hidden md:grid grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)_auto] gap-3 px-4 py-2.5 text-[11px] font-bold text-slate-700 border-b border-surface-border bg-slate-50/60">
          <span>Message link</span><span>Message</span><span className="text-right pr-1">Actions</span>
        </div>
        {ml.loading && ml.items.length === 0 && <div className="flex items-center justify-center gap-2 text-xs text-slate-400 py-10"><Loader2 size={14} className="animate-spin"/> Loading…</div>}
        {!ml.loading && !ml.error && ml.items.length === 0 && (
          <div className="py-12 text-center">
            <QrCode size={26} className="mx-auto text-slate-300"/>
            <p className="text-xs font-semibold text-slate-600 mt-2">No message links yet</p>
            <p className="text-[11px] text-slate-400 mt-0.5">Create one to get a QR code with your message pre-filled.</p>
          </div>
        )}
        {ml.items.map((it) => (
          <div key={it.code} className="grid grid-cols-1 md:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)_auto] gap-x-3 gap-y-1.5 items-center px-4 py-3 border-b border-slate-100 last:border-0">
            <button onClick={() => setPreview(it)} className="flex items-center gap-2.5 text-left min-w-0 group" title="Show QR code">
              <QrCode size={18} className="text-slate-500 group-hover:text-primary flex-shrink-0"/>
              <span className="text-xs text-slate-800 truncate group-hover:text-primary">{it.deepLinkUrl}</span>
            </button>
            <p className="text-xs text-slate-600 truncate" title={it.prefilledMessage}>{it.prefilledMessage}</p>
            <div className="flex items-center justify-end">
              <div className="inline-flex rounded-lg border border-surface-border overflow-visible bg-white relative">
                <button className="p-2 text-slate-600 hover:bg-slate-50 rounded-l-lg" title={copied === it.code ? 'Copied' : 'Copy link'} aria-label="Copy link" onClick={() => copy(it.deepLinkUrl, it.code)}>
                  {copied === it.code ? <Check size={14} className="text-emerald-600"/> : <Copy size={14}/>}
                </button>
                <div className="relative border-l border-surface-border" onMouseDown={(e) => e.stopPropagation()}>
                  <button className="p-2 text-slate-600 hover:bg-slate-50 h-full" title="Download QR code" aria-label="Download QR code" aria-haspopup="menu" aria-expanded={menu === it.code} onClick={() => setMenu(menu === it.code ? null : it.code)}><Download size={14}/></button>
                  {menu === it.code && (
                    <div role="menu" className="absolute right-0 top-full mt-1 z-30 w-44 bg-white border border-surface-border rounded-lg shadow-xl py-1">
                      <button role="menuitem" className="w-full text-left px-3 py-2 text-xs hover:bg-slate-50" onClick={() => { setMenu(null); downloadQr(it, 'svg') }}>SVG <span className="text-slate-400">· best for print</span></button>
                      <button role="menuitem" className="w-full text-left px-3 py-2 text-xs hover:bg-slate-50" onClick={() => { setMenu(null); downloadQr(it, 'png') }}>PNG <span className="text-slate-400">· for screens</span></button>
                    </div>
                  )}
                </div>
                <button className="p-2 text-slate-600 hover:bg-slate-50 border-l border-surface-border" title="Edit message" aria-label="Edit message" onClick={() => setForm({ item: it })}><Pencil size={14}/></button>
                <button className="p-2 text-slate-600 hover:bg-red-50 hover:text-red-600 border-l border-surface-border rounded-r-lg" title="Delete" aria-label="Delete" onClick={() => { setDelError(''); setDel(it) }}><Trash2 size={14}/></button>
              </div>
            </div>
          </div>
        ))}
      </div>

      <p className="text-[10.5px] text-slate-400 leading-relaxed">
        Up to 2,000 message links per WhatsApp number · messages up to {MAX_MESSAGE_CHARS} characters · WhatsApp doesn't provide scan analytics for these links.
      </p>

      {form && <MessageForm initial={form.item} onClose={() => setForm(null)} onSave={(t) => (form.item ? ml.update(form.item.code, t) : ml.create(t))}/>}
      {preview && <QrPreview item={preview} onClose={() => setPreview(null)}/>}
      {del && (
        <Modal title="Delete this message link?" onClose={() => !delBusy && setDel(null)} wide
          footer={<>
            <button className={btnGhost} disabled={delBusy} onClick={() => setDel(null)}>Cancel</button>
            <button className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-red-500 text-white text-xs font-bold hover:bg-red-600 disabled:opacity-50" disabled={delBusy}
              onClick={async () => { setDelBusy(true); setDelError(''); try { await ml.remove(del.code); setDel(null) } catch (e) { setDelError(e.message) } finally { setDelBusy(false) } }}>
              {delBusy && <Loader2 size={12} className="animate-spin"/>} Delete
            </button>
          </>}>
          <p className="text-xs text-slate-600 leading-relaxed">People who scan a printed QR code or open this link will see an "expired" message. This can't be undone.</p>
          <p className="text-xs font-mono text-slate-500 mt-2 break-all">{del.deepLinkUrl}</p>
          {delError && <p className="text-[11px] text-red-600 mt-2">{delError}</p>}
        </Modal>
      )}
    </div>
  )
}

/* ── Website widget tab ───────────────────────────────────────────────────────────────────────────── */
const WIDGET_KEY = 'chatflow_wa_widget'
const WIDGET_DEFAULTS = {
  linkMode: 'chat',                         // 'chat' = click-to-chat (number + message) · or a wa.me message-link URL
  phone: '919876543210',
  message: 'Hi! I have a question.',
  name: 'ChatFlow Support',
  subtitle: 'Typically replies in minutes',
  welcome: 'Hi 👋 How can we help you today?',
  cta: 'Start chat on WhatsApp',
  label: 'Chat with us',
  color: '#25D366',
  position: 'right',
  openAfter: 0,
  mobile: true,
}
const COLOR_PRESETS = ['#25D366', '#128C7E', '#0066ff', '#8B5CF6', '#F59E0B', '#111827']

function loadWidget() {
  try { return { ...WIDGET_DEFAULTS, ...JSON.parse(localStorage.getItem(WIDGET_KEY) || '{}') } } catch { return WIDGET_DEFAULTS }
}
const digits = (s) => String(s || '').replace(/\D/g, '')
const validHex = (c) => /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(c)

function targetUrl(w) {
  if (w.linkMode !== 'chat') return w.linkMode
  const p = digits(w.phone)
  if (p.length < 8 || p.length > 15) return ''
  return `https://wa.me/${p}${w.message ? `?text=${encodeURIComponent(w.message)}` : ''}`
}
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
function snippetFor(w) {
  const attrs = [
    w.linkMode === 'chat' ? `data-phone="${esc(digits(w.phone))}"` : `data-link="${esc(w.linkMode)}"`,
    w.linkMode === 'chat' && w.message ? `data-message="${esc(w.message)}"` : null,
    `data-name="${esc(w.name)}"`, `data-subtitle="${esc(w.subtitle)}"`, `data-welcome="${esc(w.welcome)}"`, `data-cta="${esc(w.cta)}"`,
    w.label ? `data-label="${esc(w.label)}"` : null,
    `data-color="${esc(validHex(w.color) ? w.color : '#25D366')}"`, `data-position="${w.position}"`,
    w.openAfter > 0 ? `data-open-after="${w.openAfter}"` : null, w.mobile ? null : 'data-mobile="false"',
  ].filter(Boolean)
  return `<script src="${WA_WIDGET_SRC}" async\n  ${attrs.join('\n  ')}></script>`
}

function Field({ label, hint, children, className }) {
  return (
    <div className={className}>
      <label className="block text-[11px] font-semibold text-slate-700 mb-1">{label}</label>
      {children}
      {hint && <p className="text-[10px] text-slate-400 mt-1">{hint}</p>}
    </div>
  )
}

/* The same widget as public/wa-widget.js, drawn on a mock page so changes show instantly. */
function WidgetPreview({ w, device }) {
  const [open, setOpen] = useState(true)
  const color = validHex(w.color) ? w.color : '#25D366'
  const left = w.position === 'left'
  const url = targetUrl(w)
  return (
    <div className={clsx('relative mx-auto rounded-xl border border-surface-border bg-slate-50 overflow-hidden transition-all', device === 'mobile' ? 'w-[300px]' : 'w-full')} style={{ height: 440 }}>
      {/* a stand-in website */}
      <div className="p-4 space-y-2.5 opacity-70" aria-hidden="true">
        <div className="h-3 w-1/3 rounded bg-slate-200"/>
        <div className="h-2 w-full rounded bg-slate-200"/><div className="h-2 w-5/6 rounded bg-slate-200"/><div className="h-2 w-2/3 rounded bg-slate-200"/>
        <div className="h-20 w-full rounded-lg bg-slate-200 mt-3"/>
        <div className="h-2 w-4/5 rounded bg-slate-200"/><div className="h-2 w-3/5 rounded bg-slate-200"/>
      </div>
      <div className={clsx('absolute bottom-4 flex flex-col gap-3', left ? 'left-4 items-start' : 'right-4 items-end')}>
        {open && (
          <div className="rounded-2xl bg-white shadow-xl overflow-hidden" style={{ width: device === 'mobile' ? 260 : 300 }}>
            <div className="flex items-center gap-2.5 px-3.5 py-3 text-white" style={{ background: color }}>
              <span className="w-9 h-9 rounded-full bg-white/25 flex items-center justify-center flex-shrink-0"><WaGlyph size={20}/></span>
              <div className="flex-1 min-w-0">
                <p className="text-[13px] font-bold leading-tight truncate">{w.name || 'Chat with us'}</p>
                <p className="text-[11px] opacity-90 mt-0.5 truncate">{w.subtitle}</p>
              </div>
              <button onClick={() => setOpen(false)} aria-label="Close preview card" className="w-7 h-7 rounded-md text-lg leading-none hover:bg-white/20">×</button>
            </div>
            <div className="p-3.5" style={{ background: '#efeae2' }}>
              <div className="inline-block max-w-[90%] bg-white text-[12px] leading-snug text-slate-900 px-3 py-2 shadow-sm whitespace-pre-wrap break-words" style={{ borderRadius: '0 12px 12px 12px' }}>{w.welcome}</div>
            </div>
            <div className="p-3 bg-white">
              <a href={url || undefined} target="_blank" rel="noopener noreferrer" onClick={(e) => !url && e.preventDefault()}
                className={clsx('flex items-center justify-center gap-2 w-full rounded-full py-2.5 text-[12px] font-bold text-white', !url && 'opacity-50 cursor-not-allowed')} style={{ background: color }}>
                <WaGlyph size={15}/> {w.cta || 'Start chat'}
              </a>
            </div>
          </div>
        )}
        <div className={clsx('flex items-center gap-2.5', left ? 'flex-row' : 'flex-row-reverse')}>
          <button onClick={() => setOpen(o => !o)} aria-label={open ? 'Close chat card' : 'Open chat card'} className="w-14 h-14 rounded-full text-white shadow-lg flex items-center justify-center hover:scale-105 transition-transform" style={{ background: color }}>
            <WaGlyph size={28}/>
          </button>
          {w.label && !open && <span className="bg-white text-slate-800 text-[12px] font-semibold px-3 py-1.5 rounded-full shadow-md whitespace-nowrap">{w.label}</span>}
        </div>
      </div>
    </div>
  )
}

function WidgetTab({ ml }) {
  const [w, setW] = useState(loadWidget)
  const [device, setDevice] = useState('desktop')
  const [copied, copy] = useCopy()
  const set = (k, v) => setW(p => { const n = { ...p, [k]: v }; try { localStorage.setItem(WIDGET_KEY, JSON.stringify(n)) } catch { /* not remembered */ } return n })

  // A message link that was deleted must not stay selected.
  const linkExists = w.linkMode === 'chat' || ml.items.some(i => i.deepLinkUrl === w.linkMode)
  useEffect(() => { if (!ml.loading && !linkExists) set('linkMode', 'chat') }, [ml.loading, linkExists]) // eslint-disable-line react-hooks/exhaustive-deps

  const url = targetUrl(w)
  const phoneOk = w.linkMode !== 'chat' || (digits(w.phone).length >= 8 && digits(w.phone).length <= 15)
  const snippet = useMemo(() => snippetFor(w), [w])

  return (
    <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-5 items-start">
      {/* settings */}
      <div className="space-y-4 min-w-0">
        <div className="rounded-xl border border-surface-border p-4 space-y-3">
          <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Where the button goes</p>
          <Field label="Open WhatsApp with">
            <select value={w.linkMode} onChange={(e) => set('linkMode', e.target.value)} className={inputCls}>
              <option value="chat">My WhatsApp number + a message (click-to-chat)</option>
              {ml.items.map(i => <option key={i.code} value={i.deepLinkUrl}>Message link · {i.prefilledMessage.slice(0, 40)}{i.prefilledMessage.length > 40 ? '…' : ''}</option>)}
            </select>
          </Field>
          {w.linkMode === 'chat' ? (<>
            <Field label="WhatsApp number" hint="Country code first, digits only — e.g. 919876543210 for +91 98765 43210.">
              <input value={w.phone} inputMode="numeric" onChange={(e) => set('phone', e.target.value)} className={clsx(inputCls, !phoneOk && 'border-red-400')} placeholder="919876543210"/>
              {!phoneOk && <p className="text-[10px] text-red-500 mt-1">Enter 8–15 digits including the country code.</p>}
            </Field>
            <Field label="Message typed in for the visitor" hint="They can edit it before sending.">
              <textarea rows={2} value={w.message} onChange={(e) => set('message', e.target.value)} className={clsx(inputCls, 'resize-none')} maxLength={300}/>
            </Field>
          </>) : (
            <p className="text-[11px] text-slate-500 flex gap-1.5"><Info size={12} className="flex-shrink-0 mt-0.5 text-slate-400"/> Uses the link's own message. Change it in the QR Codes &amp; Message Links tab.</p>
          )}
          <div className="flex items-center gap-2 pt-1">
            <button className={btnGhost} disabled={!url} onClick={() => window.open(url, '_blank', 'noopener,noreferrer')}><ExternalLink size={12}/> Test the link</button>
          </div>
        </div>

        <div className="rounded-xl border border-surface-border p-4 space-y-3">
          <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">What visitors see</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="Business name"><input value={w.name} onChange={(e) => set('name', e.target.value)} className={inputCls} maxLength={40}/></Field>
            <Field label="Line under the name"><input value={w.subtitle} onChange={(e) => set('subtitle', e.target.value)} className={inputCls} maxLength={50}/></Field>
          </div>
          <Field label="Greeting"><textarea rows={2} value={w.welcome} onChange={(e) => set('welcome', e.target.value)} className={clsx(inputCls, 'resize-none')} maxLength={160}/></Field>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="Button text"><input value={w.cta} onChange={(e) => set('cta', e.target.value)} className={inputCls} maxLength={32}/></Field>
            <Field label="Label next to the button" hint="Optional. Leave empty for just the icon."><input value={w.label} onChange={(e) => set('label', e.target.value)} className={inputCls} maxLength={28}/></Field>
          </div>
        </div>

        <div className="rounded-xl border border-surface-border p-4 space-y-3">
          <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Look &amp; behaviour</p>
          <Field label="Colour">
            <div className="flex items-center gap-2 flex-wrap">
              {COLOR_PRESETS.map(c => (
                <button key={c} onClick={() => set('color', c)} aria-label={`Colour ${c}`} aria-pressed={w.color.toLowerCase() === c.toLowerCase()}
                  className={clsx('w-7 h-7 rounded-full border-2 transition-all', w.color.toLowerCase() === c.toLowerCase() ? 'border-slate-800 scale-110' : 'border-white shadow ring-1 ring-slate-200')} style={{ background: c }}/>
              ))}
              <input value={w.color} onChange={(e) => set('color', e.target.value)} className={clsx(inputCls, 'w-28 font-mono', !validHex(w.color) && 'border-red-400')} maxLength={7} aria-label="Colour hex code"/>
            </div>
          </Field>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="Position">
              <div className="flex gap-1.5">
                {['left', 'right'].map(p => (
                  <button key={p} onClick={() => set('position', p)} aria-pressed={w.position === p}
                    className={clsx('flex-1 px-3 py-2 rounded-lg border text-xs font-semibold capitalize', w.position === p ? 'border-primary bg-primary/5 text-primary' : 'border-surface-border text-slate-600 hover:bg-slate-50')}>Bottom {p}</button>
                ))}
              </div>
            </Field>
            <Field label="Open the card automatically" hint="Once per visit. 0 = only when clicked.">
              <div className="flex items-center gap-2">
                <input type="number" min={0} max={120} value={w.openAfter} onChange={(e) => set('openAfter', Math.max(0, Math.min(120, parseInt(e.target.value, 10) || 0)))} className={clsx(inputCls, 'w-20')}/>
                <span className="text-xs text-slate-500">seconds</span>
              </div>
            </Field>
          </div>
          <label className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer select-none">
            <input type="checkbox" className="accent-primary" checked={w.mobile} onChange={(e) => set('mobile', e.target.checked)}/> Show on phones
          </label>
        </div>
      </div>

      {/* preview + code */}
      <div className="space-y-4 min-w-0 xl:sticky xl:top-0">
        <div className="rounded-xl border border-surface-border p-4">
          <div className="flex items-center justify-between mb-3">
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Preview</p>
            <div className="inline-flex rounded-lg bg-slate-100 p-0.5" role="group" aria-label="Preview size">
              {[['desktop', Monitor], ['mobile', Smartphone]].map(([id, Icon]) => (
                <button key={id} onClick={() => setDevice(id)} aria-pressed={device === id} aria-label={`${id} preview`}
                  className={clsx('px-2.5 py-1 rounded-md', device === id ? 'bg-white shadow-sm text-slate-800' : 'text-slate-500')}><Icon size={13}/></button>
              ))}
            </div>
          </div>
          <WidgetPreview w={w} device={device}/>
        </div>

        <div className="rounded-xl border border-surface-border p-4">
          <div className="flex items-center justify-between mb-2">
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Add it to your website</p>
            <button className={btnGhost} onClick={() => copy(snippet, 'snippet')}>{copied === 'snippet' ? <Check size={12}/> : <Copy size={12}/>} {copied === 'snippet' ? 'Copied' : 'Copy code'}</button>
          </div>
          <pre className="text-[11px] leading-relaxed bg-slate-900 text-slate-100 rounded-lg p-3 overflow-x-auto whitespace-pre-wrap break-all"><code>{snippet}</code></pre>
          <p className="text-[11px] text-slate-500 mt-2.5 leading-relaxed">Paste it just before <code className="font-mono">&lt;/body&gt;</code> on every page where the button should appear. Visitors who tap it go straight to WhatsApp — on a phone that opens the app. Change the settings here and copy the code again to update it.</p>
        </div>
      </div>
    </div>
  )
}

/* ── the section ──────────────────────────────────────────────────────────────────────────────────── */
export default function WidgetQRSection() {
  const [tab, setTab] = useState('widget')
  const ml = useMessageLinks()
  return (
    <div>
      <div style={{ marginBottom: 14 }}>
        <h2 style={{ fontSize: 14, fontWeight: 700, color: '#0f172a', margin: 0 }}>Widget &amp; QR Codes</h2>
        <p style={{ fontSize: 11, color: '#64748b', margin: '3px 0 0' }}>Let people reach you on WhatsApp from your website, posters and packaging — each one opens a chat with your message already typed.</p>
      </div>
      <div className="inline-flex items-center gap-1 bg-slate-100 rounded-xl p-1 mb-4" role="tablist">
        {[['widget', 'Website Widget', MessageCircle], ['qr', 'QR Codes & Message Links', QrCode]].map(([id, label, Icon]) => (
          <button key={id} role="tab" aria-selected={tab === id} onClick={() => setTab(id)}
            className={clsx('inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-semibold transition-all whitespace-nowrap', tab === id ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700')}>
            <Icon size={12}/> {label}
          </button>
        ))}
      </div>
      {tab === 'widget' ? <WidgetTab ml={ml}/> : <QrTab ml={ml}/>}
    </div>
  )
}
