import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { track } from '../api/track'

// Auto-fires a page_view event whenever the route changes. Mounted once at
// the App root (inside <BrowserRouter>) so every navigation in the SPA emits
// a ping. Skips the /admin/* tree — we don't want admin browsing to inflate
// the customer funnel.
export function usePageView(): void {
  const loc = useLocation()
  useEffect(() => {
    if (loc.pathname.startsWith('/admin')) return
    track('page_view', { path: loc.pathname })
  }, [loc.pathname, loc.search])
}
