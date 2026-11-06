import { query } from '../pool.js'
import type { ConnectionStore, StoredConnection } from '../../ctwa/connect.js'

interface Row {
  token_enc: string; user_name: string | null; business_id: string | null; ad_accounts: StoredConnection['adAccounts']; pages: StoredConnection['pages']
  wabas: StoredConnection['wabas']; dataset_id: string | null; selected: StoredConnection['selected']; connected_at: Date
}

export const ctwaConnectionRepository: ConnectionStore = {
  async load(workspace) {
    const r = (await query<Row>(`SELECT * FROM ctwa_connections WHERE workspace_id = $1`, [workspace]))[0]
    return r ? { tokenEnc: r.token_enc, userName: r.user_name, businessId: r.business_id, adAccounts: r.ad_accounts, pages: r.pages, wabas: r.wabas, datasetId: r.dataset_id, selected: { adAccountId: r.selected?.adAccountId ?? null, pageId: r.selected?.pageId ?? null, wabaId: r.selected?.wabaId ?? null }, connectedAt: r.connected_at.toISOString() } : null
  },
  async save(workspace, c) {
    await query(
      `INSERT INTO ctwa_connections (workspace_id, token_enc, user_name, business_id, ad_accounts, pages, wabas, dataset_id, selected, connected_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
       ON CONFLICT (workspace_id) DO UPDATE SET token_enc = $2, user_name = $3, business_id = $4, ad_accounts = $5, pages = $6, wabas = $7, dataset_id = $8, selected = $9, connected_at = $10, updated_at = now()`,
      [workspace, c.tokenEnc, c.userName, c.businessId, JSON.stringify(c.adAccounts), JSON.stringify(c.pages), JSON.stringify(c.wabas), c.datasetId, JSON.stringify(c.selected), c.connectedAt])
  },
  async remove(workspace) { await query(`DELETE FROM ctwa_connections WHERE workspace_id = $1`, [workspace]) },
}
