# ChatFlow Mobile — Live Agent App

## Goal

Build a **React Native** mobile app (iOS + Android) that lets a live support agent handle **WhatsApp, Instagram, and Website Chat** conversations — including real voice/video calls — entirely from their phone, without ever needing to log into the ChatFlow web dashboard. This is v1 with **full parity**: all three channels, plus calling. Since no real backend exists for any of this today (see below), **building that backend is part of this engagement**, not a separate track.

If you have access to the existing ChatFlow web dashboard repo, it is the ground truth for behavior to replicate — file paths are given throughout so you can go read the real implementation rather than guess. If you don't have access to it, everything you need to build against is described concretely below.

## Current state — read this before designing anything

This is the single most important section. It is easy to assume a dashboard this polished has a real backend behind it. It mostly doesn't.

- **Auth is 100% mock.** The web dashboard's `src/context/AuthContext.jsx` holds a hardcoded array of demo users (email, plaintext password, role, name) and "logs in" with an `Array.find` against it — no JWT, no cookies, no server call, and the session isn't even persisted (a page refresh logs everyone out). There is a real-looking email/password form, but it feeds the same mock function behind a fake 600ms delay. **There is no auth endpoint anywhere to reuse.** You are designing real auth from scratch.
- **Conversations and messages have zero backend.** The dashboard's `src/context/ConversationContext.jsx` seeds all conversations from a static mock-data file into local React state on page load, and every action (send message, take over from bot, assign, label, note, resolve, snooze, star, archive) just mutates that in-memory state. Reload the page and WhatsApp/Instagram conversations reset to the mock seed. **There is no conversations/messages REST API and no database table for them today.** You are designing this from scratch too.
- **A real backend does exist, but for something else.** A separate TypeScript service (Postgres + Redis + BullMQ) implements the WhatsApp Cloud API send/webhook pipeline — real database, real queues, real migrations — but it is **not wired to the dashboard UI at all**. It doesn't serve conversations, contacts, or auth. Another separate Node service implements WhatsApp's Business Calling API (SIP/SDP) — also real, also unwired to anything conversation-related. Treat both as reference/precedent for backend conventions (e.g. migration style, repository pattern) rather than something to extend as-is, unless it turns out to be the natural place to add the new conversations schema.
- **One real, working live-push pattern exists — copy its shape.** The dashboard's bot-configuration editor (appearance/flow builder) has genuine live updates: a plain `GET`/`PATCH` REST pair plus a `GET .../events` endpoint that opens a browser `EventSource` (Server-Sent Events), pushing a version-numbered payload so out-of-order or replayed delivery is harmless, with the browser's native auto-reconnect handling drops. This is proof the team already has one correct pattern for "live update, versioned, idempotent" — reuse that shape for the new conversations API's live-update mechanism. That said, SSE does not background well on a mobile OS (iOS in particular kills long-lived HTTP connections when the app is backgrounded), so for the mobile app specifically you should pair an SSE-or-WebSocket channel for **foreground** live updates with **FCM (Android) / APNs (iOS)** push notifications for background/killed-app delivery.
- **Voice/video calling is real for one channel, completely fake for another — know which is which.** WhatsApp's calling in the dashboard is entirely simulated: `setTimeout`-driven fake ring → connecting → connected states, no real media, no signaling of any kind. **Do not use it as a reference for how calling should work.** Website Chat's calling, by contrast, is real and functional: a plain WebSocket relay server, real `RTCPeerConnection`/`getUserMedia` on the client, and a working agent-side call flow triggered from the dashboard's inbox. This is your real reference — protocol described in detail below — but it is explicitly **dev-only**: no authentication on the signaling connection, no TLS, no TURN server (STUN-only, which will fail across a meaningful fraction of real-world NATs and almost all mobile carrier networks), and no persistence or multi-room lifecycle management. Hardening this for production and for a real mobile client is part of the backend work here.
- **Zero push-notification infrastructure exists anywhere in the codebase.** There's a single UI toggle in Settings labeled "Mobile Push Notifications — Requires mobile app" that just flips a local boolean. No service worker, no manifest, no FCM/APNs code, no relevant dependency. This is a green field.
- **Roles exist as a concept but not as real authorization.** Admin / Supervisor / Agent are defined today only as a whitelist of which navigation items each role can see in the web UI — there is no per-action, server-enforced permission check anywhere (e.g. nothing stops a client from calling an "admin-only" action if it could reach the code path). Preserve the three-role model, but implement it as real server-side authorization this time, not just client-side UI-hiding.

