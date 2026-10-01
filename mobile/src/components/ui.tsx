import { Ionicons } from '@expo/vector-icons'
import * as Haptics from 'expo-haptics'
import { useEffect, useState, type ReactNode } from 'react'
import {
  ActivityIndicator, Animated, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View,
  type StyleProp, type TextProps, type TextStyle, type ViewStyle,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import {
  AtSign, Check, CircleAlert, CircleCheck, FingerprintPattern, Globe, Info, Mail, Phone, Search, UserRound, X, type LucideIcon,
} from 'lucide-react-native'
import { font, radius, shadow, space, theme as t, type, useLayout } from '@/lib/theme'
import type { Channel, ContactIdentity, ConversationStatus, Presence } from '@/lib/types'

export type { LucideIcon }
export const STROKE = 1.9

// ── Feel ─────────────────────────────────────────────────────────────────────

/** Light tactile tick on meaningful actions (no-op on web). */
export function haptic(kind: 'tap' | 'success' | 'warning' = 'tap') {
  if (Platform.OS === 'web') return
  if (kind === 'tap') void Haptics.selectionAsync().catch(() => {})
  else void Haptics.notificationAsync(kind === 'success' ? Haptics.NotificationFeedbackType.Success : Haptics.NotificationFeedbackType.Warning).catch(() => {})
}

// ── Text ─────────────────────────────────────────────────────────────────────

// In the browser a long unbroken run — a URL, an email, "hiiiiii…" — would
// widen its box instead of wrapping and push bubbles off-screen. Native Text
// already breaks such words; this makes web do the same.
const wrapLongWords = Platform.OS === 'web' ? ({ wordBreak: 'break-word' } as unknown as TextStyle) : null

export function Txt({ v = 'body', color, style, ...rest }: TextProps & { v?: keyof typeof type; color?: string }) {
  return <Text {...rest} style={[wrapLongWords, type[v], { color: color ?? t.text }, style]} />
}

// ── Channels & identity ──────────────────────────────────────────────────────

export const CHANNEL_LABEL: Record<Channel, string> = { whatsapp: 'WhatsApp', instagram: 'Instagram', webchat: 'Website' }

/** Brand glyph for a channel (WhatsApp / Instagram logos; a globe for the website widget). */
export function BrandGlyph({ channel, size = 16, color = '#FFFFFF' }: { channel: Channel; size?: number; color?: string }) {
  if (channel === 'webchat') return <Globe size={size} color={color} strokeWidth={2.2} />
  return <Ionicons name={channel === 'whatsapp' ? 'logo-whatsapp' : 'logo-instagram'} size={size} color={color} />
}

/** A channel/bot mark: rounded square in the bot's colour with its channel's glyph. */
export function ChannelMark({ channel, size = 40, color }: { channel: Channel; size?: number; color?: string }) {
  return (
    <View style={{ width: size, height: size, borderRadius: size * 0.3, backgroundColor: color ?? t.channel[channel], alignItems: 'center', justifyContent: 'center' }}>
      <BrandGlyph channel={channel} size={size * 0.5} />
    </View>
  )
}

/** Initials of a bot's name ("Acme Support" → "AS"). */
function botInitials(name: string) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0]!.toUpperCase()).join('') || '?'
}

/**
 * A bot, the way the web dashboard shows it: its initials on a pale tint of
 * the bot's colour, with the channel as a small badge.
 */
export function BotAvatar({ name, color, channel, size = 36, off }: { name: string; color: string; channel: Channel; size?: number; off?: boolean }) {
  const hex = /^#[0-9a-f]{6}$/i.test(color) ? color : t.primary
  const badge = Math.max(14, Math.round(size * 0.4))
  return (
    <View style={{ width: size, height: size }}>
      <View style={{
        width: size, height: size, borderRadius: size / 2, alignItems: 'center', justifyContent: 'center',
        backgroundColor: off ? '#E2E8F0' : `${hex}1F`,
      }}>
        <Text style={{ color: off ? '#94A3B8' : hex, fontFamily: font.bold, fontSize: Math.round(size * 0.32) }}>{botInitials(name)}</Text>
      </View>
      <View style={[styles.corner, { width: badge, height: badge, borderRadius: badge / 2, backgroundColor: t.channel[channel] }]}>
        <BrandGlyph channel={channel} size={badge * 0.58} />
      </View>
    </View>
  )
}

