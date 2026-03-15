from fastapi import APIRouter, HTTPException, Depends
from typing import Optional, List
from pydantic import BaseModel
from uuid import UUID

from sqlalchemy import select, and_, or_
from sqlalchemy.ext.asyncio import AsyncSession
from app.infrastructure.db import get_db
from app.infrastructure.models import WorkoutTemplate, Coach, WorkoutTemplateTag, CoachConnection
from app.middleware.auth import get_current_user_id
from app.utils import logger

router = APIRouter(prefix="/workout-sharing", tags=["workout-sharing"])


# ============ Models ============
class UpdateVisibilityRequest(BaseModel):
    visibility: str  # 'private', 'network', 'public'


class CloneWorkoutRequest(BaseModel):
    workout_id: UUID
    new_name: Optional[str] = None


class SharedWorkoutResponse(BaseModel):
    id: UUID
    name: str
    coach_name: str
    effectiveness_rating: Optional[float]
    rating_count: int
    clone_count: int
    times_used: int
    visibility: str


# ============ Endpoints ============
@router.put("/visibility/{workout_id}")
async def update_workout_visibility(
    workout_id: UUID,
    request: UpdateVisibilityRequest,
    coach_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    """Update visibility of a workout (owner only)."""
    try:
        if request.visibility not in ['private', 'network', 'public']:
            raise HTTPException(400, "Invalid visibility level")

        result = await db.execute(
            select(WorkoutTemplate).where(
                and_(
                    WorkoutTemplate.id == str(workout_id),
                    WorkoutTemplate.create_by_coach == coach_id,
                )
            )
        )
        workout = result.scalar_one_or_none()

        if not workout:
            raise HTTPException(404, "Workout not found or unauthorized")

        workout.visibility = request.visibility
        await db.commit()

        logger.info(f"Coach {coach_id} set workout {workout_id} visibility to {request.visibility}")
        return {"message": "Visibility updated", "visibility": request.visibility}

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating visibility: {str(e)}")
        raise HTTPException(500, str(e))


@router.post("/clone")
async def clone_workout(
    request: CloneWorkoutRequest,
    coach_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    """Clone a public/shared workout to your library."""
    try:
        # Get original workout
        result = await db.execute(
            select(WorkoutTemplate).where(WorkoutTemplate.id == str(request.workout_id))
        )
        original = result.scalar_one_or_none()

        if not original:
            raise HTTPException(404, "Workout not found or not accessible")

        # Can't clone your own workout
        if str(original.create_by_coach) == coach_id:
            raise HTTPException(400, "Cannot clone your own workout")

        # Create clone
        cloned = WorkoutTemplate(
            name=request.new_name or f"{original.name} (Copy)",
            description=original.description,
            raw_description=original.raw_description,
            total_meters=original.total_meters,
            estimated_time_minutes=original.estimated_time_minutes,
            estimated_calories=original.estimated_calories,
            effort_level=original.effort_level,
            json_description=original.json_description,
            create_by_coach=coach_id,
            visibility='private',
            cloned_from_id=str(request.workout_id),
            original_creator_id=original.create_by_coach,
            effectiveness_rating=None,
            rating_count=0,
            times_used=0,
            clone_count=0,
        )
        db.add(cloned)
        await db.flush()

        # Copy tag associations from the original workout
        original_tags = await db.execute(
            select(WorkoutTemplateTag).where(WorkoutTemplateTag.workout_id == str(request.workout_id))
        )
        for tag_assoc in original_tags.scalars().all():
            new_tag = WorkoutTemplateTag(workout_id=cloned.id, tag_id=tag_assoc.tag_id)
            db.add(new_tag)

        # Increment clone count on original
        original.clone_count = (original.clone_count or 0) + 1
        await db.commit()
        await db.refresh(cloned)

        logger.info(f"Coach {coach_id} cloned workout {request.workout_id}")
        return {
            "id": str(cloned.id),
            "name": cloned.name,
            "description": cloned.description,
            "raw_description": cloned.raw_description,
            "total_meters": cloned.total_meters,
            "estimated_time_minutes": cloned.estimated_time_minutes,
            "estimated_calories": cloned.estimated_calories,
            "effort_level": cloned.effort_level,
            "json_description": cloned.json_description,
            "create_by_coach": str(cloned.create_by_coach) if cloned.create_by_coach else None,
            "visibility": cloned.visibility,
            "effectiveness_rating": cloned.effectiveness_rating,
            "rating_count": cloned.rating_count,
            "times_used": cloned.times_used,
            "clone_count": cloned.clone_count,
            "cloned_from_id": str(cloned.cloned_from_id) if cloned.cloned_from_id else None,
            "original_creator_id": str(cloned.original_creator_id) if cloned.original_creator_id else None,
            "created_at": cloned.created_at.isoformat() if cloned.created_at else None,
            "updated_at": cloned.updated_at.isoformat() if cloned.updated_at else None,
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error cloning workout: {str(e)}")
        raise HTTPException(500, str(e))


@router.get("/discover", response_model=List[SharedWorkoutResponse])
async def discover_workouts(
    visibility: Optional[str] = 'public',
    sort_by: Optional[str] = 'rating',
    limit: int = 20,
    coach_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    """Discover public/network workouts from other coaches."""
    try:
        # Build query with a join to Coach for coach name
        query = (
            select(WorkoutTemplate, Coach)
            .outerjoin(Coach, WorkoutTemplate.create_by_coach == Coach.id)
            .where(WorkoutTemplate.create_by_coach != coach_id)
        )

        if visibility == 'network':
            # Only show network workouts from accepted connections
            query = query.where(
                WorkoutTemplate.visibility == 'network'
            ).where(
                WorkoutTemplate.create_by_coach.in_(
                    select(CoachConnection.requester_id).where(
                        and_(
                            CoachConnection.recipient_id == coach_id,
                            CoachConnection.status == 'accepted',
                        )
                    ).union(
                        select(CoachConnection.recipient_id).where(
                            and_(
                                CoachConnection.requester_id == coach_id,
                                CoachConnection.status == 'accepted',
                            )
                        )
                    )
                )
            )
        elif visibility:
            query = query.where(WorkoutTemplate.visibility == visibility)

        # Sort
        if sort_by == 'rating':
            query = query.order_by(WorkoutTemplate.effectiveness_rating.desc())
        elif sort_by == 'popular':
            query = query.order_by(WorkoutTemplate.clone_count.desc())
        elif sort_by == 'recent':
            query = query.order_by(WorkoutTemplate.created_at.desc())

        query = query.limit(limit)

        result = await db.execute(query)
        rows = result.all()

        # Format response
        workouts = []
        for workout, coach in rows:
            coach_name = "Unknown Coach"
            if coach:
                first = coach.first_name or ""
                last = coach.last_name or ""
                coach_name = f"{first} {last}".strip() or "Unknown Coach"

            workouts.append(SharedWorkoutResponse(
                id=workout.id,
                name=workout.name or "",
                coach_name=coach_name,
                effectiveness_rating=workout.effectiveness_rating,
                rating_count=workout.rating_count or 0,
                clone_count=workout.clone_count or 0,
                times_used=workout.times_used or 0,
                visibility=workout.visibility or 'private',
            ))

        return workouts

    except Exception as e:
        logger.error(f"Error discovering workouts: {str(e)}")
        raise HTTPException(500, str(e))
