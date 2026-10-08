/* ─── India-specific form checks ───────────────────────────────────────────
   Instant feedback while typing. The server (backend/src/billing/india.ts) runs
   the same rules again and is the one that counts — never trust this alone. */

export const isEmail = (v) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v) && v.length <= 254
export const isPin = (v) => /^[1-9][0-9]{5}$/.test(v)

/** "98765 43210", "+91 98765 43210", "09876543210" → "9876543210", else null. */
export function normalizeMobile(v) {
  const digits = String(v).replace(/[\s-]/g, '').replace(/^\+?91/, '').replace(/^0/, '')
  return /^[6-9][0-9]{9}$/.test(digits) ? digits : null
}

/* GSTIN: 2-digit state + 10-char PAN + entity no. + 'Z' + a base-36 check character. */
const CHARS = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ'
function gstinCheckChar(first14) {
  let sum = 0
  for (let i = 0; i < 14; i++) {
    const p = CHARS.indexOf(first14[i]) * (i % 2 === 0 ? 1 : 2)
    sum += Math.floor(p / 36) + (p % 36)
  }
  return CHARS[(36 - (sum % 36)) % 36]
}

/** null when fine, otherwise a message. Empty is fine — GSTIN is optional. */
export function gstinError(raw, states) {
  const g = String(raw || '').trim().toUpperCase()
  if (!g) return null
  if (!/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/.test(g)) return 'Enter a valid 15-character GSTIN, e.g. 27AAPFU0939F1ZV.'
  if (states && !states.some((s) => s.code === g.slice(0, 2))) return 'The first two digits must be a valid state code.'
  if (gstinCheckChar(g.slice(0, 14)) !== g[14]) return 'This GSTIN does not pass the checksum — check for a typo.'
  return null
}

export const EMPTY_DETAILS = {
  legalName: '', contactName: '', email: '', phone: '', gstin: '',
  line1: '', line2: '', city: '', stateCode: '', pincode: '',
}

/* profile (API shape) ⇄ flat form values */
export const toForm = (p) => (p ? {
  legalName: p.legalName, contactName: p.contactName, email: p.email, phone: p.phone, gstin: p.gstin || '',
  line1: p.address.line1, line2: p.address.line2 || '', city: p.address.city, stateCode: p.address.stateCode, pincode: p.address.pincode,
} : { ...EMPTY_DETAILS })

export const toProfile = (v) => ({
  legalName: v.legalName, contactName: v.contactName, email: v.email, phone: v.phone, gstin: v.gstin,
  address: { line1: v.line1, line2: v.line2, city: v.city, stateCode: v.stateCode, pincode: v.pincode },
})

/** Client-side validation of the whole form → { field: message }. */
export function validateDetails(v, states) {
  const e = {}
  const t = (s) => String(s || '').trim()
  if (t(v.legalName).length < 2) e.legalName = 'Enter the business or full name to put on the invoice.'
  if (t(v.contactName).length < 2) e.contactName = 'Enter the name of the person we should contact.'
  if (!isEmail(t(v.email))) e.email = 'Enter a valid email address — payment notices and invoices go here.'
  if (!normalizeMobile(t(v.phone))) e.phone = 'Enter a 10-digit Indian mobile number — your bank sends approval codes here.'
  if (t(v.line1).length < 3) e.line1 = 'Enter your street address.'
  if (t(v.city).length < 2) e.city = 'Enter your city.'
  if (!v.stateCode) e.stateCode = 'Choose your state.'
  if (!isPin(t(v.pincode))) e.pincode = 'Enter a 6-digit PIN code.'
  const g = gstinError(v.gstin, states)
  if (g) e.gstin = g
  else if (t(v.gstin) && v.stateCode && t(v.gstin).toUpperCase().slice(0, 2) !== v.stateCode) {
    const name = states?.find((s) => s.code === t(v.gstin).toUpperCase().slice(0, 2))?.name
    e.stateCode = `With this GSTIN the state must be ${name || 'the one in the GSTIN'}.`
  }
  return e
}

/* The server names fields like "address.line1"; the form uses flat names. */
export const SERVER_FIELD = { 'address.line1': 'line1', 'address.line2': 'line2', 'address.city': 'city', 'address.stateCode': 'stateCode', 'address.pincode': 'pincode' }
