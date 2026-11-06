/* The time range of the Click to WA Ads screens: presets (Today, Yesterday, Last 7/30/90 days, This month, Last month)
   and a custom from–to. Ranges are calendar days in the person's own time zone, so "Today" is today where they are.
   resolveRange gives what the API needs (unix start/end for leads, since/until dates for Meta's report) and the
   range just before it of the same length, for "vs previous period". Pure. */

export const PRESETS = [
  ['today', 'Today'], ['yesterday', 'Yesterday'], ['7', 'Last 7 days'], ['30', 'Last 30 days'], ['90', 'Last 90 days'],
  ['month', 'This month'], ['lastmonth', 'Last month'], ['custom', 'Custom range'],
]
export const MAX_DAYS = 90

const pad = (n) => String(n).padStart(2, '0')
export const ymd = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
const parse = (s) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d) }       // local midnight
const addDays = (d, n) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n)
const unix = (d) => Math.floor(d.getTime() / 1000)
const nice = (d, year) => d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', ...(year ? { year: 'numeric' } : {}) })

/** { preset, from, to } → { since, until, days, label } as local calendar days, or null while a custom range is incomplete or invalid. */
function span({ preset, from, to }, now) {
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  let a, b
  if (preset === 'today') a = b = today
  else if (preset === 'yesterday') a = b = addDays(today, -1)
  else if (preset === 'month') { a = new Date(today.getFullYear(), today.getMonth(), 1); b = today }
  else if (preset === 'lastmonth') { a = new Date(today.getFullYear(), today.getMonth() - 1, 1); b = new Date(today.getFullYear(), today.getMonth(), 0) }
  else if (preset === 'custom') { if (!from || !to) return null; a = parse(from); b = parse(to) }
  else { const n = Number(preset) || 30; a = addDays(today, -(n - 1)); b = today }
  const days = Math.round((b - a) / 86400000) + 1
  if (days < 1 || days > MAX_DAYS || b > today) return null
  return { a, b, days }
}

export function resolveRange(range, now = new Date()) {
  const s = span(range, now)
  if (!s) return null
  const { a, b, days } = s
  const end = (d) => (d >= new Date(now.getFullYear(), now.getMonth(), now.getDate()) ? Math.floor(now.getTime() / 1000) : unix(addDays(d, 1)) - 1)     // up to now for today, else the end of that day
  const pa = addDays(a, -days), pb = addDays(a, -1)
  const preset = PRESETS.find(([k]) => k === range.preset)
  const label = range.preset === 'custom' ? (a.getTime() === b.getTime() ? nice(a, true) : `${nice(a, a.getFullYear() !== b.getFullYear())} – ${nice(b, true)}`) : preset?.[1]
  const q = (x, y) => ({ start: unix(x), end: end(y), since: ymd(x), until: ymd(y) })
  return { ...q(a, b), days, label, prev: q(pa, pb) }
}
