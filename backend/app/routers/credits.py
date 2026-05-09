"""Customer-facing endpoints for the Nimvoy Credit ledger.

Two reads:
  GET /api/credits/balance   — current spendable balance + earliest expiry
  GET /api/credits/history   — paginated ledger rows for the logged-in user

No mutations from the customer; earns + spends + reverses all flow
from server-side hooks (checkout, webhooks, refund). Admin grants /
revocations live behind /api/admin/.
"""

from __future__ import annotations

from datetime import datetime, timezone
from typing import List, Optional

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel
from sqlalchemy import or_
from sqlalchemy.orm import Session

from app.database import get_db
from app.middleware.auth import get_current_user
from app.models import CreditsLedger, Order, User
from app.services import credits as credits_service

router = APIRouter(prefix="/api/credits", tags=["credits"])


class CreditBalanceResponse(BaseModel):
    balance_cents: int
    earliest_expiry: Optional[str] = None  # ISO datetime of next batch to expire
    earn_rate: float  # 0.10 = 10%; lets the UI render "earn 10% back" copy


class CreditHistoryRow(BaseModel):
    id: str
    delta_cents: int
    reason: str
    related_order_reference: Optional[str] = None
    expires_at: Optional[str] = None
    created_at: str


class CreditHistoryResponse(BaseModel):
    rows: List[CreditHistoryRow]
    total: int


@router.get("/balance", response_model=CreditBalanceResponse)
def get_balance(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> CreditBalanceResponse:
    """Spendable balance + earliest-expiring batch."""
    from app.config import settings

    bal = credits_service.balance(db, current_user.id)

    # Find the earliest expiry of any unexpired earn row that still has
    # net-positive balance not yet spent. Simpler approximation: just
    # return the earliest expires_at among earn rows after now. UI uses
    # this for "earliest credit expires Jan 2027"-style hints.
    now = datetime.now(timezone.utc)
    earliest = (
        db.query(CreditsLedger.expires_at)
        .filter(
            CreditsLedger.user_id == current_user.id,
            CreditsLedger.delta_cents > 0,
            CreditsLedger.expires_at.isnot(None),
            CreditsLedger.expires_at > now,
        )
        .order_by(CreditsLedger.expires_at.asc())
        .first()
    )
    return CreditBalanceResponse(
        balance_cents=bal,
        earliest_expiry=earliest[0].isoformat() if earliest and earliest[0] else None,
        earn_rate=settings.credit_earn_rate,
    )


@router.get("/history", response_model=CreditHistoryResponse)
def get_history(
    page: int = Query(default=1, ge=1),
    per_page: int = Query(default=50, ge=1, le=100),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> CreditHistoryResponse:
    """Paginated ledger rows for the customer, newest first."""
    q = db.query(CreditsLedger).filter(CreditsLedger.user_id == current_user.id)
    total = q.count()
    rows = (
        q.order_by(CreditsLedger.created_at.desc())
        .offset((page - 1) * per_page)
        .limit(per_page)
        .all()
    )

    # Bulk-fetch related order references to render in the UI
    # without N+1 lookups.
    order_ids = [r.related_order_id for r in rows if r.related_order_id]
    refs: dict[str, str] = {}
    if order_ids:
        for oid, ref in (
            db.query(Order.id, Order.reference)
            .filter(Order.id.in_(order_ids))
            .all()
        ):
            refs[oid] = ref

    return CreditHistoryResponse(
        rows=[
            CreditHistoryRow(
                id=r.id,
                delta_cents=r.delta_cents,
                reason=r.reason,
                related_order_reference=refs.get(r.related_order_id) if r.related_order_id else None,
                expires_at=r.expires_at.isoformat() if r.expires_at else None,
                created_at=r.created_at.isoformat(),
            )
            for r in rows
        ],
        total=total,
    )
