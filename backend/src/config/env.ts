import 'dotenv/config'
import { z } from 'zod'

/**
 * Fail fast on boot rather than surfacing cryptic `undefined` errors deep
 * inside a worker at 2am. Every config value the app touches is declared
 * and validated here — nothing reads `process.env` directly elsewhere.
 */
const EnvSchema = z.object({
  PORT: z.coerce.number().int().positive().default(8080),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),

  DATABASE_URL: z.string().url(),
  PG_POOL_MAX: z.coerce.number().int().positive().default(20),

  REDIS_URL: z.string().url(),

  WA_PHONE_NUMBER_ID: z.string().min(1),
  WA_BUSINESS_ACCOUNT_ID: z.string().min(1),
  WA_GRAPH_API_VERSION: z.string().regex(/^v\d+\.\d+$/, 'expected format vXX.X, e.g. v20.0'),
  WA_ACCESS_TOKEN: z.string().min(1),
  WA_APP_SECRET: z.string().min(1),
  WA_WEBHOOK_VERIFY_TOKEN: z.string().min(1),

  MARKETING_QUEUE_CONCURRENCY: z.coerce.number().int().positive().default(5),
  MARKETING_QUEUE_RATE_PER_SECOND: z.coerce.number().int().positive().default(20),
  PRIORITY_QUEUE_CONCURRENCY: z.coerce.number().int().positive().default(20),

  SERVICE_WINDOW_HOURS: z.coerce.number().int().positive().default(24),

  // ── Instagram API with Instagram Login ("Business Login") ────────────────
  // https://developers.facebook.com/docs/instagram-platform/instagram-api-with-instagram-login/business-login
  IG_APP_ID: z.string().min(1),
  IG_APP_SECRET: z.string().min(1),
  IG_REDIRECT_URI: z.string().url(),
  IG_GRAPH_API_VERSION: z.string().regex(/^v\d+\.\d+$/, 'expected format vXX.X, e.g. v21.0').default('v21.0'),

  // ── Live-agent service (agent-api/) ──────────────────────────────────────
  // When set, inbound messages and delivery receipts are forwarded to it
  // (src/services/agentDeskClient.ts). Unset = not forwarded.
  AGENT_API_URL: z.string().url().optional(),
  AGENT_API_INTERNAL_KEY: z.string().min(24).optional(),

  // ── Razorpay billing (src/billing) ───────────────────────────────────────
  // Optional so the API still boots without them; /api/billing then reports
  // "not configured". The SECRET never leaves the server.
  RAZORPAY_KEY_ID: z.string().min(1).optional(),
  RAZORPAY_KEY_SECRET: z.string().min(1).optional(),
  RAZORPAY_WEBHOOK_SECRET: z.string().min(1).optional(),
  // GST added on top of plan prices (the price list is excl. GST).
  BILLING_GST_PERCENT: z.coerce.number().min(0).max(100).default(18),
  // GST state code of the state we are registered in (27 = Maharashtra). Customers in the
  // same state are charged CGST + SGST; everyone else IGST. Same total either way.
  // auto = saved-card autopay up to ₹15,000 (works on every Razorpay account), Subscriptions above that
  BILLING_AUTOPAY_ENGINE: z.enum(['auto', 'token', 'subscription']).default('auto'),
  BILLING_SUPPLIER_STATE_CODE: z.string().regex(/^\d{2}$/).default('36'),
  // Printed on every GST invoice. Set these to your registered business details and confirm
  // the SAC code with your CA — the defaults are placeholders.
  // Optional: the built-in defaults are Feso Social Media Private Limited (SMATBOT).
  BILLING_SELLER_NAME: z.string().min(1).optional(),
  BILLING_SELLER_ADDRESS: z.string().min(1).optional(),
  BILLING_SELLER_GSTIN: z.string().optional(),
  // Path to your logo file (PNG/SVG/JPG); the built-in SmatBot logo is used when unset.
  BILLING_LOGO_FILE: z.string().optional(),
  BILLING_SAC_CODE: z.string().regex(/^\d{4,8}$/).default('998314'),
  BILLING_INVOICE_PREFIX: z.string().regex(/^[A-Z0-9]{1,6}$/).default('SB'),
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
  return parsed.data
}

export const env = loadEnv()
