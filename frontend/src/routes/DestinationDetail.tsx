import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { CompatibilityModal } from '../components/CompatibilityModal'
import { Icon } from '../components/Icon'
import { useCatalog } from '../hooks/useCatalog'
import { track } from '../api/track'
import {
  COUNTRIES,
  REGIONAL_PLANS_META,
  formatData,
  isUnlimited,
  plansForCountry,
  priceDollars,
  type Plan,
} from '../data/catalog'

interface DestinationMeta {
  code: string
  name: string
  flag: string
  networks: string
  isRegional: boolean
  scope?: string
  desc?: string
  image?: string
}

function resolveMeta(codeParam: string | undefined): DestinationMeta | null {
  if (!codeParam) return null
  const upper = codeParam.toUpperCase()
  const country = COUNTRIES.find((c) => c.code === upper)
  if (country) {
    return {
      code: country.code,
      name: country.name,
      flag: country.flag,
      networks: country.networks,
      isRegional: false,
      image: country.image,
    }
  }
  const regional = REGIONAL_PLANS_META.find((r) => r.code === upper)
  if (regional) {
    return {
      code: regional.code,
      name: regional.name,
      flag: regional.flag,
      networks: regional.networks,
      isRegional: true,
      scope: regional.scope,
      desc: regional.desc,
      image: regional.image,
    }
  }
  return null
}

