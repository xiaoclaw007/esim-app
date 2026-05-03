import type { AuthKind, OrderStatus } from '../api/admin'

const STATUS_PILL: Record<OrderStatus, { label: string; cls: string }> = {
  created: { label: 'Pending', cls: 'warn' },
  paid: { label: 'Pending', cls: 'warn' },
  joytel_pending: { label: 'Pending', cls: 'warn' },
  snpin_received: { label: 'Pending', cls: 'warn' },
  completed: { label: 'Delivered', cls: 'ok' },
  failed: { label: 'Failed', cls: 'danger' },
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
