import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { CrmIcon } from '../components/CrmIcon'
import { Sparkline } from '../components/Sparkline'
import { StatusPill } from '../components/Pill'
import { adminApi, type AdminKpiResponse, type AdminOrderRow, type AdminRevenuePoint } from '../api/admin'

const dollars = (cents: number) => `$${(cents / 100).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

function deltaPct(now: number, prev: number): { pct: number; cls: 'pos' | 'neg' | 'flat' } {
  if (prev === 0) return { pct: now > 0 ? 100 : 0, cls: now > 0 ? 'pos' : 'flat' }
  const pct = ((now - prev) / prev) * 100
  return { pct, cls: pct > 0 ? 'pos' : pct < 0 ? 'neg' : 'flat' }
}

function deltaPill(now: number, prev: number) {
  const { pct, cls } = deltaPct(now, prev)
  if (cls === 'flat') return <span className="crm-kpi-delta">±0%</span>
  return (
    <span className={`crm-kpi-delta ${cls}`}>
      <CrmIcon name={cls === 'pos' ? 'arrow-up' : 'arrow-down'} size={11} />
      {Math.abs(pct).toFixed(1)}%
    </span>
  )
}

export default function CrmDashboard() {
  const [kpis, setKpis] = useState<AdminKpiResponse | null>(null)
  const [series, setSeries] = useState<AdminRevenuePoint[]>([])
  const [recent, setRecent] = useState<AdminOrderRow[]>([])
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    Promise.all([adminApi.kpis(), adminApi.revenueSeries(30), adminApi.listOrders({ per_page: 6 })])
      .then(([k, s, o]) => {
        if (cancelled) return
        setKpis(k)
        setSeries(s)
        setRecent(o.orders)
      })
      .catch((e: Error) => !cancelled && setError(e.message))
    return () => {
      cancelled = true
    }
  }, [])

  if (error) return <div className="crm-empty"><strong>Couldn't load dashboard</strong>{error}</div>
  if (!kpis) return <div className="crm-empty">Loading…</div>

  const sparkValues = series.map((p) => p.revenue_cents)

  return (
    <div className="crm-page">
      <div className="crm-page-head">
        <div>
          <div className="crm-eyebrow">Last 30 days</div>
          <h1>Dashboard</h1>
        </div>
      </div>

      <div className="crm-kpi-row">
        <KpiCard label="Revenue" value={dollars(kpis.revenue_cents_30d)} delta={deltaPill(kpis.revenue_cents_30d, kpis.revenue_cents_prev)} spark={sparkValues} />
        <KpiCard label="Orders" value={String(kpis.orders_30d)} delta={deltaPill(kpis.orders_30d, kpis.orders_prev)} hint={`${kpis.completed_esims} eSIMs delivered`} />
        <KpiCard label="Failed (30d)" value={String(kpis.failed_orders)} hint={kpis.failed_orders > 0 ? 'See queue below' : 'No failures'} />
        <KpiCard label="Refunded (30d)" value={String(kpis.refunded_orders)} hint="Auto-refund on JoyTel failure" />
      </div>

      <div className="crm-grid-2">
        <div className="crm-card">
          <div className="crm-card-h">
            <h3>Today's queue</h3>
            <span className="dim sm">{kpis.queue.length} item{kpis.queue.length === 1 ? '' : 's'}</span>
          </div>
          {kpis.queue.length === 0 ? (
            <div className="crm-queue-empty">All clear ✓</div>
          ) : (
            <div className="crm-queue">
              {kpis.queue.map((q) => (
                <div key={`${q.type}-${q.reference || q.title}`} className="crm-queue-row">
                  <span className={`crm-queue-dot ${q.type}`} />
                  <div className="crm-queue-body">
                    <div className="crm-queue-title">{q.title}</div>
                    <div className="crm-queue-sub">{q.sub}</div>
                  </div>
                  {q.reference && (
                    <Link to={`/admin/orders/${encodeURIComponent(q.reference)}`} className="crm-btn ghost sm">
                      Open
                    </Link>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="crm-card">
          <div className="crm-card-h">
            <h3>Top destinations</h3>
            <span className="dim sm">by orders</span>
          </div>
          {kpis.top_destinations.length === 0 ? (
            <div className="crm-queue-empty">No orders yet.</div>
          ) : (
            <div className="crm-topdest">
              {kpis.top_destinations.map((d) => {
                const max = kpis.top_destinations[0]?.orders ?? 1
                return (
                  <div key={d.code} className="crm-topdest-row">
                    <span className="flag">{d.flag}</span>
                    <span className="name">{d.name}</span>
                    <div className="crm-bar">
                      <div className="crm-bar-fill" style={{ width: `${(d.orders / max) * 100}%` }} />
                    </div>
                    <span className="cnt">{d.orders}</span>
                    <span className="amt">{dollars(d.revenue_cents)}</span>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      <div className="crm-card no-pad">
        <div className="crm-card-h" style={{ padding: '14px 18px 10px' }}>
          <h3>Recent orders</h3>
          <Link to="/admin/orders">View all →</Link>
        </div>
        <RecentOrdersTable rows={recent} />
      </div>
    </div>
  )
}

function KpiCard({
  label,
  value,
  delta,
  hint,
  spark,
}: {
  label: string
  value: string
  delta?: React.ReactNode
  hint?: string
  spark?: number[]
}) {
  return (
    <div className="crm-kpi">
      <div className="crm-kpi-label">{label}</div>
      <div className="crm-kpi-line">
        <div className="crm-kpi-value">{value}</div>
        {delta}
      </div>
      {spark && spark.length > 0 && (
        <div className="crm-kpi-spark">
          <Sparkline values={spark} width={220} height={36} />
        </div>
      )}
      {hint && <div className="crm-kpi-hint">{hint}</div>}
    </div>
  )
}

function RecentOrdersTable({ rows }: { rows: AdminOrderRow[] }) {
  if (rows.length === 0) {
    return <div className="crm-empty"><strong>No orders yet</strong>Once customers buy an eSIM, they'll show up here.</div>
  }
  return (
    <table className="crm-table">
      <thead>
        <tr>
          <th>Order</th>
          <th>Date</th>
          <th>Customer</th>
          <th>Plan</th>
          <th>Status</th>
          <th style={{ textAlign: 'right' }}>Amount</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((o) => (
          <tr
            key={o.reference}
            onClick={() => {
              window.location.href = `/admin/orders/${encodeURIComponent(o.reference)}`
            }}
          >
            <td className="mono">{o.reference}</td>
            <td className="dim">{new Date(o.created_at).toLocaleDateString()}</td>
            <td>{o.user_name || o.email}</td>
            <td>{o.plan_name || o.plan_id}</td>
            <td><StatusPill status={o.status} /></td>
            <td className="num" style={{ textAlign: 'right' }}>{dollars(o.amount_cents)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}
