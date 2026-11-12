/* The HTML email for each notification kind.
   Built for real inboxes: table layout, inline styles, 600px card that shrinks on a phone, a hidden preheader line, big
   tap-friendly buttons, and everything a visitor typed is escaped (names and chat text come from the public).
   One look for all seven kinds: a coloured accent and label per kind, the headline and time, then the content. */
import {
  REPORTS, SAMPLE_AT, SAMPLE_LEAD, SAMPLE_TRANSCRIPT, formatStamp, formatTime, leadRows, leadTitle,
} from './leadNotifications.js'

const FONT = "-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif"
const INK = '#0f172a', MUTED = '#64748b', LINE = '#e8ecf3', SOFT = '#f7f9fc'

export const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]))

const THEMES = {
  lead:        { color: '#0066ff', soft: '#eaf2ff', label: 'New lead' },
  revisit:     { color: '#ea580c', soft: '#fff1e6', label: 'Hot lead' },
  billing:     { color: '#0f766e', soft: '#ccfbf1', label: 'Billing' },
  consumption: { color: '#b45309', soft: '#fef3c7', label: 'Chat usage' },
  weekly:      { color: '#059669', soft: '#d1fae5', label: 'Weekly report' },
  templates:   { color: '#0891b2', soft: '#cffafe', label: 'Templates' },
  updates:     { color: '#4f46e5', soft: '#e0e7ff', label: "What's new" },
}

const button = (href, label, color, solid = true) =>
  `<table role="presentation" cellpadding="0" cellspacing="0" style="display:inline-block;margin:0 10px 10px 0"><tr><td bgcolor="${solid ? color : '#ffffff'}" style="border-radius:10px;${solid ? '' : 'border:1px solid #d5dbe6;'}"><a href="${esc(href)}" style="display:inline-block;padding:13px 22px;font:600 14px ${FONT};color:${solid ? '#ffffff' : INK};text-decoration:none;border-radius:10px">${esc(label)}</a></td></tr></table>`

/** Label / value rows. A row can carry a link as its third item. */
const detailTable = rows =>
  `<table role="presentation" width="100%" cellpadding="0" cellspacing="0">${rows.map(([k, v, href], i) => {
    const top = i ? `border-top:1px solid ${LINE};` : ''
    const value = href ? `<a href="${esc(href)}" style="color:${INK};text-decoration:none">${esc(v)}</a>` : esc(v)
    return `<tr><td width="30%" valign="top" style="padding:11px 12px 11px 0;${top}font:500 13px ${FONT};color:${MUTED}">${esc(k)}</td><td valign="top" style="padding:11px 0;${top}font:600 14px/1.4 ${FONT};color:${INK}">${value}</td></tr>`
  }).join('')}</table>`

const card = inner => `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${SOFT};border-radius:14px;margin:0 0 18px"><tr><td style="padding:6px 18px">${inner}</td></tr></table>`

const heading = (text, aside = '') =>
  `<p style="margin:26px 0 10px;font:700 13px ${FONT};color:${INK};letter-spacing:.02em">${esc(text)}${aside ? `<span style="font-weight:500;color:${MUTED}">  ·  ${esc(aside)}</span>` : ''}</p>`

/** Big numbers, two to a row. */
function statTiles(stats, color) {
  const tile = ([k, v, d], left) => `<td width="50%" valign="top" style="padding:5px ${left ? '5px 5px 0' : '0 5px 5px'}"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${SOFT};border-radius:12px"><tr><td style="padding:14px 16px"><div style="font:500 12px ${FONT};color:${MUTED}">${esc(k)}</div><div style="font:700 26px/1.25 ${FONT};color:${INK};padding-top:2px">${esc(v)}</div>${d ? `<div style="font:600 12px ${FONT};color:${color};padding-top:2px">${esc(d)}</div>` : ''}</td></tr></table></td>`
  const rows = []
  for (let i = 0; i < stats.length; i += 2) rows.push(`<tr>${tile(stats[i], true)}${stats[i + 1] ? tile(stats[i + 1], false) : '<td width="50%"></td>'}</tr>`)
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 14px">${rows.join('')}</table>`
}

