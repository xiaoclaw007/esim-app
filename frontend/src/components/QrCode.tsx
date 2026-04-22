import { useEffect, useState } from 'react'
import QRCode from 'qrcode'

interface QrCodeProps {
  value: string
  size?: number
  ariaLabel?: string
}

// Renders an SVG QR for arbitrary payloads (primarily LPA activation strings
// like LPA:1$smdp.example.com$CODE). SVG keeps it crisp at any zoom and
// lets the QR color inherit from the surrounding design tokens.
export function QrCode({ value, size = 192, ariaLabel = 'eSIM activation QR code' }: QrCodeProps) {
  const [svg, setSvg] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    QRCode.toString(value, {
      type: 'svg',
      errorCorrectionLevel: 'M',
      margin: 1,
      color: { dark: '#0B1F3A', light: '#00000000' },
    })
      .then((s) => {
        if (!cancelled) setSvg(s)
      })
      .catch((e: Error) => {
        if (!cancelled) setError(e.message)
      })
    return () => {
      cancelled = true
    }
  }, [value])

  if (error) return <div style={{ fontSize: 12, color: 'var(--pop)' }}>QR error: {error}</div>
  if (!svg) return <div style={{ width: size, height: size }} />

  return (
    <div
      aria-label={ariaLabel}
      role="img"
      style={{ width: size, height: size }}
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  )
}
