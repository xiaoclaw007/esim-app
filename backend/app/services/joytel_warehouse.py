"""JoyTel Warehouse API client — order placement and status checks."""

import hashlib
import json
import logging
from typing import Optional
import time

import httpx

from app.config import settings

logger = logging.getLogger(__name__)


def _generate_sign(params: dict) -> str:
    """Generate auth signature for JoyTel Warehouse API.

    JoyTel uses a signature scheme: sort params alphabetically,
    concatenate as key=value pairs, append customerAuth, then MD5 hash.
    """
    sorted_keys = sorted(params.keys())
    sign_str = "&".join(f"{k}={params[k]}" for k in sorted_keys if params[k])
    sign_str += f"&key={settings.joytel_customer_auth}"
    return hashlib.md5(sign_str.encode()).hexdigest().upper()


async def place_order(
    order_id: str,
    sku: str,
    quantity: int = 1,
    callback_url: "Optional[str]" = None,
) -> dict:
    """Submit an order to JoyTel Warehouse.

    Args:
        order_id: Our internal order ID (used as outTradeNo for tracking)
        sku: JoyTel product SKU
        quantity: Number of eSIMs to order (usually 1)
        callback_url: URL for JoyTel to send the order result callback

    Returns:
        JoyTel API response dict
    """
    if callback_url is None:
        callback_url = f"{settings.backend_url}/api/webhooks/joytel/order"

    params = {
        "customerCode": settings.joytel_customer_code,
        "outTradeNo": order_id,
        "productCode": sku,
        "quantity": str(quantity),
        "replyType": "1",  # 1 = async callback notification
        "notifyUrl": callback_url,
        "timestamp": str(int(time.time() * 1000)),
    }
    params["sign"] = _generate_sign(params)

    async with httpx.AsyncClient(timeout=30.0) as client:
        response = await client.post(
            f"{settings.joytel_warehouse_url}/api/order/submit",
            json=params,
        )
        response.raise_for_status()
        result = response.json()

    logger.info(f"JoyTel order response for {order_id}: {result}")
    return result


async def get_order_status(order_id: str) -> dict:
    """Check order status via JoyTel Warehouse API (fallback if callback missed).

    Args:
        order_id: Our internal order ID (outTradeNo)

    Returns:
        JoyTel API response with order status and snPin if available
    """
    params = {
        "customerCode": settings.joytel_customer_code,
        "outTradeNo": order_id,
        "timestamp": str(int(time.time() * 1000)),
    }
    params["sign"] = _generate_sign(params)

    async with httpx.AsyncClient(timeout=30.0) as client:
        response = await client.post(
            f"{settings.joytel_warehouse_url}/api/order/query",
            json=params,
        )
        response.raise_for_status()
        return response.json()