const AVATAR_TINTS: [string, string][] = [
  ['#DBEAFE', '#1D4ED8'], ['#D1FAE5', '#047857'], ['#EDE9FE', '#6D28D9'], ['#FFEDD5', '#C2410C'],
  ['#FCE7F3', '#BE185D'], ['#E0F2FE', '#0369A1'], ['#FEF3C7', '#B45309'], ['#E4E4E7', '#3F3F46'],
]
function tintFor(seed: string) {
  let h = 0
  for (const ch of seed) h = (h * 31 + ch.charCodeAt(0)) >>> 0
  return AVATAR_TINTS[h % AVATAR_TINTS.length]!
}

export function Avatar({ label, seed, size = 44, channel, presence, solid }: {
  label: string; seed: string; size?: number; channel?: Channel; presence?: Presence; solid?: string
}) {
  const [bg, fg] = solid ? [solid, '#FFFFFF'] : tintFor(seed)
  const badge = Math.max(16, Math.round(size * 0.4))
  return (
    <View style={{ width: size, height: size }}>
      <View style={[styles.avatar, { width: size, height: size, borderRadius: size / 2, backgroundColor: bg }]}>
        <Text style={{ color: fg, fontFamily: font.semibold, fontSize: size * 0.37, letterSpacing: -0.3 }}>{label.slice(0, 2).toUpperCase()}</Text>
      </View>
      {channel && (
        <View style={[styles.corner, { width: badge, height: badge, borderRadius: badge / 2, backgroundColor: t.channel[channel] }]}>
          <BrandGlyph channel={channel} size={badge * 0.55} />
        </View>
      )}
      {!channel && presence && (
        <View style={[styles.corner, { width: Math.max(10, size * 0.28), height: Math.max(10, size * 0.28), borderRadius: size, backgroundColor: t.presence[presence] }]} />
      )}
    </View>
  )
}

/**
 * The customer's identifier, per channel: WhatsApp number, Instagram @handle,
 * or for a website visitor the name/email they gave — else their visitor id.
 */
export function identityText(identity: ContactIdentity, channel: Channel): string {
  return channel === 'webchat' && identity.known && identity.secondary ? identity.secondary : identity.primary
}
export function identityIcon(identity: ContactIdentity, channel: Channel): LucideIcon {
  if (channel === 'whatsapp') return Phone
  if (channel === 'instagram') return AtSign
  if (!identity.known) return FingerprintPattern
  return identityText(identity, channel).includes('@') ? Mail : UserRound
}
/** The identifier's glyph as a component (phone, @, fingerprint, mail or person). */
export function IdentityIcon({ identity, channel, size = 12, color = t.textMuted }: { identity: ContactIdentity; channel: Channel; size?: number; color?: string }) {
  const p = { size, color, strokeWidth: STROKE }
  if (channel === 'whatsapp') return <Phone {...p} />
  if (channel === 'instagram') return <AtSign {...p} />
  if (!identity.known) return <FingerprintPattern {...p} />
  return identityText(identity, channel).includes('@') ? <Mail {...p} /> : <UserRound {...p} />
}

// ── Badges & chips ───────────────────────────────────────────────────────────

export type Tone = 'blue' | 'green' | 'amber' | 'red' | 'gray' | 'purple'
const TONES: Record<Tone, [string, string, string]> = {
  blue: [t.primarySoft, t.primary, t.primaryTint],
  green: [t.successSoft, t.success, t.successBorder],
  amber: [t.warningSoft, t.warning, t.warningBorder],
  red: [t.dangerSoft, t.danger, t.dangerBorder],
  gray: [t.neutralSoft, t.textSoft, t.neutralBorder],
  purple: [t.purpleSoft, t.purple, t.purpleBorder],
}

