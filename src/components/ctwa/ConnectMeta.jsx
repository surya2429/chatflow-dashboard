import { useState } from 'react'
import { Facebook, Loader2, CheckCircle2, Unplug, RefreshCw } from 'lucide-react'
import clsx from 'clsx'
import { Banner, Card, Field, Spinner, inputCls } from './ui'

export function ConnectButton({ meta, label = 'Connect with Facebook', className, onClick, enabled }) {
  return (
    <button onClick={onClick || meta.connect} disabled={(!meta.canConnect && !enabled) || !!meta.busy}
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

/* The connection, front and centre: its state, and the buttons to connect, change accounts or disconnect — always visible. */
export default function ConnectMeta({ meta, onNeedAdmin }) {
  const { conn, busy, error } = meta
  const [confirm, setConfirm] = useState(false)
  if (!conn) return <Card title="Facebook connection" bodyClass=""><Spinner label="Checking…" /></Card>
  const sel = conn.selected || {}
  const connected = conn.connected
  const fb = conn.source === 'facebook'
  // not switched on for this workspace: the button stays visible and explains instead of silently doing nothing
  const connect = meta.canConnect ? meta.connect : onNeedAdmin

  return (
    <Card bodyClass="">
      <div className="p-5 flex flex-wrap items-center gap-4">
        <span className={clsx('w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0', connected ? 'bg-emerald-50 text-emerald-600' : 'bg-[#1877F2] text-white')}>
          {connected ? <CheckCircle2 size={24} /> : <Facebook size={22} fill="currentColor" />}
        </span>
        <div className="flex-1 min-w-[220px]">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-bold text-slate-900">Facebook connection</h2>
            <span className={clsx('text-[10px] font-bold px-2 py-0.5 rounded-full', connected ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700')}>{connected ? 'Connected' : 'Not connected'}</span>
          </div>
          <p className="text-xs text-slate-500 mt-1 leading-relaxed">
            {!connected ? 'Connect to see real spend and results, create and edit ads here, and send Lead and Purchase events back to Meta. Until then this section shows sample data.'
              : fb ? `Connected${conn.userName ? ` as ${conn.userName}` : ''} since ${new Date(conn.connectedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}. Your real ads and leads appear here.`
              : 'Connected through the server settings, so it is managed by whoever runs the server.'}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {!connected && <ConnectButton meta={meta} onClick={connect} enabled />}
          {connected && fb && (
            <>
              <ConnectButton meta={meta} label="Add or change accounts" className="!bg-white !text-slate-700 border border-surface-border hover:!bg-slate-50 !font-semibold" />
              {confirm ? (
                <span className="inline-flex items-center gap-2 text-[11px] bg-red-50 rounded-lg px-3 py-2">Disconnect Facebook?
                  <button onClick={() => { setConfirm(false); meta.disconnect() }} className="font-bold text-red-600 hover:underline">Yes, disconnect</button>
                  <button onClick={() => setConfirm(false)} className="font-semibold text-slate-500 hover:underline">Cancel</button>
                </span>
              ) : (
                <button onClick={() => setConfirm(true)} disabled={!!busy} className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-lg border border-red-200 text-xs font-bold text-red-600 hover:bg-red-50 disabled:opacity-50">
                  {busy === 'disconnect' ? <Loader2 size={13} className="animate-spin" /> : <Unplug size={13} />} Disconnect
                </button>
              )}
            </>
          )}
        </div>
      </div>

      {(error || connected && fb || !connected) && (
        <div className="px-5 pb-5 space-y-4 border-t border-surface-border pt-4">
          {error && <Banner tone="error" action={<button onClick={meta.clearError} className="font-semibold underline whitespace-nowrap">Dismiss</button>}>{error}</Banner>}

          {!connected && !meta.canConnect && (
            <Banner tone="warn" action={<button onClick={onNeedAdmin} className="font-semibold underline whitespace-nowrap">Show admin steps</button>}>
              “Connect with Facebook” has not been switched on for this workspace yet, so the button can’t open Facebook. Whoever runs the platform needs to add the Meta app details once (steps further down). You can keep using sample data meanwhile.
            </Banner>
          )}
          {!connected && (
            <ul className="text-[11px] text-slate-500 space-y-1.5">
              {['A Facebook window opens: pick the ad account and Page (and your WhatsApp Business account) and approve', 'No keys or IDs to copy', 'New ads start paused and nothing is posted without you. You can disconnect any time'].map((t) => (
                <li key={t} className="flex items-start gap-2"><CheckCircle2 size={13} className="text-emerald-500 mt-0.5 flex-shrink-0" />{t}</li>
              ))}
            </ul>
          )}

          {connected && fb && (
            <>
              {conn.needsSelection && <Banner tone="warn">You shared more than one account. Choose the ones to use for ads.</Banner>}
              {!conn.adAccounts.length && <Banner tone="warn">No ad account was shared. Use “Add or change accounts” and pick one in the Facebook window.</Banner>}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {conn.adAccounts.length > 0 && <Pick label="Ad account" value={sel.adAccountId} options={conn.adAccounts} disabled={!!busy} onChange={(v) => meta.select({ adAccountId: v })} />}
                {conn.pages.length > 0 && <Pick label="Facebook Page" value={sel.pageId} options={conn.pages} disabled={!!busy} onChange={(v) => meta.select({ pageId: v })} hint="The Page linked to your WhatsApp number." />}
                {conn.wabas.length > 0
                  ? <Pick label="WhatsApp Business account" value={sel.wabaId} options={conn.wabas} disabled={!!busy} onChange={(v) => meta.select({ wabaId: v })} hint="Used to send conversion events." />
                  : <p className="text-[10.5px] text-amber-700 bg-amber-50 rounded-lg px-3 py-2 self-end">No WhatsApp account shared, so conversion events can’t be sent. Add it with “Add or change accounts”.</p>}
              </div>
              {busy === 'select' && <p className="inline-flex items-center gap-1.5 text-[11px] text-slate-400"><RefreshCw size={12} className="animate-spin" /> Switching…</p>}
            </>
          )}
        </div>
      )}
    </Card>
  )
}
