import { Mic } from 'lucide-react'

export default function TryBotSection() {
  return (
    <section className="pt-16 md:pt-24 pb-8 md:pb-12 bg-white border-t border-black/5">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
        <h2 className="text-2xl sm:text-3xl font-bold text-slate-900">Try Our AI Voice Agent</h2>
        <p className="text-slate-500 mt-3 max-w-xl mx-auto">
          Click below to start a live conversation with our voice bot no setup required.
        </p>
        <button type="button" className="btn-primary mt-7 !px-7 !py-3.5 !text-sm !rounded-xl mx-auto">
          <Mic size={16} />
          Talk to the Bot Now
        </button>
      </div>
    </section>
  )
}
