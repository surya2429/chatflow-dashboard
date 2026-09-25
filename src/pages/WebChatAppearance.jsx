import { useState, useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import {
  MessageSquare, Settings, Smartphone, Monitor, Tablet,
  Check, ChevronDown, ChevronUp, Zap, Plus, X,
  Star, Send, Paperclip, Mail, Calendar, Info,
  MapPin, Upload, CreditCard, Lock,
  Clock, ArrowRight, ExternalLink, Eye,
  Edit2, Image, Bot, Users,
  ChevronRight, Palette, Shield, MessageCircle, DollarSign,
  AlignLeft, LocateFixed,
  Pencil, Smile, Bell, Volume2, Sun, Moon, Sparkles,
  Search, Package, LifeBuoy, MessageCircleMore,
  Minus, VolumeX, Mic, Download, MoreVertical, MoreHorizontal, HelpCircle,
  CalendarDays, ShoppingBag, Layers, Maximize2, Minimize2, Type as TypeIcon,
  ChevronLeft, RefreshCw, CheckCheck, Wand2, Rows3, RotateCcw,
  Copy, Trash2, ImagePlus, Globe, QrCode, Link as LinkIcon, Droplet, Type,
  Home, Inbox, CalendarCheck2, Phone, Video,
} from 'lucide-react'
import clsx from 'clsx'
import { QUESTION_TYPES, QUESTION_CATS } from '../constants/webchatQuestionTypes'
import { GOOGLE_FONTS, FONT_CATEGORIES, fontStack } from '../constants/googleFonts'
import { getBotId, useBotId } from '../constants/webchat'
import { usePublishSection, useLoadSection, SECTION_APPEARANCE } from '../lib/liveConfig'
import { AnswerControl } from '../components/webchat/AnswerControls'
import LocationMap from '../components/webchat/LocationMap'
import { PoweredByDemoModal } from '../components/webchat/PoweredByDemoModal'
import { useSpeechToText } from '../hooks/useSpeechToText'

/* ─── Constants ─────────────────────────────────────────────── */
const COLORS = ['#0066ff','#8B5CF6','#10B981','#F59E0B','#EF4444','#EC4899','#06B6D4','#1D4ED8']

/* Icon choices for the launcher bubble when it's not just mirroring the
   profile picture — 'chat' (MessageCircleMore) is the long-standing default. */
const LAUNCHER_ICON_MAP = {
  chat: MessageCircleMore, bubble: MessageCircle, square: MessageSquare,
  bot: Bot, support: LifeBuoy, spark: Sparkles, bolt: Zap, help: HelpCircle,
}
const LAUNCHER_ICON_OPTIONS = [
  { v: 'chat',    l: 'Chat'    }, { v: 'bubble',  l: 'Bubble'  },
  { v: 'square',  l: 'Square'  }, { v: 'bot',     l: 'Bot'     },
  { v: 'support', l: 'Support' }, { v: 'spark',   l: 'Spark'   },
  { v: 'bolt',    l: 'Bolt'    }, { v: 'help',    l: 'Help'    },
]
/* Body text is authored against a 12px baseline; every other size in the widget is
   expressed relative to it, so one slider (10-20px) scales the whole thing coherently. */
const FONT_BASE_PX = 12
const MIN_FONT_PX = 10
const MAX_FONT_PX = 20
const BUBBLE_STYLES = ['modern','classic','minimal','ios']

/* Loads a Google Font stylesheet on demand — cached by id so switching back and forth doesn't re-fetch. */
function useGoogleFont(family) {
  useEffect(() => {
    if (!family || family === 'System Default') return
    const id = `gf-${family.replace(/\s+/g,'-')}`
    if (document.getElementById(id)) return
    const link = document.createElement('link')
    link.id = id
    link.rel = 'stylesheet'
    link.href = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(family).replace(/%20/g,'+')}:wght@400;500;600;700;800&display=swap`
    document.head.appendChild(link)
  }, [family])
}

function Toggle({ checked, onChange }) {
  return (
    <button onClick={()=>onChange(!checked)} style={{
      width:34, height:18, borderRadius:9, border:'none', cursor:'pointer', position:'relative',
      background: checked ? '#0066ff' : '#d1d5db', transition:'background 0.2s', padding:0, flexShrink:0,
    }}>
      <div style={{ position:'absolute', top:2, left: checked ? 16 : 2, width:14, height:14, borderRadius:'50%',
        background:'#fff', transition:'left 0.2s', boxShadow:'0 1px 3px rgba(0,0,0,0.2)' }}/>
    </button>
  )
}

/* Relative luminance of a hex color — decides whether text on top of it should be
   dark or light, so a custom header color never ends up with unreadable controls. */
function luminance(hex) {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex || '')
  if (!m) return 0
  const [r, g, b] = [1, 2, 3].map(i => {
    const c = parseInt(m[i], 16) / 255
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)
  })
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

/* Push a colour to a lightness that is readable against the widget's surface,
 * KEEPING ITS HUE. Darkens for a light panel, lightens for a dark one — a pale
 * brand is the unreadable case on white, and a deep one is the unreadable case
 * on the dark theme, so which direction to move depends on what it sits on.
 *
 * Done in HSL rather than by blending toward black. Blending drags every
 * channel toward the same point, so a pale amber and a pale sky both end up as
 * near-identical mud — the brand survives in theory and not in the eye.
 * Pinning lightness while leaving hue and saturation alone turns pale amber
 * into a rich dark amber and pale sky into a deep blue, which still read as
 * the merchant's colour. A pure white or grey brand has no saturation to keep,
 * so it correctly lands on a neutral ink.
 */
function readableInk(hex, onDark = false) {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex || '')
  if (!m) return '#0f172a'
  const [r, g, b] = [1, 2, 3].map(i => parseInt(m[i], 16) / 255)
  const max = Math.max(r, g, b), min = Math.min(r, g, b)
  const l = (max + min) / 2
  const d = max - min
  const s = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1))
  let h = 0
  if (d !== 0) {
    if (max === r) h = ((g - b) / d) % 6
    else if (max === g) h = (b - r) / d + 2
    else h = (r - g) / d + 4
    h *= 60
    if (h < 0) h += 360
  }
  // 34% clears 4.5:1 against white; 72% clears it against the dark panel.
  // Saturation is carried over untouched — a near-neutral tint lands on a
  // blue-grey because its hue genuinely is blue, not because anything here
  // pushed it there.
  const L = onDark ? 0.72 : 0.34
  const S = s
  const c = (1 - Math.abs(2 * L - 1)) * S
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1))
  const mm = L - c / 2
  const [r2, g2, b2] =
      h < 60  ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x]
    : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x]
  return `#${[r2, g2, b2].map(v => Math.round((v + mm) * 255).toString(16).padStart(2, '0')).join('')}`
}

/* Launcher attention effects. `rings` paints expanding halos behind the button,
   `self` animates the button itself — a few can do both. */
const LAUNCHER_FX = {
  none:      {},
  pulse:     { rings: 'wcRing' },
  ripple:    { rings: 'wcRipple' },
  glow:      { self: 'wcGlow 2.4s ease-in-out infinite' },
  bounce:    { self: 'wcLaunchBounce 2.2s ease-in-out infinite' },
  heartbeat: { self: 'wcHeartbeat 1.9s ease-in-out infinite' },
  wobble:    { self: 'wcWobble 3s ease-in-out infinite' },
  swing:     { self: 'wcSwing 3.2s ease-in-out infinite' },
  jelly:     { self: 'wcJelly 2.8s ease-in-out infinite' },
  pulseGlow: { rings: 'wcRing', self: 'wcGlow 2.4s ease-in-out infinite' },
}
const LAUNCHER_FX_OPTIONS = [
  { v:'none', l:'None' }, { v:'pulse', l:'Pulse' }, { v:'ripple', l:'Ripple' },
  { v:'glow', l:'Glow' }, { v:'bounce', l:'Bounce' }, { v:'heartbeat', l:'Heartbeat' },
  { v:'wobble', l:'Wobble' }, { v:'swing', l:'Swing' }, { v:'jelly', l:'Jelly' },
  { v:'pulseGlow', l:'Pulse + Glow' },
]

const CORNER_PX  = { sharp: 6, soft: 14, round: 24 }

/* Border lighting. 2px reads as a lit edge at every corner radius; 3px starts
   looking like a frame, and 1px disappears on a light background. 6s is slow
   enough to be ambient rather than a loading spinner. */
const BORDER_LIGHT_PX = 2
const BORDER_LIGHT_SECONDS = 6

/* Which corner the opening panel scales out of — always the one the launcher
   occupies, so the widget looks like it unfolded from the button the visitor
   just pressed rather than materialising over it. */
const PANEL_ORIGIN = {
  'bottom-right': '100% 100%',
  'bottom-left':  '0% 100%',
  'top-right':    '100% 0%',
  'top-left':     '0% 0%',
}
/* Real-world messenger widths — Intercom ≈ 400px, chatbot.com ≈ 380px.
   The old 236/264/300 values were far too narrow and caused text to wrap badly. */
const SIZE_PX    = { compact: 340, standard: 384, large: 420 }

/* Pure, cfg-only presentation logic behind the real widget's look — colors, shapes,
   spacing and avatar rendering, all derived straight from the Widget Builder's `cfg`
   with no chat state involved. Extracted out of WidgetPreview so any other surface
   that wants to *look* like the real widget (e.g. the flow-builder's live
   PreviewSimulator) can share the exact same theming instead of re-deriving a
   simplified copy of it. */
export function useWidgetTheme(cfg) {
  const dark = cfg.theme === 'dark'
  const initials = (cfg.botName||'Bot').slice(0,2).toUpperCase()

  /* Brand gradient — still the default source of truth for the launcher, send
     button and avatar rings. */
  const brandBg = cfg.colorMode === 'gradient'
    ? `linear-gradient(135deg, ${cfg.color} 0%, ${cfg.colorEnd||cfg.color} 100%)`
    : cfg.color

  /* Header can now break away from the brand color entirely: keep it on brand,
     paint it a custom solid/gradient, or leave it a clean light surface. */
  const headerBg = cfg.headerMode === 'custom'
    ? (cfg.headerGradient
        ? `linear-gradient(135deg, ${cfg.headerColor} 0%, ${cfg.headerColorEnd||cfg.headerColor} 100%)`
        : cfg.headerColor)
    : cfg.headerMode === 'surface'
      ? (dark ? '#0f172a' : '#ffffff')
      : brandBg

  const cornerR = CORNER_PX[cfg.corner] ?? 24

  /* One slider drives every size in the widget (10-20px on the body text). */
  const fontScale = (Number(cfg.fontSizePx) || FONT_BASE_PX) / FONT_BASE_PX
  const fs = base => `${Math.round(base * fontScale * 10) / 10}px`
  const fontFamilyCss = fontStack(cfg.fontFamily)

  /* The header's flat base color (never a gradient) — used both to decide whether
     header text should be light or dark, and as the "sync with header" option for
     the message bubbles below. */
  const headerBaseColor = cfg.headerMode === 'custom' ? (cfg.headerColor || cfg.color)
    : cfg.headerMode === 'brand' ? cfg.color
    : (dark ? '#0f172a' : '#ffffff')
  const headerLight = luminance(headerBaseColor) > 0.62
  const onHeader       = headerLight ? '#0f172a' : '#ffffff'
  const onHeaderMuted  = headerLight ? '#8b95a6' : 'rgba(255,255,255,0.78)'
  const headerHoverBg  = headerLight ? 'rgba(15,23,42,0.06)' : 'rgba(255,255,255,0.18)'

  /* The same treatment for the BRAND fill, which the header logic never covered.
     The launcher, send button, avatars, chips and answer bubbles all paint
     themselves with `brandBg` and used to hard-code white on top of it — fine
     for a blue or purple brand, invisible for a white or pale one, which is
     exactly what a merchant sees the moment they pick white.

     A gradient is judged on the average of its stops: a single stop would call
     white-to-navy "light" or "dark" depending on which end we happened to look
     at, and the average is the only reading that is right in the middle where
     most of the text actually sits. */
  const brandLum = cfg.colorMode === 'gradient'
    ? (luminance(cfg.color) + luminance(cfg.colorEnd || cfg.color)) / 2
    : luminance(cfg.color)
  const brandLight    = brandLum > 0.62
  const onBrand       = brandLight ? '#0f172a' : '#ffffff'
  const onBrandMuted  = brandLight ? 'rgba(15,23,42,0.60)' : 'rgba(255,255,255,0.78)'
  /* A white brand on a white panel has no silhouette of its own — the launcher
     becomes an invisible disc and the header dissolves into the body. A hairline
     only appears when the brand is light enough to need one. */
  const brandEdge     = brandLight ? '1px solid rgba(15,23,42,0.12)' : 'none'
  /* The brand colour used as TEXT or an icon ON the panel's light surface —
     prices, quick-reply labels, active tabs. `onBrand` is the opposite case
     (text sitting on a brand-filled shape) and cannot be reused here: on a
     white brand it resolves to near-black, which is right inside a white
     launcher and wrong for a "brand-coloured" price. */
  /* Only rewritten when the brand would actually be unreadable against the
     panel it sits on: pale on light, or deep on dark. Otherwise the merchant's
     colour is used exactly as picked. */
  const accentNeedsFix = dark ? brandLum < 0.10 : brandLight
  const accent        = accentNeedsFix ? readableInk(cfg.color, dark) : cfg.color
  const headerEdge    = headerLight ? '1px solid rgba(15,23,42,0.08)' : 'none'

  /* Bubble surfaces are independently themable: the "question" (bot) bubble and
     the "answer" (visitor) bubble each get their own background + text color.
     A value of 'header' syncs that bubble to the header's own color instead of
     a fixed swatch. */
  const resolveBubbleBg = v => v === 'header' ? headerBaseColor : v
  const botBubbleBg   = resolveBubbleBg(cfg.botBubbleBg)  || (dark ? '#1e293b' : '#ffffff')
  const userBubbleBg  = resolveBubbleBg(cfg.userBubbleBg) || null   // null → fall back to the brand fill
  /* When the text color is left on Auto it follows the bubble it sits on, so a dark
     custom background can never end up with dark text (and vice versa). */
  const autoText = bg => (luminance(bg) > 0.5 ? '#0f172a' : '#f1f5f9')
  const botBubbleText  = cfg.botBubbleText  || autoText(botBubbleBg)
  const userBubbleText = cfg.userBubbleText || autoText(userBubbleBg || cfg.color)

  /* Chat thread background — the surface the message bubbles sit on. Auto keeps
     the usual light/dark neutral; 'header' syncs it to a very light tint of the
     header color instead of a fixed swatch. */
  const chatBackground = cfg.chatBackground === 'header'
    ? (dark ? headerBaseColor : `${headerBaseColor}0d`)
    : cfg.chatBackground || (dark ? '#0b1220' : '#f7f8fb')

  /* Message-bubble skin, driven by the Bubble Style picker */
  const bubbleIsMinimal = cfg.bubbleStyle === 'minimal'
  function bubbleRadius(isUser) {
    const tailCorner = isUser ? 'borderBottomRightRadius' : 'borderBottomLeftRadius'
    switch (cfg.bubbleStyle) {
      case 'classic': return { borderRadius: 14, [tailCorner]: 3 }
      case 'ios':      return { borderRadius: 18 }
      case 'minimal':  return { borderRadius: cornerR*0.7 }
      case 'modern':
      default:         return { borderRadius: cornerR*0.9, [tailCorner]: 6 }
    }
  }

  /* Shared avatar renderer. `which` picks between the header profile picture and
     the smaller avatar shown beside each question — they're configured separately. */
  function AvatarFace({ px, which = 'profile' }) {
    const img   = which === 'thread' ? cfg.threadAvatarImage : cfg.avatarImage
    const style = which === 'thread' ? cfg.threadAvatarStyle : cfg.avatarStyle
    const emoji = which === 'thread' ? cfg.threadAvatarEmoji : cfg.avatarEmoji
    if (style === 'image' && img) {
      return <img src={img} alt="" className="w-full h-full object-cover" draggable={false}/>
    }
    if (style === 'emoji') return <span style={{ fontSize: px * 0.55 }}>{emoji || '🤖'}</span>
    if (style === 'icon')  return <Bot size={Math.round(px * 0.5)} style={{ color: onBrand }}/>
    return <span className="font-black" style={{ fontSize: Math.round(px * 0.36), color: onBrand }}>{initials}</span>
  }

  const DENSITY = cfg.density === 'compact'
    ? { gap: 3, groupGap: 8, px: 12, py: 7, pad: 12 }
    : { gap: 4, groupGap: 14, px: 14, py: 9, pad: 16 }

  const BUBBLE_SHADOW = {
    flat: 'none',
    soft: '0 1px 2px rgba(15,23,42,0.06)',
    elevated: '0 6px 16px -6px rgba(15,23,42,0.20), 0 1px 3px rgba(15,23,42,0.06)',
  }[cfg.bubbleShadow] ?? '0 1px 2px rgba(15,23,42,0.06)'

  /* Corner radii that respond to a message's position inside its run. */
  function groupRadius(isUser, first, last) {
    const R = cfg.bubbleStyle === 'ios' ? 18
      : cfg.bubbleStyle === 'classic' ? 14
      : cfg.bubbleStyle === 'minimal' ? cornerR * 0.7
      : cornerR * 0.9
    const tight = cfg.bubbleStyle === 'ios' ? 18 : 7
    return isUser
      ? { borderTopLeftRadius: R, borderBottomLeftRadius: R,
          borderTopRightRadius: first ? R : tight, borderBottomRightRadius: last ? R : tight }
      : { borderTopRightRadius: R, borderBottomRightRadius: R,
          borderTopLeftRadius: first ? R : tight, borderBottomLeftRadius: last ? R : tight }
  }

  return {
    dark, initials, brandBg, headerBg, cornerR, fs, fontFamilyCss,
    headerBaseColor, headerLight, onHeader, onHeaderMuted, headerHoverBg, headerEdge,
    brandLight, onBrand, onBrandMuted, brandEdge, accent,
    botBubbleBg, botBubbleText, userBubbleBg, userBubbleText,
    chatBackground, bubbleIsMinimal, bubbleRadius, DENSITY, BUBBLE_SHADOW, groupRadius,
    AvatarFace,
  }
}

export function WidgetPreview({ cfg, screen, device, previewQuestionTypes, scrollToQType, activeTab, setActiveTab, simThread, simComposerBanner, simComposerControl, simInlineControl, simInlineMsgId, setScreen: setScreenProp, onVoiceCall, onVideoCall, onRestartChat }) {
  useGoogleFont(cfg.fontFamily)
  // `setScreen` is only meaningful to callers that actually own a "screen"
  // state to transition (the Appearance page's own live preview) — callers
  // that don't (WebChatLandingPage.jsx, the Flow Builder's simulator, which
  // maps it to onClose) simply don't pass it, so this falls back to a no-op
  // rather than throwing ReferenceError on every "Close chat" click.
  const setScreen = setScreenProp || (() => {})
  const [maximized, setMaximized] = useState(false)
  const [muted, setMuted] = useState(!cfg.sound)
  const [moreOpen, setMoreOpen] = useState(false)
  const [savedFlash, setSavedFlash] = useState(false)
  const [pickedChip, setPickedChip] = useState(null)
  /* Hoisted out of FaqScreen (below) — FaqScreen is now called as a plain
     function (`FaqScreen()`, not `<FaqScreen/>`) so switching screens
     doesn't force-remount the current one and reset its scroll position
     (see the currentScreenKey render below); a hook call conditionally
     nested inside a plain function call like that would violate the Rules
     of Hooks, so it has to live up here unconditionally instead. */
  const [openIdx, setOpenIdx] = useState(0)
  const [draft, setDraft] = useState('')
  const draftRef = useRef(null)
  const moreRef = useRef(null)
  const msgListRef = useRef(null)
  /* Whatever was already typed when the mic was tapped — dictation is
     appended to it rather than wiping a half-written message, and each
     interim result replaces the last one instead of stacking up. */
  const draftBeforeDictationRef = useRef('')
  const { recording, toggle: toggleDictation } = useSpeechToText({
    onStart: () => { draftBeforeDictationRef.current = draft },
    onTranscript: text => {
      const base = draftBeforeDictationRef.current
      setDraft(base && text ? `${base.replace(/\s+$/, '')} ${text}` : (text || base))
    },
  })
  /* Close the overflow menu when clicking anywhere outside it — the menu is
     positioned absolutely inside the header, so we check clicks against the
     nearest `moreRef` ancestor. */
  useEffect(() => {
    function onDocClick(e) {
      if (moreRef.current && !moreRef.current.contains(e.target)) setMoreOpen(false)
    }
    document.addEventListener('mousedown', onDocClick)
    return () => document.removeEventListener('mousedown', onDocClick)
  }, [])
  /* Runs after React has actually committed the new value to the DOM, not inside
     onChange itself — for a controlled textarea, the DOM's own text (and so its
     scrollHeight) hasn't updated yet at the point onChange fires, so measuring
     there reads the *previous* content and the box resizes one keystroke late.
     Caps the grow at ~4.5 lines, then the textarea's own overflow-y takes over —
     matches how real chat composers (iMessage, WhatsApp) behave: it expands with
     the message, but doesn't take over the whole widget for a very long paste. */
  useEffect(() => {
    const el = draftRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = Math.min(el.scrollHeight, 92) + 'px'
  }, [draft])
  /* activeTab is owned by the parent now (not local state) — it's the single
     source of truth for which tab is showing, shared with the outer Home/Chat/
     Closed switcher above the widget, so the two can never disagree about what's
     actually on screen. */
  /* Clicking a type in the Question Types list scrolls the already-open feed to
     that message instead of re-filtering it, so the surrounding types stay
     visible for comparison. */
  useEffect(() => {
    if (!scrollToQType) return
    const el = document.getElementById(`qt-${scrollToQType}`)
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }, [scrollToQType])
  /* Which past conversation (if any) is open — null means "fresh chat" (the seeded
     THREAD below); 'ended' opens the resolved one from the Messages list instead. */
  const [openConvo, setOpenConvo] = useState(null)
  // "Powered by ChatFlow" → demo-booking form (see PoweredByDemoModal).
  const [demoOpen, setDemoOpen] = useState(false)
  const tabsCount = [cfg.showHomeTab, cfg.showChatTab, cfg.showMessagesTab, cfg.showFaqTab, cfg.showBookingTab].filter(Boolean).length
  const tabsEnabled = tabsCount >= 2
  /* A live simThread (the flow-builder's PreviewSimulator) is always a floating
     "conversation already in progress" widget — there's no Home/Messages/FAQ
     tab to switch to, so it always renders the chat screen directly and the
     tab bar never shows, regardless of how many tabs cfg has enabled. */
  const currentScreenKey = simThread ? 'chat' : (tabsEnabled ? activeTab : (screen === 'chat' ? 'chat' : 'home'))

  const isOpen = screen !== 'closed'

  /* Pure cfg-derived theming (colors, shapes, spacing, avatar rendering) is shared
     with any other surface that needs to look like the real widget — see
     useWidgetTheme below. Everything here is a straight function of `cfg`; no
     chat state is involved. */
  const {
    dark, initials, brandBg, headerBg, cornerR, fs, fontFamilyCss,
    headerBaseColor, headerLight, onHeader, onHeaderMuted, headerHoverBg, headerEdge,
    brandLight, onBrand, onBrandMuted, brandEdge, accent,
    botBubbleBg, botBubbleText, userBubbleBg, userBubbleText,
    chatBackground, bubbleIsMinimal, bubbleRadius, DENSITY, BUBBLE_SHADOW, groupRadius,
    AvatarFace,
  } = useWidgetTheme(cfg)

  /* Launcher icon — by default it mirrors the Profile Picture (launcherIconStyle
     'match', the long-standing behavior), but can be set independently: its own
     icon, emoji, or uploaded image. 'initials' has no launcher equivalent — that
     branch (only reachable via 'match') falls through to the default chat icon,
     same as before this was configurable at all. */
  const effLauncherStyle = cfg.launcherIconStyle === 'match' ? cfg.avatarStyle : cfg.launcherIconStyle
  const LauncherIconCmp = LAUNCHER_ICON_MAP[cfg.launcherIcon] || MessageCircleMore
  const launcherIconEl =
    effLauncherStyle === 'image' && (cfg.launcherIconStyle === 'match' ? cfg.avatarImage : cfg.launcherImage)
      ? <img src={cfg.launcherIconStyle === 'match' ? cfg.avatarImage : cfg.launcherImage} alt="" className="w-full h-full object-cover"/>
      : effLauncherStyle === 'emoji'
      ? <span style={{fontSize: 27}}>{(cfg.launcherIconStyle === 'match' ? cfg.avatarEmoji : cfg.launcherEmoji) || '🤖'}</span>
      : effLauncherStyle === 'icon'
        ? (cfg.launcherIconStyle === 'match'
            ? <Bot size={26} style={{ color: onBrand }}/>
            : <LauncherIconCmp size={26} style={{ color: onBrand }}/>)
        : <MessageCircleMore size={27} style={{ color: onBrand }}/>

  const winW = maximized ? 468 : (SIZE_PX[cfg.size] ?? 384)

  const Avatar = ({ size = 8 }) => (
    <div className={clsx('rounded-xl flex items-center justify-center flex-shrink-0 overflow-hidden',
      cfg.avatarStyle === 'image' && cfg.avatarImage ? '' : dark ? 'bg-white/15' : 'bg-white/25')}
      style={{ width: size*4, height: size*4 }}>
      <AvatarFace px={size*4}/>
    </div>
  )

  /* ── Home screen (open, not yet chatting) — modeled directly on the live Intercom
     and chatbot.com widgets: a COMPACT color header (not a full-height hero block),
     bold two-line greeting, and the primary action as a white CARD with an avatar
     cluster — not a solid colored button. ── */
  const HomeScreen = () => (
    <div className="flex flex-col h-full">
      {/* Compact header — color/gradient is an accent band, not the dominant surface.
          Layered soft circles fake the depth real widgets get from a photo header. */}
      <div className="flex-shrink-0 relative overflow-hidden px-5 pt-4 pb-11"
        style={{background: headerBg, borderBottom: headerEdge}}>
        {/* The same three circles that already faked depth here, now drifting on
            three different periods — a slow-moving colour field instead of a
            static gradient. They're behind the text and clipped by the header's
            own overflow-hidden, so nothing can escape the band. */}
        <div className="wc-aurora-1 absolute -top-12 -right-12 w-36 h-36 rounded-full bg-white/10"/>
        <div className="wc-aurora-2 absolute top-8 -right-2 w-16 h-16 rounded-full bg-white/10"/>
        <div className="wc-aurora-3 absolute bottom-0 left-10 w-10 h-10 rounded-full bg-black/5"/>
        {/* Specular sweep on open — purely decorative, so it takes no space and
            never intercepts a click. */}
        <div className="wc-sheen absolute inset-y-0 pointer-events-none"
          style={{ left: '-45%', width: '45%',
            background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.30), transparent)' }}/>
        <div className="flex items-center justify-between mb-4 relative">
          <Avatar size={8} textSize="12px"/>
          <button className="w-6 h-6 rounded-full bg-white/15 hover:bg-white/25 flex items-center justify-center transition-colors flex-shrink-0">
            <X size={11} style={{ color: onHeader }}/>
          </button>
        </div>
        <p style={{fontSize: fs(20), fontFamily: fontFamilyCss, color: onHeader}} className="font-extrabold leading-[1.15] tracking-tight relative">
          {cfg.greeting?.split(/(?<=[!.?])\s/)[0] || 'Hi there 👋'}
        </p>
        <p style={{fontSize: fs(20), fontFamily: fontFamilyCss, color: onHeaderMuted}} className="font-extrabold leading-[1.15] tracking-tight relative">
          How can we help?
        </p>
      </div>

      {/* White (or dark) card pulled up over header — dominant surface, like real products */}
      <div className={clsx('flex-1 -mt-6 overflow-y-auto relative flex flex-col', dark ? 'bg-slate-900' : 'bg-white')}
        style={{ borderTopLeftRadius: cornerR*1.3, borderTopRightRadius: cornerR*1.3, fontFamily: fontFamilyCss }}>

        {/* wc-stagger cascades these direct children in one after another. Safe
            to replay on screen changes: these nodes only mount when the home
            screen does, so a re-render inside the widget never restarts it. */}
        <div className="wc-stagger px-4 pt-5 flex-1">
          {/* Primary action as a CARD with a team avatar cluster — not a solid button */}
          <button style={{borderRadius: cornerR*0.8, boxShadow: dark ? '0 8px 24px -6px rgba(0,0,0,0.5)' : '0 12px 28px -8px rgba(15,23,42,0.16)'}}
            className={clsx('w-full flex items-center gap-3 p-4 border text-left transition-transform hover:-translate-y-0.5',
              dark ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-100')}>
            <div className="flex-1 min-w-0">
              <p style={{fontSize: fs(13.5)}} className={clsx('font-bold', dark ? 'text-slate-100' : 'text-slate-800')}>Send us a message</p>
              <p style={{fontSize: fs(10.5)}} className={clsx('mt-0.5', dark ? 'text-slate-500' : 'text-slate-400')}>We typically reply in a few minutes</p>
            </div>
            <div className="flex items-center flex-shrink-0" style={{marginRight: 2}}>
              <div className="w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-black ring-2 relative" style={{background: `linear-gradient(135deg, ${cfg.color}, ${cfg.colorEnd||cfg.color})`, color: onBrand, border: brandEdge, ringColor: dark?'#0f172a':'#fff', zIndex:3}}>{initials}</div>
              <div className={clsx('w-8 h-8 rounded-full flex items-center justify-center -ml-2.5 ring-2 relative', dark ? 'ring-slate-900' : 'ring-white')}
                style={{background:'linear-gradient(135deg,#F59E0B,#EF4444)', zIndex:2}}>
                <span className="text-[10px] font-black" style={{ color: onBrand }}>AI</span>
              </div>
              <div className={clsx('w-8 h-8 rounded-full flex items-center justify-center -ml-2.5 ring-2', dark ? 'bg-slate-700 ring-slate-900' : 'bg-slate-200 ring-white')}>
                <Bot size={13} className={dark ? 'text-slate-300' : 'text-slate-500'}/>
              </div>
            </div>
          </button>

          {/* Continue an existing conversation — Intercom surfaces this right under
              the primary action, with an unread dot and relative timestamp. */}
          <div className="mt-5">
            <p className={clsx('text-[10px] font-bold uppercase tracking-wide mb-2', dark ? 'text-slate-500' : 'text-slate-400')}>Recent message</p>
            <button onClick={()=>{ setOpenConvo('ended'); setActiveTab('chat') }} style={{borderRadius: cornerR*0.6}}
              className={clsx('w-full flex items-center gap-2.5 p-2.5 border text-left transition-colors',
                dark ? 'border-slate-700 hover:bg-slate-800' : 'border-slate-200 hover:bg-slate-50')}>
              <div className="w-7 h-7 rounded-full flex items-center justify-center text-[9px] font-black flex-shrink-0" style={{background: brandBg, color: onBrand, border: brandEdge}}>{initials}</div>
              <div className="flex-1 min-w-0">
                <p style={{fontSize: fs(11)}} className={clsx('font-semibold truncate', dark ? 'text-slate-200' : 'text-slate-700')}>Plan change request</p>
                <p style={{fontSize: fs(10)}} className={clsx('truncate mt-0.5', dark ? 'text-slate-500' : 'text-slate-400')}>Perfect, thank you!</p>
              </div>
              <div className="flex flex-col items-end gap-1 flex-shrink-0">
                <span className={clsx('text-[9px]', dark ? 'text-slate-600' : 'text-slate-400')}>2h</span>
                <span className="w-1.5 h-1.5 rounded-full" style={{background: cfg.color}}/>
              </div>
            </button>
          </div>

          {/* Light-touch starter suggestions */}
          <div className="mt-5">
            <p className={clsx('text-[10px] font-bold uppercase tracking-wide mb-2', dark ? 'text-slate-500' : 'text-slate-400')}>Or ask about</p>
            <div className="space-y-1.5">
              {['How does pricing work?', 'Track my order', 'Talk to a human'].map(q=>(
                <div key={q} style={{borderRadius: cornerR*0.55}}
                  className={clsx('flex items-center justify-between px-3.5 py-2.5 border cursor-pointer transition-colors',
                    dark ? 'border-slate-700 hover:bg-slate-800' : 'border-slate-200 hover:bg-slate-50')}>
                  <span style={{fontSize: fs(11.5)}} className={clsx('font-medium', dark ? 'text-slate-300' : 'text-slate-600')}>{q}</span>
                  <ChevronRight size={12} className={dark ? 'text-slate-600' : 'text-slate-300'}/>
                </div>
              ))}
            </div>
          </div>

          {/* Search entry to the help center — the last row of Intercom's home */}
          <div className="mt-5 mb-2">
            <div style={{borderRadius: cornerR*0.6}}
              className={clsx('flex items-center gap-2 px-3.5 py-2.5 border cursor-pointer transition-colors',
                dark ? 'bg-slate-800 border-slate-700 hover:bg-slate-700' : 'bg-slate-50 border-slate-200 hover:bg-slate-100')}>
              <Search size={13} className={dark ? 'text-slate-500' : 'text-slate-400'}/>
              <span style={{fontSize: fs(11.5)}} className={clsx(dark ? 'text-slate-500' : 'text-slate-400')}>Search for help</span>
            </div>
          </div>
        </div>

      </div>
    </div>
  )

  /* ── Chat screen ─────────────────────────────────────────────
     Rebuilt around a real message-group model (like Intercom / Messenger):
     consecutive messages from the same sender share one avatar, get tighter
     corner radii on the joined edge, and show a single timestamp on the last
     bubble of the run. Every element animates in on a stagger. ── */
  const ANIM = { none: 'none', fade: 'wcFade', slide: 'wcSlideIn', pop: 'wcPop' }[cfg.msgAnimation] ?? 'wcSlideIn'
  /* The stagger delay is capped, not proportional to the message's raw index
     — otherwise every message's entrance delay keeps growing for the rest of
     the conversation (message #20 wouldn't even start animating in until
     1.6s after it's added), which makes text feel like it's "loading slow"
     the longer a chat runs. A live simulation or a real back-and-forth with
     the visitor can easily produce dozens of messages, so this has to stay
     bounded — capping at a few messages' worth of stagger keeps the initial
     "thread opens with a few messages cascading in" effect without letting
     later replies lag further and further behind. */
  const animStyle = i => ANIM === 'none'
    ? {}
    : { animation: `${ANIM} 0.42s cubic-bezier(0.16,1,0.3,1) both`, animationDelay: `${Math.min(i, 4) * 80}ms` }

  const FRESH_THREAD = [
    { id: 1, from: 'bot',  text: cfg.greeting || 'Hi! 👋 How can I help you today?', time: '2:14 PM' },
    { id: 2, from: 'bot',  text: 'I can help with pricing, orders, or connect you to the team.', time: '2:14 PM',
      chips: ['See pricing', 'Track my order', 'Talk to a human'] },
    { id: 3, from: 'user', text: 'I have a question about pricing', time: '2:15 PM' },
    { id: 4, from: 'bot',  text: 'Sure — here are our plans 🎯', time: '2:15 PM', plans: true },
  ]
  /* A resolved conversation reopened from the Messages list — shows a human handoff
     via a centered system row, the way a live agent joining is usually announced. */
  const ENDED_THREAD = [
    { id: 1, from: 'user', text: 'Hi, I need help changing my plan', time: 'Mon 10:02 AM' },
    { id: 2, sys: true, text: 'Priya joined the conversation', time: 'Mon 10:04 AM' },
    { id: 3, from: 'bot',  text: "Hi! I've upgraded your plan to Growth — you'll see it reflected on your next invoice.", time: 'Mon 10:06 AM' },
    { id: 4, from: 'user', text: 'Perfect, thank you!', time: 'Mon 10:07 AM' },
  ]
  /* When previewing question types (from the Question Types tab), the thread
     becomes every type in one scrollable feed — each as its own bot message
     with a real bubble and its actual interactive control — instead of the
     generic demo conversation. */
  const QUESTION_TYPE_THREAD = previewQuestionTypes?.length ? previewQuestionTypes.map((qt, i) => ({
    id: `qt-${qt.id}`, from: 'bot', time: '2:14 PM',
    text: SAMPLE_QUESTIONS[qt.id] || qt.name, questionType: qt,
  })) : null
  /* simThread (the flow-builder's live simulation) takes priority over every
     other demo/preview thread when provided — see the `simThread` prop doc
     above WidgetPreview's signature. */
  const THREAD = simThread || QUESTION_TYPE_THREAD || (openConvo === 'ended' ? ENDED_THREAD : FRESH_THREAD)

  /* Keep the message list pinned to its newest message whenever the SPACE
     AVAILABLE to it changes — not just when its own content changes. The
     composer/answer-control slot below it can grow taller on its own (an
     auto-growing textarea as the visitor types a long answer, a choice
     control expanding once an option is selected) entirely inside a CHILD
     component's local state, which never re-renders this parent — so the
     inline ref callback below (which only re-pins on THIS component's own
     renders) goes stale and the last message ends up clipped under the
     composer instead of scrolling into view. A ResizeObserver reacts to the
     size change itself regardless of which component caused it. */
  useEffect(() => {
    if (QUESTION_TYPE_THREAD) return
    const el = msgListRef.current
    if (!el) return
    const ro = new ResizeObserver(() => { el.scrollTop = el.scrollHeight })
    ro.observe(el)
    return () => ro.disconnect()
  }, [QUESTION_TYPE_THREAD])

  const BotAvatar = ({ visible }) => (
    <div className="flex-shrink-0" style={{ width: 28, height: 28 }}>
      {visible && (
        <div className="w-7 h-7 rounded-full flex items-center justify-center relative overflow-hidden"
          style={{ background: cfg.threadAvatarStyle === 'image' && cfg.threadAvatarImage ? '#fff' : brandBg }}>
          <AvatarFace px={28} which="thread"/>
        </div>
      )}
    </div>
  )

  const HeaderBtn = ({ title, onClick, active, children, className }) => (
    <button title={title} onClick={onClick}
      className={clsx('wc-hbtn w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0', className)}
      style={{ color: onHeaderMuted, background: active ? headerHoverBg : 'transparent', ['--wc-hover']: headerHoverBg, ['--wc-on']: onHeader }}>
      {children}
    </button>
  )

  const ChatScreen = () => (
    <div className="flex flex-col h-full" style={{ fontFamily: fontFamilyCss }}>
      {/* ── Header ── */}
      <div className="flex-shrink-0 relative z-20"
        style={{
          background: headerBg,
          boxShadow: headerLight ? '0 1px 0 rgba(15,23,42,0.07), 0 4px 12px -8px rgba(15,23,42,0.20)'
                                 : '0 4px 14px -8px rgba(15,23,42,0.45)',
        }}>
        {/* Compact top bar — back arrow + bot info + actions */}
        <div className="flex items-center gap-2.5 px-3 py-2.5">
          {/* Back button — subtle ghost pill */}
          <button
            onClick={() => setActiveTab('home')}
            className="flex items-center justify-center w-7 h-7 rounded-full flex-shrink-0 transition-all"
            style={{
              color: onHeaderMuted,
              background: 'transparent',
              ['--wc-hover']: headerHoverBg,
            }}
            onMouseEnter={e => e.currentTarget.style.background = headerHoverBg}
            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
            <ChevronLeft size={17} strokeWidth={2.2}/>
          </button>

          {/* Bot avatar */}
          <div className="relative flex-shrink-0">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center overflow-hidden"
              style={{
                background: dark ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0.22)',
                border: headerLight ? 'none' : '1.5px solid rgba(255,255,255,0.35)',
                boxShadow: '0 2px 8px rgba(0,0,0,0.12)',
              }}>
              <AvatarFace px={36}/>
            </div>
            {/* Online indicator */}
            <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-emerald-400 border-2"
              style={{ borderColor: dark ? 'rgba(15,23,42,0.85)' : 'rgba(255,255,255,0.9)' }}/>
          </div>

          {/* Bot name + tagline */}
          <div className="flex-1 min-w-0">
            <p style={{fontSize: fs(12.5), color: onHeader}} className="font-bold leading-tight truncate">
              {cfg.botName || 'ChatBot'}
            </p>
            <p style={{fontSize: fs(9.5), color: onHeaderMuted}} className="leading-tight mt-0.5 truncate">
              {cfg.tagline || 'We reply instantly'}
            </p>
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-0.5 flex-shrink-0 relative">
            {cfg.enableVoiceCall && (
              <button title="Voice call" onClick={()=>onVoiceCall?.()} className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 transition-colors"
                style={{ color: onHeaderMuted, background: 'transparent', ['--wc-hover']: headerHoverBg }}
                onMouseEnter={e => e.currentTarget.style.background = headerHoverBg}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                <Phone size={15}/>
              </button>
            )}
            {cfg.enableVideoCall && (
              <button title="Video call" onClick={()=>onVideoCall?.()} className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 transition-colors"
                style={{ color: onHeaderMuted, background: 'transparent', ['--wc-hover']: headerHoverBg }}
                onMouseEnter={e => e.currentTarget.style.background = headerHoverBg}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                <Video size={15}/>
              </button>
            )}
            <button title="Minimize" onClick={()=>setMaximized(m=>!m)} className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 transition-colors"
              style={{ color: onHeaderMuted, background: 'transparent', ['--wc-hover']: headerHoverBg }}
              onMouseEnter={e => e.currentTarget.style.background = headerHoverBg}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
              <Minimize2 size={15}/>
            </button>
            <div className="relative" ref={moreRef}>
              <button title="More options" active={moreOpen} onClick={()=>setMoreOpen(o=>!o)}
                className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 transition-colors"
                style={{ color: onHeaderMuted, background: moreOpen ? headerHoverBg : 'transparent', ['--wc-hover']: headerHoverBg }}
                onMouseEnter={e => e.currentTarget.style.background = headerHoverBg}
                onMouseLeave={e => e.currentTarget.style.background = moreOpen ? headerHoverBg : 'transparent'}>
                <MoreHorizontal size={15}/>
              </button>
              {moreOpen && (
                <div className={clsx('absolute right-0 top-9 w-48 rounded-2xl overflow-hidden z-30 text-left border',
                  dark ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200')}
                  style={{ boxShadow:'0 18px 40px -12px rgba(15,23,42,0.35)', animation:'wcMenuIn 0.18s cubic-bezier(0.16,1,0.3,1) both', transformOrigin:'top right' }}>
                  {device !== 'mobile' && (
                    <button onClick={()=>{ setMaximized(m=>!m); setMoreOpen(false) }}
                      className={clsx('w-full flex items-center gap-2.5 px-3.5 py-2.5 text-[11.5px] font-medium transition-colors',
                        dark ? 'text-slate-200 hover:bg-slate-700' : 'text-slate-700 hover:bg-slate-50')}>
                      {maximized ? <Minimize2 size={13} className="text-slate-400"/> : <Maximize2 size={13} className="text-slate-400"/>}
                      {maximized ? 'Restore size' : 'Expand window'}
                    </button>
                  )}
                  <button onClick={()=>{ setMuted(m=>!m); setMoreOpen(false) }}
                    className={clsx('w-full flex items-center gap-2.5 px-3.5 py-2.5 text-[11.5px] font-medium transition-colors border-t',
                      dark ? 'text-slate-200 hover:bg-slate-700 border-slate-700' : 'text-slate-700 hover:bg-slate-50 border-slate-100')}>
                    {muted ? <VolumeX size={13} className="text-slate-400"/> : <Volume2 size={13} className="text-slate-400"/>}
                    {muted ? 'Unmute sounds' : 'Mute sounds'}
                  </button>
                  {cfg.saveChat && (
                    <button onClick={()=>{ setSavedFlash(true); setMoreOpen(false); setTimeout(()=>setSavedFlash(false), 2200) }}
                      className={clsx('w-full flex items-center gap-2.5 px-3.5 py-2.5 text-[11.5px] font-medium transition-colors border-t',
                        dark ? 'text-slate-200 hover:bg-slate-700 border-slate-700' : 'text-slate-700 hover:bg-slate-50 border-slate-100')}>
                      <Download size={13} className="text-slate-400"/> Save transcript
                    </button>
                  )}
                  <button onClick={()=>{ onRestartChat?.(); setMoreOpen(false) }}
                    className={clsx('w-full flex items-center gap-2.5 px-3.5 py-2.5 text-[11.5px] font-medium transition-colors border-t',
                      dark ? 'text-slate-200 hover:bg-slate-700 border-slate-700' : 'text-slate-700 hover:bg-slate-50 border-slate-100')}>
                    <RotateCcw size={13} className="text-slate-400"/> Restart chat
                  </button>
                  <button onClick={()=>{ setScreen('closed'); setMoreOpen(false) }}
                    className={clsx('w-full flex items-center gap-2.5 px-3.5 py-2.5 text-[11.5px] font-medium transition-colors border-t',
                      dark ? 'text-slate-200 hover:bg-slate-700 border-slate-700' : 'text-slate-700 hover:bg-slate-50 border-slate-100')}>
                    <X size={13} className="text-slate-400"/> Close chat
                  </button>
                </div>
              )}
            </div>
            <button title="Close chat" onClick={()=>setScreen('closed')} className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 transition-colors"
              style={{ color: onHeaderMuted, background: 'transparent', ['--wc-hover']: headerHoverBg }}
              onMouseEnter={e => e.currentTarget.style.background = headerHoverBg}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
              <X size={15}/>
            </button>
          </div>
        </div>

        {savedFlash && (
          <span className="absolute left-1/2 -translate-x-1/2 -bottom-7 text-[9.5px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-full z-20"
            style={{ animation:'wcSlideIn 0.3s cubic-bezier(0.16,1,0.3,1) both' }}>
            Transcript saved ✓
          </span>
        )}
      </div>

      {/* ── Messages ── */}
      <div className="flex-1 overflow-y-auto relative wc-scroll"
        /* Pin to the newest message, the way a real widget opens — otherwise the
           latest reply (and the typing indicator) sit below the fold. The one
           exception is the question-types feed, which opens at the top since
           there's no "latest" message to jump to — just a full catalog to scroll. */
        ref={el => { msgListRef.current = el; if (el) el.scrollTop = QUESTION_TYPE_THREAD ? 0 : el.scrollHeight }}
        style={{ background: chatBackground, padding: DENSITY.pad, paddingTop: 12 }}>

        {/* Date chip */}
        <div className="flex justify-center mb-3" style={animStyle(0)}>
          <span className={clsx('text-[9px] font-semibold px-2.5 py-1 rounded-full',
            dark ? 'bg-slate-800 text-slate-500' : 'bg-white text-slate-400 border border-slate-100')}>
            Today
          </span>
        </div>

        {THREAD.map((m, i) => {
          if (m.sys) {
            return (
              <div key={m.id} className="flex justify-center" style={{ margin: `${DENSITY.groupGap}px 0`, ...animStyle(i+1) }}>
                <span className={clsx('text-[9.5px] font-semibold px-2.5 py-1 rounded-full flex items-center gap-1.5',
                  dark ? 'bg-slate-800/70 text-slate-400' : 'bg-slate-100 text-slate-500')}>
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block"/>
                  {m.text}
                </span>
              </div>
            )
          }
          const prev = THREAD[i-1], next = THREAD[i+1]
          const isUser = m.from === 'user'
          const first = !prev || prev.from !== m.from || prev.sys
          const last  = !next || next.from !== m.from || next.sys
          return (
            <div key={m.id} id={m.questionType ? m.id : undefined}
              style={{ marginTop: i === 0 ? 0 : (first ? DENSITY.groupGap : DENSITY.gap) }}>
              <div className={clsx('flex items-end gap-2', isUser && 'flex-row-reverse')}>
                {!isUser && <BotAvatar visible={last}/>}
                <div className="max-w-[78%] min-w-0" style={animStyle(i+1)}>
                  {first && !isUser && cfg.showSenderName && (
                    <p className={clsx('text-[9.5px] font-bold mb-1 ml-0.5', dark ? 'text-slate-500' : 'text-slate-400')}>
                      {cfg.botName || 'ChatBot'}
                    </p>
                  )}
                  <div
                    className="wc-bubble leading-relaxed"
                    style={{
                      ...groupRadius(isUser, first, last),
                      fontSize: fs(11.8),
                      padding: `${DENSITY.py}px ${DENSITY.px}px`,
                      boxShadow: BUBBLE_SHADOW,
                      // A long answer with no spaces (someone holding a key
                      // down, a pasted token/URL/ID, …) doesn't have a word
                      // boundary to wrap at — without this, normal CSS text
                      // wrapping leaves it as one unbroken run that stretches
                      // the bubble past the widget's edge, forcing the whole
                      // message list to scroll horizontally. Breaking mid-word
                      // when nothing else fits keeps every bubble inside the
                      // widget no matter what was typed.
                      overflowWrap: 'break-word',
                      wordBreak: 'break-word',
                      /* Honour newlines. A multi-field form submits as one
                         "Label: value" per line, and any bot message a merchant
                         writes across several lines means them — collapsing
                         both into one run was losing real structure. */
                      whiteSpace: 'pre-wrap',
                      background: isUser
                        ? (bubbleIsMinimal ? 'transparent' : (userBubbleBg || brandBg))
                        : (bubbleIsMinimal ? 'transparent' : botBubbleBg),
                      color: isUser
                        ? (bubbleIsMinimal ? (userBubbleBg || cfg.color) : userBubbleText)
                        : (bubbleIsMinimal ? botBubbleText : botBubbleText),
                      border: bubbleIsMinimal
                        ? `1.5px solid ${isUser ? cfg.color : dark ? '#334155' : '#cbd5e1'}`
                        : isUser ? 'none' : dark ? '1px solid #1e293b' : '1px solid #eef1f6',
                    }}>
                    {m.text}
                  </div>

                  {/* A location the bot sent. Rendered under the text rather
                      than inside the bubble: the map wants the full bubble
                      width and square corners, which fighting the bubble's
                      padding and radius would only approximate. */}
                  {m.location && (
                    <div className="mt-1.5">
                      <LocationMap
                        lat={m.location.lat} lng={m.location.lng}
                        address={m.location.address} label={m.location.label}
                        apiKey={cfg.googleMapsApiKey} accent={accent} dark={dark}
                        height={130}/>
                    </div>
                  )}

                  {/* Quick replies — staggered in, nothing pre-selected */}
                  {m.chips && (
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {m.chips.map((c, ci) => (
                        <button key={c} onClick={()=>setPickedChip(c)}
                          className="wc-chip font-semibold"
                          style={{
                            fontSize: fs(10.5),
                            padding: '6px 12px',
                            borderRadius: cfg.quickReplyStyle === 'square' ? cornerR*0.5 : 999,
                            border: `1.5px solid ${pickedChip===c ? accent : dark ? '#334155' : '#e2e8f0'}`,
                            background: pickedChip===c ? cfg.color : dark ? '#1e293b' : '#fff',
                            color: pickedChip===c ? onBrand : accent,
                            animation: ANIM==='none' ? 'none' : 'wcPop 0.34s cubic-bezier(0.16,1,0.3,1) both',
                            animationDelay: `${(i+1)*80 + 90 + ci*70}ms`,
                          }}>
                          {c}
                        </button>
                      ))}
                    </div>
                  )}

                  {/* Question-type preview — the actual (shared) interactive
                      control for whichever type is selected on the Question
                      Types tab, rendered non-interactively (no onSubmit) since
                      this is a design preview, not a live simulation. */}
                  {m.questionType && (
                    <div className="mt-2">
                      <AnswerControl questionType={m.questionType.id} accent={cfg.color} dark={dark} interactive={false} googleMapsApiKey={cfg.googleMapsApiKey}/>
                    </div>
                  )}

                  {/* The live sim's control for THIS question, attached under
                      its own bubble instead of the fixed composer — only for
                      choice styles designed to read as a menu of buttons
                      (see isInlineAskAwaiting). Every other question type
                      still answers from the composer below, unchanged. */}
                  {simInlineControl && simInlineMsgId === m.id && (
                    <div className="mt-2">{simInlineControl}</div>
                  )}

                  {/* Rich plan cards — an example of a structured bot reply */}
                  {m.plans && (
                    <div className="flex gap-2 mt-2 overflow-x-auto wc-scroll pb-1" style={{ scrollSnapType:'x mandatory' }}>
                      {[{n:'Starter',p:'$19',d:'1 bot · 1k chats'},{n:'Growth',p:'$49',d:'5 bots · 10k chats'},{n:'Scale',p:'$99',d:'Unlimited'}].map((pl, pi)=>(
                        <div key={pl.n} className="wc-card flex-shrink-0"
                          style={{
                            width: 118, scrollSnapAlign:'start',
                            borderRadius: cornerR*0.65,
                            padding: 10,
                            background: dark ? '#1e293b' : '#fff',
                            border: dark ? '1px solid #334155' : '1px solid #eef1f6',
                            boxShadow: BUBBLE_SHADOW,
                            animation: ANIM==='none' ? 'none' : 'wcPop 0.34s cubic-bezier(0.16,1,0.3,1) both',
                            animationDelay: `${(i+1)*80 + 90 + pi*70}ms`,
                          }}>
                          <p style={{fontSize: fs(10)}} className={clsx('font-bold uppercase tracking-wide', dark?'text-slate-500':'text-slate-400')}>{pl.n}</p>
                          <p style={{fontSize: fs(16), color: accent}} className="font-extrabold leading-none mt-1">{pl.p}<span style={{fontSize: fs(9)}} className="font-semibold opacity-60">/mo</span></p>
                          <p style={{fontSize: fs(9.5)}} className={clsx('mt-1 leading-snug', dark?'text-slate-500':'text-slate-400')}>{pl.d}</p>
                          <button className="wc-cardbtn w-full mt-2 font-bold"
                            style={{ fontSize: fs(10), padding:'5px 0', borderRadius: cornerR*0.45, background: brandBg, color: onBrand, border: brandEdge }}>
                            Choose
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  {last && cfg.timestampMode !== 'none' && (
                    <p className={clsx('text-[9px] mt-1.5 flex items-center gap-1', isUser ? 'justify-end mr-0.5' : 'ml-0.5',
                      dark ? 'text-slate-600' : 'text-slate-400')}>
                      {m.time}
                      {isUser && cfg.readReceipts && <CheckCheck size={11} style={{color: cfg.color}}/>}
                    </p>
                  )}
                </div>
              </div>
            </div>
          )
        })}

        {/* Typing indicator — its own row, aligned with bot bubbles */}
        {cfg.typingIndicator && openConvo !== 'ended' && !QUESTION_TYPE_THREAD && !simThread && (
          <div className="flex items-end gap-2" style={{ marginTop: DENSITY.groupGap, ...animStyle(THREAD.length+1) }}>
            <BotAvatar visible/>
            <div className="inline-flex items-center gap-1"
              style={{ ...groupRadius(false, true, true), padding: `${DENSITY.py+2}px ${DENSITY.px}px`,
                background: botBubbleBg, border: dark ? '1px solid #1e293b' : '1px solid #eef1f6',
                boxShadow: BUBBLE_SHADOW }}>
              {[0,1,2].map(d=>(
                <span key={d} className="rounded-full" style={{ width:5, height:5, background: cfg.color, opacity:0.55,
                  animation:`wcDot 1.3s ease-in-out ${d*0.16}s infinite` }}/>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ── Composer — or, for a resolved conversation reopened from Messages, a
             banner offering to reopen it instead of a live input. ── */}
      {openConvo === 'ended' ? (
        <div className={clsx('flex-shrink-0 px-4 py-3.5 text-center', dark ? 'bg-slate-900' : 'bg-white')}
          style={{ boxShadow: dark ? '0 -1px 0 rgba(255,255,255,0.06)' : '0 -1px 0 rgba(15,23,42,0.06)' }}>
          <p className={clsx('text-[10.5px] font-semibold', dark ? 'text-slate-400' : 'text-slate-500')}>This conversation has ended</p>
          <button onClick={()=>setOpenConvo(null)} className="wc-chip inline-flex items-center gap-1.5 mt-2 font-bold"
            style={{ fontSize: fs(10.5), padding:'7px 16px', borderRadius:999, color: onBrand, background: brandBg,
              border: brandEdge, boxShadow: `0 6px 16px -6px ${cfg.color}80` }}>
            <RefreshCw size={11}/> Reply to reopen
          </button>
        </div>
      ) : simComposerBanner ? (
        /* Same visual pattern as the "conversation has ended" banner above,
           just parameterized with the caller's own copy/action — used by the
           flow-builder's PreviewSimulator to show a live simulation-ended
           state without a fake chat bubble announcing it. */
        <div className={clsx('flex-shrink-0 px-4 py-3.5 text-center', dark ? 'bg-slate-900' : 'bg-white')}
          style={{ boxShadow: dark ? '0 -1px 0 rgba(255,255,255,0.06)' : '0 -1px 0 rgba(15,23,42,0.06)' }}>
          <p className={clsx('text-[10.5px] font-semibold', dark ? 'text-slate-400' : 'text-slate-500')}>{simComposerBanner.text}</p>
          <button onClick={simComposerBanner.onAction} className="wc-chip inline-flex items-center gap-1.5 mt-2 font-bold"
            style={{ fontSize: fs(10.5), padding:'7px 16px', borderRadius:999, color: onBrand, background: brandBg,
              border: brandEdge, boxShadow: `0 6px 16px -6px ${cfg.color}80` }}>
            <RefreshCw size={11}/> {simComposerBanner.actionLabel}
          </button>
        </div>
      ) : simComposerControl ? (
        /* A message is currently awaiting an answer — instead of a free-text
           composer, the interactive answer control (ask control, or the
           quick-reply/branch chip row) renders full-width right here in the
           composer slot, the single consistent location for every question
           type rather than one attached under each message bubble.

           The panel itself is a fixed height, so this slot can't just grow
           without bound the way the choice controls' own content now does
           (no truncation, no internal scroll of their own — see
           AnswerControls.jsx). Left unconstrained, a long option list used
           to demand more height than the panel had, and flexbox met that
           demand by shrinking the message thread above it toward zero —
           the question bubble scrolled almost entirely out of view instead
           of the composer giving an inch. `max-h-[62%]` + its own scroll
           caps the composer's share of the panel so the thread always keeps
           real room, and a genuinely long list scrolls as one smooth region
           here instead of clipping invisibly against the panel's edge. */
        <div className={clsx('flex-shrink-0 overflow-y-auto wc-scroll px-3 pt-2.5 pb-2.5 max-h-[62%]', dark ? 'bg-slate-900' : 'bg-white')}
          style={{ boxShadow: dark ? '0 -1px 0 rgba(255,255,255,0.06)' : '0 -1px 0 rgba(15,23,42,0.06)' }}>
          {simComposerControl}
        </div>
      ) : simThread ? (
        /* A live simulation (PreviewSimulator) is active but not currently
           awaiting an answer — this is the brief gap between one question's
           answer being submitted and the next question actually landing
           (auto-advancing nodes in between can take a beat). The composer
           slot must NEVER fall through to the plain free-text composer here
           — swapping to it and back for every single question read as the
           whole widget "refreshing". Instead hold a fixed-height placeholder
           with a small typing-style indicator so the transition is smooth. */
        <div className={clsx('flex-shrink-0 px-3 pt-2 pb-2.5 flex items-center', dark ? 'bg-slate-900' : 'bg-white')}
          style={{ boxShadow: dark ? '0 -1px 0 rgba(255,255,255,0.06)' : '0 -1px 0 rgba(15,23,42,0.06)', minHeight: 52 }}>
          <div className="flex items-center gap-1 px-1">
            {[0,1,2].map(d=>(
              <span key={d} className="rounded-full" style={{ width:5, height:5, background: cfg.color, opacity:0.4,
                animation:`wcDot 1.3s ease-in-out ${d*0.16}s infinite` }}/>
            ))}
          </div>
        </div>
      ) : (
      <div className={clsx('flex-shrink-0 px-3 pt-2 pb-2.5', dark ? 'bg-slate-900' : 'bg-white')}
        style={{ boxShadow: dark ? '0 -1px 0 rgba(255,255,255,0.06)' : '0 -1px 0 rgba(15,23,42,0.06)' }}>
        <div className="wc-composer flex items-end gap-1.5"
          style={{
            borderRadius: cfg.bubbleStyle === 'classic' ? cornerR*0.6 : 22,
            padding: '6px 6px 6px 8px',
            background: dark ? '#111c30' : '#f4f6f9',
            border: `1.5px solid ${dark ? '#22304a' : '#e3e8f0'}`,
            boxShadow: 'none',
            transition: 'all 0.2s ease',
          }}>
          {cfg.attach && (
            <button title="Attach file" className="wc-ibtn flex-shrink-0"
              style={{ marginBottom: 1, ['--wc-hover']: dark ? 'rgba(255,255,255,0.08)' : '#e8ecf1', color: dark ? '#7c8ba1' : '#64748b' }}>
              <Paperclip size={16}/>
            </button>
          )}
          <textarea
            name="message"
            ref={draftRef}
            rows={1}
            value={draft}
            onChange={e => setDraft(e.target.value)}
            placeholder={recording ? 'Listening…' : 'Type a message…'}
            style={{ fontSize: fs(12), fontFamily: fontFamilyCss, lineHeight: 1.5, maxHeight: 100, paddingTop: 7, paddingBottom: 7, caretColor: cfg.color }}
            className={clsx('flex-1 bg-transparent outline-none min-w-0 px-1 resize-none wc-scroll',
              dark ? 'text-slate-100 placeholder-slate-500' : 'text-slate-800 placeholder-slate-400')}/>

          {(cfg.gifPicker || cfg.emoji || cfg.voiceInput) && (
            <span className="flex items-center gap-0.5 flex-shrink-0" style={{ marginBottom: 1 }}>
              {cfg.gifPicker && (
                <button title="Send a GIF" className="wc-ibtn"
                  style={{ ['--wc-hover']: dark ? 'rgba(255,255,255,0.08)' : '#e8ecf1' }}>
                  <span className="text-[8px] font-black tracking-tight px-1.5 py-[3px] rounded-[4px] border"
                    style={{ color: dark ? '#7c8ba1' : '#64748b', borderColor: dark ? '#3b4a63' : '#cbd5e1' }}>GIF</span>
                </button>
              )}
              {cfg.emoji && (
                <button title="Emoji" className="wc-ibtn wc-ibtn-emoji"
                  style={{ ['--wc-hover']: dark ? 'rgba(255,255,255,0.08)' : '#e8ecf1', color: dark ? '#7c8ba1' : '#64748b' }}>
                  <Smile size={16}/>
                </button>
              )}
              {cfg.voiceInput && (
                <button onClick={toggleDictation}
                  title={recording ? 'Listening — stops on its own when you finish' : 'Voice to text'}
                  className="wc-ibtn"
                  style={recording
                    ? { background:'#fee2e2', color:'#ef4444', animation:'wcRec 1.4s ease-in-out infinite' }
                    : { ['--wc-hover']: dark ? 'rgba(255,255,255,0.08)' : '#e8ecf1', color: dark ? '#7c8ba1' : '#64748b' }}>
                  <Mic size={16}/>
                </button>
              )}
            </span>
          )}

          <button title="Send" className="wc-send flex items-center justify-center flex-shrink-0"
            onClick={()=>{
              if (!draft.trim()) return
              setDraft('')
              if (draftRef.current) draftRef.current.style.height = 'auto'
            }}
            style={{ width: 36, height: 36, borderRadius: '50%', background: brandBg, boxShadow: `0 4px 14px -4px ${cfg.color}99`, transition: 'transform .18s cubic-bezier(.16,1,.3,1)' }}>
            <Send size={15} style={{ marginLeft: 1, marginTop: -1, color: onBrand }}/>
          </button>
        </div>

        {recording && (
          <div className="flex items-center gap-1.5 mt-1.5 px-1">
            <span className="w-1.5 h-1.5 rounded-full bg-red-500" style={{animation:'wcPresence 1s ease-in-out infinite'}}/>
            <span className="text-[9px] font-semibold text-red-500">Listening… stops when you finish</span>
          </div>
        )}
      </div>
      )}
    </div>
  )

  /* ── Messages screen — conversation history, opened from its own tab ── */
  const MOCK_CONVERSATIONS = [
    { id: 'ended', name: cfg.botName || 'ChatBot', preview: 'Perfect, thank you!', time: '2d', unread: 0, resolved: true, kind: 'bot' },
    { id: 'support1', name: 'Priya · Support', preview: "I've gone ahead and processed that for you.", time: '1w', unread: 1, resolved: true, kind: 'agent' },
  ]
  const MessagesScreen = () => (
    <div className="flex flex-col h-full" style={{ fontFamily: fontFamilyCss, background: dark ? '#0b1220' : '#f7f8fb' }}>
      <div className="flex-shrink-0 relative z-20"
        style={{
          background: headerBg,
          boxShadow: headerLight ? '0 1px 0 rgba(15,23,42,0.07), 0 4px 12px -8px rgba(15,23,42,0.20)'
                                 : '0 4px 14px -8px rgba(15,23,42,0.45)',
        }}>
        <div className="flex items-center gap-2.5 px-3 py-2.5">
          <button onClick={() => setActiveTab('chat')} className="flex items-center justify-center w-7 h-7 rounded-full flex-shrink-0 transition-all"
            style={{ color: onHeaderMuted, background: 'transparent', ['--wc-hover']: headerHoverBg }}
            onMouseEnter={e => e.currentTarget.style.background = headerHoverBg}
            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
            <ChevronLeft size={17} strokeWidth={2.2}/>
          </button>
          <div className="relative flex-shrink-0">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center overflow-hidden"
              style={{
                background: dark ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0.22)',
                border: headerLight ? 'none' : '1.5px solid rgba(255,255,255,0.35)',
                boxShadow: '0 2px 8px rgba(0,0,0,0.12)',
              }}>
              <AvatarFace px={36}/>
            </div>
            <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-emerald-400 border-2"
              style={{ borderColor: dark ? 'rgba(15,23,42,0.85)' : 'rgba(255,255,255,0.9)' }}/>
          </div>
          <div className="flex-1 min-w-0">
            <p style={{fontSize: fs(12.5), color: onHeader}} className="font-bold leading-tight truncate">
              {cfg.botName || 'ChatBot'}
            </p>
            <p style={{fontSize: fs(9.5), color: onHeaderMuted}} className="leading-tight mt-0.5 truncate">
              {cfg.tagline || 'We reply instantly'}
            </p>
          </div>
          <div className="flex items-center gap-0.5 flex-shrink-0 relative">
            <button title="Minimize" onClick={()=>setMaximized(m=>!m)} className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 transition-colors"
              style={{ color: onHeaderMuted, background: 'transparent', ['--wc-hover']: headerHoverBg }}
              onMouseEnter={e => e.currentTarget.style.background = headerHoverBg}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
              <Minimize2 size={15}/>
            </button>
            <div className="relative" ref={moreRef}>
              <button title="More options" active={moreOpen} onClick={()=>setMoreOpen(o=>!o)}
                className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 transition-colors"
                style={{ color: onHeaderMuted, background: moreOpen ? headerHoverBg : 'transparent', ['--wc-hover']: headerHoverBg }}
                onMouseEnter={e => e.currentTarget.style.background = headerHoverBg}
                onMouseLeave={e => e.currentTarget.style.background = moreOpen ? headerHoverBg : 'transparent'}>
                <MoreHorizontal size={15}/>
              </button>
              {moreOpen && (
                <div className={clsx('absolute right-0 top-9 w-48 rounded-2xl overflow-hidden z-30 text-left border',
                  dark ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200')}
                  style={{ boxShadow:'0 18px 40px -12px rgba(15,23,42,0.35)', animation:'wcMenuIn 0.18s cubic-bezier(0.16,1,0.3,1) both', transformOrigin:'top right' }}>
                  {device !== 'mobile' && (
                    <button onClick={()=>{ setMaximized(m=>!m); setMoreOpen(false) }}
                      className={clsx('w-full flex items-center gap-2.5 px-3.5 py-2.5 text-[11.5px] font-medium transition-colors', dark ? 'text-slate-200 hover:bg-slate-700' : 'text-slate-700 hover:bg-slate-50')}>
                      <Maximize2 size={13}/>{maximized ? 'Restore' : 'Expand'}
                    </button>
                  )}
                  <button onClick={()=>{ setMoreOpen(false) }}
                    className={clsx('w-full flex items-center gap-2.5 px-3.5 py-2.5 text-[11.5px] font-medium transition-colors', dark ? 'text-slate-200 hover:bg-slate-700' : 'text-slate-700 hover:bg-slate-50')}>
                    <Volume2 size={13}/>Unmute
                  </button>
                  <button onClick={()=>{ setMoreOpen(false) }}
                    className={clsx('w-full flex items-center gap-2.5 px-3.5 py-2.5 text-[11.5px] font-medium transition-colors border-t', dark ? 'text-slate-200 hover:bg-slate-700 border-slate-700' : 'text-slate-700 hover:bg-slate-50 border-slate-100')}>
                    <Save size={13}/>Save Transcript
                  </button>
                  <button onClick={()=>{ setScreen('closed'); setMoreOpen(false) }}
                    className={clsx('w-full flex items-center gap-2.5 px-3.5 py-2.5 text-[11.5px] font-medium transition-colors border-t text-red-500', dark ? 'hover:bg-slate-700 border-slate-700' : 'hover:bg-red-50 border-slate-100')}>
                    <X size={13}/>Close Chat
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto wc-scroll p-2.5 space-y-1.5">
        {MOCK_CONVERSATIONS.map((c,i)=>(
          <button key={c.id}
            onClick={()=>{ setOpenConvo(c.id==='ended' ? 'ended' : null); setActiveTab('chat') }}
            className="wc-card w-full flex items-center gap-2.5 p-2.5 text-left"
            style={{ borderRadius: cornerR*0.6, background: dark ? '#1e293b' : '#fff',
              border: dark ? '1px solid #334155' : '1px solid #eef1f6', boxShadow: BUBBLE_SHADOW,
              animation: ANIM==='none' ? 'none' : 'wcSlideIn 0.32s cubic-bezier(0.16,1,0.3,1) both', animationDelay:`${i*70}ms` }}>
            <div className="relative flex-shrink-0">
              <div className="w-9 h-9 rounded-full flex items-center justify-center text-[11px] font-black overflow-hidden" style={{ color: onBrand }}
                style={{ background: c.kind==='bot' ? brandBg : 'linear-gradient(135deg,#F59E0B,#EF4444)' }}>
                {c.kind==='bot' ? <AvatarFace px={36}/> : c.name.slice(0,1)}
              </div>
              <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-emerald-400 border-2" style={{ borderColor: dark ? '#1e293b' : '#fff' }}/>
            </div>
            <div className="flex-1 min-w-0">
              <p style={{fontSize: fs(11.5)}} className={clsx('font-bold truncate', dark ? 'text-slate-100' : 'text-slate-800')}>{c.name}</p>
              <p style={{fontSize: fs(10.5)}} className={clsx('truncate mt-0.5', dark ? 'text-slate-500' : 'text-slate-400')}>{c.preview}</p>
            </div>
            <div className="flex flex-col items-end gap-1 flex-shrink-0">
              <span style={{fontSize: fs(9)}} className={dark ? 'text-slate-600' : 'text-slate-400'}>{c.time}</span>
              {c.unread > 0
                ? <span className="w-4 h-4 rounded-full text-[9px] font-bold flex items-center justify-center" style={{background: cfg.color, color: onBrand, border: brandEdge}}>{c.unread}</span>
                : <CheckCheck size={12} className={dark ? 'text-slate-600' : 'text-slate-300'}/>}
            </div>
          </button>
        ))}
      </div>
      <div className="flex-shrink-0 p-3">
        <button onClick={()=>{ setOpenConvo(null); setActiveTab('chat') }}
          className="wc-chip w-full flex items-center justify-center gap-1.5 font-bold"
          style={{ fontSize: fs(11), padding:'10px 0', borderRadius: cfg.quickReplyStyle==='square' ? cornerR*0.5 : 999,
            background: brandBg, color: onBrand, border: brandEdge, boxShadow: `0 8px 20px -8px ${cfg.color}90` }}>
          <MessageSquare size={13}/> Start a new conversation
        </button>
      </div>
    </div>
  )

  /* ── FAQ screen (optional tab) ── */
  const FAQ_ITEMS = [
    { q:'What are your business hours?', a:"We're online Mon–Fri, 9am–6pm. Outside those hours the bot still answers common questions." },
    { q:'How do I get a refund?', a:'Go to Orders → select the order → Request Refund. Refunds land back in 5–7 business days.' },
    { q:'Do you ship internationally?', a:'Yes — we ship to 40+ countries. Shipping cost is calculated at checkout.' },
  ]
  const FaqScreen = () => {
    return (
      <div className="flex flex-col h-full">
        <div className="flex-shrink-0 relative z-20"
          style={{
            background: headerBg,
            boxShadow: headerLight ? '0 1px 0 rgba(15,23,42,0.07), 0 4px 12px -8px rgba(15,23,42,0.20)'
                                   : '0 4px 14px -8px rgba(15,23,42,0.45)',
          }}>
          <div className="flex items-center gap-2.5 px-3 py-2.5">
            <button onClick={() => setActiveTab('home')} className="flex items-center justify-center w-7 h-7 rounded-full flex-shrink-0 transition-all"
              style={{ color: onHeaderMuted, background: 'transparent', ['--wc-hover']: headerHoverBg }}
              onMouseEnter={e => e.currentTarget.style.background = headerHoverBg}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
              <ChevronLeft size={17} strokeWidth={2.2}/>
            </button>
            <div className="relative flex-shrink-0">
              <div className="w-9 h-9 rounded-xl flex items-center justify-center overflow-hidden"
                style={{
                  background: dark ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0.22)',
                  border: headerLight ? 'none' : '1.5px solid rgba(255,255,255,0.35)',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.12)',
                }}>
                <AvatarFace px={36}/>
              </div>
              <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-emerald-400 border-2"
                style={{ borderColor: dark ? 'rgba(15,23,42,0.85)' : 'rgba(255,255,255,0.9)' }}/>
            </div>
            <div className="flex-1 min-w-0">
              <p style={{fontSize: fs(12.5), color: onHeader}} className="font-bold leading-tight truncate">
                {cfg.botName || 'ChatBot'}
              </p>
              <p style={{fontSize: fs(9.5), color: onHeaderMuted}} className="leading-tight mt-0.5 truncate">
                {cfg.tagline || 'We reply instantly'}
              </p>
            </div>
            <div className="flex items-center gap-0.5 flex-shrink-0 relative">
              <button title="Minimize" onClick={()=>setMaximized(m=>!m)} className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 transition-colors"
                style={{ color: onHeaderMuted, background: 'transparent', ['--wc-hover']: headerHoverBg }}
                onMouseEnter={e => e.currentTarget.style.background = headerHoverBg}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                <Minimize2 size={15}/>
              </button>
              <div className="relative" ref={moreRef}>
                <button title="More options" active={moreOpen} onClick={()=>setMoreOpen(o=>!o)}
                  className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 transition-colors"
                  style={{ color: onHeaderMuted, background: moreOpen ? headerHoverBg : 'transparent', ['--wc-hover']: headerHoverBg }}
                  onMouseEnter={e => e.currentTarget.style.background = headerHoverBg}
                  onMouseLeave={e => e.currentTarget.style.background = moreOpen ? headerHoverBg : 'transparent'}>
                  <MoreHorizontal size={15}/>
                </button>
                {moreOpen && (
                  <div className={clsx('absolute right-0 top-9 w-48 rounded-2xl overflow-hidden z-30 text-left border',
                    dark ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200')}
                    style={{ boxShadow:'0 18px 40px -12px rgba(15,23,42,0.35)', animation:'wcMenuIn 0.18s cubic-bezier(0.16,1,0.3,1) both', transformOrigin:'top right' }}>
                    {device !== 'mobile' && (
                      <button onClick={()=>{ setMaximized(m=>!m); setMoreOpen(false) }}
                        className={clsx('w-full flex items-center gap-2.5 px-3.5 py-2.5 text-[11.5px] font-medium transition-colors', dark ? 'text-slate-200 hover:bg-slate-700' : 'text-slate-700 hover:bg-slate-50')}>
                        <Maximize2 size={13}/>{maximized ? 'Restore' : 'Expand'}
                      </button>
                    )}
                    <button onClick={()=>{ setMoreOpen(false) }}
                      className={clsx('w-full flex items-center gap-2.5 px-3.5 py-2.5 text-[11.5px] font-medium transition-colors', dark ? 'text-slate-200 hover:bg-slate-700' : 'text-slate-700 hover:bg-slate-50')}>
                      <Volume2 size={13}/>Unmute
                    </button>
                    <button onClick={()=>{ setMoreOpen(false) }}
                      className={clsx('w-full flex items-center gap-2.5 px-3.5 py-2.5 text-[11.5px] font-medium transition-colors border-t', dark ? 'text-slate-200 hover:bg-slate-700 border-slate-700' : 'text-slate-700 hover:bg-slate-50 border-slate-100')}>
                      <Save size={13}/>Save Transcript
                    </button>
                    <button onClick={()=>{ setScreen('closed'); setMoreOpen(false) }}
                      className={clsx('w-full flex items-center gap-2.5 px-3.5 py-2.5 text-[11.5px] font-medium transition-colors border-t text-red-500', dark ? 'hover:bg-slate-700 border-slate-700' : 'hover:bg-red-50 border-slate-100')}>
                      <X size={13}/>Close Chat
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
        <div className={clsx('flex-1 overflow-y-auto p-3 space-y-2', dark ? 'bg-slate-900' : 'bg-white')} style={{fontFamily: fontFamilyCss}}>
          {FAQ_ITEMS.map((item,i)=>(
            <div key={item.q} className={clsx('border rounded-xl overflow-hidden', dark ? 'border-slate-700' : 'border-slate-200')}>
              <button onClick={()=>setOpenIdx(openIdx===i?-1:i)}
                className={clsx('w-full flex items-center justify-between px-3 py-2.5 text-left', dark ? 'bg-slate-800' : 'bg-slate-50')}>
                <span style={{fontSize: fs(11.5)}} className={clsx('font-semibold pr-2', dark ? 'text-slate-100' : 'text-slate-700')}>{item.q}</span>
                <ChevronDown size={13} className={clsx('flex-shrink-0 transition-transform', dark ? 'text-slate-500' : 'text-slate-400', openIdx===i && 'rotate-180')}/>
              </button>
              {openIdx===i && (
                <p style={{fontSize: fs(11)}} className={clsx('px-3 py-2.5 leading-relaxed', dark ? 'text-slate-400' : 'text-slate-500')}>{item.a}</p>
              )}
            </div>
          ))}
        </div>
      </div>
    )
  }

  /* ── Booking screen (optional tab) — same realtime date+slot picker ── */
  const BookingScreen = () => (
    <div className="flex flex-col h-full">
      <div className="flex-shrink-0 relative z-20"
        style={{
          background: headerBg,
          boxShadow: headerLight ? '0 1px 0 rgba(15,23,42,0.07), 0 4px 12px -8px rgba(15,23,42,0.20)'
                                 : '0 4px 14px -8px rgba(15,23,42,0.45)',
        }}>
        <div className="flex items-center gap-2.5 px-3 py-2.5">
          <button onClick={() => setActiveTab('home')} className="flex items-center justify-center w-7 h-7 rounded-full flex-shrink-0 transition-all"
            style={{ color: onHeaderMuted, background: 'transparent', ['--wc-hover']: headerHoverBg }}
            onMouseEnter={e => e.currentTarget.style.background = headerHoverBg}
            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
            <ChevronLeft size={17} strokeWidth={2.2}/>
          </button>
          <div className="relative flex-shrink-0">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center overflow-hidden"
              style={{
                background: dark ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0.22)',
                border: headerLight ? 'none' : '1.5px solid rgba(255,255,255,0.35)',
                boxShadow: '0 2px 8px rgba(0,0,0,0.12)',
              }}>
              <AvatarFace px={36}/>
            </div>
            <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-emerald-400 border-2"
              style={{ borderColor: dark ? 'rgba(15,23,42,0.85)' : 'rgba(255,255,255,0.9)' }}/>
          </div>
          <div className="flex-1 min-w-0">
            <p style={{fontSize: fs(12.5), color: onHeader}} className="font-bold leading-tight truncate">
              {cfg.botName || 'ChatBot'}
            </p>
            <p style={{fontSize: fs(9.5), color: onHeaderMuted}} className="leading-tight mt-0.5 truncate">
              Pick a date — available times update instantly
            </p>
          </div>
          <div className="flex items-center gap-0.5 flex-shrink-0 relative">
            <button title="Minimize" onClick={()=>setMaximized(m=>!m)} className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 transition-colors"
              style={{ color: onHeaderMuted, background: 'transparent', ['--wc-hover']: headerHoverBg }}
              onMouseEnter={e => e.currentTarget.style.background = headerHoverBg}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
              <Minimize2 size={15}/>
            </button>
            <div className="relative" ref={moreRef}>
              <button title="More options" active={moreOpen} onClick={()=>setMoreOpen(o=>!o)}
                className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 transition-colors"
                style={{ color: onHeaderMuted, background: moreOpen ? headerHoverBg : 'transparent', ['--wc-hover']: headerHoverBg }}
                onMouseEnter={e => e.currentTarget.style.background = headerHoverBg}
                onMouseLeave={e => e.currentTarget.style.background = moreOpen ? headerHoverBg : 'transparent'}>
                <MoreHorizontal size={15}/>
              </button>
              {moreOpen && (
                <div className={clsx('absolute right-0 top-9 w-48 rounded-2xl overflow-hidden z-30 text-left border',
                  dark ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200')}
                  style={{ boxShadow:'0 18px 40px -12px rgba(15,23,42,0.35)', animation:'wcMenuIn 0.18s cubic-bezier(0.16,1,0.3,1) both', transformOrigin:'top right' }}>
                  {device !== 'mobile' && (
                    <button onClick={()=>{ setMaximized(m=>!m); setMoreOpen(false) }}
                      className={clsx('w-full flex items-center gap-2.5 px-3.5 py-2.5 text-[11.5px] font-medium transition-colors', dark ? 'text-slate-200 hover:bg-slate-700' : 'text-slate-700 hover:bg-slate-50')}>
                      <Maximize2 size={13}/>{maximized ? 'Restore' : 'Expand'}
                    </button>
                  )}
                  <button onClick={()=>{ setMoreOpen(false) }}
                    className={clsx('w-full flex items-center gap-2.5 px-3.5 py-2.5 text-[11.5px] font-medium transition-colors', dark ? 'text-slate-200 hover:bg-slate-700' : 'text-slate-700 hover:bg-slate-50')}>
                    <Volume2 size={13}/>Unmute
                  </button>
                  <button onClick={()=>{ setMoreOpen(false) }}
                    className={clsx('w-full flex items-center gap-2.5 px-3.5 py-2.5 text-[11.5px] font-medium transition-colors border-t', dark ? 'text-slate-200 hover:bg-slate-700 border-slate-700' : 'text-slate-700 hover:bg-slate-50 border-slate-100')}>
                    <Save size={13}/>Save Transcript
                  </button>
                  <button onClick={()=>{ setScreen('closed'); setMoreOpen(false) }}
                    className={clsx('w-full flex items-center gap-2.5 px-3.5 py-2.5 text-[11.5px] font-medium transition-colors border-t text-red-500', dark ? 'hover:bg-slate-700 border-slate-700' : 'hover:bg-red-50 border-slate-100')}>
                    <X size={13}/>Close Chat
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
      <div className={clsx('flex-1 overflow-y-auto p-3', dark ? 'bg-slate-900' : 'bg-white')} style={{fontFamily: fontFamilyCss}}>
        <AppointmentPicker/>
      </div>
    </div>
  )

  /* ── Bottom tab bar — only when FAQ/Booking tabs are enabled ── */
  const TabBar = () => {
    const TABS = [
      ...(cfg.showHomeTab ? [{ k:'home', l:'Home', icon: Home }] : []),
      ...(cfg.showChatTab ? [{ k:'chat', l:'Chat', icon: MessageCircle, badge: 1 }] : []),
      ...(cfg.showMessagesTab ? [{ k:'messages', l:'Inbox', icon: Inbox }] : []),
      ...(cfg.showFaqTab ? [{ k:'faq', l:'Help', icon: HelpCircle }] : []),
      ...(cfg.showBookingTab ? [{ k:'book', l:'Book', icon: CalendarCheck2 }] : []),
    ]
    return (
      <div className={clsx('flex-shrink-0 flex items-stretch gap-0.5 px-1.5 py-1.5',
        dark ? 'bg-slate-900 border-t border-slate-800' : 'bg-white border-t border-slate-100')}>
        {TABS.map(t=>{
          const active = activeTab===t.k
          return (
            <button key={t.k} onClick={()=>setActiveTab(t.k)}
              className="flex-1 flex flex-col items-center gap-0.5 py-1.5 rounded-xl transition-all"
              style={active ? { background: dark ? 'rgba(255,255,255,0.08)' : `${accent}12` } : undefined}>
              <div className="relative">
                <t.icon size={17} strokeWidth={active ? 2.2 : 1.8}
                  style={{ color: active ? accent : undefined }}
                  className={clsx(!active && (dark ? 'text-slate-500' : 'text-slate-400'))}/>
                {!active && t.badge && (
                  <span className="absolute -top-1 -right-1.5 w-3.5 h-3.5 rounded-full bg-red-500 text-white text-[7.5px] font-bold flex items-center justify-center"
                    style={{ border: `2px solid ${dark ? '#0f172a' : '#ffffff'}` }}>{t.badge}</span>
                )}
              </div>
              <span className={clsx('text-[8.5px] font-semibold transition-colors', !active && (dark ? 'text-slate-500' : 'text-slate-400'))}
                style={{ color: active ? accent : undefined }}>
                {t.l}
              </span>
            </button>
          )
        })}
      </div>
    )
  }

  /* The widget renders on its own, centred on the stage — no fake browser chrome or
     dummy website skeleton. Device switching changes the widget's real dimensions —
     mobile renders the true full-bleed phone experience (no rounded corners, safe-area
     padding), tablet/desktop keep the floating rounded window. */
  const isMobile = device === 'mobile'
  const deviceW = isMobile ? 340 : device === 'tablet' ? 372 : winW
  const shellRadius = isMobile ? 0 : cornerR
  /* Trimmed from 620 to 580 (desktop/non-maximized) — combined with the switcher
     row and padding above it, 620 was routinely taller than the actual available
     browser viewport height once tabs/bookmarks/taskbar chrome is subtracted on
     a typical laptop screen, forcing a scroll just to see the rest of the widget
     even with minimal padding. 580 is still a realistic, substantial chat-widget
     height. */
  const shellMaxH = isMobile ? 660 : maximized ? 700 : 580

  return (
    /* items-center is safe here now: the shell's own height is set to 100% of
       this wrapper (capped by maxHeight), so it can never exceed the wrapper's
       actual box — centering only ever has slack to distribute, never an
       over-height child to overflow with. That's what previously made the
       switcher above this stage invisible (it was being centered *over*, not
       just next to); a properly-bounded height makes that class of bug
       impossible rather than just mitigated. */
    <div className="flex items-center justify-center w-full h-full">
      {!isOpen ? (
        /* ── Closed: just the launcher, centred ── */
        <div className="flex flex-col items-center gap-3.5" style={{ animation:'wcLauncherIn 0.4s cubic-bezier(0.16,1,0.3,1) both' }}>
          {cfg.launcherText && (
            <div className="text-[11.5px] font-semibold px-4 py-2.5 rounded-2xl relative"
              style={{ background:'#fff', color:'#0f172a', boxShadow:'0 12px 28px -10px rgba(15,23,42,0.30), 0 2px 6px rgba(15,23,42,0.06)',
                animation:'wcPop 0.45s cubic-bezier(0.16,1,0.3,1) 0.25s both' }}>
              {cfg.launcherText}
              <span className="absolute left-1/2 -translate-x-1/2 -bottom-1 w-2.5 h-2.5 rotate-45 bg-white"/>
            </div>
          )}
          <div className="relative">
            {LAUNCHER_FX[cfg.launcherAnimation]?.rings && (
              <>
                <div className={clsx('absolute inset-0', cfg.launcherShape==='square' ? 'rounded-2xl' : 'rounded-full')}
                  style={{ background: cfg.color, animation:`${LAUNCHER_FX[cfg.launcherAnimation].rings} 2s ease-out infinite` }}/>
                <div className={clsx('absolute inset-0', cfg.launcherShape==='square' ? 'rounded-2xl' : 'rounded-full')}
                  style={{ background: cfg.color, animation:`${LAUNCHER_FX[cfg.launcherAnimation].rings} 2s ease-out 1s infinite` }}/>
              </>
            )}
            {/* Opens the widget for callers that own a `screen` state — the
                embed (WebChatEmbed.jsx) and the Appearance preview. `setScreen`
                falls back to a no-op, so callers without one (the Flow
                Builder's simulator) keep the launcher as pure design preview. */}
            <button onClick={()=>{ setScreen('home'); setActiveTab?.('home') }}
              className={clsx('wc-launcher w-16 h-16 flex items-center justify-center relative overflow-hidden',
              cfg.launcherShape==='square' ? 'rounded-2xl' : 'rounded-full')}
              style={{background: brandBg, border: brandEdge,
                /* The coloured glow is the brand colour itself, so a white brand
                   casts a white glow — invisible. Fall back to a neutral shadow
                   there, which is what actually separates it from the page. */
                boxShadow: brandLight
                  ? '0 10px 26px -6px rgba(15,23,42,0.28), 0 3px 8px -2px rgba(15,23,42,0.16)'
                  : `0 12px 32px -6px ${cfg.color}77, 0 4px 12px -2px rgba(15,23,42,0.18)`,
                animation: LAUNCHER_FX[cfg.launcherAnimation]?.self }}>
              {launcherIconEl}
            </button>
            {/* Sits outside the button's own overflow-hidden (needed to clip an
                uploaded avatar image to the circle) — inside it, this badge was
                being clipped to a sliver instead of showing as a full circle. */}
            <span className="absolute -top-1 -right-1 min-w-[20px] min-h-[20px] rounded-full bg-red-500 border-2 border-white flex items-center justify-center"
              style={{ animation:'wcPop 0.4s cubic-bezier(0.16,1,0.3,1) 0.5s both' }}>
              <span className="text-white text-[10px] font-bold leading-none">1</span>
            </span>
          </div>
          {cfg.autoOpenDelay > 0 && (
            <span className="text-[10px] font-semibold text-slate-500 bg-white px-2.5 py-1 rounded-full shadow-sm">
              Auto-opens in {cfg.autoOpenDelay}s
            </span>
          )}
        </div>
      ) : (
        /* ── Open: the widget itself, fixed and centred ── */
        <div className={clsx('flex flex-col overflow-hidden relative',
            isMobile && 'ring-8 ring-slate-900/90',
            cfg.borderLight && 'wc-lightborder')}
          key={device}
          style={{
            width: deviceW,
            maxWidth: '100%',
            /* height: 100% of its wrapper, capped by maxHeight — not a fixed pixel
               number. The wrapper immediately around <WidgetPreview> is now
               `flex-1 min-h-0`, so it always receives exactly "the stage's real
               height minus the switcher row", with no ambiguity. That makes
               `100%` here genuinely well-defined: on a short viewport the shell
               shrinks to fit (never overflows, never needs a scroll); on a tall
               one it caps at maxHeight and centers within the leftover room. */
            height: '100%',
            maxHeight: shellMaxH,
            borderRadius: isMobile ? 36 : shellRadius,
            background: dark ? '#0b1220' : '#fff',
            /* Resting state of the bloom below, so there is no jump when the
               one-shot animation hands back control. The third layer is the
               ambient one: brand-tinted and very wide, it reads as the panel
               casting light on the page rather than as a drop shadow. */
            boxShadow: `0 32px 70px -16px rgba(15,23,42,0.30), 0 10px 24px -8px rgba(15,23,42,0.14), 0 0 64px -12px ${cfg.color}42`,
            /* Grow out of whichever corner the launcher occupies. */
            transformOrigin: PANEL_ORIGIN[cfg.position] || '100% 100%',
            transition: 'width 0.3s cubic-bezier(0.16,1,0.3,1), height 0.3s cubic-bezier(0.16,1,0.3,1), max-height 0.3s cubic-bezier(0.16,1,0.3,1)',
            animation: 'wcWindowIn 0.46s cubic-bezier(0.16,1,0.3,1) both, wcBloom 1.5s ease-out both',
          }}>
          {isMobile && (
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-24 h-5 bg-slate-900 rounded-b-2xl z-40"/>
          )}
          <div className="flex-1 min-h-0" style={isMobile ? { paddingTop: 14 } : undefined}>
            {/* Called as plain functions, NOT `<HomeScreen/>` etc. — each of
                these is defined fresh on every WidgetPreview render, so
                using them as JSX component types would make React treat
                them as a brand-new component identity every render and
                fully unmount+remount the current screen's entire DOM
                subtree on every keystroke/toggle inside WidgetPreview
                (draft text, mute, menu open, …). That was silently
                resetting scroll position, textarea focus, and in-progress
                animations on every state change. Calling them as functions
                inlines their returned elements directly into this render
                instead, so React reconciles by the real element tree
                (divs etc.) and keeps DOM nodes — and their scroll
                position — stable across re-renders. */}
            {currentScreenKey === 'home' ? HomeScreen()
              : currentScreenKey === 'chat' ? ChatScreen()
              : currentScreenKey === 'messages' ? MessagesScreen()
              : currentScreenKey === 'faq' ? FaqScreen()
              : BookingScreen()}
          </div>
          {tabsEnabled && !simThread && <TabBar/>}
          {/* One shared branding strip for the whole widget, not a copy on every
              screen — sits below the tab bar icons (or below the composer, on
              screens with no tab bar) so it's always the true last line rather
              than competing with the input row for space. */}
          {cfg.showBranding && (
            <div className={clsx('flex-shrink-0 text-center py-1.5', dark ? 'bg-slate-900' : 'bg-white')}>
              {/* Clickable: someone who notices the branding is a prospect, so
                  it opens a "want one of these?" demo-booking form rather than
                  being dead text. See PoweredByDemoModal. */}
              <button onClick={() => setDemoOpen(true)}
                className={clsx('text-[8.5px] transition-colors', dark ? 'text-slate-600 hover:text-slate-400' : 'text-slate-300 hover:text-slate-500')}>
                Powered by <span className={clsx('font-bold', dark ? 'text-slate-500' : 'text-slate-400')}>ChatFlow</span>
              </button>
            </div>
          )}
          {isMobile && (
            <div className={clsx('flex-shrink-0 flex justify-center py-2', dark ? 'bg-slate-900' : 'bg-white')}>
              <span className={clsx('w-28 h-1 rounded-full', dark ? 'bg-slate-700' : 'bg-slate-300')}/>
            </div>
          )}
          {/* Inside the widget frame (which is `relative overflow-hidden`), so
              it overlays the chat and clips to the same rounded corners in
              every host — builder preview, popup simulator, Live Preview and
              the hosted landing page alike. */}
          <PoweredByDemoModal open={demoOpen} onClose={() => setDemoOpen(false)}
            cfg={cfg} brandBg={brandBg} dark={dark}/>
        </div>
      )}

      <style>{`
        /* ── Entrance animations ── */
        @keyframes wcSlideIn { from { opacity:0; transform: translateY(10px) } to { opacity:1; transform:none } }
        @keyframes wcFade    { from { opacity:0 } to { opacity:1 } }
        @keyframes wcPop     { from { opacity:0; transform: scale(0.9) translateY(6px) } to { opacity:1; transform:none } }
        @keyframes wcMenuIn  { from { opacity:0; transform: scale(0.94) translateY(-4px) } to { opacity:1; transform:none } }
        /* The panel grows OUT OF the launcher rather than appearing over it —
           transform-origin is set inline from cfg.position, so the corner it
           expands from is always the corner the launcher sits in. The slight
           overshoot at 78% is what stops it reading as a linear zoom. */
        @keyframes wcWindowIn{
          0%   { opacity:0; transform: translateY(16px) scale(0.86) }
          78%  { opacity:1; transform: translateY(0)    scale(1.012) }
          100% { opacity:1; transform:none }
        }
        @keyframes wcLauncherIn { from { opacity:0; transform: scale(0.6) } to { opacity:1; transform:none } }

        /* ── Ambient lighting ──
           A one-shot bloom as the widget "turns on": brand light swells out of
           the panel onto the page behind it, then settles to a resting glow.
           Deliberately a bloom and not an infinite pulse — a box that breathes
           forever in the corner of someone's site is a distraction, whereas the
           drifting colour field in the header (below) reads as alive without
           ever asking for attention. */
        @keyframes wcBloom {
          0%   { box-shadow: 0 32px 70px -16px rgba(15,23,42,0.30), 0 10px 24px -8px rgba(15,23,42,0.14), 0 0 0px -12px ${cfg.color}00 }
          45%  { box-shadow: 0 32px 70px -16px rgba(15,23,42,0.30), 0 10px 24px -8px rgba(15,23,42,0.14), 0 0 110px -10px ${cfg.color}7a }
          100% { box-shadow: 0 32px 70px -16px rgba(15,23,42,0.30), 0 10px 24px -8px rgba(15,23,42,0.14), 0 0 64px -12px ${cfg.color}42 }
        }

        /* The header's decorative circles drift on different periods, so the
           colour field behind the greeting never sits still or visibly loops. */
        @keyframes wcAurora1 { 0%,100%{transform:translate3d(0,0,0) scale(1)}   50%{transform:translate3d(-18px,12px,0) scale(1.22)} }
        @keyframes wcAurora2 { 0%,100%{transform:translate3d(0,0,0) scale(1)}   50%{transform:translate3d(14px,-16px,0) scale(0.82)} }
        @keyframes wcAurora3 { 0%,100%{transform:translate3d(0,0,0) scale(1)}   50%{transform:translate3d(22px,-8px,0) scale(1.35)} }

        /* One-shot specular sweep — a highlight travelling across the header as
           the panel opens, the way light crosses a piece of glass being turned. */
        @keyframes wcSheen {
          0%   { transform: translateX(-140%) skewX(-18deg); opacity:0 }
          14%  { opacity:1 }
          100% { transform: translateX(340%)  skewX(-18deg); opacity:0 }
        }

        /* Content arrives just behind the shell, in sequence, so the widget
           assembles itself instead of snapping in fully formed. */
        @keyframes wcRise { from { opacity:0; transform: translateY(10px) } to { opacity:1; transform:none } }

        /* ── Multi-colour border lighting ──
           A conic gradient rotating around the panel's edge. Registering the
           angle as a real <angle> custom property is what makes it animate at
           all: a plain CSS variable is just a string, so the browser has
           nothing to interpolate and the gradient would jump from 0 to 360
           rather than sweep. Browsers without @property support still get the
           gradient, just holding still — a static multi-colour edge, which is
           a perfectly reasonable place to land rather than a broken one.

           The colours start and end on the merchant's own brand so the sweep
           returns home instead of showing a seam where the gradient wraps. */
        @property --wc-angle { syntax: '<angle>'; initial-value: 0deg; inherits: false; }
        @keyframes wcBorderSpin { to { --wc-angle: 360deg } }

        /* ── Ambient loops ── */
        @keyframes bounce    { 0%,60%,100%{transform:translateY(0)} 30%{transform:translateY(-4px)} }
        @keyframes wcDot     { 0%,60%,100%{transform:translateY(0); opacity:0.4} 30%{transform:translateY(-4px); opacity:1} }
        @keyframes wcPresence{ 0%,100%{transform:scale(1); opacity:1} 50%{transform:scale(1.18); opacity:0.75} }
        @keyframes wcRec     { 0%,100%{box-shadow:0 0 0 0 rgba(239,68,68,0.45)} 70%{box-shadow:0 0 0 7px rgba(239,68,68,0)} }
        @keyframes wcRing    { 0%{transform:scale(1); opacity:0.5} 100%{transform:scale(1.7); opacity:0} }
        @keyframes wcRipple  { 0%{transform:scale(1); opacity:0.55} 70%{opacity:0.12} 100%{transform:scale(2.1); opacity:0} }
        @keyframes wcGlow    { 0%,100%{box-shadow:0 12px 32px -6px ${cfg.color}77, 0 0 0 0 ${cfg.color}55}
                               50%{box-shadow:0 12px 32px -6px ${cfg.color}99, 0 0 0 10px ${cfg.color}00} }
        @keyframes wcLaunchBounce { 0%,72%,100%{transform:translateY(0)} 80%{transform:translateY(-9px)} 90%{transform:translateY(-4px)} }
        @keyframes wcHeartbeat{ 0%,55%,100%{transform:scale(1)} 62%{transform:scale(1.11)} 70%{transform:scale(1)} 78%{transform:scale(1.07)} }
        @keyframes wcWobble  { 0%,80%,100%{transform:rotate(0)} 84%{transform:rotate(-9deg)} 88%{transform:rotate(7deg)} 92%{transform:rotate(-4deg)} 96%{transform:rotate(2deg)} }
        @keyframes wcSwing   { 0%,70%,100%{transform:rotate(0)} 78%{transform:rotate(11deg)} 86%{transform:rotate(-8deg)} 94%{transform:rotate(3deg)} }
        @keyframes wcJelly   { 0%,60%,100%{transform:scale(1,1)} 68%{transform:scale(1.14,0.86)} 76%{transform:scale(0.9,1.1)} 86%{transform:scale(1.04,0.96)} }

        /* ── Micro-interactions ── */
        .wc-bubble { transition: transform .18s cubic-bezier(.16,1,.3,1), box-shadow .18s ease; }
        .wc-bubble:hover { transform: translateY(-1px); }

        .wc-chip { cursor:pointer; transition: transform .16s cubic-bezier(.16,1,.3,1), box-shadow .16s ease, background .16s ease, border-color .16s ease; }
        .wc-chip:hover { transform: translateY(-2px); box-shadow: 0 6px 14px -6px rgba(15,23,42,.30); }
        .wc-chip:active { transform: translateY(0) scale(.96); }

        .wc-card { cursor:pointer; transition: transform .2s cubic-bezier(.16,1,.3,1), box-shadow .2s ease; }
        .wc-card:hover { transform: translateY(-3px); box-shadow: 0 14px 26px -12px rgba(15,23,42,.28); }
        .wc-cardbtn { transition: filter .16s ease, transform .16s ease; }
        .wc-cardbtn:hover { filter: brightness(1.08); }
        .wc-cardbtn:active { transform: scale(.96); }

        /* Header + composer icon buttons: one class, colors handed in per-theme. */
        .wc-hbtn { transition: background .18s ease, color .18s ease, transform .18s ease; }
        .wc-hbtn:hover { background: var(--wc-hover) !important; color: var(--wc-on) !important; }
        .wc-hbtn:active { transform: scale(.9); }
        .wc-close:hover { transform: rotate(90deg); }

        .wc-ibtn { width:30px; height:30px; border-radius:9999px; display:flex; align-items:center;
                   justify-content:center; flex-shrink:0; transition: background .18s ease, color .18s ease, transform .18s ease; }
        .wc-ibtn:hover { background: var(--wc-hover); }
        .wc-ibtn:active { transform: scale(.9); }
        .wc-ibtn-emoji:hover { color:#f59e0b !important; transform: scale(1.12); }

        .wc-send { transition: transform .18s cubic-bezier(.16,1,.3,1), filter .18s ease; }
        .wc-send:hover { transform: scale(1.08) rotate(-8deg); filter: brightness(1.06); }
        .wc-send:active { transform: scale(.92); }

        .wc-composer:focus-within { border-color: ${cfg.color} !important; box-shadow: 0 0 0 3px ${cfg.color}22; }

        .wc-launcher { transition: transform .24s cubic-bezier(.16,1,.3,1), box-shadow .24s ease; }
        .wc-launcher:hover { transform: scale(1.07) translateY(-2px); }
        .wc-launcher:active { transform: scale(.94); }

        /* The ring lives INSIDE the panel at inset 0, not outside it: the
           panel is overflow:hidden (it has to be, to clip the header band and
           the rounded corners), so anything at a negative inset would simply
           be cut off. The mask trick punches the middle out of a filled
           rounded rect, leaving only a padding-thick band at the very edge.
           Above the content and pointer-events:none, so it draws over the
           header without ever swallowing a click. */
        .wc-lightborder::before {
          content: '';
          position: absolute;
          inset: 0;
          border-radius: inherit;
          padding: ${BORDER_LIGHT_PX}px;
          background: conic-gradient(from var(--wc-angle),
            ${cfg.color}, ${cfg.colorEnd || '#8B5CF6'}, #22d3ee, #34d399, #facc15, #fb7185, ${cfg.color});
          -webkit-mask: linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0);
          -webkit-mask-composite: xor;
          mask: linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0);
          mask-composite: exclude;
          animation: wcBorderSpin ${BORDER_LIGHT_SECONDS}s linear infinite;
          pointer-events: none;
          z-index: 30;
        }

        /* ── Opening choreography ── */
        .wc-sheen { animation: wcSheen 1.25s cubic-bezier(.3,0,.2,1) .16s both; }
        .wc-aurora-1 { animation: wcAurora1 11s ease-in-out infinite; }
        .wc-aurora-2 { animation: wcAurora2 14s ease-in-out infinite; }
        .wc-aurora-3 { animation: wcAurora3  9s ease-in-out infinite; }

        /* Cascade: each direct child enters one beat after the last. The shell
           lands at ~0.46s, so the first child starts just before it settles and
           the whole sequence is done inside ~0.75s — long enough to read as
           deliberate, short enough that nobody waits for it. */
        .wc-stagger > * { animation: wcRise .40s cubic-bezier(.16,1,.3,1) both; }
        .wc-stagger > *:nth-child(1) { animation-delay: .20s }
        .wc-stagger > *:nth-child(2) { animation-delay: .26s }
        .wc-stagger > *:nth-child(3) { animation-delay: .32s }
        .wc-stagger > *:nth-child(4) { animation-delay: .38s }
        .wc-stagger > *:nth-child(5) { animation-delay: .44s }
        .wc-stagger > *:nth-child(6) { animation-delay: .50s }
        .wc-stagger > *:nth-child(n+7) { animation-delay: .56s }

        /* ── Slim scrollbars, like real widgets ── */
        .wc-scroll { scrollbar-width: thin; scrollbar-color: ${dark ? '#334155' : '#d8dee9'} transparent; }
        .wc-scroll::-webkit-scrollbar { width:5px; height:5px }
        .wc-scroll::-webkit-scrollbar-thumb { background:${dark ? '#334155' : '#d8dee9'}; border-radius:3px }
        .wc-scroll::-webkit-scrollbar-track { background:transparent }

        @media (prefers-reduced-motion: reduce) {
          .wc-bubble, .wc-chip, .wc-card, .wc-send, .wc-launcher { transition: none !important; }
          /* Everything the opening choreography adds is decoration, so none of
             it survives here: the drifting field and the light sweep stop
             outright, and the cascade collapses to "already in place" rather
             than a faster version of itself. */
          .wc-aurora-1, .wc-aurora-2, .wc-aurora-3 { animation: none !important; }
          .wc-sheen { display: none !important; }
          .wc-stagger > * { animation: none !important; }
          /* The ring stays — it is a colour, not a motion. Only the sweep goes. */
          .wc-lightborder::before { animation: none !important; }
        }
      `}</style>
    </div>
  )
}

/* ─── Builder Tab ─────────────────────────────────────────────── */
const GRADIENT_PRESETS = [
  ['#0066ff','#8B5CF6'], ['#EC4899','#F59E0B'], ['#10B981','#06B6D4'],
  ['#8B5CF6','#EC4899'], ['#1D4ED8','#06B6D4'], ['#EF4444','#EC4899'],
]

function SwatchGrid({ value, onChange, label }) {
  return (
    <div>
      <label className="label text-[10.5px]">{label}</label>
      {/* Fixed-size swatches that wrap, not a grid stretched edge-to-edge — small
          and left-aligned, with real whitespace on the right instead of forcing
          9 columns to fill the full column width. */}
      <div className="flex flex-wrap gap-1.5 mt-1.5">
        {COLORS.map(c=>(
          <button key={c} onClick={()=>onChange(c)}
            className="w-5 h-5 rounded-full transition-all flex-shrink-0"
            style={{background:c, boxShadow: value===c ? `0 0 0 2px white, 0 0 0 3px ${c}` : 'none'}}/>
        ))}
        <label className="w-5 h-5 rounded-full border-2 border-dashed border-slate-300 flex items-center justify-center cursor-pointer hover:border-slate-400 flex-shrink-0">
          <Plus size={9} className="text-slate-400"/>
          <input type="color" value={value} onChange={e=>onChange(e.target.value)} className="sr-only"/>
        </label>
      </div>
    </div>
  )
}

/* A row of larger preview swatches, all on one line regardless of option count —
   for choices best judged visually (bubble shape, corner style) rather than by
   reading labels. The selected option's name shows once, above the row. */
function SwatchRow({ label, value, onChange, options }) {
  const selected = options.find(o => o.v === value)
  return (
    <div>
      <div className="flex items-center justify-between">
        <label className="label mb-0">{label}</label>
        {selected && <span className="text-[10px] font-semibold text-primary">{selected.l}</span>}
      </div>
      <div className="grid gap-1 mt-1" style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}>
        {options.map(o=>(
          <button key={o.v} onClick={()=>onChange(o.v)} title={o.l}
            className={clsx('h-8 rounded-md border-2 flex items-center justify-center transition-all',
              value===o.v ? 'border-primary bg-primary/5' : 'border-surface-border hover:border-slate-300')}>
            {o.swatch}
          </button>
        ))}
      </div>
    </div>
  )
}

/* A plain dropdown for a long list of named options — cheaper to scan than a
   grid of buttons once there are more than a handful of choices. */
/* A small "i" glyph carrying an explanation as a native hover tooltip — the
   compact alternative to an always-visible caption under every control. */
function InfoTip({ text }) {
  if (!text) return null
  return (
    <span title={text} tabIndex={0}
      className="inline-flex items-center justify-center w-3.5 h-3.5 rounded-full text-slate-300 hover:text-slate-500 focus:text-slate-500 cursor-help flex-shrink-0 outline-none">
      <Info size={12}/>
    </span>
  )
}

function NativeSelect({ value, onChange, options }) {
  return (
    <div className="relative mt-1">
      <select value={value} onChange={e=>onChange(e.target.value)} className="select pr-8">
        {options.map(o=><option key={o.v} value={o.v}>{o.l}</option>)}
      </select>
      <ChevronDown size={13} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"/>
    </div>
  )
}

/* A single sliding-pill segmented control — the same pattern already used by
   the Screen/Device switcher in the panel header. One shared track instead of
   N separately-bordered buttons reads as one modern control, not a grid of boxes. */
/* Independent outlined chips, not a shared grey track — each option is its own
   pill, the selected one fills solid instead of sliding a highlight around a
   background bar. Reads as a set of choices rather than a single boxed control. */
/* Top-level group navigation — an even grid, always exactly one row, so it
   reads as primary navigation rather than a row of filter chips that can wrap
   onto a second line depending on width. */
function GroupNav({ value, onChange, options }) {
  return (
    <div className="grid gap-1.5" style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}>
      {options.map(o=>(
        <button key={o.v} onClick={()=>onChange(o.v)}
          className={clsx('flex flex-col items-center justify-center gap-1 py-2 rounded-lg border text-[10.5px] font-semibold transition-all',
            value===o.v
              ? 'border-slate-400 bg-slate-200 text-slate-900'
              : 'border-surface-border bg-white text-slate-500 hover:border-slate-300 hover:bg-slate-50')}>
          <o.icon size={14}/>
          {o.l}
        </button>
      ))}
    </div>
  )
}

function Segmented({ value, onChange, options }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map(o=>(
        <button key={o.v} onClick={()=>onChange(o.v)}
          className={clsx('flex items-center gap-1.5 px-2.5 py-1.5 rounded-full border text-[10.5px] font-semibold transition-all',
            value===o.v
              ? 'border-slate-400 bg-slate-200 text-slate-900'
              : 'border-surface-border bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50')}>
          {o.icon && <o.icon size={11}/>}
          {o.swatch}
          {o.l}
        </button>
      ))}
    </div>
  )
}

/* Visual quadrant picker for the launcher's screen corner — a compact live
   mini-map is faster to read than four text buttons, and doubles as a preview. */
function PositionPicker({ value, onChange }) {
  const CORNERS = [
    { v:'top-left',     style:{ top:6, left:6 } },
    { v:'top-right',    style:{ top:6, right:6 } },
    { v:'bottom-left',  style:{ bottom:6, left:6 } },
    { v:'bottom-right', style:{ bottom:6, right:6 } },
  ]
  return (
    <div className="relative w-full h-16 rounded-lg bg-slate-50 border border-surface-border overflow-hidden">
      <div className="absolute inset-2 rounded-md border border-dashed border-slate-200"/>
      {CORNERS.map(c=>(
        <button key={c.v} onClick={()=>onChange(c.v)} title={c.v.replace('-',' ')}
          className={clsx('absolute w-5 h-5 rounded-md flex items-center justify-center border-2 transition-all',
            value===c.v ? 'border-primary bg-primary shadow-sm' : 'border-surface-border bg-white hover:border-slate-300')}
          style={c.style}>
          <MessageCircleMore size={10} className={value===c.v ? 'text-white' : 'text-slate-300'}/>
        </button>
      ))}
    </div>
  )
}

function PillGroup({ value, onChange, options, cols = 3 }) {
  return (
    <div className={clsx('grid gap-1.5', cols===2 ? 'grid-cols-2' : cols===4 ? 'grid-cols-4' : 'grid-cols-3')}>
      {options.map(o=>(
        <button key={o.v} onClick={()=>onChange(o.v)}
          className={clsx('py-2 px-2 rounded-lg border text-[11px] font-semibold transition-all flex flex-col items-center gap-1',
            value===o.v ? 'border-primary bg-primary/5 text-primary' : 'border-surface-border text-slate-600 hover:border-slate-300')}>
          {o.icon && <o.icon size={13}/>}
          {o.swatch}
          <span className="leading-none">{o.l}</span>
        </button>
      ))}
    </div>
  )
}

/* 7 swatches + the Auto swatch + the custom picker = 9 — one full row in the
   same grid-cols-9 layout SwatchGrid uses for Primary Color, so every color
   control in the builder reads as the same control. */
const BUBBLE_COLORS = ['#ffffff','#f1f5f9','#0f172a','#1e293b','#fef3c7','#fee2e2']

/* ─── Shared config controls ──────────────────────────────────── */

/* Reads a picked image straight into a data URL — this app is fully mocked, so
   there's no upload endpoint; the data URL is what the preview renders. */
function ImageUploadField({ label, hint, value, onChange, rounded = true }) {
  const [err, setErr] = useState('')
  function pick(e) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    if (!/^image\//.test(file.type)) { setErr('Pick an image file (PNG, JPG, SVG, WebP).'); return }
    if (file.size > 2 * 1024 * 1024) { setErr('Image must be under 2 MB.'); return }
    setErr('')
    const reader = new FileReader()
    reader.onload = () => onChange(String(reader.result))
    reader.readAsDataURL(file)
  }
  return (
    <div>
      <label className="label flex items-center gap-1.5">{label}<InfoTip text={hint}/></label>
      <div className="flex items-center gap-2.5 mt-1.5">
        <div className={clsx('w-12 h-12 flex-shrink-0 overflow-hidden border border-surface-border bg-slate-50 flex items-center justify-center',
          rounded ? 'rounded-full' : 'rounded-lg')}>
          {value
            ? <img src={value} alt="" className="w-full h-full object-cover"/>
            : <Image size={16} className="text-slate-300"/>}
        </div>
        <div className="flex-1 min-w-0 space-y-1">
          <label className="w-full flex items-center justify-center gap-1.5 py-1.5 rounded-lg border border-surface-border bg-white text-slate-600 text-[11px] font-semibold hover:bg-surface-hover cursor-pointer transition-colors">
            <ImagePlus size={12}/> {value ? 'Replace image' : 'Upload image'}
            <input type="file" accept="image/*" onChange={pick} className="sr-only"/>
          </label>
          {value && (
            <button onClick={()=>{ onChange(''); setErr('') }}
              className="w-full flex items-center justify-center gap-1.5 py-1.5 rounded-lg border border-surface-border bg-white text-red-500 text-[11px] font-semibold hover:bg-red-50 transition-colors">
              <Trash2 size={12}/> Remove
            </button>
          )}
        </div>
      </div>
      {err && <p className="text-[10px] text-red-500 mt-1.5">{err}</p>}
    </div>
  )
}

/* Same swatch-row UI as the Primary Color control (SwatchGrid) — one line of
   circular swatches with a ring on the selected one. "Auto" (inherit the theme
   default) sits at the front; an optional "sync" preset — a live preview of
   another color the field can lock onto, e.g. the header color — sits right
   after it. Always fits one row: the grid's column count adapts to whether
   sync is present. Explanations live in the info-tip next to the label, not
   as a caption underneath. */
function ColorField({ label, value, onChange, autoLabel = 'Auto', hint, sync }) {
  const isAuto = !value
  const isSynced = sync && value === sync.value
  const isCustom = !isAuto && !isSynced && !BUBBLE_COLORS.includes(value)
  return (
    <div>
      <div className="flex items-center gap-1.5">
        <label className="label mb-0 text-[10.5px]">{label}</label>
        <InfoTip text={hint}/>
        {!isAuto && (
          <button onClick={()=>onChange('')} className="ml-auto text-[9.5px] font-semibold text-slate-400 hover:text-slate-600">
            Reset
          </button>
        )}
      </div>
      {/* Small fixed-size swatches that wrap and stop — not a grid stretched to
          fill the column, so there's real margin after the last one. */}
      <div className="flex flex-wrap gap-1.5 mt-1.5">
        <button onClick={()=>onChange('')} title={autoLabel}
          className={clsx('w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all flex-shrink-0',
            isAuto ? 'border-primary bg-primary/5' : 'border-dashed border-slate-300 hover:border-slate-400')}>
          <Wand2 size={9} className={isAuto ? 'text-primary' : 'text-slate-400'}/>
        </button>
        {sync && (
          <button onClick={()=>onChange(sync.value)} title={sync.label}
            className="w-5 h-5 rounded-full flex items-center justify-center transition-all flex-shrink-0"
            style={{ background: sync.previewColor,
              boxShadow: isSynced ? `0 0 0 2px white, 0 0 0 3px ${sync.previewColor}` : 'none',
              border: isSynced ? 'none' : '1px solid rgba(0,0,0,0.08)' }}>
            <LinkIcon size={8} className="text-white" style={{ filter:'drop-shadow(0 1px 1px rgba(0,0,0,0.35))' }}/>
          </button>
        )}
        {BUBBLE_COLORS.map(c=>(
          <button key={c} onClick={()=>onChange(c)} title={c}
            className="w-5 h-5 rounded-full transition-all flex-shrink-0"
            style={{ background:c, border: c==='#ffffff' ? '1px solid #e2e8f0' : 'none',
              boxShadow: value===c ? `0 0 0 2px white, 0 0 0 3px ${c === '#ffffff' ? '#94a3b8' : c}` : 'none' }}/>
        ))}
        <label className="w-5 h-5 rounded-full border-2 border-dashed border-slate-300 flex items-center justify-center cursor-pointer hover:border-slate-400 relative overflow-hidden flex-shrink-0"
          style={isCustom ? { background: value, borderStyle:'solid', borderColor: 'transparent' } : undefined}>
          {!isCustom && <Plus size={9} className="text-slate-400"/>}
          {isCustom && (
            <span className="absolute inset-0 flex items-center justify-center" style={{ boxShadow: `0 0 0 2px white, 0 0 0 3px ${value}` }}/>
          )}
          <input type="color" value={value || '#ffffff'} onChange={e=>onChange(e.target.value)} className="sr-only"/>
        </label>
      </div>
    </div>
  )
}

/* Searchable Google Fonts picker — filters the catalog as you type, groups by
   category, and loads each visible family so the list previews in its own face. */
function FontSearchSelect({ value, onChange }) {
  const [open, setOpen] = useState(false)
  const [q, setQ] = useState('')
  const [cat, setCat] = useState('All')
  useGoogleFont(value)

  const matches = GOOGLE_FONTS.filter(f =>
    (cat === 'All' || f.cat === cat) &&
    f.name.toLowerCase().includes(q.trim().toLowerCase())
  )
  const visible = matches.slice(0, 40)

  return (
    <div className="relative">
      <button onClick={()=>{ setOpen(o=>!o); setQ('') }}
        className="input mt-1 w-full flex items-center justify-between gap-2 text-left"
        style={{ fontFamily: fontStack(value) }}>
        <span className="truncate">{value || 'System Default'}</span>
        <ChevronDown size={13} className={clsx('text-slate-400 flex-shrink-0 transition-transform', open && 'rotate-180')}/>
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-20" onClick={()=>setOpen(false)}/>
          <div className="absolute left-0 right-0 top-full mt-1 z-30 bg-white border border-surface-border rounded-xl shadow-xl overflow-hidden"
            style={{ animation:'wcMenuIn 0.16s cubic-bezier(0.16,1,0.3,1) both' }}>
            <div className="p-2 border-b border-surface-border">
              <div className="relative">
                <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400"/>
                <input autoFocus value={q} onChange={e=>setQ(e.target.value)}
                  placeholder={`Search ${GOOGLE_FONTS.length} Google Fonts…`}
                  className="input-sm w-full pl-7"/>
              </div>
              <div className="flex gap-1 mt-1.5 overflow-x-auto wc-scroll pb-0.5">
                {FONT_CATEGORIES.map(c=>(
                  <button key={c} onClick={()=>setCat(c)}
                    className={clsx('px-2 py-1 rounded-md text-[10px] font-semibold whitespace-nowrap flex-shrink-0 transition-colors',
                      cat===c ? 'bg-primary text-white' : 'bg-slate-100 text-slate-500 hover:bg-slate-200')}>
                    {c}
                  </button>
                ))}
              </div>
            </div>
            <div className="max-h-56 overflow-y-auto wc-scroll">
              {visible.length === 0 && <p className="px-3 py-4 text-[11px] text-slate-400 text-center">No fonts match “{q}”.</p>}
              {visible.map(f=>(
                <FontOption key={f.name} font={f} selected={f.name===value}
                  onPick={()=>{ onChange(f.name); setOpen(false) }}/>
              ))}
              {matches.length > visible.length && (
                <p className="px-3 py-2 text-[10px] text-slate-400 text-center border-t border-surface-border">
                  {matches.length - visible.length} more — keep typing to narrow it down
                </p>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  )
}

/* One row of the font list — loads its own family so the name renders in it. */
function FontOption({ font, selected, onPick }) {
  useGoogleFont(font.name)
  return (
    <button onClick={onPick}
      className={clsx('w-full flex items-center justify-between gap-2 px-3 py-2 text-left transition-colors',
        selected ? 'bg-primary-50' : 'hover:bg-surface-hover')}>
      <span className="truncate text-[13px] text-slate-700" style={{ fontFamily: fontStack(font.name) }}>{font.name}</span>
      <span className="flex items-center gap-1.5 flex-shrink-0">
        <span className="text-[9px] text-slate-400">{font.cat}</span>
        {selected && <Check size={12} className="text-primary"/>}
      </span>
    </button>
  )
}

const THEME_GROUPS = [
  { id:'colors', label:'Colors',   icon:Palette },
  { id:'shape',  label:'Shape',    icon:Layers },
  { id:'launch', label:'Launcher', icon:Zap },
  { id:'type',   label:'Type',     icon:Type },
]

function BuilderSectionBody({ section, cfg, set, setScreen, setScrollToQType, qCat, setQCat }) {
  /* Mirrors WidgetPreview's own headerBaseColor calc, so the "sync with header"
     swatch previews the real color instead of guessing. */
  const headerPreviewColor = cfg.headerMode === 'custom' ? (cfg.headerColor || cfg.color)
    : cfg.headerMode === 'brand' ? cfg.color
    : (cfg.theme === 'dark' ? '#0f172a' : '#ffffff')

  const [themeGroup, setThemeGroup] = useState('colors')
  const filteredQ = qCat==='All' ? QUESTION_TYPES : QUESTION_TYPES.filter(q=>q.cat===qCat)
  const LauncherIconCmp = LAUNCHER_ICON_MAP[cfg.launcherIcon] || MessageCircleMore

  return (
    <>
        {/* Theme */}
        {section==='theme' && (
          <div>
            {/* ── Group switcher — a 4-column grid that's always one row, so it
                 reads as the primary navigation for this tab. ── */}
            <div className="mb-4">
              <GroupNav value={themeGroup} onChange={setThemeGroup}
                options={THEME_GROUPS.map(g=>({ v:g.id, l:g.label, icon:g.icon }))}/>
            </div>

            {/* ── Colors ───────────────────────────────────────────── */}
            {themeGroup==='colors' && (
              <div className="space-y-4">
                <div>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-1.5">Brand</p>
                  <div className="space-y-2">
                    <Segmented value={cfg.colorMode} onChange={v=>set('colorMode',v)}
                      options={[{v:'solid',l:'Solid'},{v:'gradient',l:'Gradient',icon:Sparkles}]}/>
                    <SwatchGrid label="Primary Color" value={cfg.color} onChange={v=>set('color',v)}/>
                    {cfg.colorMode==='gradient' && (
                      <div>
                        <SwatchGrid label="Gradient End Color" value={cfg.colorEnd} onChange={v=>set('colorEnd',v)}/>
                        <div className="grid grid-cols-6 gap-1 mt-1.5">
                          {GRADIENT_PRESETS.map(([a,b])=>(
                            <button key={a+b} onClick={()=>{set('color',a); set('colorEnd',b)}}
                              className="w-full h-5 rounded ring-1 ring-slate-200 hover:ring-slate-300 transition-all"
                              style={{background:`linear-gradient(135deg, ${a}, ${b})`}}/>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                <div className="border-t border-surface-border"/>

                <div>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-1.5 flex items-center gap-1">
                    Header <InfoTip text="Text and controls flip between dark and light automatically based on the color you pick."/>
                  </p>
                  <div className="space-y-2">
                    <Segmented value={cfg.headerMode} onChange={v=>set('headerMode',v)}
                      options={[
                        {v:'surface', l:'Light',  swatch:<div className="w-4 h-4 bg-white border border-slate-300 rounded-full"/>},
                        {v:'brand',   l:'Brand',  swatch:<div className="w-4 h-4 rounded-full" style={{background:`linear-gradient(135deg, ${cfg.color}, ${cfg.colorEnd||cfg.color})`}}/>},
                        {v:'custom',  l:'Custom', swatch:<div className="w-4 h-4 rounded-full" style={{background: cfg.headerGradient ? `linear-gradient(135deg, ${cfg.headerColor}, ${cfg.headerColorEnd})` : cfg.headerColor}}/>},
                      ]}/>
                    {cfg.headerMode==='custom' && (
                      <div className="space-y-2 pl-2.5 border-l-2 border-primary/15">
                        <SwatchGrid label="Header Color" value={cfg.headerColor} onChange={v=>set('headerColor',v)}/>
                        <div className="flex items-center justify-between">
                          <p className="text-xs font-medium text-slate-700 flex items-center gap-1.5">Gradient
                            <InfoTip text="Blend into a second color"/>
                          </p>
                          <Toggle checked={cfg.headerGradient} onChange={v=>set('headerGradient',v)}/>
                        </div>
                        {cfg.headerGradient && (
                          <SwatchGrid label="Header Gradient End" value={cfg.headerColorEnd} onChange={v=>set('headerColorEnd',v)}/>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                <div className="border-t border-surface-border"/>

                <div>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-1.5">Message Bubbles</p>
                  <div className="space-y-2.5">
                    <ColorField label="Question Bubble Background" value={cfg.botBubbleBg} onChange={v=>set('botBubbleBg',v)}
                      hint="Auto = white on light themes, slate on dark. Sync = matches your header color."
                      sync={{ label:'Sync with header', value:'header', previewColor: headerPreviewColor }}/>
                    <ColorField label="Question Text Color" value={cfg.botBubbleText} onChange={v=>set('botBubbleText',v)}
                      hint="Auto picks black or white — whichever reads on the bubble color."/>
                    <div className="h-px bg-surface-border"/>
                    <ColorField label="Answer Bubble Background" value={cfg.userBubbleBg} onChange={v=>set('userBubbleBg',v)}
                      autoLabel="Brand" hint="Brand = uses your primary color / gradient. Sync = matches your header color."
                      sync={{ label:'Sync with header', value:'header', previewColor: headerPreviewColor }}/>
                    <ColorField label="Answer Text Color" value={cfg.userBubbleText} onChange={v=>set('userBubbleText',v)}
                      hint="Auto picks black or white — whichever reads on the bubble color."/>
                  </div>
                </div>

                <div className="border-t border-surface-border"/>

                <div>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-1.5">Chat Background</p>
                  <ColorField label="Behind the Messages" value={cfg.chatBackground} onChange={v=>set('chatBackground',v)}
                    hint="Auto = light gray on light themes, near-black on dark. Sync = a soft tint of your header color."
                    sync={{ label:'Sync with header', value:'header', previewColor: headerPreviewColor }}/>
                </div>
              </div>
            )}

            {/* ── Shape & Style ────────────────────────────────────── */}
            {themeGroup==='shape' && (
              <div className="space-y-4">
                <div>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-1.5">Window</p>
                  <div className="space-y-2">
                    <Segmented value={cfg.theme} onChange={v=>set('theme',v)}
                      options={[{v:'light',l:'Light',icon:Sun},{v:'dark',l:'Dark',icon:Moon}]}/>
                    <div>
                      <label className="label text-[10.5px]">Corner Style</label>
                      <Segmented value={cfg.corner} onChange={v=>set('corner',v)}
                        options={[
                          {v:'sharp', l:'Sharp', swatch:<div className="w-4 h-4 bg-slate-400" style={{borderRadius:2}}/>},
                          {v:'soft',  l:'Soft',  swatch:<div className="w-4 h-4 bg-slate-400" style={{borderRadius:5}}/>},
                          {v:'round', l:'Round', swatch:<div className="w-4 h-4 bg-slate-400" style={{borderRadius:8}}/>},
                        ]}/>
                    </div>
                    <div>
                      <label className="label text-[10.5px]">Widget Size</label>
                      <Segmented value={cfg.size} onChange={v=>set('size',v)}
                        options={[{v:'compact',l:'Compact'},{v:'standard',l:'Standard'},{v:'large',l:'Large'}]}/>
                    </div>
                    <div>
                      <label className="label text-[10.5px]">Launcher Shape</label>
                      <Segmented value={cfg.launcherShape} onChange={v=>set('launcherShape',v)}
                        options={[
                          {v:'circle', l:'Circle', swatch:<div className="w-4 h-4 bg-slate-400 rounded-full"/>},
                          {v:'square', l:'Rounded Square', swatch:<div className="w-4 h-4 bg-slate-400 rounded-[5px]"/>},
                        ]}/>
                    </div>
                    <div>
                      <label className="label text-[10.5px] flex items-center gap-1">Border Lighting
                        <InfoTip text="A multi-colour light sweeping around the widget's edge. Starts and ends on your brand colour, and holds still for visitors who have reduced motion turned on."/>
                      </label>
                      <Segmented value={cfg.borderLight ? 'on' : 'off'} onChange={v=>set('borderLight', v === 'on')}
                        options={[
                          {v:'off', l:'Off', swatch:<div className="w-6 h-3 rounded border border-slate-300"/>},
                          {v:'on',  l:'On',  swatch:<div className="w-6 h-3 rounded" style={{padding:1.5, background:'conic-gradient(#0066ff,#8B5CF6,#22d3ee,#34d399,#facc15,#fb7185,#0066ff)'}}>
                            <div className="w-full h-full rounded-sm bg-white"/>
                          </div>},
                        ]}/>
                    </div>
                  </div>
                </div>

                <div className="border-t border-surface-border"/>

                <div>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-1.5">Messages</p>
                  <div className="space-y-2">
                    <SwatchRow label="Bubble Style" value={cfg.bubbleStyle} onChange={v=>set('bubbleStyle',v)}
                      options={[
                        {v:'modern',  l:'Modern',  swatch:<div className="w-8 h-4 bg-slate-300 rounded-[8px_8px_8px_2px]"/>},
                        {v:'classic', l:'Classic', swatch:<div className="w-8 h-4 bg-slate-300 rounded-[10px_10px_10px_1px]"/>},
                        {v:'ios',     l:'Rounded (iOS)', swatch:<div className="w-8 h-4 bg-slate-300 rounded-full"/>},
                        {v:'minimal', l:'Minimal', swatch:<div className="w-8 h-4 bg-transparent border-2 border-slate-300 rounded-lg"/>},
                      ]}/>
                    <div>
                      <label className="label text-[10.5px]">Bubble Depth</label>
                      <Segmented value={cfg.bubbleShadow} onChange={v=>set('bubbleShadow',v)}
                        options={[
                          {v:'flat',     l:'Flat',     swatch:<div className="w-6 h-3 bg-slate-300 rounded"/>},
                          {v:'soft',     l:'Soft',     swatch:<div className="w-6 h-3 bg-white border border-slate-200 rounded shadow-sm"/>},
                          {v:'elevated', l:'Elevated', swatch:<div className="w-6 h-3 bg-white border border-slate-200 rounded shadow-md"/>},
                        ]}/>
                    </div>
                    <div>
                      <label className="label text-[10.5px] flex items-center gap-1">Density
                        <InfoTip text="Controls bubble padding and the spacing between message groups."/>
                      </label>
                      <Segmented value={cfg.density} onChange={v=>set('density',v)}
                        options={[
                          {v:'comfortable', l:'Comfortable', icon:Rows3},
                          {v:'compact',     l:'Compact',     icon:AlignLeft},
                        ]}/>
                    </div>
                    <div>
                      <label className="label text-[10.5px]">Quick Reply Shape</label>
                      <Segmented value={cfg.quickReplyStyle} onChange={v=>set('quickReplyStyle',v)}
                        options={[
                          {v:'pill',   l:'Pill',    swatch:<div className="w-6 h-3 border-2 border-slate-300 rounded-full"/>},
                          {v:'square', l:'Rounded', swatch:<div className="w-6 h-3 border-2 border-slate-300 rounded"/>},
                        ]}/>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ── Launcher ─────────────────────────────────────────── */}
            {themeGroup==='launch' && (
              <div className="space-y-4">
                <div>
                  <label className="label text-[10.5px]">Screen Position</label>
                  <PositionPicker value={cfg.position} onChange={v=>set('position',v)}/>
                </div>

                <div className="border-t border-surface-border"/>

                <div>
                  <label className="label flex items-center gap-1.5">Launcher Icon
                    <InfoTip text="The icon shown on the closed, floating chat button. Defaults to your profile picture, or set one just for the launcher."/>
                  </label>
                  <div className="grid grid-cols-4 gap-1.5 mt-1.5">
                    {[{v:'match',l:'Match'},{v:'icon',l:'Icon'},{v:'emoji',l:'Emoji'},{v:'image',l:'Photo'}].map(o=>(
                      <button key={o.v} onClick={()=>set('launcherIconStyle',o.v)}
                        className={clsx('py-2 px-1 rounded-lg border text-[10.5px] font-semibold transition-all flex flex-col items-center gap-1',
                          cfg.launcherIconStyle===o.v ? 'border-primary bg-primary/5 text-primary' : 'border-surface-border text-slate-600 hover:border-slate-300')}>
                        <div className="w-6 h-6 rounded-full flex items-center justify-center text-white text-[10px] font-black overflow-hidden"
                          style={{background: cfg.colorMode==='gradient' ? `linear-gradient(135deg, ${cfg.color}, ${cfg.colorEnd})` : cfg.color}}>
                          {o.v==='match'
                            ? <RefreshCw size={11}/>
                            : o.v==='icon' ? <LauncherIconCmp size={12}/>
                            : o.v==='emoji' ? (cfg.launcherEmoji||'💬')
                            : cfg.launcherImage ? <img src={cfg.launcherImage} alt="" className="w-full h-full object-cover"/> : <Image size={11}/>}
                        </div>
                        {o.l}
                      </button>
                    ))}
                  </div>
                  {cfg.launcherIconStyle==='icon' && (
                    <div className="grid grid-cols-4 gap-1.5 mt-2">
                      {LAUNCHER_ICON_OPTIONS.map(o=>{
                        const OptIcon = LAUNCHER_ICON_MAP[o.v]
                        return (
                          <button key={o.v} onClick={()=>set('launcherIcon',o.v)}
                            className={clsx('py-1.5 rounded-lg border text-[10px] font-semibold transition-all flex flex-col items-center gap-1',
                              cfg.launcherIcon===o.v ? 'border-primary bg-primary/5 text-primary' : 'border-surface-border text-slate-500 hover:border-slate-300')}>
                            <OptIcon size={14}/>
                            {o.l}
                          </button>
                        )
                      })}
                    </div>
                  )}
                  {cfg.launcherIconStyle==='emoji' && (
                    <input className="input mt-2" value={cfg.launcherEmoji} maxLength={4}
                      onChange={e=>set('launcherEmoji',e.target.value)} placeholder="💬"/>
                  )}
                  {cfg.launcherIconStyle==='image' && (
                    <div className="mt-2 pl-2.5 border-l-2 border-primary/20">
                      <ImageUploadField label="Launcher Image" value={cfg.launcherImage}
                        onChange={v=>set('launcherImage',v)}
                        hint="Square image works best. PNG, JPG, SVG or WebP, up to 2 MB."/>
                    </div>
                  )}
                </div>

                <div className="border-t border-surface-border"/>

                <div>
                  <label className="label text-[10.5px] flex items-center gap-1">Idle Animation
                    <InfoTip text="Attention effect on the closed launcher. Switch the preview to Closed to watch it run."/>
                  </label>
                  <NativeSelect value={cfg.launcherAnimation} onChange={v=>set('launcherAnimation',v)}
                    options={LAUNCHER_FX_OPTIONS}/>
                </div>

                <div>
                  <label className="label text-[10.5px]">Launcher Text <span className="text-slate-400 font-normal">(optional)</span></label>
                  <input className="input mt-1" value={cfg.launcherText}
                    onChange={e=>set('launcherText',e.target.value)} placeholder="Chat with us"/>
                </div>
              </div>
            )}

            {/* ── Typography ───────────────────────────────────────── */}
            {themeGroup==='type' && (
              <div className="space-y-4">
                <div>
                  <label className="label text-[10.5px] flex items-center gap-1"><TypeIcon size={11}/>Font Family <span className="text-slate-400 font-normal">(Google Fonts)</span></label>
                  <FontSearchSelect value={cfg.fontFamily} onChange={v=>set('fontFamily',v)}/>
                </div>

                <div>
                  <div className="flex items-center justify-between">
                    <label className="label mb-0 text-[10.5px] flex items-center gap-1">Font Size
                      <InfoTip text="Sets the message text size; headings, labels and chips scale with it."/>
                    </label>
                    <span className="text-[11px] font-bold text-primary tabular-nums">{cfg.fontSizePx}px</span>
                  </div>
                  <input type="range" min={MIN_FONT_PX} max={MAX_FONT_PX} step={1}
                    value={cfg.fontSizePx} onChange={e=>set('fontSizePx', +e.target.value)}
                    className="w-full mt-2 accent-primary cursor-pointer"/>
                  <div className="flex justify-between text-[9px] text-slate-400 mt-0.5">
                    <span>{MIN_FONT_PX}px</span><span>{MAX_FONT_PX}px</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Branding */}
        {section==='branding' && (
          <div className="bg-white border border-surface-border rounded-xl overflow-hidden">
            <div className="p-4 space-y-4">
              {/* ── Profile picture — the big avatar in the widget header ── */}
              <div>
                <label className="label flex items-center gap-1.5">Profile Picture Style
                  <InfoTip text="Shown in the widget header, and on the launcher too unless you give the launcher its own icon under Theme → Launcher"/>
                </label>
                <div className="grid grid-cols-4 gap-1.5 mt-1.5">
                  {[{v:'initials',l:'Initials'},{v:'emoji',l:'Emoji'},{v:'icon',l:'Bot'},{v:'image',l:'Photo'}].map(o=>(
                    <button key={o.v} onClick={()=>set('avatarStyle',o.v)}
                      className={clsx('py-2 px-1 rounded-lg border text-[10.5px] font-semibold transition-all flex flex-col items-center gap-1',
                        cfg.avatarStyle===o.v ? 'border-primary bg-primary/5 text-primary' : 'border-surface-border text-slate-600 hover:border-slate-300')}>
                      <div className="w-6 h-6 rounded-lg flex items-center justify-center text-white text-[10px] font-black overflow-hidden"
                        style={{background: o.v==='image' && cfg.avatarImage ? '#fff' : cfg.colorMode==='gradient' ? `linear-gradient(135deg, ${cfg.color}, ${cfg.colorEnd})` : cfg.color}}>
                        {o.v==='initials' ? (cfg.botName||'Bot').slice(0,2).toUpperCase()
                          : o.v==='emoji' ? (cfg.avatarEmoji||'🤖')
                          : o.v==='icon' ? <Bot size={12}/>
                          : cfg.avatarImage ? <img src={cfg.avatarImage} alt="" className="w-full h-full object-cover"/> : <Image size={11}/>}
                      </div>
                      {o.l}
                    </button>
                  ))}
                </div>
                {cfg.avatarStyle==='emoji' && (
                  <input className="input mt-2" value={cfg.avatarEmoji} maxLength={4}
                    onChange={e=>set('avatarEmoji',e.target.value)} placeholder="🤖"/>
                )}
              </div>

              {cfg.avatarStyle==='image' && (
                <div className="pl-2.5 border-l-2 border-primary/20">
                  <ImageUploadField label="Profile Picture" value={cfg.avatarImage}
                    onChange={v=>set('avatarImage',v)}
                    hint="Square image works best. PNG, JPG, SVG or WebP, up to 2 MB."/>
                </div>
              )}

              <div className="border-t border-surface-border -mx-4 px-4 pt-4"/>

              {/* ── Thread avatar — the small one beside each question ── */}
              <div>
                <label className="label flex items-center gap-1.5">Question Avatar
                  <InfoTip text="The small avatar shown before each bot question"/>
                </label>
                <div className="grid grid-cols-4 gap-1.5 mt-1.5">
                  {[{v:'initials',l:'Initials'},{v:'emoji',l:'Emoji'},{v:'icon',l:'Bot'},{v:'image',l:'Photo'}].map(o=>(
                    <button key={o.v} onClick={()=>set('threadAvatarStyle',o.v)}
                      className={clsx('py-2 px-1 rounded-lg border text-[10.5px] font-semibold transition-all flex flex-col items-center gap-1',
                        cfg.threadAvatarStyle===o.v ? 'border-primary bg-primary/5 text-primary' : 'border-surface-border text-slate-600 hover:border-slate-300')}>
                      <div className="w-6 h-6 rounded-full flex items-center justify-center text-white text-[10px] font-black overflow-hidden"
                        style={{background: o.v==='image' && cfg.threadAvatarImage ? '#fff' : cfg.colorMode==='gradient' ? `linear-gradient(135deg, ${cfg.color}, ${cfg.colorEnd})` : cfg.color}}>
                        {o.v==='initials' ? (cfg.botName||'Bot').slice(0,2).toUpperCase()
                          : o.v==='emoji' ? (cfg.threadAvatarEmoji||'🤖')
                          : o.v==='icon' ? <Bot size={12}/>
                          : cfg.threadAvatarImage ? <img src={cfg.threadAvatarImage} alt="" className="w-full h-full object-cover"/> : <Image size={11}/>}
                      </div>
                      {o.l}
                    </button>
                  ))}
                </div>
                {cfg.threadAvatarStyle==='emoji' && (
                  <input className="input mt-2" value={cfg.threadAvatarEmoji} maxLength={4}
                    onChange={e=>set('threadAvatarEmoji',e.target.value)} placeholder="🤖"/>
                )}
                <button
                  onClick={()=>{ set('threadAvatarStyle', cfg.avatarStyle); set('threadAvatarEmoji', cfg.avatarEmoji); set('threadAvatarImage', cfg.avatarImage) }}
                  className="mt-2 w-full flex items-center justify-center gap-1.5 py-1.5 rounded-lg border border-surface-border bg-white text-slate-600 text-[11px] font-semibold hover:bg-surface-hover transition-colors">
                  <Copy size={11}/> Match profile picture
                </button>
              </div>

              {cfg.threadAvatarStyle==='image' && (
                <div className="pl-2.5 border-l-2 border-primary/20">
                  <ImageUploadField label="Question Avatar Image" value={cfg.threadAvatarImage}
                    onChange={v=>set('threadAvatarImage',v)}
                    hint="Rendered at 28×28 — use a tight crop of the face or logo."/>
                </div>
              )}

              <div className="border-t border-surface-border -mx-4 px-4 pt-4"/>
              <div>
                <label className="label">Bot Name</label>
                <input className="input mt-1" value={cfg.botName}
                  onChange={e=>set('botName',e.target.value)} placeholder="ChatBot"/>
              </div>
              <div>
                <label className="label">Tagline</label>
                <input className="input mt-1" value={cfg.tagline}
                  onChange={e=>set('tagline',e.target.value)} placeholder="We reply instantly"/>
              </div>
              <div>
                <label className="label">Welcome Greeting</label>
                <textarea className="input mt-1 resize-none" rows={3} value={cfg.greeting}
                  onChange={e=>set('greeting',e.target.value)} placeholder="Hi! 👋 How can I help?"/>
              </div>
              <div className="flex items-center justify-between py-1">
                <div>
                  <p className="text-xs font-medium text-slate-800">Show "Powered by ChatFlow"</p>
                  <p className="text-[10px] text-slate-400">Remove branding on paid plans</p>
                </div>
                <Toggle checked={cfg.showBranding} onChange={v=>set('showBranding',v)}/>
              </div>
              {cfg.showBranding && (
                <div>
                  <label className="label">Branding link</label>
                  <input className="input mt-1" value={cfg.brandingUrl}
                    onChange={e=>set('brandingUrl',e.target.value)} placeholder="https://your-site.com"/>
                  <p className="text-[10px] text-slate-400 mt-1">
                    Clicking "Powered by ChatFlow" asks the visitor if they want a chatbot like this and
                    collects their details — after they book a demo this page opens in a new tab.
                    Defaults to your own site.
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Behavior */}
        {section==='behavior' && (
          <div className="bg-white border border-surface-border rounded-xl overflow-hidden">
            <div className="divide-y divide-surface-border">
              {[
                {k:'sound',           l:'Sound notifications',   sub:'Play a sound when new message arrives'},
                {k:'emoji',           l:'Emoji picker',           sub:'Allow users to send emojis'},
                {k:'attach',          l:'File attachments',       sub:'Let users upload files in chat'},
                {k:'rating',          l:'Post-chat rating',       sub:'Ask for satisfaction rating after chat'},
                {k:'typingIndicator', l:'Typing indicator',       sub:'Show animated dots while bot is "typing"'},
                {k:'readReceipts',    l:'Read receipts',          sub:'Show ✓✓ once a message is read'},
                {k:'showSenderName',  l:'Show sender name',       sub:'Label the first bubble of each bot reply'},
                {k:'gifPicker',       l:'GIF picker',              sub:'Let visitors send GIFs in chat'},
                {k:'voiceInput',      l:'Voice-to-text input',     sub:'Mic button to send voice messages'},
                {k:'saveChat',        l:'Save / email transcript', sub:'Let visitors save a copy of the conversation'},
              ].map(item=>(
                <div key={item.k} className="flex items-center justify-between px-4 py-3">
                  <div>
                    <p className="text-xs font-medium text-slate-800">{item.l}</p>
                    <p className="text-[10px] text-slate-400">{item.sub}</p>
                  </div>
                  <Toggle checked={cfg[item.k]} onChange={v=>set(item.k,v)}/>
                </div>
              ))}
            </div>
            <div className="p-4 border-t border-surface-border space-y-4">
              <div>
                <label className="label flex items-center gap-1.5"><Wand2 size={11}/>Message Animation</label>
                <p className="text-[10px] text-slate-400 mb-1.5">How each bubble enters the thread</p>
                <PillGroup cols={4} value={cfg.msgAnimation} onChange={v=>set('msgAnimation',v)}
                  options={[
                    {v:'slide', l:'Slide'},
                    {v:'fade',  l:'Fade'},
                    {v:'pop',   l:'Pop'},
                    {v:'none',  l:'None'},
                  ]}/>
              </div>
              <div>
                <label className="label">Timestamps</label>
                <PillGroup cols={2} value={cfg.timestampMode} onChange={v=>set('timestampMode',v)}
                  options={[
                    {v:'grouped', l:'Per message group'},
                    {v:'none',    l:'Hidden'},
                  ]}/>
              </div>
            </div>
            <div className="p-4 border-t border-surface-border">
              <label className="label flex items-center gap-1.5"><Clock size={11}/>Auto-open After <span className="text-slate-400 font-normal">(seconds, 0 = off)</span></label>
              <input type="number" min={0} max={120} className="input mt-1 w-28" value={cfg.autoOpenDelay}
                onChange={e=>set('autoOpenDelay', Math.max(0, +e.target.value))}/>
            </div>
            <div className="p-4 border-t border-surface-border space-y-1">
              <label className="label">Widget Tabs</label>
              <p className="text-[10px] text-slate-400 mb-2">Choose which tabs appear in the bottom tab bar. Chat must always be enabled.</p>
              {[
                {k:'showHomeTab',     l:'Home tab',            sub:'Welcome / landing page',      icon:Home, always:false},
                {k:'showChatTab',     l:'Chat tab',            sub:'Main conversation area',      icon:MessageCircle, always:true},
                {k:'showMessagesTab', l:'Messages tab',        sub:'Conversation history',        icon:MessageCircle, always:false},
                {k:'showFaqTab',      l:'Help tab',            sub:'Searchable help articles',    icon:HelpCircle, always:false},
                {k:'showBookingTab',  l:'Book tab',            sub:'Date/slot appointment picker',icon:CalendarDays, always:false},
              ].map(item=>(
                <div key={item.k} className="flex items-center justify-between py-1.5">
                  <div className="flex items-center gap-2">
                    <item.icon size={13} className="text-slate-400 flex-shrink-0"/>
                    <div>
                      <p className="text-xs font-medium text-slate-800">{item.l} {item.always && <span className="text-[9px] text-slate-400 font-normal">(required)</span>}</p>
                      <p className="text-[10px] text-slate-400">{item.sub}</p>
                    </div>
                  </div>
                  <Toggle checked={cfg[item.k]} onChange={item.always ? ()=>{} : v=>set(item.k,v)} disabled={item.always}/>
                </div>
              ))}
            </div>
            <div className="p-4 border-t border-surface-border space-y-1">
              <label className="label">Calling</label>
              <p className="text-[10px] text-slate-400 mb-2">Let visitors start a real voice or video call with your team, right from the widget.</p>
              {[
                {k:'enableVoiceCall', l:'Voice Call', sub:'Phone icon in the widget header', icon:Phone},
                {k:'enableVideoCall', l:'Video Call', sub:'Video icon in the widget header', icon:Video},
              ].map(item=>(
                <div key={item.k} className="flex items-center justify-between py-1.5">
                  <div className="flex items-center gap-2">
                    <item.icon size={13} className="text-slate-400 flex-shrink-0"/>
                    <div>
                      <p className="text-xs font-medium text-slate-800">{item.l}</p>
                      <p className="text-[10px] text-slate-400">{item.sub}</p>
                    </div>
                  </div>
                  <Toggle checked={cfg[item.k]} onChange={v=>set(item.k,v)}/>
                </div>
              ))}
            </div>
            <div className="p-4 border-t border-surface-border space-y-1.5">
              <label className="label flex items-center gap-1.5"><MapPin size={11}/>Location Search</label>
              <p className="text-[10px] text-slate-400 mb-1">
                Powers real address autocomplete on the "Location" question type. Needs your own Google Cloud
                API key with the <span className="font-medium text-slate-500">Places API</span> and{' '}
                <span className="font-medium text-slate-500">Geocoding API</span> enabled (billing required on
                Google's side). Left blank, Location falls back to a plain address text field — nothing breaks.
              </p>
              <input type="password" autoComplete="off" className="input" placeholder="Google Maps API key (optional)"
                value={cfg.googleMapsApiKey} onChange={e=>set('googleMapsApiKey', e.target.value)}/>
              <p className="text-[9.5px] text-slate-400">
                Get a key at <span className="font-mono">console.cloud.google.com/google/maps-apis</span> — restrict it to your domain before going live.
              </p>
            </div>
          </div>
        )}

        {/* Lead capture */}
        {section==='lead' && (
          <div className="bg-white border border-surface-border rounded-xl overflow-hidden">
            <div className="divide-y divide-surface-border">
              {[
                {k:'leadName',  l:'Full Name',    sub:'Ask for visitor name'},
                {k:'leadEmail', l:'Email Address',sub:'Ask for email address'},
                {k:'leadPhone', l:'Phone Number', sub:'Ask for phone number'},
              ].map(item=>(
                <div key={item.k} className="flex items-center justify-between px-4 py-3">
                  <div>
                    <p className="text-xs font-medium text-slate-800">{item.l}</p>
                    <p className="text-[10px] text-slate-400">{item.sub}</p>
                  </div>
                  <Toggle checked={cfg[item.k]} onChange={v=>set(item.k,v)}/>
                </div>
              ))}
            </div>
            <div className="p-4 border-t border-surface-border space-y-1.5">
              <label className="label">Capture Timing</label>
              <PillGroup cols={2} value={cfg.leadTiming} onChange={v=>set('leadTiming',v)}
                options={[{v:'before',l:'Before chat'},{v:'during',l:'During chat'}]}/>
              <p className="text-[10px] text-slate-400 pt-1">
                {cfg.leadTiming==='before' ? 'Shown as a form before the conversation starts.' : "Bot asks for these naturally as the conversation goes on."}
              </p>
            </div>
          </div>
        )}

        {/* Question Types — every type shows at once in the preview beside this
            panel (the same Home/Chat/Closed + device switcher used everywhere
            else), stacked as one scrollable feed instead of a one-at-a-time
            mocked-up card. Category tabs filter which ones appear in both this
            list and the feed; clicking a row scrolls the feed to that message. */}
        {section==='questions' && (
          <div>
            <div className="flex items-center justify-between gap-2 mb-3">
              <div>
                <p className="text-[13px] font-semibold text-slate-900">{QUESTION_TYPES.length} Question Types</p>
                <p className="text-[10px] text-slate-400">All shown live — click one to jump to it</p>
              </div>
              <Link to="/webchat" title="Open Flow Designer"
                className="w-7 h-7 rounded-lg bg-primary text-white flex items-center justify-center flex-shrink-0 hover:bg-primary-hover transition-colors">
                <Zap size={13}/>
              </Link>
            </div>

            <div className="flex items-center gap-0.5 bg-slate-100 p-1 rounded-xl w-full overflow-x-auto mb-3">
              {QUESTION_CATS.map(c=>(
                <button key={c} onClick={()=>setQCat(c)}
                  className={clsx('px-2.5 py-1.5 rounded-lg text-[10.5px] font-semibold whitespace-nowrap transition-all',
                    qCat===c ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700')}>
                  {c}
                </button>
              ))}
            </div>

            <div className="space-y-1.5">
              {filteredQ.map(q=>(
                <button key={q.id}
                  onClick={()=>{ setScreen('chat'); setScrollToQType(q.id) }}
                  className="w-full flex items-center gap-2.5 p-2.5 rounded-xl border border-surface-border bg-white text-left transition-all hover:border-slate-300 hover:shadow-sm">
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                    style={{background: q.color+'18'}}>
                    <q.icon size={14} style={{color: q.color}}/>
                  </div>
                  <div className="min-w-0">
                    <p className="text-[11.5px] font-semibold text-slate-800 truncate">{q.name}</p>
                    <p className="text-[10px] text-slate-400 truncate">{q.desc}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}
    </>
  )
}
/* ─── Appointment booking — date + realtime available slots in ONE view ──
   Picking a date instantly refreshes the slot grid right below it; no separate
   "step 2" screen. Different days show genuinely different slot sets so the
   realtime update is visible when clicking through dates. ── */
const APPT_SLOT_SETS = [
  ['9:00 AM','11:00 AM','2:00 PM'],
  ['9:00 AM','10:00 AM','11:00 AM','3:00 PM','4:00 PM'],
  ['10:00 AM','1:00 PM','3:00 PM','4:30 PM'],
  ['9:00 AM','12:00 PM'],
  ['9:00 AM','10:00 AM','2:00 PM','3:00 PM','4:00 PM'],
  ['11:00 AM','2:00 PM'],
  [],
]
const WEEKDAY_LABELS = ['Su','Mo','Tu','We','Th','Fr','Sa']

/* Deterministic pseudo-availability so the same date always shows the same
   slots while browsing — no backend, so this stands in for a real schedule. */
function slotsForDate(date) {
  const seed = date.getFullYear()*372 + date.getMonth()*31 + date.getDate()
  if (seed % 7 === 6) return [] // roughly one day in 7 is fully booked
  return APPT_SLOT_SETS[seed % APPT_SLOT_SETS.length]
}

function sameDay(a, b) {
  return a && b && a.getFullYear()===b.getFullYear() && a.getMonth()===b.getMonth() && a.getDate()===b.getDate()
}

function AppointmentPicker() {
  const today = new Date(); today.setHours(0,0,0,0)
  const [viewDate, setViewDate] = useState(new Date(today))
  const [selectedDate, setSelectedDate] = useState(today)
  const [selectedSlot, setSelectedSlot] = useState(null)
  const [pickerOpen, setPickerOpen] = useState(false)

  const year = viewDate.getFullYear(), month = viewDate.getMonth()
  const firstOfMonth = new Date(year, month, 1)
  const startOffset = firstOfMonth.getDay() // 0=Sun
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const daysInPrevMonth = new Date(year, month, 0).getDate()
  const totalCells = Math.ceil((startOffset + daysInMonth) / 7) * 7

  const cells = Array.from({ length: totalCells }, (_, idx) => {
    const dayNum = idx - startOffset + 1
    if (dayNum < 1) return { date: new Date(year, month - 1, daysInPrevMonth + dayNum), outside: true }
    if (dayNum > daysInMonth) return { date: new Date(year, month + 1, dayNum - daysInMonth), outside: true }
    return { date: new Date(year, month, dayNum), outside: false }
  })

  function changeMonth(delta) {
    setViewDate(new Date(year, month + delta, 1))
  }
  function pickDate(date) {
    if (date < today) return
    setSelectedDate(date)
    setSelectedSlot(null)
    if (date.getMonth() !== month || date.getFullYear() !== year) setViewDate(new Date(date.getFullYear(), date.getMonth(), 1))
  }

  const slots = slotsForDate(selectedDate)
  const MONTH_NAMES = ['January','February','March','April','May','June','July','August','September','October','November','December']

  return (
    <div className="mt-2">
      {/* Month/year header — arrows to step, click the label for a quick jump */}
      <div className="flex items-center justify-between mb-2.5 relative">
        <button onClick={()=>changeMonth(-1)}
          className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors">
          <ChevronLeft size={15}/>
        </button>
        <button onClick={()=>setPickerOpen(o=>!o)}
          className="flex items-center gap-1 text-[12px] font-bold text-slate-800 px-2 py-1 rounded-lg hover:bg-slate-100 transition-colors">
          {MONTH_NAMES[month]} {year}
          <ChevronDown size={12} className={clsx('text-slate-400 transition-transform', pickerOpen && 'rotate-180')}/>
        </button>
        <button onClick={()=>changeMonth(1)}
          className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors">
          <ChevronRight size={15}/>
        </button>

        {/* Quick month/year jump — a year stepper instead of a scrolling strip,
            so picking a year never needs a horizontal swipe. Spans the calendar's
            own width (left-0 right-0) instead of a fixed centered width — the
            widget's rounded-corner shell clips anything that overflows it, and a
            fixed w-56 box centered under the label could hang past the edge on
            the narrower widget sizes. */}
        {pickerOpen && (
          <div className="absolute top-9 left-0 right-0 z-20 bg-white rounded-xl shadow-xl p-2.5"
            style={{ animation:'wcMenuIn 0.16s cubic-bezier(0.16,1,0.3,1) both' }}>
            <div className="flex items-center justify-between mb-2">
              <button onClick={()=>setViewDate(new Date(year-1, month, 1))}
                className="w-6 h-6 rounded-md flex items-center justify-center text-slate-400 hover:bg-slate-100 hover:text-slate-600">
                <ChevronLeft size={13}/>
              </button>
              <span className="text-[11px] font-bold text-slate-800">{year}</span>
              <button onClick={()=>setViewDate(new Date(year+1, month, 1))}
                className="w-6 h-6 rounded-md flex items-center justify-center text-slate-400 hover:bg-slate-100 hover:text-slate-600">
                <ChevronRight size={13}/>
              </button>
            </div>
            <div className="grid grid-cols-3 gap-1">
              {MONTH_NAMES.map((m,i)=>(
                <button key={m} onClick={()=>{ setViewDate(new Date(year, i, 1)); setPickerOpen(false) }}
                  className={clsx('text-[10px] font-semibold py-1.5 rounded-md transition-colors',
                    i===month ? 'bg-primary text-white' : 'text-slate-600 hover:bg-slate-100')}>
                  {m.slice(0,3)}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Weekday header */}
      <div className="grid grid-cols-7 mb-1">
        {WEEKDAY_LABELS.map(w=>(
          <div key={w} className="text-[9px] font-bold text-slate-400 text-center py-1">{w}</div>
        ))}
      </div>

      {/* Day grid */}
      <div className="grid grid-cols-7 gap-y-1">
        {cells.map((c,i)=>{
          const isSelected = sameDay(c.date, selectedDate)
          const isToday = sameDay(c.date, today)
          const isPast = c.date < today
          const hasSlots = !c.outside && !isPast && slotsForDate(c.date).length > 0
          return (
            <div key={i} className="flex items-center justify-center">
              <button onClick={()=>pickDate(c.date)} disabled={isPast}
                className={clsx('relative w-8 h-8 rounded-full text-[11px] font-semibold transition-colors flex items-center justify-center',
                  c.outside ? 'text-slate-300' : isPast ? 'text-slate-300 cursor-not-allowed' : 'text-slate-700',
                  isSelected && 'bg-primary text-white',
                  !isSelected && isToday && 'ring-1 ring-primary text-primary',
                  !isSelected && !isPast && !c.outside && 'hover:bg-slate-100')}>
                {c.date.getDate()}
                {hasSlots && !isSelected && (
                  <span className="absolute bottom-0.5 w-1 h-1 rounded-full bg-primary/70"/>
                )}
              </button>
            </div>
          )
        })}
      </div>

      {/* Slots update immediately below — same flow, no extra step, no boxed
          card around either the calendar or the slot buttons. */}
      <div className="mt-4">
        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-2">
          Available times — {selectedDate.toLocaleDateString('en-US',{weekday:'short', month:'short', day:'numeric'})}
        </p>
        {slots.length === 0 ? (
          <p className="text-[11px] text-slate-400 italic py-2">No slots available this day — try another date.</p>
        ) : (
          <div className="grid grid-cols-3 gap-1.5">
            {slots.map(t=>(
              <button key={t} onClick={()=>setSelectedSlot(t)}
                className={clsx('rounded-lg py-1.5 text-[10px] font-bold text-center transition-colors',
                  selectedSlot===t ? 'bg-primary text-white' : 'bg-slate-50 text-slate-600 hover:bg-slate-100 hover:text-primary')}>
                {t}
              </button>
            ))}
          </div>
        )}
      </div>

      {selectedSlot && (
        <button className="w-full mt-3 bg-primary text-white text-[11px] font-bold py-2 rounded-lg">
          Confirm {selectedDate.toLocaleDateString('en-US',{weekday:'short', month:'short', day:'numeric'})} at {selectedSlot}
        </button>
      )}
    </div>
  )
}

/* A short, natural phrasing of each question type — used only to give the
   widget-styled preview below something plausible to "ask", since QUESTION_TYPES
   itself only carries a catalog description, not conversational copy. */
const SAMPLE_QUESTIONS = {
  short: "What's your full name?", long: 'Tell us more about your issue',
  number: 'How many team members do you have?', email: "What's your email address?",
  phone: 'What’s the best number to reach you?', url: 'Share your website URL',
  single: 'Which plan are you interested in?', multi: 'Which features matter most to you?',
  dropdown: 'Select your country', yesno: 'Are you an existing customer?',
  rating: 'How would you rate your experience?', nps: 'How likely are you to recommend us?',
  date: 'When would you like to schedule?', daterange: 'Select your travel dates',
  time: 'Pick a convenient time', appt: 'Book a slot that works for you',
  file: 'Upload your document', image: 'Upload a photo', signature: 'Please sign to confirm',
  location: 'Where should we deliver?', payment: 'Complete your payment',
  otp: 'Enter the code we just sent you', form: 'Fill in your details',
  carousel: 'Check out our top picks', carousel_buttons: 'Choose an option below',
  catalog: 'Browse our products',
}


/* ─── Settings Tab ────────────────────────────────────────────── */
function SettingsTab() {
  const [offline, setOffline] = useState('message')
  const [saved, setSaved] = useState(false)
  const [s, setS] = useState({
    gdpr:true, workingHours:false,
  })
  const set = (k,v) => setS(p=>({...p,[k]:v}))

  const [urlMode, setUrlMode] = useState('all') // 'all' | 'whitelist' | 'blacklist'
  const [whitelistUrls, setWhitelistUrls] = useState(['/pricing', '/features'])
  const [blacklistUrls, setBlacklistUrls] = useState(['/admin/*', '/checkout'])
  const [urlDraft, setUrlDraft] = useState('')
  const activeUrls    = urlMode === 'whitelist' ? whitelistUrls : blacklistUrls
  const setActiveUrls = urlMode === 'whitelist' ? setWhitelistUrls : setBlacklistUrls

  function addUrl() {
    const v = urlDraft.trim()
    if (!v || activeUrls.includes(v)) return
    setActiveUrls(u => [...u, v])
    setUrlDraft('')
  }
  function removeUrl(u) { setActiveUrls(list => list.filter(x => x !== u)) }

  function save() { setSaved(true); setTimeout(()=>setSaved(false), 2500) }

  return (
    <div className="space-y-5 max-w-2xl">

      {/* Toggles */}
      <div className="bg-white border border-surface-border rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-surface-border">
          <p className="text-[13px] font-semibold text-slate-900">Widget Behavior</p>
        </div>
        <div className="divide-y divide-surface-border">
          {[
            {k:'gdpr',           l:'GDPR Consent Notice',       sub:'Show consent message before chat starts'},
            {k:'workingHours',   l:'Working Hours Only',        sub:'Hide widget outside business hours'},
          ].map(item=>(
            <div key={item.k} className="flex items-center justify-between px-5 py-3.5">
              <div>
                <p className="text-xs font-medium text-slate-800">{item.l}</p>
                <p className="text-[11px] text-slate-400">{item.sub}</p>
              </div>
              <Toggle checked={s[item.k]} onChange={v=>set(item.k,v)}/>
            </div>
          ))}
        </div>
      </div>

      {/* Page visibility — whitelist/blacklist URLs */}
      <div className="bg-white border border-surface-border rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-surface-border">
          <p className="text-[13px] font-semibold text-slate-900">Page Visibility</p>
          <p className="text-[11px] text-slate-400 mt-0.5">Control which pages the widget shows on</p>
        </div>
        <div className="p-4 space-y-3">
          {[
            { v:'all',       l:'Show on all pages',           sub:'Widget appears everywhere on your site' },
            { v:'whitelist', l:'Show only on specific pages',  sub:'Whitelist — widget appears only on the URLs below' },
            { v:'blacklist', l:'Hide on specific pages',       sub:'Blacklist — widget appears everywhere except the URLs below' },
          ].map(r=>(
            <button key={r.v} onClick={()=>setUrlMode(r.v)}
              className={clsx('w-full flex items-start gap-3 p-3 rounded-lg border text-left transition-all',
                urlMode===r.v ? 'border-primary bg-primary/5' : 'border-surface-border hover:border-slate-300')}>
              <div className={clsx('w-4 h-4 rounded-full border-2 flex-shrink-0 mt-0.5',
                urlMode===r.v ? 'border-primary bg-primary' : 'border-slate-300')}>
                {urlMode===r.v && <div className="w-full h-full rounded-full flex items-center justify-center"><div className="w-1.5 h-1.5 rounded-full bg-white"/></div>}
              </div>
              <div>
                <p className="text-xs font-semibold text-slate-800">{r.l}</p>
                <p className="text-[11px] text-slate-400">{r.sub}</p>
              </div>
            </button>
          ))}

          {urlMode !== 'all' && (
            <div className="pt-1 space-y-2">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                {urlMode==='whitelist' ? 'Whitelisted URLs' : 'Blacklisted URLs'}
              </p>
              <div className="flex flex-wrap gap-1.5">
                {activeUrls.map(u => (
                  <span key={u} className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-full bg-slate-100 text-slate-700 text-[11px] font-mono">
                    {u}
                    <button onClick={()=>removeUrl(u)} className="text-slate-400 hover:text-red-500"><X size={10}/></button>
                  </span>
                ))}
                {activeUrls.length === 0 && <p className="text-[11px] text-slate-400 italic">No URLs added yet</p>}
              </div>
              <div className="flex gap-1.5">
                <input value={urlDraft} onChange={e=>setUrlDraft(e.target.value)}
                  onKeyDown={e=>{ if(e.key==='Enter'){ e.preventDefault(); addUrl() } }}
                  placeholder="e.g. /pricing or /blog/*" className="input-sm flex-1 font-mono"/>
                <button onClick={addUrl} className="px-3 rounded-lg bg-primary-50 text-primary text-[11px] font-semibold hover:bg-primary/10">Add</button>
              </div>
              <p className="text-[10px] text-slate-400">Use <code className="font-mono bg-slate-100 px-1 rounded">*</code> as a wildcard, e.g. <code className="font-mono bg-slate-100 px-1 rounded">/blog/*</code> matches every blog page.</p>
            </div>
          )}
        </div>
      </div>

      {/* Offline behavior */}
      <div className="bg-white border border-surface-border rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-surface-border">
          <p className="text-[13px] font-semibold text-slate-900">Offline Behavior</p>
          <p className="text-[11px] text-slate-400 mt-0.5">What happens when no agents are available</p>
        </div>
        <div className="p-4 space-y-2">
          {[
            { v:'message', l:'Show offline message', sub:'Display a custom "We are offline" message' },
            { v:'form',    l:'Show contact form',    sub:'Collect name, email and message offline'   },
            { v:'hide',    l:'Hide widget',          sub:'Don\'t show the widget when offline'        },
          ].map(r=>(
            <button key={r.v} onClick={()=>setOffline(r.v)}
              className={clsx('w-full flex items-start gap-3 p-3 rounded-lg border text-left transition-all',
                offline===r.v ? 'border-primary bg-primary/5' : 'border-surface-border hover:border-slate-300')}>
              <div className={clsx('w-4 h-4 rounded-full border-2 flex-shrink-0 mt-0.5',
                offline===r.v ? 'border-primary bg-primary' : 'border-slate-300')}>
                {offline===r.v && <div className="w-full h-full rounded-full flex items-center justify-center"><div className="w-1.5 h-1.5 rounded-full bg-white"/></div>}
              </div>
              <div>
                <p className="text-xs font-semibold text-slate-800">{r.l}</p>
                <p className="text-[11px] text-slate-400">{r.sub}</p>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Save */}
      <div className="flex items-center justify-end gap-3">
        {saved && <span className="flex items-center gap-1.5 text-[11px] text-emerald-600 font-semibold"><Check size={12}/>Saved</span>}
        <button onClick={save} className="btn-primary flex items-center gap-1.5">
          <Check size={13}/> Save Settings
        </button>
      </div>
    </div>
  )
}

/* ─── Main Page ──────────────────────────────────────────────── */
/* ─── Landing Page ────────────────────────────────────────────────
   A hosted, standalone page that runs this bot full-screen — for sharing in
   emails, QR codes, ads and bios where you can't paste an install snippet.
   The URL is derived from the widget's own numeric ID, so it always points at
   this bot and stays in sync with the Installation snippet. */
const LANDING_HOST = 'https://page.smatbot.com'

/* The landing-page UI's name for the same id the install snippet carries.
   A function, not a constant: the id arrives from the API after first paint,
   so a value captured at module load would be the placeholder forever. */
export const getLandingBotId = getBotId

export function slugifyBotName(name) {
  return (name || 'Chat_Bot').trim().replace(/[^\w\s-]/g, '').replace(/[\s-]+/g, '_').slice(0, 48) || 'Chat_Bot'
}

export function buildLandingUrl(name) {
  return `${LANDING_HOST}/?name=${encodeURIComponent(slugifyBotName(name))}&id=${getLandingBotId()}`
}

/* `buildLandingUrl` above is the production-format URL shown for customers to
   copy — page.smatbot.com isn't a real deployed host in this project. This is
   the actual working page in THIS app that renders the same query params, so
   "Open page" has something real to open while you're testing. */
export function buildLocalLandingUrl(name) {
  return `/webchat-landing?name=${encodeURIComponent(slugifyBotName(name))}&id=${getLandingBotId()}`
}

function CopyRow({ label, value, mono = true }) {
  const [copied, setCopied] = useState(false)
  return (
    <div>
      <label className="label">{label}</label>
      <div className="flex items-stretch gap-1.5 mt-1">
        <div className={clsx('flex-1 min-w-0 px-3 py-2 rounded-lg border border-surface-border bg-slate-50 text-[11px] text-slate-600 overflow-x-auto whitespace-nowrap wc-scroll',
          mono && 'font-mono')}>
          {value}
        </div>
        <button
          onClick={() => { navigator.clipboard?.writeText(value); setCopied(true); setTimeout(()=>setCopied(false), 1800) }}
          className={clsx('px-3 rounded-lg border text-[11px] font-semibold transition-all flex items-center gap-1.5 flex-shrink-0',
            copied ? 'border-emerald-300 bg-emerald-50 text-emerald-600' : 'border-surface-border bg-white text-slate-600 hover:bg-surface-hover')}>
          {copied ? <><Check size={12}/> Copied</> : <><Copy size={12}/> Copy</>}
        </button>
      </div>
    </div>
  )
}

function LandingPageTab({ cfg, set }) {
  // Subscribed rather than read once: buildLandingUrl() below reads the id at
  // call time, so this tab has to re-render when it lands or the URLs on it
  // would keep showing the placeholder.
  const botId = useBotId()
  const url = buildLandingUrl(cfg.landingName)
  const slug = slugifyBotName(cfg.landingName)

  return (
    <div className="max-w-3xl space-y-4">
      {/* Live link card */}
      <div className="bg-white border border-surface-border rounded-xl overflow-hidden">
        <div className="p-4 border-b border-surface-border flex items-start justify-between gap-3">
          <div className="flex items-start gap-2.5 min-w-0">
            <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
              style={{ background: `linear-gradient(135deg, ${cfg.color}, ${cfg.colorEnd||cfg.color})` }}>
              <Globe size={16} className="text-white"/>
            </div>
            <div className="min-w-0">
              <p className="text-[13px] font-bold text-slate-800">Hosted Landing Page</p>
              <p className="text-[11px] text-slate-400 mt-0.5">
                A full-screen page running this bot — no website or install snippet needed.
              </p>
            </div>
          </div>
          <span className={clsx('text-[9px] font-bold px-2 py-1 rounded-full border flex items-center gap-1 flex-shrink-0',
            cfg.landingEnabled ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-slate-50 text-slate-500 border-slate-200')}>
            <span className={clsx('w-1.5 h-1.5 rounded-full', cfg.landingEnabled ? 'bg-emerald-400 animate-pulse' : 'bg-slate-300')}/>
            {cfg.landingEnabled ? 'Live' : 'Disabled'}
          </span>
        </div>

        <div className="p-4 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-slate-800">Enable landing page</p>
              <p className="text-[10px] text-slate-400">Turn off to make the link return 404</p>
            </div>
            <Toggle checked={cfg.landingEnabled} onChange={v=>set('landingEnabled',v)}/>
          </div>

          <div>
            <label className="label">Page Name</label>
            <input className="input mt-1" value={cfg.landingName}
              onChange={e=>set('landingName', e.target.value)} placeholder="Support_Bot"/>
            <p className="text-[10px] text-slate-400 mt-1">
              Appears in the URL as <code className="font-mono text-slate-500">name={slug}</code>.
              Spaces become underscores; symbols are stripped.
            </p>
          </div>

          <div>
            <label className="label">Bot ID</label>
            <div className="flex items-center gap-2 mt-1">
              <span className="font-mono text-[13px] font-bold text-slate-800 px-3 py-2 rounded-lg bg-slate-50 border border-surface-border">
                {botId}
              </span>
              <p className="text-[10px] text-slate-400">
                The same id your install snippet loads — one bot, one number.
              </p>
            </div>
          </div>

          <CopyRow label="Landing Page URL" value={url}/>

          <div className="flex gap-2">
            <a href={buildLocalLandingUrl(cfg.landingName)} target="_blank" rel="noreferrer"
              className="btn-secondary flex-1 justify-center gap-1.5">
              <ExternalLink size={12}/> Open page
            </a>
            <button
              onClick={() => navigator.clipboard?.writeText(url)}
              className="btn-primary flex-1 justify-center gap-1.5">
              <LinkIcon size={12}/> Copy link
            </button>
          </div>
          <p className="text-[10px] text-slate-400 -mt-2">
            "Open page" previews the real page live (it reads this Widget Builder's live settings). "Copy link" copies the production-format URL above for once this is deployed.
          </p>
        </div>
      </div>

      {/* Share variants */}
      <div className="bg-white border border-surface-border rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-surface-border">
          <p className="text-[13px] font-bold text-slate-800">Ways to share it</p>
          <p className="text-[11px] text-slate-400 mt-0.5">Same page, different surfaces</p>
        </div>
        <div className="p-4 space-y-4">
          <CopyRow label="Embed as an iframe"
            value={`<iframe src="${url}" width="100%" height="640" style="border:0;border-radius:16px" title="${slug}"></iframe>`}/>
          <CopyRow label="Open in a popup window"
            value={`<a href="#" onclick="window.open('${url}','${slug}','width=420,height=680');return false;">Chat with us</a>`}/>
          <CopyRow label="QR code image URL"
            value={`https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(url)}`}/>

          <div className="flex items-start gap-2 p-3 rounded-lg bg-blue-50 border border-blue-100">
            <Info size={13} className="text-blue-500 flex-shrink-0 mt-0.5"/>
            <p className="text-[11px] text-blue-800 leading-relaxed">
              The landing page inherits everything from the Widget Builder — colors, fonts,
              avatar and greeting — so anything you change here shows up on the page too.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

const NAV_GROUPS = [
  { label:'Widget Builder', items:[
    { id:'theme',    label:'Theme',        icon:Palette      },
    { id:'branding', label:'Branding',     icon:Sparkles     },
    { id:'behavior', label:'Behavior',     icon:Zap          },
    { id:'lead',     label:'Lead Capture', icon:Users        },
  ]},
  { label:'Configure', items:[
    { id:'questions', label:'Question Types', icon:MessageCircle },
    { id:'landing',   label:'Landing Page',   icon:Globe         },
    { id:'settings',  label:'Settings',       icon:Settings      },
  ]},
]
const BUILDER_SECTIONS = ['theme','branding','behavior','lead','questions']

/* Shared with WebChatLandingPage.jsx — that's a separate route/page, so the
   only way it can see this widget's live look (colors, avatar, greeting,
   launcher icon, everything) is by reading it back out of localStorage
   rather than React state. Exported so the landing page's fallback default
   config can't drift from this one. */
export const WIDGET_CFG_STORAGE_KEY = 'cf_webchat_widget_cfg'

export default function WebChatAppearance() {
  const [section, setSection] = useState('theme')
  const [cfg, setCfg] = useState(() => {
    const defaults = {
    // Theme
    colorMode: 'gradient', color: '#0066ff', colorEnd: '#8B5CF6',
    theme: 'light', corner: 'round', size: 'compact', launcherShape: 'circle',
    position: 'bottom-right', launcherText: 'Chat with us', launcherAnimation: 'pulse',
    // 'match' mirrors the Profile Picture (the long-standing default); switch
    // to 'icon'/'emoji'/'image' to give the launcher its own look.
    launcherIconStyle: 'match', launcherIcon: 'chat', launcherEmoji: '💬', launcherImage: '',
    bubbleStyle: 'ios', fontFamily: 'Inter', fontSizePx: 12,
    // Header can follow the brand, use its own color, or stay a light surface
    headerMode: 'brand', headerColor: '#0066ff', headerColorEnd: '#8B5CF6', headerGradient: false,
    // Bubble surfaces — "question" is the bot's, "answer" is the visitor's
    botBubbleBg: '', botBubbleText: '', userBubbleBg: '', userBubbleText: '', chatBackground: '#ffffff',
    bubbleShadow: 'soft', density: 'comfortable', quickReplyStyle: 'pill',
    borderLight: true,
    msgAnimation: 'slide', showSenderName: true, timestampMode: 'grouped',
    // Branding
    botName: 'ChatBot', tagline: 'We reply instantly',
    greeting: 'Hi! 👋 How can I help you today?',
    avatarStyle: 'icon', avatarEmoji: '🤖', avatarImage: '',
    threadAvatarStyle: 'emoji', threadAvatarEmoji: '🤖', threadAvatarImage: '',
    showBranding: true,
    // Where "Powered by ChatFlow" sends a visitor once they've booked a demo
    // through it. Defaults to this app's own site; set it to the real
    // marketing site in the Widget Builder.
    brandingUrl: '/',
    // Hosted landing page
    landingName: 'Support_Bot', landingEnabled: true,
    // Behavior
    sound: true, emoji: true, attach: true, rating: true,
    typingIndicator: true, readReceipts: true, autoOpenDelay: 0,
    gifPicker: true, voiceInput: true, saveChat: true,
    // Widget tabs — Chat is always on by default
    showHomeTab: false, showChatTab: true, showMessagesTab: false, showFaqTab: false, showBookingTab: false,
    enableVoiceCall: false, enableVideoCall: false,
    googleMapsApiKey: '',
      // Lead capture
      leadName: true, leadEmail: true, leadPhone: false, leadTiming: 'before',
    }
    try {
      const saved = JSON.parse(localStorage.getItem(WIDGET_CFG_STORAGE_KEY) || 'null')
      return saved ? { ...defaults, ...saved } : defaults
    } catch { return defaults }
  })
  // localStorage keeps the builder's own surfaces (the live preview, the
  // landing-page route) instant and offline-tolerant. It is a LOCAL DRAFT
  // CACHE, not the source of truth — widgets installed on merchant websites
  // can never read it, since they run in the visitor's browser.
  useEffect(() => {
    try { localStorage.setItem(WIDGET_CFG_STORAGE_KEY, JSON.stringify(cfg)) } catch {}
  }, [cfg])

  /* The design half of this bot, saved under config.appearance — the SAME bot
     whose flows the Automation section edits under config.flows. One bot, two
     halves: what it looks like and what it does. Pushed to widgets already
     running on visitors' screens. */
  const botId = useBotId()
  usePublishSection(botId, SECTION_APPEARANCE, cfg)
  useLoadSection(botId, SECTION_APPEARANCE, saved => setCfg(prev => ({ ...prev, ...saved })))

  const set = (k, v) => setCfg(p => ({...p, [k]:v}))
  const [device, setDevice] = useState('desktop')
  const [screen, setScreen] = useState('open')
  /* Which tab is actually showing inside the widget — shared with WidgetPreview
     so the outer Closed/Home/Chat switcher can never show a different tab
     highlighted than what the widget itself (including its own internal Home/
     Chat/Inbox tab bar) is currently displaying. */
  const [activeTab, setActiveTab] = useState('home')
  useEffect(() => {
    if (screen === 'chat') setActiveTab('chat')
    else if (screen === 'open') setActiveTab('home')
  }, [screen])
  const [qCat, setQCat] = useState('All')
  const [scrollToQType, setScrollToQType] = useState(null)
  const filteredQuestionTypes = qCat==='All' ? QUESTION_TYPES : QUESTION_TYPES.filter(q=>q.cat===qCat)
  const isBuilder = BUILDER_SECTIONS.includes(section)

  return (
    <div className="h-[calc(100vh-48px)] md:h-screen -mx-3 -mt-3 -mb-3 sm:-mx-5 sm:-mt-5 sm:-mb-5 flex flex-col md:flex-row overflow-hidden">
      {/* ── Section nav rail — a vertical rail on desktop, a horizontally
           scrollable tab strip on phones so the panel below keeps its width ── */}
      <div className="w-full md:w-[240px] flex-shrink-0 border-b md:border-b-0 md:border-r border-surface-border bg-white flex flex-col">
        <div className="hidden md:block px-4 py-3 border-b border-surface-border">
          <div className="flex items-center gap-2 mb-0.5">
            <p className="text-sm font-bold text-slate-800">Widget Appearance</p>
            <span className="text-[9px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 px-1.5 py-0.5 rounded-full flex items-center gap-1 flex-shrink-0">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block animate-pulse"/>Active
            </span>
          </div>
          <p className="text-[10px] text-slate-400">Design, configure and preview</p>
        </div>
        <div className="flex md:flex-col md:flex-1 overflow-x-auto md:overflow-x-visible md:overflow-y-auto md:py-2 wc-scroll overscroll-contain">
          {NAV_GROUPS.map(g=>(
            <div key={g.label} className="flex md:block md:mb-1 flex-shrink-0">
              <p className="hidden md:block px-4 pt-2 pb-1 text-[9px] font-bold text-slate-400 uppercase tracking-wider">{g.label}</p>
              {g.items.map(it=>(
                <button key={it.id} onClick={()=>setSection(it.id)}
                  className={clsx('flex items-center gap-2 md:gap-2.5 px-3.5 md:px-4 py-2.5 md:py-2 text-left text-[12px] font-semibold transition-colors whitespace-nowrap flex-shrink-0 md:w-full border-b-2 md:border-b-0 md:border-r-2',
                    section===it.id ? 'bg-primary-50 text-primary border-primary' : 'text-slate-600 hover:bg-surface-hover border-transparent')}>
                  <it.icon size={14} className="flex-shrink-0"/>{it.label}
                </button>
              ))}
            </div>
          ))}
        </div>
        <div className="hidden md:block p-3 border-t border-surface-border space-y-1.5 flex-shrink-0">
          <Link to="/webchat"
            className="w-full flex items-center justify-center gap-1.5 py-2 rounded-lg border border-surface-border bg-white text-slate-600 text-[11px] font-semibold hover:bg-surface-hover transition-colors">
            <Zap size={12}/> Flow Designer
          </Link>
          <button onClick={() => window.open(buildLocalLandingUrl(cfg.landingName), '_blank')}
            className="w-full flex items-center justify-center gap-1.5 py-2 rounded-lg bg-primary text-white text-[11px] font-semibold hover:bg-primary-hover transition-colors">
            <ExternalLink size={12}/> Preview Widget
          </button>
        </div>
      </div>

      {/* ── Content panel ── */}
      {/* Always visible. This was `hidden md:flex`, which made the whole config +
          preview area vanish below 768 CSS px — including on normal screens at
          150–200% browser zoom, where only the section rail remained. */}
      <div className="flex-1 flex flex-col bg-white overflow-hidden min-w-0">
        {isBuilder ? (
          /* Two independent columns — config scrolls on its own, the widget preview
             stays pinned in view. A CSS grid with an `xl:` breakpoint collapsed to a
             single column here (the content area is only ~700px wide once the app
             sidebar + section rail are subtracted), which pushed the preview far
             below the fold. Flex avoids the breakpoint trap entirely. */
          <div className="flex-1 flex flex-col lg:flex-row-reverse overflow-y-auto lg:overflow-hidden min-h-0 overscroll-contain">
            {/* Preview first in the DOM so it sits on top when stacked on narrow
                screens; `lg:flex-row-reverse` puts it back on the right on desktop.
                The min-height stops the stage collapsing to ~0 when stacked — but
                only needs to be tall when the widget itself is (Home/Chat). A
                fixed 560-620px min-height regardless of content left a huge empty
                gap above the config panel whenever the preview was just the small
                Closed launcher. */}
            {/* This stage always fills the full height it's given (default flex
                behavior, both as a row-item at lg+ and a column-item below it) —
                that total height is genuinely known and definite. Rather than
                guess a pixel height for the widget and hope it fits, the switcher
                row keeps its own natural size (flex-shrink-0) and the preview
                slot below it is flex-1 min-h-0, which hands it exactly
                "everything left over" with zero ambiguity. The widget itself
                then fills that slot at 100% height, capped at a comfortable
                maxHeight so it doesn't become oversized on very tall monitors —
                guaranteed to fit with no scrolling on any screen, and evenly
                centered with real space above and below whenever there's slack. */}
            <div className="flex-1 min-w-0 flex flex-col p-4 sm:p-5 gap-3 min-h-[480px] lg:min-h-0"
              style={{ background: 'radial-gradient(circle at 30% 20%, #eef2f7 0%, #e6ebf2 100%)' }}>
              <div className="flex items-center justify-center gap-2 flex-shrink-0">
                <div className="flex items-center gap-0.5 bg-slate-100 p-0.5 rounded-lg shadow-sm border border-slate-200/60">
                  {[{s:'closed',l:'Closed'},{s:'open',l:'Home'},{s:'chat',l:'Chat'}].map(sc=>{
                    /* Highlighted state follows activeTab (what's actually on
                       screen, including navigation from the widget's own internal
                       tab bar), not just this switcher's own last click — so it
                       can never show "Home" selected while the widget is really
                       showing the chat thread. */
                    const isActive = sc.s==='closed' ? screen==='closed'
                      : screen!=='closed' && activeTab === (sc.s==='chat' ? 'chat' : 'home')
                    return (
                      <button key={sc.s} onClick={()=>{ setScreen(sc.s); if (sc.s!=='closed') setActiveTab(sc.s==='chat'?'chat':'home') }}
                        className={clsx('px-2.5 py-1 rounded-md text-[10px] font-semibold transition-all',
                          isActive ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700')}>
                        {sc.l}
                      </button>
                    )
                  })}
                </div>
                <div className="flex items-center gap-0.5 bg-slate-100 p-0.5 rounded-lg shadow-sm border border-slate-200/60">
                  {[{d:'desktop',I:Monitor},{d:'tablet',I:Tablet},{d:'mobile',I:Smartphone}].map(({d,I})=>(
                    <button key={d} onClick={()=>setDevice(d)}
                      className={clsx('p-1.5 rounded-md transition-all',
                        device===d ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-400 hover:text-slate-600')}>
                      <I size={12}/>
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex-1 min-h-0 lg:overflow-visible overflow-y-auto overscroll-contain">
                <WidgetPreview cfg={cfg} screen={screen} device={device}
                  activeTab={activeTab} setActiveTab={setActiveTab} setScreen={setScreen}
                  previewQuestionTypes={section==='questions' ? filteredQuestionTypes : null}
                  scrollToQType={section==='questions' ? scrollToQType : null}/>
              </div>
            </div>
            <div className="w-full lg:w-[300px] flex-shrink-0 lg:overflow-y-auto overscroll-contain border-t lg:border-t-0 lg:border-r border-surface-border bg-white">
              <div className="px-5 py-4 space-y-3.5">
                <BuilderSectionBody section={section} cfg={cfg} set={set} setScreen={setScreen}
                  setScrollToQType={setScrollToQType} qCat={qCat} setQCat={setQCat}/>
                {section !== 'questions' && (
                  <button className="btn-primary w-full justify-center gap-2">
                    <Check size={13}/> Save Widget Settings
                  </button>
                )}
              </div>
            </div>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto p-5 bg-slate-50/40">
            {section==='landing' ? <LandingPageTab cfg={cfg} set={set}/>
              : <SettingsTab/>}
          </div>
        )}
      </div>
    </div>
  )
}
