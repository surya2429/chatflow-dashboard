import { query, withTransaction } from '../db/pool.js'
import { logger } from '../config/logger.js'
import { conversationRepository } from '../db/repositories/conversationRepository.js'
import { recordEvent, type CallEventPayload } from '../realtime/events.js'
import { appendMessage } from '../services/inboxService.js'

/**
 * The authoritative record of each call, and the single place its outcome is
 * written into the conversation thread — the same `call_answered` /
 * `call_missed` event messages the dashboard logs, but written once, by the
 * server, whether or not either app survived to the end of the call.
 */
export interface CallSession {
  id: string
  conversationId: string
  direction: 'inbound' | 'outbound'
  video: boolean
  state: 'ringing' | 'accepted' | 'connected' | 'ended'
  agentId: string | null
  agentName: string | null
  botId: string | null
  contactName: string
  answeredAt: Date | null
  /** Users whose phones were rung — told to stop ringing when it's over or taken. */
  rang: string[]
}

export type EndReason =
  | 'hangup' | 'declined' | 'no-answer' | 'no-peer' | 'caller-cancelled' | 'connection-lost' | 'media-error'

const OUTCOME_TEXT: Record<EndReason, string> = {
  hangup: 'Missed',
  declined: 'Declined',
  'no-answer': 'No answer',
  'no-peer': 'No answer',
  'caller-cancelled': 'Missed',
  'connection-lost': 'Disconnected',
  'media-error': 'Failed — microphone/camera unavailable',
}

export function payloadOf(s: CallSession, endReason?: string | null): CallEventPayload {
  return {
    callId: s.id, conversationId: s.conversationId, direction: s.direction, video: s.video,
    agentId: s.agentId, botId: s.botId, contactName: s.contactName, endReason: endReason ?? null,
  }
}

function fmtDuration(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60)
  const s = totalSeconds % 60
  return m ? `${m}m ${s}s` : `${s}s`
}

export async function createSession(conversationId: string, direction: 'inbound' | 'outbound', video: boolean, agent: { id: string; name: string } | null): Promise<CallSession | null> {
  const conv = await conversationRepository.findById(conversationId)
  if (!conv) return null
  try {
    return await withTransaction(async (tx) => {
      // A stale live row (process crashed mid-call) must not block new calls forever.
      await tx.query(
        `UPDATE call_sessions SET state = 'ended', end_reason = 'connection-lost', ended_at = now()
         WHERE conversation_id = $1 AND state <> 'ended'`, [conversationId])
      const rows = await tx.query<{ id: string }>(
        `INSERT INTO call_sessions (conversation_id, direction, video, agent_id) VALUES ($1, $2, $3, $4) RETURNING id`,
        [conversationId, direction, video, agent?.id ?? null])
      const session: CallSession = {
        id: rows.rows[0]!.id, conversationId, direction, video, state: 'ringing',
        agentId: agent?.id ?? null, agentName: agent?.name ?? null, botId: conv.bot_id, contactName: conv.name, answeredAt: null, rang: [],
      }
      await recordEvent(tx, { kind: 'call.ringing', call: payloadOf(session) })
      return session
    })
  } catch (err) {
    logger.error({ err, conversationId }, '[signaling] could not create call session')
    return null
  }
}

export async function markAccepted(s: CallSession, agent: { id: string; name: string } | null) {
  s.state = 'accepted'
  if (agent) { s.agentId = agent.id; s.agentName = agent.name }
  await withTransaction(async (tx) => {
    await tx.query(`UPDATE call_sessions SET state = 'accepted', agent_id = COALESCE($2, agent_id) WHERE id = $1`, [s.id, agent?.id ?? null])
    await recordEvent(tx, { kind: 'call.answered', call: payloadOf(s) })
  }).catch((err) => logger.error({ err }, '[signaling] markAccepted failed'))
}

export async function markConnected(s: CallSession) {
  if (s.state === 'connected') return
  s.state = 'connected'
  s.answeredAt = new Date()
  await query(`UPDATE call_sessions SET state = 'connected', answered_at = now() WHERE id = $1`, [s.id])
    .catch((err) => logger.error({ err }, '[signaling] markConnected failed'))
}

/** Ends the call and logs its outcome into the thread. Safe to call twice. */
export async function endSession(s: CallSession, reason: EndReason): Promise<void> {
  if (s.state === 'ended') return
  const wasConnected = s.state === 'connected' && s.answeredAt
  s.state = 'ended'
  const dir = s.direction === 'outbound' ? 'Outbound' : 'Inbound'
  const kind = s.video ? 'video call' : 'voice call'
  const seconds = wasConnected ? Math.max(1, Math.round((Date.now() - s.answeredAt!.getTime()) / 1000)) : 0
  const text = wasConnected
    ? `${dir} ${kind} · ${fmtDuration(seconds)} · Answered${s.agentName ? ` by ${s.agentName}` : ''}`
    : `${dir} ${kind} · ${OUTCOME_TEXT[reason]}`

  try {
    await withTransaction(async (tx) => {
      await tx.query(
        `UPDATE call_sessions SET state = 'ended', end_reason = $2, ended_at = now() WHERE id = $1`,
        [s.id, wasConnected ? 'completed' : reason])
      await tx.query(`SELECT 1 FROM conversations WHERE id = $1 FOR UPDATE`, [s.conversationId])
      const conv = await conversationRepository.findById(s.conversationId, tx)
      if (conv) {
        await appendMessage(tx, conv, {
          conversationId: s.conversationId, type: 'event', event: wasConnected ? 'call_answered' : 'call_missed', text,
        }, { movesPreview: true })
      }
      await recordEvent(tx, { kind: 'call.ended', call: payloadOf(s, wasConnected ? 'completed' : reason) })
    })
  } catch (err) {
    logger.error({ err, callId: s.id }, '[signaling] could not record call end')
  }
}