export function Badge({ label, tone = 'gray', icon: Icon, dot, onRemove, style }: {
  label: string; tone?: Tone; icon?: LucideIcon; dot?: string; onRemove?: () => void; style?: StyleProp<ViewStyle>
}) {
  const [bg, fg] = TONES[tone]
  return (
    <View style={[styles.badge, { backgroundColor: bg }, style]}>
      {dot && <View style={[styles.dot, { backgroundColor: dot }]} />}
      {Icon && <Icon size={12} color={fg} strokeWidth={2.2} />}
      <Text style={[type.caption, { color: fg, fontFamily: font.semibold }]} numberOfLines={1}>{label}</Text>
      {onRemove && (
        <Pressable onPress={onRemove} hitSlop={10} accessibilityRole="button" accessibilityLabel={`Remove ${label}`}>
          <X size={12} color={fg} strokeWidth={2.4} />
        </Pressable>
      )}
    </View>
  )
}

export const STATUS_META: Record<ConversationStatus, { label: string; tone: Tone }> = {
  bot: { label: 'Bot', tone: 'blue' }, agent: { label: 'Open', tone: 'green' }, resolved: { label: 'Resolved', tone: 'gray' },
}
export function StatusBadge({ status }: { status: ConversationStatus }) {
  return <Badge label={STATUS_META[status].label} tone={STATUS_META[status].tone} dot={t.status[status]} />
}

type PressState = { pressed: boolean; hovered?: boolean }

export function Chip({ label, active, onPress, icon: Icon, count, dot, leading, trailing }: {
  label: string; active?: boolean; onPress: () => void; icon?: LucideIcon; count?: number; dot?: string; leading?: ReactNode; trailing?: ReactNode
}) {
  return (
    <Pressable onPress={() => { haptic(); onPress() }} accessibilityRole="button" aria-selected={!!active}
      style={(s) => [styles.chip, active ? styles.chipOn : styles.chipOff, ((s as PressState).pressed || (s as PressState).hovered) && !active && { backgroundColor: t.surfaceHover }]}>
      {dot && <View style={[styles.dot, { backgroundColor: dot, width: 7, height: 7 }]} />}
      {leading}
      {Icon && <Icon size={14} color={active ? t.primary : t.textMuted} strokeWidth={STROKE} />}
      <Text style={[type.smallMedium, { color: active ? t.primary : t.textSoft }]} numberOfLines={1}>{label}</Text>
      {count !== undefined && count > 0 && (
        <View style={[styles.chipCount, active && { backgroundColor: t.primary }]}>
          <Text style={{ fontFamily: font.semibold, fontSize: 9.5, color: active ? '#fff' : t.textMuted }}>{count > 99 ? '99+' : count}</Text>
        </View>
      )}
      {trailing}
    </Pressable>
  )
}
/** Back-compat alias. */
export const FilterChip = Chip

/** Pill-style segmented control. */
export function Segmented<K extends string>({ items, value, onChange, style }: {
  items: { key: K; label: string; count?: number; dot?: string; icon?: LucideIcon }[]; value: K; onChange: (k: K) => void; style?: StyleProp<ViewStyle>
}) {
  return (
    <View style={[styles.segment, style]}>
      {items.map(it => {
        const on = it.key === value
        const Icon = it.icon
        return (
          <Pressable key={it.key} onPress={() => { haptic(); onChange(it.key) }} accessibilityRole="tab" aria-selected={on}
            accessibilityLabel={it.count ? `${it.label}, ${it.count}` : it.label}
            style={[styles.segmentItem, on && styles.segmentOn]}>
            {it.dot && <View style={[styles.dot, { backgroundColor: it.dot, width: 7, height: 7 }]} />}
            {Icon && <Icon size={14} color={on ? t.text : t.textMuted} strokeWidth={STROKE} />}
            <Text style={[type.smallMedium, { flexShrink: 1, color: on ? t.text : t.textMuted, fontFamily: on ? font.semibold : font.medium }]} numberOfLines={1}>{it.label}</Text>
            {it.count !== undefined && it.count > 0 && (
              <Text style={{ fontFamily: font.semibold, fontSize: 10, color: on ? t.primary : t.textFaint }}>{it.count > 99 ? '99+' : it.count}</Text>
            )}
          </Pressable>
        )
      })}
    </View>
  )
}

// ── Buttons ──────────────────────────────────────────────────────────────────

