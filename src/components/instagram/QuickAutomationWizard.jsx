import { useState } from 'react'
import {
  X, Send, MessageSquare, Camera, AtSign, Check, ChevronLeft, ChevronRight, ChevronDown, MessageCircle,
  Plus, Mail, UserCheck, Clock3, Sparkles,
} from 'lucide-react'
import clsx from 'clsx'
import {
  KeywordInput, ContentPicker, AIReplyConfig, InstagramLivePreview, FollowGateField, FrequencyCapField,
  AdvancedSection, MOCK_POSTS, MOCK_STORIES, Toggle,
} from './shared'

const SOURCES = [
  { v: 'dm',      label: 'Direct Message', desc: 'Triggers on a DM keyword',        icon: Send },
  { v: 'comment', label: 'Comment',        desc: 'Triggers on a post/reel comment', icon: MessageSquare },
  { v: 'story_reply',   label: 'Story Reply',   desc: 'Someone replies to your story', icon: Camera },
  { v: 'story_mention', label: 'Story Mention', desc: 'Someone tags you in a story',   icon: AtSign },
]

const STEPS = ['Trigger source', 'Target', 'Keywords', 'Reply', 'Review']

function emptyDraft() {
  return {
    id: `qa${Date.now()}`, name: '', active: true, source: 'dm',
    targetScope: 'all', targetIds: [],
    keywords: [], matchMode: 'any',
    // Non-comment sources: aiConfig is simply the reply.
    aiConfig: { aiEnabled: true, instructions: '', useGlobalKb: true, docs: [], message: '' },
    followGate: { enabled: false, nudgeMessage: '' }, frequencyCap: 'none',
    // Comment sources: a two-message DM funnel (Opening DM w/ button → DM with the link),
    // each independently AI-or-fixed, plus an "Other things to automate" checklist matching
    // ManyChat's Comment Growth Tool.
    openingDM: { aiEnabled: false, instructions: '', useGlobalKb: true, docs: [], message: "Hey there! I'm so happy you're here, thanks so much for your interest 😊 Click below and I'll send you the link in just a sec ✨", buttonLabel: 'Send me the link' },
    linkDM: { aiEnabled: false, instructions: '', useGlobalKb: true, docs: [], message: '', url: '', buttonLabel: 'Open' },
    publicReplyEnabled: false,
    publicReplies: ['Thanks! ❤️ Please check your DMs.'],
    publicReplyConfig: { aiEnabled: false, instructions: '', useGlobalKb: true, docs: [] },
    askEmailEnabled: false,
    commentFollowGate: { enabled: false, promptMessage: "Nearly there! The link is especially for my followers ✨ Right after you follow me, I'll send you the link so you can dive straight in! 🎉" },
    followUpEnabled: false,
    followUpMessage: "If you're still curious, don't forget to tap the link 🔗 I think you'll love it ❤️",
    stats: { triggered: 0, trend7d: 0 },
  }
}

/* ─── numbered card for a required step in the DM funnel (Opening DM / Link DM) ── */
function FlowStepCard({ index, title, desc, children }) {
  return (
    <div className="rounded-xl border border-surface-border bg-white p-4 space-y-3">
      <div className="flex items-start gap-2.5">
        <span className="w-5 h-5 rounded-full bg-primary text-white text-[10px] font-bold flex items-center justify-center flex-shrink-0 mt-0.5">{index}</span>
        <div className="min-w-0">
          <p className="text-[12.5px] font-bold text-slate-800 leading-tight">{title}</p>
          {desc && <p className="text-[10.5px] text-slate-400 mt-0.5">{desc}</p>}
        </div>
      </div>
      <div className="pl-[30px] space-y-2">{children}</div>
    </div>
  )
}

/* ─── connector arrow between flow steps — shows the message order ─────── */
function FlowConnector() {
  return (
    <div className="flex justify-center py-0.5">
      <div className="w-px h-4 bg-slate-200"/>
    </div>
  )
}

