import { readFileSync } from 'node:fs'
import { SignJWT, importPKCS8 } from 'jose'
import { env } from '../config/env.js'
import { logger } from '../config/logger.js'
import { toDataStrings, type PushPayload, type PushProvider, type PushResult } from './types.js'

/**
 * FCM HTTP v1 (Android). Authenticates as a service account by signing a JWT
 * and exchanging it for a one-hour OAuth token, cached until shortly before it
 * expires. No firebase-admin dependency — this is the whole of what it does
 * for sending.
 */
interface ServiceAccount { project_id: string; client_email: string; private_key: string }

function loadServiceAccount(): ServiceAccount | null {
  try {
    const raw = env.FCM_SERVICE_ACCOUNT_JSON ?? (env.FCM_SERVICE_ACCOUNT_PATH ? readFileSync(env.FCM_SERVICE_ACCOUNT_PATH, 'utf8') : null)
    return raw ? (JSON.parse(raw) as ServiceAccount) : null
  } catch (err) {
    logger.error({ err }, '[push:fcm] could not load service account — FCM disabled')
    return null
  }
}

const account = loadServiceAccount()
let cached: { token: string; expiresAt: number } | null = null

async function accessToken(sa: ServiceAccount): Promise<string> {
  if (cached && cached.expiresAt > Date.now() + 60_000) return cached.token
  const key = await importPKCS8(sa.private_key, 'RS256')
  const assertion = await new SignJWT({ scope: 'https://www.googleapis.com/auth/firebase.messaging' })
    .setProtectedHeader({ alg: 'RS256', typ: 'JWT' })
    .setIssuer(sa.client_email)
    .setAudience('https://oauth2.googleapis.com/token')
    .setIssuedAt()
    .setExpirationTime('1h')
    .sign(key)
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion }),
  })
  if (!res.ok) throw new Error(`FCM OAuth exchange failed (${res.status})`)
  const json = (await res.json()) as { access_token: string; expires_in: number }
  cached = { token: json.access_token, expiresAt: Date.now() + json.expires_in * 1000 }
  return cached.token
}

export const fcmProvider: PushProvider = {
  name: 'fcm',
  configured: account !== null,

  async send(token: string, payload: PushPayload): Promise<PushResult> {
    if (!account) return { ok: false, error: 'not_configured' }
    const isCall = payload.kind === 'call' || payload.kind === 'call_cancelled'
    const message: Record<string, unknown> = {
      token,
      data: toDataStrings(payload),
      android: {
        // Calls are DATA-ONLY and high priority: the app's headless handler
        // must run (to raise the ConnectionService incoming-call screen)
        // rather than the OS drawing a plain notification. A call that
        // arrives after the ring timeout is useless, hence the short TTL.
        priority: 'high',
        ttl: isCall ? '30s' : '86400s',
        ...(isCall ? {} : {
          notification: {
            channel_id: payload.kind === 'message' ? 'messages' : 'assignments',
            tag: payload.conversationId, // one notification per chat, updated in place
          },
        }),
      },
    }
    if (!isCall) message.notification = { title: payload.title, body: payload.body }

    try {
      const res = await fetch(`https://fcm.googleapis.com/v1/projects/${account.project_id}/messages:send`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${await accessToken(account)}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ message }),
      })
      if (res.ok) return { ok: true }
      const body = (await res.json().catch(() => ({}))) as { error?: { status?: string; details?: { errorCode?: string }[] } }
      const code = body.error?.details?.find(d => d.errorCode)?.errorCode ?? body.error?.status
      return { ok: false, error: code ?? String(res.status), deadToken: code === 'UNREGISTERED' || res.status === 404 }
    } catch (err) {
      return { ok: false, error: (err as Error).message }
    }
  },
}
