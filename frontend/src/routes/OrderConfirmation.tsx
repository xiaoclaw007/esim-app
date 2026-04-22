import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { Icon } from '../components/Icon'
import { QrCode } from '../components/QrCode'
import { fetchOrderStatus, type OrderStatus } from '../api/checkout'
import { useCatalog } from '../hooks/useCatalog'
import {
  COUNTRIES,
  REGIONAL_PLANS_META,
  formatData,
  priceDollars,
  type Plan,
} from '../data/catalog'

type Tab = 'ios' | 'android' | 'manual'

export default function OrderConfirmation() {
  const { id } = useParams<{ id: string }>()
  const [params] = useSearchParams()
  const redirectStatus = params.get('redirect_status')
  const navigate = useNavigate()
  const { plans } = useCatalog()

  const [order, setOrder] = useState<OrderStatus | null>(null)
  const [pollError, setPollError] = useState<string | null>(null)
  const [tab, setTab] = useState<Tab>('ios')

  // Poll /api/orders/:ref/status until we hit a terminal state. Gentle
  // backoff from 2s → 5s once we're past the first minute — JoyTel
  // fulfillment is typically ~10s but has been seen to take longer under
  // load.
  useEffect(() => {
    if (!id) return
    let cancelled = false
    let attempts = 0
    let timer: ReturnType<typeof setTimeout> | null = null

    async function tick() {
      if (cancelled) return
      attempts += 1
      try {
        const o = await fetchOrderStatus(id!)
        if (cancelled) return
        setOrder(o)
        setPollError(null)
        if (o.status === 'completed' || o.status === 'failed') return
      } catch (e) {
        if (!cancelled) setPollError(e instanceof Error ? e.message : String(e))
      }
      const delay = attempts < 30 ? 2000 : 5000
      timer = setTimeout(tick, delay)
    }
    tick()

    return () => {
      cancelled = true
      if (timer) clearTimeout(timer)
    }
  }, [id])

  const plan = useMemo<Plan | null>(
    () => (order && plans ? plans.find((p) => p.id === order.plan_id) ?? null : null),
    [order, plans],
  )
  const destination = useMemo(() => (plan ? resolveMeta(plan) : null), [plan])

  if (!id) {
    return (
      <div className="confirm">
        <h1>Order reference missing</h1>
      </div>
    )
  }

  if (redirectStatus && redirectStatus !== 'succeeded') {
    return (
      <div className="confirm">
        <div
          className="ok-mark"
          style={{ background: '#FFECE7', color: 'var(--pop)' }}
        >
          <Icon name="x" size={28} />
        </div>
        <h1>Payment was not completed</h1>
        <p className="lede muted" style={{ maxWidth: '50ch' }}>
          Stripe returned status <code>{redirectStatus}</code>. No charge was
          made. You can{' '}
          <Link to="/destinations" style={{ color: 'var(--ink)' }}>
            pick another plan
          </Link>{' '}
          or retry checkout.
        </p>
      </div>
    )
  }

  if (!order) {
    return (
      <div className="confirm">
        <h1>Confirming your payment…</h1>
        <p className="lede muted" style={{ maxWidth: '50ch' }}>
          Order <span className="num">{id}</span> — hang tight, we're loading
          the details.
        </p>
        {pollError && (
          <p style={{ color: 'var(--pop)', marginTop: 12 }}>{pollError}</p>
        )}
      </div>
    )
  }

  if (order.status === 'failed') {
    return (
      <div className="confirm">
        <div
          className="ok-mark"
          style={{ background: '#FFECE7', color: 'var(--pop)' }}
        >
          <Icon name="x" size={28} />
        </div>
        <h1>Something went wrong</h1>
        <p className="lede muted" style={{ maxWidth: '50ch' }}>
          Order <span className="num">{order.reference}</span> couldn't be
          fulfilled. {order.error_message || 'Please contact support.'}
        </p>
      </div>
    )
  }

  const qrValue = order.qr_code_data || order.qr_code_url || null
  const finishing = order.status !== 'completed'

  const iosSteps = [
    'Open Settings → Cellular → Add eSIM',
    "Choose 'Use QR Code' and scan the code below",
    destination ? `Label the line 'Nimvoy ${destination.name}'` : "Label the line 'Nimvoy eSIM'",
    'When you land, enable Data Roaming for this line',
  ]
  const androidSteps = [
    'Open Settings → Network → SIMs → Add eSIM',
    'Scan the QR code below with your camera',
    'Confirm the carrier profile',
    'Enable the Nimvoy line when you arrive',
  ]
  const manualLPA = qrValue && qrValue.startsWith('LPA:') ? qrValue : null
  const manualParts = manualLPA ? manualLPA.split('$') : null
  const manualSteps: string[] = manualParts
    ? [
        'Settings → Add eSIM → Enter details manually',
        `SM-DP+ address: ${manualParts[1] || '—'}`,
        `Activation code: ${manualParts[2] || '—'}`,
        'Confirmation code: leave blank',
      ]
    : [
        'Settings → Add eSIM → Enter details manually',
        'SM-DP+ address and activation code are in your email',
        'Confirmation code: leave blank',
      ]

  const steps = tab === 'ios' ? iosSteps : tab === 'android' ? androidSteps : manualSteps

  return (
    <div className="confirm">
      <div className="ok-mark">
        <Icon name="check" size={28} />
      </div>
      <h1>{finishing ? 'Finalizing your eSIM…' : "You're all set, traveler."}</h1>
      <p className="lede muted" style={{ maxWidth: '50ch', margin: '0 auto 24px' }}>
        {destination ? (
          <>
            Your {destination.name} eSIM is {finishing ? 'being provisioned' : 'ready'}.{' '}
            {finishing
              ? 'Typically under 60 seconds.'
              : `We've also emailed the QR and a receipt for $${priceDollars(order.amount_cents)}.`}
          </>
        ) : (
          <>
            Order <span className="num">{order.reference}</span> —{' '}
            {finishing ? 'provisioning…' : 'ready to install.'}
          </>
        )}
      </p>

      <div
        style={{
          display: 'inline-flex',
          gap: 32,
          padding: '16px 24px',
          border: '1px solid var(--line)',
          borderRadius: 12,
          background: 'var(--bg-elev)',
          marginBottom: 40,
          fontSize: 13.5,
          textAlign: 'left',
        }}
      >
        <OrderDetail k="Order" v={order.reference} mono />
        <OrderDetail
          k="Destination"
          v={destination ? `${destination.flag} ${destination.name}` : order.plan_id}
        />
        <OrderDetail
          k="Plan"
          v={plan ? `${formatData(plan.data_gb)} · ${plan.validity_days}d` : '—'}
        />
        <OrderDetail k="Status" v={humanStatus(order.status)} mono />
      </div>

      <div className="install" style={{ textAlign: 'left' }}>
        <div className="install-head">
          <button className={tab === 'ios' ? 'active' : ''} onClick={() => setTab('ios')}>
            iPhone / iPad
          </button>
          <button
            className={tab === 'android' ? 'active' : ''}
            onClick={() => setTab('android')}
          >
            Android
          </button>
          <button className={tab === 'manual' ? 'active' : ''} onClick={() => setTab('manual')}>
            Manual entry
          </button>
        </div>
        <div className="install-body">
          <ol className="install-steps">
            {steps.map((s, i) => (
              <li key={i}>{s}</li>
            ))}
          </ol>
          <div className="qr-box">
            {qrValue ? (
              <QrCode value={qrValue} size={172} />
            ) : (
              <div
                style={{
                  width: 172,
                  height: 172,
                  display: 'grid',
                  placeItems: 'center',
                  color: 'var(--ink-3)',
                  fontSize: 12,
                  fontFamily: 'var(--mono)',
                }}
              >
                Generating…
              </div>
            )}
            <div className="cap">
              {qrValue ? 'SCAN TO INSTALL' : humanStatus(order.status).toUpperCase()}
            </div>
          </div>
        </div>
        <div
          style={{
            marginTop: 24,
            display: 'flex',
            gap: 8,
            justifyContent: 'flex-end',
          }}
        >
          <button className="btn primary sm" onClick={() => navigate('/account')}>
            Go to My eSIMs
          </button>
        </div>
      </div>

      <div style={{ marginTop: 48 }}>
        <button className="btn subtle" onClick={() => navigate('/destinations')}>
          Browse another destination <Icon name="arrow" size={14} />
        </button>
      </div>
    </div>
  )
}

