// Run: node scripts/propertyCards.check.mjs  (from backend/) — the Property Cards question type's data rules.
import assert from 'node:assert/strict'
import { cardsOf, DEFAULT_PROPERTIES, highlightsOf, mediaOf, newPropertyCard, safeUrl } from '../../src/components/webchat/propertyCards.js'

// links shown to visitors: http(s) only
assert.equal(safeUrl('https://maps.google.com/?q=Pune'), 'https://maps.google.com/?q=Pune')
assert.equal(safeUrl('  http://x.test/a  '), 'http://x.test/a')
for (const bad of ['javascript:alert(1)', 'data:text/html,<script>', 'ftp://x.test', '//x.test', 'x.test', '', null, undefined, 'https://a b.test']) assert.equal(safeUrl(bad), '', String(bad))

// what a media link turns into
assert.deepEqual(mediaOf('https://cdn.test/p.jpg'), { kind: 'image', src: 'https://cdn.test/p.jpg', label: 'Photo' })
assert.equal(mediaOf('https://cdn.test/tour.mp4?x=1').kind, 'video')
assert.equal(mediaOf('https://cdn.test/tour.WEBM').kind, 'video')
assert.equal(mediaOf('https://www.youtube.com/watch?v=dQw4w9WgXcQ').src, 'https://www.youtube.com/embed/dQw4w9WgXcQ?rel=0')
assert.equal(mediaOf('https://youtu.be/dQw4w9WgXcQ').kind, 'embed')
assert.equal(mediaOf('https://www.youtube.com/shorts/dQw4w9WgXcQ').kind, 'embed')
assert.equal(mediaOf('https://vimeo.com/123456789').src, 'https://player.vimeo.com/video/123456789')
assert.equal(mediaOf('javascript:alert(1)'), null)
assert.equal(mediaOf(''), null)
assert.equal(mediaOf('https://evil.test/embed?u=youtube.com/watch?v=dQw4w9WgXcQ').kind, 'embed', 'known limit: a YouTube id anywhere in a link is treated as that video')

// what a node shows: its own cards, or the samples when it has none
assert.equal(cardsOf({}), DEFAULT_PROPERTIES)
assert.equal(cardsOf({ propertyCards: [] }), DEFAULT_PROPERTIES)
assert.equal(cardsOf({ propertyCards: [newPropertyCard({ name: '  ' })] }), DEFAULT_PROPERTIES, 'a card with no name is not shown')
const mine = [newPropertyCard({ name: 'Orchid Towers' }), newPropertyCard({ name: 'Lake View' })]
assert.equal(cardsOf({ propertyCards: mine }).length, 2)
assert.notEqual(newPropertyCard().id, newPropertyCard().id, 'every card gets its own id')
assert.deepEqual(highlightsOf({ highlights: ' Gym, Pool ,, Garden, Clubhouse, Parking, Lift ' }), ['Gym', 'Pool', 'Garden', 'Clubhouse'], 'at most four')
assert.deepEqual(highlightsOf({}), [])
console.log('property cards: ok')
