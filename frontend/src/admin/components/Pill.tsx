import type { AuthKind, OrderStatus } from '../api/admin'

const STATUS_PILL: Record<OrderStatus, { label: string; cls: string }> = {
  // Brief transient state — Pay was clicked, Stripe is still processing.
  created: { label: 'Awaiting payment', cls: 'warn' },
  // Stripe confirmed; webhook just landed.
  payment_received: { label: 'Processing', cls: 'warn' },
  // Submitted to JoyTel; awaiting their snPin callback.
  ordering: { label: 'Processing', cls: 'warn' },
  // snPin in hand; requested QR from RSP+; awaiting QR callback.
  qr_pending: { label: 'Processing', cls: 'warn' },
  // Done — QR delivered, email sent.
  delivered: { label: 'Delivered', cls: 'ok' },
  // Card declined / 3DS abandoned at Stripe.
  payment_failed: { label: 'Payment failed', cls: 'danger' },
  // Post-payment failure (e.g., JoyTel rejected) requiring manual review.
  failed: { label: 'Failed', cls: 'danger' },
  // Money returned (auto-refunded after JoyTel failure, or manual).
  refunded: { label: 'Refunded', cls: 'muted' },
}

export function StatusPill({ status }: { status: OrderStatus }) {
  const { label, cls } = STATUS_PILL[status] ?? { label: status, cls: 'muted' }
  return <span className={`crm-pill ${cls}`}>{label}</span>
}

const AUTH_PILL: Record<AuthKind, { label: string; cls: string }> = {
  google: { label: 'Google', cls: 'auth-google' },
  password: { label: 'Password', cls: 'auth-pwd' },
  guest: { label: 'Guest', cls: 'auth-guest' },
}

export function AuthPill({ auth }: { auth: AuthKind }) {
  const { label, cls } = AUTH_PILL[auth] ?? { label: auth, cls: 'auth-guest' }
  return <span className={`crm-auth-pill ${cls}`}>{label}</span>
}
