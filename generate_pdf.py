from reportlab.lib.pagesizes import A4, landscape
from reportlab.lib import colors
from reportlab.lib.units import mm
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle,
    HRFlowable, KeepTogether
)
from reportlab.lib.styles import ParagraphStyle
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import Flowable
import os

# ── Fonts ──────────────────────────────────────────────────────────────────
FONT_DIR = r"C:\Windows\Fonts"

def reg(name, file):
    pdfmetrics.registerFont(TTFont(name, os.path.join(FONT_DIR, file)))

reg("Inter",         "Inter-Regular.ttf")
reg("Inter-Medium",  "Inter-Medium.ttf")
reg("Inter-SemiBold","Inter-SemiBold.ttf")
reg("Inter-Bold",    "Inter-Bold.ttf")
reg("Inter-ExtraBold","Inter-ExtraBold.ttf")

# ── Colors ─────────────────────────────────────────────────────────────────
C_BRAND   = colors.HexColor("#2563eb")
C_START   = colors.HexColor("#0e7490")
C_PRO     = colors.HexColor("#6d28d9")
C_FREE    = colors.HexColor("#475569")
C_YES     = colors.HexColor("#16a34a")
C_ADDON   = colors.HexColor("#b45309")
C_TEXT    = colors.HexColor("#0f172a")
C_MUTED   = colors.HexColor("#64748b")
C_BORDER  = colors.HexColor("#e2e8f0")
C_BG      = colors.HexColor("#f1f5f9")
C_CARD    = colors.white
C_LIGHT   = colors.HexColor("#f8fafc")
C_YES_BG  = colors.HexColor("#dcfce7")
C_ADDON_BG= colors.HexColor("#fffbeb")
C_ADDON_BD= colors.HexColor("#fde68a")
C_PRO_BG  = colors.HexColor("#ede9fe")
C_START_BG= colors.HexColor("#ecfeff")
C_FREE_BG = colors.HexColor("#f1f5f9")
C_GRP     = colors.HexColor("#f8fafc")
C_WARN_BG = colors.HexColor("#fffbeb")
C_WARN_BD = colors.HexColor("#fde68a")
C_WARN_TX = colors.HexColor("#92400e")

W, H = landscape(A4)
MARGIN = 14*mm

# ── Styles ─────────────────────────────────────────────────────────────────
def S(name, font="Inter", size=9, color=C_TEXT, leading=None, align=0, space_before=0, space_after=0):
    return ParagraphStyle(
        name, fontName=font, fontSize=size,
        textColor=color,
        leading=leading or size * 1.35,
        alignment=align,
        spaceBefore=space_before,
        spaceAfter=space_after,
    )

s_hero_title = S("hero_title",  "Inter-ExtraBold", 22, C_TEXT,    leading=26, align=1)
s_hero_sub   = S("hero_sub",    "Inter",           10, C_MUTED,   leading=15, align=1)
s_eyebrow    = S("eyebrow",     "Inter-Bold",       7, C_BRAND,   align=1)

s_plan_tag   = S("plan_tag",    "Inter-Bold",       7)
s_plan_name  = S("plan_name",   "Inter-Bold",      13, C_TEXT)
s_plan_price = S("plan_price",  "Inter-ExtraBold", 22, C_TEXT)
s_plan_range = S("plan_range",  "Inter",            7.5, C_MUTED)
s_feat_item  = S("feat_item",   "Inter-Medium",    8,  colors.HexColor("#334155"))

s_sec_title  = S("sec_title",   "Inter-Bold",      12, C_TEXT,    space_before=4, space_after=4)
s_th         = S("th",          "Inter-Bold",       7.5, C_MUTED, align=1)
s_th_col     = S("th_col",      "Inter-Bold",       7.5, C_MUTED, align=1)
s_td         = S("td",          "Inter-Medium",     8,  C_TEXT)
s_td_c       = S("td_c",        "Inter-Medium",     8,  C_TEXT,   align=1)
s_td_val     = S("td_val",      "Inter-SemiBold",   8,  C_TEXT,   align=1)
s_grp        = S("grp",         "Inter-Bold",       6.5, C_MUTED)
s_tick       = S("tick",        "Inter-Bold",       8,  C_YES,    align=1)
s_cross      = S("cross",       "Inter",            9,  C_BORDER, align=1)
s_addon_lbl  = S("addon_lbl",   "Inter-SemiBold",   7,  C_ADDON,  align=1)
s_notice     = S("notice",      "Inter-Medium",     8,  C_WARN_TX)
s_notice_b   = S("notice_b",    "Inter-Bold",       8,  C_WARN_TX)

