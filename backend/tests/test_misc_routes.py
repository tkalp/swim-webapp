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


# ──────────────────────────────────────────────
# Coach Connections
# ──────────────────────────────────────────────

@pytest.mark.asyncio
async def test_create_connection_request(seeded_db):
    """Can create a pending connection between two coaches."""
    from sqlalchemy import text, select
    from app.infrastructure.models import CoachConnection
    from tests.seed import COACH_A_ID, COACH_D_ID

    await seeded_db.execute(text("RESET ROLE"))
    conn = CoachConnection(
        requester_id=COACH_A_ID,
        recipient_id=COACH_D_ID,
        status="pending",
    )
    seeded_db.add(conn)
    await seeded_db.flush()

    result = await seeded_db.execute(
        select(CoachConnection).where(CoachConnection.requester_id == COACH_A_ID)
    )
    assert result.scalar_one().status == "pending"


@pytest.mark.asyncio
async def test_accept_connection(seeded_db):
    """Accepting a connection changes status to 'accepted'."""
    from sqlalchemy import text, select
    from app.infrastructure.models import CoachConnection
    from tests.seed import COACH_A_ID, COACH_D_ID

    await seeded_db.execute(text("RESET ROLE"))
    conn = CoachConnection(
        requester_id=COACH_A_ID,
        recipient_id=COACH_D_ID,
        status="pending",
    )
    seeded_db.add(conn)
    await seeded_db.flush()

    # Accept the connection by updating its status
    conn.status = "accepted"
    await seeded_db.flush()

    result = await seeded_db.execute(
        select(CoachConnection).where(CoachConnection.requester_id == COACH_A_ID)
    )
    assert result.scalar_one().status == "accepted"


@pytest.mark.asyncio
async def test_duplicate_connection_detected(seeded_db):
    """Duplicate connection check finds existing connection in both directions."""
    from sqlalchemy import text, select, and_, or_
    from app.infrastructure.models import CoachConnection
    from tests.seed import COACH_A_ID, COACH_D_ID

    await seeded_db.execute(text("RESET ROLE"))
    conn = CoachConnection(
        requester_id=COACH_A_ID,
        recipient_id=COACH_D_ID,
        status="pending",
    )
    seeded_db.add(conn)
    await seeded_db.flush()

    # Check both directions — should find the existing connection
    result = await seeded_db.execute(
        select(CoachConnection).where(
            or_(
                and_(
                    CoachConnection.requester_id == COACH_A_ID,
                    CoachConnection.recipient_id == COACH_D_ID,
                ),
                and_(
                    CoachConnection.requester_id == COACH_D_ID,
                    CoachConnection.recipient_id == COACH_A_ID,
                ),
            )
        )
    )
    existing = result.scalars().all()
    assert len(existing) == 1
    assert existing[0].status == "pending"


@pytest.mark.asyncio
async def test_connection_status_is_pending_by_default(seeded_db):
    """CoachConnection defaults to 'pending' status even without explicit value."""
    from sqlalchemy import text, select
    from app.infrastructure.models import CoachConnection
    from tests.seed import COACH_B_ID, COACH_D_ID

    await seeded_db.execute(text("RESET ROLE"))
    conn = CoachConnection(
        requester_id=COACH_B_ID,
        recipient_id=COACH_D_ID,
    )
    seeded_db.add(conn)
    await seeded_db.flush()

    result = await seeded_db.execute(
        select(CoachConnection).where(
            CoachConnection.requester_id == COACH_B_ID,
        )
    )
    assert result.scalar_one().status == "pending"


@pytest.mark.asyncio
async def test_connection_stored_with_timestamps(seeded_db):
    """CoachConnection is stored with created_at and updated_at timestamps."""
    from sqlalchemy import text, select
    from app.infrastructure.models import CoachConnection
    from tests.seed import COACH_C_ID, COACH_D_ID

    await seeded_db.execute(text("RESET ROLE"))
    conn = CoachConnection(
        requester_id=COACH_C_ID,
        recipient_id=COACH_D_ID,
        status="pending",
    )
    seeded_db.add(conn)
    await seeded_db.flush()

    result = await seeded_db.execute(
        select(CoachConnection).where(CoachConnection.requester_id == COACH_C_ID)
    )
    stored = result.scalar_one()
    assert stored.created_at is not None


# ──────────────────────────────────────────────
# Notifications
# ──────────────────────────────────────────────

@pytest.mark.asyncio
async def test_notification_read_status(seeded_db):
    """Can mark a notification as read."""
    from sqlalchemy import text, select
    from app.infrastructure.models import NotificationReadStatus
    from tests.seed import USER_A_ID

    await seeded_db.execute(text("RESET ROLE"))
    read = NotificationReadStatus(
        user_id=USER_A_ID,
        notification_type="squad_invitation",
        notification_id="some-invite-id",
    )
    seeded_db.add(read)
    await seeded_db.flush()

    result = await seeded_db.execute(
        select(NotificationReadStatus).where(NotificationReadStatus.user_id == USER_A_ID)
    )
    assert result.scalar_one().notification_type == "squad_invitation"


