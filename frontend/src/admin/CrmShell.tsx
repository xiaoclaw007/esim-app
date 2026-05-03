import { useEffect, useState, type ReactNode } from 'react'
import { Link, NavLink, useLocation } from 'react-router-dom'
import { CrmIcon, type CrmIconName } from './components/CrmIcon'
import { Avatar } from './components/Avatar'
import { CommandPalette } from './CommandPalette'
import { adminApi, type AdminUser } from './api/admin'

interface NavSpec {
  to: string
  label: string
  icon: CrmIconName
  badgeKey?: 'failed' | null
}

const NAV: NavSpec[] = [
  { to: '/admin/dashboard', label: 'Dashboard', icon: 'grid' },
  { to: '/admin/orders', label: 'Orders', icon: 'receipt', badgeKey: 'failed' },
  { to: '/admin/customers', label: 'Customers', icon: 'users' },
  { to: '/admin/catalog', label: 'Catalog', icon: 'box' },
  { to: '/admin/analytics', label: 'Analytics', icon: 'bar-chart' },
]

export function CrmShell({ admin, children }: { admin: AdminUser; children: ReactNode }) {
  const location = useLocation()
  const [paletteOpen, setPaletteOpen] = useState(false)
  const [failedCount, setFailedCount] = useState<number>(0)

  // ⌘K toggle, Esc close
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setPaletteOpen((o) => !o)
      }
      if (e.key === 'Escape') setPaletteOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  // Failed-orders badge: refresh on route change.
  useEffect(() => {
    let cancelled = false
    adminApi
      .kpis()
      .then((k) => {
        if (!cancelled) setFailedCount(k.failed_orders ?? 0)
      })
      .catch(() => {
        /* ignore — sidebar badge is best-effort */
      })
    return () => {
      cancelled = true
    }
  }, [location.pathname])

  const currentLabel =
    NAV.find((n) => location.pathname.startsWith(n.to))?.label ??
    location.pathname.replace('/admin/', '').split('/')[0] ??
    ''

  return (
    <div className="crm-app">
      <aside className="crm-side">
        <Link to="/admin/dashboard" className="crm-brand" style={{ textDecoration: 'none', color: 'inherit' }}>
          <div className="crm-brand-mark">N</div>
          <div>
            <div className="crm-brand-name">Nimvoy</div>
            <div className="crm-brand-sub">Admin</div>
          </div>
        </Link>

        <nav className="crm-nav">
          {NAV.map((n) => {
            const badge = n.badgeKey === 'failed' && failedCount > 0 ? failedCount : null
            return (
              <NavLink key={n.to} to={n.to} className={({ isActive }) => `crm-nav-item ${isActive ? 'active' : ''}`}>
                <CrmIcon name={n.icon} size={15} />
                <span>{n.label}</span>
                {badge !== null && <span className="crm-nav-badge">{badge}</span>}
              </NavLink>
            )
          })}
        </nav>

        <div className="crm-side-foot">
          <div className="crm-side-user">
            <Avatar name={admin.name} email={admin.email} size="sm" />
            <div>
              <div className="crm-side-user-n">{admin.name || admin.email.split('@')[0]} · Founder</div>
              <div className="dim sm">{admin.email}</div>
            </div>
          </div>
        </div>
      </aside>

      <div className="crm-main">
        <header className="crm-top">
          <div className="crm-crumbs">
            <span className="dim">Nimvoy Admin</span>
            <span className="dim">/</span>
            <span style={{ textTransform: 'capitalize' }}>{currentLabel || 'Dashboard'}</span>
          </div>
          <button className="crm-cmdk-trigger" onClick={() => setPaletteOpen(true)}>
            <CrmIcon name="search" size={14} />
            <span>Search orders, customers…</span>
            <span className="crm-kbd">⌘K</span>
          </button>
          <div className="crm-top-right">
            <button className="crm-btn icon" aria-label="Notifications">
              <CrmIcon name="bell" size={15} />
            </button>
          </div>
        </header>

        <main className="crm-content">{children}</main>
      </div>

      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} />
    </div>
  )
}
