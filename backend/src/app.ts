import express, { type Express, type NextFunction, type Request, type Response } from 'express'
import { pinoHttp } from 'pino-http'
import { logger } from './config/logger.js'
import { webhookRouter } from './routes/webhook.routes.js'
import { healthRouter } from './routes/health.routes.js'
import { instagramRouter } from './routes/instagram.routes.js'
import { botsRouter } from './routes/bots.routes.js'
import { billingRouter } from './routes/billing.routes.js'
import { whatsappReportsRouter } from './routes/whatsappReports.routes.js'
import { messageLinksRouter } from './routes/messageLinks.routes.js'
import { leadsRouter } from './routes/leads.routes.js'
import { transcriptsRouter } from './routes/transcripts.routes.js'
import { aiRouter } from './routes/ai.routes.js'
import { ctwaRouter } from './routes/ctwa.routes.js'
import { catalogRouter } from './routes/catalog.routes.js'
import { marketingTrackingRouter } from './routes/marketingTracking.routes.js'
import { mediaRouter } from './routes/media.routes.js'
import { MAX_UPLOAD_BYTES } from './media/media.js'

export function createApp(): Express {
  const app = express()

  app.use(pinoHttp({ logger, autoLogging: { ignore: (req) => req.url === '/healthz' } }))

  // Files staff attach in the admin panel arrive as base64 JSON (up to 2 MB a file); every other
  // request keeps the default 100 KB limit below.
  app.use('/api/billing/admin/documents', express.json({ limit: '3mb' }))

  // The AI route reads a larger body (trimmed conversations); it must be parsed before the 100 KB parser below.
  app.use('/api/ai/run', express.json({ limit: '400kb' }))
  // Creating a Click-to-WhatsApp ad can carry the uploaded image (up to 4 MB, as base64).
  app.use('/api/whatsapp/ctwa/ads', express.json({ limit: '8mb' }))
  // Photos and videos for the website chat arrive as the raw file bytes (up to 40 MB), not JSON.
  app.use('/api/webchat-media', express.raw({ type: () => true, limit: MAX_UPLOAD_BYTES }))
  // Importing a catalog file sends up to 1000 products at once.
  app.use('/api/whatsapp/catalog/products/import', express.json({ limit: '2mb' }))

  // Capture the exact raw bytes of the request body *before* JSON parsing —
  // signature verification (HMAC over raw bytes) would silently break if we
  // instead re-serialized `req.body` here, since key order / whitespace
  // aren't guaranteed to round-trip identically.
  app.use(
    express.json({
      verify: (req: Request, _res: Response, buf: Buffer) => {
        req.rawBody = Buffer.from(buf)
      },
    }),
  )

  // Minimal CORS for the /api/* routes the frontend SPA calls cross-origin in
  // dev (e.g. Vite on :5173 hitting this on :8080). In production the SPA is
  // typically proxied same-origin, making this a no-op.
  app.use('/api', (req: Request, res: Response, next: NextFunction) => {
    res.setHeader('Access-Control-Allow-Origin', req.headers.origin ?? '*')
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS')
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type,X-Workspace-Id')
    if (req.method === 'OPTIONS') { res.sendStatus(204); return }
    next()
  })

  app.use(healthRouter)
  app.use(webhookRouter)
  app.use('/api', instagramRouter)
  app.use('/api', botsRouter)
  app.use('/api', billingRouter)
  app.use('/api', whatsappReportsRouter)
  app.use('/api', messageLinksRouter)
  app.use('/api', leadsRouter)
  app.use('/api', transcriptsRouter)
  app.use('/api', aiRouter)
  app.use('/api', ctwaRouter)
  app.use('/api', catalogRouter)
  app.use(marketingTrackingRouter)
  app.use(mediaRouter)

  app.use((req: Request, res: Response) => {
    res.status(404).json({ error: 'not_found', path: req.path })
  })

  // Express error middleware — must have 4 args for Express to recognize it as such.
  app.use((err: unknown, req: Request, res: Response, _next: NextFunction) => {
    logger.error({ err, path: req.path }, 'Unhandled request error')
    res.status(500).json({ error: 'internal_server_error' })
  })

  return app
}