@pytest.mark.asyncio
async def test_notification_read_unique_constraint(seeded_db):
    """Duplicate read status for same (user, type, id) is rejected by the database."""
    import sqlalchemy.exc
    from sqlalchemy import text
    from app.infrastructure.models import NotificationReadStatus
    from tests.seed import USER_A_ID

    await seeded_db.execute(text("RESET ROLE"))
    read1 = NotificationReadStatus(
        user_id=USER_A_ID,
        notification_type="squad_invitation",
        notification_id="duplicate-invite-id",
    )
    seeded_db.add(read1)
    await seeded_db.flush()

    read2 = NotificationReadStatus(
        user_id=USER_A_ID,
        notification_type="squad_invitation",
        notification_id="duplicate-invite-id",
    )
    seeded_db.add(read2)
    with pytest.raises(Exception) as exc_info:
        await seeded_db.flush()
    assert "uq_notification_read" in str(exc_info.value).lower() or "unique" in str(exc_info.value).lower()


@pytest.mark.asyncio
async def test_notification_read_status_different_users(seeded_db):
    """Two different users can both mark the same notification_id as read."""
    from sqlalchemy import text, select
    from app.infrastructure.models import NotificationReadStatus
    from tests.seed import USER_A_ID, USER_B_ID

    await seeded_db.execute(text("RESET ROLE"))
    for user_id in (USER_A_ID, USER_B_ID):
        seeded_db.add(NotificationReadStatus(
            user_id=user_id,
            notification_type="squad_invitation",
            notification_id="shared-invite-id",
        ))
    await seeded_db.flush()

    result = await seeded_db.execute(
        select(NotificationReadStatus).where(
            NotificationReadStatus.notification_id == "shared-invite-id"
        )
    )
    rows = result.scalars().all()
    assert len(rows) == 2
    user_ids = {r.user_id for r in rows}
    assert USER_A_ID in user_ids
    assert USER_B_ID in user_ids


# ──────────────────────────────────────────────
# Permissions / Squad Invitations
# ──────────────────────────────────────────────

@pytest.mark.asyncio
async def test_squad_invitation_with_role(seeded_db):
    """Invitation stores the intended role."""
    from sqlalchemy import text, select
    from app.infrastructure.models import SquadInvitation
    from tests.seed import SQUAD_1_ID, COACH_A_ID

    await seeded_db.execute(text("RESET ROLE"))
    invite = SquadInvitation(
        squad_id=SQUAD_1_ID,
        invited_email="newcoach@test.com",
        invited_by=COACH_A_ID,
        status="pending",
        role="admin",
    )
    seeded_db.add(invite)
    await seeded_db.flush()

    result = await seeded_db.execute(
        select(SquadInvitation).where(SquadInvitation.invited_email == "newcoach@test.com")
    )
    assert result.scalar_one().role == "admin"


@pytest.mark.asyncio
async def test_squad_invitation_default_role(seeded_db):
    """Invitation defaults to 'assistant' role when none is specified."""
    from sqlalchemy import text, select
    from app.infrastructure.models import SquadInvitation
    from tests.seed import SQUAD_1_ID, COACH_A_ID

    await seeded_db.execute(text("RESET ROLE"))
    invite = SquadInvitation(
        squad_id=SQUAD_1_ID,
        invited_email="assistantcoach@test.com",
        invited_by=COACH_A_ID,
        status="pending",
    )
    seeded_db.add(invite)
    await seeded_db.flush()

    result = await seeded_db.execute(
        select(SquadInvitation).where(SquadInvitation.invited_email == "assistantcoach@test.com")
    )
    assert result.scalar_one().role == "assistant"


@pytest.mark.asyncio
async def test_squad_invitation_pending_status(seeded_db):
    """Invitation status is 'pending' immediately after creation."""
    from sqlalchemy import text, select
    from app.infrastructure.models import SquadInvitation
    from tests.seed import SQUAD_2_ID, COACH_B_ID

    await seeded_db.execute(text("RESET ROLE"))
    invite = SquadInvitation(
        squad_id=SQUAD_2_ID,
        invited_email="pendingcoach@test.com",
        invited_by=COACH_B_ID,
        role="member",
        status="pending",
    )
    seeded_db.add(invite)
    await seeded_db.flush()

    result = await seeded_db.execute(
        select(SquadInvitation).where(SquadInvitation.invited_email == "pendingcoach@test.com")
    )
    stored = result.scalar_one()
    assert stored.status == "pending"
    assert stored.squad_id == SQUAD_2_ID
