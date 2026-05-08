"""Order endpoints — public status check + authenticated order history."""

import logging
from typing import Any, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.database import get_db
from app.middleware.auth import get_current_user
from app.models import Order, User
from app.schemas import (
    OrderDetailResponse,
    OrderListResponse,
    OrderStatusResponse,
    OrderUsageResponse,
)
from app.services.joytel_rsp import get_esim_usage

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/orders", tags=["orders"])


def _to_int_mb(value: Any) -> Optional[int]:
    """JoyTel returns flow values as strings or numbers depending on the
    field. Normalize to int megabytes, returning None on anything we
    can't parse (empty string, null, garbage)."""
    if value is None or value == "":
        return None
    try:
        # Some carriers return floats like "256.5" — round to nearest MB.
        return int(round(float(value)))
    except (TypeError, ValueError):
        return None


def _pick(d: dict, *keys: str) -> Any:
    """Return the first non-empty value for any of the candidate keys.
    JoyTel field names vary across endpoints / API versions, so we try
    a few common variants."""
    for k in keys:
        v = d.get(k)
        if v is not None and v != "":
            return v
    return None


@router.get("/{reference}/status", response_model=OrderStatusResponse)
def get_order_status(reference: str, db: Session = Depends(get_db)):
    """Check the status of an order by its reference code (public, no auth).

    The frontend redirects here after Stripe checkout completes.
    Customers can also use this to check on their order if the email
    hasn't arrived yet.

    Status progression:
    - created: Order placed, waiting for payment
    - paid: Payment confirmed, submitting to JoyTel
    - joytel_pending: Order submitted to JoyTel, waiting for callback
    - snpin_received: Got redemption code, requesting QR code
    - completed: QR code delivered, email sent
    - failed: Something went wrong (check error_message)
    """
    order = db.query(Order).filter(Order.reference == reference).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    qr_delivered = order.status == "delivered"
    return OrderStatusResponse(
        reference=order.reference,
        status=order.status,
        plan_id=order.plan_id,
        email=order.email,
        amount_cents=order.amount_cents,
        currency=order.currency,
        created_at=order.created_at,
        qr_code_url=order.qr_code_url if qr_delivered else None,
        qr_code_data=order.qr_code_data if qr_delivered else None,
        error_message=order.error_message if order.status in ("failed", "refunded") else None,
        stripe_refund_id=order.stripe_refund_id,
    )


