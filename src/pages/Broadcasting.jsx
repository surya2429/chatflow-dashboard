import { useState, useMemo, useEffect } from 'react'
import { createPortal } from 'react-dom'
import {
  Plus, Search, ChevronLeft, ChevronRight, X, Send, Users, FileText,
  Upload, Calendar, BarChart2, Download, CheckCircle2, AlertCircle,
  Clock, Zap, Check, Info, Target, Inbox, Eye, Shield, Activity,
  CornerUpLeft, RefreshCw, MessageSquare, MousePointerClick,
  ArrowUpRight, TrendingUp, Pencil, Trash2, Filter, Star,
  ChevronDown, Play, Pause, MoreVertical, Copy, ExternalLink,
  History, Phone, CheckCheck, MailOpen, Loader2,
} from 'lucide-react'
import { TEMPLATES } from '../constants/mockData'
import { APPROVED_TEMPLATES } from '../constants/approvedTemplates'
import { extractParams, extractHeaderParams, getButtonsNeedingInput } from '../utils/templateParams'
import clsx from 'clsx'
import { TemplateBuilder } from './Templates'
import Select, { NativeSelect } from '../components/Select'
import DatePicker from '../components/DatePicker'

/* ─────────────────────────── MOCK DATA ─────────────────────────── */
const CAMPAIGNS = [
  {
    id: 'c1', name: 'Exclusive Festival Offer for Our Valued Members',
    date: '2025-05-14 18:52', channel: 'Default',
    recipients: 230, successful: 221, read: 215, replied: 103,
    failed: 9, ignored: 6, sending: 0, clicks: 110, status: 'Completed',
    template: {
      name: 'exclusive_festival_offer', category: 'MARKETING', header: 'IMAGE',
      bold: 'Exclusive Festival Offer!',
      body: 'Hi {{1}}, as a cherished member, we have a special festival surprise just for you! 🎁',
      footer: 'www.chatflow.io', buttons: ['Know more', 'Visit us'],
    },
  },
  {
    id: 'c2', name: 'Reminder: You Have Store Credits Waiting',
    date: '2025-05-05 07:27', channel: 'Default',
    recipients: 128, successful: 113, read: 103, replied: 31,
    failed: 15, ignored: 10, sending: 0, clicks: 97, status: 'Completed',
    template: {
      name: 'store_credits_reminder', category: 'MARKETING', header: 'TEXT',
      bold: '💰 You have store credits!',
      body: 'Hi {{1}}, you have ₹{{2}} in store credits. Use them before they expire on {{3}}.',
      footer: '', buttons: ['Use Credits Now', 'View Balance'],
    },
  },
  {
    id: 'c3', name: 'Your Opinion = A Special Discount Just for You',
    date: '2025-05-05 07:27', channel: 'Default',
    recipients: 300, successful: 265, read: 264, replied: 93,
    failed: 35, ignored: 1, sending: 0, clicks: 192, status: 'Completed',
    template: {
      name: 'feedback_special_discount', category: 'MARKETING', header: 'NONE',
      bold: '🌟 Share Your Feedback',
      body: 'Hi {{1}}, we value your opinion! Complete a quick survey and get {{2}}% off your next order.',
      footer: 'Reply STOP to opt out', buttons: ['Take Survey', 'Skip'],
    },
  },
  {
    id: 'c4', name: 'Spring Sale — Last 24 Hours',
    date: '2025-04-30 09:00', channel: 'Default',
    recipients: 1204, successful: 1165, read: 920, replied: 312,
    failed: 39, ignored: 245, sending: 0, clicks: 580, status: 'Completed',
    template: {
      name: 'spring_sale_final', category: 'MARKETING', header: 'IMAGE',
      bold: '⏰ Final Hours — Spring Sale!',
      body: "Hi {{1}}, up to 40% off ends at midnight. Don't miss out!",
      footer: '', buttons: ['Shop Now'],
    },
  },
  {
    id: 'c5', name: 'Order Confirmation — April Batch',
    date: '2025-04-28 11:00', channel: 'Default',
    recipients: 892, successful: 878, read: 791, replied: 44,
    failed: 14, ignored: 87, sending: 0, clicks: 412, status: 'Completed',
    template: {
      name: 'order_confirmation_v3', category: 'UTILITY', header: 'TEXT',
      bold: '✅ Order Confirmed',
      body: 'Hi {{1}}, your order #{{2}} is confirmed and will be delivered by {{3}}.',
      footer: '', buttons: ['Track Order', 'Contact Support'],
    },
  },
]

const CONTACT_GROUPS = [
  { id: 'g1', name: 'All Customers',  icon: '👥', count: 12480, desc: 'Every opted-in contact'  },
  { id: 'g2', name: 'VIP Members',    icon: '⭐', count: 1204,  desc: 'High-value customers'    },
  { id: 'g3', name: 'Inactive (60d)', icon: '💤', count: 3201,  desc: 'No activity in 60 days'  },
  { id: 'g4', name: 'New Signups',    icon: '🆕', count: 892,   desc: 'Joined in last 30 days'   },
  { id: 'g5', name: 'Abandoned Cart', icon: '🛒', count: 2108,  desc: 'Left without checkout'    },
  { id: 'g6', name: 'Post-purchase',  icon: '✅', count: 4321,  desc: 'Completed an order'       },
]

const WIZARD_STEPS = ['Template', 'Audience', 'Variables', 'Schedule', 'Review']
const STATUS_TABS   = ['All', 'Sending', 'Scheduled', 'Completed', 'Failed']

/* ─────────────────────────── UTILS ─────────────────────────── */
function pct(n, d) { return d > 0 ? Math.round((n / d) * 100) : 0 }