export default function DestinationDetail() {
  const { country: codeParam } = useParams<{ country: string }>()
  const navigate = useNavigate()
  const { plans, loading } = useCatalog()
  const [tab, setTab] = useState<'regular' | 'unlimited'>('regular')
  const [compatOpen, setCompatOpen] = useState(false)

  const meta = resolveMeta(codeParam)

  // One destination_view ping per visit to a destination page.
  useEffect(() => {
    if (meta) track('destination_view', { country: meta.code, name: meta.name })
  }, [meta?.code])

  const allPlans = useMemo(() => (plans && meta ? plansForCountry(plans, meta.code) : []), [plans, meta])
  const regularPlans = useMemo(() => allPlans.filter((p) => !isUnlimited(p)), [allPlans])
  const unlimitedPlans = useMemo(() => allPlans.filter(isUnlimited), [allPlans])

  const visible = tab === 'unlimited' ? unlimitedPlans : regularPlans

  if (!meta) {
    return (
      <div className="page-stub">
        <h1 className="h1">Destination not found</h1>
        <p className="lede" style={{ marginTop: 12 }}>
          <Link to="/destinations" style={{ color: 'var(--ink)' }}>
            Browse all destinations →
          </Link>
        </p>
      </div>
    )
  }

  const cheapest = allPlans[0]
  const longest = allPlans.length ? Math.max(...allPlans.map((p) => p.validity_days)) : null
  const shortest = allPlans.length ? Math.min(...allPlans.map((p) => p.validity_days)) : null

  // Coverage: just the main destination. (Earlier we listed same-region
  // siblings as "Roaming partner · 4G" — but that was misleading. A Japan
  // eSIM does NOT actually roam onto Korea/China carriers; those are
  // separate plans. The upsell below points buyers to the right regional
  // pack if they want broader coverage.)
  const coverage: { flag: string; name: string; net: string }[] = [
    {
      flag: meta.flag,
      name: meta.name,
      net: `${meta.networks.split(',')[0].trim()} · 5G`,
    },
  ]

  // Honest upsell — for countries also reachable on a regional pack we sell,
  // suggest the pack with a one-line pitch. Empty for countries with no
  // matching regional pack (e.g. US — Americas isn't covered today).
  const REGIONAL_UPSELL: Record<string, { regionalCode: string; pitch: string }> = {
    JP: { regionalCode: 'AP', pitch: 'Heading on to Korea, Singapore, or Bali too?' },
    KR: { regionalCode: 'AP', pitch: 'Continuing to Japan, Singapore, or Bali?' },
    CN: { regionalCode: 'CHM', pitch: 'Adding Hong Kong or Macau to the trip?' },
  }
  const upsellEntry = !meta.isRegional ? REGIONAL_UPSELL[meta.code] : undefined
  const upsellRegional = upsellEntry
    ? REGIONAL_PLANS_META.find((r) => r.code === upsellEntry.regionalCode)
    : undefined

  const goCheckout = (planId: string) => {
    const p = visible.find((x) => x.id === planId)
    track('plan_clicked', {
      plan_id: planId,
      country: meta?.code,
      price_cents: p?.price_cents ?? null,
    })
    navigate(`/checkout?plan=${encodeURIComponent(planId)}`)
  }

  return (
    <>
      <section className="detail-hero">
        <div className="detail-hero-inner">
          <div>
            <div className="breadcrumb">
              <Link to="/" style={{ color: 'var(--ink-3)' }}>Home</Link> /{' '}
              <Link to="/destinations" style={{ color: 'var(--ink-3)' }}>Destinations</Link> /{' '}
              <span style={{ color: 'var(--ink)' }}>{meta.name}</span>
            </div>
            <h1 className="detail-title">
              <span className="flag-big">{meta.flag}</span>
              {meta.name}
            </h1>
            <p className="lede">
              {meta.isRegional
                ? meta.desc
                : `Local 4G/5G data via ${meta.networks}. Activate the second you land — no airport SIM queues, no roaming bills.`}
            </p>

            <div className="detail-facts">
              <div className="detail-fact">
                <div className="label">From</div>
                <div className="val num">
                  {cheapest ? `$${priceDollars(cheapest.price_cents)}` : '—'}{' '}
                  {cheapest && (
                    <span className="muted" style={{ fontSize: 13, fontWeight: 400 }}>
                      / {formatData(cheapest.data_gb)}
                    </span>
                  )}
                </div>
              </div>
              <div className="detail-fact">
                <div className="label">{meta.isRegional ? 'Coverage' : 'Networks'}</div>
                <div className="val">{meta.isRegional ? meta.scope : meta.networks}</div>
              </div>
              <div className="detail-fact">
                <div className="label">Speed</div>
                <div className="val">4G/5G</div>
              </div>
              <div className="detail-fact">
                <div className="label">Validity</div>
                <div className="val">
                  {shortest !== null && longest !== null
                    ? shortest === longest
                      ? `${shortest} days`
                      : `${shortest} – ${longest} days`
                    : '—'}
                </div>
              </div>
            </div>
          </div>

          {/* Hero art card. Shows the destination photo when meta.image is set,
              with a dark gradient overlay so the corner label stays legible.
              Falls back to a per-country CSS gradient when no image is configured. */}
          <div
            className="detail-artcard"
            style={
              meta.image
                ? {
                    backgroundImage: `linear-gradient(180deg, transparent 50%, rgba(11,31,58,.55) 100%), url(${meta.image})`,
                    backgroundSize: 'cover',
                    backgroundPosition: 'center',
                  }
                : {
                    background:
                      meta.code === 'JP'
                        ? 'radial-gradient(circle at 30% 40%, #E85D3C 0 18%, transparent 19%), linear-gradient(180deg, #2C3E63 0%, #0B1F3A 100%)'
                        : meta.code === 'US'
                          ? 'linear-gradient(180deg, #3A5FAD 0%, #1E3566 100%)'
                          : meta.code === 'KR'
                            ? 'linear-gradient(180deg, #5068A8 0%, #1F2D5C 100%)'
                            : meta.code === 'CN' || meta.code === 'CHM'
                              ? 'linear-gradient(180deg, #C4333A 0%, #6A1820 100%)'
                              : meta.code === 'EU'
                                ? 'linear-gradient(180deg, #2B4A82 0%, #0E1F46 100%)'
                                : meta.code === 'AP'
                                  ? 'linear-gradient(180deg, #4A9E8A 0%, #1E4D44 100%)'
                                  : 'linear-gradient(180deg, #2C3E63 0%, #0B1F3A 100%)',
                  }
            }
          >
            <div className="lbl">
              <span>NIMVOY · {meta.code}</span>
              <span>{meta.flag}</span>
            </div>
          </div>
        </div>
      </section>

      <section className="plans-section">
        <div className="plans-inner">
          {/* Eyebrow + tabs — dropped the headline ("Transparent per-GB
              pricing.") since the destination hero already gives the page
              its identity. The eyebrow stays for section orientation. */}
          <div className="plans-head plans-head--tabs-only">
            <div>
              <div className="eyebrow" style={{ marginBottom: 12 }}>
                Choose a plan
              </div>
            </div>
            <div className="plan-tabs">
              <button
                className={tab === 'regular' ? 'active' : ''}
                onClick={() => setTab('regular')}
              >
                <span className="dot"></span> Regular plans
              </button>
              <button
                className={tab === 'unlimited' ? 'active' : ''}
                onClick={() => setTab('unlimited')}
                disabled={unlimitedPlans.length === 0}
              >
                <span className="dot"></span> Unlimited
              </button>
            </div>
          </div>

          {loading && visible.length === 0 && (
            <div style={{ padding: 40, color: 'var(--ink-3)' }}>Loading plans…</div>
          )}

          {!loading && visible.length === 0 && (
            <div style={{ padding: 40, color: 'var(--ink-3)' }}>
              No {tab} plans available for {meta.name} yet.
            </div>
          )}

          {visible.length > 0 && (
            <div className="plans-included" aria-label="Features included with every plan">
              <span className="plans-included__lbl">Every plan includes</span>
              <span className="plans-included__item">
                <Icon name="signal" size={14} /> 4G/5G data
              </span>
              <span className="plans-included__item">
                <Icon name="hotspot" size={14} /> Hotspot &amp; tethering
              </span>
              <span className="plans-included__item">
                <Icon name="bolt" size={14} /> Instant activation
              </span>
            </div>
          )}

          {/* Pre-purchase reassurance: "wait, will my phone work?"
              moment lands right where customers are about to commit.
              Same dashed-border treatment as the "Every plan includes"
              strip above, so it reads as part of the trust scaffolding. */}
          {visible.length > 0 && (
            <button
              type="button"
              className="compat-strip"
              onClick={() => setCompatOpen(true)}
            >
              <span className="compat-strip__icon"><Icon name="phone" size={14} /></span>
              <span className="compat-strip__copy">
                <strong>Will your phone work?</strong>
                <span className="compat-strip__sub">Check eSIM compatibility in one tap.</span>
              </span>
              <span className="compat-strip__cta">
                Check now <Icon name="arrow" size={12} />
              </span>
            </button>
          )}

          {/* Duration-first grouping. Customers think trip length
              first ("I'm in Tokyo for 7 days"), data second. Group
              plans by validity_days, sort ascending; within each
              group, sort by data ascending. Each row is a single
              clickable button — direct-to-checkout, no two-step
              select-then-buy. */}
          {(() => {
            const byDays = visible.reduce<Record<number, Plan[]>>((acc, p) => {
              acc[p.validity_days] = acc[p.validity_days] || []
              acc[p.validity_days].push(p)
              return acc
            }, {})
            const dayKeys = Object.keys(byDays)
              .map(Number)
              .sort((a, b) => a - b)
            return dayKeys.map((days) => {
              const rows = byDays[days].slice().sort((a, b) => a.data_gb - b.data_gb)
              return (
                <section key={days} className="plans-day">
                  <h3 className="plans-day__h">
                    {days} day{days === 1 ? '' : 's'}
                  </h3>
                  <div className="plans-day__rows">
                    {rows.map((p) => {
                      const perGb =
                        !isUnlimited(p) && p.data_gb > 0
                          ? p.price_cents / p.data_gb
                          : null
                      return (
                        <PlanRow
                          key={p.id}
                          plan={p}
                          countryCode={meta.code}
                          perGb={perGb}
                          onBuy={() => goCheckout(p.id)}
                        />
                      )
                    })}
                  </div>
                </section>
              )
            })
          })()}

          {/* Below-the-grid notes. Country pages: single "Good to know" card.
              Regional packs: same card plus a Coverage card listing the
              countries in the pack (genuinely informative for a multi-country
              SKU, vs redundant for a single country whose name is in the
              hero). */}
          <div className={`detail-info ${meta.isRegional ? '' : 'detail-info--single'}`}>
            <div className="info-card">
              <h3>Good to know</h3>
              <InfoRow icon="phone" label="Calls & SMS" value="Use WhatsApp / FaceTime" />
              <InfoRow icon="clock" label="Activation" value="On first network connection" />
              <InfoRow icon="bolt" label="Need more data?" value="Buy a new plan" last />
            </div>
            {meta.isRegional && (
              <div className="info-card">
                <h3>Coverage</h3>
                <ul className="coverage-list">
                  {coverage.map((c, i) => (
                    <li key={i}>
                      <span className="flag">{c.flag}</span>
                      <span>{c.name}</span>
                      <span className="net">{c.net}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {!meta.isRegional && upsellRegional && (
              <div className="coverage-upsell coverage-upsell--inline">
                <p className="muted">{upsellEntry!.pitch}</p>
                <Link
                  to={`/destinations/${upsellRegional.code.toLowerCase()}`}
                  className="coverage-upsell-cta"
                >
                  Try the {upsellRegional.name} plan <Icon name="arrow" size={12} />
                </Link>
              </div>
            )}
          </div>
        </div>
      </section>

      <CompatibilityModal open={compatOpen} onClose={() => setCompatOpen(false)} />
    </>
  )
}

// Horizontal plan row used inside a duration-grouped section.
// Direct-to-checkout: the whole row is one button. No two-step
// "select then buy" — keeps the customer's path linear.
// countryCode is accepted but unused — the country/5G badge was
// redundant on a destination page (every plan IS for that country).
// Left as a param so callers don't break and we can re-add if we
// ever surface multi-region plans on a single destination page.
function PlanRow({
  plan,
  perGb,
  onBuy,
}: {
  plan: Plan
  countryCode: string
  perGb: number | null
  onBuy: () => void
}) {
  const unlimited = isUnlimited(plan)
  return (
    <button type="button" className="plan-row" onClick={onBuy}>
      <span className="plan-row__data">
        {unlimited ? 'Unlimited' : `${plan.data_gb} GB`}
      </span>
      <span className="plan-row__price-block">
        {perGb !== null && (
          <span className="plan-row__pergb">${priceDollars(Math.round(perGb))}/GB</span>
        )}
        <span className="plan-row__price">
          <b>${priceDollars(plan.price_cents)}</b>
          <span className="plan-row__currency">USD</span>
        </span>
        <Icon name="arrow" size={14} />
      </span>
    </button>
  )
}

function InfoRow({
  icon,
  label,
  value,
  last,
}: {
  icon: Parameters<typeof Icon>[0]['name']
  label: string
  value: string
  last?: boolean
}) {
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '12px 0',
        borderBottom: last ? 'none' : '1px solid var(--line)',
        fontSize: 14,
      }}
    >
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 10 }}>
        <Icon name={icon} size={14} /> {label}
      </span>
      <span className="mono muted">{value}</span>
    </div>
  )
}
