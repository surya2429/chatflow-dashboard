/*
 * Dev only: 30 days of past agent activity, so Analytics has something to show
 * on a fresh database.
 *
 *   npm run seed:history              adds the history (a no-op if it's there)
 *   npm run seed:history -- --reset   removes it and adds it again
 *
 * Every history chat is resolved and archived, so it stays out of the inbox.
 * They're tagged by contact external_id 'hist_…', which is what --reset removes.
 */
import { randomInt } from 'node:crypto'
import { env } from '../src/config/env.js'
import { pool, withTransaction } from '../src/db/pool.js'

if (env.NODE_ENV === 'production') {
  console.error('Refusing to add demo history to a production database.')
  process.exit(1)
}

const DAYS = 30
const reset = process.argv.includes('--reset')

const FIRST = ['Aarav', 'Diya', 'Kabir', 'Ishita', 'Rohan', 'Sneha', 'Vivaan', 'Ananya', 'Arjun', 'Meera', 'Nikhil', 'Pooja', 'Rahul', 'Sara', 'Tanvi', 'Yash', 'Emma', 'Liam', 'Noah', 'Olivia', 'Zara', 'Kavya', 'Dev', 'Riya']
const LAST = ['Sharma', 'Iyer', 'Kapoor', 'Nair', 'Reddy', 'Gupta', 'Mehta', 'Das', 'Joshi', 'Singh', 'Khan', 'Wilson', 'Chen', 'Patel', 'Rao']
const OPENERS = [
  'Hi, I need help with my order', 'Where is my delivery?', 'Can I change my delivery address?', 'Do you have this in a larger size?',
  'I was charged twice for my order', 'How do I return an item?', 'Is the blue one still in stock?', 'What are your pricing plans?',
  'My payment failed but money was deducted', 'Can I get a GST invoice?', 'When will my refund arrive?', 'Do you deliver to Pune?',
]
const FOLLOWUPS = ['Order #48213', 'It was supposed to arrive yesterday', 'Yes please', 'The one in the photo', 'Okay, how long will it take?', 'Sure, here you go']
const REPLIES = [
  'Thanks for reaching out! Let me check that for you.', 'I can help with that — could you share your order ID?',
  'I’ve checked your order, it’s out for delivery today.', 'Done! I’ve updated it for you.', 'Your refund has been initiated, it takes 3–5 working days.',
  'Yes, it’s in stock. Shall I reserve one for you?', 'I’ve raised this with our team and will update you shortly.',
]
const CLOSERS = ['Thank you so much!', 'Great, thanks!', 'Perfect 👍', 'That’s all, thanks']

const pick = <T,>(xs: readonly T[]) => xs[randomInt(xs.length)]!
const rand = (min: number, max: number) => min + Math.random() * (max - min)
/** Exponential wait with a given mean, in ms — reply times are long-tailed. */
const wait = (meanMin: number) => Math.max(15_000, -Math.log(1 - Math.random()) * meanMin * 60_000)

