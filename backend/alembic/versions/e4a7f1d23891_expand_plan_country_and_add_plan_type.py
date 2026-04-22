"""expand plan.country and add plan_type

Revision ID: e4a7f1d23891
Revises: 0919816c7645
Create Date: 2026-04-21 23:30:00.000000

Regional SKUs (Europe, Asia-Pacific, China+HK+Macau) don't fit the original
VARCHAR(2) country column. Widen it to VARCHAR(10) so we can use codes like
"EU"/"AP"/"CHM", and add a plan_type column so the frontend can distinguish
country-scoped plans from regional ones without sniffing the country code.
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "e4a7f1d23891"
down_revision: Union[str, None] = "0919816c7645"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    with op.batch_alter_table("plans") as batch_op:
        batch_op.alter_column(
            "country",
            existing_type=sa.String(length=2),
            type_=sa.String(length=10),
            existing_nullable=False,
        )
        batch_op.add_column(
            sa.Column(
                "plan_type",
                sa.String(length=20),
                nullable=False,
                server_default="country",
            )
        )


def downgrade() -> None:
    with op.batch_alter_table("plans") as batch_op:
        batch_op.drop_column("plan_type")
        batch_op.alter_column(
            "country",
            existing_type=sa.String(length=10),
            type_=sa.String(length=2),
            existing_nullable=False,
        )
