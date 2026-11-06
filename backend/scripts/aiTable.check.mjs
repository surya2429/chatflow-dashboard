// Run: node backend/scripts/aiTable.check.mjs  (from the repo root)
import assert from 'node:assert/strict'
import { buildTable, toCsv, toTsv, toMarkdown, toJson, groupCounts, sortRows, fileStem } from '../../src/components/ai/aiTable.js'

const convs = [
  { id: 1, name: 'Priya "PS" Sharma', phone: '+91 98765 43210', email: 'p@x.in', status: 'agent', agentName: 'Rahul', labels: ['vip', 'lead'], lastMessage: 'Hi,\nneed help', timestamp: '2026-11-05T10:05:00' },
  { id: 'wc2', name: '=HYPERLINK("http://evil")', channel: 'webchat', status: 'bot', labels: [], lastMessage: '@admin | pipe' },
  { id: 3, name: 'Ananya', handle: '@ananya', status: 'resolved', agentName: 'Rahul', labels: ['lead'] },
]
const t = buildTable(convs, { 1: 'asked to book 5pm' })

// real data only; empty columns dropped; the AI note only where there is one
assert.deepEqual(t.columns.map((c) => c.key), ['name', 'why', 'phone', 'email', 'handle', 'channel', 'status', 'agent', 'labels', 'lastMessage', 'lastActive'])
assert.equal(buildTable([convs[1]]).columns.some((c) => c.key === 'why' || c.key === 'phone'), false)
assert.equal(t.rows[0].why, 'asked to book 5pm')
assert.equal(t.rows[1].agent, 'Unassigned')
assert.equal(t.rows[1].channel, 'Website chat')
assert.equal(t.rows[2].channel, 'Instagram')
assert.equal(t.rows[0].lastActive, '2026-11-05 10:05')

// CSV: quotes/newlines escaped, formulas defused, phone numbers left alone
const csv = toCsv(t)
assert.ok(csv.includes('"Priya ""PS"" Sharma"'))
assert.ok(csv.includes('"Hi,\nneed help"'))
assert.ok(csv.includes(`"'=HYPERLINK(""http://evil"")"`))
assert.ok(csv.includes('+91 98765 43210') && !csv.includes("'+91"))
assert.ok(csv.includes("'@admin | pipe"))
assert.ok(toTsv(t).split('\n')[1].includes('Hi, need help'))      // tabs/newlines flattened for pasting into a sheet
assert.ok(toMarkdown(t).includes('@admin \\| pipe'))
assert.equal(JSON.parse(toJson(t))[0].Name, 'Priya "PS" Sharma')

// chart + sort
assert.deepEqual(groupCounts(t.rows, 'labels'), [{ label: 'lead', count: 2 }, { label: '(none)', count: 1 }, { label: 'vip', count: 1 }])
assert.deepEqual(groupCounts(t.rows, 'agent'), [{ label: 'Rahul', count: 2 }, { label: 'Unassigned', count: 1 }])
assert.deepEqual(sortRows(t.rows, 'agent', 'asc').map((r) => r.agent), ['Rahul', 'Rahul', 'Unassigned'])
assert.deepEqual(sortRows(t.rows, 'agent', 'desc').map((r) => r.agent), ['Unassigned', 'Rahul', 'Rahul'])
assert.match(fileStem('How many booked?!'), /^how-many-booked-\d{4}-\d{2}-\d{2}$/)
console.log('aiTable ok')
