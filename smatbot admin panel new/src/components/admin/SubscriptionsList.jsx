// SubscriptionsList.jsx — every subscription staff have added from this panel: who it is for, the plan,
// how far through its cycles it is, what each cycle costs and when the next payment is due. The same
// filters as the client lists work here; "Record payment" bills the next cycle.
import { useMemo } from 'react'
import clsx from 'clsx'
import { Plus, Eye, RefreshCw, Receipt, X } from 'lucide-react'
import { Kpi, StatusPill, fmtDate, fmtRel, rupees, num, btnPrimary, btnGhost, downloadCsv, daysFromNow } from './ui'
import { ClientFilterBar, useClientFilters } from './ClientFilters'

const live = (c) => c.status === 'active' || c.status === 'past_due'
const th = 'px-3 py-2.5 font-semibold whitespace-nowrap'
const td = 'px-3 py-3.5 align-top'
const cycleWord = (c) => (c.period === 'yearly' ? 'Yearly' : 'Monthly')
const SCHEDULED_STATUS = [['active', 'Active'], ['past_due', 'Past due'], ['scheduled', 'Scheduled'], ['expired', 'Expired'], ['suspended', 'Suspended']]

/* A subscription scheduled to start when the current plan ends is a row of its own: the client's row,
   shown as that future plan so the same columns and filters work. */
function scheduledRow(c) {
  const n = c.nextSub
  return {
    ...c, key: `${c.workspaceId}:next`, plan: n.plan, planName: n.planName, period: n.period, termMonths: null, status: 'scheduled', currentStart: n.at, currentEnd: n.end,
    autopay: false, free: false, source: 'staff', addons: n.addons, monthlyValue: 0, planValue: n.cycleValue,
    subscription: { number: n.number, cycles: n.cycles, billed: 0, startedAt: n.createdAt, by: n.by, cycleValue: n.cycleValue, salesperson: n.salesperson },
    renewal: { at: n.at, total: n.total, cycle: 1, cycles: n.cycles, scheduled: true, plan: n.plan, planName: n.planName, period: n.period, type: 'manual' },
  }
}

