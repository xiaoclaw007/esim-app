import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { Elements, PaymentElement, useElements, useStripe } from '@stripe/react-stripe-js'
import { loadStripe, type Stripe, type StripeElementsOptions } from '@stripe/stripe-js'
import { Icon } from '../components/Icon'
import { useAuth } from '../auth/AuthContext'
import { useCatalog } from '../hooks/useCatalog'
import {
  createPaymentIntent,
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
      if (r.valid) {
        setCoupon(r)
      } else {
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
    // Reset intent so it gets re-created at full price.
    setIntent(null)
    requestedForRef.current = null
  }

  // ---- Stripe PaymentIntent (skip entirely if coupon makes it free) ----
  const [intent, setIntent] = useState<{
    clientSecret: string
    orderReference: string
    amount: number
  } | null>(null)
  const [creatingIntent, setCreatingIntent] = useState(false)
  const [intentError, setIntentError] = useState<string | null>(null)
  const requestedForRef = useRef<string | null>(null)

  useEffect(() => {
    if (!plan) return
    if (!isValidEmail(email)) return
    // Free orders use a dedicated "Claim" button — no auto-create.
    if (isFree) return
    const fingerprint = `${plan.id}|${email.trim().toLowerCase()}|${coupon?.code || ''}`
    if (requestedForRef.current === fingerprint) return
    requestedForRef.current = fingerprint
    setCreatingIntent(true)
    setIntentError(null)
    const t = setTimeout(() => {
      createPaymentIntent(plan.id, email.trim(), coupon?.code || undefined)
        .then((res) => {
          if (!res.client_secret) {
            // Backend decided to short-circuit (e.g., coupon now makes it free
            // — race between Apply and Pay). Fall through to free flow on next
            // render.
            return
          }
          setIntent({
            clientSecret: res.client_secret,
            orderReference: res.order_reference,
            amount: res.amount_cents,
          })
        })
        .catch((err: Error) => {
          setIntent(null)
          setIntentError(err.message || 'Failed to create payment')
          requestedForRef.current = null
        })
        .finally(() => setCreatingIntent(false))
    }, 350)
    return () => clearTimeout(t)
  }, [email, plan, coupon, isFree])

  // ---- Free-order claim ----
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
      const res = await createPaymentIntent(plan.id, email.trim(), coupon.code)
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

        {/* Free-order branch: skip Stripe entirely. */}
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

        {/* Standard Stripe Elements branch */}
        {isValidEmail(email) && !isFree && intentError && (
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

        {isValidEmail(email) && !isFree && !intentError && (creatingIntent || !intent || !stripePromise) && (
          <PromptBox>Preparing secure payment form…</PromptBox>
        )}

        {!isFree && stripePromise && elementsOptions && intent && (
          <Elements stripe={stripePromise} options={elementsOptions}>
            <PaymentForm amountCents={intent.amount} orderReference={intent.orderReference} />
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

  // Auto-expand if there's already a coupon applied or an error to surface.
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

function PaymentForm({ amountCents, orderReference }: { amountCents: number; orderReference: string }) {
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
