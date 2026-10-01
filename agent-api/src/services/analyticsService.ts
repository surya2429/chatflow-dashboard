import { query } from '../db/pool.js'
import { authorize, can, type Actor } from '../auth/policy.js'
import { badRequest, forbidden, notFound } from '../http/errors.js'
import { userRepository } from '../db/repositories/userRepository.js'

/**
 * Agent analytics, computed from the thread itself — no separate counters to
 * drift. Definitions (all within the range, bucketed in the viewer's timezone):
 *
 *   conversations  distinct chats the agent sent at least one message in
 *   messages       the agent's outgoing messages and templates
 *   resolved       "resolved" events by the agent (older events without an
 *                  author fall back to the chat's assignee)
 *   replySec       median gap between a customer message and the agent's
 *                  answer to it — the median, so one overnight wait doesn't
 *                  swamp a day of quick replies
 *   avgHandleSec   from the agent's first message in a chat to its resolution
 *   resolutionRate resolved ÷ conversations
 */
export type RangeKey = 'today' | '7d' | '30d' | 'custom'
const DAYS: Record<Exclude<RangeKey, 'custom'>, number> = { today: 1, '7d': 7, '30d': 30 }
/** Longest custom range — a quarter keeps the daily chart readable and the queries cheap. */
export const MAX_CUSTOM_DAYS = 90

export interface Kpis {
  conversations: number
  messages: number
  resolved: number
  replySec: number | null
  avgHandleSec: number | null
  resolutionRate: number | null
}

function safeTz(tz: string | undefined): string {
  if (!tz) return 'UTC'
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: tz })
    return tz
  } catch {
    return 'UTC'
  }
}

async function bounds(days: number, tz: string) {
  const rows = await query<{ from: Date; to: Date; prev_from: Date }>(
    `SELECT (date_trunc('day', now() AT TIME ZONE $1) - make_interval(days => $2 - 1)) AT TIME ZONE $1 AS "from",
            now() AS "to",
            (date_trunc('day', now() AT TIME ZONE $1) - make_interval(days => 2 * $2 - 1)) AT TIME ZONE $1 AS prev_from`,
    [tz, days],
  )
  return rows[0]!
}

/** Calendar date (YYYY-MM-DD) of an instant in a timezone. */
function localDate(at: Date, tz: string): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(at)
}

function dayCount(start: string, end: string): number {
  return Math.round((Date.parse(`${end}T00:00:00Z`) - Date.parse(`${start}T00:00:00Z`)) / 86_400_000) + 1
}

/**
 * Whole local days from `start` through `end` (inclusive). A range that ends
 * today stops at now; the comparison period is the same number of days just
 * before it.
 */
async function customBounds(start: string, end: string, tz: string) {
  const days = dayCount(start, end)
  const rows = await query<{ from: Date; to: Date; prev_from: Date }>(
    `SELECT ($2::date)::timestamp AT TIME ZONE $1 AS "from",
            LEAST(($3::date + 1)::timestamp AT TIME ZONE $1, now()) AS "to",
            ($2::date - $4::int)::timestamp AT TIME ZONE $1 AS prev_from`,
    [tz, start, end, days],
  )
  return { ...rows[0]!, days }
}

