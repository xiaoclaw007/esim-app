import { useEffect, useState } from 'react'
import QRCode from 'qrcode'

interface QrCodeProps {
  value: string
  size?: number
  ariaLabel?: string
}

// Renders the QR as a PNG <img> rather than inline SVG.
//
// Why PNG: iOS 17+ runs Live Text / Visual Look Up over actual raster
// images, which is what triggers the long-press "Add eSIM" Quick Action.
// Inline SVG markup is treated as DOM, not an image, so the gesture
// doesn't fire. Switching to PNG gets the same on-device install
// hand-off the email already gets.
//
// Quality: we generate at 4x the displayed size and let CSS scale
// down, so the QR stays crisp on retina displays. Background stays
// transparent to match the existing card chrome.
export function QrCode({ value, size = 192, ariaLabel = 'eSIM activation QR code' }: QrCodeProps) {
  const [dataUrl, setDataUrl] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    QRCode.toDataURL(value, {
      errorCorrectionLevel: 'M',
      margin: 1,
      width: size * 4,
      color: { dark: '#0B1F3A', light: '#00000000' },
    })
      .then((url) => {
        if (!cancelled) setDataUrl(url)
      })
      .catch((e: Error) => {
        if (!cancelled) setError(e.message)
      })
    return () => {
      cancelled = true
    }
  }, [value, size])

  if (error) return <div style={{ fontSize: 12, color: 'var(--pop)' }}>QR error: {error}</div>
  if (!dataUrl) return <div style={{ width: size, height: size }} />

  return (
    <img
      src={dataUrl}
      alt={ariaLabel}
      width={size}
      height={size}
      style={{ display: 'block', width: size, height: size }}
    />
  )
}
