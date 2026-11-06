// Run: npx tsx scripts/ctwaRange.check.ts  (from backend/) — the date ranges of the Click to WA Ads screens.
import assert from 'node:assert/strict'
// @ts-expect-error plain JS module shared with the dashboard
import { resolveRange } from '../../src/components/ctwa/dateRange.js'
import { daysOf, parseRange } from '../src/ctwa/common.js'

const now = new Date(2026, 10, 6, 15, 30) // 6 Nov 2026, 15:30 local
const R = (preset: string, from = '', to = '') => resolveRange({ preset, from, to }, now)

let r = R('today'); assert.deepEqual([r.since, r.until, r.days, r.label], ['2026-11-06', '2026-11-06', 1, 'Today']); assert.equal(r.end, Math.floor(now.getTime() / 1000), 'today runs up to now')
assert.equal(r.start, Math.floor(new Date(2026, 10, 6).getTime() / 1000))
assert.deepEqual([r.prev.since, r.prev.until], ['2026-11-05', '2026-11-05'], 'the day before')

r = R('yesterday'); assert.deepEqual([r.since, r.until, r.days], ['2026-11-05', '2026-11-05', 1]); assert.equal(r.end, Math.floor(new Date(2026, 10, 6).getTime() / 1000) - 1, 'ends at the end of that day')

r = R('7'); assert.deepEqual([r.since, r.until, r.days], ['2026-10-31', '2026-11-06', 7]); assert.deepEqual([r.prev.since, r.prev.until], ['2026-10-24', '2026-10-30'], 'the 7 days before, with no gap or overlap')
r = R('30'); assert.equal(r.days, 30); assert.equal(R('90').days, 90)
r = R('month'); assert.deepEqual([r.since, r.until, r.days], ['2026-11-01', '2026-11-06', 6]); assert.deepEqual([r.prev.since, r.prev.until], ['2026-10-26', '2026-10-31'])
r = R('lastmonth'); assert.deepEqual([r.since, r.until, r.days, r.label], ['2026-10-01', '2026-10-31', 31, 'Last month'])

r = R('custom', '2026-10-12', '2026-10-18'); assert.deepEqual([r.days, r.label], [7, '12 Oct – 18 Oct 2026']); assert.deepEqual([r.prev.since, r.prev.until], ['2026-10-05', '2026-10-11'])
assert.equal(R('custom', '2026-10-12', '2026-10-12').label, '12 Oct 2026')
assert.equal(R('custom', '', '2026-10-18'), null, 'incomplete')
assert.equal(R('custom', '2026-10-18', '2026-10-12'), null, 'backwards')
assert.equal(R('custom', '2026-01-01', '2026-11-01'), null, 'longer than 90 days')
assert.equal(R('custom', '2026-11-05', '2026-11-20'), null, 'the future')
assert.equal(R('custom', '2026-08-09', '2026-11-06').days, 90, 'exactly 90 days is allowed')

// the server keeps those calendar days, whatever the time zone of its own clock
const q = parseRange({ start: String(r.start), end: String(r.end), since: '2026-10-12', until: '2026-10-18' })
assert.deepEqual(daysOf(q), ['2026-10-12', '2026-10-13', '2026-10-14', '2026-10-15', '2026-10-16', '2026-10-17', '2026-10-18'])
assert.deepEqual(daysOf(parseRange({ start: '1000', end: '1000000' })).length > 0, true, 'old clients without since/until still work')
assert.throws(() => parseRange({ start: '1', end: '90000', since: '2026-01-01', until: '2026-06-01' }), /90 days/)
assert.throws(() => parseRange({ start: '1', end: '90000', since: '2026-06-02', until: '2026-06-01' }), /90 days/)
assert.deepEqual(parseRange({ start: '1', end: '90000', since: 'junk', until: '2026-06-01' }).since, undefined, 'a malformed date is ignored, not trusted')
console.log('ctwa range: ok')
