# eSIM Reseller Website — Design Proposal

## Competitive Landscape

Top players: **Airalo**, **Holafly**, **Saily** (by NordVPN), **Nomad**, **GigSky**, **AloSIM**, **Ubigi**, **Yesim**, **Maya Mobile**, **Jetpac**

### Common Patterns Across Top Sites
- **Hero section** with search/destination picker front and center
- **Country/region grid** with flags — visual, scannable
- **Clean pricing cards** showing data, validity, price
- **Trust signals** — app store ratings, user count, press logos
- **Simple 3-step "how it works"** section
- **FAQ section** addressing eSIM basics
- **Mobile-first** design (most customers buy on phone)

---

## Proposed Site Structure

### Pages

| Page | Purpose |
|------|---------|
| **Home** | Hero + search + popular destinations + how it works + trust signals |
| **Browse / Destinations** | Country grid with search/filter, regional bundles |
| **Plan Detail** | Per-country page with plan cards (data, days, price, network info) |
| **Cart / Checkout** | Stripe-powered, guest checkout (email only), apply coupon |
| **My eSIMs** | Dashboard — view purchased eSIMs, QR codes, usage status |
| **How It Works** | Visual guide: check compatibility → buy → scan QR → connect |
| **FAQ / Support** | Common questions, contact form or chat widget |
| **About** | Brand story, why us |
| **Blog** (optional) | Travel tips, eSIM guides — SEO play |

---

## Home Page Layout

```
┌─────────────────────────────────────────────┐
│  HEADER: Logo | Destinations | How It Works | Login │
├─────────────────────────────────────────────┤
│                                             │
│   "Stay connected anywhere in the world"    │
│   [ 🔍 Search by country or region...    ]  │
│                                             │
├─────────────────────────────────────────────┤
│  POPULAR DESTINATIONS                       │
│  🇯🇵 Japan  🇹🇭 Thailand  🇺🇸 USA  🇬🇧 UK    │
│  🇰🇷 Korea  🇫🇷 France    🇮🇹 Italy  🇪🇸 Spain │
│  → View all destinations                   │
├─────────────────────────────────────────────┤
│  HOW IT WORKS                               │
│  1. Choose    →  2. Purchase  →  3. Connect │
│  destination     instant QR      scan & go  │
├─────────────────────────────────────────────┤
│  WHY CHOOSE US                              │
│  ✓ Instant delivery    ✓ 100+ countries     │
│  ✓ No roaming fees     ✓ 24/7 support       │
├─────────────────────────────────────────────┤
│  REGIONAL PLANS                             │
│  🌏 Asia  🌍 Europe  🌎 Americas  🌐 Global  │
├─────────────────────────────────────────────┤
│  TRUST: "Trusted by X+ travelers"           │
│  ⭐⭐⭐⭐⭐  Press logos / reviews            │
├─────────────────────────────────────────────┤
│  FAQ (accordion)                            │
├─────────────────────────────────────────────┤
│  FOOTER: Links | Socials | Contact          │
└─────────────────────────────────────────────┘
```

---

## Plan Detail Page Layout

```
┌─────────────────────────────────────────────┐
│  🇯🇵 Japan eSIM Plans                       │
│  Network: NTT Docomo, SoftBank              │
│  Coverage: 5G/LTE                           │
├─────────────────────────────────────────────┤
│  ┌──────────┐ ┌──────────┐ ┌──────────┐    │
│  │  1 GB    │ │  3 GB    │ │  5 GB    │    │
│  │  7 days  │ │  15 days │ │  30 days │    │
│  │  $4.50   │ │  $9.00   │ │  $13.00  │    │
│  │ [Buy Now]│ │ [Buy Now]│ │ [Buy Now]│    │
│  └──────────┘ └──────────┘ └──────────┘    │
│                                             │
│  ┌──────────┐ ┌──────────┐                  │
│  │  10 GB   │ │ Unlimited│                  │
│  │  30 days │ │  30 days │                  │
│  │  $20.00  │ │  $35.00  │                  │
│  │ [Buy Now]│ │ [Buy Now]│                  │
│  └──────────┘ └──────────┘                  │
├─────────────────────────────────────────────┤
│  ℹ️ Plan Details                             │
│  • Data only / Data + calls                 │
│  • Supported devices list                   │
│  • Activation policy                        │
│  • Refund policy                            │
└─────────────────────────────────────────────┘
```

---

## Tech Stack Recommendation

| Layer | Choice | Why |
|-------|--------|-----|
| **Frontend** | Next.js (React) | SEO via SSR, fast, huge ecosystem |
| **Styling** | Tailwind CSS | Rapid UI development, clean look |
| **Payments** | Stripe | Industry standard, supports global currencies |
| **Auth** | NextAuth.js or Clerk | Simple email/social login |
| **Database** | PostgreSQL (via Supabase or PlanetScale) | Reliable, scalable |
| **eSIM API** | Your provider's API | Order fulfillment, QR generation |
| **Hosting** | Vercel | Zero-config Next.js deploys |
| **Email** | Resend or SendGrid | Order confirmation, QR delivery |
| **Analytics** | PostHog or Plausible | Privacy-friendly tracking |

---

## Key Differentiators to Consider

1. **Price comparison** — show savings vs roaming fees
2. **Device compatibility checker** — "Is my phone eSIM compatible?" tool
3. **Instant QR delivery** — email + in-dashboard, no app required
4. **Referral program** — viral growth channel
5. **Multi-language** — especially CJK if targeting Asian travelers
6. **Blog/SEO content** — "Best eSIM for Japan 2026" type posts drive organic traffic

---

## MVP Scope (Phase 1)

Ship fast, iterate:
- Home page with country search
- Country → plan listing → Stripe checkout
- Email delivery of QR code
- Basic "My eSIMs" dashboard
- Mobile-responsive design
- FAQ page

### Phase 2
- User accounts & order history
- Referral system
- Regional/global plans
- Blog
- Multi-currency support

### Phase 3
- Mobile app (React Native)
- AI plan recommendations
- Usage monitoring dashboard
- Multi-language

---

## Next Steps

1. **Confirm tech stack** — are you comfortable with Next.js + Tailwind?
2. **Share provider API docs** — I'll need to understand the ordering/fulfillment flow
3. **Brand identity** — name, colors, logo? Or want me to propose some?
4. **Domain** — have one picked out?

Let me know what direction you want to go and I can start building. 🚀
