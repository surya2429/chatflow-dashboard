import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { CheckCircle2, XCircle, Loader2, Instagram as InstagramIcon } from 'lucide-react'
import { parseInstagramOAuthCallback, verifyInstagramOAuthState } from '../utils/instagramOAuth'
import { apiPost } from '../utils/api'

/**
 * Lands here after the user approves/denies access on Instagram's consent
 * screen (redirect_uri from the authorize call). The `code` this receives is
 * single-use and expires in ~1 hour — it's handed straight to the backend,
 * which holds the app secret needed to redeem it for an access token.
 */
export default function InstagramOAuthCallback() {
  const navigate = useNavigate()
  const [status, setStatus] = useState('working') // 'working' | 'success' | 'error'
  const [message, setMessage] = useState('Connecting your Instagram account…')

  useEffect(() => {
    const { code, state, error, errorReason, errorDescription } = parseInstagramOAuthCallback(window.location.search)

    if (error) {
      setStatus('error')
      setMessage(errorReason === 'user_denied'
        ? 'You cancelled the connection — no changes were made.'
        : (errorDescription || 'Instagram declined the authorization request.'))
      return
    }
    if (!code) {
      setStatus('error')
      setMessage('Missing authorization code in the redirect. Please try connecting again.')
      return
    }
    if (!verifyInstagramOAuthState(state)) {
      setStatus('error')
      setMessage('This authorization link looks like it was tampered with (state mismatch). Please try again.')
      return
    }

    apiPost('/instagram/oauth/callback', { code })
      .then(data => {
        setStatus('success')
        setMessage(`@${data.username} is now connected.`)
        setTimeout(() => navigate('/instagram/automation'), 1500)
      })
      .catch(err => {
        setStatus('error')
        setMessage(err.message || 'Could not complete the Instagram connection. Please try again.')
      })
  }, [navigate])

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-sm bg-white border border-surface-border rounded-2xl shadow-modal p-6 text-center">
        <div className="w-12 h-12 mx-auto rounded-xl flex items-center justify-center mb-4"
          style={{ background: 'linear-gradient(135deg,#f9ce34,#ee2a7b,#6228d7)' }}>
          <InstagramIcon size={22} className="text-white" />
        </div>

        {status === 'working' && <Loader2 size={22} className="mx-auto text-slate-400 animate-spin mb-3" />}
        {status === 'success' && <CheckCircle2 size={22} className="mx-auto text-emerald-500 mb-3" />}
        {status === 'error' && <XCircle size={22} className="mx-auto text-red-500 mb-3" />}

        <p className="text-[13px] font-semibold text-slate-800">
          {status === 'working' ? 'Connecting Instagram…' : status === 'success' ? 'Connected!' : "Couldn't connect"}
        </p>
        <p className="text-[12px] text-slate-500 mt-1.5 leading-relaxed">{message}</p>

        {status === 'error' && (
          <button onClick={() => navigate('/instagram/automation')}
            className="mt-4 w-full py-2 rounded-lg bg-primary text-white text-[12px] font-semibold hover:bg-primary/90 transition-colors">
            Back to Instagram Automation
          </button>
        )}
      </div>
    </div>
  )
}
