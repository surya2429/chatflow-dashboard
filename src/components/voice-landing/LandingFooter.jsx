export default function LandingFooter() {
  return (
    <footer className="bg-white border-t border-black/5 py-10">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4">
        <a href="#" className="flex items-center gap-2 font-extrabold text-lg text-slate-900">
          <span className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center text-white text-sm">S</span>
          SmatBot
        </a>
        <p className="text-sm text-slate-400">© 2026 SmatBot. All rights reserved.</p>
      </div>
    </footer>
  )
}
