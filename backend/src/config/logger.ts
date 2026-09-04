import pino from 'pino'
import { env } from './env.js'

export const logger = pino({
  level: env.LOG_LEVEL,
  transport: env.NODE_ENV === 'development'
    ? { target: 'pino-pretty', options: { colorize: true, translateTime: 'HH:MM:ss.l' } }
    : undefined,
  base: { service: 'chatflow-wa-backend' },
})

export function childLogger(bindings: Record<string, unknown>) {
  return logger.child(bindings)
}
