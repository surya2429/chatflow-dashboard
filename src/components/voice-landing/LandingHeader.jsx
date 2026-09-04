import { ChevronDown } from 'lucide-react'

const NAV = ['Product', 'AI Services', 'Partnerships', 'Resources']

export default function LandingHeader() {
  return (
    <header className="sticky top-0 z-40 bg-white/90 backdrop-blur border-b border-black/5">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        <a href="#" className="flex items-center gap-2 font-extrabold text-lg text-slate-900">
          <span className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center text-white text-sm">S</span>
          SmatBot
        </a>

        <nav className="hidden md:flex items-center gap-1">
          {NAV.map(item => (
            <button
              key={item}
              type="button"
              className="flex items-center gap-1 px-3 py-2 text-sm font-medium text-slate-600 hover:text-slate-900 hover:bg-surface-hover rounded-lg transition-colors"
            >
              {item}
              <ChevronDown size={14} className="text-slate-400" />
            </button>
          ))}
        </nav>

        <button type="button" className="btn-primary !px-5 !py-2.5 !text-sm !rounded-xl">
          Book a Demo
        </button>
      </div>
    </header>
  )
}
