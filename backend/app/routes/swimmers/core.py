"""Core swimmer routes - CRUD operations."""
from fastapi import APIRouter, HTTPException, Query, BackgroundTasks, Depends
from pydantic import BaseModel
from typing import Optional, Dict, Any, List
from datetime import datetime, timedelta
from collections import defaultdict

from sqlalchemy import select, and_, func, extract
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.services.swimmer_service import SwimmerService
from app.middleware.auth import get_current_user_id
from app.middleware.authorization import get_coach_membership
from app.domain.exceptions import UnauthorizedError
from app.infrastructure.db import get_db
from app.infrastructure.models import (
    Swimmer, SwimmerExternalLink, WorkoutResult,
    TrainingAttendance, TrainingSession,
)
from app.utils import logger, log_error

from .models import (
    CreateSwimmerWithLinkRequest,
    CreateSwimmerWithLinkResponse
)
from .error_handlers import handle_service_error

router = APIRouter()


# ── Request Models ────────────────────────────────────────

class SimpleSwimmerCreate(BaseModel):
    first_name: str
    last_name: str
    date_of_birth: Optional[str] = None
    sex: Optional[str] = None
    squad_id: Optional[str] = None


class SwimmerUpdate(BaseModel):
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    date_of_birth: Optional[str] = None
    sex: Optional[str] = None
    squad_id: Optional[str] = None


def _row_to_dict(row) -> dict:
    d = {}
    for col in row.__table__.columns:
        val = getattr(row, col.name)
        if hasattr(val, 'hex'):
            val = str(val)
        d[col.name] = val
    return d


@router.get("/")
async def list_swimmers(
    squad_id: Optional[str] = Query(None),
    include_stats: bool = Query(False),
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db)
) -> List[Dict[str, Any]]:
    """Get all swimmers for the authenticated user."""
    try:
        swimmer_service = SwimmerService()

        if squad_id:
            await get_coach_membership(db, user_id, squad_id)
            result = await db.execute(
                select(Swimmer).where(Swimmer.squad_id == squad_id)
            )
            swimmer_rows = result.scalars().all()
            swimmers = [
                {
                    'id': str(s.id),
                    'first_name': s.first_name,
                    'last_name': s.last_name,
                    'date_of_birth': s.date_of_birth.isoformat() if s.date_of_birth else None,
                    'sex': s.sex,
                    'created_at': s.created_at.isoformat() if s.created_at else None,
                    'squad_id': str(s.squad_id) if s.squad_id else None,
                }
                for s in swimmer_rows
            ]
        else:
            swimmers = swimmer_service.get_swimmers_for_user(user_id)

        if include_stats and swimmers:
            swimmers = await _enrich_swimmers_with_stats(db, swimmers)

        return swimmers
    except Exception as e:
        raise handle_service_error(e)


@router.get("/{swimmer_id}")
async def get_swimmer(
    swimmer_id: int,
    include_external_link: bool = Query(False),
    user_id: str = Depends(get_current_user_id)
) -> Dict[str, Any]:
    """Get a specific swimmer by ID."""
    try:
        swimmer_service = SwimmerService()
        swimmer = swimmer_service.get_swimmer(
            swimmer_id,
            user_id=user_id,
            include_external_link=include_external_link
        )
        return swimmer
    except Exception as e:
        raise handle_service_error(e)


@router.get("/{swimmer_id}/enhanced")
async def get_swimmer_enhanced(
    swimmer_id: int,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db)
) -> Dict[str, Any]:
    """Get swimmer with enhanced stats."""
    try:
        swimmer_service = SwimmerService()

        swimmer = swimmer_service.get_swimmer(
            swimmer_id, user_id=user_id, include_external_link=True
        )

        # Verify squad membership for this swimmer
        if swimmer.get("squad_id"):
            await get_coach_membership(db, user_id, str(swimmer["squad_id"]))

        # Get last activity
        last_activity_result = await db.execute(
            select(WorkoutResult.created_at)
            .where(WorkoutResult.swimmer_id == swimmer_id)
            .order_by(WorkoutResult.created_at.desc())
            .limit(1)
        )
        last_activity_row = last_activity_result.scalar_one_or_none()

        last_activity = (
            last_activity_row.isoformat()
            if last_activity_row else None
        )

        # Get attendance rate
        thirty_days_ago = datetime.now() - timedelta(days=30)
        attendance_result = await db.execute(
            select(TrainingAttendance.status)
            .where(
                and_(
                    TrainingAttendance.swimmer_id == swimmer_id,
                    TrainingAttendance.created_at >= thirty_days_ago
                )
            )
        )
        attendance_rows = attendance_result.all()

        attendance_rate = _calculate_attendance_rate(attendance_rows)

        swimmer.update({
            'last_activity': last_activity,
            'recent_pr_count': 0,
            'attendance_rate': round(attendance_rate, 1),
            'has_external_tracking': swimmer.get('external_link') is not None
        })

        return swimmer
    except Exception as e:
        raise handle_service_error(e)


