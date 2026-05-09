import { useEffect, useMemo, useState } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { Icon } from '../components/Icon'
import { LogoMark } from '../components/Logo'
import { useAuth } from '../auth/AuthContext'
import { useCatalog } from '../hooks/useCatalog'
import { listOrders, fetchOrderUsage, type OrderDetail, type OrderUsage } from '../api/orders'
import {
  fetchCreditBalance,
  fetchCreditHistory,
  formatDollars,
  reasonLabel,
  type CreditBalance,
  type CreditHistoryRow,
} from '../api/credits'
import {
  COUNTRIES,
  REGIONAL_PLANS_META,
  formatData,
  priceDollars,
  type Plan,
} from '../data/catalog'

type Tab = 'esims' | 'orders' | 'credit' | 'support'

const TABS: { id: Tab; label: string }[] = [
  { id: 'esims', label: 'My eSIMs' },
  { id: 'orders', label: 'Orders' },
  { id: 'credit', label: 'Credit' },
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

  // Credit balance is shown in the head pill + the Credit tab. We fetch
  // it on every account-page mount so the value reflects whatever just
  // happened on a checkout (earned / spent / refunded). Cheap query.
  const [credit, setCredit] = useState<CreditBalance | null>(null)

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
    fetchCreditBalance()
      .then((b) => !cancelled && setCredit(b))
      .catch(() => {})  // balance failure is non-blocking; pill just hides
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

  const activeOrders = orders?.filter((o) => o.status === 'delivered') ?? []

  // "Claimed via magic-link only" state — user has no password and no
  // Google link. Render a one-shot banner inviting them to upgrade.
  // Once either credential is set, the banner disappears for good.
  const needsCredential = user.has_password === false && user.has_google === false

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
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          {credit && credit.balance_cents > 0 && (
            <button
              className="credit-pill"
              onClick={() => setTab('credit')}
              title="View credit history"
            >
              <span className="credit-pill__amount">{formatDollars(credit.balance_cents)}</span>
              <span className="credit-pill__label">Nimvoy credit</span>
            </button>
          )}
          <button className="btn primary sm" onClick={() => navigate('/destinations')}>
            + New eSIM
          </button>
        </div>
      </div>

      {needsCredential && (
        <div className="claim-banner">
          <div>
            <div className="claim-banner__eyebrow">Secure your account</div>
            <p className="claim-banner__body">
              You're signed in with an email link. Add a password or connect Google so you don't
              need a fresh link every time you log in.
            </p>
          </div>
          <div className="claim-banner__actions">
            <Link to="/signup" className="btn primary sm">Add a password</Link>
            <a href="/api/auth/google" className="btn ghost sm">Connect Google</a>
          </div>
        </div>
      )}

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

      {tab === 'credit' && <CreditTab balance={credit} earnRate={credit?.earn_rate ?? 0.1} />}

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
        return (
          <EsimCard
            key={o.reference}
            order={o}
            plan={plan}
            dest={dest}
            onInstall={() => onInstall(o.reference)}
          />
        )
      })}
    </div>
  )
}

