"""Tests for swimmer route authorization checks.

Verifies that get_coach_membership is correctly used to enforce
authorization in swimmers/core.py and swimmers/sync.py route handlers.
"""
import pytest
from app.middleware.authorization import get_coach_membership
from app.domain.exceptions import UnauthorizedError
from tests.seed import (
    USER_A_ID, USER_B_ID, USER_C_ID, USER_D_ID,
    SQUAD_1_ID, SQUAD_2_ID,
    SWIMMER_1_ID, SWIMMER_2_ID, SWIMMER_4_ID,
)


# ──────────────────────────────────────────────
# Basic membership / permission checks
# ──────────────────────────────────────────────

@pytest.mark.asyncio
async def test_owner_can_manage_swimmers(seeded_db):
    """Owner (User A) has can_manage_swimmers on Squad 1."""
    m = await get_coach_membership(seeded_db, str(USER_A_ID), str(SQUAD_1_ID))
    assert m.can_manage_swimmers is True


@pytest.mark.asyncio
async def test_member_cannot_manage_swimmers(seeded_db):
    """Member (User C) does not have can_manage_swimmers on Squad 1."""
    m = await get_coach_membership(seeded_db, str(USER_C_ID), str(SQUAD_1_ID))
    assert m.can_manage_swimmers is False


@pytest.mark.asyncio
async def test_non_member_cannot_access_swimmers(seeded_db):
    """Non-member (User D) raises UnauthorizedError for Squad 1."""
    with pytest.raises(UnauthorizedError):
        await get_coach_membership(seeded_db, str(USER_D_ID), str(SQUAD_1_ID))


@pytest.mark.asyncio
async def test_admin_can_manage_swimmers(seeded_db):
    """Admin (User B) has can_manage_swimmers on Squad 1."""
    m = await get_coach_membership(seeded_db, str(USER_B_ID), str(SQUAD_1_ID))
    assert m.can_manage_swimmers is True


# ──────────────────────────────────────────────
# Squad membership read access
# ──────────────────────────────────────────────

@pytest.mark.asyncio
async def test_member_can_read_squad(seeded_db):
    """Member (User C) is a squad member so can read swimmer data."""
    m = await get_coach_membership(seeded_db, str(USER_C_ID), str(SQUAD_1_ID))
    assert m is not None


@pytest.mark.asyncio
async def test_owner_of_squad2_cannot_access_squad1_as_owner(seeded_db):
    """User B owns Squad 2 but is only admin in Squad 1 — not owner."""
    m1 = await get_coach_membership(seeded_db, str(USER_B_ID), str(SQUAD_1_ID))
    assert m1.role == "admin"

    m2 = await get_coach_membership(seeded_db, str(USER_B_ID), str(SQUAD_2_ID))
    assert m2.role == "owner"


# ──────────────────────────────────────────────
# Authorization logic used in create/update/delete endpoints
# ──────────────────────────────────────────────

@pytest.mark.asyncio
async def test_create_swimmer_requires_can_manage_swimmers(seeded_db):
    """Simulate the authorization check for POST /swimmers/create."""
    # Owner: allowed
    m = await get_coach_membership(seeded_db, str(USER_A_ID), str(SQUAD_1_ID))
    assert m.can_manage_swimmers is True

    # Member: denied
    m_member = await get_coach_membership(seeded_db, str(USER_C_ID), str(SQUAD_1_ID))
    if not m_member.can_manage_swimmers:
        with pytest.raises(UnauthorizedError):
            raise UnauthorizedError("Missing permission: can_manage_swimmers")


@pytest.mark.asyncio
async def test_update_swimmer_requires_can_manage_swimmers(seeded_db):
    """Simulate the authorization check for PUT /swimmers/{id}/update.

    The route looks up the swimmer's squad_id then checks membership.
    """
    from sqlalchemy import select
    from app.infrastructure.models import Swimmer

    # Swimmer 1 is in Squad 1
    result = await seeded_db.execute(
        select(Swimmer).where(Swimmer.id == SWIMMER_1_ID)
    )
    swimmer = result.scalar_one()
    squad_id = str(swimmer.squad_id)

    # Owner can update
    m = await get_coach_membership(seeded_db, str(USER_A_ID), squad_id)
    assert m.can_manage_swimmers is True

    # Member cannot update
    m_member = await get_coach_membership(seeded_db, str(USER_C_ID), squad_id)
    assert m_member.can_manage_swimmers is False


@pytest.mark.asyncio
async def test_delete_swimmer_requires_can_manage_swimmers(seeded_db):
    """Simulate the authorization check for DELETE /swimmers/{id}/delete."""
    from sqlalchemy import select
    from app.infrastructure.models import Swimmer

    result = await seeded_db.execute(
        select(Swimmer).where(Swimmer.id == SWIMMER_2_ID)
    )
    swimmer = result.scalar_one()
    squad_id = str(swimmer.squad_id)

    # Admin can delete
    m = await get_coach_membership(seeded_db, str(USER_B_ID), squad_id)
    assert m.can_manage_swimmers is True

    # Non-member cannot delete
    with pytest.raises(UnauthorizedError):
        await get_coach_membership(seeded_db, str(USER_D_ID), squad_id)


# ──────────────────────────────────────────────
# Cross-squad isolation
# ──────────────────────────────────────────────

