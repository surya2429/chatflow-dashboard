/**
 * MODULE 4 — userCalls.js
 * Handle user-initiated calls: pre-accept, accept, reject, terminate.
 *
 * Consumer device support: Primary + companion iPhone/Android ONLY.
 * NOT supported: WhatsApp Web, Desktop, tablet companion devices.
 * Response window: ~30–60 seconds after Call Connect webhook before auto-terminate.
 *
 * Recommended flow (with pre-accept to prevent audio clipping):
 *  1. Receive Call Connect webhook (event:"connect", sdp_type:"offer")
 *  2. preAcceptCall() — establish WebRTC BEFORE accepting
 *  3. Wait for ICE connectivity checks to nearly complete
 *  4. acceptCall() — start media ONLY after 200 OK response
 *  5. terminateCall() when done
 *
 * Audio clipping prevention (in order of preference):
 *  1. Use SDES instead of DTLS (removes ~3s DTLS handshake)
 *  2. Pre-accept API (this module's preAcceptCall)
 *  3. Play 1 second of silence before IVR audio
 *  4. Buffer SIP media until WebRTC is ready
 *  5. Delay SIP UA audio until ACK from WebRTC endpoint
 *  6. Wait for ICE state = "connected" before playing audio
 */
import api from '../utils/apiClient.js'
import { config } from '../config.js'
import { callStore } from '../utils/callStore.js'
import { createLogger } from '../utils/logger.js'

const log = createLogger('userCalls')

// ── preAcceptCall ─────────────────────────────────────────────────────────────
/**
 * POST /{PHONE_NUMBER_ID}/calls — action:"pre_accept"
 *
 * Pre-establishes the WebRTC connection BEFORE accepting the call.
 * This frontloads the DTLS handshake and ICE process, preventing audio clipping.
 *
 * Steps after calling this:
 *  - Initialize WebRTC peer connection with the provided SDP answer
 *  - Send STUN connectivity checks (you are ICE-FULL, CONTROLLING role)
 *  - Wait until ICE is nearly converged (valid candidate list formed)
 *  - THEN call acceptCall()
 *
 * @param {string} callId
 * @param {string} sdpAnswer — Your WebRTC SDP answer (CRLF line endings)
 * @returns {Promise<object>}
 */
export async function preAcceptCall(callId, sdpAnswer) {
  if (!callId)    throw new Error('callId is required')
  if (!sdpAnswer) throw new Error('sdpAnswer is required')
  if (!sdpAnswer.includes('\r\n')) {
    throw new Error('SDP answer must use CRLF (\\r\\n) line endings')
  }

  log.info('Pre-accepting user call', { callId })

  const result = await api.post(`/${config.phoneNumberId}/calls`, {
    messaging_product: 'whatsapp',
    call_id:           callId,
    action:            'pre_accept',
    session: {
      sdp_type: 'answer',
      sdp:      sdpAnswer,
    },
  })

  callStore.upsert(callId, { status: 'PRE_ACCEPTED', sdpAnswer })
  return result
}

// ── acceptCall ────────────────────────────────────────────────────────────────
/**
 * POST /{PHONE_NUMBER_ID}/calls — action:"accept"
 *
 * CRITICAL: Only start flowing media AFTER receiving 200 OK from this call.
 *   - Too early → caller misses first words
 *   - Too late → silence
 *
 * The sdpAnswer MUST match the one used in preAcceptCall (if called).
 *
 * @param {string} callId
 * @param {string} sdpAnswer — Same SDP as pre_accept (or fresh if no pre-accept)
 * @param {string} [bizOpaqueCallbackData] — tracking string max 512 chars
 * @returns {Promise<object>}
 */
export async function acceptCall(callId, sdpAnswer, bizOpaqueCallbackData) {
  if (!callId)    throw new Error('callId is required')
  if (!sdpAnswer) throw new Error('sdpAnswer is required')

  const stored = callStore.get(callId)
  if (stored?.sdpAnswer && stored.sdpAnswer !== sdpAnswer) {
    log.warn('accept SDP differs from pre_accept SDP — this may cause issues', { callId })
  }

  log.info('Accepting user call', { callId })

  const result = await api.post(`/${config.phoneNumberId}/calls`, {
    messaging_product: 'whatsapp',
    call_id:           callId,
    action:            'accept',
    session: {
      sdp_type: 'answer',
      sdp:      sdpAnswer,
    },
    ...(bizOpaqueCallbackData && { biz_opaque_callback_data: bizOpaqueCallbackData }),
  })

  // → START FLOWING MEDIA NOW (after 200 OK returned above)
  callStore.upsert(callId, { status: 'ACCEPTED', acceptedAt: Date.now() })
  log.info('User call accepted — start media', { callId })
  return result
}

