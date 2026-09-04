import { useState } from 'react'
import { useLocation } from 'react-router-dom'
import { Bell, Search, ChevronDown, Plus, X, CheckCheck, CreditCard, HelpCircle } from 'lucide-react'
import { useApp } from '../context/AppContext'
import clsx from 'clsx'

const PAGE_TITLES = {
  '/':              'My Bots',
  '/dashboard':     'Dashboard',
  '/conversations': 'Inbox',
  '/contacts':      'Contacts',
  '/broadcasting':  'Broadcasts',
  '/flows':         'Automation',
  '/templates':     'Templates',
  '/catalog':       'Catalog',
  '/analytics':     'Analytics',
  '/integrations':  'Integrations',
  '/voice':         'Voice Bot',
  '/installation':  'Installation',
  '/settings':      'Settings',
  '/channels':      'Channels',
}

// Pages that are bot-scoped (show bot context pill)
const BOT_SCOPED = ['/dashboard','/conversations','/contacts','/broadcasting','/flows','/templates','/catalog','/analytics','/voice']

export default function Topbar() {
  const { user, notifications, unreadCount, markAllRead, activeBot } = useApp()
  const location = useLocation()
  const [showNotifs, setShowNotifs] = useState(false)
  const [showProfile, setShowProfile] = useState(false)

  const title = PAGE_TITLES[location.pathname] ||
    Object.entries(PAGE_TITLES).find(([k]) => k !== '/' && location.pathname.startsWith(k))?.[1] || 'Dashboard'

  const isBotScoped = BOT_SCOPED.some(p => location.pathname.startsWith(p))

  return (
    <header className="h-[60px] bg-white border-b border-surface-border flex items-center justify-between px-5 flex-shrink-0">
      {/* Left */}
      <div className="flex items-center gap-3">
        <h1 className="text-base font-semibold text-slate-900">{title}</h1>

        {/* Bot context pill — shown on bot-scoped pages */}
        {isBotScoped && activeBot && (
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs font-semibold"
            style={{ borderColor: activeBot.color + '44', background: activeBot.bg, color: activeBot.color }}>
            <span style={{ width:6, height:6, borderRadius:'50%', background: activeBot.color, display:'inline-block' }}/>
            {activeBot.name}
          </div>
        )}

        <span className="text-slate-300">|</span>
        <div className="relative hidden sm:block">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search..."
            className="pl-8 pr-3 py-1.5 text-xs bg-surface border border-surface-border rounded-lg w-52 focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 text-slate-700 placeholder-slate-400"
          />
        </div>
      </div>

      {/* Right */}
      <div className="flex items-center gap-1.5">
        {/* Credits */}
        <div className="hidden md:flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-surface border border-surface-border text-xs text-slate-600">
          <CreditCard size={12} className="text-primary" />
          <span className="font-medium">{user.creditBalance.toLocaleString()}</span>
          <span className="text-slate-400">credits</span>
        </div>

        {/* Help */}
        <button className="p-2 rounded-lg text-slate-500 hover:text-slate-700 hover:bg-surface-hover transition-colors">
          <HelpCircle size={17} />
        </button>

        {/* Notifications */}
        <div className="relative">
          <button
            onClick={() => { setShowNotifs(p => !p); setShowProfile(false) }}
            className="p-2 rounded-lg text-slate-500 hover:text-slate-700 hover:bg-surface-hover transition-colors relative"
          >
            <Bell size={17} />
            {unreadCount > 0 && (
              <span className="absolute top-1 right-1 w-4 h-4 bg-red-500 rounded-full text-white text-[9px] font-bold flex items-center justify-center">
                {unreadCount}
              </span>
            )}
          </button>

          {showNotifs && (
            <div className="absolute right-0 top-11 w-80 max-w-[calc(100vw-1rem)] bg-white border border-surface-border rounded-xl shadow-modal z-50 animate-fade-in overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3 border-b border-surface-border">
                <span className="font-semibold text-slate-900 text-sm">Notifications</span>
                <div className="flex items-center gap-2">
                  <button onClick={markAllRead} className="text-xs text-primary hover:underline flex items-center gap-1">
                    <CheckCheck size={11} /> Mark all read
                  </button>
                  <button onClick={() => setShowNotifs(false)} className="text-slate-400 hover:text-slate-600 p-0.5">
                    <X size={13} />
                  </button>
                </div>
              </div>
              <div className="max-h-72 overflow-y-auto">
                {notifications.map(n => (
                  <div key={n.id} className={clsx(
                    'flex items-start gap-3 px-4 py-3 border-b border-surface-border last:border-0 hover:bg-surface-hover transition-colors',
                    !n.read && 'bg-primary-50/50'
                  )}>
                    {!n.read && <div className="w-2 h-2 rounded-full bg-primary mt-1.5 flex-shrink-0" />}
                    {n.read && <div className="w-2 h-2 flex-shrink-0 mt-1.5" />}
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-slate-700 leading-relaxed">{n.text}</p>
                      <p className="text-[10px] text-slate-400 mt-0.5">{n.time}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Profile */}
        <div className="relative">
          <button
            onClick={() => { setShowProfile(p => !p); setShowNotifs(false) }}
            className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-surface-hover transition-colors"
          >
            <div className="w-7 h-7 rounded-full bg-primary flex items-center justify-center text-white text-xs font-bold">
              {user.initials}
            </div>
            <div className="hidden sm:block text-left">
              <p className="text-xs font-semibold text-slate-800 leading-none">{user.name.split(' ')[0]}</p>
              <p className="text-[10px] text-slate-400 leading-none mt-0.5">{user.role}</p>
            </div>
            <ChevronDown size={12} className="text-slate-400" />
          </button>

          {showProfile && (
            <div className="absolute right-0 top-11 w-56 bg-white border border-surface-border rounded-xl shadow-modal z-50 animate-fade-in overflow-hidden">
              <div className="px-4 py-3 border-b border-surface-border bg-surface">
                <p className="font-semibold text-slate-900 text-sm">{user.name}</p>
                <p className="text-xs text-slate-500 mt-0.5">{user.email}</p>
                <span className="inline-block mt-1.5 badge badge-blue">{user.workspace.plan} Plan</span>
              </div>
              <div className="p-1.5">
                {['Profile', 'Workspace Settings', 'Billing', 'API Keys', 'Team Members'].map(item => (
                  <button key={item} onClick={() => setShowProfile(false)} className="w-full text-left px-3 py-2 text-xs text-slate-600 hover:text-slate-900 hover:bg-surface-hover rounded-lg transition-colors">
                    {item}
                  </button>
                ))}
                <div className="border-t border-surface-border mt-1 pt-1">
                  <button className="w-full text-left px-3 py-2 text-xs text-red-500 hover:bg-red-50 rounded-lg transition-colors">
                    Sign Out
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  )
}
