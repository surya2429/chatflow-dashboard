/**
 * MODULE 5 — callButtons.js
 * Send call button messages, create call button templates, generate deep links.
 *
 * Calling extends/starts the 24h customer service window when:
 *  - User calls your business (even if unanswered)
 *  - User accepts a business-initiated call
 *
 * payload field requires WhatsApp client v2.25.27+
 * Deep links NOT supported on WhatsApp Desktop.
 */
import api from '../utils/apiClient.js'
import { config } from '../config.js'
import { createLogger } from '../utils/logger.js'

const log = createLogger('callButtons')

// ── sendFreeFormCallButton ────────────────────────────────────────────────────
/**
 * Send a voice_call interactive message (requires open conversation window).
 * POST /{PHONE_NUMBER_ID}/messages
 *
 * @param {string} toPhone — E.164 without '+' (e.g. "919876543210")
 * @param {string} bodyText — Message body shown above the button
 * @param {string} [displayText='Call Now'] — Button label, max 20 chars
 * @param {number} [ttlMinutes=10080] — Button TTL: 1–43200 mins (default 7 days)
 * @param {string} [payload] — Custom payload max 512 chars (returned in webhooks as cta_payload)
 * @returns {Promise<object>}
 */
export async function sendFreeFormCallButton(toPhone, bodyText, displayText = 'Call Now', ttlMinutes = 10080, payload) {
  if (!toPhone)   throw new Error('toPhone is required')
  if (!bodyText)  throw new Error('bodyText is required')
  if (displayText.length > 20) throw new Error('displayText must be ≤ 20 characters')
  if (ttlMinutes < 1 || ttlMinutes > 43200) throw new Error('ttlMinutes must be 1–43200')

  log.info('Sending free-form call button', { toPhone, displayText, ttlMinutes })

  return api.post(`/${config.phoneNumberId}/messages`, {
    messaging_product: 'whatsapp',
    recipient_type:    'individual',
    to:                toPhone,
    type:              'interactive',
    interactive: {
      type: 'voice_call',
      body: { text: bodyText },
      action: {
        name:       'voice_call',
        parameters: {
          display_text: displayText,
          ttl_minutes:  ttlMinutes,
          ...(payload !== undefined && { payload }),
        },
      },
    },
  })
}

// ── createCallButtonTemplate ──────────────────────────────────────────────────
/**
 * Create a WhatsApp template with a voice_call button.
 * POST /{WABA_ID}/message_templates
 *
 * Template TTL range: 1440–43200 minutes (can be overridden per send).
 *
 * @param {object} opts
 * @param {string} opts.name — template name (lowercase, underscores)
 * @param {'MARKETING'|'UTILITY'} [opts.category='UTILITY']
 * @param {string} [opts.language='en']
 * @param {string} opts.bodyText — message body
 * @param {string} [opts.buttonText='Call Now'] — button label
 * @param {number} [opts.ttlMinutes=10080] — default TTL for this template
 * @returns {Promise<object>}
 */
export async function createCallButtonTemplate(opts = {}) {
  const {
    name,
    category   = 'UTILITY',
    language   = 'en',
    bodyText,
    buttonText = 'Call Now',
    ttlMinutes = 10080,
  } = opts

  if (!name)     throw new Error('Template name is required')
  if (!bodyText) throw new Error('bodyText is required')
  if (ttlMinutes < 1440 || ttlMinutes > 43200) {
    throw new Error('Template ttlMinutes must be 1440–43200')
  }

  log.info('Creating call button template', { name, category })

  return api.post(`/${config.wabaId}/message_templates`, {
    name,
    language,
    category,
    components: [
      { type: 'BODY', text: bodyText },
      {
        type: 'BUTTONS',
        buttons: [{
          type:        'voice_call',
          text:        buttonText,
          ttl_minutes: ttlMinutes,
        }],
      },
    ],
  })
}

// ── sendCallButtonTemplate ────────────────────────────────────────────────────
/**
 * Send an approved voice_call template message.
 * Override ttl_minutes and payload at send time via button component parameters.
 * POST /{PHONE_NUMBER_ID}/messages
 *
 * @param {string} toPhone
 * @param {string} templateName
 * @param {string} [lang='en']
 * @param {object} [overrides={}] — { ttlMinutes?, payload? }
 * @returns {Promise<object>}
 */
export async function sendCallButtonTemplate(toPhone, templateName, lang = 'en', overrides = {}) {
  if (!toPhone)      throw new Error('toPhone is required')
  if (!templateName) throw new Error('templateName is required')

  const buttonParameters = []
  if (overrides.ttlMinutes !== undefined) {
    buttonParameters.push({ type: 'text', text: String(overrides.ttlMinutes) })
  }
  if (overrides.payload !== undefined) {
    buttonParameters.push({ type: 'text', text: overrides.payload })
  }

  const components = buttonParameters.length
    ? [{ type: 'button', sub_type: 'voice_call', index: '0', parameters: buttonParameters }]
    : []

  log.info('Sending call button template', { toPhone, templateName })

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

// ── generateCallDeepLink ──────────────────────────────────────────────────────
/**
 * Generate a wa.me/call deep link.
 * Opens WhatsApp and initiates a call to the business.
 *
 * NOT supported on WhatsApp Desktop.
 * Payload requires client v2.25.27+.
 * Returned as "deeplink_payload" in Call Connect + Terminate webhooks.
 *
 * @param {string} bizPhone — E.164 with '+' (e.g. "+919876543210")
 * @param {string} [bizPayload] — custom tracking payload max 512 chars
 * @returns {string} Deep link URL
 */
export function generateCallDeepLink(bizPhone, bizPayload) {
  const phone    = bizPhone.replace(/^\+/, '')
  const baseLink = `https://wa.me/call/${phone}`
  if (!bizPayload) return baseLink
  return `${baseLink}?biz_payload=${encodeURIComponent(bizPayload)}`
}

// ── Express router ────────────────────────────────────────────────────────────
import { Router } from 'express'
export const callButtonsRouter = Router()

callButtonsRouter.post('/send', async (req, res, next) => {
  try {
    const { to, bodyText, displayText, ttlMinutes, payload } = req.body
    res.json(await sendFreeFormCallButton(to, bodyText, displayText, ttlMinutes, payload))
  } catch (e) { next(e) }
})

callButtonsRouter.post('/templates', async (req, res, next) => {
  try {
    res.json(await createCallButtonTemplate(req.body))
  } catch (e) { next(e) }
})

callButtonsRouter.post('/templates/send', async (req, res, next) => {
  try {
    const { to, templateName, lang, overrides } = req.body
    res.json(await sendCallButtonTemplate(to, templateName, lang, overrides))
  } catch (e) { next(e) }
})

callButtonsRouter.get('/deeplink', (req, res) => {
  const { phone, payload } = req.query
  if (!phone) return res.status(400).json({ error: 'phone is required' })
  res.json({ url: generateCallDeepLink(phone, payload) })
})
