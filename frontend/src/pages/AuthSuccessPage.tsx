import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../state/auth/AuthContext'

export function AuthSuccessPage() {
  const { setTokenFromOAuthFragment } = useAuth()
  const navigate = useNavigate()
  const [message, setMessage] = useState('Finalizing secure session…')

  useEffect(() => {
    const token = setTokenFromOAuthFragment(window.location.hash)

    // Scrub token from URL immediately.
    window.history.replaceState(null, '', '/auth/success')

    if (!token) {
      navigate('/login', { replace: true })
      return
    }

    setMessage('Authenticated successfully. Redirecting to your dashboard…')
    const t = window.setTimeout(() => navigate('/app', { replace: true }), 1500)
    return () => window.clearTimeout(t)
  }, [setTokenFromOAuthFragment, navigate])

  return (
    <div className="container" style={{ padding: '72px 0' }}>
      <div className="glass glass--panel" style={{ padding: 18, maxWidth: 560, margin: '0 auto' }}>
        <div style={{ color: 'rgba(255,255,255,0.72)', fontSize: 14 }}>{message}</div>
      </div>
    </div>
  )
}
