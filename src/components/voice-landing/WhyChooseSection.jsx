import { Layers, Users, Headphones, Building2 } from 'lucide-react'

const REASONS = [
  { icon: Layers, title: 'AI Voice + Chat + WhatsApp Platform' },
  { icon: Users, title: 'Direct Communication Access with Management' },
  { icon: Headphones, title: 'Dedicated Customer Success Team' },
  { icon: Building2, title: 'Industry-Focused for Education, Real Estate, Healthcare' },
]

export default function WhyChooseSection() {
  return (
    <section className="relative pt-8 md:pt-12 pb-16 md:pb-24 bg-[#F1F6FB] border-t border-black/5 overflow-hidden">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 text-center mb-12">Why Choose SmatBot</h2>

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {REASONS.map(({ icon: Icon, title }) => (
            <div key={title} className="card p-6 text-center hover:border-primary/30 transition-colors">
              <span className="w-12 h-12 rounded-xl bg-primary-50 flex items-center justify-center mx-auto mb-4">
                <Icon size={22} className="text-primary" />
              </span>
              <h3 className="font-semibold text-slate-900 text-sm leading-snug">{title}</h3>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
