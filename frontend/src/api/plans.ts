// Catalog loader. M2–M4 dev returns the static fixture; at M5 cutover we
// swap the implementation to call apiFetch('/api/plans') and pass through.
// The Plan shape already matches what backend/app/schemas.py:PlanResponse
// will return, so the swap is purely internal.

import { PLANS, type Plan } from '../data/catalog'

// Source of plan data. At M5 cutover we flipped to the live API; the
// fixture in src/data/catalog.ts stays around as an offline fallback and
// as a reference for what /api/plans is expected to return.
const USE_LIVE_API = true

let cache: Plan[] | null = null

export async function loadPlans(): Promise<Plan[]> {
  if (cache) return cache
  if (USE_LIVE_API) {
    const res = await fetch('/api/plans', { credentials: 'include' })
    if (!res.ok) throw new Error(`/api/plans ${res.status}`)
    cache = (await res.json()) as Plan[]
  } else {
    cache = PLANS
  }
  return cache
}

export function clearPlanCache() {
  cache = null
}
