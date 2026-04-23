import { useEffect, useMemo, useState } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { Icon } from '../components/Icon'
import { useAuth } from '../auth/AuthContext'
import { useCatalog } from '../hooks/useCatalog'
import { listOrders, type OrderDetail } from '../api/orders'
import {
  COUNTRIES,
  REGIONAL_PLANS_META,
  formatData,
  priceDollars,
  type Plan,
} from '../data/catalog'

type Tab = 'esims' | 'orders' | 'payment' | 'support'

const TABS: { id: Tab; label: string }[] = [
  { id: 'esims', label: 'My eSIMs' },
  { id: 'orders', label: 'Orders' },
  { id: 'payment', label: 'Payment methods' },
  { id: 'support', label: 'Support' },
]

export default function Account() {
  const { user, loading: authLoading } = useAuth()
  const navigate = useNavigate()
  const { plans } = useCatalog()
  const [tab, setTab] = useState<Tab>('esims')

  const [orders, setOrders] = useState<OrderDetail[] | null>(null)
  const [loadingOrders, setLoadingOrders] = useState(false)
  const [ordersError, setOrdersError] = useState<string | null>(null)

  useEffect(() => {
    if (!user) return
    let cancelled = false
    setLoadingOrders(true)
    listOrders(1, 50)
      .then((res) => {
        if (!cancelled) setOrders(res.orders)
      })
      .catch((e: Error) => {
        if (!cancelled) setOrdersError(e.message)
      })
      .finally(() => {
        if (!cancelled) setLoadingOrders(false)
      })
    return () => {
      cancelled = true
    }
  }, [user])

  const planById = useMemo(() => {
    const m = new Map<string, Plan>()
    if (plans) plans.forEach((p) => m.set(p.id, p))
    return m
  }, [plans])

  if (authLoading) return <div className="page-stub">Loading…</div>
  if (!user) return <Navigate to="/login" state={{ from: '/account' }} replace />

  const activeOrders = orders?.filter((o) => o.status === 'completed') ?? []

  return (
    <div className="account">
      <div className="account-head">
        <div>
          <h1>Hi, {user.name || user.email.split('@')[0]}.</h1>
          <div className="sub">
            {orders === null
              ? 'Loading your eSIMs…'
              : `${activeOrders.length} active · ${orders.length} total orders`}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn primary sm" onClick={() => navigate('/destinations')}>
            + New eSIM
          </button>
        </div>
      </div>

      <div className="account-tabs">
        {TABS.map((t) => (
          <button key={t.id} className={tab === t.id ? 'active' : ''} onClick={() => setTab(t.id)}>
            {t.label}
          </button>
        ))}
      </div>

      {ordersError && (
        <div
          style={{
            padding: 16,
            background: '#FFECE7',
            color: 'var(--pop)',
            borderRadius: 10,
            fontSize: 14,
            marginBottom: 16,
          }}
        >
          {ordersError}
        </div>
      )}

      {tab === 'esims' && (
        <EsimListTab
          orders={orders ?? []}
          planById={planById}
          loading={loadingOrders}
          onInstall={(ref) => navigate(`/order/${ref}`)}
        />
      )}

      {tab === 'orders' && (
        <OrdersTab orders={orders ?? []} planById={planById} loading={loadingOrders} />
      )}

      {tab === 'payment' && <PaymentMethodsTab />}

      {tab === 'support' && <SupportTab />}
    </div>
  )
}

