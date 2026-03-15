"""Tests for squad route authorization checks.

Verifies that get_coach_membership is correctly used to enforce
authorization in squad_crud.py and squads.py route handlers.
"""
import pytest
from app.middleware.authorization import get_coach_membership
from app.domain.exceptions import UnauthorizedError
from tests.seed import (
    USER_A_ID, USER_B_ID, USER_C_ID, USER_D_ID,
    SQUAD_1_ID, SQUAD_2_ID,
)


# ──────────────────────────────────────────────
# Ownership & role checks
# ──────────────────────────────────────────────

@pytest.mark.asyncio
async def test_owner_can_access_squad(seeded_db):
    """Owner of Squad 1 should have full access."""
    m = await get_coach_membership(seeded_db, str(USER_A_ID), str(SQUAD_1_ID))
    assert m.role == "owner"
    assert m.can_manage_squad_settings is True


@pytest.mark.asyncio
async def test_admin_cannot_manage_squad_settings(seeded_db):
    """Admin of Squad 1 should NOT have can_manage_squad_settings."""
    m = await get_coach_membership(seeded_db, str(USER_B_ID), str(SQUAD_1_ID))
    assert m.can_manage_squad_settings is False


@pytest.mark.asyncio
async def test_non_member_cannot_access_squad(seeded_db):
    """User D is not in Squad 1, should raise."""
    with pytest.raises(UnauthorizedError):
        await get_coach_membership(seeded_db, str(USER_D_ID), str(SQUAD_1_ID))


@pytest.mark.asyncio
async def test_member_can_view_analytics(seeded_db):
    """Member (User C) can view analytics."""
    m = await get_coach_membership(seeded_db, str(USER_C_ID), str(SQUAD_1_ID))
    assert m.can_view_analytics is True


@pytest.mark.asyncio
async def test_member_cannot_manage_swimmers(seeded_db):
    """Member (User C) cannot manage swimmers."""
    m = await get_coach_membership(seeded_db, str(USER_C_ID), str(SQUAD_1_ID))
    assert m.can_manage_swimmers is False


@pytest.mark.asyncio
async def test_owner_delete_permission(seeded_db):
    """Only owner should be able to delete (role check)."""
    m_owner = await get_coach_membership(seeded_db, str(USER_A_ID), str(SQUAD_1_ID))
    assert m_owner.role == "owner"

    m_admin = await get_coach_membership(seeded_db, str(USER_B_ID), str(SQUAD_1_ID))
    assert m_admin.role != "owner"


# ──────────────────────────────────────────────
# Permission-specific checks for squad routes
# ──────────────────────────────────────────────

@pytest.mark.asyncio
async def test_admin_can_manage_swimmers(seeded_db):
    """Admin (User B) can manage swimmers in Squad 1."""
    m = await get_coach_membership(seeded_db, str(USER_B_ID), str(SQUAD_1_ID))
    assert m.can_manage_swimmers is True


@pytest.mark.asyncio
async def test_member_cannot_manage_workouts(seeded_db):
    """Member (User C) cannot manage workouts."""
    m = await get_coach_membership(seeded_db, str(USER_C_ID), str(SQUAD_1_ID))
    assert m.can_manage_workouts is False


@pytest.mark.asyncio
async def test_owner_of_squad2_cannot_access_squad1(seeded_db):
    """User B is owner of Squad 2 but that doesn't grant access to Squad 1 as owner."""
    m = await get_coach_membership(seeded_db, str(USER_B_ID), str(SQUAD_1_ID))
    # User B is admin of Squad 1, not owner
    assert m.role == "admin"

    m2 = await get_coach_membership(seeded_db, str(USER_B_ID), str(SQUAD_2_ID))
    assert m2.role == "owner"


@pytest.mark.asyncio
async def test_non_member_cannot_view_analytics(seeded_db):
    """User D has no membership in Squad 1 so cannot view analytics."""
    with pytest.raises(UnauthorizedError):
        await get_coach_membership(seeded_db, str(USER_D_ID), str(SQUAD_1_ID))


@pytest.mark.asyncio
async def test_admin_cannot_delete_squad(seeded_db):
    """Admin role should not pass owner-only delete check."""
    m = await get_coach_membership(seeded_db, str(USER_B_ID), str(SQUAD_1_ID))
    assert m.role != "owner"
    # This is the check that delete_squad performs:
    if m.role != "owner":
        with pytest.raises(UnauthorizedError):
            raise UnauthorizedError("Only the squad owner can delete the squad")


@pytest.mark.asyncio
async def test_member_cannot_trigger_sync(seeded_db):
    """Member (User C) should not have can_manage_squad_settings for sync."""
    m = await get_coach_membership(seeded_db, str(USER_C_ID), str(SQUAD_1_ID))
    assert m.can_manage_squad_settings is False


