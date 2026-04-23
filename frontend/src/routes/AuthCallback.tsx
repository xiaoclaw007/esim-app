import { useEffect, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { setAccessToken } from '../api/client'
import { useAuth } from '../auth/AuthContext'

// Landing spot for the backend's post-Google-OAuth redirect:
//   /api/auth/google/callback → redirects here with ?access_token=...
//
// The refresh token is already a HttpOnly cookie by this point (set server-side
// in the redirect response), so we just need to pick up the short-lived
// access_token from the URL, feed it to the api client + AuthContext, then
// replace history so the token string doesn't linger in the back button.

export default function AuthCallback() {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const { refreshUser } = useAuth()
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const token = params.get('access_token')
    const oauthError = params.get('error')

    if (oauthError) {
      setError(`Google returned an error: ${oauthError}`)
      return
    }
    if (!token) {
      setError('No access token in callback URL — sign-in did not complete.')
      return
    }

    setAccessToken(token)
    refreshUser()
      .then(() => navigate('/account', { replace: true }))
      .catch((e: Error) => setError(e.message || 'Failed to load your profile'))
  }, [params, navigate, refreshUser])

  if (error) {
    return (
      <div className="page-stub" style={{ maxWidth: 480 }}>
        <h1 className="h1">Sign-in failed</h1>
        <p className="lede" style={{ marginTop: 12 }}>{error}</p>
        <p style={{ marginTop: 24 }}>
          <Link to="/login" className="btn primary reset" style={{ padding: '12px 20px' }}>
            Back to log in
          </Link>
        </p>
      </div>
    )
  }

  return (
    <div className="page-stub" style={{ maxWidth: 480 }}>
      <h1 className="h1">Signing you in…</h1>
      <p className="lede muted" style={{ marginTop: 12 }}>
        Hang tight, finishing up.
      </p>
    </div>
  )
}
