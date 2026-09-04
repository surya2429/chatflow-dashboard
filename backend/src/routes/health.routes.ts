import { Router } from 'express'
import { pool } from '../db/pool.js'
import { redis } from '../redis/client.js'

export const healthRouter = Router()

healthRouter.get('/healthz', (_req, res) => {
  res.status(200).json({ ok: true })
})

/** Deeper check for orchestrators (k8s readiness probe) — verifies both dependencies actually respond. */
healthRouter.get('/readyz', async (_req, res) => {
  try {
    await Promise.all([pool.query('SELECT 1'), redis.ping()])
    res.status(200).json({ ok: true })
  } catch (err) {
    res.status(503).json({ ok: false, error: err instanceof Error ? err.message : 'unknown error' })
  }
})
