import { env } from '../config/env.js'
import { logger } from '../config/logger.js'
import { query } from '../db/pool.js'
import { refreshTokenRepository } from '../db/repositories/refreshTokenRepository.js'
import { attachmentRepository } from '../db/repositories/attachmentRepository.js'
import { fileStore } from '../storage/fileStore.js'
import { demoteIdleAgents } from './routingService.js'

/**
 * Periodic housekeeping. Every task is idempotent, so running it on several
 * instances at once is wasteful but harmless.
 */
const EVENT_RETENTION_DAYS = 3

export function startSweeper(): () => void {
  const tick = async () => {
    try {
      const demoted = await demoteIdleAgents(env.PRESENCE_AWAY_AFTER_SECONDS)
      if (demoted) logger.info({ demoted }, '[sweeper] idle agents set to away')
      await query(`DELETE FROM inbox_events WHERE created_at < now() - make_interval(days => $1)`, [EVENT_RETENTION_DAYS])
      await refreshTokenRepository.pruneExpired()
      // Files attached in the composer but never sent.
      for (const a of await attachmentRepository.takeAbandoned(24)) await fileStore.remove(a.storage_key)
    } catch (err) {
      logger.error({ err }, '[sweeper] tick failed')
    }
  }
  const handle = setInterval(() => { void tick() }, 60_000)
  void tick()
  return () => clearInterval(handle)
}