/** Fill {{1}}, {{2}}… in any text with sample or mapped values for previewing */
function fillText(text, params, mappings, sampleValues) {
  if (!text) return ''
  let result = text
  params.forEach(p => {
    const m = mappings[p]
    let val
    if (!m) {
      val = `{{${p}}}`
    } else if (m.type === 'currency') {
      if (m.code && m.amount) {
        const num = parseFloat(m.amount) || 0
        const SYMBOLS = { INR: '₹', USD: '$', EUR: '€', GBP: '£', AED: 'د.إ', SGD: 'S$', AUD: 'A$' }
        val = `${SYMBOLS[m.code] || m.code}${num.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
      } else { val = `{{${p}}}` }
    } else if (m.type === 'datetime') {
      if (m.value) {
        try {
          val = new Date(m.value).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })
        } catch { val = m.value }
      } else { val = `{{${p}}}` }
    } else if (!m.value) {
      val = `{{${p}}}`
    } else if (m.type === 'static') {
      val = m.value
    } else if (m.type === 'csv') {
      val = `[${m.value}]`
    } else if (m.type === 'field' && m.value.startsWith('customAttr:')) {
      val = `[${m.value.replace('customAttr:', '')}]`
    } else {
      val = sampleValues[m.value] || `{{${p}}}`
    }
    result = result.replace(new RegExp(`\\{\\{${p}\\}\\}`, 'g'), val)
  })
  return result
}

/** @deprecated use fillText */
function fillBody(body, params, mappings, sampleValues) {
  return fillText(body, params, mappings, sampleValues)
}

const CURRENCY_OPTIONS = [
  { code: 'INR', label: 'INR — ₹ Indian Rupee',    symbol: '₹'    },
  { code: 'USD', label: 'USD — $ US Dollar',         symbol: '$'    },
  { code: 'EUR', label: 'EUR — € Euro',              symbol: '€'    },
  { code: 'GBP', label: 'GBP — £ British Pound',    symbol: '£'    },
  { code: 'AED', label: 'AED — د.إ UAE Dirham',     symbol: 'د.إ'  },
  { code: 'SGD', label: 'SGD — S$ Singapore Dollar', symbol: 'S$'  },
  { code: 'AUD', label: 'AUD — A$ Australian Dollar', symbol: 'A$' },
]

const CONTACT_FIELDS = [
  { value: 'name',     label: 'Contact Name'   },
  { value: 'phone',    label: 'Phone Number'   },
  { value: 'email',    label: 'Email Address'  },
  { value: 'company',  label: 'Company'        },
  { value: 'city',     label: 'City'           },
  { value: 'language', label: 'Language'       },
  { value: 'customAttr:order_id', label: 'Custom: order_id' },
  { value: 'customAttr:plan',     label: 'Custom: plan'     },
  { value: 'customAttr:amount',   label: 'Custom: amount'   },
  { value: 'customAttr:coupon',   label: 'Custom: coupon'   },
]

const COUNTRIES = [
  { code:'IN', name:'India',               dial:'+91',  flag:'🇮🇳' },
  { code:'US', name:'United States',       dial:'+1',   flag:'🇺🇸' },
  { code:'GB', name:'United Kingdom',      dial:'+44',  flag:'🇬🇧' },
  { code:'AE', name:'UAE',                 dial:'+971', flag:'🇦🇪' },
  { code:'AU', name:'Australia',           dial:'+61',  flag:'🇦🇺' },
  { code:'CA', name:'Canada',              dial:'+1',   flag:'🇨🇦' },
  { code:'SG', name:'Singapore',           dial:'+65',  flag:'🇸🇬' },
  { code:'MY', name:'Malaysia',            dial:'+60',  flag:'🇲🇾' },
  { code:'PK', name:'Pakistan',            dial:'+92',  flag:'🇵🇰' },
  { code:'BD', name:'Bangladesh',          dial:'+880', flag:'🇧🇩' },
  { code:'LK', name:'Sri Lanka',           dial:'+94',  flag:'🇱🇰' },
  { code:'NP', name:'Nepal',               dial:'+977', flag:'🇳🇵' },
  { code:'AF', name:'Afghanistan',         dial:'+93',  flag:'🇦🇫' },
  { code:'AL', name:'Albania',             dial:'+355', flag:'🇦🇱' },
  { code:'DZ', name:'Algeria',             dial:'+213', flag:'🇩🇿' },
  { code:'AO', name:'Angola',              dial:'+244', flag:'🇦🇴' },
  { code:'AR', name:'Argentina',           dial:'+54',  flag:'🇦🇷' },
  { code:'AM', name:'Armenia',             dial:'+374', flag:'🇦🇲' },
  { code:'AT', name:'Austria',             dial:'+43',  flag:'🇦🇹' },
  { code:'AZ', name:'Azerbaijan',          dial:'+994', flag:'🇦🇿' },
  { code:'BH', name:'Bahrain',             dial:'+973', flag:'🇧🇭' },
  { code:'BY', name:'Belarus',             dial:'+375', flag:'🇧🇾' },
  { code:'BE', name:'Belgium',             dial:'+32',  flag:'🇧🇪' },
  { code:'BZ', name:'Belize',              dial:'+501', flag:'🇧🇿' },
  { code:'BJ', name:'Benin',               dial:'+229', flag:'🇧🇯' },
  { code:'BT', name:'Bhutan',              dial:'+975', flag:'🇧🇹' },
  { code:'BO', name:'Bolivia',             dial:'+591', flag:'🇧🇴' },
  { code:'BA', name:'Bosnia',              dial:'+387', flag:'🇧🇦' },
  { code:'BW', name:'Botswana',            dial:'+267', flag:'🇧🇼' },
  { code:'BR', name:'Brazil',              dial:'+55',  flag:'🇧🇷' },
  { code:'BN', name:'Brunei',              dial:'+673', flag:'🇧🇳' },
  { code:'BG', name:'Bulgaria',            dial:'+359', flag:'🇧🇬' },
  { code:'BF', name:'Burkina Faso',        dial:'+226', flag:'🇧🇫' },
  { code:'BI', name:'Burundi',             dial:'+257', flag:'🇧🇮' },
  { code:'CM', name:'Cameroon',            dial:'+237', flag:'🇨🇲' },
  { code:'CL', name:'Chile',               dial:'+56',  flag:'🇨🇱' },
  { code:'CN', name:'China',               dial:'+86',  flag:'🇨🇳' },
  { code:'CO', name:'Colombia',            dial:'+57',  flag:'🇨🇴' },
  { code:'CD', name:'Congo (DRC)',          dial:'+243', flag:'🇨🇩' },
  { code:'CR', name:'Costa Rica',          dial:'+506', flag:'🇨🇷' },
  { code:'CI', name:"Côte d'Ivoire",       dial:'+225', flag:'🇨🇮' },
  { code:'HR', name:'Croatia',             dial:'+385', flag:'🇭🇷' },
  { code:'CU', name:'Cuba',                dial:'+53',  flag:'🇨🇺' },
  { code:'CY', name:'Cyprus',              dial:'+357', flag:'🇨🇾' },
  { code:'CZ', name:'Czech Republic',      dial:'+420', flag:'🇨🇿' },
  { code:'DK', name:'Denmark',             dial:'+45',  flag:'🇩🇰' },
  { code:'EC', name:'Ecuador',             dial:'+593', flag:'🇪🇨' },
  { code:'EG', name:'Egypt',               dial:'+20',  flag:'🇪🇬' },
  { code:'SV', name:'El Salvador',         dial:'+503', flag:'🇸🇻' },
  { code:'EE', name:'Estonia',             dial:'+372', flag:'🇪🇪' },
  { code:'ET', name:'Ethiopia',            dial:'+251', flag:'🇪🇹' },
  { code:'FI', name:'Finland',             dial:'+358', flag:'🇫🇮' },
  { code:'FR', name:'France',              dial:'+33',  flag:'🇫🇷' },
  { code:'GA', name:'Gabon',               dial:'+241', flag:'🇬🇦' },
  { code:'GM', name:'Gambia',              dial:'+220', flag:'🇬🇲' },
  { code:'GE', name:'Georgia',             dial:'+995', flag:'🇬🇪' },
  { code:'DE', name:'Germany',             dial:'+49',  flag:'🇩🇪' },
  { code:'GH', name:'Ghana',               dial:'+233', flag:'🇬🇭' },
  { code:'GR', name:'Greece',              dial:'+30',  flag:'🇬🇷' },
  { code:'GT', name:'Guatemala',           dial:'+502', flag:'🇬🇹' },
  { code:'GN', name:'Guinea',              dial:'+224', flag:'🇬🇳' },
  { code:'HN', name:'Honduras',            dial:'+504', flag:'🇭🇳' },
  { code:'HK', name:'Hong Kong',           dial:'+852', flag:'🇭🇰' },
  { code:'HU', name:'Hungary',             dial:'+36',  flag:'🇭🇺' },
  { code:'IS', name:'Iceland',             dial:'+354', flag:'🇮🇸' },
  { code:'ID', name:'Indonesia',           dial:'+62',  flag:'🇮🇩' },
  { code:'IR', name:'Iran',                dial:'+98',  flag:'🇮🇷' },
  { code:'IQ', name:'Iraq',                dial:'+964', flag:'🇮🇶' },
  { code:'IE', name:'Ireland',             dial:'+353', flag:'🇮🇪' },
  { code:'IL', name:'Israel',              dial:'+972', flag:'🇮🇱' },
  { code:'IT', name:'Italy',               dial:'+39',  flag:'🇮🇹' },
  { code:'JM', name:'Jamaica',             dial:'+1876',flag:'🇯🇲' },
  { code:'JP', name:'Japan',               dial:'+81',  flag:'🇯🇵' },
  { code:'JO', name:'Jordan',              dial:'+962', flag:'🇯🇴' },
  { code:'KZ', name:'Kazakhstan',          dial:'+7',   flag:'🇰🇿' },
  { code:'KE', name:'Kenya',               dial:'+254', flag:'🇰🇪' },
  { code:'KW', name:'Kuwait',              dial:'+965', flag:'🇰🇼' },
  { code:'KG', name:'Kyrgyzstan',          dial:'+996', flag:'🇰🇬' },
  { code:'LA', name:'Laos',                dial:'+856', flag:'🇱🇦' },
  { code:'LV', name:'Latvia',              dial:'+371', flag:'🇱🇻' },
  { code:'LB', name:'Lebanon',             dial:'+961', flag:'🇱🇧' },
  { code:'LY', name:'Libya',               dial:'+218', flag:'🇱🇾' },
  { code:'LT', name:'Lithuania',           dial:'+370', flag:'🇱🇹' },
  { code:'LU', name:'Luxembourg',          dial:'+352', flag:'🇱🇺' },
  { code:'MO', name:'Macau',               dial:'+853', flag:'🇲🇴' },
  { code:'MG', name:'Madagascar',          dial:'+261', flag:'🇲🇬' },
  { code:'MW', name:'Malawi',              dial:'+265', flag:'🇲🇼' },
  { code:'MV', name:'Maldives',            dial:'+960', flag:'🇲🇻' },
  { code:'ML', name:'Mali',                dial:'+223', flag:'🇲🇱' },
  { code:'MT', name:'Malta',               dial:'+356', flag:'🇲🇹' },
  { code:'MR', name:'Mauritania',          dial:'+222', flag:'🇲🇷' },
  { code:'MU', name:'Mauritius',           dial:'+230', flag:'🇲🇺' },
  { code:'MX', name:'Mexico',              dial:'+52',  flag:'🇲🇽' },
  { code:'MD', name:'Moldova',             dial:'+373', flag:'🇲🇩' },
  { code:'MN', name:'Mongolia',            dial:'+976', flag:'🇲🇳' },
  { code:'MA', name:'Morocco',             dial:'+212', flag:'🇲🇦' },
  { code:'MZ', name:'Mozambique',          dial:'+258', flag:'🇲🇿' },
  { code:'MM', name:'Myanmar',             dial:'+95',  flag:'🇲🇲' },
  { code:'NA', name:'Namibia',             dial:'+264', flag:'🇳🇦' },
  { code:'NL', name:'Netherlands',         dial:'+31',  flag:'🇳🇱' },
  { code:'NZ', name:'New Zealand',         dial:'+64',  flag:'🇳🇿' },
  { code:'NI', name:'Nicaragua',           dial:'+505', flag:'🇳🇮' },
  { code:'NE', name:'Niger',               dial:'+227', flag:'🇳🇪' },
  { code:'NG', name:'Nigeria',             dial:'+234', flag:'🇳🇬' },
  { code:'NO', name:'Norway',              dial:'+47',  flag:'🇳🇴' },
  { code:'OM', name:'Oman',                dial:'+968', flag:'🇴🇲' },
  { code:'PA', name:'Panama',              dial:'+507', flag:'🇵🇦' },
  { code:'PG', name:'Papua New Guinea',    dial:'+675', flag:'🇵🇬' },
  { code:'PY', name:'Paraguay',            dial:'+595', flag:'🇵🇾' },
  { code:'PE', name:'Peru',                dial:'+51',  flag:'🇵🇪' },
  { code:'PH', name:'Philippines',         dial:'+63',  flag:'🇵🇭' },
  { code:'PL', name:'Poland',              dial:'+48',  flag:'🇵🇱' },
  { code:'PT', name:'Portugal',            dial:'+351', flag:'🇵🇹' },
  { code:'QA', name:'Qatar',               dial:'+974', flag:'🇶🇦' },
  { code:'RO', name:'Romania',             dial:'+40',  flag:'🇷🇴' },
  { code:'RU', name:'Russia',              dial:'+7',   flag:'🇷🇺' },
  { code:'RW', name:'Rwanda',              dial:'+250', flag:'🇷🇼' },
  { code:'SA', name:'Saudi Arabia',        dial:'+966', flag:'🇸🇦' },
  { code:'SN', name:'Senegal',             dial:'+221', flag:'🇸🇳' },
  { code:'RS', name:'Serbia',              dial:'+381', flag:'🇷🇸' },
  { code:'SL', name:'Sierra Leone',        dial:'+232', flag:'🇸🇱' },
  { code:'SK', name:'Slovakia',            dial:'+421', flag:'🇸🇰' },
  { code:'SI', name:'Slovenia',            dial:'+386', flag:'🇸🇮' },
  { code:'SO', name:'Somalia',             dial:'+252', flag:'🇸🇴' },
  { code:'ZA', name:'South Africa',        dial:'+27',  flag:'🇿🇦' },
  { code:'KR', name:'South Korea',         dial:'+82',  flag:'🇰🇷' },
  { code:'SS', name:'South Sudan',         dial:'+211', flag:'🇸🇸' },
  { code:'ES', name:'Spain',               dial:'+34',  flag:'🇪🇸' },
  { code:'SD', name:'Sudan',               dial:'+249', flag:'🇸🇩' },
  { code:'SE', name:'Sweden',              dial:'+46',  flag:'🇸🇪' },
  { code:'CH', name:'Switzerland',         dial:'+41',  flag:'🇨🇭' },
  { code:'SY', name:'Syria',               dial:'+963', flag:'🇸🇾' },
  { code:'TW', name:'Taiwan',              dial:'+886', flag:'🇹🇼' },
  { code:'TJ', name:'Tajikistan',          dial:'+992', flag:'🇹🇯' },
  { code:'TZ', name:'Tanzania',            dial:'+255', flag:'🇹🇿' },
  { code:'TH', name:'Thailand',            dial:'+66',  flag:'🇹🇭' },
  { code:'TG', name:'Togo',                dial:'+228', flag:'🇹🇬' },
  { code:'TN', name:'Tunisia',             dial:'+216', flag:'🇹🇳' },
  { code:'TR', name:'Turkey',              dial:'+90',  flag:'🇹🇷' },
  { code:'TM', name:'Turkmenistan',        dial:'+993', flag:'🇹🇲' },
  { code:'UG', name:'Uganda',              dial:'+256', flag:'🇺🇬' },
  { code:'UA', name:'Ukraine',             dial:'+380', flag:'🇺🇦' },
  { code:'UY', name:'Uruguay',             dial:'+598', flag:'🇺🇾' },
  { code:'UZ', name:'Uzbekistan',          dial:'+998', flag:'🇺🇿' },
  { code:'VE', name:'Venezuela',           dial:'+58',  flag:'🇻🇪' },
  { code:'VN', name:'Vietnam',             dial:'+84',  flag:'🇻🇳' },
  { code:'YE', name:'Yemen',               dial:'+967', flag:'🇾🇪' },
  { code:'ZM', name:'Zambia',              dial:'+260', flag:'🇿🇲' },
  { code:'ZW', name:'Zimbabwe',            dial:'+263', flag:'🇿🇼' },
]

const SAMPLE_CONTACT = {
  name: 'Rahul Mehta', phone: '+91 98765 43210',
  email: 'rahul@example.com', company: 'Acme Corp',
  city: 'Mumbai', language: 'English',
}

/* ─────────────────────────── STATUS PILL ─────────────────────────── */
const STATUS_CFG = {
  Completed: { bg: 'bg-emerald-50', text: 'text-emerald-700', dot: 'bg-emerald-500', ring: 'ring-emerald-200' },
  Sending:   { bg: 'bg-blue-50',   text: 'text-blue-700',    dot: 'bg-blue-500',    ring: 'ring-blue-200'   },
  Scheduled: { bg: 'bg-amber-50',  text: 'text-amber-700',   dot: 'bg-amber-500',   ring: 'ring-amber-200'  },
  Failed:    { bg: 'bg-red-50',    text: 'text-red-700',     dot: 'bg-red-500',     ring: 'ring-red-200'    },
  Paused:    { bg: 'bg-slate-50',  text: 'text-slate-600',   dot: 'bg-slate-400',   ring: 'ring-slate-200'  },
}
function StatusPill({ status }) {
  const cfg = STATUS_CFG[status] || STATUS_CFG.Paused
  return (
    <span className={clsx('inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold ring-1', cfg.bg, cfg.text, cfg.ring)}>
      <span className={clsx('w-1.5 h-1.5 rounded-full flex-shrink-0', cfg.dot)} />
      {status}
    </span>
  )
}

/* ─────────────────────────── PHONE PREVIEW ─────────────────────────── */
function PhonePreview({ tpl }) {
  if (!tpl) return (
    <div className="flex flex-col items-center justify-center h-48 text-slate-300">
      <MessageSquare size={28} className="mb-2" />
      <p className="text-xs">Select a template</p>
    </div>
  )
  return (
    <div className="flex flex-col items-center">
      {/* Phone frame */}
      <div className="w-[160px] bg-slate-800 rounded-[22px] p-2 shadow-xl ring-1 ring-black/10">
        <div className="bg-[#e5ddd5] rounded-[14px] overflow-hidden">
          {/* WhatsApp header */}
          <div className="bg-[#075e54] px-3 py-2 flex items-center gap-2">
            <div className="w-6 h-6 rounded-full bg-white/20 flex items-center justify-center">
              <MessageSquare size={10} className="text-white" />
            </div>
            <div>
              <p className="text-white text-[9px] font-semibold leading-none">Business</p>
              <p className="text-white/60 text-[8px]">online</p>
            </div>
          </div>
          {/* Chat area */}
          <div className="p-2 min-h-[120px] space-y-1.5">
            <div className="bg-white rounded-lg rounded-tl-none p-2 shadow-sm ml-0 mr-4">
              {tpl.bold && (
                <p className="text-[9px] font-bold text-slate-800 leading-snug mb-1">{tpl.bold}</p>
              )}
              <p className="text-[8.5px] text-slate-700 leading-snug">{tpl.body?.replace(/\{\{[^}]+\}\}/g, '…')}</p>
              {tpl.footer && <p className="text-[7.5px] text-slate-400 mt-1">{tpl.footer}</p>}
              {tpl.buttons?.length > 0 && (
                <div className="mt-1.5 space-y-1 border-t border-slate-100 pt-1.5">
                  {tpl.buttons.slice(0, 2).map((b, i) => (
                    <div key={i} className="text-[8px] font-semibold text-[#128c7e] text-center py-0.5 border-t border-slate-100 first:border-0">
                      {b}
                    </div>
                  ))}
                </div>
              )}
              <p className="text-[7px] text-slate-400 text-right mt-1">9:41 AM ✓✓</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

/* ─────────────────────────── CAMPAIGN INSIGHTS ─────────────────────────── */
function generateRecipients(c) {
  const names = ['Aasha Singh','Rahul Mehta','Priya Das','Amit Patel','Neha Sharma','Deepak Kumar','Kavya Nair','Rohan Gupta','Sneha Iyer','Arjun Rao']
  return names.slice(0, Math.min(10, c.recipients)).map((n, i) => ({
    name: n, phone: `+91 98765 4${String(i).padStart(4, '0')}`,
    status: i < c.failed ? 'Failed' : i < c.failed + (c.recipients - c.successful - c.failed) ? 'Pending' : 'Delivered',
    read: i >= c.failed && i < c.failed + c.read,
    replied: i >= c.failed && i < c.failed + c.replied,
  }))
}

/* ─── Retarget Modal ────────────────────────────────────────────────────────── */
const RETARGET_SEGMENTS = [
  { key: 'replied',   label: 'Replied',       icon: CornerUpLeft,      color: '#8b5cf6', bg: '#f5f3ff', border: '#ede9fe', field: 'replied'   },
  { key: 'clicked',   label: 'Clicked',        icon: MousePointerClick,  color: '#3b82f6', bg: '#eff6ff', border: '#dbeafe', field: 'clicks'    },
  { key: 'read',      label: 'Read',           icon: MailOpen,           color: '#14b8a6', bg: '#f0fdfa', border: '#ccfbf1', field: 'read'      },
  { key: 'delivered', label: 'Delivered',      icon: CheckCheck,         color: '#10b981', bg: '#f0fdf4', border: '#bbf7d0', field: 'successful'},
  { key: 'not_read',  label: 'Not Read',       icon: Eye,                color: '#f59e0b', bg: '#fffbeb', border: '#fde68a', get: (c) => c.successful - c.read },
  { key: 'failed',    label: 'Failed',         icon: AlertCircle,        color: '#ef4444', bg: '#fef2f2', border: '#fecaca', field: 'failed'    },
]

const BC_PREVIEW_CONTACTS = [
  { firstName: 'Amit',  lastName: 'Sharma', phone: '+91 98100 00001', city: 'Mumbai',    email: 'amit@ex.com',  custom1: 'VIP'     },
  { firstName: 'Priya', lastName: 'Nair',   phone: '+91 98110 00002', city: 'Bangalore', email: 'priya@ex.com', custom1: 'Regular' },
  { firstName: 'Rahul', lastName: 'Kumar',  phone: '+91 98120 00003', city: 'Delhi',     email: 'rahul@ex.com', custom1: 'Premium' },
  { firstName: 'Sneha', lastName: 'Patel',  phone: '+91 98130 00004', city: 'Ahmedabad', email: 'sneha@ex.com', custom1: 'VIP'     },
  { firstName: 'Arun',  lastName: 'Mehta',  phone: '+91 98140 00005', city: 'Pune',      email: 'arun@ex.com',  custom1: 'Regular' },
]
const BC_CONTACT_FIELDS = [
  { key: 'firstName', label: 'First Name' },
  { key: 'lastName',  label: 'Last Name'  },
  { key: 'phone',     label: 'Phone'      },
  { key: 'city',      label: 'City'       },
  { key: 'email',     label: 'Email'      },
  { key: 'custom1',   label: 'Custom Field 1' },
]

function RetargetModal({ campaign: c, onClose, initialSegment = null }) {
  const [step,         setStep]         = useState(initialSegment ? 'campaign' : 'segment')
  const [segKey,       setSegKey]       = useState(initialSegment)
  const [campaignName, setCampaignName] = useState('')
  const [tplId,        setTplId]        = useState(null)
  const [q,            setQ]            = useState('')
  const [paramMode,    setParamMode]    = useState('global')
  const [globalParams, setGlobalParams] = useState({})
  const [fieldMap,     setFieldMap]     = useState({})
  const [csvRows,      setCsvRows]      = useState(null)
  const [csvError,     setCsvError]     = useState('')
  const [scheduleMode, setScheduleMode] = useState('now')
  const [scheduleDate, setScheduleDate] = useState('')
  const [scheduleTime, setScheduleTime] = useState('')
  const [sending,      setSending]      = useState(false)
  const [done,         setDone]         = useState(false)

  const selTpl    = APPROVED_TEMPLATES.find(t => t.id === tplId)
  const paramNums = useMemo(() => extractParams(selTpl), [selTpl])
  const hasParams = paramNums.length > 0
  const list      = APPROVED_TEMPLATES.filter(t =>
    t.status === 'APPROVED' &&
    (t.name.toLowerCase().includes(q.toLowerCase()) ||
    (t.category||'').toLowerCase().includes(q.toLowerCase())))

  function getCount(seg) {
    if (seg.field) return c[seg.field] ?? 0
    if (seg.get)   return seg.get(c)
    return 0
  }
  const selSeg = RETARGET_SEGMENTS.find(s => s.key === segKey)
  const count  = selSeg ? getCount(selSeg) : 0

  const stepSequence = [
    ...(!initialSegment ? ['segment'] : []),
    'campaign',
    ...(hasParams ? ['variables'] : []),
    'preview',
    'confirm',
  ]
  const STEP_LABELS = { segment: 'Segment', campaign: 'Setup', variables: 'Personalize', preview: 'Preview', confirm: 'Send' }

  useEffect(() => { if (step === 'variables' && !hasParams) setStep('preview') }, [hasParams])

  function goNext() { const i = stepSequence.indexOf(step); if (i < stepSequence.length - 1) setStep(stepSequence[i + 1]) }
  function goBack() { const i = stepSequence.indexOf(step); if (i > 0) setStep(stepSequence[i - 1]) }

  function getParamValue(contact, n) {
    if (paramMode === 'global') return globalParams[n] || `{{${n}}}`
    if (paramMode === 'field') { const fk = fieldMap[n]; return fk ? (contact[fk] || `{{${n}}}`) : `{{${n}}}` }
    if (paramMode === 'csv') {
      const row = csvRows?.find(r => r.phone.replace(/\s/g,'') === contact.phone.replace(/\s/g,''))
      return row?.params?.[n] || `{{${n}}}`
    }
    return `{{${n}}}`
  }
  function getMsg(contact) {
    if (!selTpl) return ''
    return paramNums.reduce((b, n) => b.replace(new RegExp(`\\{\\{${n}\\}\\}`, 'g'), getParamValue(contact, n)), selTpl.body)
  }

  const preview = useMemo(() => {
    if (!selTpl) return ''
    return paramNums.reduce((b, n) => b.replace(new RegExp(`\\{\\{${n}\\}\\}`, 'g'), globalParams[n] || `{{${n}}}`), selTpl.body)
  }, [selTpl, globalParams, paramNums])

  const canFromCampaign  = !!tplId && !!campaignName.trim()
  const canFromVariables = !hasParams || (
    paramMode === 'global' ? paramNums.every(n => globalParams[n]?.trim()) :
    paramMode === 'field'  ? paramNums.every(n => !!fieldMap[n]) :
    !!(csvRows?.length)
  )
  const canSend = scheduleMode === 'now' || (!!scheduleDate && !!scheduleTime)

  function handleCsvUpload(e) {
    const file = e.target.files?.[0]; if (!file) return
    setCsvError('')
    const reader = new FileReader()
    reader.onload = ev => {
      try {
        const lines = ev.target.result.trim().split('\n').filter(Boolean)
        if (lines.length < 2) { setCsvError('CSV needs a header row + at least 1 data row.'); return }
        const rows = lines.slice(1).map(line => {
          const cols = line.split(',').map(col => col.trim().replace(/^"|"$/g, ''))
          const row = { phone: cols[0] || '', params: {} }
          paramNums.forEach((n, i) => { row.params[n] = cols[i + 1] || '' })
          return row
        }).filter(r => r.phone)
        if (!rows.length) { setCsvError('No valid rows found.'); return }
        setCsvRows(rows)
      } catch { setCsvError('Failed to parse CSV.') }
    }
    reader.readAsText(file)
  }

  function downloadCsvTemplate() {
    const hdr = ['phone', ...paramNums.map(n => `param_${n}`)].join(',')
    const ex  = ['+91 98100 00001', ...paramNums.map(n => `Value ${n}`)].join(',')
    const blob = new Blob([[hdr, ex].join('\n')], { type: 'text/csv' })
    const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(blob), download: 'retarget_template.csv' })
    a.click(); URL.revokeObjectURL(a.href)
  }

  function handleSend() {
    setSending(true)
    setTimeout(() => { setSending(false); setDone(true); setTimeout(onClose, 2000) }, 1400)
  }

  const previewContacts = (paramMode === 'csv' && csvRows?.length)
    ? csvRows.slice(0, 5).map((r, i) => ({ ...BC_PREVIEW_CONTACTS[i % BC_PREVIEW_CONTACTS.length], phone: r.phone }))
    : BC_PREVIEW_CONTACTS

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4"
      style={{ background: 'rgba(15,23,42,0.45)', backdropFilter: 'blur(4px)' }}
      onMouseDown={e => { if (e.target === e.currentTarget) onClose() }}>

      <div className="bg-white rounded-2xl shadow-2xl flex flex-col overflow-hidden"
        style={{ width: 'min(640px, calc(100vw - 24px))', maxHeight: '92vh' }}>

        {/* Header */}
        <div className="flex items-center gap-3 px-5 py-4 border-b border-slate-100 flex-shrink-0">
          <div className="w-9 h-9 rounded-xl bg-primary-50 flex items-center justify-center flex-shrink-0"
            style={{ border: '1.5px solid #0066ff25' }}>
            <Target size={16} className="text-primary"/>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[13px] font-bold text-slate-900">Retarget Campaign</p>
            <p className="text-[10px] text-slate-400 truncate">{c.name}</p>
          </div>
          <button onClick={onClose}
            className="w-7 h-7 flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors flex-shrink-0">
            <X size={14}/>
          </button>
        </div>

        {/* Step indicator */}
        {!done && (
          <div className="flex items-center gap-0.5 px-5 py-2.5 bg-slate-50 border-b border-slate-100 overflow-x-auto scrollbar-none flex-shrink-0">
            {stepSequence.map((s, i) => {
              const past = stepSequence.indexOf(step) > i
              const curr = step === s
              return (
                <span key={s} className="flex items-center gap-0.5 flex-shrink-0">
                  <span className={clsx('flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold transition-all',
                    curr ? 'bg-primary text-white' : past ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-400')}>
                    {past && <Check size={8}/>}
                    {STEP_LABELS[s]}
                  </span>
                  {i < stepSequence.length - 1 && <ChevronRight size={10} className="text-slate-300 mx-0.5"/>}
                </span>
              )
            })}
          </div>
        )}

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5">
          {done ? (
            <div className="flex flex-col items-center justify-center py-12 gap-3">
              <div className="w-14 h-14 rounded-full bg-emerald-50 border-2 border-emerald-200 flex items-center justify-center">
                <CheckCircle2 size={28} className="text-emerald-500"/>
              </div>
              <p className="text-sm font-bold text-slate-800">
                {scheduleMode === 'later' ? 'Campaign Scheduled!' : 'Retarget campaign queued!'}
              </p>
              <p className="text-xs text-slate-400 text-center max-w-xs">
                {scheduleMode === 'later'
                  ? `"${campaignName}" scheduled for ${scheduleDate ? new Date(scheduleDate+'T00:00').toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric'}) : ''} at ${scheduleTime}.`
                  : `"${campaignName}" sending to ${count.toLocaleString()} ${selSeg?.label.toLowerCase()} contacts.`}
              </p>
            </div>

          ) : step === 'segment' ? (
            <div className="space-y-4">
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Who do you want to re-engage?</p>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                {RETARGET_SEGMENTS.map(seg => {
                  const Icon = seg.icon
                  const cnt  = getCount(seg)
                  return (
                    <button key={seg.key} onClick={() => { setSegKey(seg.key); setStep('campaign') }}
                      className="flex flex-col items-start gap-2 p-3 rounded-xl border-2 text-left transition-all border-slate-100 hover:border-slate-200 hover:bg-slate-50 hover:shadow-sm">
                      <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
                        style={{ background: seg.bg, border: `1.5px solid ${seg.border}` }}>
                        <Icon size={13} style={{ color: seg.color }}/>
                      </div>
                      <div>
                        <p className="text-xs font-bold text-slate-700">{seg.label}</p>
                        <p className="text-[10px] text-slate-400 mt-0.5">{cnt.toLocaleString()} contacts</p>
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>

          ) : step === 'campaign' ? (
            <div className="space-y-4">
              {selSeg && (
                <div className="flex items-center gap-2 p-2.5 rounded-lg border" style={{ borderColor: selSeg.border, background: selSeg.bg }}>
                  <selSeg.icon size={12} style={{ color: selSeg.color }}/>
                  <p className="text-[11px] font-semibold" style={{ color: selSeg.color }}>
                    Retargeting {count.toLocaleString()} {selSeg.label} contacts
                  </p>
                </div>
              )}
              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1.5">Campaign Name</label>
                <input
                  className="w-full border border-slate-200 rounded-xl px-3 py-2 text-[12px] outline-none focus:border-primary focus:ring-1 focus:ring-primary/10"
                  placeholder="e.g. July Replied Follow-up"
                  value={campaignName}
                  onChange={e => setCampaignName(e.target.value)}
                />
              </div>
              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1.5">Template</label>
                <div className="relative mb-2">
                  <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"/>
                  <input className="w-full border border-slate-200 rounded-lg px-3 py-1.5 pl-8 text-xs outline-none focus:border-primary"
                    placeholder="Search templates…" value={q} onChange={e => setQ(e.target.value)}/>
                </div>
                <div className="space-y-1.5 max-h-52 overflow-y-auto">
                  {list.map(t => {
                    const active = tplId === t.id
                    return (
                      <button key={t.id} onClick={() => { setTplId(t.id); setGlobalParams({}); setFieldMap({}); setCsvRows(null) }}
                        className={clsx('w-full flex items-start gap-3 p-3 rounded-xl border-2 text-left transition-all',
                          active ? 'border-primary bg-primary-50' : 'border-slate-100 hover:border-slate-200')}>
                        <div className={clsx('w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5',
                          active ? 'bg-primary text-white' : 'bg-slate-100 text-slate-500')}>
                          <FileText size={12}/>
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-0.5">
                            <p className={clsx('text-xs font-semibold truncate', active ? 'text-primary' : 'text-slate-700')}>{t.name}</p>
                            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-500 flex-shrink-0">{t.category}</span>
                          </div>
                          <p className="text-[10px] text-slate-400 line-clamp-2 leading-relaxed">{t.body}</p>
                        </div>
                        {active && <Check size={13} className="text-primary flex-shrink-0 mt-1"/>}
                      </button>
                    )
                  })}
                </div>
              </div>
            </div>

          ) : step === 'variables' ? (
            <div className="space-y-4">
              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-2">How to fill variables?</label>
                <div className="flex rounded-xl border border-slate-200 overflow-hidden text-[11px] font-semibold">
                  {[{ k: 'global', label: 'Same for all' }, { k: 'field', label: 'Contact field' }, { k: 'csv', label: 'Upload CSV' }].map(({ k, label }) => (
                    <button key={k} onClick={() => setParamMode(k)}
                      className={clsx('flex-1 py-2 transition-colors', paramMode === k ? 'bg-primary text-white' : 'bg-white text-slate-500 hover:bg-slate-50')}>
                      {label}
                    </button>
                  ))}
                </div>
                <p className="text-[10px] text-slate-400 mt-1.5">
                  {paramMode === 'global' ? 'One value per variable — same for all contacts.' :
                   paramMode === 'field'  ? 'Map each variable to a contact attribute for personalization.' :
                   'Upload a CSV with per-contact values. Download template to get started.'}
                </p>
              </div>

              {paramMode === 'global' && (
                <div className="space-y-2">
                  {paramNums.map(n => (
                    <div key={n} className="flex items-center gap-2">
                      <span className="text-[10px] font-mono bg-slate-100 text-slate-600 px-2 py-1.5 rounded-lg w-12 text-center flex-shrink-0">{`{{${n}}}`}</span>
                      <input
                        className="flex-1 border border-slate-200 rounded-xl px-3 py-1.5 text-xs outline-none focus:border-primary"
                        placeholder={`Value for {{${n}}} — sent to all contacts`}
                        value={globalParams[n] || ''}
                        onChange={e => setGlobalParams(p => ({ ...p, [n]: e.target.value }))}
                      />
                    </div>
                  ))}
                </div>
              )}

              {paramMode === 'field' && (
                <div className="space-y-2">
                  {paramNums.map(n => (
                    <div key={n} className="flex items-center gap-2">
                      <span className="text-[10px] font-mono bg-slate-100 text-slate-600 px-2 py-1.5 rounded-lg w-12 text-center flex-shrink-0">{`{{${n}}}`}</span>
                      <NativeSelect sm
                        className="flex-1"
                        value={fieldMap[n] || ''}
                        onChange={e => setFieldMap(m => ({ ...m, [n]: e.target.value }))}>
                        <option value="">— Select contact field —</option>
                        {BC_CONTACT_FIELDS.map(f => <option key={f.key} value={f.key}>{f.label}</option>)}
                      </NativeSelect>
                    </div>
                  ))}
                </div>
              )}

              {paramMode === 'csv' && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-[10px] text-slate-500">Columns: <span className="font-mono text-slate-700">phone, {paramNums.map(n=>`param_${n}`).join(', ')}</span></p>
                    <button onClick={downloadCsvTemplate} className="text-[10px] font-semibold text-primary hover:text-primary-hover flex items-center gap-1 flex-shrink-0 ml-2">
                      <Download size={10}/> Template
                    </button>
                  </div>
                  <label className={clsx('flex flex-col items-center justify-center gap-2 border-2 border-dashed rounded-xl p-6 cursor-pointer transition-colors',
                    csvRows ? 'border-emerald-300 bg-emerald-50' : 'border-slate-300 hover:border-primary hover:bg-primary-50/40')}>
                    <input type="file" accept=".csv" className="hidden" onChange={handleCsvUpload}/>
                    {csvRows ? (
                      <><CheckCircle2 size={20} className="text-emerald-500"/><p className="text-[11px] font-semibold text-emerald-700">{csvRows.length} contacts loaded</p><p className="text-[10px] text-emerald-600">Click to replace</p></>
                    ) : (
                      <><Upload size={20} className="text-slate-400"/><p className="text-[11px] font-semibold text-slate-600">Click to upload CSV</p><p className="text-[10px] text-slate-400">phone, {paramNums.map(n=>`{{${n}}}`).join(', ')}</p></>
                    )}
                  </label>
                  {csvError && <p className="text-[10px] text-red-600 flex items-center gap-1"><AlertCircle size={10}/> {csvError}</p>}
                  {csvRows && (
                    <div className="border border-slate-200 rounded-xl overflow-hidden">
                      <div className="overflow-x-auto">
                        <table className="w-full text-[10px]">
                          <thead>
                            <tr className="bg-slate-50 border-b border-slate-200">
                              <th className="text-left px-3 py-2 text-slate-500 font-semibold">Phone</th>
                              {paramNums.map(n => <th key={n} className="text-left px-3 py-2 text-slate-500 font-semibold">{`{{${n}}}`}</th>)}
                            </tr>
                          </thead>
                          <tbody>
                            {csvRows.slice(0, 4).map((r, i) => (
                              <tr key={i} className="border-b border-slate-100 last:border-0">
                                <td className="px-3 py-1.5 text-slate-600 font-mono">{r.phone}</td>
                                {paramNums.map(n => <td key={n} className="px-3 py-1.5 text-slate-700">{r.params[n] || <span className="text-red-400 italic">empty</span>}</td>)}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                      {csvRows.length > 4 && <p className="text-[10px] text-slate-400 text-center py-1.5 border-t border-slate-100">+ {csvRows.length - 4} more rows</p>}
                    </div>
                  )}
                </div>
              )}
            </div>

          ) : step === 'preview' ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-[11px] font-semibold text-slate-700">Message preview per contact</p>
                <span className="text-[10px] text-slate-400">Showing 5 of {count.toLocaleString()}</span>
              </div>
              {!selTpl ? (
                <p className="text-[11px] text-slate-400 text-center py-8">No template selected.</p>
              ) : previewContacts.map((contact, i) => (
                <div key={i} className="border border-slate-200 rounded-xl p-3 space-y-2">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-full bg-primary-100 flex items-center justify-center flex-shrink-0">
                      <span className="text-[9px] font-bold text-primary">{contact.firstName[0]}{contact.lastName[0]}</span>
                    </div>
                    <div>
                      <p className="text-[11px] font-semibold text-slate-700">{contact.firstName} {contact.lastName}</p>
                      <p className="text-[9px] text-slate-400 font-mono">{contact.phone}</p>
                    </div>
                  </div>
                  <div className="flex justify-end">
                    <div className="bg-[#dcf8c6] rounded-2xl rounded-tr-sm px-3 py-1.5 max-w-[85%]">
                      <p className="text-[11px] text-slate-800 leading-relaxed">{getMsg(contact)}</p>
                      {selTpl?.buttons?.length > 0 && (
                        <div className="mt-1.5 space-y-1">
                          {selTpl.buttons.map((b, bi) => (
                            <div key={bi} className="text-center text-[10px] font-semibold text-blue-600 border border-blue-200 rounded-lg py-0.5 bg-white">{b}</div>
                          ))}
                        </div>
                      )}
                      <p className="text-[9px] text-slate-400 text-right mt-0.5">12:00 ✓✓</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>

          ) : step === 'confirm' ? (
            <div className="space-y-4">
              <div className="border border-slate-200 rounded-xl overflow-hidden">
                <div className="bg-slate-50 px-3 py-2 border-b border-slate-200">
                  <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Campaign Summary</p>
                </div>
                {[
                  { label: 'Campaign Name',   value: campaignName },
                  { label: 'Source Campaign', value: c.name },
                  { label: 'Segment',         value: selSeg ? `${selSeg.label} (${count.toLocaleString()})` : '—', color: selSeg?.color },
                  { label: 'Template',        value: selTpl?.name || '—' },
                  { label: 'Category',        value: selTpl?.category || '—' },
                  { label: 'Personalization', value: paramMode === 'global' ? 'Same for all contacts' : paramMode === 'field' ? 'Contact field mapping' : `CSV (${csvRows?.length || 0} rows)` },
                ].map(({ label, value, color }) => (
                  <div key={label} className="flex justify-between items-center px-3 py-2 border-b border-slate-100 last:border-0">
                    <span className="text-[10px] text-slate-500">{label}</span>
                    <span className="text-[11px] font-semibold truncate max-w-[60%] text-right" style={{ color: color || undefined }}>{value}</span>
                  </div>
                ))}
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-2">Delivery</label>
                <div className="flex rounded-xl border border-slate-200 overflow-hidden text-[11px] font-semibold">
                  {[{ k: 'now', label: 'Send Now', icon: Send }, { k: 'later', label: 'Schedule', icon: Calendar }].map(({ k, label, icon: Icon }) => (
                    <button key={k} onClick={() => setScheduleMode(k)}
                      className={clsx('flex-1 py-2 flex items-center justify-center gap-1.5 transition-colors',
                        scheduleMode === k ? 'bg-primary text-white' : 'bg-white text-slate-500 hover:bg-slate-50')}>
                      <Icon size={10}/> {label}
                    </button>
                  ))}
                </div>
                {scheduleMode === 'later' && (
                  <div className="flex gap-2 mt-3">
                    <DatePicker
                      value={scheduleDate}
                      onChange={setScheduleDate}
                      min={new Date().toISOString().split('T')[0]}
                      className="flex-1"
                      textSize="text-xs"
                    />
                    <NativeSelect value={scheduleTime} onChange={e => setScheduleTime(e.target.value)}
                      className="flex-1">
                      <option value="">Select time</option>
                      {Array.from({length:144},(_,i)=>{const h=Math.floor(i/6),m=(i%6)*10,hh=String(h).padStart(2,'0'),mm=String(m).padStart(2,'0'),ampm=h<12?'AM':'PM',h12=h===0?12:h>12?h-12:h;return <option key={i} value={`${hh}:${mm}`}>{`${h12}:${mm} ${ampm}`}</option>})}
                    </NativeSelect>
                  </div>
                )}
              </div>

              <div className="flex items-start gap-2 p-3 rounded-xl bg-amber-50 border border-amber-200">
                <AlertCircle size={13} className="text-amber-600 flex-shrink-0 mt-0.5"/>
                <p className="text-[11px] text-amber-700 leading-relaxed">
                  This will {scheduleMode === 'later' ? 'schedule' : 'send'} <span className="font-bold">{count.toLocaleString()} messages</span>
                  {scheduleMode === 'later' && scheduleDate && scheduleTime ? (() => { const d=new Date(scheduleDate+'T00:00'); const [h,m]=scheduleTime.split(':').map(Number); const ampm=h<12?'AM':'PM'; const h12=h===0?12:h>12?h-12:h; return ` on ${d.toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric'})} at ${h12}:${String(m).padStart(2,'0')} ${ampm}` })() : scheduleMode === 'now' ? ' immediately' : ''}.
                  {' '}Charges apply based on your WhatsApp tier.
                </p>
              </div>
            </div>
          ) : null}
        </div>

        {/* Footer */}
        {!done && (
          <div className="px-5 py-3.5 border-t border-slate-100 flex-shrink-0 flex items-center justify-between gap-2 bg-slate-50/60">
            <div>
              {step !== stepSequence[0] && (
                <button onClick={goBack} className="px-3.5 py-1.5 rounded-lg text-[11px] font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 transition-all">
                  ← Back
                </button>
              )}
            </div>
            <div className="flex items-center gap-2">
              <button onClick={onClose} className="px-3 py-1.5 rounded-lg text-[11px] font-semibold text-slate-500 hover:text-slate-700 transition-colors">
                Cancel
              </button>
              {step === 'segment' && <span className="text-[10px] text-slate-400 italic">Select a segment above</span>}
              {step === 'campaign' && (
                <button onClick={goNext} disabled={!canFromCampaign}
                  className={clsx('flex items-center gap-1 px-3.5 py-1.5 rounded-lg text-[11px] font-semibold text-white transition-all shadow-sm',
                    canFromCampaign ? 'bg-primary hover:bg-primary/90' : 'bg-slate-200 text-slate-400 cursor-not-allowed')}>
                  Next →
                </button>
              )}
              {step === 'variables' && (
                <button onClick={goNext} disabled={!canFromVariables}
                  className={clsx('flex items-center gap-1 px-3.5 py-1.5 rounded-lg text-[11px] font-semibold text-white transition-all shadow-sm',
                    canFromVariables ? 'bg-primary hover:bg-primary/90' : 'bg-slate-200 text-slate-400 cursor-not-allowed')}>
                  Preview →
                </button>
              )}
              {step === 'preview' && (
                <button onClick={goNext}
                  className="flex items-center gap-1 px-3.5 py-1.5 rounded-lg text-[11px] font-semibold text-white bg-primary hover:bg-primary/90 transition-all shadow-sm">
                  Confirm →
                </button>
              )}
              {step === 'confirm' && (
                <button onClick={handleSend} disabled={sending || !canSend}
                  className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-[11px] font-semibold text-white bg-primary hover:bg-primary/90 transition-all shadow-sm disabled:opacity-60 disabled:cursor-not-allowed">
                  {sending
                    ? <><span className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin"/> Sending…</>
                    : scheduleMode === 'later'
                      ? <><Calendar size={11}/> Schedule</>
                      : <><Send size={11}/> Launch Retarget</>}
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function CampaignInsights({ campaign: c, onBack }) {
  const [insightTab, setInsightTab] = useState('overview')
  const [recipientTab, setRecipientTab] = useState('All')
  const [showRetarget,       setShowRetarget]       = useState(false)
  const [retargetSegmentKey, setRetargetSegmentKey] = useState(null)
  const delivPct   = pct(c.successful, c.recipients)
  const readPct    = pct(c.read, c.recipients)
  const repliedPct = pct(c.replied, c.recipients)
  const failPct    = pct(c.failed, c.recipients)
  const recipients = generateRecipients(c)

  return (
    <div className="space-y-5">
      {/* Back header */}
      <div className="flex items-center gap-3">
        <button onClick={onBack}
          className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-900 transition-colors font-medium">
          <ChevronLeft size={16} /> Back to Campaigns
        </button>
        <span className="text-slate-300">/</span>
        <span className="text-sm font-semibold text-slate-900 truncate max-w-[400px]">{c.name}</span>
        <StatusPill status={c.status} />
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-0.5 bg-slate-100 p-1 rounded-xl w-fit">
        {['overview', 'recipients'].map(tab => (
          <button key={tab} onClick={() => setInsightTab(tab)}
            className={clsx('px-3.5 py-1.5 text-xs font-semibold capitalize rounded-lg transition-all',
              insightTab === tab ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700')}>
            {tab}
          </button>
        ))}
      </div>

      {insightTab === 'overview' && (
        <div className="space-y-5">
          {/* KPI tiles */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            {[
              { label: 'Recipients', value: c.recipients, color: 'text-slate-900',   sub: '100%',          barColor: 'bg-slate-300'   },
              { label: 'Delivered',  value: c.successful, color: 'text-emerald-600', sub: `${delivPct}%`,   barColor: 'bg-emerald-500' },
              { label: 'Read',       value: c.read,       color: 'text-teal-600',    sub: `${readPct}%`,    barColor: 'bg-teal-500'    },
              { label: 'Replied',    value: c.replied,    color: 'text-violet-600',  sub: `${repliedPct}%`, barColor: 'bg-violet-500'  },
              { label: 'Failed',     value: c.failed,     color: 'text-red-600',     sub: `${failPct}%`,    barColor: 'bg-red-500'     },
            ].map(({ label, value, color, sub, barColor }) => (
              <div key={label} className="card p-4">
                <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1">{label}</p>
                <p className={clsx('text-xl font-bold leading-none mb-1', color)}>{value.toLocaleString()}</p>
                <div className="h-1 bg-slate-100 rounded-full mb-1.5">
                  <div className={clsx('h-full rounded-full', barColor)} style={{ width: sub }} />
                </div>
                <p className="text-[10px] text-slate-400">{sub} rate</p>
              </div>
            ))}
          </div>

          {/* Funnel + buttons */}
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
            <div className="lg:col-span-3 card p-5">
              <h3 className="text-xs font-bold text-slate-700 mb-4">Delivery Funnel</h3>
              <div className="space-y-3">
                {[
                  { label: 'Sent',      value: c.recipients, pctVal: 100,      bar: 'bg-slate-300'   },
                  { label: 'Delivered', value: c.successful, pctVal: delivPct,  bar: 'bg-emerald-500' },
                  { label: 'Read',      value: c.read,       pctVal: readPct,   bar: 'bg-teal-500'    },
                  { label: 'Replied',   value: c.replied,    pctVal: repliedPct,bar: 'bg-violet-500'  },
                  { label: 'Clicked',   value: c.clicks,     pctVal: pct(c.clicks, c.recipients), bar: 'bg-blue-500' },
                ].map(({ label, value, pctVal, bar }) => (
                  <div key={label} className="flex items-center gap-3">
                    <span className="text-xs text-slate-500 w-16 flex-shrink-0">{label}</span>
                    <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                      <div className={clsx('h-full rounded-full transition-all', bar)} style={{ width: `${pctVal}%` }} />
                    </div>
                    <span className="text-xs font-semibold text-slate-700 w-8 text-right tabular-nums">{pctVal}%</span>
                    <span className="text-xs text-slate-400 w-12 text-right tabular-nums">{value.toLocaleString()}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="col-span-2 card p-5">
              <h3 className="text-xs font-bold text-slate-700 mb-4">Button Responses</h3>
              {c.template.buttons?.length > 0 ? (
                <div className="space-y-3">
                  {c.template.buttons.map((btn, i) => {
                    const clicks = Math.round(c.clicks / c.template.buttons.length * (i === 0 ? 0.6 : 0.4))
                    const clickPct = pct(clicks, c.recipients)
                    return (
                      <div key={btn}>
                        <div className="flex justify-between text-xs mb-1.5">
                          <span className="font-medium text-slate-700">{btn}</span>
                          <span className="text-slate-500">{clicks.toLocaleString()} clicks</span>
                        </div>
                        <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                          <div className="h-full bg-blue-400 rounded-full" style={{ width: `${clickPct}%` }} />
                        </div>
                        <p className="text-[10px] text-slate-400 mt-0.5">{clickPct}% click rate</p>
                      </div>
                    )
                  })}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center h-20 text-slate-300">
                  <MousePointerClick size={20} />
                  <p className="text-xs mt-1">No buttons in this template</p>
                </div>
              )}

              <div className="mt-4 pt-4 border-t border-surface-border">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs font-bold text-slate-700">Retarget</p>
                  <span className="text-[9px] text-slate-400 font-medium">Send a new template to a segment</span>
                </div>
                <div className="grid grid-cols-2 gap-1.5">
                  {RETARGET_SEGMENTS.map(seg => {
                    const Icon  = seg.icon
                    const count = seg.field ? c[seg.field] ?? 0 : seg.get ? seg.get(c) : 0
                    return (
                      <button key={seg.key} onClick={() => { setRetargetSegmentKey(seg.key); setShowRetarget(true) }}
                        className="flex items-center justify-between px-2.5 py-2 rounded-lg border border-surface-border text-left transition-all hover:border-primary/40 hover:bg-primary-50 group">
                        <div className="flex items-center gap-1.5">
                          <Icon size={11} style={{ color: seg.color }} className="flex-shrink-0"/>
                          <span className="text-[11px] font-medium text-slate-600 group-hover:text-primary">{seg.label}</span>
                        </div>
                        <span className="text-[10px] font-bold text-slate-400">{count.toLocaleString()}</span>
                      </button>
                    )
                  })}
                </div>
              </div>

            </div>
          </div>

          {/* Template preview */}
          <div className="card p-5">
            <div className="flex flex-col sm:flex-row items-start gap-4 sm:gap-6">
              <div className="flex-1">
                <p className="text-xs font-bold text-slate-700 mb-1">{c.template.name.replace(/_/g, ' ')}</p>
                <p className="text-xs text-slate-500 leading-relaxed">{c.template.body}</p>
                {c.template.buttons?.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {c.template.buttons.map(b => (
                      <span key={b} className="text-[10px] font-semibold text-primary border border-primary/30 px-2 py-0.5 rounded-full bg-primary/5">{b}</span>
                    ))}
                  </div>
                )}
              </div>
              <div className="flex-shrink-0">
                <PhonePreview tpl={c.template} />
              </div>
            </div>
          </div>
        </div>
      )}

      {insightTab === 'recipients' && (
        <div className="card p-0 overflow-hidden">
          {/* Filter tabs + actions */}
          <div className="flex items-center gap-2 px-4 py-2 border-b border-surface-border min-w-0">
            {/* scrollable tab pills */}
            <div className="flex-1 overflow-x-auto scrollbar-none min-w-0">
              <div className="flex items-center gap-0.5 bg-slate-100 p-1 rounded-xl w-fit">
                {['All', 'Delivered', 'Read', 'Replied', 'Failed'].map(tab => {
                  const count = tab === 'All' ? recipients.length :
                    tab === 'Delivered' ? recipients.filter(r => r.status === 'Delivered').length :
                    tab === 'Read'      ? recipients.filter(r => r.read).length :
                    tab === 'Replied'   ? recipients.filter(r => r.replied).length :
                    recipients.filter(r => r.status === 'Failed').length
                  return (
                    <button key={tab} onClick={() => setRecipientTab(tab)}
                      className={clsx('flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition-all whitespace-nowrap',
                        recipientTab === tab ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700')}>
                      {tab}
                      <span className={clsx('text-[10px] font-bold px-1.5 py-0.5 rounded-full',
                        recipientTab === tab ? 'bg-primary/10 text-primary' : 'bg-white/0 text-slate-400')}>
                        {count}
                      </span>
                    </button>
                  )
                })}
              </div>
            </div>

            {/* fixed action buttons — always visible */}
            <div className="flex items-center gap-2 flex-shrink-0">
              <button className="flex items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-slate-700 px-2.5 py-1.5 rounded-lg border border-surface-border transition-colors whitespace-nowrap">
                <Download size={12} /> Export CSV
              </button>
              {recipientTab !== 'All' && (
                <button
                  onClick={() => {
                    setRetargetSegmentKey(
                      recipientTab === 'Delivered' ? 'delivered' :
                      recipientTab === 'Read'      ? 'read'      :
                      recipientTab === 'Replied'   ? 'replied'   :
                      recipientTab === 'Failed'    ? 'failed'    : null
                    )
                    setShowRetarget(true)
                  }}
                  className="flex items-center gap-1.5 text-xs font-semibold text-primary hover:text-primary-hover px-2.5 py-1.5 rounded-lg border border-primary-100 bg-primary-50 hover:bg-primary-100 transition-colors whitespace-nowrap">
                  <Target size={12} /> Retarget {recipientTab}
                </button>
              )}
            </div>
          </div>
          <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[480px]">
            <thead>
              <tr className="border-b border-surface-border bg-slate-50/60">
                <th className="px-5 py-3 text-left text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Contact</th>
                <th className="px-4 py-3 text-left text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Phone</th>
                <th className="px-4 py-3 text-left text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Status</th>
                <th className="px-4 py-3 text-left text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Read</th>
                <th className="px-4 py-3 text-left text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Replied</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-border">
              {recipients.filter(r => {
                if (recipientTab === 'All') return true
                if (recipientTab === 'Delivered') return r.status === 'Delivered'
                if (recipientTab === 'Read') return r.read
                if (recipientTab === 'Replied') return r.replied
                if (recipientTab === 'Failed') return r.status === 'Failed'
                return true
              }).map((r, i) => (
                <tr key={i} className="hover:bg-slate-50/50 transition-colors">
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-2.5">
                      <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center text-primary text-[10px] font-bold flex-shrink-0">
                        {r.name.split(' ').map(w => w[0]).join('').slice(0, 2)}
                      </div>
                      <span className="text-xs font-medium text-slate-800">{r.name}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-500">{r.phone}</td>
                  <td className="px-4 py-3">
                    <span className={clsx('text-[10px] font-semibold px-2 py-0.5 rounded-full',
                      r.status === 'Delivered' ? 'bg-emerald-50 text-emerald-700' :
                      r.status === 'Failed' ? 'bg-red-50 text-red-700' : 'bg-amber-50 text-amber-700')}>
                      {r.status}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {r.read ? <Check size={14} className="text-teal-500" /> : <span className="text-slate-300">—</span>}
                  </td>
                  <td className="px-4 py-3">
                    {r.replied ? <Check size={14} className="text-violet-500" /> : <span className="text-slate-300">—</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>{/* end overflow-x-auto */}
        </div>
      )}

      {showRetarget && (
        <RetargetModal
          campaign={c}
          initialSegment={retargetSegmentKey}
          onClose={() => { setShowRetarget(false); setRetargetSegmentKey(null) }}
        />
      )}
    </div>
  )
}

/* ─────────────────────────── NEW CAMPAIGN WIZARD ─────────────────────────── */
function NewCampaignWizard({ onClose, onCreated }) {
  const [step,        setStep]        = useState(0)
  const [selTpl,      setSelTpl]      = useState(null)
  const [tplSearch,   setTplSearch]   = useState('')
  const [mode,        setMode]        = useState('group')   // 'group' | 'csv'
  const [selGroup,    setSelGroup]    = useState(null)
  const [csvFile,     setCsvFile]     = useState(null)
  const [csvColumns,  setCsvColumns]  = useState([])        // parsed CSV column headers
  const [varMappings, setVarMappings] = useState({})        // { '1': { type:'field'|'static'|'csv', value:'' } }
  const [campName,    setCampName]    = useState('')
  const [sendNow,     setSendNow]     = useState(true)
  const [schedDate,   setSchedDate]   = useState('')
  const [schedTime,   setSchedTime]   = useState('09:00')
  const [timezone,    setTimezone]    = useState('Asia/Kolkata')
  const [launching,   setLaunching]   = useState(false)
  const [launched,    setLaunched]    = useState(false)
  // Component-aware parameter state (per Meta WhatsApp template API)
  const [headerComp,  setHeaderComp]  = useState(null)   // header component params/media
  const [buttonComps, setButtonComps] = useState({})     // { [btnIndex]: { value|payload|code } }

  const tplList = useMemo(() => {
    const q = tplSearch.toLowerCase()
    return APPROVED_TEMPLATES.filter(t =>
      t.status === 'APPROVED' &&
      (!q || t.name.toLowerCase().includes(q) || t.body.toLowerCase().includes(q))
    )
  }, [tplSearch])

  // Extract params per component
  const tplParams       = useMemo(() => extractParams(selTpl),          [selTpl])
  const headerParamKeys = useMemo(() => extractHeaderParams(selTpl),    [selTpl])
  const btnsNeedInput   = useMemo(() => getButtonsNeedingInput(selTpl), [selTpl])

  // Auto-initialize ALL component mappings whenever the template changes
  useEffect(() => {
    if (!selTpl) { setHeaderComp(null); setButtonComps({}); return }

    // Body params — respect bodyParamTypes if defined
    const bodyInit = {}
    const pTypes = selTpl.bodyParamTypes || {}
    extractParams(selTpl).forEach((p, i) => {
      const pType = pTypes[p] || 'text'
      if (pType === 'currency') {
        bodyInit[p] = { type: 'currency', code: 'INR', amount: '' }
      } else if (pType === 'datetime') {
        bodyInit[p] = { type: 'datetime', value: '' }
      } else {
        bodyInit[p] = i === 0 ? { type: 'field', value: 'name' } : { type: 'static', value: '' }
      }
    })
    setVarMappings(bodyInit)

    // Header component
    const ht = selTpl.headerType || 'NONE'
    if (ht === 'IMAGE' || ht === 'VIDEO') {
      setHeaderComp({ link: '' })
    } else if (ht === 'DOCUMENT') {
      setHeaderComp({ link: '', filename: '' })
    } else if (ht === 'LOCATION') {
      setHeaderComp({ name: '', address: '', lat: '', lng: '' })
    } else if (ht === 'TEXT') {
      const hParams = extractHeaderParams(selTpl)
      const hInit = {}
      hParams.forEach(p => { hInit[p] = { type: 'static', value: '' } })
      setHeaderComp({ params: hInit })
    } else {
      setHeaderComp(null)
    }

    // Button components
    const btnInit = {}
    getButtonsNeedingInput(selTpl).forEach(btn => {
      if (btn.type === 'URL') btnInit[btn.index] = { value: '' }
      else if (btn.type === 'QUICK_REPLY') btnInit[btn.index] = { payload: '' }
      else if (btn.type === 'COPY_CODE') btnInit[btn.index] = { code: '' }
    })
    setButtonComps(btnInit)
  }, [selTpl?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  const audience = selGroup?.count || 0

  // Build filled previews per component
  const filledBody = useMemo(() =>
    fillText(selTpl?.body || '', tplParams, varMappings, SAMPLE_CONTACT),
    [selTpl, tplParams, varMappings]
  )
  const filledHeaderText = useMemo(() => {
    if (!selTpl || selTpl.headerType !== 'TEXT' || !selTpl.headerText) return ''
    if (!headerComp?.params || headerParamKeys.length === 0) return selTpl.headerText
    return fillText(selTpl.headerText, headerParamKeys, headerComp.params, SAMPLE_CONTACT)
  }, [selTpl, headerComp, headerParamKeys])

  const previewTpl = useMemo(() =>
    selTpl ? {
      ...selTpl,
      bold: filledHeaderText || selTpl.bold || selTpl.headerText || '',
      body: filledBody || selTpl.body,
    } : null,
    [selTpl, filledBody, filledHeaderText]
  )

  // Variables step valid if all required fields are filled
  const variablesValid = useMemo(() => {
    if (!selTpl) return false
    const ht = selTpl.headerType || 'NONE'
    // Header media/location required
    if ((ht === 'IMAGE' || ht === 'VIDEO') && !headerComp?.link?.trim()) return false
    if (ht === 'DOCUMENT' && !headerComp?.link?.trim()) return false
    if (ht === 'LOCATION' && (!headerComp?.lat?.trim() || !headerComp?.lng?.trim())) return false
    // Header text params
    if (ht === 'TEXT' && headerParamKeys.length > 0) {
      if (!headerParamKeys.every(p => headerComp?.params?.[p]?.value?.trim())) return false
    }
    // Body params — type-aware validation
    if (!tplParams.every(p => {
      const m = varMappings[p]
      if (!m) return false
      if (m.type === 'currency') return !!(m.code && m.amount?.trim())
      if (m.type === 'datetime') return !!m.value?.trim()
      return !!m.value?.trim()
    })) return false
    // Button params — only URL suffix and COPY_CODE are required
    for (const btn of btnsNeedInput) {
      if (btn.type === 'URL' && btn.url?.includes('{{') && !buttonComps[btn.index]?.value?.trim()) return false
      if (btn.type === 'COPY_CODE' && !buttonComps[btn.index]?.code?.trim()) return false
    }
    return true
  }, [selTpl, headerComp, tplParams, varMappings, btnsNeedInput, buttonComps, headerParamKeys])

  const canNext = [
    !!selTpl,
    !!(selGroup || csvFile),
    variablesValid,
    !!campName.trim(),
    true,
  ][step]

  function setMapping(param, type, value) {
    if (type === 'currency') {
      setVarMappings(prev => ({ ...prev, [param]: { type: 'currency', code: 'INR', amount: '', ...(typeof value === 'object' ? value : {}) } }))
    } else if (type === 'datetime') {
      setVarMappings(prev => ({ ...prev, [param]: { type: 'datetime', value: value || '' } }))
    } else {
      setVarMappings(prev => ({ ...prev, [param]: { type, value } }))
    }
  }
  function setCurrencyField(param, field, val) {
    setVarMappings(prev => ({ ...prev, [param]: { ...prev[param], type: 'currency', [field]: val } }))
  }

  // Parse CSV file headers (first row)
  function handleCsvUpload(file) {
    setCsvFile(file)
    setSelGroup({ name: file.name, count: 0 })
    const reader = new FileReader()
    reader.onload = e => {
      const firstLine = (e.target.result || '').split('\n')[0]
      const cols = firstLine.split(',').map(c => c.trim().replace(/^"|"$/g, ''))
      setCsvColumns(cols)
    }
    reader.readAsText(file)
  }

  async function launch() {
    setLaunching(true)
    await new Promise(r => setTimeout(r, 1400))
    const newCampaign = {
      id: 'c_' + Date.now(),
      name: campName,
      date: new Date().toISOString().slice(0, 16).replace('T', ' '),
      channel: 'Default',
      recipients: audience,
      successful: 0, read: 0, replied: 0,
      failed: 0, ignored: 0, sending: audience, clicks: 0,
      status: sendNow ? 'Sending' : 'Scheduled',
      template: selTpl,
    }
    onCreated(newCampaign)
    setLaunching(false)
    setLaunched(true)
    setTimeout(onClose, 1800)
  }

  const steps = [
    { label: 'Template',  icon: FileText     },
    { label: 'Audience',  icon: Users        },
    { label: 'Variables', icon: MessageSquare },
    { label: 'Schedule',  icon: Calendar     },
    { label: 'Review',    icon: CheckCircle2 },
  ]

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(2px)' }}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl flex flex-col overflow-hidden"
        style={{ maxHeight: 'calc(100vh - 48px)' }}>

        {/* ── Header ── */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-surface-border flex-shrink-0">
          <div>
            <h2 className="text-sm font-bold text-slate-900">Create New Campaign</h2>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Step {step + 1} of {steps.length} — {steps[step].label}
            </p>
          </div>
          <button onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-surface-hover transition-colors">
            <X size={16} />
          </button>
        </div>

        {/* ── Step Indicator ── */}
        <div className="flex items-center px-6 py-3.5 border-b border-surface-border bg-slate-50/50 flex-shrink-0">
          {steps.map((s, i) => {
            const done    = i < step
            const current = i === step
            return (
              <div key={s.label} className="flex items-center flex-1 last:flex-none min-w-0">
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  <div className={clsx(
                    'w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold transition-all flex-shrink-0',
                    done    ? 'bg-primary text-white' :
                    current ? 'bg-primary text-white ring-4 ring-primary/20' :
                              'bg-slate-100 text-slate-400'
                  )}>
                    {done ? <Check size={11} /> : i + 1}
                  </div>
                  <span className={clsx('text-[11px] font-semibold hidden sm:block',
                    current ? 'text-slate-900' : done ? 'text-slate-500' : 'text-slate-400')}>
                    {s.label}
                  </span>
                </div>
                {i < steps.length - 1 && (
                  <div className={clsx('flex-1 h-px mx-2 transition-all', i < step ? 'bg-primary' : 'bg-slate-200')} />
                )}
              </div>
            )
          })}
        </div>

        {/* ── Step Content ── */}
        <div className="flex-1 overflow-y-auto min-h-0">

          {/* STEP 0 — Template */}
          {step === 0 && (
            <div className="flex h-full" style={{ minHeight: 380 }}>
              <div className="flex-1 flex flex-col border-r border-surface-border min-w-0">
                <div className="p-4 border-b border-surface-border flex-shrink-0">
                  <div className="relative">
                    <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      className="w-full pl-9 pr-4 py-2 text-sm border border-surface-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all placeholder-slate-400"
                      placeholder="Search approved templates…"
                      value={tplSearch}
                      onChange={e => setTplSearch(e.target.value)}
                    />
                  </div>
                </div>
                <div className="flex-1 overflow-y-auto divide-y divide-surface-border">
                  {tplList.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-32 text-slate-300">
                      <FileText size={24} className="mb-2" />
                      <p className="text-xs">No templates found</p>
                    </div>
                  ) : tplList.map(t => (
                    <div key={t.id} onClick={() => setSelTpl(t)}
                      className={clsx(
                        'flex items-start gap-3 px-4 py-3 cursor-pointer transition-colors border-l-2',
                        selTpl?.id === t.id
                          ? 'bg-primary/5 border-primary'
                          : 'hover:bg-slate-50 border-transparent'
                      )}>
                      <div className={clsx('w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5',
                        t.category === 'MARKETING' ? 'bg-violet-50' : 'bg-blue-50')}>
                        <FileText size={13} className={t.category === 'MARKETING' ? 'text-violet-500' : 'text-blue-500'} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                          <p className="text-xs font-semibold text-slate-800 truncate">{t.name.replace(/_/g, ' ')}</p>
                          <span className={clsx('text-[9px] font-bold px-1.5 py-0.5 rounded flex-shrink-0',
                            t.category === 'MARKETING' ? 'bg-violet-50 text-violet-600' : 'bg-blue-50 text-blue-600')}>
                            {t.category?.charAt(0) + t.category?.slice(1).toLowerCase()}
                          </span>
                          {extractParams(t).length > 0 && (
                            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-amber-50 text-amber-600 flex-shrink-0">
                              {extractParams(t).length} var{extractParams(t).length > 1 ? 's' : ''}
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-slate-400 leading-snug line-clamp-2">{t.body}</p>
                      </div>
                      {selTpl?.id === t.id && <CheckCircle2 size={15} className="text-primary flex-shrink-0 mt-1" />}
                    </div>
                  ))}
                </div>
              </div>
              {/* Preview panel */}
              <div className="w-52 flex-shrink-0 p-5 bg-slate-50 flex flex-col items-center overflow-y-auto">
                <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-4 w-full">Preview</p>
                <PhonePreview tpl={selTpl} />
                {selTpl && (
                  <div className="mt-4 w-full space-y-2">
                    {tplParams.length > 0 && (
                      <div className="p-2.5 rounded-lg bg-amber-50 border border-amber-100">
                        <p className="text-[10px] font-bold text-amber-700 mb-1">
                          {tplParams.length} variable{tplParams.length > 1 ? 's' : ''} detected
                        </p>
                        <p className="text-[10px] text-amber-600">You'll map these in Step 3</p>
                      </div>
                    )}
                    {selTpl.buttons?.length > 0 && (
                      <div>
                        <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Buttons</p>
                        {selTpl.buttons.map(b => (
                          <div key={b} className="text-[10px] text-primary border border-primary/30 rounded-lg px-2.5 py-1.5 mb-1.5 text-center font-semibold bg-primary/5">
                            {b}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* STEP 1 — Audience */}
          {step === 1 && (
            <div className="p-6 space-y-5">
              <div className="flex rounded-xl border border-surface-border overflow-hidden bg-slate-50 p-1 w-fit">
                {[['group', Users, 'Contact Group'], ['csv', Upload, 'Upload CSV']].map(([k, Icon, lbl]) => (
                  <button key={k} onClick={() => { setMode(k); setSelGroup(null); setCsvFile(null) }}
                    className={clsx('flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-lg transition-all',
                      mode === k ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700')}>
                    <Icon size={13} /> {lbl}
                  </button>
                ))}
              </div>

              {mode === 'group' && (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {CONTACT_GROUPS.map(g => (
                    <div key={g.id} onClick={() => setSelGroup(g)}
                      className={clsx(
                        'rounded-xl border p-4 cursor-pointer transition-all hover:shadow-sm',
                        selGroup?.id === g.id
                          ? 'border-primary bg-primary/5 shadow-sm ring-1 ring-primary/20'
                          : 'border-surface-border hover:border-slate-300'
                      )}>
                      <div className="flex items-start justify-between mb-2">
                        <span className="text-xl">{g.icon}</span>
                        {selGroup?.id === g.id && <CheckCircle2 size={14} className="text-primary" />}
                      </div>
                      <p className="text-xs font-bold text-slate-800 mb-0.5">{g.name}</p>
                      <p className="text-[10px] text-slate-400 mb-2 leading-snug">{g.desc}</p>
                      <div className="flex items-center gap-1">
                        <Users size={10} className="text-slate-400" />
                        <span className="text-xs font-bold text-primary">{g.count.toLocaleString()}</span>
                        <span className="text-[10px] text-slate-400">contacts</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {mode === 'csv' && (
                <div className="space-y-4">
                  <label className="border-2 border-dashed border-slate-200 rounded-xl p-10 text-center cursor-pointer hover:border-primary hover:bg-primary/5 transition-all block">
                    <Upload size={28} className="text-slate-300 mx-auto mb-3" />
                    {csvFile
                      ? <><p className="font-semibold text-primary text-sm">{csvFile.name}</p><p className="text-xs text-slate-400 mt-1">Click to replace</p></>
                      : <>
                          <p className="font-semibold text-slate-600 text-sm">Drop your CSV or Excel file here</p>
                          <p className="text-xs text-slate-400 mt-1">Required columns: <code className="bg-slate-100 px-1 rounded">phone</code> + one column per variable</p>
                        </>
                    }
                    <input type="file" accept=".csv,.xlsx" hidden
                      onChange={e => handleCsvUpload(e.target.files[0])} />
                  </label>

                  {/* CSV format guide */}
                  {!csvFile && (
                    <div className="rounded-xl border border-surface-border overflow-hidden">
                      <div className="px-4 py-2.5 bg-slate-50 border-b border-surface-border">
                        <p className="text-xs font-bold text-slate-600">Expected CSV format</p>
                      </div>
                      <div className="overflow-x-auto">
                        <table className="w-full text-xs">
                          <thead>
                            <tr className="bg-slate-50 border-b border-surface-border">
                              <th className="px-4 py-2 text-left font-semibold text-slate-500">phone</th>
                              {tplParams.map(p => (
                                <th key={p} className="px-4 py-2 text-left font-semibold text-amber-600">var{p}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-surface-border">
                            {[
                              ['+919876543210', 'Rahul', 'ORD-1024', 'May 20'],
                              ['+918765432109', 'Priya', 'ORD-1025', 'May 21'],
                            ].map((row, ri) => (
                              <tr key={ri}>
                                <td className="px-4 py-2 text-slate-600 font-mono">{row[0]}</td>
                                {tplParams.map((p, pi) => (
                                  <td key={p} className="px-4 py-2 text-slate-500">{row[pi + 1] || '—'}</td>
                                ))}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {(selGroup || csvFile) && (
                <div className="flex items-center gap-3 p-4 rounded-xl bg-emerald-50 border border-emerald-200">
                  <CheckCircle2 size={18} className="text-emerald-500 flex-shrink-0" />
                  <div>
                    <p className="font-semibold text-emerald-800 text-sm">
                      {selGroup?.count > 0 ? `${selGroup.count.toLocaleString()} recipients selected` : 'CSV file uploaded'}
                    </p>
                    <p className="text-xs text-emerald-600 mt-0.5">{selGroup?.name}</p>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* STEP 2 — Variables (component-aware) */}
          {step === 2 && (
            <div className="p-6 space-y-5">
              {!selTpl ? null : (selTpl.headerType === 'NONE' && tplParams.length === 0 && btnsNeedInput.length === 0) ? (
                /* No variables */
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <div className="w-12 h-12 rounded-2xl bg-emerald-50 flex items-center justify-center mb-3">
                    <CheckCircle2 size={22} className="text-emerald-500" />
                  </div>
                  <p className="text-sm font-semibold text-slate-700">No variables in this template</p>
                  <p className="text-xs text-slate-400 mt-1 max-w-xs">
                    This template sends the same message to all recipients. Continue to the next step.
                  </p>
                </div>
              ) : (
                <>
                  {/* ── HEADER COMPONENT ── */}
                  {selTpl.headerType && selTpl.headerType !== 'NONE' && (() => {
                    const ht = selTpl.headerType
                    const HEADER_TYPE_CFG = {
                      IMAGE:    { color: 'bg-pink-50 text-pink-700 border-pink-200',    dot: 'bg-pink-400',    icon: '🖼️' },
                      VIDEO:    { color: 'bg-purple-50 text-purple-700 border-purple-200', dot: 'bg-purple-400', icon: '🎥' },
                      DOCUMENT: { color: 'bg-blue-50 text-blue-700 border-blue-200',    dot: 'bg-blue-400',    icon: '📄' },
                      LOCATION: { color: 'bg-emerald-50 text-emerald-700 border-emerald-200', dot: 'bg-emerald-400', icon: '📍' },
                      TEXT:     { color: 'bg-slate-50 text-slate-700 border-slate-200', dot: 'bg-slate-400',   icon: '✏️' },
                    }
                    const cfg = HEADER_TYPE_CFG[ht] || HEADER_TYPE_CFG.TEXT
                    return (
                      <div className="rounded-xl border border-surface-border overflow-hidden">
                        {/* Section label */}
                        <div className="flex items-center justify-between px-4 py-3 bg-slate-50 border-b border-surface-border">
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Header</span>
                            <span className={clsx('text-[10px] font-bold px-2 py-0.5 rounded-full border', cfg.color)}>
                              {cfg.icon} {ht}
                            </span>
                          </div>
                          <Info size={12} className="text-slate-300" />
                        </div>
                        <div className="p-4 space-y-3">

                          {/* IMAGE / VIDEO — media link */}
                          {(ht === 'IMAGE' || ht === 'VIDEO') && (
                            <div>
                              <label className="block text-[11px] font-semibold text-slate-600 mb-1.5">
                                {ht === 'IMAGE' ? 'Image' : 'Video'} URL <span className="text-red-500">*</span>
                              </label>
                              <div className="flex items-center gap-2">
                                <input
                                  className="flex-1 px-3 py-2 text-xs border border-surface-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all placeholder-slate-400"
                                  placeholder={`https://example.com/${ht === 'IMAGE' ? 'banner.jpg' : 'promo.mp4'}`}
                                  value={headerComp?.link || ''}
                                  onChange={e => setHeaderComp(prev => ({ ...prev, link: e.target.value }))}
                                />
                                {headerComp?.link?.trim() && (
                                  <div className="flex items-center gap-1 text-[10px] text-emerald-600 font-semibold flex-shrink-0">
                                    <CheckCircle2 size={12} /> Linked
                                  </div>
                                )}
                              </div>
                              <p className="text-[10px] text-slate-400 mt-1">
                                Must be a publicly accessible HTTPS URL. {ht === 'IMAGE' ? 'JPG, PNG or WEBP.' : 'MP4, max 16MB.'}
                              </p>
                            </div>
                          )}

                          {/* DOCUMENT — link + optional filename */}
                          {ht === 'DOCUMENT' && (
                            <>
                              <div>
                                <label className="block text-[11px] font-semibold text-slate-600 mb-1.5">
                                  Document URL <span className="text-red-500">*</span>
                                </label>
                                <div className="flex items-center gap-2">
                                  <input
                                    className="flex-1 px-3 py-2 text-xs border border-surface-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all placeholder-slate-400"
                                    placeholder="https://example.com/receipt.pdf"
                                    value={headerComp?.link || ''}
                                    onChange={e => setHeaderComp(prev => ({ ...prev, link: e.target.value }))}
                                  />
                                  {headerComp?.link?.trim() && (
                                    <div className="flex items-center gap-1 text-[10px] text-emerald-600 font-semibold flex-shrink-0">
                                      <CheckCircle2 size={12} /> Linked
                                    </div>
                                  )}
                                </div>
                                <p className="text-[10px] text-slate-400 mt-1">Publicly accessible HTTPS URL. PDF, DOC, DOCX supported.</p>
                              </div>
                              <div>
                                <label className="block text-[11px] font-semibold text-slate-600 mb-1.5">Filename <span className="text-slate-400 font-normal">(optional)</span></label>
                                <input
                                  className="w-full px-3 py-2 text-xs border border-surface-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all placeholder-slate-400"
                                  placeholder="e.g. receipt_may2025.pdf"
                                  value={headerComp?.filename || ''}
                                  onChange={e => setHeaderComp(prev => ({ ...prev, filename: e.target.value }))}
                                />
                              </div>
                            </>
                          )}

                          {/* LOCATION — name, address, lat, lng */}
                          {ht === 'LOCATION' && (
                            <div className="space-y-3">
                              <div className="flex items-start gap-2 p-2.5 rounded-lg bg-emerald-50 border border-emerald-100">
                                <Info size={12} className="text-emerald-500 flex-shrink-0 mt-0.5" />
                                <p className="text-[10px] text-emerald-700">
                                  This template sends a location pin as the header. Latitude and longitude are required — they must match the actual store/pickup location.
                                </p>
                              </div>
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <div>
                                  <label className="block text-[11px] font-semibold text-slate-600 mb-1.5">Location Name</label>
                                  <input
                                    className="w-full px-3 py-2 text-xs border border-surface-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all placeholder-slate-400"
                                    placeholder="e.g. Main Store"
                                    value={headerComp?.name || ''}
                                    onChange={e => setHeaderComp(prev => ({ ...prev, name: e.target.value }))}
                                  />
                                </div>
                                <div>
                                  <label className="block text-[11px] font-semibold text-slate-600 mb-1.5">Address</label>
                                  <input
                                    className="w-full px-3 py-2 text-xs border border-surface-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all placeholder-slate-400"
                                    placeholder="123 Main St, Mumbai"
                                    value={headerComp?.address || ''}
                                    onChange={e => setHeaderComp(prev => ({ ...prev, address: e.target.value }))}
                                  />
                                </div>
                                <div>
                                  <label className="block text-[11px] font-semibold text-slate-600 mb-1.5">Latitude <span className="text-red-500">*</span></label>
                                  <input
                                    type="number" step="any"
                                    className="w-full px-3 py-2 text-xs border border-surface-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all placeholder-slate-400"
                                    placeholder="19.0760"
                                    value={headerComp?.lat || ''}
                                    onChange={e => setHeaderComp(prev => ({ ...prev, lat: e.target.value }))}
                                  />
                                </div>
                                <div>
                                  <label className="block text-[11px] font-semibold text-slate-600 mb-1.5">Longitude <span className="text-red-500">*</span></label>
                                  <input
                                    type="number" step="any"
                                    className="w-full px-3 py-2 text-xs border border-surface-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all placeholder-slate-400"
                                    placeholder="72.8777"
                                    value={headerComp?.lng || ''}
                                    onChange={e => setHeaderComp(prev => ({ ...prev, lng: e.target.value }))}
                                  />
                                </div>
                              </div>
                            </div>
                          )}

                          {/* TEXT header — show text (with param mapping rows if has {{n}}) */}
                          {ht === 'TEXT' && (
                            <div>
                              <div className="px-3 py-2.5 rounded-lg bg-slate-100 mb-3">
                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Header text</p>
                                <p className="text-xs text-slate-700 font-medium leading-relaxed">
                                  {(selTpl.headerText || '').split(/(\{\{\d+\}\})/g).map((part, i) => {
                                    const match = part.match(/\{\{(\d+)\}\}/)
                                    return match
                                      ? <span key={i} className="inline-flex px-1.5 py-0.5 rounded bg-slate-600 text-white font-bold text-[10px] mx-0.5">{`{{${match[1]}}}`}</span>
                                      : part
                                  })}
                                </p>
                              </div>
                              {headerParamKeys.length > 0 ? (
                                <div className="space-y-3">
                                  {headerParamKeys.map(p => {
                                    const m = headerComp?.params?.[p] || { type: 'static', value: '' }
                                    return (
                                      <div key={p} className="rounded-lg border border-surface-border p-3">
                                        <div className="flex items-center gap-2 mb-2.5">
                                          <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-slate-200 text-slate-600 text-[9px] font-bold flex-shrink-0">{p}</span>
                                          <p className="text-[11px] font-bold text-slate-700">Header param <code className="text-slate-500">{`{{${p}}}`}</code></p>
                                        </div>
                                        <input
                                          className="w-full px-3 py-2 text-xs border border-surface-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all placeholder-slate-400"
                                          placeholder="Static value for all recipients"
                                          value={m.value}
                                          onChange={e => setHeaderComp(prev => ({ ...prev, params: { ...prev.params, [p]: { type: 'static', value: e.target.value } } }))}
                                        />
                                      </div>
                                    )
                                  })}
                                </div>
                              ) : (
                                <p className="text-[10px] text-slate-400">No variables in this header — it's sent as-is.</p>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    )
                  })()}

                  {/* ── BODY COMPONENT ── */}
                  {tplParams.length > 0 && (
                    <div className="rounded-xl border border-surface-border overflow-hidden">
                      <div className="flex items-center justify-between px-4 py-3 bg-slate-50 border-b border-surface-border">
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Body</span>
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200">
                            {tplParams.length} variable{tplParams.length > 1 ? 's' : ''}
                          </span>
                        </div>
                        <p className="text-[10px] text-slate-400">
                          {mode === 'csv' ? 'Map to CSV columns' : 'Text · Currency · Date/Time · Contact fields'}
                        </p>
                      </div>

                      {/* Body text with highlighted params */}
                      <div className="px-4 pt-3 pb-1">
                        <p className="text-xs text-slate-500 leading-relaxed bg-slate-50 rounded-lg px-3 py-2.5">
                          {(selTpl.body || '').split(/(\{\{\d+\}\})/g).map((part, i) => {
                            const match = part.match(/\{\{(\d+)\}\}/)
                            return match
                              ? <span key={i} className="inline-flex px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 font-bold text-[10px] mx-0.5">{`{{${match[1]}}}`}</span>
                              : part
                          })}
                        </p>
                      </div>

                      {/* Param mapping rows */}
                      <div className="p-4 space-y-3">
                        {tplParams.map(p => {
                          const pType = selTpl.bodyParamTypes?.[p] || 'text'
                          const mapping = varMappings[p] || (
                            pType === 'currency' ? { type: 'currency', code: 'INR', amount: '' } :
                            pType === 'datetime' ? { type: 'datetime', value: '' } :
                            { type: 'field', value: '' }
                          )
                          const PARAM_TYPE_BADGE = {
                            text:     { label: 'Text',     color: 'bg-amber-50 text-amber-700 border-amber-200'    },
                            currency: { label: 'Currency', color: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
                            datetime: { label: 'Date/Time',color: 'bg-blue-50 text-blue-700 border-blue-200'       },
                          }
                          const pBadge = PARAM_TYPE_BADGE[pType] || PARAM_TYPE_BADGE.text
                          return (
                            <div key={p} className="rounded-lg border border-surface-border p-3">
                              {/* Row header */}
                              <div className="flex items-center gap-2 mb-2.5">
                                <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-amber-100 text-amber-700 text-[9px] font-bold flex-shrink-0">{p}</span>
                                <code className="text-[11px] font-bold text-amber-600">{`{{${p}}}`}</code>
                                <span className={clsx('text-[9px] font-bold px-1.5 py-0.5 rounded-full border', pBadge.color)}>{pBadge.label}</span>
                                {/* Type selector (only for text params) */}
                                {pType === 'text' && (
                                  <div className="ml-auto">
                                    <NativeSelect
                                      value={mapping.type}
                                      onChange={e => setMapping(p, e.target.value, '')}
                                      sm
                                      className="text-[10px]">
                                      {mode !== 'csv' && <option value="field">Contact Field</option>}
                                      {mode !== 'csv' && <option value="static">Static Text</option>}
                                      {mode === 'csv'  && <option value="csv">CSV Column</option>}
                                      {mode === 'csv'  && <option value="static">Static Text</option>}
                                    </NativeSelect>
                                  </div>
                                )}
                              </div>

                              {/* CONTACT FIELD */}
                              {mapping.type === 'field' && (
                                <div className="flex items-center gap-2">
                                  <NativeSelect value={mapping.value} onChange={e => setMapping(p, 'field', e.target.value)} sm className="flex-1">
                                    <option value="">— Select contact field —</option>
                                    {CONTACT_FIELDS.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
                                  </NativeSelect>
                                  {mapping.value && (
                                    <div className="text-[10px] text-emerald-600 font-semibold flex items-center gap-1 flex-shrink-0">
                                      <CheckCircle2 size={11} />
                                      {mapping.value.startsWith('customAttr:')
                                        ? `"[${mapping.value.replace('customAttr:', '')}]"`
                                        : `"${SAMPLE_CONTACT[mapping.value]}"`}
                                    </div>
                                  )}
                                </div>
                              )}

                              {/* CSV COLUMN */}
                              {mapping.type === 'csv' && (
                                <div className="flex items-center gap-2">
                                  <NativeSelect value={mapping.value} onChange={e => setMapping(p, 'csv', e.target.value)} sm className="flex-1">
                                    <option value="">— Select CSV column —</option>
                                    {(csvColumns.length > 0 ? csvColumns : ['name','phone','order_id','date','amount','product']).map(col => <option key={col} value={col}>{col}</option>)}
                                  </NativeSelect>
                                  {mapping.value && <div className="text-[10px] text-emerald-600 font-semibold flex items-center gap-1 flex-shrink-0"><CheckCircle2 size={11} /> col: {mapping.value}</div>}
                                </div>
                              )}

                              {/* STATIC TEXT */}
                              {mapping.type === 'static' && (
                                <div className="flex items-center gap-2">
                                  <input
                                    className="flex-1 px-3 py-2 text-xs border border-surface-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all placeholder-slate-400"
                                    placeholder="Static value for all recipients"
                                    value={mapping.value || ''}
                                    onChange={e => setMapping(p, 'static', e.target.value)}
                                  />
                                  {mapping.value && <div className="text-[10px] text-slate-400 flex-shrink-0">→ "{mapping.value}"</div>}
                                </div>
                              )}

                              {/* CURRENCY */}
                              {mapping.type === 'currency' && (
                                <div className="space-y-2">
                                  <div className="flex items-center gap-2">
                                    <NativeSelect
                                      value={mapping.code || 'INR'}
                                      onChange={e => setCurrencyField(p, 'code', e.target.value)}
                                      sm className="w-36 flex-shrink-0">
                                      {CURRENCY_OPTIONS.map(c => <option key={c.code} value={c.code}>{c.label}</option>)}
                                    </NativeSelect>
                                    <input
                                      type="number" step="0.01" min="0"
                                      className="flex-1 px-3 py-2 text-xs border border-surface-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all placeholder-slate-400"
                                      placeholder="Amount, e.g. 1499.00"
                                      value={mapping.amount || ''}
                                      onChange={e => setCurrencyField(p, 'amount', e.target.value)}
                                    />
                                    {mapping.code && mapping.amount && (
                                      <div className="text-[10px] text-emerald-600 font-semibold flex items-center gap-1 flex-shrink-0">
                                        <CheckCircle2 size={11} />
                                        {CURRENCY_OPTIONS.find(c => c.code === mapping.code)?.symbol || mapping.code}
                                        {parseFloat(mapping.amount).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                      </div>
                                    )}
                                  </div>
                                  <p className="text-[10px] text-slate-400">
                                    Sent as a <code className="bg-slate-100 px-1 rounded">currency</code> parameter per Meta API — displays formatted in the recipient's locale.
                                  </p>
                                </div>
                              )}

                              {/* DATE / TIME */}
                              {mapping.type === 'datetime' && (
                                <div className="space-y-2">
                                  <div className="flex items-center gap-2">
                                    <input
                                      type="datetime-local"
                                      className="flex-1 px-3 py-2 text-xs border border-surface-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                                      value={mapping.value || ''}
                                      onChange={e => setMapping(p, 'datetime', e.target.value)}
                                    />
                                    {mapping.value && (
                                      <div className="text-[10px] text-emerald-600 font-semibold flex items-center gap-1 flex-shrink-0">
                                        <CheckCircle2 size={11} />
                                        {new Date(mapping.value).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                                      </div>
                                    )}
                                  </div>
                                  <p className="text-[10px] text-slate-400">
                                    Sent as a <code className="bg-slate-100 px-1 rounded">date_time</code> parameter per Meta API — formatted per recipient's locale and timezone.
                                  </p>
                                </div>
                              )}
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )}

                  {/* ── BUTTONS COMPONENT ── */}
                  {btnsNeedInput.length > 0 && (
                    <div className="rounded-xl border border-surface-border overflow-hidden">
                      <div className="flex items-center justify-between px-4 py-3 bg-slate-50 border-b border-surface-border">
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Buttons</span>
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
                            {btnsNeedInput.length} button{btnsNeedInput.length > 1 ? 's' : ''}
                          </span>
                        </div>
                      </div>
                      <div className="p-4 space-y-3">
                        {btnsNeedInput.map(btn => {
                          const BTYPES = {
                            QUICK_REPLY: { label: 'Quick Reply', color: 'bg-teal-50 text-teal-700 border-teal-200' },
                            URL:         { label: 'URL',         color: 'bg-blue-50 text-blue-700 border-blue-200' },
                            COPY_CODE:   { label: 'Copy Code',   color: 'bg-orange-50 text-orange-700 border-orange-200' },
                          }
                          const bCfg = BTYPES[btn.type] || BTYPES.QUICK_REPLY
                          const comp = buttonComps[btn.index] || {}
                          const hasDynUrl = btn.type === 'URL' && btn.url?.includes('{{')
                          const staticUrlBase = hasDynUrl ? btn.url?.replace(/\{\{[^}]+\}\}/g, '') : btn.url

                          return (
                            <div key={btn.index} className="rounded-lg border border-surface-border p-3">
                              <div className="flex items-center gap-2 mb-3">
                                <span className="text-base leading-none">{btn.type === 'URL' ? '🔗' : btn.type === 'COPY_CODE' ? '📋' : '↩️'}</span>
                                <p className="text-[11px] font-bold text-slate-800 flex-1 truncate">"{btn.text}"</p>
                                <span className={clsx('text-[9px] font-bold px-1.5 py-0.5 rounded-full border flex-shrink-0', bCfg.color)}>
                                  {bCfg.label}
                                </span>
                              </div>

                              {/* URL with dynamic suffix */}
                              {hasDynUrl && (
                                <div>
                                  <label className="block text-[11px] font-semibold text-slate-600 mb-1.5">
                                    Dynamic URL suffix <span className="text-red-500">*</span>
                                  </label>
                                  <div className="flex items-center gap-1.5 rounded-lg border border-surface-border overflow-hidden bg-white">
                                    <span className="px-3 py-2 text-[10px] text-slate-400 bg-slate-50 border-r border-surface-border font-mono truncate max-w-[200px] flex-shrink-0">
                                      {staticUrlBase}
                                    </span>
                                    <input
                                      className="flex-1 px-3 py-2 text-xs focus:outline-none placeholder-slate-400"
                                      placeholder="e.g. order_id or custom value"
                                      value={comp.value || ''}
                                      onChange={e => setButtonComps(prev => ({ ...prev, [btn.index]: { ...prev[btn.index], value: e.target.value } }))}
                                    />
                                    {comp.value?.trim() && <CheckCircle2 size={13} className="text-emerald-500 flex-shrink-0 mr-3" />}
                                  </div>
                                  <p className="text-[10px] text-slate-400 mt-1">This suffix is appended to the button URL for each recipient.</p>
                                </div>
                              )}

                              {/* URL without dynamic suffix — info only */}
                              {btn.type === 'URL' && !hasDynUrl && (
                                <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-50 border border-surface-border">
                                  <ExternalLink size={11} className="text-slate-400 flex-shrink-0" />
                                  <span className="text-[10px] text-slate-500 font-mono truncate">{btn.url}</span>
                                  <span className="text-[9px] text-slate-400 ml-auto flex-shrink-0">Static URL</span>
                                </div>
                              )}

                              {/* QUICK_REPLY — optional payload */}
                              {btn.type === 'QUICK_REPLY' && (
                                <div>
                                  <label className="block text-[11px] font-semibold text-slate-600 mb-1.5">
                                    Payload <span className="text-slate-400 font-normal">(optional — sent to webhook when tapped)</span>
                                  </label>
                                  <input
                                    className="w-full px-3 py-2 text-xs border border-surface-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all placeholder-slate-400"
                                    placeholder={`e.g. ${btn.text.toLowerCase().replace(/\s+/g, '_')}`}
                                    value={comp.payload || ''}
                                    onChange={e => setButtonComps(prev => ({ ...prev, [btn.index]: { ...prev[btn.index], payload: e.target.value } }))}
                                  />
                                </div>
                              )}

                              {/* COPY_CODE — coupon code value */}
                              {btn.type === 'COPY_CODE' && (
                                <div>
                                  <label className="block text-[11px] font-semibold text-slate-600 mb-1.5">
                                    Coupon / Code value <span className="text-red-500">*</span>
                                  </label>
                                  <div className="flex items-center gap-2">
                                    <input
                                      className="flex-1 px-3 py-2 text-xs border border-surface-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all placeholder-slate-400 font-mono tracking-widest"
                                      placeholder="e.g. SAVE20"
                                      value={comp.code || ''}
                                      onChange={e => setButtonComps(prev => ({ ...prev, [btn.index]: { ...prev[btn.index], code: e.target.value.toUpperCase() } }))}
                                    />
                                    {comp.code?.trim() && <CheckCircle2 size={14} className="text-emerald-500 flex-shrink-0" />}
                                  </div>
                                  <p className="text-[10px] text-slate-400 mt-1">This code is displayed on the button and copied to clipboard when tapped.</p>
                                </div>
                              )}
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )}

                  {/* Custom attributes note */}
                  {tplParams.length > 0 && mode !== 'csv' && (
                    <div className="flex items-start gap-2.5 p-3.5 rounded-xl bg-violet-50 border border-violet-100">
                      <Info size={14} className="text-violet-500 flex-shrink-0 mt-0.5" />
                      <p className="text-xs text-violet-700 leading-relaxed">
                        Custom attributes (e.g. <code className="bg-violet-100 px-1 rounded font-mono">order_id</code>, <code className="bg-violet-100 px-1 rounded font-mono">plan</code>) imported with contacts are available under Contact Fields and prefixed with <code className="bg-violet-100 px-1 rounded font-mono">attr:</code>.
                      </p>
                    </div>
                  )}

                  {/* Live message preview */}
                  {variablesValid && (
                    <div className="rounded-xl border border-emerald-200 bg-emerald-50 overflow-hidden">
                      <div className="px-4 py-2.5 border-b border-emerald-200">
                        <p className="text-[10px] font-bold text-emerald-700 uppercase tracking-wider">Live preview — sample contact</p>
                      </div>
                      <div className="p-4 space-y-2">
                        {filledHeaderText && (
                          <p className="text-xs font-bold text-emerald-900">{filledHeaderText}</p>
                        )}
                        {selTpl.headerType && selTpl.headerType !== 'NONE' && selTpl.headerType !== 'TEXT' && (
                          <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-emerald-100 text-emerald-700 text-[10px] font-semibold">
                            <span>{selTpl.headerType === 'IMAGE' ? '🖼️ Image' : selTpl.headerType === 'VIDEO' ? '🎥 Video' : selTpl.headerType === 'DOCUMENT' ? '📄 Document' : '📍 Location'}</span>
                            {(headerComp?.link || headerComp?.name) && (
                              <span className="font-mono text-[9px] truncate opacity-75">{headerComp.link || headerComp.name}</span>
                            )}
                          </div>
                        )}
                        <p className="text-xs text-emerald-800 leading-relaxed font-medium">{filledBody}</p>
                        {btnsNeedInput.filter(b => b.type === 'URL' && b.url?.includes('{{') && buttonComps[b.index]?.value).map(b => (
                          <div key={b.index} className="text-[10px] font-mono text-emerald-600 truncate">
                            🔗 {b.url?.replace(/\{\{[^}]+\}\}/g, buttonComps[b.index]?.value || '')}
                          </div>
                        ))}
                        {btnsNeedInput.filter(b => b.type === 'COPY_CODE' && buttonComps[b.index]?.code).map(b => (
                          <div key={b.index} className="inline-flex items-center gap-1.5 text-[10px] font-bold text-emerald-700 bg-emerald-100 px-2.5 py-1 rounded-lg">
                            📋 Code: {buttonComps[b.index].code}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {/* STEP 3 — Schedule */}
          {step === 3 && (
            <div className="p-6 space-y-5">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Campaign Name <span className="text-red-500">*</span>
                </label>
                <input
                  className="w-full px-3.5 py-2.5 text-sm border border-surface-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all placeholder-slate-400"
                  placeholder="e.g. May Festival Offer 2025"
                  value={campName}
                  onChange={e => setCampName(e.target.value)}
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-2.5">When to send</label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {[
                    { k: true,  Icon: Zap,      label: 'Send Immediately',  desc: 'Launch as soon as you confirm' },
                    { k: false, Icon: Calendar, label: 'Schedule for Later', desc: 'Pick a specific date & time'  },
                  ].map(({ k, Icon, label, desc }) => (
                    <button key={String(k)} onClick={() => setSendNow(k)}
                      className={clsx(
                        'rounded-xl border p-4 cursor-pointer transition-all text-left',
                        sendNow === k
                          ? 'border-primary bg-primary/5 shadow-sm ring-1 ring-primary/20'
                          : 'border-surface-border hover:border-slate-300'
                      )}>
                      <div className="flex justify-between items-center mb-2.5">
                        <div className={clsx('w-8 h-8 rounded-lg flex items-center justify-center',
                          sendNow === k ? 'bg-primary/10' : 'bg-slate-100')}>
                          <Icon size={15} className={sendNow === k ? 'text-primary' : 'text-slate-400'} />
                        </div>
                        {sendNow === k && <CheckCircle2 size={15} className="text-primary" />}
                      </div>
                      <p className="text-xs font-bold text-slate-800">{label}</p>
                      <p className="text-[11px] text-slate-400 mt-0.5">{desc}</p>
                    </button>
                  ))}
                </div>
              </div>

              {!sendNow && (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1.5">Date</label>
                    <input type="date"
                      className="w-full px-3.5 py-2.5 text-sm border border-surface-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                      value={schedDate} onChange={e => setSchedDate(e.target.value)} />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1.5">Time</label>
                    <input type="time"
                      className="w-full px-3.5 py-2.5 text-sm border border-surface-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                      value={schedTime} onChange={e => setSchedTime(e.target.value)} />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1.5">Timezone</label>
                    <NativeSelect value={timezone} onChange={e => setTimezone(e.target.value)}>
                      <option value="Asia/Kolkata">Asia/Kolkata (IST)</option>
                      <option value="UTC">UTC</option>
                      <option value="America/New_York">America/New_York (ET)</option>
                      <option value="America/Los_Angeles">America/Los_Angeles (PT)</option>
                      <option value="Europe/London">Europe/London (GMT)</option>
                    </NativeSelect>
                  </div>
                </div>
              )}

              <div className="rounded-xl border border-surface-border bg-slate-50 p-4 space-y-2.5">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-3">Campaign Summary</p>
                {[
                  { label: 'Template',    value: selTpl?.name?.replace(/_/g, ' ') || '—' },
                  { label: 'Audience',    value: audience > 0 ? `${audience.toLocaleString()} contacts` : (csvFile ? 'CSV upload' : '—') },
                  { label: 'Variables',   value: tplParams.length === 0 ? 'None' : tplParams.map(p => {
                      const m = varMappings[p]
                      return `{{${p}}} → ${m?.type === 'static' ? `"${m.value}"` : m?.value || '—'}`
                    }).join(', ') },
                  { label: 'Sending',     value: sendNow ? 'Immediately after launch' : (schedDate ? `${schedDate} at ${schedTime} (${timezone})` : 'Date not set') },
                  { label: 'Est. Cost',   value: audience > 0 ? `₹${Math.ceil(audience * 0.05).toLocaleString()}` : '—' },
                ].map(({ label, value }) => (
                  <div key={label} className="flex justify-between text-xs gap-4">
                    <span className="text-slate-500 flex-shrink-0">{label}</span>
                    <span className="font-semibold text-slate-800 text-right truncate">{value}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* STEP 4 — Review */}
          {step === 4 && (
            <div className="flex" style={{ minHeight: 380 }}>
              <div className="flex-1 p-6 space-y-4 border-r border-surface-border overflow-y-auto min-w-0">
                <div className="flex items-start gap-2.5 p-3.5 rounded-xl bg-blue-50 border border-blue-100">
                  <Info size={14} className="text-blue-500 flex-shrink-0 mt-0.5" />
                  <p className="text-xs text-blue-700 leading-relaxed">
                    Review all details carefully. Once launched, the campaign will be queued for delivery.
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {[
                    { icon: FileText, label: 'Template',  val: selTpl?.name?.replace(/_/g, ' ') || '—',  color: 'bg-violet-50', iconColor: 'text-violet-500' },
                    { icon: Users,    label: 'Audience',  val: audience > 0 ? `${audience.toLocaleString()} contacts` : (csvFile?.name || '—'), color: 'bg-blue-50', iconColor: 'text-blue-500' },
                    { icon: Clock,    label: 'Sends at',  val: sendNow ? 'Immediately' : (schedDate || 'Not set'), color: 'bg-amber-50',  iconColor: 'text-amber-500'  },
                    { icon: Zap,      label: 'Est. Cost', val: audience > 0 ? `₹${Math.ceil(audience * 0.05).toLocaleString()}` : '—', color: 'bg-emerald-50', iconColor: 'text-emerald-500' },
                  ].map(({ icon: Icon, label, val, color, iconColor }) => (
                    <div key={label} className="flex items-start gap-3 p-3.5 rounded-xl border border-surface-border bg-slate-50/50">
                      <div className={clsx('w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5', color)}>
                        <Icon size={14} className={iconColor} />
                      </div>
                      <div className="min-w-0">
                        <p className="text-[10px] text-slate-400 font-medium">{label}</p>
                        <p className="text-xs font-semibold text-slate-800 truncate mt-0.5">{val}</p>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Variable mapping summary */}
                {tplParams.length > 0 && (
                  <div className="rounded-xl border border-surface-border p-4">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-3">Variable Mappings</p>
                    <div className="space-y-2">
                      {tplParams.map(p => {
                        const m = varMappings[p] || {}
                        const desc = m.type === 'static'
                          ? `Static: "${m.value}"`
                          : m.type === 'csv'
                            ? `CSV column: "${m.value}"`
                            : `Contact field: ${CONTACT_FIELDS.find(f => f.value === m.value)?.label || m.value}`
                        return (
                          <div key={p} className="flex items-center gap-2 text-xs">
                            <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-amber-100 text-amber-700 text-[9px] font-bold flex-shrink-0">{p}</span>
                            <code className="text-amber-600 font-bold">{`{{${p}}}`}</code>
                            <span className="text-slate-400">→</span>
                            <span className="text-slate-700 font-medium">{desc}</span>
                          </div>
                        )
                      })}
                    </div>
                    {variablesValid && (
                      <div className="mt-3 pt-3 border-t border-surface-border">
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Sample message</p>
                        <p className="text-xs text-slate-600 leading-relaxed">{filledBody}</p>
                      </div>
                    )}
                  </div>
                )}

                <div className="flex items-start gap-2.5 p-3.5 rounded-xl bg-amber-50 border border-amber-200">
                  <AlertCircle size={14} className="text-amber-500 flex-shrink-0 mt-0.5" />
                  <p className="text-xs text-amber-800 leading-relaxed">
                    By launching, you confirm all recipients have opted in to receive WhatsApp marketing messages per Meta's Business Messaging Policy.
                  </p>
                </div>

                <div>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Campaign Name</p>
                  <p className="text-sm font-semibold text-slate-800">{campName}</p>
                </div>
              </div>

              {/* Phone preview with filled values */}
              <div className="w-52 flex-shrink-0 p-5 bg-slate-50 flex flex-col items-center">
                <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-4 w-full">Message Preview</p>
                <PhonePreview tpl={previewTpl} />
                {tplParams.length > 0 && (
                  <p className="text-[10px] text-slate-400 mt-3 text-center">Showing sample values for preview</p>
                )}
              </div>
            </div>
          )}

          {/* SUCCESS STATE */}
          {launched && (
            <div className="flex flex-col items-center justify-center py-16 px-6">
              <div className="w-14 h-14 rounded-full bg-emerald-100 flex items-center justify-center mb-4">
                <CheckCircle2 size={28} className="text-emerald-500" />
              </div>
              <h3 className="text-base font-bold text-slate-900 mb-1">Campaign Launched!</h3>
              <p className="text-sm text-slate-500 text-center">
                {campName} is now {sendNow ? 'sending' : 'scheduled'} to {audience > 0 ? `${audience.toLocaleString()} contacts` : 'your CSV list'}.
              </p>
            </div>
          )}
        </div>

        {/* ── Footer ── */}
        {!launched && (
          <div className="flex items-center justify-between px-6 py-4 border-t border-surface-border flex-shrink-0 bg-slate-50/50">
            <div className="text-xs text-slate-400">
              {(audience > 0 || csvFile) && (
                <span className="flex items-center gap-1.5 text-slate-500">
                  <Users size={12} className="flex-shrink-0" />
                  <span>
                    {audience > 0 ? `${audience.toLocaleString()} recipients` : csvFile?.name}
                  </span>
                </span>
              )}
            </div>
            <div className="flex items-center gap-2.5">
              <button onClick={onClose}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 border border-surface-border hover:bg-surface-hover transition-colors">
                Cancel
              </button>
              {step > 0 && (
                <button onClick={() => setStep(s => s - 1)}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 border border-surface-border hover:bg-surface-hover transition-colors">
                  <ChevronLeft size={13} /> Back
                </button>
              )}
              {step < WIZARD_STEPS.length - 1 ? (
                <button
                  onClick={() => setStep(s => s + 1)}
                  disabled={!canNext}
                  className={clsx('flex items-center gap-1.5 px-5 py-2 rounded-xl text-xs font-semibold transition-all',
                    canNext
                      ? 'bg-primary text-white hover:bg-primary-hover shadow-sm'
                      : 'bg-slate-100 text-slate-400 cursor-not-allowed'
                  )}>
                  Continue <ChevronRight size={13} />
                </button>
              ) : (
                <button
                  onClick={launch}
                  disabled={launching}
                  className={clsx('flex items-center gap-1.5 px-5 py-2 rounded-xl text-xs font-semibold transition-all',
                    launching
                      ? 'bg-primary/60 text-white cursor-not-allowed'
                      : sendNow
                        ? 'bg-primary text-white hover:bg-primary-hover shadow-sm'
                        : 'bg-emerald-600 text-white hover:bg-emerald-700 shadow-sm'
                  )}>
                  {launching
                    ? <><span className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" /> Launching…</>
                    : sendNow
                      ? <><Send size={13} /> Launch Campaign</>
                      : <><Calendar size={13} /> Schedule Campaign</>
                  }
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>,
    document.body
  )
}

/* ─────────────────────────── TEMPLATE DATA ─────────────────────────── */
const TPL_DEMO = [
  // ── Existing templates ────────────────────────────────────────────────
  { id: 1,  name: 'elets_leads1',              category: 'MARKETING', status: 'APPROVED', language: 'en',    headerType: 'NONE',     body: 'Hey {{1}}! What is your opinion on automating your sales and marketing?',                                                                buttons: ['Visit us'],                              delivered: 648, readRate: '59%', lastEdited: '20 Apr 2026' },
  { id: 2,  name: 'elogic_tech_sample',        category: 'MARKETING', status: 'APPROVED', language: 'en',    headerType: 'NONE',     body: 'Hello {{1}}. This is to inform you that a system update is scheduled.',                                                                buttons: [],                                        delivered: 0,   readRate: '0%', lastEdited: '20 Mar 2026' },
  { id: 3,  name: 'email_opens_re3',           category: 'MARKETING', status: 'APPROVED', language: 'en',    headerType: 'NONE',     body: 'The new academic year is about to begin. Register now for early access.',                                                               buttons: [],                                        delivered: 0,   readRate: '0%', lastEdited: '16 Mar 2026' },
  { id: 4,  name: 'deepaksample',              category: 'MARKETING', status: 'PENDING',  language: 'en',    headerType: 'NONE',     body: 'Deepak',                                                                                                                               buttons: [],                                        delivered: 0,   readRate: '—',  lastEdited: '13 Mar 2026' },
  { id: 5,  name: 'nisus_test',                category: 'MARKETING', status: 'APPROVED', language: 'en',    headerType: 'NONE',     body: 'Hi {{1}}. Welcome to SmartBot! Thanks for joining us.',                                                                                buttons: [],                                        delivered: 0,   readRate: '0%', lastEdited: '10 Mar 2026' },
  { id: 6,  name: 'template_click',            category: 'UTILITY',   status: 'APPROVED', language: 'en',    headerType: 'NONE',     body: 'We are testing the clicks and replies, please respond.',                                                                               buttons: [],                                        delivered: 0,   readRate: '0%', lastEdited: '9 Mar 2026'  },
  { id: 7,  name: 'lost_deals_2',              category: 'MARKETING', status: 'APPROVED', language: 'en',    headerType: 'NONE',     body: 'Just following up on our earlier message. Still interested?',                                                                          buttons: [],                                        delivered: 0,   readRate: '0%', lastEdited: '9 Mar 2026'  },
  { id: 8,  name: 'order_confirmation',        category: 'UTILITY',   status: 'REJECTED', language: 'en_US', headerType: 'NONE',     body: 'Hi {{1}}, your order #{{2}} is confirmed! Estimated delivery: {{3}}.',                                                                 buttons: ['Track Order'],                           delivered: 0,   readRate: '—',  lastEdited: '25 Feb 2026' },
  // ── New rich templates (all header/button/param types) ───────────────
  { id: 9,  name: 'exclusive_festival_offer',  category: 'MARKETING', status: 'APPROVED', language: 'en',    headerType: 'IMAGE',    body: 'Hi {{1}}, as a cherished member, we have a special festival surprise just for you! 🎁',                                                buttons: ['Know more', 'Visit us'],                 delivered: 1204, readRate: '71%', lastEdited: '12 May 2026' },
  { id: 10, name: 'spring_sale_final',         category: 'MARKETING', status: 'APPROVED', language: 'en',    headerType: 'IMAGE',    body: "Hi {{1}}, up to 40% off ends at midnight. Don't miss out!",                                                                            buttons: ['Shop Now'],                              delivered: 892,  readRate: '66%', lastEdited: '30 Apr 2026' },
  { id: 11, name: 'store_credits_reminder',    category: 'MARKETING', status: 'APPROVED', language: 'en',    headerType: 'TEXT',     body: 'Hi {{1}}, you have ₹{{2}} in store credits. Use them before {{3}}.',                                                                   buttons: ['Use Credits Now', 'View Balance'],       delivered: 430,  readRate: '54%', lastEdited: '5 May 2026'  },
  { id: 12, name: 'order_confirmation_v3',     category: 'UTILITY',   status: 'APPROVED', language: 'en',    headerType: 'TEXT',     body: 'Hi {{1}}, your order #{{2}} is confirmed and arrives by {{3}}.',                                                                       buttons: ['Track Order', 'Contact Support'],        delivered: 2310, readRate: '83%', lastEdited: '1 May 2026'  },
  { id: 13, name: 'payment_receipt',           category: 'UTILITY',   status: 'APPROVED', language: 'en',    headerType: 'DOCUMENT', body: 'Hi {{1}}, your payment of ₹{{2}} has been received. Receipt #{{3}} is attached.',                                                      buttons: ['Download Receipt', 'Copy Receipt No.'], delivered: 780,  readRate: '78%', lastEdited: '8 May 2026'  },
  { id: 14, name: 'store_pickup_location',     category: 'UTILITY',   status: 'APPROVED', language: 'en',    headerType: 'LOCATION', body: 'Hi {{1}}, your order is ready for pickup at our {{2}} store.',                                                                         buttons: ['Get Directions', 'Call Store'],          delivered: 312,  readRate: '61%', lastEdited: '10 May 2026' },
  { id: 15, name: 'video_tutorial_welcome',    category: 'UTILITY',   status: 'APPROVED', language: 'en',    headerType: 'VIDEO',    body: 'Hi {{1}}, your account is active! Watch the intro video to get started. Your free trial expires on {{2}}.',                             buttons: ['Watch Now', 'Skip'],                     delivered: 198,  readRate: '45%', lastEdited: '15 May 2026' },
  { id: 16, name: 'invoice_payment_due',       category: 'UTILITY',   status: 'APPROVED', language: 'en',    headerType: 'DOCUMENT', body: 'Hi {{1}}, invoice #{{2}} for {{3}} is due on {{4}}. Pay early to save {{5}}. Use the code below for an instant discount!',              buttons: ['Pay Now', 'Get Discount', 'Contact Billing'], delivered: 540, readRate: '70%', lastEdited: '17 May 2026' },
  { id: 17, name: 'appointment_confirmation',  category: 'UTILITY',   status: 'APPROVED', language: 'en',    headerType: 'TEXT',     body: 'Hi {{1}}, your appointment with {{2}} is confirmed for {{3}}. Consultation fee: {{4}}. Please arrive 10 min early.',                    buttons: ['Add to Calendar', 'Reschedule', 'Copy Ref No.'], delivered: 267, readRate: '88%', lastEdited: '18 May 2026' },
  { id: 18, name: 'order_invoice_full_summary',category: 'UTILITY',   status: 'APPROVED', language: 'en',    headerType: 'TEXT',     body: 'Hi {{2}}, here is your order summary:\n\nItems subtotal: {{3}}\nTax (18% GST): {{4}}\nGrand total: {{5}}\n\nEstimated delivery: {{6}}\nTracking ID: {{7}}', buttons: ['Track Order', 'Copy Order ID', 'Need Help?'], delivered: 91, readRate: '92%', lastEdited: '19 May 2026' },
]

const TPL_STATUS_CFG = {
  APPROVED: { bg: 'bg-emerald-50', text: 'text-emerald-700', ring: 'ring-emerald-200', dot: 'bg-emerald-500', label: 'Active'    },
  PENDING:  { bg: 'bg-amber-50',   text: 'text-amber-700',   ring: 'ring-amber-200',   dot: 'bg-amber-400',  label: 'In review' },
  REJECTED: { bg: 'bg-red-50',     text: 'text-red-700',     ring: 'ring-red-200',     dot: 'bg-red-500',    label: 'Rejected'  },
  DRAFT:    { bg: 'bg-slate-50',   text: 'text-slate-600',   ring: 'ring-slate-200',   dot: 'bg-slate-400',  label: 'Draft'     },
}

const TPL_CAT_CFG = {
  MARKETING:      { label: 'Marketing',      iconBg: 'bg-violet-50', iconColor: 'text-violet-500', tagBg: 'bg-violet-50',  tagColor: 'text-violet-600' },
  UTILITY:        { label: 'Utility',        iconBg: 'bg-blue-50',   iconColor: 'text-blue-500',   tagBg: 'bg-blue-50',    tagColor: 'text-blue-600'   },
  AUTHENTICATION: { label: 'Auth',           iconBg: 'bg-green-50',  iconColor: 'text-green-500',  tagBg: 'bg-green-50',   tagColor: 'text-green-600'  },
}

function TplStatusPill({ status }) {
  const cfg = TPL_STATUS_CFG[status] || TPL_STATUS_CFG.DRAFT
  return (
    <span className={clsx('inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold ring-1', cfg.bg, cfg.text, cfg.ring)}>
      <span className={clsx('w-1.5 h-1.5 rounded-full flex-shrink-0', cfg.dot)} />
      {cfg.label}
    </span>
  )
}

/* ─────────────────────────── TEMPLATES VIEW ─────────────────────────── */
function TemplatesView({ onCreate }) {
  const [templates, setTemplates]       = useState(TPL_DEMO)
  const [search, setSearch]             = useState('')
  const [catFilter, setCatFilter]       = useState('ALL')
  const [statusFilter, setStatusFilter] = useState('ALL')
  const [selected, setSelected]         = useState(new Set())

  const STATUS_FILTER_TABS = [
    { key: 'ALL',      label: 'All',       count: templates.length },
    { key: 'APPROVED', label: 'Active',    count: templates.filter(t => t.status === 'APPROVED').length },
    { key: 'PENDING',  label: 'In review', count: templates.filter(t => t.status === 'PENDING').length  },
    { key: 'REJECTED', label: 'Rejected',  count: templates.filter(t => t.status === 'REJECTED').length },
  ]

  const filtered = useMemo(() => {
    const q = search.toLowerCase()
    return templates.filter(t =>
      (!q || t.name.toLowerCase().includes(q) || t.body.toLowerCase().includes(q)) &&
      (catFilter === 'ALL' || t.category === catFilter) &&
      (statusFilter === 'ALL' || t.status === statusFilter)
    )
  }, [templates, search, catFilter, statusFilter])

  const allSelected = filtered.length > 0 && filtered.every(t => selected.has(t.id))
  function toggleAll() {
    setSelected(allSelected ? new Set() : new Set(filtered.map(t => t.id)))
  }

  return (
    <div className="space-y-5">
      {/* Table */}
      <div className="card p-0 overflow-hidden">
        {/* Header row: tabs + filters */}
        <div className="flex items-center justify-between px-5 py-2 border-b border-surface-border gap-3 flex-wrap min-h-[48px]">
          <div className="flex items-center gap-0.5 bg-slate-100 p-1 rounded-xl w-fit">
            {STATUS_FILTER_TABS.map(tab => (
              <button key={tab.key} onClick={() => setStatusFilter(tab.key)}
                className={clsx('flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-all whitespace-nowrap',
                  statusFilter === tab.key ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700')}>
                {tab.label}
                {tab.count > 0 && (
                  <span className={clsx('text-[10px] font-bold px-1.5 py-0.5 rounded-full',
                    statusFilter === tab.key ? 'bg-primary/10 text-primary' : 'bg-slate-200 text-slate-500')}>
                    {tab.count}
                  </span>
                )}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2 py-2">
            <NativeSelect value={catFilter} onChange={e => setCatFilter(e.target.value)} sm>
              <option value="ALL">All categories</option>
              <option value="MARKETING">📣 Marketing</option>
              <option value="UTILITY">🔔 Utility</option>
              <option value="AUTHENTICATION">🔐 Authentication</option>
            </NativeSelect>
            <div className="relative">
              <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                className="pl-8 pr-3 py-1.5 text-xs border border-surface-border rounded-lg w-48 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all placeholder-slate-400"
                placeholder="Search templates…"
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>
          </div>
        </div>

        {/* Bulk action bar */}
        {selected.size > 0 && (
          <div className="flex items-center gap-3 px-5 py-2.5 bg-primary/5 border-b border-surface-border">
            <span className="text-xs font-semibold text-primary">{selected.size} selected</span>
            <div className="w-px h-4 bg-primary/20" />
            <button
              className="flex items-center gap-1 text-xs text-red-600 font-medium hover:text-red-700 transition-colors"
              onClick={() => { setTemplates(ts => ts.filter(t => !selected.has(t.id))); setSelected(new Set()) }}>
              <Trash2 size={12} /> Delete selected
            </button>
            <button className="text-xs text-slate-400 ml-auto hover:text-slate-600 transition-colors"
              onClick={() => setSelected(new Set())}>Clear</button>
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-surface-border bg-slate-50/60">
                <th className="px-5 py-3 w-10">
                  <input type="checkbox" checked={allSelected} onChange={toggleAll} className="cursor-pointer accent-primary" />
                </th>
                <th className="px-5 py-3 text-left text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Template</th>
                <th className="px-4 py-3 text-left text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Category</th>
                <th className="px-4 py-3 text-left text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Language</th>
                <th className="px-4 py-3 text-left text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Status</th>
                <th className="px-4 py-3 text-left text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Delivered</th>
                <th className="px-4 py-3 text-left text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Read rate</th>
                <th className="px-4 py-3 text-left text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Last edited</th>
                <th className="px-5 py-3 text-right text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-border">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-16 text-center">
                    <div className="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto mb-3">
                      <FileText size={20} className="text-slate-300" />
                    </div>
                    <p className="text-xs font-semibold text-slate-500">No templates found</p>
                    <p className="text-xs text-slate-400 mt-1">Try adjusting your search or filter</p>
                  </td>
                </tr>
              ) : filtered.map(t => {
                const cat = TPL_CAT_CFG[t.category] || TPL_CAT_CFG.MARKETING
                return (
                  <tr key={t.id} className="hover:bg-slate-50/50 transition-colors group">
                    <td className="px-5 py-4 w-10" onClick={e => e.stopPropagation()}>
                      <input type="checkbox"
                        checked={selected.has(t.id)}
                        onChange={() => setSelected(s => { const n = new Set(s); n.has(t.id) ? n.delete(t.id) : n.add(t.id); return n })}
                        className="cursor-pointer accent-primary" />
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex items-start gap-3">
                        <div className={clsx('w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5', cat.iconBg)}>
                          <FileText size={13} className={cat.iconColor} />
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5 mb-0.5">
                            <p className="text-xs font-semibold text-slate-900 truncate max-w-[180px]">{t.name}</p>
                            {t.headerType && t.headerType !== 'NONE' && (() => {
                              const HDR = {
                                IMAGE:    { label: '🖼️ Image',    cls: 'bg-pink-50 text-pink-600'     },
                                VIDEO:    { label: '🎥 Video',    cls: 'bg-purple-50 text-purple-600'  },
                                DOCUMENT: { label: '📄 Doc',      cls: 'bg-blue-50 text-blue-600'      },
                                LOCATION: { label: '📍 Location', cls: 'bg-emerald-50 text-emerald-600' },
                                TEXT:     { label: '✏️ Text',     cls: 'bg-slate-100 text-slate-600'   },
                              }
                              const h = HDR[t.headerType]
                              return h ? (
                                <span className={clsx('text-[9px] font-bold px-1.5 py-0.5 rounded flex-shrink-0', h.cls)}>
                                  {h.label}
                                </span>
                              ) : null
                            })()}
                          </div>
                          <p className="text-xs text-slate-400 truncate max-w-[240px]">{t.body}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      <span className={clsx('text-[9px] font-bold px-1.5 py-0.5 rounded', cat.tagBg, cat.tagColor)}>
                        {cat.label}
                      </span>
                    </td>
                    <td className="px-4 py-4">
                      <span className="text-xs text-slate-500">{t.language === 'en' ? 'English' : t.language === 'hi' ? 'Hindi' : t.language === 'ar' ? 'Arabic' : t.language || '—'}</span>
                    </td>
                    <td className="px-4 py-4"><TplStatusPill status={t.status} /></td>
                    <td className="px-4 py-4">
                      <p className="text-xs font-semibold text-slate-800">{(t.delivered ?? 0).toLocaleString()}</p>
                    </td>
                    <td className="px-4 py-4">
                      <p className="text-xs text-slate-500">{t.readRate ?? '—'}</p>
                    </td>
                    <td className="px-4 py-4">
                      <p className="text-xs text-slate-400 whitespace-nowrap">{t.lastEdited || '—'}</p>
                    </td>
                    <td className="px-5 py-4 text-right">
                      <button onClick={onCreate}
                        className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary hover:bg-primary/5 px-3 py-1.5 rounded-lg transition-colors">
                        <Pencil size={12} /> Edit
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="flex items-center justify-between px-5 py-3 border-t border-surface-border bg-slate-50/40">
          <p className="text-xs text-slate-400">
            Showing <span className="font-semibold text-slate-600">{filtered.length}</span> of{' '}
            <span className="font-semibold text-slate-600">{templates.length}</span> templates
          </p>
          <div className="flex items-center gap-1">
            <button className="p-1.5 rounded-lg hover:bg-surface-hover text-slate-400 disabled:opacity-30 transition-colors" disabled>
              <ChevronLeft size={14} />
            </button>
            <button className="px-3 py-1 rounded-lg bg-primary text-white text-xs font-semibold">1</button>
            <button className="p-1.5 rounded-lg hover:bg-surface-hover text-slate-400 disabled:opacity-30 transition-colors" disabled>
              <ChevronRight size={14} />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

/* ─────────────────────── QUICK SEND MODAL ─────────────────────── */
function QuickSendModal({ onClose }) {
  const [step,       setStep]      = useState(1)
  const [tplId,      setTplId]     = useState(null)
  const [country,    setCountry]   = useState(COUNTRIES[0])   // default India
  const [countryQ,   setCountryQ]  = useState('')
  const [showCDrop,  setShowCDrop] = useState(false)
  const [phone,      setPhone]     = useState('')
  const [params,     setParams]    = useState({})
  const [sent,       setSent]      = useState(false)
  const [q,          setQ]         = useState('')

  const filteredCountries = COUNTRIES.filter(c =>
    c.name.toLowerCase().includes(countryQ.toLowerCase()) ||
    c.dial.includes(countryQ) ||
    c.code.toLowerCase().includes(countryQ.toLowerCase())
  )

  const fullPhone = phone.trim() ? `${country.dial} ${phone.trim()}` : ''

  const list = APPROVED_TEMPLATES.filter(t =>
    t.status === 'APPROVED' &&
    (t.name.toLowerCase().includes(q.toLowerCase()) ||
    (t.category||'').toLowerCase().includes(q.toLowerCase()))
  )
  const selTpl = APPROVED_TEMPLATES.find(t => t.id === tplId)
  const paramNums = extractParams(selTpl)

  const preview = useMemo(() => {
    if (!selTpl) return ''
    let body = selTpl.body || ''
    paramNums.forEach(n => {
      body = body.replace(new RegExp(`\\{\\{${n}\\}\\}`, 'g'), params[n] || `{{${n}}}`)
    })
    return body
  }, [selTpl, params, paramNums])

  function selectTpl(id) { setTplId(id); setParams({}) }
  function goNext() { if (tplId && phone.trim()) setStep(2) }
  function goBack() { setStep(1); setSent(false) }
  function send()   { setSent(true); setTimeout(onClose, 1400) }

  const canNext = tplId && phone.trim().length >= 5

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm"
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="bg-white w-full max-w-md rounded-2xl shadow-modal flex flex-col max-h-[88vh] overflow-hidden border border-surface-border">

        {/* Header */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-surface-border">
          <div className="w-7 h-7 rounded-lg bg-violet-50 border border-violet-100 flex items-center justify-center flex-shrink-0">
            <Send size={12} className="text-violet-600"/>
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <p className="text-[13px] font-bold text-slate-900">Quick Send</p>
              <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200">Test</span>
              <div className="flex items-center gap-1">
                {[1,2].map(i => (
                  <span key={i} className={clsx('px-1.5 py-0.5 rounded text-[9px] font-bold',
                    step === i ? 'bg-primary text-white' : 'bg-slate-100 text-slate-400')}>{i}</span>
                ))}
              </div>
            </div>
            <p className="text-[10px] text-slate-400 mt-0.5">
              {step === 1 ? 'Send a single template message for testing' : <>Sending to: <span className="font-semibold text-slate-600 font-mono">{fullPhone}</span></>}
            </p>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-surface-hover text-slate-400 transition-colors">
            <X size={14}/>
          </button>
        </div>

        {/* Step 1 — Pick template + phone */}
        {step === 1 && (
          <>
            {/* Phone input with country picker */}
            <div className="px-4 pt-3 pb-2.5 border-b border-surface-border">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Recipient Phone Number</p>
              <div className="flex gap-2 relative">
                {/* Country picker trigger */}
                <div className="relative">
                  <button
                    onClick={() => setShowCDrop(p => !p)}
                    className="flex items-center gap-1.5 h-full px-2.5 py-2 border border-surface-border rounded-lg bg-white hover:bg-surface-hover transition-colors text-[12px] whitespace-nowrap">
                    <span className="text-[16px] leading-none">{country.flag}</span>
                    <span className="font-mono text-slate-600 text-[11px]">{country.dial}</span>
                    <ChevronDown size={10} className={clsx('text-slate-400 transition-transform', showCDrop && 'rotate-180')}/>
                  </button>
                  {/* Country dropdown */}
                  {showCDrop && (
                    <div className="absolute top-full left-0 mt-1 w-64 bg-white border border-surface-border rounded-xl shadow-modal z-50 flex flex-col max-h-64 overflow-hidden">
                      {/* Search */}
                      <div className="px-2.5 py-2 border-b border-surface-border flex-shrink-0">
                        <div className="relative">
                          <Search size={10} className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"/>
                          <input
                            autoFocus
                            value={countryQ} onChange={e => setCountryQ(e.target.value)}
                            placeholder="Search country…"
                            className="w-full pl-6 pr-2 py-1 text-[11px] bg-slate-50 border border-surface-border rounded-lg focus:outline-none focus:border-primary/40 placeholder-slate-300"/>
                        </div>
                      </div>
                      {/* List */}
                      <div className="overflow-y-auto flex-1">
                        {filteredCountries.map(c => (
                          <button key={c.code}
                            onClick={() => { setCountry(c); setShowCDrop(false); setCountryQ('') }}
                            className={clsx('w-full flex items-center gap-2.5 px-3 py-1.5 text-left text-[11px] hover:bg-surface-hover transition-colors',
                              country.code === c.code && 'bg-primary-50 text-primary font-semibold')}>
                            <span className="text-[15px] leading-none flex-shrink-0">{c.flag}</span>
                            <span className="flex-1 truncate text-slate-700">{c.name}</span>
                            <span className="font-mono text-slate-400 flex-shrink-0">{c.dial}</span>
                          </button>
                        ))}
                        {!filteredCountries.length && (
                          <p className="text-center text-[11px] text-slate-400 py-4">No countries found</p>
                        )}
                      </div>
                    </div>
                  )}
                </div>
                {/* Number input */}
                <input
                  value={phone} onChange={e => setPhone(e.target.value.replace(/[^\d\s\-]/g,''))}
                  onClick={() => setShowCDrop(false)}
                  placeholder="98765 43210"
                  className="flex-1 text-[12px] border border-surface-border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary/15 focus:border-primary/40 placeholder-slate-300 font-mono"/>
              </div>
              {fullPhone && (
                <p className="text-[10px] text-slate-400 mt-1.5 font-mono">Full number: <span className="text-slate-600 font-semibold">{fullPhone}</span></p>
              )}
            </div>

            {/* Template search */}
            <div className="px-3 py-2 border-b border-surface-border">
              <div className="relative">
                <Search size={11} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"/>
                <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search templates…"
                  className="w-full pl-7 pr-3 py-1.5 text-[11px] rounded-lg bg-surface-hover border border-surface-border focus:outline-none focus:ring-2 focus:ring-primary/15 focus:border-primary/40 focus:bg-white transition-all placeholder-slate-400"/>
              </div>
            </div>

            {/* Template list */}
            <div className="flex-1 overflow-y-auto p-3 space-y-1.5">
              {list.map(t => {
                const on = tplId === t.id
                return (
                  <button key={t.id} onClick={() => selectTpl(t.id)}
                    className={clsx('w-full text-left p-3 rounded-xl border transition-all',
                      on ? 'border-primary/30 bg-primary-50/50' : 'border-surface-border hover:border-slate-300 hover:bg-surface-hover')}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[12px] font-semibold text-slate-800">{t.name}</span>
                      <div className="flex items-center gap-1.5">
                        <span className={clsx('text-[9px] font-bold px-1.5 py-0.5 rounded-full',
                          t.category === 'MARKETING' ? 'bg-amber-50 text-amber-700 border border-amber-200' : 'bg-sky-50 text-sky-700 border border-sky-200')}>
                          {t.category}
                        </span>
                        {on && <Check size={11} className="text-primary"/>}
                      </div>
                    </div>
                    <p className="text-[11px] text-slate-500 leading-relaxed line-clamp-2">{t.body}</p>
                  </button>
                )
              })}
              {!list.length && <p className="text-center text-[11px] text-slate-400 py-8">No templates found</p>}
            </div>

            <div className="flex items-center justify-between px-4 py-2.5 border-t border-surface-border">
              <button onClick={onClose} className="text-[11px] text-slate-400 hover:text-slate-600 transition-colors">Cancel</button>
              <button onClick={goNext} disabled={!canNext}
                className={clsx('flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-semibold transition-all',
                  canNext ? 'bg-primary text-white hover:bg-primary/90' : 'bg-slate-100 text-slate-400 cursor-not-allowed')}>
                Next <ChevronDown size={11} className="-rotate-90"/>
              </button>
            </div>
          </>
        )}

        {/* Step 2 — Fill variables + preview */}
        {step === 2 && (
          <>
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {paramNums.length > 0 && (
                <div>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2.5">Fill Template Variables</p>
                  <div className="space-y-2">
                    {paramNums.map(n => (
                      <div key={n} className="flex items-center gap-2.5">
                        <span className="text-[11px] text-slate-500 font-mono w-9 flex-shrink-0 text-center bg-slate-50 border border-surface-border rounded px-1 py-0.5">
                          {'{{'}{n}{'}}'}
                        </span>
                        <input
                          autoFocus={n === '1'}
                          value={params[n] || ''}
                          onChange={e => setParams(p => ({...p, [n]: e.target.value}))}
                          placeholder={`Value for variable ${n}…`}
                          className="flex-1 text-[11px] border border-surface-border rounded-lg px-2.5 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-primary/10 focus:border-primary/40 placeholder-slate-300"/>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Message preview */}
              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Message Preview</p>
                <div className="bg-[#dcf8c6] rounded-xl px-3 py-2.5 text-[11px] text-slate-800 leading-relaxed whitespace-pre-wrap shadow-sm">
                  {preview || selTpl?.body}
                </div>
              </div>

              {/* Recipient pill */}
              <div className="flex items-center gap-2.5 bg-slate-50 border border-surface-border rounded-xl px-3 py-2.5">
                <span className="text-[20px] leading-none flex-shrink-0">{country.flag}</span>
                <div>
                  <p className="text-[10px] text-slate-400">Sending to · {country.name}</p>
                  <p className="text-[12px] font-semibold text-slate-700 font-mono">{fullPhone}</p>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between px-4 py-2.5 border-t border-surface-border">
              <button onClick={goBack} className="flex items-center gap-1 text-[11px] text-slate-400 hover:text-slate-600 transition-colors">
                <ChevronDown size={11} className="rotate-90"/> Back
              </button>
              <button onClick={send}
                className={clsx('flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-semibold transition-all',
                  sent ? 'bg-emerald-500 text-white' : 'bg-primary text-white hover:bg-primary/90')}>
                {sent ? <><CheckCircle2 size={11}/>Sent!</> : <><Send size={11}/>Send Test</>}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

/* ─────────────────────────── TEMPLATE LOGS ─────────────────────────── */
const LOG_STATUSES = {
  sent:      { label: 'Sent',      color: 'bg-slate-100 text-slate-600',     dot: 'bg-slate-400',   Icon: Clock        },
  delivered: { label: 'Delivered', color: 'bg-blue-50 text-blue-600',        dot: 'bg-blue-400',    Icon: CheckCircle2 },
  read:      { label: 'Read',      color: 'bg-emerald-50 text-emerald-600',  dot: 'bg-emerald-400', Icon: MailOpen     },
  failed:    { label: 'Failed',    color: 'bg-red-50 text-red-600',          dot: 'bg-red-400',     Icon: AlertCircle  },
}

const TEMPLATE_LOGS = [
  { id:'l1',  phone:'917904677560', tpl:'thanks_signup',      wamid:'wamid.HBgMOTE3OTA0Njc3NTYwFQIAERgSNDQ==', status:'delivered', waResp:'Success',  sentAt:'2026-05-18 16:54:05' },
  { id:'l2',  phone:'918850856230', tpl:'on_reminder_demo',   wamid:'wamid.HBgMOTE4ODUwODU2MjMwFQIAERgSQ===',  status:'read',      waResp:'Success',  sentAt:'2026-05-18 16:26:03' },
  { id:'l3',  phone:'918525813141', tpl:'otp_whatsapp_final', wamid:'wamid.HBgMOTE4NTI1ODEzMTQxFQIAERgSQkQ=',  status:'read',      waResp:'Success',  sentAt:'2026-05-18 16:12:42' },
  { id:'l4',  phone:'918525813141', tpl:'otp_whatsapp_final', wamid:'wamid.HBgMOTE4NTI1ODEzMTQxFQIAERgSMDJ=',  status:'read',      waResp:'Success',  sentAt:'2026-05-18 16:12:10' },
  { id:'l5',  phone:'919059006980', tpl:'leads_new',          wamid:'wamid.HBgMOTE5MDU5MDA2OTgwFQIAERgSO===',  status:'read',      waResp:'Success',  sentAt:'2026-05-18 15:52:16' },
  { id:'l6',  phone:'917768008863', tpl:'demo_conf_2025',     wamid:'wamid.HBgMOTE3NzY4MDA4ODYzFQIAERgSRjJ=',  status:'read',      waResp:'Success',  sentAt:'2026-05-18 15:50:55' },
  { id:'l7',  phone:'919292902222', tpl:'on_reminder_demo',   wamid:'wamid.HBgMOTE5MjkyOTAyMjIyFQIAERgSMTBF=', status:'sent',      waResp:'Success',  sentAt:'2026-05-18 15:26:04' },
  { id:'l8',  phone:'919823440123', tpl:'thanks_signup',      wamid:'wamid.HBgMOTE5ODIzNDQwMTIzFQIAERgSNQ==',  status:'delivered', waResp:'Success',  sentAt:'2026-05-18 14:55:18' },
  { id:'l9',  phone:'917654321098', tpl:'payment_reminder',   wamid:'wamid.HBgMOTE3NjU0MzIxMDk4FQIAERgSMw==',  status:'failed',    waResp:'Unknown',  sentAt:'2026-05-18 14:30:44' },
  { id:'l10', phone:'918899001122', tpl:'flash_sale_alert',   wamid:'wamid.HBgMOTE4ODk5MDAxMTIyFQIAERgSNA==',  status:'read',      waResp:'Success',  sentAt:'2026-05-18 14:10:22' },
  { id:'l11', phone:'917711223344', tpl:'otp_whatsapp_final', wamid:'wamid.HBgMOTE3NzExMjIzMzQ0FQIAERgSOQ==',  status:'delivered', waResp:'Success',  sentAt:'2026-05-18 13:48:09' },
  { id:'l12', phone:'919988776655', tpl:'leads_new',          wamid:'wamid.HBgMOTE5OTg4Nzc2NjU1FQIAERgSMQ==',  status:'read',      waResp:'Success',  sentAt:'2026-05-18 13:22:57' },
  { id:'l13', phone:'918822334455', tpl:'demo_conf_2025',     wamid:'wamid.HBgMOTE4ODIyMzM0NDU1FQIAERgSOA==',  status:'failed',    waResp:'Unknown',  sentAt:'2026-05-18 12:58:31' },
  { id:'l14', phone:'916677889900', tpl:'flash_sale_alert',   wamid:'wamid.HBgMOTE2Njc3ODg5OTAwFQIAERgSNg==',  status:'read',      waResp:'Success',  sentAt:'2026-05-18 12:34:15' },
  { id:'l15', phone:'917890123456', tpl:'thanks_signup',      wamid:'wamid.HBgMOTE3ODkwMTIzNDU2FQIAERgSNw==',  status:'sent',      waResp:'Success',  sentAt:'2026-05-18 12:11:02' },
  { id:'l16', phone:'919001234567', tpl:'payment_reminder',   wamid:'wamid.HBgMOTE5MDAxMjM0NTY3FQIAERgSMg==',  status:'delivered', waResp:'Success',  sentAt:'2026-05-17 17:42:38' },
  { id:'l17', phone:'918112233445', tpl:'on_reminder_demo',   wamid:'wamid.HBgMOTE4MTEyMjMzNDQ1FQIAERgSOg==',  status:'read',      waResp:'Success',  sentAt:'2026-05-17 16:15:50' },
  { id:'l18', phone:'917223344556', tpl:'otp_whatsapp_final', wamid:'wamid.HBgMOTE3MjIzMzQ0NTU2FQIAERgSPA==',  status:'read',      waResp:'Success',  sentAt:'2026-05-17 14:08:27' },
  { id:'l19', phone:'916334455667', tpl:'flash_sale_alert',   wamid:'wamid.HBgMOTE2MzM0NDU1NjY3FQIAERgSPQ==',  status:'failed',    waResp:'Unknown',  sentAt:'2026-05-17 11:55:19' },
  { id:'l20', phone:'915445566778', tpl:'leads_new',          wamid:'wamid.HBgMOTE1NDQ1NTY2Nzc4FQIAERgSOw==',  status:'delivered', waResp:'Success',  sentAt:'2026-05-17 10:30:04' },
]

const LOG_TPLS = [...new Set(TEMPLATE_LOGS.map(l => l.tpl))]
const PAGE_SIZE = 10

function TemplateLogs() {
  const [search,    setSearch]    = useState('')
  const [statusFil, setStatusFil] = useState('all')
  const [tplFil,    setTplFil]    = useState('all')
  const [page,      setPage]      = useState(1)
  const [copiedId,  setCopied]    = useState(null)

  const filtered = useMemo(() => {
    return TEMPLATE_LOGS.filter(l => {
      if (statusFil !== 'all' && l.status !== statusFil) return false
      if (tplFil    !== 'all' && l.tpl    !== tplFil)    return false
      if (search) {
        const q = search.toLowerCase()
        if (!l.phone.includes(q) && !l.tpl.toLowerCase().includes(q) && !l.wamid.toLowerCase().includes(q)) return false
      }
      return true
    })
  }, [search, statusFil, tplFil])

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const paginated  = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  // reset page when filters change
  useEffect(() => setPage(1), [search, statusFil, tplFil])

  const counts = useMemo(() => ({
    total:     TEMPLATE_LOGS.length,
    delivered: TEMPLATE_LOGS.filter(l => l.status === 'delivered').length,
    read:      TEMPLATE_LOGS.filter(l => l.status === 'read').length,
    failed:    TEMPLATE_LOGS.filter(l => l.status === 'failed').length,
  }), [])

  function copyWamid(id, wamid) {
    navigator.clipboard?.writeText(wamid)
    setCopied(id)
    setTimeout(() => setCopied(null), 1500)
  }

  const STATUS_OPTS = [
    { key: 'all',       label: 'All statuses' },
    { key: 'sent',      label: 'Sent'          },
    { key: 'delivered', label: 'Delivered'     },
    { key: 'read',      label: 'Read'          },
    { key: 'failed',    label: 'Failed'        },
  ]

  return (
    <div className="space-y-4 animate-fade-in">

      {/* ── Stats strip ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Total Sent',  value: counts.total,     Icon: Send,         color: 'text-slate-500', bg: 'bg-slate-50'    },
          { label: 'Delivered',   value: counts.delivered, Icon: CheckCircle2, color: 'text-blue-500',  bg: 'bg-blue-50'     },
          { label: 'Read',        value: counts.read,      Icon: MailOpen,     color: 'text-emerald-500', bg: 'bg-emerald-50' },
          { label: 'Failed',      value: counts.failed,    Icon: AlertCircle,  color: 'text-red-400',   bg: 'bg-red-50'      },
        ].map(({ label, value, Icon, color, bg }) => (
          <div key={label} className="card p-4 flex items-center gap-3">
            <div className={clsx('w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0', bg)}>
              <Icon size={15} className={color}/>
            </div>
            <div>
              <p className="text-[18px] font-bold text-slate-900 leading-tight">{value}</p>
              <p className="text-[10px] text-slate-400 font-medium">{label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* ── Table card ── */}
      <div className="card p-0 overflow-hidden">

        {/* Toolbar */}
        <div className="flex items-center gap-3 px-5 py-3 border-b border-surface-border">
          <div className="relative flex-1 max-w-xs">
            <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"/>
            <input value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Search phone, template or message ID…"
              className="w-full pl-7 pr-3 py-1.5 text-[11px] bg-slate-50 border border-surface-border rounded-lg focus:outline-none focus:border-primary/40 focus:bg-white transition-all placeholder-slate-400"/>
            {search && <button onClick={() => setSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"><X size={10}/></button>}
          </div>

          <div className="flex items-center gap-2">
            <NativeSelect value={tplFil} onChange={e => setTplFil(e.target.value)} sm>
              <option value="all">All templates</option>
              {LOG_TPLS.map(t => <option key={t} value={t}>{t}</option>)}
            </NativeSelect>
            <NativeSelect value={statusFil} onChange={e => setStatusFil(e.target.value)} sm>
              {STATUS_OPTS.map(o => <option key={o.key} value={o.key}>{o.label}</option>)}
            </NativeSelect>
          </div>

          <span className="ml-auto text-[10px] text-slate-400 flex-shrink-0">{filtered.length} log{filtered.length !== 1 ? 's' : ''}</span>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-surface-border bg-slate-50/60">
                {['Receiver', 'Template', 'Message ID', 'Status', 'Response', 'Sent At'].map(h => (
                  <th key={h} className="px-5 py-2.5 text-left text-[10px] font-bold text-slate-400 uppercase tracking-wider whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-border">
              {paginated.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-16 text-center">
                    <History size={28} className="text-slate-200 mx-auto mb-3"/>
                    <p className="text-[13px] font-semibold text-slate-400">No logs found</p>
                    <p className="text-[11px] text-slate-300 mt-1">Try adjusting your filters</p>
                  </td>
                </tr>
              ) : paginated.map(log => {
                const st = LOG_STATUSES[log.status]
                return (
                  <tr key={log.id} className="hover:bg-slate-50/60 transition-colors group">

                    {/* Receiver */}
                    <td className="px-5 py-3 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-full bg-slate-100 flex items-center justify-center flex-shrink-0">
                          <Phone size={11} className="text-slate-400"/>
                        </div>
                        <span className="text-[12px] font-semibold text-slate-700 tabular-nums">{log.phone}</span>
                      </div>
                    </td>

                    {/* Template */}
                    <td className="px-5 py-3">
                      <span className="text-[11px] font-medium text-primary bg-primary/5 px-2 py-0.5 rounded-md">{log.tpl}</span>
                    </td>

                    {/* Message ID */}
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-1.5 max-w-[200px]">
                        <span className="text-[11px] text-slate-500 font-mono truncate">{log.wamid.substring(0, 28)}…</span>
                        <button onClick={() => copyWamid(log.id, log.wamid)}
                          className="opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0 p-0.5 rounded hover:bg-slate-100 text-slate-400 hover:text-slate-600">
                          {copiedId === log.id ? <Check size={10} className="text-emerald-500"/> : <Copy size={10}/>}
                        </button>
                      </div>
                    </td>

                    {/* Status */}
                    <td className="px-5 py-3 whitespace-nowrap">
                      <span className={clsx('inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-semibold', st.color)}>
                        <span className={clsx('w-1.5 h-1.5 rounded-full', st.dot)}/>
                        {st.label}
                      </span>
                    </td>

                    {/* WhatsApp Response */}
                    <td className="px-5 py-3">
                      <span className={clsx('text-[11px] font-medium',
                        log.waResp === 'Success' ? 'text-emerald-600' : 'text-red-500')}>
                        {log.waResp}
                      </span>
                    </td>

                    {/* Sent At */}
                    <td className="px-5 py-3 whitespace-nowrap">
                      <span className="text-[11px] text-slate-500 tabular-nums">{log.sentAt}</span>
                    </td>

                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-5 py-3 border-t border-surface-border bg-slate-50/40">
            <span className="text-[11px] text-slate-400">
              Page {page} of {totalPages} · {filtered.length} results
            </span>
            <div className="flex items-center gap-1.5">
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                className="p-1.5 rounded-lg border border-surface-border bg-white text-slate-500 hover:bg-surface-hover disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
                <ChevronLeft size={13}/>
              </button>
              {Array.from({ length: totalPages }, (_, i) => i + 1).map(p => (
                <button key={p} onClick={() => setPage(p)}
                  className={clsx('w-7 h-7 rounded-lg text-[11px] font-semibold transition-colors',
                    p === page ? 'bg-primary text-white' : 'border border-surface-border bg-white text-slate-600 hover:bg-surface-hover')}>
                  {p}
                </button>
              ))}
              <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
                className="p-1.5 rounded-lg border border-surface-border bg-white text-slate-500 hover:bg-surface-hover disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
                <ChevronRight size={13}/>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

/* ─────────────────────────── MAIN PAGE ─────────────────────────── */
export default function Broadcasting() {
  const [campaigns,      setCampaigns]      = useState(CAMPAIGNS)
  const [mainView,       setMainView]       = useState('campaigns')  // 'campaigns' | 'templates'
  const [view,           setView]           = useState('list')        // 'list' | 'insights'
  const [activeCampaign, setActiveCampaign] = useState(null)
  const [showWizard,     setShowWizard]     = useState(false)
  const [showQuickSend,  setShowQuickSend]  = useState(false)
  const [search,         setSearch]         = useState('')
  const [activeTab,      setActiveTab]      = useState('All')
  const [dateRange,      setDateRange]      = useState('Last 30 days')

  const totals = campaigns.reduce((a, c) => ({
    sent:       a.sent       + c.successful + c.failed,
    delivered:  a.delivered  + c.successful,
    read:       a.read       + c.read,
    replied:    a.replied    + c.replied,
    sending:    a.sending    + c.sending,
    failed:     a.failed     + c.failed,
    processing: a.processing + (c.status === 'Sending'   ? 1 : 0),
    queued:     a.queued     + (c.status === 'Scheduled' ? 1 : 0),
  }), { sent: 0, delivered: 0, read: 0, replied: 0, sending: 0, failed: 0, processing: 0, queued: 0 })

  const tabCounts = STATUS_TABS.reduce((acc, t) => {
    acc[t] = t === 'All' ? campaigns.length : campaigns.filter(c => c.status === t).length
    return acc
  }, {})

  const filtered = campaigns.filter(c => {
    const matchSearch = c.name.toLowerCase().includes(search.toLowerCase())
    const matchTab    = activeTab === 'All' || c.status === activeTab
    return matchSearch && matchTab
  })

  // Full-screen template builder
  if (mainView === 'template-builder') {
    return <TemplateBuilder onBack={() => setMainView('templates')} />
  }

  // Campaign insights view
  if (view === 'insights' && activeCampaign) {
    return (
      <div className="animate-fade-in">
        <CampaignInsights campaign={activeCampaign} onBack={() => setView('list')} />
      </div>
    )
  }

  return (
    <div className="space-y-5 animate-fade-in">

      {/* ── Header ── */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 mb-0.5">
            <h1 className="text-[15px] font-bold text-slate-900">
              {mainView === 'templates' ? 'Message Templates' : mainView === 'logs' ? 'Template Logs' : 'Broadcasts'}
            </h1>
            <span className="text-[10px] font-bold bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full">
              {mainView === 'templates' ? `${TPL_DEMO.length} templates` : mainView === 'logs' ? `${TEMPLATE_LOGS.length} logs` : `${campaigns.length} campaigns`}
            </span>
          </div>
          <p className="text-[11px] text-slate-400">
            {mainView === 'templates'
              ? 'Create and manage your WhatsApp message templates'
              : mainView === 'logs'
              ? 'Track every template message sent from your WABA number'
              : 'Send targeted WhatsApp campaigns to your contact segments'}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-nowrap">
          {mainView === 'campaigns' ? (
            <>
              <NativeSelect value={dateRange} onChange={e => setDateRange(e.target.value)} sm>
                <option value="Last 7 days">Last 7 days</option>
                <option value="Last 30 days">Last 30 days</option>
                <option value="Last 90 days">Last 90 days</option>
                <option value="All time">All time</option>
              </NativeSelect>
              <button
                onClick={() => setShowQuickSend(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-primary/30 bg-primary-50 text-primary text-xs font-semibold hover:bg-primary-100 hover:border-primary/50 transition-colors whitespace-nowrap flex-shrink-0">
                <Send size={12} /> Quick Send
              </button>
              <button
                onClick={() => setShowWizard(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary text-white text-xs font-semibold hover:bg-primary-hover transition-colors shadow-sm whitespace-nowrap flex-shrink-0">
                <Plus size={13} /> New Campaign
              </button>
            </>
          ) : mainView === 'templates' ? (
            <button
              onClick={() => setMainView('template-builder')}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary text-white text-xs font-semibold hover:bg-primary-hover transition-colors shadow-sm whitespace-nowrap">
              <Plus size={13} /> Create Template
            </button>
          ) : null}
        </div>
      </div>

      {/* ── Section switcher ── */}
      <div className="flex items-center gap-0.5 bg-slate-100 p-1 rounded-xl w-fit">
        {[
          { key: 'campaigns', label: 'Campaigns',     Icon: Send     },
          { key: 'templates', label: 'Templates',     Icon: FileText },
          { key: 'logs',      label: 'Template Logs', Icon: History  },
        ].map(({ key, label, Icon }) => (
          <button key={key} onClick={() => setMainView(key)}
            className={clsx(
              'flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-all',
              mainView === key ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
            )}>
            <Icon size={12} /> {label}
          </button>
        ))}
      </div>

      {/* ── Template Logs view ── */}
      {mainView === 'logs' && <TemplateLogs />}

      {/* ── Templates view ── */}
      {mainView === 'templates' && (
        <TemplatesView onCreate={() => setMainView('template-builder')} />
      )}

      {/* ── Campaigns view ── */}
      {mainView === 'campaigns' && (
        <>
          {/* Account Health */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">

            {/* Daily Limit */}
            <div className="card p-4">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-0.5">Daily Limit</p>
                  <p className="text-[11px] font-semibold text-slate-900">Messaging Capacity</p>
                </div>
                <Info size={13} className="text-slate-300 flex-shrink-0" />
              </div>
              <div className="mb-2.5">
                <div className="flex justify-between text-[10px] mb-1.5">
                  <span className="text-slate-400">Used today</span>
                  <span className="font-semibold text-slate-700">957 <span className="text-slate-400 font-normal">/ 2,000</span></span>
                </div>
                <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                  <div className="h-full bg-primary rounded-full" style={{ width: '47.85%' }} />
                </div>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 flex-shrink-0" />
                <p className="text-[10px] text-slate-500">1,043 contacts remaining today</p>
              </div>
            </div>

            {/* Messaging Quality */}
            <div className="card p-4">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-0.5">Quality Score</p>
                  <p className="text-[11px] font-semibold text-slate-900">Messaging Quality</p>
                </div>
                <Shield size={13} className="text-emerald-500 flex-shrink-0" />
              </div>
              <div className="flex items-center gap-3 mb-3">
                <div className="w-8 h-8 rounded-full bg-emerald-50 ring-2 ring-emerald-400 ring-offset-1 flex items-center justify-center flex-shrink-0">
                  <div className="w-3 h-3 rounded-full bg-emerald-400" />
                </div>
                <div>
                  <p className="text-sm font-bold text-emerald-600 leading-none">High</p>
                  <p className="text-[10px] text-slate-400 mt-0.5">Your score is excellent</p>
                </div>
              </div>
              <div className="flex items-end gap-0.5 h-6">
                {[40, 55, 45, 65, 58, 72, 68].map((h, i) => (
                  <div key={i} className={clsx('flex-1 rounded-sm', i >= 4 ? 'bg-emerald-400' : 'bg-emerald-100')}
                    style={{ height: `${h}%` }} />
                ))}
              </div>
            </div>

            {/* Sending Streak */}
            <div className="card p-4">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-0.5">Streak</p>
                  <p className="text-[11px] font-semibold text-slate-900">Consecutive Sending Days</p>
                </div>
                <Zap size={13} className="text-amber-400 flex-shrink-0" />
              </div>
              <div className="flex items-center gap-2 mb-3">
                <p className="text-xl font-bold text-slate-900">3</p>
                <p className="text-[11px] text-slate-400">days this week</p>
              </div>
              <div className="flex items-center gap-1">
                {['M','T','W','T','F','S','S'].map((day, i) => (
                  <div key={i} className="flex flex-col items-center gap-1 flex-1">
                    <div className={clsx('w-full aspect-square rounded-full flex items-center justify-center',
                      i < 3 ? 'bg-amber-400' : 'bg-slate-100')}>
                      {i < 3
                        ? <Check size={10} className="text-white" />
                        : <span className="w-1 h-1 rounded-full bg-slate-300" />}
                    </div>
                    <span className="text-[9px] font-medium text-slate-400">{day}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Primary Metrics */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {[
              { icon: Send,         label: 'Total Sent', value: totals.sent,      sub: `${pct(totals.delivered, totals.sent)}% delivery rate`,  iconBg: 'bg-blue-50',    iconColor: 'text-blue-500'    },
              { icon: CheckCircle2, label: 'Delivered',  value: totals.delivered, sub: `of ${totals.sent.toLocaleString()} sent`,                iconBg: 'bg-emerald-50', iconColor: 'text-emerald-500' },
              { icon: Eye,          label: 'Read',       value: totals.read,      sub: `${pct(totals.read, totals.delivered)}% read rate`,       iconBg: 'bg-teal-50',    iconColor: 'text-teal-500'    },
              { icon: CornerUpLeft, label: 'Replied',    value: totals.replied,   sub: `${pct(totals.replied, totals.delivered)}% reply rate`,   iconBg: 'bg-violet-50',  iconColor: 'text-violet-500'  },
            ].map(({ icon: Icon, label, value, sub, iconBg, iconColor }) => (
              <div key={label} className="card p-4">
                <div className={clsx('w-7 h-7 rounded-lg flex items-center justify-center mb-3', iconBg)}>
                  <Icon size={14} className={iconColor} />
                </div>
                <p className="text-xl font-bold text-slate-900 tabular-nums">{value.toLocaleString()}</p>
                <p className="text-[11px] font-semibold text-slate-500 mt-0.5">{label}</p>
                <p className="text-[10px] text-slate-400 mt-1">{sub}</p>
              </div>
            ))}
          </div>

          {/* Secondary metrics strip */}
          <div className="card p-4">
            <div className="grid grid-cols-2 sm:grid-cols-4 divide-surface-border sm:divide-x">
              {[
                { label: 'Currently Sending', value: totals.sending,    color: 'text-blue-600'  },
                { label: 'Failed',            value: totals.failed,     color: 'text-red-600'   },
                { label: 'Processing',        value: totals.processing, color: 'text-amber-600' },
                { label: 'Queued',            value: totals.queued,     color: 'text-slate-600' },
              ].map(({ label, value, color }) => (
                <div key={label} className="px-6 first:pl-0 last:pr-0 flex items-center gap-3">
                  <span className={clsx('text-sm font-bold tabular-nums', color)}>{value.toLocaleString()}</span>
                  <span className="text-[10px] text-slate-400 leading-tight">{label}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Campaigns table */}
          <div className="card p-0 overflow-hidden">
            {/* Tabs + search */}
            <div className="flex items-center justify-between px-5 py-2 border-b border-surface-border">
              <div className="flex items-center gap-0.5 bg-slate-100 p-1 rounded-xl w-fit">
                {STATUS_TABS.map(tab => (
                  <button key={tab} onClick={() => setActiveTab(tab)}
                    className={clsx('flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-all whitespace-nowrap',
                      activeTab === tab ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700')}>
                    {tab}
                    {tabCounts[tab] > 0 && (
                      <span className={clsx('text-[10px] font-bold px-1.5 py-0.5 rounded-full',
                        activeTab === tab ? 'bg-primary/10 text-primary' : 'bg-slate-200 text-slate-500')}>
                        {tabCounts[tab]}
                      </span>
                    )}
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-2 py-2">
                <div className="relative">
                  <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    className="pl-8 pr-3 py-1.5 text-xs border border-surface-border rounded-lg w-52 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all placeholder-slate-400"
                    placeholder="Search campaigns…"
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                  />
                </div>
              </div>
            </div>

            {/* Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-surface-border bg-slate-50/60">
                    <th className="px-5 py-3 text-left text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Campaign</th>
                    <th className="px-4 py-3 text-left text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Audience</th>
                    <th className="px-4 py-3 text-left text-[11px] font-semibold text-slate-400 uppercase tracking-wider min-w-[180px]">Performance</th>
                    <th className="px-4 py-3 text-left text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Status</th>
                    <th className="px-4 py-3 text-left text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Date</th>
                    <th className="px-5 py-3 text-right text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-surface-border">
                  {filtered.map(c => {
                    const delivPct   = pct(c.successful, c.recipients)
                    const readPct    = pct(c.read,       c.recipients)
                    const repliedPct = pct(c.replied,    c.recipients)
                    return (
                      <tr key={c.id} className="hover:bg-slate-50/50 transition-colors group">

                        {/* Campaign name */}
                        <td className="px-5 py-4">
                          <div className="flex items-start gap-3">
                            <div className={clsx('w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5',
                              c.template.category === 'MARKETING' ? 'bg-violet-50' : 'bg-blue-50')}>
                              <FileText size={13} className={c.template.category === 'MARKETING' ? 'text-violet-500' : 'text-blue-500'} />
                            </div>
                            <div className="min-w-0">
                              <button
                                onClick={() => { setActiveCampaign(c); setView('insights') }}
                                className="text-left group/name block">
                                <p className="text-xs font-semibold text-slate-900 group-hover/name:text-primary transition-colors max-w-[220px] truncate">
                                  {c.name}
                                </p>
                              </button>
                              <div className="flex items-center gap-2 mt-0.5">
                                <span className={clsx('text-[9px] font-bold px-1.5 py-0.5 rounded',
                                  c.template.category === 'MARKETING' ? 'bg-violet-50 text-violet-600' : 'bg-blue-50 text-blue-600')}>
                                  {c.template.category}
                                </span>
                                <span className="text-[10px] text-slate-400">{c.channel}</span>
                              </div>
                            </div>
                          </div>
                        </td>

                        {/* Audience */}
                        <td className="px-4 py-4">
                          <p className="text-xs font-semibold text-slate-800">{c.recipients.toLocaleString()}</p>
                          <p className="text-[10px] text-slate-400">contacts</p>
                        </td>

                        {/* Performance bars */}
                        <td className="px-4 py-4">
                          <div className="space-y-1.5">
                            {[
                              { label: 'Delivered', pctVal: delivPct,   bar: 'bg-emerald-400' },
                              { label: 'Read',      pctVal: readPct,    bar: 'bg-teal-400'    },
                              { label: 'Replied',   pctVal: repliedPct, bar: 'bg-violet-400'  },
                            ].map(({ label, pctVal, bar }) => (
                              <div key={label} className="flex items-center gap-2">
                                <span className="text-[10px] text-slate-400 w-14 flex-shrink-0">{label}</span>
                                <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                  <div className={clsx('h-full rounded-full', bar)} style={{ width: `${pctVal}%` }} />
                                </div>
                                <span className="text-[10px] font-semibold text-slate-600 w-7 text-right tabular-nums">{pctVal}%</span>
                              </div>
                            ))}
                          </div>
                        </td>

                        {/* Status */}
                        <td className="px-4 py-4">
                          <StatusPill status={c.status} />
                        </td>

                        {/* Date */}
                        <td className="px-4 py-4">
                          <p className="text-xs text-slate-500 whitespace-nowrap">{c.date}</p>
                        </td>

                        {/* Actions */}
                        <td className="px-5 py-4 text-right">
                          <button
                            onClick={() => { setActiveCampaign(c); setView('insights') }}
                            className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary hover:bg-primary/5 px-3 py-1.5 rounded-lg transition-colors">
                            <BarChart2 size={12} /> Analytics
                          </button>
                        </td>
                      </tr>
                    )
                  })}

                  {filtered.length === 0 && (
                    <tr>
                      <td colSpan={6} className="py-16 text-center">
                        <div className="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto mb-3">
                          <Inbox size={20} className="text-slate-300" />
                        </div>
                        <p className="text-xs font-semibold text-slate-500">No campaigns found</p>
                        <p className="text-xs text-slate-400 mt-1">
                          {search ? 'Try adjusting your search' : 'Create your first campaign to get started'}
                        </p>
                        {!search && (
                          <button onClick={() => setShowWizard(true)}
                            className="mt-3 inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-primary text-white text-xs font-semibold hover:bg-primary-hover transition-colors shadow-sm">
                            <Plus size={12} /> New Campaign
                          </button>
                        )}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            <div className="flex items-center justify-between px-5 py-3 border-t border-surface-border bg-slate-50/40">
              <p className="text-xs text-slate-400">
                Showing <span className="font-semibold text-slate-600">{filtered.length}</span> of{' '}
                <span className="font-semibold text-slate-600">{campaigns.length}</span> campaigns
              </p>
              <div className="flex items-center gap-1">
                <button className="p-1.5 rounded-lg hover:bg-surface-hover text-slate-400 disabled:opacity-30 transition-colors" disabled>
                  <ChevronLeft size={14} />
                </button>
                <button className="px-3 py-1 rounded-lg bg-primary text-white text-xs font-semibold">1</button>
                <button className="p-1.5 rounded-lg hover:bg-surface-hover text-slate-400 disabled:opacity-30 transition-colors" disabled>
                  <ChevronRight size={14} />
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      {/* New Campaign Wizard Modal */}
      {showWizard && (
        <NewCampaignWizard
          onClose={() => setShowWizard(false)}
          onCreated={c => setCampaigns(prev => [c, ...prev])}
        />
      )}

      {/* Quick Send Modal */}
      {showQuickSend && (
        <QuickSendModal onClose={() => setShowQuickSend(false)} />
      )}
    </div>
  )
}
