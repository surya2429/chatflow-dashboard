import { Router, type Request, type Response } from 'express'
import { env } from '../config/env.js'
import { logger } from '../config/logger.js'
import { campaignRepository } from '../db/repositories/campaignRepository.js'
import { clickRepository } from '../db/repositories/clickRepository.js'
import { messageRepository } from '../db/repositories/messageRepository.js'
import { createRateLimiter } from '../leads/poweredByLead.js'
import { clickIdOf, destinationWithQuery, readTrackedLink, verifyLinkToken } from '../marketing/trackedLink.js'

export const marketingTrackingRouter = Router()

const allow = createRateLimiter(120, 60_000) // per IP; a phone on a busy mobile network shares one address with many people
const PREVIEW_BOT = /facebookexternalhit|bot|crawler|spider|preview/i // link unfurlers must not count as a customer tapping the button

/**
 * GET /r/:token — the tracked link a marketing message's URL button points to (https://<api-host>/r/{{1}}).
 * Records the click against the exact message, campaign and contact, then forwards to the campaign's destination with
 * every query parameter Meta added (its click_id must reach the destination). The destination comes only from the
 * campaign's own settings, never from the request, so this cannot be used as an open redirect.
 */
marketingTrackingRouter.get('/r/:token', async (req: Request, res: Response) => {
  try {
    if (!allow(req.ip ?? 'unknown')) { res.status(429).send('Too many requests'); return }
    const messageId = verifyLinkToken(String(req.params.token), env.WA_APP_SECRET)
    const message = messageId ? await messageRepository.findById(messageId) : null
    const campaign = message?.campaign_id ? await campaignRepository.findById(message.campaign_id) : null
    const link = readTrackedLink(campaign?.metadata)
    if (!message || !campaign || !link) { res.status(404).send('This link is not valid.'); return }

    if (req.method !== 'HEAD' && !PREVIEW_BOT.test(req.header('user-agent') ?? '')) {
      // never let a bookkeeping failure stand between the customer and the page
      await clickRepository.record({
        campaignId: campaign.id, messageId: message.id, contactId: message.contact_id, phoneNumberId: message.phone_number_id,
        source: 'redirect', clickId: clickIdOf(req.query), occurredAt: new Date(),
      }).catch((err: unknown) => logger.error({ err }, 'Failed to store link click (non-fatal)'))
    }
    res.redirect(302, destinationWithQuery(link.destination, req.query))
  } catch (err) {
    logger.error({ err }, 'Tracked link failed')
    res.status(500).send('Something went wrong.')
  }
})

/**
 * GET /api/whatsapp/campaigns/:id/engagement — what a marketing campaign earned beyond delivery: replies (people and
 * messages), button taps, link clicks and which API carried the messages. Same open-workspace convention as the other /api routes.
 */
marketingTrackingRouter.get('/api/whatsapp/campaigns/:id/engagement', async (req: Request, res: Response) => {
  try {
    const id = String(req.params.id)
    if (!/^[0-9a-f-]{36}$/i.test(id)) { res.status(400).json({ error: 'invalid_request', message: 'That campaign id is not valid.' }); return }
    const e = await campaignRepository.engagement(id)
    if (!e) { res.status(404).json({ error: 'not_found', message: 'Campaign not found.' }); return }
    const rate = (n: number, of: number) => (of > 0 ? Math.round((n / of) * 1000) / 10 : null)
    res.json({
      ...e,
      rates: { delivery: rate(e.delivered, e.sent), read: rate(e.read, e.delivered), reply: rate(e.repliedPeople, e.delivered), linkClick: rate(e.linkClicks, e.delivered) },
      notes: {
        sentViaCloudApi: e.sentViaCloudApi > 0 ? 'Some messages were sent through Cloud API, not the Marketing Messages API (account not onboarded, or a fallback).' : null,
      },
    })
  } catch (err) {
    logger.error({ err }, 'Campaign engagement failed')
    res.status(500).json({ error: 'internal_server_error' })
  }
})
