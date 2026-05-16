import { useEffect, useState } from 'react'
import { CrmIcon } from '../components/CrmIcon'
import { AuthPill, StatusPill } from '../components/Pill'
import { Avatar } from '../components/Avatar'
import { adminApi, type AdminOrderDetail } from '../api/admin'
import { fetchOrderUsage, type OrderUsage } from '../../api/orders'

interface DrawerProps {
  reference: string
  onClose: () => void
}

const dollars = (c: number) => `$${(c / 100).toFixed(2)}`

// V1 timeline is derived from what we know — no separate event log yet.
// Each step is added if its relevant field is present on the order.
function buildTimeline(o: AdminOrderDetail): { label: string; when: string | null; ok?: boolean; err?: boolean }[] {
  const steps: { label: string; when: string | null; ok?: boolean; err?: boolean }[] = []
  steps.push({ label: 'Order created', when: o.created_at, ok: true })
  if (o.stripe_payment_intent) steps.push({ label: 'Payment received (Stripe)', when: null, ok: true })
  if (o.joytel_order_id) steps.push({ label: `Submitted to JoyTel · ${o.joytel_order_id}`, when: null, ok: true })
  if (o.sn_pin) steps.push({ label: 'JoyTel returned snPin', when: null, ok: true })
  if (o.qr_code_data || o.qr_code_url) steps.push({ label: 'QR code delivered', when: null, ok: true })
  if (o.status === 'delivered') steps.push({ label: 'Order complete', when: o.updated_at, ok: true })
  if (o.status === 'refunded') steps.push({ label: `Refunded · ${o.stripe_refund_id || '—'}`, when: o.updated_at, ok: true })
  if (o.status === 'failed') steps.push({ label: o.error_message || 'Failed', when: o.updated_at, err: true })
  return steps
}

