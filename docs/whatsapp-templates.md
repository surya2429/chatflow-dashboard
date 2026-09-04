# WhatsApp Business Platform — Template Documentation

> **Source:** Meta for Developers — Business Messaging → WhatsApp → Templates  
> **Last Updated:** April 2026  
> **Covers:** Overview · Marketing Templates · Components · Languages · Management · Quality · Review · Delivery Controls

---

## Table of Contents

1. [Overview](#1-overview)
2. [Template Categorization](#2-template-categorization)
3. [Template Components](#3-template-components)
4. [Marketing Templates](#4-marketing-templates)
   - 4.1 [Custom Marketing Templates](#41-custom-marketing-templates)
   - 4.2 [Coupon Code Templates](#42-coupon-code-templates)
   - 4.3 [Limited-Time Offer Templates](#43-limited-time-offer-templates)
   - 4.4 [Media Card Carousel Templates](#44-media-card-carousel-templates)
   - 4.5 [Call Permission Request Templates](#45-call-permission-request-templates)
   - 4.6 [Per-User Marketing Template Limits](#46-per-user-marketing-template-limits)
5. [Template Comparison](#5-template-comparison)
6. [Supported Languages](#6-supported-languages)
7. [Template Library](#7-template-library)
8. [Template Management](#8-template-management)
   - 8.1 [Get Templates](#81-get-templates)
   - 8.2 [Edit Templates](#82-edit-templates)
   - 8.3 [Delete Templates](#83-delete-templates)
   - 8.4 [Archive & Unarchive](#84-archive--unarchive)
9. [Template Archival](#9-template-archival)
10. [Template Migration](#10-template-migration)
11. [Template Quality](#11-template-quality)
12. [Template Review](#12-template-review)
13. [Template Pacing](#13-template-pacing)
14. [Portfolio Pacing](#14-portfolio-pacing)
15. [Template Pausing](#15-template-pausing)
16. [Tap Target URL Title Override](#16-tap-target-url-title-override)
17. [Time-to-Live (TTL)](#17-time-to-live-ttl)

---

## 1. Overview

WhatsApp message templates are pre-approved message formats that businesses use to initiate conversations with customers outside the 24-hour customer service window. They are required for all business-initiated messages and support dynamic content through variable parameters.

### Template Categories

| Category | Purpose |
|----------|---------|
| **Marketing** | Promotions, offers, announcements, brand engagement |
| **Utility** | Transactional messages, order updates, account alerts |
| **Authentication** | OTP, verification codes, login confirmation |

### Template Lifecycle

```
Create → Review (up to 24 hrs) → Approved / Rejected → Send → Quality Monitored → Paced / Paused / Archived
```

### Key Rules

- Templates must be **approved** before sending.
- Templates use **named** (`{{first_name}}`) or **positional** (`{{1}}`) parameters.
- Only **Marketing** templates are compatible with both Cloud API and Marketing Messages API.
- Templates inactive for **12 months** are auto-archived and deleted after **28 days**.

---

## 2. Template Categorization

Templates are assigned one of three categories at creation. WhatsApp may also **automatically re-categorize** a template based on its content.

### Category Definitions

| Category | Description | Typical Use Cases |
|----------|-------------|------------------|
| **MARKETING** | Drives awareness, engagement, and sales | Promotions, product announcements, newsletters |
| **UTILITY** | Facilitates a transaction or request the user initiated | Order confirmations, shipping updates, appointment reminders |
| **AUTHENTICATION** | Verifies identity of users | OTP codes, login verification, account recovery |

### Auto-Categorization

WhatsApp may automatically reassign a template to a different category during or after review. When this happens:
- The template's custom TTL is reset to `null`.
- The business is notified via webhook and email.
- You must reconfigure TTL for the new category.

---

## 3. Template Components

Templates consist of up to **four components**. Only the **body** is mandatory.

### 3.1 Header (Optional)

Supports text or media formats.

#### Text Header

- Single text field, max **60 characters**
- Supports **1 variable parameter**
- Does **not** support markdown

```json
{
  "type": "header",
  "format": "text",
  "text": "Your {{1}} is confirmed!"
}
```

#### Media Header

Supports **IMAGE**, **VIDEO**, **GIF**, **DOCUMENT** formats.

- Media must be uploaded via the **Resumable Upload API** first
- GIFs limited to **3.5 MB** (Marketing Messages API only)

```json
{
  "type": "header",
  "format": "IMAGE",
  "example": {
    "header_handle": ["<UPLOAD_HANDLE>"]
  }
}
```

#### Location Header

Displays a static map. Tapping opens device's default map app.

- Only for **UTILITY** or **MARKETING** templates
- Real-time locations are **not** supported

```json
{
  "type": "header",
  "format": "location"
}
```

---

### 3.2 Body (Required)

Core message text. Text only, max **1024 characters**.

- Supports **named** and **positional** variable parameters
- One body component per template

```json
{
  "type": "body",
  "text": "Hi {{first_name}}, your order {{order_id}} has been shipped!"
}
```

**Parameter Formats:**

| Type | Syntax | Example |
|------|--------|---------|
| Positional | `{{1}}`, `{{2}}` | `Your code is {{1}}.` |
| Named | `{{variable_name}}` | `Hello {{customer_name}}!` |

---

### 3.3 Footer (Optional)

Optional supporting text displayed below the body.

- Text only, max **60 characters**
- One footer per template

```json
{
  "type": "footer",
  "text": "Reply STOP to unsubscribe."
}
```

---

### 3.4 Buttons (Optional)

Up to **10 buttons** total per template. Templates with 4+ buttons or mixed types show a "See all options" fallback on older clients.

#### Button Types

| Type | Limit | Max Text Length | Description |
|------|-------|-----------------|-------------|
| **Quick Reply** | 10 | 25 chars | Sends a predefined text reply |
| **URL** | 2 | 2000 chars | Opens a URL in default browser; supports 1 variable |
| **Phone Number** | 1 | 20 chars | Initiates a phone call |
| **Copy Code** | 1 | 15 chars | Copies code to clipboard |
| **Voice Call** | — | — | Initiates a WhatsApp call |
| **OTP** | — | — | One-time password variant of URL button |
| **Multi-Product Message** | — | — | Opens catalog with up to 30 products |
| **SPM** | — | — | Single-product catalog button |

#### Button Grouping Rules

✅ Valid combinations:
- Multiple quick reply buttons
- Quick reply + URL/Phone buttons
- Multiple URL or Phone buttons

❌ Invalid combinations:
- Alternating types (URL → Quick Reply → URL)
- Non-contiguous quick replies (Quick Reply → URL → Quick Reply)

#### Button Syntax Example

```json
{
  "type": "buttons",
  "buttons": [
    {
      "type": "URL",
      "text": "Shop Now",
      "url": "https://example.com/sale"
    },
    {
      "type": "PHONE_NUMBER",
      "text": "Call Us",
      "phone_number": "+919876543210"
    },
    {
      "type": "QUICK_REPLY",
      "text": "Learn More"
    }
  ]
}
```

---

## 4. Marketing Templates

Marketing templates are the most flexible template type and the only type supported by both the **Cloud API** and **Marketing Messages API**.

### Specialty Marketing Template Types

| Type | Description |
|------|-------------|
| **Custom** | Fully flexible templates with any supported components |
| **Coupon Code** | Includes a copy-to-clipboard promo code button |
| **Limited-Time Offer** | Shows expiration countdown for promotional codes |
| **Media Card Carousel** | Up to 10 horizontally scrollable media cards |
| **Call Permission Request** | Requests permission for calls outside service windows |
| **Catalog** | Product catalog showcase |
| **Multi-Product Message** | Up to 30 products across 10 sections |
| **Product Card Carousel** | Up to 10 scrollable product cards (in-app experience) |
| **Single-Product Message** | Single product with up to 10 accompanying cards |

### User Preferences for Marketing Messages

Users can manage the **Offers and Announcements** setting:

- **Interested / Not Interested** — affects per-user limits
- **Stop / Resume** — users can halt or restart marketing messages

> Attempting delivery to a stopped user returns a failed webhook with **error code `131050`**.

Subscribe to the `user_preferences` webhook to receive stop/resume notifications.

---

### 4.1 Custom Marketing Templates

Custom templates give businesses full control over all supported components.

**Create Endpoint:** `POST /<WABA_ID>/message_templates`

#### Required Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `name` | String | Unique name: lowercase alphanumeric + underscores, max 512 chars |
| `language` | String | Language/locale code (e.g., `en_US`) |
| `category` | String | Must be `MARKETING` |
| `components` | Array | Header, body, footer, buttons |
| `parameter_format` | String | `named` or `positional` (default: positional) |

#### Example: Create Template

```json
POST /v21.0/<WABA_ID>/message_templates
{
  "name": "summer_sale_2025",
  "language": "en_US",
  "category": "MARKETING",
  "parameter_format": "named",
  "components": [
    {
      "type": "HEADER",
      "format": "IMAGE",
      "example": { "header_handle": ["<UPLOAD_HANDLE>"] }
    },
    {
      "type": "BODY",
      "text": "Hi {{customer_name}}! Get {{discount}}% off with code {{promo_code}}.",
      "example": {
        "body_text_named_params": [
          { "param_name": "customer_name", "value": "John" },
          { "param_name": "discount", "value": "20" },
          { "param_name": "promo_code", "value": "SAVE20" }
        ]
      }
    },
    {
      "type": "FOOTER",
      "text": "Valid through July 31."
    },
    {
      "type": "BUTTONS",
      "buttons": [
        { "type": "URL", "text": "Shop Now", "url": "https://store.example.com" },
        { "type": "QUICK_REPLY", "text": "No Thanks" }
      ]
    }
  ]
}
```

#### Send Endpoint

`POST /<PHONE_NUMBER_ID>/messages`

```json
{
  "messaging_product": "whatsapp",
  "to": "+919876543210",
  "type": "template",
  "template": {
    "name": "summer_sale_2025",
    "language": { "code": "en_US" },
    "components": [
      {
        "type": "header",
        "parameters": [{ "type": "image", "image": { "id": "<MEDIA_ID>" } }]
      },
      {
        "type": "body",
        "parameters": [
          { "type": "text", "parameter_name": "customer_name", "text": "Priya" },
          { "type": "text", "parameter_name": "discount", "text": "25" },
          { "type": "text", "parameter_name": "promo_code", "text": "SUMMER25" }
        ]
      }
    ]
  }
}
```

---

### 4.2 Coupon Code Templates

Coupon templates include a single **copy-to-clipboard code button**. When tapped, the code is automatically copied to the user's clipboard.

**Limitations:**
- Not supported on **WhatsApp Web**
- Copy button text is **non-customizable**
- Only **one** copy code button per template

#### Components

| Component | Details |
|-----------|---------|
| Header (optional) | Text only, max 60 chars |
| Body (required) | Supports variables, max 1024 chars |
| Buttons (required) | Copy code button + optional quick replies |

**Copy Code Button:** Code must be alphanumeric, max **20 characters**.

#### Create Template

```json
{
  "name": "coupon_20off",
  "language": "en_US",
  "category": "MARKETING",
  "components": [
    { "type": "HEADER", "format": "TEXT", "text": "🎁 Exclusive Offer" },
    {
      "type": "BODY",
      "text": "Hi {{1}}! Use code below for 20% off your next order.",
      "example": { "body_text": [["Sarah"]] }
    },
    {
      "type": "BUTTONS",
      "buttons": [
        { "type": "COPY_CODE", "example": "SAVE20" }
      ]
    }
  ]
}
```

#### Send Template

```json
{
  "messaging_product": "whatsapp",
  "to": "+919876543210",
  "type": "template",
  "template": {
    "name": "coupon_20off",
    "language": { "code": "en_US" },
    "components": [
      {
        "type": "body",
        "parameters": [{ "type": "text", "text": "Priya" }]
      },
      {
        "type": "button",
        "sub_type": "copy_code",
        "index": 0,
        "parameters": [{ "type": "coupon_code", "coupon_code": "SAVE20NOW" }]
      }
    ]
  }
}
```

---

### 4.3 Limited-Time Offer Templates

Display a **countdown timer** and expiration date for promotional codes.

**Limitations:**
- **Marketing** category only
- No footer component supported
- WhatsApp Web/Desktop shows "unsupported message" fallback

#### Components

| Component | Required | Details |
|-----------|----------|---------|
| Header | Optional | IMAGE or VIDEO recommended |
| limited_time_offer | Required | Offer text (max 16 chars) + expiration flag |
| Body | Required | Text with variables, max 600 chars |
| Buttons | Required | Copy code button + URL button with variable |

#### Create Template

```json
{
  "name": "flash_sale_oct",
  "language": "en_US",
  "category": "MARKETING",
  "components": [
    { "type": "HEADER", "format": "IMAGE" },
    {
      "type": "LIMITED_TIME_OFFER",
      "limited_time_offer": {
        "text": "Flash Sale!",
        "has_expiration": true
      }
    },
    {
      "type": "BODY",
      "text": "Hi {{1}}! Your exclusive discount expires soon. Use code {{2}}."
    }
  ]
}
```

#### Send Template

```json
{
  "template": {
    "name": "flash_sale_oct",
    "language": { "code": "en_US" },
    "components": [
      {
        "type": "limited_time_offer",
        "parameters": [{
          "type": "limited_time_offer",
          "limited_time_offer": {
            "expiration_time_ms": 1698562800000
          }
        }]
      },
      {
        "type": "button",
        "sub_type": "copy_code",
        "index": 0,
        "parameters": [{ "type": "coupon_code", "coupon_code": "FLASH25" }]
      }
    ]
  }
}
```

**Timer behavior:** Countdown turns **red** in the final hour before expiration.

---

### 4.4 Media Card Carousel Templates

Send up to **10 horizontally scrollable media cards** in a single message.

**Requirements:**
- **Marketing** category only
- Minimum **2**, maximum **10** cards
- All cards must have **identical component structures**

#### Card Structure

Each card can contain:
- Image or Video header (required)
- Body text (optional, max **160 chars**)
- Up to **2 buttons** (Quick Reply, Phone Number, or URL)

**Note:** URL buttons open in the device browser (exits WhatsApp). For in-app experiences, use Product Card Carousel templates instead.

#### Create Template

```json
{
  "name": "product_carousel_q4",
  "language": "en_US",
  "category": "MARKETING",
  "components": [
    {
      "type": "BODY",
      "text": "Check out our top picks this season! 🛍️"
    },
    {
      "type": "CAROUSEL",
      "cards": [
        {
          "components": [
            {
              "type": "HEADER",
              "format": "IMAGE",
              "example": { "header_handle": ["<HANDLE_1>"] }
            },
            {
              "type": "BODY",
              "text": "Product A — Only ₹999"
            },
            {
              "type": "BUTTONS",
              "buttons": [
                { "type": "URL", "text": "Buy Now", "url": "https://store.example.com/a" },
                { "type": "QUICK_REPLY", "text": "More Info" }
              ]
            }
          ]
        },
        {
          "components": [
            {
              "type": "HEADER",
              "format": "IMAGE",
              "example": { "header_handle": ["<HANDLE_2>"] }
            },
            {
              "type": "BODY",
              "text": "Product B — Only ₹1499"
            },
            {
              "type": "BUTTONS",
              "buttons": [
                { "type": "URL", "text": "Buy Now", "url": "https://store.example.com/b" },
                { "type": "QUICK_REPLY", "text": "More Info" }
              ]
            }
          ]
        }
      ]
    }
  ]
}
```

#### Send Template

```json
{
  "template": {
    "name": "product_carousel_q4",
    "language": { "code": "en_US" },
    "components": [
      {
        "type": "body",
        "parameters": []
      },
      {
        "type": "carousel",
        "cards": [
          {
            "card_index": 0,
            "components": [
              {
                "type": "header",
                "parameters": [{ "type": "image", "image": { "id": "<MEDIA_ID_1>" } }]
              },
              {
                "type": "button",
                "sub_type": "url",
                "index": 0,
                "parameters": [{ "type": "text", "text": "product-a" }]
              }
            ]
          },
          {
            "card_index": 1,
            "components": [
              {
                "type": "header",
                "parameters": [{ "type": "image", "image": { "id": "<MEDIA_ID_2>" } }]
              },
              {
                "type": "button",
                "sub_type": "url",
                "index": 0,
                "parameters": [{ "type": "text", "text": "product-b" }]
              }
            ]
          }
        ]
      }
    ]
  }
}
```

---

### 4.5 Call Permission Request Templates

Allow businesses to request permission to call customers **outside standard service windows**.

**Category:** Marketing or Utility

#### Create Template

`POST /<WABA_ID>/message_templates`

| Parameter | Type | Description |
|-----------|------|-------------|
| `category` | String | `MARKETING` or `UTILITY` |
| `components` | Array | Body + call_permission_request component |

```json
{
  "name": "call_permission_request",
  "language": "en",
  "category": "MARKETING",
  "components": [
    {
      "type": "BODY",
      "text": "Hi {{1}}, we'd like to call you to discuss your recent inquiry. May we contact you?"
    },
    {
      "type": "call_permission_request"
    }
  ]
}
```

#### Send Template

```json
{
  "messaging_product": "whatsapp",
  "to": "+919876543210",
  "type": "template",
  "template": {
    "name": "call_permission_request",
    "language": { "code": "en" },
    "components": [
      {
        "type": "body",
        "parameters": [{ "type": "text", "text": "John Smith" }]
      }
    ]
  }
}
```

---

### 4.6 Per-User Marketing Template Limits

WhatsApp dynamically limits marketing messages each user receives to prevent spam and protect user experience.

#### How Limits Are Determined

Limits are based on:
- Recent **read rates** of marketing messages
- **Overall message volume** in the user's inbox (personal + business)
- **Historical engagement** patterns

#### Important Dates & Changes

| Date | Change |
|------|--------|
| **March 3, 2025** | WhatsApp now considers overall inbox volume (personal + business) in addition to read rates when calculating limits |
| **April 1, 2025** | All marketing template messages to **US phone numbers** (`+1` with US area codes) are paused — error code `131049` |
| **Late Q2 2025** | Per-user limits align with new per-message pricing; all delivered marketing messages count (except those in 24-hr service windows) |

#### Regional Exceptions (No Delivery Optimizations)

- European Economic Area
- United Kingdom
- Japan
- South Korea

#### Error Handling

| Error Code | Meaning | Action |
|------------|---------|--------|
| `131049` | Per-user marketing limit reached | Wait at least 24 hours before retry |
| `131050` | User has stopped marketing messages | Do not retry; subscribe to `user_preferences` webhook |

---

## 5. Template Comparison

Compare two templates side-by-side to analyze performance differences and make data-informed decisions.

### Requirements

- **Authentication:** User or System User access token
- **Permission:** `whatsapp_business_management`
- Both templates must belong to the **same WABA**
- Each template needs minimum **1,000 sends** in the timeframe

### Supported Lookback Windows

| Window | Seconds to Subtract |
|--------|---------------------|
| 7 days | 604,800 |
| 30 days | 2,592,000 |
| 60 days | 5,184,000 |
| 90 days | 7,776,000 |

### API Endpoint

```
GET /<TEMPLATE_ID>/compare
  ?template_ids=[<COMPARE_TEMPLATE_ID>]
  &start=<START_UNIX_TIMESTAMP>
  &end=<END_UNIX_TIMESTAMP>
```

### Response Metrics

| Metric | Type | Description |
|--------|------|-------------|
| `BLOCK_RATE` | RELATIVE | Templates ranked by block-to-send ratio |
| `MESSAGE_SENDS` | NUMBER_VALUES | Send volume per template |
| `TOP_BLOCK_REASON` | STRING_VALUES | Primary reason users blocked messages |

### Block Reasons

- `SPAM`
- `OFFENSIVE_MESSAGES`
- `OTP_DID_NOT_REQUEST`
- `NO_LONGER_NEEDED`
- `NO_SIGN_UP`
- `NO_REASON` / `NO_REASON_GIVEN`
- `OTHER`
- `UNKNOWN_BLOCK_REASON`

### Example Response

```json
{
  "data": [
    {
      "metric": "BLOCK_RATE",
      "type": "RELATIVE",
      "order_by_relative_metric": ["1533406637136032", "5289179717853347"]
    },
    {
      "metric": "MESSAGE_SENDS",
      "type": "NUMBER_VALUES",
      "number_values": [
        { "key": "5289179717853347", "value": 1273 },
        { "key": "1533406637136032", "value": 1042 }
      ]
    },
    {
      "metric": "TOP_BLOCK_REASON",
      "type": "STRING_VALUES",
      "string_values": [
        { "key": "5289179717853347", "value": "UNKNOWN_BLOCK_REASON" },
        { "key": "1533406637136032", "value": "SPAM" }
      ]
    }
  ]
}
```

---

## 6. Supported Languages

WhatsApp templates support **130+ languages** using ISO 639-1 format with optional regional variants (e.g., `en_US`, `zh_CN`, `hi`).

### Major Language Groups

#### European
| Language | Locale Codes |
|----------|-------------|
| English | `en_US`, `en_GB`, `en_IN`, `en_AU`, `en_CA`, `en_IE`, `en_ZA`, and more |
| Spanish | `es_ES`, `es_AR`, `es_MX`, `es_CO`, `es_CL`, `es_PE`, and more |
| French | `fr_FR`, `fr_BE`, `fr_CA`, `fr_CH`, `fr_MA` |
| German | `de_DE`, `de_AT`, `de_CH` |
| Portuguese | `pt_BR`, `pt_PT` |
| Italian | `it_IT` |
| Dutch | `nl_NL`, `nl_BE` |
| Polish | `pl_PL` |
| Russian | `ru_RU` |
| Ukrainian | `uk_UA` |
| Greek | `el_GR` |
| Others | Czech, Hungarian, Romanian, Serbian, Croatian, Slovak, Bulgarian, Albanian, Belarusian, Lithuanian, Latvian, Estonian, Norwegian, Swedish, Danish, Finnish, Catalan, Irish |

#### Asian
| Language | Locale Codes |
|----------|-------------|
| Chinese | `zh_CN` (Simplified), `zh_HK`, `zh_TW` (Traditional) |
| Hindi | `hi` |
| Bengali | `bn_IN` |
| Tamil | `ta` |
| Telugu | `te` |
| Kannada | `kn` |
| Malayalam | `ml` |
| Gujarati | `gu` |
| Marathi | `mr` |
| Punjabi | `pa` |
| Urdu | `ur` |
| Japanese | `ja` |
| Korean | `ko` |
| Thai | `th` |
| Vietnamese | `vi` |
| Indonesian | `id` |
| Malay | `ms_MY` |
| Filipino | `fil` |

#### Middle Eastern & Central Asian
| Language | Locale Codes |
|----------|-------------|
| Arabic | `ar`, `ar_EG`, `ar_AE`, `ar_LB`, `ar_MA`, `ar_QA` |
| Hebrew | `he` |
| Persian | `fa` |
| Pashto | `ps` |
| Kazakh | `kk` |
| Uzbek | `uz` |
| Kyrgyz | `ky` |

#### African
| Language | Locale Codes |
|----------|-------------|
| Swahili | `sw` |
| Hausa | `ha` |
| Zulu | `zu` |
| Kinyarwanda | `rw` |
| Sinhala | `si` |

---

## 7. Template Library

The Template Library provides pre-written templates for common business use cases, enabling faster setup compared to custom template creation.

### Supported Categories

Template Library templates are **UTILITY** or **AUTHENTICATION** only (not Marketing).

### Pre-built Industries & Topics

| Filter | Options |
|--------|---------|
| **Industry** | E_COMMERCE, FINANCIAL_SERVICES |
| **Topic** | ACCOUNT_UPDATE, CUSTOMER_FEEDBACK, ORDER_MANAGEMENT, PAYMENTS |
| **Use Case** | ORDER_CONFIRMATION, PAYMENT_CONFIRMATION, DELIVERY_UPDATE, FRAUD_ALERT, AUTO_PAY_REMINDER, RETURN_CONFIRMATION, FEEDBACK_SURVEY |

### Supported Parameter Types

| Type | Example |
|------|---------|
| TEXT | `"regarding your order"` |
| ADDRESS | `"1 Hacker Way, Menlo Park, CA 94025"` |
| AMOUNT | `"USD $375.32"` |
| DATE | `"2021-04-19"` |
| PHONE NUMBER | `"+1 4256789900"` |
| EMAIL | `"example@gmail.com"` |
| NUMBER | `"23444"` |

### Browse Templates API

```
GET /message_template_library
  ?search=<SEARCH_KEY>
  &topic=<TOPIC>
  &usecase=<USECASE>
  &industry=<INDUSTRY>
  &language=<LANGUAGE>
  &name=<NAME>
```

### Create from Library

`POST /<WABA_ID>/message_templates`

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `name` | String | ✅ | Your template identifier (max 512 chars) |
| `category` | Enum | ✅ | `UTILITY` for library templates |
| `language` | Enum | ✅ | Locale code (e.g., `en_US`) |
| `library_template_name` | String | ✅ | Exact library template name |
| `library_template_button_inputs` | Array | Conditional | Required if template has buttons |

#### Button Input Object

```json
{
  "type": "URL",
  "url": {
    "base_url": "https://example.com/{{1}}",
    "url_suffix_example": "https://example.com/order_123"
  }
}
```

#### Optional Body Inputs (`library_template_body_inputs`)

| Property | Type | Description |
|----------|------|-------------|
| `add_contact_number` | Boolean | Include business phone number |
| `add_learn_more_link` | Boolean | Add informational URL |
| `add_security_recommendation` | Boolean | Auth code warning |
| `add_track_package_link` | Boolean | Delivery tracking info |
| `code_expiration_minutes` | Integer | OTP expiry duration |

#### Example Request

```bash
curl 'https://graph.facebook.com/v25.0/<WABA_ID>/message_templates' \
  -H 'Authorization: Bearer EAAJB...' \
  -H 'Content-Type: application/json' \
  -d '{
    "name": "my_delivery_update",
    "language": "en_US",
    "category": "UTILITY",
    "library_template_name": "delivery_update_1",
    "library_template_button_inputs": "[{\"type\": \"URL\", \"url\": {\"base_url\": \"https://example.com/{{1}}\", \"url_suffix_example\": \"https://example.com/track_123\"}}]"
  }'
```

#### Response

```json
{
  "id": "<TEMPLATE_ID>",
  "status": "APPROVED",
  "category": "UTILITY"
}
```

> Library templates are often **auto-approved** since they contain pre-validated content.

### WhatsApp Flows (Forms)

For approved accounts with increased message limits, interactive form templates are available:

- `CUSTOMER_FEEDBACK` — Collect ratings and comments
- `DELIVERY_FAILURE` — Reschedule or update delivery

These appear as `"type": "FLOW"` in the buttons array.

---

## 8. Template Management

### 8.1 Get Templates

**Endpoint:** `GET /<WABA_ID>/message_templates`

Retrieve all templates with optional field filtering and pagination.

```bash
curl 'https://graph.facebook.com/v25.0/<WABA_ID>/message_templates
  ?fields=id,name,status,category,language,components,quality_score' \
  -H 'Authorization: Bearer EAAJB...'
```

**Filter by Status:**

```
GET /<WABA_ID>/message_templates?status=REJECTED
```

**Available Status Values:**

| Status | Description |
|--------|-------------|
| `APPROVED` | Ready to send |
| `PENDING` | Under review |
| `REJECTED` | Failed review |
| `PAUSED` | Paused due to quality |
| `DISABLED` | Permanently disabled |
| `ARCHIVED` | Auto-archived (inactive 12+ months) |
| `PENDING_DELETION` | Scheduled for deletion |

---

### 8.2 Edit Templates

**Endpoint:** `POST /<TEMPLATE_ID>`

#### Editable Elements
- Category
- All components (header, body, footer, buttons)
- Time-to-live settings

#### Restrictions

| Template Status | Edit Limit |
|-----------------|------------|
| APPROVED | Max **10 edits per 30 days** OR **1 edit per 24 hours** |
| REJECTED | Unlimited edits |
| PAUSED | Unlimited edits |

- Cannot change **category** on an approved template
- All components must be replaced together (no partial edits)
- Approved templates **auto-approve** after editing unless the updated content triggers a new review failure

```json
POST /<TEMPLATE_ID>
{
  "components": [
    { "type": "BODY", "text": "Updated message: Hi {{1}}, your order is ready!" }
  ]
}
```

---

### 8.3 Delete Templates

**Endpoint:** `DELETE /<WABA_ID>/message_templates`

#### Delete by Name (all language variants)

```
DELETE /<WABA_ID>/message_templates?name=summer_sale_2025
```

#### Delete by ID + Name (specific template)

```
DELETE /<WABA_ID>/message_templates?hsm_id=<TEMPLATE_ID>&name=summer_sale_2025
```

#### Deletion Rules

- Templates with **pending delivery** enter `PENDING_DELETION` status — a 30-day retry window remains active
- **Approved template names** cannot be reused for **30 days** after deletion
- **Disabled** templates cannot be deleted

---

### 8.4 Archive & Unarchive

**Manual Archive:**

```
POST /<TEMPLATE_ID>
{ "status": "ARCHIVED" }
```

**Manual Unarchive:**

```
POST /<TEMPLATE_ID>/unpause
```

Unarchiving within the 28-day window cancels the scheduled deletion and restores the template to its previous status.

---

## 9. Template Archival

### Auto-Archival Policy

WhatsApp automatically archives templates that are **inactive for 12+ months**.

**All WABAs have auto-archival enabled — you cannot opt out.**

**Activity definition:** Creating, editing, sending, appealing, or unarchiving a template counts as activity.

### Post-Archival Timeline

```
Template Inactive 12 months → Auto-Archived → 28-day window → Permanently Deleted
```

Unarchiving within the 28-day window **cancels deletion**.

### Notification Channels

| Channel | Details |
|---------|---------|
| **Webhook** | `message_template_status_update` fires for each archived/unarchived template |
| **Email** | Lists affected templates with management links |
| **Dashboard Banner** | One-time notification before the first auto-archival cycle |

---

## 10. Template Migration

Migrate approved templates between WABAs within the **same Meta Business** entity.

> Migration **recreates** templates in the destination WABA — it does not move them.

### Eligibility

- Templates must be `APPROVED` with `GREEN` or `UNKNOWN` quality score
- Source and destination WABAs must be owned by the **same Meta Business**

### API Endpoint

```
POST https://graph.facebook.com/<API_VERSION>/<DESTINATION_WABA_ID>/migrate_message_templates
```

### Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `source_waba_id` | Integer | ✅ | Origin WABA ID |
| `page_number` | Integer | ✅ | Zero-indexed batch page (max 500 per batch) |
| `count` | Integer | Optional | Batch size override (max 500; reduce if timeouts occur) |
| `template_ids` | Array | Optional | Specific template IDs to migrate (max 500) |

### Response

```json
{
  "migrated_templates": ["TEMPLATE_ID_1", "TEMPLATE_ID_2"],
  "failed_templates": {
    "TEMPLATE_ID_3": "Incorrect category",
    "TEMPLATE_ID_4": "Formatting error - dangling parameter"
  }
}
```

### Pagination for Large Migrations (1000+ templates)

Send parallel requests with incremented `page_number` values:

```
page_number=0 → first 500
page_number=1 → next 500
page_number=2 → next 500
```

---

## 11. Template Quality

Template quality is monitored continuously based on customer engagement and feedback.

### Quality Score Levels

| Score | Label | Description | Delivery |
|-------|-------|-------------|---------|
| `GREEN` | High Quality | Little to no negative feedback | Normal |
| `YELLOW` | Medium Quality | Negative feedback from multiple users or low read-rates | Normal (risk of pausing) |
| `RED` | Low Quality | Significant negative feedback or very low read-rates | Risk of pausing or disabling |
| `UNKNOWN` | Pending | No feedback data yet (new templates) | Normal |

### Get Quality Score

```bash
GET https://graph.facebook.com/v25.0/<TEMPLATE_ID>?fields=quality_score
```

**Response:**

```json
{
  "quality_score": {
    "score": "GREEN",
    "date": 1758754645
  },
  "id": "1387372356726668"
}
```

### WhatsApp Manager Display

| API Score | Manager Label |
|-----------|---------------|
| UNKNOWN | Active — Quality pending |
| GREEN | Active — High quality |
| YELLOW | Active — Medium quality |
| RED | Active — Low quality |

---

## 12. Template Review

### Review Timeline

Templates can take up to **24 hours** for an approval decision.

**Notifications upon decision:**
- WhatsApp Manager notification
- Email to Business Manager admins
- `message_template_status_update` webhook

### Status Outcomes

| Status | Meaning | Next Step |
|--------|---------|-----------|
| `APPROVED` | Template active; starts as "Quality pending" | Ready to send |
| `REJECTED` | Failed review | Edit and resubmit, or appeal |

### Sample Requirements

Templates using variables **must** include sample values for:
- Media assets (images, videos, documents)
- Text body parameters
- Variable placeholders

### Common Rejection Reasons

#### Parameter Formatting Issues
- Missing or mismatched curly braces — correct: `{{1}}`
- Special characters in parameters (`#`, `$`, `%`)
- Non-sequential parameters (`{{1}}` then `{{3}}`)
- Dangling parameters at message start or end
- Excessive variables relative to message length

#### Policy Violations
- Violates WhatsApp Commerce Policy
- Requests sensitive identifiers (card numbers, national IDs)
- Contains abusive or threatening language

#### Content Issues
- Body text exceeds 1024 characters
- Emoji quantity restrictions violated
- Duplicate of existing template with identical body + footer

### Rejection Details

Find detailed rejection information in:

**Business Support Home → Account Overview → View my accounts → [WABA] → Rejected message templates**

### Appeals Process

- Submit an appeal within **24 hours** of rejection
- Attach sample values during appeal submission
- Decisions are returned within **24 hours**

---

## 13. Template Pacing

Template pacing is a **quality control mechanism** that holds messages during early distribution to assess customer feedback before allowing full send volume.

### When Pacing Applies

| Template Type | Condition |
|---------------|-----------|
| **Marketing** | Always subject to pacing when newly created or unpaused |
| **Utility** | Only if the utility template was previously paused |

### How It Works

```
Messages Sent → Initial batch delivered normally
               → Threshold reached → Subsequent messages HELD
               → Feedback assessed:
                  → Positive: Messages released, quality improves ✅
                  → Negative: Template PAUSED, held messages dropped ❌
```

### API Message Status

The Cloud API returns `message_status` in the immediate response:

| Status | Meaning |
|--------|---------|
| `accepted` | Message processed normally |
| `held_for_quality_assessment` | Message held pending quality evaluation |

### Guardrails

Even paced templates are protected by internal limits:
> *"Campaign messages with highest throughput still get delivered within an hour (99th percentile) even if paced."*

If the feedback threshold is not reached before guardrails trigger, held messages are released automatically.

### Utility Template Pacing Duration

Utility templates remain subject to pacing for **7 days** after a utility template pause event.

### Webhooks

| Webhook | Trigger |
|---------|---------|
| `message_template_quality_update` | Quality score changes |
| `message_template_status_update` | Template paused due to negative feedback |

---

## 14. Portfolio Pacing

Portfolio pacing manages message delivery at the **account level**, controlling the overall rate at which templates are sent across a WABA to balance quality signals and business throughput.

> This is a platform-level control managed by Meta. Businesses receive notifications if portfolio pacing affects their account.

---

## 15. Template Pausing

Templates that reach the **lowest quality rating** are automatically paused.

### Pause Durations (Progressive)

| Instance | Duration |
|----------|---------|
| **1st pause** | 3 hours |
| **2nd pause** | 6 hours |
| **3rd pause** | Permanently disabled |

### During a Pause

- Template status shows **Paused** (WhatsApp Manager) or `quality_score: RED` (API)
- **Cannot send** the template — API requests are rejected
- No charges or messaging limit deductions apply
- Other templates from the same phone number are **not immediately affected**

### Unpause Options

**Manual (via API):**

```
POST /<TEMPLATE_ID>/unpause
```

**Manual (via WhatsApp Manager):**  
Click the "manually unpause it" link in the template notification.

**Automatic unpause:**  
Templates auto-unpause after the pause duration ends, restoring status to **Active** with reset quality ratings.

### Notifications

| Channel | Event |
|---------|-------|
| WhatsApp Manager | Pause and unpause alerts |
| Email | Pause and unpause alerts |
| Webhook | `message_template_status_update` with `paused` event |

### Recommended Actions When Paused

1. Halt any automated campaigns using the paused template
2. Edit template content to improve engagement quality
3. Review targeting logic and delivery parameters
4. Wait for template to become **Active** before resuming campaigns
5. Consider appealing if the pause seems unjustified

---

## 16. Tap Target URL Title Override

Allows **image-based, text-based, and header-less** templates to act as interactive Call-to-Action URL buttons using the `tap_target_configuration` component.

### Requirements

> WhatsApp Business Accounts must be **fully verified** and consistently maintain **high-quality messaging standards** to use this feature.

### How It Works

- Custom button title is displayed on the template
- Tapping opens the destination URL from the first URL button
- Enhances interactivity for templates without traditional button structures

### API Implementation

**Endpoint:** `POST /<PHONE_NUMBER_ID>/messages`

```json
{
  "messaging_product": "whatsapp",
  "recipient_type": "individual",
  "to": "+919876543210",
  "type": "template",
  "template": {
    "name": "august_promotion",
    "language": { "code": "en" },
    "components": [
      {
        "type": "header",
        "parameters": [{ "type": "image", "image": { "id": "<MEDIA_ID>" } }]
      },
      {
        "type": "body",
        "parameters": [{ "type": "text", "text": "Hello Andy" }]
      },
      {
        "type": "tap_target_configuration",
        "parameters": [
          {
            "type": "tap_target_configuration",
            "tap_target_configuration": [
              {
                "url": "https://www.example.com/offers",
                "title": "Offer Details"
              }
            ]
          }
        ]
      }
    ]
  }
}
```

**Response:**

```json
{
  "messages": [{ "id": "<MESSAGE_ID>", "message_status": "accepted" }]
}
```

---

## 17. Time-to-Live (TTL)

TTL defines how long WhatsApp attempts to deliver a message that cannot be immediately delivered (e.g., user is offline).

### Default Values & Customization Range

| Template Type | Default TTL | API | Customizable Range |
|---------------|------------|-----|--------------------|
| **Authentication** | 10 minutes | Cloud API | 30 seconds – 15 minutes |
| **Utility** | 30 days | Cloud API only | 30 seconds – 12 hours |
| **Marketing** | 30 days | Marketing Messages API | 12 hours – 30 days |

> **Best Practice:** Set TTL for all authentication templates equal to or less than your code expiration time.

### Setting Custom TTL

Include `message_send_ttl_seconds` in your template creation or message request:

```bash
curl 'https://graph.facebook.com/v25.0/<WABA_ID>/message_templates' \
  -H 'Authorization: Bearer EAAJB...' \
  -H 'Content-Type: application/json' \
  -d '{
    "name": "otp_verification",
    "language": "en_US",
    "category": "AUTHENTICATION",
    "message_send_ttl_seconds": 300,
    "components": [
      {
        "type": "BODY",
        "add_security_recommendation": true
      },
      {
        "type": "BUTTONS",
        "buttons": [
          {
            "type": "OTP",
            "otp_type": "COPY_CODE",
            "text": "Copy Code"
          }
        ]
      }
    ]
  }'
```

### Special Values

| Value | Effect |
|-------|--------|
| `30` to `900` | Auth templates (30 sec – 15 min) |
| `30` to `43200` | Utility templates (30 sec – 12 hrs) |
| `43200` to `2592000` | Marketing templates (12 hrs – 30 days) |
| `-1` | Equivalent to 30-day TTL (Auth/Utility only) |

### After Category Reclassification

When WhatsApp auto-reassigns a template's category:
- Custom TTL resets to `null`
- You must reconfigure TTL within the new category's valid range

---

## Quick Reference

### API Endpoints Summary

| Operation | Method | Endpoint |
|-----------|--------|----------|
| Create template | `POST` | `/<WABA_ID>/message_templates` |
| List templates | `GET` | `/<WABA_ID>/message_templates` |
| Edit template | `POST` | `/<TEMPLATE_ID>` |
| Delete template | `DELETE` | `/<WABA_ID>/message_templates` |
| Get quality score | `GET` | `/<TEMPLATE_ID>?fields=quality_score` |
| Compare templates | `GET` | `/<TEMPLATE_ID>/compare` |
| Unpause template | `POST` | `/<TEMPLATE_ID>/unpause` |
| Migrate templates | `POST` | `/<DEST_WABA_ID>/migrate_message_templates` |
| Browse library | `GET` | `/message_template_library` |
| Send template msg | `POST` | `/<PHONE_NUMBER_ID>/messages` |

### Webhook Events Reference

| Webhook | Trigger |
|---------|---------|
| `message_template_status_update` | Template approved, rejected, paused, or archived |
| `message_template_quality_update` | Quality score changes |
| `message_template_components_update` | Template components changed |
| `user_preferences` | User stops or resumes marketing messages |

### Template Status Flow

```
PENDING ──► APPROVED ──► [Sending] ──► PAUSED (quality issue)
   │                                       │
   └──► REJECTED ──► (edit & resubmit)    └──► DISABLED (3rd pause)
                                                    │
APPROVED (inactive 12mo) ──► ARCHIVED ──► (28 days) ──► DELETED
```

---

*Documentation compiled from Meta for Developers — WhatsApp Business Platform. Last synced: April 2026.*