## What the current agent workflow looks like (what you're replicating)

WhatsApp, Instagram, and Website Chat each have their own inbox page in the dashboard, but they share roughly 80% of their shape — a mobile app should build **one core inbox experience** and layer channel-specific pieces on top, not three separate screens.

**Shared across all three channels:**
- A conversation list showing avatar, name, last-message preview (bold if unread), timestamp, unread-count badge, status dot (bot-handled / agent-handled / resolved), assigned-agent chip, and up to one label/tag chip.
- Filter views: **All chats / Active chats / Assigned to me / Unassigned**, plus a secondary set — **Open, Pending, Solved, Unread, Favourite, Last 24h** — and an advanced filter panel (status, agent, label, date range, starred/unread/archived toggles).
- Inside a conversation: reply (text + emoji), **take over from the bot** (shown prominently whenever the bot is currently handling the chat), **transfer/reassign** to another agent, add a **private note** (never sent to the customer, visually distinct), add/remove **labels**, and **mark resolved / return to bot / snooze / star / archive**.
- A contact/visitor info side panel: editable profile fields, custom fields, a record of any answers the bot's automation flow captured from this person, and past conversation history.

**Channel-specific differences to design around, not paper over:**
- **WhatsApp** requires sending a pre-approved **template message** to open a new conversation outside an active 24-hour session window (a real WhatsApp Business API rule) — the mobile app needs a template picker with variable substitution for this case.
- **Instagram** has three distinct sub-types sharing one inbox — **Direct Messages, Comments, and Story Replies** — and comments/story replies aren't a private 1:1 thread the same way DMs are; the reply affordance differs per type. New conversations can also only be started with existing followers.
- **Website Chat** visitors have no account — identity is an ephemeral generated ID, paired with contextual metadata (what page they're on, browser/OS) instead of a phone number or handle. This channel also has bot-flow "captured answer" messages (structured Q&A the automation collected) that should render distinctly and roll up into the contact panel. It's also the one channel with real calling (below).

**Data shapes to design your database schema and API responses around** (pulled directly from the dashboard's in-memory models — treat as the contract, not a suggestion):

```
Conversation {
  id, name, avatar, channel,               // 'whatsapp' | 'instagram' | 'webchat'
  status,                                   // 'bot' | 'agent' | 'resolved'
  agentId, agentName,
  source,                                    // e.g. instagram 'dm'|'comment'|'story'; whatsapp ad/CTWA source
  labels: [],
  lastMessage, unread, starred, archived, snoozed,
  timestamp,
  // exactly one identity field depending on channel:
  phone,        // whatsapp
  handle,       // instagram
  visitorId,    // webchat — plus page/browser/os metadata
}

Message {
  id, type,     // 'incoming' | 'outgoing' | 'note' | 'event' | 'answer' | 'template'
  text, time, sender, agentName?,
  template?: { name, variables, buttons, category },   // whatsapp template sends
  questionType?, value?,                                // webchat bot-flow captured answers
}
```

**One more thing worth fixing, not just replicating:** the dashboard has a "Go Online (as Agent)" toggle that today does nothing real — it's local UI state that doesn't affect routing, presence, or notifications. In the mobile app, agent online/offline/away presence should be a real, server-tracked value that actually drives conversation assignment and notification delivery.

## What to build

### Backend (new, or extended from the existing services)

1. **Real authentication** — replace the mock user array with real accounts, password hashing, JWT access tokens + refresh tokens (mobile sessions need to survive app restarts and stay logged in for a long time — plan for refresh-token rotation and revocation). Preserve the Admin/Supervisor/Agent role model, but enforce it server-side on every relevant endpoint, not just by hiding UI.
2. **Conversations/messages REST API**, matching the data shapes above: list/filter conversations, fetch a thread, send a message, and every action in the shared action set (take-over, resolve, return-to-bot, transfer/reassign, star, archive, snooze, add/remove label, add note). Persist to a real database (Postgres is a reasonable default given the rest of this stack already uses it).
3. **Live updates for new messages/conversation changes** — a foreground channel (SSE or WebSocket, following the version-gated idempotent pattern already proven in the bot-config feature) plus FCM/APNs push for background delivery of new messages, new assignments, and incoming calls.
4. **Channel-specific carry-overs**: WhatsApp template message support and 24-hour-window logic; Instagram's DM/Comment/Story distinction; Website Chat's visitor-identity model.
5. **Harden the existing WebRTC signaling relay for real and mobile use**, preserving its protocol rather than reinventing it: clients connect over `wss://<host>?room=<conversationId>&role=agent|visitor` and exchange these JSON messages relayed verbatim by the server — `call-request {video}`, `call-accept`, `call-decline`, `offer {sdp}`, `answer {sdp}`, `ice-candidate {candidate}`, `hangup` — with the server also emitting `peer-joined`/`peer-left` presence events. Add: authentication on the signaling connection (today it's anonymous), TLS, a TURN server (today it's STUN-only, which will fail for a meaningful share of real network conditions, especially mobile), and proper room/session lifecycle management for concurrent calls across many agents.
6. **Push notification dispatch** — device-token registration per user/device, triggered server-side on new inbound message, new call request, and new assignment.

### Mobile app (React Native)

1. **Auth**: login screen against the new real endpoint, secure token storage (Keychain on iOS / Keystore on Android), silent refresh, logout.
2. **One shared inbox core** (list, thread, composer, contact panel, filter set, and the full action set described above), with channel-specific pieces layered in: a WhatsApp template picker, an Instagram DM/Comment/Story switcher, a Website Chat visitor-context panel.
3. **Real agent presence** (online/away/offline) wired to the backend, actually affecting routing/notifications — not the cosmetic toggle it is today.
4. **Push notifications**: foreground and background/killed-app handling for new messages, new assignments, and incoming calls; tapping a notification deep-links straight into the right conversation.
5. **Voice/video calling**: a native WebRTC implementation (e.g. `react-native-webrtc`) speaking the same signaling protocol above, with a full-screen incoming-call experience that works even when the app is backgrounded or the phone is locked (CallKit on iOS, ConnectionService on Android), mute/camera toggles, and call-outcome logging back into the conversation thread the same way the dashboard does today.

## Explicitly out of scope

- Rebuilding or replacing the existing web dashboard — this is additive; the dashboard keeps working as-is once the new backend exists (and could later be migrated onto it, but that's not this engagement).
- WhatsApp's simulated calling system — it is not a pattern to copy anywhere; the only real calling reference is the Website Chat WebRTC path described above.
- A production embeddable website-chat widget script — one doesn't exist in the source dashboard either (only in-dashboard preview/test surfaces); not part of this engagement.

## Suggested build order

1. Backend: real auth + the conversations/messages API + database schema. This unblocks everything else and is the highest-risk, highest-value piece to get right first.
2. Backend: push-notification registration and dispatch.
3. Backend: harden the signaling server (auth, TLS, TURN, room lifecycle).
4. Mobile: auth + a single-channel, text-only inbox (start with WhatsApp, the most fully-specified channel) — prove the whole loop end-to-end before adding breadth.
5. Mobile: extend to Instagram and Website Chat's channel-specific pieces.
6. Mobile: push notifications wired end-to-end (foreground, background, deep link).
7. Mobile: calling, last — it's the largest single remaining piece and depends on the hardened signaling server from step 3.

## Reference material (if you have access to the ChatFlow dashboard repo)

- Inbox/conversation UI: `src/pages/Conversations.jsx` (WhatsApp — most complete, read this one first), `src/pages/WebChatInbox.jsx`, `src/pages/InstagramInbox.jsx`, `src/components/inbox/SharedInboxParts.jsx`
- Conversation data/actions (the mock layer to replace): `src/context/ConversationContext.jsx`, `src/constants/mockData.js`
- Auth to replace (not copy): `src/context/AuthContext.jsx`, `src/pages/SignIn.jsx`
- Live-push pattern to reuse the shape of: `src/lib/liveConfig.js`
- Existing real-but-unwired backends (precedent/convention reference): `backend/` (WhatsApp Cloud API, Postgres/Redis/BullMQ), `server/` (WhatsApp Business Calling API)
- Real WebRTC calling to extend: `signaling-server/index.js`, `src/hooks/useWebRTC.js`, `src/hooks/useCallSignaling.js`, `src/context/WebchatCallContext.jsx`, `src/components/WebchatCallWidget.jsx`, `src/pages/WebChatCallTester.jsx`
- Fake calling, not a reference: `src/context/CallContext.jsx`, `src/components/CallWidget.jsx`, `src/components/IncomingCallBanner.jsx`
