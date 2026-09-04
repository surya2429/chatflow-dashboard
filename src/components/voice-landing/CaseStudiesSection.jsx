import { useState } from 'react'
import { ChevronLeft, ChevronRight, TrendingUp } from 'lucide-react'

const CASES = [
  { company: 'BrightPath Realty', stat: '+42%', metric: 'more qualified leads', quote: 'Our AI voice agent now handles 300+ calls a week without dropping a single lead.' },
  { company: 'CarePoint Clinics', stat: '3.5x', metric: 'faster appointment booking', quote: 'Patients book and reschedule visits anytime, day or night, without staff involvement.' },
]

export default function CaseStudiesSection() {
  const [active, setActive] = useState(0)

  return (
    <section className="py-16 md:py-24 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-2xl mx-auto mb-12">
          <span className="badge-blue">Case Studies</span>
          <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 mt-3">Real Results, Real Impact</h2>
        </div>

        <div className="relative max-w-3xl mx-auto">
          <div className="card p-8 sm:p-10 text-center">
            <span className="w-12 h-12 rounded-xl bg-primary-50 flex items-center justify-center mx-auto mb-5">
              <TrendingUp size={22} className="text-primary" />
            </span>
            <p className="text-3xl font-bold text-primary">{CASES[active].stat}</p>
            <p className="text-sm font-semibold text-slate-500 mt-1">{CASES[active].metric}</p>
            <p className="text-slate-700 mt-6 max-w-lg mx-auto">"{CASES[active].quote}"</p>
            <p className="mt-5 font-semibold text-slate-900">{CASES[active].company}</p>
          </div>

          <button
            type="button"
            aria-label="Previous case study"
            onClick={() => setActive(a => (a - 1 + CASES.length) % CASES.length)}
            className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-4 sm:-translate-x-12 w-10 h-10 rounded-full bg-white border border-surface-border shadow-card flex items-center justify-center hover:border-primary/40"
          >
            <ChevronLeft size={18} className="text-slate-600" />
          </button>
          <button
            type="button"
            aria-label="Next case study"
            onClick={() => setActive(a => (a + 1) % CASES.length)}
            className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-4 sm:translate-x-12 w-10 h-10 rounded-full bg-white border border-surface-border shadow-card flex items-center justify-center hover:border-primary/40"
          >
            <ChevronRight size={18} className="text-slate-600" />
          </button>
        </div>

        <div className="flex justify-center gap-2 mt-8">
          {CASES.map((c, i) => (
            <button
              key={c.company}
              type="button"
              aria-label={`Go to case study ${i + 1}`}
              onClick={() => setActive(i)}
              className={`h-2 rounded-full transition-all ${i === active ? 'w-6 bg-primary' : 'w-2 bg-slate-200'}`}
            />
          ))}
        </div>
      </div>
    </section>
  )
}
