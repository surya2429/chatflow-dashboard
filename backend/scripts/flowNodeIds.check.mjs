// Run: node scripts/flowNodeIds.check.mjs  (from backend/) — node ids in the website-chat flow builder stay unique.
import assert from 'node:assert/strict'
import { dedupeNodeIds, nextNodeId } from '../../src/lib/flowNodeIds.js'

// the counter restarts on each page load, but a saved flow already holds n101, n102, n103…
const saved = [{ id: 'n1' }, { id: 'n101' }, { id: 'n102' }, { id: 'n103' }]
const a = nextNodeId(saved); assert.equal(a, 'n104', 'skips every id already used in the flow')
const grown = [...saved, { id: a }]
const b = nextNodeId(grown); assert.notEqual(b, a); assert.ok(!grown.some(n => n.id === b))
// many additions never repeat
let nodes = [...saved]
for (let i = 0; i < 300; i++) nodes.push({ id: nextNodeId(nodes) })
assert.equal(new Set(nodes.map(n => n.id)).size, nodes.length, 'no duplicates after 300 adds')

// a flow already saved with duplicates is repaired: first keeps its id, later ones get fresh unique ids
const dup = [{ id: 'n5', t: 'single' }, { id: 'n6' }, { id: 'n5', t: 'property' }, { id: 'n5', t: 'other' }]
const fixed = dedupeNodeIds(dup)
assert.equal(fixed[0].id, 'n5'); assert.equal(fixed[0].t, 'single', 'the original keeps its id')
assert.equal(new Set(fixed.map(n => n.id)).size, 4, 'every node reachable by its own id')
assert.deepEqual(fixed.map(n => n.t), ['single', undefined, 'property', 'other'], 'content untouched, order kept')
assert.equal(dedupeNodeIds(saved), saved, 'a clean flow comes back as the same array')
// fresh ids never collide with an id used later in the list
const tricky = [{ id: 'n1' }, { id: 'n1' }, { id: nextNodeId([]) }]
const fixed2 = dedupeNodeIds(tricky); assert.equal(new Set(fixed2.map(n => n.id)).size, 3)
console.log('flow node ids: ok')
