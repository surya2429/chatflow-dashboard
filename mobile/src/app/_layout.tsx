import { Stack } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import {
  Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold, Inter_800ExtraBold, useFonts,
} from '@expo-google-fonts/inter'
import { AuthProvider } from '@/lib/auth'
import { theme as t } from '@/lib/theme'
import { configureForegroundPresentation } from '@/push/push'

configureForegroundPresentation()

export default function RootLayout() {
  // Inter, as in the dashboard. Nothing renders until it's in, so text never
  // flashes in the system font and then jumps.
  const [fontsLoaded] = useFonts({ Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold, Inter_800ExtraBold })
  if (!fontsLoaded) return null

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <AuthProvider>
          <StatusBar style="dark" />
          <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: t.bg } }} />
        </AuthProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  )
}
