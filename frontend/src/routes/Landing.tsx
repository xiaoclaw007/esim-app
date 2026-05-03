import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Icon } from '../components/Icon'
import { Stars } from '../components/Stars'
import { WorldMap, type MapCity } from '../components/WorldMap'
import { useCatalog } from '../hooks/useCatalog'
import {
  COUNTRIES,
  REGIONAL_PLANS_META,
  REVIEWS,
  fromPrice,
  priceDollars,
  type CountryMeta,
} from '../data/catalog'

type FeatTab = 'local' | 'regional'

export default function Landing() {
  const { plans } = useCatalog()
  const navigate = useNavigate()
  const [q, setQ] = useState('')

  const suggestions = useMemo(() => {
    if (!q.trim()) return []
    const lower = q.toLowerCase()
    return COUNTRIES.filter((c) => c.name.toLowerCase().includes(lower)).slice(0, 5)
  }, [q])

  const popularCountries = COUNTRIES.filter((c) => c.popular)
  const [featTab, setFeatTab] = useState<FeatTab>('local')

  // Floating Tokyo/Seoul-style info pills over the WorldMap. Driven by
  // the WorldMap's active arc cycle so they describe the same connection
  // the map is animating, not hardcoded fakes.
  const [activeArc, setActiveArc] = useState<{ a: MapCity; b: MapCity } | null>(null)

  const goTo = (code: string) => navigate(`/destinations/${code.toLowerCase()}`)
  const priceFor = (code: string) => (plans ? fromPrice(plans, code) : null)

  return (
    <>
      {/* HERO */}
      <section className="hero">
        <div className="hero-grid">
          <div className="hero-copy">
            <div className="eyebrow">Nimvoy eSIM · 60+ countries</div>
            <h1 className="display">
              Stay connected
              <br />the moment you <em>land</em>.
            </h1>
            <p className="lede">
              One eSIM. No roaming fees. No queues at the airport kiosk. Install
              before you leave and your data is live the second your plane
              touches down.
            </p>

            <div className="hero-search" style={{ position: 'relative' }}>
              <div style={{ padding: '0 8px 0 14px', color: 'var(--ink-3)' }}>
                <Icon name="search" size={18} />
              </div>
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Where are you going?"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') navigate('/destinations')
                }}
              />
              <button className="btn primary" onClick={() => navigate('/destinations')}>
                Search
              </button>
              {suggestions.length > 0 && (
                <div
                  style={{
                    position: 'absolute',
                    top: '100%',
                    left: 0,
                    right: 0,
                    marginTop: 6,
                    background: 'var(--bg-elev)',
                    border: '1px solid var(--line)',
                    borderRadius: 12,
                    boxShadow: 'var(--shadow-md)',
                    padding: 6,
                    zIndex: 10,
                  }}
                >
                  {suggestions.map((c) => (
                    <SuggestionRow
                      key={c.code}
                      country={c}
                      fromCents={priceFor(c.code)}
                      onClick={() => goTo(c.code)}
                    />
                  ))}
                </div>
              )}
            </div>

            <div className="hero-chips">
              <span
                className="mono muted"
                style={{ fontSize: 12, marginRight: 6, alignSelf: 'center' }}
              >
                POPULAR
              </span>
              {popularCountries.map((c) => (
                <button key={c.code} className="chip" onClick={() => goTo(c.code)}>
                  {c.flag} {c.name}
                </button>
              ))}
            </div>

            <div className="hero-stats">
              <div className="hero-stat">
                <div className="num">60+</div>
                <div className="muted">countries covered</div>
              </div>
              <div className="hero-stat">
                <div className="num">
                  60<span style={{ fontSize: 16 }}>sec</span>
                </div>
                <div className="muted">to install</div>
              </div>
              <div className="hero-stat">
                <div className="num" style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                  4.9
                  <Icon name="star" size={14} />
                </div>
                <div className="muted">in early testing</div>
              </div>
            </div>
          </div>

          <div className="hero-globe-wrap">
            <WorldMap onSelectCountry={goTo} onActiveArcChange={(a, b) => setActiveArc({ a, b })} />
            {/* Cards re-key on the active city code so React remounts them
                and the CSS pulse-in animation replays — gives the swap a
                subtle "new ping just landed" feel instead of an instant snap. */}
            <div className="globe-card tl">
              <div className="flag">{activeArc?.a.flag ?? '🇯🇵'}</div>
              <div className="globe-card-body" key={activeArc?.a.code ?? 'JP'}>
                <strong>{activeArc?.a.name ?? 'Tokyo'} · 5G live</strong>
                <div className="muted mono">
                  {activeArc?.a.network ?? 'NTT Docomo'} · {activeArc?.a.latencyMs ?? 184} ms
                </div>
              </div>
            </div>
            <div className="globe-card br">
              <div className="flag">{activeArc?.b.flag ?? '🇰🇷'}</div>
              <div className="globe-card-body" key={activeArc?.b.code ?? 'KR'}>
                <strong>{activeArc?.b.name ?? 'Seoul'} · Connected</strong>
                <div className="muted mono">
                  {activeArc?.b.network ?? 'SK Telecom'} · {activeArc?.b.latencyMs ?? 72} ms
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* FEATURED DESTINATIONS */}
      <section className="section" style={{ background: 'var(--bg)' }}>
        <div className="section-inner">
          <div className="section-head">
            <div>
              <div className="eyebrow" style={{ marginBottom: 14 }}>
                Popular destinations
              </div>
              <h2 className="h1">
                Trending where everyone is going
                <br />
                this{' '}
                <em style={{ fontFamily: 'var(--serif)', fontStyle: 'italic', fontWeight: 400 }}>
                  season
                </em>
                .
              </h2>
            </div>
            <button className="btn ghost" onClick={() => navigate('/destinations')}>
              Browse all <Icon name="arrow" size={14} />
            </button>
          </div>

          {/* Tabs — Local (single-country plans) vs Regional (multi-country packs).
              Reuses the .plan-tabs pill segmented control from DestinationDetail
              so the visual language matches across the site. */}
          <div className="plan-tabs" style={{ marginBottom: 28 }}>
            <button
              className={featTab === 'local' ? 'active' : ''}
              onClick={() => setFeatTab('local')}
            >
              <span className="dot"></span> Local
            </button>
            <button
              className={featTab === 'regional' ? 'active' : ''}
              onClick={() => setFeatTab('regional')}
            >
              <span className="dot"></span> Regional
            </button>
          </div>

          {featTab === 'local' && (
            <div className="feat-list">
              {popularCountries.map((c) => (
                <FeatRow
                  key={c.code}
                  flag={c.flag}
                  name={c.name}
                  sub={c.networks.split(',')[0]}
                  fromCents={priceFor(c.code)}
                  onClick={() => goTo(c.code)}
                />
              ))}
            </div>
          )}

          {featTab === 'regional' && (
            <div className="feat-list">
              {REGIONAL_PLANS_META.map((r) => (
                <FeatRow
                  key={r.code}
                  flag={r.icon}
                  name={r.name}
                  sub={r.scope}
                  fromCents={priceFor(r.code)}
                  onClick={() => goTo(r.code)}
                />
              ))}
            </div>
          )}
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section id="how-it-works" className="section" style={{ background: 'var(--bg-sunk)' }}>
        <div className="section-inner">
          <div className="section-head">
            <div>
              <div className="eyebrow" style={{ marginBottom: 14 }}>
                How it works
              </div>
              <h2 className="h1">Three steps. No SIM ejector pin required.</h2>
            </div>
          </div>

          <div className="how">
            <div className="how-step">
              <span className="n">01 — CHOOSE</span>
              <h3>Pick your destination</h3>
              <p>
                Search for a country, region, or global plan. Compare data
                allowances at a glance — we list real per-GB pricing, not
                asterisks.
              </p>
              <div className="art">
                <div style={{ display: 'flex', gap: 6 }}>
                  <span className="chip active">🇯🇵 Japan</span>
                  <span className="chip">🇺🇸 USA</span>
                  <span className="chip">🌍 Europe</span>
                </div>
              </div>
            </div>
            <div className="how-step">
              <span className="n">02 — CHECKOUT</span>
              <h3>Pay in 30 seconds</h3>
              <p>
                Apple Pay, Google Pay, or card. Your eSIM profile is issued
                instantly and emailed to you before the receipt lands in your
                inbox.
              </p>
              <div className="art" style={{ flexDirection: 'column', gap: 8, padding: 14 }}>
                <div style={{ display: 'flex', gap: 8, width: '100%' }}>
                  <div
                    style={{
                      flex: 1,
                      height: 32,
                      borderRadius: 6,
                      background: 'var(--bg-elev)',
                      border: '1px solid var(--line)',
                      display: 'flex',
                      alignItems: 'center',
                      padding: '0 10px',
                      fontFamily: 'var(--mono)',
                      fontSize: 11,
                    }}
                  >
                    •••• 4242
                  </div>
                  <div
                    style={{
                      width: 60,
                      height: 32,
                      borderRadius: 6,
                      background: 'var(--ink)',
                      display: 'grid',
                      placeItems: 'center',
                      color: 'var(--bg)',
                      fontFamily: 'var(--mono)',
                      fontSize: 11,
                    }}
                  >
                    PAY
                  </div>
                </div>
              </div>
            </div>
            <div className="how-step">
              <span className="n">03 — INSTALL</span>
              <h3>Scan the QR, you're online</h3>
              <p>
                One QR code installs your eSIM. Toggle it on when you land —
                your phone automatically connects to the best local network.
              </p>
              <div className="art">
                <svg width="72" height="72" viewBox="0 0 72 72" aria-hidden="true">
                  {Array.from({ length: 9 }).flatMap((_, y) =>
                    Array.from({ length: 9 }).map((_, x) => {
                      const v = (x * 7 + y * 13 + x * y) % 3
                      return v !== 0 ? (
                        <rect
                          key={`${x},${y}`}
                          x={x * 8}
                          y={y * 8}
                          width="7"
                          height="7"
                          fill="var(--ink)"
                        />
                      ) : null
                    }),
                  )}
                  <rect x="0" y="0" width="20" height="20" fill="none" stroke="var(--ink)" strokeWidth="4" />
                  <rect x="52" y="0" width="20" height="20" fill="none" stroke="var(--ink)" strokeWidth="4" />
                  <rect x="0" y="52" width="20" height="20" fill="none" stroke="var(--ink)" strokeWidth="4" />
                </svg>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* REVIEWS */}
      <section className="section" style={{ background: 'var(--bg)' }}>
        <div className="section-inner">
          <div className="section-head">
            <div>
              <div className="eyebrow" style={{ marginBottom: 14 }}>
                Real travelers
              </div>
              <h2 className="h1">
                Loved across every timezone
                <br />
                we've launched in.
              </h2>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <Stars n={5} />
              <span className="num" style={{ fontSize: 24 }}>
                4.9
              </span>
              <span className="muted">· early access</span>
            </div>
          </div>

          <div className="reviews">
            {REVIEWS.map((r, i) => (
              <div key={i} className="review">
                <div className="stars">
                  <Stars n={r.stars} />
                </div>
                <p>"{r.text}"</p>
                <div className="who">
                  <div className="av">
                    {r.name
                      .split(' ')
                      .map((p) => p[0])
                      .join('')}
                  </div>
                  <div>
                    <strong style={{ fontWeight: 500 }}>{r.name}</strong>
                    <div
                      className="muted mono"
                      style={{ fontSize: 11.5, letterSpacing: '0.04em' }}
                    >
                      {r.from}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* COMPATIBILITY */}
      <section id="support" className="section" style={{ background: 'var(--bg)' }}>
        <div className="section-inner">
          <div className="compat">
            <div>
              <div
                className="eyebrow"
                style={{ color: 'inherit', opacity: 0.7, marginBottom: 16 }}
              >
                Device check
              </div>
              <h2>
                Does your phone
                <br />
                support eSIM?
              </h2>
              <p>
                Every iPhone from XS onward and most Android flagships since
                2021 are compatible. Check yours in a click.
              </p>
              <div className="compat-check">
                <input placeholder="iPhone 15 Pro" defaultValue="iPhone 15 Pro" />
                <button
                  className="btn primary"
                  style={{ background: 'var(--bg)', color: 'var(--ink)' }}
                >
                  Check
                </button>
              </div>
            </div>
            <div className="compat-result">
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  marginBottom: 10,
                  color: 'var(--ok)',
                  fontWeight: 500,
                }}
              >
                <Icon name="check" size={16} /> COMPATIBLE
              </div>
              <div>
                iPhone 15 Pro
                <br />
                iOS 18.4+ · Dual eSIM
                <br />
                Supports: 5G, Hotspot, Calls
                <br />
                Carrier lock: unlocked ✓
              </div>
            </div>
          </div>
        </div>
      </section>
    </>
  )
}

