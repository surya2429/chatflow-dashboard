import { Stack, useLocalSearchParams } from 'expo-router'
import { ContactDetails } from '@/components/ContactDetails'

/** Customer details, full screen (phones). On wide screens they sit beside the chat. */
export default function ContactScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  return (
    <>
      <Stack.Screen options={{ title: 'Customer details' }} />
      <ContactDetails contactId={id} />
    </>
  )
}
