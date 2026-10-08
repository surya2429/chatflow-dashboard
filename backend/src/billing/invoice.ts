// invoice.ts — the GST tax invoice issued automatically for every successful payment.
//
// India's rules for a tax invoice (CGST Rules, rule 46) need, among other things: a
// unique consecutive serial number, date, the supplier's name / address / GSTIN, the
// recipient's name / address / GSTIN (if registered), a description with SAC code,
// the taxable value, tax split by rate (CGST+SGST within the state, IGST between
// states) and the place of supply. This file builds that and renders it as a printable
// page ("Print → Save as PDF").
//
// It is NOT legal advice: the supplier details and SAC code below come from
// configuration and must be confirmed with your CA before relying on these invoices.
import { PLAN_CATALOG, chargeFor, type Period, type PlanId } from './catalog.js'
import { stateName, type BillingProfile } from './india.js'
import type { Invoice } from './types.js'

export interface SellerInfo {
  /** registered legal name */
  name: string
  /** product / trade name shown beside it */
  brand?: string
  /** Corporate Identity Number */
  cin?: string
  address: string
  gstin?: string
  stateCode: string
  emails?: string[]
  phone?: string
  /** data: URI or URL of the logo printed in the invoice header */
  logo?: string
  /** printed at the bottom of every invoice */
  notes?: string[]
  /** Services Accounting Code printed on the invoice */
  sac: string
  /** prefix for invoice numbers, e.g. SB → SB/2026-27/000001 */
  prefix: string
}

/** Indian financial year (Apr–Mar) for a unix-seconds time, e.g. "2026-27". */
export function financialYear(unixSeconds: number): string {
  const ist = new Date(unixSeconds * 1000 + 5.5 * 3600 * 1000)
  const y = ist.getUTCFullYear()
  const start = ist.getUTCMonth() >= 3 ? y : y - 1
  return `${start}-${String(start + 1).slice(2)}`
}

export const invoiceNumber = (prefix: string, fy: string, seq: number) => `${prefix}/${fy}/${String(seq).padStart(6, '0')}`
export const invoiceId = (number: string) => number.replace(/\//g, '-')

export interface BuildInvoiceInput {
  seller: SellerInfo
  buyer: BillingProfile
  number: string
  issuedAt: number
  paymentId: string
  orderId?: string
  subscriptionId?: string
  plan: PlanId
  period: Period
  periodStart: number
  periodEnd: number
  gstPercent: number
  /** what was actually paid, in paise — wins over today's catalog price if they differ */
  amountPaise?: number
  method?: string
  kind: Invoice['kind']
}

const num = (n: number) => n.toLocaleString('en-IN')

/* What the plan's message allowance is — printed as a note, specific to this invoice. */
export function allowanceNote(plan: PlanId, period: Period): string {
  const p = PLAN_CATALOG[plan]
  const k = period === 'yearly' ? 12 : 1
  const when = period === 'yearly' ? 'for the year, credited upfront as one pool' : 'per month'
  return `Included in the ${p.name} plan: ${num(p.serviceMsgs * k)} WhatsApp service messages and ${num(p.biMsgs * k)} WhatsApp BI messages ${when}; Website and Instagram messages are unlimited.`
}

export function buildInvoice(i: BuildInvoiceInput): Invoice {
  const c = chargeFor(i.plan, i.period, i.gstPercent, { supplier: i.seller.stateCode, customer: i.buyer.address.stateCode })
  const taxKind = c.tax.kind === 'intra' ? 'intra' : 'inter'
  // If the price has changed since this was paid, the invoice must show what was actually charged.
  if (i.amountPaise && i.amountPaise !== c.totalPaise) {
    const total = i.amountPaise / 100
    const base = Math.round((total / (1 + i.gstPercent / 100)) * 100) / 100
    const gst = Math.round((total - base) * 100) / 100
    const half = Math.round((gst * 100) / 2) / 100
    Object.assign(c, { base, gst, total, totalPaise: i.amountPaise, tax: taxKind === 'intra' ? { kind: 'intra', cgst: half, sgst: Math.round((gst - half) * 100) / 100, igst: 0 } : { kind: 'inter', cgst: 0, sgst: 0, igst: gst } })
  }
  return {
    id: invoiceId(i.number),
    number: i.number,
    issuedAt: i.issuedAt,
    paymentId: i.paymentId,
    orderId: i.orderId,
    subscriptionId: i.subscriptionId,
    plan: i.plan,
    period: i.period,
    periodStart: i.periodStart,
    periodEnd: i.periodEnd,
    description: `SmatBot ${PLAN_CATALOG[i.plan].name} Plan — ${i.period === 'monthly' ? 'Monthly' : 'Yearly'} subscription`,
    qty: 1,
    rate: c.base,
    sac: i.seller.sac,
    seller: { name: i.seller.name, brand: i.seller.brand, cin: i.seller.cin, address: i.seller.address, gstin: i.seller.gstin, stateCode: i.seller.stateCode },
    buyer: structuredClone(i.buyer),
    placeOfSupplyCode: i.buyer.address.stateCode,
    taxable: c.base,
    gstPercent: i.gstPercent,
    taxKind,
    cgst: c.tax.cgst,
    sgst: c.tax.sgst,
    igst: c.tax.igst,
    total: c.total,
    amountPaise: c.totalPaise,
    method: i.method,
    kind: i.kind,
  }
}

/* ── printable page ───────────────────────────────────────────────────── */
const esc = (v: unknown) => String(v ?? '').replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]!))
const inr = (n: number) => '₹' + n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const day = (s: number) => new Date(s * 1000).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'Asia/Kolkata' })
const methodText = (m?: string) => (m ? m.toUpperCase() : 'Online')

