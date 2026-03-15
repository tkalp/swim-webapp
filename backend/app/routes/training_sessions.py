# backend/app/routes/training_sessions.py
from fastapi import APIRouter, HTTPException, Query, Body, Depends
from typing import Optional, List
from datetime import datetime, timedelta, timezone
from collections import defaultdict
import pytz
from pydantic import BaseModel

from sqlalchemy import select, and_
from sqlalchemy.ext.asyncio import AsyncSession
from app.infrastructure.db import get_db
from app.infrastructure.models import TrainingSession, TrainingSchedule
from app.services.session_service import materialize_session, cleanup_virtual_sessions
from app.middleware.auth import get_current_user_id
from app.middleware.authorization import get_coach_membership
from app.domain.exceptions import UnauthorizedError
from app.utils import logger

router = APIRouter(prefix="/training-sessions", tags=["training-sessions"])


def _parse_iso_datetime(value: Optional[str]) -> Optional[datetime]:
    """Parse an ISO datetime string to a datetime object. Handles 'Z' suffix for Python 3.10."""
    if not value:
        return None
    return datetime.fromisoformat(value.replace("Z", "+00:00"))


class MaterializeSessionRequest(BaseModel):
    squad_id: str
    start_date: str
    end_date: str
    training_type: str
    workout_id: Optional[str] = None


class CleanupRequest(BaseModel):
    squad_id: str
    schedule_id: Optional[str] = None


class SessionCreate(BaseModel):
    squad_id: str
    start_date: str
    end_date: Optional[str] = None
    training_type: Optional[str] = None
    workout_id: Optional[str] = None


class SessionUpdate(BaseModel):
    squad_id: Optional[str] = None
    start_date: Optional[str] = None
    end_date: Optional[str] = None
    training_type: Optional[str] = None
    workout_id: Optional[str] = None


def _row_to_dict(row) -> dict:
    d = {}
    for col in row.__table__.columns:
        val = getattr(row, col.name)
        if hasattr(val, 'hex'):
            val = str(val)
        d[col.name] = val
    return d


