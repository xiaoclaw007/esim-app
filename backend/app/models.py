"""SQLAlchemy database models."""

import uuid
from datetime import datetime, timezone

from sqlalchemy import Boolean, DateTime, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


def generate_uuid() -> str:
    return str(uuid.uuid4())


def generate_reference() -> str:
    """Generate a short human-readable order reference like ESIM-A3X9K2."""
    short = uuid.uuid4().hex[:6].upper()
    return f"ESIM-{short}"


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


class Order(Base):
    __tablename__ = "orders"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=generate_uuid)
    reference: Mapped[str] = mapped_column(String(12), unique=True, default=generate_reference)
    email: Mapped[str] = mapped_column(String(255), nullable=False)
    plan_id: Mapped[str] = mapped_column(String(50), nullable=False)

    # Stripe
    stripe_session_id: Mapped[str | None] = mapped_column(String(255))
    stripe_payment_intent: Mapped[str | None] = mapped_column(String(255))
    amount_cents: Mapped[int] = mapped_column(Integer, nullable=False)
    currency: Mapped[str] = mapped_column(String(3), default="usd")

    # Order status: created → paid → joytel_pending → snpin_received → completed | failed
    status: Mapped[str] = mapped_column(String(20), default="created")

    # JoyTel
    joytel_order_id: Mapped[str | None] = mapped_column(String(255))
    sn_pin: Mapped[str | None] = mapped_column(String(255))
    qr_code_data: Mapped[str | None] = mapped_column(Text)
    qr_code_url: Mapped[str | None] = mapped_column(String(500))

    # Error tracking
    error_message: Mapped[str | None] = mapped_column(Text)

    # Timestamps
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)


class Plan(Base):
    __tablename__ = "plans"

    id: Mapped[str] = mapped_column(String(50), primary_key=True)
    joytel_sku: Mapped[str] = mapped_column(String(100), nullable=False)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    country: Mapped[str] = mapped_column(String(2), nullable=False)  # ISO country code
    region: Mapped[str] = mapped_column(String(50), nullable=False)
    data_gb: Mapped[int] = mapped_column(Integer, nullable=False)  # in MB for precision
    validity_days: Mapped[int] = mapped_column(Integer, nullable=False)
    price_cents: Mapped[int] = mapped_column(Integer, nullable=False)
    currency: Mapped[str] = mapped_column(String(3), default="usd")
    active: Mapped[bool] = mapped_column(Boolean, default=True)
