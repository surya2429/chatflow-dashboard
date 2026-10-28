// RenewalsTab.jsx — who pays next, when and how much: autopay charges coming up, and manual
// renewals (pay-once and assigned plans) that need chasing. Every filter combines with the others.
import { useMemo, useState } from 'react'
import clsx from 'clsx'
import { ArrowUpDown } from 'lucide-react'
import DatePicker from '../DatePicker'
import { Kpi, Chips, StatusPill, customerTypeLabel, fmtDate, fmtRel, rupees, num, daysFromNow, downloadCsv, btnGhost } from './ui'
import { ClientFilterBar, useClientFilters, STATUS_FILTERS } from './ClientFilters'
import RenewDialog from './RenewDialog'

const WINDOWS = [['overdue', 'Overdue'], ['7', 'Next 7 days'], ['30', 'Next 30 days'], ['90', 'Next 90 days'], ['all', 'All'], ['custom', 'Custom dates']]
const dayStart = (ymd) => new Date(`${ymd}T00:00:00`).getTime() / 1000
const dayEnd = (ymd) => new Date(`${ymd}T23:59:59`).getTime() / 1000

export default function RenewalsTab({ token, customers, initialFilters, canEdit, onOpen, onRenewed }) {
  const [renewing, setRenewing] = useState(null)
  const [win, setWin] = useState('30')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [desc, setDesc] = useState(false)

  const all = useMemo(() => customers.filter((c) => c.renewal), [customers])
  const filters = useClientFilters(all, initialFilters)

  const rows = useMemo(() => {
    const inWindow = (at) => {
      const d = daysFromNow(at)
      if (win === 'overdue') return at * 1000 < Date.now()
      if (win === 'all') return true
      if (win === 'custom') return (!from || at >= dayStart(from)) && (!to || at <= dayEnd(to))
      return at * 1000 >= Date.now() && d <= Number(win)
    }
    return filters.shown
      .filter((c) => inWindow(c.renewal.at))
      .sort((a, b) => (desc ? b.renewal.at - a.renewal.at : a.renewal.at - b.renewal.at))
  }, [filters.shown, win, from, to, desc])

  const total = rows.reduce((n, c) => n + c.renewal.total, 0)
  const auto = rows.filter((c) => c.renewal.type === 'autopay')
  const overdueCount = all.filter((c) => c.renewal.at * 1000 < Date.now()).length

  function exportCsv() {
    downloadCsv('smatbot-renewals.csv', [
      ['Renews on', 'Company', 'Contact', 'Email', 'Phone', 'Workspace', 'Plan', 'Billing', 'Type', 'Amount incl. GST (₹)', 'Status', 'Customer type'],
      ...rows.map((c) => [fmtDate(c.renewal.at), c.customer, c.contactName, c.email, c.phone, c.workspaceId, c.renewal.planName, c.renewal.period, c.renewal.type, c.renewal.total, c.status, customerTypeLabel(c.customerType)]),
    ])
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Kpi label="Renewals shown" value={num(rows.length)} sub={`of ${num(all.length)} clients with a plan`}/>
        <Kpi label="Expected value" value={rupees(total)} sub="incl. GST"/>
        <Kpi label="Charged automatically" value={num(auto.length)} sub={rupees(auto.reduce((n, c) => n + c.renewal.total, 0))}/>
        <Kpi label="Overdue (all time)" value={num(overdueCount)} sub="ended, not renewed" warn={overdueCount > 0}/>
      </div>

      <section className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
        <div className="px-4 pt-4 flex flex-wrap items-center gap-2">
          <Chips label="When" value={win} onChange={setWin} options={WINDOWS}/>
          {win === 'custom' && (
            <div className="flex items-center gap-2">
              <DatePicker value={from} onChange={setFrom} min="2000-01-01" textSize="text-xs" className="w-36"/>
              <span className="text-xs text-slate-400">to</span>
              <DatePicker value={to} onChange={setTo} min={from || '2000-01-01'} textSize="text-xs" className="w-36"/>
            </div>
          )}
        </div>
        <ClientFilterBar filters={filters} statusOptions={STATUS_FILTERS.filter(([v]) => v !== 'none')} placeholder="Search client, email, phone…"
          actions={<button type="button" onClick={exportCsv} className={btnGhost}>Export CSV</button>}/>

        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[760px]">
            <thead>
              <tr className="text-left text-[11px] uppercase tracking-wide text-slate-400 bg-slate-50">
                <th className="px-4 py-2.5 font-semibold">
                  <button type="button" onClick={() => setDesc((d) => !d)} className="inline-flex items-center gap-1 uppercase font-semibold hover:text-slate-600" aria-label={`Sort by date, ${desc ? 'latest' : 'soonest'} first`}>
                    Renews on <ArrowUpDown size={11}/>
                  </button>
                </th>
                <th className="px-3 py-2.5 font-semibold">Client</th>
                <th className="px-3 py-2.5 font-semibold">Plan</th>
                <th className="px-3 py-2.5 font-semibold">Type</th>
                <th className="px-3 py-2.5 font-semibold text-right">Amount</th>
                <th className="px-3 py-2.5 font-semibold">Status</th>
                {canEdit && <th className="px-4 py-2.5 font-semibold text-right">Action</th>}
              </tr>
            </thead>
            <tbody>
              {rows.map((c) => {
                const late = c.renewal.at * 1000 < Date.now()
                return (
                  <tr key={c.workspaceId} className="border-t border-slate-100 hover:bg-slate-50/60">
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="text-slate-800 font-medium">{fmtDate(c.renewal.at)}</div>
                      <div className={clsx('text-[11px]', late ? 'text-red-600 font-semibold' : daysFromNow(c.renewal.at) <= 7 ? 'text-amber-600' : 'text-slate-400')}>{fmtRel(c.renewal.at)}</div>
                    </td>
                    <td className="px-3 py-3 max-w-[240px]">
                      <button type="button" onClick={() => onOpen(c.workspaceId)} className="text-left font-semibold text-slate-800 hover:text-primary truncate block max-w-full">{c.customer || c.workspaceId}</button>
                      <div className="text-xs text-slate-400 truncate">{[c.contactName, c.phone && `+91 ${c.phone}`, c.email].filter(Boolean).join(' · ')}</div>
                    </td>
                    <td className="px-3 py-3 whitespace-nowrap text-slate-700">
                      {c.renewal.planName} <span className="text-slate-400">· {c.renewal.period}</span>
                      <div className="text-[11px] text-slate-400">{customerTypeLabel(c.customerType)}</div>
                    </td>
                    <td className="px-3 py-3 whitespace-nowrap">
                      <span className={clsx('text-xs font-semibold', c.renewal.type === 'autopay' ? 'text-violet-700' : 'text-slate-600')}>{c.renewal.type === 'autopay' ? 'Autopay' : 'Manual'}</span>
                      {c.card && <div className="text-[11px] text-slate-400">{c.card.network || 'Card'} •••• {c.card.last4}</div>}
                      {c.renewal.cycle && <div className="text-[11px] text-slate-400">{c.renewal.scheduled ? `Scheduled · ${c.nextSub?.number}` : `Cycle ${c.renewal.cycle}${c.renewal.cycles ? ` of ${c.renewal.cycles}` : ''} · ${c.subscription?.number}`}</div>}
                    </td>
                    <td className="px-3 py-3 text-right tabular-nums font-semibold text-slate-800">{rupees(c.renewal.total)}</td>
                    <td className="px-3 py-3"><StatusPill status={c.status}/></td>
                    {canEdit && (
                      <td className="px-4 py-3 text-right whitespace-nowrap">
                        {c.renewal.cycle ? (
                          <button type="button" onClick={() => setRenewing(c)} disabled={c.renewal.scheduled && c.renewal.at * 1000 > Date.now()} title={c.renewal.scheduled && c.renewal.at * 1000 > Date.now() ? `Available from ${fmtDate(c.renewal.at)}` : undefined}
                            className="inline-flex items-center px-2.5 py-1.5 rounded-lg text-xs font-semibold text-white bg-primary hover:bg-primary-hover disabled:opacity-40 disabled:cursor-not-allowed">{c.renewal.scheduled ? 'Start & record payment' : 'Record payment'}</button>
                        ) : <span className="text-slate-300">—</span>}
                      </td>
                    )}
                  </tr>
                )
              })}
              {!rows.length && (
                <tr><td colSpan={canEdit ? 7 : 6} className="px-4 py-12 text-center text-sm text-slate-400">No renewals match these filters.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
      {renewing && <RenewDialog token={token} client={renewing} onClose={() => setRenewing(null)} onDone={(row) => { setRenewing(null); onRenewed(row) }}/>}
    </div>
  )
}
