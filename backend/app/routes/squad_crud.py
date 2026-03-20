"""Squad CRUD API routes — replaces frontend direct Supabase calls."""
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime
from sqlalchemy import select, func, and_
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.infrastructure.db import get_db
from app.infrastructure.models import (
    Squad, CoachSquad, Swimmer, TrainingSchedule,
    TrainingSession, WorkoutTemplate, CalendarEvent,
)
from app.middleware.auth import get_current_user_id
from app.middleware.authorization import get_coach_membership
from app.domain.exceptions import UnauthorizedError

router = APIRouter(prefix="/squads", tags=["squad-crud"])


# ── Request / Response Models ─────────────────────────────

class SquadCreate(BaseModel):
    name: str
    description: Optional[str] = None
    coach_id: str


class SquadUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None


# ── Helpers ───────────────────────────────────────────────

def _row_to_dict(row) -> dict:
    d = {}
    for col in row.__table__.columns:
        val = getattr(row, col.name)
        if hasattr(val, 'hex'):
            val = str(val)
        d[col.name] = val
    return d


# ── Endpoints ─────────────────────────────────────────────

@router.get("")
async def list_squads(
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    """List squads for authenticated coach. Joins CoachSquad for role, counts swimmers."""
    from app.infrastructure.models import Coach

    # Look up the coach record for this user (user_id != coach_id)
    coach_result = await db.execute(
        select(Coach).where(Coach.user_id == user_id)
    )
    coach = coach_result.scalar_one_or_none()
    if not coach:
        return []

    # Get squads the coach belongs to via coach_squads
    swimmer_count_subq = (
        select(func.count(Swimmer.id))
        .where(Swimmer.squad_id == Squad.id)
        .correlate(Squad)
        .scalar_subquery()
    )

    result = await db.execute(
        select(
            Squad.id,
            Squad.name,
            Squad.description,
            Squad.created_at,
            CoachSquad.role,
            swimmer_count_subq.label("swimmers_count"),
        )
        .join(CoachSquad, CoachSquad.squad_id == Squad.id)
        .where(CoachSquad.coach_id == coach.id)
    )
    rows = result.all()

    return [
        {
            "id": str(row.id),
            "name": row.name,
            "description": row.description,
            "created_at": row.created_at.isoformat() if row.created_at else None,
            "role": row.role,
            "swimmers_count": row.swimmers_count or 0,
        }
        for row in rows
    ]


@router.get("/{squad_id}")
async def get_squad(
    squad_id: str,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    """Get single squad by ID."""
    await get_coach_membership(db, user_id, squad_id)
    result = await db.execute(
        select(Squad).where(Squad.id == squad_id)
    )
    squad = result.scalar_one_or_none()
    if not squad:
        raise HTTPException(status_code=404, detail="Squad not found")
    return _row_to_dict(squad)


@router.post("")
async def create_squad(
    body: SquadCreate,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    """Create squad and CoachSquad membership with role='owner'."""
    squad = Squad(
        name=body.name,
        description=body.description,
        coach_id=body.coach_id,
    )
    db.add(squad)
    await db.flush()

    membership = CoachSquad(
        coach_id=body.coach_id,
        squad_id=squad.id,
        role="owner",
    )
    db.add(membership)
    await db.commit()
    await db.refresh(squad)
    return _row_to_dict(squad)


@router.put("/{squad_id}")
async def update_squad(
    squad_id: str,
    body: SquadUpdate,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    """Update squad."""
    membership = await get_coach_membership(db, user_id, squad_id)
    if not membership.can_manage_squad_settings:
        raise UnauthorizedError("Missing permission: can_manage_squad_settings")
    result = await db.execute(
        select(Squad).where(Squad.id == squad_id)
    )
    squad = result.scalar_one_or_none()
    if not squad:
        raise HTTPException(status_code=404, detail="Squad not found")

    if body.name is not None:
        squad.name = body.name
    if body.description is not None:
        squad.description = body.description

    await db.commit()
    await db.refresh(squad)
    return _row_to_dict(squad)


@router.delete("/{squad_id}")
async def delete_squad(
    squad_id: str,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    """Delete squad. First delete CoachSquad memberships, then squad."""
    membership = await get_coach_membership(db, user_id, squad_id)
    if membership.role != "owner":
        raise UnauthorizedError("Only the squad owner can delete the squad")
    result = await db.execute(
        select(Squad).where(Squad.id == squad_id)
    )
    squad = result.scalar_one_or_none()
    if not squad:
        raise HTTPException(status_code=404, detail="Squad not found")

    # Delete memberships first
    memberships_result = await db.execute(
        select(CoachSquad).where(CoachSquad.squad_id == squad_id)
    )
    for membership in memberships_result.scalars().all():
        await db.delete(membership)

    await db.delete(squad)
    await db.commit()
    return {"success": True}


@router.get("/{squad_id}/swimmers")
async def list_squad_swimmers(
    squad_id: str,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    """List swimmers in squad ordered by last_name."""
    await get_coach_membership(db, user_id, squad_id)
    result = await db.execute(
        select(Swimmer)
        .where(Swimmer.squad_id == squad_id)
        .order_by(Swimmer.last_name)
    )
    swimmers = result.scalars().all()
    return [_row_to_dict(s) for s in swimmers]


@router.get("/{squad_id}/schedules")
async def list_squad_schedules(
    squad_id: str,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    """List active training schedules, ordered by day_of_week."""
    await get_coach_membership(db, user_id, squad_id)
    result = await db.execute(
        select(TrainingSchedule)
        .where(
            and_(
                TrainingSchedule.squad_id == squad_id,
                TrainingSchedule.active == True,
            )
        )
        .order_by(TrainingSchedule.day_of_week)
    )
    schedules = result.scalars().all()
    return [_row_to_dict(s) for s in schedules]


@router.get("/{squad_id}/sessions")
async def list_squad_sessions(
    squad_id: str,
    from_date: Optional[str] = Query(None),
    to_date: Optional[str] = Query(None),
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    """List training sessions. Join WorkoutTemplate for workout name. Order by start_date desc."""
    await get_coach_membership(db, user_id, squad_id)
    stmt = (
        select(TrainingSession, WorkoutTemplate.name.label("workout_name"))
        .outerjoin(WorkoutTemplate, TrainingSession.workout_id == WorkoutTemplate.id)
        .where(TrainingSession.squad_id == squad_id)
    )

    if from_date:
        stmt = stmt.where(TrainingSession.start_date >= datetime.fromisoformat(from_date.replace("Z", "+00:00")))
    if to_date:
        stmt = stmt.where(TrainingSession.start_date <= datetime.fromisoformat(to_date.replace("Z", "+00:00")))

    stmt = stmt.order_by(TrainingSession.start_date.desc())

    result = await db.execute(stmt)
    rows = result.all()

    sessions = []
    for row in rows:
        session = row[0]
        workout_name = row[1]
        d = _row_to_dict(session)
        d["workout_name"] = workout_name
        sessions.append(d)

    return sessions


@router.get("/{squad_id}/calendar-events")
async def list_squad_calendar_events(
    squad_id: str,
    from_date: Optional[str] = Query(None),
    to_date: Optional[str] = Query(None),
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    """List calendar events for squad within date range."""
    await get_coach_membership(db, user_id, squad_id)
    stmt = select(CalendarEvent).where(CalendarEvent.squad_id == squad_id)

    if from_date:
        stmt = stmt.where(CalendarEvent.start_date >= datetime.fromisoformat(from_date.replace("Z", "+00:00")))
    if to_date:
        stmt = stmt.where(CalendarEvent.end_date <= datetime.fromisoformat(to_date.replace("Z", "+00:00")))

    result = await db.execute(stmt)
    events = result.scalars().all()
    return [_row_to_dict(e) for e in events]
