/**
 * MODULE 8 — sdpUtils.js
 * SDP generation utilities for WhatsApp WebRTC calls.
 *
 * MANDATORY rules:
 *  - CRLF (\r\n) line endings — never \n alone
 *  - Only ONE audio stream, ONE track, ONE SSRC per SDP (multiple = severe media corruption)
 *  - ICE: Meta is ICE-LITE → your side MUST be ICE-FULL and CONTROLLING role
 *  - Your side initiates STUN connectivity checks
 *  - Use regular nomination (NOT aggressive)
 *  - Your side acts as DTLS CLIENT (a=setup:active in answer)
 *  - ECDSA cert recommended for DTLS (shorter handshake, no fragmentation)
 *  - ptime:20 is MANDATORY
 *  - DTMF (telephone-event) clock rate: ONLY 8000 Hz
 *  - Opus clock rate: 48000 Hz
 *  - Do NOT use legacy connection.webrtc.sdp parameter (deprecated)
 */
import { randomBytes } from 'crypto'

const CRLF = '\r\n'

// ── ICE credential helpers ────────────────────────────────────────────────────
function randomIceUfrag()  { return randomBytes(4).toString('base64').slice(0, 4) }
function randomIcePwd()    { return randomBytes(18).toString('base64').slice(0, 24) }
function randomSsrc()      { return Math.floor(Math.random() * 0xFFFFFFFF) }
function randomCname()     { return randomBytes(8).toString('hex') }
function randomSessionId() { return String(Date.now()) }

// ── generateSdpOffer ──────────────────────────────────────────────────────────
/**
 * Generate an SDP offer for business-initiated calls.
 *
 * Includes:
 *  - BUNDLE grouping
 *  - Opus (PT 111, 48kHz, 2ch)
 *  - DTMF telephone-event (PT 126, 8kHz) ← MANDATORY clock rate
 *  - G.711 PCMU/PCMA (PT 0/8) if additionalCodecs includes them
 *  - ICE trickle
 *  - DTLS fingerprint (actpass)
 *  - ptime:20 + maxptime:20 (MANDATORY)
 *  - Single SSRC
 *
 * @param {object} opts
 * @param {string} opts.dtlsFingerprint — SHA-256 fingerprint of your ECDSA cert
 *   Format: "AA:BB:CC:..." (colon-separated hex)
 * @param {Array<{foundation,component,transport,priority,ip,port,type}>} [opts.candidates=[]]
 *   ICE candidates — can be empty if using ICE trickle
 * @param {string[]} [opts.additionalCodecs=[]] — ['PCMU','PCMA'] to enable G.711
 * @param {boolean} [opts.useSdes=false] — Use SDES instead of DTLS-SRTP
 * @param {string} [opts.sdesKey] — Base64 SRTP key (required if useSdes=true)
 * @returns {string} SDP offer string (CRLF line endings)
 */
export function generateSdpOffer(opts = {}) {
  const {
    dtlsFingerprint,
    candidates       = [],
    additionalCodecs = [],
    useSdes          = false,
    sdesKey,
  } = opts

  if (!useSdes && !dtlsFingerprint) {
    throw new Error('dtlsFingerprint is required for DTLS mode')
  }
  if (useSdes && !sdesKey) {
    throw new Error('sdesKey is required for SDES mode')
  }

  const ufrag     = randomIceUfrag()
  const pwd       = randomIcePwd()
  const ssrc      = randomSsrc()
  const cname     = randomCname()
  const sessionId = randomSessionId()

  // Build codec list
  const payloadTypes = ['111', '126']
  const hasG711 = additionalCodecs.some(c => ['PCMA','PCMU'].includes(c.toUpperCase()))
  if (hasG711) payloadTypes.push('0', '8')

  const mediaProto = useSdes ? 'RTP/SAVP' : 'UDP/TLS/RTP/SAVPF'

  const lines = [
    // ── Session ──────────────────────────────────────────────────────────────
    `v=0`,
    `o=- ${sessionId} 2 IN IP4 0.0.0.0`,
    `s=-`,
    `t=0 0`,
    `a=group:BUNDLE audio`,
    `a=msid-semantic: WMS`,

    // ── Media ─────────────────────────────────────────────────────────────────
    `m=audio 9 ${mediaProto} ${payloadTypes.join(' ')}`,
    `c=IN IP4 0.0.0.0`,
    `a=rtcp:9 IN IP4 0.0.0.0`,

    // ICE
    `a=ice-ufrag:${ufrag}`,
    `a=ice-pwd:${pwd}`,
    `a=ice-options:trickle`,
  ]

  // ICE candidates
  for (const c of candidates) {
    lines.push(
      `a=candidate:${c.foundation} ${c.component} ${c.transport} ${c.priority} ` +
      `${c.ip} ${c.port} typ ${c.type}`
    )
  }
  lines.push(`a=end-of-candidates`)

  // DTLS or SDES
  if (useSdes) {
    lines.push(`a=crypto:1 AES_CM_128_HMAC_SHA1_80 inline:${sdesKey}`)
  } else {
    lines.push(`a=fingerprint:sha-256 ${dtlsFingerprint}`)
    lines.push(`a=setup:actpass`)
  }

  lines.push(
    `a=mid:audio`,
    `a=sendrecv`,
    `a=rtcp-mux`,

    // Opus — mandatory, 48kHz
    `a=rtpmap:111 opus/48000/2`,
    `a=rtcp-fb:111 transport-cc`,
    `a=fmtp:111 minptime=10;useinbandfec=1`,

    // DTMF — MUST be 8000 Hz
    `a=rtpmap:126 telephone-event/8000`,
    `a=fmtp:126 0-15`,
  )

  // G.711 codecs (if requested via settings)
  if (hasG711) {
    if (additionalCodecs.some(c => c.toUpperCase() === 'PCMU')) {
      lines.push(`a=rtpmap:0 PCMU/8000`)
    }
    if (additionalCodecs.some(c => c.toUpperCase() === 'PCMA')) {
      lines.push(`a=rtpmap:8 PCMA/8000`)
    }
  }

  lines.push(
    // MANDATORY timing
    `a=ptime:20`,
    `a=maxptime:20`,

    // Single SSRC — NEVER use multiple SSRCs
    `a=ssrc:${ssrc} cname:${cname}`,
    `a=ssrc:${ssrc} msid:- audio`,
    `a=ssrc:${ssrc} mslabel:-`,
    `a=ssrc:${ssrc} label:audio`,
  )

  return lines.join(CRLF) + CRLF
}

