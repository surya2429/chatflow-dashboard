import { subDays, format } from 'date-fns'

// --- Home Dashboard ---
export const STATS = [
  { label: 'Total Messages', value: '24,821', trend: '+12.4%', up: true, icon: 'MessageSquare', color: 'green' },
  { label: 'Active Contacts', value: '1,204', trend: '+8.1%', up: true, icon: 'Users', color: 'blue' },
  { label: 'Delivery Rate', value: '98.2%', trend: '-0.3%', up: false, icon: 'CheckCircle2', color: 'emerald' },
  { label: 'Avg Response', value: '3.2s', trend: '+0.8s', up: false, icon: 'Clock', color: 'amber' },
  { label: 'Revenue Driven', value: '₹12,430', trend: '+22.1%', up: true, icon: 'IndianRupee', color: 'purple' },
  { label: 'Appointments', value: '127', trend: '+31%', up: true, icon: 'CalendarCheck', color: 'cyan' },
]

export const MESSAGE_VOLUME = Array.from({ length: 30 }, (_, i) => ({
  date: format(subDays(new Date(), 29 - i), 'MMM d'),
  incoming: Math.floor(300 + Math.random() * 400),
  outgoing: Math.floor(400 + Math.random() * 600),
  bot: Math.floor(200 + Math.random() * 300),
}))

export const TOP_FLOWS = [
  { name: 'Welcome & Onboarding', sent: 4821, conversions: '34.2%', status: 'active' },
  { name: 'Order Tracking Bot', sent: 3102, conversions: '89.1%', status: 'active' },
  { name: 'Lead Qualification', sent: 2890, conversions: '22.7%', status: 'active' },
  { name: 'Appointment Booking', sent: 1940, conversions: '67.4%', status: 'active' },
  { name: 'Product Catalog', sent: 1204, conversions: '41.8%', status: 'paused' },
]

export const RECENT_ACTIVITY = [
  { id: 1, type: 'campaign', text: 'Flash Sale campaign sent to 1,204 contacts', time: '2 min ago', icon: 'Radio' },
  { id: 2, type: 'integration', text: 'Shopify connected successfully', time: '14 min ago', icon: 'Puzzle' },
  { id: 3, type: 'conversation', text: 'Priya Sharma escalated to live agent', time: '31 min ago', icon: 'MessageSquare' },
  { id: 4, type: 'flow', text: 'Lead Qualification flow published', time: '1 hr ago', icon: 'GitBranch' },
  { id: 5, type: 'appointment', text: '3 new appointments booked via bot', time: '2 hr ago', icon: 'CalendarCheck' },
  { id: 6, type: 'voice', text: 'Voice bot handled 12 calls today', time: '3 hr ago', icon: 'PhoneCall' },
]

// --- Agents (live agent team) ---
export const AGENTS = [
  { id: 'a1', name: 'Rahul Mehta',  avatar: 'RM', role: 'Senior Agent', status: 'online',  active: 3, pending: 1, assigned: 4, resolved: 11, avgReply: '2.1m', csat: 4.9, color: 'bg-violet-500' },
  { id: 'a2', name: 'Priya Das',    avatar: 'PD', role: 'Agent',        status: 'online',  active: 2, pending: 1, assigned: 3, resolved: 8,  avgReply: '3.4m', csat: 4.7, color: 'bg-pink-500'   },
  { id: 'a3', name: 'Aryan Kapoor', avatar: 'AK', role: 'Agent',        status: 'busy',    active: 2, pending: 0, assigned: 2, resolved: 7,  avgReply: '5.2m', csat: 4.5, color: 'bg-amber-500'  },
  { id: 'a4', name: 'Sunita Rao',   avatar: 'SR', role: 'Agent',        status: 'offline', active: 0, pending: 0, assigned: 0, resolved: 6,  avgReply: '1.8m', csat: 4.8, color: 'bg-teal-500'   },
]

