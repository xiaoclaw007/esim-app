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
  // Hero photo URL for the destination detail page. Optional — when absent,
  // the page renders the existing CSS-gradient art card. Today we point to
  // Unsplash CDN URLs (free, commercial-use, no attribution required under
  // the Unsplash License). Swap to your own hosted image any time.
  image?: string
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
  // See CountryMeta.image. Same fallback semantics.
  image?: string
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
// Image URLs: Unsplash CDN, free under the Unsplash License. Sized w=1600
// q=80 — large enough for retina hero treatment without bloating the page.
const _UNSPLASH = (id: string) => `https://images.unsplash.com/${id}?w=1600&q=80&auto=format&fit=crop`

export const COUNTRIES: CountryMeta[] = [
  { code: 'US', name: 'United States',        flag: '🇺🇸', region: 'americas', networks: 'T-Mobile, AT&T',                  popular: true, image: _UNSPLASH('photo-1750074543601-72f7972d5a8b') },
  { code: 'JP', name: 'Japan',                flag: '🇯🇵', region: 'asia',     networks: 'NTT Docomo, SoftBank',           popular: true, image: _UNSPLASH('photo-1528164344705-47542687000d') },
  { code: 'KR', name: 'South Korea',          flag: '🇰🇷', region: 'asia',     networks: 'SK Telecom, KT',                 popular: true, image: _UNSPLASH('photo-1762267616547-6d6cd4adabc3') },
  { code: 'CN', name: 'China',                flag: '🇨🇳', region: 'asia',     networks: 'China Mobile, Unicom',           popular: true, image: _UNSPLASH('photo-1508804185872-d7badad00f7d') },
  { code: 'TH', name: 'Thailand',             flag: '🇹🇭', region: 'asia',     networks: 'AIS, TrueMove H',                popular: true, image: _UNSPLASH('photo-1563492065599-3520f775eeed') },
  { code: 'TW', name: 'Taiwan',               flag: '🇹🇼', region: 'asia',     networks: 'Chunghwa Telecom, Far EasTone', popular: true, image: _UNSPLASH('photo-1601534621622-8587a8a0da11') },
  { code: 'TR', name: 'Turkey',               flag: '🇹🇷', region: 'europe',   networks: 'Turkcell, Vodafone',             popular: true, image: _UNSPLASH('photo-1604156789095-3348604c0f43') },
  { code: 'AE', name: 'United Arab Emirates', flag: '🇦🇪', region: 'asia',     networks: 'Etisalat, du',                   popular: true, image: _UNSPLASH('photo-1512453979798-5ea266f8880c') },
  // Newly launched 2026-05-17. No hero image yet — page falls back to
  // the CSS gradient art card; add Unsplash IDs once we pick photos.
  { code: 'AL', name: 'Albania',              flag: '🇦🇱', region: 'europe',   networks: 'Vodafone Albania, One Telecom' },
  { code: 'DZ', name: 'Algeria',              flag: '🇩🇿', region: 'africa',   networks: 'Mobilis, Djezzy' },
  { code: 'AD', name: 'Andorra',              flag: '🇦🇩', region: 'europe',   networks: 'Andorra Telecom' },
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
    image: _UNSPLASH('photo-1741135742394-97c2a5b61080'),
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
    image: _UNSPLASH('photo-1518057509104-47943ca12e4f'),
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
    image: _UNSPLASH('photo-1523482580672-f109ba8cb9be'),
  },
  {
    code: 'ANZ',
    name: 'Australia + New Zealand',
    flag: '🇦🇺',
    region: 'oceania',
    networks: 'Telstra, Optus, Spark',
    scope: '2 countries',
    icon: '🇦🇺',
    desc: 'One eSIM for both Australia and New Zealand — pick up the same plan whether you start in Sydney or Auckland.',
    image: _UNSPLASH('photo-1610056352054-a68fe4f998e1'),
  },
  {
    code: 'NAM',
    name: 'USA + Canada + Mexico',
    flag: '🇺🇸',
    region: 'americas',
    networks: 'AT&T, Rogers, Telcel',
    scope: '3 countries',
    icon: '🌎',
    desc: 'North America on a single plan — ideal for road trips that cross the border.',
    image: _UNSPLASH('photo-1560996043-f896c5844d32'),
  },
  {
    code: 'SEA',
    name: 'Southeast Asia',
    flag: '🌏',
    region: 'asia',
    networks: 'Singtel, Maxis, Telkomsel, AIS',
    scope: '4 countries',
    icon: '🌏',
    desc: 'Singapore, Malaysia, Indonesia, and Thailand on one eSIM — a cleaner four-country bundle than the broader Asia-Pacific plan.',
    image: _UNSPLASH('photo-1508964942454-1a56651d54ac'),
  },
  {
    code: 'SPG',
    name: 'Saipan + Guam',
    flag: '🇬🇺',
    region: 'oceania',
    networks: 'Local US-territory carriers',
    scope: '2 territories',
    icon: '🌴',
    desc: 'Pacific-island coverage for Saipan and Guam — useful for diving trips and US-territory travel.',
    image: _UNSPLASH('photo-1603477849227-705c424d1d80'),
  },
  {
    code: 'SAM',
    name: 'South America',
    flag: '🌎',
    region: 'americas',
    networks: 'Local carriers per country',
    scope: '6 countries',
    icon: '🌎',
    desc: 'Brazil, Argentina, Chile, Ecuador, Peru, and Uruguay on one plan — perfect for the Andes-to-Atlantic loop.',
    image: _UNSPLASH('photo-1587595431973-160d0d94add1'),
  },
  {
    code: 'AFR',
    name: 'Africa',
    flag: '🌍',
    region: 'africa',
    networks: 'Local carriers per country',
    scope: 'Multi-country',
    icon: '🌍',
    desc: 'Multi-country eSIM coverage across Africa. Carrier list available on request.',
    image: _UNSPLASH('photo-1577971132997-c10be9372519'),
  },
]

// ---- Regions (for browse-page filtering) ----
export const REGIONS = [
  { id: 'all', label: 'All' },
  { id: 'asia', label: 'Asia' },
  { id: 'americas', label: 'Americas' },
  { id: 'europe', label: 'Europe' },
  { id: 'oceania', label: 'Oceania' },
  { id: 'africa', label: 'Africa' },
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
