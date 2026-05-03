"""add events table for analytics

Revision ID: c7b91e3a2f10
Revises: f47a3c81e2d4
Create Date: 2026-04-20 12:00:00.000000

V1 self-hosted analytics. Single events table — every interesting customer
action lands here as one row, then the admin dashboard slices/dices in SQL.

Schema choices:
  * `type` is a free-form short string ("page_view", "checkout_started", …)
    — kept open-ended so we can ship a new event by adding a frontend ping +
    a chart query, no migration.
  * `metadata` is JSON for per-event payload (plan_id on a destination_view,
    coupon_code on a coupon_applied, decline_code on a payment_failed, …).
    JSONB on Postgres, JSON on SQLite.
  * `session_id` is a frontend-issued opaque id (sessionStorage) — lets us
    funnel a single visit (visitors KPI) without a login.
  * `country` is filled by IP→GeoIP lookup at ingest. Optional — if the
    GeoLite2 DB isn't shipped, we just leave it null.
  * `device` is "mobile" | "tablet" | "desktop" derived from User-Agent.

Indexes are conservative: (created_at), (type, created_at) covers most
admin dashboard queries (range scans by type and time).
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision: str = "c7b91e3a2f10"
down_revision: Union[str, None] = "f47a3c81e2d4"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "events",
        sa.Column("id", sa.String(length=36), primary_key=True),
        sa.Column("type", sa.String(length=40), nullable=False),
        sa.Column("session_id", sa.String(length=64), nullable=True),
        sa.Column(
            "user_id",
            sa.String(length=36),
            sa.ForeignKey("users.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("path", sa.String(length=500), nullable=True),
        sa.Column("referrer", sa.String(length=500), nullable=True),
        sa.Column("country", sa.String(length=2), nullable=True),
        sa.Column("device", sa.String(length=10), nullable=True),
        sa.Column("user_agent", sa.String(length=500), nullable=True),
        sa.Column(
            "event_metadata",
            postgresql.JSONB(astext_type=sa.Text()).with_variant(sa.JSON(), "sqlite"),
            nullable=True,
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
    )
    op.create_index("ix_events_created_at", "events", ["created_at"])
    op.create_index("ix_events_type_created_at", "events", ["type", "created_at"])
    op.create_index("ix_events_session_id", "events", ["session_id"])
    op.create_index("ix_events_user_id", "events", ["user_id"])


def downgrade() -> None:
    op.drop_index("ix_events_user_id", table_name="events")
    op.drop_index("ix_events_session_id", table_name="events")
    op.drop_index("ix_events_type_created_at", table_name="events")
    op.drop_index("ix_events_created_at", table_name="events")
    op.drop_table("events")