/** Headline numbers for one agent (or, with agentId = null, every agent at once — keyed by id). */
async function kpisByAgent(agentId: string | null, from: Date, to: Date): Promise<Map<string, Kpis>> {
  const params = [from, to, agentId]
  const [sent, replies, resolved] = await Promise.all([
    query<{ agent_id: string; conversations: number; messages: number }>(
      `SELECT m.agent_id, count(DISTINCT m.conversation_id)::int AS conversations, count(*)::int AS messages
       FROM messages m
       WHERE m.agent_id IS NOT NULL AND ($3::uuid IS NULL OR m.agent_id = $3)
         AND m.type IN ('outgoing', 'template') AND m.created_at >= $1 AND m.created_at < $2
       GROUP BY m.agent_id`, params),
    query<{ agent_id: string; median: number | null }>(
      `SELECT m.agent_id, percentile_cont(0.5) WITHIN GROUP (ORDER BY EXTRACT(EPOCH FROM m.created_at - p.created_at))::float AS median
       FROM messages m
       JOIN LATERAL (
         SELECT p.type, p.created_at FROM messages p
         WHERE p.conversation_id = m.conversation_id AND p.created_at < m.created_at
           AND p.type IN ('incoming', 'answer', 'outgoing', 'template')
         ORDER BY p.created_at DESC LIMIT 1
       ) p ON p.type IN ('incoming', 'answer')
       WHERE m.agent_id IS NOT NULL AND ($3::uuid IS NULL OR m.agent_id = $3)
         AND m.type IN ('outgoing', 'template') AND m.created_at >= $1 AND m.created_at < $2
       GROUP BY m.agent_id`, params),
    query<{ agent_id: string; resolved: number; avg_handle: number | null }>(
      `SELECT r.agent_id, count(*)::int AS resolved,
              avg(EXTRACT(EPOCH FROM r.created_at - f.first_at))::float AS avg_handle
       FROM (
         SELECT m.conversation_id, m.created_at, COALESCE(m.agent_id, c.agent_id) AS agent_id
         FROM messages m JOIN conversations c ON c.id = m.conversation_id
         WHERE m.type = 'event' AND m.event = 'resolved' AND m.created_at >= $1 AND m.created_at < $2
       ) r
       LEFT JOIN LATERAL (
         SELECT min(x.created_at) AS first_at FROM messages x
         WHERE x.conversation_id = r.conversation_id AND x.agent_id = r.agent_id
           AND x.type IN ('outgoing', 'template') AND x.created_at <= r.created_at
       ) f ON true
       WHERE r.agent_id IS NOT NULL AND ($3::uuid IS NULL OR r.agent_id = $3)
       GROUP BY r.agent_id`, params),
  ])

  const out = new Map<string, Kpis>()
  const get = (id: string) => {
    let k = out.get(id)
    if (!k) out.set(id, k = { conversations: 0, messages: 0, resolved: 0, replySec: null, avgHandleSec: null, resolutionRate: null })
    return k
  }
  for (const r of sent) Object.assign(get(r.agent_id), { conversations: r.conversations, messages: r.messages })
  for (const r of replies) get(r.agent_id).replySec = r.median === null ? null : Math.round(r.median)
  for (const r of resolved) Object.assign(get(r.agent_id), { resolved: r.resolved, avgHandleSec: r.avg_handle === null ? null : Math.round(r.avg_handle) })
  for (const k of out.values()) k.resolutionRate = k.conversations ? Math.min(1, k.resolved / k.conversations) : null
  return out
}

const EMPTY: Kpis = { conversations: 0, messages: 0, resolved: 0, replySec: null, avgHandleSec: null, resolutionRate: null }

