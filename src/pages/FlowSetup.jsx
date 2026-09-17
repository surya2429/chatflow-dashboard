// FlowSetup.jsx — Complete rewrite with Tailwind CSS
import { useState, useRef, useEffect, useCallback, useMemo } from 'react'
import WAFlowPreview from '../components/whatsapp/WAFlowPreview'
import clsx from 'clsx'
import {
  Plus, X, ChevronLeft, ChevronRight, ChevronDown, ChevronUp,
  Save, Trash2, Copy, Edit3, Check, Search, CalendarX2,
  MessageSquare, Hash, Phone, Mail, Calendar, MapPin, Paperclip,
  Image, FileText, Clock, GitFork, List, Globe, UserCheck, User, Tag,
  MousePointer2, Zap, Database, Variable, Mic,
  ZoomIn, ZoomOut, CornerDownRight,
  Cpu, CheckCircle, Package, Layout,
  ShoppingCart, Users, Building, Repeat, SlidersHorizontal,
  BookOpen, HelpCircle, AlertCircle, CreditCard, BarChart2, Briefcase,
  Video, Maximize2,
  ArrowRight, ArrowLeft, Activity,
  Play,
} from 'lucide-react'
import { NativeSelect } from '../components/Select'

// ─── Node Definitions ─────────────────────────────────────────────────────────

const DEFS = {
  start:          { label: 'Start',                  icon: Zap,              color: '#0066ff', cat: 'system'    },
  end:            { label: 'End Flow',               icon: X,                color: '#64748b', cat: 'system'    },
  text:           { label: 'Send Text',              icon: MessageSquare,    color: '#10b981', cat: 'send'      },
  media:          { label: 'Send Media',             icon: Image,            color: '#10b981', cat: 'send'      },
  send_buttons:   { label: 'Send Buttons',           icon: MousePointer2,    color: '#10b981', cat: 'send'      },
  send_list:      { label: 'Send List',              icon: List,             color: '#10b981', cat: 'send'      },
  template:       { label: 'Send Template',          icon: Layout,           color: '#10b981', cat: 'send'      },
  send_voice:     { label: 'Send Voice',             icon: Mic,              color: '#10b981', cat: 'send'      },
  catalog:        { label: 'Send Catalog',           icon: Package,          color: '#10b981', cat: 'send'      },
  ask_text:       { label: 'Ask Text',               icon: MessageSquare,    color: '#f59e0b', cat: 'ask'       },
  ask_number:     { label: 'Ask Number',             icon: Hash,             color: '#f59e0b', cat: 'ask'       },
  ask_phone:      { label: 'Ask Phone',              icon: Phone,            color: '#f59e0b', cat: 'ask'       },
  ask_email:      { label: 'Ask Email',              icon: Mail,             color: '#f59e0b', cat: 'ask'       },
  ask_date:       { label: 'Ask Date',               icon: Calendar,         color: '#f59e0b', cat: 'ask'       },
  ask_location:   { label: 'Ask Location',           icon: MapPin,           color: '#f59e0b', cat: 'ask'       },
  ask_url:        { label: 'Ask URL',                icon: Globe,            color: '#f59e0b', cat: 'ask'       },
  ask_file:       { label: 'Ask File',               icon: Paperclip,        color: '#f59e0b', cat: 'ask'       },
  ask_button:     { label: 'Ask with Buttons',       icon: MousePointer2,    color: '#f59e0b', cat: 'ask'       },
  ask_list:       { label: 'Ask with List',          icon: List,             color: '#f59e0b', cat: 'ask'       },
  ask_keyword:         { label: 'Ask with Keywords',      icon: Tag,              color: '#f59e0b', cat: 'ask'       },
  ask_appointment:     { label: 'Appointment Booking',   icon: Calendar,         color: '#8b5cf6', cat: 'ask'       },
  ask_appointment_off: { label: 'Offline Appointment',   icon: Briefcase,        color: '#6366f1', cat: 'ask'       },
  ask_collection: { label: 'Ask Collection',         icon: Package,          color: '#f59e0b', cat: 'ask'       },
  ask_form:       { label: 'Ask Form',               icon: FileText,         color: '#f59e0b', cat: 'ask'       },
  ask_payment:    { label: 'Ask Payment',            icon: CreditCard,       color: '#f59e0b', cat: 'ask'       },
  assign:         { label: 'Assign Conversation',   icon: User,             color: '#3b82f6', cat: 'action'    },
  unassign:       { label: 'Unassign Conversation', icon: UserCheck,        color: '#3b82f6', cat: 'action'    },
  resolve:        { label: 'Resolve Conversation',  icon: CheckCircle,      color: '#3b82f6', cat: 'action'    },
  update_conv:    { label: 'Update Conversation',   icon: Edit3,            color: '#3b82f6', cat: 'action'    },
  update_contact: { label: 'Update Contact',        icon: UserCheck,        color: '#3b82f6', cat: 'action'    },
  update_company: { label: 'Update Company',        icon: Building,         color: '#3b82f6', cat: 'action'    },
  push_seq:       { label: 'Push to Sequence',      icon: Repeat,           color: '#3b82f6', cat: 'action'    },
  add_note:       { label: 'Add Note',              icon: FileText,         color: '#3b82f6', cat: 'action'    },
  delay:          { label: 'Delay',                 icon: Clock,            color: '#8b5cf6', cat: 'utility'   },
  condition:      { label: 'Condition',             icon: GitFork,          color: '#8b5cf6', cat: 'utility'   },
  set_var:        { label: 'Set Variable',          icon: Variable,         color: '#8b5cf6', cat: 'utility'   },
  jump:           { label: 'Jump to Step',          icon: CornerDownRight,  color: '#8b5cf6', cat: 'utility'   },
  switch_node:    { label: 'Switch',                icon: SlidersHorizontal,color: '#8b5cf6', cat: 'utility'   },
  gpt_dialog:     { label: 'GPT Dialog',            icon: Cpu,              color: '#8b5cf6', cat: 'utility'   },
  gpt_kb:         { label: 'GPT Knowledge Base',   icon: BookOpen,         color: '#8b5cf6', cat: 'utility'   },
  working_hours:  { label: 'Working Hours',         icon: Clock,            color: '#8b5cf6', cat: 'utility'   },
  hint:           { label: 'Hint',                  icon: HelpCircle,       color: '#8b5cf6', cat: 'utility'   },
  wait_order:     { label: 'Wait for Order',        icon: ShoppingCart,     color: '#8b5cf6', cat: 'utility'   },
  sheets:         { label: 'Google Sheets',         icon: Database,         color: '#06b6d4', cat: 'connector' },
  api:            { label: 'API Request',           icon: Globe,            color: '#06b6d4', cat: 'connector' },
  razorpay:       { label: 'Razorpay',              icon: CreditCard,       color: '#06b6d4', cat: 'connector' },
  zoho_crm:       { label: 'Zoho CRM',              icon: Briefcase,        color: '#06b6d4', cat: 'connector' },
  shopify:        { label: 'Shopify',               icon: ShoppingCart,     color: '#06b6d4', cat: 'connector' },
  hubspot:        { label: 'HubSpot',               icon: BarChart2,        color: '#06b6d4', cat: 'connector' },
  zoho_bigin:     { label: 'Zoho Bigin',            icon: Briefcase,        color: '#06b6d4', cat: 'connector' },
  leadsquared:    { label: 'LeadSquared',           icon: Users,            color: '#06b6d4', cat: 'connector' },
  woocommerce:    { label: 'WooCommerce',           icon: ShoppingCart,     color: '#06b6d4', cat: 'connector' },
  openai_conn:    { label: 'OpenAI',                icon: Cpu,              color: '#06b6d4', cat: 'connector' },
  zoom_conn:      { label: 'Zoom',                  icon: Video,            color: '#06b6d4', cat: 'connector' },
  sangam:         { label: 'Sangam CRM',            icon: Briefcase,        color: '#06b6d4', cat: 'connector' },
}

const CAT_ORDER  = ['system','send','ask','action','utility','connector']
const CAT_LABELS = { system:'Trigger & End', send:'Send', ask:'Ask Questions', action:'Actions', utility:'Utilities', connector:'Connectors' }
const CAT_COLOR  = { system:'#0066ff', send:'#10b981', ask:'#f59e0b', action:'#3b82f6', utility:'#8b5cf6', connector:'#06b6d4' }

const VAR_GROUPS = [
  { group: 'Intent', vars: [
    { v:'{{intent.text}}',       l:'User Message Text' },
    { v:'{{intent.payload}}',    l:'User Message Payload' },
  ]},
  { group: 'Recipient', vars: [
    { v:'{{recipient.name}}',         l:'Contact Name' },
    { v:'{{recipient.phone}}',        l:'Contact Phone' },
    { v:'{{recipient.country_code}}', l:'Country Code' },
    { v:'{{recipient.email}}',        l:'Contact Email' },
  ]},
  { group: 'Contact', vars: [
    { v:'{{contact.name}}',    l:'Name' },
    { v:'{{contact.email}}',   l:'Email' },
    { v:'{{contact.phone}}',   l:'Phone' },
    { v:'{{contact.tags}}',    l:'Tags' },
    { v:'{{contact.owner}}',   l:'Owner' },
    { v:'{{contact.opt_in}}',  l:'Message Opt-In' },
  ]},
  { group: 'Session', vars: [
    { v:'{{session.trigger_type}}', l:'Trigger Type' },
    { v:'{{session.cart_items}}',   l:'Cart Items' },
    { v:'{{session.cart_amount}}',  l:'Cart Amount' },
  ]},
  { group: 'Custom Variables', vars: [
    { v:'{{user_reply}}',   l:'User Reply' },
    { v:'{{user_choice}}',  l:'User Choice' },
    { v:'{{order_id}}',     l:'Order ID' },
    { v:'{{payment_id}}',   l:'Payment ID' },
    { v:'{{ai_response}}',  l:'AI Response' },
    { v:'{{api_response}}', l:'API Response' },
  ]},
]

const DAYS = ['monday','tuesday','wednesday','thursday','friday','saturday','sunday']
const DAY_LABELS = { monday:'Mon',tuesday:'Tue',wednesday:'Wed',thursday:'Thu',friday:'Fri',saturday:'Sat',sunday:'Sun' }
const TIMEZONES = ['Asia/Kolkata','Asia/Dubai','Asia/Singapore','Asia/Tokyo','Europe/London','Europe/Paris','America/New_York','America/Los_Angeles','Australia/Sydney']

const MAX_CARDS = 100

// ─── makeDefaults ──────────────────────────────────────────────────────────────
function makeDefaults(type) {
  const base = { name: DEFS[type]?.label || type }
  const inv = { invalidMsg:'', retryCount:2, onInvalid:'retry' }
  switch (type) {
    case 'start':         return { ...base, trigger:'any', keywords:'', matchType:'contains', optIn:false }
    case 'end':           return { ...base, endMessage:'', action:'none' }
    case 'text':          return { ...base, message:'' }
    case 'media':         return { ...base, mediaType:'image', url:'', caption:'', fileName:'' }
    case 'send_buttons':  return { ...base, headerText:'', bodyText:'', footerText:'', buttons:[{id:'1',label:'',value:''}] }
    case 'send_list':     return { ...base, headerText:'', bodyText:'', footerText:'', buttonLabel:'View Options', sections:[{title:'Section 1',items:[{id:'1',title:'',description:'',value:''}]}] }
    case 'template':      return { ...base, templateName:'', language:'en', headerVar:'', bodyVars:[], ctaUrl:'' }
    case 'send_voice':    return { ...base, audioUrl:'' }
    case 'catalog':       return { ...base, catalogId:'', productSetId:'', bodyText:'', footerText:'' }
    case 'ask_text':      return { ...base, question:'', saveAs:'', regex:'', ...inv }
    case 'ask_number':    return { ...base, question:'', saveAs:'', min:'', max:'', regex:'', ...inv }
    case 'ask_phone':     return { ...base, question:'', saveAs:'', countryCode:'+91', ...inv }
    case 'ask_email':     return { ...base, question:'', saveAs:'', ...inv }
    case 'ask_date':      return { ...base, question:'', saveAs:'', dateFormat:'DD/MM/YYYY', minDate:'', maxDate:'', ...inv }
    case 'ask_location':  return { ...base, question:'', saveAs:'', ...inv }
    case 'ask_url':       return { ...base, question:'', saveAs:'', ...inv }
    case 'ask_file':      return { ...base, question:'', saveAs:'', allowedTypes:['image','document','video'], maxSizeMB:10, ...inv }
    case 'ask_button':    return { ...base, question:'', saveAs:'', footerText:'', buttons:[{id:'1',label:'',value:''}], ...inv }
    case 'ask_list':      return { ...base, headerType:'text', headerText:'', question:'', footerText:'', buttonLabel:'Choose Option', optionsType:'static', sections:[{title:'Options',items:[{id:'1',title:'',description:'',value:''}]}], dynamicVar:'', dynamicPathId:'', dynamicPathTitle:'', dynamicPathSectionTitle:'', saveAs:'', ...inv }
    case 'ask_keyword':   return { ...base, question:'', keywords:[{id:'1',label:'',value:''}], caseSensitive:false, saveAs:'', ...inv }
    case 'ask_appointment': return { ...base, question:'', saveAs:'',
      calendarGoogle:'', calendarOutlook:'',
      weekdays:['MON','TUE','WED','THU','FRI'],
      blockedDates:[],
      disableNextDays:0, endDate:'', enableFutureDays:7, enablePastDays:0,
      timezoneSelection:false, interfaceType:'classic', autoPopup:'no',
      allDay:false, slotStart:'09:00', slotEnd:'17:00', timezone:'Asia/Kolkata',
      slotInterval:30, format:'12h', meetingsPerSlot:1,
      dataRefFlow:'', dataRefQuestion:'',
      title:'', description:'', location:'',
      meetingUrls:['','',''], bookedMsg:'', unavailableMsg:'', invalidMsg:'', ...inv }
    case 'ask_appointment_off': return { ...base, question:'', saveAs:'',
      weekdays:['MON','TUE','WED','THU','FRI'],
      blockedDates:[],
      disableNextDays:0, endDate:'', enableFutureDays:7, enablePastDays:0,
      timezoneSelection:false,
      allDay:false, slotStart:'09:00', slotEnd:'17:00', timezone:'Asia/Kolkata',
      slotInterval:30, format:'12h', meetingsPerSlot:1,
      title:'', description:'', location:'',
      bookedMsg:'', unavailableMsg:'', invalidMsg:'', ...inv }
    case 'ask_collection':return { ...base, question:'', saveAs:'', catalogId:'', productSetId:'' }
    case 'ask_form':      return { ...base, title:'', fields:[{id:'1',label:'',type:'text',required:true,saveAs:''}], submitLabel:'Submit' }
    case 'ask_payment':   return { ...base, gateway:'razorpay', amount:'', currency:'INR', description:'', saveAs:'', askName:false, askPhone:false, askEmail:false }
    case 'assign':        return { ...base, assignTo:'agent', agentId:'', teamId:'', handoffMsg:'' }
    case 'unassign':      return { ...base, handoffMsg:'' }
    case 'resolve':       return { ...base, resolveMsg:'', sendMsg:false }
    case 'update_conv':   return { ...base, fields:[{id:'1',key:'',value:''}] }
    case 'update_contact':return { ...base, fields:[{id:'1',key:'',value:''}] }
    case 'update_company':return { ...base, fields:[{id:'1',key:'',value:''}] }
    case 'push_seq':      return { ...base, sequenceId:'', delayMinutes:0 }
    case 'add_note':      return { ...base, noteText:'' }
    case 'delay':         return { ...base, duration:5, unit:'seconds' }
    case 'condition':     return { ...base, variable:'', operator:'equals', value:'', trueLabel:'Yes', falseLabel:'No' }
    case 'set_var':       return { ...base, variable:'', value:'', valueType:'static' }
    case 'jump':          return { ...base, targetNodeId:'' }
    case 'switch_node':   return { ...base, variable:'', cases:[{id:'1',value:'',label:'Case 1'}], defaultLabel:'Default' }
    case 'gpt_dialog':    return { ...base, prompt:'', userMessage:'{{intent.text}}', maxTokens:500, temperature:0.7, saveAs:'{{ai_response}}', functions:[] }
    case 'gpt_kb':        return { ...base, knowledgeBaseId:'', userMessage:'{{intent.text}}', inputVars:'', saveAs:'{{ai_response}}', maxTokens:500, fallbackMessage:'' }
    case 'working_hours': {
      const schedule = {}
      DAYS.forEach(d => { schedule[d] = { enabled: !['saturday','sunday'].includes(d), open:'09:00', close:'18:00' } })
      return { ...base, timezone:'Asia/Kolkata', schedule, insideLabel:'Open', outsideLabel:'Closed' }
    }
    case 'hint':          return { ...base, hintText:'', visibleTo:'all' }
    case 'wait_order':    return { ...base, timeoutDuration:24, timeoutUnit:'hours', saveAs:'{{order_id}}' }
    case 'sheets':        return { ...base, spreadsheetId:'', sheetName:'', operation:'append', fields:[{id:'1',key:'',value:''}] }
    case 'api':           return { ...base, method:'POST', url:'', headers:[{id:'1',key:'',value:''}], bodyType:'json', body:'', saveAs:'{{api_response}}', saveFields:[{id:'1',key:'',value:''}] }
    case 'razorpay':      return { ...base, amount:'', currency:'INR', description:'', expiry:15, customerName:'{{recipient.name}}', customerPhone:'{{recipient.phone}}', customerEmail:'{{recipient.email}}', saveAs:'{{payment_id}}' }
    case 'zoho_crm':      return { ...base, operation:'create', module:'Leads', fields:[{id:'1',key:'',value:''}], saveAs:'' }
    case 'shopify':       return { ...base, operation:'get_order', orderId:'', productId:'', customerEmail:'', saveAs:'' }
    case 'hubspot':       return { ...base, operation:'create_contact', fields:[{id:'1',key:'',value:''}], saveAs:'' }
    case 'zoho_bigin':    return { ...base, operation:'create', module:'Contacts', fields:[{id:'1',key:'',value:''}], saveAs:'' }
    case 'leadsquared':   return { ...base, activityEvent:'', fields:[{id:'1',key:'',value:''}], saveAs:'' }
    case 'woocommerce':   return { ...base, operation:'get_order', orderId:'', productId:'', orderStatus:'', saveAs:'' }
    case 'openai_conn':   return { ...base, prompt:'', model:'gpt-4o-mini', saveAs:'{{ai_response}}', maxTokens:500, temperature:0.7 }
    case 'zoom_conn':     return { ...base, topic:'', startTime:'', duration:60, saveAs:'' }
    case 'sangam':        return { ...base, operation:'create_lead', fields:[{id:'1',key:'',value:''}], saveAs:'' }
    default:              return base
  }
}

// ─── getOutputPorts ────────────────────────────────────────────────────────────
function getOutputPorts(node) {
  const d = node.data || {}
  switch (node.type) {
    case 'end':           return []
    case 'condition':     return [{ label:d.trueLabel||'Yes',idx:0 },{ label:d.falseLabel||'No',idx:1 }]
    case 'ask_button':    return (d.buttons||[]).map((b,i)=>({ label:b.label||`Option ${i+1}`,idx:i }))
    case 'send_buttons':  return (d.buttons||[]).map((b,i)=>({ label:b.label||`Button ${i+1}`,idx:i }))
    case 'ask_list':      return (d.sections||[]).flatMap(s=>s.items||[]).slice(0,10).map((it,i)=>({ label:it.title||`Item ${i+1}`,idx:i }))
    case 'send_list':     return (d.sections||[]).flatMap(s=>s.items||[]).slice(0,10).map((it,i)=>({ label:it.title||`Item ${i+1}`,idx:i }))
    case 'ask_keyword':   return (d.keywords||[]).map((k,i)=>({ label:k.label||k.value||`KW ${i+1}`,idx:i }))
    case 'switch_node':   return [...(d.cases||[]).map((c,i)=>({ label:c.label||c.value||`Case ${i+1}`,idx:i })),{ label:d.defaultLabel||'Default',idx:(d.cases||[]).length }]
    case 'working_hours': return [{ label:d.insideLabel||'Open',idx:0 },{ label:d.outsideLabel||'Closed',idx:1 }]
    case 'wait_order':    return [{ label:'Order Received',idx:0 },{ label:'Timeout',idx:1 }]
    case 'api':           return [{ label:'Success',idx:0 },{ label:'Error',idx:1 }]
    default:              return [{ label:'→',idx:0 }]
  }
}

// ─── Demo nodes & edges ────────────────────────────────────────────────────────
const DEMO_NODES = [
  { id:'n1', type:'start',      x:60,  y:180, data:{ name:'Start', trigger:'keyword', keywords:'hello, hi', matchType:'contains' } },
  { id:'n2', type:'text',       x:300, y:180, data:{ name:'Welcome', message:'Hello {{recipient.name}}! Welcome!' } },
  { id:'n3', type:'ask_button', x:560, y:180, data:{ name:'Main Menu', question:'How can I help you today?', saveAs:'{{user_choice}}', buttons:[{id:'1',label:'Support',value:'support'},{id:'2',label:'Sales',value:'sales'},{id:'3',label:'Other',value:'other'}] } },
  { id:'n4', type:'text',       x:820, y:40,  data:{ name:'Support', message:'Connecting you to our support team...' } },
  { id:'n5', type:'text',       x:820, y:200, data:{ name:'Sales', message:'Our sales team will assist you!' } },
  { id:'n6', type:'text',       x:820, y:360, data:{ name:'Other', message:'Please describe your issue.' } },
  { id:'n7', type:'end',        x:1060,y:200, data:{ name:'End', endMessage:'Thank you! Have a great day!', action:'none' } },
]
const DEMO_EDGES = [
  { id:'e1', fromId:'n1', fromPort:0, toId:'n2' },
  { id:'e2', fromId:'n2', fromPort:0, toId:'n3' },
  { id:'e3', fromId:'n3', fromPort:0, toId:'n4' },
  { id:'e4', fromId:'n3', fromPort:1, toId:'n5' },
  { id:'e5', fromId:'n3', fromPort:2, toId:'n6' },
  { id:'e6', fromId:'n5', fromPort:0, toId:'n7' },
]

/* ─── End-to-end flow exercising every Ask question type ──────────────────
   The WhatsApp counterpart of the Website Chat builder's "Question Types
   Test" flow. Both exist for the same reason: every Ask node has its own
   editor panel and its own runtime rendering, and a catalog of sixteen of
   them is exactly the kind of thing that rots one node at a time without
   anybody noticing. One flow that walks through all of them is how a
   regression in `ask_collection` gets caught before a merchant finds it.

   Written as a real courier booking rather than sixteen "test X?" prompts.
   A contrived chain proves the node renders; a realistic one also shows
   whether the ORDER of these questions is bearable to answer on a phone,
   which is the part that actually decides if a flow ships.

   Laid out serpentine — left-to-right, then back right-to-left a row down —
   so the connectors between consecutive steps stay short instead of flying
   back across the whole canvas at the end of every row. */
const QTYPES_ROW = 5, QTYPES_COL_GAP = 260, QTYPES_ROW_GAP = 170
const QTYPES_LEFT = 60, QTYPES_TOP = 60

/* Each step names the node type and the data the inspector for that type
   expects. Keys match makeDefaults() above — anything omitted just keeps its
   default, so this stays readable rather than restating every field. */
const QTYPES_STEPS = [
  { type:'start', data:{ name:'Booking Start', trigger:'keyword', keywords:'book, pickup, courier', matchType:'contains' } },
  { type:'text', data:{ name:'Welcome', message:'Hi {{recipient.name}}! 📦 Let’s get your parcel booked — it takes about a minute.' } },

  { type:'ask_button', data:{ name:'Shipment Type', question:'What are you sending today?', saveAs:'{{shipment_type}}',
      footerText:'Tap an option to continue',
      buttons:[{id:'1',label:'Documents',value:'documents'},{id:'2',label:'Parcel',value:'parcel'},{id:'3',label:'Bulk / Freight',value:'freight'}] } },

  { type:'ask_text', data:{ name:'Sender Name', question:'Who should we put down as the sender?', saveAs:'{{sender_name}}' } },

  { type:'ask_phone', data:{ name:'Pickup Contact', question:'Which number should the driver call on pickup?', saveAs:'{{pickup_phone}}', countryCode:'+91' } },

  { type:'ask_email', data:{ name:'Receipt Email', question:'Where should we email the receipt and tracking link?', saveAs:'{{sender_email}}' } },

  { type:'ask_keyword', data:{ name:'Account Type', question:'Is this a BUSINESS or PERSONAL shipment? Reply with either word.',
      saveAs:'{{account_type}}', caseSensitive:false,
      keywords:[{id:'1',label:'BUSINESS',value:'business'},{id:'2',label:'PERSONAL',value:'personal'}] } },

  { type:'ask_list', data:{ name:'Parcel Contents', headerType:'text', headerText:'Parcel contents',
      question:'What’s inside? This decides how we pack and insure it.',
      footerText:'Fragile items are packed separately', buttonLabel:'Choose contents',
      optionsType:'static', saveAs:'{{parcel_contents}}',
      sections:[{ title:'Common', items:[
        { id:'1', title:'Documents', description:'Papers, contracts, certificates', value:'documents' },
        { id:'2', title:'Electronics', description:'Phones, laptops, accessories', value:'electronics' },
        { id:'3', title:'Clothing', description:'Apparel and textiles', value:'clothing' },
        { id:'4', title:'Fragile goods', description:'Glass, ceramics, instruments', value:'fragile' },
      ]}] } },

  { type:'ask_number', data:{ name:'Parcel Weight', question:'Roughly how much does it weigh, in kg?', saveAs:'{{weight_kg}}', min:'0.1', max:'50' } },

  { type:'ask_location', data:{ name:'Pickup Location', question:'Share your pickup location so the driver can find you.', saveAs:'{{pickup_location}}' } },

  { type:'ask_form', data:{ name:'Delivery Address', title:'Where is it going?', submitLabel:'Save address',
      fields:[
        { id:'1', label:'Recipient name', type:'text',  required:true,  saveAs:'{{to_name}}' },
        { id:'2', label:'Address line 1', type:'text',  required:true,  saveAs:'{{to_line1}}' },
        { id:'3', label:'Address line 2', type:'text',  required:false, saveAs:'{{to_line2}}' },
        { id:'4', label:'City',           type:'text',  required:true,  saveAs:'{{to_city}}' },
        { id:'5', label:'PIN code',       type:'number',required:true,  saveAs:'{{to_pin}}' },
      ] } },

  { type:'ask_file', data:{ name:'Invoice Upload', question:'Send a photo of the invoice or packing list, if you have one.',
      saveAs:'{{invoice_file}}', allowedTypes:['image','document'], maxSizeMB:10 } },

  { type:'ask_url', data:{ name:'Product Link', question:'Selling online? Paste the product link and we’ll add it to the manifest.', saveAs:'{{product_url}}' } },

  { type:'ask_date', data:{ name:'Preferred Date', question:'Which day should we collect it?', saveAs:'{{pickup_date}}', dateFormat:'DD/MM/YYYY' } },

  { type:'ask_appointment', data:{ name:'Pickup Slot', question:'Pick a collection slot that suits you.', saveAs:'{{pickup_slot}}',
      title:'Courier pickup', description:'A driver will arrive within the chosen window.',
      slotStart:'09:00', slotEnd:'19:00', slotInterval:60, format:'12h',
      enableFutureDays:7, meetingsPerSlot:4, timezone:'Asia/Kolkata' } },

  { type:'ask_appointment_off', data:{ name:'Branch Drop-off', question:'Prefer to drop it at a branch instead? Choose a time.',
      saveAs:'{{dropoff_slot}}', title:'Branch drop-off', location:'Prime Next Logistics — MG Road branch',
      slotStart:'10:00', slotEnd:'18:00', slotInterval:30, enableFutureDays:5, timezone:'Asia/Kolkata' } },

  { type:'ask_collection', data:{ name:'Packaging Add-ons', question:'Need packaging? Pick from our catalogue.',
      saveAs:'{{packaging_items}}', catalogId:'pnl_packaging', productSetId:'boxes_and_wrap' } },

  { type:'ask_payment', data:{ name:'Pay for Shipment', gateway:'razorpay', amount:'{{quoted_price}}', currency:'INR',
      description:'Courier booking — {{parcel_contents}}, {{weight_kg}}kg', saveAs:'{{payment_ref}}',
      askName:false, askPhone:false, askEmail:false } },

  { type:'text', data:{ name:'Booking Confirmed', message:'Booked! 🎉 Pickup on {{pickup_date}} ({{pickup_slot}}).\nTracking: {{payment_ref}}\nWe’ve emailed the receipt to {{sender_email}}.' } },

  { type:'end', data:{ name:'End', endMessage:'Thanks for shipping with us! Reply BOOK any time to start another pickup.', action:'none' } },
]

