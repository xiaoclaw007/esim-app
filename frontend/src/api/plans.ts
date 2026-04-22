// Catalog loader. M2–M4 dev returns the static fixture; at M5 cutover we
// swap the implementation to call apiFetch('/api/plans') and pass through.
// The Plan shape already matches what backend/app/schemas.py:PlanResponse
// will return, so the swap is purely internal.

import { PLANS, type Plan } from '../data/catalog'

// Toggle to `true` to fetch from the live /api/plans endpoint during dev
// (e.g. against a seeded backend). Defaults to the fixture so the FE is
// always self-contained until M5 cutover.
const USE_LIVE_API = false

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
