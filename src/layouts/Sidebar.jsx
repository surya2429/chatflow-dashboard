import { useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { NavLink, useNavigate } from 'react-router-dom'
import {
  LayoutDashboard, MessageSquare, Users, Radio, Workflow,
  FileText, ShoppingBag, BarChart2, Puzzle, PhoneCall, Settings, Globe, ShoppingCart, TicketCheck, Instagram,
  ChevronLeft, ChevronDown, Zap, Plus, Check, Layers,
  Bell, HelpCircle, CreditCard, CheckCheck, X, LogOut,
  User, Building2, Key, UserPlus, ChevronRight, ArrowLeft,
  Send, Camera, Bot, MessageCircle, Palette,
} from 'lucide-react'
import { useApp } from '../context/AppContext'
import { useAuth } from '../context/AuthContext'
import { PRODUCT_NAV_ITEMS, COMMON_NAV_ITEMS, HOME_NAV_ITEM, PRODUCT_HIDDEN_COMMON_IDS } from '../constants/navigation'
import { useSubscription, isLive } from '../lib/subscriptionStore'
import { getPlan, num, money, DEMO_USAGE } from '../constants/pricing'
import clsx from 'clsx'

const ICON_MAP = {
  LayoutDashboard, MessageSquare, Users, Radio, Workflow,
  FileText, ShoppingBag, BarChart2, Puzzle, PhoneCall, Settings, Layers, Globe, ShoppingCart, TicketCheck, Instagram,
  Send, Camera, Bot, MessageCircle, Palette,
}

const BADGE_COLORS = {
  blue:   'bg-primary-50 text-primary',
  green:  'bg-emerald-50 text-emerald-600',
  purple: 'bg-purple-50 text-purple-600',
  amber:  'bg-amber-50 text-amber-600',
  pink:   'bg-pink-50 text-pink-600',
}

/* Availability. Only an ONLINE agent is offered new conversations. */
const PRESENCE = {
  online:  { label: 'Online',  dot: 'bg-emerald-400', hint: 'New conversations can be assigned to you.' },
  away:    { label: 'Away',    dot: 'bg-amber-400',   hint: "You stay signed in but won't be offered new conversations." },
  offline: { label: 'Offline', dot: 'bg-slate-300',   hint: "You won't be offered conversations or alerts." },
}

/* Account links open the matching Settings section. */
const ACCOUNT_LINKS = [
  { icon: User,       label: 'Profile',            section: 'general' },
  { icon: Building2,  label: 'Workspace Settings', section: 'general' },
  { icon: CreditCard, label: 'Billing & Plan',     section: 'billing' },
  { icon: Key,        label: 'API Keys',           section: 'api'     },
  { icon: UserPlus,   label: 'Team Members',       section: 'team'    },
]

const STATUS_COLOR = {
  active:       { dot: 'bg-emerald-400', label: 'Active'       },
  paused:       { dot: 'bg-amber-400',   label: 'Paused'       },
  disconnected: { dot: 'bg-slate-300',   label: 'Disconnected' },
}

export default function Sidebar({ onNavClick }) {
  const {
    sidebarCollapsed, toggleSidebar, activeBot, activeBotId, setActiveBotId, bots, user,
    notifications, unreadCount, markAllRead, closeMobileMenu,
    products, activeProduct, activeProductId, setActiveProductId,
  } = useApp()
  const { canAccessNavId, logout, currentUser, presence, setPresence } = useAuth()
  const { sub } = useSubscription()
  const [showBotPicker, setShowBotPicker] = useState(false)
  const [showProfile,   setShowProfile]   = useState(false)
  const [profileView,   setProfileView]   = useState('menu') // 'menu' | 'notifications'
  const profileRef  = useRef(null)
  const popupRef    = useRef(null)
  const [popPos, setPopPos] = useState({ left: 8, bottom: 8, maxHeight: 480 })
  const navigate   = useNavigate()

  const hiddenCommonIds = PRODUCT_HIDDEN_COMMON_IDS[activeProductId] || []
  const visibleNav = [
    ...(canAccessNavId(HOME_NAV_ITEM.id) ? [HOME_NAV_ITEM] : []),
    ...(PRODUCT_NAV_ITEMS[activeProductId] || []).filter(item => canAccessNavId(item.id)),
    ...COMMON_NAV_ITEMS.filter(item => canAccessNavId(item.id) && !hiddenCommonIds.includes(item.id)),
  ]

  // Helper: close everything on mobile nav
  function handleNavClick() { onNavClick?.(); closeMobileMenu?.() }

  useEffect(() => {
    function h(e) {
      if (profileRef.current && !profileRef.current.contains(e.target) && !popupRef.current?.contains(e.target)) {
        setShowProfile(false)
        setProfileView('menu')
      }
    }
    // The popup is positioned from the button, so a resize would leave it stranded.
    const close = () => { setShowProfile(false); setProfileView('menu') }
    document.addEventListener('mousedown', h)
    window.addEventListener('resize', close)
    return () => { document.removeEventListener('mousedown', h); window.removeEventListener('resize', close) }
  }, [])

  function switchBot(id) { setActiveBotId(id); setShowBotPicker(false) }

  function switchProduct(id) {
    setActiveProductId(id)
    const firstItem = (PRODUCT_NAV_ITEMS[id] || [])[0]
    if (firstItem) navigate(firstItem.path)
    handleNavClick()
  }

  /* The menu is drawn outside the sidebar (the sidebar clips anything wider than it),
     anchored to the profile button. */
  function openProfile() {
    if (!showProfile && profileRef.current) {
      const r = profileRef.current.getBoundingClientRect()
      const width = Math.min(300, window.innerWidth - 16)
      const left = sidebarCollapsed ? r.right + 8 : r.left + 8
      const bottom = Math.max(8, sidebarCollapsed ? window.innerHeight - r.bottom : window.innerHeight - r.top + 8)
      setPopPos({
        left: Math.min(Math.max(8, left), window.innerWidth - width - 8),   // never off-screen
        bottom,
        // Only the room above the button is usable; taller content scrolls inside the menu.
        maxHeight: Math.max(200, window.innerHeight - bottom - 8),
      })
    }
    setProfileView('menu')
    setShowProfile(p => !p)
  }

  function goSettings(section) {
    setShowProfile(false)
    navigate(`/settings?section=${section}`)
    handleNavClick()
  }

  /* Plan summary for the menu. */
  const live = isLive(sub)
  const plan = live ? getPlan(sub.planName) : null
  const webOnly = activeProductId === 'webchat'
  const pool = plan ? plan.serviceMsgs * (sub.period === 'yearly' ? 12 : 1) : 0
  const usedPct = pool ? Math.max(1, Math.round((DEMO_USAGE.svcUsed / pool) * 100)) : 0
  const fmtSec = (sec) => new Date(sec * 1000).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  let planNote = { tone: 'text-slate-500', text: 'No active plan — pick one to unlock bots, broadcasts and live agents.' }
  if (sub?.status === 'halted') planNote = { tone: 'text-red-600', text: 'Autopay payment failed — your plan is paused.' }
  else if (sub?.status === 'pending') planNote = { tone: 'text-amber-600', text: 'A renewal is waiting for your approval.' }
  else if (live && sub.endsAt) planNote = { tone: 'text-amber-600', text: `Ends ${fmtSec(sub.endsAt)}${sub.mode === 'once' ? ' · paid once' : ' · autopay off'}` }
  else if (live) planNote = { tone: 'text-slate-500', text: `Renews ${fmtSec(sub.nextChargeAt || sub.currentEnd)} · ${money(sub.charge.total)}${sub.autopay.on ? ' · Autopay on' : ''}` }
  const dotCls = PRESENCE[presence]?.dot || PRESENCE.offline.dot

  return (
    <aside className={clsx(
      'flex flex-col h-full bg-white border-r border-surface-border transition-all duration-300 flex-shrink-0 z-20 relative',
      sidebarCollapsed ? 'w-[60px]' : 'w-[220px]',
      // On mobile always show full width sidebar
      'max-md:!w-[260px]'
    )}>

      {/* ── Logo ── */}
      <div className={clsx(
        'flex items-center h-[52px] border-b border-surface-border px-3 flex-shrink-0',
        sidebarCollapsed ? 'justify-center' : 'justify-between'
      )}>
        {!sidebarCollapsed ? (
          <>
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 bg-primary rounded-lg flex items-center justify-center shadow-btn">
                <Zap size={14} className="text-white" />
              </div>
              <div>
                <span className="font-bold text-slate-900 text-sm leading-none">ChatFlow</span>
                <p className="text-[10px] text-slate-400 leading-none mt-0.5">WhatsApp Platform</p>
              </div>
            </div>
            {/* Desktop collapse button — hidden on mobile (mobile has the top bar X) */}
            <button onClick={toggleSidebar} className="p-1 rounded-md text-slate-400 hover:text-slate-600 hover:bg-surface-hover hidden md:flex">
              <ChevronLeft size={14} />
            </button>
            {/* Mobile close button */}
            <button onClick={closeMobileMenu} className="p-1 rounded-md text-slate-400 hover:text-slate-600 hover:bg-surface-hover md:hidden">
              <X size={16} />
            </button>
          </>
        ) : (
          <button onClick={toggleSidebar} title="Expand sidebar"
            className="p-1 rounded-md text-slate-400 hover:text-slate-600 hover:bg-surface-hover">
            <div className="w-7 h-7 bg-primary rounded-md flex items-center justify-center">
              <Zap size={13} className="text-white" />
            </div>
          </button>
        )}
      </div>

      {/* ── Bot + Product Switcher (combined, minimal) ── */}
      {!sidebarCollapsed ? (
        <div className="px-3 py-2 border-b border-surface-border">
          {/* Product icons — one compact row, no labels, no card */}
          <div className="flex items-center gap-0.5 mb-1">
            {products.map(product => {
              const Icon = ICON_MAP[product.icon]
              const isActive = product.id === activeProductId
              return (
                <button
                  key={product.id}
                  onClick={() => switchProduct(product.id)}
                  title={product.name}
                  className={clsx(
                    'flex-1 flex items-center justify-center h-6 rounded-md transition-colors',
                    isActive ? 'bg-slate-100' : 'hover:bg-slate-50'
                  )}
                >
                  <Icon size={13} className={clsx(!isActive && 'text-slate-400')} style={isActive ? { color: product.color } : undefined} />
                </button>
              )
            })}
          </div>

          {/* Bot picker */}
          <div className="relative">
            <button onClick={() => setShowBotPicker(p => !p)}
              className="w-full flex items-center gap-2 p-1.5 rounded-lg hover:bg-surface-hover transition-colors">
              <div className="w-7 h-7 rounded-lg flex items-center justify-center text-white text-[11px] font-bold flex-shrink-0"
                style={{ background: activeBot.color }}>
                {activeBot.avatar}
              </div>
              <div className="flex-1 min-w-0 text-left">
                <p className="text-[11px] font-semibold text-slate-800 truncate leading-none">{activeBot.name}</p>
                <div className="flex items-center gap-1 mt-0.5">
                  <span className={clsx('w-1.5 h-1.5 rounded-full flex-shrink-0', STATUS_COLOR[activeBot.status]?.dot)} />
                  <p className="text-[10px] text-slate-400 truncate">{activeBot.number}</p>
                </div>
              </div>
              <ChevronDown size={12} className={clsx('text-slate-400 transition-transform flex-shrink-0', showBotPicker && 'rotate-180')} />
            </button>

            {showBotPicker && (
              <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-surface-border rounded-xl shadow-modal z-50 overflow-hidden animate-fade-in">
                <div className="px-3 py-2 border-b border-surface-border">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Switch Bot</p>
                </div>
                <div className="py-1 max-h-52 overflow-y-auto">
                  {bots.map(bot => (
                    <button key={bot.id} onClick={() => switchBot(bot.id)}
                      className="w-full flex items-center gap-2 px-3 py-1.5 hover:bg-surface-hover transition-colors text-left">
                      <div className="w-6 h-6 rounded-md flex items-center justify-center text-white text-[10px] font-bold flex-shrink-0"
                        style={{ background: bot.color }}>
                        {bot.avatar}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-slate-800 truncate leading-none">{bot.name}</p>
                        <div className="flex items-center gap-1 mt-0.5">
                          <span className={clsx('w-1.5 h-1.5 rounded-full flex-shrink-0', STATUS_COLOR[bot.status]?.dot)} />
                          <p className="text-[10px] text-slate-400">{STATUS_COLOR[bot.status]?.label}</p>
                        </div>
                      </div>
                      {bot.id === activeBotId && <Check size={11} className="text-primary flex-shrink-0" />}
                    </button>
                  ))}
                </div>
                <div className="border-t border-surface-border p-1.5">
                  <button onClick={() => { navigate('/'); setShowBotPicker(false) }}
                    className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-primary font-semibold hover:bg-primary-50 rounded-lg transition-colors">
                    <LayoutDashboard size={12} /> All Bots Overview
                  </button>
                  <button onClick={() => { navigate('/settings'); setShowBotPicker(false) }}
                    className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-slate-500 hover:bg-surface-hover rounded-lg transition-colors">
                    <Plus size={12} /> Add New Bot
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="flex flex-col items-center gap-1.5 py-2 border-b border-surface-border">
          {/* Collapsed product tabs */}
          <div className="flex flex-col gap-1">
            {products.map(product => {
              const Icon = ICON_MAP[product.icon]
              const isActive = product.id === activeProductId
              return (
                <button key={product.id} onClick={() => switchProduct(product.id)} title={product.name}
                  className={clsx('w-6 h-6 rounded-md flex items-center justify-center transition-colors',
                    isActive ? 'text-white' : 'text-slate-400 hover:bg-surface-hover')}
                  style={isActive ? { background: product.color } : undefined}>
                  {Icon && <Icon size={12} />}
                </button>
              )
            })}
          </div>
          <div className="w-full border-t border-surface-border my-0.5" />
          <button onClick={() => setShowBotPicker(p => !p)} title={activeBot.name} className="relative">
            <div className="w-7 h-7 rounded-lg flex items-center justify-center text-white text-[11px] font-bold"
              style={{ background: activeBot.color }}>
              {activeBot.avatar}
            </div>
            <span className={clsx('absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full border-2 border-white', STATUS_COLOR[activeBot.status]?.dot)} />
          </button>
        </div>
      )}

      {/* ── Navigation ── */}
      <nav className="flex-1 overflow-y-auto overscroll-contain py-2 px-2 space-y-0.5">
        {visibleNav.map(item => {
          const Icon = ICON_MAP[item.icon]
          return (
            <div key={item.id}>
              {item.dividerBefore && <div className="my-1.5 border-t border-surface-border mx-1" />}
              <NavLink
                to={item.path}
                end
                title={sidebarCollapsed ? item.label : undefined}
                onClick={handleNavClick}
                className={({ isActive }) =>
                  clsx('nav-item', isActive && 'active', sidebarCollapsed && 'justify-center px-2', 'max-md:!px-3 max-md:justify-start')
                }
              >
                {Icon && <Icon size={16} className="flex-shrink-0" />}
                {!sidebarCollapsed && (
                  <>
                    <span className="flex-1 truncate text-[12px]">{item.label}</span>
                    {item.badge && (
                      <span className={clsx('text-[10px] px-1.5 py-0.5 rounded-full font-semibold', BADGE_COLORS[item.badgeColor] || 'bg-slate-100 text-slate-500')}>
                        {item.badge}
                      </span>
                    )}
                  </>
                )}
              </NavLink>
            </div>
          )
        })}
      </nav>

      {/* ── Profile (single bottom section) ── */}
      <div ref={profileRef} className="border-t border-surface-border p-2 flex-shrink-0 relative">
        <button
          onClick={openProfile}
          className={clsx(
            'w-full flex items-center gap-2 p-1.5 rounded-lg transition-colors',
            showProfile ? 'bg-primary-50' : 'hover:bg-surface-hover',
            sidebarCollapsed && 'justify-center'
          )}
        >
          {/* Avatar with notification dot */}
          <div className="relative flex-shrink-0">
            <div className="w-7 h-7 rounded-full bg-primary flex items-center justify-center text-white text-[11px] font-bold">
              {user.initials}
            </div>
            {sidebarCollapsed && <span className={clsx('absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-white', dotCls)} title={PRESENCE[presence]?.label} />}
            {unreadCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 w-3.5 h-3.5 bg-red-500 rounded-full text-white text-[8px] font-bold flex items-center justify-center border border-white">
                {unreadCount}
              </span>
            )}
          </div>

          {!sidebarCollapsed && (
            <>
              <div className="flex-1 min-w-0 text-left">
                <p className="text-[11px] font-semibold text-slate-800 truncate leading-none">{user.name.split(' ')[0]}</p>
                <p className="text-[10px] text-slate-400 leading-none mt-0.5">{user.role}</p>
              </div>
              <div className={clsx('w-2 h-2 rounded-full flex-shrink-0', dotCls)} title={PRESENCE[presence]?.label} />
            </>
          )}
        </button>

        {/* ── Profile popup (portal: the sidebar would clip it) ── */}
        {showProfile && createPortal(
          <div ref={popupRef}
            className={clsx('fixed z-[60] bg-white border border-surface-border rounded-xl shadow-modal animate-fade-in overflow-hidden flex flex-col', activeProductId === 'instagram' && 'theme-instagram')}
            style={{ left: popPos.left, bottom: popPos.bottom, width: 300, maxWidth: 'calc(100vw - 16px)', maxHeight: popPos.maxHeight }}>

            {/* ── VIEW: Main menu ── */}
            {profileView === 'menu' && (
              <>
              <div className="overflow-y-auto min-h-0">
                {/* User + availability */}
                <div className="px-4 pt-3.5 pb-3 border-b border-surface-border bg-slate-50">
                  <div className="flex items-center gap-2.5">
                    <div className="relative flex-shrink-0">
                      <div className="w-9 h-9 rounded-full bg-primary flex items-center justify-center text-white text-xs font-bold">{user.initials}</div>
                      <span className={clsx('absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-slate-50', dotCls)} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-slate-900 text-xs truncate">{user.name}</p>
                      <p className="text-[10px] text-slate-500 truncate">{user.email}</p>
                    </div>
                    <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-white border border-surface-border text-slate-600 flex-shrink-0">{user.role}</span>
                  </div>

                  <div className="mt-3">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Your status</p>
                    <div className="grid grid-cols-3 gap-1 p-1 bg-white border border-surface-border rounded-lg" role="radiogroup" aria-label="Availability">
                      {Object.entries(PRESENCE).map(([key, p]) => (
                        <button key={key} role="radio" aria-checked={presence === key} onClick={() => setPresence(key)}
                          className={clsx('flex items-center justify-center gap-1.5 py-1.5 rounded-md text-[11px] font-semibold transition-colors',
                            presence === key ? 'bg-primary-50 text-primary ring-1 ring-primary/20' : 'text-slate-500 hover:bg-surface-hover')}>
                          <span className={clsx('w-1.5 h-1.5 rounded-full', p.dot)} /> {p.label}
                        </button>
                      ))}
                    </div>
                    <p className="text-[10px] text-slate-400 mt-1.5 leading-snug">{PRESENCE[presence]?.hint}</p>
                  </div>
                </div>

                {/* Plan */}
                <div className="px-3 pt-3 pb-1">
                  <div className="rounded-xl border border-surface-border p-3">
                    <div className="flex items-center justify-between gap-2">
                      <span className="inline-flex items-center gap-1.5 text-[11px] font-bold text-slate-800">
                        <CreditCard size={12} className="text-primary" />
                        {live ? sub.planName : 'Free'} plan
                        {live && <span className="text-[10px] font-semibold text-slate-400">· {sub.period === 'yearly' ? 'Yearly' : 'Monthly'}</span>}
                      </span>
                      {live && !sub.endsAt && sub.status === 'active' && <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-full px-1.5 py-0.5">Active</span>}
                    </div>
                    <p className={clsx('text-[11px] mt-1.5 leading-snug', planNote.tone)}>{planNote.text}</p>

                    {live && (
                      webOnly ? (
                        <p className="text-[10.5px] text-slate-400 mt-2">Website messages: unlimited</p>
                      ) : (
                        <div className="mt-2.5">
                          <div className="flex items-center justify-between text-[10.5px] text-slate-500 mb-1">
                            <span>WhatsApp messages{sub.period === 'yearly' ? ' this year' : ' this month'}</span>
                            <span className="tabular-nums font-semibold text-slate-700">{usedPct}%</span>
                          </div>
                          <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden"><div className="h-full bg-primary rounded-full" style={{ width: `${usedPct}%` }} /></div>
                          <p className="text-[10px] text-slate-400 mt-1 tabular-nums">{num(DEMO_USAGE.svcUsed)} of {num(pool)} used</p>
                        </div>
                      )
                    )}

                    <button onClick={() => goSettings('billing')}
                      className="mt-3 w-full flex items-center justify-center gap-1 py-1.5 rounded-lg text-[11px] font-bold text-primary bg-primary-50 hover:bg-primary-100 transition-colors">
                      {live ? 'Manage plan' : 'Choose a plan'} <ChevronRight size={11} />
                    </button>
                  </div>
                </div>

                {/* Notifications + help */}
                <div className="p-1.5 border-b border-surface-border">
                  <button onClick={() => setProfileView('notifications')}
                    className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg hover:bg-surface-hover transition-colors text-left">
                    <Bell size={13} className="text-slate-400 flex-shrink-0" />
                    <span className="flex-1 text-xs text-slate-600">Notifications</span>
                    {unreadCount > 0 && <span className="text-[10px] font-bold bg-red-500 text-white px-1.5 py-0.5 rounded-full">{unreadCount}</span>}
                    <ChevronRight size={11} className="text-slate-300 flex-shrink-0" />
                  </button>
                  <button className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg hover:bg-surface-hover transition-colors text-left">
                    <HelpCircle size={13} className="text-slate-400 flex-shrink-0" />
                    <span className="flex-1 text-xs text-slate-600">Help &amp; Support</span>
                    <ChevronRight size={11} className="text-slate-300 flex-shrink-0" />
                  </button>
                </div>

                {/* Account links */}
                <div className="p-1.5">
                  {ACCOUNT_LINKS.map(item => (
                    <button key={item.label} onClick={() => goSettings(item.section)}
                      className="w-full text-left flex items-center gap-2.5 px-3 py-1.5 text-xs text-slate-600 hover:text-slate-900 hover:bg-surface-hover rounded-lg transition-colors">
                      <item.icon size={12} className="text-slate-400 flex-shrink-0" />
                      {item.label}
                    </button>
                  ))}
                </div>
              </div>
              {/* Pinned, so it stays reachable when the menu scrolls on a short window */}
              <div className="flex-shrink-0 border-t border-surface-border p-1.5 bg-white">
                <button onClick={() => { setShowProfile(false); logout(); navigate('/signin') }}
                  className="w-full text-left flex items-center gap-2.5 px-3 py-1.5 text-xs text-red-500 hover:bg-red-50 rounded-lg transition-colors">
                  <LogOut size={12} className="flex-shrink-0" /> Sign Out
                </button>
              </div>
              </>
            )}

            {/* ── VIEW: Notifications ── */}
            {profileView === 'notifications' && (
              <>
                <div className="flex items-center gap-2 px-3 py-2.5 border-b border-surface-border">
                  <button onClick={() => setProfileView('menu')}
                    className="p-1 rounded-md text-slate-400 hover:text-slate-600 hover:bg-surface-hover transition-colors">
                    <ArrowLeft size={13} />
                  </button>
                  <span className="text-xs font-bold text-slate-800 flex-1">Notifications</span>
                  <button onClick={markAllRead}
                    className="flex items-center gap-1 text-[10px] text-primary font-semibold hover:underline">
                    <CheckCheck size={10} /> Mark all read
                  </button>
                </div>
                <div className="max-h-72 overflow-y-auto">
                  {notifications.length === 0 ? (
                    <div className="py-8 text-center">
                      <Bell size={20} className="mx-auto text-slate-300 mb-2" />
                      <p className="text-xs text-slate-400">No notifications</p>
                    </div>
                  ) : notifications.map(n => (
                    <div key={n.id} className={clsx(
                      'flex items-start gap-2.5 px-4 py-2.5 border-b border-surface-border last:border-0 hover:bg-surface-hover transition-colors cursor-pointer',
                      !n.read && 'bg-primary-50/40'
                    )}>
                      <div className={clsx('w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0', !n.read ? 'bg-primary' : 'bg-transparent')} />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs text-slate-700 leading-relaxed">{n.text}</p>
                        <p className="text-[10px] text-slate-400 mt-0.5">{n.time}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>,
          document.body,
        )}
      </div>
    </aside>
  )
}
