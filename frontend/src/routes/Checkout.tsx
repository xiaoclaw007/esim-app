import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { Elements, PaymentElement, useElements, useStripe } from '@stripe/react-stripe-js'
import { loadStripe, type Stripe, type StripeElementsOptions } from '@stripe/stripe-js'
import { Icon } from '../components/Icon'
import { useAuth } from '../auth/AuthContext'
import { useCatalog } from '../hooks/useCatalog'
import {
  createOrder,
  fetchStripePublishableKey,
  validateCoupon,
  type CouponValidateResponse,
} from '../api/checkout'
import {
  COUNTRIES,
  REGIONAL_PLANS_META,
  formatData,
  priceDollars,
  type Plan,
} from '../data/catalog'

// Stripe Elements is mounted in "deferred PaymentMethod" mode — we declare
// just the amount + currency at mount, no clientSecret. The PaymentIntent
// (and our Order row) is only created when the customer clicks Pay. See
// project_orders_redesign memory for why.

export default function Checkout() {
  const [params] = useSearchParams()
  const planId = params.get('plan') || ''
  const navigate = useNavigate()
  const { plans, loading: plansLoading } = useCatalog()
  const { user } = useAuth()

  const plan = useMemo(() => plans?.find((p) => p.id === planId) ?? null, [plans, planId])
  const meta = useMemo(() => (plan ? resolveMeta(plan) : null), [plan])

  // Stripe.js loaded lazily once we have the publishable key.
  const [stripePromise, setStripePromise] = useState<Promise<Stripe | null> | null>(null)
  useEffect(() => {
    let cancelled = false
    fetchStripePublishableKey()
      .then((key) => !cancelled && setStripePromise(loadStripe(key)))
      .catch((err) => console.error('Failed to load Stripe config', err))
    return () => {
      cancelled = true
    }
  }, [])

  const [email, setEmail] = useState<string>(user?.email ?? '')

  // ---- Coupon state ----
  const [couponInput, setCouponInput] = useState('')
  const [coupon, setCoupon] = useState<CouponValidateResponse | null>(null)
  const [couponBusy, setCouponBusy] = useState(false)
  const [couponError, setCouponError] = useState<string | null>(null)
  const isFree = coupon?.valid && coupon.free

  async function onApplyCoupon() {
    if (!plan || !couponInput.trim()) return
    setCouponBusy(true)
    setCouponError(null)
    try {
      const r = await validateCoupon(couponInput.trim(), plan.id)
      if (r.valid) setCoupon(r)
      else {
        setCoupon(null)
        setCouponError(r.error || 'Invalid code')
      }
    } catch (e) {
      setCouponError(e instanceof Error ? e.message : 'Failed to validate coupon')
    } finally {
      setCouponBusy(false)
    }
  }

  function onRemoveCoupon() {
    setCoupon(null)
    setCouponInput('')
    setCouponError(null)
  }

  // ---- Free-order claim (100%-off coupon, no Stripe involved) ----
  const [claiming, setClaiming] = useState(false)
  const [claimError, setClaimError] = useState<string | null>(null)
  async function onClaimFree() {
    if (!plan || !coupon?.code) return
    if (!isValidEmail(email)) {
      setClaimError('Enter a valid email above')
      return
    }
    setClaiming(true)
    setClaimError(null)
    try {
      const res = await createOrder(plan.id, email.trim(), coupon.code)
      if (!res.free || !res.order_reference) {
        throw new Error("Couldn't claim free order — please try again")
      }
      navigate(`/order/${encodeURIComponent(res.order_reference)}`)
    } catch (e) {
      setClaimError(e instanceof Error ? e.message : String(e))
      setClaiming(false)
    }
  }

  // ---- Early returns ----
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
  if (plansLoading || !plan) return <div className="page-stub">Loading plan…</div>
  if (!meta) {
    return (
      <div className="page-stub">
        <h1 className="h1">Plan unavailable</h1>
        <p className="lede" style={{ marginTop: 12 }}>
          This plan isn't available right now.{' '}
          <Link to="/destinations" style={{ color: 'var(--ink)' }}>Pick another</Link>.
        </p>
      </div>
    )
  }

  const subtotal = plan.price_cents
  const discount = coupon?.valid ? coupon.discount_cents : 0
  const total = Math.max(0, subtotal - discount)

  // Deferred Elements options. Amount is initial-only; PaymentForm calls
  // elements.update({ amount }) when the coupon changes.
  const elementsOptions: StripeElementsOptions = {
    mode: 'payment',
    amount: Math.max(50, total), // Stripe requires >= 50 cents at mount; if free we never call confirmPayment
    currency: plan.currency,
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

  return (
    <div className="checkout">
      <div className="checkout-left">
        <button className="btn subtle sm" style={{ marginBottom: 24 }} onClick={() => navigate(-1)}>
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

        <CouponRow
          input={couponInput}
          setInput={setCouponInput}
          coupon={coupon}
          busy={couponBusy}
          error={couponError}
          onApply={onApplyCoupon}
          onRemove={onRemoveCoupon}
        />

        <div className="section-title">
          <span className="n">2</span> Payment
        </div>

        {!isValidEmail(email) && (
          <PromptBox>Enter your email above to continue.</PromptBox>
        )}

        {/* Free-order branch: no Stripe needed */}
        {isValidEmail(email) && isFree && (
          <div
            style={{
              padding: 22,
              background: 'var(--bg-sunk)',
              borderRadius: 10,
              border: '1px solid var(--line)',
            }}
          >
            <div style={{ marginBottom: 12, fontSize: 14, color: 'var(--ink)' }}>
              <strong>Coupon {coupon?.code} covers this order — no payment needed.</strong>
            </div>
            {claimError && (
              <div style={{ color: 'var(--pop)', fontSize: 13, marginBottom: 10 }}>{claimError}</div>
            )}
            <button
              className="btn primary lg block"
              disabled={claiming}
              onClick={onClaimFree}
            >
              <Icon name="check" size={14} />
              {claiming ? 'Claiming…' : 'Claim my free eSIM'}
            </button>
          </div>
        )}

        {/* Standard Stripe Elements branch — deferred mode */}
        {isValidEmail(email) && !isFree && stripePromise && (
          <Elements stripe={stripePromise} options={elementsOptions}>
            <PaymentForm
              planId={plan.id}
              email={email.trim()}
              couponCode={coupon?.code || undefined}
              totalCents={total}
              currency={plan.currency}
            />
          </Elements>
        )}

        {isValidEmail(email) && !isFree && !stripePromise && (
          <PromptBox>Loading payment form…</PromptBox>
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
              <span className="num">${priceDollars(subtotal)}</span>
            </div>
            {discount > 0 && (
              <div className="summary-row" style={{ color: 'var(--ok)' }}>
                <span>Coupon {coupon?.code}</span>
                <span className="num">−${priceDollars(discount)}</span>
              </div>
            )}
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
              <span className="num">${priceDollars(total)}</span>
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

// PaymentForm is rendered inside <Elements>. Calls elements.update({ amount })
// when the coupon-adjusted total changes; on Pay click it submits the form,
// creates the Order via /api/orders (which also creates the PaymentIntent),
// then calls stripe.confirmPayment with the returned client_secret.
function PaymentForm({
  planId,
  email,
  couponCode,
  totalCents,
  currency,
}: {
  planId: string
  email: string
  couponCode?: string
  totalCents: number
  currency: string
}) {
  const stripe = useStripe()
  const elements = useElements()
  const navigate = useNavigate()
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // When the coupon is applied/removed, push the new amount to Elements so
  // the wallet buttons (Apple Pay etc.) display the right total.
  useEffect(() => {
    if (!elements) return
    elements.update({ amount: Math.max(50, totalCents), currency })
  }, [elements, totalCents, currency])

  async function onPay() {
    if (!stripe || !elements) return
    setSubmitting(true)
    setError(null)

    // 1. Client-side validate the form (formats, required fields, etc.)
    const { error: submitError } = await elements.submit()
    if (submitError) {
      setError(submitError.message ?? 'Please check your card details')
      setSubmitting(false)
      return
    }

    // 2. Create the Order + PaymentIntent on our backend.
    let orderResp
    try {
      orderResp = await createOrder(planId, email, couponCode)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not start payment')
      setSubmitting(false)
      return
    }

    // Free-order shouldn't reach here (handled by separate "Claim free" button),
    // but guard anyway so a race doesn't drop the user.
    if (orderResp.free) {
      navigate(`/order/${encodeURIComponent(orderResp.order_reference)}`)
      return
    }

    if (!orderResp.client_secret) {
      setError('Payment system returned an unexpected response')
      setSubmitting(false)
      return
    }

    // 3. Confirm payment with Stripe. Stripe redirects to return_url on success
    //    (or surfaces an error here on synchronous failure like a hard decline).
    const returnUrl = `${window.location.origin}/order/${encodeURIComponent(orderResp.order_reference)}`
    const { error: stripeError } = await stripe.confirmPayment({
      elements,
      clientSecret: orderResp.client_secret,
      confirmParams: { return_url: returnUrl },
    })

    if (stripeError) {
      setError(stripeError.message ?? 'Payment failed. Please try again.')
      setSubmitting(false)
      // Note: the Order row is now in 'created' state. Stripe will fire
      // payment_intent.payment_failed shortly after, which our webhook
      // catches and transitions the row to 'payment_failed'. The user
      // can retry — that creates a fresh Order + PaymentIntent.
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
          {submitting ? 'Processing…' : `Pay $${priceDollars(totalCents)} — Get my eSIM`}
        </button>
        <div className="secure-badge">
          <Icon name="lock" size={12} /> SECURED BY STRIPE · PCI-DSS · 256-BIT TLS
        </div>
      </div>
    </>
  )
}

function PromptBox({ children }: { children: React.ReactNode }) {
  return (
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
      {children}
    </div>
  )
}

function CouponRow({
  input,
  setInput,
  coupon,
  busy,
  error,
  onApply,
  onRemove,
}: {
  input: string
  setInput: (v: string) => void
  coupon: CouponValidateResponse | null
  busy: boolean
  error: string | null
  onApply: () => void
  onRemove: () => void
}) {
  const [expanded, setExpanded] = useState(false)
  const applied = coupon?.valid
  const open = expanded || applied || !!error

  return (
    <div style={{ marginTop: 16, marginBottom: 8 }}>
      {!open && (
        <button
          onClick={() => setExpanded(true)}
          style={{
            background: 'transparent',
            border: 0,
            padding: 0,
            color: 'var(--ink-2)',
            fontSize: 14,
            fontWeight: 500,
            cursor: 'pointer',
            textDecoration: 'underline',
            textDecorationColor: 'var(--line-strong)',
            textUnderlineOffset: 4,
          }}
          onMouseOver={(e) => {
            e.currentTarget.style.color = 'var(--ink)'
            e.currentTarget.style.textDecorationColor = 'var(--ink)'
          }}
          onMouseOut={(e) => {
            e.currentTarget.style.color = 'var(--ink-2)'
            e.currentTarget.style.textDecorationColor = 'var(--line-strong)'
          }}
        >
          + Have a coupon code?
        </button>
      )}

      {open && !applied && (
        <div>
          <label className="label">Coupon code</label>
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              className="input"
              placeholder="e.g. LAUNCH10"
              value={input}
              onChange={(e) => setInput(e.target.value.toUpperCase())}
              onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), onApply())}
              style={{ flex: 1 }}
              autoCapitalize="characters"
            />
            <button className="btn ghost" onClick={onApply} disabled={busy || !input.trim()}>
              {busy ? '…' : 'Apply'}
            </button>
          </div>
          {error && <div style={{ color: 'var(--pop)', fontSize: 13, marginTop: 6 }}>{error}</div>}
        </div>
      )}

      {applied && coupon && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            padding: '10px 14px',
            background: '#E8F3EC',
            border: '1px solid #C2DFCB',
            borderRadius: 8,
            fontSize: 14,
            color: 'var(--ok)',
          }}
        >
          <Icon name="check" size={14} />
          <span>
            <strong>{coupon.code}</strong> applied —{' '}
            {coupon.free
              ? 'order is free'
              : `$${(coupon.discount_cents / 100).toFixed(2)} off`}
          </span>
          <button
            className="btn ghost sm"
            onClick={onRemove}
            style={{ marginLeft: 'auto', color: 'var(--ink-2)' }}
          >
            Remove
          </button>
        </div>
      )}
    </div>
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
