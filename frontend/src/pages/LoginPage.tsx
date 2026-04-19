import { useEffect } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../state/auth/AuthContext'
import { DotLogoMark } from '../ui/logo/DotLogoMark'

export function LoginPage() {
  const { state, beginGitHubLogin } = useAuth()
  const navigate = useNavigate()
  const location = useLocation() as { state?: { from?: string } }

  useEffect(() => {
    if (state.status === 'authenticated') {
      navigate(location?.state?.from ?? '/app', { replace: true })
    }
  }, [state.status, navigate, location?.state?.from])

  return (
    <div style={{ minHeight: '100svh', display: 'grid', placeItems: 'center', padding: '48px 0' }}>
      <div className="container" style={{ maxWidth: 520, width: '100%' }}>
        <div className="glass glass--panel" style={{ padding: 24 }}>
          <div style={{ display: 'flex', justifyContent: 'center' }}>
            <DotLogoMark width={180} height={40} />
          </div>

          <div style={{ marginTop: 18, color: '#fff', fontSize: 20, letterSpacing: -0.35, textAlign: 'center' }}>
            Sign in with GitHub
          </div>
          <div style={{ marginTop: 10, color: 'rgba(255,255,255,0.72)', fontSize: 14, lineHeight: 1.6, textAlign: 'center' }}>
            RedFlag CI uses GitHub OAuth. We request read access to your repositories.
          </div>

          <div style={{ marginTop: 18, display: 'flex', justifyContent: 'center' }}>
            <button
              type="button"
              onClick={beginGitHubLogin}
              className="glass glow-cyan"
              style={{
                cursor: 'pointer',
                padding: '14px 18px',
                borderRadius: 12,
                background: 'rgba(255,255,255,0.04)',
                color: '#fff',
                border: '1px solid rgba(0,251,255,0.18)',
                fontSize: 15,
                width: '100%',
                maxWidth: 360,
              }}
            >
              Continue with GitHub
            </button>
          </div>

          <div
            style={{
              marginTop: 16,
              color: 'rgba(255,255,255,0.56)',
              fontSize: 12,
              lineHeight: 1.55,
              textAlign: 'center',
            }}
          >
            We never store your full repository. Analysis is performed on pull request diffs and scan metadata stored in
            your dashboard database.
          </div>
        </div>
      </div>
    </div>
  )
}
