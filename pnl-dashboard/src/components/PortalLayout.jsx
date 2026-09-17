import { useMemo, useState, useEffect, useRef } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import clsx from 'clsx'
import { LayoutDashboard, PackagePlus, PackageSearch, Bell, Search, Package } from 'lucide-react'
import { useAuth } from '../store/AuthContext'
import { useData } from '../store/DataContext'
import { Brand, Shell, UserMenu } from './Layout'

/** Deliberately short: the brief scopes the customer portal to booking, history and updates. */
const NAV = [
  { to: '/portal', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/portal/new-order', label: 'Create Order', icon: PackagePlus },
  { to: '/portal/orders', label: 'My Orders', icon: PackageSearch },
  { to: '/portal/notifications', label: 'Notifications', icon: Bell },
]

function Sidebar({ onNavigate }) {
  const { customer } = useAuth()
  const { db } = useData()

  const counts = useMemo(() => ({
    '/portal/orders': db.orders.filter((o) => o.customerId === customer.id && o.status === 'requested').length,
    '/portal/notifications': db.emails.filter(
      (e) => e.customerId === customer.id && Date.now() - new Date(e.at).getTime() < 7 * 864e5
    ).length,
  }), [db, customer.id])

  return (
    <nav className="flex h-full w-64 shrink-0 flex-col border-r border-slate-200 bg-white">
      <Brand subtitle="Customer Portal" />
      <div className="flex-1 overflow-y-auto px-3 py-4">
        <ul className="space-y-0.5">
          {NAV.map((item) => {
            const n = counts[item.to] || 0
            return (
              <li key={item.to}>
                <NavLink
                  to={item.to}
                  end={item.end}
                  onClick={onNavigate}
                  className={({ isActive }) => clsx(
                    'relative flex items-center gap-2.5 rounded-lg px-3 py-2 text-[13px] transition-colors',
                    isActive
                      ? 'bg-navy-50 font-semibold text-navy-900'
                      : 'font-medium text-slate-600 hover:bg-slate-50 hover:text-navy-900'
                  )}
                >
                  {({ isActive }) => (
                    <>
                      {isActive && <span className="absolute inset-y-1.5 left-0 w-0.5 rounded-full bg-orange-500" />}
                      <item.icon size={16} className={clsx('shrink-0', isActive ? 'text-orange-500' : 'text-slate-400')} />
                      <span className="flex-1 truncate">{item.label}</span>
                      {n > 0 && <span className="rounded-full bg-orange-500 px-1.5 py-0.5 text-[10px] font-bold tnum text-white">{n}</span>}
                    </>
                  )}
                </NavLink>
              </li>
            )
          })}
        </ul>
      </div>
      <div className="border-t border-slate-200 px-4 py-4">
        <p className="text-[11px] font-semibold text-navy-900">Need a hand?</p>
        <p className="mt-1 text-[10px] leading-relaxed text-slate-400">
          {db.settings.supportEmail}<br />{db.settings.phone}
        </p>
      </div>
    </nav>
  )
}

/** Tracks only this customer's own shipments — a portal never exposes another account. */
function TrackOwn() {
  const { customer } = useAuth()
  const { db } = useData()
  const nav = useNavigate()
  const [q, setQ] = useState('')
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    const onDoc = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [])

  const results = useMemo(() => {
    const term = q.trim().toLowerCase()
    if (term.length < 2) return []
    return db.orders
      .filter((o) => o.customerId === customer.id)
      .filter((o) => o.id.toLowerCase().includes(term)
        || o.destination.city.toLowerCase().includes(term)
        || o.origin.city.toLowerCase().includes(term))
      .slice(0, 6)
  }, [q, db.orders, customer.id])

  return (
    <div ref={ref} className="relative w-full max-w-md">
      <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
      <input
        value={q}
        onChange={(e) => { setQ(e.target.value); setOpen(true) }}
        onFocus={() => setOpen(true)}
        placeholder="Track a shipment number…"
        className="field pl-9"
      />
      {open && results.length > 0 && (
        <div className="absolute z-40 mt-1.5 w-full overflow-hidden rounded-lg border border-slate-200 bg-white shadow-pop animate-fade-in">
          {results.map((o) => (
            <button
              key={o.id}
              onClick={() => { nav('/portal/orders/' + o.id); setOpen(false); setQ('') }}
              className="flex w-full items-center gap-3 px-3.5 py-2.5 text-left hover:bg-navy-50"
            >
              <span className="grid h-7 w-7 shrink-0 place-items-center rounded-md bg-navy-100 text-navy-700"><Package size={14} /></span>
              <span className="min-w-0">
                <span className="block truncate font-mono text-sm font-semibold text-navy-900">{o.id}</span>
                <span className="block truncate text-xs text-slate-500">{o.origin.city} → {o.destination.city}</span>
              </span>
            </button>
          ))}
        </div>
      )}
      {open && q.trim().length >= 2 && results.length === 0 && (
        <div className="absolute z-40 mt-1.5 w-full rounded-lg border border-slate-200 bg-white px-3.5 py-3 text-sm text-slate-500 shadow-pop">
          No shipment of yours matches “{q.trim()}”
        </div>
      )}
    </div>
  )
}

export default function PortalLayout() {
  const { customer } = useAuth()
  return (
    <Shell
      sidebar={(onNavigate) => <Sidebar onNavigate={onNavigate} />}
      topbar={
        <>
          <TrackOwn />
          <div className="ml-auto flex items-center gap-3">
            <UserMenu name={customer.name} subtitle={customer.company || 'Customer account'} tone="green" />
          </div>
        </>
      }
    />
  )
}
