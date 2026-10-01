import express, { type Express, type NextFunction, type Request, type Response } from 'express'
import { pinoHttp } from 'pino-http'
import { env } from './config/env.js'
import { logger } from './config/logger.js'
import { HttpError } from './http/errors.js'
import { authRouter } from './routes/auth.routes.js'
import { conversationsRouter } from './routes/conversations.routes.js'
import { agentRouter } from './routes/agent.routes.js'
import { webchatRouter } from './routes/webchat.routes.js'
import { internalRouter } from './routes/internal.routes.js'
import { filesRouter } from './routes/files.routes.js'
import { analyticsRouter } from './routes/analytics.routes.js'
import { connectionCount } from './realtime/sseHub.js'
import { pool } from './db/pool.js'

export function createApp(): Express {
  const app = express()
  app.disable('x-powered-by')
  if (env.TRUST_PROXY) app.set('trust proxy', true)

  app.use(pinoHttp({
    logger,
    autoLogging: { ignore: (req) => req.url === '/healthz' || (req.url?.startsWith('/api/events') ?? false) },
  }))
  app.use(express.json({ limit: '256kb' }))

  // The mobile app is not a browser and needs no CORS. This is for the
  // dashboard (and dev tools) calling cross-origin; only listed origins, or
  // any origin in development.
  app.use('/api', (req: Request, res: Response, next: NextFunction) => {
    const origin = req.headers.origin
    if (origin && (env.NODE_ENV === 'development' || env.CORS_ORIGINS.includes(origin))) {
      res.setHeader('Access-Control-Allow-Origin', origin)
      res.setHeader('Vary', 'Origin')
      res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS')
      // Cache-Control and X-Requested-With: XHR-based SSE clients (react-native-sse) send them.
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, Last-Event-ID, Cache-Control, X-Requested-With, X-File-Name')
    }
    if (req.method === 'OPTIONS') { res.sendStatus(204); return }
    next()
  })

  app.get('/healthz', async (_req, res) => {
    try {
      await pool.query('SELECT 1')
      res.json({ ok: true, streams: connectionCount() })
    } catch {
      res.status(503).json({ ok: false })
    }
  })

  app.use('/api', authRouter)
  app.use('/api', filesRouter)
  app.use('/api', webchatRouter)
  app.use('/api', conversationsRouter)
  app.use('/api', agentRouter)
  app.use('/api', analyticsRouter)
  app.use('/internal', internalRouter)

  app.use((req: Request, res: Response) => {
    res.status(404).json({ error: 'not_found', path: req.path })
  })

  // Express error middleware — must have 4 args for Express to recognize it as such.
  app.use((err: unknown, req: Request, res: Response, _next: NextFunction) => {
    if (err instanceof HttpError) {
      res.status(err.status).json({ error: err.code, message: err.message, ...(err.details && { details: err.details }) })
      return
    }
    if ((err as { type?: string }).type === 'entity.parse.failed') {
      res.status(400).json({ error: 'invalid_json' })
      return
    }
    if ((err as { type?: string }).type === 'entity.too.large') {
      res.status(413).json({ error: 'attachment_too_large', message: `Files can be up to ${env.MAX_UPLOAD_MB} MB` })
      return
    }
    logger.error({ err, path: req.path }, 'Unhandled request error')
    if (!res.headersSent) res.status(500).json({ error: 'internal_server_error' })
  })

  return app
}
