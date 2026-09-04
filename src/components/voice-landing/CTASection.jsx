export default function CTASection() {
  return (
    <section className="py-16 md:py-24 bg-white">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center rounded-3xl border border-black/5 py-14 px-6"
        style={{ backgroundImage: 'linear-gradient(#E6F0FF 0%, #F5F9FF 100%)' }}
      >
        <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 max-w-xl mx-auto">
          Build Smarter Customer Experiences with <span className="text-primary">AI Voice Agents</span>
        </h2>
        <p className="text-slate-500 mt-3 max-w-lg mx-auto">
          Let us handle your calls, conversations, and customer queries anytime, anywhere.
        </p>
        <button type="button" className="btn-primary mt-7 !px-7 !py-3.5 !text-sm !rounded-xl mx-auto">
          Get a Demo
        </button>
      </div>
    </section>
  )
}
