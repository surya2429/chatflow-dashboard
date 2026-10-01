import type { ComponentProps } from 'react'
import { Pressable, ScrollView, StyleSheet, View } from 'react-native'
import { router, type Tabs } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { ChartColumn, CircleUserRound, House, Inbox, MessagesSquare, type LucideIcon } from 'lucide-react-native'
import { useUser } from '@/lib/auth'
import { DEFAULT_FILTERS } from '@/lib/filters'
import { setPresence } from '@/lib/presence'
import { store, useStore } from '@/lib/store'
import { font, radius, space, theme as t, useLayout } from '@/lib/theme'
import type { Presence } from '@/lib/types'
import { Avatar, haptic, STROKE, Txt } from './ui'

type TabBarProps = Parameters<NonNullable<ComponentProps<typeof Tabs>['tabBar']>>[0]

const ITEMS: Record<string, { label: string; icon: LucideIcon }> = {
  index: { label: 'Home', icon: House },
  conversations: { label: 'Inbox', icon: Inbox },
  analytics: { label: 'Analytics', icon: ChartColumn },
  profile: { label: 'Profile', icon: CircleUserRound },
}

/** Chats that need this agent: unread and theirs, or unread and unowned. */
function useNeedsMe() {
  return useStore(s => Object.values(s.conversations).filter(c =>
    c.unread > 0 && !c.archived && (c.agentId === s.activeUserId || (!c.agentId && c.status !== 'resolved'))).length)
}

/**
 * Navigation that fits the screen: a bottom bar on phones, a sidebar on
 * tablets and desktop (an icon rail until there's room for labels).
 */
export function AppNav(props: TabBarProps) {
  const { isWide, isXL } = useLayout()
  if (!isWide) return <BottomBar {...props} />
  return <Sidebar {...props} compact={!isXL} />
}

function BottomBar({ state, navigation }: TabBarProps) {
  const insets = useSafeAreaInsets()
  const needsMe = useNeedsMe()
  return (
    <View style={[styles.bottom, { paddingBottom: Math.max(insets.bottom, 8) }]}>
      {state.routes.map((route, index) => {
        const item = ITEMS[route.name]
        if (!item) return null
        const focused = state.index === index
        const Icon = item.icon
        const badge = route.name === 'conversations' ? needsMe : 0
        return (
          <Pressable key={route.key} accessibilityRole="tab" aria-selected={focused} accessibilityLabel={item.label}
            onPress={() => {
              haptic()
              const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true })
              if (!focused && !event.defaultPrevented) navigation.navigate(route.name)
            }}
            style={styles.bottomItem}>
            <View style={[styles.pill, focused && { backgroundColor: t.primarySoft }]}>
              <Icon size={21} color={focused ? t.primary : t.textMuted} strokeWidth={focused ? 2.2 : STROKE} />
              {badge > 0 && <View style={styles.badge}><Txt v="caption" color="#fff" style={{ fontFamily: font.bold, fontSize: 9 }}>{badge > 99 ? '99+' : badge}</Txt></View>}
            </View>
            <Txt v="caption" color={focused ? t.primary : t.textMuted} style={{ fontFamily: focused ? font.semibold : font.medium, fontSize: 9.5 }}>{item.label}</Txt>
          </Pressable>
        )
      })}
    </View>
  )
}

const PRESENCES: { key: Presence; label: string }[] = [
  { key: 'online', label: 'Online' }, { key: 'away', label: 'Away' }, { key: 'offline', label: 'Offline' },
]

