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
    createdAt: new Date().toISOString(),
  }
  state.bots.push(bot)
  state.nextBotNumber += 1
  writeFileSync(SEQUENCE_FILE, JSON.stringify(state, null, 2))
  return bot
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

        return next()
      })
    },
  }
}

export default defineConfig({
  root: __dirname,
  plugins: [react(), devBotsApi()],
})
