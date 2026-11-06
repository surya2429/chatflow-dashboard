import { useCallback, useEffect, useRef, useState } from 'react'
import { CheckCircle2, XCircle, Copy, Check, RefreshCw, ChevronDown } from 'lucide-react'
import { ctwa } from '../../lib/ctwaApi'
import ConnectMeta from './ConnectMeta'
import { Banner, Card, Spinner } from './ui'

const ADMIN_VARS = `# Once, by whoever runs the platform (your own Meta app) — customers then just click "Connect"
META_APP_ID=1234567890
META_APP_SECRET=...                 # keep secret; never sent to the browser
META_LOGIN_CONFIG_ID=1234567890     # Facebook Login for Business configuration (see steps)
CONNECTIONS_SECRET=long-random-text # encrypts the tokens customers hand over`

const MANUAL_VARS = `# Alternative: one fixed account, no popup
META_AD_ACCOUNT_ID=1234567890
META_PAGE_ID=1234567890
META_ADS_ACCESS_TOKEN=EAAB...       # system-user token with ads_management + ads_read`

function CopyBlock({ text }) {
  const [copied, setCopied] = useState(false)
  const copy = () => navigator.clipboard?.writeText(text).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1500) }).catch(() => {})
  return (
    <div className="relative">
      <button onClick={copy} className="absolute top-2 right-2 inline-flex items-center gap-1 px-2 py-1 rounded-md bg-white/10 text-[10px] font-semibold text-slate-200 hover:bg-white/20">{copied ? <Check size={11} /> : <Copy size={11} />} {copied ? 'Copied' : 'Copy'}</button>
      <pre className="text-[11px] leading-relaxed bg-slate-900 text-slate-100 p-4 pr-20 rounded-lg overflow-x-auto"><code>{text}</code></pre>
    </div>
  )
}

function Details({ title, children, open, onToggle }) {
  return (
    <details open={open} onToggle={(e) => onToggle?.(e.currentTarget.open)} className="group border border-surface-border rounded-xl">
      <summary className="flex items-center justify-between cursor-pointer list-none px-4 py-3 text-xs font-bold text-slate-700">{title}<ChevronDown size={14} className="text-slate-400 transition-transform group-open:rotate-180" /></summary>
      <div className="px-4 pb-4 space-y-3 text-[11px] text-slate-500 leading-relaxed">{children}</div>
    </details>
  )
}