@router.get("", response_model=OrderListResponse)
def list_orders(
    page: int = Query(default=1, ge=1),
    per_page: int = Query(default=20, ge=1, le=100),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """List the current user's orders, paginated, newest first."""
    query = db.query(Order).filter(Order.user_id == current_user.id)
    total = query.count()
    orders = (
        query.order_by(Order.created_at.desc())
        .offset((page - 1) * per_page)
        .limit(per_page)
        .all()
    )

    return OrderListResponse(
        orders=[
            OrderDetailResponse(
                reference=o.reference,
                status=o.status,
                plan_id=o.plan_id,
                email=o.email,
                amount_cents=o.amount_cents,
                currency=o.currency,
                created_at=o.created_at,
                updated_at=o.updated_at,
                qr_code_url=o.qr_code_url if o.status == "delivered" else None,
                qr_code_data=o.qr_code_data if o.status == "delivered" else None,
                stripe_refund_id=o.stripe_refund_id,
            )
            for o in orders
        ],
        total=total,
        page=page,
        per_page=per_page,
    )


@router.get("/{reference}", response_model=OrderDetailResponse)
def get_order_detail(
    reference: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Get detailed info for a specific order. Requires auth and ownership."""
    order = db.query(Order).filter(
        Order.reference == reference,
        Order.user_id == current_user.id,
    ).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    return OrderDetailResponse(
        reference=order.reference,
        status=order.status,
        plan_id=order.plan_id,
        email=order.email,
        amount_cents=order.amount_cents,
        currency=order.currency,
        created_at=order.created_at,
        updated_at=order.updated_at,
        qr_code_url=order.qr_code_url if order.status == "delivered" else None,
        qr_code_data=order.qr_code_data if order.status == "delivered" else None,
        stripe_refund_id=order.stripe_refund_id,
    )


@router.get("/{reference}/usage", response_model=OrderUsageResponse)
async def get_order_usage(
    reference: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Live data-usage query for a delivered eSIM. Calls JoyTel's
    /esim/usage/query and normalizes the response.

    Auth: required, ownership-checked. Only returns usage to the user
    who placed the order — eSIMs are not transferable.

    Performance: not cached. JoyTel responses take ~1-2s. Frontend
    should fetch on Account-page mount + provide a manual refresh
    button rather than polling.
    """
    order = (
        db.query(Order)
        .filter(Order.reference == reference, Order.user_id == current_user.id)
        .first()
    )
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    if order.status != "delivered":
        raise HTTPException(status_code=400, detail="Order isn't ready yet")
    if not order.sn_pin:
        # Defensive — every delivered order should have an sn_pin, but
        # if a manual hand-off ever happens we don't want a 500.
        raise HTTPException(status_code=502, detail="Carrier coupon missing")

    try:
        result = await get_esim_usage(order.sn_pin)
    except Exception as e:
        logger.error(
            f"JoyTel usage query failed for order {reference} (sn_pin={order.sn_pin}): {e}"
        )
        raise HTTPException(status_code=502, detail="Couldn't fetch usage right now")

    # Log the raw response on every call for now — JoyTel's exact field
    # names aren't documented in our code, and we want to be able to
    # debug parsing without re-deploying. Once we've seen a few real
    # responses we can downgrade this to debug-level.
    logger.info(f"JoyTel usage response for {reference}: {result}")

    data = result.get("data") if isinstance(result, dict) else None
    if not isinstance(data, dict):
        # Some JoyTel endpoints return the payload at the top level
        # instead of nested under "data". Fall back to the whole result.
        data = result if isinstance(result, dict) else {}

    used_mb = _to_int_mb(_pick(data, "usedFlow", "used_flow", "usedSize", "used"))
    total_mb = _to_int_mb(_pick(data, "totalFlow", "total_flow", "totalSize", "total"))
    left_mb = _to_int_mb(_pick(data, "leftFlow", "left_flow", "remainSize", "remain"))
    expires = _pick(data, "expireTime", "expire_time", "expireAt", "expire_at", "endTime")

    # Cross-fill missing values from the others when possible.
    if total_mb is None and used_mb is not None and left_mb is not None:
        total_mb = used_mb + left_mb
    if left_mb is None and total_mb is not None and used_mb is not None:
        left_mb = max(total_mb - used_mb, 0)
    if used_mb is None and total_mb is not None and left_mb is not None:
        used_mb = max(total_mb - left_mb, 0)

    percent: Optional[float] = None
    if total_mb and total_mb > 0 and used_mb is not None:
        percent = round((used_mb / total_mb) * 100, 1)

    # Heuristic state classification for the UI to render meaningfully
    # without re-deriving from raw numbers.
    state = "unknown"
    if used_mb == 0 or used_mb is None:
        state = "unused"
    elif total_mb and used_mb is not None and used_mb >= total_mb:
        state = "depleted"
    elif used_mb is not None and used_mb > 0:
        state = "active"
    # Carrier-reported expiration override.
    carrier_state = _pick(data, "status", "esimStatus", "state")
    if isinstance(carrier_state, str) and carrier_state.lower() in ("expired", "ended"):
        state = "expired"

    return OrderUsageResponse(
        used_mb=used_mb,
        total_mb=total_mb,
        left_mb=left_mb,
        percent=percent,
        expires_at=str(expires) if expires else None,
        state=state,
    )
