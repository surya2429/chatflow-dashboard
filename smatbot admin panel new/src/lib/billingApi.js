/* ─── Billing API client for the admin panel ───────────────────────────────
   Every call goes to /api/billing (backend/src/billing in the ChatFlow repo). Signing in returns a
   token that every admin call carries; the server checks it and the employee's role each time. */
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api'

/** Where customers' dashboards live — "log in as customer" opens it. */
export const DASHBOARD_URL = (import.meta.env.VITE_DASHBOARD_URL || 'http://localhost:5173').replace(/\/$/, '')

export class BillingError extends Error {
  constructor(code, message, status, fields) {
    super(message || code)
    this.code = code
    this.status = status
    this.fields = fields   // field-level problems from a 422, e.g. { email: '…' }
  }
}

async function call(method, path, body, headers) {
  let res
  try {
    res = await fetch(`${API_BASE_URL}/billing${path}`, {
      method,
      headers: { 'Content-Type': 'application/json', ...headers },
      body: body === undefined ? undefined : JSON.stringify(body),
    })
  } catch {
    throw new BillingError('unreachable', "Couldn't reach the billing service. Check that the server is running.")
  }
  const data = await res.json().catch(() => null)
  if (!res.ok) throw new BillingError(data?.error || 'request_failed', data?.message || `Request failed (${res.status})`, res.status, data?.fields)
  return data
}

export const billing = {
  config: () => call('GET', '/config'),
}

const as = (token) => ({ 'x-admin-token': token })
const wsPath = (ws) => `/admin/customers/${encodeURIComponent(ws)}`
export const billingAdmin = {
  login:        (email, password) => call('POST', '/admin/login', { email, password }),
  me:           (t)       => call('GET', '/admin/me', undefined, as(t)),
  customers:    (t)       => call('GET', '/admin/customers', undefined, as(t)),
  customer:     (t, ws)   => call('GET', wsPath(ws), undefined, as(t)),
  /** Revenue, clients, renewals and usage for the dashboard. */
  analytics:    (t)       => call('GET', '/admin/analytics', undefined, as(t)),
  /** A subscription: plan, add-ons, cycles, start date, discounts, client details and payment. */
  plan:         (t, body) => call('POST', '/admin/plan', body, as(t)),
  /** Its price line by line, before saving. */
  quote:        (t, body) => call('POST', '/admin/quote', body, as(t)),
  /** The full price list: every plan and add-on, private and archived ones too. */
  catalog:      (t)       => call('GET', '/admin/catalog', undefined, as(t)),
  setCustomerType: (t, body) => call('POST', '/admin/customers/type', body, as(t)),
  /** A 2-minute ticket the customer dashboard swaps for that customer (logged as "Opened customer dashboard"). */
  impersonate:  (t, ws)   => call('POST', '/admin/impersonate', { workspaceId: ws }, as(t)),
  coupons:      (t)       => call('GET', '/admin/coupons', undefined, as(t)),
  createCoupon: (t, body) => call('POST', '/admin/coupons', body, as(t)),
  updateCoupon: (t, body) => call('POST', '/admin/coupons/update', body, as(t)),
  staff:        (t)       => call('GET', '/admin/staff', undefined, as(t)),
  createStaff:  (t, body) => call('POST', '/admin/staff', body, as(t)),
  updateStaff:  (t, body) => call('POST', '/admin/staff/update', body, as(t)),
  /** The printable invoice page, as HTML (it needs the token, so it can't be a plain link). */
  async invoiceHtml(t, ws, id) {
    const res = await fetch(`${API_BASE_URL}/billing${wsPath(ws)}/invoices/${encodeURIComponent(id)}`, { headers: as(t) })
    if (!res.ok) throw new BillingError('invoice_unavailable', 'Could not load that invoice.', res.status)
    return res.text()
  },
}
