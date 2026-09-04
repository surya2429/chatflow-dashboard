/**
 * MODULE 1 — callSettings.js
 * Configure and retrieve WhatsApp Business Calling settings.
 *
 * Endpoint: /{PHONE_NUMBER_ID}/settings
 * Docs: https://developers.facebook.com/docs/whatsapp/cloud-api/calling
 */
import api from '../utils/apiClient.js'
import { config } from '../config.js'
import { createLogger } from '../utils/logger.js'

const log = createLogger('callSettings')

// ── enableCalling ─────────────────────────────────────────────────────────────
/**
 * POST /{PHONE_NUMBER_ID}/settings
 * Enables calling and applies all sub-settings in a single request.
 *
 * @param {object} options
 * @param {'ENABLED'|'DISABLED'} [options.status='ENABLED']
 * @param {'DEFAULT'|'DISABLE_ALL'} [options.callIconVisibility='DEFAULT']
 * @param {string[]} [options.restrictToCountries=[]] — ISO-3166 codes, empty = no restriction
 * @param {'ENABLED'|'DISABLED'} [options.callbackPermission='ENABLED']
 * @param {object} [options.callHours] — { timezone, weeklyHours[], holidaySchedule[] }
 * @param {string[]} [options.additionalCodecs=[]] — ['PCMA','PCMU'] for G.711
 * @param {object} [options.sip] — { hostname, port, requestUriUserParams }
 *   WARNING: Enabling SIP disables Graph API calling endpoints!
 * @param {'DTLS'|'SDES'} [options.srtpProtocol='DTLS']
 * @returns {Promise<{ success: boolean }>}
 */
export async function enableCalling(options = {}) {
  const {
    status             = 'ENABLED',
    callIconVisibility = 'DEFAULT',
    restrictToCountries = [],
    callbackPermission = 'ENABLED',
    callHours,
    additionalCodecs   = [],
    sip,
    srtpProtocol       = 'DTLS',
  } = options

  const calling = {
    status,
    call_icon_visibility: callIconVisibility,
    call_icons: {
      restrict_to_user_countries: restrictToCountries,
    },
    callback_permission_status: callbackPermission,
    srtp_key_exchange_protocol: srtpProtocol,
  }

  // Optional: codec override (G.711 support)
  if (additionalCodecs.length) {
    calling.audio = { additional_codecs: additionalCodecs }
  }

  // Optional: call hours schedule
  if (callHours) {
    calling.call_hours = {
      status: 'ENABLED',
      timezone_id: callHours.timezone,
      weekly_operating_hours: (callHours.weeklyHours || []).map(h => ({
        day_of_week: h.day.toUpperCase(),
        open_time:   h.openTime.replace(':', ''), // '09:00' → '0900'
        close_time:  h.closeTime.replace(':', ''),
      })),
      ...(callHours.holidaySchedule?.length && {
        holiday_schedule: callHours.holidaySchedule.map(d => ({
          date:       d.date,
          start_time: d.startTime || '0000',
          end_time:   d.endTime   || '2359',
        })),
      }),
    }
  }

  // Optional: SIP server (disables Graph API calling!)
  if (sip) {
    log.warn('Enabling SIP — Graph API calling endpoints will be DISABLED')
    calling.sip = {
      status: 'ENABLED',
      servers: [{
        hostname:                sip.hostname,
        port:                    sip.port,
        request_uri_user_params: sip.requestUriUserParams || {},
      }],
    }
  }

  log.info('Updating calling settings', { status, srtpProtocol, sipEnabled: !!sip })
  const result = await api.post(`/${config.phoneNumberId}/settings`, { calling })
  log.info('Calling settings updated', result)
  return result
}

// ── disableCalling ────────────────────────────────────────────────────────────
/** Convenience: disable calling entirely. */
export async function disableCalling() {
  return enableCalling({ status: 'DISABLED' })
}

// ── disableCallHours ──────────────────────────────────────────────────────────
/** Disable call hours (accept calls 24/7). */
export async function disableCallHours() {
  log.info('Disabling call hours restriction')
  return api.post(`/${config.phoneNumberId}/settings`, {
    calling: { call_hours: { status: 'DISABLED' } },
  })
}

// ── getCallSettings ───────────────────────────────────────────────────────────
/**
 * GET /{PHONE_NUMBER_ID}/settings
 * Retrieves the current calling configuration.
 *
 * @param {boolean} [includeSipCredentials=false]
 *   Appends ?include_sip_credentials=true to expose Meta-generated SIP password.
 *   Requires whatsapp_business_management — Advanced access for end clients.
 * @returns {Promise<object>} Raw settings response
 */
export async function getCallSettings(includeSipCredentials = false) {
  const qs = includeSipCredentials ? '?include_sip_credentials=true' : ''
  log.info('Fetching call settings', { includeSipCredentials })
  return api.get(`/${config.phoneNumberId}/settings${qs}`)
}

// ── resetSipPassword ──────────────────────────────────────────────────────────
/**
 * Rotate the Meta-generated SIP password.
 * Flow:
 *   1. Disable SIP (clears existing credentials)
 *   2. Re-enable SIP with the same server config
 *   3. GET settings with include_sip_credentials=true → return new password
 *
 * NOTE: There is a brief window (seconds) where SIP is non-functional.
 *       Schedule during off-peak hours.
 *
 * @param {object} sipServer — { hostname, port, requestUriUserParams? }
 * @returns {Promise<{ password: string, settings: object }>}
 */
export async function resetSipPassword(sipServer) {
  if (!sipServer?.hostname) throw new Error('sipServer.hostname is required')

  log.info('Resetting SIP password — Step 1: disable SIP')
  await api.post(`/${config.phoneNumberId}/settings`, {
    calling: { sip: { status: 'DISABLED', servers: [] } },
  })

  log.info('Resetting SIP password — Step 2: re-enable SIP')
  await api.post(`/${config.phoneNumberId}/settings`, {
    calling: {
      sip: {
        status: 'ENABLED',
        servers: [{
          hostname:                sipServer.hostname,
          port:                    sipServer.port || 5061,
          request_uri_user_params: sipServer.requestUriUserParams || {},
        }],
      },
    },
  })

  log.info('Resetting SIP password — Step 3: fetch new credentials')
  const settings = await getCallSettings(true)
  const password = settings?.calling?.sip?.credentials?.password

  log.info('SIP password rotated successfully')
  return { password, settings }
}

// ── Express router ────────────────────────────────────────────────────────────
import { Router } from 'express'
export const settingsRouter = Router()

settingsRouter.get('/', async (req, res, next) => {
  try {
    const data = await getCallSettings(req.query.include_sip_credentials === 'true')
    res.json(data)
  } catch (e) { next(e) }
})

settingsRouter.put('/', async (req, res, next) => {
  try {
    const data = await enableCalling(req.body)
    res.json(data)
  } catch (e) { next(e) }
})

settingsRouter.post('/disable', async (req, res, next) => {
  try { res.json(await disableCalling()) } catch (e) { next(e) }
})

settingsRouter.post('/disable-call-hours', async (req, res, next) => {
  try { res.json(await disableCallHours()) } catch (e) { next(e) }
})

settingsRouter.post('/reset-sip-password', async (req, res, next) => {
  try {
    const result = await resetSipPassword(req.body.sipServer)
    res.json(result)
  } catch (e) { next(e) }
})
