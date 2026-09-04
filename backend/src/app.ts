import express, { type Express, type NextFunction, type Request, type Response } from 'express'
import { pinoHttp } from 'pino-http'
import { logger } from './config/logger.js'
import { webhookRouter } from './routes/webhook.routes.js'
import { healthRouter } from './routes/health.routes.js'
import { instagramRouter } from './routes/instagram.routes.js'

export function createApp(): Express {
  const app = express()

  app.use(pinoHttp({ logger, autoLogging: { ignore: (req) => req.url === '/healthz' } }))

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
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS')
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
    if (req.method === 'OPTIONS') { res.sendStatus(204); return }
    next()
  })

  app.use(healthRouter)
  app.use(webhookRouter)
  app.use('/api', instagramRouter)

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
