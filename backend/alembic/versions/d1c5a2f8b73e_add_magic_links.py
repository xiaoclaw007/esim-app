"""add magic_links table

Revision ID: d1c5a2f8b73e
Revises: b8f2d4e6a91c
Create Date: 2026-05-08 16:00:00.000000

Magic-link auth: passwordless login via signed token in an email.
Powers Phase 2 of the guest-checkout claim flow — the "Manage your
eSIMs" button in the order email logs the customer in without ever
asking for a password.

Schema notes:
- token_hash, not the raw token. Same pattern as refresh_tokens.
- single-use: used_at is set on consume; subsequent attempts must
  request a fresh link.
- purpose lets future flows (email verification, password reset)
  share the same plumbing without a new table.
- expires_at gives us forward-looking cleanup; we keep used links
  for audit until expiry then prune.
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "d1c5a2f8b73e"
down_revision: Union[str, None] = "b8f2d4e6a91c"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "magic_links",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column(
            "user_id",
            sa.String(36),
            sa.ForeignKey("users.id"),
            nullable=False,
            index=True,
        ),
        sa.Column("token_hash", sa.String(64), nullable=False, unique=True),
        # 'login' for now; future: 'email_verify', 'password_reset', etc.
        sa.Column("purpose", sa.String(32), nullable=False, server_default="login"),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("used_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
    )


def downgrade() -> None:
    op.drop_table("magic_links")
