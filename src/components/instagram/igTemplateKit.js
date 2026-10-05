// igTemplateKit.js — the data model, rules and helpers behind Instagram
// templates and broadcasts. Kept free of React so the builder, the wizard,
// the previews and the page all agree on one definition of "a valid template".
//
// What a template is on Instagram (Meta Messaging API, Send API):
//   - generic: a card, or a swipeable carousel when there is more than one.
//     Up to 10 cards; each has a required title (80), optional subtitle (80),
//     optional image, optional tap link (default_action) and up to 3 buttons.
//     At least one property besides the title must be set.
//   - button: text (640) with 1–3 buttons.
//   - text:   a plain message. Not a Meta "template", but worth saving for
//     reuse, and the only type a private reply to a comment may carry.
// Button types: web_url (opens a link) and postback (sends a payload string
// to the webhook — Instagram's equivalent of a quick reply).
//
// What a template is NOT: unlike WhatsApp, nothing here is submitted to Meta
// for approval, and sending one cannot reopen a closed 24-hour window.

export const HOUR = 3600000
export const WINDOW_MS = 24 * HOUR
export const COMMENT_WINDOW_MS = 7 * 24 * HOUR

export const LIMITS = {
  maxCards: 10, maxButtons: 3,
  title: 80, subtitle: 80, buttonTitle: 20, buttonText: 640, text: 1000,
}

export const KINDS = {
  generic: {
    label: 'Card / Carousel', short: 'Card',
    desc: 'An image, title and buttons. Add more cards to make it swipeable.',
    rules: ['Up to 10 cards', 'Title ≤ 80', '≤ 3 buttons per card'],
  },
  button: {
    label: 'Buttons', short: 'Buttons',
    desc: 'A message with up to three buttons underneath.',
    rules: ['Text ≤ 640', '1–3 buttons'],
  },
  text: {
    label: 'Text message', short: 'Text',
    desc: 'A plain message you can reuse. The only type allowed in comment replies.',
    rules: ['Text ≤ 1000', 'Works for comment replies'],
  },
}

/* Personalisation. Instagram has no server-side variables, so these are
   resolved by us per recipient at send time. */
export const TOKENS = [
  { key: 'first_name', label: 'First name', sample: 'Ananya', get: c => (c.name || '').split(' ')[0] },
  { key: 'name',       label: 'Full name',  sample: 'Ananya Rao', get: c => c.name },
  { key: 'handle',     label: 'Handle',     sample: '@ananya.rao', get: c => c.handle },
  { key: 'city',       label: 'City',       sample: 'Bangalore', get: c => c.city },
]
export const SAMPLE_CONTACT = { name: 'Ananya Rao', handle: '@ananya.rao', city: 'Bangalore', avatar: 'AR' }
const TOKEN_RE = /\{\{\s*([a-z_]+)\s*\}\}/g

function textFields(t) {
  if (!t) return []
  if (t.kind === 'generic') {
    return t.elements.flatMap(e => [e.title, e.subtitle, ...(e.buttons || []).map(b => b.title)])
  }
  return [t.text, ...(t.buttons || []).map(b => b.title)]
}

export function tokensIn(t) {
  const found = new Set()
  textFields(t).forEach(s => { (s || '').replace(TOKEN_RE, (_, k) => { found.add(k); return '' }) })
  return [...found].filter(k => TOKENS.some(x => x.key === k))
}

export function personalize(str, contact, fallbacks = {}) {
  return (str || '').replace(TOKEN_RE, (m, k) => {
    const tok = TOKENS.find(x => x.key === k)
    if (!tok) return m
    return (tok.get(contact) || fallbacks[k] || tok.sample)
  })
}

export function personalizeTemplate(t, contact, fallbacks) {
  if (!t) return t
  const p = s => personalize(s, contact, fallbacks)
  const btns = bs => (bs || []).map(b => ({ ...b, title: p(b.title) }))
  if (t.kind === 'generic') {
    return { ...t, elements: t.elements.map(e => ({ ...e, title: p(e.title), subtitle: p(e.subtitle), buttons: btns(e.buttons) })) }
  }
  return { ...t, text: p(t.text), buttons: btns(t.buttons) }
}

export const newButton = () => ({ type: 'web_url', title: '', url: '' })
export const newCard = () => ({ title: '', subtitle: '', imageUrl: '', actionUrl: '', buttons: [] })

export function emptyTemplate(kind = 'generic') {
  return {
    id: null, name: '', kind, status: 'ready', note: '',
    elements: kind === 'generic' ? [newCard()] : [],
    text: '', buttons: [],
  }
}

