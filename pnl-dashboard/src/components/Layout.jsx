import { useState, useMemo, useEffect, useRef } from 'react'
import { NavLink, useNavigate, useLocation, Outlet } from 'react-router-dom'
import clsx from 'clsx'
import {
  BarChart3, PackagePlus, ClipboardList, Calculator, Truck, Users, FileText,
  ShieldCheck, Building2, Globe2, Mail, Bot, Settings as SettingsIcon,
  Search, LogOut, Menu, X, ChevronDown, RotateCcw, Boxes, Package,
} from 'lucide-react'
import { useAuth } from '../store/AuthContext'
import { useData } from '../store/DataContext'
import { roleLabel } from '../lib/domain'
import { initials, avatarTone } from '../lib/format'
import { Avatar, Badge, ConfirmDialog } from './ui'

/**
 * Administration navigation. Everything above ADMINISTRATION is what an Administration
 * User can hold; the group below it is the Super Administrator's extra ground — user
 * creation, branches, website content and platform configuration.
 */
const NAV = [
  {
    section: 'Operations',
    items: [
      { to: '/analytics', label: 'Analytics & Reports', icon: BarChart3, module: 'analytics', end: true },
      { to: '/create-order', label: 'Create Order', icon: PackagePlus, module: 'create_order' },
      { to: '/orders', label: 'Order Requests', icon: ClipboardList, module: 'order_requests' },
      { to: '/quotations', label: 'Quotation Requests', icon: Calculator, module: 'quotations' },
      { to: '/shipments', label: 'Shipment Tracking', icon: Truck, module: 'shipments' },
    ],
  },
  {
    section: 'Accounts',
    items: [
      { to: '/customers', label: 'Customer Management', icon: Users, module: 'customers' },
      { to: '/invoices', label: 'Invoices', icon: FileText, module: 'invoices' },
    ],
  },
  {
    section: 'Administration',
    items: [
      { to: '/users', label: 'Users & Permissions', icon: ShieldCheck, module: 'users' },
      { to: '/branches', label: 'Branches & Network', icon: Building2, module: 'branches' },
      { to: '/content', label: 'Content Management', icon: Globe2, module: 'content' },
      { to: '/notifications', label: 'Email Notifications', icon: Mail, module: 'notifications' },
      { to: '/chatbot', label: 'AI Chatbot', icon: Bot, module: 'chatbot' },
      { to: '/settings', label: 'System Settings', icon: SettingsIcon, module: 'settings' },
    ],
  },
]

export function Brand({ subtitle = 'Management Console' }) {
  return (
    <div className="flex items-center gap-2.5 px-4 py-4">
      <span className="grid h-9 w-9 place-items-center rounded-lg bg-amber-500 text-navy-950 shadow">
        <Boxes size={19} strokeWidth={2.4} />
      </span>
      <div className="leading-tight">
        <p className="text-[13px] font-bold tracking-tight text-white">Prime Next Logistics</p>
        <p className="text-[10px] font-medium uppercase tracking-widest text-navy-300">{subtitle}</p>
      </div>
    </div>
  )
}

