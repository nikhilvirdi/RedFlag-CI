import { useCallback, useEffect, useMemo, useState } from 'react'
import { AuthContext } from './AuthContext'
import type { AuthState, AuthUser } from './auth.types'
import { apiFetch } from '../../lib/api'
import { clearToken, getToken, setToken } from '../../lib/storage'
import { env } from '../../lib/env'

type Props = { children: React.ReactNode }

function parseTokenFromHash(hash: string): string | null {
  // Expected: "#token=...."
  const raw = hash.startsWith('#') ? hash.slice(1) : hash
  const params = new URLSearchParams(raw)
  const token = params.get('token')
  return token && token.trim().length > 0 ? token : null
}

export function AuthProvider({ children }: Props) {
  const [state, setState] = useState<AuthState>(() => {
    const token = getToken()
    return { status: 'unknown', token, user: null }
  })

  const refreshMe = useCallback(async (): Promise<AuthUser | null> => {
    const token = getToken()
    if (!token) {
      setState({ status: 'unauthenticated', token: null, user: null })
      return null
    }

    try {
      const res = await apiFetch<{ user: AuthUser }>('/api/auth/me', { method: 'GET' })
      setState({ status: 'authenticated', token, user: res.user })
      return res.user
    } catch (e: any) {
      if (e?.status === 401) {
        clearToken()
        setState({ status: 'unauthenticated', token: null, user: null })
        return null
      }
      setState(() => ({ status: 'unknown', token: getToken(), user: null }))
      return null
    }
  }, [])

  useEffect(() => {
    void refreshMe()
  }, [refreshMe])

  const setTokenFromOAuthFragment = useCallback((fragment: string) => {
    const token = parseTokenFromHash(fragment)
    if (!token) return null
    setToken(token)
    void refreshMe()
    return token
  }, [refreshMe])

  const logout = useCallback(() => {
    clearToken()
    setState({ status: 'unauthenticated', token: null, user: null })
  }, [])

  const beginGitHubLogin = useCallback(() => {
    // Backend performs the redirect to GitHub.
    window.location.assign(`${env.apiBase}/api/auth/github/redirect`)
  }, [])

  const value = useMemo(
    () => ({ state, setTokenFromOAuthFragment, logout, beginGitHubLogin, refreshMe }),
    [state, setTokenFromOAuthFragment, logout, beginGitHubLogin, refreshMe]
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

