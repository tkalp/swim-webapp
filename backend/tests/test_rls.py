"""Tests for Row-Level Security context variable integration and RLS policies."""
import pytest
from sqlalchemy import text, select

from app.infrastructure.models import Swimmer, TrainingSession, TrainingSchedule, CalendarEvent
from tests.conftest import set_user_context
from tests.seed import USER_A_ID, USER_B_ID, USER_C_ID, USER_D_ID, SQUAD_1_ID, SQUAD_2_ID


# ──────────────────────────────────────────────
# Context variable tests (pre-existing)
# ──────────────────────────────────────────────

@pytest.mark.asyncio
async def test_set_local_sets_user_context(db):
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

    set_current_user_id(str(USER_B_ID))
    assert _current_user_id.get() == str(USER_B_ID)
    _current_user_id.set(None)


# ──────────────────────────────────────────────
# RLS policy tests
# ──────────────────────────────────────────────

@pytest.mark.asyncio
async def test_rls_owner_sees_own_squad_swimmers(seeded_db):
    """User A owns Squad 1 (3 swimmers). Should not see Squad 2 swimmer."""
    await set_user_context(seeded_db, str(USER_A_ID))
    result = await seeded_db.execute(select(Swimmer))
    swimmers = result.scalars().all()
    assert len(swimmers) == 3
    assert all(str(s.squad_id) == str(SQUAD_1_ID) for s in swimmers)


@pytest.mark.asyncio
async def test_rls_non_member_sees_no_swimmers(seeded_db):
    """User D has no squad membership. Should see 0 swimmers."""
    await set_user_context(seeded_db, str(USER_D_ID))
    result = await seeded_db.execute(select(Swimmer))
    swimmers = result.scalars().all()
    assert len(swimmers) == 0


@pytest.mark.asyncio
async def test_rls_multi_squad_user_sees_both(seeded_db):
    """User B is in Squad 1 (admin) and Squad 2 (owner). Should see all 4 swimmers."""
    await set_user_context(seeded_db, str(USER_B_ID))
    result = await seeded_db.execute(select(Swimmer))
    swimmers = result.scalars().all()
    assert len(swimmers) == 4


@pytest.mark.asyncio
async def test_rls_worker_no_context_sees_all(seeded_db):
    """No SET LOCAL = worker bypass. Should see all 4 swimmers."""
    result = await seeded_db.execute(select(Swimmer))
    swimmers = result.scalars().all()
    assert len(swimmers) == 4


@pytest.mark.asyncio
async def test_rls_training_sessions_scoped(seeded_db):
    """User A should see Squad 1 sessions only."""
    await set_user_context(seeded_db, str(USER_A_ID))
    result = await seeded_db.execute(select(TrainingSession))
    sessions = result.scalars().all()
    assert len(sessions) == 2  # 2 sessions in Squad 1
    assert all(str(s.squad_id) == str(SQUAD_1_ID) for s in sessions)


@pytest.mark.asyncio
async def test_rls_non_member_sees_no_sessions(seeded_db):
    """User D should see 0 sessions."""
    await set_user_context(seeded_db, str(USER_D_ID))
    result = await seeded_db.execute(select(TrainingSession))
    sessions = result.scalars().all()
    assert len(sessions) == 0
