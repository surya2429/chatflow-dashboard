import { useMemo, useState } from 'react'
import { Search, X } from 'lucide-react'
import clsx from 'clsx'
import DatePicker from '../DatePicker'
import { NativeSelect } from '../Select'
import { ymd } from './dateRange'
import { Segmented, inputCls } from './ui'

/* Filters for lists of leads: a date range (presets or custom from/to), pipeline stage, ad and free text.
   Used by the Leads tab and by each ad's own page, so both filter the same way. */

const DAY = 86400000
const PRESETS = [['all', 'All time'], ['today', 'Today'], ['yesterday', 'Yesterday'], ['7', 'Last 7 days'], ['30', 'Last 30 days'], ['90', 'Last 90 days'], ['month', 'This month'], ['lastmonth', 'Last month'], ['custom', 'Custom range']]
const INITIAL = { q: '', stage: 'all', ad: 'all', preset: 'all', from: '', to: '' }

const localDay = (ymd) => new Date(`${ymd}T00:00:00`).getTime()
/** [fromMs, toMs) — null means open-ended */
function bounds({ preset, from, to }) {
  if (preset === 'all') return [null, null]
  const midnight = (offsetDays = 0, monthOffset = 0) => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth() + monthOffset, offsetDays === 'first' ? 1 : d.getDate() + offsetDays).getTime() }
  if (preset === 'today') return [midnight(), null]
  if (preset === 'yesterday') return [midnight(-1), midnight()]
  if (preset === 'month') return [midnight('first'), null]
  if (preset === 'lastmonth') return [midnight('first', -1), midnight('first')]
  if (preset === 'custom') return [from ? localDay(from) : null, to ? localDay(to) + DAY : null]       // "to" is inclusive
  return [Date.now() - Number(preset) * DAY, null]
}

const has = (l, name) => l.events.some((e) => e.eventName === name && e.status !== 'failed')
const STAGE = { all: () => true, new: (l) => !l.events.length, qualified: (l) => has(l, 'QualifiedLead'), purchased: (l) => has(l, 'Purchase') }

function matches(l, f) {
  const [from, to] = bounds(f)
  const t = new Date(l.createdAt).getTime()
  if ((from !== null && t < from) || (to !== null && t >= to)) return false
  if (f.ad !== 'all' && l.sourceId !== f.ad) return false
  const s = f.q.trim().toLowerCase()
  return !s || (l.contactName || '').toLowerCase().includes(s) || l.waId.includes(s.replace(/\D/g, '') || '§') || (l.adName || '').toLowerCase().includes(s) || (l.headline || '').toLowerCase().includes(s) || (l.sourceId || '').includes(s)
}

export function useLeadFilters(leads) {
  const [f, setF] = useState(INITIAL)
  const set = (patch) => setF((s) => ({ ...s, ...patch }))
  const { shown, counts } = useMemo(() => {
    const base = leads.filter((l) => matches(l, f))               // stage counts reflect every other filter
    return { shown: base.filter(STAGE[f.stage]), counts: Object.fromEntries(Object.keys(STAGE).map((k) => [k, base.filter(STAGE[k]).length])) }
  }, [leads, f])
  return { f, set, reset: () => setF(INITIAL), shown, counts, active: JSON.stringify(f) !== JSON.stringify(INITIAL) }
}

export function RangeFilter({ f, set }) {
  const today = ymd(new Date())          // the person's own today, not UTC's
  return (
    <>
      <NativeSelect sm value={f.preset} onChange={(e) => set({ preset: e.target.value })} className="!w-36">
        {PRESETS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
      </NativeSelect>
      {f.preset === 'custom' && (
        <div className="flex items-center gap-1.5">
          <DatePicker value={f.from} onChange={(v) => set({ from: v, to: f.to && f.to < v ? v : f.to })} min="2015-01-01" max={today} className="w-36" />
          <span className="text-[11px] text-slate-400">to</span>
          <DatePicker value={f.to} onChange={(v) => set({ to: v })} min={f.from || '2015-01-01'} max={today} className="w-36" />
        </div>
      )}
    </>
  )
}

/** The bar itself. `ads` ([[id, name]]) adds an "ad" picker; `right` holds actions such as export. */
export function LeadFilterBar({ filters, ads, right, total }) {
  const { f, set, reset, counts, shown, active } = filters
  return (
    <div className="bg-white border border-surface-border rounded-xl">
      <div className="flex flex-wrap items-center gap-2 px-4 py-3">
        <Segmented value={f.stage} onChange={(stage) => set({ stage })} options={[['all', 'All'], ['new', 'New'], ['qualified', 'Qualified'], ['purchased', 'Purchased']].map(([key, label]) => ({ key, label, count: counts[key] }))} />
        <div className="relative">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input value={f.q} onChange={(e) => set({ q: e.target.value })} placeholder="Search name, number or ad" aria-label="Search leads" className={clsx(inputCls, 'pl-8 w-52')} />
        </div>
        {ads && <NativeSelect sm value={f.ad} onChange={(e) => set({ ad: e.target.value })} className="!w-48"><option value="all">All ads</option>{ads.map(([id, name]) => <option key={id} value={id}>{name}</option>)}</NativeSelect>}
        <RangeFilter f={f} set={set} />
        {active && <button onClick={reset} className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-500 hover:text-primary"><X size={12} /> Clear filters</button>}
        <div className="ml-auto flex items-center gap-3">
          <span className="text-[11px] text-slate-400 whitespace-nowrap">{shown.length === total ? `${total} ${total === 1 ? 'lead' : 'leads'}` : `${shown.length} of ${total} leads`}</span>
          {right}
        </div>
      </div>
    </div>
  )
}
