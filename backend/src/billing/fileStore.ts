// fileStore.ts — a JSON-file BillingStore for local development, where standing
// up Postgres just to try a payment would be overkill. Production uses pgStore.
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import type { BillingRecord, BillingStore } from './types.js'

export function createFileBillingStore(file: string): BillingStore {
  const read = (): Record<string, BillingRecord> => {
    if (!existsSync(file)) return {}
    try { return JSON.parse(readFileSync(file, 'utf8')) } catch { return {} }   // corrupt dev file: start over
  }
  const write = (all: Record<string, BillingRecord>) => writeFileSync(file, JSON.stringify(all, null, 2))

  return {
    async get(workspaceId) { return read()[workspaceId] ?? null },
    async put(record) { const all = read(); all[record.workspaceId] = record; write(all) },
    async findBySubscription(subscriptionId) {
      return Object.values(read()).find((r) => r.subscriptionId === subscriptionId || r.upcoming?.subscriptionId === subscriptionId) ?? null
    },
  }
}
