// Stripe + checkout API helpers. These talk to the real backend in dev
// (via the Vite proxy) and prod (same-origin). The M2 plan fixture is
// read-only; payment creation always requires the live server.

import { apiFetch } from './client'

interface CheckoutConfig {
  publishable_key: string
}

// Backend returns one of two shapes from /api/payment-intent:
//   - paid via Stripe → has client_secret
//   - 100%-off coupon → free=true, no client_secret
// Frontend branches on `free`.
export interface PaymentIntentResponse {
  client_secret: string | null
  order_reference: string
  amount_cents: number
  currency: string
  discount_cents: number
  coupon_code: string | null
  free: boolean
}

export interface CouponValidateResponse {
  valid: boolean
  code: string | null
  discount_cents: number
  final_cents: number
  free: boolean
  error: string | null
}

export async function fetchStripePublishableKey(): Promise<string> {
  const cfg = await apiFetch<CheckoutConfig>('/api/checkout/config')
  return cfg.publishable_key
}

/** Create an Order at click-Pay time. Returns either:
 *  - PaymentIntentResponse (free=false) → frontend continues with stripe.confirmPayment
 *  - FreeOrderResponse (free=true) → frontend navigates straight to /order/<ref>
 */
export async function createOrder(
  plan_id: string,
  email: string,
  coupon_code?: string,
): Promise<PaymentIntentResponse> {
  return apiFetch<PaymentIntentResponse>('/api/orders', {
    method: 'POST',
    body: JSON.stringify(coupon_code ? { plan_id, email, coupon_code } : { plan_id, email }),
  })
}

export async function validateCoupon(code: string, plan_id: string): Promise<CouponValidateResponse> {
  return apiFetch<CouponValidateResponse>('/api/checkout/validate-coupon', {
    method: 'POST',
    body: JSON.stringify({ code, plan_id }),
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
