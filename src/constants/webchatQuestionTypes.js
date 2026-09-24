// Web Chat's own question-type catalog — shared by WebChat.jsx (Question Types tab)
// and WebChatFlowBuilder.jsx (auto-generates one "ask_<id>" node per entry), kept in
// its own module so the two pages can import it without a circular dependency.
import {
  Type, AlignJustify, Hash, Mail, Phone, Link2, Circle, CheckSquare, ChevronDown,
  ToggleLeft, Star, BarChart2, Calendar, Clock, Upload, Image, Pencil, MapPin,
  CreditCard, Lock, FileText, Images, Layers, ShoppingBag,
  Megaphone, HelpCircle, Sparkles, ShieldCheck, BadgeCheck, Truck, Calculator,
} from 'lucide-react'

/* 'Content' covers the types where the bot is telling rather than asking — a
   statement, a browsable FAQ, an AI answer. They still take a turn in the flow
   and still record something, which is why they are question types and not
   send-only blocks, but grouping them with Text or Choice would bury them. */
export const QUESTION_CATS = ['All', 'Text', 'Choice', 'Date & Time', 'Media', 'Special', 'Content', 'Interactive']

export const QUESTION_TYPES = [
  /* Text */
  { id:'short',     cat:'Text',        icon:Type,         name:'Short Text',      desc:'Single-line free text answer',            color:'#3B82F6' },
  { id:'long',      cat:'Text',        icon:AlignJustify, name:'Long Text',        desc:'Multi-line paragraph response',           color:'#3B82F6' },
  { id:'number',    cat:'Text',        icon:Hash,         name:'Number',           desc:'Numeric input with min/max validation',   color:'#3B82F6' },
  { id:'email',     cat:'Text',        icon:Mail,         name:'Email',            desc:'Email address with format validation',    color:'#3B82F6' },
  { id:'phone',     cat:'Text',        icon:Phone,        name:'Phone',            desc:'Phone with country code selector',        color:'#3B82F6' },
  { id:'url',       cat:'Text',        icon:Link2,        name:'URL / Website',    desc:'Web URL with protocol validation',        color:'#3B82F6' },
  /* Choice */
  { id:'single',    cat:'Choice',      icon:Circle,       name:'Single Choice',    desc:'Pick one option from a button list',      color:'#8B5CF6' },
  { id:'multi',     cat:'Choice',      icon:CheckSquare,  name:'Multiple Choice',  desc:'Select one or more from a list',          color:'#8B5CF6' },
  { id:'dropdown',  cat:'Choice',      icon:ChevronDown,  name:'Dropdown',         desc:'Pick from a scrollable select menu',      color:'#8B5CF6' },
  { id:'yesno',     cat:'Choice',      icon:ToggleLeft,   name:'Yes / No',         desc:'Simple binary choice buttons',            color:'#8B5CF6' },
  { id:'rating',    cat:'Choice',      icon:Star,         name:'Star Rating',      desc:'1–5 star satisfaction rating',            color:'#8B5CF6' },
  { id:'nps',       cat:'Choice',      icon:BarChart2,    name:'NPS Score',        desc:'Net Promoter Score 0–10 scale',           color:'#8B5CF6' },
  /* Date & Time */
  { id:'date',      cat:'Date & Time', icon:Calendar,     name:'Date',             desc:'Single date picker (calendar UI)',        color:'#10B981' },
  { id:'daterange', cat:'Date & Time', icon:Calendar,     name:'Date Range',       desc:'Start and end date picker',               color:'#10B981' },
  { id:'time',      cat:'Date & Time', icon:Clock,        name:'Time',             desc:'Time picker with AM/PM or 24h',           color:'#10B981' },
  { id:'appt',      cat:'Date & Time', icon:Calendar,     name:'Appointment',      desc:'Book a slot from available time slots',   color:'#10B981' },
  /* Media */
  { id:'file',      cat:'Media',       icon:Upload,       name:'File Upload',      desc:'Upload any file type (PDF, DOC, etc.)',   color:'#F59E0B' },
  { id:'image',     cat:'Media',       icon:Image,        name:'Image Upload',     desc:'Upload images with preview thumbnail',    color:'#F59E0B' },
  { id:'signature', cat:'Media',       icon:Pencil,       name:'Signature',        desc:'Draw or type a digital signature',        color:'#F59E0B' },
  /* Special */
  { id:'location',  cat:'Special',     icon:MapPin,       name:'Location',         desc:'Address autocomplete or map pin drop',    color:'#EF4444' },
  { id:'payment',   cat:'Special',     icon:CreditCard,   name:'Payment',          desc:'Secure card/UPI payment collection',      color:'#EF4444' },
  { id:'otp',       cat:'Special',     icon:Lock,         name:'OTP Verify',       desc:'Verify phone/email with a 6-digit OTP',  color:'#EF4444' },
  { id:'consent',   cat:'Special',     icon:ShieldCheck,  name:'Consent',          desc:'Explicit opt-in that records what was agreed', color:'#EF4444' },
  { id:'verify_doc',cat:'Special',     icon:BadgeCheck,   name:'Verify Document',  desc:'Upload an ID document and have it checked', color:'#EF4444' },
  { id:'shipment_booking', cat:'Special', icon:Truck,      name:'Shipment Booking', desc:'Pickup, delivery, package details and 1-click book', color:'#EF4444' },
  { id:'shipment_calculation', cat:'Special', icon:Calculator, name:'Rate Calculator', desc:'Pickup, delivery and package details → instant rate estimate', color:'#EF4444' },
  /* Content — the bot tells, shows or answers */
  { id:'statement', cat:'Content',     icon:Megaphone,    name:'Statement',        desc:'Say something and wait for acknowledgement', color:'#64748B' },
  { id:'faq',       cat:'Content',     icon:HelpCircle,   name:'FAQ',              desc:'Browse common questions and their answers', color:'#0EA5E9' },
  { id:'ai_answer', cat:'Content',     icon:Sparkles,     name:'AI Answer',        desc:'Ask anything, answered from your knowledge base', color:'#8B5CF6' },
  /* Interactive — rich, multi-item message blocks */
  { id:'form',            cat:'Interactive', icon:FileText,    name:'Multi-field Form',       desc:'Collect several fields in one inline form',      color:'#0EA5E9' },
  { id:'carousel',        cat:'Interactive', icon:Images,      name:'Image Carousel',         desc:'Swipeable cards with image, title & description', color:'#0EA5E9' },
  { id:'carousel_buttons',cat:'Interactive', icon:Layers,      name:'Carousel with Buttons',  desc:'Swipeable cards, each with its own action button', color:'#0EA5E9' },
  { id:'catalog',         cat:'Interactive', icon:ShoppingBag, name:'Product Catalog',        desc:'Scrollable grid of products with price & Add to cart', color:'#0EA5E9' },
]
