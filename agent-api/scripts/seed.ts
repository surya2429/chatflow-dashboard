/*
 * Development seed: the dashboard's demo team and inbox, as real rows.
 *
 *   npm run seed            # no-op if users already exist
 *   npm run seed -- --reset # wipe inbox + users first
 *
 * Content is ported from the dashboard's mock layer (src/constants/mockData.js,
 * src/pages/InstagramInbox.jsx, src/context/AuthContext.jsx) so the app shows
 * familiar data. The demo logins keep the dashboard's demo passwords — which is
 * exactly why this refuses to run with NODE_ENV=production.
 */
import 'dotenv/config'
import pg from 'pg'
import { randomBytes } from 'node:crypto'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { hashPassword } from '../src/auth/password.js'

if (process.env.NODE_ENV === 'production') {
  console.error('Refusing to seed demo accounts with known passwords into production.')
  process.exit(1)
}
const url = process.env.DATABASE_URL
if (!url) { console.error('DATABASE_URL is required'); process.exit(1) }

const USERS = [
  { key: 'admin', email: 'admin@acmecorp.com', password: 'admin123', name: 'Deepak Kumar', initials: 'DK', color: '#0066ff', role: 'admin' },
  { key: 'priya', email: 'priya@acmecorp.com', password: 'super123', name: 'Priya Das', initials: 'PD', color: '#8B5CF6', role: 'supervisor' },
  { key: 'rahul', email: 'rahul@acmecorp.com', password: 'agent123', name: 'Rahul Mehta', initials: 'RM', color: '#22C55E', role: 'agent' },
  { key: 'aryan', email: 'aryan@acmecorp.com', password: 'agent123', name: 'Aryan Kapoor', initials: 'AK', color: '#F59E0B', role: 'agent' },
  { key: 'sunita', email: 'sunita@acmecorp.com', password: 'agent123', name: 'Sunita Rao', initials: 'SR', color: '#14B8A6', role: 'agent' },
] as const
type UserKey = typeof USERS[number]['key']

// [type, text, extra?] — compact message rows; sender is filled in per type.
type M =
  | ['in' | 'out' | 'bot', string]
  | ['note', string, UserKey]
  | ['agent', string, UserKey]
  | ['event', string, string]
  | ['answer', string, string, string] // label, questionType, value
  | ['template', string, Record<string, unknown>]

// ── Bots ────────────────────────────────────────────────────────────────────
// Aryan is deliberately NOT on the Sales bot, so an agent who can't see a
// bot's chats is part of the demo (and scripts/verify.ts checks it).
type BotKey = 'support' | 'sales' | 'instagram' | 'website' | 'festive'
const BOTS: { key: BotKey; name: string; channel: 'whatsapp' | 'instagram' | 'webchat'; identity: string; description: string; color: string; status?: 'paused'; agents: UserKey[] }[] = [
  { key: 'support', name: 'Acme Support', channel: 'whatsapp', identity: '+91 80471 12345', color: '#0066FF',
    description: 'Order tracking, refunds and delivery questions', agents: ['rahul', 'aryan', 'sunita'] },
  { key: 'sales', name: 'Acme Sales', channel: 'whatsapp', identity: '+91 80471 67890', color: '#16A34A',
    description: 'Pricing, demos and bulk orders from ads and broadcasts', agents: ['rahul', 'sunita'] },
  { key: 'instagram', name: 'Acme on Instagram', channel: 'instagram', identity: '@acme.store', color: '#E1306C',
    description: 'DMs, comments and story replies', agents: ['rahul', 'aryan'] },
  { key: 'website', name: 'Website Assistant', channel: 'webchat', identity: 'acme.com', color: '#7C3AED',
    description: 'Chat widget on acme.com — pricing, docs and support', agents: ['rahul', 'aryan', 'sunita'] },
  { key: 'festive', name: 'Festive Offers', channel: 'whatsapp', identity: '+91 80471 55555', color: '#F59E0B', status: 'paused',
    description: 'Seasonal campaign bot — paused until the next sale', agents: [] },
]