// One card per order. Wraps the existing top row + a usage block below
// for delivered orders. Usage is fetched on mount (lazy — only when the
// card is rendered, since the My eSIMs tab is the default tab) plus on
// manual refresh. We don't poll: JoyTel updates with multi-minute lag
// anyway and each call hits a paid carrier API.
function EsimCard({
  order,
  plan,
  dest,
  onInstall,
}: {
  order: OrderDetail
  plan: Plan | null
  dest: { code: string; name: string; flag: string } | null
  onInstall: () => void
}) {
  const flag = dest?.flag ?? '🌐'
  const name = dest?.name ?? order.plan_id
  const isDelivered = order.status === 'delivered'

  // Usage state lives on the card so both the top-row status and the
  // usage panel below render from the same source of truth. Without
  // this lift, the row could show "Ready to install" while the panel
  // says "Expired" — contradictory and confusing.
  const [usage, setUsage] = useState<OrderUsage | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [refreshedAt, setRefreshedAt] = useState<Date | null>(null)

  const loadUsage = async () => {
    setLoading(true)
    setError(null)
    try {
      const u = await fetchOrderUsage(order.reference)
      setUsage(u)
      setRefreshedAt(new Date())
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!isDelivered) return
    void loadUsage()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [order.reference, isDelivered])

  // Derive the top-row status from the merge of DB status + live JoyTel
  // signals. JoyTel data wins when present; falls back to DB status.
  const display = displayStatus(order.status, usage)

  return (
    <div className="esim-card">
      <div className="esim-item esim-item--compact">
        <div className="flag">{flag}</div>
        <div>
          <div className="name">{name} eSIM</div>
          <div className="plan">
            {plan ? `${formatData(plan.data_gb)} · ${plan.validity_days} days` : 'Plan details pending'} · {order.reference}
          </div>
        </div>
        <div className={`status ${display.cls}`}>
          <span className="dot"></span>
          {display.label}
        </div>
        <div className="mono muted" style={{ fontSize: 12 }}>
          {new Date(order.created_at).toLocaleDateString()}
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          {isDelivered ? (
            <button className="btn subtle sm" onClick={onInstall}>
              View QR
            </button>
          ) : order.status === 'failed' ? (
            <button className="btn ghost sm" onClick={onInstall}>
              Details
            </button>
          ) : (
            <button className="btn primary sm" onClick={onInstall}>
              Track
            </button>
          )}
        </div>
      </div>
      {isDelivered && plan && (
        <UsagePanel
          planTotalGb={plan.data_gb}
          usage={usage}
          loading={loading}
          error={error}
          refreshedAt={refreshedAt}
          onRefresh={() => void loadUsage()}
        />
      )}
    </div>
  )
}

// Pick the right status label + class given the DB status and the
// live JoyTel data. JoyTel state wins when it tells us something
// definitive (expired / depleted / active), otherwise we fall back
// to the DB humanStatus mapping.
function displayStatus(
  dbStatus: string,
  usage: OrderUsage | null,
): { label: string; cls: 'active' | 'inactive' | 'expired' } {
  if (usage) {
    if (usage.state === 'expired') return { label: 'Expired', cls: 'expired' }
    if (usage.state === 'depleted') return { label: 'Used up', cls: 'expired' }
    if (usage.state === 'active') return { label: 'Active', cls: 'active' }
  }
  return { label: humanStatus(dbStatus), cls: uiStatusClass(dbStatus) }
}

