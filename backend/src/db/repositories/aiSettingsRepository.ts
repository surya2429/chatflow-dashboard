import { query } from '../pool.js'
import type { AiStore, Provider } from '../../ai/aiAssistant.js'

export const aiSettingsRepository: AiStore = {
  async load(workspace) {
    const r = await query<{ provider: Provider; model: string; api_key_enc: string }>(
      `SELECT provider, model, api_key_enc FROM ai_settings WHERE workspace_id = $1`, [workspace])
    const row = r[0]
    return row ? { provider: row.provider, model: row.model, keyEnc: row.api_key_enc } : null
  },
  async save(workspace, s) {
    await query(
      `INSERT INTO ai_settings (workspace_id, provider, model, api_key_enc) VALUES ($1, $2, $3, $4)
       ON CONFLICT (workspace_id) DO UPDATE SET provider = $2, model = $3, api_key_enc = $4, updated_at = now()`,
      [workspace, s.provider, s.model, s.keyEnc])
  },
  async remove(workspace) {
    await query(`DELETE FROM ai_settings WHERE workspace_id = $1`, [workspace])
  },
}
