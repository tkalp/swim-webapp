"""Authentication service — handles login, signup, token management."""
import hashlib
import os
import secrets
import smtplib
from datetime import datetime, timedelta, timezone
from email.message import EmailMessage

from jose import jwt
from passlib.context import CryptContext
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.infrastructure.models import User, RefreshToken
from app.domain.exceptions import UnauthorizedError, ValidationError, ConflictError
from app.utils import logger

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

JWT_SECRET = os.getenv("JWT_SECRET", "dev-secret-change-me")
JWT_REFRESH_SECRET = os.getenv("JWT_REFRESH_SECRET", "dev-refresh-secret-change-me")
JWT_ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 15
REFRESH_TOKEN_EXPIRE_DAYS = 7


def _hash_password(password: str) -> str:
    # bcrypt has a 72-byte limit on input passwords
    return pwd_context.hash(password[:72])


def _verify_password(plain: str, hashed: str) -> bool:
    try:
        return pwd_context.verify(plain[:72], hashed)
    except Exception:
        return False


def _create_access_token(user: User) -> str:
    now = datetime.now(timezone.utc)
    payload = {
        "sub": str(user.id),
        "email": user.email,
        "iat": now,
        "exp": now + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES),
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


def _create_refresh_token_value() -> str:
    return secrets.token_urlsafe(48)


