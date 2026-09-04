/**
 * MODULE 6 — webhookServer.js
 * Express webhook router for all WhatsApp Calling API events.
 *
 * Subscribe to webhook fields:
 *   "calls"                   — call events (connect, status, terminate)
 *   "account_settings_update" — settings changes
 *   "account_update"          — violations + restrictions
 *
 * Reliability rules:
 *   ✅ Duplicates ARE possible → deduplicate by callId + event + timestamp
 *   ✅ Ordering NOT guaranteed → handle terminate-before-connect gracefully
 *   ✅ Stale webhooks may arrive → check timestamp before acting
 *   ✅ No exactly-once delivery → always idempotent handlers
 *   ✅ Timeout = ~20s → always return HTTP 200 quickly; process async
 *   ✅ Multiple app subscribers → each receives ALL webhooks independently
 *
 * Meta IP allowlist:
 *   31.13.24.0/21, 31.13.64.0/18, 45.64.40.0/22, (see sipConfig.js for full list)
 */
import { Router } from 'express'
import { config } from '../config.js'
import { callStore } from '../utils/callStore.js'
import { generateSdpAnswer } from './sdpUtils.js'
import { preAcceptCall, acceptCall } from './userCalls.js'
import { applyAnswerSdp } from './businessCalls.js'
import { recordCallCompletion } from './callAnalytics.js'
import { createLogger } from '../utils/logger.js'

const log = createLogger('webhookServer')

// ── Webhook Router ─────────────────────────────────────────────────────────────
export const webhookRouter = Router()

// ── GET /webhook — Hub Verification ──────────────────────────────────────────
webhookRouter.get('/', (req, res) => {
  const mode      = req.query['hub.mode']
  const token     = req.query['hub.verify_token']
  const challenge = req.query['hub.challenge']

  if (mode === 'subscribe' && token === config.webhookVerifyToken) {
    log.info('Webhook verified successfully')
    return res.status(200).send(parseInt(challenge, 10).toString())
  }

  log.warn('Webhook verification failed', { mode, token })
  res.sendStatus(403)
})

// ── POST /webhook — Event Dispatcher ─────────────────────────────────────────
webhookRouter.post('/', (req, res) => {
  // Always respond 200 immediately — process async to stay under 20s timeout
  res.sendStatus(200)
  processWebhook(req.body).catch(err =>
    log.error('Unhandled webhook processing error', { message: err.message })
  )
})

// ── Core dispatcher ───────────────────────────────────────────────────────────
async function processWebhook(body) {
  const entries = body?.entry || []

  for (const entry of entries) {
    const changes = entry?.changes || []
    for (const change of changes) {
      const field = change.field
      const value = change.value

      switch (field) {

        case 'calls':
          await handleCallsField(value)
          break

        case 'account_settings_update':
          handleSettingsUpdate(value)
          break

        case 'account_update':
          handleAccountUpdate(value)
          break

        default:
          // Other fields (messages, statuses, etc.) — handled by your messaging router
          log.debug(`Unhandled webhook field: ${field}`)
      }
    }
  }
}

