// ClientDrawer.jsx — one client in full: who they are, their plan and what it allows,
// payments, invoices and plan notes. Opens their dashboard or changes their plan.
import { useEffect, useRef, useState } from 'react'
import { Loader2, LogIn, FileText, AlertCircle, Printer } from 'lucide-react'
import { billingAdmin } from '../../lib/billingApi'
import Select from '../Select'
import {
  Modal, StatusPill, ErrorNote, fmtDate, fmtRel, rupees, num, btnPrimary, btnGhost, allowancesOf, CUSTOMER_TYPES, customerTypeLabel, PARTNER_TYPE,
} from './ui'

function Section({ title, children, note }) {
  return (
    <section className="px-5 py-4 border-b border-slate-100">
      <h3 className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2.5">{title}</h3>
      {children}
      {note && <p className="text-[11px] text-slate-400 mt-2">{note}</p>}
    </section>
  )
}
const Item = ({ k, v }) => (
  <div className="min-w-0">
    <dt className="text-[11px] text-slate-400">{k}</dt>
    <dd className="text-sm text-slate-800 break-words">{v || '—'}</dd>
  </div>
)

/* The printable invoice, shown here: it needs the admin token, so it can't be a plain link, and a
   pop-up window would be blocked. Sandboxed with no scripts; same-origin only so Print can reach it. */
function InvoiceViewer({ invoice, onClose }) {
  const frame = useRef(null)
  return (
    <Modal wide title={`Invoice ${invoice.number}`} onClose={onClose}
      subtitle={<button type="button" onClick={() => frame.current?.contentWindow?.print()} className="inline-flex items-center gap-1 font-semibold text-primary hover:underline"><Printer size={12}/> Print / save as PDF</button>}>
      {/* the page's own Print button needs scripts, which the sandbox blocks — the one above replaces it */}
      <iframe ref={frame} title={`Invoice ${invoice.number}`} srcDoc={invoice.html.replace('</head>', '<style>.actions{display:none}</style></head>')}
        sandbox="allow-same-origin allow-modals" className="w-full h-full border-0"/>
    </Modal>
  )
}

