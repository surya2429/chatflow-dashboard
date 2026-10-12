// CompanyEmailSetting.jsx — the "accept company emails only" switch for an email field.
// Shared by the Email question type (flow builder) and the Book tab popup (widget Behavior settings).
// The runtime check is `isFreeEmail` in lib/emailDomains.js.
import { Info } from 'lucide-react'

export default function CompanyEmailSetting({ value, onChange }) {
  const on = value === true
  return (
    <div className="space-y-1">
      <label className="label flex items-center gap-1.5">
        Accept company emails only
        <span title="Rejects personal addresses such as Gmail, Yahoo, Outlook, iCloud and disposable inboxes, so you only collect work emails." className="inline-flex text-slate-300 hover:text-slate-500 cursor-help"><Info size={12}/></span>
      </label>
      <div className="flex items-center gap-2.5 p-2.5 rounded-lg border border-surface-border">
        <button type="button" role="switch" aria-checked={on} aria-label="Accept company emails only" onClick={() => onChange(!on)}
          className="relative flex-shrink-0 rounded-full transition-colors" style={{ width: 34, height: 18, background: on ? '#0066ff' : '#d1d5db' }}>
          <span className="absolute rounded-full bg-white shadow transition-all" style={{ top: 2, left: on ? 18 : 2, width: 14, height: 14 }}/>
        </button>
        <p className="text-[11px] text-slate-500 leading-snug">
          {on ? 'Company emails only — Gmail, Yahoo, Outlook and other personal addresses are rejected.' : 'Any email address is accepted.'}
        </p>
      </div>
    </div>
  )
}
