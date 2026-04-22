// Source of truth for the M2–M4 fixture catalog. Mirrors what
// backend/app/seed_catalog.py will write to prod at M5 cutover — same SKUs,
// same prices, same country/region/plan_type fields — so swapping to a live
// fetch against /api/plans later is a one-line change in src/api/plans.ts.

export interface Plan {
  id: string
  name: string
  country: string
  region: string
  plan_type: 'country' | 'regional'
  data_gb: number // 999 == unlimited
  validity_days: number
  price_cents: number
  currency: string
}

export interface CountryMeta {
  code: string
  name: string
  flag: string
  region: string
  networks: string
  popular?: boolean
}

export interface RegionalMeta {
  code: string // 'EU' | 'AP' | 'CHM'
  name: string
  flag: string // emoji
  region: string
  networks: string
  scope: string // "36 countries", etc
  icon: string // emoji for banner card
  desc: string
  featured?: boolean
}

export interface Review {
  name: string
  from: string
  stars: number
  text: string
}

// ---- Plans (31 total) ----
// Kept in a single flat array so the fixture stays 1:1 with the eventual
// /api/plans response. Derived views (by country, cheapest, etc) are
// computed below.
export const PLANS: Plan[] = [
  // -- Country: China --
  { id: 'eSIM-CIMCN1G-01',   name: 'China 1 Day 1GB',          country: 'CN', region: 'asia',      plan_type: 'country',  data_gb: 1,   validity_days: 1,  price_cents: 100,  currency: 'usd' },
  { id: 'eSIM-CIMCNT5G-07',  name: 'China 7 Days 5GB',         country: 'CN', region: 'asia',      plan_type: 'country',  data_gb: 5,   validity_days: 7,  price_cents: 500,  currency: 'usd' },
  { id: 'eSIM-CIMCNT10G-07', name: 'China 7 Days 10GB',        country: 'CN', region: 'asia',      plan_type: 'country',  data_gb: 10,  validity_days: 7,  price_cents: 800,  currency: 'usd' },
  { id: 'eSIM-CN10M-07',     name: 'China 7 Days Unlimited',   country: 'CN', region: 'asia',      plan_type: 'country',  data_gb: 999, validity_days: 7,  price_cents: 1800, currency: 'usd' },
  { id: 'eSIM-CIMCNT20G-30', name: 'China 30 Days 20GB',       country: 'CN', region: 'asia',      plan_type: 'country',  data_gb: 20,  validity_days: 30, price_cents: 2000, currency: 'usd' },
  // -- Country: Japan --
  { id: 'eSIM-JPT5G-07',     name: 'Japan 7 Days 5GB',         country: 'JP', region: 'asia',      plan_type: 'country',  data_gb: 5,   validity_days: 7,  price_cents: 600,  currency: 'usd' },
  { id: 'eSIM-JPT10G-07',    name: 'Japan 7 Days 10GB',        country: 'JP', region: 'asia',      plan_type: 'country',  data_gb: 10,  validity_days: 7,  price_cents: 800,  currency: 'usd' },
  { id: 'eSIM-JP10M-07',     name: 'Japan 7 Days Unlimited',   country: 'JP', region: 'asia',      plan_type: 'country',  data_gb: 999, validity_days: 7,  price_cents: 1800, currency: 'usd' },
  // -- Country: Korea --
  { id: 'eSIM-KRT5G-07',     name: 'Korea 7 Days 5GB',         country: 'KR', region: 'asia',      plan_type: 'country',  data_gb: 5,   validity_days: 7,  price_cents: 400,  currency: 'usd' },
  { id: 'eSIM-KRT10G-07',    name: 'Korea 7 Days 10GB',        country: 'KR', region: 'asia',      plan_type: 'country',  data_gb: 10,  validity_days: 7,  price_cents: 700,  currency: 'usd' },
  { id: 'eSIM-KRMAX-07',     name: 'Korea 7 Days Unlimited',   country: 'KR', region: 'asia',      plan_type: 'country',  data_gb: 999, validity_days: 7,  price_cents: 1600, currency: 'usd' },
  // -- Country: USA --
  { id: 'eSIM-US1G-01',      name: 'USA 1 Day 1GB',            country: 'US', region: 'americas',  plan_type: 'country',  data_gb: 1,   validity_days: 1,  price_cents: 100,  currency: 'usd' },
  { id: 'eSIM-UST5G-07',     name: 'USA 7 Days 5GB',           country: 'US', region: 'americas',  plan_type: 'country',  data_gb: 5,   validity_days: 7,  price_cents: 600,  currency: 'usd' },
  { id: 'eSIM-UST10G-07',    name: 'USA 7 Days 10GB',          country: 'US', region: 'americas',  plan_type: 'country',  data_gb: 10,  validity_days: 7,  price_cents: 890,  currency: 'usd' },
  { id: 'eSIM-USMAX-07',     name: 'USA 7 Days Unlimited',     country: 'US', region: 'americas',  plan_type: 'country',  data_gb: 999, validity_days: 7,  price_cents: 1900, currency: 'usd' },
  { id: 'eSIM-UST20G-30',    name: 'USA 30 Days 20GB',         country: 'US', region: 'americas',  plan_type: 'country',  data_gb: 20,  validity_days: 30, price_cents: 1990, currency: 'usd' },
  // -- Regional: China + HK + Macau --
  { id: 'eSIM-CHM1G-01',     name: 'China + HK + Macau 1 Day 1GB',        country: 'CHM', region: 'china-region', plan_type: 'regional', data_gb: 1,   validity_days: 1,  price_cents: 100,  currency: 'usd' },
  { id: 'eSIM-CHMT5G-07',    name: 'China + HK + Macau 7 Days 5GB',       country: 'CHM', region: 'china-region', plan_type: 'regional', data_gb: 5,   validity_days: 7,  price_cents: 600,  currency: 'usd' },
  { id: 'eSIM-CHMT10G-07',   name: 'China + HK + Macau 7 Days 10GB',      country: 'CHM', region: 'china-region', plan_type: 'regional', data_gb: 10,  validity_days: 7,  price_cents: 900,  currency: 'usd' },
  { id: 'eSIM-CHM10M-07',    name: 'China + HK + Macau 7 Days Unlimited', country: 'CHM', region: 'china-region', plan_type: 'regional', data_gb: 999, validity_days: 7,  price_cents: 2500, currency: 'usd' },
  { id: 'eSIM-CHMT20G-30',   name: 'China + HK + Macau 30 Days 20GB',     country: 'CHM', region: 'china-region', plan_type: 'regional', data_gb: 20,  validity_days: 30, price_cents: 2000, currency: 'usd' },
  // -- Regional: Europe --
  { id: 'eSIM-EUCT5G-07',    name: 'Europe 7 Days 5GB',          country: 'EU', region: 'europe',  plan_type: 'regional', data_gb: 5,   validity_days: 7,  price_cents: 600,  currency: 'usd' },
  { id: 'eSIM-EUCT10G-07',   name: 'Europe 7 Days 10GB',         country: 'EU', region: 'europe',  plan_type: 'regional', data_gb: 10,  validity_days: 7,  price_cents: 990,  currency: 'usd' },
  { id: 'eSIM-EUC10M-07',    name: 'Europe 7 Days Unlimited',    country: 'EU', region: 'europe',  plan_type: 'regional', data_gb: 999, validity_days: 7,  price_cents: 2500, currency: 'usd' },
  { id: 'eSIM-EUCT5G-15',    name: 'Europe 15 Days 5GB',         country: 'EU', region: 'europe',  plan_type: 'regional', data_gb: 5,   validity_days: 15, price_cents: 700,  currency: 'usd' },
  { id: 'eSIM-EUCT10G-15',   name: 'Europe 15 Days 10GB',        country: 'EU', region: 'europe',  plan_type: 'regional', data_gb: 10,  validity_days: 15, price_cents: 1090, currency: 'usd' },
  // -- Regional: Asia-Pacific --
  { id: 'eSIM-APACAT5G-07',  name: 'Asia-Pacific 7 Days 5GB',    country: 'AP', region: 'asia-pacific', plan_type: 'regional', data_gb: 5,   validity_days: 7,  price_cents: 650,  currency: 'usd' },
  { id: 'eSIM-APACAT10G-07', name: 'Asia-Pacific 7 Days 10GB',   country: 'AP', region: 'asia-pacific', plan_type: 'regional', data_gb: 10,  validity_days: 7,  price_cents: 1000, currency: 'usd' },
  { id: 'eSIM-APACAM10-07',  name: 'Asia-Pacific 7 Days Unlimited', country: 'AP', region: 'asia-pacific', plan_type: 'regional', data_gb: 999, validity_days: 7,  price_cents: 2500, currency: 'usd' },
  { id: 'eSIM-APACAT5G-15',  name: 'Asia-Pacific 15 Days 5GB',   country: 'AP', region: 'asia-pacific', plan_type: 'regional', data_gb: 5,   validity_days: 15, price_cents: 750,  currency: 'usd' },
  { id: 'eSIM-APACAT10G-15', name: 'Asia-Pacific 15 Days 10GB',  country: 'AP', region: 'asia-pacific', plan_type: 'regional', data_gb: 10,  validity_days: 15, price_cents: 1100, currency: 'usd' },
]

