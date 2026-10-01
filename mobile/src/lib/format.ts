/** Short list timestamp: "now", "5m", "3h", "Mon", "12 Apr". */
export function listTime(iso: string, now = Date.now()): string {
  const t = new Date(iso).getTime()
  const diff = Math.max(0, now - t)
  if (diff < 60_000) return 'now'
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m`
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h`
  const d = new Date(t)
  if (diff < 6 * 86_400_000) return d.toLocaleDateString(undefined, { weekday: 'short' })
  return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short' })
}

export function clockTime(iso: string): string {
  return new Date(iso).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
}

/** "Today", "Yesterday", or a date — thread day separators. */
export function dayLabel(iso: string): string {
  const d = new Date(iso)
  const today = new Date()
  const start = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime()
  const days = Math.round((start(today) - start(d)) / 86_400_000)
  if (days === 0) return 'Today'
  if (days === 1) return 'Yesterday'
  return d.toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'short' })
}

export function sameDay(a: string, b: string): boolean {
  return new Date(a).toDateString() === new Date(b).toDateString()
}

/** "+919876543210" → "+91 98765 43210" (Indian numbers); other countries grouped loosely. */
export function formatPhone(e164?: string): string {
  if (!e164) return ''
  const d = e164.replace(/\D/g, '')
  if (d.startsWith('91') && d.length === 12) return `+91 ${d.slice(2, 7)} ${d.slice(7)}`
  if (d.startsWith('1') && d.length === 11) return `+1 ${d.slice(1, 4)} ${d.slice(4, 7)} ${d.slice(7)}`
  return `+${d.slice(0, d.length - 10) || ''} ${d.slice(-10, -5)} ${d.slice(-5)}`.replace('+ ', '+')
}

export function duration(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000))
  const m = Math.floor(s / 60)
  return `${m}:${String(s % 60).padStart(2, '0')}`
}

/** "in 4h 12m" / "closed" — WhatsApp 24h window countdown. */
export function windowRemaining(expiresAt: string | null): string {
  if (!expiresAt) return 'closed'
  const ms = new Date(expiresAt).getTime() - Date.now()
  if (ms <= 0) return 'closed'
  const h = Math.floor(ms / 3_600_000)
  const m = Math.floor((ms % 3_600_000) / 60_000)
  return h ? `${h}h ${m}m left` : `${m}m left`
}