/** A usage bar: green to amber to red as it fills. */
function meter({ label, used, limit }) {
  const pct = Math.min(100, Math.round(used / limit * 100))
  const color = pct >= 100 ? '#dc2626' : pct >= 80 ? '#f59e0b' : '#059669'
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 18px"><tr><td style="font:600 14px ${FONT};color:${INK};padding-bottom:8px">${esc(label)}: ${used.toLocaleString('en-US')} of ${limit.toLocaleString('en-US')}</td><td align="right" style="font:700 14px ${FONT};color:${color};padding-bottom:8px">${pct}%</td></tr><tr><td colspan="2" style="background:#e9edf5;border-radius:999px"><table role="presentation" width="${pct}%" cellpadding="0" cellspacing="0"><tr><td height="12" bgcolor="${color}" style="border-radius:999px;font-size:0;line-height:0">&nbsp;</td></tr></table></td></tr></table>`
}

const chatBubbles = (transcript, who, color) => transcript.map(t => {
  const bot = t.from === 'bot'
  const bubble = `<table role="presentation" cellpadding="0" cellspacing="0"${bot ? '' : ' align="right"'} style="max-width:86%"><tr><td style="padding:10px 14px;border-radius:${bot ? '14px 14px 14px 4px' : '14px 14px 4px 14px'};background:${bot ? '#eef1f6' : color};color:${bot ? INK : '#ffffff'};font:400 14px/1.5 ${FONT}">${esc(t.text)}</td></tr></table>`
  return `<tr><td align="${bot ? 'left' : 'right'}" style="padding:5px 0">${bubble}<div style="clear:both;font:500 11px ${FONT};color:${MUTED};padding:3px 4px;text-align:${bot ? 'left' : 'right'}">${esc(bot ? 'Bot' : who)} · ${esc(formatTime(t.at))}</div></td></tr>`
}).join('')

const initials = name => String(name || '?').trim().split(/\s+/).slice(0, 2).map(w => w[0]).join('').toUpperCase() || '?'
const telHref = p => { const d = String(p || '').replace(/[\s().-]/g, ''); return /^\+?\d{7,15}$/.test(d) ? `tel:${d}` : '' }
const mailHref = e => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(e || '').trim()) ? `mailto:${encodeURIComponent(String(e).trim())}` : ''

