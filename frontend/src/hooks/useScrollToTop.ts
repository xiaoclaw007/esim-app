import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'

// Reset window scroll to top whenever the pathname changes. React Router
// doesn't do this automatically — without it, navigating from a scrolled
// position on one page lands you mid-page on the next, which feels like
// "clicking did nothing" since the new page's hero is above the fold.
//
// Mounted once at the App root.
export function useScrollToTop(): void {
  const { pathname } = useLocation()
  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' as ScrollBehavior })
  }, [pathname])
}
