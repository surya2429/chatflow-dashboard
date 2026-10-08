// pgStore.ts — Postgres-backed BillingStore (migration 005_billing_records.sql).
// The whole record is kept as JSON: billing reads and writes it as a unit, and the
// only lookups needed are by workspace and by Razorpay subscription id.
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
      `INSERT INTO billing_records (workspace_id, subscription_id, upcoming_subscription_id, data, updated_at)
       VALUES ($1, $2, $3, $4, now())
       ON CONFLICT (workspace_id) DO UPDATE
         SET subscription_id = EXCLUDED.subscription_id,
             upcoming_subscription_id = EXCLUDED.upcoming_subscription_id,
             data = EXCLUDED.data,
             updated_at = now()`,
      [record.workspaceId, record.subscriptionId ?? null, record.upcoming?.subscriptionId ?? null, JSON.stringify(record)],
    )
  },
  async findBySubscription(subscriptionId) {
    const rows = await query<Row>(
      'SELECT data FROM billing_records WHERE subscription_id = $1 OR upcoming_subscription_id = $1 LIMIT 1',
      [subscriptionId],
    )
    return rows[0]?.data ?? null
  },
}
