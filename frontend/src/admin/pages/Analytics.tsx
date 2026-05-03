import { useEffect, useState } from 'react'
import { CrmIcon } from '../components/CrmIcon'
import { Sparkline } from '../components/Sparkline'
import { adminApi, type AdminKpiResponse, type AdminRevenuePoint } from '../api/admin'

const dollars = (c: number) => `$${(c / 100).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

function deltaPill(now: number, prev: number) {
  if (prev === 0) {
    return <span className="crm-kpi-delta">{now > 0 ? 'new' : '—'}</span>
  }
  const pct = ((now - prev) / prev) * 100
  const cls = pct > 0 ? 'pos' : pct < 0 ? 'neg' : ''
  return (
    <span className={`crm-kpi-delta ${cls}`}>
      <CrmIcon name={pct >= 0 ? 'arrow-up' : 'arrow-down'} size={11} />
      {Math.abs(pct).toFixed(1)}%
    </span>
  )
}

const RANGES = [
  { value: 7, label: 'Last 7 days' },
  { value: 30, label: 'Last 30 days' },
  { value: 90, label: 'Last 90 days' },
]

export default function CrmAnalytics() {
  const [days, setDays] = useState(30)
  const [series, setSeries] = useState<AdminRevenuePoint[]>([])
  const [kpis, setKpis] = useState<AdminKpiResponse | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    Promise.all([adminApi.kpis(), adminApi.revenueSeries(days)])
      .then(([k, s]) => {
        if (cancelled) return
        setKpis(k)
        setSeries(s)
      })
      .catch((e: Error) => !cancelled && setError(e.message))
    return () => {
      cancelled = true
    }
  }, [days])

  if (error) return <div className="crm-empty"><strong>Couldn't load analytics</strong>{error}</div>
  if (!kpis) return <div className="crm-empty">Loading…</div>

  const totalRevenue = series.reduce((s, p) => s + p.revenue_cents, 0)
  const totalOrders = series.reduce((s, p) => s + p.orders, 0)
  const aov = totalOrders > 0 ? Math.round(totalRevenue / totalOrders) : 0

  return (
    <div className="crm-page">
      <div className="crm-page-head">
        <div>
          <div className="crm-eyebrow">Analytics</div>
          <h1>Performance</h1>
        </div>
        <div className="crm-page-actions">
          <select className="crm-select" value={days} onChange={(e) => setDays(Number(e.target.value))}>
            {RANGES.map((r) => (
              <option key={r.value} value={r.value}>{r.label}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="crm-kpi-row">
        <div className="crm-kpi">
          <div className="crm-kpi-label">Revenue ({days}d)</div>
          <div className="crm-kpi-line">
            <div className="crm-kpi-value">{dollars(totalRevenue)}</div>
            {deltaPill(kpis.revenue_cents_30d, kpis.revenue_cents_prev)}
          </div>
        </div>
        <div className="crm-kpi">
          <div className="crm-kpi-label">Orders</div>
          <div className="crm-kpi-line">
            <div className="crm-kpi-value">{totalOrders}</div>
            {deltaPill(kpis.orders_30d, kpis.orders_prev)}
          </div>
        </div>
        <div className="crm-kpi">
          <div className="crm-kpi-label">AOV</div>
          <div className="crm-kpi-line">
            <div className="crm-kpi-value">{dollars(aov)}</div>
          </div>
          <div className="crm-kpi-hint">Average order value</div>
        </div>
        <div className="crm-kpi">
          <div className="crm-kpi-label">Active eSIMs</div>
          <div className="crm-kpi-line">
            <div className="crm-kpi-value">{kpis.completed_esims}</div>
          </div>
          <div className="crm-kpi-hint">Completed orders, all-time</div>
        </div>
      </div>

      <div className="crm-grid-2">
        <div className="crm-card">
          <div className="crm-card-h">
            <h3>Revenue trend</h3>
            <span className="dim sm">{days} days</span>
          </div>
          <div style={{ color: 'var(--crm-accent)', marginTop: 8 }}>
            <Sparkline values={series.map((p) => p.revenue_cents)} width={520} height={160} />
          </div>
        </div>

        <div className="crm-card">
          <div className="crm-card-h">
            <h3>Conversion funnel</h3>
            <span className="dim sm">stub</span>
          </div>
          <div className="crm-funnel-empty">
            <strong>No conversion tracking wired yet.</strong>
            We need to log site visits, destination views, and checkout starts before this funnel becomes meaningful. Today we only know about completed payments.
          </div>
        </div>
      </div>

      <div className="crm-card">
        <div className="crm-card-h">
          <h3>Top destinations</h3>
          <span className="dim sm">last 30 days</span>
        </div>
        {kpis.top_destinations.length === 0 ? (
          <div className="crm-empty">No orders in this window.</div>
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
  )
}
