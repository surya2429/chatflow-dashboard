import { useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AppProvider } from './context/AppContext'
import { AuthProvider, useAuth } from './context/AuthContext'
import { ConversationProvider } from './context/ConversationContext'
import { CallProvider } from './context/CallContext'
import { WebchatCallProvider } from './context/WebchatCallContext'
import { loadBotId } from './constants/webchat'
import IncomingCallBanner from './components/IncomingCallBanner'
import CallWidget from './components/CallWidget'
import WebchatIncomingCallBanner from './components/WebchatIncomingCallBanner'
import WebchatCallWidget from './components/WebchatCallWidget'
import MainLayout from './layouts/MainLayout'
import SignIn from './pages/SignIn'
import Home from './pages/Home'
import Conversations from './pages/Conversations'
import Contacts from './pages/Contacts'
import Templates from './pages/Templates'
import FlowSetup from './pages/FlowSetup'
import Catalog from './pages/Catalog'
import Broadcasting from './pages/Broadcasting'
import InstagramBroadcasts from './pages/InstagramBroadcasts'
import Analytics from './pages/Analytics'
import Integrations from './pages/Integrations'
import Voice from './pages/Voice'
import Installation from './pages/Installation'
import ConnectWhatsApp from './pages/ConnectWhatsApp'
import Settings from './pages/Settings'
import Tickets from './pages/Tickets'
import Clientele from './pages/Clientele'
import WebChat from './pages/WebChat'
import WebChatAppearance from './pages/WebChatAppearance'
import Shopify from './pages/Shopify'
import InstagramAutomations from './pages/InstagramAutomations'
import InstagramAnalytics from './pages/InstagramAnalytics'
import InstagramInbox from './pages/InstagramInbox'
import InstagramContacts from './pages/InstagramContacts'
import WebChatInbox from './pages/WebChatInbox'
import WebChatContacts from './pages/WebChatContacts'
import WebChatAnalytics from './pages/WebChatAnalytics'
import VoiceLanding from './pages/VoiceLanding'
import InstagramOAuthCallback from './pages/InstagramOAuthCallback'
import WebChatCallTester from './pages/WebChatCallTester'
import WebChatLandingPage from './pages/WebChatLandingPage'
import WebChatFlowLivePreview from './pages/WebChatFlowLivePreview'
import WebChatEmbed from './pages/WebChatEmbed'
import AdminConsole from './pages/AdminConsole'


function AppRoutes() {
  const { isAuthenticated } = useAuth()
  // Fetch the database-assigned bot id once per page load. Every surface that
  // shows it (install snippet, landing URL, Analytics) subscribes via
  // useBotId() and re-renders when it arrives.
  useEffect(() => { loadBotId() }, [])
  return (
    <Routes>
      <Route
        path="/signin"
        element={isAuthenticated ? <Navigate to="/" replace /> : <SignIn />}
      />
      <Route path="/clientele" element={<Clientele />} />
      {/* SmatBot staff console — outside the customer login; the server checks every request */}
      <Route path="/admin" element={<AdminConsole />} />
      <Route path="/admin/plans" element={<Navigate to="/admin" replace />} />
      <Route path="/voice-landing" element={<VoiceLanding />} />
      {/* Standalone "you are the website visitor" call tester — bypasses login/layout
          so it can be opened in a second tab to test real webchat calling end-to-end. */}
      <Route path="/call-test" element={<WebChatCallTester />} />
      {/* The real page behind the Widget Builder's "Landing Page" link and "Preview
          Widget" button — bypasses login/layout since the whole point is a link anyone
          (no dashboard account) can open and land straight in the chat. */}
      <Route path="/webchat-landing" element={<WebChatLandingPage />} />
      {/* The real, standalone full-page URL behind the Flow Builder canvas's
          "Live Preview" toolbar button — runs the SPECIFIC flow that was open
          in the canvas (via FLOW_PREVIEW_STORAGE_KEY in localStorage), unlike
          /webchat-landing above which is just a generic static widget demo
          with no flow logic. Bypasses login/layout for the same reason. */}
      <Route path="/webchat-flow-preview" element={<WebChatFlowLivePreview />} />
      {/* What the install snippet's iframe points at. Bypasses login/layout for
          the same reason as the routes above, and additionally renders on a
          transparent background: it is composited over a stranger's website, so
          anything it paints outside the widget itself would show up there. */}
      <Route path="/webchat-embed" element={<WebChatEmbed />} />
      {/* Matches the Instagram Business Login redirect_uri exactly — must work whether or not the app session is authenticated */}
      <Route path="/instagramBusinessLoginSetup" element={<InstagramOAuthCallback />} />
      <Route
        path="/*"
        element={
          isAuthenticated
            ? (
              <CallProvider>
              {/* ConversationProvider now wraps WebchatCallProvider (not the
                  other way around) so WebchatCallContext can call
                  useConversations() itself — it needs to log a real
                  call_missed/call_answered event into the visitor's own
                  conversation thread when a Website Chat call ends, the same
                  way constants/mockData.js's seeded call entries already
                  look, instead of a call leaving no trace in the Inbox at
                  all. */}
              <ConversationProvider>
              <WebchatCallProvider>
                {/* Global call overlays — visible on every page */}
                <IncomingCallBanner />
                <CallWidget />
                <WebchatIncomingCallBanner />
                <WebchatCallWidget />

                  <Routes>
                    <Route path="/" element={<MainLayout />}>
                      <Route index element={<Home />} />
                      <Route path="conversations" element={<Conversations />} />
                      <Route path="contacts" element={<Contacts />} />
                      <Route path="templates" element={<Templates />} />
                      <Route path="flows" element={<FlowSetup />} />
                      <Route path="catalog" element={<Catalog />} />
                      <Route path="broadcasting" element={<Broadcasting />} />
                      <Route path="analytics" element={<Analytics />} />
                      <Route path="integrations" element={<Integrations />} />
                      <Route path="voice" element={<Voice />} />
                      <Route path="webchat" element={<WebChat />} />
                      <Route path="webchat/appearance" element={<WebChatAppearance />} />
                      <Route path="webchat/inbox" element={<WebChatInbox />} />
                      <Route path="webchat/contacts" element={<WebChatContacts />} />
                      <Route path="webchat/analytics" element={<WebChatAnalytics />} />
                      <Route path="shopify" element={<Shopify />} />
                      <Route path="instagram" element={<InstagramAnalytics />} />
                      <Route path="instagram/inbox" element={<InstagramInbox />} />
                      <Route path="instagram/contacts" element={<InstagramContacts />} />
                      <Route path="instagram/broadcasts" element={<InstagramBroadcasts />} />
                      <Route path="instagram/automations" element={<InstagramAutomations />} />
                      <Route path="installation" element={<Installation />} />
                      <Route path="channels" element={<ConnectWhatsApp />} />
                      <Route path="settings" element={<Settings />} />
                      <Route path="tickets" element={<Tickets />} />
                    </Route>
                  </Routes>
              </WebchatCallProvider>
              </ConversationProvider>
              </CallProvider>
            )
            : <Navigate to="/signin" replace />
        }
      />
    </Routes>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppProvider>
          <AppRoutes />
        </AppProvider>
      </AuthProvider>
    </BrowserRouter>
  )
}
