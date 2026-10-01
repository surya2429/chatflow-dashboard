import { memo, useState } from 'react'
import { Image, Pressable, StyleSheet, View } from 'react-native'
import {
  ArrowLeftRight, AudioLines, Bot, Calendar, Check, CheckCheck, CircleAlert, CircleCheck, CircleHelp, Clock, CornerUpLeft, Download,
  Globe, Hash, Hourglass, ImageOff, Info, List, Lock, Mail, Phone, PhoneMissed, Play, Radio, RefreshCw, UserCheck, UserRound,
  type LucideIcon,
} from 'lucide-react-native'
import { fileUrl } from '@/lib/api'
import { docStyle, formatBytes } from '@/lib/attachments'
import { clockTime } from '@/lib/format'
import { font } from '@/lib/theme'
import type { Attachment, Message, TemplateSnapshot } from '@/lib/types'
import { Txt } from '../ui'

/**
 * Message styles follow the web dashboard's Conversations screen, so an agent
 * sees the same thread on desktop and phone: white customer bubbles with a
 * small avatar, blue for the bot, green for agents, amber private notes, grey
 * event pills.
 */
const C = {
  primary: '#0066FF',
  agent: '#10B981',
  ink: '#1E293B',
  inkSoft: '#334155',
  muted: '#64748B',
  faint: '#94A3B8',
  line: '#E2E8F0',
  pill: '#F1F5F9',
  noteBg: '#FFFBEB',
  noteLine: '#FDE68A',
  noteInk: '#78350F',
  noteLabel: '#D97706',
  noteTime: '#F59E0B',
}

const ANSWER_ICON: Record<string, LucideIcon> = {
  email: Mail, phone: Phone, short: UserRound, number: Hash, date: Calendar, choice: List,
}
const EVENT_ICON: Record<string, { icon: LucideIcon; color: string }> = {
  assigned: { icon: UserCheck, color: '#10B981' },
  bot_handover: { icon: Bot, color: C.primary },
  resolved: { icon: CircleCheck, color: '#10B981' },
  call_answered: { icon: Phone, color: '#10B981' },
  call_missed: { icon: PhoneMissed, color: '#F87171' },
  ctwa_entry: { icon: Globe, color: '#3B82F6' },
  broadcast: { icon: Radio, color: C.primary },
  waiting: { icon: Hourglass, color: '#F59E0B' },
  transferred: { icon: ArrowLeftRight, color: C.primary },
}

/** Who "spoke" — consecutive messages from the same voice are grouped. */
export function voiceOf(m: Message): string {
  if (m.type === 'outgoing' || m.type === 'template') return m.sender === 'Bot' ? 'bot' : `agent:${m.agentName ?? ''}`
  if (m.type === 'incoming' || m.type === 'answer') return 'customer'
  return m.type
}

function Ticks({ m, color }: { m: Message; color: string }) {
  if (m.local === 'sending' || m.delivery === 'pending') return <Clock size={10} color={color} strokeWidth={2.4} />
  if (m.local === 'failed' || m.delivery === 'failed') return <CircleAlert size={11} color="#FECACA" strokeWidth={2.4} />
  if (m.delivery === 'read') return <CheckCheck size={12} color="#BFDBFE" strokeWidth={2.6} />
  if (m.delivery === 'delivered') return <CheckCheck size={12} color={color} strokeWidth={2.4} />
  if (m.delivery === 'sent') return <Check size={12} color={color} strokeWidth={2.4} />
  return null
}

// ── Attachments ─────────────────────────────────────────────────────────────

const MEDIA_W = 220

function imageHeight(a: Attachment) {
  const ratio = a.width && a.height ? a.width / a.height : 4 / 3
  return Math.round(Math.min(Math.max(MEDIA_W / ratio, 110), 280))
}