function buildQuestionTypesFlow() {
  const nodes = []
  const edges = []

  QTYPES_STEPS.forEach((step, i) => {
    const row = Math.floor(i / QTYPES_ROW)
    const ltr = row % 2 === 0
    const col = ltr ? (i % QTYPES_ROW) : (QTYPES_ROW - 1 - (i % QTYPES_ROW))
    const id = `q${i + 1}`
    nodes.push({
      id,
      type: step.type,
      x: QTYPES_LEFT + col * QTYPES_COL_GAP,
      y: QTYPES_TOP + row * QTYPES_ROW_GAP,
      // Defaults first so every field the inspector reads exists, then the
      // step's own copy on top — a node missing a key its editor expects
      // renders as an empty panel rather than an obvious error.
      data: { ...makeDefaults(step.type), ...step.data },
    })
    if (i > 0) edges.push({ id: `qe${i}`, fromId: `q${i}`, fromPort: 0, toId: id })
  })

  return { nodes, edges }
}

// ─── Sample flows for list view ────────────────────────────────────────────────
const SAMPLE_FLOWS = [
  { id:'f1', name:'Welcome Bot',     status:'active', trigger:'Keyword',     nodes:7,  edited:'2026-05-17' },
  { id:'qtypes', name:'Courier Booking — every question type', status:'active', trigger:'Keyword',
    nodes:QTYPES_STEPS.length, edited:'2026-09-17' },
  { id:'f2', name:'Support Triage',  status:'active', trigger:'Any message', nodes:12, edited:'2026-05-15' },
  { id:'f3', name:'Lead Capture',    status:'draft',  trigger:'CTWA',        nodes:5,  edited:'2026-05-10' },
  { id:'f4', name:'Order Status',    status:'draft',  trigger:'Keyword',     nodes:9,  edited:'2026-05-08' },
]

// ─── Utilities ─────────────────────────────────────────────────────────────────
let _uid = 100
const uid = () => `n${++_uid}`

function bezier(x1,y1,x2,y2) {
  const dx = Math.abs(x2-x1)*0.5
  return `M${x1},${y1} C${x1+dx},${y1} ${x2-dx},${y2} ${x2},${y2}`
}

const NODE_W = 210
const NODE_H = 66
const PORT_R = 7

// ─── Shared form components (Tailwind-based) ───────────────────────────────────

const inputCls = 'border border-slate-200 rounded-xl px-3.5 py-2.5 text-[12px] bg-white hover:border-slate-300 focus:outline-none focus:ring-2 focus:ring-primary/10 focus:border-primary/50 transition-all w-full text-slate-800 placeholder:text-slate-300 font-medium'
const inputSmCls = 'border border-slate-200 rounded-lg px-3 py-1.5 text-[11px] bg-white hover:border-slate-300 focus:outline-none focus:ring-2 focus:ring-primary/10 focus:border-primary/50 transition-all w-full text-slate-800 placeholder:text-slate-300 font-medium'

function Field({ label, hint, children, className = '' }) {
  return (
    <div className={clsx('mb-3', className)}>
      {label && (
        <div className="flex items-center gap-1.5 mb-1.5">
          <span className="text-[11px] font-semibold text-slate-700">{label}</span>
          {hint && <span title={hint} className="text-slate-400 cursor-help"><HelpCircle size={11}/></span>}
        </div>
      )}
      {children}
    </div>
  )
}

function TInput({ value='', onChange, placeholder='', type='text', disabled=false, className='' }) {
  return (
    <input
      type={type}
      value={value}
      disabled={disabled}
      onChange={e => onChange && onChange(e.target.value)}
      placeholder={placeholder}
      className={clsx(disabled ? 'opacity-50 cursor-not-allowed bg-slate-50' : '', inputSmCls, className)}
    />
  )
}

function TTextarea({ value='', onChange, placeholder='', rows=3 }) {
  return (
    <textarea
      value={value}
      rows={rows}
      onChange={e => onChange && onChange(e.target.value)}
      placeholder={placeholder}
      className={clsx(inputCls, 'resize-y leading-relaxed')}
    />
  )
}

const EMOJI_GROUPS = [
  { label:'Smileys',  emojis:['😀','😊','😍','🥰','😎','🤩','😅','🤣','😢','😭','😡','🥳','🤔','😴','🤗','😇','🙃','🥹','😆','😂'] },
  { label:'Hands',    emojis:['👍','👎','👋','🙏','👏','🤝','✌️','🤞','💪','👌','🤙','☝️','🙌','🤲','🫶','🫱','🫂','🤜','🤛','👊'] },
  { label:'Hearts',   emojis:['❤️','🧡','💛','💚','💙','💜','🖤','🤍','💕','💞','💓','💗','💖','💝','❣️','💘','💟','♥️','🩷','🩵'] },
  { label:'Objects',  emojis:['📱','💻','📧','📞','🔔','💡','🔑','🎉','🎁','📅','⏰','🔥','✅','❌','⚠️','💰','🛒','📦','🚀','🌐'] },
  { label:'Nature',   emojis:['🌟','⭐','🌈','🌸','🌺','🍀','🌞','🌙','❄️','🌊','🌍','🐾','🦋','🌹','🍎','🌿','🐶','🐱','🐸','🦁'] },
  { label:'Symbols',  emojis:['✨','🎯','💯','🔖','🏷️','📌','📍','🔗','💬','🗨️','📢','📣','🔊','💤','♻️','🆕','🆓','🔄','⚡','🎊'] },
]

