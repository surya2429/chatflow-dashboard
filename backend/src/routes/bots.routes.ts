import { Router } from 'express'
import { z } from 'zod'
import { logger } from '../config/logger.js'
import { botRepository } from '../db/repositories/botRepository.js'
import { addSubscriber, publishConfigChange } from '../services/botConfigStream.js'

export const botsRouter = Router()

/* Until requests carry an authenticated client, a single workspace stands in
   for one — same assumption instagram.routes.ts already makes. */
const DEFAULT_CLIENT_ID = '00000000-0000-0000-0000-000000000001'
const DEFAULT_BOT_NAME = 'Support Bot'

const createBotSchema = z.object({
  clientId: z.string().uuid(),
  name: z.string().trim().min(1).max(256),
  channel: z.string().trim().max(32).optional(),
})

// The id in an install snippet is a plain integer, so validate it as one
// before it reaches a BIGINT column — `?id=' OR 1=1` should be a 400 here,
// not a parameterised query that quietly returns nothing.
const botNumberSchema = z.string().regex(/^\d{1,18}$/)

/**
 * POST /api/bots — create a bot for a client.
 *
 * The response's `botNumber` is assigned by the database, not chosen here.
 * Callers must use what comes back rather than predicting the next value:
 * between any two requests another client may have taken it.
 */
botsRouter.post('/bots', async (req, res) => {
  const parsed = createBotSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ error: 'invalid_request', details: parsed.error.flatten() })
    return
  }

  try {
    const bot = await botRepository.create(parsed.data)
    res.status(201).json({
      id: bot.id,
      botNumber: bot.bot_number,
      clientId: bot.client_id,
      name: bot.name,
      channel: bot.channel,
      createdAt: bot.created_at,
    })
  } catch (err) {
    logger.error({ err }, 'Failed to create bot')
    res.status(500).json({ error: 'bot_create_failed' })
  }
})

/**
 * GET /api/bots/current — the bot the dashboard is configuring, provisioning
 * one if this workspace has none so the install snippet always has a real id.
 *
 * Declared BEFORE /bots/:botNumber, or Express would match "current" as a bot
 * number and the route below would 400 on it.
 */
botsRouter.get('/bots/current', async (_req, res) => {
  try {
    const bot = await botRepository.findOrCreateCurrent(DEFAULT_CLIENT_ID, DEFAULT_BOT_NAME)
    res.status(200).json({
      id: bot.id,
      botNumber: bot.bot_number,
      name: bot.name,
      channel: bot.channel,
    })
  } catch (err) {
    logger.error({ err }, 'Failed to load current bot')
    res.status(500).json({ error: 'bot_lookup_failed' })
  }
})

/** GET /api/bots/:botNumber — resolve the id a widget snippet was installed with. */
botsRouter.get('/bots/:botNumber', async (req, res) => {
  const parsed = botNumberSchema.safeParse(req.params.botNumber)
  if (!parsed.success) {
    res.status(400).json({ error: 'invalid_bot_number' })
    return
  }

  try {
    const bot = await botRepository.findByNumber(parsed.data)
    if (!bot) {
      res.status(404).json({ error: 'bot_not_found' })
      return
    }
    // Public-ish endpoint — the widget itself calls it — so this returns only
    // what a widget needs to render, never the owning client's other bots.
    res.status(200).json({
      botNumber: bot.bot_number,
      name: bot.name,
      channel: bot.channel,
      config: bot.config,
    })
  } catch (err) {
    logger.error({ err, botNumber: req.params.botNumber }, 'Failed to load bot')
    res.status(500).json({ error: 'bot_lookup_failed' })
  }
})

/** GET /api/clients/:clientId/bots — a client's own bots, oldest first. */
botsRouter.get('/clients/:clientId/bots', async (req, res) => {
  const parsed = z.string().uuid().safeParse(req.params.clientId)
  if (!parsed.success) {
    res.status(400).json({ error: 'invalid_client_id' })
    return
  }

  try {
    const bots = await botRepository.listForClient(parsed.data)
    res.status(200).json({
      bots: bots.map((bot) => ({
        id: bot.id,
        botNumber: bot.bot_number,
        name: bot.name,
        channel: bot.channel,
        createdAt: bot.created_at,
      })),
    })
  } catch (err) {
    logger.error({ err, clientId: req.params.clientId }, 'Failed to list bots')
    res.status(500).json({ error: 'bot_list_failed' })
  }
})


