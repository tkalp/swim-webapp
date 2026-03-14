"""Tests for authorization on training-related routes."""
import pytest
from app.middleware.authorization import get_coach_membership
from app.domain.exceptions import UnauthorizedError
from tests.seed import USER_A_ID, USER_B_ID, USER_C_ID, USER_D_ID, SQUAD_1_ID


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
