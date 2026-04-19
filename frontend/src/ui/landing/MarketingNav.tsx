import { useNavigate } from 'react-router-dom'
import { DotLogoMark } from '../logo/DotLogoMark'
import { useAuth } from '../../state/auth/AuthContext'

export function MarketingNav() {
  const navigate = useNavigate()
  const { state } = useAuth()

  const scrollTo = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' })
  }

  return (
    <div
      className="glass glass--panel"
      style={{
        position: 'sticky',
        top: 0,
        zIndex: 25,
        borderRadius: 0,
        borderLeft: 'none',
        borderRight: 'none',
        borderTop: 'none',
        backdropFilter: 'blur(var(--glass-blur))',
      }}
    >
      <div className="container" style={{ padding: '14px 0' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <DotLogoMark width={154} height={34} />

          <div style={{ marginLeft: 10, display: 'flex', gap: 14, alignItems: 'center', flexWrap: 'wrap' }}>
            <button
              onClick={() => scrollTo('features')}
              style={{ fontSize: 12, color: 'rgba(255,255,255,0.72)', letterSpacing: 0.6, background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
            >
              Features
            </button>
            <button
              onClick={() => scrollTo('how-it-works')}
              style={{ fontSize: 12, color: 'rgba(255,255,255,0.72)', letterSpacing: 0.6, background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
            >
              How it works
            </button>
            <button
              onClick={() => scrollTo('diff-preview')}
              style={{ fontSize: 12, color: 'rgba(255,255,255,0.72)', letterSpacing: 0.6, background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
            >
              Diff viewer
            </button>
          </div>

          <div style={{ marginLeft: 'auto', display: 'flex', gap: 10, alignItems: 'center' }}>
            <button
              onClick={() => navigate('/login')}
              className="glass"
              style={{
                cursor: 'pointer',
                padding: '8px 12px',
                borderRadius: 12,
                background: 'rgba(255,255,255,0.03)',
                border: '1px solid rgba(255,255,255,0.10)',
                color: 'rgba(255,255,255,0.88)',
                fontSize: 12,
              }}
            >
              Sign in
            </button>
            <button
              onClick={() => navigate(state.status === 'authenticated' ? '/app' : '/login')}
              className="glass glow-cyan"
              style={{
                cursor: 'pointer',
                padding: '8px 12px',
                borderRadius: 12,
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(0,251,255,0.18)',
                color: '#fff',
                fontSize: 12,
              }}
            >
              Dashboard
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
