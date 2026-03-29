"""Authentication service — JWT tokens, password hashing, referral codes."""

import secrets
import string
from datetime import datetime, timedelta, timezone
from hashlib import sha256

from jose import JWTError, jwt
from passlib.context import CryptContext

from app.config import settings

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

ALGORITHM = "HS256"


def hash_password(password: str) -> str:
    """Hash a plaintext password using bcrypt.

    Bcrypt has a 72-byte limit — we truncate to be safe.
    """
    return pwd_context.hash(password[:72])


def verify_password(plain: str, hashed: str) -> bool:
    """Verify a plaintext password against a bcrypt hash."""
    return pwd_context.verify(plain[:72], hashed)


def create_access_token(user_id: str) -> str:
    """Create a JWT access token with configurable expiry."""
    expire = datetime.now(timezone.utc) + timedelta(
        minutes=settings.jwt_access_token_expire_minutes
    )
    payload = {"sub": user_id, "exp": expire, "type": "access"}
    return jwt.encode(payload, settings.jwt_secret_key, algorithm=ALGORITHM)


def create_refresh_token() -> tuple[str, str]:
    """Generate a refresh token. Returns (raw_token, token_hash).

    The raw token is sent to the client; the hash is stored in the DB.
    """
    raw_token = secrets.token_urlsafe(48)
    token_hash = sha256(raw_token.encode()).hexdigest()
    return raw_token, token_hash


def decode_access_token(token: str) -> dict:
    """Decode and validate a JWT access token. Raises JWTError on failure."""
    payload = jwt.decode(token, settings.jwt_secret_key, algorithms=[ALGORITHM])
    if payload.get("type") != "access":
        raise JWTError("Invalid token type")
    return payload


def generate_referral_code() -> str:
    """Generate a referral code like REF-X7K9M2P3 (10 chars total)."""
    chars = string.ascii_uppercase + string.digits
    code = "".join(secrets.choice(chars) for _ in range(6))
    return f"REF-{code}"
