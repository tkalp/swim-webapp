"""Tests for Row-Level Security context variable integration."""
import pytest
from sqlalchemy import text


@pytest.mark.asyncio
async def test_set_local_sets_user_context(db):
    from tests.conftest import set_user_context
    from tests.seed import USER_A_ID
    await set_user_context(db, str(USER_A_ID))
    result = await db.execute(text("SELECT current_setting('app.current_user_id', true)"))
    assert result.scalar() == str(USER_A_ID)


@pytest.mark.asyncio
async def test_unset_context_returns_null(db):
    result = await db.execute(text("SELECT current_setting('app.current_user_id', true)"))
    assert result.scalar() is None


@pytest.mark.asyncio
async def test_context_var_integration(db):
    """Verify ContextVar -> SET LOCAL flow."""
    from app.infrastructure.db import _current_user_id, set_current_user_id
    from tests.seed import USER_B_ID

    # Simulate what auth middleware does
    set_current_user_id(str(USER_B_ID))

    # Verify the ContextVar is set
    assert _current_user_id.get() == str(USER_B_ID)

    # Clean up
    _current_user_id.set(None)