export function renderInvoiceHtml(inv: Invoice, seller?: Partial<SellerInfo>): string {
  const b = inv.buyer
  const addr = [b.address.line1, b.address.line2, `${b.address.city}, ${stateName(b.address.stateCode)} ${b.address.pincode}`, 'India'].filter(Boolean).map(esc).join('<br>')
  const half = inv.gstPercent / 2
  const qty = inv.qty ?? 1
  const rate = inv.rate ?? inv.taxable / qty
  const unit = inv.period === 'yearly' ? 'year' : 'month'
  const s = inv.seller
  const logo = seller?.logo
  const emails = seller?.emails ?? []
  const notes = seller?.notes ?? []
  const contact = [emails.length ? `Email: ${emails.map(esc).join(' or ')}` : '', seller?.phone ? `Phone: ${esc(seller.phone)}` : ''].filter(Boolean).join(' &nbsp;·&nbsp; ')
  const allNotes = [...notes, allowanceNote(inv.plan, inv.period)]
  const taxRows = inv.taxKind === 'intra'
    ? `<tr><td>CGST @ ${half}%</td><td class="r">${inr(inv.cgst)}</td></tr><tr><td>SGST @ ${half}%</td><td class="r">${inr(inv.sgst)}</td></tr>`
    : `<tr><td>IGST @ ${inv.gstPercent}%</td><td class="r">${inr(inv.igst)}</td></tr>`
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Tax Invoice ${esc(inv.number)}</title>
<style>
  *{box-sizing:border-box}body{font:14px/1.5 Inter,system-ui,-apple-system,"Segoe UI",sans-serif;color:#0f172a;background:#f1f5f9;margin:0;padding:24px}
  .sheet{max-width:820px;margin:0 auto;background:#fff;border:1px solid #e2e8f0;border-radius:12px;padding:36px}
  .top{display:flex;justify-content:space-between;gap:24px;flex-wrap:wrap}
  h1{font-size:22px;margin:0 0 4px;letter-spacing:-.3px}.muted{color:#64748b}.small{font-size:12px}
  .badge{display:inline-block;font-size:11px;font-weight:700;color:#15803d;background:#f0fdf4;border:1px solid #bbf7d0;border-radius:999px;padding:2px 10px}
  .grid{display:grid;grid-template-columns:1fr 1fr;gap:24px;margin:24px 0}.box h3{font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:#64748b;margin:0 0 6px}
  .items{overflow-x:auto}.items table{min-width:560px}table.lines th,table.lines td{padding-right:12px}table.lines th:last-child,table.lines td:last-child{padding-right:0}td.n,th.n{white-space:nowrap}
  @media (max-width:640px){.grid{grid-template-columns:1fr}}
  table{width:100%;border-collapse:collapse;margin-top:8px}th{font-size:11px;text-transform:uppercase;letter-spacing:.06em;color:#64748b;text-align:left;padding:8px 0;border-bottom:1px solid #e2e8f0}
  td{padding:9px 0;border-bottom:1px solid #f1f5f9;vertical-align:top}.r{text-align:right;white-space:nowrap}
  .totals{margin-left:auto;width:min(340px,100%);margin-top:12px}.totals td{border:0;padding:4px 0}.grand td{border-top:2px solid #0f172a;font-weight:800;font-size:16px;padding-top:10px}
  .logo{display:block;height:48px;width:auto;margin:0 0 14px}.notes{margin-top:22px;padding:12px 14px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px}.notes ol{margin:4px 0 0;padding-left:18px}.notes li{margin-bottom:3px}
  .foot{margin-top:28px;padding-top:16px;border-top:1px solid #e2e8f0}.actions{max-width:820px;margin:0 auto 12px;display:flex;justify-content:flex-end}
  button{font:inherit;font-weight:600;padding:8px 16px;border-radius:8px;border:1px solid #cbd5e1;background:#fff;cursor:pointer}button:hover{background:#f8fafc}
  @media print{body{background:#fff;padding:0}.sheet{border:0;border-radius:0;padding:0}.actions{display:none}}
</style></head><body>
<div class="actions"><button onclick="window.print()">Download / Print PDF</button></div>
<div class="sheet">
  <div class="top">
    <div>${logo ? `<img class="logo" src="${esc(logo)}" alt="${esc(s.brand ?? s.name)}">` : ''}<h1>Tax Invoice</h1><div class="muted">${esc(inv.number)}</div></div>
    <div style="text-align:right"><span class="badge">PAID</span><div class="small muted" style="margin-top:6px">Invoice date: <b>${day(inv.issuedAt)}</b></div>
    <div class="small muted">Payment ID: ${esc(inv.paymentId)}</div></div>
  </div>
  <div class="grid">
    <div class="box"><h3>Supplier</h3><b>${esc(s.name)}</b>${s.brand ? `<br>Product: <b>${esc(s.brand)}</b>` : ''}<br>${esc(s.address).replace(/\n/g, '<br>')}<br>
      ${s.cin ? `CIN: ${esc(s.cin)}<br>` : ''}${s.gstin ? `GSTIN: ${esc(s.gstin)}<br>` : ''}State: ${esc(stateName(s.stateCode))} (${esc(s.stateCode)})</div>
    <div class="box"><h3>Billed to</h3><b>${esc(b.legalName)}</b><br>${addr}<br>${b.gstin ? `GSTIN: ${esc(b.gstin)}<br>` : 'GSTIN: Unregistered<br>'}
      ${esc(b.email)} · +91 ${esc(b.phone)}<br><span class="small muted">Place of supply: ${esc(stateName(inv.placeOfSupplyCode))} (${esc(inv.placeOfSupplyCode)})</span></div>
  </div>
  <div class="items"><table class="lines">
    <thead><tr><th>#</th><th>Description</th><th class="n">SAC</th><th class="r">Qty</th><th class="r">Rate</th><th class="r">Taxable value</th></tr></thead>
    <tbody><tr><td>1</td><td><b>${esc(inv.description)}</b><div class="small muted" style="margin-top:4px">Plan start date: <b>${day(inv.periodStart)}</b></div><div class="small muted">Plan end date: <b>${day(inv.periodEnd)}</b></div></td><td class="n">${esc(inv.sac)}</td><td class="r">${qty} ${unit}</td><td class="r">${inr(rate)}</td><td class="r">${inr(inv.taxable)}</td></tr></tbody>
  </table></div>
  <table class="totals"><tbody>
    <tr><td>Taxable value</td><td class="r">${inr(inv.taxable)}</td></tr>${taxRows}
    <tr class="grand"><td>Total (incl. GST)</td><td class="r">${inr(inv.total)}</td></tr>
  </tbody></table>
  <div class="notes small"><b>Notes</b><ol>${allNotes.map((n) => `<li>${esc(n)}</li>`).join('')}</ol></div>
  <div class="foot small muted">
    Paid by ${esc(methodText(inv.method))} via Razorpay. This is a computer-generated invoice and needs no signature.<br>
    ${inv.kind === 'dunning_recovery' ? 'Issued for a renewal collected after an earlier failed attempt.' : inv.kind === 'renewal' ? 'Automatic renewal.' : ''}
    ${contact ? `<div style="margin-top:10px"><b>Questions about this invoice?</b> ${contact}</div>` : ''}
  </div>
</div>
</body></html>`
}
