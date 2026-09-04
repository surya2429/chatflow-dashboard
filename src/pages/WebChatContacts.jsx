import ChannelContacts from '../components/channel/ChannelContacts'

const CONTACTS = [
  { id: 1, name: 'Sarah Wilson',   handle: 'sarah.wilson@gmail.com', avatar: 'SW', tags: ['Customer'],   lastActive: '9m ago',  status: 'active' },
  { id: 2, name: 'Visitor #4821',  handle: 'anonymous',              avatar: 'V4', tags: ['Lead'],       lastActive: '1m ago',  status: 'active' },
  { id: 3, name: 'James Carter',   handle: 'james.carter@outlook.com', avatar: 'JC', tags: ['Trial'],   lastActive: '3h ago',  status: 'active' },
  { id: 4, name: 'Visitor #4790',  handle: 'anonymous',              avatar: 'V4', tags: ['Bounced'],    lastActive: '32m ago', status: 'inactive' },
  { id: 5, name: 'Priya Patel',    handle: 'priya.patel@yahoo.com',  avatar: 'PP', tags: ['Customer', 'VIP'], lastActive: '1 day ago', status: 'inactive' },
]

export default function WebChatContacts() {
  return <ChannelContacts channelName="Website Chat" channelColor="#0066ff" contacts={CONTACTS} />
}
