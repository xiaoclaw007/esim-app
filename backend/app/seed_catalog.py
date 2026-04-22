"""Seed/upsert the production JoyTel plan catalog.

Idempotent: upserts each plan by joytel_sku, leaving orders intact. Preserves
the existing `us-1gb-1d` row (same SKU, just price corrected) and the
`esim-test-plan` sandbox row (untouched).

Usage:
    python -m app.seed_catalog
"""

from __future__ import annotations

from dataclasses import dataclass

from app.database import Base, SessionLocal, engine
from app.models import Plan


@dataclass(frozen=True)
class CatalogEntry:
    sku: str
    name: str
    country: str  # ISO-2 for country plans, bespoke code for regional
    region: str  # geographic grouping used for the Destinations page
    plan_type: str  # "country" or "regional"
    data_gb: int  # 999 == unlimited
    validity_days: int
    price_cents: int


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
    CatalogEntry("eSIM-US1G-01",      "USA 1 Day 1GB",             "US", "americas", "country", 1,   1,  100),
    CatalogEntry("eSIM-UST5G-07",     "USA 7 Days 5GB",            "US", "americas", "country", 5,   7,  600),
    CatalogEntry("eSIM-UST10G-07",    "USA 7 Days 10GB",           "US", "americas", "country", 10,  7,  890),
    CatalogEntry("eSIM-USMAX-07",     "USA 7 Days Unlimited",      "US", "americas", "country", 999, 7,  1900),
    CatalogEntry("eSIM-UST20G-30",    "USA 30 Days 20GB",          "US", "americas", "country", 20,  30, 1990),
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
]

ALL_PLANS: list[CatalogEntry] = COUNTRY_PLANS + REGIONAL_PLANS


def upsert_catalog() -> None:
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        inserted = 0
        updated = 0
        for entry in ALL_PLANS:
            existing = db.query(Plan).filter(Plan.joytel_sku == entry.sku).first()
            if existing:
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
                        id=entry.sku,  # SKU doubles as the plan id for new rows
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
