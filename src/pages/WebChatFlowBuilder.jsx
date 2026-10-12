// WebChatFlowBuilder.jsx — node-based pan/zoom canvas flow builder for the website
// chat widget, adapted from the same engine used by WhatsApp's FlowSetup.jsx and
// Instagram's InstagramFlowBuilder.jsx (pan/zoom/drag-to-connect/minimap/undo-redo),
// with a Web-Chat-relevant node palette (page-visit/idle/exit-intent triggers, lead
// capture, CSAT rating, live-agent handover) instead of DM/comment concepts.
import { useState, useRef, useEffect, useCallback, useMemo } from 'react'
import clsx from 'clsx'
import {
  Plus, X, ChevronLeft, ChevronDown, ChevronUp, Save, Trash2, Copy, Edit3, Check, Search,
  Send, Image as ImageIcon, MessageCircle, MessageSquareText, Hash, Variable,
  AlertCircle, ExternalLink, Clock, GitBranch, Shuffle, Link2, Zap, Maximize2, ZoomIn, ZoomOut,
  Globe, LogOut, Star, UserPlus, PhoneForwarded, BookOpen, Eye, RotateCcw,
  Calendar, MapPin, CreditCard, Pencil, Upload, CornerDownRight, Workflow, Crown,
  Sparkles, UserCheck,
} from 'lucide-react'
import { NativeSelect } from '../components/Select'
import { QUESTION_TYPES as WEBCHAT_QUESTION_TYPES } from '../constants/webchatQuestionTypes'
import { WIDGET_CFG_STORAGE_KEY, useWidgetTheme, WidgetPreview, getLandingBotId, slugifyBotName } from './WebChatAppearance'
import { usePublishSection, useLoadSection, SECTION_FLOWS } from '../lib/liveConfig'
import { useBotId } from '../constants/webchat'
import { AnswerControl, COUNTRIES, DEFAULT_FORM_FIELDS, FORM_FIELD_TYPES, FORM_TYPES_WITH_OPTIONS, CHOICE_STYLES, CHOICE_DIRECTIONS, CHOICE_DEFAULT_DIRECTION } from '../components/webchat/AnswerControls'
import { useConversations } from '../context/ConversationContext'

/* ─── one draggable palette block per question type — "ask_<id>" — instead ──
   of a single generic "Ask Question" block, mirroring Instagram's flow builder.
   Reuses Web Chat's own 22 question types (Text/Choice/Date & Time/Media/Special)
   rather than a separate hardcoded list, so the palette can't drift from the
   Question Types catalog. ── */
const ASK_DEFS = Object.fromEntries(WEBCHAT_QUESTION_TYPES.map(q => [
  `ask_${q.id}`,
  { label: q.name, desc: q.desc, icon: q.icon, color: q.color, cat: 'ask', questionType: q.id },
]))

/* ─── node definitions — trimmed to what a website widget flow can actually do ── */
const DEFS = {
  start:        { label: 'Trigger',          icon: Zap,             color: '#0066ff', cat: 'system' },
  quick_automation: { label: 'Quick Automation', icon: Sparkles,    color: '#f97316', cat: 'system' },
  end:          { label: 'End Flow',         icon: X,               color: '#64748b', cat: 'system' },
  send_text:    { label: 'Send Message',     icon: Send,            color: '#10b981', cat: 'send' },
  send_media:   { label: 'Send Image',       icon: ImageIcon,       color: '#10b981', cat: 'send' },
  quick_replies:{ label: 'Quick Replies',    icon: MessageSquareText, color: '#10b981', cat: 'send' },
  show_article: { label: 'Show Help Article', icon: BookOpen,       color: '#10b981', cat: 'send' },
  send_location:{ label: 'Send Location',    icon: MapPin,          color: '#10b981', cat: 'send' },
  ...ASK_DEFS,
  tag:          { label: 'Add Tag',          icon: Hash,            color: '#3b82f6', cat: 'action' },
  untag:        { label: 'Remove Tag',       icon: Hash,            color: '#3b82f6', cat: 'action' },
  setfield:     { label: 'Set Custom Field', icon: Variable,        color: '#3b82f6', cat: 'action' },
  notify:       { label: 'Notify Agent',     icon: AlertCircle,     color: '#3b82f6', cat: 'action' },
  crm:          { label: 'Push to CRM',      icon: ExternalLink,    color: '#3b82f6', cat: 'action' },
  lead_capture: { label: 'Capture Lead',     icon: UserPlus,        color: '#3b82f6', cat: 'action' },
  csat_rating:  { label: 'Trigger Rating',   icon: Star,            color: '#3b82f6', cat: 'action' },
  live_chat:    { label: 'Handover to Agent', icon: PhoneForwarded, color: '#3b82f6', cat: 'action' },
  delay:        { label: 'Smart Delay',      icon: Clock,           color: '#8b5cf6', cat: 'utility' },
  condition:    { label: 'Condition',        icon: GitBranch,       color: '#8b5cf6', cat: 'utility' },
  split:        { label: 'Random Split',     icon: Shuffle,         color: '#8b5cf6', cat: 'utility' },
  setvar:       { label: 'Set Variable',     icon: Variable,        color: '#8b5cf6', cat: 'utility' },
  webhook:      { label: 'External Request', icon: Link2,           color: '#06b6d4', cat: 'connector' },
  jump:         { label: 'Jump to Step',     icon: CornerDownRight, color: '#8b5cf6', cat: 'utility' },
  goto_subflow: { label: 'Go to Subflow',    icon: Workflow,        color: '#ec4899', cat: 'flow' },
}
const CAT_ORDER  = ['system', 'send', 'ask', 'action', 'utility', 'connector', 'flow']
const CAT_LABELS = { system: 'Trigger & End', send: 'Send', ask: 'Ask Questions', action: 'Actions', utility: 'Utilities', connector: 'Connectors', flow: 'Flow Control' }
const CAT_COLOR  = { system: '#0066ff', send: '#10b981', ask: '#f59e0b', action: '#3b82f6', utility: '#8b5cf6', connector: '#06b6d4', flow: '#ec4899' }

/* A flow's canvas can hold more than one of these — each is an independent
   entry point (e.g. a keyword trigger AND a separate idle-time trigger) that
   can lead into shared downstream nodes, the same way WhatsApp's FlowSetup.jsx
   lets one flow have several Start nodes feeding common logic instead of
   forcing every intent into its own disconnected flow. */
const TRIGGER_TYPES = [
  { v: 'widget_open',  l: 'Widget Opened',  icon: MessageCircle },
  { v: 'page_visit',   l: 'Page Visit',     icon: Globe },
  { v: 'keyword',      l: 'Message Keyword', icon: MessageSquareText },
  { v: 'idle_time',    l: 'Visitor Idle',   icon: Clock },
  { v: 'exit_intent',  l: 'Exit Intent',    icon: LogOut },
  { v: 'returning_visitor', l: 'Returning Visitor', icon: UserCheck },
]
// Quick Automation nodes only offer the 5 trigger kinds that make sense for a
// standalone keyword/page/idle/exit-intent/returning-visitor → instant-reply
// node (reuses TRIGGER_TYPES rather than a second hardcoded list — every value
// here must also exist there). "Widget Opened" isn't included since that's
// what the flow's own Trigger node already covers.
const QUICK_AUTOMATION_TRIGGER_TYPES = TRIGGER_TYPES.filter(t => t.v !== 'widget_open')

function makeDefaults(type) {
  const base = { name: DEFS[type]?.label || type }
  if (DEFS[type]?.cat === 'ask' && DEFS[type]?.questionType) return { ...base, questionType: DEFS[type].questionType, question: '', saveAs: '' }
  switch (type) {
    case 'start':         return { ...base, trigger: 'widget_open', keywords: '', pageUrl: '', idleSeconds: 30 }
    case 'quick_automation': return { ...base, trigger: 'keyword', keywords: '', pageUrl: '', idleSeconds: 30, message: '', aiEnabled: false, aiInstructions: '' }
    case 'end':           return { ...base, endMessage: '' }
    case 'send_text':     return { ...base, message: '' }
    case 'send_media':    return { ...base, mediaType: 'image', caption: '' }
    case 'send_location': return { ...base, locLabel: '', address: '', lat: '', lng: '', message: '' }
    case 'quick_replies': return { ...base, message: '', buttons: [{ id: '1', label: '' }, { id: '2', label: '' }] }
    case 'show_article':  return { ...base, articleTitle: '', articleUrl: '' }
    case 'tag':            return { ...base, tagName: '' }
    case 'untag':          return { ...base, tagName: '' }
    case 'setfield':       return { ...base, field: '', value: '' }
    case 'notify':         return { ...base, note: '' }
    case 'crm':             return { ...base, note: 'Push visitor + collected fields to CRM' }
    case 'lead_capture':    return { ...base, captureName: true, captureEmail: true, capturePhone: false, message: 'Before we continue, can I get a few details?' }
    case 'csat_rating':     return { ...base, message: 'How would you rate this conversation?' }
    case 'live_chat':       return { ...base, note: 'Pauses the bot and assigns this conversation to a human agent' }
    case 'delay':          return { ...base, duration: 30, unit: 'seconds' }
    case 'condition':      return { ...base, variable: '', operator: 'equals', value: '', trueLabel: 'Yes', falseLabel: 'No' }
    case 'split':          return { ...base, labelA: 'Path A (50%)', labelB: 'Path B (50%)' }
    case 'setvar':         return { ...base, variable: '', value: '' }
    case 'webhook':         return { ...base, method: 'POST', url: '' }
    case 'jump':            return { ...base, targetNodeId: '' }
    case 'goto_subflow':    return { ...base, subflowId: '' }
    default:                return base
  }
}

function getOutputPorts(node) {
  const d = node.data || {}
  switch (node.type) {
    case 'end':            return []
    case 'goto_subflow':   return [] // jumps out of the current graph entirely — nothing continues after it here
    case 'condition':      return [{ label: d.trueLabel || 'Yes', idx: 0 }, { label: d.falseLabel || 'No', idx: 1 }]
    case 'split':           return [{ label: d.labelA || 'Path A', idx: 0 }, { label: d.labelB || 'Path B', idx: 1 }]
    case 'quick_replies':  return (d.buttons || []).map((b, i) => ({ label: b.label || `Option ${i + 1}`, idx: i }))
    default:                return [{ label: '→', idx: 0 }]
  }
}

const NODE_W = 210
const NODE_H = 66
const PORT_R = 7
const MAX_NODES = 60

let _uid = 100
const uid = () => `n${++_uid}`
const bezier = (x1, y1, x2, y2) => { const dx = Math.abs(x2 - x1) * 0.5; return `M${x1},${y1} C${x1 + dx},${y1} ${x2 - dx},${y2} ${x2},${y2}` }

/* ─── Courier/logistics bot — the real Main Flow content ─────────────────
   Translates the product owner's Mermaid flowchart (see WebChatFlowBuilder
   task notes) 1:1 into this canvas's node/edge model: one flat graph (no
   Subflows, since the diagram's loop-backs — booking → schedule pickup,
   freight quote → booking, and every module's "Next Action?" menu — all
   jump back into shared nodes in this same graph). A handful of `jump`
   nodes are reused as shared landing points (e.g. one "back to End
   Navigation" jump fed by every module's terminal step) instead of one
   jump node per source edge, so the graph stays well under MAX_NODES
   without changing the flow's actual behavior — a jump node's target is
   just data, so any number of edges can point at the same jump node. ── */
function buildCourierBotFlow() {
  let _n = 0, _e = 0
  const nid = () => `n${++_n}`
  const eid = () => `ce${++_e}` // "courier edge" — distinct prefix from other seed builders' e1../ids
  const nodes = [], edges = []
  const addNode = (type, x, y, data) => { const id = nid(); nodes.push({ id, type, x, y, data }); return id }
  const addEdge = (fromId, fromPort, toId) => edges.push({ id: eid(), fromId, fromPort, toId })

  const addrFields = (prefix) => ([
    { id: `${prefix}_name`, label: 'Full Name', type: 'text', enabled: true },
    { id: `${prefix}_phone`, label: 'Phone', type: 'phone', enabled: true },
    { id: `${prefix}_address`, label: 'Address Line', type: 'text', enabled: true },
    { id: `${prefix}_pin`, label: 'PIN Code', type: 'text', enabled: true },
  ])

  /* ── Main Menu (hub) ── */
  const mainMenu = addNode('quick_replies', 340, 40, {
    name: 'Main Menu', message: "Hi there! 👋 Welcome to QuickShip. What would you like to do today?",
    buttons: [
      { id: '1', label: '📦 Courier Booking' },
      { id: '2', label: '💰 Freight Calculation' },
      { id: '3', label: '🗓️ Schedule Shipping' },
      { id: '4', label: '🔍 Track Shipment' },
      { id: '5', label: '👛 Wallet Management' },
      { id: '6', label: '📍 Manage Address' },
      { id: '7', label: '🧪 Test All Questions' },
    ],
  })

  /* ── Module 1: Courier Booking ── */
  const bPickup = addNode('quick_replies', 340, 280, { name: 'Pickup Address', message: "Let's get your courier booked. Where should we pick this up from?", buttons: [{ id: '1', label: 'Select Saved Address' }, { id: '2', label: 'Enter New Address' }] })
  const bSavedPick = addNode('send_text', 620, 180, { name: 'Fetch Saved Pickup', message: 'Pulling up your saved pickup addresses now… 📇' })
  const bNewPick = addNode('ask_form', 620, 380, { name: 'New Pickup Address', questionType: 'form', question: "No problem — let's add a new pickup address.", saveAs: 'pickup_address', formFields: addrFields('pickup') })
  const bDrop = addNode('quick_replies', 900, 280, { name: 'Delivery Address', message: "Got the pickup sorted. Now, where's this parcel headed?", buttons: [{ id: '1', label: 'Select Saved Address' }, { id: '2', label: 'Enter New Address' }] })
  const bSavedDrop = addNode('send_text', 1180, 180, { name: 'Fetch Saved Delivery', message: 'Pulling up your saved delivery addresses now… 📇' })
  const bNewDrop = addNode('ask_form', 1180, 380, { name: 'New Delivery Address', questionType: 'form', question: "Let's add the delivery details.", saveAs: 'delivery_address', formFields: addrFields('delivery') })
  const bParcel = addNode('ask_short', 1460, 280, { name: 'Parcel Specs', questionType: 'short', question: 'Tell us about the parcel — item type, approximate weight (kg), and dimensions (L×W×H cm).', saveAs: 'parcel_specs' })
  const bService = addNode('quick_replies', 1740, 280, { name: 'Booking Service Type', message: "Which service would you like?", buttons: [{ id: '1', label: 'Standard' }, { id: '2', label: 'Express' }] })
  const bSummary = addNode('send_text', 2020, 280, { name: 'Booking Summary', message: "Here's your booking summary: pickup → delivery, parcel details, and service level. Estimated rate: ₹{{rate}}. Ready to pay?" })
  const bPay = addNode('quick_replies', 2300, 280, { name: 'Payment Method', message: 'How would you like to pay?', buttons: [{ id: '1', label: 'Wallet' }, { id: '2', label: 'Payment Gateway' }] })
  const bWalletCheck = addNode('condition', 2580, 180, { name: 'Check Wallet Balance', variable: 'wallet_balance_sufficient', operator: 'equals', value: 'yes', trueLabel: 'Yes', falseLabel: 'No' })
  const bGateway = addNode('send_text', 2580, 380, { name: 'Payment Gateway Redirect', message: 'Redirecting you to our secure payment page to complete your booking… 💳' })
  const bDeduct = addNode('send_text', 2860, 180, { name: 'Deduct Wallet Funds', message: 'Done! ₹{{amount}} has been deducted from your wallet balance.' })
  const bConfirm = addNode('send_text', 3140, 280, { name: 'Booking Reference', message: "You're booked! 📦 Your reference ID is BK-{{ref}} — we'll notify you once it's picked up." })
  const bNextSlot = addNode('quick_replies', 3420, 280, { name: 'Schedule Pickup Now?', message: 'Would you like to schedule the pickup now?', buttons: [{ id: '1', label: 'Yes, schedule now' }, { id: '2', label: 'Not now' }] })

  /* ── Module 2: Freight Calculation ── */
  const fRoute = addNode('ask_short', 340, 560, { name: 'Freight Route', questionType: 'short', question: "Let's calculate freight charges. What's the origin and destination? (PIN code or city for both)", saveAs: 'freight_route' })
  const fSpecs = addNode('ask_short', 620, 560, { name: 'Freight Specs', questionType: 'short', question: "What's the shipment's weight (kg) and dimensions (L×W×H cm)?", saveAs: 'freight_specs' })
  const fService = addNode('quick_replies', 900, 560, { name: 'Freight Service Type', message: 'Which service type should we quote?', buttons: [{ id: '1', label: 'Standard' }, { id: '2', label: 'Express' }] })
  const fQuote = addNode('send_text', 1180, 560, { name: 'Freight Estimate', message: "Here's your instant estimate: ₹{{estimate}} for this route and service level." })
  const fProceed = addNode('quick_replies', 1460, 560, { name: 'Proceed to Book?', message: 'Would you like to go ahead and book this shipment?', buttons: [{ id: '1', label: 'Yes, book it' }, { id: '2', label: 'Not right now' }] })

  /* ── Module 3: Schedule Shipping ── */
  const sRef = addNode('ask_short', 340, 760, { name: 'Booking Reference', questionType: 'short', question: 'Which booking would you like to schedule? Select an active booking or enter its reference ID.', saveAs: 'schedule_ref' })
  const sDate = addNode('ask_date', 620, 760, { name: 'Pickup Date', questionType: 'date', question: 'What date works for the pickup?', saveAs: 'pickup_date' })
  const sTime = addNode('ask_time', 900, 760, { name: 'Pickup Time Window', questionType: 'time', question: 'And what time window suits you best?', saveAs: 'pickup_time' })
  const sConfirm = addNode('send_text', 1180, 760, { name: 'Schedule Confirmed', message: "All set! Your pickup is scheduled — we've sent you a confirmation with the window we've locked in. ✅" })

  /* ── Module 4: Track Shipment ── */
  const tInput = addNode('ask_short', 340, 960, { name: 'Tracking Reference', questionType: 'short', question: "Sure — what's your tracking or booking reference ID?", saveAs: 'tracking_ref' })
  const tValidate = addNode('condition', 620, 960, { name: 'Validate Reference', variable: 'tracking_ref_valid', operator: 'equals', value: 'yes', trueLabel: 'Valid Reference', falseLabel: 'Invalid Reference' })
  const tDisplay = addNode('send_text', 900, 870, { name: 'Live Shipment Status', message: 'Your shipment is currently in transit 🚚 — here’s the live status, last known location, and delivery milestones.' })
  const tRetry = addNode('send_text', 900, 1070, { name: 'Tracking Error', message: "Hmm, we couldn't find that reference. Please double-check the ID, or I can connect you with support if you'd like." })

  /* ── Module 5: Wallet Management ── */
  const wBal = addNode('send_text', 340, 1180, { name: 'Wallet Balance', message: 'Your current wallet balance is ₹{{balance}}.' })
  const wAction = addNode('quick_replies', 620, 1180, { name: 'Wallet Action', message: 'What would you like to do?', buttons: [{ id: '1', label: 'Top-up Wallet' }, { id: '2', label: 'Transaction History' }, { id: '3', label: 'Back to Menu' }] })
  const wAmount = addNode('ask_number', 900, 1090, { name: 'Top-up Amount', questionType: 'number', question: 'How much would you like to add?', saveAs: 'topup_amount' })
  const wPay = addNode('send_text', 1180, 1090, { name: 'Wallet Payment Link', message: "Here's your secure payment link to complete the top-up 💳" })
  const wSuccess = addNode('send_text', 1460, 1090, { name: 'Wallet Credited', message: 'Payment received! Your wallet has been credited and you’re all set. 🎉' })
  const wHist = addNode('send_text', 900, 1270, { name: 'Transaction History', message: 'Here are your recent transactions — debits and credits from the last 30 days.' })

  /* ── Module 6: Manage Address ── */
  const aAction = addNode('quick_replies', 340, 1400, { name: 'Address Action', message: "Let's manage your saved addresses. What would you like to do?", buttons: [{ id: '1', label: 'View Addresses' }, { id: '2', label: 'Add New' }, { id: '3', label: 'Edit / Delete' }] })
  const aList = addNode('send_text', 620, 1310, { name: 'List Addresses', message: 'Here are all your saved locations 📍' })
  const aAdd = addNode('ask_form', 620, 1400, { name: 'Add Address', questionType: 'form', question: "Let's save a new address — fill in the details below.", saveAs: 'new_address', formFields: addrFields('addr') })
  const aSave = addNode('send_text', 900, 1400, { name: 'Address Saved', message: 'Saved! That address is now in your profile for next time.' })
  const aModify = addNode('ask_short', 620, 1490, { name: 'Select Address to Modify', questionType: 'short', question: 'Which saved address would you like to update or remove?', saveAs: 'address_to_modify' })
  const aUpdate = addNode('send_text', 900, 1490, { name: 'Address Updated', message: 'Done — that address has been updated.' })

  /* ── End Navigation hub + shared jump nodes ──
     One jump node per distinct target, reused by every source edge that
     needs it — e.g. every module's terminal step points at the same
     `jToEndNav` node instead of each getting its own. */
  const endNav = addNode('quick_replies', 620, 1650, { name: 'Next Action?', message: 'Anything else I can help with?', buttons: [{ id: '1', label: 'Main Menu' }, { id: '2', label: 'End Chat' }, { id: '3', label: 'Agent Escalation' }] })
  const jToEndNav = addNode('jump', 340, 1650, { name: 'Back to End Navigation', targetNodeId: endNav })
  const jToMainMenu = addNode('jump', 900, 1650, { name: 'Back to Main Menu', targetNodeId: mainMenu })
  const jToSDate = addNode('jump', 1180, 1650, { name: 'Go to Schedule Pickup', targetNodeId: sDate })
  const jToBPickup = addNode('jump', 1460, 1650, { name: 'Go to Courier Booking', targetNodeId: bPickup })
  const close = addNode('end', 620, 1830, { name: 'Session Closed', endMessage: 'Thanks for chatting with us today — have a great day! 👋' })
  const escalation = addNode('live_chat', 900, 1830, { name: 'Handover to Support', note: 'Visitor requested a human agent from the End Navigation menu.' })

  /* ── Main Menu option 7: jumps into the "Question Types Test" Subflow —
     a QA/demo entry point exercising all 26 Ask-Question controls, reusing
     buildQuestionTypesTestFlow() (still defined below, just no longer the
     Main Flow's own content since it became this courier bot). The target
     subflow's id ('qtypes') is assigned when seedFlows() builds it. */
  const testQuestions = addNode('goto_subflow', 1180, 40, { name: 'Test All Question Types', subflowId: 'qtypes' })

  /* ── wiring ── */
  // Module 1
  addEdge(bPickup, 0, bSavedPick); addEdge(bPickup, 1, bNewPick)
  addEdge(bSavedPick, 0, bDrop); addEdge(bNewPick, 0, bDrop)
  addEdge(bDrop, 0, bSavedDrop); addEdge(bDrop, 1, bNewDrop)
  addEdge(bSavedDrop, 0, bParcel); addEdge(bNewDrop, 0, bParcel)
  addEdge(bParcel, 0, bService)
  addEdge(bService, 0, bSummary); addEdge(bService, 1, bSummary)
  addEdge(bSummary, 0, bPay)
  addEdge(bPay, 0, bWalletCheck); addEdge(bPay, 1, bGateway)
  addEdge(bWalletCheck, 0, bDeduct); addEdge(bWalletCheck, 1, bGateway)
  addEdge(bDeduct, 0, bConfirm); addEdge(bGateway, 0, bConfirm)
  addEdge(bConfirm, 0, bNextSlot)
  addEdge(bNextSlot, 0, jToSDate); addEdge(bNextSlot, 1, jToEndNav)

  // Module 2
  addEdge(mainMenu, 1, fRoute)
  addEdge(fRoute, 0, fSpecs); addEdge(fSpecs, 0, fService)
  addEdge(fService, 0, fQuote); addEdge(fService, 1, fQuote)
  addEdge(fQuote, 0, fProceed)
  addEdge(fProceed, 0, jToBPickup); addEdge(fProceed, 1, jToEndNav)

  // Module 3
  addEdge(mainMenu, 2, sRef)
  addEdge(sRef, 0, sDate); addEdge(sDate, 0, sTime); addEdge(sTime, 0, sConfirm)
  addEdge(sConfirm, 0, jToEndNav)

  // Module 4
  addEdge(mainMenu, 3, tInput)
  addEdge(tInput, 0, tValidate)
  addEdge(tValidate, 0, tDisplay); addEdge(tValidate, 1, tRetry)
  addEdge(tDisplay, 0, jToEndNav); addEdge(tRetry, 0, jToEndNav)

  // Module 5
  addEdge(mainMenu, 4, wBal)
  addEdge(wBal, 0, wAction)
  addEdge(wAction, 0, wAmount); addEdge(wAction, 1, wHist); addEdge(wAction, 2, jToEndNav)
  addEdge(wAmount, 0, wPay); addEdge(wPay, 0, wSuccess)
  addEdge(wSuccess, 0, jToEndNav); addEdge(wHist, 0, jToEndNav)

  // Module 6
  addEdge(mainMenu, 5, aAction)
  addEdge(aAction, 0, aList); addEdge(aAction, 1, aAdd); addEdge(aAction, 2, aModify)
  addEdge(aList, 0, jToEndNav)
  addEdge(aAdd, 0, aSave); addEdge(aSave, 0, jToEndNav)
  addEdge(aModify, 0, aUpdate); addEdge(aUpdate, 0, jToEndNav)

  // Module 1's own entry edge from the Main Menu
  addEdge(mainMenu, 0, bPickup)
  // Option 7: Test All Questions
  addEdge(mainMenu, 6, testQuestions)

  // End Navigation hub
  addEdge(endNav, 0, jToMainMenu); addEdge(endNav, 1, close); addEdge(endNav, 2, escalation)

  return { nodes, edges }
}

