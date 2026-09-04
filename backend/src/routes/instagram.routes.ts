import { Router } from 'express'
import { logger } from '../config/logger.js'
import { completeInstagramOAuth } from '../instagram/oauthClient.js'
import { instagramAccountRepository } from '../db/repositories/instagramAccountRepository.js'

export const instagramRouter = Router()

/** GET /instagram/status — does the workspace have a live connected account? Never returns the token. */
instagramRouter.get('/instagram/status', async (_req, res) => {
  try {
    const account = await instagramAccountRepository.findActive()
    if (!account) {
      res.status(200).json({ connected: false })
      return
    }
    res.status(200).json({
      connected: true,
      username: account.username,
      connectedAt: account.connected_at,
      scopes: account.scopes,
    })
  } catch (err) {
    logger.error({ err }, 'Failed to load Instagram connection status')
    res.status(500).json({ error: 'status_lookup_failed' })
  }
})

/**
 * POST /instagram/oauth/callback — redeems the one-time `code` the frontend
 * received on Instagram's redirect (see src/pages/InstagramOAuthCallback.jsx).
 * The frontend already verified the CSRF `state`; this call only ever
 * touches the code, never the state.
 */
instagramRouter.post('/instagram/oauth/callback', async (req, res) => {
  const { code } = req.body as { code?: unknown }
  if (typeof code !== 'string' || !code) {
    res.status(400).json({ error: 'missing_code' })
    return
  }

  try {
    const result = await completeInstagramOAuth(code)
    await instagramAccountRepository.upsert(result)
    res.status(200).json({ connected: true, username: result.username })
  } catch (err) {
    logger.error({ err }, 'Instagram OAuth callback failed')
    res.status(502).json({ error: 'instagram_oauth_failed' })
  }
})

/** POST /instagram/disconnect — soft-disconnects the active account. */
instagramRouter.post('/instagram/disconnect', async (_req, res) => {
  try {
    const account = await instagramAccountRepository.findActive()
    if (account) await instagramAccountRepository.disconnect(account.ig_user_id)
    res.status(200).json({ connected: false })
  } catch (err) {
    logger.error({ err }, 'Failed to disconnect Instagram account')
    res.status(500).json({ error: 'disconnect_failed' })
  }
})
