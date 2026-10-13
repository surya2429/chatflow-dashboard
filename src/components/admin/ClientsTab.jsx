// ClientsTab.jsx — every customer at a glance: who they are, what they're on, what they've paid.
import { useMemo, useState } from 'react'
import { Search, LogIn, Plus } from 'lucide-react'
import { PLANS } from '../../constants/pricing'
import Select from '../Select'
import { Kpi, Chips, StatusPill, STATUS_OPTIONS, fmtDate, fmtRel, rupees, num, btnPrimary, downloadCsv, btnGhost, daysFromNow } from './ui'

export default function ClientsTab({ customers, canEdit, onOpen, onAssign, onLoginAs }) {
  const [query, setQuery] = useState('')
  const [plan, setPlan] = useState('all')
  const [status, setStatus] = useState('all')
  const [autopay, setAutopay] = useState('all')

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
      && (status === 'all' || c.status === status)
      && (autopay === 'all' || (autopay === 'on') === c.autopay))
  }, [customers, query, plan, status, autopay])

  function exportCsv() {
    downloadCsv('smatbot-clients.csv', [
      ['Workspace', 'Company', 'Contact', 'Email', 'Phone', 'GSTIN', 'City', 'State', 'Plan', 'Billing', 'Status', 'Autopay', 'Started', 'Ends / renews', 'Paid to date (₹)', 'Payments'],
      ...shown.map((c) => [c.workspaceId, c.customer, c.contactName, c.email, c.phone, c.gstin, c.city, c.state, c.planName, c.period, c.status, c.autopay ? 'on' : 'off',
        fmtDate(c.currentStart), fmtDate(c.renewal?.at ?? c.currentEnd), c.paidTotal, c.paymentsCount]),
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
            <div className="w-40">
              <Select size="sm" value={plan} onChange={setPlan}
                options={[{ value: 'all', label: 'All plans' }, ...PLANS.map((p) => ({ value: p.id, label: p.name })), { value: 'none', label: 'No plan' }]}/>
            </div>
            <button type="button" onClick={exportCsv} className={btnGhost}>Export CSV</button>
            {canEdit && <button type="button" onClick={() => onAssign(null)} className={btnPrimary}><Plus size={14}/> New customer</button>}
          </div>
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
            <Chips label="Status" value={status} onChange={setStatus} options={[['all', 'Any status'], ...STATUS_OPTIONS]}/>
            <Chips label="Autopay" value={autopay} onChange={setAutopay} options={[['all', 'Any payment'], ['on', 'Autopay'], ['off', 'Manual']]}/>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[760px]">
            <thead>
              <tr className="text-left text-[11px] uppercase tracking-wide text-slate-400 bg-slate-50">
                <th className="px-4 py-2.5 font-semibold">Client</th>
                <th className="px-3 py-2.5 font-semibold">Plan</th>
                <th className="px-3 py-2.5 font-semibold">Status</th>
                <th className="px-3 py-2.5 font-semibold">Renews / ends</th>
                <th className="px-3 py-2.5 font-semibold text-right">Paid to date</th>
                <th className="px-4 py-2.5"><span className="sr-only">Actions</span></th>
              </tr>
            </thead>
            <tbody>
              {shown.map((c) => (
                <tr key={c.workspaceId} className="border-t border-slate-100 hover:bg-slate-50/60">
                  <td className="px-4 py-3 max-w-[260px]">
                    <button type="button" onClick={() => onOpen(c.workspaceId)} className="text-left font-semibold text-slate-800 hover:text-primary truncate block max-w-full">
                      {c.customer || c.workspaceId}
                    </button>
                    <div className="text-xs text-slate-400 truncate">{[c.contactName, c.email, c.customer ? c.workspaceId : 'No billing details yet'].filter(Boolean).join(' · ')}</div>
                  </td>
                  <td className="px-3 py-3 text-slate-700 whitespace-nowrap">
                    {c.planName ? <>{c.planName} <span className="text-slate-400">· {c.period}</span></> : <span className="text-slate-400">—</span>}
                    {c.addons.length > 0 && <div className="text-xs text-slate-400">+ {c.addons.length} add-on{c.addons.length > 1 ? 's' : ''}</div>}
                  </td>
                  <td className="px-3 py-3">
                    <StatusPill status={c.status}/>
                    <div className="text-[11px] text-slate-400 mt-0.5">{c.autopay ? 'Autopay' : c.plan ? 'Manual' : ''}</div>
                  </td>
                  <td className="px-3 py-3 whitespace-nowrap">
                    <div className="text-slate-700">{fmtDate(c.renewal?.at ?? c.currentEnd)}</div>
                    {c.renewal && <div className="text-[11px] text-slate-400">{fmtRel(c.renewal.at)}</div>}
                  </td>
                  <td className="px-3 py-3 text-right tabular-nums text-slate-700">
                    {rupees(c.paidTotal)}
                    <div className="text-[11px] text-slate-400">{c.paymentsCount} payment{c.paymentsCount === 1 ? '' : 's'}</div>
                  </td>
                  <td className="px-4 py-3 text-right whitespace-nowrap">
                    <button type="button" onClick={() => onOpen(c.workspaceId)} className="text-xs font-semibold text-primary hover:underline mr-3">View</button>
                    <button type="button" onClick={() => onLoginAs(c)} className="inline-flex items-center gap-1 text-xs font-semibold text-slate-600 hover:text-primary">
                      <LogIn size={12}/> Log in
                    </button>
                  </td>
                </tr>
              ))}
              {!shown.length && (
                <tr><td colSpan={6} className="px-4 py-12 text-center text-sm text-slate-400">
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