// --- Conversations ---
export const CONVERSATIONS = [
  {
    id: '1',
    name: 'Priya Sharma',
    phone: '+91 98765 43210',
    avatar: 'PS',
    email: 'priya.sharma@gmail.com',
    company: 'Sharma Enterprises',
    website: '',
    address: 'Flat 4B, Palm Heights, Bandra West',
    city: 'Mumbai',
    state: 'Maharashtra',
    zip: '400050',
    country: 'India',
    dob: '1992-03-18',
    gender: 'Female',
    language: 'English',
    lastMessage: 'Hello! I need help with my order #3821',
    time: '2 min ago',
    unread: 3,
    status: 'agent',
    tags: ['vip', 'order-issue'],
    agentId: 'a1',
    agentName: 'Rahul Mehta',
    source: 'direct',
    starred: false,
    archived: false,
    snoozed: null,
    timestamp: subDays(new Date(), 0).toISOString(),
    labels: ['vip', 'order-issue'],
    messages: [
      { id: 'e0', type: 'event', event: 'ctwa_entry', text: 'Started from Meta Ad: "Summer Flash Sale"', time: '10:40 AM' },
      { id: 't1', type: 'template', direction: 'outgoing', sender: 'Bot',
        template: { name: 'order_confirmation', category: 'TRANSACTIONAL',
          header: 'Order Confirmed! ✅',
          body: 'Hello Priya! Your order #3821 has been confirmed and will be delivered by Apr 17.',
          footer: 'Reply TRACK for live updates',
          buttons: ['Track Order', 'Contact Support'] }, time: '10:41 AM' },
      { id: 'tr1', type: 'incoming', text: 'Track Order', isButtonReply: true, time: '10:42 AM' },
      { id: 'm1', type: 'incoming', text: 'Hello! I need help with my order #3821', time: '10:42 AM', sender: 'Priya' },
      { id: 'e1', type: 'event', event: 'assigned', text: 'Assigned to Rahul Mehta', time: '10:43 AM' },
      { id: 'm2', type: 'outgoing', text: 'Hi Priya! Let me check your order status for you.', time: '10:43 AM', sender: 'Bot' },
      { id: 'n1', type: 'note', text: 'VIP customer — order delayed due to warehouse issue. Offer 10% discount if needed.', sender: 'Rahul Mehta', time: '10:43 AM' },
      { id: 'e2', type: 'event', event: 'bot_handover', text: 'Conversation handed over from Bot to Rahul Mehta', time: '10:44 AM' },
      { id: 'm3', type: 'incoming', text: 'It was supposed to arrive yesterday', time: '10:43 AM', sender: 'Priya' },
      { id: 'm4', type: 'outgoing', text: 'Your order #3821 is confirmed and will arrive by Apr 17. I apologize for the delay!', time: '10:44 AM', sender: 'Agent', agentName: 'Rahul Mehta' },
      { id: 'm5', type: 'incoming', text: 'Ok thank you!', time: '10:44 AM', sender: 'Priya' },
    ],
  },
  {
    id: '2',
    name: 'Rahul Mehta',
    phone: '+91 82341 09876',
    avatar: 'RM',
    email: 'rahul.mehta@techstartup.in',
    company: 'TechStartup Pvt Ltd',
    website: 'www.techstartup.in',
    address: '',
    city: 'Bengaluru',
    state: 'Karnataka',
    zip: '560001',
    country: 'India',
    dob: '',
    gender: 'Male',
    language: 'English',
    lastMessage: 'What are your pricing plans?',
    time: '1 hr ago',
    unread: 1,
    status: 'bot',
    tags: ['lead'],
    agentId: null,
    agentName: null,
    source: 'ctwa',
    starred: false,
    archived: false,
    snoozed: null,
    timestamp: subDays(new Date(), 0).toISOString(),
    labels: ['lead'],
    messages: [
      { id: 'e0', type: 'event', event: 'ctwa_entry', text: 'Started from Google Ad: "ChatFlow Demo"', time: '9:30 AM' },
      { id: 'm1', type: 'incoming', text: 'Hi, I want to know about your pricing plans', time: '9:31 AM', sender: 'Rahul' },
      { id: 'm2', type: 'outgoing', text: 'We have 3 plans: Starter ₹999/mo, Growth ₹2,499/mo, and Enterprise. Which fits your needs?', time: '9:31 AM', sender: 'Bot' },
      { id: 'm3', type: 'incoming', text: 'What are your pricing plans?', time: '9:35 AM', sender: 'Rahul' },
    ],
  },
  {
    id: '3',
    name: 'Anita Kapoor',
    phone: '+91 91234 56789',
    avatar: 'AK',
    lastMessage: 'My appointment is confirmed. Thank you!',
    time: '3 hr ago',
    unread: 0,
    status: 'resolved',
    tags: ['appointment'],
    agentId: 'a2',
    agentName: 'Priya Das',
    source: 'g-ctwa',
    starred: false,
    archived: false,
    snoozed: null,
    timestamp: subDays(new Date(), 0).toISOString(),
    labels: ['appointment'],
    messages: [
      { id: 'm1', type: 'incoming', text: 'I want to book a consultation', time: '7:20 AM', sender: 'Anita' },
      { id: 'm2', type: 'outgoing', text: 'Great! I have slots available on Apr 16 at 10 AM, 2 PM, or 4 PM. Which works for you?', time: '7:20 AM', sender: 'Bot' },
      { id: 'm3', type: 'incoming', text: '2 PM please', time: '7:22 AM', sender: 'Anita' },
      { id: 'm4', type: 'outgoing', text: 'Confirmed! Your appointment is on Apr 16 at 2 PM. You will receive a reminder 1 hour before.', time: '7:22 AM', sender: 'Bot' },
      { id: 'm5', type: 'incoming', text: 'My appointment is confirmed. Thank you!', time: '7:23 AM', sender: 'Anita' },
    ],
  },
  {
    id: '4',
    name: 'Vikram Singh',
    phone: '+91 77890 12345',
    avatar: 'VS',
    lastMessage: 'Can I get a refund?',
    time: '5 hr ago',
    unread: 0,
    status: 'bot',
    tags: ['refund'],
    agentId: null,
    agentName: null,
    source: 't-ctwa',
    starred: false,
    archived: false,
    snoozed: null,
    timestamp: subDays(new Date(), 1).toISOString(),
    labels: ['refund'],
    messages: [
      { id: 'm1', type: 'incoming', text: 'Can I get a refund for my order?', time: '5:10 AM', sender: 'Vikram' },
      { id: 'm2', type: 'outgoing', text: 'I can help you with that. Please share your order ID.', time: '5:10 AM', sender: 'Bot' },
      { id: 'm3', type: 'incoming', text: 'Can I get a refund?', time: '5:12 AM', sender: 'Vikram' },
    ],
  },
  {
    id: '5',
    name: 'Meera Joshi',
    phone: '+91 88001 23456',
    avatar: 'MJ',
    lastMessage: 'Perfect! See you tomorrow.',
    time: '1 day ago',
    unread: 0,
    status: 'resolved',
    tags: ['satisfied'],
    agentId: 'a3',
    agentName: 'Aryan Kapoor',
    source: 'direct',
    channel: 'whatsapp',
    starred: false,
    archived: false,
    snoozed: null,
    timestamp: subDays(new Date(), 2).toISOString(),
    labels: ['satisfied'],
    messages: [
      { id: 'm1', type: 'incoming', text: 'Is the product available in blue?', time: 'Yesterday', sender: 'Meera' },
      { id: 'm2', type: 'outgoing', text: 'Yes! Blue is available in sizes S, M, and L. Would you like to order?', time: 'Yesterday', sender: 'Bot' },
      { id: 'm3', type: 'incoming', text: 'Perfect! See you tomorrow.', time: 'Yesterday', sender: 'Meera' },
    ],
  },
  {
    id: '6',
    name: 'Suresh Verma',
    phone: '+91 94500 67890',
    avatar: 'SV',
    lastMessage: 'Missed call • 3 min 12 sec',
    time: '20 min ago',
    unread: 1,
    status: 'bot',
    tags: ['support'],
    agentId: null,
    agentName: null,
    source: 'direct',
    channel: 'calls',
    starred: false,
    archived: false,
    snoozed: null,
    timestamp: subDays(new Date(), 0).toISOString(),
    labels: ['support'],
    messages: [
      { id: 'e1', type: 'event', event: 'call_missed', text: 'Missed WhatsApp call · 3m 12s', time: '10:10 AM' },
      { id: 'm1', type: 'outgoing', text: 'We missed your call! How can we help you?', time: '10:12 AM', sender: 'Bot' },
      { id: 'm2', type: 'incoming', text: 'I had a billing question.', time: '10:13 AM', sender: 'Suresh' },
    ],
  },
  {
    id: 'call-2',
    name: 'Kavya Reddy',
    phone: '+91 88001 22334',
    avatar: 'KR',
    lastMessage: '📞 Inbound call · 5m 40s · Answered',
    time: '1 hour ago',
    unread: 0,
    status: 'resolved',
    tags: ['support'],
    agentId: 'a2',
    agentName: 'Priya Das',
    source: 'direct',
    channel: 'calls',
    starred: false,
    archived: false,
    snoozed: null,
    timestamp: subDays(new Date(), 0).toISOString(),
    labels: ['support'],
    messages: [
      { id: 'e1', type: 'event', event: 'call_answered', text: 'Inbound WhatsApp call · 5m 40s · Answered by Priya Das', time: '9:20 AM' },
      { id: 'n1', type: 'note', text: 'Customer called about product return policy. Resolved — approved return for order #7821.', sender: 'Priya Das', time: '9:26 AM' },
      { id: 'e2', type: 'event', event: 'assigned', text: 'Resolved by Priya Das', time: '9:27 AM' },
    ],
  },
  {
    id: 'call-3',
    name: 'Arjun Nair',
    phone: '+91 77009 88123',
    avatar: 'AN',
    lastMessage: '📞 Outbound call · Missed',
    time: '3 hours ago',
    unread: 0,
    status: 'open',
    tags: ['follow-up'],
    agentId: 'admin',
    agentName: 'Deepak Kumar',
    source: 'direct',
    channel: 'calls',
    starred: false,
    archived: false,
    snoozed: null,
    timestamp: subDays(new Date(), 0).toISOString(),
    labels: ['follow-up'],
    messages: [
      { id: 'e1', type: 'event', event: 'call_missed', text: 'Outbound WhatsApp call · No answer · Deepak Kumar', time: '8:10 AM' },
      { id: 'n1', type: 'note', text: 'Called to follow up on demo request. No answer — retry later today.', sender: 'Deepak Kumar', time: '8:11 AM' },
    ],
  },
  {
    id: '7',
    name: 'Nisha Agarwal',
    phone: '+91 96001 34567',
    avatar: 'NA',
    lastMessage: 'Thanks for the flash sale update!',
    time: '45 min ago',
    unread: 0,
    status: 'agent',
    tags: ['lead'],
    agentId: 'a2',
    agentName: 'Priya Das',
    source: 'broadcast',
    channel: 'whatsapp',
    starred: true,
    archived: false,
    snoozed: null,
    timestamp: subDays(new Date(), 0).toISOString(),
    labels: ['lead'],
    messages: [
      { id: 'e1', type: 'event', event: 'broadcast', text: 'Received "Flash Sale – Apr 15" broadcast message', time: '9:00 AM' },
      { id: 'm1', type: 'outgoing', text: 'Hi Nisha! Our biggest sale is LIVE today. Use code SAVE20 for 20% off! 🎉', time: '9:00 AM', sender: 'Bot' },
      { id: 'm2', type: 'incoming', text: 'Thanks for the flash sale update!', time: '9:05 AM', sender: 'Nisha' },
      { id: 'e2', type: 'event', event: 'assigned', text: 'Assigned to Priya Das', time: '9:06 AM' },
    ],
  },
]