s_addon_name = S("addon_name",  "Inter-SemiBold",   8.5, C_TEXT)
s_addon_unit = S("addon_unit",  "Inter",             7,  C_MUTED)
s_addon_inr  = S("addon_inr",   "Inter-Bold",       10, C_BRAND,  align=2)
s_addon_usd  = S("addon_usd",   "Inter",             7,  C_MUTED,  align=2)

# ── Helpers ────────────────────────────────────────────────────────────────
def tick():  return Paragraph("✓", s_tick)
def cross(): return Paragraph("—", s_cross)
def addon(): return Paragraph("+ Add-on", s_addon_lbl)

def pill(text, bg, fg):
    return Paragraph(
        f'<font color="{fg.hexval()}">{text.upper()}</font>',
        ParagraphStyle("pill", fontName="Inter-Bold", fontSize=6.5,
                       textColor=fg, backColor=bg, leading=9,
                       borderPadding=(2, 6, 2, 6))
    )

def section_title(text):
    return KeepTogether([
        Paragraph(text, s_sec_title),
        HRFlowable(width="100%", thickness=1, color=C_BORDER, spaceAfter=8),
    ])

# ── Plan Cards ─────────────────────────────────────────────────────────────
def make_plan_card(tag_text, tag_bg, tag_fg, name, price_text, price_color,
                   range_text, features, featured=False):
    border_color = tag_fg if featured else C_BORDER
    rows = []

    tag_p = Paragraph(
        f'<font color="{tag_fg.hexval()}">{tag_text.upper()}</font>',
        ParagraphStyle("ct", fontName="Inter-Bold", fontSize=6, textColor=tag_fg, leading=8)
    )
    rows.append([tag_p])

    rows.append([Paragraph(name, s_plan_name)])
    rows.append([Paragraph(price_text, ParagraphStyle(
        "pp", fontName="Inter-ExtraBold", fontSize=20,
        textColor=price_color, leading=24
    ))])
    rows.append([Paragraph(range_text, s_plan_range)])
    rows.append([HRFlowable(width="100%", thickness=0.5, color=C_BORDER)])

    for f in features:
        rows.append([Paragraph(f"<font color='#16a34a'>✓</font>  {f}", s_feat_item)])

    t = Table([[r[0]] for r in rows], colWidths=[None])
    style = [
        ("BOX",        (0,0), (-1,-1), 1.5 if featured else 1, border_color),
        ("BACKGROUND", (0,0), (-1,-1), C_CARD),
        ("TOPPADDING",    (0,0), (-1,-1), 4),
        ("BOTTOMPADDING", (0,0), (-1,-1), 4),
        ("LEFTPADDING",   (0,0), (-1,-1), 10),
        ("RIGHTPADDING",  (0,0), (-1,-1), 10),
        ("TOPPADDING",    (0,0), (0,0), 10),
        ("BOTTOMPADDING", (0,-1), (0,-1), 12),
        ("ROUNDEDCORNERS", [6]),
    ]
    t.setStyle(TableStyle(style))
    return t

