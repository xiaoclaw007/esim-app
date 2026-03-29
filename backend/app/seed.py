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

    plans = [
        Plan(
            id="us-1gb-1d",
            joytel_sku="eSIM-US1G-01",
            name="USA 1GB / 1 Day",
            country="US",
            region="north-america",
            data_gb=1,
            validity_days=1,
            price_cents=799,  # $7.99 — wholesale is $5.00, TODO: confirm margin
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
