// Misc Web Chat constants shared across pages (Installation, Analytics,
// Appearance, the embed) that would otherwise need a page-to-page import.

function generateBotId() {
  // Plain digits, because this id is something a person reads out, types into
  // a support ticket, and recognises in a URL — `cf_wgt_1789469520528501078`
  // is none of those things. 10000–99999 so it is always exactly five
  // characters and never renders with a leading zero.
  return String(Math.floor(10000 + Math.random() * 90000))
}

// ONE id per bot, generated once per app load. The install snippet, the
// landing page URL, the embed iframe and the Analytics card all reference this
// same value — previously the snippet used a long `cf_wgt_…` string while the
// landing page URL used a five-digit slice of it, so the two surfaces named
// the same bot with two different identifiers.
export const BOT_ID = generateBotId()
