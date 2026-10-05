// IgDmPreview.jsx — a template rendered the way it appears in an Instagram DM.
//
// Drawn from the RECIPIENT's side: the business's message sits on the left in
// a grey bubble with its avatar, the customer's earlier message on the right
// in Instagram's purple-blue gradient. Cards and buttons follow the layout of
// Meta's Generic and Button templates (image, title, subtitle, then one
// full-width row per button). It is a faithful approximation, not a pixel
// copy — Instagram restyles its apps often, so the page says so.
import { useEffect, useRef, useState } from 'react'
import { ChevronLeft, Phone, Video, Mic, Image as ImageIcon, Smile, Camera, Signal, Wifi, BatteryFull, ImageOff } from 'lucide-react'
import { personalizeTemplate, SAMPLE_CONTACT } from './igTemplateKit'

const W = 290          // phone width at scale 1
const H = 580          // phone height at scale 1

function theme(dark) {
  return dark
    ? { bg: '#000', fg: '#fff', sub: '#a8a8a8', bubble: '#262626', line: '#363636', field: '#262626', border: '#262626' }
    : { bg: '#fff', fg: '#000', sub: '#737373', bubble: '#efefef', line: '#dbdbdb', field: '#fff', border: '#dbdbdb' }
}

function CardImage({ src, c }) {
  const [bad, setBad] = useState(false)
  useEffect(() => setBad(false), [src])
  if (!src) return null
  if (bad) {
    return (
      <div className="h-[112px] flex flex-col items-center justify-center gap-1" style={{ background: c.line, color: c.sub }}>
        <ImageOff size={18}/><span className="text-[10px]">Image can't be loaded</span>
      </div>
    )
  }
  return <img src={src} alt="" onError={() => setBad(true)} className="w-full h-[112px] object-cover block"/>
}

function Rows({ buttons, c }) {
  if (!buttons?.length) return null
  return buttons.map((b, i) => (
    <div key={i} className="py-[9px] text-center text-[12.5px] font-semibold px-2 truncate"
      style={{ borderTop: `1px solid ${c.line}`, color: c.fg }}>
      {b.title || <span style={{ color: c.sub }}>Button text</span>}
    </div>
  ))
}

function Card({ el, c, active }) {
  return (
    <div data-card className="flex-shrink-0 snap-start overflow-hidden transition-shadow"
      style={{
        width: 214, borderRadius: 18, background: c.bubble,
        boxShadow: active ? '0 0 0 2px #ee2a7b' : 'none',
      }}>
      <CardImage src={el.imageUrl} c={c}/>
      <div className="px-3 py-2.5">
        <p className="text-[13px] font-semibold leading-snug break-words" style={{ color: c.fg }}>
          {el.title || <span style={{ color: c.sub }}>Card title</span>}
        </p>
        {el.subtitle && <p className="text-[12px] leading-snug mt-0.5 break-words" style={{ color: c.sub }}>{el.subtitle}</p>}
      </div>
      <Rows buttons={el.buttons} c={c}/>
    </div>
  )
}

