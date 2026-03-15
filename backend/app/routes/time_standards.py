"""Time standards API routes — replaces frontend direct Supabase calls."""
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from typing import List, Optional
from sqlalchemy import select, func, delete
from sqlalchemy.ext.asyncio import AsyncSession

from app.infrastructure.db import get_db
from app.infrastructure.models import (
    TimeStandardsSet, TimeStandard, SwimmerStandardsTracking, Coach,
)
from app.middleware.auth import get_current_user_id
from app.domain.exceptions import UnauthorizedError
from app.utils import logger

router = APIRouter(prefix="/time-standards", tags=["time-standards"])


# ── Pydantic schemas ────────────────────────────────────────

class StandardsSetCreate(BaseModel):
    name: str
    organization: Optional[str] = None
    year: Optional[int] = None
    description: Optional[str] = None


class StandardsSetUpdate(BaseModel):
    name: Optional[str] = None
    organization: Optional[str] = None
    year: Optional[int] = None
    description: Optional[str] = None
    active: Optional[bool] = None


class TimeStandardCreate(BaseModel):
    set_id: str
    distance: int
    stroke: str
    activity: str = "swim"
    equipment: str = "none"
    age_group_min: Optional[int] = None
    age_group_max: Optional[int] = None
    gender: Optional[str] = None
    scm_time: Optional[str] = None
    lcm_time: Optional[str] = None
    standard_level: Optional[str] = None
    points: Optional[int] = None


class TimeStandardUpdate(BaseModel):
    distance: Optional[int] = None
    stroke: Optional[str] = None
    activity: Optional[str] = None
    equipment: Optional[str] = None
    age_group_min: Optional[int] = None
    age_group_max: Optional[int] = None
    gender: Optional[str] = None
    scm_time: Optional[str] = None
    lcm_time: Optional[str] = None
    standard_level: Optional[str] = None
    points: Optional[int] = None


class BulkStandardCreate(BaseModel):
    set_id: str
    standards: List[TimeStandardCreate]


class TrackingCreate(BaseModel):
    swimmer_id: str
    standard_set_id: str
    notes: Optional[str] = None


# ── Helper ─────────────────────────────────────────────────

def _row_to_dict(row) -> dict:
    d = {}
    for col in row.__table__.columns:
        val = getattr(row, col.name)
        if hasattr(val, 'hex'):
            val = str(val)
        d[col.name] = val
    return d


async def _get_coach(db: AsyncSession, user_id: str) -> Coach:
    """Look up the Coach for a given user_id. Raises 403 if not found."""
    result = await db.execute(select(Coach).where(Coach.user_id == user_id))
    coach = result.scalar_one_or_none()
    if not coach:
        raise UnauthorizedError("No coach profile found")
    return coach


async def _assert_set_owner(db: AsyncSession, set_id: str, coach_id) -> TimeStandardsSet:
    """Verify the given coach owns the standards set. Returns the set."""
    set_result = await db.execute(
        select(TimeStandardsSet).where(TimeStandardsSet.id == set_id)
    )
    std_set = set_result.scalar_one_or_none()
    if not std_set:
        raise HTTPException(status_code=404, detail="Standards set not found")
    if str(std_set.created_by) != str(coach_id):
        raise UnauthorizedError("You can only modify standards in your own sets")
    return std_set


# ── Standards Sets ─────────────────────────────────────────

