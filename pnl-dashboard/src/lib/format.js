import { format, formatDistanceToNowStrict, parseISO } from 'date-fns'
import { serviceById, CURRENCY_SYMBOL } from './domain'

export const asDate = (v) => (typeof v === 'string' ? parseISO(v) : v)

export const fmtDate = (v) => (v ? format(asDate(v), 'dd MMM yyyy') : '—')
export const fmtDateTime = (v) => (v ? format(asDate(v), 'dd MMM yyyy, HH:mm') : '—')
export const fmtTime = (v) => (v ? format(asDate(v), 'HH:mm') : '—')
export const fmtAgo = (v) => (v ? formatDistanceToNowStrict(asDate(v)) + ' ago' : '—')
export const fmtMonth = (v) => (v ? format(asDate(v), 'MMM yy') : '—')

/** Naira, whole units — kobo has no place on a freight invoice. */
export const fmtMoney = (n, symbol = CURRENCY_SYMBOL) =>
  symbol + Math.round(Number(n) || 0).toLocaleString('en-NG')

/** Compact form for chart axes and tight stat cards: ₦12.4m, ₦840k. */
export const fmtMoneyShort = (n, symbol = CURRENCY_SYMBOL) => {
  const v = Math.abs(Number(n) || 0)
  if (v >= 1e9) return symbol + (n / 1e9).toFixed(1) + 'bn'
  if (v >= 1e6) return symbol + (n / 1e6).toFixed(1) + 'm'
  if (v >= 1e3) return symbol + Math.round(n / 1e3) + 'k'
  return fmtMoney(n, symbol)
}

export const fmtNum = (n) => Number(n || 0).toLocaleString('en-NG')

/**
 * Quantities carry their service's unit — air moves on kilos, ocean on CBM or boxes,
 * haulage on tonnes — so the number is never shown without saying what it measures.
 */
export const fmtUnits = (serviceId, quantity) => {
  const s = serviceById(serviceId)
  const q = Number(quantity) || 0
  const n = s.step >= 1 ? Math.round(q).toLocaleString('en-NG') : q.toFixed(2)
  return n + ' ' + s.unitShort
}

export const initials = (name = '') =>
  name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase()

/** Stable avatar tone derived from the name, so a customer looks the same on every screen. */
export const avatarTone = (name = '') => {
  const tones = [
    'bg-navy-100 text-navy-700', 'bg-amber-100 text-amber-700', 'bg-emerald-100 text-emerald-700',
    'bg-violet-100 text-violet-700', 'bg-rose-100 text-rose-700', 'bg-cyan-100 text-cyan-700',
  ]
  let h = 0
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0
  return tones[h % tones.length]
}

export const pct = (part, whole) => (whole ? Math.round((part / whole) * 100) : 0)
