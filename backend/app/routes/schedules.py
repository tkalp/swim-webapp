"""Training schedules API routes — replaces frontend direct Supabase calls."""
from datetime import time as time_type
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from typing import Optional
from sqlalchemy import select, and_
from sqlalchemy.ext.asyncio import AsyncSession

from app.infrastructure.db import get_db
from app.infrastructure.models import TrainingSchedule
from app.middleware.auth import get_current_user_id
from app.middleware.authorization import get_coach_membership
from app.domain.exceptions import UnauthorizedError

router = APIRouter(prefix="/training-schedules", tags=["training-schedules"])


# ── Request Models ────────────────────────────────────────

class ScheduleCreate(BaseModel):
    squad_id: str
    day_of_week: int
    start_time: Optional[str] = None
    end_time: Optional[str] = None
    training_type: Optional[str] = None
    active: bool = True
    timezone: Optional[str] = None


class ScheduleUpdate(BaseModel):
    day_of_week: Optional[int] = None
    start_time: Optional[str] = None
    end_time: Optional[str] = None
    training_type: Optional[str] = None
    active: Optional[bool] = None
    timezone: Optional[str] = None


# ── Helpers ───────────────────────────────────────────────

def _parse_time(value: Optional[str]) -> Optional[time_type]:
    """Parse a time string like '18:00' or '18:00:00' into a time object."""
    if not value:
        return None
    parts = value.split(':')
    return time_type(int(parts[0]), int(parts[1]), int(parts[2]) if len(parts) > 2 else 0)


def _row_to_dict(row) -> dict:
    d = {}
    for col in row.__table__.columns:
        val = getattr(row, col.name)
        if hasattr(val, 'hex'):
            val = str(val)
        elif isinstance(val, time_type):
            val = val.strftime('%H:%M')
        d[col.name] = val
    return d


# ── Endpoints ─────────────────────────────────────────────

@router.get("")
async def list_schedules(
    squad_id: str = Query(...),
    active_only: bool = Query(False),
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    """List training schedules for a squad."""
    await get_coach_membership(db, user_id, squad_id)
    stmt = select(TrainingSchedule).where(TrainingSchedule.squad_id == squad_id)

    if active_only:
        stmt = stmt.where(TrainingSchedule.active == True)

    stmt = stmt.order_by(TrainingSchedule.day_of_week)

    result = await db.execute(stmt)
    schedules = result.scalars().all()
    return [_row_to_dict(s) for s in schedules]


@router.post("")
async def create_schedule(
    body: ScheduleCreate,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    """Create a training schedule."""
    membership = await get_coach_membership(db, user_id, body.squad_id)
    if not membership.can_manage_schedules:
        raise UnauthorizedError("Missing permission: can_manage_schedules")

    schedule = TrainingSchedule(
        squad_id=body.squad_id,
        day_of_week=body.day_of_week,
        start_time=_parse_time(body.start_time),
        end_time=_parse_time(body.end_time),
        training_type=body.training_type,
        active=body.active,
        timezone=body.timezone,
    )
    db.add(schedule)
    await db.commit()
    await db.refresh(schedule)
    return _row_to_dict(schedule)


@router.put("/{schedule_id}")
async def update_schedule(
    schedule_id: str,
    body: ScheduleUpdate,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    """Update a training schedule."""
    result = await db.execute(
        select(TrainingSchedule).where(TrainingSchedule.id == schedule_id)
    )
    schedule = result.scalar_one_or_none()
    if not schedule:
        raise HTTPException(status_code=404, detail="Schedule not found")

    membership = await get_coach_membership(db, user_id, str(schedule.squad_id))
    if not membership.can_manage_schedules:
        raise UnauthorizedError("Missing permission: can_manage_schedules")

    if body.day_of_week is not None:
        schedule.day_of_week = body.day_of_week
    if body.start_time is not None:
        schedule.start_time = _parse_time(body.start_time)
    if body.end_time is not None:
        schedule.end_time = _parse_time(body.end_time)
    if body.training_type is not None:
        schedule.training_type = body.training_type
    if body.active is not None:
        schedule.active = body.active
    if body.timezone is not None:
        schedule.timezone = body.timezone

    await db.commit()
    await db.refresh(schedule)
    return _row_to_dict(schedule)


@router.delete("/{schedule_id}")
async def delete_schedule(
    schedule_id: str,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    """Delete a training schedule."""
    result = await db.execute(
        select(TrainingSchedule).where(TrainingSchedule.id == schedule_id)
    )
    schedule = result.scalar_one_or_none()
    if not schedule:
        raise HTTPException(status_code=404, detail="Schedule not found")

    membership = await get_coach_membership(db, user_id, str(schedule.squad_id))
    if not membership.can_manage_schedules:
        raise UnauthorizedError("Missing permission: can_manage_schedules")

    await db.delete(schedule)
    await db.commit()
    return {"success": True}