const isUrl = s => /^https?:\/\/[^\s/$.?#]+\.[^\s]+$/i.test((s || '').trim())

function buttonProblems(buttons) {
  const out = []
  buttons.forEach((b, i) => {
    if (!b.title.trim()) out.push(`Button ${i + 1} needs text`)
    if (b.type === 'web_url' && !isUrl(b.url)) out.push(`Button ${i + 1} needs a valid link`)
    if (b.type === 'postback' && !(b.payload || '').trim()) out.push(`Button ${i + 1} needs a payload`)
  })
  return out
}

/* Every rule is a check the author can see pass or fail while typing. */
export function validateTemplate(t) {
  const checks = []
  const add = (id, ok, label) => checks.push({ id, ok, label })
  add('name', t.name.trim().length > 0, 'Template has a name')

  if (t.kind === 'generic') {
    const els = t.elements
    add('cards', els.length >= 1 && els.length <= LIMITS.maxCards, `1–${LIMITS.maxCards} cards`)
    add('titles', els.length > 0 && els.every(e => e.title.trim().length > 0), 'Every card has a title')
    add('extra', els.length > 0 && els.every(e => e.title.trim() && (e.subtitle.trim() || e.imageUrl.trim() || e.actionUrl.trim() || e.buttons.length > 0)),
      'Every card has more than a title (subtitle, image, link or button)')
    const imgOk = els.every(e => !e.imageUrl.trim() || isUrl(e.imageUrl))
    add('images', imgOk, 'Image links are valid web addresses')
    const actOk = els.every(e => !e.actionUrl.trim() || isUrl(e.actionUrl))
    add('actions', actOk, 'Card tap links are valid web addresses')
    const probs = els.flatMap((e, i) => buttonProblems(e.buttons).map(p => `Card ${i + 1}: ${p}`))
    add('buttons', probs.length === 0, probs[0] || 'Every button is complete')
  } else if (t.kind === 'button') {
    add('text', t.text.trim().length > 0, 'Message text is filled in')
    add('count', t.buttons.length >= 1 && t.buttons.length <= LIMITS.maxButtons, '1–3 buttons')
    const probs = buttonProblems(t.buttons)
    add('buttons', probs.length === 0 && t.buttons.length > 0, probs[0] || 'Every button is complete')
  } else {
    add('text', t.text.trim().length > 0, 'Message text is filled in')
  }
  const tokens = tokensIn(t)
  const unknown = []
  textFields(t).forEach(s => (s || '').replace(TOKEN_RE, (m, k) => { if (!TOKENS.some(x => x.key === k)) unknown.push(m); return '' }))
  add('tokens', unknown.length === 0, unknown.length ? `Unknown placeholder ${unknown[0]}` : (tokens.length ? 'Placeholders are recognised' : 'No placeholders used'))
  return { checks, valid: checks.every(c => c.ok), passed: checks.filter(c => c.ok).length }
}

const btnPayload = b => b.type === 'web_url'
  ? { type: 'web_url', url: b.url.trim(), title: b.title.trim() }
  : { type: 'postback', title: b.title.trim(), payload: (b.payload || '').trim() }

/* The exact body Instagram's Send API would receive for one recipient. */
export function toApiPayload(t, recipient = '<IGSID>') {
  if (t.kind === 'text') return { recipient: { id: recipient }, message: { text: t.text.trim() } }
  const payload = t.kind === 'generic'
    ? {
        template_type: 'generic',
        elements: t.elements.map(e => {
          const o = { title: e.title.trim() }
          if (e.subtitle.trim()) o.subtitle = e.subtitle.trim()
          if (e.imageUrl.trim()) o.image_url = e.imageUrl.trim()
          if (e.actionUrl.trim()) o.default_action = { type: 'web_url', url: e.actionUrl.trim() }
          if (e.buttons.length) o.buttons = e.buttons.map(btnPayload)
          return o
        }),
      }
    : { template_type: 'button', text: t.text.trim(), buttons: t.buttons.map(btnPayload) }
  return { recipient: { id: recipient }, message: { attachment: { type: 'template', payload } } }
}

export function summarize(t) {
  if (!t) return ''
  if (t.kind === 'generic') {
    const n = t.elements.length
    return `${n > 1 ? `${n} cards · ` : ''}${t.elements[0]?.title || 'Untitled card'}`
  }
  return (t.text || '').replace(/\s+/g, ' ').slice(0, 70)
}

/* Whether a DM sent at `at` lands. Evaluated at the SEND time, so a scheduled
   broadcast drops people whose window will have closed by then. */
export function windowState(contact, at) {
  if (contact.status !== 'active') return { key: 'optout', label: 'Unsubscribed' }
  const left = new Date(contact.last).getTime() + WINDOW_MS - at
  if (left <= 0) return { key: 'expired', label: 'Window closed', left: 0 }
  const h = Math.floor(left / HOUR), m = Math.floor((left % HOUR) / 60000)
  return { key: 'eligible', label: h > 0 ? `${h}h ${m}m left` : `${m}m left`, left }
}

/* ── comments (for private replies) ───────────────────────────────────── */
export const POSTS = [
  { id: 'p1', title: 'Summer collection reel', comments: [
    { id: 'c1', user: '@meera.creates', text: 'Love this! Where can I buy?', ageH: 3,   replied: false },
    { id: 'c2', user: '@ananya.rao',    text: 'Is the blue one in stock?',   ageH: 20,  replied: false },
    { id: 'c3', user: '@pooja.reddy',   text: 'Price please 😍',             ageH: 70,  replied: true  },
    { id: 'c4', user: '@rohit.s',       text: 'Shipping to Mumbai?',         ageH: 200, replied: false },
  ] },
  { id: 'p2', title: 'Flash sale carousel', comments: [
    { id: 'c5', user: '@karthik.iyer',  text: 'Code?',                       ageH: 30,  replied: false },
    { id: 'c6', user: '@sneha.kapoor',  text: 'Does this ship to Delhi?',    ageH: 52,  replied: false },
  ] },
  { id: 'p3', title: 'Behind the scenes story', comments: [
    { id: 'c7', user: '@vikram.singh',  text: 'Nice!',                       ageH: 400, replied: false },
  ] },
]
export function commentState(cm) {
  if (cm.replied) return 'replied'
  return cm.ageH * HOUR >= COMMENT_WINDOW_MS ? 'old' : 'ok'
}

/* ── storage ──────────────────────────────────────────────────────────── */
const KEY = 'ig_broadcast_templates_v2'
const ago = d => new Date(Date.now() - d * 86400000).toISOString()

export const SEED_TEMPLATES = [
  { id: 'tpl_seed_1', name: 'New arrivals carousel', kind: 'generic', status: 'ready', note: '',
    elements: [
      { title: 'Classic Tote Bag', subtitle: '₹1,499 · 3 colours', imageUrl: 'https://picsum.photos/seed/igbag/600/314', actionUrl: 'https://example.com/tote',
        buttons: [{ type: 'web_url', title: 'Shop now', url: 'https://example.com/tote' }, { type: 'postback', title: 'Ask a question', payload: 'ASK_TOTE' }] },
      { title: 'Mini Crossbody', subtitle: '₹999 · Limited stock', imageUrl: 'https://picsum.photos/seed/igshoe/600/314', actionUrl: '',
        buttons: [{ type: 'web_url', title: 'Shop now', url: 'https://example.com/crossbody' }] },
      { title: 'Weekender Duffel', subtitle: '₹2,299', imageUrl: 'https://picsum.photos/seed/igwatch/600/314', actionUrl: '',
        buttons: [{ type: 'web_url', title: 'Shop now', url: 'https://example.com/duffel' }] },
    ], text: '', buttons: [], createdAt: ago(21), updatedAt: ago(3), sent: 412, seen: 301 },
  { id: 'tpl_seed_2', name: 'Support quick options', kind: 'button', status: 'ready', note: '', elements: [],
    text: 'Hi {{first_name}}! How can we help you today?',
    buttons: [{ type: 'postback', title: 'Track my order', payload: 'TRACK_ORDER' }, { type: 'postback', title: 'Talk to support', payload: 'TALK_TO_SUPPORT' }, { type: 'web_url', title: 'Read our FAQ', url: 'https://example.com/faq' }],
    createdAt: ago(40), updatedAt: ago(9), sent: 188, seen: 140 },
  { id: 'tpl_seed_3', name: 'Back in stock', kind: 'text', status: 'ready', note: '', elements: [],
    text: 'Good news {{first_name}} — the item you asked about is back in stock. Reply YES and we\'ll hold one for you. 🛍️', buttons: [],
    createdAt: ago(12), updatedAt: ago(12), sent: 64, seen: 49 },
  { id: 'tpl_seed_4', name: 'Comment thank-you', kind: 'text', status: 'ready', note: '', elements: [],
    text: 'Thanks for commenting, {{first_name}}! Here\'s the link to everything in the reel: https://example.com/summer', buttons: [],
    createdAt: ago(30), updatedAt: ago(30), sent: 96, seen: 61 },
  { id: 'tpl_seed_5', name: 'Festive offer (draft)', kind: 'generic', status: 'draft', note: '',
    elements: [{ title: 'Festive sale — up to 40% off', subtitle: 'Ends Sunday', imageUrl: '', actionUrl: '', buttons: [] }],
    text: '', buttons: [], createdAt: ago(2), updatedAt: ago(2), sent: 0, seen: 0 },
]

export function loadTemplates() {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) return JSON.parse(raw)
  } catch { /* fall through to the seed */ }
  return SEED_TEMPLATES
}
export function saveTemplates(list) {
  try { localStorage.setItem(KEY, JSON.stringify(list)) } catch { /* private mode etc. */ }
}