/* ─── the one Main Flow ────────────────────────────────────────────────
   Exactly one bot per channel, exactly one trigger: a single keyword
   Trigger node ("hi"/"menu"/etc.) feeding straight into the courier/
   logistics bot graph above. No pre-seeded Subflows — "Go to Subflow"/
   "Create Subflow" stay fully functional for whatever the user builds
   on their own. ── */
function seedMainFlow() {
  const bot = buildCourierBotFlow()
  const start = { id: 'trigger', type: 'start', x: 40, y: 40, data: { name: 'Courier Bot Welcome', trigger: 'keyword', keywords: 'hi, menu, hello, start', pageUrl: '', idleSeconds: 30 } }
  const firstNode = bot.nodes[0]
  const nodes = [start, ...bot.nodes]
  const edges = [
    { id: 'e-trigger', fromId: start.id, fromPort: 0, toId: firstNode.id },
    ...bot.edges,
  ]
  return { nodes, edges }
}

function seedFlows() {
  const mainFlow = {
    id: 'main', kind: 'main', name: 'Main Flow', active: true,
    trigger: 'Hi / Menu',
    graph: seedMainFlow(),
    stats: { triggered: 1240, completed: 918 },
  }
  // Reached from Main Menu option 7 ("🧪 Test All Questions") via
  // goto_subflow — exercises every one of the 26 Ask-Question controls
  // back-to-back. `buildQuestionTypesTestFlow()` is defined further down
  // this file; it has no trigger of its own (subflows never do — entry is
  // whatever "Go to Subflow" jumps into it).
  const qTypesFlow = {
    id: 'qtypes', kind: 'subflow', name: 'Question Types Test (All 26)', active: true,
    graph: buildQuestionTypesTestFlow(),
    stats: { triggered: 0, completed: 0 },
  }
  return [mainFlow, qTypesFlow]
}

/* Hand-written prompt text per question type — realistic bot copy rather than
   a generic "test X" placeholder, so this reads like a real flow and not just
   a QA harness. */
const QUESTION_PROMPTS = {
  short:             "What's your name?",
  long:              "Tell us a bit more about what you need help with.",
  number:            'How many seats do you need?',
  email:             "What's your email address?",
  phone:             "What's the best number to reach you on?",
  url:               "What's your website URL?",
  single:            'Which plan are you interested in?',
  multi:             'Which features matter most to you?',
  dropdown:          'Which country are you in?',
  yesno:             'Are you an existing customer?',
  rating:            'How would you rate your experience so far?',
  nps:               'How likely are you to recommend us to a friend? (0–10)',
  date:              'When would you like to schedule a call?',
  daterange:         'What date range works for your trial?',
  time:              'What time works best for a callback?',
  appt:              'Pick a slot for your demo',
  prechat:           'Before we start, may we have your details?',
  file:              'Could you upload your latest invoice?',
  image:             'Share a screenshot of the issue you\'re seeing',
  signature:         'Please sign below to confirm',
  location:          "What's your delivery address?",
  payment:           'Enter your card details to upgrade',
  otp:               'Enter the 6-digit code we just sent you',
  form:              "Let's grab a few details in one go",
  carousel:          'Check out our top products',
  carousel_buttons:  'Pick an option below',
  catalog:           'Browse our catalog and add something to your cart',
  shipment_booking:     "Let's get your courier booked — pickup, delivery and parcel details in one go:",
  shipment_calculation: "Let's work out a shipping estimate — pickup, delivery and parcel details:",
}

/* ─── Question Types Test flow — one "ask_<id>" node per entry in Web Chat's
   own QUESTION_TYPES catalog (imported, not hand-copied), chained start→end
   in a snake-grid layout so opening the canvas exercises literally every
   question type in one run and can't silently drift out of sync with the
   catalog if a type is ever added/removed there. ── */
function buildQuestionTypesTestFlow() {
  const PER_ROW = 6, COL_GAP = 260, ROW_GAP = 150, GRID_LEFT = 40, GRID_TOP = 40
  const nodes = []
  const edges = []
  let prevId = null

  WEBCHAT_QUESTION_TYPES.forEach((q, i) => {
    const row      = Math.floor(i / PER_ROW)
    const ltr      = row % 2 === 0
    const colInRow = ltr ? (i % PER_ROW) : (PER_ROW - 1 - (i % PER_ROW))
    const id = `n${i + 1}`
    nodes.push({
      id, type: `ask_${q.id}`,
      x: GRID_LEFT + colInRow * COL_GAP, y: GRID_TOP + row * ROW_GAP,
      data: { name: q.name, questionType: q.id, question: QUESTION_PROMPTS[q.id] || `Try it: ${q.name}`, saveAs: q.id },
    })
    if (prevId) edges.push({ id: `e${i}`, fromId: prevId, fromPort: 0, toId: id })
    prevId = id
  })

  const lastRow = Math.floor((WEBCHAT_QUESTION_TYPES.length - 1) / PER_ROW)
  const endId = `n${WEBCHAT_QUESTION_TYPES.length + 1}`
  nodes.push({
    id: endId, type: 'end',
    x: GRID_LEFT, y: GRID_TOP + (lastRow + 1) * ROW_GAP,
    data: { name: 'End', endMessage: "That's every question type — thanks for helping us test! 🎉" },
  })
  edges.push({ id: `e${WEBCHAT_QUESTION_TYPES.length}`, fromId: prevId, fromPort: 0, toId: endId })

  return { nodes, edges }
}
export const INITIAL_FLOWS = seedFlows()

/* ─── node card (SVG) ─────────────────────────────────────────────────── */
function NodeCard({ node, selected, onSelect, onDragStart, onPortMouseDown, isConnectTarget, connecting }) {
  const def = DEFS[node.type] || { label: node.type, icon: Zap, color: '#0066ff' }
  const Icon = def.icon
  const ports = getOutputPorts(node)
  const canReceive = connecting && connecting.fromId !== node.id

  return (
    <g transform={`translate(${node.x},${node.y})`} style={{ cursor: 'grab', userSelect: 'none' }}
      onMouseDown={e => { e.stopPropagation(); if (!connecting) onDragStart(e, node.id) }}
      onClick={e => { e.stopPropagation(); if (!connecting) onSelect(node.id) }}>
      <rect x={2} y={4} width={NODE_W} height={NODE_H} rx={10} fill="rgba(0,0,0,0.07)"/>
      <rect x={0} y={0} width={NODE_W} height={NODE_H} rx={10} fill="#fff"
        stroke={isConnectTarget ? '#0066ff' : selected ? '#0066ff' : '#e5e7eb'}
        strokeWidth={isConnectTarget ? 2.5 : selected ? 2 : 1}/>
      {isConnectTarget && <rect x={-3} y={-3} width={NODE_W + 6} height={NODE_H + 6} rx={13} fill="none" stroke="#0066ff" strokeWidth={1.5} opacity={0.25}/>}
      <rect x={0} y={0} width={5} height={NODE_H} rx={4} fill={def.color}/>
      <rect x={3} y={0} width={2} height={NODE_H} fill={def.color}/>
      <circle cx={30} cy={NODE_H / 2} r={16} fill={def.color + '1a'}/>
      <foreignObject x={22} y={NODE_H / 2 - 9} width={18} height={18}>
        <Icon size={16} color={def.color}/>
      </foreignObject>
      <text x={55} y={NODE_H / 2 - 7} fontSize={12} fontWeight={700} fill="#111827" dominantBaseline="middle">
        {(node.data?.name || def.label).slice(0, 20)}
      </text>
      <text x={55} y={NODE_H / 2 + 9} fontSize={10} fill="#9ca3af" dominantBaseline="middle">
        {def.label}
      </text>
      <circle cx={0} cy={NODE_H / 2} r={PORT_R}
        fill={isConnectTarget ? '#0066ff' : '#fff'}
        stroke={isConnectTarget ? '#0066ff' : '#d1d5db'}
        strokeWidth={1.5}
        style={{ cursor: canReceive ? 'crosshair' : 'default', pointerEvents: canReceive ? 'all' : 'none' }}/>
      <circle cx={0} cy={NODE_H / 2} r={3} fill={isConnectTarget ? '#fff' : '#9ca3af'} style={{ pointerEvents: 'none' }}/>
      {ports.map((p, i) => {
        const py = ports.length === 1 ? NODE_H / 2 : (NODE_H / (ports.length + 1)) * (i + 1)
        return (
          <g key={i}>
            <circle cx={NODE_W} cy={py} r={PORT_R + 5} fill="transparent" style={{ cursor: 'crosshair' }}
              onMouseDown={e => { e.stopPropagation(); onPortMouseDown && onPortMouseDown(e, node.id, i) }}/>
            <circle cx={NODE_W} cy={py} r={PORT_R} fill={def.color} stroke="#fff" strokeWidth={1.5} style={{ cursor: 'crosshair', pointerEvents: 'none' }}/>
            <circle cx={NODE_W} cy={py} r={3} fill="#fff" style={{ pointerEvents: 'none' }}/>
            {ports.length > 1 && (
              <text x={NODE_W - 10} y={py} fontSize={9} fill="#6b7280" textAnchor="end" dominantBaseline="middle" style={{ pointerEvents: 'none' }}>
                {p.label.slice(0, 14)}
              </text>
            )}
          </g>
        )
      })}
      {selected && <rect x={0} y={0} width={NODE_W} height={NODE_H} rx={10} fill="none" stroke="#0066ff" strokeWidth={2} opacity={0.3} style={{ pointerEvents: 'none' }}/>}
    </g>
  )
}

