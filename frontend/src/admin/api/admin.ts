// Typed wrappers around /api/admin/*. Mirror the Pydantic schemas in
// backend/app/routers/admin.py — keep these in sync.

import { apiFetch } from '../../api/client'

export interface AdminUser {
  id: string
  email: string
  name: string | null
  avatar_url: string | null
  referral_code: string
  is_admin: boolean
  created_at: string
}

export type OrderStatus =
  | 'created'
  | 'paid'
  | 'joytel_pending'
  | 'snpin_received'
  | 'completed'
  | 'failed'
  | 'refunded'

export type AuthKind = 'google' | 'password' | 'guest'

export interface AdminOrderRow {
  reference: string
  created_at: string
  status: OrderStatus
  plan_id: string
  plan_name: string | null
  plan_country: string | null
  plan_data_gb: number | null
  plan_validity_days: number | null
  amount_cents: number
  currency: string
  email: string
  user_id: string | null
  user_name: string | null
  user_auth: AuthKind
}

export interface AdminOrderDetail extends AdminOrderRow {
  stripe_payment_intent: string | null
  stripe_refund_id: string | null
  joytel_order_id: string | null
  sn_pin: string | null
  qr_code_data: string | null
  qr_code_url: string | null
  error_message: string | null
  updated_at: string
}

export interface AdminOrderListResponse {
  orders: AdminOrderRow[]
  total: number
  page: number
  per_page: number
}

export interface AdminCustomerRow {
  id: string
  email: string
  name: string | null
  auth: AuthKind
  signup: string
  orders_count: number
  ltv_cents: number
}

export interface AdminCustomerListResponse {
  customers: AdminCustomerRow[]
  total: number
  page: number
  per_page: number
}

export interface AdminCountryRow {
  code: string
  name: string
  flag: string
  plan_count: number
}

export interface AdminPlanRow {
  id: string
  joytel_sku: string
  name: string
  country: string
  region: string
  plan_type: string
  data_gb: number
  validity_days: number
  price_cents: number
  currency: string
  active: boolean
  sold_30d: number
}

export interface AdminTopDestination {
  code: string
  name: string
  flag: string
  orders: number
  revenue_cents: number
}

export interface AdminQueueItem {
  type: 'failed' | 'refund' | 'ping'
  title: string
  sub: string
  reference?: string
}

export interface AdminKpiResponse {
  revenue_cents_30d: number
  revenue_cents_prev: number
  orders_30d: number
  orders_prev: number
  completed_esims: number
  failed_orders: number
  refunded_orders: number
  top_destinations: AdminTopDestination[]
  queue: AdminQueueItem[]
}

export interface AdminRevenuePoint {
  date: string
  orders: number
  revenue_cents: number
}

export const adminApi = {
  me: () => apiFetch<AdminUser>('/api/admin/me'),
  listOrders: (params: { q?: string; status?: string; page?: number; per_page?: number } = {}) => {
    const qs = new URLSearchParams()
    if (params.q) qs.set('q', params.q)
    if (params.status) qs.set('status', params.status)
    qs.set('page', String(params.page ?? 1))
    qs.set('per_page', String(params.per_page ?? 50))
    return apiFetch<AdminOrderListResponse>(`/api/admin/orders?${qs}`)
  },
  getOrder: (ref: string) => apiFetch<AdminOrderDetail>(`/api/admin/orders/${encodeURIComponent(ref)}`),
  listCustomers: (params: { q?: string; auth?: AuthKind; page?: number; per_page?: number } = {}) => {
    const qs = new URLSearchParams()
    if (params.q) qs.set('q', params.q)
    if (params.auth) qs.set('auth', params.auth)
    qs.set('page', String(params.page ?? 1))
    qs.set('per_page', String(params.per_page ?? 50))
    return apiFetch<AdminCustomerListResponse>(`/api/admin/customers?${qs}`)
  },
  listCountries: () => apiFetch<AdminCountryRow[]>('/api/admin/catalog/countries'),
  listPlans: (country?: string) =>
    apiFetch<AdminPlanRow[]>(`/api/admin/catalog/plans${country ? `?country=${country}` : ''}`),
  kpis: () => apiFetch<AdminKpiResponse>('/api/admin/kpis'),
  revenueSeries: (days = 30) => apiFetch<AdminRevenuePoint[]>(`/api/admin/analytics/revenue-series?days=${days}`),
}
