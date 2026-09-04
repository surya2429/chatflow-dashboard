/**
 * WhatsApp Business Calling API — Production Node.js Server
 * ══════════════════════════════════════════════════════════
 *
 * Modules:
 *  1. callSettings    — Configure / get calling settings
 *  2. callPermissions — User call permissions
 *  3. businessCalls   — Business-initiated calls
 *  4. userCalls       — User-initiated calls
 *  5. callButtons     — Call button messages & deep links
 *  6. webhookServer   — Webhook receiver (Express router)
 *  7. sipConfig       — SIP integration utilities
 *  8. sdpUtils        — SDP generation & validation
 *  9. callAnalytics   — Analytics
 * 10. errorHandler    — Error handling middleware & error code catalogue
 *
 * Usage:
 *   cp .env.example .env  (fill in your credentials)
 *   npm install
 *   npm run dev           (or npm start for production)
 *
 * Webhook URL to register in Meta App Dashboard:
 *   https://{your-domain}/webhook
 *   Subscribe to: calls, account_settings_update, account_update
 */

import express from 'express'
import { config }            from './config.js'
import { webhookRouter }     from './modules/webhookServer.js'
import { settingsRouter }    from './modules/callSettings.js'
import { permissionsRouter } from './modules/callPermissions.js'
import { businessCallsRouter } from './modules/businessCalls.js'
import { userCallsRouter }   from './modules/userCalls.js'
import { callButtonsRouter } from './modules/callButtons.js'
import { sipRouter }         from './modules/sipConfig.js'
import { sdpRouter }         from './modules/sdpUtils.js'
import { analyticsRouter }   from './modules/callAnalytics.js'
import { errorRouter, globalErrorHandler } from './modules/errorHandler.js'
import { createLogger }      from './utils/logger.js'

const log = createLogger('server')
const app = express()

// ── Parse JSON body ───────────────────────────────────────────────────────────
app.use(express.json({ limit: '1mb' }))

// ── Health check ──────────────────────────────────────────────────────────────
app.get('/health', (req, res) => {
  res.json({
    status:   'ok',
    service:  'wa-calling-server',
    version:  '1.0.0',
    uptime:   process.uptime(),
    ts:       new Date().toISOString(),
    config: {
      phoneNumberId: config.phoneNumberId,
      wabaId:        config.wabaId,
      sipEnabled:    !!config.sipServerHostname,
      port:          config.port,
    },
  })
})

// ── Webhook (GET = verification, POST = events) ───────────────────────────────
// Register: https://your-domain.com/webhook
// Subscribe fields: calls, account_settings_update, account_update
app.use('/webhook', webhookRouter)

// ── REST API routes ───────────────────────────────────────────────────────────
app.use('/api/settings',       settingsRouter)
app.use('/api/permissions',    permissionsRouter)
app.use('/api/business-calls', businessCallsRouter)
app.use('/api/user-calls',     userCallsRouter)
app.use('/api/call-buttons',   callButtonsRouter)
app.use('/api/sip',            sipRouter)
app.use('/api/sdp',            sdpRouter)
app.use('/api/analytics',      analyticsRouter)
app.use('/api/errors',         errorRouter)

// ── API reference ─────────────────────────────────────────────────────────────
app.get('/api', (req, res) => {
  res.json({
    service: 'WhatsApp Business Calling API Server',
    version: '1.0.0',
    routes: {
      webhook:       'GET|POST /webhook',
      settings: {
        get:              'GET    /api/settings',
        update:           'PUT    /api/settings',
        disable:          'POST   /api/settings/disable',
        disableCallHours: 'POST   /api/settings/disable-call-hours',
        resetSipPassword: 'POST   /api/settings/reset-sip-password',
      },
      permissions: {
        state:            'GET    /api/permissions/:userWaId',
        canCall:          'GET    /api/permissions/:userWaId/can-call',
        sendRequest:      'POST   /api/permissions/request',
        sendTemplate:     'POST   /api/permissions/request/template',
        createTemplate:   'POST   /api/permissions/templates',
      },
      businessCalls: {
        initiate:   'POST /api/business-calls/initiate',
        terminate:  'POST /api/business-calls/:callId/terminate',
        active:     'GET  /api/business-calls/active',
        get:        'GET  /api/business-calls/:callId',
      },
      userCalls: {
        preAccept:  'POST /api/user-calls/:callId/pre-accept',
        accept:     'POST /api/user-calls/:callId/accept',
        reject:     'POST /api/user-calls/:callId/reject',
        terminate:  'POST /api/user-calls/:callId/terminate',
      },
      callButtons: {
        send:            'POST /api/call-buttons/send',
        createTemplate:  'POST /api/call-buttons/templates',
        sendTemplate:    'POST /api/call-buttons/templates/send',
        deepLink:        'GET  /api/call-buttons/deeplink?phone=&payload=',
      },
      sip: {
        constants:    'GET  /api/sip/constants',
        config:       'GET  /api/sip/config?phone=&password=&pbx=',
        digestAuth:   'POST /api/sip/digest-auth',
        parseHeaders: 'POST /api/sip/parse-headers',
      },
      sdp: {
        generateOffer:  'POST /api/sdp/offer',
        generateAnswer: 'POST /api/sdp/answer',
        validate:       'POST /api/sdp/validate',
        parse:          'POST /api/sdp/parse',
        bandwidth:      'GET  /api/sdp/bandwidth?mbps=&codec=',
      },
      analytics: {
        full:  'GET /api/analytics',
        local: 'GET /api/analytics/local',
      },
      errors: {
        codes:  'GET /api/errors/codes',
        lookup: 'GET /api/errors/codes/:code',
      },
    },
  })
})

// ── 404 ───────────────────────────────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ error: `Route not found: ${req.method} ${req.path}` })
})

// ── Global error handler (MUST be last) ──────────────────────────────────────
app.use(globalErrorHandler)

// ── Start ─────────────────────────────────────────────────────────────────────
app.listen(config.port, () => {
  log.info(`WhatsApp Calling Server running on port ${config.port}`, {
    health:   `http://localhost:${config.port}/health`,
    api:      `http://localhost:${config.port}/api`,
    webhook:  `http://localhost:${config.port}/webhook`,
    sipMode:  config.sipServerHostname ? `SIP → ${config.sipServerHostname}:${config.sipServerPort}` : 'Graph API mode',
  })
})

export default app
