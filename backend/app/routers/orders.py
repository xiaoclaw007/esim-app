"""Order status endpoint — lets customers check their order progress."""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Order
from app.schemas import OrderStatusResponse

router = APIRouter(prefix="/api/orders", tags=["orders"])


@router.get("/{reference}/status", response_model=OrderStatusResponse)
def get_order_status(reference: str, db: Session = Depends(get_db)):
    """Check the status of an order by its reference code.

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