@router.get("/sets")
async def list_sets(
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    """Get all time standards sets for this coach."""
    coach = await _get_coach(db, user_id)
    result = await db.execute(
        select(TimeStandardsSet, func.count(TimeStandard.id).label("standards_count"))
        .outerjoin(TimeStandard, TimeStandard.set_id == TimeStandardsSet.id)
        .where(TimeStandardsSet.created_by == coach.id)
        .group_by(TimeStandardsSet.id)
        .order_by(TimeStandardsSet.created_at.desc())
    )
    output = []
    for std_set, standards_count in result.all():
        d = _row_to_dict(std_set)
        d["standards_count"] = standards_count
        output.append(d)

    return output


@router.post("/sets")
async def create_set(
    body: StandardsSetCreate,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    """Create a new time standards set."""
    coach = await _get_coach(db, user_id)
    instance = TimeStandardsSet(
        name=body.name,
        organization=body.organization,
        year=body.year,
        description=body.description,
        created_by=coach.id,
    )
    db.add(instance)
    await db.commit()
    await db.refresh(instance)
    return _row_to_dict(instance)


@router.put("/sets/{set_id}")
async def update_set(
    set_id: str,
    body: StandardsSetUpdate,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    """Update a time standards set."""
    coach = await _get_coach(db, user_id)
    instance = await _assert_set_owner(db, set_id, coach.id)

    for field, value in body.model_dump(exclude_unset=True).items():
        setattr(instance, field, value)

    await db.commit()
    await db.refresh(instance)
    return _row_to_dict(instance)


@router.delete("/sets/{set_id}")
async def delete_set(
    set_id: str,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    """Delete a time standards set and all its standards."""
    coach = await _get_coach(db, user_id)
    instance = await _assert_set_owner(db, set_id, coach.id)

    await db.delete(instance)
    await db.commit()
    return {"message": "Deleted"}


# ── Individual Standards ────────────────────────────────────

@router.get("/sets/{set_id}/standards")
async def list_standards(
    set_id: str,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    """Get all standards in a set."""
    result = await db.execute(
        select(TimeStandard)
        .where(TimeStandard.set_id == set_id)
        .order_by(TimeStandard.distance, TimeStandard.stroke)
    )
    return [_row_to_dict(row) for row in result.scalars().all()]


@router.post("/standards")
async def create_standard(
    body: TimeStandardCreate,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    """Create a single time standard."""
    instance = TimeStandard(**body.model_dump())
    db.add(instance)
    await db.commit()
    await db.refresh(instance)
    return _row_to_dict(instance)


@router.post("/sets/{set_id}/standards")
async def create_standard_in_set(
    set_id: str,
    body: TimeStandardCreate,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    """Create a time standard within a specific set."""
    data = body.model_dump()
    data["set_id"] = set_id
    instance = TimeStandard(**data)
    db.add(instance)
    await db.commit()
    await db.refresh(instance)
    return _row_to_dict(instance)


@router.post("/standards/bulk")
async def bulk_create_standards(
    body: BulkStandardCreate,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    """Bulk create time standards for a set."""
    coach = await _get_coach(db, user_id)
    await _assert_set_owner(db, body.set_id, coach.id)

    instances = [TimeStandard(**s.model_dump()) for s in body.standards]
    db.add_all(instances)
    await db.commit()
    return {"created": len(instances)}


@router.put("/standards/{standard_id}")
async def update_standard(
    standard_id: str,
    body: TimeStandardUpdate,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    """Update a time standard."""
    coach = await _get_coach(db, user_id)

    result = await db.execute(
        select(TimeStandard).where(TimeStandard.id == standard_id)
    )
    instance = result.scalar_one_or_none()
    if not instance:
        raise HTTPException(status_code=404, detail="Standard not found")

    # Verify ownership via the parent set
    await _assert_set_owner(db, str(instance.set_id), coach.id)

    for field, value in body.model_dump(exclude_unset=True).items():
        setattr(instance, field, value)

    await db.commit()
    await db.refresh(instance)
    return _row_to_dict(instance)


@router.delete("/standards/{standard_id}")
async def delete_standard(
    standard_id: str,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    """Delete a time standard."""
    coach = await _get_coach(db, user_id)

    result = await db.execute(
        select(TimeStandard).where(TimeStandard.id == standard_id)
    )
    instance = result.scalar_one_or_none()
    if not instance:
        raise HTTPException(status_code=404, detail="Standard not found")

    # Verify ownership via the parent set
    await _assert_set_owner(db, str(instance.set_id), coach.id)

    await db.execute(
        delete(TimeStandard).where(TimeStandard.id == standard_id)
    )
    await db.commit()
    return {"message": "Deleted"}


# ── Swimmer Standards Tracking ──────────────────────────────

@router.get("/tracking/{swimmer_id}")
async def get_swimmer_tracking(
    swimmer_id: str,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    """Get standards tracking for a swimmer."""
    result = await db.execute(
        select(SwimmerStandardsTracking)
        .where(SwimmerStandardsTracking.swimmer_id == swimmer_id)
        .where(SwimmerStandardsTracking.active == True)
    )
    return [_row_to_dict(row) for row in result.scalars().all()]


@router.post("/tracking")
async def create_tracking(
    body: TrackingCreate,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    """Track a swimmer against a standards set."""
    coach = await _get_coach(db, user_id)
    instance = SwimmerStandardsTracking(
        swimmer_id=body.swimmer_id,
        standard_set_id=body.standard_set_id,
        created_by=coach.id,
        notes=body.notes,
    )
    db.add(instance)
    await db.commit()
    await db.refresh(instance)
    return _row_to_dict(instance)


@router.delete("/tracking/{tracking_id}")
async def delete_tracking(
    tracking_id: str,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    """Remove standards tracking."""
    coach = await _get_coach(db, user_id)

    result = await db.execute(
        select(SwimmerStandardsTracking)
        .where(SwimmerStandardsTracking.id == tracking_id)
    )
    tracking = result.scalar_one_or_none()
    if not tracking:
        raise HTTPException(status_code=404, detail="Tracking record not found")

    if str(tracking.created_by) != str(coach.id):
        raise UnauthorizedError("You can only remove tracking records you created")

    await db.execute(
        delete(SwimmerStandardsTracking)
        .where(SwimmerStandardsTracking.id == tracking_id)
    )
    await db.commit()
    return {"message": "Deleted"}
