import http2 from 'node:http2'
import { readFileSync } from 'node:fs'
import { SignJWT, importPKCS8, type KeyLike } from 'jose'
import { env } from '../config/env.js'
import { logger } from '../config/logger.js'
import { toDataStrings, type PushPayload, type PushProvider, type PushResult } from './types.js'

/**
 * APNs over HTTP/2 with token (.p8) auth (iOS).
 *
 * Two push types go through here:
 *   - `alert` to the regular device token — messages, assignments.
 *   - `voip` to the PushKit token — incoming calls. iOS requires the app to
 *     report every VoIP push to CallKit immediately, and in return it will
 *     wake a killed app to do so. That is the only reliable way to ring a
 *     locked iPhone; an alert push cannot start CallKit.
 */
const keyPem = env.APNS_KEY_P8?.replace(/\\n/g, '\n') ?? (env.APNS_KEY_PATH ? safeRead(env.APNS_KEY_PATH) : undefined)
const configured = Boolean(keyPem && env.APNS_KEY_ID && env.APNS_TEAM_ID && env.APNS_BUNDLE_ID)
const host = env.APNS_PRODUCTION ? 'https://api.push.apple.com' : 'https://api.sandbox.push.apple.com'

function safeRead(path: string): string | undefined {
  try { return readFileSync(path, 'utf8') } catch (err) {
    logger.error({ err }, '[push:apns] could not read key file — APNs disabled')
    return undefined
  }
}

let signingKey: KeyLike | null = null
// Apple rejects tokens older than an hour and throttles ones refreshed more
// often than every 20 minutes; 50 minutes sits between.
let jwtCache: { token: string; at: number } | null = null
let session: http2.ClientHttp2Session | null = null

async function providerToken(): Promise<string> {
  if (jwtCache && Date.now() - jwtCache.at < 50 * 60_000) return jwtCache.token
  signingKey ??= await importPKCS8(keyPem!, 'ES256')
  const token = await new SignJWT({})
    .setProtectedHeader({ alg: 'ES256', kid: env.APNS_KEY_ID! })
    .setIssuer(env.APNS_TEAM_ID!)
    .setIssuedAt()
    .sign(signingKey)
  jwtCache = { token, at: Date.now() }
  return token
}

function getSession(): http2.ClientHttp2Session {
  if (session && !session.closed && !session.destroyed) return session
  session = http2.connect(host)
  session.on('error', (err) => { logger.warn({ err }, '[push:apns] session error'); session = null })
  session.on('goaway', () => { session = null })
  return session
}

export const apnsProvider: PushProvider = {
  name: 'apns',
  configured,

  async send(token: string, payload: PushPayload, opts: { voip?: boolean }): Promise<PushResult> {
    if (!configured) return { ok: false, error: 'not_configured' }
    const voip = !!opts.voip
    const body = voip
      ? { ...toDataStrings(payload) }
      : {
          aps: {
            alert: { title: payload.title, body: payload.body },
            sound: 'default',
            'thread-id': payload.conversationId, // groups a chat's notifications
            'mutable-content': 1,
          },
          ...toDataStrings(payload),
        }

    const headers = {
      ':method': 'POST',
      ':path': `/3/device/${token}`,
      authorization: `bearer ${await providerToken()}`,
      'apns-topic': voip ? `${env.APNS_BUNDLE_ID}.voip` : env.APNS_BUNDLE_ID!,
      'apns-push-type': voip ? 'voip' : 'alert',
      'apns-priority': '10',
      // A ring delivered after the caller gave up is worse than none.
      'apns-expiration': voip ? String(Math.floor(Date.now() / 1000) + 30) : '0',
      'apns-collapse-id': payload.kind === 'message' ? payload.conversationId.slice(0, 64) : undefined,
    }

    return new Promise<PushResult>((resolve) => {
      let req: http2.ClientHttp2Stream
      try {
        req = getSession().request(Object.fromEntries(Object.entries(headers).filter(([, v]) => v !== undefined)))
      } catch (err) {
        resolve({ ok: false, error: (err as Error).message })
        return
      }
      let status = 0
      let data = ''
      req.setEncoding('utf8')
      req.on('response', (h) => { status = Number(h[':status']) })
      req.on('data', (chunk: string) => { data += chunk })
      req.on('end', () => {
        if (status === 200) return resolve({ ok: true })
        let reason = String(status)
        try { reason = (JSON.parse(data) as { reason?: string }).reason ?? reason } catch { /* keep status */ }
        resolve({ ok: false, error: reason, deadToken: status === 410 || reason === 'BadDeviceToken' || reason === 'Unregistered' })
      })
      req.on('error', (err) => resolve({ ok: false, error: err.message }))
      req.setTimeout(10_000, () => { req.close(); resolve({ ok: false, error: 'timeout' }) })
      req.end(JSON.stringify(body))
    })
  },
}
