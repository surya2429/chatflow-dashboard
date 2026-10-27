// ClientsTab.jsx — every customer at a glance: who they are, what they're on, what it's worth,
// and how SmatBot sells to them (direct, reseller, white label …).
import { useMemo, useState } from 'react'
import { Search, LogIn, Eye, Plus, RefreshCw } from 'lucide-react'
import { PLANS } from '../../constants/pricing'
import Select from '../Select'
import {
  Kpi, Chips, StatusPill, STATUS_OPTIONS, CUSTOMER_TYPES, customerTypeLabel, fmtDate, fmtRel, rupees, num,
  btnPrimary, downloadCsv, btnGhost, daysFromNow,
} from './ui'

const live = (c) => c.status === 'active' || c.status === 'past_due'
const termLabel = (c) => (c.period === 'yearly' && c.termMonths % 12 === 0 ? `${c.termMonths / 12} years` : `${c.termMonths} months`)
const th = 'px-3 py-2.5 font-semibold whitespace-nowrap'
const td = 'px-3 py-3'

export default function ClientsTab({ customers, canEdit, onOpen, onAssign, onLoginAs }) {
  const [query, setQuery] = useState('')
  const [plan, setPlan] = useState('all')
  const [type, setType] = useState('all')
  const [status, setStatus] = useState('all')
  const [autopay, setAutopay] = useState('all')

  const nameOf = useMemo(() => Object.fromEntries(customers.map((c) => [c.workspaceId, c.customer || c.workspaceId])), [customers])

  const kpi = useMemo(() => {
    const live = customers.filter((c) => c.status === 'active' || c.status === 'past_due')
    const soon = customers.filter((c) => c.renewal && daysFromNow(c.renewal.at) >= 0 && daysFromNow(c.renewal.at) <= 30)
    return {
      live: live.length,
      collected: customers.reduce((n, c) => n + c.paidTotal, 0),
      soon: soon.length,
      soonValue: soon.reduce((n, c) => n + c.renewal.total, 0),
      attention: customers.filter((c) => c.status === 'past_due' || c.status === 'suspended').length,
    }
  }, [customers])

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase()
    return customers.filter((c) =>
      (!q || [c.workspaceId, c.customer, c.contactName, c.email, c.phone, c.gstin, c.city].some((v) => v?.toLowerCase().includes(q)))
      && (plan === 'all' || (plan === 'none' ? !c.plan : c.plan === plan))
      && (type === 'all' || c.customerType === type)
      && (status === 'all' || c.status === status)
      && (autopay === 'all' || (autopay === 'on') === c.autopay))
  }, [customers, query, plan, type, status, autopay])

  function exportCsv() {
    downloadCsv('smatbot-clients.csv', [
      ['Client name', 'Contact', 'Email', 'Phone', 'Plan name', 'Plan type', 'Start date', 'End date', 'Plan value excl. GST (₹)', 'Customer type', 'Partner', 'Status', 'Autopay', 'Workspace', 'GSTIN', 'Paid to date (₹)'],
      ...shown.map((c) => [c.customer || c.workspaceId, c.contactName, c.email, c.phone, c.planName, c.period, fmtDate(c.currentStart), fmtDate(c.currentEnd),
        c.planValue ?? '', customerTypeLabel(c.customerType), c.partner ? nameOf[c.partner] : '', c.status, c.autopay ? 'on' : 'off', c.workspaceId, c.gstin, c.paidTotal]),
    ])
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <Kpi label="Clients" value={num(customers.length)} sub={`${num(customers.filter((c) => c.plan).length)} have had a plan`}/>
        <Kpi label="On a live plan" value={num(kpi.live)}/>
        <Kpi label="Collected" value={rupees(kpi.collected)} sub="incl. GST, all time"/>
        <Kpi label="Due in 30 days" value={num(kpi.soon)} sub={`${rupees(kpi.soonValue)} incl. GST`}/>
        <Kpi label="Need attention" value={num(kpi.attention)} sub="past due or suspended" warn={kpi.attention > 0}/>
      </div>

      <section className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
        <div className="p-4 border-b border-slate-100 space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative flex-1 min-w-[200px]">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"/>
              <input aria-label="Search clients" placeholder="Search name, email, phone, GSTIN, workspace…" value={query} onChange={(e) => setQuery(e.target.value)}
                className="w-full border border-slate-200 rounded-lg pl-9 pr-3 py-2 text-sm outline-none focus:border-primary"/>
            </div>
            <div className="w-36">
              <Select size="sm" value={plan} onChange={setPlan}
                options={[{ value: 'all', label: 'All plans' }, ...PLANS.map((p) => ({ value: p.id, label: p.name })), { value: 'none', label: 'No plan' }]}/>
            </div>
            <div className="w-52">
              <Select size="sm" value={type} onChange={setType}
                options={[{ value: 'all', label: 'All customer types' }, ...CUSTOMER_TYPES.map(([value, label]) => ({ value, label }))]}/>
            </div>
            <button type="button" onClick={exportCsv} className={btnGhost}>Export CSV</button>
            {canEdit && <button type="button" onClick={() => onAssign(null)} className={btnPrimary}><Plus size={14}/> New client</button>}
          </div>
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
            <Chips label="Status" value={status} onChange={setStatus} options={[['all', 'Any status'], ...STATUS_OPTIONS]}/>
            <Chips label="Autopay" value={autopay} onChange={setAutopay} options={[['all', 'Any payment'], ['on', 'Autopay'], ['off', 'Manual']]}/>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[1290px]">
            <thead>
              <tr className="text-left text-[11px] uppercase tracking-wide text-slate-400 bg-slate-50">
                <th className={`${th} pl-4`}>Client name</th>
                <th className={th}>Email</th>
                <th className={th}>Phone</th>
                <th className={th}>Plan name</th>
                <th className={th}>Plan type</th>
                <th className={th}>Start date</th>
                <th className={th}>End date</th>
                <th className={`${th} text-right`}>Plan value</th>
                <th className={th}>Customer type</th>
                <th className={th}>Subscription</th>
                <th className={`${th} pr-4 text-right`}>Action</th>
              </tr>
            </thead>
            <tbody>
              {shown.map((c) => (
                <tr key={c.workspaceId} className="border-t border-slate-100 hover:bg-slate-50/60">
                  <td className={`${td} pl-4 max-w-[220px]`}>
                    <div className="font-semibold text-slate-800 truncate">{c.customer || c.workspaceId}</div>
                    <div className="text-xs text-slate-400 truncate">{c.contactName || (c.customer ? c.workspaceId : 'No billing details yet')}</div>
                  </td>
                  <td className={`${td} max-w-[200px] truncate text-slate-600`}>
                    {c.email ? <a href={`mailto:${c.email}`} className="hover:text-primary">{c.email}</a> : <span className="text-slate-300">—</span>}
                  </td>
                  <td className={`${td} whitespace-nowrap text-slate-600`}>
                    {c.phone ? <a href={`tel:+91${c.phone}`} className="hover:text-primary">+91 {c.phone}</a> : <span className="text-slate-300">—</span>}
                  </td>
                  <td className={`${td} whitespace-nowrap`}>
                    <div className="text-slate-800 font-medium">{c.planName || <span className="text-slate-300 font-normal">—</span>}</div>
                    <div className="mt-0.5"><StatusPill status={c.status}/></div>
                  </td>
                  <td className={`${td} whitespace-nowrap`}>
                    <div className="text-slate-700 capitalize">{c.termMonths ? termLabel(c) : c.period || <span className="text-slate-300">—</span>}</div>
                    {c.plan && <div className="text-[11px] text-slate-400">{c.autopay ? 'Autopay' : 'Manual'}</div>}
                  </td>
                  <td className={`${td} whitespace-nowrap text-slate-600`}>{fmtDate(c.currentStart)}</td>
                  <td className={`${td} whitespace-nowrap`}>
                    <div className="text-slate-600">{fmtDate(c.currentEnd)}</div>
                    {c.currentEnd && <div className="text-[11px] text-slate-400">{fmtRel(c.currentEnd)}</div>}
                  </td>
                  <td className={`${td} text-right whitespace-nowrap`}>
                    {c.free ? <span className="text-xs font-semibold text-slate-500">Free</span>
                      : c.periodPaid > 0 ? (
                        // what they actually paid for this term (after any discount)
                        <>
                          <div className="tabular-nums font-semibold text-slate-800">{rupees(c.periodPaid)}</div>
                          <div className="text-[11px] text-slate-400">+ GST · {c.termMonths ? termLabel(c) : c.period === 'yearly' ? 'year' : 'month'}</div>
                        </>
                      ) : c.planValue != null ? (
                        <>
                          <div className="tabular-nums font-semibold text-slate-800">{rupees(c.planValue)}</div>
                          <div className="text-[11px] text-slate-400">+ GST / {c.period === 'yearly' ? 'yr' : 'mo'}</div>
                        </>
                      ) : <span className="text-slate-300">—</span>}
                  </td>
                  <td className={`${td} max-w-[190px]`}>
                    <div className="text-slate-700 text-xs font-semibold">{customerTypeLabel(c.customerType)}</div>
                    {c.partner && <div className="text-[11px] text-slate-400 truncate">under {nameOf[c.partner] || c.partner}</div>}
                  </td>
                  <td className={`${td} whitespace-nowrap`}>
                    {canEdit ? (
                      <button type="button" onClick={() => onAssign(c)} aria-label={`${live(c) ? 'Change subscription for' : 'Add a subscription for'} ${c.customer || c.workspaceId}`}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-primary border border-primary/30 hover:bg-primary/5">
                        {live(c) ? <><RefreshCw size={12}/> Change</> : <><Plus size={12}/> Add subscription</>}
                      </button>
                    ) : <span className="text-slate-300">—</span>}
                  </td>
                  <td className={`${td} pr-4 text-right whitespace-nowrap`}>
                    <button type="button" onClick={() => onLoginAs(c)} aria-label={`Log in as ${c.customer || c.workspaceId}`}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-white bg-primary hover:bg-primary-hover mr-1.5">
                      <LogIn size={12}/> Login
                    </button>
                    <button type="button" onClick={() => onOpen(c.workspaceId)} aria-label={`View ${c.customer || c.workspaceId}`}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-slate-700 border border-slate-200 hover:bg-slate-50">
                      <Eye size={12}/> View
                    </button>
                  </td>
                </tr>
              ))}
              {!shown.length && (
                <tr><td colSpan={11} className="px-4 py-12 text-center text-sm text-slate-400">
                  {customers.length ? 'No client matches these filters.' : 'No clients yet. A client appears once they add billing details or you assign them a plan.'}
                </td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}
