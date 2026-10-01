/*
 * End-to-end verification against the real stack. Nothing is mocked:
 * embedded-postgres boots real PostgreSQL into a throwaway cluster, the real
 * migrations and seed run, the real server starts as a child process, and
 * every check goes over HTTP, SSE or WebSocket exactly as the app would.
 *
 *   npm i --no-save embedded-postgres && npm run verify
 *
 * Channel and push providers are unconfigured, so outbound sends are logged
 * and pushes are recorded; /internal/debug/pushes exposes what dispatch
 * decided (who, which device, which token type).
 */
import EmbeddedPostgres from 'embedded-postgres'
import { spawn, execFileSync, type ChildProcess } from 'node:child_process'
import { createHmac, randomBytes } from 'node:crypto'
import { readFileSync, rmSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import pg from 'pg'
import WebSocket from 'ws'

const ROOT = fileURLToPath(new URL('..', import.meta.url))
// Unique per run: Postgres keys its shared-memory lock on the data directory,
// so a worker leaked by a previous (crashed) run can't block this one.
const DATA_DIR = fileURLToPath(new URL(`./.pgdata-verify/${process.pid}`, import.meta.url))
const UPLOAD_DIR = fileURLToPath(new URL(`./.pgdata-verify/${process.pid}-uploads`, import.meta.url))
const PG_PORT = Number(process.env.VERIFY_PG_PORT ?? 55434)
const API_PORT = Number(process.env.VERIFY_API_PORT ?? 18090)
const BASE = `http://localhost:${API_PORT}`
const DATABASE_URL = `postgres://postgres:postgres@localhost:${PG_PORT}/chatflow_verify`
const INTERNAL_KEY = randomBytes(24).toString('base64url')
const TURN_SECRET = 'verify-turn-secret'

// ── tiny harness ────────────────────────────────────────────────────────────
const results: { name: string; pass: boolean; detail: string }[] = []
function check(name: string, pass: boolean, detail = '') {
  results.push({ name, pass, detail })
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail ? `  — ${detail}` : ''}`)
}
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))
async function until<T>(fn: () => T | Promise<T>, timeoutMs = 4000): Promise<T | undefined> {
  const end = Date.now() + timeoutMs
  while (Date.now() < end) {
    const v = await fn()
    if (v) return v
    await sleep(50)
  }
  return undefined
}

async function api(path: string, opts: { method?: string; token?: string; body?: unknown; internal?: boolean } = {}) {
  const res = await fetch(`${BASE}${path}`, {
    method: opts.method ?? (opts.body ? 'POST' : 'GET'),
    headers: {
      'Content-Type': 'application/json',
      ...(opts.token && { Authorization: `Bearer ${opts.token}` }),
      ...(opts.internal && { 'x-internal-key': INTERNAL_KEY }),
    },
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  })
  const text = await res.text()
  let json: any = null
  try { json = text ? JSON.parse(text) : null } catch { json = text }
  return { status: res.status, json }
}

/** Minimal SSE client over fetch: collects events, supports Last-Event-ID. */
function sse(path: string, token: string, lastEventId?: number) {
  const events: { id: number | null; event: string; data: any }[] = []
  const ctrl = new AbortController()
  const ready = (async () => {
    const res = await fetch(`${BASE}${path}`, {
      headers: { Authorization: `Bearer ${token}`, ...(lastEventId !== undefined && { 'Last-Event-ID': String(lastEventId) }) },
      signal: ctrl.signal,
    })
    const reader = res.body!.getReader()
    const dec = new TextDecoder()
    let buf = ''
    void (async () => {
      try {
        for (;;) {
          const { value, done } = await reader.read()
          if (done) break
          buf += dec.decode(value, { stream: true })
          let i: number
          while ((i = buf.indexOf('\n\n')) >= 0) {
            const frame = buf.slice(0, i); buf = buf.slice(i + 2)
            let id: number | null = null; let event = 'message'; let data = ''
            for (const line of frame.split('\n')) {
              if (line.startsWith('id: ')) id = Number(line.slice(4))
              else if (line.startsWith('event: ')) event = line.slice(7)
              else if (line.startsWith('data: ')) data += line.slice(6)
            }
            if (data) events.push({ id, event, data: JSON.parse(data) })
          }
        }
      } catch { /* aborted */ }
    })()
  })()
  return { events, ready, close: () => ctrl.abort() }
}

function ws(query: string) {
  const sock = new WebSocket(`ws://localhost:${API_PORT}/signal?${query}`)
  const inbox: any[] = []
  let closed: { code: number; reason: string } | null = null
  sock.on('message', (d) => inbox.push(JSON.parse(d.toString())))
  sock.on('close', (code, reason) => { closed = { code, reason: reason.toString() } })
  const opened = new Promise<void>((resolve) => { sock.on('open', () => resolve()); sock.on('close', () => resolve()) })
  return {
    sock, inbox, opened,
    get closed() { return closed },
    send: (m: unknown) => sock.send(JSON.stringify(m)),
    waitFor: (type: string, t = 4000) => until(() => inbox.find(m => m.type === type), t),
  }
}

// ── boot ────────────────────────────────────────────────────────────────────
rmSync(DATA_DIR, { recursive: true, force: true })
let postmasterPid: number | null = null
const pgServer = new EmbeddedPostgres({ databaseDir: DATA_DIR, user: 'postgres', password: 'postgres', port: PG_PORT, persistent: false })
let server: ChildProcess | null = null

