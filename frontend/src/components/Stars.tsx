import { Icon } from './Icon'

interface StarsProps {
  n?: number
  size?: number
}

export function Stars({ n = 5, size = 14 }: StarsProps) {
  return (
    <span className="stars" style={{ display: 'inline-flex', gap: 2 }}>
      {Array.from({ length: n }).map((_, i) => (
        <Icon key={i} name="star" size={size} />
      ))}
    </span>
  )
}
