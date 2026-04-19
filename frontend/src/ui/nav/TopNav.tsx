import { useMemo } from 'react'
import { DotLogoMark } from '../logo/DotLogoMark'
import { useAuth } from '../../state/auth/AuthContext'

type Props = {
  /** When set, shows dashboard title and user avatar (dashboard shell). */
  variant?: 'dashboard'
}

export function TopNav({ variant }: Props) {
  const { state, logout } = useAuth()

  const label = useMemo(() => {
    if (state.status !== 'authenticated') return 'Unauthenticated'
    const n = state.user.name?.trim()
    if (n) return n
    const e = state.user.email?.trim()
    if (e) return e
    return 'Authenticated'
  }, [state])

  return (
    <div
      className="glass glass--panel"
      style={{
        position: 'sticky',
        top: 0,
        zIndex: 20,
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

          {variant === 'dashboard' && (
            <div style={{ marginLeft: 8, color: '#fff', fontSize: 15, letterSpacing: -0.25 }}>Dashboard</div>
          )}

          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 10 }}>
            {variant === 'dashboard' && state.status === 'authenticated' && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                {state.user.avatarUrl ? (
                  <img
                    src={state.user.avatarUrl}
                    alt=""
                    width={32}
                    height={32}
                    style={{ borderRadius: 999, border: '1px solid rgba(255,255,255,0.12)' }}
                  />
                ) : null}
                <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.88)', maxWidth: 200 }} title={label}>
                  {state.user.name?.trim() || state.user.email?.trim() || 'Signed in'}
                </span>
              </div>
            )}
            <div
              className={state.status === 'authenticated' ? 'glow-cyan' : 'glow-red'}
              style={{
                padding: '6px 10px',
                borderRadius: 999,
                border: '1px solid rgba(255,255,255,0.10)',
                background: 'rgba(255,255,255,0.03)',
                color: 'rgba(255,255,255,0.72)',
                fontSize: 12,
              }}
              title={state.status}
            >
              {state.status === 'authenticated' ? 'Secure session' : 'Session required'} • {label}
            </div>

            {state.status === 'authenticated' && (
              <button
                onClick={logout}
                className="glass"
                style={{
                  cursor: 'pointer',
                  padding: '6px 10px',
                  borderRadius: 10,
                  background: 'rgba(255,255,255,0.03)',
                  border: '1px solid rgba(255,255,255,0.10)',
                  color: 'rgba(255,255,255,0.88)',
                  fontSize: 12,
                }}
              >
                Log out
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

