import { useEffect, useState, type ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { adminApi, type AdminUser } from './api/admin'

interface AdminGateProps {
  children: (admin: AdminUser) => ReactNode
}

// Two layers of protection:
//   1. Redirect to /login if no session at all
//   2. Once we have a session, hit /api/admin/me to verify is_admin server-side.
//      The endpoint returns 404 for non-admins (intentional — see backend
//      get_admin_user). On 404 we render a generic Not Found rather than
//      revealing that an admin area exists.
export function AdminGate({ children }: AdminGateProps) {
  const { user, loading } = useAuth()
  const location = useLocation()
  const [admin, setAdmin] = useState<AdminUser | null>(null)
  const [verifying, setVerifying] = useState(true)
  const [denied, setDenied] = useState(false)

  useEffect(() => {
    if (loading || !user) return
    let cancelled = false
    setVerifying(true)
    setDenied(false)
    adminApi
      .me()
      .then((u) => {
        if (!cancelled) setAdmin(u)
      })
      .catch(() => {
        if (!cancelled) setDenied(true)
      })
      .finally(() => {
        if (!cancelled) setVerifying(false)
      })
    return () => {
      cancelled = true
    }
  }, [user, loading])

  if (loading || (user && verifying)) {
    return <div style={{ padding: 64, color: '#6B7A8E', fontFamily: 'system-ui' }}>Loading…</div>
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location.pathname }} replace />
  }

  if (denied || !admin) {
    // Mimic a real 404 — don't disclose that /admin exists for non-admins.
    return (
      <div style={{ padding: 64, fontFamily: 'system-ui', color: '#324961' }}>
        <h1 style={{ fontSize: 22, fontWeight: 600 }}>Page not found</h1>
        <p>The page you’re looking for doesn’t exist.</p>
      </div>
    )
  }

  return <>{children(admin)}</>
}
