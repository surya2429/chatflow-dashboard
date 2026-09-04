import { Globe, MessageCircle, Shuffle, Phone, Network } from 'lucide-react'

const CHANNELS = [
  { icon: Globe, title: 'Website Voice Widget', desc: 'Talk-to-website feature that answers questions, captures leads, books appointments.' },
  { icon: MessageCircle, title: 'WhatsApp Voice Automation', desc: 'Deploy AI Voice Agents on WhatsApp to answer queries and automate customer conversations.' },
  { icon: Shuffle, title: 'Smart Team Handover', desc: 'Automatically route AI conversations to the right department or live agent based on customer intent.' },
  { icon: Phone, title: 'Telephony Voice Bot', desc: 'Replace IVR, handle inbound queries, or run outbound calling campaigns.' },
  { icon: Network, title: 'SIP / Trunk Compatible', desc: 'Instant connection to your existing phone systems.' },
]

export default function DeployAnywhereSection() {
  return (
    <section className="py-16 md:py-24 bg-white border-t border-black/5">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-2xl mx-auto mb-12">
          <span className="badge-blue">Deploy Anywhere</span>
          <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 mt-3">One Voice Agent. Every Channel.</h2>
          <p className="text-slate-500 mt-3">Deploy across web, telephony, and WhatsApp wherever your customers are.</p>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {CHANNELS.map(({ icon: Icon, title, desc }) => (
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