// ── generateSdpAnswer ─────────────────────────────────────────────────────────
/**
 * Generate an SDP answer from Meta's SDP offer (for user-initiated calls).
 *
 * Key rules for answer:
 *  - a=setup:active (Meta uses actpass → you must be active = DTLS client)
 *  - Match same codec payload types as offer
 *  - Include your own ICE credentials
 *  - ICE-FULL, CONTROLLING role
 *  - Single SSRC only
 *
 * @param {string} offerSdp — Meta's SDP offer string
 * @param {object} opts
 * @param {string} opts.dtlsFingerprint — Your ECDSA cert SHA-256 fingerprint
 * @param {Array<{foundation,component,transport,priority,ip,port,type}>} [opts.candidates=[]]
 * @param {boolean} [opts.useSdes=false]
 * @param {string} [opts.sdesKey]
 * @returns {string} SDP answer string (CRLF line endings)
 */
export function generateSdpAnswer(offerSdp, opts = {}) {
  const {
    dtlsFingerprint,
    candidates = [],
    useSdes    = false,
    sdesKey,
  } = opts

  if (!useSdes && !dtlsFingerprint) {
    throw new Error('dtlsFingerprint is required for DTLS mode')
  }

  // Parse offer to extract mid and payload types
  const offerLines = offerSdp.split(/\r?\n/)
  const mid = offerLines.find(l => l.startsWith('a=mid:'))?.slice(6) || 'audio'

  // Extract payload types from m= line
  const mLine = offerLines.find(l => l.startsWith('m=audio'))
  const mParts = mLine?.split(' ') || []
  const payloadTypes = mParts.slice(3) // after port and proto

  const ufrag     = randomIceUfrag()
  const pwd       = randomIcePwd()
  const ssrc      = randomSsrc()
  const cname     = randomCname()
  const sessionId = randomSessionId()

  const proto = useSdes ? 'RTP/SAVP' : 'UDP/TLS/RTP/SAVPF'

  const lines = [
    `v=0`,
    `o=- ${sessionId} 2 IN IP4 0.0.0.0`,
    `s=-`,
    `t=0 0`,
    `a=group:BUNDLE ${mid}`,
    `a=msid-semantic: WMS`,

    `m=audio 9 ${proto} ${payloadTypes.join(' ')}`,
    `c=IN IP4 0.0.0.0`,
    `a=rtcp:9 IN IP4 0.0.0.0`,

    `a=ice-ufrag:${ufrag}`,
    `a=ice-pwd:${pwd}`,
    `a=ice-options:trickle`,
  ]

  for (const c of candidates) {
    lines.push(
      `a=candidate:${c.foundation} ${c.component} ${c.transport} ${c.priority} ` +
      `${c.ip} ${c.port} typ ${c.type}`
    )
  }
  lines.push(`a=end-of-candidates`)

  if (useSdes) {
    lines.push(`a=crypto:1 AES_CM_128_HMAC_SHA1_80 inline:${sdesKey}`)
  } else {
    lines.push(`a=fingerprint:sha-256 ${dtlsFingerprint}`)
    lines.push(`a=setup:active`) // We are DTLS client
  }

  lines.push(
    `a=mid:${mid}`,
    `a=sendrecv`,
    `a=rtcp-mux`,
    `a=rtpmap:111 opus/48000/2`,
    `a=rtcp-fb:111 transport-cc`,
    `a=fmtp:111 minptime=10;useinbandfec=1`,
    `a=rtpmap:126 telephone-event/8000`,
    `a=fmtp:126 0-15`,
    `a=ptime:20`,
    `a=maxptime:20`,
    `a=ssrc:${ssrc} cname:${cname}`,
    `a=ssrc:${ssrc} msid:- audio`,
  )

  return lines.join(CRLF) + CRLF
}