function shell({ theme, title, stamp, preheader, body, to, baseUrl }) {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light"><meta name="supported-color-schemes" content="light"><title>${esc(title)}</title></head>
<body style="margin:0;padding:0;background:#f3f5f9;-webkit-text-size-adjust:100%">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;font-size:1px;line-height:1px">${esc(preheader)}${'&nbsp;&zwnj;'.repeat(40)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" bgcolor="#f3f5f9"><tr><td align="center" style="padding:24px 12px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px">
<tr><td style="padding:0 4px 14px"><table role="presentation" cellpadding="0" cellspacing="0"><tr><td width="30" height="30" align="center" bgcolor="#0066ff" style="border-radius:9px;color:#ffffff;font:700 16px ${FONT}">S</td><td style="padding-left:10px;font:700 17px ${FONT};color:${INK}">SmatBot</td></tr></table></td></tr>
<tr><td style="background:#ffffff;border:1px solid ${LINE};border-radius:18px;overflow:hidden">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0">
<tr><td height="5" bgcolor="${theme.color}" style="font-size:0;line-height:0">&nbsp;</td></tr>
<tr><td style="padding:28px 28px 4px"><span style="display:inline-block;padding:5px 11px;border-radius:999px;background:${theme.soft};color:${theme.color};font:700 11px ${FONT};letter-spacing:.07em;text-transform:uppercase">${esc(theme.label)}</span>
<h1 style="margin:14px 0 0;font:700 24px/1.3 ${FONT};color:${INK}">${esc(title)}</h1>
<p style="margin:8px 0 0;font:500 13px ${FONT};color:${MUTED}">${esc(stamp)}</p></td></tr>
<tr><td style="padding:20px 28px 28px">${body}</td></tr>
</table></td></tr>
<tr><td align="center" style="padding:18px 12px;font:12px/1.6 ${FONT};color:${MUTED}">You are getting this because ${esc(to)} is set to receive SmatBot notifications.<br><a href="${esc(baseUrl)}/settings" style="color:${MUTED};text-decoration:underline">Change what you receive in Settings</a></td></tr>
</table></td></tr></table></body></html>`
}

function leadEmail({ kind, lead, transcript, at, baseUrl, to }) {
  const theme = THEMES[kind]
  const title = kind === 'revisit' ? `${lead.name || 'A visitor'} is back on your website chat` : `${lead.name || 'A visitor'} just shared their details`
  const rows = leadRows(kind, lead)
  const val = k => rows.find(r => r[0] === k)?.[1]
  const tel = telHref(lead.phone), mail = mailHref(lead.email)
  const banner = kind === 'revisit' && lead.visits > 1
    ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 18px"><tr><td style="background:${theme.soft};border-left:4px solid ${theme.color};border-radius:10px;padding:12px 16px;font:400 14px/1.5 ${FONT};color:${INK}"><b>${esc(String(lead.visits))} visits so far.</b> This lead is already in your list and has just opened the chat again, so it is a good moment to follow up.</td></tr></table>`
    : ''
  const contact = card(`<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td style="padding:14px 0 10px"><table role="presentation" cellpadding="0" cellspacing="0"><tr><td width="44" height="44" align="center" bgcolor="${theme.color}" style="border-radius:50%;color:#ffffff;font:700 16px ${FONT}">${esc(initials(lead.name))}</td><td style="padding-left:12px"><div style="font:700 17px ${FONT};color:${INK}">${esc(val('Name'))}</div><div style="font:500 13px ${FONT};color:${MUTED}">${esc(val('Source'))}</div></td></tr></table></td></tr></table>` +
    detailTable([['Mobile', val('Mobile'), tel], ['Email', val('Email'), mail], ['Location', val('Location')], ...(val('Visit') ? [['Visit', val('Visit')]] : [])]))
  const buttons = button(`${baseUrl}/webchat/inbox`, 'Open conversation', theme.color) + (tel ? button(tel, `Call ${String(lead.name || '').split(' ')[0] || 'lead'}`, theme.color, false) : '')
  const chat = transcript.length
    ? heading('Chat transcript', `${transcript.length} message${transcript.length > 1 ? 's' : ''}`) + `<table role="presentation" width="100%" cellpadding="0" cellspacing="0">${chatBubbles(transcript, lead.name || 'Visitor', theme.color)}</table>`
    : ''
  const preheader = [lead.phone, lead.location, lead.source].filter(Boolean).join('  ·  ')
  return { subject: leadTitle(kind, lead), preheader, html: shell({ theme, title, stamp: formatStamp(at), preheader, body: banner + contact + buttons + chat, to, baseUrl }) }
}

function reportEmail({ kind, at, baseUrl, to }) {
  const m = REPORTS[kind], theme = THEMES[kind]
  const body =
    `<p style="margin:0 0 20px;font:400 15px/1.6 ${FONT};color:#334155">${esc(m.intro)}</p>` +
    (m.meter ? meter(m.meter) : '') +
    (m.stats ? statTiles(m.stats, theme.color) : '') +
    (m.rows ? card(detailTable(m.rows)) : '') +
    (m.items ? m.items.map(([k, v], i) => `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 14px"><tr><td width="32" valign="top"><table role="presentation" cellpadding="0" cellspacing="0"><tr><td width="24" height="24" align="center" bgcolor="${theme.soft}" style="border-radius:50%;color:${theme.color};font:700 12px ${FONT}">${i + 1}</td></tr></table></td><td><div style="font:700 15px ${FONT};color:${INK}">${esc(k)}</div><div style="font:400 14px/1.5 ${FONT};color:#475569">${esc(v)}</div></td></tr></table>`).join('') : '') +
    `<div style="padding-top:6px">${button(baseUrl + m.cta.path, m.cta.label, theme.color)}</div>`
  return { subject: m.title, preheader: m.intro, html: shell({ theme, title: m.title, stamp: `Sent ${formatStamp(at)}`, preheader: m.intro, body, to, baseUrl }) }
}

/** { subject, preheader, html } for the designed email of any notification kind.
    `baseUrl` is the dashboard address the buttons open; `to` is who it is addressed to (for the footer). */
export function buildEmailHtml({ kind, lead = SAMPLE_LEAD, transcript = SAMPLE_TRANSCRIPT, at = SAMPLE_AT, baseUrl = '', to = 'you@company.com' }) {
  return kind === 'lead' || kind === 'revisit' ? leadEmail({ kind, lead, transcript, at, baseUrl, to }) : reportEmail({ kind, at, baseUrl, to })
}
