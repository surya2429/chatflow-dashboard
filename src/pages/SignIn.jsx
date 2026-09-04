import { useState } from 'react'
import { Zap, Mail, Lock, Eye, EyeOff, ArrowRight, CheckCircle2, MessageSquare, BarChart2, Users, Shield } from 'lucide-react'
import { useAuth, DEMO_USERS } from '../context/AuthContext'
import clsx from 'clsx'

const ROLE_COLORS = {
  admin:      { bg: 'bg-blue-50',   border: 'border-blue-200',   ring: 'ring-blue-500/20',   badge: 'bg-blue-600',   text: 'text-blue-700'   },
  supervisor: { bg: 'bg-violet-50', border: 'border-violet-200', ring: 'ring-violet-500/20', badge: 'bg-violet-600', text: 'text-violet-700' },
  agent:      { bg: 'bg-emerald-50',border: 'border-emerald-200',ring: 'ring-emerald-500/20',badge: 'bg-emerald-600',text: 'text-emerald-700' },
}

const FEATURES = [
  { icon: MessageSquare, label: 'Unified Inbox',     desc: 'Manage all WhatsApp conversations in one place' },
  { icon: BarChart2,     label: 'Real-time Analytics', desc: 'Live metrics, CSAT scores & bot performance'    },
  { icon: Users,         label: 'Team Management',   desc: 'Role-based access for admins, supervisors & agents' },
  { icon: Shield,        label: 'Secure & Reliable', desc: 'Enterprise-grade security with 99.9% uptime'     },
]