export function Button({ title, onPress, kind = 'primary', size = 'md', icon: Icon, iconRight: IconRight, loading, disabled, style }: {
  title: string
  onPress: () => void
  kind?: 'primary' | 'secondary' | 'outline' | 'danger' | 'ghost' | 'white' | 'dark'
  size?: 'lg' | 'md' | 'sm'
  icon?: LucideIcon
  iconRight?: LucideIcon
  loading?: boolean
  disabled?: boolean
  style?: StyleProp<ViewStyle>
}) {
  const bg = { primary: t.primary, secondary: t.primarySoft, outline: t.surface, danger: t.dangerSoft, ghost: 'transparent', white: '#FFFFFF', dark: t.text }[kind]
  const fg = { primary: '#FFFFFF', secondary: t.primary, outline: t.textStrong, danger: t.danger, ghost: t.textSoft, white: t.text, dark: '#FFFFFF' }[kind]
  const h = { lg: 48, md: 40, sm: 32 }[size]
  const iconSize = size === 'sm' ? 14 : 16
  return (
    <Pressable
      onPress={() => { haptic(); onPress() }}
      disabled={disabled || loading}
      accessibilityRole="button"
      style={(s) => {
        const { pressed, hovered } = s as PressState
        return [
          styles.button,
          { minHeight: h, paddingHorizontal: size === 'sm' ? 12 : 16, backgroundColor: bg, opacity: disabled ? 0.45 : 1 },
          kind === 'outline' && { borderWidth: 1, borderColor: t.border },
          kind === 'primary' && !disabled && shadow.button,
          (pressed || hovered) && kind === 'primary' && { backgroundColor: t.primaryHover },
          (pressed || hovered) && (kind === 'outline' || kind === 'ghost') && { backgroundColor: t.surfaceHover },
          pressed && { transform: [{ scale: 0.98 }] },
          style,
        ]
      }}
    >
      {loading ? <ActivityIndicator color={fg} /> : (
        <>
          {Icon && <Icon size={iconSize} color={fg} strokeWidth={2} />}
          <Text style={[size === 'sm' ? type.smallMedium : type.subheading, { color: fg, fontFamily: font.semibold }]}>{title}</Text>
          {IconRight && <IconRight size={iconSize} color={fg} strokeWidth={2} />}
        </>
      )}
    </Pressable>
  )
}

export function IconButton({ icon: Icon, onPress, label, color, size = 20, badge, variant = 'plain', disabled, active, box = 36 }: {
  icon: LucideIcon; onPress: () => void; label: string; color?: string; size?: number; badge?: boolean | number
  variant?: 'plain' | 'soft' | 'outline' | 'primary'; disabled?: boolean; active?: boolean; box?: number
}) {
  const bg = active ? t.primarySoft : { plain: 'transparent', soft: t.surfaceAlt, outline: t.surface, primary: t.primary }[variant]
  return (
    <Pressable onPress={() => { haptic(); onPress() }} hitSlop={6} accessibilityRole="button" accessibilityLabel={label} disabled={disabled}
      style={(s) => {
        const { pressed, hovered } = s as PressState
        return [
          styles.iconButton, { width: box, height: box, borderRadius: variant === 'primary' || variant === 'outline' ? radius.md : box / 2, backgroundColor: bg, opacity: disabled ? 0.4 : 1 },
          variant === 'outline' && { borderWidth: 1, borderColor: t.border },
          variant === 'primary' && shadow.button,
          (pressed || hovered) && !active && variant !== 'primary' && { backgroundColor: t.surfaceHover },
          pressed && { opacity: 0.75 },
        ]
      }}>
      <Icon size={size} color={color ?? (active ? t.primary : variant === 'primary' ? '#FFFFFF' : t.textSoft)} strokeWidth={STROKE} />
      {!!badge && (
        typeof badge === 'number'
          ? <View style={styles.countBadge}><Text style={styles.countBadgeText}>{badge}</Text></View>
          : <View style={styles.dotBadge} />
      )}
    </Pressable>
  )
}

// ── Surfaces ─────────────────────────────────────────────────────────────────

export function Card({ children, style, onPress, padded }: { children: ReactNode; style?: StyleProp<ViewStyle>; onPress?: () => void; padded?: boolean }) {
  const base = [styles.card, padded && { padding: space.lg }]
  if (onPress) {
    return (
      <Pressable onPress={() => { haptic(); onPress() }} accessibilityRole="button"
        style={(s) => {
          const { pressed, hovered } = s as PressState
          return [...base, hovered && { borderColor: t.primaryMid, ...shadow.card }, pressed && { transform: [{ scale: 0.99 }] }, style]
        }}>
        {children}
      </Pressable>
    )
  }
  return <View style={[...base, style]}>{children}</View>
}