# ── Feature Table ──────────────────────────────────────────────────────────
def make_feature_table():
    col_w = [None, 24*mm, 26*mm, 24*mm, 26*mm, 26*mm]

    def th(text, color=C_MUTED):
        return Paragraph(text.upper(), ParagraphStyle(
            "tth", fontName="Inter-Bold", fontSize=7, textColor=color,
            leading=9, alignment=1
        ))

    def td_left(text):
        return Paragraph(text, ParagraphStyle(
            "tdl", fontName="Inter-Medium", fontSize=8, textColor=C_TEXT,
            leading=10
        ))

    def td_val(text):
        return Paragraph(text, ParagraphStyle(
            "tdv", fontName="Inter-SemiBold", fontSize=8, textColor=C_TEXT,
            leading=10, alignment=1
        ))

    def grp(text):
        return Paragraph(text.upper(), ParagraphStyle(
            "grp", fontName="Inter-Bold", fontSize=6.5, textColor=C_MUTED,
            leading=9, letterSpacing=0.8
        ))

    TICK  = Paragraph('<font color="#16a34a">✓</font>',
                      ParagraphStyle("tk", fontName="Inter-Bold", fontSize=9,
                                     textColor=C_YES, leading=11, alignment=1))
    CROSS = Paragraph('—', ParagraphStyle("cx", fontName="Inter", fontSize=8,
                                          textColor=C_BORDER, leading=11, alignment=1))
    ADDON = Paragraph('+ Add-on', ParagraphStyle(
        "ao", fontName="Inter-SemiBold", fontSize=7, textColor=C_ADDON,
        leading=9, alignment=1
    ))

    def T(): return Paragraph('<font color="#16a34a">✓</font>',
                              ParagraphStyle("tk2", fontName="Inter-Bold", fontSize=9,
                                             textColor=C_YES, leading=11, alignment=1))
    def X(): return Paragraph('—', ParagraphStyle("cx2", fontName="Inter", fontSize=8,
                                                   textColor=C_BORDER, leading=11, alignment=1))
    def A(): return Paragraph('+ Add-on', ParagraphStyle(
        "ao2", fontName="Inter-SemiBold", fontSize=7, textColor=C_ADDON, leading=9, alignment=1))

    def onreq():
        return Paragraph("On Request", ParagraphStyle(
            "onreq", fontName="Inter-SemiBold", fontSize=7,
            textColor=colors.HexColor("#6d28d9"), leading=9, alignment=1
        ))

    rows = [
        # Header
        [th("Feature"), th("Free", C_FREE), th("Starter", C_START), th("Starter WhatsApp", C_START), th("Pro", C_PRO), th("Pro WhatsApp", C_PRO)],

        # Quotas
        [grp("Quotas"), "", "", "", "", ""],
        [td_left("Price / Month"),         td_val("Rs.0"),  td_val("Rs.1,890"), td_val("Rs.2,890"), td_val("Rs.5,500"), td_val("Rs.6,500")],
        [td_left("Price / Month (Annual)"),td_val("Rs.0"),  td_val("Rs.1,490"), td_val("Rs.2,390"), td_val("Rs.4,700"), td_val("Rs.6,000")],
        [td_left("Price / Year (Annual Billing)"),td_val("Rs.0"), td_val("Rs.17,880"), td_val("Rs.28,680"), td_val("Rs.56,400"), td_val("Rs.72,000")],
        [td_left("WA UI Chats / Month"),   X(),             X(),               td_val("1,000"),         X(),                 td_val("5,000")],
        [td_left("WA BI Chats / Month"),   td_val("0"),     td_val("0"),       td_val("0"),              td_val("0"),         td_val("0")],
        [td_left("Website Chats / Month"), X(),             td_val("1,000"),   td_val("1,000"),          td_val("5,000"),    td_val("5,000")],
        [td_left("Chatbots"),              td_val("1"),     td_val("5"),       td_val("5"),              td_val("10"),       td_val("10")],
        [td_left("Channels"),              td_val("Limited"),td_val("Limited"), td_val("Limited"),       td_val("All (no WA)"), td_val("All Channels")],
        [td_left("WhatsApp Features"),     X(),             X(),               T(),                      X(),                T()],

        # Core Features
        [grp("Core Features"), "", "", "", "", ""],
        [td_left("Live Agents"),           X(), X(), X(), td_val("3 agents"), td_val("3 agents")],
        [td_left("Canned Responses"),      X(), X(), X(), T(), T()],
        [td_left("Template Text Replies"), X(), X(), X(), X(), T()],
        [td_left("WhatsApp Cart & Catalog"),X(), X(), X(), X(), T()],
        [td_left("Template Button Click Responses"),X(), X(), X(), X(), T()],
        [td_left("Instagram"),             X(), X(), X(), T(), T()],
        [td_left("AI Agent (Dialogflow)"), X(), X(), X(), T(), T()],
        [td_left("Voice (Speech to Text)"),X(), X(), X(), T(), T()],
        [td_left("Reply from Bot Chats (Admin)"),  X(), X(), X(), T(), T()],
        [td_left("Custom Google Sheet"),   X(), T(), T(), T(), T()],
        [td_left("AdWords Tracking"),      X(), T(), T(), T(), T()],
        [td_left("Facebook Pixel"),        X(), X(), X(), T(), T()],
        [td_left("Store User Session"),    T(), T(), T(), T(), T()],
        [td_left("Webpage Closing Alert"), T(), T(), T(), T(), T()],
        [td_left("WhatsApp Co-Existence"), X(), X(), T(), X(), T()],
        [td_left("Dynamic Responses"),     T(), T(), T(), T(), T()],

        # Add-ons
        [grp("Available as Add-on (Paid Plans)"), "", "", "", "", ""],
        [td_left("CRM"),                       X(), onreq(), onreq(), T(), T()],
        [td_left("Languages"),                 X(), A(), A(), A(), A()],
        [td_left("Multi Lingual (Upto 2 Languages)"),X(), A(), A(), T(), T()],
        [td_left("BI Chats"),                  X(), A(), A(), A(), A()],
        [td_left("Media Upload"),              X(), A(), A(), A(), A()],
        [td_left("WhatsApp Lead Notifications"),X(), A(), A(), A(), A()],
        [td_left("SMS OTPs"),                  X(), A(), A(), A(), A()],
        [td_left("WhatsApp OTPs"),              X(), A(), A(), A(), A()],
        [td_left("SMS Notifications"),          X(), A(), A(), A(), A()],
        [td_left("WhatsApp Notifications"),     X(), A(), A(), A(), A()],
        [td_left("ChatGPT"),                   X(), A(), A(), A(), A()],
        [td_left("Text to Speech"),            X(), A(), A(), A(), A()],
        [td_left("Remove Branding"),           X(), A(), A(), A(), A()],
        [td_left("Basic / Premium Support"),   X(), A(), A(), A(), A()],

        # Notifications
        [grp("Notifications"), "", "", "", "", ""],
        [td_left("Lead Email"),            T(), T(), T(), T(), T()],
        [td_left("Email OTP"),             X(), T(), T(), T(), T()],
        [td_left("Hot Lead Email"),        X(), T(), T(), T(), T()],
        [td_left("Auto Email Follow-up"),  X(), X(), X(), T(), T()],

        # Security
        [grp("Security"), "", "", "", "", ""],
        [td_left("Standard Protocols"),        T(), T(), T(), T(), T()],
        [td_left("Authentication"),            T(), T(), T(), T(), T()],
        [td_left("Restrict to Company Email"), T(), T(), T(), T(), T()],
        [td_left("Two-Factor Auth (2FA)"),     X(), T(), T(), T(), T()],
        [td_left("Lead Data Masking"),         X(), X(), X(), T(), T()],
    ]

    # Identify group rows (0-indexed)
    group_rows = {1, 11, 28, 43, 48}

    style = [
        ("FONTNAME",    (0,0), (-1,-1), "Inter"),
        ("FONTSIZE",    (0,0), (-1,-1), 8),
        ("ROWBACKGROUNDS", (0,1), (-1,-1), [C_CARD, C_LIGHT]),
        ("BACKGROUND",  (0,0), (-1,0), C_LIGHT),
        ("LINEBELOW",   (0,0), (-1,0), 1.5, C_BORDER),
        ("GRID",        (0,0), (-1,-1), 0.5, C_BORDER),
        ("TOPPADDING",  (0,0), (-1,-1), 6),
        ("BOTTOMPADDING",(0,0),(-1,-1), 6),
        ("LEFTPADDING", (0,0), (-1,-1), 8),
        ("RIGHTPADDING",(0,0), (-1,-1), 8),
        ("VALIGN",      (0,0), (-1,-1), "MIDDLE"),
        ("BOX",         (0,0), (-1,-1), 1, C_BORDER),
    ]

    for r in group_rows:
        style += [
            ("BACKGROUND",    (0,r), (-1,r), C_GRP),
            ("SPAN",          (0,r), (-1,r)),
            ("TOPPADDING",    (0,r), (-1,r), 7),
            ("BOTTOMPADDING", (0,r), (-1,r), 7),
            ("LINEABOVE",     (0,r), (-1,r), 0.5, C_BORDER),
        ]

    t = Table(rows, colWidths=col_w, repeatRows=1)
    t.setStyle(TableStyle(style))
    return t