export default function IgDmPreview({
  template, dark = false, scale = 1, focusCard = null, fallbacks,
  brand = { name: 'yourbrand', initials: 'YB' },
  customerMessage = 'Hi! Is this still available?',
}) {
  const c = theme(dark)
  const t = personalizeTemplate(template, SAMPLE_CONTACT, fallbacks)
  const scroller = useRef(null)

  // Bring the card being edited into view in the carousel.
  useEffect(() => {
    if (focusCard == null || !scroller.current) return
    const card = scroller.current.querySelectorAll('[data-card]')[focusCard]
    card?.scrollIntoView?.({ behavior: 'smooth', inline: 'start', block: 'nearest' })
  }, [focusCard, template?.elements?.length])

  const avatar = (size) => (
    <div className="rounded-full flex-shrink-0 p-[1.5px]" style={{ width: size, height: size, background: 'linear-gradient(45deg,#f9ce34,#ee2a7b,#6228d7)' }}>
      <div className="w-full h-full rounded-full flex items-center justify-center font-bold"
        style={{ background: c.bg, color: c.fg, fontSize: size * 0.34, border: `${size > 24 ? 2 : 1}px solid ${c.bg}` }}>
        {brand.initials}
      </div>
    </div>
  )

  let body = null
  if (!t) {
    body = <div className="text-[12px] text-center py-10" style={{ color: c.sub }}>Nothing to preview yet</div>
  } else if (t.kind === 'generic') {
    body = (
      <div className="flex items-end gap-1.5">
        <div className="mb-0.5">{avatar(20)}</div>
        <div ref={scroller} className="flex gap-2 overflow-x-auto snap-x min-w-0 pb-1 -mr-3 pr-3" style={{ scrollbarWidth: 'none' }}>
          {t.elements.map((el, i) => <Card key={i} el={el} c={c} active={focusCard === i && t.elements.length > 1}/>)}
        </div>
      </div>
    )
  } else if (t.kind === 'button') {
    body = (
      <div className="flex items-end gap-1.5">
        <div className="mb-0.5">{avatar(20)}</div>
        <div className="overflow-hidden" style={{ maxWidth: 214, borderRadius: 18, background: c.bubble }}>
          <p className="px-3 py-2.5 text-[13px] leading-snug whitespace-pre-wrap break-words" style={{ color: c.fg }}>
            {t.text || <span style={{ color: c.sub }}>Your message</span>}
          </p>
          <Rows buttons={t.buttons} c={c}/>
        </div>
      </div>
    )
  } else {
    body = (
      <div className="flex items-end gap-1.5">
        <div className="mb-0.5">{avatar(20)}</div>
        <div className="px-3 py-2 text-[13px] leading-snug whitespace-pre-wrap break-words" style={{ maxWidth: 214, borderRadius: 20, background: c.bubble, color: c.fg }}>
          {t.text || <span style={{ color: c.sub }}>Your message</span>}
        </div>
      </div>
    )
  }

  return (
    <div style={{ width: W * scale, height: H * scale }} className="flex-shrink-0">
      <div style={{ width: W, height: H, transform: `scale(${scale})`, transformOrigin: 'top left' }}
        className="rounded-[40px] bg-[#101010] p-[7px] shadow-2xl ring-1 ring-black/20">
        <div className="w-full h-full rounded-[34px] overflow-hidden flex flex-col relative" style={{ background: c.bg, color: c.fg }}>
          {/* status bar */}
          <div className="flex items-center justify-between px-6 pt-2 pb-1 text-[11px] font-semibold flex-shrink-0">
            <span>9:41</span>
            <span className="absolute left-1/2 -translate-x-1/2 top-1.5 w-[70px] h-[18px] rounded-full bg-black"/>
            <span className="flex items-center gap-1"><Signal size={11}/><Wifi size={11}/><BatteryFull size={13}/></span>
          </div>

          {/* DM header */}
          <div className="flex items-center gap-2 px-3 py-2 flex-shrink-0" style={{ borderBottom: `1px solid ${c.border}` }}>
            <ChevronLeft size={20}/>
            {avatar(30)}
            <div className="min-w-0 flex-1 leading-tight">
              <p className="text-[12.5px] font-semibold truncate">{brand.name}</p>
              <p className="text-[10.5px] truncate" style={{ color: c.sub }}>Active now</p>
            </div>
            <Phone size={17}/><Video size={19}/>
          </div>

          {/* conversation */}
          <div className="flex-1 overflow-y-auto px-3 py-3 space-y-2.5" style={{ scrollbarWidth: 'none' }}>
            <p className="text-center text-[10.5px]" style={{ color: c.sub }}>Today 9:38 AM</p>
            <div className="flex justify-end">
              <div className="px-3 py-2 text-[13px] leading-snug text-white break-words" style={{ maxWidth: '75%', borderRadius: 20, background: 'linear-gradient(180deg,#a033ff 0%,#5c6bf5 55%,#4c68d7 100%)' }}>
                {customerMessage}
              </div>
            </div>
            {body}
          </div>

          {/* composer */}
          <div className="px-3 pb-3 pt-1.5 flex-shrink-0">
            <div className="flex items-center gap-2 rounded-full px-2 py-1.5" style={{ border: `1px solid ${c.border}`, background: c.field }}>
              <span className="w-[26px] h-[26px] rounded-full flex items-center justify-center flex-shrink-0" style={{ background: 'linear-gradient(45deg,#3b82f6,#6228d7)' }}>
                <Camera size={13} color="#fff"/>
              </span>
              <span className="flex-1 text-[12px]" style={{ color: c.sub }}>Message…</span>
              <Mic size={16}/><ImageIcon size={16}/><Smile size={16}/>
            </div>
          </div>
          <span className="absolute bottom-1 left-1/2 -translate-x-1/2 w-[90px] h-[4px] rounded-full" style={{ background: c.fg, opacity: 0.85 }}/>
        </div>
      </div>
    </div>
  )
}