// --- Analytics ---
export const ANALYTICS_DAILY = Array.from({ length: 30 }, (_, i) => ({
  date: format(subDays(new Date(), 29 - i), 'MMM d'),
  incoming: Math.floor(180 + Math.random() * 220),
  outgoing: Math.floor(300 + Math.random() * 350),
  resolved: Math.floor(100 + Math.random() * 150),
  leads: Math.floor(10 + Math.random() * 40),
  appointments: Math.floor(2 + Math.random() * 15),
}))

export const TEMPLATE_STATS = [
  { name: 'Order Confirmation', category: 'Transactional', sent: 4821, delivered: 98.2, read: 71.3, replied: 12.4, ctr: 8.2 },
  { name: 'Flash Sale Promo', category: 'Marketing', sent: 9204, delivered: 96.1, read: 68.7, replied: 9.1, ctr: 6.8 },
  { name: 'Appointment Reminder', category: 'Utility', sent: 1940, delivered: 99.1, read: 82.4, replied: 44.2, ctr: 38.1 },
  { name: 'Welcome Message', category: 'Marketing', sent: 3102, delivered: 97.8, read: 74.9, replied: 18.3, ctr: 12.7 },
  { name: 'Shipping Update', category: 'Transactional', sent: 2890, delivered: 98.9, read: 79.2, replied: 6.1, ctr: 4.3 },
  { name: 'Feedback Request', category: 'Utility', sent: 1204, delivered: 96.4, read: 61.8, replied: 28.7, ctr: 22.1 },
]

