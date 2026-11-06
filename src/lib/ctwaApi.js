/* Click-to-WhatsApp ads client — /api/whatsapp/ctwa/* (backend/src/ctwa). Tokens stay on the server.
   Before a Meta ad account is connected the server answers with editable sample data (mode: 'sample'). */
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api'

async function call(method, path, body) {
  const res = await fetch(`${API_BASE_URL}/whatsapp/ctwa${path}`, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  }).catch(() => null)
  if (!res) throw new Error('Could not reach the server. Check the connection and try again.')
  const json = await res.json().catch(() => ({}))
  if (!res.ok) {
    const err = new Error(json.message || `Request failed (${res.status})`)
    err.code = json.error
    err.fields = json.fields
    throw err
  }
  return json
}

export const ctwa = {
  dashboard: (start, end) => call('GET', `/dashboard?start=${start}&end=${end}`),
  status:    ()           => call('GET', '/status'),
  createAd:  (input)      => call('POST', '/ads', input),
  updateAd:  (id, patch)  => call('PATCH', `/ads/${encodeURIComponent(id)}`, patch),
  archiveAd: (id)         => call('DELETE', `/ads/${encodeURIComponent(id)}`),
  leads:     (adId)       => call('GET', `/leads?limit=500${adId ? `&adId=${encodeURIComponent(adId)}` : ''}`),
  lead:      (waId)       => call('GET', `/lead?waId=${encodeURIComponent(String(waId).replace(/\D/g, ''))}`),
  sendEvent: (payload)    => call('POST', '/events', payload),
  // the customer's Meta account, connected with the Facebook popup
  connection:   ()             => call('GET', '/connect'),
  connect:      (code, session) => call('POST', '/connect', { code, session }),
  selectAssets: (sel)          => call('POST', '/connect/select', sel),
  disconnect:   ()             => call('DELETE', '/connect'),
}

/* ── formatting shared by the CTWA screens ── */
export const num = (n) => (n === null || n === undefined ? '—' : Number(n).toLocaleString('en-IN'))
export const pct = (n) => (n === null || n === undefined ? '—' : `${n.toFixed(2)}%`)
export function money(n, currency = 'INR', digits = 0) {
  if (n === null || n === undefined) return '—'
  try { return new Intl.NumberFormat('en-IN', { style: 'currency', currency, maximumFractionDigits: digits, minimumFractionDigits: digits }).format(n) }
  catch { return `${currency} ${Number(n).toFixed(digits)}` }
}

export const STATUS_STYLE = {
  ACTIVE: 'bg-emerald-50 text-emerald-700',
  PAUSED: 'bg-slate-100 text-slate-600',
  PENDING_REVIEW: 'bg-amber-50 text-amber-700',
  IN_PROCESS: 'bg-amber-50 text-amber-700',
  DISAPPROVED: 'bg-red-50 text-red-600',
  WITH_ISSUES: 'bg-red-50 text-red-600',
  CAMPAIGN_PAUSED: 'bg-slate-100 text-slate-600',
  ADSET_PAUSED: 'bg-slate-100 text-slate-600',
}
export const statusLabel = (s) => String(s || '').toLowerCase().replace(/_/g, ' ').replace(/^\w/, (c) => c.toUpperCase())

/** unix seconds for "the last N days, ending now" */
export const lastDays = (n) => { const end = Math.floor(Date.now() / 1000); return [end - n * 86400, end] }