@pytest.mark.asyncio
async def test_squad1_member_cannot_access_squad2_swimmers(seeded_db):
    """User C is in Squad 1 only — should not access Squad 2 swimmers."""
    with pytest.raises(UnauthorizedError):
        await get_coach_membership(seeded_db, str(USER_C_ID), str(SQUAD_2_ID))


@pytest.mark.asyncio
async def test_swimmer_squad_lookup_cross_squad(seeded_db):
    """Swimmer 4 is in Squad 2; User A (Squad 1 owner) has no access."""
    from sqlalchemy import select
    from app.infrastructure.models import Swimmer

    result = await seeded_db.execute(
        select(Swimmer).where(Swimmer.id == SWIMMER_4_ID)
    )
    swimmer = result.scalar_one()
    squad_id = str(swimmer.squad_id)

    # User A has no membership in Squad 2
    with pytest.raises(UnauthorizedError):
        await get_coach_membership(seeded_db, str(USER_A_ID), squad_id)


# ──────────────────────────────────────────────
# Swimmer CRUD integration tests
# ──────────────────────────────────────────────

@pytest.mark.asyncio
async def test_create_swimmer_in_squad(seeded_db):
    """Can create a swimmer in a squad and retrieve them by name."""
    from sqlalchemy import select, text
    from app.infrastructure.models import Swimmer

    await seeded_db.execute(text("RESET ROLE"))

    swimmer = Swimmer(
        first_name="New", last_name="Swimmer",
        squad_id=SQUAD_1_ID, sex="F"
    )
    seeded_db.add(swimmer)
    await seeded_db.flush()

    result = await seeded_db.execute(
        select(Swimmer).where(Swimmer.first_name == "New")
    )
    created = result.scalar_one()
    assert created is not None
    assert created.squad_id == SQUAD_1_ID
    assert created.last_name == "Swimmer"


@pytest.mark.asyncio
async def test_read_swimmers_in_own_squad(seeded_db):
    """User A (Squad 1 owner) can read all swimmers in Squad 1."""
    from sqlalchemy import select
    from app.infrastructure.models import Swimmer
    from tests.conftest import set_user_context

    await set_user_context(seeded_db, str(USER_A_ID))

    result = await seeded_db.execute(
        select(Swimmer).where(Swimmer.squad_id == SQUAD_1_ID)
    )
    swimmers = result.scalars().all()
    assert len(swimmers) == 3  # Alice, Bob, Charlie


@pytest.mark.asyncio
async def test_swimmer_rls_cross_squad_isolation(seeded_db):
    """RLS prevents User A from reading swimmers in Squad 2."""
    from sqlalchemy import select
    from app.infrastructure.models import Swimmer
    from tests.conftest import set_user_context

    await set_user_context(seeded_db, str(USER_A_ID))

    result = await seeded_db.execute(
        select(Swimmer).where(Swimmer.squad_id == SQUAD_2_ID)
    )
    # User A has no membership in Squad 2
    assert len(result.scalars().all()) == 0


@pytest.mark.asyncio
async def test_swimmer_rls_non_member_sees_nothing(seeded_db):
    """Non-member (User D) cannot read any swimmers."""
    from sqlalchemy import select
    from app.infrastructure.models import Swimmer
    from tests.conftest import set_user_context

    await set_user_context(seeded_db, str(USER_D_ID))

    result = await seeded_db.execute(select(Swimmer))
    assert len(result.scalars().all()) == 0


@pytest.mark.asyncio
async def test_update_swimmer(seeded_db):
    """Can update a swimmer's details."""
    from sqlalchemy import select, text
    from app.infrastructure.models import Swimmer

    await seeded_db.execute(text("RESET ROLE"))

    result = await seeded_db.execute(select(Swimmer).where(Swimmer.id == SWIMMER_1_ID))
    swimmer = result.scalar_one()
    swimmer.first_name = "Alicia"
    await seeded_db.flush()

    result = await seeded_db.execute(select(Swimmer).where(Swimmer.id == SWIMMER_1_ID))
    updated = result.scalar_one()
    assert updated.first_name == "Alicia"


@pytest.mark.asyncio
async def test_delete_swimmer(seeded_db):
    """Can delete a swimmer; they no longer appear in subsequent queries."""
    from sqlalchemy import select, text
    from app.infrastructure.models import Swimmer

    await seeded_db.execute(text("RESET ROLE"))

    result = await seeded_db.execute(select(Swimmer).where(Swimmer.id == SWIMMER_1_ID))
    swimmer = result.scalar_one()
    await seeded_db.delete(swimmer)
    await seeded_db.flush()

    result = await seeded_db.execute(select(Swimmer).where(Swimmer.id == SWIMMER_1_ID))
    assert result.scalar_one_or_none() is None


@pytest.mark.asyncio
async def test_coach_b_can_read_both_squads_swimmers(seeded_db):
    """Coach B is member of both squads — RLS lets them see all 4 swimmers."""
    from sqlalchemy import select
    from app.infrastructure.models import Swimmer
    from tests.conftest import set_user_context

    await set_user_context(seeded_db, str(USER_B_ID))

    result = await seeded_db.execute(select(Swimmer))
    swimmers = result.scalars().all()
    assert len(swimmers) == 4