export function ListGroup({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[styles.group, style]}>{children}</View>
}

export function ListItem({ icon: Icon, iconColor, iconBg, title, subtitle, value, onPress, right, chevron, first, destructive, left }: {
  icon?: LucideIcon; iconColor?: string; iconBg?: string; title: string; subtitle?: string; value?: string
  onPress?: () => void; right?: ReactNode; chevron?: boolean; first?: boolean; destructive?: boolean; left?: ReactNode
}) {
  const body = (
    <>
      {left ?? (Icon && (
        <View style={[styles.listIcon, { backgroundColor: iconBg ?? t.surfaceAlt }]}>
          <Icon size={16} color={iconColor ?? t.textSoft} strokeWidth={STROKE} />
        </View>
      ))}
      <View style={[styles.listBody, !first && styles.listDivider]}>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Txt v="bodyMedium" color={destructive ? t.danger : t.text} numberOfLines={1}>{title}</Txt>
          {subtitle ? <Txt v="small" color={t.textMuted} numberOfLines={2}>{subtitle}</Txt> : null}
        </View>
        {value ? <Txt v="small" color={t.textMuted} numberOfLines={1} style={{ maxWidth: '55%' }}>{value}</Txt> : null}
        {right}
        {chevron && <Text style={{ color: t.textFaint, fontSize: 18, marginTop: -2 }}>›</Text>}
      </View>
    </>
  )
  if (!onPress) return <View style={styles.listItem}>{body}</View>
  return (
    <Pressable onPress={() => { haptic(); onPress() }} accessibilityRole="button"
      style={(s) => [styles.listItem, ((s as PressState).pressed || (s as PressState).hovered) && { backgroundColor: t.surfaceHover }]}>
      {body}
    </Pressable>
  )
}

export function SearchField({ value, onChangeText, placeholder, style, trailing, autoFocus }: {
  value: string; onChangeText: (v: string) => void; placeholder: string; style?: StyleProp<ViewStyle>; trailing?: ReactNode; autoFocus?: boolean
}) {
  const [focused, setFocused] = useState(false)
  return (
    <View style={[styles.search, focused && styles.searchFocus, style]}>
      <Search size={17} color={t.textFaint} strokeWidth={STROKE} />
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={t.textFaint}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        autoFocus={autoFocus}
        style={[type.body, styles.searchInput, { color: t.text }, Platform.OS === 'web' && ({ outlineStyle: 'none' } as object)]}
        returnKeyType="search"
        accessibilityLabel={placeholder}
        autoCorrect={false}
        autoCapitalize="none"
      />
      {!!value && (
        <Pressable onPress={() => onChangeText('')} hitSlop={8} accessibilityRole="button" accessibilityLabel="Clear search" style={styles.clear}>
          <X size={11} color="#FFFFFF" strokeWidth={3} />
        </Pressable>
      )}
      {trailing}
    </View>
  )
}

export function SectionHeader({ title, subtitle, action, style }: { title: string; subtitle?: string; action?: { label: string; onPress: () => void }; style?: StyleProp<ViewStyle> }) {
  return (
    <View style={[styles.sectionHeader, style]}>
      <View style={{ flex: 1 }}>
        <Txt v="heading">{title}</Txt>
        {subtitle && <Txt v="small" color={t.textMuted}>{subtitle}</Txt>}
      </View>
      {action && (
        <Pressable onPress={action.onPress} hitSlop={8} accessibilityRole="button">
          <Txt v="smallMedium" color={t.primary} style={{ fontFamily: font.semibold }}>{action.label}</Txt>
        </Pressable>
      )}
    </View>
  )
}
export function SectionLabel({ children, style }: { children: string; style?: StyleProp<ViewStyle> }) {
  return (
    <View style={[{ paddingHorizontal: space.xl, marginTop: space.xl, marginBottom: space.sm }, style]}>
      <Txt v="overline" color={t.textFaint}>{children}</Txt>
    </View>
  )
}

