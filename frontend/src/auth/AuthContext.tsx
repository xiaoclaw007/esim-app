import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { apiFetch, setAccessToken } from '../api/client'

export interface User {
  id: string
  email: string
  name?: string | null
  avatar_url?: string | null
  referral_code?: string
}

interface AuthState {
  user: User | null
  loading: boolean
  login: (email: string, password: string) => Promise<void>
  signup: (email: string, password: string, name?: string) => Promise<void>
  logout: () => Promise<void>
  refreshUser: () => Promise<void>
}

const AuthContext = createContext<AuthState | null>(null)

interface TokenResponse {
  access_token: string
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  const refreshUser = useCallback(async () => {
    try {
      const me = await apiFetch<User>('/api/users/me')
      setUser(me)
    } catch {
      setUser(null)
    }
  }, [])

  // On mount, try silent refresh (HttpOnly cookie) → fetch user.
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const res = await fetch('/api/auth/refresh', {
          method: 'POST',
          credentials: 'include',
        })
        if (res.ok) {
          const data = (await res.json()) as TokenResponse
          setAccessToken(data.access_token)
          await refreshUser()
        }
      } catch {
        // Not logged in; that's fine.
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [refreshUser])

  const login = useCallback(async (email: string, password: string) => {
    const data = await apiFetch<TokenResponse>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    })
    setAccessToken(data.access_token)
    await refreshUser()
  }, [refreshUser])

  const signup = useCallback(async (email: string, password: string, name?: string) => {
    const data = await apiFetch<TokenResponse>('/api/auth/signup', {
      method: 'POST',
      body: JSON.stringify({ email, password, name }),
    })
    setAccessToken(data.access_token)
    await refreshUser()
  }, [refreshUser])

  const logout = useCallback(async () => {
    try {
      await apiFetch('/api/auth/logout', { method: 'POST' })
    } finally {
      setAccessToken(null)
      setUser(null)
    }
  }, [])

  const value = useMemo<AuthState>(
    () => ({ user, loading, login, signup, logout, refreshUser }),
    [user, loading, login, signup, logout, refreshUser],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>')
  return ctx
}