async function main() {
  console.log('Starting PostgreSQL…')
  await pgServer.initialise()
  await pgServer.start()
  postmasterPid = Number(readFileSync(`${DATA_DIR}/postmaster.pid`, 'utf8').split(/\r?\n/)[0])
  const admin = new pg.Client({ connectionString: `postgres://postgres:postgres@localhost:${PG_PORT}/postgres` })
  await admin.connect()
  await admin.query(`CREATE DATABASE chatflow_verify WITH ENCODING 'UTF8' TEMPLATE template0 LC_COLLATE 'C' LC_CTYPE 'C'`)
  await admin.end()

  const env = {
    ...process.env, DATABASE_URL, PORT: String(API_PORT), NODE_ENV: 'test', LOG_LEVEL: 'warn',
    JWT_ACCESS_SECRET: randomBytes(48).toString('base64url'), INTERNAL_API_KEY: INTERNAL_KEY,
    TURN_URLS: 'turn:turn.example.com:3478', TURN_SHARED_SECRET: TURN_SECRET,
    CALL_RING_TIMEOUT_SECONDS: '3', ACCESS_TOKEN_TTL_SECONDS: '900', UPLOAD_DIR,
  }
  const node = process.execPath
  const tsx = fileURLToPath(new URL('../node_modules/tsx/dist/cli.mjs', import.meta.url))
  execFileSync(node, [fileURLToPath(new URL('../node_modules/node-pg-migrate/bin/node-pg-migrate.js', import.meta.url)), 'up', '-m', 'migrations', '-j', 'sql'], { cwd: ROOT, env, stdio: 'ignore' })
  check('migrations apply to a fresh database', true)
  execFileSync(node, [tsx, 'scripts/seed.ts'], { cwd: ROOT, env, stdio: 'ignore' })
  check('seed loads the dashboard demo data', true)

  // `node --import tsx`, not the tsx CLI: the CLI runs the app in a
  // grandchild process that kill() doesn't reach on Windows.
  server = spawn(node, ['--import', 'tsx', 'src/server.ts'], { cwd: ROOT, env, stdio: ['ignore', 'inherit', 'inherit'] })
  const up = await until(async () => (await fetch(`${BASE}/healthz`).then(r => r.ok).catch(() => false)), 20000)
  check('server boots and reports healthy', !!up)
  if (!up) return

  const db = new pg.Client({ connectionString: DATABASE_URL })
  await db.connect()
  const convId = async (name: string) => (await db.query(`SELECT c.id FROM conversations c JOIN contacts ct ON ct.id = c.contact_id WHERE ct.name = $1 ORDER BY c.created_at DESC LIMIT 1`, [name])).rows[0].id as string

  // ── Auth ──────────────────────────────────────────────────────────────────
  const login = (email: string, password: string, deviceId?: string) =>
    api('/api/auth/login', { body: { email, password, deviceId } })

  const bad = await login('rahul@acmecorp.com', 'wrong-password')
  check('wrong password is rejected', bad.status === 401 && bad.json.error === 'invalid_credentials')
  const ghost = await login('nobody@acmecorp.com', 'agent123')
  check('unknown email gets the same response as a wrong password', ghost.status === 401 && ghost.json.error === 'invalid_credentials')

  const rahulLogin = await login('rahul@acmecorp.com', 'agent123', 'device-rahul-1')
  check('agent logs in and gets access + refresh tokens', rahulLogin.status === 200 && !!rahulLogin.json.accessToken && !!rahulLogin.json.refreshToken)
  let rahul = rahulLogin.json.accessToken as string
  const rahulId = rahulLogin.json.user.id as string

  const me = await api('/api/auth/me', { token: rahul })
  check('/auth/me returns the user and server-side capabilities', me.status === 200 && me.json.user.role === 'agent' && me.json.capabilities.includes('conversation.reply') && !me.json.capabilities.includes('user.manage'))
  check('password hash is never returned', !JSON.stringify(me.json).includes('scrypt'))

  const r1 = rahulLogin.json.refreshToken as string
  const rot = await api('/api/auth/refresh', { body: { refreshToken: r1 } })
  check('refresh rotates to a new refresh token', rot.status === 200 && rot.json.refreshToken !== r1)
  const r2 = rot.json.refreshToken as string
  const race = await api('/api/auth/refresh', { body: { refreshToken: r1 } })
  const r2still = await api('/api/auth/refresh', { body: { refreshToken: r2 } })
  check('a just-rotated token presented again (app racing itself) is refused without killing the session', race.status === 401 && r2still.status === 200)
  const r3 = r2still.json.refreshToken as string
  await db.query(`UPDATE refresh_tokens SET revoked_at = now() - interval '1 minute' WHERE revoked_reason = 'rotated'`)
  const reuse = await api('/api/auth/refresh', { body: { refreshToken: r1 } })
  const afterReuse = await api('/api/auth/refresh', { body: { refreshToken: r3 } })
  check('replaying an old rotated token revokes the whole family (theft detection)', reuse.status === 401 && afterReuse.status === 401)

  const again = await login('rahul@acmecorp.com', 'agent123', 'device-rahul-1')
  rahul = again.json.accessToken
  const expiredish = await api('/api/conversations', { token: 'not-a-jwt' })
  check('garbage bearer token is rejected as invalid (not expired)', expiredish.status === 401 && expiredish.json.error === 'invalid_token')

  const priya = (await login('priya@acmecorp.com', 'super123', 'device-priya-1')).json.accessToken as string
  const aryanLogin = await login('aryan@acmecorp.com', 'agent123', 'device-aryan-1')
  const aryan = aryanLogin.json.accessToken as string
  const aryanId = aryanLogin.json.user.id as string
  const adminTok = (await login('admin@acmecorp.com', 'admin123')).json.accessToken as string

  const agentCreatesUser = await api('/api/users', { token: rahul, body: { email: 'x@acmecorp.com', password: 'longenough123', name: 'X', role: 'admin' } })
  check('agent cannot call an admin-only endpoint (server-enforced, not UI-hidden)', agentCreatesUser.status === 403)
  const supCreatesUser = await api('/api/users', { token: priya, body: { email: 'x@acmecorp.com', password: 'longenough123', name: 'X', role: 'agent' } })
  check('supervisor cannot manage users either', supCreatesUser.status === 403)
  const adminCreates = await api('/api/users', { token: adminTok, body: { email: 'new.agent@acmecorp.com', password: 'longenough123', name: 'New Agent', role: 'agent' } })
  check('admin can create a user', adminCreates.status === 201)
  const newAgent = await login('new.agent@acmecorp.com', 'longenough123', 'device-new-1')
  const deact = await api(`/api/users/${adminCreates.json.id}`, { method: 'PATCH', token: adminTok, body: { isActive: false } })
  const newRefresh = await api('/api/auth/refresh', { body: { refreshToken: newAgent.json.refreshToken } })
  check('deactivating a user revokes their sessions immediately', deact.status === 200 && newRefresh.status === 401)

  // ── Devices & presence ────────────────────────────────────────────────────
  await api('/api/me/devices', { method: 'PUT', token: rahul, body: { deviceId: 'device-rahul-1', platform: 'android', pushToken: 'fcm-token-rahul-xxxxxxxx' } })
  await api('/api/me/devices', { method: 'PUT', token: aryan, body: { deviceId: 'device-aryan-1', platform: 'ios', pushToken: 'apns-token-aryan-xxxxxxx', voipToken: 'voip-token-aryan-xxxxxxx' } })
  await api('/api/me/devices', { method: 'PUT', token: priya, body: { deviceId: 'device-priya-1', platform: 'android', pushToken: 'fcm-token-priya-xxxxxxxx' } })
  const pushes = async () => (await api('/internal/debug/pushes', { internal: true })).json.items as any[]
  const pushCountBefore = async () => (await pushes()).length

  // ── Live stream ───────────────────────────────────────────────────────────
  const stream = sse('/api/events', rahul)
  await stream.ready
  await until(() => stream.events.find(e => e.event === 'ready'))
  check('SSE stream opens and announces its position', !!stream.events.find(e => e.event === 'ready'))

  // ── Listing & filters ─────────────────────────────────────────────────────
  const mine = await api('/api/conversations?view=mine', { token: rahul })
  check('"Assigned to me" returns only the caller\'s conversations', mine.json.items.length > 0 && mine.json.items.every((c: any) => c.agentId === rahulId))
  const pending = await api('/api/conversations?bucket=pending', { token: rahul })
  check('"Pending" returns only bot-handled conversations', pending.json.items.every((c: any) => c.status === 'bot'))
  const ig = await api('/api/conversations?channel=instagram&source=comment', { token: rahul })
  check('channel + Instagram sub-type filter', ig.json.items.length === 1 && ig.json.items[0].handle === '@meera.creates')
  const search = await api('/api/conversations?q=refund', { token: rahul })
  check('search matches message previews', search.json.items.some((c: any) => c.name === 'Vikram Singh'))
  const page1 = await api('/api/conversations?limit=4', { token: rahul })
  const page2 = await api(`/api/conversations?limit=4&cursor=${page1.json.nextCursor}`, { token: rahul })
  check('cursor pagination has no overlap', page2.json.items.length > 0 && !page2.json.items.some((c: any) => page1.json.items.some((p: any) => p.id === c.id)))
  const wc = (await api('/api/conversations?channel=webchat', { token: rahul })).json.items[0]
  check('Website Chat rows carry visitorId + page/browser/os, not a phone', !!wc.visitorId && !!wc.visitor?.page && wc.phone === undefined)
  // ── Identity shown per channel ────────────────────────────────────────────
  const idOf = async (q: string) => (await api(`/api/conversations?q=${encodeURIComponent(q)}`, { token: rahul })).json.items[0]
  const waRow = await idOf('Priya Sharma')
  check('WhatsApp chats are identified by phone number', waRow?.identity.kind === 'phone' && waRow.identity.primary === '+91 98765 43210')
  const igRow = await idOf('ananya')
  check('Instagram chats are identified by @handle', igRow?.identity.kind === 'instagram' && igRow.identity.primary === '@ananya.rao')
  const byEmail = await idOf('v_4f9a21e8')
  check('a website visitor who gave an email is shown by that email', byEmail?.name === 'visitor4821@example.com' && byEmail.identity.known === true)
  const byName = await idOf('Jordan')
  check('a website visitor who gave a name is shown by that name', byName?.identity.primary === 'Jordan Lee' && byName.identity.known)
  const anon = await idOf('v_1a5e9f04')
  check('an anonymous website visitor is shown by their unique visitor id', anon?.name === 'v_1a5e9f04' && anon.identity.known === false)
  await api('/internal/inbound', { internal: true, body: { channel: 'webchat', visitorId: 'v_1a5e9f04', name: 'Visitor #4790', answer: { questionType: 'email', label: 'Email', value: 'hindi.fan@example.com' } } })
  const learned = await idOf('v_1a5e9f04')
  check('an email captured by the bot mid-chat becomes the visitor’s identity', learned?.name === 'hindi.fan@example.com')
  const phoneSearch = await idOf('98765-43210')
  check('phone search matches however the number is typed', phoneSearch?.name === 'Priya Sharma')

  // ── Bots & scope ──────────────────────────────────────────────────────────
  const aryanBots = (await api('/api/bots', { token: aryan })).json.items as any[]
  const adminBots = (await api('/api/bots', { token: adminTok })).json.items as any[]
  check('home screen lists only the bots an agent is assigned to', aryanBots.length === 3 && !aryanBots.some(b => b.name === 'Acme Sales'))
  check('admins see every bot, with live counts', adminBots.length === 5 && adminBots.every(b => typeof b.stats.open === 'number'))
  const nisha = await convId('Nisha Gupta')
  const aryanList = (await api('/api/conversations?limit=100', { token: aryan })).json.items as any[]
  const aryanGet = await api(`/api/conversations/${nisha}`, { token: aryan })
  const aryanNote = await api(`/api/conversations/${nisha}/notes`, { token: aryan, body: { text: 'peek' } })
  check('an agent cannot list, open or act on chats of a bot they are not on', !aryanList.some(c => c.id === nisha) && aryanGet.status === 403 && aryanNote.status === 403)
  const sales = adminBots.find(b => b.name === 'Acme Sales')
  const salesOnly = (await api(`/api/conversations?botIds=${sales.id}`, { token: rahul })).json.items as any[]
  check('filter by bot', salesOnly.length > 0 && salesOnly.every(c => c.botId === sales.id && c.botName === 'Acme Sales'))

  // ── Take over / reply ─────────────────────────────────────────────────────
  const vikram = await convId('Vikram Singh')
  const replyToBot = await api(`/api/conversations/${vikram}/messages`, { token: rahul, body: { text: 'Hello' } })
  check('replying to a bot-handled chat requires taking over first', replyToBot.status === 409 && replyToBot.json.error === 'not_taken_over')
  const take = await api(`/api/conversations/${vikram}/takeover`, { token: rahul, body: {} })
  check('take over assigns the chat to the caller', take.status === 200 && take.json.status === 'agent' && take.json.agentId === rahulId)
  await db.query(`UPDATE conversations SET last_inbound_at = now() WHERE id = $1`, [vikram])
  const reply = await api(`/api/conversations/${vikram}/messages`, { token: rahul, body: { text: 'Sure — what is the order ID?', clientMsgId: 'client-msg-0001' } })
  const replyAgain = await api(`/api/conversations/${vikram}/messages`, { token: rahul, body: { text: 'Sure — what is the order ID?', clientMsgId: 'client-msg-0001' } })
  check('a retried send with the same clientMsgId is not posted twice', reply.status === 201 && replyAgain.json.id === reply.json.id)
  const delivered = await until(() => stream.events.find(e => e.event === 'message.updated' && e.data.message.id === reply.json.id))
  check('delivery outcome arrives on the live stream', delivered?.data.message.delivery === 'sent')
  const created = stream.events.find(e => e.event === 'message.created' && e.data.message.id === reply.json.id)
  check('message.created carries the updated conversation (preview + version)', created?.data.conversation.lastMessage === 'Sure — what is the order ID?')
  const thread = await api(`/api/conversations/${vikram}/messages`, { token: rahul })
  check('takeover writes a handover event into the thread', thread.json.items.some((m: any) => m.type === 'event' && m.event === 'bot_handover'))

  const aryanReply = await api(`/api/conversations/${vikram}/messages`, { token: aryan, body: { text: 'hi' } })
  const aryanTake = await api(`/api/conversations/${vikram}/takeover`, { token: aryan, body: {} })
  check('another agent cannot reply to or take over a colleague\'s chat', aryanReply.status === 403 && aryanTake.status === 403 && aryanTake.json.error === 'assigned_to_another_agent')

  // ── Attachments ───────────────────────────────────────────────────────────
  const upload = async (convId: string, token: string, mime: string, data: Buffer, name = 'file') => {
    const res = await fetch(`${BASE}/api/conversations/${convId}/attachments`, {
      method: 'POST', body: data,
      headers: { 'Content-Type': mime, 'X-File-Name': encodeURIComponent(name), Authorization: `Bearer ${token}` },
    })
    return { status: res.status, json: await res.json().catch(() => null) as any }
  }
  // A real 1×1 PNG.
  const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', 'base64')
  const upImg = await upload(vikram, rahul, 'image/png', png, 'receipt ../../photo.png')
  check('an image uploads with its kind, pixel size and a signed link',
    upImg.status === 201 && upImg.json.kind === 'image' && upImg.json.width === 1 && upImg.json.height === 1 && upImg.json.name === 'photo.png' && upImg.json.url.startsWith(`/api/files/${upImg.json.id}/`),
    JSON.stringify(upImg.json))
  const file = await fetch(`${BASE}${upImg.json.url}`)
  const fileBytes = Buffer.from(await file.arrayBuffer())
  check('the signed link serves the exact bytes, typed and nosniff',
    file.status === 200 && file.headers.get('content-type') === 'image/png' && file.headers.get('x-content-type-options') === 'nosniff' && fileBytes.equals(png))
  const forged = await fetch(`${BASE}${upImg.json.url.replace(/sig=[^&]+/, 'sig=AAAA')}`)
  const unsigned = await fetch(`${BASE}/api/files/${upImg.json.id}/photo.png`)
  check('a forged or missing signature is refused', forged.status === 403 && unsigned.status === 403)
  const disguised = await upload(vikram, rahul, 'image/png', Buffer.from('<html><script>alert(1)</script></html>'), 'x.png')
  check('a file whose bytes don\'t match its type is refused', disguised.status === 415 && disguised.json.error === 'attachment_content_mismatch')
  const webpOnWa = await upload(vikram, rahul, 'image/webp', Buffer.concat([Buffer.from('RIFF0000WEBP'), Buffer.alloc(20)]))
  const htmlOnWa = await upload(vikram, rahul, 'text/html', Buffer.from('<html></html>'))
  check('types the channel doesn\'t accept are refused, with the allowed list',
    webpOnWa.status === 415 && htmlOnWa.status === 415 && webpOnWa.json.error === 'attachment_type_not_allowed' && webpOnWa.json.details.allowed.includes('image/jpeg'))
  const huge = await upload(vikram, rahul, 'image/png', Buffer.concat([png, Buffer.alloc(5 * 1024 * 1024)]))
  check('per-channel size limits apply (WhatsApp images: 5 MB)', huge.status === 413 && huge.json.error === 'attachment_too_large')
  const aryanUpload = await upload(vikram, aryan, 'image/png', png)
  check('only someone who may reply can upload to the chat', aryanUpload.status === 403)

  const withFile = await api(`/api/conversations/${vikram}/messages`, { token: rahul, body: { text: 'Here is your receipt', attachmentId: upImg.json.id, clientMsgId: 'client-msg-att-1' } })
  check('a reply carries the attachment and its caption',
    withFile.status === 201 && withFile.json.attachment?.id === upImg.json.id && withFile.json.attachment.url.includes('sig=') && withFile.json.text === 'Here is your receipt',
    JSON.stringify(withFile.json))
  const afterFile = (await api(`/api/conversations/${vikram}`, { token: rahul })).json
  check('the list preview shows the attachment', afterFile.lastMessage === '📷 Here is your receipt', afterFile.lastMessage)
  const fileOnly = await upload(vikram, rahul, 'application/pdf', Buffer.from('%PDF-1.4\n%âãÏÓ\n'), 'Invoice #22.pdf')
  const docReply = await api(`/api/conversations/${vikram}/messages`, { token: rahul, body: { attachmentId: fileOnly.json.id } })
  check('a file can be sent without a caption', docReply.status === 201 && docReply.json.attachment?.kind === 'document' && docReply.json.attachment.name === 'Invoice #22.pdf')
  const reuseUpload = await api(`/api/conversations/${vikram}/messages`, { token: rahul, body: { text: 'again', attachmentId: upImg.json.id } })
  const otherConv = await upload(await convId('Priya Sharma'), rahul, 'image/png', png)
  const crossThread = await api(`/api/conversations/${vikram}/messages`, { token: rahul, body: { text: 'x', attachmentId: otherConv.json?.id ?? '00000000-0000-4000-8000-000000000000' } })
  check('an upload is sent once, and only in its own conversation',
    reuseUpload.status === 400 && reuseUpload.json.error === 'attachment_not_found' && crossThread.status === 400)
  const empty = await api(`/api/conversations/${vikram}/messages`, { token: rahul, body: { text: '   ' } })
  check('an empty reply with no file is refused', empty.status === 400)

  // Concurrency: two agents grab the same unowned chat at the same instant.
  const rv = await convId('Rahul Verma')
  const [a, b] = await Promise.all([
    api(`/api/conversations/${rv}/takeover`, { token: rahul, body: {} }),
    api(`/api/conversations/${rv}/takeover`, { token: aryan, body: {} }),
  ])
  const winners = [a, b].filter(r => r.status === 200).length
  check('simultaneous takeovers: exactly one agent wins', winners === 1 && [a, b].some(r => r.status === 403))

  // ── Notes, labels, flags ──────────────────────────────────────────────────
  const beforeNote = (await api(`/api/conversations/${vikram}`, { token: rahul })).json
  const note = await api(`/api/conversations/${vikram}/notes`, { token: rahul, body: { text: 'Customer sounds upset' } })
  const afterNote = (await api(`/api/conversations/${vikram}`, { token: rahul })).json
  check('private note is stored but never becomes the list preview', note.status === 201 && note.json.type === 'note' && afterNote.lastMessage === beforeNote.lastMessage)
  check('conversation version only ever increases', afterNote.version > beforeNote.version)

  await api(`/api/conversations/${vikram}/labels`, { token: rahul, body: { label: 'escalated' } })
  const labelled = await api(`/api/conversations?labels=escalated`, { token: rahul })
  await api(`/api/conversations/${vikram}/labels/escalated`, { method: 'DELETE', token: rahul })
  const unlabelled = await api(`/api/conversations?labels=escalated`, { token: rahul })
  check('add/remove label', labelled.json.items.length === 1 && unlabelled.json.items.length === 0)

  await api(`/api/conversations/${vikram}/star`, { token: rahul, body: { starred: true } })
  const fav = await api(`/api/conversations?bucket=favourite`, { token: rahul })
  check('star → Favourite', fav.json.items.some((c: any) => c.id === vikram))

  const until1h = new Date(Date.now() + 3600_000).toISOString()
  await api(`/api/conversations/${vikram}/snooze`, { token: rahul, body: { until: until1h } })
  const snoozedHidden = !(await api(`/api/conversations`, { token: rahul })).json.items.some((c: any) => c.id === vikram)
  await api(`/api/conversations/${vikram}/snooze`, { token: rahul, body: { until: null } })
  check('snoozed chats leave the list until the snooze ends', snoozedHidden)

  await api(`/api/conversations/${vikram}/archive`, { token: rahul, body: { archived: true } })
  const archivedHidden = !(await api(`/api/conversations`, { token: rahul })).json.items.some((c: any) => c.id === vikram)
  const inArchive = (await api(`/api/conversations?archived=true`, { token: rahul })).json.items.some((c: any) => c.id === vikram)
  check('archive moves a chat to the archived view', archivedHidden && inArchive)
  await api('/internal/inbound', { internal: true, body: { channel: 'whatsapp', phone: '917789012345', name: 'Vikram Singh', text: 'Order ID is 5521', externalMessageId: 'wamid.TEST1' } })
  const unarchived = (await api(`/api/conversations/${vikram}`, { token: rahul })).json
  check('a new customer message brings an archived chat back (and counts as unread)', !unarchived.archived && unarchived.unread >= 1)
  const dup = await api('/internal/inbound', { internal: true, body: { channel: 'whatsapp', phone: '+91 77890 12345', name: 'Vikram Singh', text: 'Order ID is 5521', externalMessageId: 'wamid.TEST1' } })
  check('webhook redelivery of the same message is deduplicated', dup.json.duplicate === true)
  check('phone formats resolve to one contact (+91 77890 12345 = 917789012345)',
    (await db.query(`SELECT count(*)::int n FROM contacts WHERE phone = '+917789012345'`)).rows[0].n === 1)
  await api(`/api/conversations/${vikram}/read`, { token: rahul, body: {} })
  check('mark read clears unread', (await api(`/api/conversations/${vikram}`, { token: rahul })).json.unread === 0)

  // ── WhatsApp 24h window & templates ───────────────────────────────────────
  const meera = await convId('Meera Joshi')
  const late = await api(`/api/conversations/${meera}/messages`, { token: rahul, body: { text: 'Following up!' } })
  check('free-form WhatsApp reply outside the 24h window is refused', late.status === 409 && late.json.error === 'whatsapp_window_closed')
  const templates = (await api('/api/templates', { token: rahul })).json.items as any[]
  check('only APPROVED templates are offered', templates.length > 0 && templates.every(t => t.status === 'APPROVED'))
  const tpl = templates.find(t => t.name === 'follow_up_after_chat')
  const missing = await api(`/api/conversations/${meera}/templates`, { token: rahul, body: { templateId: tpl.id, variables: [] } })
  check('template with a missing variable is refused (no literal {{1}} to a customer)', missing.status === 400 && missing.json.error === 'template_variables_missing')
  const sentTpl = await api(`/api/conversations/${meera}/templates`, { token: rahul, body: { templateId: tpl.id, variables: ['Meera'] } })
  check('template send renders variables', sentTpl.status === 201 && sentTpl.json.type === 'template' && sentTpl.json.text.startsWith('Hi Meera,'))
  const newWa = await api('/api/conversations/start/whatsapp', { token: rahul, body: { phone: '+44 7700 900123', name: 'New Lead', templateId: tpl.id, variables: ['there'] } })
  check('start a new WhatsApp conversation with a template', newWa.status === 201 && !!newWa.json.conversationId)

  // ── Instagram sub-types ───────────────────────────────────────────────────
  const comment = await convId('Meera Nair')
  const noMode = await api(`/api/conversations/${comment}/messages`, { token: rahul, body: { text: 'Thanks!' } })
  check('Instagram comment reply must choose public or private', noMode.status === 400 && noMode.json.error === 'ig_reply_mode_required')
  const priv = await api(`/api/conversations/${comment}/messages`, { token: rahul, body: { text: 'DMing you details', igReplyMode: 'private' } })
  const priv2 = await api(`/api/conversations/${comment}/messages`, { token: rahul, body: { text: 'again', igReplyMode: 'private' } })
  const pub = await api(`/api/conversations/${comment}/messages`, { token: rahul, body: { text: 'Thank you! 💛', igReplyMode: 'public' } })
  check('one private reply per comment, public replies unlimited', priv.status === 201 && priv2.status === 409 && pub.status === 201)
  const followers = (await api('/api/instagram/followers', { token: rahul })).json.items as any[]
  const nonFollower = (await db.query(`SELECT id FROM contacts WHERE handle = '@rohit.s'`)).rows[0].id
  const startNon = await api('/api/conversations/start/instagram', { token: rahul, body: { contactId: nonFollower, text: 'Hi' } })
  const startF = await api('/api/conversations/start/instagram', { token: rahul, body: { contactId: followers[0].id, text: 'Hi from the team!' } })
  check('Instagram conversations can only be started with followers', startNon.status === 403 && startF.status === 201)

  // ── Contact panel ─────────────────────────────────────────────────────────
  const marcus = (await api(`/api/conversations/${await convId('Marcus Chen')}`, { token: rahul })).json
  const panel = await api(`/api/contacts/${marcus.contactId}`, { token: rahul })
  check('contact panel rolls up bot-captured answers', panel.json.capturedAnswers.some((m: any) => m.label === 'Phone Number' && m.value === '+65 8123 4567'))
  const edited = await api(`/api/contacts/${marcus.contactId}`, { method: 'PATCH', token: rahul, body: { profile: { company: 'Chen Global' }, customFields: { seats: 200 } } })
  check('contact profile + custom fields are editable', edited.json.profile.company === 'Chen Global' && edited.json.customFields.seats === 200)

  // ── Transfer & push targeting ─────────────────────────────────────────────
  await api('/api/me/presence', { method: 'PUT', token: aryan, body: { presence: 'away' } })
  let n0 = await pushCountBefore()
  const tr = await api(`/api/conversations/${vikram}/transfer`, { token: rahul, body: { toUserId: aryanId } })
  const assignPush = await until(async () => (await pushes()).slice(n0).find(p => p.payload.kind === 'assignment' && p.userId === aryanId))
  check('transfer reassigns and pushes the new assignee (away agents still get pushes)', tr.json.agentId === aryanId && !!assignPush && assignPush.voip === false)

  await api('/api/me/presence', { method: 'PUT', token: aryan, body: { presence: 'offline' } })
  n0 = await pushCountBefore()
  await api('/internal/inbound', { internal: true, body: { channel: 'whatsapp', phone: '917789012345', name: 'Vikram Singh', text: 'Any update?' } })
  await sleep(400)
  check('an OFFLINE agent is not pushed for their customer\'s message', !(await pushes()).slice(n0).some(p => p.userId === aryanId))

  // ── Notification preferences ──────────────────────────────────────────────
  await api('/api/me/presence', { method: 'PUT', token: aryan, body: { presence: 'away' } })
  const vikramSays = async (text: string) => {
    const before = await pushCountBefore()
    await api('/internal/inbound', { internal: true, body: { channel: 'whatsapp', phone: '917789012345', name: 'Vikram Singh', text } })
    await sleep(400)
    return (await pushes()).slice(before).filter(p => p.userId === aryanId && p.payload.kind === 'message')
  }
  const prefs0 = await api('/api/me/notifications?deviceId=device-aryan-1', { token: aryan })
  check('notifications: every category and the phone switch start on',
    prefs0.status === 200 && Object.values(prefs0.json.categories).every(v => v === true)
      && prefs0.json.device?.pushEnabled === true && prefs0.json.device?.registered === true, JSON.stringify(prefs0.json))
  const control = await vikramSays('Hello again?')
  const muteMessages = await api('/api/me/notifications', { method: 'PUT', token: aryan, body: { categories: { messages: false } } })
  const whileMuted = await vikramSays('Still there?')
  check('notifications: turning off "New messages" stops message pushes, others stay on',
    control.length === 1 && muteMessages.json.categories.messages === false && muteMessages.json.categories.assignments === true && whileMuted.length === 0)
  await api('/api/me/notifications', { method: 'PUT', token: aryan, body: { categories: { messages: true } } })
  const phoneOff = await api('/api/me/notifications', { method: 'PUT', token: aryan, body: { deviceId: 'device-aryan-1', pushEnabled: false } })
  const whilePhoneOff = await vikramSays('Hello??')
  await api('/api/me/notifications', { method: 'PUT', token: aryan, body: { deviceId: 'device-aryan-1', pushEnabled: true } })
  const phoneOn = await vikramSays('Ok thanks')
  check('notifications: the phone switch silences that device and turning it back on needs no new token',
    phoneOff.json.device?.pushEnabled === false && whilePhoneOff.length === 0 && phoneOn.length === 1)
  const hijack = await api('/api/me/notifications', { method: 'PUT', token: rahul, body: { deviceId: 'device-aryan-1', pushEnabled: false } })
  const aryanDevice = (await db.query(`SELECT push_enabled FROM devices WHERE device_id = 'device-aryan-1'`)).rows[0]
  const noDevice = await api('/api/me/notifications', { method: 'PUT', token: aryan, body: { pushEnabled: false } })
  const unknownCat = await api('/api/me/notifications', { method: 'PUT', token: aryan, body: { categories: { marketing: false } } })
  check('notifications: nobody can switch off someone else\'s phone; malformed updates are refused',
    hijack.status === 200 && hijack.json.device === null && aryanDevice.push_enabled === true && noDevice.status === 400 && unknownCat.status === 400)
  await api('/api/me/presence', { method: 'PUT', token: aryan, body: { presence: 'offline' } })

  // ── Presence-driven routing ───────────────────────────────────────────────
  await db.query(`UPDATE users SET presence = 'offline'`)
  const jordan = await convId('Jordan Lee')
  n0 = await pushCountBefore()
  const queued = await api(`/internal/conversations/${jordan}/handover`, { internal: true, body: {} })
  const qConv = (await api(`/api/conversations/${jordan}`, { token: rahul })).json
  check('handover with nobody online queues the chat', queued.json.queued === true && !!qConv.waitingSince && qConv.status === 'bot')
  check('…and wakes nobody who is off shift', (await pushes()).slice(n0).length === 0)
  const online = await api('/api/me/presence', { method: 'PUT', token: aryan, body: { presence: 'online' } })
  const routed = (await api(`/api/conversations/${jordan}`, { token: rahul })).json
  check('going online routes the waiting chat to that agent', online.json.routed >= 1 && routed.agentId === aryanId && routed.waitingSince === null)
  const presenceEvt = await until(() => stream.events.find(e => e.event === 'presence.updated' && e.data.user.id === aryanId && e.data.user.presence === 'online'))
  check('presence changes are broadcast live', !!presenceEvt)

  await api('/api/me/presence', { method: 'PUT', token: rahul, body: { presence: 'away' } })
  const vis = await convId('Visitor #4821')
  const toOnline = await api(`/internal/conversations/${vis}/handover`, { internal: true, body: {} })
  check('auto-assignment picks an online agent, never an away one', toOnline.json.assignedTo === aryanId)

  // ── Resolve / return to bot ───────────────────────────────────────────────
  const res1 = await api(`/api/conversations/${meera}/resolve`, { token: rahul, body: {} })
  check('resolve', res1.json.status === 'resolved')
  const rtb = await api(`/api/conversations/${meera}/return-to-bot`, { token: rahul, body: {} })
  check('return to bot clears the assignee', rtb.json.status === 'bot' && rtb.json.agentId === null)

  // ── Analytics ─────────────────────────────────────────────────────────────
  const stats = await api('/api/analytics/agent?range=7d&tz=Asia/Kolkata', { token: rahul })
  check('analytics: an agent sees their own numbers, from the thread itself',
    stats.status === 200 && stats.json.agent.id === rahulId && stats.json.kpis.messages >= 2 && stats.json.kpis.conversations >= 1
      && stats.json.daily.length === 7 && stats.json.byHour.length === 24,
    JSON.stringify(stats.json?.kpis))
  check('analytics: resolutions are credited to the agent who resolved', stats.json.kpis.resolved >= 1
    && stats.json.team.some((u: any) => u.id === rahulId && u.resolved >= 1))
  const peek = await api(`/api/analytics/agent?range=7d&agentId=${aryanId}`, { token: rahul })
  const supervisorView = await api(`/api/analytics/agent?range=30d&agentId=${rahulId}`, { token: priya })
  check('analytics: agents may not view a colleague; supervisors can', peek.status === 403 && supervisorView.status === 200 && supervisorView.json.agent.id === rahulId)
  const badRange = await api('/api/analytics/agent?range=1y', { token: rahul })
  const badTz = await api('/api/analytics/agent?range=today&tz=Not/AZone', { token: rahul })
  check('analytics: bad ranges are refused, unknown timezones fall back to UTC', badRange.status === 400 && badTz.status === 200 && badTz.json.range.tz === 'UTC')
  const kolkataDay = (offsetDays: number) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date(Date.now() + offsetDays * 86_400_000))
  const lastWeek = await api(`/api/analytics/agent?range=custom&from=${kolkataDay(-6)}&to=${kolkataDay(0)}&tz=Asia/Kolkata`, { token: rahul })
  check('analytics: a custom range ending today matches the same preset',
    lastWeek.status === 200 && lastWeek.json.daily.length === 7 && lastWeek.json.range.startDate === kolkataDay(-6) && lastWeek.json.range.endDate === kolkataDay(0)
      && JSON.stringify(lastWeek.json.kpis) === JSON.stringify(stats.json.kpis), JSON.stringify(lastWeek.json?.range))
  const yesterday = await api(`/api/analytics/agent?range=custom&from=${kolkataDay(-1)}&to=${kolkataDay(-1)}&tz=Asia/Kolkata`, { token: rahul })
  check('analytics: a single past day is one whole day, compared with the day before',
    yesterday.status === 200 && yesterday.json.daily.length === 1 && yesterday.json.range.days === 1 && yesterday.json.range.endDate === kolkataDay(-1)
      && new Date(yesterday.json.range.to).getTime() - new Date(yesterday.json.range.from).getTime() === 86_400_000)
  const customBad = await Promise.all([
    'range=custom',
    `range=custom&from=${kolkataDay(0)}&to=${kolkataDay(-3)}`,
    `range=custom&from=${kolkataDay(0)}&to=${kolkataDay(2)}`,
    `range=custom&from=${kolkataDay(-120)}&to=${kolkataDay(0)}`,
    'range=custom&from=2026-02-31&to=2026-03-02',
  ].map(qs => api(`/api/analytics/agent?${qs}&tz=Asia/Kolkata`, { token: rahul })))
  check('analytics: custom ranges need two real dates, in order, not in the future, at most 90 days',
    customBad.every(r => r.status === 400), customBad.map(r => r.json?.error?.code ?? r.status).join(','))

  // ── Resume ────────────────────────────────────────────────────────────────
  const lastSeen = Math.max(...stream.events.filter(e => e.id !== null).map(e => e.id!))
  stream.close()
  await api(`/api/conversations/${vikram}/notes`, { token: aryan, body: { text: 'missed while disconnected #1' } })
  await api(`/api/conversations/${vikram}/notes`, { token: aryan, body: { text: 'missed while disconnected #2' } })
  const resumed = sse('/api/events', rahul, lastSeen)
  await resumed.ready
  const got = await until(() => resumed.events.filter(e => e.event === 'message.created' && e.data.message.text.startsWith('missed while')).length === 2 ? true : undefined)
  const ids = resumed.events.filter(e => e.id !== null).map(e => e.id!)
  check('reconnecting with Last-Event-ID replays exactly what was missed, in order', !!got && ids.every((id, i) => i === 0 || id > ids[i - 1]!) && ids.every(id => id > lastSeen))
  resumed.close()
  const ancient = sse('/api/events', rahul, 0)
  await ancient.ready
  await until(() => ancient.events.length > 1)
  ancient.close()
  await db.query(`DELETE FROM inbox_events WHERE id < (SELECT max(id) - 5 FROM inbox_events)`)
  const stale = sse('/api/events', rahul, 1)
  await stale.ready
  const resync = await until(() => stale.events.find(e => e.event === 'resync'))
  check('a client older than event retention is told to resync', !!resync)
  stale.close()

  // ── Signaling ─────────────────────────────────────────────────────────────
  const marcusConv = await convId('Marcus Chen') // webchat, assigned to rahul
  await api('/api/me/presence', { method: 'PUT', token: rahul, body: { presence: 'online' } })
  const noTok = ws(`room=${marcusConv}&role=agent`)
  await until(() => noTok.closed)
  check('signaling refuses an unauthenticated connection', noTok.closed?.code === 4401)
  const waRoom = ws(`room=${vikram}&role=agent&token=${rahul}`)
  await until(() => waRoom.closed)
  check('signaling refuses rooms that are not Website Chat', waRoom.closed?.code === 4403)
  const vt = await api('/internal/webchat/visitor-token', { internal: true, body: { conversationId: marcusConv } })
  const wrongRoom = ws(`room=${jordan}&role=visitor&token=${vt.json.token}`)
  await until(() => wrongRoom.closed)
  check('a visitor token only opens its own room', wrongRoom.closed?.code === 4401)
  const aryanIntoRahuls = ws(`room=${marcusConv}&role=agent&token=${aryan}`)
  await until(() => aryanIntoRahuls.closed)
  check('an agent cannot join a colleague\'s call room', aryanIntoRahuls.closed?.code === 4403)

  const ice = await api('/api/calls/ice-servers', { token: rahul })
  const turn = ice.json.iceServers.find((s: any) => s.username)
  const expected = turn && createHmac('sha1', TURN_SECRET).update(turn.username).digest('base64')
  check('ICE config includes STUN + TURN with short-lived HMAC credentials', !!turn && turn.credential === expected && Number(turn.username.split(':')[0]) > Date.now() / 1000)

  // Visitor rings while no agent is connected → push, then agent joins and gets the request.
  const sStream = sse('/api/events', rahul)
  await sStream.ready
  n0 = await pushCountBefore()
  const visitor = ws(`room=${marcusConv}&role=visitor&token=${vt.json.token}`)
  await visitor.opened
  const vj = await visitor.waitFor('peer-joined')
  check('peer-joined presence reported on connect', vj?.present === false)
  visitor.send({ type: 'call-request', video: true })
  const ringPush = await until(async () => (await pushes()).slice(n0).find(p => p.payload.kind === 'call'))
  check('an incoming call with no agent connected rings the assigned agent\'s phone', ringPush?.userId === rahulId && ringPush.payload.video === true)
  const ringEvt = await until(() => sStream.events.find(e => e.event === 'call.ringing'))
  check('…and rings foreground apps via the live stream', ringEvt?.data.call.conversationId === marcusConv)

  const agent = ws(`room=${marcusConv}&role=agent&token=${rahul}`)
  await agent.opened
  const replayed = await agent.waitFor('call-request')
  check('the held call-request is replayed to the agent who joins to answer', replayed?.video === true)
  const vPeer = await until(() => visitor.inbox.find(m => m.type === 'peer-joined' && m.present === true))
  check('visitor is told the agent joined', !!vPeer)

  agent.send({ type: 'call-accept' })
  check('call-accept relayed verbatim', !!(await visitor.waitFor('call-accept')))
  visitor.send({ type: 'offer', sdp: 'v=0 offer' })
  check('offer relayed verbatim', (await agent.waitFor('offer'))?.sdp === 'v=0 offer')
  agent.send({ type: 'answer', sdp: 'v=0 answer' })
  agent.send({ type: 'ice-candidate', candidate: { candidate: 'c1' } })
  agent.send({ type: 'ice-candidate', candidate: { candidate: 'c2' } })
  await until(() => visitor.inbox.filter(m => m.type === 'ice-candidate').length === 2)
  const order = visitor.inbox.filter(m => ['answer', 'ice-candidate'].includes(m.type)).map(m => m.type === 'answer' ? 'answer' : m.candidate.candidate)
  check('answer and ICE candidates arrive in the order sent', order.join(',') === 'answer,c1,c2', order.join(','))

  const second = ws(`room=${marcusConv}&role=agent&token=${priya}`)
  await until(() => second.closed)
  check('a second agent cannot hijack a call in progress', second.closed?.code === 4409)

  await sleep(1200)
  visitor.send({ type: 'hangup' })
  check('hangup relayed', !!(await agent.waitFor('hangup')))
  const logged = await until(async () => (await api(`/api/conversations/${marcusConv}/messages`, { token: rahul })).json.items.find((m: any) => m.event === 'call_answered'))
  check('answered call is logged into the thread once, with duration', !!logged && /Inbound video call · \ds · Answered by Rahul Mehta/.test(logged.text), logged?.text)
  const endEvt = await until(() => sStream.events.find(e => e.event === 'call.ended'))
  check('call.ended is broadcast', endEvt?.data.call.endReason === 'completed')

  // Unanswered: ring timeout → both sides told, missed call logged.
  visitor.inbox.length = 0
  agent.sock.close()
  await sleep(200)
  visitor.send({ type: 'call-request', video: false })
  const timedOut = await visitor.waitFor('hangup', 6000)
  const missed = await until(async () => (await api(`/api/conversations/${marcusConv}/messages`, { token: rahul })).json.items.find((m: any) => m.event === 'call_missed'))
  check('an unanswered call times out server-side and is logged as missed', !!timedOut && missed?.text === 'Inbound voice call · No answer', missed?.text)
  const cancelPush = await until(async () => (await pushes()).find(p => p.payload.kind === 'call_cancelled' && p.userId === rahulId))
  check('phones that rang are told to stop ringing', !!cancelPush)
  const dbCalls = (await db.query(`SELECT state, end_reason FROM call_sessions WHERE conversation_id = $1 ORDER BY started_at`, [marcusConv])).rows
  check('call sessions are recorded with outcomes', dbCalls.length === 2 && dbCalls.every(r => r.state === 'ended') && dbCalls[0].end_reason === 'completed' && dbCalls[1].end_reason === 'no-answer')

  visitor.sock.close()
  sStream.close()

  // ── Logout ────────────────────────────────────────────────────────────────
  const outLogin = await login('priya@acmecorp.com', 'super123', 'device-priya-1')
  await api('/api/me/presence', { method: 'PUT', token: outLogin.json.accessToken, body: { presence: 'online' } })
  await db.query(`UPDATE refresh_tokens SET revoked_at = now(), revoked_reason = 'logout' WHERE user_id = (SELECT id FROM users WHERE email = 'priya@acmecorp.com') AND token_hash <> encode(sha256($1::bytea), 'hex')`, [outLogin.json.refreshToken])
  const lo = await api('/api/auth/logout', { body: { refreshToken: outLogin.json.refreshToken } })
  const afterLogout = await api('/api/auth/refresh', { body: { refreshToken: outLogin.json.refreshToken } })
  const priyaRow = (await db.query(`SELECT presence FROM users WHERE email = 'priya@acmecorp.com'`)).rows[0]
  const priyaDevices = (await db.query(`SELECT count(*)::int n FROM devices WHERE device_id = 'device-priya-1'`)).rows[0].n
  check('logout revokes the session, unregisters the device, and goes offline', lo.status === 204 && afterLogout.status === 401 && priyaRow.presence === 'offline' && priyaDevices === 0)

  await db.end()
}

