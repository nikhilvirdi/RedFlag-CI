import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from './AuthContext'

export function RequireAuth({ children }: { children: React.ReactNode }) {
  const { state } = useAuth()
  const location = useLocation()

  if (state.status === 'unknown') {
    return (
      <div className="container" style={{ padding: '72px 0' }}>
        <div className="glass glass--panel" style={{ padding: 18 }}>
          <div style={{ color: 'rgba(255,255,255,0.72)', fontSize: 14 }}>
            Establishing secure session…
          </div>
        </div>
      </div>
    )
  }

  if (state.status !== 'authenticated') {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />
  }

  return <>{children}</>
}

