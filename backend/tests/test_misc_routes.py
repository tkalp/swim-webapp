"""Tests for calendar, permissions, time_standards, and coach_connections authorization."""
import pytest
from app.middleware.authorization import get_coach_membership
from app.domain.exceptions import UnauthorizedError
from tests.seed import (
    USER_A_ID, USER_B_ID, USER_C_ID, USER_D_ID,
    SQUAD_1_ID, SQUAD_2_ID,
    COACH_A_ID, COACH_B_ID,
)


@pytest.mark.asyncio
async def test_calendar_requires_membership(seeded_db):
    """Non-member (User D) cannot access calendar events for Squad 1."""
    with pytest.raises(UnauthorizedError):
        await get_coach_membership(seeded_db, str(USER_D_ID), str(SQUAD_1_ID))


@pytest.mark.asyncio
async def test_permissions_require_squad_settings(seeded_db):
    """Member (User C) without can_manage_squad_settings cannot manage permissions."""
    m = await get_coach_membership(seeded_db, str(USER_C_ID), str(SQUAD_1_ID))
    assert m.can_manage_squad_settings is False


@pytest.mark.asyncio
async def test_owner_can_manage_squad_settings(seeded_db):
    """Owner (User A) has can_manage_squad_settings on Squad 1."""
    m = await get_coach_membership(seeded_db, str(USER_A_ID), str(SQUAD_1_ID))
    assert m.can_manage_squad_settings is True


@pytest.mark.asyncio
async def test_admin_cannot_manage_squad_settings(seeded_db):
    """Admin (User B) does NOT have can_manage_squad_settings on Squad 1."""
    m = await get_coach_membership(seeded_db, str(USER_B_ID), str(SQUAD_1_ID))
    assert m.can_manage_squad_settings is False


@pytest.mark.asyncio
async def test_duplicate_connection_check_concept(seeded_db):
    """Verify we can query coach_connections for duplicates (Bug #30)."""
    from app.infrastructure.models import CoachConnection
    from sqlalchemy import select, and_, or_

    # No connections seeded, so both directions should return nothing
    result = await seeded_db.execute(
        select(CoachConnection).where(
            or_(
                and_(
                    CoachConnection.requester_id == COACH_A_ID,
                    CoachConnection.recipient_id == COACH_B_ID,
                ),
                and_(
                    CoachConnection.requester_id == COACH_B_ID,
                    CoachConnection.recipient_id == COACH_A_ID,
                ),
            )
        )
    )
    existing = result.scalars().all()
    assert len(existing) == 0


@pytest.mark.asyncio
async def test_coach_search_uses_user_and_coach_tables(seeded_db):
    """Verify User.email and Coach.first_name are queryable (Bug #27 fix)."""
    from app.infrastructure.models import User, Coach
    from sqlalchemy import select

    # Should be able to search by email via User table
    result = await seeded_db.execute(
        select(User).where(User.email.ilike('%coach_a%'))
    )
    users = result.scalars().all()
    assert len(users) == 1
    assert users[0].email == 'coach_a@test.com'

    # Should be able to search by name via Coach table
    result = await seeded_db.execute(
        select(Coach).where(Coach.last_name.ilike('%a%'))
    )
    coaches = result.scalars().all()
    assert len(coaches) >= 1
    last_names = [c.last_name for c in coaches]
    assert "A" in last_names


@pytest.mark.asyncio
async def test_nonmember_cannot_access_squad2_calendar(seeded_db):
    """User A (member of Squad 1 only) cannot access Squad 2 calendar."""
    with pytest.raises(UnauthorizedError):
        await get_coach_membership(seeded_db, str(USER_A_ID), str(SQUAD_2_ID))


@pytest.mark.asyncio
async def test_owner_has_membership_on_own_squad(seeded_db):
    """User B (owner of Squad 2) can access Squad 2."""
    m = await get_coach_membership(seeded_db, str(USER_B_ID), str(SQUAD_2_ID))
    assert m.role == "owner"
    assert m.can_manage_squad_settings is True
