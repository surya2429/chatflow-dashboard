import { useState } from 'react'
import { Mic, X } from 'lucide-react'

export default function VoiceChatFAB() {
  const [open, setOpen] = useState(false)

  return (
    <>
      {open && (
        <div className="fixed bottom-24 right-6 z-50 w-72 card shadow-modal p-5 animate-slide-up">
          <p className="font-semibold text-slate-900">Voice chat</p>
          <p className="text-sm text-slate-500 mt-1">Tap the mic to start talking with our AI voice agent.</p>
          <button type="button" className="btn-primary w-full !justify-center mt-4 !rounded-xl">
            <Mic size={16} /> Start Talking
          </button>
        </div>
      )}

      <button
        type="button"
        aria-label="Open voice chat"
        onClick={() => setOpen(o => !o)}
        className="fixed bottom-6 right-6 z-50 w-14 h-14 rounded-full bg-primary text-white shadow-modal flex items-center justify-center hover:scale-105 transition-transform"
      >
        {open ? <X size={22} /> : <Mic size={22} />}
      </button>
    </>
  )
}
