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
    """Check for orders stuck in 'ordering' or 'qr_pending' for too long
    and try to recover them by polling JoyTel directly. Catches missed
    callbacks (e.g. our server was briefly down when JoyTel called).
    """
    while True:
        try:
            db = SessionLocal()
            now = datetime.now(timezone.utc)
            cutoff = now - STALE_THRESHOLD

            stale_orders = (
                db.query(Order)
                .filter(
                    Order.status.in_(["ordering", "qr_pending"]),
                    Order.updated_at < cutoff,
                )
                .all()
            )

            for order in stale_orders:
                logger.info(f"Polling stale order {order.reference} (status: {order.status})")

                try:
                    if order.status == "ordering":
                        # JoyTel hasn't called back with the snPin yet — query
                        # them by the orderTid we sent. Was a 1-line bug here
                        # (passed order.id instead of order.joytel_order_id);
                        # fixed during the redesign.
                        if not order.joytel_order_id:
                            continue
                        result = await get_order_status(order.joytel_order_id)
                        sn_pin = None
                        for item in (result.get("data") or {}).get("itemList") or []:
                            for sn in item.get("snList") or []:
                                if sn.get("snPin"):
                                    sn_pin = sn["snPin"]
                                    break
                            if sn_pin:
                                break
                        if sn_pin:
                            order.sn_pin = sn_pin
                            order.status = "qr_pending"
                            db.commit()
                            await redeem_coupon(sn_pin=sn_pin)

                    elif order.status == "qr_pending" and order.sn_pin:
                        # snPin in hand but RSP+ never called back — re-redeem.
                        await redeem_coupon(sn_pin=order.sn_pin)

                except Exception as e:
                    logger.error(f"Poller error for order {order.reference}: {e}")

            db.close()

        except Exception as e:
            logger.error(f"Order poller error: {e}")

        await asyncio.sleep(POLL_INTERVAL)
