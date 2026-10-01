import { Stack, useLocalSearchParams } from 'expo-router'
import { ConversationView } from '@/components/thread/ConversationView'

/** Full-screen conversation (phones). On wide screens it opens in the Conversations pane instead. */
export default function ConversationScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <ConversationView key={id} id={id} />
    </>
  )
}
