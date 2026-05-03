interface AvatarProps {
  name?: string | null
  email?: string | null
  size?: 'sm' | 'md' | 'lg'
}

// Initials avatar — first letter of name, falling back to first char of email,
// falling back to "—" for fully anonymous guests.
export function Avatar({ name, email, size = 'md' }: AvatarProps) {
  const initial = (name?.trim()[0] || email?.trim()[0] || '—').toUpperCase()
  const cls = size === 'sm' ? 'crm-avatar sm' : size === 'lg' ? 'crm-avatar lg' : 'crm-avatar'
  // Deterministic-ish color tint from the initial char so avatars don't all blend.
  const hue = (initial.charCodeAt(0) * 47) % 360
  const bg = `linear-gradient(135deg, hsl(${hue} 30% 60%), hsl(${(hue + 40) % 360} 35% 40%))`
  return (
    <span className={cls} style={{ background: bg }}>
      {initial}
    </span>
  )
}
