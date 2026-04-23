"""add orders.stripe_refund_id

Revision ID: a3f9c1e27d55
Revises: e4a7f1d23891
Create Date: 2026-04-23 05:05:00.000000

Tracks the Stripe refund issued when a JoyTel fulfillment failure forces us
to return the customer's money. Populated by webhooks.py in the failure
branch of the Stripe webhook handler.
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "a3f9c1e27d55"
down_revision: Union[str, None] = "e4a7f1d23891"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "orders",
        sa.Column("stripe_refund_id", sa.String(length=255), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("orders", "stripe_refund_id")
