import { query } from '../pool.js'

export interface InstagramAccount {
  id: string
  ig_user_id: string
  username: string
  access_token: string
  token_expires_at: string
  scopes: string[]
  connected_at: string
  last_refreshed_at: string | null
  disconnected_at: string | null
}

export interface UpsertInstagramAccountInput {
  igUserId: string
  username: string
  accessToken: string
  expiresInSeconds: number
  scopes: string[]
}

export const instagramAccountRepository = {
  /** Insert on first connect, or refresh token/username on reconnect — keyed by the stable ig_user_id. */
  async upsert(input: UpsertInstagramAccountInput): Promise<InstagramAccount> {
    const rows = await query<InstagramAccount>(
      `INSERT INTO instagram_accounts (ig_user_id, username, access_token, token_expires_at, scopes, disconnected_at)
       VALUES ($1, $2, $3, now() + ($4 || ' seconds')::interval, $5, NULL)
       ON CONFLICT (ig_user_id) DO UPDATE SET
         username = EXCLUDED.username,
         access_token = EXCLUDED.access_token,
         token_expires_at = EXCLUDED.token_expires_at,
         scopes = EXCLUDED.scopes,
         disconnected_at = NULL,
         connected_at = now()
       RETURNING *`,
      [input.igUserId, input.username, input.accessToken, input.expiresInSeconds, input.scopes],
    )
    const account = rows[0]
    if (!account) throw new Error('Failed to upsert Instagram account')
    return account
  },

  /** The single currently-connected account, if any — this app connects one Instagram business account at a time. */
  async findActive(): Promise<InstagramAccount | null> {
    const rows = await query<InstagramAccount>(
      `SELECT * FROM instagram_accounts WHERE disconnected_at IS NULL ORDER BY connected_at DESC LIMIT 1`,
    )
    return rows[0] ?? null
  },

  async markRefreshed(igUserId: string, accessToken: string, expiresInSeconds: number): Promise<void> {
    await query(
      `UPDATE instagram_accounts
       SET access_token = $2, token_expires_at = now() + ($3 || ' seconds')::interval, last_refreshed_at = now()
       WHERE ig_user_id = $1`,
      [igUserId, accessToken, expiresInSeconds],
    )
  },

  /** Soft-disconnect — keeps the row (and its history) rather than deleting it. */
  async disconnect(igUserId: string): Promise<void> {
    await query(`UPDATE instagram_accounts SET disconnected_at = now() WHERE ig_user_id = $1`, [igUserId])
  },
}
