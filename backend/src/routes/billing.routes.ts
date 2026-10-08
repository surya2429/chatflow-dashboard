import { Router } from 'express'
import { env } from '../config/env.js'
import { logger } from '../config/logger.js'
import { createBillingService } from '../billing/service.js'
import { createRazorpay } from '../billing/razorpay.js'
import { pgBillingStore } from '../billing/pgStore.js'

export const billingRouter = Router()

/* Without Razorpay keys the service still answers /config ("not configured"),
   so the dashboard can show a clear message instead of a network error. */
const razorpay = env.RAZORPAY_KEY_ID && env.RAZORPAY_KEY_SECRET
  ? createRazorpay({ keyId: env.RAZORPAY_KEY_ID, keySecret: env.RAZORPAY_KEY_SECRET })
  : undefined

const billing = createBillingService({
  store: pgBillingStore,
  razorpay,
  keyId: env.RAZORPAY_KEY_ID,
  webhookSecret: env.RAZORPAY_WEBHOOK_SECRET,
  gstPercent: env.BILLING_GST_PERCENT,
})

/* Until requests carry an authenticated client, one workspace stands in for it —
   same assumption bots.routes.ts and instagram.routes.ts make. */
const DEFAULT_WORKSPACE = 'default'

billingRouter.all('/billing/*', async (req, res) => {
  try {
    const result = await billing.handle({
      method: req.method,
      path: req.path.replace(/^\/billing/, '') || '/',
      body: req.body as Record<string, unknown>,
      rawBody: req.rawBody,        // exact bytes, captured in app.ts — webhook signatures need them
      headers: { 'x-razorpay-signature': req.header('x-razorpay-signature') },
      workspaceId: req.header('x-workspace-id') || DEFAULT_WORKSPACE,
    })
    res.status(result.status).json(result.body)
  } catch (err) {
    logger.error({ err, path: req.path }, 'billing request failed')
    res.status(500).json({ error: 'internal_server_error' })
  }
})
