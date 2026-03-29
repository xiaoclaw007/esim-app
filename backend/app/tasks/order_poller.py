"""Background task to check on stale orders.

If a JoyTel callback is missed (e.g., our server was temporarily down),
this poller catches it by checking order status directly via the API.

Runs as a background task in the FastAPI app.
"""

import asyncio
import logging
from datetime import datetime, timedelta, timezone

from sqlalchemy.orm import Session

from app.database import SessionLocal
from app.models import Order, Plan
from app.services.email_service import send_esim_email
from app.services.joytel_rsp import redeem_coupon
from app.services.joytel_warehouse import get_order_status

logger = logging.getLogger(__name__)

# How often to check (seconds)
POLL_INTERVAL = 60

# How old an order must be before we consider it stale
STALE_THRESHOLD = timedelta(minutes=5)


async def poll_pending_orders():
    """Check for orders stuck in intermediate states and retry.

    Looks for orders that have been in 'joytel_pending' or 'snpin_received'
    for too long and attempts to recover them.
    """
    while True:
        try:
            db = SessionLocal()
            now = datetime.now(timezone.utc)
            cutoff = now - STALE_THRESHOLD

            # Find stale orders
            stale_orders = (
                db.query(Order)
                .filter(
                    Order.status.in_(["joytel_pending", "snpin_received"]),
                    Order.updated_at < cutoff,
                )
                .all()
            )

            for order in stale_orders:
                logger.info(f"Polling stale order {order.reference} (status: {order.status})")

                try:
                    if order.status == "joytel_pending":
                        # Check if JoyTel has processed the order
                        result = await get_order_status(order.id)
                        sn_pin = result.get("snPin")
                        if sn_pin:
                            order.sn_pin = sn_pin
                            order.status = "snpin_received"
                            db.commit()
                            # Proceed to redeem
                            await redeem_coupon(sn_pin=sn_pin)

                    elif order.status == "snpin_received" and order.sn_pin:
                        # Retry RSP+ redemption
                        await redeem_coupon(sn_pin=order.sn_pin)

                except Exception as e:
                    logger.error(f"Poller error for order {order.reference}: {e}")

            db.close()

        except Exception as e:
            logger.error(f"Order poller error: {e}")

        await asyncio.sleep(POLL_INTERVAL)