function Sidebar({ onNavigate }) {
  const { can } = useAuth()
  const { db } = useData()

  const counts = useMemo(() => ({
    '/orders': db.orders.filter((o) => o.status === 'requested').length,
    '/quotations': db.quotes.filter((q) => q.status === 'new').length,
    '/customers': db.customers.filter((c) => c.status === 'pending').length,
    '/invoices': db.invoices.filter((i) => i.status === 'draft').length,
  }), [db])

  return (
    <nav className="flex h-full w-64 shrink-0 flex-col bg-navy-900 text-navy-100">
      <Brand />
      <div className="flex-1 overflow-y-auto px-3 pb-4">
        {NAV.map((group) => {
          const items = group.items.filter((i) => can(i.module))
          if (!items.length) return null
          return (
            <div key={group.section} className="mb-5">
              <p className="px-3 pb-1.5 text-[10px] font-bold uppercase tracking-widest text-navy-400">{group.section}</p>
              <ul className="space-y-0.5">
                {items.map((item) => {
                  const n = counts[item.to] || 0
                  return (
                    <li key={item.to}>
                      <NavLink
                        to={item.to}
                        end={item.end}
                        onClick={onNavigate}
                        className={({ isActive }) => clsx(
                          'flex items-center gap-2.5 rounded-lg px-3 py-2 text-[13px] font-medium transition-colors',
                          isActive ? 'bg-navy-700 text-white shadow-inner' : 'text-navy-200 hover:bg-navy-800 hover:text-white'
                        )}
                      >
                        <item.icon size={16} className="shrink-0" />
                        <span className="flex-1 truncate">{item.label}</span>
                        {n > 0 && (
                          <span className="rounded-full bg-amber-500 px-1.5 py-0.5 text-[10px] font-bold tnum text-navy-950">{n}</span>
                        )}
                      </NavLink>
                    </li>
                  )
                })}
              </ul>
            </div>
          )
        })}
      </div>
      <div className="border-t border-navy-800 px-4 py-3">
        <p className="text-[10px] leading-relaxed text-navy-400">
          Prime Next Logistics · Project 2<br />Logistics Management Dashboard
        </p>
      </div>
    </nav>
  )
}

