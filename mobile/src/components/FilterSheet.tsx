import { useState, type ReactNode } from 'react'
import { Pressable, StyleSheet, Switch, View } from 'react-native'
import {
  Archive, ArrowDownWideNarrow, Bot, CalendarRange, Check, Hourglass, Layers, Mail, MessageCircle, Star, Tag, UserRound, type LucideIcon,
} from 'lucide-react-native'
import { useStore } from '@/lib/store'
import { clearRefinements, DATE_LABEL, SORT_LABEL, type DateRange, type Filters, type Sort } from '@/lib/filters'
import { font, radius, space, theme as t } from '@/lib/theme'
import type { Channel, ConversationStatus } from '@/lib/types'
import { Avatar, BrandGlyph, Button, CHANNEL_LABEL, ChannelMark, Chip, haptic, Sheet, STROKE, Txt } from './ui'

type PressState = { pressed: boolean; hovered?: boolean }

function Section({ icon: Icon, title, children, hint }: { icon: LucideIcon; title: string; children: ReactNode; hint?: string }) {
  return (
    <View style={styles.section}>
      <View style={styles.sectionHead}>
        <Icon size={15} color={t.textMuted} strokeWidth={STROKE} />
        <Txt v="smallMedium" color={t.textStrong} style={{ fontFamily: font.semibold, flex: 1 }}>{title}</Txt>
        {hint && <Txt v="caption" color={t.textFaint}>{hint}</Txt>}
      </View>
      {children}
    </View>
  )
}

/**
 * Every refinement in one place. Edits a draft and applies on "Show results",
 * so the list doesn't thrash while the agent is still choosing. Remounted each
 * time it opens (keyed by the caller), so the draft starts from the live filters.
 */