interface Seed {
  bot?: BotKey
  channel: 'whatsapp' | 'instagram' | 'webchat'
  name: string
  phone?: string
  handle?: string
  visitorId?: string
  visitor?: Record<string, unknown>
  profile?: Record<string, string>
  status: 'bot' | 'agent' | 'resolved'
  agent?: UserKey
  source: string
  labels: string[]
  unread: number
  starred?: boolean
  archived?: boolean
  minutesAgo: number
  /** Minutes since the customer's last message — drives the WhatsApp 24h window. */
  inboundMinutesAgo?: number
  isFollower?: boolean
  externalRef?: string
  messages: M[]
}

const CONVERSATIONS: Seed[] = [
  {
    channel: 'whatsapp', name: 'Priya Sharma', phone: '+91 98765 43210', status: 'agent', agent: 'rahul', source: 'ctwa',
    labels: ['vip', 'order-issue'], unread: 3, minutesAgo: 2, inboundMinutesAgo: 2,
    profile: { email: 'priya.sharma@gmail.com', company: 'Sharma Enterprises', city: 'Mumbai', country: 'India', language: 'English' },
    messages: [
      ['event', 'Started from Meta Ad: "Summer Flash Sale"', 'ctwa_entry'],
      ['template', 'Hello Priya! Your order #3821 has been confirmed and will be delivered by Apr 17.', {
        name: 'order_confirmation', category: 'TRANSACTIONAL', header: 'Order Confirmed! ✅',
        body: 'Hello Priya! Your order #3821 has been confirmed and will be delivered by Apr 17.',
        footer: 'Reply TRACK for live updates', buttons: ['Track Order', 'Contact Support'], variables: ['Priya', '3821', 'Apr 17'],
      }],
      ['in', 'Track Order'],
      ['in', 'Hello! I need help with my order #3821'],
      ['event', 'Assigned to Rahul Mehta', 'assigned'],
      ['bot', 'Hi Priya! Let me check your order status for you.'],
      ['note', 'VIP customer — order delayed due to warehouse issue. Offer 10% discount if needed.', 'rahul'],
      ['event', 'Conversation handed over from Bot to Rahul Mehta', 'bot_handover'],
      ['in', 'It was supposed to arrive yesterday'],
      ['agent', 'Your order #3821 is confirmed and will arrive by Apr 17. I apologize for the delay!', 'rahul'],
      ['in', 'Ok thank you!'],
    ],
  },
  {
    channel: 'whatsapp', name: 'Rahul Verma', phone: '+91 82341 09876', status: 'bot', source: 'ctwa', labels: ['lead'],
    unread: 1, minutesAgo: 60, inboundMinutesAgo: 60,
    profile: { email: 'rahul.verma@techstartup.in', company: 'TechStartup Pvt Ltd', city: 'Bengaluru' },
    messages: [
      ['event', 'Started from Google Ad: "ChatFlow Demo"', 'ctwa_entry'],
      ['in', 'Hi, I want to know about your pricing plans'],
      ['bot', 'We have 3 plans: Starter ₹999/mo, Growth ₹2,499/mo, and Enterprise. Which fits your needs?'],
      ['in', 'What are your pricing plans?'],
    ],
  },
  {
    channel: 'whatsapp', name: 'Anita Kapoor', phone: '+91 91234 56789', status: 'resolved', agent: 'priya', source: 'g-ctwa',
    labels: ['appointment'], unread: 0, minutesAgo: 180, inboundMinutesAgo: 180,
    messages: [
      ['in', 'I want to book a consultation'],
      ['bot', 'Great! I have slots available on Apr 16 at 10 AM, 2 PM, or 4 PM. Which works for you?'],
      ['in', '2 PM please'],
      ['bot', 'Confirmed! Your appointment is on Apr 16 at 2 PM. You will receive a reminder 1 hour before.'],
      ['in', 'My appointment is confirmed. Thank you!'],
      ['event', 'Resolved by Priya Das', 'resolved'],
    ],
  },
  {
    channel: 'whatsapp', name: 'Vikram Singh', phone: '+91 77890 12345', status: 'bot', source: 't-ctwa', labels: ['refund'],
    unread: 0, minutesAgo: 300, inboundMinutesAgo: 300,
    messages: [
      ['in', 'Can I get a refund for my order?'],
      ['bot', 'I can help you with that. Please share your order ID.'],
      ['in', 'Can I get a refund?'],
    ],
  },
  {
    // Outside the 24h window: a free-form reply is refused; the template picker opens.
    channel: 'whatsapp', name: 'Meera Joshi', phone: '+91 88001 23456', status: 'agent', agent: 'rahul', source: 'direct',
    labels: ['satisfied'], unread: 0, minutesAgo: 2 * 1440, inboundMinutesAgo: 2 * 1440,
    messages: [
      ['in', 'Is the product available in blue?'],
      ['bot', 'Yes! Blue is available in sizes S, M, and L. Would you like to order?'],
      ['in', 'Perfect! See you tomorrow.'],
    ],
  },
  {
    bot: 'sales', channel: 'whatsapp', name: 'Nisha Gupta', phone: '+91 99887 76655', status: 'agent', agent: 'priya', source: 'broadcast',
    labels: [], unread: 1, minutesAgo: 240, inboundMinutesAgo: 240,
    messages: [
      ['event', 'Received "Flash Sale – Apr 15" broadcast message', 'broadcast'],
      ['bot', 'Hi Nisha! Our biggest sale is LIVE today. Use code SAVE20 for 20% off! 🎉'],
      ['in', 'Thanks for the flash sale update!'],
      ['event', 'Assigned to Priya Das', 'assigned'],
    ],
  },
  // ── Instagram ────────────────────────────────────────────────────────────
  {
    channel: 'instagram', name: 'Ananya Rao', handle: '@ananya.rao', status: 'bot', source: 'dm', labels: ['lead'],
    unread: 2, starred: true, minutesAgo: 2, isFollower: true, profile: { email: 'ananya.rao@gmail.com' },
    messages: [['in', 'Hey! Saw your story about the new collection'], ['in', 'Is the blue one still in stock?']],
  },
  {
    channel: 'instagram', name: 'Karthik Iyer', handle: '@karthik.iyer', status: 'agent', agent: 'rahul', source: 'dm',
    labels: ['customer'], unread: 0, minutesAgo: 18, isFollower: true,
    messages: [['in', 'Do you ship to Bangalore?'], ['agent', 'Yes, 3-5 business days!', 'rahul'], ['in', 'Thanks for the quick reply!']],
  },
  {
    channel: 'instagram', name: 'Meera Nair', handle: '@meera.creates', status: 'agent', agent: 'rahul', source: 'comment',
    externalRef: '17895695668004550', labels: ['influencer'], unread: 1, minutesAgo: 60, isFollower: true,
    messages: [['in', 'Commented on your reel 🔥 — do you collaborate with creators?']],
  },
  {
    channel: 'instagram', name: 'Rohit Sharma', handle: '@rohit.s', status: 'resolved', agent: 'aryan', source: 'story',
    externalRef: '18012345678901234', labels: [], unread: 0, minutesAgo: 2 * 1440, isFollower: false,
    messages: [['in', 'Replied to your story!'], ['agent', 'Glad you liked it 🙌', 'aryan'], ['in', 'Perfect, thank you!']],
  },
  {
    channel: 'instagram', name: 'Divya Menon', handle: '@divya.menon', status: 'resolved', source: 'dm', labels: ['lead'],
    unread: 0, archived: true, minutesAgo: 5 * 1440, isFollower: true,
    messages: [['in', 'Do you do bulk orders?'], ['bot', 'Yes! Let me connect you with our team.'], ['in', 'Will check and get back']],
  },
  // ── Website Chat ─────────────────────────────────────────────────────────
  {
    // Gave an email to the bot flow, so the inbox shows the email.
    channel: 'webchat', name: 'Visitor #4821', visitorId: 'v_4f9a21e8', status: 'bot', source: 'direct', labels: ['lead'],
    unread: 2, minutesAgo: 1, profile: { email: 'visitor4821@example.com' },
    visitor: { page: '/pricing', browser: 'Chrome', os: 'Windows', location: 'Mumbai, India', referrer: 'google.com', visits: 1 },
    messages: [
      ['in', 'Hi, quick question about pricing'],
      ['bot', 'Sure! Mind sharing your email in case we get disconnected?'],
      ['answer', 'Email Address', 'email', 'visitor4821@example.com'],
      ['bot', 'Hi! Happy to help — what would you like to know?'],
      ['in', 'Do you have a refund policy?'],
    ],
  },
  {
    channel: 'webchat', name: 'Sarah Wilson', visitorId: 'v_7c2b8d31', status: 'agent', agent: 'priya', source: 'direct',
    labels: ['customer', 'vip'], unread: 0, minutesAgo: 15,
    visitor: { page: '/help/live-chat', browser: 'Safari', os: 'macOS', location: 'Austin, US', referrer: 'direct', visits: 9 },
    profile: { email: 'sarah.wilson@gmail.com', phone: '+1 512 555 0142' },
    messages: [
      ['in', 'Is live chat support 24/7?'],
      ['event', 'Assigned to Priya Das', 'assigned'],
      ['agent', "Yes! We're here around the clock.", 'priya'],
      ['in', 'Perfect, thank you!'],
    ],
  },
  {
    channel: 'webchat', name: 'Marcus Chen', visitorId: 'v_c83fa62d', status: 'agent', agent: 'rahul', source: 'direct',
    labels: ['vip', 'prospect'], unread: 1, minutesAgo: 40,
    visitor: { page: '/enterprise', browser: 'Edge', os: 'Windows', location: 'Singapore', referrer: 'linkedin.com', visits: 6 },
    profile: { email: 'marcus.chen@enterprise.io', company: 'Chen Enterprises' },
    messages: [
      ['in', 'We are evaluating tools for a 200-seat rollout'],
      ['event', 'Assigned to Rahul Mehta', 'assigned'],
      ['agent', "That's great to hear! Let me get you our enterprise deck.", 'rahul'],
      ['in', 'Can someone call me back about enterprise pricing?'],
      ['agent', "Of course — what's the best number to reach you on?", 'rahul'],
      ['answer', 'Phone Number', 'phone', '+65 8123 4567'],
    ],
  },
  {
    channel: 'webchat', name: 'Jordan Lee', visitorId: 'v_92d4b7ea', status: 'bot', source: 'direct', labels: ['support'],
    unread: 1, minutesAgo: 75,
    visitor: { page: '/docs/api/auth', browser: 'Firefox', os: 'Linux', location: 'São Paulo, Brazil', referrer: 'github.com', visits: 1 },
    messages: [
      ['bot', 'Before we dive in, who do I have the pleasure of helping?'],
      ['answer', 'Name', 'short', 'Jordan Lee'],
      ['in', 'How do I authenticate API requests?'],
      ['bot', 'You can use a Bearer token in the Authorization header — want the docs link?'],
    ],
  },
  {
    // Hasn't said who they are: shown by their unique visitor id.
    channel: 'webchat', name: 'Visitor #4790', visitorId: 'v_1a5e9f04', status: 'bot', source: 'direct', labels: [],
    unread: 1, minutesAgo: 25,
    visitor: { page: '/features/whatsapp', browser: 'Chrome', os: 'Android', location: 'Pune, India', referrer: 'instagram.com', visits: 2 },
    messages: [
      ['bot', 'Hi there 👋 How can I help you today?'],
      ['in', 'Does the WhatsApp bot support Hindi?'],
    ],
  },
]

