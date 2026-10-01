import { query } from '../db/pool.js'
import type { PushKind } from './types.js'

/**
 * Which pushes a person wants. Stored per user (they follow you to every
 * phone); the on/off switch for a particular phone lives on its device row.
 * A missing key means on, so a category added later defaults to on.
 */
export const CATEGORIES = ['assignments', 'messages', 'waiting', 'calls'] as const
export type Category = typeof CATEGORIES[number]
export type NotifyPrefs = Record<Category, boolean>

/** The category a push belongs to. Call cancellations always go out — they stop a phone that is already ringing. */
export function categoryOf(kind: PushKind): Category | null {
  switch (kind) {
    case 'assignment': return 'assignments'
    case 'message': return 'messages'
    case 'waiting': return 'waiting'
    case 'call': return 'calls'
    case 'call_cancelled': return null
  }
}

export function withDefaults(stored: Partial<Record<string, unknown>> | null | undefined): NotifyPrefs {
  const out = {} as NotifyPrefs
  for (const c of CATEGORIES) out[c] = stored?.[c] !== false
  return out
}

export async function getNotificationSettings(userId: string, deviceId?: string) {
  const [user] = await query<{ notify_prefs: Record<string, unknown> }>(`SELECT notify_prefs FROM users WHERE id = $1`, [userId])
  const device = deviceId
    ? (await query<{ push_enabled: boolean; has_token: boolean }>(
        `SELECT push_enabled, (push_token IS NOT NULL OR voip_token IS NOT NULL) AND disabled_at IS NULL AS has_token
         FROM devices WHERE device_id = $1 AND user_id = $2`, [deviceId, userId]))[0]
    : undefined
  return {
    categories: withDefaults(user?.notify_prefs),
    // null: this installation hasn't registered for push (web, simulator, permission never granted).
    device: device ? { pushEnabled: device.push_enabled, registered: device.has_token } : null,
  }
}

export async function updateNotificationSettings(userId: string, input: { categories?: Partial<NotifyPrefs>; deviceId?: string; pushEnabled?: boolean }) {
  if (input.categories && Object.keys(input.categories).length) {
    await query(`UPDATE users SET notify_prefs = notify_prefs || $2::jsonb WHERE id = $1`, [userId, JSON.stringify(input.categories)])
  }
  if (input.deviceId && input.pushEnabled !== undefined) {
    // Only a device registered to this user can be switched — never someone else's.
    await query(`UPDATE devices SET push_enabled = $3 WHERE device_id = $1 AND user_id = $2`, [input.deviceId, userId, input.pushEnabled])
  }
  return getNotificationSettings(userId, input.deviceId)
}
