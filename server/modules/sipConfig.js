/**
 * MODULE 7 — sipConfig.js
 * SIP integration utilities and reference configuration.
 *
 * SIP domain: wa.meta.vc  |  Default TLS port: 5061
 * TLS is MANDATORY. mTLS NOT supported.
 * Meta always adds transport=TLS to the request URI.
 *
 * WARNING: Enabling SIP disables the Graph API /calls endpoints.
 *
 * STRICTLY PROHIBITED: PSTN on any leg of the call flow.
 *
 * Meta IP allowlist (for SIP + webhooks):
 *   31.13.24.0/21, 31.13.64.0/18, 45.64.40.0/22, 57.141.0.0/21,
 *   57.141.8.0/22, 57.141.12.0/23, 57.144.0.0/14, 66.220.144.0/20,
 *   69.63.176.0/20, 69.171.224.0/19, 74.119.76.0/22, 102.132.96.0/20,
 *   103.4.96.0/22, 129.134.0.0/16, 147.75.208.0/20, 157.240.0.0/16,
 *   163.70.128.0/17, 163.77.128.0/17, 173.252.64.0/18, 179.60.192.0/22,
 *   185.60.216.0/22, 185.89.216.0/22, 204.15.20.0/22
 *
 * ICE candidate ports (allowlist on firewall): 40012, 3482, 3484, 3478, 3480
 * RTP ports (open on your side): 10000–60000
 */
import { config } from '../config.js'
import { createLogger } from '../utils/logger.js'

const log = createLogger('sipConfig')

// ── SIP constants ──────────────────────────────────────────────────────────────
export const SIP = {
  DOMAIN:       'wa.meta.vc',
  PORT:         5061,
  TRANSPORT:    'tls',
  ICE_PORTS:    [40012, 3482, 3484, 3478, 3480],
  RTP_PORT_MIN: 10000,
  RTP_PORT_MAX: 60000,
  META_IPS: [
    '31.13.24.0/21', '31.13.64.0/18', '45.64.40.0/22',
    '57.141.0.0/21', '57.141.8.0/22', '57.141.12.0/23', '57.144.0.0/14',
    '66.220.144.0/20', '69.63.176.0/20', '69.171.224.0/19', '74.119.76.0/22',
    '102.132.96.0/20', '103.4.96.0/22', '129.134.0.0/16', '147.75.208.0/20',
    '157.240.0.0/16', '163.70.128.0/17', '163.77.128.0/17', '173.252.64.0/18',
    '179.60.192.0/22', '185.60.216.0/22', '185.89.216.0/22', '204.15.20.0/22',
  ],
}

// ── buildSipInviteUri ──────────────────────────────────────────────────────────
/**
 * Build the SIP Request-URI for a business-initiated call.
 * Format: sip:+{userPhone}@wa.meta.vc;transport=tls
 *
 * @param {string} userPhone — E.164 with '+' (e.g. "+919876543210")
 * @returns {string}
 */
export function buildSipInviteUri(userPhone) {
  const normalized = userPhone.startsWith('+') ? userPhone : `+${userPhone}`
  return `sip:${normalized}@${SIP.DOMAIN};transport=tls`
}

// ── buildSipFromHeader ─────────────────────────────────────────────────────────
/**
 * Build the SIP From header for business-initiated calls.
 * Must match the configured SIP server hostname.
 *
 * @param {string} bizPhone — E.164 with '+' (e.g. "+919876543210")
 * @param {string} domain — Your configured SIP server hostname
 * @returns {string}
 */
export function buildSipFromHeader(bizPhone, domain) {
  const normalized = bizPhone.startsWith('+') ? bizPhone : `+${bizPhone}`
  return `sip:${normalized}@${domain}`
}

// ── buildDigestAuth ────────────────────────────────────────────────────────────
/**
 * Build the Proxy-Authorization digest header for SIP INVITE re-submission.
 * Called after receiving 407 Proxy Authentication Required.
 *
 * Authentication details:
 *   username = normalized business phone number (no + prefix)
 *   realm    = wa.meta.vc
 *   password = Meta-generated (from GET settings?include_sip_credentials=true)
 *
 * @param {object} opts
 * @param {string} opts.username — business phone number without '+'
 * @param {string} opts.password — Meta-generated SIP password
 * @param {string} opts.realm — should be 'wa.meta.vc'
 * @param {string} opts.nonce — from 407 WWW-Authenticate header
 * @param {string} opts.uri — SIP Request-URI
 * @param {string} [opts.method='INVITE']
 * @returns {string} Proxy-Authorization header value
 */
export async function buildDigestAuth(opts) {
  const { username, password, realm, nonce, uri, method = 'INVITE' } = opts

  // RFC 3261 digest computation using MD5
  const { createHash } = await import('crypto')
  const ha1 = createHash('md5').update(`${username}:${realm}:${password}`).digest('hex')
  const ha2 = createHash('md5').update(`${method}:${uri}`).digest('hex')
  const nc  = '00000001'
  const cnonce = Math.random().toString(36).slice(2, 10)
  const response = createHash('md5').update(`${ha1}:${nonce}:${nc}:${cnonce}:auth:${ha2}`).digest('hex')

  return (
    `Digest username="${username}", realm="${realm}", nonce="${nonce}", ` +
    `uri="${uri}", nc=${nc}, cnonce="${cnonce}", response="${response}", algorithm=MD5, qop=auth`
  )
}