export const AI_USAGE = Array.from({ length: 14 }, (_, i) => ({
  date: format(subDays(new Date(), 13 - i), 'MMM d'),
  tokens: Math.floor(40000 + Math.random() * 60000),
  cost: parseFloat((Math.random() * 5 + 1).toFixed(2)),
  requests: Math.floor(200 + Math.random() * 400),
}))

export const RESOLUTION_DATA = [
  { name: 'Bot Resolved', value: 72, color: '#25D366' },
  { name: 'Agent Resolved', value: 21, color: '#3B82F6' },
  { name: 'Escalated', value: 7, color: '#F59E0B' },
]

export const CHANNEL_BREAKDOWN = [
  { name: 'WhatsApp Bot', value: 68, color: '#25D366' },
  { name: 'Live Agent', value: 22, color: '#3B82F6' },
  { name: 'Voice Bot', value: 10, color: '#8B5CF6' },
]

// --- Broadcasting ---
export const CAMPAIGNS = [
  { id: 'c1', name: 'Flash Sale – Apr 15', type: 'Bulk', status: 'sent', sent: 1204, delivered: 98.2, read: 71.3, replied: 9.1, date: 'Apr 15, 10:00 AM' },
  { id: 'c2', name: 'Diwali Promo', type: 'Scheduled', status: 'scheduled', sent: 0, delivered: 0, read: 0, replied: 0, date: 'Oct 25, 9:00 AM' },
  { id: 'c3', name: 'Welcome Series (7-day)', type: 'Drip', status: 'active', sent: 3102, delivered: 97.8, read: 74.9, replied: 18.3, date: 'Ongoing' },
  { id: 'c4', name: 'Abandoned Cart Recovery', type: 'Drip', status: 'active', sent: 821, delivered: 96.4, read: 68.2, replied: 31.4, date: 'Ongoing' },
  { id: 'c5', name: 'Product Launch Blast', type: 'Single', status: 'sent', sent: 4821, delivered: 96.1, read: 68.7, replied: 9.1, date: 'Apr 10, 2:00 PM' },
]

