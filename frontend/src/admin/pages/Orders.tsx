import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { CrmIcon } from '../components/CrmIcon'
import { AuthPill, StatusPill } from '../components/Pill'
import { Avatar } from '../components/Avatar'
import { OrderDrawer } from './OrderDrawer'
import { adminApi, type AdminOrderRow } from '../api/admin'

const dollars = (cents: number) => `$${(cents / 100).toFixed(2)}`

const FILTERS: { id: string | undefined; label: string }[] = [
  { id: undefined, label: 'All' },
  { id: 'completed', label: 'Delivered' },
  { id: 'paid', label: 'Pending' },
  { id: 'failed', label: 'Failed' },
  { id: 'refunded', label: 'Refunded' },
]

export default function CrmOrders() {
  const { reference } = useParams<{ reference?: string }>()
  const navigate = useNavigate()
  const [rows, setRows] = useState<AdminOrderRow[]>([])
  const [total, setTotal] = useState(0)
  const [q, setQ] = useState('')
  const [statusFilter, setStatusFilter] = useState<string | undefined>(undefined)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Load list with debounce on q.
  useEffect(() => {
    const t = setTimeout(() => {
      let cancelled = false
      setLoading(true)
      adminApi
        .listOrders({ q: q || undefined, status: statusFilter, per_page: 100 })
        .then((r) => {
          if (!cancelled) {
            setRows(r.orders)
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
  }, [q, statusFilter])

  return (
    <div className="crm-page">
      <div className="crm-page-head">
        <div>
          <div className="crm-eyebrow">{total.toLocaleString()} order{total === 1 ? '' : 's'}</div>
          <h1>Orders</h1>
        </div>
      </div>

      <div className="crm-toolbar">
        <div className="crm-search">
          <CrmIcon name="search" size={14} />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by reference, email, plan…" />
          {q && (
            <button className="crm-btn icon" onClick={() => setQ('')} aria-label="Clear search">
              <CrmIcon name="x" size={12} />
            </button>
          )}
        </div>
        <div className="crm-filter-row">
          {FILTERS.map((f) => (
            <button
              key={f.label}
              className={`crm-chip ${statusFilter === f.id ? 'active' : ''}`}
              onClick={() => setStatusFilter(f.id)}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      <div className="crm-card no-pad">
        {error ? (
          <div className="crm-empty"><strong>Couldn't load orders</strong>{error}</div>
        ) : loading && rows.length === 0 ? (
          <div className="crm-empty">Loading…</div>
        ) : rows.length === 0 ? (
          <div className="crm-empty"><strong>No matches</strong>Try a different search term or clear filters.</div>
        ) : (
          <table className="crm-table">
            <thead>
              <tr>
                <th>Order #</th>
                <th>Date · Time</th>
                <th>Customer</th>
                <th>Destination</th>
                <th>Plan</th>
                <th>Status</th>
                <th style={{ textAlign: 'right' }}>Amount</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((o) => {
                const dt = new Date(o.created_at)
                return (
                  <tr key={o.reference} onClick={() => navigate(`/admin/orders/${encodeURIComponent(o.reference)}`)}>
                    <td className="mono">{o.reference}</td>
                    <td>
                      <div>{dt.toLocaleDateString()}</div>
                      <div className="dim sm">{dt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                    </td>
                    <td>
                      <div className="crm-cust">
                        <Avatar name={o.user_name} email={o.email} size="sm" />
                        <div>
                          <div className="crm-cust-n">{o.user_name || <span className="dim">— guest</span>}</div>
                          <div className="dim sm">{o.email}</div>
                        </div>
                      </div>
                    </td>
                    <td>
                      <span className="flag">{flagFor(o.plan_country)}</span>{' '}
                      <span style={{ marginLeft: 4 }}>{o.plan_country || '—'}</span>
                    </td>
                    <td>
                      <div>{o.plan_name || o.plan_id}</div>
                      <div className="dim sm mono">{o.plan_id}</div>
                    </td>
                    <td>
                      <StatusPill status={o.status} />
                      <div className="dim sm" style={{ marginTop: 2 }}>
                        <AuthPill auth={o.user_auth} />
                      </div>
                    </td>
                    <td className="num" style={{ textAlign: 'right' }}>{dollars(o.amount_cents)}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      {reference && (
        <OrderDrawer
          reference={reference}
          onClose={() => navigate('/admin/orders')}
        />
      )}
    </div>
  )
}

const FLAG_MAP: Record<string, string> = {
  US: '🇺🇸',
  JP: '🇯🇵',
  KR: '🇰🇷',
  CN: '🇨🇳',
  EU: '🇪🇺',
  AP: '🌏',
  CHM: '🇨🇳',
}
function flagFor(code: string | null): string {
  if (!code) return '🌐'
  return FLAG_MAP[code] || '🌐'
}
