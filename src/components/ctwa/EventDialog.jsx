import { useState } from 'react'
import { Loader2, X, Send } from 'lucide-react'
import { ctwa } from '../../lib/ctwaApi'
import { Banner, Field, inputCls } from './ui'

export const EVENTS = [
  ['LeadSubmitted', 'Lead', 'They shared their details or showed clear interest.', true],
  ['QualifiedLead', 'Qualified lead', 'They fit your ideal customer and are worth following up.', true],
  ['Purchase', 'Purchase', 'They bought something. Needs the order value.', false],
  ['InitiateCheckout', 'Started checkout', 'They began paying or placing an order.', true],
  ['AddToCart', 'Added to cart', 'They picked something to buy.', true],
  ['ViewContent', 'Viewed a product', 'They looked at a product or page you sent.', true],
  ['CartAbandoned', 'Abandoned cart', 'They left before finishing the order.', true],
  ['OrderCreated', 'Order created', 'An order was placed in your system.', false],
  ['OrderShipped', 'Order shipped', 'The order is on its way.', false],
  ['OrderDelivered', 'Order delivered', 'The order arrived.', false],
  ['OrderCanceled', 'Order canceled', 'The order was canceled.', false],
  ['OrderReturned', 'Order returned', 'The order was returned.', false],
  ['RatingProvided', 'Rating given', 'They rated your service.', false],
  ['ReviewProvided', 'Review given', 'They left a review.', false],
]
export const eventLabel = (name) => EVENTS.find((e) => e[0] === name)?.[1] ?? name

/** Tell Meta what happened to a lead from an ad (Conversions API for Business Messaging). */
export default function EventDialog({ lead, currency = 'INR', initial = 'LeadSubmitted', onClose, onSent }) {
  const [name, setName] = useState(initial)
  const [value, setValue] = useState('')
  const [cur, setCur] = useState(currency)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [fields, setFields] = useState({})
  const meta = EVENTS.find((e) => e[0] === name)
  const sent = lead.events.some((e) => e.eventName === name && e.status !== 'failed')
  const onceOnly = meta[3]

  async function send() {
    setBusy(true); setError(''); setFields({})
    try {
      const r = await ctwa.sendEvent({ waId: lead.waId, eventName: name, value: value === '' ? null : Number(value), currency: value === '' ? null : cur })
      onSent(name, r.status)
      onClose()
    } catch (e) { setError(e.message); setFields(e.fields || {}) } finally { setBusy(false) }
  }

  return (
    <div className="fixed inset-0 z-[70] bg-slate-900/30 flex items-center justify-center p-4" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div role="dialog" aria-label="Send event to Meta" className="bg-white rounded-2xl w-full max-w-md shadow-modal overflow-hidden">
        <div className="flex items-start justify-between px-5 py-4 border-b border-surface-border">
          <div>
            <h3 className="font-bold text-slate-900 text-sm">Tell Meta what happened</h3>
            <p className="text-[11px] text-slate-500 mt-0.5">{lead.contactName || lead.waId} · from {lead.adName || lead.headline || 'a Click-to-WhatsApp ad'}</p>
          </div>
          <button onClick={onClose} aria-label="Close" className="p-1.5 rounded-lg hover:bg-surface-hover text-slate-400"><X size={15} /></button>
        </div>
        <div className="px-5 py-4 space-y-3.5">
          <Field label="Event" hint={meta[2]}>
            <select value={name} onChange={(e) => setName(e.target.value)} className={inputCls}>{EVENTS.map((e) => <option key={e[0]} value={e[0]}>{e[1]}</option>)}</select>
          </Field>
          <div className="grid grid-cols-[1fr_90px] gap-3">
            <Field label={name === 'Purchase' ? 'Order value' : 'Value (optional)'} error={fields.value}><input type="number" min="0" value={value} onChange={(e) => setValue(e.target.value)} placeholder="0" className={inputCls} /></Field>
            <Field label="Currency" error={fields.currency}><input value={cur} maxLength={3} onChange={(e) => setCur(e.target.value.toUpperCase())} className={inputCls} /></Field>
          </div>
          <p className="text-[10.5px] text-slate-400 leading-relaxed">Meta uses these results to show your ads to more people like the ones who convert, so send them when they are true.</p>
          {sent && onceOnly && <Banner tone="warn">“{meta[1]}” was already sent for this lead. Meta only accepts it once.</Banner>}
          {error && <Banner tone="error">{error}</Banner>}
        </div>
        <div className="flex justify-end gap-2 px-5 py-3.5 border-t border-surface-border bg-slate-50/60">
          <button onClick={onClose} className="btn-secondary text-xs">Cancel</button>
          <button onClick={send} disabled={busy || (sent && onceOnly)} className="btn-primary text-xs inline-flex items-center gap-1.5 disabled:opacity-50">
            {busy ? <Loader2 size={13} className="animate-spin" /> : <Send size={13} />} Send to Meta
          </button>
        </div>
      </div>
    </div>
  )
}
