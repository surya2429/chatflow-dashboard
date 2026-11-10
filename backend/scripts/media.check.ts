// Run: npx tsx scripts/media.check.ts  (from backend/) — uploads for the website chat: what is accepted, and how it is served.
import assert from 'node:assert/strict'
import { MAX_IMAGE_BYTES, MAX_VIDEO_BYTES, handleGet, handleUpload, parseRange, sniff, type MediaStore } from '../src/media/media.js'

const pad = (head: number[], len = 64) => Buffer.concat([Buffer.from(head), Buffer.alloc(Math.max(0, len - head.length), 7)])
const JPG = pad([0xff, 0xd8, 0xff, 0xe0]), PNG = pad([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
const GIF = pad([...Buffer.from('GIF89a')]), WEBP = pad([...Buffer.from('RIFF'), 1, 2, 3, 4, ...Buffer.from('WEBP')])
const MP4 = pad([0, 0, 0, 0x18, ...Buffer.from('ftypisom')]), WEBM = pad([0x1a, 0x45, 0xdf, 0xa3])
const MOV = pad([0, 0, 0, 0x14, ...Buffer.from('ftypqt  ')])

// what a file really is comes from its bytes
assert.deepEqual(sniff(JPG), { kind: 'image', mime: 'image/jpeg', ext: 'jpg' }); assert.equal(sniff(PNG)!.ext, 'png'); assert.equal(sniff(GIF)!.ext, 'gif'); assert.equal(sniff(WEBP)!.ext, 'webp')
assert.deepEqual(sniff(MP4), { kind: 'video', mime: 'video/mp4', ext: 'mp4' }); assert.equal(sniff(WEBM)!.ext, 'webm')
for (const bad of [Buffer.from('<script>alert(1)</script>........'), Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script/></svg>'), Buffer.from('MZ' + 'x'.repeat(40)), Buffer.alloc(5), MOV, Buffer.from('%PDF-1.7 ......')]) assert.equal(sniff(bad), null)

const mem = new Map<string, { mime: string; bytes: Buffer; bot: string }>()
const store: MediaStore = { put: async ({ id, botRef, mime, bytes }) => void mem.set(id, { mime, bytes, bot: botRef }), get: async (id) => mem.get(id) ?? null }

// uploading
let r = await handleUpload('bot_1', JPG, store); assert.equal(r.status, 201)
const { url } = r.body as { url: string; kind: string }; assert.match(url, /^\/api\/webchat-media\/[a-f0-9]{32}\.jpg$/); assert.equal((r.body as any).kind, 'image')
r = await handleUpload('bot_1', MP4, store); assert.match((r.body as any).url, /\.mp4$/); assert.equal((r.body as any).kind, 'video')
assert.equal((await handleUpload('bot_1', Buffer.from('<script>alert(1)</script>.....'), store)).status, 415, 'a script is not a photo, whatever it is named')
assert.equal((await handleUpload('bot_1', Buffer.alloc(0), store)).status, 400)
assert.equal((await handleUpload('bot_1', 'not a buffer', store)).status, 400)
assert.equal((await handleUpload(undefined, JPG, store)).status, 400); assert.equal((await handleUpload('../etc', JPG, store)).status, 400)
assert.equal((await handleUpload('bot_1', Buffer.concat([JPG, Buffer.alloc(MAX_IMAGE_BYTES)]), store)).status, 413, 'photo over the limit')
assert.equal((await handleUpload('bot_1', Buffer.concat([MP4, Buffer.alloc(MAX_IMAGE_BYTES + 10)]), store)).status, 201, 'a video may exceed the photo limit')
assert.equal((await handleUpload('bot_1', Buffer.concat([MP4, Buffer.alloc(MAX_VIDEO_BYTES)]), store)).status, 413)
assert.equal(new Set([...mem.keys()]).size, mem.size)

// serving
const file = url.split('/').pop()!
let g = await handleGet(file, undefined, store)
assert.equal(g.status, 200); assert.equal(g.headers['Content-Type'], 'image/jpeg'); assert.equal(g.headers['X-Content-Type-Options'], 'nosniff'); assert.equal(g.headers['Content-Length'], String(JPG.length)); assert.equal(g.body.length, JPG.length)
assert.match(g.headers['Cache-Control']!, /immutable/)
g = await handleGet(file, 'bytes=0-9', store); assert.equal(g.status, 206); assert.equal(g.body.length, 10); assert.equal(g.headers['Content-Range'], `bytes 0-9/${JPG.length}`)
g = await handleGet(file, 'bytes=60-', store); assert.equal(g.status, 206); assert.equal(g.body.length, JPG.length - 60)
g = await handleGet(file, 'bytes=-4', store); assert.equal(g.body.length, 4)
g = await handleGet(file, 'bytes=9999-', store); assert.equal(g.status, 416)
assert.equal((await handleGet('0'.repeat(32) + '.jpg', undefined, store)).status, 404)
for (const bad of ['../../etc/passwd', 'x.jpg', file.replace('.jpg', '.html'), file.replace('.jpg', '.svg'), `${file}/..`]) assert.equal((await handleGet(bad, undefined, store)).status, 404, bad)
assert.equal((await handleGet(file.replace('.jpg', '.png'), undefined, store)).headers['Content-Type'], 'image/jpeg', 'the stored type wins over the extension in the URL')

// ranges
assert.deepEqual(parseRange('bytes=0-99', 1000), { start: 0, end: 99 }); assert.deepEqual(parseRange('bytes=900-5000', 1000), { start: 900, end: 999 })
assert.equal(parseRange(undefined, 1000), null); assert.equal(parseRange('bytes=', 1000), 'invalid'); assert.equal(parseRange('bytes=5-2', 1000), 'invalid'); assert.equal(parseRange('items=0-1', 1000), 'invalid'); assert.equal(parseRange('bytes=-0', 1000), 'invalid')
console.log('media: ok')
