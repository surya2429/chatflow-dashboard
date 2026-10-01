import { query } from '../pool.js'
import type { Presence } from './userRepository.js'

export interface DeviceRow {
  id: string
  user_id: string
  device_id: string
  platform: 'ios' | 'android'
  push_token: string | null
  voip_token: string | null
  app_version: string | null
  disabled_at: Date | null
  push_enabled: boolean
}

export interface DeviceTarget extends DeviceRow {
  presence: Presence
  notify_prefs: Record<string, unknown>
}

export const deviceRepository = {
  /**
   * Registers (or re-registers) an installation. `device_id` is unique, so a
   * phone that changes hands — logout, log in as a colleague — moves its row
   * to the new user instead of pushing the previous user's chats to it.
   */
  async upsert(d: { userId: string; deviceId: string; platform: 'ios' | 'android'; pushToken?: string | null; voipToken?: string | null; appVersion?: string | null }): Promise<DeviceRow> {
    const rows = await query<DeviceRow>(
      `INSERT INTO devices (user_id, device_id, platform, push_token, voip_token, app_version)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (device_id) DO UPDATE SET
         user_id = EXCLUDED.user_id, platform = EXCLUDED.platform,
         push_token = COALESCE(EXCLUDED.push_token, devices.push_token),
         voip_token = COALESCE(EXCLUDED.voip_token, devices.voip_token),
         app_version = EXCLUDED.app_version, disabled_at = NULL,
         -- A phone handed to someone else starts unmuted for them.
         push_enabled = CASE WHEN devices.user_id = EXCLUDED.user_id THEN devices.push_enabled ELSE true END
       RETURNING *`,
      [d.userId, d.deviceId, d.platform, d.pushToken ?? null, d.voipToken ?? null, d.appVersion ?? null],
    )
    return rows[0]!
  },

  /** Logout: this phone must stop receiving this user's notifications immediately. */
  async removeForUserDevice(userId: string, deviceId: string): Promise<void> {
    await query(`DELETE FROM devices WHERE user_id = $1 AND device_id = $2`, [userId, deviceId])
  },

  async removeAllForUser(userId: string): Promise<void> {
    await query(`DELETE FROM devices WHERE user_id = $1`, [userId])
  },

  /** Live devices for these users, with each owner's presence for the dispatch rules. */
  async targetsForUsers(userIds: string[]): Promise<DeviceTarget[]> {
    if (!userIds.length) return []
    return query<DeviceTarget>(
      `SELECT d.*, u.presence, u.notify_prefs FROM devices d JOIN users u ON u.id = d.user_id
       WHERE d.user_id = ANY($1::uuid[]) AND d.disabled_at IS NULL AND u.is_active`,
      [userIds],
    )
  },

  /**
   * The provider said this token is dead. Only that token is dropped — an iOS
   * device's regular token can expire while its VoIP token still works — and
   * the device is disabled once it has neither.
   */
  async disableToken(token: string): Promise<void> {
    await query(
      `UPDATE devices SET
         push_token = CASE WHEN push_token = $1 THEN NULL ELSE push_token END,
         voip_token = CASE WHEN voip_token = $1 THEN NULL ELSE voip_token END,
         disabled_at = CASE WHEN (push_token = $1 OR push_token IS NULL) AND (voip_token = $1 OR voip_token IS NULL)
                            THEN now() ELSE disabled_at END
       WHERE push_token = $1 OR voip_token = $1`,
      [token],
    )
  },
}
