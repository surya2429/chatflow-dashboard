import { useEffect, useState } from 'react'
import { Sparkles, X, Loader2, ShieldCheck, ExternalLink } from 'lucide-react'
import { ai, useAiSettings } from '../../lib/aiApi'

const KEY_LINKS = {
  anthropic: 'https://console.anthropic.com/settings/keys',
  openai: 'https://platform.openai.com/api-keys',
  google: 'https://aistudio.google.com/apikey',
}
const OTHER = '__other'
const inputCls = 'w-full rounded-lg border border-surface-border bg-white px-3 py-2 text-xs text-slate-800 outline-none focus:border-primary placeholder:text-slate-400'

/** Popup: pick the provider and model, paste the API key, and the key is tested before anything is saved. */
export default function AiSetupDialog({ onClose }) {
  const { settings, setSettings } = useAiSettings()
  const providers = settings?.providers
  const [provider, setProvider] = useState(settings?.provider || 'anthropic')
  const [model, setModel] = useState(settings?.model || '')
  const [apiKey, setApiKey] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const suggestions = providers?.[provider]?.models ?? []
  const [custom, setCustom] = useState(false)
  // first model of a provider is the default; switching provider resets the choice
  useEffect(() => {
    if (!providers) return
    if (provider === settings?.provider && settings.model) { setModel(settings.model); setCustom(!suggestions.includes(settings.model)) }
    else { setModel(suggestions[0] ?? ''); setCustom(false) }
  }, [provider, providers]) // eslint-disable-line react-hooks/exhaustive-deps

  const keepSaved = settings?.configured && settings.provider === provider
  const canSave = !!model.trim() && (apiKey.trim().length >= 8 || keepSaved) && !busy

  async function save() {
    setBusy(true); setError('')
    try { setSettings(await ai.save({ provider, model: model.trim(), apiKey: apiKey.trim() || undefined })); onClose() }
    catch (e) { setError(e.message) }
    finally { setBusy(false) }
  }
  async function disconnect() {
    setBusy(true); setError('')
    try { setSettings(await ai.remove()); onClose() }
    catch (e) { setError(e.message) }
    finally { setBusy(false) }
  }

  return (
    <div className="fixed inset-0 bg-slate-900/30 z-[60] flex items-center justify-center p-4" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div role="dialog" aria-label="Set up AI" className="bg-white rounded-2xl w-full max-w-md shadow-modal animate-fade-in overflow-hidden">
        <div className="flex items-start justify-between px-5 py-4 border-b border-surface-border">
          <div className="flex items-center gap-2.5">
            <span className="w-8 h-8 rounded-xl bg-primary-50 text-primary flex items-center justify-center"><Sparkles size={15} /></span>
            <div>
              <h3 className="font-bold text-slate-900 text-sm">{settings?.configured ? 'AI settings' : 'Set up AI'}</h3>
              <p className="text-[11px] text-slate-500">Choose a model and add your API key to switch on AI insights.</p>
            </div>
          </div>
          <button onClick={onClose} aria-label="Close" className="p-1.5 rounded-lg hover:bg-surface-hover text-slate-400 hover:text-slate-600"><X size={15} /></button>
        </div>

        {!providers ? (
          <div className="px-5 py-8 text-center text-xs text-slate-500">
            {settings?.unavailable ? `The AI service is not reachable: ${settings.unavailable}` : <Loader2 size={16} className="animate-spin mx-auto" />}
          </div>
        ) : (
          <div className="px-5 py-4 space-y-3.5">
            <div>
              <label className="block text-[11px] font-semibold text-slate-700 mb-1.5">Provider</label>
              <div className="grid grid-cols-3 gap-1.5">
                {Object.entries(providers).map(([k, p]) => (
                  <button key={k} onClick={() => setProvider(k)}
                    className={`px-2 py-2 rounded-lg border text-[11px] font-semibold transition-colors ${provider === k ? 'border-primary bg-primary-50 text-primary' : 'border-surface-border text-slate-600 hover:bg-surface-hover'}`}>
                    {p.label.replace(/ \(.*\)/, '')}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-700 mb-1.5">Model</label>
              <select value={custom ? OTHER : model} onChange={(e) => { if (e.target.value === OTHER) { setCustom(true); setModel('') } else { setCustom(false); setModel(e.target.value) } }} className={inputCls}>
                {suggestions.map((m) => <option key={m} value={m}>{m}</option>)}
                <option value={OTHER}>Other model id…</option>
              </select>
              {custom && <input value={model} onChange={(e) => setModel(e.target.value)} placeholder="Exact model id from your provider" className={`${inputCls} mt-1.5`} autoFocus />}
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-700 mb-1.5">API key</label>
              <input type="password" autoComplete="off" value={apiKey} onChange={(e) => setApiKey(e.target.value)}
                placeholder={keepSaved ? `Saved key ${settings.keyHint} · leave blank to keep it` : 'Paste your API key'} className={inputCls} />
              <a href={KEY_LINKS[provider]} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-[10.5px] text-primary mt-1.5 hover:underline">
                Get a {providers[provider].label.replace(/ \(.*\)/, '')} key <ExternalLink size={10} />
              </a>
            </div>

            <div className="flex gap-2 rounded-lg bg-slate-50 border border-surface-border px-3 py-2.5">
              <ShieldCheck size={14} className="text-emerald-600 flex-shrink-0 mt-0.5" />
              <p className="text-[10.5px] text-slate-500 leading-relaxed">
                We test the key before saving it. It is stored encrypted on the server and used only to run these AI features; it is never shown again. Conversations you analyse are sent to the provider you choose, and usage is billed to your own account with them.
              </p>
            </div>

            {error && <p role="alert" className="text-[11px] text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">{error}</p>}
          </div>
        )}

        {providers && (
          <div className="flex items-center gap-2 px-5 py-3.5 border-t border-surface-border bg-slate-50/60">
            {settings?.configured && <button onClick={disconnect} disabled={busy} className="text-[11px] font-semibold text-red-600 hover:underline disabled:opacity-50">Disconnect</button>}
            <div className="ml-auto flex gap-2">
              <button onClick={onClose} className="btn-secondary text-xs">Cancel</button>
              <button onClick={save} disabled={!canSave} className="btn-primary text-xs disabled:opacity-50 inline-flex items-center gap-1.5">
                {busy && <Loader2 size={12} className="animate-spin" />} {busy ? 'Testing…' : 'Test & save'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
