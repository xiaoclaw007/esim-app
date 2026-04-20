"""JoyTel RSP+ API client — QR code retrieval for eSIM profiles.

Spec reference: JoyTel API R.20240222.01, System 2 (RSP Business).

Auth: HTTP headers AppId / TransId / Timestamp / Ciphertext,
where Ciphertext = MD5(AppId + TransId + Timestamp + AppSecret).
"""

import hashlib
import logging
import time
import uuid
from typing import Any

import httpx

from app.config import settings

logger = logging.getLogger(__name__)


def _new_trans_id() -> str:
    """Unique per-request transaction ID (max 50 chars)."""
    return uuid.uuid4().hex


def _auth_headers() -> tuple[dict[str, str], str]:
    """Build RSP+ auth headers. Returns (headers, trans_id)."""
    app_id = settings.joytel_app_id
    trans_id = _new_trans_id()
    timestamp = str(int(time.time() * 1000))
    ciphertext = hashlib.md5(
        f"{app_id}{trans_id}{timestamp}{settings.joytel_app_secret}".encode()
    ).hexdigest()

    headers = {
        "AppId": app_id,
        "TransId": trans_id,
        "Timestamp": timestamp,
        "Ciphertext": ciphertext,
        "Content-Type": "application/json",
    }
    return headers, trans_id


async def _post(path: str, body: dict[str, Any]) -> dict:
    headers, _ = _auth_headers()
    async with httpx.AsyncClient(timeout=30.0) as client:
        response = await client.post(
            f"{settings.joytel_rsp_url}{path}",
            headers=headers,
            json=body,
        )
        response.raise_for_status()
        return response.json()


async def redeem_coupon(sn_pin: str, qrcode_type: int = 1) -> dict:
    """Redeem an snPin/coupon to trigger async QR code delivery.

    qrcode_type: 0 = QR image URL, 1 = QR content text (LPA string). Default 1.
    Real QR code arrives asynchronously via the redeem callback.
    """
    result = await _post("/coupon/redeem", {"coupon": sn_pin, "qrcodeType": qrcode_type})
    logger.info(f"RSP+ redeem response for {sn_pin}: {result}")
    return result


async def get_esim_status(coupon: str) -> dict:
    """Query eSIM profile status by coupon."""
    return await _post("/esim/status/query", {"coupon": coupon})


async def get_esim_usage(coupon: str) -> dict:
    """Query eSIM data usage by coupon."""
    return await _post("/esim/usage/query", {"coupon": coupon})