/* Direct / reseller / white label … and, for a partner's client, which partner. */
function CustomerType({ token, c, customers, canEdit, onSaved }) {
  const [type, setType] = useState(c.customerType)
  const [partner, setPartner] = useState(c.partner || '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const partnerType = PARTNER_TYPE[type]
  const partners = customers.filter((x) => x.customerType === partnerType && x.workspaceId !== c.workspaceId)
  const nameOf = (ws) => customers.find((x) => x.workspaceId === ws)?.customer || ws
  const theirClients = customers.filter((x) => x.partner === c.workspaceId)
  const dirty = type !== c.customerType || (partnerType ? partner : '') !== (c.partner || '')

  async function save() {
    setSaving(true); setError('')
    try {
      await billingAdmin.setCustomerType(token, { workspaceId: c.workspaceId, type, partner: partnerType ? partner || null : null })
      onSaved()
    } catch (e) { setError(e.message); setSaving(false) }
  }

  return (
    <Section title="Customer type">
      {canEdit ? (
        <div className="flex flex-wrap items-end gap-2">
          <div className="w-60">
            <Select size="sm" value={type} onChange={(v) => { setType(v); setPartner('') }} options={CUSTOMER_TYPES.map(([value, label]) => ({ value, label }))}/>
          </div>
          {partnerType && (
            <div className="w-60">
              <Select size="sm" value={partner} onChange={setPartner} placeholder={partners.length ? `Under which ${partnerType === 'reseller' ? 'reseller' : 'partner'}?` : `No ${partnerType === 'reseller' ? 'resellers' : 'white label partners'} yet`}
                disabled={!partners.length} options={partners.map((x) => ({ value: x.workspaceId, label: x.customer || x.workspaceId }))}/>
            </div>
          )}
          {dirty && <button type="button" onClick={save} disabled={saving} className={btnPrimary}>{saving && <Loader2 size={14} className="animate-spin"/>} Save</button>}
        </div>
      ) : (
        <p className="text-sm text-slate-800">{customerTypeLabel(c.customerType)}{c.partner && <span className="text-slate-500"> · under {nameOf(c.partner)}</span>}</p>
      )}
      {error && <div className="mt-2"><ErrorNote>{error}</ErrorNote></div>}
      {(c.customerType === 'reseller' || c.customerType === 'white_label') && (
        <p className="text-xs text-slate-500 mt-2">
          Their clients ({theirClients.length}){theirClients.length ? `: ${theirClients.map((x) => x.customer || x.workspaceId).join(', ')}` : ' — set a client\'s type to link it here.'}
        </p>
      )}
    </Section>
  )
}

export default function ClientDrawer({ token, workspaceId, customers, canEdit, onClose, onAssign, onLoginAs, onChanged }) {
  const [c, setC] = useState(null)
  const [error, setError] = useState('')
  const [invoice, setInvoice] = useState(null)

  useEffect(() => {
    let off = false
    setC(null); setError('')
    billingAdmin.customer(token, workspaceId).then((d) => !off && setC(d)).catch((e) => !off && setError(e.message))
    return () => { off = true }
  }, [token, workspaceId])

  async function openInvoice(i) {
    try { setInvoice({ number: i.number, html: await billingAdmin.invoiceHtml(token, workspaceId, i.id) }) } catch (e) { setError(e.message) }
  }

  const p = c?.profile
  return (
    <Modal side title={c?.customer || workspaceId} onClose={onClose}
      subtitle={c && <span className="inline-flex items-center gap-2"><StatusPill status={c.status}/> <span>Workspace {workspaceId}</span></span>}>
      {!c && !error && <div className="p-10 flex justify-center text-slate-400"><Loader2 className="animate-spin"/></div>}
      {error && <div className="p-5"><ErrorNote>{error}</ErrorNote></div>}
      {c && (
        <>
          <div className="px-5 py-3 border-b border-slate-100 flex flex-wrap gap-2">
            <button type="button" onClick={() => onLoginAs(c)} className={btnPrimary}><LogIn size={14}/> Log in as customer</button>
            {canEdit && <button type="button" onClick={() => onAssign(c)} className={btnGhost}>Change plan</button>}
          </div>

          {c.dunning && (
            <div className="mx-5 mt-4 flex gap-2 text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg p-3">
              <AlertCircle size={14} className="flex-shrink-0"/>
              <span>A renewal payment of {rupees(c.dunning.amountPaise / 100)} failed. Attempt {c.dunning.attempts} of {c.dunning.maxAttempts};
                {c.dunning.nextAttemptAt ? ` next try ${fmtDate(c.dunning.nextAttemptAt)};` : ''} suspended on {fmtDate(c.dunning.deadline)} if unpaid.</span>
            </div>
          )}

          <CustomerType token={token} c={c} customers={customers} canEdit={canEdit} onSaved={onChanged}/>

          <Section title="Contact & billing details">
            {p ? (
              <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3">
                <Item k="Company (legal name)" v={p.legalName}/>
                <Item k="Contact person" v={p.contactName}/>
                <Item k="Email" v={p.email && <a href={`mailto:${p.email}`} className="text-primary hover:underline">{p.email}</a>}/>
                <Item k="Phone" v={p.phone && <a href={`tel:+91${p.phone}`} className="text-primary hover:underline">+91 {p.phone}</a>}/>
                <Item k="GSTIN" v={p.gstin || 'Not registered'}/>
                <Item k="Address" v={[p.address.line1, p.address.line2, `${p.address.city}, ${c.state} ${p.address.pincode}`].filter(Boolean).join(', ')}/>
              </dl>
            ) : <p className="text-sm text-slate-500">They haven't added billing details yet.</p>}
          </Section>

          <Section title="Plan">
            {c.plan ? (
              <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3">
                <Item k="Plan" v={`${c.planName} · ${c.period}`}/>
                <Item k="How they pay" v={c.autopay ? `Autopay${c.card ? ` · ${c.card.network || 'Card'} •••• ${c.card.last4}` : ''}` : c.lastGrant && c.mode === 'once' && !c.paymentsCount ? 'Assigned by SmatBot' : 'Pay once (manual renewal)'}/>
                <Item k="Current period" v={`${fmtDate(c.currentStart)} → ${fmtDate(c.currentEnd)}`}/>
                <Item k={c.renewal?.type === 'autopay' ? 'Next charge' : 'Renewal due'} v={c.renewal && `${fmtDate(c.renewal.at)} (${fmtRel(c.renewal.at)}) · ${c.renewal.planName} ${c.renewal.period} · ${rupees(c.renewal.total)}`}/>
                {c.addons.length > 0 && <Item k="Add-ons with the plan" v={c.addons.map((a) => `${a.name}${a.qty > 1 ? ` × ${a.qty}` : ''}`).join(', ')}/>}
                {c.extraAddons.length > 0 && <Item k="One-time add-ons" v={`${c.extraAddons.length} running`}/>}
              </dl>
            ) : <p className="text-sm text-slate-500">No plan yet.</p>}
          </Section>

          {c.plan && (
            <Section title="Allowances" note="What their plan and add-ons include. Actual consumption isn't metered yet, so usage can't be shown.">
              <dl className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {allowancesOf(c).map((a) => (
                  <div key={a.label} className="rounded-lg border border-slate-100 bg-slate-50/60 px-3 py-2 min-w-0">
                    <dt className="text-[11px] text-slate-500 truncate" title={a.label}>{a.label}</dt>
                    <dd className="text-sm font-bold text-slate-800 tabular-nums">{typeof a.value === 'number' ? num(a.value) : a.value}</dd>
                    {(a.per || a.extra > 0) && <dd className="text-[10.5px] text-slate-400">{[a.per, a.extra > 0 && `incl. ${num(a.extra)} from add-ons`].filter(Boolean).join(' · ')}</dd>}
                  </div>
                ))}
              </dl>
            </Section>
          )}

          <Section title={`Payments (${c.payments.length}) · ${rupees(c.paidTotal)} collected`}>
            {c.payments.length ? (
              <div className="overflow-x-auto -mx-1">
                <table className="w-full text-xs min-w-[460px]">
                  <thead><tr className="text-left text-slate-400"><th className="px-1 py-1 font-semibold">Date</th><th className="px-1 py-1 font-semibold">For</th><th className="px-1 py-1 font-semibold">Method</th><th className="px-1 py-1 font-semibold text-right">Amount</th></tr></thead>
                  <tbody>
                    {c.payments.map((x) => (
                      <tr key={x.id} className="border-t border-slate-100">
                        <td className="px-1 py-1.5 whitespace-nowrap">{fmtDate(x.at)}</td>
                        <td className="px-1 py-1.5">{x.kind === 'addon' ? 'Add-ons (one-time)' : `${x.planName} · ${x.period}${x.kind === 'renewal' ? ' · renewal' : ''}`}{x.coupon && <span className="ml-1 text-emerald-700">({x.coupon})</span>}</td>
                        <td className="px-1 py-1.5 uppercase text-slate-500">{x.method || '—'}</td>
                        <td className="px-1 py-1.5 text-right tabular-nums font-semibold">{rupees(x.amountPaise / 100)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : <p className="text-sm text-slate-500">No payments yet.</p>}
          </Section>

          <Section title={`Invoices (${c.invoices.length})`}>
            {c.invoices.length ? (
              <ul className="divide-y divide-slate-100">
                {c.invoices.map((i) => (
                  <li key={i.id} className="flex items-center gap-3 py-1.5 text-xs">
                    <FileText size={13} className="text-slate-400 flex-shrink-0"/>
                    <span className="font-mono text-slate-700">{i.number}</span>
                    <span className="text-slate-400 flex-1">{fmtDate(i.at)}</span>
                    <span className="tabular-nums font-semibold">{rupees(i.amountPaise / 100)}</span>
                    <button type="button" onClick={() => openInvoice(i)} className="font-semibold text-primary hover:underline">Open</button>
                  </li>
                ))}
              </ul>
            ) : <p className="text-sm text-slate-500">No invoices yet.</p>}
          </Section>

          {c.grants.length > 0 && (
            <Section title="Plans assigned by SmatBot">
              <ul className="space-y-2">
                {c.grants.map((g) => (
                  <li key={g.at} className="text-xs text-slate-600">
                    <b className="text-slate-800">{g.plan} · {g.period}</b> until {fmtDate(g.until)} — {fmtDate(g.at)}{g.by ? ` by ${g.by}` : ''}
                    {g.note && <div className="text-slate-500">“{g.note}”</div>}
                  </li>
                ))}
              </ul>
            </Section>
          )}
        </>
      )}
      {invoice && <InvoiceViewer invoice={invoice} onClose={() => setInvoice(null)}/>}
    </Modal>
  )
}
