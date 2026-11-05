// WidgetQRSection.jsx — Settings → "Widget & QR Codes" (WhatsApp).
//
//   Website Widget            a floating "Chat on WhatsApp" button + card for the merchant's site: main button, up to
//                             three quick buttons (own message each) and a QR code. Plain links to WhatsApp — public/wa-widget.js.
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
const WIDGET_KEY = 'chatflow_wa_widget_v3'
const MAX_QUICK = 3
const MAX_MAIN_MESSAGE = 80
const WIDGET_DEFAULTS = {
  linkMode: 'chat',                         // 'chat' = click-to-chat (number + message) · or a wa.me message-link URL
  phone: '919876543210',
  message: 'Hi! I have a question.',
  quick: [
    { id: 'q1', label: 'See pricing', message: 'Hi! Could you share your pricing?' },
    { id: 'q2', label: 'Book a demo', message: 'Hi! I would like to book a demo.' },
  ],
  qr: true,
  name: 'Chat with us',
  subtitle: 'Typically replies in minutes',
  welcome: 'Hi 👋 How can we help you today?',
  cta: 'Start chat on WhatsApp',
  color: '#5B5BF0',
  font: '',
  theme: 'light',
  position: 'right',
  openAfter: 0,
  mobile: true,
  branding: true,
}
const FONT_OPTIONS = [
  ['', 'System default'], ['Inter', 'Inter'], ['Poppins', 'Poppins'], ['DM Sans', 'DM Sans'], ['Manrope', 'Manrope'],
  ['Nunito', 'Nunito (rounded)'], ['Roboto', 'Roboto'], ['Playfair Display', 'Playfair Display (serif)'], ['Georgia', 'Georgia (serif, no download)'],
]
const COLOR_PRESETS = ['#5B5BF0', '#0F172A', '#0EA5E9', '#059669', '#E11D48', '#F59E0B']

