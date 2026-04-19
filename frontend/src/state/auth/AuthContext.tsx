import { createContext, useContext } from 'react'
import type { AuthState, AuthUser } from './auth.types'

export type AuthContextValue = {
  state: AuthState
  setTokenFromOAuthFragment: (fragment: string) => string | null
  logout: () => void
  beginGitHubLogin: () => void
  refreshMe: () => Promise<AuthUser | null>
}

export const AuthContext = createContext<AuthContextValue | null>(null)

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}

