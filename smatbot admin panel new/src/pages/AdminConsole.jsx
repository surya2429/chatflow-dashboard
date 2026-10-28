// AdminConsole.jsx — SmatBot's admin panel: the dashboard, every client, active clients, adding a
// subscription, renewals, coupons and the team. Each section has its own #/link, and a list's
// filters can ride along (#/active?plan=pro), so the dashboard can open a list already filtered.
// Its own app, separate from the customer dashboard. Staff sign in with their own email and password
// (the owner's is BILLING_ADMIN_EMAIL / BILLING_ADMIN_PASSWORD on the server), and the server checks the
// token and the employee's role on every request — hiding a button here is only a convenience.
import { useState, useEffect } from 'react'
import clsx from 'clsx'
import { Lock, Loader2, ShieldCheck, Users, UserCheck, PlusCircle, LayoutDashboard, CalendarClock, Tag, UserCog, LogOut, RefreshCw } from 'lucide-react'
import { billing, billingAdmin, DASHBOARD_URL } from '../lib/billingApi'
import DashboardTab from '../components/admin/DashboardTab'
import ClientsTab from '../components/admin/ClientsTab'
import AddSubscriptionPage from '../components/admin/AddSubscriptionPage'
import RenewalsTab from '../components/admin/RenewalsTab'
import CouponsTab from '../components/admin/CouponsTab'
import TeamTab from '../components/admin/TeamTab'
import ClientDrawer from '../components/admin/ClientDrawer'
import SubscriptionDialog from '../components/admin/SubscriptionDialog'
import { inputCls, labelCls, fmtDate, daysFromNow } from '../components/admin/ui'

const TOKEN_KEY = 'smatbot-admin-token'
const readToken = () => { try { return sessionStorage.getItem(TOKEN_KEY) || '' } catch { return '' } }
const saveToken = (t) => { try { t ? sessionStorage.setItem(TOKEN_KEY, t) : sessionStorage.removeItem(TOKEN_KEY) } catch { /* storage blocked: the session lasts for this page only */ } }

const TABS = [
  { id: 'dashboard', label: 'Dashboard',        icon: LayoutDashboard, sub: 'Revenue, clients and renewals at a glance' },
  { id: 'clients',   label: 'All clients',      icon: Users,           sub: 'Every client, with their plan, value and type' },
  { id: 'active',    label: 'Active clients',   icon: UserCheck,       sub: 'Clients on a live plan right now' },
  { id: 'add',       label: 'Add subscription', icon: PlusCircle,      sub: 'Every subscription added from this panel, and a button to add one' },
  { id: 'renewals',  label: 'Renewals',         icon: CalendarClock,   sub: 'Who pays next, when and how much' },
  { id: 'coupons',   label: 'Coupons',          icon: Tag,             sub: 'Discount codes customers use at checkout' },
  { id: 'team',      label: 'Team',             icon: UserCog,         sub: 'Staff who can sign in to this panel', adminOnly: true },
]
const ROLE_LABEL = { owner: 'Owner', admin: 'Admin', support: 'Support' }
const live = (c) => c.status === 'active' || c.status === 'past_due'

