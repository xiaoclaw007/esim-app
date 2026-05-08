"""add esim install event tracking

Revision ID: b8f2d4e6a91c
Revises: a3e7c91d2f5b
Create Date: 2026-05-08 14:00:00.000000

Wires up the JoyTel eSIM Installation Event Notification feed so we
know the moment a customer's phone downloads / installs / enables /
disables / deletes their eSIM.

Schema:
- orders.cid: the eSIM Profile CID. Captured from the redeem callback
  (we already get it, just hadn't been storing it). Indexed because
  install events arrive keyed by CID, not by order reference.
- orders.installed_at / enabled_at / disabled_at / deleted_at:
  timestamp of the first event of each type. Lets the My eSIMs UI
  and admin funnel queries answer "is this installed yet?" without
  joining the events table.
- orders.last_install_event_at: latest event regardless of type, for
  "last seen" displays.
- esim_install_events: full event log. Keep raw payload so we can
  refine our parser later without losing data, and so we can answer
  questions the schema doesn't anticipate.
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision: str = "b8f2d4e6a91c"
down_revision: Union[str, None] = "a3e7c91d2f5b"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # ---- orders: install lifecycle columns ----
    op.add_column("orders", sa.Column("cid", sa.String(40), nullable=True))
    op.create_index("ix_orders_cid", "orders", ["cid"])
    op.add_column(
        "orders", sa.Column("installed_at", sa.DateTime(timezone=True), nullable=True)
    )
    op.add_column(
        "orders", sa.Column("enabled_at", sa.DateTime(timezone=True), nullable=True)
    )
    op.add_column(
        "orders", sa.Column("disabled_at", sa.DateTime(timezone=True), nullable=True)
    )
    op.add_column(
        "orders", sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True)
    )
    op.add_column(
        "orders",
        sa.Column("last_install_event_at", sa.DateTime(timezone=True), nullable=True),
    )

    # ---- esim_install_events: full event log ----
    op.create_table(
        "esim_install_events",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column(
            "order_id",
            sa.String(36),
            sa.ForeignKey("orders.id"),
            nullable=True,
            index=True,
        ),
        sa.Column("cid", sa.String(40), nullable=True, index=True),
        sa.Column("notification_point_id", sa.Integer(), nullable=False),
        # Human-readable label of the notificationPointId so admins can
        # eyeball the table without a key.
        sa.Column("notification_point_name", sa.String(64), nullable=True),
        sa.Column("status", sa.String(32), nullable=True),  # Executed-Success / Failed / Expired / etc.
        sa.Column(
            "raw_payload",
            postgresql.JSONB(astext_type=sa.Text()).with_variant(sa.JSON(), "sqlite"),
            nullable=True,
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
    )
    op.create_index(
        "ix_esim_install_events_created_at", "esim_install_events", ["created_at"]
    )


def downgrade() -> None:
    op.drop_index("ix_esim_install_events_created_at", table_name="esim_install_events")
    op.drop_table("esim_install_events")
    op.drop_column("orders", "last_install_event_at")
    op.drop_column("orders", "deleted_at")
    op.drop_column("orders", "disabled_at")
    op.drop_column("orders", "enabled_at")
    op.drop_column("orders", "installed_at")
    op.drop_index("ix_orders_cid", table_name="orders")
    op.drop_column("orders", "cid")
