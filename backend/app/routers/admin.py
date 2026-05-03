"""Admin/CRM endpoints — read-only for V1.

Every route requires `is_admin=True` on the authenticated User. Non-admins
get 404 (not 403) so the existence of these endpoints isn't disclosed.
"""

from __future__ import annotations

import logging
from collections import defaultdict
from datetime import datetime, timedelta, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.database import get_db
from app.middleware.auth import get_admin_user
from app.models import Order, Plan, User
from app.schemas import UserResponse

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/admin", tags=["admin"])


# ---- Smoke / who-am-I ------------------------------------------------------


@router.get("/me", response_model=UserResponse)
def admin_me(current: User = Depends(get_admin_user)) -> User:
    """Echo back the authenticated admin User. Frontend uses this to gate
    the /admin route and grab the admin's name + avatar for the sidebar.
    """
    return current


# ---- Orders ---------------------------------------------------------------


class AdminOrderRow(BaseModel):
    reference: str
    created_at: datetime
    status: str
    plan_id: str
    plan_name: Optional[str]
    plan_country: Optional[str]
    plan_data_gb: Optional[int]
    plan_validity_days: Optional[int]
    amount_cents: int
    currency: str
    email: str
    user_id: Optional[str]
    user_name: Optional[str]
    user_auth: str  # "google" | "password" | "guest"


class AdminOrderListResponse(BaseModel):
    orders: list[AdminOrderRow]
    total: int
    page: int
    per_page: int


def _user_auth(user: Optional[User]) -> str:
    """Map a User row to the auth-pill enum the CRM uses."""
    if user is None:
        return "guest"
    if user.google_id:
        return "google"
    if user.password_hash:
        return "password"
    return "guest"


def _order_row(order: Order, plan: Optional[Plan], user: Optional[User]) -> AdminOrderRow:
    return AdminOrderRow(
        reference=order.reference,
        created_at=order.created_at,
        status=order.status,
        plan_id=order.plan_id,
        plan_name=plan.name if plan else None,
        plan_country=plan.country if plan else None,
        plan_data_gb=plan.data_gb if plan else None,
        plan_validity_days=plan.validity_days if plan else None,
        amount_cents=order.amount_cents,
        currency=order.currency,
        email=order.email,
        user_id=user.id if user else None,
        user_name=user.name if user else None,
        user_auth=_user_auth(user),
    )


@router.get("/orders", response_model=AdminOrderListResponse)
def admin_list_orders(
    q: Optional[str] = Query(default=None, description="Search by reference, email, or plan_id"),
    status: Optional[str] = Query(default=None),
    page: int = Query(default=1, ge=1),
    per_page: int = Query(default=50, ge=1, le=200),
    db: Session = Depends(get_db),
    _admin: User = Depends(get_admin_user),
) -> AdminOrderListResponse:
    query = db.query(Order)
    if status:
        query = query.filter(Order.status == status)
    if q:
        like = f"%{q.strip()}%"
        query = query.filter(
            (Order.reference.ilike(like))
            | (Order.email.ilike(like))
            | (Order.plan_id.ilike(like))
        )
    total = query.count()
    rows = (
        query.order_by(Order.created_at.desc())
        .offset((page - 1) * per_page)
        .limit(per_page)
        .all()
    )

    # Bulk-load related Plans + Users so we don't N+1.
    plan_ids = {r.plan_id for r in rows if r.plan_id}
    user_ids = {r.user_id for r in rows if r.user_id}
    plans_by_id = {p.id: p for p in db.query(Plan).filter(Plan.id.in_(plan_ids)).all()} if plan_ids else {}
    users_by_id = {u.id: u for u in db.query(User).filter(User.id.in_(user_ids)).all()} if user_ids else {}

    return AdminOrderListResponse(
        orders=[
            _order_row(o, plans_by_id.get(o.plan_id), users_by_id.get(o.user_id) if o.user_id else None)
            for o in rows
        ],
        total=total,
        page=page,
        per_page=per_page,
    )


