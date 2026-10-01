import { useEffect } from 'react'
import { ActivityIndicator, Platform, View } from 'react-native'
import { Redirect, Stack, router } from 'expo-router'
import { useAuth } from '@/lib/auth'
import { font, theme as t } from '@/lib/theme'
import { CallProvider } from '@/calls/CallManager'
import { CallScreen } from '@/components/CallScreen'
import { X } from 'lucide-react-native'
import { IconButton } from '@/components/ui'
import { watchNotificationTaps } from '@/push/push'

/** Modals get an explicit close — swipe-down is iOS-only. */
const closeButton = () => (
  <View style={{ marginLeft: Platform.OS === 'ios' ? 0 : 8 }}>
    <IconButton icon={X} label="Close" variant="soft" size={18} box={34}
      onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))} />
  </View>
)

/**
 * Everything behind sign-in: the tab bar (Home · Conversations · Profile) with
 * the message screen and modals stacked on top of it. Notification taps land
 * here — every push carries a conversationId, and tapping one (including the
 * one that cold-started the app) opens that conversation.
 */
export default function AppLayout() {
  const { state } = useAuth()

  useEffect(() => {
    if (state.status !== 'signedIn') return undefined
    return watchNotificationTaps((data) => {
      if (data.conversationId && data.kind !== 'call' && data.kind !== 'call_cancelled') {
        router.push({ pathname: '/conversation/[id]', params: { id: data.conversationId } })
      }
    })
  }, [state.status])

  if (state.status === 'loading') {
    return <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: t.bg }}><ActivityIndicator color={t.primary} /></View>
  }
  if (state.status === 'signedOut') return <Redirect href="/login" />

  return (
    <CallProvider>
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: t.surface },
          headerTintColor: t.text,
          headerTitleStyle: { fontFamily: font.semibold, fontSize: 14.5 },
          headerShadowVisible: false,
          headerBackButtonDisplayMode: 'minimal',
          contentStyle: { backgroundColor: t.bg },
        }}
      >
        <Stack.Screen name="(tabs)" options={{ headerShown: false, title: 'Back' }} />
        <Stack.Screen name="conversation/[id]" options={{ title: '' }} />
        <Stack.Screen name="contact/[id]" options={{ title: 'Customer details', presentation: 'modal', headerLeft: closeButton }} />
        <Stack.Screen name="new" options={{ title: 'New conversation', presentation: 'modal', headerLeft: closeButton }} />
      </Stack>
      <CallScreen />
    </CallProvider>
  )
}