try {
  await main()
} catch (err) {
  check('verification ran to completion', false, (err as Error).stack ?? String(err))
} finally {
  // Wait for the API to really exit before stopping Postgres: stopping the
  // cluster under live connections can orphan a worker on Windows, which then
  // blocks the next run with "pre-existing shared memory block is still in use".
  if (server && server.exitCode === null) {
    const exited = new Promise(resolve => server!.once('exit', resolve))
    server.kill()
    await Promise.race([exited, sleep(5000)])
  }
  await pgServer.stop().catch(() => {})
  // PostgreSQL 18 on Windows can leave an io_worker running after the
  // postmaster exits. Reap the postmaster's children so nothing leaks.
  if (process.platform === 'win32' && postmasterPid) {
    try {
      execFileSync('powershell.exe', ['-NoProfile', '-Command',
        `Get-CimInstance Win32_Process -Filter "ParentProcessId=${postmasterPid}" | ForEach-Object { Stop-Process -Id $_.ProcessId -Force }`],
      { stdio: 'ignore' })
    } catch { /* nothing left to reap */ }
  }
  rmSync(DATA_DIR, { recursive: true, force: true })
  rmSync(UPLOAD_DIR, { recursive: true, force: true })
  const failed = results.filter(r => !r.pass)
  console.log(`\n${results.length - failed.length}/${results.length} checks passed`)
  process.exit(failed.length ? 1 : 0)
}
