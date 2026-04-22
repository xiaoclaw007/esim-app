"""Stripe payment integration."""

import stripe

from app.config import settings
from app.models import Order, Plan

stripe.api_key = settings.stripe_secret_key


def create_checkout_session(order: Order, plan: Plan) -> tuple[str, str]:
    """Create a Stripe Checkout Session (hosted) and return (url, session_id).

    Legacy: used by the old static site, which redirects to Stripe's hosted
    page. The React site uses create_payment_intent instead for on-site
    Payment Element.
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


def create_payment_intent(order: Order, plan: Plan) -> stripe.PaymentIntent:
    """Create a Stripe PaymentIntent for on-site Payment Element checkout.

    The frontend mounts <PaymentElement> with the returned client_secret,
    then calls stripe.confirmPayment({ return_url }). Stripe emits
    payment_intent.succeeded once the card authorizes, which the webhook
    translates into the JoyTel fulfillment pipeline (same as the legacy
    checkout.session.completed path).

    automatic_payment_methods=enabled lets the PaymentElement surface cards,
    Apple Pay, Google Pay, and Link from the Stripe account config without
    us enumerating them here.
    """
    return stripe.PaymentIntent.create(
        amount=plan.price_cents,
        currency=plan.currency,
        receipt_email=order.email,
        automatic_payment_methods={"enabled": True},
        description=f"Nimvoy eSIM — {plan.name}",
        metadata={
            "order_id": order.id,
            "order_reference": order.reference,
            "plan_id": plan.id,
        },
    )


def verify_webhook_signature(payload: bytes, sig_header: str) -> dict:
    """Verify and parse a Stripe webhook event.

    Returns the event object if signature is valid, raises error otherwise.
    """
    event = stripe.Webhook.construct_event(
        payload, sig_header, settings.stripe_webhook_secret
    )
    return event
