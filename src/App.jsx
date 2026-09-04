import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AppProvider } from './context/AppContext'
import { AuthProvider, useAuth } from './context/AuthContext'
import { ConversationProvider } from './context/ConversationContext'
import { CallProvider } from './context/CallContext'
import IncomingCallBanner from './components/IncomingCallBanner'
import CallWidget from './components/CallWidget'
import MainLayout from './layouts/MainLayout'
import SignIn from './pages/SignIn'
import Home from './pages/Home'
import Conversations from './pages/Conversations'
import Contacts from './pages/Contacts'
import Templates from './pages/Templates'
import FlowSetup from './pages/FlowSetup'
import Catalog from './pages/Catalog'
import Broadcasting from './pages/Broadcasting'
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


function AppRoutes() {
  const { isAuthenticated } = useAuth()
  return (
    <Routes>
      <Route
        path="/signin"
        element={isAuthenticated ? <Navigate to="/" replace /> : <SignIn />}
      />
      <Route path="/clientele" element={<Clientele />} />
      <Route path="/voice-landing" element={<VoiceLanding />} />
      {/* Matches the Instagram Business Login redirect_uri exactly — must work whether or not the app session is authenticated */}
      <Route path="/instagramBusinessLoginSetup" element={<InstagramOAuthCallback />} />
      <Route
        path="/*"
        element={
          isAuthenticated
            ? (
              <CallProvider>
                {/* Global call overlays — visible on every page */}
                <IncomingCallBanner />
                <CallWidget />

                <ConversationProvider>
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
                      <Route path="instagram/automations" element={<InstagramAutomations />} />
                      <Route path="installation" element={<Installation />} />
                      <Route path="channels" element={<ConnectWhatsApp />} />
                      <Route path="settings" element={<Settings />} />
                      <Route path="tickets" element={<Tickets />} />
                    </Route>
                  </Routes>
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
