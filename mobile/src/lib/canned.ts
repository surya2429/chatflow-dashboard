/**
 * Canned responses — the same set the web dashboard offers (src/components/inbox/SharedInboxParts.jsx),
 * so an agent finds the same quick replies on desktop and phone.
 */
export const CANNED = [
  { key: 'greet', label: 'Greeting', body: 'Hi {{name}}! 👋 Thanks for reaching out. How can I help you today?' },
  { key: 'order', label: 'Ask Order ID', body: 'Could you please share your Order ID so I can check the status for you?' },
  { key: 'wait', label: 'Please Hold', body: 'Thanks for your patience! I’m checking this for you right now — give me just a moment.' },
  { key: 'resolve', label: 'Resolution', body: 'Your issue has been resolved! Let me know if there’s anything else I can help with. 😊' },
  { key: 'escalate', label: 'Escalation Note', body: 'I’m transferring you to a specialist who can better assist with your request. They’ll be with you shortly!' },
] as const

/** Puts the customer's first name into {{name}} — or drops the placeholder when there's no real name. */
export function fillCanned(body: string, name?: string): string {
  const first = name && !/^v_|@|^\+?\d/.test(name) ? name.split(/\s+/)[0] : ''
  return first ? body.replace(/\{\{name\}\}/g, first) : body.replace(/ \{\{name\}\}/g, '').replace(/\{\{name\}\}/g, '')
}
