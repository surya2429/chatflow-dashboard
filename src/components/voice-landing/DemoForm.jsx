import { useState } from 'react'
import { NativeSelect } from '../Select'

const TIMEZONES = [
  '(UTC+05:30) Indian Standard Time',
  '(UTC-08:00) Pacific Time (US & Canada)',
  '(UTC-07:00) Mountain Time (US & Canada)',
  '(UTC-06:00) Central Time (US & Canada)',
  '(UTC-05:00) Eastern Time (US & Canada)',
  '(UTC+00:00) Greenwich Mean Time',
  '(UTC+01:00) Central European Time',
  '(UTC+02:00) Eastern European Time',
  '(UTC+03:00) Moscow Standard Time',
  '(UTC+04:00) Gulf Standard Time',
  '(UTC+07:00) Indochina Time',
  '(UTC+08:00) Singapore / China Standard Time',
  '(UTC+09:00) Japan Standard Time',
  '(UTC+10:00) Australian Eastern Standard Time',
  '(UTC+12:00) New Zealand Standard Time',
]

const SLOTS = ['11:00 AM', '12:00 PM', '2:00 PM', '3:00 PM', '4:00 PM', '5:00 PM']

export default function DemoForm() {
  const [form, setForm] = useState({
    name: '', email: '', phone: '', company: '', website: '',
    use: '', timezone: '', date: '', slot: '',
  })
  const [submitted, setSubmitted] = useState(false)

  function set(key) {
    return e => setForm(f => ({ ...f, [key]: e.target.value }))
  }

  function handleSubmit(e) {
    e.preventDefault()
    setSubmitted(true)
  }

  return (
    <div className="card shadow-modal p-6 sm:p-7 w-full max-w-md">
      <h3 className="text-lg font-bold text-slate-900 mb-5">Schedule a Demo With Us</h3>

      {submitted ? (
        <div className="py-10 text-center">
          <p className="text-2xl mb-2">🎉</p>
          <p className="font-semibold text-slate-900">Thanks! We'll be in touch shortly.</p>
          <p className="text-sm text-slate-500 mt-1">Your demo request has been received.</p>
        </div>
      ) : (
        <form className="space-y-4" onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="label">Full Name*</label>
            <input required className="input" placeholder="Enter your full name" value={form.name} onChange={set('name')} />
          </div>

          <div className="form-group">
            <label className="label">Business Email*</label>
            <input required type="email" className="input" placeholder="Enter your email address" value={form.email} onChange={set('email')} />
          </div>

          <div className="form-group">
            <label className="label">Phone Number*</label>
            <div className="flex items-center gap-2">
              <span className="input !w-auto px-3 flex items-center justify-center text-base">🇮🇳</span>
              <input required type="tel" className="input" placeholder="Enter your 10-digit number" value={form.phone} onChange={set('phone')} />
            </div>
          </div>

          <div className="form-group">
            <label className="label">Company Name*</label>
            <input required className="input" placeholder="Enter Company Name" value={form.company} onChange={set('company')} />
          </div>

          <div className="form-group">
            <label className="label">Website*</label>
            <input required className="input" placeholder="Website URL" value={form.website} onChange={set('website')} />
          </div>

          <div className="form-group">
            <label className="label">Intended Use*</label>
            <NativeSelect value={form.use} onChange={set('use')}>
              <option value="">Select Intended Use</option>
              <option value="organization">Our Organization</option>
              <option value="partnership">Partnership</option>
            </NativeSelect>
          </div>

          <div className="form-group">
            <label className="label">Select Your Timezone*</label>
            <NativeSelect value={form.timezone} onChange={set('timezone')}>
              <option value="">Search timezone...</option>
              {TIMEZONES.map(tz => <option key={tz} value={tz}>{tz}</option>)}
            </NativeSelect>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="form-group">
              <label className="label">Select Your Date*</label>
              <input required type="date" className="input" value={form.date} onChange={set('date')} />
            </div>
            <div className="form-group">
              <label className="label">Select Your Slot*</label>
              <NativeSelect value={form.slot} onChange={set('slot')}>
                <option value="">Select a time slot</option>
                {SLOTS.map(s => <option key={s} value={s}>{s}</option>)}
              </NativeSelect>
            </div>
          </div>

          <button type="submit" className="btn-primary w-full !justify-center !py-3 !text-sm !rounded-xl">
            Schedule a Demo
          </button>
        </form>
      )}
    </div>
  )
}
