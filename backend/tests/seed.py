"""Deterministic test seed data with fixed UUIDs for authorization tests."""
import uuid
from datetime import date, datetime, time, timezone

from passlib.hash import bcrypt

# ──────────────────────────────────────────────
# Fixed UUIDs – use these in assertions
# ──────────────────────────────────────────────

USER_A_ID = uuid.UUID("aaaa0000-0000-0000-0000-000000000001")
USER_B_ID = uuid.UUID("aaaa0000-0000-0000-0000-000000000002")
USER_C_ID = uuid.UUID("aaaa0000-0000-0000-0000-000000000003")
USER_D_ID = uuid.UUID("aaaa0000-0000-0000-0000-000000000004")

COACH_A_ID = uuid.UUID("bbbb0000-0000-0000-0000-000000000001")
COACH_B_ID = uuid.UUID("bbbb0000-0000-0000-0000-000000000002")
COACH_C_ID = uuid.UUID("bbbb0000-0000-0000-0000-000000000003")
COACH_D_ID = uuid.UUID("bbbb0000-0000-0000-0000-000000000004")

SQUAD_1_ID = uuid.UUID("cccc0000-0000-0000-0000-000000000001")
SQUAD_2_ID = uuid.UUID("cccc0000-0000-0000-0000-000000000002")

SWIMMER_1_ID = uuid.UUID("dddd0000-0000-0000-0000-000000000001")
SWIMMER_2_ID = uuid.UUID("dddd0000-0000-0000-0000-000000000002")
SWIMMER_3_ID = uuid.UUID("dddd0000-0000-0000-0000-000000000003")
SWIMMER_4_ID = uuid.UUID("dddd0000-0000-0000-0000-000000000004")

SESSION_1_ID = uuid.UUID("eeee0000-0000-0000-0000-000000000001")
SESSION_2_ID = uuid.UUID("eeee0000-0000-0000-0000-000000000002")

SCHEDULE_1_ID = uuid.UUID("ffff0000-0000-0000-0000-000000000001")

CS_A_S1_ID = uuid.UUID("aabb0000-0000-0000-0000-000000000001")
CS_B_S1_ID = uuid.UUID("aabb0000-0000-0000-0000-000000000002")
CS_B_S2_ID = uuid.UUID("aabb0000-0000-0000-0000-000000000003")
CS_C_S1_ID = uuid.UUID("aabb0000-0000-0000-0000-000000000004")


# ──────────────────────────────────────────────
# Pre-hashed password for "testpass123"
# ──────────────────────────────────────────────
_PASSWORD_HASH = bcrypt.using(rounds=4).hash("testpass123")


async def seed_database(session) -> None:
    """Insert deterministic test data into an empty database.

    Expects to be called inside an active transaction (session.begin()).
    Does NOT commit – the caller controls the transaction boundary.
    """
    from app.infrastructure.models import (
        User,
        Coach,
        Squad,
        CoachSquad,
        Swimmer,
        TrainingSession,
        TrainingSchedule,
    )

    # ── Users ──────────────────────────────────
    users = [
        User(id=USER_A_ID, email="coach_a@test.com", password_hash=_PASSWORD_HASH, full_name="Coach A"),
        User(id=USER_B_ID, email="coach_b@test.com", password_hash=_PASSWORD_HASH, full_name="Coach B"),
        User(id=USER_C_ID, email="coach_c@test.com", password_hash=_PASSWORD_HASH, full_name="Coach C"),
        User(id=USER_D_ID, email="coach_d@test.com", password_hash=_PASSWORD_HASH, full_name="Coach D"),
    ]
    session.add_all(users)
    await session.flush()

    # ── Coaches ────────────────────────────────
    coaches = [
        Coach(id=COACH_A_ID, user_id=USER_A_ID, first_name="Coach", last_name="A"),
        Coach(id=COACH_B_ID, user_id=USER_B_ID, first_name="Coach", last_name="B"),
        Coach(id=COACH_C_ID, user_id=USER_C_ID, first_name="Coach", last_name="C"),
        Coach(id=COACH_D_ID, user_id=USER_D_ID, first_name="Coach", last_name="D"),
    ]
    session.add_all(coaches)
    await session.flush()

    # ── Squads ─────────────────────────────────
    squads = [
        Squad(id=SQUAD_1_ID, name="Test Squad 1", coach_id=COACH_A_ID),
        Squad(id=SQUAD_2_ID, name="Test Squad 2", coach_id=COACH_B_ID),
    ]
    session.add_all(squads)
    await session.flush()

    # ── Coach–Squad memberships ────────────────
    memberships = [
        CoachSquad(id=CS_A_S1_ID, coach_id=COACH_A_ID, squad_id=SQUAD_1_ID, role="owner", can_manage_swimmers=True),
        CoachSquad(id=CS_B_S1_ID, coach_id=COACH_B_ID, squad_id=SQUAD_1_ID, role="admin", can_manage_swimmers=True),
        CoachSquad(id=CS_B_S2_ID, coach_id=COACH_B_ID, squad_id=SQUAD_2_ID, role="owner", can_manage_swimmers=True),
        CoachSquad(id=CS_C_S1_ID, coach_id=COACH_C_ID, squad_id=SQUAD_1_ID, role="member", can_manage_swimmers=False),
    ]
    session.add_all(memberships)

    # ── Swimmers ───────────────────────────────
    swimmers = [
        Swimmer(id=SWIMMER_1_ID, squad_id=SQUAD_1_ID, first_name="Alice", last_name="Swimmer", date_of_birth=date(2010, 3, 15), sex="F"),
        Swimmer(id=SWIMMER_2_ID, squad_id=SQUAD_1_ID, first_name="Bob", last_name="Swimmer", date_of_birth=date(2009, 7, 22), sex="M"),
        Swimmer(id=SWIMMER_3_ID, squad_id=SQUAD_1_ID, first_name="Charlie", last_name="Swimmer", date_of_birth=date(2011, 1, 5), sex="M"),
        Swimmer(id=SWIMMER_4_ID, squad_id=SQUAD_2_ID, first_name="Diana", last_name="Swimmer", date_of_birth=date(2010, 11, 30), sex="F"),
    ]
    session.add_all(swimmers)

    # ── Training Sessions (Squad 1) ───────────
    now = datetime.now(timezone.utc)
    sessions = [
        TrainingSession(id=SESSION_1_ID, squad_id=SQUAD_1_ID, start_date=now, training_type="morning"),
        TrainingSession(id=SESSION_2_ID, squad_id=SQUAD_1_ID, start_date=now, training_type="afternoon"),
    ]
    session.add_all(sessions)

    # ── Training Schedule (Squad 1) ────────────
    schedules = [
        TrainingSchedule(id=SCHEDULE_1_ID, squad_id=SQUAD_1_ID, day_of_week=1, start_time=time(6, 0), end_time=time(8, 0), training_type="morning"),
    ]
    session.add_all(schedules)

    await session.flush()
