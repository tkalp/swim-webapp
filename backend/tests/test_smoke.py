"""Smoke tests: verify container, schema creation, and seed data loading."""
import pytest
from sqlalchemy import text, select


@pytest.mark.asyncio
async def test_postgres_container_works(db):
    """The testcontainer is up and accepting queries."""
    result = await db.execute(text("SELECT 1"))
    assert result.scalar() == 1


@pytest.mark.asyncio
async def test_tables_created(db):
    """All expected tables exist after create_all."""
    result = await db.execute(
        text(
            "SELECT table_name FROM information_schema.tables "
            "WHERE table_schema = 'public' ORDER BY table_name"
        )
    )
    tables = [row[0] for row in result.fetchall()]
    assert "users" in tables
    assert "coach" in tables
    assert "squads" in tables
    assert "swimmers" in tables
    assert "coach_squads" in tables


@pytest.mark.asyncio
async def test_seed_data_loads(seeded_db):
    """Seed data inserts the expected number of rows for each entity."""
    from app.infrastructure.models import User, Coach, Squad, Swimmer, CoachSquad

    users = (await seeded_db.execute(select(User))).scalars().all()
    assert len(users) == 4

    coaches = (await seeded_db.execute(select(Coach))).scalars().all()
    assert len(coaches) == 4

    squads = (await seeded_db.execute(select(Squad))).scalars().all()
    assert len(squads) == 2

    swimmers = (await seeded_db.execute(select(Swimmer))).scalars().all()
    assert len(swimmers) == 4

    memberships = (await seeded_db.execute(select(CoachSquad))).scalars().all()
    assert len(memberships) == 4  # A in S1, B in S1, B in S2, C in S1


@pytest.mark.asyncio
async def test_workout_template_usage_count_is_integer(db):
    result = await db.execute(text(
        "SELECT data_type FROM information_schema.columns "
        "WHERE table_name = 'workout_template' AND column_name = 'usage_count'"
    ))
    row = result.fetchone()
    assert row is not None
    assert row[0] == 'integer', f"Expected integer, got {row[0]}"
