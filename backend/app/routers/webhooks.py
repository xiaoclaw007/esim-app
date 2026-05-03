"""Webhook handlers — receives callbacks from Stripe and JoyTel.

These endpoints are called by external services, not by our frontend.
They drive the order fulfillment pipeline:
  Stripe (paid) → JoyTel Warehouse (snPin) → JoyTel RSP+ (QR code) → Email
"""

import logging

from fastapi import APIRouter, Depends, Header, HTTPException, Request
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Order, Plan
from app.services import coupons as coupons_service
from app.services.email_service import (
    send_esim_email,
    send_order_failed_email,
    send_payment_confirmation_email,
)
from app.services.joytel_rsp import redeem_coupon
from app.services.joytel_warehouse import generate_order_tid, place_order
from app.services.stripe_service import refund_payment_intent, verify_webhook_signature

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/webhooks", tags=["webhooks"])


# --- Stripe Webhook ---


@router.post("/stripe")
async def stripe_webhook(
    request: Request,
    stripe_signature: str = Header(alias="Stripe-Signature"),
    db: Session = Depends(get_db),
):
    """Handle Stripe lifecycle events for an existing Order.

    Under the redesign, the Order row is created at click-Pay time by
    POST /api/orders (status='created' with stripe_payment_intent set),
    so this webhook only TRANSITIONS that row — never creates one.

    Handled events:
      payment_intent.succeeded     — created → payment_received → ordering
      payment_intent.payment_failed — created → payment_failed
      checkout.session.completed   — legacy hosted flow (kept for the old
                                     /api/checkout endpoint that may still
                                     have in-flight sessions)
    """
    payload = await request.body()

    try:
        event = verify_webhook_signature(payload, stripe_signature)
    except Exception as e:
        logger.error(f"Stripe webhook signature verification failed: {e}")
        raise HTTPException(status_code=400, detail="Invalid signature")

    event_type = event["type"]
    obj = event["data"]["object"]

    # ----- Resolve payment intent + look up the existing Order row -----
    if event_type == "payment_intent.succeeded":
        payment_intent_id = obj.get("id")
    elif event_type == "payment_intent.payment_failed":
        payment_intent_id = obj.get("id")
        return _handle_payment_failed(db, obj, payment_intent_id)
    elif event_type == "checkout.session.completed":
        # Legacy hosted-checkout path: order_id comes from metadata, not PI lookup.
        order_id = (obj.get("metadata") or {}).get("order_id")
        payment_intent_id = obj.get("payment_intent")
        order = db.query(Order).filter(Order.id == order_id).first() if order_id else None
        if not order:
            logger.error(f"Stripe checkout.session.completed: order {order_id} not found")
            raise HTTPException(status_code=404, detail="Order not found")
        return await _process_paid_order(db, order, payment_intent_id, event_type)
    else:
        return {"status": "ignored"}

    if not payment_intent_id:
        logger.error(f"Stripe {event_type}: missing payment_intent id on {obj.get('id')}")
        return {"status": "ignored"}

    order = db.query(Order).filter(Order.stripe_payment_intent == payment_intent_id).first()
    if not order:
        # Defense-in-depth: under the new design we create the Order at
        # click-Pay before the PaymentIntent is confirmed, so this lookup
        # should always succeed. If it doesn't, log loudly — could be a
        # webhook firing for an intent we never tracked, or a race where
        # the row write hasn't committed yet (unlikely given the order of
        # operations in /api/orders).
        logger.error(
            f"Stripe webhook {event_type}: no Order found for PaymentIntent {payment_intent_id}"
        )
        return {"status": "ignored"}

    return await _process_paid_order(db, order, payment_intent_id, event_type)


def _handle_payment_failed(db: Session, obj: dict, payment_intent_id: str | None) -> dict:
    """payment_intent.payment_failed: card declined, 3DS abandoned, etc.
    Transition the existing Order from 'created' to 'payment_failed' so
    the CRM can surface decline visibility.
    """
    if not payment_intent_id:
        return {"status": "ignored"}
    order = db.query(Order).filter(Order.stripe_payment_intent == payment_intent_id).first()
    if not order:
        logger.warning(f"payment_failed: no Order found for PaymentIntent {payment_intent_id}")
        return {"status": "ignored"}
    if order.status != "created":
        # Already terminal (rare race). Don't override.
        logger.info(
            f"Order {order.reference} payment_failed received but already in {order.status}; ignoring"
        )
        return {"status": "ok"}
    order.status = "payment_failed"
    err = (obj.get("last_payment_error") or {}).get("message") or "Payment declined"
    order.error_message = err[:500]
    db.commit()
    logger.info(f"Order {order.reference}: payment_failed — {err}")
    return {"status": "ok"}