export function OrderDrawer({ reference, onClose }: DrawerProps) {
  const [order, setOrder] = useState<AdminOrderDetail | null>(null)
  const [error, setError] = useState<string | null>(null)
  // Usage state — fetched lazily after the order detail lands. Same
  // shape the customer-facing /account page uses, but the backend
  // endpoint allows admin to query any order (not just their own).
  const [usage, setUsage] = useState<OrderUsage | null>(null)
  const [usageLoading, setUsageLoading] = useState(false)
  const [usageError, setUsageError] = useState<string | null>(null)
  const [usageRefreshedAt, setUsageRefreshedAt] = useState<Date | null>(null)

  useEffect(() => {
    let cancelled = false
    setOrder(null)
    setError(null)
    setUsage(null)
    setUsageError(null)
    setUsageRefreshedAt(null)
    adminApi
      .getOrder(reference)
      .then((o) => !cancelled && setOrder(o))
      .catch((e: Error) => !cancelled && setError(e.message))
    return () => {
      cancelled = true
    }
  }, [reference])

  // Auto-fetch usage when we have a delivered order. The endpoint
  // 400s on non-delivered orders, so we gate.
  useEffect(() => {
    if (!order || order.status !== 'delivered') return
    loadUsage()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [order?.reference, order?.status])

  async function loadUsage() {
    if (!order) return
    setUsageLoading(true)
    setUsageError(null)
    try {
      const u = await fetchOrderUsage(order.reference)
      setUsage(u)
      setUsageRefreshedAt(new Date())
    } catch (e) {
      setUsageError(e instanceof Error ? e.message : String(e))
    } finally {
      setUsageLoading(false)
    }
  }

  return (
    <div className="crm-drawer-bg" onClick={onClose}>
      <div className="crm-drawer" onClick={(e) => e.stopPropagation()} role="dialog" aria-label={`Order ${reference}`}>
        <div className="crm-drawer-h">
          <div>
            <div className="crm-eyebrow">Order</div>
            <h2 className="mono" style={{ fontFamily: 'var(--crm-mono)' }}>{reference}</h2>
          </div>
          <button className="crm-btn icon" onClick={onClose} aria-label="Close">
            <CrmIcon name="x" size={16} />
          </button>
        </div>

        {error && <div className="crm-empty"><strong>Couldn't load order</strong>{error}</div>}
        {!order && !error && <div className="crm-empty">Loading…</div>}

        {order && (
          <>
            <div className="crm-drawer-meta">
              <div>
                <span className="lbl">Status</span>
                <span><StatusPill status={order.status} /></span>
              </div>
              <div>
                <span className="lbl">Date</span>
                <span>{new Date(order.created_at).toLocaleString()}</span>
              </div>
              <div>
                <span className="lbl">Amount</span>
                <span className="num">{dollars(order.amount_cents)} {order.currency.toUpperCase()}</span>
              </div>
              <div>
                <span className="lbl">Payment</span>
                <span className="mono dim sm" title={order.stripe_payment_intent || ''}>
                  {order.stripe_payment_intent ? `${order.stripe_payment_intent.slice(0, 14)}…` : '—'}
                </span>
              </div>
            </div>

            <div className="crm-drawer-section">
              <h4>Customer</h4>
              <div className="crm-cust">
                <Avatar name={order.user_name} email={order.email} size="lg" />
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 500 }}>{order.user_name || <span className="dim">— guest</span>}</div>
                  <div className="dim sm">{order.email}</div>
                  <div style={{ marginTop: 4 }}><AuthPill auth={order.user_auth} /></div>
                </div>
              </div>
            </div>

            <div className="crm-drawer-section">
              <h4>eSIM</h4>
              <div style={{ fontSize: 13.5 }}>
                <div><strong>{order.plan_name || order.plan_id}</strong></div>
                <div className="dim sm" style={{ marginTop: 2 }}>
                  {order.plan_data_gb !== null
                    ? order.plan_data_gb >= 999
                      ? 'Unlimited'
                      : `${order.plan_data_gb} GB`
                    : '—'} · {order.plan_validity_days ?? '—'} days · {order.plan_country || '—'}
                </div>
              </div>

              {/* Usage panel — only meaningful for delivered orders.
                  Mirrors the customer-side /account view: status pill,
                  used/total numbers, install timestamps, manual refresh. */}
              {order.status === 'delivered' && (
                <UsagePanel
                  usage={usage}
                  loading={usageLoading}
                  error={usageError}
                  refreshedAt={usageRefreshedAt}
                  onRefresh={loadUsage}
                  planTotalGb={order.plan_data_gb ?? 0}
                />
              )}
              {order.status !== 'delivered' && (
                <div className="dim sm" style={{ marginTop: 10 }}>
                  Usage tracking starts once the order is delivered.
                </div>
              )}
            </div>

            <div className="crm-drawer-section">
              <h4>Timeline</h4>
              <div className="crm-timeline">
                {buildTimeline(order).map((s, i) => (
                  <div key={i} className={`crm-tl-row ${s.err ? 'err' : s.ok ? 'ok' : ''}`}>
                    <span className="crm-tl-dot" />
                    <div className="crm-tl-body">
                      <div>{s.label}</div>
                      {s.when && <div className="when">{new Date(s.when).toLocaleString()}</div>}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {(order.qr_code_data || order.qr_code_url) && (
              <div className="crm-drawer-section">
                <h4>QR data</h4>
                <div className="mono dim sm" style={{ wordBreak: 'break-all' }}>
                  {order.qr_code_data || order.qr_code_url}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}

// Compact usage panel for the admin drawer. Same data shape as the
// customer-facing one; admin layout is tighter and uses CRM tokens.
function UsagePanel({
  usage,
  loading,
  error,
  refreshedAt,
  onRefresh,
  planTotalGb,
}: {
  usage: OrderUsage | null
  loading: boolean
  error: string | null
  refreshedAt: Date | null
  onRefresh: () => void
  planTotalGb: number
}) {
  const planTotalMb = Math.round(planTotalGb * 1024)
  const usedMb = usage?.used_mb ?? null
  const percent =
    usedMb !== null && planTotalMb > 0
      ? Math.min(Math.round((usedMb / planTotalMb) * 1000) / 10, 100)
      : null

  const stateLabel = ((): { text: string; cls: string } => {
    if (!usage) return { text: '—', cls: '' }
    if (usage.state === 'expired') return { text: 'Expired', cls: 'expired' }
    if (usage.state === 'depleted') return { text: 'Depleted', cls: 'expired' }
    if (usage.state === 'active') return { text: 'Active', cls: 'active' }
    if (usage.esim_status === 'activated') return { text: 'Active', cls: 'active' }
    return { text: 'Not yet installed', cls: 'inactive' }
  })()

  return (
    <div className="crm-usage">
      <div className="crm-usage__head">
        <span className="crm-usage__lbl">Live usage</span>
        <span className={`crm-usage__pill ${stateLabel.cls}`}>{stateLabel.text}</span>
        <button
          type="button"
          className="crm-usage__refresh"
          onClick={onRefresh}
          disabled={loading}
        >
          {loading ? 'Refreshing…' : 'Refresh'}
        </button>
      </div>

      {error && !loading && (
        <div className="dim sm" style={{ color: 'var(--crm-danger)', marginTop: 6 }}>
          {error}
        </div>
      )}

      {!error && (
        <>
          <div className="crm-usage__stats">
            <span className="crm-usage__used">
              {formatMb(usedMb)} <span className="dim">of {formatMb(planTotalMb)}</span>
            </span>
            {percent !== null && (
              <span className="crm-usage__pct mono">{percent.toFixed(percent < 10 ? 1 : 0)}%</span>
            )}
          </div>
          <div className="crm-usage__bar">
            <div
              className={`crm-usage__fill ${percent !== null && percent >= 85 ? 'hot' : ''}`}
              style={{ width: `${percent ?? 0}%` }}
            />
          </div>
        </>
      )}

      <div className="crm-usage__meta">
        {usage?.installed_at && (
          <div><span className="dim">Installed</span> {new Date(usage.installed_at).toLocaleString()}</div>
        )}
        {usage?.enabled_at && (
          <div><span className="dim">Enabled</span> {new Date(usage.enabled_at).toLocaleString()}</div>
        )}
        {usage?.expires_at && (
          <div><span className="dim">Expires</span> {new Date(usage.expires_at).toLocaleString()}</div>
        )}
        {refreshedAt && !error && (
          <div className="dim sm">
            Updated {refreshedAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </div>
        )}
      </div>
    </div>
  )
}

function formatMb(mb: number | null): string {
  if (mb === null) return '—'
  if (mb >= 1024) return `${(mb / 1024).toFixed(mb >= 10240 ? 1 : 2)} GB`
  return `${mb} MB`
}
