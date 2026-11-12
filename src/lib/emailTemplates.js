/* The HTML email for each notification kind.
   Built for real inboxes: table layout, inline styles, a 600px card that shrinks on a phone (and trims its side
   padding on small screens), a hidden preheader line, tap-friendly buttons. Everything a visitor typed is escaped
   (names and chat text come from the public).
   The look: a coloured header that names the chatbot, the headline and the time; a white body with the content; a small
   footer. Each kind has its own colour so the inbox is easy to scan. */
import {
  KIND_STYLE, REPORTS, SAMPLE_AT, SAMPLE_BOT, SAMPLE_LEAD, SAMPLE_TRANSCRIPT, formatStamp, formatTime, leadRows, ordinal, subjectOf, titleOf,
} from './leadNotifications.js'

const FONT = "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif"
const INK = '#0f172a', BODY = '#334155', MUTED = '#64748b', LINE = '#e6eaf2', SOFT = '#f6f8fb'

export const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]))

/* color: the main accent, dark: where the header gradient ends, soft: a pale tint of it. */
const THEMES = {
  lead:        { color: '#2563eb', dark: '#1e40af', soft: '#e6eeff' },
  revisit:     { color: '#ea580c', dark: '#b91c1c', soft: '#ffefe3' },
  billing:     { color: '#0d9488', dark: '#115e59', soft: '#d9f7f2' },
  consumption: { color: '#d97706', dark: '#92400e', soft: '#fdf0cf' },
  weekly:      { color: '#059669', dark: '#065f46', soft: '#d5f5e7' },
  templates:   { color: '#0891b2', dark: '#155e75', soft: '#d4f3fa' },
  updates:     { color: '#4f46e5', dark: '#3730a3', soft: '#e4e6ff' },
}

const button = (href, label, color, solid = true) =>
  `<table role="presentation" cellpadding="0" cellspacing="0" style="display:inline-block;margin:0 10px 10px 0"><tr><td bgcolor="${solid ? color : '#ffffff'}" style="border-radius:10px;${solid ? '' : 'border:1px solid #cfd6e4;'}"><a href="${esc(href)}" style="display:inline-block;padding:13px 22px;font:700 14px ${FONT};color:${solid ? '#ffffff' : INK};text-decoration:none;border-radius:10px">${esc(label)}</a></td></tr></table>`

const heading = (text, aside = '') =>
  `<p style="margin:30px 0 12px;font:700 12px ${FONT};color:${MUTED};letter-spacing:.09em;text-transform:uppercase">${esc(text)}${aside ? `<span style="font-weight:500;letter-spacing:0;text-transform:none">  ·  ${esc(aside)}</span>` : ''}</p>`

/* A small labelled box: a label in capitals over a value. `big` makes it a figure. Two sit side by side. */
const tile = ({ label, value, note, href, big, color }, left) => {
  const v = href ? `<a href="${esc(href)}" style="color:${INK};text-decoration:none">${esc(value)}</a>` : esc(value)
  return `<td width="50%" valign="top" style="padding:0 ${left ? '6px 12px 0' : '0 12px 6px'}"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${SOFT};border-radius:12px"><tr><td style="padding:14px 16px"><div style="font:700 10.5px ${FONT};letter-spacing:.09em;text-transform:uppercase;color:${MUTED}">${esc(label)}</div><div style="font:${big ? '700 26px/1.25' : '600 14px/1.45'} ${FONT};color:${INK};padding-top:${big ? 2 : 4}px;word-break:break-word">${v}</div>${note ? `<div style="font:600 12px ${FONT};color:${color};padding-top:2px">${esc(note)}</div>` : ''}</td></tr></table></td>`
}
const tileGrid = tiles => {
  const rows = []
  for (let i = 0; i < tiles.length; i += 2) rows.push(`<tr>${tile(tiles[i], true)}${tiles[i + 1] ? tile(tiles[i + 1], false) : '<td width="50%"></td>'}</tr>`)
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0">${rows.join('')}</table>`
}

/** A usage bar: green, then amber, then red as it fills. */
function meter({ label, used, limit }) {
  const pct = Math.min(100, Math.round(used / limit * 100))
  const color = pct >= 100 ? '#dc2626' : pct >= 80 ? '#f59e0b' : '#059669'
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 22px;background:${SOFT};border-radius:14px"><tr><td style="padding:18px 20px"><table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td style="font:600 14px ${FONT};color:${INK};padding-bottom:10px">${esc(label)}<span style="font-weight:500;color:${MUTED}">  ·  ${used.toLocaleString('en-US')} of ${limit.toLocaleString('en-US')}</span></td><td align="right" style="font:800 22px ${FONT};color:${color};padding-bottom:10px">${pct}%</td></tr><tr><td colspan="2" style="background:#dfe5ef;border-radius:999px"><table role="presentation" width="${pct}%" cellpadding="0" cellspacing="0"><tr><td height="12" bgcolor="${color}" style="border-radius:999px;font-size:0;line-height:0">&nbsp;</td></tr></table></td></tr></table></td></tr></table>`
}

