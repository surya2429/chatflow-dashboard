import { useState, useEffect, useRef } from 'react'
import {
  Phone, Plus, Copy, Check, ChevronDown, ExternalLink,
  X, CheckCircle2, Loader2, Wifi, WifiOff,
  Shield, BarChart2, MessageSquare, Activity,
  ArrowRight, RefreshCw, Bell, AlertTriangle,
  Star, TrendingUp, Clock, Info, ChevronRight,
} from 'lucide-react'
import clsx from 'clsx'

/* ─── Internal SDK config — never shown to users ─────────────── */
const APP_CONFIG = {
  appId:      '393397129404628',
  configId:   '1672466256848759',
  apiVersion: 'v25.0',
}

/* ─── Subscribed webhook fields ──────────────────────────────── */
const SUBSCRIBED_FIELDS = [
  { key: 'messages',                          label: 'Messages',                    desc: 'Incoming messages from customers'         },
  { key: 'message_template_status_update',    label: 'Template Status',             desc: 'Template approval / rejection updates'   },
  { key: 'message_template_quality_update',   label: 'Template Quality',            desc: 'Template quality score changes'           },
  { key: 'phone_number_quality_update',       label: 'Number Quality',              desc: 'Phone number quality rating changes'      },
  { key: 'phone_number_name_update',          label: 'Display Name',                desc: 'Business display name status updates'     },
  { key: 'account_update',                    label: 'Account Updates',             desc: 'WABA account status changes'              },
  { key: 'account_review_update',             label: 'Account Review',              desc: 'Business account review status'           },
  { key: 'account_alerts',                    label: 'Account Alerts',              desc: 'Platform alerts and notifications'        },
  { key: 'account_settings_update',           label: 'Account Settings',            desc: 'Settings modifications'                   },
  { key: 'flows',                             label: 'WhatsApp Flows',              desc: 'Flow interactions and completions'        },
  { key: 'calls',                             label: 'Calls',                       desc: 'WhatsApp call events'                     },
  { key: 'security',                          label: 'Security',                    desc: 'Security-related notifications'           },
  { key: 'business_capability_update',        label: 'Business Capabilities',       desc: 'Feature availability changes'             },
  { key: 'business_status_update',            label: 'Business Status',             desc: 'Overall business account status'          },
  { key: 'automatic_events',                  label: 'Automatic Events',            desc: 'System-generated event triggers'          },
  { key: 'payment_configuration_update',      label: 'Payments',                    desc: 'Payment config and status updates'        },
  { key: 'template_category_update',          label: 'Template Category',           desc: 'Template category reclassification'       },
  { key: 'template_correct_category_detection', label: 'Category Detection',        desc: 'Auto-detected correct template category'  },
  { key: 'message_template_components_update', label: 'Template Components',        desc: 'Template structure/component changes'     },
  { key: 'tracking_events',                  label: 'Tracking Events',             desc: 'Analytics and tracking data'              },
  { key: 'partner_solutions',                label: 'Partner Solutions',            desc: 'Partner platform event updates'           },
  { key: 'history',                          label: 'Message History',              desc: 'Historical message sync events'           },
  { key: 'user_preferences',                 label: 'User Preferences',            desc: 'Customer preference updates'              },
  { key: 'smb_message_echoes',               label: 'Message Echoes',              desc: 'Echo of outbound messages'                },
  { key: 'smb_app_state_sync',               label: 'App State Sync',              desc: 'Application state synchronization'        },
  { key: 'group_lifecycle_update',           label: 'Group Lifecycle',             desc: 'Group creation and deletion events'       },
  { key: 'group_participants_update',        label: 'Group Participants',           desc: 'Members joining or leaving groups'        },
  { key: 'group_settings_update',            label: 'Group Settings',              desc: 'Group name, description changes'          },
  { key: 'group_status_update',              label: 'Group Status',                desc: 'Group status and activity updates'        },
]

/* ─── Quality + Tier maps ────────────────────────────────────── */
const QUALITY = {
  GREEN:  { label: 'High',   color: 'text-emerald-700', bg: 'bg-emerald-50', border: 'border-emerald-200', dot: 'bg-emerald-500', bar: 'bg-emerald-500', barW: 'w-full'    },
  YELLOW: { label: 'Medium', color: 'text-amber-700',   bg: 'bg-amber-50',   border: 'border-amber-200',   dot: 'bg-amber-400',   bar: 'bg-amber-400',   barW: 'w-2/3'     },
  RED:    { label: 'Low',    color: 'text-red-700',     bg: 'bg-red-50',     border: 'border-red-200',     dot: 'bg-red-500',     bar: 'bg-red-500',     barW: 'w-1/3'     },
}
const TIER_LABEL = {
  TIER_1K:        '1,000 / day',
  TIER_10K:       '10,000 / day',
  TIER_100K:      '100,000 / day',
  TIER_UNLIMITED: 'Unlimited',
}

