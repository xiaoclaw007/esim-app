"""SQLAlchemy database models."""

from __future__ import annotations

import secrets
import string
import uuid
from datetime import datetime, timezone
from typing import Optional, List

from sqlalchemy import JSON, Boolean, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


# Postgres-native JSONB in prod; falls back to JSON on SQLite for local dev.
JsonCol = JSONB().with_variant(JSON(), "sqlite")


def generate_uuid() -> str:
    return str(uuid.uuid4())


def generate_reference() -> str:
    """Generate a short human-readable order reference like ESIM-A3X9K2."""
    short = uuid.uuid4().hex[:6].upper()
    return f"ESIM-{short}"


def generate_referral_code() -> str:
    """Generate a referral code like REF-X7K9M2P3 (10 chars total)."""
    chars = string.ascii_uppercase + string.digits
    code = "".join(secrets.choice(chars) for _ in range(6))
    return f"REF-{code}"


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


class User(Base):
    __tablename__ = "users"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=generate_uuid)
    email: Mapped[str] = mapped_column(String(255), unique=True, nullable=False, index=True)
    name: Mapped[Optional[str]] = mapped_column(String(200))
    password_hash: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    google_id: Mapped[Optional[str]] = mapped_column(String(255), unique=True, nullable=True)
    avatar_url: Mapped[Optional[str]] = mapped_column(String(500))
    referral_code: Mapped[str] = mapped_column(
        String(10), unique=True, default=generate_referral_code
    )
    referred_by: Mapped[Optional[str]] = mapped_column(String(10), nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    # Founder/operator flag — gates the /api/admin/* endpoints + /admin SPA
    # route. Set manually via SQL UPDATE; no UI to grant for now.
    is_admin: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utcnow, onupdate=utcnow
    )

    # Relationships
    orders: Mapped[List[Order]] = relationship("Order", back_populates="user")
    refresh_tokens: Mapped[List[RefreshToken]] = relationship(
        "RefreshToken", back_populates="user"
    )


class RefreshToken(Base):
    __tablename__ = "refresh_tokens"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=generate_uuid)
    user_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("users.id"), nullable=False, index=True
    )
    token_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    revoked: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    # Relationships
    user: Mapped[User] = relationship("User", back_populates="refresh_tokens")


class Order(Base):
    __tablename__ = "orders"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=generate_uuid)
    reference: Mapped[str] = mapped_column(String(12), unique=True, default=generate_reference)
    email: Mapped[str] = mapped_column(String(255), nullable=False)
    plan_id: Mapped[str] = mapped_column(String(50), nullable=False)

    # User (nullable — M1 guest orders have no user)
    user_id: Mapped[Optional[str]] = mapped_column(
        String(36), ForeignKey("users.id"), nullable=True, index=True
    )

    # Stripe
    stripe_session_id: Mapped[Optional[str]] = mapped_column(String(255))
    stripe_payment_intent: Mapped[Optional[str]] = mapped_column(String(255))
    amount_cents: Mapped[int] = mapped_column(Integer, nullable=False)
    currency: Mapped[str] = mapped_column(String(3), default="usd")

    # Order status: created → paid → joytel_pending → snpin_received → completed
    # Terminal bad states: failed (no refund — requires human) | refunded (money returned)
    status: Mapped[str] = mapped_column(String(20), default="created")

    # JoyTel
    joytel_order_id: Mapped[Optional[str]] = mapped_column(String(255))
    sn_pin: Mapped[Optional[str]] = mapped_column(String(255))
    qr_code_data: Mapped[Optional[str]] = mapped_column(Text)
    qr_code_url: Mapped[Optional[str]] = mapped_column(String(500))

    # Stripe refund tracking (set when JoyTel rejects a paid order and we
    # automatically reverse the Stripe charge).
    stripe_refund_id: Mapped[Optional[str]] = mapped_column(String(255))

    # Coupon redemption: id is the live FK; code is the frozen value at the
    # time of order so historical orders survive coupon deletion. discount_cents
    # is the amount subtracted from the plan price. amount_cents on the Order
    # row is the final charged amount (post-discount).
    coupon_id: Mapped[Optional[str]] = mapped_column(
        String(36), ForeignKey("coupons.id"), nullable=True
    )
    coupon_code: Mapped[Optional[str]] = mapped_column(String(40), nullable=True)
    discount_cents: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    # Error tracking
    error_message: Mapped[Optional[str]] = mapped_column(Text)

    # Timestamps
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utcnow, onupdate=utcnow
    )

    # Relationships
    user: Mapped[Optional[User]] = relationship("User", back_populates="orders")


