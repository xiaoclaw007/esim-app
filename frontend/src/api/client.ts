// Minimal typed wrapper around fetch. Uses Vite dev proxy for /api/*,
// and in prod the same-origin reverse proxy on nginx.

let accessToken: string | null = null

export function setAccessToken(t: string | null) {
  accessToken = t
}

export function getAccessToken() {
  return accessToken
}

export interface ApiError extends Error {
  status: number
  detail?: string
}

async function parseError(res: Response): Promise<ApiError> {
  let detail: string | undefined
  try {
    const data = await res.json()
    detail = typeof data?.detail === 'string' ? data.detail : JSON.stringify(data)
  } catch {
    detail = await res.text().catch(() => undefined)
  }
  const err = new Error(detail || `HTTP ${res.status}`) as ApiError
  err.status = res.status
  err.detail = detail
  return err
}

export async function apiFetch<T = unknown>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const headers = new Headers(options.headers)
  if (!headers.has('Content-Type') && options.body && !(options.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json')
  }
  if (accessToken) headers.set('Authorization', `Bearer ${accessToken}`)

  let res = await fetch(path, { ...options, headers, credentials: 'include' })

  // One-shot retry on 401/403: try refresh, then repeat.
  if ((res.status === 401 || res.status === 403) && accessToken) {
    const refreshed = await tryRefresh()
    if (refreshed) {
      headers.set('Authorization', `Bearer ${accessToken}`)
      res = await fetch(path, { ...options, headers, credentials: 'include' })
    }
  }

  if (!res.ok) throw await parseError(res)
  if (res.status === 204) return undefined as T
  return (await res.json()) as T
}

async function tryRefresh(): Promise<boolean> {
  try {
    const res = await fetch('/api/auth/refresh', {
      method: 'POST',
      credentials: 'include',
    })
    if (!res.ok) return false
    const data = (await res.json()) as { access_token?: string }
    if (data.access_token) {
      accessToken = data.access_token
      return true
    }
    return false
  } catch {
    return false
  }
}