/* ─── Mock connected numbers ─────────────────────────────────── */
const INITIAL_NUMBERS = [
  {
    id: 'n1',
    displayNumber: '+91 98765 43210',
    verifiedName:  'ChatFlow Business',
    wabaId:        '387654321098765',
    phoneNumberId: '498765432109876',
    status:        'CONNECTED',
    qualityRating: 'GREEN',
    namingStatus:  'APPROVED',
    messagingLimitTier: 'TIER_100K',
    country:       'India',
    timezone:      'Asia/Kolkata',
    webhookStatus: 'ACTIVE',
    addedOn:       'Jan 12, 2025',
    lastMessage:   '2 min ago',
    msgsToday:     6840,
    msgsThisMonth: 184200,
    resolvedToday: 42,
  },
  {
    id: 'n2',
    displayNumber: '+91 87654 32109',
    verifiedName:  'ChatFlow Support',
    wabaId:        '276543210987654',
    phoneNumberId: '387654321098765',
    status:        'CONNECTED',
    qualityRating: 'YELLOW',
    namingStatus:  'APPROVED',
    messagingLimitTier: 'TIER_10K',
    country:       'India',
    timezone:      'Asia/Kolkata',
    webhookStatus: 'ACTIVE',
    addedOn:       'Feb 5, 2025',
    lastMessage:   '1 hr ago',
    msgsToday:     1580,
    msgsThisMonth: 38500,
    resolvedToday: 18,
  },
]

