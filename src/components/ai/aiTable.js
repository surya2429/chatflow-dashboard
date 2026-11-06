/* Turning conversations into a table the user can read, sort, chart and export.
   The rows come from the real conversation records, never from the model's text: the AI only says WHICH conversations
   an answer is about (and why); every cell below is the actual data, so an exported file can be trusted. */

const COLS = [
  ['name', 'Name'], ['why', 'AI note'], ['phone', 'Phone'], ['email', 'Email'], ['handle', 'Instagram'], ['channel', 'Channel'],
  ['status', 'Status'], ['agent', 'Agent'], ['labels', 'Labels'], ['lastMessage', 'Last message'], ['lastActive', 'Last active'],
]
const CHANNEL = { whatsapp: 'WhatsApp', webchat: 'Website chat', instagram: 'Instagram', calls: 'Calls' }
const STATUS = { bot: 'Bot', agent: 'Agent', resolved: 'Resolved' }

const pad = (n) => String(n).padStart(2, '0')
function when(c) {
  const d = c.timestamp ? new Date(c.timestamp) : null
  return d && !isNaN(d) ? `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}` : (c.time || '')
}

/** { columns: [{key,label}], rows: [{ id, <key>: string }] }. Columns nobody has a value for are left out. */
export function buildTable(conversations, whyById = {}) {
  const rows = conversations.map((c) => ({
    id: String(c.id),
    name: c.name || '',
    why: whyById[String(c.id)] || '',
    phone: c.phone || '',
    email: c.email || '',
    handle: c.handle || '',
    channel: CHANNEL[c.channel || (c.handle ? 'instagram' : 'whatsapp')] || c.channel || '',
    status: STATUS[c.status] || c.status || '',
    agent: c.agentName || 'Unassigned',
    labels: (c.labels || c.tags || []).join(', '),
    lastMessage: c.lastMessage || '',
    lastActive: when(c),
  }))
  return { columns: COLS.filter(([k]) => rows.some((r) => r[k])).map(([key, label]) => ({ key, label })), rows }
}

/* ── export formats ─────────────────────────────────────────────────────────────────────────────────────── */
// Cell text comes from customers. A cell that starts with = + - @ would run as a formula when the file is opened in Excel
// or Sheets, so it gets a leading apostrophe — except phone numbers like "+91 98765 43210", which are plain text.
const guard = (v) => { const s = String(v ?? ''); return /^[=+\-@\t\r]/.test(s) && !/^\+[\d\s().-]+$/.test(s) ? `'${s}` : s }
const csvCell = (s) => (/[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s)

export const toCsv = (t) => [t.columns.map((c) => csvCell(c.label)), ...t.rows.map((r) => t.columns.map((c) => csvCell(guard(r[c.key]))))].map((r) => r.join(',')).join('\r\n')
export const toTsv = (t) => [t.columns.map((c) => c.label), ...t.rows.map((r) => t.columns.map((c) => guard(r[c.key]).replace(/[\t\r\n]+/g, ' ')))].map((r) => r.join('\t')).join('\n')
export const toMarkdown = (t) => {
  const cell = (s) => String(s ?? '').replace(/\|/g, '\\|').replace(/[\r\n]+/g, ' ')
  return [`| ${t.columns.map((c) => c.label).join(' | ')} |`, `| ${t.columns.map(() => '---').join(' | ')} |`, ...t.rows.map((r) => `| ${t.columns.map((c) => cell(r[c.key])).join(' | ')} |`)].join('\n')
}
export const toJson = (t) => JSON.stringify(t.rows.map((r) => Object.fromEntries(t.columns.map((c) => [c.label, r[c.key]]))), null, 2)

export const fileStem = (base) => {
  const d = new Date()
  const slug = String(base || 'chats').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'chats'
  return `${slug}-${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

export function download(filename, text, mime) {
  const url = URL.createObjectURL(new Blob([text], { type: `${mime};charset=utf-8` }))
  const a = Object.assign(document.createElement('a'), { href: url, download: filename })
  document.body.appendChild(a); a.click(); a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

/* ── sorting and the chart ──────────────────────────────────────────────────────────────────────────────── */
export const sortRows = (rows, key, dir) => [...rows].sort((a, b) => String(a[key]).localeCompare(String(b[key]), undefined, { numeric: true, sensitivity: 'base' }) * (dir === 'desc' ? -1 : 1))

export const GROUPS = [['status', 'Status'], ['channel', 'Channel'], ['agent', 'Agent'], ['labels', 'Label']]
/** Counts per value of a column, biggest first. Labels are many-per-row, so each label counts once. */
export function groupCounts(rows, key) {
  const n = new Map()
  for (const r of rows) for (const v of (key === 'labels' ? (r.labels ? r.labels.split(', ') : ['(none)']) : [r[key] || '(none)'])) n.set(v, (n.get(v) || 0) + 1)
  return [...n].map(([label, count]) => ({ label, count })).sort((a, b) => b.count - a.count || a.label.localeCompare(b.label))
}