function Sidebar({ state, navigation, compact }: TabBarProps & { compact: boolean }) {
  const insets = useSafeAreaInsets()
  const me = useUser()
  const bots = useStore(s => s.bots)
  const filters = useStore(s => s.filters)
  const needsMe = useNeedsMe()
  const current = state.routes[state.index]?.name

  const go = (name: string) => {
    haptic()
    navigation.navigate(name)
  }
  const openBot = (botId: string | null) => {
    haptic()
    store.setFilters({ ...DEFAULT_FILTERS, botIds: botId ? [botId] : [] })
    router.navigate('/conversations')
  }

  return (
    <View style={[styles.side, compact && styles.sideCompact, { paddingTop: insets.top + space.lg }]}>
      {/* Brand */}
      <View style={[styles.brand, compact && { justifyContent: 'center', paddingHorizontal: 0 }]}>
        <View style={styles.logo}><MessagesSquare size={18} color="#fff" strokeWidth={2.2} /></View>
        {!compact && (
          <View>
            <Txt v="subheading" style={{ fontFamily: font.bold }}>ChatFlow</Txt>
            <Txt v="caption" color={t.textMuted}>Agent workspace</Txt>
          </View>
        )}
      </View>

      {/* Main nav */}
      <View style={styles.nav}>
        {state.routes.map((route) => {
          const item = ITEMS[route.name]
          if (!item) return null
          const focused = current === route.name
          const Icon = item.icon
          const badge = route.name === 'conversations' ? needsMe : 0
          return (
            <Pressable key={route.key} onPress={() => go(route.name)} accessibilityRole="tab" aria-selected={focused} accessibilityLabel={item.label}
              style={(s) => [styles.navItem, compact && styles.navItemCompact, focused && styles.navOn, (s as { hovered?: boolean }).hovered && !focused && { backgroundColor: t.surfaceHover }]}>
              <Icon size={19} color={focused ? t.primary : t.textSoft} strokeWidth={focused ? 2.2 : STROKE} />
              {!compact && <Txt v="smallMedium" color={focused ? t.primary : t.textSoft} style={{ flex: 1, fontFamily: focused ? font.semibold : font.medium, fontSize: 12 }}>{item.label}</Txt>}
              {badge > 0 && (compact
                ? <View style={[styles.badge, { top: 4, right: 6 }]}><Txt v="caption" color="#fff" style={{ fontFamily: font.bold, fontSize: 9 }}>{badge}</Txt></View>
                : <View style={styles.navCount}><Txt v="caption" color={focused ? t.primary : t.textMuted} style={{ fontFamily: font.semibold }}>{badge}</Txt></View>)}
            </Pressable>
          )
        })}
      </View>

      {/* Bots */}
      {bots.length > 0 && (
        <>
          {!compact && <Txt v="overline" color={t.textFaint} style={styles.groupLabel}>Your bots</Txt>}
          {compact && <View style={styles.rule} />}
          <ScrollView style={{ flex: 1 }} contentContainerStyle={{ gap: 2, paddingHorizontal: compact ? 0 : space.sm, alignItems: compact ? 'center' : 'stretch' }}>
            {bots.map(b => {
              const on = current === 'conversations' && filters.botIds.length === 1 && filters.botIds[0] === b.id
              return (
                <Pressable key={b.id} onPress={() => openBot(b.id)} accessibilityRole="button" accessibilityLabel={`${b.name}, ${b.stats.open} open`}
                  style={(s) => [styles.botItem, compact && styles.botItemCompact, on && styles.navOn, (s as { hovered?: boolean }).hovered && !on && { backgroundColor: t.surfaceHover }]}>
                  <View style={[styles.botDot, { backgroundColor: b.color }, compact && { width: 12, height: 12, borderRadius: 4 }]} />
                  {!compact && (
                    <>
                      <Txt v="smallMedium" color={on ? t.primary : t.textSoft} numberOfLines={1} style={{ flex: 1, fontSize: 12 }}>{b.name}</Txt>
                      {b.stats.unread > 0
                        ? <View style={styles.unreadDot} />
                        : <Txt v="caption" color={t.textFaint}>{b.stats.open}</Txt>}
                    </>
                  )}
                </Pressable>
              )
            })}
          </ScrollView>
        </>
      )}
      {bots.length === 0 && <View style={{ flex: 1 }} />}

      {/* Me */}
      <View style={[styles.me, compact && { alignItems: 'center', paddingHorizontal: 0 }]}>
        {!compact && (
          <View style={styles.presenceRow}>
            {PRESENCES.map(p => {
              const on = me.presence === p.key
              return (
                <Pressable key={p.key} onPress={() => { haptic(); void setPresence(p.key).catch(() => {}) }} accessibilityRole="radio" aria-checked={on}
                  style={[styles.presenceOpt, on && styles.presenceOn]}>
                  <View style={[styles.presenceDot, { backgroundColor: t.presence[p.key] }]} />
                  <Txt v="caption" color={on ? t.text : t.textMuted} style={{ fontFamily: on ? font.semibold : font.medium, fontSize: 11 }}>{p.label}</Txt>
                </Pressable>
              )
            })}
          </View>
        )}
        <Pressable onPress={() => go('profile')} accessibilityRole="button" accessibilityLabel="Your profile"
          style={(s) => [styles.meCard, compact && { paddingHorizontal: 0, backgroundColor: 'transparent' }, (s as { hovered?: boolean }).hovered && { backgroundColor: t.surfaceHover }]}>
          <Avatar label={me.initials} seed={me.id} size={34} presence={me.presence} />
          {!compact && (
            <View style={{ flex: 1, minWidth: 0 }}>
              <Txt v="smallMedium" numberOfLines={1} style={{ fontFamily: font.semibold }}>{me.name}</Txt>
              <Txt v="caption" color={t.textMuted} numberOfLines={1}>{me.email}</Txt>
            </View>
          )}
        </Pressable>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  bottom: {
    flexDirection: 'row', backgroundColor: t.surface, paddingTop: 6,
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: t.border,
  },
  bottomItem: { flex: 1, alignItems: 'center', gap: 2 },
  pill: { width: 54, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  badge: {
    position: 'absolute', top: -3, right: 5, minWidth: 17, height: 17, borderRadius: 9, paddingHorizontal: 4,
    backgroundColor: t.primary, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: t.surface,
  },
  side: { width: 256, backgroundColor: t.sidebar, borderRightWidth: StyleSheet.hairlineWidth, borderRightColor: t.border, paddingBottom: space.lg },
  sideCompact: { width: 76 },
  brand: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: space.lg + 2, marginBottom: space.xl },
  logo: { width: 34, height: 34, borderRadius: 10, backgroundColor: t.primary, alignItems: 'center', justifyContent: 'center' },
  nav: { gap: 2, paddingHorizontal: space.sm },
  navItem: { flexDirection: 'row', alignItems: 'center', gap: 11, height: 38, paddingHorizontal: 12, borderRadius: radius.md },
  navItemCompact: { justifyContent: 'center', paddingHorizontal: 0, width: 48, height: 44, alignSelf: 'center' },
  navOn: { backgroundColor: t.primarySoft },
  navCount: { minWidth: 22, height: 20, borderRadius: 10, paddingHorizontal: 6, backgroundColor: t.surface, borderWidth: 1, borderColor: t.border, alignItems: 'center', justifyContent: 'center' },
  groupLabel: { paddingHorizontal: space.lg + 4, marginTop: space.xl, marginBottom: space.sm },
  rule: { height: StyleSheet.hairlineWidth, backgroundColor: t.border, marginHorizontal: space.lg, marginVertical: space.lg },
  botItem: { flexDirection: 'row', alignItems: 'center', gap: 11, height: 34, paddingHorizontal: 12, borderRadius: radius.md },
  botItemCompact: { width: 48, height: 40, justifyContent: 'center', paddingHorizontal: 0 },
  botDot: { width: 9, height: 9, borderRadius: 3 },
  unreadDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: t.primary },
  me: { gap: space.sm, paddingHorizontal: space.sm, paddingTop: space.md, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: t.border, marginTop: space.md },
  presenceRow: { flexDirection: 'row', gap: 2, backgroundColor: t.surfaceAlt, padding: 3, borderRadius: radius.md },
  presenceOpt: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, paddingVertical: 6, borderRadius: radius.sm },
  presenceOn: { backgroundColor: t.surface, borderWidth: StyleSheet.hairlineWidth, borderColor: t.border },
  presenceDot: { width: 7, height: 7, borderRadius: 4 },
  meCard: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 8, borderRadius: radius.md },
})