/* #/active?plan=pro → { page: 'active', params: { plan: 'pro' } } */
function readHash() {
  const [path, query = ''] = window.location.hash.replace(/^#\/?/, '').split('?')
  return { page: path || 'dashboard', params: Object.fromEntries(new URLSearchParams(query)), hash: window.location.hash }
}
const go = (page, params) => { window.location.hash = `/${page}${params ? `?${new URLSearchParams(params)}` : ''}` }

export default function AdminConsole() {
  const [token, setToken]         = useState(readToken)
  const [me, setMe]               = useState(null)
  const [customers, setCustomers] = useState(null)
  const [addonDefs, setAddonDefs] = useState([])
  const [plans, setPlans]         = useState([])
  const [states, setStates]       = useState([])
  const [sac, setSac]             = useState('998314')
  const [gst, setGst]             = useState(18)
  const [loading, setLoading]     = useState(false)
  const [loadError, setLoadError] = useState('')
  const [email, setEmail]         = useState('')
  const [password, setPassword]   = useState('')
  const [route, setRoute]         = useState(readHash)
  const [openWs, setOpenWs]       = useState(null)
  const [assigning, setAssigning] = useState(undefined)   // undefined: closed · null: new customer · row: change that client's plan
  const [rev, setRev]             = useState(0)           // bumps after a change so an open client panel reloads
  const [toast, setToast]         = useState('')

  function signOut(message = '') {
    setToken(''); saveToken(''); setMe(null); setCustomers(null); setLoadError(message)
    setOpenWs(null); setAssigning(undefined)
  }

  async function load(t) {
    setLoading(true); setLoadError('')
    try {
      const [who, list, cfg, cat] = await Promise.all([billingAdmin.me(t), billingAdmin.customers(t), billing.config(), billingAdmin.catalog(t)])
      setMe(who); setCustomers(list.items); setStates(cfg.states || []); if (cfg.sac) setSac(cfg.sac); if (cfg.gstPercent) setGst(cfg.gstPercent)
      setPlans(cat.catalog.plans); setAddonDefs(cat.catalog.addons)
      setToken(t); saveToken(t)
    } catch (e) {
      signOut(e.status === 401 ? 'Your session has ended. Please sign in again.' : e.message)
    } finally { setLoading(false) }
  }
  useEffect(() => { if (token) load(token) }, [])   // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    const on = () => setRoute(readHash())
    window.addEventListener('hashchange', on)
    return () => window.removeEventListener('hashchange', on)
  }, [])

  async function signIn(e) {
    e.preventDefault()
    setLoading(true); setLoadError('')
    try {
      const { token: t } = await billingAdmin.login(email.trim(), password)
      setPassword('')
      await load(t)
    } catch (err) {
      setLoadError(err.message)
      setLoading(false)
    }
  }

  async function reload() {
    try {
      setCustomers((await billingAdmin.customers(token)).items)
      setRev((r) => r + 1)
    } catch (e) {
      if (e.status === 401) signOut('Your session has ended. Please sign in again.')
    }
  }

  function flash(text) {
    setToast(text)
    setTimeout(() => setToast(''), 5000)
  }

  /* Open the customer's own dashboard as them, in this tab. The server issues a 2-minute ticket
     (logged); the dashboard swaps it for the customer and shows a banner with the way back here.
     The ticket travels in the #fragment, so it never reaches a server log. */
  async function loginAsCustomer(c) {
    try {
      const { ticket } = await billingAdmin.impersonate(token, c.workspaceId)
      window.location.assign(`${DASHBOARD_URL}/staff-login#ticket=${encodeURIComponent(ticket)}`)
    } catch (e) {
      if (e.status === 401) signOut('Your session has ended. Please sign in again.')
      else flash(e.message)
    }
  }

  /* ── signed out ── */
  if (!me || !customers) return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <form onSubmit={signIn} className="w-full max-w-sm bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
        <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center mb-4"><Lock size={18}/></div>
        <h1 className="text-lg font-bold text-slate-900">SmatBot admin</h1>
        <p className="text-sm text-slate-500 mt-1 mb-5">Sign in with your SmatBot staff account.</p>
        <label htmlFor="admin-email" className={labelCls}>Email</label>
        <input id="admin-email" type="email" autoComplete="username" autoFocus required value={email}
          onChange={(e) => setEmail(e.target.value)} className={inputCls}/>
        <label htmlFor="admin-password" className={clsx(labelCls, 'mt-3')}>Password</label>
        <input id="admin-password" type="password" autoComplete="current-password" required value={password}
          onChange={(e) => setPassword(e.target.value)} className={inputCls}/>
        {loadError && <p role="alert" className="text-xs text-red-600 mt-2">{loadError}</p>}
        <button type="submit" disabled={loading || !email.trim() || !password}
          className="mt-4 w-full bg-primary text-white rounded-lg py-2.5 text-sm font-semibold disabled:opacity-50 flex items-center justify-center gap-2">
          {loading && <Loader2 size={14} className="animate-spin"/>} Sign in
        </button>
      </form>
    </div>
  )

  /* ── signed in ── */
  const canEdit = me.role !== 'support'
  const tabs = TABS.filter((t) => !t.adminOnly || canEdit)
  const tab = tabs.find((t) => t.id === route.page) || tabs[0]   // an unknown or not-allowed link opens the dashboard
  const counts = {
    clients: customers.length,
    active: customers.filter(live).length,
    renewals: customers.filter((c) => c.renewal && daysFromNow(c.renewal.at) <= 30).length,
    add: customers.filter((c) => (c.source === 'staff' && c.plan) || c.nextSub).length,
  }
  const signedOut = () => signOut('Your session has ended. Please sign in again.')
  const renewed = (row) => { reload(); flash(`Cycle ${row.subscription?.billed} of ${row.subscription?.number} recorded — ${row.customer || row.workspaceId} runs until ${fmtDate(row.currentEnd)}.`) }
  const subscribed = (row) => {
    reload()
    flash(row.nextSub
      ? `${row.nextSub.planName} (${row.nextSub.period}) scheduled for ${row.customer || row.workspaceId}, starting ${fmtDate(row.nextSub.at)}.`
      : `${row.planName} (${row.period}) given to ${row.customer || row.workspaceId} until ${fmtDate(row.currentEnd)}.`)
  }

  const nav = (vertical) => tabs.map((t) => (
    <a key={t.id} href={`#/${t.id}`} aria-current={tab.id === t.id ? 'page' : undefined}
      className={clsx('flex items-center gap-2.5 text-sm font-semibold whitespace-nowrap transition-colors',
        vertical
          ? clsx('px-3 py-2 rounded-lg', tab.id === t.id ? 'bg-primary/10 text-primary' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900')
          : clsx('px-3 py-2.5 border-b-2 -mb-px', tab.id === t.id ? 'border-primary text-primary' : 'border-transparent text-slate-500 hover:text-slate-800'))}>
      <t.icon size={16} className="flex-shrink-0"/>
      <span className="flex-1">{t.label}</span>
      {vertical && counts[t.id] > 0 && <span className="text-[11px] font-semibold text-slate-400 tabular-nums">{counts[t.id]}</span>}
    </a>
  ))

  return (
    <div className="min-h-screen bg-slate-50 lg:pl-60">
      {/* sidebar (desktop) */}
      <aside className="hidden lg:flex flex-col fixed inset-y-0 left-0 w-60 bg-white border-r border-slate-200 z-30">
        <div className="flex items-center gap-2 px-5 h-14 border-b border-slate-100">
          <ShieldCheck size={20} className="text-primary"/><span className="font-bold text-slate-900">SmatBot admin</span>
        </div>
        <nav aria-label="Admin sections" className="flex-1 overflow-y-auto p-3 space-y-0.5">{nav(true)}</nav>
        <div className="p-4 border-t border-slate-100">
          <div className="text-xs font-semibold text-slate-800 truncate">{me.name}</div>
          <div className="text-[11px] text-slate-400 truncate">{ROLE_LABEL[me.role]} · {me.email}</div>
          <button type="button" onClick={() => signOut()} className="mt-2 inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-800">
            <LogOut size={14}/> Sign out
          </button>
        </div>
      </aside>

      {/* top bar (phones and tablets) */}
      <header className="lg:hidden bg-white border-b border-slate-200 sticky top-0 z-30">
        <div className="px-4 pt-3 flex items-center gap-3">
          <ShieldCheck size={20} className="text-primary flex-shrink-0"/>
          <span className="font-bold text-slate-900 flex-1 min-w-0 truncate">SmatBot admin</span>
          <button type="button" onClick={() => signOut()} className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-800">
            <LogOut size={14}/> Sign out
          </button>
        </div>
        <nav aria-label="Admin sections" className="px-2 flex items-center overflow-x-auto">{nav(false)}</nav>
      </header>

      <main className="max-w-[1400px] mx-auto px-4 lg:px-6 py-5 space-y-4">
        <div className="flex items-start gap-3">
          <div className="flex-1 min-w-0">
            <h1 className="text-xl font-bold text-slate-900">{tab.label}</h1>
            <p className="text-sm text-slate-500">{tab.sub}</p>
          </div>
          {!['coupons', 'team'].includes(tab.id) && (
            <button type="button" onClick={reload} aria-label="Refresh" title="Refresh" className="p-2 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-white"><RefreshCw size={15}/></button>
          )}
        </div>

        {tab.id === 'dashboard' && <DashboardTab token={token} customers={customers} rev={rev} onOpen={setOpenWs} onFilter={go} onAuthLost={signedOut}/>}
        {tab.id === 'clients'   && <ClientsTab key={route.hash} customers={customers} initialFilters={route.params} canEdit={canEdit} onOpen={setOpenWs} onAssign={setAssigning} onLoginAs={loginAsCustomer}/>}
        {tab.id === 'active'    && <ClientsTab key={route.hash} activeOnly customers={customers} initialFilters={route.params} canEdit={canEdit} onOpen={setOpenWs} onAssign={setAssigning} onLoginAs={loginAsCustomer}/>}
        {tab.id === 'add'       && <AddSubscriptionPage token={token} customers={customers} plans={plans} addonDefs={addonDefs} states={states} sac={sac} gstPercent={gst} canEdit={canEdit}
          onOpen={setOpenWs} onAssign={setAssigning} onDone={subscribed} onRenewed={renewed}
          onUnscheduled={(row) => { reload(); flash(`The scheduled subscription for ${row.customer || row.workspaceId} was cancelled.`) }}/>}
        {tab.id === 'renewals'  && <RenewalsTab key={route.hash} token={token} customers={customers} initialFilters={route.params} canEdit={canEdit} onOpen={setOpenWs}
          onRenewed={renewed}/>}
        {tab.id === 'coupons'   && <CouponsTab token={token} canEdit={canEdit} plans={plans} addonDefs={addonDefs}/>}
        {tab.id === 'team'      && <TeamTab token={token} me={me}/>}
      </main>

      {openWs && (
        <ClientDrawer key={`${openWs}:${rev}`} token={token} workspaceId={openWs} customers={customers} canEdit={canEdit}
          onClose={() => setOpenWs(null)} onAssign={setAssigning} onLoginAs={loginAsCustomer} onChanged={reload}/>
      )}
      {assigning !== undefined && (
        <SubscriptionDialog token={token} initial={assigning} plans={plans} addonDefs={addonDefs} states={states} sac={sac} gstPercent={gst} onClose={() => setAssigning(undefined)}
          onDone={(row) => { setAssigning(undefined); subscribed(row) }}/>
      )}
      {toast && (
        <div role="status" className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[60] bg-slate-900 text-white text-sm rounded-xl px-4 py-2.5 shadow-xl max-w-[90vw]">{toast}</div>
      )}
    </div>
  )
}
