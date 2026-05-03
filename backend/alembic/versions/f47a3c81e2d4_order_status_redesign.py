"""order status redesign

Revision ID: f47a3c81e2d4
Revises: d92e5b41a8c3
Create Date: 2026-05-03 07:00:00.000000

Order lifecycle redesign — see project_orders_redesign memory.

Old vs new:
  created          → DELETE (old semantics: page-load placeholders;
                            no payment, no JoyTel call ever happened)
  paid             → payment_received
  joytel_pending   → ordering
  snpin_received   → qr_pending
  completed        → delivered
  failed / refunded → unchanged

In the new design `created` means "Pay clicked, Stripe processing" — a
brief transient state on real orders. The OLD `created` rows had
different semantics (browse → abandon), so we drop them rather than
preserve under the new meaning.
"""

from typing import Sequence, Union

from alembic import op


revision: str = "f47a3c81e2d4"
down_revision: Union[str, None] = "d92e5b41a8c3"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1) Delete pre-redesign abandoned carts. Safe: no FK references,
    #    no Stripe charge ever processed (status was 'created' under old
    #    semantic of "checkout page loaded").
    op.execute("DELETE FROM orders WHERE status = 'created'")

    # 2) Rename remaining statuses to the new lifecycle.
    op.execute("UPDATE orders SET status = 'payment_received' WHERE status = 'paid'")
    op.execute("UPDATE orders SET status = 'ordering'         WHERE status = 'joytel_pending'")
    op.execute("UPDATE orders SET status = 'qr_pending'       WHERE status = 'snpin_received'")
    op.execute("UPDATE orders SET status = 'delivered'        WHERE status = 'completed'")


def downgrade() -> None:
    # Reverse the renames (the deleted rows can't be recovered).
    op.execute("UPDATE orders SET status = 'completed'      WHERE status = 'delivered'")
    op.execute("UPDATE orders SET status = 'snpin_received' WHERE status = 'qr_pending'")
    op.execute("UPDATE orders SET status = 'joytel_pending' WHERE status = 'ordering'")
    op.execute("UPDATE orders SET status = 'paid'           WHERE status = 'payment_received'")