# ── Add-on Pricing Table ─────────────────────────────────────────────────
ADDONS = [
    ("Chatbots",               "Rs.1,000", "$13",  "Rs.9,600",   "$120"),
    ("Live Agent",             "Rs.1,000", "$13",  "Rs.9,600",   "$120"),
    ("BI Chats (per 1,000 chats/month)",  "Rs.200",   "$3",   "Rs.2,400",   "$40"),
    ("UI Chats (per 1,000 chats/month)",  "Rs.200",   "$3",   "Rs.2,400",   "$40"),
    ("Languages",              "Rs.1,000", "$13",  "Rs.9,600",   "$120"),
    ("AI Agent (Dialogflow)",  "Rs.1,000", "$13",  "Rs.9,600",   "$120"),
    ("CRM",                    "Rs.1,000", "$13",  "Rs.9,600",   "$120"),
    ("SMS OTPs",               "Rs.500",   "$8",   "Rs.6,000",   "$100"),
    ("WhatsApp OTPs",          "Rs.500",   "$8",   "Rs.6,000",   "$100"),
    ("SMS Notifications",      "Rs.500",   "$8",   "Rs.6,000",   "$100"),
    ("WhatsApp Notifications", "Rs.500",   "$8",   "Rs.6,000",   "$100"),
    ("Website Chats (per 1,000 chats/month)", "Rs.600", "$8", "Rs.7,200", "$90"),
    ("Media Upload",           "Rs.800",   "$10",  "Rs.9,600",   "$120"),
    ("Text to Speech",         "Rs.800",   "$10",  "Rs.7,200",   "$90"),
    ("ChatGPT",                "Rs.2,000", "$26",  "Rs.24,000",  "$312"),
    ("Remove Branding",        "Rs.1,900", "$30",  "Rs.20,280",  "$300"),
    ("Basic Support",          "Rs.6,999", "$90",  "Rs.71,988",  "$900"),
    ("Premium Support",        "Rs.14,999","$185", "Rs.143,988", "$1,800"),
]