@router.post("/with-external-link", response_model=CreateSwimmerWithLinkResponse)
async def create_swimmer_with_external_link(
    request: CreateSwimmerWithLinkRequest,
    background_tasks: BackgroundTasks,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db)
):
    """Create a swimmer with an external platform link."""
    logger.info(
        f"Creating swimmer: {request.swimmer.first_name} {request.swimmer.last_name}"
    )

    try:
        # Verify permissions
        membership = await get_coach_membership(db, user_id, request.swimmer.squad_id)
        if not membership.can_manage_swimmers:
            raise UnauthorizedError("Missing permission: can_manage_swimmers")

        # Check for duplicate external athlete ID
        existing_link = await db.execute(
            select(SwimmerExternalLink).where(
                SwimmerExternalLink.external_athlete_id == request.external_link.external_id
            )
        )
        if existing_link.scalar_one_or_none():
            raise HTTPException(
                status_code=409,
                detail=f"Athlete ID {request.external_link.external_id} is already linked to another swimmer"
            )

        # Create swimmer
        swimmer_id = await _create_swimmer_record(db, request.swimmer)
        logger.info(f"Created swimmer {swimmer_id}")

        # Create external link
        external_link_id = await _create_external_link_record(
            db, swimmer_id, request.external_link, user_id
        )
        logger.info(f"Created external link {external_link_id}")

        await db.commit()

        # Start sync if requested
        sync_started = False
        if request.auto_sync and request.external_link.platform == 'swimrankings':
            sync_started = _enqueue_sync_task(
                swimmer_id, external_link_id, request.external_link.external_id
            )

        return CreateSwimmerWithLinkResponse(
            swimmer_id=swimmer_id,
            external_link_id=external_link_id,
            sync_started=sync_started,
            message=(
                f"Swimmer created successfully"
                f"{' and data import started' if sync_started else ''}"
            )
        )

    except HTTPException:
        raise
    except Exception as e:
        log_error(e, context="create_swimmer_with_external_link")
        raise HTTPException(
            status_code=500,
            detail="Failed to create swimmer with external link"
        )


# === Helper Functions ===

async def _enrich_swimmers_with_stats(
    db: AsyncSession, swimmers: List[Dict[str, Any]]
) -> List[Dict[str, Any]]:
    """Enrich swimmers with statistics."""
    thirty_days_ago = datetime.now() - timedelta(days=30)
    swimmer_ids = [s['id'] for s in swimmers]

    # Batch get last activities
    last_activities_result = await db.execute(
        select(WorkoutResult.swimmer_id, WorkoutResult.created_at)
        .where(WorkoutResult.swimmer_id.in_(swimmer_ids))
        .order_by(WorkoutResult.created_at.desc())
    )
    last_activities_rows = last_activities_result.all()

    last_activities = {}
    for row in last_activities_rows:
        sid = str(row.swimmer_id)
        if sid not in last_activities:
            last_activities[sid] = row.created_at.isoformat() if row.created_at else None

    # Batch get attendance
    attendance_result = await db.execute(
        select(TrainingAttendance.swimmer_id, TrainingAttendance.status)
        .where(
            and_(
                TrainingAttendance.swimmer_id.in_(swimmer_ids),
                TrainingAttendance.created_at >= thirty_days_ago
            )
        )
    )
    attendance_rows = attendance_result.all()

    attendance_rates = {}
    for sid in swimmer_ids:
        swimmer_attendance = [
            a for a in attendance_rows
            if str(a.swimmer_id) == sid
        ]
        if swimmer_attendance:
            total = len(swimmer_attendance)
            present = sum(
                1 for a in swimmer_attendance
                if a.status and a.status.lower() == 'present'
            )
            attendance_rates[sid] = round((present / total * 100), 1) if total > 0 else 0
        else:
            attendance_rates[sid] = 0

    # Check for external tracking
    external_links_result = await db.execute(
        select(SwimmerExternalLink.swimmer_id)
        .where(SwimmerExternalLink.swimmer_id.in_(swimmer_ids))
    )
    has_tracking = {str(row.swimmer_id) for row in external_links_result.all()}

    # Enhance swimmers
    for swimmer in swimmers:
        sid = swimmer['id']
        swimmer['last_activity'] = last_activities.get(sid)
        swimmer['recent_pr_count'] = 0
        swimmer['attendance_rate'] = attendance_rates.get(sid, 0)
        swimmer['has_external_tracking'] = sid in has_tracking

    return swimmers


