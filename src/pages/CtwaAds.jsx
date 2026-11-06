import { useCallback, useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Megaphone, RefreshCw, Plus, FlaskConical, Radio, X } from 'lucide-react'
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
import { Banner, Spinner } from '../components/ctwa/ui'

const TABS = [['overview', 'Overview'], ['ads', 'Ads'], ['create', 'Create ad'], ['leads', 'Leads'], ['setup', 'Setup']]
const RANGES = [[7, 'Last 7 days'], [30, 'Last 30 days'], [90, 'Last 90 days']]

/** Click-to-WhatsApp ads: performance, creating and managing ads, the leads they bring in, and the Meta connection. */
export default function CtwaAds() {
  const [params, setParams] = useSearchParams()
  const tab = TABS.some(([k]) => k === params.get('tab')) ? params.get('tab') : 'overview'
  const setTab = (k) => setParams(k === 'overview' ? {} : { tab: k }, { replace: true })

  const [days, setDays] = useState(30)
  const [dash, setDash] = useState(null)
  const [leads, setLeads] = useState(null)       // { leads, capiLive, mode }
  const [pageName, setPageName] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [notice, setNotice] = useState(null)
  const [openAdId, setOpenAdId] = useState(null)
  const timer = useRef(null)

  const notify = useCallback((message, tone = 'ok') => {
    setNotice({ message, tone }); clearTimeout(timer.current); timer.current = setTimeout(() => setNotice(null), 5000)
  }, [])

  const load = useCallback(async () => {
    setError('')
    try {
      const [start, end] = lastDays(days)
      const [d, l] = await Promise.all([ctwa.dashboard(start, end), ctwa.leads()])
      setDash(d); setLeads(l)
    } catch (e) { setError(e.message) } finally { setLoading(false) }
  }, [days])

  useEffect(() => { setLoading(true); load() }, [load])
  // connecting, choosing or disconnecting an account changes what the ads and leads show
  const meta = useMetaConnection(() => { setLoading(true); load() })
  useEffect(() => { ctwa.status().then((s) => setPageName(s.page?.name || '')).catch(() => {}) }, [])
  useEffect(() => () => clearTimeout(timer.current), [])

  const data = dash && { ...dash, pageName }
  const showRange = tab === 'overview' || tab === 'ads'

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="flex flex-wrap items-center gap-3">
        <span className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center"><Megaphone size={17} /></span>
        <div className="min-w-0">
          <h1 className="text-base font-bold text-slate-900 leading-tight">Click to WhatsApp Ads</h1>
          <p className="text-[11px] text-slate-500">Ads on Facebook and Instagram that open a chat with you on WhatsApp</p>
        </div>
        {dash && (
          <span className={clsx('inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10.5px] font-bold', dash.mode === 'live' ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700')}>
            {dash.mode === 'live' ? <Radio size={11} /> : <FlaskConical size={11} />}{dash.mode === 'live' ? 'Live' : 'Sample data'}
          </span>
        )}
        <div className="ml-auto flex items-center gap-2">
          {showRange && (
            <select value={days} onChange={(e) => setDays(Number(e.target.value))} aria-label="Date range" className="rounded-lg border border-surface-border bg-white px-2.5 py-1.5 text-xs text-slate-700 outline-none focus:border-primary">
              {RANGES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          )}
          <button onClick={() => { setLoading(true); load() }} aria-label="Refresh" title="Refresh" className="p-2 rounded-lg border border-surface-border bg-white text-slate-500 hover:text-primary hover:border-primary"><RefreshCw size={13} className={clsx(loading && 'animate-spin')} /></button>
          <button onClick={() => setTab('create')} className="btn-primary text-xs inline-flex items-center gap-1.5"><Plus size={13} /> Create ad</button>
        </div>
      </div>

      <nav className="flex gap-1 border-b border-surface-border overflow-x-auto" role="tablist" aria-label="CTWA sections">
        {TABS.map(([k, l]) => (
          <button key={k} role="tab" aria-selected={tab === k} onClick={() => setTab(k)}
            className={clsx('px-3.5 py-2.5 text-xs font-semibold border-b-2 -mb-px whitespace-nowrap transition-colors', tab === k ? 'border-primary text-primary' : 'border-transparent text-slate-500 hover:text-slate-700')}>
            {l}{k === 'ads' && dash ? <span className="ml-1.5 text-[10px] text-slate-400">{dash.ads.length}</span> : null}{k === 'leads' && leads ? <span className="ml-1.5 text-[10px] text-slate-400">{leads.leads.length}</span> : null}
          </button>
        ))}
      </nav>

      {notice && (
        <Banner tone={notice.tone === 'error' ? 'error' : 'ok'} action={<button onClick={() => setNotice(null)} aria-label="Dismiss" className="p-0.5 opacity-60 hover:opacity-100"><X size={14} /></button>}>{notice.message}</Banner>
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
        : tab === 'overview' ? <Overview data={data} />
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
