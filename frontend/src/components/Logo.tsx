// Default logo: "orbit" mark + wordmark, navigates to "/" on click.
// The handoff ships 7 mark variants + 8 wordmark variants — we're shipping
// one of each for M1 and can add alternates later if the user picks a
// different variant from the tweaks panel.
import { Link } from 'react-router-dom'

interface LogoMarkProps {
  size?: number
}

export function LogoMark({ size = 30 }: LogoMarkProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" aria-label="Nimvoy">
      <circle cx="20" cy="20" r="19" fill="var(--ink)" />
      <ellipse
        cx="20"
        cy="20"
        rx="15"
        ry="6"
        fill="none"
        stroke="var(--bg)"
        strokeWidth="1"
        opacity="0.35"
        transform="rotate(-20 20 20)"
      />
      <path
        d="M13 27 V13 L27 27 V13"
        stroke="var(--bg)"
        strokeWidth="2.4"
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="33" cy="13" r="2.3" fill="var(--pop)" />
    </svg>
  )
}

export function Wordmark() {
  return (
    <span style={{ fontWeight: 500, letterSpacing: '-0.015em' }}>Nimvoy</span>
  )
}

export function Logo() {
  return (
    <Link to="/" className="logo reset" aria-label="Nimvoy home">
      <LogoMark size={30} />
      <Wordmark />
    </Link>
  )
}