function FileCard({ a, light, onOpen }: { a: Attachment; light: boolean; onOpen: () => void }) {
  const fg = light ? '#FFFFFF' : C.ink
  const sub = light ? 'rgba(255,255,255,0.8)' : C.muted
  if (a.kind === 'video') {
    return (
      <Pressable onPress={onOpen} accessibilityRole="button" accessibilityLabel={`Video ${a.name}. Play`} style={styles.video}>
        <View style={styles.play}><Play size={18} color="#FFFFFF" fill="#FFFFFF" strokeWidth={1.5} /></View>
        <View style={styles.videoFoot}>
          <Txt v="caption" color="#FFFFFF" numberOfLines={1} style={{ flex: 1 }}>{a.name}</Txt>
          <Txt v="caption" color="rgba(255,255,255,0.8)">{formatBytes(a.size)}</Txt>
        </View>
      </Pressable>
    )
  }
  const doc = docStyle(a.name, a.mime)
  const audio = a.kind === 'audio'
  return (
    <Pressable onPress={onOpen} accessibilityRole="button" accessibilityLabel={`${audio ? 'Audio' : 'File'} ${a.name}. Open`}
      style={[styles.file, { backgroundColor: light ? 'rgba(255,255,255,0.16)' : '#F8FAFC', borderColor: light ? 'rgba(255,255,255,0.22)' : C.line }]}>
      <View style={[styles.fileIcon, { backgroundColor: audio ? '#7C3AED' : doc.color }]}>
        {audio ? <AudioLines size={15} color="#FFFFFF" strokeWidth={2} /> : <Txt style={styles.fileBadge}>{doc.label}</Txt>}
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Txt v="smallMedium" color={fg} numberOfLines={1} style={{ fontFamily: font.semibold }}>{a.name}</Txt>
        <Txt v="caption" color={sub}>{audio ? 'Audio' : doc.label} · {formatBytes(a.size)}</Txt>
      </View>
      {audio ? <Play size={14} color={fg} strokeWidth={2} /> : <Download size={14} color={fg} strokeWidth={2} />}
    </Pressable>
  )
}

// ── Message ─────────────────────────────────────────────────────────────────

