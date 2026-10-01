import type { NextFunction, Request, RequestHandler, Response } from 'express'
import type { ZodType, ZodTypeDef } from 'zod'
import { badRequest } from './errors.js'

/** Express 4 doesn't catch rejected promises; this forwards them to the error middleware. */
export function route(fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>): RequestHandler {
  return (req, res, next) => { fn(req, res, next).catch(next) }
}

export function parse<T>(schema: ZodType<T, ZodTypeDef, unknown>, input: unknown): T {
  const result = schema.safeParse(input)
  if (!result.success) {
    throw badRequest('validation_failed', 'Request failed validation', {
      issues: result.error.issues.map(i => ({ path: i.path.join('.'), message: i.message })),
    })
  }
  return result.data
}