class AdminOrderDetail(AdminOrderRow):
    """Adds the fields surfaced in the order drawer."""

    stripe_payment_intent: Optional[str] = None
    stripe_refund_id: Optional[str] = None
    joytel_order_id: Optional[str] = None
    sn_pin: Optional[str] = None
    qr_code_data: Optional[str] = None
    qr_code_url: Optional[str] = None
    error_message: Optional[str] = None
    updated_at: datetime


@router.get("/orders/{reference}", response_model=AdminOrderDetail)
def admin_order_detail(
    reference: str,
    db: Session = Depends(get_db),
    _admin: User = Depends(get_admin_user),
) -> AdminOrderDetail:
    order = db.query(Order).filter(Order.reference == reference).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    plan = db.query(Plan).filter(Plan.id == order.plan_id).first() if order.plan_id else None
    user = db.query(User).filter(User.id == order.user_id).first() if order.user_id else None

    base = _order_row(order, plan, user)
    return AdminOrderDetail(
        **base.model_dump(),
        stripe_payment_intent=order.stripe_payment_intent,
        stripe_refund_id=order.stripe_refund_id,
        joytel_order_id=order.joytel_order_id,
        sn_pin=order.sn_pin,
        qr_code_data=order.qr_code_data,
        qr_code_url=order.qr_code_url,
        error_message=order.error_message,
        updated_at=order.updated_at,
    )


# ---- Customers ------------------------------------------------------------


class AdminCustomerRow(BaseModel):
    id: str
    email: str
    name: Optional[str]
    auth: str  # google | password | guest
    signup: datetime
    orders_count: int
    ltv_cents: int


class AdminCustomerListResponse(BaseModel):
    customers: list[AdminCustomerRow]
    total: int
    page: int
    per_page: int


@router.get("/customers", response_model=AdminCustomerListResponse)
def admin_list_customers(
    q: Optional[str] = None,
    auth: Optional[str] = Query(default=None, description="google | password | guest"),
    page: int = Query(default=1, ge=1),
    per_page: int = Query(default=50, ge=1, le=200),
    db: Session = Depends(get_db),
    _admin: User = Depends(get_admin_user),
) -> AdminCustomerListResponse:
    """List registered users + an aggregated 'guest' bucket per unique email
    that has placed orders without a User row.

    LTV uses sum(order.amount_cents) — refunds are NOT subtracted (refunded
    orders count toward LTV but you can see them in the Orders page).
    """
    # 1) Registered users
    user_query = db.query(User)
    if q:
        like = f"%{q.strip()}%"
        user_query = user_query.filter(
            (User.email.ilike(like)) | (User.name.ilike(like))
        )
    if auth in ("google", "password"):
        if auth == "google":
            user_query = user_query.filter(User.google_id.isnot(None))
        else:  # password
            user_query = user_query.filter(User.password_hash.isnot(None), User.google_id.is_(None))

    users = user_query.all() if auth != "guest" else []

    # Order aggregates per user (one round-trip).
    user_ids = [u.id for u in users]
    order_aggs: dict[str, tuple[int, int]] = {}
    if user_ids:
        for uid, count, total in (
            db.query(Order.user_id, func.count(Order.id), func.coalesce(func.sum(Order.amount_cents), 0))
            .filter(Order.user_id.in_(user_ids))
            .group_by(Order.user_id)
            .all()
        ):
            order_aggs[uid] = (count, total)

    rows: list[AdminCustomerRow] = []
    for u in users:
        count, total = order_aggs.get(u.id, (0, 0))
        rows.append(
            AdminCustomerRow(
                id=u.id,
                email=u.email,
                name=u.name,
                auth=_user_auth(u),
                signup=u.created_at,
                orders_count=count,
                ltv_cents=total,
            )
        )

    # 2) Guest buckets — Orders without user_id, grouped by email.
    if auth in (None, "guest"):
        guest_query = db.query(
            Order.email,
            func.min(Order.created_at).label("first"),
            func.count(Order.id).label("cnt"),
            func.coalesce(func.sum(Order.amount_cents), 0).label("ltv"),
        ).filter(Order.user_id.is_(None)).group_by(Order.email)
        if q:
            like = f"%{q.strip()}%"
            guest_query = guest_query.filter(Order.email.ilike(like))
        for email, first, cnt, ltv in guest_query.all():
            rows.append(
                AdminCustomerRow(
                    id=f"guest:{email}",
                    email=email,
                    name=None,
                    auth="guest",
                    signup=first,
                    orders_count=int(cnt),
                    ltv_cents=int(ltv),
                )
            )

    rows.sort(key=lambda r: r.signup, reverse=True)
    total = len(rows)
    sliced = rows[(page - 1) * per_page : page * per_page]

    return AdminCustomerListResponse(
        customers=sliced, total=total, page=page, per_page=per_page
    )