export default function SignIn() {
  const { login, loginAs } = useAuth()
  const [email,     setEmail]     = useState('')
  const [password,  setPassword]  = useState('')
  const [showPass,  setShowPass]  = useState(false)
  const [error,     setError]     = useState('')
  const [loading,   setLoading]   = useState(false)
  const [activeRole, setActiveRole] = useState(null)

  function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setLoading(true)
    setTimeout(() => {
      const result = login(email, password)
      if (!result.ok) setError(result.error)
      setLoading(false)
    }, 600)
  }

  function handleQuickLogin(user) {
    setActiveRole(user.role)
    setError('')
    setTimeout(() => {
      loginAs(user)
    }, 400)
  }

  function fillCredentials(user) {
    setEmail(user.email)
    setPassword(user.password)
    setError('')
  }

  return (
    <div className="min-h-screen flex">

      {/* ── Left panel — Brand ── */}
      <div className="hidden lg:flex lg:w-[52%] flex-col bg-slate-900 relative overflow-hidden">
        {/* Background pattern */}
        <div className="absolute inset-0 opacity-[0.04]"
          style={{ backgroundImage: 'radial-gradient(circle at 1px 1px, white 1px, transparent 0)', backgroundSize: '32px 32px' }} />
        {/* Glow blobs */}
        <div className="absolute top-[-80px] left-[-80px] w-[400px] h-[400px] rounded-full opacity-20"
          style={{ background: 'radial-gradient(circle, #0066ff, transparent 70%)' }} />
        <div className="absolute bottom-[-80px] right-[-40px] w-[320px] h-[320px] rounded-full opacity-15"
          style={{ background: 'radial-gradient(circle, #8B5CF6, transparent 70%)' }} />

        <div className="relative z-10 flex flex-col h-full px-12 py-10">
          {/* Logo */}
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-primary rounded-xl flex items-center justify-center shadow-lg">
              <Zap size={18} className="text-white" />
            </div>
            <div>
              <span className="font-bold text-white text-lg leading-none">ChatFlow</span>
              <p className="text-[11px] text-slate-400 leading-none mt-0.5">WhatsApp Business Platform</p>
            </div>
          </div>

          {/* Hero text */}
          <div className="mt-16">
            <h1 className="text-[36px] font-bold text-white leading-tight">
              Automate your<br/>
              <span className="text-primary">WhatsApp</span> support
            </h1>
            <p className="text-slate-400 mt-4 text-[15px] leading-relaxed max-w-sm">
              The all-in-one platform to manage conversations, deploy bots, broadcast campaigns and grow your business on WhatsApp.
            </p>
          </div>

          {/* Features */}
          <div className="mt-10 space-y-4">
            {FEATURES.map(f => (
              <div key={f.label} className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center flex-shrink-0">
                  <f.icon size={14} className="text-primary" />
                </div>
                <div>
                  <p className="text-[13px] font-semibold text-white">{f.label}</p>
                  <p className="text-[11px] text-slate-400 mt-0.5">{f.desc}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Bottom stat strip */}
          <div className="mt-auto pt-10 flex items-center gap-8 border-t border-white/10">
            {[['10K+', 'Businesses'], ['500M+', 'Messages/mo'], ['99.9%', 'Uptime']].map(([val, lbl]) => (
              <div key={lbl}>
                <p className="text-[22px] font-bold text-white leading-none">{val}</p>
                <p className="text-[11px] text-slate-400 mt-0.5">{lbl}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Right panel — Form ── */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 py-12 bg-white overflow-y-auto">
        <div className="w-full max-w-[400px]">

          {/* Mobile logo */}
          <div className="flex items-center gap-2.5 mb-8 lg:hidden">
            <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
              <Zap size={15} className="text-white" />
            </div>
            <span className="font-bold text-slate-900 text-base">ChatFlow</span>
          </div>

          <h2 className="text-[26px] font-bold text-slate-900 leading-tight">Welcome back</h2>
          <p className="text-slate-500 text-sm mt-1">Sign in to your workspace</p>

          {/* ── Quick role login ── */}
          <div className="mt-6">
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-3">Quick sign-in by role</p>
            <div className="space-y-2">
              {DEMO_USERS.map(user => {
                const c = ROLE_COLORS[user.role]
                const isActive = activeRole === user.role
                return (
                  <div key={user.role} className={clsx(
                    'flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all duration-200 group',
                    c.bg, c.border,
                    isActive && `ring-2 ${c.ring} scale-[0.99]`
                  )}>
                    {/* Avatar */}
                    <div className="w-9 h-9 rounded-full flex items-center justify-center text-white text-[12px] font-bold flex-shrink-0"
                      style={{ background: user.color }}>
                      {user.initials}
                    </div>
                    {/* Info */}
                    <div className="flex-1 min-w-0" onClick={() => fillCredentials(user)}>
                      <div className="flex items-center gap-2">
                        <p className="text-[13px] font-semibold text-slate-800">{user.name}</p>
                        <span className={clsx('text-[9px] font-bold text-white px-1.5 py-0.5 rounded-full', c.badge)}>
                          {user.roleLabel}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500 truncate mt-0.5">{user.desc}</p>
                    </div>
                    {/* Login button */}
                    <button
                      onClick={() => handleQuickLogin(user)}
                      className={clsx(
                        'flex items-center gap-1 px-3 py-1.5 rounded-lg text-[11px] font-semibold transition-all flex-shrink-0',
                        'bg-white border shadow-sm hover:shadow group-hover:scale-105',
                        c.text, c.border
                      )}
                    >
                      {isActive
                        ? <><CheckCircle2 size={11}/> Signing in…</>
                        : <>Login <ArrowRight size={11}/></>
                      }
                    </button>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Divider */}
          <div className="flex items-center gap-3 my-6">
            <div className="flex-1 h-px bg-slate-100"/>
            <span className="text-[11px] text-slate-400 font-medium">or sign in with credentials</span>
            <div className="flex-1 h-px bg-slate-100"/>
          </div>

          {/* ── Credential form ── */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Email */}
            <div>
              <label className="block text-[11px] font-semibold text-slate-600 mb-1.5">Email address</label>
              <div className="relative">
                <Mail size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={e => { setEmail(e.target.value); setError('') }}
                  placeholder="you@company.com"
                  className="w-full pl-9 pr-4 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all placeholder-slate-400"
                />
              </div>
            </div>

            {/* Password */}
            <div>
              <label className="block text-[11px] font-semibold text-slate-600 mb-1.5">Password</label>
              <div className="relative">
                <Lock size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type={showPass ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={e => { setPassword(e.target.value); setError('') }}
                  placeholder="••••••••"
                  className="w-full pl-9 pr-10 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all placeholder-slate-400"
                />
                <button type="button" onClick={() => setShowPass(p => !p)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors">
                  {showPass ? <EyeOff size={13}/> : <Eye size={13}/>}
                </button>
              </div>
            </div>

            {/* Error */}
            {error && (
              <div className="flex items-center gap-2 px-3 py-2.5 bg-red-50 border border-red-100 rounded-xl">
                <div className="w-1.5 h-1.5 rounded-full bg-red-500 flex-shrink-0"/>
                <p className="text-[12px] text-red-600">{error}</p>
              </div>
            )}

            {/* Forgot */}
            <div className="flex justify-end">
              <button type="button" className="text-[11px] text-primary hover:underline font-medium">
                Forgot password?
              </button>
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              className={clsx(
                'w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold transition-all',
                loading
                  ? 'bg-primary/70 text-white cursor-not-allowed'
                  : 'bg-primary text-white hover:bg-primary-hover shadow-btn hover:shadow-md'
              )}
            >
              {loading ? (
                <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"/> Signing in…</>
              ) : (
                <>Sign In <ArrowRight size={14}/></>
              )}
            </button>
          </form>

          {/* Footer */}
          <p className="text-center text-[11px] text-slate-400 mt-8">
            © 2026 ChatFlow · WhatsApp Business Platform
          </p>
        </div>
      </div>

    </div>
  )
}
