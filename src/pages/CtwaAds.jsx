import { useCallback, useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { RefreshCw, Plus, X, LayoutDashboard, Megaphone, Users, Settings2, Sparkles } from 'lucide-react'
import clsx from 'clsx'
import { ctwa, lastDays } from '../lib/ctwaApi'
import Overview from '../components/ctwa/Overview'
import AdsTable from '../components/ctwa/AdsTable'
import AdDetail from '../components/ctwa/AdDetail'
import CreateAd from '../components/ctwa/CreateAd'
import Leads from '../components/ctwa/Leads'
import Setup from '../components/ctwa/Setup'
import { ConnectButton } from '../components/ctwa/ConnectMeta'
import { useMetaConnection } from '../components/ctwa/useMetaConnection'
import { NativeSelect } from '../components/Select'
import { Banner, Spinner } from '../components/ctwa/ui'

const TABS = [['overview', 'Overview', LayoutDashboard], ['ads', 'Ads', Megaphone], ['create', 'Create ad', Sparkles], ['leads', 'Leads', Users], ['setup', 'Setup', Settings2]]
const RANGES = [[7, 'Last 7 days'], [30, 'Last 30 days'], [90, 'Last 90 days']]

/** Click-to-WhatsApp ads: performance, creating and managing ads, the leads they bring in, and the Meta connection. */
export default function CtwaAds() {
  const [params, setParams] = useSearchParams()
  const tab = TABS.some(([k]) => k === params.get('tab')) ? params.get('tab') : 'overview'
  const setTab = (k) => setParams(k === 'overview' ? {} : { tab: k }, { replace: true })

  const [days, setDays] = useState(30)
  const [dash, setDash] = useState(null)
  const [prev, setPrev] = useState(null)       // the period just before, for "vs previous period"
  const [leads, setLeads] = useState(null)       // { leads, capiLive, mode }
  const [pageName, setPageName] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [notice, setNotice] = useState(null)
  const [openAdId, setOpenAdId] = useState(null)
  const [syncing, setSyncing] = useState(false)
  const [syncedAt, setSyncedAt] = useState(null)
  const timer = useRef(null)

  const notify = useCallback((message, tone = 'ok') => {
    setNotice({ message, tone }); clearTimeout(timer.current); timer.current = setTimeout(() => setNotice(null), 5000)
  }, [])

  const load = useCallback(async () => {
    setError('')
    try {
      const [start, end] = lastDays(days)
      const [d, l] = await Promise.all([ctwa.dashboard(start, end), ctwa.leads()])
      setDash(d); setLeads(l); setSyncedAt(new Date())
      ctwa.dashboard(start - days * 86400, start).then(setPrev).catch(() => setPrev(null))      // a comparison is nice to have, never a reason to fail
      return { d, l }
    } catch (e) { setError(e.message) } finally { setLoading(false) }
  }, [days])

  // Ads are read from Meta on every load, so syncing is a fresh pull of the ads, their results and the leads
  const sync = async () => {
    setSyncing(true)
    const r = await load()
    setSyncing(false)
    if (!r) return notify('Could not sync with Meta. Check the connection in Setup and try again.', 'error')
    notify(r.d.mode === 'live' ? `Synced from Meta: ${r.d.ads.length} ${r.d.ads.length === 1 ? 'ad' : 'ads'} and ${r.l.leads.length} leads.` : 'Refreshed the sample data. Connect Facebook in Setup to sync your real ads from Meta.', r.d.mode === 'live' ? 'ok' : 'info')
  }

  useEffect(() => { setLoading(true); load() }, [load])
  // connecting, choosing or disconnecting an account changes what the ads and leads show
  const meta = useMetaConnection(() => { setLoading(true); load() })
  useEffect(() => { ctwa.status().then((s) => setPageName(s.page?.name || '')).catch(() => {}) }, [])
  useEffect(() => () => clearTimeout(timer.current), [])

  const data = dash && { ...dash, pageName }
  const showRange = tab === 'overview' || tab === 'ads'

  return (
    <div className="space-y-4 animate-fade-in">
      {/* Header, in the same layout as Broadcasts */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 mb-0.5">
            <h1 className="text-[15px] font-bold text-slate-900">Click to WhatsApp Ads</h1>
            {dash && <span className="text-[10px] font-bold bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full">{dash.ads.length} {dash.ads.length === 1 ? 'ad' : 'ads'}</span>}
            {dash && <span className={clsx('text-[10px] font-bold px-2 py-0.5 rounded-full', dash.mode === 'live' ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700')}>{dash.mode === 'live' ? 'Live' : 'Sample data'}</span>}
          </div>
          <p className="text-[11px] text-slate-400">Ads on Facebook and Instagram that open a chat with you on WhatsApp</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {showRange && (
            <NativeSelect value={days} onChange={(e) => setDays(Number(e.target.value))} sm className="!w-36">
              {RANGES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </NativeSelect>
          )}
          {syncedAt && <span className="hidden md:inline text-[10.5px] text-slate-400 whitespace-nowrap">Synced {syncedAt.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' })}</span>}
          <button onClick={sync} disabled={syncing} title="Pull the latest ads, results and leads from Meta"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-primary/30 bg-primary-50 text-primary text-xs font-semibold hover:bg-primary-100 hover:border-primary/50 transition-colors whitespace-nowrap disabled:opacity-60">
            <RefreshCw size={12} className={clsx(syncing && 'animate-spin')} /> {syncing ? 'Syncing…' : 'Sync from Meta'}
          </button>
          <button onClick={() => setTab('create')} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary text-white text-xs font-semibold hover:bg-primary-hover transition-colors shadow-sm whitespace-nowrap"><Plus size={13} /> Create ad</button>
        </div>
      </div>

      <div className="flex items-center gap-0.5 bg-slate-100 p-1 rounded-xl w-fit max-w-full overflow-x-auto" role="tablist" aria-label="CTWA sections">
        {TABS.map(([k, l, Icon]) => (
          <button key={k} role="tab" aria-selected={tab === k} onClick={() => setTab(k)}
            className={clsx('flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-all whitespace-nowrap', tab === k ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700')}>
            <Icon size={12} /> {l}{k === 'leads' && leads ? <span className="text-[10px] text-slate-400">{leads.leads.length}</span> : null}
          </button>
        ))}
      </div>

      {notice && (
        <Banner tone={notice.tone === 'error' ? 'error' : notice.tone === 'info' ? 'info' : 'ok'} action={<button onClick={() => setNotice(null)} aria-label="Dismiss" className="p-0.5 opacity-60 hover:opacity-100"><X size={14} /></button>}>{notice.message}</Banner>
      )}
      {dash?.mode === 'sample' && tab !== 'setup' && (
        <Banner tone="info" action={
          meta.conn?.needsSelection ? <button onClick={() => setTab('setup')} className="font-semibold underline whitespace-nowrap">Choose account</button>
          : meta.canConnect ? <ConnectButton meta={meta} label="Connect Facebook" className="!py-1.5 whitespace-nowrap" />
          : <button onClick={() => setTab('setup')} className="font-semibold underline whitespace-nowrap">How to connect</button>}>
          {meta.conn?.needsSelection
            ? 'Facebook is connected. Choose which ad account and Page to use and your real ads will appear here.'
            : 'You are looking at sample data. Create, pause and edit ads to try everything; nothing reaches Meta until you connect your Facebook ads account.'}
        </Banner>
      )}
      {meta.error && tab !== 'setup' && <Banner tone="error" action={<button onClick={meta.clearError} className="font-semibold underline">Dismiss</button>}>{meta.error}</Banner>}

      {tab === 'setup' ? <Setup meta={meta} />
        : error ? <Banner tone="error" action={<button onClick={() => { setLoading(true); load() }} className="font-semibold underline">Try again</button>}>{error}</Banner>
        : !data ? <Spinner />
        : tab === 'overview' ? <Overview data={data} prev={prev} leads={leads?.leads} rangeLabel={RANGES.find(([v]) => v === days)?.[1]} onOpenAd={(a) => setOpenAdId(a.id)} onGoLeads={() => setTab('leads')} />
        : tab === 'ads' ? <AdsTable data={data} reload={load} notify={notify} onCreate={() => setTab('create')} onOpenAd={(a) => setOpenAdId(a.id)} />
        : tab === 'create' ? <CreateAd data={data} notify={notify} onDone={() => { load(); setTab('ads') }} />
        : <Leads leads={leads?.leads ?? []} ads={data.ads} currency={data.currency} mode={leads?.mode} capiLive={leads?.capiLive} reload={load} notify={notify} />}
      {data?.ads.find((a) => a.id === openAdId) && (
        <AdDetail ad={data.ads.find((a) => a.id === openAdId)} stats={data.leadStats?.[openAdId]} currency={data.currency} mode={data.mode} capiLive={leads?.capiLive}
          rangeLabel={RANGES.find(([v]) => v === days)?.[1]} onClose={() => setOpenAdId(null)} onChanged={load} notify={notify} />
      )}
    </div>
  )
}
