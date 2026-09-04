// Misc Web Chat constants shared across pages (Installation, Analytics, Appearance)
// that would otherwise need a page-to-page import.

function generateWidgetId() {
  // Timestamp (ms) + 6 random digits — numeric only, always unique per generation.
  const time = Date.now().toString()
  let rand = ''
  for (let i = 0; i < 6; i++) rand += Math.floor(Math.random() * 10)
  return `cf_wgt_${time}${rand}`
}

// Generated once per app load — every install snippet and the Analytics "Active
// Widget" card reference this same value, so they always stay in sync.
export const WIDGET_ID = generateWidgetId()
