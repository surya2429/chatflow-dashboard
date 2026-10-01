import { Text as RNText, type TextProps } from 'react-native'
import { font, theme } from '@/lib/theme'

/**
 * Drop-in for react-native's Text that defaults to Inter (the dashboard's
 * typeface) and the base text colour. Anything set in `style` still wins —
 * including a heavier Inter family for bold text.
 */
export function Text({ style, ...rest }: TextProps) {
  return <RNText {...rest} style={[{ fontFamily: font.regular, color: theme.text }, style]} />
}
