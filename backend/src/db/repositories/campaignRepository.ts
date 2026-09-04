import { query } from '../pool.js'

export type CampaignStatus = 'draft' | 'scheduled' | 'sending' | 'completed' | 'failed' | 'cancelled'

export interface Campaign {
  id: string
  name: string
  channel: 'mm_lite' | 'cloud_api'
  template_name: string
  template_language: string
  status: CampaignStatus
  phone_number_id: string
  target_count: number
  queued_count: number
  sent_count: number
  delivered_count: number
  read_count: number
  replied_count: number
  failed_count: number
  pacing_per_second: number
}

type CounterField = 'queued_count' | 'sent_count' | 'delivered_count' | 'read_count' | 'replied_count' | 'failed_count'

export const campaignRepository = {
  async findById(id: string): Promise<Campaign | null> {
    const rows = await query<Campaign>('SELECT * FROM campaigns WHERE id = $1', [id])
    return rows[0] ?? null
  },

  async markStatus(id: string, status: CampaignStatus): Promise<void> {
    const timestampCol = status === 'sending' ? 'started_at' : status === 'completed' ? 'completed_at' : null
    await query(
      `UPDATE campaigns SET status = $2 ${timestampCol ? `, ${timestampCol} = now()` : ''} WHERE id = $1`,
      [id, status],
    )
  },

  /**
   * Atomic counter bump — called from the status-update worker on every
   * delivery/read/reply/failure event. Uses a single UPDATE ... increment
   * rather than read-modify-write to stay correct under concurrent workers.
   */
  async incrementCounter(id: string, field: CounterField, by = 1): Promise<void> {
    // field is from a closed enum above, never user input — safe to interpolate the column name.
    await query(`UPDATE campaigns SET ${field} = ${field} + $2 WHERE id = $1`, [id, by])
  },
}