def _calculate_attendance_rate(attendance_rows: list) -> float:
    """Calculate attendance rate from attendance records."""
    if not attendance_rows:
        return 0.0

    total_sessions = len(attendance_rows)
    present_sessions = sum(
        1 for a in attendance_rows
        if a.status and a.status.lower() == 'present'
    )
    return (present_sessions / total_sessions * 100) if total_sessions > 0 else 0.0


async def _create_swimmer_record(db: AsyncSession, swimmer_data) -> str:
    """Create swimmer database record."""
    new_swimmer = Swimmer(
        first_name=swimmer_data.first_name,
        last_name=swimmer_data.last_name,
        sex=swimmer_data.sex,
        date_of_birth=swimmer_data.date_of_birth,
        squad_id=swimmer_data.squad_id,
    )
    db.add(new_swimmer)
    await db.flush()

    return str(new_swimmer.id)


async def _create_external_link_record(
    db: AsyncSession,
    swimmer_id: str,
    link_data,
    user_id: str
) -> str:
    """Create external link database record."""
    new_link = SwimmerExternalLink(
        swimmer_id=swimmer_id,
        external_source=link_data.platform,
        external_athlete_id=link_data.external_id,
        sync_status='pending',
    )
    db.add(new_link)
    await db.flush()

    return str(new_link.id)


def _enqueue_sync_task(
    swimmer_id: str,
    external_link_id: str,
    external_id: str
) -> bool:
    """Enqueue background sync task."""
    try:
        from app.celery_app import celery_app

        task = celery_app.send_task(
            'worker.sync_tasks.sync_swimmer_task',
            kwargs={
                'swimmer_id': swimmer_id,
                'external_link_id': external_link_id,
                'external_id': external_id,
            }
        )

        logger.info(f"Enqueued sync task {task.id} for swimmer {swimmer_id}")
        return True

    except Exception as e:
        logger.error(f"Failed to enqueue sync task: {e}")
        log_error(e, context="start_background_sync", swimmer_id=swimmer_id)
        return False


# ── New CRUD / Info Endpoints ─────────────────────────────

