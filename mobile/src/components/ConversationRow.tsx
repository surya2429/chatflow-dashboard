import { memo, useRef } from 'react'
import { Platform, Pressable, StyleSheet, View } from 'react-native'
import Swipeable, { type SwipeableMethods } from 'react-native-gesture-handler/ReanimatedSwipeable'
import { Archive, Bot, CheckCheck, CircleCheck, Hourglass, MailOpen, Star, type LucideIcon } from 'lucide-react-native'
import { listTime } from '@/lib/format'
import { font, space, theme as t } from '@/lib/theme'
import type { Conversation } from '@/lib/types'
import { Avatar, haptic, identityText, Txt } from './ui'

function initials(name: string) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map(p => p[0]!.toUpperCase()).join('')
}

export interface RowActions {
  onResolve?: () => void
  onArchive?: () => void
  onStar?: () => void
  onMarkRead?: () => void
}

/**
 * A chat in the list — three quiet lines:
 *   1  who                                   when
 *   2  how to reach them  ·  which bot
 *   3  [state] what they said               unread | owner
 * On phones, swipe right to star / mark read, left to resolve / archive.
 */
export const ConversationRow = memo(function ConversationRow({ c, meId, onPress, onLongPress, showBot = true, selected, actions }: {
  c: Conversation; meId: string; onPress: () => void; onLongPress?: () => void; showBot?: boolean; selected?: boolean; actions?: RowActions
}) {
  const swipe = useRef<SwipeableMethods>(null)
  const unread = c.unread > 0
  const resolved = c.status === 'resolved'
  const idText = identityText(c.identity, c.channel)
  const showId = idText && idText !== c.name
  const second = [showId ? idText : null, showBot ? c.botName : null].filter(Boolean).join('  ·  ')
  const ownedByOther = c.status === 'agent' && c.agentId && c.agentId !== meId && c.agentName

  const row = (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress ? () => { haptic('warning'); onLongPress() } : undefined}
      delayLongPress={350}
      style={(s) => [styles.row, selected && styles.selected, !selected && ((s as { hovered?: boolean }).hovered || s.pressed) && { backgroundColor: t.surfaceHover }]}
      accessibilityRole="button"
      accessibilityLabel={`${c.name}, ${idText}, ${unread ? `${c.unread} unread, ` : ''}${c.lastMessage}`}
    >
      {selected && <View style={styles.bar} />}
      <Avatar label={c.avatar} seed={c.contactId} channel={c.channel} size={44} />
      <View style={styles.body}>
        <View style={styles.line}>
          <Txt v="subheading" numberOfLines={1} color={resolved ? t.textMuted : t.text}
            style={{ flex: 1, fontFamily: unread ? font.bold : font.semibold }}>{c.name}</Txt>
          {c.starred && <Star size={12} color="#F59E0B" fill="#F59E0B" strokeWidth={2} />}
          <Txt v="caption" color={unread ? t.primary : t.textFaint} style={{ fontFamily: unread ? font.semibold : font.medium, fontSize: 10 }}>
            {listTime(c.timestamp)}
          </Txt>
        </View>
        {!!second && <Txt v="caption" color={t.textMuted} numberOfLines={1} style={{ fontSize: 11, lineHeight: 15, marginTop: 1 }}>{second}</Txt>}
        <View style={[styles.line, { marginTop: 3 }]}>
          {c.waitingSince ? (
            <View style={styles.waiting}><Hourglass size={11} color={t.warning} strokeWidth={2.4} /><Txt v="caption" color={t.warning} style={{ fontFamily: font.semibold }}>Waiting</Txt></View>
          ) : c.status === 'bot' ? (
            <Bot size={13} color={t.status.bot} strokeWidth={2} />
          ) : resolved ? (
            <CheckCheck size={13} color={t.textFaint} strokeWidth={2} />
          ) : null}
          <Txt v="small" numberOfLines={1} color={unread ? t.textStrong : t.textMuted}
            style={{ flex: 1, fontFamily: unread ? font.medium : font.regular }}>
            {c.lastMessage || ' '}
          </Txt>
          {unread ? (
            <View style={styles.count}><Txt v="caption" color="#FFFFFF" style={{ fontFamily: font.bold, fontSize: 9.5 }}>{c.unread > 99 ? '99+' : c.unread}</Txt></View>
          ) : ownedByOther ? (
            <View style={styles.owner} accessibilityLabel={`Assigned to ${c.agentName}`}>
              <Txt v="caption" color={t.textSoft} style={{ fontSize: 9, fontFamily: font.bold }}>{initials(c.agentName!)}</Txt>
            </View>
          ) : null}
        </View>
      </View>
    </Pressable>
  )

  if (Platform.OS === 'web' || !actions) return row

  const act = (fn?: () => void) => () => { haptic('success'); swipe.current?.close(); fn?.() }
  return (
    <Swipeable
      ref={swipe}
      friction={1.6}
      overshootLeft={false}
      overshootRight={false}
      renderLeftActions={() => (
        <View style={styles.actions}>
          {actions.onMarkRead && unread && <SwipeAction icon={MailOpen} label="Read" color={t.primary} onPress={act(actions.onMarkRead)} />}
          {actions.onStar && <SwipeAction icon={Star} label={c.starred ? 'Unstar' : 'Star'} color="#F59E0B" onPress={act(actions.onStar)} />}
        </View>
      )}
      renderRightActions={() => (
        <View style={styles.actions}>
          {actions.onArchive && <SwipeAction icon={Archive} label={c.archived ? 'Inbox' : 'Archive'} color="#52525B" onPress={act(actions.onArchive)} />}
          {actions.onResolve && !resolved && <SwipeAction icon={CircleCheck} label="Resolve" color={t.successDot} onPress={act(actions.onResolve)} />}
        </View>
      )}
    >
      {row}
    </Swipeable>
  )
})