function RichField({ value='', onChange, placeholder='', rows=3, maxChars=1000 }) {
  const taRef = useRef(null)
  const emojiRef = useRef(null)
  const gifRef = useRef(null)
  const [showEmoji, setShowEmoji] = useState(false)
  const [showGif, setShowGif] = useState(false)

  const wrap = (marker) => {
    const ta = taRef.current
    if (!ta) return
    const { selectionStart:s, selectionEnd:e } = ta
    const sel = value.slice(s,e)
    const newVal = value.slice(0,s) + marker + sel + marker + value.slice(e)
    onChange(newVal)
    setTimeout(() => { ta.focus(); ta.setSelectionRange(s+marker.length, e+marker.length) }, 0)
  }

  const wrapMono = () => {
    const ta = taRef.current
    if (!ta) return
    const { selectionStart:s, selectionEnd:e } = ta
    const sel = value.slice(s,e)
    const newVal = value.slice(0,s) + '```' + sel + '```' + value.slice(e)
    onChange(newVal)
    setTimeout(() => { ta.focus(); ta.setSelectionRange(s+3, e+3) }, 0)
  }

  const insert = (text) => {
    const ta = taRef.current
    if (!ta) return
    const { selectionStart:s, selectionEnd:e } = ta
    const newVal = value.slice(0,s) + text + value.slice(e)
    onChange(newVal)
    setTimeout(() => { ta.focus(); ta.setSelectionRange(s+text.length, s+text.length) }, 0)
  }

  const insertList = (numbered) => {
    const ta = taRef.current
    if (!ta) return
    const { selectionStart:s, selectionEnd:e } = ta
    const before = value.slice(0,s), selected = value.slice(s,e), after = value.slice(e)
    if (selected) {
      const lines = selected.split('\n').map((l,i) => numbered ? `${i+1}. ${l}` : `• ${l}`).join('\n')
      onChange(before + lines + after)
    } else {
      const lineStart = before.lastIndexOf('\n') + 1
      const prefix = numbered ? '1. ' : '• '
      const newVal = value.slice(0,lineStart) + prefix + value.slice(lineStart)
      onChange(newVal)
      setTimeout(() => { ta.focus(); ta.setSelectionRange(lineStart+prefix.length, lineStart+prefix.length) }, 0)
    }
  }

  const handleKeyDown = (e) => {
    if (e.ctrlKey || e.metaKey) {
      if (e.key==='b'||e.key==='B') { e.preventDefault(); wrap('*') }
      if (e.key==='i'||e.key==='I') { e.preventDefault(); wrap('_') }
      if (e.key==='u'||e.key==='U') { e.preventDefault(); wrap('_') }
      if (e.key==='s'||e.key==='S') { e.preventDefault(); wrap('~') }
    }
  }

  useEffect(() => {
    if (!showEmoji) return
    const handle = (e) => { if (!emojiRef.current?.contains(e.target)) setShowEmoji(false) }
    document.addEventListener('mousedown', handle)
    return () => document.removeEventListener('mousedown', handle)
  }, [showEmoji])

  useEffect(() => {
    if (!showGif) return
    const handle = (e) => { if (!gifRef.current?.contains(e.target)) setShowGif(false) }
    document.addEventListener('mousedown', handle)
    return () => document.removeEventListener('mousedown', handle)
  }, [showGif])

  const charCount = value.length
  const pct = Math.min(charCount / maxChars, 1)
  const overLimit = charCount > maxChars

  const btnCls = 'w-7 h-7 rounded-lg text-slate-500 hover:bg-slate-200 hover:text-slate-700 transition-colors flex items-center justify-center flex-shrink-0'

  return (
    <div className={clsx('border rounded-xl overflow-hidden transition-all focus-within:ring-2',
      overLimit ? 'border-red-300 focus-within:ring-red-200' : 'border-slate-200 focus-within:ring-primary/15 focus-within:border-primary/40')}>
      {/* Toolbar */}
      <div className="flex items-center gap-0.5 px-2 py-1.5 bg-slate-50 border-b border-slate-200 flex-wrap">
        {/* Bold / Italic / Strike */}
        {[['*','B','Bold','font-bold text-[11px]'],['_','I','Italic','italic text-[11px]'],['~','S','Strikethrough','line-through text-[11px]']].map(([m,lbl,title,cls])=>(
          <button key={m} type="button" onClick={()=>wrap(m)} title={`${title} (Ctrl+${lbl})`}
            className={clsx(btnCls, 'font-semibold', cls)}>
            {lbl}
          </button>
        ))}
        {/* Monospace */}
        <button type="button" onClick={wrapMono} title="Monospace (```code```)"
          className={clsx(btnCls, 'font-mono text-[11px]')}>M</button>

        <div className="w-px h-4 bg-slate-200 flex-shrink-0 mx-0.5"/>

        {/* Line break */}
        <button type="button" onClick={()=>insert('\n')} title="Line break"
          className={clsx(btnCls, 'text-[13px]')}>↵</button>
        {/* Bullet list */}
        <button type="button" onClick={()=>insertList(false)} title="Bullet list (•)"
          className={clsx(btnCls, 'text-[14px]')}>•</button>
        {/* Numbered list */}
        <button type="button" onClick={()=>insertList(true)} title="Numbered list"
          className={clsx(btnCls, 'text-[10px] font-bold')}>1.</button>

        <div className="w-px h-4 bg-slate-200 flex-shrink-0 mx-0.5"/>

        {/* Emoji picker */}
        <div className="relative" ref={emojiRef}>
          <button type="button" onClick={()=>setShowEmoji(s=>!s)} title="Insert emoji"
            className={clsx(btnCls, 'text-[14px]')}>😀</button>
          {showEmoji && (
            <div className="absolute top-full left-0 z-50 bg-white border border-slate-200 rounded-xl shadow-lg p-2.5 mt-1"
              style={{width:220, maxHeight:280, overflowY:'auto'}}>
              {EMOJI_GROUPS.map(grp=>(
                <div key={grp.label} className="mb-2 last:mb-0">
                  <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1">{grp.label}</p>
                  <div className="flex flex-wrap gap-0.5">
                    {grp.emojis.map(em=>(
                      <button key={em} type="button"
                        onClick={()=>{ insert(em); setShowEmoji(false) }}
                        className="w-7 h-7 text-[15px] hover:bg-slate-100 rounded flex items-center justify-center transition-colors">
                        {em}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* GIF picker */}
        <div className="relative" ref={gifRef}>
          <button type="button" onClick={()=>{ setShowGif(s=>!s); setShowEmoji(false) }} title="Insert GIF"
            className={clsx(btnCls, 'text-[9px] font-extrabold tracking-tight', showGif && 'bg-slate-200 text-slate-700')}>
            GIF
          </button>
          {showGif && (
            <div className="absolute top-full left-0 z-50 bg-white border border-slate-200 rounded-xl shadow-lg mt-1 p-3"
              style={{width:300, maxHeight:360, overflowY:'auto'}}>
              <GifPicker onSelect={(url)=>{ insert(url); setShowGif(false) }}/>
            </div>
          )}
        </div>

        {/* Keyboard hint */}
        <span className="text-[10px] text-slate-400 font-mono ml-0.5 hidden sm:inline">Ctrl+B/I/S</span>

        {/* Live char count */}
        <div className="ml-auto flex items-center gap-1.5">
          <div className="w-12 h-1 bg-slate-200 rounded-full overflow-hidden">
            <div className="h-full rounded-full transition-all"
              style={{width:`${pct*100}%`, background: overLimit?'#ef4444':pct>0.8?'#f59e0b':'#10b981'}}/>
          </div>
          <span className={clsx('text-[10px] font-semibold tabular-nums', overLimit?'text-red-500':pct>0.8?'text-amber-500':'text-slate-400')}>
            {charCount}/{maxChars}
          </span>
        </div>
      </div>
      {/* Textarea */}
      <textarea
        ref={taRef}
        value={value}
        rows={rows}
        maxLength={maxChars + 50}
        onChange={e => onChange && onChange(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        className="w-full px-3 py-2.5 text-sm text-slate-900 bg-white border-none outline-none resize-y leading-relaxed placeholder:text-slate-400"
      />
    </div>
  )
}

function Toggle({ value=false, onChange, label }) {
  return (
    <label className="flex items-center gap-2.5 cursor-pointer select-none py-0.5">
      <button type="button" onClick={() => onChange && onChange(!value)} style={{
        width:34, height:18, borderRadius:9, border:'none', cursor:'pointer', position:'relative',
        background: value ? '#0066ff' : '#d1d5db', transition:'background 0.2s', padding:0, flexShrink:0,
      }}>
        <div style={{ position:'absolute', top:2, left: value ? 16 : 2, width:14, height:14, borderRadius:'50%',
          background:'#fff', transition:'left 0.2s', boxShadow:'0 1px 3px rgba(0,0,0,0.2)' }}/>
      </button>
      {label && <span className="text-xs text-slate-700 font-medium">{label}</span>}
    </label>
  )
}

function VarPicker({ value='', onChange, label='Variable' }) {
  return (
    <NativeSelect value={value} onChange={e => onChange && onChange(e.target.value)} sm>
      <option value=''>— Pick a {label} —</option>
      {VAR_GROUPS.map(g => (
        <optgroup key={g.group} label={g.group}>
          {g.vars.map(v => <option key={v.v} value={v.v}>{v.l}  ({v.v})</option>)}
        </optgroup>
      ))}
    </NativeSelect>
  )
}

function KVList({ items=[], onChange, keyPlaceholder='Key', valPlaceholder='Value', addLabel='Add Field', max=20 }) {
  const add = () => { if (items.length < max) onChange([...items,{id:String(Date.now()),key:'',value:''}]) }
  const remove = id => onChange(items.filter(i => i.id !== id))
  const upd = (id,field,val) => onChange(items.map(i => i.id===id ? {...i,[field]:val} : i))
  return (
    <div className="space-y-1.5">
      {items.map((item,idx) => (
        <div key={item.id} className="flex gap-1.5 items-center">
          <span className="text-[10px] text-slate-400 font-semibold w-4 text-center flex-shrink-0">{idx+1}</span>
          <input value={item.key} onChange={e=>upd(item.id,'key',e.target.value)} placeholder={keyPlaceholder}
            className={clsx(inputSmCls,'flex-1')}/>
          <input value={item.value} onChange={e=>upd(item.id,'value',e.target.value)} placeholder={valPlaceholder}
            className={clsx(inputSmCls,'flex-1')}/>
          <button onClick={()=>remove(item.id)} className="text-slate-400 hover:text-red-500 flex-shrink-0 p-0.5">
            <X size={12}/>
          </button>
        </div>
      ))}
      <button onClick={add} disabled={items.length>=max}
        className="w-full text-[11px] text-primary bg-primary-50 rounded-lg py-1.5 font-semibold flex items-center justify-center gap-1 hover:bg-primary/10 transition-colors disabled:opacity-40">
        <Plus size={11}/> {addLabel}
      </button>
    </div>
  )
}

// Dot-grid drag handle SVG
function DragDots() {
  return (
    <svg width="10" height="16" viewBox="0 0 10 16" fill="none" className="text-slate-300 group-hover:text-slate-400 transition-colors flex-shrink-0">
      {[0,4,8].map(y=>[0,5].map(x=>(
        <circle key={`${x}-${y}`} cx={x+2} cy={y+4} r={1.5} fill="currentColor"/>
      )))}
    </svg>
  )
}

function ButtonList({ buttons=[], onChange, max=3, nodes=[] }) {
  const [dragIdx, setDragIdx] = useState(null)
  const [overIdx, setOverIdx] = useState(null)

  const add  = () => { if (buttons.length < max) onChange([...buttons,{id:String(Date.now()),label:'',value:'',jumpTo:''}]) }
  const remove = id => onChange(buttons.filter(b => b.id !== id))
  const upd  = (id,field,val) => onChange(buttons.map(b => b.id===id ? {...b,[field]:val} : b))

  const onDragStart = (e, i) => { setDragIdx(i); e.dataTransfer.effectAllowed='move' }
  const onDragOver  = (e, i) => { e.preventDefault(); setOverIdx(i) }
  const onDrop      = (e, i) => {
    e.preventDefault()
    if (dragIdx === null || dragIdx === i) { setDragIdx(null); setOverIdx(null); return }
    const arr = [...buttons]
    const [item] = arr.splice(dragIdx, 1)
    arr.splice(i, 0, item)
    onChange(arr)
    setDragIdx(null); setOverIdx(null)
  }
  const onDragEnd = () => { setDragIdx(null); setOverIdx(null) }

  return (
    <div>
      {/* Column headers */}
      <div className="flex items-center gap-2 mb-2 pl-7 pr-8">
        <span className="flex-1 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Options / Buttons</span>
        <span className="w-28 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Flow</span>
        <span className="w-28 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Jump To</span>
      </div>

      {/* Individual rows */}
      <div className="space-y-2">
        {buttons.map((btn, i) => (
          <div key={btn.id}
            draggable
            onDragStart={e=>onDragStart(e,i)}
            onDragOver={e=>onDragOver(e,i)}
            onDrop={e=>onDrop(e,i)}
            onDragEnd={onDragEnd}
            className={clsx(
              'group flex items-center gap-2 bg-white border rounded-xl px-3 py-2.5 transition-all',
              overIdx===i && dragIdx!==i ? 'border-primary/40 shadow-md scale-[1.01]' : 'border-slate-200 hover:border-slate-300 hover:shadow-sm',
              dragIdx===i ? 'opacity-40' : 'opacity-100'
            )}>
            {/* Drag handle */}
            <div className="cursor-grab active:cursor-grabbing flex-shrink-0 select-none">
              <DragDots/>
            </div>
            {/* Label */}
            <input
              value={btn.label}
              onChange={e=>upd(btn.id,'label',e.target.value)}
              placeholder="Option label"
              className="flex-1 min-w-0 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-800 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary/15 focus:border-primary/40 transition-all placeholder:text-slate-400"
            />
            {/* Flow */}
            <NativeSelect className="w-28 flex-shrink-0">
              <option>Main Flow</option>
            </NativeSelect>
            {/* Jump To */}
            <NativeSelect
              value={btn.jumpTo||''}
              onChange={e=>upd(btn.id,'jumpTo',e.target.value)}
              className="w-28 flex-shrink-0">
              <option value="">No Jump</option>
              {nodes.map(n=>(
                <option key={n.id} value={n.id}>{n.data?.name||n.type}</option>
              ))}
            </NativeSelect>
            {/* Delete */}
            <button onClick={()=>remove(btn.id)}
              className="flex-shrink-0 w-6 h-6 flex items-center justify-center rounded-md text-slate-300 hover:text-red-400 hover:bg-red-50 transition-colors">
              <X size={13}/>
            </button>
          </div>
        ))}
      </div>

      {buttons.length < max && (
        <button onClick={add}
          className="mt-3 w-full text-[11px] text-primary bg-primary/5 border border-dashed border-primary/30 rounded-xl py-2.5 font-semibold flex items-center justify-center gap-1.5 hover:bg-primary/10 transition-colors">
          <Plus size={11}/> Add Option
          <span className="text-slate-400 font-normal">({buttons.length}/{max})</span>
        </button>
      )}
    </div>
  )
}

function SectionList({ sections=[], onChange, nodes=[] }) {
  const addSec = () => onChange([...sections,{title:`Section ${sections.length+1}`,items:[{id:String(Date.now()),title:'',description:'',value:'',jumpTo:''}]}])
  const removeSec = i => onChange(sections.filter((_,idx) => idx !== i))
  const updSec = (i,title) => onChange(sections.map((s,idx) => idx===i ? {...s,title} : s))
  const addItem = si => onChange(sections.map((s,idx) => idx===si ? {...s,items:[...s.items,{id:String(Date.now()),title:'',description:'',value:'',jumpTo:''}]} : s))
  const removeItem = (si,id) => onChange(sections.map((s,idx) => idx===si ? {...s,items:s.items.filter(it=>it.id!==id)} : s))
  const updItem = (si,id,field,val) => onChange(sections.map((s,idx) => idx===si ? {...s,items:s.items.map(it=>it.id===id?{...it,[field]:val}:it)} : s))

  const [dragState, setDragState] = useState(null) // {si, fromIdx}
  const [overState, setOverState] = useState(null)  // {si, toIdx}

  const onItemDragStart = (e,si,i) => { setDragState({si,i}); e.dataTransfer.effectAllowed='move' }
  const onItemDragOver  = (e,si,i) => { e.preventDefault(); setOverState({si,i}) }
  const onItemDrop      = (e,si,i) => {
    e.preventDefault()
    if (!dragState || (dragState.si===si && dragState.i===i)) { setDragState(null); setOverState(null); return }
    if (dragState.si !== si) { setDragState(null); setOverState(null); return }
    const sec = sections[si]
    const arr = [...sec.items]
    const [item] = arr.splice(dragState.i, 1)
    arr.splice(i, 0, item)
    onChange(sections.map((s,idx) => idx===si ? {...s,items:arr} : s))
    setDragState(null); setOverState(null)
  }
  const onDragEnd = () => { setDragState(null); setOverState(null) }

  return (
    <div className="space-y-4">
      {sections.map((sec,si) => (
        <div key={si} className="rounded-xl border border-slate-200 overflow-hidden">
          {/* Section header */}
          <div className="flex items-center gap-2 px-3 py-2 bg-slate-50 border-b border-slate-200">
            <List size={12} className="text-slate-400 flex-shrink-0"/>
            <input value={sec.title} onChange={e=>updSec(si,e.target.value)} placeholder="Section title"
              className="flex-1 text-xs font-semibold text-slate-700 bg-transparent outline-none border-none placeholder:text-slate-400"/>
            <button onClick={()=>removeSec(si)} className="text-slate-400 hover:text-red-500 transition-colors"><X size={12}/></button>
          </div>

          {/* Items */}
          <div className="p-3 space-y-2 bg-white">
            {/* Column headers */}
            {(sec.items||[]).length > 0 && (
              <div className="flex items-center gap-2 pl-7 pr-7 mb-1">
                <span className="flex-1 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Menu Items</span>
                <span className="w-28 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Flow</span>
                <span className="w-28 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Jump To</span>
              </div>
            )}

            {(sec.items||[]).map((item,ii) => (
              <div key={item.id}
                draggable
                onDragStart={e=>onItemDragStart(e,si,ii)}
                onDragOver={e=>onItemDragOver(e,si,ii)}
                onDrop={e=>onItemDrop(e,si,ii)}
                onDragEnd={onDragEnd}
                className={clsx(
                  'group flex items-center gap-2 bg-white border rounded-xl px-3 py-2.5 transition-all',
                  overState?.si===si && overState?.i===ii && dragState?.i!==ii
                    ? 'border-primary/40 shadow-md scale-[1.01]'
                    : 'border-slate-200 hover:border-slate-300 hover:shadow-sm',
                  dragState?.si===si && dragState?.i===ii ? 'opacity-40' : 'opacity-100'
                )}>
                <div className="cursor-grab active:cursor-grabbing flex-shrink-0 select-none">
                  <DragDots/>
                </div>
                <input
                  value={item.title}
                  onChange={e=>updItem(si,item.id,'title',e.target.value)}
                  placeholder="Item title"
                  className="flex-1 min-w-0 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-800 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary/15 focus:border-primary/40 transition-all placeholder:text-slate-400"
                />
                <NativeSelect className="w-28 flex-shrink-0">
                  <option>Main Flow</option>
                </NativeSelect>
                <NativeSelect
                  value={item.jumpTo||''}
                  onChange={e=>updItem(si,item.id,'jumpTo',e.target.value)}
                  className="w-28 flex-shrink-0">
                  <option value="">No Jump</option>
                  {nodes.map(n=>(
                    <option key={n.id} value={n.id}>{n.data?.name||n.type}</option>
                  ))}
                </NativeSelect>
                <button onClick={()=>removeItem(si,item.id)}
                  className="flex-shrink-0 w-6 h-6 flex items-center justify-center rounded-md text-slate-300 hover:text-red-400 hover:bg-red-50 transition-colors">
                  <X size={13}/>
                </button>
              </div>
            ))}

            <button onClick={()=>addItem(si)}
              className="w-full text-[11px] text-primary bg-primary/5 border border-dashed border-primary/20 rounded-xl py-2 font-semibold flex items-center justify-center gap-1.5 hover:bg-primary/10 transition-colors">
              <Plus size={11}/> Add Item
            </button>
          </div>
        </div>
      ))}

      {sections.length < 10 && (
        <button onClick={addSec}
          className="w-full text-[11px] text-primary bg-primary/5 border border-dashed border-primary/30 rounded-xl py-2.5 font-semibold flex items-center justify-center gap-1.5 hover:bg-primary/10 transition-colors">
          <Plus size={11}/> Add Section
        </button>
      )}
    </div>
  )
}

function WAPreview({ message='', buttons=null, listButtonLabel=null }) {
  return (
    <div className="bg-[#e5ddd5] rounded-xl p-3 mt-2">
      <div className="flex justify-end">
        <div className="max-w-[200px]">
          <div className="bg-[#dcf8c6] rounded-xl rounded-br-sm px-3 py-2 text-xs text-slate-800 leading-relaxed shadow-sm">
            {message || <span className="text-slate-400 italic">Preview...</span>}
          </div>
          {buttons && (
            <div className="mt-1 space-y-1">
              {buttons.map((b,i) => (
                <div key={i} className="bg-white border border-[#25d366] rounded-lg px-3 py-1.5 text-xs text-center text-[#075e54] font-semibold">
                  {b.label || `Option ${i+1}`}
                </div>
              ))}
            </div>
          )}
          {listButtonLabel && (
            <div className="mt-1 bg-white border border-[#25d366] rounded-lg px-3 py-1.5 text-xs text-center text-[#075e54] font-semibold">
              {listButtonLabel}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function InvalidSection({ data, onChange }) {
  const [open, setOpen] = useState(false)
  const set = (k,v) => onChange({...data,[k]:v})
  return (
    <div className="rounded-xl border border-slate-200 overflow-hidden">
      <button type="button" onClick={()=>setOpen(o=>!o)}
        className="w-full flex items-center gap-2 px-3 py-2.5 bg-slate-50 hover:bg-slate-100 transition-colors text-left">
        <AlertCircle size={13} className="text-amber-500 flex-shrink-0"/>
        <span className="text-[11px] font-semibold text-slate-700 flex-1">Input Validation</span>
        <span className="text-[10px] text-slate-400 mr-1">optional</span>
        <ChevronDown size={13} className={clsx('text-slate-400 transition-transform flex-shrink-0', open && 'rotate-180')}/>
      </button>
      {open && (
        <div className="p-3 space-y-2.5 border-t border-slate-100">
          <Field label="Error message on invalid input">
            <TTextarea value={data.invalidMsg||''} onChange={v=>set('invalidMsg',v)} placeholder="e.g. That doesn't look right. Please try again." rows={2}/>
          </Field>
          <div className="grid grid-cols-2 gap-2">
            <Field label="Max retries">
              <TInput type="number" value={data.retryCount??2} onChange={v=>set('retryCount',+v)}/>
            </Field>
            <Field label="After max retries">
              <NativeSelect value={data.onInvalid||'retry'} onChange={e=>set('onInvalid',e.target.value)} sm>
                <option value="retry">Keep retrying</option>
                <option value="skip">Skip this step</option>
                <option value="end_flow">End the flow</option>
                <option value="fallback">Go to fallback</option>
              </NativeSelect>
            </Field>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Section wrapper for edit panel ───────────────────────────────────────────
function PanelSection({ title, children }) {
  return (
    <div className="bg-slate-50 rounded-xl p-3 space-y-3 mb-3">
      {title && <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{title}</p>}
      {children}
    </div>
  )
}

// ─── EditForm ──────────────────────────────────────────────────────────────────
function EditForm({ node, onChange, nodes }) {
  const d = node.data || {}
  const set = (k,v) => onChange({ ...node, data:{ ...d,[k]:v } })
  const setInv = (inv) => onChange({ ...node, data:{ ...d,...inv } })

  switch (node.type) {

    // ── SYSTEM ──────────────────────────────────────────────────────────────────
    case 'start': return (
      <>
        <PanelSection title="Trigger">
          <Field label="Trigger Type">
            <NativeSelect value={d.trigger||'any'} onChange={e=>set('trigger',e.target.value)} sm>
              <option value="any">Any Message</option>
              <option value="keyword">Keyword</option>
              <option value="button">Button Reply</option>
              <option value="opt_in">Contact Opt-In</option>
              <option value="first_message">First Message</option>
            </NativeSelect>
          </Field>
          {d.trigger==='keyword' && <>
            <Field label="Keywords (comma-separated)">
              <TInput value={d.keywords||''} onChange={v=>set('keywords',v)} placeholder="hello, hi, hey"/>
            </Field>
            <Field label="Match Type">
              <NativeSelect value={d.matchType||'contains'} onChange={e=>set('matchType',e.target.value)} sm>
                <option value="contains">Contains</option>
                <option value="exact">Exact Match</option>
                <option value="starts_with">Starts With</option>
                <option value="ends_with">Ends With</option>
              </NativeSelect>
            </Field>
          </>}
          <Toggle value={d.optIn||false} onChange={v=>set('optIn',v)} label="Only opted-in contacts"/>
        </PanelSection>
      </>
    )

    case 'end': return (
      <>
        <PanelSection title="End Behavior">
          <Field label="Action on End">
            <NativeSelect value={d.action||'none'} onChange={e=>set('action',e.target.value)} sm>
              <option value="none">None</option>
              <option value="resolve">Resolve Conversation</option>
              <option value="unassign">Unassign Agent</option>
              <option value="opt_out">Opt-Out Contact</option>
            </NativeSelect>
          </Field>
          <Field label="End Message (optional)">
            <TTextarea value={d.endMessage||''} onChange={v=>set('endMessage',v)} placeholder="Goodbye message..." rows={2}/>
          </Field>
        </PanelSection>
      </>
    )

    // ── SEND ────────────────────────────────────────────────────────────────────
    case 'text': return (
      <>
        <PanelSection title="Message">
          <RichField value={d.message||''} onChange={v=>set('message',v)} placeholder="Type your message here..." rows={4}/>
        </PanelSection>
        <PanelSection title="Insert Variable">
          <VarPicker onChange={v=>set('message',(d.message||'')+v)}/>
        </PanelSection>
      </>
    )

    case 'media': return (
      <>
        <PanelSection title="Media">
          <Field label="Media Type">
            <NativeSelect value={d.mediaType||'image'} onChange={e=>set('mediaType',e.target.value)} sm>
              <option value="image">Image</option>
              <option value="video">Video</option>
              <option value="document">Document</option>
              <option value="audio">Audio</option>
            </NativeSelect>
          </Field>
          <Field label="Media URL"><TInput value={d.url||''} onChange={v=>set('url',v)} placeholder="https://..."/></Field>
          {d.mediaType!=='audio' && <Field label="Caption"><TTextarea value={d.caption||''} onChange={v=>set('caption',v)} rows={2}/></Field>}
          {d.mediaType==='document' && <Field label="File Name"><TInput value={d.fileName||''} onChange={v=>set('fileName',v)} placeholder="document.pdf"/></Field>}
        </PanelSection>
      </>
    )

    case 'send_buttons': return (
      <>
        <PanelSection title="Message">
          <Field label="Header Text (optional)"><TInput value={d.headerText||''} onChange={v=>set('headerText',v)}/></Field>
          <Field label="Body Text"><RichField value={d.bodyText||''} onChange={v=>set('bodyText',v)} rows={3}/></Field>
        </PanelSection>
        <PanelSection title="Buttons (max 3)">
          <ButtonList buttons={d.buttons||[]} onChange={v=>set('buttons',v)} max={3} nodes={nodes}/>
        </PanelSection>
      </>
    )

    case 'send_list': return (
      <>
        <PanelSection title="Message">
          <Field label="Header Text"><TInput value={d.headerText||''} onChange={v=>set('headerText',v)}/></Field>
          <Field label="Body Text"><RichField value={d.bodyText||''} onChange={v=>set('bodyText',v)} rows={3}/></Field>
          <Field label="Button Label"><TInput value={d.buttonLabel||'View Options'} onChange={v=>set('buttonLabel',v)}/></Field>
        </PanelSection>
        <PanelSection title="Sections">
          <SectionList sections={d.sections||[]} onChange={v=>set('sections',v)} nodes={nodes}/>
        </PanelSection>
      </>
    )

    case 'template': return (
      <>
        <PanelSection title="Template">
          <Field label="Template Name"><TInput value={d.templateName||''} onChange={v=>set('templateName',v)} placeholder="my_template_name"/></Field>
          <Field label="Language">
            <NativeSelect value={d.language||'en'} onChange={e=>set('language',e.target.value)} sm>
              {[['en','English'],['hi','Hindi'],['ta','Tamil'],['te','Telugu'],['kn','Kannada'],['mr','Marathi'],['ar','Arabic'],['es','Spanish'],['pt_BR','Portuguese (BR)']].map(([v,l])=><option key={v} value={v}>{l}</option>)}
            </NativeSelect>
          </Field>
          <Field label="Header Variable"><TInput value={d.headerVar||''} onChange={v=>set('headerVar',v)} placeholder="{{variable}}"/></Field>
          <Field label="CTA URL (optional)"><TInput value={d.ctaUrl||''} onChange={v=>set('ctaUrl',v)} placeholder="https://"/></Field>
        </PanelSection>
        <PanelSection title="Body Variables">
          <KVList items={d.bodyVars||[]} onChange={v=>set('bodyVars',v)} keyPlaceholder="Param ({{1}})" valPlaceholder="Value"/>
        </PanelSection>
      </>
    )

    case 'send_voice': return (
      <PanelSection title="Audio">
        <Field label="Audio URL"><TInput value={d.audioUrl||''} onChange={v=>set('audioUrl',v)} placeholder="https://...mp3"/></Field>
      </PanelSection>
    )

    case 'catalog': return (
      <PanelSection title="Catalog">
        <Field label="Catalog ID"><TInput value={d.catalogId||''} onChange={v=>set('catalogId',v)}/></Field>
        <Field label="Product Set ID"><TInput value={d.productSetId||''} onChange={v=>set('productSetId',v)}/></Field>
        <Field label="Body Text"><TTextarea value={d.bodyText||''} onChange={v=>set('bodyText',v)} rows={2}/></Field>
        <Field label="Footer"><TInput value={d.footerText||''} onChange={v=>set('footerText',v)}/></Field>
      </PanelSection>
    )

    // ── ASK ─────────────────────────────────────────────────────────────────────
    case 'ask_text': return (
      <>
        <PanelSection title="Question Text">
          <RichField value={d.question||''} onChange={v=>set('question',v)} placeholder="What is your name?" rows={3}/>
        </PanelSection>
      </>
    )

    case 'ask_number': return (
      <>
        <PanelSection title="Question Text">
          <RichField value={d.question||''} onChange={v=>set('question',v)} placeholder="Enter a number" rows={3}/>
        </PanelSection>
        <PanelSection title="Range">
          <div className="grid grid-cols-2 gap-2">
            <Field label="Min Value"><TInput type="number" value={d.min||''} onChange={v=>set('min',v)}/></Field>
            <Field label="Max Value"><TInput type="number" value={d.max||''} onChange={v=>set('max',v)}/></Field>
          </div>
        </PanelSection>
      </>
    )

    case 'ask_phone': return (
      <>
        <PanelSection title="Question Text">
          <RichField value={d.question||''} onChange={v=>set('question',v)} rows={3}/>
        </PanelSection>
        <PanelSection title="Response">
          <Field label="Default Country Code">
            <NativeSelect value={d.countryCode||'+91'} onChange={e=>set('countryCode',e.target.value)} sm>
              {[['+91','India'],['+1','USA'],['+44','UK'],['+971','UAE'],['+65','Singapore'],['+60','Malaysia']].map(([v,l])=><option key={v} value={v}>{v} {l}</option>)}
            </NativeSelect>
          </Field>
        </PanelSection>
      </>
    )

    case 'ask_email': return (
      <>
        <PanelSection title="Question Text">
          <RichField value={d.question||''} onChange={v=>set('question',v)} rows={3}/>
        </PanelSection>
      </>
    )

    case 'ask_date': return (
      <>
        <PanelSection title="Question Text">
          <RichField value={d.question||''} onChange={v=>set('question',v)} rows={3}/>
        </PanelSection>
        <PanelSection title="Date Settings">
          <Field label="Date Format">
            <NativeSelect value={d.dateFormat||'DD/MM/YYYY'} onChange={e=>set('dateFormat',e.target.value)} sm>
              <option value="DD/MM/YYYY">DD/MM/YYYY</option>
              <option value="MM/DD/YYYY">MM/DD/YYYY</option>
              <option value="YYYY-MM-DD">YYYY-MM-DD</option>
            </NativeSelect>
          </Field>
          <div className="grid grid-cols-2 gap-2">
            <Field label="Min Date"><TInput value={d.minDate||''} onChange={v=>set('minDate',v)} placeholder="YYYY-MM-DD"/></Field>
            <Field label="Max Date"><TInput value={d.maxDate||''} onChange={v=>set('maxDate',v)} placeholder="YYYY-MM-DD"/></Field>
          </div>
        </PanelSection>
      </>
    )

    case 'ask_location': return (
      <>
        <PanelSection title="Question Text">
          <RichField value={d.question||''} onChange={v=>set('question',v)} rows={3}/>
          <p className="text-[10px] text-slate-400">User will share their location pin via WhatsApp</p>
        </PanelSection>
      </>
    )

    case 'ask_url': return (
      <>
        <PanelSection title="Question Text">
          <RichField value={d.question||''} onChange={v=>set('question',v)} rows={3}/>
        </PanelSection>
      </>
    )

    case 'ask_file': return (
      <>
        <PanelSection title="Question Text">
          <RichField value={d.question||''} onChange={v=>set('question',v)} rows={3}/>
        </PanelSection>
        <PanelSection title="File Settings">
          <Field label="Allowed File Types">
            <div className="space-y-1.5">
              {['image','video','document','audio'].map(t=>(
                <label key={t} className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={(d.allowedTypes||[]).includes(t)}
                    onChange={e=>{
                      const cur=d.allowedTypes||[]
                      set('allowedTypes',e.target.checked?[...cur,t]:cur.filter(x=>x!==t))
                    }}
                    className="w-3.5 h-3.5 accent-primary"/>
                  <span className="text-xs text-slate-700 capitalize">{t}</span>
                </label>
              ))}
            </div>
          </Field>
          <Field label="Max File Size (MB)"><TInput type="number" value={d.maxSizeMB||10} onChange={v=>set('maxSizeMB',+v)}/></Field>
        </PanelSection>
      </>
    )

    case 'ask_button': return (
      <>
        <PanelSection title="Question Text">
          <RichField value={d.question||''} onChange={v=>set('question',v)} placeholder="Choose an option:" rows={3}/>
        </PanelSection>
        <PanelSection title="Buttons (max 3)">
          <ButtonList buttons={d.buttons||[]} onChange={v=>set('buttons',v)} max={3} nodes={nodes}/>
        </PanelSection>
      </>
    )

    case 'ask_list': return (
      <>
        <PanelSection title="Question">
          <Field label="Header Type">
            <NativeSelect value={d.headerType||'text'} onChange={e=>set('headerType',e.target.value)} sm>
              <option value="text">Text</option>
              <option value="image">Image</option>
              <option value="video">Video</option>
              <option value="document">Document</option>
            </NativeSelect>
          </Field>
          {(d.headerType||'text')==='text'
            ? <Field label="Header Text"><TInput value={d.headerText||''} onChange={v=>set('headerText',v)}/></Field>
            : <Field label="Header Media URL"><TInput value={d.headerUrl||''} onChange={v=>set('headerUrl',v)} placeholder="https://"/></Field>}
          <Field label="Question / Body"><RichField value={d.question||''} onChange={v=>set('question',v)} placeholder="Choose from the list:" rows={3}/></Field>
          <Field label="Button Label"><TInput value={d.buttonLabel||'Choose Option'} onChange={v=>set('buttonLabel',v)}/></Field>
        </PanelSection>
        <PanelSection title="Options">
          <Field label="Options Type">
            <NativeSelect value={d.optionsType||'static'} onChange={e=>set('optionsType',e.target.value)} sm>
              <option value="static">Static Options</option>
              <option value="dynamic">Dynamic (from Variable)</option>
              <option value="dynamic_sections">Dynamic with Sections</option>
            </NativeSelect>
          </Field>
          {(d.optionsType||'static')==='static' && (
            <SectionList sections={d.sections||[]} onChange={v=>set('sections',v)} nodes={nodes}/>
          )}
          {d.optionsType==='dynamic' && <>
            <Field label="Variable to Iterate"><VarPicker value={d.dynamicVar||''} onChange={v=>set('dynamicVar',v)}/></Field>
            <Field label="Path to ID"><TInput value={d.dynamicPathId||''} onChange={v=>set('dynamicPathId',v)} placeholder="e.g. id"/></Field>
            <Field label="Path to Title"><TInput value={d.dynamicPathTitle||''} onChange={v=>set('dynamicPathTitle',v)} placeholder="e.g. name"/></Field>
          </>}
          {d.optionsType==='dynamic_sections' && <>
            <Field label="Variable to Iterate"><VarPicker value={d.dynamicVar||''} onChange={v=>set('dynamicVar',v)}/></Field>
            <Field label="Path to Section Title"><TInput value={d.dynamicPathSectionTitle||''} onChange={v=>set('dynamicPathSectionTitle',v)} placeholder="e.g. category"/></Field>
            <Field label="Path to ID"><TInput value={d.dynamicPathId||''} onChange={v=>set('dynamicPathId',v)} placeholder="e.g. id"/></Field>
            <Field label="Path to Title"><TInput value={d.dynamicPathTitle||''} onChange={v=>set('dynamicPathTitle',v)} placeholder="e.g. name"/></Field>
            <Field label="Path to Description"><TInput value={d.dynamicPathDesc||''} onChange={v=>set('dynamicPathDesc',v)} placeholder="e.g. description"/></Field>
          </>}
        </PanelSection>
      </>
    )

    case 'ask_keyword': return (
      <>
        <PanelSection title="Question Text">
          <RichField value={d.question||''} onChange={v=>set('question',v)} placeholder="Type a keyword to continue" rows={3}/>
        </PanelSection>
        <PanelSection title="Keywords">
          <div className="space-y-1.5">
            {(d.keywords||[]).map((kw,i)=>(
              <div key={kw.id} className="flex gap-1.5 items-center">
                <input value={kw.label} onChange={e=>{const kws=[...(d.keywords||[])];kws[i]={...kws[i],label:e.target.value};set('keywords',kws)}}
                  placeholder="Display label" className={clsx(inputSmCls,'flex-1')}/>
                <input value={kw.value} onChange={e=>{const kws=[...(d.keywords||[])];kws[i]={...kws[i],value:e.target.value};set('keywords',kws)}}
                  placeholder="Keyword value" className={clsx(inputSmCls,'flex-1')}/>
                <button onClick={()=>set('keywords',(d.keywords||[]).filter(k=>k.id!==kw.id))} className="text-slate-400 hover:text-red-500"><X size={12}/></button>
              </div>
            ))}
            <button onClick={()=>set('keywords',[...(d.keywords||[]),{id:String(Date.now()),label:'',value:''}])}
              className="w-full text-[11px] text-primary bg-primary-50 rounded-lg py-1.5 font-semibold flex items-center justify-center gap-1 hover:bg-primary/10 transition-colors">
              <Plus size={11}/> Add Keyword
            </button>
          </div>
          <Toggle value={d.caseSensitive||false} onChange={v=>set('caseSensitive',v)} label="Case Sensitive"/>
        </PanelSection>
      </>
    )

    case 'ask_collection': return (
      <>
        <PanelSection title="Question Text">
          <RichField value={d.question||''} onChange={v=>set('question',v)} rows={3}/>
        </PanelSection>
        <PanelSection title="Catalog">
          <Field label="Catalog ID"><TInput value={d.catalogId||''} onChange={v=>set('catalogId',v)}/></Field>
          <Field label="Product Set ID"><TInput value={d.productSetId||''} onChange={v=>set('productSetId',v)}/></Field>
        </PanelSection>
      </>
    )

    case 'ask_form': return (
      <>
        <PanelSection title="Form Settings">
          <Field label="Form Title"><TInput value={d.title||''} onChange={v=>set('title',v)} placeholder="Please fill this form"/></Field>
          <Field label="Submit Button Label"><TInput value={d.submitLabel||'Submit'} onChange={v=>set('submitLabel',v)}/></Field>
        </PanelSection>
        <PanelSection title="Form Fields">
          <div className="space-y-2">
            {(d.fields||[]).map((f,i)=>(
              <div key={f.id} className="border border-surface-border rounded-lg p-2.5 space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold text-slate-400 uppercase">Field {i+1}</span>
                  <button onClick={()=>set('fields',(d.fields||[]).filter(x=>x.id!==f.id))} className="text-slate-400 hover:text-red-500"><X size={11}/></button>
                </div>
                <input value={f.label} onChange={e=>{const fs=[...(d.fields||[])];fs[i]={...fs[i],label:e.target.value};set('fields',fs)}}
                  placeholder="Label" className={inputSmCls}/>
                <NativeSelect value={f.type} onChange={e=>{const fs=[...(d.fields||[])];fs[i]={...fs[i],type:e.target.value};set('fields',fs)}} sm>
                  {['text','number','email','phone','date','select'].map(t=><option key={t} value={t}>{t}</option>)}
                </NativeSelect>
                <div className="flex items-center gap-2">
                  <label className="flex items-center gap-1.5 cursor-pointer text-xs text-slate-700">
                    <input type="checkbox" checked={f.required||false}
                      onChange={e=>{const fs=[...(d.fields||[])];fs[i]={...fs[i],required:e.target.checked};set('fields',fs)}}
                      className="accent-primary"/>
                    Required
                  </label>
                  <input value={f.saveAs||''} onChange={e=>{const fs=[...(d.fields||[])];fs[i]={...fs[i],saveAs:e.target.value};set('fields',fs)}}
                    placeholder="Save As {{variable}}" className={clsx(inputSmCls,'flex-1')}/>
                </div>
              </div>
            ))}
            <button onClick={()=>set('fields',[...(d.fields||[]),{id:String(Date.now()),label:'',type:'text',required:true,saveAs:''}])}
              className="w-full text-[11px] text-primary bg-primary-50 rounded-lg py-1.5 font-semibold flex items-center justify-center gap-1 hover:bg-primary/10 transition-colors">
              <Plus size={11}/> Add Field
            </button>
          </div>
        </PanelSection>
      </>
    )

    case 'ask_payment': return (
      <>
        <PanelSection title="Payment">
          <Field label="Payment Gateway">
            <NativeSelect value={d.gateway||'razorpay'} onChange={e=>set('gateway',e.target.value)} sm>
              <option value="razorpay">Razorpay</option>
              <option value="stripe">Stripe</option>
              <option value="payu">PayU</option>
            </NativeSelect>
          </Field>
          <div className="grid grid-cols-2 gap-2">
            <Field label="Amount"><TInput value={d.amount||''} onChange={v=>set('amount',v)} placeholder="0.00"/></Field>
            <Field label="Currency">
              <NativeSelect value={d.currency||'INR'} onChange={e=>set('currency',e.target.value)} sm>
                {['INR','USD','EUR','GBP','AED'].map(c=><option key={c} value={c}>{c}</option>)}
              </NativeSelect>
            </Field>
          </div>
          <Field label="Description"><TInput value={d.description||''} onChange={v=>set('description',v)}/></Field>
        </PanelSection>
        <PanelSection title="Collect from Customer">
          <Toggle value={d.askName||false} onChange={v=>set('askName',v)} label="Name"/>
          <Toggle value={d.askPhone||false} onChange={v=>set('askPhone',v)} label="Phone"/>
          <Toggle value={d.askEmail||false} onChange={v=>set('askEmail',v)} label="Email"/>
        </PanelSection>
        <PanelSection title="Response">
        </PanelSection>
      </>
    )

    // ── ACTIONS ─────────────────────────────────────────────────────────────────
    case 'assign': return (
      <>
        <PanelSection title="Assignment">
          <Field label="Assign To">
            <NativeSelect value={d.assignTo||'agent'} onChange={e=>set('assignTo',e.target.value)} sm>
              <option value="agent">Specific Agent</option>
              <option value="team">Team</option>
              <option value="bot">Bot Only</option>
              <option value="round_robin">Round Robin</option>
            </NativeSelect>
          </Field>
          {d.assignTo==='agent' && <Field label="Agent ID"><TInput value={d.agentId||''} onChange={v=>set('agentId',v)}/></Field>}
          {d.assignTo==='team'  && <Field label="Team ID"><TInput value={d.teamId||''} onChange={v=>set('teamId',v)}/></Field>}
          <Field label="Handoff Message (optional)"><TTextarea value={d.handoffMsg||''} onChange={v=>set('handoffMsg',v)} rows={2}/></Field>
        </PanelSection>
      </>
    )

    case 'unassign': return (
      <PanelSection title="Unassign">
        <Field label="Handoff Message (optional)"><TTextarea value={d.handoffMsg||''} onChange={v=>set('handoffMsg',v)} rows={2}/></Field>
      </PanelSection>
    )

    case 'resolve': return (
      <PanelSection title="Resolve">
        <Toggle value={d.sendMsg||false} onChange={v=>set('sendMsg',v)} label="Send message before resolving"/>
        {d.sendMsg && <Field label="Resolve Message"><TTextarea value={d.resolveMsg||''} onChange={v=>set('resolveMsg',v)} rows={2}/></Field>}
      </PanelSection>
    )

    case 'update_conv': return (
      <PanelSection title="Conversation Attributes">
        <KVList items={d.fields||[]} onChange={v=>set('fields',v)} keyPlaceholder="Field" valPlaceholder="Value"/>
      </PanelSection>
    )

    case 'update_contact': return (
      <PanelSection title="Contact Attributes">
        <KVList items={d.fields||[]} onChange={v=>set('fields',v)} keyPlaceholder="Field" valPlaceholder="Value"/>
      </PanelSection>
    )

    case 'update_company': return (
      <PanelSection title="Company Attributes">
        <KVList items={d.fields||[]} onChange={v=>set('fields',v)} keyPlaceholder="Field" valPlaceholder="Value"/>
      </PanelSection>
    )

    case 'push_seq': return (
      <PanelSection title="Sequence">
        <Field label="Sequence ID"><TInput value={d.sequenceId||''} onChange={v=>set('sequenceId',v)}/></Field>
        <Field label="Delay (minutes)"><TInput type="number" value={d.delayMinutes||0} onChange={v=>set('delayMinutes',+v)}/></Field>
      </PanelSection>
    )

    case 'add_note': return (
      <PanelSection title="Note">
        <Field label="Note Text"><TTextarea value={d.noteText||''} onChange={v=>set('noteText',v)} placeholder="Internal note..." rows={4}/></Field>
      </PanelSection>
    )

    // ── UTILITIES ───────────────────────────────────────────────────────────────
    case 'delay': return (
      <PanelSection title="Delay Settings">
        <div className="grid grid-cols-2 gap-2">
          <Field label="Duration"><TInput type="number" value={d.duration||5} onChange={v=>set('duration',+v)}/></Field>
          <Field label="Unit">
            <NativeSelect value={d.unit||'seconds'} onChange={e=>set('unit',e.target.value)} sm>
              <option value="seconds">Seconds</option>
              <option value="minutes">Minutes</option>
              <option value="hours">Hours</option>
              <option value="days">Days</option>
            </NativeSelect>
          </Field>
        </div>
      </PanelSection>
    )

    case 'condition': return (
      <>
        <PanelSection title="Condition">
          <Field label="Variable"><VarPicker value={d.variable||''} onChange={v=>set('variable',v)}/></Field>
          <Field label="Operator">
            <NativeSelect value={d.operator||'equals'} onChange={e=>set('operator',e.target.value)} sm>
              {[['equals','Equals'],['not_equals','Not Equals'],['contains','Contains'],['not_contains','Does Not Contain'],['starts_with','Starts With'],['ends_with','Ends With'],['greater_than','Greater Than'],['less_than','Less Than'],['is_empty','Is Empty'],['is_not_empty','Is Not Empty']].map(([v,l])=><option key={v} value={v}>{l}</option>)}
            </NativeSelect>
          </Field>
          {!['is_empty','is_not_empty'].includes(d.operator) && <Field label="Value"><TInput value={d.value||''} onChange={v=>set('value',v)} placeholder="Compare value"/></Field>}
        </PanelSection>
        <PanelSection title="Branch Labels">
          <div className="grid grid-cols-2 gap-2">
            <Field label="True Label"><TInput value={d.trueLabel||'Yes'} onChange={v=>set('trueLabel',v)}/></Field>
            <Field label="False Label"><TInput value={d.falseLabel||'No'} onChange={v=>set('falseLabel',v)}/></Field>
          </div>
        </PanelSection>
      </>
    )

    case 'set_var': return (
      <PanelSection title="Variable">
        <Field label="Variable"><VarPicker value={d.variable||''} onChange={v=>set('variable',v)}/></Field>
        <Field label="Value Type">
          <NativeSelect value={d.valueType||'static'} onChange={e=>set('valueType',e.target.value)} sm>
            <option value="static">Static Value</option>
            <option value="variable">From Variable</option>
            <option value="expression">Expression</option>
          </NativeSelect>
        </Field>
        <Field label="Value">
          {d.valueType==='variable'
            ? <VarPicker value={d.value||''} onChange={v=>set('value',v)}/>
            : <TInput value={d.value||''} onChange={v=>set('value',v)} placeholder="Value"/>}
        </Field>
      </PanelSection>
    )

    case 'jump': return (
      <PanelSection title="Jump Target">
        <Field label="Target Node">
          <NativeSelect value={d.targetNodeId||''} onChange={e=>set('targetNodeId',e.target.value)} sm>
            <option value="">— Select node —</option>
            {(nodes||[]).filter(n=>n.id!==node.id).map(n=>(
              <option key={n.id} value={n.id}>{n.data?.name||n.type} ({n.id})</option>
            ))}
          </NativeSelect>
        </Field>
      </PanelSection>
    )

    case 'switch_node': return (
      <>
        <PanelSection title="Switch Variable">
          <Field label="Variable"><VarPicker value={d.variable||''} onChange={v=>set('variable',v)}/></Field>
        </PanelSection>
        <PanelSection title="Cases">
          <div className="space-y-1.5">
            {(d.cases||[]).map((c,i)=>(
              <div key={c.id} className="flex gap-1.5 items-center">
                <input value={c.value} onChange={e=>{const cs=[...(d.cases||[])];cs[i]={...cs[i],value:e.target.value};set('cases',cs)}}
                  placeholder="When equals..." className={clsx(inputSmCls,'flex-1')}/>
                <input value={c.label} onChange={e=>{const cs=[...(d.cases||[])];cs[i]={...cs[i],label:e.target.value};set('cases',cs)}}
                  placeholder="Branch label" className={clsx(inputSmCls,'flex-1')}/>
                <button onClick={()=>set('cases',(d.cases||[]).filter(x=>x.id!==c.id))} className="text-slate-400 hover:text-red-500"><X size={12}/></button>
              </div>
            ))}
            <button onClick={()=>set('cases',[...(d.cases||[]),{id:String(Date.now()),value:'',label:`Case ${(d.cases||[]).length+1}`}])}
              className="w-full text-[11px] text-primary bg-primary-50 rounded-lg py-1.5 font-semibold flex items-center justify-center gap-1 hover:bg-primary/10 transition-colors">
              <Plus size={11}/> Add Case
            </button>
          </div>
          <Field label="Default Branch Label"><TInput value={d.defaultLabel||'Default'} onChange={v=>set('defaultLabel',v)}/></Field>
        </PanelSection>
      </>
    )

    case 'gpt_dialog': return (
      <>
        <PanelSection title="AI Settings">
          <Field label="System Prompt" hint="Instructions guiding AI behavior">
            <TTextarea value={d.prompt||''} onChange={v=>set('prompt',v)} placeholder="You are a helpful assistant that..." rows={4}/>
          </Field>
          <Field label="User Message">
            <TInput value={d.userMessage||'{{intent.text}}'} onChange={v=>set('userMessage',v)} placeholder="{{intent.text}}"/>
          </Field>
          <div className="grid grid-cols-2 gap-2">
            <Field label="Max Tokens"><TInput type="number" value={d.maxTokens||500} onChange={v=>set('maxTokens',+v)}/></Field>
            <Field label="Temperature"><TInput type="number" value={d.temperature||0.7} onChange={v=>set('temperature',+v)}/></Field>
          </div>
        </PanelSection>
        <PanelSection title="Functions (Data Collection)">
          {(d.functions||[]).map((fn,fi)=>(
            <div key={fi} className="border border-surface-border rounded-lg p-2 space-y-1.5 mb-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-primary">Function {fi+1}</span>
                <button onClick={()=>set('functions',(d.functions||[]).filter((_,idx)=>idx!==fi))} className="text-slate-400 hover:text-red-500"><X size={12}/></button>
              </div>
              <input value={fn.name||''} onChange={e=>{const fns=[...(d.functions||[])];fns[fi]={...fns[fi],name:e.target.value};set('functions',fns)}}
                placeholder="Function name" className={inputSmCls}/>
              <input value={fn.description||''} onChange={e=>{const fns=[...(d.functions||[])];fns[fi]={...fns[fi],description:e.target.value};set('functions',fns)}}
                placeholder="Description" className={inputSmCls}/>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Parameters</p>
              {(fn.params||[]).map((p,pi)=>(
                <div key={pi} className="flex gap-1 items-center">
                  <input value={p.name||''} onChange={e=>{const fns=[...(d.functions||[])];fns[fi].params[pi]={...p,name:e.target.value};set('functions',fns)}}
                    placeholder="Name" className={clsx(inputSmCls,'flex-1')}/>
                  <NativeSelect value={p.type||'string'} onChange={e=>{const fns=[...(d.functions||[])];fns[fi].params[pi]={...p,type:e.target.value};set('functions',fns)}} sm>
                    <option value="string">string</option>
                    <option value="number">number</option>
                    <option value="boolean">boolean</option>
                  </NativeSelect>
                  <input value={p.storeAs||''} onChange={e=>{const fns=[...(d.functions||[])];fns[fi].params[pi]={...p,storeAs:e.target.value};set('functions',fns)}}
                    placeholder="Store in {{var}}" className={clsx(inputSmCls,'flex-1')}/>
                  <button onClick={()=>{const fns=[...(d.functions||[])];fns[fi].params=fns[fi].params.filter((_,idx)=>idx!==pi);set('functions',fns)}}
                    className="text-slate-400 hover:text-red-500"><X size={11}/></button>
                </div>
              ))}
              <button onClick={()=>{const fns=[...(d.functions||[])];if(!fns[fi].params)fns[fi].params=[];fns[fi].params.push({name:'',type:'string',storeAs:''});set('functions',fns)}}
                className="w-full text-[10px] text-primary bg-primary-50 rounded py-1 font-semibold flex items-center justify-center gap-1">
                <Plus size={10}/> Add Parameter
              </button>
            </div>
          ))}
          <button onClick={()=>set('functions',[...(d.functions||[]),{name:'',description:'',params:[]}])}
            className="w-full text-[11px] text-primary bg-primary-50 rounded-lg py-1.5 font-semibold flex items-center justify-center gap-1 hover:bg-primary/10 transition-colors">
            <Plus size={11}/> Add Function
          </button>
        </PanelSection>
      </>
    )

    case 'gpt_kb': return (
      <PanelSection title="Knowledge Base">
        <Field label="Knowledge Base ID"><TInput value={d.knowledgeBaseId||''} onChange={v=>set('knowledgeBaseId',v)}/></Field>
        <Field label="User Message"><TInput value={d.userMessage||'{{intent.text}}'} onChange={v=>set('userMessage',v)}/></Field>
        <Field label="Input Variables"><TInput value={d.inputVars||''} onChange={v=>set('inputVars',v)} placeholder="{{var1}}, {{var2}}"/></Field>
        <Field label="Max Tokens"><TInput type="number" value={d.maxTokens||500} onChange={v=>set('maxTokens',+v)}/></Field>
        <Field label="Fallback Message"><TTextarea value={d.fallbackMessage||''} onChange={v=>set('fallbackMessage',v)} rows={2}/></Field>
        <Field label="Save Response As"><VarPicker value={d.saveAs||''} onChange={v=>set('saveAs',v)}/></Field>
      </PanelSection>
    )

    case 'working_hours': {
      const schedule = d.schedule || {}
      const updDay = (day,field,val) => set('schedule', { ...schedule, [day]:{ ...(schedule[day]||{}), [field]:val } })
      return (
        <>
          <PanelSection title="Timezone">
            <NativeSelect value={d.timezone||'Asia/Kolkata'} onChange={e=>set('timezone',e.target.value)} sm>
              {TIMEZONES.map(tz=><option key={tz} value={tz}>{tz}</option>)}
            </NativeSelect>
          </PanelSection>
          <PanelSection title="Schedule">
            <div className="border border-surface-border rounded-lg overflow-hidden">
              {DAYS.map((day,idx) => {
                const ds = schedule[day] || { enabled:false, open:'09:00', close:'18:00' }
                return (
                  <div key={day} className={clsx('flex items-center gap-2 px-3 py-2 text-xs', idx<DAYS.length-1&&'border-b border-surface-border', ds.enabled?'bg-white':'bg-slate-50')}>
                    <Toggle value={ds.enabled} onChange={v=>updDay(day,'enabled',v)}/>
                    <span className={clsx('font-bold w-8 flex-shrink-0', ds.enabled?'text-slate-700':'text-slate-400')}>{DAY_LABELS[day]}</span>
                    {ds.enabled ? (
                      <div className="flex items-center gap-1 flex-1">
                        <input type="time" value={ds.open||'09:00'} onChange={e=>updDay(day,'open',e.target.value)}
                          className="text-[11px] border border-surface-border rounded px-1.5 py-0.5 outline-none focus:border-primary/40"/>
                        <span className="text-slate-400">–</span>
                        <input type="time" value={ds.close||'18:00'} onChange={e=>updDay(day,'close',e.target.value)}
                          className="text-[11px] border border-surface-border rounded px-1.5 py-0.5 outline-none focus:border-primary/40"/>
                      </div>
                    ) : <span className="text-[11px] text-slate-400 flex-1">Closed</span>}
                  </div>
                )
              })}
            </div>
            <div className="grid grid-cols-2 gap-2 mt-2">
              <Field label="Inside Hours Label"><TInput value={d.insideLabel||'Open'} onChange={v=>set('insideLabel',v)}/></Field>
              <Field label="Outside Hours Label"><TInput value={d.outsideLabel||'Closed'} onChange={v=>set('outsideLabel',v)}/></Field>
            </div>
          </PanelSection>
        </>
      )
    }

    case 'hint': return (
      <PanelSection title="Hint">
        <Field label="Hint Text"><TTextarea value={d.hintText||''} onChange={v=>set('hintText',v)} rows={3}/></Field>
        <Field label="Visible To">
          <NativeSelect value={d.visibleTo||'all'} onChange={e=>set('visibleTo',e.target.value)} sm>
            <option value="all">All Agents</option>
            <option value="assigned">Assigned Agent Only</option>
            <option value="admin">Admin Only</option>
          </NativeSelect>
        </Field>
      </PanelSection>
    )

    case 'wait_order': return (
      <PanelSection title="Wait Settings">
        <div className="grid grid-cols-2 gap-2">
          <Field label="Timeout"><TInput type="number" value={d.timeoutDuration||24} onChange={v=>set('timeoutDuration',+v)}/></Field>
          <Field label="Unit">
            <NativeSelect value={d.timeoutUnit||'hours'} onChange={e=>set('timeoutUnit',e.target.value)} sm>
              <option value="minutes">Minutes</option>
              <option value="hours">Hours</option>
              <option value="days">Days</option>
            </NativeSelect>
          </Field>
        </div>
      </PanelSection>
    )

    // ── CONNECTORS ──────────────────────────────────────────────────────────────
    case 'sheets': return (
      <>
        <PanelSection title="Google Sheets">
          <Field label="Spreadsheet ID"><TInput value={d.spreadsheetId||''} onChange={v=>set('spreadsheetId',v)}/></Field>
          <Field label="Sheet Name"><TInput value={d.sheetName||''} onChange={v=>set('sheetName',v)} placeholder="Sheet1"/></Field>
          <Field label="Operation">
            <NativeSelect value={d.operation||'append'} onChange={e=>set('operation',e.target.value)} sm>
              <option value="append">Append Row</option>
              <option value="update">Update Row</option>
              <option value="read">Read Row</option>
              <option value="delete">Delete Row</option>
            </NativeSelect>
          </Field>
        </PanelSection>
        <PanelSection title="Field Mapping">
          <KVList items={d.fields||[]} onChange={v=>set('fields',v)} keyPlaceholder="Column" valPlaceholder="Value"/>
        </PanelSection>
      </>
    )

    case 'api': return (
      <>
        <PanelSection title="Request">
          <div className="grid grid-cols-3 gap-2">
            <Field label="Method">
              <NativeSelect value={d.method||'POST'} onChange={e=>set('method',e.target.value)} sm>
                {['GET','POST','PUT','PATCH','DELETE'].map(m=><option key={m} value={m}>{m}</option>)}
              </NativeSelect>
            </Field>
            <div className="col-span-2"><Field label="URL"><TInput value={d.url||''} onChange={v=>set('url',v)} placeholder="https://api.example.com/"/></Field></div>
          </div>
        </PanelSection>
        <PanelSection title="Headers">
          <KVList items={d.headers||[]} onChange={v=>set('headers',v)} keyPlaceholder="Header" valPlaceholder="Value" addLabel="Add Header"/>
        </PanelSection>
        <PanelSection title="Body">
          <Field label="Body Type">
            <NativeSelect value={d.bodyType||'json'} onChange={e=>set('bodyType',e.target.value)} sm>
              <option value="json">JSON</option>
              <option value="form">Form Data</option>
              <option value="raw">Raw</option>
              <option value="none">None</option>
            </NativeSelect>
          </Field>
          {d.bodyType!=='none' && <Field label="Body"><TTextarea value={d.body||''} onChange={v=>set('body',v)} placeholder='{"key":"{{variable}}"}' rows={4}/></Field>}
        </PanelSection>
        <PanelSection title="Response">
          <KVList items={d.saveFields||[]} onChange={v=>set('saveFields',v)} keyPlaceholder="Variable" valPlaceholder="JSON path (data.id)" addLabel="Map Field"/>
        </PanelSection>
      </>
    )

    case 'razorpay': return (
      <>
        <PanelSection title="Payment">
          <div className="grid grid-cols-2 gap-2">
            <Field label="Amount"><TInput value={d.amount||''} onChange={v=>set('amount',v)}/></Field>
            <Field label="Currency">
              <NativeSelect value={d.currency||'INR'} onChange={e=>set('currency',e.target.value)} sm>
                <option value="INR">INR</option>
                <option value="USD">USD</option>
              </NativeSelect>
            </Field>
          </div>
          <Field label="Description"><TInput value={d.description||''} onChange={v=>set('description',v)}/></Field>
          <Field label="Link Expiry (minutes)"><TInput type="number" value={d.expiry||15} onChange={v=>set('expiry',+v)}/></Field>
        </PanelSection>
        <PanelSection title="Customer">
          <Field label="Customer Name"><TInput value={d.customerName||''} onChange={v=>set('customerName',v)} placeholder="{{recipient.name}}"/></Field>
          <Field label="Customer Phone"><TInput value={d.customerPhone||''} onChange={v=>set('customerPhone',v)} placeholder="{{recipient.phone}}"/></Field>
          <Field label="Customer Email"><TInput value={d.customerEmail||''} onChange={v=>set('customerEmail',v)} placeholder="{{recipient.email}}"/></Field>
        </PanelSection>
      </>
    )

    case 'zoho_crm': return (
      <>
        <PanelSection title="Operation">
          <Field label="Operation">
            <NativeSelect value={d.operation||'create'} onChange={e=>set('operation',e.target.value)} sm>
              <option value="create">Create Record</option>
              <option value="update">Update Record</option>
              <option value="search">Search Records</option>
              <option value="get">Get Record</option>
            </NativeSelect>
          </Field>
          <Field label="Module">
            <NativeSelect value={d.module||'Leads'} onChange={e=>set('module',e.target.value)} sm>
              {['Leads','Contacts','Deals','Accounts'].map(m=><option key={m} value={m}>{m}</option>)}
            </NativeSelect>
          </Field>
        </PanelSection>
        <PanelSection title="Fields">
          <KVList items={d.fields||[]} onChange={v=>set('fields',v)} keyPlaceholder="CRM Field" valPlaceholder="Value"/>
        </PanelSection>
      </>
    )

    case 'shopify': return (
      <>
        <PanelSection title="Operation">
          <Field label="Operation">
            <NativeSelect value={d.operation||'get_order'} onChange={e=>set('operation',e.target.value)} sm>
              <option value="get_order">Get Order</option>
              <option value="get_product">Get Product</option>
              <option value="get_customer">Get Customer</option>
              <option value="update_order">Update Order</option>
            </NativeSelect>
          </Field>
          {['get_order','update_order'].includes(d.operation) && <Field label="Order ID"><TInput value={d.orderId||''} onChange={v=>set('orderId',v)} placeholder="{{order_id}}"/></Field>}
          {d.operation==='get_product' && <Field label="Product ID"><TInput value={d.productId||''} onChange={v=>set('productId',v)}/></Field>}
          {d.operation==='get_customer' && <Field label="Customer Email"><TInput value={d.customerEmail||''} onChange={v=>set('customerEmail',v)}/></Field>}
          {d.operation==='update_order' && <Field label="New Status"><TInput value={d.orderStatus||''} onChange={v=>set('orderStatus',v)}/></Field>}
        </PanelSection>
      </>
    )

    case 'hubspot': return (
      <>
        <PanelSection title="Operation">
          <Field label="Operation">
            <NativeSelect value={d.operation||'create_contact'} onChange={e=>set('operation',e.target.value)} sm>
              <option value="create_contact">Create Contact</option>
              <option value="update_contact">Update Contact</option>
              <option value="create_deal">Create Deal</option>
              <option value="get_contact">Get Contact</option>
            </NativeSelect>
          </Field>
        </PanelSection>
        <PanelSection title="Fields">
          <KVList items={d.fields||[]} onChange={v=>set('fields',v)} keyPlaceholder="HubSpot Property" valPlaceholder="Value"/>
        </PanelSection>
      </>
    )

    case 'zoho_bigin': return (
      <>
        <PanelSection title="Operation">
          <div className="grid grid-cols-2 gap-2">
            <Field label="Operation">
              <NativeSelect value={d.operation||'create'} onChange={e=>set('operation',e.target.value)} sm>
                <option value="create">Create</option>
                <option value="update">Update</option>
                <option value="get">Get</option>
              </NativeSelect>
            </Field>
            <Field label="Module">
              <NativeSelect value={d.module||'Contacts'} onChange={e=>set('module',e.target.value)} sm>
                {['Contacts','Pipelines','Companies'].map(m=><option key={m} value={m}>{m}</option>)}
              </NativeSelect>
            </Field>
          </div>
        </PanelSection>
        <PanelSection title="Fields">
          <KVList items={d.fields||[]} onChange={v=>set('fields',v)} keyPlaceholder="Field" valPlaceholder="Value"/>
        </PanelSection>
      </>
    )

    case 'leadsquared': return (
      <>
        <PanelSection title="LeadSquared">
          <Field label="Activity Event"><TInput value={d.activityEvent||''} onChange={v=>set('activityEvent',v)} placeholder="Activity event code"/></Field>
        </PanelSection>
        <PanelSection title="Lead Fields">
          <KVList items={d.fields||[]} onChange={v=>set('fields',v)} keyPlaceholder="Schema Name" valPlaceholder="Value"/>
        </PanelSection>
      </>
    )

    case 'woocommerce': return (
      <>
        <PanelSection title="Operation">
          <Field label="Operation">
            <NativeSelect value={d.operation||'get_order'} onChange={e=>set('operation',e.target.value)} sm>
              <option value="get_order">Get Order</option>
              <option value="get_product">Get Product</option>
              <option value="update_order_status">Update Order Status</option>
            </NativeSelect>
          </Field>
          {['get_order','update_order_status'].includes(d.operation) && <Field label="Order ID"><TInput value={d.orderId||''} onChange={v=>set('orderId',v)} placeholder="{{order_id}}"/></Field>}
          {d.operation==='get_product' && <Field label="Product ID"><TInput value={d.productId||''} onChange={v=>set('productId',v)}/></Field>}
          {d.operation==='update_order_status' && <Field label="New Status"><TInput value={d.orderStatus||''} onChange={v=>set('orderStatus',v)}/></Field>}
        </PanelSection>
      </>
    )

    case 'openai_conn': return (
      <>
        <PanelSection title="OpenAI">
          <Field label="System Prompt"><TTextarea value={d.prompt||''} onChange={v=>set('prompt',v)} rows={4}/></Field>
          <Field label="Model">
            <NativeSelect value={d.model||'gpt-4o-mini'} onChange={e=>set('model',e.target.value)} sm>
              <option value="gpt-4o-mini">GPT-4o Mini</option>
              <option value="gpt-4o">GPT-4o</option>
              <option value="gpt-4-turbo">GPT-4 Turbo</option>
              <option value="gpt-3.5-turbo">GPT-3.5 Turbo</option>
            </NativeSelect>
          </Field>
          <div className="grid grid-cols-2 gap-2">
            <Field label="Max Tokens"><TInput type="number" value={d.maxTokens||500} onChange={v=>set('maxTokens',+v)}/></Field>
            <Field label="Temperature"><TInput type="number" value={d.temperature||0.7} onChange={v=>set('temperature',+v)}/></Field>
          </div>
        </PanelSection>
      </>
    )

    case 'zoom_conn': return (
      <PanelSection title="Zoom Meeting">
        <Field label="Meeting Topic"><TInput value={d.topic||''} onChange={v=>set('topic',v)}/></Field>
        <Field label="Start Time"><TInput value={d.startTime||''} onChange={v=>set('startTime',v)} placeholder="{{user_date}} or ISO string"/></Field>
        <Field label="Duration (minutes)"><TInput type="number" value={d.duration||60} onChange={v=>set('duration',+v)}/></Field>
      </PanelSection>
    )

    case 'sangam': return (
      <>
        <PanelSection title="Sangam CRM">
          <Field label="Operation">
            <NativeSelect value={d.operation||'create_lead'} onChange={e=>set('operation',e.target.value)} sm>
              <option value="create_lead">Create Lead</option>
              <option value="update_lead">Update Lead</option>
              <option value="create_contact">Create Contact</option>
            </NativeSelect>
          </Field>
        </PanelSection>
        <PanelSection title="Fields">
          <KVList items={d.fields||[]} onChange={v=>set('fields',v)} keyPlaceholder="CRM Field" valPlaceholder="Value"/>
        </PanelSection>
      </>
    )

    case 'ask_appointment':
    case 'ask_appointment_off': {
      const isOnline = node.type === 'ask_appointment'
      const DAYS = [{k:'MON',s:'Mo'},{k:'TUE',s:'Tu'},{k:'WED',s:'We'},{k:'THU',s:'Th'},{k:'FRI',s:'Fr'},{k:'SAT',s:'Sa'},{k:'SUN',s:'Su'}]
      const toggleDay = k => {
        const cur = d.weekdays||[]
        set('weekdays', cur.includes(k) ? cur.filter(x=>x!==k) : [...cur,k])
      }
      const TIMEZONES = ['Asia/Kolkata','Asia/Dubai','Asia/Singapore','Asia/Tokyo','Europe/London','Europe/Paris','America/New_York','America/Chicago','America/Los_Angeles','UTC']
      const timeOpts = []
      for(let h=0;h<24;h++) for(let m=0;m<60;m+=30){
        const hh=String(h).padStart(2,'0'),mm=String(m).padStart(2,'0')
        timeOpts.push(`${hh}:${mm}`)
      }
      const fmt12 = t => {
        if(!t) return t
        const [h,m]=t.split(':').map(Number)
        if((d.format||'12h')==='12h'){const ap=h>=12?'PM':'AM',hr=h%12||12;return `${String(hr).padStart(2,'0')}:${String(m).padStart(2,'0')} ${ap}`}
        return t
      }
      const fmtDate = iso => {
        if(!iso) return ''
        const dt = new Date(iso+'T00:00:00')
        return dt.toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'})
      }
      const MEETING_TYPES = [
        {type:'G', letter:'G', color:'#1a73e8', name:'Google Meet', ph:'https://meet.google.com/...'},
        {type:'Z', letter:'Z', color:'#2d8cff', name:'Zoom',        ph:'https://zoom.us/j/...'},
        {type:'T', letter:'T', color:'#6264a7', name:'Teams',       ph:'https://teams.microsoft.com/...'},
      ]
      const meetingLinks = d.meetingLinks||[]

      const Row = ({label, children, hint}) => (
        <div className="flex items-start justify-between gap-3 py-2.5 border-b border-slate-50 last:border-0">
          <div className="flex-shrink-0 pt-0.5">
            <p className="text-[11px] font-medium text-slate-700">{label}</p>
            {hint && <p className="text-[10px] text-slate-400 mt-0.5">{hint}</p>}
          </div>
          <div className="flex-shrink-0">{children}</div>
        </div>
      )
      return (
        <div>

          {/* Question */}
          <PanelSection title="Question Text">
            <RichField value={d.question||''} onChange={v=>set('question',v)} placeholder="e.g. When would you like to meet?" rows={3}/>
          </PanelSection>

          {/* Calendar Integration — online only */}
          {isOnline && (
            <PanelSection title="Calendar">
              <div className="grid grid-cols-2 gap-2">
                {[
                  {key:'calendarGoogle', name:'Google Calendar', color:'#ea4335', letter:'G'},
                  {key:'calendarOutlook', name:'Outlook Calendar', color:'#0078d4', letter:'O'},
                ].map(cal => {
                  const on = !!d[cal.key]
                  return (
                    <div key={cal.key} className={clsx('flex flex-col gap-2 px-3 py-2.5 rounded-xl border transition-all',
                      on ? 'border-emerald-200 bg-emerald-50/40' : 'border-dashed border-slate-200 bg-slate-50/50')}>
                      <div className="flex items-center gap-2">
                        <div className="w-5 h-5 rounded flex items-center justify-center text-white text-[9px] font-black flex-shrink-0"
                          style={{background:cal.color}}>{cal.letter}</div>
                        <p className="text-[11px] font-semibold text-slate-700 truncate">{cal.name}</p>
                      </div>
                      {on ? (
                        <div className="flex items-center justify-between">
                          <span className="flex items-center gap-1 text-[10px] text-emerald-600 font-semibold"><Check size={9}/>Connected</span>
                          <button onClick={()=>set(cal.key,'')} className="text-[10px] text-slate-400 hover:text-red-500 transition-colors">Remove</button>
                        </div>
                      ) : (
                        <button onClick={()=>set(cal.key,'user@example.com')}
                          className="w-full text-[10px] font-semibold py-1 rounded-lg border border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-white transition-all">
                          Connect
                        </button>
                      )}
                    </div>
                  )
                })}
              </div>
            </PanelSection>
          )}

          {/* Schedule */}
          <PanelSection title="Schedule">

            {/* Available all the time */}
            <div className="flex items-center justify-between px-3 py-2 bg-slate-50 rounded-xl border border-slate-200">
              <div>
                <p className="text-[11px] font-medium text-slate-700">Available all the time</p>
                <p className="text-[10px] text-slate-400">No time restrictions on bookings</p>
              </div>
              <Toggle value={d.allDay||false} onChange={v=>set('allDay',v)} label=""/>
            </div>

            {/* Working days */}
            <div>
              <p className="text-[10px] text-slate-500 font-medium mb-1.5">Working days</p>
              <div className="flex gap-1">
                {DAYS.map(({k,s})=>{
                  const on=(d.weekdays||[]).includes(k)
                  return (
                    <button key={k} onClick={()=>toggleDay(k)}
                      className={clsx('flex-1 py-1.5 rounded text-[10px] font-semibold transition-all',
                        on ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-400 hover:bg-slate-200 hover:text-slate-600')}>
                      {s}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* All 6 controls in one line */}
            <div className="grid grid-cols-6 gap-2">
              <div>
                <p className="text-[10px] text-slate-500 font-medium mb-1.5">Start</p>
                <NativeSelect value={d.slotStart||'09:00'} onChange={e=>set('slotStart',e.target.value)} sm disabled={d.allDay||false}>
                  {timeOpts.map(t=><option key={t} value={t}>{fmt12(t)}</option>)}
                </NativeSelect>
              </div>
              <div>
                <p className="text-[10px] text-slate-500 font-medium mb-1.5">End</p>
                <NativeSelect value={d.slotEnd||'17:00'} onChange={e=>set('slotEnd',e.target.value)} sm disabled={d.allDay||false}>
                  {timeOpts.map(t=><option key={t} value={t}>{fmt12(t)}</option>)}
                </NativeSelect>
              </div>
              <div>
                <p className="text-[10px] text-slate-500 font-medium mb-1.5">Format</p>
                <NativeSelect value={d.format||'12h'} onChange={e=>set('format',e.target.value)} sm>
                  <option value="12h">12h</option>
                  <option value="24h">24h</option>
                </NativeSelect>
              </div>
              <div>
                <p className="text-[10px] text-slate-500 font-medium mb-1.5">Interval</p>
                <div className="relative">
                  <TInput type="number" value={d.slotInterval||30} onChange={v=>set('slotInterval',+v)} placeholder="30" disabled={d.allDay||false}/>
                  <span className="absolute right-1.5 top-1/2 -translate-y-1/2 text-[9px] text-slate-400 pointer-events-none">m</span>
                </div>
              </div>
              <div>
                <p className="text-[10px] text-slate-500 font-medium mb-1.5">Per slot</p>
                <TInput type="number" value={d.meetingsPerSlot||1} onChange={v=>set('meetingsPerSlot',+v)} placeholder="1" disabled={d.allDay||false}/>
              </div>
              <div>
                <p className="text-[10px] text-slate-500 font-medium mb-1.5">Timezone</p>
                <NativeSelect value={d.timezone||'Asia/Kolkata'} onChange={e=>set('timezone',e.target.value)} sm>
                  {TIMEZONES.map(tz=><option key={tz} value={tz}>{tz}</option>)}
                </NativeSelect>
              </div>
            </div>
          </PanelSection>

          {/* Rules */}
          <PanelSection title="Rules">
            <div className="grid grid-cols-3 gap-2">
              <div>
                <p className="text-[10px] text-slate-500 font-medium mb-0.5">Advance booking</p>
                <p className="text-[9px] text-slate-400 mb-1.5">How far ahead</p>
                <div className="flex items-center gap-1">
                  <TInput type="number" value={d.enableFutureDays||7} onChange={v=>set('enableFutureDays',+v)} placeholder="7"/>
                  <span className="text-[10px] text-slate-400 flex-shrink-0">days</span>
                </div>
              </div>
              <div>
                <p className="text-[10px] text-slate-500 font-medium mb-0.5">Buffer days</p>
                <p className="text-[9px] text-slate-400 mb-1.5">Min. before booking</p>
                <div className="flex items-center gap-1">
                  <TInput type="number" value={d.disableNextDays||0} onChange={v=>set('disableNextDays',+v)} placeholder="0"/>
                  <span className="text-[10px] text-slate-400 flex-shrink-0">days</span>
                </div>
              </div>
              <div>
                <p className="text-[10px] text-slate-500 font-medium mb-0.5">End date</p>
                <p className="text-[9px] text-slate-400 mb-1.5">Stop accepting bookings</p>
                <InlineDateField sm value={d.endDate||''} onChange={v=>set('endDate',v)} placeholder="No end date"/>
              </div>
            </div>
            <div className="flex items-center justify-between py-1">
              <div>
                <p className="text-[11px] font-medium text-slate-700">Timezone selection</p>
                <p className="text-[10px] text-slate-400">Let users pick their timezone</p>
              </div>
              <Toggle value={d.timezoneSelection||false} onChange={v=>set('timezoneSelection',v)} label=""/>
            </div>
          </PanelSection>

          {/* Meeting Details */}
          <PanelSection title="Meeting Details">
            <div>
              <p className="text-[10px] text-slate-500 font-medium mb-1.5">Title <span className="text-red-400">*</span></p>
              <TInput value={d.title||''} onChange={v=>set('title',v)} placeholder="e.g. Product Demo Call"/>
            </div>
            <div>
              <p className="text-[10px] text-slate-500 font-medium mb-1.5">Location <span className="text-red-400">*</span></p>
              <TInput value={d.location||''} onChange={v=>set('location',v)} placeholder="Office address or Virtual"/>
            </div>
            <div>
              <p className="text-[10px] text-slate-500 font-medium mb-1.5">Description <span className="text-[9px] text-slate-400 font-normal">(optional)</span></p>
              <TInput value={d.description||''} onChange={v=>set('description',v)} placeholder="Brief description"/>
            </div>
            {isOnline && (
              <div>
                <p className="text-[10px] text-slate-500 font-medium mb-1.5">Meeting links <span className="text-[9px] text-slate-400 font-normal">(max 3)</span></p>
                <div className="space-y-1.5">
                  {meetingLinks.map((link,i)=>{
                    const cfg=MEETING_TYPES.find(t=>t.type===link.type)||MEETING_TYPES[0]
                    return (
                      <div key={i} className="flex items-center gap-2">
                        <span className="w-5 h-5 rounded text-[9px] font-black text-white flex items-center justify-center flex-shrink-0"
                          style={{background:cfg.color}}>{cfg.letter}</span>
                        <input value={link.url||''} onChange={e=>{const ls=[...meetingLinks];ls[i]={...ls[i],url:e.target.value};set('meetingLinks',ls)}}
                          placeholder={cfg.ph} className={inputSmCls}/>
                        <button onClick={()=>set('meetingLinks',meetingLinks.filter((_,j)=>j!==i))}
                          className="text-slate-300 hover:text-red-400 transition-colors flex-shrink-0">
                          <X size={12}/>
                        </button>
                      </div>
                    )
                  })}
                  {meetingLinks.length < 3 && (
                    <div className="flex flex-wrap gap-1.5 pt-0.5">
                      {MEETING_TYPES.filter(t=>!meetingLinks.find(l=>l.type===t.type)).map(t=>(
                        <button key={t.type}
                          onClick={()=>set('meetingLinks',[...meetingLinks,{type:t.type,url:''}])}
                          className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-dashed border-slate-200 text-[10px] text-slate-500 hover:border-slate-300 hover:bg-slate-50 transition-all">
                          <span className="w-3.5 h-3.5 rounded text-[7px] font-black text-white flex items-center justify-center flex-shrink-0" style={{background:t.color}}>{t.letter}</span>
                          {t.name}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </PanelSection>

          {/* Status Messages */}
          <PanelSection title="Status Messages">
            <div>
              <div className="flex items-center gap-1.5 mb-1.5">
                <div className="w-1.5 h-1.5 rounded-full bg-amber-400 flex-shrink-0"/>
                <p className="text-[10px] text-slate-500 font-semibold">Slot already booked</p>
              </div>
              <TInput value={d.bookedMsg||''} onChange={v=>set('bookedMsg',v)} placeholder="This slot is already booked. Please choose another."/>
            </div>
            <div>
              <div className="flex items-center gap-1.5 mb-1.5">
                <div className="w-1.5 h-1.5 rounded-full bg-red-400 flex-shrink-0"/>
                <p className="text-[10px] text-slate-500 font-semibold">No slots available</p>
              </div>
              <TInput value={d.unavailableMsg||''} onChange={v=>set('unavailableMsg',v)} placeholder="No slots are available at the moment."/>
            </div>
          </PanelSection>

        </div>
      )
    }

    default: return (
      <div className="text-xs text-slate-400 text-center py-4">No settings available for this node type.</div>
    )
  }
}

// ─── Node Card on Canvas ───────────────────────────────────────────────────────
function NodeCard({ node, selected, onSelect, onDragStart, onPortMouseDown, isConnectTarget, connecting }) {
  const def = DEFS[node.type] || { label:node.type, icon:Zap, color:'#0066ff', cat:'system' }
  const Icon = def.icon
  const ports = getOutputPorts(node)
  const canReceive = connecting && connecting.fromId !== node.id

  return (
    <g transform={`translate(${node.x},${node.y})`} style={{ cursor:'grab', userSelect:'none' }}
      onMouseDown={e=>{ e.stopPropagation(); if(!connecting) onDragStart(e,node.id) }}
      onClick={e=>{ e.stopPropagation(); if(!connecting) onSelect(node.id) }}>
      {/* Shadow */}
      <rect x={2} y={4} width={NODE_W} height={NODE_H} rx={10} fill="rgba(0,0,0,0.07)"/>
      {/* Card body */}
      <rect x={0} y={0} width={NODE_W} height={NODE_H} rx={10} fill="#fff"
        stroke={isConnectTarget?'#0066ff':selected?'#0066ff':'#e5e7eb'}
        strokeWidth={isConnectTarget?2.5:selected?2:1}/>
      {/* Connect target glow */}
      {isConnectTarget && <rect x={-3} y={-3} width={NODE_W+6} height={NODE_H+6} rx={13} fill="none" stroke="#0066ff" strokeWidth={1.5} opacity={0.25}/>}
      {/* Color accent bar */}
      <rect x={0} y={0} width={5} height={NODE_H} rx={4} fill={def.color}/>
      <rect x={3} y={0} width={2} height={NODE_H} fill={def.color}/>
      {/* Icon bg */}
      <circle cx={30} cy={NODE_H/2} r={16} fill={def.color+'1a'}/>
      <foreignObject x={22} y={NODE_H/2-9} width={18} height={18}>
        <Icon size={16} color={def.color}/>
      </foreignObject>
      {/* Labels */}
      <text x={55} y={NODE_H/2-7} fontSize={12} fontWeight={700} fill="#111827" dominantBaseline="middle">
        {(node.data?.name||def.label).slice(0,20)}
      </text>
      <text x={55} y={NODE_H/2+9} fontSize={10} fill="#9ca3af" dominantBaseline="middle">
        {def.label}
      </text>
      {/* Input port */}
      <circle cx={0} cy={NODE_H/2} r={PORT_R}
        fill={isConnectTarget?'#0066ff':'#fff'}
        stroke={isConnectTarget?'#0066ff':'#d1d5db'}
        strokeWidth={1.5}
        style={{cursor: canReceive ? 'crosshair' : 'default', pointerEvents: canReceive ? 'all' : 'none'}}/>
      <circle cx={0} cy={NODE_H/2} r={3} fill={isConnectTarget?'#fff':'#9ca3af'} style={{pointerEvents:'none'}}/>
      {/* Output ports */}
      {ports.map((p,i)=>{
        const py = ports.length===1 ? NODE_H/2 : (NODE_H/(ports.length+1))*(i+1)
        return (
          <g key={i}>
            {/* Larger invisible hit area for port */}
            <circle cx={NODE_W} cy={py} r={PORT_R+5} fill="transparent"
              style={{cursor:'crosshair'}}
              onMouseDown={e=>{ e.stopPropagation(); onPortMouseDown && onPortMouseDown(e, node.id, i) }}/>
            <circle cx={NODE_W} cy={py} r={PORT_R} fill={def.color} stroke="#fff" strokeWidth={1.5}
              style={{cursor:'crosshair', pointerEvents:'none'}}/>
            <circle cx={NODE_W} cy={py} r={3} fill="#fff" style={{pointerEvents:'none'}}/>
            {ports.length>1 && (
              <text x={NODE_W-10} y={py} fontSize={9} fill="#6b7280" textAnchor="end" dominantBaseline="middle" style={{pointerEvents:'none'}}>
                {p.label.slice(0,14)}
              </text>
            )}
          </g>
        )
      })}
      {selected && <rect x={0} y={0} width={NODE_W} height={NODE_H} rx={10} fill="none" stroke="#0066ff" strokeWidth={2} opacity={0.3} style={{pointerEvents:'none'}}/>}
    </g>
  )
}

// ─── Mini Calendar picker ─────────────────────────────────────────────────────
function MiniCalendar({ value, onChange }) {
  const today = new Date()
  const initDate = value ? new Date(value+'T00:00:00') : today
  const [view, setView] = useState({ month: initDate.getMonth(), year: initDate.getFullYear() })
  const FULL_MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December']
  const firstDay = new Date(view.year, view.month, 1).getDay()
  const daysInMonth = new Date(view.year, view.month+1, 0).getDate()
  const todayStr = today.toISOString().slice(0,10)
  const prev = () => setView(v => v.month===0?{month:11,year:v.year-1}:{month:v.month-1,year:v.year})
  const next = () => setView(v => v.month===11?{month:0,year:v.year+1}:{month:v.month+1,year:v.year})
  return (
    <div className="w-full select-none">
      <div className="flex items-center justify-between mb-2 px-1">
        <button onClick={prev} className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-700 transition-colors">
          <ChevronLeft size={13}/>
        </button>
        <span className="text-[12px] font-bold text-slate-700">{FULL_MONTHS[view.month]} {view.year}</span>
        <button onClick={next} className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-700 transition-colors">
          <ChevronRight size={13}/>
        </button>
      </div>
      <div className="grid grid-cols-7 mb-1">
        {['Su','Mo','Tu','We','Th','Fr','Sa'].map(d=>(
          <div key={d} className="text-center text-[9px] font-bold text-slate-400 py-1 uppercase tracking-wide">{d}</div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-0.5">
        {Array(firstDay).fill(null).map((_,i)=><div key={'e'+i}/>)}
        {Array(daysInMonth).fill(null).map((_,i)=>{
          const day = i+1
          const dateStr = `${view.year}-${String(view.month+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`
          const isSel = value===dateStr
          const isToday = dateStr===todayStr
          return (
            <button key={day} onClick={()=>onChange(dateStr)}
              className={clsx('h-6 w-full rounded text-[10px] transition-all font-medium',
                isSel ? 'bg-slate-900 text-white font-bold shadow-sm'
                : isToday ? 'text-primary font-bold bg-primary/10 ring-1 ring-inset ring-primary/25'
                : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900')}>
              {day}
            </button>
          )
        })}
      </div>
    </div>
  )
}

// ─── Inline date field with calendar popup ────────────────────────────────────
function InlineDateField({ value, onChange, placeholder='Pick a date', sm=false }) {
  const [open, setOpen] = useState(false)
  const fmtDate = iso => iso ? new Date(iso+'T00:00:00').toLocaleDateString('en-US',{weekday:'short',month:'long',day:'numeric',year:'numeric'}) : null
  return (
    <div className="relative">
      <button type="button" onClick={()=>setOpen(o=>!o)}
        className={clsx('w-full flex items-center gap-2 border border-slate-200 bg-white hover:border-slate-300 transition-all text-left',
          sm ? 'rounded-lg px-2.5 py-1.5' : 'rounded-xl px-3.5 py-2.5')}>
        <Calendar size={sm?11:14} className="text-slate-400 flex-shrink-0"/>
        <span className={clsx('flex-1 font-medium truncate', sm?'text-[11px]':'text-[12px]', value ? 'text-slate-800' : 'text-slate-300')}>
          {fmtDate(value) || placeholder}
        </span>
        {value && (
          <button type="button" onClick={e=>{e.stopPropagation();onChange('');setOpen(false)}}
            className="text-slate-300 hover:text-red-400 transition-colors flex-shrink-0">
            <X size={sm?10:12}/>
          </button>
        )}
        <ChevronDown size={sm?11:13} className={clsx('text-slate-400 flex-shrink-0 transition-transform', open&&'rotate-180')}/>
      </button>
      {open && (
        <div className="absolute z-30 top-full mt-1.5 left-0 right-0 bg-white rounded-2xl border border-slate-200 shadow-xl p-4">
          <MiniCalendar value={value} onChange={v=>{onChange(v);setOpen(false)}}/>
        </div>
      )}
    </div>
  )
}

// ─── Blocked Dates Panel (appointment tab) ────────────────────────────────────
function BlockedDatesPanel({ node, onChange }) {
  const d = node.data || {}
  const set = (k,v) => onChange({...node, data:{...d,[k]:v}})
  const blocked = d.blockedDates || []
  const [openId, setOpenId] = useState(null)

  const addBlock = () => {
    const today = new Date().toISOString().slice(0,10)
    const nb = {id:Date.now(), date:today, recurring:false}
    set('blockedDates',[...blocked, nb])
    setOpenId(nb.id)
  }
  const upd = (id,key,val) => set('blockedDates', blocked.map(b=>b.id===id?{...b,[key]:val}:b))
  const del = id => { set('blockedDates', blocked.filter(b=>b.id!==id)); if(openId===id) setOpenId(null) }
  const fmtDate = iso => {
    if(!iso) return 'Pick a date'
    return new Date(iso+'T00:00:00').toLocaleDateString('en-US',{weekday:'short',month:'long',day:'numeric',year:'numeric'})
  }

  return (
    <div className="p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-[13px] font-bold text-slate-800">Blocked Dates</h3>
          <p className="text-[11px] text-slate-400 mt-0.5">Users cannot book appointments on these dates</p>
        </div>
        <button onClick={addBlock}
          className="flex items-center gap-1.5 text-[11px] font-semibold text-white bg-primary px-3 py-1.5 rounded-lg hover:bg-primary/90 active:scale-[.97] transition-all shadow-sm">
          <Plus size={12}/> Add date
        </button>
      </div>

      {/* Disable same day booking */}
      <div className="flex items-center justify-between px-3 py-2.5 bg-slate-50 rounded-xl border border-slate-200">
        <div>
          <p className="text-[11px] font-medium text-slate-700">Disable same day booking</p>
          <p className="text-[10px] text-slate-400">Users cannot book appointments for today</p>
        </div>
        <Toggle value={d.disableSameDay||false} onChange={v=>set('disableSameDay',v)} label=""/>
      </div>

      {/* Empty state */}
      {blocked.length === 0 && (
        <div className="flex flex-col items-center justify-center py-12 border-2 border-dashed border-slate-200 rounded-2xl bg-slate-50/50">
          <div className="w-12 h-12 rounded-2xl bg-white border border-slate-200 shadow-sm flex items-center justify-center mb-3">
            <CalendarX2 size={20} className="text-slate-400"/>
          </div>
          <p className="text-[12px] font-semibold text-slate-600">No blocked dates yet</p>
          <p className="text-[11px] text-slate-400 mt-1">Click "Add date" to block specific days</p>
        </div>
      )}

      {/* Blocked date cards */}
      <div className="space-y-2.5">
        {blocked.map(b => {
          const isOpen = openId===b.id
          const dt = b.date ? new Date(b.date+'T00:00:00') : null
          return (
            <div key={b.id} className={clsx('rounded-2xl border overflow-hidden transition-all',
              isOpen ? 'border-slate-300 shadow-md' : 'border-slate-200 shadow-sm bg-white')}>
              {/* Card header row */}
              <div className="flex items-center gap-3 px-4 py-3">
                {/* Date badge */}
                <div className="w-10 h-10 rounded-xl bg-slate-900 flex flex-col items-center justify-center flex-shrink-0">
                  <span className="text-white text-[8px] font-extrabold leading-none uppercase tracking-wider">
                    {dt ? dt.toLocaleDateString('en-US',{month:'short'}) : '—'}
                  </span>
                  <span className="text-white text-[16px] font-black leading-tight">
                    {dt ? dt.getDate() : '?'}
                  </span>
                </div>
                {/* Date info */}
                <button onClick={()=>setOpenId(isOpen?null:b.id)} className="flex-1 text-left min-w-0">
                  <p className="text-[12px] font-semibold text-slate-800 truncate">{fmtDate(b.date)}</p>
                  <p className="text-[10px] text-slate-400 mt-0.5">{isOpen ? 'Click to collapse' : 'Click to change date'}</p>
                </button>
                {/* Recurring toggle */}
                <button onClick={()=>upd(b.id,'recurring',!b.recurring)}
                  className={clsx('flex items-center gap-1.5 text-[10px] font-bold px-2.5 py-1.5 rounded-lg transition-all flex-shrink-0',
                    b.recurring ? 'bg-violet-100 text-violet-700 ring-1 ring-violet-200' : 'bg-slate-100 text-slate-500 hover:bg-slate-200')}>
                  <Repeat size={10}/>
                  {b.recurring ? 'Yearly' : 'Once'}
                </button>
                {/* Delete */}
                <button onClick={()=>del(b.id)}
                  className="w-7 h-7 flex items-center justify-center rounded-lg text-slate-300 hover:text-red-400 hover:bg-red-50 transition-all flex-shrink-0">
                  <X size={13}/>
                </button>
              </div>
              {/* Calendar picker */}
              {isOpen && (
                <div className="border-t border-slate-100 px-4 py-3 bg-slate-50/60">
                  <MiniCalendar value={b.date} onChange={v=>{ upd(b.id,'date',v); setOpenId(null) }}/>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─── GIF Picker (Giphy) ────────────────────────────────────────────────────────
const GIPHY_KEY = 'gGHlNJyaKHEs2KymOjkMODrqaHg0SQFy'
function GifPicker({ onSelect }) {
  const [query, setQuery] = useState('')
  const [gifs, setGifs] = useState([])
  const [loading, setLoading] = useState(false)
  const [keyErr, setKeyErr] = useState(false)

  const fetchGifs = async (q) => {
    if (!GIPHY_KEY) { setKeyErr(true); return }
    setLoading(true); setKeyErr(false)
    try {
      const ep = q.trim()
        ? `https://api.giphy.com/v1/gifs/search?api_key=${GIPHY_KEY}&q=${encodeURIComponent(q)}&limit=12&rating=g`
        : `https://api.giphy.com/v1/gifs/trending?api_key=${GIPHY_KEY}&limit=12&rating=g`
      const json = await (await fetch(ep)).json()
      if (json.meta?.status === 403 || json.meta?.status === 401 || json.meta?.msg === 'BANNED') {
        setKeyErr(true); setGifs([])
      } else {
        setGifs(json.data || [])
      }
    } catch { setGifs([]) } finally { setLoading(false) }
  }

  useEffect(() => { fetchGifs('') }, [])

  return (
    <div className="space-y-3">
      <form onSubmit={e=>{e.preventDefault();fetchGifs(query)}} className="flex gap-2">
        <input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search GIFs…"
          className={inputSmCls} disabled={keyErr}/>
        <button type="submit" disabled={keyErr}
          className="px-3 py-1.5 bg-slate-900 text-white rounded-lg text-[11px] font-semibold hover:bg-slate-700 disabled:opacity-40 transition-colors flex-shrink-0 flex items-center">
          <Search size={12}/>
        </button>
      </form>

      {keyErr ? (
        <div className="flex flex-col items-center gap-3 py-8 px-4 text-center bg-amber-50 rounded-2xl border border-amber-100">
          <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center">
            <AlertCircle size={18} className="text-amber-500"/>
          </div>
          <div>
            <p className="text-[12px] font-semibold text-slate-700">Giphy API key not configured</p>
            <p className="text-[11px] text-slate-400 mt-0.5">Get a free key at developers.giphy.com and add it to <code className="bg-slate-100 px-1 rounded text-[10px]">GIPHY_KEY</code> in FlowSetup.jsx</p>
          </div>
        </div>
      ) : loading ? (
        <div className="grid grid-cols-3 gap-2">
          {Array.from({length:9}).map((_,i)=>(
            <div key={i} className="aspect-square bg-slate-100 rounded-xl animate-pulse"/>
          ))}
        </div>
      ) : gifs.length===0 ? (
        <p className="text-center text-[11px] text-slate-400 py-6">No GIFs found.</p>
      ) : (
        <div className="grid grid-cols-3 gap-2">
          {gifs.map(gif=>(
            <button key={gif.id} onClick={()=>onSelect(gif.images.downsized?.url || gif.images.original.url)}
              className="aspect-square rounded-xl overflow-hidden hover:ring-2 hover:ring-blue-400 transition-all bg-slate-100">
              <img src={gif.images.fixed_height_small?.url} alt={gif.title} className="w-full h-full object-cover"/>
            </button>
          ))}
        </div>
      )}
      {!keyErr && <p className="text-right text-[9px] text-slate-300 font-medium tracking-wide">Powered by GIPHY</p>}
    </div>
  )
}

// ─── Node Edit Modal ───────────────────────────────────────────────────────────
const MODAL_TABS = [
  { id:'basic',    label:'Basic',      icon:FileText   },
  { id:'media',    label:'Media',      icon:Image      },
  { id:'advanced', label:'Advanced',   icon:SlidersHorizontal },
  { id:'preview',  label:'Preview',    icon:Activity   },
  { id:'guide',    label:'Help guide', icon:HelpCircle },
]

// WhatsApp-style text renderer for preview
function renderWAText(txt='') {
  return txt
    .replace(/\*(.*?)\*/g, '<strong>$1</strong>')
    .replace(/_(.*?)_/g, '<em>$1</em>')
    .replace(/~(.*?)~/g, '<s>$1</s>')
}

function NodeEditModal({ node, nodes, edges, onChange, onDelete, onDuplicate, onClose, allFlows=[], currentFlowId=null }) {
  const def = DEFS[node.type] || { label:node.type, icon:Zap, color:'#0066ff', cat:'system' }
  const Icon = def.icon
  const catColor = CAT_COLOR[def.cat] || '#0066ff'
  const NAME_MAX = 32
  const nameLen = (node.data?.name||'').length
  const incoming = edges.filter(e=>e.toId===node.id)
  const outgoing = edges.filter(e=>e.fromId===node.id)

  const [tab, setTab] = useState('basic')
  const [localNode, setLocalNode] = useState(node)
  const [mediaPreview, setMediaPreview] = useState(null)
  const [mediaSubTab, setMediaSubTab] = useState('attachment')
  const [showCloneMenu, setShowCloneMenu] = useState(false)
  const [cloneTarget, setCloneTarget] = useState(currentFlowId)
  const cloneMenuRef = useRef(null)

  // keep localNode in sync if parent node changes identity
  useEffect(() => { setLocalNode(node) }, [node.id])

  const handleSave = () => { onChange(localNode); onClose() }
  const handleChange = (n) => setLocalNode(n)

  const d = localNode.data || {}
  const questionText = d.message || d.question || d.bodyText || d.hintText || d.noteText || d.endMessage || ''
  const charCount = questionText.length

  const handleMediaFile = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => setMediaPreview(ev.target.result)
    reader.readAsDataURL(file)
  }

  const handleDrop = (e) => {
    e.preventDefault()
    const file = e.dataTransfer.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => setMediaPreview(ev.target.result)
    reader.readAsDataURL(file)
  }

  useEffect(() => {
    if (!showCloneMenu) return
    const handle = (e) => { if (!cloneMenuRef.current?.contains(e.target)) setShowCloneMenu(false) }
    document.addEventListener('mousedown', handle)
    return () => document.removeEventListener('mousedown', handle)
  }, [showCloneMenu])

  const [advOpen, setAdvOpen] = useState({})
  const toggleAdv = k => setAdvOpen(s => ({...s, [k]: !s[k]}))
  const [regexTest, setRegexTest] = useState('')
  const testRegex = (pattern, input) => { if (!pattern || !input) return null; try { return new RegExp(pattern).test(input) } catch { return null } }

  const [copiedVar, setCopiedVar] = useState(null)
  const copyVar = v => { navigator.clipboard.writeText(v).catch(()=>{}); setCopiedVar(v); setTimeout(()=>setCopiedVar(null), 1500) }

  const WA_FIELDS = [
    { value:'full',    label:'WhatsApp User Full', variable:'{{whatsapp_full_name}}' },
    { value:'first',   label:'First Name',         variable:'{{first_name}}' },
    { value:'last',    label:'Last Name',           variable:'{{last_name}}' },
    { value:'phone',   label:'Phone Number',        variable:'{{phone}}' },
    { value:'country', label:'Country Code',        variable:'{{country_code}}' },
  ]
  const [waField, setWaField] = useState('full')
  const [qRefNodeId, setQRefNodeId] = useState('')
  const waVar = WA_FIELDS.find(f=>f.value===waField)?.variable || '{{whatsapp_full_name}}'
  const qRefNode = nodes.find(n=>n.id===qRefNodeId)
  const qRefVar = qRefNode ? (qRefNode.data?.saveAs ? `{{${qRefNode.data.saveAs}}}` : `{{question_${qRefNodeId}}}`) : ''

  const [idCopied, setIdCopied] = useState(false)
  const copyId = () => {
    navigator.clipboard.writeText(node.id).then(() => {
      setIdCopied(true)
      setTimeout(() => setIdCopied(false), 1500)
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4"
      style={{background:'rgba(15,23,42,0.45)', backdropFilter:'blur(4px)'}}
      onMouseDown={e=>{ if(e.target===e.currentTarget) onClose() }}>

      <div className="bg-white rounded-xl shadow-2xl flex flex-col overflow-hidden"
        style={{width:'min(780px, calc(100vw - 24px))', height:'min(92vh, 820px)', animation:'modalPop .22s cubic-bezier(.22,1,.36,1)'}}>

        <style>{`@keyframes modalPop{from{opacity:0;transform:scale(.94) translateY(12px)}to{opacity:1;transform:scale(1) translateY(0)}}`}</style>

        {/* Header */}
        <div className="px-4 py-2.5 border-b border-slate-100 flex-shrink-0">
          <div className="flex items-center justify-between gap-2">
            {/* Left: icon + title */}
            <div className="flex items-center gap-2 min-w-0">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                style={{background:catColor+'15', border:`1.5px solid ${catColor}25`}}>
                <Icon size={14} style={{color:catColor}}/>
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <p className="text-xs font-bold text-slate-900 leading-tight">{def.label}</p>
                  <span className="text-[9px] font-semibold rounded-full px-1.5 py-0.5 leading-none flex-shrink-0"
                    style={{color:catColor, background:catColor+'15'}}>
                    {CAT_LABELS[def.cat]}
                  </span>
                </div>
                <div className="flex items-center gap-2 mt-0.5">
                  {incoming.length>0 && <span className="flex items-center gap-0.5 text-[9px] text-slate-400"><ArrowLeft size={7}/>{incoming.length} in</span>}
                  {outgoing.length>0 && <span className="flex items-center gap-0.5 text-[9px] text-slate-400"><ArrowRight size={7}/>{outgoing.length} out</span>}
                  {/* Question ID */}
                  <span className="flex items-center gap-1 text-[9px] text-slate-400">
                    <span className="hidden xs:inline text-[9px] text-slate-300">·</span>
                    <span className="font-mono text-[9px] text-slate-400 truncate max-w-[80px] sm:max-w-[120px]" title={node.id}>{node.id}</span>
                    <button onClick={copyId} title="Copy node ID"
                      className={clsx('flex items-center gap-0.5 px-1 py-0.5 rounded text-[9px] font-medium transition-all',
                        idCopied ? 'text-emerald-600 bg-emerald-50' : 'text-slate-400 hover:text-primary hover:bg-slate-100')}>
                      {idCopied ? <><Check size={9}/> Copied</> : <><Copy size={9}/> Copy ID</>}
                    </button>
                  </span>
                </div>
              </div>
            </div>

            {/* Right: actions */}
            <div className="flex items-center gap-1 flex-shrink-0">
              {/* Clone with flow selector */}
              <div className="relative" ref={cloneMenuRef}>
                <button onClick={()=>setShowCloneMenu(s=>!s)} title="Clone node"
                  className={clsx('flex items-center gap-0.5 px-2 py-1.5 rounded-lg text-[11px] font-medium text-slate-600 border transition-colors',
                    showCloneMenu ? 'bg-slate-100 border-slate-300' : 'bg-slate-50 border-slate-200 hover:bg-slate-100')}>
                  <Copy size={11}/> <span className="hidden sm:inline">Clone</span>
                </button>
                {showCloneMenu && (
                  <div className="absolute right-0 top-full mt-1 z-50 bg-white rounded-xl border border-slate-200 shadow-lg p-3 min-w-[210px]">
                    <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-2">Clone to flow</p>
                    <NativeSelect
                      value={cloneTarget || ''}
                      onChange={e=>setCloneTarget(e.target.value)}
                      className="w-full mb-2.5">
                      {allFlows.map(f=>(
                        <option key={f.id} value={f.id}>
                          {f.name}{f.id===currentFlowId ? ' (current)' : ''}
                        </option>
                      ))}
                    </NativeSelect>
                    <button
                      onClick={()=>{ onDuplicate(cloneTarget); setShowCloneMenu(false) }}
                      className="w-full flex items-center justify-center gap-1.5 px-3 py-1.5 bg-slate-900 text-white rounded-lg text-[11px] font-semibold hover:bg-slate-700 transition-colors">
                      <Copy size={11}/> Clone node
                    </button>
                  </div>
                )}
              </div>
              <button onClick={onClose}
                className="w-7 h-7 flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors">
                <X size={14}/>
              </button>
            </div>
          </div>
        </div>

        {/* Tab bar */}
        {(() => {
          const isAppt = ['ask_appointment','ask_appointment_off'].includes(localNode.type)
          const visibleTabs = isAppt
            ? [...MODAL_TABS.slice(0,1), {id:'blocked', label:'Blocked Dates', icon:CalendarX2}, ...MODAL_TABS.slice(1)]
            : MODAL_TABS
          return (
            <div className="flex border-b border-slate-100 bg-white px-3 flex-shrink-0 gap-0.5 overflow-x-auto scrollbar-none">
              {visibleTabs.map(t => {
                const TIcon = t.icon
                const active = tab===t.id
                return (
                  <button key={t.id} onClick={()=>setTab(t.id)}
                    className={clsx('flex items-center gap-1 px-2.5 py-2 text-[11px] font-semibold transition-all border-b-2 -mb-px whitespace-nowrap flex-shrink-0',
                      active
                        ? 'border-blue-500 text-blue-600'
                        : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-200')}>
                    <TIcon size={11}/>
                    <span className="hidden xs:inline sm:inline">{t.label}</span>
                  </button>
                )
              })}
            </div>
          )
        })()}

        {/* Tab content */}
        <div className="flex-1 overflow-y-auto">

          {/* ── Basic ── */}
          {tab==='basic' && (
            <div className="p-5 space-y-4">
              <EditForm node={localNode} onChange={handleChange} nodes={nodes}/>
              {DEFS[localNode.type]?.cat === 'ask' && (
                <>
                  <PanelSection title="Insert Variable">
                    <VarPicker onChange={v=>setLocalNode(n=>({...n,data:{...n.data,question:(n.data?.question||'')+v}}))}/>
                  </PanelSection>
                  <div className="px-1">
                    <Toggle
                      value={d.doNotRemoveMenu||false}
                      onChange={v=>setLocalNode(n=>({...n,data:{...n.data,doNotRemoveMenu:v}}))}
                      label="Do Not Remove Menu Message (For WhatsApp)"
                    />
                  </div>
                </>
              )}
            </div>
          )}

          {/* ── Blocked Dates (appointment nodes only) ── */}
          {tab==='blocked' && (
            <BlockedDatesPanel node={localNode} onChange={handleChange}/>
          )}

          {/* ── Media ── */}
          {tab==='media' && (
            <div className="p-5 space-y-4">
              {/* Sub-tab toggle */}
              <div className="flex gap-1 bg-slate-100 rounded-xl p-1">
                {[{id:'attachment',label:'Attachment'},{id:'gif',label:'GIF'}].map(st=>(
                  <button key={st.id} onClick={()=>setMediaSubTab(st.id)}
                    className={clsx('flex-1 text-[11px] font-semibold py-1.5 rounded-lg transition-all',
                      mediaSubTab===st.id ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700')}>
                    {st.label}
                  </button>
                ))}
              </div>

              {mediaSubTab==='attachment' && (
                <>
                  <p className="text-xs text-slate-500">
                    Attach an image, video, or document to send with this message. Max 16 MB.
                  </p>
                  <label
                    onDrop={handleDrop}
                    onDragOver={e=>e.preventDefault()}
                    className="flex flex-col items-center justify-center gap-3 border-2 border-dashed border-slate-200 rounded-2xl cursor-pointer hover:border-blue-300 hover:bg-blue-50/30 transition-all min-h-[180px] relative overflow-hidden">
                    {mediaPreview ? (
                      <>
                        <img src={mediaPreview} alt="preview" className="max-h-44 max-w-full rounded-xl object-contain"/>
                        <span className="text-[11px] text-slate-400">Click to replace</span>
                      </>
                    ) : (
                      <>
                        <div className="w-14 h-14 rounded-2xl bg-slate-100 flex items-center justify-center">
                          <Image size={24} className="text-slate-400"/>
                        </div>
                        <div className="text-center">
                          <p className="text-sm font-semibold text-slate-700">Drop a file here</p>
                          <p className="text-xs text-slate-400 mt-0.5">or click to browse files</p>
                        </div>
                        <span className="text-[11px] text-slate-300 font-medium uppercase tracking-wider">Image · Video · PDF · Doc · max 16 MB</span>
                      </>
                    )}
                    <input type="file" accept="image/*,video/*,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document" className="absolute inset-0 opacity-0 cursor-pointer" onChange={handleMediaFile}/>
                  </label>
                  {mediaPreview && (
                    <button onClick={()=>setMediaPreview(null)}
                      className="flex items-center gap-1.5 text-xs text-red-500 hover:text-red-600 font-medium">
                      <X size={12}/> Remove attachment
                    </button>
                  )}
                </>
              )}

              {mediaSubTab==='gif' && (
                <>
                  {mediaPreview && (
                    <div className="flex items-center justify-between bg-slate-50 border border-slate-200 rounded-xl px-3 py-2">
                      <div className="flex items-center gap-2">
                        <img src={mediaPreview} alt="selected gif" className="w-10 h-10 rounded-lg object-cover"/>
                        <span className="text-[11px] text-slate-600 font-medium">GIF selected</span>
                      </div>
                      <button onClick={()=>setMediaPreview(null)}
                        className="text-[11px] text-red-400 hover:text-red-600 font-medium flex items-center gap-1">
                        <X size={11}/> Remove
                      </button>
                    </div>
                  )}
                  <GifPicker onSelect={url=>setMediaPreview(url)}/>
                </>
              )}
            </div>
          )}

          {/* ── Advanced ── */}
          {tab==='advanced' && (
            <div className="p-5 space-y-4">

              {/* ── Validation (ask types only) ── */}
              {DEFS[localNode.type]?.cat === 'ask' && (() => {
                const ad = localNode.data || {}
                const setAd = (k, v) => setLocalNode(n => ({...n, data: {...n.data, [k]: v}}))
                return (
                  <div className="rounded-xl border border-slate-200 overflow-hidden">
                    <button type="button" onClick={()=>toggleAdv('validation')}
                      className="w-full flex items-center gap-2 px-4 py-3 bg-slate-50 hover:bg-slate-100 transition-colors text-left">
                      <AlertCircle size={13} className="text-slate-500 flex-shrink-0"/>
                      <span className="text-xs font-semibold text-slate-700 flex-1">Validation</span>
                      <ChevronDown size={13} className={clsx('text-slate-400 transition-transform flex-shrink-0', advOpen.validation && 'rotate-180')}/>
                    </button>
                    {advOpen.validation && (
                      <div className="p-4 space-y-3 border-t border-slate-100">
                        {localNode.type === 'ask_text' && (
                          <Field label="Regex Validation (optional)" hint="Leave empty to skip">
                            <TInput value={ad.regex||''} onChange={v=>setAd('regex',v)} placeholder="^[a-zA-Z ]+$"/>
                          </Field>
                        )}
                        {localNode.type === 'ask_number' && (
                          <Field label="Regex (optional)">
                            <TInput value={ad.regex||''} onChange={v=>setAd('regex',v)} placeholder="^\d+$"/>
                          </Field>
                        )}
                        {(localNode.type === 'ask_text' || localNode.type === 'ask_number') && ad.regex && (
                          <div>
                            <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Test Your Regex</p>
                            <div className="relative">
                              <input
                                value={regexTest}
                                onChange={e=>setRegexTest(e.target.value)}
                                placeholder="Type something to test..."
                                className={clsx(inputSmCls, 'pr-8 transition-all',
                                  regexTest && testRegex(ad.regex, regexTest) === true  && 'border-emerald-400 bg-emerald-50/40 focus:ring-emerald-500/10',
                                  regexTest && testRegex(ad.regex, regexTest) === false && 'border-red-300 bg-red-50/40 focus:ring-red-500/10'
                                )}
                              />
                              {regexTest && (
                                <span className={clsx('absolute right-2.5 top-1/2 -translate-y-1/2 text-[13px] font-bold',
                                  testRegex(ad.regex, regexTest) === true ? 'text-emerald-500' : testRegex(ad.regex, regexTest) === false ? 'text-red-400' : 'text-slate-400')}>
                                  {testRegex(ad.regex, regexTest) === true ? '✓' : testRegex(ad.regex, regexTest) === false ? '✗' : '?'}
                                </span>
                              )}
                            </div>
                          </div>
                        )}
                        {(localNode.type === 'ask_text' || localNode.type === 'ask_number') && (
                          <div>
                            <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-2">Regex Examples</p>
                            <div className="space-y-1.5">
                              {[
                                {label:'Name (3–20 letters)',         pattern:'^([a-zA-Z ]){3,20}$'},
                                {label:'5-digit number',              pattern:'^[0-9]{5}$'},
                                {label:'Credit card number',          pattern:'^[0-9]{4} [0-9]{4} [0-9]{4} [0-9]{4}$'},
                                {label:'Max 10 chars (alphanum)',      pattern:'^[a-zA-Z0-9_ ]{1,10}$'},
                                {label:'Email address',               pattern:'^[a-zA-Z0-9._%+\\-]+@[a-zA-Z0-9.\\-]+\\.[a-zA-Z]{2,}$'},
                                {label:'10-digit phone',              pattern:'^[0-9]{10}$'},
                                {label:'Indian mobile (6–9 start)',    pattern:'^[6-9][0-9]{9}$'},
                                {label:'6-digit PIN code',            pattern:'^[0-9]{6}$'},
                                {label:'Date (DD/MM/YYYY)',           pattern:'^(0[1-9]|[12][0-9]|3[01])\\/(0[1-9]|1[012])\\/[0-9]{4}$'},
                                {label:'Alphanumeric only',           pattern:'^[a-zA-Z0-9]+$'},
                                {label:'Min 5 characters',            pattern:'^.{5,}$'},
                                {label:'URL (http/https)',            pattern:'^https?:\\/\\/[\\w\\-]+(\\.[\\w\\-]+)+.*$'},
                              ].map(({label,pattern})=>(
                                <div key={label} className="flex items-center justify-between gap-2 px-3 py-2 bg-slate-50 rounded-lg border border-slate-100">
                                  <div className="min-w-0">
                                    <p className="text-[10px] font-semibold text-slate-500">{label}</p>
                                    <p className="text-[11px] font-mono text-slate-600 mt-0.5 truncate">{pattern}</p>
                                  </div>
                                  <button
                                    onClick={()=>{ setAd('regex',pattern); navigator.clipboard.writeText(pattern).catch(()=>{}) }}
                                    className="flex-shrink-0 text-[10px] font-semibold text-white bg-blue-500 hover:bg-blue-600 rounded-md px-2 py-0.5 transition-colors">
                                    Use
                                  </button>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                        <InvalidSection
                          data={ad}
                          onChange={inv=>setLocalNode(n=>({...n,data:{...n.data,...inv}}))}
                        />
                      </div>
                    )}
                  </div>
                )
              })()}

              {/* ── Save Variable ── */}
              <div className="rounded-xl border border-slate-200 overflow-hidden">
                <button type="button" onClick={()=>toggleAdv('save')}
                  className="w-full flex items-center gap-2 px-4 py-3 bg-slate-50 hover:bg-slate-100 transition-colors text-left">
                  <Variable size={13} className="text-slate-500 flex-shrink-0"/>
                  <span className="text-xs font-semibold text-slate-700 flex-1">Save Variable</span>
                  <ChevronDown size={13} className={clsx('text-slate-400 transition-transform flex-shrink-0', advOpen.save && 'rotate-180')}/>
                </button>
                {advOpen.save && <div className="p-4 space-y-4 border-t border-slate-100">

                  {/* saveAs — shown for nodes that capture a user reply */}
                  {'saveAs' in d && (
                    <div>
                      <p className="text-[11px] font-semibold text-slate-500 mb-1.5 uppercase tracking-wider">Save Response As</p>
                      <VarPicker
                        value={d.saveAs||''}
                        onChange={v=>setLocalNode(n=>({...n,data:{...n.data,saveAs:v}}))}
                        label="variable"
                      />
                      {d.saveAs && (
                        <div className="flex items-center gap-2 mt-2">
                          <p className="text-[11px] text-slate-400 font-mono flex-1">→ saves as <span className="text-emerald-600 font-semibold">{d.saveAs}</span></p>
                          <button
                            onClick={()=>navigator.clipboard.writeText(d.saveAs).catch(()=>{})}
                            className="flex-shrink-0 px-2 py-0.5 rounded-md text-[10px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 hover:bg-emerald-100 transition-colors flex items-center gap-1">
                            <Copy size={10}/> Copy
                          </button>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Custom Variables — available for all node types */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Custom Variables</p>
                      <span className="text-[10px] text-slate-400">Set any variable to a static or dynamic value</span>
                    </div>
                    <div className="space-y-2">
                      {(d.customVars||[]).map((cv, i) => (
                        <div key={cv.id} className="flex gap-2 items-center group">
                          <div className="relative flex-1">
                            <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[11px] text-slate-400 pointer-events-none font-mono">{'{{' }</span>
                            <input
                              value={cv.name}
                              onChange={e=>{
                                const vars=[...(d.customVars||[])]; vars[i]={...vars[i],name:e.target.value}
                                setLocalNode(n=>({...n,data:{...n.data,customVars:vars}}))
                              }}
                              placeholder="var_name"
                              className="w-full border border-slate-200 rounded-lg pl-7 pr-6 py-1.5 text-[11px] font-mono text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-400 transition-all"
                            />
                            <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[11px] text-slate-400 pointer-events-none font-mono">{'}}'}</span>
                          </div>
                          <span className="text-slate-300 text-xs font-bold flex-shrink-0">=</span>
                          <input
                            value={cv.value}
                            onChange={e=>{
                              const vars=[...(d.customVars||[])]; vars[i]={...vars[i],value:e.target.value}
                              setLocalNode(n=>({...n,data:{...n.data,customVars:vars}}))
                            }}
                            placeholder="value or {{variable}}"
                            className="flex-1 border border-slate-200 rounded-lg px-2.5 py-1.5 text-[11px] text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-400 transition-all"
                          />
                          <button
                            onClick={()=>setLocalNode(n=>({...n,data:{...n.data,customVars:(d.customVars||[]).filter((_,j)=>j!==i)}}))}
                            className="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-red-500 transition-all flex-shrink-0 p-1">
                            <X size={13}/>
                          </button>
                        </div>
                      ))}
                      <button
                        onClick={()=>setLocalNode(n=>({...n,data:{...n.data,customVars:[...(d.customVars||[]),{id:String(Date.now()),name:'',value:''}]}}))}
                        className="w-full flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-semibold text-emerald-700 bg-emerald-50 border border-dashed border-emerald-200 hover:bg-emerald-100 hover:border-emerald-300 transition-all">
                        <Plus size={12}/> Add Variable
                      </button>
                    </div>
                  </div>

                </div>}
              </div>

              {/* Data Referencing */}
              <div className="rounded-xl border border-slate-200 overflow-hidden">
                <button type="button" onClick={()=>toggleAdv('data')}
                  className="w-full flex items-center gap-2 px-4 py-3 bg-slate-50 hover:bg-slate-100 transition-colors text-left">
                  <Database size={13} className="text-slate-500"/>
                  <span className="text-xs font-semibold text-slate-700 flex-1">Data Referencing</span>
                  <ChevronDown size={13} className={clsx('text-slate-400 transition-transform flex-shrink-0', advOpen.data && 'rotate-180')}/>
                </button>
                {advOpen.data && <div className="p-4 space-y-4 border-t border-slate-100">
                  <div>
                    <p className="text-[11px] font-semibold text-slate-500 mb-2 uppercase tracking-wider">WhatsApp User Info</p>
                    <div className="flex gap-2 items-center">
                      <NativeSelect sm className="flex-1" value={waField} onChange={e=>setWaField(e.target.value)}>
                        {WA_FIELDS.map(f=><option key={f.value} value={f.value}>{f.label}</option>)}
                      </NativeSelect>
                      <div className="flex-1 flex gap-1.5 items-center border border-slate-200 rounded-lg px-3 py-1.5 bg-slate-50">
                        <code className="text-[11px] text-blue-600 flex-1 font-mono truncate">{waVar}</code>
                        <button className="text-[10px] font-semibold text-white bg-blue-500 hover:bg-blue-600 rounded-md px-2 py-0.5 transition-colors flex-shrink-0"
                          onClick={()=>copyVar(waVar)}>
                          {copiedVar===waVar ? '✓' : 'Copy'}
                        </button>
                      </div>
                    </div>
                  </div>
                  <div>
                    <p className="text-[11px] font-semibold text-slate-500 mb-2 uppercase tracking-wider">Question Data Referencing</p>
                    <div className="flex gap-2">
                      <NativeSelect sm className="flex-1" value="main" onChange={()=>{}}>
                        <option value="main">Main Flow</option>
                      </NativeSelect>
                      <NativeSelect sm className="flex-1" value={qRefNodeId} onChange={e=>setQRefNodeId(e.target.value)}>
                        <option value="">Select question</option>
                        {nodes.filter(n=>n.id!==localNode.id).map(n=>(
                          <option key={n.id} value={n.id}>{n.data?.name||n.type}</option>
                        ))}
                      </NativeSelect>
                    </div>
                    {qRefVar && (
                      <div className="flex gap-1.5 items-center border border-slate-200 rounded-lg px-3 py-1.5 bg-slate-50 mt-2">
                        <code className="text-[11px] text-blue-600 flex-1 font-mono truncate">{qRefVar}</code>
                        <button className="text-[10px] font-semibold text-white bg-blue-500 hover:bg-blue-600 rounded-md px-2 py-0.5 transition-colors flex-shrink-0"
                          onClick={()=>copyVar(qRefVar)}>
                          {copiedVar===qRefVar ? '✓' : 'Copy'}
                        </button>
                      </div>
                    )}
                  </div>
                </div>}
              </div>

              {/* Time Based Greeting */}
              <div className="rounded-xl border border-slate-200 overflow-hidden">
                <button type="button" onClick={()=>toggleAdv('time')}
                  className="w-full flex items-center gap-2 px-4 py-3 bg-slate-50 hover:bg-slate-100 transition-colors text-left">
                  <Clock size={13} className="text-slate-500"/>
                  <span className="text-xs font-semibold text-slate-700 flex-1">Time Based Greeting</span>
                  <ChevronDown size={13} className={clsx('text-slate-400 transition-transform flex-shrink-0', advOpen.time && 'rotate-180')}/>
                </button>
                {advOpen.time && <div className="p-4 border-t border-slate-100">
                  <div className="flex gap-1.5 items-center border border-slate-200 rounded-lg px-3 py-2 bg-slate-50">
                    <code className="text-xs text-blue-600 flex-1 font-mono">{'{{time_based_greeting}}'}</code>
                    <button className="text-[10px] font-semibold text-white bg-blue-500 hover:bg-blue-600 rounded-md px-2 py-0.5 transition-colors"
                      onClick={()=>navigator.clipboard.writeText('{{time_based_greeting}}').catch(()=>{})}>
                      Copy
                    </button>
                  </div>
                  <p className="text-[11px] text-slate-400 mt-2">Outputs "Good morning", "Good afternoon", or "Good evening" based on the user's local time.</p>
                </div>}
              </div>

              {/* All Variables */}
              <div className="rounded-xl border border-slate-200 overflow-hidden">
                <button type="button" onClick={()=>toggleAdv('vars')}
                  className="w-full flex items-center gap-2 px-4 py-3 bg-slate-50 hover:bg-slate-100 transition-colors text-left">
                  <Variable size={13} className="text-slate-500"/>
                  <span className="text-xs font-semibold text-slate-700 flex-1">All Variables</span>
                  <ChevronDown size={13} className={clsx('text-slate-400 transition-transform flex-shrink-0', advOpen.vars && 'rotate-180')}/>
                </button>
                {advOpen.vars && <div className="p-4 space-y-3 border-t border-slate-100">
                  <p className="text-[10px] text-slate-400">Click any variable to copy it to clipboard</p>
                  {VAR_GROUPS.map(g=>(
                    <div key={g.group}>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">{g.group}</p>
                      <div className="flex flex-wrap gap-1.5">
                        {g.vars.map(v=>(
                          <button key={v.v} title={v.l}
                            onClick={()=>copyVar(v.v)}
                            className={clsx('text-[11px] font-mono border rounded-md px-2 py-0.5 transition-all',
                              copiedVar===v.v
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                : 'bg-blue-50 text-blue-600 border-blue-100 hover:bg-blue-100')}>
                            {copiedVar===v.v ? '✓ Copied' : v.v}
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>}
              </div>

              {/* ── Regex Examples (ask types only) ── */}
              {DEFS[localNode.type]?.cat === 'ask' && (
                <div className="rounded-xl border border-slate-200 overflow-hidden">
                  <button type="button" onClick={()=>toggleAdv('regex')}
                    className="w-full flex items-center gap-2 px-4 py-3 bg-slate-50 hover:bg-slate-100 transition-colors text-left">
                    <Hash size={13} className="text-slate-500 flex-shrink-0"/>
                    <span className="text-xs font-semibold text-slate-700 flex-1">Regex Examples</span>
                    <ChevronDown size={13} className={clsx('text-slate-400 transition-transform flex-shrink-0', advOpen.regex && 'rotate-180')}/>
                  </button>
                  {advOpen.regex && (
                    <div className="p-4 space-y-3 border-t border-slate-100">
                      {/* Live test input */}
                      <div>
                        <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Test Regex Live</p>
                        <div className="flex gap-2">
                          <div className="flex-1 relative">
                            <input
                              placeholder="Paste regex pattern..."
                              id="rf-pattern"
                              className={clsx(inputSmCls)}
                              onChange={e=>{document.getElementById('rf-test').dataset.pat=e.target.value; document.getElementById('rf-test').dispatchEvent(new Event('input'))}}
                            />
                          </div>
                          <div className="flex-1 relative">
                            <input
                              id="rf-test"
                              placeholder="Type to test..."
                              className={inputSmCls}
                              onInput={e=>{
                                const pat=e.target.dataset.pat||''
                                const val=e.target.value
                                const res=e.target.closest('.regex-tester')?.querySelector('.regex-result')
                                if(res){
                                  if(!pat||!val){res.textContent='';return}
                                  try{const ok=new RegExp(pat).test(val);res.textContent=ok?'✓':'✗';res.className='regex-result text-[13px] font-bold absolute right-2.5 top-1/2 -translate-y-1/2 '+(ok?'text-emerald-500':'text-red-400')}
                                  catch{res.textContent='⚠';res.className='regex-result text-[13px] font-bold absolute right-2.5 top-1/2 -translate-y-1/2 text-amber-400'}
                                }
                              }}
                            />
                            <span className="regex-result text-[13px] font-bold absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-300"></span>
                          </div>
                        </div>
                      </div>
                      {/* Examples */}
                      <div className="space-y-1.5 regex-tester">
                        {[
                          {label:'Name (3–20 letters)',         pattern:'^([a-zA-Z ]){3,20}$'},
                          {label:'5-digit number',              pattern:'^[0-9]{5}$'},
                          {label:'Credit card number',          pattern:'^[0-9]{4} [0-9]{4} [0-9]{4} [0-9]{4}$'},
                          {label:'Max 10 chars (alphanum)',      pattern:'^[a-zA-Z0-9_ ]{1,10}$'},
                          {label:'Email address',               pattern:'^[a-zA-Z0-9._%+\\-]+@[a-zA-Z0-9.\\-]+\\.[a-zA-Z]{2,}$'},
                          {label:'10-digit phone',              pattern:'^[0-9]{10}$'},
                          {label:'Indian mobile (6–9 start)',    pattern:'^[6-9][0-9]{9}$'},
                          {label:'6-digit PIN code',            pattern:'^[0-9]{6}$'},
                          {label:'Date (DD/MM/YYYY)',           pattern:'^(0[1-9]|[12][0-9]|3[01])\\/(0[1-9]|1[012])\\/[0-9]{4}$'},
                          {label:'Alphanumeric only',           pattern:'^[a-zA-Z0-9]+$'},
                          {label:'Min 5 characters',            pattern:'^.{5,}$'},
                          {label:'URL (http/https)',            pattern:'^https?:\\/\\/[\\w\\-]+(\\.[\\w\\-]+)+.*$'},
                          {label:'No special characters',       pattern:'^[a-zA-Z0-9 ]+$'},
                          {label:'Positive integer',            pattern:'^[1-9][0-9]*$'},
                          {label:'Decimal number',              pattern:'^[0-9]+(\\.[0-9]+)?$'},
                        ].map(({label,pattern})=>(
                          <div key={label} className="flex items-center justify-between gap-2 px-3 py-2 bg-slate-50 rounded-lg border border-slate-100">
                            <div className="min-w-0">
                              <p className="text-[10px] font-semibold text-slate-500">{label}</p>
                              <p className="text-[11px] font-mono text-slate-600 mt-0.5 truncate">{pattern}</p>
                            </div>
                            <button
                              onClick={()=>copyVar(pattern)}
                              className={clsx('flex-shrink-0 text-[10px] font-semibold rounded-md px-2 py-0.5 transition-colors',
                                copiedVar===pattern ? 'bg-emerald-100 text-emerald-700' : 'bg-blue-500 text-white hover:bg-blue-600')}>
                              {copiedVar===pattern ? '✓' : 'Copy'}
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

            </div>
          )}

          {/* ── Preview ── */}
          {tab==='preview' && (
            <div className="p-5">
              <p className="text-xs font-semibold text-slate-500 mb-4">WhatsApp preview</p>
              <div className="rounded-2xl overflow-hidden shadow-md" style={{background:'#e5ddd5', minHeight:260}}>
                {/* WA header */}
                <div className="flex items-center gap-3 px-4 py-3" style={{background:'#128C7E'}}>
                  <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center flex-shrink-0">
                    <MessageSquare size={14} className="text-white"/>
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-white leading-tight">{localNode.data?.name || def.label}</p>
                    <p className="text-[10px] text-white/70">online</p>
                  </div>
                </div>
                {/* Render via WAPreview — handles text, buttons, list correctly */}
                <div className="p-4">
                  <WAPreview
                    message={questionText}
                    buttons={d.buttons || null}
                    listButtonLabel={d.buttonLabel || null}
                  />
                  {!questionText && (
                    <p className="text-xs text-slate-400 italic text-center py-6">Your message will appear here…</p>
                  )}
                </div>
                {charCount > 0 && (
                  <div className="px-4 pb-3 flex justify-end">
                    <span className={clsx('text-[10px] font-semibold px-2 py-0.5 rounded-full',
                      charCount>1000?'bg-red-100 text-red-500':charCount>800?'bg-amber-100 text-amber-600':'bg-white/60 text-slate-500')}>
                      {charCount}/1000
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ── Help guide ── */}
          {tab==='guide' && (() => {
            const guides = {
              text:          { emoji:'💬', title:'Send Text', what:'Sends a plain text message to the user.', why:'Use it to greet users, give instructions, or provide information without expecting a response.', tips:['Keep messages concise — under 160 chars for best readability.','Use variables like {{recipient.name}} to personalise.','Combine with Send Buttons to guide the next step.'] },
              media:         { emoji:'🖼️', title:'Send Media', what:'Sends an image, video, document, or audio file to the user.', why:'Rich media dramatically increases engagement and is perfect for product images, tutorials, menus, or brochures.', tips:['Images under 5 MB load fastest.','Add a caption to give context.','Documents (PDF) are great for catalogues and price lists.'] },
              send_buttons:  { emoji:'🔘', title:'Send Buttons', what:'Sends a message with up to 3 clickable quick-reply buttons.', why:'Buttons guide users through a conversation without typing — ideal for menus, yes/no prompts, and branching flows.', tips:['Max 3 buttons per message (WhatsApp limit).','Keep button labels short — under 20 chars.','Each button can route to a different flow step.'] },
              send_list:     { emoji:'📋', title:'Send List', what:'Sends a scrollable list menu with sections and items.', why:'Lists are perfect when you have more than 3 options — product categories, FAQ topics, service selections.', tips:['Supports up to 10 sections with multiple items each.','Add a footer to hint what the list is for.','Users tap the button to open the list — label it clearly.'] },
              template:      { emoji:'📝', title:'Send Template', what:'Sends a pre-approved WhatsApp Business template message.', why:'Required for proactive outbound messages to users who haven\'t messaged in the past 24 hours.', tips:['Templates must be approved by Meta before use.','Use header/body/footer variables for personalisation.','Common uses: order confirmations, appointment reminders, alerts.'] },
              ask_text:      { emoji:'✍️', title:'Ask Text', what:'Sends a question and waits for a free-text reply from the user.', why:'Ideal for collecting names, email addresses, feedback, or any open-ended input.', tips:['Save the reply to a variable so you can use it later.','Use Regex Validation to enforce input format.','Set a retry limit and a friendly error message.'] },
              ask_number:    { emoji:'🔢', title:'Ask Number', what:'Asks the user to enter a number and validates the response.', why:'Use for quantities, ages, prices, pin codes — anything that must be numeric.', tips:['Set Min/Max to reject out-of-range values.','The node automatically rejects non-numeric input.','Save to a variable for use in API calls or conditions.'] },
              ask_phone:     { emoji:'📱', title:'Ask Phone', what:'Asks the user to share or type their phone number.', why:'Collect phone numbers for callbacks, CRM updates, or contact creation.', tips:['Pre-fill the country code to reduce user friction.','Validates E.164 format automatically.','Pair with Update Contact to save directly to the CRM.'] },
              ask_email:     { emoji:'📧', title:'Ask Email', what:'Asks the user to provide their email address.', why:'Collect emails for newsletters, order confirmations, or CRM records.', tips:['Validates proper email format automatically.','Save to {{contact.email}} to update the contact directly.','Follow up with a confirmation or lead-nurture sequence.'] },
              ask_date:      { emoji:'📅', title:'Ask Date', what:'Asks the user to enter a date in a specific format.', why:'Use for appointment booking, delivery date selection, or event registration.', tips:['Choose a date format that matches your region.','Set Min/Max date to restrict booking windows.','Save the date to a variable for use in downstream steps.'] },
              ask_location:  { emoji:'📍', title:'Ask Location', what:'Asks the user to share their live location via WhatsApp.', why:'Great for delivery address collection, nearest-store lookup, or field service scheduling.', tips:['WhatsApp prompts the user with a native location picker.','Save coordinates to process with an API call.','Always inform users why you need their location.'] },
              ask_button:    { emoji:'🔘', title:'Ask with Buttons', what:'Sends a question with up to 3 button choices and routes based on the selection.', why:'The clearest way to present a small set of options — each button connects to a different path in the flow.', tips:['Label buttons with the outcome, not the action — "Support", not "Click here".','Each button creates an output port — connect each to the right next step.','Max 3 buttons is a WhatsApp platform constraint.'] },
              ask_list:      { emoji:'📋', title:'Ask with List', what:'Presents a scrollable list of options for the user to choose from.', why:'Best when you have more than 3 options — beats cramming them all into text.', tips:['Group related options into sections for clarity.','The user taps the list button to expand — label it well.','Save the selection to a variable for conditional branching later.'] },
              ask_keyword:         { emoji:'🔑', title:'Ask with Keywords', what:'Waits for the user to type a specific keyword and routes accordingly.', why:'Lets you build keyword-triggered menus without buttons — useful for opt-out, STOP commands, or language selection.', tips:['Add all likely spellings and synonyms.','Enable case-insensitive matching to be forgiving.','Add a default/fallback path for unrecognised keywords.'] },
              ask_appointment:     { emoji:'📅', title:'Appointment Booking', what:'Lets users book a time slot that syncs directly with Google Calendar or Outlook — and auto-generates a meeting link.', why:'Replace manual scheduling with a fully automated, calendar-integrated booking experience inside WhatsApp.', tips:['Connect at least one calendar before activating.','Set slot intervals to 30 or 60 mins for the smoothest UX.','Use "Disable Next Days" to block same-day bookings and give yourself prep time.','Save the booking to a variable to reference the date in follow-up messages.'] },
              ask_appointment_off: { emoji:'🏢', title:'Offline Appointment', what:'Collects a date and time preference from the user for an in-person or phone appointment — without calendar sync or auto meeting links.', why:'Ideal for walk-in clinics, service centres, or any business that manages bookings manually.', tips:['Use clear status messages so users know what happens after they book.','Set "Enable Future Days" to the furthest advance booking you can handle.','Follow up with a confirmation text node after this step.','Pair with an "Assign Conversation" node to alert the right team member.'] },
              ask_file:      { emoji:'📎', title:'Ask File', what:'Asks the user to upload an image, document, video, or audio file.', why:'Collect supporting documents, photos, voice notes, or invoices directly in the chat.', tips:['Set allowed types to match exactly what you need.','Keep the max size limit reasonable — 10 MB is a good default.','Save the file reference to pass to an API or support ticket.'] },
              condition:     { emoji:'🔀', title:'Condition', what:'Evaluates a variable against a condition and branches the flow into Yes or No paths.', why:'The core logic block — use it to personalise flows based on user answers, contact data, or API responses.', tips:['Chain conditions for complex multi-step logic.','Use "contains" for flexible keyword matching.','Always connect both True and False outputs.'] },
              delay:         { emoji:'⏱️', title:'Delay', what:'Pauses the flow for a set amount of time before continuing.', why:'Mimics natural conversation pacing or schedules follow-up messages after a realistic wait.', tips:['Use seconds for quick typing indicators.','Use minutes/hours for follow-up nudges.','Combine with a conditional check to avoid messaging opt-outs.'] },
              set_var:       { emoji:'📦', title:'Set Variable', what:'Assigns a static value or expression to a variable.', why:'Initialise counters, flags, or computed values before using them in conditions or messages.', tips:['Supports static values and references to other variables.','Use to "rename" a variable or combine two values.','Great for default-value initialisation at the start of a flow.'] },
              api:           { emoji:'🌐', title:'API Request', what:'Makes an HTTP request to an external API and saves the response.', why:'Integrates with any REST API — fetch order status, create a CRM record, trigger a webhook, or send an email.', tips:['Use GET for fetching data, POST for submitting.','Save the response to {{api_response}} and parse it in a condition.','Add request headers for auth tokens.'] },
              gpt_dialog:    { emoji:'🤖', title:'GPT Dialog', what:'Sends user input to OpenAI GPT and uses the AI response as the bot reply.', why:'Enables free-form AI conversations — customer support, Q&A, creative flows — without scripted responses.', tips:['Write a clear system prompt to constrain GPT\'s behaviour.','Save the AI response to a variable for follow-up conditions.','Set temperature lower (0.3) for consistent factual answers.'] },
              assign:        { emoji:'👤', title:'Assign Conversation', what:'Routes the conversation to a specific agent or team.', why:'Hand off from bot to human seamlessly when the issue needs personal attention.', tips:['Send a handoff message so the user knows a human is taking over.','Route to teams based on topic — Sales, Support, Billing.','Use a condition before assigning to pick the right team.'] },
              working_hours: { emoji:'🕐', title:'Working Hours', what:'Branches the flow based on whether the current time falls within configured business hours.', why:'Handle after-hours contacts differently — collect a callback request instead of promising instant help.', tips:['Set timezone to match your team\'s location.','Connect the "Closed" path to an auto-reply with expected response time.','Use different schedules for weekdays vs weekends.'] },
              sheets:        { emoji:'📊', title:'Google Sheets', what:'Reads from or appends data to a Google Spreadsheet.', why:'Log leads, orders, or responses directly into a Sheet — no backend needed.', tips:['Use Append to add a new row per conversation.','Use Read to pull lookup data (pricing, inventory) into the flow.','Share the sheet with the service account email in settings.'] },
              shopify:       { emoji:'🛍️', title:'Shopify', what:'Connects to your Shopify store to look up orders, products, or customer data.', why:'Let customers check order status, get product recommendations, or trigger fulfilment actions without leaving the chat.', tips:['Use Get Order to show real-time tracking info.','Combine with a Condition to branch on order status.','Pair with a Send Template for order confirmation messages.'] },
            }
            const g = guides[localNode.type] || {
              emoji:'ℹ️',
              title: def.label,
              what:`The ${def.label} node performs a specific action in your flow.`,
              why:"See the node's configuration options in the Basic tab.",
              tips:['Connect this node to the next step in your flow.','Use variables from previous steps as inputs.']
            }
            return (
              <div className="p-5 space-y-3">
                {/* Node summary */}
                <div className="rounded-xl bg-slate-50 border border-slate-200 p-4">
                  <div className="flex items-start gap-3">
                    <span className="text-2xl flex-shrink-0 leading-none mt-0.5">{g.emoji}</span>
                    <div>
                      <p className="text-sm font-bold text-slate-900 mb-1">{g.title}</p>
                      <p className="text-xs text-slate-600 leading-relaxed">{g.what}</p>
                    </div>
                  </div>
                </div>

                <hr className="border-slate-100"/>

                {/* Why use it */}
                <div className="rounded-xl border border-blue-100 bg-blue-50 p-4">
                  <p className="text-xs font-bold text-blue-800 mb-1.5">When to use this</p>
                  <p className="text-xs text-blue-700 leading-relaxed">{g.why}</p>
                </div>

                <hr className="border-slate-100"/>

                {/* Tips */}
                <div>
                  <p className="text-xs font-bold text-slate-700 mb-2">Tips</p>
                  <div className="space-y-2">
                    {g.tips.map((t,i)=>(
                      <div key={i} className="flex items-start gap-2.5 p-3 rounded-xl bg-slate-50 border border-slate-100">
                        <div className="w-4 h-4 rounded-full bg-primary/10 text-primary flex items-center justify-center flex-shrink-0 mt-0.5 text-[10px] font-bold">{i+1}</div>
                        <p className="text-xs text-slate-600 leading-relaxed">{t}</p>
                      </div>
                    ))}
                  </div>
                </div>

                <hr className="border-slate-100"/>

                {/* Formatting */}
                <div>
                  <p className="text-xs font-bold text-slate-700 mb-2">WhatsApp formatting shortcuts</p>
                  <div className="grid grid-cols-2 gap-1.5">
                    {[
                      ['Ctrl+B','Bold (*text*)'],
                      ['Ctrl+I','Italic (_text_)'],
                      ['Ctrl+S','Strikethrough (~text~)'],
                      ['` ``` `','Monospace code'],
                      ['↵ button','Insert line break'],
                      ['• button','Bullet list'],
                      ['1. button','Numbered list'],
                      ['😀 button','Insert emoji'],
                    ].map(([k,v])=>(
                      <div key={k} className="flex items-center gap-2 bg-slate-50 rounded-lg px-3 py-1.5 border border-slate-100">
                        <code className="text-[10px] font-mono font-bold text-slate-600 bg-white border border-slate-200 rounded px-1.5 py-0.5 flex-shrink-0">{k}</code>
                        <span className="text-[11px] text-slate-500">{v}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )
          })()}

        </div>

        {/* Footer */}
        <div className="px-4 py-2.5 border-t border-slate-100 flex-shrink-0 flex items-center justify-end gap-2 bg-white">
          <button onClick={onClose}
            className="px-3.5 py-1.5 rounded-lg text-[11px] font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 active:scale-[.97] transition-all">
            Cancel
          </button>
          <button onClick={handleSave}
            className="flex items-center gap-1 px-3.5 py-1.5 rounded-lg text-[11px] font-semibold text-white bg-primary hover:bg-primary/90 active:scale-[.97] transition-all shadow-sm">
            <Save size={11}/> Save changes
          </button>
        </div>

      </div>
    </div>
  )
}

// ─── Left Palette ──────────────────────────────────────────────────────────────
function LeftPalette({ onAdd, nodeCount }) {
  const [q, setQ] = useState('')
  const [openCat, setOpenCat] = useState('send')
  const remaining = MAX_CARDS - nodeCount
  const filtered = q ? Object.entries(DEFS).filter(([,d])=>d.label.toLowerCase().includes(q.toLowerCase())) : null

  return (
    <div className="w-56 flex-shrink-0 bg-white border-r border-surface-border flex flex-col overflow-hidden">
      {/* Search */}
      <div className="p-2.5 border-b border-surface-border flex-shrink-0">
        <div className="relative">
          <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"/>
          <input value={q} onChange={e=>setQ(e.target.value)} placeholder="Search nodes..."
            className="w-full pl-7 pr-3 py-1.5 text-[11px] border border-surface-border rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-primary/15 focus:border-primary/40 transition-all"/>
        </div>
        <div className="flex items-center justify-between mt-1.5 px-0.5">
          <span className="text-[10px] text-slate-400">Nodes</span>
          <span className={clsx('text-[10px] font-bold', remaining<10?'text-red-500':remaining<20?'text-amber-500':'text-slate-400')}>
            {nodeCount}/{MAX_CARDS}
          </span>
        </div>
      </div>

      {/* Node list */}
      <div className="flex-1 overflow-y-auto">
        {filtered ? (
          <div className="p-1.5 space-y-0.5">
            {filtered.map(([type,def])=>{
              const Icon=def.icon
              return (
                <button key={type} onClick={()=>nodeCount<MAX_CARDS&&onAdd(type)}
                  disabled={nodeCount>=MAX_CARDS}
                  className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-slate-50 transition-colors text-left disabled:opacity-40">
                  <div className="w-6 h-6 rounded-md flex items-center justify-center flex-shrink-0" style={{background:def.color+'18'}}>
                    <Icon size={12} style={{color:def.color}}/>
                  </div>
                  <span className="text-[11px] font-medium text-slate-700 truncate">{def.label}</span>
                </button>
              )
            })}
            {filtered.length===0 && <p className="text-[11px] text-slate-400 text-center py-4">No nodes found</p>}
          </div>
        ) : (
          CAT_ORDER.map(cat=>{
            const catNodes=Object.entries(DEFS).filter(([,d])=>d.cat===cat)
            const isOpen=openCat===cat
            return (
              <div key={cat}>
                <button onClick={()=>setOpenCat(isOpen?null:cat)}
                  className="w-full flex items-center justify-between px-3 py-2 hover:bg-slate-50 transition-colors border-b border-surface-border">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full" style={{background:CAT_COLOR[cat]}}/>
                    <span className="text-[11px] font-bold text-slate-600">{CAT_LABELS[cat]}</span>
                    <span className="text-[10px] text-slate-400 bg-slate-100 rounded-full px-1.5">{catNodes.length}</span>
                  </div>
                  {isOpen ? <ChevronUp size={11} className="text-slate-400"/> : <ChevronDown size={11} className="text-slate-400"/>}
                </button>
                {isOpen && (
                  <div className="p-1.5 bg-slate-50/50 space-y-0.5">
                    {catNodes.map(([type,def])=>{
                      const Icon=def.icon
                      return (
                        <button key={type} onClick={()=>nodeCount<MAX_CARDS&&onAdd(type)}
                          disabled={nodeCount>=MAX_CARDS}
                          className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-white transition-colors text-left disabled:opacity-40 border border-transparent hover:border-surface-border">
                          <div className="w-5 h-5 rounded flex items-center justify-center flex-shrink-0" style={{background:def.color+'18'}}>
                            <Icon size={11} style={{color:def.color}}/>
                          </div>
                          <span className="text-[11px] text-slate-600 truncate">{def.label}</span>
                        </button>
                      )
                    })}
                  </div>
                )}
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}

// ─── Minimap ───────────────────────────────────────────────────────────────────
function Minimap({ nodes, edges, zoom, pan, svgRef }) {
  const MM_W = 160, MM_H = 110
  if (!nodes.length) return null

  const xs = nodes.map(n => n.x), ys = nodes.map(n => n.y)
  const minX = Math.min(...xs) - 20, minY = Math.min(...ys) - 20
  const maxX = Math.max(...xs) + NODE_W + 20, maxY = Math.max(...ys) + NODE_H + 20
  const w = maxX - minX || 1, h = maxY - minY || 1
  const scaleX = MM_W / w, scaleY = MM_H / h
  const s = Math.min(scaleX, scaleY, 1)

  const tx = n => (n.x - minX) * s
  const ty = n => (n.y - minY) * s

  // Viewport rectangle in canvas coords
  let vpX = 0, vpY = 0, vpW = MM_W, vpH = MM_H
  if (svgRef?.current) {
    const r = svgRef.current.getBoundingClientRect()
    const vx = (-pan.x) / zoom, vy = (-pan.y) / zoom
    const vw = r.width / zoom, vh = r.height / zoom
    vpX = (vx - minX) * s
    vpY = (vy - minY) * s
    vpW = vw * s
    vpH = vh * s
  }

  return (
    <div className="absolute bottom-4 right-4 z-20 bg-white border border-surface-border rounded-xl shadow-md overflow-hidden"
      style={{width: MM_W + 8, height: MM_H + 8}}>
      <svg width={MM_W} height={MM_H} style={{display:'block', margin:4}}>
        {/* Edges */}
        {edges.map(e => {
          const from = nodes.find(n => n.id === e.fromId), to = nodes.find(n => n.id === e.toId)
          if (!from || !to) return null
          return <line key={e.id}
            x1={tx(from) + NODE_W*s} y1={ty(from) + NODE_H/2*s}
            x2={tx(to)} y2={ty(to) + NODE_H/2*s}
            stroke="#cbd5e1" strokeWidth={1}/>
        })}
        {/* Nodes */}
        {nodes.map(n => {
          const def = DEFS[n.type] || {}
          return <rect key={n.id}
            x={tx(n)} y={ty(n)}
            width={Math.max(NODE_W * s, 4)} height={Math.max(NODE_H * s, 3)}
            rx={2} fill={def.color || '#94a3b8'} opacity={0.7}/>
        })}
        {/* Viewport rect */}
        <rect x={vpX} y={vpY} width={vpW} height={vpH}
          fill="none" stroke="#0066ff" strokeWidth={1.5} strokeDasharray="3,2" opacity={0.6}/>
      </svg>
    </div>
  )
}

// ─── Flow List View ────────────────────────────────────────────────────────────
function FlowListView({ onEdit }) {
  const [flows, setFlows] = useState(SAMPLE_FLOWS)
  const [search, setSearch] = useState('')

  const filtered = flows.filter(f => f.name.toLowerCase().includes(search.toLowerCase()))
  const active = flows.filter(f=>f.status==='active').length
  const draft  = flows.filter(f=>f.status==='draft').length

  const deleteFlow = id => setFlows(fs=>fs.filter(f=>f.id!==id))
  const toggleStatus = id => setFlows(fs=>fs.map(f=>f.id===id?{...f,status:f.status==='active'?'draft':'active'}:f))
  const duplicateFlow = id => {
    const src=flows.find(f=>f.id===id)
    if(!src) return
    const nw={...src,id:'f'+Date.now(),name:src.name+' Copy',status:'draft',edited:'2026-05-18'}
    setFlows(fs=>[...fs,nw])
  }
  const createFlow = () => {
    const nw={id:'f'+Date.now(),name:'New Flow',status:'draft',trigger:'Any message',nodes:1,edited:'2026-05-18'}
    setFlows(fs=>[...fs,nw])
    onEdit(nw)
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-[15px] font-bold text-slate-900">Automations</h1>
          <p className="text-[11px] text-slate-400 mt-0.5">Build and manage WhatsApp chatbot flows</p>
        </div>
        <button onClick={createFlow} className="bg-primary text-white text-xs font-semibold px-4 py-2 rounded-lg hover:bg-primary/90 transition-colors flex items-center gap-1.5">
          <Plus size={14}/> New Flow
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        {[
          { label:'Total Flows', value:flows.length, color:'text-slate-700', bg:'bg-slate-100' },
          { label:'Active',      value:active,        color:'text-emerald-700', bg:'bg-emerald-50' },
          { label:'Draft',       value:draft,          color:'text-amber-700',  bg:'bg-amber-50'   },
        ].map(s=>(
          <div key={s.label} className="bg-white border border-surface-border rounded-xl p-4">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">{s.label}</p>
            <p className={clsx('text-2xl font-bold', s.color)}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Search */}
      <div className="relative mb-4">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"/>
        <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search flows..."
          className="w-full pl-9 pr-4 py-2 text-sm border border-surface-border rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-primary/15 focus:border-primary/40 transition-all max-w-sm"/>
      </div>

      {/* Flow cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.map(flow=>{
          const isActive=flow.status==='active'
          return (
            <div key={flow.id} className="bg-white border border-surface-border rounded-xl p-4 hover:border-slate-300 transition-all hover:shadow-sm">
              {/* Top row */}
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className={clsx('w-7 h-7 rounded-lg flex items-center justify-center', isActive?'bg-emerald-50':'bg-slate-100')}>
                    <Zap size={14} className={isActive?'text-emerald-500':'text-slate-400'}/>
                  </div>
                  <h3 className="text-sm font-bold text-slate-800">{flow.name}</h3>
                </div>
                <span className={clsx('text-[10px] font-bold px-2 py-0.5 rounded-full', isActive?'bg-emerald-50 text-emerald-700':'bg-slate-100 text-slate-500')}>
                  {isActive?'Active':'Draft'}
                </span>
              </div>

              {/* Meta */}
              <div className="space-y-1 mb-4">
                <div className="flex items-center gap-2 text-[11px] text-slate-500">
                  <Zap size={11} className="text-slate-400"/>
                  <span>Trigger: {flow.trigger}</span>
                </div>
                <div className="flex items-center gap-2 text-[11px] text-slate-500">
                  <Activity size={11} className="text-slate-400"/>
                  <span>{flow.nodes} nodes</span>
                </div>
                <div className="flex items-center gap-2 text-[11px] text-slate-400">
                  <Clock size={11}/>
                  <span>Edited {flow.edited}</span>
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-2 pt-3 border-t border-surface-border">
                <button onClick={()=>onEdit(flow)} className="flex-1 bg-primary text-white text-[11px] font-semibold py-1.5 rounded-lg hover:bg-primary/90 transition-colors flex items-center justify-center gap-1">
                  <Edit3 size={11}/> Edit
                </button>
                <button onClick={()=>duplicateFlow(flow.id)} className="border border-surface-border text-slate-600 text-[11px] font-semibold px-3 py-1.5 rounded-lg hover:bg-slate-50 transition-colors flex items-center gap-1">
                  <Copy size={11}/> Copy
                </button>
                <button onClick={()=>deleteFlow(flow.id)} className="border border-red-100 text-red-500 text-[11px] font-semibold px-2.5 py-1.5 rounded-lg hover:bg-red-50 transition-colors">
                  <Trash2 size={11}/>
                </button>
              </div>
            </div>
          )
        })}

        {/* Create card */}
        <button onClick={createFlow}
          className="border-2 border-dashed border-slate-200 rounded-xl p-4 flex flex-col items-center justify-center gap-2 hover:border-primary/40 hover:bg-primary-50/30 transition-all min-h-[160px] text-slate-400 hover:text-primary">
          <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center group-hover:bg-primary-50">
            <Plus size={20}/>
          </div>
          <span className="text-xs font-semibold">Create New Flow</span>
        </button>
      </div>
    </div>
  )
}

// ─── Builder View ──────────────────────────────────────────────────────────────
/* Which graph a flow opens with. Until now every flow in the list opened the
   same DEMO_NODES, so clicking "Lead Capture" and clicking "Order Status" both
   showed the Welcome Bot — harmless while there was one demo graph, but it
   would have silently hidden the question-types flow behind the demo one. */
function graphFor(flow) {
  if (flow?.id === 'qtypes') return buildQuestionTypesFlow()
  return { nodes: DEMO_NODES, edges: DEMO_EDGES }
}

function BuilderView({ flow, onBack, allFlows=SAMPLE_FLOWS }) {
  // Built once per mount: the generator makes fresh node objects, so calling it
  // inline on every render would replace the graph under the user's edits.
  const initialGraph = useMemo(() => graphFor(flow), [flow?.id])
  const [nodes, setNodes]           = useState(initialGraph.nodes)
  const [edges, setEdges]           = useState(initialGraph.edges)
  const [cloneToast, setCloneToast] = useState(null)
  const [selectedId, setSelectedId] = useState(null)
  const [selectedEdgeId, setSelectedEdgeId] = useState(null)
  const [zoom, setZoom]             = useState(1)
  const [pan, setPan]               = useState({ x:60, y:60 })
  const [dragging, setDragging]     = useState(null)
  const [panning, setPanning]       = useState(false)
  const [panStart, setPanStart]     = useState({ x:0, y:0 })
  const [flowName, setFlowName]     = useState(flow?.name || 'New Flow')
  const [editName, setEditName]     = useState(false)
  const [saved, setSaved]           = useState(false)
  const [showPreview, setShowPreview] = useState(false)
  const [history, setHistory]       = useState([{ nodes:initialGraph.nodes, edges:initialGraph.edges }])
  const [histIdx, setHistIdx]       = useState(0)
  // Port drag-to-connect state
  const [connecting, setConnecting] = useState(null)  // { fromId, fromPort, x1, y1, x2, y2 }
  const [hoverPortNode, setHoverPortNode] = useState(null) // node id being hovered for input snap
  const svgRef    = useRef(null)

  const selectedNode = nodes.find(n=>n.id===selectedId)

  const pushHistory = useCallback((nn,ne) => {
    setHistory(h=>[...h.slice(0,histIdx+1),{nodes:nn,edges:ne}].slice(-30))
    setHistIdx(i=>Math.min(i+1,29))
  }, [histIdx])

  const applyHistory = useCallback((nn,ne) => {
    setNodes(nn); setEdges(ne); pushHistory(nn,ne)
  }, [pushHistory])

  const undo = useCallback(()=>{
    if(histIdx<=0) return
    const idx=histIdx-1; setHistIdx(idx); setNodes(history[idx].nodes); setEdges(history[idx].edges)
  },[history,histIdx])

  const redo = useCallback(()=>{
    if(histIdx>=history.length-1) return
    const idx=histIdx+1; setHistIdx(idx); setNodes(history[idx].nodes); setEdges(history[idx].edges)
  },[history,histIdx])

  useEffect(()=>{
    const h=e=>{
      if((e.metaKey||e.ctrlKey)&&e.key==='z'&&!e.shiftKey){e.preventDefault();undo()}
      if((e.metaKey||e.ctrlKey)&&(e.key==='y'||(e.key==='z'&&e.shiftKey))){e.preventDefault();redo()}
      if((e.key==='Delete'||e.key==='Backspace')){
        if(document.activeElement.tagName==='INPUT'||document.activeElement.tagName==='TEXTAREA') return
        if(selectedEdgeId){
          const ne=edges.filter(x=>x.id!==selectedEdgeId)
          applyHistory(nodes,ne); setSelectedEdgeId(null)
        } else if(selectedId){
          const nn=nodes.filter(n=>n.id!==selectedId)
          const ne=edges.filter(e=>e.fromId!==selectedId&&e.toId!==selectedId)
          applyHistory(nn,ne); setSelectedId(null)
        }
      }
      if(e.key==='Escape'){setSelectedId(null); setSelectedEdgeId(null); setConnecting(null); setHoverPortNode(null)}
    }
    window.addEventListener('keydown',h)
    return()=>window.removeEventListener('keydown',h)
  },[undo,redo,selectedId,nodes,edges,applyHistory])

  const toCanvas = useCallback((cx,cy)=>{
    const rect=svgRef.current?.getBoundingClientRect()
    if(!rect) return {x:0,y:0}
    return {x:(cx-rect.left-pan.x)/zoom, y:(cy-rect.top-pan.y)/zoom}
  },[pan,zoom])

  const startDrag = useCallback((e,nodeId)=>{
    if (connecting) return  // don't start dragging while connecting
    const pt=toCanvas(e.clientX,e.clientY)
    const node=nodes.find(n=>n.id===nodeId)
    setDragging({nodeId,ox:pt.x-node.x,oy:pt.y-node.y})
  },[nodes,toCanvas,connecting])

  const startConnect = useCallback((e, nodeId, portIdx) => {
    e.stopPropagation()
    const from = nodes.find(n => n.id === nodeId)
    if (!from) return
    const ports = getOutputPorts(from)
    const py = ports.length <= 1 ? NODE_H/2 : (NODE_H / (ports.length + 1)) * (portIdx + 1)
    const pt = toCanvas(e.clientX, e.clientY)
    setConnecting({ fromId: nodeId, fromPort: portIdx, x1: from.x + NODE_W, y1: from.y + py, x2: pt.x, y2: pt.y })
    setDragging(null)
    setSelectedId(null)
    setSelectedEdgeId(null)
  }, [nodes, toCanvas])

  const onSvgMouseMove = useCallback((e)=>{
    const pt=toCanvas(e.clientX,e.clientY)
    if(connecting){
      // Check proximity to any node's input port
      let snap = null
      for (const n of nodes) {
        if (n.id === connecting.fromId) continue
        const dx = pt.x - n.x
        const dy = pt.y - (n.y + NODE_H / 2)
        if (dx > -PORT_R*3 && dx < NODE_W * 0.4 && Math.abs(dy) < PORT_R * 3) {
          snap = n; break
        }
      }
      setHoverPortNode(snap ? snap.id : null)
      setConnecting(c => ({
        ...c,
        x2: snap ? snap.x : pt.x,
        y2: snap ? snap.y + NODE_H / 2 : pt.y
      }))
      return
    }
    if(dragging){
      setNodes(ns=>ns.map(n=>n.id===dragging.nodeId?{...n,x:pt.x-dragging.ox,y:pt.y-dragging.oy}:n))
    }
    if(panning){
      setPan({x:e.clientX-panStart.x,y:e.clientY-panStart.y})
    }
  },[dragging,panning,panStart,toCanvas,connecting,nodes])

  const onSvgMouseDown = useCallback((e)=>{
    if(connecting){
      // Cancel connection on canvas click
      setConnecting(null); setHoverPortNode(null); return
    }
    if(e.target===svgRef.current||e.target.tagName==='svg'){
      setPanning(true)
      setPanStart({x:e.clientX-pan.x,y:e.clientY-pan.y})
      setSelectedId(null)
      setSelectedEdgeId(null)
    }
  },[pan,connecting])

  const onSvgMouseUp = useCallback(()=>{
    if(connecting){
      if(hoverPortNode && hoverPortNode !== connecting.fromId){
        // Check for duplicate edge on same port
        const dupOnPort = edges.some(e => e.fromId === connecting.fromId && e.fromPort === connecting.fromPort)
        if (dupOnPort) {
          // Replace existing edge from same port
          const ne = edges.filter(e => !(e.fromId === connecting.fromId && e.fromPort === connecting.fromPort))
          ne.push({ id:'e'+Date.now(), fromId:connecting.fromId, fromPort:connecting.fromPort, toId:hoverPortNode })
          applyHistory(nodes, ne)
        } else {
          const ne = [...edges, { id:'e'+Date.now(), fromId:connecting.fromId, fromPort:connecting.fromPort, toId:hoverPortNode }]
          applyHistory(nodes, ne)
        }
      }
      setConnecting(null)
      setHoverPortNode(null)
      return
    }
    if(dragging){pushHistory(nodes,edges);setDragging(null)}
    setPanning(false)
  },[dragging,nodes,edges,pushHistory,connecting,hoverPortNode,applyHistory])

  const onWheel = useCallback((e)=>{
    e.preventDefault()
    setZoom(z=>Math.min(2.5,Math.max(0.25,z*(e.deltaY<0?1.1:0.9))))
  },[])

  useEffect(()=>{
    const el=svgRef.current; if(!el) return
    el.addEventListener('wheel',onWheel,{passive:false})
    return()=>el.removeEventListener('wheel',onWheel)
  },[onWheel])

  const addNode = useCallback((type)=>{
    if(nodes.length>=MAX_CARDS) return
    const n={id:uid(),type,x:(-pan.x+400)/zoom,y:(-pan.y+250)/zoom,data:makeDefaults(type)}
    const nn=[...nodes,n]
    applyHistory(nn,edges); setSelectedId(n.id)
  },[nodes,edges,pan,zoom,applyHistory])

  const updateNode = useCallback((updated)=>{
    const nn=nodes.map(n=>n.id===updated.id?updated:n)
    setNodes(nn); pushHistory(nn,edges)
  },[nodes,edges,pushHistory])

  const deleteNode = useCallback((id)=>{
    const nn=nodes.filter(n=>n.id!==id)
    const ne=edges.filter(e=>e.fromId!==id&&e.toId!==id)
    applyHistory(nn,ne); setSelectedId(null)
  },[nodes,edges,applyHistory])

  const duplicateNode = useCallback((id, targetFlowId)=>{
    const src=nodes.find(n=>n.id===id); if(!src) return
    if (targetFlowId && targetFlowId !== flow?.id) {
      const target = allFlows.find(f=>f.id===targetFlowId)
      setCloneToast(target?.name || 'another flow')
      setTimeout(()=>setCloneToast(null), 2500)
      return
    }
    if(nodes.length>=MAX_CARDS) return
    const n={...src,id:uid(),x:src.x+40,y:src.y+40,data:{...src.data,name:(src.data?.name||'')+' Copy'}}
    const nn=[...nodes,n]; applyHistory(nn,edges); setSelectedId(n.id)
  },[nodes,edges,applyHistory,flow,allFlows])

  const fitScreen = useCallback(()=>{
    if(!svgRef.current||nodes.length===0) return
    const rect=svgRef.current.getBoundingClientRect()
    const minX=Math.min(...nodes.map(n=>n.x))-40
    const minY=Math.min(...nodes.map(n=>n.y))-40
    const maxX=Math.max(...nodes.map(n=>n.x+NODE_W))+40
    const maxY=Math.max(...nodes.map(n=>n.y+NODE_H))+40
    const scaleX=rect.width/(maxX-minX)
    const scaleY=rect.height/(maxY-minY)
    const newZoom=Math.min(scaleX,scaleY,2)
    setZoom(newZoom)
    setPan({x:-minX*newZoom+20,y:-minY*newZoom+20})
  },[nodes])

  const handleSave = () => {
    setSaved(true)
    setTimeout(()=>setSaved(false),2000)
  }

  const edgePaths = useMemo(()=>edges.map(e=>{
    const from=nodes.find(n=>n.id===e.fromId), to=nodes.find(n=>n.id===e.toId)
    if(!from||!to) return null
    const ports=getOutputPorts(from)
    const pi=e.fromPort||0
    const py=ports.length<=1?NODE_H/2:(NODE_H/(ports.length+1))*(pi+1)
    return {...e,path:bezier(from.x+NODE_W,from.y+py,to.x,to.y+NODE_H/2)}
  }).filter(Boolean),[nodes,edges])

  const cardCount=nodes.length
  const cardPct=cardCount/MAX_CARDS

  return (
    <div className="fixed inset-0 z-50 bg-[#f0f4f8] flex flex-col">

      {/* Top bar */}
      <div className="h-12 bg-white border-b border-surface-border flex items-center px-3 gap-2 flex-shrink-0 z-10">
        <button onClick={onBack} className="flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900 transition-colors border border-surface-border rounded-lg px-2.5 py-1.5 hover:bg-slate-50">
          <ChevronLeft size={13}/> Back
        </button>

        <div className="w-px h-5 bg-surface-border mx-1"/>

        {/* Flow name */}
        {editName
          ? <input autoFocus value={flowName} onChange={e=>setFlowName(e.target.value)}
              onBlur={()=>setEditName(false)} onKeyDown={e=>e.key==='Enter'&&setEditName(false)}
              className="text-sm font-bold border border-primary/40 rounded-lg px-2.5 py-1 outline-none focus:ring-2 focus:ring-primary/15 max-w-44"/>
          : <button onClick={()=>setEditName(true)} className="flex items-center gap-1.5 text-sm font-bold text-slate-800 hover:text-slate-900">
              {flowName} <Edit3 size={11} className="text-slate-400"/>
            </button>}

        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-500">{cardCount} nodes</span>

        <div className="flex-1"/>

        {/* Undo/Redo */}
        <button onClick={undo} disabled={histIdx<=0} className="text-[11px] border border-surface-border rounded-lg px-2.5 py-1.5 disabled:opacity-40 hover:bg-slate-50 transition-colors text-slate-600">
          ↩ Undo
        </button>
        <button onClick={redo} disabled={histIdx>=history.length-1} className="text-[11px] border border-surface-border rounded-lg px-2.5 py-1.5 disabled:opacity-40 hover:bg-slate-50 transition-colors text-slate-600">
          ↪ Redo
        </button>

        {/* Zoom controls */}
        <div className="flex items-center border border-surface-border rounded-lg overflow-hidden">
          <button onClick={()=>setZoom(z=>Math.max(0.25,z-0.1))} className="p-1.5 hover:bg-slate-50 transition-colors border-r border-surface-border">
            <ZoomOut size={12} className="text-slate-600"/>
          </button>
          <span className="text-[11px] font-bold text-slate-600 w-10 text-center">{Math.round(zoom*100)}%</span>
          <button onClick={()=>setZoom(z=>Math.min(2.5,z+0.1))} className="p-1.5 hover:bg-slate-50 transition-colors border-l border-surface-border">
            <ZoomIn size={12} className="text-slate-600"/>
          </button>
        </div>

        <button onClick={fitScreen} className="text-[11px] border border-surface-border rounded-lg px-2.5 py-1.5 hover:bg-slate-50 transition-colors text-slate-600 flex items-center gap-1">
          <Maximize2 size={11}/> Fit
        </button>

        {/* Runs the graph currently on the canvas, unsaved edits included —
            testing what was last saved would mean testing something the
            merchant is not looking at. */}
        <button onClick={()=>setShowPreview(p=>!p)}
          className={clsx('text-[11px] border rounded-lg px-2.5 py-1.5 transition-colors flex items-center gap-1',
            showPreview ? 'border-emerald-500 bg-emerald-50 text-emerald-700' : 'border-surface-border hover:bg-slate-50 text-slate-600')}>
          <Play size={11}/> Preview
        </button>

        {/* Card meter */}
        <div className="flex items-center gap-2 border border-surface-border rounded-lg px-2.5 py-1.5">
          <div className="w-20 h-1.5 bg-slate-100 rounded-full overflow-hidden">
            <div className="h-full rounded-full transition-all" style={{width:`${cardPct*100}%`,background:cardPct>=1?'#ef4444':cardPct>=0.8?'#f59e0b':'#10b981'}}/>
          </div>
          <span className="text-[10px] font-bold text-slate-500">{cardCount}/{MAX_CARDS}</span>
        </div>

        <button onClick={handleSave}
          className={clsx('text-xs font-semibold px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-all',
            saved?'bg-emerald-500 text-white':'bg-primary text-white hover:bg-primary/90')}>
          {saved?<><Check size={12}/> Saved!</>:<><Save size={12}/> Save</>}
        </button>
      </div>

      {/* Body */}
      <div className="flex-1 flex overflow-hidden">

        {/* Left palette */}
        <LeftPalette onAdd={addNode} nodeCount={cardCount}/>

        {/* Canvas */}
        <div className="flex-1 relative overflow-hidden">
          {/* Dot grid background */}
          <svg className="absolute inset-0 w-full h-full pointer-events-none">
            <defs>
              <pattern id="dots-bg" x={pan.x%24} y={pan.y%24} width={24*zoom} height={24*zoom} patternUnits="userSpaceOnUse">
                <circle cx={0} cy={0} r={1} fill="#c8d6e5" opacity={0.6}/>
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#dots-bg)"/>
          </svg>

          {/* Main SVG canvas */}
          <svg ref={svgRef}
            className="absolute inset-0 w-full h-full"
            style={{cursor:connecting?'crosshair':panning?'grabbing':'default'}}
            onMouseDown={onSvgMouseDown}
            onMouseMove={onSvgMouseMove}
            onMouseUp={onSvgMouseUp}
            onMouseLeave={e=>{ if(!connecting) onSvgMouseUp(e) }}>
            <defs>
              <marker id="arrow" markerWidth={10} markerHeight={7} refX={8} refY={3.5} orient="auto">
                <polygon points="0 0,10 3.5,0 7" fill="#94a3b8"/>
              </marker>
              <marker id="arrow-sel" markerWidth={10} markerHeight={7} refX={8} refY={3.5} orient="auto">
                <polygon points="0 0,10 3.5,0 7" fill="#0066ff"/>
              </marker>
            </defs>
            <g transform={`translate(${pan.x},${pan.y}) scale(${zoom})`}>
              {/* Edges */}
              {edgePaths.map(e=>{
                const hl = e.id===selectedEdgeId || e.fromId===selectedId || e.toId===selectedId
                const fromDef = DEFS[nodes.find(n=>n.id===e.fromId)?.type]
                const edgeColor = hl ? '#0066ff' : fromDef?.color || '#94a3b8'
                return (
                  <g key={e.id}
                    style={{cursor:'pointer'}}
                    onClick={ev=>{ ev.stopPropagation(); setSelectedEdgeId(e.id===selectedEdgeId?null:e.id); setSelectedId(null) }}>
                    {/* Wide invisible hit area */}
                    <path d={e.path} stroke="transparent" strokeWidth={12/zoom} fill="none"/>
                    {/* Visible stroke */}
                    <path d={e.path}
                      stroke={edgeColor}
                      strokeWidth={(hl?2.5:1.5)/zoom}
                      strokeOpacity={hl?1:0.55}
                      fill="none"
                      markerEnd={hl?'url(#arrow-sel)':'url(#arrow)'}/>
                    {/* Delete X button on selected edge */}
                    {e.id===selectedEdgeId && (() => {
                      // midpoint of the bezier (approx)
                      const from = nodes.find(n=>n.id===e.fromId), to = nodes.find(n=>n.id===e.toId)
                      if (!from||!to) return null
                      const mx = (from.x+NODE_W+to.x)/2, my = (from.y+NODE_H/2+to.y+NODE_H/2)/2
                      const btnR = 9/zoom
                      return (
                        <g style={{cursor:'pointer'}} onClick={ev=>{ev.stopPropagation(); const ne=edges.filter(x=>x.id!==e.id); applyHistory(nodes,ne); setSelectedEdgeId(null)}}>
                          <circle cx={mx} cy={my} r={btnR} fill="#ef4444" stroke="#fff" strokeWidth={1.5/zoom}/>
                          <text x={mx} y={my} fontSize={10/zoom} fill="#fff" textAnchor="middle" dominantBaseline="middle" fontWeight="bold">×</text>
                        </g>
                      )
                    })()}
                  </g>
                )
              })}
              {/* Rubber-band connecting line */}
              {connecting && (
                <path
                  d={bezier(connecting.x1, connecting.y1, connecting.x2, connecting.y2)}
                  stroke="#0066ff"
                  strokeWidth={2/zoom}
                  strokeDasharray={`${6/zoom},${3/zoom}`}
                  fill="none"
                  markerEnd="url(#arrow-sel)"
                  opacity={0.85}
                  style={{pointerEvents:'none'}}/>
              )}
              {/* Nodes */}
              {nodes.map(n=>(
                <NodeCard key={n.id} node={n} selected={n.id===selectedId}
                  onSelect={id=>{ setSelectedId(id); setSelectedEdgeId(null) }}
                  onDragStart={startDrag}
                  onPortMouseDown={startConnect}
                  isConnectTarget={hoverPortNode===n.id}
                  connecting={connecting}/>
              ))}
            </g>
          </svg>

          {/* Empty state */}
          {nodes.length===0 && (
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              <div className="w-16 h-16 rounded-2xl bg-white border border-surface-border flex items-center justify-center mb-4 shadow-sm">
                <Zap size={28} className="text-slate-300"/>
              </div>
              <p className="text-base font-bold text-slate-500">Start building your flow</p>
              <p className="text-sm text-slate-400 mt-1">Click a node in the left panel to add it</p>
            </div>
          )}

          {/* Connecting hint */}
          {connecting && (
            <div className="absolute top-3 left-1/2 -translate-x-1/2 bg-[#0066ff] text-white text-xs font-semibold px-4 py-1.5 rounded-full shadow-lg pointer-events-none flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-white animate-pulse"/>
              Drag to a node input port to connect · Esc to cancel
            </div>
          )}

          {/* Selected edge hint */}
          {selectedEdgeId && !connecting && (
            <div className="absolute top-3 left-1/2 -translate-x-1/2 bg-red-500 text-white text-xs font-semibold px-4 py-1.5 rounded-full shadow-lg pointer-events-none flex items-center gap-2">
              Edge selected · Press Delete to remove · Click × on edge
            </div>
          )}

          {/* Minimap */}
          <Minimap nodes={nodes} edges={edges} zoom={zoom} pan={pan} svgRef={svgRef}/>

          {/* Keyboard shortcuts hint */}
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-3 bg-white/90 border border-surface-border rounded-full px-4 py-1.5 text-[10px] text-slate-400 font-medium shadow-sm pointer-events-none">
            <span>Drag port → connect</span>
            <span className="w-px h-3 bg-slate-200"/>
            <span>Click edge → select</span>
            <span className="w-px h-3 bg-slate-200"/>
            <span>Del → delete selected</span>
            <span className="w-px h-3 bg-slate-200"/>
            <span>Scroll → zoom</span>
            <span className="w-px h-3 bg-slate-200"/>
            <span>Ctrl+Z → undo</span>
          </div>
        </div>

        {/* Modal overlay */}
        {selectedNode && (
          <NodeEditModal
            node={selectedNode}
            nodes={nodes}
            edges={edges}
            onChange={updateNode}
            onDelete={()=>deleteNode(selectedId)}
            onDuplicate={(targetFlowId)=>duplicateNode(selectedId, targetFlowId)}
            onClose={()=>setSelectedId(null)}
            allFlows={allFlows}
            currentFlowId={flow?.id}/>
        )}

        {/* Live flow preview — keyed on the node/edge count so structural edits
            restart the run rather than leaving it stranded mid-conversation on
            a node that no longer exists. Content edits (copy, button labels)
            deliberately do NOT restart it: rewording a prompt while testing
            should not throw away the answers already given. */}
        {showPreview && (
          <WAFlowPreview
            key={`${nodes.length}-${edges.length}`}
            nodes={nodes}
            edges={edges}
            flowName={flowName}
            onClose={()=>setShowPreview(false)}/>
        )}

        {/* Clone-to-flow toast */}
        {cloneToast && (
          <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[200] flex items-center gap-2 bg-slate-900 text-white text-[12px] font-medium px-4 py-2.5 rounded-xl shadow-lg animate-fade-in">
            <Copy size={13} className="text-emerald-400"/>
            Node cloned to <span className="font-semibold text-emerald-300">{cloneToast}</span>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Main FlowSetup ────────────────────────────────────────────────────────────
export default function FlowSetup() {
  const [editingFlow, setEditingFlow] = useState(null)

  if (editingFlow) {
    return <BuilderView flow={editingFlow} onBack={()=>setEditingFlow(null)}/>
  }

  return <FlowListView onEdit={setEditingFlow}/>
}
