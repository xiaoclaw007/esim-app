import { Link } from 'react-router-dom'
import { Icon } from '../components/Icon'

// About page. Same hero/body pattern as Faq.tsx so the marketing pages
// feel like a set. Content is intentionally short and product-focused —
// the goal is to answer "what is Nimvoy and why does it exist?" in
// under a minute of reading.
export default function About() {
  return (
    <div className="faq">
      <section className="faq-hero">
        <div className="faq-hero-inner">
          <div className="breadcrumb">
            <Link to="/" style={{ color: 'var(--ink-3)' }}>Home</Link> /{' '}
            <span style={{ color: 'var(--ink)' }}>About</span>
          </div>
          <div className="eyebrow" style={{ marginTop: 16 }}>About Nimvoy</div>
          <h1 className="h1" style={{ marginTop: 12, maxWidth: '18ch' }}>
            Data that{' '}
            <em style={{ fontFamily: 'var(--serif)', fontStyle: 'italic', fontWeight: 400 }}>
              travels with you
            </em>
            .
          </h1>
          <p className="lede" style={{ marginTop: 18, maxWidth: '54ch' }}>
            We build eSIMs for travelers who'd rather not think about staying online. Tap
            once, install before you fly, land already connected.
          </p>
        </div>
      </section>

      <section className="faq-body">
        <div className="faq-body-inner">
          <div className="faq-section">
            <div className="faq-section-head">
              <div className="eyebrow">01</div>
              <h2>The traveler tax on data</h2>
            </div>
            <p className="about-body">
              Every traveler knows the drill. You land in a new country, hunt for airport
              Wi-Fi, queue at a SIM kiosk, swap a chip you'll lose by the next flight, and
              hope the local carrier accepts your card. Or you pay your home carrier
              $12/MB and pretend you'll only check email. Both options are bad. We built
              Nimvoy because the third option — install once, land online — should just
              be the default.
            </p>
          </div>

          <div className="faq-section">
            <div className="faq-section-head">
              <div className="eyebrow">02</div>
              <h2>What we actually do</h2>
            </div>
            <p className="about-body">
              An eSIM is a digital SIM card built into modern phones — no plastic chip to
              swap. We sell pre-paid data plans that live on that digital SIM, for the
              countries (and regions) you're going to. Pick a destination, pick how many
              GB and days you need, pay, get an activation email within 60 seconds. Tap
              the install link from the phone you'll travel with, or scan the QR code if
              your phone is older. When your plane touches down, you're online at local
              4G/5G speeds — no roaming charges, no SIM ejector pin, no broken app to
              babysit.
            </p>
          </div>

          <div className="faq-section">
            <div className="faq-section-head">
              <div className="eyebrow">03</div>
              <h2>How we keep it honest</h2>
            </div>
            <ul className="about-list">
              <li>
                <strong>Real per-GB pricing on every plan.</strong> No asterisks, no
                "introductory" rates that double in week two. The price you see is the
                price you pay.
              </li>
              <li>
                <strong>Real carrier names.</strong> When you buy a Japan eSIM, we tell
                you it runs on NTT Docomo. Not "premium partner network."
              </li>
              <li>
                <strong>One eSIM per country.</strong> No hidden multi-country bundles
                with carve-outs. If a plan covers a region, the region is named on the
                product page in plain language.
              </li>
              <li>
                <strong>One-tap install on modern phones.</strong> iOS 17.4+ and Android
                10+ get a system-level install button in your activation email. Older
                phones get a QR code as backup. No app to download.
              </li>
              <li>
                <strong>Real humans on email.</strong> support@nimvoy.com goes to a small
                team. We typically reply within a few hours.
              </li>
            </ul>
          </div>

          <div className="faq-section">
            <div className="faq-section-head">
              <div className="eyebrow">04</div>
              <h2>Where we're going</h2>
            </div>
            <p className="about-body">
              Right now we cover the destinations our team and early customers actually
              travel to most — the US, Japan, Korea, China (with a HK + Macau bundle),
              plus regional plans for Europe and Asia-Pacific. The catalog grows as
              demand does. If we don't cover where you're going yet, email us — those
              requests directly drive what we add next.
            </p>
          </div>

          <div className="faq-cta">
            <h3>Pick a destination</h3>
            <p className="muted">
              60 seconds from purchase to a working eSIM. No app, no airport queue.
            </p>
            <Link
              to="/destinations"
              className="btn primary reset"
              style={{ padding: '12px 22px', marginTop: 18, display: 'inline-flex' }}
            >
              Browse destinations <Icon name="arrow" size={14} />
            </Link>
          </div>
        </div>
      </section>
    </div>
  )
}
