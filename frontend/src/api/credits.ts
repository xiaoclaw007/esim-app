import { apiFetch } from './client'

export interface CreditBalance {
  balance_cents: number
  earliest_expiry: string | null
  earn_rate: number  // 0.10 = 10%; lets the UI render dynamic copy
}

export interface CreditHistoryRow {
  id: string
  delta_cents: number  // positive = earn / refund-back; negative = spend / reverse / expire
  reason: string
  related_order_reference: string | null
  expires_at: string | null
  created_at: string
}

export interface CreditHistory {
  rows: CreditHistoryRow[]
  total: number
}

export async function fetchCreditBalance(): Promise<CreditBalance> {
  return apiFetch<CreditBalance>('/api/credits/balance')
}

export async function fetchCreditHistory(page = 1, perPage = 50): Promise<CreditHistory> {
  return apiFetch<CreditHistory>(`/api/credits/history?page=${page}&per_page=${perPage}`)
}

export function formatDollars(cents: number): string {
  const sign = cents < 0 ? '-' : ''
  return `${sign}$${(Math.abs(cents) / 100).toFixed(2)}`
}

// Map raw ledger reason → human-readable phrase for the history UI.
export function reasonLabel(reason: string): string {
  switch (reason) {
    case 'order_earned': return 'Earned from order'
    case 'order_spent': return 'Used on order'
    case 'order_refunded': return 'Reversed (refund)'
    case 'order_refunded_spend': return 'Returned (refund)'
    case 'expired': return 'Expired'
    case 'admin_grant': return 'Granted by Nimvoy'
    default: return reason
  }
}