/* ─── Connect Modal ──────────────────────────────────────────── */
function ConnectModal({ onClose, onConnected }) {
  const [step, setStep]           = useState('launch')   // launch | waiting | success
  const [newNumber, setNewNumber] = useState(null)
  const [error, setError]         = useState(null)

  // Real session info from Meta Embedded Signup message event
  const sessionRef = useRef({})

  useEffect(() => {
    const handleMessage = (event) => {
      if (event.origin !== 'https://www.facebook.com') return
      try {
        const data = JSON.parse(event.data)
        if (data.type === 'WA_EMBEDDED_SIGNUP') {
          sessionRef.current = data.data || {}
        }
      } catch { /* ignore */ }
    }
    window.addEventListener('message', handleMessage)
    return () => window.removeEventListener('message', handleMessage)
  }, [])

  const fbLoginCallback = (response) => {
    if (response?.authResponse?.code) {
      // Got the auth code + session data — show success
      const session = sessionRef.current
      setNewNumber({
        id: `n${Date.now()}`,
        displayNumber: session.phone_number || 'Verifying…',
        verifiedName:  session.business_name || 'Your Business',
        wabaId:        session.waba_id || '—',
        phoneNumberId: session.phone_number_id || '—',
        status:        'CONNECTED',
        qualityRating: 'GREEN',
        namingStatus:  'APPROVED',
        messagingLimitTier: 'TIER_1K',
        country:       'India',
        timezone:      'Asia/Kolkata',
        webhookStatus: 'ACTIVE',
        addedOn:       new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }),
        lastMessage:   'Just now',
        msgsToday:     0,
        msgsThisMonth: 0,
        resolvedToday: 0,
      })
      setStep('success')
    } else {
      setStep('launch')
    }
  }

  function launchSignup() {
    setStep('waiting')
    setError(null)

    const startFlow = () => {
      try {
        window.FB.login(fbLoginCallback, {
          config_id: APP_CONFIG.configId,
          response_type: 'code',
          override_default_response_type: true,
          extras: { version: 'v4' },
        })
      } catch (e) {
        setError('Could not open Meta. Please disable your pop-up blocker and try again.')
        setStep('launch')
      }
    }

    if (typeof window.FB !== 'undefined') {
      startFlow()
    } else {
      // Wait for SDK to init
      let waited = 0
      const poll = setInterval(() => {
        waited += 200
        if (typeof window.FB !== 'undefined') { clearInterval(poll); startFlow() }
        if (waited > 5000) { clearInterval(poll); setError('Meta SDK failed to load. Check your connection.'); setStep('launch') }
      }, 200)
    }
  }

  function handleDone() {
    if (newNumber) onConnected(newNumber)
    onClose()
  }

  return (
    <div className="fixed inset-0 bg-slate-900/25 z-50 flex items-center justify-center p-4"
      onClick={e => e.target === e.currentTarget && step !== 'waiting' && onClose()}>
      <div className="bg-white rounded-2xl w-full max-w-md shadow-modal animate-fade-in overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-surface-border">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: '#0866ff' }}>
              <Phone size={16} className="text-white" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-sm">
                {step === 'launch'  && 'Connect WhatsApp Number'}
                {step === 'waiting' && 'Connecting…'}
                {step === 'success' && 'Number Connected!'}
              </h3>
              <p className="text-[11px] text-slate-400 mt-0.5">
                {step === 'launch'  && 'Link a WhatsApp Business number to ChatFlow'}
                {step === 'waiting' && 'Please complete the steps in the Meta window'}
                {step === 'success' && 'Your number is active and ready to use'}
              </p>
            </div>
          </div>
          {step !== 'waiting' && (
            <button onClick={onClose} className="p-2 rounded-lg hover:bg-surface-hover text-slate-400 hover:text-slate-600 transition-colors">
              <X size={15} />
            </button>
          )}
        </div>

        {/* ── Launch ── */}
        {step === 'launch' && (
          <div className="p-5 space-y-5">
            {error && (
              <div className="flex items-start gap-2.5 p-3 rounded-xl bg-red-50 border border-red-200">
                <AlertTriangle size={15} className="text-red-500 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-red-700">{error}</p>
              </div>
            )}

            {/* Steps */}
            <div className="space-y-3">
              {[
                { icon: '1', text: 'A Meta window will open — log in with your Facebook account' },
                { icon: '2', text: 'Select or create your WhatsApp Business Account (WABA)' },
                { icon: '3', text: 'Add your phone number and verify it via OTP' },
                { icon: '4', text: 'Done! Your number will appear here automatically' },
              ].map(({ icon, text }) => (
                <div key={icon} className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-primary-50 border border-primary/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <span className="text-[11px] font-bold text-primary">{icon}</span>
                  </div>
                  <p className="text-sm text-slate-600 leading-snug">{text}</p>
                </div>
              ))}
            </div>

            <div className="p-3 rounded-xl bg-slate-50 border border-surface-border flex items-start gap-2.5">
              <Info size={14} className="text-slate-400 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-slate-500 leading-relaxed">
                Make sure pop-ups are allowed for this site. The Meta window needs to open in a new tab.
              </p>
            </div>

            {/* CTA */}
            <button onClick={launchSignup}
              className="w-full flex items-center justify-center gap-2.5 py-3 rounded-xl font-bold text-white text-sm transition-all hover:opacity-90 active:scale-95"
              style={{ background: 'linear-gradient(135deg, #0866ff 0%, #1877f2 100%)' }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="white">
                <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
              </svg>
              Continue with Meta
            </button>
            <p className="text-center text-[11px] text-slate-400">Secure · Powered by Meta</p>
          </div>
        )}

        {/* ── Waiting ── */}
        {step === 'waiting' && (
          <div className="px-5 py-10 flex flex-col items-center text-center">
            <div className="relative w-20 h-20 mb-6">
              <div className="absolute inset-0 rounded-full border-4 border-primary/10" />
              <div className="absolute inset-0 rounded-full border-4 border-primary border-t-transparent animate-spin" />
              <div className="absolute inset-2 rounded-full bg-primary-50 flex items-center justify-center">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="#0066ff">
                  <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
                </svg>
              </div>
            </div>
            <p className="font-bold text-slate-900 text-base mb-2">Meta window is open</p>
            <p className="text-sm text-slate-500 max-w-xs leading-relaxed">
              Complete the setup in the Meta window. This page will update automatically once done.
            </p>
            <p className="mt-6 text-xs text-slate-400">Don't close this page</p>
          </div>
        )}

        {/* ── Success ── */}
        {step === 'success' && newNumber && (
          <div className="p-5 space-y-4">
            <div className="text-center py-2">
              <div className="w-16 h-16 rounded-2xl bg-emerald-50 border border-emerald-200 flex items-center justify-center mx-auto mb-4">
                <CheckCircle2 size={36} className="text-emerald-500" />
              </div>
              <h3 className="font-bold text-slate-900 text-base mb-1">You're all set!</h3>
              <p className="text-sm text-slate-500">Your WhatsApp number is now connected to ChatFlow.</p>
            </div>

            {/* Number card */}
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 space-y-2.5">
              <div className="flex items-center justify-between">
                <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Connected Number</p>
                <span className="badge badge-green text-[10px] flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> Active
                </span>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-white border border-emerald-200 flex items-center justify-center flex-shrink-0">
                  <Phone size={18} className="text-emerald-600" />
                </div>
                <div>
                  <p className="font-bold text-slate-900">{newNumber.displayNumber}</p>
                  <p className="text-xs text-slate-500">{newNumber.verifiedName}</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2 pt-1">
                {[
                  { label: 'Webhook',     val: '✓ Connected'    },
                  { label: 'Messaging',   val: '✓ Enabled'      },
                  { label: 'Daily Limit', val: '1,000 messages' },
                  { label: 'Status',      val: 'Active'         },
                ].map(({ label, val }) => (
                  <div key={label}>
                    <p className="text-[10px] text-slate-400">{label}</p>
                    <p className="text-xs font-semibold text-emerald-700">{val}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex gap-2.5">
              <button onClick={onClose} className="btn-secondary flex-1 justify-center text-sm">Close</button>
              <button onClick={handleDone} className="btn-primary flex-1 justify-center text-sm">
                View Number <ArrowRight size={13} />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

/* ─── Number Detail Drawer ───────────────────────────────────── */
function NumberDrawer({ number, onClose, onDisconnect }) {
  const [activeTab, setActiveTab]         = useState('overview')
  const [testing, setTesting]             = useState(false)
  const [testResult, setTestResult]       = useState(null)
  const [disconnectConfirm, setDisconnectConfirm] = useState(false)
  const [refreshing, setRefreshing]       = useState(false)

  const q = QUALITY[number.qualityRating]

  function testConnection() {
    setTesting(true)
    setTestResult(null)
    setTimeout(() => {
      setTesting(false)
      setTestResult({ ok: true, latency: Math.floor(30 + Math.random() * 60) })
    }, 1800)
  }

  function handleRefresh() {
    setRefreshing(true)
    setTimeout(() => setRefreshing(false), 1200)
  }

  const tierInfo = {
    TIER_1K:        { msgs: '1,000',   next: '10,000',   progress: 15  },
    TIER_10K:       { msgs: '10,000',  next: '100,000',  progress: 45  },
    TIER_100K:      { msgs: '100,000', next: 'Unlimited', progress: 80  },
    TIER_UNLIMITED: { msgs: '∞',       next: null,        progress: 100 },
  }[number.messagingLimitTier]

  return (
    <div className="fixed inset-0 z-40 flex justify-end">
      <div className="absolute inset-0 bg-slate-900/15" onClick={onClose} />
      <div className="relative w-[460px] h-full bg-white border-l border-surface-border flex flex-col shadow-modal overflow-hidden animate-fade-in">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-surface-border flex-shrink-0 bg-white">
          <div className="flex items-center gap-3">
            <div className="relative">
              <div className="w-10 h-10 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-center">
                <Phone size={18} className="text-emerald-600" />
              </div>
              <span className={clsx('absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-white',
                number.status === 'CONNECTED' ? 'bg-emerald-500' : 'bg-slate-300')} />
            </div>
            <div>
              <p className="font-bold text-slate-900 text-sm">{number.displayNumber}</p>
              <p className="text-[11px] text-slate-500">{number.verifiedName}</p>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <button onClick={handleRefresh} title="Refresh"
              className="p-2 rounded-lg hover:bg-surface-hover text-slate-400 hover:text-slate-600 transition-colors">
              <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} />
            </button>
            <button onClick={onClose}
              className="p-2 rounded-lg hover:bg-surface-hover text-slate-400 hover:text-slate-600 transition-colors">
              <X size={15} />
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-surface-border flex-shrink-0">
          {[
            ['overview',   'Overview'],
            ['events',     'Events & Alerts'],
            ['settings',   'Settings'],
          ].map(([k, lbl]) => (
            <button key={k} onClick={() => setActiveTab(k)}
              className={clsx('flex-1 py-3 text-xs font-semibold transition-colors border-b-2',
                activeTab === k ? 'border-primary text-primary' : 'border-transparent text-slate-500 hover:text-slate-700')}>
              {lbl}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">

          {/* ── Overview ── */}
          {activeTab === 'overview' && (
            <div className="p-5 space-y-5">

              {/* Status cards */}
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3.5">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Status</p>
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                    <span className="text-sm font-bold text-emerald-700">Active</span>
                  </div>
                  <p className="text-[10px] text-slate-400 mt-1">Since {number.addedOn}</p>
                </div>
                <div className={clsx('rounded-xl border p-3.5', q.bg, q.border)}>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Quality Rating</p>
                  <div className="flex items-center gap-2">
                    <span className={clsx('w-2.5 h-2.5 rounded-full', q.dot)} />
                    <span className={clsx('text-sm font-bold', q.color)}>{q.label}</span>
                  </div>
                  {/* Quality bar */}
                  <div className="mt-2 h-1 rounded-full bg-white/60">
                    <div className={clsx('h-1 rounded-full transition-all', q.bar, q.barW)} />
                  </div>
                </div>
              </div>

              {/* Stats */}
              <div className="grid grid-cols-3 gap-3">
                {[
                  { icon: MessageSquare, label: 'Today',      value: number.msgsToday.toLocaleString(),     color: 'text-primary',     bg: 'bg-primary-50'   },
                  { icon: TrendingUp,    label: 'This Month', value: number.msgsThisMonth.toLocaleString(), color: 'text-blue-600',    bg: 'bg-blue-50'      },
                  { icon: CheckCircle2,  label: 'Resolved',   value: number.resolvedToday.toString(),       color: 'text-emerald-600', bg: 'bg-emerald-50'   },
                ].map(({ icon: Icon, label, value, color, bg }) => (
                  <div key={label} className={clsx('rounded-xl p-3 border border-white/80', bg)}>
                    <Icon size={15} className={clsx('mb-1.5', color)} />
                    <p className={clsx('text-lg font-extrabold', color)}>{value}</p>
                    <p className="text-[10px] text-slate-500 mt-0.5">{label}</p>
                  </div>
                ))}
              </div>

              {/* Messaging limit / tier */}
              <div className="rounded-xl border border-surface-border p-4">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-xs font-bold text-slate-700">Messaging Limit</p>
                  <span className="badge badge-blue text-[10px]">{TIER_LABEL[number.messagingLimitTier]}</span>
                </div>
                <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
                  <div className="h-2 rounded-full bg-primary transition-all" style={{ width: `${tierInfo.progress}%` }} />
                </div>
                <div className="flex items-center justify-between mt-2">
                  <p className="text-[11px] text-slate-500">Current: <strong>{tierInfo.msgs}</strong> / day</p>
                  {tierInfo.next && <p className="text-[11px] text-primary font-medium">Next tier: {tierInfo.next}</p>}
                </div>
                <p className="text-[10px] text-slate-400 mt-1.5">
                  Limits increase automatically as your quality rating stays high and volume grows.
                </p>
              </div>

              {/* Connection health */}
              <div>
                <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">Connection Health</p>
                <div className="space-y-2.5">
                  {[
                    { label: 'Webhook',          status: number.webhookStatus === 'ACTIVE', note: 'Receiving messages in real-time' },
                    { label: 'Business Verified', status: true, note: 'Account verified by Meta'  },
                    { label: 'Display Name',      status: number.namingStatus === 'APPROVED', note: number.verifiedName },
                    { label: 'Phone Number',      status: true, note: number.displayNumber        },
                  ].map(({ label, status, note }) => (
                    <div key={label} className="flex items-center gap-3 p-3 rounded-xl border border-surface-border bg-slate-50">
                      <CheckCircle2 size={15} className={status ? 'text-emerald-500' : 'text-slate-300'} />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-slate-700">{label}</p>
                        <p className="text-[10px] text-slate-400 truncate">{note}</p>
                      </div>
                      <span className={clsx('text-[10px] font-semibold px-2 py-0.5 rounded-full',
                        status ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500')}>
                        {status ? 'OK' : 'Pending'}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Test connection */}
              <div>
                <button onClick={testConnection} disabled={testing}
                  className={clsx('btn-secondary w-full justify-center', testing && 'opacity-60 cursor-not-allowed')}>
                  {testing
                    ? <><Loader2 size={13} className="animate-spin" /> Testing connection…</>
                    : <><Wifi size={13} /> Test Connection</>}
                </button>
                {testResult && (
                  <div className="mt-2.5 flex items-center justify-between p-3 rounded-xl border border-emerald-200 bg-emerald-50">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 size={14} className="text-emerald-500" />
                      <span className="text-sm font-semibold text-emerald-700">Connection healthy</span>
                    </div>
                    <span className="text-xs text-emerald-600 font-medium">{testResult.latency}ms</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ── Events & Alerts ── */}
          {activeTab === 'events' && (
            <div className="p-5 space-y-5">
              {/* Active status */}
              <div className="flex items-center gap-3 p-4 rounded-xl bg-emerald-50 border border-emerald-200">
                <div className="relative flex-shrink-0">
                  <Wifi size={20} className="text-emerald-500" />
                  <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                </div>
                <div>
                  <p className="text-sm font-bold text-emerald-800">Receiving events in real-time</p>
                  <p className="text-xs text-emerald-600 mt-0.5">All {SUBSCRIBED_FIELDS.length} event types are active</p>
                </div>
              </div>

              {/* Subscribed fields */}
              <div>
                <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">Active Event Subscriptions</p>
                <div className="space-y-1.5">
                  {SUBSCRIBED_FIELDS.map(field => (
                    <div key={field.key}
                      className="flex items-center gap-3 px-3 py-2.5 rounded-xl border border-surface-border hover:border-emerald-200 hover:bg-emerald-50/40 transition-colors group">
                      <CheckCircle2 size={14} className="text-emerald-500 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-slate-700">{field.label}</p>
                        <p className="text-[10px] text-slate-400 mt-0.5">{field.desc}</p>
                      </div>
                      <Activity size={11} className="text-slate-300 group-hover:text-emerald-400 transition-colors flex-shrink-0" />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ── Settings ── */}
          {activeTab === 'settings' && (
            <div className="p-5 space-y-5">
              {/* Number info */}
              <div>
                <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">Number Details</p>
                <div className="space-y-2 text-sm">
                  {[
                    { k: 'Phone Number',     v: number.displayNumber    },
                    { k: 'Display Name',     v: number.verifiedName     },
                    { k: 'Country',          v: number.country          },
                    { k: 'Timezone',         v: number.timezone         },
                    { k: 'Connected Since',  v: number.addedOn          },
                  ].map(({ k, v }) => (
                    <div key={k} className="flex items-center justify-between py-2 border-b border-slate-50 last:border-0">
                      <span className="text-xs text-slate-500">{k}</span>
                      <span className="text-xs font-semibold text-slate-800">{v}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Notification preferences */}
              <div>
                <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">Alerts</p>
                <div className="space-y-2">
                  {[
                    { label: 'Quality rating drops',         defaultOn: true  },
                    { label: 'Messaging limit reached',      defaultOn: true  },
                    { label: 'Webhook delivery failures',    defaultOn: true  },
                    { label: 'Template approval updates',    defaultOn: true  },
                    { label: 'Account policy violations',    defaultOn: true  },
                  ].map(({ label, defaultOn }) => (
                    <AlertToggle key={label} label={label} defaultOn={defaultOn} />
                  ))}
                </div>
              </div>

              {/* Danger zone */}
              <div className="rounded-xl border border-red-200 p-4">
                <p className="text-xs font-bold text-red-600 uppercase tracking-wider mb-3">Danger Zone</p>
                {!disconnectConfirm ? (
                  <button onClick={() => setDisconnectConfirm(true)}
                    className="w-full py-2.5 rounded-xl border border-red-200 text-red-600 text-xs font-semibold hover:bg-red-50 transition-colors">
                    Disconnect This Number
                  </button>
                ) : (
                  <div className="space-y-2">
                    <p className="text-xs text-slate-600">This will remove the number from ChatFlow. You can reconnect it anytime.</p>
                    <div className="flex gap-2">
                      <button onClick={() => setDisconnectConfirm(false)} className="btn-secondary flex-1 justify-center text-xs">Cancel</button>
                      <button onClick={() => { onDisconnect(number.id); onClose() }}
                        className="flex-1 py-2 rounded-xl bg-red-500 hover:bg-red-600 text-white text-xs font-semibold transition-colors">
                        Yes, Disconnect
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  )
}

/* ─── Alert toggle (simple) ──────────────────────────────────── */
function AlertToggle({ label, defaultOn }) {
  const [on, setOn] = useState(defaultOn)
  return (
    <div className="flex items-center justify-between p-3 rounded-xl border border-surface-border hover:bg-slate-50 transition-colors">
      <div className="flex items-center gap-2">
        <Bell size={13} className={on ? 'text-primary' : 'text-slate-300'} />
        <span className="text-xs text-slate-700">{label}</span>
      </div>
      <button onClick={() => setOn(p => !p)}
        className={clsx('relative w-8 h-4.5 rounded-full transition-colors flex-shrink-0', on ? 'bg-primary' : 'bg-slate-200')}
        style={{ height: '18px', width: '32px' }}>
        <span className={clsx('absolute top-0.5 w-3.5 h-3.5 rounded-full bg-white shadow transition-transform',
          on ? 'translate-x-[14px]' : 'translate-x-0.5')} />
      </button>
    </div>
  )
}

/* ─── Main Page ──────────────────────────────────────────────── */
export default function ConnectWhatsApp() {
  const [numbers, setNumbers]           = useState(INITIAL_NUMBERS)
  const [showModal, setShowModal]       = useState(false)
  const [selectedNumber, setSelectedNumber] = useState(null)
  const [openMenu, setOpenMenu]         = useState(null)
  const menuRef                         = useRef(null)

  /* ── Load FB SDK on mount ── */
  useEffect(() => {
    window.fbAsyncInit = function () {
      window.FB.init({
        appId:            APP_CONFIG.appId,
        autoLogAppEvents: true,
        xfbml:            true,
        version:          APP_CONFIG.apiVersion,
      })
    }

    if (!document.getElementById('facebook-jssdk')) {
      const script        = document.createElement('script')
      script.id           = 'facebook-jssdk'
      script.src          = 'https://connect.facebook.net/en_US/sdk.js'
      script.async        = true
      script.defer        = true
      script.crossOrigin  = 'anonymous'
      document.body.appendChild(script)
    }
  }, [])

  // Close kebab on outside click
  useEffect(() => {
    const h = (e) => { if (!menuRef.current?.contains(e.target)) setOpenMenu(null) }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [])

  function handleConnected(newNumber) {
    setNumbers(prev => [...prev, newNumber])
    setSelectedNumber(newNumber)
  }

  function handleDisconnect(id) {
    setNumbers(prev => prev.filter(n => n.id !== id))
  }

  function copyText(text) {
    navigator.clipboard.writeText(text)
  }

  const totalToday = numbers.reduce((s, n) => s + n.msgsToday, 0)
  const connected  = numbers.filter(n => n.status === 'CONNECTED').length

  return (
    <div className="space-y-6 animate-fade-in">

      {/* ── Header ── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900">WhatsApp Numbers</h1>
          <p className="text-sm text-slate-400 mt-0.5">Manage the WhatsApp numbers connected to your account</p>
        </div>
        <button onClick={() => setShowModal(true)} className="btn-primary">
          <Plus size={15} /> Add Number
        </button>
      </div>

      {/* ── Stats ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: 'Connected Numbers', value: numbers.length,                icon: Phone,        color: 'text-primary',     bg: 'bg-primary-50',  border: 'border-primary/20'   },
          { label: 'Active',            value: connected,                     icon: Activity,     color: 'text-emerald-600', bg: 'bg-emerald-50',  border: 'border-emerald-200'  },
          { label: 'Messages Today',    value: totalToday.toLocaleString(),   icon: MessageSquare,color: 'text-blue-600',    bg: 'bg-blue-50',     border: 'border-blue-200'     },
          { label: 'Event Types',       value: SUBSCRIBED_FIELDS.length,     icon: Bell,         color: 'text-purple-600',  bg: 'bg-purple-50',   border: 'border-purple-200'   },
        ].map(({ label, value, icon: Icon, color, bg, border }) => (
          <div key={label} className="card p-4 flex items-center gap-4">
            <div className={clsx('w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 border', bg, border)}>
              <Icon size={18} className={color} />
            </div>
            <div>
              <p className={clsx('text-xl font-extrabold leading-none', color)}>{value}</p>
              <p className="text-xs text-slate-500 mt-1">{label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* ── Numbers list ── */}
      {numbers.length === 0 ? (
        <div className="card p-12 text-center">
          <div className="w-16 h-16 rounded-2xl bg-slate-50 border border-surface-border flex items-center justify-center mx-auto mb-4">
            <Phone size={28} className="text-slate-300" />
          </div>
          <h3 className="font-semibold text-slate-700 mb-1">No numbers connected yet</h3>
          <p className="text-sm text-slate-400 mb-5">Add your first WhatsApp Business number to get started</p>
          <button onClick={() => setShowModal(true)} className="btn-primary mx-auto">
            <Plus size={14} /> Add Number
          </button>
        </div>
      ) : (
        <div className="card p-0 overflow-hidden">
          <div className="px-5 py-4 border-b border-surface-border flex items-center justify-between">
            <h2 className="font-bold text-slate-900 text-sm">Connected Numbers</h2>
            <span className="text-xs text-slate-400">{numbers.length} number{numbers.length !== 1 ? 's' : ''}</span>
          </div>

          <div className="divide-y divide-surface-border overflow-x-auto">
            {numbers.map(n => {
              const q = QUALITY[n.qualityRating]
              return (
                <div key={n.id} className="flex items-center gap-4 px-5 py-4 hover:bg-slate-50/60 transition-colors min-w-[640px]">

                  {/* Number + name */}
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <div className="relative flex-shrink-0">
                      <div className="w-10 h-10 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-center">
                        <Phone size={16} className="text-emerald-600" />
                      </div>
                      <span className={clsx('absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-white',
                        n.status === 'CONNECTED' ? 'bg-emerald-500' : 'bg-slate-300')} />
                    </div>
                    <div className="min-w-0">
                      <p className="font-semibold text-slate-900 text-sm">{n.displayNumber}</p>
                      <p className="text-xs text-slate-400 mt-0.5 truncate">{n.verifiedName}</p>
                    </div>
                  </div>

                  {/* Status */}
                  <div className="flex-shrink-0">
                    <span className={clsx('inline-flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1 rounded-full border',
                      n.status === 'CONNECTED' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-slate-50 text-slate-500 border-slate-200')}>
                      <span className={clsx('w-1.5 h-1.5 rounded-full', n.status === 'CONNECTED' ? 'bg-emerald-500' : 'bg-slate-300')} />
                      {n.status === 'CONNECTED' ? 'Active' : 'Inactive'}
                    </span>
                  </div>

                  {/* Quality */}
                  <div className="flex-shrink-0 w-28">
                    <p className="text-[10px] text-slate-400 mb-1">Quality</p>
                    <div className="flex items-center gap-1.5">
                      <span className={clsx('w-2 h-2 rounded-full flex-shrink-0', q.dot)} />
                      <span className={clsx('text-xs font-semibold', q.color)}>{q.label}</span>
                    </div>
                  </div>

                  {/* Limit */}
                  <div className="flex-shrink-0 w-28">
                    <p className="text-[10px] text-slate-400 mb-1">Daily Limit</p>
                    <p className="text-xs font-semibold text-slate-700">{TIER_LABEL[n.messagingLimitTier]}</p>
                  </div>

                  {/* Today */}
                  <div className="flex-shrink-0 w-24">
                    <p className="text-[10px] text-slate-400 mb-1">Today</p>
                    <p className="text-xs font-semibold text-primary">{n.msgsToday.toLocaleString()}</p>
                  </div>

                  {/* Last active */}
                  <div className="flex-shrink-0 w-24 hidden xl:block">
                    <p className="text-[10px] text-slate-400 mb-1">Last Active</p>
                    <p className="text-xs text-slate-500">{n.lastMessage}</p>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1.5 flex-shrink-0" ref={menuRef}>
                    <button onClick={() => setSelectedNumber(n)}
                      className="px-3 py-1.5 rounded-lg border border-surface-border text-xs font-medium text-slate-600 hover:border-primary/30 hover:text-primary hover:bg-primary-50 transition-all">
                      Manage
                    </button>
                    <div className="relative">
                      <button onClick={() => setOpenMenu(openMenu === n.id ? null : n.id)}
                        className="p-1.5 rounded-lg border border-surface-border hover:bg-surface-hover text-slate-400 hover:text-slate-600 transition-colors">
                        <ChevronDown size={13} />
                      </button>
                      {openMenu === n.id && (
                        <div className="absolute right-0 top-full mt-1 w-44 bg-white rounded-xl shadow-modal border border-surface-border z-20 py-1 animate-fade-in">
                          <button onClick={() => { setSelectedNumber(n); setOpenMenu(null) }}
                            className="w-full text-left px-3 py-2 text-xs text-slate-700 hover:bg-surface-hover transition-colors">
                            View Details
                          </button>
                          <button onClick={() => { copyText(n.displayNumber); setOpenMenu(null) }}
                            className="w-full text-left px-3 py-2 text-xs text-slate-700 hover:bg-surface-hover transition-colors">
                            Copy Phone Number
                          </button>
                          <div className="border-t border-surface-border my-1" />
                          <button onClick={() => { handleDisconnect(n.id); setOpenMenu(null) }}
                            className="w-full text-left px-3 py-2 text-xs text-red-600 hover:bg-red-50 transition-colors">
                            Disconnect
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Modals */}
      {showModal && (
        <ConnectModal
          onClose={() => setShowModal(false)}
          onConnected={handleConnected}
        />
      )}
      {selectedNumber && (
        <NumberDrawer
          number={selectedNumber}
          onClose={() => setSelectedNumber(null)}
          onDisconnect={handleDisconnect}
        />
      )}
    </div>
  )
}
