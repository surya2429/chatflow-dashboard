import { config as loadDotenv } from 'dotenv'
import { fileURLToPath } from 'node:url'
import { z } from 'zod'

// The package's own .env, wherever the process was started from (a process
// manager, a monorepo root, a debugger) — not whatever .env is in the cwd.
// Real environment variables still win: dotenv never overrides them.
loadDotenv({ path: fileURLToPath(new URL('../../.env', import.meta.url)) })

/**
 * Fail fast on boot. Every config value the service touches is declared and
 * validated here — nothing reads `process.env` directly elsewhere.
 *
 * Channel and push credentials are optional on purpose: without them the
 * service still runs end to end, and the corresponding adapter logs what it
 * would have sent instead of calling Meta / FCM / APNs. That keeps local dev
 * and CI free of production secrets.
 */
const optional = z.string().min(1).optional()
const bool = z.enum(['true', 'false']).default('false').transform(v => v === 'true')
const csv = (fallback = '') =>
  z.string().default(fallback).transform(v => v.split(',').map(s => s.trim()).filter(Boolean))

const EnvSchema = z.object({
  PORT: z.coerce.number().int().positive().default(8090),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),
  // Behind a TLS-terminating load balancer, trust X-Forwarded-Proto/For.
  TRUST_PROXY: bool,
  // Terminate TLS in-process instead (serves https:// and wss:// directly).
  TLS_CERT_PATH: optional,
  TLS_KEY_PATH: optional,
  CORS_ORIGINS: csv(),

  DATABASE_URL: z.string().url(),
  PG_POOL_MAX: z.coerce.number().int().positive().default(20),
  // On boot, how long to wait for PostgreSQL to accept connections before giving up
  // (it may still be starting — e.g. both launched together, or after a restart).
  DB_STARTUP_WAIT_SECONDS: z.coerce.number().int().min(0).default(60),

  // ── Auth ────────────────────────────────────────────────────────────────
  JWT_ACCESS_SECRET: z.string().min(32, 'use at least 32 random bytes'),
  JWT_ISSUER: z.string().default('chatflow-agent-api'),
  ACCESS_TOKEN_TTL_SECONDS: z.coerce.number().int().positive().default(15 * 60),
  // Mobile sessions are meant to last: an agent should not be signed out of
  // their phone every week. Rotation + reuse detection is what makes a long
  // lifetime acceptable (see migrations/001_auth.sql).
  REFRESH_TOKEN_TTL_DAYS: z.coerce.number().int().positive().default(90),

  // Shared secret for service-to-service calls into /internal/* — the
  // WhatsApp/Instagram webhook pipeline in backend/ forwards inbound
  // messages here with it.
  INTERNAL_API_KEY: z.string().min(24),

  // ── Presence / routing ─────────────────────────────────────────────────
  PRESENCE_AWAY_AFTER_SECONDS: z.coerce.number().int().positive().default(15 * 60),
  WHATSAPP_WINDOW_HOURS: z.coerce.number().int().positive().default(24),

  // ── WebRTC ICE ─────────────────────────────────────────────────────────
  STUN_URLS: csv('stun:stun.l.google.com:19302'),
  // coturn with `use-auth-secret` / `static-auth-secret`: credentials are
  // minted per session and expire, so nothing long-lived ships in the app.
  TURN_URLS: csv(),
  TURN_SHARED_SECRET: optional,
  TURN_CREDENTIAL_TTL_SECONDS: z.coerce.number().int().positive().default(3600),
  CALL_RING_TIMEOUT_SECONDS: z.coerce.number().int().positive().default(35),

  // ── Push: FCM (Android) ────────────────────────────────────────────────
  // Service-account JSON, inline or as a path.
  FCM_SERVICE_ACCOUNT_JSON: optional,
  FCM_SERVICE_ACCOUNT_PATH: optional,
  // ── Push: APNs (iOS) ───────────────────────────────────────────────────
  APNS_KEY_P8: optional,          // contents of AuthKey_XXXX.p8 (literal \n allowed)
  APNS_KEY_PATH: optional,
  APNS_KEY_ID: optional,
  APNS_TEAM_ID: optional,
  APNS_BUNDLE_ID: optional,
  APNS_PRODUCTION: bool,

  // ── Channel senders (optional — logged instead of sent when unset) ─────
  WA_PHONE_NUMBER_ID: optional,
  WA_ACCESS_TOKEN: optional,
  WA_GRAPH_API_VERSION: z.string().default('v20.0'),
  IG_ACCESS_TOKEN: optional,
  IG_ACCOUNT_ID: optional,
  IG_GRAPH_API_VERSION: z.string().default('v21.0'),

  // ── Attachments ────────────────────────────────────────────────────────
  // Where uploaded files are kept (local file store). Relative to the package.
  UPLOAD_DIR: z.string().default('uploads'),
  // Hard cap on any single upload; per-channel limits are lower (attachmentPolicy.ts).
  MAX_UPLOAD_MB: z.coerce.number().int().positive().max(100).default(25),
  // Key for signing file links. Defaults to one derived from JWT_ACCESS_SECRET.
  FILE_URL_SECRET: z.string().min(32).optional(),
  // This service's public https origin. Meta fetches media from it, so
  // WhatsApp/Instagram attachments need it once those channels are live.
  PUBLIC_BASE_URL: z.string().url().optional(),
})

export type Env = z.infer<typeof EnvSchema>

function loadEnv(): Env {
  const parsed = EnvSchema.safeParse(process.env)
  if (!parsed.success) {
    const issues = parsed.error.issues.map(i => `  - ${i.path.join('.')}: ${i.message}`).join('\n')
    // eslint-disable-next-line no-console
    console.error(`Invalid environment configuration:\n${issues}`)
    process.exit(1)
  }
  const env = parsed.data
  // Refuse to run in production with no TLS anywhere in the path: every
  // request carries a bearer token and the signaling socket carries SDP.
  if (env.NODE_ENV === 'production' && !env.TRUST_PROXY && !(env.TLS_CERT_PATH && env.TLS_KEY_PATH)) {
    // eslint-disable-next-line no-console
    console.error('Production requires TLS: set TLS_CERT_PATH/TLS_KEY_PATH, or TRUST_PROXY=true behind a TLS-terminating proxy.')
    process.exit(1)
  }
  return env
}

export const env = loadEnv()
