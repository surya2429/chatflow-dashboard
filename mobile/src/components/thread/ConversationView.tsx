import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { ActivityIndicator, FlatList, KeyboardAvoidingView, Linking, Platform, Pressable, StyleSheet, View } from 'react-native'
import { router, useFocusEffect } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { randomUUID } from 'expo-crypto'
import {
  Archive, ArrowLeftRight, BellOff, Bot, ChevronDown, ChevronLeft, CircleCheck, CircleUserRound, Clock, Ellipsis, FileText, Globe, Hand,
  Hourglass, Lock, MessagesSquare, PanelRight, Phone, RotateCcw, Star, Tags, UserRound, Video,
} from 'lucide-react-native'
import { ApiError, api, errorMessage, fileUrl } from '@/lib/api'
import { useUser } from '@/lib/auth'
import { dayLabel, sameDay, windowRemaining } from '@/lib/format'
import { can } from '@/lib/session'
import { getState, store, useStore } from '@/lib/store'
import { font, radius, shadow, space, theme as t, useLayout } from '@/lib/theme'
import type { Attachment, Conversation, Message } from '@/lib/types'
import { dismissFor } from '@/push/push'
import { useCalls } from '@/calls/CallManager'
import {
  Avatar, Badge, Button, EmptyState, haptic, IconButton, IdentityIcon, identityText, Sheet, SheetRow, Skeleton, Toast, Txt, type Tone,
} from '../ui'
import { MessageBubble, voiceOf } from './MessageBubble'
import { Composer, ReplyDock, type ComposerMode } from './Composer'
import { ImageViewer } from './ImageViewer'
import { LabelSheet, SnoozeSheet, TransferSheet } from './Pickers'
import { TemplatePicker } from './TemplatePicker'

type Row = { kind: 'day'; key: string; label: string } | { kind: 'msg'; key: string; m: Message; first: boolean }
type SheetName = 'actions' | 'transfer' | 'labels' | 'snooze' | 'template' | null

const IG_KIND: Record<string, string> = { dm: 'Direct message', comment: 'Comment', story: 'Story reply' }

/**
 * One conversation: header, status strip, thread and the reply area.
 * Full-screen on phones; the middle pane on tablets/desktop.
 */
