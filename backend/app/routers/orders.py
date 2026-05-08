"""Order endpoints — public status check + authenticated order history."""

import asyncio
import logging
from datetime import datetime, timezone
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
from app.services.joytel_rsp import get_esim_status, get_esim_usage

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

    # Parallel fan-out: usage and status are independent JoyTel calls.
    # Status is best-effort — if it fails we still return usage. The
    # install state is enriched from our local DB columns (populated
    # by the install-event webhook) so even a status-call failure
    # leaves the badge informative when those events are flowing.
    usage_task = asyncio.create_task(get_esim_usage(order.sn_pin))
    status_task = asyncio.create_task(get_esim_status(order.sn_pin))
    results = await asyncio.gather(usage_task, status_task, return_exceptions=True)
    usage_raw, status_raw = results

    if isinstance(usage_raw, Exception):
        logger.error(
            f"JoyTel usage query failed for order {reference} (sn_pin={order.sn_pin}): {usage_raw}"
        )
        raise HTTPException(status_code=502, detail="Couldn't fetch usage right now")
    result = usage_raw

    # Log the raw response on every call for now — JoyTel's exact field
    # names aren't documented in our code, and we want to be able to
    # debug parsing without re-deploying. Once we've seen a few real
    # responses we can downgrade this to debug-level.
    logger.info(f"JoyTel usage response for {reference}: {result}")
    logger.info(f"JoyTel status response for {reference}: {status_raw}")

    data = result.get("data") if isinstance(result, dict) else None
    if not isinstance(data, dict):
        # Some JoyTel endpoints return the payload at the top level
        # instead of nested under "data". Fall back to the whole result.
        data = result if isinstance(result, dict) else {}

    # JoyTel returns totalUsage as cumulative bytes consumed (not MB).
    # Confirmed shape from a live response:
    #   { effTime, expTime, totalUsage, dataUsageList: [{usageDate, mcc, usage}] }
    # All quantities are byte-strings; convert to MB. We still try the
    # documented-but-unobserved alternate names as a fallback in case
    # the field name varies across product types.
    used_bytes_raw = _pick(data, "totalUsage", "total_usage", "usedFlow", "used_flow", "usedSize", "used")
    used_bytes_int = _to_int_mb(used_bytes_raw)  # naming is legacy; this just parses to int
    used_mb: Optional[int] = (
        used_bytes_int // (1024 * 1024) if used_bytes_int is not None else None
    )
    if used_mb is None:
        # Fall back to the alternate field names that ARE already in MB.
        used_mb = _to_int_mb(_pick(data, "usedMb", "used_mb"))
    total_mb = _to_int_mb(_pick(data, "totalFlow", "total_flow", "totalSize", "total"))
    left_mb = _to_int_mb(_pick(data, "leftFlow", "left_flow", "remainSize", "remain"))
    # JoyTel actually returns expTime as epoch milliseconds (e.g.
    # "1778187239000"). Convert to ISO so the frontend can parse it
    # directly. Falls through to whatever string is there if it's
    # not a numeric epoch.
    expires_raw = _pick(data, "expTime", "expireTime", "expire_time", "expireAt", "expire_at", "endTime")
    expires: Optional[str] = None
    if expires_raw is not None:
        try:
            expires = (
                datetime.fromtimestamp(int(expires_raw) / 1000, tz=timezone.utc).isoformat()
            )
        except (TypeError, ValueError):
            expires = str(expires_raw)

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

    # Parse the live eSIM status (best-effort). JoyTel's spec maps
    # status ints: 0=Unknown, 1=Activated, 2=Expired.
    esim_status: Optional[str] = None
    if not isinstance(status_raw, Exception) and isinstance(status_raw, dict):
        sdata = status_raw.get("data")
        if isinstance(sdata, dict):
            raw_status = sdata.get("status")
            try:
                code = int(raw_status) if raw_status is not None else None
            except (TypeError, ValueError):
                code = None
            esim_status = {0: "unknown", 1: "activated", 2: "expired"}.get(code)

    # Heuristic state classification for the UI to render meaningfully
    # without re-deriving from raw numbers. Merge signals from:
    #   1. Local install timestamps (push-based, from webhook)
    #   2. JoyTel status query (poll-based, always available)
    #   3. Carrier-reported state in the usage payload
    #   4. Used vs total numbers
    state = "unknown"
    if used_mb == 0 or used_mb is None:
        state = "unused"
    elif total_mb and used_mb is not None and used_mb >= total_mb:
        state = "depleted"
    elif used_mb is not None and used_mb > 0:
        state = "active"
    # Install signals upgrade unused → active when present.
    if state == "unused" and (order.installed_at or order.enabled_at or esim_status == "activated"):
        state = "active"
    # Expiration overrides everything else.
    carrier_state = _pick(data, "status", "esimStatus", "state")
    if isinstance(carrier_state, str) and carrier_state.lower() in ("expired", "ended"):
        state = "expired"
    if esim_status == "expired":
        state = "expired"

    return OrderUsageResponse(
        used_mb=used_mb,
        total_mb=total_mb,
        left_mb=left_mb,
        percent=percent,
        expires_at=expires,
        state=state,
        esim_status=esim_status,
        installed_at=order.installed_at.isoformat() if order.installed_at else None,
        enabled_at=order.enabled_at.isoformat() if order.enabled_at else None,
    )
