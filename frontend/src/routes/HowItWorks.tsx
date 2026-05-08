import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Icon } from '../components/Icon'
import { StepArt } from '../components/StepArt'

// Three-method install guide. Mirrors what the activation email actually
// ships: a one-tap install button (Apple/Android universal install URLs,
// iOS 17.4+ / Android 10+), a QR code for older or cross-screen flows,
// and a manual SM-DP+ / activation code path for any eSIM-capable device.

interface Step {
  title: string
  body: string
}

interface InstallMethod {
  id: 'onetap' | 'qr' | 'manual'
  label: string
  recommended?: boolean
  intro: string
  steps: Step[]
  compat: string
}

const METHODS: InstallMethod[] = [
  {
    id: 'onetap',
    label: 'One-tap',
    recommended: true,
    intro: 'No app, no scan — your phone opens its built-in eSIM installer when you tap the button in our email.',
    steps: [
      {
        title: 'Open the email on the phone you’ll use',
        body: 'Your activation email lands within a minute of payment. Open it on the actual phone that will use the eSIM — not your laptop.',
      },
      {
        title: 'Tap the install button',
        body: 'Tap "Install on iPhone" or "Install on Android". Your phone opens its native eSIM installer with the plan pre-filled.',
      },
      {
        title: 'Confirm the prompts',
        body: 'A few "Continue" / "Done" taps. The eSIM installs in seconds — no QR scan, no codes to type.',
      },
    ],
    compat: 'Works on iOS 17.4 or later and Android 10 or later. Older devices: use the QR or manual method instead.',
  },
  {
    id: 'qr',
    label: 'QR code',
    intro: 'Classic method — open the email on a second screen and scan the QR with your phone.',
    steps: [
      {
        title: 'Open the email on a second screen',
        body: 'Laptop, tablet, another phone, or even a printout. The QR is in your activation email.',
      },
      {
        title: 'Open Add eSIM on your phone',
        body: 'iPhone: Settings → Cellular → Add eSIM → Use QR Code. Android: Settings → Network → SIMs → Add eSIM → Scan QR.',
      },
      {
        title: 'Scan and confirm',
        body: 'Point the camera at the QR. Confirm the prompts. The eSIM installs in seconds.',
      },
    ],
    compat: 'Works on any eSIM-capable phone (iPhone XS / XR or later, Pixel 3 or later, Galaxy S20 or later).',
  },
  {
    id: 'manual',
    label: 'Manual entry',
    intro: 'Fallback for the rare case where a QR scan fails — type the SM-DP+ address and activation code by hand.',
    steps: [
      {
        title: 'Find the activation details in your email',
        body: 'Below the QR code, your activation email lists the SM-DP+ address and the activation code separately.',
      },
      {
        title: 'Open Add eSIM → Enter Details Manually',
        body: 'iPhone: Settings → Cellular → Add eSIM → Enter Details Manually. Android: Settings → SIMs → Add eSIM → Enter Code.',
      },
      {
        title: 'Paste the values, confirm',
        body: 'Paste the SM-DP+ address into the first field and the activation code into the second. Confirm the install.',
      },
    ],
    compat: 'Works on any eSIM-capable phone. Slower than the other methods, but bulletproof.',
  },
]

export default function HowItWorks() {
  const [active, setActive] = useState<InstallMethod['id']>('onetap')
  const method = METHODS.find((m) => m.id === active) ?? METHODS[0]

  return (
    <div className="hiw">
      {/* Hero — short intro to eSIM, then the install methods do the heavy lifting. */}
      <section className="faq-hero">
        <div className="faq-hero-inner">
          <div className="breadcrumb">
            <Link to="/" style={{ color: 'var(--ink-3)' }}>Home</Link> /{' '}
            <span style={{ color: 'var(--ink)' }}>How it works</span>
          </div>
          <div className="eyebrow" style={{ marginTop: 16 }}>How it works</div>
          <h1 className="h1" style={{ marginTop: 12, maxWidth: '18ch' }}>
            Three ways to install.{' '}
            <em style={{ fontFamily: 'var(--serif)', fontStyle: 'italic', fontWeight: 400 }}>
              Pick what works.
            </em>
          </h1>
          <p className="lede" style={{ marginTop: 18, maxWidth: '58ch' }}>
            An eSIM is a digital SIM that activates over the internet — no plastic card, no
            airport queues. Every Nimvoy plan ships all three install methods in your
            activation email. Use whichever fits your phone.
          </p>
        </div>
      </section>

      {/* Method picker + steps. */}
      <section className="hiw-body">
        <div className="hiw-inner">
          <div className="hiw-tabbar">
            <div className="plan-tabs hiw-tabs">
              {METHODS.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  className={active === m.id ? 'active' : ''}
                  onClick={() => setActive(m.id)}
                >
                  <span className="dot"></span> {m.label}
                  {m.recommended && <span className="hiw-rec">Recommended</span>}
                </button>
              ))}
            </div>
            <p className="hiw-intro">{method.intro}</p>
          </div>

          <div className="hiw-steps">
            {method.steps.map((step, i) => (
              <article key={`${method.id}-${i}`} className="hiw-step">
                <div className="hiw-step__art">
                  <StepArt method={method.id} step={i as 0 | 1 | 2} />
                </div>
                <span className="hiw-step__num">0{i + 1}</span>
                <h3 className="hiw-step__title">{step.title}</h3>
                <p className="hiw-step__body">{step.body}</p>
              </article>
            ))}
          </div>

          <div className="hiw-compat">
            <Icon name="signal" size={14} />
            <span>{method.compat}</span>
          </div>

          {/* Standing notes that apply across all methods. */}
          <div className="hiw-notes">
            <div className="hiw-note">
              <div className="hiw-note__h">When to install</div>
              <p>
                Install close to your trip. Some plans start their validity timer the moment they
                connect to a network — we recommend installing the day before you fly.
              </p>
            </div>
            <div className="hiw-note">
              <div className="hiw-note__h">If install fails</div>
              <p>
                Try a different method (one-tap → QR → manual). Still stuck? Email{' '}
                <a href="mailto:support@nimvoy.com">support@nimvoy.com</a> with your order number
                and we’ll sort it within a few hours.
              </p>
            </div>
            <div className="hiw-note">
              <div className="hiw-note__h">No app required</div>
              <p>
                Nimvoy doesn’t need an app. Everything ships in the activation email — install
                links, QR code, manual codes, and your order receipt.
              </p>
            </div>
          </div>

          <div className="hiw-cta">
            <Link to="/destinations" className="btn primary">
              Browse plans <Icon name="arrow" size={14} />
            </Link>
            <Link to="/faq" className="btn ghost">
              Read full FAQ
            </Link>
          </div>
        </div>
      </section>
    </div>
  )
}
