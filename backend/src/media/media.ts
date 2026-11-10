// media.ts — photos and videos a merchant uploads for the website chat (Property Cards, and anything else that needs a
// picture). Pure: no DB, no Express. The same code serves the API and the Vite dev server; only the store differs.
//
//   POST /api/webchat-media?bot=<id>      body = the raw file bytes     → { url, kind, mime, size }
//   GET  /api/webchat-media/<id>.<ext>    (public: visitors' browsers fetch these; supports Range for video seeking)
//
// What is accepted is decided by the file's own first bytes, never by its name or the Content-Type the browser sent, so a
// script renamed to .jpg is refused. SVG is not accepted at all (it can carry script). Files are served with their sniffed
// type, `nosniff`, and never as an attachment-less HTML page.
import { randomBytes } from 'node:crypto'

export const MAX_IMAGE_BYTES = 8 * 1024 * 1024
export const MAX_VIDEO_BYTES = 40 * 1024 * 1024
export const MAX_UPLOAD_BYTES = MAX_VIDEO_BYTES + 1024

export type MediaKind = 'image' | 'video'
export interface Sniffed { kind: MediaKind; mime: string; ext: string }

export class MediaError extends Error {
  constructor(message: string, public status = 400, public code = 'invalid_request') { super(message) }
}

const ascii = (b: Buffer, from: number, to: number) => b.subarray(from, to).toString('latin1')
const MP4_BRANDS = new Set(['isom', 'iso2', 'iso4', 'iso5', 'iso6', 'mp41', 'mp42', 'avc1', 'M4V ', 'dash', 'mmp4', 'MSNV'])

/** What a file really is, from its first bytes. null = not a photo or video we accept. */
export function sniff(b: Buffer): Sniffed | null {
  if (b.length < 12) return null
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return { kind: 'image', mime: 'image/jpeg', ext: 'jpg' }
  if (b[0] === 0x89 && ascii(b, 1, 4) === 'PNG') return { kind: 'image', mime: 'image/png', ext: 'png' }
  if (ascii(b, 0, 4) === 'GIF8') return { kind: 'image', mime: 'image/gif', ext: 'gif' }
  if (ascii(b, 0, 4) === 'RIFF' && ascii(b, 8, 12) === 'WEBP') return { kind: 'image', mime: 'image/webp', ext: 'webp' }
  if (ascii(b, 4, 8) === 'ftyp' && MP4_BRANDS.has(ascii(b, 8, 12))) return { kind: 'video', mime: 'video/mp4', ext: 'mp4' }
  if (b[0] === 0x1a && b[1] === 0x45 && b[2] === 0xdf && b[3] === 0xa3) return { kind: 'video', mime: 'video/webm', ext: 'webm' }
  return null
}

export interface MediaStore {
  put(rec: { id: string; botRef: string; mime: string; bytes: Buffer }): Promise<void>
  get(id: string): Promise<{ mime: string; bytes: Buffer } | null>
}

const BOT_REF = /^[A-Za-z0-9_-]{1,64}$/
const FILE = /^([a-f0-9]{32})\.(jpg|png|gif|webp|mp4|webm)$/

export async function handleUpload(botRef: unknown, body: unknown, store: MediaStore): Promise<{ status: number; body: unknown }> {
  try {
    if (typeof botRef !== 'string' || !BOT_REF.test(botRef)) throw new MediaError('Open the widget builder for a bot first.', 400)
    if (!Buffer.isBuffer(body) || body.length === 0) throw new MediaError('No file was received.', 400)
    const kind = sniff(body)
    if (!kind) throw new MediaError('That file type is not supported. Use a JPG, PNG, WebP or GIF photo, or an MP4 or WebM video.', 415, 'unsupported_type')
    const limit = kind.kind === 'image' ? MAX_IMAGE_BYTES : MAX_VIDEO_BYTES
    if (body.length > limit) throw new MediaError(`That ${kind.kind} is too large. Photos can be up to ${MAX_IMAGE_BYTES / 1048576} MB and videos up to ${MAX_VIDEO_BYTES / 1048576} MB.`, 413, 'too_large')
    const id = randomBytes(16).toString('hex')
    await store.put({ id, botRef, mime: kind.mime, bytes: body })
    return { status: 201, body: { url: `/api/webchat-media/${id}.${kind.ext}`, kind: kind.kind, mime: kind.mime, size: body.length } }
  } catch (err) {
    if (err instanceof MediaError) return { status: err.status, body: { error: err.code, message: err.message } }
    throw err
  }
}

/** "bytes=0-99", "bytes=500-", "bytes=-200" → the slice to send; 'invalid' → 416; null → no range asked. */
export function parseRange(header: string | undefined, size: number): { start: number; end: number } | 'invalid' | null {
  if (!header) return null
  const m = /^bytes=(\d*)-(\d*)$/.exec(header.trim())
  if (!m || (m[1] === '' && m[2] === '')) return 'invalid'
  let start: number, end: number
  if (m[1] === '') { const n = Number(m[2]); if (n === 0) return 'invalid'; start = Math.max(0, size - n); end = size - 1 }
  else { start = Number(m[1]); end = m[2] === '' ? size - 1 : Math.min(Number(m[2]), size - 1) }
  return start > end || start >= size ? 'invalid' : { start, end }
}

export async function handleGet(file: string, rangeHeader: string | undefined, store: MediaStore): Promise<{ status: number; headers: Record<string, string>; body: Buffer }> {
  const m = FILE.exec(file)
  const found = m ? await store.get(m[1]!) : null
  if (!found) return { status: 404, headers: { 'Content-Type': 'text/plain; charset=utf-8' }, body: Buffer.from('Not found') }
  const size = found.bytes.length
  const headers: Record<string, string> = {
    'Content-Type': found.mime, 'Accept-Ranges': 'bytes', 'X-Content-Type-Options': 'nosniff',
    'Cache-Control': 'public, max-age=31536000, immutable',        // the id is random and the content never changes
    'Cross-Origin-Resource-Policy': 'cross-origin', 'Access-Control-Allow-Origin': '*',    // widgets on other sites embed these
  }
  const r = parseRange(rangeHeader, size)
  if (r === 'invalid') return { status: 416, headers: { ...headers, 'Content-Range': `bytes */${size}` }, body: Buffer.alloc(0) }
  if (r) return { status: 206, headers: { ...headers, 'Content-Range': `bytes ${r.start}-${r.end}/${size}`, 'Content-Length': String(r.end - r.start + 1) }, body: found.bytes.subarray(r.start, r.end + 1) }
  return { status: 200, headers: { ...headers, 'Content-Length': String(size) }, body: found.bytes }
}
