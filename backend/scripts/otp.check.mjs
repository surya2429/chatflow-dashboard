// Run: node scripts/otp.check.mjs  (from backend/) — OTP Verify: who gets the code, the message, the code itself.
import assert from 'node:assert/strict'
import { OTP_LEN, otpCfg, pickContact, renderOtp, newOtpCode, maskContact, DEFAULT_OTP_TEMPLATES } from '../../src/components/webchat/otp.js'

assert.equal(OTP_LEN, 4)
for (let i = 0; i < 200; i++) assert.match(newOtpCode(), /^\d{4}$/)
// each channel ships a default message that carries the code
for (const k of ['sms', 'whatsapp', 'email']) assert.match(DEFAULT_OTP_TEMPLATES[k].body, /\{\{otp\}\}/, k)
assert.ok(DEFAULT_OTP_TEMPLATES.email.subject)
assert.equal(renderOtp('{{otp}} and {{ OTP }}', '4821'), '4821 and 4821')
// an unknown channel falls back to sms
assert.equal(otpCfg({ channel: 'fax' }).channel, 'sms')

const log = [
  { nodeId: 'a', questionType: 'phone', value: '+91 98765 43210' },
  { nodeId: 'b', questionType: 'email', value: 'me@example.com' },
  { nodeId: 'c', questionType: 'phone', value: '+91 99999 11111' },
  { nodeId: 'd', questionType: 'short', value: 'hello' },
]
assert.equal(pickContact(log, otpCfg({ channel: 'sms' })), '+91 99999 11111', 'latest phone answer')
assert.equal(pickContact(log, otpCfg({ channel: 'whatsapp', sourceNodeId: 'a' })), '+91 98765 43210', 'chosen question wins')
assert.equal(pickContact(log, otpCfg({ channel: 'email' })), 'me@example.com')
assert.equal(pickContact(log, otpCfg({ channel: 'email', sourceNodeId: 'a' })), '', 'a phone answer is not an email')
assert.equal(pickContact(log, otpCfg({ channel: 'sms', sourceNodeId: 'gone' })), '', 'removed source question: nobody')
assert.equal(pickContact([{ nodeId: 'x', questionType: 'phone', value: '12' }], otpCfg({})), '', 'too short to be a number')
assert.equal(pickContact([], otpCfg({})), '')
assert.equal(maskContact('+91 98765 43210'), '••••3210'); assert.equal(maskContact('me@example.com'), 'm•••@example.com')
console.log('otp: ok')
