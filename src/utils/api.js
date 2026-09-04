/* ─── Minimal fetch wrapper for the backend (see backend/) ──────────────── */
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api'

export async function apiPost(path, body) {
  const res = await fetch(`${API_BASE_URL}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body ?? {}),
  })
  const data = await res.json().catch(() => null)
  if (!res.ok) throw new Error(data?.error || `Request failed (${res.status})`)
  return data
}

export async function apiGet(path) {
  const res = await fetch(`${API_BASE_URL}${path}`)
  const data = await res.json().catch(() => null)
  if (!res.ok) throw new Error(data?.error || `Request failed (${res.status})`)
  return data
}
