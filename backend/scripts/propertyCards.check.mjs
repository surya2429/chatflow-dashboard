// Run: node scripts/propertyCards.check.mjs  (from backend/) — the Property Cards question type's data rules.
import assert from 'node:assert/strict'
import { cardProblems, cardsOf, DEFAULT_PROPERTIES, highlightsOf, linkError, mediaOf, newPropertyCard, safeUrl } from '../../src/components/webchat/propertyCards.js'

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
assert.equal(new Set(Array.from({ length: 500 }, () => newPropertyCard().id)).size, 500, 'every card gets its own id, even in the same millisecond')
assert.deepEqual(highlightsOf({ highlights: ' Gym, Pool ,, Garden, Clubhouse, Parking, Lift ' }), ['Gym', 'Pool', 'Garden', 'Clubhouse'], 'at most four')
assert.deepEqual(highlightsOf({}), [])
// the editor's checks
assert.equal(linkError(''), ''); assert.equal(linkError('https://x.test'), ''); assert.match(linkError('x.test'), /https/); assert.match(linkError('javascript:alert(1)'), /https/)
assert.equal(mediaOf('https://youtu.be/dQw4w9WgXcQ').thumb, 'https://img.youtube.com/vi/dQw4w9WgXcQ/mqdefault.jpg')
assert.deepEqual(cardProblems(newPropertyCard({ name: 'A', media: ['https://x.test/a.jpg'] })), [])
assert.equal(cardProblems(newPropertyCard({ name: ' ' })).length, 1, 'a card with no name')
const bad = cardProblems(newPropertyCard({ name: 'A', locationUrl: 'nope', interestedUrl: 'nope', siteVisitUrl: 'nope', media: ['nope'] }))
assert.equal(bad.length, 4)
assert.equal(cardProblems(newPropertyCard({ name: 'A', interestedUrl: 'nope' }), { interestedEnabled: false }).length, 0, 'a link on a hidden button is not a problem')
console.log('property cards: ok')
