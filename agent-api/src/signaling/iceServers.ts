import { createHmac } from 'node:crypto'
import { env } from '../config/env.js'

export interface IceServer { urls: string | string[]; username?: string; credential?: string }

/**
 * ICE servers for one participant.
 *
 * The old relay was STUN-only. STUN tells a peer its public address, which is
 * enough when at least one side has an open NAT; behind symmetric NAT — which
 * is most mobile carrier networks — the peers can't reach each other directly
 * and media must be relayed through TURN.
 *
 * TURN credentials are minted per request using coturn's REST-API scheme
 * (`use-auth-secret`): username = "<expiry>:<id>", password =
 * base64(HMAC-SHA1(secret, username)). coturn verifies them with the same
 * shared secret and rejects them after expiry, so a credential lifted from a
 * phone is useless an hour later and no static TURN password ships in the app.
 */
export function iceServersFor(participantId: string): IceServer[] {
  const servers: IceServer[] = env.STUN_URLS.length ? [{ urls: env.STUN_URLS }] : []
  if (env.TURN_URLS.length && env.TURN_SHARED_SECRET) {
    const expiry = Math.floor(Date.now() / 1000) + env.TURN_CREDENTIAL_TTL_SECONDS
    const username = `${expiry}:${participantId}`
    const credential = createHmac('sha1', env.TURN_SHARED_SECRET).update(username).digest('base64')
    servers.push({ urls: env.TURN_URLS, username, credential })
  }
  return servers
}

export function turnConfigured(): boolean {
  return env.TURN_URLS.length > 0 && !!env.TURN_SHARED_SECRET
}
