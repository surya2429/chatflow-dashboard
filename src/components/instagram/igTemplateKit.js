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
//   - text:   a plain message, optionally with up to 13 quick-reply chips.
//   - product: a carousel of up to 10 products pulled from the Instagram Shop
//     catalog by product ID (Meta fills in image, title and price). Needs a
//     connected catalog.
// Button types: web_url (opens a link) and postback (sends a payload string
// to the webhook — Instagram's equivalent of a quick reply).
//
// Media (image, video, audio, PDF) can ride along with a button or text
// template, but Instagram cannot put buttons on a media message: the media is
// sent as its OWN message just before, and the buttons arrive in the next one.
// For an image with buttons in a single message, use a Card instead.
//
// What a template is NOT: unlike WhatsApp, nothing here is submitted to Meta
// for approval, and sending one cannot reopen a closed 24-hour window.

export const HOUR = 3600000
export const WINDOW_MS = 24 * HOUR
export const COMMENT_WINDOW_MS = 7 * 24 * HOUR

export const LIMITS = {
  maxCards: 10, maxButtons: 3,
  title: 80, subtitle: 80, buttonTitle: 20, buttonText: 640, text: 1000,
  maxQuickReplies: 13, quickReplyTitle: 20, maxProducts: 10,
}

/* Media Meta accepts in a DM. Size can't be checked from a link, so it is
   shown as guidance only. */