def make_addon_table():
    def th(text):
        return Paragraph(text.upper(), ParagraphStyle(
            "ath", fontName="Inter-Bold", fontSize=7, textColor=C_MUTED,
            leading=9, alignment=1
        ))
    def name(t): return Paragraph(t, ParagraphStyle(
        "an", fontName="Inter-SemiBold", fontSize=8, textColor=C_TEXT, leading=10))
    def inr(t):  return Paragraph(t, ParagraphStyle(
        "ai", fontName="Inter-SemiBold", fontSize=8, textColor=C_TEXT, leading=10, alignment=1))
    def usd(t):  return Paragraph(t, ParagraphStyle(
        "au", fontName="Inter", fontSize=8, textColor=C_MUTED, leading=10, alignment=1))

    rows = [[th("Service"), th("Monthly (INR)"), th("Monthly (USD)"), th("Yearly (INR)"), th("Yearly (USD)")]]
    for a in ADDONS:
        rows.append([name(a[0]), inr(a[1]), usd(a[2]), inr(a[3]), usd(a[4])])

    name_w = (W - 2*MARGIN) * 0.32
    rest_w = (W - 2*MARGIN - name_w) / 4
    col_w = [name_w, rest_w, rest_w, rest_w, rest_w]
    t = Table(rows, colWidths=col_w, hAlign="LEFT", repeatRows=1)
    style = [
        ("FONTNAME",    (0,0), (-1,-1), "Inter"),
        ("BACKGROUND",  (0,0), (-1,0), C_LIGHT),
        ("LINEBELOW",   (0,0), (-1,0), 1.5, C_BORDER),
        ("GRID",        (0,0), (-1,-1), 0.5, C_BORDER),
        ("ROWBACKGROUNDS", (0,1), (-1,-1), [C_CARD, C_LIGHT]),
        ("TOPPADDING",  (0,0), (-1,-1), 7),
        ("BOTTOMPADDING",(0,0),(-1,-1), 7),
        ("LEFTPADDING", (0,0), (-1,-1), 10),
        ("RIGHTPADDING",(0,0), (-1,-1), 10),
        ("VALIGN",      (0,0), (-1,-1), "MIDDLE"),
        ("BOX",         (0,0), (-1,-1), 1, C_BORDER),
    ]
    t.setStyle(TableStyle(style))
    return t

# ── Document ───────────────────────────────────────────────────────────────
OUTPUT = r"C:\Users\Deepak\Music\claude\smatbot-pricing.pdf"

doc = SimpleDocTemplate(
    OUTPUT, pagesize=landscape(A4),
    leftMargin=MARGIN, rightMargin=MARGIN,
    topMargin=MARGIN, bottomMargin=MARGIN,
)

story = []

