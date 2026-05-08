"""add is_test flag to plans

Revision ID: a3e7c91d2f5b
Revises: c7b91e3a2f10
Create Date: 2026-05-08 12:00:00.000000

Splits internal/test plans from customer-visible plans. Public
/api/plans now filters Plan.is_test == False; the admin catalog
keeps showing all plans.

Auto-flag policy on upgrade: any plan whose id starts with
"eSIM-test" or whose name contains "test" (case-insensitive) is
marked as test. Existing seeded test plan has id "eSIM-test".
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "a3e7c91d2f5b"
down_revision: Union[str, None] = "c7b91e3a2f10"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "plans",
        sa.Column(
            "is_test",
            sa.Boolean(),
            nullable=False,
            server_default=sa.false(),
        ),
    )
    # Auto-flag obvious test plans so the leak is closed immediately
    # without manual SQL on the server. Operators can adjust via the
    # admin catalog later.
    op.execute(
        """
        UPDATE plans
        SET is_test = TRUE
        WHERE id LIKE 'eSIM-test%'
           OR LOWER(name) LIKE '%test%'
        """
    )


def downgrade() -> None:
    op.drop_column("plans", "is_test")
