import { useEffect, useMemo, useState } from 'react'
import { CrmIcon } from '../components/CrmIcon'
import { Sparkline } from '../components/Sparkline'
import {
  adminApi,
  type AdminKpiResponse,
  type AdminRevenuePoint,
  type AnalyticsCountryRow,
  type AnalyticsCouponImpactRow,
  type AnalyticsDeviceRow,
  type AnalyticsFunnelStep,
  type AnalyticsSummary,
  type InstallFunnelResponse,
  type AnalyticsTimeseriesPoint,
  type AnalyticsTopDestination,
  type AnalyticsTrafficSource,
} from '../api/admin'

const dollars = (c: number) =>
  `$${(c / 100).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
const pct = (n: number) => `${(n * 100).toFixed(1)}%`

const RANGES = [
  { value: 7, label: 'Last 7 days' },
  { value: 30, label: 'Last 30 days' },
  { value: 90, label: 'Last 90 days' },
]

function deltaPill(now: number, prev: number) {
  if (prev === 0) {
    return <span className="crm-kpi-delta">{now > 0 ? 'new' : '—'}</span>
  }
  const p = ((now - prev) / prev) * 100
  const cls = p > 0 ? 'pos' : p < 0 ? 'neg' : ''
  return (
    <span className={`crm-kpi-delta ${cls}`}>
      <CrmIcon name={p >= 0 ? 'arrow-up' : 'arrow-down'} size={11} />
      {Math.abs(p).toFixed(1)}%
    </span>
  )
}

// Inverse delta: lower-is-better. Decline rate goes here.
function deltaPillInverse(now: number, prev: number) {
  if (prev === 0) {
    return <span className="crm-kpi-delta">{now > 0 ? 'new' : '—'}</span>
  }
  const p = ((now - prev) / prev) * 100
  const cls = p > 0 ? 'neg' : p < 0 ? 'pos' : ''
  return (
    <span className={`crm-kpi-delta ${cls}`}>
      <CrmIcon name={p >= 0 ? 'arrow-up' : 'arrow-down'} size={11} />
      {Math.abs(p).toFixed(1)}%
    </span>
  )
}

export default function CrmAnalytics() {
  const [days, setDays] = useState(30)

  // Section A — revenue (existing endpoints, kept for the topline KPIs)
  const [revSeries, setRevSeries] = useState<AdminRevenuePoint[]>([])
  const [kpis, setKpis] = useState<AdminKpiResponse | null>(null)

  // Section B — website analytics (new)
  const [summary, setSummary] = useState<AnalyticsSummary | null>(null)
  const [timeseries, setTimeseries] = useState<AnalyticsTimeseriesPoint[]>([])
  const [funnel, setFunnel] = useState<AnalyticsFunnelStep[]>([])
  const [installFunnel, setInstallFunnel] = useState<InstallFunnelResponse | null>(null)
  const [topDest, setTopDest] = useState<AnalyticsTopDestination[]>([])
  const [sources, setSources] = useState<AnalyticsTrafficSource[]>([])
  const [devices, setDevices] = useState<AnalyticsDeviceRow[]>([])
  const [countries, setCountries] = useState<AnalyticsCountryRow[]>([])
  const [coupons, setCoupons] = useState<AnalyticsCouponImpactRow[]>([])

  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    Promise.all([
      adminApi.kpis(),
      adminApi.revenueSeries(days),
      adminApi.analyticsSummary(days),
      adminApi.analyticsTimeseries(days),
      adminApi.analyticsFunnel(days),
      adminApi.analyticsInstallFunnel(days),
      adminApi.analyticsTopDestinations(days, 8),
      adminApi.analyticsSources(days),
      adminApi.analyticsDevices(days),
      adminApi.analyticsCountries(days, 12),
      adminApi.analyticsCoupons(days),
    ])
      .then(([k, r, s, ts, fn, ifn, td, src, dv, ct, cp]) => {
        if (cancelled) return
        setKpis(k)
        setRevSeries(r)
        setSummary(s)
        setTimeseries(ts)
        setFunnel(fn)
        setInstallFunnel(ifn)
        setTopDest(td)
        setSources(src)
        setDevices(dv)
        setCountries(ct)
        setCoupons(cp)
        setError(null)
      })
      .catch((e: Error) => !cancelled && setError(e.message))
      .finally(() => !cancelled && setLoading(false))
    return () => {
      cancelled = true
    }
  }, [days])

  if (error) return <div className="crm-empty"><strong>Couldn't load analytics</strong>{error}</div>
  if (loading && !summary) return <div className="crm-empty">Loading…</div>

  const totalRevenue = revSeries.reduce((s, p) => s + p.revenue_cents, 0)
  const totalOrders = revSeries.reduce((s, p) => s + p.orders, 0)
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

      {/* ===== Topline KPIs — split into Traffic + Revenue rows ===== */}

      <section>
        <h2 className="crm-section-h">Traffic</h2>
        <div className="crm-kpi-row">
          <div className="crm-kpi">
            <div className="crm-kpi-label">Visitors</div>
            <div className="crm-kpi-line">
              <div className="crm-kpi-value">{summary?.visitors.toLocaleString() ?? '—'}</div>
              {summary && deltaPill(summary.visitors, summary.visitors_prev)}
            </div>
            <div className="crm-kpi-hint">Distinct sessions</div>
          </div>
          <div className="crm-kpi">
            <div className="crm-kpi-label">Page views</div>
            <div className="crm-kpi-line">
              <div className="crm-kpi-value">{summary?.page_views.toLocaleString() ?? '—'}</div>
              {summary && deltaPill(summary.page_views, summary.page_views_prev)}
            </div>
            <div className="crm-kpi-hint">Across the customer site</div>
          </div>
          <div className="crm-kpi">
            <div className="crm-kpi-label">Conversion rate</div>
            <div className="crm-kpi-line">
              <div className="crm-kpi-value">{summary ? pct(summary.conversion_rate) : '—'}</div>
              {summary && deltaPill(summary.conversion_rate * 1e6, summary.conversion_rate_prev * 1e6)}
            </div>
            <div className="crm-kpi-hint">Sessions → paid order</div>
          </div>
          <div className="crm-kpi">
            <div className="crm-kpi-label">Decline rate</div>
            <div className="crm-kpi-line">
              <div className="crm-kpi-value">{summary ? pct(summary.decline_rate) : '—'}</div>
              {summary && deltaPillInverse(summary.decline_rate * 1e6, summary.decline_rate_prev * 1e6)}
            </div>
            <div className="crm-kpi-hint">Stripe declines / attempts</div>
          </div>
        </div>
      </section>

      <section>
        <h2 className="crm-section-h">Revenue</h2>
        <div className="crm-kpi-row">
          <div className="crm-kpi">
            <div className="crm-kpi-label">Revenue ({days}d)</div>
            <div className="crm-kpi-line">
              <div className="crm-kpi-value">{dollars(totalRevenue)}</div>
              {kpis && deltaPill(kpis.revenue_cents_30d, kpis.revenue_cents_prev)}
            </div>
          </div>
          <div className="crm-kpi">
            <div className="crm-kpi-label">Orders</div>
            <div className="crm-kpi-line">
              <div className="crm-kpi-value">{totalOrders}</div>
              {kpis && deltaPill(kpis.orders_30d, kpis.orders_prev)}
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
              <div className="crm-kpi-value">{kpis?.completed_esims ?? '—'}</div>
            </div>
            <div className="crm-kpi-hint">Completed orders, all-time</div>
          </div>
        </div>
      </section>

      {/* ===== Trends + Funnel ===== */}

      <div className="crm-grid-2">
        <div className="crm-card">
          <div className="crm-card-h">
            <h3>Traffic over time</h3>
            <span className="dim sm">{days} days · visitors vs page views</span>
          </div>
          <TrafficChart series={timeseries} />
          <TrafficLegend />
        </div>

        <div className="crm-card">
          <div className="crm-card-h">
            <h3>Conversion funnel</h3>
            <span className="dim sm">{days} days</span>
          </div>
          <FunnelChart steps={funnel} />
        </div>
      </div>

      {/* Post-purchase install funnel — separate row because it tells a
          different story (orders, not sessions) and the empty-state copy
          is specific to JoyTel callback enablement. */}
      <div className="crm-card">
        <div className="crm-card-h">
          <h3>Install funnel</h3>
          <span className="dim sm">{days} days · paid → enabled on phone</span>
        </div>
        <InstallFunnelChart data={installFunnel} />
      </div>

      {/* ===== Revenue trend (existing) ===== */}

      <div className="crm-card">
        <div className="crm-card-h">
          <h3>Revenue trend</h3>
          <span className="dim sm">{days} days</span>
        </div>
        <div style={{ color: 'var(--crm-accent)', marginTop: 8 }}>
          <Sparkline values={revSeries.map((p) => p.revenue_cents)} width={1100} height={140} />
        </div>
      </div>

      {/* ===== Audience: traffic sources / devices / countries ===== */}

      <div className="crm-grid-3">
        <div className="crm-card">
          <div className="crm-card-h">
            <h3>Traffic sources</h3>
            <span className="dim sm">first-touch referrer</span>
          </div>
          <BarList rows={sources.map((s) => ({ key: s.source, label: s.source, value: s.sessions }))} />
        </div>

        <div className="crm-card">
          <div className="crm-card-h">
            <h3>Devices</h3>
            <span className="dim sm">sessions</span>
          </div>
          <BarList
            rows={devices.map((d) => ({
              key: d.device,
              label: d.device.charAt(0).toUpperCase() + d.device.slice(1),
              value: d.sessions,
            }))}
          />
        </div>

        <div className="crm-card">
          <div className="crm-card-h">
            <h3>Countries</h3>
            <span className="dim sm">via GeoIP</span>
          </div>
          <BarList
            rows={countries.map((c) => ({
              key: c.code,
              label: `${c.flag} ${c.name}`,
              value: c.sessions,
            }))}
          />
        </div>
      </div>

      {/* ===== Top destinations + coupon impact ===== */}

      <div className="crm-grid-2">
        <div className="crm-card">
          <div className="crm-card-h">
            <h3>Top destinations</h3>
            <span className="dim sm">destination_view events · {days}d</span>
          </div>
          {topDest.length === 0 ? (
            <div className="crm-empty">No destination views in this window.</div>
          ) : (
            <div className="crm-topdest">
              {topDest.map((d) => {
                const max = topDest[0]?.views ?? 1
                return (
                  <div key={d.code} className="crm-topdest-row">
                    <span className="flag">{d.flag}</span>
                    <span className="name">{d.name}</span>
                    <div className="crm-bar">
                      <div className="crm-bar-fill" style={{ width: `${(d.views / max) * 100}%` }} />
                    </div>
                    <span className="cnt">{d.views}</span>
                    <span className="amt" />
                  </div>
                )
              })}
            </div>
          )}
        </div>

        <div className="crm-card">
          <div className="crm-card-h">
            <h3>Coupon impact</h3>
            <span className="dim sm">applies · redemptions · revenue</span>
          </div>
          {coupons.length === 0 ? (
            <div className="crm-empty">No coupon activity in this window.</div>
          ) : (
            <table className="crm-table" style={{ marginTop: 4 }}>
              <thead>
                <tr>
                  <th>Code</th>
                  <th style={{ textAlign: 'right' }}>Applied</th>
                  <th style={{ textAlign: 'right' }}>Redeemed</th>
                  <th style={{ textAlign: 'right' }}>Revenue</th>
                </tr>
              </thead>
              <tbody>
                {coupons.map((c) => (
                  <tr key={c.code}>
                    <td className="mono">{c.code}</td>
                    <td className="num" style={{ textAlign: 'right' }}>{c.applications}</td>
                    <td className="num" style={{ textAlign: 'right' }}>{c.redemptions}</td>
                    <td className="num" style={{ textAlign: 'right' }}>{dollars(c.revenue_cents)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  )
}

// ---- Charts -----------------------------------------------------------------

// Self-contained traffic chart with axes + gridlines. Replaces the
// previous bare-sparkline pair (sparklines are by-design axis-less,
// fine for KPI snippets but useless when admins want to read actual
// numbers off the chart).
function TrafficChart({ series }: { series: AnalyticsTimeseriesPoint[] }) {
  if (series.length === 0) {
    return <div className="crm-empty">No traffic recorded yet.</div>
  }

  const PAD_LEFT = 36   // room for y-axis labels
  const PAD_BOTTOM = 22 // room for x-axis date labels
  const PAD_TOP = 8
  const PAD_RIGHT = 4
  const W = 520
  const H = 180
  const innerW = W - PAD_LEFT - PAD_RIGHT
  const innerH = H - PAD_TOP - PAD_BOTTOM

  const peak = Math.max(
    1,
    ...series.map((p) => Math.max(p.page_views, p.visitors)),
  )
  // Round up to a "nice" axis max (e.g., 37 → 40, 142 → 150) so the
  // top tick doesn't read as 37.42.
  const niceMax = niceCeil(peak)
  const tickCount = 4
  const tickStep = niceMax / tickCount
  const ticks = Array.from({ length: tickCount + 1 }, (_, i) => i * tickStep)

  const stepX = series.length > 1 ? innerW / (series.length - 1) : 0
  const projY = (v: number) => PAD_TOP + innerH - (v / niceMax) * innerH
  const projX = (i: number) => PAD_LEFT + i * stepX

  function pathFor(values: number[]) {
    const pts = values.map((v, i) => `${i === 0 ? 'M' : 'L'}${projX(i).toFixed(1)} ${projY(v).toFixed(1)}`).join(' ')
    const area = `${pts} L${(PAD_LEFT + (series.length - 1) * stepX).toFixed(1)} ${(PAD_TOP + innerH).toFixed(1)} L${PAD_LEFT.toFixed(1)} ${(PAD_TOP + innerH).toFixed(1)} Z`
    return { line: pts, area }
  }
  const pv = pathFor(series.map((p) => p.page_views))
  const vis = pathFor(series.map((p) => p.visitors))

  // X-axis labels: first / middle / last date (skip the rest to avoid
  // crowding). Format as "May 9".
  const xLabelIdx = series.length <= 2
    ? series.map((_, i) => i)
    : [0, Math.floor((series.length - 1) / 2), series.length - 1]

  return (
    <div style={{ marginTop: 8 }}>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        width="100%"
        style={{ display: 'block', maxWidth: W, height: 'auto' }}
        aria-label="Visitors and page views over time"
      >
        {/* Y-axis gridlines + tick labels */}
        {ticks.map((t) => {
          const y = projY(t)
          return (
            <g key={t}>
              <line
                x1={PAD_LEFT}
                x2={W - PAD_RIGHT}
                y1={y}
                y2={y}
                stroke="var(--crm-line)"
                strokeWidth="1"
                strokeDasharray={t === 0 ? '0' : '2 3'}
                strokeOpacity={t === 0 ? 0.5 : 0.4}
              />
              <text
                x={PAD_LEFT - 6}
                y={y + 3}
                textAnchor="end"
                fontSize="10.5"
                fontFamily="var(--mono)"
                fill="var(--crm-text-3)"
              >
                {fmtTickInt(t)}
              </text>
            </g>
          )
        })}

        {/* Page views filled area + line */}
        <path d={pv.area} fill="var(--crm-accent)" fillOpacity="0.12" />
        <path d={pv.line} fill="none" stroke="var(--crm-accent)" strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" />

        {/* Visitors filled area + line (overlay) */}
        <path d={vis.area} fill="var(--crm-warn)" fillOpacity="0.12" />
        <path d={vis.line} fill="none" stroke="var(--crm-warn)" strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" />

        {/* X-axis date labels */}
        {xLabelIdx.map((i) => {
          const d = new Date(series[i].day)
          const label = d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
          return (
            <text
              key={i}
              x={projX(i)}
              y={H - 4}
              textAnchor={i === 0 ? 'start' : i === series.length - 1 ? 'end' : 'middle'}
              fontSize="10.5"
              fontFamily="var(--mono)"
              fill="var(--crm-text-3)"
            >
              {label}
            </text>
          )
        })}
      </svg>
    </div>
  )
}

// Round up to a tick-friendly max. Picks 1/2/5 × 10^n granularity.
function niceCeil(n: number): number {
  if (n <= 1) return 1
  const exp = Math.floor(Math.log10(n))
  const base = Math.pow(10, exp)
  const norm = n / base
  let nice: number
  if (norm <= 1) nice = 1
  else if (norm <= 2) nice = 2
  else if (norm <= 5) nice = 5
  else nice = 10
  return nice * base
}

// Compact tick labels: "1.2k" / "12k" / "120k" once we get past 999.
function fmtTickInt(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}k`
  return Math.round(n).toString()
}

