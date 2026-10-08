// Small formatting helpers shared by the billing components.
export const stateNameOf = (states, code) => states?.find((s) => s.code === code)?.name || code || ''

/** One-line address: "12 MG Road, Fort, Mumbai, Maharashtra 400001". */
export function addressLine(profile, states) {
  if (!profile) return ''
  const a = profile.address
  return [a.line1, a.line2, a.city, `${stateNameOf(states, a.stateCode)} ${a.pincode}`].filter(Boolean).join(', ')
}
