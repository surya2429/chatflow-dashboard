import dotenv from 'dotenv'
dotenv.config()

// ── Validate required env vars at startup ─────────────────────────────────────
const REQUIRED = ['PHONE_NUMBER_ID', 'WABA_ID', 'ACCESS_TOKEN', 'WEBHOOK_VERIFY_TOKEN']
const missing  = REQUIRED.filter(k => !process.env[k])
if (missing.length) {
  throw new Error(`[config] Missing required env vars: ${missing.join(', ')}`)
}

export const config = {
  phoneNumberId:      process.env.PHONE_NUMBER_ID,
  wabaId:             process.env.WABA_ID,
  accessToken:        process.env.ACCESS_TOKEN,
  webhookVerifyToken: process.env.WEBHOOK_VERIFY_TOKEN,
  port:               parseInt(process.env.PORT || '3000', 10),
  sipServerHostname:  process.env.SIP_SERVER_HOSTNAME || null,
  sipServerPort:      parseInt(process.env.SIP_SERVER_PORT || '5061', 10),
  baseUrl:            'https://graph.facebook.com/v20.0',
  minApiVersion:      'v17.0',
}