async function main() {
  const existing = await pool.query(`SELECT count(*)::int AS n FROM contacts WHERE external_id LIKE 'hist\\_%'`)
  if (existing.rows[0].n > 0 && !reset) {
    console.log(`History is already there (${existing.rows[0].n} customers). Use --reset to rebuild it.`)
    return
  }
  if (reset) {
    const r = await pool.query(`DELETE FROM contacts WHERE external_id LIKE 'hist\\_%'`)
    console.log(`Removed ${r.rowCount} history customers (and their chats).`)
  }

  const users = (await pool.query<{ id: string; name: string; role: string }>(
    `SELECT id, name, role FROM users WHERE is_active = true ORDER BY name`)).rows
  const bots = (await pool.query<{ id: string; channel: 'whatsapp' | 'instagram' | 'webchat'; name: string }>(
    `SELECT id, channel, name FROM bots WHERE status = 'active'`)).rows
  const assignments = (await pool.query<{ bot_id: string; user_id: string }>(`SELECT bot_id, user_id FROM bot_agents`)).rows

  let chats = 0
  let messages = 0
  let n = 0
  await withTransaction(async (tx) => {
    for (const u of users) {
      const theirs = bots.filter(b => assignments.some(a => a.user_id === u.id && a.bot_id === b.id))
      const pool_ = theirs.length ? theirs : bots
      if (!pool_.length) continue
      // Each person gets a pace: how many chats a day and how fast they reply.
      const perDay = u.role === 'agent' ? rand(4, 8) : rand(1.5, 3.5)
      const replyMean = rand(1.2, 5)

      for (let d = DAYS - 1; d >= 0; d--) {
        const day = new Date()
        day.setDate(day.getDate() - d)
        const weekend = day.getDay() === 0 || day.getDay() === 6
        const count = Math.round(perDay * (weekend ? 0.45 : 1) * rand(0.6, 1.4))
        for (let i = 0; i < count; i++) {
          // Busier late morning and early evening.
          const hour = Math.random() < 0.55 ? randomInt(10, 14) : randomInt(9, 21)
          const start = new Date(day.getFullYear(), day.getMonth(), day.getDate(), hour, randomInt(60), randomInt(60))
          if (start.getTime() > Date.now() - 2 * 3_600_000) continue

          const bot = pick(pool_)
          const name = `${pick(FIRST)} ${pick(LAST)}`
          const tag = `hist_${++n}`
          const ident = bot.channel === 'whatsapp' ? { phone: `+91 9${randomInt(100_000_000, 999_999_999)}`, handle: null, visitor: null }
            : bot.channel === 'instagram' ? { phone: null, handle: `@${name.toLowerCase().replace(' ', '.')}${randomInt(10, 99)}`, visitor: null }
              : { phone: null, handle: null, visitor: `v_${randomInt(0x10000000, 0xffffffff).toString(16)}` }
          const contact = await tx.query<{ id: string }>(
            `INSERT INTO contacts (channel, name, avatar, phone, handle, visitor_id, external_id, created_at, updated_at)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$8) RETURNING id`,
            [bot.channel, name, name.split(' ').map(w => w[0]).join(''), ident.phone, ident.handle, ident.visitor, tag, start])

          // The thread: customer → bot → asks for a person → agent handles → resolved.
          const thread: { at: Date; type: string; text: string; sender: string | null; agent: boolean; event?: string }[] = []
          let t = start.getTime()
          const say = (type: string, text: string, sender: string | null, agent = false, event?: string) => thread.push({ at: new Date(t), type, text, sender, agent, event })
          say('incoming', pick(OPENERS), name)
          t += rand(5_000, 25_000); say('outgoing', 'Hi! I’m the assistant. Let me connect you with our team.', 'Bot')
          t += rand(30_000, 120_000); say('event', `Assigned to ${u.name}`, null, false, 'assigned')
          t += wait(replyMean); say('outgoing', pick(REPLIES), 'Agent', true)
          t += rand(40_000, 360_000); say('incoming', pick(FOLLOWUPS), name)
          t += wait(replyMean); say('outgoing', pick(REPLIES), 'Agent', true)
          if (Math.random() < 0.6) {
            t += rand(40_000, 240_000); say('incoming', pick(CLOSERS), name)
            t += wait(replyMean * 0.7); say('outgoing', 'Happy to help! Have a great day 😊', 'Agent', true)
          }
          t += rand(30_000, 600_000); say('event', `Resolved by ${u.name}`, null, true, 'resolved')
          const end = new Date(t)
          const lastText = [...thread].reverse().find(m => m.type !== 'event')!.text
          const lastInbound = [...thread].reverse().find(m => m.type === 'incoming')!.at

          const conv = await tx.query<{ id: string }>(
            `INSERT INTO conversations (contact_id, channel, status, agent_id, source, last_message, last_message_at, archived,
                                        last_inbound_at, resolved_at, created_at, updated_at, bot_id)
             VALUES ($1,$2,'resolved',$3,$4,$5,$6,true,$7,$6,$8,$6,$9) RETURNING id`,
            [contact.rows[0]!.id, bot.channel, u.id, bot.channel === 'instagram' ? 'dm' : 'direct', lastText, end, lastInbound, start, bot.id])

          const values: unknown[] = []
          const rows = thread.map((m, k) => {
            const b = k * 9
            values.push(conv.rows[0]!.id, m.type, m.text, m.sender, m.agent ? u.id : null, m.agent ? u.name : null, m.event ?? null, m.at,
              m.type === 'outgoing' ? 'read' : null)
            return `($${b + 1},$${b + 2}::inbox_message_type,$${b + 3},$${b + 4},$${b + 5},$${b + 6},$${b + 7},$${b + 8},$${b + 9}::delivery_status)`
          })
          await tx.query(
            `INSERT INTO messages (conversation_id, type, text, sender, agent_id, agent_name, event, created_at, delivery) VALUES ${rows.join(',')}`,
            values)
          chats++
          messages += thread.length
        }
      }
    }
  })
  console.log(`Added ${chats} past chats (${messages} messages) across ${users.length} people over ${DAYS} days — all resolved and archived.`)
}

main().catch((err) => { console.error(err); process.exitCode = 1 }).finally(() => { void pool.end() })
