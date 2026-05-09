"""add credits_ledger + orders.credit_applied_cents

Revision ID: e2c8b41a0d96
Revises: d1c5a2f8b73e
Create Date: 2026-05-09 12:00:00.000000

Nimvoy Credit launch — store-credit ledger pattern. Each row is one
money-movement event (earn / spend / refund-reverse / expire / admin
grant); balance is derived by SUM. Audit-friendly, supports per-batch
expiration without a separate per-user balance to keep in sync.

orders.credit_applied_cents records how much of the order's price was
covered by store credit (the rest hits Stripe). Set at order creation
when the customer toggles credit on at checkout. Used at refund time
so we know exactly how much credit to reverse.
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "e2c8b41a0d96"
down_revision: Union[str, None] = "d1c5a2f8b73e"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "credits_ledger",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column(
            "user_id",
            sa.String(36),
            sa.ForeignKey("users.id"),
            nullable=False,
            index=True,
        ),
        # Positive for earns / admin grants; negative for spends, refund
        # reversals, expirations. Balance = SUM(delta_cents WHERE
        # expires_at IS NULL OR expires_at > NOW()).
        sa.Column("delta_cents", sa.Integer(), nullable=False),
        # 'order_earned' | 'order_spent' | 'order_refunded' | 'expired'
        # | 'admin_grant'. Free-form to allow new reasons without a
        # migration; consumers should treat unknown values as informational.
        sa.Column("reason", sa.String(40), nullable=False, index=True),
        sa.Column(
            "related_order_id",
            sa.String(36),
            sa.ForeignKey("orders.id"),
            nullable=True,
            index=True,
        ),
        # Only set on earn rows. Drives the "12 months from earn date"
        # expiration policy. Spend rows have no expiry — they're permanent.
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
            index=True,
        ),
    )

    # On orders, track how much of the price was paid with store credit.
    # Default 0; only set when a logged-in customer applied credit at
    # checkout. Refund logic reads this to know how much credit to reverse.
    op.add_column(
        "orders",
        sa.Column(
            "credit_applied_cents",
            sa.Integer(),
            nullable=False,
            server_default="0",
        ),
    )


def downgrade() -> None:
    op.drop_column("orders", "credit_applied_cents")
    op.drop_table("credits_ledger")
