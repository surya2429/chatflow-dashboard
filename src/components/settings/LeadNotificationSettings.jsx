// LeadNotificationSettings.jsx — Settings > Email / SMS / WhatsApp notifications.
// Add up to 5 recipients for the channel and choose which lead notifications each one receives.
import { useState } from 'react'
import clsx from 'clsx'
import { Mail, MessageCircle, Plus, Smartphone, Trash2 } from 'lucide-react'
import {
  KIND_GROUPS, MAX_RECIPIENTS, NOTIFICATION_CHANNELS, NOTIFICATION_KINDS, addRecipient, buildNotificationMessage, isOn,
  loadNotificationConfig, saveNotificationConfig,
} from '../../lib/leadNotifications'
import { NativeSelect } from '../Select'

const ICON = { email: Mail, sms: Smartphone, whatsapp: MessageCircle }

function Switch({ on, onChange, label }) {
  return (
    <button type="button" role="switch" aria-checked={on} aria-label={label} onClick={() => onChange(!on)}
      className="relative flex-shrink-0 rounded-full transition-colors mt-0.5" style={{ width: 34, height: 18, background: on ? '#0066ff' : '#d1d5db' }}>
      <span className="absolute rounded-full bg-white shadow transition-all" style={{ top: 2, left: on ? 18 : 2, width: 14, height: 14 }}/>
    </button>
  )
}

/* The message a recipient gets, drawn the way the channel shows it. Read-only. */
function MessagePreview({ channel }) {
  const [kind, setKind] = useState('lead')
  const { subject, text } = buildNotificationMessage({ kind, channel })
  const bold = s => s.split(/\*([^*]+)\*/).map((p, i) => i % 2 ? <b key={i}>{p}</b> : p)
  return (
    <div className="rounded-xl border border-surface-border p-3.5 space-y-2.5">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <p className="text-[12px] font-semibold text-slate-700">What the message looks like</p>
        <div className="w-full sm:w-72">
          <NativeSelect sm value={kind} onChange={e => setKind(e.target.value)} aria-label="Message to preview">
            {NOTIFICATION_KINDS.map(k => <option key={k.id} value={k.id}>{k.label}</option>)}
          </NativeSelect>
        </div>
      </div>
      <div className="rounded-lg bg-slate-50 p-3">
        {channel === 'email' && <p className="text-[10px] text-slate-400 mb-0.5">Subject</p>}
        {channel === 'email' && <p className="text-[12px] font-semibold text-slate-800 mb-2">{subject}</p>}
        <div className={clsx('whitespace-pre-line text-[11.5px] leading-relaxed text-slate-700',
          channel !== 'email' && 'max-w-[460px] rounded-2xl rounded-tl-sm px-3 py-2 shadow-sm border border-surface-border ' + (channel === 'whatsapp' ? 'bg-[#dcf8c6]' : 'bg-white'))}>
          {channel === 'whatsapp' ? bold(text) : text}
        </div>
      </div>
      <p className="text-[10px] text-slate-400">
        {(kind === 'lead' || kind === 'revisit')
          ? `The lead's details come first, then the chat transcript.${channel === 'sms' ? ' SMS is short, so a long chat is cut to its most recent messages.' : ''}`
          : 'The figures are examples.'}
      </p>
    </div>
  )
}