async def _process_paid_order(
    db: Session,
    order: Order,
    payment_intent_id: str | None,
    event_type: str,
) -> dict:
    """Shared post-payment pipeline. Idempotent: re-runs of the same event
    against an already-advanced order are ignored."""
    # Idempotency: only process if still at 'created' (or legacy 'failed' for
    # retry recovery from the old code path).
    if order.status not in ("created", "failed"):
        logger.info(
            f"Order {order.reference} already in status {order.status}; ignoring {event_type}"
        )
        return {"status": "ok"}

    order.status = "payment_received"
    if payment_intent_id and not order.stripe_payment_intent:
        order.stripe_payment_intent = payment_intent_id
    db.commit()

    # Consume the coupon use now that Stripe has actually charged the card.
    # Ignore failure — order is paid; coupon-cap accounting being slightly off
    # is a much smaller problem than refusing a successful payment.
    if order.coupon_id:
        if coupons_service.redeem(db, order.coupon_id):
            logger.info(f"Order {order.reference}: redeemed coupon {order.coupon_code}")
        else:
            logger.warning(
                f"Order {order.reference}: coupon {order.coupon_code} redeem skipped (cap reached or coupon gone)"
            )

    logger.info(f"Order {order.reference} paid ({event_type}) — sending confirmation email")

    plan = db.query(Plan).filter(Plan.id == order.plan_id).first()
    send_payment_confirmation_email(
        to_email=order.email,
        reference=order.reference,
        plan_name=plan.name if plan else order.plan_id,
        amount_cents=order.amount_cents,
    )

    logger.info(f"Order {order.reference} — submitting to JoyTel")

    order_tid = generate_order_tid()
    order.joytel_order_id = order_tid
    db.commit()

    try:
        result = await place_order(
            order_tid=order_tid,
            sku=plan.joytel_sku,
            email=order.email,
        )

        if result.get("code") != 0:
            raise RuntimeError(f"JoyTel rejected order: {result}")

        order.status = "ordering"
        db.commit()

        logger.info(f"Order {order.reference} submitted to JoyTel: {result}")

    except Exception as e:
        logger.error(f"JoyTel order submission failed for {order.reference}: {e}")
        order.error_message = f"JoyTel order failed: {str(e)}"

        # Automatic refund: customer was charged but we can't fulfill. Reverse
        # the Stripe charge so they don't chase support. If the refund itself
        # fails, keep the order at 'failed' for manual intervention.
        if order.stripe_payment_intent and not order.stripe_refund_id:
            try:
                refund = refund_payment_intent(
                    order.stripe_payment_intent,
                    metadata={"order_reference": order.reference, "reason": "joytel_failed"},
                )
                order.stripe_refund_id = refund.id
                order.status = "refunded"
                db.commit()
                logger.info(
                    f"Order {order.reference}: auto-refunded Stripe payment "
                    f"{order.stripe_payment_intent} → {refund.id}"
                )

                plan_for_email = plan or db.query(Plan).filter(Plan.id == order.plan_id).first()
                send_order_failed_email(
                    to_email=order.email,
                    reference=order.reference,
                    plan_name=plan_for_email.name if plan_for_email else order.plan_id,
                    amount_cents=order.amount_cents,
                )
            except Exception as refund_err:
                logger.error(
                    f"Order {order.reference}: Stripe refund FAILED — manual refund needed: {refund_err}"
                )
                order.status = "failed"
                order.error_message = f"{order.error_message} | refund failed: {refund_err}"
                db.commit()
        else:
            order.status = "failed"
            db.commit()

    return {"status": "ok"}


# --- JoyTel Order Callback ---


