// Run: node backend/scripts/ctwaJourney.check.mjs  (from the repo root)
import assert from 'node:assert/strict'
import { buildJourney, digits, findConversation, revenueOf } from '../../src/components/ctwa/journey.js'

const fmt = (iso) => iso.slice(0, 16).replace('T', ' ')
const lead = {
  id: 'l1', waId: '919876543210', contactName: 'Priya', adName: 'Summer Sale', headline: 'Flat 30% off', welcomeText: 'Hi! How can we help?', createdAt: '2026-11-05T10:00:00Z',
  events: [
    { eventName: 'Purchase', value: 2499, currency: 'INR', status: 'simulated', error: null, at: '2026-11-06T09:00:00Z' },
    { eventName: 'LeadSubmitted', value: null, currency: null, status: 'sent', error: null, at: '2026-11-05T11:00:00Z' },
    { eventName: 'QualifiedLead', value: null, currency: null, status: 'failed', error: 'Token expired', at: '2026-11-05T12:00:00Z' },
  ],
}
const conv = {
  id: '1', phone: '+91 98765 43210', status: 'resolved', agentName: 'Rahul Mehta',
  messages: [
    { id: 'e0', type: 'event', event: 'ctwa_entry', text: 'Started from Meta Ad', time: '10:40 AM' },
    { id: 'm1', type: 'incoming', text: 'Is the sale still on?', time: '10:42 AM' },
    { id: 'm2', type: 'outgoing', text: 'Yes! Let me check.', sender: 'Bot', time: '10:42 AM' },
    { id: 'e1', type: 'event', event: 'assigned', text: 'Assigned to Rahul Mehta', time: '10:43 AM' },
  ],
}

// the inbox chat is found by WhatsApp number, whatever the formatting; website chats never match
assert.equal(digits('+91 98765-43210'), '919876543210')
assert.equal(findConversation(lead, [{ id: 'x', phone: '+91 11111 11111' }, conv]), conv)
assert.equal(findConversation(lead, [{ id: 'w', channel: 'webchat', phone: '+91 98765 43210' }]), null)

// with a chat: ad → click → first message → reply → assignment → resolved → Meta events (oldest first)
const j = buildJourney(lead, conv, fmt)
assert.deepEqual(j.map((s) => s.key).slice(0, 6), ['ad', 'click', 'first', 'reply', 'ev-e1', 'resolved'])
assert.equal(j[1].detail, 'Greeting shown: “Hi! How can we help?”')
assert.equal(j[2].detail, '“Is the sale still on?”')
assert.equal(j[3].title, 'The bot replied')
assert.ok(!j.some((s) => s.key === 'ev-e0'))                                  // the ad-entry marker is already the first step
const meta = j.filter((s) => s.meta)
assert.deepEqual(meta.map((s) => s.title), ['Lead sent to Meta', 'Qualified lead sent to Meta', 'Purchase sent to Meta (test)'])
assert.equal(meta[1].tone, 'red'); assert.equal(meta[1].detail, 'Failed: Token expired')
assert.equal(meta[2].detail, 'INR 2499')

// without a chat in the inbox: still a journey, built from the ad and the events
const solo = buildJourney({ ...lead, events: [] }, null, fmt)
assert.deepEqual(solo.map((s) => s.key), ['ad', 'click'])

// revenue counts successful purchases only
assert.equal(revenueOf(lead), 2499)
assert.equal(revenueOf({ events: [{ eventName: 'Purchase', value: 100, status: 'failed' }] }), 0)
console.log('ctwaJourney ok')
