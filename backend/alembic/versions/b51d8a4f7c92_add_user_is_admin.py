"""add users.is_admin

Revision ID: b51d8a4f7c92
Revises: a3f9c1e27d55
Create Date: 2026-05-03 01:30:00.000000

Founder/operator flag — gates the new CRM (/api/admin/* endpoints + /admin
SPA route). Default false; flipped manually via SQL for the founder accounts.
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "b51d8a4f7c92"
down_revision: Union[str, None] = "a3f9c1e27d55"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "users",
        sa.Column(
            "is_admin",
            sa.Boolean(),
            nullable=False,
            server_default=sa.text("false"),
        ),
    )


def downgrade() -> None:
    op.drop_column("users", "is_admin")
