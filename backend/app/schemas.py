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
    data_gb: int
    validity_days: int
    price_cents: int
    currency: str

    model_config = {"from_attributes": True}


# --- Checkout ---


class CheckoutRequest(BaseModel):
    plan_id: str
    email: Optional[EmailStr] = None  # Optional if user is authenticated


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
    qr_code_url: Optional[str] = None

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
    created_at: datetime

    model_config = {"from_attributes": True}


class AuthResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserResponse


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

    model_config = {"from_attributes": True}


class OrderListResponse(BaseModel):
    orders: List[OrderDetailResponse]
    total: int
    page: int
    per_page: int
