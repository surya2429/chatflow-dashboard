import pino from 'pino'
import { env } from './env.js'

export const logger = pino({
  level: env.LOG_LEVEL,
  transport: env.NODE_ENV === 'development'
    ? { target: 'pino-pretty', options: { colorize: true, translateTime: 'HH:MM:ss.l' } }
    : undefined,
  base: { service: 'chatflow-agent-api' },
  // Bearer tokens and passwords must never reach log storage.
  redact: ['req.headers.authorization', 'req.query.access_token', 'req.query.token', 'password', 'refreshToken'],
})
