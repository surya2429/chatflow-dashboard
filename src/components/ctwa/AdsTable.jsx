import { useMemo, useState } from 'react'
import { Search, Pencil, Archive, Check, X, Plus, ImageIcon, Loader2 } from 'lucide-react'
import clsx from 'clsx'
import { ctwa, money, num, pct } from '../../lib/ctwaApi'
import { ExportMenu } from '../ai/AiData'
import { adsExportTable } from './exports'
import { Card, StatusPill, Switch, inputCls } from './ui'

const FILTERS = [['all', 'All'], ['ACTIVE', 'Active'], ['PAUSED', 'Paused'], ['issues', 'Needs attention']]
const ATTENTION = new Set(['DISAPPROVED', 'WITH_ISSUES', 'PENDING_REVIEW', 'IN_PROCESS', 'PENDING_BILLING_INFO'])

export default function AdsTable({ data, reload, notify, onCreate, onOpenAd }) {
  const { ads, currency } = data
  const stats = (a) => data.leadStats?.[a.id] ?? { leads: 0, qualified: 0, purchases: 0, revenue: 0 }
  const [q, setQ] = useState('')
  const [filter, setFilter] = useState('all')
  const [busy, setBusy] = useState('')            // ad id with a request in flight
  const [edit, setEdit] = useState(null)          // { id, field: 'name' | 'budget', value }
  const [confirm, setConfirm] = useState('')      // ad id awaiting "Archive?" confirmation

  const rows = useMemo(() => ads.filter((a) => {
    if (filter === 'ACTIVE' || filter === 'PAUSED') { if (a.status !== filter) return false }
    if (filter === 'issues' && !ATTENTION.has(a.effectiveStatus)) return false
    const s = q.trim().toLowerCase()
    return !s || a.name.toLowerCase().includes(s) || a.campaignName.toLowerCase().includes(s) || a.headline.toLowerCase().includes(s) || a.id.includes(s)
  }), [ads, q, filter])

  const sum = useMemo(() => rows.reduce((a, x) => ({ spend: a.spend + x.metrics.spend, impressions: a.impressions + x.metrics.impressions, clicks: a.clicks + x.metrics.clicks, conversations: a.conversations + x.metrics.conversations }), { spend: 0, impressions: 0, clicks: 0, conversations: 0 }), [rows])

  const exportTable = useMemo(() => adsExportTable({ ads: rows, leadStats: data.leadStats, currency, range: data.range }), [rows, data.leadStats, currency, data.range])

  async function run(id, fn, ok) {
    setBusy(id)
    try { await fn(); notify(ok, 'ok'); await reload() }
    catch (e) { notify(e.message, 'error') }
    finally { setBusy(''); setConfirm('') }
  }
  const toggle = (a, on) => run(a.id, () => ctwa.updateAd(a.id, { status: on ? 'ACTIVE' : 'PAUSED' }), on ? `“${a.name}” is on.` : `“${a.name}” is paused.`)
  const archive = (a) => run(a.id, () => ctwa.archiveAd(a.id), `“${a.name}” was archived.`)
  function save() {
    const { id, field, value } = edit
    const a = ads.find((x) => x.id === id)
    setEdit(null)
    if (field === 'name') {
      if (value.trim() === a.name) return
      return run(id, () => ctwa.updateAd(id, { name: value.trim() }), 'Name updated.')
    }
    const b = Number(value)
    if (b === a.dailyBudget) return
    return run(id, () => ctwa.updateAd(id, { dailyBudget: b }), `Daily budget is now ${money(b, currency)}.`)
  }
  const onKey = (e) => { if (e.key === 'Enter') save(); if (e.key === 'Escape') setEdit(null) }

  const th = 'sticky top-0 z-10 px-3 py-2.5 text-left text-[10.5px] font-semibold text-slate-500 whitespace-nowrap bg-slate-50 border-b border-surface-border'
  const num_ = 'px-3 py-3 text-right tabular-nums text-slate-700 whitespace-nowrap'

  return (
    <Card bodyClass="">
      <div className="flex flex-wrap items-center gap-2 px-4 py-3 border-b border-surface-border">
        <div className="relative">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search ads, campaigns or IDs" aria-label="Search ads" className={clsx(inputCls, 'pl-8 w-56')} />
        </div>
        <div className="inline-flex bg-slate-100 rounded-lg p-0.5">
          {FILTERS.map(([k, l]) => (
            <button key={k} onClick={() => setFilter(k)} className={clsx('px-2.5 py-1 rounded-md text-[11px] font-semibold transition-colors', filter === k ? 'bg-white shadow-sm text-slate-800' : 'text-slate-500 hover:text-slate-700')}>{l}</button>
          ))}
        </div>
        <div className="ml-auto flex items-center gap-2">
          <ExportMenu table={exportTable} name="ctwa-ads" />
          <button onClick={onCreate} className="btn-primary text-xs inline-flex items-center gap-1.5"><Plus size={13} /> Create ad</button>
        </div>
      </div>

      {!ads.length ? (
        <div className="py-16 text-center">
          <p className="text-sm font-bold text-slate-700">No Click-to-WhatsApp ads yet</p>
          <p className="text-xs text-slate-400 mt-1 mb-4">Create your first ad and it will show up here with its results.</p>
          <button onClick={onCreate} className="btn-primary text-xs inline-flex items-center gap-1.5"><Plus size={13} /> Create ad</button>
        </div>
      ) : (
        <div className="overflow-auto max-h-[680px]">
          <table className="w-full text-xs border-separate border-spacing-0">
            <thead>
              <tr>
                <th className={clsx(th, 'left-0 z-20 min-w-[260px]')}>Ad</th>
                <th className={th}>Delivery</th>
                <th className={clsx(th, 'text-right')}>Daily budget</th>
                <th className={clsx(th, 'text-right')}>Spent</th>
                <th className={clsx(th, 'text-right')}>Impressions</th>
                <th className={clsx(th, 'text-right')}>Reach</th>
                <th className={clsx(th, 'text-right')}>Clicks</th>
                <th className={clsx(th, 'text-right')}>CTR</th>
                <th className={clsx(th, 'text-right')}>Conversations</th>
                <th className={clsx(th, 'text-right')}>Cost / conv.</th>
                <th className={clsx(th, 'text-right')}>Leads</th>
                <th className={clsx(th, 'text-right')}>Sales</th>
                <th className={th} />
              </tr>
            </thead>
            <tbody>
              {rows.map((a) => {
                const working = busy === a.id
                const editing = edit?.id === a.id
                return (
                  <tr key={a.id} className="border-b border-surface-border/70 hover:bg-slate-50/60">
                    <td className="px-3 py-3 sticky left-0 bg-white">
                      <div className="flex items-center gap-3">
                        <span className="w-11 h-11 rounded-lg bg-gradient-to-br from-emerald-100 to-sky-100 flex items-center justify-center overflow-hidden flex-shrink-0">
                          {a.imageUrl ? <img src={a.imageUrl} alt="" className="w-full h-full object-cover" /> : <ImageIcon size={16} className="text-slate-400" />}
                        </span>
                        <div className="min-w-0">
                          {editing && edit.field === 'name' ? (
                            <span className="flex items-center gap-1">
                              <input autoFocus value={edit.value} onChange={(e) => setEdit({ ...edit, value: e.target.value })} onKeyDown={onKey} aria-label="Ad name" className={clsx(inputCls, 'py-1 w-44')} />
                              <button onClick={save} aria-label="Save name" className="p-1 text-emerald-600"><Check size={13} /></button>
                              <button onClick={() => setEdit(null)} aria-label="Cancel" className="p-1 text-slate-400"><X size={13} /></button>
                            </span>
                          ) : (
                            <p className="font-semibold text-slate-800 truncate max-w-[240px] flex items-center gap-1.5"><button onClick={() => onOpenAd(a)} title="See this ad's leads and details" className="truncate text-left hover:text-primary hover:underline">{a.name}</button>
                              <button onClick={() => setEdit({ id: a.id, field: 'name', value: a.name })} aria-label={`Rename ${a.name}`} className="text-slate-300 hover:text-slate-600"><Pencil size={11} /></button>
                            </p>
                          )}
                          <p className="text-[10.5px] text-slate-400 truncate max-w-[240px]">{a.campaignName}</p>
                          <p className="text-[9.5px] text-slate-300 font-mono">ID {a.id}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex items-center gap-2">
                        {working ? <Loader2 size={14} className="animate-spin text-slate-400" /> : <Switch on={a.status === 'ACTIVE'} onChange={(on) => toggle(a, on)} label={`${a.status === 'ACTIVE' ? 'Pause' : 'Turn on'} ${a.name}`} />}
                        <StatusPill status={a.effectiveStatus} />
                      </div>
                    </td>
                    <td className={num_}>
                      {editing && edit.field === 'budget' ? (
                        <span className="inline-flex items-center gap-1">
                          <input autoFocus type="number" min="1" value={edit.value} onChange={(e) => setEdit({ ...edit, value: e.target.value })} onKeyDown={onKey} aria-label="Daily budget" className={clsx(inputCls, 'py-1 w-24 text-right')} />
                          <button onClick={save} aria-label="Save budget" className="p-1 text-emerald-600"><Check size={13} /></button>
                          <button onClick={() => setEdit(null)} aria-label="Cancel" className="p-1 text-slate-400"><X size={13} /></button>
                        </span>
                      ) : (
                        <button onClick={() => setEdit({ id: a.id, field: 'budget', value: String(a.dailyBudget ?? '') })} title="Change daily budget" className="hover:text-primary hover:underline">{money(a.dailyBudget, currency)}</button>
                      )}
                    </td>
                    <td className={num_}>{money(a.metrics.spend, currency)}</td>
                    <td className={num_}>{num(a.metrics.impressions)}</td>
                    <td className={num_}>{num(a.metrics.reach)}</td>
                    <td className={num_}>{num(a.metrics.clicks)}</td>
                    <td className={num_}>{pct(a.metrics.ctr)}</td>
                    <td className={clsx(num_, 'font-bold text-slate-900')}>{num(a.metrics.conversations)}</td>
                    <td className={num_}>{money(a.metrics.costPerConversation, currency, 2)}</td>
                    <td className={num_}><button onClick={() => onOpenAd(a)} title="See the leads from this ad" className="font-bold text-primary hover:underline">{num(stats(a).leads)}</button></td>
                    <td className={num_}>{stats(a).revenue ? money(stats(a).revenue, currency) : '—'}</td>
                    <td className="px-3 py-3 whitespace-nowrap text-right">
                      {confirm === a.id ? (
                        <span className="inline-flex items-center gap-1.5 text-[11px]">Archive?
                          <button onClick={() => archive(a)} className="font-semibold text-red-600 hover:underline">Yes</button>
                          <button onClick={() => setConfirm('')} className="font-semibold text-slate-500 hover:underline">No</button>
                        </span>
                      ) : (
                        <button onClick={() => setConfirm(a.id)} aria-label={`Archive ${a.name}`} title="Archive" className="p-1.5 rounded-lg text-slate-300 hover:text-red-500 hover:bg-red-50"><Archive size={13} /></button>
                      )}
                    </td>
                  </tr>
                )
              })}
              {!rows.length && <tr><td colSpan={13} className="py-10 text-center text-slate-400">No ads match.</td></tr>}
            </tbody>
            {rows.length > 0 && (
              <tfoot>
                <tr className="bg-slate-50 font-semibold text-slate-800">
                  <td className="px-3 py-2.5 sticky left-0 bg-slate-50">Total · {rows.length} {rows.length === 1 ? 'ad' : 'ads'}</td>
                  <td /><td />
                  <td className={num_}>{money(rows.reduce((n, a) => n + a.metrics.spend, 0), currency)}</td>
                  <td className={num_}>{num(rows.reduce((n, a) => n + a.metrics.impressions, 0))}</td>
                  <td className={num_}>{num(rows.reduce((n, a) => n + a.metrics.reach, 0))}</td>
                  <td className={num_}>{num(rows.reduce((n, a) => n + a.metrics.clicks, 0))}</td>
                  <td className={num_}>{pct(sum.impressions ? (sum.clicks / sum.impressions) * 100 : null)}</td>
                  <td className={num_}>{num(sum.conversations)}</td>
                  <td className={num_}>{money(sum.conversations ? sum.spend / sum.conversations : null, currency, 2)}</td>
                  <td className={num_}>{num(rows.reduce((n, a) => n + stats(a).leads, 0))}</td>
                  <td className={num_}>{money(rows.reduce((n, a) => n + stats(a).revenue, 0), currency)}</td>
                  <td />
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      )}
    </Card>
  )
}
