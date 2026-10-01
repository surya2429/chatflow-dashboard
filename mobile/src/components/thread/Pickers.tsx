import { useState } from 'react'
import { Platform, Pressable, StyleSheet, TextInput, View } from 'react-native'
import { AlarmClock, BellRing, CalendarDays, ChevronRight, Clock3, Plus, Sunrise, Tag } from 'lucide-react-native'
import { useStore } from '@/lib/store'
import { radius, space, theme as t, type } from '@/lib/theme'
import type { Conversation } from '@/lib/types'
import { Avatar, Badge, Button, Chip, haptic, SearchField, SectionLabel, Sheet, SheetRow, STROKE, Txt, type LucideIcon } from '../ui'

const PRESENCE_LABEL = { online: 'Online', away: 'Away', offline: 'Offline' } as const
type PressState = { pressed: boolean; hovered?: boolean }

/** Transfer / reassign. Presence is shown because handing a chat to someone offline strands the customer. */
export function TransferSheet({ visible, conversation, meId, onPick, onClose }: {
  visible: boolean; conversation: Conversation; meId: string; onPick: (userId: string) => void; onClose: () => void
}) {
  const team = useStore(s => s.team)
  const [q, setQ] = useState('')
  const order = { online: 0, away: 1, offline: 2 }
  const sorted = [...team]
    .filter(u => !q || u.name.toLowerCase().includes(q.toLowerCase()))
    .sort((a, b) => (a.id === meId ? -1 : b.id === meId ? 1 : 0) || order[a.presence] - order[b.presence] || a.name.localeCompare(b.name))
  return (
    <Sheet visible={visible} onClose={onClose} title={conversation.agentId ? 'Transfer conversation' : 'Assign conversation'} subtitle="Teammates who are online are listed first">
      {team.length > 6 && <SearchField value={q} onChangeText={setQ} placeholder="Search teammates" style={{ marginHorizontal: space.xl, marginBottom: space.sm }} />}
      {sorted.map(u => {
        const current = conversation.agentId === u.id
        return (
          <Pressable key={u.id} disabled={current} onPress={() => { haptic(); onPick(u.id); onClose() }} accessibilityRole="button"
            style={(s) => [styles.personRow, ((s as PressState).pressed || (s as PressState).hovered) && !current && { backgroundColor: t.surfaceHover }]}>
            <Avatar label={u.initials} seed={u.id} size={40} presence={u.presence} />
            <View style={{ flex: 1 }}>
              <Txt v="bodyMedium">{u.id === meId ? `${u.name} (you)` : u.name}</Txt>
              <View style={styles.personMeta}>
                <View style={[styles.dot, { backgroundColor: t.presence[u.presence] }]} />
                <Txt v="small" color={t.textMuted}>{PRESENCE_LABEL[u.presence]} · {u.role[0]!.toUpperCase()}{u.role.slice(1)}</Txt>
              </View>
            </View>
            {current ? <Badge label="Current" tone="blue" /> : <ChevronRight size={17} color={t.textFaint} strokeWidth={STROKE} />}
          </Pressable>
        )
      })}
    </Sheet>
  )
}

