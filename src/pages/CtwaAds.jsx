import { useCallback, useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Facebook, FlaskConical, Megaphone, Plus, Radio, RefreshCw, Settings2, Users, X } from 'lucide-react'
import clsx from 'clsx'
import { ctwa, lastDays } from '../lib/ctwaApi'
import { NativeSelect } from '../components/Select'
import AdInsights from '../components/ctwa/AdInsights'
import AdsView from '../components/ctwa/AdsView'
import CreateAdModal from '../components/ctwa/CreateAdModal'
import EditAdModal from '../components/ctwa/EditAdModal'
import Leads from '../components/ctwa/Leads'
import Setup from '../components/ctwa/Setup'
import { useMetaConnection } from '../components/ctwa/useMetaConnection'
import { Banner, btnGhost, btnOutline, btnPrimary, Segmented, Spinner } from '../components/ctwa/ui'

const RANGES = [[7, 'Last 7 days'], [30, 'Last 30 days'], [90, 'Last 90 days']]
const SECTIONS = ['ads', 'leads', 'setup']

/** Click-to-WhatsApp ads: laid out like Broadcasting. A list of ads with their results, one ad's own page, the leads they
    bring in, and the Facebook connection. */
export default function CtwaAds() {
  const [params, setParams] = useSearchParams()
  const section = SECTIONS.includes(params.get('tab')) ? params.get('tab') : 'ads'
  const adId = params.get('ad')
  const go = (next) => setParams(next, { replace: true })
  const setSection = (k) => go(k === 'ads' ? {} : { tab: k })
  const openAd = (a) => go({ ad: a.id })

  const [days, setDays] = useState(30)
  const [dash, setDash] = useState(null)
  const [leads, setLeads] = useState(null)       // { leads, capiLive, mode }
  const [pageName, setPageName] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [notice, setNotice] = useState(null)
  const [creating, setCreating] = useState(false)
  const [editing, setEditing] = useState(null)
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
  const refresh = () => { setLoading(true); load() }

  useEffect(() => { setLoading(true); load() }, [load])
  // connecting, choosing or disconnecting an account changes what the ads and leads show
  const meta = useMetaConnection(refresh)
  useEffect(() => { ctwa.status().then((s) => setPageName(s.page?.name || '')).catch(() => {}) }, [meta.conn?.connected])
  useEffect(() => () => clearTimeout(timer.current), [])

  const data = dash && { ...dash, pageName }
  const ad = data?.ads.find((a) => a.id === adId)
  const rangeLabel = RANGES.find(([v]) => v === days)?.[1]
  const toggleAd = async (a, on) => {
    try { await ctwa.updateAd(a.id, { status: on ? 'ACTIVE' : 'PAUSED' }); notify(on ? `“${a.name}” is on.` : `“${a.name}” is paused.`, 'ok'); await load() } catch (e) { notify(e.message, 'error') }
  }

  const banners = (
    <>
      {notice && <Banner tone={notice.tone === 'error' ? 'error' : 'ok'} action={<button onClick={() => setNotice(null)} aria-label="Dismiss" className="p-0.5 opacity-60 hover:opacity-100"><X size={14} /></button>}>{notice.message}</Banner>}
      {dash?.mode === 'sample' && section !== 'setup' && (
        <Banner tone="info" action={
          meta.conn?.needsSelection ? <button onClick={() => setSection('setup')} className="font-semibold underline whitespace-nowrap">Choose account</button>
          : meta.canConnect ? <button onClick={meta.connect} disabled={!!meta.busy} className={btnOutline}><Facebook size={12} fill="currentColor" /> Connect Facebook</button>
          : <button onClick={() => setSection('setup')} className="font-semibold underline whitespace-nowrap">How to connect</button>}>
          {meta.conn?.needsSelection ? 'Facebook is connected. Choose which ad account and Page to use and your real ads will appear here.'
            : 'You are looking at sample data. Create, pause and edit ads to try everything; nothing reaches Meta until you connect your Facebook ads account.'}
        </Banner>
      )}
      {meta.error && section !== 'setup' && <Banner tone="error" action={<button onClick={meta.clearError} className="font-semibold underline">Dismiss</button>}>{meta.error}</Banner>}
    </>
  )

  const modals = (
    <>
      {creating && <CreateAdModal data={data} notify={notify} onClose={() => setCreating(false)} onCreated={(id) => { setCreating(false); load(); go({ ad: id }) }} />}
      {editing && <EditAdModal ad={editing} currency={data.currency} notify={notify} onClose={() => setEditing(null)} onSaved={load} />}
    </>
  )

  // one ad's own page
  if (adId && data && ad && section === 'ads') {
    return (
      <div className="space-y-5 animate-fade-in">
        {banners}
        <AdInsights ad={ad} stats={data.leadStats?.[ad.id]} currency={data.currency} mode={data.mode} capiLive={leads?.capiLive} rangeLabel={rangeLabel}
          onBack={() => go({})} onEdit={setEditing} onToggle={toggleAd} onChanged={load} notify={notify} />
        {modals}
      </div>
    )
  }

  const count = section === 'leads' ? `${leads?.leads.length ?? 0} leads` : section === 'setup' ? (meta.conn?.connected ? 'connected' : 'not connected') : `${dash?.ads.length ?? 0} ads`
  return (
    <div className="space-y-5 animate-fade-in">
      {/* ── Header ── */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 mb-0.5">
            <h1 className="text-[15px] font-bold text-slate-900">{section === 'leads' ? 'Leads from Ads' : section === 'setup' ? 'Ads Setup' : 'Click to WhatsApp Ads'}</h1>
            <span className="text-[10px] font-bold bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full">{count}</span>
            {dash && (
              <span className={clsx('inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full', dash.mode === 'live' ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700')}>
                {dash.mode === 'live' ? <Radio size={10} /> : <FlaskConical size={10} />}{dash.mode === 'live' ? 'Live' : 'Sample data'}
              </span>
            )}
          </div>
          <p className="text-[11px] text-slate-400">{section === 'leads' ? 'Everyone who started a WhatsApp chat from one of your ads' : section === 'setup' ? 'Connect your Facebook ads account' : 'Ads on Facebook and Instagram that open a chat with you on WhatsApp'}</p>
        </div>
        <div className="flex items-center gap-2 flex-nowrap">
          {section !== 'setup' && (
            <NativeSelect value={days} onChange={(e) => setDays(Number(e.target.value))} sm>
              {RANGES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </NativeSelect>
          )}
          <button onClick={refresh} aria-label="Refresh" title="Refresh" className={btnGhost}><RefreshCw size={12} className={clsx(loading && 'animate-spin')} /></button>
          {meta.conn && !meta.conn.connected && meta.canConnect && <button onClick={meta.connect} disabled={!!meta.busy} className={btnOutline}><Facebook size={12} fill="currentColor" /> Connect Facebook</button>}
          <button onClick={() => setCreating(true)} className={btnPrimary}><Plus size={13} /> Create Ad</button>
        </div>
      </div>

      <Segmented value={section} onChange={setSection} options={[
        { key: 'ads', label: 'Ads', icon: Megaphone }, { key: 'leads', label: 'Leads', icon: Users }, { key: 'setup', label: 'Setup', icon: Settings2 },
      ]} />

      {banners}

      {section === 'setup' ? <Setup meta={meta} />
        : error ? <Banner tone="error" action={<button onClick={refresh} className="font-semibold underline">Try again</button>}>{error}</Banner>
        : !data ? <Spinner />
        : section === 'ads' ? <AdsView data={data} reload={load} notify={notify} onCreate={() => setCreating(true)} onOpenAd={openAd} onEditAd={setEditing} />
        : <Leads leads={leads?.leads ?? []} ads={data.ads} currency={data.currency} mode={leads?.mode} capiLive={leads?.capiLive} reload={load} notify={notify} />}

      {modals}
    </div>
  )
}
