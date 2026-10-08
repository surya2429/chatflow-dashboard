import { Router } from 'express'
import { env } from '../config/env.js'
import { logger } from '../config/logger.js'
import { createBillingService } from '../billing/service.js'
import { createRazorpay } from '../billing/razorpay.js'
import { pgBillingStore } from '../billing/pgStore.js'
import { loadLogo } from '../billing/logo.js'

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
  supplierStateCode: env.BILLING_SUPPLIER_STATE_CODE,
  autopayEngine: env.BILLING_AUTOPAY_ENGINE,
  seller: {
    ...(env.BILLING_SELLER_NAME && { name: env.BILLING_SELLER_NAME }),
    ...(env.BILLING_SELLER_ADDRESS && { address: env.BILLING_SELLER_ADDRESS }),
    ...(env.BILLING_SELLER_GSTIN && { gstin: env.BILLING_SELLER_GSTIN }),
    sac: env.BILLING_SAC_CODE, prefix: env.BILLING_INVOICE_PREFIX,
    logo: loadLogo(env.BILLING_LOGO_FILE),
  },
})

/* Failed renewals are collected on a schedule (see billing/dunning.ts): this timer is what
   sends each reminder and suspends a plan when the window closes. Safe to run often. */
setInterval(() => { billing.runDue().catch((err) => logger.error({ err }, 'billing dunning run failed')) }, 5 * 60 * 1000).unref()

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
      ip: req.ip,
      userAgent: req.header('user-agent'),
    })
    if (result.contentType) res.status(result.status).type(result.contentType).send(result.body as string)
    else res.status(result.status).json(result.body)
  } catch (err) {
    logger.error({ err, path: req.path }, 'billing request failed')
    res.status(500).json({ error: 'internal_server_error' })
  }
})
