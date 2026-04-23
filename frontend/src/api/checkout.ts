// Stripe + checkout API helpers. These talk to the real backend in dev
// (via the Vite proxy) and prod (same-origin). The M2 plan fixture is
// read-only; payment creation always requires the live server.

import { apiFetch } from './client'

interface CheckoutConfig {
  publishable_key: string
}

interface PaymentIntentResponse {
  client_secret: string
  order_reference: string
  amount_cents: number
  currency: string
}

export async function fetchStripePublishableKey(): Promise<string> {
  const cfg = await apiFetch<CheckoutConfig>('/api/checkout/config')
  return cfg.publishable_key
}

export async function createPaymentIntent(plan_id: string, email: string): Promise<PaymentIntentResponse> {
  return apiFetch<PaymentIntentResponse>('/api/payment-intent', {
    method: 'POST',
    body: JSON.stringify({ plan_id, email }),
  })
}

export interface OrderStatus {
  reference: string
  status: string
  plan_id: string
  email: string
  amount_cents: number
  currency: string
  created_at: string
  qr_code_url: string | null
  qr_code_data: string | null
  error_message: string | null
  stripe_refund_id: string | null
}

export async function fetchOrderStatus(reference: string): Promise<OrderStatus> {
  return apiFetch<OrderStatus>(`/api/orders/${encodeURIComponent(reference)}/status`)
}