export const MEDIA_TYPES = {
  image: { label: 'Image', exts: ['png', 'jpg', 'jpeg'], note: 'PNG or JPEG, up to 8 MB' },
  video: { label: 'Video', exts: ['mp4', 'ogg', 'avi', 'mov', 'webm'], note: 'MP4, OGG, AVI, MOV or WEBM, up to 25 MB' },
  audio: { label: 'Audio', exts: ['aac', 'm4a', 'wav', 'mp4'], note: 'AAC, M4A, WAV or MP4, up to 25 MB' },
  file:  { label: 'PDF', exts: ['pdf'], note: 'PDF only, up to 25 MB' },
}
export const newMedia = (type = 'image') => ({ type, url: '', name: '' })
const mediaExt = url => { const m = (url || '').split(/[?#]/)[0].match(/\.([a-z0-9]+)$/i); return m ? m[1].toLowerCase() : '' }
export const mediaFileName = m => {
  if (m?.name?.trim()) return m.name.trim()
  try { return decodeURIComponent((m?.url || '').split(/[?#]/)[0].split('/').pop() || '') || 'attachment' } catch { return 'attachment' }
}

/* Sample catalog so products can be picked without typing IDs. On a real
   account these come from the connected Instagram Shop catalog. */
export const SAMPLE_CATALOG = [
  { id: '5013427719884920', name: 'Premium Wireless Headphones', price: '₹2,999', emoji: '🎧', tint: '#e0e7ff' },
  { id: '5013427719884921', name: 'Leather Wallet', price: '₹899', emoji: '👛', tint: '#fde68a' },
  { id: '5013427719884922', name: 'Running Shoes', price: '₹3,499', emoji: '👟', tint: '#fecaca' },
  { id: '5013427719884923', name: 'Smart Watch', price: '₹8,999', emoji: '⌚', tint: '#c7d2fe' },
  { id: '5013427719884924', name: 'Yoga Mat', price: '₹1,299', emoji: '🧘', tint: '#bbf7d0' },
  { id: '5013427719884925', name: 'Coffee Mug', price: '₹499', emoji: '☕', tint: '#fed7aa' },
]
export const newProduct = () => ({ id: '', name: '', price: '', emoji: '🛍️', tint: '#e5e7eb' })
export const newQuickReply = () => ({ title: '', payload: '' })

export const KINDS = {
  generic: {
    label: 'Card / Carousel', short: 'Card',
    desc: 'An image, title and buttons. Add more cards to make it swipeable.',
    rules: ['Up to 10 cards', 'Title ≤ 80', '≤ 3 buttons per card'],
  },
  product: {
    label: 'Product carousel', short: 'Products',
    desc: 'Products pulled live from your Instagram Shop catalog by ID.',
    rules: ['Up to 10 products', 'Needs a connected catalog'],
  },
  button: {
    label: 'Buttons', short: 'Buttons',
    desc: 'A message with up to three buttons. Can send an image, video or PDF just before.',
    rules: ['Text ≤ 640', '1–3 buttons', 'Optional media'],
  },
  text: {
    label: 'Text message', short: 'Text',
    desc: 'A plain message with optional quick-reply chips and media. The only type allowed in comment replies.',
    rules: ['Text ≤ 1000', 'Up to 13 quick replies', 'Optional media'],
  },
}

/* Whether a template can be used as a private reply to a comment: plain text
   only — no media, chips or buttons. */
export const isPlainText = t => !!t && t.kind === 'text' && !t.media && !(t.quickReplies || []).length

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

/* A card's visible subtitle: the optional price in front of the description. */
export const cardSubtitle = e => [e.price, e.subtitle].map(x => (x || '').trim()).filter(Boolean).join(' · ')

function textFields(t) {
  if (!t) return []
  if (t.kind === 'generic') {
    return t.elements.flatMap(e => [e.title, e.subtitle, ...(e.buttons || []).map(b => b.title)])
  }
  if (t.kind === 'product') return []
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
  if (t.kind === 'product') return t
  return { ...t, text: p(t.text), buttons: btns(t.buttons) }
}

export const newButton = () => ({ type: 'web_url', title: '', url: '' })
export const newCard = () => ({ title: '', subtitle: '', price: '', imageUrl: '', actionUrl: '', buttons: [] })

export function emptyTemplate(kind = 'generic') {
  return {
    id: null, name: '', kind, status: 'ready', note: '',
    elements: kind === 'generic' ? [newCard()] : [],
    products: [],
    text: '', buttons: [], quickReplies: [], media: null,
  }
}

/* Templates saved before media / quick replies / products existed. */
export function normalizeTemplate(t) {
  return {
    products: [], quickReplies: [], media: null, ...t,
    elements: (t.elements || []).map(e => ({ price: '', ...e })),
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

/* Problems with the optional media + quick replies on a text/button template. */
export function extrasChecks(t) {
  const out = []
  if (t.media) {
    const spec = MEDIA_TYPES[t.media.type]
    const ext = mediaExt(t.media.url)
    out.push({ id: 'media-url', ok: isUrl(t.media.url), label: `${spec.label} link is a valid web address` })
    out.push({ id: 'media-type', ok: !ext || spec.exts.includes(ext), label: `${spec.label} file type is accepted (${spec.exts.join(', ')})` })
  }
  if (t.kind === 'text') {
    const q = t.quickReplies || []
    if (q.length) {
      out.push({ id: 'qr-count', ok: q.length <= LIMITS.maxQuickReplies, label: `Up to ${LIMITS.maxQuickReplies} quick replies` })
      out.push({ id: 'qr-complete', ok: q.every(r => r.title.trim() && (r.payload || '').trim()), label: 'Every quick reply has text and a payload' })
    }
  }
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
    add('extra', els.length > 0 && els.every(e => e.title.trim() && (cardSubtitle(e) || e.imageUrl.trim() || e.actionUrl.trim() || e.buttons.length > 0)),
      'Every card has more than a title (subtitle, price, image, link or button)')
    add('subtitle', els.every(e => cardSubtitle(e).length <= LIMITS.subtitle), `Price and subtitle together fit in ${LIMITS.subtitle} characters`)
    const imgOk = els.every(e => !e.imageUrl.trim() || isUrl(e.imageUrl))
    add('images', imgOk, 'Image links are valid web addresses')
    const actOk = els.every(e => !e.actionUrl.trim() || isUrl(e.actionUrl))
    add('actions', actOk, 'Card tap links are valid web addresses')
    const probs = els.flatMap((e, i) => buttonProblems(e.buttons).map(p => `Card ${i + 1}: ${p}`))
    add('buttons', probs.length === 0, probs[0] || 'Every button is complete')
  } else if (t.kind === 'product') {
    const ps = t.products || []
    add('products', ps.length >= 1 && ps.length <= LIMITS.maxProducts, `1–${LIMITS.maxProducts} products`)
    add('product-ids', ps.length > 0 && ps.every(p => /^\d{5,}$/.test((p.id || '').trim())), 'Every product has a numeric catalog ID')
    add('product-dupes', new Set(ps.map(p => (p.id || '').trim())).size === ps.length, 'No product is added twice')
  } else if (t.kind === 'button') {
    add('text', t.text.trim().length > 0, 'Message text is filled in')
    add('count', t.buttons.length >= 1 && t.buttons.length <= LIMITS.maxButtons, '1–3 buttons')
    const probs = buttonProblems(t.buttons)
    add('buttons', probs.length === 0 && t.buttons.length > 0, probs[0] || 'Every button is complete')
    extrasChecks(t).forEach(c => checks.push(c))
  } else {
    add('text', t.text.trim().length > 0, 'Message text is filled in')
    extrasChecks(t).forEach(c => checks.push(c))
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

/* Every message Instagram's Send API would receive for one recipient, in
   order. Media goes first, as its own message. */
export function toApiPayloads(t, recipient = '<IGSID>') {
  const out = []
  const to = { recipient: { id: recipient } }
  if (t.media && t.kind !== 'generic' && t.kind !== 'product') {
    out.push({ label: `${MEDIA_TYPES[t.media.type].label} (sent first)`, body: { ...to, message: { attachment: { type: t.media.type, payload: { url: t.media.url.trim() } } } } })
  }
  if (t.kind === 'text') {
    const q = t.quickReplies || []
    const message = { text: t.text.trim() }
    if (q.length) message.quick_replies = q.map(r => ({ content_type: 'text', title: r.title.trim(), payload: (r.payload || '').trim() }))
    out.push({ label: q.length ? 'Text with quick replies' : 'Text message', body: { ...to, message } })
    return out
  }
  let payload
  if (t.kind === 'generic') {
    payload = {
      template_type: 'generic',
      elements: t.elements.map(e => {
        const o = { title: e.title.trim() }
        const sub = cardSubtitle(e)
        if (sub) o.subtitle = sub
        if (e.imageUrl.trim()) o.image_url = e.imageUrl.trim()
        if (e.actionUrl.trim()) o.default_action = { type: 'web_url', url: e.actionUrl.trim() }
        if (e.buttons.length) o.buttons = e.buttons.map(btnPayload)
        return o
      }),
    }
  } else if (t.kind === 'product') {
    payload = { template_type: 'product', elements: (t.products || []).map(p => ({ id: (p.id || '').trim() })) }
  } else {
    payload = { template_type: 'button', text: t.text.trim(), buttons: t.buttons.map(btnPayload) }
  }
  out.push({ label: t.kind === 'product' ? 'Product template' : t.kind === 'generic' ? 'Generic template' : 'Button template', body: { ...to, message: { attachment: { type: 'template', payload } } } })
  return out
}

/* The main (last) message — what the template "is". */
export function toApiPayload(t, recipient = '<IGSID>') {
  const all = toApiPayloads(t, recipient)
  return all[all.length - 1].body
}

export function summarize(t) {
  if (!t) return ''
  if (t.kind === 'generic') {
    const n = t.elements.length
    return `${n > 1 ? `${n} cards · ` : ''}${t.elements[0]?.title || 'Untitled card'}`
  }
  if (t.kind === 'product') {
    const ps = t.products || []
    return `${ps.length} product${ps.length === 1 ? '' : 's'}${ps[0]?.name ? ` · ${ps[0].name}` : ''}`
  }
  const base = (t.text || '').replace(/\s+/g, ' ').slice(0, 70)
  const extras = [t.media && MEDIA_TYPES[t.media.type].label, (t.quickReplies || []).length && `${t.quickReplies.length} quick replies`].filter(Boolean)
  return extras.length ? `${base} (+ ${extras.join(', ')})` : base
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
const KEY = 'ig_broadcast_templates_v3'
const ago = d => new Date(Date.now() - d * 86400000).toISOString()

export const SEED_TEMPLATES = [
  { id: 'tpl_seed_1', name: 'New arrivals carousel', kind: 'generic', status: 'ready', note: '',
    elements: [
      { title: 'Classic Tote Bag', subtitle: '3 colours', price: '₹1,499', imageUrl: 'https://picsum.photos/seed/igbag/600/314', actionUrl: 'https://example.com/tote',
        buttons: [{ type: 'web_url', title: 'Shop now', url: 'https://example.com/tote' }, { type: 'postback', title: 'Ask a question', payload: 'ASK_TOTE' }] },
      { title: 'Mini Crossbody', subtitle: 'Limited stock', price: '₹999', imageUrl: 'https://picsum.photos/seed/igshoe/600/314', actionUrl: '',
        buttons: [{ type: 'web_url', title: 'Shop now', url: 'https://example.com/crossbody' }] },
      { title: 'Weekender Duffel', subtitle: '', price: '₹2,299', imageUrl: 'https://picsum.photos/seed/igwatch/600/314', actionUrl: '',
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
    elements: [{ title: 'Festive sale — up to 40% off', subtitle: 'Ends Sunday', price: '', imageUrl: '', actionUrl: '', buttons: [] }],
    text: '', buttons: [], createdAt: ago(2), updatedAt: ago(2), sent: 0, seen: 0 },
  { id: 'tpl_seed_6', name: 'Bestsellers from the shop', kind: 'product', status: 'ready', note: 'Pulled live from the Instagram Shop catalog.',
    elements: [], products: SAMPLE_CATALOG.slice(0, 4).map(p => ({ ...p })), text: '', buttons: [],
    createdAt: ago(6), updatedAt: ago(6), sent: 0, seen: 0 },
  { id: 'tpl_seed_7', name: 'Lookbook PDF + quick options', kind: 'text', status: 'ready', note: 'Sends the PDF first, then the message with reply chips.',
    elements: [], text: 'Here\'s our latest lookbook, {{first_name}}. What are you after?', buttons: [],
    quickReplies: [{ title: 'Bags', payload: 'CAT_BAGS' }, { title: 'Shoes', payload: 'CAT_SHOES' }, { title: 'Offers', payload: 'CAT_OFFERS' }],
    media: { type: 'file', url: 'https://example.com/lookbook-autumn.pdf', name: 'Autumn lookbook.pdf' },
    createdAt: ago(4), updatedAt: ago(4), sent: 0, seen: 0 },
]

export function loadTemplates() {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) return JSON.parse(raw).map(normalizeTemplate)
  } catch { /* fall through to the seed */ }
  return SEED_TEMPLATES.map(normalizeTemplate)
}
export function saveTemplates(list) {
  try { localStorage.setItem(KEY, JSON.stringify(list)) } catch { /* private mode etc. */ }
}