export function FilterSheet({ visible, value, knownLabels, onApply, onClose }: {
  visible: boolean; value: Filters; knownLabels: string[]; onApply: (f: Filters) => void; onClose: () => void
}) {
  const team = useStore(s => s.team)
  const bots = useStore(s => s.bots)
  const [d, setD] = useState(value)

  const toggle = <T,>(list: T[], item: T) => (list.includes(item) ? list.filter(x => x !== item) : [...list, item])
  const onlyInstagram = d.channels.length === 1 && d.channels[0] === 'instagram'

  const flag = (key: 'starred' | 'unread' | 'archived', Icon: LucideIcon, label: string, detail: string, first?: boolean) => (
    <View style={[styles.toggleRow, !first && styles.divider]} key={key}>
      <View style={styles.flagIcon}><Icon size={16} color={t.textSoft} strokeWidth={STROKE} /></View>
      <View style={{ flex: 1 }}>
        <Txt v="bodyMedium">{label}</Txt>
        <Txt v="caption" color={t.textMuted}>{detail}</Txt>
      </View>
      <Switch value={d[key]} onValueChange={(v) => { haptic(); setD(x => ({ ...x, [key]: v })) }} accessibilityLabel={label}
        trackColor={{ true: t.primary, false: t.surfaceSunken }} thumbColor="#FFFFFF" />
    </View>
  )

  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      width={560}
      title="Filter & sort"
      subtitle="Narrow the inbox down to exactly what you need"
      footer={
        <>
          <Button kind="outline" title="Reset all" style={{ flex: 1 }} onPress={() => setD(clearRefinements({ ...d, sort: 'recent' }))} />
          <Button title="Show results" style={{ flex: 2 }} onPress={() => { onApply(d); onClose() }} />
        </>
      }
    >
      <Section icon={ArrowDownWideNarrow} title="Sort by">
        <View style={styles.wrap}>
          {(Object.keys(SORT_LABEL) as Sort[]).map(s => (
            <Chip key={s} label={SORT_LABEL[s]} active={d.sort === s} onPress={() => setD(x => ({ ...x, sort: s }))} />
          ))}
        </View>
      </Section>

      {bots.length > 1 && (
        <Section icon={Bot} title="Bots" hint={d.botIds.length ? `${d.botIds.length} selected` : 'All bots'}>
          <View style={styles.box}>
            {bots.map((b, i) => {
              const on = d.botIds.includes(b.id)
              return (
                <Pressable key={b.id} onPress={() => { haptic(); setD(x => ({ ...x, botIds: toggle(x.botIds, b.id) })) }}
                  accessibilityRole="checkbox" aria-checked={on}
                  style={(s) => [styles.pickRow, i > 0 && styles.divider, ((s as PressState).pressed || (s as PressState).hovered) && { backgroundColor: t.surfaceHover }]}>
                  <ChannelMark channel={b.channel} size={32} color={b.color} />
                  <View style={{ flex: 1 }}>
                    <Txt v="bodyMedium">{b.name}</Txt>
                    <Txt v="caption" color={t.textMuted}>{b.identity}{b.status === 'paused' ? ' · Paused' : ''}</Txt>
                  </View>
                  <View style={[styles.check, on && styles.checkOn]}>{on && <Check size={13} color="#FFFFFF" strokeWidth={3} />}</View>
                </Pressable>
              )
            })}
          </View>
        </Section>
      )}

      <Section icon={MessageCircle} title="Channel">
        <View style={styles.wrap}>
          {(['whatsapp', 'instagram', 'webchat'] as Channel[]).map(ch => {
            const on = d.channels.includes(ch)
            return (
              <Chip key={ch} label={CHANNEL_LABEL[ch]} active={on}
                leading={<BrandGlyph channel={ch} size={14} color={on ? t.primary : t.channel[ch]} />}
                onPress={() => setD(x => {
                  const channels = toggle(x.channels, ch)
                  return { ...x, channels, source: channels.length === 1 && channels[0] === 'instagram' ? x.source : null }
                })}
              />
            )
          })}
        </View>
        {onlyInstagram && (
          <View style={[styles.wrap, { marginTop: space.sm }]}>
            {([['dm', 'Direct messages'], ['comment', 'Comments'], ['story', 'Story replies']] as const).map(([k, label]) => (
              <Chip key={k} label={label} active={d.source === k} onPress={() => setD(x => ({ ...x, source: x.source === k ? null : k }))} />
            ))}
          </View>
        )}
      </Section>

      <Section icon={Layers} title="Status">
        <View style={styles.wrap}>
          {([['bot', 'With bot', t.status.bot], ['agent', 'Open with agent', t.status.agent], ['resolved', 'Resolved', t.status.resolved]] as [ConversationStatus, string, string][]).map(([s, label, dot]) => (
            <Chip key={s} label={label} dot={dot} active={d.statuses.includes(s)} onPress={() => setD(x => ({ ...x, statuses: toggle(x.statuses, s) }))} />
          ))}
        </View>
      </Section>

      <Section icon={UserRound} title="Assigned to">
        <View style={styles.wrap}>
          <Chip label="Anyone" active={!d.agentId} onPress={() => setD(x => ({ ...x, agentId: null }))} />
          {team.map(u => {
            const on = d.agentId === u.id
            return (
              <Pressable key={u.id} onPress={() => { haptic(); setD(x => ({ ...x, agentId: on ? null : u.id })) }} accessibilityRole="button" aria-selected={on}
                style={[styles.person, on ? styles.personOn : null]}>
                <Avatar label={u.initials} seed={u.id} size={24} presence={u.presence} />
                <Txt v="smallMedium" color={on ? t.primary : t.textSoft} style={on ? { fontFamily: font.semibold } : undefined}>{u.name.split(' ')[0]}</Txt>
              </Pressable>
            )
          })}
        </View>
      </Section>

      {knownLabels.length > 0 && (
        <Section icon={Tag} title="Labels">
          <View style={styles.wrap}>
            {knownLabels.map(l => (
              <Chip key={l} label={`#${l}`} active={d.labels.includes(l)} onPress={() => setD(x => ({ ...x, labels: toggle(x.labels, l) }))} />
            ))}
          </View>
        </Section>
      )}

      <Section icon={CalendarRange} title="Last activity">
        <View style={styles.wrap}>
          {(Object.keys(DATE_LABEL) as DateRange[]).map(r => (
            <Chip key={r} label={DATE_LABEL[r]} active={d.date === r} onPress={() => setD(x => ({ ...x, date: r }))} />
          ))}
        </View>
      </Section>

      <Section icon={Hourglass} title="Only show">
        <View style={styles.box}>
          {flag('unread', Mail, 'Unread', 'Has messages you haven’t opened', true)}
          {flag('starred', Star, 'Starred', 'Chats you flagged to come back to')}
          {flag('archived', Archive, 'Archived', 'Show archived chats instead of the inbox')}
        </View>
      </Section>
      <View style={{ height: space.md }} />
    </Sheet>
  )
}

const styles = StyleSheet.create({
  section: { paddingHorizontal: space.xl, paddingTop: space.lg, gap: space.sm + 2 },
  sectionHead: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  box: { borderRadius: radius.lg, backgroundColor: t.surface, borderWidth: 1, borderColor: t.border, overflow: 'hidden' },
  pickRow: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingHorizontal: space.md, paddingVertical: 10 },
  divider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: t.border },
  check: { width: 22, height: 22, borderRadius: 7, borderWidth: 1.5, borderColor: t.borderStrong, alignItems: 'center', justifyContent: 'center' },
  checkOn: { backgroundColor: t.primary, borderColor: t.primary },
  person: {
    flexDirection: 'row', alignItems: 'center', gap: 7, paddingLeft: 5, paddingRight: 12, height: 34, borderRadius: radius.pill,
    borderWidth: 1, borderColor: t.border, backgroundColor: t.surface,
  },
  personOn: { backgroundColor: t.primarySoft, borderColor: t.primaryMid },
  toggleRow: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingHorizontal: space.md, paddingVertical: 10 },
  flagIcon: { width: 32, height: 32, borderRadius: 9, backgroundColor: t.surfaceAlt, alignItems: 'center', justifyContent: 'center' },
})