// ── Sheets / dialogs ─────────────────────────────────────────────────────────

/**
 * A bottom sheet on phones; a centred dialog on wide screens (a sheet stretched
 * across a desktop monitor reads as broken).
 */
export function Sheet({ visible, onClose, title, subtitle, children, scroll = true, footer, width = 480 }: {
  visible: boolean; onClose: () => void; title?: string; subtitle?: string; children: ReactNode; scroll?: boolean; footer?: ReactNode; width?: number
}) {
  const insets = useSafeAreaInsets()
  const { isWide } = useLayout()
  return (
    <Modal visible={visible} transparent animationType={isWide ? 'fade' : 'slide'} onRequestClose={onClose} statusBarTranslucent>
      <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel="Close" />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={[styles.sheetWrap, isWide && styles.dialogWrap]} pointerEvents="box-none">
        <View style={[
          styles.sheet, shadow.raised,
          isWide ? { width, maxWidth: '92%', borderRadius: radius.xxl, maxHeight: '86%' } : { paddingBottom: footer ? 0 : Math.max(insets.bottom, space.lg) },
        ]}>
          {!isWide && <View style={styles.grabber} />}
          {title && (
            <View style={[styles.sheetHeader, isWide && { paddingTop: space.xl }]}>
              <View style={{ flex: 1 }}>
                <Txt v="title">{title}</Txt>
                {subtitle && <Txt v="small" color={t.textMuted} style={{ marginTop: 2 }}>{subtitle}</Txt>}
              </View>
              <IconButton icon={X} label="Close" onPress={onClose} size={18} variant="soft" box={34} />
            </View>
          )}
          {scroll ? <ScrollView keyboardShouldPersistTaps="handled" style={{ flexShrink: 1 }} contentContainerStyle={{ paddingBottom: space.md }}>{children}</ScrollView> : children}
          {footer && <View style={[styles.sheetFooter, { paddingBottom: isWide ? space.lg : Math.max(insets.bottom, space.md) }]}>{footer}</View>}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  )
}

export function SheetRow({ icon: Icon, label, detail, onPress, tone, selected, disabled, right, iconColor, iconBg, left }: {
  icon?: LucideIcon; label: string; detail?: string; onPress: () => void; tone?: 'danger'; selected?: boolean; disabled?: boolean
  right?: ReactNode; iconColor?: string; iconBg?: string; left?: ReactNode
}) {
  const color = tone === 'danger' ? t.danger : t.text
  return (
    <Pressable onPress={() => { haptic(); onPress() }} disabled={disabled} accessibilityRole="button"
      style={(s) => [styles.sheetRow, ((s as PressState).pressed || (s as PressState).hovered) && { backgroundColor: t.surfaceHover }, disabled && { opacity: 0.4 }]}>
      {left ?? (Icon && (
        <View style={[styles.rowIcon, { backgroundColor: iconBg ?? (tone === 'danger' ? t.dangerSoft : t.surfaceAlt) }]}>
          <Icon size={18} color={iconColor ?? (tone === 'danger' ? t.danger : t.textSoft)} strokeWidth={STROKE} />
        </View>
      ))}
      <View style={{ flex: 1 }}>
        <Txt v="bodyMedium" color={color}>{label}</Txt>
        {detail ? <Txt v="small" color={t.textMuted} numberOfLines={1}>{detail}</Txt> : null}
      </View>
      {right}
      {selected && <View style={styles.selected}><Check size={13} color="#FFFFFF" strokeWidth={3} /></View>}
    </Pressable>
  )
}

// ── Feedback ─────────────────────────────────────────────────────────────────

export function Notice({ tone, icon: Icon = Info, text, action }: {
  tone: 'warning' | 'danger' | 'primary' | 'neutral' | 'success'; icon?: LucideIcon; text: string; action?: { label: string; onPress: () => void }
}) {
  const [bg, fg] = {
    warning: [t.warningSoft, t.warning], danger: [t.dangerSoft, t.danger], primary: [t.primarySoft, t.primary],
    neutral: [t.surfaceAlt, t.textSoft], success: [t.successSoft, t.success],
  }[tone]
  return (
    <View style={[styles.notice, { backgroundColor: bg }]}>
      <Icon size={15} color={fg} strokeWidth={2} />
      <Txt v="smallMedium" color={fg} style={{ flex: 1 }} numberOfLines={2}>{text}</Txt>
      {action && (
        <Pressable onPress={() => { haptic(); action.onPress() }} hitSlop={8} accessibilityRole="button" style={[styles.noticeAction, { borderColor: fg }]}>
          <Txt v="caption" color={fg} style={{ fontFamily: font.semibold, fontSize: 11 }}>{action.label}</Txt>
        </Pressable>
      )}
    </View>
  )
}
export const Banner = Notice

