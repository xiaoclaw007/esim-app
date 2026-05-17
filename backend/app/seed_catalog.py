"""Seed/upsert the production JoyTel plan catalog.

Idempotent: upserts each plan by Plan.id (which may differ from joytel_sku
when a single JoyTel product is sold under multiple surfaces — see below).
Leaves the `esim-test-plan` sandbox row untouched.

## Listings vs JoyTel products

A `Plan` row represents a *listing* — how we sell something on our site:
its display name, country, region, and price. The `joytel_sku` column is
the underlying JoyTel product code we actually order when a customer pays.

Multiple listings can point to the same JoyTel SKU. Example: Algeria
appears as its own country page (`country="DZ"`) AND its SKU is part of
the Africa regional bundle (`country="AFR"`). Both listings carry the
same `joytel_sku`, but distinct `Plan.id`s, names, and prices.

Convention: when a SKU has multiple listings, use a suffixed listing_id
like `f"{sku}.{country}"` (e.g. `"eSIM-AFAT5G-07.DZ"`). The first/default
listing keeps the bare SKU as its id for backward compatibility with
existing Order rows.

Usage:
    python -m app.seed_catalog
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Optional

from app.database import Base, SessionLocal, engine
from app.models import Plan


@dataclass(frozen=True)
class CatalogEntry:
    sku: str  # JoyTel product code — what we send when ordering
    name: str
    country: str  # ISO-2 for country plans, bespoke code for regional
    region: str  # geographic grouping used for the Destinations page
    plan_type: str  # "country" or "regional"
    data_gb: int  # 999 == unlimited
    validity_days: int
    price_cents: int
    listing_id: Optional[str] = None  # defaults to `sku`; set when one SKU has multiple listings


def _id_for(entry: CatalogEntry) -> str:
    """Resolve the Plan.id for a catalog entry. Defaults to the JoyTel
    SKU for single-listing products; explicit `listing_id` is required
    whenever the same SKU appears in more than one listing."""
    return entry.listing_id or entry.sku


# Individual-country plans — data taken from the JoyTel SKU sheet
# (screenshot shared 2026-04-21). $ column is the retail price we charge.
COUNTRY_PLANS: list[CatalogEntry] = [
    # China
    CatalogEntry("eSIM-CIMCN1G-01",   "China 1 Day 1GB",           "CN", "asia", "country", 1,   1,  100),
    CatalogEntry("eSIM-CIMCNT5G-07",  "China 7 Days 5GB",          "CN", "asia", "country", 5,   7,  500),
    CatalogEntry("eSIM-CIMCNT10G-07", "China 7 Days 10GB",         "CN", "asia", "country", 10,  7,  800),
    CatalogEntry("eSIM-CN10M-07",     "China 7 Days Unlimited",    "CN", "asia", "country", 999, 7,  1800),
    CatalogEntry("eSIM-CIMCNT20G-30", "China 30 Days 20GB",        "CN", "asia", "country", 20,  30, 2000),
    # Japan
    CatalogEntry("eSIM-JPT5G-07",     "Japan 7 Days 5GB",          "JP", "asia", "country", 5,   7,  600),
    CatalogEntry("eSIM-JPT10G-07",    "Japan 7 Days 10GB",         "JP", "asia", "country", 10,  7,  800),
    CatalogEntry("eSIM-JP10M-07",     "Japan 7 Days Unlimited",    "JP", "asia", "country", 999, 7,  1800),
    # South Korea
    CatalogEntry("eSIM-KRT5G-07",     "Korea 7 Days 5GB",          "KR", "asia", "country", 5,   7,  400),
    CatalogEntry("eSIM-KRT10G-07",    "Korea 7 Days 10GB",         "KR", "asia", "country", 10,  7,  700),
    CatalogEntry("eSIM-KRMAX-07",     "Korea 7 Days Unlimited",    "KR", "asia", "country", 999, 7,  1600),
    # USA
    # Legacy listing_id from the original M1 seed (app/seed.py) — pinned
    # so the upsert finds the existing row instead of inserting a duplicate.
    CatalogEntry("eSIM-US1G-01",      "USA 1 Day 1GB",             "US", "americas", "country", 1,   1,  100, listing_id="us-1gb-1d"),
    CatalogEntry("eSIM-UST5G-07",     "USA 7 Days 5GB",            "US", "americas", "country", 5,   7,  600),
    CatalogEntry("eSIM-UST10G-07",    "USA 7 Days 10GB",           "US", "americas", "country", 10,  7,  890),
    CatalogEntry("eSIM-USMAX-07",     "USA 7 Days Unlimited",      "US", "americas", "country", 999, 7,  1900),
    CatalogEntry("eSIM-UST20G-30",    "USA 30 Days 20GB",          "US", "americas", "country", 20,  30, 1990),
    # United Arab Emirates
    CatalogEntry("eSIM-UAET3G-03",    "UAE 3 Days 3GB",            "AE", "asia", "country", 3,   3,  600),
    CatalogEntry("eSIM-UAE10M-03",    "UAE 3 Days Unlimited",      "AE", "asia", "country", 999, 3,  1790),
    CatalogEntry("eSIM-UAET5G-07",    "UAE 7 Days 5GB",            "AE", "asia", "country", 5,   7,  1000),
    CatalogEntry("eSIM-UAET10G-07",   "UAE 7 Days 10GB",           "AE", "asia", "country", 10,  7,  1720),
    CatalogEntry("eSIM-UAET5G-15",    "UAE 15 Days 5GB",           "AE", "asia", "country", 5,   15, 1050),
    CatalogEntry("eSIM-UAET10G-15",   "UAE 15 Days 10GB",          "AE", "asia", "country", 10,  15, 1800),
    CatalogEntry("eSIM-UAET10G-30",   "UAE 30 Days 10GB",          "AE", "asia", "country", 10,  30, 1900),
    CatalogEntry("eSIM-UAET20G-30",   "UAE 30 Days 20GB",          "AE", "asia", "country", 20,  30, 3100),
    # Taiwan (20GB SKUs intentionally skipped pending JoyTel sheet
    # confirmation — same name on two SKUs with different prices)
    CatalogEntry("eSIM-TWRT3G-03",    "Taiwan 3 Days 3GB",         "TW", "asia", "country", 3,   3,  250),
    CatalogEntry("eSIM-TWR10M-03",    "Taiwan 3 Days Unlimited",   "TW", "asia", "country", 999, 3,  800),
    CatalogEntry("eSIM-TWRT5G-07",    "Taiwan 7 Days 5GB",         "TW", "asia", "country", 5,   7,  500),
    CatalogEntry("eSIM-TWRT10G-07",   "Taiwan 7 Days 10GB",        "TW", "asia", "country", 10,  7,  790),
    CatalogEntry("eSIM-TWR10M-07",    "Taiwan 7 Days Unlimited",   "TW", "asia", "country", 999, 7,  1800),
    CatalogEntry("eSIM-TWRT5G-15",    "Taiwan 15 Days 5GB",        "TW", "asia", "country", 5,   15, 590),
    CatalogEntry("eSIM-TWRT10G-15",   "Taiwan 15 Days 10GB",       "TW", "asia", "country", 10,  15, 890),
    # Turkey
    CatalogEntry("eSIM-TURT3G-03",    "Turkey 3 Days 3GB",         "TR", "europe", "country", 3,   3,  300),
    CatalogEntry("eSIM-TURMAX-03",    "Turkey 3 Days Unlimited",   "TR", "europe", "country", 999, 3,  800),
    CatalogEntry("eSIM-TURT5G-07",    "Turkey 7 Days 5GB",         "TR", "europe", "country", 5,   7,  500),
    CatalogEntry("eSIM-TURT10G-07",   "Turkey 7 Days 10GB",        "TR", "europe", "country", 10,  7,  800),
    CatalogEntry("eSIM-TURMAX-07",    "Turkey 7 Days Unlimited",   "TR", "europe", "country", 999, 7,  1800),
    CatalogEntry("eSIM-TURT5G-15",    "Turkey 15 Days 5GB",        "TR", "europe", "country", 5,   15, 600),
    CatalogEntry("eSIM-TURT10G-15",   "Turkey 15 Days 10GB",       "TR", "europe", "country", 10,  15, 850),
    CatalogEntry("eSIM-TURT10G-30",   "Turkey 30 Days 10GB",       "TR", "europe", "country", 10,  30, 900),
    CatalogEntry("eSIM-TURT20G-30",   "Turkey 30 Days 20GB",       "TR", "europe", "country", 20,  30, 1600),
    # Thailand (all unlimited daily; 10M = 10GB-named-but-unlimited
    # per JoyTel naming convention — same as Korea / China 10M SKUs)
    CatalogEntry("eSIM-TH10M-03",     "Thailand 3 Days Unlimited", "TH", "asia", "country", 999, 3,  600),
    CatalogEntry("eSIM-TH10M-05",     "Thailand 5 Days Unlimited", "TH", "asia", "country", 999, 5,  1000),
    CatalogEntry("eSIM-TH10M-06",     "Thailand 6 Days Unlimited", "TH", "asia", "country", 999, 6,  1100),
    CatalogEntry("eSIM-TH10M-07",     "Thailand 7 Days Unlimited", "TH", "asia", "country", 999, 7,  1200),
    CatalogEntry("eSIM-TH10M-10",     "Thailand 10 Days Unlimited","TH", "asia", "country", 999, 10, 1500),
    # Albania (AL, europe) — JoyTel "multi-region F" pack. Prices derived
    # from RMB cost × 2 ÷ 7.0 (USD), rounded to nearest dollar.
    CatalogEntry("eSIM-FT3GB-03",     "Albania 3 Days 3GB",        "AL", "europe", "country", 3,   3,  300),
    CatalogEntry("eSIM-F10M-03",      "Albania 3 Days Unlimited",  "AL", "europe", "country", 999, 3,  1200),
    CatalogEntry("eSIM-FT5GB-07",     "Albania 7 Days 5GB",        "AL", "europe", "country", 5,   7,  500),
    CatalogEntry("eSIM-FT10GB-07",    "Albania 7 Days 10GB",       "AL", "europe", "country", 10,  7,  900),
    CatalogEntry("eSIM-F10M-07",      "Albania 7 Days Unlimited",  "AL", "europe", "country", 999, 7,  2700),
    CatalogEntry("eSIM-FT5GB-15",     "Albania 15 Days 5GB",       "AL", "europe", "country", 5,   15, 600),
    CatalogEntry("eSIM-FT10GB-15",    "Albania 15 Days 10GB",      "AL", "europe", "country", 10,  15, 1000),
    CatalogEntry("eSIM-FT5GB-30",     "Albania 30 Days 5GB",       "AL", "europe", "country", 5,   30, 700),
    CatalogEntry("eSIM-FT10GB-30",    "Albania 30 Days 10GB",      "AL", "europe", "country", 10,  30, 1100),
    CatalogEntry("eSIM-FT20GB-30",    "Albania 30 Days 20GB",      "AL", "europe", "country", 20,  30, 2000),
    # Algeria (DZ, africa) — JoyTel "Africa A" pack. 4 of the 8 SKUs are
    # shared with the existing Africa regional bundle (same underlying
    # JoyTel product); those use suffixed listing_ids so both surfaces
    # can list the same product at independent prices.
    CatalogEntry("eSIM-AFAT3G-03",    "Algeria 3 Days 3GB",        "DZ", "africa", "country", 3,   3,  600),
    CatalogEntry("eSIM-AFAT5G-07",    "Algeria 7 Days 5GB",        "DZ", "africa", "country", 5,   7,  1100, listing_id="eSIM-AFAT5G-07.DZ"),
    CatalogEntry("eSIM-AFAT10G-07",   "Algeria 7 Days 10GB",       "DZ", "africa", "country", 10,  7,  2000, listing_id="eSIM-AFAT10G-07.DZ"),
    CatalogEntry("eSIM-AFAT5G-15",    "Algeria 15 Days 5GB",       "DZ", "africa", "country", 5,   15, 1300, listing_id="eSIM-AFAT5G-15.DZ"),
    CatalogEntry("eSIM-AFAT10G-15",   "Algeria 15 Days 10GB",      "DZ", "africa", "country", 10,  15, 2200, listing_id="eSIM-AFAT10G-15.DZ"),
    # +$1 over the formula to keep the gradient (15d/5GB is also $13).
    CatalogEntry("eSIM-AFAT5G-30",    "Algeria 30 Days 5GB",       "DZ", "africa", "country", 5,   30, 1400),
    CatalogEntry("eSIM-AFAT10G-30",   "Algeria 30 Days 10GB",      "DZ", "africa", "country", 10,  30, 2300),
    CatalogEntry("eSIM-AFAT20G-30",   "Algeria 30 Days 20GB",      "DZ", "africa", "country", 20,  30, 4300),
    # France (FR, europe) — also on JoyTel's "multi-region F" pack
    # (same SKUs + same RMB costs as Albania). Every listing is a
    # shared-SKU case, so all 10 use suffixed listing_ids; prices
    # come out identical to Albania under the same formula.
    CatalogEntry("eSIM-FT3GB-03",     "France 3 Days 3GB",         "FR", "europe", "country", 3,   3,  300,  listing_id="eSIM-FT3GB-03.FR"),
    CatalogEntry("eSIM-F10M-03",      "France 3 Days Unlimited",   "FR", "europe", "country", 999, 3,  1200, listing_id="eSIM-F10M-03.FR"),
    CatalogEntry("eSIM-FT5GB-07",     "France 7 Days 5GB",         "FR", "europe", "country", 5,   7,  500,  listing_id="eSIM-FT5GB-07.FR"),
    CatalogEntry("eSIM-FT10GB-07",    "France 7 Days 10GB",        "FR", "europe", "country", 10,  7,  900,  listing_id="eSIM-FT10GB-07.FR"),
    CatalogEntry("eSIM-F10M-07",      "France 7 Days Unlimited",   "FR", "europe", "country", 999, 7,  2700, listing_id="eSIM-F10M-07.FR"),
    CatalogEntry("eSIM-FT5GB-15",     "France 15 Days 5GB",        "FR", "europe", "country", 5,   15, 600,  listing_id="eSIM-FT5GB-15.FR"),
    CatalogEntry("eSIM-FT10GB-15",    "France 15 Days 10GB",       "FR", "europe", "country", 10,  15, 1000, listing_id="eSIM-FT10GB-15.FR"),
    CatalogEntry("eSIM-FT5GB-30",     "France 30 Days 5GB",        "FR", "europe", "country", 5,   30, 700,  listing_id="eSIM-FT5GB-30.FR"),
    CatalogEntry("eSIM-FT10GB-30",    "France 30 Days 10GB",       "FR", "europe", "country", 10,  30, 1100, listing_id="eSIM-FT10GB-30.FR"),
    CatalogEntry("eSIM-FT20GB-30",    "France 30 Days 20GB",       "FR", "europe", "country", 20,  30, 2000, listing_id="eSIM-FT20GB-30.FR"),
    # Singapore (SG, asia) — JoyTel "SM" pack (Singapore+Malaysia bundle,
    # listed here as Singapore-only). If we ever add a Malaysia country
    # page using the same SKUs, those listings would use .MY-suffixed ids.
    CatalogEntry("eSIM-SMT3G-03",     "Singapore 3 Days 3GB",      "SG", "asia", "country", 3,   3,  200),
    CatalogEntry("eSIM-SM10M-03",     "Singapore 3 Days Unlimited","SG", "asia", "country", 999, 3,  800),
    CatalogEntry("eSIM-SMT5G-07",     "Singapore 7 Days 5GB",      "SG", "asia", "country", 5,   7,  400),
    CatalogEntry("eSIM-SMT10G-07",    "Singapore 7 Days 10GB",     "SG", "asia", "country", 10,  7,  700),
    CatalogEntry("eSIM-SM10M-07",     "Singapore 7 Days Unlimited","SG", "asia", "country", 999, 7,  1800),
    CatalogEntry("eSIM-SMT5G-15",     "Singapore 15 Days 5GB",     "SG", "asia", "country", 5,   15, 500),
    CatalogEntry("eSIM-SMT10G-15",    "Singapore 15 Days 10GB",    "SG", "asia", "country", 10,  15, 800),
    # +$1 over the formula to keep the gradient (15d/5GB is also $5).
    CatalogEntry("eSIM-SMT5G-30",     "Singapore 30 Days 5GB",     "SG", "asia", "country", 5,   30, 600),
    CatalogEntry("eSIM-SMT10G-30",    "Singapore 30 Days 10GB",    "SG", "asia", "country", 10,  30, 900),
    CatalogEntry("eSIM-SMT20G-30",    "Singapore 30 Days 20GB",    "SG", "asia", "country", 20,  30, 1600),
    # Greece (GR, europe) — also on JoyTel's multi-region F pack
    # (same SKUs + same RMB costs as Albania + France). All 10 listings
    # are shared-SKU; identical prices to Albania/France.
    CatalogEntry("eSIM-FT3GB-03",     "Greece 3 Days 3GB",         "GR", "europe", "country", 3,   3,  300,  listing_id="eSIM-FT3GB-03.GR"),
    CatalogEntry("eSIM-F10M-03",      "Greece 3 Days Unlimited",   "GR", "europe", "country", 999, 3,  1200, listing_id="eSIM-F10M-03.GR"),
    CatalogEntry("eSIM-FT5GB-07",     "Greece 7 Days 5GB",         "GR", "europe", "country", 5,   7,  500,  listing_id="eSIM-FT5GB-07.GR"),
    CatalogEntry("eSIM-FT10GB-07",    "Greece 7 Days 10GB",        "GR", "europe", "country", 10,  7,  900,  listing_id="eSIM-FT10GB-07.GR"),
    CatalogEntry("eSIM-F10M-07",      "Greece 7 Days Unlimited",   "GR", "europe", "country", 999, 7,  2700, listing_id="eSIM-F10M-07.GR"),
    CatalogEntry("eSIM-FT5GB-15",     "Greece 15 Days 5GB",        "GR", "europe", "country", 5,   15, 600,  listing_id="eSIM-FT5GB-15.GR"),
    CatalogEntry("eSIM-FT10GB-15",    "Greece 15 Days 10GB",       "GR", "europe", "country", 10,  15, 1000, listing_id="eSIM-FT10GB-15.GR"),
    CatalogEntry("eSIM-FT5GB-30",     "Greece 30 Days 5GB",        "GR", "europe", "country", 5,   30, 700,  listing_id="eSIM-FT5GB-30.GR"),
    CatalogEntry("eSIM-FT10GB-30",    "Greece 30 Days 10GB",       "GR", "europe", "country", 10,  30, 1100, listing_id="eSIM-FT10GB-30.GR"),
    CatalogEntry("eSIM-FT20GB-30",    "Greece 30 Days 20GB",       "GR", "europe", "country", 20,  30, 2000, listing_id="eSIM-FT20GB-30.GR"),
    # Andorra (AD, europe) — JoyTel "multi-region H" pack.
    CatalogEntry("eSIM-HT3GB-03",     "Andorra 3 Days 3GB",        "AD", "europe", "country", 3,   3,  600),
    CatalogEntry("eSIM-HT5GB-07",     "Andorra 7 Days 5GB",        "AD", "europe", "country", 5,   7,  1100),
    CatalogEntry("eSIM-HT10GB-07",    "Andorra 7 Days 10GB",       "AD", "europe", "country", 10,  7,  2000),
    CatalogEntry("eSIM-HT5GB-15",     "Andorra 15 Days 5GB",       "AD", "europe", "country", 5,   15, 1300),
    CatalogEntry("eSIM-HT10GB-15",    "Andorra 15 Days 10GB",      "AD", "europe", "country", 10,  15, 2200),
    # +$1 over the formula to keep the gradient (15d/5GB is also $13).
    CatalogEntry("eSIM-HT5GB-30",     "Andorra 30 Days 5GB",       "AD", "europe", "country", 5,   30, 1400),
    CatalogEntry("eSIM-HT10GB-30",    "Andorra 30 Days 10GB",      "AD", "europe", "country", 10,  30, 2300),
    CatalogEntry("eSIM-HT20GB-30",    "Andorra 30 Days 20GB",      "AD", "europe", "country", 20,  30, 4300),
]

# Regional plans — country code is bespoke (EU/AP/CHM), plan_type="regional".
REGIONAL_PLANS: list[CatalogEntry] = [
    # China mainland + HK + Macau
    CatalogEntry("eSIM-CHM1G-01",     "China + HK + Macau 1 Day 1GB",       "CHM", "china-region", "regional", 1,   1,  100),
    CatalogEntry("eSIM-CHMT5G-07",    "China + HK + Macau 7 Days 5GB",      "CHM", "china-region", "regional", 5,   7,  600),
    CatalogEntry("eSIM-CHMT10G-07",   "China + HK + Macau 7 Days 10GB",     "CHM", "china-region", "regional", 10,  7,  900),
    CatalogEntry("eSIM-CHM10M-07",    "China + HK + Macau 7 Days Unlimited","CHM", "china-region", "regional", 999, 7,  2500),
    CatalogEntry("eSIM-CHMT20G-30",   "China + HK + Macau 30 Days 20GB",    "CHM", "china-region", "regional", 20,  30, 2000),
    # Europe
    CatalogEntry("eSIM-EUCT5G-07",    "Europe 7 Days 5GB",                   "EU", "europe", "regional", 5,   7,  600),
    CatalogEntry("eSIM-EUCT10G-07",   "Europe 7 Days 10GB",                  "EU", "europe", "regional", 10,  7,  990),
    CatalogEntry("eSIM-EUC10M-07",    "Europe 7 Days Unlimited",             "EU", "europe", "regional", 999, 7,  2500),
    CatalogEntry("eSIM-EUCT5G-15",    "Europe 15 Days 5GB",                  "EU", "europe", "regional", 5,   15, 700),
    CatalogEntry("eSIM-EUCT10G-15",   "Europe 15 Days 10GB",                 "EU", "europe", "regional", 10,  15, 1090),
    # Asia-Pacific
    CatalogEntry("eSIM-APACAT5G-07",  "Asia-Pacific 7 Days 5GB",             "AP", "asia-pacific", "regional", 5,   7,  650),
    CatalogEntry("eSIM-APACAT10G-07", "Asia-Pacific 7 Days 10GB",            "AP", "asia-pacific", "regional", 10,  7,  1000),
    CatalogEntry("eSIM-APACAM10-07",  "Asia-Pacific 7 Days Unlimited",       "AP", "asia-pacific", "regional", 999, 7,  2500),
    CatalogEntry("eSIM-APACAT5G-15",  "Asia-Pacific 15 Days 5GB",            "AP", "asia-pacific", "regional", 5,   15, 750),
    CatalogEntry("eSIM-APACAT10G-15", "Asia-Pacific 15 Days 10GB",           "AP", "asia-pacific", "regional", 10,  15, 1100),
    # Australia + New Zealand
    CatalogEntry("eSIM-ANT3G-03",     "Australia + NZ 3 Days 3GB",           "ANZ", "oceania", "regional", 3,   3,  300),
    CatalogEntry("eSIM-ANMAX-03",     "Australia + NZ 3 Days Unlimited",     "ANZ", "oceania", "regional", 999, 3,  1050),
    CatalogEntry("eSIM-ANT5G-07",     "Australia + NZ 7 Days 5GB",           "ANZ", "oceania", "regional", 5,   7,  650),
    CatalogEntry("eSIM-ANT10G-07",    "Australia + NZ 7 Days 10GB",          "ANZ", "oceania", "regional", 10,  7,  1000),
    CatalogEntry("eSIM-ANMAX-07",     "Australia + NZ 7 Days Unlimited",     "ANZ", "oceania", "regional", 999, 7,  2300),
    CatalogEntry("eSIM-ANT5G-15",     "Australia + NZ 15 Days 5GB",          "ANZ", "oceania", "regional", 5,   15, 750),
    CatalogEntry("eSIM-ANT10G-15",    "Australia + NZ 15 Days 10GB",         "ANZ", "oceania", "regional", 10,  15, 1100),
    CatalogEntry("eSIM-ANT10G-30",    "Australia + NZ 30 Days 10GB",         "ANZ", "oceania", "regional", 10,  30, 1200),
    CatalogEntry("eSIM-ANT20G-30",    "Australia + NZ 30 Days 20GB",         "ANZ", "oceania", "regional", 20,  30, 2100),
    # North America (US + Canada + Mexico)
    CatalogEntry("eSIM-UCMT5G-07",    "North America 7 Days 5GB",            "NAM", "americas", "regional", 5,   7,  1200),
    CatalogEntry("eSIM-UCMT10G-07",   "North America 7 Days 10GB",           "NAM", "americas", "regional", 10,  7,  1900),
    CatalogEntry("eSIM-UCMT5G-15",    "North America 15 Days 5GB",           "NAM", "americas", "regional", 5,   15, 1400),
    CatalogEntry("eSIM-UCMT10G-15",   "North America 15 Days 10GB",          "NAM", "americas", "regional", 10,  15, 2000),
    # Southeast Asia (Singapore + Malaysia + Indonesia + Thailand)
    CatalogEntry("eSIM-XMTYT3GB-03",  "Southeast Asia 3 Days 3GB",           "SEA", "asia", "regional", 3,   3,  300),
    CatalogEntry("eSIM-XMTY10M-03",   "Southeast Asia 3 Days Unlimited",     "SEA", "asia", "regional", 999, 3,  890),
    CatalogEntry("eSIM-XMTYT5GB-07",  "Southeast Asia 7 Days 5GB",           "SEA", "asia", "regional", 5,   7,  600),
    CatalogEntry("eSIM-XMTYT10GB-07", "Southeast Asia 7 Days 10GB",          "SEA", "asia", "regional", 10,  7,  900),
    CatalogEntry("eSIM-XMTY10M-07",   "Southeast Asia 7 Days Unlimited",     "SEA", "asia", "regional", 999, 7,  1990),
    CatalogEntry("eSIM-XMTYT5GB-15",  "Southeast Asia 15 Days 5GB",          "SEA", "asia", "regional", 5,   15, 700),
    CatalogEntry("eSIM-XMTYT10GB-15", "Southeast Asia 15 Days 10GB",         "SEA", "asia", "regional", 10,  15, 1000),
    CatalogEntry("eSIM-XMTYT10GB-30", "Southeast Asia 30 Days 10GB",         "SEA", "asia", "regional", 10,  30, 1100),
    CatalogEntry("eSIM-XMTYT20GB-30", "Southeast Asia 30 Days 20GB",         "SEA", "asia", "regional", 20,  30, 1800),
    # Saipan + Guam
    CatalogEntry("eSIM-SPNGUMT5G-07", "Saipan + Guam 7 Days 5GB",            "SPG", "oceania", "regional", 5,   7,  1000),
    CatalogEntry("eSIM-SPNGUMT10G-07","Saipan + Guam 7 Days 10GB",           "SPG", "oceania", "regional", 10,  7,  1600),
    CatalogEntry("eSIM-SPNGUMT5G-15", "Saipan + Guam 15 Days 5GB",           "SPG", "oceania", "regional", 5,   15, 1100),
    CatalogEntry("eSIM-SPNGUMT10G-15","Saipan + Guam 15 Days 10GB",          "SPG", "oceania", "regional", 10,  15, 1700),
    # South America (Brazil + Argentina + Chile + Ecuador + Peru + Uruguay)
    CatalogEntry("eSIM-SAAT5G-07",    "South America 7 Days 5GB",            "SAM", "americas", "regional", 5,   7,  1900),
    CatalogEntry("eSIM-SAAT10G-07",   "South America 7 Days 10GB",           "SAM", "americas", "regional", 10,  7,  2800),
    CatalogEntry("eSIM-SAAT5G-15",    "South America 15 Days 5GB",           "SAM", "americas", "regional", 5,   15, 2100),
    CatalogEntry("eSIM-SAAT10G-15",   "South America 15 Days 10GB",          "SAM", "americas", "regional", 10,  15, 3100),
    # Africa (carrier coverage list TBD — placeholder description in
    # frontend REGIONAL_PLANS_META until the list is confirmed)
    CatalogEntry("eSIM-AFAT5G-07",    "Africa 7 Days 5GB",                   "AFR", "africa", "regional", 5,   7,  1000),
    CatalogEntry("eSIM-AFAT10G-07",   "Africa 7 Days 10GB",                  "AFR", "africa", "regional", 10,  7,  1900),
    CatalogEntry("eSIM-AFAT5G-15",    "Africa 15 Days 5GB",                  "AFR", "africa", "regional", 5,   15, 1100),
    CatalogEntry("eSIM-AFAT10G-15",   "Africa 15 Days 10GB",                 "AFR", "africa", "regional", 10,  15, 2000),
]

ALL_PLANS: list[CatalogEntry] = COUNTRY_PLANS + REGIONAL_PLANS


def upsert_catalog() -> None:
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        # Sanity: catch dup listing_ids in the source list itself.
        seen_ids: dict[str, CatalogEntry] = {}
        for e in ALL_PLANS:
            eid = _id_for(e)
            if eid in seen_ids:
                raise ValueError(
                    f"Duplicate listing id {eid!r} in ALL_PLANS — set a unique "
                    f"`listing_id` on one of the entries (both reference SKU "
                    f"{e.sku!r} and {seen_ids[eid].sku!r})."
                )
            seen_ids[eid] = e

        inserted = 0
        updated = 0
        for entry in ALL_PLANS:
            eid = _id_for(entry)
            existing = db.query(Plan).filter(Plan.id == eid).first()
            if existing:
                # Update everything except the id. joytel_sku is mutable
                # here so a listing can be repointed at a different SKU
                # if needed (rare).
                existing.joytel_sku = entry.sku
                existing.name = entry.name
                existing.country = entry.country
                existing.region = entry.region
                existing.plan_type = entry.plan_type
                existing.data_gb = entry.data_gb
                existing.validity_days = entry.validity_days
                existing.price_cents = entry.price_cents
                existing.currency = "usd"
                existing.active = True
                updated += 1
            else:
                db.add(
                    Plan(
                        id=eid,
                        joytel_sku=entry.sku,
                        name=entry.name,
                        country=entry.country,
                        region=entry.region,
                        plan_type=entry.plan_type,
                        data_gb=entry.data_gb,
                        validity_days=entry.validity_days,
                        price_cents=entry.price_cents,
                        currency="usd",
                        active=True,
                    )
                )
                inserted += 1
        db.commit()
        print(f"Catalog upserted: {inserted} inserted, {updated} updated ({len(ALL_PLANS)} total)")
    finally:
        db.close()


if __name__ == "__main__":
    upsert_catalog()
