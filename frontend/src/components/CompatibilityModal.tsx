import { useEffect, useRef, useState } from 'react'
import { Icon } from './Icon'
import { checkDevice, detectFromUserAgent, type DeviceCheckResult } from '../data/deviceCheck'

// "Will my phone work?" modal — the last-resort confidence check
// before a customer commits. Reuses the deviceCheck helper that
// already powers the landing-page widget. Auto-fills the input from
// the visitor's User-Agent (iOS hides the model so we get a generic
// "iPhone"; Android UAs usually include the model).
//
// Closes on backdrop click, Escape, or the X button. Trap-focuses
// the input on open. Dismissible — no persistent flag.

interface Props {
  open: boolean
  onClose: () => void
}

export function CompatibilityModal({ open, onClose }: Props) {
  const [query, setQuery] = useState('')
  const [result, setResult] = useState<DeviceCheckResult | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // On open: prefill from UA + focus the input + lock body scroll.
  useEffect(() => {
    if (!open) return
    const detected = detectFromUserAgent()
    if (detected) {
      setQuery(detected)
      setResult(checkDevice(detected))
    } else {
      setQuery('')
      setResult(null)
    }
    // Slight delay so the focus lands after the open animation.
    const t = setTimeout(() => inputRef.current?.focus(), 60)
    document.body.style.overflow = 'hidden'
    return () => {
      clearTimeout(t)
      document.body.style.overflow = ''
    }
  }, [open])

  // Escape closes.
  useEffect(() => {
    if (!open) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  function onChange(value: string) {
    setQuery(value)
    setResult(value.trim() ? checkDevice(value) : null)
  }

  if (!open) return null

  return (
    <div className="compat-modal" role="dialog" aria-modal="true" aria-label="Device compatibility check">
      <div className="compat-modal__backdrop" onClick={onClose} />
      <div className="compat-modal__panel">
        <button className="compat-modal__close" onClick={onClose} aria-label="Close">
          <Icon name="x" size={14} />
        </button>

        <div className="compat-modal__eyebrow">Check compatibility</div>
        <h2 className="compat-modal__title">Will your phone work?</h2>
        <p className="compat-modal__sub">
          Type your phone model. We'll check it instantly.
        </p>

        <div className="compat-modal__input-wrap">
          <Icon name="search" size={16} />
          <input
            ref={inputRef}
            type="text"
            className="compat-modal__input"
            placeholder='e.g. "iPhone 14", "Pixel 8", "Galaxy S23"'
            value={query}
            onChange={(e) => onChange(e.target.value)}
            autoComplete="off"
            spellCheck={false}
          />
          {query && (
            <button
              className="compat-modal__clear"
              onClick={() => onChange('')}
              aria-label="Clear"
            >
              <Icon name="x" size={11} />
            </button>
          )}
        </div>

        {/* Quick-tap chips for desktop / no-detect visitors who don't
            want to type. Each chip is a popular model that maps to a
            distinct family in checkDevice (covering iPhone / Pixel /
            Galaxy / iPad). */}
        {!result && (
          <div className="compat-modal__chips">
            <span className="compat-modal__chips-lbl">Try one:</span>
            {['iPhone 14', 'Pixel 8', 'Galaxy S23', 'iPad'].map((m) => (
              <button
                key={m}
                type="button"
                className="compat-modal__chip"
                onClick={() => onChange(m)}
              >
                {m}
              </button>
            ))}
          </div>
        )}

        {/* Result card. Three states: empty (initial), unknown (no
            match), compatible / incompatible. */}
        {result && (
          <div className={`compat-result compat-result--${result.status}`}>
            <div className="compat-result__top">
              <div className="compat-result__badge">
                {result.status === 'compatible' && <Icon name="check" size={14} />}
                {result.status === 'incompatible' && <Icon name="x" size={14} />}
                {result.status === 'unknown' && <Icon name="search" size={14} />}
              </div>
              <div className="compat-result__heading">
                {result.status === 'compatible' && (
                  <>
                    <strong>Compatible.</strong>
                    {result.model && <span className="compat-result__model">{result.model}</span>}
                  </>
                )}
                {result.status === 'incompatible' && (
                  <>
                    <strong>Not compatible.</strong>
                    {result.model && <span className="compat-result__model">{result.model}</span>}
                  </>
                )}
                {result.status === 'unknown' && <strong>We're not sure yet.</strong>}
              </div>
            </div>
            <p className="compat-result__msg">{result.message}</p>
            {result.notes.length > 0 && (
              <div className="compat-result__notes">
                {result.notes.map((n) => (
                  <span key={n} className="compat-result__note">{n}</span>
                ))}
              </div>
            )}
          </div>
        )}

        <div className="compat-modal__hint">
          <strong>Don't see your model?</strong> The fastest check is on your phone:
          open <em>Settings → Cellular / Mobile</em>. If you see <em>Add eSIM</em>, you're good
          to go.
        </div>
      </div>
    </div>
  )
}
