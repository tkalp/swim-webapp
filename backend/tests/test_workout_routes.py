"""Tests for authorization on workout-related routes."""
import pytest
from app.middleware.authorization import get_coach_membership
from app.domain.exceptions import UnauthorizedError
from tests.seed import (
    USER_A_ID, USER_B_ID, USER_C_ID, USER_D_ID,
    SQUAD_1_ID, COACH_A_ID,
)


@pytest.mark.asyncio
async def test_owner_can_manage_results(seeded_db):
    m = await get_coach_membership(seeded_db, str(USER_A_ID), str(SQUAD_1_ID))
    assert m.can_manage_results is True


@pytest.mark.asyncio
async def test_admin_can_manage_results(seeded_db):
    m = await get_coach_membership(seeded_db, str(USER_B_ID), str(SQUAD_1_ID))
    assert m.can_manage_results is True


@pytest.mark.asyncio
async def test_member_cannot_manage_results(seeded_db):
    m = await get_coach_membership(seeded_db, str(USER_C_ID), str(SQUAD_1_ID))
    assert m.can_manage_results is False


@pytest.mark.asyncio
async def test_non_member_denied(seeded_db):
    with pytest.raises(UnauthorizedError):
        await get_coach_membership(seeded_db, str(USER_D_ID), str(SQUAD_1_ID))


@pytest.mark.asyncio
async def test_workout_owner_check_concept(seeded_db):
    """Verify the coach lookup works for owner checks."""
    from app.infrastructure.models import Coach
    from sqlalchemy import select
    result = await seeded_db.execute(select(Coach).where(Coach.user_id == USER_A_ID))
    coach = result.scalar_one()
    assert coach is not None
    assert str(coach.id) == str(COACH_A_ID)
    # This coach ID would be compared against workout.create_by_coach


@pytest.mark.asyncio
async def test_non_coach_has_no_coach_record(seeded_db):
    """A user without a coach profile should raise UnauthorizedError."""
    import uuid
    fake_user_id = str(uuid.UUID("99990000-0000-0000-0000-000000000001"))
    with pytest.raises(UnauthorizedError, match="No coach profile found"):
        await get_coach_membership(seeded_db, fake_user_id, str(SQUAD_1_ID))


@pytest.mark.asyncio
async def test_owner_can_manage_workouts(seeded_db):
    m = await get_coach_membership(seeded_db, str(USER_A_ID), str(SQUAD_1_ID))
    assert m.can_manage_workouts is True


@pytest.mark.asyncio
async def test_member_cannot_manage_workouts(seeded_db):
    m = await get_coach_membership(seeded_db, str(USER_C_ID), str(SQUAD_1_ID))
    assert m.can_manage_workouts is False
