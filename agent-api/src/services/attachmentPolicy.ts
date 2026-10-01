import type { Channel } from '../db/repositories/conversationRepository.js'

/**
 * What each channel accepts, and checks that a file is what it claims to be.
 *
 * Limits follow Meta's documented caps (WhatsApp Cloud API media types,
 * Instagram Messaging attachments), capped again by MAX_UPLOAD_MB. Checking
 * here rather than letting Meta reject it later means the agent finds out
 * before the customer is left waiting on a message that never arrives.
 */
export type AttachmentKind = 'image' | 'video' | 'audio' | 'document'

const MB = 1024 * 1024
const DOCS = [
  'application/pdf', 'text/plain', 'text/csv',
  'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint', 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
]

type Rule = { mimes: string[]; maxBytes: number }
const RULES: Record<Channel, Partial<Record<AttachmentKind, Rule>>> = {
  whatsapp: {
    image: { mimes: ['image/jpeg', 'image/png'], maxBytes: 5 * MB },
    video: { mimes: ['video/mp4', 'video/3gpp'], maxBytes: 16 * MB },
    audio: { mimes: ['audio/aac', 'audio/mp4', 'audio/mpeg', 'audio/amr', 'audio/ogg'], maxBytes: 16 * MB },
    document: { mimes: DOCS, maxBytes: 100 * MB },
  },
  // Instagram DMs take media but not files.
  instagram: {
    image: { mimes: ['image/jpeg', 'image/png', 'image/gif'], maxBytes: 8 * MB },
    video: { mimes: ['video/mp4', 'video/quicktime'], maxBytes: 25 * MB },
    audio: { mimes: ['audio/aac', 'audio/mp4', 'audio/mpeg', 'audio/wav'], maxBytes: 25 * MB },
  },
  webchat: {
    image: { mimes: ['image/jpeg', 'image/png', 'image/gif', 'image/webp'], maxBytes: 10 * MB },
    video: { mimes: ['video/mp4', 'video/webm'], maxBytes: 25 * MB },
    audio: { mimes: ['audio/mpeg', 'audio/mp4', 'audio/aac', 'audio/ogg', 'audio/webm', 'audio/wav'], maxBytes: 25 * MB },
    document: { mimes: DOCS, maxBytes: 25 * MB },
  },
}

export function kindOf(mime: string): AttachmentKind {
  if (mime.startsWith('image/')) return 'image'
  if (mime.startsWith('video/')) return 'video'
  if (mime.startsWith('audio/')) return 'audio'
  return 'document'
}

/** The rule for this file on this channel, or why there isn't one. */
export function ruleFor(channel: Channel, mime: string, hardCapBytes: number):
  { ok: true; kind: AttachmentKind; maxBytes: number } | { ok: false; allowed: string[] } {
  const kind = kindOf(mime)
  const rule = RULES[channel][kind]
  if (!rule || !rule.mimes.includes(mime)) {
    return { ok: false, allowed: Object.values(RULES[channel]).flatMap(r => r.mimes) }
  }
  return { ok: true, kind, maxBytes: Math.min(rule.maxBytes, hardCapBytes) }
}

// ── Content sniffing ────────────────────────────────────────────────────────
// The declared Content-Type is the client's word; the first bytes are the
// file's. A mismatch is refused, so an HTML page can't ride in as "image/png".

const at = (b: Buffer, offset: number, bytes: number[]) => bytes.every((v, i) => b[offset + i] === v)
const ascii = (b: Buffer, offset: number, s: string) => b.length >= offset + s.length && b.toString('latin1', offset, offset + s.length) === s

