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
  Calendar, MapPin, CreditCard, Pencil, Upload, Bot, CornerDownRight, Workflow, Crown,
} from 'lucide-react'
import { NativeSelect } from '../components/Select'
import { QUESTION_TYPES as WEBCHAT_QUESTION_TYPES } from '../constants/webchatQuestionTypes'
import { WIDGET_CFG_STORAGE_KEY } from './WebChatAppearance'

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
  end:          { label: 'End Flow',         icon: X,               color: '#64748b', cat: 'system' },
  send_text:    { label: 'Send Message',     icon: Send,            color: '#10b981', cat: 'send' },
  send_media:   { label: 'Send Image',       icon: ImageIcon,       color: '#10b981', cat: 'send' },
  quick_replies:{ label: 'Quick Replies',    icon: MessageSquareText, color: '#10b981', cat: 'send' },
  show_article: { label: 'Show Help Article', icon: BookOpen,       color: '#10b981', cat: 'send' },
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
]

function makeDefaults(type) {
  const base = { name: DEFS[type]?.label || type }
  if (DEFS[type]?.cat === 'ask' && DEFS[type]?.questionType) return { ...base, questionType: DEFS[type].questionType, question: '', saveAs: '' }
  switch (type) {
    case 'start':         return { ...base, trigger: 'widget_open', keywords: '', pageUrl: '', idleSeconds: 30 }
    case 'end':           return { ...base, endMessage: '' }
    case 'send_text':     return { ...base, message: '' }
    case 'send_media':    return { ...base, mediaType: 'image', caption: '' }
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

/* ─── the one Main Flow, and the subflows it routes into ─────────────────
   Exactly one bot per channel: every trigger this bot responds to is a Start
   node in this SAME Main Flow's canvas (never a separate top-level flow —
   that's what made it look like several disconnected bots before). Anything
   more than a couple of nodes long is factored out into a Subflow and
   reached via "Go to Subflow", so the Main Flow itself stays a readable map
   of "what triggers what" instead of one giant tangle. ── */
function seedMainFlow(subflowIdByName) {
  const nodes = [
    // Visitor Idle → inline nudge (short enough to not need its own subflow)
    { id: 'n1', type: 'start',        x: 40,  y: 160, data: { name: 'Visitor Idle', trigger: 'idle_time', keywords: '', pageUrl: '', idleSeconds: 45 } },
    { id: 'n2', type: 'send_text',    x: 300, y: 160, data: { name: 'Nudge', message: 'Still there? 👋 Need help finding something?' } },
    { id: 'n3', type: 'quick_replies', x: 560, y: 160, data: { name: 'Offer help', message: '', buttons: [{ id: '1', label: 'Yes, help me' }, { id: '2', label: 'No thanks' }] } },
    { id: 'n4', type: 'notify',       x: 820, y: 60,  data: { name: 'Alert agent', note: 'Visitor requested help' } },
    { id: 'n5', type: 'end',          x: 820, y: 260, data: { name: 'End', endMessage: '' } },
    // Exit Intent → same nudge, via Jump to Step (not a separate trigger's worth of nodes)
    { id: 'n6', type: 'start',        x: 40,  y: 360, data: { name: 'Exit Intent', trigger: 'exit_intent', keywords: '', pageUrl: '', idleSeconds: 30 } },
    { id: 'n7', type: 'jump',         x: 300, y: 360, data: { name: 'Reuse nudge', targetNodeId: 'n2' } },
    // The rest of this bot's triggers each route straight into a Subflow —
    // this is the whole point: one Main Flow, several entry points, and the
    // actual multi-step logic lives in reusable Subflows instead of more
    // top-level flows.
    { id: 'n8',  type: 'start',        x: 40,  y: 500, data: { name: 'Widget Opened', trigger: 'widget_open', keywords: '', pageUrl: '', idleSeconds: 30 } },
    { id: 'n9',  type: 'goto_subflow', x: 300, y: 500, data: { name: 'Capture the lead', subflowId: subflowIdByName['Lead Capture Funnel'] } },
    { id: 'n10', type: 'start',        x: 40,  y: 600, data: { name: 'Keyword Match', trigger: 'keyword', keywords: 'human, agent, support', pageUrl: '', idleSeconds: 30 } },
    { id: 'n11', type: 'goto_subflow', x: 300, y: 600, data: { name: 'Hand off to support', subflowId: subflowIdByName['Support Handoff'] } },
    { id: 'n12', type: 'start',        x: 40,  y: 700, data: { name: 'Test All Questions', trigger: 'keyword', keywords: 'test all questions, qa test', pageUrl: '', idleSeconds: 30 } },
    { id: 'n13', type: 'goto_subflow', x: 300, y: 700, data: { name: 'Run question-type test', subflowId: subflowIdByName['Question Types Test (All 26)'] } },
    { id: 'n14', type: 'start',        x: 40,  y: 800, data: { name: 'Demo Keyword', trigger: 'keyword', keywords: 'demo, book a demo, schedule a demo', pageUrl: '', idleSeconds: 30 } },
    { id: 'n15', type: 'goto_subflow', x: 300, y: 800, data: { name: 'Book the demo', subflowId: subflowIdByName['Book a Product Demo'] } },
  ]
  const edges = [
    { id: 'e1', fromId: 'n1', fromPort: 0, toId: 'n2' },
    { id: 'e2', fromId: 'n2', fromPort: 0, toId: 'n3' },
    { id: 'e3', fromId: 'n3', fromPort: 0, toId: 'n4' },
    { id: 'e4', fromId: 'n3', fromPort: 1, toId: 'n5' },
    { id: 'e5', fromId: 'n6', fromPort: 0, toId: 'n7' },
    { id: 'e6', fromId: 'n8', fromPort: 0, toId: 'n9' },
    { id: 'e7', fromId: 'n10', fromPort: 0, toId: 'n11' },
    { id: 'e8', fromId: 'n12', fromPort: 0, toId: 'n13' },
    { id: 'e9', fromId: 'n14', fromPort: 0, toId: 'n15' },
  ]
  return { nodes, edges }
}

function seedSubflows() {
  const leadCapture = {
    nodes: [
      { id: 'n1', type: 'send_text',    x: 40,  y: 160, data: { name: 'Greeting', message: "Hi there! 👋 I'm here to help — mind sharing a few details first?" } },
      { id: 'n2', type: 'lead_capture', x: 300, y: 160, data: { name: 'Capture lead', captureName: true, captureEmail: true, capturePhone: false, message: '' } },
      { id: 'n3', type: 'crm',          x: 560, y: 160, data: { name: 'Push lead', note: 'Push visitor + collected fields to CRM' } },
    ],
    edges: [
      { id: 'e1', fromId: 'n1', fromPort: 0, toId: 'n2' },
      { id: 'e2', fromId: 'n2', fromPort: 0, toId: 'n3' },
    ],
  }
  const supportHandoff = {
    nodes: [
      { id: 'n1', type: 'send_text', x: 40,  y: 160, data: { name: 'Bridge message', message: "Sure — connecting you to our support team now..." } },
      { id: 'n2', type: 'live_chat', x: 300, y: 160, data: { name: 'Handover', note: 'Pauses the bot and assigns this conversation to a human agent' } },
    ],
    edges: [
      { id: 'e1', fromId: 'n1', fromPort: 0, toId: 'n2' },
    ],
  }
  const questionTypesTest = buildQuestionTypesTestFlow()
  const demoBooking = buildDemoBookingFlow()
  return [
    { id: 's1', kind: 'subflow', name: 'Lead Capture Funnel',           active: true,  graph: leadCapture,      stats: { triggered: 1530, completed: 1120 } },
    { id: 's2', kind: 'subflow', name: 'Support Handoff',               active: true,  graph: supportHandoff,   stats: { triggered: 0,    completed: 0 } },
    { id: 's3', kind: 'subflow', name: 'Question Types Test (All 26)', active: true,  graph: questionTypesTest, stats: { triggered: 0,    completed: 0 } },
    { id: 's4', kind: 'subflow', name: 'Book a Product Demo',           active: true,  graph: demoBooking,      stats: { triggered: 340,  completed: 251 } },
  ]
}

function seedFlows() {
  const subflows = seedSubflows()
  const byName = Object.fromEntries(subflows.map(s => [s.name, s.id]))
  const mainFlow = {
    id: 'main', kind: 'main', name: 'Main Flow', active: true,
    trigger: 'Visitor Idle · Exit Intent · Widget Opened · Message Keyword',
    graph: seedMainFlow(byName),
    stats: { triggered: 862 + 1530 + 340, completed: 640 + 1120 + 251 },
  }
  return [mainFlow, ...subflows]
}

/* ─── Book a Product Demo — a realistic end-to-end use case, not just a
   question-type showcase: qualifies the visitor by team size and branches
   into an Enterprise handoff path (talk to a human AE) vs. a Self-Serve path
   (pick a date/time and get an automatic confirmation), then tags + pushes
   the lead to CRM. Exercises 6 different question types plus branching
   logic, send/action/utility nodes — one coherent story end to end. ── */
function buildDemoBookingFlow() {
  const nodes = [
    { id: 'n2',  type: 'send_text',  x: 300,  y: 220, data: { name: 'Kick off', message: "Awesome — let's get a demo on the calendar! Just need a few quick details." } },
    { id: 'n3',  type: 'ask_short',  x: 560,  y: 220, data: { name: 'Name',       questionType: 'short', question: "What's your name?", saveAs: 'name' } },
    { id: 'n4',  type: 'ask_email',  x: 820,  y: 220, data: { name: 'Work email', questionType: 'email', question: "What's your work email?", saveAs: 'email' } },
    { id: 'n5',  type: 'ask_single', x: 1080, y: 220, data: { name: 'Team size',  questionType: 'single', question: 'How big is your team? (1–10 / 11–50 / 51–200 / 200+)', saveAs: 'team_size' } },
    { id: 'n6',  type: 'condition',  x: 1340, y: 220, data: { name: 'Qualify lead', variable: 'team_size', operator: 'contains', value: '200+', trueLabel: 'Enterprise', falseLabel: 'Self-Serve' } },

    // Enterprise branch (condition port 0 = true) — routes to a human AE, no self-serve booking
    { id: 'n7',  type: 'send_text',  x: 1600, y: 60,  data: { name: 'Enterprise reply', message: "Got it — for teams your size we'll connect you directly with our Enterprise team." } },
    { id: 'n8',  type: 'notify',     x: 1860, y: 60,  data: { name: 'Alert AE', note: 'Enterprise lead — team_size 200+, route to an Account Executive' } },
    { id: 'n9',  type: 'live_chat',  x: 2120, y: 60,  data: { name: 'Handover', note: 'Pauses the bot and hands the visitor to a live Enterprise sales agent' } },

    // Self-Serve branch (condition port 1 = false) — books the slot itself
    { id: 'n10', type: 'ask_phone',  x: 1600, y: 380, data: { name: 'Phone',      questionType: 'phone', question: "What's the best number for a reminder call?", saveAs: 'phone' } },
    { id: 'n11', type: 'ask_date',   x: 1860, y: 380, data: { name: 'Demo date',  questionType: 'date',  question: 'What date works best for your demo?', saveAs: 'demo_date' } },
    { id: 'n12', type: 'ask_time',   x: 2120, y: 380, data: { name: 'Demo time',  questionType: 'time',  question: 'And what time?', saveAs: 'demo_time' } },
    { id: 'n13', type: 'ask_appt',   x: 2380, y: 380, data: { name: 'Confirm slot', questionType: 'appt', question: 'Confirm your demo slot', saveAs: 'demo_slot' } },
    { id: 'n14', type: 'send_text',  x: 2640, y: 380, data: { name: 'Confirmation', message: "You're all set! We'll send a calendar invite to your email shortly. See you then 🎉" } },
    { id: 'n15', type: 'tag',        x: 2900, y: 380, data: { name: 'Tag lead', tagName: 'demo-booked' } },
    { id: 'n16', type: 'crm',        x: 3160, y: 380, data: { name: 'Push to CRM', note: 'Push visitor + name/email/team_size/demo_date/demo_time to CRM' } },
    { id: 'n17', type: 'end',        x: 3420, y: 380, data: { name: 'End', endMessage: '' } },
  ]
  const edges = [
    { id: 'e2',  fromId: 'n2',  fromPort: 0, toId: 'n3'  },
    { id: 'e3',  fromId: 'n3',  fromPort: 0, toId: 'n4'  },
    { id: 'e4',  fromId: 'n4',  fromPort: 0, toId: 'n5'  },
    { id: 'e5',  fromId: 'n5',  fromPort: 0, toId: 'n6'  },
    { id: 'e6',  fromId: 'n6',  fromPort: 0, toId: 'n7'  }, // Enterprise
    { id: 'e7',  fromId: 'n7',  fromPort: 0, toId: 'n8'  },
    { id: 'e8',  fromId: 'n8',  fromPort: 0, toId: 'n9'  },
    { id: 'e9',  fromId: 'n6',  fromPort: 1, toId: 'n10' }, // Self-Serve
    { id: 'e10', fromId: 'n10', fromPort: 0, toId: 'n11' },
    { id: 'e11', fromId: 'n11', fromPort: 0, toId: 'n12' },
    { id: 'e12', fromId: 'n12', fromPort: 0, toId: 'n13' },
    { id: 'e13', fromId: 'n13', fromPort: 0, toId: 'n14' },
    { id: 'e14', fromId: 'n14', fromPort: 0, toId: 'n15' },
    { id: 'e15', fromId: 'n15', fromPort: 0, toId: 'n16' },
    { id: 'e16', fromId: 'n16', fromPort: 0, toId: 'n17' },
  ]
  return { nodes, edges }
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
const SIM_AUTO_MESSAGE = ['send_text', 'send_media', 'show_article']
const SIM_AUTO_LOG = ['tag', 'untag', 'setfield', 'notify', 'crm', 'lead_capture', 'csat_rating', 'delay', 'setvar', 'webhook']


function simBotText(node) {
  const d = node.data || {}
  switch (node.type) {
    case 'send_text':    return d.message || '(empty message)'
    case 'send_media':   return `🖼️ [${d.mediaType || 'image'}]${d.caption ? ' — ' + d.caption : ''}`
    case 'show_article':  return `📄 Help article: ${d.articleTitle || d.articleUrl || 'Untitled'}`
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

/* ─── Interactive answer control per question type ────────────────────────
   WebChatAppearance.jsx's own renderAnswerControl() draws what each of the
   26 question types LOOKS like, but every one of those is a static, inert
   mockup (no onClick/onChange at all) — it's a design preview, not something
   you can actually answer. This is the interactive equivalent so the flow
   Preview simulator can be driven through every question type for real,
   styled to match the same look instead of one generic text box for all 26. ── */
function AskAnswerControl({ questionType, accent, onSubmit }) {
  const [val, setVal] = useState('')
  const [multi, setMulti] = useState([])
  const [range, setRange] = useState({ a: '', b: '' })
  const btn = 'text-[11px] font-semibold px-3 py-1.5 rounded-lg transition-colors'
  const primaryBtn = { background: accent, color: '#fff' }

  const OPTIONS = ['Option A', 'Option B', 'Option C']

  switch (questionType) {
    case 'short': case 'number': case 'email': case 'phone': case 'url': {
      const type = { number: 'number', email: 'email', phone: 'tel', url: 'url' }[questionType] || 'text'
      return (
        <div className="flex items-center gap-1.5">
          <input autoFocus type={type} value={val} onChange={e => setVal(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && val.trim() && onSubmit(val.trim())}
            placeholder="Type an answer…"
            className="flex-1 rounded-xl border border-surface-border px-3 py-2 text-[12px] outline-none focus:border-primary/40"/>
          <button onClick={() => val.trim() && onSubmit(val.trim())} className="p-2 rounded-xl flex-shrink-0" style={primaryBtn}><Send size={13}/></button>
        </div>
      )
    }
    case 'long':
      return (
        <div className="flex items-end gap-1.5">
          <textarea autoFocus rows={2} value={val} onChange={e => setVal(e.target.value)}
            placeholder="Type an answer…"
            className="flex-1 rounded-xl border border-surface-border px-3 py-2 text-[12px] outline-none focus:border-primary/40 resize-none"/>
          <button onClick={() => val.trim() && onSubmit(val.trim())} className="p-2 rounded-xl flex-shrink-0" style={primaryBtn}><Send size={13}/></button>
        </div>
      )
    case 'single':
      return (
        <div className="space-y-1.5">
          {OPTIONS.map(o => (
            <button key={o} onClick={() => onSubmit(o)}
              className={clsx(btn, 'w-full flex items-center gap-2 border border-slate-200 bg-white text-slate-600 hover:border-primary/40 text-left')}>
              <div className="w-3 h-3 rounded-full border-2 border-slate-300 flex-shrink-0"/>{o}
            </button>
          ))}
        </div>
      )
    case 'multi':
      return (
        <div className="space-y-1.5">
          {OPTIONS.map(o => {
            const on = multi.includes(o)
            return (
              <button key={o} onClick={() => setMulti(p => on ? p.filter(x => x !== o) : [...p, o])}
                className={clsx(btn, 'w-full flex items-center gap-2 border text-left', on ? 'border-primary/40 bg-primary-50 text-primary' : 'border-slate-200 bg-white text-slate-600')}>
                <div className={clsx('w-3 h-3 rounded border-2 flex-shrink-0', on ? 'bg-primary border-primary' : 'border-slate-300')}/>{o}
              </button>
            )
          })}
          <button onClick={() => onSubmit(multi.length ? multi.join(', ') : '(none selected)')} className={clsx(btn, 'w-full text-center')} style={primaryBtn}>Done</button>
        </div>
      )
    case 'dropdown':
      return (
        <div className="flex items-center gap-1.5">
          <select value={val} onChange={e => setVal(e.target.value)}
            className="flex-1 rounded-xl border border-surface-border px-3 py-2 text-[12px] outline-none focus:border-primary/40 bg-white">
            <option value="">Select an option</option>
            {OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
          </select>
          <button onClick={() => val && onSubmit(val)} disabled={!val} className={clsx(btn, !val && 'opacity-40')} style={primaryBtn}>Go</button>
        </div>
      )
    case 'yesno':
      return (
        <div className="grid grid-cols-2 gap-2">
          <button onClick={() => onSubmit('Yes')} className={clsx(btn, 'border-2 border-emerald-400 bg-emerald-50 text-emerald-600')}>Yes</button>
          <button onClick={() => onSubmit('No')} className={clsx(btn, 'border-2 border-slate-200 bg-white text-slate-500')}>No</button>
        </div>
      )
    case 'rating':
      return (
        <div className="flex gap-1 justify-center">
          {[1, 2, 3, 4, 5].map(n => (
            <button key={n} onClick={() => onSubmit(`${n} star${n === 1 ? '' : 's'}`)}>
              <Star size={24} className="text-amber-400 hover:fill-amber-400 transition-colors"/>
            </button>
          ))}
        </div>
      )
    case 'nps':
      return (
        <div>
          <div className="flex gap-0.5">
            {Array.from({ length: 11 }, (_, i) => (
              <button key={i} onClick={() => onSubmit(String(i))}
                className={clsx('flex-1 py-1.5 text-[9px] font-bold text-center rounded border transition-colors',
                  i <= 6 ? 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100' : i <= 8 ? 'bg-amber-50 border-amber-200 text-amber-600 hover:bg-amber-100' : 'bg-emerald-50 border-emerald-200 text-emerald-600 hover:bg-emerald-100')}>
                {i}
              </button>
            ))}
          </div>
          <div className="flex justify-between text-[9px] text-slate-400 mt-1"><span>Not likely</span><span>Very likely</span></div>
        </div>
      )
    case 'date':
      return (
        <div className="flex items-center gap-1.5">
          <input autoFocus type="date" value={val} onChange={e => setVal(e.target.value)}
            className="flex-1 rounded-xl border border-surface-border px-3 py-2 text-[12px] outline-none focus:border-primary/40"/>
          <button onClick={() => val && onSubmit(val)} disabled={!val} className={clsx(btn, !val && 'opacity-40')} style={primaryBtn}>Go</button>
        </div>
      )
    case 'daterange':
      return (
        <div className="space-y-1.5">
          <div className="flex gap-1.5">
            <input type="date" value={range.a} onChange={e => setRange(p => ({ ...p, a: e.target.value }))} className="flex-1 rounded-lg border border-surface-border px-2 py-1.5 text-[11px]"/>
            <input type="date" value={range.b} onChange={e => setRange(p => ({ ...p, b: e.target.value }))} className="flex-1 rounded-lg border border-surface-border px-2 py-1.5 text-[11px]"/>
          </div>
          <button onClick={() => range.a && range.b && onSubmit(`${range.a} → ${range.b}`)} disabled={!range.a || !range.b}
            className={clsx(btn, 'w-full', (!range.a || !range.b) && 'opacity-40')} style={primaryBtn}>Go</button>
        </div>
      )
    case 'time':
      return (
        <div className="flex items-center gap-1.5">
          <input autoFocus type="time" value={val} onChange={e => setVal(e.target.value)}
            className="flex-1 rounded-xl border border-surface-border px-3 py-2 text-[12px] outline-none focus:border-primary/40"/>
          <button onClick={() => val && onSubmit(val)} disabled={!val} className={clsx(btn, !val && 'opacity-40')} style={primaryBtn}>Go</button>
        </div>
      )
    case 'appt':
      return (
        <div className="grid grid-cols-3 gap-1.5">
          {['Mon 10 AM', 'Tue 2 PM', 'Wed 11 AM'].map(s => (
            <button key={s} onClick={() => onSubmit(s)} className={clsx(btn, 'border border-slate-200 bg-white text-slate-600 hover:border-primary/40')}>{s}</button>
          ))}
        </div>
      )
    case 'file':
      return <button onClick={() => onSubmit('📎 sample-file.pdf')} className={clsx(btn, 'w-full flex items-center justify-center gap-1.5 border-2 border-dashed border-slate-300 text-slate-500')}><Upload size={13}/> Simulate upload</button>
    case 'image':
      return <button onClick={() => onSubmit('🖼️ screenshot.png')} className={clsx(btn, 'w-full flex items-center justify-center gap-1.5 border-2 border-dashed border-slate-300 text-slate-500')}><ImageIcon size={13}/> Simulate upload</button>
    case 'signature':
      return <button onClick={() => onSubmit('✍️ Signed')} className={clsx(btn, 'w-full flex items-center justify-center gap-1.5 border-2 border-dashed border-slate-300 text-slate-500')}><Pencil size={13}/> Sign</button>
    case 'location':
      return (
        <div className="flex items-center gap-1.5">
          <input autoFocus value={val} onChange={e => setVal(e.target.value)} placeholder="Search address…"
            className="flex-1 rounded-xl border border-surface-border px-3 py-2 text-[12px] outline-none focus:border-primary/40"/>
          <button onClick={() => onSubmit(val.trim() || '📍 Shared current location')} className="p-2 rounded-xl flex-shrink-0" style={primaryBtn}><MapPin size={13}/></button>
        </div>
      )
    case 'payment':
      return <button onClick={() => onSubmit('💳 Payment completed')} className={clsx(btn, 'w-full flex items-center justify-center gap-1.5')} style={primaryBtn}><CreditCard size={13}/> Pay now</button>
    case 'otp':
      return (
        <div className="flex items-center gap-1.5">
          <input autoFocus maxLength={6} value={val} onChange={e => setVal(e.target.value.replace(/\D/g, ''))} placeholder="6-digit code"
            className="flex-1 rounded-xl border border-surface-border px-3 py-2 text-[12px] outline-none focus:border-primary/40 tracking-widest text-center font-mono"/>
          <button onClick={() => val && onSubmit(val)} disabled={!val} className={clsx(btn, !val && 'opacity-40')} style={primaryBtn}>Verify</button>
        </div>
      )
    case 'form':
      return <button onClick={() => onSubmit('Priya Sharma · priya@email.com · +91 98765 43210')} className={clsx(btn, 'w-full')} style={primaryBtn}>Submit details</button>
    case 'carousel':
      return (
        <div className="flex gap-1.5">
          {['Starter Plan', 'Growth Plan', 'Enterprise Plan'].map(p => (
            <button key={p} onClick={() => onSubmit(p)} className={clsx(btn, 'flex-1 border border-slate-200 bg-white text-slate-600 hover:border-primary/40 text-[10px]')}>{p}</button>
          ))}
        </div>
      )
    case 'carousel_buttons':
      return (
        <div className="flex gap-1.5">
          {['Starter', 'Growth', 'Enterprise'].map(p => (
            <button key={p} onClick={() => onSubmit(`Selected: ${p}`)} className={clsx(btn, 'flex-1 border border-slate-200 bg-white text-slate-600 hover:border-primary/40')}>{p}</button>
          ))}
        </div>
      )
    case 'catalog':
      return (
        <div className="flex gap-1.5">
          {['Classic Tee', 'Denim Jacket'].map(p => (
            <button key={p} onClick={() => onSubmit(`Added to cart: ${p}`)} className={clsx(btn, 'flex-1 border border-slate-200 bg-white text-slate-600 hover:border-primary/40 text-[10px]')}>{p}</button>
          ))}
        </div>
      )
    default:
      return (
        <div className="flex items-center gap-1.5">
          <input autoFocus value={val} onChange={e => setVal(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && val.trim() && onSubmit(val.trim())}
            placeholder="Type an answer…"
            className="flex-1 rounded-xl border border-surface-border px-3 py-2 text-[12px] outline-none focus:border-primary/40"/>
          <button onClick={() => val.trim() && onSubmit(val.trim())} className="p-2 rounded-xl flex-shrink-0" style={primaryBtn}><Send size={13}/></button>
        </div>
      )
  }
}

/* Same look as the real widget — reads the Widget Builder's live settings
   from localStorage (the same bridge WebChatLandingPage.jsx uses) so this
   simulator isn't a visually-disconnected second UI. */
function useWidgetCfg() {
  const [cfg, setCfg] = useState(null)
  useEffect(() => {
    try { setCfg(JSON.parse(localStorage.getItem(WIDGET_CFG_STORAGE_KEY) || 'null')) } catch { setCfg(null) }
  }, [])
  return cfg || {
    colorMode: 'gradient', color: '#0066ff', colorEnd: '#8B5CF6',
    botName: 'ChatBot', avatarStyle: 'icon', avatarEmoji: '🤖', avatarImage: '',
  }
}

function PreviewSimulator({ flow, allFlows, onClose }) {
  const cfg = useWidgetCfg()
  const brandBg = cfg.colorMode === 'gradient' ? `linear-gradient(135deg, ${cfg.color} 0%, ${cfg.colorEnd || cfg.color} 100%)` : cfg.color
  const [graph, setGraph] = useState(flow.graph)
  const [graphLabel, setGraphLabel] = useState(flow.name)
  const [currentId, setCurrentId] = useState(null)
  const [messages, setMessages] = useState([])
  const [awaiting, setAwaiting] = useState(null) // { type: 'ask'|'quick_replies'|'branch', node }
  const [ended, setEnded] = useState(false)
  const [input, setInput] = useState('')
  const timerRef = useRef(null)
  const midRef = useRef(0)
  const listRef = useRef(null)

  // A flow can have more than one Trigger/Start node (several independent entry
  // points sharing downstream logic) — when it does, ask which one to simulate
  // instead of silently picking the first. Computed from flow.graph (not the
  // possibly-swapped `graph` state) since this only makes sense for the top
  // of the flow being previewed, not a subflow jumped into mid-simulation.
  const starts = useMemo(() => flow.graph.nodes.filter(n => n.type === 'start'), [flow])
  const [pickingStart, setPickingStart] = useState(starts.length > 1)

  const push = useCallback((type, text) => setMessages(m => [...m, { id: ++midRef.current, type, text }]), [])

  const beginFrom = useCallback((startId) => {
    clearTimeout(timerRef.current)
    setMessages([]); setAwaiting(null); setEnded(false); setInput(''); setPickingStart(false)
    setGraph(flow.graph); setGraphLabel(flow.name)
    setCurrentId(startId)
  }, [flow])

  const reset = useCallback(() => {
    if (starts.length > 1) { setPickingStart(true); clearTimeout(timerRef.current); setMessages([]); setAwaiting(null); setEnded(false); setInput(''); setCurrentId(null); return }
    const s = starts[0] || flow.graph.nodes[0] || null
    if (s) beginFrom(s.id)
    else { clearTimeout(timerRef.current); setMessages([]); setAwaiting(null); setInput(''); setEnded(true) }
  }, [starts, flow, beginFrom])

  useEffect(() => { reset() }, [reset])
  useEffect(() => () => clearTimeout(timerRef.current), [])
  useEffect(() => { if (listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight }, [messages, awaiting])

  const nextFrom = useCallback((nodeId, port) => {
    const e = graph.edges.find(x => x.fromId === nodeId && (x.fromPort || 0) === port)
    return e ? e.toId : null
  }, [graph])

  const finishOrAdvance = useCallback((nodeId, port) => {
    const nid = nextFrom(nodeId, port)
    if (nid) setCurrentId(nid)
    else { setEnded(true); push('system', '⏹️ Flow ended (no further nodes)') }
  }, [nextFrom, push])

  useEffect(() => {
    if (!currentId || ended || awaiting) return
    const node = graph.nodes.find(n => n.id === currentId)
    if (!node) { setEnded(true); push('system', '⚠️ Flow ended — node not found'); return }

    if (node.type === 'start') {
      timerRef.current = setTimeout(() => finishOrAdvance(node.id, 0), 250)
      return
    }
    if (SIM_AUTO_MESSAGE.includes(node.type)) {
      push('bot', simBotText(node))
      timerRef.current = setTimeout(() => finishOrAdvance(node.id, 0), 700)
      return
    }
    if (SIM_AUTO_LOG.includes(node.type)) {
      push('system', simLogText(node))
      timerRef.current = setTimeout(() => finishOrAdvance(node.id, 0), 500)
      return
    }
    if (node.type.startsWith('ask_')) {
      push('bot', node.data?.question || 'Please answer:')
      setAwaiting({ type: 'ask', node })
      return
    }
    if (node.type === 'quick_replies') {
      if (node.data?.message) push('bot', node.data.message)
      setAwaiting({ type: 'quick_replies', node })
      return
    }
    if (node.type === 'condition' || node.type === 'split') {
      setAwaiting({ type: 'branch', node })
      return
    }
    if (node.type === 'jump') {
      const target = graph.nodes.find(n => n.id === node.data?.targetNodeId)
      if (!target) { setEnded(true); push('system', '⚠️ Jump target not set/found — simulation ends here.'); return }
      push('system', `↪️ Jumping to: ${target.data?.name || target.type}`)
      timerRef.current = setTimeout(() => setCurrentId(target.id), 400)
      return
    }
    if (node.type === 'goto_subflow') {
      const sub = (allFlows || []).find(f => f.id === node.data?.subflowId && f.kind === 'subflow')
      if (!sub) { setEnded(true); push('system', '⚠️ Subflow not set/found — simulation ends here.'); return }
      push('system', `↪️ Jumping to subflow: ${sub.name}`)
      timerRef.current = setTimeout(() => {
        const s = sub.graph.nodes.find(n => n.type === 'start') || sub.graph.nodes[0] || null
        setGraph(sub.graph); setGraphLabel(sub.name)
        if (s) setCurrentId(s.id); else { setEnded(true); push('system', '⚠️ Subflow is empty — simulation ends here.') }
      }, 500)
      return
    }
    if (node.type === 'live_chat') {
      push('system', '🧑‍💼 Handed over to a live agent — simulation ends here.')
      setEnded(true)
      return
    }
    if (node.type === 'end') {
      if (node.data?.endMessage) push('bot', node.data.endMessage)
      push('system', '✅ Flow ended')
      setEnded(true)
      return
    }
    // unhandled node type — treat as a silent passthrough so the sim never gets stuck
    timerRef.current = setTimeout(() => finishOrAdvance(node.id, 0), 300)
  }, [currentId, graph, ended, awaiting, allFlows, push, finishOrAdvance])

  const submitAsk = (value) => {
    if (!awaiting || awaiting.type !== 'ask') return
    push('user', (value ?? '').trim() || '(skipped)')
    const node = awaiting.node
    setInput(''); setAwaiting(null)
    finishOrAdvance(node.id, 0)
  }
  const pickQuickReply = (idx, label) => {
    push('user', label || `Option ${idx + 1}`)
    const node = awaiting.node
    setAwaiting(null)
    finishOrAdvance(node.id, idx)
  }
  const pickBranch = (idx, label) => {
    push('user', `🧪 Testing path: ${label}`)
    const node = awaiting.node
    setAwaiting(null)
    finishOrAdvance(node.id, idx)
  }

  return (
    <div className="fixed bottom-5 right-5 z-[70] w-[360px] h-[560px] bg-white rounded-2xl shadow-2xl border border-surface-border flex flex-col overflow-hidden" style={{ boxShadow: '0 32px 70px -16px rgba(15,23,42,0.35), 0 10px 24px -8px rgba(15,23,42,0.18)' }}>
      <div className="flex items-center gap-2 px-3.5 py-3 flex-shrink-0 text-white" style={{ background: brandBg }}>
        <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center flex-shrink-0 overflow-hidden">
          {cfg.avatarStyle === 'image' && cfg.avatarImage
            ? <img src={cfg.avatarImage} alt="" className="w-full h-full object-cover"/>
            : cfg.avatarStyle === 'emoji'
            ? <span style={{ fontSize: 15 }}>{cfg.avatarEmoji || '🤖'}</span>
            : <Bot size={15}/>}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[12.5px] font-bold truncate">{cfg.botName || graphLabel}</p>
          <p className="text-[10px] text-white/75 truncate">{pickingStart ? 'Pick a trigger to test' : ended ? 'Simulation ended' : `Testing "${graphLabel}"…`}</p>
        </div>
        <button onClick={reset} title="Restart" className="p-1.5 rounded-lg hover:bg-white/15 transition-colors flex-shrink-0"><RotateCcw size={13}/></button>
        <button onClick={onClose} title="Close" className="p-1.5 rounded-lg hover:bg-white/15 transition-colors flex-shrink-0"><X size={14}/></button>
      </div>

      {pickingStart ? (
        <div className="flex-1 overflow-y-auto px-3 py-3 bg-slate-50">
          <p className="text-[11px] text-slate-500 mb-2.5">This flow has {starts.length} independent triggers sharing downstream logic — which one do you want to simulate?</p>
          <div className="space-y-1.5">
            {starts.map(s => {
              const trig = TRIGGER_TYPES.find(t => t.v === s.data?.trigger)
              return (
                <button key={s.id} onClick={() => beginFrom(s.id)}
                  className="w-full flex items-center gap-2.5 p-3 rounded-xl border border-surface-border bg-white hover:border-primary/40 transition-colors text-left">
                  {trig?.icon && <trig.icon size={14} className="text-primary flex-shrink-0"/>}
                  <div className="min-w-0">
                    <p className="text-[12px] font-semibold text-slate-700 truncate">{s.data?.name || 'Trigger'}</p>
                    <p className="text-[10px] text-slate-400 truncate">{trig?.l || s.data?.trigger}</p>
                  </div>
                </button>
              )
            })}
          </div>
        </div>
      ) : (
      <div ref={listRef} className="flex-1 overflow-y-auto px-3 py-3 space-y-2 bg-slate-50">
        {messages.map(m => (
          m.type === 'system' ? (
            <div key={m.id} className="text-center text-[10px] text-slate-400 font-medium py-0.5">{m.text}</div>
          ) : (
            <div key={m.id} className={clsx('flex', m.type === 'bot' ? 'justify-start' : 'justify-end')}>
              <div className={clsx('max-w-[80%] rounded-2xl px-3 py-2 text-[12px] leading-relaxed shadow-sm whitespace-pre-wrap',
                m.type === 'bot' ? 'bg-white text-slate-700 rounded-bl-sm' : 'text-white rounded-br-sm')}
                style={m.type === 'bot' ? undefined : { background: brandBg }}>
                {m.text}
              </div>
            </div>
          )
        ))}
        {!messages.length && !ended && <p className="text-[11px] text-slate-400 text-center pt-6">Starting simulation…</p>}
      </div>
      )}

      <div className="flex-shrink-0 border-t border-surface-border bg-white p-2.5">
        {pickingStart ? (
          <p className="text-[10px] text-slate-300 text-center py-1.5">Pick a trigger above to begin…</p>
        ) : ended ? (
          <div className="flex items-center justify-center gap-1.5 text-[11px] font-semibold text-slate-400 py-1.5">
            <X size={12}/> Flow ended — press Restart to try again
          </div>
        ) : awaiting?.type === 'ask' ? (
          <AskAnswerControl questionType={awaiting.node.data?.questionType} accent={cfg.color || '#0066ff'} onSubmit={submitAsk}/>
        ) : awaiting?.type === 'quick_replies' ? (
          <div className="flex flex-wrap gap-1.5">
            {getOutputPorts(awaiting.node).map((p, i) => (
              <button key={i} onClick={() => pickQuickReply(i, p.label)}
                className="px-3 py-1.5 rounded-full border border-primary/30 bg-primary-50 text-primary text-[11px] font-semibold hover:bg-primary/10 transition-colors">
                {p.label}
              </button>
            ))}
          </div>
        ) : awaiting?.type === 'branch' ? (
          <div className="space-y-1.5">
            <p className="text-[9.5px] text-slate-400 font-medium">Pick a path to test — no real condition is evaluated</p>
            <div className="flex gap-1.5">
              {getOutputPorts(awaiting.node).map((p, i) => (
                <button key={i} onClick={() => pickBranch(i, p.label)}
                  className="flex-1 px-2.5 py-1.5 rounded-xl border border-surface-border text-slate-700 text-[11px] font-semibold hover:bg-slate-50 transition-colors">
                  {p.label}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <p className="text-[10px] text-slate-300 text-center py-1.5">Auto-advancing…</p>
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
        <PreviewSimulator flow={{ name: flowName, graph: { nodes, edges } }} allFlows={allFlows || []} onClose={() => setShowPreview(false)}/>
      )}
    </div>
  )
}

/* ─── flow/subflow card — the Main Flow is one-per-bot and can't be
   duplicated or deleted (that's the whole fix: no way to end up with a
   second "main" that reads like a second bot); Subflows get the full set
   of actions. ── */
function FlowCard({ f, onEdit, onDuplicate, onRemove, onToggle }) {
  const rate = f.stats.triggered ? Math.round((f.stats.completed / f.stats.triggered) * 100) : 0
  const isMain = f.kind === 'main'
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
      <div className="flex items-center gap-1.5 mt-1">
        <button onClick={() => onEdit(f.id)} className="btn-secondary flex-1 justify-center !py-1.5"><Edit3 size={11}/> Edit</button>
        {!isMain && (
          <>
            <button onClick={() => onDuplicate(f)} title="Duplicate" className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"><Copy size={13}/></button>
            <button onClick={() => onRemove(f.id)} title="Delete" className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors"><Trash2 size={13}/></button>
          </>
        )}
      </div>
    </div>
  )
}

/* ─── page: flow list + entry into the canvas ─────────────────────────── */
export default function WebChatFlowBuilder() {
  const [flows, setFlows] = useState(INITIAL_FLOWS)
  const [editingId, setEditingId] = useState(null)

  const editingFlow = flows.find(f => f.id === editingId)
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
          {mainFlow && <FlowCard f={mainFlow} onEdit={setEditingId} onToggle={toggle}/>}
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
            <FlowCard key={f.id} f={f} onEdit={setEditingId} onDuplicate={duplicate} onRemove={remove} onToggle={toggle}/>
          ))}
          {subflows.length === 0 && <p className="text-[11px] text-slate-400 py-4">No subflows yet.</p>}
        </div>
      </div>
    </div>
  )
}