/* ─── Live config ────────────────────────────────────────────────────────
 * The widget installed on a merchant's website reads its design/flow from
 * here, and stays subscribed for changes. This is why a merchant never
 * re-pastes the snippet to pick up an edit: the snippet only ever carried the
 * bot id, and everything else is fetched at runtime against that id.
 */

/** GET /api/bots/:botNumber/config — what an installed widget loads on boot. */
botsRouter.get('/bots/:botNumber/config', async (req, res) => {
  const parsed = botNumberSchema.safeParse(req.params.botNumber)
  if (!parsed.success) {
    res.status(400).json({ error: 'invalid_bot_number' })
    return
  }
  try {
    const bot = await botRepository.findByNumber(parsed.data)
    if (!bot) {
      res.status(404).json({ error: 'bot_not_found' })
      return
    }
    // Widgets live on merchant domains, so every config read is cross-origin.
    res.setHeader('Access-Control-Allow-Origin', '*')
    res.status(200).json({
      botNumber: bot.bot_number,
      version: bot.config_version,
      config: bot.config,
    })
  } catch (err) {
    logger.error({ err, botNumber: req.params.botNumber }, 'Failed to read bot config')
    res.status(500).json({ error: 'config_read_failed' })
  }
})

/**
 * PATCH /api/bots/:botNumber/config — the dashboard saving an edit.
 *
 * Merges rather than replaces, so two people editing different sections of the
 * builder at once do not overwrite each other wholesale.
 */
botsRouter.patch('/bots/:botNumber/config', async (req, res) => {
  const parsedNumber = botNumberSchema.safeParse(req.params.botNumber)
  if (!parsedNumber.success) {
    res.status(400).json({ error: 'invalid_bot_number' })
    return
  }
  const patch = req.body as unknown
  if (typeof patch !== 'object' || patch === null || Array.isArray(patch)) {
    res.status(400).json({ error: 'invalid_config' })
    return
  }

  try {
    const bot = await botRepository.updateConfig(parsedNumber.data, patch as Record<string, unknown>)
    if (!bot) {
      res.status(404).json({ error: 'bot_not_found' })
      return
    }
    // Fan out only after the write has committed — a widget must never be told
    // about a change that then fails to persist.
    await publishConfigChange({
      botNumber: bot.bot_number,
      version: bot.config_version,
      config: bot.config,
    })
    res.status(200).json({ version: bot.config_version, config: bot.config })
  } catch (err) {
    logger.error({ err, botNumber: req.params.botNumber }, 'Failed to update bot config')
    res.status(500).json({ error: 'config_write_failed' })
  }
})

/**
 * GET /api/bots/:botNumber/events — the live stream an installed widget holds
 * open. Sends the current config immediately, then every change as it lands.
 */
botsRouter.get('/bots/:botNumber/events', async (req, res) => {
  const parsed = botNumberSchema.safeParse(req.params.botNumber)
  if (!parsed.success) {
    res.status(400).json({ error: 'invalid_bot_number' })
    return
  }
  try {
    const bot = await botRepository.findByNumber(parsed.data)
    if (!bot) {
      res.status(404).json({ error: 'bot_not_found' })
      return
    }
    // Never buffered, never timed out by Express's own response handling.
    req.socket.setTimeout(0)
    req.socket.setNoDelay(true)
    req.socket.setKeepAlive(true)
    addSubscriber(bot.bot_number, res, {
      botNumber: bot.bot_number,
      version: bot.config_version,
      config: bot.config,
    })
  } catch (err) {
    logger.error({ err, botNumber: req.params.botNumber }, 'Failed to open config stream')
    if (!res.headersSent) res.status(500).json({ error: 'stream_failed' })
  }
})
