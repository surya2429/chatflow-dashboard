// transcripts.ts — a shareable, no-login page for each website-chat conversation. The email notification links to it so the
// conversation can be read without signing in to the dashboard.
//
// The link is a capability URL: whoever holds it can read that one conversation, so the token is 24 random bytes (never
// guessable), the link stops working after TRANSCRIPT_DAYS without a refresh, and the pages are marked noindex/no-store.
// Pure: storage is passed in, so the API route (Postgres) and the checks (memory) share it.
import { randomBytes } from 'node:crypto'

export const TRANSCRIPT_DAYS = 90
export const MAX_MESSAGES = 500
export const MAX_TEXT = 4000

export type Sender = 'user' | 'bot' | 'agent'
export interface TranscriptMessage { from: Sender; at: string; text: string }
export interface TranscriptInput { conversationId: string; botName: string; visitorName: string; messages: TranscriptMessage[] }
export interface StoredTranscript { botName: string; visitorName: string; messages: TranscriptMessage[]; updatedAt: string }

export interface TranscriptStore {
  /** Inserts, or refreshes the same conversation; resolves to the token that stays with it. */
  save(t: TranscriptInput, token: string, expiresAt: Date): Promise<string>
  /** null when there is no such token or it has expired. */
  find(token: string, now: Date): Promise<StoredTranscript | null>
}

const SENDERS: readonly string[] = ['user', 'bot', 'agent']
export const TOKEN = /^[A-Za-z0-9_-]{32}$/
const text = (v: unknown, max: number): string => (typeof v === 'string' ? v.trim().slice(0, max) : '')

export const newToken = (): string => randomBytes(24).toString('base64url')

/** The conversation, cleaned and size-limited; null when there is nothing worth publishing. Keeps the latest MAX_MESSAGES. */
export function cleanTranscript(body: unknown): TranscriptInput | null {
  const b = (body && typeof body === 'object' ? body : {}) as Record<string, unknown>
  const conversationId = text(b.conversationId, 100)
  const raw = Array.isArray(b.messages) ? b.messages : []
  const messages: TranscriptMessage[] = []
  for (const m of raw) {
    const o = (m && typeof m === 'object' ? m : {}) as Record<string, unknown>
    const t = text(o.text, MAX_TEXT)
    const when = new Date(typeof o.at === 'string' || typeof o.at === 'number' ? o.at : NaN)
    if (!t || !SENDERS.includes(String(o.from)) || Number.isNaN(when.getTime())) continue
    messages.push({ from: o.from as Sender, at: when.toISOString(), text: t })
  }
  if (!conversationId || !messages.length) return null
  return { conversationId, botName: text(b.botName, 120) || 'Chatbot', visitorName: text(b.visitorName, 120) || 'Visitor', messages: messages.slice(-MAX_MESSAGES) }
}

/** Called by whatever sends the notification: stores the conversation and returns the token for its link. */
export async function publishTranscript(body: unknown, store: TranscriptStore, now: Date = new Date()): Promise<{ token: string; expiresAt: Date } | null> {
  const t = cleanTranscript(body)
  if (!t) return null
  const expiresAt = new Date(now.getTime() + TRANSCRIPT_DAYS * 86_400_000)
  return { token: await store.save(t, newToken(), expiresAt), expiresAt }
}

/** What the public page gets. A wrong, unknown or expired token all look the same (404). */
export async function viewTranscript(token: string, store: TranscriptStore, now: Date = new Date()): Promise<{ status: number; body: unknown }> {
  const found = TOKEN.test(token) ? await store.find(token, now) : null
  return found ? { status: 200, body: found } : { status: 404, body: { error: 'not_found' } }
}