# Hero
hero_data = [[
    Paragraph("PRICING &amp; PLANS", ParagraphStyle(
        "ey", fontName="Inter-Bold", fontSize=7, textColor=C_BRAND,
        leading=9, alignment=1, spaceAfter=6
    )),
]]
hero_data += [[Paragraph("Simple, Transparent Pricing", s_hero_title)]]
hero_data += [[Paragraph("Choose the plan that fits your business. Scale up with add-ons anytime.", s_hero_sub)]]

hero_t = Table(hero_data, colWidths=[W - 2*MARGIN])
hero_t.setStyle(TableStyle([
    ("BACKGROUND",    (0,0), (-1,-1), C_CARD),
    ("BOX",           (0,0), (-1,-1), 1, C_BORDER),
    ("TOPPADDING",    (0,0), (-1,-1), 8),
    ("BOTTOMPADDING", (0,0), (-1,-1), 8),
    ("LEFTPADDING",   (0,0), (-1,-1), 20),
    ("RIGHTPADDING",  (0,0), (-1,-1), 20),
    ("TOPPADDING",    (0,0), (0,0), 20),
    ("BOTTOMPADDING", (0,2), (0,2), 20),
]))
story.append(hero_t)
story.append(Spacer(1, 14))

# Plan cards
card_w = (W - 2*MARGIN - 16*mm) / 5

free_card = make_plan_card(
    "Free", C_FREE_BG, C_FREE,
    "Free Forever", "Rs. 0 / mo", C_FREE,
    "No credit card required",
    ["1 Chatbot", "Limited channels", "Lead email notifications", "Standard security protocols"]
)
starter_card = make_plan_card(
    "Starter", C_START_BG, C_START,
    "Starter", "Rs. 1,890 / mo", C_START,
    "Rs.1,490/mo billed annually",
    ["5 Chatbots", "1,000 Website chats/month", "No WhatsApp features",
     "Custom Google Sheet", "AdWords Tracking", "Two-Factor Authentication"]
)
starter_wa_card = make_plan_card(
    "Starter WhatsApp", C_START_BG, C_START,
    "Starter WhatsApp", "Rs. 2,890 / mo", C_START,
    "Rs.2,390/mo billed annually",
    ["5 Chatbots", "1,000 UI chats/month", "1,000 Website chats/month", "Custom Google Sheet",
     "AdWords Tracking", "Email OTP & Hot Lead alerts", "Two-Factor Authentication"]
)
pro_card = make_plan_card(
    "Pro", C_PRO_BG, C_PRO,
    "Pro", "Rs. 5,500 / mo", C_PRO,
    "Rs.4,700/mo billed annually",
    ["10 Chatbots", "5,000 Website chats/month", "No WhatsApp features",
     "3 Live Agents included", "AI Agent with Dialogflow",
     "CRM & Custom Google Sheet", "Voice (Speech to Text)",
     "Multi Lingual (Upto 2 Languages)",
     "Lead Data Masking", "Auto Email Follow-up"]
)
pro_wa_card = make_plan_card(
    "Pro WhatsApp", C_PRO_BG, C_PRO,
    "Pro WhatsApp", "Rs. 6,500 / mo", C_PRO,
    "Rs.6,000/mo billed annually",
    ["10 Chatbots", "5,000 UI chats/month", "5,000 Website chats/month", "3 Live Agents included",
     "All channels incl. Instagram", "AI Agent with Dialogflow",
     "CRM & Custom Google Sheet", "Voice (Speech to Text)",
     "Multi Lingual (Upto 2 Languages)",
     "Lead Data Masking", "Auto Email Follow-up"],
    featured=True
)

cards = [free_card, starter_card, starter_wa_card, pro_card, pro_wa_card]
cards_table = Table([cards], colWidths=[card_w]*5, hAlign="LEFT")
pad_style = [
    ("TOPPADDING",    (0,0), (-1,-1), 0),
    ("BOTTOMPADDING", (0,0), (-1,-1), 0),
    ("VALIGN",        (0,0), (-1,-1), "TOP"),
]
for i in range(5):
    pad_style.append(("LEFTPADDING",  (i,0), (i,0), 0 if i == 0 else 4))
    pad_style.append(("RIGHTPADDING", (i,0), (i,0), 0 if i == 4 else 4))
cards_table.setStyle(TableStyle(pad_style))
story.append(cards_table)
story.append(Spacer(1, 20))