export default function LeadNotificationSettings({ channel }) {
  const meta = NOTIFICATION_CHANNELS[channel]
  const Icon = ICON[channel]
  const [config, setConfig] = useState(loadNotificationConfig)
  const [draft, setDraft] = useState('')
  const [error, setError] = useState('')
  const list = config[channel]
  const commit = next => { const c = { ...config, [channel]: next }; setConfig(c); saveNotificationConfig(c) }

  const add = e => {
    e.preventDefault()
    const r = addRecipient(list, channel, draft)
    if (r.error) return setError(r.error)
    commit(r.list); setDraft(''); setError('')
  }
  const setRecipientKind = (id, kind, on) => commit(list.map(r => r.id === id ? { ...r, kinds: { ...r.kinds, [kind]: on } } : r))
  const full = list.length >= MAX_RECIPIENTS

  return (
    <div className="max-w-[720px] space-y-4">
      <div>
        <h2 className="text-[14px] font-bold text-slate-900">{meta.label} notifications</h2>
        <p className="text-[11px] text-slate-500 mt-0.5">Tell your team about leads as they happen, with the lead's details and the chat transcript. Add up to {MAX_RECIPIENTS} {channel === 'email' ? 'email addresses' : 'numbers'} and choose what each one receives. Changes save automatically.</p>
      </div>

      <form onSubmit={add} noValidate className="space-y-1.5">
        <div className="flex items-center justify-between">
          <label htmlFor={`add-${channel}`} className="text-[11px] font-semibold text-slate-700">Add {meta.noun}</label>
          <span className="text-[10.5px] text-slate-400">{list.length} of {MAX_RECIPIENTS} added</span>
        </div>
        <div className="flex gap-2">
          <input id={`add-${channel}`} value={draft} disabled={full} onChange={e => { setDraft(e.target.value); setError('') }}
            type={channel === 'email' ? 'email' : 'tel'} placeholder={full ? `You have added ${MAX_RECIPIENTS}. Remove one to add another.` : meta.placeholder}
            className="input flex-1 disabled:bg-slate-50"/>
          <button type="submit" disabled={full || !draft.trim()}
            className="flex items-center gap-1.5 px-3 h-9 rounded-lg bg-primary text-white text-[11.5px] font-semibold hover:bg-primary/90 disabled:opacity-40 transition-colors">
            <Plus size={13}/> Add
          </button>
        </div>
        {error && <p role="alert" className="text-[10.5px] text-red-500">{error}</p>}
      </form>

      {list.length === 0 ? (
        <div className="rounded-xl border border-dashed border-surface-border p-6 text-center">
          <Icon size={18} className="mx-auto text-slate-300"/>
          <p className="text-[12px] font-semibold text-slate-600 mt-2">No {channel === 'email' ? 'email addresses' : 'numbers'} yet</p>
          <p className="text-[11px] text-slate-400 mt-0.5">Add one above and choose which notifications it receives.</p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {list.map(r => (
            <div key={r.id} className="rounded-xl border border-surface-border p-3.5">
              <div className="flex items-center gap-2.5">
                <span className="w-7 h-7 rounded-lg bg-primary-50 text-primary flex items-center justify-center flex-shrink-0"><Icon size={13}/></span>
                <p className="text-[12.5px] font-semibold text-slate-800 flex-1 min-w-0 truncate">{r.to}</p>
                <button type="button" onClick={() => commit(list.filter(x => x.id !== r.id))} aria-label={`Remove ${r.to}`}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors"><Trash2 size={13}/></button>
              </div>
              {KIND_GROUPS.map(g => (
                <div key={g.id} className="mt-3 pt-3 border-t border-surface-border">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">{g.label}</p>
                  <div className="grid sm:grid-cols-2 gap-x-4 gap-y-3">
                    {NOTIFICATION_KINDS.filter(k => k.group === g.id).map(k => (
                      <div key={k.id} className="flex items-start gap-2.5">
                        <Switch on={isOn(r, k.id)} onChange={v => setRecipientKind(r.id, k.id, v)} label={`${k.label} for ${r.to}`}/>
                        <div className="min-w-0">
                          <p className="text-[12px] font-semibold text-slate-700 leading-tight">{k.label}</p>
                          <p className="text-[10.5px] text-slate-400 leading-snug mt-0.5">{k.hint}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
              {!NOTIFICATION_KINDS.some(k => isOn(r, k.id)) && <p className="mt-2.5 text-[10.5px] text-amber-600">Nothing is switched on, so this one receives nothing.</p>}
            </div>
          ))}
        </div>
      )}

      <MessagePreview channel={channel}/>
      <p className="text-[10.5px] text-slate-400 leading-snug">
        Your choices are saved, but {meta.label} messages are not being sent yet: no {channel === 'email' ? 'email' : channel === 'sms' ? 'SMS' : 'WhatsApp'} sending service is connected to lead events.
      </p>
    </div>
  )
}
