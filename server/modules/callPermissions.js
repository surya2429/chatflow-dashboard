/**
 * MODULE 2 — callPermissions.js
 * Manage user call permissions — check state, request permission, create templates.
 *
 * Key rules:
 *  - Max 1 free-form permission request / 24h per business+user pair
 *  - Max 2 permission requests / 7 days per business+user pair
 *  - Both limits reset on any connected call (business OR user-initiated)
 *  - Permanent permission (error 138017) → skip sending new request
 *  - 4 consecutive unanswered calls → permission auto-revoked (webhook fires)
 */
import api from '../utils/apiClient.js'
import { config } from '../config.js'
import { createLogger } from '../utils/logger.js'

const log = createLogger('callPermissions')

// ── getCallPermissionState ────────────────────────────────────────────────────
/**
 * GET /{PHONE_NUMBER_ID}/call_permissions?user_wa_id={userWaId}
 * Rate limit: 100 req/sec
 *
 * @param {string} userWaId — E.164 phone number (e.g. "919876543210")
 * @returns {Promise<{
 *   permission: { status: string, expiration_time?: number },
 *   actions: Array<{
 *     action_name: string,
 *     can_perform_action: boolean,
 *     limits: Array<{ time_period, max_allowed, current_usage, limit_expiration_time? }>
 *   }>
 * }>}
 */
export async function getCallPermissionState(userWaId) {
  if (!userWaId) throw new Error('userWaId is required')
  log.info('Fetching call permission state', { userWaId })
  return api.get(`/${config.phoneNumberId}/call_permissions`, {
    params: { user_wa_id: userWaId },
  })
}

// ── canCall ───────────────────────────────────────────────────────────────────
/**
 * Convenience helper: returns true if the business can currently call this user.
 * @param {string} userWaId
 * @returns {Promise<boolean>}
 */
export async function canCall(userWaId) {
  const state = await getCallPermissionState(userWaId)
  const hasPermission = state?.permission?.status !== 'no_permission'
  const startCallAction = state?.actions?.find(a => a.action_name === 'start_call')
  return hasPermission && (startCallAction?.can_perform_action === true)
}

// ── sendFreeFormPermissionRequest ─────────────────────────────────────────────
/**
 * Send a call permission request interactive message (requires open service window).
 * POST /{PHONE_NUMBER_ID}/messages
 *
 * Limits: max 1 / 24h, max 2 / 7 days per business+user pair.
 * Error 138017 = permanent permission exists — no need to send.
 *
 * @param {string} toPhone — E.164 without '+' (e.g. "919876543210")
 * @param {string} bodyText — Optional but strongly recommended
 * @returns {Promise<object>}
 */
export async function sendFreeFormPermissionRequest(toPhone, bodyText) {
  if (!toPhone) throw new Error('toPhone is required')
  log.info('Sending free-form permission request', { toPhone })

  const payload = {
    messaging_product: 'whatsapp',
    recipient_type:    'individual',
    to:                toPhone,
    type:              'interactive',
    interactive: {
      type:   'call_permission_request',
      action: { name: 'call_permission_request' },
      ...(bodyText && { body: { text: bodyText } }),
    },
  }

  return api.post(`/${config.phoneNumberId}/messages`, payload)
}

// ── createPermissionRequestTemplate ──────────────────────────────────────────
/**
 * Create a WhatsApp message template with a call_permission_request component.
 * POST /{WABA_ID}/message_templates
 *
 * @param {object} opts
 * @param {string} opts.name — template name (lowercase, underscores)
 * @param {string} [opts.language='en']
 * @param {'MARKETING'|'UTILITY'} [opts.category='UTILITY']
 * @param {string} [opts.headerText] — optional header with {{1}} variable
 * @param {string} opts.bodyText — required body text
 * @param {string} [opts.footerText]
 * @param {object} [opts.headerExample] — example values for header variables
 * @param {object} [opts.bodyExample] — example values for body variables
 * @returns {Promise<object>}
 */