// ── parseSdp ──────────────────────────────────────────────────────────────────
/**
 * Parse an SDP string into a structured object for debugging/logging.
 * @param {string} sdp
 * @returns {object}
 */
export function parseSdp(sdp) {
  const lines  = sdp.split(/\r?\n/).filter(Boolean)
  const result = { session: {}, media: [] }
  let current  = result.session

  for (const line of lines) {
    const [type, ...rest] = line.split('=')
    const value = rest.join('=')
    if (type === 'm') {
      current = { raw: value, attributes: [] }
      result.media.push(current)
    } else if (type === 'a') {
      const [attr, ...val] = value.split(':')
      ;(current.attributes = current.attributes || []).push({ attr, value: val.join(':') })
    } else {
      current[type] = value
    }
  }
  return result
}

// ── validateSdp ───────────────────────────────────────────────────────────────
/**
 * Validate an SDP string against WhatsApp calling requirements.
 * Returns { valid: boolean, errors: string[] }
 */
export function validateSdp(sdp) {
  const errors = []

  if (!sdp.includes('\r\n')) errors.push('SDP must use CRLF (\\r\\n) line endings')
  if (!sdp.includes('a=ptime:20')) errors.push('ptime:20 is mandatory')
  if (!sdp.match(/a=rtpmap:111 opus\/48000\/2/)) errors.push('Opus 48000 Hz is required')
  if (sdp.match(/a=rtpmap:\d+ telephone-event\/(?!8000)/)) {
    errors.push('DTMF telephone-event must use clock rate 8000 Hz only')
  }

  // Check single SSRC
  const ssrcs = [...sdp.matchAll(/a=ssrc:(\d+) cname/g)].map(m => m[1])
  if (ssrcs.length > 1) errors.push('Multiple SSRCs detected — use single SSRC only')

  // Check DTLS setup role in answer
  if (sdp.includes('a=setup:passive')) {
    errors.push('Your side must be setup:active (DTLS client) in SDP answers')
  }

  return { valid: errors.length === 0, errors }
}

// ── Bandwidth estimates ───────────────────────────────────────────────────────
export const BANDWIDTH = {
  opus:  { codec: 40, overhead: 20, total: 60,  mbPerMin: 3.75 },
  g711:  { codec: 64, overhead: 20, total: 84,  mbPerMin: 4.9  },
  /** Estimate concurrent calls for given bandwidth in Mbps */
  concurrentCalls(mbps, codec = 'opus') {
    return Math.floor((mbps * 1000) / BANDWIDTH[codec].total)
  },
}

// ── Express router ────────────────────────────────────────────────────────────
import { Router } from 'express'
export const sdpRouter = Router()

sdpRouter.post('/offer', (req, res) => {
  try {
    const sdp = generateSdpOffer(req.body)
    res.json({ sdp, validation: validateSdp(sdp) })
  } catch (e) {
    res.status(400).json({ error: e.message })
  }
})

sdpRouter.post('/answer', (req, res) => {
  try {
    const { offerSdp, ...opts } = req.body
    const sdp = generateSdpAnswer(offerSdp, opts)
    res.json({ sdp, validation: validateSdp(sdp) })
  } catch (e) {
    res.status(400).json({ error: e.message })
  }
})

sdpRouter.post('/validate', (req, res) => {
  res.json(validateSdp(req.body.sdp || ''))
})

sdpRouter.post('/parse', (req, res) => {
  res.json(parseSdp(req.body.sdp || ''))
})

sdpRouter.get('/bandwidth', (req, res) => {
  const { mbps = 10, codec = 'opus' } = req.query
  res.json({
    ...BANDWIDTH[codec] || BANDWIDTH.opus,
    inputMbps:       Number(mbps),
    concurrentCalls: BANDWIDTH.concurrentCalls(Number(mbps), codec),
  })
})
