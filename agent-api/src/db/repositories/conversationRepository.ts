import { query, type Db } from '../pool.js'
import { env } from '../../config/env.js'
import { signedFilePath } from '../../storage/signedUrl.js'
import type { AttachmentSnapshot } from './attachmentRepository.js'

export type Channel = 'whatsapp' | 'instagram' | 'webchat'
export type ConversationStatus = 'bot' | 'agent' | 'resolved'
export type MessageType = 'incoming' | 'outgoing' | 'note' | 'event' | 'answer' | 'template'

/** A conversation row joined with its contact and assignee — one query, everything the list needs. */
export interface ConversationRow {
  id: string
  contact_id: string
  channel: Channel
  status: ConversationStatus
  agent_id: string | null
  agent_name: string | null
  source: string
  labels: string[]
  last_message: string
  last_message_at: Date
  unread: number
  starred: boolean
  archived: boolean
  snoozed_until: Date | null
  last_inbound_at: Date | null
  external_ref: string | null
  needs_agent_since: Date | null
  version: number
  resolved_at: Date | null
  created_at: Date
  // contact
  name: string
  avatar: string | null
  phone: string | null
  handle: string | null
  visitor_id: string | null
  external_id: string | null
  is_follower: boolean
  visitor_meta: Record<string, unknown>
  profile: Record<string, unknown>
  // bot
  bot_id: string | null
  bot_name: string | null
  bot_color: string | null
}

/**
 * Who the customer is, as the agent should see it — one rule per channel:
 *   WhatsApp  → their phone number
 *   Instagram → their @handle
 *   Website   → the name or email they gave in the chat, else the visitor id
 * `primary` is the headline; `secondary` the supporting line.
 */
export interface ContactIdentity {
  kind: 'phone' | 'instagram' | 'visitor'
  primary: string
  secondary: string | null
  /** Website Chat: whether the visitor has told us who they are. */
  known?: boolean
}

/**
 * The API contract — field names match the dashboard's in-memory model
 * (see MOBILE_AGENT_APP_PROMPT.md) so the dashboard can move onto this API
 * later without renaming everything.
 */
export interface ConversationDto {
  id: string
  contactId: string
  name: string
  avatar: string
  channel: Channel
  status: ConversationStatus
  agentId: string | null
  agentName: string | null
  source: string
  labels: string[]
  lastMessage: string
  unread: number
  starred: boolean
  archived: boolean
  /** ISO time the snooze ends, or null. */
  snoozed: string | null
  /** ISO time of the last message — what the list sorts and shows by. */
  timestamp: string
  version: number
  /** Set while the bot has asked for a human and nobody has taken it yet. */
  waitingSince: string | null
  botId: string | null
  botName: string | null
  botColor: string | null
  identity: ContactIdentity
  // exactly one identity field, by channel
  phone?: string
  handle?: string
  visitorId?: string
  visitor?: Record<string, unknown>
  /** WhatsApp only: whether a free-form reply is allowed right now. */
  whatsappWindow?: { open: boolean; expiresAt: string | null }
}

export interface MessageRow {
  id: string
  conversation_id: string
  type: MessageType
  text: string
  sender: string | null
  agent_id: string | null
  agent_name: string | null
  template: Record<string, unknown> | null
  question_type: string | null
  label: string | null
  value: string | null
  event: string | null
  delivery: 'pending' | 'sent' | 'delivered' | 'read' | 'failed' | null
  external_id: string | null
  client_msg_id: string | null
  attachment: AttachmentSnapshot | null
  created_at: Date
}

export interface MessageDto {
  id: string
  conversationId: string
  type: MessageType
  text: string
  /** ISO timestamp — the client formats it for display. */
  time: string
  sender: string | null
  agentName?: string
  template?: Record<string, unknown>
  questionType?: string
  label?: string
  value?: string
  event?: string
  delivery?: string
  clientMsgId?: string
  /** The file, with a signed path (relative to the API origin) valid for about a day. */
  attachment?: AttachmentSnapshot & { url: string }
}

function initials(name: string): string {
  // Letters and digits only, so "Visitor #4821" is "V4", not "V#".
  const words = name.split(/\s+/).map(w => w.replace(/[^\p{L}\p{N}]/gu, '')).filter(Boolean)
  return words.slice(0, 2).map(w => w[0]!.toUpperCase()).join('') || '?'
}

export function whatsappWindow(lastInboundAt: Date | null): { open: boolean; expiresAt: string | null } {
  if (!lastInboundAt) return { open: false, expiresAt: null }
  const expires = new Date(lastInboundAt.getTime() + env.WHATSAPP_WINDOW_HOURS * 3_600_000)
  return { open: expires.getTime() > Date.now(), expiresAt: expires.toISOString() }
}