export async function agentAnalytics(actor: Actor, opts: { range: RangeKey; tz?: string; agentId?: string; from?: string; to?: string }) {
  authorize(actor, 'conversation.read')
  const agentId = opts.agentId ?? actor.id
  if (agentId !== actor.id && !can(actor, 'analytics.team')) throw forbidden('forbidden', 'Only supervisors can view another agent’s analytics')
  const agent = await userRepository.findById(agentId)
  if (!agent) throw notFound('user_not_found')

  const tz = safeTz(opts.tz)
  let days: number
  let from: Date, to: Date, prevFrom: Date
  if (opts.range === 'custom') {
    if (!opts.from || !opts.to) throw badRequest('range_dates_required', 'A custom range needs a from and a to date')
    if (opts.from > opts.to) throw badRequest('range_inverted', 'The start date must be on or before the end date')
    if (opts.to > localDate(new Date(), tz)) throw badRequest('range_in_future', 'The range can’t end after today')
    if (dayCount(opts.from, opts.to) > MAX_CUSTOM_DAYS) throw badRequest('range_too_long', `Pick ${MAX_CUSTOM_DAYS} days or fewer`)
    ;({ from, to, prev_from: prevFrom, days } = await customBounds(opts.from, opts.to, tz))
  } else {
    days = DAYS[opts.range]
    ;({ from, to, prev_from: prevFrom } = await bounds(days, tz))
  }

  const [current, previous, team, daily, byHour, byChannel, users] = await Promise.all([
    kpisByAgent(agentId, from, to),
    kpisByAgent(agentId, prevFrom, from),
    kpisByAgent(null, from, to),
    query<{ day: string; conversations: number; messages: number; resolved: number; reply: number | null }>(
      `WITH days AS (
         SELECT to_char(d, 'YYYY-MM-DD') AS day
         FROM generate_series(($1::timestamptz AT TIME ZONE $4)::date, (($2::timestamptz - interval '1 millisecond') AT TIME ZONE $4)::date, interval '1 day') d
       ),
       sent AS (
         SELECT to_char(m.created_at AT TIME ZONE $4, 'YYYY-MM-DD') AS day,
                count(DISTINCT m.conversation_id)::int AS conversations, count(*)::int AS messages
         FROM messages m
         WHERE m.agent_id = $3 AND m.type IN ('outgoing', 'template') AND m.created_at >= $1 AND m.created_at < $2
         GROUP BY 1
       ),
       replies AS (
         SELECT to_char(m.created_at AT TIME ZONE $4, 'YYYY-MM-DD') AS day,
                percentile_cont(0.5) WITHIN GROUP (ORDER BY EXTRACT(EPOCH FROM m.created_at - p.created_at))::float AS reply
         FROM messages m
         JOIN LATERAL (
           SELECT p.type, p.created_at FROM messages p
           WHERE p.conversation_id = m.conversation_id AND p.created_at < m.created_at
             AND p.type IN ('incoming', 'answer', 'outgoing', 'template')
           ORDER BY p.created_at DESC LIMIT 1
         ) p ON p.type IN ('incoming', 'answer')
         WHERE m.agent_id = $3 AND m.type IN ('outgoing', 'template') AND m.created_at >= $1 AND m.created_at < $2
         GROUP BY 1
       ),
       res AS (
         SELECT to_char(m.created_at AT TIME ZONE $4, 'YYYY-MM-DD') AS day, count(*)::int AS resolved
         FROM messages m JOIN conversations c ON c.id = m.conversation_id
         WHERE m.type = 'event' AND m.event = 'resolved' AND m.created_at >= $1 AND m.created_at < $2
           AND COALESCE(m.agent_id, c.agent_id) = $3
         GROUP BY 1
       )
       SELECT days.day, COALESCE(sent.conversations, 0) AS conversations, COALESCE(sent.messages, 0) AS messages,
              COALESCE(res.resolved, 0) AS resolved, replies.reply
       FROM days LEFT JOIN sent USING (day) LEFT JOIN replies USING (day) LEFT JOIN res USING (day)
       ORDER BY days.day`,
      [from, to, agentId, tz]),
    query<{ hour: number; messages: number }>(
      `SELECT EXTRACT(HOUR FROM m.created_at AT TIME ZONE $4)::int AS hour, count(*)::int AS messages
       FROM messages m
       WHERE m.agent_id = $3 AND m.type IN ('outgoing', 'template') AND m.created_at >= $1 AND m.created_at < $2
       GROUP BY 1`, [from, to, agentId, tz]),
    query<{ channel: 'whatsapp' | 'instagram' | 'webchat'; conversations: number }>(
      `SELECT c.channel, count(DISTINCT m.conversation_id)::int AS conversations
       FROM messages m JOIN conversations c ON c.id = m.conversation_id
       WHERE m.agent_id = $3 AND m.type IN ('outgoing', 'template') AND m.created_at >= $1 AND m.created_at < $2
       GROUP BY c.channel`, [from, to, agentId]),
    userRepository.listActive(),
  ])

  const hours = Array.from({ length: 24 }, () => 0)
  for (const h of byHour) hours[h.hour] = h.messages
  const channels = { whatsapp: 0, instagram: 0, webchat: 0 }
  for (const c of byChannel) channels[c.channel] = c.conversations

  return {
    range: {
      key: opts.range, days, from: from.toISOString(), to: to.toISOString(), tz,
      // The calendar days covered, in the viewer's timezone — what a date picker shows.
      startDate: localDate(from, tz), endDate: localDate(new Date(to.getTime() - 1), tz),
    },
    agent: { id: agent.id, name: agent.name, initials: agent.initials, color: agent.color, role: agent.role },
    kpis: current.get(agentId) ?? EMPTY,
    previous: previous.get(agentId) ?? EMPTY,
    daily: daily.map(d => ({
      date: d.day, conversations: d.conversations, messages: d.messages, resolved: d.resolved,
      replySec: d.reply === null ? null : Math.round(d.reply),
    })),
    byHour: hours,
    byChannel: channels,
    team: users
      .map(u => ({ id: u.id, name: u.name, initials: u.initials, color: u.color, role: u.role, ...(team.get(u.id) ?? EMPTY) }))
      .filter(u => u.conversations > 0 || u.resolved > 0 || u.id === agentId)
      .sort((a, b) => b.resolved - a.resolved || b.conversations - a.conversations || a.name.localeCompare(b.name)),
  }
}
