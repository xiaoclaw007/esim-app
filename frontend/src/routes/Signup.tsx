import { type FormEvent, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { Divider, GoogleButton } from '../components/GoogleButton'
import { detectWebView } from '../auth/detectWebView'

export default function Signup() {
  const { signup } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  // Same Google-OAuth-in-webview block as /login. We hide the button
  // and tell the customer how to escape into a real browser.
  const webview = useMemo(() => detectWebView(), [])

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      const result = await signup(email, password, name || undefined)
      // First-time signups get pushed to /destinations to keep
      // purchase momentum. Signups that claim a passwordless account
      // with existing orders go to /account so the customer sees
      // their stuff right away.
      const next = result.has_orders ? '/account' : '/destinations?welcome=1'
      navigate(next, { replace: true })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Signup failed')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="page-stub" style={{ maxWidth: 420 }}>
      <h1 className="h1" style={{ marginBottom: 24 }}>Create your account</h1>
      {webview ? (
        <div className="webview-warn">
          <div className="webview-warn__title">
            Google sign-up won't work in {webview.name}'s browser.
          </div>
          <p className="webview-warn__body">
            Google blocks sign-up from in-app browsers for security. You can still
            create an account with <strong>email + password</strong> below — and you
            don't need a password at all if you'd rather use a one-tap login link
            (<Link to="/login" style={{ color: 'var(--ink)' }}>log in instead</Link>).
          </p>
          <p className="webview-warn__hint">
            Want to use Google? {webview.escapeHint}
          </p>
        </div>
      ) : (
        <>
          <GoogleButton label="Sign up with Google" />
          <Divider />
        </>
      )}
      <form onSubmit={onSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div>
          <label className="label">Name (optional)</label>
          <input
            className="input"
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoComplete="name"
          />
        </div>
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
            autoComplete="new-password"
            minLength={8}
          />
        </div>
        {error && <div style={{ color: 'var(--pop)', fontSize: 14 }}>{error}</div>}
        <button type="submit" className="btn primary" disabled={submitting}>
          {submitting ? 'Creating…' : 'Create account'}
        </button>
      </form>
      <p className="muted" style={{ marginTop: 24, fontSize: 14 }}>
        Already have one? <Link to="/login" style={{ color: 'var(--ink)' }}>Log in</Link>
      </p>
    </div>
  )
}