export default function SubscriptionsList({ customers, canEdit, onAdd, onOpen, onChange, onRecord, onUnschedule }) {
  const rows = useMemo(() => customers.flatMap((c) => [c.source === 'staff' && c.plan ? c : null, c.nextSub ? scheduledRow(c) : null]).filter(Boolean), [customers])
  const filters = useClientFilters(rows)
  const { shown } = filters

  const kpi = useMemo(() => {
    const due = shown.filter((c) => c.renewal && daysFromNow(c.renewal.at) <= 30)
    return { live: shown.filter(live).length, mrr: shown.reduce((n, c) => n + (c.monthlyValue || 0), 0), due: due.length, dueValue: due.reduce((n, c) => n + c.renewal.total, 0) }
  }, [shown])

  function exportCsv() {
    downloadCsv('smatbot-subscriptions.csv', [
      ['Subscription', 'Client', 'Workspace', 'Plan', 'Billing', 'Cycles billed', 'Cycles in all', 'Start', 'End', 'Per cycle excl. GST (₹)', 'Next payment', 'Next amount incl. GST (₹)', 'Status', 'Salesperson', 'Added by'],
      ...shown.map((c) => [c.subscription?.number || '', c.customer || c.workspaceId, c.workspaceId, c.planName, cycleWord(c), c.subscription?.billed ?? '', c.subscription?.cycles ?? (c.subscription ? 'never expires' : ''),
        fmtDate(c.currentStart), fmtDate(c.currentEnd), c.subscription?.cycleValue ?? c.planValue ?? '', c.renewal ? fmtDate(c.renewal.at) : '', c.renewal?.total ?? '', c.status, c.subscription?.salesperson || '', c.subscription?.by || '']),
    ])
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex-1 min-w-0">
          <h2 className="text-base font-bold text-slate-900">Subscriptions</h2>
          <p className="text-sm text-slate-500">Everything added from this panel, newest cycle first.</p>
        </div>
        {canEdit && <button type="button" onClick={onAdd} className={clsx(btnPrimary, 'h-10 rounded-xl px-5 shadow-sm shadow-primary/20')}><Plus size={16}/> Add subscription</button>}
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Kpi label="Subscriptions" value={num(shown.length)} sub={shown.length === rows.length ? 'added from this panel' : `of ${num(rows.length)}`}/>
        <Kpi label="Live now" value={num(kpi.live)}/>
        <Kpi label="Monthly value" value={rupees(kpi.mrr)} sub="before GST"/>
        <Kpi label="Payments due in 30 days" value={num(kpi.due)} sub={`${rupees(kpi.dueValue)} incl. GST`} warn={kpi.due > 0}/>
      </div>

      <section className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
        <ClientFilterBar filters={filters} hide={['source', 'payment']} statusOptions={SCHEDULED_STATUS} placeholder="Search client, subscription number…"
          actions={<button type="button" onClick={exportCsv} className={btnGhost}>Export CSV</button>}/>
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[1040px]">
            <thead>
              <tr className="text-left text-[11px] uppercase tracking-wide text-slate-400 bg-slate-50">
                <th className={`${th} pl-4`}>Subscription</th><th className={th}>Client</th><th className={th}>Plan</th><th className={th}>Cycles</th>
                <th className={th}>Current period</th><th className={`${th} text-right`}>Per cycle</th><th className={th}>Next payment</th><th className={th}>Status</th>
                <th className={`${th} pr-4 text-right`}>Action</th>
              </tr>
            </thead>
            <tbody>
              {shown.map((c) => {
                const s = c.subscription
                const pct = s?.cycles ? Math.min(100, Math.round((s.billed / s.cycles) * 100)) : null
                const finished = s && s.cycles !== null && s.billed >= s.cycles
                const upcoming = c.status === 'scheduled'
                const notYet = upcoming && c.renewal.at * 1000 > Date.now()
                const followed = !upcoming && c.nextSub          // another subscription is scheduled to take over from this one
                return (
                  <tr key={c.key || c.workspaceId} className="border-t border-slate-100 hover:bg-slate-50/60">
                    <td className={`${td} pl-4 whitespace-nowrap`}>
                      <div className="font-mono text-xs font-semibold text-slate-800">{s?.number || '—'}</div>
                      <div className="text-[11px] text-slate-400">{s ? `${fmtDate(s.startedAt)} · ${s.by?.split('@')[0] || ''}` : 'Set up before numbering'}</div>
                    </td>
                    <td className={`${td} max-w-[220px]`}>
                      <button type="button" onClick={() => onOpen(c.workspaceId)} className="text-left font-semibold text-slate-800 hover:text-primary truncate block max-w-full">{c.customer || c.workspaceId}</button>
                      <div className="text-xs text-slate-400 truncate">{c.contactName || c.workspaceId}</div>
                    </td>
                    <td className={`${td} whitespace-nowrap`}>
                      <div className="font-medium text-slate-800">{c.planName}</div>
                      <div className="text-[11px] text-slate-400">{cycleWord(c)}{c.addons.length > 0 && ` · ${c.addons.length} add-on${c.addons.length > 1 ? 's' : ''}`}</div>
                    </td>
                    <td className={`${td} min-w-[120px]`}>
                      {s ? (
                        <>
                          <div className="text-slate-800 text-xs font-medium">{s.billed} of {s.cycles ?? '∞'} billed</div>
                          {pct !== null ? <div className="mt-1.5 h-1.5 w-24 rounded-full bg-slate-100 overflow-hidden"><div className="h-full rounded-full bg-primary" style={{ width: `${pct}%` }}/></div>
                            : <div className="text-[11px] text-slate-400">never expires</div>}
                        </>
                      ) : <span className="text-slate-300">—</span>}
                    </td>
                    <td className={`${td} whitespace-nowrap`}>
                      {upcoming ? (
                        <><div className="text-slate-700">Starts {fmtDate(c.currentStart)}</div><div className="text-[11px] text-slate-400">to {fmtDate(c.currentEnd)}</div></>
                      ) : (
                        <><div className="text-slate-700">{fmtDate(c.currentStart)} → {fmtDate(c.currentEnd)}</div><div className="text-[11px] text-slate-400">{fmtRel(c.currentEnd)}</div></>
                      )}
                    </td>
                    <td className={`${td} text-right whitespace-nowrap`}>
                      {c.free ? <span className="text-xs font-semibold text-slate-500">Free</span> : (
                        <><div className="font-semibold tabular-nums text-slate-800">{rupees(s?.cycleValue ?? c.planValue)}</div><div className="text-[11px] text-slate-400">+ GST</div></>
                      )}
                    </td>
                    <td className={`${td} whitespace-nowrap`}>
                      {followed ? (
                        <><div className="font-medium text-slate-800">{fmtDate(c.nextSub.at)}</div><div className="text-[11px] text-violet-700">{c.nextSub.number} takes over</div></>
                      ) : c.renewal ? (
                        <>
                          <div className={clsx('font-medium', daysFromNow(c.renewal.at) < 0 ? 'text-red-600' : 'text-slate-800')}>{fmtDate(c.renewal.at)}</div>
                          <div className="text-[11px] text-slate-400">{rupees(c.renewal.total)} · {fmtRel(c.renewal.at)}</div>
                        </>
                      ) : <span className="text-xs text-slate-400">{finished ? 'All cycles billed' : '—'}</span>}
                    </td>
                    <td className={td}><StatusPill status={c.status}/></td>
                    <td className={`${td} pr-4 text-right whitespace-nowrap`}>
                      {canEdit && c.renewal?.cycle && !followed && (
                        <button type="button" onClick={() => onRecord(c)} disabled={notYet} title={notYet ? `Available from ${fmtDate(c.renewal.at)}` : undefined}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-white bg-primary hover:bg-primary-hover disabled:opacity-40 disabled:cursor-not-allowed mr-1.5">
                          <Receipt size={12}/> {upcoming ? 'Start & record payment' : 'Record payment'}
                        </button>
                      )}
                      {canEdit && upcoming && (
                        <button type="button" onClick={() => onUnschedule(c)} aria-label={`Cancel the scheduled subscription of ${c.customer || c.workspaceId}`}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-red-600 border border-red-200 hover:bg-red-50 mr-1.5"><X size={12}/> Cancel</button>
                      )}
                      {canEdit && !upcoming && (
                        <button type="button" onClick={() => onChange(c)} aria-label={`Change the subscription of ${c.customer || c.workspaceId}`}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-primary border border-primary/30 hover:bg-primary/5 mr-1.5"><RefreshCw size={12}/> Change</button>
                      )}
                      <button type="button" onClick={() => onOpen(c.workspaceId)} aria-label={`View ${c.customer || c.workspaceId}`}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-slate-700 border border-slate-200 hover:bg-slate-50"><Eye size={12}/> View</button>
                    </td>
                  </tr>
                )
              })}
              {!shown.length && (
                <tr><td colSpan={9} className="px-4 py-14 text-center">
                  <p className="text-sm text-slate-500">{rows.length ? 'No subscription matches these filters.' : 'No subscriptions have been added from this panel yet.'}</p>
                  {!rows.length && canEdit && <button type="button" onClick={onAdd} className={clsx(btnPrimary, 'mt-3')}><Plus size={14}/> Add the first subscription</button>}
                </td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}