/* ─── toggle-driven card — "Optional add-ons" list, consistent with AIReplyConfig's toggle ── */
function ToggleCard({ icon: Icon, title, desc, checked, onChange, children }) {
  return (
    <div className={clsx('rounded-xl border overflow-hidden transition-colors',
      checked ? 'border-primary/25 bg-primary-50/40' : 'border-surface-border bg-white')}>
      <div role="button" tabIndex={0} onClick={() => onChange(!checked)}
        onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onChange(!checked) } }}
        className="w-full flex items-center gap-3 px-3.5 py-3 text-left cursor-pointer select-none">
        <div className={clsx('w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0',
          checked ? 'bg-primary/15' : 'bg-slate-100')}>
          <Icon size={14} className={checked ? 'text-primary' : 'text-slate-400'}/>
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[12px] font-semibold text-slate-800">{title}</p>
          {desc && <p className="text-[10.5px] text-slate-400 mt-0.5">{desc}</p>}
        </div>
        <div onClick={e => e.stopPropagation()}>
          <Toggle checked={checked} onChange={onChange}/>
        </div>
      </div>
      {checked && children && (
        <div className="px-3.5 pb-3.5 pt-3 space-y-2.5 border-t border-primary/10">{children}</div>
      )}
    </div>
  )
}

