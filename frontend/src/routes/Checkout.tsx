import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { Elements, PaymentElement, useElements, useStripe } from '@stripe/react-stripe-js'
import { loadStripe, type Stripe, type StripeElementsOptions } from '@stripe/stripe-js'
import { Icon } from '../components/Icon'
import { useAuth } from '../auth/AuthContext'
import { useCatalog } from '../hooks/useCatalog'
import { createPaymentIntent, fetchStripePublishableKey } from '../api/checkout'
import {
  COUNTRIES,
  REGIONAL_PLANS_META,
  formatData,
  priceDollars,
  type Plan,
} from '../data/catalog'

export default function Checkout() {
  const [params] = useSearchParams()
  const planId = params.get('plan') || ''
  const navigate = useNavigate()
  const { plans, loading: plansLoading } = useCatalog()
  const { user } = useAuth()

  const plan = useMemo(() => plans?.find((p) => p.id === planId) ?? null, [plans, planId])
  const meta = useMemo(() => (plan ? resolveMeta(plan) : null), [plan])

  // Load Stripe.js lazily once we have the publishable key from the server.
  const [stripePromise, setStripePromise] = useState<Promise<Stripe | null> | null>(null)
  useEffect(() => {
    let cancelled = false
    fetchStripePublishableKey()
      .then((key) => {
        if (cancelled) return
        setStripePromise(loadStripe(key))
      })
      .catch((err) => {
        console.error('Failed to load Stripe config', err)
      })
    return () => {
      cancelled = true
    }
  }, [])

  const [email, setEmail] = useState<string>(user?.email ?? '')
  const [intent, setIntent] = useState<{ clientSecret: string; orderReference: string } | null>(null)
  const [creatingIntent, setCreatingIntent] = useState(false)
  const [intentError, setIntentError] = useState<string | null>(null)

  // Debounced auto-create PaymentIntent once we have a valid email + plan.
  const requestedForRef = useRef<string | null>(null)
  useEffect(() => {
    if (!plan) return
    if (!isValidEmail(email)) return
    const fingerprint = `${plan.id}|${email.trim().toLowerCase()}`
    if (requestedForRef.current === fingerprint) return
    requestedForRef.current = fingerprint
    setCreatingIntent(true)
    setIntentError(null)
    const t = setTimeout(() => {
      createPaymentIntent(plan.id, email.trim())
        .then((res) =>
          setIntent({ clientSecret: res.client_secret, orderReference: res.order_reference }),
        )
        .catch((err: Error) => {
          setIntent(null)
          setIntentError(err.message || 'Failed to create payment')
          requestedForRef.current = null
        })
        .finally(() => setCreatingIntent(false))
    }, 350)
    return () => clearTimeout(t)
  }, [email, plan])

  if (!planId) {
    return (
      <div className="page-stub">
        <h1 className="h1">No plan selected</h1>
        <p className="lede" style={{ marginTop: 12 }}>
          <Link to="/destinations" style={{ color: 'var(--ink)' }}>
            Browse destinations →
          </Link>
        </p>
      </div>
    )
  }

  if (plansLoading || !plan) {
    return <div className="page-stub">Loading plan…</div>
  }

  if (!meta) {
    return (
      <div className="page-stub">
        <h1 className="h1">Plan unavailable</h1>
        <p className="lede" style={{ marginTop: 12 }}>
          This plan isn't available right now. <Link to="/destinations" style={{ color: 'var(--ink)' }}>Pick another</Link>.
        </p>
      </div>
    )
  }

  const elementsOptions: StripeElementsOptions | null = intent
    ? {
        clientSecret: intent.clientSecret,
        appearance: {
          theme: 'flat',
          variables: {
            colorPrimary: '#0B1F3A',
            colorBackground: '#FFFFFF',
            colorText: '#0B1F3A',
            colorTextSecondary: '#6B7A8E',
            colorDanger: '#E85D3C',
            fontFamily: 'Geist, -apple-system, sans-serif',
            borderRadius: '10px',
            spacingUnit: '4px',
          },
        },
      }
    : null

  return (
    <div className="checkout">
      <div className="checkout-left">
        <button
          className="btn subtle sm"
          style={{ marginBottom: 24 }}
          onClick={() => navigate(-1)}
        >
          <Icon name="arrow" size={12} /> Back
        </button>
        <h1>Complete your order</h1>
        <p className="lede muted">Your eSIM QR will land in your inbox in under a minute.</p>

        <div className="section-title">
          <span className="n">1</span> Contact
        </div>
        <div className="form-row single">
          <div>
            <label className="label">Email (we'll send your eSIM QR here)</label>
            <input
              className="input"
              placeholder="you@example.com"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
        </div>

        <div className="section-title">
          <span className="n">2</span> Payment
        </div>

        {!isValidEmail(email) && (
          <div
            style={{
              padding: 28,
              background: 'var(--bg-sunk)',
              borderRadius: 10,
              textAlign: 'center',
              fontSize: 14,
              color: 'var(--ink-2)',
            }}
          >
            Enter your email above to continue.
          </div>
        )}

        {isValidEmail(email) && intentError && (
          <div
            style={{
              padding: 16,
              background: '#FFECE7',
              color: 'var(--pop)',
              borderRadius: 10,
              fontSize: 14,
            }}
          >
            {intentError}
          </div>
        )}

        {isValidEmail(email) && !intentError && (creatingIntent || !intent || !stripePromise || !elementsOptions) && (
          <div
            style={{
              padding: 28,
              background: 'var(--bg-sunk)',
              borderRadius: 10,
              textAlign: 'center',
              fontSize: 14,
              color: 'var(--ink-2)',
            }}
          >
            Preparing secure payment form…
          </div>
        )}

        {stripePromise && elementsOptions && intent && (
          <Elements stripe={stripePromise} options={elementsOptions}>
            <PaymentForm
              amountCents={plan.price_cents}
              orderReference={intent.orderReference}
            />
          </Elements>
        )}
      </div>

      <div className="checkout-right">
        <div className="checkout-right-inner">
          <div className="section-title" style={{ marginTop: 0 }}>
            Order summary
          </div>
          <div className="summary-card">
            <div className="summary-head">
              <div className="flag">{meta.flag}</div>
              <div style={{ flex: 1 }}>
                <h3>{meta.name} eSIM</h3>
                <div className="sub">
                  {formatData(plan.data_gb)} · {plan.validity_days} days
                </div>
              </div>
            </div>
            <div className="summary-row">
              <span>Subtotal</span>
              <span className="num">${priceDollars(plan.price_cents)}</span>
            </div>
            <div className="summary-row">
              <span>Tax &amp; fees</span>
              <span className="num">$0.00</span>
            </div>
            <div className="summary-row total">
              <span>
                Total{' '}
                <span className="muted" style={{ fontSize: 13, fontWeight: 400 }}>
                  USD
                </span>
              </span>
              <span className="num">${priceDollars(plan.price_cents)}</span>
            </div>
          </div>

          <div className="guarantees">
            <div className="guarantee">
              <div className="ic">
                <Icon name="check" size={11} />
              </div>
              Instant QR delivery — typically under 60 seconds
            </div>
            <div className="guarantee">
              <div className="ic">
                <Icon name="shield" size={11} />
              </div>
              30-day money-back guarantee if eSIM fails to connect
            </div>
            <div className="guarantee">
              <div className="ic">
                <Icon name="bolt" size={11} />
              </div>
              24/7 support via email
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function PaymentForm({
  amountCents,
  orderReference,
}: {
  amountCents: number
  orderReference: string
}) {
  const stripe = useStripe()
  const elements = useElements()
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function onPay() {
    if (!stripe || !elements) return
    setSubmitting(true)
    setError(null)

    const returnUrl = `${window.location.origin}/order/${encodeURIComponent(orderReference)}`
    const { error: stripeError } = await stripe.confirmPayment({
      elements,
      confirmParams: { return_url: returnUrl },
    })

    // If we get here without a redirect, confirmPayment returned an error
    // (e.g. card declined). Stripe's redirect happens asynchronously for
    // successful payments and most auth flows.
    if (stripeError) {
      setError(stripeError.message ?? 'Payment failed. Please try again.')
      setSubmitting(false)
    }
  }

  return (
    <>
      <PaymentElement />
      {error && (
        <div
          style={{
            marginTop: 12,
            padding: 12,
            background: '#FFECE7',
            color: 'var(--pop)',
            borderRadius: 8,
            fontSize: 13,
          }}
        >
          {error}
        </div>
      )}
      <div style={{ marginTop: 24 }}>
        <button
          className="btn primary lg block"
          disabled={!stripe || !elements || submitting}
          onClick={onPay}
        >
          <Icon name="lock" size={14} />
          {submitting ? 'Processing…' : `Pay $${priceDollars(amountCents)} — Get my eSIM`}
        </button>
        <div className="secure-badge">
          <Icon name="lock" size={12} /> SECURED BY STRIPE · PCI-DSS · 256-BIT TLS
        </div>
      </div>
    </>
  )
}

function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim())
}

function resolveMeta(plan: Plan): { code: string; name: string; flag: string } | null {
  if (plan.plan_type === 'regional') {
    const r = REGIONAL_PLANS_META.find((x) => x.code === plan.country)
    return r ? { code: r.code, name: r.name, flag: r.flag } : null
  }
  const c = COUNTRIES.find((x) => x.code === plan.country)
  return c ? { code: c.code, name: c.name, flag: c.flag } : null
}