// ── getSipRegistrationConfig ───────────────────────────────────────────────────
/**
 * Returns the SIP registration/trunk configuration block for common PBX systems.
 * This is a reference guide — not an actual API call.
 *
 * @param {string} bizPhone — E.164 business phone number
 * @param {string} sipPassword — From Meta's GET settings?include_sip_credentials
 * @param {'asterisk'|'freeswitch'|'generic'} [pbx='generic']
 * @returns {object} Config reference
 */
export function getSipRegistrationConfig(bizPhone, sipPassword, pbx = 'generic') {
  const user = bizPhone.replace(/^\+/, '')

  const base = {
    server:    SIP.DOMAIN,
    port:      SIP.PORT,
    transport: 'TLS',
    username:  user,
    password:  sipPassword,
    realm:     SIP.DOMAIN,
    domain:    SIP.DOMAIN,
  }

  if (pbx === 'asterisk') {
    return {
      ...base,
      notes: 'pjsip.conf: rewrite_contact=no (CRITICAL — prevents 32s call drop bug)',
      pjsipConf: {
        endpoint: {
          media_encryption: 'sdes',
          allow:            'opus',
          rewrite_contact:  'no',     // CRITICAL
        },
        auth: {
          auth_type: 'md5',
          username:  user,
          password:  sipPassword,
          realm:     SIP.DOMAIN,
        },
        gateway: {
          from_user:   user,
          from_domain: config.sipServerHostname,
        },
      },
    }
  }

  if (pbx === 'freeswitch') {
    return {
      ...base,
      notes: [
        'external.xml: tls=true, configure tls-cert-dir',
        'vars.xml: rtp_secure_media=mandatory',
        'SIP port: 5081 (not 5061)',
        'Dialplan: play silence_stream://1000 before IVR to prevent audio clipping',
      ],
      externalXml: {
        gateway: {
          username:     user,
          password:     sipPassword,
          proxy:        `${SIP.DOMAIN}:${SIP.PORT}`,
          register:     true,
          'caller-id-in-from': true,
        },
      },
    }
  }

  return base
}

// ── parseSipCustomHeaders ──────────────────────────────────────────────────────
/**
 * Parse custom SIP headers sent by Meta (on INVITE + BYE).
 *
 * @param {object} headers — raw SIP headers object
 * @returns {object} Parsed custom fields
 */
export function parseSipCustomHeaders(headers) {
  return {
    callDuration:    headers['x-wa-meta-call-duration'] ? Number(headers['x-wa-meta-call-duration']) : undefined,
    wacid:           headers['x-wa-meta-wacid'],
    ctaPayload:      headers['x-wa-meta-cta-payload'],
    deeplinkPayload: headers['x-wa-meta-deeplink-payload'],
  }
}

// ── tlsCertCheck ───────────────────────────────────────────────────────────────
/**
 * Returns the openssl command to verify your SIP server's TLS certificate.
 * Certificate subject MUST cover your configured SIP hostname.
 * Hostname mismatch → user-initiated calls fail silently.
 *
 * @param {string} hostname
 * @param {number} [port=5061]
 * @returns {string} openssl command
 */
export function tlsCertCheck(hostname, port = 5061) {
  return `openssl s_client -quiet -verify_hostname ${hostname} -connect ${hostname}:${port}`
}

// ── Express router ────────────────────────────────────────────────────────────
import { Router } from 'express'
export const sipRouter = Router()

sipRouter.get('/config', (req, res) => {
  const { phone, password, pbx } = req.query
  if (!phone || !password) {
    return res.status(400).json({ error: 'phone and password are required' })
  }
  res.json(getSipRegistrationConfig(phone, password, pbx))
})

sipRouter.get('/constants', (req, res) => {
  res.json({
    domain:        SIP.DOMAIN,
    port:          SIP.PORT,
    transport:     SIP.TRANSPORT,
    icePorts:      SIP.ICE_PORTS,
    rtpPortRange:  `${SIP.RTP_PORT_MIN}–${SIP.RTP_PORT_MAX}`,
    allowlistIPs:  SIP.META_IPS,
    tlsCertCheck:  config.sipServerHostname
      ? tlsCertCheck(config.sipServerHostname)
      : 'SIP_SERVER_HOSTNAME not configured',
  })
})

sipRouter.post('/digest-auth', async (req, res, next) => {
  try {
    const auth = await buildDigestAuth(req.body)
    res.json({ authorization: auth })
  } catch (e) { next(e) }
})

sipRouter.post('/parse-headers', (req, res) => {
  res.json(parseSipCustomHeaders(req.body.headers || {}))
})
