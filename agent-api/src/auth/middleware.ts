import type { NextFunction, Request, Response } from 'express'
import { unauthorized } from '../http/errors.js'
import { verifyToken } from './tokens.js'
import type { Actor } from './policy.js'

declare module 'express-serve-static-core' {
  interface Request {
    actor?: Actor
  }
}

/**
 * Bearer auth for staff routes. The `access_token` query parameter is
 * accepted only on GET /api/events, because a browser EventSource cannot set
 * headers; everywhere else a token in the URL would leak into proxy logs.
 */
export function requireStaff(opts: { allowQueryToken?: boolean } = {}) {
  return (req: Request, _res: Response, next: NextFunction) => {
    const header = req.headers.authorization
    let token = header?.startsWith('Bearer ') ? header.slice(7) : undefined
    if (!token && opts.allowQueryToken && typeof req.query.access_token === 'string') {
      token = req.query.access_token
    }
    if (!token) return next(unauthorized('missing_token'))

    verifyToken(token, 'staff')
      .then((result) => {
        if (!result.ok) return next(unauthorized(result.reason === 'expired' ? 'token_expired' : 'invalid_token'))
        req.actor = { id: result.claims.sub, role: result.claims.role, name: result.claims.name }
        next()
      })
      .catch(next)
  }
}

/** For handlers mounted behind requireStaff. */
export function actorOf(req: Request): Actor {
  if (!req.actor) throw unauthorized()
  return req.actor
}
