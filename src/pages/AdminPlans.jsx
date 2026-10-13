// AdminPlans.jsx — SmatBot staff panel: give a customer a plan without a Razorpay payment
// (paid offline by bank transfer / cheque, or a free or trial plan). Lives at /admin/plans,
// outside the customer login: staff sign in (checked on the server against BILLING_ADMIN_EMAIL /
// BILLING_ADMIN_PASSWORD). The plan runs like a pay-once plan and ends on the chosen date.
import { useState, useEffect, useMemo } from 'react'
import clsx from 'clsx'
import { Lock, Loader2, Search, CheckCircle2, AlertCircle, ShieldCheck } from 'lucide-react'
import { PLANS, inr } from '../constants/pricing'
import { billing, billingAdmin } from '../lib/billingApi'
import DatePicker from '../components/DatePicker'

const TOKEN_KEY = 'smatbot-admin-token'
const readToken = () => { try { return sessionStorage.getItem(TOKEN_KEY) || '' } catch { return '' } }
const saveToken = (t) => { try { t ? sessionStorage.setItem(TOKEN_KEY, t) : sessionStorage.removeItem(TOKEN_KEY) } catch { /* storage blocked: token lasts for this page only */ } }

const ymd = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
function onePeriodFromToday(period) {
  const d = new Date()
  if (period === 'monthly') d.setMonth(d.getMonth() + 1)
  else d.setFullYear(d.getFullYear() + 1)
  return ymd(d)
}
const fmtSec = (sec) => (sec ? new Date(sec * 1000).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '—')

const STATUS_STYLE = {
  active:    'bg-emerald-50 text-emerald-700 border-emerald-200',
  past_due:  'bg-amber-50 text-amber-700 border-amber-200',
  suspended: 'bg-red-50 text-red-700 border-red-200',
}
const inputCls = 'w-full border border-slate-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary/10'
const labelCls = 'block text-xs font-semibold text-slate-600 mb-1.5'
const blankForm = () => ({ workspaceId: '', plan: 'standard', period: 'yearly', addons: {}, until: onePeriodFromToday('yearly'), note: '' })

