import { useEffect, useState } from 'react'
import { loadPlans } from '../api/plans'
import type { Plan } from '../data/catalog'

interface CatalogState {
  plans: Plan[] | null
  loading: boolean
  error: Error | null
}

export function useCatalog(): CatalogState {
  const [plans, setPlans] = useState<Plan[] | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  useEffect(() => {
    let cancelled = false
    loadPlans()
      .then((p) => {
        if (!cancelled) setPlans(p)
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e : new Error(String(e)))
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  return { plans, loading, error }
}
