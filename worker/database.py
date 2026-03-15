"""Database utilities for worker (synchronous SQLAlchemy)."""

import os
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, Session


def get_engine():
    """Create a synchronous SQLAlchemy engine.

    Reads DATABASE_URL from the environment and converts an async
    ``postgresql+asyncpg://`` URL to the synchronous ``postgresql://``
    scheme expected by psycopg2.
    """
    db_url = os.getenv("DATABASE_URL", "")
    # Convert async URL to sync if needed
    sync_url = db_url.replace("postgresql+asyncpg://", "postgresql://")
    return create_engine(
        sync_url,
        echo=os.getenv("SQL_ECHO", "false").lower() == "true",
        pool_size=5,
        max_overflow=10,
        pool_pre_ping=True,
    )


SessionLocal = sessionmaker(bind=get_engine())


def get_db() -> Session:
    """Return a new synchronous database session."""
    return SessionLocal()