export const TEMPLATES = [
  // ── Original templates ──────────────────────────────────────────────────
  { id: 't1', name: 'order_confirmation',        language: 'English', category: 'TRANSACTIONAL', status: 'APPROVED', headerType: 'NONE',     body: 'Hello {{1}}, your order #{{2}} has been confirmed! Expected delivery: {{3}}.',                                                                          buttons: ['Track Order', 'Contact Support']        },
  { id: 't2', name: 'flash_sale_promo',           language: 'English', category: 'MARKETING',     status: 'APPROVED', headerType: 'IMAGE',    body: 'Hi {{1}}! Our biggest sale is LIVE! Use code {{2}} for {{3}}% off. Shop now: {{4}}',                                                                      buttons: ['Shop Now']                              },
  { id: 't3', name: 'appointment_reminder',       language: 'English', category: 'UTILITY',       status: 'APPROVED', headerType: 'NONE',     body: 'Reminder: You have an appointment on {{1}} at {{2}}. Reply CONFIRM or RESCHEDULE.',                                                                        buttons: ['Confirm', 'Reschedule']                 },
  { id: 't4', name: 'welcome_message',            language: 'English', category: 'MARKETING',     status: 'APPROVED', headerType: 'NONE',     body: "Welcome to {{1}}, {{2}}! We're thrilled to have you. Type HELP to see what I can do.",                                                                     buttons: []                                        },
  { id: 't5', name: 'shipping_update',            language: 'English', category: 'TRANSACTIONAL', status: 'PENDING',  headerType: 'NONE',     body: 'Great news {{1}}! Order #{{2}} has been shipped. Track here: {{3}}',                                                                                       buttons: ['Track Order']                           },
  // ── Rich templates (all header / param / button types) ─────────────────
  { id: 'at1', name: 'exclusive_festival_offer',  language: 'English', category: 'MARKETING',     status: 'APPROVED', headerType: 'IMAGE',    body: 'Hi {{1}}, as a cherished member, we have a special festival surprise just for you! 🎁',                                                                    buttons: ['Know more', 'Visit us']                 },
  { id: 'at2', name: 'spring_sale_final',         language: 'English', category: 'MARKETING',     status: 'APPROVED', headerType: 'IMAGE',    body: "Hi {{1}}, up to 40% off ends at midnight. Don't miss out!",                                                                                                buttons: ['Shop Now']                              },
  { id: 'at3', name: 'store_credits_reminder',    language: 'English', category: 'MARKETING',     status: 'APPROVED', headerType: 'TEXT',     body: 'Hi {{1}}, you have ₹{{2}} in store credits. Use them before {{3}}.',                                                                                       buttons: ['Use Credits Now', 'View Balance']       },
  { id: 'at4', name: 'order_confirmation_v3',     language: 'English', category: 'UTILITY',       status: 'APPROVED', headerType: 'TEXT',     body: 'Hi {{1}}, your order #{{2}} is confirmed and arrives by {{3}}.',                                                                                           buttons: ['Track Order', 'Contact Support']        },
  { id: 'at5', name: 'payment_receipt',           language: 'English', category: 'UTILITY',       status: 'APPROVED', headerType: 'DOCUMENT', body: 'Hi {{1}}, your payment of ₹{{2}} has been received. Receipt #{{3}} is attached.',                                                                          buttons: ['Download Receipt', 'Copy Receipt No.'] },
  { id: 'at6', name: 'store_pickup_location',     language: 'English', category: 'UTILITY',       status: 'APPROVED', headerType: 'LOCATION', body: 'Hi {{1}}, your order is ready for pickup at our {{2}} store.',                                                                                             buttons: ['Get Directions', 'Call Store']          },
  { id: 'at7', name: 'video_tutorial_welcome',    language: 'English', category: 'UTILITY',       status: 'APPROVED', headerType: 'VIDEO',    body: 'Hi {{1}}, your account is active! Watch the intro video to get started. Your free trial expires on {{2}}.',                                                 buttons: ['Watch Now', 'Skip']                     },
  { id: 'at8', name: 'invoice_payment_due',       language: 'English', category: 'UTILITY',       status: 'APPROVED', headerType: 'DOCUMENT', body: 'Hi {{1}}, invoice #{{2}} for {{3}} is due on {{4}}. Pay early to save {{5}}. Use the code below for an instant discount!',                                buttons: ['Pay Now', 'Get Discount', 'Contact Billing'] },
  { id: 'at9', name: 'appointment_confirmation',  language: 'English', category: 'UTILITY',       status: 'APPROVED', headerType: 'TEXT',     body: 'Hi {{1}}, your appointment with {{2}} is confirmed for {{3}}. Consultation fee: {{4}}. Please arrive 10 min early.',                                       buttons: ['Add to Calendar', 'Reschedule', 'Copy Ref No.'] },
  { id: 'at10', name: 'order_invoice_full_summary', language: 'English', category: 'UTILITY',     status: 'APPROVED', headerType: 'TEXT',     body: 'Hi {{2}}, here is your order summary:\n\nItems subtotal: {{3}}\nTax (18% GST): {{4}}\nGrand total: {{5}}\n\nEstimated delivery: {{6}}\nTracking ID: {{7}}', buttons: ['Track Order', 'Copy Order ID', 'Need Help?'] },
]

