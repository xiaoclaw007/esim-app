import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Icon } from '../components/Icon'
import { useCatalog } from '../hooks/useCatalog'
import {
  COUNTRIES,
  REGIONAL_PLANS_META,
  REGIONS,
  fromPrice,
  priceDollars,
  type CountryMeta,
} from '../data/catalog'

export default function Destinations() {
  const { plans, loading } = useCatalog()
  const navigate = useNavigate()
  const [q, setQ] = useState('')
  const [region, setRegion] = useState<string>('all')

  const filtered = useMemo(() => {
    const lower = q.toLowerCase().trim()
    return COUNTRIES.filter((c) => {
      if (region !== 'all' && c.region !== region) return false
      if (lower && !c.name.toLowerCase().includes(lower)) return false
      return true
    }).sort((a, b) => a.name.localeCompare(b.name))
  }, [q, region])

  const grouped = useMemo(() => {
    const g: Record<string, CountryMeta[]> = {}
    for (const c of filtered) {
      const label = REGIONS.find((r) => r.id === c.region)?.label || 'Other'
      if (!g[label]) g[label] = []
      g[label].push(c)
    }
    return g
  }, [filtered])

  const goToCountry = (code: string) => navigate(`/destinations/${code.toLowerCase()}`)

  // For regional cards, pick a "from" price from the relevant plans.
  const regionalFrom = (code: string): number | null =>
    plans ? fromPrice(plans, code) : null

  return (
    <>
      <section className="dest-hero">
        <div className="dest-hero-inner">
          <div className="breadcrumb">
            <Link to="/" style={{ color: 'var(--ink-3)' }}>Home</Link> /{' '}
            <span style={{ color: 'var(--ink)' }}>Destinations</span>
          </div>
          <h1 className="h1" style={{ fontSize: 48, maxWidth: '16ch', marginTop: 16 }}>
            Browse our eSIM catalog.
          </h1>
          <p className="lede" style={{ marginTop: 14 }}>
            Pick a single country, or grab a regional plan that roams across borders.
          </p>

          <div className="dest-search-row">
            <div className="dest-search">
              <Icon name="search" size={18} />
              <input
                placeholder="Search by country — e.g. Japan, Korea, USA"
                value={q}
                onChange={(e) => setQ(e.target.value)}
              />
              {q && (
                <button className="btn subtle sm" onClick={() => setQ('')}>
                  <Icon name="x" size={12} />
                </button>
              )}
            </div>
            <div className="region-tabs">
              {REGIONS.map((r) => (
                <button
                  key={r.id}
                  className={region === r.id ? 'active' : ''}
                  onClick={() => setRegion(r.id)}
                >
                  {r.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="dest-body">
        <div className="dest-body-inner">
          {/* Regional plans banner — only show when no search active */}
          {!q.trim() && (region === 'all' || ['europe', 'asia-pacific', 'china-region'].includes(region)) && (
            <>
              <div className="dest-group-head">
                <h2>Regional & global</h2>
                <span className="count">roaming across borders</span>
              </div>
              <div className="regional-banner">
                {REGIONAL_PLANS_META
                  .filter((r) => region === 'all' || r.region === region)
                  .map((r) => {
                    const fromCents = regionalFrom(r.code)
                    return (
                      <div
                        key={r.code}
                        className={`regional-card ${r.featured ? 'featured' : ''}`}
                        onClick={() => goToCountry(r.code)}
                        role="button"
                        tabIndex={0}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault()
                            goToCountry(r.code)
                          }
                        }}
                      >
                        <div className="eyebrow">{r.scope}</div>
                        <h3>
                          {r.icon}&nbsp;&nbsp;{r.name}
                        </h3>
                        <p className="desc">{r.desc}</p>
                        <div className="price">
                          from <b>{fromCents !== null ? `$${priceDollars(fromCents)}` : '—'}</b>
                        </div>
                      </div>
                    )
                  })}
              </div>
            </>
          )}

          {/* Countries grouped by region label */}
          {Object.entries(grouped).map(([label, list]) => (
            <div className="dest-group" key={label}>
              <div className="dest-group-head">
                <h2>{label}</h2>
                <span className="count">
                  {list.length} {list.length === 1 ? 'destination' : 'destinations'}
                </span>
              </div>
              <div className="country-grid">
                {list.map((c) => {
                  const fromCents = plans ? fromPrice(plans, c.code) : null
                  return (
                    <div
                      key={c.code}
                      className="country-row"
                      onClick={() => goToCountry(c.code)}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault()
                          goToCountry(c.code)
                        }
                      }}
                    >
                      <div className="flag">{c.flag}</div>
                      <div className="meta">
                        <strong>{c.name}</strong>
                        <span className="sub">
                          {fromCents !== null ? `from $${priceDollars(fromCents)}` : 'coming soon'} ·{' '}
                          {c.networks.split(',')[0].toUpperCase()}
                        </span>
                      </div>
                      <div className="arr">
                        <Icon name="chevron" size={16} />
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          ))}

          {filtered.length === 0 && (
            <div style={{ padding: 80, textAlign: 'center', color: 'var(--ink-3)' }}>
              {loading ? 'Loading…' : `No destinations match "${q}". Try another country.`}
            </div>
          )}
        </div>
      </section>
    </>
  )
}
