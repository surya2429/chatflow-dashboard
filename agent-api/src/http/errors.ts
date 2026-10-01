/**
 * Errors that map to a specific HTTP response. Anything else thrown from a
 * route is a 500. `code` is stable and machine-readable — the app branches on
 * it (e.g. `whatsapp_window_closed` opens the template picker).
 */
export class HttpError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message?: string,
    readonly details?: Record<string, unknown>,
  ) {
    super(message ?? code)
  }
}

export const badRequest = (code: string, message?: string, details?: Record<string, unknown>) =>
  new HttpError(400, code, message, details)
export const unauthorized = (code = 'unauthorized', message?: string) => new HttpError(401, code, message)
export const forbidden = (code = 'forbidden', message?: string) => new HttpError(403, code, message)
export const notFound = (code = 'not_found') => new HttpError(404, code)
export const conflict = (code: string, message?: string, details?: Record<string, unknown>) =>
  new HttpError(409, code, message, details)
