"""Checkout endpoints — legacy redirect + React Payment Element paths."""

import logging
from typing import Any, Optional, Union

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException
from sqlalchemy.orm import Session

from app.config import settings
from app.database import get_db
from app.middleware.auth import get_optional_user
from app.models import Order, Plan, User
from app.schemas import (
    CheckoutConfigResponse,
    CheckoutRequest,
    CheckoutResponse,
    CouponValidateRequest,
    CouponValidateResponse,
    FreeOrderResponse,
    PaymentIntentResponse,
)
from app.services import coupons as coupons_service
from app.services.joytel_warehouse import generate_order_tid, place_order
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


@router.post("/checkout/validate-coupon", response_model=CouponValidateResponse)
def validate_coupon_endpoint(
    body: CouponValidateRequest,
    db: Session = Depends(get_db),
) -> CouponValidateResponse:
    """Pre-flight check the coupon against the chosen plan. Pure-read; never
    consumes a use. The frontend calls this on Apply to display the discount;
    the actual redemption happens at /payment-intent or in the webhook."""
    plan = db.query(Plan).filter(Plan.id == body.plan_id, Plan.active == True).first()
    if not plan:
        raise HTTPException(status_code=404, detail="Plan not found")

    ev = coupons_service.validate(db, body.code, plan)
    return CouponValidateResponse(
        valid=ev.valid,
        code=ev.coupon.code if ev.coupon else None,
        discount_cents=ev.discount_cents,
        final_cents=ev.final_cents,
        free=ev.free,
        error=ev.error,
    )


@router.post("/payment-intent", response_model=Union[PaymentIntentResponse, FreeOrderResponse])
def create_payment_intent_endpoint(
    request: CheckoutRequest,
    background: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_optional_user),
) -> Any:
    """Create an Order + Stripe PaymentIntent (or skip Stripe entirely for a
    100%-off coupon) for the on-site Payment Element.

    Flow:
      1. Validate the plan (active, exists).
      2. If a coupon code was supplied, re-validate it (race-safe; we run
         the same check the frontend ran).
      3. If the discount makes the order $0: bypass Stripe — create the
         Order in "paid" state, redeem the coupon (atomic), submit to JoyTel
         in the background, return FreeOrderResponse.
      4. Otherwise: create the Order in "created" state, create a Stripe
         PaymentIntent for the discounted amount, return client_secret.
         Coupon usage is consumed by the Stripe webhook on success.
    """
    email = request.email
    if not email and current_user:
        email = current_user.email
    if not email:
        raise HTTPException(status_code=422, detail="Email is required")

    plan = db.query(Plan).filter(Plan.id == request.plan_id, Plan.active == True).first()
    if not plan:
        raise HTTPException(status_code=404, detail="Plan not found")

    # Coupon evaluation (optional). Re-runs at PaymentIntent time defends
    # against a coupon that expired between Apply and Pay.
    discount_cents = 0
    final_cents = plan.price_cents
    coupon_id: Optional[str] = None
    coupon_code: Optional[str] = None
    is_free = False

    if request.coupon_code:
        ev = coupons_service.validate(db, request.coupon_code, plan)
        if not ev.valid:
            raise HTTPException(status_code=400, detail=ev.error or "Invalid coupon")
        discount_cents = ev.discount_cents
        final_cents = ev.final_cents
        coupon_id = ev.coupon.id if ev.coupon else None
        coupon_code = ev.coupon.code if ev.coupon else None
        is_free = ev.free

    # ----- 100%-off bypass: Stripe rejects $0 PaymentIntents anyway -----
    if is_free:
        if not coupon_id:
            raise HTTPException(status_code=400, detail="Free orders require a coupon")

        order = Order(
            email=email,
            plan_id=plan.id,
            amount_cents=0,
            currency=plan.currency,
            status="paid",  # no Stripe step needed
            user_id=current_user.id if current_user else None,
            coupon_id=coupon_id,
            coupon_code=coupon_code,
            discount_cents=discount_cents,
        )
        db.add(order)
        db.commit()
        db.refresh(order)

        # Atomic redemption. If the cap was just hit by a parallel redeem,
        # roll back the order — refusal is safer than handing out an extra
        # free eSIM.
        if not coupons_service.redeem(db, coupon_id):
            db.delete(order)
            db.commit()
            raise HTTPException(status_code=400, detail="This coupon has reached its usage limit.")

        # Submit to JoyTel directly — the Stripe webhook would normally do
        # this, but we don't have one to fire. Run in the background so the
        # response returns fast; the customer gets the order page status
        # poller and the eSIM email when it lands.
        order_tid = generate_order_tid()
        order.joytel_order_id = order_tid
        order.status = "joytel_pending"
        db.commit()

        async def _submit_free():
            try:
                result = await place_order(
                    order_tid=order_tid,
                    sku=plan.joytel_sku,
                    email=order.email,
                )
                if result.get("code") != 0:
                    logger.error(
                        f"Free order {order.reference}: JoyTel rejected: {result}"
                    )
            except Exception as e:
                logger.error(f"Free order {order.reference}: JoyTel submit failed: {e}")

        background.add_task(_submit_free)

        logger.info(
            f"Order {order.reference} created free via coupon {coupon_code} (discount {discount_cents}c) — JoyTel submit dispatched"
        )

        return FreeOrderResponse(
            order_reference=order.reference,
            discount_cents=discount_cents,
            coupon_code=coupon_code or "",
        )

    # ----- Standard Stripe flow -----
    order = Order(
        email=email,
        plan_id=plan.id,
        amount_cents=final_cents,
        currency=plan.currency,
        status="created",
        user_id=current_user.id if current_user else None,
        coupon_id=coupon_id,
        coupon_code=coupon_code,
        discount_cents=discount_cents,
    )
    db.add(order)
    db.commit()
    db.refresh(order)

    try:
        intent = create_payment_intent(order, plan, override_amount_cents=final_cents)
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
        amount_cents=final_cents,
        currency=plan.currency,
        discount_cents=discount_cents,
        coupon_code=coupon_code,
    )
