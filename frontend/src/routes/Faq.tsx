import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Icon } from '../components/Icon'
import { FAQ_SECTIONS, type FaqItem } from '../data/faq'

// Frontend-side filter: matches a query against either the question or
// the answer (case-insensitive substring). Returns null if the section
// has no matches so the page can hide the whole section heading.
function filterSection(items: FaqItem[], q: string): FaqItem[] {
  if (!q.trim()) return items
  const lower = q.toLowerCase()
  return items.filter(
    (it) => it.q.toLowerCase().includes(lower) || it.a.toLowerCase().includes(lower),
  )
}

export default function Faq() {
  const [query, setQuery] = useState('')

  const filtered = useMemo(
    () =>
      FAQ_SECTIONS.map((s) => ({ ...s, items: filterSection(s.items, query) })).filter(
        (s) => s.items.length > 0,
      ),
    [query],
  )

  const totalMatches = filtered.reduce((sum, s) => sum + s.items.length, 0)

  return (
    <div className="faq">
      {/* Hero */}
      <section className="faq-hero">
        <div className="faq-hero-inner">
          <div className="breadcrumb">
            <Link to="/" style={{ color: 'var(--ink-3)' }}>Home</Link> /{' '}
            <span style={{ color: 'var(--ink)' }}>FAQ</span>
          </div>
          <div className="eyebrow" style={{ marginTop: 16 }}>Frequently asked</div>
          <h1 className="h1" style={{ marginTop: 12, maxWidth: '14ch' }}>
            Questions,{' '}
            <em style={{ fontFamily: 'var(--serif)', fontStyle: 'italic', fontWeight: 400 }}>
              answered
            </em>
            .
          </h1>
          <p className="lede" style={{ marginTop: 18, maxWidth: '52ch' }}>
            The honest, useful version. If something's not here, email us — we reply within a few hours.
          </p>

          {/* Search filters across question text + answer text. */}
          <div className="faq-search">
            <Icon name="search" size={16} />
            <input
              type="text"
              placeholder="Search the FAQ — try 'iPhone', 'roaming', 'refund'…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            {query && (
              <button className="faq-search-clear" onClick={() => setQuery('')} aria-label="Clear search">
                <Icon name="x" size={12} />
              </button>
            )}
          </div>

          {/* Section quick-jump nav — hidden during a search */}
          {!query && (
            <nav className="faq-toc">
              {FAQ_SECTIONS.map((s) => (
                <a key={s.id} href={`#${s.id}`} className="faq-toc-item">
                  {s.title}
                </a>
              ))}
            </nav>
          )}
        </div>
      </section>

      {/* Body */}
      <section className="faq-body">
        <div className="faq-body-inner">
          {query && (
            <div className="faq-search-meta">
              {totalMatches === 0
                ? `No results for "${query}". Try another keyword or email support@nimvoy.com.`
                : `${totalMatches} ${totalMatches === 1 ? 'result' : 'results'} for "${query}"`}
            </div>
          )}

          {filtered.map((section, sectionIdx) => (
            <div key={section.id} id={section.id} className="faq-section">
              <div className="faq-section-head">
                <div className="eyebrow">0{sectionIdx + 1}</div>
                <h2>
                  <em style={{ fontFamily: 'var(--serif)', fontStyle: 'italic', fontWeight: 400 }}>
                    {section.title}
                  </em>
                </h2>
                {section.intro && <p className="muted">{section.intro}</p>}
              </div>

              <div className="faq-list">
                {section.items.map((it, i) => (
                  // First item of each section opens by default — gives the
                  // page presence; user can collapse if they want.
                  <details key={it.q} className="faq-row" open={i === 0 && !query}>
                    <summary>
                      <span className="faq-q">{it.q}</span>
                      <span className="faq-chev" aria-hidden="true">
                        <Icon name="chevron" size={14} />
                      </span>
                    </summary>
                    <div className="faq-a">
                      <p>{it.a}</p>
                    </div>
                  </details>
                ))}
              </div>
            </div>
          ))}

          {/* Bottom CTA — always present, even on no-match search */}
          <div className="faq-cta">
            <h3>Still stuck?</h3>
            <p className="muted">
              Send us your order reference and what's not working. We typically reply within a few hours.
            </p>
            <a href="mailto:support@nimvoy.com" className="btn primary reset" style={{ padding: '12px 22px', marginTop: 18 }}>
              <Icon name="arrow" size={14} /> support@nimvoy.com
            </a>
          </div>
        </div>
      </section>
    </div>
  )
}