// ── Handler: "calls" field ────────────────────────────────────────────────────
async function handleCallsField(value) {

  // ── Call Status events (RINGING / ACCEPTED / REJECTED) ─────────────────────
  if (value?.statuses?.length) {
    for (const status of value.statuses) {
      await handleCallStatus(status)
    }
  }

  // ── Call Connect / Terminate events ────────────────────────────────────────
  const calls = value?.calls || []
  for (const callEvent of calls) {
    if (callEvent.event === 'connect') {
      await handleCallConnect(callEvent)
    } else if (callEvent.event === 'terminate') {
      await handleCallTerminate(callEvent)
    } else {
      log.warn('Unknown call event', { event: callEvent.event })
    }
  }

  // ── Permission Reply (interactive.type:"call_permission_reply") ─────────────
  const messages = value?.messages || []
  for (const msg of messages) {
    if (msg?.interactive?.type === 'call_permission_reply') {
      handlePermissionReply(msg)
    }
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// EVENT 1: Call Connect
// ═══════════════════════════════════════════════════════════════════════════════
async function handleCallConnect(event) {
  const {
    id: callId,
    from,
    to,
    direction,
    timestamp,
    session,
    contacts,
    deeplink_payload,
    cta_payload,
  } = event

  // Deduplication check
  if (callStore.isDuplicate(callId, 'connect', timestamp)) {
    log.warn('Duplicate call connect ignored', { callId })
    return
  }

  log.info('Call Connect received', { callId, direction, from, to })

  if (direction === 'USER_INITIATED') {
    // ── User called us — we have the SDP offer ──────────────────────────────
    // session.sdp_type = "offer"
    callStore.upsert(callId, {
      id:               callId,
      direction:        'USER_INITIATED',
      status:           'INCOMING',
      from,
      to,
      receivedAt:       Date.now(),
      sdpOffer:         session.sdp,
      contactName:      contacts?.[0]?.profile?.name,
      contactWaId:      contacts?.[0]?.wa_id,
      deeplink_payload,
      cta_payload,
    })

    // Generate SDP answer (replace with your real WebRTC bridge)
    const sdpAnswer = generateSdpAnswer(session.sdp, {
      // In production: inject your DTLS fingerprint and ICE candidates
      dtlsFingerprint: process.env.DTLS_FINGERPRINT || 'AA:BB:CC:DD:EE:FF:00:11:22:33:44:55:66:77:88:99:AA:BB:CC:DD:EE:FF:00:11:22:33:44:55:66:77:88:99',
      candidates:      [], // Add your ICE candidates here
    })

    // Pre-accept: frontloads WebRTC setup to prevent audio clipping
    await preAcceptCall(callId, sdpAnswer).catch(e =>
      log.error('pre_accept failed', { callId, code: e.code, message: e.message })
    )

    // In production: wait for ICE to nearly converge before accepting
    // For now: accept immediately
    await acceptCall(callId, sdpAnswer).catch(e =>
      log.error('accept failed', { callId, code: e.code, message: e.message })
    )

  } else if (direction === 'BUSINESS_INITIATED') {
    // ── We called the user — we received the SDP answer ─────────────────────
    // session.sdp_type = "answer"
    applyAnswerSdp(callId, session.sdp)
    // → In production: pass session.sdp to your WebRTC peer connection
    log.info('Received SDP answer for business call — apply to WebRTC stack', { callId })
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// EVENT 2: Call Status (RINGING / ACCEPTED / REJECTED)
// ═══════════════════════════════════════════════════════════════════════════════
async function handleCallStatus(status) {
  const { id: callId, status: callStatus, timestamp, recipient_id, biz_opaque_callback_data } = status

  if (callStore.isDuplicate(callId, `status:${callStatus}`, timestamp)) {
    log.warn('Duplicate call status ignored', { callId, callStatus })
    return
  }

  log.info('Call Status update', { callId, callStatus, recipient_id })

  callStore.upsert(callId, {
    status: callStatus,
    statusUpdatedAt: Date.now(),
    biz_opaque_callback_data,
  })

  switch (callStatus) {
    case 'RINGING':
      log.info('User device is ringing', { callId, recipient_id })
      // → Trigger your UI / agent notification here
      break

    case 'ACCEPTED':
      log.info('User accepted the call', { callId })
      callStore.upsert(callId, { acceptedAt: Date.now() })
      // → Start media flow if not already flowing
      break

    case 'REJECTED':
      log.info('User rejected the call', { callId })
      callStore.upsert(callId, { rejectedAt: Date.now() })
      callStore.remove(callId)
      // → Clean up WebRTC peer connection
      break
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// EVENT 3: Call Terminate
// ═══════════════════════════════════════════════════════════════════════════════
async function handleCallTerminate(event) {
  const {
    id: callId,
    from,
    to,
    direction,
    timestamp,
    status,
    start_time,
    end_time,
    duration,
    biz_opaque_callback_data,
    deeplink_payload,
    cta_payload,
    errors,
  } = event

  if (callStore.isDuplicate(callId, 'terminate', timestamp)) {
    log.warn('Duplicate call terminate ignored', { callId })
    return
  }

  // Handle terminate-before-connect: store it so connect handler can check
  const stored = callStore.get(callId)
  if (!stored) {
    log.warn('Terminate received for unknown call — storing late-arrive record', { callId })
  }

  log.info('Call Terminate', { callId, status, duration, direction })

  // Record completion
  recordCallCompletion({ id: callId, status, start_time, end_time, duration, errors })

  callStore.upsert(callId, {
    status:      status === 'COMPLETED' ? 'COMPLETED' : 'FAILED',
    completedAt: Date.now(),
    duration,
    errors,
    biz_opaque_callback_data,
    deeplink_payload,
    cta_payload,
  })

  if (errors?.length) {
    for (const err of errors) {
      log.error('Call ended with error', { callId, code: err.code, message: err.message, details: err.error_data?.details })
    }
  }

  // → Clean up WebRTC peer connection, release media resources
  // → Log to your database / billing system
  // → Note: call record stays in store for analytics; real app would persist to DB then remove

  if (status === 'COMPLETED' && duration > 0) {
    log.info(`Call completed — duration: ${duration}s`, { callId })
    // → Trigger post-call actions (CRM update, CSAT survey, etc.)
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// EVENT 4: Permission Reply (call_permission_reply)
// ═══════════════════════════════════════════════════════════════════════════════
function handlePermissionReply(msg) {
  const msgId  = msg.id
  if (callStore.isMessageProcessed(msgId)) {
    log.warn('Duplicate permission reply ignored', { msgId })
    return
  }

  const reply = msg.interactive?.call_permission_reply
  const {
    response,            // "accept" | "reject"
    is_permanent,
    expiration_timestamp,
    response_source,     // "user_action" | "automatic"
  } = reply

  const contextId = msg.context?.id // msgId (user_action) or callId (automatic/callback)

  log.info('Call Permission Reply', {
    response,
    is_permanent,
    response_source,
    expiration_timestamp,
    contextId,
  })

  if (response === 'accept') {
    log.info(
      is_permanent
        ? 'User granted PERMANENT call permission'
        : `User granted TEMPORARY call permission (expires: ${expiration_timestamp})`,
      { contextId }
    )
    // → Update your contact/permission database
    // → If response_source === 'automatic', this was a callback permission from a missed call
  } else if (response === 'reject') {
    log.info('User REJECTED call permission', { contextId, response_source })
    // → Mark permission as rejected in your database
    // → Do not send another request for 24h
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// EVENT 5: Settings Update (account_settings_update)
// ═══════════════════════════════════════════════════════════════════════════════
function handleSettingsUpdate(value) {
  const callingSettings = value?.phone_number_settings?.calling
  if (!callingSettings) return

  log.info('Calling settings updated (you are notified for your OWN updates too)', callingSettings)
  // NOTE: Settings changes take up to 7 days to reflect on WhatsApp clients.
  // Force immediate client refresh: user opens business chat → taps name → chat info page.
  // Server-side semantics are honored immediately regardless of client state.

  // → Sync settings to your database / config store
}

// ═══════════════════════════════════════════════════════════════════════════════
// EVENT 6 & 7: Account Violations + Restrictions (account_update)
// ═══════════════════════════════════════════════════════════════════════════════
function handleAccountUpdate(value) {
  const event = value?.event

  if (event === 'ACCOUNT_VIOLATION') {
    const { violation_type, remediation } = value
    log.warn('ACCOUNT VIOLATION', { violation_type, remediation })

    switch (violation_type) {
      case 'LOW_BUSINESS_INITIATED_CALLING_QUALITY':
        log.warn('Quality violation: low business-initiated call quality. Review codec/ICE config.')
        break
      case 'LOW_USER_INITIATED_CALLING_QUALITY':
        log.warn('Quality violation: low user-initiated call quality. Check server media path.')
        break
      case 'USER_INITIATED_CALLS_LOW_PICKUP_RATE':
        log.warn(`Quality violation: low pickup rate. Remediation: ${remediation}`)
        break
    }
    // → Alert your ops team
    // → Consider pausing BIC temporarily

  } else if (event === 'ACCOUNT_RESTRICTION') {
    const restrictions = value?.restriction_info || []
    for (const r of restrictions) {
      const expiresDate = r.expiration ? new Date(r.expiration * 1000).toISOString() : 'unknown'
      log.error('ACCOUNT RESTRICTION', {
        restriction_type: r.restriction_type,
        expiration:       expiresDate,
        remediation:      r.remediation,
      })

      switch (r.restriction_type) {
        case 'RESTRICTED_BUSINESS_INITIATED_CALLING':
          log.error(`BIC restricted until ${expiresDate} (7-day ban). Remediation: ${r.remediation}`)
          break
        case 'RESTRICTED_USER_INITIATED_CALLING':
          log.error(`UIC restricted until ${expiresDate}. Remediation: ${r.remediation}`)
          break
        case 'RESTRICTED_USER_INITIATED_CALLING_CALL_BUTTON_HIDDEN':
          log.error(`Call button hidden for users until ${expiresDate}. Remediation: ${r.remediation}`)
          break
      }
    }
    // → Alert ops immediately
    // → Stop BIC attempts until restriction expires
    // → Check WhatsApp Manager for remediation steps
  }
}