export function formatE164(phone: string | null): string {
  if (!phone) return ''
  const d = phone.replace(/\D/g, '')
  if (d.startsWith('91') && d.length === 12) return `+91 ${d.slice(2, 7)} ${d.slice(7)}`
  if (d.startsWith('1') && d.length === 11) return `+1 ${d.slice(1, 4)} ${d.slice(4, 7)} ${d.slice(7)}`
  if (d.length > 10) return `+${d.slice(0, d.length - 10)} ${d.slice(-10, -5)} ${d.slice(-5)}`
  return `+${d}`
}

const PLACEHOLDER_NAME = /^Visitor #/i

export function identityOf(r: Pick<ConversationRow, 'channel' | 'name' | 'phone' | 'handle' | 'visitor_id' | 'profile'>): ContactIdentity {
  if (r.channel === 'whatsapp') return { kind: 'phone', primary: formatE164(r.phone), secondary: null }
  if (r.channel === 'instagram') {
    const handle = r.handle ? (r.handle.startsWith('@') ? r.handle : `@${r.handle}`) : ''
    return { kind: 'instagram', primary: handle, secondary: null }
  }
  const email = typeof r.profile?.email === 'string' && r.profile.email ? r.profile.email : null
  const named = !!r.name && !PLACEHOLDER_NAME.test(r.name)
  const visitorId = r.visitor_id ?? ''
  if (named) return { kind: 'visitor', primary: r.name, secondary: email ?? visitorId, known: true }
  if (email) return { kind: 'visitor', primary: email, secondary: visitorId, known: true }
  return { kind: 'visitor', primary: visitorId, secondary: null, known: false }
}

export function toConversationDto(r: ConversationRow): ConversationDto {
  const identity = identityOf(r)
  // An anonymous website visitor is shown by what we know about them — the
  // email they typed, else their unique visitor id.
  const displayName = r.channel === 'webchat' ? identity.primary || r.name : r.name
  const dto: ConversationDto = {
    id: r.id,
    contactId: r.contact_id,
    name: displayName,
    // An anonymous visitor's id is random hex — its second "initial" means nothing.
    avatar: r.avatar || (r.channel === 'webchat' && !identity.known ? 'V' : initials(displayName)),
    channel: r.channel,
    status: r.status,
    agentId: r.agent_id,
    agentName: r.agent_name,
    source: r.source,
    labels: r.labels,
    lastMessage: r.last_message,
    unread: r.unread,
    starred: r.starred,
    archived: r.archived,
    snoozed: r.snoozed_until && r.snoozed_until.getTime() > Date.now() ? r.snoozed_until.toISOString() : null,
    timestamp: r.last_message_at.toISOString(),
    version: r.version,
    waitingSince: r.needs_agent_since?.toISOString() ?? null,
    botId: r.bot_id,
    botName: r.bot_name,
    botColor: r.bot_color,
    identity,
  }
  if (r.channel === 'whatsapp') {
    dto.phone = r.phone ?? undefined
    dto.whatsappWindow = whatsappWindow(r.last_inbound_at)
  } else if (r.channel === 'instagram') {
    dto.handle = r.handle ?? undefined
  } else {
    dto.visitorId = r.visitor_id ?? undefined
    dto.visitor = r.visitor_meta
  }
  return dto
}

export function toMessageDto(m: MessageRow): MessageDto {
  const dto: MessageDto = {
    id: m.id,
    conversationId: m.conversation_id,
    type: m.type,
    text: m.text,
    time: m.created_at.toISOString(),
    sender: m.sender,
  }
  if (m.agent_name) dto.agentName = m.agent_name
  if (m.template) dto.template = m.template
  if (m.question_type) dto.questionType = m.question_type
  if (m.label) dto.label = m.label
  if (m.value !== null) dto.value = m.value
  if (m.event) dto.event = m.event
  if (m.delivery) dto.delivery = m.delivery
  if (m.client_msg_id) dto.clientMsgId = m.client_msg_id
  if (m.attachment) dto.attachment = { ...m.attachment, url: signedFilePath(m.attachment.id, m.attachment.name) }
  return dto
}

