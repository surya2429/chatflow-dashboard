import clsx from 'clsx'

/**
 * Infinite auto-scrolling row built from logo strip images.
 * `images` are placed edge-to-edge, then the whole group is duplicated once
 * so the CSS animation can loop seamlessly from translateX(0) to translateX(-50%).
 */
export default function ClienteleMarquee({ images, direction = 'left' }) {
  const anim = direction === 'right' ? 'animate-marquee-right' : 'animate-marquee-left'

  return (
    <div className="relative overflow-hidden bg-white">
      <div className="pointer-events-none absolute inset-y-0 left-0 w-16 bg-gradient-to-r from-white to-transparent z-10" />
      <div className="pointer-events-none absolute inset-y-0 right-0 w-16 bg-gradient-to-l from-white to-transparent z-10" />

      <div className={clsx('flex w-max items-center gap-4 [animation-play-state:running] hover:[animation-play-state:paused]', anim)}>
        {[...images, ...images].map((src, i) => (
          <img key={`${src}-${i}`} src={src} alt="" className="h-16 w-auto shrink-0 select-none" draggable={false} />
        ))}
      </div>
    </div>
  )
}
