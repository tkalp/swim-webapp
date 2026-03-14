"""Tests for RBAC permission columns on CoachSquad."""
import pytest
from sqlalchemy import select
from app.infrastructure.models import CoachSquad


@pytest.mark.asyncio
async def test_owner_has_all_permissions(seeded_db):
    from tests.seed import COACH_A_ID, SQUAD_1_ID
    result = await seeded_db.execute(
        select(CoachSquad).where(
            CoachSquad.coach_id == COACH_A_ID,
            CoachSquad.squad_id == SQUAD_1_ID,
        )
    )
    m = result.scalar_one()
    assert m.role == "owner"
    assert m.can_manage_swimmers is True
    assert m.can_manage_workouts is True
    assert m.can_manage_results is True
    assert m.can_manage_attendance is True
    assert m.can_manage_schedules is True
    assert m.can_manage_notes is True
    assert m.can_view_analytics is True
    assert m.can_manage_squad_settings is True


@pytest.mark.asyncio
async def test_admin_has_most_permissions(seeded_db):
    from tests.seed import COACH_B_ID, SQUAD_1_ID
    result = await seeded_db.execute(
        select(CoachSquad).where(
            CoachSquad.coach_id == COACH_B_ID,
            CoachSquad.squad_id == SQUAD_1_ID,
        )
    )
    m = result.scalar_one()
    assert m.role == "admin"
    assert m.can_manage_swimmers is True
    assert m.can_manage_workouts is True
    assert m.can_manage_results is True
    assert m.can_manage_attendance is True
    assert m.can_manage_schedules is True
    assert m.can_manage_notes is True
    assert m.can_view_analytics is True
    assert m.can_manage_squad_settings is False  # admin cannot manage squad settings


@pytest.mark.asyncio
async def test_member_has_limited_permissions(seeded_db):
    from tests.seed import COACH_C_ID, SQUAD_1_ID
    result = await seeded_db.execute(
        select(CoachSquad).where(
            CoachSquad.coach_id == COACH_C_ID,
            CoachSquad.squad_id == SQUAD_1_ID,
        )
    )
    m = result.scalar_one()
    assert m.role == "member"
    assert m.can_manage_swimmers is False
    assert m.can_manage_workouts is False
    assert m.can_manage_results is False
    assert m.can_manage_attendance is False
    assert m.can_manage_schedules is False
    assert m.can_manage_notes is False
    assert m.can_view_analytics is True  # members can view analytics
    assert m.can_manage_squad_settings is False