// Usage panel — sits below the eSIM row inside the same card. Renders
// one of three states: loading, error, or a progress bar with stats.
// State lives on the parent EsimCard so the top-row status badge and
// this panel render from the same data; we just consume props here.
function UsagePanel({
  planTotalGb,
  usage,
  loading,
  error,
  refreshedAt,
  onRefresh,
}: {
  planTotalGb: number
  usage: OrderUsage | null
  loading: boolean
  error: string | null
  refreshedAt: Date | null
  onRefresh: () => void
}) {
  // Plan total comes from our catalog (authoritative for what was sold).
  // Carrier-reported total can drift from this for various reasons; we
  // prefer the catalog total in the UI but show carrier-reported numbers
  // for "used" since that's the live data we care about.
  const planTotalMb = Math.round(planTotalGb * 1024)
  const usedMb = usage?.used_mb ?? null
  const percent =
    usedMb !== null && planTotalMb > 0
      ? Math.min(Math.round((usedMb / planTotalMb) * 1000) / 10, 100)
      : null
  const usedDisplay = formatMb(usedMb)
  const totalDisplay = formatMb(planTotalMb)

  return (
    <div className="usage-panel">
      <div className="usage-panel__head">
        <span className="usage-panel__label">
          Data usage
          {usage && <InstallBadge usage={usage} />}
        </span>
        <button
          className="usage-panel__refresh"
          onClick={onRefresh}
          disabled={loading}
          aria-label="Refresh usage"
          title="Refresh"
        >
          <Icon name="arrow-r" size={12} />
          {loading ? 'Refreshing…' : 'Refresh'}
        </button>
      </div>

      {loading && !usage && (
        <div className="usage-panel__skeleton" aria-hidden="true">
          <div className="usage-panel__bar"><div className="usage-panel__fill" style={{ width: 0 }} /></div>
        </div>
      )}

      {error && !loading && (
        <div className="usage-panel__error">
          Couldn't fetch usage right now. <button onClick={onRefresh}>Try again</button>
        </div>
      )}

      {!loading && !error && usage && (
        <>
          <div className="usage-panel__stats">
            <span className="usage-panel__used">
              {usedDisplay} <span className="usage-panel__sep">of</span> {totalDisplay}
            </span>
            {percent !== null && (
              <span className="usage-panel__percent mono">{percent.toFixed(percent < 10 ? 1 : 0)}%</span>
            )}
          </div>
          <div className="usage-panel__bar">
            <div
              className={`usage-panel__fill ${percent !== null && percent >= 85 ? 'usage-panel__fill--hot' : ''}`}
              style={{ width: `${percent ?? 0}%` }}
            />
          </div>
          <div className="usage-panel__meta mono">
            {usage.state === 'unused' && 'Not yet active — install and connect to start tracking.'}
            {usage.state === 'active' && refreshedAt && (
              <>Updated {refreshedAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</>
            )}
            {usage.state === 'depleted' && 'Plan depleted — buy a new one to keep going.'}
            {usage.state === 'expired' && 'Plan ended.'}
            {usage.state === 'unknown' && refreshedAt && (
              <>Updated {refreshedAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</>
            )}
          </div>
        </>
      )}
    </div>
  )
}

// Install-state badge derived from whichever signals are available.
// Priority order: explicit "expired" → push install events (more
// authoritative) → live JoyTel status query (always available) →
// usage-derived inference. Falls back gracefully to "Ready to install"
// when no signal points either way, so a customer who actually has
// installed the eSIM never sees a blatantly wrong "Not installed" badge.
function InstallBadge({ usage }: { usage: OrderUsage }) {
  let label: string
  let cls: string

  const hasInstallEvent = !!usage.installed_at || !!usage.enabled_at
  const liveActivated = usage.esim_status === 'activated'
  const liveExpired = usage.esim_status === 'expired'
  const usageFlowing = (usage.used_mb ?? 0) > 0

  if (usage.state === 'expired' || liveExpired) {
    label = 'Expired'
    cls = 'usage-badge--expired'
  } else if (usage.state === 'depleted') {
    label = 'Used up'
    cls = 'usage-badge--depleted'
  } else if (usageFlowing || hasInstallEvent || liveActivated) {
    label = usage.enabled_at || liveActivated ? 'Active' : 'Installed'
    cls = 'usage-badge--active'
  } else {
    label = 'Ready to install'
    cls = 'usage-badge--ready'
  }

  return <span className={`usage-badge ${cls}`}>{label}</span>
}

function formatMb(mb: number | null): string {
  if (mb === null) return '—'
  if (mb >= 1024) return `${(mb / 1024).toFixed(mb >= 10240 ? 1 : 2)} GB`
  return `${mb} MB`
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
              <span className={`badge ${o.status === 'delivered' ? 'ok' : o.status === 'failed' ? 'pop' : ''}`}>
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

function CreditTab({ balance, earnRate }: { balance: CreditBalance | null; earnRate: number }) {
  const navigate = useNavigate()
  const [history, setHistory] = useState<CreditHistoryRow[] | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    fetchCreditHistory(1, 100)
      .then((h) => !cancelled && setHistory(h.rows))
      .catch((e: Error) => !cancelled && setError(e.message))
      .finally(() => !cancelled && setLoading(false))
    return () => {
      cancelled = true
    }
  }, [])

  const earnPct = Math.round(earnRate * 100)
  const balanceCents = balance?.balance_cents ?? 0

  // Compute running balance for activity rows. The history is newest-
  // first; we walk it from oldest to newest to accumulate, then map
  // back so the rendered order stays newest-first with correct
  // running totals at each row.
  const rowsWithRunning = (history ?? []).slice().reverse().reduce<
    { row: CreditHistoryRow; running: number }[]
  >((acc, row) => {
    const prev = acc.length ? acc[acc.length - 1].running : 0
    return [...acc, { row, running: prev + row.delta_cents }]
  }, []).reverse()

  return (
    <div className="credit-tab">
      {/* Premium "membership card" hero. Gradient background, italic
          serif balance (the brand's accent type), Nimvoy mark in the
          corner, expiry chip on the lower right. */}
      <div className="credit-card" role="region" aria-label="Nimvoy credit balance">
        <div className="credit-card__top">
          <div className="credit-card__eyebrow">Balance</div>
          <div className="credit-card__mark"><LogoMark size={28} /></div>
        </div>
        <div className="credit-card__amount">{formatDollars(balanceCents)}</div>
        <div className="credit-card__bottom">
          <div className="credit-card__copy">
            Earn {earnPct}% back on every eSIM. Apply at checkout — stacks with coupons.
          </div>
          {balance?.earliest_expiry && balanceCents > 0 && (
            <div className="credit-card__chip">
              Expires {new Date(balance.earliest_expiry).toLocaleDateString(undefined, { month: 'short', year: 'numeric' })}
            </div>
          )}
        </div>
        {balanceCents > 0 && (
          <button
            className="credit-card__cta"
            onClick={() => navigate('/destinations')}
          >
            Use it on your next plan <Icon name="arrow" size={14} />
          </button>
        )}
      </div>

      <h3 style={{ fontSize: 16, fontWeight: 500, margin: '32px 0 12px', letterSpacing: '-0.01em' }}>
        Activity
      </h3>

      {loading && !history && <div className="page-stub">Loading…</div>}
      {error && (
        <div style={{ padding: 16, background: '#FFECE7', color: 'var(--pop)', borderRadius: 10, fontSize: 14 }}>
          {error}
        </div>
      )}
      {history && history.length === 0 && (
        <div
          style={{
            padding: 32,
            background: 'var(--bg-elev)',
            border: '1px solid var(--line)',
            borderRadius: 14,
            color: 'var(--ink-3)',
            textAlign: 'center',
          }}
        >
          No credit activity yet. Buy your first eSIM and earn {earnPct}% back.
        </div>
      )}
      {history && history.length > 0 && (
        <div className="credit-rows">
          {rowsWithRunning.map(({ row, running }) => (
            <div key={row.id} className="credit-row">
              <div>
                <div className="credit-row__label">{reasonLabel(row.reason)}</div>
                <div className="credit-row__sub mono">
                  {row.related_order_reference || '—'}
                  {' · '}
                  {new Date(row.created_at).toLocaleDateString()}
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div className={`credit-row__amount ${row.delta_cents >= 0 ? 'pos' : 'neg'}`}>
                  {row.delta_cents >= 0 ? '+' : ''}
                  {formatDollars(row.delta_cents)}
                </div>
                <div className="credit-row__running mono">
                  bal {formatDollars(running)}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
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
  if (status === 'delivered') return 'active'
  if (status === 'failed' || status === 'payment_failed') return 'expired'
  return 'inactive'
}

function humanStatus(status: string): string {
  // Same collapse-to-Processing rule as the customer order page.
  switch (status) {
    case 'delivered':
      return 'Ready to install'
    case 'failed':
      return 'Failed'
    case 'payment_failed':
      return 'Payment failed'
    case 'refunded':
      return 'Refunded'
    case 'created':
      return 'Awaiting payment'
    case 'payment_received':
    case 'ordering':
    case 'qr_pending':
      return 'Processing'
    default:
      return status
  }
}

function badgeLabel(status: string): string {
  if (status === 'delivered') return 'PAID'
  if (status === 'failed') return 'FAILED'
  if (status === 'payment_failed') return 'PAYMENT FAILED'
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
