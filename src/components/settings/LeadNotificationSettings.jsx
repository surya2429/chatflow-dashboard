// LeadNotificationSettings.jsx — Settings > Email / SMS / WhatsApp notifications.
// Add up to 5 recipients for the channel and choose which notifications each one receives. Every recipient and the
// message preview open and close, so the page stays short.
import { useMemo, useState } from 'react'
import clsx from 'clsx'
import { ChevronDown, Mail, MessageCircle, Monitor, Plus, Smartphone, Trash2 } from 'lucide-react'
import {
  KIND_GROUPS, MAX_RECIPIENTS, NOTIFICATION_CHANNELS, NOTIFICATION_KINDS, addRecipient, buildNotificationMessage, formatPhone, isOn,
  loadNotificationConfig, saveNotificationConfig,
} from '../../lib/leadNotifications'
import { buildEmailHtml } from '../../lib/emailTemplates'
import { NativeSelect } from '../Select'
import { CountryPicker } from '../webchat/PhoneCountrySettings'
import { COUNTRIES } from '../webchat/AnswerControls'
import { useApp } from '../../context/AppContext'

const ICON = { email: Mail, sms: Smartphone, whatsapp: MessageCircle }

function Switch({ on, onChange, label }) {
  return (
    <button type="button" role="switch" aria-checked={on} aria-label={label} onClick={() => onChange(!on)}
      className="relative flex-shrink-0 rounded-full transition-colors mt-0.5" style={{ width: 34, height: 18, background: on ? '#0066ff' : '#d1d5db' }}>
      <span className="absolute rounded-full bg-white shadow transition-all" style={{ top: 2, left: on ? 18 : 2, width: 14, height: 14 }}/>
    </button>
  )
}

/* A card whose header opens and closes it. */
function Collapsible({ open, onToggle, header, actions, children }) {
  return (
    <div className="rounded-xl border border-surface-border">
      <div className="flex items-center">
        <button type="button" aria-expanded={open} onClick={onToggle} className="flex-1 min-w-0 flex items-center gap-2.5 px-3.5 py-2.5 text-left">
          {header}
          <ChevronDown size={14} className={clsx('text-slate-400 flex-shrink-0 transition-transform', open && 'rotate-180')}/>
        </button>
        {actions}
      </div>
      {open && <div className="px-3.5 pb-3.5 pt-3 border-t border-surface-border">{children}</div>}
    </div>
  )
}

