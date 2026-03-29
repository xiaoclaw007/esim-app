"""Auth endpoints — signup, login, refresh, logout, Google OAuth."""

import logging
import secrets
from datetime import datetime, timedelta, timezone
from hashlib import sha256
from typing import Optional

from fastapi import APIRouter, Cookie, Depends, HTTPException, Response, status
from fastapi.responses import RedirectResponse
from sqlalchemy.orm import Session

from app.config import settings
from app.database import get_db
from app.models import RefreshToken, User
from app.schemas import AuthResponse, LoginRequest, SignupRequest, UserResponse
from app.services.auth_service import (
    create_access_token,
    create_refresh_token,
    hash_password,
    verify_password,
)
from app.services.google_oauth import (
    exchange_code_for_tokens,
    get_google_auth_url,
    get_google_user_info,
)

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/auth", tags=["auth"])


def _set_refresh_cookie(response: Response, raw_token: str) -> None:
    """Set the refresh token as an HttpOnly secure cookie."""
    response.set_cookie(
        key="refresh_token",
        value=raw_token,
        httponly=True,
        secure=settings.app_env != "development",
        samesite="lax",
        max_age=settings.jwt_refresh_token_expire_days * 86400,
        path="/api/auth",
    )


def _store_refresh_token(db: Session, user_id: str, token_hash: str) -> None:
    """Persist a hashed refresh token in the database."""
    rt = RefreshToken(
        user_id=user_id,
        token_hash=token_hash,
        expires_at=datetime.now(timezone.utc)
        + timedelta(days=settings.jwt_refresh_token_expire_days),
    )
    db.add(rt)
    db.commit()


@router.post("/signup", response_model=AuthResponse)
def signup(request: SignupRequest, response: Response, db: Session = Depends(get_db)):
    """Register a new user with email and password.

    Returns access token in body and sets refresh token as HttpOnly cookie.
    """
    # Check if email already taken
    existing = db.query(User).filter(User.email == request.email).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Email already registered",
        )

    user = User(
        email=request.email,
        name=request.name,
        password_hash=hash_password(request.password),
        referred_by=request.referral_code,
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    # Generate tokens
    access_token = create_access_token(user.id)
    raw_refresh, token_hash = create_refresh_token()
    _store_refresh_token(db, user.id, token_hash)
    _set_refresh_cookie(response, raw_refresh)

    return AuthResponse(
        access_token=access_token,
        user=UserResponse.model_validate(user),
    )


@router.post("/login", response_model=AuthResponse)
def login(request: LoginRequest, response: Response, db: Session = Depends(get_db)):
    """Authenticate with email and password.

    Returns access token in body and sets refresh token as HttpOnly cookie.
    """
    user = db.query(User).filter(User.email == request.email, User.is_active == True).first()
    if not user or not user.password_hash or not verify_password(request.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
        )

    access_token = create_access_token(user.id)
    raw_refresh, token_hash = create_refresh_token()
    _store_refresh_token(db, user.id, token_hash)
    _set_refresh_cookie(response, raw_refresh)

    return AuthResponse(
        access_token=access_token,
        user=UserResponse.model_validate(user),
    )


@router.post("/refresh")
def refresh(
    response: Response,
    refresh_token: Optional[str] = Cookie(None),
    db: Session = Depends(get_db),
):
    """Exchange a valid refresh token (from cookie) for a new access token."""
    if not refresh_token:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="No refresh token")

    token_hash = sha256(refresh_token.encode()).hexdigest()
    rt = (
        db.query(RefreshToken)
        .filter(
            RefreshToken.token_hash == token_hash,
            RefreshToken.revoked == False,
            RefreshToken.expires_at > datetime.now(timezone.utc),
        )
        .first()
    )
    if not rt:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid refresh token")

    # Rotate: revoke old, issue new
    rt.revoked = True
    db.commit()

    user = db.query(User).filter(User.id == rt.user_id, User.is_active == True).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found")

    access_token = create_access_token(user.id)
    raw_refresh, new_hash = create_refresh_token()
    _store_refresh_token(db, user.id, new_hash)
    _set_refresh_cookie(response, raw_refresh)

    return {"access_token": access_token, "token_type": "bearer"}


@router.post("/logout")
def logout(
    response: Response,
    refresh_token: Optional[str] = Cookie(None),
    db: Session = Depends(get_db),
):
    """Revoke the refresh token and clear the cookie."""
    if refresh_token:
        token_hash = sha256(refresh_token.encode()).hexdigest()
        rt = db.query(RefreshToken).filter(RefreshToken.token_hash == token_hash).first()
        if rt:
            rt.revoked = True
            db.commit()

    response.delete_cookie("refresh_token", path="/api/auth")
    return {"detail": "Logged out"}


@router.get("/google")
def google_login():
    """Redirect to Google OAuth consent screen."""
    if not settings.google_client_id:
        raise HTTPException(status_code=501, detail="Google OAuth not configured")

    state = secrets.token_urlsafe(32)
    url = get_google_auth_url(state)
    return RedirectResponse(url=url)


@router.get("/google/callback")
async def google_callback(code: str, state: str = "", db: Session = Depends(get_db)):
    """Handle Google OAuth callback — create or find user, issue tokens, redirect to frontend."""
    if not settings.google_client_id:
        raise HTTPException(status_code=501, detail="Google OAuth not configured")

    try:
        tokens = await exchange_code_for_tokens(code)
        google_user = await get_google_user_info(tokens["access_token"])
    except Exception as e:
        logger.error(f"Google OAuth error: {e}")
        raise HTTPException(status_code=400, detail="Failed to authenticate with Google")

    google_id = google_user.get("id")
    email = google_user.get("email")
    name = google_user.get("name")
    avatar = google_user.get("picture")

    if not email:
        raise HTTPException(status_code=400, detail="Google account has no email")

    # Find by google_id first, then by email
    user = db.query(User).filter(User.google_id == google_id).first()
    if not user:
        user = db.query(User).filter(User.email == email).first()
        if user:
            # Link existing account to Google
            user.google_id = google_id
            if not user.avatar_url and avatar:
                user.avatar_url = avatar
        else:
            # New user via Google
            user = User(
                email=email,
                name=name,
                google_id=google_id,
                avatar_url=avatar,
            )
            db.add(user)

    db.commit()
    db.refresh(user)

    access_token = create_access_token(user.id)
    raw_refresh, token_hash = create_refresh_token()
    _store_refresh_token(db, user.id, token_hash)

    # Redirect to frontend with tokens
    redirect_url = f"{settings.frontend_url}/auth/callback?access_token={access_token}"
    resp = RedirectResponse(url=redirect_url)
    _set_refresh_cookie(resp, raw_refresh)
    return resp
