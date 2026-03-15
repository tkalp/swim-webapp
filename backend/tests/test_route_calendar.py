"""Integration tests for CalendarEvent CRUD and RLS scoping."""
import pytest
import uuid
from datetime import datetime, timezone, timedelta
from sqlalchemy import select, text

from app.infrastructure.models import CalendarEvent
from app.domain.exceptions import UnauthorizedError
from tests.conftest import set_user_context
from tests.seed import (
    USER_A_ID, USER_B_ID, USER_D_ID,
    SQUAD_1_ID, SQUAD_2_ID,
)


# ─────────────────────────────────────────────────────────────────────────────
# Helpers
# ─────────────────────────────────────────────────────────────────────────────

def _utc(year, month, day, hour=0):
    return datetime(year, month, day, hour, 0, tzinfo=timezone.utc)


# ─────────────────────────────────────────────────────────────────────────────
# Tests
# ─────────────────────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_create_calendar_event(seeded_db):
    """Can create a CalendarEvent and retrieve it by ID."""
    await seeded_db.execute(text("RESET ROLE"))

    event = CalendarEvent(
        squad_id=SQUAD_1_ID,
        name="Swim Meet",
        start_date=_utc(2026, 4, 10, 8),
        end_date=_utc(2026, 4, 10, 17),
        event_type="meet",
    )
    seeded_db.add(event)
    await seeded_db.flush()

    result = await seeded_db.execute(
        select(CalendarEvent).where(CalendarEvent.id == event.id)
    )
    saved = result.scalar_one()
    assert saved.name == "Swim Meet"
    assert saved.event_type == "meet"
    assert str(saved.squad_id) == str(SQUAD_1_ID)


@pytest.mark.asyncio
async def test_read_calendar_events_scoped_by_squad(seeded_db):
    """User A (Squad 1 member) can read Squad 1 calendar events under RLS."""
    await seeded_db.execute(text("RESET ROLE"))

    # Insert events for both squads
    e1 = CalendarEvent(squad_id=SQUAD_1_ID, name="Squad 1 Event", event_type="training")
    e2 = CalendarEvent(squad_id=SQUAD_2_ID, name="Squad 2 Event", event_type="training")
    seeded_db.add_all([e1, e2])
    await seeded_db.flush()
    e1_id, e2_id = e1.id, e2.id

    # User A is a member of Squad 1 only — should see only Squad 1 event
    await set_user_context(seeded_db, str(USER_A_ID))
    await seeded_db.execute(text("SET LOCAL ROLE app_user"))

    result = await seeded_db.execute(
        select(CalendarEvent).where(CalendarEvent.id.in_([e1_id, e2_id]))
    )
    events = result.scalars().all()
    assert len(events) == 1
    assert str(events[0].squad_id) == str(SQUAD_1_ID)


@pytest.mark.asyncio
async def test_update_calendar_event(seeded_db):
    """Owner (Squad 1) can update a calendar event."""
    await seeded_db.execute(text("RESET ROLE"))

    event = CalendarEvent(
        squad_id=SQUAD_1_ID,
        name="Old Name",
        event_type="practice",
    )
    seeded_db.add(event)
    await seeded_db.flush()
    event_id = event.id

    # Update as Squad 1 owner
    await set_user_context(seeded_db, str(USER_A_ID))

    update_result = await seeded_db.execute(
        select(CalendarEvent).where(CalendarEvent.id == event_id)
    )
    fetched = update_result.scalar_one()
    fetched.name = "Updated Name"
    await seeded_db.flush()

    # Verify persisted
    await seeded_db.execute(text("RESET ROLE"))
    check_result = await seeded_db.execute(
        select(CalendarEvent).where(CalendarEvent.id == event_id)
    )
    final = check_result.scalar_one()
    assert final.name == "Updated Name"


@pytest.mark.asyncio
async def test_non_member_cannot_see_events(seeded_db):
    """User D (no squad membership) cannot see any calendar events via RLS."""
    await seeded_db.execute(text("RESET ROLE"))

    event = CalendarEvent(
        squad_id=SQUAD_1_ID,
        name="Private Event",
        event_type="meet",
    )
    seeded_db.add(event)
    await seeded_db.flush()
    event_id = event.id

    # Switch to User D — no squad memberships
    await set_user_context(seeded_db, str(USER_D_ID))
    await seeded_db.execute(text("SET LOCAL ROLE app_user"))

    result = await seeded_db.execute(
        select(CalendarEvent).where(CalendarEvent.id == event_id)
    )
    found = result.scalar_one_or_none()
    assert found is None


@pytest.mark.asyncio
async def test_date_range_filter_includes_multi_day(seeded_db):
    """Multi-day events that overlap a date range boundary are included in the filter."""
    await seeded_db.execute(text("RESET ROLE"))

    # Event starts before range but ends within it — should be included in filter
    early_start = _utc(2026, 5, 1, 0)   # starts before range
    late_end = _utc(2026, 5, 10, 23)     # ends within range

    event = CalendarEvent(
        squad_id=SQUAD_1_ID,
        name="Multi-Day Competition",
        start_date=early_start,
        end_date=late_end,
        event_type="meet",
    )
    seeded_db.add(event)
    await seeded_db.flush()

    # Query range: May 5 to May 15 — event starts before May 5 but ends after
    range_start = _utc(2026, 5, 5, 0)
    range_end = _utc(2026, 5, 15, 0)

    from sqlalchemy import and_
    result = await seeded_db.execute(
        select(CalendarEvent).where(
            and_(
                CalendarEvent.end_date >= range_start,    # event ends after range start
                CalendarEvent.start_date <= range_end,    # event starts before range end
            )
        )
    )
    events = result.scalars().all()

    # Our multi-day event should appear — it spans across the range window
    matching = [e for e in events if e.name == "Multi-Day Competition"]
    assert len(matching) == 1