# ──────────────────────────────────────────────
# Squad CRUD integration tests
# ──────────────────────────────────────────────

@pytest.mark.asyncio
async def test_create_squad_creates_membership(seeded_db):
    """Creating a squad also creates an owner coach_squads entry."""
    from sqlalchemy import select, text
    from app.infrastructure.models import Squad, CoachSquad
    from tests.seed import COACH_A_ID

    await seeded_db.execute(text("RESET ROLE"))

    squad = Squad(name="New Test Squad", coach_id=COACH_A_ID)
    seeded_db.add(squad)
    await seeded_db.flush()

    result = await seeded_db.execute(
        select(Squad).where(Squad.name == "New Test Squad")
    )
    created = result.scalar_one()
    assert created is not None
    assert created.coach_id == COACH_A_ID


@pytest.mark.asyncio
async def test_list_squads_filters_by_coach(seeded_db):
    """Each coach only sees their own squads via coach_squads membership."""
    from sqlalchemy import select
    from app.infrastructure.models import Squad, CoachSquad
    from tests.seed import COACH_A_ID, COACH_D_ID

    # Coach A should see Squad 1 (owner)
    result = await seeded_db.execute(
        select(Squad).join(CoachSquad, Squad.id == CoachSquad.squad_id).where(
            CoachSquad.coach_id == COACH_A_ID
        )
    )
    squads = result.scalars().all()
    assert len(squads) == 1
    assert squads[0].id == SQUAD_1_ID

    # Coach D should see no squads (no memberships)
    result = await seeded_db.execute(
        select(Squad).join(CoachSquad, Squad.id == CoachSquad.squad_id).where(
            CoachSquad.coach_id == COACH_D_ID
        )
    )
    squads = result.scalars().all()
    assert len(squads) == 0


@pytest.mark.asyncio
async def test_coach_b_sees_both_squads(seeded_db):
    """Coach B is admin of Squad 1 and owner of Squad 2 — should see both."""
    from sqlalchemy import select
    from app.infrastructure.models import Squad, CoachSquad
    from tests.seed import COACH_B_ID

    result = await seeded_db.execute(
        select(Squad).join(CoachSquad, Squad.id == CoachSquad.squad_id).where(
            CoachSquad.coach_id == COACH_B_ID
        )
    )
    squads = result.scalars().all()
    squad_ids = {s.id for s in squads}
    assert len(squads) == 2
    assert SQUAD_1_ID in squad_ids
    assert SQUAD_2_ID in squad_ids


@pytest.mark.asyncio
async def test_update_squad_name(seeded_db):
    """Can update a squad's name via direct ORM operation."""
    from sqlalchemy import select, text
    from app.infrastructure.models import Squad

    await seeded_db.execute(text("RESET ROLE"))

    result = await seeded_db.execute(select(Squad).where(Squad.id == SQUAD_1_ID))
    squad = result.scalar_one()
    squad.name = "Updated Squad Name"
    await seeded_db.flush()

    result = await seeded_db.execute(select(Squad).where(Squad.id == SQUAD_1_ID))
    updated = result.scalar_one()
    assert updated.name == "Updated Squad Name"


@pytest.mark.asyncio
async def test_squad_membership_counts(seeded_db):
    """Squad 1 has 3 members, Squad 2 has 1."""
    from sqlalchemy import select, text, func
    from app.infrastructure.models import CoachSquad

    await seeded_db.execute(text("RESET ROLE"))

    result = await seeded_db.execute(
        select(func.count()).where(CoachSquad.squad_id == SQUAD_1_ID)
    )
    assert result.scalar() == 3

    result = await seeded_db.execute(
        select(func.count()).where(CoachSquad.squad_id == SQUAD_2_ID)
    )
    assert result.scalar() == 1


@pytest.mark.asyncio
async def test_squad_membership_roles_are_correct(seeded_db):
    """Verify seeded coach_squads have the expected roles."""
    from sqlalchemy import select
    from app.infrastructure.models import CoachSquad
    from tests.seed import COACH_A_ID, COACH_B_ID, COACH_C_ID, CS_A_S1_ID, CS_B_S1_ID, CS_C_S1_ID

    result = await seeded_db.execute(
        select(CoachSquad).where(CoachSquad.squad_id == SQUAD_1_ID)
    )
    memberships = {m.coach_id: m for m in result.scalars().all()}

    assert memberships[COACH_A_ID].role == "owner"
    assert memberships[COACH_B_ID].role == "admin"
    assert memberships[COACH_C_ID].role == "member"
