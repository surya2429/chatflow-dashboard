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
      `INSERT INTO billing_records (workspace_id, subscription_id, upcoming_subscription_id, in_dunning, token_autopay, data, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, now())
       ON CONFLICT (workspace_id) DO UPDATE
         SET subscription_id = EXCLUDED.subscription_id,
             upcoming_subscription_id = EXCLUDED.upcoming_subscription_id,
             in_dunning = EXCLUDED.in_dunning,
             token_autopay = EXCLUDED.token_autopay,
             data = EXCLUDED.data,
             updated_at = now()`,
      [record.workspaceId, record.subscriptionId ?? null, record.upcoming?.subscriptionId ?? null, record.dunning?.state === 'active', record.engine === 'token' && Boolean(record.mandate && record.renewal), JSON.stringify(record)],
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
  async listTokenAutopay() {
    const rows = await query<Row>('SELECT data FROM billing_records WHERE token_autopay')
    return rows.map((r) => r.data)
  },
  // shortcut: unpaginated, fine for a few thousand customers; add LIMIT/OFFSET when the list gets big.
  async list() {
    const rows = await query<Row>('SELECT data FROM billing_records ORDER BY updated_at DESC')
    return rows.map((r) => r.data)
  },
  async getDoc<T>(key: string) {
    const rows = await query<{ data: T }>('SELECT data FROM billing_docs WHERE key = $1', [key])
    return rows[0]?.data ?? null
  },
  async putDoc(key, value) {
    await query(
      `INSERT INTO billing_docs (key, data, updated_at) VALUES ($1, $2, now())
       ON CONFLICT (key) DO UPDATE SET data = EXCLUDED.data, updated_at = now()`,
      [key, JSON.stringify(value)],
    )
  },
  async addUsage(workspaceId, day, metric, qty) {
    await query(
      `INSERT INTO billing_usage (workspace_id, day, metric, value) VALUES ($1, $2, $3, $4)
       ON CONFLICT (workspace_id, day, metric) DO UPDATE SET value = billing_usage.value + EXCLUDED.value`,
      [workspaceId, day, metric, qty],
    )
  },
  async usage(fromDay, workspaceId) {
    const rows = await query<{ workspace_id: string; day: string; metric: string; value: string }>(
      `SELECT workspace_id, to_char(day, 'YYYY-MM-DD') AS day, metric, value FROM billing_usage
       WHERE day >= $1::date AND ($2::text IS NULL OR workspace_id = $2)`,
      [fromDay, workspaceId ?? null],
    )
    return rows.map((r) => ({ workspaceId: r.workspace_id, day: r.day, metric: r.metric, value: Number(r.value) }))
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
