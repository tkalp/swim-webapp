"""Workout templates API routes — replaces frontend direct Supabase calls."""
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from typing import Optional, List
from sqlalchemy import select, func, and_
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.infrastructure.db import get_db
from app.infrastructure.models import (
    WorkoutTemplate, WorkoutTemplateTag, WorkoutTag,
    TrainingSession, Squad, Coach,
)
from app.middleware.auth import get_current_user_id
from app.domain.exceptions import UnauthorizedError

router = APIRouter(prefix="/workouts", tags=["workouts"])


# ── Request Models ────────────────────────────────────────

class WorkoutCreate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    raw_description: Optional[str] = None
    total_meters: Optional[int] = None
    estimated_time_minutes: Optional[float] = None
    estimated_calories: Optional[int] = None
    effort_level: Optional[int] = None
    json_description: Optional[dict] = None
    create_by_coach: Optional[str] = None
    classification: Optional[str] = None
    visibility: str = "private"


class WorkoutUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    raw_description: Optional[str] = None
    total_meters: Optional[int] = None
    estimated_time_minutes: Optional[float] = None
    estimated_calories: Optional[int] = None
    effort_level: Optional[int] = None
    json_description: Optional[dict] = None
    classification: Optional[str] = None
    visibility: Optional[str] = None


class AssignSessionBody(BaseModel):
    workout_id: str
    session_id: str


class SetTagsBody(BaseModel):
    tag_ids: List[str]


# ── Helpers ───────────────────────────────────────────────

async def _get_coach_for_user(db: AsyncSession, user_id: str) -> Coach:
    """Resolve a user_id to their Coach record. Raises UnauthorizedError if none."""
    coach_result = await db.execute(select(Coach).where(Coach.user_id == user_id))
    coach = coach_result.scalar_one_or_none()
    if not coach:
        raise UnauthorizedError("No coach profile found")
    return coach


def _row_to_dict(row) -> dict:
    d = {}
    for col in row.__table__.columns:
        val = getattr(row, col.name)
        if hasattr(val, 'hex'):
            val = str(val)
        d[col.name] = val
    return d


# ── Endpoints ─────────────────────────────────────────────

