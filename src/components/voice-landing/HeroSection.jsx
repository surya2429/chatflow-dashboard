import { TrendingUp, PhoneCall, Clock } from 'lucide-react'
import DemoForm from './DemoForm'

const PILLS = [
  { icon: TrendingUp, label: 'Boost conversions' },
  { icon: PhoneCall, label: 'Automate calls' },
  { icon: Clock, label: '24/7 voice AI support' },
]

export default function HeroSection() {
  return (
    <section
      className="relative overflow-hidden"
      style={{ backgroundImage: 'linear-gradient(#E6F0FF 0%, #F5F9FF 55%, #FFFFFF 100%)' }}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 md:py-24 grid lg:grid-cols-2 gap-12 items-center">
        <div>
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight leading-[1.05] text-slate-900">
            AI Voice Agents That <span className="text-primary">Talk, Understand &amp; Automate</span> Instantly
          </h1>
          <p className="mt-5 text-base sm:text-lg text-slate-600 max-w-xl">
            Automate calls with AI Voice bots that qualify leads, answer customer queries, book appointments, and transfer calls to your team.
          </p>

          <div className="mt-6 flex flex-wrap gap-2.5">
            {PILLS.map(({ icon: Icon, label }) => (
              <span key={label} className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full bg-white border border-black/5 shadow-card text-xs font-semibold text-slate-700">
                <Icon size={14} className="text-primary" />
                {label}
              </span>
            ))}
          </div>

          <button type="button" className="btn-primary mt-8 !px-6 !py-3 !text-sm !rounded-xl">
            Book a Demo
          </button>
        </div>

        <div className="flex justify-center lg:justify-end">
          <DemoForm />
        </div>
      </div>
    </section>
  )
}