// ---- Country metadata (only countries with plans) ----
export const COUNTRIES: CountryMeta[] = [
  { code: 'US', name: 'United States', flag: '🇺🇸', region: 'americas', networks: 'T-Mobile, AT&T',        popular: true },
  { code: 'JP', name: 'Japan',         flag: '🇯🇵', region: 'asia',     networks: 'NTT Docomo, SoftBank', popular: true },
  { code: 'KR', name: 'South Korea',   flag: '🇰🇷', region: 'asia',     networks: 'SK Telecom, KT',       popular: true },
  { code: 'CN', name: 'China',         flag: '🇨🇳', region: 'asia',     networks: 'China Mobile, Unicom', popular: true },
]

export const REGIONAL_PLANS_META: RegionalMeta[] = [
  {
    code: 'CHM',
    name: 'China + HK + Macau',
    flag: '🇨🇳',
    region: 'china-region',
    networks: 'China Mobile, CSL, CTM',
    scope: '3 regions',
    icon: '🇨🇳',
    desc: 'Seamless coverage across mainland China, Hong Kong, and Macau — no VPN required for common apps.',
  },
  {
    code: 'EU',
    name: 'Europe',
    flag: '🇪🇺',
    region: 'europe',
    networks: 'Orange, Vodafone, T-Mobile',
    scope: '36 countries',
    icon: '🌍',
    desc: 'Covers the EU, UK, Switzerland & Balkans with a single eSIM.',
    featured: true,
  },
  {
    code: 'AP',
    name: 'Asia-Pacific',
    flag: '🌏',
    region: 'asia-pacific',
    networks: 'Local partners across APAC',
    scope: '21 countries',
    icon: '🌏',
    desc: 'From Tokyo to Bali on one plan — great for multi-stop itineraries.',
  },
]

