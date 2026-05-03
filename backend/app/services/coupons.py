"""Coupon validation + redemption logic.

Two paths through this module:

  validate(db, code, plan)   →  used by the customer-facing
                                 /api/checkout/validate-coupon endpoint and
                                 again at PaymentIntent creation. Returns a
                                 CouponEvaluation; never mutates state.

  redeem(db, coupon)         →  atomic uses += 1 with row lock, called by the
                                 Stripe webhook on payment_intent.succeeded
                                 (paid orders) AND immediately for $0 orders
                                 (the 100%-off bypass — there's no webhook).

By splitting validate and redeem we avoid the classic "validate-then-act"
race: redemption holds the row lock while it re-checks the cap, so two
parallel redemptions can't both push uses past max_uses.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Optional

from sqlalchemy.orm import Session

from app.models import Coupon, Plan


@dataclass(frozen=True)
class CouponEvaluation:
    valid: bool
    coupon: Optional[Coupon] = None
    discount_cents: int = 0
    final_cents: int = 0
    error: Optional[str] = None
    # True iff the discount makes the order completely free (Stripe is bypassed).
    free: bool = False


def normalize_code(code: str) -> str:
    return (code or "").strip().upper()


def find_active(db: Session, code: str) -> Optional[Coupon]:
    norm = normalize_code(code)
    if not norm:
        return None
    return db.query(Coupon).filter(Coupon.code == norm).first()


def _now() -> datetime:
    return datetime.now(timezone.utc)


def validate(db: Session, code: str, plan: Plan) -> CouponEvaluation:
    """Pure-read evaluation. Run twice: at validate-coupon, then again at
    PaymentIntent creation to defend against races on the cap."""
    norm = normalize_code(code)
    if not norm:
        return CouponEvaluation(valid=False, error="Enter a coupon code.")

    coupon = db.query(Coupon).filter(Coupon.code == norm).first()
    if coupon is None:
        return CouponEvaluation(valid=False, error="Coupon not found.")
    if not coupon.active:
        return CouponEvaluation(valid=False, error="This coupon is no longer active.")

    now = _now()
    if coupon.valid_from and coupon.valid_from > now:
        return CouponEvaluation(valid=False, error="This coupon isn't active yet.")
    if coupon.valid_until and coupon.valid_until < now:
        return CouponEvaluation(valid=False, error="This coupon has expired.")
    if coupon.max_uses is not None and coupon.uses >= coupon.max_uses:
        return CouponEvaluation(valid=False, error="This coupon has reached its usage limit.")

    base = plan.price_cents
    discount = compute_discount(coupon, base)
    final = max(0, base - discount)

    return CouponEvaluation(
        valid=True,
        coupon=coupon,
        discount_cents=discount,
        final_cents=final,
        free=final == 0,
    )


def compute_discount(coupon: Coupon, base_cents: int) -> int:
    if coupon.kind == "percent":
        # Percent stored as 1-100; cap discount at base.
        return min(base_cents, base_cents * coupon.value // 100)
    if coupon.kind == "fixed":
        return min(base_cents, max(0, coupon.value))
    return 0


def redeem(db: Session, coupon_id: str) -> bool:
    """Atomically increment uses, re-checking the cap under a row lock.
    Returns True on success, False if the cap was just hit (rare race)."""
    locked = (
        db.query(Coupon)
        .filter(Coupon.id == coupon_id)
        .with_for_update()
        .first()
    )
    if locked is None:
        return False
    if locked.max_uses is not None and locked.uses >= locked.max_uses:
        return False
    locked.uses += 1
    db.commit()
    return True
