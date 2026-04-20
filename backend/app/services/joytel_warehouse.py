"""JoyTel Warehouse API client — order placement and status checks.

Spec reference: JoyTel API R.20240222.01, System 1 (Warehouse - eSIM Order).
"""

import hashlib
import logging
import time
from typing import Optional

import httpx

from app.config import settings

logger = logging.getLogger(__name__)


def _sha1(s: str) -> str:
    return hashlib.sha1(s.encode()).hexdigest()


def _order_autograph(
    customer_code: str,
    customer_auth: str,
    warehouse: str,
    type_: int,
    order_tid: str,
    receive_name: str,
    phone: str,
    timestamp: int,
    item_list: list[dict],
) -> str:
    items = "".join(f"{i['productCode']}{i['quantity']}" for i in item_list)
    raw = (
        f"{customer_code}{customer_auth}{warehouse}{type_}{order_tid}"
        f"{receive_name}{phone}{timestamp}{items}"
    )
    return _sha1(raw)


def _query_autograph(
    customer_code: str,
    customer_auth: str,
    order_code: str,
    order_tid: str,
    timestamp: int,
) -> str:
    raw = f"{customer_code}{customer_auth}{order_code}{order_tid}{timestamp}"
    return _sha1(raw)


async def place_order(
    order_id: str,
    sku: str,
    email: str,
    quantity: int = 1,
    receive_name: str = "eSIM Customer",
    phone: str = "00000000000",
    callback_url: Optional[str] = None,  # noqa: ARG001 — configured on JoyTel side
) -> dict:
    """Submit an eSIM order to JoyTel Warehouse.

    Callback URL is pre-configured on JoyTel's side (not sent per-request).
    """
    timestamp = int(time.time() * 1000)
    item_list = [{"productCode": sku, "quantity": quantity}]

    body = {
        "customerCode": settings.joytel_customer_code,
        "orderTid": order_id,
        "type": 3,
        "receiveName": receive_name,
        "phone": phone,
        "timestamp": timestamp,
        "autoGraph": _order_autograph(
            customer_code=settings.joytel_customer_code,
            customer_auth=settings.joytel_customer_auth,
            warehouse="",
            type_=3,
            order_tid=order_id,
            receive_name=receive_name,
            phone=phone,
            timestamp=timestamp,
            item_list=item_list,
        ),
        "email": email,
        "replyType": 1,
        "itemList": item_list,
    }

    async with httpx.AsyncClient(timeout=30.0) as client:
        response = await client.post(
            f"{settings.joytel_warehouse_url}/customerApi/customerOrder",
            json=body,
        )
        response.raise_for_status()
        result = response.json()

    logger.info(f"JoyTel order response for {order_id}: {result}")
    return result


async def get_order_status(order_id: str, order_code: Optional[str] = None) -> dict:
    """Query order status (fallback if callback missed)."""
    timestamp = int(time.time() * 1000)
    body = {
        "customerCode": settings.joytel_customer_code,
        "orderTid": order_id,
        "timestamp": timestamp,
        "autoGraph": _query_autograph(
            customer_code=settings.joytel_customer_code,
            customer_auth=settings.joytel_customer_auth,
            order_code=order_code or "",
            order_tid=order_id,
            timestamp=timestamp,
        ),
    }
    if order_code:
        body["orderCode"] = order_code

    async with httpx.AsyncClient(timeout=30.0) as client:
        response = await client.post(
            f"{settings.joytel_warehouse_url}/customerApi/customerOrder/query",
            json=body,
        )
        response.raise_for_status()
        return response.json()
