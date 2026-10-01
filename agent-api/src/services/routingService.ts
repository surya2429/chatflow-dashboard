import type { PoolClient } from 'pg'
import { logger } from '../config/logger.js'
import { query, withTransaction } from '../db/pool.js'
import { userRepository, toUserDto, type Presence, type UserRow } from '../db/repositories/userRepository.js'
import { recordEvent } from '../realtime/events.js'
import { notifyUsersLater } from '../push/notificationService.js'
import { appendMessage, eventMessage, inTx, load, push, reload } from './inboxService.js'
import type { Actor } from '../auth/policy.js'

/**
 * Presence-driven routing. This is what makes the online/away/offline toggle
 * real instead of decorative:
 *
 *   * When the bot hands a chat to a human, it goes to an ONLINE agent with
 *     spare capacity (fewest open chats first). Away/offline agents are
 *     never picked.
 *   * If nobody is online, the chat is queued (needs_agent_since) and every
 *     on-shift (online or away) staff member is pushed a "waiting" alert.
 *   * The moment an agent goes online, the oldest queued chats are routed to
 *     them, up to their capacity.
 */

async function assign(tx: PoolClient, conversationId: string, agent: UserRow, reason: string) {
  await tx.query(
    `UPDATE conversations SET status = 'agent', agent_id = $2, needs_agent_since = NULL, resolved_at = NULL WHERE id = $1`,
    [conversationId, agent.id],
  )
  const conv = await reload(tx, conversationId)
  await appendMessage(tx, conv, eventMessage(conv, 'assigned', `${reason} — assigned to ${agent.name}`))
  return conv
}

/** The bot asks for a human. Idempotent: a chat already with an agent is left alone. */
export function requestHuman(conversationId: string) {
  return inTx(async (tx, effects) => {
    const conv = await load(tx, conversationId)
    if (conv.status === 'agent') return { assignedTo: conv.agent_id, queued: false }

    const agent = await userRepository.pickAgentForAssignment(conv.bot_id, tx)
    if (agent) {
      const updated = await assign(tx, conversationId, agent, 'Customer asked for an agent')
      effects.push(push([agent.id], {
        kind: 'assignment', conversationId, channel: updated.channel,
        title: `New chat: ${updated.name}`, body: updated.last_message.slice(0, 180),
      }))
      return { assignedTo: agent.id, queued: false }
    }

    await tx.query(
      `UPDATE conversations SET needs_agent_since = COALESCE(needs_agent_since, now()), status = 'bot', archived = false WHERE id = $1`,
      [conversationId],
    )
    const updated = await reload(tx, conversationId)
    await appendMessage(tx, updated, eventMessage(updated, 'waiting', 'Customer asked for an agent — waiting for someone to come online'))
    // Wake the bot's own agents plus supervisors/admins — not every agent in the workspace.
    const staff = await query<{ id: string }>(
      `SELECT id FROM users WHERE is_active AND presence <> 'offline'
         AND (role <> 'agent' OR $1::uuid IS NULL OR id IN (SELECT user_id FROM bot_agents WHERE bot_id = $1))`,
      [updated.bot_id], tx)
    effects.push(push(staff.map(s => s.id), {
      kind: 'waiting', conversationId, channel: updated.channel,
      title: `${updated.name} is waiting for an agent`, body: updated.last_message.slice(0, 180),
    }))
    return { assignedTo: null, queued: true }
  })
}

/** Routes queued chats to an agent who just came online, oldest first, up to capacity. */
async function drainQueueTo(agentId: string): Promise<number> {
  let assigned = 0
  for (;;) {
    const result = await withTransaction(async (tx) => {
      const agent = await userRepository.findById(agentId, tx)
      if (!agent || agent.presence !== 'online' || !agent.is_active) return null
      const load = await tx.query<{ n: number }>(
        `SELECT count(*)::int AS n FROM conversations WHERE agent_id = $1 AND status = 'agent'`, [agentId])
      if ((load.rows[0]?.n ?? 0) >= agent.max_concurrent) return null
      // SKIP LOCKED: two agents coming online together each take different chats.
      // Only chats of bots this person works (everything, for supervisors/admins).
      const next = await tx.query<{ id: string }>(
        `SELECT id FROM conversations WHERE needs_agent_since IS NOT NULL AND status = 'bot'
           AND ($1 <> 'agent' OR bot_id IS NULL OR bot_id IN (SELECT bot_id FROM bot_agents WHERE user_id = $2))
         ORDER BY needs_agent_since LIMIT 1 FOR UPDATE SKIP LOCKED`, [agent.role, agent.id])
      const id = next.rows[0]?.id
      if (!id) return null
      const conv = await assign(tx, id, agent, 'Waiting customer')
      return { conv, agent }
    })
    if (!result) return assigned
    assigned++
    notifyUsersLater([result.agent.id], {
      kind: 'assignment', conversationId: result.conv.id, channel: result.conv.channel,
      title: `New chat: ${result.conv.name}`, body: result.conv.last_message.slice(0, 180),
    })
  }
}

export async function setPresence(actor: Actor, presence: Presence) {
  const changed = await withTransaction(async (tx) => {
    const rows = await tx.query<UserRow>(
      `UPDATE users SET presence = $2, presence_updated_at = now(),
              last_heartbeat_at = CASE WHEN $2 = 'online' THEN now() ELSE last_heartbeat_at END
       WHERE id = $1 AND presence IS DISTINCT FROM $2::agent_presence RETURNING *`,
      [actor.id, presence],
    )
    const user = rows.rows[0]
    if (user) await recordEvent(tx, { kind: 'presence.updated', user: { id: user.id, name: user.name, presence: user.presence } })
    return user ?? null
  })
  let routed = 0
  if (presence === 'online') {
    await userRepository.heartbeat(actor.id)
    routed = await drainQueueTo(actor.id).catch((err) => { logger.error({ err }, '[routing] drain failed'); return 0 })
  }
  const user = changed ?? (await userRepository.findById(actor.id))
  return { user: user ? toUserDto(user) : null, routed }
}

/** Sweeper: online agents whose app went quiet become away, so they stop receiving new chats. */
export async function demoteIdleAgents(awayAfterSeconds: number): Promise<number> {
  return withTransaction(async (tx) => {
    const rows = await tx.query<UserRow>(
      `UPDATE users SET presence = 'away', presence_updated_at = now()
       WHERE presence = 'online' AND (last_heartbeat_at IS NULL OR last_heartbeat_at < now() - make_interval(secs => $1))
       RETURNING *`,
      [awayAfterSeconds],
    )
    for (const u of rows.rows) {
      await recordEvent(tx, { kind: 'presence.updated', user: { id: u.id, name: u.name, presence: u.presence } })
    }
    return rows.rowCount ?? 0
  })
}

