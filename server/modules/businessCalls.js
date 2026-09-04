/**
 * MODULE 3 — businessCalls.js
 * Business-initiated calls: initiate, pre-accept, accept, terminate.
 *
 * NOT available for business numbers in: USA, Canada, Egypt, Vietnam, Nigeria
 * Requires user permission (temporary or permanent) before calling.
 * Rate limit: 10,000 new call initiations / 24h / business phone number
 *
 * Flow:
 *  1. Check permission via callPermissions.canCall()
 *  2. initiateCall() — POST /calls with action:"connect" + SDP offer
 *  3. Wait for Call Connect webhook (event:"connect", sdp_type:"answer")
 *  4. Apply answer SDP to WebRTC stack
 *  5. Watch status webhooks: RINGING → ACCEPTED | REJECTED
 *  6. terminateCall() when done
 */
import api from '../utils/apiClient.js'
import { config } from '../config.js'
import { callStore } from '../utils/callStore.js'
import { canCall } from './callPermissions.js'
import { createLogger } from '../utils/logger.js'

const log = createLogger('businessCalls')

// ── initiateCall ──────────────────────────────────────────────────────────────
/**
 * POST /{PHONE_NUMBER_ID}/calls — action:"connect"
 * Initiates a business-to-user WhatsApp call.
 *
 * @param {string} toPhone — E.164 without '+' (e.g. "919876543210")
 * @param {string} sdpOffer — RFC 8866 SDP offer (CRLF line endings)
 * @param {string} [bizOpaqueCallbackData] — tracking string max 512 chars
 * @returns {Promise<{ callId: string }>}
 */
export async function initiateCall(toPhone, sdpOffer, bizOpaqueCallbackData) {
  if (!toPhone)   throw new Error('toPhone is required')
  if (!sdpOffer)  throw new Error('sdpOffer is required')

  // Guard: SDP must use CRLF
  if (!sdpOffer.includes('\r\n')) {
    throw new Error('SDP must use CRLF (\\r\\n) line endings — see RFC 8866')
  }

  // Guard: check user permission before making the API call
  const permitted = await canCall(toPhone)
  if (!permitted) {
    throw Object.assign(
      new Error('User has not granted call permission'),
      { code: 138006 }
    )
  }

  const payload = {
    messaging_product: 'whatsapp',
    to:                toPhone,
    action:            'connect',
    session: {
      sdp_type: 'offer',
      sdp:      sdpOffer,
    },
    ...(bizOpaqueCallbackData && { biz_opaque_callback_data: bizOpaqueCallbackData }),
  }

  log.info('Initiating business call', { toPhone })
  const response = await api.post(`/${config.phoneNumberId}/calls`, payload)

  const callId = response?.calls?.[0]?.id
  if (!callId) throw new Error('No call ID returned from API')

  // Track in store
  callStore.upsert(callId, {
    id:          callId,
    direction:   'BUSINESS_INITIATED',
    status:      'CONNECTING',
    to:          toPhone,
    from:        config.phoneNumberId,
    startedAt:   Date.now(),
    sdpOffer,
    bizOpaqueCallbackData,
  })

  log.info('Business call initiated', { callId, toPhone })
  return { callId }
}

// ── terminateCall ─────────────────────────────────────────────────────────────
/**
 * POST /{PHONE_NUMBER_ID}/calls — action:"terminate"
 *
 * IMPORTANT: Always call this when you end a call, even if RTCP BYE was sent
 * through the media path. Skipping affects billing accuracy.
 * Do NOT call if the WhatsApp user already terminated (you'll receive a
 * terminate webhook with direction="USER_INITIATED").
 *
 * @param {string} callId
 * @returns {Promise<object>}
 */
export async function terminateCall(callId) {
  if (!callId) throw new Error('callId is required')
  log.info('Terminating call', { callId })

  const result = await api.post(`/${config.phoneNumberId}/calls`, {
    messaging_product: 'whatsapp',
    call_id:           callId,
    action:            'terminate',
  })

  callStore.upsert(callId, { status: 'TERMINATING', terminatedAt: Date.now() })
  return result
}

// ── applyAnswerSdp ────────────────────────────────────────────────────────────
/**
 * Called internally when the Call Connect webhook arrives with sdp_type="answer".
 * Stores the answer SDP on the call record — your WebRTC stack should apply it.
 *
 * @param {string} callId
 * @param {string} sdpAnswer
 */
export function applyAnswerSdp(callId, sdpAnswer) {
  log.info('Received SDP answer for business call', { callId })
  callStore.upsert(callId, { sdpAnswer, status: 'RINGING' })
  // → Real implementation: pass sdpAnswer to your WebRTC peer connection here
}

// ── Express router ────────────────────────────────────────────────────────────
import { Router } from 'express'
export const businessCallsRouter = Router()

businessCallsRouter.post('/initiate', async (req, res, next) => {
  try {
    const { to, sdpOffer, bizOpaqueCallbackData } = req.body
    res.json(await initiateCall(to, sdpOffer, bizOpaqueCallbackData))
  } catch (e) { next(e) }
})

businessCallsRouter.post('/:callId/terminate', async (req, res, next) => {
  try {
    res.json(await terminateCall(req.params.callId))
  } catch (e) { next(e) }
})

businessCallsRouter.get('/active', (req, res) => {
  res.json({ calls: callStore.getAll(), count: callStore.count() })
})

businessCallsRouter.get('/:callId', (req, res) => {
  const call = callStore.get(req.params.callId)
  if (!call) return res.status(404).json({ error: 'Call not found' })
  res.json(call)
})
