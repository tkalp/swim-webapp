"""Tests for auth service — password reset behaviour (bugs #8 and #9)."""
import hashlib
import secrets
import pytest
from datetime import datetime, timedelta, timezone
from unittest.mock import patch, MagicMock

from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.infrastructure.models import User, RefreshToken
from app.services import auth_service


# ──────────────────────────────────────────────────────────────────────────────
# Bug #9: reset_password() must revoke all refresh tokens for the user
# ──────────────────────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_password_reset_revokes_refresh_tokens(seeded_db):
    """After password reset, all refresh tokens for that user should be revoked."""
    from tests.seed import USER_A_ID

    # Create two active refresh tokens for User A
    raw_token_1 = secrets.token_urlsafe(48)
    raw_token_2 = secrets.token_urlsafe(48)

    def _hash(t: str) -> str:
        return hashlib.sha256(t.encode()).hexdigest()

    expiry = datetime.now(timezone.utc) + timedelta(days=7)
    seeded_db.add(RefreshToken(
        user_id=USER_A_ID,
        token_hash=_hash(raw_token_1),
        expires_at=expiry,
        revoked=False,
    ))
    seeded_db.add(RefreshToken(
        user_id=USER_A_ID,
        token_hash=_hash(raw_token_2),
        expires_at=expiry,
        revoked=False,
    ))
    await seeded_db.flush()

    # Confirm both tokens are active before the reset
    result = await seeded_db.execute(
        select(RefreshToken).where(
            RefreshToken.user_id == USER_A_ID,
            RefreshToken.revoked == False,  # noqa: E712
        )
    )
    active_before = result.scalars().all()
    assert len(active_before) >= 2

    # Generate a real password-reset JWT for User A and call reset_password()
    # We need a superuser session (not app_user role) to allow commits, so we
    # call the DB-level operation directly without going through the HTTP layer.
    from jose import jwt as jose_jwt

    now = datetime.now(timezone.utc)
    reset_payload = {
        "sub": str(USER_A_ID),
        "purpose": "password_reset",
        "iat": now,
        "exp": now + timedelta(hours=1),
    }
    reset_token = jose_jwt.encode(
        reset_payload,
        auth_service.JWT_RESET_SECRET,
        algorithm=auth_service.JWT_ALGORITHM,
    )

    # Temporarily switch back to superuser role so the UPDATE can succeed
    # (seeded_db runs as app_user which may have RLS restrictions on refresh_tokens)
    from sqlalchemy import text
    await seeded_db.execute(text("RESET ROLE"))

    await auth_service.reset_password(seeded_db, reset_token, "NewPassword123!")

    # Verify all refresh tokens for User A are now revoked
    result = await seeded_db.execute(
        select(RefreshToken).where(
            RefreshToken.user_id == USER_A_ID,
            RefreshToken.revoked == False,  # noqa: E712
        )
    )
    active_after = result.scalars().all()
    assert len(active_after) == 0, (
        f"Expected 0 active refresh tokens after password reset, got {len(active_after)}"
    )


@pytest.mark.asyncio
async def test_password_reset_updates_password_hash(seeded_db):
    """reset_password() must actually update the stored password hash."""
    from tests.seed import USER_A_ID
    from sqlalchemy import text

    # Switch back to superuser so we can read & write freely
    await seeded_db.execute(text("RESET ROLE"))

    # Get original hash
    result = await seeded_db.execute(select(User).where(User.id == USER_A_ID))
    user = result.scalar_one()
    original_hash = user.password_hash

    from jose import jwt as jose_jwt
    now = datetime.now(timezone.utc)
    reset_payload = {
        "sub": str(USER_A_ID),
        "purpose": "password_reset",
        "iat": now,
        "exp": now + timedelta(hours=1),
    }
    reset_token = jose_jwt.encode(
        reset_payload,
        auth_service.JWT_RESET_SECRET,
        algorithm=auth_service.JWT_ALGORITHM,
    )

    await auth_service.reset_password(seeded_db, reset_token, "BrandNewPass456!")

    result = await seeded_db.execute(select(User).where(User.id == USER_A_ID))
    user = result.scalar_one()
    assert user.password_hash != original_hash


@pytest.mark.asyncio
async def test_reset_password_rejects_invalid_token(db):
    """reset_password() must raise UnauthorizedError for a garbage token."""
    from app.domain.exceptions import UnauthorizedError

    with pytest.raises(UnauthorizedError):
        await auth_service.reset_password(db, "not-a-valid-jwt", "SomePass1!")