@router.post("/create")
async def create_simple_swimmer(
    body: SimpleSwimmerCreate,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    """Create a simple swimmer without external link."""
    if body.squad_id:
        membership = await get_coach_membership(db, user_id, body.squad_id)
        if not membership.can_manage_swimmers:
            raise UnauthorizedError("Missing permission: can_manage_swimmers")

    swimmer = Swimmer(
        first_name=body.first_name,
        last_name=body.last_name,
        date_of_birth=body.date_of_birth,
        sex=body.sex,
        squad_id=body.squad_id,
    )
    db.add(swimmer)
    await db.commit()
    await db.refresh(swimmer)
    return _row_to_dict(swimmer)


@router.put("/{swimmer_id}/update")
async def update_swimmer(
    swimmer_id: str,
    body: SwimmerUpdate,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    """Update a swimmer."""
    result = await db.execute(
        select(Swimmer).where(Swimmer.id == swimmer_id)
    )
    swimmer = result.scalar_one_or_none()
    if not swimmer:
        raise HTTPException(status_code=404, detail="Swimmer not found")

    if swimmer.squad_id:
        membership = await get_coach_membership(db, user_id, str(swimmer.squad_id))
        if not membership.can_manage_swimmers:
            raise UnauthorizedError("Missing permission: can_manage_swimmers")

    if body.first_name is not None:
        swimmer.first_name = body.first_name
    if body.last_name is not None:
        swimmer.last_name = body.last_name
    if body.date_of_birth is not None:
        swimmer.date_of_birth = body.date_of_birth
    if body.sex is not None:
        swimmer.sex = body.sex
    if body.squad_id is not None:
        swimmer.squad_id = body.squad_id

    await db.commit()
    await db.refresh(swimmer)
    return _row_to_dict(swimmer)


@router.delete("/{swimmer_id}/delete")
async def delete_swimmer(
    swimmer_id: str,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    """Delete a swimmer."""
    result = await db.execute(
        select(Swimmer).where(Swimmer.id == swimmer_id)
    )
    swimmer = result.scalar_one_or_none()
    if not swimmer:
        raise HTTPException(status_code=404, detail="Swimmer not found")

    if swimmer.squad_id:
        membership = await get_coach_membership(db, user_id, str(swimmer.squad_id))
        if not membership.can_manage_swimmers:
            raise UnauthorizedError("Missing permission: can_manage_swimmers")

    await db.delete(swimmer)
    await db.commit()
    return {"success": True}


@router.get("/{swimmer_id}/basic-info")
async def get_swimmer_basic_info(
    swimmer_id: str,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    """Get swimmer with external links (eager load)."""
    result = await db.execute(
        select(Swimmer)
        .options(selectinload(Swimmer.external_links))
        .where(Swimmer.id == swimmer_id)
    )
    swimmer = result.scalar_one_or_none()
    if not swimmer:
        raise HTTPException(status_code=404, detail="Swimmer not found")

    if swimmer.squad_id:
        await get_coach_membership(db, user_id, str(swimmer.squad_id))

    d = _row_to_dict(swimmer)
    d["external_links"] = [_row_to_dict(link) for link in swimmer.external_links]
    return d


@router.get("/sync-status/{link_id}")
async def get_sync_status(
    link_id: str,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    """Get sync status for an external link."""
    result = await db.execute(
        select(SwimmerExternalLink).where(SwimmerExternalLink.id == link_id)
    )
    link = result.scalar_one_or_none()
    if not link:
        raise HTTPException(status_code=404, detail="External link not found")

    # Verify squad membership via external link -> swimmer -> squad
    swimmer_result = await db.execute(
        select(Swimmer).where(Swimmer.id == link.swimmer_id)
    )
    swimmer = swimmer_result.scalar_one_or_none()
    if swimmer and swimmer.squad_id:
        await get_coach_membership(db, user_id, str(swimmer.squad_id))

    return _row_to_dict(link)


@router.get("/{swimmer_id}/attendance-stats")
async def get_swimmer_attendance_stats(
    swimmer_id: str,
    from_date: Optional[str] = Query(None),
    to_date: Optional[str] = Query(None),
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    """Get attendance stats for a swimmer. Returns {present, late, absent}."""
    swimmer_result = await db.execute(
        select(Swimmer).where(Swimmer.id == swimmer_id)
    )
    swimmer = swimmer_result.scalar_one_or_none()
    if not swimmer:
        raise HTTPException(status_code=404, detail="Swimmer not found")
    if swimmer.squad_id:
        await get_coach_membership(db, user_id, str(swimmer.squad_id))

    stmt = select(TrainingAttendance.status).where(
        TrainingAttendance.swimmer_id == swimmer_id
    )
    if from_date:
        stmt = stmt.where(TrainingAttendance.created_at >= datetime.fromisoformat(from_date.replace("Z", "+00:00")))
    if to_date:
        stmt = stmt.where(TrainingAttendance.created_at <= datetime.fromisoformat(to_date.replace("Z", "+00:00")))

    result = await db.execute(stmt)
    rows = result.scalars().all()

    present = sum(1 for s in rows if s and s.lower() == "present")
    late = sum(1 for s in rows if s and s.lower() == "late")
    absent = sum(1 for s in rows if s and s.lower() == "absent")

    return {"present": present, "late": late, "absent": absent}


@router.get("/{swimmer_id}/sessions-per-week")
async def get_swimmer_sessions_per_week(
    swimmer_id: str,
    from_date: Optional[str] = Query(None),
    to_date: Optional[str] = Query(None),
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    """Get weekly session counts for a swimmer based on attendance records."""
    swimmer_result = await db.execute(
        select(Swimmer).where(Swimmer.id == swimmer_id)
    )
    swimmer = swimmer_result.scalar_one_or_none()
    if not swimmer:
        raise HTTPException(status_code=404, detail="Swimmer not found")
    if swimmer.squad_id:
        await get_coach_membership(db, user_id, str(swimmer.squad_id))

    stmt = (
        select(TrainingAttendance)
        .where(
            and_(
                TrainingAttendance.swimmer_id == swimmer_id,
                TrainingAttendance.status.in_(["present", "late"]),
            )
        )
    )
    if from_date:
        stmt = stmt.where(TrainingAttendance.created_at >= datetime.fromisoformat(from_date.replace("Z", "+00:00")))
    if to_date:
        stmt = stmt.where(TrainingAttendance.created_at <= datetime.fromisoformat(to_date.replace("Z", "+00:00")))

    result = await db.execute(stmt)
    records = result.scalars().all()

    # Group by ISO week
    weekly_counts: Dict[str, int] = defaultdict(int)
    for rec in records:
        if rec.created_at:
            iso_year, iso_week, _ = rec.created_at.isocalendar()
            week_key = f"{iso_year}-W{iso_week:02d}"
            weekly_counts[week_key] += 1

    # Return sorted list
    return [
        {"week": k, "sessions": v}
        for k, v in sorted(weekly_counts.items())
    ]


@router.get("/count")
async def get_swimmer_count(
    squad_id: str = Query(...),
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    """Get swimmer count for a squad."""
    await get_coach_membership(db, user_id, squad_id)

    result = await db.execute(
        select(func.count(Swimmer.id)).where(Swimmer.squad_id == squad_id)
    )
    count = result.scalar() or 0
    return {"count": count}
