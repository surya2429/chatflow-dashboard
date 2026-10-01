import { query, type Db } from '../pool.js'
import type { Channel } from './conversationRepository.js'

export interface ContactRow {
  id: string
  channel: Channel
  name: string
  avatar: string | null
  phone: string | null
  handle: string | null
  visitor_id: string | null
  external_id: string | null
  is_follower: boolean
  profile: Record<string, unknown>
  custom_fields: Record<string, unknown>
  visitor_meta: Record<string, unknown>
  created_at: Date
}

export interface ContactDto {
  id: string
  channel: Channel
  name: string
  avatar: string | null
  phone?: string
  handle?: string
  visitorId?: string
  isFollower?: boolean
  profile: Record<string, unknown>
  customFields: Record<string, unknown>
  visitor?: Record<string, unknown>
  createdAt: string
}

export function toContactDto(c: ContactRow): ContactDto {
  const dto: ContactDto = {
    id: c.id, channel: c.channel, name: c.name, avatar: c.avatar,
    profile: c.profile, customFields: c.custom_fields, createdAt: c.created_at.toISOString(),
  }
  if (c.phone) dto.phone = c.phone
  if (c.channel === 'instagram') { dto.handle = c.handle ?? undefined; dto.isFollower = c.is_follower }
  if (c.channel === 'webchat') { dto.visitorId = c.visitor_id ?? undefined; dto.visitor = c.visitor_meta }
  return dto
}

/**
 * One canonical form for WhatsApp numbers: "+" and digits. Meta's webhooks
 * send "919876543210", the dashboard shows "+91 98765 43210", an agent types
 * either — all three must resolve to the same contact.
 */
export function toE164(raw: string): string | null {
  const digits = raw.replace(/\D/g, '')
  return digits.length >= 8 && digits.length <= 15 ? `+${digits}` : null
}

function canonical<T extends { channel: Channel; phone?: string }>(id: T): T {
  if (id.channel !== 'whatsapp' || !id.phone) return id
  return { ...id, phone: toE164(id.phone) ?? id.phone }
}

export interface ContactIdentity {
  channel: Channel
  phone?: string
  handle?: string
  visitorId?: string
}

export const contactRepository = {
  async findById(id: string, db?: Db): Promise<ContactRow | null> {
    const rows = await query<ContactRow>(`SELECT * FROM contacts WHERE id = $1`, [id], db)
    return rows[0] ?? null
  },

  async findByIdentity(identity: ContactIdentity, db?: Db): Promise<ContactRow | null> {
    const id = canonical(identity)
    const rows =
      id.channel === 'whatsapp' ? await query<ContactRow>(`SELECT * FROM contacts WHERE channel = 'whatsapp' AND phone = $1`, [id.phone], db)
        : id.channel === 'instagram' ? await query<ContactRow>(`SELECT * FROM contacts WHERE channel = 'instagram' AND lower(handle) = lower($1)`, [id.handle], db)
          : await query<ContactRow>(`SELECT * FROM contacts WHERE channel = 'webchat' AND visitor_id = $1`, [id.visitorId], db)
    return rows[0] ?? null
  },

  /**
   * Insert-or-refresh by channel identity. `ON CONFLICT` on the partial unique
   * indexes makes two near-simultaneous first messages from a new person
   * produce one contact, not a constraint error.
   */
  async upsert(input: ContactIdentity & {
    name: string
    externalId?: string | null
    isFollower?: boolean
    visitorMeta?: Record<string, unknown>
  }, db?: Db): Promise<ContactRow> {
    const c = canonical(input)
    const conflict =
      c.channel === 'whatsapp' ? `(phone) WHERE channel = 'whatsapp'`
        : c.channel === 'instagram' ? `(lower(handle)) WHERE channel = 'instagram'`
          : `(visitor_id) WHERE channel = 'webchat'`
    const rows = await query<ContactRow>(
      `INSERT INTO contacts (channel, name, phone, handle, visitor_id, external_id, is_follower, visitor_meta)
       VALUES ($1, $2, $3, $4, $5, $6, COALESCE($7, false), COALESCE($8, '{}'::jsonb))
       ON CONFLICT ${conflict} DO UPDATE SET
         external_id  = COALESCE(EXCLUDED.external_id, contacts.external_id),
         is_follower  = COALESCE($7, contacts.is_follower),
         visitor_meta = contacts.visitor_meta || COALESCE($8, '{}'::jsonb),
         -- A provider-reported name only replaces a placeholder, never a name
         -- an agent typed into the contact panel.
         name = CASE WHEN contacts.name LIKE 'Visitor #%' OR contacts.name = '' THEN EXCLUDED.name ELSE contacts.name END
       RETURNING *`,
      [c.channel, c.name, c.phone ?? null, c.handle ?? null, c.visitorId ?? null, c.externalId ?? null,
        c.isFollower ?? null, c.visitorMeta ? JSON.stringify(c.visitorMeta) : null],
      db,
    )
    return rows[0]!
  },

  /** Merge-patch of the editable fields. `null` inside profile/customFields deletes that key. */
  async update(id: string, patch: { name?: string; profile?: Record<string, unknown>; customFields?: Record<string, unknown> }): Promise<ContactRow | null> {
    const rows = await query<ContactRow>(
      `UPDATE contacts SET
         name = COALESCE($2, name),
         profile = jsonb_strip_nulls(profile || COALESCE($3, '{}'::jsonb)),
         custom_fields = jsonb_strip_nulls(custom_fields || COALESCE($4, '{}'::jsonb))
       WHERE id = $1 RETURNING *`,
      [id, patch.name ?? null, patch.profile ? JSON.stringify(patch.profile) : null,
        patch.customFields ? JSON.stringify(patch.customFields) : null],
    )
    return rows[0] ?? null
  },

  /** Instagram followers with no open thread yet — the "new conversation" picker. */
  async instagramFollowersWithoutOpenThread(q: string | undefined, limit: number): Promise<ContactRow[]> {
    return query<ContactRow>(
      `SELECT ct.* FROM contacts ct
       WHERE ct.channel = 'instagram' AND ct.is_follower
         AND NOT EXISTS (SELECT 1 FROM conversations c WHERE c.contact_id = ct.id AND c.status <> 'resolved')
         AND ($1::text IS NULL OR ct.name ILIKE '%' || $1 || '%' OR ct.handle ILIKE '%' || $1 || '%')
       ORDER BY ct.name LIMIT $2`,
      [q?.trim() || null, limit],
    )
  },
}
