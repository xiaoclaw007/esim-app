"""JoyTel RSP+ API client — QR code retrieval for eSIM profiles."""

import hashlib
import json
import logging
import time

import httpx

from app.config import settings

logger = logging.getLogger(__name__)


def _generate_rsp_sign(params: dict) -> str:
    """Generate auth signature for JoyTel RSP+ API.

    RSP+ uses AppID + AppSecret in its signature scheme.
    Sort params, concatenate, append AppSecret, MD5 hash.
    """
    sorted_keys = sorted(params.keys())
    sign_str = "&".join(f"{k}={params[k]}" for k in sorted_keys if params[k])
    sign_str += f"&appSecret={settings.joytel_app_secret}"
    return hashlib.md5(sign_str.encode()).hexdigest().upper()


async def redeem_coupon(
    sn_pin: str,
    callback_url: str | None = None,
) -> dict:
    """Redeem an snPin/coupon to get the eSIM QR code.

    After JoyTel Warehouse gives us an snPin, we use it here
    to request the actual eSIM profile (QR code).

    Args:
        sn_pin: The redemption code from the Warehouse order callback
        callback_url: URL for JoyTel RSP+ to send the QR code callback

    Returns:
        RSP+ API response dict
    """
    if callback_url is None:
        callback_url = f"{settings.backend_url}/api/webhooks/joytel/qrcode"

    params = {
        "appId": settings.joytel_app_id,
        "coupon": sn_pin,
        "notifyUrl": callback_url,
        "timestamp": str(int(time.time() * 1000)),
    }
    params["sign"] = _generate_rsp_sign(params)

    async with httpx.AsyncClient(timeout=30.0) as client:
        response = await client.post(
            f"{settings.joytel_rsp_url}/coupon/redeem",
            json=params,
        )
        response.raise_for_status()
        result = response.json()

    logger.info(f"RSP+ redeem response for {sn_pin}: {result}")
    return result


async def get_esim_status(sn_code: str) -> dict:
    """Query eSIM profile status by snCode.

    Args:
        sn_code: The eSIM serial code (format: 898620003xxxxxxx)

    Returns:
        RSP+ API response with eSIM status and usage data
    """
    params = {
        "appId": settings.joytel_app_id,
        "snCode": sn_code,
        "timestamp": str(int(time.time() * 1000)),
    }
    params["sign"] = _generate_rsp_sign(params)

    async with httpx.AsyncClient(timeout=30.0) as client:
        response = await client.post(
            f"{settings.joytel_rsp_url}/esim/status",
            json=params,
        )
        response.raise_for_status()
        return response.json()
