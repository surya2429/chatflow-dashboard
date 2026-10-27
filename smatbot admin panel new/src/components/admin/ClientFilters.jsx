// ClientFilters.jsx — the one set of client filters every list uses (All clients, Active clients,
// Renewals): search, plan, cycle, autopay or pay once, manual or paid from the dashboard, status,
// customer type and renewal month. Every filter combines with the others.
import { useMemo, useState } from 'react'
import { Search, X } from 'lucide-react'
import { PLANS } from '../../constants/pricing'
import Select from '../Select'
import { CUSTOMER_TYPES } from './ui'

export const EMPTY_FILTERS = { query: '', plan: 'all', cycle: 'all', payment: 'all', source: 'all', status: 'all', type: 'all', month: 'all' }

/** monthly · yearly · multi (several cycles bought at once) */
export const cycleOf = (c) => (!c.period ? null : c.termMonths > (c.period === 'yearly' ? 12 : 1) ? 'multi' : c.period)
/** When the client next pays, or their plan runs out. */
export const renewsAt = (c) => c.renewal?.at ?? c.currentEnd ?? null
const monthKey = (sec) => { const d = new Date(sec * 1000); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}` }
const monthLabel = (key) => new Date(`${key}-01T00:00:00`).toLocaleDateString('en-GB', { month: 'short', year: 'numeric' })
const ENDED = ['expired', 'cancelled', 'completed']

export const STATUS_FILTERS = [['active', 'Active'], ['past_due', 'Past due'], ['expired', 'Expired'], ['suspended', 'Suspended'], ['none', 'No plan']]

export function matches(c, f) {
  const q = f.query.trim().toLowerCase()
  const at = renewsAt(c)
  return (!q || [c.workspaceId, c.customer, c.contactName, c.email, c.phone, c.gstin, c.city].some((v) => v?.toLowerCase().includes(q)))
    && (f.plan === 'all' || (f.plan === 'none' ? !c.plan : c.plan === f.plan))
    && (f.cycle === 'all' || cycleOf(c) === f.cycle)
    && (f.payment === 'all' || (c.plan && (f.payment === 'autopay') === c.autopay))
    && (f.source === 'all' || c.source === f.source)
    && (f.status === 'all' || (f.status === 'expired' ? ENDED.includes(c.status) : c.status === f.status))
    && (f.type === 'all' || c.customerType === f.type)
    && (f.month === 'all' || (at && monthKey(at) === f.month))
}

/** Filter state plus the rows that pass. initial: filters to start with (from the page's #link). */
export function useClientFilters(rows, initial = {}) {
  const [f, setF] = useState(() => ({ ...EMPTY_FILTERS, ...Object.fromEntries(Object.entries(initial).filter(([k]) => k in EMPTY_FILTERS)) }))
  const shown = useMemo(() => rows.filter((c) => matches(c, f)), [rows, f])
  const months = useMemo(() => [...new Set(rows.map(renewsAt).filter(Boolean).map(monthKey))].sort(), [rows])
  const set = (k) => (v) => setF((x) => ({ ...x, [k]: v }))
  return { f, set, reset: () => setF(EMPTY_FILTERS), shown, months }
}

function Pick({ label, value, onChange, options }) {
  return (
    <div className="min-w-0">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400 mb-1">{label}</p>
      <Select size="sm" value={value} onChange={onChange} options={options.map(([v, l]) => ({ value: v, label: l }))}/>
    </div>
  )
}

/* hide: filter keys this list doesn't need (e.g. status on Renewals' own window). */
export function ClientFilterBar({ filters, hide = [], actions, placeholder = 'Search name, email, phone, GSTIN, workspace…', statusOptions = STATUS_FILTERS }) {
  const { f, set, reset, months } = filters
  const active = Object.keys(EMPTY_FILTERS).filter((k) => f[k] !== EMPTY_FILTERS[k]).length
  const picks = [
    ['plan', 'Plan', [['all', 'All plans'], ...PLANS.map((p) => [p.id, p.name]), ['none', 'No plan']]],
    ['cycle', 'Cycle', [['all', 'Any cycle'], ['monthly', 'Monthly'], ['yearly', 'Yearly'], ['multi', 'Multi-cycle']]],
    ['payment', 'Payment', [['all', 'Autopay & pay once'], ['autopay', 'Autopay'], ['once', 'Pay once']]],
    ['source', 'Subscription', [['all', 'Manual & dashboard'], ['staff', 'Manual (by staff)'], ['dashboard', 'Paid from dashboard']]],
    ['status', 'Status', [['all', 'Any status'], ...statusOptions]],
    ['type', 'Customer type', [['all', 'All types'], ...CUSTOMER_TYPES]],
    ['month', 'Renewal month', [['all', 'Any month'], ...months.map((m) => [m, monthLabel(m)])]],
  ].filter(([k]) => !hide.includes(k))
  return (
    <div className="p-4 border-b border-slate-100 space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[220px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"/>
          <input type="search" aria-label="Search clients" placeholder={placeholder} value={f.query} onChange={(e) => set('query')(e.target.value)}
            className="w-full border border-slate-200 rounded-lg pl-9 pr-3 py-2 text-sm outline-none focus:border-primary"/>
        </div>
        {active > 0 && (
          <button type="button" onClick={reset} className="inline-flex items-center gap-1 px-2.5 py-2 rounded-lg text-xs font-semibold text-slate-500 hover:text-slate-800 hover:bg-slate-100">
            <X size={13}/> Clear {active} filter{active > 1 ? 's' : ''}
          </button>
        )}
        {actions}
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 xl:grid-cols-7 gap-2">
        {picks.map(([k, label, options]) => <Pick key={k} label={label} value={f[k]} onChange={set(k)} options={options}/>)}
      </div>
    </div>
  )
}
