import { type FormEvent, useEffect, useState } from 'react'
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { apiFetch } from '../api/client'
import { Divider, GoogleButton } from '../components/GoogleButton'

type Mode = 'password' | 'magic'

// One-line banners triggered by the magic-link consume endpoint when
// the customer clicks an expired / used / malformed link.
const MAGIC_BANNERS: Record<string, string> = {
  expired: 'That login link has expired. Enter your email below to get a fresh one.',
  used: 'That login link was already used. Enter your email below for a new one.',
  invalid: "That link doesn't look right. Enter your email below for a new one.",
  sent: 'Check your email — we just sent you a fresh login link.',
}

export default function Login() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [params, setParams] = useSearchParams()
  const [mode, setMode] = useState<Mode>('password')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [banner, setBanner] = useState<string | null>(null)

  const from = (location.state as { from?: string } | null)?.from || '/account'

  // Pick up ?magic=expired|used|invalid from the consume endpoint's
  // redirect-on-error path. After reading once, drop the param so a
  // browser back-button doesn't re-show the banner.
  useEffect(() => {
    const magic = params.get('magic')
    if (magic && MAGIC_BANNERS[magic]) {
      setBanner(MAGIC_BANNERS[magic])
      if (magic === 'expired' || magic === 'used' || magic === 'invalid') {
        setMode('magic')
      }
      params.delete('magic')
      setParams(params, { replace: true })
    }
  }, [])

  async function onSubmitPassword(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      await login(email, password)
      navigate(from, { replace: true })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed')
    } finally {
      setSubmitting(false)
    }
  }

  async function onSubmitMagic(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      await apiFetch<void>('/api/auth/magic/request', {
        method: 'POST',
        body: JSON.stringify({ email }),
      })
      setBanner(MAGIC_BANNERS.sent)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not send link')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="page-stub" style={{ maxWidth: 420 }}>
      <h1 className="h1" style={{ marginBottom: 24 }}>Log in</h1>

      {banner && (
        <div
          style={{
            padding: '10px 14px',
            background: 'var(--accent-soft)',
            color: 'var(--accent)',
            borderRadius: 10,
            fontSize: 14,
            marginBottom: 16,
            lineHeight: 1.5,
          }}
        >
          {banner}
        </div>
      )}

      <GoogleButton label="Continue with Google" />
      <Divider />

      {/* Password / magic-link toggle. Magic link is the recommended path for
          customers who paid as guests (their account is passwordless). */}
      <div className="login-mode-tabs" style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        <button
          type="button"
          onClick={() => { setMode('password'); setError(null) }}
          className={mode === 'password' ? 'active' : ''}
          style={tabStyle(mode === 'password')}
        >
          Password
        </button>
        <button
          type="button"
          onClick={() => { setMode('magic'); setError(null) }}
          className={mode === 'magic' ? 'active' : ''}
          style={tabStyle(mode === 'magic')}
        >
          Email me a link
        </button>
      </div>

      {mode === 'password' ? (
        <form onSubmit={onSubmitPassword} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <label className="label">Email</label>
            <input
              className="input"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
            />
          </div>
          <div>
            <label className="label">Password</label>
            <input
              className="input"
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
            />
          </div>
          {error && <div style={{ color: 'var(--pop)', fontSize: 14 }}>{error}</div>}
          <button type="submit" className="btn primary" disabled={submitting}>
            {submitting ? 'Signing in…' : 'Log in'}
          </button>
        </form>
      ) : (
        <form onSubmit={onSubmitMagic} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <label className="label">Email</label>
            <input
              className="input"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              placeholder="you@example.com"
            />
          </div>
          <p className="muted" style={{ fontSize: 13, lineHeight: 1.5, margin: 0 }}>
            We'll send you a one-tap login link. Works whether you have a password or not — handy
            if you bought as a guest and didn't set a password yet.
          </p>
          {error && <div style={{ color: 'var(--pop)', fontSize: 14 }}>{error}</div>}
          <button type="submit" className="btn primary" disabled={submitting}>
            {submitting ? 'Sending link…' : 'Send login link'}
          </button>
        </form>
      )}

      <p className="muted" style={{ marginTop: 24, fontSize: 14 }}>
        New here? <Link to="/signup" style={{ color: 'var(--ink)' }}>Create an account</Link>
      </p>
    </div>
  )
}

function tabStyle(active: boolean): React.CSSProperties {
  return {
    flex: 1,
    padding: '10px 12px',
    borderRadius: 8,
    background: active ? 'var(--bg-elev)' : 'var(--bg-sunk)',
    border: active ? '1px solid var(--ink)' : '1px solid var(--line)',
    color: active ? 'var(--ink)' : 'var(--ink-3)',
    fontSize: 13,
    fontWeight: active ? 500 : 400,
    cursor: 'pointer',
  }
}
