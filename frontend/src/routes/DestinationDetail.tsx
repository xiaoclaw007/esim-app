import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
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
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const meta = resolveMeta(codeParam)

  // One destination_view ping per visit to a destination page.
  useEffect(() => {
    if (meta) track('destination_view', { country: meta.code, name: meta.name })
  }, [meta?.code])

  const allPlans = useMemo(() => (plans && meta ? plansForCountry(plans, meta.code) : []), [plans, meta])
  const regularPlans = useMemo(() => allPlans.filter((p) => !isUnlimited(p)), [allPlans])
  const unlimitedPlans = useMemo(() => allPlans.filter(isUnlimited), [allPlans])

  const visible = tab === 'unlimited' ? unlimitedPlans : regularPlans
  // Mark the middle plan as "Most popular" if we have 3+.
  const popularIdx = visible.length >= 3 ? Math.floor(visible.length / 2) : -1

  // Default-select the popular plan (or first) when the tab or list changes.
  const defaultSelectedId = visible[popularIdx]?.id ?? visible[0]?.id ?? null
  const effectiveSelected = selectedId && visible.some((p) => p.id === selectedId) ? selectedId : defaultSelectedId

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
                <div className="val">4G/5G, up to 400 Mbps</div>
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
          <div className="plans-head">
            <div>
              <div className="eyebrow" style={{ marginBottom: 12 }}>
                Choose a plan
              </div>
              <h2 className="h1" style={{ fontSize: 36 }}>
                Transparent per-GB pricing.
              </h2>
            </div>
            <div className="plan-tabs">
              <button
                className={tab === 'regular' ? 'active' : ''}
                onClick={() => {
                  setTab('regular')
                  setSelectedId(null)
                }}
              >
                <span className="dot"></span> Regular plans
              </button>
              <button
                className={tab === 'unlimited' ? 'active' : ''}
                onClick={() => {
                  setTab('unlimited')
                  setSelectedId(null)
                }}
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

          <div className="plans-grid">
            {visible.map((p, i) => {
              const selected = effectiveSelected === p.id
              const popular = i === popularIdx
              const perGb = !isUnlimited(p) && p.data_gb > 0 ? p.price_cents / p.data_gb : null
              return (
                <PlanCard
                  key={p.id}
                  plan={p}
                  countryCode={meta.code}
                  selected={selected}
                  popular={popular}
                  perGb={perGb}
                  onSelect={() => setSelectedId(p.id)}
                  onBuy={() => goCheckout(p.id)}
                />
              )
            })}
          </div>

          <div className="detail-info">
            <div className="info-card">
              <h3>What's included</h3>
              <InfoRow icon="signal" label="Data (4G/5G)" value="Included" />
              <InfoRow icon="hotspot" label="Hotspot / tethering" value="Included" />
              <InfoRow icon="phone" label="Calls & SMS" value="Via WhatsApp / FaceTime" />
              <InfoRow icon="clock" label="Activation" value="On first connection" last />
            </div>
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
              {upsellRegional && (
                <div className="coverage-upsell">
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
        </div>
      </section>
    </>
  )
}

function PlanCard({
  plan,
  countryCode,
  selected,
  popular,
  perGb,
  onSelect,
  onBuy,
}: {
  plan: Plan
  countryCode: string
  selected: boolean
  popular: boolean
  perGb: number | null
  onSelect: () => void
  onBuy: () => void
}) {
  return (
    <div
      className={`plan ${selected ? 'selected' : ''}`}
      onClick={onSelect}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onSelect()
        }
      }}
    >
      {popular && (
        <div className="popular">
          <span className="badge accent">Most popular</span>
        </div>
      )}
      <div className="plan-head">
        <div>
          <div className="data">{formatData(plan.data_gb)}</div>
          <div className="days">{plan.validity_days} days validity</div>
        </div>
        <div className="badge">{countryCode} · 5G</div>
      </div>
      <div className="price">
        <b>${priceDollars(plan.price_cents)}</b> USD
        {perGb !== null && (
          <span className="per"> · ${priceDollars(Math.round(perGb))}/GB</span>
        )}
      </div>
      <ul>
        <li>High-speed 4G/5G data</li>
        <li>Hotspot &amp; tethering</li>
        <li>Instant activation</li>
        {plan.data_gb >= 10 && !isUnlimited(plan) && <li>Top-up anytime</li>}
      </ul>
      <button
        className={`btn ${selected ? 'primary' : 'subtle'} block`}
        onClick={(e) => {
          e.stopPropagation()
          onBuy()
        }}
      >
        Buy now · ${priceDollars(plan.price_cents)}
      </button>
    </div>
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
