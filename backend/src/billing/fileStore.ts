// fileStore.ts — a JSON-file BillingStore for local development, where standing
// up Postgres just to try a payment would be overkill. Production uses pgStore.
//
// Layout: { "<workspaceId>": BillingRecord, …, "__counters": { "<key>": number } }
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import type { BillingRecord, BillingStore } from './types.js'

const COUNTERS = '__counters'

export function createFileBillingStore(file: string): BillingStore {
  const read = (): Record<string, unknown> => {
    if (!existsSync(file)) return {}
    try { return JSON.parse(readFileSync(file, 'utf8')) } catch { return {} }   // corrupt dev file: start over
  }
  const write = (all: Record<string, unknown>) => writeFileSync(file, JSON.stringify(all, null, 2))
  const records = (all: Record<string, unknown>) => Object.entries(all).filter(([k]) => k !== COUNTERS).map(([, v]) => v as BillingRecord)

  return {
    async get(workspaceId) { return (read()[workspaceId] as BillingRecord | undefined) ?? null },
    async put(record) { const all = read(); all[record.workspaceId] = record; write(all) },
    async findBySubscription(subscriptionId) {
      return records(read()).find((r) => r.subscriptionId === subscriptionId || r.upcoming?.subscriptionId === subscriptionId) ?? null
    },
    async listActiveDunning() { return records(read()).filter((r) => r.dunning?.state === 'active') },
    async listTokenAutopay() { return records(read()).filter((r) => r.engine === 'token' && r.mandate && r.renewal) },
    // Single dev process, synchronous read-modify-write: no two callers can interleave.
    async nextSequence(key) {
      const all = read()
      const counters = (all[COUNTERS] as Record<string, number> | undefined) ?? {}
      counters[key] = (counters[key] ?? 0) + 1
      all[COUNTERS] = counters
      write(all)
      return counters[key]!
    },
  }
}
