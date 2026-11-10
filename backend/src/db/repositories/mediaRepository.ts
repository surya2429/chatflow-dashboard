import { query } from '../pool.js'
import type { MediaStore } from '../../media/media.js'

export const mediaRepository: MediaStore = {
  async put({ id, botRef, mime, bytes }) {
    await query('INSERT INTO webchat_media (id, bot_ref, mime, size_bytes, data) VALUES ($1, $2, $3, $4, $5)', [id, botRef, mime, bytes.length, bytes])
  },
  async get(id) {
    const rows = await query<{ mime: string; data: Buffer }>('SELECT mime, data FROM webchat_media WHERE id = $1', [id])
    return rows[0] ? { mime: rows[0].mime, bytes: rows[0].data } : null
  },
}