export function ConversationView({ id, embedded, detailsOpen, onToggleDetails }: {
  id: string; embedded?: boolean; detailsOpen?: boolean; onToggleDetails?: () => void
}) {
  const me = useUser()
  const insets = useSafeAreaInsets()
  const { isWide } = useLayout()
  const calls = useCalls()
  const conv = useStore(s => s.conversations[id])
  const thread = useStore(s => s.threads[id])
  const [mode, setMode] = useState<ComposerMode>('reply')
  const [igReplyMode, setIgReplyMode] = useState<'public' | 'private'>('public')
  const [sheet, setSheet] = useState<SheetName>(null)
  const [toast, setToast] = useState<{ text: string; tone: 'danger' | 'success' | 'neutral' } | null>(null)
  const [loadingOlder, setLoadingOlder] = useState(false)
  const [busy, setBusy] = useState(false)
  const [noteOverride, setNoteOverride] = useState(false)
  const [viewing, setViewing] = useState<Attachment | null>(null)
  const [scrolledUp, setScrolledUp] = useState(false)
  const list = useRef<FlatList<Row>>(null)

  const flash = useCallback((text: string, tone: 'danger' | 'success' | 'neutral' = 'danger') => {
    if (tone === 'success') haptic('success')
    setToast({ text, tone })
  }, [])

  // (Mode and note state start fresh per chat: callers key this view by id.)
  useEffect(() => {
    if (!getState().conversations[id]) api.conversation(id).then(c => store.upsertConversations([c])).catch(err => flash(errorMessage(err)))
    if (!getState().threads[id]?.loaded) {
      api.messages(id).then(p => store.setThread(id, p, 'replace')).catch(err => flash(errorMessage(err)))
    }
  }, [id, flash])

  useFocusEffect(useCallback(() => {
    store.setActiveConversation(id)
    void dismissFor(id)
    return () => { if (getState().activeConversationId === id) store.setActiveConversation(null) }
  }, [id]))

  const unread = conv?.unread ?? 0
  const isActive = useStore(s => s.activeConversationId === id)
  useEffect(() => {
    if (unread > 0 && isActive) {
      store.patchConversationLocally(id, { unread: 0 })
      api.markRead(id).then(c => store.upsertConversations([c])).catch(() => {})
    }
  }, [unread, id, isActive])

  const loadOlder = async () => {
    const firstMsg = thread?.items.find(m => !m.local)
    if (!thread?.hasMore || !firstMsg || loadingOlder) return
    setLoadingOlder(true)
    try { store.setThread(id, await api.messages(id, firstMsg.id), 'prepend') } catch { /* retried on next scroll */ } finally { setLoadingOlder(false) }
  }

  const canOverride = can('conversation.override_owner')
  const ownedByOther = !!conv && conv.status === 'agent' && !!conv.agentId && conv.agentId !== me.id
  const blocked = ownedByOther && !canOverride
  const windowClosed = conv?.channel === 'whatsapp' && conv.whatsappWindow && !conv.whatsappWindow.open
  const canReply = !!conv && conv.status === 'agent' && !blocked && !windowClosed
  const igComment = conv?.channel === 'instagram' && conv.source === 'comment'

  const rows = useMemo<Row[]>(() => {
    const out: Row[] = []
    const items = thread?.items ?? []
    items.forEach((m, i) => {
      const prev = items[i - 1]
      const newDay = i === 0 || !sameDay(prev!.time, m.time)
      if (newDay) out.push({ kind: 'day', key: `d-${m.time}`, label: dayLabel(m.time) })
      const first = newDay || !prev || voiceOf(prev) !== voiceOf(m) || new Date(m.time).getTime() - new Date(prev.time).getTime() > 5 * 60_000
      out.push({ kind: 'msg', key: m.id, m, first })
    })
    return out.reverse()
  }, [thread?.items])

  const suggestions = useMemo(() => {
    const s = new Set<string>()
    for (const c of Object.values(getState().conversations)) c.labels.forEach(l => s.add(l))
    return [...s].sort()
  }, [conv?.labels]) // eslint-disable-line react-hooks/exhaustive-deps

  const act = useCallback(async (fn: () => Promise<Conversation>, done?: string) => {
    setBusy(true)
    try {
      store.upsertConversations([await fn()])
      if (done) flash(done, 'success')
    } catch (err) {
      flash(errorMessage(err))
    } finally {
      setBusy(false)
    }
  }, [flash])

  const send = async (text: string, attachment?: Attachment, clientMsgId = randomUUID()) => {
    if (!conv) return
    if (mode === 'note' || !canReply) {
      try { store.upsertMessage(await api.note(id, text)) } catch (err) { flash(errorMessage(err)) }
      return
    }
    store.upsertMessage({
      id: `local-${clientMsgId}`, conversationId: id, type: 'outgoing', text, time: new Date().toISOString(),
      sender: 'Agent', agentName: me.name, clientMsgId, local: 'sending', ...(attachment && { attachment }),
    })
    list.current?.scrollToOffset({ offset: 0, animated: true })
    try {
      const sent = await api.send(id, {
        text, clientMsgId, ...(igComment && { igReplyMode }), ...(attachment && { attachmentId: attachment.id }),
      })
      store.upsertMessage(sent)
    } catch (err) {
      if (err instanceof ApiError && err.code === 'whatsapp_window_closed') {
        store.removeLocal(id, clientMsgId)
        flash('The 24-hour window has closed — send a template to restart the chat.')
        setSheet('template')
      } else if (err instanceof ApiError && err.status < 500) {
        store.removeLocal(id, clientMsgId)
        flash(err.message)
      } else {
        store.markLocalFailed(id, clientMsgId)
      }
    }
  }

  const retry = (m: Message) => {
    if (!m.clientMsgId) return
    store.upsertMessage({ ...m, local: 'sending' })
    api.send(id, {
      text: m.text, clientMsgId: m.clientMsgId, ...(igComment && { igReplyMode }), ...(m.attachment && { attachmentId: m.attachment.id }),
    })
      .then(sent => store.upsertMessage(sent))
      .catch(() => store.markLocalFailed(id, m.clientMsgId!))
  }

  const openAttachment = useCallback((a: Attachment) => {
    if (a.kind === 'image') setViewing(a)
    else void Linking.openURL(fileUrl(a.url))
  }, [])

  const openContact = () => {
    if (!conv) return
    if (onToggleDetails) onToggleDetails()
    else router.push({ pathname: '/contact/[id]', params: { id: conv.contactId } })
  }

  if (!conv) {
    return (
      <View style={[styles.fill, { paddingTop: embedded ? 0 : insets.top }]}>
        <View style={styles.header}>
          {!embedded && <IconButton icon={ChevronLeft} label="Back" onPress={() => router.back()} size={24} />}
          <Skeleton w={38} h={38} r={19} />
          <View style={{ gap: 6 }}><Skeleton w={140} h={12} /><Skeleton w={90} h={10} /></View>
        </View>
        <ActivityIndicator style={{ marginTop: 40 }} color={t.primary} />
      </View>
    )
  }

  const idText = identityText(conv.identity, conv.channel)
  const subtitle = idText && idText !== conv.name ? idText : conv.channel === 'webchat' ? 'Anonymous visitor' : ''
  const status: { text: string; tone: Tone } =
    conv.waitingSince ? { text: 'Waiting', tone: 'amber' }
      : conv.status === 'bot' ? { text: 'Bot', tone: 'blue' }
        : conv.status === 'resolved' ? { text: 'Resolved', tone: 'gray' }
          : conv.agentId === me.id ? { text: 'You', tone: 'green' }
            : { text: conv.agentName?.split(' ')[0] ?? 'Agent', tone: 'green' }
  const context =
    conv.channel === 'whatsapp' && conv.whatsappWindow
      ? { icon: Clock, text: conv.whatsappWindow.open ? windowRemaining(conv.whatsappWindow.expiresAt) : 'Window closed', warn: !conv.whatsappWindow.open }
      : conv.channel === 'instagram' ? { icon: MessagesSquare, text: IG_KIND[conv.source] ?? 'Instagram', warn: false }
        : conv.visitor?.page ? { icon: Globe, text: conv.visitor.page, warn: false } : null
  const callable = conv.channel === 'webchat' && can('call.place') && !blocked

  const replyHint =
    conv.channel === 'instagram' && conv.source === 'story' ? 'Reply goes to their DMs'
      : igComment ? (igReplyMode === 'public' ? 'Public reply under their comment' : 'Private DM (one per comment)')
        : undefined

  const composer = (forceNote = false) => (
    <Composer
      mode={forceNote ? 'note' : mode}
      onModeChange={(m) => { if (forceNote && m === 'reply') { setNoteOverride(false); return } setMode(m) }}
      onSend={(text, attachment) => { void send(text, attachment) }}
      igReplyMode={igComment ? igReplyMode : undefined}
      onIgReplyMode={setIgReplyMode}
      onTemplates={conv.channel === 'whatsapp' ? () => setSheet('template') : undefined}
      hint={replyHint}
      channel={conv.channel}
      onUpload={forceNote ? undefined : (file) => api.uploadAttachment(id, file)}
      onNotice={(text) => flash(text, 'neutral')}
      contactName={conv.name}
    />
  )

  let bottom: ReactNode
  if (canReply) bottom = composer()
  else if (noteOverride) bottom = composer(true)
  else if (conv.status === 'bot') {
    bottom = <ReplyDock icon={conv.waitingSince ? Hourglass : Bot} tone={conv.waitingSince ? 'amber' : 'blue'}
      title={conv.waitingSince ? 'Customer is waiting for an agent' : 'The bot is handling this chat'}
      body="Take over to reply yourself — the bot stops answering."
      secondary={{ label: 'Add note', icon: Lock, onPress: () => setNoteOverride(true) }}
      primary={{ label: 'Take over', icon: Hand, loading: busy, onPress: () => act(() => api.takeover(id), 'You’re now handling this chat') }} />
  } else if (conv.status === 'resolved') {
    bottom = <ReplyDock icon={CircleCheck} tone="gray" title="This chat is resolved" body="Reopen it to reply to the customer."
      secondary={{ label: 'Add note', icon: Lock, onPress: () => setNoteOverride(true) }}
      primary={{ label: 'Reopen', icon: RotateCcw, loading: busy, onPress: () => act(() => api.takeover(id), 'Reopened') }} />
  } else if (blocked) {
    bottom = <ReplyDock icon={UserRound} tone="gray" title={`Assigned to ${conv.agentName}`} body="Only they or a supervisor can reply. You can still leave a note."
      primary={{ label: 'Add a note', icon: Lock, onPress: () => setNoteOverride(true) }} />
  } else if (windowClosed) {
    bottom = <ReplyDock icon={Clock} tone="amber" title="24-hour window closed"
      body="WhatsApp only allows an approved template until the customer replies."
      secondary={{ label: 'Add note', icon: Lock, onPress: () => setNoteOverride(true) }}
      primary={{ label: 'Send template', icon: FileText, onPress: () => setSheet('template') }} />
  } else bottom = composer()

  return (
    <KeyboardAvoidingView style={styles.fill} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={[styles.headerWrap, { paddingTop: embedded ? 0 : insets.top }]}>
        <View style={[styles.header, isWide && styles.headerWide]}>
          {!embedded && <IconButton icon={ChevronLeft} label="Back" onPress={() => router.back()} size={22} box={32} />}
          <Pressable onPress={openContact} style={styles.who} accessibilityRole="button" accessibilityLabel={`${conv.name}, customer details`}>
            <Avatar label={conv.avatar} seed={conv.contactId} size={34} channel={conv.channel} solid={t.primary} />
            <View style={{ flex: 1, minWidth: 0 }}>
              <View style={styles.nameRow}>
                <Txt numberOfLines={1} style={styles.name}>{conv.name}</Txt>
                <Badge label={status.text} tone={status.tone} />
              </View>
              <View style={styles.subline}>
                <IdentityIcon identity={conv.identity} channel={conv.channel} size={10} color="#94A3B8" />
                <Txt numberOfLines={1} style={styles.sub}>
                  {[subtitle || null, conv.botName, context?.text].filter(Boolean).join('  ·  ')}
                </Txt>
              </View>
            </View>
          </Pressable>
          {isWide && conv.status === 'bot' && !blocked && (
            <Button title="Take over" icon={Hand} size="sm" loading={busy} onPress={() => act(() => api.takeover(id), 'You’re now handling this chat')} />
          )}
          {callable && <IconButton icon={Phone} label="Voice call" onPress={() => calls.placeCall(conv, false)} size={17} box={32} color="#94A3B8" />}
          {callable && isWide && <IconButton icon={Video} label="Video call" onPress={() => calls.placeCall(conv, true)} size={18} box={32} color="#94A3B8" />}
          {onToggleDetails && <IconButton icon={PanelRight} label={detailsOpen ? 'Hide details' : 'Show details'} active={detailsOpen} onPress={onToggleDetails} size={17} box={32} />}
          <IconButton icon={Ellipsis} label="Conversation actions" onPress={() => setSheet('actions')} size={18} box={32} color="#94A3B8" />
        </View>
      </View>

      <View style={styles.fill}>
        <FlatList
          ref={list}
          data={rows}
          inverted
          keyExtractor={r => r.key}
          renderItem={({ item }) => item.kind === 'day'
            ? <View style={styles.dayWrap}><View style={styles.day}><Txt v="caption" color="#64748B" style={{ fontFamily: font.semibold, fontSize: 10.5 }}>{item.label}</Txt></View></View>
            : <MessageBubble m={item.m} first={item.first} myName={me.name} avatar={conv.avatar} onRetry={retry} onOpenAttachment={openAttachment} />}
          onEndReached={loadOlder}
          onEndReachedThreshold={0.3}
          onScroll={(e) => {
            const up = e.nativeEvent.contentOffset.y > 320
            if (up !== scrolledUp) setScrolledUp(up)
          }}
          scrollEventThrottle={100}
          showsVerticalScrollIndicator={isWide}
          contentContainerStyle={[{ paddingTop: space.md, paddingBottom: space.sm }, isWide && { paddingHorizontal: space.lg }]}
          ListFooterComponent={loadingOlder || !thread?.loaded ? <ActivityIndicator style={{ margin: space.lg }} color={t.primary} /> : null}
          ListEmptyComponent={thread?.loaded ? <View style={{ transform: [{ scaleY: -1 }] }}><EmptyState icon={MessagesSquare} title="No messages yet" /></View> : null}
          keyboardDismissMode="interactive"
          keyboardShouldPersistTaps="handled"
        />
        {scrolledUp && (
          <Pressable onPress={() => { haptic(); list.current?.scrollToOffset({ offset: 0, animated: true }) }} accessibilityRole="button" accessibilityLabel="Jump to latest"
            style={({ pressed }) => [styles.jump, pressed && { transform: [{ scale: 0.94 }] }]}>
            <ChevronDown size={20} color={t.textSoft} strokeWidth={2.2} />
          </Pressable>
        )}
        <Toast text={toast?.text ?? null} tone={toast?.tone} onHide={() => setToast(null)} />
      </View>

      <View style={{ paddingBottom: embedded ? 0 : insets.bottom, backgroundColor: isWide ? t.chatBg : t.surface }}>{bottom}</View>

      <Sheet visible={sheet === 'actions'} onClose={() => setSheet(null)} title={conv.name} subtitle={[idText, conv.botName].filter(Boolean).join(' · ')}>
        {!(conv.status === 'agent' && conv.agentId === me.id) && (
          <SheetRow icon={Hand} iconBg={t.primarySoft} iconColor={t.primary} label={conv.status === 'resolved' ? 'Reopen & take over' : 'Take over'} disabled={blocked}
            onPress={() => { setSheet(null); void act(() => api.takeover(id), 'You’re now handling this chat') }} />
        )}
        {callable && !isWide && <SheetRow icon={Video} label="Video call" onPress={() => { setSheet(null); calls.placeCall(conv, true) }} />}
        <SheetRow icon={ArrowLeftRight} label={conv.agentId ? 'Transfer to…' : 'Assign to…'} detail={conv.agentName ? `Now: ${conv.agentName}` : 'Unassigned'} disabled={blocked} onPress={() => setSheet('transfer')} />
        {conv.channel === 'whatsapp' && <SheetRow icon={FileText} label="Send a template" disabled={blocked} onPress={() => setSheet('template')} />}
        <SheetRow icon={Tags} label="Labels" detail={conv.labels.map(l => `#${l}`).join('  ') || 'None'} onPress={() => setSheet('labels')} />
        <SheetRow icon={Star} iconColor={conv.starred ? '#F59E0B' : undefined} label={conv.starred ? 'Remove star' : 'Star'} onPress={() => {
          setSheet(null)
          store.patchConversationLocally(id, { starred: !conv.starred })
          void act(() => api.star(id, !conv.starred))
        }} />
        <SheetRow icon={BellOff} label={conv.snoozed ? 'Change snooze' : 'Snooze'} disabled={blocked} onPress={() => setSheet('snooze')} />
        {conv.status !== 'bot' && <SheetRow icon={Bot} label="Hand back to bot" disabled={blocked} onPress={() => { setSheet(null); void act(() => api.returnToBot(id), 'Handed back to the bot') }} />}
        <SheetRow icon={Archive} label={conv.archived ? 'Move to inbox' : 'Archive'} disabled={blocked} onPress={() => {
          setSheet(null)
          void act(() => api.archive(id, !conv.archived), conv.archived ? 'Moved back to the inbox' : 'Archived')
        }} />
        {!onToggleDetails && <SheetRow icon={CircleUserRound} label="Customer details" onPress={() => { setSheet(null); openContact() }} />}
        {conv.status !== 'resolved' && (
          <SheetRow icon={CircleCheck} iconBg={t.successSoft} iconColor={t.success} label="Mark as resolved" disabled={blocked}
            onPress={() => { setSheet(null); void act(() => api.resolve(id), 'Marked as resolved') }} />
        )}
      </Sheet>

      <TransferSheet visible={sheet === 'transfer'} conversation={conv} meId={me.id} onClose={() => setSheet(null)}
        onPick={(userId) => act(() => api.transfer(id, userId), userId === me.id ? 'Assigned to you' : 'Transferred')} />
      <LabelSheet visible={sheet === 'labels'} conversation={conv} suggestions={suggestions} onClose={() => setSheet(null)}
        onAdd={(l) => act(() => api.addLabel(id, l))} onRemove={(l) => act(() => api.removeLabel(id, l))} />
      <SnoozeSheet visible={sheet === 'snooze'} conversation={conv} onClose={() => setSheet(null)}
        onPick={(until) => act(() => api.snooze(id, until?.toISOString() ?? null), until ? 'Snoozed' : 'Unsnoozed')} />
      <TemplatePicker visible={sheet === 'template'} onClose={() => setSheet(null)} contactName={conv.name}
        onSend={async (tpl, variables) => {
          store.upsertMessage(await api.sendTemplate(id, { templateId: tpl.id, variables, clientMsgId: randomUUID() }))
          flash('Template sent', 'success')
        }} />
      <ImageViewer attachment={viewing} onClose={() => setViewing(null)} />
    </KeyboardAvoidingView>
  )
}