function EsimListTab({
  orders,
  planById,
  loading,
  onInstall,
}: {
  orders: OrderDetail[]
  planById: Map<string, Plan>
  loading: boolean
  onInstall: (ref: string) => void
}) {
  if (loading && orders.length === 0) {
    return <div className="page-stub">Loading your eSIMs…</div>
  }
  if (orders.length === 0) {
    return (
      <div
        style={{
          padding: 48,
          background: 'var(--bg-elev)',
          border: '1px solid var(--line)',
          borderRadius: 14,
          textAlign: 'center',
        }}
      >
        <h3 style={{ marginBottom: 8 }}>No eSIMs yet</h3>
        <p className="muted" style={{ marginBottom: 20 }}>
          Pick a destination to get your first one installed in 60 seconds.
        </p>
        <Link to="/destinations" className="btn primary reset" style={{ padding: '12px 20px' }}>
          Browse destinations
        </Link>
      </div>
    )
  }

  return (
    <div className="esim-list">
      {orders.map((o) => {
        const plan = planById.get(o.plan_id) ?? null
        const dest = plan ? resolveMeta(plan) : null
        const flag = dest?.flag ?? '🌐'
        const name = dest?.name ?? o.plan_id
        const statusClass = uiStatusClass(o.status)
        return (
          <div key={o.reference} className="esim-item esim-item--compact">
            <div className="flag">{flag}</div>
            <div>
              <div className="name">{name} eSIM</div>
              <div className="plan">
                {plan ? `${formatData(plan.data_gb)} · ${plan.validity_days} days` : 'Plan details pending'} · {o.reference}
              </div>
            </div>
            <div className={`status ${statusClass}`}>
              <span className="dot"></span>
              {humanStatus(o.status)}
            </div>
            <div className="mono muted" style={{ fontSize: 12 }}>
              {new Date(o.created_at).toLocaleDateString()}
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              {o.status === 'completed' ? (
                <button className="btn subtle sm" onClick={() => onInstall(o.reference)}>
                  View QR
                </button>
              ) : o.status === 'failed' ? (
                <button className="btn ghost sm" onClick={() => onInstall(o.reference)}>
                  Details
                </button>
              ) : (
                <button className="btn primary sm" onClick={() => onInstall(o.reference)}>
                  Track
                </button>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}

function OrdersTab({
  orders,
  planById,
  loading,
}: {
  orders: OrderDetail[]
  planById: Map<string, Plan>
  loading: boolean
}) {
  if (loading && orders.length === 0) return <div className="page-stub">Loading orders…</div>
  if (orders.length === 0) {
    return (
      <div
        style={{
          padding: 40,
          background: 'var(--bg-elev)',
          border: '1px solid var(--line)',
          borderRadius: 14,
          color: 'var(--ink-3)',
          textAlign: 'center',
        }}
      >
        No orders yet.
      </div>
    )
  }
  return (
    <div className="esim-list">
      {orders.map((o) => {
        const plan = planById.get(o.plan_id) ?? null
        const dest = plan ? resolveMeta(plan) : null
        const flag = dest?.flag ?? '🌐'
        const name = dest?.name ?? o.plan_id
        return (
          <div key={o.reference} className="esim-item">
            <div className="flag">{flag}</div>
            <div>
              <div className="name">{name} eSIM</div>
              <div className="plan mono">
                {o.reference} · {new Date(o.created_at).toLocaleDateString()}
              </div>
            </div>
            <div className="mono muted" style={{ fontSize: 13 }}>
              {plan ? `${formatData(plan.data_gb)} · ${plan.validity_days}d` : '—'}
            </div>
            <div className="mono" style={{ fontSize: 14 }}>
              ${priceDollars(o.amount_cents)}
            </div>
            <div>
              <span className={`badge ${o.status === 'completed' ? 'ok' : o.status === 'failed' ? 'pop' : ''}`}>
                {badgeLabel(o.status)}
              </span>
            </div>
            <div />
          </div>
        )
      })}
    </div>
  )
}

function PaymentMethodsTab() {
  return (
    <div
      style={{
        padding: 40,
        background: 'var(--bg-elev)',
        border: '1px solid var(--line)',
        borderRadius: 14,
      }}
    >
      <h3 style={{ marginBottom: 8 }}>Payments are handled by Stripe</h3>
      <p className="muted" style={{ marginBottom: 12, fontSize: 14 }}>
        We don't store your card details — each purchase is a one-time charge
        processed securely through Stripe. You'll enter payment info at the
        checkout screen.
      </p>
      <p className="muted" style={{ fontSize: 14 }}>
        Saved methods and automatic renewals are on our roadmap.
      </p>
    </div>
  )
}

function SupportTab() {
  return (
    <div
      style={{
        padding: 40,
        background: 'var(--bg-elev)',
        border: '1px solid var(--line)',
        borderRadius: 14,
        textAlign: 'center',
      }}
    >
      <h3>Support</h3>
      <p className="muted" style={{ marginTop: 8 }}>
        Email us any time — we aim to reply within a few hours.
      </p>
      <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginTop: 20 }}>
        <a
          href="mailto:support@nimvoy.com"
          className="btn primary reset"
          style={{ padding: '12px 20px' }}
        >
          <Icon name="arrow" size={14} /> support@nimvoy.com
        </a>
      </div>
    </div>
  )
}

function uiStatusClass(status: string): 'active' | 'inactive' | 'expired' {
  if (status === 'completed') return 'active'
  if (status === 'failed') return 'expired'
  return 'inactive'
}

function humanStatus(status: string): string {
  switch (status) {
    case 'completed':
      return 'Ready to install'
    case 'failed':
      return 'Failed'
    case 'refunded':
      return 'Refunded'
    case 'created':
      return 'Awaiting payment'
    case 'paid':
      return 'Payment received'
    case 'joytel_pending':
      return 'Provisioning'
    case 'snpin_received':
      return 'Generating QR'
    default:
      return status
  }
}

function badgeLabel(status: string): string {
  if (status === 'completed') return 'PAID'
  if (status === 'failed') return 'FAILED'
  if (status === 'refunded') return 'REFUNDED'
  return status.toUpperCase()
}

function resolveMeta(plan: Plan): { code: string; name: string; flag: string } | null {
  if (plan.plan_type === 'regional') {
    const r = REGIONAL_PLANS_META.find((x) => x.code === plan.country)
    return r ? { code: r.code, name: r.name, flag: r.flag } : null
  }
  const c = COUNTRIES.find((x) => x.code === plan.country)
  return c ? { code: c.code, name: c.name, flag: c.flag } : null
}
