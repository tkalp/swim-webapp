"""Integration tests for training attendance CRUD and RLS."""
import pytest
from sqlalchemy import select, text
from app.infrastructure.models import TrainingAttendance
from tests.seed import (
    SQUAD_1_ID,
    SWIMMER_1_ID,
    SWIMMER_2_ID,
    USER_A_ID,
    USER_D_ID,
    SESSION_1_ID,
    SESSION_2_ID,
)


@pytest.mark.asyncio
async def test_create_attendance_record(seeded_db):
    """Can create an attendance record for a swimmer in a session."""
    await seeded_db.execute(text("RESET ROLE"))

    attendance = TrainingAttendance(
        training_session_id=SESSION_1_ID,
        swimmer_id=SWIMMER_1_ID,
        status="present",
        notes="Good effort",
    )
    seeded_db.add(attendance)
    await seeded_db.flush()

    result = await seeded_db.execute(
        select(TrainingAttendance).where(TrainingAttendance.swimmer_id == SWIMMER_1_ID)
    )
    record = result.scalar_one()
    assert record.status == "present"
    assert record.notes == "Good effort"
    assert record.training_session_id == SESSION_1_ID


@pytest.mark.asyncio
async def test_create_multiple_attendance_records_same_session(seeded_db):
    """Multiple swimmers can have attendance records in the same session."""
    await seeded_db.execute(text("RESET ROLE"))

    records = [
        TrainingAttendance(
            training_session_id=SESSION_1_ID,
            swimmer_id=SWIMMER_1_ID,
            status="present",
        ),
        TrainingAttendance(
            training_session_id=SESSION_1_ID,
            swimmer_id=SWIMMER_2_ID,
            status="absent",
            notes="Sick",
        ),
    ]
    seeded_db.add_all(records)
    await seeded_db.flush()

    result = await seeded_db.execute(
        select(TrainingAttendance).where(
            TrainingAttendance.training_session_id == SESSION_1_ID
        )
    )
    saved = result.scalars().all()
    assert len(saved) == 2
    statuses = {r.status for r in saved}
    assert "present" in statuses
    assert "absent" in statuses


@pytest.mark.asyncio
async def test_attendance_rls_visible_to_squad_owner(seeded_db):
    """Attendance records are visible to the squad owner under RLS."""
    from tests.conftest import set_user_context

    # Insert without RLS first (superuser)
    await seeded_db.execute(text("RESET ROLE"))
    attendance = TrainingAttendance(
        training_session_id=SESSION_1_ID,
        swimmer_id=SWIMMER_1_ID,
        status="present",
    )
    seeded_db.add(attendance)
    await seeded_db.flush()

    # Switch back to app_user so RLS is enforced, then set User A context
    await seeded_db.execute(text("SET LOCAL ROLE app_user"))
    await set_user_context(seeded_db, str(USER_A_ID))
    result = await seeded_db.execute(select(TrainingAttendance))
    records = result.scalars().all()
    assert len(records) >= 1


@pytest.mark.asyncio
async def test_attendance_rls_hidden_from_non_member(seeded_db):
    """Attendance records are invisible to users with no squad membership."""
    from tests.conftest import set_user_context

    # Insert without RLS first (superuser, no RLS)
    await seeded_db.execute(text("RESET ROLE"))
    attendance = TrainingAttendance(
        training_session_id=SESSION_1_ID,
        swimmer_id=SWIMMER_1_ID,
        status="present",
    )
    seeded_db.add(attendance)
    await seeded_db.flush()

    # Switch back to app_user (non-superuser) so RLS is enforced, then set User D context
    await seeded_db.execute(text("SET LOCAL ROLE app_user"))
    await set_user_context(seeded_db, str(USER_D_ID))
    result = await seeded_db.execute(select(TrainingAttendance))
    records = result.scalars().all()
    assert len(records) == 0


@pytest.mark.asyncio
async def test_attendance_status_update(seeded_db):
    """Attendance status can be updated after initial insert."""
    await seeded_db.execute(text("RESET ROLE"))

    attendance = TrainingAttendance(
        training_session_id=SESSION_2_ID,
        swimmer_id=SWIMMER_1_ID,
        status="absent",
    )
    seeded_db.add(attendance)
    await seeded_db.flush()

    # Update the status
    attendance.status = "late"
    await seeded_db.flush()

    result = await seeded_db.execute(
        select(TrainingAttendance).where(TrainingAttendance.id == attendance.id)
    )
    updated = result.scalar_one()
    assert updated.status == "late"
