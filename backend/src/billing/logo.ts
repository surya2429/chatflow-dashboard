// logo.ts — the SmatBot logo printed on invoices.
//
// The default below is a vector re-drawing, so invoices have a logo out of the box. To
// print your exact artwork, save it (PNG / SVG / JPG) somewhere and set BILLING_LOGO_FILE
// to its path — it is read once at start-up and embedded in every invoice.
import { readFileSync } from 'node:fs'
import { extname } from 'node:path'

const SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 780 210">
<path d="M70 20h120a44 44 0 0 1 44 44v66a44 44 0 0 1-44 44h-60l-34 30 4-30H70a44 44 0 0 1-44-44V64a44 44 0 0 1 44-44z" fill="#1a73ff"/>
<rect x="0" y="62" width="26" height="62" rx="12" fill="#1a73ff"/><rect x="234" y="62" width="26" height="62" rx="12" fill="#1a73ff"/>
<rect x="68" y="58" width="30" height="30" rx="5" transform="rotate(45 83 73)" fill="#fff"/>
<rect x="148" y="58" width="30" height="30" rx="5" transform="rotate(45 163 73)" fill="#fff"/>
<path d="M82 118q48 28 96 0" fill="none" stroke="#fff" stroke-width="8" stroke-linecap="round"/>
<text x="280" y="124" textLength="480" lengthAdjust="spacingAndGlyphs" font-family="Arial Black,Arial,Helvetica,sans-serif" font-weight="900" font-size="116" fill="#000">SmatBot</text>
<text x="282" y="190" textLength="222" lengthAdjust="spacingAndGlyphs" font-family="Arial,Helvetica,sans-serif" font-weight="700" font-size="35" fill="#000">Engage Better</text>
<rect x="524" y="158" width="4" height="40" fill="#1a73ff"/>
<text x="548" y="190" textLength="212" lengthAdjust="spacingAndGlyphs" font-family="Arial,Helvetica,sans-serif" font-weight="700" font-size="35" fill="#000">Sell More</text>
</svg>`

export const DEFAULT_LOGO = `data:image/svg+xml;base64,${Buffer.from(SVG).toString('base64')}`

const MIME: Record<string, string> = { '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.svg': 'image/svg+xml', '.webp': 'image/webp' }

/** Read a logo file into a data: URI; falls back to the built-in logo if it can't be read. */
export function loadLogo(path?: string): string {
  if (!path) return DEFAULT_LOGO
  try {
    const mime = MIME[extname(path).toLowerCase()]
    if (!mime) return DEFAULT_LOGO
    return `data:${mime};base64,${readFileSync(path).toString('base64')}`
  } catch {
    return DEFAULT_LOGO
  }
}