@pytest.mark.asyncio
async def test_reset_password_rejects_wrong_purpose_token(db):
    """reset_password() must reject a valid JWT that lacks purpose=password_reset."""
    from jose import jwt as jose_jwt
    from app.domain.exceptions import UnauthorizedError

    now = datetime.now(timezone.utc)
    token = jose_jwt.encode(
        {"sub": "some-user-id", "iat": now, "exp": now + timedelta(hours=1)},
        auth_service.JWT_SECRET,
        algorithm=auth_service.JWT_ALGORITHM,
    )
    with pytest.raises(UnauthorizedError):
        await auth_service.reset_password(db, token, "SomePass1!")


# ──────────────────────────────────────────────────────────────────────────────
# Bug #8: forgot_password() must not use print(); must use logger or SMTP
# ──────────────────────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_forgot_password_logs_when_no_smtp(seeded_db, caplog):
    """When SMTP_HOST is not set, forgot_password() logs a warning instead of printing."""
    import logging
    from sqlalchemy import text

    await seeded_db.execute(text("RESET ROLE"))

    with patch.dict("os.environ", {}, clear=False):
        # Ensure SMTP_HOST is not set
        import os
        os.environ.pop("SMTP_HOST", None)

        with caplog.at_level(logging.WARNING, logger="aquilus"):
            await auth_service.forgot_password(seeded_db, "coach_a@test.com")

    assert any(
        "Password reset link" in record.message or "SMTP not configured" in record.message
        for record in caplog.records
    ), f"Expected a warning log about password reset link. Got: {[r.message for r in caplog.records]}"


@pytest.mark.asyncio
async def test_forgot_password_sends_email_when_smtp_configured(seeded_db):
    """When SMTP_HOST is set, forgot_password() uses smtplib to send email."""
    from sqlalchemy import text

    await seeded_db.execute(text("RESET ROLE"))

    smtp_env = {
        "SMTP_HOST": "smtp.example.com",
        "SMTP_PORT": "587",
        "SMTP_FROM": "noreply@aquilus.app",
        "SMTP_USER": "user@example.com",
        "SMTP_PASS": "secret",
    }

    mock_smtp_instance = MagicMock()

    with patch.dict("os.environ", smtp_env):
        with patch("app.services.auth_service.smtplib.SMTP") as mock_smtp_cls:
            mock_smtp_cls.return_value.__enter__ = MagicMock(return_value=mock_smtp_instance)
            mock_smtp_cls.return_value.__exit__ = MagicMock(return_value=False)

            await auth_service.forgot_password(seeded_db, "coach_a@test.com")

            mock_smtp_cls.assert_called_once_with("smtp.example.com", 587)
            mock_smtp_instance.starttls.assert_called_once()
            mock_smtp_instance.login.assert_called_once_with("user@example.com", "secret")
            mock_smtp_instance.send_message.assert_called_once()


@pytest.mark.asyncio
async def test_forgot_password_silent_for_unknown_email(db, caplog):
    """forgot_password() returns silently for unknown emails (no user enumeration)."""
    import logging

    with caplog.at_level(logging.WARNING, logger="aquilus"):
        await auth_service.forgot_password(db, "nobody@nowhere.com")

    # Should not log any password reset link for unknown emails
    assert not any(
        "Password reset link" in record.message
        for record in caplog.records
    )


# ──────────────────────────────────────────────────────────────────────────────
# Bug #11: Password validation on signup and reset_password
# ──────────────────────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_weak_password_rejected():
    """signup() and reset_password() must reject passwords that fail complexity rules."""
    from app.domain.exceptions import ValidationError

    weak_passwords = [
        "abc",          # too short
        "abcdefgh",     # no uppercase, no digit
        "ABCDEFGH",     # no lowercase, no digit
        "Abcdefgh",     # no digit
    ]

    for pw in weak_passwords:
        with pytest.raises(ValidationError, match="[Pp]assword"):
            auth_service._validate_password(pw)


@pytest.mark.asyncio
async def test_strong_password_accepted():
    """_validate_password() must not raise for a password meeting all requirements."""
    from app.domain.exceptions import ValidationError

    # Should not raise
    try:
        auth_service._validate_password("Abcdefg1")
    except ValidationError:
        pytest.fail("_validate_password() raised ValidationError for a valid password 'Abcdefg1'")


# ──────────────────────────────────────────────────────────────────────────────
# Login / credential verification
# ──────────────────────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_login_valid_credentials(seeded_db):
    """Login with correct email/password returns access and refresh tokens."""
    from sqlalchemy import text
    await seeded_db.execute(text("RESET ROLE"))

    result = await auth_service.login(seeded_db, "coach_a@test.com", "testpass123")

    assert "access_token" in result
    assert "refresh_token" in result
    assert result["user"]["email"] == "coach_a@test.com"
    assert result["token_type"] == "bearer"


