"""Workout results API routes — replaces frontend direct Supabase calls."""
from fastapi import APIRouter, Depends, HTTPException, Query
from typing import Optional, List
from pydantic import BaseModel
from sqlalchemy import select, func, and_, distinct, delete as sa_delete
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.infrastructure.db import get_db
from app.infrastructure.models import WorkoutResult, RaceSplit, Swimmer
from app.middleware.auth import get_current_user_id
from app.middleware.authorization import get_coach_membership

router = APIRouter(prefix="/workout-results", tags=["workout-results"])


class WorkoutResultCreate(BaseModel):
    swimmer_id: str
    distance: int
    stroke: str
    activity: str = "swim"
    equipment: str = "none"
    units: Optional[str] = "meters"
    time_result: str
    performed_on: Optional[str] = None
    training_session_id: Optional[str] = None
    result_units: Optional[str] = "SCM"


class WorkoutResultUpdate(BaseModel):
    swimmer_id: Optional[str] = None
    distance: Optional[int] = None
    stroke: Optional[str] = None
    activity: Optional[str] = None
    equipment: Optional[str] = None
    units: Optional[str] = None
    time_result: Optional[str] = None
    performed_on: Optional[str] = None
    training_session_id: Optional[str] = None
    result_units: Optional[str] = None


# ── Helpers ───────────────────────────────────────────────

def _row_to_dict(row) -> dict:
    d = {}
    for col in row.__table__.columns:
        val = getattr(row, col.name)
        if hasattr(val, 'hex'):
            val = str(val)
        d[col.name] = val
    return d


def _time_to_seconds(time_str: str) -> float:
    """Convert a time string like '1:23.45' or '23.45' to total seconds."""
    if not time_str:
        return float('inf')
    try:
        parts = time_str.strip().split(':')
        if len(parts) == 2:
            minutes = int(parts[0])
            seconds = float(parts[1])
            return minutes * 60 + seconds
        elif len(parts) == 1:
            return float(parts[0])
        else:
            # H:M:S
            hours = int(parts[0])
            minutes = int(parts[1])
            seconds = float(parts[2])
            return hours * 3600 + minutes * 60 + seconds
    except (ValueError, IndexError):
        return float('inf')


async def _require_manage_results(db: AsyncSession, user_id: str, swimmer_id: str) -> None:
    """Verify that user has can_manage_results permission for the swimmer's squad."""
    swimmer_result = await db.execute(
        select(Swimmer.squad_id).where(Swimmer.id == swimmer_id)
    )
    row = swimmer_result.first()
    if not row or not row.squad_id:
        raise HTTPException(status_code=404, detail="Swimmer not found")
    squad_id = str(row.squad_id)
    membership = await get_coach_membership(db, user_id, squad_id)
    if not membership.can_manage_results:
        from app.domain.exceptions import UnauthorizedError
        raise UnauthorizedError("Missing permission: can_manage_results")


# ── Individual Result CRUD ─────────────────────────────────