const SELECT_CONVERSATION = `
  SELECT c.*, u.name AS agent_name,
         ct.name, ct.avatar, ct.phone, ct.handle, ct.visitor_id, ct.external_id, ct.is_follower, ct.visitor_meta, ct.profile,
         b.name AS bot_name, b.color AS bot_color
  FROM conversations c
  JOIN contacts ct ON ct.id = c.contact_id
  LEFT JOIN users u ON u.id = c.agent_id
  LEFT JOIN bots b ON b.id = c.bot_id`

/**
 * List filters. `view` and `bucket` are the dashboard's two filter rows
 * (All/Active/Assigned to me/Unassigned and Open/Pending/Solved/Unread/
 * Favourite/Last 24h); the rest are the advanced panel.
 */
export interface ListFilters {
  /** Bots the caller may see; null = all (supervisors/admins). Applied before any filter. */
  scope?: string[] | null
  botIds?: string[]
  channels?: Channel[]
  sort?: 'recent' | 'oldest' | 'unread' | 'waiting'
  view?: 'all' | 'active' | 'mine' | 'unassigned' | 'waiting'
  bucket?: 'open' | 'pending' | 'solved' | 'unread' | 'favourite' | 'last24h'
  channel?: Channel
  source?: string
  status?: ConversationStatus[]
  agentId?: string
  labels?: string[]
  from?: string
  to?: string
  starred?: boolean
  unread?: boolean
  archived?: boolean
  includeSnoozed?: boolean
  q?: string
  cursor?: string
  limit: number
}

export interface Cursor { t: string; id: string }

export function encodeCursor(c: Cursor): string {
  return Buffer.from(JSON.stringify(c)).toString('base64url')
}
function decodeCursor(s: string): Cursor | null {
  try {
    const c = JSON.parse(Buffer.from(s, 'base64url').toString()) as Cursor
    return typeof c.t === 'string' && typeof c.id === 'string' ? c : null
  } catch { return null }
}