export function LabelSheet({ visible, conversation, suggestions, onAdd, onRemove, onClose }: {
  visible: boolean; conversation: Conversation; suggestions: string[]
  onAdd: (label: string) => void; onRemove: (label: string) => void; onClose: () => void
}) {
  const [text, setText] = useState('')
  const [focused, setFocused] = useState(false)
  const add = () => {
    const label = text.trim().toLowerCase().replace(/\s+/g, '-')
    if (label) onAdd(label)
    setText('')
  }
  const unused = suggestions.filter(s => !conversation.labels.includes(s))
  return (
    <Sheet visible={visible} onClose={onClose} title="Labels" subtitle="Tag this conversation so your team can find it later">
      <View style={styles.wrap}>
        {conversation.labels.length === 0 && <Txt v="small" color={t.textMuted}>No labels yet.</Txt>}
        {conversation.labels.map(l => <Badge key={l} label={`#${l}`} tone="green" onRemove={() => onRemove(l)} />)}
      </View>
      <View style={styles.addRow}>
        <View style={[styles.inputBox, focused && styles.inputFocus]}>
          <Tag size={16} color={t.textFaint} strokeWidth={STROKE} />
          <TextInput
            value={text}
            onChangeText={setText}
            placeholder="New label, e.g. refund"
            placeholderTextColor={t.textFaint}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            style={[type.body, styles.input, Platform.OS === 'web' && ({ outlineStyle: 'none' } as object)]}
            onSubmitEditing={add}
            returnKeyType="done"
            autoCapitalize="none"
            maxLength={48}
            accessibilityLabel="New label"
          />
        </View>
        <Button title="Add" icon={Plus} onPress={add} disabled={!text.trim()} />
      </View>
      {unused.length > 0 && (
        <>
          <SectionLabel>Suggestions</SectionLabel>
          <View style={styles.wrap}>{unused.map(s => <Chip key={s} label={`#${s}`} icon={Plus} onPress={() => onAdd(s)} />)}</View>
        </>
      )}
    </Sheet>
  )
}

function at(hoursFromNow: number) { return new Date(Date.now() + hoursFromNow * 3_600_000) }
function tomorrowAt(hour: number) {
  const d = new Date()
  d.setDate(d.getDate() + 1)
  d.setHours(hour, 0, 0, 0)
  return d
}
function nextMonday(hour: number) {
  const d = new Date()
  d.setDate(d.getDate() + ((8 - d.getDay()) % 7 || 7))
  d.setHours(hour, 0, 0, 0)
  return d
}

export function SnoozeSheet({ visible, conversation, onPick, onClose }: {
  visible: boolean; conversation: Conversation; onPick: (until: Date | null) => void; onClose: () => void
}) {
  const options: { label: string; until: Date; icon: LucideIcon }[] = [
    { label: 'In 1 hour', until: at(1), icon: Clock3 },
    { label: 'In 3 hours', until: at(3), icon: AlarmClock },
    { label: 'Tomorrow morning', until: tomorrowAt(9), icon: Sunrise },
    { label: 'Next week', until: nextMonday(9), icon: CalendarDays },
  ]
  const fmt = (d: Date) => d.toLocaleString(undefined, { weekday: 'short', hour: 'numeric', minute: '2-digit' })
  return (
    <Sheet visible={visible} onClose={onClose} title="Snooze until" subtitle="It comes back to the inbox at this time, or sooner if the customer replies">
      {options.map(o => (
        <SheetRow key={o.label} icon={o.icon} label={o.label} right={<Txt v="small" color={t.textMuted}>{fmt(o.until)}</Txt>}
          onPress={() => { onPick(o.until); onClose() }} />
      ))}
      {conversation.snoozed && (
        <SheetRow icon={BellRing} iconBg={t.primarySoft} iconColor={t.primary} label="Unsnooze now" onPress={() => { onPick(null); onClose() }} />
      )}
    </Sheet>
  )
}

const styles = StyleSheet.create({
  personRow: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingHorizontal: space.xl, paddingVertical: 10 },
  personMeta: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dot: { width: 7, height: 7, borderRadius: 4 },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, paddingHorizontal: space.xl, paddingVertical: space.sm },
  addRow: { flexDirection: 'row', gap: space.sm, paddingHorizontal: space.xl, paddingVertical: space.sm, alignItems: 'center' },
  inputBox: {
    flex: 1, flexDirection: 'row', alignItems: 'center', gap: space.sm, height: 42, paddingHorizontal: space.md,
    borderWidth: 1, borderColor: t.border, borderRadius: radius.md, backgroundColor: t.surface,
  },
  inputFocus: { borderColor: t.primary },
  input: { flex: 1, color: t.text, height: '100%' },
})
