/* ─── Shared helpers for reading {{n}} placeholders out of an approved template ── */

/** Unique sorted param numbers from a template BODY, e.g. ['1','2','3'] */
export function extractParams(tpl) {
  if (!tpl) return []
  const src = tpl.body || ''
  const matches = src.match(/\{\{(\d+)\}\}/g) || []
  return [...new Set(matches.map(m => m.replace(/\{\{|\}\}/g, '')))]
    .sort((a, b) => Number(a) - Number(b))
}

/** Param numbers from a TEXT header, e.g. ['1'] */
export function extractHeaderParams(tpl) {
  if (!tpl || tpl.headerType !== 'TEXT' || !tpl.headerText) return []
  const matches = tpl.headerText.match(/\{\{(\d+)\}\}/g) || []
  return [...new Set(matches.map(m => m.replace(/\{\{|\}\}/g, '')))]
    .sort((a, b) => Number(a) - Number(b))
}

/** Buttons that need user input at send-time (dynamic URL, quick reply, copy code) */
export function getButtonsNeedingInput(tpl) {
  if (!tpl?.buttonDefs) return []
  return tpl.buttonDefs
    .map((btn, i) => ({ ...btn, index: i }))
    .filter(btn =>
      (btn.type === 'URL' && btn.url?.includes('{{')) ||
      btn.type === 'QUICK_REPLY' ||
      btn.type === 'COPY_CODE'
    )
}

/** Just the dynamic-URL buttons — the ones that carry a real {{n}} CTA parameter */
export function getDynamicUrlButtons(tpl) {
  if (!tpl?.buttonDefs) return []
  return tpl.buttonDefs
    .map((btn, i) => ({ ...btn, index: i }))
    .filter(btn => btn.type === 'URL' && btn.url?.includes('{{'))
}
