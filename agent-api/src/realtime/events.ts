import type { Db } from '../db/pool.js'
import type { ConversationDto, MessageDto } from '../db/repositories/conversationRepository.js'

/**
 * Everything the live stream can say. Each carries enough state to apply
 * without a follow-up fetch, and conversation-bearing events carry the
 * conversation's `version` so a client can drop anything not strictly newer
 * than what it already holds.
 */
export type InboxEvent =
  | { kind: 'conversation.updated'; conversation: ConversationDto }
  | { kind: 'message.created'; conversation: ConversationDto; message: MessageDto }
  | { kind: 'message.updated'; conversationId: string; botId: string | null; message: MessageDto }
  | { kind: 'presence.updated'; user: { id: string; name: string; presence: string } }
  | { kind: 'call.ringing'; call: CallEventPayload }
  | { kind: 'call.answered'; call: CallEventPayload }
  | { kind: 'call.ended'; call: CallEventPayload }

export interface CallEventPayload {
  callId: string
  conversationId: string
  direction: 'inbound' | 'outbound'
  video: boolean
  agentId: string | null
  botId: string | null
  contactName: string
  endReason?: string | null
}

// Any constant works; it only has to be the same everywhere events are written.
const EVENT_ORDER_LOCK = 0x43_46_45_56 // "CFEV"

/**
 * Records an event inside the caller's transaction. It becomes visible — and
 * NOTIFY fires — only if that transaction commits.
 *
 * The advisory lock makes commit order equal id order. Without it, two
 * transactions could take ids 5 and 6 and commit 6 first; a client that saw
 * 6 and then reconnected with Last-Event-ID: 6 would never receive 5. The
 * lock is transaction-scoped and taken as the last step of the write, so it
 * is held only for the commit itself.
 */
export async function recordEvent(db: Db, event: InboxEvent): Promise<void> {
  const conversationId =
    'conversation' in event ? event.conversation.id
      : 'conversationId' in event ? event.conversationId
        : 'call' in event ? event.call.conversationId
          : null
  await db.query('SELECT pg_advisory_xact_lock($1)', [EVENT_ORDER_LOCK])
  await db.query(
    `INSERT INTO inbox_events (kind, conversation_id, payload) VALUES ($1, $2, $3)`,
    [event.kind, conversationId, JSON.stringify(event)],
  )
}
