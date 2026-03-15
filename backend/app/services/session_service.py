"""Session service -- materialize virtual training sessions into the database."""
from datetime import datetime, timezone
from typing import Optional, Dict, Any
from sqlalchemy import select, delete, and_
from sqlalchemy.ext.asyncio import AsyncSession
from app.infrastructure.models import TrainingSession, TrainingAttendance
from app.utils import logger


def _parse_iso(value: str) -> datetime:
    """Parse an ISO datetime string. Handles 'Z' suffix for Python 3.10."""
    return datetime.fromisoformat(value.replace("Z", "+00:00"))


async def materialize_session(
    squad_id: str,
    start_date: str,
    end_date: str,
    training_type: str,
    workout_id: Optional[str] = None,
    db: AsyncSession = None
) -> Dict[str, Any]:
    """
    Materialize a virtual session into the database.

    Converts a virtual session (calculated from schedule) into a real database record.
    Uses upsert logic to handle cases where session already exists.
    """
    if not db:
        raise Exception("Database session is required")

    try:
        logger.info(f"Materializing session for squad {squad_id} at {start_date}")

        # Parse date strings to datetime objects
        parsed_start = _parse_iso(start_date)
        parsed_end = _parse_iso(end_date)

        # Check if session already exists
        result = await db.execute(
            select(TrainingSession).where(
                and_(
                    TrainingSession.squad_id == squad_id,
                    TrainingSession.start_date == parsed_start,
                )
            )
        )
        existing = result.scalar_one_or_none()

        if existing:
            # Update existing session
            existing.end_date = parsed_end
            existing.training_type = training_type
            if workout_id:
                existing.workout_id = workout_id
            await db.commit()
            await db.refresh(existing)
            session_row = existing
        else:
            # Create new session
            session_row = TrainingSession(
                squad_id=squad_id,
                start_date=parsed_start,
                end_date=parsed_end,
                training_type=training_type,
                workout_id=workout_id,
            )
            db.add(session_row)
            await db.commit()
            await db.refresh(session_row)

        d = {}
        for col in session_row.__table__.columns:
            val = getattr(session_row, col.name)
            if hasattr(val, 'hex'):
                val = str(val)
            d[col.name] = val

        logger.info(f"Session materialized successfully with ID: {d.get('id')}")
        return d

    except Exception as e:
        logger.error(f"Error materializing session: {str(e)}")
        raise


async def cleanup_virtual_sessions(
    squad_id: str,
    schedule_id: Optional[str] = None,
    db: AsyncSession = None
) -> int:
    """
    Clean up future non-materialized sessions.

    Deletes sessions that:
    - Are in the future (start_date > NOW)
    - Have no workout assigned (workout_id IS NULL)
    - Have no attendance records
    """
    if not db:
        raise Exception("Database session is required")

    try:
        now = datetime.now(timezone.utc)
        logger.info(f"Cleaning up virtual sessions for squad {squad_id}")

        # Find sessions with attendance, scoped to this squad
        att_result = await db.execute(
            select(TrainingAttendance.training_session_id).distinct().where(
                TrainingAttendance.training_session_id.in_(
                    select(TrainingSession.id).where(TrainingSession.squad_id == squad_id)
                )
            )
        )
        sessions_with_attendance = set(
            str(row) for row in att_result.scalars().all()
        )

        # Query future sessions without workouts
        query = select(TrainingSession).where(
            and_(
                TrainingSession.squad_id == squad_id,
                TrainingSession.start_date > now,
                TrainingSession.workout_id.is_(None),
            )
        )
        result = await db.execute(query)
        sessions = result.scalars().all()

        # Filter out sessions with attendance
        sessions_to_delete = [
            s.id for s in sessions
            if str(s.id) not in sessions_with_attendance
        ]

        if not sessions_to_delete:
            logger.info("No sessions to clean up")
            return 0

        # Delete sessions
        await db.execute(
            delete(TrainingSession).where(
                TrainingSession.id.in_(sessions_to_delete)
            )
        )
        await db.commit()

        deleted_count = len(sessions_to_delete)
        logger.info(f"Cleaned up {deleted_count} virtual sessions")
        return deleted_count

    except Exception as e:
        logger.error(f"Error cleaning up virtual sessions: {str(e)}")
        raise
