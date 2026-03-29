"""Order endpoints — public status check + authenticated order history."""

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.database import get_db
from app.middleware.auth import get_current_user
from app.models import Order, User
from app.schemas import OrderDetailResponse, OrderListResponse, OrderStatusResponse

router = APIRouter(prefix="/api/orders", tags=["orders"])


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

    return OrderStatusResponse(
        reference=order.reference,
        status=order.status,
        plan_id=order.plan_id,
        email=order.email,
        created_at=order.created_at,
        qr_code_url=order.qr_code_url if order.status == "completed" else None,
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
                qr_code_url=o.qr_code_url if o.status == "completed" else None,
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
        qr_code_url=order.qr_code_url if order.status == "completed" else None,
    )