const IG_FOLLOWERS = [
  { name: 'Priya Sharma', handle: '@priya.sharma' },
  { name: 'Vikram Singh', handle: '@vikram.singh' },
  { name: 'Neha Gupta', handle: '@neha.gupta' },
  { name: 'Arjun Mehta', handle: '@arjun.mehta' },
  { name: 'Sana Khan', handle: '@sana.khan' },
]

const TEMPLATES = [
  { name: 'order_confirmation', category: 'TRANSACTIONAL', status: 'APPROVED', header: null, headerType: 'NONE', body: 'Hello {{1}}, your order #{{2}} has been confirmed! Expected delivery: {{3}}.', buttons: ['Track Order', 'Contact Support'] },
  { name: 'appointment_reminder', category: 'UTILITY', status: 'APPROVED', header: null, headerType: 'NONE', body: 'Reminder: You have an appointment on {{1}} at {{2}}. Reply CONFIRM or RESCHEDULE.', buttons: ['Confirm', 'Reschedule'] },
  { name: 'welcome_message', category: 'MARKETING', status: 'APPROVED', header: null, headerType: 'NONE', body: "Welcome to {{1}}, {{2}}! We're thrilled to have you. Type HELP to see what I can do.", buttons: [] },
  { name: 'shipping_update', category: 'TRANSACTIONAL', status: 'PENDING', header: null, headerType: 'NONE', body: 'Great news {{1}}! Order #{{2}} has been shipped. Track here: {{3}}', buttons: ['Track Order'] },
  { name: 'store_credits_reminder', category: 'MARKETING', status: 'APPROVED', header: 'Your store credits', headerType: 'TEXT', body: 'Hi {{1}}, you have ₹{{2}} in store credits. Use them before {{3}}.', buttons: ['Use Credits Now', 'View Balance'] },
  { name: 'order_confirmation_v3', category: 'UTILITY', status: 'APPROVED', header: 'Order confirmed', headerType: 'TEXT', body: 'Hi {{1}}, your order #{{2}} is confirmed and arrives by {{3}}.', buttons: ['Track Order', 'Contact Support'] },
  { name: 'follow_up_after_chat', category: 'UTILITY', status: 'APPROVED', header: null, headerType: 'NONE', body: 'Hi {{1}}, following up on your recent conversation with us. Reply here and we will pick it right back up.', buttons: [] },
]

