import { useCallback, useEffect, useState } from 'react'
import { CheckCircle2, XCircle, Copy, Check, RefreshCw } from 'lucide-react'
import { ctwa } from '../../lib/ctwaApi'
import { Banner, Card, Spinner } from './ui'

const ENV_BLOCK = `# Click-to-WhatsApp ads
META_AD_ACCOUNT_ID=1234567890          # Ads Manager → Account overview (digits only)
META_PAGE_ID=1234567890                # the Facebook Page linked to your WhatsApp number
META_ADS_ACCESS_TOKEN=EAAB...          # system-user token (see permissions below)
# optional
CTWA_WHATSAPP_NUMBER=+919876543210     # pin the number ads open; default is the one linked to the Page
META_CAPI_DATASET_ID=                  # default: looked up / created from WA_BUSINESS_ACCOUNT_ID
CTWA_PARTNER_AGENT=                    # partner name Meta assigned you, if any`

const STEPS = [
  ['Link your accounts in Meta Business Settings', 'Your WhatsApp Business Account, a Facebook Page linked to that number, and an ad account with a payment method should all sit in the same Business portfolio.'],
  ['Create a system-user token', 'In Business Settings → System users, add the ad account, Page and WhatsApp account as assets, then generate a token with: ads_management, ads_read, business_management, whatsapp_business_management and whatsapp_business_manage_events.'],
  ['Add the variables to the server', 'Put the values from the box below in the API server’s environment and restart it. Without them this section keeps showing editable sample data.'],
  ['Run the database migration', 'Run npm run migrate once. It adds the tables that store which ad each chat came from and the events you send back to Meta.'],
  ['Subscribe the webhook to “messages”', 'Your existing WhatsApp webhook already receives the ad details (ad id, headline, click id) on the first message of each ad chat. The dashboard stores them automatically.'],
]

export default function Setup() {
  const [s, setS] = useState(null)
  const [err, setErr] = useState('')
  const [copied, setCopied] = useState(false)
  const load = useCallback(() => { setS(null); setErr(''); ctwa.status().then(setS).catch((e) => setErr(e.message)) }, [])
  useEffect(load, [load])

  const copy = () => navigator.clipboard?.writeText(ENV_BLOCK).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1500) }).catch(() => {})

  return (
    <div className="grid grid-cols-1 xl:grid-cols-2 gap-5 items-start">
      <div className="space-y-5">
        <Card title="Connection" sub={s?.mode === 'live' ? 'Live: using your Meta ad account' : 'Sample mode: no Meta account connected yet'}
          right={<button onClick={load} aria-label="Check again" className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-surface-border text-[11px] font-semibold text-slate-600 hover:border-primary hover:text-primary"><RefreshCw size={12} /> Check again</button>} bodyClass="p-4 space-y-3">
          {err && <Banner tone="error">{err}</Banner>}
          {!s && !err && <Spinner label="Checking the connection…" />}
          {s && (
            <>
              {s.mode === 'sample' && <Banner tone="info">Everything works on sample data, including creating and pausing ads, so you can try the whole section. Nothing reaches Meta until you connect an ad account.</Banner>}
              {s.mode === 'live' && (
                <dl className="grid grid-cols-2 gap-3 text-xs">
                  {[['Ad account', s.account ? `${s.account.name} (${s.account.currency})` : '—'], ['Facebook Page', s.page?.name ?? '—'], ['WhatsApp number', s.whatsappNumber ?? 'The one linked to the Page'], ['Conversions dataset', s.datasetId ?? 'Created on first event']].map(([k, v]) => (
                    <div key={k}><dt className="text-[10.5px] text-slate-400">{k}</dt><dd className="font-semibold text-slate-800 mt-0.5 break-words">{v}</dd></div>
                  ))}
                </dl>
              )}
              <ul className="divide-y divide-surface-border/70 border border-surface-border rounded-xl">
                {s.checks.map((c) => (
                  <li key={c.key} className="flex items-start gap-2.5 px-3.5 py-2.5">
                    {c.ok ? <CheckCircle2 size={15} className="text-emerald-500 mt-0.5 flex-shrink-0" /> : <XCircle size={15} className="text-slate-300 mt-0.5 flex-shrink-0" />}
                    <div className="min-w-0"><p className="text-xs font-semibold text-slate-700">{c.label}</p>{!c.ok && c.hint && <p className="text-[10.5px] text-slate-500 mt-0.5 leading-relaxed">{c.hint}</p>}</div>
                  </li>
                ))}
                <li className="flex items-start gap-2.5 px-3.5 py-2.5">
                  {s.capiLive ? <CheckCircle2 size={15} className="text-emerald-500 mt-0.5 flex-shrink-0" /> : <XCircle size={15} className="text-slate-300 mt-0.5 flex-shrink-0" />}
                  <div><p className="text-xs font-semibold text-slate-700">Conversion events go to Meta</p>{!s.capiLive && <p className="text-[10.5px] text-slate-500 mt-0.5">Events are recorded as tests until the ad account is connected and WA_BUSINESS_ACCOUNT_ID is set.</p>}</div>
                </li>
              </ul>
            </>
          )}
        </Card>

        <Card title="Environment variables" right={<button onClick={copy} className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-surface-border text-[11px] font-semibold text-slate-600 hover:border-primary hover:text-primary">{copied ? <Check size={12} className="text-emerald-500" /> : <Copy size={12} />} {copied ? 'Copied' : 'Copy'}</button>} bodyClass="p-0">
          <pre className="text-[11px] leading-relaxed bg-slate-900 text-slate-100 p-4 overflow-x-auto"><code>{ENV_BLOCK}</code></pre>
        </Card>
      </div>

      <Card title="How to connect Meta ads" sub="Do these once" bodyClass="p-4">
        <ol className="space-y-4">
          {STEPS.map(([t, d], i) => (
            <li key={t} className="flex gap-3">
              <span className="w-6 h-6 rounded-full bg-primary-50 text-primary text-[11px] font-bold flex items-center justify-center flex-shrink-0">{i + 1}</span>
              <div><p className="text-xs font-bold text-slate-800">{t}</p><p className="text-[11px] text-slate-500 mt-1 leading-relaxed">{d}</p></div>
            </li>
          ))}
        </ol>
        <div className="mt-5 pt-4 border-t border-surface-border text-[11px] text-slate-500 leading-relaxed space-y-1.5">
          <p><span className="font-semibold text-slate-700">New ads start paused.</span> Nothing spends until you turn an ad on.</p>
          <p><span className="font-semibold text-slate-700">Costs:</span> Meta bills ad spend to your ad account. Conversations that start from a Click-to-WhatsApp ad are free for 72 hours.</p>
          <p><span className="font-semibold text-slate-700">Numbers are Meta’s.</span> They can differ slightly from Ads Manager because of attribution windows and timezones.</p>
        </div>
      </Card>
    </div>
  )
}
