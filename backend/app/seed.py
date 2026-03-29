"""Seed the database with initial plan data.

Run this once after setting up the database:
    python -m app.seed

For M1, we're starting with a single test plan.
Update the plan details once we have JoyTel's actual product catalog.
"""

from app.database import SessionLocal, engine, Base
from app.models import Plan


def seed_plans():
    """Insert the initial plan(s) into the database."""
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()

    # Check if plans already exist
    existing = db.query(Plan).count()
    if existing > 0:
        print(f"Database already has {existing} plan(s). Skipping seed.")
        db.close()
        return

    # Placeholder plan — replace with real JoyTel SKU and pricing
    plans = [
        Plan(
            id="japan-5gb-30d",
            joytel_sku="PLACEHOLDER_SKU",  # TODO: Replace with real JoyTel SKU
            name="Japan 5GB / 30 Days",
            country="JP",
            region="asia",
            data_gb=5,
            validity_days=30,
            price_cents=1299,  # $12.99
            currency="usd",
            active=True,
        ),
    ]

    for plan in plans:
        db.add(plan)

    db.commit()
    print(f"Seeded {len(plans)} plan(s).")
    db.close()


if __name__ == "__main__":
    seed_plans()