/** The conversation as chat bubbles: the chatbot on the left, the visitor on the right, each with its time. */
const chat = (transcript, bot, who, color) => {
  const rows = transcript.map(t => {
    const isBot = t.from === 'bot'
    const bubble = `<table role="presentation" cellpadding="0" cellspacing="0"${isBot ? '' : ' align="right"'} style="max-width:84%"><tr><td style="padding:10px 14px;border-radius:${isBot ? '14px 14px 14px 4px' : '14px 14px 4px 14px'};background:${isBot ? '#ffffff' : color};${isBot ? `border:1px solid ${LINE};` : ''}color:${isBot ? INK : '#ffffff'};font:400 14px/1.5 ${FONT}">${esc(t.text)}</td></tr></table>`
    return `<tr><td align="${isBot ? 'left' : 'right'}" style="padding:5px 0">${bubble}<div style="clear:both;font:500 11px ${FONT};color:${MUTED};padding:4px 3px 0;text-align:${isBot ? 'left' : 'right'}">${esc(isBot ? bot : who)} · ${esc(formatTime(t.at))}</div></td></tr>`
  }).join('')
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${SOFT};border-radius:14px"><tr><td style="padding:14px 16px"><table role="presentation" width="100%" cellpadding="0" cellspacing="0">${rows}</table></td></tr></table>`
}

const initials = name => String(name || '?').trim().split(/\s+/).slice(0, 2).map(w => w[0]).join('').toUpperCase() || '?'
const digitsOf = p => String(p || '').replace(/[\s().-]/g, '')
const validPhone = p => /^\+?\d{7,15}$/.test(digitsOf(p))
const mailHref = e => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(e || '').trim()) ? `mailto:${encodeURIComponent(String(e).trim())}` : ''

function shell({ kind, theme, botName, headline, stamp, preheader, body, to, baseUrl }) {
  const { kicker } = KIND_STYLE[kind]
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light"><meta name="supported-color-schemes" content="light"><title>${esc(headline)}</title>
<style>@media only screen and (max-width:480px){.px{padding-left:20px!important;padding-right:20px!important}.h1{font-size:23px!important}}</style></head>
<body style="margin:0;padding:0;background:#eceff5;-webkit-text-size-adjust:100%">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;font-size:1px;line-height:1px">${esc(preheader)}${'&nbsp;&zwnj;'.repeat(40)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" bgcolor="#eceff5"><tr><td align="center" style="padding:28px 12px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:#ffffff;border-radius:18px;overflow:hidden;box-shadow:0 4px 18px rgba(15,23,42,.08)">
<tr><td class="px" bgcolor="${theme.dark}" style="background:${theme.dark};background-image:linear-gradient(135deg,${theme.color},${theme.dark});padding:26px 32px 30px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
<td><table role="presentation" cellpadding="0" cellspacing="0"><tr><td width="38" height="38" align="center" bgcolor="#ffffff" style="border-radius:50%;color:${theme.dark};font:800 16px ${FONT}">${esc(initials(botName))}</td><td style="padding-left:11px"><div style="font:700 15px ${FONT};color:#ffffff">${esc(botName)}</div><div style="font:500 12px ${FONT};color:${theme.soft}">Chatbot on SmatBot</div></td></tr></table></td>
<td align="right" valign="top"><span style="display:inline-block;padding:6px 12px;border-radius:999px;background:#ffffff;color:${theme.dark};font:800 11px ${FONT};letter-spacing:.07em;text-transform:uppercase">${esc(kicker)}</span></td>
</tr></table>
<h1 class="h1" style="margin:24px 0 8px;font:800 28px/1.22 ${FONT};color:#ffffff">${esc(headline)}</h1>
<p style="margin:0;font:500 13px ${FONT};color:${theme.soft}">${esc(stamp)}</p>
</td></tr>
<tr><td class="px" style="padding:30px 32px 34px">${body}</td></tr>
</table>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px"><tr><td align="center" style="padding:20px 12px 6px;font:12px/1.7 ${FONT};color:${MUTED}">Sent by <b style="color:${BODY}">${esc(botName)}</b> on SmatBot<br>You are getting this because ${esc(to)} is set to receive these notifications.<br><a href="${esc(baseUrl)}/settings" style="color:${MUTED};text-decoration:underline">Change what you receive in Settings</a></td></tr></table>
</td></tr></table></body></html>`
}

function leadEmail({ kind, botName, lead, transcript, at, baseUrl, to, transcriptLink }) {
  const theme = THEMES[kind]
  const hot = kind === 'revisit'
  const rows = Object.fromEntries(leadRows(kind, lead))
  const phone = validPhone(lead.phone), mail = mailHref(lead.email)
  const headline = hot ? `${lead.name || 'A visitor'} is back on your website chat` : `${lead.name || 'A visitor'} just shared their details`
  const banner = hot && lead.visits > 1
    ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 22px"><tr><td style="background:${theme.soft};border-left:4px solid ${theme.color};border-radius:10px;padding:13px 16px;font:400 14px/1.55 ${FONT};color:${INK}"><b>${esc(ordinal(lead.visits))} visit.</b> This lead is already in your list and has just opened the chat again. It is a good moment to follow up.</td></tr></table>`
    : ''
  const who = `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 20px"><tr><td width="54" height="54" align="center" bgcolor="${theme.color}" style="border-radius:50%;color:#ffffff;font:800 19px ${FONT}">${esc(initials(lead.name))}</td><td style="padding-left:14px"><div style="font:800 21px/1.25 ${FONT};color:${INK}">${esc(rows.Name)}</div><div style="font:500 13px ${FONT};color:${MUTED}">${hot ? 'Returning lead' : 'New lead'}</div></td></tr></table>`
  const details = tileGrid([
    { label: 'Mobile', value: rows.Mobile, href: phone ? `tel:${digitsOf(lead.phone)}` : '' },
    { label: 'Email', value: rows.Email, href: mail },
    { label: 'Location', value: rows.Location },
    { label: 'Source', value: rows.Source },
  ])
  const first = String(lead.name || '').split(' ')[0]
  // with a transcript link the conversation opens without logging in; without one, the button goes to the dashboard inbox
  const view = transcriptLink ? button(transcriptLink, 'View conversation', theme.color) : ''
  const call = phone ? button(`tel:${digitsOf(lead.phone)}`, `Call ${first || 'lead'}`, theme.color, !transcriptLink) + button(`https://wa.me/${digitsOf(lead.phone).replace(/^\+/, '')}`, 'WhatsApp', theme.color, false) : ''
  const inbox = transcriptLink ? '' : button(`${baseUrl}/webchat/inbox`, 'Open conversation', theme.color, !phone)
  const actions = `<div style="padding-top:18px">${view}${call}${inbox}</div>`
  const linkNote = transcriptLink
    ? `<p style="margin:14px 0 0;font:400 12px/1.6 ${FONT};color:${MUTED}">The conversation link opens without a login, so anyone you forward this email to can read it. You can also <a href="${esc(baseUrl)}/webchat/inbox" style="color:${MUTED};text-decoration:underline">open it in your dashboard</a>.</p>`
    : ''
  const convo = transcript.length ? heading('Conversation', `${transcript.length} message${transcript.length > 1 ? 's' : ''}`) + chat(transcript, botName, lead.name || 'Visitor', theme.color) : ''
  const preheader = [lead.phone, lead.location, lead.source].filter(Boolean).join('  ·  ')
  return { subject: subjectOf(kind, botName, lead), preheader, html: shell({ kind, theme, botName, headline, stamp: formatStamp(at), preheader, body: banner + who + details + actions + convo + linkNote, to, baseUrl }) }
}

