import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'

// Scroll to the right place on every route change.
// - If the URL has a hash (e.g. /#how-it-works), scroll to the element
//   with that id. Smooth scroll feels right for in-page jumps.
// - Otherwise, jump to the top of the page (instant — page transitions
//   shouldn't feel like a smooth scroll back up).
// React Router doesn't do either by default; without this hook, hash
// links on the nav (How it works, Support) didn't actually scroll, and
// clicking a card mid-page landed you mid-page on the next route.
//
// Mounted once at the App root.
export function useScrollToTop(): void {
  const { pathname, hash } = useLocation()
  useEffect(() => {
    if (hash) {
      // requestAnimationFrame defers one frame so the destination
      // route's sections have committed to the DOM before we look up
      // the id (matters when arriving from a different route).
      requestAnimationFrame(() => {
        const el = document.getElementById(hash.slice(1))
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'start' })
        } else {
          window.scrollTo({ top: 0, left: 0, behavior: 'instant' as ScrollBehavior })
        }
      })
    } else {
      window.scrollTo({ top: 0, left: 0, behavior: 'instant' as ScrollBehavior })
    }
  }, [pathname, hash])
}
