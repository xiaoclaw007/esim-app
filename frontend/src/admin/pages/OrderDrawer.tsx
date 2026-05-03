import { useEffect, useState } from 'react'
import { CrmIcon } from '../components/CrmIcon'
import { AuthPill, StatusPill } from '../components/Pill'
import { Avatar } from '../components/Avatar'
import { adminApi, type AdminOrderDetail } from '../api/admin'

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
  if (o.status === 'completed') steps.push({ label: 'Order complete', when: o.updated_at, ok: true })
  if (o.status === 'refunded') steps.push({ label: `Refunded · ${o.stripe_refund_id || '—'}`, when: o.updated_at, ok: true })
  if (o.status === 'failed') steps.push({ label: o.error_message || 'Failed', when: o.updated_at, err: true })
  return steps
}

export function OrderDrawer({ reference, onClose }: DrawerProps) {
  const [order, setOrder] = useState<AdminOrderDetail | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setOrder(null)
    setError(null)
    adminApi
      .getOrder(reference)
      .then((o) => !cancelled && setOrder(o))
      .catch((e: Error) => !cancelled && setError(e.message))
    return () => {
      cancelled = true
    }
  }, [reference])

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
                <div className="dim sm" style={{ marginTop: 8 }}>
                  Activation tracking not yet wired (JoyTel usage API exists but isn't called).
                </div>
              </div>
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
