"""Pydantic schemas for request/response validation."""

from datetime import datetime

from pydantic import BaseModel, EmailStr


# --- Plans ---


class PlanResponse(BaseModel):
    id: str
    name: str
    country: str
    region: str
    data_gb: int
    validity_days: int
    price_cents: int
    currency: str

    model_config = {"from_attributes": True}


# --- Checkout ---


class CheckoutRequest(BaseModel):
    plan_id: str
    email: EmailStr


class CheckoutResponse(BaseModel):
    checkout_url: str
    order_reference: str


# --- Order Status ---


class OrderStatusResponse(BaseModel):
    reference: str
    status: str
    plan_id: str
    email: str
    created_at: datetime
    qr_code_url: str | None = None

    model_config = {"from_attributes": True}
