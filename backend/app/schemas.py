"""Pydantic schemas for request/response validation."""

from __future__ import annotations

from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel, EmailStr, Field


# --- Plans ---


class PlanResponse(BaseModel):
    id: str
    name: str
    country: str
    region: str
    plan_type: str
    data_gb: int
    validity_days: int
    price_cents: int
    currency: str

    model_config = {"from_attributes": True}


# --- Checkout ---


class CheckoutRequest(BaseModel):
    plan_id: str
    email: Optional[EmailStr] = None  # Optional if user is authenticated
    coupon_code: Optional[str] = None
    # Cents of Nimvoy Credit to apply, capped server-side at the post-
    # coupon amount and the user's available balance. Ignored for guests
    # (anonymous users have no balance). Default 0 = pay everything via
    # Stripe regardless of any balance.
    credit_cents_to_apply: int = 0


class CouponValidateRequest(BaseModel):
    code: str
    plan_id: str


class CouponValidateResponse(BaseModel):
    valid: bool
    code: Optional[str] = None
    discount_cents: int = 0
    final_cents: int = 0
    free: bool = False
    error: Optional[str] = None


class CheckoutResponse(BaseModel):
    checkout_url: str
    order_reference: str


class PaymentIntentResponse(BaseModel):
    """Returned when the order requires Stripe payment.

    For 100%-off coupons we skip Stripe and return FreeOrderResponse instead;
    the frontend looks at `free` to choose between the two flows.
    """

    client_secret: str
    order_reference: str
    amount_cents: int
    currency: str
    discount_cents: int = 0
    credit_applied_cents: int = 0
    coupon_code: Optional[str] = None
    free: bool = False  # always false for this response — present so the
    # union type the frontend handles is uniform


class FreeOrderResponse(BaseModel):
    """Returned when a 100%-off coupon makes the order $0 — Stripe is bypassed,
    the order is created paid, and JoyTel fulfillment kicks off immediately."""

    order_reference: str
    amount_cents: int = 0
    currency: str = "usd"
    discount_cents: int
    coupon_code: str
    free: bool = True
    client_secret: Optional[str] = None  # always null; same union shape as above


class CheckoutConfigResponse(BaseModel):
    publishable_key: str


# --- Order Status ---


class OrderStatusResponse(BaseModel):
    reference: str
    status: str
    plan_id: str
    email: str
    amount_cents: int
    currency: str
    created_at: datetime
    qr_code_url: Optional[str] = None
    # LPA activation string (from JoyTel when qrcode_type=1). Frontend uses
    # this with a QR library to render a scannable image for the user.
    qr_code_data: Optional[str] = None
    error_message: Optional[str] = None

    model_config = {"from_attributes": True}


# --- Auth ---


class SignupRequest(BaseModel):
    email: EmailStr
    name: str = Field(..., min_length=1, max_length=200)
    password: str = Field(..., min_length=8, max_length=128)
    referral_code: Optional[str] = None


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class UserResponse(BaseModel):
    id: str
    email: str
    name: Optional[str] = None
    avatar_url: Optional[str] = None
    referral_code: str
    is_admin: bool = False
    created_at: datetime
    # Booleans (not the underlying values) so we can show "Add password"
    # / "Connect Google" CTAs without exposing the hash or Google ID.
    has_password: bool = False
    has_google: bool = False

    model_config = {"from_attributes": True}

    @classmethod
    def from_user(cls, user) -> "UserResponse":
        """Build from a User ORM row, deriving has_password / has_google."""
        return cls(
            id=user.id,
            email=user.email,
            name=user.name,
            avatar_url=user.avatar_url,
            referral_code=user.referral_code,
            is_admin=user.is_admin,
            created_at=user.created_at,
            has_password=bool(user.password_hash),
            has_google=bool(user.google_id),
        )


class AuthResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    # True if the user has any orders attached. Drives where the
    # frontend lands them post-auth: with orders → /account; without
    # orders → /destinations?welcome=1 to keep purchase momentum.
    has_orders: bool = False
    user: UserResponse


class MagicLinkRequest(BaseModel):
    email: EmailStr


class UserUpdateRequest(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=200)


# --- Orders (authenticated) ---


class OrderDetailResponse(BaseModel):
    reference: str
    status: str
    plan_id: str
    email: str
    amount_cents: int
    currency: str
    created_at: datetime
    updated_at: datetime
    qr_code_url: Optional[str] = None
    qr_code_data: Optional[str] = None
    stripe_refund_id: Optional[str] = None

    model_config = {"from_attributes": True}


class OrderListResponse(BaseModel):
    orders: List[OrderDetailResponse]
    total: int
    page: int
    per_page: int


class OrderUsageResponse(BaseModel):
    """Live usage for a delivered eSIM, queried from JoyTel on demand.

    All quantities are in megabytes (1024-based). Fields are nullable
    because JoyTel may not return every value, especially on freshly
    activated eSIMs that haven't connected to a network yet.
    """
    used_mb: Optional[int] = None
    total_mb: Optional[int] = None
    left_mb: Optional[int] = None
    percent: Optional[float] = None  # 0..100, one decimal
    expires_at: Optional[str] = None  # ISO-ish; carrier formats vary
    state: str  # 'unused' | 'active' | 'expired' | 'depleted' | 'unknown'

    # Install lifecycle signals — sourced from two places:
    # 1. JoyTel's eSIM Status Query (live poll) — works without any
    #    customer-side configuration.
    # 2. Our esim_install_events feed (push) — only flows once JoyTel
    #    enables the install-event callback.
    # Either one is sufficient to render an accurate badge; the
    # frontend prefers (2) when present, falls back to (1).
    esim_status: Optional[str] = None  # 'unknown' | 'activated' | 'expired' | null on fetch failure
    installed_at: Optional[str] = None  # ISO datetime if we've seen the install event
    enabled_at: Optional[str] = None    # ISO datetime if we've seen the enable event
