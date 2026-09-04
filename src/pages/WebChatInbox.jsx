import ChannelInbox from '../components/channel/ChannelInbox'

const CONVERSATIONS = [
  {
    id: 1, name: 'Visitor #4821', avatar: 'V4', time: '1m', unread: 1,
    lastMessage: 'Do you have a refund policy?', subtitle: 'pricing page · Chrome / Windows',
    messages: [
      { id: 1, from: 'contact', text: 'Hi, quick question about pricing', time: '11:10 AM' },
      { id: 2, from: 'contact', text: 'Do you have a refund policy?', time: '11:11 AM' },
    ],
  },
  {
    id: 2, name: 'Sarah Wilson', avatar: 'SW', time: '9m', unread: 0,
    lastMessage: 'Perfect, thank you!', subtitle: 'checkout page · Safari / macOS',
    messages: [
      { id: 1, from: 'contact', text: 'Is live chat support 24/7?', time: '10:55 AM' },
      { id: 2, from: 'agent', text: 'Yes! We\'re here around the clock.', time: '10:57 AM' },
      { id: 3, from: 'contact', text: 'Perfect, thank you!', time: '10:58 AM' },
    ],
  },
  {
    id: 3, name: 'Visitor #4790', avatar: 'V4', time: '32m', unread: 0,
    lastMessage: 'Left the chat', subtitle: 'homepage · Firefox / Linux',
    messages: [
      { id: 1, from: 'contact', text: 'Just browsing, thanks', time: '10:25 AM' },
    ],
  },
]

export default function WebChatInbox() {
  return <ChannelInbox channelName="Website Chat" channelColor="#0066ff" conversations={CONVERSATIONS} />
}
