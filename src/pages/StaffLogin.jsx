// StaffLogin.jsx — where SmatBot staff land from the admin panel's "log in as customer".
// The panel (a separate app) sends a 2-minute ticket in the #fragment; the server swaps it for the
// customer, and the dashboard opens as them with a "Back to admin" banner (MainLayout).
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Loader2, AlertCircle } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { redeemStaffTicket, ADMIN_URL } from '../lib/billingApi'

export default function StaffLogin() {
  const { loginAs } = useAuth()
  const navigate = useNavigate()
  const [error, setError] = useState('')

  useEffect(() => {
    const ticket = new URLSearchParams(window.location.hash.slice(1)).get('ticket') || ''
    window.history.replaceState(null, '', window.location.pathname)   // don't leave the ticket in history
    redeemStaffTicket(ticket).then((c) => {
      loginAs({
        role: 'admin', roleLabel: 'Admin', name: c.name, email: c.email, phone: c.phone,
        initials: c.name.split(/\s+/).filter(Boolean).map((w) => w[0]).join('').slice(0, 2).toUpperCase(), color: '#0066ff',
        workspaceId: c.workspaceId,
        workspace: { name: c.company, plan: c.planName || 'Free', city: c.city, stateCode: c.stateCode },
        creditBalance: 0,
        impersonatedBy: c.by,
      })
      navigate('/', { replace: true })
    }).catch((e) => setError(e.message))
  }, [])   // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-slate-50">
      {error ? (
        <div role="alert" className="max-w-sm bg-white border border-slate-200 rounded-2xl p-6 text-center">
          <AlertCircle className="mx-auto text-red-500" size={22}/>
          <p className="text-sm text-slate-700 mt-3">{error}</p>
          <a href={ADMIN_URL} className="inline-block mt-4 text-sm font-semibold text-primary hover:underline">Back to the admin panel</a>
        </div>
      ) : (
        <p role="status" className="flex items-center gap-2 text-sm text-slate-500"><Loader2 size={16} className="animate-spin"/> Opening the customer's dashboard…</p>
      )}
    </div>
  )
}
