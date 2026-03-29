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
from app.services.email_service import send_esim_email
from app.services.joytel_rsp import redeem_coupon
from app.services.joytel_warehouse import place_order
from app.services.stripe_service import verify_webhook_signature

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/webhooks", tags=["webhooks"])


# --- Stripe Webhook ---


@router.post("/stripe")
async def stripe_webhook(
    request: Request,
    stripe_signature: str = Header(alias="Stripe-Signature"),
    db: Session = Depends(get_db),
):
    """Handle Stripe payment confirmation.

    When a customer completes checkout, Stripe sends this webhook.
    We verify the signature, update the order to 'paid', then
    immediately submit the order to JoyTel Warehouse.
    """
    payload = await request.body()

    # Verify this is really from Stripe (not a spoofed request)
    try:
        event = verify_webhook_signature(payload, stripe_signature)
    except Exception as e:
        logger.error(f"Stripe webhook signature verification failed: {e}")
        raise HTTPException(status_code=400, detail="Invalid signature")

    if event["type"] != "checkout.session.completed":
        # We only care about successful payments for now
        return {"status": "ignored"}

    session = event["data"]["object"]
    order_id = session["metadata"]["order_id"]

    # Find the order
    order = db.query(Order).filter(Order.id == order_id).first()
    if not order:
        logger.error(f"Stripe webhook: order {order_id} not found")
        raise HTTPException(status_code=404, detail="Order not found")

    # Update order with payment info
    order.status = "paid"
    order.stripe_payment_intent = session.get("payment_intent")
    db.commit()

    logger.info(f"Order {order.reference} paid — submitting to JoyTel")

    # Submit order to JoyTel Warehouse
    try:
        plan = db.query(Plan).filter(Plan.id == order.plan_id).first()
        result = await place_order(order_id=order.id, sku=plan.joytel_sku)

        order.status = "joytel_pending"
        order.joytel_order_id = result.get("orderId")
        db.commit()

        logger.info(f"Order {order.reference} submitted to JoyTel: {result}")

    except Exception as e:
        logger.error(f"JoyTel order submission failed for {order.reference}: {e}")
        order.status = "failed"
        order.error_message = f"JoyTel order failed: {str(e)}"
        db.commit()
        # TODO: trigger Stripe refund here

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

    order_id = body.get("outTradeNo")
    sn_pin = body.get("snPin")

    if not order_id or not sn_pin:
        logger.error(f"JoyTel callback missing required fields: {body}")
        return {"status": "ok"}  # Return 200 anyway to stop retries

    # Find the order
    order = db.query(Order).filter(Order.id == order_id).first()
    if not order:
        logger.error(f"JoyTel callback: order {order_id} not found")
        return {"status": "ok"}

    # Store the snPin
    order.sn_pin = sn_pin
    order.status = "snpin_received"
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


@router.post("/joytel/qrcode")
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

    # Extract QR code data — the exact field names depend on JoyTel's actual response
    coupon = body.get("coupon")
    qr_data = body.get("qrCode") or body.get("activationCode") or body.get("matchingId")

    if not coupon or not qr_data:
        logger.error(f"QR callback missing required fields: {body}")
        return {"status": "ok"}

    # Find the order by snPin
    order = db.query(Order).filter(Order.sn_pin == coupon).first()
    if not order:
        logger.error(f"QR callback: no order found for coupon {coupon}")
        return {"status": "ok"}

    # Store QR code
    order.qr_code_data = qr_data
    order.status = "completed"
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
            qr_code_data=qr_data,
        )
    except Exception as e:
        logger.error(f"Email delivery failed for {order.reference}: {e}")
        order.error_message = f"Email failed: {str(e)}"
        db.commit()

    return {"status": "ok"}
