import { Tabs } from 'expo-router'
import { useLayout } from '@/lib/theme'
import { AppNav } from '@/components/AppNav'

/**
 * Home — the bots you work, and what needs you now.
 * Inbox — every chat across those bots.
 * Analytics — your numbers (and, for supervisors, anyone's).
 * Profile — your status and account.
 * On tablets and desktop the navigation becomes a sidebar.
 */
export default function TabsLayout() {
  const { isWide } = useLayout()
  return (
    <Tabs
      tabBar={(props) => <AppNav {...props} />}
      screenOptions={{
        headerShown: false,
        tabBarPosition: isWide ? 'left' : 'bottom',
        sceneStyle: { backgroundColor: '#F8FAFC' }, // the dashboard's page colour, same as Home
      }}
    >
      <Tabs.Screen name="index" options={{ title: 'Home' }} />
      <Tabs.Screen name="conversations" options={{ title: 'Inbox' }} />
      <Tabs.Screen name="analytics" options={{ title: 'Analytics' }} />
      <Tabs.Screen name="profile" options={{ title: 'Profile' }} />
    </Tabs>
  )
}
