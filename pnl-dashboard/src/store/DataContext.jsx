import { createContext, useContext, useEffect, useMemo, useRef, useState, useCallback } from 'react'
import { buildSeed } from '../data/seed'
import {
  EMAIL_EVENTS, MILESTONE_STATUS, milestoneLabel, quote, serviceById, formatWaybill,
} from '../lib/domain'

const KEY = 'pnl.dashboard.v1'
const DataCtx = createContext(null)

/** Everything the dashboard writes lands here, then in localStorage, so a demo survives a reload. */
function load() {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) {
      const parsed = JSON.parse(raw)
      if (parsed && parsed.orders && parsed.customers && parsed.branches) return parsed
    }
  } catch {
    /* corrupt or unavailable storage just falls through to a fresh seed */
  }
  return buildSeed()
}

const pad = (n, w) => String(n).padStart(w, '0')
const nowIso = () => new Date().toISOString()

export function DataProvider({ children }) {
  const [db, setDb] = useState(load)
  const [toasts, setToasts] = useState([])
  const toastSeq = useRef(0)

  useEffect(() => {
    try { localStorage.setItem(KEY, JSON.stringify(db)) } catch { /* quota or private mode */ }
  }, [db])

  const toast = useCallback((message, tone = 'success') => {
    const id = ++toastSeq.current
    setToasts((t) => [...t, { id, message, tone }])
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4200)
  }, [])
  const dismissToast = useCallback((id) => setToasts((t) => t.filter((x) => x.id !== id)), [])

  /* ── low-level helpers ─────────────────────────────────────────────────── */

  /**
   * Hands the mutator a deep clone to edit in place. Mutators return nothing (and may
   * bail out early), so the clone itself is what becomes the next state.
   */
  const patch = useCallback((fn) => setDb((d) => {
    const next = structuredClone(d)
    const replaced = fn(next)
    return replaced || next
  }), [])

  const pushActivity = (d, entry) => {
    d.activity.unshift({ id: 'ACT-' + pad(d.activity.length + 1, 5), at: nowIso(), kind: 'admin', ...entry })
  }

  /**
   * Queues one of the automated emails from the brief. Respects the per-event toggle in
   * Settings, which is how an administrator turns a notification stream off.
   */
  const sendEmail = (d, type, customerId, meta = {}) => {
    if (!d.settings.emailToggles[type]) return false
    const c = d.customers.find((x) => x.id === customerId)
    if (!c) return false
    d.emails.unshift({
      id: 'EML-' + pad(d.emails.length + 1, 5),
      type, to: c.email, customerId, at: nowIso(), status: 'delivered', meta,
    })
    return true
  }

  /** The order id and the tracking number are one and the same, issued here. */
  const nextWaybill = (d) => {
    d.waybillSeq = (d.waybillSeq || 104000) + 1
    return formatWaybill(d.waybillSeq, d.settings.waybillPrefix || 'PNL')
  }

  const buildOrder = (d, input, actor, placedBy) => {
    const q = quote(input)
    const svc = serviceById(input.serviceId)
    const id = nextWaybill(d)
    return {
      id,
      customerId: input.customerId,
      serviceId: input.serviceId,
      status: 'requested',
      createdAt: nowIso(),
      updatedAt: nowIso(),
      placedBy,
      origin: input.origin,
      destination: input.destination,
      receiver: input.receiver,
      pieces: Number(input.pieces) || 1,
      quantity: Number(input.quantity) || 0,
      contents: input.contents || '',
      declaredValue: Number(input.declaredValue) || 0,
      insured: !!input.insured,
      paymentMode: input.paymentMode || 'Pay on collection',
      amount: Math.round(q.total * 100) / 100,
      etaAt: new Date(Date.now() + svc.eta * 864e5).toISOString(),
      deliveredAt: null,
      pod: null,
      documents: [],
      notes: input.notes || '',
      milestones: [{
        id: 'MS-' + id + '-01', code: 'order_placed', at: nowIso(),
        location: input.origin.city + ', ' + input.origin.country,
        hub: input.origin.hub || '', note: '', by: actor,
      }],
    }
  }

  const api = useMemo(() => ({
    /* ── customers ───────────────────────────────────────────────────────── */
    addCustomer: (input, actor) => {
      let created
      patch((d) => {
        const n = d.customers.length + 1
        created = {
          id: 'CUS-' + pad(1000 + n, 4),
          status: 'active', verified: true, registeredAt: nowIso(), notes: '', password: 'customer',
          accountType: input.company ? 'business' : 'individual',
          ...input,
        }
        d.customers.unshift(created)
        pushActivity(d, { customerId: created.id, actor, action: 'Created customer ' + created.name, kind: 'account' })
        sendEmail(d, 'customer_registration', created.id)
      })
      toast('Customer created — welcome email sent')
      return created
    },

    updateCustomer: (id, changes, actor) => {
      patch((d) => {
        const c = d.customers.find((x) => x.id === id)
        if (!c) return
        Object.assign(c, changes)
        pushActivity(d, { customerId: id, actor, action: 'Updated customer profile', kind: 'account' })
      })
      toast('Customer profile updated')
    },

    setCustomerStatus: (id, status, actor) => {
      patch((d) => {
        const c = d.customers.find((x) => x.id === id)
        if (!c) return
        c.status = status
        if (status === 'active') c.verified = true
        pushActivity(d, {
          customerId: id, actor, kind: 'account',
          action: status === 'active' ? 'Approved registration' : status === 'suspended' ? 'Suspended account' : 'Set account to ' + status,
        })
        if (status === 'active') sendEmail(d, 'customer_registration', id)
      })
      toast(status === 'active' ? 'Registration approved' : 'Account ' + status)
    },

    /* ── orders ──────────────────────────────────────────────────────────── */

    /**
     * Raises an order request. The shipment number is issued immediately and is the same
     * number the customer tracks with — there is no second identifier to reconcile.
     */
    createOrder: (input, actor, placedBy = 'staff') => {
      let created
      patch((d) => {
        created = buildOrder(d, input, actor, placedBy)
        d.orders.unshift(created)
        pushActivity(d, {
          customerId: input.customerId, actor, orderId: created.id, kind: 'order',
          action: 'Raised order request ' + created.id,
        })
      })
      toast('Order request ' + (created ? created.id : '') + ' raised — awaiting confirmation')
      return created
    },

    updateOrder: (id, changes, actor) => {
      patch((d) => {
        const o = d.orders.find((x) => x.id === id)
        if (!o) return
        Object.assign(o, changes)
        if (changes.serviceId || changes.quantity || changes.pieces || changes.insured !== undefined) {
          o.amount = Math.round(quote(o).total * 100) / 100
        }
        o.updatedAt = nowIso()
        pushActivity(d, { customerId: o.customerId, actor, orderId: id, kind: 'order', action: 'Updated order ' + id })
      })
      toast('Order updated')
    },

    /** Accepts a customer's request: the booking is confirmed and the customer is emailed. */
    confirmOrder: (id, actor) => {
      patch((d) => {
        const o = d.orders.find((x) => x.id === id)
        if (!o || o.status !== 'requested') return
        o.status = 'confirmed'
        o.updatedAt = nowIso()
        o.milestones.push({
          id: 'MS-' + id + '-' + pad(o.milestones.length + 1, 2), code: 'order_confirmed',
          at: nowIso(), location: o.origin.city + ', ' + o.origin.country, hub: o.origin.hub, note: '', by: actor,
        })
        pushActivity(d, { customerId: o.customerId, actor, orderId: id, kind: 'shipment', action: 'Confirmed booking ' + id })
        sendEmail(d, 'shipment_creation', o.customerId, { waybill: id, orderId: id })
      })
      toast('Booking confirmed — customer notified')
    },

    rejectOrder: (id, reason, actor) => {
      patch((d) => {
        const o = d.orders.find((x) => x.id === id)
        if (!o) return
        o.status = 'rejected'
        o.updatedAt = nowIso()
        o.milestones.push({
          id: 'MS-' + id + '-' + pad(o.milestones.length + 1, 2), code: 'rejected', at: nowIso(),
          location: o.origin.city + ', ' + o.origin.country, hub: o.origin.hub, note: reason || '', by: actor,
        })
        pushActivity(d, { customerId: o.customerId, actor, orderId: id, kind: 'order', action: 'Rejected request ' + id + (reason ? ' — ' + reason : '') })
        sendEmail(d, 'shipment_update', o.customerId, { waybill: id, orderId: id })
      })
      toast('Request rejected — customer notified', 'warn')
    },

    /**
     * The one entry point for moving a shipment along: logs the milestone, moves the order
     * status with it, records proof of delivery on the final hop and emails the customer.
     */
    addMilestone: (id, { code, location, hub, note, pod }, actor) => {
      patch((d) => {
        const o = d.orders.find((x) => x.id === id)
        if (!o) return
        const at = nowIso()
        o.milestones.push({
          id: 'MS-' + id + '-' + pad(o.milestones.length + 1, 2),
          code, at, location: location || o.destination.city + ', ' + o.destination.country,
          hub: hub || '', note: note || '', by: actor,
        })
        const next = MILESTONE_STATUS[code]
        if (next) o.status = next
        o.updatedAt = at
        if (code === 'delivered') {
          o.deliveredAt = at
          o.pod = { signedBy: (pod && pod.signedBy) || 'Recipient', signatureAt: at, photo: !!(pod && pod.photo), note: (pod && pod.note) || '' }
          sendEmail(d, 'delivery_confirmation', o.customerId, { waybill: id, orderId: id })
        } else {
          sendEmail(d, 'shipment_update', o.customerId, { waybill: id, orderId: id })
        }
        pushActivity(d, {
          customerId: o.customerId, actor, orderId: id, kind: 'shipment',
          action: milestoneLabel(code) + ' — ' + (location || o.destination.city),
        })
      })
      toast(milestoneLabel(code) + ' logged — customer notified')
    },

    cancelOrder: (id, reason, actor) => {
      patch((d) => {
        const o = d.orders.find((x) => x.id === id)
        if (!o) return
        o.status = 'cancelled'
        o.updatedAt = nowIso()
        o.milestones.push({
          id: 'MS-' + id + '-' + pad(o.milestones.length + 1, 2), code: 'cancelled', at: nowIso(),
          location: o.origin.city + ', ' + o.origin.country, hub: o.origin.hub, note: reason || '', by: actor,
        })
        const inv = d.invoices.find((x) => x.orderId === id)
        if (inv && inv.status !== 'paid') inv.status = 'void'
        pushActivity(d, { customerId: o.customerId, actor, orderId: id, kind: 'shipment', action: 'Cancelled order ' + id + (reason ? ' — ' + reason : '') })
        sendEmail(d, 'shipment_update', o.customerId, { waybill: id, orderId: id })
      })
      toast('Order cancelled', 'warn')
    },

    /* ── quotation requests ──────────────────────────────────────────────── */
    addQuoteRequest: (input, actor) => {
      let created
      patch((d) => {
        created = {
          id: 'QT-' + pad(1000 + d.quotes.length + 1, 4),
          status: 'new', at: nowIso(), quotedAmount: null, quotedAt: null, quotedBy: null,
          validUntil: null, note: '', orderId: null,
          ...input,
        }
        d.quotes.unshift(created)
        pushActivity(d, { customerId: input.customerId, actor, kind: 'quote', action: 'Raised quotation request ' + created.id })
        if (input.customerId) sendEmail(d, 'quote_request', input.customerId)
      })
      toast('Quotation request raised')
      return created
    },

    /** Prices a quotation and emails it out, valid for 30 days. */
    sendQuote: (id, amount, note, actor) => {
      patch((d) => {
        const q = d.quotes.find((x) => x.id === id)
        if (!q) return
        q.status = 'quoted'
        q.quotedAmount = Math.round(Number(amount) * 100) / 100
        q.quotedAt = nowIso()
        q.quotedBy = actor
        q.validUntil = new Date(Date.now() + 30 * 864e5).toISOString()
        q.note = note || ''
        pushActivity(d, { customerId: q.customerId, actor, kind: 'quote', action: 'Quoted ' + id })
        if (q.customerId) sendEmail(d, 'quote_request', q.customerId)
      })
      toast('Quote sent to the customer')
    },

    setQuoteStatus: (id, status, actor) => {
      patch((d) => {
        const q = d.quotes.find((x) => x.id === id)
        if (!q) return
        q.status = status
        pushActivity(d, { customerId: q.customerId, actor, kind: 'quote', action: 'Quotation ' + id + ' marked ' + status })
      })
      toast('Quotation marked ' + status)
    },

    /** Turns an accepted quotation into a live order request at the quoted price. */
    convertQuoteToOrder: (id, actor) => {
      let created
      patch((d) => {
        const q = d.quotes.find((x) => x.id === id)
        if (!q || q.orderId) return
        created = buildOrder(d, {
          customerId: q.customerId,
          serviceId: q.serviceId,
          origin: { ...q.origin, address: '' },
          destination: { ...q.destination, address: '' },
          receiver: { name: '', phone: '' },
          pieces: q.pieces,
          quantity: q.quantity,
          contents: '',
          declaredValue: 0,
          insured: false,
          paymentMode: 'Account (invoiced)',
          notes: 'Converted from quotation ' + q.id,
        }, actor, 'staff')
        if (q.quotedAmount) created.amount = q.quotedAmount
        d.orders.unshift(created)
        q.orderId = created.id
        q.status = 'accepted'
        pushActivity(d, { customerId: q.customerId, actor, orderId: created.id, kind: 'order', action: 'Converted quotation ' + id + ' into order ' + created.id })
      })
      toast('Quotation converted into an order request')
      return created
    },

    /* ── invoices ────────────────────────────────────────────────────────── */
    createInvoice: (orderId, actor) => {
      let inv
      patch((d) => {
        const o = d.orders.find((x) => x.id === orderId)
        if (!o) return
        const q = quote(o)
        const seq = (d.invoiceSeq = (d.invoiceSeq || 1) + 1)
        inv = {
          id: 'INV-2026-' + pad(seq, 4), orderId, customerId: o.customerId,
          issuedAt: nowIso(), dueAt: new Date(Date.now() + 14 * 864e5).toISOString(),
          status: 'draft',
          lines: q.lines.map((l) => ({ ...l, amount: Math.round(l.amount * 100) / 100 })),
          subtotal: Math.round(q.subtotal * 100) / 100,
          vat: Math.round(q.vat * 100) / 100,
          total: Math.round(q.total * 100) / 100,
          paidAt: null,
        }
        d.invoices.unshift(inv)
        pushActivity(d, { customerId: o.customerId, actor, orderId, kind: 'invoice', action: 'Generated invoice ' + inv.id })
      })
      toast('Invoice generated')
      return inv
    },

    setInvoiceStatus: (id, status, actor) => {
      patch((d) => {
        const inv = d.invoices.find((x) => x.id === id)
        if (!inv) return
        inv.status = status
        inv.paidAt = status === 'paid' ? nowIso() : null
        pushActivity(d, { customerId: inv.customerId, actor, orderId: inv.orderId, kind: 'invoice', action: 'Invoice ' + id + ' marked ' + status })
        if (status === 'sent') sendEmail(d, 'invoice_issued', inv.customerId, { invoice: id, orderId: inv.orderId })
      })
      toast('Invoice marked ' + status)
    },

    /* ── branches (Super Administrator) ──────────────────────────────────── */
    saveBranch: (branch, actor) => {
      patch((d) => {
        const idx = d.branches.findIndex((b) => b.id === branch.id)
        if (idx >= 0) d.branches[idx] = { ...d.branches[idx], ...branch }
        else d.branches.push({ ...branch, id: 'BRN-' + pad(d.branches.length + 1, 3), openedAt: branch.openedAt || nowIso() })
        pushActivity(d, { actor, kind: 'branch', action: (idx >= 0 ? 'Updated ' : 'Opened ') + 'branch ' + branch.name })
      })
      toast('Branch saved')
    },

    deleteBranch: (id, actor) => {
      patch((d) => {
        const b = d.branches.find((x) => x.id === id)
        d.branches = d.branches.filter((x) => x.id !== id)
        pushActivity(d, { actor, kind: 'branch', action: 'Closed branch ' + (b ? b.name : id) })
      })
      toast('Branch removed', 'warn')
    },

    /* ── content ─────────────────────────────────────────────────────────── */
    saveContent: (bucket, item, actor) => {
      patch((d) => {
        const list = d.content[bucket]
        const idx = list.findIndex((x) => x.id === item.id)
        const stamped = { ...item, updatedAt: nowIso(), updatedBy: actor }
        if (idx >= 0) list[idx] = stamped
        else list.unshift({ ...stamped, id: bucket.slice(0, 3).toUpperCase() + '-' + (list.length + 1) })
        pushActivity(d, { actor, kind: 'content', action: (idx >= 0 ? 'Updated ' : 'Created ') + (item.title || item.question || item.name) })
      })
      toast('Content saved')
    },

    deleteContent: (bucket, id, actor) => {
      patch((d) => {
        const list = d.content[bucket]
        const item = list.find((x) => x.id === id)
        d.content[bucket] = list.filter((x) => x.id !== id)
        pushActivity(d, { actor, kind: 'content', action: 'Deleted ' + (item ? item.title || item.question || item.name : id) })
      })
      toast('Deleted', 'warn')
    },

    uploadDocument: (doc, actor) => {
      patch((d) => {
        d.content.documents.unshift({
          id: 'FIL-' + (d.content.documents.length + 1),
          uploadedAt: nowIso(), uploadedBy: actor, public: true, ...doc,
        })
        pushActivity(d, { actor, kind: 'content', action: 'Uploaded ' + doc.name })
      })
      toast('Document uploaded')
    },

    /* ── users & permissions (Super Administrator) ───────────────────────── */
    saveUser: (user, actor) => {
      patch((d) => {
        const idx = d.users.findIndex((x) => x.id === user.id)
        if (idx >= 0) d.users[idx] = { ...d.users[idx], ...user }
        else d.users.push({ ...user, id: 'USR-' + pad(d.users.length + 1, 3), createdAt: nowIso(), lastLogin: null, password: 'admin' })
        pushActivity(d, { actor, kind: 'user', action: (idx >= 0 ? 'Updated ' : 'Created ') + 'user ' + user.name })
      })
      toast('User saved')
    },

    deleteUser: (id, actor) => {
      patch((d) => {
        const u = d.users.find((x) => x.id === id)
        d.users = d.users.filter((x) => x.id !== id)
        pushActivity(d, { actor, kind: 'user', action: 'Removed user ' + (u ? u.name : id) })
      })
      toast('User removed', 'warn')
    },

    /* ── enquiries ───────────────────────────────────────────────────────── */
    setEnquiryStatus: (id, status, actor) => {
      patch((d) => {
        const e = d.enquiries.find((x) => x.id === id)
        if (!e) return
        e.status = status
        pushActivity(d, { actor, kind: 'enquiry', action: 'Marked enquiry ' + id + ' as ' + status })
      })
      toast('Enquiry marked ' + status)
    },

    /* ── configuration ───────────────────────────────────────────────────── */
    updateSettings: (changes) => {
      patch((d) => { d.settings = { ...d.settings, ...changes } })
      toast('Settings saved')
    },
    updateChatbot: (changes) => {
      patch((d) => { d.chatbot = { ...d.chatbot, ...changes } })
      toast('Chatbot configuration saved')
    },

    resetData: () => {
      setDb(buildSeed())
      toast('Demo data reset to the original seed')
    },
  }), [patch, toast])

  const value = useMemo(() => ({ db, ...api, toast, toasts, dismissToast }), [db, api, toast, toasts, dismissToast])
  return <DataCtx.Provider value={value}>{children}</DataCtx.Provider>
}

export const useData = () => {
  const ctx = useContext(DataCtx)
  if (!ctx) throw new Error('useData must be used inside <DataProvider>')
  return ctx
}

export { EMAIL_EVENTS }