/** Global lookup — the fastest path to a shipment when a customer calls in. */
function ShipmentSearch() {
  const { db } = useData()
  const nav = useNavigate()
  const [q, setQ] = useState('')
  const [open, setOpen] = useState(false)
  const boxRef = useRef(null)

  useEffect(() => {
    const onDoc = (e) => { if (boxRef.current && !boxRef.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [])

  const results = useMemo(() => {
    const term = q.trim().toLowerCase()
    if (term.length < 2) return []
    const hits = []
    for (const o of db.orders) {
      if (o.id.toLowerCase().includes(term)) {
        hits.push({ kind: 'order', id: o.id, title: o.id, sub: o.origin.city + ' → ' + o.destination.city, to: '/orders/' + o.id })
      }
      if (hits.length >= 6) break
    }
    for (const c of db.customers) {
      if (hits.length >= 9) break
      if (c.name.toLowerCase().includes(term) || c.email.toLowerCase().includes(term) || c.id.toLowerCase().includes(term)) {
        hits.push({ kind: 'customer', id: c.id, title: c.name, sub: c.email, to: '/customers/' + c.id })
      }
    }
    return hits
  }, [q, db])

  return (
    <div ref={boxRef} className="relative w-full max-w-md">
      <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
      <input
        value={q}
        onChange={(e) => { setQ(e.target.value); setOpen(true) }}
        onFocus={() => setOpen(true)}
        placeholder="Search shipment number or customer…"
        className="field pl-9"
      />
      {open && results.length > 0 && (
        <div className="absolute z-40 mt-1.5 w-full overflow-hidden rounded-lg border border-slate-200 bg-white shadow-pop animate-fade-in">
          {results.map((r) => (
            <button
              key={r.kind + r.id}
              onClick={() => { nav(r.to); setOpen(false); setQ('') }}
              className="flex w-full items-center gap-3 px-3.5 py-2.5 text-left hover:bg-navy-50"
            >
              <span className={clsx('grid h-7 w-7 shrink-0 place-items-center rounded-md', r.kind === 'order' ? 'bg-navy-100 text-navy-700' : 'bg-amber-100 text-amber-700')}>
                {r.kind === 'order' ? <Package size={14} /> : <Users size={14} />}
              </span>
              <span className="min-w-0">
                <span className="block truncate text-sm font-semibold text-navy-900">{r.title}</span>
                <span className="block truncate text-xs text-slate-500">{r.sub}</span>
              </span>
            </button>
          ))}
        </div>
      )}
      {open && q.trim().length >= 2 && results.length === 0 && (
        <div className="absolute z-40 mt-1.5 w-full rounded-lg border border-slate-200 bg-white px-3.5 py-3 text-sm text-slate-500 shadow-pop">
          No match for “{q.trim()}”
        </div>
      )}
    </div>
  )
}

export function UserMenu({ name, subtitle, tone }) {
  const { signOut } = useAuth()
  const { resetData } = useData()
  const [open, setOpen] = useState(false)
  const [confirmReset, setConfirmReset] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    const onDoc = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [])

  return (
    <div ref={ref} className="relative">
      <button onClick={() => setOpen((v) => !v)} className="flex items-center gap-2.5 rounded-lg py-1 pl-1 pr-2 hover:bg-slate-100">
        <Avatar name={initials(name)} tone={avatarTone(name)} />
        <span className="hidden text-left sm:block">
          <span className="block text-[13px] font-semibold leading-tight text-navy-900">{name}</span>
          <span className="block text-[11px] leading-tight text-slate-500">{subtitle}</span>
        </span>
        <ChevronDown size={15} className="text-slate-400" />
      </button>
      {open && (
        <div className="absolute right-0 z-40 mt-1.5 w-64 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-pop animate-fade-in">
          <div className="border-b border-slate-100 px-4 py-3">
            <p className="text-sm font-semibold text-navy-900">{name}</p>
            <p className="mt-2"><Badge tone={tone} dot>{subtitle}</Badge></p>
          </div>
          <button
            onClick={() => { setOpen(false); setConfirmReset(true) }}
            className="flex w-full items-center gap-2.5 px-4 py-2.5 text-left text-sm text-navy-700 hover:bg-slate-50"
          >
            <RotateCcw size={15} className="text-slate-400" /> Reset demo data
          </button>
          <button
            onClick={signOut}
            className="flex w-full items-center gap-2.5 border-t border-slate-100 px-4 py-2.5 text-left text-sm text-red-600 hover:bg-red-50"
          >
            <LogOut size={15} /> Sign out
          </button>
        </div>
      )}
      <ConfirmDialog
        open={confirmReset}
        onClose={() => setConfirmReset(false)}
        onConfirm={resetData}
        title="Reset demo data?"
        message="Every change you have made — orders, milestones, invoices, quotations, content, branches and users — will be replaced with the original seeded dataset."
        confirmLabel="Reset everything"
        danger
      />
    </div>
  )
}

/** Shared chrome: fixed sidebar on desktop, drawer on mobile, scrolling content pane. */
export function Shell({ sidebar, topbar }) {
  const [mobileOpen, setMobileOpen] = useState(false)
  const { pathname } = useLocation()

  useEffect(() => { setMobileOpen(false) }, [pathname])

  return (
    <div className="flex h-screen overflow-hidden bg-slate-100">
      <aside className="hidden lg:block">{sidebar(undefined)}</aside>

      {mobileOpen && (
        <div className="fixed inset-0 z-50 flex lg:hidden">
          <div className="absolute inset-0 bg-navy-950/50" onClick={() => setMobileOpen(false)} />
          <div className="relative animate-slide-up">{sidebar(() => setMobileOpen(false))}</div>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-16 shrink-0 items-center gap-3 border-b border-slate-200 bg-white px-4 lg:px-6">
          <button className="rounded-lg p-2 text-navy-700 hover:bg-slate-100 lg:hidden" onClick={() => setMobileOpen((v) => !v)} aria-label="Menu">
            {mobileOpen ? <X size={18} /> : <Menu size={18} />}
          </button>
          {topbar}
        </header>
        <main className="flex-1 overflow-y-auto">
          <div className="mx-auto max-w-[1400px] px-4 py-6 lg:px-6 lg:py-8">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  )
}

export default function Layout() {
  const { user, isSuper } = useAuth()
  return (
    <Shell
      sidebar={(onNavigate) => <Sidebar onNavigate={onNavigate} />}
      topbar={
        <>
          <ShipmentSearch />
          <div className="ml-auto flex items-center gap-3">
            <UserMenu name={user.name} subtitle={roleLabel(user.role)} tone={isSuper ? 'amber' : 'navy'} />
          </div>
        </>
      }
    />
  )
}
