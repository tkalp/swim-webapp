"""Tests for RBAC permission columns on CoachSquad."""
import pytest
from sqlalchemy import select
from app.infrastructure.models import CoachSquad
from app.middleware.authorization import get_coach_membership
from app.domain.exceptions import UnauthorizedError


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


# ──────────────────────────────────────────────
# Tests for get_coach_membership() authorization
# ──────────────────────────────────────────────


@pytest.mark.asyncio
async def test_get_membership_owner(seeded_db):
    from tests.seed import USER_A_ID, SQUAD_1_ID
    membership = await get_coach_membership(seeded_db, str(USER_A_ID), str(SQUAD_1_ID))
    assert membership is not None
    assert membership.role == "owner"
    assert membership.can_manage_swimmers is True


@pytest.mark.asyncio
async def test_get_membership_non_member_raises(seeded_db):
    from tests.seed import USER_D_ID, SQUAD_1_ID
    with pytest.raises(UnauthorizedError):
        await get_coach_membership(seeded_db, str(USER_D_ID), str(SQUAD_1_ID))


@pytest.mark.asyncio
async def test_get_membership_member_has_limited_perms(seeded_db):
    from tests.seed import USER_C_ID, SQUAD_1_ID
    membership = await get_coach_membership(seeded_db, str(USER_C_ID), str(SQUAD_1_ID))
    assert membership.can_manage_swimmers is False
    assert membership.can_view_analytics is True


@pytest.mark.asyncio
async def test_get_membership_no_coach_profile_raises(seeded_db):
    """User exists but has no coach record."""
    from app.infrastructure.models import User
    from tests.seed import SQUAD_1_ID
    import uuid
    user_no_coach = User(
        id=uuid.uuid4(),
        email="nocoach@test.com",
        password_hash="$2b$12$test",
        full_name="No Coach User",
    )
    seeded_db.add(user_no_coach)
    await seeded_db.flush()

    with pytest.raises(UnauthorizedError, match="No coach profile"):
        await get_coach_membership(seeded_db, str(user_no_coach.id), str(SQUAD_1_ID))


@pytest.mark.asyncio
async def test_multi_squad_user_gets_correct_membership(seeded_db):
    """User B is admin of Squad 1 and owner of Squad 2."""
    from tests.seed import USER_B_ID, SQUAD_1_ID, SQUAD_2_ID

    m1 = await get_coach_membership(seeded_db, str(USER_B_ID), str(SQUAD_1_ID))
    assert m1.role == "admin"
    assert m1.can_manage_squad_settings is False

    m2 = await get_coach_membership(seeded_db, str(USER_B_ID), str(SQUAD_2_ID))
    assert m2.role == "owner"
    assert m2.can_manage_squad_settings is True
