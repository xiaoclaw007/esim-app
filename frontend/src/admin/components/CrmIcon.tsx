// Lucide-style stroke icons used across the CRM. Inline SVG so we don't
// pull in another dep just for the admin chunk.
import type { SVGProps } from 'react'

export type CrmIconName =
  | 'grid'
  | 'receipt'
  | 'users'
  | 'box'
  | 'bar-chart'
  | 'search'
  | 'bell'
  | 'plus'
  | 'download'
  | 'x'
  | 'check'
  | 'arrow-up'
  | 'arrow-down'
  | 'chevron-down'
  | 'more-horizontal'
  | 'external-link'
  | 'qr-code'
  | 'mail'

interface IconProps extends Omit<SVGProps<SVGSVGElement>, 'name'> {
  name: CrmIconName
  size?: number
}

const stroke = {
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.7,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
}

export function CrmIcon({ name, size = 16, ...rest }: IconProps) {
  const common = { width: size, height: size, viewBox: '0 0 24 24', ...rest }
  switch (name) {
    case 'grid':
      return (
        <svg {...common} {...stroke}>
          <rect x="3" y="3" width="7" height="7" rx="1" />
          <rect x="14" y="3" width="7" height="7" rx="1" />
          <rect x="3" y="14" width="7" height="7" rx="1" />
          <rect x="14" y="14" width="7" height="7" rx="1" />
        </svg>
      )
    case 'receipt':
      return (
        <svg {...common} {...stroke}>
          <path d="M5 3v18l2-1.5L9 21l2-1.5L13 21l2-1.5L17 21l2-1.5V3l-2 1.5L15 3l-2 1.5L11 3 9 4.5 7 3 5 4.5z" />
          <path d="M8 9h8M8 13h8M8 17h5" />
        </svg>
      )
    case 'users':
      return (
        <svg {...common} {...stroke}>
          <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
          <circle cx="9" cy="7" r="4" />
          <path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
        </svg>
      )
    case 'box':
      return (
        <svg {...common} {...stroke}>
          <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
          <path d="M3.27 6.96 12 12.01l8.73-5.05M12 22.08V12" />
        </svg>
      )
    case 'bar-chart':
      return (
        <svg {...common} {...stroke}>
          <line x1="12" y1="20" x2="12" y2="10" />
          <line x1="18" y1="20" x2="18" y2="4" />
          <line x1="6" y1="20" x2="6" y2="14" />
        </svg>
      )
    case 'search':
      return (
        <svg {...common} {...stroke}>
          <circle cx="11" cy="11" r="7" />
          <path d="m20 20-3.5-3.5" />
        </svg>
      )
    case 'bell':
      return (
        <svg {...common} {...stroke}>
          <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9M13.7 21a2 2 0 0 1-3.4 0" />
        </svg>
      )
    case 'plus':
      return (
        <svg {...common} {...stroke}>
          <path d="M12 5v14M5 12h14" />
        </svg>
      )
    case 'download':
      return (
        <svg {...common} {...stroke}>
          <path d="M12 3v12m-4-4 4 4 4-4M4 21h16" />
        </svg>
      )
    case 'x':
      return (
        <svg {...common} {...stroke}>
          <path d="M6 6l12 12M18 6 6 18" />
        </svg>
      )
    case 'check':
      return (
        <svg {...common} {...stroke}>
          <path d="M20 6 9 17l-5-5" />
        </svg>
      )
    case 'arrow-up':
      return (
        <svg {...common} {...stroke}>
          <path d="M12 19V5M5 12l7-7 7 7" />
        </svg>
      )
    case 'arrow-down':
      return (
        <svg {...common} {...stroke}>
          <path d="M12 5v14M19 12l-7 7-7-7" />
        </svg>
      )
    case 'chevron-down':
      return (
        <svg {...common} {...stroke}>
          <path d="m6 9 6 6 6-6" />
        </svg>
      )
    case 'more-horizontal':
      return (
        <svg {...common} {...stroke}>
          <circle cx="12" cy="12" r="1" />
          <circle cx="19" cy="12" r="1" />
          <circle cx="5" cy="12" r="1" />
        </svg>
      )
    case 'external-link':
      return (
        <svg {...common} {...stroke}>
          <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
          <polyline points="15 3 21 3 21 9" />
          <line x1="10" y1="14" x2="21" y2="3" />
        </svg>
      )
    case 'qr-code':
      return (
        <svg {...common} {...stroke}>
          <rect x="3" y="3" width="6" height="6" />
          <rect x="15" y="3" width="6" height="6" />
          <rect x="3" y="15" width="6" height="6" />
          <path d="M15 15h2v2M19 15v6M15 19h2M21 21v-2" />
        </svg>
      )
    case 'mail':
      return (
        <svg {...common} {...stroke}>
          <rect x="3" y="5" width="18" height="14" rx="2" />
          <path d="m3 7 9 6 9-6" />
        </svg>
      )
    default:
      return null
  }
}
