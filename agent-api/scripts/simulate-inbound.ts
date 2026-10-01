/*
 * Plays customer traffic into a running agent-api, so the app has something
 * to react to without a real WhatsApp/Instagram number or website widget.
 *
 *   npm run simulate                    # one message on each channel
 *   npm run simulate -- whatsapp "Hi!"  # one message on one channel
 *   npm run simulate -- handover <conversationId>
 *
 * Goes through /internal/* exactly as backend/'s webhook pipeline would.
 */
import 'dotenv/config'

const BASE = process.env.AGENT_API_URL ?? `http://localhost:${process.env.PORT ?? 8090}`
const KEY = process.env.INTERNAL_API_KEY
if (!KEY) { console.error('INTERNAL_API_KEY is required (see .env)'); process.exit(1) }

async function post(path: string, body: unknown) {
  const res = await fetch(`${BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-internal-key': KEY! },
    body: JSON.stringify(body),
  })
  const json = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(`${path} → ${res.status} ${JSON.stringify(json)}`)
  return json
}

const SAMPLES = {
  whatsapp: { channel: 'whatsapp', phone: '+91 98765 43210', name: 'Priya Sharma', text: 'Any update on my order? 🙏' },
  instagram: { channel: 'instagram', handle: '@ananya.rao', name: 'Ananya Rao', source: 'dm', text: 'Also — do you have it in size M?' },
  webchat: { channel: 'webchat', visitorId: 'v_c83fa62d', name: 'Marcus Chen', text: 'Just checking in on that enterprise quote.' },
} as const

const [cmd, arg] = process.argv.slice(2)

if (cmd === 'handover') {
  if (!arg) { console.error('usage: simulate handover <conversationId>'); process.exit(1) }
  console.log(await post(`/internal/conversations/${arg}/handover`, {}))
} else if (cmd && cmd in SAMPLES) {
  const sample = SAMPLES[cmd as keyof typeof SAMPLES]
  console.log(await post('/internal/inbound', { ...sample, ...(arg && { text: arg }) }))
} else {
  for (const sample of Object.values(SAMPLES)) console.log(sample.channel, await post('/internal/inbound', sample))
}
