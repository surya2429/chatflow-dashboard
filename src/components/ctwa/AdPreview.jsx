import { useState } from 'react'
import { ImageIcon, MoreHorizontal, ThumbsUp, MessageCircle, Share2, ChevronLeft, Phone, Video, Smile, Paperclip, Mic, CheckCheck } from 'lucide-react'
import clsx from 'clsx'

/* What the customer will see: the ad in a Facebook / Instagram feed, and the WhatsApp chat it opens. */
export default function AdPreview({ pageName = 'Your business', headline, primaryText, description, imageUrl, welcome }) {
  const [view, setView] = useState('feed')
  const iceBreakers = (welcome.iceBreakers || []).filter((s) => s.trim())
  const initial = (pageName || 'B').trim()[0].toUpperCase()

  return (
    <div>
      <div className="inline-flex bg-slate-100 rounded-lg p-0.5 mb-3" role="tablist">
        {[['feed', 'Feed ad'], ['chat', 'WhatsApp chat']].map(([k, l]) => (
          <button key={k} role="tab" aria-selected={view === k} onClick={() => setView(k)}
            className={clsx('px-3 py-1 rounded-md text-[11px] font-semibold transition-colors', view === k ? 'bg-white shadow-sm text-slate-800' : 'text-slate-500 hover:text-slate-700')}>{l}</button>
        ))}
      </div>

      {view === 'feed' ? (
        <div className="max-w-[340px] mx-auto bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden text-slate-900">
          <div className="flex items-center gap-2.5 px-3 py-2.5">
            <span className="w-9 h-9 rounded-full bg-emerald-500 text-white font-bold flex items-center justify-center text-sm">{initial}</span>
            <div className="flex-1 min-w-0">
              <p className="text-[13px] font-semibold truncate">{pageName}</p>
              <p className="text-[11px] text-slate-500">Sponsored · 🌐</p>
            </div>
            <MoreHorizontal size={16} className="text-slate-400" />
          </div>
          <p className="px-3 pb-2.5 text-[13px] leading-snug whitespace-pre-wrap break-words">{primaryText || <span className="text-slate-300">Your main text appears here…</span>}</p>
          <div className="aspect-[1.91/1] bg-gradient-to-br from-emerald-100 via-sky-100 to-indigo-100 flex items-center justify-center overflow-hidden">
            {imageUrl ? <img src={imageUrl} alt="Ad preview" className="w-full h-full object-cover" /> : <ImageIcon size={28} className="text-slate-300" />}
          </div>
          <div className="flex items-center gap-3 bg-slate-100 px-3 py-2.5">
            <div className="flex-1 min-w-0">
              <p className="text-[10px] uppercase tracking-wide text-slate-500">WhatsApp</p>
              <p className="text-[13px] font-semibold truncate">{headline || <span className="text-slate-300 font-normal">Your headline</span>}</p>
              {description && <p className="text-[11px] text-slate-500 truncate">{description}</p>}
            </div>
            <span className="px-3 py-1.5 rounded-md bg-slate-200 text-[12px] font-semibold whitespace-nowrap">Send message</span>
          </div>
          <div className="flex justify-around px-3 py-2 text-[12px] text-slate-500 border-t border-slate-100">
            <span className="inline-flex items-center gap-1"><ThumbsUp size={13} /> Like</span>
            <span className="inline-flex items-center gap-1"><MessageCircle size={13} /> Comment</span>
            <span className="inline-flex items-center gap-1"><Share2 size={13} /> Share</span>
          </div>
        </div>
      ) : (
        <div className="max-w-[300px] mx-auto rounded-[22px] border border-slate-300 overflow-hidden shadow-sm bg-[#efe9df]">
          <div className="flex items-center gap-2 bg-[#075e54] text-white px-2.5 py-2.5">
            <ChevronLeft size={16} />
            <span className="w-7 h-7 rounded-full bg-white/20 flex items-center justify-center text-xs font-bold">{initial}</span>
            <p className="flex-1 text-[13px] font-semibold truncate">{pageName}</p>
            <Video size={15} /><Phone size={14} />
          </div>
          <div className="h-[270px] px-3 py-3 flex flex-col gap-2 overflow-hidden">
            <div className="self-start max-w-[86%] bg-white rounded-lg rounded-tl-none px-2.5 py-1.5 shadow-sm">
              <p className="text-[12.5px] leading-snug text-slate-800 whitespace-pre-wrap break-words">{welcome.greeting || <span className="text-slate-300">Your greeting…</span>}</p>
              <p className="text-[9px] text-slate-400 text-right mt-0.5">9:41</p>
            </div>
            {welcome.type === 'ice_breakers' && iceBreakers.length > 0 && (
              <div className="self-start flex flex-col gap-1.5 w-[86%]">
                {iceBreakers.map((b, i) => <span key={i} className="bg-white rounded-full border border-slate-200 text-[12px] text-[#027eb5] text-center px-3 py-1.5 shadow-sm truncate">{b}</span>)}
              </div>
            )}
          </div>
          <div className="flex items-center gap-2 px-2 py-2 bg-[#f0f0f0]">
            <div className="flex-1 flex items-center gap-1.5 bg-white rounded-full px-3 py-1.5 min-w-0">
              <Smile size={14} className="text-slate-400 flex-shrink-0" />
              <span className={clsx('text-[12px] truncate flex-1', welcome.type === 'autofill' && welcome.autofillMessage ? 'text-slate-800' : 'text-slate-400')}>
                {welcome.type === 'autofill' && welcome.autofillMessage ? welcome.autofillMessage : 'Message'}
              </span>
              <Paperclip size={13} className="text-slate-400 flex-shrink-0" />
            </div>
            <span className="w-8 h-8 rounded-full bg-[#00a884] text-white flex items-center justify-center flex-shrink-0">{welcome.type === 'autofill' && welcome.autofillMessage ? <CheckCheck size={14} /> : <Mic size={14} />}</span>
          </div>
        </div>
      )}
      <p className="text-center text-[10px] text-slate-400 mt-3">Preview only. Meta may adjust how the ad is displayed.</p>
    </div>
  )
}
