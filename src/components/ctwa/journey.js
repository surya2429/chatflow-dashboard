/* A lead's journey from ad to sale, as an ordered list: the ad click, what happened in the chat, and every event
   reported to Meta. The chat part comes from the inbox conversation (matched by WhatsApp number) when there is one. */
import { eventLabel } from './eventLabels.js'

export const digits = (v) => String(v || '').replace(/\D/g, '')

/** the inbox conversation for this lead, if the chat exists there */
export const findConversation = (lead, conversations) => conversations.find((c) => c.channel !== 'webchat' && digits(c.phone) === lead.waId) ?? null

const whoReplied = (m) => (m.sender === 'Bot' || m.from === 'bot' ? 'The bot' : m.agentName || m.sender || 'An agent')

export function buildJourney(lead, conv, fmt) {
  const steps = [{ key: 'ad', tone: 'blue', title: 'Saw your ad', detail: lead.adName || lead.headline || 'A Click-to-WhatsApp ad', when: fmt(lead.createdAt) }]
  steps.push({ key: 'click', tone: 'blue', title: 'Tapped “Send message” and opened WhatsApp', detail: lead.welcomeText ? `Greeting shown: “${lead.welcomeText}”` : null, when: fmt(lead.createdAt) })

  if (conv) {
    const msgs = conv.messages || []
    const first = msgs.find((m) => m.type === 'incoming' || (m.from && m.from !== 'bot' && m.from !== 'agent'))
    if (first?.text) steps.push({ key: 'first', tone: 'slate', title: 'Sent their first message', detail: `“${first.text}”`, when: first.time })
    const reply = msgs.find((m) => m.type === 'outgoing' || m.from === 'bot' || m.from === 'agent')
    if (reply) steps.push({ key: 'reply', tone: 'slate', title: `${whoReplied(reply)} replied`, detail: reply.text ? `“${String(reply.text).slice(0, 110)}”` : null, when: reply.time })
    for (const m of msgs) {
      if (m.type !== 'event' || m.event === 'ctwa_entry') continue
      steps.push({ key: `ev-${m.id}`, tone: m.event === 'assigned' || m.event === 'bot_handover' ? 'violet' : 'slate', title: m.text, detail: null, when: m.time })
    }
    if (conv.status === 'resolved') steps.push({ key: 'resolved', tone: 'green', title: 'Conversation resolved', detail: conv.agentName ? `Closed by ${conv.agentName}` : null, when: null })
  }

  for (const e of [...lead.events].sort((a, b) => a.at.localeCompare(b.at))) {
    steps.push({
      key: `meta-${e.at}-${e.eventName}`, tone: e.status === 'failed' ? 'red' : 'green', meta: true,
      title: `${eventLabel(e.eventName)} sent to Meta${e.status === 'simulated' ? ' (test)' : ''}`,
      detail: e.status === 'failed' ? `Failed: ${e.error || 'Meta did not accept it'}` : e.value != null ? `${e.currency || ''} ${e.value}`.trim() : null,
      when: fmt(e.at),
    })
  }
  return steps
}

/** money the lead is known to have brought in (successful Purchase events) */
export const revenueOf = (lead) => lead.events.filter((e) => e.eventName === 'Purchase' && e.status !== 'failed').reduce((n, e) => n + (e.value || 0), 0)