# Feature comparison
story.append(section_title("Feature Comparison"))
story.append(make_feature_table())
story.append(Spacer(1, 12))

# Tax Notice
tax_notice_t = Table([[
    Paragraph(
        "<b>Note:</b> All prices listed above (monthly, annual, and yearly totals) are "
        "<b>exclusive of applicable taxes</b>. GST / other applicable taxes will be charged extra at checkout.",
        ParagraphStyle("tnt", fontName="Inter-Medium", fontSize=8,
                       textColor=C_WARN_TX, leading=11)
    )
]], colWidths=[W - 2*MARGIN])
tax_notice_t.setStyle(TableStyle([
    ("BACKGROUND",    (0,0), (-1,-1), C_WARN_BG),
    ("BOX",           (0,0), (-1,-1), 1, C_WARN_BD),
    ("TOPPADDING",    (0,0), (-1,-1), 10),
    ("BOTTOMPADDING", (0,0), (-1,-1), 10),
    ("LEFTPADDING",   (0,0), (-1,-1), 12),
    ("RIGHTPADDING",  (0,0), (-1,-1), 12),
    ("VALIGN",        (0,0), (-1,-1), "MIDDLE"),
    ("ROUNDEDCORNERS", [6]),
]))
story.append(tax_notice_t)
story.append(Spacer(1, 10))

# Notice
notice_t = Table([[
    Paragraph(
        "<b>Note:</b> Add-ons are <b>not available</b> on the Free plan. "
        "All paid plan subscribers (Starter, Starter WhatsApp, Pro, Pro WhatsApp) can purchase any add-on to extend their plan.",
        ParagraphStyle("nt", fontName="Inter-Medium", fontSize=8,
                       textColor=C_WARN_TX, leading=11)
    )
]], colWidths=[W - 2*MARGIN])
notice_t.setStyle(TableStyle([
    ("BACKGROUND",    (0,0), (-1,-1), C_WARN_BG),
    ("BOX",           (0,0), (-1,-1), 1, C_WARN_BD),
    ("TOPPADDING",    (0,0), (-1,-1), 10),
    ("BOTTOMPADDING", (0,0), (-1,-1), 10),
    ("LEFTPADDING",   (0,0), (-1,-1), 12),
    ("RIGHTPADDING",  (0,0), (-1,-1), 12),
    ("VALIGN",        (0,0), (-1,-1), "MIDDLE"),
    ("ROUNDEDCORNERS", [6]),
]))
story.append(notice_t)
story.append(Spacer(1, 20))

# Add-on pricing
story.append(section_title("Add-on Pricing"))
story.append(make_addon_table())
story.append(Spacer(1, 12))

# Add-on Tax Notice
addon_tax_notice_t = Table([[
    Paragraph(
        "<b>Note:</b> Add-on prices listed above are also <b>exclusive of applicable taxes</b>. "
        "GST / other applicable taxes will be charged extra at checkout.",
        ParagraphStyle("atnt", fontName="Inter-Medium", fontSize=8,
                       textColor=C_WARN_TX, leading=11)
    )
]], colWidths=[W - 2*MARGIN])
addon_tax_notice_t.setStyle(TableStyle([
    ("BACKGROUND",    (0,0), (-1,-1), C_WARN_BG),
    ("BOX",           (0,0), (-1,-1), 1, C_WARN_BD),
    ("TOPPADDING",    (0,0), (-1,-1), 10),
    ("BOTTOMPADDING", (0,0), (-1,-1), 10),
    ("LEFTPADDING",   (0,0), (-1,-1), 12),
    ("RIGHTPADDING",  (0,0), (-1,-1), 12),
    ("VALIGN",        (0,0), (-1,-1), "MIDDLE"),
    ("ROUNDEDCORNERS", [6]),
]))
story.append(addon_tax_notice_t)
story.append(Spacer(1, 16))

# Footer
story.append(HRFlowable(width="100%", thickness=0.5, color=C_BORDER))
story.append(Spacer(1, 6))
story.append(Paragraph(
    "© 2026 SmatBot  ·  All prices exclusive of applicable taxes  ·  Pricing subject to change",
    ParagraphStyle("ft", fontName="Inter", fontSize=7, textColor=C_MUTED,
                   leading=10, alignment=1)
))

doc.build(story)
print(f"PDF saved to: {OUTPUT}")
