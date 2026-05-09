import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Icon } from './Icon'

// Site-wide promotional bar that sits above the nav. Promotes the
// 10%-back credit program to visitors before they scroll. Dismissible
// per browser via localStorage so returning customers aren't nagged.
//
// The dismiss key is versioned so we can ship a new promotion later
// (different copy / amount / destination) and re-show even to people
// who dismissed the previous one — bump the suffix on `STORAGE_KEY`.

const STORAGE_KEY = 'nimvoy_top_banner_dismissed_v1'

export function TopBanner() {
  const navigate = useNavigate()
  const [dismissed, setDismissed] = useState(true)  // start hidden until we read storage

  useEffect(() => {
    // Read on mount only — avoids SSR mismatch and avoids re-flashing
    // the banner if React rerenders for unrelated reasons.
    try {
      setDismissed(localStorage.getItem(STORAGE_KEY) === '1')
    } catch {
      // localStorage blocked (private mode, certain browsers) — show
      // the banner; it'll just live for the session.
      setDismissed(false)
    }
  }, [])

  function dismiss(e: React.MouseEvent) {
    e.stopPropagation()  // don't trigger the bar's main click
    setDismissed(true)
    try {
      localStorage.setItem(STORAGE_KEY, '1')
    } catch {
      // Best-effort; if storage isn't available the banner just
      // stays dismissed for the session.
    }
  }

  if (dismissed) return null

  return (
    <button
      type="button"
      className="top-banner"
      onClick={() => navigate('/destinations')}
      aria-label="Earn 10% back as Nimvoy credit — browse destinations"
    >
      <span className="top-banner__inner">
        <span className="top-banner__star" aria-hidden="true">✦</span>
        <span className="top-banner__copy">
          <strong>Earn 10% back</strong> as Nimvoy credit on every plan —{' '}
          <span className="top-banner__cta">browse destinations</span>
        </span>
        <Icon name="arrow" size={12} />
      </span>
      <button
        type="button"
        className="top-banner__close"
        onClick={dismiss}
        aria-label="Dismiss this banner"
      >
        <Icon name="x" size={11} />
      </button>
    </button>
  )
}