function OrderDetail({ k, v, mono }: { k: string; v: string; mono?: boolean }) {
  return (
    <div>
      <div
        style={{
          fontFamily: 'var(--mono)',
          fontSize: 11,
          color: 'var(--ink-3)',
          textTransform: 'uppercase',
          letterSpacing: '0.08em',
        }}
      >
        {k}
      </div>
      <div
        style={{
          fontWeight: 500,
          fontSize: 14,
          marginTop: 2,
          fontFamily: mono ? 'var(--mono)' : undefined,
        }}
      >
        {v}
      </div>
    </div>
  )
}

function humanStatus(status: string): string {
  switch (status) {
    case 'created':
      return 'Waiting for payment'
    case 'paid':
      return 'Payment received'
    case 'joytel_pending':
      return 'Provisioning'
    case 'snpin_received':
      return 'Generating QR'
    case 'completed':
      return 'Ready to install'
    case 'failed':
      return 'Failed'
    default:
      return status
  }
}

function resolveMeta(plan: Plan): { code: string; name: string; flag: string } | null {
  if (plan.plan_type === 'regional') {
    const r = REGIONAL_PLANS_META.find((x) => x.code === plan.country)
    return r ? { code: r.code, name: r.name, flag: r.flag } : null
  }
  const c = COUNTRIES.find((x) => x.code === plan.country)
  return c ? { code: c.code, name: c.name, flag: c.flag } : null
}