export const MessageBubble = memo(function MessageBubble({ m, first, myName, avatar, onRetry, onOpenAttachment }: {
  m: Message
  /** First in a run from the same voice: gets the avatar/label and extra spacing. */
  first: boolean
  myName: string
  /** The customer's initials, for the small avatar beside their messages. */
  avatar?: string
  onRetry?: (m: Message) => void
  onOpenAttachment?: (a: Attachment) => void
}) {
  const gap = { marginTop: first ? 8 : 3 }

  if (m.type === 'event') {
    const e = EVENT_ICON[m.event ?? ''] ?? { icon: Info, color: C.faint }
    return (
      <View style={styles.eventWrap} accessibilityRole="text">
        <View style={styles.event}>
          <e.icon size={11} color={e.color} strokeWidth={2.2} />
          <Txt v="caption" color={C.muted} style={{ flexShrink: 1, fontSize: 11 }} numberOfLines={2}>
            {m.text.replace(/^Conversation handed over/, 'Handed over')}
            <Txt v="caption" color={C.faint} style={{ fontSize: 10 }}>{`  ${clockTime(m.time)}`}</Txt>
          </Txt>
        </View>
      </View>
    )
  }

  if (m.type === 'note') {
    return (
      <View style={[styles.rowOut, gap]} accessibilityLabel={`Private note by ${m.sender}: ${m.text}`}>
        <View style={styles.noteLabel}>
          <Lock size={9} color={C.noteLabel} strokeWidth={2.6} />
          <Txt v="caption" color={C.noteLabel} style={{ fontSize: 10, fontFamily: font.medium }}>Private note · {m.sender}</Txt>
        </View>
        <View style={styles.note}>
          <Txt v="small" color={C.noteInk} selectable>{m.text}</Txt>
          <Txt v="caption" color={C.noteTime} style={styles.time}>{clockTime(m.time)}</Txt>
        </View>
      </View>
    )
  }

  if (m.type === 'answer') {
    const AnswerIcon = ANSWER_ICON[m.questionType ?? ''] ?? CircleHelp
    return (
      <View style={[styles.rowIn, gap]}>
        <View style={styles.avatarSlot}>{first && <View style={styles.avatar}><Txt style={styles.avatarText}>{(avatar ?? '?')[0]}</Txt></View>}</View>
        <View style={styles.answer}>
          <View style={styles.answerHead}>
            <AnswerIcon size={11} color="#059669" strokeWidth={2.4} />
            <Txt style={styles.answerLabel} numberOfLines={1}>{(m.label ?? 'Answer').toUpperCase()}</Txt>
          </View>
          <Txt v="small" color={C.ink} selectable style={{ fontFamily: font.medium }}>{m.value}</Txt>
          <Txt style={styles.answerTime}>{clockTime(m.time)}</Txt>
        </View>
      </View>
    )
  }

  if (m.type === 'template') {
    const tpl: TemplateSnapshot = m.template ?? { name: '' }
    return (
      <View style={[styles.rowOut, gap]}>
        <View style={styles.template}>
          <View style={styles.tplHead}>
            <Txt style={styles.tplTag}>TEMPLATE</Txt>
            {tpl.category ? <View style={styles.tplCat}><Txt style={styles.tplCatText}>{tpl.category}</Txt></View> : null}
          </View>
          {tpl.header ? <Txt v="smallMedium" color={C.ink} style={{ fontFamily: font.bold, paddingHorizontal: 12 }}>{tpl.header}</Txt> : null}
          <Txt v="small" color={C.inkSoft} selectable style={{ paddingHorizontal: 12, paddingBottom: 6 }}>{tpl.body ?? m.text}</Txt>
          {tpl.footer ? <Txt v="caption" color={C.faint} style={{ paddingHorizontal: 12, paddingBottom: 4 }}>{tpl.footer}</Txt> : null}
          {(tpl.buttons ?? []).map(b => (
            <View key={b} style={styles.tplButton}>
              <CornerUpLeft size={12} color={C.primary} strokeWidth={2.2} />
              <Txt v="smallMedium" color={C.primary} style={{ fontFamily: font.semibold }}>{b}</Txt>
            </View>
          ))}
          <View style={[styles.metaRow, { paddingHorizontal: 12, paddingBottom: 6, paddingTop: 4 }]}>
            <Txt v="caption" color={C.faint} style={{ fontSize: 10 }}>{clockTime(m.time)}</Txt>
            <Ticks m={m} color={C.faint} />
          </View>
        </View>
      </View>
    )
  }

  // ── Regular incoming / outgoing ───────────────────────────────────────────
  const incoming = m.type === 'incoming'
  const bot = !incoming && m.sender === 'Bot'
  const failed = m.local === 'failed' || m.delivery === 'failed'
  const igMode = m.event === 'ig_private_reply' ? 'Private reply' : m.event === 'ig_public_reply' ? 'Public reply' : null
  const who = bot ? 'Bot' : m.agentName && m.agentName !== myName ? m.agentName : 'You'
  const bg = incoming ? '#FFFFFF' : bot ? C.primary : C.agent
  const fg = incoming ? C.ink : '#FFFFFF'
  const timeColor = incoming ? C.faint : 'rgba(255,255,255,0.72)'
  const att = m.attachment
  const isImage = att?.kind === 'image'
  const open = () => { if (att) onOpenAttachment?.(att) }
  const corner = incoming ? { borderTopLeftRadius: first ? 4 : 16 } : { borderTopRightRadius: first ? 4 : 16 }

  const label = !incoming && first && (
    <View style={styles.inLabel}>
      {bot ? <Bot size={10} color="rgba(255,255,255,0.8)" strokeWidth={2.4} /> : <UserRound size={10} color="rgba(255,255,255,0.8)" strokeWidth={2.4} />}
      <Txt style={styles.inLabelText}>{[who, igMode].filter(Boolean).join(' · ')}</Txt>
    </View>
  )
  const meta = (
    <View style={styles.metaRow}>
      <Txt style={[styles.timeText, { color: timeColor }]}>{clockTime(m.time)}</Txt>
      {!incoming && !bot && <Ticks m={m} color={timeColor} />}
    </View>
  )

  const body = isImage ? (
    // Photos sit edge-to-edge: no coloured frame around them.
    <View style={[styles.mediaCard, corner, { backgroundColor: bg }, incoming && styles.shadow]}>
      <Pressable onPress={open} accessibilityRole="imagebutton" accessibilityLabel={`Photo ${att!.name}. Open`}>
        <PhotoView a={att!} />
        {!m.text && <View style={styles.photoMeta}>{meta}</View>}
      </Pressable>
      {!!m.text && (
        <View style={styles.mediaCaption}>
          {label}
          <Txt v="small" color={fg} selectable>{m.text}</Txt>
          {meta}
        </View>
      )}
    </View>
  ) : (
    <Pressable disabled={!failed || !onRetry} onPress={() => onRetry?.(m)}
      style={[styles.bubble, corner, { backgroundColor: bg }, incoming && styles.shadow, !!att && { paddingHorizontal: 6, paddingTop: 6 }]}
      accessibilityLabel={`${incoming ? m.sender ?? 'Customer' : who}: ${att ? `${att.kind} ${att.name}. ` : ''}${m.text}${failed ? '. Not sent, tap to retry' : ''}`}>
      {att ? <View style={{ paddingHorizontal: 6 }}>{label}</View> : label}
      {att && <FileCard a={att} light={!incoming} onOpen={open} />}
      {!!m.text && <Txt v="small" color={fg} selectable style={att ? { paddingHorizontal: 6, paddingTop: 6 } : undefined}>{m.text}</Txt>}
      <View style={att ? { paddingHorizontal: 6 } : undefined}>{meta}</View>
    </Pressable>
  )

  return (
    <View style={[incoming ? styles.rowIn : styles.rowOut, gap]}>
      {incoming && (
        <View style={styles.avatarSlot}>
          {first && <View style={styles.avatar}><Txt style={styles.avatarText}>{(avatar ?? m.sender ?? '?')[0]?.toUpperCase()}</Txt></View>}
        </View>
      )}
      <View style={{ maxWidth: '76%', alignItems: incoming ? 'flex-start' : 'flex-end' }}>
        {body}
        {failed && (
          <Pressable onPress={() => onRetry?.(m)} style={styles.failed} accessibilityRole="button">
            <RefreshCw size={10} color="#DC2626" strokeWidth={2.4} />
            <Txt v="caption" color="#DC2626">Not sent · Tap to retry</Txt>
          </Pressable>
        )}
      </View>
    </View>
  )
})

