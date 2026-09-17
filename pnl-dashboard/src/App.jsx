import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { ShieldAlert } from 'lucide-react'
import { DataProvider, useData } from './store/DataContext'
import { AuthProvider, useAuth } from './store/AuthContext'
import Layout from './components/Layout'
import PortalLayout from './components/PortalLayout'
import { Toaster, EmptyState } from './components/ui'
import { MODULES, moduleLabel } from './lib/domain'

import Login from './pages/Login'
import Analytics from './pages/Analytics'
import CreateOrder from './pages/CreateOrder'
import OrderRequests from './pages/OrderRequests'
import OrderDetail from './pages/OrderDetail'
import Quotations from './pages/Quotations'
import Shipments from './pages/Shipments'
import Customers from './pages/Customers'
import CustomerDetail from './pages/CustomerDetail'
import Invoices from './pages/Invoices'
import Users from './pages/Users'
import Branches from './pages/Branches'
import Content from './pages/Content'
import Notifications from './pages/Notifications'
import Chatbot from './pages/Chatbot'
import Settings from './pages/Settings'

import PortalHome from './pages/portal/PortalHome'
import PortalNewOrder from './pages/portal/PortalNewOrder'
import PortalOrders from './pages/portal/PortalOrders'
import PortalOrderDetail from './pages/portal/PortalOrderDetail'
import PortalNotifications from './pages/portal/PortalNotifications'

/** Blocks a module an Administration User has not been granted, rather than 404-ing it. */
function Guard({ module, children }) {
  const { can } = useAuth()
  if (!can(module)) {
    return (
      <div className="py-24">
        <EmptyState
          icon={ShieldAlert}
          label={'You do not have access to ' + moduleLabel(module)}
          hint="Your administrator account has not been granted this module. A Super Administrator can change that in Users & Permissions."
        />
      </div>
    )
  }
  return children
}

/** Administration Users may not hold Analytics, so land them on the first module they do. */
function StaffLanding() {
  const { can } = useAuth()
  const first = MODULES.find((m) => can(m.id))
  if (!first) {
    return (
      <div className="py-24">
        <EmptyState icon={ShieldAlert} label="No modules assigned" hint="Ask a Super Administrator to grant you access." />
      </div>
    )
  }
  return <Navigate to={first.path} replace />
}

function StaffRoutes() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<StaffLanding />} />
        <Route path="analytics" element={<Guard module="analytics"><Analytics /></Guard>} />
        <Route path="create-order" element={<Guard module="create_order"><CreateOrder /></Guard>} />
        <Route path="orders" element={<Guard module="order_requests"><OrderRequests /></Guard>} />
        <Route path="orders/:id" element={<Guard module="order_requests"><OrderDetail /></Guard>} />
        <Route path="quotations" element={<Guard module="quotations"><Quotations /></Guard>} />
        <Route path="shipments" element={<Guard module="shipments"><Shipments /></Guard>} />
        <Route path="customers" element={<Guard module="customers"><Customers /></Guard>} />
        <Route path="customers/:id" element={<Guard module="customers"><CustomerDetail /></Guard>} />
        <Route path="invoices" element={<Guard module="invoices"><Invoices /></Guard>} />
        <Route path="users" element={<Guard module="users"><Users /></Guard>} />
        <Route path="branches" element={<Guard module="branches"><Branches /></Guard>} />
        <Route path="content" element={<Guard module="content"><Content /></Guard>} />
        <Route path="notifications" element={<Guard module="notifications"><Notifications /></Guard>} />
        <Route path="chatbot" element={<Guard module="chatbot"><Chatbot /></Guard>} />
        <Route path="settings" element={<Guard module="settings"><Settings /></Guard>} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  )
}

function CustomerRoutes() {
  return (
    <Routes>
      <Route path="/portal" element={<PortalLayout />}>
        <Route index element={<PortalHome />} />
        <Route path="new-order" element={<PortalNewOrder />} />
        <Route path="orders" element={<PortalOrders />} />
        <Route path="orders/:id" element={<PortalOrderDetail />} />
        <Route path="notifications" element={<PortalNotifications />} />
      </Route>
      <Route path="*" element={<Navigate to="/portal" replace />} />
    </Routes>
  )
}

function Shell() {
  const { isStaff, isCustomer } = useAuth()
  const { toasts, dismissToast } = useData()

  return (
    <>
      {isStaff ? <StaffRoutes /> : isCustomer ? <CustomerRoutes /> : <Login />}
      <Toaster toasts={toasts} dismiss={dismissToast} />
    </>
  )
}

export default function App() {
  return (
    <DataProvider>
      <AuthProvider>
        <BrowserRouter>
          <Shell />
        </BrowserRouter>
      </AuthProvider>
    </DataProvider>
  )
}
