import { CalendarClock, Headphones, Filter, UserPlus, PhoneOutgoing } from 'lucide-react'

const DAYS = [
  { d: 'Mon', n: 12 }, { d: 'Tue', n: 13 }, { d: 'Wed', n: 14 }, { d: 'Thu', n: 15 }, { d: 'Fri', n: 16 },
]

const OTHER_CASES = [
  { icon: Filter, title: 'Lead Qualification', desc: 'Qualify leads, capture customer details, and route high-intent prospects to your sales team.' },
  { icon: UserPlus, title: 'Onboarding Assistance', desc: 'Guide new customers with AI Voice Agents through onboarding and account setup.' },
  { icon: PhoneOutgoing, title: 'Outbound Calls', desc: 'Automated follow-ups, confirmations, renewals, and feedback collection.' },
]

export default function UseCasesSection() {
  return (
    <section className="py-16 md:py-24 bg-white border-t border-black/5">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-2xl mx-auto mb-12">
          <span className="badge-blue">Use Cases</span>
          <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 mt-3">Built for Every Voice Workflow</h2>
          <p className="text-slate-500 mt-3">From booking to qualification automate the conversations that drive revenue.</p>
        </div>

        <div className="grid lg:grid-cols-2 gap-5 mb-5">
          {/* Featured: Appointment Scheduling */}
          <div className="card p-6 lg:p-8 relative overflow-hidden">
            <span className="badge-blue mb-4">Featured</span>
            <span className="w-11 h-11 rounded-xl bg-primary-50 flex items-center justify-center mb-4">
              <CalendarClock size={20} className="text-primary" />
            </span>
            <h3 className="text-lg font-bold text-slate-900">Appointment Scheduling</h3>
            <p className="text-sm text-slate-500 mt-1.5 max-w-sm">
              Let customers book, reschedule, and receive appointment reminders through AI voice calls.
            </p>

            <div className="mt-6 rounded-xl border border-surface-border bg-surface p-4">
              <div className="flex items-center justify-between mb-3">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">This Week</span>
                <span className="text-[10px] font-semibold text-primary">Slot · 3:00 PM</span>
              </div>
              <div className="grid grid-cols-5 gap-2">
                {DAYS.map(({ d, n }, i) => (
                  <div
                    key={d}
                    className={`rounded-lg py-2 text-center ${i === 2 ? 'bg-primary text-white' : 'bg-white border border-surface-border text-slate-600'}`}
                  >
                    <p className="text-[10px] font-medium opacity-80">{d}</p>
                    <p className="text-sm font-bold">{n}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Live: Customer Support */}
          <div className="card p-6 lg:p-8 relative overflow-hidden">
            <span className="badge-green mb-4">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" /> Live
            </span>
            <span className="w-11 h-11 rounded-xl bg-primary-50 flex items-center justify-center mb-4">
              <Headphones size={20} className="text-primary" />
            </span>
            <h3 className="text-lg font-bold text-slate-900">Customer Support</h3>
            <p className="text-sm text-slate-500 mt-1.5 max-w-sm">
              Answer customer queries instantly using AI Voice Agents trained on your FAQs, documents, and CRM.
            </p>

            <div className="mt-6 rounded-xl border border-surface-border bg-surface p-4 space-y-2.5">
              <div className="ml-auto max-w-[80%] bg-primary text-white text-xs rounded-2xl rounded-br-sm px-3.5 py-2.5">
                How do I reschedule my order?
              </div>
              <div className="mr-auto max-w-[85%] bg-white border border-surface-border text-slate-700 text-xs rounded-2xl rounded-bl-sm px-3.5 py-2.5">
                I found your order #4821 pulling reschedule options now.
              </div>
            </div>
          </div>
        </div>

        <div className="grid sm:grid-cols-3 gap-5">
          {OTHER_CASES.map(({ icon: Icon, title, desc }) => (
            <div key={title} className="card p-6 hover:border-primary/30 transition-colors">
              <span className="w-11 h-11 rounded-xl bg-primary-50 flex items-center justify-center mb-4">
                <Icon size={20} className="text-primary" />
              </span>
              <h3 className="font-semibold text-slate-900">{title}</h3>
              <p className="text-sm text-slate-500 mt-1.5">{desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
