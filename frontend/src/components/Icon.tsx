// Ported from design/ui.jsx. Stroke 1.6, round caps/joins, currentColor.
import type { SVGProps } from 'react'

export type IconName =
  | 'search'
  | 'arrow'
  | 'arrow-r'
  | 'check'
  | 'lock'
  | 'bolt'
  | 'signal'
  | 'globe'
  | 'shield'
  | 'clock'
  | 'phone'
  | 'qr'
  | 'star'
  | 'x'
  | 'hotspot'
  | 'card'
  | 'apple'
  | 'link'
  | 'download'
  | 'filter'
  | 'chevron'
  | 'menu'

interface IconProps extends Omit<SVGProps<SVGSVGElement>, 'name'> {
  name: IconName
  size?: number
}

const stroke = {
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.6,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
}

export function Icon({ name, size = 16, ...rest }: IconProps) {
  const common = { width: size, height: size, viewBox: '0 0 24 24', ...rest }
  switch (name) {
    case 'search':
      return (
        <svg {...common} {...stroke}>
          <circle cx="11" cy="11" r="7" />
          <path d="m20 20-3.5-3.5" />
        </svg>
      )
    case 'arrow':
      return (
        <svg {...common} {...stroke}>
          <path d="M5 12h14M13 5l7 7-7 7" />
        </svg>
      )
    case 'arrow-r':
      return (
        <svg {...common} {...stroke}>
          <path d="M9 6l6 6-6 6" />
        </svg>
      )
    case 'check':
      return (
        <svg {...common} {...stroke}>
          <path d="M20 6 9 17l-5-5" />
        </svg>
      )
    case 'lock':
      return (
        <svg {...common} {...stroke}>
          <rect x="4" y="11" width="16" height="10" rx="2" />
          <path d="M8 11V7a4 4 0 1 1 8 0v4" />
        </svg>
      )
    case 'bolt':
      return (
        <svg {...common} {...stroke}>
          <path d="M13 2 4 14h7l-1 8 9-12h-7l1-8Z" />
        </svg>
      )
    case 'signal':
      return (
        <svg {...common} {...stroke}>
          <path d="M2 20h2M6 16h2M10 12h2M14 8h2M18 4h2" />
        </svg>
      )
    case 'globe':
      return (
        <svg {...common} {...stroke}>
          <circle cx="12" cy="12" r="9" />
          <path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18" />
        </svg>
      )
    case 'shield':
      return (
        <svg {...common} {...stroke}>
          <path d="M12 3 4 6v6c0 4.5 3 8 8 9 5-1 8-4.5 8-9V6l-8-3Z" />
        </svg>
      )
    case 'clock':
      return (
        <svg {...common} {...stroke}>
          <circle cx="12" cy="12" r="9" />
          <path d="M12 7v5l3 2" />
        </svg>
      )
    case 'phone':
      return (
        <svg {...common} {...stroke}>
          <rect x="7" y="3" width="10" height="18" rx="2" />
          <path d="M11 18h2" />
        </svg>
      )
    case 'qr':
      return (
        <svg {...common} {...stroke}>
          <rect x="4" y="4" width="6" height="6" />
          <rect x="14" y="4" width="6" height="6" />
          <rect x="4" y="14" width="6" height="6" />
          <path d="M14 14h2v2M18 14v6M14 18h2M20 20v-2" />
        </svg>
      )
    case 'star':
      return (
        <svg {...common} fill="currentColor" stroke="none">
          <path d="m12 2 3 7 7 .6-5.3 4.6 1.6 7-6.3-3.8-6.3 3.8 1.6-7L2 9.6 9 9l3-7Z" />
        </svg>
      )
    case 'x':
      return (
        <svg {...common} {...stroke}>
          <path d="M6 6l12 12M18 6 6 18" />
        </svg>
      )
    case 'hotspot':
      return (
        <svg {...common} {...stroke}>
          <circle cx="12" cy="12" r="2" />
          <path d="M8 8a6 6 0 0 0 0 8M16 8a6 6 0 0 1 0 8M5 5a10 10 0 0 0 0 14M19 5a10 10 0 0 1 0 14" />
        </svg>
      )
    case 'card':
      return (
        <svg {...common} {...stroke}>
          <rect x="2" y="5" width="20" height="14" rx="2" />
          <path d="M2 10h20" />
        </svg>
      )
    case 'apple':
      return (
        <svg {...common} fill="currentColor">
          <path d="M16.37 12.94c-.03-3.12 2.55-4.62 2.67-4.7-1.46-2.13-3.72-2.42-4.53-2.45-1.93-.2-3.77 1.14-4.75 1.14-.98 0-2.49-1.11-4.1-1.08-2.11.03-4.06 1.23-5.14 3.12C.4 12.74 1.8 18 3.97 21.1c1.06 1.51 2.3 3.2 3.92 3.14 1.57-.06 2.17-1.02 4.07-1.02 1.9 0 2.44 1.02 4.1.99 1.69-.03 2.76-1.53 3.8-3.05a12 12 0 0 0 1.72-3.52c-.04-.02-3.28-1.26-3.31-4.7Zm-3.11-8.64c.85-1.05 1.43-2.5 1.27-3.94-1.23.05-2.72.82-3.61 1.86-.79.92-1.49 2.39-1.3 3.81 1.36.1 2.78-.7 3.64-1.73Z" />
        </svg>
      )
    case 'link':
      return (
        <svg {...common} {...stroke}>
          <path d="M10 14a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1 1M14 10a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l1-1" />
        </svg>
      )
    case 'download':
      return (
        <svg {...common} {...stroke}>
          <path d="M12 3v12m-4-4 4 4 4-4M4 21h16" />
        </svg>
      )
    case 'filter':
      return (
        <svg {...common} {...stroke}>
          <path d="M3 5h18M6 12h12M10 19h4" />
        </svg>
      )
    case 'chevron':
      return (
        <svg {...common} {...stroke}>
          <path d="m9 6 6 6-6 6" />
        </svg>
      )
    case 'menu':
      return (
        <svg {...common} {...stroke}>
          <path d="M4 6h16M4 12h16M4 18h16" />
        </svg>
      )
    default:
      return null
  }
}