const client = new pg.Client({ connectionString: url })
await client.connect()

const reset = process.argv.includes('--reset')
const existing = await client.query('SELECT count(*)::int AS n FROM users')
if (existing.rows[0].n > 0 && !reset) {
  console.log('Users already exist — nothing to do (use --reset to wipe and reseed).')
  await client.end()
  process.exit(0)
}

await client.query('BEGIN')
try {
  if (reset) {
    await client.query('TRUNCATE inbox_events, call_sessions, messages, conversations, contacts, wa_templates, devices, refresh_tokens, bot_agents, bots, users RESTART IDENTITY CASCADE')
  }

  const userIds = {} as Record<UserKey, string>
  for (const u of USERS) {
    const r = await client.query(
      `INSERT INTO users (email, password_hash, name, initials, color, role, presence) VALUES ($1,$2,$3,$4,$5,$6,'offline') RETURNING id`,
      [u.email, await hashPassword(u.password), u.name, u.initials, u.color, u.role])
    userIds[u.key] = r.rows[0].id
  }
  const nameOf = (k: UserKey) => USERS.find(u => u.key === k)!.name

  // The workspace owner's own admin login. Its password is generated once and
  // kept in scripts/.owner-login.json (gitignored), never in source.
  const ownerEmail = process.env.OWNER_EMAIL ?? 'tech_login@smatbot.com'
  const ownerFile = fileURLToPath(new URL('./.owner-login.json', import.meta.url))
  const owner = existsSync(ownerFile)
    ? (JSON.parse(readFileSync(ownerFile, 'utf8')) as { email: string; password: string; name: string })
    : { email: ownerEmail, password: randomBytes(9).toString('base64url'), name: process.env.OWNER_NAME ?? 'Deepak' }
  if (!existsSync(ownerFile)) writeFileSync(ownerFile, JSON.stringify(owner, null, 2) + '\n')
  const ownerRow = await client.query(
    `INSERT INTO users (email, password_hash, name, initials, color, role, presence) VALUES ($1,$2,$3,$4,'#0066FF','admin','offline') RETURNING id`,
    [owner.email, await hashPassword(owner.password), owner.name, owner.name.slice(0, 2).toUpperCase()])
  void ownerRow

  const botIds = {} as Record<BotKey, string>
  for (const b of BOTS) {
    const r = await client.query(
      `INSERT INTO bots (name, channel, identity, description, color, status) VALUES ($1,$2,$3,$4,$5,$6) RETURNING id`,
      [b.name, b.channel, b.identity, b.description, b.color, b.status ?? 'active'])
    botIds[b.key] = r.rows[0].id
    for (const a of b.agents) await client.query(`INSERT INTO bot_agents (bot_id, user_id) VALUES ($1, $2)`, [r.rows[0].id, userIds[a]])
  }
  const defaultBot: Record<Seed['channel'], BotKey> = { whatsapp: 'support', instagram: 'instagram', webchat: 'website' }

  for (const t of TEMPLATES) {
    await client.query(
      `INSERT INTO wa_templates (name, language, category, status, header_type, header, body, buttons) VALUES ($1,'en_US',$2,$3,$4,$5,$6,$7)`,
      [t.name, t.category, t.status, t.headerType, t.header, t.body, t.buttons])
  }

  for (const f of IG_FOLLOWERS) {
    await client.query(`INSERT INTO contacts (channel, name, handle, is_follower) VALUES ('instagram', $1, $2, true)`, [f.name, f.handle])
  }

  const minutes = (n: number) => new Date(Date.now() - n * 60_000)

  for (const c of CONVERSATIONS) {
    const phone = c.phone ? `+${c.phone.replace(/\D/g, '')}` : null
    const contact = await client.query(
      `INSERT INTO contacts (channel, name, phone, handle, visitor_id, external_id, is_follower, profile, visitor_meta)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id`,
      [c.channel, c.name, phone, c.handle ?? null, c.visitorId ?? null, phone?.slice(1) ?? null, c.isFollower ?? false,
        JSON.stringify(c.profile ?? {}), JSON.stringify(c.visitor ? { ...c.visitor, firstSeen: minutes(c.minutesAgo + 10).toISOString() } : {})])

    const lastAt = minutes(c.minutesAgo)
    const conv = await client.query(
      `INSERT INTO conversations (contact_id, channel, status, agent_id, source, labels, unread, starred, archived,
                                  last_inbound_at, external_ref, last_message_at, created_at, resolved_at, bot_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15) RETURNING id`,
      [contact.rows[0].id, c.channel, c.status, c.agent ? userIds[c.agent] : null, c.source, c.labels, c.unread,
        c.starred ?? false, c.archived ?? false, minutes(c.inboundMinutesAgo ?? c.minutesAgo),
        c.externalRef ?? null, lastAt, minutes(c.minutesAgo + c.messages.length + 5),
        c.status === 'resolved' ? lastAt : null, botIds[c.bot ?? defaultBot[c.channel]]])
    const convId = conv.rows[0].id

    let last = ''
    for (const [i, m] of c.messages.entries()) {
      const at = new Date(lastAt.getTime() - (c.messages.length - 1 - i) * 60_000)
      const row: Record<string, unknown> = { type: 'incoming', text: '', sender: null, agent_id: null, agent_name: null, template: null, question_type: null, label: null, value: null, event: null, delivery: null }
      switch (m[0]) {
        case 'in': Object.assign(row, { type: 'incoming', text: m[1], sender: c.name }); break
        case 'bot': Object.assign(row, { type: 'outgoing', text: m[1], sender: 'Bot', delivery: 'read' }); break
        case 'out': Object.assign(row, { type: 'outgoing', text: m[1], sender: 'Agent', delivery: 'read' }); break
        case 'agent': Object.assign(row, { type: 'outgoing', text: m[1], sender: 'Agent', agent_id: userIds[m[2]], agent_name: nameOf(m[2]), delivery: 'read' }); break
        case 'note': Object.assign(row, { type: 'note', text: m[1], sender: nameOf(m[2]), agent_id: userIds[m[2]], agent_name: nameOf(m[2]) }); break
        case 'event': Object.assign(row, { type: 'event', text: m[1], event: m[2] }); break
        case 'answer': Object.assign(row, { type: 'answer', label: m[1], question_type: m[2], value: m[3] }); break
        case 'template': Object.assign(row, { type: 'template', text: m[1], sender: 'Bot', template: JSON.stringify(m[2]), delivery: 'read' }); break
      }
      await client.query(
        `INSERT INTO messages (conversation_id, type, text, sender, agent_id, agent_name, template, question_type, label, value, event, delivery, created_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`,
        [convId, row.type, row.text, row.sender, row.agent_id, row.agent_name, row.template, row.question_type, row.label, row.value, row.event, row.delivery, at])
      if (['incoming', 'outgoing', 'template'].includes(row.type as string)) last = row.text as string
      if (row.type === 'answer') last = `${row.label}: ${row.value}`
    }
    await client.query(`UPDATE conversations SET last_message = $2, last_message_at = $3 WHERE id = $1`, [convId, last, lastAt])
  }

  await client.query('COMMIT')
  console.log(`Seeded ${USERS.length + 1} users, ${BOTS.length} bots, ${CONVERSATIONS.length} conversations, ${TEMPLATES.length} templates, ${IG_FOLLOWERS.length} Instagram followers.`)
  console.log(`Your admin login (${owner.email}) is in scripts/.owner-login.json.`)
  console.log('Demo logins: rahul@acmecorp.com / agent123 (agent), priya@acmecorp.com / super123 (supervisor), admin@acmecorp.com / admin123 (admin).')
} catch (err) {
  await client.query('ROLLBACK')
  throw err
} finally {
  await client.end()
}
