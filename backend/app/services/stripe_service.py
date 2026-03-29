"""Stripe payment integration."""

import stripe
from sqlalchemy.orm import Session

from app.config import settings
from app.models import Order, Plan

stripe.api_key = settings.stripe_secret_key


def create_checkout_session(order: Order, plan: Plan) -> str:
    """Create a Stripe Checkout Session and return the URL.

    Stripe hosts the entire payment page — we just redirect the user there.
    After payment, Stripe redirects them to our success page and sends
    a webhook to confirm the payment server-side.
    """
    session = stripe.checkout.Session.create(
        payment_method_types=["card"],
        line_items=[
            {
                "price_data": {
                    "currency": plan.currency,
                    "unit_amount": plan.price_cents,
                    "product_data": {
                        "name": plan.name,
                        "description": f"{plan.data_gb}GB / {plan.validity_days} days",
                    },
                },
                "quantity": 1,
            }
        ],
        mode="payment",
        success_url=f"{settings.frontend_url}/confirmation.html?ref={order.reference}",
        cancel_url=f"{settings.frontend_url}/plans.html",
        customer_email=order.email,
        metadata={
            "order_id": order.id,
            "order_reference": order.reference,
        },
    )

    return session.url, session.id


def verify_webhook_signature(payload: bytes, sig_header: str) -> dict:
    """Verify and parse a Stripe webhook event.

    Returns the event object if signature is valid, raises error otherwise.
    """
    event = stripe.Webhook.construct_event(
        payload, sig_header, settings.stripe_webhook_secret
    )
    return event
