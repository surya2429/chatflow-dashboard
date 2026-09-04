/**
 * MODULE 9 — callAnalytics.js
 * Call analytics — Graph API + local call record aggregation.
 *
 * Graph API returns: cost, completed call counts, average duration per WABA.
 * Call Logs (WhatsApp Manager) provide:
 *   Timestamp, Direction, Signaling protocol, Call ID, Request ID, Event timeline
 */
import api from '../utils/apiClient.js'
import { config } from '../config.js'
import { callStore } from '../utils/callStore.js'
import { createLogger } from '../utils/logger.js'

const log = createLogger('callAnalytics')

// ── getCallAnalytics ──────────────────────────────────────────────────────────
/**
 * GET /{WABA_ID}?fields=call_analytics
 * Returns cost, counts of completed calls, and average call duration for the WABA.
 *
 * @returns {Promise<object>}
 */
export async function getCallAnalytics() {
  log.info('Fetching call analytics from Graph API')
  return api.get(`/${config.wabaId}`, {
    params: { fields: 'call_analytics' },
  })
}

// ── getLocalStats ─────────────────────────────────────────────────────────────
/**
 * Compute analytics from in-memory call store (session-level stats).
 * In production, persist call records to a database for historical analytics.
 *
 * @returns {object} Local call stats
 */
export function getLocalStats() {
  const calls   = callStore.getAll()
  const now     = Date.now()

  const stats = {
    activeCalls:    0,
    completedCalls: 0,
    failedCalls:    0,
    totalCalls:     calls.length,
    byDirection:    { BUSINESS_INITIATED: 0, USER_INITIATED: 0 },
    avgDuration:    0,
    totalDuration:  0,
  }

  let durationCount = 0

  for (const call of calls) {
    if (['ACCEPTED', 'PRE_ACCEPTED', 'RINGING', 'CONNECTING', 'INCOMING'].includes(call.status)) {
      stats.activeCalls++
    }
    if (call.status === 'COMPLETED') {
      stats.completedCalls++
      if (call.duration) {
        stats.totalDuration += call.duration
        durationCount++
      }
    }
    if (call.status === 'FAILED') stats.failedCalls++
    if (call.direction) stats.byDirection[call.direction] = (stats.byDirection[call.direction] || 0) + 1
  }

  stats.avgDuration = durationCount > 0
    ? Math.round(stats.totalDuration / durationCount)
    : 0

  return stats
}

// ── recordCallCompletion ──────────────────────────────────────────────────────
/**
 * Update call store with terminal data from the terminate webhook.
 * Called by the webhook handler when a terminate event arrives.
 *
 * @param {object} terminateEvent — Parsed terminate webhook payload
 */
export function recordCallCompletion(terminateEvent) {
  const { id, status, start_time, end_time, duration, errors } = terminateEvent
  callStore.upsert(id, {
    status:    status === 'COMPLETED' ? 'COMPLETED' : 'FAILED',
    startTime: start_time,
    endTime:   end_time,
    duration,
    errors,
    completedAt: Date.now(),
  })
  log.info(`Call ${id} completed`, { status, duration })
}

// ── Express router ────────────────────────────────────────────────────────────
import { Router } from 'express'
export const analyticsRouter = Router()

analyticsRouter.get('/', async (req, res, next) => {
  try {
    const [graphData, localStats] = await Promise.allSettled([
      getCallAnalytics(),
      Promise.resolve(getLocalStats()),
    ])

    res.json({
      graph:  graphData.status  === 'fulfilled' ? graphData.value  : { error: graphData.reason?.message },
      local:  localStats.status === 'fulfilled' ? localStats.value : { error: localStats.reason?.message },
    })
  } catch (e) { next(e) }
})

analyticsRouter.get('/local', (req, res) => {
  res.json(getLocalStats())
})