function reportEmail({ kind, botName, at, baseUrl, to }) {
  const m = REPORTS[kind], theme = THEMES[kind]
  const stats = (m.stats || []).map(([label, value, note]) => ({ label, value, note, big: true, color: theme.color }))
  const body =
    `<p style="margin:0 0 24px;font:400 16px/1.6 ${FONT};color:${BODY}">${esc(m.intro)}</p>` +
    (m.meter ? meter(m.meter) : '') +
    (stats.length ? tileGrid(stats) : '') +
    (m.rows ? `<div style="padding-top:12px">${tileGrid(m.rows.map(([label, value]) => ({ label, value })))}</div>` : '') +
    (m.items ? m.items.map(([k, v], i) => `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 16px"><tr><td width="38" valign="top"><table role="presentation" cellpadding="0" cellspacing="0"><tr><td width="28" height="28" align="center" bgcolor="${theme.soft}" style="border-radius:50%;color:${theme.dark};font:800 13px ${FONT}">${i + 1}</td></tr></table></td><td><div style="font:700 16px ${FONT};color:${INK}">${esc(k)}</div><div style="font:400 14px/1.55 ${FONT};color:${BODY}">${esc(v)}</div></td></tr></table>`).join('') : '') +
    `<div style="padding-top:18px">${button(baseUrl + m.cta.path, m.cta.label, theme.color)}</div>`
  return { subject: subjectOf(kind, botName), preheader: m.intro, html: shell({ kind, theme, botName, headline: titleOf(kind), stamp: `Sent ${formatStamp(at)}`, preheader: m.intro, body, to, baseUrl }) }
}

/** { subject, preheader, html } for the designed email of any notification kind.
    `botName` is the chatbot it is about; `baseUrl` is the dashboard address the buttons open; `to` is who it is addressed to. */
export function buildEmailHtml({ kind, botName = SAMPLE_BOT, lead = SAMPLE_LEAD, transcript = SAMPLE_TRANSCRIPT, at = SAMPLE_AT, baseUrl = '', to = 'you@company.com', transcriptLink = '' }) {
  return kind === 'lead' || kind === 'revisit' ? leadEmail({ kind, botName, lead, transcript, at, baseUrl, to, transcriptLink }) : reportEmail({ kind, botName, at, baseUrl, to })
}