export default function Setup({ meta }) {
  const [s, setS] = useState(null)
  const [err, setErr] = useState('')
  const [adminOpen, setAdminOpen] = useState(false)
  const adminRef = useRef(null)
  const showAdmin = () => { setAdminOpen(true); setTimeout(() => adminRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 60) }
  const load = useCallback(() => { setS(null); setErr(''); ctwa.status().then(setS).catch((e) => setErr(e.message)) }, [])
  const sel = meta.conn?.selected
  useEffect(load, [load, meta.conn?.connected, sel?.adAccountId, sel?.pageId, sel?.wabaId])

  return (
    <div className="space-y-5">
    <ConnectMeta meta={meta} onNeedAdmin={showAdmin} />
    <div className="grid grid-cols-1 xl:grid-cols-2 gap-5 items-start">
      <div className="space-y-5">
        <Card title="Health check" sub={s?.mode === 'live' ? 'Live: using your Meta ad account' : 'Sample mode: no Meta account connected yet'}
          right={<button onClick={load} aria-label="Check again" className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-surface-border text-[11px] font-semibold text-slate-600 hover:border-primary hover:text-primary"><RefreshCw size={12} /> Check again</button>} bodyClass="p-4 space-y-3">
          {err && <Banner tone="error">{err}</Banner>}
          {!s && !err && <Spinner label="Checking the connection…" />}
          {s && (
            <ul className="divide-y divide-surface-border/70 border border-surface-border rounded-xl">
              {s.checks.map((c) => (
                <li key={c.key} className="flex items-start gap-2.5 px-3.5 py-2.5">
                  {c.ok ? <CheckCircle2 size={15} className="text-emerald-500 mt-0.5 flex-shrink-0" /> : <XCircle size={15} className="text-slate-300 mt-0.5 flex-shrink-0" />}
                  <div className="min-w-0"><p className="text-xs font-semibold text-slate-700">{c.label}</p>{!c.ok && c.hint && <p className="text-[10.5px] text-slate-500 mt-0.5 leading-relaxed">{s.mode === 'sample' ? 'Connect with Facebook above.' : c.hint}</p>}</div>
                </li>
              ))}
              <li className="flex items-start gap-2.5 px-3.5 py-2.5">
                {s.capiLive ? <CheckCircle2 size={15} className="text-emerald-500 mt-0.5 flex-shrink-0" /> : <XCircle size={15} className="text-slate-300 mt-0.5 flex-shrink-0" />}
                <div><p className="text-xs font-semibold text-slate-700">Conversion events go to Meta</p>{!s.capiLive && <p className="text-[10.5px] text-slate-500 mt-0.5">Recorded as tests until Facebook is connected and a WhatsApp Business account is shared.</p>}</div>
              </li>
            </ul>
          )}
        </Card>
      </div>

      <div className="space-y-5">
        <Card title="How it works" bodyClass="p-4">
          <ol className="space-y-4">
            {[['Connect', 'Click “Connect with Facebook” and approve in the window Facebook opens.'], ['Pick your accounts', 'Choose the ad account, the Page linked to your WhatsApp number, and your WhatsApp Business account.'], ['Use it', 'Your real ads and results appear here. New ads start paused, so nothing spends until you turn them on.']].map(([t, d], i) => (
              <li key={t} className="flex gap-3">
                <span className="w-6 h-6 rounded-full bg-primary-50 text-primary text-[11px] font-bold flex items-center justify-center flex-shrink-0">{i + 1}</span>
                <div><p className="text-xs font-bold text-slate-800">{t}</p><p className="text-[11px] text-slate-500 mt-0.5 leading-relaxed">{d}</p></div>
              </li>
            ))}
          </ol>
          <div className="mt-5 pt-4 border-t border-surface-border text-[11px] text-slate-500 leading-relaxed space-y-1.5">
            <p><span className="font-semibold text-slate-700">Costs:</span> Meta bills ad spend to your ad account. Conversations that start from a Click-to-WhatsApp ad are free for 72 hours.</p>
            <p><span className="font-semibold text-slate-700">Numbers are Meta’s.</span> They can differ slightly from Ads Manager because of attribution windows and timezones.</p>
          </div>
        </Card>

        <div ref={adminRef}><Details open={adminOpen} onToggle={setAdminOpen} title="For the platform admin: enable “Connect with Facebook”">
          <ol className="list-decimal pl-4 space-y-1.5">
            <li>In developers.facebook.com, use your Meta app (type Business) and add <b>Facebook Login for Business</b>.</li>
            <li>Create a configuration with the WhatsApp Embedded Signup variation. Request <b>ads_management, ads_read, business_management, pages_show_list, whatsapp_business_management, whatsapp_business_manage_events</b>. Choose the token type “Business Integration System User”.</li>
            <li>Add your site’s domain to the app’s allowed domains, and complete App Review / Business Verification so customers outside your team can connect.</li>
            <li>Set the variables below on the API server, restart, and run <b>npm run migrate</b> once.</li>
          </ol>
          <CopyBlock text={ADMIN_VARS} />
        </Details></div>

        <Details title="Advanced: use one fixed account instead">
          <p>If this dashboard only ever manages one ad account, you can skip the popup and set these on the server.</p>
          <CopyBlock text={MANUAL_VARS} />
        </Details>
      </div>
    </div>
    </div>
  )
}
