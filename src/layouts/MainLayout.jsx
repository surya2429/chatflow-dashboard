import { Outlet, useLocation } from 'react-router-dom'
import { Menu, Eye } from 'lucide-react'
import clsx from 'clsx'
import Sidebar from './Sidebar'
import { useApp } from '../context/AppContext'
import { useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import { refreshSubscription, useSubscription, planLabel } from '../lib/subscriptionStore'
import { ADMIN_URL } from '../lib/billingApi'

export default function MainLayout() {
  const { mobileMenuOpen, toggleMobileMenu, closeMobileMenu, activeProductId } = useApp()
  const { pathname } = useLocation()
  const { currentUser, setWorkspacePlan, logout } = useAuth()
  const { sub } = useSubscription()

  // Billing owns the plan: load it once signed in, then mirror it into the UI chrome.
  useEffect(() => { if (currentUser) refreshSubscription() }, [currentUser?.email, currentUser?.workspaceId])
  useEffect(() => { if (sub) setWorkspacePlan(planLabel(sub)) }, [sub])

  // Close mobile menu on route change
  useEffect(() => { closeMobileMenu() }, [pathname])

  return (
    <div className={clsx('flex h-screen overflow-hidden bg-surface', activeProductId === 'instagram' && 'theme-instagram')}>

      {/* Mobile overlay backdrop */}
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 bg-black/40 z-40 md:hidden"
          onClick={closeMobileMenu}
        />
      )}

      {/* Sidebar — mobile: fixed drawer, md+: normal */}
      <div className={[
        'fixed inset-y-0 left-0 z-50 transition-transform duration-300 md:relative md:translate-x-0 md:z-auto',
        mobileMenuOpen ? 'translate-x-0' : '-translate-x-full',
      ].join(' ')}>
        <Sidebar onNavClick={closeMobileMenu}/>
      </div>

      {/* Main content — overflow-anchor:none prevents scroll jumping when
          conditional content is inserted/removed above the viewport */}
      <main className="flex-1 overflow-y-auto overflow-x-hidden overscroll-contain min-w-0" style={{ overflowAnchor: 'none' }}>
        {/* SmatBot staff looking at a customer's dashboard from the admin console */}
        {currentUser?.impersonatedBy && (
          <div role="status" className="bg-amber-50 border-b border-amber-200 px-4 py-2 flex items-center gap-3 text-xs text-amber-900">
            <Eye size={14} className="flex-shrink-0"/>
            <span className="flex-1 min-w-0">Viewing <b>{currentUser.workspace?.name}</b>'s dashboard as SmatBot staff ({currentUser.impersonatedBy}).</span>
            <button onClick={() => { logout(); window.location.assign(ADMIN_URL) }} className="font-semibold underline whitespace-nowrap">Back to admin</button>
          </div>
        )}
        {/* Mobile top bar */}
        <div className="md:hidden sticky top-0 z-30 bg-white border-b border-surface-border h-12 flex items-center px-4 gap-3 flex-shrink-0">
          <button
            onClick={toggleMobileMenu}
            className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 transition-colors"
            aria-label="Open menu"
          >
            <Menu size={20}/>
          </button>
          <span className="text-sm font-bold text-slate-800">ChatFlow</span>
        </div>

        <div className="p-3 sm:p-5">
          <Outlet />
        </div>
      </main>
    </div>
  )
}
