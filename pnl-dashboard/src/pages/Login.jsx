import { useState } from 'react'
import { Boxes, LogIn, ShieldCheck, UserCog, User, AlertCircle } from 'lucide-react'
import clsx from 'clsx'
import { useAuth } from '../store/AuthContext'
import { useData } from '../store/DataContext'
import { roleLabel, moduleLabel } from '../lib/domain'
import { Field } from '../components/ui'

const LEVELS = [
  {
    icon: ShieldCheck,
    title: 'Super Administrator',
    body: 'Everything an administrator can do, plus user creation, branch and network management, website content and chatbot configuration.',
  },
  {
    icon: UserCog,
    title: 'Administration User',
    body: 'Day-to-day operations: create orders, work the request and quotation queues, track shipments, manage customers, invoice and report.',
  },
  {
    icon: User,
    title: 'Customer',
    body: 'Their own portal: raise a shipment request, follow its history, read notifications and see their own figures.',
  },
]

export default function Login() {
  const { signIn, error, clearError } = useAuth()
  const { db } = useData()
  const [tab, setTab] = useState('staff')
  const [email, setEmail] = useState('adebayo@primenextlogistics.com')
  const [password, setPassword] = useState('admin')

  const staffAccounts = db.users.filter((u) => u.status === 'active')
  const customerAccounts = db.customers.filter((c) => c.status === 'active').slice(0, 3)

  const pickAccount = (addr, pw) => {
    setEmail(addr)
    setPassword(pw)
    clearError()
  }

  const switchTab = (t) => {
    setTab(t)
    clearError()
    if (t === 'staff') pickAccount('adebayo@primenextlogistics.com', 'admin')
    else if (customerAccounts[0]) pickAccount(customerAccounts[0].email, 'customer')
  }

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      {/* Brand panel — the three levels of access, stated up front. */}
      <div className="relative hidden flex-col justify-between overflow-hidden bg-navy-900 p-10 text-white lg:flex">
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.16]"
          style={{ backgroundImage: 'radial-gradient(circle at 18% 22%, #f59e0b 0, transparent 42%), radial-gradient(circle at 82% 78%, #3a6396 0, transparent 46%)' }}
        />
        <div className="relative flex items-center gap-3">
          <span className="grid h-11 w-11 place-items-center rounded-xl bg-amber-500 text-navy-950">
            <Boxes size={23} strokeWidth={2.4} />
          </span>
          <div className="leading-tight">
            <p className="text-lg font-bold tracking-tight">Prime Next Logistics</p>
            <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-navy-300">Management Console</p>
          </div>
        </div>

        <div className="relative max-w-md">
          <h1 className="text-3xl font-bold leading-tight">
            One shipment number, from the request to the doorstep.
          </h1>
          <p className="mt-4 text-sm leading-relaxed text-navy-200">
            Customers raise a request and get a number they can track immediately. Your team
            confirms it, moves it through its milestones, invoices it and reports on it —
            all against that same number.
          </p>

          <div className="mt-8 space-y-3">
            {LEVELS.map((l) => (
              <div key={l.title} className="flex gap-3 rounded-xl border border-navy-700 bg-navy-800/60 p-4">
                <l.icon size={18} className="mt-0.5 shrink-0 text-amber-400" />
                <div>
                  <p className="text-sm font-semibold">{l.title}</p>
                  <p className="mt-0.5 text-xs leading-relaxed text-navy-300">{l.body}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <p className="relative text-[11px] text-navy-400">
          Project 2 — Custom Logistics Management Dashboard
        </p>
      </div>

      {/* Sign-in panel */}
      <div className="flex items-center justify-center bg-slate-100 p-6">
        <div className="w-full max-w-md">
          <div className="mb-6 flex items-center gap-3 lg:hidden">
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-navy-900 text-amber-400">
              <Boxes size={20} strokeWidth={2.4} />
            </span>
            <div className="leading-tight">
              <p className="font-bold text-navy-900">Prime Next Logistics</p>
              <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-500">Management Console</p>
            </div>
          </div>

          <div className="card card-pad sm:p-7">
            <h2 className="text-lg font-bold text-navy-900">Sign in</h2>
            <p className="mt-1 text-sm text-slate-500">
              Staff and customers use the same form — you land in the right place automatically.
            </p>

            <form onSubmit={(e) => { e.preventDefault(); signIn(email, password) }} className="mt-6 space-y-4">
              <Field label="Email">
                <input
                  className="field" type="email" autoComplete="username" value={email}
                  onChange={(e) => { setEmail(e.target.value); clearError() }}
                />
              </Field>
              <Field label="Password">
                <input
                  className="field" type="password" autoComplete="current-password" value={password}
                  onChange={(e) => { setPassword(e.target.value); clearError() }}
                />
              </Field>

              {error && (
                <p className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-700">
                  <AlertCircle size={15} className="mt-0.5 shrink-0" /> {error}
                </p>
              )}

              <button type="submit" className="btn-primary w-full py-2.5">
                <LogIn size={16} /> Sign in
              </button>
            </form>
          </div>

          <div className="mt-5">
            <div className="mb-2 flex items-center gap-1 rounded-lg bg-slate-200/70 p-1">
              {[['staff', 'Staff accounts'], ['customer', 'Customer accounts']].map(([id, label]) => (
                <button
                  key={id}
                  onClick={() => switchTab(id)}
                  className={clsx('flex-1 rounded-md px-3 py-1.5 text-xs font-semibold transition-colors',
                    tab === id ? 'bg-white text-navy-900 shadow-card' : 'text-slate-500 hover:text-navy-700')}
                >
                  {label}
                </button>
              ))}
            </div>

            <div className="space-y-2">
              {tab === 'staff' ? staffAccounts.map((u) => (
                <button
                  key={u.id}
                  onClick={() => pickAccount(u.email, 'admin')}
                  className={clsx(
                    'w-full rounded-lg border bg-white px-3.5 py-2.5 text-left transition-colors hover:border-navy-400',
                    email === u.email ? 'border-navy-900 ring-1 ring-navy-900' : 'border-slate-200'
                  )}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-semibold text-navy-900">{u.name}</span>
                    <span className={clsx('chip', u.role === 'super_admin' ? 'border-amber-200 bg-amber-50 text-amber-700' : 'border-navy-200 bg-navy-50 text-navy-700')}>
                      {roleLabel(u.role)}
                    </span>
                  </div>
                  <p className="mt-0.5 truncate text-xs text-slate-500">{u.email} · password admin</p>
                  {u.role !== 'super_admin' && (
                    <p className="mt-1 text-[11px] leading-relaxed text-slate-400">
                      {u.permissions.map(moduleLabel).join(' · ')}
                    </p>
                  )}
                </button>
              )) : customerAccounts.map((c) => (
                <button
                  key={c.id}
                  onClick={() => pickAccount(c.email, 'customer')}
                  className={clsx(
                    'w-full rounded-lg border bg-white px-3.5 py-2.5 text-left transition-colors hover:border-navy-400',
                    email === c.email ? 'border-navy-900 ring-1 ring-navy-900' : 'border-slate-200'
                  )}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-semibold text-navy-900">{c.name}</span>
                    <span className="chip border-emerald-200 bg-emerald-50 text-emerald-700">Customer</span>
                  </div>
                  <p className="mt-0.5 truncate text-xs text-slate-500">{c.email} · password customer</p>
                  <p className="mt-1 text-[11px] text-slate-400">{c.company || 'Individual account'} · {c.city}</p>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
