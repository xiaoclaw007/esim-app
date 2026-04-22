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
