import { apiFetch } from './client'

export interface OrderDetail {
  reference: string
  status: string
  plan_id: string
  email: string
  amount_cents: number
  currency: string
  created_at: string
  updated_at: string
  qr_code_url: string | null
  qr_code_data: string | null
}

interface OrderListResponse {
  orders: OrderDetail[]
  total: number
  page: number
  per_page: number
}

export async function listOrders(page = 1, per_page = 20): Promise<OrderListResponse> {
  return apiFetch<OrderListResponse>(`/api/orders?page=${page}&per_page=${per_page}`)
}

export interface OrderUsage {
  used_mb: number | null
  total_mb: number | null
  left_mb: number | null
  percent: number | null
  expires_at: string | null
  state: 'unused' | 'active' | 'expired' | 'depleted' | 'unknown'
  // Install-lifecycle signals, may be null if JoyTel hasn't provided
  // either the push (install events) or pull (status query) signal yet.
  esim_status: 'unknown' | 'activated' | 'expired' | null
  installed_at: string | null
  enabled_at: string | null
}

export async function fetchOrderUsage(reference: string): Promise<OrderUsage> {
  return apiFetch<OrderUsage>(`/api/orders/${encodeURIComponent(reference)}/usage`)
}
