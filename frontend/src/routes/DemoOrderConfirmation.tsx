import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Icon } from '../components/Icon'
import { QrCode } from '../components/QrCode'

// Demo / preview route at /demo/confirmation. Renders a static snapshot
// of the post-payment order confirmation page so design changes can be
// reviewed without going through a real Stripe purchase. Not linked
// from the navigation — reachable only by typing the URL.
//
// The LPA string below is syntactically valid but points at a fake
// SM-DP+ host, so tapping "Install" will gracefully fail at the OS
// installer rather than provisioning a real (broken) eSIM.

type Tab = 'ios' | 'android' | 'manual'

const DEMO_ORDER = {
  reference: 'ESIM-DEMO01',
  status: 'delivered' as const,
  amount_cents: 600,
  qr_code_data: 'LPA:1$demo.smdp.nimvoy.com$DEMO-PREVIEW-CODE-9F4B7E2A',
  destination_name: 'Japan',
  destination_flag: '🇯🇵',
  destination_code: 'JP',
  data_gb: 5,
  validity_days: 7,
}

function detectPlatform(): 'ios' | 'android' | 'other' {
  if (typeof navigator === 'undefined') return 'other'
  const ua = navigator.userAgent
  if (/iPhone|iPad|iPod/i.test(ua)) return 'ios'
  if (/Android/i.test(ua)) return 'android'
  return 'other'
}

export default function DemoOrderConfirmation() {
  const [tab, setTab] = useState<Tab>('ios')

  const order = DEMO_ORDER
  const lpa = order.qr_code_data
  const appleInstallUrl = `https://esimsetup.apple.com/esim_qrcode_provisioning?carddata=${encodeURIComponent(lpa)}`
  const androidInstallUrl = `https://esimsetup.android.com/esim_qrcode_provisioning?carddata=${encodeURIComponent(lpa)}`
  const platform = detectPlatform()

  const iosSteps = [
    'Open Settings → Cellular → Add eSIM',
    "Choose 'Use QR Code' and scan the code below",
    `Label the line 'Nimvoy ${order.destination_name}'`,
    'When you land, enable Data Roaming for this line',
  ]
  const androidSteps = [
    'Open Settings → Network → SIMs → Add eSIM',
    'Scan the QR code below with your camera',
    'Confirm the carrier profile',
    'Enable the Nimvoy line when you arrive',
  ]
  const manualParts = lpa.split('$')
  const manualSteps = [
    'Settings → Add eSIM → Enter details manually',
    `SM-DP+ address: ${manualParts[1]}`,
    `Activation code: ${manualParts[2]}`,
    'Confirmation code: leave blank',
  ]
  const steps = tab === 'ios' ? iosSteps : tab === 'android' ? androidSteps : manualSteps

  return (
    <div className="confirm">
      {/* Banner so it's obvious this is a preview, not a real order. */}
      <div
        style={{
          background: 'var(--accent-soft)',
          color: 'var(--accent)',
          padding: '10px 16px',
          borderRadius: 8,
          fontFamily: 'var(--mono)',
          fontSize: 11,
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
          marginBottom: 32,
          display: 'inline-block',
        }}
      >
        Preview · not a real order
      </div>

      <div className="ok-mark">
        <Icon name="check" size={28} />
      </div>
      <h1>You're all set, traveler.</h1>
      <p className="lede muted" style={{ maxWidth: '50ch', margin: '0 auto 24px' }}>
        Your {order.destination_name} eSIM is ready. We've also emailed the QR and a receipt for
        ${(order.amount_cents / 100).toFixed(2)}.
      </p>

      <div className="order-details">
        <div>
          <span className="k">Order</span>
          <span className="v" style={{ fontFamily: 'var(--mono)' }}>{order.reference}</span>
        </div>
        <div>
          <span className="k">Destination</span>
          <span className="v">{order.destination_flag} {order.destination_name}</span>
        </div>
        <div>
          <span className="k">Plan</span>
          <span className="v">{order.data_gb} GB · {order.validity_days}d</span>
        </div>
        <div>
          <span className="k">Status</span>
          <span className="v" style={{ fontFamily: 'var(--mono)' }}>Ready to install</span>
        </div>
      </div>

      <div className="onetap-card">
        <div className="onetap-eyebrow">One-tap install</div>
        <h3 className="onetap-title">Skip the scan — install in one tap</h3>
        <p className="onetap-sub">
          Tap the button for your phone. We'll hand off to your built-in eSIM installer — no QR
          scan, no codes to type.
        </p>
        <div className="onetap-buttons">
          <a className={`btn ${platform === 'android' ? 'ghost' : 'primary'} block`} href={appleInstallUrl}>
            <Icon name="apple" size={14} /> Install on iPhone
          </a>
          <a className={`btn ${platform === 'ios' ? 'ghost' : 'primary'} block`} href={androidInstallUrl}>
            Install on Android
          </a>
        </div>
        <p className="onetap-fineprint">
          Works on iOS 17.4 or later and Android 10 or later. On older devices, use the QR or
          manual method below.
        </p>
      </div>

      <div className="install" style={{ textAlign: 'left' }}>
        <div className="install-head">
          <button className={tab === 'ios' ? 'active' : ''} onClick={() => setTab('ios')}>
            iPhone / iPad
          </button>
          <button className={tab === 'android' ? 'active' : ''} onClick={() => setTab('android')}>
            Android
          </button>
          <button className={tab === 'manual' ? 'active' : ''} onClick={() => setTab('manual')}>
            Manual entry
          </button>
        </div>
        <div className="install-body">
          <ol className="install-steps">
            {steps.map((s, i) => (
              <li key={i}>{s}</li>
            ))}
          </ol>
          <div className="qr-box">
            <QrCode value={lpa} size={172} />
            <div className="cap">SCAN TO INSTALL</div>
          </div>
        </div>
      </div>

      <div style={{ marginTop: 48 }}>
        <Link to="/" className="btn subtle">
          Back to home <Icon name="arrow" size={14} />
        </Link>
      </div>
    </div>
  )
}
