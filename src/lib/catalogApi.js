/* Facebook / WhatsApp catalog client — /api/whatsapp/catalog/* (backend/src/catalog). Tokens stay on the server.
   Before Facebook is connected the server answers with an editable sample catalog (mode: 'sample'). */
import { money } from './ctwaApi'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api'

async function call(method, path, body, query) {
  const qs = query ? `?${new URLSearchParams(query)}` : ''
  const res = await fetch(`${API_BASE_URL}/whatsapp/catalog${path}${qs}`, {
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

export const catalog = {
  status:        ()                  => call('GET', '/status'),
  products:      (catalogId)         => call('GET', '/products', null, { catalog: catalogId }),
  create:        (catalogId, product) => call('POST', '/products', { catalog: catalogId, product }),
  update:        (catalogId, product) => call('PATCH', '/products', { catalog: catalogId, product }),
  remove:        (catalogId, id)     => call('DELETE', '/products', null, { catalog: catalogId, id }),
  importMany:    (catalogId, products) => call('POST', '/products/import', { catalog: catalogId, products }),
  createCatalog: (name)              => call('POST', '/catalogs', { name }),
  connectWhatsApp: (catalogId)       => call('POST', '/whatsapp', { catalog: catalogId }),
  setCommerce:   (phoneNumberId, patch) => call('POST', '/commerce', { phoneNumberId, ...patch }),
  send:          (payload)           => call('POST', '/send', payload),
}

/** 4999 → ₹4,999 · 1299.5 → ₹1,299.50 */
export const price = (n, currency = 'INR') => money(n, currency, Number.isInteger(n) ? 0 : 2)

/** Needs attention: Meta rejected the product, or is still reviewing it. */
export const REVIEW = {
  approved: ['Approved', 'bg-emerald-50 text-emerald-700', 'bg-emerald-500'],
  pending: ['In review', 'bg-amber-50 text-amber-700', 'bg-amber-500'],
  rejected: ['Rejected', 'bg-red-50 text-red-600', 'bg-red-500'],
  outdated: ['Outdated', 'bg-slate-100 text-slate-600', 'bg-slate-400'],
}
export const needsAttention = (p) => p.reviewStatus === 'rejected' || p.reviewStatus === 'pending' || p.reviewStatus === 'outdated'