def _hash_token(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()


async def signup(
    db: AsyncSession,
    email: str,
    password: str,
    full_name: str | None = None,
) -> dict:
    """Create a new user account and return tokens."""
    # Check for existing user
    result = await db.execute(select(User).where(User.email == email))
    if result.scalar_one_or_none():
        raise ConflictError("An account with this email already exists")

    user = User(
        email=email.lower().strip(),
        password_hash=_hash_password(password),
        full_name=full_name,
        email_confirmed=False,
    )
    db.add(user)
    await db.flush()

    access_token = _create_access_token(user)
    refresh_value = _create_refresh_token_value()

    refresh_record = RefreshToken(
        user_id=user.id,
        token_hash=_hash_token(refresh_value),
        expires_at=datetime.now(timezone.utc) + timedelta(days=REFRESH_TOKEN_EXPIRE_DAYS),
    )
    db.add(refresh_record)
    await db.commit()

    return {
        "access_token": access_token,
        "refresh_token": refresh_value,
        "token_type": "bearer",
        "expires_in": ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        "user": {
            "id": str(user.id),
            "email": user.email,
            "full_name": user.full_name,
        },
    }


async def login(db: AsyncSession, email: str, password: str) -> dict:
    """Authenticate user and return tokens."""
    result = await db.execute(select(User).where(User.email == email.lower().strip()))
    user = result.scalar_one_or_none()

    if not user or not _verify_password(password, user.password_hash):
        raise UnauthorizedError("Invalid email or password")

    access_token = _create_access_token(user)
    refresh_value = _create_refresh_token_value()

    refresh_record = RefreshToken(
        user_id=user.id,
        token_hash=_hash_token(refresh_value),
        expires_at=datetime.now(timezone.utc) + timedelta(days=REFRESH_TOKEN_EXPIRE_DAYS),
    )
    db.add(refresh_record)
    await db.commit()

    return {
        "access_token": access_token,
        "refresh_token": refresh_value,
        "token_type": "bearer",
        "expires_in": ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        "user": {
            "id": str(user.id),
            "email": user.email,
            "full_name": user.full_name,
        },
    }


async def refresh_tokens(db: AsyncSession, refresh_token: str) -> dict:
    """Exchange a refresh token for new access + refresh tokens."""
    token_hash = _hash_token(refresh_token)

    result = await db.execute(
        select(RefreshToken)
        .where(RefreshToken.token_hash == token_hash)
        .where(RefreshToken.revoked == False)
        .where(RefreshToken.expires_at > datetime.now(timezone.utc))
    )
    record = result.scalar_one_or_none()

    if not record:
        raise UnauthorizedError("Invalid or expired refresh token")

    # Revoke old token
    record.revoked = True

    # Load user
    user_result = await db.execute(select(User).where(User.id == record.user_id))
    user = user_result.scalar_one_or_none()
    if not user:
        raise UnauthorizedError("User not found")

    # Issue new tokens
    access_token = _create_access_token(user)
    new_refresh_value = _create_refresh_token_value()

    new_refresh = RefreshToken(
        user_id=user.id,
        token_hash=_hash_token(new_refresh_value),
        expires_at=datetime.now(timezone.utc) + timedelta(days=REFRESH_TOKEN_EXPIRE_DAYS),
    )
    db.add(new_refresh)
    await db.commit()

    return {
        "access_token": access_token,
        "refresh_token": new_refresh_value,
        "token_type": "bearer",
        "expires_in": ACCESS_TOKEN_EXPIRE_MINUTES * 60,
    }


async def logout(db: AsyncSession, refresh_token: str) -> None:
    """Revoke a refresh token."""
    token_hash = _hash_token(refresh_token)
    result = await db.execute(
        select(RefreshToken).where(RefreshToken.token_hash == token_hash)
    )
    record = result.scalar_one_or_none()
    if record:
        record.revoked = True
        await db.commit()


async def get_user_by_id(db: AsyncSession, user_id: str) -> dict | None:
    """Get user profile by ID."""
    import uuid
    result = await db.execute(select(User).where(User.id == uuid.UUID(user_id)))
    user = result.scalar_one_or_none()
    if not user:
        return None
    return {
        "id": str(user.id),
        "email": user.email,
        "full_name": user.full_name,
        "email_confirmed": user.email_confirmed,
        "created_at": user.created_at.isoformat() if user.created_at else None,
    }


async def forgot_password(db: AsyncSession, email: str) -> None:
    """Generate a password reset token. For now, logs to console."""
    result = await db.execute(select(User).where(User.email == email.lower().strip()))
    user = result.scalar_one_or_none()

    if not user:
        # Don't reveal whether email exists
        return

    # Create a short-lived reset token (1 hour)
    now = datetime.now(timezone.utc)
    reset_payload = {
        "sub": str(user.id),
        "purpose": "password_reset",
        "iat": now,
        "exp": now + timedelta(hours=1),
    }
    reset_token = jwt.encode(reset_payload, JWT_SECRET, algorithm=JWT_ALGORITHM)

    frontend_url = os.getenv("FRONTEND_URL", "http://localhost:5173")
    reset_link = f"{frontend_url}/reset-password?token={reset_token}"

    smtp_host = os.getenv("SMTP_HOST")
    if smtp_host:
        msg = EmailMessage()
        msg["Subject"] = "Password Reset - Aquilus"
        msg["From"] = os.getenv("SMTP_FROM", "noreply@aquilus.app")
        msg["To"] = user.email
        msg.set_content(
            f"Click this link to reset your password:\n\n{reset_link}\n\n"
            f"This link expires in 1 hour."
        )
        with smtplib.SMTP(smtp_host, int(os.getenv("SMTP_PORT", "587"))) as server:
            server.starttls()
            server.login(os.getenv("SMTP_USER", ""), os.getenv("SMTP_PASS", ""))
            server.send_message(msg)
        logger.info(f"Password reset email sent to {user.email}")
    else:
        # Dev fallback — log prominently; no SMTP configured
        logger.warning(f"SMTP not configured. Password reset link (dev only): {reset_link}")


async def reset_password(db: AsyncSession, token: str, new_password: str) -> None:
    """Reset password using a valid reset token."""
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
    except Exception:
        raise UnauthorizedError("Invalid or expired reset token")

    if payload.get("purpose") != "password_reset":
        raise UnauthorizedError("Invalid reset token")

    import uuid
    user_id = uuid.UUID(payload["sub"])
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()

    if not user:
        raise UnauthorizedError("User not found")

    user.password_hash = _hash_password(new_password)

    # Revoke all existing refresh tokens for this user
    await db.execute(
        update(RefreshToken)
        .where(RefreshToken.user_id == user.id)
        .values(revoked=True)
    )

    await db.commit()