@router.get("/{result_id}")
async def get_workout_result(
    result_id: str,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    """Get a single workout result by ID."""
    result = await db.execute(
        select(WorkoutResult).where(WorkoutResult.id == result_id)
    )
    row = result.scalar_one_or_none()
    if not row:
        raise HTTPException(status_code=404, detail="Workout result not found")
    return _row_to_dict(row)


@router.post("")
async def create_workout_result(
    body: WorkoutResultCreate,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    """Create a new workout result. Requires can_manage_results on swimmer's squad."""
    await _require_manage_results(db, user_id, body.swimmer_id)
    data = body.model_dump(exclude_unset=True)
    instance = WorkoutResult(**data)
    db.add(instance)
    await db.commit()
    await db.refresh(instance)
    return _row_to_dict(instance)


@router.put("/{result_id}")
async def update_workout_result(
    result_id: str,
    body: WorkoutResultUpdate,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    """Update a workout result. Requires can_manage_results on the result's swimmer's squad."""
    result = await db.execute(
        select(WorkoutResult).where(WorkoutResult.id == result_id)
    )
    instance = result.scalar_one_or_none()
    if not instance:
        raise HTTPException(status_code=404, detail="Workout result not found")

    await _require_manage_results(db, user_id, str(instance.swimmer_id))

    for field, value in body.model_dump(exclude_unset=True).items():
        if hasattr(instance, field):
            setattr(instance, field, value)

    await db.commit()
    await db.refresh(instance)
    return _row_to_dict(instance)


@router.delete("/{result_id}")
async def delete_workout_result(
    result_id: str,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    """Delete a workout result. Requires can_manage_results on the result's swimmer's squad."""
    # Look up the result first to get swimmer_id for auth check
    lookup = await db.execute(
        select(WorkoutResult.swimmer_id).where(WorkoutResult.id == result_id)
    )
    row = lookup.first()
    if not row:
        raise HTTPException(status_code=404, detail="Workout result not found")

    await _require_manage_results(db, user_id, str(row.swimmer_id))

    await db.execute(
        sa_delete(WorkoutResult).where(WorkoutResult.id == result_id)
    )
    await db.commit()
    return {"message": "Deleted"}


# ── Swimmer/Squad Endpoints ───────────────────────────────

@router.get("/swimmer/{swimmer_id}")
async def list_swimmer_results(
    swimmer_id: str,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    """List all workout results for a swimmer, ordered by performed_on desc."""
    result = await db.execute(
        select(WorkoutResult)
        .where(WorkoutResult.swimmer_id == swimmer_id)
        .order_by(WorkoutResult.performed_on.desc())
    )
    rows = result.scalars().all()

    return [
        {
            "id": str(r.id),
            "swimmer_id": str(r.swimmer_id),
            "distance": r.distance,
            "stroke": r.stroke,
            "activity": r.activity,
            "equipment": r.equipment,
            "time_result": r.time_result,
            "performed_on": r.performed_on.isoformat() if r.performed_on else None,
            "training_session_id": None,
            "result_units": r.result_units,
        }
        for r in rows
    ]


@router.get("/swimmer/{swimmer_id}/event-attempts")
async def swimmer_event_attempts(
    swimmer_id: str,
    distance: int = Query(...),
    stroke: str = Query(...),
    activity: str = Query("swim"),
    equipment: str = Query("none"),
    result_units: str = Query("SCM"),
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    """Get all attempts for a specific event. Include race_splits (eager load). Order by performed_on asc."""
    conditions = [
        WorkoutResult.swimmer_id == swimmer_id,
        WorkoutResult.distance == distance,
        WorkoutResult.stroke == stroke,
    ]

    if activity:
        conditions.append(WorkoutResult.activity == activity)
    if equipment:
        conditions.append(WorkoutResult.equipment == equipment)
    if result_units:
        conditions.append(WorkoutResult.result_units == result_units)

    result = await db.execute(
        select(WorkoutResult)
        .options(selectinload(WorkoutResult.race_splits))
        .where(and_(*conditions))
        .order_by(WorkoutResult.performed_on.asc())
    )
    rows = result.scalars().all()

    results_list = []
    for r in rows:
        d = _row_to_dict(r)
        d["race_splits"] = [_row_to_dict(s) for s in r.race_splits]
        results_list.append(d)

    return results_list


@router.get("/squad/{squad_id}/rankings")
async def squad_rankings(
    squad_id: str,
    stroke: str = Query(...),
    activity: str = Query("swim"),
    distance: int = Query(...),
    result_units: str = Query("SCM"),
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    """Get squad rankings for a specific event. Best time per swimmer, sorted ascending."""
    # Get swimmers in squad
    swimmers_result = await db.execute(
        select(Swimmer).where(Swimmer.squad_id == squad_id)
    )
    swimmers = swimmers_result.scalars().all()
    swimmer_map = {str(s.id): s for s in swimmers}
    swimmer_ids = list(swimmer_map.keys())

    if not swimmer_ids:
        return []

    # Get all matching results for these swimmers
    conditions = [
        WorkoutResult.swimmer_id.in_([s.id for s in swimmers]),
        WorkoutResult.stroke == stroke,
        WorkoutResult.distance == distance,
    ]
    if activity:
        conditions.append(WorkoutResult.activity == activity)
    if result_units:
        conditions.append(WorkoutResult.result_units == result_units)

    results_result = await db.execute(
        select(WorkoutResult).where(and_(*conditions))
    )
    all_results = results_result.scalars().all()

    # Find best time per swimmer
    best_times = {}
    for r in all_results:
        sid = str(r.swimmer_id)
        if not r.time_result:
            continue
        current_secs = _time_to_seconds(r.time_result)
        if sid not in best_times or current_secs < _time_to_seconds(best_times[sid].time_result):
            best_times[sid] = r

    # Build ranked list
    rankings = []
    for sid, wr in best_times.items():
        swimmer = swimmer_map.get(sid)
        if swimmer:
            d = _row_to_dict(wr)
            d["swimmer_name"] = f"{swimmer.first_name or ''} {swimmer.last_name or ''}".strip()
            d["swimmer_first_name"] = swimmer.first_name
            d["swimmer_last_name"] = swimmer.last_name
            d["best_time"] = _time_to_seconds(wr.time_result)
            d["date_of_birth"] = swimmer.date_of_birth.isoformat() if swimmer.date_of_birth else None
            d["sex"] = swimmer.sex
            rankings.append(d)

    # Sort by time ascending
    rankings.sort(key=lambda x: _time_to_seconds(x.get("time_result", "")))

    return rankings


@router.get("/squad/{squad_id}/available-distances")
async def squad_available_distances(
    squad_id: str,
    stroke: str = Query(...),
    activity: str = Query("swim"),
    result_units: str = Query("SCM"),
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    """Return distinct distances for a given stroke/activity/units in a squad."""
    # Get swimmer IDs in squad
    swimmers_result = await db.execute(
        select(Swimmer.id).where(Swimmer.squad_id == squad_id)
    )
    swimmer_ids = list(swimmers_result.scalars().all())

    if not swimmer_ids:
        return []

    conditions = [
        WorkoutResult.swimmer_id.in_(swimmer_ids),
        WorkoutResult.stroke == stroke,
    ]
    if activity:
        conditions.append(WorkoutResult.activity == activity)
    if result_units:
        conditions.append(WorkoutResult.result_units == result_units)

    result = await db.execute(
        select(distinct(WorkoutResult.distance))
        .where(and_(*conditions))
        .order_by(WorkoutResult.distance)
    )
    distances = [row for row in result.scalars().all() if row is not None]
    return distances
