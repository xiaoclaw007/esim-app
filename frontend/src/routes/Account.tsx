import { useAuth } from '../auth/AuthContext'

export default function Account() {
  const { user, loading } = useAuth()
  if (loading) return <div className="page-stub">Loading…</div>
  if (!user) {
    return (
      <div className="page-stub">
        <h1 className="h1">Sign in to see your eSIMs</h1>
        <p className="lede" style={{ marginTop: 16 }}>
          <a href="/login" className="btn primary sm">Log in</a>
        </p>
      </div>
    )
  }
  return (
    <div className="page-stub">
      <h1 className="h1">Hi {user.name || user.email.split('@')[0]}</h1>
      <p className="lede" style={{ marginTop: 16 }}>
        My eSIMs · Orders · Payment · Support tabs ship in M4.
      </p>
    </div>
  )
}
