import { Link, NavLink, useNavigate } from 'react-router-dom'
import { Logo } from './Logo'
import { useAuth } from '../auth/AuthContext'

export function Nav() {
  const { user, loading, logout } = useAuth()
  const navigate = useNavigate()

  const items = [
    { to: '/', label: 'Home', end: true },
    { to: '/destinations', label: 'Destinations', end: false },
    { to: '/#how-it-works', label: 'How it works', end: false },
    { to: '/#support', label: 'Support', end: false },
    { to: '/faq', label: 'FAQ', end: false },
  ]

  return (
    <nav className="nav">
      <div className="nav-inner">
        <Logo />
        <div className="nav-links">
          {items.map((it) => (
            <NavLink
              key={it.to}
              to={it.to}
              end={it.end}
              className={({ isActive }) => (isActive ? 'active' : '')}
            >
              {it.label}
            </NavLink>
          ))}
        </div>
        <div className="nav-right">
          {loading ? null : user ? (
            <>
              <Link to="/account" className="btn ghost sm reset">
                My eSIMs
              </Link>
              <button
                className="btn subtle sm"
                onClick={async () => {
                  await logout()
                  navigate('/')
                }}
              >
                Sign out
              </button>
            </>
          ) : (
            <>
              <Link to="/login" className="btn ghost sm reset">
                Log in
              </Link>
              <Link to="/destinations" className="btn primary sm reset">
                Get eSIM
              </Link>
            </>
          )}
        </div>
      </div>
    </nav>
  )
}