function loadWidget() {
  try {
    const saved = JSON.parse(localStorage.getItem(WIDGET_KEY) || '{}')
    const quick = Array.isArray(saved.quick) ? saved.quick.slice(0, MAX_QUICK) : WIDGET_DEFAULTS.quick
    return { ...WIDGET_DEFAULTS, ...saved, quick, message: [...String(saved.message ?? WIDGET_DEFAULTS.message)].slice(0, MAX_MAIN_MESSAGE).join('') }
  } catch { return WIDGET_DEFAULTS }
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

/* The <script> tag for these settings: only values that differ from the script's own defaults, so it stays short.
   `src` and `extra` differ for the preview (local file, card forced open). */
const SNIPPET_DEFAULTS = { name: 'Chat with us', subtitle: 'Typically replies in minutes', welcome: 'Hi 👋 How can we help you today?', cta: 'Start chat on WhatsApp', color: '#5B5BF0', font: '', theme: 'light', position: 'right' }
function snippetFor(w, src = WA_WIDGET_SRC, extra = []) {
  const chat = w.linkMode === 'chat'
  const at = (k, v) => `data-${k}="${esc(v)}"`
  const quick = chat ? w.quick.filter(q => q.label.trim()).slice(0, MAX_QUICK) : []
  const look = Object.entries(SNIPPET_DEFAULTS)
    .filter(([k, def]) => (k === 'color' ? (validHex(w.color) ? w.color : def) : w[k]) !== def)
    .map(([k]) => at(k, k === 'color' ? w.color : w[k]))
  const lines = [
    [chat ? at('phone', digits(w.phone)) : at('link', w.linkMode), chat && w.message ? at('message', w.message) : null],
    ...quick.map((q, i) => [at(`q${i + 1}`, `${q.label.trim().replace(/\|/g, '/')}|${q.message.trim()}`)]),
    look,
    [w.qr ? null : 'data-qr="false"', w.openAfter > 0 ? at('open-after', w.openAfter) : null, w.mobile ? null : 'data-mobile="false"', w.branding ? null : 'data-branding="false"', ...extra],
  ].map(l => l.filter(Boolean).join(' ')).filter(Boolean)
  return `<script src="${src}" async\n  ${lines.join('\n  ')}></script>`
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

function Toggle({ checked, onChange, label, hint }) {
  return (
    <label className="flex items-start gap-3 cursor-pointer select-none">
      <button type="button" role="switch" aria-checked={checked} aria-label={label} onClick={() => onChange(!checked)}
        className={clsx('relative w-9 h-5 rounded-full flex-shrink-0 transition-colors mt-0.5', checked ? 'bg-primary' : 'bg-slate-300')}>
        <span className={clsx('absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all', checked ? 'left-[18px]' : 'left-0.5')}/>
      </button>
      <span>
        <span className="block text-xs font-semibold text-slate-700">{label}</span>
        {hint && <span className="block text-[10.5px] text-slate-400 mt-0.5 leading-snug">{hint}</span>}
      </span>
    </label>
  )
}

/* The widget itself, running in a frame — the very file visitors get (public/wa-widget.js), so the preview can
   never drift from the real thing. Phone size triggers the widget's own mobile layout.
   allow-same-origin: without it the frame's origin is opaque and Vite's dev server refuses to serve it the script;
   the frame only ever holds our own script and the (attribute-escaped) settings of the person editing them. */
function WidgetPreview({ w, device }) {
  const frameW = device === 'mobile' ? 375 : null
  // Re-render the frame a moment after the last edit, not on every keystroke.
  const [settled, setSettled] = useState(w)
  useEffect(() => { const t = setTimeout(() => setSettled(w), 250); return () => clearTimeout(t) }, [w])
  const doc = useMemo(() => {
    const tag = snippetFor(settled, `${window.location.origin}/wa-widget.js`, ['data-preview="1"', device === 'mobile' ? 'data-device="mobile"' : null])
    return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>
      html,body{margin:0;height:100%;overflow:hidden;background:linear-gradient(180deg,#f8fafc,#eef2f7);font-family:system-ui,sans-serif}
      .s{padding:22px;display:grid;gap:12px;opacity:.9}.b{background:#dfe5ee;border-radius:8px;height:10px}.h{height:16px;width:34%;background:#cdd5e1;border-radius:8px}
      .hero{height:110px;border-radius:16px;background:linear-gradient(135deg,#d9e0ec,#e8edf5)}
    </style></head><body><div class="s"><div class="h"></div><div class="b" style="width:92%"></div><div class="b" style="width:78%"></div><div class="hero"></div><div class="b" style="width:60%"></div><div class="b" style="width:84%"></div></div>${tag}</body></html>`
  }, [settled, device])
  return (
    <div className={clsx('mx-auto rounded-2xl border border-surface-border overflow-hidden bg-slate-100 transition-all', device === 'mobile' ? 'shadow-xl' : '')}
      style={{ width: frameW ?? '100%', maxWidth: '100%' }}>
      <iframe title="Widget preview" srcDoc={doc} sandbox="allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox" scrolling="no" className="block w-full border-0" style={{ height: device === 'mobile' ? 440 : 480 }}/>
    </div>
  )
}

function QuickButtons({ w, set }) {
  const chat = w.linkMode === 'chat'
  const list = w.quick
  const update = (id, patch) => set('quick', list.map(q => q.id === id ? { ...q, ...patch } : q))
  return (
    <div className="rounded-xl border border-surface-border p-4 space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Quick buttons</p>
        <span className="text-[10px] font-semibold text-slate-400 tabular-nums">{list.length} of {MAX_QUICK}</span>
      </div>
      <p className="text-[11px] text-slate-500 leading-relaxed">Shortcuts under the main button. Each one opens WhatsApp with its own message already typed — e.g. "See pricing", "Track my order".</p>
      {!chat && (
        <p className="text-[11px] text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 flex gap-1.5"><Info size={12} className="flex-shrink-0 mt-0.5"/> Quick buttons need your WhatsApp number. Switch "Open WhatsApp with" to the number option above to use them.</p>
      )}
      <div className={clsx('space-y-2.5', !chat && 'opacity-50 pointer-events-none')}>
        {list.map((q, i) => (
          <div key={q.id} className="rounded-lg border border-surface-border bg-slate-50/60 p-3 space-y-2">
            <div className="flex items-center gap-2">
              <span className="w-5 h-5 rounded-md bg-white border border-surface-border text-[10px] font-bold text-slate-500 flex items-center justify-center flex-shrink-0">{i + 1}</span>
              <input value={q.label} onChange={(e) => update(q.id, { label: e.target.value })} className={inputCls} placeholder="Button text, e.g. See pricing" maxLength={24} aria-label={`Quick button ${i + 1} text`}/>
              <button onClick={() => set('quick', list.filter(x => x.id !== q.id))} aria-label={`Remove quick button ${i + 1}`} className="p-2 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 flex-shrink-0"><Trash2 size={14}/></button>
            </div>
            <textarea value={q.message} onChange={(e) => update(q.id, { message: e.target.value })} rows={2} maxLength={300} className={clsx(inputCls, 'resize-none')} placeholder="Message typed in when they tap it" aria-label={`Quick button ${i + 1} message`}/>
          </div>
        ))}
        {list.length === 0 && <p className="text-[11px] text-slate-400 text-center py-2">No quick buttons yet.</p>}
        <button disabled={list.length >= MAX_QUICK} onClick={() => set('quick', [...list, { id: `q${Date.now()}`, label: '', message: '' }])}
          className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg border border-dashed border-slate-300 text-xs font-semibold text-slate-600 hover:border-primary hover:text-primary hover:bg-primary/5 disabled:opacity-40 disabled:hover:border-slate-300 disabled:hover:text-slate-600 disabled:hover:bg-transparent disabled:cursor-not-allowed transition-colors">
          <Plus size={13}/> {list.length >= MAX_QUICK ? 'Maximum of 3 reached' : 'Add quick button'}
        </button>
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
    <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)] gap-5 items-start">
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
            <Field label="Message for the main button" hint="Typed into WhatsApp for the visitor, who can edit it before sending.">
              <div className="relative">
                <textarea rows={2} value={w.message} onChange={(e) => set('message', [...e.target.value].slice(0, MAX_MAIN_MESSAGE).join(''))} className={clsx(inputCls, 'resize-none pb-6')} aria-describedby="main-msg-count"/>
                <span id="main-msg-count" className={clsx('absolute right-2.5 bottom-1.5 text-[10px] tabular-nums', [...w.message].length >= MAX_MAIN_MESSAGE ? 'text-amber-600 font-bold' : 'text-slate-400')}>{[...w.message].length}/{MAX_MAIN_MESSAGE}</span>
              </div>
            </Field>
          </>) : (
            <p className="text-[11px] text-slate-500 flex gap-1.5"><Info size={12} className="flex-shrink-0 mt-0.5 text-slate-400"/> Uses the link's own message. Change it in the QR Codes &amp; Message Links tab.</p>
          )}
          <button className={btnGhost} disabled={!url} onClick={() => window.open(url, '_blank', 'noopener,noreferrer')}><ExternalLink size={12}/> Test the link</button>
        </div>

        <QuickButtons w={w} set={set}/>

        <div className="rounded-xl border border-surface-border p-4 space-y-3">
          <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">What visitors see</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="Business name"><input value={w.name} onChange={(e) => set('name', e.target.value)} className={inputCls} maxLength={40}/></Field>
            <Field label="Status line"><input value={w.subtitle} onChange={(e) => set('subtitle', e.target.value)} className={inputCls} maxLength={50}/></Field>
          </div>
          <Field label="Greeting message" hint="Shown as a chat bubble from your business."><textarea rows={2} value={w.welcome} onChange={(e) => set('welcome', e.target.value)} className={clsx(inputCls, 'resize-none')} maxLength={120}/></Field>
          <Field label="Main button text"><input value={w.cta} onChange={(e) => set('cta', e.target.value)} className={inputCls} maxLength={32}/></Field>
          <Toggle checked={w.qr} onChange={(v) => set('qr', v)} label="Show a QR code" hint="Shown right in the card, on computers only. It opens your main button’s chat."/>
        </div>

        <div className="rounded-xl border border-surface-border p-4 space-y-3">
          <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Look &amp; behaviour</p>
          <Field label="Accent colour" hint="Buttons, header and highlights. Text colour adjusts automatically to stay readable.">
            <div className="flex items-center gap-2 flex-wrap">
              {COLOR_PRESETS.map(c => (
                <button key={c} onClick={() => set('color', c)} aria-label={`Colour ${c}`} aria-pressed={w.color.toLowerCase() === c.toLowerCase()}
                  className={clsx('w-7 h-7 rounded-full border-2 transition-all', w.color.toLowerCase() === c.toLowerCase() ? 'border-slate-800 scale-110' : 'border-white shadow ring-1 ring-slate-200')} style={{ background: c }}/>
              ))}
              <input value={w.color} onChange={(e) => set('color', e.target.value)} className={clsx(inputCls, 'w-28 font-mono', !validHex(w.color) && 'border-red-400')} maxLength={7} aria-label="Colour hex code"/>
            </div>
          </Field>
          <Field label="Font" hint="Web fonts are loaded from Google Fonts only when chosen; “System default” loads nothing.">
            <select value={w.font} onChange={(e) => set('font', e.target.value)} className={inputCls}>
              {FONT_OPTIONS.map(([v, label]) => <option key={v} value={v}>{label}</option>)}
            </select>
          </Field>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="Theme">
              <div className="flex gap-1.5">
                {[['light', 'Light'], ['dark', 'Dark']].map(([id, label]) => (
                  <button key={id} onClick={() => set('theme', id)} aria-pressed={w.theme === id}
                    className={clsx('flex-1 px-3 py-2 rounded-lg border text-xs font-semibold', w.theme === id ? 'border-primary bg-primary/5 text-primary' : 'border-surface-border text-slate-600 hover:bg-slate-50')}>{label}</button>
                ))}
              </div>
            </Field>
            <Field label="Position">
              <div className="flex gap-1.5">
                {['left', 'right'].map(p => (
                  <button key={p} onClick={() => set('position', p)} aria-pressed={w.position === p}
                    className={clsx('flex-1 px-3 py-2 rounded-lg border text-xs font-semibold capitalize', w.position === p ? 'border-primary bg-primary/5 text-primary' : 'border-surface-border text-slate-600 hover:bg-slate-50')}>{p}</button>
                ))}
              </div>
            </Field>
          </div>
          <Field label="Open the card automatically" hint="Once per visit. 0 = only when clicked.">
            <div className="flex items-center gap-2">
              <input type="number" min={0} max={120} value={w.openAfter} onChange={(e) => set('openAfter', Math.max(0, Math.min(120, parseInt(e.target.value, 10) || 0)))} className={clsx(inputCls, 'w-20')}/>
              <span className="text-xs text-slate-500">seconds</span>
            </div>
          </Field>
          <div className="space-y-2.5 pt-1">
            <Toggle checked={w.mobile} onChange={(v) => set('mobile', v)} label="Show on phones" hint="On phones the card opens as a full-width sheet."/>
            <Toggle checked={w.branding} onChange={(v) => set('branding', v)} label={'Show "Powered by SmatBot"'} hint="Clicking it opens a short form (name, email and phone required; company and website optional) and then takes the visitor to smatbot.com."/>
          </div>
        </div>
      </div>

      {/* preview + code */}
      <div className="space-y-4 min-w-0 xl:sticky xl:top-0">
        <div className="rounded-xl border border-surface-border p-4">
          <div className="flex items-center justify-between mb-3">
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Live preview</p>
            <div className="inline-flex rounded-lg bg-slate-100 p-0.5" role="group" aria-label="Preview size">
              {[['desktop', Monitor], ['mobile', Smartphone]].map(([id, Icon]) => (
                <button key={id} onClick={() => setDevice(id)} aria-pressed={device === id} aria-label={`${id} preview`}
                  className={clsx('px-2.5 py-1 rounded-md', device === id ? 'bg-white shadow-sm text-slate-800' : 'text-slate-500')}><Icon size={13}/></button>
              ))}
            </div>
          </div>
          <WidgetPreview w={w} device={device}/>
          <p className="text-[10.5px] text-slate-400 mt-2">This is the real widget, so buttons open WhatsApp exactly as they will on your site. Close the card with × to see the launcher.</p>
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
