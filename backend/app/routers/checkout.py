"""Checkout endpoints — legacy redirect + React Payment Element paths."""

import logging
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.config import settings
from app.database import get_db
from app.middleware.auth import get_optional_user
from app.models import Order, Plan, User
from app.schemas import (
    CheckoutConfigResponse,
    CheckoutRequest,
    CheckoutResponse,
    PaymentIntentResponse,
)
from app.services.stripe_service import create_checkout_session, create_payment_intent

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


@router.get("/checkout/config", response_model=CheckoutConfigResponse)
def checkout_config() -> CheckoutConfigResponse:
    """Expose the Stripe publishable key to the frontend.

    Publishable keys (pk_test_/pk_live_) are safe to ship to the browser
    — the convention is to serve them from the backend so we don't duplicate
    configuration between backend and frontend envs.
    """
    return CheckoutConfigResponse(publishable_key=settings.stripe_publishable_key)


@router.post("/payment-intent", response_model=PaymentIntentResponse)
def create_payment_intent_endpoint(
    request: CheckoutRequest,
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_optional_user),
) -> PaymentIntentResponse:
    """Create an Order + Stripe PaymentIntent for the on-site Payment Element.

    Flow:
      1. Validate the plan (active, exists).
      2. Create Order row in "created" state, linked to the user if signed in.
      3. Create Stripe PaymentIntent carrying metadata.order_id so the
         payment_intent.succeeded webhook can look the Order back up.
      4. Return client_secret + order_reference. The frontend mounts
         <Elements clientSecret={...}> and calls stripe.confirmPayment().
    """
    email = request.email
    if not email and current_user:
        email = current_user.email
    if not email:
        raise HTTPException(status_code=422, detail="Email is required")

    plan = db.query(Plan).filter(Plan.id == request.plan_id, Plan.active == True).first()
    if not plan:
        raise HTTPException(status_code=404, detail="Plan not found")

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

    try:
        intent = create_payment_intent(order, plan)
    except Exception as e:
        logger.error(f"Stripe PaymentIntent creation failed: {e}")
        order.status = "failed"
        order.error_message = f"Stripe error: {e}"
        db.commit()
        raise HTTPException(status_code=500, detail="Failed to create payment intent")

    order.stripe_payment_intent = intent.id
    db.commit()

    return PaymentIntentResponse(
        client_secret=intent.client_secret,
        order_reference=order.reference,
        amount_cents=plan.price_cents,
        currency=plan.currency,
    )