/* The message a recipient gets. The email is the real designed email in a sandboxed frame; SMS and WhatsApp are text. */
function MessagePreview({ channel, botName }) {
  const [open, setOpen] = useState(false)
  const [kind, setKind] = useState('lead')
  const [mobile, setMobile] = useState(false)
  const isLead = kind === 'lead' || kind === 'revisit'
  const email = useMemo(() => channel === 'email' ? buildEmailHtml({ kind, botName, baseUrl: window.location.origin }) : null, [channel, kind, botName])
  const sms = channel === 'email' ? null : buildNotificationMessage({ kind, channel, botName })
  const bold = s => s.split(/\*([^*]+)\*/).map((p, i) => i % 2 ? <b key={i}>{p}</b> : p)
  return (
    <Collapsible open={open} onToggle={() => setOpen(o => !o)}
      header={<span className="flex-1 min-w-0"><span className="block text-[12.5px] font-semibold text-slate-800">Preview the message</span><span className="block text-[10.5px] text-slate-400">{channel === 'email' ? 'See the designed email for each notification' : 'See what each notification says'}</span></span>}>
      <div className="flex items-center justify-between gap-2 flex-wrap mb-3">
        <div className="w-full sm:w-72">
          <NativeSelect sm value={kind} onChange={e => setKind(e.target.value)} aria-label="Message to preview">
            {NOTIFICATION_KINDS.map(k => <option key={k.id} value={k.id}>{k.label}</option>)}
          </NativeSelect>
        </div>
        {channel === 'email' && (
          <div className="inline-flex rounded-lg bg-slate-200/70 p-0.5">
            {[[false, 'Desktop', Monitor], [true, 'Phone', Smartphone]].map(([v, l, I]) => (
              <button key={l} type="button" onClick={() => setMobile(v)} aria-pressed={mobile === v}
                className={clsx('flex items-center gap-1 px-2.5 py-1 rounded-md text-[10.5px] font-semibold', mobile === v ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500')}><I size={11}/>{l}</button>
            ))}
          </div>
        )}
      </div>
      {channel === 'email' ? (
        <>
          <p className="text-[10.5px] text-slate-400 mb-1.5">Subject: <span className="font-semibold text-slate-600">{email.subject}</span></p>
          <div className="rounded-xl bg-[#f3f5f9] border border-surface-border overflow-hidden flex justify-center">
            <iframe title="Email preview" sandbox="" srcDoc={email.html} className="border-0 bg-[#f3f5f9] transition-all" style={{ width: mobile ? 375 : '100%', maxWidth: '100%', height: 640 }}/>
          </div>
          <p className="text-[10px] text-slate-400 mt-2">{isLead ? "The lead's details and the time come first, then the chat transcript. " : ''}The figures are examples.</p>
        </>
      ) : (
        <>
          <div className="rounded-lg bg-slate-50 p-3">
            <div className={clsx('whitespace-pre-line text-[11.5px] leading-relaxed text-slate-700 max-w-[460px] rounded-2xl rounded-tl-sm px-3 py-2 shadow-sm border border-surface-border', channel === 'whatsapp' ? 'bg-[#dcf8c6]' : 'bg-white')}>
              {channel === 'whatsapp' ? bold(sms.text) : sms.text}
            </div>
          </div>
          <p className="text-[10px] text-slate-400 mt-2">{isLead ? "The lead's details and the time. The chat transcript is only in the email. " : ''}The figures are examples.</p>
        </>
      )}
    </Collapsible>
  )
}

export default function LeadNotificationSettings({ channel }) {
  const meta = NOTIFICATION_CHANNELS[channel]
  const Icon = ICON[channel]
  const { activeBot } = useApp()
  const botName = activeBot?.name || 'Your chatbot'
  // SMS is for India only, so its picker holds India alone; WhatsApp can reach any country.
  const countries = meta.countries ? COUNTRIES.filter(c => meta.countries.includes(c.code)) : COUNTRIES
  const [country, setCountry] = useState('IN')
  const dial = (countries.find(c => c.code === country) || countries[0]).dial
  const isPhone = channel !== 'email'
  const [config, setConfig] = useState(loadNotificationConfig)
  const [draft, setDraft] = useState('')
  const [error, setError] = useState('')
  const [open, setOpen] = useState(() => new Set())     // recipients are closed to begin with; a new one opens
  const list = config[channel]
  const commit = next => { const c = { ...config, [channel]: next }; setConfig(c); saveNotificationConfig(c) }
  const toggle = id => setOpen(s => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n })

  const add = e => {
    e.preventDefault()
    const r = addRecipient(list, channel, draft, dial)
    if (r.error) return setError(r.error)
    commit(r.list); setOpen(s => new Set(s).add(r.added.id)); setDraft(''); setError('')
  }
  const setKinds = (id, change) => commit(list.map(r => r.id === id ? { ...r, kinds: { ...r.kinds, ...change } } : r))
  const setAll = (id, on) => setKinds(id, Object.fromEntries(NOTIFICATION_KINDS.map(k => [k.id, on])))
  const full = list.length >= MAX_RECIPIENTS

  return (
    <div className="max-w-[720px] space-y-3.5">
      <div>
        <h2 className="text-[14px] font-bold text-slate-900">{meta.label} notifications</h2>
        <p className="text-[11px] text-slate-500 mt-0.5">Add up to {MAX_RECIPIENTS} {channel === 'email' ? 'email addresses' : 'numbers'} and choose what each one is told about. Changes save automatically.</p>
      </div>

      <form onSubmit={add} noValidate className="space-y-1.5">
        <div className="flex items-center justify-between">
          <label htmlFor={`add-${channel}`} className="text-[11px] font-semibold text-slate-700">Add {meta.noun}</label>
          <span className="text-[10.5px] text-slate-400">{list.length} of {MAX_RECIPIENTS} added</span>
        </div>
        <div className="flex gap-2">
          {isPhone && <div className="w-[116px] flex-shrink-0"><CountryPicker compact value={country} onChange={setCountry} options={countries} placeholder="Country"/></div>}
          <input id={`add-${channel}`} value={draft} disabled={full} onChange={e => { setDraft(e.target.value); setError('') }}
            type={isPhone ? 'tel' : 'email'} placeholder={full ? `You have added ${MAX_RECIPIENTS}. Remove one to add another.` : meta.placeholder}
            className="input flex-1 disabled:bg-slate-50"/>
          <button type="submit" disabled={full || !draft.trim()}
            className="flex items-center gap-1.5 px-3 h-9 rounded-lg bg-primary text-white text-[11.5px] font-semibold hover:bg-primary/90 disabled:opacity-40 transition-colors">
            <Plus size={13}/> Add
          </button>
        </div>
        {error && <p role="alert" className="text-[10.5px] text-red-500">{error}</p>}
        {!error && channel === 'sms' && <p className="text-[10.5px] text-slate-400">SMS works for Indian mobile numbers only. Type the 10 digits.</p>}
        {!error && channel === 'whatsapp' && <p className="text-[10.5px] text-slate-400">Pick the country, then type the number without the country code.</p>}
      </form>

      {list.length === 0 ? (
        <div className="rounded-xl border border-dashed border-surface-border px-4 py-5 text-center">
          <p className="text-[12px] font-semibold text-slate-600">No {channel === 'email' ? 'email addresses' : 'numbers'} yet</p>
          <p className="text-[11px] text-slate-400 mt-0.5">Add one above and choose which notifications it receives.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {list.map(r => {
            const on = NOTIFICATION_KINDS.filter(k => isOn(r, k.id)).length
            return (
              <Collapsible key={r.id} open={open.has(r.id)} onToggle={() => toggle(r.id)}
                header={<>
                  <span className="w-7 h-7 rounded-lg bg-primary-50 text-primary flex items-center justify-center flex-shrink-0"><Icon size={13}/></span>
                  <span className="flex-1 min-w-0 truncate text-[12.5px] font-semibold text-slate-800">{isPhone ? formatPhone(r.to) : r.to}</span>
                  <span className={clsx('flex-shrink-0 px-2 py-0.5 rounded-full text-[10px] font-semibold', on ? 'bg-slate-100 text-slate-600' : 'bg-amber-50 text-amber-600')}>
                    {on ? `${on} of ${NOTIFICATION_KINDS.length} on` : 'Nothing on'}
                  </span>
                </>}
                actions={<button type="button" onClick={() => commit(list.filter(x => x.id !== r.id))} aria-label={`Remove ${r.to}`}
                  className="mr-2 p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors"><Trash2 size={13}/></button>}>
                <div className="flex items-center justify-end gap-3 -mt-1 mb-1">
                  <button type="button" onClick={() => setAll(r.id, true)} className="text-[10.5px] font-semibold text-primary hover:underline">Turn all on</button>
                  <button type="button" onClick={() => setAll(r.id, false)} className="text-[10.5px] font-semibold text-slate-500 hover:underline">Turn all off</button>
                </div>
                {KIND_GROUPS.map((g, gi) => (
                  <div key={g.id} className={clsx(gi > 0 && 'mt-3 pt-3 border-t border-surface-border')}>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">{g.label}</p>
                    <div className="grid sm:grid-cols-2 gap-x-4 gap-y-2.5">
                      {NOTIFICATION_KINDS.filter(k => k.group === g.id).map(k => (
                        <div key={k.id} className="flex items-start gap-2.5">
                          <Switch on={isOn(r, k.id)} onChange={v => setKinds(r.id, { [k.id]: v })} label={`${k.label} for ${r.to}`}/>
                          <div className="min-w-0">
                            <p className="text-[12px] font-semibold text-slate-700 leading-tight">{k.label}</p>
                            <p className="text-[10.5px] text-slate-400 leading-snug mt-0.5">{k.hint}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </Collapsible>
            )
          })}
        </div>
      )}

      <MessagePreview channel={channel} botName={botName}/>
      <p className="text-[10.5px] text-slate-400 leading-snug">
        Your choices are saved, but {meta.label} messages are not being sent yet: no {channel === 'email' ? 'email' : channel === 'sms' ? 'SMS' : 'WhatsApp'} sending service is connected to these events.{channel === 'sms' && ' In India, SMS text must also be registered (DLT) with your SMS provider before it can be sent.'}
      </p>
    </div>
  )
}
