"""Nimvoy Credit — store-credit ledger service.

Ledger pattern: every money movement (earn / spend / refund-reverse /
expire / admin-grant) is one row in `credits_ledger`. Balance is
derived by SUM, never stored on User. This keeps audit history intact
and supports per-batch expiration cleanly.

Conventions:
- delta_cents > 0 for earns + admin grants
- delta_cents < 0 for spends + refund-reverses + expirations
- expires_at is set ONLY on earn rows, NULL on the rest
- "active" balance excludes earn rows past their expiry

Public API:
    balance(db, user_id) -> int                 — current spendable cents
    earn_for_order(db, order)                   — write earn row (10%)
    spend_for_order(db, order)                  — write spend row at payment success
    reverse_for_order(db, order, reason)        — back out earn + spend on refund
    expire_due_rows(db)                         — to be called from a cron later

All writers leave the commit to the caller so the credit row, the
order row, and the email-send attempt share one transaction.
"""

from __future__ import annotations

import logging
from datetime import datetime, timedelta, timezone
from typing import Optional

from sqlalchemy import func, or_
from sqlalchemy.orm import Session

from app.config import settings
from app.models import CreditsLedger, Order

logger = logging.getLogger(__name__)


def balance(db: Session, user_id: str) -> int:
    """Current spendable balance, in cents.

    Sums all ledger rows for the user, EXCLUDING earn rows whose
    expires_at has passed. Negative deltas (spends, reverses) always
    count regardless of expires_at — those rows have NULL expires_at
    so they pass through.
    """
    if not user_id:
        return 0
    now = datetime.now(timezone.utc)
    total = (
        db.query(func.coalesce(func.sum(CreditsLedger.delta_cents), 0))
        .filter(
            CreditsLedger.user_id == user_id,
            or_(CreditsLedger.expires_at.is_(None), CreditsLedger.expires_at > now),
        )
        .scalar()
    )
    return int(total or 0)


def earn_for_order(db: Session, order: Order) -> Optional[CreditsLedger]:
    """Issue an earn row for a paid order.

    Earn rate is settings.credit_earn_rate (default 0.10 = 10%) of the
    actual amount paid via Stripe — i.e. order.amount_cents minus
    credit applied (post-coupon, post-credit). Earns on $0 orders
    (free coupons, full-credit checkouts) yield nothing — earned
    credit must always trace back to real money.

    Idempotent: if an earn row already exists for this order, returns
    None without writing again. Safe to call from webhook retries.
    """
    if not order.user_id:
        return None  # shouldn't happen post-Phase 2; guard anyway

    rate = settings.credit_earn_rate
    if rate <= 0:
        return None  # earning disabled globally

    # order.amount_cents is the post-coupon, post-credit amount that
    # actually hit Stripe — i.e. real money paid. Earning on credit-
    # spent or coupon-discounted dollars would let customers churn
    # credit through repeat orders without paying anything.
    paid_cents = max(0, order.amount_cents)
    if paid_cents <= 0:
        return None  # 100% covered by coupon and/or credit; nothing earned

    earn_cents = int(round(paid_cents * rate))
    if earn_cents <= 0:
        return None  # rounded to zero on tiny orders

    # Idempotency: don't double-write on retry.
    existing = (
        db.query(CreditsLedger)
        .filter(
            CreditsLedger.related_order_id == order.id,
            CreditsLedger.reason == "order_earned",
        )
        .first()
    )
    if existing:
        return existing

    expires_at = datetime.now(timezone.utc) + timedelta(days=settings.credit_expiry_days)
    row = CreditsLedger(
        user_id=order.user_id,
        delta_cents=earn_cents,
        reason="order_earned",
        related_order_id=order.id,
        expires_at=expires_at,
    )
    db.add(row)
    logger.info(
        f"Order {order.reference}: earned {earn_cents}c credit for user {order.user_id} "
        f"(rate={rate}, expires {expires_at.date()})"
    )
    return row


def spend_for_order(db: Session, order: Order) -> Optional[CreditsLedger]:
    """Write the negative ledger row for credit applied at checkout.

    Called once per order from the payment-success path (Stripe
    webhook for paid orders, free-order branch for 100%-credit/coupon
    orders). Idempotent — re-runs return the existing row.
    """
    if not order.user_id or (order.credit_applied_cents or 0) <= 0:
        return None
    existing = (
        db.query(CreditsLedger)
        .filter(
            CreditsLedger.related_order_id == order.id,
            CreditsLedger.reason == "order_spent",
        )
        .first()
    )
    if existing:
        return existing

    row = CreditsLedger(
        user_id=order.user_id,
        delta_cents=-int(order.credit_applied_cents),
        reason="order_spent",
        related_order_id=order.id,
        expires_at=None,
    )
    db.add(row)
    logger.info(
        f"Order {order.reference}: spent {order.credit_applied_cents}c credit "
        f"for user {order.user_id}"
    )
    return row


def reverse_for_order(db: Session, order: Order) -> None:
    """On refund: back out both the earn and spend rows for this order.

    Writes counter-rows rather than mutating the originals so the
    ledger remains an append-only audit trail. Idempotent — re-runs
    skip already-reversed rows by reason marker.
    """
    if not order.user_id:
        return

    earned = (
        db.query(CreditsLedger)
        .filter(
            CreditsLedger.related_order_id == order.id,
            CreditsLedger.reason == "order_earned",
        )
        .first()
    )
    earned_reversed = (
        db.query(CreditsLedger)
        .filter(
            CreditsLedger.related_order_id == order.id,
            CreditsLedger.reason == "order_refunded",
        )
        .first()
    )
    if earned and not earned_reversed:
        db.add(
            CreditsLedger(
                user_id=order.user_id,
                delta_cents=-earned.delta_cents,
                reason="order_refunded",
                related_order_id=order.id,
                expires_at=None,
            )
        )
        logger.info(
            f"Order {order.reference}: reversed {earned.delta_cents}c earned credit"
        )

    # If the customer had spent credit on this order, refund it back to
    # them as a fresh earn row (not a reversal of the spend row — that
    # would re-attach to the now-invalidated earn batch's expiry). Issue
    # a new earn batch with a fresh 12-month expiry so they have time
    # to spend it again.
    spent = (
        db.query(CreditsLedger)
        .filter(
            CreditsLedger.related_order_id == order.id,
            CreditsLedger.reason == "order_spent",
        )
        .first()
    )
    spent_refunded = (
        db.query(CreditsLedger)
        .filter(
            CreditsLedger.related_order_id == order.id,
            CreditsLedger.reason == "order_refunded_spend",
        )
        .first()
    )
    if spent and not spent_refunded:
        expires_at = datetime.now(timezone.utc) + timedelta(days=settings.credit_expiry_days)
        db.add(
            CreditsLedger(
                user_id=order.user_id,
                delta_cents=-spent.delta_cents,  # spent is negative; flip to positive
                reason="order_refunded_spend",
                related_order_id=order.id,
                expires_at=expires_at,
            )
        )
        logger.info(
            f"Order {order.reference}: returned {-spent.delta_cents}c spent credit"
        )


def quote_earn(amount_paid_cents: int) -> int:
    """Pure helper — what would we earn for a given paid amount?
    Used in UI / email copy without touching the DB."""
    rate = settings.credit_earn_rate
    if rate <= 0 or amount_paid_cents <= 0:
        return 0
    return int(round(amount_paid_cents * rate))
