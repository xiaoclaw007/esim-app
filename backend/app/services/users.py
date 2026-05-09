"""User helpers — primarily account auto-creation for guest checkout.

Phase 2 of the guest-claim flow: every order creates / claims a User
row at purchase time so there's no orphan-orders problem to clean up
later. The customer gets a magic-link login email pointing at this
auto-created account; if they later sign up with email/password or
Google, those flows recognize the auto-created account by email and
attach their credentials to it (claim semantics).
"""

from __future__ import annotations

from sqlalchemy.orm import Session

from app.models import User


def ensure_user_for_email(db: Session, email: str) -> User:
    """Find or auto-create a User for the given email.

    Returns the existing User if one matches (case-insensitive). Else
    creates a passwordless, no-Google account with just the email.
    Doesn't commit — caller controls the transaction so the user write
    can share commit semantics with the order it accompanies.

    The auto-created account is fully usable but has no auth credentials
    of its own; login happens via magic link. Signup() recognizes this
    state and lets the customer claim it by setting a password.
    """
    normalized = (email or "").strip().lower()
    if not normalized:
        raise ValueError("email required")

    existing = db.query(User).filter(User.email == normalized).first()
    if existing:
        return existing

    user = User(email=normalized)
    db.add(user)
    db.flush()  # populate user.id without committing the outer transaction
    return user
