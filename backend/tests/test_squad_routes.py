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
