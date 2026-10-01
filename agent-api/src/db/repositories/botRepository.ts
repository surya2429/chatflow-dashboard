import { query, type Db } from '../pool.js'
import { can, type Actor } from '../../auth/policy.js'
import { forbidden } from '../../http/errors.js'
import type { Channel } from './conversationRepository.js'

export interface BotRow {
  id: string
  name: string
  channel: Channel
  identity: string
  description: string
  status: 'active' | 'paused'
  color: string
}

export interface BotDto {
  id: string
  name: string
  channel: Channel
  identity: string
  description: string
  status: 'active' | 'paused'
  color: string
  stats: { open: number; unassigned: number; waiting: number; mine: number; unread: number; resolvedToday: number }
  agents: { id: string; name: string; initials: string; color: string; presence: string }[]
}

/**
 * Which bots' conversations an actor may see. `null` means every bot —
 * supervisors and admins oversee the whole workspace. An agent sees only the
 * bots they're assigned to; this is enforced on every read and write, not
 * just used to filter the list.
 */
export async function visibleBotIds(actor: Pick<Actor, 'id' | 'role'>, db?: Db): Promise<string[] | null> {
  if (can(actor, 'conversation.override_owner')) return null
  const rows = await query<{ bot_id: string }>(`SELECT bot_id FROM bot_agents WHERE user_id = $1`, [actor.id], db)
  return rows.map(r => r.bot_id)
}

export async function assertBotVisible(actor: Pick<Actor, 'id' | 'role'>, botId: string | null, db?: Db): Promise<void> {
  if (!botId) return
  const scope = await visibleBotIds(actor, db)
  if (scope && !scope.includes(botId)) throw forbidden('not_your_bot', "This conversation belongs to a bot you're not assigned to")
}

export const botRepository = {
  /** Bots the actor can see, with live counts for the home screen. */
  async listForActor(actor: Pick<Actor, 'id' | 'role'>): Promise<BotDto[]> {
    const scope = await visibleBotIds(actor)
    const bots = await query<BotRow & BotDto['stats']>(
      `SELECT b.*,
         count(c.id) FILTER (WHERE c.status IN ('bot','agent') AND NOT c.archived)::int              AS open,
         count(c.id) FILTER (WHERE c.agent_id IS NULL AND c.status <> 'resolved' AND NOT c.archived)::int AS unassigned,
         count(c.id) FILTER (WHERE c.needs_agent_since IS NOT NULL)::int                              AS waiting,
         count(c.id) FILTER (WHERE c.agent_id = $1 AND c.status = 'agent')::int                       AS mine,
         count(c.id) FILTER (WHERE c.unread > 0 AND NOT c.archived)::int                              AS unread,
         count(c.id) FILTER (WHERE c.resolved_at >= date_trunc('day', now()))::int                    AS "resolvedToday"
       FROM bots b
       LEFT JOIN conversations c ON c.bot_id = b.id
       WHERE ($2::uuid[] IS NULL OR b.id = ANY($2::uuid[]))
       GROUP BY b.id
       ORDER BY b.status, b.name`,
      [actor.id, scope],
    )
    const agents = await query<{ bot_id: string; id: string; name: string; initials: string; color: string; presence: string }>(
      `SELECT ba.bot_id, u.id, u.name, u.initials, u.color, u.presence
       FROM bot_agents ba JOIN users u ON u.id = ba.user_id
       WHERE u.is_active AND ($1::uuid[] IS NULL OR ba.bot_id = ANY($1::uuid[]))
       ORDER BY u.name`,
      [scope],
    )
    return bots.map(b => ({
      id: b.id, name: b.name, channel: b.channel, identity: b.identity, description: b.description, status: b.status, color: b.color,
      stats: { open: b.open, unassigned: b.unassigned, waiting: b.waiting, mine: b.mine, unread: b.unread, resolvedToday: b.resolvedToday },
      agents: agents.filter(a => a.bot_id === b.id).map(({ bot_id: _b, ...a }) => a),
    }))
  },

  /** The bot a new conversation lands on when the caller didn't say: the first active bot of the channel. */
  async defaultForChannel(channel: Channel, db?: Db): Promise<string | null> {
    const rows = await query<{ id: string }>(
      `SELECT id FROM bots WHERE channel = $1 ORDER BY status, created_at LIMIT 1`, [channel], db)
    return rows[0]?.id ?? null
  },

  async agentIds(botId: string, db?: Db): Promise<string[]> {
    const rows = await query<{ user_id: string }>(`SELECT user_id FROM bot_agents WHERE bot_id = $1`, [botId], db)
    return rows.map(r => r.user_id)
  },

  async isAssigned(botId: string, userId: string, db?: Db): Promise<boolean> {
    const rows = await query(`SELECT 1 FROM bot_agents WHERE bot_id = $1 AND user_id = $2`, [botId, userId], db)
    return rows.length > 0
  },
}
