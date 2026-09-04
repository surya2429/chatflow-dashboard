import { PhoneCall, Target, CalendarCheck, Bell, UserCheck, Languages, Play } from 'lucide-react'

const FEATURES = [
  { icon: PhoneCall, title: 'Answer Customer Calls', desc: 'Provide instant responses to customer enquiries 24/7.' },
  { icon: Target, title: 'Qualify Leads', desc: 'Identify high-intent prospects and route them to your sales team.' },
  { icon: CalendarCheck, title: 'Book Appointments', desc: 'Schedule demos, consultations, and meetings automatically.' },
  { icon: Bell, title: 'Follow Up Automatically', desc: 'Send reminders and reconnect with customers without manual effort.' },
  { icon: UserCheck, title: 'Transfer to Human Agents', desc: 'Escalate calls seamlessly whenever personal assistance is needed.' },
  { icon: Languages, title: 'Support Multiple Languages', desc: "Deliver localized conversations in your customers' preferred language." },
]

export default function FeaturesShowcase() {
  return (
    <section className="py-16 md:py-24 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 text-center mb-12">
          Everything Your AI Voice Agent Can Handle
        </h2>

        <div className="grid lg:grid-cols-2 gap-10 items-center">
          <div className="relative rounded-2xl overflow-hidden border border-black/5 shadow-card aspect-video bg-gradient-to-br from-primary/90 to-primary-700 flex items-center justify-center">
            <button type="button" className="w-16 h-16 rounded-full bg-white/90 flex items-center justify-center hover:scale-105 transition-transform">
              <Play size={26} className="text-primary ml-1" fill="currentColor" />
            </button>
            <span className="absolute bottom-3 right-3 px-2 py-0.5 rounded-md bg-black/60 text-white text-xs font-medium">0:12</span>
          </div>

          <div className="space-y-6">
            {FEATURES.map(({ icon: Icon, title, desc }) => (
              <div key={title} className="flex gap-4">
                <span className="flex-shrink-0 w-11 h-11 rounded-xl bg-primary-50 flex items-center justify-center">
                  <Icon size={20} className="text-primary" />
                </span>
                <div>
                  <h3 className="font-semibold text-slate-900">{title}</h3>
                  <p className="text-sm text-slate-500 mt-0.5">{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}