// --- Voice ---
export const CALL_HISTORY = [
  { id: 'cl1', caller: '+91 98765 43210', duration: '3m 42s', status: 'Resolved', date: 'Apr 15, 2:30 PM', hasTranscript: true },
  { id: 'cl2', caller: '+91 82341 09876', duration: '0m 28s', status: 'Missed', date: 'Apr 15, 1:12 PM', hasTranscript: false },
  { id: 'cl3', caller: '+91 91234 56789', duration: '8m 12s', status: 'Transferred', date: 'Apr 14, 5:44 PM', hasTranscript: true },
  { id: 'cl4', caller: '+91 77890 12345', duration: '1m 55s', status: 'Resolved', date: 'Apr 14, 3:20 PM', hasTranscript: true },
  { id: 'cl5', caller: '+91 88001 23456', duration: '5m 10s', status: 'Resolved', date: 'Apr 13, 11:00 AM', hasTranscript: true },
]

export const VOICE_STATS = [
  { label: 'Total Calls', value: '312', trend: '+18%', up: true, icon: 'PhoneCall', color: 'purple' },
  { label: 'Bot Resolved', value: '71%', trend: '+4%', up: true, icon: 'Bot', color: 'green' },
  { label: 'Avg Duration', value: '3m 12s', trend: '-0.4s', up: true, icon: 'Clock', color: 'blue' },
  { label: 'Missed Calls', value: '14', trend: '-3', up: true, icon: 'PhoneMissed', color: 'red' },
]

