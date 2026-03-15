"""SQLAlchemy async database engine and session management."""
import os
from contextvars import ContextVar
from typing import AsyncGenerator, Optional
from sqlalchemy import text
from sqlalchemy.ext.asyncio import (
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)
from sqlalchemy.orm import DeclarativeBase

_current_user_id: ContextVar[Optional[str]] = ContextVar('current_user_id', default=None)


def set_current_user_id(user_id: str):
    """Set the current user ID for RLS. Called by auth middleware."""
    _current_user_id.set(user_id)


def clear_current_user_id():
    """Clear the current user ID after request."""
    _current_user_id.set(None)


DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "postgresql+asyncpg://aquilus:aquilus@localhost:5432/aquilus",
)

engine = create_async_engine(
    DATABASE_URL,
    echo=os.getenv("SQL_ECHO", "false").lower() == "true",
    pool_size=10,
    max_overflow=20,
    pool_pre_ping=True,
)

AsyncSessionLocal = async_sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False,
)


class Base(DeclarativeBase):
    """Base class for all SQLAlchemy models."""
    pass


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    """Yield a database session with RLS context.

    Sets app.current_user_id via SET LOCAL for RLS policies.
    Routes manage their own commits — SET LOCAL persists within
    the session's implicit transaction until commit/rollback.

    Usage:
        @router.get("/items")
        async def list_items(db: AsyncSession = Depends(get_db)):
            ...
    """
    async with AsyncSessionLocal() as session:
        user_id = _current_user_id.get(None)
        if user_id:
            sanitised = str(user_id).replace("'", "''")
            await session.execute(
                text(f"SET LOCAL app.current_user_id = '{sanitised}'")
            )
        try:
            yield session
        finally:
            await session.close()


async def init_db() -> None:
    """Create all tables (for development/testing only — use Alembic in production)."""
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)


async def close_db() -> None:
    """Dispose of the engine connection pool."""
    await engine.dispose()