export function Toast({ text, tone = 'neutral', onHide }: { text: string | null; tone?: 'neutral' | 'danger' | 'success'; onHide: () => void }) {
  const [anim] = useState(() => new Animated.Value(0))
  useEffect(() => {
    if (!text) return undefined
    Animated.spring(anim, { toValue: 1, useNativeDriver: Platform.OS !== 'web', friction: 8 }).start()
    const h = setTimeout(() => {
      Animated.timing(anim, { toValue: 0, duration: 180, useNativeDriver: Platform.OS !== 'web' }).start(() => onHide())
    }, 3000)
    return () => clearTimeout(h)
  }, [text, anim, onHide])
  if (!text) return null
  const Icon = tone === 'danger' ? CircleAlert : tone === 'success' ? CircleCheck : Info
  const iconColor = tone === 'danger' ? '#F87171' : tone === 'success' ? '#34D399' : '#93C5FD'
  return (
    <Animated.View pointerEvents="none" style={[styles.toast, shadow.raised, { opacity: anim, transform: [{ translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [-10, 0] }) }] }]}>
      <Icon size={18} color={iconColor} strokeWidth={2.2} />
      <Txt v="smallMedium" color="#FFFFFF" style={{ flexShrink: 1 }}>{text}</Txt>
    </Animated.View>
  )
}

export function EmptyState({ icon: Icon, title, body, action }: { icon: LucideIcon; title: string; body?: string; action?: { label: string; onPress: () => void } }) {
  return (
    <View style={styles.empty}>
      <View style={styles.emptyIcon}><Icon size={24} color={t.textMuted} strokeWidth={1.6} /></View>
      <Txt v="heading" style={{ marginTop: space.lg, textAlign: 'center' }}>{title}</Txt>
      {body && <Txt v="small" color={t.textMuted} style={{ textAlign: 'center', marginTop: 6, maxWidth: 300 }}>{body}</Txt>}
      {action && <Button title={action.label} kind="outline" size="sm" onPress={action.onPress} style={{ marginTop: space.lg }} />}
    </View>
  )
}

export function Skeleton({ w, h, r = 6, style }: { w: number | `${number}%`; h: number; r?: number; style?: StyleProp<ViewStyle> }) {
  const [anim] = useState(() => new Animated.Value(0.5))
  useEffect(() => {
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(anim, { toValue: 1, duration: 750, useNativeDriver: Platform.OS !== 'web' }),
      Animated.timing(anim, { toValue: 0.5, duration: 750, useNativeDriver: Platform.OS !== 'web' }),
    ]))
    loop.start()
    return () => loop.stop()
  }, [anim])
  return <Animated.View style={[{ width: w, height: h, borderRadius: r, backgroundColor: t.surfaceSunken, opacity: anim }, style]} />
}

export function Divider({ style }: { style?: StyleProp<ViewStyle> }) {
  return <View style={[{ height: StyleSheet.hairlineWidth, backgroundColor: t.border }, style]} />
}

export const inputStyle: TextStyle = {
  ...type.body, color: t.text, backgroundColor: t.surface, borderWidth: 1, borderColor: t.border, borderRadius: radius.md, paddingHorizontal: space.md, minHeight: 44,
}