export default function AdminPlans() {
  const [token, setToken]           = useState(readToken)
  const [email, setEmail]           = useState('')
  const [password, setPassword]     = useState('')
  const [loading, setLoading]       = useState(false)
  const [loadError, setLoadError]   = useState('')
  const [customers, setCustomers]   = useState(null)
  const [addonDefs, setAddonDefs]   = useState([])
  const [query, setQuery]           = useState('')
  const [form, setForm]             = useState(blankForm)
  const [saving, setSaving]         = useState(false)
  const [result, setResult]         = useState(null)   // { ok, message }

  function lock(message = '') {
    setToken(''); saveToken(''); setCustomers(null); setLoadError(message)
  }

  async function load(t) {
    setLoading(true); setLoadError('')
    try {
      const [list, cfg] = await Promise.all([billingAdmin.customers(t), billing.config()])
      setCustomers(list.items); setAddonDefs(cfg.addons || [])
      setToken(t); saveToken(t)
    } catch (e) {
      lock(e.message)
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

  const set = (patch) => setForm(f => ({ ...f, ...patch }))
  const setAddon = (id, qty) => setForm(f => ({ ...f, addons: { ...f.addons, [id]: qty } }))

  const plan     = PLANS.find(p => p.id === form.plan)
  const eligible = addonDefs.filter(a => a.plans.includes(form.plan))
  const chosen   = eligible.filter(a => form.addons[a.id] > 0)
  const listPrice = plan[form.period] + chosen.reduce((n, a) => n + a[form.period] * form.addons[a.id], 0)

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase()
    return (customers || []).filter(c => !q || [c.workspaceId, c.customer, c.email].some(v => v?.toLowerCase().includes(q)))
  }, [customers, query])

  function pick(c) {
    const period = c.period || 'yearly'
    setForm({
      workspaceId: c.workspaceId, plan: c.plan || 'standard', period, note: '',
      addons: Object.fromEntries(c.addons.map(a => [a.id, a.qty])), until: onePeriodFromToday(period),
    })
    setResult(null)
    // on narrow screens the form sits below the list
    document.getElementById('assign-form')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  async function submit(e) {
    e.preventDefault()
    setSaving(true); setResult(null)
    try {
      const row = await billingAdmin.assign(token, {
        workspaceId: form.workspaceId.trim(), plan: form.plan, period: form.period,
        addons: chosen.map(a => ({ id: a.id, qty: form.addons[a.id] })),
        until: Math.floor(new Date(`${form.until}T23:59:59`).getTime() / 1000),   // to the end of the chosen day
        note: form.note,
      })
      setCustomers(list => [row, ...list.filter(c => c.workspaceId !== row.workspaceId)])
      setResult({ ok: true, message: `${row.planName} (${row.period}) given to ${row.customer || row.workspaceId} until ${fmtSec(row.currentEnd)}.` })
    } catch (err) {
      if (err.status === 401) lock(err.message)
      else setResult({ ok: false, message: err.message })
    } finally { setSaving(false) }
  }

  /* ── locked ── */
  if (!customers) return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <form onSubmit={signIn} className="w-full max-w-sm bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
        <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center mb-4"><Lock size={18}/></div>
        <h1 className="text-lg font-bold text-slate-900">SmatBot admin</h1>
        <p className="text-sm text-slate-500 mt-1 mb-5">Sign in to manage customer plans.</p>
        <label htmlFor="admin-email" className={labelCls}>Email</label>
        <input id="admin-email" type="email" autoComplete="username" autoFocus required value={email}
          onChange={e => setEmail(e.target.value)} className={inputCls}/>
        <label htmlFor="admin-password" className={clsx(labelCls, 'mt-3')}>Password</label>
        <input id="admin-password" type="password" autoComplete="current-password" required value={password}
          onChange={e => setPassword(e.target.value)} className={inputCls}/>
        {loadError && <p role="alert" className="text-xs text-red-600 mt-2">{loadError}</p>}
        <button type="submit" disabled={loading || !email.trim() || !password}
          className="mt-4 w-full bg-primary text-white rounded-xl py-2.5 text-sm font-semibold disabled:opacity-50 flex items-center justify-center gap-2">
          {loading && <Loader2 size={14} className="animate-spin"/>} Sign in
        </button>
      </form>
    </div>
  )

  /* ── unlocked ── */
  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b border-slate-200">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center gap-3">
          <ShieldCheck size={20} className="text-primary flex-shrink-0"/>
          <div className="flex-1 min-w-0">
            <h1 className="text-base font-bold text-slate-900">Customer plans</h1>
            <p className="text-xs text-slate-500">Give a plan paid offline, or a free / trial plan. No Razorpay payment and no invoice is created.</p>
          </div>
          <button type="button" onClick={() => lock()} className="text-xs font-semibold text-slate-500 hover:text-slate-800 flex items-center gap-1.5">
            <Lock size={12}/> Sign out
          </button>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-6 grid gap-6 lg:grid-cols-[1fr_380px] items-start">
        {/* customers */}
        <section className="bg-white border border-slate-200 rounded-2xl overflow-hidden min-w-0">
          <div className="p-4 border-b border-slate-100 flex items-center gap-3 flex-wrap">
            <h2 className="text-sm font-bold text-slate-800 flex-1">Customers <span className="text-slate-400 font-medium">({customers.length})</span></h2>
            <div className="relative">
              <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400"/>
              <input aria-label="Search customers" placeholder="Search" value={query} onChange={e => setQuery(e.target.value)}
                className="border border-slate-200 rounded-xl pl-8 pr-3 py-1.5 text-sm outline-none focus:border-primary w-48"/>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[600px]">
              <thead>
                <tr className="text-left text-[11px] uppercase tracking-wide text-slate-400 bg-slate-50">
                  <th className="px-4 py-2.5 font-semibold">Customer</th>
                  <th className="px-3 py-2.5 font-semibold">Plan</th>
                  <th className="px-3 py-2.5 font-semibold">Status</th>
                  <th className="px-3 py-2.5 font-semibold">Ends</th>
                  <th className="px-4 py-2.5"><span className="sr-only">Action</span></th>
                </tr>
              </thead>
              <tbody>
                {shown.map(c => (
                  <tr key={c.workspaceId} className={clsx('border-t border-slate-100', form.workspaceId === c.workspaceId && 'bg-primary/5')}>
                    <td className="px-4 py-3">
                      <div className="font-semibold text-slate-800">{c.customer || c.workspaceId}</div>
                      <div className="text-xs text-slate-400">{c.customer ? c.workspaceId : 'No billing details yet'}{c.email ? ` · ${c.email}` : ''}</div>
                    </td>
                    <td className="px-3 py-3 text-slate-700">
                      {c.planName ? <>{c.planName} <span className="text-slate-400">· {c.period}</span></> : <span className="text-slate-400">No plan</span>}
                      {c.addons.length > 0 && <div className="text-xs text-slate-400">+ {c.addons.length} add-on{c.addons.length > 1 ? 's' : ''}</div>}
                      {c.lastGrant?.note && <div className="text-xs text-slate-400 truncate max-w-[180px]" title={c.lastGrant.note}>{c.lastGrant.note}</div>}
                    </td>
                    <td className="px-3 py-3">
                      <span className={clsx('inline-block text-[11px] font-semibold capitalize border rounded-md px-1.5 py-0.5', STATUS_STYLE[c.status] || 'bg-slate-50 text-slate-500 border-slate-200')}>
                        {c.status.replace('_', ' ')}
                      </span>
                      {c.autopay && <div className="text-[11px] text-slate-400 mt-0.5">Autopay on</div>}
                    </td>
                    <td className="px-3 py-3 text-slate-600 whitespace-nowrap">{fmtSec(c.currentEnd)}</td>
                    <td className="px-4 py-3 text-right">
                      <button type="button" onClick={() => pick(c)} className="text-xs font-semibold text-primary hover:underline whitespace-nowrap">Change plan</button>
                    </td>
                  </tr>
                ))}
                {!shown.length && (
                  <tr><td colSpan={5} className="px-4 py-10 text-center text-sm text-slate-400">
                    {customers.length ? 'No customer matches that search.' : 'No customers yet. Assign a plan by workspace ID.'}
                  </td></tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        {/* assign */}
        <form id="assign-form" onSubmit={submit} className="bg-white border border-slate-200 rounded-2xl p-5 space-y-4 lg:sticky lg:top-6">
          <div className="flex items-center">
            <h2 className="text-sm font-bold text-slate-800 flex-1">Assign a plan</h2>
            <button type="button" onClick={() => { setForm(blankForm()); setResult(null) }} className="text-xs font-semibold text-slate-400 hover:text-slate-700">New customer</button>
          </div>

          <div>
            <label htmlFor="ws" className={labelCls}>Workspace ID</label>
            <input id="ws" required value={form.workspaceId} onChange={e => set({ workspaceId: e.target.value })} placeholder="e.g. default" className={inputCls}/>
          </div>

          <fieldset>
            <legend className={labelCls}>Plan</legend>
            <div className="grid grid-cols-2 gap-2">
              {PLANS.map(p => (
                <label key={p.id} className={clsx('border rounded-xl px-3 py-2 cursor-pointer transition-colors has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-primary/30',
                  form.plan === p.id ? 'border-primary bg-primary/5' : 'border-slate-200 hover:border-slate-300')}>
                  <input type="radio" name="plan" value={p.id} checked={form.plan === p.id} onChange={() => set({ plan: p.id })} className="sr-only"/>
                  <div className="text-sm font-semibold text-slate-800">{p.name}</div>
                  <div className="text-xs text-slate-500">{inr(p[form.period])} / {form.period === 'monthly' ? 'mo' : 'yr'}</div>
                </label>
              ))}
            </div>
          </fieldset>

          <fieldset>
            <legend className={labelCls}>Billing period</legend>
            <div className="inline-flex p-1 bg-slate-100 rounded-xl">
              {['monthly', 'yearly'].map(pd => (
                <label key={pd} className={clsx('px-4 py-1.5 rounded-lg text-xs font-semibold capitalize cursor-pointer has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-primary/30',
                  form.period === pd ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500')}>
                  <input type="radio" name="period" value={pd} checked={form.period === pd} onChange={() => set({ period: pd, until: onePeriodFromToday(pd) })} className="sr-only"/>
                  {pd}
                </label>
              ))}
            </div>
          </fieldset>

          <fieldset>
            <legend className={labelCls}>Add-ons <span className="font-normal text-slate-400">(optional)</span></legend>
            <div className="max-h-56 overflow-y-auto border border-slate-200 rounded-xl divide-y divide-slate-100">
              {eligible.map(a => (
                <div key={a.id} className="flex items-center gap-3 px-3 py-2">
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-medium text-slate-700">{a.name}</div>
                    <div className="text-[11px] text-slate-400">{inr(a[form.period])} · {a.unit}</div>
                  </div>
                  {a.maxQty === 1
                    ? <input type="checkbox" aria-label={a.name} checked={form.addons[a.id] > 0}
                        onChange={e => setAddon(a.id, e.target.checked ? 1 : 0)} className="w-4 h-4 accent-primary"/>
                    : <input type="number" aria-label={`${a.name} quantity`} min={0} max={a.maxQty} value={form.addons[a.id] || 0}
                        onChange={e => setAddon(a.id, Math.max(0, Math.min(a.maxQty, parseInt(e.target.value, 10) || 0)))}
                        className="w-16 border border-slate-200 rounded-lg px-2 py-1 text-xs text-right outline-none focus:border-primary"/>}
                </div>
              ))}
            </div>
          </fieldset>

          <fieldset>
            <legend className={labelCls}>Plan ends on</legend>
            <DatePicker value={form.until} onChange={until => set({ until })} textSize="text-sm"/>
          </fieldset>

          <div>
            <label htmlFor="note" className={labelCls}>Note</label>
            <input id="note" value={form.note} maxLength={500} onChange={e => set({ note: e.target.value })}
              placeholder="e.g. Paid by NEFT, UTR 1234 · or 30-day trial" className={inputCls}/>
          </div>

          <div className="rounded-xl bg-slate-50 px-3 py-2.5 text-xs text-slate-600 flex justify-between">
            <span>List price, for reference</span>
            <span className="font-semibold text-slate-800">{inr(listPrice)} + GST</span>
          </div>

          {result && (
            <p role="status" className={clsx('text-xs rounded-xl px-3 py-2 flex gap-2', result.ok ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700')}>
              {result.ok ? <CheckCircle2 size={14} className="flex-shrink-0 mt-px"/> : <AlertCircle size={14} className="flex-shrink-0 mt-px"/>}
              {result.message}
            </p>
          )}

          <button type="submit" disabled={saving || !form.workspaceId.trim() || !form.until}
            className="w-full bg-primary text-white rounded-xl py-2.5 text-sm font-semibold disabled:opacity-50 flex items-center justify-center gap-2">
            {saving && <Loader2 size={14} className="animate-spin"/>} Assign plan
          </button>
        </form>
      </main>
    </div>
  )
}
