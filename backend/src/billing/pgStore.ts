// pgStore.ts — Postgres-backed BillingStore (migrations 005 and 006).
// The whole record is kept as JSON: billing reads and writes it as a unit, and the
// only lookups needed are by workspace, by Razorpay subscription id, and "who is in
// dunning".
import { query } from '../db/pool.js'
import type { BillingRecord, BillingStore } from './types.js'

interface Row { data: BillingRecord }

export const pgBillingStore: BillingStore = {
  async get(workspaceId) {
    const rows = await query<Row>('SELECT data FROM billing_records WHERE workspace_id = $1', [workspaceId])
    return rows[0]?.data ?? null
  },
  async put(record) {
    await query(
      `INSERT INTO billing_records (workspace_id, subscription_id, upcoming_subscription_id, in_dunning, data, updated_at)
       VALUES ($1, $2, $3, $4, $5, now())
       ON CONFLICT (workspace_id) DO UPDATE
         SET subscription_id = EXCLUDED.subscription_id,
             upcoming_subscription_id = EXCLUDED.upcoming_subscription_id,
             in_dunning = EXCLUDED.in_dunning,
             data = EXCLUDED.data,
             updated_at = now()`,
      [record.workspaceId, record.subscriptionId ?? null, record.upcoming?.subscriptionId ?? null, record.dunning?.state === 'active', JSON.stringify(record)],
    )
  },
  async findBySubscription(subscriptionId) {
    const rows = await query<Row>(
      'SELECT data FROM billing_records WHERE subscription_id = $1 OR upcoming_subscription_id = $1 LIMIT 1',
      [subscriptionId],
    )
    return rows[0]?.data ?? null
  },
  async listActiveDunning() {
    const rows = await query<Row>('SELECT data FROM billing_records WHERE in_dunning')
    return rows.map((r) => r.data)
  },
  /* One atomic statement: concurrent payments can never be handed the same number. */
  async nextSequence(key) {
    const rows = await query<{ value: string }>(
      `INSERT INTO billing_counters (key, value) VALUES ($1, 1)
       ON CONFLICT (key) DO UPDATE SET value = billing_counters.value + 1
       RETURNING value`,
      [key],
    )
    return Number(rows[0]!.value)
  },
}
