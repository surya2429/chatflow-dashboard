// AdminConsole.jsx — SmatBot's admin panel: every client, renewals, coupons and the team.
// Its own app, separate from the customer dashboard. Staff sign in with their own email and password
// (the owner's is BILLING_ADMIN_EMAIL / BILLING_ADMIN_PASSWORD on the server), and the server checks the
// token and the employee's role on every request — hiding a button here is only a convenience.
import { useState, useEffect } from 'react'
import clsx from 'clsx'
import { Lock, Loader2, ShieldCheck, Users, CalendarClock, Tag, UserCog, LogOut, RefreshCw } from 'lucide-react'
import { billing, billingAdmin, DASHBOARD_URL } from '../lib/billingApi'
import ClientsTab from '../components/admin/ClientsTab'
import RenewalsTab from '../components/admin/RenewalsTab'
import CouponsTab from '../components/admin/CouponsTab'
import TeamTab from '../components/admin/TeamTab'
import ClientDrawer from '../components/admin/ClientDrawer'
import SubscriptionDialog from '../components/admin/SubscriptionDialog'
import { inputCls, labelCls, fmtDate } from '../components/admin/ui'

const TOKEN_KEY = 'smatbot-admin-token'
const readToken = () => { try { return sessionStorage.getItem(TOKEN_KEY) || '' } catch { return '' } }
const saveToken = (t) => { try { t ? sessionStorage.setItem(TOKEN_KEY, t) : sessionStorage.removeItem(TOKEN_KEY) } catch { /* storage blocked: the session lasts for this page only */ } }

const TABS = [
  { id: 'clients',  label: 'Clients',  icon: Users },
  { id: 'renewals', label: 'Renewals', icon: CalendarClock },
  { id: 'coupons',  label: 'Coupons',  icon: Tag },
  { id: 'team',     label: 'Team',     icon: UserCog, adminOnly: true },
]
const ROLE_LABEL = { owner: 'Owner', admin: 'Admin', support: 'Support' }

export default function AdminConsole() {
  const [token, setToken]         = useState(readToken)
  const [me, setMe]               = useState(null)
  const [customers, setCustomers] = useState(null)
  const [addonDefs, setAddonDefs] = useState([])
  const [plans, setPlans]         = useState([])
  const [states, setStates]       = useState([])
  const [loading, setLoading]     = useState(false)
  const [loadError, setLoadError] = useState('')
  const [email, setEmail]         = useState('')
  const [password, setPassword]   = useState('')
  const [tab, setTab]             = useState('clients')
  const [openWs, setOpenWs]       = useState(null)
  const [assigning, setAssigning] = useState(undefined)   // undefined: closed · null: new customer · row: change that client's plan
  const [rev, setRev]             = useState(0)           // bumps after a change so an open client panel reloads
  const [toast, setToast]         = useState('')

  function signOut(message = '') {
    setToken(''); saveToken(''); setMe(null); setCustomers(null); setLoadError(message)
    setTab('clients'); setOpenWs(null); setAssigning(undefined)   // the next person may not see the same tabs
  }

  async function load(t) {
    setLoading(true); setLoadError('')
    try {
      const [who, list, cfg, cat] = await Promise.all([billingAdmin.me(t), billingAdmin.customers(t), billing.config(), billingAdmin.catalog(t)])
      setMe(who); setCustomers(list.items); setStates(cfg.states || [])
      setPlans(cat.catalog.plans); setAddonDefs(cat.catalog.addons)
      setToken(t); saveToken(t)
    } catch (e) {
      signOut(e.status === 401 ? 'Your session has ended. Please sign in again.' : e.message)
    } finally { setLoading(false) }
  }
  useEffect(() => { if (token) load(token) }, [])   // eslint-disable-line react-hooks/exhaustive-deps

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
  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b border-slate-200 sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 pt-3 flex items-center gap-3">
          <ShieldCheck size={20} className="text-primary flex-shrink-0"/>
          <span className="font-bold text-slate-900 flex-1 min-w-0 truncate">SmatBot admin</span>
          <div className="text-right min-w-0 hidden sm:block">
            <div className="text-xs font-semibold text-slate-800 truncate">{me.name}</div>
            <div className="text-[11px] text-slate-400 truncate">{ROLE_LABEL[me.role]} · {me.email}</div>
          </div>
          <button type="button" onClick={() => signOut()} className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-800">
            <LogOut size={14}/> Sign out
          </button>
        </div>
        <div className="max-w-7xl mx-auto px-4 flex items-center gap-2">
          <nav aria-label="Admin sections" className="flex items-center gap-1 overflow-x-auto flex-1 min-w-0">
            {TABS.filter((t) => !t.adminOnly || canEdit).map((t) => (
              <button key={t.id} type="button" aria-current={tab === t.id ? 'page' : undefined} onClick={() => setTab(t.id)}
                className={clsx('inline-flex items-center gap-1.5 px-3 py-2.5 text-sm font-semibold whitespace-nowrap border-b-2 -mb-px transition-colors',
                  tab === t.id ? 'border-primary text-primary' : 'border-transparent text-slate-500 hover:text-slate-800')}>
                <t.icon size={15}/> {t.label}
              </button>
            ))}
          </nav>
          {(tab === 'clients' || tab === 'renewals') && (
            <button type="button" onClick={reload} aria-label="Refresh" title="Refresh" className="p-2 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100"><RefreshCw size={15}/></button>
          )}
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-5">
        {tab === 'clients'  && <ClientsTab customers={customers} canEdit={canEdit} onOpen={setOpenWs} onAssign={setAssigning} onLoginAs={loginAsCustomer}/>}
        {tab === 'renewals' && <RenewalsTab customers={customers} onOpen={setOpenWs}/>}
        {tab === 'coupons'  && <CouponsTab token={token} canEdit={canEdit}/>}
        {tab === 'team' && canEdit && <TeamTab token={token} me={me}/>}
      </main>

      {openWs && (
        <ClientDrawer key={`${openWs}:${rev}`} token={token} workspaceId={openWs} customers={customers} canEdit={canEdit}
          onClose={() => setOpenWs(null)} onAssign={setAssigning} onLoginAs={loginAsCustomer} onChanged={reload}/>
      )}
      {assigning !== undefined && (
        <SubscriptionDialog token={token} initial={assigning} plans={plans} addonDefs={addonDefs} states={states} onClose={() => setAssigning(undefined)}
          onDone={(row) => {
            setAssigning(undefined)
            reload()
            flash(`${row.planName} (${row.period}) given to ${row.customer || row.workspaceId} until ${fmtDate(row.currentEnd)}.`)
          }}/>
      )}
      {toast && (
        <div role="status" className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[60] bg-slate-900 text-white text-sm rounded-xl px-4 py-2.5 shadow-xl max-w-[90vw]">{toast}</div>
      )}
    </div>
  )
}