@router.post("/joytel/order")
async def joytel_order_callback(
    request: Request,
    db: Session = Depends(get_db),
):
    """Handle JoyTel Warehouse order callback.

    After we submit an order, JoyTel processes it (~30 seconds) and
    calls this endpoint with the snPin (redemption code). We then
    use the snPin to request the QR code from RSP+.

    Must return HTTP 200 or JoyTel will retry.
    """
    body = await request.json()
    logger.info(f"JoyTel order callback received: {body}")

    order_tid = body.get("orderTid")

    sn_pin = None
    for item in body.get("itemList") or []:
        for sn in item.get("snList") or []:
            if sn.get("snPin"):
                sn_pin = sn["snPin"]
                break
        if sn_pin:
            break

    if not order_tid or not sn_pin:
        logger.error(f"JoyTel order callback missing orderTid/snPin: {body}")
        return {"status": "ok"}  # Return 200 anyway to stop retries

    order = db.query(Order).filter(Order.joytel_order_id == order_tid).first()
    if not order:
        logger.error(f"JoyTel order callback: order {order_tid} not found")
        return {"status": "ok"}

    order.sn_pin = sn_pin
    order.status = "qr_pending"
    db.commit()

    logger.info(f"Order {order.reference} got snPin — requesting QR code from RSP+")

    # Request QR code from RSP+
    try:
        await redeem_coupon(sn_pin=sn_pin)
    except Exception as e:
        logger.error(f"RSP+ redeem failed for {order.reference}: {e}")
        order.error_message = f"RSP+ redeem failed: {str(e)}"
        db.commit()

    return {"status": "ok"}


# --- JoyTel QR Code Callback ---


@router.post("/joytel/notify/coupon/redeem")
async def joytel_qrcode_callback(
    request: Request,
    db: Session = Depends(get_db),
):
    """Handle JoyTel RSP+ QR code delivery callback.

    After we redeem an snPin, RSP+ processes it and calls this endpoint
    with the QR code data. This is the final step — once we have the
    QR code, we email it to the customer.

    Must return HTTP 200 or JoyTel will retry.
    """
    body = await request.json()
    logger.info(f"JoyTel QR code callback received: {body}")

    result_code = body.get("resultCode")
    data = body.get("data") or {}
    coupon = data.get("coupon")
    qrcode_type = data.get("qrcodeType")
    qrcode = data.get("qrcode")

    success = {"code": "000", "mesg": "success"}

    if result_code != "000":
        logger.error(f"RSP+ redeem failed for coupon {coupon}: {body}")
        if coupon:
            order = db.query(Order).filter(Order.sn_pin == coupon).first()
            if order:
                order.status = "failed"
                order.error_message = f"RSP+ redeem failed: {body.get('resultMesg')}"
                db.commit()
        return success

    if not coupon or not qrcode:
        logger.error(f"QR callback missing coupon/qrcode: {body}")
        return success

    order = db.query(Order).filter(Order.sn_pin == coupon).first()
    if not order:
        logger.error(f"QR callback: no order found for coupon {coupon}")
        return success

    if qrcode_type == 0:
        order.qr_code_url = qrcode
    else:
        order.qr_code_data = qrcode
    order.status = "delivered"
    db.commit()

    logger.info(f"Order {order.reference} completed — sending email to {order.email}")

    # Send email with QR code
    plan = db.query(Plan).filter(Plan.id == order.plan_id).first()
    try:
        send_esim_email(
            to_email=order.email,
            reference=order.reference,
            plan_name=plan.name if plan else "eSIM Plan",
            data_gb=plan.data_gb if plan else 0,
            validity_days=plan.validity_days if plan else 0,
            country=plan.country if plan else "",
            qr_code_data=qrcode,
            amount_cents=order.amount_cents,
        )
    except Exception as e:
        logger.error(f"Email delivery failed for {order.reference}: {e}")
        order.error_message = f"Email failed: {str(e)}"
        db.commit()

    return success


# --- JoyTel eSIM Installation Event Notification ---


@router.post("/joytel/notify/esim/esim-progress")
async def joytel_esim_progress(request: Request):
    """Receive eSIM installation lifecycle events from RSP+.

    Events: eligibility check, BPP download, install, enable, disable, delete, etc.
    We log for audit; no order state change required for basic order flow.

    Must return {"code":"000","mesg":"success"} or RSP+ will retry.
    """
    body = await request.json()
    logger.info(f"JoyTel eSIM progress event: {body}")
    return {"code": "000", "mesg": "success"}
