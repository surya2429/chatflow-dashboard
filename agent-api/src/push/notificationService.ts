import { logger } from '../config/logger.js'
import { deviceRepository, type DeviceTarget } from '../db/repositories/deviceRepository.js'
import { apnsProvider } from './apns.js'
import { fcmProvider } from './fcm.js'
import type { PushPayload, PushProvider } from './types.js'
import { categoryOf, withDefaults } from './preferences.js'

/**
 * Who gets woken up, and on which token.
 *
 * Presence is the gate. An agent who set themselves offline is off shift and
 * gets nothing, however urgent — that is what the toggle is for. Online and
 * away agents both get pushes: "away" means "don't route new chats to me",
 * not "don't tell me my customer replied".
 *
 * Push is fire-and-forget from the caller's view and is only ever called
 * after the database change has committed, so a notification can never
 * announce something that then rolled back.
 */

export interface SentPush {
  userId: string
  deviceId: string
  platform: 'ios' | 'android'
  provider: string
  voip: boolean
  payload: PushPayload
  result: string
}

// When no provider credentials are configured (local dev, CI) pushes are
// recorded here and logged rather than sent; scripts/verify.ts inspects it.
const recent: SentPush[] = []
export function recentPushes(): readonly SentPush[] { return recent }
function remember(p: SentPush) {
  recent.push(p)
  if (recent.length > 200) recent.shift()
}

function route(device: DeviceTarget, payload: PushPayload): { provider: PushProvider; token: string; voip: boolean } | null {
  if (device.platform === 'ios') {
    // Calls go to PushKit when we have it; iOS will kill an app that receives
    // a VoIP push and doesn't raise CallKit, so cancellations don't use it.
    if (payload.kind === 'call' && device.voip_token) return { provider: apnsProvider, token: device.voip_token, voip: true }
    return device.push_token ? { provider: apnsProvider, token: device.push_token, voip: false } : null
  }
  return device.push_token ? { provider: fcmProvider, token: device.push_token, voip: false } : null
}

export async function notifyUsers(userIds: string[], payload: PushPayload): Promise<void> {
  const unique = [...new Set(userIds)]
  if (!unique.length) return
  let devices: DeviceTarget[]
  try {
    devices = await deviceRepository.targetsForUsers(unique)
  } catch (err) {
    logger.error({ err }, '[push] could not load devices')
    return
  }
  // Cancelling a ring must reach every device that rang, even if the agent
  // flipped to offline mid-ring; everything else respects presence, the
  // phone's own on/off switch, and the person's chosen categories.
  const category = categoryOf(payload.kind)
  const eligible = category === null ? devices : devices.filter(d =>
    d.presence !== 'offline' && d.push_enabled && withDefaults(d.notify_prefs)[category])

  await Promise.all(eligible.map(async (device) => {
    const target = route(device, payload)
    if (!target) return
    const base = { userId: device.user_id, deviceId: device.device_id, platform: device.platform, provider: target.provider.name, voip: target.voip, payload }
    if (!target.provider.configured) {
      remember({ ...base, result: 'logged' })
      logger.info({ to: device.user_id, platform: device.platform, voip: target.voip, kind: payload.kind, title: payload.title }, '[push] (provider not configured) would send')
      return
    }
    const result = await target.provider.send(target.token, payload, { voip: target.voip })
    remember({ ...base, result: result.ok ? 'sent' : `failed:${result.error}` })
    if (result.deadToken) {
      logger.info({ deviceId: device.device_id }, '[push] provider reports dead token — disabling')
      await deviceRepository.disableToken(target.token).catch(() => {})
    } else if (!result.ok) {
      logger.warn({ deviceId: device.device_id, error: result.error }, '[push] send failed')
    }
  }))
}

/** Detached variant for request handlers: never delays or fails the response. */
export function notifyUsersLater(userIds: string[], payload: PushPayload): void {
  void notifyUsers(userIds, payload).catch((err) => logger.error({ err }, '[push] dispatch failed'))
}