@router.get("/{workout_id}")
async def get_workout(
    workout_id: str,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    """Get a single workout template."""
    result = await db.execute(
        select(WorkoutTemplate).where(WorkoutTemplate.id == workout_id)
    )
    workout = result.scalar_one_or_none()
    if not workout:
        raise HTTPException(status_code=404, detail="Workout not found")
    return _row_to_dict(workout)


@router.post("")
async def create_workout(
    body: WorkoutCreate,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    """Create a workout template."""
    workout = WorkoutTemplate(
        name=body.name,
        description=body.description,
        raw_description=body.raw_description,
        total_meters=body.total_meters,
        estimated_time_minutes=body.estimated_time_minutes,
        estimated_calories=body.estimated_calories,
        effort_level=body.effort_level,
        json_description=body.json_description,
        create_by_coach=body.create_by_coach,
        classification=body.classification,
        visibility=body.visibility,
    )
    db.add(workout)
    await db.commit()
    await db.refresh(workout)

    # Dispatch style profile recomputation if coach is set
    if workout.create_by_coach:
        from app.services.coach_style_service import dispatch_style_recomputation
        dispatch_style_recomputation(str(workout.create_by_coach))

    return _row_to_dict(workout)


@router.put("/{workout_id}")
async def update_workout(
    workout_id: str,
    body: WorkoutUpdate,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    """Update a workout template. Only the creating coach may update it."""
    result = await db.execute(
        select(WorkoutTemplate).where(WorkoutTemplate.id == workout_id)
    )
    workout = result.scalar_one_or_none()
    if not workout:
        raise HTTPException(status_code=404, detail="Workout not found")

    coach = await _get_coach_for_user(db, user_id)
    if str(workout.create_by_coach) != str(coach.id):
        raise UnauthorizedError("You can only modify your own workouts")

    if body.name is not None:
        workout.name = body.name
    if body.description is not None:
        workout.description = body.description
    if body.raw_description is not None:
        workout.raw_description = body.raw_description
    if body.total_meters is not None:
        workout.total_meters = body.total_meters
    if body.estimated_time_minutes is not None:
        workout.estimated_time_minutes = body.estimated_time_minutes
    if body.estimated_calories is not None:
        workout.estimated_calories = body.estimated_calories
    if body.effort_level is not None:
        workout.effort_level = body.effort_level
    if body.json_description is not None:
        workout.json_description = body.json_description
    if body.visibility is not None:
        workout.visibility = body.visibility

    await db.commit()
    await db.refresh(workout)

    # Dispatch style profile recomputation if coach is set
    if workout.create_by_coach:
        from app.services.coach_style_service import dispatch_style_recomputation
        dispatch_style_recomputation(str(workout.create_by_coach))

    return _row_to_dict(workout)


@router.delete("/{workout_id}")
async def delete_workout(
    workout_id: str,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    """Delete a workout template. Returns 400 if used in sessions. Only the creating coach may delete."""
    # Check if workout is used in any session
    usage_result = await db.execute(
        select(func.count(TrainingSession.id))
        .where(TrainingSession.workout_id == workout_id)
    )
    usage_count = usage_result.scalar() or 0
    if usage_count > 0:
        raise HTTPException(
            status_code=400,
            detail=f"Cannot delete workout: it is used in {usage_count} training session(s).",
        )

    result = await db.execute(
        select(WorkoutTemplate).where(WorkoutTemplate.id == workout_id)
    )
    workout = result.scalar_one_or_none()
    if not workout:
        raise HTTPException(status_code=404, detail="Workout not found")

    coach = await _get_coach_for_user(db, user_id)
    if str(workout.create_by_coach) != str(coach.id):
        raise UnauthorizedError("You can only delete your own workouts")

    await db.delete(workout)
    await db.commit()
    return {"success": True}


@router.post("/{workout_id}/duplicate")
async def duplicate_workout(
    workout_id: str,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    """Duplicate a workout template with tags, appending '(Copy)' to name."""
    result = await db.execute(
        select(WorkoutTemplate)
        .options(selectinload(WorkoutTemplate.tag_associations))
        .where(WorkoutTemplate.id == workout_id)
    )
    original = result.scalar_one_or_none()
    if not original:
        raise HTTPException(status_code=404, detail="Workout not found")

    clone = WorkoutTemplate(
        name=f"{original.name} (Copy)" if original.name else "(Copy)",
        description=original.description,
        raw_description=original.raw_description,
        total_meters=original.total_meters,
        estimated_time_minutes=original.estimated_time_minutes,
        estimated_calories=original.estimated_calories,
        effort_level=original.effort_level,
        json_description=original.json_description,
        create_by_coach=original.create_by_coach,
        visibility=original.visibility,
        cloned_from_id=original.id,
        original_creator_id=original.create_by_coach,
    )
    db.add(clone)
    await db.flush()

    # Duplicate tag associations
    for assoc in original.tag_associations:
        new_assoc = WorkoutTemplateTag(
            workout_id=clone.id,
            tag_id=assoc.tag_id,
        )
        db.add(new_assoc)

    # Increment clone count on original
    original.clone_count = (original.clone_count or 0) + 1

    await db.commit()
    await db.refresh(clone)

    # Dispatch style profile recomputation if coach is set
    if clone.create_by_coach:
        from app.services.coach_style_service import dispatch_style_recomputation
        dispatch_style_recomputation(str(clone.create_by_coach))

    return _row_to_dict(clone)


@router.get("/coach/{coach_id}")
async def list_coach_workouts(
    coach_id: str,
    limit: int = Query(20),
    offset: int = Query(0),
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    """List workouts for a coach with usage stats and tags. Returns paginated result."""
    # Get total count
    count_result = await db.execute(
        select(func.count(WorkoutTemplate.id))
        .where(WorkoutTemplate.create_by_coach == coach_id)
    )
    total = count_result.scalar() or 0

    # Get workouts with tags
    result = await db.execute(
        select(WorkoutTemplate)
        .options(selectinload(WorkoutTemplate.tag_associations).selectinload(WorkoutTemplateTag.tag))
        .where(WorkoutTemplate.create_by_coach == coach_id)
        .order_by(WorkoutTemplate.created_at.desc())
        .limit(limit)
        .offset(offset)
    )
    workouts = result.scalars().all()

    # Get usage counts for these workouts
    workout_ids = [str(w.id) for w in workouts]
    usage_result = await db.execute(
        select(
            TrainingSession.workout_id,
            func.count(TrainingSession.id).label("usage_count"),
        )
        .where(TrainingSession.workout_id.in_([w.id for w in workouts]))
        .group_by(TrainingSession.workout_id)
    )
    usage_map = {str(row.workout_id): row.usage_count for row in usage_result.all()}

    workout_list = []
    for w in workouts:
        d = _row_to_dict(w)
        d["usage_count"] = usage_map.get(str(w.id), 0)
        d["tags"] = [
            {
                "id": str(assoc.tag.id),
                "name": assoc.tag.name,
                "color": assoc.tag.color,
            }
            for assoc in w.tag_associations
            if assoc.tag
        ]
        workout_list.append(d)

    return {
        "workouts": workout_list,
        "hasMore": (offset + limit) < total,
        "total": total,
    }


@router.get("/squad/{squad_id}")
async def list_squad_workouts(
    squad_id: str,
    limit: int = Query(20),
    offset: int = Query(0),
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    """List workouts for a squad. Looks up coach_id from squad first."""
    # Look up coach_id from squad
    squad_result = await db.execute(
        select(Squad.coach_id).where(Squad.id == squad_id)
    )
    row = squad_result.first()
    if not row or not row.coach_id:
        raise HTTPException(status_code=404, detail="Squad not found or no coach assigned")

    coach_id = str(row.coach_id)

    # Delegate to the coach workouts endpoint logic
    count_result = await db.execute(
        select(func.count(WorkoutTemplate.id))
        .where(WorkoutTemplate.create_by_coach == coach_id)
    )
    total = count_result.scalar() or 0

    result = await db.execute(
        select(WorkoutTemplate)
        .options(selectinload(WorkoutTemplate.tag_associations).selectinload(WorkoutTemplateTag.tag))
        .where(WorkoutTemplate.create_by_coach == coach_id)
        .order_by(WorkoutTemplate.created_at.desc())
        .limit(limit)
        .offset(offset)
    )
    workouts = result.scalars().all()

    usage_result = await db.execute(
        select(
            TrainingSession.workout_id,
            func.count(TrainingSession.id).label("usage_count"),
        )
        .where(TrainingSession.workout_id.in_([w.id for w in workouts]))
        .group_by(TrainingSession.workout_id)
    )
    usage_map = {str(row.workout_id): row.usage_count for row in usage_result.all()}

    workout_list = []
    for w in workouts:
        d = _row_to_dict(w)
        d["usage_count"] = usage_map.get(str(w.id), 0)
        d["tags"] = [
            {
                "id": str(assoc.tag.id),
                "name": assoc.tag.name,
                "color": assoc.tag.color,
            }
            for assoc in w.tag_associations
            if assoc.tag
        ]
        workout_list.append(d)

    return {
        "workouts": workout_list,
        "hasMore": (offset + limit) < total,
        "total": total,
    }


@router.post("/assign-session")
async def assign_session(
    body: AssignSessionBody,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    """Assign a workout to a training session."""
    result = await db.execute(
        select(TrainingSession).where(TrainingSession.id == body.session_id)
    )
    session = result.scalar_one_or_none()
    if not session:
        raise HTTPException(status_code=404, detail="Training session not found")

    session.workout_id = body.workout_id
    await db.commit()
    await db.refresh(session)
    return _row_to_dict(session)


@router.post("/{workout_id}/tags/set")
async def set_workout_tags(
    workout_id: str,
    body: SetTagsBody,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    """Replace all tag associations for a workout."""
    # Verify workout exists
    workout_result = await db.execute(
        select(WorkoutTemplate).where(WorkoutTemplate.id == workout_id)
    )
    if not workout_result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Workout not found")

    # Delete existing associations
    existing_result = await db.execute(
        select(WorkoutTemplateTag).where(WorkoutTemplateTag.workout_id == workout_id)
    )
    for assoc in existing_result.scalars().all():
        await db.delete(assoc)

    # Create new associations
    new_assocs = []
    for tag_id in body.tag_ids:
        assoc = WorkoutTemplateTag(
            workout_id=workout_id,
            tag_id=tag_id,
        )
        db.add(assoc)
        new_assocs.append(assoc)

    await db.commit()
    for a in new_assocs:
        await db.refresh(a)
    return [_row_to_dict(a) for a in new_assocs]
