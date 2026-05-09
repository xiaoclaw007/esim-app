"""Passwordless auth via single-use email links.

Token shape:
    raw token  = 32 bytes of urlsafe base64 (≈ 43 chars, no padding)
    stored as  = sha256(raw).hexdigest()

The raw token only ever lives in the email. The DB only sees the hash;
even a full DB leak doesn't yield working login links. Same pattern as
the refresh_token table.

Lifecycle:
    create_login_link(user_id) → (raw_token, magic_link)
        caller writes the row inside its own transaction so the link
        and the order/email it accompanies share commit semantics.
    consume(raw_token) → user, marks used_at, fails on expired/used.

Default TTL is 7 days — long enough for a customer who orders before a
trip and clicks the email mid-flight.
"""

from __future__ import annotations

import secrets
from datetime import datetime, timedelta, timezone
from hashlib import sha256
from typing import Optional, Tuple

from sqlalchemy.orm import Session

from app.config import settings
from app.models import MagicLink, User


DEFAULT_TTL_DAYS = 7


def _hash(raw: str) -> str:
    return sha256(raw.encode()).hexdigest()


def create_login_link(
    db: Session,
    user: User,
    ttl_days: int = DEFAULT_TTL_DAYS,
) -> Tuple[str, MagicLink]:
    """Mint a fresh single-use login link.

    Returns (raw_token, row). The caller is responsible for db.commit()
    so the row and any sibling writes (the order it accompanies, the
    email send-attempt) share a transaction.
    """
    raw = secrets.token_urlsafe(32)
    row = MagicLink(
        user_id=user.id,
        token_hash=_hash(raw),
        purpose="login",
        expires_at=datetime.now(timezone.utc) + timedelta(days=ttl_days),
    )
    db.add(row)
    return raw, row


def build_url(raw_token: str) -> str:
    """Render the customer-facing URL the email button points at."""
    base = settings.frontend_url.rstrip("/")
    return f"{base}/api/auth/magic/{raw_token}"


class MagicLinkError(Exception):
    """Base — distinguish UI rendering."""


class InvalidToken(MagicLinkError):
    pass


class ExpiredToken(MagicLinkError):
    pass


class AlreadyUsed(MagicLinkError):
    pass


def consume(db: Session, raw_token: str) -> User:
    """Validate, mark used, return the User.

    Raises InvalidToken / ExpiredToken / AlreadyUsed so the endpoint
    can render distinct UI states. Caller commits.
    """
    if not raw_token:
        raise InvalidToken("missing token")
    row = db.query(MagicLink).filter(MagicLink.token_hash == _hash(raw_token)).first()
    if not row:
        raise InvalidToken("token not found")
    if row.used_at is not None:
        raise AlreadyUsed("token already used")
    if row.expires_at <= datetime.now(timezone.utc):
        raise ExpiredToken("token expired")

    user = db.query(User).filter(User.id == row.user_id, User.is_active == True).first()
    if not user:
        raise InvalidToken("user not found")

    row.used_at = datetime.now(timezone.utc)
    return user
