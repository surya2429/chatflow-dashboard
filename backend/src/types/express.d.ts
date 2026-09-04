import 'express'

declare module 'express-serve-static-core' {
  interface Request {
    /** Raw request body bytes, captured by the `verify` hook in `express.json()` — required for HMAC signature checks. */
    rawBody?: Buffer
  }
}
