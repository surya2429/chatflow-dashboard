import { useState } from 'react'
import { Bot, MessageSquare, RefreshCw, Sparkles, UserCheck, Clock, Lock } from 'lucide-react'
import { useData } from '../store/DataContext'
import { useAuth } from '../store/AuthContext'
import { fmtAgo, fmtNum, pct } from '../lib/format'
import { Card, PageHeader, Field, Select, Toggle, StatCard, SectionHeader, Badge, EmptyState } from '../components/ui'

const CAPABILITIES = [
  { id: 'tracking', label: 'Track a shipment', hint: 'Looks up a tracking ID and reads back the latest milestone.' },
  { id: 'quoting', label: 'Quote a route', hint: 'Prices a shipment using the live rate card.' },
  { id: 'faq', label: 'Answer FAQs', hint: 'Responds from published website FAQs and service pages.' },
  { id: 'pickupBooking', label: 'Book a pickup', hint: 'Creates a collection request the team confirms.' },
  { id: 'humanHandoff', label: 'Hand over to an agent', hint: 'Emails the support inbox when it cannot help.' },
]

export default function Chatbot() {
  const { db, updateChatbot } = useData()
  const { isSuper } = useAuth()
  const c = db.chatbot
  const [draft, setDraft] = useState(c)
  const dirty = JSON.stringify(draft) !== JSON.stringify(c)
  const set = (k, v) => setDraft((s) => ({ ...s, [k]: v }))
  const setCap = (k, v) => setDraft((s) => ({ ...s, capabilities: { ...s.capabilities, [k]: v } }))

  if (!isSuper) {
    return (
      <>
        <PageHeader title="AI Chatbot Configuration" />
        <Card className="p-16">
          <EmptyState
            icon={Lock}
            label="Super Administrators only"
            hint="Chatbot configuration sits with the Super Administrator role, alongside website content and user management."
          />
        </Card>
      </>
    )
  }

  return (
    <>
      <PageHeader
        title="AI Chatbot Configuration"
        subtitle="The assistant embedded on the website — what it can do, how it sounds and when it hands over to a person."
        actions={
          <>
            <button className="btn-ghost" disabled={!dirty} onClick={() => setDraft(c)}>Discard</button>
            <button className="btn-primary" disabled={!dirty} onClick={() => updateChatbot(draft)}>Save configuration</button>
          </>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Conversations" value={fmtNum(c.stats.conversations)} icon={MessageSquare} tone="navy" />
        <StatCard label="Resolved without a human" value={Math.round(c.stats.resolved * 100) + '%'} icon={Sparkles} tone="green" />
        <StatCard label="Handed to an agent" value={fmtNum(c.stats.handoffs)} icon={UserCheck} tone="amber" hint={pct(c.stats.handoffs, c.stats.conversations) + '% of conversations'} />
        <StatCard label="Average reply" value={c.stats.avgReply} icon={Clock} tone="cyan" />
      </div>

      <div className="mt-6 grid gap-5 lg:grid-cols-3">
        <div className="space-y-5 lg:col-span-2">
          <Card className="card-pad">
            <SectionHeader
              title="Assistant"
              subtitle="Identity and voice of the widget on the public website."
              actions={<Toggle checked={draft.enabled} onChange={(v) => set('enabled', v)} label={draft.enabled ? 'Live' : 'Off'} />}
            />
            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <Field label="Assistant name"><input className="field" value={draft.name} onChange={(e) => set('name', e.target.value)} /></Field>
              <Field label="Tone of voice">
                <Select
                  value={draft.tone} onChange={(v) => set('tone', v)}
                  options={[
                    { value: 'professional', label: 'Professional' },
                    { value: 'friendly', label: 'Friendly' },
                    { value: 'concise', label: 'Concise' },
                  ]}
                />
              </Field>
              <Field label="Opening message" className="sm:col-span-2">
                <textarea className="field min-h-[80px]" value={draft.greeting} onChange={(e) => set('greeting', e.target.value)} />
              </Field>
              <Field label="Widget accent colour">
                <div className="flex items-center gap-2">
                  <input type="color" className="h-9 w-12 cursor-pointer rounded border border-slate-300" value={draft.accent} onChange={(e) => set('accent', e.target.value)} />
                  <input className="field font-mono text-xs" value={draft.accent} onChange={(e) => set('accent', e.target.value)} />
                </div>
              </Field>
              <Field label="Office hours" hint="Shown when a handover is requested out of hours.">
                <input className="field" value={draft.officeHours} onChange={(e) => set('officeHours', e.target.value)} />
              </Field>
            </div>
          </Card>

          <Card className="card-pad">
            <SectionHeader title="What the assistant can do" subtitle="Each capability is backed by the same data the dashboard uses." />
            <div className="mt-5 space-y-4">
              {CAPABILITIES.map((cap) => (
                <Toggle
                  key={cap.id}
                  checked={!!draft.capabilities[cap.id]}
                  onChange={(v) => setCap(cap.id, v)}
                  label={cap.label}
                  hint={cap.hint}
                />
              ))}
            </div>
            <Field label="Handover inbox" className="mt-5" hint="Where unresolved conversations are emailed.">
              <input className="field" value={draft.handoffEmail} onChange={(e) => set('handoffEmail', e.target.value)} />
            </Field>
          </Card>

          <Card className="card-pad">
            <SectionHeader title="Knowledge sources" subtitle="Published website content the assistant answers from." />
            <ul className="mt-4 divide-y divide-slate-100">
              {c.trainingSources.map((s) => (
                <li key={s.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                  <div>
                    <p className="text-sm font-semibold text-navy-900">{s.label}</p>
                    <p className="text-xs text-slate-500">{s.items} item(s) · last synced {fmtAgo(s.syncedAt)}</p>
                  </div>
                  <button
                    className="btn-ghost btn-sm"
                    onClick={() => updateChatbot({
                      trainingSources: c.trainingSources.map((t) => (t.id === s.id ? { ...t, syncedAt: new Date().toISOString() } : t)),
                    })}
                  >
                    <RefreshCw size={13} /> Re-sync
                  </button>
                </li>
              ))}
            </ul>
          </Card>
        </div>

        {/* Live preview of the website widget */}
        <div>
          <Card className="sticky top-0 overflow-hidden">
            <div className="border-b border-slate-200 px-5 py-4">
              <SectionHeader title="Widget preview" subtitle="How the assistant appears on the website." />
            </div>
            <div className="bg-slate-100 p-5">
              <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-pop">
                <div className="flex items-center gap-2.5 px-4 py-3" style={{ backgroundColor: draft.accent }}>
                  <span className="grid h-8 w-8 place-items-center rounded-full bg-white/15 text-white"><Bot size={16} /></span>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-white">{draft.name || 'Assistant'}</p>
                    <p className="text-[11px] text-white/70">{draft.enabled ? 'Online now' : 'Currently offline'}</p>
                  </div>
                </div>
                <div className="space-y-3 px-4 py-4">
                  <div className="max-w-[85%] rounded-2xl rounded-tl-sm bg-slate-100 px-3.5 py-2.5">
                    <p className="text-[13px] leading-relaxed text-navy-800">{draft.greeting}</p>
                  </div>
                  <div className="ml-auto max-w-[85%] rounded-2xl rounded-tr-sm px-3.5 py-2.5" style={{ backgroundColor: draft.accent }}>
                    <p className="text-[13px] leading-relaxed text-white">Where is PNL104278?</p>
                  </div>
                  {draft.capabilities.tracking ? (
                    <div className="max-w-[90%] rounded-2xl rounded-tl-sm bg-slate-100 px-3.5 py-2.5">
                      <p className="text-[13px] leading-relaxed text-navy-800">
                        That shipment is <strong>out for delivery</strong> in Dubai and is expected today. Would you like the full tracking history?
                      </p>
                    </div>
                  ) : (
                    <div className="max-w-[90%] rounded-2xl rounded-tl-sm bg-slate-100 px-3.5 py-2.5">
                      <p className="text-[13px] leading-relaxed text-navy-800">
                        I can put you in touch with our team — shall I pass this to {draft.handoffEmail}?
                      </p>
                    </div>
                  )}
                </div>
                <div className="border-t border-slate-200 px-4 py-3">
                  <div className="rounded-full border border-slate-200 px-3.5 py-2 text-[13px] text-slate-400">Type your message…</div>
                </div>
              </div>
            </div>
            <div className="border-t border-slate-200 px-5 py-4">
              <div className="flex flex-wrap gap-1.5">
                {CAPABILITIES.filter((cap) => draft.capabilities[cap.id]).map((cap) => (
                  <Badge key={cap.id} tone="navy">{cap.label}</Badge>
                ))}
                {!CAPABILITIES.some((cap) => draft.capabilities[cap.id]) && (
                  <p className="text-xs text-slate-500">No capabilities enabled — the assistant will only collect contact details.</p>
                )}
              </div>
            </div>
          </Card>
        </div>
      </div>
    </>
  )
}