function SwipeAction({ icon: Icon, label, color, onPress }: { icon: LucideIcon; label: string; color: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={label} style={[styles.action, { backgroundColor: color }]}>
      <Icon size={20} color="#FFFFFF" strokeWidth={2} />
      <Txt v="caption" color="#FFFFFF" style={{ fontFamily: font.semibold }}>{label}</Txt>
    </Pressable>
  )
}

export function ConversationRowSkeleton() {
  return (
    <View style={styles.row}>
      <View style={[styles.skel, { width: 44, height: 44, borderRadius: 22 }]} />
      <View style={[styles.body, { gap: 8, paddingTop: 4 }]}>
        <View style={[styles.skel, { width: '55%', height: 12 }]} />
        <View style={[styles.skel, { width: '38%', height: 10 }]} />
        <View style={[styles.skel, { width: '78%', height: 10 }]} />
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 12, paddingHorizontal: space.lg, paddingVertical: 11,
    backgroundColor: t.surface, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: t.borderSoft,
  },
  selected: { backgroundColor: t.primarySoft },
  bar: { position: 'absolute', left: 0, top: 0, bottom: 0, width: 3, backgroundColor: t.primary },
  body: { flex: 1, minWidth: 0 },
  line: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  waiting: { flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 6, paddingVertical: 1, borderRadius: 999, backgroundColor: t.warningSoft },
  count: { minWidth: 19, height: 19, paddingHorizontal: 5, borderRadius: 10, backgroundColor: t.primary, alignItems: 'center', justifyContent: 'center' },
  owner: { width: 20, height: 20, borderRadius: 10, backgroundColor: t.surfaceSunken, alignItems: 'center', justifyContent: 'center' },
  actions: { flexDirection: 'row' },
  action: { width: 78, alignItems: 'center', justifyContent: 'center', gap: 4 },
  skel: { backgroundColor: t.surfaceSunken, borderRadius: 6 },
})
