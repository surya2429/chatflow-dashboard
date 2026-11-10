/* Property Cards question type (real estate): the data a merchant enters and how a card reads it. Pure.
   A card = project media (photos / videos), name, location (+ optional map link), config & status, price with an
   optional GST note, a few highlights, and two buttons (Interested / Site visit) that either continue inside the
   chat or open an external link. */

/** Only http(s) links are ever followed or opened: these come from whoever built the flow and are shown to visitors. */
export const safeUrl = (u) => (typeof u === 'string' && /^https?:\/\/[^\s]+$/i.test(u.trim()) ? u.trim() : '')

const YOUTUBE = /(?:youtube\.com\/(?:watch\?(?:[^#]*&)?v=|embed\/|shorts\/)|youtu\.be\/)([\w-]{11})/i
const VIMEO = /vimeo\.com\/(?:video\/)?(\d+)/i
const VIDEO_FILE = /\.(mp4|webm|ogg|mov)(?:[?#].*)?$/i

/** A media link → how to show it. YouTube / Vimeo become embeds, video files a <video>, anything else an image. */
export function mediaOf(url) {
  const src = safeUrl(url)
  if (!src) return null
  const yt = src.match(YOUTUBE)
  if (yt) return { kind: 'embed', src: `https://www.youtube.com/embed/${yt[1]}?rel=0`, thumb: `https://img.youtube.com/vi/${yt[1]}/mqdefault.jpg`, label: 'Video' }
  const vm = src.match(VIMEO)
  if (vm) return { kind: 'embed', src: `https://player.vimeo.com/video/${vm[1]}`, label: 'Video' }
  if (VIDEO_FILE.test(src)) return { kind: 'video', src, label: 'Video' }
  return { kind: 'image', src, label: 'Photo' }
}

export const MAX_MEDIA = 5
export const MAX_HIGHLIGHTS = 4
export const GST_PRESETS = ['+ 5% GST', '+ 1% GST', 'Incl. GST', '+ GST as applicable']

/** '' when a link field is empty or usable; otherwise what is wrong with it (the widget ignores an unusable link). */
export const linkError = (v) => (!String(v || '').trim() || safeUrl(v) ? '' : 'Use a full link starting with https://')

/** Everything that stops a card from showing properly, for the editor's list. */
export function cardProblems(c, d = {}) {
  const p = []
  if (!(c.name || '').trim()) p.push('Add a project name: cards without one are not shown')
  if (linkError(c.locationUrl)) p.push('The location link is not a valid https:// link')
  if (d.interestedEnabled !== false && linkError(c.interestedUrl)) p.push('The Interested link is not a valid https:// link')
  if (d.siteVisitEnabled !== false && linkError(c.siteVisitUrl)) p.push('The Site visit link is not a valid https:// link')
  if ((c.media || []).some((m) => String(m || '').trim() && !safeUrl(m))) p.push('A photo or video link is not a valid https:// link')
  return p
}

export const STATUS_OPTIONS = ['New launch', 'Under construction', 'Ready to move', 'Possession soon']

let cardSeq = 0 // with the clock, so two cards made in the same millisecond still get different ids
export const newPropertyCard = (over = {}) => ({
  id: `prop_${Date.now().toString(36)}_${(cardSeq++).toString(36)}`,
  name: '', media: [''], location: '', locationUrl: '', config: '', status: '', price: '', gstEnabled: false, gst: '', highlights: '', rera: '',
  interestedUrl: '', siteVisitUrl: '', interestedJump: null, siteVisitJump: null, ...over,
})

export const DEFAULT_PROPERTIES = [
  newPropertyCard({
    id: 'prop_demo_1', name: 'Skyline Heights', media: ['https://picsum.photos/seed/skyline1/640/400', 'https://picsum.photos/seed/skyline2/640/400'],
    location: 'Baner, Pune', locationUrl: 'https://maps.google.com/?q=Baner+Pune', config: '2 & 3 BHK · 950–1,450 sq ft', status: 'Under construction',
    price: '₹85 Lakh onwards', gstEnabled: true, gst: '+ 5% GST', highlights: 'Clubhouse, Swimming pool, Gym', rera: 'P52100012345',
  }),
  newPropertyCard({
    id: 'prop_demo_2', name: 'Green Valley Villas', media: ['https://picsum.photos/seed/villa1/640/400'],
    location: 'Whitefield, Bengaluru', config: '4 BHK villa · 2,800 sq ft', status: 'Ready to move',
    price: '₹2.4 Cr', gstEnabled: false, highlights: 'Private garden, Gated community',
  }),
]

/** What a card shows for a node's saved data (falls back to the samples so the preview is never empty). */
export const cardsOf = (data) => {
  const list = Array.isArray(data?.propertyCards) ? data.propertyCards.filter((c) => (c.name || '').trim()) : []
  return list.length ? list : DEFAULT_PROPERTIES
}

export const highlightsOf = (c) => String(c.highlights || '').split(',').map((s) => s.trim()).filter(Boolean).slice(0, 4)

