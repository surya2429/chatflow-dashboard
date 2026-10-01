import { useWindowDimensions, type TextStyle, type ViewStyle } from 'react-native'

/**
 * Design tokens — modern neutral UI (zinc greys, hairline borders, restrained
 * shadows) with the dashboard's brand: accent #0066FF and Inter.
 */
const colors = {
  // Surfaces
  bg: '#F7F7F8',
  surface: '#FFFFFF',
  surfaceAlt: '#F4F4F5',
  surfaceHover: '#F4F4F5',
  surfaceSunken: '#EDEDEF',
  sidebar: '#FBFBFC',
  border: '#E4E4E7',
  borderSoft: '#EFEFF1',
  borderStrong: '#D4D4D8',
  hairline: '#EBEBED',

  // Text
  text: '#09090B',
  textStrong: '#18181B',
  textSoft: '#3F3F46',
  textMuted: '#71717A',
  textFaint: '#A1A1AA',

  // Brand
  primary: '#0066FF',
  primaryHover: '#0055D6',
  primaryDeep: '#0A3FA8',
  primarySoft: '#EEF4FF',
  primaryTint: '#DBE7FF',
  primaryMid: '#B6CEFF',
  onPrimary: '#FFFFFF',
  gradient: ['#0A5CFF', '#2C7BFF', '#5B9BFF'] as const,

  // Semantic
  success: '#047857',
  successSoft: '#ECFDF5',
  successBorder: '#A7F3D0',
  successDot: '#10B981',
  warning: '#B45309',
  warningSoft: '#FFFBEB',
  warningBorder: '#FDE68A',
  danger: '#B91C1C',
  dangerSolid: '#EF4444',
  dangerSoft: '#FEF2F2',
  dangerBorder: '#FECACA',
  purple: '#6D28D9',
  purpleSoft: '#F5F3FF',
  purpleBorder: '#DDD6FE',
  neutralSoft: '#F4F4F5',
  neutralBorder: '#E4E4E7',

  // Chat
  chatBg: '#F3F5F9',
  chatDots: '#DCE1EA',
  incomingBg: '#FFFFFF',
  outgoingBg: '#0066FF',
  outgoingText: '#FFFFFF',
  botBg: '#EEF4FF',
  noteBg: '#FFFBEB',
  noteBorder: '#FCD34D',

  // Sign-in hero
  navy: '#0A1224',
  navySoft: '#131E36',

  status: { bot: '#3B82F6', agent: '#10B981', resolved: '#A1A1AA' },
  channel: { whatsapp: '#25D366', instagram: '#E1306C', webchat: '#6366F1' },
  channelDark: { whatsapp: '#128C7E', instagram: '#C13584', webchat: '#4F46E5' },
  presence: { online: '#10B981', away: '#F59E0B', offline: '#A1A1AA' },
}

export type Theme = typeof colors
export function useTheme(): Theme {
  return colors
}
export const theme = colors

export const space = { xxs: 2, xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 28, xxxl: 40 }
export const radius = { sm: 8, md: 10, lg: 14, xl: 18, xxl: 24, pill: 999 }

/** Inter at each weight — custom fonts need the weight baked into the family on Android. */
export const font = {
  regular: 'Inter_400Regular',
  medium: 'Inter_500Medium',
  semibold: 'Inter_600SemiBold',
  bold: 'Inter_700Bold',
  extrabold: 'Inter_800ExtraBold',
}

export const type: Record<
  'largeTitle' | 'display' | 'title' | 'heading' | 'subheading' | 'body' | 'bodyMedium' | 'small' | 'smallMedium' | 'caption' | 'overline',
  TextStyle
> = {
  largeTitle: { fontFamily: font.bold, fontSize: 22, lineHeight: 28, letterSpacing: -0.5 },
  display: { fontFamily: font.bold, fontSize: 26, lineHeight: 32, letterSpacing: -0.7 },
  title: { fontFamily: font.semibold, fontSize: 16, lineHeight: 21, letterSpacing: -0.25 },
  heading: { fontFamily: font.semibold, fontSize: 14, lineHeight: 19, letterSpacing: -0.15 },
  subheading: { fontFamily: font.semibold, fontSize: 13.5, lineHeight: 18, letterSpacing: -0.1 },
  body: { fontFamily: font.regular, fontSize: 13.5, lineHeight: 19 },
  bodyMedium: { fontFamily: font.medium, fontSize: 13.5, lineHeight: 19 },
  small: { fontFamily: font.regular, fontSize: 12, lineHeight: 16 },
  smallMedium: { fontFamily: font.medium, fontSize: 12, lineHeight: 16 },
  caption: { fontFamily: font.medium, fontSize: 10.5, lineHeight: 13 },
  overline: { fontFamily: font.semibold, fontSize: 10, lineHeight: 12, letterSpacing: 0.5, textTransform: 'uppercase' },
}

export const shadow: Record<'card' | 'raised' | 'button' | 'floating' | 'none', ViewStyle> = {
  none: {},
  card: { shadowColor: '#18181B', shadowOpacity: 0.04, shadowRadius: 6, shadowOffset: { width: 0, height: 1 }, elevation: 1 },
  raised: { shadowColor: '#18181B', shadowOpacity: 0.14, shadowRadius: 28, shadowOffset: { width: 0, height: 12 }, elevation: 12 },
  button: { shadowColor: '#0066FF', shadowOpacity: 0.25, shadowRadius: 8, shadowOffset: { width: 0, height: 3 }, elevation: 3 },
  floating: { shadowColor: '#18181B', shadowOpacity: 0.1, shadowRadius: 20, shadowOffset: { width: 0, height: 6 }, elevation: 10 },
}

/**
 * Responsive breakpoints: phone → tablet (rail + list + chat) → desktop (sidebar + three panes).
 * "Wide" also needs some height, so a phone turned sideways keeps the phone layout.
 */
export const BREAKPOINT = { wide: 768, xl: 1280, minWideHeight: 480 }
export const SPLIT_MIN_WIDTH = BREAKPOINT.wide

export function useLayout() {
  const { width, height } = useWindowDimensions()
  const isWide = width >= BREAKPOINT.wide && height >= BREAKPOINT.minWideHeight
  const isXL = isWide && width >= BREAKPOINT.xl
  /** Width of the navigation column on this screen (bottom bar on phones → 0). */
  const navWidth = !isWide ? 0 : isXL ? 256 : 76
  return { width, height, isWide, isXL, isTablet: Math.min(width, height) >= 600, navWidth, contentWidth: width - navWidth }
}
