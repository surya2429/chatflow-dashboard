// OtpSettings.jsx — the OTP Verify question's settings in the flow builder's edit popup.
// The message itself is fixed (see DEFAULT_OTP_TEMPLATES in otp.js); the author picks the channel, who gets the code,
// whether visitors may skip or resend, and how long they wait before resending.
import clsx from 'clsx'
import { Mail, MessageCircle, MessageSquare } from 'lucide-react'
import { NativeSelect } from '../Select'
import { OTP_CHANNELS, OTP_LEN, RESEND_WAITS, channelOf, otpCfg } from './otp'

const CHANNEL_UI = {
  sms:      { icon: MessageSquare, hint: 'Text message to a phone number' },
  whatsapp: { icon: MessageCircle, hint: 'WhatsApp message to a phone number' },
  email:    { icon: Mail,          hint: 'Email to an address' },
}

function Switch({ on, onChange, label }) {
  return (
    <button type="button" role="switch" aria-checked={on} aria-label={label} onClick={() => onChange(!on)}
      className="relative flex-shrink-0 rounded-full transition-colors mt-0.5" style={{ width: 34, height: 18, background: on ? '#0066ff' : '#d1d5db' }}>
      <span className="absolute rounded-full bg-white shadow transition-all" style={{ top: 2, left: on ? 18 : 2, width: 14, height: 14 }}/>
    </button>
  )
}

function SwitchRow({ on, onChange, title, hint, children }) {
  return (
    <div className="p-2.5 rounded-lg border border-surface-border">
      <div className="flex items-start gap-2.5">
        <Switch on={on} onChange={onChange} label={title}/>
        <div className="min-w-0">
          <p className="text-[12px] font-semibold text-slate-700 leading-tight">{title}</p>
          <p className="text-[10.5px] text-slate-400 leading-snug mt-0.5">{hint}</p>
        </div>
      </div>
      {children}
    </div>
  )
}

export default function OtpSettings({ config, onChange, allNodes, nodeId }) {
  const cfg = otpCfg(config)
  const set = (k, v) => onChange({ ...cfg, [k]: v })
  const ch = channelOf(cfg.channel)
  const noun = ch.kind === 'email' ? 'Email' : 'Phone'
  const questions = (allNodes || []).filter(n => n.id !== nodeId && n.data?.questionType === ch.kind)
  const missingSource = cfg.sourceNodeId && !questions.some(n => n.id === cfg.sourceNodeId)
  const waits = RESEND_WAITS.some(w => w.seconds === cfg.seconds) ? RESEND_WAITS : [...RESEND_WAITS, { seconds: cfg.seconds, label: `${cfg.seconds} seconds` }]
  return (
    <div className="space-y-3">
      <div className="space-y-1.5">
        <label className="label">Send the {OTP_LEN}-digit code by</label>
        <div className="grid grid-cols-3 gap-1.5">
          {OTP_CHANNELS.map(c => {
            const { icon: Icon, hint } = CHANNEL_UI[c.id], on = cfg.channel === c.id
            return (
              <button key={c.id} type="button" onClick={() => set('channel', c.id)} aria-pressed={on}
                className={clsx('flex flex-col items-start gap-1 p-2.5 rounded-xl border text-left transition-colors', on ? 'border-primary bg-primary-50' : 'border-surface-border hover:bg-surface-hover')}>
                <Icon size={14} className={on ? 'text-primary' : 'text-slate-400'}/>
                <span className={clsx('text-[11.5px] font-bold', on ? 'text-primary' : 'text-slate-700')}>{c.label}</span>
                <span className="text-[9.5px] text-slate-400 leading-snug">{hint}</span>
              </button>
            )
          })}
        </div>
      </div>

      <div className="space-y-1">
        <label className="label">Send to</label>
        <NativeSelect sm value={cfg.sourceNodeId || ''} onChange={e => set('sourceNodeId', e.target.value)}>
          <option value="">Automatic: the latest {noun} answer before this step</option>
          {questions.map(n => <option key={n.id} value={n.id}>{n.data.name || n.data.question || n.id}</option>)}
        </NativeSelect>
        <p className="text-[10px] text-slate-400">Add a {noun} question earlier in the flow and connect (or jump) it to this step.</p>
        {!questions.length && <p role="alert" className="text-[10px] text-amber-600">There is no {noun} question in this flow yet.</p>}
        {missingSource && <p role="alert" className="text-[10px] text-red-500">The question picked here was removed or is not a {noun} question. No code can be sent until you choose another.</p>}
      </div>

      <SwitchRow on={cfg.allowSkip} onChange={v => set('allowSkip', v)} title="Allow skipping verification"
        hint="Shows a “Skip verification” link. The chat moves on and the answer is recorded as skipped."/>

      <SwitchRow on={cfg.showResend} onChange={v => set('showResend', v)} title="Allow resending the code"
        hint="Each resend creates a new code.">
        {cfg.showResend && (
          <div className="mt-2.5 pt-2.5 border-t border-surface-border space-y-1">
            <label className="label">Resend available after</label>
            <NativeSelect sm value={cfg.seconds} onChange={e => onChange({ ...cfg, seconds: +e.target.value, showTimer: true })}>
              {waits.map(w => <option key={w.seconds} value={w.seconds}>{w.label}</option>)}
            </NativeSelect>
          </div>
        )}
      </SwitchRow>

      <SwitchRow on={cfg.testMode} onChange={v => set('testMode', v)} title="Test mode: show the code in the chat"
        hint="No SMS, WhatsApp or email service is connected yet, so nothing is delivered. Leave this on to try the flow; the message that would be sent appears in the Activity trail."/>
    </div>
  )
}
