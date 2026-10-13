// fileStore.ts — a JSON-file BillingStore for local development, where standing
// up Postgres just to try a payment would be overkill. Production uses pgStore.
//
// Layout: { "<workspaceId>": BillingRecord, …, "__counters": { "<key>": number }, "__docs": { "<key>": any } }
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import type { BillingRecord, BillingStore } from './types.js'

const COUNTERS = '__counters'
const DOCS = '__docs'
const USAGE = '__usage'

export function createFileBillingStore(file: string): BillingStore {
  const read = (): Record<string, unknown> => {
    if (!existsSync(file)) return {}
    try { return JSON.parse(readFileSync(file, 'utf8')) } catch { return {} }   // corrupt dev file: start over
  }
  const write = (all: Record<string, unknown>) => writeFileSync(file, JSON.stringify(all, null, 2))
  const records = (all: Record<string, unknown>) => Object.entries(all).filter(([k]) => !k.startsWith('__')).map(([, v]) => v as BillingRecord)

  return {
    async get(workspaceId) { return workspaceId.startsWith('__') ? null : (read()[workspaceId] as BillingRecord | undefined) ?? null },
    async put(record) {
      // "__" keys hold counters and docs; a workspace id like that would overwrite them.
      if (record.workspaceId.startsWith('__')) throw new Error('Workspace ids may not start with "__".')
      const all = read(); all[record.workspaceId] = record; write(all)
    },
    async findBySubscription(subscriptionId) {
      return records(read()).find((r) => r.subscriptionId === subscriptionId || r.upcoming?.subscriptionId === subscriptionId) ?? null
    },
    async listActiveDunning() { return records(read()).filter((r) => r.dunning?.state === 'active') },
    async listTokenAutopay() { return records(read()).filter((r) => r.engine === 'token' && r.mandate && r.renewal) },
    async list() { return records(read()).sort((a, b) => b.updatedAt - a.updatedAt) },
    async getDoc(key) { return ((read()[DOCS] as Record<string, never> | undefined)?.[key]) ?? null },
    async putDoc(key, value) {
      const all = read()
      all[DOCS] = { ...(all[DOCS] as object | undefined), [key]: value }
      write(all)
    },
    // Layout: "__usage": { "<workspaceId>|<day>|<metric>": number }
    async addUsage(workspaceId, day, metric, qty) {
      const all = read()
      const u = (all[USAGE] as Record<string, number> | undefined) ?? {}
      const k = `${workspaceId}|${day}|${metric}`
      u[k] = (u[k] ?? 0) + qty
      all[USAGE] = u
      write(all)
    },
    async usage(fromDay, workspaceId) {
      return Object.entries((read()[USAGE] as Record<string, number> | undefined) ?? {})
        .map(([k, value]) => { const [ws, day, metric] = k.split('|') as [string, string, string]; return { workspaceId: ws, day, metric, value } })
        .filter((r) => r.day >= fromDay && (!workspaceId || r.workspaceId === workspaceId))
    },
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