// --- Flows ---
export const FLOWS = [
  { id: 'f1', name: 'Welcome & Onboarding', description: 'Greet new contacts and capture lead info', nodes: 8, status: 'active', sent: 4821, conversions: '34.2%', updatedAt: 'Apr 14' },
  { id: 'f2', name: 'Order Tracking Bot', description: 'Let customers track orders via order ID', nodes: 12, status: 'active', sent: 3102, conversions: '89.1%', updatedAt: 'Apr 12' },
  { id: 'f3', name: 'Lead Qualification', description: 'Qualify inbound leads with BANT questions', nodes: 15, status: 'active', sent: 2890, conversions: '22.7%', updatedAt: 'Apr 10' },
  { id: 'f4', name: 'Appointment Booking', description: 'Book appointments with calendar integration', nodes: 10, status: 'active', sent: 1940, conversions: '67.4%', updatedAt: 'Apr 9' },
  { id: 'f5', name: 'Product Catalog', description: 'Browse and order products from catalog', nodes: 20, status: 'paused', sent: 1204, conversions: '41.8%', updatedAt: 'Apr 5' },
  { id: 'f6', name: 'Support Triage', description: 'Route support queries to right department', nodes: 9, status: 'draft', sent: 0, conversions: '—', updatedAt: 'Apr 3' },
]

// --- Past Conversations ---
export const PAST_CONVERSATIONS = [
  { id: 'pc1', contactId: '1', contactName: 'Priya Sharma', snippet: 'Order #3102 inquiry resolved.', date: 'Apr 10', status: 'resolved', agent: 'Priya Das', msgCount: 8 },
  { id: 'pc2', contactId: '1', contactName: 'Priya Sharma', snippet: 'Refund processed for order #2891.', date: 'Mar 28', status: 'resolved', agent: 'Rahul Mehta', msgCount: 12 },
  { id: 'pc3', contactId: '2', contactName: 'Rahul Mehta', snippet: 'Pricing inquiry — sent Growth plan details.', date: 'Apr 2', status: 'resolved', agent: 'Bot', msgCount: 5 },
]

// --- Mock Orders ---
export const MOCK_ORDERS = [
  { id: 'ORD-3821', status: 'In Transit', amount: '₹2,999', date: 'Apr 15', items: 1, statusColor: 'badge-blue' },
  { id: 'ORD-3102', status: 'Delivered',  amount: '₹1,499', date: 'Apr 10', items: 2, statusColor: 'badge-green' },
  { id: 'ORD-2891', status: 'Refunded',   amount: '₹899',   date: 'Mar 28', items: 1, statusColor: 'badge-red' },
]
