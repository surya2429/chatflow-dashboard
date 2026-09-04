// Structured console logger — swap for Winston/Pino in production
const LEVELS = { error: 0, warn: 1, info: 2, debug: 3 }
const current = LEVELS[process.env.LOG_LEVEL?.toLowerCase()] ?? LEVELS.info

function log(level, module, message, data) {
  if (LEVELS[level] > current) return
  const entry = {
    ts:      new Date().toISOString(),
    level:   level.toUpperCase(),
    module,
    message,
    ...(data !== undefined && { data }),
  }
  const fn = level === 'error' ? console.error : level === 'warn' ? console.warn : console.log
  fn(JSON.stringify(entry))
}

export const createLogger = (module) => ({
  info:  (msg, data) => log('info',  module, msg, data),
  warn:  (msg, data) => log('warn',  module, msg, data),
  error: (msg, data) => log('error', module, msg, data),
  debug: (msg, data) => log('debug', module, msg, data),
})
