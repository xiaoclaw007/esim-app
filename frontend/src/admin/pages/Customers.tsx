import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { CrmIcon } from '../components/CrmIcon'
import { AuthPill } from '../components/Pill'
import { Avatar } from '../components/Avatar'
import { adminApi, type AdminCustomerRow, type AuthKind } from '../api/admin'

const dollars = (cents: number) => `$${(cents / 100).toFixed(2)}`

const FILTERS: { id: AuthKind | undefined; label: string }[] = [
  { id: undefined, label: 'All' },
  { id: 'google', label: 'Google' },
  { id: 'password', label: 'Password' },
  { id: 'guest', label: 'Guest' },
]

export default function CrmCustomers() {
  const [params, setParams] = useSearchParams()
  const initialQ = params.get('q') || ''
  const [q, setQ] = useState(initialQ)
  const [authFilter, setAuthFilter] = useState<AuthKind | undefined>(undefined)
  const [rows, setRows] = useState<AdminCustomerRow[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const t = setTimeout(() => {
      let cancelled = false
      setLoading(true)
      adminApi
        .listCustomers({ q: q || undefined, auth: authFilter, per_page: 100 })
        .then((r) => {
          if (!cancelled) {
            setRows(r.customers)
            setTotal(r.total)
            setError(null)
          }
        })
        .catch((e: Error) => !cancelled && setError(e.message))
        .finally(() => !cancelled && setLoading(false))
      return () => {
        cancelled = true
      }
    }, 250)
    return () => clearTimeout(t)
  }, [q, authFilter])

  // Keep URL in sync so command palette can navigate with ?q=
  useEffect(() => {
    if (q) setParams({ q }, { replace: true })
    else setParams({}, { replace: true })
  }, [q, setParams])

  return (
    <div className="crm-page">
      <div className="crm-page-head">
        <div>
          <div className="crm-eyebrow">{total.toLocaleString()} customer{total === 1 ? '' : 's'}</div>
          <h1>Customers</h1>
        </div>
      </div>

      <div className="crm-toolbar">
        <div className="crm-search">
          <CrmIcon name="search" size={14} />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name or email" />
          {q && (
            <button className="crm-btn icon" onClick={() => setQ('')} aria-label="Clear">
              <CrmIcon name="x" size={12} />
            </button>
          )}
        </div>
        <div className="crm-filter-row">
          {FILTERS.map((f) => (
            <button
              key={f.label}
              className={`crm-chip ${authFilter === f.id ? 'active' : ''}`}
              onClick={() => setAuthFilter(f.id)}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      <div className="crm-card no-pad">
        {error ? (
          <div className="crm-empty"><strong>Couldn't load customers</strong>{error}</div>
        ) : loading && rows.length === 0 ? (
          <div className="crm-empty">Loading…</div>
        ) : rows.length === 0 ? (
          <div className="crm-empty"><strong>No matches</strong>Try a different filter.</div>
        ) : (
          <table className="crm-table">
            <thead>
              <tr>
                <th>Customer</th>
                <th>Auth</th>
                <th>Signup</th>
                <th style={{ textAlign: 'right' }}>Orders</th>
                <th style={{ textAlign: 'right' }}>LTV</th>
                <th style={{ textAlign: 'right' }}>Credits</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((c) => (
                <tr key={c.id} style={{ cursor: 'default' }}>
                  <td>
                    <div className="crm-cust">
                      <Avatar name={c.name} email={c.email} size="sm" />
                      <div>
                        <div className="crm-cust-n">{c.name || <span className="dim">— guest</span>}</div>
                        <div className="dim sm">{c.email}</div>
                      </div>
                    </div>
                  </td>
                  <td><AuthPill auth={c.auth} /></td>
                  <td className="dim">{new Date(c.signup).toLocaleDateString()}</td>
                  <td className="num" style={{ textAlign: 'right' }}>{c.orders_count}</td>
                  <td className="num" style={{ textAlign: 'right' }}>{dollars(c.ltv_cents)}</td>
                  <td className="num dim" style={{ textAlign: 'right' }}>—</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
