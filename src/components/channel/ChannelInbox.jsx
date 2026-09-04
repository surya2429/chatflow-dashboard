import { useState } from 'react'
import { Search, Send, Smile, Paperclip, MoreVertical, CheckCheck, Phone, Video, Info } from 'lucide-react'
import clsx from 'clsx'

/**
 * Generic list + thread + composer inbox, reused across products
 * (Instagram DMs, Website Chat) that don't need WhatsApp's full
 * template/CTWA feature set from Conversations.jsx.
 */
export default function ChannelInbox({ channelName, channelColor, conversations, emptyLabel = 'No conversations yet' }) {
  const [activeId, setActiveId] = useState(conversations[0]?.id ?? null)
  const [search, setSearch] = useState('')
  const [draft, setDraft] = useState('')
  const [threads, setThreads] = useState(() =>
    Object.fromEntries(conversations.map(c => [c.id, c.messages]))
  )

  const filtered = conversations.filter(c => c.name.toLowerCase().includes(search.toLowerCase()))
  const active = conversations.find(c => c.id === activeId)
  const activeMessages = active ? threads[active.id] : []

  function sendMessage() {
    if (!draft.trim() || !active) return
    setThreads(prev => ({
      ...prev,
      [active.id]: [...prev[active.id], { id: Date.now(), from: 'agent', text: draft, time: 'now' }],
    }))
    setDraft('')
  }

  if (conversations.length === 0) {
    return (
      <div className="h-[calc(100vh-48px)] md:h-screen -mx-3 -mt-3 -mb-3 sm:-mx-5 sm:-mt-5 sm:-mb-5 flex items-center justify-center bg-white">
        <p className="text-sm text-slate-400">{emptyLabel}</p>
      </div>
    )
  }

  return (
    <div className="h-[calc(100vh-48px)] md:h-screen -mx-3 -mt-3 -mb-3 sm:-mx-5 sm:-mt-5 sm:-mb-5 flex overflow-hidden">
      {/* ── Conversation list ── */}
      <div className="w-full md:w-[280px] flex-shrink-0 border-r border-surface-border bg-white flex flex-col">
        <div className="px-3 py-3 border-b border-surface-border">
          <p className="text-sm font-bold text-slate-800 mb-2">{channelName} Inbox</p>
          <div className="relative">
            <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search conversations..."
              className="input-sm w-full pl-7"
            />
          </div>
        </div>
        <div className="flex-1 overflow-y-auto">
          {filtered.map(c => (
            <button
              key={c.id}
              onClick={() => setActiveId(c.id)}
              className={clsx(
                'w-full flex items-start gap-2.5 px-3 py-2.5 border-b border-surface-border/60 text-left hover:bg-surface-hover transition-colors',
                activeId === c.id && 'bg-primary-50'
              )}
            >
              <div className="w-9 h-9 rounded-full flex items-center justify-center text-white text-[11px] font-bold flex-shrink-0"
                style={{ background: channelColor }}>
                {c.avatar}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-1">
                  <p className="text-xs font-semibold text-slate-800 truncate">{c.name}</p>
                  <span className="text-[10px] text-slate-400 flex-shrink-0">{c.time}</span>
                </div>
                <p className="text-[11px] text-slate-500 truncate mt-0.5">{c.lastMessage}</p>
              </div>
              {c.unread > 0 && (
                <span className="w-4 h-4 rounded-full bg-primary text-white text-[9px] font-bold flex items-center justify-center flex-shrink-0">
                  {c.unread}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* ── Thread ── */}
      {active ? (
        <div className="flex-1 flex-col bg-white hidden md:flex">
          <div className="h-14 flex items-center justify-between px-4 border-b border-surface-border flex-shrink-0">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-[11px] font-bold"
                style={{ background: channelColor }}>
                {active.avatar}
              </div>
              <div>
                <p className="text-xs font-semibold text-slate-800 leading-none">{active.name}</p>
                <p className="text-[10px] text-slate-400 mt-0.5">{active.subtitle}</p>
              </div>
            </div>
            <div className="flex items-center gap-1 text-slate-400">
              <button className="p-1.5 rounded-md hover:bg-surface-hover hover:text-slate-600"><Phone size={14} /></button>
              <button className="p-1.5 rounded-md hover:bg-surface-hover hover:text-slate-600"><Video size={14} /></button>
              <button className="p-1.5 rounded-md hover:bg-surface-hover hover:text-slate-600"><Info size={14} /></button>
              <button className="p-1.5 rounded-md hover:bg-surface-hover hover:text-slate-600"><MoreVertical size={14} /></button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto px-5 py-4 space-y-2 bg-[#f0f4f8]">
            {activeMessages.map(m => (
              <div key={m.id} className={clsx('flex', m.from === 'agent' ? 'justify-end' : 'justify-start')}>
                <div className={clsx(
                  'max-w-[70%] rounded-2xl px-3.5 py-2 text-xs leading-relaxed shadow-sm',
                  m.from === 'agent' ? 'bg-primary text-white rounded-br-md' : 'bg-white text-slate-700 rounded-bl-md'
                )}>
                  <p>{m.text}</p>
                  <div className={clsx('flex items-center gap-1 mt-1 justify-end', m.from === 'agent' ? 'text-white/70' : 'text-slate-400')}>
                    <span className="text-[9px]">{m.time}</span>
                    {m.from === 'agent' && <CheckCheck size={11} />}
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="border-t border-surface-border p-3 flex-shrink-0">
            <div className="flex items-end gap-2">
              <button className="p-2 rounded-lg text-slate-400 hover:bg-surface-hover hover:text-slate-600 flex-shrink-0"><Paperclip size={16} /></button>
              <button className="p-2 rounded-lg text-slate-400 hover:bg-surface-hover hover:text-slate-600 flex-shrink-0"><Smile size={16} /></button>
              <textarea
                value={draft}
                onChange={e => setDraft(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage() } }}
                placeholder="Type a message..."
                rows={1}
                className="textarea flex-1 !min-h-[38px] !py-2 resize-none"
              />
              <button onClick={sendMessage} className="btn-primary !p-2.5 flex-shrink-0">
                <Send size={15} />
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="flex-1 hidden md:flex items-center justify-center bg-[#f0f4f8]">
          <p className="text-sm text-slate-400">Select a conversation</p>
        </div>
      )}
    </div>
  )
}