// ---- Regions (for browse-page filtering) ----
export const REGIONS = [
  { id: 'all', label: 'All' },
  { id: 'asia', label: 'Asia' },
  { id: 'americas', label: 'Americas' },
  { id: 'europe', label: 'Europe' },
  { id: 'asia-pacific', label: 'Asia-Pacific' },
  { id: 'china-region', label: 'China + HK + Macau' },
] as const

// ---- Reviews (placeholder copy; replace with real testimonials later) ----
export const REVIEWS: Review[] = [
  {
    name: 'Maya R.',
    from: 'Bangkok → Kyoto',
    stars: 5,
    text: 'Installed at the airport in under a minute. Switched networks automatically when I crossed into Japan from Korea. The peace of mind alone was worth it.',
  },
  {
    name: 'Daniel K.',
    from: 'Berlin → Lisbon',
    stars: 5,
    text: 'Used the Europe regional plan across 4 countries. Speeds were consistently fast, and topping up from the app was painless.',
  },
  {
    name: 'Priya S.',
    from: 'Dubai → New York',
    stars: 5,
    text: "I travel for work every week — Nimvoy has replaced three SIM cards I used to carry. Billing is transparent and support answered in two minutes at 2am.",
  },
]

// ---- Approximate city coordinates for the globe markers ----
export const CITY_COORDS: Record<string, { lng: number; lat: number }> = {
  US: { lng: -98.0, lat: 39.5 },
  JP: { lng: 139.69, lat: 35.68 },
  KR: { lng: 126.98, lat: 37.57 },
  CN: { lng: 116.4, lat: 39.9 },
  EU: { lng: 10.0, lat: 50.0 }, // Central Europe
  AP: { lng: 120.0, lat: 10.0 }, // SE Asia
}

// ---- Derived helpers ----

export function priceDollars(cents: number): string {
  return (cents / 100).toFixed(2)
}

export function formatData(gb: number): string {
  return gb >= 999 ? 'Unlimited' : `${gb} GB`
}

export function isUnlimited(p: Plan): boolean {
  return p.data_gb >= 999
}

export function plansForCountry(plans: Plan[], code: string): Plan[] {
  return plans
    .filter((p) => p.country === code)
    .sort((a, b) => a.data_gb - b.data_gb || a.validity_days - b.validity_days)
}

/** Cheapest price across a country's plans (in cents). */
export function fromPrice(plans: Plan[], code: string): number | null {
  const matches = plans.filter((p) => p.country === code)
  if (matches.length === 0) return null
  return Math.min(...matches.map((p) => p.price_cents))
}

/** Country codes that actually have at least one plan. */
export function availableCountryCodes(plans: Plan[]): string[] {
  return Array.from(new Set(plans.filter((p) => p.plan_type === 'country').map((p) => p.country)))
}
