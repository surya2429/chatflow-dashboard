import { useState } from 'react'
import { Facebook, Loader2, CheckCircle2, ShieldCheck, Unplug, RefreshCw } from 'lucide-react'
import clsx from 'clsx'
import { Banner, Card, Field, Spinner, inputCls } from './ui'

export function ConnectButton({ meta, label = 'Connect with Facebook', className }) {
  return (
    <button onClick={meta.connect} disabled={!meta.canConnect || !!meta.busy}
      className={clsx('inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-[#1877F2] hover:bg-[#166fe0] text-white text-xs font-bold transition-colors disabled:opacity-60 disabled:cursor-not-allowed', className)}>
      {meta.busy === 'connect' ? <Loader2 size={15} className="animate-spin" /> : <Facebook size={15} fill="currentColor" />} {meta.busy === 'connect' ? 'Waiting for Facebook…' : label}
    </button>
  )
}

function Pick({ label, value, options, onChange, disabled, hint }) {
  return (
    <Field label={label} hint={hint}>
      <select value={value || ''} disabled={disabled} onChange={(e) => onChange(e.target.value || null)} className={inputCls} aria-label={label}>
        {!value && <option value="">Choose…</option>}
        {options.map((o) => <option key={o.id} value={o.id}>{o.name}{o.currency ? ` · ${o.currency}` : ''}</option>)}
      </select>
    </Field>
  )
}

/* "Connect with Facebook": the customer approves in Facebook's own popup, picks the ad account and Page, and is done. */
export default function ConnectMeta({ meta }) {
  const { conn, busy, error } = meta
  const [confirm, setConfirm] = useState(false)
  if (!conn) return <Card title="Facebook connection" bodyClass=""><Spinner label="Checking…" /></Card>
  const sel = conn.selected || {}

  return (
    <Card title="Facebook connection" sub="Connect once to see real results and create ads here">
      <div className="p-4 space-y-4">
        {error && <Banner tone="error" action={<button onClick={meta.clearError} className="font-semibold underline whitespace-nowrap">Dismiss</button>}>{error}</Banner>}

        {!conn.connected && (
          <>
            {meta.canConnect ? (
              <div className="rounded-xl border border-blue-100 bg-blue-50/50 p-5 text-center">
                <span className="w-11 h-11 rounded-2xl bg-[#1877F2] text-white inline-flex items-center justify-center mb-3"><Facebook size={20} fill="currentColor" /></span>
                <p className="text-sm font-bold text-slate-800">Connect your Facebook ads account</p>
                <p className="text-xs text-slate-500 mt-1.5 mb-4 max-w-sm mx-auto leading-relaxed">A Facebook window opens. Choose the ad account and Page (and your WhatsApp Business account), approve, and you are connected. No keys or IDs to copy.</p>
                <ConnectButton meta={meta} />
              </div>
            ) : (
              <Banner tone="warn">Connecting with Facebook has not been switched on for this workspace yet. Ask your platform admin to enable it (details under “For the platform admin” below). Until then you can try everything on sample data.</Banner>
            )}
            <ul className="text-[11px] text-slate-500 space-y-1.5">
              {['See how your Click-to-WhatsApp ads perform, with real spend and results', 'Create, pause and edit ads from this dashboard', 'Send Lead and Purchase events back to Meta so it finds more buyers'].map((t) => (
                <li key={t} className="flex items-start gap-2"><CheckCircle2 size={13} className="text-emerald-500 mt-0.5 flex-shrink-0" />{t}</li>
              ))}
            </ul>
            <p className="flex items-start gap-2 text-[10.5px] text-slate-400 leading-relaxed"><ShieldCheck size={13} className="flex-shrink-0 mt-0.5" />We only use the accounts you pick. Nothing is posted without you, new ads start paused, and you can disconnect any time.</p>
          </>
        )}

        {conn.connected && conn.source === 'env' && (
          <Banner tone="ok">Connected through the server settings. To use a different account, connect it with Facebook after removing those settings.</Banner>
        )}

        {conn.connected && conn.source === 'facebook' && (
          <>
            <div className="flex items-center gap-3">
              <span className="w-9 h-9 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center flex-shrink-0"><CheckCircle2 size={18} /></span>
              <div className="min-w-0">
                <p className="text-xs font-bold text-slate-800">Connected{conn.userName ? ` as ${conn.userName}` : ''}</p>
                <p className="text-[10.5px] text-slate-400">Since {new Date(conn.connectedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</p>
              </div>
            </div>

            {conn.needsSelection && <Banner tone="warn">You shared more than one account. Choose the ones to use for ads.</Banner>}
            {!conn.adAccounts.length && <Banner tone="warn">No ad account was shared. Use “Add or change accounts” and pick one in the Facebook window.</Banner>}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {conn.adAccounts.length > 0 && <Pick label="Ad account" value={sel.adAccountId} options={conn.adAccounts} disabled={!!busy} onChange={(v) => meta.select({ adAccountId: v })} />}
              {conn.pages.length > 0 && <Pick label="Facebook Page" value={sel.pageId} options={conn.pages} disabled={!!busy} onChange={(v) => meta.select({ pageId: v })} hint="The Page linked to your WhatsApp number." />}
              {conn.wabas.length > 0
                ? <Pick label="WhatsApp Business account" value={sel.wabaId} options={conn.wabas} disabled={!!busy} onChange={(v) => meta.select({ wabaId: v })} hint="Used to send conversion events." />
                : <p className="text-[10.5px] text-amber-700 bg-amber-50 rounded-lg px-3 py-2 self-end">No WhatsApp account shared, so conversion events can’t be sent. Add it with “Add or change accounts”.</p>}
            </div>

            <div className="flex flex-wrap items-center gap-2 pt-1">
              <ConnectButton meta={meta} label="Add or change accounts" className="!bg-white !text-slate-700 border border-surface-border hover:!bg-slate-50 !font-semibold" />
              {confirm ? (
                <span className="inline-flex items-center gap-2 text-[11px] ml-1">Disconnect Facebook?
                  <button onClick={() => { setConfirm(false); meta.disconnect() }} className="font-semibold text-red-600 hover:underline">Yes, disconnect</button>
                  <button onClick={() => setConfirm(false)} className="font-semibold text-slate-500 hover:underline">Cancel</button>
                </span>
              ) : (
                <button onClick={() => setConfirm(true)} disabled={!!busy} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold text-red-600 hover:bg-red-50 disabled:opacity-50">
                  {busy === 'disconnect' ? <Loader2 size={13} className="animate-spin" /> : <Unplug size={13} />} Disconnect
                </button>
              )}
              {busy === 'select' && <span className="inline-flex items-center gap-1.5 text-[11px] text-slate-400"><RefreshCw size={12} className="animate-spin" /> Switching…</span>}
            </div>
          </>
        )}
      </div>
    </Card>
  )
}
