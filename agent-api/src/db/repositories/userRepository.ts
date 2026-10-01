import { query, type Db } from '../pool.js'
import type { Role } from '../../auth/policy.js'

export type Presence = 'online' | 'away' | 'offline'

export interface UserRow {
  id: string
  email: string
  password_hash: string
  name: string
  initials: string
  color: string
  role: Role
  is_active: boolean
  presence: Presence
  presence_updated_at: Date
  last_heartbeat_at: Date | null
  max_concurrent: number
}

/** What the API ever returns about a user — never the hash. */
export interface UserDto {
  id: string
  email: string
  name: string
  initials: string
  color: string
  role: Role
  presence: Presence
  presenceUpdatedAt: string
  isActive: boolean
}

export function toUserDto(u: UserRow): UserDto {
  return {
    id: u.id, email: u.email, name: u.name, initials: u.initials, color: u.color, role: u.role,
    presence: u.presence, presenceUpdatedAt: u.presence_updated_at.toISOString(), isActive: u.is_active,
  }
}

export const userRepository = {
  async findByEmail(email: string): Promise<UserRow | null> {
    const rows = await query<UserRow>(`SELECT * FROM users WHERE lower(email) = lower($1)`, [email])
    return rows[0] ?? null
  },

  async findById(id: string, db?: Db): Promise<UserRow | null> {
    const rows = await query<UserRow>(`SELECT * FROM users WHERE id = $1`, [id], db)
    return rows[0] ?? null
  },

  async listActive(): Promise<UserRow[]> {
    return query<UserRow>(`SELECT * FROM users WHERE is_active = true ORDER BY name`)
  },

  async create(u: { email: string; passwordHash: string; name: string; initials: string; color: string; role: Role }): Promise<UserRow> {
    const rows = await query<UserRow>(
      `INSERT INTO users (email, password_hash, name, initials, color, role)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [u.email, u.passwordHash, u.name, u.initials, u.color, u.role],
    )
    return rows[0]!
  },

  async update(id: string, patch: Partial<{ name: string; role: Role; is_active: boolean; color: string; max_concurrent: number }>): Promise<UserRow | null> {
    const keys = Object.keys(patch) as (keyof typeof patch)[]
    if (keys.length === 0) return this.findById(id)
    const sets = keys.map((k, i) => `${k} = $${i + 2}`).join(', ')
    const rows = await query<UserRow>(`UPDATE users SET ${sets} WHERE id = $1 RETURNING *`, [id, ...keys.map(k => patch[k])])
    return rows[0] ?? null
  },

  async setPasswordHash(id: string, hash: string): Promise<void> {
    await query(`UPDATE users SET password_hash = $2 WHERE id = $1`, [id, hash])
  },


  async heartbeat(id: string): Promise<void> {
    await query(`UPDATE users SET last_heartbeat_at = now() WHERE id = $1`, [id])
  },


  /**
   * Picks who a newly-escalated conversation goes to: an ONLINE agent with
   * spare capacity, fewest open chats first, longest-idle as the tiebreak.
   * Away and offline people are never auto-assigned — that is the point of
   * presence being real.
   */
  async pickAgentForAssignment(botId: string | null, db?: Db): Promise<UserRow | null> {
    const rows = await query<UserRow>(
      `SELECT u.* FROM users u
       LEFT JOIN LATERAL (
         SELECT count(*)::int AS open FROM conversations c WHERE c.agent_id = u.id AND c.status = 'agent'
       ) load ON true
       WHERE u.is_active AND u.presence = 'online' AND load.open < u.max_concurrent
         AND ($1::uuid IS NULL OR EXISTS (SELECT 1 FROM bot_agents ba WHERE ba.bot_id = $1 AND ba.user_id = u.id))
       ORDER BY load.open ASC, u.presence_updated_at ASC
       LIMIT 1
       FOR UPDATE OF u SKIP LOCKED`,
      [botId],
      db,
    )
    return rows[0] ?? null
  },
}