// ── rejectCall ────────────────────────────────────────────────────────────────
/**
 * POST /{PHONE_NUMBER_ID}/calls — action:"reject"
 *
 * @param {string} callId
 * @returns {Promise<object>}
 */
export async function rejectCall(callId) {
  if (!callId) throw new Error('callId is required')
  log.info('Rejecting user call', { callId })

  const result = await api.post(`/${config.phoneNumberId}/calls`, {
    messaging_product: 'whatsapp',
    call_id:           callId,
    action:            'reject',
  })

  callStore.upsert(callId, { status: 'REJECTED' })
  callStore.remove(callId)
  return result
}

// ── terminateCall ─────────────────────────────────────────────────────────────
/**
 * POST /{PHONE_NUMBER_ID}/calls — action:"terminate"
 * Call after you decide to end the accepted call.
 *
 * @param {string} callId
 * @returns {Promise<object>}
 */
export async function terminateUserCall(callId) {
  if (!callId) throw new Error('callId is required')
  log.info('Terminating user call', { callId })

  const result = await api.post(`/${config.phoneNumberId}/calls`, {
    messaging_product: 'whatsapp',
    call_id:           callId,
    action:            'terminate',
  })

  callStore.upsert(callId, { status: 'TERMINATING', terminatedAt: Date.now() })
  return result
}

// ── handleIncomingCall ────────────────────────────────────────────────────────
/**
 * High-level orchestrator called by the webhook handler when a user-initiated
 * Call Connect event arrives.
 *
 * Replace the sdpAnswer generation stub with your real WebRTC/SIP bridge logic.
 *
 * @param {object} callEvent — Parsed webhook call event
 * @param {Function} generateSdpAnswer — Async fn(offerSdp) → string sdpAnswer
 * @param {object} [opts]
 * @param {boolean} [opts.autoAccept=true] — Immediately accept (false = ring your agents)
 * @param {string} [opts.bizOpaqueCallbackData]
 */
export async function handleIncomingCall(callEvent, generateSdpAnswer, opts = {}) {
  const { autoAccept = true, bizOpaqueCallbackData } = opts
  const { id: callId, from, session, contacts, deeplink_payload, cta_payload } = callEvent

  // Store call immediately
  callStore.upsert(callId, {
    id:               callId,
    direction:        'USER_INITIATED',
    status:           'INCOMING',
    from,
    to:               config.phoneNumberId,
    receivedAt:       Date.now(),
    sdpOffer:         session.sdp,
    contactName:      contacts?.[0]?.profile?.name,
    deeplink_payload,
    cta_payload,
  })

  if (!autoAccept) {
    log.info('Incoming call received — manual accept required', { callId, from })
    return { callId, status: 'PENDING_ACCEPT' }
  }

  // Step 1: Generate SDP answer from offer
  const sdpAnswer = await generateSdpAnswer(session.sdp)

  // Step 2: Pre-accept (frontloads WebRTC setup)
  await preAcceptCall(callId, sdpAnswer)

  // Step 3: In production, wait for ICE to nearly converge here
  //         For demo purposes, we accept immediately
  await acceptCall(callId, sdpAnswer, bizOpaqueCallbackData)

  return { callId, status: 'ACCEPTED' }
}

// ── Express router ────────────────────────────────────────────────────────────
import { Router } from 'express'
export const userCallsRouter = Router()

userCallsRouter.post('/:callId/pre-accept', async (req, res, next) => {
  try {
    res.json(await preAcceptCall(req.params.callId, req.body.sdpAnswer))
  } catch (e) { next(e) }
})

userCallsRouter.post('/:callId/accept', async (req, res, next) => {
  try {
    const { sdpAnswer, bizOpaqueCallbackData } = req.body
    res.json(await acceptCall(req.params.callId, sdpAnswer, bizOpaqueCallbackData))
  } catch (e) { next(e) }
})

userCallsRouter.post('/:callId/reject', async (req, res, next) => {
  try {
    res.json(await rejectCall(req.params.callId))
  } catch (e) { next(e) }
})

userCallsRouter.post('/:callId/terminate', async (req, res, next) => {
  try {
    res.json(await terminateUserCall(req.params.callId))
  } catch (e) { next(e) }
})
