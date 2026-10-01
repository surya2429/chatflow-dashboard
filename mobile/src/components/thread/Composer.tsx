import { useRef, useState } from 'react'
import { ActivityIndicator, Image, Platform, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native'
import {
  AtSign, Bold, Camera, FaceSlightlySmiling, FileText, ImageIcon, Images, Italic, LayoutTemplate, Paperclip, RotateCcw, Send, X, Zap,
  type LucideIcon,
} from 'lucide-react-native'
import { CANNED, fillCanned } from '@/lib/canned'
import { errorMessage, type PickedFile } from '@/lib/api'
import {
  CAN_SEND_DOCUMENTS, cameraAvailable, docStyle, formatBytes, kindOfMime, pickDocument, pickMedia, PickerError, takePhoto,
} from '@/lib/attachments'
import { font, space, theme as t, type, useLayout } from '@/lib/theme'
import type { Attachment, Channel } from '@/lib/types'
import { Button, haptic, Sheet, Txt } from '../ui'

const EMOJI = ['😊', '👍', '🙏', '🎉', '✅', '❤️', '😂', '🔥', '👋', '🤝', '💯', '😅', '🙌', '⭐', '🤔', '👀']

export type ComposerMode = 'reply' | 'note'

type Draft = { file: PickedFile; status: 'uploading' | 'ready' | 'failed'; attachment?: Attachment; error?: string }

// The web dashboard's composer palette (slate + accent; amber for notes).
const C = {
  primary: '#0066FF', line: '#E2E8F0', field: '#F8FAFC', icon: '#94A3B8', ink: '#1E293B', muted: '#64748B', seg: '#F1F5F9',
  noteBg: '#FFFBEB', noteLine: '#FDE68A', noteInk: '#78350F', notePlaceholder: '#D6A94A',
}

/**
 * The reply area, laid out like the web dashboard's: a Reply / Private note
 * switch, then one rounded box with the tools, the text and Send. Files
 * upload the moment they're picked, so a wrong type or size is reported
 * straight away and Send is instant.
 */
export function Composer({
  mode, onModeChange, onSend, igReplyMode, onIgReplyMode, onTemplates, hint, channel, onUpload, onNotice, contactName,
}: {
  mode: ComposerMode
  onModeChange: (m: ComposerMode) => void
  onSend: (text: string, attachment?: Attachment) => void
  igReplyMode?: 'public' | 'private'
  onIgReplyMode?: (m: 'public' | 'private') => void
  onTemplates?: () => void
  hint?: string
  channel: Channel
  onUpload?: (file: PickedFile) => Promise<Attachment>
  onNotice?: (text: string) => void
  /** Fills {{name}} in canned replies. */
  contactName?: string
}) {
  const [text, setText] = useState('')
  const [cannedOpen, setCannedOpen] = useState(false)
  const selection = useRef({ start: 0, end: 0 })
  const [emoji, setEmoji] = useState(false)
  const [attachOpen, setAttachOpen] = useState(false)
  const [draft, setDraft] = useState<Draft | null>(null)
  const uploadSeq = useRef(0)
  const { isWide } = useLayout()
  const note = mode === 'note'
  // Notes are text-only, and a public comment reply on Instagram can't carry a file.
  const canAttach = !!onUpload && !note && !(channel === 'instagram' && igReplyMode === 'public')
  const uploading = draft?.status === 'uploading'
  const attachment = draft?.status === 'ready' && !note ? draft.attachment : undefined
  const canSend = !uploading && (!!text.trim() || !!attachment) && !(draft?.status === 'failed' && !text.trim())

  const upload = (file: PickedFile) => {
    if (!onUpload) return
    const seq = ++uploadSeq.current
    setDraft({ file, status: 'uploading' })
    onUpload(file)
      .then(a => { if (seq === uploadSeq.current) setDraft({ file, status: 'ready', attachment: a }) })
      .catch(err => { if (seq === uploadSeq.current) setDraft({ file, status: 'failed', error: errorMessage(err) }) })
  }

  const pickFrom = async (source: () => Promise<PickedFile | null>) => {
    setAttachOpen(false)
    try {
      const file = await source()
      if (file) upload(file)
    } catch (err) {
      onNotice?.(err instanceof PickerError ? err.message : 'Couldn’t open that — try again')
    }
  }

  const clearDraft = () => { uploadSeq.current++; setDraft(null) }

  const send = () => {
    if (!canSend) return
    haptic()
    onSend(text.trim(), attachment)
    setText('')
    setEmoji(false)
    if (attachment) setDraft(null)
  }

  // WhatsApp-style formatting: wrap the selection (or insert a pair at the cursor).
  const wrap = (marker: string) => {
    haptic()
    const { start, end } = selection.current
    const s = Math.min(start, text.length)
    const e = Math.min(Math.max(end, s), text.length)
    setText(text.slice(0, s) + marker + text.slice(s, e) + marker + text.slice(e))
  }
  const insertAt = (value: string) => {
    haptic()
    const s = Math.min(selection.current.start, text.length)
    setText(text.slice(0, s) + value + text.slice(s))
  }

  const guardAttach = (then: () => void) => {
    haptic()
    if (!canAttach) {
      onNotice?.(note ? 'Notes are text only' : 'Switch to “Private DM” to send a file')
      return
    }
    then()
  }

  return (
    <View style={[styles.wrap, isWide && styles.wrapWide]}>
      {/* Reply / Private note */}
      <View style={styles.top}>
        <View style={styles.seg}>
          {([['reply', 'Reply'], ['note', 'Private note']] as const).map(([k, label]) => {
            const on = mode === k
            return (
              <Pressable key={k} onPress={() => { haptic(); onModeChange(k) }} accessibilityRole="tab" aria-selected={on}
                accessibilityLabel={k === 'note' ? 'Private note mode' : 'Reply mode'} style={[styles.segItem, on && styles.segOn]}>
                <Txt style={[styles.segText, { color: on ? (k === 'note' ? '#B45309' : '#0F172A') : C.muted }]}>{label}</Txt>
              </Pressable>
            )
          })}
        </View>
        {!(!note && igReplyMode && onIgReplyMode) && (
          <View style={styles.format}>
            <FormatButton icon={Bold} label="Bold" onPress={() => wrap('*')} />
            <FormatButton icon={Italic} label="Italic" onPress={() => wrap('_')} />
            <FormatButton icon={AtSign} label="Mention" onPress={() => insertAt('@')} />
          </View>
        )}
        {!note && igReplyMode && onIgReplyMode && (
          <View style={styles.seg}>
            {(['public', 'private'] as const).map(m => {
              const on = igReplyMode === m
              return (
                <Pressable key={m} onPress={() => { haptic(); onIgReplyMode(m) }} accessibilityRole="button" aria-selected={on}
                  style={[styles.segItem, on && styles.segOn]}>
                  <Txt style={[styles.segText, { color: on ? t.channel.instagram : C.muted }]}>{m === 'public' ? 'Public' : 'Private DM'}</Txt>
                </Pressable>
              )
            })}
          </View>
        )}
      </View>

      {/* File being attached */}
      {draft && !note && (
        <View style={[styles.draft, draft.status === 'failed' && styles.draftFailed]}>
          <DraftThumb file={draft.file} />
          <View style={{ flex: 1, minWidth: 0 }}>
            <Txt v="smallMedium" color={C.ink} numberOfLines={1} style={{ fontFamily: font.semibold }}>{draft.file.name}</Txt>
            {draft.status === 'uploading' && (
              <View style={styles.draftStatus}><ActivityIndicator size="small" color={C.primary} /><Txt v="caption" color={C.muted}>Uploading…</Txt></View>
            )}
            {draft.status === 'ready' && <Txt v="caption" color={C.muted}>{draft.attachment ? formatBytes(draft.attachment.size) : ''} · Ready to send</Txt>}
            {draft.status === 'failed' && <Txt v="caption" color="#DC2626" numberOfLines={2}>{draft.error}</Txt>}
          </View>
          {draft.status === 'failed' && (
            <Pressable onPress={() => upload(draft.file)} hitSlop={6} accessibilityRole="button" accessibilityLabel="Retry upload" style={styles.draftBtn}>
              <RotateCcw size={14} color={C.muted} strokeWidth={2} />
            </Pressable>
          )}
          <Pressable onPress={clearDraft} hitSlop={6} accessibilityRole="button" accessibilityLabel="Remove attachment" style={styles.draftBtn}>
            <X size={14} color={C.muted} strokeWidth={2} />
          </Pressable>
        </View>
      )}

      {/* The box: tools · text · emoji · send */}
      <View style={[styles.box, note && styles.boxNote]}>
        <View style={styles.tools}>
          <Tool icon={Zap} label="Canned responses" active={cannedOpen} onPress={() => setCannedOpen(true)} />
          {onTemplates && !note && <Tool icon={FileText} label="Templates" onPress={onTemplates} />}
          {!note && <Tool icon={Paperclip} label="Attach a file" dim={!canAttach} onPress={() => guardAttach(() => setAttachOpen(true))} />}
          {!note && <Tool icon={ImageIcon} label="Send a photo" dim={!canAttach} onPress={() => guardAttach(() => { void pickFrom(pickMedia) })} />}
        </View>
        <TextInput
          value={text}
          onChangeText={setText}
          multiline
          numberOfLines={Platform.OS === 'web' ? 1 : undefined}
          placeholder={note ? 'Write a private note…' : attachment ? 'Add a caption…' : hint ?? 'Type a message…'}
          placeholderTextColor={note ? C.notePlaceholder : C.icon}
          style={[type.small, styles.input, { color: note ? C.noteInk : C.ink }, Platform.OS === 'web' && ({ outlineStyle: 'none' } as object)]}
          accessibilityLabel={note ? 'Private note' : 'Reply'}
          onSelectionChange={(e) => { selection.current = e.nativeEvent.selection }}
          maxLength={4096}
          onKeyPress={(e) => {
            // Desktop: Enter sends, Shift+Enter makes a new line.
            const ne = e.nativeEvent as unknown as { key: string; shiftKey?: boolean }
            if (Platform.OS === 'web' && isWide && ne.key === 'Enter' && !ne.shiftKey) { (e as unknown as { preventDefault: () => void }).preventDefault(); send() }
          }}
        />
        <View style={styles.tools}>
          <Tool icon={emoji ? X : FaceSlightlySmiling} label="Emoji" active={emoji} onPress={() => setEmoji(v => !v)} />
          <Pressable onPress={send} disabled={!canSend} accessibilityRole="button" accessibilityLabel={note ? 'Add note' : 'Send'}
            style={({ pressed }) => [styles.send, canSend && { backgroundColor: note ? '#D97706' : C.primary }, pressed && { opacity: 0.85 }]}>
            {uploading ? <ActivityIndicator size="small" color={C.icon} /> : <Send size={15} color={canSend ? '#FFFFFF' : '#CBD5E1'} strokeWidth={2.2} />}
          </Pressable>
        </View>
      </View>

      {emoji && (
        <ScrollView horizontal keyboardShouldPersistTaps="always" contentContainerStyle={styles.emojiRow} showsHorizontalScrollIndicator={false}>
          {EMOJI.map(e => (
            <Pressable key={e} onPress={() => setText(v => v + e)} accessibilityLabel={`Insert ${e}`} hitSlop={4} style={styles.emoji}>
              <Txt style={{ fontSize: 20, lineHeight: 25 }}>{e}</Txt>
            </Pressable>
          ))}
        </ScrollView>
      )}

      <Sheet visible={cannedOpen} onClose={() => setCannedOpen(false)} title="Canned responses" subtitle="Tap one to put it in the reply box" width={460}>
        {CANNED.map(c => (
          <Pressable key={c.key} onPress={() => { haptic(); setText(fillCanned(c.body, contactName)); setCannedOpen(false) }} accessibilityRole="button"
            style={(s) => [styles.canned, ((s as { hovered?: boolean }).hovered || s.pressed) && { backgroundColor: '#F8FAFC' }]}>
            <View style={styles.cannedIcon}><Zap size={14} color={C.primary} strokeWidth={2.2} /></View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Txt v="smallMedium" color={C.ink} style={{ fontFamily: font.semibold }}>{c.label}</Txt>
              <Txt v="caption" color={C.muted} numberOfLines={2} style={{ fontSize: 11, lineHeight: 15 }}>{fillCanned(c.body, contactName)}</Txt>
            </View>
          </Pressable>
        ))}
      </Sheet>

      <Sheet visible={attachOpen} onClose={() => setAttachOpen(false)} title="Attach" width={420}>
        <View style={styles.grid}>
          <AttachOption icon={Images} color="#7C3AED" label="Photos & videos" onPress={() => pickFrom(pickMedia)} />
          {cameraAvailable && <AttachOption icon={Camera} color="#E11D48" label="Camera" onPress={() => pickFrom(takePhoto)} />}
          {CAN_SEND_DOCUMENTS[channel] && <AttachOption icon={FileText} color="#2563EB" label="Document" onPress={() => pickFrom(pickDocument)} />}
          {onTemplates && <AttachOption icon={LayoutTemplate} color="#16A34A" label="Template" onPress={() => { setAttachOpen(false); onTemplates() }} />}
        </View>
        <Txt v="caption" color={t.textFaint} style={styles.gridHint}>
          {channel === 'whatsapp' ? 'WhatsApp: photos up to 5 MB, videos 16 MB, documents 100 MB'
            : channel === 'instagram' ? 'Instagram DMs take photos and videos, not documents'
              : 'Website chat: photos up to 10 MB, files up to 25 MB'}
        </Txt>
      </Sheet>
    </View>
  )
}

function FormatButton({ icon: Icon, label, onPress }: { icon: LucideIcon; label: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={label} hitSlop={4}
      style={(s) => [styles.formatBtn, ((s as { hovered?: boolean }).hovered || s.pressed) && { backgroundColor: C.seg }]}>
      <Icon size={14} color={C.icon} strokeWidth={2.2} />
    </Pressable>
  )
}

function Tool({ icon: Icon, label, onPress, active, dim }: { icon: LucideIcon; label: string; onPress: () => void; active?: boolean; dim?: boolean }) {
  return (
    <Pressable onPress={() => { haptic(); onPress() }} accessibilityRole="button" accessibilityLabel={label} hitSlop={2}
      style={(s) => [styles.tool, active && { backgroundColor: '#EFF4FF' }, dim && { opacity: 0.45 }, ((s as { hovered?: boolean }).hovered || s.pressed) && !active && { backgroundColor: C.seg }]}>
      <Icon size={17} color={active ? C.primary : C.icon} strokeWidth={1.9} />
    </Pressable>
  )
}

function DraftThumb({ file }: { file: PickedFile }) {
  const kind = kindOfMime(file.mime)
  if (kind === 'image') return <Image source={{ uri: file.uri }} style={styles.thumb} resizeMode="cover" />
  const doc = docStyle(file.name, file.mime)
  return (
    <View style={[styles.thumb, { backgroundColor: kind === 'video' ? '#0F172A' : kind === 'audio' ? '#7C3AED' : doc.color, alignItems: 'center', justifyContent: 'center' }]}>
      <Txt style={{ color: '#FFFFFF', fontFamily: font.bold, fontSize: 9 }}>{kind === 'video' ? 'VIDEO' : kind === 'audio' ? 'AUDIO' : doc.label}</Txt>
    </View>
  )
}

function AttachOption({ icon: Icon, color, label, onPress }: { icon: LucideIcon; color: string; label: string; onPress: () => void }) {
  return (
    <Pressable onPress={() => { haptic(); onPress() }} accessibilityRole="button" accessibilityLabel={label}
      style={({ pressed }) => [styles.option, pressed && { opacity: 0.7 }]}>
      <View style={[styles.optionIcon, { backgroundColor: color }]}><Icon size={20} color="#FFFFFF" strokeWidth={2} /></View>
      <Txt v="caption" color={t.textSoft} style={{ fontFamily: font.medium, textAlign: 'center', fontSize: 11 }}>{label}</Txt>
    </Pressable>
  )
}

/** Shown instead of the composer when the agent can't reply yet — says why, and offers the fix. */
export function ReplyDock({ icon: Icon, tone, title, body, primary, secondary }: {
  icon: LucideIcon
  tone: 'blue' | 'amber' | 'gray'
  title: string
  body?: string
  primary?: { label: string; icon?: LucideIcon; onPress: () => void; loading?: boolean }
  secondary?: { label: string; icon?: LucideIcon; onPress: () => void }
}) {
  const [bg, fg] = tone === 'blue' ? ['#EFF4FF', C.primary] : tone === 'amber' ? ['#FFFBEB', '#B45309'] : ['#F1F5F9', C.muted]
  const { isWide } = useLayout()
  return (
    <View style={[styles.wrap, isWide && styles.wrapWide]}>
      <View style={[styles.dock, isWide && { flexDirection: 'row', alignItems: 'center' }]}>
        <View style={styles.dockHead}>
          <View style={[styles.dockIcon, { backgroundColor: bg }]}><Icon size={15} color={fg} strokeWidth={2} /></View>
          <View style={{ flex: 1 }}>
            <Txt v="smallMedium" color="#0F172A" style={{ fontFamily: font.semibold }}>{title}</Txt>
            {body && <Txt v="caption" color={C.muted} style={{ fontSize: 11, lineHeight: 14 }}>{body}</Txt>}
          </View>
        </View>
        <View style={[styles.dockActions, isWide && { marginLeft: 'auto' }]}>
          {secondary && <Button title={secondary.label} icon={secondary.icon} kind="outline" size="sm" onPress={secondary.onPress} style={isWide ? undefined : { flex: 1 }} />}
          {primary && <Button title={primary.label} icon={primary.icon} size="sm" onPress={primary.onPress} loading={primary.loading} style={isWide ? undefined : { flex: 1 }} />}
        </View>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: { backgroundColor: '#FFFFFF', borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: C.line, paddingHorizontal: 10, paddingTop: 8, paddingBottom: 8, gap: 8 },
  wrapWide: { paddingHorizontal: space.md },
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  seg: { flexDirection: 'row', gap: 2, padding: 2, borderRadius: 8, backgroundColor: C.seg },
  segItem: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6 },
  segOn: { backgroundColor: '#FFFFFF', shadowColor: '#0F172A', shadowOpacity: 0.08, shadowRadius: 2, shadowOffset: { width: 0, height: 1 }, elevation: 1 },
  segText: { fontFamily: font.semibold, fontSize: 11, lineHeight: 14 },
  format: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  formatBtn: { width: 28, height: 26, borderRadius: 6, alignItems: 'center', justifyContent: 'center' },
  canned: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, paddingHorizontal: space.xl, paddingVertical: 10 },
  cannedIcon: { width: 30, height: 30, borderRadius: 8, backgroundColor: '#EFF4FF', alignItems: 'center', justifyContent: 'center' },
  box: {
    flexDirection: 'row', alignItems: 'flex-end', gap: 2, borderRadius: 12, borderWidth: 1, borderColor: C.line, backgroundColor: C.field,
    paddingHorizontal: 4, paddingVertical: 4,
  },
  boxNote: { backgroundColor: C.noteBg, borderColor: C.noteLine },
  tools: { flexDirection: 'row', alignItems: 'center', gap: 0 },
  tool: { width: 30, height: 30, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  input: { flex: 1, minHeight: 30, maxHeight: 112, paddingHorizontal: 4, paddingTop: 7, paddingBottom: 7 },
  send: { width: 32, height: 32, borderRadius: 8, alignItems: 'center', justifyContent: 'center', marginLeft: 2 },
  emojiRow: { gap: 2, paddingHorizontal: 2 },
  emoji: { padding: 4 },
  draft: {
    flexDirection: 'row', alignItems: 'center', gap: 10, padding: 7, borderRadius: 12, backgroundColor: C.field, borderWidth: 1, borderColor: C.line,
  },
  draftFailed: { backgroundColor: '#FEF2F2', borderColor: '#FECACA' },
  draftStatus: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  draftBtn: { width: 28, height: 28, borderRadius: 8, alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: C.line },
  thumb: { width: 40, height: 40, borderRadius: 8, backgroundColor: C.seg },
  grid: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: space.md, paddingTop: space.sm },
  option: { width: '25%', alignItems: 'center', gap: 7, paddingVertical: space.sm },
  optionIcon: { width: 50, height: 50, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  gridHint: { paddingHorizontal: space.xl, paddingTop: space.md, textAlign: 'center' },
  dock: { gap: 8 },
  dockHead: { flexDirection: 'row', alignItems: 'center', gap: 9, flexShrink: 1 },
  dockIcon: { width: 30, height: 30, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  dockActions: { flexDirection: 'row', gap: 8 },
})
