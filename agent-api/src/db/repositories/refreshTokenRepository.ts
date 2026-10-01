import { randomUUID } from 'node:crypto'
import { query, withTransaction } from '../pool.js'
import { hashRefreshToken, newRefreshToken } from '../../auth/tokens.js'
import { env } from '../../config/env.js'

interface RefreshRow {
  id: string
  user_id: string
  family_id: string
  device_id: string | null
  expires_at: Date
  revoked_at: Date | null
  revoked_reason: string | null
}

export type RotateResult =
  | { ok: true; userId: string; refreshToken: string; deviceId: string | null }
  | { ok: false; reason: 'unknown' | 'expired' | 'revoked' | 'reuse_detected' }

function expiry(): Date {
  return new Date(Date.now() + env.REFRESH_TOKEN_TTL_DAYS * 86_400_000)
}

export const refreshTokenRepository = {
  /** Starts a new session family (a fresh login). */
  async issue(userId: string, deviceId: string | null, userAgent: string | null): Promise<string> {
    const token = newRefreshToken()
    await query(
      `INSERT INTO refresh_tokens (user_id, family_id, token_hash, device_id, user_agent, expires_at)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [userId, randomUUID(), hashRefreshToken(token), deviceId, userAgent, expiry()],
    )
    return token
  },

  /**
   * Exchanges a refresh token for its successor.
   *
   * The presented row is locked so two concurrent refreshes with the same
   * token (the app firing two requests that both saw a 401) can't both
   * succeed: the second sees it already revoked.
   *
   * Presenting an already-rotated token is treated as theft and kills the
   * family — with one allowance: if it was rotated in the last few seconds,
   * this is almost certainly the same app racing itself (two requests both
   * hit a 401 and both refreshed). That second attempt is refused, but the
   * family survives, so the successor the first attempt just handed out
   * keeps working. Without the grace window, that race would revoke the
   * session the app is in the middle of adopting.
   */
  async rotate(token: string): Promise<RotateResult> {
    return withTransaction(async (client) => {
      const found = await client.query<RefreshRow & { rotated_recently: boolean }>(
        `SELECT *, (revoked_reason = 'rotated' AND revoked_at > now() - interval '10 seconds') AS rotated_recently
         FROM refresh_tokens WHERE token_hash = $1 FOR UPDATE`,
        [hashRefreshToken(token)],
      )
      const row = found.rows[0]
      if (!row) return { ok: false, reason: 'unknown' }

      if (row.revoked_at) {
        if (row.revoked_reason === 'rotated' && !row.rotated_recently) {
          await client.query(
            `UPDATE refresh_tokens SET revoked_at = now(), revoked_reason = 'reuse_detected'
             WHERE family_id = $1 AND revoked_at IS NULL`,
            [row.family_id],
          )
          return { ok: false, reason: 'reuse_detected' }
        }
        return { ok: false, reason: 'revoked' }
      }
      if (row.expires_at.getTime() <= Date.now()) return { ok: false, reason: 'expired' }

      const user = await client.query<{ is_active: boolean }>(`SELECT is_active FROM users WHERE id = $1`, [row.user_id])
      if (!user.rows[0]?.is_active) return { ok: false, reason: 'revoked' }

      const next = newRefreshToken()
      const inserted = await client.query<{ id: string }>(
        `INSERT INTO refresh_tokens (user_id, family_id, token_hash, device_id, expires_at)
         VALUES ($1, $2, $3, $4, $5) RETURNING id`,
        [row.user_id, row.family_id, hashRefreshToken(next), row.device_id, expiry()],
      )
      await client.query(
        `UPDATE refresh_tokens SET revoked_at = now(), revoked_reason = 'rotated', replaced_by = $2 WHERE id = $1`,
        [row.id, inserted.rows[0]!.id],
      )
      return { ok: true, userId: row.user_id, refreshToken: next, deviceId: row.device_id }
    })
  },

  /** Logout: revokes the whole family the token belongs to. Returns its device id. */
  async revokeFamilyOf(token: string): Promise<{ userId: string; deviceId: string | null } | null> {
    const rows = await query<{ user_id: string; device_id: string | null }>(
      `WITH t AS (SELECT family_id, user_id, device_id FROM refresh_tokens WHERE token_hash = $1)
       UPDATE refresh_tokens r SET revoked_at = now(), revoked_reason = 'logout'
       FROM t WHERE r.family_id = t.family_id AND r.revoked_at IS NULL
       RETURNING t.user_id, t.device_id`,
      [hashRefreshToken(token)],
    )
    const row = rows[0]
    if (row) return { userId: row.user_id, deviceId: row.device_id }
    // Already revoked (or never existed): still report the owner if known.
    const owner = await query<{ user_id: string; device_id: string | null }>(
      `SELECT user_id, device_id FROM refresh_tokens WHERE token_hash = $1`, [hashRefreshToken(token)])
    return owner[0] ? { userId: owner[0].user_id, deviceId: owner[0].device_id } : null
  },

  async revokeAllForUser(userId: string, reason: 'admin' | 'logout'): Promise<void> {
    await query(
      `UPDATE refresh_tokens SET revoked_at = now(), revoked_reason = $2 WHERE user_id = $1 AND revoked_at IS NULL`,
      [userId, reason],
    )
  },

  async countActiveSessions(userId: string): Promise<number> {
    const rows = await query<{ n: number }>(
      `SELECT count(DISTINCT family_id)::int AS n FROM refresh_tokens
       WHERE user_id = $1 AND revoked_at IS NULL AND expires_at > now()`,
      [userId],
    )
    return rows[0]?.n ?? 0
  },

  async pruneExpired(): Promise<number> {
    const rows = await query(`DELETE FROM refresh_tokens WHERE expires_at < now() - interval '7 days' RETURNING id`)
    return rows.length
  },
}
