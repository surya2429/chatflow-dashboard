import { Router } from 'express'
import { z } from 'zod'
import { parse, route } from '../http/async.js'
import { forbidden, notFound } from '../http/errors.js'
import { attachmentRepository } from '../db/repositories/attachmentRepository.js'
import { fileStore } from '../storage/fileStore.js'
import { verifyFileSignature } from '../storage/signedUrl.js'

/**
 * GET /api/files/:id/:name?exp=…&sig=… — serves an attachment to whoever holds
 * a valid signed link (see storage/signedUrl.ts). Mounted before the staff
 * routers: the signature is the credential, so images load in <Image>, in the
 * website widget, and for Meta's media fetcher.
 *
 * Files are user content from outside, so they are served defensively: the
 * stored (sniffed) type, never guessed; nosniff; documents as downloads; and a
 * sandbox CSP in case a browser renders one anyway.
 */
export const filesRouter = Router()

const INLINE = /^(image|video|audio)\//

filesRouter.get(['/files/:id', '/files/:id/:name'], route(async (req, res) => {
  const id = parse(z.string().uuid(), req.params.id)
  const { exp, sig } = req.query as { exp?: string; sig?: string }
  if (!verifyFileSignature(id, exp, sig)) throw forbidden('invalid_file_link', 'This link has expired')

  const row = await attachmentRepository.findById(id)
  const data = row && await fileStore.get(row.storage_key)
  if (!row || !data) throw notFound('file_not_found')

  const disposition = INLINE.test(row.mime_type) ? 'inline' : 'attachment'
  res.setHeader('Content-Type', row.mime_type)
  res.setHeader('Content-Disposition', `${disposition}; filename*=UTF-8''${encodeURIComponent(row.file_name)}`)
  res.setHeader('X-Content-Type-Options', 'nosniff')
  res.setHeader('Content-Security-Policy', "default-src 'none'; sandbox")
  res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin')
  res.setHeader('Cache-Control', 'private, max-age=3600')
  res.end(data)
}))
