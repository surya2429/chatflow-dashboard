/* OTP Verify question: channels, the default message for each, and picking who the code goes to.
   The code is OTP_LEN digits. The "who" is a Phone or Email question the visitor answered earlier in the flow. */
export const OTP_LEN = 4

export const OTP_CHANNELS = [
  { id: 'sms',      label: 'SMS',      kind: 'phone' },
  { id: 'whatsapp', label: 'WhatsApp', kind: 'phone' },
  { id: 'email',    label: 'Email',    kind: 'email' },
]

export const DEFAULT_OTP_TEMPLATES = {
  sms:      { body: '{{otp}} is your verification code. Do not share it with anyone.' },
  whatsapp: { body: '*{{otp}}* is your verification code. For your security, do not share this code with anyone.' },
  email:    { subject: 'Your verification code', body: 'Hi,\n\nYour verification code is {{otp}}.\n\nIf you did not ask for this code, you can ignore this email.' },
}

export const RESEND_WAITS = [{ seconds: 30, label: '30 seconds' }, { seconds: 60, label: '60 seconds' }, { seconds: 120, label: '2 minutes' }, { seconds: 300, label: '5 minutes' }]

export const DEFAULT_OTP_CONFIG = { channel: 'sms', sourceNodeId: '', testMode: true, allowSkip: false, showTimer: true, showResend: true, seconds: 30 }

/** Saved config over the defaults; each channel keeps its own message. */
export function otpCfg(config) {
  const c = { ...DEFAULT_OTP_CONFIG, ...config }
  if (!OTP_CHANNELS.some(x => x.id === c.channel)) c.channel = 'sms'
  c.templates = Object.fromEntries(Object.keys(DEFAULT_OTP_TEMPLATES).map(k => [k, { ...DEFAULT_OTP_TEMPLATES[k], ...config?.templates?.[k] }]))
  return c
}

export const channelOf = id => OTP_CHANNELS.find(c => c.id === id) || OTP_CHANNELS[0]
export const renderOtp = (text, code) => String(text || '').replace(/\{\{\s*otp\s*\}\}/gi, code)
export const hasOtpToken = text => /\{\{\s*otp\s*\}\}/i.test(String(text || ''))

export function newOtpCode() {
  const n = crypto.getRandomValues(new Uint32Array(1))[0] % 10 ** OTP_LEN
  return String(n).padStart(OTP_LEN, '0')
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const valid = (kind, v) => kind === 'email' ? EMAIL.test(v) : v.replace(/\D/g, '').length >= 7

/** Who gets the code: the chosen question's answer, else the latest answered Phone/Email question that fits the channel.
    `log` is [{ nodeId, questionType, value }] in the order the visitor answered. Returns '' when there is nobody valid. */
export function pickContact(log, cfg) {
  const kind = channelOf(cfg.channel).kind
  const hit = cfg.sourceNodeId
    ? [...log].reverse().find(a => a.nodeId === cfg.sourceNodeId)
    : [...log].reverse().find(a => a.questionType === kind && valid(kind, String(a.value || '').trim()))
  const v = String(hit?.value || '').trim()
  return valid(kind, v) ? v : ''
}

export function maskContact(v) {
  if (v.includes('@')) { const [u, d] = v.split('@'); return `${u[0]}•••@${d}` }
  const digits = v.replace(/\D/g, '')
  return `••••${digits.slice(-4)}`
}