function SuggestionRow({
  country,
  fromCents,
  onClick,
}: {
  country: CountryMeta
  fromCents: number | null
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '10px 12px',
        width: '100%',
        textAlign: 'left',
        borderRadius: 8,
      }}
      onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--bg-sunk)')}
      onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
    >
      <span style={{ fontSize: 20 }}>{country.flag}</span>
      <span style={{ flex: 1 }}>{country.name}</span>
      {fromCents !== null && (
        <span className="mono muted" style={{ fontSize: 12 }}>
          from ${priceDollars(fromCents)}
        </span>
      )}
    </button>
  )
}

// Compact row used in the Local / Regional tabs of the landing page's
// Popular destinations section. Same shape works for both single countries
// and regional packs — caller supplies flag emoji, display name, sub line,
// and the cheapest price.
function FeatRow({
  flag,
  name,
  sub,
  fromCents,
  onClick,
}: {
  flag: string
  name: string
  sub: string
  fromCents: number | null
  onClick: () => void
}) {
  return (
    <div
      className="feat-row"
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onClick()
        }
      }}
    >
      <div className="flag-tile">{flag}</div>
      <div className="info">
        <div className="name">{name}</div>
        <div className="sub">{sub}</div>
      </div>
      <div className="price">
        <span className="from">from</span>{' '}
        <b>{fromCents !== null ? `$${priceDollars(fromCents)}` : '—'}</b>{' '}
        <span className="ccy">USD</span>
      </div>
    </div>
  )
}
