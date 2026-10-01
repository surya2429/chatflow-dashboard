import { query, type Db } from '../pool.js'
import type { AttachmentKind } from '../../services/attachmentPolicy.js'

export interface AttachmentRow {
  id: string
  conversation_id: string
  uploaded_by: string | null
  kind: AttachmentKind
  file_name: string
  mime_type: string
  size_bytes: number
  width: number | null
  height: number | null
  storage_key: string
  message_id: string | null
  created_at: Date
}

/** What a message carries about its file (stored on the message, signed into a URL on the way out). */
export interface AttachmentSnapshot {
  id: string
  kind: AttachmentKind
  name: string
  mime: string
  size: number
  width?: number
  height?: number
}

export function snapshotOf(a: AttachmentRow): AttachmentSnapshot {
  return {
    id: a.id, kind: a.kind, name: a.file_name, mime: a.mime_type, size: a.size_bytes,
    ...(a.width && a.height ? { width: a.width, height: a.height } : {}),
  }
}

export const attachmentRepository = {
  async insert(a: {
    id: string; conversationId: string; uploadedBy: string | null; kind: AttachmentKind; fileName: string
    mimeType: string; sizeBytes: number; width: number | null; height: number | null; storageKey: string
  }, db?: Db): Promise<AttachmentRow> {
    const rows = await query<AttachmentRow>(
      `INSERT INTO attachments (id, conversation_id, uploaded_by, kind, file_name, mime_type, size_bytes, width, height, storage_key)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
      [a.id, a.conversationId, a.uploadedBy, a.kind, a.fileName, a.mimeType, a.sizeBytes, a.width, a.height, a.storageKey],
      db,
    )
    return rows[0]!
  },

  async findById(id: string, db?: Db): Promise<AttachmentRow | null> {
    const rows = await query<AttachmentRow>(`SELECT * FROM attachments WHERE id = $1`, [id], db)
    return rows[0] ?? null
  },

  /** Locks the row: two sends racing for one upload can't both attach it. */
  async findUnsentForConversation(id: string, conversationId: string, db: Db): Promise<AttachmentRow | null> {
    const rows = await query<AttachmentRow>(
      `SELECT * FROM attachments WHERE id = $1 AND conversation_id = $2 AND message_id IS NULL FOR UPDATE`, [id, conversationId], db)
    return rows[0] ?? null
  },

  async markSent(id: string, messageId: string, db: Db): Promise<void> {
    await query(`UPDATE attachments SET message_id = $2 WHERE id = $1`, [id, messageId], db)
  },

  /** Uploads that were never sent, oldest first — removed by the sweeper. */
  async takeAbandoned(olderThanHours: number, limit = 200): Promise<AttachmentRow[]> {
    return query<AttachmentRow>(
      `DELETE FROM attachments WHERE id IN (
         SELECT id FROM attachments WHERE message_id IS NULL AND created_at < now() - make_interval(hours => $1)
         ORDER BY created_at LIMIT $2)
       RETURNING *`,
      [olderThanHours, limit],
    )
  },
}