export const conversationRepository = {
  async findById(id: string, db?: Db, opts: { lock?: boolean } = {}): Promise<ConversationRow | null> {
    if (opts.lock) {
      // Lock the conversation row itself (not the joined ones) so concurrent
      // actions on one chat serialize — e.g. two agents hitting "take over"
      // at the same instant: exactly one wins, the other sees it owned.
      await query(`SELECT 1 FROM conversations WHERE id = $1 FOR UPDATE`, [id], db)
    }
    const rows = await query<ConversationRow>(`${SELECT_CONVERSATION} WHERE c.id = $1`, [id], db)
    return rows[0] ?? null
  },

  async list(actorId: string, f: ListFilters): Promise<{ items: ConversationRow[]; nextCursor: string | null }> {
    const where: string[] = []
    const params: unknown[] = []
    const p = (v: unknown) => { params.push(v); return `$${params.length}` }

    switch (f.view) {
      case 'active': where.push(`c.status IN ('bot','agent')`); break
      case 'mine': where.push(`c.agent_id = ${p(actorId)}`); break
      case 'unassigned': where.push(`c.agent_id IS NULL AND c.status <> 'resolved'`); break
      case 'waiting': where.push(`c.needs_agent_since IS NOT NULL`); break
      default: break
    }
    if (f.scope) where.push(`c.bot_id = ANY(${p(f.scope)}::uuid[])`)
    if (f.botIds?.length) where.push(`c.bot_id = ANY(${p(f.botIds)}::uuid[])`)
    if (f.channels?.length) where.push(`c.channel = ANY(${p(f.channels)}::inbox_channel[])`)
    switch (f.bucket) {
      case 'open': where.push(`c.status IN ('bot','agent')`); break
      case 'pending': where.push(`c.status = 'bot'`); break
      case 'solved': where.push(`c.status = 'resolved'`); break
      case 'unread': where.push(`c.unread > 0`); break
      case 'favourite': where.push(`c.starred`); break
      case 'last24h': where.push(`c.last_message_at >= now() - interval '24 hours'`); break
      default: break
    }
    if (f.channel) where.push(`c.channel = ${p(f.channel)}`)
    if (f.source) where.push(`c.source = ${p(f.source)}`)
    if (f.status?.length) where.push(`c.status = ANY(${p(f.status)}::conversation_status[])`)
    if (f.agentId) where.push(`c.agent_id = ${p(f.agentId)}`)
    if (f.labels?.length) where.push(`c.labels @> ${p(f.labels)}::text[]`)
    if (f.from) where.push(`c.last_message_at >= ${p(f.from)}`)
    if (f.to) where.push(`c.last_message_at <= ${p(f.to)}`)
    if (f.starred) where.push(`c.starred`)
    if (f.unread) where.push(`c.unread > 0`)
    // Archived chats are their own view, never mixed in — same as the dashboard.
    where.push(f.archived ? `c.archived` : `NOT c.archived`)
    if (!f.includeSnoozed) where.push(`(c.snoozed_until IS NULL OR c.snoozed_until <= now())`)
    if (f.q?.trim()) {
      const raw = f.q.trim()
      const like = p(`%${raw.replace(/[%_\\]/g, m => `\\${m}`)}%`)
      // Phone searches match however the number is typed: "98765 43210", "+91-98765…".
      const digits = raw.replace(/\D/g, '')
      const phoneLike = digits.length >= 4 ? p(`%${digits}%`) : null
      where.push(`(ct.name ILIKE ${like} OR c.last_message ILIKE ${like} OR ct.handle ILIKE ${like}
                   OR ct.visitor_id ILIKE ${like} OR ct.profile->>'email' ILIKE ${like}
                   ${phoneLike ? `OR ct.phone LIKE ${phoneLike}` : ''}
                   OR EXISTS (SELECT 1 FROM unnest(c.labels) l WHERE l ILIKE ${like}))`)
    }
    // Keyset pagination on (last_message_at, id). "Oldest first" walks it
    // forwards; "unread first" / "waiting first" float a subset to the top of
    // the first page only, then continue newest-first.
    const asc = f.sort === 'oldest'
    const cursor = f.cursor ? decodeCursor(f.cursor) : null
    if (cursor) where.push(`(c.last_message_at, c.id) ${asc ? '>' : '<'} (${p(cursor.t)}::timestamptz, ${p(cursor.id)}::uuid)`)
    const order =
      asc ? 'c.last_message_at ASC, c.id ASC'
        : f.sort === 'unread' && !cursor ? '(c.unread > 0) DESC, c.last_message_at DESC, c.id DESC'
          : f.sort === 'waiting' && !cursor ? 'c.needs_agent_since ASC NULLS LAST, c.last_message_at DESC, c.id DESC'
            : 'c.last_message_at DESC, c.id DESC'

    const rows = await query<ConversationRow>(
      `${SELECT_CONVERSATION}
       ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
       ORDER BY ${order}
       LIMIT ${p(f.limit + 1)}`,
      params,
    )
    const hasMore = rows.length > f.limit
    const items = hasMore ? rows.slice(0, f.limit) : rows
    const last = items[items.length - 1]
    return {
      items,
      nextCursor: hasMore && last ? encodeCursor({ t: last.last_message_at.toISOString(), id: last.id }) : null,
    }
  },

  /** Badge counts for the filter rows, in one pass. */
  async counts(actorId: string, opts: { channel?: Channel; scope?: string[] | null; botId?: string } = {}): Promise<Record<string, number>> {
    const rows = await query<Record<string, number>>(
      `SELECT
         count(*)::int                                                          AS all,
         count(*) FILTER (WHERE status IN ('bot','agent'))::int                 AS active,
         count(*) FILTER (WHERE agent_id = $1)::int                              AS mine,
         count(*) FILTER (WHERE agent_id IS NULL AND status <> 'resolved')::int  AS unassigned,
         count(*) FILTER (WHERE status = 'bot')::int                             AS pending,
         count(*) FILTER (WHERE status = 'resolved')::int                        AS solved,
         count(*) FILTER (WHERE unread > 0)::int                                 AS unread,
         count(*) FILTER (WHERE starred)::int                                    AS favourite,
         count(*) FILTER (WHERE needs_agent_since IS NOT NULL)::int              AS waiting
       FROM conversations
       WHERE NOT archived AND (snoozed_until IS NULL OR snoozed_until <= now())
         AND ($2::inbox_channel IS NULL OR channel = $2)
         AND ($3::uuid[] IS NULL OR bot_id = ANY($3::uuid[]))
         AND ($4::uuid IS NULL OR bot_id = $4)`,
      [actorId, opts.channel ?? null, opts.scope ?? null, opts.botId ?? null],
    )
    return rows[0] ?? {}
  },

  async update(id: string, set: Record<string, unknown>, db?: Db): Promise<void> {
    const keys = Object.keys(set)
    if (!keys.length) return
    const sql = keys.map((k, i) => `${k} = $${i + 2}`).join(', ')
    await query(`UPDATE conversations SET ${sql} WHERE id = $1`, [id, ...keys.map(k => set[k])], db)
  },

  async create(c: { contactId: string; channel: Channel; source: string; botId: string | null; status?: ConversationStatus; agentId?: string | null; externalRef?: string | null }, db?: Db): Promise<string> {
    const rows = await query<{ id: string }>(
      `INSERT INTO conversations (contact_id, channel, source, status, agent_id, external_ref, bot_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
      [c.contactId, c.channel, c.source, c.status ?? 'bot', c.agentId ?? null, c.externalRef ?? null, c.botId],
      db,
    )
    return rows[0]!.id
  },

  /**
   * The conversation an inbound message belongs to: the contact's latest one
   * that isn't resolved. A resolved chat stays closed and a new message opens
   * a fresh conversation, so resolution stats and history stay meaningful.
   * Instagram comments are threaded per commented-on object.
   */
  async findOpenForContact(contactId: string, externalRef: string | null, db?: Db): Promise<ConversationRow | null> {
    const rows = await query<ConversationRow>(
      `${SELECT_CONVERSATION}
       WHERE c.contact_id = $1 AND c.status <> 'resolved'
         AND (c.external_ref IS NOT DISTINCT FROM $2)
       ORDER BY c.last_message_at DESC LIMIT 1`,
      [contactId, externalRef],
      db,
    )
    return rows[0] ?? null
  },

  async listForContact(contactId: string): Promise<ConversationRow[]> {
    return query<ConversationRow>(`${SELECT_CONVERSATION} WHERE c.contact_id = $1 ORDER BY c.last_message_at DESC`, [contactId])
  },
}

export const messageRepository = {
  async insert(m: {
    conversationId: string
    type: MessageType
    text: string
    sender?: string | null
    agentId?: string | null
    agentName?: string | null
    template?: Record<string, unknown> | null
    questionType?: string | null
    label?: string | null
    value?: string | null
    event?: string | null
    delivery?: MessageRow['delivery']
    externalId?: string | null
    clientMsgId?: string | null
    attachment?: AttachmentSnapshot | null
  }, db?: Db): Promise<MessageRow> {
    const rows = await query<MessageRow>(
      `INSERT INTO messages (conversation_id, type, text, sender, agent_id, agent_name, template, question_type,
                             label, value, event, delivery, external_id, client_msg_id, attachment)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15) RETURNING *`,
      [m.conversationId, m.type, m.text, m.sender ?? null, m.agentId ?? null, m.agentName ?? null,
        m.template ? JSON.stringify(m.template) : null, m.questionType ?? null, m.label ?? null, m.value ?? null,
        m.event ?? null, m.delivery ?? null, m.externalId ?? null, m.clientMsgId ?? null,
        m.attachment ? JSON.stringify(m.attachment) : null],
      db,
    )
    return rows[0]!
  },

  async findByClientId(conversationId: string, clientMsgId: string, db?: Db): Promise<MessageRow | null> {
    const rows = await query<MessageRow>(
      `SELECT * FROM messages WHERE conversation_id = $1 AND client_msg_id = $2`, [conversationId, clientMsgId], db)
    return rows[0] ?? null
  },

  async findByExternalId(externalId: string, db?: Db): Promise<MessageRow | null> {
    const rows = await query<MessageRow>(`SELECT * FROM messages WHERE external_id = $1`, [externalId], db)
    return rows[0] ?? null
  },

  /** Newest-first page, returned oldest-first for rendering. */
  async page(conversationId: string, before: string | null, limit: number): Promise<{ items: MessageRow[]; hasMore: boolean }> {
    const rows = await query<MessageRow>(
      `SELECT * FROM messages
       WHERE conversation_id = $1
         AND ($2::uuid IS NULL OR (created_at, id) < (SELECT created_at, id FROM messages WHERE id = $2))
       ORDER BY created_at DESC, id DESC
       LIMIT $3`,
      [conversationId, before, limit + 1],
    )
    const hasMore = rows.length > limit
    return { items: (hasMore ? rows.slice(0, limit) : rows).reverse(), hasMore }
  },

  async setDelivery(id: string, delivery: MessageRow['delivery'], externalId: string | null, db?: Db): Promise<MessageRow | null> {
    const rows = await query<MessageRow>(
      `UPDATE messages SET delivery = $2, external_id = COALESCE($3, external_id) WHERE id = $1 RETURNING *`,
      [id, delivery, externalId],
      db,
    )
    return rows[0] ?? null
  },

  /** Bot-flow captured answers across all of a contact's conversations — the contact panel's rollup. */
  async answersForContact(contactId: string): Promise<MessageRow[]> {
    return query<MessageRow>(
      `SELECT m.* FROM messages m JOIN conversations c ON c.id = m.conversation_id
       WHERE c.contact_id = $1 AND m.type = 'answer' ORDER BY m.created_at`,
      [contactId],
    )
  },
}
