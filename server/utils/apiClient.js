/**
 * Shared Graph API HTTP client.
 * Wraps axios with auth headers, base URL, timeout, and structured error normalization.
 */
import axios from 'axios'
import { config } from '../config.js'
import { createLogger } from './logger.js'

const log = createLogger('apiClient')

const client = axios.create({
  baseURL: config.baseUrl,
  headers: {
    Authorization:  `Bearer ${config.accessToken}`,
    'Content-Type': 'application/json',
  },
  timeout: 30_000,
})

// ── Request interceptor: log outbound calls ───────────────────────────────────
client.interceptors.request.use(req => {
  log.debug(`${req.method?.toUpperCase()} ${req.baseURL}${req.url}`, req.data)
  return req
})

// ── Response interceptor: unwrap data, normalize errors ──────────────────────
client.interceptors.response.use(
  res => {
    log.debug(`${res.status} ${res.config.url}`)
    return res.data
  },
  err => {
    const data    = err.response?.data
    const apiErr  = data?.error
    const message = apiErr?.message || err.message

    const normalized = new Error(message)
    normalized.code       = apiErr?.code
    normalized.type       = apiErr?.type
    normalized.fbtrace_id = apiErr?.fbtrace_id
    normalized.httpStatus = err.response?.status
    normalized.raw        = data

    log.error(`Graph API error [${normalized.code}]: ${message}`, {
      url:      err.config?.url,
      fbtrace:  normalized.fbtrace_id,
    })

    throw normalized
  }
)

export default client
