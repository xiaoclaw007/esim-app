"""Public event ingestion endpoint.

The customer SPA POSTs interesting interactions here as one-shot pings. We
enrich each event with IP→country (GeoIP) and User-Agent→device, then
insert. Auth is optional — most events come from anonymous browsers; if a
session JWT is attached, we link the event to the user.

Hard rules to keep this endpoint cheap and safe:
  * `type` must be in ALLOWED_EVENT_TYPES — no arbitrary writes.
  * `metadata` is whatever the frontend sends as a JSON object, capped to
    a few KB per row by Pydantic schema (free-form fields are short).
  * No authentication required, no rate limiting in V1 (admin is the only
    consumer; abusing this just inflates one customer's funnel chart).
"""

from __future__ import annotations

import logging
from typing import Any, Optional

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.database import get_db
from app.middleware.auth import get_optional_user
from app.models import Event, User
from app.services.analytics import (
    ALLOWED_EVENT_TYPES,
    device_from_user_agent,
    normalize_referrer,
)
from app.services.geoip import country_for_ip

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api", tags=["track"])


class TrackRequest(BaseModel):
    type: str = Field(..., max_length=40)
    session_id: Optional[str] = Field(default=None, max_length=64)
    path: Optional[str] = Field(default=None, max_length=500)
    referrer: Optional[str] = Field(default=None, max_length=500)
    metadata: Optional[dict[str, Any]] = None


class TrackResponse(BaseModel):
    ok: bool = True


def _client_ip(request: Request) -> Optional[str]:
    """Resolve the originating client IP. Behind nginx/Cloudflare we pick the
    leftmost X-Forwarded-For entry; locally we fall back to request.client.
    """
    # Cloudflare's CF-Connecting-IP is the most reliable when present.
    cf = request.headers.get("CF-Connecting-IP")
    if cf:
        return cf.strip()
    xff = request.headers.get("X-Forwarded-For")
    if xff:
        # Comma-separated list; original client is leftmost.
        return xff.split(",")[0].strip()
    return request.client.host if request.client else None


@router.post("/track", response_model=TrackResponse)
def track_event(
    body: TrackRequest,
    request: Request,
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_optional_user),
) -> TrackResponse:
    if body.type not in ALLOWED_EVENT_TYPES:
        # 422 (not 400) so the frontend can spot a typo'd type during dev.
        raise HTTPException(status_code=422, detail=f"Unknown event type: {body.type}")

    ua = request.headers.get("User-Agent", "")[:500]
    own_host = request.headers.get("Host")
    ip = _client_ip(request)

    event = Event(
        type=body.type,
        session_id=body.session_id,
        user_id=current_user.id if current_user else None,
        path=body.path,
        referrer=normalize_referrer(body.referrer, own_host),
        country=country_for_ip(ip),
        device=device_from_user_agent(ua),
        user_agent=ua or None,
        event_metadata=body.metadata,
    )
    db.add(event)
    db.commit()
    return TrackResponse()
