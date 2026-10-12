/* Personal / free / throw-away mailbox providers. Used by the "accept company emails only" setting on
   the Email question and the Book tab: an address on one of these is not a company address.
   Matches the domain itself and its subdomains, plus provider families that come in many country
   flavours (yahoo.co.in, hotmail.co.uk, outlook.de, live.fr, …). */
const FREE_DOMAINS = new Set([
  'gmail.com', 'googlemail.com', 'ymail.com', 'rocketmail.com', 'msn.com', 'passport.com',
  'icloud.com', 'me.com', 'mac.com', 'aol.com', 'aim.com', 'proton.me', 'protonmail.com', 'pm.me',
  'zoho.com', 'zohomail.com', 'mail.com', 'email.com', 'inbox.com', 'fastmail.com', 'fastmail.fm',
  'tutanota.com', 'tuta.io', 'hey.com', 'yandex.com', 'yandex.ru', 'mail.ru', 'bk.ru', 'list.ru', 'inbox.ru',
  'rediffmail.com', 'rediff.com', 'qq.com', '163.com', '126.com', 'sina.com', 'naver.com', 'daum.net', 'hanmail.net',
  'web.de', 'gmx.de', 'gmx.net', 'gmx.com', 't-online.de', 'freenet.de', 'orange.fr', 'wanadoo.fr', 'free.fr', 'laposte.net',
  'libero.it', 'virgilio.it', 'tiscali.it', 'btinternet.com', 'sky.com', 'talktalk.net', 'virginmedia.com',
  'att.net', 'sbcglobal.net', 'bellsouth.net', 'verizon.net', 'comcast.net', 'cox.net', 'charter.net', 'earthlink.net',
  'optonline.net', 'rogers.com', 'shaw.ca', 'sympatico.ca', 'bigpond.com', 'optusnet.com.au',
  'mailinator.com', 'guerrillamail.com', '10minutemail.com', 'tempmail.com', 'temp-mail.org', 'yopmail.com', 'trashmail.com', 'getnada.com', 'sharklasers.com',
])
const FREE_FAMILIES = /^(yahoo|hotmail|outlook|live|gmx|yandex|icloud|aol|proton(mail)?|zoho(mail)?|rediff(mail)?)\./i

export function emailDomain(email) {
  const at = String(email || '').trim().toLowerCase().lastIndexOf('@')
  return at < 0 ? '' : String(email).trim().toLowerCase().slice(at + 1)
}

/** True when the address is on a personal / free / disposable provider. */
export function isFreeEmail(email) {
  const d = emailDomain(email)
  if (!d) return false
  if (FREE_FAMILIES.test(d)) return true
  const parts = d.split('.')
  for (let i = 0; i < parts.length - 1; i++) {
    if (FREE_DOMAINS.has(parts.slice(i).join('.'))) return true
  }
  return false
}

export const COMPANY_EMAIL_MESSAGE = "Please use your company email — personal addresses like Gmail or Yahoo aren't accepted."
