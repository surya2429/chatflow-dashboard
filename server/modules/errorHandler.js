/**
 * MODULE 10 — errorHandler.js
 * Centralized error handling middleware and error code reference.
 *
 * All Graph API errors follow the shape:
 *   { error: { message, type, code, fbtrace_id } }
 */
import { createLogger } from '../utils/logger.js'

const log = createLogger('errorHandler')

// ── Error code catalogue ──────────────────────────────────────────────────────
export const CALLING_ERRORS = {
  // Standard Graph API
  100:    { desc: 'Invalid parameter / SDP validation error',           solution: 'Check SDP format, CRLF line endings, single SSRC' },
  613:    { desc: 'Get call permission API rate limit',                 solution: 'Reduce frequency; max 100 req/sec' },

  // Country / access
  131009: { desc: 'voice_call not supported in this country',           solution: 'Confirm supported countries for BIC and deep links' },
  131030: { desc: 'Recipient not in PTN allowlist (dev mode)',          solution: 'Add number to test recipient list in App Dashboard' },
  131044: { desc: 'No valid payment method on WABA',                   solution: 'Attach a payment method in WhatsApp Manager' },
  131055: { desc: 'Graph API call not allowed when SIP is enabled',    solution: 'Use SIP signaling instead; disable SIP to use Graph API' },

  // Calling setup
  138000: { desc: 'Calling not enabled on phone number',               solution: 'POST /{phoneNumberId}/settings to enable calling' },
  138001: { desc: 'Receiver uncallable (not on WA or declined ToS)',   solution: 'Confirm recipient is on latest WhatsApp version' },
  138002: { desc: 'Max concurrent calls (1,000) exceeded',             solution: 'Retry later; implement queue / back-pressure' },
  138003: { desc: 'Duplicate call already ongoing',                    solution: 'Wait for current call to terminate before retrying' },
  138004: { desc: 'Connection error while connecting',                 solution: 'Check SDP / ICE params; ensure STUN connectivity; retry' },
  138005: { desc: 'Call initiation rate limit exceeded',               solution: 'Reduce call frequency; implement rate limiter' },
  138006: { desc: 'No approved call permission for user',              solution: 'Send permission request; wait for user approval' },
  138007: { desc: 'Connect timeout — SDP answer not applied in time',  solution: 'Apply answer SDP faster; use pre-accept for user calls' },
  138009: { desc: 'Call permission request rate limit',                solution: 'Wait; a connected call resets the limit' },
  138012: { desc: '100 connected calls / 24h limit reached',           solution: 'Check limit_expiration_time in permission state; wait' },
  138013: { desc: 'Business-initiated calling not available',          solution: 'Check BIC country availability (not US/CA/EG/VN/NG)' },
  138014: { desc: 'Calling temporarily disabled (quality violation)',  solution: 'Wait for restriction to expire (7-day ban)' },
  138015: { desc: 'Calling cannot be enabled',                         solution: 'Raise daily messaging limit to ≥ 2,000 unique contacts' },
  138017: { desc: 'Permanent permission already exists',               solution: 'No need to send another permission request' },
  138018: { desc: 'Technical prerequisites not met',                   solution: 'Subscribe to "calls" webhook field OR enable SIP' },
  138019: { desc: 'WhatsApp client failed to set up call',             solution: 'Retry; check client version compatibility' },
  138020: { desc: 'Relay connection failed',                           solution: 'Retry; check STUN/TURN configuration' },
  138021: { desc: 'Media receive timeout (no media for 30s)',          solution: 'Ensure media packets are being sent to relay correctly' },
  138022: { desc: 'Media transmit timeout',                            solution: 'Check WhatsApp client connectivity; retry call' },
  138023: { desc: 'Call accepted but no media signals received',       solution: 'Retry; check WebRTC connectivity and ICE candidates' },

  // SIP-specific (not JS error codes — HTTP status from SIP stack)
  sip_400: { desc: 'SIP 400 — Invalid business phone number in From header', solution: 'Ensure From header matches configured SIP hostname' },
  sip_403: { desc: 'SIP 403 — Server mismatch / no permission / auth fail',  solution: 'Check SIP config, permissions, and digest auth' },
  sip_404: { desc: 'SIP 404 — SIP INVITE uses IP in URI instead of hostname', solution: 'Use hostname (not IP) in request URI' },
  sip_407: { desc: 'SIP 407 — Proxy Auth Required (expected)',               solution: 'Resend INVITE with Proxy-Authorization digest header' },
  sip_408: { desc: 'SIP 408 — RTP timeout (no media for too long)',          solution: 'Check media path; ensure RTP ports 10000-60000 are open' },
  sip_480: { desc: 'SIP 480 — User unreachable or did not answer',           solution: 'User unavailable; retry later' },
  sip_486: { desc: 'SIP 486 — User declined the call',                       solution: 'Respect user rejection; do not immediately retry' },
  sip_487: { desc: 'SIP 487 — Call canceled via SIP CANCEL',                 solution: 'Call was cancelled; clean up call state' },
  sip_503: { desc: 'SIP 503 — Internal server error',                        solution: 'Transient error; retry with exponential back-off' },
}

// ── lookupError ───────────────────────────────────────────────────────────────
/**
 * Look up a known error code and return a structured explanation.
 * @param {number|string} code — Graph API error code or SIP status code
 * @returns {{ code, desc, solution } | null}
 */
export function lookupError(code) {
  const entry = CALLING_ERRORS[code]
  if (!entry) return null
  return { code, ...entry }
}

// ── isRetryable ───────────────────────────────────────────────────────────────
/**
 * Returns true if the error is safe to retry (transient).
 * @param {number} code
 * @returns {boolean}
 */
export function isRetryable(code) {
  return [138002, 138004, 138005, 138019, 138020, 138021, 138022, 138023].includes(code)
}

// ── formatApiError ────────────────────────────────────────────────────────────
/**
 * Format a normalized API error for the HTTP response body.
 * @param {Error} err — Normalized error from apiClient.js
 * @returns {object}
 */
export function formatApiError(err) {
  const known = lookupError(err.code)
  return {
    error: {
      message:   err.message,
      code:      err.code,
      type:      err.type,
      fbtrace_id: err.fbtrace_id,
      retryable: isRetryable(err.code),
      ...(known && { known_error: known }),
    },
  }
}

// ── Express error middleware ──────────────────────────────────────────────────
/**
 * 4-argument Express error middleware — must come LAST in app.use() chain.
 * Catches all errors thrown from async route handlers.
 */
// eslint-disable-next-line no-unused-vars
export function globalErrorHandler(err, req, res, next) {
  const status = err.httpStatus || 500
  const body   = formatApiError(err)

  log.error(`${req.method} ${req.path} → ${status}`, {
    code:    err.code,
    message: err.message,
    fbtrace: err.fbtrace_id,
  })

  res.status(status).json(body)
}

// ── Express router (error lookup only) ───────────────────────────────────────
import { Router } from 'express'
export const errorRouter = Router()

errorRouter.get('/codes', (req, res) => {
  res.json(CALLING_ERRORS)
})

errorRouter.get('/codes/:code', (req, res) => {
  const info = lookupError(req.params.code)
  if (!info) return res.status(404).json({ error: 'Unknown error code' })
  res.json(info)
})
