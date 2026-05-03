import { useEffect, useState, type FormEvent } from 'react'
import { CrmIcon } from '../components/CrmIcon'
import {
  adminApi,
  type AdminCouponCreate,
  type AdminCouponRedemption,
  type AdminCouponRow,
} from '../api/admin'

interface CommonProps {
  onClose: () => void
}

interface CreateProps extends CommonProps {
  mode: 'create'
  onCreate: (body: AdminCouponCreate) => Promise<void>
}

interface DetailProps extends CommonProps {
  mode: 'detail'
  couponId: string
  onChange: () => void
}

export function CouponDrawer(props: CreateProps | DetailProps) {
  return (
    <div className="crm-drawer-bg" onClick={props.onClose}>
      <div className="crm-drawer" onClick={(e) => e.stopPropagation()} role="dialog">
        {props.mode === 'create' ? (
          <CreateForm onClose={props.onClose} onCreate={props.onCreate} />
        ) : (
          <DetailView couponId={props.couponId} onClose={props.onClose} onChange={props.onChange} />
        )}
      </div>
    </div>
  )
}

function CreateForm({
  onClose,
  onCreate,
}: {
  onClose: () => void
  onCreate: (body: AdminCouponCreate) => Promise<void>
}) {
  const [code, setCode] = useState('')
  const [kind, setKind] = useState<'percent' | 'fixed'>('percent')
  const [value, setValue] = useState<string>('10')
  const [maxUses, setMaxUses] = useState<string>('')
  const [validFrom, setValidFrom] = useState<string>('')
  const [validUntil, setValidUntil] = useState<string>('')
  const [notes, setNotes] = useState<string>('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setErr(null)
    try {
      const numericValue = parseInt(value, 10)
      if (Number.isNaN(numericValue)) throw new Error('Value must be a number')
      // For "fixed", we ask in dollars and convert to cents.
      const cents = kind === 'percent' ? numericValue : Math.round(parseFloat(value) * 100)
      if (kind === 'percent' && (numericValue < 1 || numericValue > 100)) {
        throw new Error('Percent must be 1-100')
      }
      if (kind === 'fixed' && cents < 1) {
        throw new Error('Fixed amount must be > 0')
      }
      await onCreate({
        code: code.trim().toUpperCase(),
        kind,
        value: cents,
        max_uses: maxUses ? parseInt(maxUses, 10) : null,
        valid_from: validFrom ? new Date(validFrom).toISOString() : null,
        valid_until: validUntil ? new Date(validUntil).toISOString() : null,
        notes: notes || null,
        active: true,
      })
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <form onSubmit={onSubmit}>
      <div className="crm-drawer-h">
        <div>
          <div className="crm-eyebrow">New coupon</div>
          <h2>Create</h2>
        </div>
        <button type="button" className="crm-btn icon" onClick={onClose} aria-label="Close">
          <CrmIcon name="x" size={16} />
        </button>
      </div>

      <div className="crm-drawer-section">
        <Field label="Code">
          <input
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            placeholder="LAUNCH10"
            required
            autoCapitalize="characters"
            style={fieldStyle}
          />
        </Field>

        <Field label="Type">
          <select value={kind} onChange={(e) => setKind(e.target.value as 'percent' | 'fixed')} style={fieldStyle}>
            <option value="percent">Percent off</option>
            <option value="fixed">Fixed amount off (USD)</option>
          </select>
        </Field>

        <Field label={kind === 'percent' ? 'Percent (1-100)' : 'Amount in USD (e.g. 2.50)'}>
          <input
            type={kind === 'percent' ? 'number' : 'text'}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder={kind === 'percent' ? '10' : '2.50'}
            required
            style={fieldStyle}
          />
        </Field>

        {kind === 'percent' && parseInt(value, 10) === 100 && (
          <div style={{ fontSize: 12, color: 'var(--crm-warn)', marginTop: 4 }}>
            ⚠ 100%-off coupon — this will skip Stripe entirely and create free orders.
          </div>
        )}

        <Field label="Max uses (blank = unlimited)">
          <input
            type="number"
            value={maxUses}
            onChange={(e) => setMaxUses(e.target.value)}
            placeholder="100"
            style={fieldStyle}
          />
        </Field>

        <Field label="Valid from (optional)">
          <input
            type="datetime-local"
            value={validFrom}
            onChange={(e) => setValidFrom(e.target.value)}
            style={fieldStyle}
          />
        </Field>

        <Field label="Valid until (optional)">
          <input
            type="datetime-local"
            value={validUntil}
            onChange={(e) => setValidUntil(e.target.value)}
            style={fieldStyle}
          />
        </Field>

        <Field label="Internal notes (private)">
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Reddit launch promo · ends Friday"
            rows={3}
            style={{ ...fieldStyle, resize: 'vertical' }}
          />
        </Field>

        {err && (
          <div style={{ color: 'var(--crm-danger)', fontSize: 13, marginTop: 12 }}>{err}</div>
        )}

        <div style={{ display: 'flex', gap: 8, marginTop: 18 }}>
          <button type="button" className="crm-btn" onClick={onClose}>Cancel</button>
          <button type="submit" className="crm-btn primary" disabled={busy}>
            {busy ? 'Creating…' : 'Create coupon'}
          </button>
        </div>
      </div>
    </form>
  )
}

function DetailView({
  couponId,
  onClose,
  onChange,
}: {
  couponId: string
  onClose: () => void
  onChange: () => void
}) {
  const [coupon, setCoupon] = useState<AdminCouponRow | null>(null)
  const [redemptions, setRedemptions] = useState<AdminCouponRedemption[]>([])
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    Promise.all([adminApi.listCoupons(), adminApi.couponRedemptions(couponId)])
      .then(([all, reds]) => {
        if (cancelled) return
        setCoupon(all.find((c) => c.id === couponId) ?? null)
        setRedemptions(reds)
      })
      .catch((e: Error) => !cancelled && setError(e.message))
    return () => {
      cancelled = true
    }
  }, [couponId])

  async function handleToggle() {
    if (!coupon) return
    const updated = await adminApi.updateCoupon(coupon.id, { active: !coupon.active })
    setCoupon(updated)
    onChange()
  }

  if (error) return <div className="crm-empty"><strong>Couldn't load coupon</strong>{error}</div>
  if (!coupon) return <div className="crm-empty">Loading…</div>

  const totalDiscount = redemptions.reduce((s, r) => s + r.discount_cents, 0)
  const totalFinal = redemptions.reduce((s, r) => s + r.final_amount_cents, 0)

  return (
    <>
      <div className="crm-drawer-h">
        <div>
          <div className="crm-eyebrow">Coupon</div>
          <h2 className="mono" style={{ fontFamily: 'var(--crm-mono)' }}>{coupon.code}</h2>
        </div>
        <button type="button" className="crm-btn icon" onClick={onClose} aria-label="Close">
          <CrmIcon name="x" size={16} />
        </button>
      </div>

      <div className="crm-drawer-meta">
        <div>
          <span className="lbl">Type</span>
          <span>{coupon.kind === 'percent' ? `${coupon.value}% off` : `$${(coupon.value / 100).toFixed(2)} off`}</span>
        </div>
        <div>
          <span className="lbl">Status</span>
          <span>
            <span className={`crm-pill ${coupon.active ? 'ok' : 'muted'}`}>
              {coupon.active ? 'Active' : 'Disabled'}
            </span>
          </span>
        </div>
        <div>
          <span className="lbl">Used</span>
          <span className="num">
            {coupon.uses}
            {coupon.max_uses !== null && <span className="dim"> / {coupon.max_uses}</span>}
          </span>
        </div>
        <div>
          <span className="lbl">Created</span>
          <span>{new Date(coupon.created_at).toLocaleDateString()}</span>
        </div>
      </div>

      <div className="crm-drawer-section">
        <h4>Window</h4>
        <div style={{ fontSize: 13.5 }}>
          {coupon.valid_from || coupon.valid_until ? (
            <>
              From: {coupon.valid_from ? new Date(coupon.valid_from).toLocaleString() : '—'}
              <br />
              Until: {coupon.valid_until ? new Date(coupon.valid_until).toLocaleString() : 'never'}
            </>
          ) : (
            <span className="dim">Always valid</span>
          )}
        </div>
      </div>

      {coupon.notes && (
        <div className="crm-drawer-section">
          <h4>Notes</h4>
          <div style={{ fontSize: 13.5, whiteSpace: 'pre-wrap' }}>{coupon.notes}</div>
        </div>
      )}

      <div className="crm-drawer-section">
        <h4>Redemptions ({redemptions.length})</h4>
        {redemptions.length === 0 ? (
          <div className="dim sm">No orders have used this coupon yet.</div>
        ) : (
          <>
            <div style={{ display: 'flex', gap: 24, marginBottom: 12, fontSize: 13 }}>
              <div>
                <div className="lbl" style={{ fontSize: 11, color: 'var(--crm-text-3)' }}>DISCOUNTED</div>
                <div className="num">${(totalDiscount / 100).toFixed(2)}</div>
              </div>
              <div>
                <div className="lbl" style={{ fontSize: 11, color: 'var(--crm-text-3)' }}>NET REVENUE</div>
                <div className="num">${(totalFinal / 100).toFixed(2)}</div>
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {redemptions.slice(0, 20).map((r) => (
                <div
                  key={r.reference}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    fontSize: 12.5,
                    padding: '6px 0',
                    borderBottom: '1px solid var(--crm-border)',
                  }}
                >
                  <span className="mono">{r.reference}</span>
                  <span className="dim sm">{r.email}</span>
                  <span className="num">${(r.final_amount_cents / 100).toFixed(2)}</span>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      <div style={{ display: 'flex', gap: 8, marginTop: 18 }}>
        <button type="button" className="crm-btn" onClick={onClose}>Close</button>
        <button
          type="button"
          className={`crm-btn ${coupon.active ? '' : 'primary'}`}
          onClick={handleToggle}
        >
          {coupon.active ? 'Disable' : 'Enable'}
        </button>
      </div>
    </>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <label
        style={{
          display: 'block',
          fontSize: 11,
          fontWeight: 600,
          letterSpacing: '0.04em',
          textTransform: 'uppercase',
          color: 'var(--crm-text-3)',
          marginBottom: 4,
        }}
      >
        {label}
      </label>
      {children}
    </div>
  )
}

const fieldStyle: React.CSSProperties = {
  width: '100%',
  padding: '7px 10px',
  border: '1px solid var(--crm-border)',
  borderRadius: 6,
  background: 'var(--crm-surface)',
  color: 'var(--crm-text)',
  fontSize: 13,
  fontFamily: 'var(--crm-font)',
}