const SNIFF: Record<string, (b: Buffer) => boolean> = {
  'image/jpeg': b => at(b, 0, [0xff, 0xd8, 0xff]),
  'image/png': b => at(b, 0, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  'image/gif': b => ascii(b, 0, 'GIF87a') || ascii(b, 0, 'GIF89a'),
  'image/webp': b => ascii(b, 0, 'RIFF') && ascii(b, 8, 'WEBP'),
  'application/pdf': b => ascii(b, 0, '%PDF-'),
  'video/mp4': b => ascii(b, 4, 'ftyp'),
  'video/3gpp': b => ascii(b, 4, 'ftyp'),
  'video/quicktime': b => ascii(b, 4, 'ftyp') || ascii(b, 4, 'moov') || ascii(b, 4, 'wide') || ascii(b, 4, 'mdat'),
  'video/webm': b => at(b, 0, [0x1a, 0x45, 0xdf, 0xa3]),
  'audio/webm': b => at(b, 0, [0x1a, 0x45, 0xdf, 0xa3]),
  'audio/mp4': b => ascii(b, 4, 'ftyp'),
  'audio/ogg': b => ascii(b, 0, 'OggS'),
  'audio/wav': b => ascii(b, 0, 'RIFF') && ascii(b, 8, 'WAVE'),
  'audio/amr': b => ascii(b, 0, '#!AMR'),
  'audio/aac': b => b.length > 1 && b[0] === 0xff && (b[1]! & 0xf6) === 0xf0,
  'audio/mpeg': b => ascii(b, 0, 'ID3') || (b.length > 1 && b[0] === 0xff && (b[1]! & 0xe0) === 0xe0),
  // Office Open XML is a zip; the legacy formats are OLE compound files.
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': b => at(b, 0, [0x50, 0x4b, 0x03, 0x04]),
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': b => at(b, 0, [0x50, 0x4b, 0x03, 0x04]),
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': b => at(b, 0, [0x50, 0x4b, 0x03, 0x04]),
  'application/msword': b => at(b, 0, [0xd0, 0xcf, 0x11, 0xe0]),
  'application/vnd.ms-excel': b => at(b, 0, [0xd0, 0xcf, 0x11, 0xe0]),
  'application/vnd.ms-powerpoint': b => at(b, 0, [0xd0, 0xcf, 0x11, 0xe0]),
  // Plain text has no signature; refuse anything binary.
  'text/plain': b => !b.subarray(0, 4096).includes(0),
  'text/csv': b => !b.subarray(0, 4096).includes(0),
}

export function contentMatches(mime: string, data: Buffer): boolean {
  const sniff = SNIFF[mime]
  return sniff ? sniff(data) : false
}

/** Pixel size of a PNG, GIF or JPEG, so bubbles can reserve the right shape before the image loads. */
export function imageSize(mime: string, b: Buffer): { width: number; height: number } | null {
  try {
    if (mime === 'image/png' && b.length >= 24) return { width: b.readUInt32BE(16), height: b.readUInt32BE(20) }
    if (mime === 'image/gif' && b.length >= 10) return { width: b.readUInt16LE(6), height: b.readUInt16LE(8) }
    if (mime === 'image/jpeg') {
      let i = 2
      while (i + 9 < b.length) {
        if (b[i] !== 0xff) { i++; continue }
        const marker = b[i + 1]!
        // SOF0–SOF15 carry the frame size, except DHT (C4), JPG (C8) and DAC (CC).
        if (marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker)) {
          return { height: b.readUInt16BE(i + 5), width: b.readUInt16BE(i + 7) }
        }
        i += 2 + b.readUInt16BE(i + 2)
      }
    }
  } catch { /* malformed header: no size, the bubble falls back to 4:3 */ }
  return null
}

/** A display-safe file name: no paths or control characters, bounded length. */
export function cleanFileName(raw: string | undefined, mime: string): string {
  let name = (raw ?? '').split(/[\\/]/).pop() ?? ''
  // eslint-disable-next-line no-control-regex
  name = name.replace(/[\u0000-\u001f\u007f"<>|:*?]/g, '').trim().slice(0, 120)
  if (name) return name
  const ext = mime.split('/')[1]?.split(/[.+-]/).pop() ?? 'bin'
  return `${kindOf(mime)}.${ext}`
}
