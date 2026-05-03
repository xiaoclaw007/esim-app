"""add coupons table + order discount columns

Revision ID: d92e5b41a8c3
Revises: b51d8a4f7c92
Create Date: 2026-05-03 03:00:00.000000

V1 coupon system:
  * coupons table with code, kind (percent | fixed), value, optional caps
    and date window, usage counter, active flag, internal notes.
  * orders gets coupon_id (FK), coupon_code (frozen value at redemption,
    survives coupon deletion), and discount_cents (audit/display).

The orders.amount_cents column continues to be the FINAL charged amount
(post-discount); discount_cents is informational only.
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "d92e5b41a8c3"
down_revision: Union[str, None] = "b51d8a4f7c92"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "coupons",
        sa.Column("id", sa.String(length=36), primary_key=True),
        sa.Column("code", sa.String(length=40), nullable=False),
        sa.Column("kind", sa.String(length=10), nullable=False),
        sa.Column("value", sa.Integer(), nullable=False),
        sa.Column("max_uses", sa.Integer(), nullable=True),
        sa.Column("uses", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("valid_from", sa.DateTime(timezone=True), nullable=True),
        sa.Column("valid_until", sa.DateTime(timezone=True), nullable=True),
        sa.Column("active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("created_by", sa.String(length=36), sa.ForeignKey("users.id"), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
    )
    op.create_unique_constraint("uq_coupons_code", "coupons", ["code"])
    op.create_index("ix_coupons_code", "coupons", ["code"])

    op.add_column(
        "orders",
        sa.Column("coupon_id", sa.String(length=36), sa.ForeignKey("coupons.id"), nullable=True),
    )
    op.add_column("orders", sa.Column("coupon_code", sa.String(length=40), nullable=True))
    op.add_column(
        "orders",
        sa.Column("discount_cents", sa.Integer(), nullable=False, server_default="0"),
    )


def downgrade() -> None:
    op.drop_column("orders", "discount_cents")
    op.drop_column("orders", "coupon_code")
    op.drop_column("orders", "coupon_id")
    op.drop_index("ix_coupons_code", table_name="coupons")
    op.drop_constraint("uq_coupons_code", "coupons", type_="unique")
    op.drop_table("coupons")
