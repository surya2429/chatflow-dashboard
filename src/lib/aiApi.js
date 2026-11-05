/* Inbox AI client — /api/ai/* (backend/src/ai/aiAssistant.ts). The API key is pasted once in the setup popup, kept
   encrypted on the server and never sent back here; every AI call goes through the server. */
import { useEffect, useState } from 'react'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api'

async function call(method, path, body) {
  const res = await fetch(`${API_BASE_URL}/ai${path}`, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  }).catch(() => null)
  if (!res) throw new Error('Could not reach the server. Check the connection and try again.')
  const json = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(json.message || `Request failed (${res.status})`)
  return json
}

export const ai = {
  settings: ()      => call('GET', '/settings'),
  save:     (s)     => call('PUT', '/settings', s),
  remove:   ()      => call('DELETE', '/settings'),
  run:      (task, payload) => call('POST', '/run', { task, ...payload }),
}

/* ── one shared copy of the settings for every panel on the page ── */
let cache = null
let inflight = null
const subs = new Set()
const publish = (v) => { cache = v; subs.forEach((f) => f()) }

function refresh() {
  inflight = ai.settings().then(publish).catch((e) => publish({ configured: false, unavailable: e.message })).finally(() => { inflight = null })
  return inflight
}

export function useAiSettings() {
  const [, tick] = useState(0)
  useEffect(() => {
    const f = () => tick((n) => n + 1)
    subs.add(f)
    if (!cache && !inflight) refresh()
    return () => { subs.delete(f) }
  }, [])
  return { settings: cache, setSettings: publish, refresh }
}

/* ── conversations as the server wants them: who said what, plain text only ── */
function who(m) {
  if (m.type === 'note') return 'note'
  if (m.type === 'incoming' || m.type === 'answer') return 'customer'
  if (m.type === 'outgoing' || m.type === 'template') return m.sender === 'Bot' ? 'bot' : 'agent'
  if (m.from) return m.from === 'bot' ? 'bot' : m.from === 'agent' ? 'agent' : 'customer'   // Instagram messages
  return null                                                                                // events etc.
}
const bodyOf = (m) => (m.type === 'answer' ? `${m.label}: ${m.value}` : m.type === 'template' ? m.template?.body : m.text)

export function toAiConversation(c) {
  return {
    id: c.id,
    name: c.name,
    channel: c.channel || (c.handle ? 'instagram' : 'whatsapp'),
    status: c.status,
    agent: c.agentName || '',
    labels: c.labels || c.tags || [],
    unread: c.unread || 0,
    messages: (c.messages || []).map((m) => ({ who: who(m), text: bodyOf(m) })).filter((m) => m.who && m.text),
  }
}
