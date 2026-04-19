export type AuthUser = {
  id: string
  name: string | null
  email: string | null
  avatarUrl: string | null
  githubId: string | null
}

export type AuthState =
  | { status: 'unknown'; token: string | null; user: null }
  | { status: 'authenticated'; token: string; user: AuthUser }
  | { status: 'unauthenticated'; token: null; user: null }