class Coupon(Base):
    __tablename__ = "coupons"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=generate_uuid)
    # Stored canonical-uppercase. Frontend uppercases on submit; lookup is case-insensitive.
    code: Mapped[str] = mapped_column(String(40), unique=True, nullable=False, index=True)
    # "percent" → value is 1-100. "fixed" → value is cents off.
    kind: Mapped[str] = mapped_column(String(10), nullable=False)
    value: Mapped[int] = mapped_column(Integer, nullable=False)
    # Optional global usage cap. Null = unlimited.
    max_uses: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    uses: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    # Optional date window. Null bounds = open-ended.
    valid_from: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    valid_until: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_by: Mapped[Optional[str]] = mapped_column(
        String(36), ForeignKey("users.id"), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utcnow, onupdate=utcnow
    )


class Event(Base):
    """Single-table analytics. Every interesting customer action — page views,
    destination views, plan clicks, checkout starts, payment outcomes — lands
    here as one row. The admin /analytics page slices/dices via SQL.

    The frontend POSTs to /api/track with type + optional metadata; the
    backend enriches with IP→country (GeoIP) and UA→device, then inserts.
    """

    __tablename__ = "events"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=generate_uuid)
    # Free-form short string ("page_view", "checkout_started"). Not enum'd
    # so we can ship a new event with just a frontend ping + a chart query.
    type: Mapped[str] = mapped_column(String(40), nullable=False)
    # Frontend-issued opaque id stored in sessionStorage. Lets us count
    # unique visitors and walk a single session through the funnel without
    # requiring login.
    session_id: Mapped[Optional[str]] = mapped_column(String(64), nullable=True, index=True)
    user_id: Mapped[Optional[str]] = mapped_column(
        String(36), ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True
    )
    path: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    referrer: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    # ISO-2 country code derived from request IP via GeoLite2.
    country: Mapped[Optional[str]] = mapped_column(String(2), nullable=True)
    # "mobile" | "tablet" | "desktop" — derived from User-Agent, never stored
    # raw on read paths.
    device: Mapped[Optional[str]] = mapped_column(String(10), nullable=True)
    user_agent: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    # Per-event payload (plan_id on a destination_view, decline_code on a
    # payment_failed, etc.). Column named event_metadata because SQLAlchemy
    # reserves "metadata" on its declarative base.
    event_metadata: Mapped[Optional[dict]] = mapped_column(JsonCol, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class Plan(Base):
    __tablename__ = "plans"

    id: Mapped[str] = mapped_column(String(50), primary_key=True)
    joytel_sku: Mapped[str] = mapped_column(String(100), nullable=False)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    # ISO-2 for country plans ("US", "JP"); bespoke codes for regional ("EU",
    # "AP", "CHM"). Widened from 2 chars once multi-country SKUs landed.
    country: Mapped[str] = mapped_column(String(10), nullable=False)
    region: Mapped[str] = mapped_column(String(50), nullable=False)
    # "country" or "regional" — lets the frontend split the single-country
    # grid from the regional banner without sniffing country codes.
    plan_type: Mapped[str] = mapped_column(String(20), default="country")
    data_gb: Mapped[int] = mapped_column(Integer, nullable=False)  # 999 = unlimited
    validity_days: Mapped[int] = mapped_column(Integer, nullable=False)
    price_cents: Mapped[int] = mapped_column(Integer, nullable=False)
    currency: Mapped[str] = mapped_column(String(3), default="usd")
    active: Mapped[bool] = mapped_column(Boolean, default=True)
