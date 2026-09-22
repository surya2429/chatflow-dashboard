import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const __dirname = dirname(fileURLToPath(import.meta.url))

/**
 * Dev-only stand-in for backend/src/routes/bots.routes.ts.
 *
 * Bot numbers come from one sequence across the whole platform, so they can
 * only be handed out by something that knows what the last one was — never by
 * a browser tab. In production that is PostgreSQL's bot_number_seq. Running
 * the dashboard locally shouldn't require standing up Postgres just to see an
 * id in the install snippet, so this serves the SAME endpoints from the dev
 * server under the same rule: one counter, allocated server-side, persisted
 * across restarts, never reused.
 *
 * The point is that the frontend exercises the identical code path it will in
 * production — fetch, wait, render what came back — instead of carrying a
 * "generate one locally" branch that only runs in dev and quietly invents ids.
 *
 * Never fires when VITE_API_BASE_URL points at a real backend: the frontend
 * then calls that origin instead of this one.
 */
const SEQUENCE_FILE = join(__dirname, '.dev-bot-sequence.json')

function readSequence() {
  if (!existsSync(SEQUENCE_FILE)) return { nextBotNumber: 1, bots: [] }
  try {
    const parsed = JSON.parse(readFileSync(SEQUENCE_FILE, 'utf8'))
    return {
      nextBotNumber: Number(parsed.nextBotNumber) || 1,
      bots: Array.isArray(parsed.bots) ? parsed.bots : [],
    }
  } catch {
    // Corrupt file — start over rather than crash the dev server. Losing a
    // local dev id is harmless; refusing to boot is not.
    return { nextBotNumber: 1, bots: [] }
  }
}

function allocateBot(name, channel = 'webchat') {
  const state = readSequence()
  const bot = {
    id: `dev-${state.nextBotNumber}`,
    botNumber: String(state.nextBotNumber),
    name,
    channel,
    config: {},
    configVersion: 1,
    createdAt: new Date().toISOString(),
  }
  state.bots.push(bot)
  state.nextBotNumber += 1
  writeFileSync(SEQUENCE_FILE, JSON.stringify(state, null, 2))
  return bot
}

/* Open SSE responses, keyed by bot number — the dev-server stand-in for
   botConfigStream.ts. One process, so no Redis fan-out is needed here; the
   wire format is identical, which is the part the client depends on. */
const configStreams = new Map()

function writeConfigEvent(res, version, config) {
  res.write(`id: ${version}\nevent: config\ndata: ${JSON.stringify({ version, config })}\n\n`)
}

function broadcastConfig(botNumber, version, config) {
  const listeners = configStreams.get(botNumber)
  if (!listeners) return
  for (const res of listeners) {
    try { writeConfigEvent(res, version, config) } catch { listeners.delete(res) }
  }
}

function readBody(req) {
  return new Promise((resolve) => {
    let body = ''
    req.on('data', (chunk) => { body += chunk })
    req.on('end', () => {
      try { resolve(JSON.parse(body || '{}')) } catch { resolve({}) }
    })
  })
}

function devBotsApi() {
  return {
    name: 'dev-bots-api',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (!req.url?.startsWith('/api/bots')) return next()

        const send = (status, body) => {
          res.statusCode = status
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify(body))
        }
        const path = req.url.split('?')[0]

        // Provisions on first ask, exactly like findOrCreateCurrent() does.
        if (path === '/api/bots/current' && req.method === 'GET') {
          const state = readSequence()
          const bot = state.bots[state.bots.length - 1] ?? allocateBot('Support Bot')
          return send(200, bot)
        }

        if (path === '/api/bots' && req.method === 'POST') {
          let body = ''
          req.on('data', (chunk) => { body += chunk })
          req.on('end', () => {
            let parsed = {}
            try { parsed = JSON.parse(body || '{}') } catch { /* defaults below */ }
            send(201, allocateBot(parsed.name || 'Untitled bot', parsed.channel))
          })
          return
        }

        const match = path.match(/^\/api\/bots\/(\d+)$/)
        if (match && req.method === 'GET') {
          const bot = readSequence().bots.find((b) => b.botNumber === match[1])
          return bot ? send(200, bot) : send(404, { error: 'bot_not_found' })
        }

        // ── Live config: read, write, stream ──────────────────────────────
        const cfgMatch = path.match(/^\/api\/bots\/(\d+)\/config$/)
        if (cfgMatch) {
          const botNumber = cfgMatch[1]
          const state = readSequence()
          const bot = state.bots.find((b) => b.botNumber === botNumber)
          if (!bot) return send(404, { error: 'bot_not_found' })

          if (req.method === 'GET') {
            return send(200, {
              botNumber,
              version: bot.configVersion || 1,
              config: bot.config || {},
            })
          }
          if (req.method === 'PATCH') {
            readBody(req).then((patch) => {
              // Merge, matching the jsonb `||` the real route uses.
              bot.config = { ...(bot.config || {}), ...patch }
              bot.configVersion = (bot.configVersion || 1) + 1
              writeFileSync(SEQUENCE_FILE, JSON.stringify(state, null, 2))
              broadcastConfig(botNumber, bot.configVersion, bot.config)
              send(200, { version: bot.configVersion, config: bot.config })
            })
            return
          }
        }

        const streamMatch = path.match(/^\/api\/bots\/(\d+)\/events$/)
        if (streamMatch && req.method === 'GET') {
          const botNumber = streamMatch[1]
          const bot = readSequence().bots.find((b) => b.botNumber === botNumber)
          if (!bot) return send(404, { error: 'bot_not_found' })

          res.writeHead(200, {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache, no-transform',
            Connection: 'keep-alive',
            'X-Accel-Buffering': 'no',
            'Access-Control-Allow-Origin': '*',
          })
          let listeners = configStreams.get(botNumber)
          if (!listeners) { listeners = new Set(); configStreams.set(botNumber, listeners) }
          listeners.add(res)
          writeConfigEvent(res, bot.configVersion || 1, bot.config || {})

          // Idle proxies reap connections with no traffic; a comment frame is
          // ignored by EventSource and keeps the stream alive.
          const heartbeat = setInterval(() => {
            try { res.write(': ping\n\n') } catch { /* closed */ }
          }, 25_000)
          const cleanup = () => { clearInterval(heartbeat); listeners.delete(res) }
          res.on('close', cleanup)
          res.on('error', cleanup)
          return
        }

        return next()
      })
    },
  }
}

export default defineConfig({
  root: __dirname,
  plugins: [react(), devBotsApi()],
  // Vite's default bind on this machine only listens on [::1], so anything that
  // resolves `localhost` to 127.0.0.1 — most browsers, curl, the in-app preview
  // pane — cannot connect and the page just never loads. `host: true` binds
  // every interface, IPv4 included.
  server: { host: true },
})