export async function createPermissionRequestTemplate(opts = {}) {
  const {
    name,
    language   = 'en',
    category   = 'UTILITY',
    headerText,
    bodyText,
    footerText,
    headerExample,
    bodyExample,
  } = opts

  if (!name)     throw new Error('Template name is required')
  if (!bodyText) throw new Error('bodyText is required')

  const components = []

  if (headerText) {
    components.push({
      type: 'HEADER',
      text: headerText,
      ...(headerExample && { example: headerExample }),
    })
  }

  components.push({
    type: 'BODY',
    text: bodyText,
    ...(bodyExample && { example: bodyExample }),
  })

  if (footerText) {
    components.push({ type: 'FOOTER', text: footerText })
  }

  // The call_permission_request component — must be last
  components.push({ type: 'call_permission_request' })

  log.info('Creating call permission request template', { name, category })
  return api.post(`/${config.wabaId}/message_templates`, {
    name, language, category, components,
  })
}

// ── sendPermissionRequestTemplate ────────────────────────────────────────────
/**
 * Send an approved call_permission_request template message.
 * POST /{PHONE_NUMBER_ID}/messages
 *
 * @param {string} toPhone
 * @param {string} templateName
 * @param {string} [lang='en']
 * @param {Array<{type: string, text: string}>} [bodyParams=[]] — template variable values
 * @returns {Promise<object>}
 */
export async function sendPermissionRequestTemplate(toPhone, templateName, lang = 'en', bodyParams = []) {
  if (!toPhone)       throw new Error('toPhone is required')
  if (!templateName)  throw new Error('templateName is required')

  log.info('Sending template permission request', { toPhone, templateName })

  const components = bodyParams.length
    ? [{ type: 'body', parameters: bodyParams }]
    : []

  return api.post(`/${config.phoneNumberId}/messages`, {
    messaging_product: 'whatsapp',
    recipient_type:    'individual',
    to:                toPhone,
    type:              'template',
    template: {
      name:       templateName,
      language:   { code: lang },
      components,
    },
  })
}

// ── safeRequestPermission ─────────────────────────────────────────────────────
/**
 * High-level helper: check current permission state and send a request only if valid.
 * Handles the common cases:
 *  - Already has permission → returns { alreadyPermitted: true }
 *  - At rate limit → returns { rateLimited: true, expiresAt: number }
 *  - OK to send → sends request, returns API response
 *
 * @param {string} userWaId
 * @param {string} bodyText
 * @returns {Promise<object>}
 */
export async function safeRequestPermission(userWaId, bodyText) {
  const state = await getCallPermissionState(userWaId)
  const { permission, actions = [] } = state

  // Already has permission — no need to send
  if (permission?.status === 'permanent' || permission?.status === 'temporary') {
    log.info('User already has call permission', { userWaId, status: permission.status })
    return { alreadyPermitted: true, permission }
  }

  const sendAction = actions.find(a => a.action_name === 'send_call_permission_request')
  if (!sendAction?.can_perform_action) {
    const limit = sendAction?.limits?.[0]
    log.warn('Cannot send permission request — rate limited', { userWaId, limit })
    return {
      rateLimited: true,
      expiresAt:   limit?.limit_expiration_time,
      limit,
    }
  }

  return sendFreeFormPermissionRequest(userWaId, bodyText)
}

// ── Express router ────────────────────────────────────────────────────────────
import { Router } from 'express'
export const permissionsRouter = Router()

permissionsRouter.get('/:userWaId', async (req, res, next) => {
  try {
    res.json(await getCallPermissionState(req.params.userWaId))
  } catch (e) { next(e) }
})

permissionsRouter.get('/:userWaId/can-call', async (req, res, next) => {
  try {
    res.json({ canCall: await canCall(req.params.userWaId) })
  } catch (e) { next(e) }
})

permissionsRouter.post('/request', async (req, res, next) => {
  try {
    const { to, bodyText, safe } = req.body
    const result = safe
      ? await safeRequestPermission(to, bodyText)
      : await sendFreeFormPermissionRequest(to, bodyText)
    res.json(result)
  } catch (e) { next(e) }
})

permissionsRouter.post('/request/template', async (req, res, next) => {
  try {
    const { to, templateName, lang, params } = req.body
    res.json(await sendPermissionRequestTemplate(to, templateName, lang, params))
  } catch (e) { next(e) }
})

permissionsRouter.post('/templates', async (req, res, next) => {
  try {
    res.json(await createPermissionRequestTemplate(req.body))
  } catch (e) { next(e) }
})
