"""Tests for authorization on training-related routes."""
import pytest
from sqlalchemy import select, text
from app.middleware.authorization import get_coach_membership
from app.domain.exceptions import UnauthorizedError
from tests.seed import USER_A_ID, USER_B_ID, USER_C_ID, USER_D_ID, SQUAD_1_ID, SQUAD_2_ID, SESSION_1_ID, SESSION_2_ID


@pytest.mark.asyncio
async def test_owner_can_manage_schedules(seeded_db):
    m = await get_coach_membership(seeded_db, str(USER_A_ID), str(SQUAD_1_ID))
    assert m.can_manage_schedules is True


@pytest.mark.asyncio
async def test_member_cannot_manage_schedules(seeded_db):
    m = await get_coach_membership(seeded_db, str(USER_C_ID), str(SQUAD_1_ID))
    assert m.can_manage_schedules is False


@pytest.mark.asyncio
async def test_owner_can_manage_attendance(seeded_db):
    m = await get_coach_membership(seeded_db, str(USER_A_ID), str(SQUAD_1_ID))
    assert m.can_manage_attendance is True


@pytest.mark.asyncio
async def test_member_cannot_manage_attendance(seeded_db):
    m = await get_coach_membership(seeded_db, str(USER_C_ID), str(SQUAD_1_ID))
    assert m.can_manage_attendance is False


@pytest.mark.asyncio
async def test_owner_can_manage_notes(seeded_db):
    m = await get_coach_membership(seeded_db, str(USER_A_ID), str(SQUAD_1_ID))
    assert m.can_manage_notes is True


@pytest.mark.asyncio
async def test_member_cannot_manage_notes(seeded_db):
    m = await get_coach_membership(seeded_db, str(USER_C_ID), str(SQUAD_1_ID))
    assert m.can_manage_notes is False


@pytest.mark.asyncio
async def test_non_member_denied_all(seeded_db):
    with pytest.raises(UnauthorizedError):
        await get_coach_membership(seeded_db, str(USER_D_ID), str(SQUAD_1_ID))


@pytest.mark.asyncio
async def test_admin_can_manage_all_training(seeded_db):
    m = await get_coach_membership(seeded_db, str(USER_B_ID), str(SQUAD_1_ID))
    assert m.can_manage_schedules is True
    assert m.can_manage_attendance is True
    assert m.can_manage_notes is True


@pytest.mark.asyncio
async def test_day_of_week_js_python_mapping():
    """Verify JS-style day_of_week maps correctly to Python weekday."""
    from datetime import date

    # Monday March 16, 2026
    monday = date(2026, 3, 16)
    python_wd = monday.weekday()  # 0 (Monday)
    js_day = (python_wd + 1) % 7  # 1 (Monday in JS)
    assert js_day == 1

    # Sunday March 15, 2026
    sunday = date(2026, 3, 15)
    python_wd = sunday.weekday()  # 6 (Sunday)
    js_day = (python_wd + 1) % 7  # 0 (Sunday in JS)
    assert js_day == 0

    # Saturday March 21, 2026
    saturday = date(2026, 3, 21)
    python_wd = saturday.weekday()  # 5 (Saturday)
    js_day = (python_wd + 1) % 7  # 6 (Saturday in JS)
    assert js_day == 6

    # Full week coverage: verify all 7 days
    test_cases = [
        # (date, expected_js_day)
        (date(2026, 3, 15), 0),  # Sunday
        (date(2026, 3, 16), 1),  # Monday
        (date(2026, 3, 17), 2),  # Tuesday
        (date(2026, 3, 18), 3),  # Wednesday
        (date(2026, 3, 19), 4),  # Thursday
        (date(2026, 3, 20), 5),  # Friday
        (date(2026, 3, 21), 6),  # Saturday
    ]
    for d, expected in test_cases:
        computed = (d.weekday() + 1) % 7
        assert computed == expected, f"{d.strftime('%A')} should map to JS day {expected}, got {computed}"


# ──────────────────────────────────────────────────────────────────────────────
# Session CRUD tests
# ──────────────────────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_create_session_in_squad(seeded_db):
    """Can create a training session in a squad and read it back."""
    from datetime import datetime, timezone
    from app.infrastructure.models import TrainingSession

    await seeded_db.execute(text("RESET ROLE"))
    session = TrainingSession(
        squad_id=SQUAD_1_ID,
        start_date=datetime(2026, 4, 1, 9, 0, tzinfo=timezone.utc),
        end_date=datetime(2026, 4, 1, 10, 0, tzinfo=timezone.utc),
        training_type="Swim",
    )
    seeded_db.add(session)
    await seeded_db.flush()

    result = await seeded_db.execute(
        select(TrainingSession).where(TrainingSession.training_type == "Swim")
    )
    sessions = result.scalars().all()
    assert len(sessions) >= 1
    assert all(s.training_type == "Swim" for s in sessions)


@pytest.mark.asyncio
async def test_sessions_rls_scoped_to_squad(seeded_db):
    """User A (Squad 1 owner) only sees Squad 1 sessions under RLS."""
    from app.infrastructure.models import TrainingSession
    from tests.conftest import set_user_context

    await set_user_context(seeded_db, str(USER_A_ID))
    result = await seeded_db.execute(select(TrainingSession))
    sessions = result.scalars().all()
    assert len(sessions) >= 1
    assert all(str(s.squad_id) == str(SQUAD_1_ID) for s in sessions)


@pytest.mark.asyncio
async def test_sessions_rls_excludes_non_member(seeded_db):
    """User D (no squad memberships) sees no sessions under RLS."""
    from app.infrastructure.models import TrainingSession
    from tests.conftest import set_user_context

    await set_user_context(seeded_db, str(USER_D_ID))
    result = await seeded_db.execute(select(TrainingSession))
    sessions = result.scalars().all()
    assert len(sessions) == 0


@pytest.mark.asyncio
async def test_seeded_sessions_exist(seeded_db):
    """Seed data contains the expected sessions for Squad 1."""
    from app.infrastructure.models import TrainingSession

    await seeded_db.execute(text("RESET ROLE"))
    result = await seeded_db.execute(select(TrainingSession))
    sessions = result.scalars().all()
    session_ids = {s.id for s in sessions}
    assert SESSION_1_ID in session_ids
    assert SESSION_2_ID in session_ids


@pytest.mark.asyncio
async def test_session_is_virtual_flag_defaults_false(seeded_db):
    """is_virtual defaults to False on a new session."""
    from datetime import datetime, timezone
    from app.infrastructure.models import TrainingSession

    await seeded_db.execute(text("RESET ROLE"))
    session = TrainingSession(
        squad_id=SQUAD_1_ID,
        start_date=datetime(2026, 5, 1, 7, 0, tzinfo=timezone.utc),
        training_type="afternoon",
    )
    seeded_db.add(session)
    await seeded_db.flush()

    result = await seeded_db.execute(
        select(TrainingSession).where(TrainingSession.id == session.id)
    )
    saved = result.scalar_one()
    assert saved.is_virtual is False
