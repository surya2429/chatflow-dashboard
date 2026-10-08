/* ─── Billing client ──────────────────────────────────────────────────────
   Talks to /api/billing (backend/src/billing — or the Vite dev stand-in) and
   opens Razorpay Checkout. Amounts are never sent from here: the server prices
   everything, the browser only names a plan and a billing period. The Razorpay
   key SECRET never exists in this bundle; only the public key id comes back from
   GET /config. */
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api'

export class BillingError extends Error {
  constructor(code, message, status, fields) {
    super(message || code)
    this.code = code
    this.status = status
    this.fields = fields   // field-level problems from a 422, e.g. { email: '…' }
  }
}

async function call(method, path, body) {
  let res
  try {
    res = await fetch(`${API_BASE_URL}/billing${path}`, {
      method,
      headers: { 'Content-Type': 'application/json' },
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
  config:       ()     => call('GET', '/config'),
  subscription: ()     => call('GET', '/subscription'),
  invoices:     ()     => call('GET', '/invoices'),
  profile:      ()     => call('GET', '/profile'),
  saveProfile:  (body) => call('PUT', '/profile', body),
  quote:        (body) => call('POST', '/quote', body),
  checkout:     (body) => call('POST', '/checkout', body),
  verify:       (body) => call('POST', '/verify', body),
  changePlan:   (body) => call('POST', '/change-plan', body),
  setAutopay:   (enabled) => call('POST', '/autopay', { enabled }),
}

/* ── Razorpay Checkout ─────────────────────────────────────────────────── */
const CHECKOUT_SRC = 'https://checkout.razorpay.com/v1/checkout.js'
let loading = null

export function loadCheckout() {
  if (window.Razorpay) return Promise.resolve()
  if (loading) return loading
  loading = new Promise((resolve, reject) => {
    const s = document.createElement('script')
    s.src = CHECKOUT_SRC
    s.async = true
    s.onload = () => resolve()
    s.onerror = () => { loading = null; reject(new BillingError('checkout_unavailable', "Couldn't load Razorpay Checkout. Check your connection and try again.")) }
    document.head.appendChild(s)
  })
  return loading
}

/** Opens Checkout for a session returned by billing.checkout().
    Resolves with Razorpay's signed response; rejects if the customer closes it. */
export async function payWithRazorpay(session, prefill = {}) {
  await loadCheckout()
  return new Promise((resolve, reject) => {
    let lastFailure = null
    const options = {
      key: session.keyId,
      name: 'SmatBot',
      description: session.description,
      prefill,
      theme: { color: '#0066ff' },
      modal: {
        ondismiss: () => reject(new BillingError(
          lastFailure ? 'payment_failed' : 'dismissed',
          lastFailure || 'Checkout was closed before the payment finished.',
        )),
      },
      handler: (response) => resolve(response),
    }
    if (session.orderId) {
      options.order_id = session.orderId
      options.amount = session.amount
      options.currency = session.currency
      // Saved-card autopay: Checkout asks the customer to save the card for recurring charges (RBI).
      if (session.engine === 'token') {
        options.customer_id = session.customerId
        options.recurring = true
      }
    } else {
      options.subscription_id = session.subscriptionId
    }
    const rzp = new window.Razorpay(options)
    // Checkout lets the customer retry inside the same window, so a failure isn't
    // final — remember it in case they give up.
    rzp.on('payment.failed', (r) => { lastFailure = r?.error?.description || 'The payment failed.' })
    rzp.open()
  })
}