# ---- Catalog --------------------------------------------------------------


class AdminPlanRow(BaseModel):
    id: str
    joytel_sku: str
    name: str
    country: str
    region: str
    plan_type: str
    data_gb: int
    validity_days: int
    price_cents: int
    currency: str
    active: bool
    sold_30d: int


class AdminCountryRow(BaseModel):
    code: str
    name: str
    flag: str
    plan_count: int


# Hard-coded country metadata (mirrors frontend src/data/catalog.ts).
# Expand as the catalog grows.
_COUNTRY_META = {
    "US": ("United States", "🇺🇸"),
    "JP": ("Japan", "🇯🇵"),
    "KR": ("South Korea", "🇰🇷"),
    "CN": ("China", "🇨🇳"),
    "EU": ("Europe", "🇪🇺"),
    "AP": ("Asia-Pacific", "🌏"),
    "CHM": ("China + HK + Macau", "🇨🇳"),
}


@router.get("/catalog/countries", response_model=list[AdminCountryRow])
def admin_list_countries(
    db: Session = Depends(get_db),
    _admin: User = Depends(get_admin_user),
) -> list[AdminCountryRow]:
    counts: dict[str, int] = defaultdict(int)
    for code, n in db.query(Plan.country, func.count(Plan.id)).group_by(Plan.country).all():
        counts[code] = int(n)
    rows: list[AdminCountryRow] = []
    for code, n in sorted(counts.items()):
        name, flag = _COUNTRY_META.get(code, (code, "🌐"))
        rows.append(AdminCountryRow(code=code, name=name, flag=flag, plan_count=n))
    return rows


@router.get("/catalog/plans", response_model=list[AdminPlanRow])
def admin_list_plans(
    country: Optional[str] = None,
    db: Session = Depends(get_db),
    _admin: User = Depends(get_admin_user),
) -> list[AdminPlanRow]:
    q = db.query(Plan)
    if country:
        q = q.filter(Plan.country == country.upper())
    plans = q.order_by(Plan.country, Plan.data_gb, Plan.validity_days).all()

    # Bulk sold-in-last-30d for these plans.
    plan_ids = [p.id for p in plans]
    cutoff = datetime.now(timezone.utc) - timedelta(days=30)
    sold_30d: dict[str, int] = defaultdict(int)
    if plan_ids:
        for pid, n in (
            db.query(Order.plan_id, func.count(Order.id))
            .filter(Order.plan_id.in_(plan_ids), Order.created_at >= cutoff)
            .filter(Order.status.in_(("paid", "joytel_pending", "snpin_received", "completed")))
            .group_by(Order.plan_id)
            .all()
        ):
            sold_30d[pid] = int(n)

    return [
        AdminPlanRow(
            id=p.id,
            joytel_sku=p.joytel_sku,
            name=p.name,
            country=p.country,
            region=p.region,
            plan_type=p.plan_type,
            data_gb=p.data_gb,
            validity_days=p.validity_days,
            price_cents=p.price_cents,
            currency=p.currency,
            active=p.active,
            sold_30d=sold_30d.get(p.id, 0),
        )
        for p in plans
    ]


# ---- Dashboard / KPIs -----------------------------------------------------


class AdminKpiResponse(BaseModel):
    revenue_cents_30d: int
    revenue_cents_prev: int
    orders_30d: int
    orders_prev: int
    completed_esims: int
    failed_orders: int
    refunded_orders: int
    top_destinations: list[dict]
    queue: list[dict]


# Statuses that count as "real revenue" (paid and not refunded back).
_REVENUE_STATUSES = ("paid", "joytel_pending", "snpin_received", "completed")