function PhotoView({ a }: { a: Attachment }) {
  const [failed, setFailed] = useState(false)
  const h = imageHeight(a)
  if (failed) {
    return <View style={[styles.photoFailed, { height: h }]}><ImageOff size={20} color={C.faint} strokeWidth={1.8} /><Txt v="caption" color={C.muted}>Image unavailable</Txt></View>
  }
  return <Image source={{ uri: fileUrl(a.url) }} style={{ width: MEDIA_W, height: h, backgroundColor: C.pill }} resizeMode="cover" onError={() => setFailed(true)} />
}

const styles = StyleSheet.create({
  rowIn: { flexDirection: 'row', alignItems: 'flex-end', gap: 6, paddingHorizontal: 12 },
  rowOut: { alignItems: 'flex-end', paddingHorizontal: 12 },
  avatarSlot: { width: 22, alignSelf: 'flex-start' },
  avatar: { width: 22, height: 22, borderRadius: 11, backgroundColor: C.faint, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: '#FFFFFF', fontFamily: font.bold, fontSize: 10, lineHeight: 12 },
  bubble: { maxWidth: '100%', paddingHorizontal: 11, paddingTop: 7, paddingBottom: 5, borderRadius: 16 },
  shadow: { shadowColor: '#0F172A', shadowOpacity: 0.06, shadowRadius: 3, shadowOffset: { width: 0, height: 1 }, elevation: 1 },
  inLabel: { flexDirection: 'row', alignItems: 'center', gap: 3, marginBottom: 2 },
  inLabelText: { color: 'rgba(255,255,255,0.8)', fontFamily: font.medium, fontSize: 9.5, lineHeight: 12 },
  metaRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 3, marginTop: 2 },
  timeText: { fontFamily: font.regular, fontSize: 9.5, lineHeight: 12 },
  time: { textAlign: 'right', fontSize: 9.5, marginTop: 3 },
  failed: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 3, paddingHorizontal: 4 },
  eventWrap: { alignItems: 'center', marginVertical: 8, paddingHorizontal: 20 },
  event: {
    flexDirection: 'row', alignItems: 'center', gap: 6, maxWidth: '100%', paddingHorizontal: 10, paddingVertical: 4,
    borderRadius: 14, backgroundColor: C.pill, borderWidth: StyleSheet.hairlineWidth, borderColor: C.line,
  },
  noteLabel: { flexDirection: 'row', alignItems: 'center', gap: 3, marginBottom: 2, paddingRight: 2 },
  note: {
    maxWidth: '76%', paddingHorizontal: 11, paddingTop: 7, paddingBottom: 5, borderRadius: 16, borderTopRightRadius: 4,
    backgroundColor: C.noteBg, borderWidth: 1, borderColor: C.noteLine,
  },
  answer: {
    maxWidth: '76%', gap: 2, paddingHorizontal: 11, paddingTop: 7, paddingBottom: 6, borderRadius: 16, borderTopLeftRadius: 4,
    backgroundColor: '#F0FDF4', borderWidth: 1, borderColor: '#BBF7D0',
  },
  answerHead: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  answerLabel: { color: '#059669', fontFamily: font.bold, fontSize: 9.5, lineHeight: 12, letterSpacing: 0.4, flexShrink: 1 },
  answerTime: { color: '#10B981', fontFamily: font.regular, fontSize: 9.5, lineHeight: 12, marginTop: 1 },
  template: { maxWidth: '80%', borderRadius: 16, borderWidth: 1, borderColor: C.line, backgroundColor: '#FFFFFF', overflow: 'hidden' },
  tplHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, paddingHorizontal: 12, paddingTop: 8, paddingBottom: 4 },
  tplTag: { color: C.faint, fontFamily: font.bold, fontSize: 9, letterSpacing: 0.8 },
  tplCat: { paddingHorizontal: 6, paddingVertical: 1, borderRadius: 99, backgroundColor: '#EFF4FF', borderWidth: 1, borderColor: '#DCE8FF' },
  tplCatText: { color: C.primary, fontFamily: font.medium, fontSize: 9 },
  tplButton: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, paddingVertical: 8,
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: C.line,
  },
  mediaCard: { width: MEDIA_W, borderRadius: 16, overflow: 'hidden' },
  mediaCaption: { paddingHorizontal: 10, paddingTop: 6, paddingBottom: 5 },
  photoMeta: {
    position: 'absolute', right: 6, bottom: 6, paddingHorizontal: 6, paddingVertical: 1, borderRadius: 99, backgroundColor: 'rgba(15,23,42,0.5)',
  },
  photoFailed: { width: MEDIA_W, alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: C.pill },
  video: { width: MEDIA_W, height: 136, borderRadius: 12, backgroundColor: '#0F172A', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  play: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.22)', alignItems: 'center', justifyContent: 'center', paddingLeft: 3 },
  videoFoot: {
    position: 'absolute', left: 0, right: 0, bottom: 0, flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 10, paddingVertical: 5, backgroundColor: 'rgba(0,0,0,0.35)',
  },
  file: { flexDirection: 'row', alignItems: 'center', gap: 9, padding: 8, borderRadius: 12, borderWidth: 1, width: 230, maxWidth: '100%' },
  fileIcon: { width: 32, height: 38, borderRadius: 7, alignItems: 'center', justifyContent: 'center' },
  fileBadge: { color: '#FFFFFF', fontFamily: font.bold, fontSize: 9, letterSpacing: 0.3 },
})