/* ─── left block-library palette ──────────────────────────────────────── */
function LeftPalette({ onAdd, nodeCount }) {
  const [q, setQ] = useState('')
  const [openCat, setOpenCat] = useState('send')
  const filtered = q ? Object.entries(DEFS).filter(([, d]) => d.label.toLowerCase().includes(q.toLowerCase())) : null

  return (
    <div className="w-56 flex-shrink-0 bg-white border-r border-surface-border flex flex-col overflow-hidden">
      <div className="p-2.5 border-b border-surface-border flex-shrink-0">
        <div className="relative">
          <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"/>
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search nodes..."
            className="w-full pl-7 pr-3 py-1.5 text-[11px] border border-surface-border rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-primary/15 focus:border-primary/40 transition-all"/>
        </div>
        <div className="flex items-center justify-between mt-1.5 px-0.5">
          <span className="text-[10px] text-slate-400">Nodes</span>
          <span className="text-[10px] font-bold text-slate-400">{nodeCount}/{MAX_NODES}</span>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto">
        {filtered ? (
          <div className="p-1.5 space-y-0.5">
            {filtered.map(([type, def]) => {
              const Icon = def.icon
              return (
                <button key={type} onClick={() => nodeCount < MAX_NODES && onAdd(type)} disabled={nodeCount >= MAX_NODES}
                  className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-slate-50 transition-colors text-left disabled:opacity-40">
                  <div className="w-6 h-6 rounded-md flex items-center justify-center flex-shrink-0" style={{ background: def.color + '18' }}>
                    <Icon size={12} style={{ color: def.color }}/>
                  </div>
                  <span className="text-[11px] font-medium text-slate-700 truncate">{def.label}</span>
                </button>
              )
            })}
            {filtered.length === 0 && <p className="text-[11px] text-slate-400 text-center py-4">No nodes found</p>}
          </div>
        ) : (
          CAT_ORDER.map(cat => {
            const catNodes = Object.entries(DEFS).filter(([, d]) => d.cat === cat)
            const isOpen = openCat === cat
            return (
              <div key={cat}>
                <button onClick={() => setOpenCat(isOpen ? null : cat)}
                  className="w-full flex items-center justify-between px-3 py-2 hover:bg-slate-50 transition-colors border-b border-surface-border">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full" style={{ background: CAT_COLOR[cat] }}/>
                    <span className="text-[11px] font-bold text-slate-600">{CAT_LABELS[cat]}</span>
                    <span className="text-[10px] text-slate-400 bg-slate-100 rounded-full px-1.5">{catNodes.length}</span>
                  </div>
                  {isOpen ? <ChevronUp size={11} className="text-slate-400"/> : <ChevronDown size={11} className="text-slate-400"/>}
                </button>
                {isOpen && (
                  <div className="p-1.5 bg-slate-50/50 space-y-0.5">
                    {catNodes.map(([type, def]) => {
                      const Icon = def.icon
                      return (
                        <button key={type} onClick={() => nodeCount < MAX_NODES && onAdd(type)} disabled={nodeCount >= MAX_NODES}
                          className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-white transition-colors text-left disabled:opacity-40 border border-transparent hover:border-surface-border">
                          <div className="w-5 h-5 rounded flex items-center justify-center flex-shrink-0" style={{ background: def.color + '18' }}>
                            <Icon size={11} style={{ color: def.color }}/>
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

/* ─── minimap ──────────────────────────────────────────────────────────── */
function Minimap({ nodes, edges, zoom, pan, svgRef }) {
  const MM_W = 160, MM_H = 110
  if (!nodes.length) return null
  const xs = nodes.map(n => n.x), ys = nodes.map(n => n.y)
  const minX = Math.min(...xs) - 20, minY = Math.min(...ys) - 20
  const maxX = Math.max(...xs) + NODE_W + 20, maxY = Math.max(...ys) + NODE_H + 20
  const w = maxX - minX || 1, h = maxY - minY || 1
  const s = Math.min(MM_W / w, MM_H / h, 1)
  const tx = n => (n.x - minX) * s
  const ty = n => (n.y - minY) * s
  let vpX = 0, vpY = 0, vpW = MM_W, vpH = MM_H
  if (svgRef?.current) {
    const r = svgRef.current.getBoundingClientRect()
    const vx = (-pan.x) / zoom, vy = (-pan.y) / zoom
    const vw = r.width / zoom, vh = r.height / zoom
    vpX = (vx - minX) * s; vpY = (vy - minY) * s; vpW = vw * s; vpH = vh * s
  }
  return (
    <div className="absolute bottom-4 right-4 z-20 bg-white border border-surface-border rounded-xl shadow-md overflow-hidden" style={{ width: MM_W + 8, height: MM_H + 8 }}>
      <svg width={MM_W} height={MM_H} style={{ display: 'block', margin: 4 }}>
        {edges.map(e => {
          const from = nodes.find(n => n.id === e.fromId), to = nodes.find(n => n.id === e.toId)
          if (!from || !to) return null
          return <line key={e.id} x1={tx(from) + NODE_W * s} y1={ty(from) + NODE_H / 2 * s} x2={tx(to)} y2={ty(to) + NODE_H / 2 * s} stroke="#cbd5e1" strokeWidth={1}/>
        })}
        {nodes.map(n => {
          const def = DEFS[n.type] || {}
          return <rect key={n.id} x={tx(n)} y={ty(n)} width={Math.max(NODE_W * s, 4)} height={Math.max(NODE_H * s, 3)} rx={2} fill={def.color || '#94a3b8'} opacity={0.7}/>
        })}
        <rect x={vpX} y={vpY} width={vpW} height={vpH} fill="none" stroke="#0066ff" strokeWidth={1.5} strokeDasharray="3,2" opacity={0.6}/>
      </svg>
    </div>
  )
}

/* ─── node properties editor (modal) — lean, per-type field sets ───────── */
/* ─── multi-field Form node: per-field editor (label/type/options/enabled) ──
   The 3 default fields (name/email/phone) can be relabelled and toggled off
   but never deleted — same "required, can't remove" convention as the
   Widget Tabs list's `always` rows in WebChatAppearance.jsx. Custom fields
   the author adds (text or dropdown) can be freely deleted. ── */
const DEFAULT_FORM_FIELD_IDS = new Set(DEFAULT_FORM_FIELDS.map(f => f.id))
/* OTP node config — both the resend countdown and the resend option itself
   are independently optional, so a flow author can turn either off (e.g. a
   flat "Resend code" with no wait, or just a countdown with no resend at
   all). Defaults (timer on, resend on, 30s) match OtpAnswer's own defaults
   in AnswerControls.jsx, used whenever a node hasn't set `otpConfig` yet. */
const DEFAULT_OTP_CONFIG = { showTimer: true, showResend: true, seconds: 30 }
/* ─── Phone question settings ───────────────────────────────────────────
   Countries offered, the default one, and whether to pick the visitor's country from their IP.
   `CountryPicker` is a small searchable dropdown (single or multi). */
function CountryPicker({ multi, value, onChange, options, placeholder }) {
  const [open, setOpen] = useState(false)
  const [q, setQ] = useState('')
  const ref = useRef(null)
  useEffect(() => {
    const onDoc = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [])
  const sel = multi ? value : [value]
  const shown = options.filter(c => !q.trim() || c.name.toLowerCase().includes(q.toLowerCase()) || c.code.toLowerCase() === q.trim().toLowerCase() || c.dial.includes(q.trim()))
  const toggle = (c) => {
    if (multi) onChange(value.includes(c.code) ? value.filter(x => x !== c.code) : [...value, c.code])
    else { onChange(c.code); setOpen(false); setQ('') }
  }
  const one = !multi ? options.find(c => c.code === value) : null
  return (
    <div className="relative" ref={ref}>
      <div role="button" tabIndex={0} onClick={() => setOpen(o => !o)} onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), setOpen(o => !o))}
        className="input flex items-center gap-1.5 flex-wrap min-h-[38px] cursor-pointer pr-8 relative">
        {multi ? (
          value.length === 0
            ? <span className="text-slate-400">{placeholder}</span>
            : value.map(code => {
                const c = COUNTRIES.find(x => x.code === code)
                return c && (
                  <span key={code} className="inline-flex items-center gap-1 text-[10.5px] font-semibold bg-slate-100 text-slate-700 rounded-md pl-1.5 pr-1 py-0.5">
                    {c.flag} {c.code}
                    <button type="button" aria-label={`Remove ${c.name}`} onClick={(e) => { e.stopPropagation(); onChange(value.filter(x => x !== code)) }} className="text-slate-400 hover:text-slate-700"><X size={10}/></button>
                  </span>
                )
              })
        ) : (
          <span className="truncate">{one ? `${one.flag} ${one.name} - ${one.code}` : placeholder}</span>
        )}
        <ChevronDown size={14} className={clsx('absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 transition-transform', open && 'rotate-180')}/>
      </div>
      {open && (
        <div className="absolute left-0 right-0 top-full mt-1 z-40 bg-white rounded-xl border border-surface-border shadow-xl overflow-hidden">
          <div className="flex items-center gap-1.5 px-2.5 py-2 border-b border-surface-border">
            <Search size={12} className="text-slate-400"/>
            <input autoFocus value={q} onChange={e => setQ(e.target.value)} placeholder="Search country or code…" className="flex-1 bg-transparent outline-none text-[11px] text-slate-700 placeholder-slate-400"/>
          </div>
          {multi && (
            <div className="flex items-center justify-between px-3 py-1.5 border-b border-surface-border text-[10px] font-semibold">
              <span className="text-slate-400">{value.length ? `${value.length} selected` : 'All countries allowed'}</span>
              <span className="flex gap-3">
                <button type="button" onClick={() => onChange(options.map(c => c.code))} className="text-primary hover:underline">Select all</button>
                <button type="button" onClick={() => onChange([])} className="text-slate-500 hover:underline">Clear</button>
              </span>
            </div>
          )}
          <div className="max-h-52 overflow-y-auto py-1">
            {shown.length === 0 && <p className="text-[10.5px] text-slate-400 text-center py-3">No match</p>}
            {shown.map(c => {
              const on = sel.includes(c.code)
              return (
                <button key={c.code} type="button" onClick={() => toggle(c)} className={clsx('w-full flex items-center gap-2 px-3 py-1.5 text-left text-[11px] hover:bg-slate-50', on && 'bg-primary/[0.04]')}>
                  <span className={clsx('w-3.5 h-3.5 flex items-center justify-center flex-shrink-0', multi ? 'rounded border' : '', on ? 'bg-primary border-primary text-white' : 'border-slate-300', !multi && 'w-3')}>
                    {on && <Check size={multi ? 10 : 12} className={multi ? '' : 'text-primary'}/>}
                  </span>
                  <span>{c.flag}</span><span className="flex-1 truncate text-slate-700">{c.name}</span><span className="text-slate-400">{c.dial}</span>
                </button>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

function PhoneConfigEditor({ d, set }) {
  const allowed = Array.isArray(d.allowedCountries) ? d.allowedCountries : []
  const pool = allowed.length ? COUNTRIES.filter(c => allowed.includes(c.code)) : COUNTRIES
  const wanted = d.defaultCountry || 'IN'
  const def = pool.some(c => c.code === wanted) ? wanted : pool[0]?.code
  const ip = d.ipDetect === true
  return (
    <>
      <div className="space-y-1">
        <label className="label">Countries list</label>
        <CountryPicker multi value={allowed} onChange={v => set('allowedCountries', v)} options={COUNTRIES} placeholder="All countries"/>
        <p className="text-[10px] text-slate-400 leading-snug">Only these appear in the visitor's country picker. Leave empty to allow every country.</p>
      </div>
      <div className="space-y-1">
        <label className="label">Default country</label>
        <CountryPicker value={def} onChange={v => set('defaultCountry', v)} options={pool} placeholder="Select a country"/>
      </div>
      <div className="space-y-1">
        <label className="label">Show country based on IP address</label>
        <div className="flex items-center gap-2.5 p-2.5 rounded-lg border border-surface-border">
          <button type="button" role="switch" aria-checked={ip} aria-label="Show country based on IP address" onClick={() => set('ipDetect', !ip)}
            className="relative flex-shrink-0 rounded-full transition-colors" style={{ width: 34, height: 18, background: ip ? '#0066ff' : '#d1d5db' }}>
            <span className="absolute rounded-full bg-white shadow transition-all" style={{ top: 2, left: ip ? 18 : 2, width: 14, height: 14 }}/>
          </button>
          <p className="text-[11px] text-slate-500 leading-snug">{ip ? "Preselect the visitor's country from their IP address (if it's in the list)." : 'Do not select country based on IP address — the default country is used.'}</p>
        </div>
      </div>
    </>
  )
}

function OtpConfigEditor({ config, onChange }) {
  const cfg = { ...DEFAULT_OTP_CONFIG, ...config }
  const set = (k, v) => onChange({ ...cfg, [k]: v })
  return (
    <div className="space-y-1.5">
      <label className="label">Resend options</label>
      <p className="text-[9px] text-slate-400 -mt-0.5">Both are optional and can be turned off independently.</p>
      <label className="flex items-center justify-between p-2.5 rounded-xl border border-surface-border">
        <div>
          <span className="text-[12px] font-semibold text-slate-700 block">Show countdown timer</span>
          <span className="text-[9.5px] text-slate-400">e.g. "Resend code in 0:30"</span>
        </div>
        <input type="checkbox" className="w-4 h-4 rounded accent-primary flex-shrink-0" checked={cfg.showTimer} onChange={e => set('showTimer', e.target.checked)}/>
      </label>
      {cfg.showTimer && (
        <div className="space-y-1 pl-1"><label className="label">Countdown duration (seconds)</label>
          <input type="number" min={5} max={300} className="input-sm w-28" value={cfg.seconds}
            onChange={e => set('seconds', Math.max(5, +e.target.value || 5))}/>
        </div>
      )}
      <label className="flex items-center justify-between p-2.5 rounded-xl border border-surface-border">
        <div>
          <span className="text-[12px] font-semibold text-slate-700 block">Allow resend</span>
          <span className="text-[9.5px] text-slate-400">
            {cfg.showTimer ? 'Resend button appears once the countdown reaches 0' : 'Resend button is available immediately'}
          </span>
        </div>
        <input type="checkbox" className="w-4 h-4 rounded accent-primary flex-shrink-0" checked={cfg.showResend} onChange={e => set('showResend', e.target.checked)}/>
      </label>
    </div>
  )
}
/* Style picker for Single/Multiple Choice — CHOICE_STYLES is the single
   source of truth (also drives AnswerControls.jsx's rendering), so this
   picker can never drift out of sync with what a chosen style actually
   looks like. A 2x2 grid of labelled cards rather than a plain dropdown:
   the whole point of the choice is visual, so the picker should read like
   a small preview of the options, not a blind text list. */
function ChoiceStyleEditor({ value, onChange }) {
  return (
    <div className="space-y-1.5">
      <label className="label">Answer layout</label>
      <div className="grid grid-cols-2 gap-1.5">
        {CHOICE_STYLES.map(s => (
          <button key={s.id} type="button" onClick={() => onChange(s.id)}
            className={clsx('flex items-start gap-2 p-2.5 rounded-xl border text-left transition-colors',
              value === s.id ? 'border-primary bg-primary-50' : 'border-surface-border hover:bg-surface-hover')}>
            <s.icon size={13} className={clsx('flex-shrink-0 mt-0.5', value === s.id ? 'text-primary' : 'text-slate-400')}/>
            <span className="min-w-0">
              <span className={clsx('block text-[11px] font-bold', value === s.id ? 'text-primary' : 'text-slate-700')}>{s.label}</span>
              <span className="block text-[9.5px] text-slate-400 leading-snug">{s.desc}</span>
            </span>
          </button>
        ))}
      </div>
    </div>
  )
}
/* Direction picker — Vertical (one option per row) or Horizontal (side by
   side, wraps). Not shown for 'list' (see the caller): a grouped card of
   divided rows has no horizontal equivalent, so the toggle would have
   nothing to do. CHOICE_DIRECTIONS is the same single-source-of-truth
   pattern as CHOICE_STYLES above. */
function ChoiceDirectionEditor({ value, onChange }) {
  return (
    <div className="space-y-1.5">
      <label className="label">Options direction</label>
      <div className="grid grid-cols-2 gap-1.5">
        {CHOICE_DIRECTIONS.map(dir => (
          <button key={dir.id} type="button" onClick={() => onChange(dir.id)}
            className={clsx('flex items-start gap-2 p-2.5 rounded-xl border text-left transition-colors',
              value === dir.id ? 'border-primary bg-primary-50' : 'border-surface-border hover:bg-surface-hover')}>
            <dir.icon size={13} className={clsx('flex-shrink-0 mt-0.5', value === dir.id ? 'text-primary' : 'text-slate-400')}/>
            <span className="min-w-0">
              <span className={clsx('block text-[11px] font-bold', value === dir.id ? 'text-primary' : 'text-slate-700')}>{dir.label}</span>
              <span className="block text-[9.5px] text-slate-400 leading-snug">{dir.desc}</span>
            </span>
          </button>
        ))}
      </div>
    </div>
  )
}
/* Question/answer pairs for the FAQ type. Kept editable inline rather than
   pointing at a separate help-centre store: a bot's FAQ list is usually a
   handful of questions specific to THIS conversation step ("before you book,
   people usually ask…"), not the whole knowledge base. */
function FaqItemsEditor({ items, onChange, d, set }) {
  const update = (id, patch) => onChange(items.map(f => f.id === id ? { ...f, ...patch } : f))
  const remove = id => onChange(items.filter(f => f.id !== id))
  const add = () => onChange([...items, { id: `faq_${Date.now()}`, q: '', a: '' }])
  return (
    <div className="space-y-1.5">
      <label className="label">Questions &amp; answers</label>
      {items.length === 0 && (
        <p className="text-[10px] text-slate-400">No questions yet — the preview falls back to three samples until you add some.</p>
      )}
      <div className="space-y-2">
        {items.map((f, i) => (
          <div key={f.id} className="p-2.5 rounded-xl border border-surface-border space-y-1.5">
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] font-bold text-slate-400 w-4 flex-shrink-0">{i + 1}</span>
              <input className="input-sm flex-1" placeholder="Question" value={f.q || ''}
                onChange={e => update(f.id, { q: e.target.value })}/>
              <button onClick={() => remove(f.id)} className="p-1 text-slate-400 hover:text-red-500 flex-shrink-0"><X size={13}/></button>
            </div>
            <textarea className="textarea text-[11px]" rows={2} placeholder="Answer" value={f.a || ''}
              onChange={e => update(f.id, { a: e.target.value })}/>
          </div>
        ))}
      </div>
      <button onClick={add} className="text-[11px] text-primary font-semibold hover:underline flex items-center gap-1">
        <Plus size={11}/> Add question
      </button>
      <div className="grid grid-cols-2 gap-2 pt-1">
        <div className="space-y-1"><label className="label">Done button</label>
          <input className="input" value={d.doneLabel || ''} onChange={e => set('doneLabel', e.target.value)} placeholder="That answers it"/>
        </div>
        <div className="space-y-1"><label className="label">Escape hatch</label>
          <input className="input" value={d.skipLabel || ''} onChange={e => set('skipLabel', e.target.value)} placeholder="None of these"/>
        </div>
      </div>
    </div>
  )
}

function FormFieldsEditor({ fields, onChange }) {
  const update = (id, patch) => onChange(fields.map(f => f.id === id ? { ...f, ...patch } : f))
  const remove = id => onChange(fields.filter(f => f.id !== id))
  const addField = type => onChange([...fields, {
    id: `field_${Date.now()}`,
    label: FORM_FIELD_TYPES.find(t => t.id === type)?.label || 'New field',
    type, enabled: true, required: false,
    options: FORM_TYPES_WITH_OPTIONS.has(type) ? ['Option A', 'Option B'] : undefined,
  }])
  return (
    <div className="space-y-1.5">
      <label className="label">Form fields</label>
      <p className="text-[9px] text-slate-400 -mt-0.5">Toggle a field off to hide it from the widget's form. The 3 default fields can be disabled but not removed.</p>
      <div className="space-y-2">
        {fields.map(f => {
          const isDefault = DEFAULT_FORM_FIELD_IDS.has(f.id)
          return (
            <div key={f.id} className="p-2.5 rounded-xl border border-surface-border space-y-1.5" style={{ opacity: f.enabled === false ? 0.55 : 1 }}>
              <div className="flex items-center gap-1.5">
                <input className="input-sm flex-1" value={f.label} placeholder="Field label"
                  onChange={e => update(f.id, { label: e.target.value })}/>
                {isDefault ? (
                  <span className="text-[9px] font-semibold text-slate-400 px-1.5 flex-shrink-0">
                    {f.type === 'phone' ? 'Phone' : f.type === 'email' ? 'Email' : 'Text'} · required
                  </span>
                ) : (
                  <div className="flex-shrink-0" style={{ width: 96 }}>
                    <NativeSelect sm value={f.type} onChange={e => {
                      const type = e.target.value
                      update(f.id, {
                        type,
                        options: FORM_TYPES_WITH_OPTIONS.has(type)
                          ? (f.options && f.options.length ? f.options : ['Option A', 'Option B'])
                          : undefined,
                      })
                    }}>
                      {FORM_FIELD_TYPES.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
                    </NativeSelect>
                  </div>
                )}
                <label className="flex items-center flex-shrink-0" title={f.enabled === false ? 'Enable field' : 'Disable field'}>
                  <input type="checkbox" className="w-4 h-4 rounded accent-primary" checked={f.enabled !== false}
                    onChange={e => update(f.id, { enabled: e.target.checked })}/>
                </label>
                {!isDefault && (
                  <button onClick={() => remove(f.id)} className="p-1 text-slate-400 hover:text-red-500 flex-shrink-0"><X size={13}/></button>
                )}
              </div>
              {FORM_TYPES_WITH_OPTIONS.has(f.type) && (
                <input className="input-sm w-full" placeholder="Comma-separated options, e.g. Small, Medium, Large"
                  value={(f.options || []).join(', ')}
                  onChange={e => update(f.id, { options: e.target.value.split(',').map(s => s.trim()).filter(Boolean) })}/>
              )}
              {f.type === 'checkbox' && (
                <input className="input-sm w-full" placeholder="Consent wording, e.g. I agree to be contacted about my enquiry"
                  value={f.text || ''} onChange={e => update(f.id, { text: e.target.value })}/>
              )}
              {f.type === 'number' && (
                <div className="grid grid-cols-2 gap-1.5">
                  <input className="input-sm" placeholder="Min" value={f.min ?? ''} onChange={e => update(f.id, { min: e.target.value })}/>
                  <input className="input-sm" placeholder="Max" value={f.max ?? ''} onChange={e => update(f.id, { max: e.target.value })}/>
                </div>
              )}
              {!isDefault && (
                <label className="flex items-center gap-1.5 text-[10px] font-semibold text-slate-500 select-none">
                  <input type="checkbox" className="w-3.5 h-3.5 rounded accent-primary" checked={Boolean(f.required)}
                    onChange={e => update(f.id, { required: e.target.checked })}/>
                  Required
                </label>
              )}
            </div>
          )
        })}
      </div>
      <div className="flex gap-2">
        <button onClick={() => addField('text')} className="text-[11px] text-primary font-semibold hover:underline flex items-center gap-1"><Plus size={11}/> Add field</button>
        <span className="text-[10px] text-slate-400 self-center">then pick its type on the row</span>
      </div>
    </div>
  )
}

function NodeEditModal({ node, onChange, onDelete, onClose, allNodes, subflowOptions }) {
  const def = DEFS[node.type] || { label: node.type, icon: Zap, color: '#0066ff', cat: 'system' }
  const Icon = def.icon
  const catColor = CAT_COLOR[def.cat] || '#0066ff'
  const [local, setLocal] = useState(node)
  useEffect(() => { setLocal(node) }, [node.id])
  const d = local.data || {}
  const set = (k, v) => setLocal(n => ({ ...n, data: { ...n.data, [k]: v } }))
  const save = () => { onChange(local); onClose() }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(15,23,42,0.45)', backdropFilter: 'blur(4px)' }}
      onMouseDown={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md flex flex-col overflow-hidden max-h-[85vh]">
        <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: catColor + '15', border: `1.5px solid ${catColor}25` }}>
              <Icon size={14} style={{ color: catColor }}/>
            </div>
            <div className="min-w-0">
              <p className="text-xs font-bold text-slate-900 truncate">{def.label}</p>
              <span className="text-[9px] font-semibold rounded-full px-1.5 py-0.5" style={{ color: catColor, background: catColor + '15' }}>{CAT_LABELS[def.cat]}</span>
            </div>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-surface-hover text-slate-400 flex-shrink-0"><X size={15}/></button>
        </div>

        <div className="p-4 space-y-3 overflow-y-auto">
          <div className="space-y-1">
            <label className="label">Node name</label>
            <input className="input" value={d.name || ''} onChange={e => set('name', e.target.value)}/>
          </div>

          {node.type === 'start' && (
            <>
              <div className="space-y-1">
                <label className="label">Trigger</label>
                <div className="grid grid-cols-2 gap-1.5">
                  {TRIGGER_TYPES.map(t => (
                    <button key={t.v} onClick={() => set('trigger', t.v)}
                      className={clsx('flex items-center gap-1.5 px-2 py-1.5 rounded-lg border text-[11px] font-semibold transition-colors',
                        d.trigger === t.v ? 'border-primary bg-primary-50 text-primary' : 'border-surface-border text-slate-600 hover:bg-surface-hover')}>
                      <t.icon size={11}/> {t.l}
                    </button>
                  ))}
                </div>
              </div>
              {d.trigger === 'page_visit' && (
                <div className="space-y-1"><label className="label">Page URL contains</label>
                  <input className="input" placeholder="e.g. /pricing" value={d.pageUrl || ''} onChange={e => set('pageUrl', e.target.value)}/>
                </div>
              )}
              {d.trigger === 'keyword' && (
                <div className="space-y-1"><label className="label">Keywords</label>
                  <input className="input" placeholder="e.g. price, cost, refund" value={d.keywords || ''} onChange={e => set('keywords', e.target.value)}/>
                </div>
              )}
              {d.trigger === 'idle_time' && (
                <div className="space-y-1"><label className="label">Idle for (seconds)</label>
                  <input type="number" className="input" value={d.idleSeconds ?? 30} onChange={e => set('idleSeconds', +e.target.value)}/>
                </div>
              )}
            </>
          )}

          {node.type === 'quick_automation' && (
            <>
              <div className="space-y-1">
                <label className="label">Trigger</label>
                <div className="grid grid-cols-2 gap-1.5">
                  {QUICK_AUTOMATION_TRIGGER_TYPES.map(t => (
                    <button key={t.v} onClick={() => set('trigger', t.v)}
                      className={clsx('flex items-center gap-1.5 px-2 py-1.5 rounded-lg border text-[11px] font-semibold transition-colors',
                        d.trigger === t.v ? 'border-primary bg-primary-50 text-primary' : 'border-surface-border text-slate-600 hover:bg-surface-hover')}>
                      <t.icon size={11}/> {t.l}
                    </button>
                  ))}
                </div>
              </div>
              {d.trigger === 'page_visit' && (
                <div className="space-y-1"><label className="label">Page URL contains</label>
                  <input className="input" placeholder="e.g. /pricing" value={d.pageUrl || ''} onChange={e => set('pageUrl', e.target.value)}/>
                </div>
              )}
              {d.trigger === 'keyword' && (
                <div className="space-y-1"><label className="label">Keywords</label>
                  <input className="input" placeholder="e.g. price, cost, refund" value={d.keywords || ''} onChange={e => set('keywords', e.target.value)}/>
                </div>
              )}
              {d.trigger === 'idle_time' && (
                <div className="space-y-1"><label className="label">Idle for (seconds)</label>
                  <input type="number" className="input" value={d.idleSeconds ?? 30} onChange={e => set('idleSeconds', +e.target.value)}/>
                </div>
              )}
              <div className="space-y-1"><label className="label">Reply message</label>
                <textarea className="textarea" rows={3} placeholder="What the bot instantly replies with" value={d.message || ''} onChange={e => set('message', e.target.value)}/>
              </div>
              <label className="flex items-center justify-between p-2.5 rounded-xl border border-surface-border">
                <span className="text-[12px] font-semibold text-slate-700">Let AI write the reply</span>
                <input type="checkbox" className="w-4 h-4 rounded accent-primary" checked={Boolean(d.aiEnabled)} onChange={e => set('aiEnabled', e.target.checked)}/>
              </label>
              {d.aiEnabled && (
                <div className="space-y-1"><label className="label">AI instructions</label>
                  <textarea className="textarea" rows={2} placeholder="e.g. Mention the 14-day refund window" value={d.aiInstructions || ''} onChange={e => set('aiInstructions', e.target.value)}/>
                </div>
              )}
            </>
          )}

          {node.type === 'end' && (
            <div className="space-y-1"><label className="label">Final message (optional)</label>
              <textarea className="textarea" rows={2} value={d.endMessage || ''} onChange={e => set('endMessage', e.target.value)}/>
            </div>
          )}

          {node.type === 'send_text' && (
            <div className="space-y-1"><label className="label">Message</label>
              <textarea className="textarea" rows={3} value={d.message || ''} onChange={e => set('message', e.target.value)}/>
            </div>
          )}

          {node.type === 'send_location' && (
            <>
              <div className="space-y-1"><label className="label">Place name</label>
                <input className="input" value={d.locLabel || ''} onChange={e => set('locLabel', e.target.value)}
                  placeholder="e.g. Prime Next — MG Road branch"/>
              </div>
              <div className="space-y-1"><label className="label">Address</label>
                <textarea className="textarea" rows={2} value={d.address || ''} onChange={e => set('address', e.target.value)}
                  placeholder="12 MG Road, Bengaluru 560001"/>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1"><label className="label">Latitude</label>
                  <input className="input" value={d.lat || ''} onChange={e => set('lat', e.target.value)} placeholder="12.9752"/>
                </div>
                <div className="space-y-1"><label className="label">Longitude</label>
                  <input className="input" value={d.lng || ''} onChange={e => set('lng', e.target.value)} placeholder="77.6050"/>
                </div>
              </div>
              <p className="text-[10px] text-slate-400 leading-snug">
                Without coordinates the visitor still gets the address and a working
                “Open in Google Maps” link — only the inline map needs them.
              </p>
              <div className="space-y-1"><label className="label">Message above the map (optional)</label>
                <textarea className="textarea" rows={2} value={d.message || ''} onChange={e => set('message', e.target.value)}
                  placeholder="Here's where to drop it off 👇"/>
              </div>
            </>
          )}

          {node.type === 'send_media' && (
            <>
              <div className="space-y-1"><label className="label">Media type</label>
                <NativeSelect sm value={d.mediaType} onChange={e => set('mediaType', e.target.value)}>
                  <option value="image">Image</option><option value="video">Video</option>
                </NativeSelect>
              </div>
              <div className="space-y-1"><label className="label">Caption</label>
                <textarea className="textarea" rows={2} value={d.caption || ''} onChange={e => set('caption', e.target.value)}/>
              </div>
            </>
          )}

          {node.type === 'quick_replies' && (
            <>
              <div className="space-y-1"><label className="label">Message</label>
                <textarea className="textarea" rows={2} value={d.message || ''} onChange={e => set('message', e.target.value)}/>
              </div>
              <div className="space-y-1.5">
                <label className="label">Buttons <span className="text-slate-400 font-normal">(each is a separate output — max 3)</span></label>
                {(d.buttons || []).map((b, i) => (
                  <div key={b.id} className="flex gap-1.5">
                    <input className="input-sm flex-1" placeholder={`Option ${i + 1}`} value={b.label}
                      onChange={e => set('buttons', d.buttons.map(x => x.id === b.id ? { ...x, label: e.target.value } : x))}/>
                    <button onClick={() => set('buttons', d.buttons.filter(x => x.id !== b.id))} className="p-1.5 text-slate-400 hover:text-red-500"><X size={13}/></button>
                  </div>
                ))}
                {(d.buttons || []).length < 3 && (
                  <button onClick={() => set('buttons', [...(d.buttons || []), { id: String(Date.now()), label: '' }])}
                    className="text-[11px] text-primary font-semibold hover:underline flex items-center gap-1"><Plus size={11}/> Add button</button>
                )}
              </div>
            </>
          )}

          {node.type === 'show_article' && (
            <>
              <div className="space-y-1"><label className="label">Article title</label>
                <input className="input" placeholder="e.g. How do refunds work?" value={d.articleTitle || ''} onChange={e => set('articleTitle', e.target.value)}/>
              </div>
              <div className="space-y-1"><label className="label">Article URL / slug</label>
                <input className="input" placeholder="e.g. help/refunds" value={d.articleUrl || ''} onChange={e => set('articleUrl', e.target.value)}/>
              </div>
              <p className="text-[9px] text-slate-400">Opens the widget's Help Center screen directly on this article.</p>
            </>
          )}

          {def.cat === 'ask' && def.questionType && (
            <>
              {def.desc && (
                <div className="flex items-center gap-2 p-2.5 rounded-lg bg-slate-50 border border-surface-border">
                  <Icon size={13} style={{ color: def.color, flexShrink: 0 }}/>
                  <p className="text-[10px] text-slate-500 leading-snug">{def.desc}</p>
                </div>
              )}
              <div className="space-y-1"><label className="label">Question text</label>
                <textarea className="textarea" rows={2} placeholder={`e.g. What's your ${def.label.toLowerCase()}?`} value={d.question || ''} onChange={e => set('question', e.target.value)}/>
              </div>
              <div className="space-y-1"><label className="label">Save answer as</label>
                <input className="input" placeholder="e.g. email" value={d.saveAs || ''} onChange={e => set('saveAs', e.target.value)}/>
              </div>
              {def.questionType === 'phone' && <PhoneConfigEditor d={d} set={set}/>}
              {def.questionType === 'form' && (
                <FormFieldsEditor fields={d.formFields || DEFAULT_FORM_FIELDS} onChange={v => set('formFields', v)}/>
              )}
              {def.questionType === 'otp' && (
                <OtpConfigEditor config={d.otpConfig} onChange={v => set('otpConfig', v)}/>
              )}
              {(def.questionType === 'single' || def.questionType === 'multi') && (
                <>
                  <ChoiceStyleEditor value={d.choiceStyle || 'list'} onChange={v => set('choiceStyle', v)}/>
                  {(d.choiceStyle || 'list') !== 'list' && (
                    <ChoiceDirectionEditor
                      value={d.choiceDirection || CHOICE_DEFAULT_DIRECTION[d.choiceStyle || 'list'] || 'vertical'}
                      onChange={v => set('choiceDirection', v)}/>
                  )}
                </>
              )}

              {def.questionType === 'statement' && (
                <>
                  <div className="space-y-1"><label className="label">Extra detail (optional)</label>
                    <textarea className="textarea" rows={3} value={d.statementText || ''}
                      onChange={e => set('statementText', e.target.value)}
                      placeholder="Shown in a panel under the message — terms, next steps, opening hours…"/>
                  </div>
                  <div className="space-y-1"><label className="label">Button label</label>
                    <input className="input" value={d.continueLabel || ''} onChange={e => set('continueLabel', e.target.value)} placeholder="Continue"/>
                  </div>
                </>
              )}

              {def.questionType === 'faq' && (
                <FaqItemsEditor items={d.faqItems || []} onChange={v => set('faqItems', v)} d={d} set={set}/>
              )}

              {def.questionType === 'ai_answer' && (
                <>
                  <div className="space-y-1"><label className="label">Knowledge base name</label>
                    <input className="input" value={d.kbName || ''} onChange={e => set('kbName', e.target.value)} placeholder="e.g. Help Centre"/>
                  </div>
                  <div className="space-y-1"><label className="label">Fallback when nothing matches</label>
                    <textarea className="textarea" rows={2} value={d.fallback || ''} onChange={e => set('fallback', e.target.value)}
                      placeholder="I don't have that yet — let me pass you to someone who can help."/>
                  </div>
                  <div className="space-y-1"><label className="label">Sample answer (preview only)</label>
                    <textarea className="textarea" rows={2} value={d.sampleAnswer || ''} onChange={e => set('sampleAnswer', e.target.value)}
                      placeholder="What the preview shows in place of a real AI reply"/>
                  </div>
                  <p className="text-[10px] text-slate-400 leading-snug">
                    There is no AI backend wired up yet, so the preview shows the sample answer
                    (or the fallback). Connect the knowledge base to answer for real.
                  </p>
                </>
              )}

              {def.questionType === 'prechat' && (
                <>
                  <div className="flex items-start justify-between gap-3 p-2.5 rounded-lg border border-surface-border">
                    <div className="min-w-0">
                      <p className="text-[11px] font-semibold text-slate-700">Mandatory</p>
                      <p className="text-[10px] text-slate-400 leading-snug">
                        {d.required !== false
                          ? 'Name, email and phone must all be filled in before the chat continues.'
                          : 'Visitors can skip it. Anything they do type is still checked.'}
                      </p>
                    </div>
                    <button type="button" role="switch" aria-checked={d.required !== false} aria-label="Mandatory"
                      onClick={() => set('required', d.required === false)}
                      className="relative flex-shrink-0 mt-0.5 rounded-full transition-colors"
                      style={{ width: 34, height: 18, background: d.required !== false ? '#0066ff' : '#d1d5db' }}>
                      <span className="absolute rounded-full bg-white shadow transition-all" style={{ top: 2, left: d.required !== false ? 18 : 2, width: 14, height: 14 }}/>
                    </button>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1"><label className="label">Submit button</label>
                      <input className="input" value={d.submitLabel || ''} onChange={e => set('submitLabel', e.target.value)} placeholder="Start chat"/>
                    </div>
                    {d.required === false && (
                      <div className="space-y-1"><label className="label">Skip button</label>
                        <input className="input" value={d.skipLabel || ''} onChange={e => set('skipLabel', e.target.value)} placeholder="Skip for now"/>
                      </div>
                    )}
                  </div>
                  <p className="text-[10px] text-slate-400 leading-snug">
                    The answer is stored as labelled lines (Name / Email / Phone), so it reads clearly in the Inbox.
                  </p>
                </>
              )}

              {def.questionType === 'consent' && (
                <>
                  <div className="space-y-1"><label className="label">Consent wording</label>
                    <textarea className="textarea" rows={2} value={d.consentText || ''} onChange={e => set('consentText', e.target.value)}
                      placeholder="I agree to be contacted about my enquiry."/>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1"><label className="label">Policy link</label>
                      <input className="input" value={d.policyUrl || ''} onChange={e => set('policyUrl', e.target.value)} placeholder="https://…/privacy"/>
                    </div>
                    <div className="space-y-1"><label className="label">Link label</label>
                      <input className="input" value={d.policyLabel || ''} onChange={e => set('policyLabel', e.target.value)} placeholder="Read the full policy"/>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1"><label className="label">Agree button</label>
                      <input className="input" value={d.agreeLabel || ''} onChange={e => set('agreeLabel', e.target.value)} placeholder="I agree"/>
                    </div>
                    <div className="space-y-1"><label className="label">Decline button</label>
                      <input className="input" value={d.declineLabel || ''} onChange={e => set('declineLabel', e.target.value)} placeholder="Not now"/>
                    </div>
                  </div>
                  <p className="text-[10px] text-slate-400 leading-snug">
                    The stored answer carries the wording itself, not just “yes” — so the record
                    still says what was agreed to if anyone asks later.
                  </p>
                </>
              )}

              {def.questionType === 'shipment_booking' && (
                <>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1"><label className="label">Currency symbol</label>
                      <input className="input" value={d.currency || ''} onChange={e => set('currency', e.target.value)} placeholder="₹"/>
                    </div>
                    <div className="space-y-1"><label className="label">Rate estimate (per kg)</label>
                      <input className="input" value={d.ratePerKg ?? ''} onChange={e => set('ratePerKg', e.target.value)} placeholder="5"/>
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    {[
                      ['showDimensions', 'Ask for box dimensions (volumetric weight)'],
                      ['codEnabled', 'Allow Cash on Delivery'],
                      ['appointmentEnabled', 'Allow appointment delivery'],
                      ['insuranceEnabled', 'Offer insurance (owner / carrier)'],
                    ].map(([key, label]) => (
                      <label key={key} className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-600 select-none">
                        <input type="checkbox" className="w-3.5 h-3.5 rounded accent-primary" checked={d[key] !== false}
                          onChange={e => set(key, e.target.checked)}/>
                        {label}
                      </label>
                    ))}
                  </div>
                  <p className="text-[10px] text-slate-400 leading-snug">
                    "Check Rates" is a simulated estimate (chargeable weight × the rate above) — no
                    carrier rate card is connected. The pickup/delivery pickers use Google Maps if a
                    key is set in Behavior settings, and fall back to hand-typed pincode/city/state
                    otherwise.
                  </p>
                </>
              )}

              {def.questionType === 'shipment_calculation' && (
                <>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1"><label className="label">Currency symbol</label>
                      <input className="input" value={d.currency || ''} onChange={e => set('currency', e.target.value)} placeholder="₹"/>
                    </div>
                    <div className="space-y-1"><label className="label">Rate estimate (per kg)</label>
                      <input className="input" value={d.ratePerKg ?? ''} onChange={e => set('ratePerKg', e.target.value)} placeholder="5"/>
                    </div>
                  </div>
                  <label className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-600 select-none">
                    <input type="checkbox" className="w-3.5 h-3.5 rounded accent-primary" checked={d.showDimensions !== false}
                      onChange={e => set('showDimensions', e.target.checked)}/>
                    Ask for box dimensions (volumetric weight)
                  </label>
                  <p className="text-[10px] text-slate-400 leading-snug">
                    A quote-only version of Shipment Booking — pickup, delivery and package details in,
                    an instant estimated rate out, no payment or booking step. Use this when you want a
                    rate calculator on your site without a live booking pipeline behind it.
                  </p>
                </>
              )}

              {def.questionType === 'verify_doc' && (
                <>
                  <div className="space-y-1"><label className="label">Accepted documents</label>
                    <input className="input" placeholder="Comma-separated, e.g. Passport, Driving licence, National ID"
                      value={(d.docTypes || []).join(', ')}
                      onChange={e => set('docTypes', e.target.value.split(',').map(x => x.trim()).filter(Boolean))}/>
                  </div>
                  <label className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-600 select-none">
                    <input type="checkbox" className="w-3.5 h-3.5 rounded accent-primary" checked={d.requireBack !== false}
                      onChange={e => set('requireBack', e.target.checked)}/>
                    Ask for the back of the document too
                  </label>
                  <p className="text-[10px] text-slate-400 leading-snug">
                    The check is simulated — no verification provider is connected. The visitor
                    sees choose → upload → checking → verified, but nothing is actually validated.
                  </p>
                </>
              )}
            </>
          )}

          {(node.type === 'tag' || node.type === 'untag') && (
            <div className="space-y-1"><label className="label">Tag name</label>
              <input className="input" placeholder="e.g. Warm Lead" value={d.tagName || ''} onChange={e => set('tagName', e.target.value)}/>
            </div>
          )}

          {node.type === 'setfield' && (
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1"><label className="label">Field</label><input className="input" value={d.field || ''} onChange={e => set('field', e.target.value)}/></div>
              <div className="space-y-1"><label className="label">Value</label><input className="input" value={d.value || ''} onChange={e => set('value', e.target.value)}/></div>
            </div>
          )}

          {(node.type === 'notify' || node.type === 'crm') && (
            <div className="space-y-1"><label className="label">Note</label>
              <textarea className="textarea" rows={2} value={d.note || ''} onChange={e => set('note', e.target.value)}/>
            </div>
          )}

          {node.type === 'lead_capture' && (
            <>
              <p className="text-[10px] text-slate-400 -mt-1">Fields shown are tied to the widget's Lead Capture settings.</p>
              <div className="space-y-1.5">
                {[
                  { k: 'captureName',  l: 'Name' },
                  { k: 'captureEmail', l: 'Email' },
                  { k: 'capturePhone', l: 'Phone' },
                ].map(f => (
                  <label key={f.k} className="flex items-center justify-between p-2.5 rounded-xl border border-surface-border">
                    <span className="text-[12px] font-semibold text-slate-700">{f.l}</span>
                    <input type="checkbox" className="w-4 h-4 rounded accent-primary" checked={Boolean(d[f.k])} onChange={e => set(f.k, e.target.checked)}/>
                  </label>
                ))}
              </div>
              <div className="space-y-1"><label className="label">Intro message (optional)</label>
                <textarea className="textarea" rows={2} value={d.message || ''} onChange={e => set('message', e.target.value)}/>
              </div>
            </>
          )}

          {node.type === 'csat_rating' && (
            <div className="space-y-1"><label className="label">Prompt message</label>
              <textarea className="textarea" rows={2} value={d.message || ''} onChange={e => set('message', e.target.value)}/>
              <p className="text-[9px] text-slate-400">Shows the widget's star-rating card, same as the Behavior tab's rating toggle.</p>
            </div>
          )}

          {node.type === 'live_chat' && (
            <div className="space-y-1"><label className="label">Handover note for the agent</label>
              <textarea className="textarea" rows={2} value={d.note || ''} onChange={e => set('note', e.target.value)}/>
              <p className="text-[9px] text-slate-400">Pauses this bot session and assigns the conversation to a human agent in the Inbox.</p>
            </div>
          )}

          {node.type === 'delay' && (
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1"><label className="label">Duration</label><input type="number" className="input" value={d.duration ?? 0} onChange={e => set('duration', +e.target.value)}/></div>
              <div className="space-y-1"><label className="label">Unit</label>
                <NativeSelect sm value={d.unit} onChange={e => set('unit', e.target.value)}>
                  <option value="seconds">Seconds</option><option value="minutes">Minutes</option><option value="hours">Hours</option>
                </NativeSelect>
              </div>
            </div>
          )}

          {node.type === 'condition' && (
            <>
              <div className="grid grid-cols-3 gap-2">
                <div className="space-y-1"><label className="label">Variable</label><input className="input-sm" value={d.variable || ''} onChange={e => set('variable', e.target.value)}/></div>
                <div className="space-y-1"><label className="label">Operator</label>
                  <NativeSelect sm value={d.operator} onChange={e => set('operator', e.target.value)}>
                    <option value="equals">=</option><option value="contains">contains</option><option value="not_equals">≠</option>
                  </NativeSelect>
                </div>
                <div className="space-y-1"><label className="label">Value</label><input className="input-sm" value={d.value || ''} onChange={e => set('value', e.target.value)}/></div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1"><label className="label">True branch label</label><input className="input-sm" value={d.trueLabel || ''} onChange={e => set('trueLabel', e.target.value)}/></div>
                <div className="space-y-1"><label className="label">False branch label</label><input className="input-sm" value={d.falseLabel || ''} onChange={e => set('falseLabel', e.target.value)}/></div>
              </div>
            </>
          )}

          {node.type === 'split' && (
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1"><label className="label">Path A label</label><input className="input-sm" value={d.labelA || ''} onChange={e => set('labelA', e.target.value)}/></div>
              <div className="space-y-1"><label className="label">Path B label</label><input className="input-sm" value={d.labelB || ''} onChange={e => set('labelB', e.target.value)}/></div>
            </div>
          )}

          {node.type === 'setvar' && (
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1"><label className="label">Variable</label><input className="input" value={d.variable || ''} onChange={e => set('variable', e.target.value)}/></div>
              <div className="space-y-1"><label className="label">Value</label><input className="input" value={d.value || ''} onChange={e => set('value', e.target.value)}/></div>
            </div>
          )}

          {node.type === 'webhook' && (
            <div className="grid grid-cols-[80px_1fr] gap-2">
              <div className="space-y-1"><label className="label">Method</label>
                <NativeSelect sm value={d.method} onChange={e => set('method', e.target.value)}>
                  <option>GET</option><option>POST</option><option>PUT</option>
                </NativeSelect>
              </div>
              <div className="space-y-1"><label className="label">URL</label><input className="input" placeholder="https://…" value={d.url || ''} onChange={e => set('url', e.target.value)}/></div>
            </div>
          )}

          {node.type === 'jump' && (
            <>
              <div className="space-y-1"><label className="label">Target Node</label>
                <NativeSelect sm value={d.targetNodeId || ''} onChange={e => set('targetNodeId', e.target.value)}>
                  <option value="">— Select node —</option>
                  {(allNodes || []).filter(n => n.id !== node.id).map(n => (
                    <option key={n.id} value={n.id}>{n.data?.name || n.type} ({n.id})</option>
                  ))}
                </NativeSelect>
              </div>
              <p className="text-[9px] text-slate-400">Jumps straight to that node in this same canvas — the usual way to let two different triggers share downstream logic instead of duplicating it.</p>
            </>
          )}

          {node.type === 'goto_subflow' && (
            <>
              <div className="space-y-1"><label className="label">Subflow</label>
                <NativeSelect sm value={d.subflowId || ''} onChange={e => set('subflowId', e.target.value)}>
                  <option value="">Select a subflow…</option>
                  {(subflowOptions || []).map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </NativeSelect>
              </div>
              {(subflowOptions || []).length === 0 && (
                <p className="text-[9px] text-amber-500">No subflows yet — create one from the Subflows section on the Flows list.</p>
              )}
              <p className="text-[9px] text-slate-400">Jumps into that subflow's own graph, starting from its first node. Execution doesn't return here — use this for reusable pieces of logic, so this bot only needs one Main Flow.</p>
            </>
          )}
        </div>

        <div className="flex gap-2 p-4 border-t border-surface-border flex-shrink-0">
          <button onClick={onDelete} className="p-2 rounded-lg text-red-500 hover:bg-red-50 transition-colors flex-shrink-0"><Trash2 size={14}/></button>
          <button onClick={onClose} className="btn-secondary flex-1 justify-center">Cancel</button>
          <button onClick={save} className="btn-primary flex-1 justify-center"><Check size={13}/> Save</button>
        </div>
      </div>
    </div>
  )
}

/* ─── preview simulator — steps through the flow currently being edited so
   someone building it can test it without leaving the builder. Auto-advances
   through message/action/utility nodes with a short delay, pauses on
   ask questions, quick replies, and condition/split nodes for real input, and
   follows "Go to Subflow" jumps into the referenced subflow's own graph.
   There's no real variable-evaluation engine, so condition/split nodes are
   surfaced as a manual "pick a path to test" choice rather than actually
   evaluated. ── */
const SIM_AUTO_MESSAGE = ['send_text', 'send_media', 'show_article', 'send_location']
const SIM_AUTO_LOG = ['tag', 'untag', 'setfield', 'notify', 'crm', 'lead_capture', 'csat_rating', 'delay', 'setvar', 'webhook']
// Node types that can serve as a flow's entry point — used to pick which node
// Preview starts simulating from (always the first one found, never a picker).
const ENTRY_TYPES = ['start', 'quick_automation']

// localStorage bridge between the canvas's "Live Preview" toolbar button and
// the standalone /webchat-flow-preview route (see WebChatFlowLivePreview.jsx)
// — carries the CURRENT in-canvas flow + allFlows (including any unsaved
// edits) since a new tab has no other way to see the builder's in-memory
// state. Mirrors the WIDGET_CFG_STORAGE_KEY bridge pattern used for
// merchant branding between the Widget Builder and /webchat-landing.
export const FLOW_PREVIEW_STORAGE_KEY = 'webchat_flow_live_preview'

// Same "?name=...&id=..." shareable-link shape the Widget Builder already
// generates for its Landing Page (buildLocalLandingUrl in WebChatAppearance.jsx)
// — a real, presentable, copyable URL instead of a bare path, so "Live
// Preview" hands back a link that reads/behaves like every other link this
// app generates, not a one-off. `id` combines this widget's stable
// the bot id with the specific flow's own id so the same bot's Main Flow
// and each Subflow each get a distinct, stable link.
export function buildFlowPreviewUrl(flow) {
  return `/webchat-flow-preview?name=${encodeURIComponent(slugifyBotName(flow.name))}&id=${getLandingBotId()}-${flow.id}`
}

// Hands `flow` off to the standalone full-page route via localStorage — the
// only channel to a brand-new tab — and copies its shareable link.
//
// Deliberately does NOT open the tab itself. `window.open` is the fragile way
// to do this: browsers treat a scripted window as a popup (blockable), and
// `navigator.clipboard.writeText()` consumes the click's transient user
// activation, so copying-then-opening tends to get the window suppressed
// entirely. Callers instead render a real `<a target="_blank">` — a link the
// user clicks is always allowed to open a tab, is never a popup, and gets
// middle-click / ctrl-click / "open in new tab" and a visible URL on hover
// for free. This runs in that anchor's onClick, which fires before the
// browser follows the href, so the payload is in place before the new tab
// mounts and reads it.
//
// Shared by the canvas toolbar — which passes the live in-canvas graph so
// unsaved edits are included — and the flow list, which passes the saved
// flow. `allFlows` comes along for goto_subflow jumps to resolve, with this
// flow's entry swapped for the version being previewed so a jump back into
// "this same flow" sees the same graph.
// Returns the clipboard promise so a caller can show "Link copied!".
export function stageFlowLivePreview(flow, allFlows) {
  const resolvedAllFlows = (allFlows || []).map(f => f.id === flow.id ? { ...f, ...flow } : f)
  try {
    localStorage.setItem(FLOW_PREVIEW_STORAGE_KEY, JSON.stringify({ flow, allFlows: resolvedAllFlows }))
  } catch {}
  // Copied automatically, not just opened — the whole point of a proper
  // "?name=...&id=..." link (matching the Landing Page tab's own pattern) is
  // that it's something the flow author can hand to someone else, not just a
  // button that opens a tab for them personally.
  return navigator.clipboard?.writeText(`${window.location.origin}${buildFlowPreviewUrl(flow)}`)
}

// Turns a live test session (the flow being tested + its running transcript)
// into a Website Chat Inbox conversation record, same shape — and same
// look — as WEBCHAT_CONVERSATIONS in constants/mockData.js, indistinguishable
// from a real visitor's thread (no "test"/"internal" labeling anywhere
// visible: no special name prefix, no tag, ordinary page/browser/os fields).
// `id`/`visitorId` are DERIVED FROM THE FLOW's OWN id plus `source` (which
// surface produced this run — 'canvas' for the in-canvas Preview popup,
// 'live' for the standalone Live Preview tab), not the current timestamp or
// a random visitor number — every call for the same flow+source produces
// the same id, so re-testing (restarting Preview, stepping through again)
// keeps updating that ONE thread via upsertConversation instead of spawning
// a fresh "chat" each time. `source` is part of the id specifically so the
// two surfaces never collide into a single thread — testing the same flow
// via the canvas popup and via the Live Preview link are meant to read as
// two independent visitor sessions, each keeping its own history. The
// visible visitor number is likewise derived from flow.id + source (a
// simple hash, not Date.now()) purely so different flows/surfaces don't all
// show up with the identical "Visitor #____".
export function hashToVisitorNumber(str) {
  let h = 0
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) >>> 0
  return 1000 + (h % 9000)
}
// A flow test is always run from a REAL browser (whoever's actually testing
// it) — there's no reason for the Visitor panel's "Session" details to show
// a fabricated, hash-picked "Edge on Windows" / "Delhi, India" that has
// nothing to do with the machine actually running it. These derive the real
// browser/OS from the UA string, the real current page from this tab's own
// address bar (genuinely accurate for the standalone Live Preview tab, which
// really is the page a visitor would be on), and a real referrer/timezone —
// nothing here is guessed or random.
export function detectBrowserOS() {
  if (typeof navigator === 'undefined') return { browser: 'Unknown', os: 'Unknown' }
  const ua = navigator.userAgent
  let browser = 'Unknown'
  if (/Edg\//.test(ua))                              browser = 'Edge'
  else if (/OPR\//.test(ua))                          browser = 'Opera'
  else if (/Chrome\//.test(ua) && !/Edg\//.test(ua))  browser = 'Chrome'
  else if (/Firefox\//.test(ua))                      browser = 'Firefox'
  else if (/Safari\//.test(ua) && !/Chrome\//.test(ua)) browser = 'Safari'
  let os = 'Unknown'
  if (/Windows/.test(ua))              os = 'Windows'
  else if (/Mac OS X/.test(ua))        os = 'macOS'
  else if (/Android/.test(ua))         os = 'Android'
  else if (/iPhone|iPad|iPod/.test(ua)) os = 'iOS'
  else if (/Linux/.test(ua))           os = 'Linux'
  return { browser, os }
}
// No IP-geolocation call and no automatic Geolocation-API prompt here — both
// would be either unreliable/third-party-dependent or an intrusive surprise
// permission popup just for opening a chat widget. The timezone is the one
// piece of real, ambient, permission-free location signal a browser exposes.
export function detectTimezone() {
  try { return Intl.DateTimeFormat().resolvedOptions().timeZone || 'Unknown' }
  catch { return 'Unknown' }
}
export function detectReferrer() {
  if (typeof document === 'undefined' || !document.referrer) return 'Direct'
  try { return new URL(document.referrer).hostname } catch { return document.referrer }
}
// `existing` is this thread's CURRENT stored record, read fresh on every
// call. The thread is treated as an append-only log: a message already
// persisted is never rewritten or dropped, and this run only ever adds the
// messages of its own that aren't in there yet (its ids carry a per-run tag
// — see runTagRef in useFlowSimulation — so they can't collide with any
// previous run's).
//
// This has to be a merge against the LIVE stored record rather than a
// snapshot taken at run start, because this simulation is not the only
// writer. An agent replying from the Inbox, a call outcome being logged,
// and a private note being added all append to this same record from the
// dashboard side, at any moment. Rebuilding the record from a start-of-run
// snapshot + this run's transcript silently destroyed every one of those:
// they were in neither half, so the visitor's very next message erased
// them. Appending instead of rebuilding is what makes the thread actually
// single and complete — restarting the flow, reopening the tab, the agent
// replying mid-run, and a call landing all just add to the one thread.
export function buildFlowTestConversation(flow, messages, source = 'canvas', existing = null) {
  const id = `flowtest_${source}_${flow.id}`
  const num = hashToVisitorNumber(`${source}:${flow.id}`)
  const env = detectBrowserOS()
  const location = detectTimezone()
  const page = (typeof window !== 'undefined' && window.location?.pathname) || '/'
  const referrer = detectReferrer()
  const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  // An `ask_*` node's answer is tagged by submitAsk (`m.capturedAnswer`) so
  // it renders as a "Captured from Chat" answer card (and feeds the Visitor
  // panel's Phone/Email prefill) instead of a plain chat bubble — same shape
  // WEBCHAT_CONVERSATIONS mock data already uses for this.
  // `m.originId` is set only on a message injected into this run from one
  // already in the stored thread (an agent's Inbox reply — see
  // useAgentReplyBridge). Reusing that id is what lets the merge below
  // recognise it as the same message rather than appending a second copy.
  const mappedRun = messages.map(m => m.capturedAnswer
    ? { id: m.originId || `ft${m.id}`, type: 'answer', questionType: m.capturedAnswer.questionType, label: m.capturedAnswer.label, value: m.text, time }
    // `m.sender` overrides the default Bot/Visitor label — used when this
    // message was actually injected from an agent's Inbox reply (see
    // injectAgentMessage below), so it reads as "Agent" rather than "Bot".
    : { id: m.originId || `ft${m.id}`, type: m.from === 'bot' ? 'outgoing' : 'incoming', text: m.text, time, sender: m.sender || (m.from === 'bot' ? 'Bot' : 'Visitor') }
  )
  const kept = existing?.messages || []
  const keptIds = new Set(kept.map(m => m.id))
  const mapped = [...kept, ...mappedRun.filter(m => !keptIds.has(m.id))]
  const last = [...mapped].reverse().find(m => m.type !== 'answer' && m.type !== 'note') || mapped[mapped.length - 1]
  return {
    // Base shape for a thread being created for the first time…
    unread: 0, status: 'bot', tags: [], labels: [],
    agentId: null, agentName: null, source: 'direct',
    starred: false, archived: false, snoozed: null,
    // …then everything the dashboard may since have changed about it
    // (assignment, labels, status, starred, archived…) is preserved, so a
    // visitor's next message can't silently revert an agent's actions…
    ...existing,
    // …and finally the identity + live-session fields, always refreshed.
    id,
    visitorId: `v_${num}`,
    name: existing?.name || `Visitor #${num}`,
    avatar: existing?.avatar || `V${String(num)[0]}`,
    channel: 'webchat',
    page, browser: env.browser, os: env.os, location,
    referrer, firstSeen: existing?.firstSeen || 'Just now',
    visits: existing?.visits || 1,
    lastMessage: last?.text || last?.value || '',
    time: 'Just now',
    timestamp: new Date().toISOString(),
    messages: mapped,
  }
}

// Persistent store (keyed by conversation id, so it can hold more than one
// flow's test thread at once) that every flow-test surface writes into:
// - the standalone /webchat-flow-preview page (a separate, unauthenticated
//   tab with no access to ConversationContext) — its only way to reach the
//   Inbox at all
// - the in-canvas Preview popup (PreviewSimulator, below) — it already has
//   direct access to ConversationContext's upsertConversation for instant
//   in-session updates, but ALSO needs to persist here, otherwise the test
//   thread it created only lives in that one tab's React state and silently
//   disappears the moment the page is reloaded or the Inbox is opened in a
//   fresh tab (this was the actual bug: it looked like test chats "weren't
//   saving" because nothing durable had actually been written yet).
// ConversationContext reads this whole store (not just one entry) on mount
// and on every `storage` event, and upserts every conversation in it — so
// any number of previously-tested flows reappear after a reload.
export const FLOW_TEST_STORE_KEY = 'webchat_flow_test_store'
export function saveFlowTestConversation(conv) {
  try {
    const store = JSON.parse(localStorage.getItem(FLOW_TEST_STORE_KEY) || '{}')
    store[conv.id] = conv
    localStorage.setItem(FLOW_TEST_STORE_KEY, JSON.stringify(store))
  } catch {}
}

// One entry point both flow-test surfaces call on every `messages` change.
// `messages.length === 0` is precisely the instant a run (re)starts — initial
// mount and every explicit restart both clear the simulator's transcript back
// to empty before rebuilding it — so that's when the visit counter ticks.
// Every other call merges this run's transcript into the stored thread,
// reading it fresh each time so concurrent writers (an agent replying, a call
// outcome, a note) are never clobbered. See buildFlowTestConversation.
export function recordFlowTestTurn(flow, messages, source = 'canvas') {
  const id = `flowtest_${source}_${flow.id}`
  let store = {}
  try { store = JSON.parse(localStorage.getItem(FLOW_TEST_STORE_KEY) || '{}') } catch {}

  if (!messages.length) {
    const prior = store[id]
    // Nothing to count a visit against until the thread actually exists —
    // the first run's visit is the `visits: 1` a new record is created with.
    if (prior) {
      try {
        store[id] = { ...prior, visits: (prior.visits || 0) + 1 }
        localStorage.setItem(FLOW_TEST_STORE_KEY, JSON.stringify(store))
      } catch {}
    }
    return null
  }

  const conv = buildFlowTestConversation(flow, messages, source, store[id])
  saveFlowTestConversation(conv)
  return conv
}

// Delivers an agent's Inbox reply (see ConversationContext.jsx's
// `sendMessage`, which appends it into FLOW_TEST_STORE_KEY for exactly this
// purpose) into a LIVE running simulation, so a visitor testing the bot
// actually sees the agent's reply appear instead of it only ever reaching
// the Inbox's own record of the conversation. Cross-tab only by nature (a
// `storage` event never fires in the tab that wrote it) — which matches the
// realistic setup this bridges: the agent's Inbox in one tab, the visitor's
// widget (the standalone Live Preview page, or another window onto the
// canvas popup) in another. Call once per running simulation; pass the same
// `source` used for that simulation's own recordFlowTestTurn calls.
export function useAgentReplyBridge(flow, source, injectAgentMessage) {
  const seenRef = useRef(new Set())
  useEffect(() => {
    const id = `flowtest_${source}_${flow.id}`
    function checkForAgentReplies(e) {
      if (e.key !== FLOW_TEST_STORE_KEY) return
      try {
        const store = JSON.parse(e.newValue || '{}')
        const stored = store[id]
        if (!stored) return
        for (const m of stored.messages) {
          if (m.type === 'outgoing' && m.sender === 'Agent' && !seenRef.current.has(m.id)) {
            seenRef.current.add(m.id)
            // Carries the STORED message's id along, so when this run's
            // transcript is next merged back into the stored thread the
            // injected copy is recognised as that same already-stored
            // message instead of being appended as a second one — the
            // agent's reply otherwise ended up in the thread twice.
            injectAgentMessage(m.value ?? m.text, m.id)
          }
        }
      } catch {}
    }
    window.addEventListener('storage', checkForAgentReplies)
    return () => window.removeEventListener('storage', checkForAgentReplies)
  }, [flow.id, source, injectAgentMessage])
}


function simBotText(node) {
  const d = node.data || {}
  switch (node.type) {
    case 'send_text':    return d.message || '(empty message)'
    case 'send_media':   return `🖼️ [${d.mediaType || 'image'}]${d.caption ? ' — ' + d.caption : ''}`
    case 'show_article':  return `📄 Help article: ${d.articleTitle || d.articleUrl || 'Untitled'}`
    case 'send_location': return d.message || `📍 ${d.locLabel || d.address || 'Location'}`
    default:              return d.name || node.type
  }
}
function simLogText(node) {
  const d = node.data || {}
  switch (node.type) {
    case 'tag':           return `🏷️ Tag added: ${d.tagName || '—'}`
    case 'untag':          return `🏷️ Tag removed: ${d.tagName || '—'}`
    case 'setfield':       return `🧩 Field set: ${d.field || '—'} = ${d.value || '—'}`
    case 'notify':         return `🔔 Agent notified${d.note ? ' — ' + d.note : ''}`
    case 'crm':            return `📤 Pushed to CRM${d.note ? ' — ' + d.note : ''}`
    case 'lead_capture':   return `📋 Lead capture triggered${d.message ? ' — ' + d.message : ''}`
    case 'csat_rating':    return `⭐ CSAT rating card shown`
    case 'delay':          return `⏱️ Waiting ${d.duration ?? 0} ${d.unit || 'seconds'}…`
    case 'setvar':         return `🧮 Variable set: ${d.variable || '—'} = ${d.value || '—'}`
    case 'webhook':        return `🌐 Webhook called: ${(d.method || 'POST')} ${d.url || '—'}`
    default:                return d.name || node.type
  }
}


const WIDGET_CFG_FALLBACK = {
  colorMode: 'gradient', color: '#0066ff', colorEnd: '#8B5CF6',
  theme: 'light', corner: 'round', bubbleStyle: 'ios', fontFamily: 'Inter', fontSizePx: 12,
  headerMode: 'brand', headerColor: '#0066ff', headerColorEnd: '#8B5CF6', headerGradient: false,
  botBubbleBg: '', botBubbleText: '', userBubbleBg: '', userBubbleText: '', chatBackground: '#ffffff',
  bubbleShadow: 'soft', density: 'comfortable', quickReplyStyle: 'pill',
  botName: 'ChatBot', tagline: 'We reply instantly',
  avatarStyle: 'icon', avatarEmoji: '🤖', avatarImage: '',
  threadAvatarStyle: 'emoji', threadAvatarEmoji: '🤖', threadAvatarImage: '',
  showBranding: true, brandingUrl: '/',
  enableVoiceCall: false, enableVideoCall: false,
  googleMapsApiKey: '',
}

/* Same look as the real widget — reads the Widget Builder's live settings
   from localStorage (the same bridge WebChatLandingPage.jsx uses) so this
   simulator isn't a visually-disconnected second UI.
   The saved config is layered OVER the fallback rather than replacing it:
   a stored config only holds the keys that existed when it was written, so
   returning it as-is left every newer setting `undefined` instead of at its
   default — which is why a widget could come back with no branding strip
   (or no call buttons) purely because its config predated those fields. */
export function useWidgetCfg() {
  const [saved, setSaved] = useState(null)
  useEffect(() => {
    try { setSaved(JSON.parse(localStorage.getItem(WIDGET_CFG_STORAGE_KEY) || 'null')) } catch { setSaved(null) }
  }, [])
  return { ...WIDGET_CFG_FALLBACK, ...(saved || {}) }
}

/* ─── flow simulation engine — the state machine that steps through a flow
   graph (quick replies, conditions, ask-question nodes, jumps, subflow
   switches, the works), extracted out of PreviewSimulator so it can be
   driven by more than one renderer: the dashboard's floating popup preview
   AND the standalone full-page live-preview route both use this same hook
   so there is exactly one implementation of "how a flow actually runs". */
/* A bot with no published flow is a real state, not a bug: a merchant can
   install the snippet before building their automation, and the widget must
   still render (design, tabs, calling) rather than throw on `flow.graph`.
   Every caller inside the dashboard always has a flow; the embed
   (WebChatEmbed.jsx) is the one that legitimately may not. */
const EMPTY_FLOW = { id: null, name: '', graph: { nodes: [], edges: [] } }

export function useFlowSimulation(flow, allFlows) {
  const safeFlow = flow || EMPTY_FLOW
  const [graph, setGraph] = useState(safeFlow.graph)
  const [graphLabel, setGraphLabel] = useState(safeFlow.name)
  const [currentId, setCurrentId] = useState(null)
  const [messages, setMessages] = useState([]) // { id, from: 'bot'|'user', text }
  const [awaiting, setAwaiting] = useState(null) // { type: 'ask'|'quick_replies'|'branch', node, msgId }
  const [ended, setEnded] = useState(false)
  /* Backstage debug trail for the flow author — everything that used to leak
     into the visible chat as a fake "system" bubble (tag/webhook/notify/jump/
     subflow-switch events) now lands here instead. Never rendered inside the
     widget frame; shown in its own clearly-separate collapsible strip below it. */
  const [activity, setActivity] = useState([])
  const [activityOpen, setActivityOpen] = useState(false)
  const timerRef = useRef(null)
  const midRef = useRef(0)
  const lastMsgIdRef = useRef(null)
  const actIdRef = useRef(0)
  // Per-mount-instance prefix so message ids never collide with a previous
  // run's ids once merged with persisted history across a close/reopen (a
  // fresh mount always restarts midRef from 0) — see recordFlowTestTurn.
  const runTagRef = useRef(Math.random().toString(36).slice(2, 8))

  const push = useCallback((from, text, meta) => {
    const id = `${runTagRef.current}${++midRef.current}`
    lastMsgIdRef.current = id
    setMessages(m => [...m, { id, from, text, ...(meta || {}) }])
    return id
  }, [])

  const logActivity = useCallback((text) => {
    setActivity(a => [...a, { id: ++actIdRef.current, text }])
  }, [])

  const beginFrom = useCallback((startId) => {
    clearTimeout(timerRef.current)
    setMessages([]); setAwaiting(null); setEnded(false); setActivity([])
    lastMsgIdRef.current = null
    setGraph(safeFlow.graph); setGraphLabel(safeFlow.name)
    setCurrentId(startId)
  }, [flow])

  // Always simulate starting from the flow's first entry node — "the first
  // question in the main flow is the first trigger" — no picker, ever.
  const reset = useCallback(() => {
    const s = safeFlow.graph.nodes.find(n => ENTRY_TYPES.includes(n.type)) || safeFlow.graph.nodes[0] || null
    if (s) beginFrom(s.id)
    else { clearTimeout(timerRef.current); setMessages([]); setAwaiting(null); setActivity([]); setEnded(true) }
  }, [flow, beginFrom])

  useEffect(() => { reset() }, [reset])
  useEffect(() => () => clearTimeout(timerRef.current), [])

  const nextFrom = useCallback((nodeId, port) => {
    const e = graph.edges.find(x => x.fromId === nodeId && (x.fromPort || 0) === port)
    return e ? e.toId : null
  }, [graph])

  const finishOrAdvance = useCallback((nodeId, port) => {
    const nid = nextFrom(nodeId, port)
    if (nid) setCurrentId(nid)
    else setEnded(true)
  }, [nextFrom])

  useEffect(() => {
    if (!currentId || ended || awaiting) return
    const node = graph.nodes.find(n => n.id === currentId)
    if (!node) { setEnded(true); return }

    if (node.type === 'start') {
      timerRef.current = setTimeout(() => finishOrAdvance(node.id, 0), 250)
      return
    }
    if (node.type === 'quick_automation') {
      // A trigger + instant reply bundled into one node — fires its reply the
      // same way a send_text node would, then advances (or ends if nothing's
      // wired to its output), whether reached as the flow's entry node or
      // further downstream.
      if (node.data?.message) push('bot', node.data.message)
      timerRef.current = setTimeout(() => finishOrAdvance(node.id, 0), 700)
      return
    }
    if (SIM_AUTO_MESSAGE.includes(node.type)) {
      /* A location message carries its coordinates so the widget can render a
         real map card. The text is still set, and is what the Inbox and the
         saved transcript show — neither of those can draw a map. */
      const meta = node.type === 'send_location'
        ? { location: {
              label: node.data?.locLabel || '',
              address: node.data?.address || '',
              lat: node.data?.lat === '' || node.data?.lat == null ? null : Number(node.data.lat),
              lng: node.data?.lng === '' || node.data?.lng == null ? null : Number(node.data.lng),
            } }
        : undefined
      push('bot', simBotText(node), meta)
      timerRef.current = setTimeout(() => finishOrAdvance(node.id, 0), 700)
      return
    }
    if (SIM_AUTO_LOG.includes(node.type)) {
      // Backstage only — a real visitor never sees tag/webhook/CRM/etc. activity.
      logActivity(simLogText(node))
      timerRef.current = setTimeout(() => finishOrAdvance(node.id, 0), 500)
      return
    }
    if (node.type.startsWith('ask_')) {
      const id = push('bot', node.data?.question || 'Please answer:')
      setAwaiting({ type: 'ask', node, msgId: id })
      return
    }
    if (node.type === 'quick_replies') {
      // Attach the chips to the question message when there is one; otherwise
      // attach to whatever bot/user message already came before, so the chips
      // never need a fabricated bubble of their own to hang off of.
      const id = node.data?.message ? push('bot', node.data.message) : lastMsgIdRef.current
      setAwaiting({ type: 'quick_replies', node, msgId: id })
      return
    }
    if (node.type === 'condition' || node.type === 'split') {
      setAwaiting({ type: 'branch', node, msgId: lastMsgIdRef.current })
      return
    }
    if (node.type === 'jump') {
      // Still actually switches the simulation forward — just never announces
      // it in the visible transcript, so a jump reads as one continuous reply.
      const target = graph.nodes.find(n => n.id === node.data?.targetNodeId)
      if (!target) { setEnded(true); return }
      timerRef.current = setTimeout(() => setCurrentId(target.id), 400)
      return
    }
    if (node.type === 'goto_subflow') {
      // Same as `jump` — the graph/label really do switch to the subflow (the
      // simulation keeps working exactly as before), it's just invisible to
      // the visible chat: the bot architecture (one chatbot, many subflows)
      // must never leak into the widget UI.
      const sub = (allFlows || []).find(f => f.id === node.data?.subflowId && f.kind === 'subflow')
      if (!sub) { setEnded(true); return }
      timerRef.current = setTimeout(() => {
        const s = sub.graph.nodes.find(n => ENTRY_TYPES.includes(n.type)) || sub.graph.nodes[0] || null
        setGraph(sub.graph); setGraphLabel(sub.name)
        if (s) setCurrentId(s.id); else setEnded(true)
      }, 500)
      return
    }
    if (node.type === 'live_chat') {
      setEnded(true)
      return
    }
    if (node.type === 'end') {
      // The end node's own configured message (if any) is real bot-visible
      // copy and still gets pushed as a normal message — only the extra
      // "✅ Flow ended" system bubble that used to follow it is gone; the
      // ended state is now communicated by the composer banner instead.
      if (node.data?.endMessage) push('bot', node.data.endMessage)
      setEnded(true)
      return
    }
    // unhandled node type — treat as a silent passthrough so the sim never gets stuck
    timerRef.current = setTimeout(() => finishOrAdvance(node.id, 0), 300)
  }, [currentId, graph, ended, awaiting, allFlows, push, logActivity, finishOrAdvance])

  const submitAsk = (value) => {
    if (!awaiting || awaiting.type !== 'ask') return
    const node = awaiting.node
    const text = (typeof value === 'string' ? value : value != null ? JSON.stringify(value) : '').trim() || '(skipped)'
    // Tag this as a captured answer so it renders as a "Captured from Chat"
    // card in the Inbox's Visitor panel — same as a real visitor's answers —
    // instead of a plain chat bubble; see buildFlowTestConversation's use of
    // `m.capturedAnswer`. Deliberately namespaced as a single nested object
    // (not flat `questionType`/`label` keys) — WidgetPreview's OWN message
    // rendering already gives `m.questionType` a completely different
    // meaning (a question-type OBJECT, used only by the static "Question
    // Types" design-preview thread to render an inert example control under
    // a message). Flattening these fields onto the same message object
    // collided with that check and made a real answered question sprout a
    // second, empty, non-interactive control under itself in the live
    // widget — every answer looked like it left a ghost input box behind.
    const questionType = node.data?.questionType
    const label = node.data?.name || ASK_DEFS[`ask_${questionType}`]?.label || 'Answer'
    push('user', text, questionType ? { capturedAnswer: { questionType, label } } : undefined)
    setAwaiting(null)
    finishOrAdvance(node.id, 0)
  }
  const pickQuickReply = (idx, label) => {
    push('user', label || `Option ${idx + 1}`)
    const node = awaiting.node
    setAwaiting(null)
    finishOrAdvance(node.id, idx)
  }
  const pickBranch = (idx, label) => {
    push('user', label || `Option ${idx + 1}`)
    const node = awaiting.node
    setAwaiting(null)
    finishOrAdvance(node.id, idx)
  }

  // Lets an agent's reply typed in the Inbox appear live in this running
  // session — see the `storage`-event listener in PreviewSimulator and
  // LiveFlowPreview that calls this when it spots a new agent message
  // targeting this exact thread. Pushed with `from: 'bot'` (so it renders on
  // the business/outgoing side like a real agent takeover reply would) but
  // tagged `sender: 'Agent'` so it's distinguishable from the bot's own
  // scripted messages.
  const injectAgentMessage = useCallback((text, originId) => {
    push('bot', text, { sender: 'Agent', originId })
  }, [push])

  return { messages, awaiting, ended, activity, activityOpen, setActivityOpen, reset, submitAsk, pickQuickReply, pickBranch, injectAgentMessage }
}

/* A Single/Multiple Choice node whose style reads as a menu of buttons
   (see CHOICE_STYLES' `inline` flag — Buttons and Outline, matching a Quick
   Replies / Main Menu look) answers attached under its OWN question bubble
   instead of the fixed composer, the same way quick_replies chips visually
   read as part of the message they belong to. Every other question type
   still answers from the one consistent composer location below. A caller
   uses this to decide which of `simComposerControl` / `simInlineControl` a
   pending ask-node's control should be built into. */
export function isInlineAskAwaiting(awaiting) {
  if (awaiting?.type !== 'ask') return false
  const style = CHOICE_STYLES.find(s => s.id === (awaiting.node.data?.choiceStyle || 'list'))
  return Boolean(style?.inline)
}

/* Renders whichever interactive control the simulation is currently awaiting
   an answer for — quick-reply chips, branch-test chips, or the real shared
   answer control for an `ask_*` node — as either the widget's bottom
   composer slot (`simComposerControl`) or, for an inline-styled choice
   question (see `isInlineAskAwaiting`), attached under its own question
   bubble (`simInlineControl`) instead. Pure function of the hook's own
   outputs plus the small bit of widget theming needed to match the chip look
   exactly — shared by both the popup preview and the standalone full-page
   live preview so there's exactly one implementation of "what does the
   pending question's control look like right now". */
export function renderFlowSimComposerControl({ awaiting, submitAsk, pickQuickReply, pickBranch, accent, dark, cornerR, fs, quickReplyStyle, googleMapsApiKey }) {
  if (!awaiting) return null

  const quickReplyRadius = quickReplyStyle === 'square' ? cornerR * 0.5 : 999
  const chipStyle = {
    fontSize: fs(10.5), padding: '6px 12px', borderRadius: quickReplyRadius,
    border: `1.5px solid ${dark ? '#334155' : '#e2e8f0'}`,
    background: dark ? '#1e293b' : '#fff', color: accent,
  }

  if (awaiting.type === 'ask') {
    // `key` is essential here, not decorative: two consecutive questions
    // can resolve to the exact same underlying control component (e.g.
    // any two free-text types both render FreeTextAnswer). Without a key
    // that changes per-question, React treats that as the SAME component
    // instance across the question change and keeps its old internal
    // state (whatever text was left typed/half-entered) instead of
    // starting fresh — so leftover input from the previous question was
    // silently carrying over, and in some cases getting submitted again
    // as the answer to the new question. Keying on the node id forces a
    // clean remount every time the simulation moves to a new question.
    return <AnswerControl key={awaiting.node.id} questionType={awaiting.node.data?.questionType} accent={accent || '#0066ff'} dark={dark} onSubmit={submitAsk} interactive
      formFields={awaiting.node.data?.formFields} otpConfig={awaiting.node.data?.otpConfig} googleMapsApiKey={googleMapsApiKey}
      nodeData={awaiting.node.data}/>
  }
  if (awaiting.type === 'quick_replies') {
    return (
      <div className="flex flex-wrap gap-1.5">
        {getOutputPorts(awaiting.node).map((p, i) => (
          <button key={i} onClick={() => pickQuickReply(i, p.label)} className="font-semibold transition-colors" style={chipStyle}>
            {p.label}
          </button>
        ))}
      </div>
    )
  }
  if (awaiting.type === 'branch') {
    return (
      <div className="flex flex-wrap gap-1.5">
        {getOutputPorts(awaiting.node).map((p, i) => (
          <button key={i} onClick={() => pickBranch(i, p.label)} className="font-semibold transition-colors" style={chipStyle}>
            {p.label}
          </button>
        ))}
      </div>
    )
  }
  return null
}

function PreviewSimulator({ flow, allFlows, onClose }) {
  const cfg = useWidgetCfg()
  /* Only pulled for the small set of values needed to make the simulator's own
     quick-reply / branch chip rows (rendered via the shared composer-control
     renderer below) match the widget's own chip look exactly — the
     header/message-list/composer chrome itself is no longer reimplemented
     here at all, it's rendered by the real <WidgetPreview/> so there is zero
     visual drift from it. */
  const { cornerR, fs, dark } = useWidgetTheme(cfg)
  const { messages, awaiting, ended, activity, activityOpen, setActivityOpen, reset, submitAsk, pickQuickReply, pickBranch, injectAgentMessage } =
    useFlowSimulation(flow, allFlows)
  useAgentReplyBridge(flow, 'canvas', injectAgentMessage)

  // Mirror this test session into the Website Chat Inbox as it runs, so
  // "testing a flow" produces a real, reviewable conversation instead of a
  // transcript that vanishes when the popup closes. Keyed off the flow's own
  // id (via upsertConversation) so re-testing keeps updating the SAME
  // thread rather than creating a new one on every run.
  const { upsertConversation } = useConversations()
  useEffect(() => {
    // recordFlowTestTurn handles the empty-array (run just (re)started) case
    // itself — snapshotting whatever's already persisted so a restart or a
    // close/reopen folds onto that history instead of erasing it — and
    // returns null when there's nothing new to upsert yet.
    const conv = recordFlowTestTurn(flow, messages, 'canvas')
    if (conv) upsertConversation(conv)
    // `upsertConversation` is intentionally excluded — it's a plain function
    // redefined on every ConversationProvider render (not useCallback'd), so
    // depending on it would re-fire this effect on every render triggered by
    // the very state update it causes. Only `messages`/`flow` need to be
    // reactive here.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages, flow])

  const simComposerBanner = ended ? { text: 'This simulation has ended', actionLabel: '↻ Restart', onAction: reset } : null
  const simControl = awaiting
    ? renderFlowSimComposerControl({ awaiting, submitAsk, pickQuickReply, pickBranch, accent: cfg.color, dark, cornerR, fs, quickReplyStyle: cfg.quickReplyStyle, googleMapsApiKey: cfg.googleMapsApiKey })
    : null
  const inline = isInlineAskAwaiting(awaiting)
  const simComposerControl = inline ? null : simControl
  const simInlineControl = inline ? simControl : null
  const simInlineMsgId = inline ? awaiting.msgId : null

  return (
    <div className="fixed bottom-2.5 right-5 z-[70] flex flex-col items-end gap-2 max-h-[calc(100vh-20px)]">
      {/* No separate Restart/Close pair floating above the frame — the
          widget's own header already carries both, wired to the same
          handlers below: its ✕ ("Close chat") and its ⋯ menu's "Close chat"
          both reach onClose via `setScreen`, and that menu's "Restart chat"
          is `reset`. A second, duplicate set hovering outside the widget
          just reads as two stray unexplained icons. Preview always starts
          simulating from the flow's first entry node (see `reset`) — no
          "which trigger" picker. */}

      {/* The real widget — pixel-identical to /webchat/appearance's own
          preview, its own frame/header left completely untouched.
          The height is a CEILING, not a fixed size: `min-h-0` lets flexbox
          shrink it (rather than letting it clip off the top of the screen)
          when the window is short or the backstage strip below is expanded.
          The reserve is measured, not padded out: 10px clear of the bottom
          edge + 8px gap + the 29px collapsed strip + 10px clear of the top,
          so the popup runs nearly the full height of the window instead of
          leaving a band of dead space above and below it. */}
      <div className="relative min-h-0" style={{ width: 400, height: 'min(1000px, calc(100vh - 57px))' }}>
        <WidgetPreview cfg={cfg} screen="open" device="desktop"
          activeTab="chat" setActiveTab={() => {}}
          setScreen={s => { if (s === 'closed') onClose() }}
          simThread={messages} simComposerBanner={simComposerBanner}
          simComposerControl={simComposerControl}
          simInlineControl={simInlineControl} simInlineMsgId={simInlineMsgId}
          onRestartChat={reset}/>
      </div>

      {/* Backstage activity trail — deliberately plain/monospace, no bubble
          styling, no avatar, collapsed by default: a debug aid for the flow
          author, never part of the chat widget itself. */}
      <div className="w-[400px] rounded-lg border border-slate-200 bg-slate-50 overflow-hidden">
        <button onClick={() => setActivityOpen(o => !o)}
          className="w-full flex items-center justify-between px-3 py-1.5 text-[10px] font-semibold text-slate-400 hover:text-slate-600 transition-colors">
          <span>Backstage activity {activity.length > 0 && `(${activity.length})`}</span>
          {activityOpen ? <ChevronUp size={12}/> : <ChevronDown size={12}/>}
        </button>
        {activityOpen && (
          <div className="max-h-[140px] overflow-y-auto px-3 pb-2 space-y-1 font-mono">
            {activity.length === 0
              ? <p className="text-[10px] text-slate-300">Nothing logged yet — tags, webhooks, jumps and subflow switches will show up here as they happen.</p>
              : activity.map(a => <p key={a.id} className="text-[10px] text-slate-500 leading-snug">{a.text}</p>)}
          </div>
        )}
      </div>
    </div>
  )
}

/* ─── canvas builder view ──────────────────────────────────────────────── */
function BuilderView({ flow, onBack, onSave, allFlows }) {
  const [nodes, setNodes] = useState(flow.graph.nodes)
  const [edges, setEdges] = useState(flow.graph.edges)
  const [selectedId, setSelectedId] = useState(null)
  const [selectedEdgeId, setSelectedEdgeId] = useState(null)
  const [zoom, setZoom] = useState(1)
  const [pan, setPan] = useState({ x: 60, y: 60 })
  const [dragging, setDragging] = useState(null)
  const [panning, setPanning] = useState(false)
  const [panStart, setPanStart] = useState({ x: 0, y: 0 })
  const [flowName, setFlowName] = useState(flow.name)
  const [editName, setEditName] = useState(false)
  const [saved, setSaved] = useState(false)
  const [history, setHistory] = useState([{ nodes: flow.graph.nodes, edges: flow.graph.edges }])
  const [histIdx, setHistIdx] = useState(0)
  const [connecting, setConnecting] = useState(null)
  const [hoverPortNode, setHoverPortNode] = useState(null)
  const [showPreview, setShowPreview] = useState(false)
  const svgRef = useRef(null)

  const selectedNode = nodes.find(n => n.id === selectedId)
  const subflowOptions = (allFlows || []).filter(f => f.kind === 'subflow' && f.id !== flow.id).map(f => ({ id: f.id, name: f.name }))

  const pushHistory = useCallback((nn, ne) => {
    setHistory(h => [...h.slice(0, histIdx + 1), { nodes: nn, edges: ne }].slice(-30))
    setHistIdx(i => Math.min(i + 1, 29))
  }, [histIdx])
  const applyHistory = useCallback((nn, ne) => { setNodes(nn); setEdges(ne); pushHistory(nn, ne) }, [pushHistory])
  const undo = useCallback(() => { if (histIdx <= 0) return; const idx = histIdx - 1; setHistIdx(idx); setNodes(history[idx].nodes); setEdges(history[idx].edges) }, [history, histIdx])
  const redo = useCallback(() => { if (histIdx >= history.length - 1) return; const idx = histIdx + 1; setHistIdx(idx); setNodes(history[idx].nodes); setEdges(history[idx].edges) }, [history, histIdx])

  useEffect(() => {
    const h = e => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'z' && !e.shiftKey) { e.preventDefault(); undo() }
      if ((e.metaKey || e.ctrlKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) { e.preventDefault(); redo() }
      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (document.activeElement.tagName === 'INPUT' || document.activeElement.tagName === 'TEXTAREA') return
        if (selectedEdgeId) { applyHistory(nodes, edges.filter(x => x.id !== selectedEdgeId)); setSelectedEdgeId(null) }
        else if (selectedId) { applyHistory(nodes.filter(n => n.id !== selectedId), edges.filter(e2 => e2.fromId !== selectedId && e2.toId !== selectedId)); setSelectedId(null) }
      }
      if (e.key === 'Escape') { setSelectedId(null); setSelectedEdgeId(null); setConnecting(null); setHoverPortNode(null) }
    }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [undo, redo, selectedId, selectedEdgeId, nodes, edges, applyHistory])

  const toCanvas = useCallback((cx, cy) => {
    const rect = svgRef.current?.getBoundingClientRect()
    if (!rect) return { x: 0, y: 0 }
    return { x: (cx - rect.left - pan.x) / zoom, y: (cy - rect.top - pan.y) / zoom }
  }, [pan, zoom])

  const startDrag = useCallback((e, nodeId) => {
    if (connecting) return
    const pt = toCanvas(e.clientX, e.clientY)
    const node = nodes.find(n => n.id === nodeId)
    setDragging({ nodeId, ox: pt.x - node.x, oy: pt.y - node.y })
  }, [nodes, toCanvas, connecting])

  const startConnect = useCallback((e, nodeId, portIdx) => {
    e.stopPropagation()
    const from = nodes.find(n => n.id === nodeId)
    if (!from) return
    const ports = getOutputPorts(from)
    const py = ports.length <= 1 ? NODE_H / 2 : (NODE_H / (ports.length + 1)) * (portIdx + 1)
    const pt = toCanvas(e.clientX, e.clientY)
    setConnecting({ fromId: nodeId, fromPort: portIdx, x1: from.x + NODE_W, y1: from.y + py, x2: pt.x, y2: pt.y })
    setDragging(null); setSelectedId(null); setSelectedEdgeId(null)
  }, [nodes, toCanvas])

  const onSvgMouseMove = useCallback(e => {
    const pt = toCanvas(e.clientX, e.clientY)
    if (connecting) {
      let snap = null
      for (const n of nodes) {
        if (n.id === connecting.fromId) continue
        const dx = pt.x - n.x, dy = pt.y - (n.y + NODE_H / 2)
        if (dx > -PORT_R * 3 && dx < NODE_W * 0.4 && Math.abs(dy) < PORT_R * 3) { snap = n; break }
      }
      setHoverPortNode(snap ? snap.id : null)
      setConnecting(c => ({ ...c, x2: snap ? snap.x : pt.x, y2: snap ? snap.y + NODE_H / 2 : pt.y }))
      return
    }
    if (dragging) setNodes(ns => ns.map(n => n.id === dragging.nodeId ? { ...n, x: pt.x - dragging.ox, y: pt.y - dragging.oy } : n))
    if (panning) setPan({ x: e.clientX - panStart.x, y: e.clientY - panStart.y })
  }, [dragging, panning, panStart, toCanvas, connecting, nodes])

  const onSvgMouseDown = useCallback(e => {
    if (connecting) { setConnecting(null); setHoverPortNode(null); return }
    if (e.target === svgRef.current || e.target.tagName === 'svg') {
      setPanning(true); setPanStart({ x: e.clientX - pan.x, y: e.clientY - pan.y }); setSelectedId(null); setSelectedEdgeId(null)
    }
  }, [pan, connecting])

  const onSvgMouseUp = useCallback(() => {
    if (connecting) {
      if (hoverPortNode && hoverPortNode !== connecting.fromId) {
        const dup = edges.some(e => e.fromId === connecting.fromId && e.fromPort === connecting.fromPort)
        const ne = dup
          ? [...edges.filter(e => !(e.fromId === connecting.fromId && e.fromPort === connecting.fromPort)), { id: 'e' + Date.now(), fromId: connecting.fromId, fromPort: connecting.fromPort, toId: hoverPortNode }]
          : [...edges, { id: 'e' + Date.now(), fromId: connecting.fromId, fromPort: connecting.fromPort, toId: hoverPortNode }]
        applyHistory(nodes, ne)
      }
      setConnecting(null); setHoverPortNode(null); return
    }
    if (dragging) { pushHistory(nodes, edges); setDragging(null) }
    setPanning(false)
  }, [dragging, nodes, edges, pushHistory, connecting, hoverPortNode, applyHistory])

  const onWheel = useCallback(e => { e.preventDefault(); setZoom(z => Math.min(2.5, Math.max(0.25, z * (e.deltaY < 0 ? 1.1 : 0.9)))) }, [])
  useEffect(() => {
    const el = svgRef.current; if (!el) return
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [onWheel])

  const addNode = useCallback(type => {
    if (nodes.length >= MAX_NODES) return
    const n = { id: uid(), type, x: (-pan.x + 400) / zoom, y: (-pan.y + 250) / zoom, data: makeDefaults(type) }
    const nn = [...nodes, n]
    applyHistory(nn, edges); setSelectedId(n.id)
  }, [nodes, edges, pan, zoom, applyHistory])

  const updateNode = useCallback(updated => { const nn = nodes.map(n => n.id === updated.id ? updated : n); setNodes(nn); pushHistory(nn, edges) }, [nodes, edges, pushHistory])
  const deleteNode = useCallback(id => { const nn = nodes.filter(n => n.id !== id); const ne = edges.filter(e => e.fromId !== id && e.toId !== id); applyHistory(nn, ne); setSelectedId(null) }, [nodes, edges, applyHistory])

  const fitScreen = useCallback(() => {
    if (!svgRef.current || nodes.length === 0) return
    const rect = svgRef.current.getBoundingClientRect()
    const minX = Math.min(...nodes.map(n => n.x)) - 40, minY = Math.min(...nodes.map(n => n.y)) - 40
    const maxX = Math.max(...nodes.map(n => n.x + NODE_W)) + 40, maxY = Math.max(...nodes.map(n => n.y + NODE_H)) + 40
    const newZoom = Math.min(rect.width / (maxX - minX), rect.height / (maxY - minY), 2)
    setZoom(newZoom); setPan({ x: -minX * newZoom + 20, y: -minY * newZoom + 20 })
  }, [nodes])

  const handleSave = () => { onSave({ name: flowName, graph: { nodes, edges } }); setSaved(true); setTimeout(() => setSaved(false), 1500) }

  // Stages the CURRENT in-canvas graph (including unsaved edits — the same
  // live nodes/edges/flowName handleSave above would persist), so the
  // full-page preview reflects what's on screen rather than what's saved.
  // Runs on the link's click, before the browser follows its href.
  const [linkCopied, setLinkCopied] = useState(false)
  const liveFlow = { id: flow.id, name: flowName, kind: flow.kind, graph: { nodes, edges } }
  const stageLivePreview = () => {
    stageFlowLivePreview(liveFlow, allFlows)?.then(
      () => { setLinkCopied(true); setTimeout(() => setLinkCopied(false), 2000) },
      () => {}
    )
  }

  const edgePaths = useMemo(() => edges.map(e => {
    const from = nodes.find(n => n.id === e.fromId), to = nodes.find(n => n.id === e.toId)
    if (!from || !to) return null
    const ports = getOutputPorts(from)
    const pi = e.fromPort || 0
    const py = ports.length <= 1 ? NODE_H / 2 : (NODE_H / (ports.length + 1)) * (pi + 1)
    return { ...e, path: bezier(from.x + NODE_W, from.y + py, to.x, to.y + NODE_H / 2) }
  }).filter(Boolean), [nodes, edges])

  return (
    <div className="fixed inset-0 z-50 bg-[#f0f4f8] flex flex-col">
      <div className="h-12 bg-white border-b border-surface-border flex items-center px-3 gap-2 flex-shrink-0 z-10">
        <button onClick={onBack} className="flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900 transition-colors border border-surface-border rounded-lg px-2.5 py-1.5 hover:bg-slate-50">
          <ChevronLeft size={13}/> Back
        </button>
        <div className="w-px h-5 bg-surface-border mx-1"/>
        {editName
          ? <input autoFocus value={flowName} onChange={e => setFlowName(e.target.value)} onBlur={() => setEditName(false)} onKeyDown={e => e.key === 'Enter' && setEditName(false)}
              className="text-sm font-bold border border-primary/40 rounded-lg px-2.5 py-1 outline-none focus:ring-2 focus:ring-primary/15 max-w-44"/>
          : <button onClick={() => setEditName(true)} className="flex items-center gap-1.5 text-sm font-bold text-slate-800 hover:text-slate-900">{flowName} <Edit3 size={11} className="text-slate-400"/></button>}
        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-500">{nodes.length} nodes</span>
        <div className="flex-1"/>
        <button onClick={undo} disabled={histIdx <= 0} className="text-[11px] border border-surface-border rounded-lg px-2.5 py-1.5 disabled:opacity-40 hover:bg-slate-50 transition-colors text-slate-600">↩ Undo</button>
        <button onClick={redo} disabled={histIdx >= history.length - 1} className="text-[11px] border border-surface-border rounded-lg px-2.5 py-1.5 disabled:opacity-40 hover:bg-slate-50 transition-colors text-slate-600">↪ Redo</button>
        <div className="flex items-center border border-surface-border rounded-lg overflow-hidden">
          <button onClick={() => setZoom(z => Math.max(0.25, z - 0.1))} className="p-1.5 hover:bg-slate-50 transition-colors border-r border-surface-border"><ZoomOut size={12} className="text-slate-600"/></button>
          <span className="text-[11px] font-bold text-slate-600 w-10 text-center">{Math.round(zoom * 100)}%</span>
          <button onClick={() => setZoom(z => Math.min(2.5, z + 0.1))} className="p-1.5 hover:bg-slate-50 transition-colors border-l border-surface-border"><ZoomIn size={12} className="text-slate-600"/></button>
        </div>
        <button onClick={fitScreen} className="text-[11px] border border-surface-border rounded-lg px-2.5 py-1.5 hover:bg-slate-50 transition-colors text-slate-600 flex items-center gap-1"><Maximize2 size={11}/> Fit</button>
        <button onClick={() => setShowPreview(true)} className={clsx('text-[11px] border rounded-lg px-2.5 py-1.5 transition-colors flex items-center gap-1 font-semibold',
          showPreview ? 'border-primary bg-primary-50 text-primary' : 'border-surface-border text-slate-600 hover:bg-slate-50')}>
          <Eye size={12}/> Preview
        </button>
        <a href={buildFlowPreviewUrl(liveFlow)} target="_blank" rel="noopener noreferrer" onClick={stageLivePreview}
          title="Opens this flow as a real, full-page chatbot in a new tab — its shareable link is copied to your clipboard too"
          className={clsx('text-[11px] border rounded-lg px-2.5 py-1.5 transition-colors flex items-center gap-1 font-semibold',
            linkCopied ? 'border-emerald-300 bg-emerald-50 text-emerald-600' : 'border-surface-border text-slate-600 hover:bg-slate-50')}>
          {linkCopied ? <><Check size={12}/> Link copied!</> : <><ExternalLink size={12}/> Live Preview</>}
        </a>
        <button onClick={handleSave} className={clsx('text-xs font-semibold px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-all', saved ? 'bg-emerald-500 text-white' : 'bg-primary text-white hover:bg-primary/90')}>
          {saved ? <><Check size={12}/> Saved!</> : <><Save size={12}/> Save</>}
        </button>
      </div>

      <div className="flex-1 flex overflow-hidden">
        <LeftPalette onAdd={addNode} nodeCount={nodes.length}/>
        <div className="flex-1 relative overflow-hidden">
          <svg className="absolute inset-0 w-full h-full pointer-events-none">
            <defs>
              <pattern id="wc-dots-bg" x={pan.x % 24} y={pan.y % 24} width={24 * zoom} height={24 * zoom} patternUnits="userSpaceOnUse">
                <circle cx={0} cy={0} r={1} fill="#c8d6e5" opacity={0.6}/>
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#wc-dots-bg)"/>
          </svg>
          <svg ref={svgRef} className="absolute inset-0 w-full h-full" style={{ cursor: connecting ? 'crosshair' : panning ? 'grabbing' : 'default' }}
            onMouseDown={onSvgMouseDown} onMouseMove={onSvgMouseMove} onMouseUp={onSvgMouseUp} onMouseLeave={e => { if (!connecting) onSvgMouseUp(e) }}>
            <defs>
              <marker id="wc-arrow" markerWidth={10} markerHeight={7} refX={8} refY={3.5} orient="auto"><polygon points="0 0,10 3.5,0 7" fill="#94a3b8"/></marker>
              <marker id="wc-arrow-sel" markerWidth={10} markerHeight={7} refX={8} refY={3.5} orient="auto"><polygon points="0 0,10 3.5,0 7" fill="#0066ff"/></marker>
            </defs>
            <g transform={`translate(${pan.x},${pan.y}) scale(${zoom})`}>
              {edgePaths.map(e => {
                const hl = e.id === selectedEdgeId || e.fromId === selectedId || e.toId === selectedId
                const fromDef = DEFS[nodes.find(n => n.id === e.fromId)?.type]
                const edgeColor = hl ? '#0066ff' : fromDef?.color || '#94a3b8'
                return (
                  <g key={e.id} style={{ cursor: 'pointer' }} onClick={ev => { ev.stopPropagation(); setSelectedEdgeId(e.id === selectedEdgeId ? null : e.id); setSelectedId(null) }}>
                    <path d={e.path} stroke="transparent" strokeWidth={12 / zoom} fill="none"/>
                    <path d={e.path} stroke={edgeColor} strokeWidth={(hl ? 2.5 : 1.5) / zoom} strokeOpacity={hl ? 1 : 0.55} fill="none" markerEnd={hl ? 'url(#wc-arrow-sel)' : 'url(#wc-arrow)'}/>
                    {e.id === selectedEdgeId && (() => {
                      const from = nodes.find(n => n.id === e.fromId), to = nodes.find(n => n.id === e.toId)
                      if (!from || !to) return null
                      const mx = (from.x + NODE_W + to.x) / 2, my = (from.y + NODE_H / 2 + to.y + NODE_H / 2) / 2, btnR = 9 / zoom
                      return (
                        <g style={{ cursor: 'pointer' }} onClick={ev => { ev.stopPropagation(); applyHistory(nodes, edges.filter(x => x.id !== e.id)); setSelectedEdgeId(null) }}>
                          <circle cx={mx} cy={my} r={btnR} fill="#ef4444" stroke="#fff" strokeWidth={1.5 / zoom}/>
                          <text x={mx} y={my} fontSize={10 / zoom} fill="#fff" textAnchor="middle" dominantBaseline="middle" fontWeight="bold">×</text>
                        </g>
                      )
                    })()}
                  </g>
                )
              })}
              {connecting && (
                <path d={bezier(connecting.x1, connecting.y1, connecting.x2, connecting.y2)} stroke="#0066ff" strokeWidth={2 / zoom}
                  strokeDasharray={`${6 / zoom},${3 / zoom}`} fill="none" markerEnd="url(#wc-arrow-sel)" opacity={0.85} style={{ pointerEvents: 'none' }}/>
              )}
              {nodes.map(n => (
                <NodeCard key={n.id} node={n} selected={n.id === selectedId}
                  onSelect={id => { setSelectedId(id); setSelectedEdgeId(null) }} onDragStart={startDrag} onPortMouseDown={startConnect}
                  isConnectTarget={hoverPortNode === n.id} connecting={connecting}/>
              ))}
            </g>
          </svg>

          {nodes.length === 0 && (
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              <div className="w-16 h-16 rounded-2xl bg-white border border-surface-border flex items-center justify-center mb-4 shadow-sm"><Zap size={28} className="text-slate-300"/></div>
              <p className="text-base font-bold text-slate-500">Start building your flow</p>
              <p className="text-sm text-slate-400 mt-1">Click a node in the left panel to add it</p>
            </div>
          )}
          {connecting && (
            <div className="absolute top-3 left-1/2 -translate-x-1/2 bg-primary text-white text-xs font-semibold px-4 py-1.5 rounded-full shadow-lg pointer-events-none flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-white animate-pulse"/>Drag to a node input port to connect · Esc to cancel
            </div>
          )}
          {selectedEdgeId && !connecting && (
            <div className="absolute top-3 left-1/2 -translate-x-1/2 bg-red-500 text-white text-xs font-semibold px-4 py-1.5 rounded-full shadow-lg pointer-events-none">
              Edge selected · Press Delete to remove · Click × on edge
            </div>
          )}
          <Minimap nodes={nodes} edges={edges} zoom={zoom} pan={pan} svgRef={svgRef}/>
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-3 bg-white/90 border border-surface-border rounded-full px-4 py-1.5 text-[10px] text-slate-400 font-medium shadow-sm pointer-events-none">
            <span>Drag port → connect</span><span className="w-px h-3 bg-slate-200"/><span>Click edge → select</span><span className="w-px h-3 bg-slate-200"/>
            <span>Del → delete selected</span><span className="w-px h-3 bg-slate-200"/><span>Scroll → zoom</span><span className="w-px h-3 bg-slate-200"/><span>Ctrl+Z → undo</span>
          </div>
        </div>

        {selectedNode && (
          <NodeEditModal node={selectedNode} onChange={updateNode} onDelete={() => deleteNode(selectedId)} onClose={() => setSelectedId(null)} allNodes={nodes} subflowOptions={subflowOptions}/>
        )}
      </div>

      {showPreview && (
        <PreviewSimulator flow={{ id: flow.id, name: flowName, kind: flow.kind, graph: { nodes, edges } }} allFlows={allFlows || []} onClose={() => setShowPreview(false)}/>
      )}
    </div>
  )
}

/* ─── flow/subflow card — the Main Flow is one-per-bot and can't be
   duplicated or deleted (that's the whole fix: no way to end up with a
   second "main" that reads like a second bot); Subflows get the full set
   of actions. ── */
function FlowCard({ f, onEdit, onPreview, onLandingPage, onDuplicate, onRemove, onToggle }) {
  const rate = f.stats.triggered ? Math.round((f.stats.completed / f.stats.triggered) * 100) : 0
  const isMain = f.kind === 'main'
  const [linkCopied, setLinkCopied] = useState(false)
  return (
    <div className={clsx('bg-white border rounded-2xl p-3.5 flex flex-col gap-2.5 hover:shadow-[0_4px_20px_-4px_rgba(15,23,42,0.12)] transition-all',
      isMain ? 'border-primary/30 ring-1 ring-primary/10' : 'border-surface-border')}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-[13px] font-semibold text-slate-800 truncate flex items-center gap-1.5">
            {isMain && <Crown size={12} className="text-primary flex-shrink-0"/>}
            {f.name}
          </p>
          <p className="text-[11px] text-slate-400 mt-0.5">{isMain ? `Trigger: ${f.trigger} · ` : ''}{f.graph.nodes.length} nodes</p>
        </div>
        <button onClick={() => onToggle(f.id, !f.active)} className={clsx('text-[9px] font-bold px-2 py-0.5 rounded-full flex-shrink-0', f.active ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-400')}>
          {f.active ? 'Live' : 'Paused'}
        </button>
      </div>
      <div className="flex items-center gap-3 text-[10px] text-slate-400">
        <span><span className="font-bold text-slate-600">{f.stats.triggered.toLocaleString()}</span> triggered</span>
        {f.stats.triggered > 0 && <span className="font-bold text-emerald-500">{rate}% completion</span>}
      </div>
      {/* Edit / Preview / Landing page all act on THIS flow without having to
          open the canvas first. Preview is the in-dashboard popup simulator;
          Landing page opens the same flow as a real full-page chatbot in a new
          tab and copies its shareable link — the two things the canvas
          toolbar offers, hoisted to the list. `flex-wrap` keeps the row from
          overflowing a narrow card once the duplicate/delete icons join it. */}
      <div className="flex items-center flex-wrap gap-1.5 mt-1">
        <button onClick={() => onEdit(f.id)} className="btn-secondary flex-1 justify-center !py-1.5 !px-2 whitespace-nowrap"><Edit3 size={11}/> Edit</button>
        <button onClick={() => onPreview(f)} className="btn-secondary flex-1 justify-center !py-1.5 !px-2 whitespace-nowrap"><Eye size={11}/> Preview</button>
        {/* A real link, not a button running window.open — that's what makes
            it reliably open a NEW TAB (a scripted window is a blockable
            popup; a user-clicked link never is) and also gets middle-click /
            ctrl-click and a visible URL on hover for free. onClick stages the
            flow for the new tab before the browser follows the href. */}
        <a href={buildFlowPreviewUrl(f)} target="_blank" rel="noopener noreferrer"
          onClick={() => { onLandingPage(f)?.then(() => { setLinkCopied(true); setTimeout(() => setLinkCopied(false), 2000) }, () => {}) }}
          title="Opens this flow as a real, full-page chatbot in a new tab — its shareable link is copied to your clipboard too"
          className={clsx('btn-secondary flex-1 justify-center !py-1.5 !px-2 whitespace-nowrap', linkCopied && '!border-emerald-300 !bg-emerald-50 !text-emerald-600')}>
          {linkCopied ? <><Check size={11}/> Copied!</> : <><ExternalLink size={11}/> Landing page</>}
        </a>
        {!isMain && (
          // `ml-auto` so that when this group wraps below the three action
          // buttons on a narrow card it sits flush right, reading as a
          // deliberate secondary row rather than two stray icons.
          <div className="flex items-center gap-1.5 ml-auto">
            <button onClick={() => onDuplicate(f)} title="Duplicate" className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"><Copy size={13}/></button>
            <button onClick={() => onRemove(f.id)} title="Delete" className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors"><Trash2 size={13}/></button>
          </div>
        )}
      </div>
    </div>
  )
}

/* ─── page: flow list + entry into the canvas ─────────────────────────── */
export default function WebChatFlowBuilder() {
  const [flows, setFlows] = useState(INITIAL_FLOWS)

  /* The behaviour half of this bot, saved under config.flows — the SAME bot
     whose design the Appearance section edits under config.appearance, and the
     same bot id that goes in the install snippet. This is what makes the
     installed widget run THIS automation rather than a generic demo: the
     embed loads these flows by bot id and executes the main one.

     Until now `flows` was in-memory only, so a merchant's automation did not
     survive a refresh, let alone reach a website. */
  const botId = useBotId()
  usePublishSection(botId, SECTION_FLOWS, flows)
  useLoadSection(botId, SECTION_FLOWS, saved => {
    // Replace rather than merge: flows are an ordered list the merchant owns,
    // and merging a saved list into the seeded one would resurrect demo flows
    // they deleted.
    if (Array.isArray(saved) && saved.length) setFlows(saved)
  })
  const [editingId, setEditingId] = useState(null)
  const [previewingId, setPreviewingId] = useState(null)

  const editingFlow = flows.find(f => f.id === editingId)
  const previewingFlow = flows.find(f => f.id === previewingId)
  const mainFlow = flows.find(f => f.kind === 'main')
  const subflows = flows.filter(f => f.kind === 'subflow')

  function toggle(id, active) { setFlows(fs => fs.map(f => f.id === id ? { ...f, active } : f)) }
  function remove(id) { setFlows(fs => fs.filter(f => f.id !== id)) }
  function duplicate(f) { setFlows(fs => [...fs, { ...f, id: `s${Date.now()}`, name: `${f.name} (copy)`, active: false, stats: { triggered: 0, completed: 0 } }]) }
  function createSubflow() {
    const id = `s${Date.now()}`
    const nf = { id, kind: 'subflow', name: 'New Subflow', active: false,
      graph: { nodes: [{ id: 'n1', type: 'send_text', x: 60, y: 180, data: makeDefaults('send_text') }], edges: [] },
      stats: { triggered: 0, completed: 0 } }
    setFlows(fs => [...fs, nf])
    setEditingId(id)
  }
  function saveGraph({ name, graph }) {
    setFlows(fs => fs.map(f => f.id === editingId ? { ...f, name, graph, active: true } : f))
  }

  if (editingFlow) {
    return <BuilderView flow={editingFlow} onBack={() => setEditingId(null)} onSave={saveGraph} allFlows={flows}/>
  }

  return (
    <div className="space-y-6">
      {/* One bot per channel: exactly one Main Flow, never creatable/deletable
         as a second one — the fix for "we can't create multiple bots in the
         same place". It can have several Trigger nodes (see Jump to Step),
         and routes into Subflows below for anything more than a couple of
         steps long. */}
      <div className="space-y-3">
        <div>
          <p className="text-[12px] font-bold text-slate-700">Main Flow</p>
          <p className="text-[11px] text-slate-400">This bot's one entry map — every trigger it responds to lives here, each routing inline or into a Subflow below.</p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-3">
          {mainFlow && (
            <FlowCard f={mainFlow} onEdit={setEditingId} onToggle={toggle}
              onPreview={f => setPreviewingId(f.id)}
              onLandingPage={f => stageFlowLivePreview(f, flows)}/>
          )}
        </div>
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[12px] font-bold text-slate-700">Subflows</p>
            <p className="text-[11px] text-slate-400">Reusable pieces of logic, called from the Main Flow (or each other) via "Go to Subflow" — free to create as many as this bot needs.</p>
          </div>
          <button onClick={createSubflow} className="btn-primary flex-shrink-0"><Plus size={13}/> Create Subflow</button>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-3">
          {subflows.map(f => (
            <FlowCard key={f.id} f={f} onEdit={setEditingId} onDuplicate={duplicate} onRemove={remove} onToggle={toggle}
              onPreview={pf => setPreviewingId(pf.id)}
              onLandingPage={pf => stageFlowLivePreview(pf, flows)}/>
          ))}
          {subflows.length === 0 && <p className="text-[11px] text-slate-400 py-4">No subflows yet.</p>}
        </div>
      </div>

      {/* The same popup simulator the canvas runs, opened straight from a
          card's Preview button. Keyed so switching which flow is being
          previewed starts a clean run instead of carrying the previous
          flow's simulation state over. */}
      {previewingFlow && (
        <PreviewSimulator
          key={previewingFlow.id}
          flow={{ id: previewingFlow.id, name: previewingFlow.name, kind: previewingFlow.kind, graph: previewingFlow.graph }}
          allFlows={flows}
          onClose={() => setPreviewingId(null)}/>
      )}
    </div>
  )
}