@router.get("/kpis", response_model=AdminKpiResponse)
def admin_kpis(
    db: Session = Depends(get_db),
    _admin: User = Depends(get_admin_user),
) -> AdminKpiResponse:
    now = datetime.now(timezone.utc)
    cutoff_30 = now - timedelta(days=30)
    cutoff_60 = now - timedelta(days=60)

    def _bucket_total(start: datetime, end: datetime) -> tuple[int, int]:
        q = (
            db.query(
                func.count(Order.id),
                func.coalesce(func.sum(Order.amount_cents), 0),
            )
            .filter(
                Order.created_at >= start,
                Order.created_at < end,
                Order.status.in_(_REVENUE_STATUSES),
            )
        )
        n, rev = q.one()
        return int(n), int(rev)

    orders_30d, revenue_30d = _bucket_total(cutoff_30, now)
    orders_prev, revenue_prev = _bucket_total(cutoff_60, cutoff_30)

    completed = db.query(func.count(Order.id)).filter(Order.status == "completed").scalar() or 0
    failed = (
        db.query(func.count(Order.id))
        .filter(Order.status == "failed", Order.created_at >= cutoff_30)
        .scalar()
        or 0
    )
    refunded = (
        db.query(func.count(Order.id))
        .filter(Order.status == "refunded", Order.created_at >= cutoff_30)
        .scalar()
        or 0
    )

    # Top destinations by order count + revenue.
    top_query = (
        db.query(
            Plan.country,
            func.count(Order.id),
            func.coalesce(func.sum(Order.amount_cents), 0),
        )
        .join(Plan, Plan.id == Order.plan_id)
        .filter(Order.created_at >= cutoff_30, Order.status.in_(_REVENUE_STATUSES))
        .group_by(Plan.country)
        .order_by(func.count(Order.id).desc())
        .limit(8)
    )
    top_destinations = []
    for code, n, rev in top_query.all():
        name, flag = _COUNTRY_META.get(code, (code, "🌐"))
        top_destinations.append(
            {"code": code, "name": name, "flag": flag, "orders": int(n), "revenue_cents": int(rev)}
        )

    # Queue: failed orders awaiting human review (last 30d, not yet refunded).
    queue_orders = (
        db.query(Order)
        .filter(
            Order.status == "failed",
            Order.created_at >= cutoff_30,
            Order.stripe_refund_id.is_(None),
        )
        .order_by(Order.created_at.desc())
        .limit(8)
        .all()
    )
    queue = [
        {
            "type": "failed",
            "title": f"Failed activation · {o.reference}",
            "sub": (o.error_message or "Unknown error")[:140],
            "reference": o.reference,
        }
        for o in queue_orders
    ]

    return AdminKpiResponse(
        revenue_cents_30d=revenue_30d,
        revenue_cents_prev=revenue_prev,
        orders_30d=orders_30d,
        orders_prev=orders_prev,
        completed_esims=int(completed),
        failed_orders=int(failed),
        refunded_orders=int(refunded),
        top_destinations=top_destinations,
        queue=queue,
    )


@router.get("/analytics/revenue-series")
def admin_revenue_series(
    days: int = Query(default=30, ge=7, le=365),
    db: Session = Depends(get_db),
    _admin: User = Depends(get_admin_user),
) -> list[dict]:
    """Daily revenue buckets for the last N days, oldest first."""
    now = datetime.now(timezone.utc)
    start = (now - timedelta(days=days)).replace(hour=0, minute=0, second=0, microsecond=0)

    rows = (
        db.query(
            func.date_trunc("day", Order.created_at).label("day"),
            func.count(Order.id),
            func.coalesce(func.sum(Order.amount_cents), 0),
        )
        .filter(Order.created_at >= start, Order.status.in_(_REVENUE_STATUSES))
        .group_by("day")
        .order_by("day")
        .all()
    )
    by_day = {row[0].date().isoformat(): (int(row[1]), int(row[2])) for row in rows}

    out = []
    for i in range(days):
        d = (start + timedelta(days=i)).date().isoformat()
        n, rev = by_day.get(d, (0, 0))
        out.append({"date": d, "orders": n, "revenue_cents": rev})
    return out