export default function QuickAutomationWizard({ rule, onClose, onSave }) {
  const [draft, setDraft] = useState(() => rule ?? emptyDraft())
  const [dirty, setDirty] = useState(!!rule)
  const [confirmClose, setConfirmClose] = useState(false)
  const set = (k, v) => { setDraft(d => ({ ...d, [k]: v })); setDirty(true) }
  const setIn = (k, sub, v) => { setDraft(d => ({ ...d, [k]: { ...d[k], [sub]: v } })); setDirty(true) }

  const needsTarget = draft.source === 'comment' || draft.source === 'story_reply'
  const needsKeywords = draft.source === 'dm' || draft.source === 'comment'
  const visibleSteps = STEPS.filter((_, i) => (i === 1 && !needsTarget) || (i === 2 && !needsKeywords) ? false : true)
  const [stepIdx, setStepIdx] = useState(0)
  const stepName = visibleSteps[stepIdx]

  const isComment = draft.source === 'comment'
  const replyOk = isComment || (draft.aiConfig.aiEnabled || draft.aiConfig.message.trim().length > 0)
  const linkDmOk = !isComment || (draft.linkDM.aiEnabled || draft.linkDM.message.trim().length > 0)

  function stepValid() {
    if (stepName === 'Trigger source') return !!draft.source
    if (stepName === 'Target') return draft.targetScope === 'all' || draft.targetIds.length > 0
    if (stepName === 'Keywords') return true
    if (stepName === 'Reply') return isComment ? linkDmOk : replyOk
    return true
  }

  function next() { if (stepIdx < visibleSteps.length - 1) setStepIdx(i => i + 1) }
  function back() { if (stepIdx > 0) setStepIdx(i => i - 1) }
  function jump(i) { if (i < stepIdx) setStepIdx(i) }
  function requestClose() { if (dirty) setConfirmClose(true); else onClose() }
  function publish(active) { onSave({ ...draft, active, name: draft.name || autoName() }) }
  function autoName() {
    const src = SOURCES.find(s => s.v === draft.source)?.label
    return draft.keywords.length ? `${src} · "${draft.keywords[0]}"` : `${src} automation`
  }
  function addPublicReply() { if (draft.publicReplies.length < 3) set('publicReplies', [...draft.publicReplies, '']) }
  function setPublicReply(i, v) { set('publicReplies', draft.publicReplies.map((r, j) => j === i ? v : r)) }
  function removePublicReply(i) { set('publicReplies', draft.publicReplies.filter((_, j) => j !== i)) }

  const triggerText = needsKeywords ? (draft.keywords[0] || 'keyword') : draft.source === 'story_reply' ? 'replies to your story' : 'tags you in their story'
  const selectedPost = MOCK_POSTS.find(p => p.id === draft.targetIds[0]) || MOCK_POSTS[0]

  const dmMessages = isComment ? [
    { from: 'user', text: `"${triggerText}"` },
    { from: 'bot', text: draft.openingDM.aiEnabled ? '✨ AI-generated opening message' : (draft.openingDM.message || 'Opening DM…') },
    { from: 'bot', button: draft.openingDM.buttonLabel || 'Send me the link' },
    { from: 'user', button: draft.openingDM.buttonLabel || 'Send me the link' },
    ...(draft.commentFollowGate.enabled ? [
      { from: 'bot', text: draft.commentFollowGate.promptMessage },
      { from: 'user', button: 'Following' },
    ] : []),
    { from: 'bot', text: draft.linkDM.aiEnabled ? '✨ AI-generated link message' : (draft.linkDM.message || 'DM with the link…') },
    { from: 'bot', button: draft.linkDM.buttonLabel || 'Open' },
  ] : [
    { from: 'user', text: needsKeywords ? `"${triggerText}"` : `📸 ${triggerText}` },
    ...(draft.followGate?.enabled ? [{ from: 'bot', text: draft.followGate.nudgeMessage || 'Follow us to unlock this! 🔗' }] : []),
    { from: 'bot', text: draft.aiConfig.aiEnabled ? '✨ AI-generated reply based on your instructions' : (draft.aiConfig.message || 'Your reply message…') },
  ]

  const publicRepliesPreview = isComment && draft.publicReplyEnabled
    ? (draft.publicReplyConfig.aiEnabled ? ['✨ AI-generated reply'] : draft.publicReplies)
    : []

  const previewPanel = (
    <InstagramLivePreview
      showTabs={isComment}
      post={isComment ? selectedPost : undefined}
      triggerComment={draft.keywords[0] || 'comment'}
      publicReplies={publicRepliesPreview}
      dmMessages={dmMessages}
    />
  )

  return (
    <div className="fixed inset-0 bg-slate-900/25 z-50 flex items-center justify-center p-4" onMouseDown={e => { if (e.target === e.currentTarget) requestClose() }}>
      <div className="bg-white border border-surface-border rounded-2xl w-full max-w-5xl shadow-modal flex flex-col max-h-[92vh] overflow-hidden">
        {/* header + step indicator */}
        <div className="p-5 border-b border-surface-border flex-shrink-0">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-slate-900 text-sm">{rule ? 'Edit Automation' : 'New Quick Automation'}</h3>
            <button onClick={requestClose} className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-surface-hover"><X size={15}/></button>
          </div>
          <div className="flex items-center gap-1.5 max-w-xl">
            {visibleSteps.map((s, i) => (
              <button key={s} onClick={() => jump(i)} disabled={i > stepIdx}
                className={clsx('flex-1 flex items-center gap-1.5 group', i > stepIdx && 'cursor-default')}>
                <span className={clsx('w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold flex-shrink-0 transition-colors',
                  i < stepIdx ? 'bg-primary text-white' : i === stepIdx ? 'bg-primary/15 text-primary ring-2 ring-primary/30' : 'bg-slate-100 text-slate-400')}>
                  {i < stepIdx ? <Check size={11}/> : i + 1}
                </span>
                <span className={clsx('text-[10px] font-semibold truncate', i === stepIdx ? 'text-slate-700' : 'text-slate-400')}>{s}</span>
                {i < visibleSteps.length - 1 && <span className="flex-1 h-px bg-slate-100"/>}
              </button>
            ))}
          </div>
        </div>

        {/* step content — persistent live preview on the right for every step */}
        <div className="flex-1 overflow-y-auto p-5">
          <div className="grid grid-cols-1 md:grid-cols-[1fr_260px] gap-6">
            <div>
              {stepName === 'Trigger source' && (
                <div className="space-y-3">
                  <p className="text-[12px] font-semibold text-slate-700">Where should this automation trigger from?</p>
                  <div className="grid grid-cols-2 gap-3">
                    {SOURCES.map(s => (
                      <button key={s.v} onClick={() => { set('source', s.v); set('targetScope', 'all'); set('targetIds', []) }}
                        className={clsx('text-left p-4 rounded-xl border-2 transition-colors',
                          draft.source === s.v ? 'border-primary bg-primary-50' : 'border-surface-border hover:border-primary/30 hover:bg-surface-hover')}>
                        <div className="w-9 h-9 rounded-lg flex items-center justify-center mb-2" style={{ background: draft.source === s.v ? 'rgb(var(--accent) / 0.12)' : '#f1f5f9' }}>
                          <s.icon size={16} className={draft.source === s.v ? 'text-primary' : 'text-slate-400'}/>
                        </div>
                        <p className="text-[12px] font-semibold text-slate-800">{s.label}</p>
                        <p className="text-[10px] text-slate-400 mt-0.5">{s.desc}</p>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {stepName === 'Target' && (
                <div className="space-y-3">
                  <p className="text-[12px] font-semibold text-slate-700">{draft.source === 'comment' ? 'Which post or reel?' : 'Which stories?'}</p>
                  <ContentPicker items={draft.source === 'comment' ? MOCK_POSTS : MOCK_STORIES} kind={draft.source === 'comment' ? 'post' : 'story'}
                    scope={draft.targetScope} selectedIds={draft.targetIds}
                    onScopeChange={v => set('targetScope', v)} onSelectionChange={v => set('targetIds', v)}/>
                </div>
              )}

              {stepName === 'Keywords' && (
                <div className="space-y-3">
                  <p className="text-[12px] font-semibold text-slate-700">What should trigger this automation?</p>
                  <KeywordInput keywords={draft.keywords} onChange={v => set('keywords', v)}/>
                  <div className="grid grid-cols-2 gap-1.5">
                    {[{ v: 'any', l: 'Match any word' }, { v: 'exact', l: 'Exact match only' }].map(o => (
                      <button key={o.v} onClick={() => set('matchMode', o.v)}
                        className={clsx('px-2 py-2 rounded-lg border text-[11px] font-semibold transition-colors',
                          draft.matchMode === o.v ? 'border-primary bg-primary-50 text-primary' : 'border-surface-border text-slate-600 hover:bg-surface-hover')}>
                        {o.l}
                      </button>
                    ))}
                  </div>
                  <p className="text-[10px] text-slate-400">Leave keywords empty to match every {draft.source === 'comment' ? 'comment' : 'message'}.</p>
                </div>
              )}

              {stepName === 'Reply' && !isComment && (
                <div className="space-y-3">
                  <div className="space-y-1.5">
                    <label className="label">Automation name <span className="text-slate-400 font-normal">(optional)</span></label>
                    <input className="input" placeholder={autoName()} value={draft.name} onChange={e => set('name', e.target.value)}/>
                  </div>
                  <AIReplyConfig config={draft.aiConfig} onChange={v => set('aiConfig', v)}
                    aiLabel="Use AI to write this reply" messagePlaceholder="Type the reply message…"/>
                  <AdvancedSection summary={draft.followGate?.enabled ? 'Follow-Gate on' : 'Follow-Gate, frequency cap'}>
                    <FollowGateField config={draft.followGate} onChange={v => set('followGate', v)}/>
                    <FrequencyCapField value={draft.frequencyCap} onChange={v => set('frequencyCap', v)}/>
                  </AdvancedSection>
                </div>
              )}

              {stepName === 'Reply' && isComment && (
                <div className="space-y-6">
                  <div className="space-y-1.5">
                    <label className="label">Automation name <span className="text-slate-400 font-normal">(optional)</span></label>
                    <input className="input" placeholder={autoName()} value={draft.name} onChange={e => set('name', e.target.value)}/>
                  </div>

                  {/* required funnel: two DMs, shown as a numbered flow so the order is unmistakable */}
                  <div>
                    <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wide mb-2">The DM funnel</p>
                    <FlowStepCard index={1} title="Opening DM" desc="Sent the moment someone comments — invites them to tap a button.">
                      <AIReplyConfig config={draft.openingDM} onChange={v => set('openingDM', v)}
                        aiLabel="Use AI to write the opening message" messagePlaceholder="Hey there! I'm so happy you're here…"/>
                      <input className="input" placeholder="Button label, e.g. Send me the link" value={draft.openingDM.buttonLabel} onChange={e => setIn('openingDM', 'buttonLabel', e.target.value)}/>
                    </FlowStepCard>

                    <FlowConnector/>

                    <FlowStepCard index={2} title="DM with the link" desc="Sent right after they tap the button above.">
                      <AIReplyConfig config={draft.linkDM} onChange={v => set('linkDM', v)}
                        aiLabel="Use AI to write this message" messagePlaceholder="Here's the link you asked for…"/>
                      <div className="grid grid-cols-2 gap-2">
                        <input className="input" placeholder="https://…" value={draft.linkDM.url} onChange={e => setIn('linkDM', 'url', e.target.value)}/>
                        <input className="input" placeholder="Button label" value={draft.linkDM.buttonLabel} onChange={e => setIn('linkDM', 'buttonLabel', e.target.value)}/>
                      </div>
                    </FlowStepCard>
                  </div>

                  {/* optional extras, off by default — each is its own self-contained toggle card */}
                  <div>
                    <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wide mb-0.5">Optional add-ons</p>
                    <p className="text-[10.5px] text-slate-400 mb-2">Turn on any extra steps for this automation.</p>
                    <div className="space-y-2">
                      <ToggleCard icon={MessageCircle} title="Publicly reply to the comment"
                        desc="Reply under the comment itself, in addition to the DM."
                        checked={draft.publicReplyEnabled} onChange={v => set('publicReplyEnabled', v)}>
                        <div className="grid grid-cols-2 gap-1.5">
                          {[{ v: false, l: 'Fixed replies' }, { v: true, l: 'AI-generated' }].map(o => (
                            <button key={String(o.v)} onClick={() => setIn('publicReplyConfig', 'aiEnabled', o.v)}
                              className={clsx('px-2 py-1.5 rounded-lg border text-[11px] font-semibold transition-colors',
                                draft.publicReplyConfig.aiEnabled === o.v ? 'border-primary bg-primary-50 text-primary' : 'border-surface-border text-slate-600 hover:bg-surface-hover bg-white')}>
                              {o.l}
                            </button>
                          ))}
                        </div>
                        {draft.publicReplyConfig.aiEnabled ? (
                          <>
                            <p className="text-[10px] text-slate-400 flex items-center gap-1"><Sparkles size={10} className="text-purple-500"/> AI writes a fresh, varied reply each time a comment matches.</p>
                            <AIReplyConfig config={draft.publicReplyConfig} onChange={v => set('publicReplyConfig', v)} hideToggle/>
                          </>
                        ) : (
                          <>
                            <p className="text-[10px] text-slate-400">Write up to 3 replies — one is picked at random each time.</p>
                            {draft.publicReplies.map((r, i) => (
                              <div key={i} className="flex gap-1.5">
                                <input className="input-sm flex-1" placeholder={`Reply ${i + 1}`} value={r} onChange={e => setPublicReply(i, e.target.value)}/>
                                {draft.publicReplies.length > 1 && <button onClick={() => removePublicReply(i)} className="p-1.5 text-slate-400 hover:text-red-500"><X size={13}/></button>}
                              </div>
                            ))}
                            {draft.publicReplies.length < 3 && (
                              <button onClick={addPublicReply} className="text-[11px] text-primary font-semibold hover:underline flex items-center gap-1"><Plus size={11}/> Add another reply</button>
                            )}
                          </>
                        )}
                      </ToggleCard>

                      <ToggleCard icon={Mail} title="Ask for email" desc="Collect an email before sending the link."
                        checked={draft.askEmailEnabled} onChange={v => set('askEmailEnabled', v)}/>

                      <ToggleCard icon={UserCheck} title="Ask them to follow first" desc="Gate the link behind a follow request."
                        checked={draft.commentFollowGate.enabled} onChange={v => setIn('commentFollowGate', 'enabled', v)}>
                        <label className="text-[10px] font-semibold text-slate-500">Prompt message</label>
                        <textarea className="textarea !text-[11px]" rows={3} value={draft.commentFollowGate.promptMessage}
                          onChange={e => setIn('commentFollowGate', 'promptMessage', e.target.value)}/>
                      </ToggleCard>

                      <ToggleCard icon={Clock3} title="Follow up if they don't click" desc="A gentle nudge sent later if the link goes unopened."
                        checked={draft.followUpEnabled} onChange={v => set('followUpEnabled', v)}>
                        <label className="text-[10px] font-semibold text-slate-500">Follow-up message</label>
                        <textarea className="textarea !text-[11px]" rows={2} value={draft.followUpMessage} onChange={e => set('followUpMessage', e.target.value)}/>
                      </ToggleCard>
                    </div>
                  </div>

                  <AdvancedSection summary="Frequency cap">
                    <FrequencyCapField value={draft.frequencyCap} onChange={v => set('frequencyCap', v)}/>
                  </AdvancedSection>
                </div>
              )}

              {stepName === 'Review' && (
                <div className="space-y-3">
                  <p className="text-[12px] font-semibold text-slate-700">Review &amp; publish</p>
                  <div className="bg-slate-50 border border-surface-border rounded-xl divide-y divide-surface-border">
                    <div className="flex items-center justify-between px-4 py-2.5">
                      <span className="text-[11px] text-slate-500">Trigger source</span>
                      <span className="text-[11px] font-semibold text-slate-700">{SOURCES.find(s => s.v === draft.source)?.label}</span>
                    </div>
                    {needsTarget && (
                      <div className="flex items-center justify-between px-4 py-2.5">
                        <span className="text-[11px] text-slate-500">Applies to</span>
                        <span className="text-[11px] font-semibold text-slate-700">{draft.targetScope === 'all' ? 'All' : `${draft.targetIds.length} selected`}</span>
                      </div>
                    )}
                    {needsKeywords && (
                      <div className="flex items-center justify-between px-4 py-2.5">
                        <span className="text-[11px] text-slate-500">Keywords</span>
                        <span className="text-[11px] font-semibold text-slate-700">{draft.keywords.length ? draft.keywords.join(', ') : 'Any'}</span>
                      </div>
                    )}
                    {isComment ? (
                      <div className="flex items-center justify-between px-4 py-2.5">
                        <span className="text-[11px] text-slate-500">Actions</span>
                        <span className="text-[11px] font-semibold text-slate-700 text-right">
                          {[
                            'Opening DM + link DM',
                            draft.publicReplyEnabled && (draft.publicReplyConfig.aiEnabled ? 'AI public reply' : 'public reply'),
                            draft.askEmailEnabled && 'ask email',
                            draft.commentFollowGate.enabled && 'Follow-Gate',
                            draft.followUpEnabled && 'follow-up nudge',
                          ].filter(Boolean).join(' + ')}
                        </span>
                      </div>
                    ) : (
                      <div className="flex items-center justify-between px-4 py-2.5">
                        <span className="text-[11px] text-slate-500">Reply</span>
                        <span className="text-[11px] font-semibold text-slate-700">{draft.aiConfig.aiEnabled ? 'AI-generated' : 'Fixed message'}</span>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            <div className="md:sticky md:top-0">
              {previewPanel}
            </div>
          </div>
        </div>

        {/* footer */}
        <div className="flex items-center gap-2 p-5 border-t border-surface-border flex-shrink-0">
          {stepIdx > 0 && <button onClick={back} className="btn-secondary"><ChevronLeft size={13}/> Back</button>}
          <div className="flex-1"/>
          {stepName !== 'Review' ? (
            <button onClick={next} disabled={!stepValid()} className="btn-primary disabled:opacity-40 disabled:pointer-events-none">Continue <ChevronRight size={13}/></button>
          ) : (
            <>
              <button onClick={() => publish(false)} className="btn-secondary">Save as Draft</button>
              <button onClick={() => publish(true)} className="btn-primary"><Check size={13}/> Set Live</button>
            </>
          )}
        </div>
      </div>

      {confirmClose && (
        <div className="fixed inset-0 bg-slate-900/40 z-[60] flex items-center justify-center p-4" onMouseDown={e => { if (e.target === e.currentTarget) setConfirmClose(false) }}>
          <div className="bg-white rounded-2xl shadow-modal p-5 w-full max-w-xs">
            <p className="text-[13px] font-semibold text-slate-800 mb-1">Discard this automation?</p>
            <p className="text-[11px] text-slate-400 mb-4">Your changes haven't been saved yet.</p>
            <div className="flex gap-2">
              <button onClick={() => setConfirmClose(false)} className="btn-secondary flex-1 justify-center">Keep editing</button>
              <button onClick={onClose} className="flex-1 justify-center px-3 py-2 rounded-lg bg-red-500 text-white text-[11px] font-semibold hover:bg-red-600">Discard</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