export function NoConversationSelected() {
  return (
    <View style={[styles.fill, { alignItems: 'center', justifyContent: 'center' }]}>
      <EmptyState icon={MessagesSquare} title="Select a conversation" body="Pick a chat from the list to read and reply. New messages appear live." />
    </View>
  )
}

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: '#F0F4F8' },
  headerWrap: { backgroundColor: t.surface, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: t.border, zIndex: 2 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 2, paddingHorizontal: space.xs, paddingVertical: 7, minHeight: 52 },
  headerWide: { height: 56, paddingHorizontal: space.md, gap: 4 },
  who: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 9, paddingHorizontal: 4, minWidth: 0 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 6, minWidth: 0 },
  name: { flexShrink: 1, fontFamily: font.semibold, fontSize: 13.5, lineHeight: 17, color: '#0F172A' },
  subline: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
  sub: { flexShrink: 1, fontFamily: font.regular, fontSize: 11, lineHeight: 14, color: '#94A3B8' },
  dayWrap: { alignItems: 'center', marginVertical: 12 },
  day: {
    paddingHorizontal: 10, paddingVertical: 2, borderRadius: radius.pill, backgroundColor: '#FFFFFF',
    borderWidth: StyleSheet.hairlineWidth, borderColor: '#E2E8F0',
  },
  jump: {
    position: 'absolute', right: space.md, bottom: space.md, width: 38, height: 38, borderRadius: 19, backgroundColor: t.surface,
    alignItems: 'center', justifyContent: 'center', borderWidth: StyleSheet.hairlineWidth, borderColor: t.border, ...shadow.floating,
  },
})
