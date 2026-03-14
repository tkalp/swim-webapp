"""Shared test fixtures: testcontainers PostgreSQL, async engine, sessions, seeding."""
import pytest
import pytest_asyncio
from testcontainers.postgres import PostgresContainer
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.pool import NullPool
from sqlalchemy import text


@pytest.fixture(scope="session")
def postgres_container():
    """Start a PostgreSQL 16 container for the entire test session."""
    with PostgresContainer("postgres:16-alpine") as postgres:
        yield postgres


@pytest.fixture(scope="session")
def db_url(postgres_container):
    """Return an asyncpg-compatible database URL from the test container."""
    url = postgres_container.get_connection_url()
    url = url.replace("psycopg2", "asyncpg").replace("postgresql://", "postgresql+asyncpg://")
    return url


@pytest.fixture(scope="session")
def _tables_created(db_url):
    """Create all tables once for the test session (runs synchronously via asyncio.run)."""
    import asyncio

    from app.infrastructure.models import (  # noqa: F401
        User, RefreshToken, Coach, Squad, CoachSquad, Swimmer,
        SwimmerExternalLink, WorkoutResult, RaceSplit,
        TrainingSchedule, TrainingSession, TrainingAttendance,
        TrainingSessionPrePracticeNote, TrainingSessionPostPracticeNote,
        WorkoutTemplate, WorkoutTag, WorkoutTemplateTag,
        WorkoutSessionFeedback, CalendarEvent, CoachConnection,
        SquadInvitation, TimeStandardsSet, TimeStandard,
        SwimmerStandardsTracking, BetaWaitlist, BulkSyncJob,
        BulkSyncFailure, Profile,
    )
    from app.infrastructure.db import Base

    async def _create():
        engine = create_async_engine(db_url, poolclass=NullPool)
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
        await engine.dispose()

    asyncio.run(_create())


@pytest_asyncio.fixture
async def db(db_url, _tables_created):
    """Provide a transactional async session that rolls back after each test."""
    engine = create_async_engine(db_url, poolclass=NullPool)
    async with engine.connect() as conn:
        txn = await conn.begin()
        session = AsyncSession(bind=conn, expire_on_commit=False)
        try:
            yield session
        finally:
            await session.close()
            await txn.rollback()
    await engine.dispose()


@pytest_asyncio.fixture
async def seeded_db(db):
    """A database session pre-loaded with deterministic seed data."""
    from tests.seed import seed_database
    await seed_database(db)
    await db.flush()
    yield db


async def set_user_context(session: AsyncSession, user_id: str):
    """Helper to set RLS context variable for testing."""
    await session.execute(
        text("SET LOCAL app.current_user_id = :uid"),
        {"uid": user_id},
    )