@router.get("/virtual")
async def get_virtual_sessions(
    squad_id: str = Query(..., description="Squad ID to fetch sessions for"),
    from_date: Optional[str] = Query(None, description="Start date (ISO format, default: -30 days)"),
    to_date: Optional[str] = Query(None, description="End date (ISO format, default: +90 days)"),
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    """
    Get both materialized and virtual training sessions for a squad.

    Virtual sessions are calculated from training_schedules on-the-fly.
    Materialized sessions are fetched from training_sessions table.

    Returns unified array with is_virtual flag to distinguish between the two.
    """
    await get_coach_membership(db, user_id, squad_id)
    try:
        # Parse date range
        if not from_date:
            start_dt = datetime.now(timezone.utc) - timedelta(days=30)
        else:
            # Handle various ISO formats including .000Z
            from_date_clean = from_date.replace('Z', '+00:00').split('.')[0] + '+00:00' if '.' in from_date else from_date.replace('Z', '+00:00')
            start_dt = datetime.fromisoformat(from_date_clean)

        if not to_date:
            end_dt = datetime.now(timezone.utc) + timedelta(days=90)
        else:
            # Handle various ISO formats including .000Z
            to_date_clean = to_date.replace('Z', '+00:00').split('.')[0] + '+00:00' if '.' in to_date else to_date.replace('Z', '+00:00')
            end_dt = datetime.fromisoformat(to_date_clean)

        logger.info(f"Fetching virtual sessions for squad {squad_id} from {start_dt.date().isoformat()} to {end_dt.date().isoformat()}")

        # Fetch materialized sessions from database
        from_dt = start_dt if not from_date else datetime.fromisoformat(f"{from_date}T00:00:00+00:00")
        to_dt = end_dt if not to_date else datetime.fromisoformat(f"{to_date}T23:59:59+00:00")

        result = await db.execute(
            select(TrainingSession)
            .where(
                and_(
                    TrainingSession.squad_id == squad_id,
                    TrainingSession.start_date >= from_dt,
                    TrainingSession.start_date <= to_dt,
                )
            )
        )
        materialized_rows = result.scalars().all()

        # Convert ORM objects to dicts
        materialized_sessions = []
        for row in materialized_rows:
            materialized_sessions.append({
                'id': str(row.id),
                'squad_id': str(row.squad_id),
                'workout_id': str(row.workout_id) if row.workout_id else None,
                'start_date': row.start_date.isoformat() if row.start_date else None,
                'end_date': row.end_date.isoformat() if row.end_date else None,
                'training_type': row.training_type,
                'is_virtual': False,
                'created_at': row.created_at.isoformat() if row.created_at else None,
            })

        # Create lookup for materialized sessions
        materialized_lookup = {}
        for session in materialized_sessions:
            session_start = datetime.fromisoformat(session['start_date'].replace('Z', '+00:00'))

            session_date = session_start.date().isoformat()
            key = f"{session['squad_id']}_{session_date}"

            if key not in materialized_lookup:
                materialized_lookup[key] = []
            materialized_lookup[key].append(session)

        # Fetch active schedules for squad
        sched_result = await db.execute(
            select(TrainingSchedule)
            .where(
                and_(
                    TrainingSchedule.squad_id == squad_id,
                    TrainingSchedule.active == True,
                )
            )
        )
        schedule_rows = sched_result.scalars().all()

        schedules = []
        for row in schedule_rows:
            schedules.append({
                'id': str(row.id),
                'squad_id': str(row.squad_id),
                'day_of_week': row.day_of_week,
                'start_time': row.start_time.strftime('%H:%M') if row.start_time else None,
                'end_time': row.end_time.strftime('%H:%M') if row.end_time else None,
                'training_type': row.training_type,
                'active': row.active,
                'timezone': row.timezone,
                'created_at': row.created_at.isoformat() if row.created_at else None,
            })

        if not schedules:
            # No schedules, return only materialized sessions
            return {
                'success': True,
                'sessions': materialized_sessions,
                'count': len(materialized_sessions)
            }

        # Calculate virtual sessions from schedules
        virtual_sessions = []
        current_date = start_dt.date()
        end_date_obj = end_dt.date()

        while current_date <= end_date_obj:
            # Convert Python weekday (0=Mon, 6=Sun) to JS day convention (0=Sun, 1=Mon, 6=Sat)
            python_weekday = current_date.weekday()
            js_day = (python_weekday + 1) % 7

            # Find schedules for this day
            for schedule in schedules:
                if schedule['day_of_week'] == js_day:
                    # Get timezone from schedule
                    tz_name = schedule.get('timezone', 'America/Denver') or 'America/Denver'
                    local_tz = pytz.timezone(tz_name)

                    # Create naive local datetime for this day + local start time
                    local_start_parts = schedule['start_time'].split(':')
                    local_end_parts = schedule['end_time'].split(':')

                    naive_local_start = datetime(
                        current_date.year,
                        current_date.month,
                        current_date.day,
                        int(local_start_parts[0]),
                        int(local_start_parts[1]),
                        0
                    )

                    naive_local_end = datetime(
                        current_date.year,
                        current_date.month,
                        current_date.day,
                        int(local_end_parts[0]),
                        int(local_end_parts[1]),
                        0
                    )

                    # Localize to the timezone and convert to UTC
                    session_start = local_tz.localize(naive_local_start).astimezone(pytz.UTC)
                    session_end = local_tz.localize(naive_local_end).astimezone(pytz.UTC)

                    # Handle cases where end time is past midnight (next day in local time)
                    if session_end <= session_start:
                        session_end += timedelta(days=1)

                    # Check if this session time already exists in materialized sessions
                    # Use local date (not UTC) so a 10pm local session isn't treated as the next day
                    local_session_start = session_start.astimezone(local_tz)
                    local_date = local_session_start.date().isoformat()
                    lookup_key = f"{squad_id}_{local_date}"

                    # Check if already materialized by comparing times
                    already_materialized = False
                    if lookup_key in materialized_lookup:
                        for mat_session in materialized_lookup[lookup_key]:
                            mat_start = datetime.fromisoformat(mat_session['start_date'].replace('Z', '+00:00'))
                            # If start times match within 1 minute, consider it the same session
                            if abs((mat_start - session_start).total_seconds()) < 60:
                                already_materialized = True
                                break

                    if not already_materialized:
                        virtual_session = {
                            'id': f"virtual_{squad_id}_{session_start.isoformat()}",
                            'squad_id': squad_id,
                            'start_date': session_start.isoformat(),
                            'end_date': session_end.isoformat(),
                            'workout_id': None,
                            'training_type': schedule['training_type'],
                            'created_at': None,
                            'is_virtual': True,
                            'schedule_id': schedule['id']
                        }

                        virtual_sessions.append(virtual_session)

            current_date += timedelta(days=1)

        # Merge and sort all sessions
        all_sessions = materialized_sessions + virtual_sessions
        all_sessions.sort(key=lambda x: x['start_date'])

        logger.info(f"Returning {len(materialized_sessions)} materialized + {len(virtual_sessions)} virtual = {len(all_sessions)} total sessions")

        return {
            'success': True,
            'sessions': all_sessions,
            'count': len(all_sessions),
            'materialized_count': len(materialized_sessions),
            'virtual_count': len(virtual_sessions)
        }

    except Exception as e:
        logger.error(f"Error fetching virtual sessions: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/materialize")
async def materialize_virtual_session(
    request: MaterializeSessionRequest,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    """
    Materialize a virtual session into a real database record.

    Called when:
    - Coach assigns a workout to virtual session
    - Coach takes attendance for virtual session
    - Any action that requires a real session ID
    """
    membership = await get_coach_membership(db, user_id, request.squad_id)
    if not membership.can_manage_schedules:
        raise UnauthorizedError("Missing permission: can_manage_schedules")
    try:
        session = await materialize_session(
            squad_id=request.squad_id,
            start_date=request.start_date,
            end_date=request.end_date,
            training_type=request.training_type,
            workout_id=request.workout_id,
            db=db,
        )

        return {
            'success': True,
            'session': session
        }

    except Exception as e:
        logger.error(f"Error materializing session: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/virtual-cleanup")
async def cleanup_virtual(
    request: CleanupRequest,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    """
    Clean up future non-materialized sessions.

    Called when a schedule is updated to force recalculation of future sessions.
    Deletes sessions that have no workout and no attendance.
    """
    membership = await get_coach_membership(db, user_id, request.squad_id)
    if not membership.can_manage_schedules:
        raise UnauthorizedError("Missing permission: can_manage_schedules")
    try:
        deleted_count = await cleanup_virtual_sessions(
            squad_id=request.squad_id,
            schedule_id=request.schedule_id,
            db=db,
        )

        return {
            'success': True,
            'deleted_count': deleted_count
        }

    except Exception as e:
        logger.error(f"Error cleaning up virtual sessions: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


# ── Session CRUD ──────────────────────────────────────────

@router.post("/sessions")
async def create_session(
    body: SessionCreate,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    """Create or upsert a training session."""
    membership = await get_coach_membership(db, user_id, body.squad_id)
    if not membership.can_manage_schedules:
        raise UnauthorizedError("Missing permission: can_manage_schedules")

    # Parse date strings to proper datetime objects
    parsed_start = _parse_iso_datetime(body.start_date)
    parsed_end = _parse_iso_datetime(body.end_date)

    # Check if a session already exists at this time for the squad
    if parsed_start:
        existing_result = await db.execute(
            select(TrainingSession).where(
                and_(
                    TrainingSession.squad_id == body.squad_id,
                    TrainingSession.start_date == parsed_start,
                )
            )
        )
        existing = existing_result.scalar_one_or_none()
        if existing:
            # Upsert: update existing session
            if parsed_end is not None:
                existing.end_date = parsed_end
            if body.training_type is not None:
                existing.training_type = body.training_type
            if body.workout_id is not None:
                existing.workout_id = body.workout_id
            await db.commit()
            await db.refresh(existing)
            return _row_to_dict(existing)

    session = TrainingSession(
        squad_id=body.squad_id,
        start_date=parsed_start,
        end_date=parsed_end,
        training_type=body.training_type,
        workout_id=body.workout_id,
    )
    db.add(session)
    await db.commit()
    await db.refresh(session)
    return _row_to_dict(session)


@router.put("/sessions/{session_id}")
async def update_session(
    session_id: str,
    body: SessionUpdate,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    """Update a training session."""
    result = await db.execute(
        select(TrainingSession).where(TrainingSession.id == session_id)
    )
    session = result.scalar_one_or_none()
    if not session:
        raise HTTPException(status_code=404, detail="Training session not found")

    membership = await get_coach_membership(db, user_id, str(session.squad_id))
    if not membership.can_manage_schedules:
        raise UnauthorizedError("Missing permission: can_manage_schedules")

    if body.squad_id is not None:
        session.squad_id = body.squad_id
    if body.start_date is not None:
        session.start_date = _parse_iso_datetime(body.start_date)
    if body.end_date is not None:
        session.end_date = _parse_iso_datetime(body.end_date)
    if body.training_type is not None:
        session.training_type = body.training_type
    if body.workout_id is not None:
        session.workout_id = body.workout_id

    await db.commit()
    await db.refresh(session)
    return _row_to_dict(session)


@router.delete("/sessions/{session_id}")
async def delete_session(
    session_id: str,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    """Delete a training session."""
    result = await db.execute(
        select(TrainingSession).where(TrainingSession.id == session_id)
    )
    session = result.scalar_one_or_none()
    if not session:
        raise HTTPException(status_code=404, detail="Training session not found")

    membership = await get_coach_membership(db, user_id, str(session.squad_id))
    if not membership.can_manage_schedules:
        raise UnauthorizedError("Missing permission: can_manage_schedules")

    await db.delete(session)
    await db.commit()
    return {"success": True}
