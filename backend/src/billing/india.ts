// india.ts — validation for the details collected before a payment: states (with
// their GST codes), PIN codes, mobile numbers and GSTINs.
//
// Why these are collected, and by which rule:
//   • GST invoicing: the recipient's name, address, state and (for a business)
//     GSTIN go on the tax invoice, and the customer's state decides whether the
//     18% is charged as CGST + SGST (same state as us) or IGST (another state).
//   • RBI recurring payments (e-mandate framework): the customer must give
//     informed consent to an amount and frequency, be notified before each
//     debit, and be able to cancel. A working email + mobile are what those
//     notices (and the bank's approval OTPs) are sent to.
// RBI itself does not ask for an address — that comes from GST, not the mandate.

export interface IndiaState { code: string; name: string }

/** GST state / UT codes (the first two digits of a GSTIN). */
export const STATES: IndiaState[] = [
  { code: '01', name: 'Jammu & Kashmir' }, { code: '02', name: 'Himachal Pradesh' }, { code: '03', name: 'Punjab' },
  { code: '04', name: 'Chandigarh' }, { code: '05', name: 'Uttarakhand' }, { code: '06', name: 'Haryana' },
  { code: '07', name: 'Delhi' }, { code: '08', name: 'Rajasthan' }, { code: '09', name: 'Uttar Pradesh' },
  { code: '10', name: 'Bihar' }, { code: '11', name: 'Sikkim' }, { code: '12', name: 'Arunachal Pradesh' },
  { code: '13', name: 'Nagaland' }, { code: '14', name: 'Manipur' }, { code: '15', name: 'Mizoram' },
  { code: '16', name: 'Tripura' }, { code: '17', name: 'Meghalaya' }, { code: '18', name: 'Assam' },
  { code: '19', name: 'West Bengal' }, { code: '20', name: 'Jharkhand' }, { code: '21', name: 'Odisha' },
  { code: '22', name: 'Chhattisgarh' }, { code: '23', name: 'Madhya Pradesh' }, { code: '24', name: 'Gujarat' },
  { code: '26', name: 'Dadra & Nagar Haveli and Daman & Diu' }, { code: '27', name: 'Maharashtra' },
  { code: '29', name: 'Karnataka' }, { code: '30', name: 'Goa' }, { code: '31', name: 'Lakshadweep' },
  { code: '32', name: 'Kerala' }, { code: '33', name: 'Tamil Nadu' }, { code: '34', name: 'Puducherry' },
  { code: '35', name: 'Andaman & Nicobar Islands' }, { code: '36', name: 'Telangana' },
  { code: '37', name: 'Andhra Pradesh' }, { code: '38', name: 'Ladakh' }, { code: '97', name: 'Other Territory' },
]

export const stateName = (code: string) => STATES.find((s) => s.code === code)?.name ?? code
export const isStateCode = (code: unknown): code is string => typeof code === 'string' && STATES.some((s) => s.code === code)

export const isEmail = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v) && v.length <= 254
export const isPin = (v: string) => /^[1-9][0-9]{5}$/.test(v)

/** Accepts "98765 43210", "+91 98765 43210", "09876543210"; returns the 10 digits or null. */
export function normalizeMobile(v: string): string | null {
  const digits = v.replace(/[\s-]/g, '').replace(/^\+?91/, '').replace(/^0/, '')
  return /^[6-9][0-9]{9}$/.test(digits) ? digits : null
}

/* GSTIN = 2-digit state + 10-char PAN + entity number + 'Z' + check character.
   The check character is a base-36 weighted checksum of the first 14. */
const CHARS = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ'
export function gstinCheckChar(first14: string): string {
  let sum = 0
  for (let i = 0; i < 14; i++) {
    const v = CHARS.indexOf(first14[i]!)
    const p = v * (i % 2 === 0 ? 1 : 2)
    sum += Math.floor(p / 36) + (p % 36)
  }
  return CHARS[(36 - (sum % 36)) % 36]!
}

/** Returns an error message, or null when the GSTIN is well-formed and its checksum matches. */
export function gstinError(raw: string): string | null {
  const g = raw.trim().toUpperCase()
  if (!/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/.test(g)) return 'Enter a valid 15-character GSTIN, e.g. 27AAPFU0939F1ZV.'
  if (!isStateCode(g.slice(0, 2))) return 'The first two digits of a GSTIN must be a valid state code.'
  if (gstinCheckChar(g.slice(0, 14)) !== g[14]) return 'This GSTIN does not pass the checksum — check for a typo.'
  return null
}

/* ── the profile ───────────────────────────────────────────────────────── */
export interface BillingProfileInput {
  legalName?: unknown; contactName?: unknown; email?: unknown; phone?: unknown; gstin?: unknown
  address?: { line1?: unknown; line2?: unknown; city?: unknown; stateCode?: unknown; pincode?: unknown }
}

export interface BillingProfile {
  legalName: string
  contactName: string
  email: string
  phone: string            // 10-digit Indian mobile
  gstin?: string
  address: { line1: string; line2?: string; city: string; stateCode: string; pincode: string; country: 'IN' }
  updatedAt: number
}

const str = (v: unknown) => (typeof v === 'string' ? v.trim().replace(/\s+/g, ' ') : '')

export function validateProfile(input: BillingProfileInput, now: number): { ok: true; profile: BillingProfile } | { ok: false; fields: Record<string, string> } {
  const f: Record<string, string> = {}
  const legalName = str(input.legalName)
  const contactName = str(input.contactName)
  const email = str(input.email).toLowerCase()
  const mobile = normalizeMobile(str(input.phone))
  const gstin = str(input.gstin).toUpperCase()
  const a = input.address ?? {}
  const line1 = str(a.line1), line2 = str(a.line2), city = str(a.city), pincode = str(a.pincode)
  const stateCode = str(a.stateCode)

  if (legalName.length < 2 || legalName.length > 120) f.legalName = 'Enter the business or full name to put on the invoice.'
  if (contactName.length < 2 || contactName.length > 80) f.contactName = 'Enter the name of the person we should contact.'
  if (!isEmail(email)) f.email = 'Enter a valid email address — payment notices and invoices go here.'
  if (!mobile) f.phone = 'Enter a 10-digit Indian mobile number — your bank sends approval codes here.'
  if (line1.length < 3 || line1.length > 100) f['address.line1'] = 'Enter your street address.'
  if (line2.length > 100) f['address.line2'] = 'Keep this under 100 characters.'
  if (city.length < 2 || city.length > 60) f['address.city'] = 'Enter your city.'
  if (!isStateCode(stateCode)) f['address.stateCode'] = 'Choose your state.'
  if (!isPin(pincode)) f['address.pincode'] = 'Enter a 6-digit PIN code.'
  if (gstin) {
    const e = gstinError(gstin)
    if (e) f.gstin = e
    else if (isStateCode(stateCode) && gstin.slice(0, 2) !== stateCode) {
      f['address.stateCode'] = `With this GSTIN the state must be ${stateName(gstin.slice(0, 2))} (code ${gstin.slice(0, 2)}).`
    }
  }
  if (Object.keys(f).length) return { ok: false, fields: f }

  return {
    ok: true,
    profile: {
      legalName, contactName, email, phone: mobile!, gstin: gstin || undefined,
      address: { line1, line2: line2 || undefined, city, stateCode, pincode, country: 'IN' },
      updatedAt: now,
    },
  }
}