function TrafficLegend() {
  return (
    <div style={{ display: 'flex', gap: 16, fontSize: 12, color: 'var(--crm-text-2)', marginTop: 6 }}>
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
        <span style={{ width: 10, height: 10, background: 'var(--crm-accent)', borderRadius: 2 }} />
        Page views
      </span>
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
        <span style={{ width: 10, height: 10, background: 'var(--crm-warn)', borderRadius: 2 }} />
        Visitors
      </span>
    </div>
  )
}

function FunnelChart({ steps }: { steps: AnalyticsFunnelStep[] }) {
  const max = steps[0]?.sessions ?? 0
  if (max === 0) {
    return (
      <div className="crm-funnel-empty">
        <strong>No sessions tracked yet.</strong>
        Once visitors start hitting the site, this funnel will fill in.
      </div>
    )
  }
  return (
    <div className="crm-funnel">
      {steps.map((s, i) => {
        const w = max > 0 ? (s.sessions / max) * 100 : 0
        const dropFromPrev = i > 0 && steps[i - 1].sessions > 0
          ? Math.round((1 - s.sessions / steps[i - 1].sessions) * 100)
          : null
        return (
          <div key={s.type}>
            <div className="crm-funnel-row">
              <div className="crm-funnel-bar" style={{ width: `${Math.max(w, 2)}%` }} />
              <div className="crm-funnel-label">
                <span>{s.label}</span>
                <span>{s.sessions.toLocaleString()}</span>
              </div>
            </div>
            {dropFromPrev !== null && (
              <div style={{ fontSize: 11, color: 'var(--crm-text-3)', padding: '2px 4px 0' }}>
                {dropFromPrev > 0 ? `−${dropFromPrev}% drop-off from previous step` : 'no drop-off'}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

// Post-purchase install funnel. Same visual shape as FunnelChart but
// with order-count semantics + a JoyTel-callback-aware empty state.
//
// Two distinct empty states:
//   1. has_install_events=false → JoyTel hasn't enabled the callback
//      yet. Show actionable copy with the URL.
//   2. has_install_events=true but Paid=0 → no orders in window. Show
//      generic empty copy.
function InstallFunnelChart({ data }: { data: InstallFunnelResponse | null }) {
  if (!data) {
    return <div className="crm-funnel-empty">Loading…</div>
  }
  const paid = data.steps[0]?.orders ?? 0

  if (!data.has_install_events) {
    return (
      <div className="crm-funnel-empty">
        <strong>Install events aren't flowing yet.</strong>
        Once your JoyTel rep enables the eSIM Installation Event callback to{' '}
        <code style={{ fontSize: 11 }}>/api/webhooks/joytel/notify/esim/esim-progress</code>,
        every download / install / enable from a customer's phone will land here.
        Right now this card only knows about the {paid.toLocaleString()} paid
        order{paid === 1 ? '' : 's'} in the window.
      </div>
    )
  }
  if (paid === 0) {
    return (
      <div className="crm-funnel-empty">
        <strong>No paid orders in this window.</strong>
        Once you start shipping eSIMs, the funnel will fill in.
      </div>
    )
  }

  const max = paid
  return (
    <div className="crm-funnel">
      {data.steps.map((s, i) => {
        const w = max > 0 ? (s.orders / max) * 100 : 0
        const prev = i > 0 ? data.steps[i - 1].orders : null
        const dropFromPrev =
          prev !== null && prev > 0 ? Math.round((1 - s.orders / prev) * 100) : null
        return (
          <div key={s.key}>
            <div className="crm-funnel-row">
              <div className="crm-funnel-bar" style={{ width: `${Math.max(w, 2)}%` }} />
              <div className="crm-funnel-label">
                <span>{s.label}</span>
                <span>{s.orders.toLocaleString()}</span>
              </div>
            </div>
            {dropFromPrev !== null && (
              <div style={{ fontSize: 11, color: 'var(--crm-text-3)', padding: '2px 4px 0' }}>
                {dropFromPrev > 0
                  ? `−${dropFromPrev}% drop-off from previous step`
                  : 'no drop-off'}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

// Simple ranked bar list — used by Sources, Devices, Countries.
function BarList({ rows }: { rows: { key: string; label: string; value: number }[] }) {
  if (rows.length === 0) {
    return <div className="crm-empty">No data yet.</div>
  }
  const max = rows[0]?.value ?? 1
  return (
    <div className="crm-barlist">
      {rows.map((r) => (
        <div key={r.key} className="crm-barlist-row">
          <span className="lbl">{r.label}</span>
          <div className="crm-bar">
            <div className="crm-bar-fill" style={{ width: `${(r.value / Math.max(1, max)) * 100}%` }} />
          </div>
          <span className="cnt">{r.value.toLocaleString()}</span>
        </div>
      ))}
    </div>
  )
}
