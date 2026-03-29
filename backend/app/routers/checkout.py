"""Checkout endpoint — creates a Stripe Checkout Session for a plan purchase."""

import logging
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.middleware.auth import get_optional_user
from app.models import Order, Plan, User
from app.schemas import CheckoutRequest, CheckoutResponse
from app.services.stripe_service import create_checkout_session

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api", tags=["checkout"])


@router.post("/checkout", response_model=CheckoutResponse)
def checkout(
    request: CheckoutRequest,
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_optional_user),
):
    """Create a checkout session for purchasing an eSIM plan.

    Auth is optional. If the user is logged in, the order is linked to their
    account and their email is used as default.

    Flow:
    1. Validate that the requested plan exists and is active
    2. Create an order record in our DB (status: "created")
    3. Create a Stripe Checkout Session
    4. Return the Stripe checkout URL for frontend redirect

    The actual payment confirmation happens later via the Stripe webhook.
    """
    # Determine email: request body takes priority, then user's email
    email = request.email
    if not email and current_user:
        email = current_user.email
    if not email:
        raise HTTPException(status_code=422, detail="Email is required")

    # 1. Validate plan
    plan = db.query(Plan).filter(Plan.id == request.plan_id, Plan.active == True).first()
    if not plan:
        raise HTTPException(status_code=404, detail="Plan not found")

    # 2. Create order
    order = Order(
        email=email,
        plan_id=plan.id,
        amount_cents=plan.price_cents,
        currency=plan.currency,
        status="created",
        user_id=current_user.id if current_user else None,
    )
    db.add(order)
    db.commit()
    db.refresh(order)

    # 3. Create Stripe Checkout Session
    try:
        checkout_url, session_id = create_checkout_session(order, plan)
    except Exception as e:
        logger.error(f"Stripe checkout creation failed: {e}")
        order.status = "failed"
        order.error_message = f"Stripe error: {str(e)}"
        db.commit()
        raise HTTPException(status_code=500, detail="Failed to create checkout session")

    # 4. Store Stripe session ID and return
    order.stripe_session_id = session_id
    db.commit()

    return CheckoutResponse(
        checkout_url=checkout_url,
        order_reference=order.reference,
    )
