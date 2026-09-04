import { useState } from 'react'
import { Search, Download, UserPlus, Tag } from 'lucide-react'
import clsx from 'clsx'

/** Generic contacts table reused across products that don't need Contacts.jsx's full WhatsApp CRM feature set. */
export default function ChannelContacts({ channelName, channelColor, contacts }) {
  const [search, setSearch] = useState('')
  const filtered = contacts.filter(c => c.name.toLowerCase().includes(search.toLowerCase()))

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">{channelName} Contacts</h1>
          <p className="text-xs text-slate-400 mt-0.5">{contacts.length} contacts</p>
        </div>
        <div className="flex items-center gap-2">
          <button className="btn-secondary btn-sm"><Download size={13} /> Export</button>
          <button className="btn-primary btn-sm"><UserPlus size={13} /> Add Contact</button>
        </div>
      </div>

      <div className="card mt-4">
        <div className="p-3 border-b border-surface-border">
          <div className="relative max-w-xs">
            <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search contacts..."
              className="input-sm w-full pl-7"
            />
          </div>
        </div>
        <table className="w-full">
          <thead>
            <tr className="table-header">
              <th className="table-cell text-left">Name</th>
              <th className="table-cell text-left">Handle</th>
              <th className="table-cell text-left">Tags</th>
              <th className="table-cell text-left">Last Active</th>
              <th className="table-cell text-left">Status</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(c => (
              <tr key={c.id} className="table-row">
                <td className="table-cell">
                  <div className="flex items-center gap-2.5">
                    <div className="w-7 h-7 rounded-full flex items-center justify-center text-white text-[10px] font-bold flex-shrink-0"
                      style={{ background: channelColor }}>
                      {c.avatar}
                    </div>
                    <span className="font-medium text-slate-800">{c.name}</span>
                  </div>
                </td>
                <td className="table-cell text-slate-500">{c.handle}</td>
                <td className="table-cell">
                  <div className="flex flex-wrap gap-1">
                    {c.tags.map(t => (
                      <span key={t} className="badge badge-slate text-[10px] flex items-center gap-1">
                        <Tag size={9} />{t}
                      </span>
                    ))}
                  </div>
                </td>
                <td className="table-cell text-slate-500">{c.lastActive}</td>
                <td className="table-cell">
                  <span className={clsx('badge text-[10px]', c.status === 'active' ? 'badge-green' : 'badge-slate')}>
                    {c.status === 'active' ? 'Active' : 'Inactive'}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length === 0 && (
          <div className="py-10 text-center text-sm text-slate-400">No contacts found</div>
        )}
      </div>
    </div>
  )
}