@pytest.mark.asyncio
async def test_login_wrong_password(seeded_db):
    """Login with an incorrect password raises UnauthorizedError."""
    from app.domain.exceptions import UnauthorizedError
    from sqlalchemy import text
    await seeded_db.execute(text("RESET ROLE"))

    with pytest.raises(UnauthorizedError):
        await auth_service.login(seeded_db, "coach_a@test.com", "wrongpassword")


@pytest.mark.asyncio
async def test_login_nonexistent_email(seeded_db):
    """Login with an unknown email raises UnauthorizedError."""
    from app.domain.exceptions import UnauthorizedError
    from sqlalchemy import text
    await seeded_db.execute(text("RESET ROLE"))

    with pytest.raises(UnauthorizedError):
        await auth_service.login(seeded_db, "nonexistent@test.com", "testpass123")


# ──────────────────────────────────────────────────────────────────────────────
# Signup
# ──────────────────────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_signup_creates_new_user(seeded_db):
    """Signup with a fresh email creates a user and returns tokens."""
    from sqlalchemy import text
    await seeded_db.execute(text("RESET ROLE"))

    result = await auth_service.signup(seeded_db, "newuser@test.com", "ValidPass1!", "New User")

    assert "access_token" in result
    assert "refresh_token" in result
    assert result["user"]["email"] == "newuser@test.com"


@pytest.mark.asyncio
async def test_signup_duplicate_email_rejected(seeded_db):
    """Signup with an already-registered email raises ConflictError."""
    from app.domain.exceptions import ConflictError
    from sqlalchemy import text
    await seeded_db.execute(text("RESET ROLE"))

    with pytest.raises(ConflictError):
        await auth_service.signup(seeded_db, "coach_a@test.com", "ValidPass1!", "Duplicate")


@pytest.mark.asyncio
async def test_signup_weak_password_rejected(seeded_db):
    """Signup with a password that fails complexity rules raises ValidationError."""
    from app.domain.exceptions import ValidationError
    from sqlalchemy import text
    await seeded_db.execute(text("RESET ROLE"))

    with pytest.raises(ValidationError):
        await auth_service.signup(seeded_db, "weak@test.com", "abc", "Weak")


# ──────────────────────────────────────────────────────────────────────────────
# Token refresh / rotation
# ──────────────────────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_refresh_token_rotation(seeded_db):
    """Refresh returns new tokens, and the old refresh token is then revoked."""
    from app.domain.exceptions import UnauthorizedError
    from sqlalchemy import text
    await seeded_db.execute(text("RESET ROLE"))

    login_result = await auth_service.login(seeded_db, "coach_a@test.com", "testpass123")
    old_refresh = login_result["refresh_token"]

    refresh_result = await auth_service.refresh_tokens(seeded_db, old_refresh)

    # Refresh token must be different (rotated)
    assert refresh_result["refresh_token"] != old_refresh
    # Access token may be identical if generated in same second (same iat/exp)
    assert "access_token" in refresh_result

    # The old refresh token must now be rejected
    with pytest.raises(UnauthorizedError):
        await auth_service.refresh_tokens(seeded_db, old_refresh)


# ──────────────────────────────────────────────────────────────────────────────
# Logout
# ──────────────────────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_logout_revokes_refresh_token(seeded_db):
    """Logout marks the refresh token as revoked; subsequent refresh raises UnauthorizedError."""
    from app.domain.exceptions import UnauthorizedError
    from sqlalchemy import text
    await seeded_db.execute(text("RESET ROLE"))

    login_result = await auth_service.login(seeded_db, "coach_a@test.com", "testpass123")
    refresh_token = login_result["refresh_token"]

    await auth_service.logout(seeded_db, refresh_token)

    with pytest.raises(UnauthorizedError):
        await auth_service.refresh_tokens(seeded_db, refresh_token)


# ──────────────────────────────────────────────────────────────────────────────
# get_user_by_id
# ──────────────────────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_get_user_by_id(seeded_db):
    """get_user_by_id returns the correct user profile dict for a known user."""
    from tests.seed import USER_A_ID
    from sqlalchemy import text
    await seeded_db.execute(text("RESET ROLE"))

    user = await auth_service.get_user_by_id(seeded_db, str(USER_A_ID))

    assert user is not None
    assert user["email"] == "coach_a@test.com"
    assert user["id"] == str(USER_A_ID)


@pytest.mark.asyncio
async def test_get_user_by_id_unknown_returns_none(seeded_db):
    """get_user_by_id returns None for an ID that doesn't exist."""
    import uuid
    from sqlalchemy import text
    await seeded_db.execute(text("RESET ROLE"))

    result = await auth_service.get_user_by_id(seeded_db, str(uuid.uuid4()))

    assert result is None