const styles = StyleSheet.create({
  avatar: { alignItems: 'center', justifyContent: 'center' },
  corner: { position: 'absolute', right: -2, bottom: -2, borderWidth: 2, borderColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' },
  badge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 3, borderRadius: radius.pill, alignSelf: 'flex-start', maxWidth: 220 },
  dot: { width: 6, height: 6, borderRadius: 4 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 11, height: 30, borderRadius: radius.pill, borderWidth: 1 },
  chipOff: { backgroundColor: t.surface, borderColor: t.border },
  chipOn: { backgroundColor: t.primarySoft, borderColor: t.primaryMid },
  chipCount: { minWidth: 17, height: 17, paddingHorizontal: 5, borderRadius: 9, backgroundColor: t.surfaceAlt, alignItems: 'center', justifyContent: 'center' },
  segment: { flexDirection: 'row', backgroundColor: t.surfaceAlt, borderRadius: radius.md, padding: 3, gap: 2 },
  segmentItem: {
    flexGrow: 1, flexShrink: 1, flexBasis: 'auto', minWidth: 0, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5,
    paddingVertical: 6, paddingHorizontal: 8, borderRadius: radius.sm,
  },
  segmentOn: { backgroundColor: t.surface, ...shadow.card, shadowOpacity: 0.08 },
  button: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: space.sm, borderRadius: radius.md },
  iconButton: { alignItems: 'center', justifyContent: 'center' },
  dotBadge: { position: 'absolute', top: 6, right: 6, width: 8, height: 8, borderRadius: 4, backgroundColor: t.primary, borderWidth: 1.5, borderColor: '#fff' },
  countBadge: {
    position: 'absolute', top: -3, right: -3, minWidth: 17, height: 17, borderRadius: 9, paddingHorizontal: 4,
    backgroundColor: t.primary, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: '#fff',
  },
  countBadgeText: { color: '#fff', fontFamily: font.bold, fontSize: 9 },
  card: { backgroundColor: t.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: t.border },
  group: { backgroundColor: t.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: t.border, overflow: 'hidden' },
  listItem: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingLeft: space.lg, backgroundColor: t.surface },
  listIcon: { width: 30, height: 30, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  listBody: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingVertical: 11, paddingRight: space.lg, minHeight: 48 },
  listDivider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: t.border },
  search: {
    flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingHorizontal: 11, height: 38, borderRadius: radius.md,
    backgroundColor: t.surfaceAlt, borderWidth: 1, borderColor: 'transparent',
  },
  searchFocus: { backgroundColor: t.surface, borderColor: t.primary },
  searchInput: { flex: 1, height: 38 },
  clear: { width: 18, height: 18, borderRadius: 9, backgroundColor: t.textFaint, alignItems: 'center', justifyContent: 'center' },
  sectionHeader: { flexDirection: 'row', alignItems: 'flex-end', gap: space.md, marginBottom: space.md },
  backdrop: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(9,9,11,0.42)' },
  sheetWrap: { flex: 1, justifyContent: 'flex-end' },
  dialogWrap: { justifyContent: 'center', alignItems: 'center' },
  sheet: { backgroundColor: t.surface, borderTopLeftRadius: radius.xxl, borderTopRightRadius: radius.xxl, paddingTop: 8, maxHeight: '92%', overflow: 'hidden' },
  grabber: { alignSelf: 'center', width: 36, height: 5, borderRadius: 3, backgroundColor: t.surfaceSunken, marginBottom: 4 },
  sheetHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: space.md, paddingHorizontal: space.xl, paddingTop: space.md, paddingBottom: space.md },
  sheetFooter: { flexDirection: 'row', gap: space.sm, paddingHorizontal: space.xl, paddingTop: space.md, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: t.border, backgroundColor: t.surface },
  sheetRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: space.xl, paddingVertical: 9 },
  rowIcon: { width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  selected: { width: 20, height: 20, borderRadius: 10, backgroundColor: t.primary, alignItems: 'center', justifyContent: 'center' },
  notice: { flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingHorizontal: space.lg, paddingVertical: 8 },
  noticeAction: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: radius.pill, borderWidth: 1 },
  toast: {
    position: 'absolute', top: 14, alignSelf: 'center', zIndex: 50, flexDirection: 'row', alignItems: 'center', gap: 10, maxWidth: 440,
    paddingHorizontal: 16, paddingVertical: 12, borderRadius: radius.lg, backgroundColor: '#18181B',
  },
  empty: { alignItems: 'center', justifyContent: 'center', paddingHorizontal: space.xl, paddingVertical: space.xxxl },
  emptyIcon: { width: 54, height: 54, borderRadius: 16, backgroundColor: t.surfaceAlt, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: t.border },
})
